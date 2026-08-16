import { describe, expect, it } from 'vitest';
import { verify } from '@profesor-ia/logic-core';
import { SEARCH_ORDER_VERSION, search } from '../src/search.js';
import type { SearchRequest } from '../src/types.js';

const req = (
  premises: string[],
  goal: string,
  overrides: Partial<SearchRequest> = {},
): SearchRequest => ({
  premises,
  goal,
  mode: 'heuristic',
  budget: { maxWorkUnits: 20_000 },
  ...overrides,
});

describe('metas triviales y derivaciones directas', () => {
  it('reconoce la meta que ya es premisa', () => {
    const result = search(req(['A∧B'], 'A∧B'));
    expect(result.status).toBe('proof_found');
    if (result.status === 'proof_found') {
      expect(result.proof.cost).toBe(0);
    }
  });

  it('la meta que es premisa **y no la última** también termina en la meta', () => {
    // Regresión encontrada por W3 (T-H5-05). `linearize` emite todas las
    // premisas y, si la meta ya está entre ellas, no añadía línea: la
    // derivación terminaba en la última premisa. `verify` devolvía
    // `goalReached: false` **sin ningún código de error**, y la re-verificación
    // obligatoria escalaba a incidente de nivel 3 una meta que solo era trivial.
    for (const premisas of [
      ['A', '¬A'],
      ['A', 'B'],
      ['A∧B', 'C', 'D'],
    ]) {
      const goal = premisas[0]!;
      const result = search(req(premisas, goal));
      expect(result.status).toBe('proof_found');
      if (result.status !== 'proof_found') continue;
      expect(result.proof.lines.at(-1)?.formula).toBe(goal);
      expect(verify({ lines: result.proof.lines, goal }).goalReached).toBe(true);
    }
  });

  it('encuentra una eliminación de conjunción', () => {
    const result = search(req(['A∧B'], 'B'));
    expect(result.status).toBe('proof_found');
    if (result.status === 'proof_found') {
      expect(result.proof.rulesUsed).toContain('∧E');
    }
  });

  it('encuentra modus ponens', () => {
    const result = search(req(['A', 'A→B'], 'B'));
    expect(result.status).toBe('proof_found');
    if (result.status === 'proof_found') {
      expect(result.proof.rulesUsed).toContain('→E');
    }
  });

  it('construye un condicional con subprueba', () => {
    const result = search(req(['B'], 'A→B'));
    expect(result.status).toBe('proof_found');
    if (result.status === 'proof_found') {
      expect(result.proof.rulesUsed).toContain('→I');
      expect(result.proof.lines.some((l) => l.rule === 'AS')).toBe(true);
    }
  });

  it('encadena eliminación e introducción', () => {
    const result = search(req(['A∧B'], 'B∧A'));
    expect(result.status).toBe('proof_found');
    if (result.status === 'proof_found') {
      expect(result.proof.rulesUsed).toEqual(expect.arrayContaining(['∧E', '∧I']));
    }
  });
});

describe('todo certificado se re-verifica con logic-core (P-I §7.4)', () => {
  const cases: [string[], string][] = [
    [['A∧B'], 'A'],
    [['A', 'A→B'], 'B'],
    [['A∧B'], 'B∧A'],
    [['B'], 'A→B'],
    [['A→B', 'B→C', 'A'], 'C'],
    [['¬¬A'], 'A'],
    [['A', '¬A'], 'B'],
    [['A↔B', 'A'], 'B'],
    [[], 'A→A'],
    [['A'], 'A∨B'],
  ];

  it.each(cases)('la derivación de %s ⊢ %s pasa el verificador', (premises, goal) => {
    const result = search(req(premises, goal));
    expect(result.status).toBe('proof_found');
    if (result.status !== 'proof_found') return;

    const verification = verify({ lines: result.proof.lines, goal });
    expect(verification.errors).toEqual([]);
    expect(verification.valid).toBe(true);
    expect(verification.goalReached).toBe(true);
    expect(verification.semanticCheck).toBe('passed');
  });
});

describe('prefiltro semántico', () => {
  it('rechaza de entrada lo que el oráculo refuta', () => {
    const result = search(req(['A∨B'], 'A'));
    expect(result.status).toBe('semantically_invalid');
    if (result.status === 'semantically_invalid') {
      expect(Object.keys(result.countermodel).length).toBeGreaterThan(0);
    }
  });

  it('no gasta presupuesto de búsqueda en un candidato refutado', () => {
    const result = search(req(['A'], 'B'));
    expect(result.status).toBe('semantically_invalid');
    if (result.status === 'semantically_invalid') {
      expect(result.telemetry.workUnits).toBe(0);
    }
  });
});

describe('presupuesto y afirmaciones permitidas', () => {
  it('agotar el presupuesto NO significa inexistencia', () => {
    const result = search(
      req(['(A→B)∧(B→C)', '(C→D)∧(D→E)', 'A'], 'E', { budget: { maxWorkUnits: 5 } }),
    );
    expect(result.status).toBe('search_budget_exhausted');
    if (result.status === 'search_budget_exhausted') {
      expect(result.telemetry.workUnits).toBeLessThanOrEqual(5);
    }
  });

  it('el corte primario es determinista: mismas entradas, mismo trabajo', () => {
    const a = search(req(['A∧B'], 'B∧A'));
    const b = search(req(['A∧B'], 'B∧A'));
    expect(a.telemetry.workUnits).toBe(b.telemetry.workUnits);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('declara la versión del orden de exploración', () => {
    expect(search(req(['A∧B'], 'A')).telemetry.searchOrderVersion).toBe(SEARCH_ORDER_VERSION);
  });

  it('el modo heurístico nunca certifica minimalidad', () => {
    const result = search(req(['A∧B'], 'A', { mode: 'heuristic' }));
    expect(result.status).toBe('proof_found');
    if (result.status === 'proof_found') {
      expect(result.minimalCostVerified).toBe(false);
    }
  });

  it('exhaustive_k puede certificar coste mínimo tras cubrir los costes menores', () => {
    const result = search(
      req(['A∧B'], 'A', { mode: 'exhaustive_k', budget: { maxWorkUnits: 20_000, maxCost: 4 } }),
    );
    expect(result.status).toBe('proof_found');
    if (result.status === 'proof_found') {
      expect(result.minimalCostVerified).toBe(true);
      expect(result.proof.cost).toBe(1);
    }
  });

  it('exhaustive_k sin hallazgo solo afirma no_proof_with_cost_at_most_k', () => {
    // Verdad lógica que exige una derivación más larga que la cota dada.
    const result = search(
      req([], '((A→B)→A)→A', {
        mode: 'exhaustive_k',
        budget: { maxWorkUnits: 200_000, maxCost: 2 },
      }),
    );
    expect(['no_proof_with_cost_at_most_k', 'search_budget_exhausted']).toContain(result.status);
    if (result.status === 'no_proof_with_cost_at_most_k') {
      expect(result.k).toBe(2);
    }
  });
});

describe('estados prohibidos', () => {
  it('nunca emite no_proof_exists_in_calculus', () => {
    const outcomes = [
      search(req(['A∧B'], 'A')),
      search(req(['A'], 'B')),
      search(req([], 'A', { budget: { maxWorkUnits: 10 } })),
      search(req([], 'A→A', { mode: 'exhaustive_k', budget: { maxWorkUnits: 5000, maxCost: 1 } })),
    ];
    for (const outcome of outcomes) {
      expect(outcome.status).not.toBe('no_proof_exists_in_calculus');
    }
  });
});
