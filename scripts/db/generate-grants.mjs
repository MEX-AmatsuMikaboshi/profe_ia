/**
 * Genera la migración de `GRANT` a partir de la matriz de permisos
 * (Plan.md T-H1-02: «matriz mantenida como dato en packages/security-policy y
 * aplicada por migración generada»).
 *
 * Requiere `pnpm run ci:build` previo (lee el paquete compilado).
 * Uso: node scripts/db/generate-grants.mjs [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
// La migración de grants va **después** de toda migración que cree tablas: no se
// puede conceder sobre lo que no existe. Al entrar las tablas de Better Auth
// (`20260815120000_auth.sql`, T-H1-05) esta migración se movió al final.
const OUT = join(ROOT, 'infra', 'database', 'migrations', '20260815120100_grants.sql');
const POLICY = join(ROOT, 'packages', 'security-policy', 'dist', 'index.js');

let policy;
try {
  policy = await import(pathToFileURL(POLICY).href);
} catch (err) {
  console.error(
    'No se pudo cargar @profesor-ia/security-policy compilado. Ejecuta `pnpm run ci:build` primero.\n' +
      String(err),
  );
  process.exit(1);
}

const { PERMISSION_MATRIX, SERVICE_ROLES, SCHEMAS, TABLES, FORBIDDEN_SCHEMA_ACCESS } = policy;

const lines = [];
const w = (s = '') => lines.push(s);

w('-- GENERADO por scripts/db/generate-grants.mjs — NO EDITAR A MANO.');
w('-- Fuente de verdad: packages/security-policy/src/matrix.ts (Plan.md T-H1-02).');
w('-- Regenerar: pnpm run db:grants');
w('--');
w('-- Lo que no aparece como GRANT explícito queda denegado. `ci:db:negative`');
w('-- comprueba ambas mitades contra PostgreSQL real.');
w('');
w('-- migrate:up');
w('');

// 1) Punto de partida limpio: nada concedido.
w('-- Punto de partida: ningún rol runtime tiene nada.');
for (const role of SERVICE_ROLES) {
  w(`REVOKE ALL ON ALL TABLES IN SCHEMA ${SCHEMAS.join(', ')} FROM ${role};`);
  w(`REVOKE ALL ON SCHEMA ${SCHEMAS.join(', ')} FROM ${role};`);
}
w('');

// 2) Concesiones explícitas por rol.
for (const role of SERVICE_ROLES) {
  const entries = PERMISSION_MATRIX[role] ?? [];
  w(`-- ===== ${role} =====`);
  if (entries.length === 0) {
    w(`-- Sin concesiones: ${role} no accede a ningún dato.`);
    w('');
    continue;
  }

  const schemasUsed = [...new Set(entries.map((e) => e.schema))].sort();
  for (const schema of schemasUsed) {
    w(`GRANT USAGE ON SCHEMA ${schema} TO ${role};`);
  }
  for (const entry of entries) {
    const ops = [...entry.operations].join(', ');
    w(`GRANT ${ops} ON ${entry.schema}.${entry.table} TO ${role};`);
  }
  w('');
}

// 3) Aserciones declarativas de las fronteras duras, verificadas en la propia
//    migración: si la matriz se contradice, la migración falla.
w('-- Fronteras duras: la migración falla si la matriz las contradice.');
w('DO $$');
w('DECLARE');
w('  offending text;');
w('BEGIN');
for (const role of SERVICE_ROLES) {
  const forbidden = FORBIDDEN_SCHEMA_ACCESS[role] ?? [];
  for (const schema of forbidden) {
    const granted = (PERMISSION_MATRIX[role] ?? []).filter((e) => e.schema === schema);
    if (granted.length > 0) {
      console.error(
        `La matriz concede a ${role} acceso al esquema prohibido ${schema}: ${granted
          .map((e) => e.table)
          .join(', ')}`,
      );
      process.exit(1);
    }
    w(`  SELECT string_agg(table_name, ', ') INTO offending`);
    w(`    FROM information_schema.table_privileges`);
    w(`   WHERE grantee = '${role}' AND table_schema = '${schema}';`);
    w(`  IF offending IS NOT NULL THEN`);
    w(
      `    RAISE EXCEPTION 'frontera violada: % tiene privilegios en % (%)', '${role}', '${schema}', offending;`,
    );
    w('  END IF;');
  }
}
w('END');
w('$$;');
w('');
w('-- migrate:down');
for (const role of SERVICE_ROLES) {
  w(`REVOKE ALL ON ALL TABLES IN SCHEMA ${SCHEMAS.join(', ')} FROM ${role};`);
  w(`REVOKE ALL ON SCHEMA ${SCHEMAS.join(', ')} FROM ${role};`);
}
w('');

const sql = lines.join('\n');

// Coherencia: toda tabla citada por la matriz debe existir en el inventario.
for (const [role, entries] of Object.entries(PERMISSION_MATRIX)) {
  for (const entry of entries) {
    if (!TABLES[entry.schema]?.includes(entry.table)) {
      console.error(
        `La matriz de ${role} cita ${entry.schema}.${entry.table}, que no está en el inventario TABLES.`,
      );
      process.exit(1);
    }
  }
}

if (process.argv.includes('--check')) {
  const current = readFileSync(OUT, 'utf8');
  if (current !== sql) {
    console.error(
      'DRIFT: 20260814100400_grants.sql no corresponde a la matriz vigente. Ejecuta `pnpm run db:grants`.',
    );
    process.exit(1);
  }
  console.log('ok: la migración de grants corresponde a la matriz');
} else {
  writeFileSync(OUT, sql, 'utf8');
  console.log(`grants generados → ${OUT}`);
}
