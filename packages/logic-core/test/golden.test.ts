import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { verify } from '../src/verify.js';
import type { ProofInput } from '../src/fitch.js';

/**
 * `ci:logic:golden` — conjunto dorado (Plan.md T-H2-10 ← pisos de P-III §7.1).
 *
 * Los casos viven en el repositorio de contenido, no en el código: son
 * artefactos de la unidad, versionados con su propio historial.
 */

const here = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = join(here, '..', '..', '..', 'content', 'unidad-deduccion-natural', 'golden-tests');

interface GoldenCase {
  id: string;
  proof: ProofInput;
  expected: { valid: boolean; goalReached?: boolean; codes?: string[] };
}

interface GoldenFile {
  version: string;
  authorizedCalculusVersion: string;
  count: number;
  cases: GoldenCase[];
}

const load = (file: string): GoldenFile =>
  JSON.parse(readFileSync(join(GOLDEN_DIR, file), 'utf8')) as GoldenFile;

/** Pisos literales del Maestro (P-III §7.1). */
const FLOORS = [
  ['valid.json', 100, 'derivaciones válidas'],
  ['invalid.json', 100, 'derivaciones inválidas'],
  ['scope.json', 50, 'alcance y subpruebas'],
  ['variants.json', 50, 'variantes equivalentes'],
  ['edge-cases.json', 50, 'casos límite'],
] as const;

describe('pisos del conjunto dorado (P-III §7.1)', () => {
  it.each(FLOORS)('%s alcanza el piso de %i casos (%s)', (file, floor) => {
    const data = load(file);
    expect(data.cases.length).toBeGreaterThanOrEqual(floor);
    expect(data.count).toBe(data.cases.length);
    expect(data.authorizedCalculusVersion).toBe('authorized-calculus-v1');
  });
});

describe('el verificador coincide con el conjunto dorado', () => {
  for (const [file] of FLOORS) {
    const data = load(file);
    it(`${file}: ${data.cases.length} casos`, () => {
      const mismatches: string[] = [];

      for (const testCase of data.cases) {
        const result = verify(testCase.proof);

        if (result.valid !== testCase.expected.valid) {
          mismatches.push(
            `${testCase.id}: esperado valid=${testCase.expected.valid}, obtenido ${result.valid} ` +
              `(${result.errors.map((e) => e.code).join(', ') || 'sin errores'})`,
          );
          continue;
        }

        if (testCase.expected.goalReached !== undefined) {
          if (result.goalReached !== testCase.expected.goalReached) {
            mismatches.push(
              `${testCase.id}: esperado goalReached=${testCase.expected.goalReached}, obtenido ${result.goalReached}`,
            );
          }
        }

        for (const code of testCase.expected.codes ?? []) {
          if (!result.errors.some((e) => e.code === code)) {
            mismatches.push(
              `${testCase.id}: falta el código ${code}; obtenidos ${result.errors
                .map((e) => e.code)
                .join(', ')}`,
            );
          }
        }
      }

      // 0 falsos positivos y 0 falsos negativos conocidos sin resolver (gate H2).
      expect(mismatches, mismatches.slice(0, 10).join('\n')).toEqual([]);
    });
  }
});

describe('sanidad del conjunto', () => {
  it('las variantes equivalentes prueban lo mismo por rutas distintas', () => {
    const data = load('variants.json') as GoldenFile & {
      cases: (GoldenCase & { equivalenceClass: string })[];
    };
    const byClass = new Map<string, GoldenCase[]>();
    for (const c of data.cases) {
      const list = byClass.get(c.equivalenceClass) ?? [];
      list.push(c);
      byClass.set(c.equivalenceClass, list);
    }
    for (const [equivalenceClass, cases] of byClass) {
      expect(cases.length, equivalenceClass).toBeGreaterThanOrEqual(2);
      // La firma incluye las citas: dos derivaciones con la misma secuencia de
      // reglas pero distinto grafo de citas son derivaciones distintas.
      const shapes = new Set(
        cases.map((c) =>
          c.proof.lines
            .map((l) => `${l.depth}:${l.rule}:${JSON.stringify(l.refs ?? [])}`)
            .join('|'),
        ),
      );
      // Rutas estructuralmente distintas, no copias con otro nombre.
      expect(shapes.size, equivalenceClass).toBe(cases.length);
    }
  });

  it('ningún caso inválido carece de código esperado', () => {
    const data = load('invalid.json');
    for (const c of data.cases) {
      expect(c.expected.valid).toBe(false);
      expect((c.expected.codes ?? []).length, c.id).toBeGreaterThan(0);
    }
  });
});
