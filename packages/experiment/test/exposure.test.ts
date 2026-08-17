import { describe, expect, it } from 'vitest';
import { ExternalExposure } from '@profesor-ia/contracts';
import {
  EXTERNAL_EXPOSURE_MARK,
  EXTERNAL_EXPOSURE_SCHEMA_VERSION,
  ExposureError,
  NOT_INTERPRETABLE_CEILING,
  NOT_INTERPRETABLE_FLOOR,
  assessBaselineCeilingFloor,
  assessExposure,
  exposureEffectFor,
} from '../src/index.js';
import type { BaselineObservation, ExposureDeclaration } from '../src/index.js';

const AT = '2026-08-17T09:00:00.000Z';

function declaration(overrides: Partial<ExposureDeclaration> = {}): ExposureDeclaration {
  return {
    exposureId: 'exposure-fixture-1',
    sessionId: 'session-fixture-1',
    capturedAt: AT,
    declaredAt: AT,
    exposure: 'NONE',
    affectedKcIds: [],
    deliberateHumanTeaching: false,
    ...overrides,
  };
}

function observations(scores: readonly number[]): readonly BaselineObservation[] {
  return scores.map((score, index) => ({
    opportunityId: `opportunity-fixture-${index}`,
    observedAt: `2026-08-17T09:0${index}:00.000Z`,
    score,
  }));
}

function expectCode(operation: () => unknown, code: string): void {
  try {
    operation();
    throw new Error('se esperaba ExposureError');
  } catch (error) {
    expect(error).toBeInstanceOf(ExposureError);
    expect((error as ExposureError).code).toBe(code);
  }
}

describe('T-H6-11 — las cuatro categorías y sus efectos literales', () => {
  it('cubre exactamente el enum del contrato', () => {
    for (const exposure of ExternalExposure.options) {
      expect(exposureEffectFor(exposure).exposure).toBe(exposure);
    }
    expectCode(() => exposureEffectFor('ALGO_DE_EXPOSICION'), 'EXPOSURE_UNKNOWN');
  });

  it('UNRELATED_OR_FOUNDATION se registra y no invalida por sí solo', () => {
    const effect = exposureEffectFor('UNRELATED_OR_FOUNDATION');
    expect(effect.invalidatesAffectedOpportunity).toBe(false);
    expect(effect.blocksPositiveVerdict).toBe(false);
    expect(effect.mark).toBeNull();
  });

  it('DIRECT_ITEM_EXPOSURE invalida, consume y sólo repone desde reserva independiente', () => {
    const effect = exposureEffectFor('DIRECT_ITEM_EXPOSURE');
    expect(effect.invalidatesAffectedOpportunity).toBe(true);
    expect(effect.consumesItem).toBe(true);
    expect(effect.replacementFromIndependentReserveAllowed).toBe(true);
  });

  /**
   * La contaminación de `TARGET_KC_EXPOSURE` es conceptual, no del ítem. Ofrecer
   * reposición sugeriría que reponer el reactivo arregla algo, y §10.8 dice
   * expresamente que no se «limpia» así.
   */
  it('TARGET_KC_EXPOSURE contamina la atribución y no se limpia reponiendo el reactivo', () => {
    const effect = exposureEffectFor('TARGET_KC_EXPOSURE');
    expect(effect.contaminatesAttribution).toBe(true);
    expect(effect.blocksPositiveVerdict).toBe(true);
    expect(effect.mark).toBe(EXTERNAL_EXPOSURE_MARK);
    expect(effect.replacementFromIndependentReserveAllowed).toBe(false);
    expect(effect.invalidatesAffectedOpportunity).toBe(false);
    expect(effect.consumesItem).toBe(false);
  });

  it('sólo DIRECT_ITEM_EXPOSURE invalida y sólo TARGET_KC_EXPOSURE contamina', () => {
    for (const exposure of ExternalExposure.options) {
      const effect = exposureEffectFor(exposure);
      expect(effect.invalidatesAffectedOpportunity).toBe(exposure === 'DIRECT_ITEM_EXPOSURE');
      expect(effect.contaminatesAttribution).toBe(exposure === 'TARGET_KC_EXPOSURE');
    }
  });
});

describe('T-H6-11 — captura al inicio de sesión', () => {
  it('conserva el momento declarado, desde el que corre la contaminación', () => {
    const assessment = assessExposure(
      declaration({
        exposure: 'TARGET_KC_EXPOSURE',
        affectedKcIds: ['KC06'],
        declaredAt: '2026-08-16T20:00:00.000Z',
      }),
    );
    expect(assessment.declaredAt).toBe('2026-08-16T20:00:00.000Z');
    expect(assessment.effect.mark).toBe(EXTERNAL_EXPOSURE_MARK);
    expect(assessment.policyVersion).toBe(EXTERNAL_EXPOSURE_SCHEMA_VERSION);
  });

  it('DIRECT_ITEM_EXPOSURE sin oportunidad afectada falla en vez de invalidar a ciegas', () => {
    expectCode(
      () => assessExposure(declaration({ exposure: 'DIRECT_ITEM_EXPOSURE' })),
      'EXPOSURE_TARGET_MISSING',
    );
    const assessment = assessExposure(
      declaration({
        exposure: 'DIRECT_ITEM_EXPOSURE',
        affectedOpportunityId: 'opportunity-fixture-1',
      }),
    );
    expect(assessment.affectedOpportunityId).toBe('opportunity-fixture-1');
  });

  it('TARGET_KC_EXPOSURE sin KC declarados falla en vez de contaminar por vacío', () => {
    expectCode(
      () => assessExposure(declaration({ exposure: 'TARGET_KC_EXPOSURE' })),
      'EXPOSURE_TARGET_MISSING',
    );
  });

  it('conserva la enseñanza humana deliberada como intervención pedagógica prohibida', () => {
    const assessment = assessExposure(
      declaration({
        exposure: 'TARGET_KC_EXPOSURE',
        affectedKcIds: ['KC06'],
        deliberateHumanTeaching: true,
      }),
    );
    expect(assessment.prohibitedPedagogicalInterventionObserved).toBe(true);
  });

  it('rechaza declarar enseñanza deliberada sobre una categoría que no toca KC objetivo', () => {
    expectCode(
      () => assessExposure(
        declaration({ exposure: 'UNRELATED_OR_FOUNDATION', deliberateHumanTeaching: true }),
      ),
      'EXPOSURE_SCOPE_UNSUPPORTED',
    );
  });

  it('rechaza campos no declarados y declaraciones incompletas', () => {
    expectCode(
      () => assessExposure({ ...declaration(), fuente: 'un video' }),
      'EXPOSURE_DECLARATION_INVALID',
    );
    expectCode(() => assessExposure({ ...declaration(), exposureId: '' }), 'EXPOSURE_DECLARATION_INVALID');
  });
});

describe('T-H6-11 — techo y suelo de la línea base', () => {
  it('marca techo con tres observaciones perfectas y sin rango ascendente', () => {
    const result = assessBaselineCeilingFloor({
      observations: observations([1, 1, 1]),
      ascendingRangeObservable: false,
      foundationOrInterfaceBarrierEvidence: false,
    });
    expect(result.interpretable).toBe(false);
    if (result.interpretable) throw new Error('inalcanzable');
    expect(result.mark).toBe(NOT_INTERPRETABLE_CEILING);
    expect(result.startsIntervention).toBe(false);
  });

  it('no marca techo si existe rango ascendente observable', () => {
    const result = assessBaselineCeilingFloor({
      observations: observations([1, 1, 1]),
      ascendingRangeObservable: true,
      foundationOrInterfaceBarrierEvidence: false,
    });
    expect(result.interpretable).toBe(true);
  });

  /**
   * El punto entero de la regla de suelo: tres ceros **no** bastan. Sin evidencia
   * de barrera previa al KC, el `0` representa desconocimiento real y la línea
   * sigue siendo interpretable, que es justo el hallazgo que el diseño busca.
   * Marcarla `NOT_INTERPRETABLE_FLOOR` descartaría el dato más informativo.
   */
  it('tres ceros sin evidencia de barrera siguen siendo interpretables', () => {
    const result = assessBaselineCeilingFloor({
      observations: observations([0, 0, 0]),
      ascendingRangeObservable: false,
      foundationOrInterfaceBarrierEvidence: false,
    });
    expect(result.interpretable).toBe(true);
    expect(result.mark).toBeNull();
  });

  it('marca suelo sólo con tres ceros y evidencia de barrera de fundamentos o interfaz', () => {
    const result = assessBaselineCeilingFloor({
      observations: observations([0, 0, 0]),
      ascendingRangeObservable: false,
      foundationOrInterfaceBarrierEvidence: true,
    });
    expect(result.interpretable).toBe(false);
    if (result.interpretable) throw new Error('inalcanzable');
    expect(result.mark).toBe(NOT_INTERPRETABLE_FLOOR);
  });

  it('una línea baja que no es cero no activa el suelo aunque haya barrera declarada', () => {
    const result = assessBaselineCeilingFloor({
      observations: observations([0, 0.2, 0]),
      ascendingRangeObservable: false,
      foundationOrInterfaceBarrierEvidence: true,
    });
    expect(result.interpretable).toBe(true);
  });

  it('mira exactamente las tres últimas y no toda la serie', () => {
    const ceiling = assessBaselineCeilingFloor({
      observations: observations([0, 0.5, 1, 1, 1]),
      ascendingRangeObservable: false,
      foundationOrInterfaceBarrierEvidence: false,
    });
    expect(ceiling.interpretable).toBe(false);
    const notYet = assessBaselineCeilingFloor({
      observations: observations([1, 1, 0.5]),
      ascendingRangeObservable: false,
      foundationOrInterfaceBarrierEvidence: false,
    });
    expect(notYet.interpretable).toBe(true);
  });

  it('con menos de tres observaciones válidas no declara techo ni suelo', () => {
    const result = assessBaselineCeilingFloor({
      observations: observations([1, 1]),
      ascendingRangeObservable: false,
      foundationOrInterfaceBarrierEvidence: true,
    });
    expect(result.interpretable).toBe(true);
  });
});
