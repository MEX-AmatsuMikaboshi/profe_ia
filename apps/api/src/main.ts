import { createServer, type IncomingMessage } from 'node:http';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

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
    void (async () => {
      let response;
      try {
        const raw = await readBody(req);
        response = await handleVerdictRequest(
          { paths: SPOOL_PATHS, timing: SPOOL_TIMING },
          JSON.parse(raw),
        );
      } catch (err) {
        response = {
          status: 400 as const,
          body: { code: 'SOLICITUD_INVALIDA' as const, detail: String(err) },
        };
      }
      log('verdict_request', { status: response.status });
      res.writeHead(response.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(response.body));
    })();
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
