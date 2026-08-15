import { describe, expect, it } from 'vitest';
import { MAX_DEPTH, isAccessible } from '../src/fitch.js';
import { ParseError } from '../src/errors.js';
import { verify } from '../src/verify.js';
import type { ProofInput } from '../src/fitch.js';

/**
 * Ramas estructurales y de resolución de citas que el mutation testing señaló
 * como no ejercitadas: profundidades fuera de rango, saltos de nivel, rangos
 * mal formados y aperturas de subprueba sin `AS`.
 */

const codes = (input: ProofInput): string[] => verify(input).errors.map((e) => e.code);
const line = (formula: string, rule: string, refs?: (number | [number, number])[], depth = 0) => ({
  formula,
  rule,
  ...(refs ? { refs } : {}),
  depth,
});

describe('profundidad fuera del rango de implementación', () => {
  it('rechaza una profundidad negativa', () => {
    expect(codes({ lines: [line('A', 'PR'), line('B', 'AS', undefined, -1)] })).toContain(
      'E-SYN-PARSE',
    );
  });

  it('rechaza una profundidad por encima del límite', () => {
    expect(
      codes({ lines: [line('A', 'PR'), line('B', 'AS', undefined, MAX_DEPTH + 1)] }),
    ).toContain('E-SYN-PARSE');
  });

  it('acepta el anidamiento justo en el límite si la estructura es correcta', () => {
    // Se abren MAX_DEPTH niveles, uno por línea, y se cierran hasta profundidad 0.
    const lines = [line('A', 'PR')];
    for (let depth = 1; depth <= MAX_DEPTH; depth += 1) {
      lines.push(line('B', 'AS', undefined, depth));
    }
    lines.push(line('B→B', '→I', [[MAX_DEPTH + 1, MAX_DEPTH + 1]], MAX_DEPTH - 1));
    const found = codes({ lines });
    expect(found).not.toContain('E-SYN-PARSE');
  });
});

describe('salto de profundidad', () => {
  it('una subprueba abre exactamente un nivel', () => {
    expect(codes({ lines: [line('A', 'PR'), line('B', 'AS', undefined, 2)] })).toContain(
      'E-STRUCT-AS-POSITION',
    );
  });

  it('abrir un nivel a la vez no produce ese error', () => {
    const found = codes({
      lines: [
        line('A', 'PR'),
        line('B', 'AS', undefined, 1),
        line('C', 'AS', undefined, 2),
        line('C', 'R', [3], 2),
        line('C→C', '→I', [[3, 4]], 1),
        line('B→(C→C)', '→I', [[2, 5]]),
      ],
    });
    expect(found).toEqual([]);
  });
});

describe('primera línea de subprueba', () => {
  it('exige AS y nombra la regla que se usó en su lugar', () => {
    const result = verify({
      lines: [line('A', 'PR'), line('A', 'R', [1], 1), line('A→A', '→I', [[2, 2]])],
    });
    const structural = result.errors.find((e) => e.code === 'E-STRUCT-AS-POSITION');
    expect(structural).toBeDefined();
    expect(structural?.detail).toContain('R');
  });

  it('citar una subprueba que no abre con AS es una subprueba incompleta', () => {
    expect(
      codes({ lines: [line('A', 'PR'), line('A', 'R', [1], 1), line('A→A', '→I', [[2, 2]])] }),
    ).toContain('E-REF-SUBPROOF-INCOMPLETE');
  });
});

describe('rangos de cita mal formados', () => {
  it('un rango invertido cuyo inicio está por delante es cita hacia adelante', () => {
    // Línea 4 cita [5,2]: el final precede, pero el inicio no.
    expect(
      codes({
        lines: [
          line('A', 'PR'),
          line('B', 'AS', undefined, 1),
          line('B', 'R', [2], 1),
          line('B→B', '→I', [[5, 2]]),
          line('A', 'R', [1]),
        ],
      }),
    ).toContain('E-REF-FORWARD');
  });

  it('un rango que no corresponde a ninguna subprueba es incompleto', () => {
    expect(
      codes({
        lines: [
          line('A', 'PR'),
          line('B', 'AS', undefined, 1),
          line('B', 'R', [2], 1),
          line('B→B', '→I', [[1, 3]]),
        ],
      }),
    ).toContain('E-REF-SUBPROOF-INCOMPLETE');
  });

  it('citar la línea 0 o negativa es una cita inexistente', () => {
    expect(codes({ lines: [line('A', 'PR'), line('A', 'R', [0])] })).toContain('E-SYN-PARSE');
    expect(codes({ lines: [line('A', 'PR'), line('A', 'R', [-3])] })).toContain('E-SYN-PARSE');
  });
});

describe('supuestos accesibles y semántica', () => {
  it('una premisa mal colocada en profundidad 1 no se toma como premisa global', () => {
    // La línea 2 es PR a profundidad 1: error estructural, y su fórmula no puede
    // sostener semánticamente un paso posterior de nivel 0.
    const found = codes({
      lines: [line('A', 'PR'), line('B', 'PR', undefined, 1), line('B', 'R', [2])],
    });
    expect(found).toContain('E-STRUCT-PR-POSITION');
    expect(found).toContain('E-REF-CLOSED');
  });

  it('el supuesto de una subprueba abierta sí sostiene sus propios pasos', () => {
    const result = verify({
      lines: [
        line('A→B', 'PR'),
        line('A', 'AS', undefined, 1),
        line('B', '→E', [1, 2], 1),
        line('A→B', '→I', [[2, 3]]),
      ],
    });
    expect(result.errors).toEqual([]);
    expect(result.semanticCheck).toBe('passed');
  });
});

describe('accesibilidad de bloques', () => {
  it('un camino vacío es accesible desde cualquier bloque', () => {
    expect(isAccessible([], [1, 2])).toBe(true);
  });

  it('un bloque más profundo no es accesible desde uno más externo', () => {
    expect(isAccessible([1, 2], [1])).toBe(false);
  });

  it('bloques hermanos no se ven entre sí', () => {
    expect(isAccessible([2], [5])).toBe(false);
  });

  it('el mismo camino es accesible', () => {
    expect(isAccessible([2, 4], [2, 4])).toBe(true);
  });
});

describe('formato del error de análisis', () => {
  it('el mensaje incluye el código y el detalle', () => {
    const error = new ParseError('E-SYN-PARSE', 'corchete sin cerrar');
    expect(error.message).toBe('E-SYN-PARSE: corchete sin cerrar');
    expect(error.name).toBe('ParseError');
    expect(error.code).toBe('E-SYN-PARSE');
    expect(error.detail).toBe('corchete sin cerrar');
  });
});

describe('derivación vacía y metas no parseables', () => {
  it('una derivación sin líneas es un error de análisis', () => {
    const result = verify({ lines: [] });
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('E-SYN-PARSE');
    expect(result.semanticCheck).toBe('not-applicable');
  });

  it('una meta que no parsea no se declara alcanzada', () => {
    const result = verify({ lines: [line('A', 'PR')], goal: 'A∧' });
    expect(result.goalReached).toBe(false);
  });

  it('sin meta declarada, goalReached no aparece en el resultado', () => {
    expect('goalReached' in verify({ lines: [line('A', 'PR')] })).toBe(false);
  });
});
