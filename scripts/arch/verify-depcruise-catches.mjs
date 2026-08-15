/**
 * AC de F0: «depcruise falla ante una importación prohibida sembrada de prueba
 * y pasa al retirarla».
 *
 * Siembra una violación real por cada regla crítica, comprueba que
 * dependency-cruiser la detecta, y la retira siempre (finally).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = process.cwd();

/** Cada sonda: archivo sembrado + regla que debe dispararse. */
const PROBES = [
  {
    file: 'packages/logic-core/src/__arch_probe__.ts',
    rule: 'verificacion-sin-canonicalizador-de-isomorfismo',
    code: `import { PACKAGE_NAME } from '@profesor-ia/isomorphism-canonicalizer';\nexport const probe = PACKAGE_NAME;\n`,
  },
  {
    file: 'packages/visual-interaction/src/__arch_probe__.ts',
    rule: 'visual-sin-veredicto-formal',
    code: `import { PACKAGE_NAME } from '@profesor-ia/logic-core';\nexport const probe = PACKAGE_NAME;\n`,
  },
  {
    file: 'apps/web/src/__arch_probe__.ts',
    rule: 'web-sin-claves-ni-gateway',
    code: `import { PACKAGE_NAME } from '@profesor-ia/model-gateway';\nexport const probe = PACKAGE_NAME;\n`,
  },
];

// Se invoca el entrypoint JS con el propio Node: lanzar un `.cmd` con
// execFile falla en Windows (EINVAL) desde Node 20.
const DEPCRUISE_BIN = join(ROOT, 'node_modules', 'dependency-cruiser', 'bin', 'dependency-cruise.mjs');

function depcruise(targets) {
  try {
    execFileSync(
      process.execPath,
      [DEPCRUISE_BIN, '--config', '.dependency-cruiser.cjs', ...targets],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return { failed: false, output: '' };
  } catch (err) {
    return { failed: true, output: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

let failures = 0;
for (const probe of PROBES) {
  const abs = join(ROOT, probe.file);
  try {
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, probe.code, 'utf8');
    const { failed, output } = depcruise([dirname(probe.file)]);
    if (!failed || !output.includes(probe.rule)) {
      console.error(`FALLO: la regla "${probe.rule}" no detectó la violación sembrada en ${probe.file}`);
      failures += 1;
    } else {
      console.log(`ok: "${probe.rule}" detecta la violación sembrada`);
    }
  } finally {
    rmSync(abs, { force: true });
  }
}

// Retirada la siembra, el árbol debe quedar limpio.
const clean = depcruise(['apps', 'packages', 'tools']);
if (clean.failed) {
  console.error('FALLO: el árbol sin siembra no pasa depcruise:\n' + clean.output);
  failures += 1;
} else {
  console.log('ok: árbol limpio sin violaciones');
}

process.exit(failures === 0 ? 0 : 1);
