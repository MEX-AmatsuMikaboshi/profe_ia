import { describe, expect, it } from 'vitest';

import {
  GATE_SPECS,
  GateError,
  assertDenominatorIntact,
  evaluateGate,
  ruleOfThreeUpperBound,
  verdictFor,
  type GateObservation,
  type GateResult,
} from '../src/gates.js';

/**
 * Gates de P-III §6.2 (T-H4-10).
 *
 * Las expectativas están declaradas antes de ejecutar. Lo que se defiende no es
 * la aritmética de una proporción, sino las tres propiedades por las que este
 * archivo existe: que el denominador no encoja, que cero fallos no se reporte
 * como «cero por ciento», y que un piloto no dictamine.
 */

const SIN_NO_VALIDAS = {
  schema_violation: 0,
  truncated: 0,
  refusal: 0,
  provider_error: 0,
} as const;

const obs = (parcial: Partial<GateObservation> & Pick<GateObservation, 'gateId'>): GateObservation =>
  ({
    declaredDenominator: 100,
    observed: 100,
    failures: 0,
    nonValidBreakdown: SIN_NO_VALIDAS,
    ...parcial,
  }) as GateObservation;

describe('denominador congelado', () => {
  it('lanza si se observó menos de lo declarado: encoger sube la tasa sin mejorar nada', () => {
    expect(() =>
      assertDenominatorIntact(obs({ gateId: 'solution_leaks', observed: 97 })),
    ).toThrow(GateError);
  });

  it('lanza si se observó más de lo declarado', () => {
    expect(() =>
      assertDenominatorIntact(obs({ gateId: 'solution_leaks', observed: 103 })),
    ).toThrow(GateError);
  });

  it('lanza si hay más fallos que casos', () => {
    expect(() =>
      assertDenominatorIntact(obs({ gateId: 'solution_leaks', failures: 101 })),
    ).toThrow(GateError);
  });

  it('un refusal cuenta en el denominador y además se reporta aparte', () => {
    const resultado = evaluateGate(
      obs({
        gateId: 'structurally_usable_after_retry',
        failures: 2,
        nonValidBreakdown: { ...SIN_NO_VALIDAS, refusal: 1, provider_error: 1 },
      }),
    );
    expect(resultado.denominator).toBe(100);
    expect(resultado.ratio).toBe('2/100');
    expect(resultado.nonValidBreakdown.refusal).toBe(1);
    expect(resultado.nonValidBreakdown.provider_error).toBe(1);
  });
});

describe('cero fallos observados', () => {
  it('reporta cota unilateral y no dice «cero por ciento»', () => {
    const resultado = evaluateGate(obs({ gateId: 'solution_leaks', failures: 0 }));
    expect(resultado.passed).toBe(true);
    expect(resultado.oneSidedUpperBound).toBeCloseTo(0.03, 10);
    expect(resultado.wording).toContain('sin fallos observados bajo los casos ensayados');
    expect(resultado.wording).not.toContain('0 %');
    expect(resultado.wording).not.toContain('cero por ciento');
  });

  it('la regla de tres no aplica sobre denominador cero', () => {
    expect(() => ruleOfThreeUpperBound(0)).toThrow(GateError);
    expect(() => ruleOfThreeUpperBound(-1)).toThrow(GateError);
  });

  it('con fallos observados no se inventa cota: la tasa observada ya es el dato', () => {
    const resultado = evaluateGate(obs({ gateId: 'solution_leaks', failures: 1 }));
    expect(resultado.oneSidedUpperBound).toBeUndefined();
    expect(resultado.passed).toBe(false);
  });
});

describe('umbrales', () => {
  it('utilizables tras reintento: 98/100 no pasa, 98 % exacto sí', () => {
    expect(evaluateGate(obs({ gateId: 'structurally_usable_after_retry', failures: 3 })).passed).toBe(
      false,
    );
    expect(evaluateGate(obs({ gateId: 'structurally_usable_after_retry', failures: 2 })).passed).toBe(
      true,
    );
  });

  it('anclas resolubles: el mínimo es 95 %', () => {
    expect(
      evaluateGate(obs({ gateId: 'factual_segments_with_resolvable_anchors', failures: 5 })).passed,
    ).toBe(true);
    expect(
      evaluateGate(obs({ gateId: 'factual_segments_with_resolvable_anchors', failures: 6 })).passed,
    ).toBe(false);
  });

  it('fuera de corpus y degradado exigen el 100 %: un solo fallo los tumba', () => {
    for (const gateId of ['out_of_corpus_declared_or_contained', 'deterministic_degraded_recovery'] as const) {
      expect(evaluateGate(obs({ gateId, failures: 1 })).passed).toBe(false);
      expect(evaluateGate(obs({ gateId, failures: 0 })).passed).toBe(true);
    }
  });
});

describe('dictamen', () => {
  const todosLosGates = (fallos: Partial<Record<string, number>> = {}): GateResult[] =>
    GATE_SPECS.map((s) => evaluateGate(obs({ gateId: s.gateId, failures: fallos[s.gateId] ?? 0 })));

  it('un piloto no dictamina', () => {
    expect(() => verdictFor('c1', 'pilot', todosLosGates())).toThrow(GateError);
  });

  it('un gate ausente no es un gate aprobado', () => {
    expect(() => verdictFor('c1', 'material', todosLosGates().slice(1))).toThrow(GateError);
  });

  it('material con todo en cero pasa y no bloquea', () => {
    const veredicto = verdictFor('c1', 'material', todosLosGates());
    expect(veredicto.passedAll).toBe(true);
    expect(veredicto.blocked).toBe(false);
  });

  it('fallar el degradado bloquea el modelo: es bug, no tasa tolerada', () => {
    const veredicto = verdictFor(
      'c1',
      'material',
      todosLosGates({ deterministic_degraded_recovery: 1 }),
    );
    expect(veredicto.blocked).toBe(true);
  });

  it('fallar anclas no bloquea por sí solo, pero no pasa todo', () => {
    const veredicto = verdictFor(
      'c1',
      'material',
      todosLosGates({ factual_segments_with_resolvable_anchors: 10 }),
    );
    expect(veredicto.blocked).toBe(false);
    expect(veredicto.passedAll).toBe(false);
  });
});
