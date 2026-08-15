/**
 * Arnés de pruebas contra PostgreSQL 17 **real** vía Testcontainers.
 * Un mock no prueba permisos (Plan.md §10).
 *
 * Aplica las migraciones dbmate en orden ejecutando su sección `migrate:up`.
 * `dbmate` sigue siendo la herramienta autoritativa en desarrollo y despliegue;
 * aquí se evita depender de su binario para que la suite corra en cualquier CI.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(here, '..', 'migrations');

export const SERVICE_ROLE_PASSWORD = 'test-only-not-a-secret';

export interface Harness {
  container: StartedPostgreSqlContainer;
  admin: Client;
  /** Conecta como un rol de servicio, con sus privilegios reales. */
  connectAs(role: string): Promise<Client>;
  stop(): Promise<void>;
}

function migrationUpSections(): { file: string; sql: string }[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => {
      const raw = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      const start = raw.indexOf('-- migrate:up');
      if (start === -1) throw new Error(`${file}: falta la marca '-- migrate:up'`);
      const end = raw.indexOf('-- migrate:down');
      const sql = raw.slice(start + '-- migrate:up'.length, end === -1 ? undefined : end);
      return { file, sql };
    });
}

export async function startHarness(): Promise<Harness> {
  const container = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase('profesor_ia_test')
    // El prefijo `pg_` está reservado por PostgreSQL: initdb rechaza el superusuario.
    .withUsername('profesor_admin')
    .withPassword('admin-test')
    .start();

  const admin = new Client({ connectionString: container.getConnectionUri() });
  await admin.connect();

  for (const { file, sql } of migrationUpSections()) {
    try {
      await admin.query(sql);
    } catch (err) {
      throw new Error(`migración ${file} falló: ${(err as Error).message}`);
    }
  }

  // Las contraseñas no viven en las migraciones (nunca se versiona un secreto).
  const roles = await admin.query<{ rolname: string }>(
    "SELECT rolname FROM pg_roles WHERE rolname LIKE 'svc_%'",
  );
  for (const { rolname } of roles.rows) {
    await admin.query(`ALTER ROLE ${rolname} WITH PASSWORD '${SERVICE_ROLE_PASSWORD}'`);
    await admin.query(`GRANT CONNECT ON DATABASE profesor_ia_test TO ${rolname}`);
  }

  const clients: Client[] = [];

  return {
    container,
    admin,
    async connectAs(role: string) {
      const client = new Client({
        host: container.getHost(),
        port: container.getPort(),
        database: container.getDatabase(),
        user: role,
        password: SERVICE_ROLE_PASSWORD,
      });
      await client.connect();
      clients.push(client);
      return client;
    },
    async stop() {
      await Promise.allSettled(clients.map((c) => c.end()));
      await admin.end();
      await container.stop();
    },
  };
}

/** Ejecuta y devuelve el error, o `null` si la operación fue permitida. */
export async function expectDenied(client: Client, sql: string): Promise<string | null> {
  try {
    await client.query(sql);
    return null;
  } catch (err) {
    return (err as Error).message;
  }
}
