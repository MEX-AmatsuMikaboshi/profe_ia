import { writeFileSync } from 'node:fs';

/**
 * Entrypoint de contenedor de `background-worker` (Plan.md T-H3-01).
 *
 * Reportes, borrados y métricas son de F10. Este proceso arranca y declara que
 * no ejecuta ninguno todavía.
 *
 * Es el único servicio autorizado a suprimir artefactos personales (P-I §14.4):
 * la supresión nunca rompe la cadena append-only de `evidence`, y esa frontera
 * la fija la matriz de permisos, no este archivo.
 */

const SERVICE = 'background-worker';
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
log('started', { duty: 'reportes, borrados y métricas', status: 'NO_IMPLEMENTADO', implementedIn: 'F10' });
const timer = setInterval(heartbeat, HEARTBEAT_MS);

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    clearInterval(timer);
    log('shutdown', { signal });
    process.exit(0);
  });
}
