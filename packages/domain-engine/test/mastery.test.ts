import { CAL09_FROZEN_MANIFEST } from '@profesor-ia/proof-search';
import { describe, expect, it } from 'vitest';
import {
  CAL09_DOMAIN_BINDING,
  DOMAIN_POLICY_V1,
  DeterministicDomainController,
  DomainEngineError,
  DomainPolicyRunRegistry,
  compileDomainPolicy,
  createDomainPolicyDefinition,
  evaluateAttemptEligibility,
  masteryDisqualifying,
  masteryEligibilityAuthorization,
  operationalMasteryProjection,
  type DomainEngineErrorCode,
  type DomainKcState,
} from '../src/index.js';

const OTHER_HASH = 'b'.repeat(64);

function at(sequence: number): string {
  return new Date(Date.UTC(2026, 7, 16, 12, 0, sequence)).toISOString();
}

function initialized() {
  return {
    eventId: 'domain-event-0',
    eventType: 'domain.initialized',
    sequenceNumber: 0,
    occurredAt: at(0),
    payload: { runId: 'run-1', participantPseudoId: 'participant-pseudo-1', kcId: 'KC04' },
  } as const;
}

function commonAttempt(sequence: number) {
  return {
    attemptId: `attempt-${sequence}`,
    itemId: `item-${sequence}`,
    itemFamilyId: `family-${sequence}`,
    mode: 'LEARNING_MODE' as const,
    outcome: 'correct' as const,
    complexityIndex: sequence * 10,
    complexityCalibrationVersion: 'cal-09-v1' as const,
    complexityCalibrationSampleHash: CAL09_DOMAIN_BINDING.sampleHash,
    hints: [],
  };
}

function practice(sequence: number, overrides: Record<string, unknown> = {}) {
  return {
    eventId: `domain-event-${sequence}`,
    eventType: 'domain.attempt.observed',
    sequenceNumber: sequence,
    occurredAt: at(sequence),
    payload: {
      ...commonAttempt(sequence),
      activityKind: 'practice',
      reserve: 'independent_practice',
      ...overrides,
    },
  };
}

function transfer(sequence: number, overrides: Record<string, unknown> = {}) {
  return {
    eventId: `domain-event-${sequence}`,
    eventType: 'domain.attempt.observed',
    sequenceNumber: sequence,
    occurredAt: at(sequence),
    payload: {
      ...commonAttempt(sequence),
      activityKind: 'near_transfer',
      reserve: 'TRANSFER_MASTERY',
      nonIsomorphismEvidence: {
        authority: 'isomorphism_canonicalizer',
        canonicalizerVersion: 'test-fixture-v1',
        evidenceHash: 'c'.repeat(64),
        comparedImmediatePracticeItemIds: ['practice-item-fixture'],
        nonIsomorphic: true,
      },
      ...overrides,
    },
  };
}

function assistedReconfirmation(
  sequence: number,
  reconfirmsAttemptId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    eventId: `domain-event-${sequence}`,
    eventType: 'domain.attempt.observed',
    sequenceNumber: sequence,
    occurredAt: at(sequence),
    payload: {
      ...commonAttempt(sequence),
      activityKind: 'assisted_success_reconfirmation',
      reserve: 'independent_practice',
      reconfirmsAttemptId,
      ...overrides,
    },
  };
}

function opportunity(sequence: number, overrides: Record<string, unknown> = {}) {
  return {
    eventId: `domain-event-${sequence}`,
    eventType: 'domain.reconfirmation.opportunity.available',
    sequenceNumber: sequence,
    occurredAt: at(sequence),
    payload: {
      opportunityId: `opportunity-${sequence}`,
      itemId: `post-item-${sequence}`,
      mode: 'LEARNING_MODE',
      activityKind: 'independent_practice',
      reserve: 'independent_practice',
      available: true,
      ...overrides,
    },
  };
}

function postMasteryAttempt(sequence: number, overrides: Record<string, unknown> = {}) {
  return {
    eventId: `domain-event-${sequence}`,
    eventType: 'domain.attempt.observed',
    sequenceNumber: sequence,
    occurredAt: at(sequence),
    payload: {
      ...commonAttempt(sequence),
      attemptId: `post-attempt-${sequence}`,
      itemId: `post-item-${sequence - 1}`,
      activityKind: 'post_mastery_reconfirmation',
      reserve: 'independent_practice',
      opportunityId: `opportunity-${sequence - 1}`,
      ...overrides,
    },
  };
}

function expectCode(action: () => unknown, code: DomainEngineErrorCode): void {
  try {
    action();
    throw new Error(`se esperaba ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(DomainEngineError);
    expect(error).toMatchObject({ code });
  }
}

function boundController(
  registry = new DomainPolicyRunRegistry(),
): DeterministicDomainController {
  const expectedHash = compileDomainPolicy(DOMAIN_POLICY_V1).policyHash;
  const controller = new DeterministicDomainController(DOMAIN_POLICY_V1, {
    expectedHash,
    registry,
  });
  controller.bindRun({
    runId: 'run-1',
    purpose: 'material',
    policyVersion: DOMAIN_POLICY_V1.policyVersion,
    policyHash: expectedHash,
  });
  return controller;
}

function apply(
  controller: DeterministicDomainController,
  state: DomainKcState | null,
  event: unknown,
): DomainKcState {
  return controller.applyEvent(state, event).state;
}

function masteredState(controller = boundController()): DomainKcState {
  return controller.replay([initialized(), practice(1), practice(2), transfer(3)]);
}

describe('política de dominio congelada', () => {
  it('usa la identidad material de CAL-09 sin recalibrarla', () => {
    expect(CAL09_DOMAIN_BINDING).toEqual({
      parameterId: CAL09_FROZEN_MANIFEST.calibrationId,
      version: CAL09_FROZEN_MANIFEST.version,
      sampleHash: CAL09_FROZEN_MANIFEST.sampleHash,
      profileVersion: CAL09_FROZEN_MANIFEST.profileVersion,
      authorizedCalculusVersion: CAL09_FROZEN_MANIFEST.authorizedCalculusVersion,
      verifierVersion: CAL09_FROZEN_MANIFEST.verifierVersion,
    });
    expect(DOMAIN_POLICY_V1).toMatchObject({
      correctConsecutiveRequired: 3,
      complexityOrder: 'non_decreasing',
      nearTransferRequired: true,
      bktAuthoritative: false,
    });
  });

  it('hash canónico reproducible y freeze material externo obligatorio', () => {
    const first = compileDomainPolicy(DOMAIN_POLICY_V1);
    const second = compileDomainPolicy(structuredClone(DOMAIN_POLICY_V1));
    expect(first.policyHash).toBe(second.policyHash);
    expect(Object.isFrozen(first.definition)).toBe(true);
    expectCode(
      () => new DeterministicDomainController(DOMAIN_POLICY_V1),
      'MATERIAL_FREEZE_REQUIRED',
    );
    expectCode(
      () => new DeterministicDomainController(DOMAIN_POLICY_V1, { expectedHash: OTHER_HASH }),
      'DOMAIN_POLICY_HASH_MISMATCH',
    );
  });

  it('congela runId→versión/hash y restaura bindings sin reasignación', () => {
    const first = boundController();
    const restoredRegistry = new DomainPolicyRunRegistry(
      JSON.parse(JSON.stringify(first.registry.bindings())) as unknown[],
    );
    const expectedHash = compileDomainPolicy(DOMAIN_POLICY_V1).policyHash;
    const restored = new DeterministicDomainController(DOMAIN_POLICY_V1, {
      expectedHash,
      registry: restoredRegistry,
    });
    expect(restored.applyEvent(null, initialized()).state.runId).toBe('run-1');

    const other = createDomainPolicyDefinition({
      policyVersion: 'domain-policy-other',
      purpose: 'material',
    });
    const otherCompiled = compileDomainPolicy(other);
    expectCode(
      () => restoredRegistry.bind(otherCompiled, {
        runId: 'run-1',
        purpose: 'material',
        policyVersion: other.policyVersion,
        policyHash: otherCompiled.policyHash,
      }),
      'RUN_POLICY_DRIFT',
    );
  });
});

describe('autoridad de ayuda y elegibilidad', () => {
  const reminder = {
    level: 1 as const,
    levelOneReminderOnly: true,
    selectsRuleOrNextStep: false,
    containsDecisiveContent: false,
  };

  it('nivel 1 solo conserva elegibilidad bajo la regla cerrada', () => {
    expect(masteryDisqualifying(reminder)).toBe(false);
    expect(masteryDisqualifying({ ...reminder, levelOneReminderOnly: false })).toBe(true);
    expect(masteryDisqualifying({ ...reminder, selectsRuleOrNextStep: true })).toBe(true);
    expect(masteryDisqualifying({ ...reminder, containsDecisiveContent: true })).toBe(true);
  });

  it('niveles 2–5 descalifican sin importar la etiqueta del generador', () => {
    for (const level of [2, 3, 4, 5] as const) {
      expect(masteryDisqualifying({ ...reminder, level })).toBe(true);
    }
    const controller = boundController();
    expectCode(
      () => controller.applyEvent(null, {
        ...initialized(),
        modelProposedMasteryDisqualifying: false,
      }),
      'INVALID_DOMAIN_EVENT',
    );
  });

  it('modo de medición, falta/invalidación y reserva de medición no son elegibles', () => {
    const policy = DOMAIN_POLICY_V1;
    expect(evaluateAttemptEligibility(
      { ...commonAttempt(1), activityKind: 'practice', reserve: 'independent_practice', mode: 'MEASUREMENT_MODE' },
      policy,
    )).toMatchObject({ eligible: false, reasonCode: 'MEASUREMENT_MODE' });
    expect(evaluateAttemptEligibility(
      { ...commonAttempt(1), activityKind: 'practice', reserve: 'independent_practice', outcome: 'missing' },
      policy,
    )).toMatchObject({ eligible: false, reasonCode: 'INVALID_OR_MISSING' });
    expect(evaluateAttemptEligibility(
      {
        ...commonAttempt(1), activityKind: 'near_transfer', reserve: 'TRANSFER_MEASUREMENT',
        nonIsomorphismEvidence: {
          authority: 'isomorphism_canonicalizer', canonicalizerVersion: 'test-fixture-v1',
          evidenceHash: 'c'.repeat(64), comparedImmediatePracticeItemIds: ['practice-item'],
          nonIsomorphic: true,
        },
      },
      policy,
    )).toMatchObject({ eligible: false, reasonCode: 'TRANSFER_WRONG_RESERVE' });
  });

  it('transferencia isomorfa no satisface dominio', () => {
    const result = evaluateAttemptEligibility({
      ...commonAttempt(1),
      activityKind: 'near_transfer',
      reserve: 'TRANSFER_MASTERY',
      nonIsomorphismEvidence: {
        authority: 'isomorphism_canonicalizer', canonicalizerVersion: 'test-fixture-v1',
        evidenceHash: 'c'.repeat(64), comparedImmediatePracticeItemIds: ['practice-item'],
        nonIsomorphic: false,
      },
    }, DOMAIN_POLICY_V1);
    expect(result).toMatchObject({ eligible: false, reasonCode: 'TRANSFER_ISOMORPHIC' });
  });

  it('rechaza índice producido con otra identidad CAL-09', () => {
    expectCode(
      () => evaluateAttemptEligibility({
        ...commonAttempt(1),
        activityKind: 'practice',
        reserve: 'independent_practice',
        complexityCalibrationSampleHash: OTHER_HASH,
      }, DOMAIN_POLICY_V1),
      'CALIBRATION_MISMATCH',
    );
  });
});

describe('regla literal de dominio', () => {
  it('declara dominio con tres correctas elegibles no decrecientes y transferencia', () => {
    const state = masteredState();
    expect(state.masteryStatus).toBe('mastered');
    expect(state.masteryDeclaration).toMatchObject({
      consecutiveAttemptIds: ['attempt-1', 'attempt-2', 'attempt-3'],
      nearTransferAttemptId: 'attempt-3',
      complexityCalibrationVersion: 'cal-09-v1',
    });
    expect(state.postMasteryReconfirmation).toMatchObject({ status: 'pending' });
  });

  it('tres correctas sin transferencia no declaran dominio', () => {
    const controller = boundController();
    const state = controller.replay([initialized(), practice(1), practice(2), practice(3)]);
    expect(state.masteryStatus).toBe('not_mastered');
    expect(state.eligibleCorrectStreak).toHaveLength(3);
    expect(state.eligibleNearTransferAttemptId).toBeNull();
  });

  it('una complejidad decreciente reinicia la racha desde ese intento', () => {
    const controller = boundController();
    const state = controller.replay([
      initialized(),
      practice(1, { complexityIndex: 10 }),
      practice(2, { complexityIndex: 30 }),
      practice(3, { complexityIndex: 20 }),
    ]);
    expect(state.eligibleCorrectStreak.map((entry) => entry.complexityIndex)).toEqual([20]);
    expect(state.masteryStatus).toBe('not_mastered');
  });

  it('una respuesta incorrecta elegible rompe la racha', () => {
    const controller = boundController();
    const state = controller.replay([
      initialized(),
      practice(1),
      practice(2, { outcome: 'incorrect' }),
    ]);
    expect(state.eligibleCorrectStreak).toEqual([]);
    expect(state.attemptEvaluations.at(-1)).toMatchObject({ eligible: true, outcome: 'incorrect' });
  });

  it('un intento inválido o descalificado no cuenta ni se convierte en fallo de KC', () => {
    const levelTwo = {
      level: 2,
      levelOneReminderOnly: false,
      selectsRuleOrNextStep: true,
      containsDecisiveContent: false,
    };
    const controller = boundController();
    const state = controller.replay([
      initialized(),
      practice(1),
      practice(2, { outcome: 'invalid' }),
      practice(3, { hints: [levelTwo] }),
      practice(4, { complexityIndex: 20 }),
      transfer(5, { complexityIndex: 30 }),
    ]);
    expect(state.masteryStatus).toBe('mastered');
    expect(state.masteryDeclaration?.consecutiveAttemptIds).toEqual([
      'attempt-1', 'attempt-4', 'attempt-5',
    ]);
    expect(state.assistedSuccesses).toContainEqual({
      assistedAttemptId: 'attempt-3',
      status: 'pending',
      reconfirmationAttemptId: null,
    });
  });

  it('un acierto asistido solo aporta evidencia mediante reconfirmación posterior sin ayuda', () => {
    const levelThree = {
      level: 3,
      levelOneReminderOnly: false,
      selectsRuleOrNextStep: true,
      containsDecisiveContent: true,
    };
    const controller = boundController();
    let state = apply(controller, null, initialized());
    state = apply(controller, state, practice(1, { hints: [levelThree] }));
    expect(state.eligibleCorrectStreak).toHaveLength(0);
    expect(state.assistedSuccesses[0]?.status).toBe('pending');

    state = apply(controller, state, assistedReconfirmation(2, 'attempt-1'));
    expect(state.assistedSuccesses[0]).toEqual({
      assistedAttemptId: 'attempt-1',
      status: 'confirmed',
      reconfirmationAttemptId: 'attempt-2',
    });
    expect(state.eligibleCorrectStreak.map((entry) => entry.attemptId)).toEqual(['attempt-2']);
  });

  it('una reconfirmación incorrecta registra el fallo y una referencia desconocida se rechaza', () => {
    const levelTwo = {
      level: 2,
      levelOneReminderOnly: false,
      selectsRuleOrNextStep: true,
      containsDecisiveContent: false,
    };
    const controller = boundController();
    let state = apply(controller, null, initialized());
    state = apply(controller, state, practice(1, { hints: [levelTwo] }));
    state = apply(
      controller,
      state,
      assistedReconfirmation(2, 'attempt-1', { outcome: 'incorrect' }),
    );
    expect(state.assistedSuccesses[0]?.status).toBe('incorrect');
    expect(state.eligibleCorrectStreak).toHaveLength(0);
    expectCode(
      () => controller.applyEvent(state, assistedReconfirmation(3, 'unknown-attempt')),
      'INVALID_RECONFIRMATION',
    );
  });
});

describe('reconfirmación post-dominio', () => {
  it('programa automáticamente la primera oportunidad elegible', () => {
    const controller = boundController();
    let state = masteredState(controller);
    state = apply(controller, state, opportunity(4, { mode: 'MEASUREMENT_MODE' }));
    expect(state.postMasteryReconfirmation.status).toBe('pending');
    state = apply(controller, state, opportunity(5, { reserve: 'guided_practice' }));
    expect(state.postMasteryReconfirmation.status).toBe('pending');
    state = apply(controller, state, opportunity(6));
    expect(state.postMasteryReconfirmation).toEqual({
      status: 'scheduled',
      declarationId: state.masteryDeclaration?.declarationId,
      opportunityId: 'opportunity-6',
      itemId: 'post-item-6',
      scheduledAt: at(6),
      reserve: 'independent_practice',
    });
    const afterLater = apply(controller, state, opportunity(7));
    expect(afterLater.postMasteryReconfirmation).toEqual(state.postMasteryReconfirmation);
  });

  it('no permite consumir práctica independiente sin usarla como primera reconfirmación', () => {
    const controller = boundController();
    const state = masteredState(controller);
    expectCode(
      () => controller.applyEvent(state, practice(4)),
      'RECONFIRMATION_ORDER_VIOLATION',
    );
  });

  it('bloquea reenseñanza y la siguiente sesión objetivo mientras siga pendiente', () => {
    const controller = boundController();
    const state = masteredState(controller);
    expectCode(
      () => controller.applyEvent(state, {
        eventId: 'domain-event-4',
        eventType: 'domain.deliberate_reteaching.started',
        sequenceNumber: 4,
        occurredAt: at(4),
        payload: { reasonCode: 'RECOVERY' },
      }),
      'RECONFIRMATION_ORDER_VIOLATION',
    );
    expectCode(
      () => controller.applyEvent(state, {
        eventId: 'domain-event-4',
        eventType: 'domain.target_session.started',
        sequenceNumber: 4,
        occurredAt: at(4),
        payload: { sessionId: 'next-session' },
      }),
      'RECONFIRMATION_ORDER_VIOLATION',
    );
  });

  it('una reconfirmación correcta observada conserva dominio', () => {
    const controller = boundController();
    let state = masteredState(controller);
    state = apply(controller, state, opportunity(4));
    state = apply(controller, state, postMasteryAttempt(5));
    expect(state.postMasteryReconfirmation).toMatchObject({
      status: 'observed',
      attemptId: 'post-attempt-5',
      correct: true,
    });
    expect(state.masteryStatus).toBe('mastered');
  });

  it('una reconfirmación incorrecta observada marca falso dominio operativo', () => {
    const controller = boundController();
    let state = masteredState(controller);
    state = apply(controller, state, opportunity(4));
    state = apply(controller, state, postMasteryAttempt(5, { outcome: 'incorrect' }));
    expect(state.postMasteryReconfirmation).toMatchObject({ status: 'observed', correct: false });
    expect(state.masteryStatus).toBe('reconfirmation_failed');
    expect(operationalMasteryProjection(state).mastered).toBe(false);
  });

  it('tras falso dominio puede reunir evidencia nueva y cada declaración crea otro pendiente', () => {
    const controller = boundController();
    let state = masteredState(controller);
    state = apply(controller, state, opportunity(4));
    state = apply(controller, state, postMasteryAttempt(5, { outcome: 'incorrect' }));
    state = apply(controller, state, practice(6, { complexityIndex: 10 }));
    state = apply(controller, state, practice(7, { complexityIndex: 20 }));
    state = apply(controller, state, transfer(8, { complexityIndex: 30 }));

    expect(state.masteryStatus).toBe('mastered');
    expect(state.masteryDeclarations).toHaveLength(2);
    expect(state.masteryDeclaration?.declarationId).toContain(':8');
    expect(state.postMasteryHistory).toEqual([
      expect.objectContaining({ status: 'observed', correct: false }),
    ]);
    expect(state.postMasteryReconfirmation).toMatchObject({
      status: 'pending',
      declarationId: state.masteryDeclaration?.declarationId,
    });
  });

  it('retirada, cierre, incidente o ausencia válida son missing, no falso dominio', () => {
    for (const reason of ['withdrawal', 'run_closed', 'incident', 'valid_reserve_absence'] as const) {
      const controller = boundController();
      const mastered = masteredState(controller);
      const state = apply(controller, mastered, {
        eventId: 'domain-event-4',
        eventType: 'domain.reconfirmation.missing',
        sequenceNumber: 4,
        occurredAt: at(4),
        payload: { reason },
      });
      expect(state.postMasteryReconfirmation).toMatchObject({ status: 'missing', reason });
      expect(state.masteryStatus).toBe('mastered');
      expect(operationalMasteryProjection(state).mastered).toBe(true);
    }
  });

  it('rechaza resultado que no corresponde a la oportunidad programada', () => {
    const controller = boundController();
    let state = masteredState(controller);
    state = apply(controller, state, opportunity(4));
    expectCode(
      () => controller.applyEvent(state, postMasteryAttempt(5, { itemId: 'different-item' })),
      'INVALID_RECONFIRMATION',
    );
    expectCode(
      () => controller.applyEvent(state, postMasteryAttempt(5, { reserve: 'TRANSFER_MEASUREMENT' })),
      'INVALID_RECONFIRMATION',
    );
  });
});

describe('replay, orden y proyección', () => {
  it('replay reproduce el mismo estado que la aplicación directa', () => {
    const controller = boundController();
    const events = [initialized(), practice(1), practice(2), transfer(3), opportunity(4)];
    const replayed = controller.replay(events);
    let direct: DomainKcState | null = null;
    for (const event of events) direct = controller.applyEvent(direct, event).state;
    expect(replayed).toEqual(direct);
    expect(Object.isFrozen(replayed)).toBe(true);
  });

  it('rechaza huecos, eventos repetidos, tiempo regresivo e inicialización fuera de orden', () => {
    const controller = boundController();
    const state = apply(controller, null, initialized());
    expectCode(() => controller.applyEvent(state, practice(2)), 'INVALID_EVENT_SEQUENCE');
    const once = apply(controller, state, practice(1));
    expectCode(
      () => controller.applyEvent(once, { ...practice(2), eventId: 'domain-event-1' }),
      'INVALID_EVENT_SEQUENCE',
    );
    expectCode(
      () => controller.applyEvent(once, { ...practice(2), occurredAt: at(0) }),
      'INVALID_EVENT_SEQUENCE',
    );
    expectCode(() => controller.applyEvent(state, initialized()), 'INVALID_EVENT_SEQUENCE');
  });

  it('la proyección coincide con el contrato estructurado de sesión', () => {
    const state = masteredState();
    expect(operationalMasteryProjection(state)).toEqual({
      mastered: true,
      eligibleConsecutiveCorrect: 3,
      highestEligibleComplexityIndex: 30,
      nearTransferSatisfied: true,
      reconfirmationPending: true,
      lastChangedAt: at(3),
    });
    expect(masteryEligibilityAuthorization(state, 'attempt-3')).toEqual({
      authority: 'domain_engine',
      eligible: true,
      reasonCode: 'ELIGIBLE',
    });
    expectCode(
      () => masteryEligibilityAuthorization(state, 'unknown-attempt'),
      'INVALID_DOMAIN_EVENT',
    );
  });

  it('esquemas estrictos rechazan BKT, propuesta de modelo y propiedades no autorizadas', () => {
    const controller = boundController();
    const state = masteredState(controller);
    expectCode(
      () => operationalMasteryProjection({ ...state, masteryProbabilityShadow: 0.9 }),
      'INVALID_DOMAIN_EVENT',
    );
    expectCode(
      () => controller.applyEvent(apply(controller, null, initialized()), practice(1, {
        proposedMasteryEligibleByModel: true,
      })),
      'INVALID_DOMAIN_EVENT',
    );
    expectCode(
      () => controller.applyEvent(
        apply(controller, null, initialized()),
        transfer(1, {
          nonIsomorphismEvidence: undefined,
          nonIsomorphicToImmediatePractices: true,
        }),
      ),
      'INVALID_DOMAIN_EVENT',
    );
  });
});
