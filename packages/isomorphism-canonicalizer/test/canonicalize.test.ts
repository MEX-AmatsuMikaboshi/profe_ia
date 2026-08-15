import { describe, expect, it } from 'vitest';
import {
  areIsomorphic,
  canonicalForm,
  canonicalizeFormula,
  groupByStructuralSignature,
  isTrivialDuplicate,
  structuralSignature,
  type CanonicalProof,
} from '../src/canonicalize.js';

const L = (
  formula: string,
  rule: string,
  refs?: (number | [number, number])[],
  depth = 0,
) => ({ formula, rule, ...(refs ? { refs } : {}), depth });

describe('canonicalización de fórmulas', () => {
  it('renombra átomos por orden de aparición', () => {
    expect(canonicalizeFormula('A∧B')).toBe(canonicalizeFormula('C∧D'));
    expect(canonicalizeFormula('A∧B')).toBe('A_1∧A_2');
  });

  it('la forma canónica sigue siendo una fórmula del lenguaje', () => {
    // Idempotencia: canonicalizar lo ya canónico no lo cambia.
    const once = canonicalizeFormula('(C∨D)→C');
    expect(canonicalizeFormula(once)).toBe(once);
  });

  it('distingue estructuras distintas pese al renombrado', () => {
    expect(canonicalizeFormula('A∧B')).not.toBe(canonicalizeFormula('A∨B'));
    expect(canonicalizeFormula('(A∧B)∧C')).not.toBe(canonicalizeFormula('A∧(B∧C)'));
  });

  it('respeta la repetición de un mismo átomo', () => {
    expect(canonicalizeFormula('A∧A')).toBe('A_1∧A_1');
    expect(canonicalizeFormula('A∧B')).not.toBe(canonicalizeFormula('A∧A'));
  });
});

describe('firma estructural de derivaciones', () => {
  const base: CanonicalProof = {
    lines: [L('A∧B', 'PR'), L('A', '∧E', [1]), L('B', '∧E', [1]), L('B∧A', '∧I', [3, 2])],
  };

  it('es estable entre llamadas', () => {
    expect(structuralSignature(base)).toBe(structuralSignature(base));
  });

  it('el renombrado de átomos no cambia la firma', () => {
    const renamed: CanonicalProof = {
      lines: [L('C∧D', 'PR'), L('C', '∧E', [1]), L('D', '∧E', [1]), L('D∧C', '∧I', [3, 2])],
    };
    expect(areIsomorphic(base, renamed)).toBe(true);
  });

  it('el orden de las citas de un mismo paso no cambia la firma', () => {
    const swapped: CanonicalProof = {
      lines: [L('A∧B', 'PR'), L('A', '∧E', [1]), L('B', '∧E', [1]), L('B∧A', '∧I', [2, 3])],
    };
    expect(areIsomorphic(base, swapped)).toBe(true);
  });

  it('reordenar pasos independientes no cambia la firma', () => {
    // Se extraen B y A en el orden inverso: son pasos independientes entre sí.
    const reordered: CanonicalProof = {
      lines: [L('A∧B', 'PR'), L('B', '∧E', [1]), L('A', '∧E', [1]), L('B∧A', '∧I', [2, 3])],
    };
    expect(areIsomorphic(base, reordered)).toBe(true);
  });

  it('una estructura distinta produce firma distinta', () => {
    const other: CanonicalProof = {
      lines: [L('A∧B', 'PR'), L('A', '∧E', [1]), L('A∨B', '∨I', [2])],
    };
    expect(areIsomorphic(base, other)).toBe(false);
  });

  it('cambiar la regla cambia la firma', () => {
    const withReiteration: CanonicalProof = {
      lines: [
        L('A∧B', 'PR'),
        L('A∧B', 'R', [1]),
        L('A', '∧E', [2]),
        L('B', '∧E', [2]),
        L('B∧A', '∧I', [4, 3]),
      ],
    };
    expect(areIsomorphic(base, withReiteration)).toBe(false);
  });

  it('distingue premisas distintas aunque la estructura coincida', () => {
    const other: CanonicalProof = {
      lines: [L('A∨B', 'PR'), L('A', '∧E', [1]), L('B', '∧E', [1]), L('B∧A', '∧I', [3, 2])],
    };
    expect(areIsomorphic(base, other)).toBe(false);
  });

  it('cubre subpruebas citadas por rango', () => {
    const withSubproof: CanonicalProof = {
      lines: [L('A', 'PR'), L('B', 'AS', undefined, 1), L('B', 'R', [2], 1), L('B→B', '→I', [[2, 3]])],
    };
    const renamed: CanonicalProof = {
      lines: [L('C', 'PR'), L('D', 'AS', undefined, 1), L('D', 'R', [2], 1), L('D→D', '→I', [[2, 3]])],
    };
    expect(areIsomorphic(withSubproof, renamed)).toBe(true);
    expect(areIsomorphic(withSubproof, base)).toBe(false);
  });
});

describe('duplicado trivial (caso más estricto)', () => {
  const proof: CanonicalProof = {
    lines: [L('A∧B', 'PR'), L('A', '∧E', [1]), L('B', '∧E', [1]), L('B∧A', '∧I', [3, 2])],
  };

  it('un renombrado puro sí es duplicado trivial', () => {
    const renamed: CanonicalProof = {
      lines: [L('C∧D', 'PR'), L('C', '∧E', [1]), L('D', '∧E', [1]), L('D∧C', '∧I', [3, 2])],
    };
    expect(isTrivialDuplicate(proof, renamed)).toBe(true);
  });

  it('un reordenamiento es isomorfo pero NO duplicado trivial', () => {
    const reordered: CanonicalProof = {
      lines: [L('A∧B', 'PR'), L('B', '∧E', [1]), L('A', '∧E', [1]), L('B∧A', '∧I', [2, 3])],
    };
    expect(areIsomorphic(proof, reordered)).toBe(true);
    expect(isTrivialDuplicate(proof, reordered)).toBe(false);
  });

  it('la forma canónica es legible para auditar una colisión', () => {
    expect(canonicalForm(proof)).toContain('A_1∧A_2');
  });
});

describe('agrupación por firma (base de DUP-01)', () => {
  it('agrupa isomorfos y separa lo distinto', () => {
    const items = [
      {
        id: 'x1',
        proof: { lines: [L('A∧B', 'PR'), L('A', '∧E', [1])] },
      },
      {
        id: 'x2',
        proof: { lines: [L('C∧D', 'PR'), L('C', '∧E', [1])] },
      },
      {
        id: 'y1',
        proof: { lines: [L('A∨B', 'PR'), L('A∨B', 'R', [1])] },
      },
    ];
    const groups = groupByStructuralSignature(items);
    expect(groups.size).toBe(2);
    const sizes = [...groups.values()].map((g) => g.length).sort();
    expect(sizes).toEqual([1, 2]);
  });
});
