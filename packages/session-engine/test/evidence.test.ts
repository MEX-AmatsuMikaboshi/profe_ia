import { describe, expect, it } from 'vitest';
import {
  EvidenceLedger,
  EvidenceLedgerError,
} from '@profesor-ia/evidence';
import {
  SESSION_STATE_SCHEMA_VERSION,
  appendSessionMeasurementExitEvidence,
  appendSessionMutationEvidence,
  enterMeasurementModeForProbe,
  exitMeasurementModeFromProbeResult,
  initializeSessionState,
  updateSessionProjection,
} from '../src/index.js';
import type {
  SessionEvidenceMetadata,
  SessionMutation,
} from '../src/index.js';

const AT = '2026-08-16T16:00:00.000Z';

function at(second: number): string {
  return `2026-08-16T16:00:${String(second).padStart(2, '0')}.000Z`;
}

function initialized(): SessionMutation {
  return initializeSessionState(
    {
      sessionId: 'session-evidence-fixture',
      runId: 'run-evidence-fixture',
      participantPseudoId: 'pseudo-evidence-fixture',
      courseId: 'course-evidence-fixture',
      packageVersion: {
        artifactId: 'content-package-fixture',
        version: 'fixture-v1',
        hash: 'a'.repeat(64),
      },
      plannedDurationSeconds: 3_600,
    },
    { eventId: 'session-source-event-0', occurredAt: AT },
  );
}

function ledger(sessionId = 'session-evidence-fixture'): EvidenceLedger {
  return new EvidenceLedger({
    streamId: 'stream-evidence-fixture',
    runId: 'run-evidence-fixture',
    participantPseudoId: 'pseudo-evidence-fixture',
    sessionId,
  });
}

function metadata(eventId: string, second: number): SessionEvidenceMetadata {
  return {
    evidenceEventId: eventId,
    correlationId: 'correlation-evidence-fixture',
    occurredAtServer: at(second),
    versions: { 'dry-session-fixture': { version: 'fixture-v1' } },
    validity: 'valid',
  };
}

describe('integración session-engine → EvidenceLedger', () => {
  it('emite un EvidenceEvent por mutación y reconstruye sesión, dominio y vistas pedagógicas', () => {
    const initial = initialized();
    const value = ledger();
    const first = appendSessionMutationEvidence(value, initial, metadata('evidence-session-0', 0));
    const projected = updateSessionProjection(
      initial.snapshot,
      {
        activeKcIds: ['KC03'],
        consumedActivityIds: ['activity-fixture-1'],
        selectedStrategy: 'guided_practice',
        assistanceLevel: 1,
        masteryEligibility: true,
        scaffoldingStage: 'scaffolding',
        wheelSpinning: {
          active: true,
          kcIds: ['KC03'],
          thresholdVersion: 'cal-wheel-test-fixture',
        },
        attemptMasteryEligibility: [{
          attemptId: 'attempt-fixture-1',
          kcId: 'KC03',
          eligible: true,
          reasonCode: 'fixture-eligible',
        }],
      },
      'FIXTURE_PROJECTION',
      {
        eventId: 'session-source-event-1',
        occurredAt: at(1),
        decisionMaker: 'engine',
        autonomyStatus: 'autonomous',
      },
    );
    const second = appendSessionMutationEvidence(value, projected, {
      ...metadata('evidence-session-1', 1),
      causedByEventId: first.eventId,
    });

    expect(first.eventType).toBe('session.initialized');
    expect(first.decisionMaker).toBe('system');
    expect(first.autonomyStatus).toBe('automatic-control');
    expect(second.decisionMaker).toBe(projected.event.decisionMaker);
    expect(second.autonomyStatus).toBe(projected.event.autonomyStatus);
    expect(second.versions).toMatchObject({
      'session-engine': { version: SESSION_STATE_SCHEMA_VERSION },
      'content-package': { version: 'fixture-v1', hash: 'a'.repeat(64) },
    });

    const rebuilt = value.reconstruct();
    expect(rebuilt.projections.session[0]?.value).toEqual(projected.snapshot.state);
    expect(rebuilt.projections.domain[0]?.value).toMatchObject({ activeKcIds: ['KC03'] });
    expect(rebuilt.projections.coverage[0]?.value).toEqual({
      consumedActivityIds: ['activity-fixture-1'],
    });
    expect(rebuilt.projections.strategy[0]?.value).toMatchObject({
      selectedStrategy: 'guided_practice',
      assistanceLevel: 1,
    });
    expect(rebuilt.projections.eligibility[0]?.value).toMatchObject({ masteryEligibility: true });
    expect(rebuilt.projections.wheel_spinning[0]?.value).toMatchObject({ active: true });
    expect(rebuilt.projections.incidents[0]?.value).toEqual({ incidents: [] });
    expect(rebuilt.projectionHistory.filter((entry) => entry.projection === 'session')).toHaveLength(2);
  });

  it('conserva el ProbeOpportunityResult exacto como resultado reconstruible', () => {
    const initial = initialized();
    const entry = enterMeasurementModeForProbe(
      initial.snapshot,
      { experimentalSet: 'A', phase: 'baseline', measureKind: 'primary_probe' },
      'MEASUREMENT_REQUESTED',
      {
        eventId: 'session-source-entry',
        occurredAt: at(1),
        decisionMaker: 'engine',
        autonomyStatus: 'autonomous',
      },
    );
    const exit = exitMeasurementModeFromProbeResult(
      entry.mutation.snapshot,
      {
        opportunityId: 'opportunity-evidence-fixture',
        probeRoundId: 'round-evidence-fixture',
        plannedItems: 3,
        validScoredItems: 2,
        correctValidItems: 1,
        observation: 0.5,
        operationalValidity: 'valid',
        reasonCode: null,
      },
      'MEASUREMENT_RESULT_CONSUMED',
      {
        eventId: 'session-source-exit',
        occurredAt: at(2),
        decisionMaker: 'engine',
        autonomyStatus: 'autonomous',
      },
    );
    const value = ledger();
    const evidence = appendSessionMeasurementExitEvidence(
      value,
      exit,
      metadata('evidence-measurement-exit', 2),
    );

    expect(evidence.eventType).toBe('session.projection.updated');
    expect(value.reconstruct().projections.results[0]).toMatchObject({
      projectionId: 'opportunity-evidence-fixture',
      value: exit.result,
      validity: 'valid',
    });
  });

  it('falla si el stream no pertenece a la sesión o si evento/snapshot fueron mezclados', () => {
    const initial = initialized();
    expect(() => appendSessionMutationEvidence(
      ledger('another-session'),
      initial,
      metadata('evidence-mismatch', 0),
    )).toThrow(EvidenceLedgerError);

    const next = updateSessionProjection(
      initial.snapshot,
      { consumedActivityIds: ['activity-fixture-1'] },
      'FIXTURE_PROJECTION',
      {
        eventId: 'session-source-event-1',
        occurredAt: at(1),
        decisionMaker: 'engine',
        autonomyStatus: 'autonomous',
      },
    );
    const mixed = { event: next.event, snapshot: initial.snapshot };
    expect(() => appendSessionMutationEvidence(
      ledger(),
      mixed,
      metadata('evidence-mixed', 1),
    )).toThrow(/evento, revisión y snapshot/u);
  });
});
