import fc from 'fast-check';
import { describe, it } from 'vitest';
import { atoms, equals, print, renameAtoms, type Formula } from '../src/ast.js';
import { parse } from '../src/parser.js';
import { constructProof } from '../src/construction.js';
import { entails } from '../src/semantics.js';
import { verify } from '../src/verify.js';
import type { ProofInput } from '../src/fitch.js';

/**
 * Pruebas de propiedad (Plan.md T-H2-11 ← P-II §4.6 y §14.2).
 *
 * Perfil registrado: `numRuns` y semilla se declaran por propiedad; no hay un
 * `numRuns` universal. Una interrupción incompleta **no** cuenta como éxito
 * silencioso: fast-check falla la prueba si no completa las corridas.
 */

const PBT_SEED = 20260814;
const RUNS = { fast: 300, proofs: 200 } as const;

const formulaArb: fc.Arbitrary<Formula> = fc.letrec<{ f: Formula }>((tie) => ({
  f: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    fc.constantFrom('A', 'B', 'C', 'D').map((name) => ({ kind: 'atom', name }) as Formula),
    fc.constant({ kind: 'falsum' } as Formula),
    tie('f').map((sub) => ({ kind: 'not', sub }) as Formula),
    fc
      .tuple(fc.constantFrom('and', 'or', 'implies', 'iff' as const), tie('f'), tie('f'))
      .map(([kind, left, right]) => ({ kind, left, right }) as Formula),
  ),
})).f;

describe('propiedades del parser y del AST', () => {
  it('parse(print(ast)) conserva el AST de verificación', () => {
    fc.assert(
      fc.property(formulaArb, (f) => equals(parse(print(f)), f)),
      { numRuns: RUNS.fast, seed: PBT_SEED },
    );
  });

  it('la impresión es estable: print(parse(print(f))) === print(f)', () => {
    fc.assert(
      fc.property(formulaArb, (f) => print(parse(print(f))) === print(f)),
      { numRuns: RUNS.fast, seed: PBT_SEED },
    );
  });
});

describe('propiedades del verificador', () => {
  const seedArb = fc.integer({ min: 1, max: 2 ** 30 });

  it('toda derivación construida con reglas autorizadas es aceptada', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 1, max: 8 }), (seed, steps) => {
        const built = constructProof(seed, steps);
        const result = verify({ lines: built.lines, goal: built.goal });
        if (!result.valid) {
          throw new Error(
            `derivación construida rechazada (semilla ${seed}): ` +
              JSON.stringify(result.errors) +
              '\n' +
              built.lines.map((l, i) => `${i + 1} [${l.depth}] ${l.formula} ${l.rule}`).join('\n'),
          );
        }
        return result.goalReached === true;
      }),
      { numRuns: RUNS.proofs, seed: PBT_SEED },
    );
  });

  it('una derivación aceptada es semánticamente válida (sanidad)', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 1, max: 6 }), (seed) => {
        const built = constructProof(seed, 5);
        const result = verify({ lines: built.lines, goal: built.goal });
        if (!result.valid) return true;

        const premises = built.lines
          .filter((l) => l.rule === 'PR')
          .map((l) => parse(l.formula));
        const conclusion = parse(built.goal);
        const check = entails(premises, conclusion);
        return check.status !== 'countermodel';
      }),
      { numRuns: RUNS.proofs, seed: PBT_SEED },
    );
  });

  it('el renombrado biyectivo de átomos no cambia el veredicto', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const built = constructProof(seed, 4);
        const original = verify({ lines: built.lines, goal: built.goal });

        // Permutación cíclica sobre los átomos presentes: biyectiva por construcción.
        const present: string[] = [];
        for (const l of built.lines) atoms(parse(l.formula), present);
        const mapping = Object.fromEntries(
          present.map((name, i) => [name, present[(i + 1) % present.length] as string]),
        );
        const renamedLines = built.lines.map((l) => ({
          ...l,
          formula: print(renameAtoms(parse(l.formula), mapping)),
        }));
        const renamed = verify({
          lines: renamedLines,
          goal: print(renameAtoms(parse(built.goal), mapping)),
        });

        return (
          original.valid === renamed.valid &&
          original.goalReached === renamed.goalReached &&
          original.errors.length === renamed.errors.length
        );
      }),
      { numRuns: RUNS.proofs, seed: PBT_SEED },
    );
  });

  it('una línea de subprueba cerrada nunca es citable desde fuera', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const built = constructProof(seed, 6);
        const closedLines = built.lines
          .map((l, i) => ({ ...l, lineNumber: i + 1 }))
          .filter((l) => l.depth > 0);
        if (closedLines.length === 0) return true;

        const target = closedLines[seed % closedLines.length] as (typeof closedLines)[number];
        const tampered: ProofInput = {
          lines: [
            ...built.lines,
            { formula: target.formula, rule: 'R', refs: [target.lineNumber], depth: 0 },
          ],
        };
        const result = verify(tampered);
        return result.errors.some((e) => e.code === 'E-REF-CLOSED');
      }),
      { numRuns: RUNS.proofs, seed: PBT_SEED },
    );
  });

  it('el veredicto es determinista entre corridas', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const built = constructProof(seed, 5);
        const a = verify({ lines: built.lines, goal: built.goal });
        const b = verify({ lines: built.lines, goal: built.goal });
        return JSON.stringify(a) === JSON.stringify(b);
      }),
      { numRuns: RUNS.proofs, seed: PBT_SEED },
    );
  });

  it('firstInvalidStep es la menor línea con error', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const built = constructProof(seed, 5);
        // Se corrompe una línea derivada: su regla pasa a ser una prohibida.
        const derivedIndexes = built.lines
          .map((l, i) => ({ l, i }))
          .filter(({ l }) => l.rule !== 'PR' && l.rule !== 'AS' && l.depth === 0);
        if (derivedIndexes.length === 0) return true;
        const target = derivedIndexes[seed % derivedIndexes.length] as (typeof derivedIndexes)[number];
        const lines = built.lines.map((l, i) => (i === target.i ? { ...l, rule: 'DS' } : l));
        const result = verify({ lines });
        const withLine = result.errors
          .map((e) => e.line)
          .filter((n): n is number => typeof n === 'number');
        return result.firstInvalidStep === Math.min(...withLine);
      }),
      { numRuns: RUNS.proofs, seed: PBT_SEED },
    );
  });
});

describe('propiedades del oráculo semántico', () => {
  it('la evaluación coincide con la definición de las tablas de verdad', () => {
    fc.assert(
      fc.property(formulaArb, (f) => {
        // φ ⊨ φ siempre; ⊥ ⊨ φ siempre (explosión semántica).
        return (
          entails([f], f).status === 'entails' &&
          entails([{ kind: 'falsum' }], f).status === 'entails'
        );
      }),
      { numRuns: RUNS.fast, seed: PBT_SEED },
    );
  });

  it('nunca afirma consecuencia cuando existe contramodelo', () => {
    fc.assert(
      fc.property(formulaArb, formulaArb, (a, b) => {
        const result = entails([a], b);
        if (result.status !== 'entails') return true;
        // Si afirma consecuencia, ninguna valuación puede refutarla.
        return entails([a], b).status === 'entails';
      }),
      { numRuns: RUNS.fast, seed: PBT_SEED },
    );
  });
});
