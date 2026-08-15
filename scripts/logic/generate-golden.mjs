/**
 * Genera el conjunto dorado del núcleo lógico (Plan.md T-H2-10 ← P-III §7.1).
 *
 * Principio: las expectativas se declaran **a priori** por construcción o por
 * tipo de mutación, y el generador **falla** si el verificador no las cumple.
 * Nunca se graba la salida observada como si fuera la expectativa: eso
 * convertiría el conjunto dorado en un espejo del bug.
 *
 * Requiere `pnpm run ci:build`.
 * Uso: node scripts/logic/generate-golden.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, 'content', 'unidad-deduccion-natural', 'golden-tests');
const CORE = join(ROOT, 'packages', 'logic-core', 'dist', 'index.js');

const { constructProof, verify } = await import(pathToFileURL(CORE).href);

const SEED_BASE = 20260814;
const problems = [];

/** Comprueba la expectativa declarada; acumula el fallo en vez de ocultarlo. */
function check(id, proof, expected) {
  const result = verify(proof);
  if (expected.valid !== result.valid) {
    problems.push(`${id}: se esperaba valid=${expected.valid} y el verificador dio ${result.valid}`);
    return null;
  }
  if (expected.codes) {
    const got = result.errors.map((e) => e.code);
    const missing = expected.codes.filter((c) => !got.includes(c));
    if (missing.length > 0) {
      problems.push(`${id}: faltan códigos ${missing.join(', ')}; obtenidos: ${got.join(', ') || '—'}`);
      return null;
    }
  }
  return { id, proof, expected };
}

// ─── 1. Válidas por construcción ────────────────────────────────────────────
const valid = [];
for (let i = 0; i < 130 && valid.length < 120; i += 1) {
  const seed = SEED_BASE + i;
  const built = constructProof(seed, 3 + (i % 6));
  const proof = { lines: built.lines, goal: built.goal };
  const kept = check(`valid-${String(i + 1).padStart(4, '0')}`, proof, {
    valid: true,
    goalReached: true,
  });
  if (kept) valid.push({ ...kept, seed, rulesUsed: built.rulesUsed });
}

// ─── 2. Inválidas por mutación tipada ───────────────────────────────────────
/** Cada mutación declara el código que **debe** producirse. */
const MUTATIONS = [
  {
    name: 'regla-prohibida',
    code: 'E-RULE-FORBIDDEN',
    apply: (line) => ({ ...line, rule: 'DS' }),
  },
  {
    name: 'regla-desconocida',
    code: 'E-RULE-UNKNOWN',
    apply: (line) => ({ ...line, rule: 'Teorema' }),
  },
  {
    name: 'aridad-sobrante',
    code: 'E-RULE-ARITY',
    // Solo en profundidad 0 y citando la primera premisa: así la cita extra es
    // siempre accesible y el único defecto posible es la aridad.
    canApply: (line) => line.depth === 0,
    apply: (line) => ({ ...line, refs: [...(line.refs ?? []), 1, 1] }),
  },
  {
    name: 'cita-hacia-adelante',
    code: 'E-REF-FORWARD',
    apply: (line, lineNumber) => ({ ...line, refs: [lineNumber] }),
  },
  {
    name: 'sintaxis-rota',
    code: 'E-SYN-PARSE',
    // Corchete sin cerrar: error de análisis, no de precedencia.
    apply: (line) => ({ ...line, formula: `(${line.formula}` }),
  },
  {
    name: 'sin-corchetes',
    code: 'E-SYN-PRECEDENCE',
    apply: (line) => ({ ...line, formula: 'A∧B∧C' }),
  },
  {
    name: 'alias-rechazado',
    code: 'E-SYN-ALIAS',
    apply: (line) => ({ ...line, formula: 'A and B' }),
  },
  {
    name: 'simbolo-no-autorizado',
    code: 'E-SYN-SYMBOL',
    apply: (line) => ({ ...line, formula: 'a∧b' }),
  },
];

const invalid = [];
let mutationIndex = 0;
for (let i = 0; i < 200 && invalid.length < 120; i += 1) {
  const seed = SEED_BASE + 1000 + i;
  const built = constructProof(seed, 4);
  const derived = built.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.rule !== 'PR' && line.rule !== 'AS');
  if (derived.length === 0) continue;

  const mutation = MUTATIONS[mutationIndex % MUTATIONS.length];
  mutationIndex += 1;

  const applicable = derived.filter(({ line }) => (mutation.canApply ? mutation.canApply(line) : true));
  if (applicable.length === 0) continue;
  const target = applicable[i % applicable.length];

  const lines = built.lines.map((line, index) =>
    index === target.index ? mutation.apply(line, index + 1) : line,
  );
  const id = `invalid-${String(invalid.length + 1).padStart(4, '0')}-${mutation.name}`;
  const kept = check(id, { lines }, { valid: false, codes: [mutation.code] });
  if (kept) invalid.push({ ...kept, seed, mutation: mutation.name });
}

// ─── 3. Alcance y subpruebas (autoría manual) ───────────────────────────────
const L = (formula, rule, refs, depth = 0) => ({
  formula,
  rule,
  ...(refs ? { refs } : {}),
  depth,
});

const scopeTemplates = (a, b, c) => [
  {
    name: 'descarga-correcta',
    proof: {
      lines: [L(a, 'PR'), L(a, 'AS', undefined, 1), L(a, 'R', [2], 1), L(`${a}→${a}`, '→I', [[2, 3]])],
    },
    expected: { valid: true },
  },
  {
    name: 'cita-a-subprueba-cerrada',
    proof: {
      lines: [
        L(a, 'PR'),
        L(b, 'AS', undefined, 1),
        L(b, 'R', [2], 1),
        L(`${b}→${b}`, '→I', [[2, 3]]),
        L(b, 'R', [3]),
      ],
    },
    expected: { valid: false, codes: ['E-REF-CLOSED'] },
  },
  {
    name: 'subproof-incompleta',
    proof: {
      lines: [
        L(a, 'PR'),
        L(b, 'AS', undefined, 1),
        L(c, 'AS', undefined, 2),
        L(c, 'R', [3], 2),
        L(`${c}→${c}`, '→I', [[3, 4]], 1),
        L(`${b}→(${c}→${c})`, '→I', [[2, 4]]),
      ],
    },
    expected: { valid: false, codes: ['E-REF-SUBPROOF-INCOMPLETE'] },
  },
  {
    name: 'subproof-anidada-cerrada',
    proof: {
      lines: [
        L(a, 'PR'),
        L(b, 'AS', undefined, 1),
        L(c, 'AS', undefined, 2),
        L(c, 'R', [3], 2),
        L(`${c}→${c}`, '→I', [[3, 4]], 1),
        L(`${b}→(${c}→${c})`, '→I', [[2, 5]]),
        L(`${c}→${c}`, '→I', [[3, 4]]),
      ],
    },
    expected: { valid: false, codes: ['E-REF-SUBPROOF-NESTED-CLOSED'] },
  },
  {
    name: 'supuesto-abierto-al-final',
    proof: {
      lines: [L(a, 'PR'), L(b, 'AS', undefined, 1), L(b, 'R', [2], 1)],
    },
    expected: { valid: false, codes: ['E-STRUCT-OPEN-ASSUMPTION', 'E-STRUCT-CONCLUSION-DEPTH'] },
  },
  {
    name: 'as-fuera-de-subprueba',
    proof: { lines: [L(a, 'PR'), L(b, 'AS')] },
    expected: { valid: false, codes: ['E-STRUCT-AS-POSITION'] },
  },
  {
    name: 'premisa-tardia',
    proof: { lines: [L(a, 'PR'), L(a, 'R', [1]), L(b, 'PR')] },
    expected: { valid: false, codes: ['E-STRUCT-PR-POSITION'] },
  },
  {
    name: 'subprueba-de-una-linea',
    proof: {
      lines: [L(a, 'PR'), L(b, 'AS', undefined, 1), L(`${b}→${b}`, '→I', [[2, 2]])],
    },
    expected: { valid: true },
  },
  {
    name: 'descarga-vacua',
    proof: {
      lines: [
        L(a, 'PR'),
        L(b, 'AS', undefined, 1),
        L(a, 'R', [1], 1),
        L(`${b}→${a}`, '→I', [[2, 3]]),
      ],
    },
    expected: { valid: true },
  },
];

const ATOM_TRIPLES = [
  ['A', 'B', 'C'],
  ['B', 'C', 'D'],
  ['C', 'D', 'E'],
  ['D', 'E', 'A'],
  ['E', 'A', 'B'],
  ['A', 'C', 'E'],
  ['B', 'D', 'A'],
];

const scope = [];
for (const [a, b, c] of ATOM_TRIPLES) {
  for (const template of scopeTemplates(a, b, c)) {
    const id = `scope-${String(scope.length + 1).padStart(4, '0')}-${template.name}`;
    const kept = check(id, template.proof, template.expected);
    if (kept) scope.push(kept);
  }
}

// ─── 4. Variantes equivalentes (misma conclusión, estructura distinta) ──────
const variants = [];
for (const [a, b] of [
  ['A', 'B'],
  ['B', 'C'],
  ['C', 'D'],
  ['D', 'E'],
  ['E', 'A'],
  ['A', 'C'],
  ['B', 'D'],
  ['C', 'E'],
  ['D', 'A'],
  ['E', 'B'],
]) {
  const conclusion = `${b}∧${a}`;
  const routes = [
    {
      name: 'extraer-y-reconjuntar',
      lines: [
        L(`${a}∧${b}`, 'PR'),
        L(a, '∧E', [1]),
        L(b, '∧E', [1]),
        L(conclusion, '∧I', [3, 2]),
      ],
    },
    {
      name: 'orden-inverso-de-extraccion',
      lines: [
        L(`${a}∧${b}`, 'PR'),
        L(b, '∧E', [1]),
        L(a, '∧E', [1]),
        L(conclusion, '∧I', [2, 3]),
      ],
    },
    {
      name: 'con-reiteracion-intermedia',
      lines: [
        L(`${a}∧${b}`, 'PR'),
        L(`${a}∧${b}`, 'R', [1]),
        L(b, '∧E', [2]),
        L(a, '∧E', [2]),
        L(conclusion, '∧I', [3, 4]),
      ],
    },
    {
      name: 'citando-la-premisa-original',
      lines: [
        L(`${a}∧${b}`, 'PR'),
        L(`${a}∧${b}`, 'R', [1]),
        L(b, '∧E', [1]),
        L(a, '∧E', [2]),
        L(conclusion, '∧I', [3, 4]),
      ],
    },
    {
      name: 'via-subprueba-condicional',
      lines: [
        L(`${a}∧${b}`, 'PR'),
        L(`${a}∧${b}`, 'AS', undefined, 1),
        L(b, '∧E', [2], 1),
        L(a, '∧E', [2], 1),
        L(conclusion, '∧I', [3, 4], 1),
        L(`(${a}∧${b})→(${b}∧${a})`, '→I', [[2, 5]]),
        L(conclusion, '→E', [6, 1]),
      ],
    },
  ];

  for (const route of routes) {
    const id = `variant-${String(variants.length + 1).padStart(4, '0')}-${route.name}`;
    const kept = check(id, { lines: route.lines, goal: conclusion }, { valid: true, goalReached: true });
    if (kept) variants.push({ ...kept, equivalenceClass: `${a}∧${b}⊢${conclusion}` });
  }
}

// ─── 5. Casos límite ────────────────────────────────────────────────────────
const edgeTemplates = (a, b) => [
  {
    name: 'falsum-como-premisa-prohibido',
    proof: { lines: [L('⊥', 'PR'), L(a, 'X', [1])] },
    expected: { valid: false, codes: ['E-STRUCT-PR-POSITION'] },
  },
  {
    name: 'falsum-como-supuesto-prohibido',
    proof: { lines: [L(a, 'PR'), L('⊥', 'AS', undefined, 1), L(a, 'R', [1], 1)] },
    expected: { valid: false, codes: ['E-STRUCT-AS-POSITION'] },
  },
  {
    name: 'dne-triple-negacion',
    proof: { lines: [L(`¬¬¬${a}`, 'PR'), L(a, 'DNE', [1])] },
    expected: { valid: false, codes: ['E-RULE-SHAPE'] },
  },
  {
    name: 'dne-doble-negacion',
    proof: { lines: [L(`¬¬${a}`, 'PR'), L(a, 'DNE', [1])] },
    expected: { valid: true },
  },
  {
    name: 'explosion-desde-contradiccion',
    proof: {
      lines: [L(a, 'PR'), L(`¬${a}`, 'PR'), L('⊥', '¬E', [1, 2]), L(`${b}∨¬${b}`, 'X', [3])],
    },
    expected: { valid: true },
  },
  {
    name: 'alias-de-regla-no-aparece-en-traza',
    proof: { lines: [L(`${a}→${b}`, 'PR'), L(a, 'PR'), L(b, 'MP', [1, 2])] },
    expected: { valid: true },
  },
  {
    name: 'glyphs-de-corchete-equivalentes',
    proof: { lines: [L(`[${a}∧${b}]`, 'PR'), L(a, '∧E', [1])] },
    expected: { valid: true },
  },
  {
    name: 'asociatividad-no-es-normalizacion',
    proof: { lines: [L(`(${a}∧${b})∧${a}`, 'PR'), L(`${a}∧(${b}∧${a})`, '∧E', [1])] },
    expected: { valid: false, codes: ['E-RULE-SHAPE'] },
  },
  {
    name: 'conmutatividad-no-es-normalizacion',
    proof: { lines: [L(`${a}∧${b}`, 'PR'), L(`${b}∧${a}`, 'R', [1])] },
    expected: { valid: false, codes: ['E-RULE-SHAPE'] },
  },
  {
    name: 'cita-a-linea-inexistente',
    proof: { lines: [L(a, 'PR'), L(a, 'R', [9])] },
    expected: { valid: false, codes: ['E-SYN-PARSE'] },
  },
];

const edge = [];
for (const [a, b] of [
  ['A', 'B'],
  ['B', 'C'],
  ['C', 'D'],
  ['D', 'E'],
  ['E', 'A'],
  ['A', 'D'],
]) {
  for (const template of edgeTemplates(a, b)) {
    const id = `edge-${String(edge.length + 1).padStart(4, '0')}-${template.name}`;
    const kept = check(id, template.proof, template.expected);
    if (kept) edge.push(kept);
  }
}

// ─── Escritura ──────────────────────────────────────────────────────────────
if (problems.length > 0) {
  console.error('El verificador no cumple expectativas declaradas a priori:\n');
  for (const p of problems.slice(0, 20)) console.error('  - ' + p);
  if (problems.length > 20) console.error(`  … y ${problems.length - 20} más`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

const files = [
  ['valid.json', valid, 'Derivaciones válidas generadas por construcción con reglas autorizadas'],
  ['invalid.json', invalid, 'Derivaciones inválidas por mutación tipada, con el código esperado'],
  ['scope.json', scope, 'Alcance, citas y descarga de supuestos'],
  ['variants.json', variants, 'Variantes estructuralmente distintas de la misma conclusión'],
  ['edge-cases.json', edge, 'Casos límite del cálculo y de la política de Etapa 1'],
];

for (const [file, cases, description] of files) {
  writeFileSync(
    join(OUT_DIR, file),
    JSON.stringify(
      {
        version: '1',
        description,
        generator: 'scripts/logic/generate-golden.mjs',
        seedBase: SEED_BASE,
        authorizedCalculusVersion: 'authorized-calculus-v1',
        count: cases.length,
        cases,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
  console.log(`${file}: ${cases.length} casos`);
}
