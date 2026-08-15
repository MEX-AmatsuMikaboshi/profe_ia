/**
 * `ci:infra:compose-up` — arranque limpio del entorno local con sus
 * comprobaciones (Plan.md T-H3-01, T-H3-04; AC del gate H3).
 *
 * Tres cosas que no se comprueban leyendo el YAML:
 *
 *  1. **Arranca de verdad**, y todos los servicios permanentes llegan a
 *     `healthy` sin intervención.
 *  2. **El verificador aislado verifica**: se deposita una derivación en el
 *     spool y sale el veredicto. Sin esto, «el contenedor está sano» solo
 *     significa que un proceso escribe un latido.
 *  3. **El egress está cortado donde debe**: un servicio de la red `core`
 *     intenta salir a Internet y no puede.
 *
 * Con `--clean` destruye los volúmenes antes de arrancar («desde cero» del AC).
 * Sin la bandera respeta los datos locales: borrar la base del propietario por
 * omisión sería un incidente, no una prueba.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '..', '..');
const COMPOSE_FILE = join(REPO, 'infra', 'compose', 'docker-compose.yml');
const ENV_FILE = join(REPO, 'infra', 'compose', '.env');

const DOCKER_BIN_WINDOWS = 'C:\\Program Files\\Docker\\Docker\\resources\\bin';
if (process.platform === 'win32' && existsSync(DOCKER_BIN_WINDOWS)) {
  process.env.PATH = `${DOCKER_BIN_WINDOWS};${process.env.PATH ?? ''}`;
}

if (!existsSync(ENV_FILE)) {
  console.error('falta `infra/compose/.env`; créalo con `pnpm run dev:env`.');
  process.exit(2);
}

const PERMANENT = [
  'postgres',
  'redis',
  'infisical',
  'otel-collector',
  'web',
  'api',
  'verifier',
  'authoring-worker',
  'measurement-worker',
  'background-worker',
];

const failures = [];
const check = (ok, message) => {
  console.log(`${ok ? 'ok' : 'FALLO'}: ${message}`);
  if (!ok) failures.push(message);
};

const docker = (args, opts = {}) =>
  spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...opts });

const compose = (args, opts = {}) =>
  docker(['compose', '-f', COMPOSE_FILE, '--env-file', ENV_FILE, ...args], opts);

const sleep = (ms) => delay(ms);

if (process.argv.includes('--clean')) {
  console.log('# limpiando volúmenes (arranque desde cero)');
  compose(['down', '-v', '--remove-orphans'], { stdio: 'inherit' });
}

console.log('# levantando el entorno (build incluido; la primera vez tarda)');
const up = compose(['up', '-d', '--build', '--wait', '--wait-timeout', '600'], { stdio: 'inherit' });
check(up.status === 0, 'el entorno levanta y todos los servicios llegan a healthy');

// 1. Estado y salud servicio a servicio, por si `--wait` se conformó con menos.
const ps = compose(['ps', '--format', 'json']);
const rows = ps.stdout
  .split('\n')
  .filter((l) => l.trim().length > 0)
  .map((l) => JSON.parse(l));

for (const service of PERMANENT) {
  const row = rows.find((r) => r.Service === service);
  check(row !== undefined, `${service}: existe el contenedor`);
  if (!row) continue;
  check(row.State === 'running', `${service}: en ejecución (${row.State})`);
  // `otel-collector` no declara healthcheck propio en la imagen; basta running.
  if (row.Health) check(row.Health === 'healthy', `${service}: healthy (${row.Health})`);
}

// 2. El verificador aislado hace su trabajo: entra derivación, sale veredicto.
const NOMBRE = 'compose-up-check.json';
const DERIVACION = JSON.stringify({
  lines: [
    { formula: 'A∧B', rule: 'PR', depth: 0 },
    { formula: 'B', rule: '∧E', refs: [1], depth: 0 },
  ],
  goal: 'B',
});

const escrito = compose([
  'exec',
  '-T',
  'api',
  'node',
  '-e',
  `require('node:fs').writeFileSync('/spool/in/${NOMBRE}', process.argv[1])`,
  DERIVACION,
]);
check(escrito.status === 0, 'se deposita una derivación en el spool');

let veredicto = null;
for (let intento = 0; intento < 30 && veredicto === null; intento += 1) {
  await sleep(1000);
  const leido = compose([
    'exec',
    '-T',
    'api',
    'node',
    '-e',
    `const fs=require('node:fs');const p='/spool/out/${NOMBRE}';if(fs.existsSync(p))process.stdout.write(fs.readFileSync(p,'utf8'))`,
  ]);
  if (leido.status === 0 && leido.stdout.trim().length > 0) veredicto = JSON.parse(leido.stdout);
}

check(veredicto !== null, 'el verificador aislado produce veredicto por el spool');
check(veredicto?.valid === true, `el veredicto es válido (valid=${veredicto?.valid})`);
check(veredicto?.goalReached === true, `alcanza la meta (goalReached=${veredicto?.goalReached})`);

// 3. Egress cortado en `core`: el intento de salir falla.
const salida = compose([
  'exec',
  '-T',
  'background-worker',
  'node',
  '-e',
  "fetch('https://example.com',{signal:AbortSignal.timeout(5000)}).then(()=>{console.log('ALCANZADO');process.exit(0)}).catch(()=>{console.log('BLOQUEADO');process.exit(0)})",
]);
check(
  salida.stdout.includes('BLOQUEADO'),
  `background-worker no sale a Internet (${salida.stdout.trim() || 'sin salida'})`,
);

// 4. El verificador no tiene ninguna interfaz de red.
const idVerifier = compose(['ps', '-q', 'verifier']).stdout.trim();
if (idVerifier) {
  const redes = docker([
    'inspect',
    '-f',
    '{{json .NetworkSettings.Networks}}',
    idVerifier,
  ]).stdout.trim();
  check(
    redes === '{}' || redes === 'null' || redes.includes('"none"'),
    `verifier sin redes conectadas (${redes})`,
  );
}

if (failures.length > 0) {
  console.error(`\n${failures.length} comprobación(es) fallida(s) en el arranque local.`);
  process.exit(1);
}
console.log('\nEntorno local en verde: arranque, verificación aislada y egress.');
