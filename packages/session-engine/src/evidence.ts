import {
  ProbeOpportunityResult,
  VersionManifest,
} from '@profesor-ia/contracts';
import type {
  EventValidity,
  ProbeOpportunityResult as ProbeOpportunityResultValue,
  VersionManifest as VersionManifestValue,
} from '@profesor-ia/contracts';
import {
  EvidenceLedgerError,
  evidenceJsonObject,
} from '@profesor-ia/evidence';
import type {
  EvidenceLedger,
  EvidenceProjectionUpdate,
  JsonObject,
} from '@profesor-ia/evidence';
import {
  SESSION_STATE_SCHEMA_VERSION,
  SessionStateEvent,
  SessionStructuredState,
  sessionStateHash,
} from './state-machine.js';
import type {
  SessionMeasurementExit,
  SessionMutation,
  SessionStateEvent as SessionStateEventValue,
  SessionStructuredState as SessionStructuredStateValue,
} from './state-machine.js';

export interface SessionEvidenceMetadata {
  readonly evidenceEventId: string;
  readonly correlationId: string;
  readonly causedByEventId?: string;
  readonly artifactRefs?: readonly string[];
  readonly traceId?: string;
  readonly occurredAtServer: string;
  readonly versions: VersionManifestValue;
  readonly validity: EventValidity;
}

function fail(message: string): never {
  throw new EvidenceLedgerError('INVALID_ACT', message);
}

function assertMutation(
  ledger: EvidenceLedger,
  mutationValue: SessionMutation,
): { event: SessionStateEventValue; state: SessionStructuredStateValue } {
  const eventResult = SessionStateEvent.safeParse(mutationValue.event);
  const stateResult = SessionStructuredState.safeParse(mutationValue.snapshot.state);
  if (!eventResult.success || !stateResult.success) {
    return fail('la mutación de sesión no cumple sus contratos estructurados');
  }
  const event = eventResult.data;
  const state = stateResult.data;
  const calculatedHash = sessionStateHash(state);
  if (
    calculatedHash !== mutationValue.snapshot.projectionHash ||
    event.resultingStateHash !== calculatedHash ||
    event.sequenceNumber !== state.revision
  ) {
    return fail('evento, revisión y snapshot de sesión no corresponden');
  }
  const binding = ledger.binding();
  if (
    binding.runId !== state.runId ||
    binding.participantPseudoId !== state.participantPseudoId ||
    binding.sessionId !== state.sessionId
  ) {
    throw new EvidenceLedgerError(
      'IDENTITY_MISMATCH',
      'la mutación de sesión no pertenece al stream de evidencia',
    );
  }
  return { event, state };
}

function sessionVersions(
  state: SessionStructuredStateValue,
  versionsValue: VersionManifestValue,
): VersionManifestValue {
  const parsed = VersionManifest.safeParse(versionsValue);
  if (!parsed.success) return fail('versions no cumple VersionManifest');
  return {
    ...parsed.data,
    'session-engine': { version: SESSION_STATE_SCHEMA_VERSION },
    'content-package': {
      version: state.packageVersion.version,
      ...(state.packageVersion.hash === undefined ? {} : { hash: state.packageVersion.hash }),
    },
  };
}

function projections(
  state: SessionStructuredStateValue,
  measurementResult?: ProbeOpportunityResultValue,
): EvidenceProjectionUpdate[] {
  const updates: EvidenceProjectionUpdate[] = [
    {
      projection: 'session',
      projectionId: state.sessionId,
      value: evidenceJsonObject(state),
    },
    {
      projection: 'domain',
      projectionId: state.sessionId,
      value: evidenceJsonObject({
        activeKcIds: state.activeKcIds,
        operationalMastery: state.operationalMastery,
        nearTransfer: state.nearTransfer,
        practiceSchedule: state.practiceSchedule,
      }),
    },
    {
      projection: 'coverage',
      projectionId: state.sessionId,
      value: evidenceJsonObject({ consumedActivityIds: state.consumedActivityIds }),
    },
    {
      projection: 'strategy',
      projectionId: state.sessionId,
      value: evidenceJsonObject({
        pedagogicalMode: state.pedagogicalMode,
        selectedStrategy: state.selectedStrategy,
        assistanceLevel: state.assistanceLevel,
        scaffoldingStage: state.scaffoldingStage,
      }),
    },
    {
      projection: 'eligibility',
      projectionId: state.sessionId,
      value: evidenceJsonObject({
        masteryEligibility: state.masteryEligibility,
        attemptMasteryEligibility: state.attemptMasteryEligibility,
      }),
    },
    {
      projection: 'wheel_spinning',
      projectionId: state.sessionId,
      value: evidenceJsonObject(state.wheelSpinning),
    },
    {
      projection: 'incidents',
      projectionId: state.sessionId,
      value: evidenceJsonObject({ incidents: state.incidents }),
    },
  ];
  if (measurementResult !== undefined) {
    updates.push({
      projection: 'results',
      projectionId: measurementResult.opportunityId,
      value: evidenceJsonObject(measurementResult),
    });
  }
  return updates;
}

function append(
  ledger: EvidenceLedger,
  mutationValue: SessionMutation,
  metadata: SessionEvidenceMetadata,
  measurementResult?: ProbeOpportunityResultValue,
) {
  const { event, state } = assertMutation(ledger, mutationValue);
  const act: JsonObject = evidenceJsonObject({
    component: 'session-engine',
    sourceEvent: event,
    resultingProjectionHash: mutationValue.snapshot.projectionHash,
    ...(measurementResult === undefined ? {} : { measurementResult }),
  });
  return ledger.append({
    eventId: metadata.evidenceEventId,
    correlationId: metadata.correlationId,
    ...(metadata.causedByEventId === undefined
      ? {}
      : { causedByEventId: metadata.causedByEventId }),
    ...(metadata.artifactRefs === undefined ? {} : { artifactRefs: metadata.artifactRefs }),
    ...(metadata.traceId === undefined ? {} : { traceId: metadata.traceId }),
    eventType: event.eventType,
    act,
    decisionMaker: event.decisionMaker,
    autonomyStatus: event.autonomyStatus,
    versions: sessionVersions(state, metadata.versions),
    occurredAt: event.occurredAt,
    occurredAtServer: metadata.occurredAtServer,
    validity: metadata.validity,
    projectionUpdates: projections(state, measurementResult),
  });
}

/** Emite exactamente un `EvidenceEvent` por una mutación autoritativa de sesión. */
export function appendSessionMutationEvidence(
  ledger: EvidenceLedger,
  mutation: SessionMutation,
  metadata: SessionEvidenceMetadata,
) {
  return append(ledger, mutation, metadata);
}

/** Igual que la ruta general, pero conserva el resultado de sonda en su proyección propia. */
export function appendSessionMeasurementExitEvidence(
  ledger: EvidenceLedger,
  exitValue: SessionMeasurementExit,
  metadata: SessionEvidenceMetadata,
) {
  const result = ProbeOpportunityResult.safeParse(exitValue.result);
  if (!result.success) return fail('el resultado de medición no cumple ProbeOpportunityResult');
  return append(ledger, exitValue.mutation, metadata, result.data);
}
