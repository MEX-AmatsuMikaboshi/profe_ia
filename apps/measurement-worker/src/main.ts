import { writeFileSync } from 'node:fs';

/**
 * Entrypoint de contenedor de `measurement-worker` (Plan.md T-H3-01).
 *
 * Sondas y calendario SCED son de F7. Este proceso arranca y declara que no
 * ejecuta ninguna sonda todavía.
 *
 * Aislamiento medición/enseñanza (I-4): es el único servicio que monta las
 * reservas de sondas, y el pipeline de autoría no puede alcanzarlas —lo
 * comprueba la regla `i4-autoria-sin-sondas` en el grafo de módulos y el
 * montaje del compose en el sistema de archivos.
 */

const SERVICE = 'measurement-worker';
const HEALTH_FILE = process.env.HEALTH_FILE ?? '/tmp/health';
const HEARTBEAT_MS = Number(process.env.HEARTBEAT_MS ?? 5000);

function log(event: string, fields: Record<string, unknown> = {}): void {
  process.stdout.write(
    `${JSON.stringify({ ts: new Date().toISOString(), service: SERVICE, event, ...fields })}\n`,
  );
}

function heartbeat(): void {
  writeFileSync(HEALTH_FILE, `${Date.now()}\n`);
}

heartbeat();
log('started', { duty: 'sondas y calendario SCED', status: 'NO_IMPLEMENTADO', implementedIn: 'F7' });
const timer = setInterval(heartbeat, HEARTBEAT_MS);

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    clearInterval(timer);
    log('shutdown', { signal });
    process.exit(0);
  });
}
