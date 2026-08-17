import { describe, expect, it } from 'vitest';

import {
  DeterministicScedCalendar,
  createScedCalendarPolicyDefinition,
} from '@profesor-ia/experiment';
import {
  DeterministicMeasurementAuthority,
  createMeasurementAuthorityPolicyDefinition,
} from '../src/index.js';

const AT = '2026-08-17T05:00:00.000Z';
const RUN_ID = 'run-calendar-worker-integration';
const PSEUDO_ID = 'pseudo-calendar-worker-integration';
const HASH = 'a'.repeat(64);

function prompt(itemId: string) {
  return {
    itemId,
    statement: `Demuestra ${itemId}`,
    premises: ['A'],
    goal: 'A',
    responseFormat: 'fitch_proof' as const,
  };
}

describe('T-H6-07: frontera calendario → measurement-worker', () => {
  it('el calendario crea el ProbeRequest y el worker conserva selección/consumo/entrega', () => {
    const calendarPolicy = createScedCalendarPolicyDefinition({
      policyVersion: 'calendar-worker-integration-policy-v1',
      purpose: 'test_fixture',
    });
    const calendar = new DeterministicScedCalendar(calendarPolicy, {
      schemaVersion: 'sced-calendar-seed-v1',
      seedVersion: 'calendar-worker-integration-seed-v1',
      purpose: 'test_fixture',
      seedId: 'calendar-worker-integration-seed',
      seedValue: 'calendar-worker-integration-private-seed',
    });
    calendar.bindRun(calendar.expectedBinding(RUN_ID));
    let calendarState = calendar.applyEvent(null, {
      eventId: 'calendar-integration-initialized',
      eventType: 'sced.initialized',
      sequenceNumber: 0,
      occurredAt: AT,
      payload: { runId: RUN_ID, participantPseudoId: PSEUDO_ID },
    }).state;
    const openedRound = calendar.applyEvent(calendarState, {
      eventId: 'calendar-integration-round-1',
      eventType: 'sced.round.opened',
      sequenceNumber: 1,
      occurredAt: '2026-08-17T05:01:00.000Z',
      payload: { roundId: 'calendar-integration-round-1' },
    });
    calendarState = openedRound.state;
    const request = openedRound.probeRequests.find((candidate) => candidate.experimentalSet === 'A');
    if (request === undefined) throw new Error('fixture sin solicitud A');

    const workerPolicy = createMeasurementAuthorityPolicyDefinition({
      policyVersion: 'calendar-worker-measurement-policy-v1',
      purpose: 'test_fixture',
      reasonPolicy: [
        { reasonCode: 'invalid_participant_pause', operationalValidity: 'invalid' },
        { reasonCode: 'missing_session_time', operationalValidity: 'missing' },
        { reasonCode: 'withdrawal', operationalValidity: 'missing' },
        { reasonCode: 'timeout', operationalValidity: 'invalid' },
        { reasonCode: 'incident', operationalValidity: 'invalid' },
        { reasonCode: 'reserve_exhausted', operationalValidity: 'missing' },
      ],
      incidentTaxonomy: [{
        incidentCode: 'fixture_calendar_incident',
        level: 2,
        validityEffect: 'invalidate_act',
      }],
    });
    const items = Array.from({ length: 3 }, (_, index) => {
      const itemId = `calendar-worker-item-${index + 1}`;
      return {
        itemId,
        itemFamilyId: `calendar-worker-family-${index + 1}`,
        structuralSignature: HASH,
        experimentalSet: 'A',
        reserve: 'probes_baseline' as const,
        prompt: prompt(itemId),
        timeLimitSeconds: 90,
        verifierContract: 'logic-core@calendar-worker-fixture',
      };
    });
    const worker = new DeterministicMeasurementAuthority(
      workerPolicy,
      {
        schemaVersion: 'measurement-inventory-v1',
        inventoryVersion: 'calendar-worker-inventory-v1',
        purpose: 'test_fixture',
        packageVersion: {
          artifactId: 'calendar-worker-package',
          version: 'test-v1',
          hash: HASH,
        },
        plans: [{
          planId: 'calendar-worker-plan-A-baseline',
          experimentalSet: 'A',
          phase: 'baseline',
          measureKind: 'primary_probe',
          reserve: 'probes_baseline',
          batchSize: 3,
          minValidItems: 2,
        }],
        items,
      },
      {
        schemaVersion: 'measurement-seed-v1',
        seedVersion: 'calendar-worker-measurement-seed-v1',
        purpose: 'test_fixture',
        seedId: 'calendar-worker-measurement-seed',
        seedValue: 'calendar-worker-measurement-private-seed',
      },
    );
    worker.bindRun({
      runId: RUN_ID,
      purpose: 'test_fixture',
      policyVersion: worker.policy.definition.policyVersion,
      policyHash: worker.policy.policyHash,
      inventoryVersion: worker.inventory.definition.inventoryVersion,
      inventoryHash: worker.inventory.inventoryHash,
      seedVersion: worker.seed.definition.seedVersion,
      seedHash: worker.seed.seedHash,
      packageVersion: worker.inventory.definition.packageVersion,
    });
    let workerState = worker.applyEvent(null, {
      eventId: 'calendar-worker-initialized',
      eventType: 'measurement.initialized',
      sequenceNumber: 0,
      occurredAt: AT,
      payload: { runId: RUN_ID, participantPseudoId: PSEUDO_ID },
    }).state;
    workerState = worker.applyEvent(workerState, {
      eventId: 'calendar-worker-opportunity-opened',
      eventType: 'measurement.opportunity.opened',
      sequenceNumber: 1,
      occurredAt: '2026-08-17T05:02:00.000Z',
      payload: request,
    }).state;
    const delivered = worker.applyEvent(workerState, {
      eventId: 'calendar-worker-delivery-1',
      eventType: 'measurement.delivery.requested',
      sequenceNumber: 2,
      occurredAt: '2026-08-17T05:03:00.000Z',
      payload: { opportunityId: request.opportunityId },
    });

    expect(request).toMatchObject({
      runId: RUN_ID,
      participantPseudoId: PSEUDO_ID,
      probeRoundId: 'calendar-integration-round-1',
      experimentalSet: 'A',
      phase: 'baseline',
      measureKind: 'primary_probe',
    });
    expect(delivered.delivery).toMatchObject({
      opportunityId: request.opportunityId,
      itemOrdinal: 1,
      batchSize: 3,
    });
    expect(delivered.state.consumedItemIds).toEqual([delivered.delivery?.prompt.itemId]);
    expect(calendarState.validRoundCount).toBe(0);
  });
});
