import { describe, expect, it } from 'vitest';

import {
  DeterministicMeasurementAuthority,
  MEASUREMENT_INVENTORY_SCHEMA_VERSION,
  MEASUREMENT_SEED_SCHEMA_VERSION,
  MeasurementAuthorityError,
  MeasurementEvent,
  createMeasurementAuthorityPolicyDefinition,
  type MeasurementRunState,
} from '../src/index.js';

const START = Date.parse('2026-08-17T06:00:00.000Z');
const HASH = '8'.repeat(64);
const RUN_ID = 'run-interruptions-1';
const PSEUDO_ID = 'pseudo-interruptions-1';
const OPPORTUNITY_ID = 'opportunity-interruptions-1';

function at(second: number): string {
  return new Date(START + second * 1_000).toISOString();
}

const POLICY = createMeasurementAuthorityPolicyDefinition({
  policyVersion: 'measurement-interruptions-test-v1',
  purpose: 'test_fixture',
  reasonPolicy: [
    { reasonCode: 'invalid_participant_pause', operationalValidity: 'invalid' },
    { reasonCode: 'missing_session_time', operationalValidity: 'missing' },
    { reasonCode: 'withdrawal', operationalValidity: 'missing' },
    { reasonCode: 'timeout', operationalValidity: 'invalid' },
    { reasonCode: 'incident', operationalValidity: 'invalid' },
    { reasonCode: 'reserve_exhausted', operationalValidity: 'missing' },
  ],
  incidentTaxonomy: [
    { incidentCode: 'fixture_minor', level: 1, validityEffect: 'continue' },
    { incidentCode: 'fixture_localized', level: 2, validityEffect: 'invalidate_act' },
    { incidentCode: 'fixture_systemic', level: 3, validityEffect: 'invalidate_run' },
  ],
});

function inventory() {
  const items = Array.from({ length: 8 }, (_, index) => {
    const itemId = `interruptions-item-${index + 1}`;
    return {
      itemId,
      itemFamilyId: `interruptions-family-${index + 1}`,
      structuralSignature: HASH,
      experimentalSet: 'A',
      reserve: 'probes_baseline' as const,
      prompt: {
        itemId,
        statement: `Demuestra ${itemId}.`,
        premises: ['A'],
        goal: 'A',
        responseFormat: 'fitch_proof' as const,
      },
      timeLimitSeconds: 10,
      verifierContract: 'authorized-calculus-interruptions-fixture',
    };
  });
  return {
    schemaVersion: MEASUREMENT_INVENTORY_SCHEMA_VERSION,
    inventoryVersion: 'measurement-interruptions-inventory-v1',
    purpose: 'test_fixture' as const,
    packageVersion: {
      artifactId: 'measurement-interruptions-package',
      version: 'fixture-v1',
      hash: HASH,
    },
    plans: [{
      planId: 'measurement-interruptions-plan-A',
      experimentalSet: 'A',
      phase: 'baseline' as const,
      measureKind: 'primary_probe' as const,
      reserve: 'probes_baseline' as const,
      batchSize: 3,
      minValidItems: 2,
    }],
    items,
  };
}

function seed() {
  return {
    schemaVersion: MEASUREMENT_SEED_SCHEMA_VERSION,
    seedVersion: 'measurement-interruptions-seed-v1',
    purpose: 'test_fixture' as const,
    seedId: 'measurement-interruptions-seed',
    seedValue: 'private-interruptions-seed-fixture',
  };
}

function authority(): DeterministicMeasurementAuthority {
  const value = new DeterministicMeasurementAuthority(POLICY, inventory(), seed());
  value.bindRun({
    runId: RUN_ID,
    purpose: 'test_fixture',
    policyVersion: value.policy.definition.policyVersion,
    policyHash: value.policy.policyHash,
    inventoryVersion: value.inventory.definition.inventoryVersion,
    inventoryHash: value.inventory.inventoryHash,
    seedVersion: value.seed.definition.seedVersion,
    seedHash: value.seed.seedHash,
    packageVersion: value.inventory.definition.packageVersion,
  });
  return value;
}

function initialize(value: DeterministicMeasurementAuthority): MeasurementRunState {
  return value.applyEvent(null, {
    eventId: 'interruptions-event-0',
    eventType: 'measurement.initialized',
    sequenceNumber: 0,
    occurredAt: at(0),
    payload: { runId: RUN_ID, participantPseudoId: PSEUDO_ID },
  }).state;
}

function open(value: DeterministicMeasurementAuthority): MeasurementRunState {
  return value.applyEvent(initialize(value), {
    eventId: 'interruptions-event-1',
    eventType: 'measurement.opportunity.opened',
    sequenceNumber: 1,
    occurredAt: at(1),
    payload: {
      runId: RUN_ID,
      participantPseudoId: PSEUDO_ID,
      probeRoundId: 'interruptions-round-1',
      opportunityId: OPPORTUNITY_ID,
      experimentalSet: 'A',
      phase: 'baseline',
      measureKind: 'primary_probe',
    },
  }).state;
}

function deliver(
  value: DeterministicMeasurementAuthority,
  state: MeasurementRunState,
  sequenceNumber: number,
) {
  return value.applyEvent(state, {
    eventId: `interruptions-event-${sequenceNumber}`,
    eventType: 'measurement.delivery.requested',
    sequenceNumber,
    occurredAt: at(sequenceNumber),
    payload: { opportunityId: OPPORTUNITY_ID },
  });
}

function score(
  value: DeterministicMeasurementAuthority,
  state: MeasurementRunState,
  sequenceNumber: number,
  probeInstanceId: string,
  correct: boolean,
) {
  return value.applyEvent(state, {
    eventId: `interruptions-event-${sequenceNumber}`,
    eventType: 'measurement.item.outcome_observed',
    sequenceNumber,
    occurredAt: at(sequenceNumber),
    payload: {
      opportunityId: OPPORTUNITY_ID,
      probeInstanceId,
      outcome: { kind: 'scored', correct },
    },
  });
}

function expectCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error('se esperaba MeasurementAuthorityError');
  } catch (error) {
    expect(error).toBeInstanceOf(MeasurementAuthorityError);
    expect((error as MeasurementAuthorityError).code).toBe(code);
  }
}

describe('T-H6-08: interrupciones en MEASUREMENT_MODE', () => {
  it('congela las semánticas literales y exige una taxonomía explícita', () => {
    expect(POLICY.interruptionSemantics).toEqual({
      preItemPauseConsumes: false,
      postItemPauseKeepsConsumption: true,
      contentQuestionAllowsPedagogicalResponse: false,
      contentQuestionExtendsClock: false,
      timeoutUsesFrozenRubric: true,
      sessionTimeoutReasonCode: 'missing_session_time',
      withdrawalForcesReplacement: false,
      systemicIncidentSuspendsRun: true,
    });
    expect(() => createMeasurementAuthorityPolicyDefinition({
      policyVersion: 'missing-taxonomy-fixture',
      purpose: 'test_fixture',
      reasonPolicy: POLICY.reasonPolicy,
      incidentTaxonomy: [],
    })).toThrow();
  });

  it('pausa pre-ítem sin seleccionar ni consumir y exige reanudación enlazada', () => {
    const value = authority();
    const paused = value.applyEvent(open(value), {
      eventId: 'interruptions-event-2',
      eventType: 'measurement.pause.requested',
      sequenceNumber: 2,
      occurredAt: at(2),
      payload: { opportunityId: OPPORTUNITY_ID },
    });

    expect(paused.state.runDisposition).toBe('paused');
    expect(paused.state.consumedItemIds).toEqual([]);
    expect(paused.controlEffect).toMatchObject({
      kind: 'pre_item_pause',
      probeInstanceId: null,
      itemConsumedByEffect: false,
      immediateFeedbackProvided: false,
    });
    expectCode(() => deliver(value, paused.state, 3), 'MEASUREMENT_CONTROL_BLOCKED');
    expectCode(() => value.applyEvent(paused.state, {
      eventId: 'interruptions-event-3-wrong',
      eventType: 'measurement.pause.resumed',
      sequenceNumber: 3,
      occurredAt: at(3),
      payload: { pauseEffectId: 'another-pause' },
    }), 'MEASUREMENT_CONTROL_BLOCKED');

    const resumed = value.applyEvent(paused.state, {
      eventId: 'interruptions-event-3',
      eventType: 'measurement.pause.resumed',
      sequenceNumber: 3,
      occurredAt: at(3),
      payload: { pauseEffectId: 'interruptions-event-2' },
    });
    expect(resumed.state.runDisposition).toBe('active');
    expect(deliver(value, resumed.state, 4).state.consumedItemIds).toHaveLength(1);
  });

  it('pausa post-ítem conserva el consumo, invalida ese acto y no da feedback', () => {
    const value = authority();
    const shown = deliver(value, open(value), 2);
    const itemId = shown.delivery?.prompt.itemId;
    const paused = value.applyEvent(shown.state, {
      eventId: 'interruptions-event-3',
      eventType: 'measurement.pause.requested',
      sequenceNumber: 3,
      occurredAt: at(3),
      payload: { opportunityId: OPPORTUNITY_ID },
    });

    expect(paused.state.consumedItemIds).toEqual([itemId]);
    expect(paused.state.opportunities[0]?.outcomes[0]).toMatchObject({
      operationalValidity: 'invalid',
      reasonCode: 'invalid_participant_pause',
    });
    expect(paused.controlEffect).toMatchObject({
      kind: 'post_item_pause',
      probeInstanceId: shown.delivery?.probeInstanceId,
      itemConsumedByEffect: false,
      immediateFeedbackProvided: false,
      pedagogicalResponseProvided: false,
      replacementDisposition: 'calendar_independent_only',
    });
  });

  it('una duda de contenido sólo admite silencio o procedimiento y no cambia el deadline', () => {
    const value = authority();
    const shown = deliver(value, open(value), 2);
    const questioned = value.applyEvent(shown.state, {
      eventId: 'interruptions-event-3',
      eventType: 'measurement.content_question.recorded',
      sequenceNumber: 3,
      occurredAt: at(3),
      payload: {
        opportunityId: OPPORTUNITY_ID,
        probeInstanceId: shown.delivery?.probeInstanceId,
        responseKind: 'rights_or_procedure',
      },
    });

    expect(questioned.controlEffect).toMatchObject({
      kind: 'content_question',
      responseKind: 'rights_or_procedure',
      deadlineBeforeQuestion: at(12),
      deadlineAfterQuestion: at(12),
      pedagogicalResponseProvided: false,
      clockExtended: false,
    });
    expect(questioned.state.opportunities[0]?.outcomes).toEqual([]);
    expectCode(() => value.applyEvent(questioned.state, {
      eventId: 'interruptions-event-4',
      eventType: 'measurement.content_question.recorded',
      sequenceNumber: 4,
      occurredAt: at(13),
      payload: {
        opportunityId: OPPORTUNITY_ID,
        probeInstanceId: shown.delivery?.probeInstanceId,
        responseKind: 'none',
      },
    }), 'MEASUREMENT_CONTROL_BLOCKED');
  });

  it('timeout sólo se acepta al vencer el reloj del reactivo y conserva la rúbrica', () => {
    const value = authority();
    const shown = deliver(value, open(value), 2);
    const timeoutEvent = (occurredAt: string) => ({
      eventId: 'interruptions-event-3',
      eventType: 'measurement.probe.timeout' as const,
      sequenceNumber: 3,
      occurredAt,
      payload: {
        opportunityId: OPPORTUNITY_ID,
        probeInstanceId: shown.delivery?.probeInstanceId,
      },
    });
    expectCode(() => value.applyEvent(shown.state, timeoutEvent(at(11))), 'TIMER_NOT_EXPIRED');

    const timedOut = value.applyEvent(shown.state, timeoutEvent(at(12)));
    expect(timedOut.state.opportunities[0]?.outcomes[0]).toMatchObject({
      operationalValidity: 'invalid',
      reasonCode: 'timeout',
    });
    expect(timedOut.controlEffect).toMatchObject({
      kind: 'probe_timeout',
      deadlineAt: at(12),
      rubricContract: 'authorized-calculus-interruptions-fixture',
      immediateFeedbackProvided: false,
      pedagogicalResponseProvided: false,
    });
    expectCode(() => value.applyEvent({
      ...timedOut.state,
      controlEffects: timedOut.state.controlEffects.map((effect) =>
        effect.kind === 'probe_timeout'
          ? { ...effect, rubricContract: 'rubric-tampered' }
          : effect),
    } as never, {
      eventId: 'interruptions-event-4',
      eventType: 'measurement.delivery.requested',
      sequenceNumber: 4,
      occurredAt: at(13),
      payload: { opportunityId: OPPORTUNITY_ID },
    }), 'INVALID_STATE');
  });

  it('fin de sesión fuerza missing aunque ya existan dos respuestas válidas', () => {
    const value = authority();
    let state = open(value);
    let shown = deliver(value, state, 2);
    state = score(value, shown.state, 3, shown.delivery?.probeInstanceId ?? '', true).state;
    shown = deliver(value, state, 4);
    state = score(value, shown.state, 5, shown.delivery?.probeInstanceId ?? '', false).state;
    shown = deliver(value, state, 6);

    expectCode(() => value.applyEvent(shown.state, {
      eventId: 'interruptions-event-7-early',
      eventType: 'measurement.session_time.expired',
      sequenceNumber: 7,
      occurredAt: at(7),
      payload: { opportunityId: OPPORTUNITY_ID, sessionDeadlineAt: at(8) },
    }), 'TIMER_NOT_EXPIRED');

    const expired = value.applyEvent(shown.state, {
      eventId: 'interruptions-event-7',
      eventType: 'measurement.session_time.expired',
      sequenceNumber: 7,
      occurredAt: at(7),
      payload: { opportunityId: OPPORTUNITY_ID, sessionDeadlineAt: at(7) },
    });
    expect(expired.result).toEqual({
      opportunityId: OPPORTUNITY_ID,
      probeRoundId: 'interruptions-round-1',
      plannedItems: 3,
      validScoredItems: 2,
      correctValidItems: 1,
      observation: null,
      operationalValidity: 'missing',
      reasonCode: 'missing_session_time',
    });
    expect(expired.state.consumedItemIds).toHaveLength(3);
    expect(expired.controlEffect).toMatchObject({
      kind: 'session_time_expired',
      probeInstanceId: shown.delivery?.probeInstanceId,
      sessionDeadlineAt: at(7),
      itemConsumedByEffect: false,
    });
  });

  it('fin de sesión entre reactivos no consume uno nuevo', () => {
    const value = authority();
    const shown = deliver(value, open(value), 2);
    const scored = score(value, shown.state, 3, shown.delivery?.probeInstanceId ?? '', true);
    const expired = value.applyEvent(scored.state, {
      eventId: 'interruptions-event-4',
      eventType: 'measurement.session_time.expired',
      sequenceNumber: 4,
      occurredAt: at(4),
      payload: { opportunityId: OPPORTUNITY_ID, sessionDeadlineAt: at(4) },
    });
    expect(expired.state.consumedItemIds).toHaveLength(1);
    expect(expired.controlEffect).toMatchObject({ probeInstanceId: null });
  });

  it('retirada conserva lo mostrado, produce missing y prohíbe reposición forzada', () => {
    const value = authority();
    const shown = deliver(value, open(value), 2);
    const withdrawn = value.applyEvent(shown.state, {
      eventId: 'interruptions-event-3',
      eventType: 'measurement.withdrawal.recorded',
      sequenceNumber: 3,
      occurredAt: at(3),
      payload: { opportunityId: OPPORTUNITY_ID, consentDecisionRef: 'consent-withdrawal-1' },
    });
    expect(withdrawn.result).toMatchObject({ operationalValidity: 'missing', reasonCode: 'withdrawal' });
    expect(withdrawn.state.runDisposition).toBe('withdrawn');
    expect(withdrawn.state.consumedItemIds).toHaveLength(1);
    expect(withdrawn.controlEffect).toMatchObject({
      kind: 'withdrawal',
      consentDecisionRef: 'consent-withdrawal-1',
      replacementDisposition: 'prohibited',
    });
    expectCode(() => deliver(value, withdrawn.state, 4), 'MEASUREMENT_CONTROL_BLOCKED');
  });

  it('incidente menor registra sin invalidar y el localizado invalida sólo el acto enlazado', () => {
    const minorWorker = authority();
    const minorShown = deliver(minorWorker, open(minorWorker), 2);
    const minor = minorWorker.applyEvent(minorShown.state, {
      eventId: 'interruptions-event-3',
      eventType: 'measurement.incident.recorded',
      sequenceNumber: 3,
      occurredAt: at(3),
      payload: {
        opportunityId: OPPORTUNITY_ID,
        incident: {
          incidentId: 'incident-minor-1',
          incidentCode: 'fixture_minor',
          level: 1,
          action: 'registrar_y_continuar',
          detectedAt: at(3),
          affectedEventIds: [minorShown.delivery?.probeInstanceId ?? ''],
          invalidatedOpportunityIds: [],
        },
      },
    });
    expect(minor.state.opportunities[0]?.outcomes).toEqual([]);
    expect(minor.controlEffect).toMatchObject({
      kind: 'incident',
      scope: 'localized',
      reasonCode: null,
      replacementDisposition: 'not_applicable',
    });

    const localizedWorker = authority();
    const localizedShown = deliver(localizedWorker, open(localizedWorker), 2);
    const localized = localizedWorker.applyEvent(localizedShown.state, {
      eventId: 'interruptions-event-3',
      eventType: 'measurement.incident.recorded',
      sequenceNumber: 3,
      occurredAt: at(3),
      payload: {
        opportunityId: OPPORTUNITY_ID,
        incident: {
          incidentId: 'incident-localized-1',
          incidentCode: 'fixture_localized',
          level: 2,
          action: 'invalidar_acto_o_bloque',
          detectedAt: at(3),
          affectedEventIds: [localizedShown.delivery?.probeInstanceId ?? ''],
          invalidatedOpportunityIds: [OPPORTUNITY_ID],
        },
      },
    });
    expect(localized.state.runDisposition).toBe('active');
    expect(localized.state.opportunities[0]?.outcomes[0]?.reasonCode).toBe('incident');
    expect(localized.controlEffect).toMatchObject({
      scope: 'localized',
      replacementDisposition: 'calendar_independent_only',
    });
    expectCode(() => deliver(localizedWorker, {
      ...localized.state,
      controlEffects: localized.state.controlEffects.map((effect) =>
        effect.kind === 'incident'
          ? { ...effect, incident: { ...effect.incident, affectedEventIds: [] } }
          : effect),
    } as never, 4), 'INVALID_STATE');
    expect(deliver(localizedWorker, localized.state, 4).delivery).not.toBeNull();
  });

  it('incidente sistémico suspende y fuerza invalid aunque ya se alcanzó el mínimo', () => {
    const value = authority();
    let state = open(value);
    let shown = deliver(value, state, 2);
    state = score(value, shown.state, 3, shown.delivery?.probeInstanceId ?? '', true).state;
    shown = deliver(value, state, 4);
    state = score(value, shown.state, 5, shown.delivery?.probeInstanceId ?? '', false).state;
    shown = deliver(value, state, 6);
    const suspended = value.applyEvent(shown.state, {
      eventId: 'interruptions-event-7',
      eventType: 'measurement.incident.recorded',
      sequenceNumber: 7,
      occurredAt: at(7),
      payload: {
        opportunityId: OPPORTUNITY_ID,
        incident: {
          incidentId: 'incident-systemic-1',
          incidentCode: 'fixture_systemic',
          level: 3,
          action: 'suspender_piloto',
          detectedAt: at(7),
          affectedEventIds: [shown.delivery?.probeInstanceId ?? ''],
          invalidatedOpportunityIds: [OPPORTUNITY_ID],
        },
      },
    });
    expect(suspended.state.runDisposition).toBe('suspended');
    expect(suspended.result).toMatchObject({
      validScoredItems: 2,
      observation: null,
      operationalValidity: 'invalid',
      reasonCode: 'incident',
    });
    expect(suspended.controlEffect).toMatchObject({ scope: 'systemic', opportunityClosed: true });
    expectCode(() => deliver(value, suspended.state, 8), 'MEASUREMENT_CONTROL_BLOCKED');
  });

  it('rechaza acción, nivel, código o enlace que discrepe de la taxonomía', () => {
    const value = authority();
    const shown = deliver(value, open(value), 2);
    const base = {
      incidentId: 'incident-invalid-1',
      incidentCode: 'fixture_localized',
      level: 2 as const,
      action: 'suspender_piloto' as const,
      detectedAt: at(3),
      affectedEventIds: [shown.delivery?.probeInstanceId ?? ''],
      invalidatedOpportunityIds: [OPPORTUNITY_ID],
    };
    expectCode(() => value.applyEvent(shown.state, {
      eventId: 'interruptions-event-3',
      eventType: 'measurement.incident.recorded',
      sequenceNumber: 3,
      occurredAt: at(3),
      payload: { opportunityId: OPPORTUNITY_ID, incident: base },
    }), 'INCIDENT_TAXONOMY_MISMATCH');
  });

  it('no admite inyectar reason codes de interrupción como resultados genéricos', () => {
    expect(MeasurementEvent.safeParse({
      eventId: 'forged-outcome-event',
      eventType: 'measurement.item.outcome_observed',
      sequenceNumber: 3,
      occurredAt: at(3),
      payload: {
        opportunityId: OPPORTUNITY_ID,
        probeInstanceId: 'probe-forged',
        outcome: { kind: 'operational_reason', reasonCode: 'withdrawal' },
      },
    }).success).toBe(false);
  });

  it('replay reproduce los efectos y restauración rechaza reloj o disposición adulterados', () => {
    const value = authority();
    const events: MeasurementEvent[] = [
      {
        eventId: 'interruptions-event-0',
        eventType: 'measurement.initialized',
        sequenceNumber: 0,
        occurredAt: at(0),
        payload: { runId: RUN_ID, participantPseudoId: PSEUDO_ID, priorConsumptions: [] },
      },
      {
        eventId: 'interruptions-event-1',
        eventType: 'measurement.opportunity.opened',
        sequenceNumber: 1,
        occurredAt: at(1),
        payload: {
          runId: RUN_ID,
          participantPseudoId: PSEUDO_ID,
          probeRoundId: 'interruptions-round-1',
          opportunityId: OPPORTUNITY_ID,
          experimentalSet: 'A',
          phase: 'baseline',
          measureKind: 'primary_probe',
        },
      },
      {
        eventId: 'interruptions-event-2',
        eventType: 'measurement.delivery.requested',
        sequenceNumber: 2,
        occurredAt: at(2),
        payload: { opportunityId: OPPORTUNITY_ID },
      },
      {
        eventId: 'interruptions-event-3',
        eventType: 'measurement.content_question.recorded',
        sequenceNumber: 3,
        occurredAt: at(3),
        payload: {
          opportunityId: OPPORTUNITY_ID,
          probeInstanceId: 'interruptions-event-2',
          responseKind: 'none',
        },
      },
      {
        eventId: 'interruptions-event-4',
        eventType: 'measurement.pause.requested',
        sequenceNumber: 4,
        occurredAt: at(4),
        payload: { opportunityId: OPPORTUNITY_ID },
      },
      {
        eventId: 'interruptions-event-5',
        eventType: 'measurement.pause.resumed',
        sequenceNumber: 5,
        occurredAt: at(5),
        payload: { pauseEffectId: 'interruptions-event-4' },
      },
    ];
    const replayed = value.replay(events);
    expect(replayed.controlEffects.map((effect) => effect.kind)).toEqual([
      'content_question',
      'post_item_pause',
      'pause_resumed',
    ]);
    expect(replayed.runDisposition).toBe('active');

    const nextDelivery = {
      eventId: 'interruptions-event-6',
      eventType: 'measurement.delivery.requested',
      sequenceNumber: 6,
      occurredAt: at(6),
      payload: { opportunityId: OPPORTUNITY_ID },
    } as const;
    const effect = replayed.controlEffects[0];
    if (effect?.kind !== 'content_question') throw new Error('fixture sin duda');
    const postPauseEffect = replayed.controlEffects[1];
    if (postPauseEffect?.kind !== 'post_item_pause') throw new Error('fixture sin pausa post-ítem');
    expectCode(() => value.applyEvent({
      ...replayed,
      controlEffects: [{ ...effect, deadlineAfterQuestion: at(13) }, ...replayed.controlEffects.slice(1)],
    } as never, nextDelivery), 'INVALID_STATE');
    expectCode(() => value.applyEvent({
      ...replayed,
      controlEffects: [{ ...effect, occurredAt: at(1) }, ...replayed.controlEffects.slice(1)],
    } as never, nextDelivery), 'INVALID_STATE');
    expectCode(() => value.applyEvent({
      ...replayed,
      controlEffects: [
        effect,
        { ...postPauseEffect, opportunityClosed: true },
        ...replayed.controlEffects.slice(2),
      ],
    } as never, nextDelivery), 'INVALID_STATE');
    expectCode(() => value.applyEvent({ ...replayed, runDisposition: 'paused' } as never, nextDelivery), 'INVALID_STATE');
    expectCode(() => value.applyEvent({ ...replayed, controlEffects: [] } as never, nextDelivery), 'INVALID_STATE');
  });
});
