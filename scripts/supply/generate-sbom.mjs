/**
 * `ci:supply:sbom` (Plan.md T-H0-06 ← DEC-DEPENDENCY-FREEZE-001, EXT-01).
 *
 * La autoridad reproducible de cada freeze es `lockfile + SBOM + digests` (§3).
 * Este script produce un SBOM CycloneDX 1.6 desde el árbol **instalado** (no
 * desde los rangos declarados) y valida la política de licencias.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runPnpm } from './pnpm-exec.mjs';

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, 'supply');

/** Licencias permitidas sin revisión (política conservadora del proyecto). */
const ALLOWED_LICENSES = new Set([
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC0-1.0',
  'CC-BY-4.0',
  'ISC',
  'MIT',
  'MIT-0',
  'MPL-2.0',
  'Python-2.0',
  'Unlicense',
  'WTFPL',
]);

/**
 * Excepciones **registradas**, por paquete y licencia exactos.
 *
 * Existe para no resolver una revisión ampliando `ALLOWED_LICENSES`: eso
 * autorizaría de paso cualquier dependencia futura con la misma licencia, sin
 * que nadie la mirase. Aquí la autorización es de este paquete, esta licencia y
 * este motivo, y el script la imprime en cada corrida.
 */
const REGISTERED_LICENSE_EXCEPTIONS = new Map([
  [
    '@fontsource/archivo',
    {
      license: 'OFL-1.1',
      task: 'T-H6-13',
      reason:
        'SIL Open Font License 1.1. Se redistribuye la fuente Archivo sin modificar y embebida ' +
        'en la app, que es el uso que la OFL autoriza expresamente; no se vende por separado ni ' +
        'se renombra (cláusula de Reserved Font Name). Entra para autoalojar la tipografía y ' +
        'retirar el @import a Google Fonts del CSS vendorizado, que rompía local-first ' +
        '(P-II §0.3). La alternativa —descargar el binario a mano— evitaría el aviso dejando la ' +
        'misma obligación sin registrar.',
    },
  ],
]);

function pnpmJson(args) {
  const out = runPnpm(args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out);
}

function collect(node, acc, path = []) {
  for (const [name, info] of Object.entries(node ?? {})) {
    if (!info || typeof info !== 'object') continue;
    const version = info.version ?? 'unknown';
    const key = `${name}@${version}`;
    if (!acc.has(key)) {
      acc.set(key, { name, version, path: [...path, name].join(' > ') });
      collect(info.dependencies, acc, [...path, name]);
    }
  }
}

const trees = pnpmJson(['list', '-r', '--depth', 'Infinity', '--json']);
const components = new Map();
for (const project of trees) {
  collect(project.dependencies, components);
  collect(project.devDependencies, components);
}

// Licencias reales del árbol instalado.
let licensesByPackage = new Map();
try {
  const licenses = pnpmJson(['licenses', 'list', '--json']);
  for (const [license, pkgs] of Object.entries(licenses)) {
    for (const pkg of pkgs) licensesByPackage.set(pkg.name, license);
  }
} catch {
  console.warn('aviso: `pnpm licenses list` no disponible; el SBOM queda sin licencias resueltas');
}

const lockfile = readFileSync(join(ROOT, 'pnpm-lock.yaml'));
const lockDigest = createHash('sha256').update(lockfile).digest('hex');

const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.6',
  version: 1,
  metadata: {
    component: { type: 'application', name: 'profesor-ia', version: '0.0.0' },
    properties: [
      { name: 'profesor-ia:lockfile-sha256', value: lockDigest },
      { name: 'profesor-ia:node-version', value: process.version },
    ],
  },
  components: [...components.values()].map((c) => ({
    type: 'library',
    name: c.name,
    version: c.version,
    purl: `pkg:npm/${encodeURIComponent(c.name)}@${c.version}`,
    licenses: licensesByPackage.has(c.name)
      ? [{ license: { id: licensesByPackage.get(c.name) } }]
      : undefined,
  })),
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'sbom.cdx.json'), JSON.stringify(sbom, null, 2) + '\n', 'utf8');
writeFileSync(join(OUT_DIR, 'lockfile.digest'), lockDigest + '\n', 'utf8');

// Política de licencias: lo no permitido se revisa explícitamente, no se ignora.
const flagged = [];
const appliedExceptions = [];
for (const [name, license] of licensesByPackage) {
  const ids = String(license)
    .split(/\s+(?:OR|AND)\s+|[()]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.some((id) => ALLOWED_LICENSES.has(id))) continue;

  const exception = REGISTERED_LICENSE_EXCEPTIONS.get(name);
  // La excepción vale para **esta** licencia y no para el paquete en general:
  // si mañana relicencia, vuelve a revisión en vez de heredar el permiso.
  if (exception !== undefined && exception.license === String(license)) {
    appliedExceptions.push({ name, ...exception });
    continue;
  }
  flagged.push(`${name}: ${license}`);
}

// Una excepción que ya no corresponde a nada se retira: un registro que
// conserva permisos para dependencias que se fueron acaba autorizando por
// inercia lo que nadie revisó.
const staleExceptions = [...REGISTERED_LICENSE_EXCEPTIONS.keys()].filter(
  (name) => !appliedExceptions.some((applied) => applied.name === name),
);

console.log(`SBOM: ${sbom.components.length} componentes → supply/sbom.cdx.json`);
console.log(`lockfile sha256: ${lockDigest}`);

// Las excepciones se **imprimen siempre**. Una excepción silenciosa es
// indistinguible de una licencia permitida.
for (const applied of appliedExceptions) {
  console.log(
    `excepción de licencia registrada: ${applied.name} (${applied.license}) — ${applied.task}: ${applied.reason}`,
  );
}

if (staleExceptions.length > 0) {
  console.error('\nExcepciones de licencia registradas que ya no aplican; retíralas:');
  for (const name of staleExceptions) console.error(`  - ${name}`);
  process.exit(1);
}

if (flagged.length > 0) {
  console.error('\nLicencias fuera de la política conservadora (requieren revisión registrada):');
  for (const f of flagged) console.error(`  - ${f}`);
  console.error(
    '\nSe registran en REGISTERED_LICENSE_EXCEPTIONS de este script, con tarea y motivo. ' +
      'Ampliar ALLOWED_LICENSES autorizaría de paso cualquier dependencia futura con esa ' +
      'misma licencia, que es justo lo que la revisión evita.',
  );
  process.exit(1);
}
console.log('política de licencias: sin excepciones pendientes');
