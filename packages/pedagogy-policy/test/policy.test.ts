import { describe, expect, it } from 'vitest';
import {
  DeterministicPedagogyPolicy,
  PEDAGOGY_BASE_PATTERNS,
  PEDAGOGY_DECISION_HIERARCHY,
  PEDAGOGY_POLICY_V1_PENDING_CALIBRATION,
  PedagogyPolicyError,
  PedagogyPolicyRunRegistry,
  compilePedagogyPolicy,
  createPedagogyPolicyDefinition,
  pedagogyPolicyIdentity,
  representedDecisionStrategies,
  type PedagogyDecisionContext,
  type PedagogyPolicyDefinition,
  type PedagogyPolicyErrorCode,
} from '../src/index.js';

const TEST_CALIBRATION_HASH = 'a'.repeat(64);
const SECOND_POLICY_HASH = 'b'.repeat(64);

function testDefinition(policyVersion = 'pedagogy-policy-test-v1'): PedagogyPolicyDefinition {
  return createPedagogyPolicyDefinition({
    policyVersion,
    purpose: 'test_fixture',
    wheelSpinningCalibration: {
      parameterId: 'CAL-10',
      registryAlias: 'CAL-WHEEL',
      status: 'test_fixture',
      calibrationVersion: 'cal-wheel-test-fixture-v1',
      artifactHash: TEST_CALIBRATION_HASH,
      threshold: {
        eligibleAttemptWindow: 3,
        minimumUnsuccessfulEligibleAttempts: 2,
      },
    },
  });
}

function baseContext(
  overrides: Partial<PedagogyDecisionContext> = {},
): PedagogyDecisionContext {
  return {
    runId: 'run-test-1',
    mode: 'LEARNING_MODE',
    kcId: 'KC04',
    kcType: 'procedural',
    currentStrategy: null,
    currentAssistanceLevel: 0,
    masteryEligibility: {
      authority: 'domain_engine',
      eligible: false,
      reasonCode: 'NOT_AN_ELIGIBLE_ATTEMPT',
    },
    patternPosition: {
      patternId: 'new_procedural_kc',
      stepId: 'brief_explanation',
    },
    observations: {
      securityBlocked: false,
      integrityBlocked: false,
      noRevelationRisk: false,
      blockingPrerequisite: false,
      masteryRecoveryRequired: false,
      partialDifficulty: false,
      repeatedSameError: false,
      helpDependence: false,
    },
    selfExplanationTrigger: null,
    retrieval: { requested: false },
    fading: { requested: false },
    wheelSpinning: { requested: false },
    ...overrides,
  };
}

function boundEngine(
  definition: PedagogyPolicyDefinition = testDefinition(),
  registry = new PedagogyPolicyRunRegistry(),
): DeterministicPedagogyPolicy {
  const engine = definition.purpose === 'material'
    ? new DeterministicPedagogyPolicy(definition, {
        registry,
        expectedHash: compilePedagogyPolicy(definition).policyHash,
      })
    : new DeterministicPedagogyPolicy(definition, { registry });
  engine.bindRun({
    runId: 'run-test-1',
    purpose: definition.purpose,
    policyVersion: definition.policyVersion,
    policyHash: engine.compiled.policyHash,
  });
  return engine;
}

function mutableClone<T>(value: T): T {
  return structuredClone(value);
}

function expectPolicyCode(action: () => unknown, code: PedagogyPolicyErrorCode): void {
  try {
    action();
    throw new Error(`se esperaba ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(PedagogyPolicyError);
    expect(error).toMatchObject({ code });
  }
}

describe('artefacto de política determinista', () => {
  it('conserva la jerarquía literal y los cinco patrones base', () => {
    expect(PEDAGOGY_DECISION_HIERARCHY).toEqual([
      'security_integrity_mode_no_revelation',
      'blocking_prerequisites',
      'mastery_and_recovery',
      'strategy_by_kc_and_observable_state',
      'linguistic_visual_adaptation_within_selected_strategy',
    ]);
    expect(PEDAGOGY_BASE_PATTERNS.map((pattern) => pattern.patternId)).toEqual([
      'new_procedural_kc',
      'partial_difficulty',
      'repeated_same_error',
      'prerequisite_failure',
      'apparent_mastery_or_help_dependence',
    ]);
  });

  it('representa exactamente las diez estrategias del contrato', () => {
    const represented = representedDecisionStrategies(testDefinition());
    expect(represented).toEqual([
      'completion_problem',
      'direct_explanation',
      'guided_practice',
      'independent_practice',
      'near_transfer',
      'prerequisite_remediation',
      'retrieval',
      'scaffolding',
      'self_explanation',
      'worked_example',
    ]);
  });

  it('calcula un hash canónico reproducible y congela recursivamente', () => {
    const first = compilePedagogyPolicy(testDefinition());
    const second = compilePedagogyPolicy(testDefinition());

    expect(first.policyHash).toBe(second.policyHash);
    expect(first.policyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.definition.transitionRules)).toBe(true);
    expect(Object.isFrozen(first.definition.transitionRules[0])).toBe(true);
    expect(pedagogyPolicyIdentity(first)).toEqual({
      artifactId: 'pedagogy-policy',
      version: 'pedagogy-policy-test-v1',
      hash: first.policyHash,
    });
  });

  it('detecta deriva de contenido u orden contra el hash congelado', () => {
    const original = compilePedagogyPolicy(testDefinition());
    const reordered = mutableClone(testDefinition());
    reordered.transitionRules.reverse();

    expectPolicyCode(
      () => compilePedagogyPolicy(reordered, original.policyHash),
      'POLICY_HASH_MISMATCH',
    );
  });

  it('rechaza prioridades ambiguas dentro del mismo nivel', () => {
    const ambiguous = mutableClone(testDefinition());
    const firstLevelOne = ambiguous.transitionRules[0];
    const secondLevelOne = ambiguous.transitionRules[1];
    expect(firstLevelOne).toBeDefined();
    expect(secondLevelOne).toBeDefined();
    if (firstLevelOne !== undefined && secondLevelOne !== undefined) {
      secondLevelOne.priority = firstLevelOne.priority;
    }

    expectPolicyCode(() => compilePedagogyPolicy(ambiguous), 'AMBIGUOUS_TRANSITION_TABLE');
  });

  it('prohíbe que el nivel 5 cambie ruta o estrategia', () => {
    const invalid = mutableClone(testDefinition());
    const rule = invalid.transitionRules.find((candidate) => candidate.hierarchyLevel === 4);
    expect(rule).toBeDefined();
    if (rule !== undefined) rule.hierarchyLevel = 5;

    expectPolicyCode(() => compilePedagogyPolicy(invalid), 'INVALID_POLICY');
  });

  it('no admite una calibración de prueba como evidencia material', () => {
    const invalid = mutableClone(testDefinition());
    invalid.purpose = 'material';

    expectPolicyCode(() => compilePedagogyPolicy(invalid), 'TEST_FIXTURE_FORBIDDEN');
  });

  it('rechaza pérdida de una estrategia o deriva de los patrones normativos', () => {
    const missingStrategy = mutableClone(testDefinition());
    missingStrategy.transitionRules = missingStrategy.transitionRules.filter(
      (rule) => !(rule.effect.kind === 'decision' && rule.effect.strategy === 'retrieval'),
    );
    expectPolicyCode(() => compilePedagogyPolicy(missingStrategy), 'INVALID_POLICY');

    const changedPattern = mutableClone(testDefinition());
    const firstPattern = changedPattern.basePatterns[0];
    expect(firstPattern).toBeDefined();
    firstPattern?.steps.reverse();
    expectPolicyCode(() => compilePedagogyPolicy(changedPattern), 'INVALID_POLICY');
  });
});

describe('freeze de política por corrida', () => {
  it('una política material exige el hash externo del paquete congelado', () => {
    expectPolicyCode(
      () => new DeterministicPedagogyPolicy(PEDAGOGY_POLICY_V1_PENDING_CALIBRATION),
      'MATERIAL_FREEZE_REQUIRED',
    );
    expectPolicyCode(
      () => new DeterministicPedagogyPolicy(PEDAGOGY_POLICY_V1_PENDING_CALIBRATION, {
        expectedHash: SECOND_POLICY_HASH,
      }),
      'POLICY_HASH_MISMATCH',
    );
  });

  it('exige binding previo y acepta el mismo binding de forma idempotente', () => {
    const definition = testDefinition();
    const engine = new DeterministicPedagogyPolicy(definition);
    expectPolicyCode(() => engine.decide(baseContext()), 'RUN_NOT_BOUND');

    const binding = {
      runId: 'run-test-1',
      purpose: 'test_fixture' as const,
      policyVersion: definition.policyVersion,
      policyHash: engine.compiled.policyHash,
    };
    expect(engine.bindRun(binding)).toEqual(binding);
    expect(engine.bindRun(binding)).toBe(engine.registry.bindingFor('run-test-1'));
  });

  it('rechaza hash declarado incorrecto y reasignación de una corrida', () => {
    const registry = new PedagogyPolicyRunRegistry();
    const first = boundEngine(testDefinition('policy-a'), registry);
    expectPolicyCode(
      () => first.bindRun({
        runId: 'run-other',
        purpose: 'test_fixture',
        policyVersion: 'policy-a',
        policyHash: SECOND_POLICY_HASH,
      }),
      'RUN_POLICY_DRIFT',
    );

    const secondDefinition = testDefinition('policy-b');
    const second = new DeterministicPedagogyPolicy(secondDefinition, { registry });
    expectPolicyCode(
      () => second.bindRun({
        runId: 'run-test-1',
        purpose: 'test_fixture',
        policyVersion: 'policy-b',
        policyHash: second.compiled.policyHash,
      }),
      'RUN_POLICY_DRIFT',
    );
  });

  it('restaura el binding persistido y detecta duplicados contradictorios', () => {
    const first = boundEngine();
    const persisted = JSON.parse(JSON.stringify(first.registry.bindings())) as unknown[];
    const restoredRegistry = new PedagogyPolicyRunRegistry(persisted);
    const restored = new DeterministicPedagogyPolicy(testDefinition(), {
      registry: restoredRegistry,
    });

    expect(restored.decide(baseContext())).toMatchObject({ kind: 'decision' });
    expectPolicyCode(
      () => new PedagogyPolicyRunRegistry([
        ...persisted,
        { ...persisted[0] as Record<string, unknown>, policyHash: SECOND_POLICY_HASH },
      ]),
      'RUN_POLICY_DRIFT',
    );
  });
});

describe('jerarquía y contrato PedagogicalDecision', () => {
  it('suprime toda pedagogía en MEASUREMENT_MODE antes de evaluar ayudas', () => {
    const engine = boundEngine(PEDAGOGY_POLICY_V1_PENDING_CALIBRATION);
    const outcome = engine.decide(baseContext({
      mode: 'MEASUREMENT_MODE',
      runId: 'run-test-1',
      retrieval: {
        requested: true,
        authority: 'model',
        due: false,
        kcIntroduced: false,
        reserveKind: 'measurement',
      },
      wheelSpinning: { requested: true, attempts: [], diagnosticReview: {
        practiceGranularityExamined: false,
        strategyExamined: false,
        assistanceLevelExamined: false,
        persistentErrorExamined: false,
        prerequisitesExamined: false,
      } },
    }));

    expect(outcome).toMatchObject({
      kind: 'suppressed',
      hierarchyLevel: 1,
      reasonCode: 'MEASUREMENT_MODE_PEDAGOGY_SUPPRESSED',
    });
    expect('decision' in outcome).toBe(false);
  });

  it('seguridad precede prerrequisitos, recuperación y selección de estrategia', () => {
    const engine = boundEngine();
    const outcome = engine.decide(baseContext({
      observations: {
        ...baseContext().observations,
        securityBlocked: true,
        blockingPrerequisite: true,
        masteryRecoveryRequired: true,
      },
      retrieval: {
        requested: true,
        authority: 'model',
        due: false,
        kcIntroduced: false,
        reserveKind: 'measurement',
      },
    }));

    expect(outcome).toMatchObject({
      kind: 'suppressed',
      hierarchyLevel: 1,
      ruleId: 'guard.security',
    });
  });

  it('prerrequisito bloqueante precede recuperación y estrategia por patrón', () => {
    const engine = boundEngine(PEDAGOGY_POLICY_V1_PENDING_CALIBRATION);
    const outcome = engine.decide(baseContext({
      observations: {
        ...baseContext().observations,
        blockingPrerequisite: true,
        masteryRecoveryRequired: true,
      },
      wheelSpinning: { requested: true, attempts: [], diagnosticReview: {
        practiceGranularityExamined: false,
        strategyExamined: false,
        assistanceLevelExamined: false,
        persistentErrorExamined: false,
        prerequisitesExamined: false,
      } },
    }));

    expect(outcome).toMatchObject({
      kind: 'decision',
      hierarchyLevel: 2,
      decision: { strategy: 'prerequisite_remediation' },
    });
  });

  it('produce el contrato literal de cinco campos para una transición de patrón', () => {
    const engine = boundEngine();
    const outcome = engine.decide(baseContext());
    expect(outcome.kind).toBe('decision');
    if (outcome.kind !== 'decision') return;

    expect(outcome.decision).toEqual({
      mode: 'LEARNING_MODE',
      strategy: 'direct_explanation',
      assistanceLevel: 2,
      masteryEligible: false,
      reasonCode: 'NEW_PROCEDURAL_KC_EXPLANATION',
    });
    expect(Object.keys(outcome.decision).sort()).toEqual([
      'assistanceLevel',
      'masteryEligible',
      'mode',
      'reasonCode',
      'strategy',
    ]);
  });

  it('la tabla solo permite elegibilidad si domain-engine la autoriza', () => {
    const engine = boundEngine();
    const independent = {
      patternPosition: { patternId: 'new_procedural_kc', stepId: 'independent_practice' },
    } as const;

    const denied = engine.decide(baseContext(independent));
    expect(denied).toMatchObject({
      kind: 'decision',
      decision: { strategy: 'independent_practice', masteryEligible: false },
      masteryEligibilityReasonCode: 'NOT_AN_ELIGIBLE_ATTEMPT',
    });

    const authorized = engine.decide(baseContext({
      ...independent,
      masteryEligibility: {
        authority: 'domain_engine',
        eligible: true,
        reasonCode: 'DOMAIN_ENGINE_ELIGIBLE',
      },
    }));
    expect(authorized).toMatchObject({
      kind: 'decision',
      decision: { strategy: 'independent_practice', masteryEligible: true },
    });

    expectPolicyCode(
      () => engine.decide({
        ...baseContext(independent),
        masteryEligibility: { authority: 'model', eligible: true, reasonCode: 'MODEL_SAYS_SO' },
      }),
      'INVALID_CONTEXT',
    );
  });

  it('la misma entrada produce la misma salida y no muta la entrada', () => {
    const engine = boundEngine();
    const context = baseContext();
    const before = structuredClone(context);
    const first = engine.decide(context);
    const second = engine.decide(context);

    expect(first).toEqual(second);
    expect(context).toEqual(before);
    expect(Object.isFrozen(first)).toBe(true);
    if (first.kind === 'decision') expect(Object.isFrozen(first.decision)).toBe(true);
  });

  it('rechaza campos de modelo o texto no autorizados y falla si no hay transición', () => {
    const engine = boundEngine();
    expectPolicyCode(
      () => engine.decide({ ...baseContext(), modelProposal: { strategy: 'worked_example' } }),
      'INVALID_CONTEXT',
    );
    expectPolicyCode(
      () => engine.decide(baseContext({ patternPosition: null, kcType: 'declarative' })),
      'NO_TRANSITION',
    );
  });

  it('feedback correctivo acompaña una estrategia sin inventar un enum', () => {
    const engine = boundEngine();
    const outcome = engine.decide(baseContext({
      patternPosition: { patternId: 'repeated_same_error', stepId: 'specific_feedback' },
      observations: { ...baseContext().observations, repeatedSameError: true },
    }));

    expect(outcome).toMatchObject({
      kind: 'decision',
      correctiveFeedbackRequired: true,
      decision: { strategy: 'guided_practice' },
    });
  });
});

describe('controles especiales bajo código', () => {
  it('fading por desempeño reduce ayuda y solo habilita dominio al llegar a cero', () => {
    const engine = boundEngine();
    const context = baseContext({
      currentStrategy: 'guided_practice',
      currentAssistanceLevel: 1,
      masteryEligibility: {
        authority: 'domain_engine',
        eligible: true,
        reasonCode: 'DOMAIN_ENGINE_ELIGIBLE',
      },
      patternPosition: { patternId: 'partial_difficulty', stepId: 'performance_fading' },
      fading: { requested: true, trigger: { kind: 'performance', performanceImproved: true } },
    });
    const outcome = engine.decide(context);

    expect(outcome).toMatchObject({
      kind: 'decision',
      policyAction: 'fading',
      decision: {
        strategy: 'guided_practice',
        assistanceLevel: 0,
        masteryEligible: true,
      },
    });
  });

  it('fading automático o fijo sin validación expresa falla cerrado', () => {
    const engine = boundEngine();
    const patternPosition = { patternId: 'partial_difficulty', stepId: 'performance_fading' } as const;
    expectPolicyCode(
      () => engine.decide(baseContext({
        currentStrategy: 'guided_practice',
        currentAssistanceLevel: 1,
        patternPosition,
        fading: { requested: true, trigger: { kind: 'performance', performanceImproved: false } },
      })),
      'INVALID_SPECIAL_AUTHORIZATION',
    );
    expectPolicyCode(
      () => engine.decide(baseContext({
        currentStrategy: 'guided_practice',
        currentAssistanceLevel: 1,
        patternPosition,
        fading: { requested: true, trigger: { kind: 'fixed', preRegistration: {
          artifactId: 'sced-plan', version: 'v1', hash: SECOND_POLICY_HASH,
          expresslyValidated: false,
        } } },
      })),
      'INVALID_SPECIAL_AUTHORIZATION',
    );
  });

  it('la excepción fija solo funciona con evidencia preinscrita y validada', () => {
    const engine = boundEngine();
    const outcome = engine.decide(baseContext({
      currentStrategy: 'scaffolding',
      currentAssistanceLevel: 2,
      patternPosition: { patternId: 'partial_difficulty', stepId: 'performance_fading' },
      fading: { requested: true, trigger: { kind: 'fixed', preRegistration: {
        artifactId: 'sced-plan', version: 'v1', hash: SECOND_POLICY_HASH,
        expresslyValidated: true,
      } } },
    }));

    expect(outcome).toMatchObject({
      kind: 'decision',
      policyAction: 'fading',
      decision: { assistanceLevel: 1, masteryEligible: false },
    });
  });

  it('autoexplicación solo se activa con uno de los tres disparadores selectivos', () => {
    const engine = boundEngine();
    const outcome = engine.decide(baseContext({
      patternPosition: { patternId: 'repeated_same_error', stepId: 'guided_self_explanation' },
      observations: { ...baseContext().observations, repeatedSameError: true },
      selfExplanationTrigger: 'after_persistent_error',
    }));
    expect(outcome).toMatchObject({
      kind: 'decision',
      decision: { strategy: 'self_explanation' },
    });

    expectPolicyCode(
      () => engine.decide(baseContext({
        patternPosition: { patternId: 'repeated_same_error', stepId: 'guided_self_explanation' },
        observations: { ...baseContext().observations, repeatedSameError: true },
      })),
      'NO_TRANSITION',
    );
  });

  it('retrieval solo se autoriza por motor/calendario, tras introducción y fuera de reserva', () => {
    const engine = boundEngine();
    const outcome = engine.decide(baseContext({
      patternPosition: null,
      retrieval: {
        requested: true,
        authority: 'engine_calendar',
        due: true,
        kcIntroduced: true,
        reserveKind: 'practice',
      },
    }));
    expect(outcome).toMatchObject({
      kind: 'decision',
      decision: { strategy: 'retrieval', masteryEligible: false },
    });

    for (const retrieval of [
      { requested: true, authority: 'model', due: true, kcIntroduced: true, reserveKind: 'practice' },
      { requested: true, authority: 'engine_calendar', due: true, kcIntroduced: false, reserveKind: 'practice' },
      { requested: true, authority: 'engine_calendar', due: true, kcIntroduced: true, reserveKind: 'measurement' },
    ] as const) {
      expectPolicyCode(
        () => engine.decide(baseContext({ patternPosition: null, retrieval })),
        'INVALID_SPECIAL_AUTHORIZATION',
      );
    }
  });
});

describe('CAL-10 / CAL-WHEEL sin simulación material', () => {
  const completeReview = {
    practiceGranularityExamined: true,
    strategyExamined: true,
    assistanceLevelExamined: true,
    persistentErrorExamined: true,
    prerequisitesExamined: true,
  } as const;
  const attempts = [
    { attemptId: 'a1', sequenceNumber: 1, kcId: 'KC04', eligible: true, correct: false },
    { attemptId: 'a2', sequenceNumber: 2, kcId: 'KC04', eligible: true, correct: true },
    { attemptId: 'a3', sequenceNumber: 3, kcId: 'KC04', eligible: true, correct: false },
  ] as const;

  it('la política material pendiente falla cerrado al solicitar detección', () => {
    const engine = boundEngine(PEDAGOGY_POLICY_V1_PENDING_CALIBRATION);
    expectPolicyCode(
      () => engine.decide(baseContext({
        wheelSpinning: { requested: true, attempts: [...attempts], diagnosticReview: completeReview },
      })),
      'CALIBRATION_REQUIRED',
    );
  });

  it('un fixture prueba la mecánica sin presentarse como calibración material', () => {
    const engine = boundEngine();
    const outcome = engine.decide(baseContext({
      wheelSpinning: { requested: true, attempts: [...attempts], diagnosticReview: completeReview },
    }));

    expect(outcome).toMatchObject({
      kind: 'decision',
      hierarchyLevel: 3,
      ruleId: 'recovery.wheel_spinning',
      decision: { strategy: 'scaffolding', masteryEligible: false },
      wheelSpinning: {
        active: true,
        reasonCode: 'WHEEL_SPINNING_DETECTED',
        evidenceStatus: 'test_fixture',
        calibrationArtifactHash: TEST_CALIBRATION_HASH,
      },
    });
  });

  it('el umbral no activa la ruta hasta revisar las cinco dimensiones', () => {
    const engine = boundEngine();
    const outcome = engine.decide(baseContext({
      wheelSpinning: {
        requested: true,
        attempts: [...attempts],
        diagnosticReview: { ...completeReview, prerequisitesExamined: false },
      },
    }));

    expect(outcome).toMatchObject({
      kind: 'decision',
      hierarchyLevel: 4,
      decision: { strategy: 'direct_explanation' },
      wheelSpinning: { active: false, reasonCode: 'WHEEL_REVIEW_INCOMPLETE' },
    });
  });

  it('rechaza intentos duplicados en la ventana calibrada', () => {
    const engine = boundEngine();
    expectPolicyCode(
      () => engine.decide(baseContext({
        wheelSpinning: {
          requested: true,
          attempts: [attempts[0], { ...attempts[1], sequenceNumber: 1 }],
          diagnosticReview: completeReview,
        },
      })),
      'INVALID_CONTEXT',
    );
  });
});
