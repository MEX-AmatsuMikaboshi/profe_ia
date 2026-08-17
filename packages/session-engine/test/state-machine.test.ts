import { describe, expect, it } from 'vitest';
import { SESSION_STATES, SESSION_TRANSVERSAL_STATES } from '@profesor-ia/contracts';

import {
  SESSION_BKT_SHADOW_ENABLED,
  SESSION_STATE_GENESIS,
  SESSION_STATE_SCHEMA_VERSION,
  SessionStateMachineError,
  applySessionStateEvent,
  changeTransversalSessionState,
  initializeSessionState,
  replaySessionStateEvents,
  restoreSessionStateSnapshot,
  sessionStateHash,
  toSessionStatePersistenceRow,
  transitionPrimarySessionState,
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
});
