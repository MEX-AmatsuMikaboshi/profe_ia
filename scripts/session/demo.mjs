#!/usr/bin/env node
/**
 * Levanta la demo local completa: verificador + api + web (T-H7-01).
 *
 *   pnpm run demo
 *
 * Los tres procesos que hacen falta para ver el bucle W7 de punta a punta, sin
 * Docker y sin base de datos:
 *
 *   - `apps/verifier` — emite el veredicto. Corre **sin red** por diseño (I-3) y
 *     se habla por un spool en disco (D-12); aquí el spool es un directorio
 *     temporal en vez de un volumen de contenedor.
 *   - `apps/api`      — `/clase/turno` (el bucle W7) y `/clase/verificacion`
 *     (el canal al verificador).
 *   - `apps/web`      — la vista de Clase, que reenvía `/clase/*` a la api.
 *
 * **Esto no sustituye a `pnpm run dev:up`.** Aquel levanta el stack real con
 * Postgres, Infisical y el colector; esto levanta lo mínimo para enseñar la
 * sesión funcionando. La diferencia importa: aquí **no se escribe evidencia**,
 * porque no hay base donde escribirla, y decirlo es preferible a que alguien
 * suponga que la cadena de eventos quedó registrada.
 *
 * Requiere `infra/compose/.env` con `MODEL_CREDENTIAL_ANTHROPIC_SESION`. Sin
 * ella la api arranca igual y `/clase/turno` responde 503 diciendo por qué: el
 * resto de la vista sigue funcionando, y un profesor ausente se ve como ausente
 * y no como un profesor mudo.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SPOOL = join(tmpdir(), 'profesor-ia-demo-spool');
const LOGS = join(tmpdir(), 'profesor-ia-demo-logs');

const API_PORT = process.env.DEMO_API_PORT ?? '3011';
const WEB_PORT = process.env.DEMO_WEB_PORT ?? '3010';
const MODEL_ID = process.env.SESSION_MODEL_ID ?? 'claude-sonnet-5';

function cargarEnv() {
  const env = {};
  let texto;
  try {
    texto = readFileSync(join(REPO, 'infra', 'compose', '.env'), 'utf8');
  } catch {
    console.error(
      'aviso: no se pudo leer infra/compose/.env. La vista arranca y el turno\n' +
        '       responderá 503: sin credencial no hay profesor, y se dice.',
    );
    return {};
  }
  for (const linea of texto.split(/\r?\n/)) {
    const limpia = linea.trim();
    if (limpia === '' || limpia.startsWith('#')) continue;
    const corte = limpia.indexOf('=');
    if (corte > 0) env[limpia.slice(0, corte).trim()] = limpia.slice(corte + 1).trim();
  }
  return env;
}

// Spool limpio en cada arranque: un veredicto de una corrida anterior en la
// bandeja de salida se leería como respuesta a un envío de ésta.
rmSync(SPOOL, { recursive: true, force: true });
for (const dir of ['in', 'out', 'failed', 'done']) {
  mkdirSync(join(SPOOL, dir), { recursive: true });
}
mkdirSync(LOGS, { recursive: true });

const envArchivo = cargarEnv();
const credencial = envArchivo['MODEL_CREDENTIAL_ANTHROPIC_SESION'];

const comun = {
  ...process.env,
  SPOOL_IN: join(SPOOL, 'in'),
  SPOOL_OUT: join(SPOOL, 'out'),
  SPOOL_FAILED: join(SPOOL, 'failed'),
  SPOOL_DONE: join(SPOOL, 'done'),
  // El endpoint tiene que estar definido o `startTelemetry()` no deja arrancar
  // (T-H3-05: nada de telemetría apagada en silencio). Sin colector detrás, los
  // envíos fallan en segundo plano y el servicio sigue: es lo correcto aquí,
  // porque la alternativa sería no poder enseñar la sesión sin levantar OTel.
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318',
};

const hijos = [];

function arranca(nombre, comando, args, env, cwd = REPO) {
  const hijo = spawn(comando, args, {
    cwd,
    env: { ...comun, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const prefijo = `[${nombre}]`;
  hijo.stdout.on('data', (b) => escribe(prefijo, b));
  hijo.stderr.on('data', (b) => escribe(prefijo, b));
  hijo.on('exit', (code) => {
    // Un proceso que se cae **para la demo entera**. Seguir con dos de tres
    // dejaría una pantalla que parece viva y falla al primer clic.
    console.error(`${prefijo} terminó con código ${String(code)}. Parando la demo.`);
    apaga(1);
  });
  hijos.push(hijo);
  return hijo;
}

function escribe(prefijo, buffer) {
  for (const linea of String(buffer).split(/\r?\n/)) {
    if (linea.trim() !== '') console.log(`${prefijo} ${linea}`);
  }
}

let apagando = false;
function apaga(code) {
  if (apagando) return;
  apagando = true;
  for (const hijo of hijos) hijo.kill();
  process.exitCode = code;
}

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    console.log('\nparando la demo…');
    apaga(0);
  });
}

console.log('Profesor IA — demo local\n');
console.log(`  spool     ${SPOOL}`);
console.log(`  logs      ${LOGS}`);
console.log(`  modelo    ${MODEL_ID}`);
console.log(
  `  credencial ${credencial === undefined || credencial === '' ? 'AUSENTE (el turno dará 503)' : 'presente'}\n`,
);

arranca('verifier', process.execPath, [join(REPO, 'apps', 'verifier', 'dist', 'main.js')], {
  HEALTH_FILE: join(SPOOL, 'health'),
  LOG_FILE: join(LOGS, 'verifier.log'),
});

arranca('api', process.execPath, [join(REPO, 'apps', 'api', 'dist', 'main.js')], {
  PORT: API_PORT,
  LOG_FILE: join(LOGS, 'api.log'),
  CONTENT_ROOT: join(REPO, 'content', 'unidad-deduccion-natural'),
  SESSION_MODEL_ID: MODEL_ID,
  ...(credencial === undefined ? {} : { MODEL_CREDENTIAL_ANTHROPIC_SESION: credencial }),
});

arranca(
  'web',
  process.execPath,
  [join(REPO, 'apps', 'web', 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', WEB_PORT],
  {
    API_ORIGIN: `http://localhost:${API_PORT}`,
    NEXT_TELEMETRY_DISABLED: '1',
    LOG_FILE: join(LOGS, 'web.log'),
  },
  join(REPO, 'apps', 'web'),
);

console.log(`\n  ▸  http://localhost:${WEB_PORT}/materias/logica/clase\n`);
console.log('  Ctrl+C para parar los tres.\n');
