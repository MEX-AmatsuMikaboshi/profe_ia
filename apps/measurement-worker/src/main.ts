import { writeFileSync } from 'node:fs';

/**
 * Entrypoint de contenedor de `measurement-worker` (Plan.md T-H3-01).
 *
 * La autoridad determinista de sondas ya está implementada en `authority.ts`.
 * Este proceso sigue siendo únicamente el heartbeat del contenedor: el
 * El calendario SCED determinista está en `@profesor-ia/experiment`. Este
 * proceso sigue sin adaptador de transporte: el cableado de la sesión seca se
 * completa con las tareas restantes de H6.
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
log('started', {
  duty: 'autoridad aislada de medicion',
  status: 'AUTHORITY_CORE_READY',
  calendar: 'SCED_CALENDAR_CORE_READY',
  transport: 'NOT_WIRED',
});
const timer = setInterval(heartbeat, HEARTBEAT_MS);

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    clearInterval(timer);
    log('shutdown', { signal });
    process.exit(0);
  });
}
