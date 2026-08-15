import { describe, expect, it } from 'vitest';
import { AUTHORIZED_CALCULUS_VERSION } from '@profesor-ia/logic-core';
import { SEARCH_ORDER_VERSION, search } from '../src/search.js';
import {
  CalibrationPendingError,
  COMPLEXITY_PROFILE_VERSION,
  DISCHARGE_RULES,
  INDIRECT_RULES,
  UnverifiedSolutionError,
  assertComparable,
  complexityIndex,
  structuralComplexity,
} from '../src/complexity.js';
import type { FoundProof, SearchOutcome, SearchRequest } from '../src/types.js';

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

type ProofFound = Extract<SearchOutcome, { status: 'proof_found' }>;

/** Busca y exige `proof_found`: medir presupone certificado. */
function found(premises: string[], goal: string, overrides: Partial<SearchRequest> = {}): ProofFound {
  const outcome = search(req(premises, goal, overrides));
  if (outcome.status !== 'proof_found') {
    throw new Error(`se esperaba proof_found, llegó ${outcome.status}`);
  }
  return outcome;
}

/** Certificado escrito a mano, para casos que el heurístico no produce. */
function handmade(proof: FoundProof, overrides: Partial<ProofFound> = {}): ProofFound {
  return {
    status: 'proof_found',
    proof,
    minimalCostVerified: false,
    telemetry: {
      workUnits: 0,
      costExplored: 0,
      wallTimeoutHit: false,
      mode: 'heuristic',
      searchOrderVersion: SEARCH_ORDER_VERSION,
    },
    ...overrides,
  };
}

describe('medidas estructurales (P-I §7.6)', () => {
  it('mide longitud, reglas, premisas y conectivos de una solución encontrada', () => {
    const outcome = found(['A∧B'], 'B∧A');
    const { structural } = structuralComplexity({
      premises: ['A∧B'],
      goal: 'B∧A',
      outcome,
    });

    expect(structural.proofLength).toBe(outcome.proof.cost);
    expect(structural.totalLineCount).toBe(outcome.proof.lines.length);
    expect(structural.premiseCount).toBe(1);
    expect(structural.rulesUsed).toEqual(['∧E', '∧I']);
    expect(structural.distinctRuleCount).toBe(2);
    // `A∧B` y `B∧A`: un conectivo cada uno.
    expect(structural.connectivesInStatement).toBe(2);
    expect(structural.connectivesInProof).toBeGreaterThanOrEqual(2);
  });

  it('cuenta subpruebas, profundidad y descarga de supuestos', () => {
    const outcome = found(['B'], 'A→B');
    const { structural } = structuralComplexity({ premises: ['B'], goal: 'A→B', outcome });

    expect(structural.subproofCount).toBe(1);
    expect(structural.maxSubproofDepth).toBe(1);
    expect(structural.requiresAssumptionDischarge).toBe(true);
    expect(structural.dischargeRulesUsed).toContain('→I');
    expect(structural.usesIndirectStrategy).toBe(false);
  });

  it('una derivación sin subpruebas no declara descarga', () => {
    const outcome = found(['A', 'A→B'], 'B');
    const { structural } = structuralComplexity({
      premises: ['A', 'A→B'],
      goal: 'B',
      outcome,
    });

    expect(structural.subproofCount).toBe(0);
    expect(structural.maxSubproofDepth).toBe(0);
    expect(structural.requiresAssumptionDischarge).toBe(false);
    expect(structural.dischargeRulesUsed).toEqual([]);
  });

  it('distingue estrategia indirecta (`IP`) de descarga sin más', () => {
    // ¬¬A ⊢ A por prueba indirecta, en vez de por `DNE`.
    const outcome = handmade({
      lines: [
        { formula: '¬¬A', rule: 'PR', depth: 0 },
        { formula: '¬A', rule: 'AS', depth: 1 },
        { formula: '⊥', rule: '¬E', refs: [2, 1], depth: 1 },
        { formula: 'A', rule: 'IP', refs: [[2, 3]], depth: 0 },
      ],
      cost: 3,
      rulesUsed: ['IP', '¬E'],
    });

    const { structural } = structuralComplexity({ premises: ['¬¬A'], goal: 'A', outcome });

    expect(structural.usesIndirectStrategy).toBe(true);
    expect(structural.requiresAssumptionDischarge).toBe(true);
    expect(structural.dischargeRulesUsed).toEqual(['IP']);
    // `¬` cuenta como conectivo; `⊥` es átomo distinguido y no suma.
    expect(structural.connectivesInStatement).toBe(2);
  });

  it('la distancia estructural es 0 cuando la meta ya es la premisa', () => {
    const outcome = found(['A∧B'], 'A∧B');
    const { structural } = structuralComplexity({
      premises: ['A∧B'],
      goal: 'A∧B',
      outcome,
    });
    expect(structural.structuralDistance).toBe(0);
  });

  it('la distancia estructural crece con lo que sobra y lo que falta', () => {
    const cerca = structuralComplexity({
      premises: ['A∧B'],
      goal: 'A',
      outcome: found(['A∧B'], 'A'),
    });
    const lejos = structuralComplexity({
      premises: ['A∧B', 'B→C'],
      goal: 'C∧A',
      outcome: found(['A∧B', 'B→C'], 'C∧A'),
    });

    // `A∧B` ⊢ `A`: sobran `A∧B` y `B`.
    expect(cerca.structural.structuralDistance).toBe(2);
    expect(lejos.structural.structuralDistance).toBeGreaterThan(
      cerca.structural.structuralDistance,
    );
  });

  it('las reglas de descarga se derivan de la aridad del cálculo', () => {
    expect(new Set(DISCHARGE_RULES)).toEqual(new Set(['∨E', '→I', '↔I', '¬I', 'IP']));
    expect(INDIRECT_RULES).toEqual(['IP']);
    // `¬I` descarga pero no es prueba indirecta.
    expect(INDIRECT_RULES).not.toContain('¬I');
  });
});

describe('medidas relativas al presupuesto: nunca el total de caminos', () => {
  it('separa lo estructural de lo relativo al presupuesto', () => {
    const heuristico = structuralComplexity({
      premises: ['A∧B'],
      goal: 'B',
      outcome: found(['A∧B'], 'B'),
    });
    const exhaustivo = structuralComplexity({
      premises: ['A∧B'],
      goal: 'B',
      outcome: found(['A∧B'], 'B', { mode: 'exhaustive_k', budget: { maxWorkUnits: 20_000, maxCost: 6 } }),
    });

    // Misma solución ⇒ mismas medidas estructurales, cambie o no la estrategia.
    expect(exhaustivo.structural).toEqual(heuristico.structural);
    // …y distinta lectura de búsqueda.
    expect(heuristico.searchRelative.mode).toBe('heuristic');
    expect(exhaustivo.searchRelative.mode).toBe('exhaustive_k');
  });

  it('solo `exhaustive_k` que cubrió los costes menores declara minimalidad', () => {
    const heuristico = structuralComplexity({
      premises: ['A∧B'],
      goal: 'B',
      outcome: found(['A∧B'], 'B'),
    });
    expect(heuristico.searchRelative.minimalityGuaranteed).toBe(false);
    expect(heuristico.searchRelative.minimalityScope).toBe('none');

    const exhaustivo = structuralComplexity({
      premises: ['A∧B'],
      goal: 'B',
      outcome: found(['A∧B'], 'B', { mode: 'exhaustive_k', budget: { maxWorkUnits: 20_000, maxCost: 6 } }),
    });
    expect(exhaustivo.searchRelative.minimalityGuaranteed).toBe(true);
    // Alcance explícito: costes menores al hallado, nunca minimalidad global.
    expect(exhaustivo.searchRelative.minimalityScope).toBe('exhaustive_below_found_cost');
  });

  it('marca la lectura permitida de coste y nodos explorados', () => {
    const perfil = structuralComplexity({
      premises: ['A∧B'],
      goal: 'B',
      outcome: found(['A∧B'], 'B'),
    });

    expect(perfil.searchRelative.interpretation).toBe('budget_relative_not_total_paths');
    // No existe ninguna medida que afirme totalidad del espacio de búsqueda.
    expect(Object.keys(perfil.searchRelative).some((k) => /total|espacio|paths?Total/i.test(k))).toBe(
      false,
    );
  });

  it('cuenta estrategias distintas halladas, no caminos posibles', () => {
    const outcome = found(['A∧B'], 'B∧A');

    const sinAlternativas = structuralComplexity({
      premises: ['A∧B'],
      goal: 'B∧A',
      outcome,
    });
    expect(sinAlternativas.searchRelative.distinctStrategiesFoundWithinBudget).toBe(1);

    // La misma solución repetida no aumenta la diversidad.
    const repetida = structuralComplexity({
      premises: ['A∧B'],
      goal: 'B∧A',
      outcome,
      alternativeSolutions: [outcome.proof],
    });
    expect(repetida.searchRelative.distinctStrategiesFoundWithinBudget).toBe(1);

    // Un esqueleto distinto sí.
    const otra = structuralComplexity({
      premises: ['A∧B'],
      goal: 'B∧A',
      outcome,
      alternativeSolutions: [found(['B'], 'A→B').proof],
    });
    expect(otra.searchRelative.distinctStrategiesFoundWithinBudget).toBe(2);
  });
});

describe('fallos cerrados', () => {
  it('no mide una solución que el verificador rechaza', () => {
    const outcome = found(['A∧B'], 'B');
    const manipulado = handmade({
      ...outcome.proof,
      lines: outcome.proof.lines.map((l) => (l.rule === '∧E' ? { ...l, rule: '∨I' } : l)),
    });

    expect(() =>
      structuralComplexity({ premises: ['A∧B'], goal: 'B', outcome: manipulado }),
    ).toThrow(UnverifiedSolutionError);
  });

  it('no mide una derivación impecable de otra meta', () => {
    const outcome = found(['A∧B'], 'B');
    expect(() => structuralComplexity({ premises: ['A∧B'], goal: 'A', outcome })).toThrow(
      UnverifiedSolutionError,
    );
  });

  it('el escalar del índice falla cerrado hasta que H5 congele los pesos (CAL-09)', () => {
    const perfil = structuralComplexity({
      premises: ['A∧B'],
      goal: 'B',
      outcome: found(['A∧B'], 'B'),
    });

    expect(() => complexityIndex(perfil)).toThrow(CalibrationPendingError);
    expect(() => complexityIndex(perfil)).toThrow(/CAL-09/);
    expect(() => complexityIndex(perfil)).toThrow(/T-H5-10/);
  });

  it('la comparabilidad también está calibrada, y no implica equivalencia psicométrica', () => {
    const perfil = structuralComplexity({
      premises: ['A∧B'],
      goal: 'B',
      outcome: found(['A∧B'], 'B'),
    });

    expect(() => assertComparable(perfil, perfil)).toThrow(CalibrationPendingError);
    expect(() => assertComparable(perfil, perfil)).toThrow(/psicométrica/);
  });
});

describe('trazabilidad del perfil', () => {
  it('sella versión del cálculo, del verificador y del perfil', () => {
    const perfil = structuralComplexity({
      premises: ['A∧B'],
      goal: 'B',
      outcome: found(['A∧B'], 'B'),
    });

    expect(perfil.authorizedCalculusVersion).toBe(AUTHORIZED_CALCULUS_VERSION);
    expect(perfil.profileVersion).toBe(COMPLEXITY_PROFILE_VERSION);
    expect(perfil.searchRelative.searchOrderVersion).toBe(SEARCH_ORDER_VERSION);
  });

  it('es determinista: mismas entradas ⇒ mismo perfil', () => {
    const uno = structuralComplexity({
      premises: ['A∧B', 'B→C'],
      goal: 'C',
      outcome: found(['A∧B', 'B→C'], 'C'),
    });
    const dos = structuralComplexity({
      premises: ['A∧B', 'B→C'],
      goal: 'C',
      outcome: found(['A∧B', 'B→C'], 'C'),
    });
    expect(dos).toEqual(uno);
  });
});
