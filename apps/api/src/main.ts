import { createServer, type IncomingMessage } from 'node:http';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { currentTraceId, startTelemetry, withSpan } from '@profesor-ia/observability';

import { VERDICT_ROUTE_PATH, handleVerdictRequest } from './clase-verdict-route.js';
import { DEFAULT_SPOOL_TIMING, type SpoolPaths, type SpoolTiming } from './verdict-spool.js';

/**
 * Entrypoint de contenedor de `api` (Plan.md T-H3-01).
 *
 * **Solo salud y logs estructurados.** Los endpoints del orquestador son de
 * F7 (`T-H7-*`); adelantarlos aquí sería inventar superficie. Lo que este
 * proceso demuestra hoy es lo que H3 exige: el servicio arranca desde cero,
 * responde a un healthcheck y deja traza estructurada local.
 */

const SERVICE = 'api';
const PORT = Number(process.env.PORT ?? 3001);
const LOG_FILE = process.env.LOG_FILE ?? `/var/log/profesor-ia/${SERVICE}.log`;
const startedAt = new Date().toISOString();

/**
 * Telemetría local desde el arranque (T-H3-05). **Si no hay colector
 * configurado, el proceso no arranca**: `startTelemetry()` lanza. Levantar con
 * la telemetría apagada y no decirlo es degradación silenciosa, y el AC de F3
 * pide OTel «desde el arranque», no «cuando se pueda».
 *
 * Las **métricas** salen desde este instante; los **spans** sólo cuando hay una
 * operación real que medir. Un span de «arranqué» para poder decir que hay
 * trazas sería éxito simulado, y es la razón por la que esta tarea llevaba
 * abierta desde F3 esperando a que F7 produjera algo que trazar.
 */
const telemetry = startTelemetry({ service: SERVICE, onDiagnostic: log });

function log(event: string, fields: Record<string, unknown> = {}): void {
  // `traceId` cuando lo hay: es el **único** puente entre esta línea y el span
  // de la operación, y el mismo campo que `EvidenceEvent` reserva (P-II §9.1).
  // La traza no repite lo que dice la bitácora; la referencia.
  const traceId = currentTraceId();
  const record = JSON.stringify({
    ts: new Date().toISOString(),
    service: SERVICE,
    event,
    ...(traceId === undefined ? {} : { traceId }),
    ...fields,
  });
  process.stdout.write(`${record}\n`);
  try {
    mkdirSync(dirname(LOG_FILE), { recursive: true });
    appendFileSync(LOG_FILE, `${record}\n`);
  } catch (err) {
    // El log de archivo alimenta al colector; si el volumen no está montado el
    // proceso sigue, pero lo dice: nada de degradación silenciosa.
    process.stdout.write(
      `${JSON.stringify({ ts: new Date().toISOString(), service: SERVICE, event: 'log_file_unavailable', detail: String(err) })}\n`,
    );
  }
}

/** Tope de cuerpo. Un `POST` sin límite es una denegación de servicio gratuita. */
const MAX_BODY_BYTES = 256 * 1024;

const SPOOL_PATHS: SpoolPaths = {
  inbox: process.env.SPOOL_IN ?? '/spool/in',
  outbox: process.env.SPOOL_OUT ?? '/spool/out',
  failed: process.env.SPOOL_FAILED ?? '/spool/failed',
};

const SPOOL_TIMING: SpoolTiming = {
  ...DEFAULT_SPOOL_TIMING,
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error(`cuerpo mayor que ${MAX_BODY_BYTES} bytes`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ service: SERVICE, status: 'ok', startedAt }));
    return;
  }

  // Canal de veredicto de Clase (T-H6-13). Es la única ruta implementada en F7;
  // todo lo demás sigue en `NO_IMPLEMENTADO` (D-11).
  if (req.method === 'POST' && req.url === VERDICT_ROUTE_PATH) {
    void withSpan(telemetry.tracer, 'clase.verificacion', { 'http.route': VERDICT_ROUTE_PATH }, async (span) => {
      let response;
      try {
        const raw = await readBody(req);
        response = await handleVerdictRequest(
          { paths: SPOOL_PATHS, timing: SPOOL_TIMING, tracer: telemetry.tracer },
          JSON.parse(raw),
        );
      } catch (err) {
        response = {
          status: 400 as const,
          body: { code: 'SOLICITUD_INVALIDA' as const, detail: String(err) },
        };
      }
      // Atributos del resultado, no del contenido: el veredicto es un booleano
      // y la derivación del alumno se queda fuera del span (P-II §9.3). Que sea
      // así no depende de recordarlo: `withSpan` rechaza el atributo que
      // parezca contenido.
      span.setAttributes({
        'http.status_code': response.status,
        ...(response.status === 200
          ? {
              'verdict.valid': response.body.verification.valid,
              'verdict.goal_reached': response.body.verification.goalReached ?? false,
            }
          : { 'verdict.error_code': response.body.code }),
      });
      log('verdict_request', { status: response.status });
      res.writeHead(response.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(response.body));
    });
    return;
  }

  res.writeHead(501, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ code: 'NO_IMPLEMENTADO', service: SERVICE, path: req.url }));
});

server.listen(PORT, () => log('listening', { port: PORT }));

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    log('shutdown', { signal });
    // Vaciar el lote antes de salir: la última operación de una sesión es
    // justo la que interesa cuando algo se cayó, y es la que se perdería.
    server.close(() => {
      void telemetry.shutdown().finally(() => process.exit(0));
    });
  });
}
