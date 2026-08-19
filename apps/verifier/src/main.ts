import {
  appendFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { verify, type ProofInput } from '@profesor-ia/logic-core';

/**
 * Entrypoint de contenedor del verificador (Plan.md T-H3-01, T-H3-04).
 *
 * **Sin red, por invariante.** El contenedor corre con `network_mode: none` y
 * este proceso no importa ningún cliente HTTP: la regla `i3-verifier-sin-red`
 * de dependency-cruiser lo comprueba en el grafo de módulos y `ci:logic:no-net`
 * en el código. El transporte es por eso un **spool en disco** (D-12): entra un
 * `.json` con la derivación, sale un `.json` con el veredicto.
 *
 * El veredicto lo produce `logic-core` sin heurística, sin modelo y sin reloj:
 * este proceso solo mueve archivos y registra qué hizo.
 */

const SERVICE = 'verifier';
const SPOOL_IN = process.env.SPOOL_IN ?? '/spool/in';
const SPOOL_OUT = process.env.SPOOL_OUT ?? '/spool/out';
const SPOOL_FAILED = process.env.SPOOL_FAILED ?? '/spool/failed';
const SPOOL_DONE = process.env.SPOOL_DONE ?? '/spool/done';
const HEALTH_FILE = process.env.HEALTH_FILE ?? '/tmp/health';
const POLL_MS = Number(process.env.POLL_MS ?? 1000);
const LOG_FILE = process.env.LOG_FILE ?? `/var/log/profesor-ia/${SERVICE}.log`;

/**
 * Telemetría del verificador (T-H3-05): **por archivo, nunca por OTLP**.
 *
 * Este proceso corre con `network_mode: none` y no puede exportar a ningún
 * colector: importar el SDK aquí metería un cliente HTTP en la ruta de
 * verificación y rompería I-3, que es exactamente lo que la regla
 * `i3-verifier-sin-red` impide. Su única vía es el volumen de logs, que el
 * receptor `filelog` del colector lee — un volumen no es una interfaz de red.
 *
 * Hasta esta tarea el colector **decía** leer al verificador y no leía nada:
 * este proceso escribía sólo a `stdout` y ni siquiera montaba el volumen. El
 * comentario de `otel-collector.yaml` describía una intención, no un cableado.
 *
 * La correlación con la traza de `apps/api` es por **nombre de archivo del
 * spool**, que las dos partes registran. Meter el `traceId` dentro del `.json`
 * de la derivación sería el camino cómodo y está descartado: ese archivo es la
 * entrada de `verify()`, que es función pura de su argumento, y añadirle un
 * campo de telemetría le cambiaría la entrada al verificador.
 */
function log(event: string, fields: Record<string, unknown> = {}): void {
  const record = JSON.stringify({
    ts: new Date().toISOString(),
    service: SERVICE,
    event,
    ...fields,
  });
  process.stdout.write(`${record}\n`);
  try {
    mkdirSync(dirname(LOG_FILE), { recursive: true });
    appendFileSync(LOG_FILE, `${record}\n`);
  } catch (err) {
    // Sin el volumen montado el verificador sigue verificando —su trabajo no
    // depende de la telemetría— pero lo dice por stdout en vez de callarlo.
    process.stdout.write(
      `${JSON.stringify({ ts: new Date().toISOString(), service: SERVICE, event: 'log_file_unavailable', detail: String(err) })}\n`,
    );
  }
}

for (const dir of [SPOOL_IN, SPOOL_OUT, SPOOL_FAILED, SPOOL_DONE]) {
  mkdirSync(dir, { recursive: true });
}

/**
 * El healthcheck no puede ser un endpoint: el servicio no tiene red. Es un
 * archivo con marca de tiempo que el `healthcheck` del compose comprueba.
 */
function heartbeat(): void {
  writeFileSync(HEALTH_FILE, `${Date.now()}\n`);
}

function processOne(name: string): void {
  const source = join(SPOOL_IN, name);
  try {
    const input = JSON.parse(readFileSync(source, 'utf8')) as ProofInput;
    const result = verify(input);
    writeFileSync(join(SPOOL_OUT, name), `${JSON.stringify(result, null, 2)}\n`);
    log('verified', { file: name, valid: result.valid, goalReached: result.goalReached });
  } catch (err) {
    // Una entrada ilegible no se disfraza de veredicto: se aparta y se registra.
    writeFileSync(
      join(SPOOL_FAILED, `${name}.error`),
      `${JSON.stringify({ file: name, detail: String(err) }, null, 2)}\n`,
    );
    log('unreadable_request', { file: name, detail: String(err) });
  }
  // La entrada consumida se archiva, no se borra: el spool deja rastro de qué
  // se procesó y en qué orden.
  renameSync(source, join(SPOOL_DONE, name));
}

function tick(): void {
  heartbeat();
  for (const entry of readdirSync(SPOOL_IN)) {
    if (entry.endsWith('.json')) processOne(entry);
  }
}

heartbeat();
log('started', { spoolIn: SPOOL_IN, spoolOut: SPOOL_OUT });
const timer = setInterval(tick, POLL_MS);

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    clearInterval(timer);
    log('shutdown', { signal });
    process.exit(0);
  });
}
