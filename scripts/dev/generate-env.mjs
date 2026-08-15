/**
 * Genera `infra/compose/.env` con secretos aleatorios (Plan.md T-H3-02).
 *
 * Local-first y de un solo uso: estos valores sirven para levantar L0 en la PC
 * del propietario. **No se versionan** (`.env` está en `.gitignore`) y no son
 * los secretos de una corrida real: cuando Infisical esté inicializado, los
 * servicios leen de ahí (T-H3-04).
 *
 * No sobreescribe un `.env` existente: perder la contraseña de una base con
 * datos dentro es un incidente, no una molestia.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const COMPOSE_DIR = resolve(here, '..', '..', 'infra', 'compose');
const TEMPLATE = join(COMPOSE_DIR, '.env.example');
const TARGET = join(COMPOSE_DIR, '.env');

if (existsSync(TARGET)) {
  console.error(`${TARGET} ya existe; no se sobreescribe. Bórralo a mano si de verdad quieres regenerarlo.`);
  process.exit(2);
}

/** Contraseña sin comillas ni caracteres que compliquen URL ni SQL. */
const secret = (bytes = 24) => randomBytes(bytes).toString('base64url');

const VALUES = {
  POSTGRES_PASSWORD: secret(),
  SVC_API_PASSWORD: secret(),
  SVC_SESSION_PASSWORD: secret(),
  SVC_VERIFIER_PASSWORD: secret(),
  SVC_AUTHORING_PASSWORD: secret(),
  SVC_MEASUREMENT_PASSWORD: secret(),
  SVC_BACKGROUND_PASSWORD: secret(),
  SVC_AUDIT_PASSWORD: secret(),
  // Infisical fija estos formatos: 16 bytes en hex y 32 bytes en base64.
  INFISICAL_ENCRYPTION_KEY: randomBytes(16).toString('hex'),
  INFISICAL_AUTH_SECRET: randomBytes(32).toString('base64'),
};

const filled = readFileSync(TEMPLATE, 'utf8')
  .split('\n')
  .map((linea) => {
    const match = /^([A-Z_]+)=$/.exec(linea.trim());
    const key = match?.[1];
    return key && key in VALUES ? `${key}=${VALUES[key]}` : linea;
  })
  .join('\n');

const pending = filled
  .split('\n')
  .filter((l) => /^[A-Z_]+=$/.test(l.trim()))
  .map((l) => l.split('=')[0]);

writeFileSync(TARGET, filled);

console.log(`escrito ${TARGET} con ${Object.keys(VALUES).length} secretos generados.`);
if (pending.length > 0) {
  console.log(`quedan sin valor (rellénalos a mano): ${pending.join(', ')}`);
}
console.log('recuerda: este archivo no se versiona y no sustituye a Infisical.');
