import { describe, expect, it } from 'vitest';
import { SESSION_STATES, SESSION_TRANSVERSAL_STATES } from '@profesor-ia/contracts';
import {
  CAL09_BINDING_VERSION,
  CAL09_DOMAIN_BINDING,
  DOMAIN_POLICY_V1,
  DeterministicDomainController,
  DeterministicHintController,
  DeterministicRecoveryController,
  HINT_BANK_SCHEMA_VERSION,
  HINT_LEVELS,
  RECOVERY_GRAPH_SCHEMA_VERSION,
  compileDomainPolicy,
  createHintPolicyDefinition,
  createRecoveryPolicyDefinition,
  hintValidatedContentHash,
  masteryDisqualifying,
} from '@profesor-ia/domain-engine';
import { classifyDoubt } from '@profesor-ia/pedagogy-policy';

import {
  SESSION_BKT_SHADOW_ENABLED,
  SESSION_STATE_GENESIS,
  SESSION_STATE_SCHEMA_VERSION,
  MeasurementSessionIntent,
  SessionStateMachineError,
  applySessionStateEvent,
  changeTransversalSessionState,
  enterMeasurementModeForProbe,
  exitMeasurementModeFromProbeResult,
  initializeSessionState,
  projectMeasurementControlEffect,
  replaySessionStateEvents,
  restoreSessionStateSnapshot,
  sessionStateHash,
  toSessionStatePersistenceRow,
  transitionPrimarySessionState,
  updateSessionFromDomainState,
  updateSessionFromDoubtClassification,
  updateSessionFromHintState,
  updateSessionFromRecoveryState,
  updateSessionProjection,
  type SessionDecisionMetadata,
  type SessionMutation,
  type SessionSnapshot,
  type SessionStateEvent,
} from '../src/index.js';

const AT = '2026-08-16T12:00:00.000Z';

function at(second: number): string {
  return `2026-08-16T12:00:${String(second).padStart(2, '0')}.000Z`;
}

function metadata(
  eventId: string,
  second: number,
  overrides: Partial<SessionDecisionMetadata> = {},
): SessionDecisionMetadata {
  return {
    eventId,
    occurredAt: at(second),
    decisionMaker: 'engine',
    autonomyStatus: 'autonomous',
    ...overrides,
  };
}

function initialized(sessionId = 'session-fixture-1'): SessionMutation {
  return initializeSessionState(
    {
      sessionId,
      runId: 'run-fixture-1',
      participantPseudoId: 'pseudo-fixture-1',
      courseId: 'course-fixture-1',
      packageVersion: {
        artifactId: 'content-package-fixture',
        version: 'fixture-v1',
        hash: 'a'.repeat(64),
      },
      plannedDurationSeconds: 3_600,
    },
    { eventId: `event-${sessionId}-0`, occurredAt: AT },
  );
}

function hintController(): DeterministicHintController {
  const policy = createHintPolicyDefinition({
    policyVersion: 'hint-session-test-v1',
    purpose: 'test_fixture',
  });
  const entries = HINT_LEVELS.map((level) => {
    const analogousExampleEvidence = level === 4
      ? {
          authority: 'isomorphism_canonicalizer' as const,
          canonicalizerVersion: 'canonicalizer-session-test-v1',
          evidenceHash: 'b'.repeat(64),
          nonIsomorphic: true as const,
        }
      : null;
    const text = `Pista de sesión nivel ${level}`;
    const anchors = [`fragment-session-${level}`];
    const facts = {
      level,
      levelOneReminderOnly: level === 1,
      selectsRuleOrNextStep: level === 2 || level === 3,
      containsDecisiveContent: false,
    };
    const hintId = `hint-session-${level}`;
    const itemId = 'item-session-hints';
    const kcId = 'KC03';
    return {
      hintId,
      itemId,
      kcId,
      level,
      text,
      anchors,
      facts,
      proposedMasteryDisqualifying: masteryDisqualifying(facts),
      nonRevelationEvidence: {
        authority: 'authoring_hint_validator' as const,
        validatorVersion: 'authoring-session-test-v1',
        validatedContentHash: hintValidatedContentHash({
          hintId,
          itemId,
          kcId,
          level,
          text,
          anchors,
          facts,
          analogousExampleEvidence,
        }),
        literalLeakCheckPassed: true as const,
        detectionScope: 'literal_not_paraphrase' as const,
        paraphraseAuditRequired: true as const,
        anchorsValidated: true as const,
        solutionSeparated: true as const,
      },
      analogousExampleEvidence,
    };
  });
  const value = new DeterministicHintController(policy, {
    schemaVersion: HINT_BANK_SCHEMA_VERSION,
    bankVersion: 'hint-bank-session-test-v1',
    purpose: 'test_fixture',
    packageVersion: {
      artifactId: 'content-package-fixture',
      version: 'fixture-v1',
      hash: 'a'.repeat(64),
    },
    authoringPipelineVersion: 'authoring-session-test-v1',
    supportedLevels: [1, 2, 3, 4, 5],
    entries,
  });
  value.bindRun({
    runId: 'run-fixture-1',
    purpose: 'test_fixture',
    policyVersion: value.policy.definition.policyVersion,
    policyHash: value.policy.policyHash,
    bankVersion: value.bank.definition.bankVersion,
    bankHash: value.bank.bankHash,
    packageVersion: value.bank.definition.packageVersion,
  });
  return value;
}

function fullProjection(current: SessionSnapshot): SessionMutation {
  return updateSessionProjection(
    current,
    {
      currentBlock: { blockId: 'block-1', objectiveId: 'objective-1' },
      timing: {
        plannedDurationSeconds: 3_600,
        elapsedSeconds: 120,
        startedAt: AT,
        endedAt: null,
      },
      activeKcIds: ['KC03'],
      operationalMastery: {
        KC03: {
          mastered: false,
          eligibleConsecutiveCorrect: 1,
          highestEligibleComplexityIndex: 1,
          nearTransferSatisfied: false,
          reconfirmationPending: false,
          lastChangedAt: at(1),
        },
      },
      pedagogicalMode: 'LEARNING_MODE',
      selectedStrategy: 'guided_practice',
      assistanceLevel: 1,
      masteryEligibility: true,
      scaffoldingStage: 'scaffolding',
      observedErrors: [
        {
          observationId: 'error-observation-1',
          attemptId: 'attempt-1',
          kcId: 'KC03',
          classification: 'notation',
          errorCode: 'notation-parentheses',
          observedAt: at(1),
        },
      ],
      assistanceByAttempt: [
        {
          attemptId: 'attempt-1',
          hintLevelsUsed: [1],
          maximumHintLevel: 1,
          masteryDisqualifying: false,
        },
      ],
      attemptMasteryEligibility: [
        { attemptId: 'attempt-1', kcId: 'KC03', eligible: true, reasonCode: 'eligible-no-decisive-help' },
      ],
      nearTransfer: {
        KC03: { status: 'pending', attemptId: null, updatedAt: at(1) },
      },
      practiceSchedule: {
        KC03: { lastPracticeAt: at(1), nextReviewAt: at(30) },
      },
      wheelSpinning: {
        active: true,
        kcIds: ['KC03'],
        thresholdVersion: 'cal-wheel-test-fixture-v1',
      },
      consumedActivityIds: ['activity-1'],
      pendingDoubts: [{ doubtId: 'doubt-1', artifactRef: 'artifact-doubt-1', raisedAt: at(1) }],
      planChanges: [
        {
          changeId: 'change-1',
          description: 'Añadir una comprobación estructurada',
          reasonCode: 'observed-notation-error',
          occurredAt: at(1),
        },
      ],
      incidents: [
        {
          incidentId: 'incident-1',
          taxonomyCode: 'interface-focus-lost',
          scope: 'localized',
          status: 'resolved',
          occurredAt: at(1),
        },
      ],
      nextSteps: [
        {
          stepId: 'next-1',
          action: 'Comprobar alcance de subprueba',
          targetId: 'KC03',
          plannedAt: null,
        },
      ],
    },
    'projection-fixture-populated',
    metadata('event-projection-1', 2),
  );
}

function expectCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error('se esperaba SessionStateMachineError');
  } catch (error) {
    expect(error).toBeInstanceOf(SessionStateMachineError);
    expect((error as SessionStateMachineError).code).toBe(code);
  }
}

describe('estado estructurado de sesión (T-H6-01)', () => {
  it('inicializa una proyección completa y deja BKT fuera', () => {
    const result = initialized();
    const { state } = result.snapshot;

    expect(SESSION_STATE_SCHEMA_VERSION).toBe('session-state-v1');
    expect(SESSION_BKT_SHADOW_ENABLED).toBe(false);
    expect(result.event.previousStateHash).toBe(SESSION_STATE_GENESIS);
    expect(result.event.sequenceNumber).toBe(0);
    expect(state.primaryState).toBe('preparada');
    expect(state.pedagogicalMode).toBe('LEARNING_MODE');
    expect(state.selectedStrategy).toBeNull();
    expect(state.masteryEligibility).toBe(false);
    expect(state.wheelSpinning).toEqual({ active: false, kcIds: [], thresholdVersion: null });
    expect(state).not.toHaveProperty('masteryProbabilityShadow');
    expect(Object.isFrozen(state)).toBe(true);
    expect(sessionStateHash(state)).toBe(result.snapshot.projectionHash);
  });

  it('materializa todos los campos de P-I §8.2 y registra autonomía automáticamente', () => {
    const result = fullProjection(initialized().snapshot);

    expect(result.snapshot.state).toMatchObject({
      currentBlock: { blockId: 'block-1' },
      activeKcIds: ['KC03'],
      selectedStrategy: 'guided_practice',
      assistanceLevel: 1,
      masteryEligibility: true,
      scaffoldingStage: 'scaffolding',
      consumedActivityIds: ['activity-1'],
    });
    expect(result.snapshot.state.operationalMastery.KC03?.eligibleConsecutiveCorrect).toBe(1);
    expect(result.snapshot.state.observedErrors).toHaveLength(1);
    expect(result.snapshot.state.assistanceByAttempt[0]?.maximumHintLevel).toBe(1);
    expect(result.snapshot.state.attemptMasteryEligibility[0]?.eligible).toBe(true);
    expect(result.snapshot.state.nearTransfer.KC03?.status).toBe('pending');
    expect(result.snapshot.state.practiceSchedule.KC03?.nextReviewAt).toBe(at(30));
    expect(result.snapshot.state.pendingDoubts).toHaveLength(1);
    expect(result.snapshot.state.planChanges).toHaveLength(1);
    expect(result.snapshot.state.incidents).toHaveLength(1);
    expect(result.snapshot.state.nextSteps).toHaveLength(1);
    expect(result.snapshot.state.decisionAutonomy).toEqual([
      {
        decisionId: 'event-projection-1',
        decisionType: 'session.projection.updated',
        decisionMaker: 'engine',
        autonomyStatus: 'autonomous',
        reasonCode: 'projection-fixture-populated',
        occurredAt: at(2),
      },
    ]);
  });

  it('recorre únicamente la secuencia primaria literal hasta cierre', () => {
    const events: SessionStateEvent[] = [initialized().event];
    let current = initialized().snapshot;

    for (const [index, state] of SESSION_STATES.slice(1).entries()) {
      const result = transitionPrimarySessionState(
        current,
        state,
        `advance-${state}`,
        metadata(`event-primary-${index + 1}`, index + 1),
      );
      current = result.snapshot;
      events.push(result.event);
    }

    expect(current.state.primaryState).toBe('cierre');
    expect(current.state.revision).toBe(8);
    expect(current.state.decisionAutonomy).toHaveLength(8);
    expect(replaySessionStateEvents(events)).toEqual(current);
    expectCode(
      () => transitionPrimarySessionState(current, 'cierre', 'repeat-close', metadata('event-9', 9)),
      'INVALID_TRANSITION',
    );
  });

  it('rechaza saltos, retrocesos y una declaración from adulterada', () => {
    const initial = initialized();
    expectCode(
      () =>
        transitionPrimarySessionState(
          initial.snapshot,
          'consentimiento_confirmado',
          'skip-auth',
          metadata('event-skip', 1),
        ),
      'INVALID_TRANSITION',
    );

    const valid = transitionPrimarySessionState(
      initial.snapshot,
      'autenticacion',
      'start-auth',
      metadata('event-auth', 1),
    );
    const tampered = {
      ...valid.event,
      payload: { ...valid.event.payload, from: 'diagnostico' },
    };
    expectCode(() => applySessionStateEvent(initial.snapshot, tampered), 'INVALID_TRANSITION');
  });

  it('mantiene los ocho transversales separados y en orden canónico', () => {
    let current = initialized().snapshot;
    const activeInReverse = [...SESSION_TRANSVERSAL_STATES].reverse();
    for (const [index, state] of activeInReverse.entries()) {
      current = changeTransversalSessionState(
        current,
        state,
        true,
        `enter-${state}`,
        metadata(`event-transversal-${index}`, index + 1),
      ).snapshot;
    }
    expect(current.state.primaryState).toBe('preparada');
    expect(current.state.transverseStates).toEqual(SESSION_TRANSVERSAL_STATES);

    const withoutPause = changeTransversalSessionState(
      current,
      'pausa',
      false,
      'resume',
      metadata('event-resume', 9),
    ).snapshot;
    expect(withoutPause.state.transverseStates).not.toContain('pausa');
    expectCode(
      () =>
        changeTransversalSessionState(
          withoutPause,
          'pausa',
          false,
          'duplicate-resume',
          metadata('event-resume-2', 10),
        ),
      'INVALID_TRANSITION',
    );
  });

  it('hace atómica la separación de MEASUREMENT_MODE', () => {
    const learning = fullProjection(initialized().snapshot).snapshot;
    expect(() =>
      updateSessionProjection(
        learning,
        { pedagogicalMode: 'MEASUREMENT_MODE' },
        'bad-mode-entry',
        metadata('event-bad-mode', 3),
      ),
    ).toThrow();

    const measurement = updateSessionProjection(
      learning,
      {
        pedagogicalMode: 'MEASUREMENT_MODE',
        selectedStrategy: null,
        assistanceLevel: 0,
        masteryEligibility: false,
        scaffoldingStage: 'none',
      },
      'measurement-mode-entry',
      metadata('event-mode', 3),
    );
    expect(measurement.snapshot.state).toMatchObject({
      pedagogicalMode: 'MEASUREMENT_MODE',
      selectedStrategy: null,
      assistanceLevel: 0,
      masteryEligibility: false,
    });
  });

  it('rechaza masteryProbabilityShadow en updates, inicialización y restauración', () => {
    const initial = initialized();
    expectCode(
      () =>
        updateSessionProjection(
          initial.snapshot,
          { masteryProbabilityShadow: 0.7 } as never,
          'invented-bkt',
          metadata('event-bkt', 1),
        ),
      'BKT_SHADOW_DISABLED',
    );
    expectCode(
      () =>
        initializeSessionState(
          {
            sessionId: 's',
            runId: 'r',
            participantPseudoId: 'p',
            courseId: 'c',
            packageVersion: { artifactId: 'pkg', version: 'v' },
            plannedDurationSeconds: 10,
            masteryProbabilityShadow: 0.7,
          } as never,
          { eventId: 'e', occurredAt: AT },
        ),
      'BKT_SHADOW_DISABLED',
    );
    const row = toSessionStatePersistenceRow(initial.snapshot);
    expectCode(
      () =>
        restoreSessionStateSnapshot({
          ...row,
          structured_state: { ...(row.structured_state as object), masteryProbabilityShadow: 0.7 },
        }),
      'BKT_SHADOW_DISABLED',
    );
  });

  it('reconstruye exactamente una historia mixta desde sus eventos', () => {
    const initial = initialized();
    const projection = fullProjection(initial.snapshot);
    const pause = changeTransversalSessionState(
      projection.snapshot,
      'pausa',
      true,
      'participant-pause',
      metadata('event-pause', 3, { autonomyStatus: 'automatic-control' }),
    );
    const auth = transitionPrimarySessionState(
      pause.snapshot,
      'autenticacion',
      'authenticate',
      metadata('event-auth-after-pause', 4),
    );

    const replayed = replaySessionStateEvents([
      initial.event,
      projection.event,
      pause.event,
      auth.event,
    ]);
    expect(replayed).toEqual(auth.snapshot);
    expect(replayed.projectionHash).toBe(sessionStateHash(auth.snapshot.state));
  });

  it('detecta hash resultante, hash previo, huecos y tiempo regresivo', () => {
    const initial = initialized();
    const auth = transitionPrimarySessionState(
      initial.snapshot,
      'autenticacion',
      'authenticate',
      metadata('event-auth-integrity', 1),
    );
    expectCode(
      () => applySessionStateEvent(initial.snapshot, { ...auth.event, resultingStateHash: 'f'.repeat(64) }),
      'STATE_HASH_MISMATCH',
    );
    expectCode(
      () => applySessionStateEvent(initial.snapshot, { ...auth.event, previousStateHash: 'e'.repeat(64) }),
      'STATE_HASH_MISMATCH',
    );
    expectCode(
      () => applySessionStateEvent(initial.snapshot, { ...auth.event, sequenceNumber: 2 }),
      'INVALID_EVENT_SEQUENCE',
    );
    expectCode(
      () => applySessionStateEvent(initial.snapshot, { ...auth.event, occurredAt: '2026-08-16T11:59:59.000Z' }),
      'INVALID_EVENT_SEQUENCE',
    );
  });

  it('rechaza replay vacío, orden incorrecto y eventId duplicado', () => {
    expectCode(() => replaySessionStateEvents([]), 'INVALID_EVENT_SEQUENCE');
    const initial = initialized();
    const auth = transitionPrimarySessionState(
      initial.snapshot,
      'autenticacion',
      'authenticate',
      metadata('duplicate-event-id', 1),
    );
    expectCode(() => replaySessionStateEvents([auth.event, initial.event]), 'INVALID_EVENT_SEQUENCE');
    const pause = changeTransversalSessionState(
      auth.snapshot,
      'pausa',
      true,
      'pause',
      metadata('event-pause-unique', 2),
    );
    expectCode(
      () =>
        replaySessionStateEvents([
          initial.event,
          auth.event,
          { ...pause.event, eventId: 'duplicate-event-id' },
        ]),
      'INVALID_EVENT_SEQUENCE',
    );
  });

  it('impide que el modelo figure como decisor de una mutación autoritativa', () => {
    const initial = initialized();
    expect(() =>
      transitionPrimarySessionState(
        initial.snapshot,
        'autenticacion',
        'model-proposed-transition',
        metadata('event-model', 1, { decisionMaker: 'model' as never }),
      ),
    ).toThrow();
  });

  it('reserva al motor las transiciones primarias y transversales', () => {
    const initial = initialized();
    expectCode(
      () =>
        transitionPrimarySessionState(
          initial.snapshot,
          'autenticacion',
          'human-transition',
          metadata('event-human-primary', 1, { decisionMaker: 'human' }),
        ),
      'INVALID_TRANSITION',
    );
    expectCode(
      () =>
        changeTransversalSessionState(
          initial.snapshot,
          'pausa',
          true,
          'verifier-pause',
          metadata('event-verifier-transversal', 1, { decisionMaker: 'verifier' }),
        ),
      'INVALID_TRANSITION',
    );
  });

  it('rechaza snapshots modificados fuera de la historia', () => {
    const initial = initialized();
    const altered: SessionSnapshot = {
      state: { ...initial.snapshot.state, assistanceLevel: 1 },
      projectionHash: initial.snapshot.projectionHash,
    };
    expectCode(
      () =>
        transitionPrimarySessionState(
          altered,
          'autenticacion',
          'unrecorded-change',
          metadata('event-after-tamper', 1),
        ),
      'STATE_HASH_MISMATCH',
    );
  });

  it('el hash canónico no depende del orden de claves JSON', () => {
    const state = initialized().snapshot.state;
    const reversed = Object.fromEntries(Object.entries(state).reverse());
    expect(sessionStateHash(reversed)).toBe(sessionStateHash(state));
  });

  it('restaura la persistencia solo con JSON, hash y escalares coincidentes', () => {
    const current = fullProjection(initialized().snapshot).snapshot;
    const row = toSessionStatePersistenceRow(current);

    expect(restoreSessionStateSnapshot(row)).toEqual(current);
    expect(
      restoreSessionStateSnapshot({ ...row, structured_state: JSON.stringify(row.structured_state) }),
    ).toEqual(current);
    expectCode(
      () => restoreSessionStateSnapshot({ ...row, state: 'diagnostico' }),
      'PERSISTENCE_MISMATCH',
    );
    expectCode(
      () =>
        restoreSessionStateSnapshot({
          ...row,
          structured_state: { ...(row.structured_state as object), assistanceLevel: 2 },
        }),
      'STATE_HASH_MISMATCH',
    );
  });

  it('valida invariantes internas en vez de aceptar una proyección autodeclarada', () => {
    const initial = initialized();
    expect(() =>
      updateSessionProjection(
        initial.snapshot,
        {
          assistanceByAttempt: [
            {
              attemptId: 'attempt-bad',
              hintLevelsUsed: [2],
              maximumHintLevel: 1,
              masteryDisqualifying: false,
            },
          ],
        },
        'invalid-assistance',
        metadata('event-invalid-assistance', 1),
      ),
    ).toThrow();
    expect(() =>
      updateSessionProjection(
        initial.snapshot,
        {
          wheelSpinning: {
            active: true,
            kcIds: [],
            thresholdVersion: null,
          },
        },
        'invalid-wheel-signal',
        metadata('event-invalid-wheel', 1),
      ),
    ).toThrow();
  });

  it('integra la proyección autoritativa de domain-engine en el replay de sesión', () => {
    const policyHash = compileDomainPolicy(DOMAIN_POLICY_V1).policyHash;
    const controller = new DeterministicDomainController(DOMAIN_POLICY_V1, {
      expectedHash: policyHash,
    });
    controller.bindRun({
      runId: 'run-fixture-1',
      purpose: 'material',
      policyVersion: DOMAIN_POLICY_V1.policyVersion,
      policyHash,
    });
    const common = (sequenceNumber: number) => ({
      attemptId: `domain-attempt-${sequenceNumber}`,
      itemId: `domain-item-${sequenceNumber}`,
      itemFamilyId: `domain-family-${sequenceNumber}`,
      mode: 'LEARNING_MODE' as const,
      outcome: 'correct' as const,
      complexityIndex: sequenceNumber,
      complexityCalibrationVersion: CAL09_BINDING_VERSION,
      complexityCalibrationSampleHash: CAL09_DOMAIN_BINDING.sampleHash,
      hints: [],
    });
    const domainState = controller.replay([
      {
        eventId: 'domain-session-event-0',
        eventType: 'domain.initialized',
        sequenceNumber: 0,
        occurredAt: AT,
        payload: {
          runId: 'run-fixture-1',
          participantPseudoId: 'pseudo-fixture-1',
          kcId: 'KC03',
        },
      },
      {
        eventId: 'domain-session-event-1',
        eventType: 'domain.attempt.observed',
        sequenceNumber: 1,
        occurredAt: at(1),
        payload: { ...common(1), activityKind: 'practice', reserve: 'independent_practice' },
      },
      {
        eventId: 'domain-session-event-2',
        eventType: 'domain.attempt.observed',
        sequenceNumber: 2,
        occurredAt: at(2),
        payload: { ...common(2), activityKind: 'practice', reserve: 'independent_practice' },
      },
      {
        eventId: 'domain-session-event-3',
        eventType: 'domain.attempt.observed',
        sequenceNumber: 3,
        occurredAt: at(3),
        payload: {
          ...common(3),
          activityKind: 'near_transfer',
          reserve: 'TRANSFER_MASTERY',
          nonIsomorphismEvidence: {
            authority: 'isomorphism_canonicalizer',
            canonicalizerVersion: 'test-fixture-v1',
            evidenceHash: 'c'.repeat(64),
            comparedImmediatePracticeItemIds: ['domain-item-1', 'domain-item-2'],
            nonIsomorphic: true,
          },
        },
      },
    ]);
    const mutation = updateSessionFromDomainState(
      initialized().snapshot,
      domainState,
      'DOMAIN_STATE_PROJECTED',
      metadata('event-domain-projection', 4),
    );

    expect(mutation.snapshot.state.operationalMastery.KC03).toMatchObject({
      mastered: true,
      eligibleConsecutiveCorrect: 3,
      nearTransferSatisfied: true,
      reconfirmationPending: true,
    });
    expect(mutation.snapshot.state.attemptMasteryEligibility).toHaveLength(3);
    expect(mutation.snapshot.state.nearTransfer.KC03).toMatchObject({
      status: 'satisfied',
      attemptId: 'domain-attempt-3',
    });
    expect(mutation.snapshot.state.nextSteps).toContainEqual({
      stepId: 'post-mastery-reconfirmation:KC03',
      action: 'post_mastery_reconfirmation_pending',
      targetId: 'KC03',
      plannedAt: null,
    });
    expect(replaySessionStateEvents([
      initialized().event,
      mutation.event,
    ])).toEqual(mutation.snapshot);

    expectCode(
      () => updateSessionFromDomainState(
        initialized().snapshot,
        { ...domainState, runId: 'another-run' },
        'DOMAIN_STATE_PROJECTED',
        metadata('event-domain-mismatch', 4),
      ),
      'DOMAIN_PROJECTION_MISMATCH',
    );
  });

  it('integra pistas por intento sin aceptar la propuesta generativa como autoridad', () => {
    const hints = hintController();
    const hintEvents = [
      {
        eventId: 'hint-session-event-0',
        eventType: 'hints.initialized' as const,
        sequenceNumber: 0 as const,
        occurredAt: AT,
        payload: { runId: 'run-fixture-1', participantPseudoId: 'pseudo-fixture-1' },
      },
      {
        eventId: 'hint-session-event-1',
        eventType: 'hints.requested' as const,
        sequenceNumber: 1,
        occurredAt: at(1),
        payload: {
          requestId: 'hint-session-request-1',
          attemptId: 'attempt-session-hints',
          itemId: 'item-session-hints',
          mode: 'LEARNING_MODE' as const,
          authorizedAssistanceLevel: 1,
        },
      },
      {
        eventId: 'hint-session-event-2',
        eventType: 'hints.requested' as const,
        sequenceNumber: 2,
        occurredAt: at(2),
        payload: {
          requestId: 'hint-session-request-2',
          attemptId: 'attempt-session-hints',
          itemId: 'item-session-hints',
          mode: 'LEARNING_MODE' as const,
          authorizedAssistanceLevel: 3,
        },
      },
    ];
    const hintState = hints.replay(hintEvents);
    const initial = initialized();
    const projection = updateSessionFromHintState(
      initial.snapshot,
      hintState,
      'attempt-session-hints',
      'HINT_STATE_PROJECTED',
      metadata('event-hint-projection', 3),
    );

    expect(projection.snapshot.state.assistanceLevel).toBe(3);
    expect(projection.snapshot.state.masteryEligibility).toBe(false);
    expect(projection.snapshot.state.assistanceByAttempt).toEqual([{
      attemptId: 'attempt-session-hints',
      hintLevelsUsed: [1, 3],
      maximumHintLevel: 3,
      masteryDisqualifying: true,
    }]);
    expect(replaySessionStateEvents([initial.event, projection.event])).toEqual(projection.snapshot);
    expectCode(
      () => updateSessionFromHintState(
        initial.snapshot,
        { ...hintState, runId: 'another-run' },
        'attempt-session-hints',
        'HINT_STATE_PROJECTED',
        metadata('event-hint-mismatch', 3),
      ),
      'HINT_PROJECTION_MISMATCH',
    );
  });

  it('el motor sólo emite intención y entra/sale de MEASUREMENT_MODE por eventos', () => {
    const initial = initialized();
    const populated = fullProjection(initial.snapshot);
    const entry = enterMeasurementModeForProbe(
      populated.snapshot,
      { experimentalSet: 'A', phase: 'baseline', measureKind: 'primary_probe' },
      'MEASUREMENT_REQUESTED',
      metadata('event-measurement-entry', 3),
    );

    expect(entry.intent).toEqual({
      experimentalSet: 'A',
      phase: 'baseline',
      measureKind: 'primary_probe',
    });
    expect(entry.mutation.snapshot.state).toMatchObject({
      pedagogicalMode: 'MEASUREMENT_MODE',
      selectedStrategy: null,
      assistanceLevel: 0,
      masteryEligibility: false,
    });
    expect(entry.mutation.snapshot.state.nextSteps).toContainEqual({
      stepId: 'measurement-mode:event-measurement-entry',
      action: 'measurement_mode_active',
      targetId: 'A',
      plannedAt: null,
    });

    const exit = exitMeasurementModeFromProbeResult(
      entry.mutation.snapshot,
      {
        opportunityId: 'opportunity-session-measurement-1',
        probeRoundId: 'probe-round-session-1',
        plannedItems: 3,
        validScoredItems: 2,
        correctValidItems: 1,
        observation: 0.5,
        operationalValidity: 'valid',
        reasonCode: null,
      },
      'MEASUREMENT_RESULT_CONSUMED',
      metadata('event-measurement-exit', 4),
    );

    expect(exit.mutation.snapshot.state.pedagogicalMode).toBe('LEARNING_MODE');
    expect(exit.mutation.snapshot.state.nextSteps).not.toContainEqual(
      expect.objectContaining({ action: 'measurement_mode_active' }),
    );
    expect(exit.mutation.snapshot.state.planChanges.at(-1)?.description).toBe(
      'measurement:opportunity-session-measurement-1:valid:none',
    );
    expect(replaySessionStateEvents([
      initial.event,
      populated.event,
      entry.mutation.event,
      exit.mutation.event,
    ])).toEqual(exit.mutation.snapshot);
  });

  it('la intención rechaza ronda, item, semilla, tiempo y validez del motor', () => {
    const base = { experimentalSet: 'A', phase: 'baseline', measureKind: 'primary_probe' };
    for (const extra of [
      { probeRoundId: 'round-forzada' },
      { opportunityId: 'opportunity-forzada' },
      { itemId: 'item-forzado' },
      { seed: 'seed-forzada' },
      { timeLimitSeconds: 999 },
      { operationalValidity: 'valid' },
    ]) {
      expect(MeasurementSessionIntent.safeParse({ ...base, ...extra }).success).toBe(false);
    }
    expectCode(
      () => exitMeasurementModeFromProbeResult(
        initialized().snapshot,
        {
          opportunityId: 'o1',
          probeRoundId: null,
          plannedItems: 1,
          validScoredItems: 0,
          correctValidItems: 0,
          observation: null,
          operationalValidity: 'missing',
          reasonCode: 'withdrawal',
        },
        'MEASUREMENT_RESULT_CONSUMED',
        metadata('event-measurement-outside-mode', 1),
      ),
      'MEASUREMENT_PROJECTION_MISMATCH',
    );
  });

  it('proyecta pausa, duda e incidente del worker sin conceder autoridad pedagógica', () => {
    const initial = initialized();
    const populated = fullProjection(initial.snapshot);
    const entry = enterMeasurementModeForProbe(
      populated.snapshot,
      { experimentalSet: 'A', phase: 'baseline', measureKind: 'primary_probe' },
      'MEASUREMENT_REQUESTED',
      metadata('event-measurement-control-entry', 3),
    );
    const common = {
      runId: 'run-fixture-1',
      participantPseudoId: 'pseudo-fixture-1',
      opportunityId: 'opportunity-control-1',
      itemConsumedByEffect: false as const,
      immediateFeedbackProvided: false as const,
      pedagogicalResponseProvided: false as const,
      clockExtended: false as const,
    };
    const paused = projectMeasurementControlEffect(
      entry.mutation.snapshot,
      {
        ...common,
        effectId: 'worker-effect-pause',
        kind: 'pre_item_pause',
        probeInstanceId: null,
        occurredAt: at(4),
        reasonCode: null,
        opportunityClosed: false,
        runDisposition: 'paused',
        replacementDisposition: 'not_applicable',
      },
      'MEASUREMENT_PRE_ITEM_PAUSE',
      metadata('event-measurement-control-pause', 4),
    );
    expect(paused.mutation.snapshot.state.transverseStates).toContain('pausa');

    const resumed = projectMeasurementControlEffect(
      paused.mutation.snapshot,
      {
        ...common,
        effectId: 'worker-effect-resume',
        kind: 'pause_resumed',
        pauseEffectId: 'worker-effect-pause',
        probeInstanceId: null,
        occurredAt: at(5),
        reasonCode: null,
        opportunityClosed: false,
        runDisposition: 'active',
        replacementDisposition: 'not_applicable',
      },
      'MEASUREMENT_RESUMED',
      metadata('event-measurement-control-resume', 5),
    );
    expect(resumed.mutation.snapshot.state.transverseStates).not.toContain('pausa');

    const doubt = projectMeasurementControlEffect(
      resumed.mutation.snapshot,
      {
        ...common,
        effectId: 'worker-effect-doubt',
        kind: 'content_question',
        probeInstanceId: 'probe-control-1',
        responseKind: 'rights_or_procedure',
        deadlineBeforeQuestion: at(20),
        deadlineAfterQuestion: at(20),
        occurredAt: at(6),
        reasonCode: null,
        opportunityClosed: false,
        runDisposition: 'active',
        replacementDisposition: 'not_applicable',
      },
      'MEASUREMENT_CONTENT_QUESTION',
      metadata('event-measurement-control-doubt', 6),
    );
    expect(doubt.mutation.snapshot.state.transverseStates).toContain('duda');
    expect(doubt.mutation.snapshot.state.pendingDoubts).toContainEqual({
      doubtId: 'worker-effect-doubt',
      artifactRef: 'probe-control-1',
      raisedAt: at(6),
    });

    const incident = projectMeasurementControlEffect(
      doubt.mutation.snapshot,
      {
        ...common,
        effectId: 'worker-effect-incident',
        kind: 'incident',
        probeInstanceId: 'probe-control-1',
        occurredAt: at(7),
        incident: {
          incidentId: 'incident-control-1',
          incidentCode: 'fixture_localized',
          level: 2,
          action: 'invalidar_acto_o_bloque',
          detectedAt: at(7),
          affectedEventIds: ['probe-control-1'],
          invalidatedOpportunityIds: ['opportunity-control-1'],
        },
        scope: 'localized',
        reasonCode: 'incident',
        opportunityClosed: false,
        runDisposition: 'active',
        replacementDisposition: 'calendar_independent_only',
      },
      'MEASUREMENT_LOCALIZED_INCIDENT',
      metadata('event-measurement-control-incident', 7),
    );
    expect(incident.mutation.snapshot.state.transverseStates).toEqual(
      expect.arrayContaining(['duda', 'incidente', 'invalidacion']),
    );
    expect(incident.mutation.snapshot.state.incidents).toContainEqual({
      incidentId: 'incident-control-1',
      taxonomyCode: 'fixture_localized',
      scope: 'localized',
      status: 'open',
      occurredAt: at(7),
    });
    expect(incident.mutation.snapshot.state.planChanges.map((change) => change.changeId)).toEqual(
      expect.arrayContaining([
        'worker-effect-pause',
        'worker-effect-resume',
        'worker-effect-doubt',
        'worker-effect-incident',
      ]),
    );
    expect(replaySessionStateEvents([
      initial.event,
      populated.event,
      entry.mutation.event,
      paused.mutation.event,
      resumed.mutation.event,
      doubt.mutation.event,
      incident.mutation.event,
    ])).toEqual(incident.mutation.snapshot);

    expectCode(() => projectMeasurementControlEffect(
      entry.mutation.snapshot,
      {
        ...paused.effect,
        effectId: 'worker-effect-other-run',
        runId: 'another-run',
      },
      'MEASUREMENT_MISMATCH',
      metadata('event-measurement-control-mismatch', 4),
    ), 'MEASUREMENT_PROJECTION_MISMATCH');
    expectCode(() => projectMeasurementControlEffect(
      entry.mutation.snapshot,
      {
        ...paused.effect,
        effectId: 'worker-effect-before-session-state',
        occurredAt: at(2),
      },
      'MEASUREMENT_TIME_MISMATCH',
      metadata('event-measurement-control-time-mismatch', 4),
    ), 'MEASUREMENT_PROJECTION_MISMATCH');
    expectCode(() => projectMeasurementControlEffect(
      entry.mutation.snapshot,
      {
        ...paused.effect,
        effectId: 'worker-effect-after-projection',
        occurredAt: at(5),
      },
      'MEASUREMENT_TIME_MISMATCH',
      metadata('event-measurement-control-time-mismatch-future', 4),
    ), 'MEASUREMENT_PROJECTION_MISMATCH');
  });

  it('integra recuperación y límite como decisión reconstruible de sesión', () => {
    const recoveryPolicy = createRecoveryPolicyDefinition({
      policyVersion: 'recovery-session-test-v1',
      purpose: 'test_fixture',
    });
    const recovery = new DeterministicRecoveryController(recoveryPolicy, {
      schemaVersion: RECOVERY_GRAPH_SCHEMA_VERSION,
      graphVersion: 'recovery-session-graph-v1',
      purpose: 'test_fixture',
      kcIds: ['KC02', 'KC03'],
      edges: [{
        dependentKcId: 'KC03',
        prerequisiteKcId: 'KC02',
        dependencyType: 'FORMAL',
        blocksRoute: true,
      }],
    });
    recovery.bindRun({
      runId: 'run-fixture-1',
      purpose: 'test_fixture',
      policyVersion: recovery.policy.definition.policyVersion,
      policyHash: recovery.policy.policyHash,
      dependencyGraphVersion: recovery.graph.definition.graphVersion,
      dependencyGraphHash: recovery.graph.graphHash,
      recoveryInventoryVersion: 'recovery-inventory-fixture-v1',
      recoveryInventoryHash: 'd'.repeat(64),
    });
    const recoveryState = recovery.replay([
      {
        eventId: 'recovery-session-event-0',
        eventType: 'recovery.initialized',
        sequenceNumber: 0,
        occurredAt: AT,
        payload: { runId: 'run-fixture-1', participantPseudoId: 'pseudo-fixture-1' },
      },
      {
        eventId: 'recovery-session-event-1',
        eventType: 'recovery.in_block.started',
        sequenceNumber: 1,
        occurredAt: at(1),
        payload: {
          kcId: 'KC03',
          failureAttemptId: 'failed-attempt-session-1',
          failedItemId: 'failed-item-session-1',
          errorObservationId: 'error-session-1',
          errorCode: 'WRONG_RULE',
          failureAttribution: 'PEDAGOGICAL',
          mode: 'LEARNING_MODE',
        },
      },
    ]);
    const initial = initialized();
    const transverse = changeTransversalSessionState(
      initial.snapshot,
      'recuperacion',
      true,
      'RECOVERY_STARTED',
      metadata('event-recovery-transverse', 2),
    );
    const projection = updateSessionFromRecoveryState(
      transverse.snapshot,
      recoveryState,
      'KC03',
      'RECOVERY_STATE_PROJECTED',
      metadata('event-recovery-projection', 3),
    );

    expect(projection.snapshot.state.transverseStates).toContain('recuperacion');
    expect(projection.snapshot.state.selectedStrategy).toBe('guided_practice');
    expect(projection.snapshot.state.assistanceLevel).toBe(2);
    expect(projection.snapshot.state.scaffoldingStage).toBe('scaffolding');
    expect(projection.snapshot.state.masteryEligibility).toBe(false);
    expect(projection.snapshot.state.nextSteps).toContainEqual({
      stepId: 'recovery:KC03',
      action: 'execute_recovery_cycle_1',
      targetId: 'KC03',
      plannedAt: null,
    });
    expect(replaySessionStateEvents([
      initial.event,
      transverse.event,
      projection.event,
    ])).toEqual(projection.snapshot);
    expectCode(
      () => updateSessionFromRecoveryState(
        transverse.snapshot,
        { ...recoveryState, runId: 'another-run' },
        'KC03',
        'RECOVERY_STATE_PROJECTED',
        metadata('event-recovery-mismatch', 3),
      ),
      'RECOVERY_PROJECTION_MISMATCH',
    );
  });
});

describe('T-H6-10 — el motor aplica la clasificación de dudas', () => {
  function doubtFacts(overrides: Record<string, unknown> = {}) {
    return {
      doubtId: 'doubt-session-1',
      occurredAt: at(4),
      pedagogicalMode: 'LEARNING_MODE' as const,
      safetyBlocked: false,
      blockingPrerequisiteKcIds: [] as string[],
      resolvedFragmentIds: ['fragment-session-1'],
      fragmentIdsInCurrentBlock: ['fragment-session-1'],
      anchorSufficient: true,
      scorableActivityOpen: false,
      ...overrides,
    };
  }

  it('deja pendiente la duda diferida con su alcance y la reconstruye por replay', () => {
    const initial = initialized();
    const outcome = classifyDoubt(doubtFacts({ fragmentIdsInCurrentBlock: [] }));
    const projection = updateSessionFromDoubtClassification(
      initial.snapshot,
      outcome,
      'DOUBT_CLASSIFIED',
      metadata('event-doubt-later', 4),
    );

    expect(projection.snapshot.state.pendingDoubts).toEqual([
      { doubtId: 'doubt-session-1', scope: 'later_in_unit', raisedAt: at(4) },
    ]);
    expect(replaySessionStateEvents([initial.event, projection.event])).toEqual(projection.snapshot);
  });

  /** Clasificar no es resolver: una duda del bloque sigue pendiente hasta responderse. */
  it('deja pendiente también la duda del bloque, con su alcance', () => {
    const initial = initialized();
    const projection = updateSessionFromDoubtClassification(
      initial.snapshot,
      classifyDoubt(doubtFacts()),
      'DOUBT_CLASSIFIED',
      metadata('event-doubt-current', 4),
    );
    expect(projection.snapshot.state.pendingDoubts).toEqual([
      { doubtId: 'doubt-session-1', scope: 'current_block', raisedAt: at(4) },
    ]);
  });

  it('la proyección no cambia estrategia, ayuda ni elegibilidad', () => {
    const initial = initialized();
    const projection = updateSessionFromDoubtClassification(
      initial.snapshot,
      classifyDoubt(doubtFacts({ blockingPrerequisiteKcIds: ['KC03'] })),
      'DOUBT_CLASSIFIED',
      metadata('event-doubt-prereq', 4),
    );
    expect(projection.snapshot.state.selectedStrategy).toBe(initial.snapshot.state.selectedStrategy);
    expect(projection.snapshot.state.assistanceLevel).toBe(initial.snapshot.state.assistanceLevel);
    expect(projection.snapshot.state.masteryEligibility).toBe(
      initial.snapshot.state.masteryEligibility,
    );
  });

  it('rechaza una clasificación cuyo modo no corresponde al de la sesión', () => {
    const initial = initialized();
    expectCode(
      () => updateSessionFromDoubtClassification(
        initial.snapshot,
        classifyDoubt(doubtFacts({ pedagogicalMode: 'MEASUREMENT_MODE' })),
        'DOUBT_CLASSIFIED',
        metadata('event-doubt-mode', 4),
      ),
      'DOUBT_PROJECTION_MISMATCH',
    );
  });

  it('rechaza registrar dos veces la misma duda', () => {
    const initial = initialized();
    const first = updateSessionFromDoubtClassification(
      initial.snapshot,
      classifyDoubt(doubtFacts({ fragmentIdsInCurrentBlock: [] })),
      'DOUBT_CLASSIFIED',
      metadata('event-doubt-dup-1', 4),
    );
    expectCode(
      () => updateSessionFromDoubtClassification(
        first.snapshot,
        classifyDoubt(doubtFacts({ fragmentIdsInCurrentBlock: [] })),
        'DOUBT_CLASSIFIED',
        metadata('event-doubt-dup-2', 5),
      ),
      'DOUBT_PROJECTION_MISMATCH',
    );
  });
});
