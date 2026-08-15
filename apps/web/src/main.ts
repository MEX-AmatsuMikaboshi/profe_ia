import { createServer } from 'node:http';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Entrypoint de contenedor de `web` (Plan.md T-H3-01).
 *
 * La aplicación Next.js del alumno y las consolas externas son de F8 (UI/UX
 * conformada). Aquí solo vive lo que H3 exige: arranque desde cero, healthcheck
 * y logs estructurados. El cliente **no porta credenciales** (P-II §11.1), así
 * que este proceso no recibe ningún secreto por entorno.
 */

const SERVICE = 'web';
const PORT = Number(process.env.PORT ?? 3000);
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
  res.writeHead(501, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('NO_IMPLEMENTADO: la interfaz del alumno se implementa en F8.\n');
});

server.listen(PORT, () => log('listening', { port: PORT }));

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    log('shutdown', { signal });
    server.close(() => process.exit(0));
  });
}
