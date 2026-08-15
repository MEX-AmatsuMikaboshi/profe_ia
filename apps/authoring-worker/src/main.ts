import { writeFileSync } from 'node:fs';

/**
 * Entrypoint de contenedor de `authoring-worker` (Plan.md T-H3-01).
 *
 * El pipeline W0–W5 es de F5/F6. Este proceso arranca, deja constancia de que
 * **no** ejecuta ninguna etapa todavía y responde al healthcheck. No simula
 * trabajo: un worker que dijera «listo» sin pipeline sería exactamente la
 * degradación silenciosa que el proyecto prohíbe.
 *
 * Es el único servicio con salida a Internet autorizada (APIs de modelo y
 * búsqueda de fuentes en W0, P-I §15.1), y por eso el único conectado a la red
 * `egress` en el compose.
 */

const SERVICE = 'authoring-worker';
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
log('started', { pipeline: 'W0-W5', status: 'NO_IMPLEMENTADO', implementedIn: 'F5/F6' });
const timer = setInterval(heartbeat, HEARTBEAT_MS);

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    clearInterval(timer);
    log('shutdown', { signal });
    process.exit(0);
  });
}
