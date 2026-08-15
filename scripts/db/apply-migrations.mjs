/**
 * Aplica las migraciones dbmate al PostgreSQL del entorno local (Plan.md
 * T-H3-02, `dev:seed`).
 *
 * Corre **dentro** de la red `core`, que no tiene salida a Internet y no
 * publica puertos: la base nunca queda expuesta al host. Se ejecuta con
 * `docker compose --profile tools run --rm migrator`.
 *
 * Reutiliza la misma lectura de secciones `-- migrate:up` que el arnés de
 * pruebas (`infra/database/test/harness.ts`): una sola definición de «qué es
 * una migración aplicada» para la base de pruebas y la de desarrollo.
 *
 * Las contraseñas de los roles **no viven en las migraciones** (nunca se
 * versiona un secreto): entran por entorno y se aplican aquí.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(here, '..', '..', 'infra', 'database', 'migrations');

const SERVICE_ROLES = [
  'svc_api',
  'svc_session',
  'svc_verifier',
  'svc_authoring',
  'svc_measurement',
  'svc_background',
  'svc_audit',
];

const connectionString = process.env.ADMIN_DATABASE_URL;
if (!connectionString) {
  console.error('falta ADMIN_DATABASE_URL: no se adivina la conexión de administración');
  process.exit(2);
}

function migrationUpSections() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => {
      const raw = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      const start = raw.indexOf('-- migrate:up');
      if (start === -1) throw new Error(`${file}: falta la marca '-- migrate:up'`);
      const end = raw.indexOf('-- migrate:down');
      return { file, sql: raw.slice(start + '-- migrate:up'.length, end === -1 ? undefined : end) };
    });
}

const client = new pg.Client({ connectionString });
await client.connect();

try {
  for (const { file, sql } of migrationUpSections()) {
    try {
      await client.query(sql);
      console.log(`ok: ${file}`);
    } catch (err) {
      throw new Error(`migración ${file} falló: ${err.message}`);
    }
  }

  const database = new URL(connectionString).pathname.replace(/^\//, '');
  let missing = 0;
  for (const role of SERVICE_ROLES) {
    const password = process.env[`${role.toUpperCase()}_PASSWORD`];
    if (!password) {
      // Falla ruidoso: un rol sin contraseña no puede conectarse, y descubrirlo
      // en el primer uso real sería peor que descubrirlo aquí.
      console.error(`falta la contraseña de ${role}`);
      missing += 1;
      continue;
    }
    // `ALTER ROLE` no admite parámetros enlazados: la contraseña va como
    // literal, con las comillas simples escapadas.
    await client.query(`ALTER ROLE ${role} WITH PASSWORD '${password.replaceAll("'", "''")}'`);
    await client.query(`GRANT CONNECT ON DATABASE ${database} TO ${role}`);
    console.log(`ok: credencial de ${role}`);
  }
  if (missing > 0) process.exit(3);

  console.log(`\nmigraciones aplicadas y ${SERVICE_ROLES.length} roles con credencial.`);
} finally {
  await client.end();
}
