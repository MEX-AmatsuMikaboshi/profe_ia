import { describe, expect, it } from 'vitest';
import { MEASUREMENT_RESERVES } from '@profesor-ia/authoring-core';
import {
  EXPERIMENTAL_RESERVES,
  FOUNDATION_KC_IDS,
  FOUNDATION_NOT_READY,
  FoundationPhaseError,
  assertFoundationCriterionPreregistered,
  assessFoundationPhase,
} from '../src/index.js';
import type { FoundationPhaseInput, FoundationSufficiencyCriterion } from '../src/index.js';

const CRITERION: FoundationSufficiencyCriterion = {
  criterionId: 'foundation-criterion-fixture-1',
  preregisteredAt: '2026-08-10T00:00:00.000Z',
  preregistrationRef: 'preregistro-fixture-1',
  purpose: 'test_fixture',
  requiredCorrectPerKc: 2,
  maximumOpportunitiesPerKc: 4,
};

function input(overrides: Partial<FoundationPhaseInput> = {}): FoundationPhaseInput {
  const materials = FOUNDATION_KC_IDS.map((kcId) => ({
    materialId: `material-${kcId}`,
    kcId,
    reserve: 'guided_practice' as const,
  }));
  const observations = FOUNDATION_KC_IDS.flatMap((kcId) =>
    [0, 1].map((index) => ({
      observationId: `observation-${kcId}-${index}`,
      kcId,
      materialId: `material-${kcId}`,
      correct: true,
      observedAt: `2026-08-17T10:0${index}:00.000Z`,
      taughtBy: 'profesor_ia' as const,
    })),
  );
  return {
    runId: 'run-fixture-1',
    criterion: CRITERION,
    experimentalTargetKcIds: ['KC06', 'KC12'],
    materials,
    observations,
    interfaceFamiliarizationCompleted: true,
    ...overrides,
  };
}

function expectCode(operation: () => unknown, code: string): void {
  try {
    operation();
    throw new Error('se esperaba FoundationPhaseError');
  } catch (error) {
    expect(error).toBeInstanceOf(FoundationPhaseError);
    expect((error as FoundationPhaseError).code).toBe(code);
  }
}

describe('T-H6-12 — los tres fundamentos y su aislamiento', () => {
  it('fija KC01, KC02 y KC08 como fundamentos compartidos', () => {
    expect([...FOUNDATION_KC_IDS]).toEqual(['KC01', 'KC02', 'KC08']);
  });

  /**
   * D-21 dejó abierto si el banco de reposición es de enseñanza o de medición, y
   * lo resolvió como dato. Meter `replacement` en esta lista decidiría por
   * invención lo que esa decisión dejó expresamente sin decidir.
   */
  it('reutiliza las reservas de medición derivadas del contrato, sin añadir replacement', () => {
    expect([...EXPERIMENTAL_RESERVES]).toEqual([...MEASUREMENT_RESERVES]);
    expect(EXPERIMENTAL_RESERVES).not.toContain('replacement');
  });

  it('rechaza que un fundamento sea KC objetivo de A/B/C', () => {
    for (const kcId of FOUNDATION_KC_IDS) {
      expectCode(
        () => assessFoundationPhase(input({ experimentalTargetKcIds: ['KC06', kcId] })),
        'FOUNDATION_TARGET_KC_CONFLICT',
      );
    }
  });

  it('rechaza material que salga de una reserva experimental', () => {
    for (const reserve of MEASUREMENT_RESERVES) {
      expectCode(
        () => assessFoundationPhase(
          input({
            materials: [{ materialId: 'material-KC01', kcId: 'KC01', reserve }],
          }),
        ),
        'FOUNDATION_MATERIAL_FROM_EXPERIMENTAL_RESERVE',
      );
    }
  });

  /** Una reposición cuenta por la reserva que repone, no por su etiqueta (D-21). */
  it('una reposición que repone una reserva de medición también queda excluida', () => {
    expectCode(
      () => assessFoundationPhase(
        input({
          materials: [{
            materialId: 'material-KC01',
            kcId: 'KC01',
            reserve: 'replacement',
            replacesReserve: 'probes_baseline',
          }],
        }),
      ),
      'FOUNDATION_MATERIAL_FROM_EXPERIMENTAL_RESERVE',
    );
  });

  it('una reposición sin declarar a qué repone es inválida', () => {
    expectCode(
      () => assessFoundationPhase(
        input({
          materials: [{ materialId: 'material-KC01', kcId: 'KC01', reserve: 'replacement' }],
        }),
      ),
      'FOUNDATION_INPUT_INVALID',
    );
  });

  it('exige que la familiarización de interfaz haya terminado antes', () => {
    expectCode(
      () => assessFoundationPhase(input({ interfaceFamiliarizationCompleted: false })),
      'FOUNDATION_INPUT_INVALID',
    );
  });
});

describe('T-H6-12 — suficiencia y bloqueo', () => {
  it('con el criterio alcanzado en los tres KC autoriza el inicio experimental', () => {
    const assessment = assessFoundationPhase(input());
    expect(assessment.sufficient).toBe(true);
    expect(assessment.status).toBe('foundation_ready');
    expect(assessment.experimentalRunMayStart).toBe(true);
    expect(assessment.perKc).toHaveLength(3);
  });

  it('un solo KC insuficiente declara foundation_not_ready y bloquea el inicio', () => {
    const base = input();
    const assessment = assessFoundationPhase({
      ...base,
      observations: base.observations.filter(
        (observation) => !(observation.kcId === 'KC08' && observation.observationId.endsWith('-1')),
      ),
    });
    expect(assessment.sufficient).toBe(false);
    expect(assessment.status).toBe(FOUNDATION_NOT_READY);
    expect(assessment.experimentalRunMayStart).toBe(false);
    expect(assessment.perKc.find((outcome) => outcome.kcId === 'KC08')?.correct).toBe(1);
  });

  /**
   * §5.2.1 literal: cuenta para autonomía/viabilidad y como límite descriptivo,
   * pero **no** como resultado negativo de una transición A/B/C. Contarlo así
   * convertiría una preparación incompleta en evidencia contra la intervención.
   */
  it('foundation_not_ready no es un resultado negativo de A/B/C', () => {
    const assessment = assessFoundationPhase(input({ observations: [] }));
    expect(assessment.status).toBe(FOUNDATION_NOT_READY);
    expect(assessment.countsForAutonomyAndViability).toBe(true);
    expect(assessment.countsAsNegativeAbcTransition).toBe(false);
  });

  it('no mezcla sus resultados con probe_accuracy ni entra en la inferencia SCED', () => {
    const assessment = assessFoundationPhase(input());
    expect(assessment.metricNamespace).toBe('foundation_phase');
    expect(assessment.entersScedCausalInference).toBe(false);
  });

  it('rechaza enseñanza humana de fundamentos', () => {
    const base = input();
    expectCode(
      () => assessFoundationPhase({
        ...base,
        observations: base.observations.map((observation, index) =>
          index === 0 ? { ...observation, taughtBy: 'human' as const } : observation,
        ),
      }),
      'FOUNDATION_HUMAN_TEACHING_PROHIBITED',
    );
  });

  it('rechaza una observación que cite material no declarado o de otro KC', () => {
    const base = input();
    expectCode(
      () => assessFoundationPhase({
        ...base,
        observations: [{ ...base.observations[0]!, materialId: 'material-inexistente' }],
      }),
      'FOUNDATION_INPUT_INVALID',
    );
    expectCode(
      () => assessFoundationPhase({
        ...base,
        observations: [{ ...base.observations[0]!, materialId: 'material-KC02' }],
      }),
      'FOUNDATION_KC_NOT_FOUNDATION',
    );
  });
});

describe('T-H6-12 — el criterio es preinscrito, no cableado', () => {
  it('una corrida material exige un criterio material y no acepta un fixture', () => {
    expect(assertFoundationCriterionPreregistered(CRITERION, 'test_fixture')).toEqual(CRITERION);
    expectCode(
      () => assertFoundationCriterionPreregistered(CRITERION, 'material'),
      'FOUNDATION_CRITERION_NOT_PREINSCRIBED',
    );
  });

  it('exige procedencia de preinscripción', () => {
    const withoutRef = Object.fromEntries(
      Object.entries(CRITERION).filter(([key]) => key !== 'preregistrationRef'),
    );
    expectCode(
      () => assertFoundationCriterionPreregistered(withoutRef, 'test_fixture'),
      'FOUNDATION_CRITERION_NOT_PREINSCRIBED',
    );
  });

  it('rechaza un criterio que exija más aciertos de los que permite intentar', () => {
    expectCode(
      () => assertFoundationCriterionPreregistered(
        { ...CRITERION, requiredCorrectPerKc: 5, maximumOpportunitiesPerKc: 4 },
        'test_fixture',
      ),
      'FOUNDATION_CRITERION_NOT_PREINSCRIBED',
    );
  });
});
