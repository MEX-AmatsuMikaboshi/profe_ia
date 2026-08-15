/**
 * Envoltorio de `docker compose` para el entorno local (Plan.md T-H3-02).
 *
 * Subcomandos: `up`, `down`, `seed`, `backup`, `restore`, `status`, `logs`.
 *
 * Resuelve por su cuenta la trampa nº 1 del entorno: una consola abierta antes
 * de instalar Docker no tiene `resources\bin` en el `PATH` y todo falla con
 * `spawn docker ENOENT`. En vez de documentarlo y esperar que se lea, se
 * antepone la ruta conocida cuando existe.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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
  console.error(
    `falta ${ENV_FILE}.\n` +
      'Cópialo de `.env.example` y genera los secretos con `pnpm run dev:env`.\n' +
      'Ningún servicio arranca con secretos por omisión: un secreto compartido no es un secreto.',
  );
  process.exit(2);
}

const compose = (args, opts = {}) => {
  const full = ['compose', '-f', COMPOSE_FILE, '--env-file', ENV_FILE, ...args];
  const result = spawnSync('docker', full, { stdio: 'inherit', ...opts });
  if (result.error) {
    console.error(`no se pudo ejecutar docker: ${result.error.message}`);
    process.exit(2);
  }
  return result.status ?? 0;
};

const [subcommand, ...rest] = process.argv.slice(2);

const COMMANDS = {
  up: () => compose(['up', '-d', '--build', '--wait', ...rest]),
  down: () => compose(['down', ...rest]),
  status: () => compose(['ps']),
  logs: () => compose(['logs', '--tail', '100', ...rest]),
  seed: () => compose(['--profile', 'tools', 'run', '--rm', 'migrator']),
  backup: () => compose(['--profile', 'tools', 'run', '--rm', 'backup']),
  restore: () => compose(['--profile', 'tools', 'run', '--rm', 'restore']),
};

const run = COMMANDS[subcommand];
if (!run) {
  console.error(`uso: node scripts/dev/compose.mjs <${Object.keys(COMMANDS).join('|')}>`);
  process.exit(2);
}

process.exit(run());
