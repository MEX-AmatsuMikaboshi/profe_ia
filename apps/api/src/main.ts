import { createServer } from 'node:http';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

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
    // El log de archivo alimenta al colector; si el volumen no está montado el
    // proceso sigue, pero lo dice: nada de degradación silenciosa.
    process.stdout.write(
      `${JSON.stringify({ ts: new Date().toISOString(), service: SERVICE, event: 'log_file_unavailable', detail: String(err) })}\n`,
    );
  }
}

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ service: SERVICE, status: 'ok', startedAt }));
    return;
  }
  res.writeHead(501, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ code: 'NO_IMPLEMENTADO', service: SERVICE, path: req.url }));
});

server.listen(PORT, () => log('listening', { port: PORT }));

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    log('shutdown', { signal });
    server.close(() => process.exit(0));
  });
}
