// Control positivo de `check-status.mjs` (D-81).
//
// Sigue el patrón de `verify-depcruise-catches.mjs` y
// `verify-test-typecheck-catches.mjs`: una comprobación que nunca ha visto un
// fallo no es evidencia de nada. Aquí se siembran los cuatro defectos que el
// comprobador dice detectar, uno por uno, y se exige que **falle** en cada uno.
//
// Se trabaja siempre sobre un árbol de juguete en un directorio temporal: un
// control positivo que mutara el `PLAN_STATUS.md` real dejaría el repositorio
// sucio el día que se interrumpa a mitad.
//
//   node scripts/plan/verify-check-status-catches.mjs

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const COMPROBADOR = join(AQUI, 'check-status.mjs');

/** Documento sano mínimo: dos tareas, tres decisiones, una cita resuelta. */
function documentoSano() {
  return [
    '# PLAN_STATUS.md — fuente de verdad de avance',
    '',
    'Estados: `PENDIENTE → EN_CURSO → HECHA → VERIFICADA` o `BLOQUEADA(razón)` / `BLOCKED_BY_SPEC`.',
    '',
    '| Tarea | Etiqueta | Estado | Evidencia | Fecha | Notas |',
    '|---|---|---|---|---|---|',
    '| T-H0-01 | REQUIRED | HECHA | `x` | 2026-08-26 | nada |',
    '| T-H0-02 | CRITICAL | VERIFICADA (run 1) | `y` | 2026-08-26 | nada |',
    '',
    '## Decisiones de ingeniería',
    '',
    '- **D-1 — Primera.** Texto.',
    '- **D-2 — Segunda.** Texto.',
    '- **D-3 — Tercera.** Texto.',
    '',
  ].join('\n');
}

function arbol(status, extra = '') {
  const raiz = mkdtempSync(join(tmpdir(), 'plan-status-'));
  mkdirSync(join(raiz, 'docs', 'plan'), { recursive: true });
  writeFileSync(join(raiz, 'docs', 'plan', 'PLAN_STATUS.md'), status, 'utf8');
  // Un archivo de código que cita una decisión, para ejercitar la regla 4.
  writeFileSync(join(raiz, 'fuente.ts'), `// Ver D-2.\n${extra}\n`, 'utf8');
  return raiz;
}

function correr(raiz) {
  const r = spawnSync(process.execPath, [COMPROBADOR, '--root', raiz], { encoding: 'utf8' });
  return { code: r.status, salida: `${r.stdout}${r.stderr}` };
}

const casos = [
  {
    nombre: 'árbol sano (control negativo)',
    raiz: () => arbol(documentoSano()),
    esperaFallo: false,
    contiene: 'coherente',
  },
  {
    nombre: 'estado no declarado',
    raiz: () => arbol(documentoSano().replace('| REQUIRED | HECHA |', '| REQUIRED | CASI |')),
    esperaFallo: true,
    contiene: 'no empieza por un estado declarado',
  },
  {
    nombre: 'decisión duplicada',
    raiz: () => arbol(documentoSano().replace('- **D-3 —', '- **D-2 —')),
    esperaFallo: true,
    contiene: 'declarada 2 veces',
  },
  {
    nombre: 'hueco en la numeración',
    raiz: () => arbol(documentoSano().replace('- **D-2 — Segunda.** Texto.\n', '')),
    esperaFallo: true,
    contiene: 'hueco',
  },
  {
    nombre: 'cita colgada',
    raiz: () => arbol(documentoSano(), '// Y también D-77, que aquí no existe.'),
    esperaFallo: true,
    contiene: 'no está declarada',
  },
];

let malos = 0;
for (const caso of casos) {
  const raiz = caso.raiz();
  try {
    const { code, salida } = correr(raiz);
    const fallo = code !== 0;
    const bien = fallo === caso.esperaFallo && salida.includes(caso.contiene);
    if (bien) {
      console.log(`ok: ${caso.nombre}`);
    } else {
      malos += 1;
      console.error(
        `FALLO: ${caso.nombre} — se esperaba ${caso.esperaFallo ? 'exit≠0' : 'exit 0'} y ` +
          `«${caso.contiene}»; se obtuvo exit ${String(code)}:\n${salida.trim()}`,
      );
    }
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
}

if (malos > 0) {
  console.error(`\n${String(malos)} comprobación(es) del comprobador no detectan lo que dicen.`);
  process.exit(1);
}
console.log(`\nok: check-status.mjs detecta los ${String(casos.length - 1)} defectos sembrados`);
