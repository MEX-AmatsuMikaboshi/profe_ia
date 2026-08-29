/**
 * AC de F0: «depcruise falla ante una importación prohibida sembrada de prueba
 * y pasa al retirarla».
 *
 * Siembra una violación real por cada regla crítica, comprueba que
 * dependency-cruiser la detecta, y la retira siempre (finally). Desde T-H6-13
 * comprueba además el lado positivo: que las reglas **dejan pasar** lo que
 * deben, porque una regla escrita de más deja el árbol verde por la razón
 * equivocada.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = process.cwd();

/**
 * Retira los restos compilados de una siembra. `tsc` no borra salidas obsoletas,
 * así que un `__arch_probe__.js` de una corrida anterior sobrevive en `dist/` y
 * —desde que `dist` está dentro del grafo (D-25)— aparece como violación real en
 * un árbol que está bien. Se limpia antes y después de sembrar.
 */
function cleanCompiledProbes() {
  for (const group of ['apps', 'packages', 'tools']) {
    const groupDir = join(ROOT, group);
    let entries;
    try {
      entries = readdirSync(groupDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const distDir = join(groupDir, entry.name, 'dist');
      let files;
      try {
        files = readdirSync(distDir);
      } catch {
        continue;
      }
      for (const file of files) {
        if (file.startsWith('__arch_probe')) rmSync(join(distDir, file), { force: true });
      }
    }
  }
}

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
  {
    // T-H6-13: el editor Fitch valida sintaxis en local, pero el veredicto es del
    // servidor. Alcanzar el barrel de `logic-core` le daría `verify()`.
    file: 'apps/web/src/__arch_probe_verifier__.ts',
    rule: 'sin-verificador-fuera-del-verificador',
    code: `import { verify } from '@profesor-ia/logic-core';\nexport const probe = verify;\n`,
  },
  {
    // Y el orquestador tampoco: verificar en línea saltaría el contenedor sin red.
    file: 'apps/api/src/__arch_probe_verifier__.ts',
    rule: 'sin-verificador-fuera-del-verificador',
    code: `import { verify } from '@profesor-ia/logic-core';\nexport const probe = verify;\n`,
  },
  {
    // T-H3-05: el exportador OTLP es un cliente HTTP. En la ruta de verificación
    // rompería I-3, y el verificador ni siquiera tiene red por la que exportar.
    file: 'apps/verifier/src/__arch_probe_otel__.ts',
    rule: 'verificacion-sin-telemetria-de-red',
    code: `import { startTelemetry } from '@profesor-ia/observability';\nexport const probe = startTelemetry;\n`,
  },
  {
    // T-H7-02: el validador de anclaje recibe el cálculo por parámetro. Si la
    // pasarela pudiera importarlo, tendría `verify()` al lado del único punto
    // del repo que abre una conexión a un proveedor.
    file: 'packages/model-gateway/src/__arch_probe_calculo__.ts',
    rule: 'pasarela-sin-nucleo-logico',
    code: `import { verify } from '@profesor-ia/logic-core';
export const probe = verify;
`,
  },
  {
    file: 'packages/logic-core/src/__arch_probe_otel__.ts',
    rule: 'verificacion-sin-telemetria-de-red',
    code: `import { startTelemetry } from '@profesor-ia/observability';\nexport const probe = startTelemetry;\n`,
  },
  {
    // I-2 / DEC-PRIVILEGE-001. Hasta D-82 esta regla no tenia sonda: la que
    // separa la pasarela de las soluciones nunca se habia visto disparar. La
    // ruta no existe en disco a proposito —`solutions-private` no se monta en el
    // contenedor de la pasarela— y no hace falta que exista: la regla mira el
    // especificador.
    file: 'packages/model-gateway/src/__arch_probe_soluciones__.ts',
    rule: 'i2-gateway-sin-soluciones',
    code: `export { solucion } from '../../../content/unidad-deduccion-natural/solutions-private/x.js';`,
  },
  {
    // I-4: aislamiento medicion/ensenanza. Tampoco tenia sonda.
    file: 'packages/authoring-core/src/__arch_probe_sondas__.ts',
    rule: 'i4-autoria-sin-sondas',
    code: `import { PACKAGE_NAME } from '@profesor-ia/measurement-worker';`,
  },
  {
    // I-3 con un modulo del nucleo, que es el caso que la regla si cubria.
    file: 'apps/verifier/src/__arch_probe_red__.ts',
    rule: 'i3-verifier-sin-red',
    code: `import { request } from 'node:https';
export const probe = request;`,
  },
];

/**
 * Controles positivos: importaciones que **deben** seguir permitidas.
 *
 * Sin ellos, una regla escrita de más —prohibir `logic-core` entero— pasaría
 * inadvertida: el árbol quedaría verde simplemente porque nadie importa nada, y
 * la frontera diría lo que no dice. Es el mismo motivo por el que la suite
 * negativa de privilegios lleva pruebas de que cada concesión sí funciona.
 */
const ALLOWED_PROBES = [
  {
    file: 'apps/web/src/__arch_probe_syntax__.ts',
    rule: 'sin-verificador-fuera-del-verificador',
    code: `import { tryParse } from '@profesor-ia/logic-core/syntax';\nexport const probe = tryParse;\n`,
  },
  {
    file: 'apps/api/src/__arch_probe_syntax__.ts',
    rule: 'sin-verificador-fuera-del-verificador',
    code: `import type { ProofInput } from '@profesor-ia/logic-core/syntax';\nexport type Probe = ProofInput;\n`,
  },
  {
    // T-H3-05: la regla prohíbe la telemetría **en la ruta de verificación**, no
    // en todo el repositorio. Sin este control, escribirla de más —prohibirla en
    // `apps/*` entero— dejaría a `apps/api` sin poder instrumentar el canal de
    // veredicto y el árbol seguiría verde, diciendo lo que no dice.
    file: 'apps/api/src/__arch_probe_otel_permitido__.ts',
    rule: 'verificacion-sin-telemetria-de-red',
    code: `import { currentTraceId } from '@profesor-ia/observability';\nexport const probe = currentTraceId;\n`,
  },
];

/**
 * Sondas que necesitan un paquete de npm **instalado y declarado** (D-82).
 *
 * I-1 y la mitad de npm de I-3 no se pueden sembrar con un import a secas: sin
 * el paquete en `node_modules` la importacion no resuelve y quien salta es
 * `sin-dependencias-no-resueltas`, que es otra regla con otro mensaje. Para
 * comprobar que I-1 detecta **lo suyo** hay que reproducir el caso real, que es
 * el unico que ocurriria de verdad: alguien anade el SDK al `package.json` del
 * paquete y lo importa.
 *
 * Asi se descubrio que I-1 no podia disparar nunca (D-82).
 */
const NPM_PROBES = [
  {
    file: 'packages/session-engine/src/__arch_probe_sdk__.ts',
    rule: 'i1-session-engine-sin-sdk-de-proveedor',
    pkg: '@anthropic-ai/sdk',
    manifest: 'packages/session-engine/package.json',
    code: `import Anthropic from '@anthropic-ai/sdk';`,
  },
  {
    file: 'apps/verifier/src/__arch_probe_http_npm__.ts',
    rule: 'i3-verifier-sin-red',
    pkg: 'axios',
    manifest: 'apps/verifier/package.json',
    code: `import axios from 'axios';`,
  },
];

/**
 * Instala un paquete de mentira y lo declara. Devuelve la funcion que deshace
 * las dos cosas; el llamador la invoca en `finally` para que una interrupcion a
 * mitad no deje ni el `node_modules` ni el `package.json` tocados.
 */
function seedNpmPackage(pkg, manifestPath) {
  const pkgDir = join(ROOT, 'node_modules', ...pkg.split('/'));
  const scopeDir = pkg.includes('/') ? join(ROOT, 'node_modules', pkg.split('/')[0]) : pkgDir;
  const manifestAbs = join(ROOT, manifestPath);
  const original = readFileSync(manifestAbs, 'utf8');

  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(
    join(pkgDir, 'package.json'),
    `${JSON.stringify({ name: pkg, version: '0.0.0-arch-probe', main: 'index.js' }, null, 2)}
`,
    'utf8',
  );
  writeFileSync(join(pkgDir, 'index.js'), 'module.exports = {};', 'utf8');

  const manifest = JSON.parse(original);
  manifest.dependencies = { ...manifest.dependencies, [pkg]: '0.0.0-arch-probe' };
  writeFileSync(manifestAbs, `${JSON.stringify(manifest, null, 2)}
`, 'utf8');

  return () => {
    writeFileSync(manifestAbs, original, 'utf8');
    rmSync(scopeDir, { recursive: true, force: true });
  };
}


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
cleanCompiledProbes();
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

for (const probe of NPM_PROBES) {
  const abs = join(ROOT, probe.file);
  let undo = () => {};
  try {
    undo = seedNpmPackage(probe.pkg, probe.manifest);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, probe.code, 'utf8');
    // Alcance completo y no sólo el directorio de la sonda: el destino vive en
    // `node_modules`, en la raíz del repositorio.
    const { failed, output } = depcruise(['apps', 'packages', 'tools']);
    if (!failed || !output.includes(probe.rule)) {
      console.error(
        `FALLO: la regla "${probe.rule}" no detectó ${probe.pkg} importado desde ${probe.file}, ` +
          `con el paquete instalado y declarado. Es el defecto que D-82 corrigió:\n${output}`,
      );
      failures += 1;
    } else {
      console.log(`ok: "${probe.rule}" detecta el paquete npm sembrado (${probe.pkg})`);
    }
  } finally {
    rmSync(abs, { force: true });
    undo();
  }
}

for (const probe of ALLOWED_PROBES) {
  const abs = join(ROOT, probe.file);
  try {
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, probe.code, 'utf8');
    const { failed, output } = depcruise([dirname(probe.file)]);
    if (failed && output.includes(probe.rule)) {
      console.error(
        `FALLO: la regla "${probe.rule}" prohíbe de más — rechazó la importación permitida de ` +
          `${probe.file}:\n${output}`,
      );
      failures += 1;
    } else if (failed) {
      console.error(`FALLO: ${probe.file} no pasa depcruise por otra regla:\n${output}`);
      failures += 1;
    } else {
      console.log(`ok: "${probe.rule}" deja pasar la importación permitida`);
    }
  } finally {
    rmSync(abs, { force: true });
  }
}

// Retirada la siembra, el árbol debe quedar limpio.
cleanCompiledProbes();
const clean = depcruise(['apps', 'packages', 'tools']);
if (clean.failed) {
  console.error('FALLO: el árbol sin siembra no pasa depcruise:\n' + clean.output);
  failures += 1;
} else {
  console.log('ok: árbol limpio sin violaciones');
}

process.exit(failures === 0 ? 0 : 1);
