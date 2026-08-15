import { atom, bin, falsum, not, print, type Formula } from './ast.js';
import type { ProofLineInput, Reference } from './fitch.js';
import type { RuleId } from './calculus.js';

/**
 * Construcción de derivaciones **válidas por construcción** a partir de las
 * reglas autorizadas (Plan.md T-H2-10, T-H2-11 ← P-II §4.6).
 *
 * Esto **no es** el buscador de demostraciones (`proof-search`, T-H2-08): no
 * busca una derivación para una meta dada, sino que encadena hacia adelante
 * aplicaciones legítimas de reglas. Por eso vive en `logic-core` y no rompe la
 * frontera de la ruta de verificación.
 *
 * Determinista por semilla: la misma semilla produce exactamente la misma
 * derivación, condición para que el conjunto dorado sea reproducible.
 */

/** PRNG determinista (mulberry32). Fijar la semilla es parte del contrato. */
function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Incluye deliberadamente `O`, `Y` y `N`: son átomos válidos que colisionan con
 * los alias rechazados en minúscula (`o`, `y`, `no`). Generar con ellos evita
 * que un falso rechazo pase inadvertido.
 */
const ATOM_POOL = ['A', 'B', 'C', 'D', 'E', 'O', 'Y', 'N'] as const;

export interface ConstructedProof {
  readonly seed: number;
  readonly lines: ProofLineInput[];
  /** Conclusión efectiva: la última línea, en profundidad 0. */
  readonly goal: string;
  readonly rulesUsed: RuleId[];
}

interface Available {
  readonly lineNumber: number;
  readonly formula: Formula;
}

function randomFormula(rnd: () => number, depth = 0): Formula {
  const roll = rnd();
  if (depth >= 2 || roll < 0.45) {
    return atom(ATOM_POOL[Math.floor(rnd() * ATOM_POOL.length)] as string);
  }
  if (roll < 0.58) return not(randomFormula(rnd, depth + 1));
  const ops = ['and', 'or', 'implies', 'iff'] as const;
  const op = ops[Math.floor(rnd() * ops.length)] as (typeof ops)[number];
  return bin(op, randomFormula(rnd, depth + 1), randomFormula(rnd, depth + 1));
}

/**
 * Construye una derivación válida. `steps` acota el número de pasos derivados;
 * el resultado siempre termina en profundidad 0.
 */
export function constructProof(seed: number, steps = 6): ConstructedProof {
  const rnd = makeRandom(seed);
  const lines: ProofLineInput[] = [];
  const available: Available[] = [];
  const rulesUsed: RuleId[] = [];

  const push = (
    formula: Formula,
    rule: string,
    refs: Reference[] | undefined,
    depth: number,
  ): number => {
    lines.push({ formula: print(formula), rule, ...(refs ? { refs } : {}), depth });
    const lineNumber = lines.length;
    if (depth === 0) available.push({ lineNumber, formula });
    return lineNumber;
  };

  // Bloque de premisas: entre 1 y 3.
  const premiseCount = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < premiseCount; i += 1) push(randomFormula(rnd), 'PR', undefined, 0);

  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)] as T;

  for (let step = 0; step < steps; step += 1) {
    const options: (() => RuleId | null)[] = [
      // R — reiteración
      () => {
        const src = pick(available);
        push(src.formula, 'R', [src.lineNumber], 0);
        return 'R';
      },
      // ∧I
      () => {
        const a = pick(available);
        const b = pick(available);
        push(bin('and', a.formula, b.formula), '∧I', [a.lineNumber, b.lineNumber], 0);
        return '∧I';
      },
      // ∧E
      () => {
        // Nota de tipos: el nodo binario declara `kind: BinaryOp`, así que
        // `Extract<Formula, {kind:'and'}>` daría `never`. Se estrecha por
        // comparación, que sí funciona sobre la unión.
        const conjunctions: { lineNumber: number; left: Formula; right: Formula }[] = [];
        for (const x of available) {
          if (x.formula.kind === 'and') {
            conjunctions.push({ lineNumber: x.lineNumber, left: x.formula.left, right: x.formula.right });
          }
        }
        if (conjunctions.length === 0) return null;
        const src = pick(conjunctions);
        push(rnd() < 0.5 ? src.left : src.right, '∧E', [src.lineNumber], 0);
        return '∧E';
      },
      // ∨I
      () => {
        const src = pick(available);
        const other = randomFormula(rnd);
        const disjunction =
          rnd() < 0.5 ? bin('or', src.formula, other) : bin('or', other, src.formula);
        push(disjunction, '∨I', [src.lineNumber], 0);
        return '∨I';
      },
      // →E
      () => {
        for (const cond of available) {
          if (cond.formula.kind !== 'implies') continue;
          const { left: antecedent, right: consequent } = cond.formula;
          const match = available.find((x) => print(x.formula) === print(antecedent));
          if (match) {
            push(consequent, '→E', [cond.lineNumber, match.lineNumber], 0);
            return '→E';
          }
        }
        return null;
      },
      // DNE
      () => {
        const doubles: { lineNumber: number; inner: Formula }[] = [];
        for (const x of available) {
          if (x.formula.kind === 'not' && x.formula.sub.kind === 'not') {
            doubles.push({ lineNumber: x.lineNumber, inner: x.formula.sub.sub });
          }
        }
        if (doubles.length === 0) return null;
        const src = pick(doubles);
        push(src.inner, 'DNE', [src.lineNumber], 0);
        return 'DNE';
      },
      // ¬E
      () => {
        for (const negated of available) {
          if (negated.formula.kind !== 'not') continue;
          const inner = negated.formula.sub;
          const match = available.find((x) => print(x.formula) === print(inner));
          if (match) {
            push(falsum, '¬E', [match.lineNumber, negated.lineNumber], 0);
            return '¬E';
          }
        }
        return null;
      },
      // X
      () => {
        const absurd = available.filter((x) => x.formula.kind === 'falsum');
        if (absurd.length === 0) return null;
        push(randomFormula(rnd), 'X', [(pick(absurd) as Available).lineNumber], 0);
        return 'X';
      },
      // →I con subprueba (reitera una línea accesible o el propio supuesto)
      () => {
        const assumption = randomFormula(rnd);
        const start = push(assumption, 'AS', undefined, 1);
        const reiterateAssumption = rnd() < 0.5 || available.length === 0;
        let consequent: Formula;
        if (reiterateAssumption) {
          consequent = assumption;
          push(assumption, 'R', [start], 1);
        } else {
          const src = pick(available);
          consequent = src.formula;
          push(src.formula, 'R', [src.lineNumber], 1);
        }
        const end = lines.length;
        push(bin('implies', assumption, consequent), '→I', [[start, end]], 0);
        return '→I';
      },
    ];

    // Se intenta una regla al azar; si no es aplicable, se prueban las demás.
    const order = [...options.keys()].sort(() => rnd() - 0.5);
    for (const index of order) {
      const applied = (options[index] as () => RuleId | null)();
      if (applied) {
        rulesUsed.push(applied);
        break;
      }
    }
  }

  const lastLine = lines[lines.length - 1] as ProofLineInput;
  if (lastLine.depth !== 0) {
    // No debería ocurrir: toda rama vuelve a profundidad 0.
    throw new Error('construcción inválida: la derivación no termina en profundidad 0');
  }

  return { seed, lines, goal: lastLine.formula, rulesUsed };
}
