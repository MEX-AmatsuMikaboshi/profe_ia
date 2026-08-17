import { createHash } from 'node:crypto';
import {
  EventAutonomyStatus,
  Id,
  IsoDateTime,
  PedagogicalMode,
  PedagogicalStrategy,
  SessionState as PrimarySessionState,
  SessionTransversalState,
  Sha256Hex,
  VersionRef,
  SESSION_STATES,
  SESSION_TRANSVERSAL_STATES,
} from '@profesor-ia/contracts';
import { z } from 'zod';

/**
 * T-H6-01. CAL-11 no fue ejecutada y el freeze H5 fijó BKT en OFF. Por eso la
 * proyección de sesión v1 no tiene `masteryProbabilityShadow`: admitir siquiera
 * un valor de prueba crearía una vía de autoridad que el freeze prohíbe.
 */
export const SESSION_STATE_SCHEMA_VERSION = 'session-state-v1' as const;
export const SESSION_BKT_SHADOW_ENABLED = false as const;
export const SESSION_STATE_GENESIS = 'GENESIS' as const;

const NonEmptyText = z.string().trim().min(1).max(4_000);
const OptionalId = Id.nullable();
const HintLevel = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

function uniqueArray<T extends z.ZodType>(schema: T, label: string) {
  return z.array(schema).superRefine((values, context) => {
    const seen = new Set<unknown>();
    for (const [index, value] of values.entries()) {
      if (seen.has(value)) {
        context.addIssue({
          code: 'custom',
          message: `${label}: valor duplicado`,
          path: [index],
        });
      }
      seen.add(value);
    }
  });
}

export const SessionTiming = z
  .object({
    plannedDurationSeconds: z.number().int().positive(),
    elapsedSeconds: z.number().int().nonnegative(),
    startedAt: IsoDateTime.nullable(),
    endedAt: IsoDateTime.nullable(),
  })
  .strict()
  .superRefine((timing, context) => {
    if (timing.endedAt !== null && timing.startedAt === null) {
      context.addIssue({ code: 'custom', message: 'endedAt exige startedAt', path: ['endedAt'] });
    }
    if (
      timing.startedAt !== null &&
      timing.endedAt !== null &&
      Date.parse(timing.endedAt) < Date.parse(timing.startedAt)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'endedAt no puede preceder a startedAt',
        path: ['endedAt'],
      });
    }
  });

export const SessionBlock = z
  .object({
    blockId: Id,
    objectiveId: Id,
  })
  .strict();

export const OperationalMastery = z
  .object({
    mastered: z.boolean(),
    eligibleConsecutiveCorrect: z.number().int().nonnegative(),
    highestEligibleComplexityIndex: z.number().int().nonnegative().nullable(),
    nearTransferSatisfied: z.boolean(),
    reconfirmationPending: z.boolean(),
    lastChangedAt: IsoDateTime.nullable(),
  })
  .strict();

export const ScaffoldingStage = z.enum(['none', 'scaffolding', 'fading', 'independent']);

export const ObservedError = z
  .object({
    observationId: Id,
    attemptId: Id,
    kcId: Id,
    classification: z.enum([
      'conceptual',
      'procedural',
      'notation',
      'interface',
      'oversight',
      'accessibility',
    ]),
    errorCode: NonEmptyText,
    observedAt: IsoDateTime,
  })
  .strict();

export const AttemptAssistance = z
  .object({
    attemptId: Id,
    hintLevelsUsed: uniqueArray(HintLevel, 'hintLevelsUsed'),
    maximumHintLevel: z.number().int().min(0).max(5),
    masteryDisqualifying: z.boolean(),
  })
  .strict()
  .superRefine((assistance, context) => {
    const actualMaximum = assistance.hintLevelsUsed.length === 0
      ? 0
      : Math.max(...assistance.hintLevelsUsed);
    if (assistance.maximumHintLevel !== actualMaximum) {
      context.addIssue({
        code: 'custom',
        message: 'maximumHintLevel no coincide con las pistas registradas',
        path: ['maximumHintLevel'],
      });
    }
    if (actualMaximum >= 2 && !assistance.masteryDisqualifying) {
      context.addIssue({
        code: 'custom',
        message: 'los niveles 2–5 deben descalificar dominio',
        path: ['masteryDisqualifying'],
      });
    }
  });

export const AttemptMasteryEligibility = z
  .object({
    attemptId: Id,
    kcId: Id,
    eligible: z.boolean(),
    reasonCode: NonEmptyText,
  })
  .strict();

export const NearTransferState = z
  .object({
    status: z.enum(['pending', 'satisfied', 'failed', 'not_required']),
    attemptId: OptionalId,
    updatedAt: IsoDateTime.nullable(),
  })
  .strict();

export const PracticeSchedule = z
  .object({
    lastPracticeAt: IsoDateTime.nullable(),
    nextReviewAt: IsoDateTime.nullable(),
  })
  .strict();

export const WheelSpinningState = z
  .object({
    active: z.boolean(),
    kcIds: uniqueArray(Id, 'wheelSpinning.kcIds'),
    thresholdVersion: z.string().trim().min(1).max(200).nullable(),
  })
  .strict()
  .superRefine((signal, context) => {
    if (signal.active && (signal.kcIds.length === 0 || signal.thresholdVersion === null)) {
      context.addIssue({
        code: 'custom',
        message: 'wheel_spinning activo exige KC y versión de umbral',
      });
    }
    if (!signal.active && (signal.kcIds.length !== 0 || signal.thresholdVersion !== null)) {
      context.addIssue({
        code: 'custom',
        message: 'wheel_spinning inactivo no puede conservar una señal material',
      });
    }
  });

export const PendingDoubt = z
  .object({
    doubtId: Id,
    artifactRef: Id,
    raisedAt: IsoDateTime,
  })
  .strict();

export const SessionPlanChange = z
  .object({
    changeId: Id,
    description: NonEmptyText,
    reasonCode: NonEmptyText,
    occurredAt: IsoDateTime,
  })
  .strict();

export const SessionIncident = z
  .object({
    incidentId: Id,
    taxonomyCode: NonEmptyText,
    scope: z.enum(['localized', 'systemic']),
    status: z.enum(['open', 'resolved']),
    occurredAt: IsoDateTime,
  })
  .strict();

const AuthoritativeDecisionMaker = z.enum(['engine', 'verifier', 'human', 'system']);

export const SessionDecisionAutonomy = z
  .object({
    decisionId: Id,
    decisionType: z.enum([
      'session.primary.transitioned',
      'session.transversal.changed',
      'session.projection.updated',
    ]),
    decisionMaker: AuthoritativeDecisionMaker,
    autonomyStatus: EventAutonomyStatus,
    reasonCode: NonEmptyText,
    occurredAt: IsoDateTime,
  })
  .strict();

export const SessionNextStep = z
  .object({
    stepId: Id,
    action: NonEmptyText,
    targetId: OptionalId,
    plannedAt: IsoDateTime.nullable(),
  })
  .strict();

const OperationalMasteryByKc = z.record(Id, OperationalMastery);
const NearTransferByKc = z.record(Id, NearTransferState);
const PracticeScheduleByKc = z.record(Id, PracticeSchedule);

const StateShape = {
  schemaVersion: z.literal(SESSION_STATE_SCHEMA_VERSION),
  revision: z.number().int().nonnegative(),
  sessionId: Id,
  runId: Id,
  participantPseudoId: Id,
  courseId: Id,
  packageVersion: VersionRef,
  primaryState: PrimarySessionState,
  transverseStates: uniqueArray(SessionTransversalState, 'transverseStates'),
  currentBlock: SessionBlock.nullable(),
  timing: SessionTiming,
  activeKcIds: uniqueArray(Id, 'activeKcIds'),
  operationalMastery: OperationalMasteryByKc,
  pedagogicalMode: PedagogicalMode,
  selectedStrategy: PedagogicalStrategy.nullable(),
  assistanceLevel: z.number().int().min(0).max(5),
  masteryEligibility: z.boolean(),
  scaffoldingStage: ScaffoldingStage,
  observedErrors: z.array(ObservedError),
  assistanceByAttempt: z.array(AttemptAssistance),
  attemptMasteryEligibility: z.array(AttemptMasteryEligibility),
  nearTransfer: NearTransferByKc,
  practiceSchedule: PracticeScheduleByKc,
  wheelSpinning: WheelSpinningState,
  consumedActivityIds: uniqueArray(Id, 'consumedActivityIds'),
  pendingDoubts: z.array(PendingDoubt),
  planChanges: z.array(SessionPlanChange),
  incidents: z.array(SessionIncident),
  decisionAutonomy: z.array(SessionDecisionAutonomy),
  nextSteps: z.array(SessionNextStep),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
};

function addDuplicateIdIssues(
  values: readonly Record<string, unknown>[],
  field: string,
  path: string,
  context: z.core.$RefinementCtx<unknown>,
): void {
  const seen = new Set<unknown>();
  for (const [index, value] of values.entries()) {
    const id = value[field];
    if (seen.has(id)) {
      context.addIssue({ code: 'custom', message: `${path}: id duplicado`, path: [path, index, field] });
    }
    seen.add(id);
  }
}

/** Proyección íntegra exigida por P-I §8.2 y las propiedades de P-II §7.1. */
export const SessionStructuredState = z
  .object(StateShape)
  .strict()
  .superRefine((state, context) => {
    addDuplicateIdIssues(state.observedErrors, 'observationId', 'observedErrors', context);
    addDuplicateIdIssues(state.assistanceByAttempt, 'attemptId', 'assistanceByAttempt', context);
    addDuplicateIdIssues(
      state.attemptMasteryEligibility,
      'attemptId',
      'attemptMasteryEligibility',
      context,
    );
    addDuplicateIdIssues(state.pendingDoubts, 'doubtId', 'pendingDoubts', context);
    addDuplicateIdIssues(state.planChanges, 'changeId', 'planChanges', context);
    addDuplicateIdIssues(state.incidents, 'incidentId', 'incidents', context);
    addDuplicateIdIssues(state.decisionAutonomy, 'decisionId', 'decisionAutonomy', context);
    addDuplicateIdIssues(state.nextSteps, 'stepId', 'nextSteps', context);
    if (Date.parse(state.updatedAt) < Date.parse(state.createdAt)) {
      context.addIssue({
        code: 'custom',
        message: 'updatedAt no puede preceder a createdAt',
        path: ['updatedAt'],
      });
    }
    if (
      state.pedagogicalMode === 'MEASUREMENT_MODE' &&
      (state.selectedStrategy !== null || state.assistanceLevel !== 0 || state.masteryEligibility)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'MEASUREMENT_MODE no admite estrategia, ayuda ni elegibilidad de dominio',
        path: ['pedagogicalMode'],
      });
    }
  });
export type SessionStructuredState = z.infer<typeof SessionStructuredState>;

const ProjectionChanges = z
  .object({
    currentBlock: SessionBlock.nullable().optional(),
    timing: SessionTiming.optional(),
    activeKcIds: uniqueArray(Id, 'activeKcIds').optional(),
    operationalMastery: OperationalMasteryByKc.optional(),
    pedagogicalMode: PedagogicalMode.optional(),
    selectedStrategy: PedagogicalStrategy.nullable().optional(),
    assistanceLevel: z.number().int().min(0).max(5).optional(),
    masteryEligibility: z.boolean().optional(),
    scaffoldingStage: ScaffoldingStage.optional(),
    observedErrors: z.array(ObservedError).optional(),
    assistanceByAttempt: z.array(AttemptAssistance).optional(),
    attemptMasteryEligibility: z.array(AttemptMasteryEligibility).optional(),
    nearTransfer: NearTransferByKc.optional(),
    practiceSchedule: PracticeScheduleByKc.optional(),
    wheelSpinning: WheelSpinningState.optional(),
    consumedActivityIds: uniqueArray(Id, 'consumedActivityIds').optional(),
    pendingDoubts: z.array(PendingDoubt).optional(),
    planChanges: z.array(SessionPlanChange).optional(),
    incidents: z.array(SessionIncident).optional(),
    nextSteps: z.array(SessionNextStep).optional(),
  })
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, 'la actualización no puede estar vacía');
export type SessionProjectionChanges = z.infer<typeof ProjectionChanges>;

const InitializationPayload = z
  .object({
    sessionId: Id,
    runId: Id,
    participantPseudoId: Id,
    courseId: Id,
    packageVersion: VersionRef,
    plannedDurationSeconds: z.number().int().positive(),
  })
  .strict();
export type SessionInitialization = z.infer<typeof InitializationPayload>;

const EventCommonShape = {
  eventId: Id,
  occurredAt: IsoDateTime,
  resultingStateHash: Sha256Hex,
};

const DecisionEventCommonShape = {
  ...EventCommonShape,
  sequenceNumber: z.number().int().positive(),
  previousStateHash: Sha256Hex,
  decisionMaker: AuthoritativeDecisionMaker,
  autonomyStatus: EventAutonomyStatus,
};

export const SessionInitializedEvent = z
  .object({
    ...EventCommonShape,
    eventType: z.literal('session.initialized'),
    sequenceNumber: z.literal(0),
    previousStateHash: z.literal(SESSION_STATE_GENESIS),
    decisionMaker: z.literal('system'),
    autonomyStatus: z.literal('automatic-control'),
    payload: InitializationPayload,
  })
  .strict();

export const SessionPrimaryTransitionedEvent = z
  .object({
    ...DecisionEventCommonShape,
    eventType: z.literal('session.primary.transitioned'),
    payload: z
      .object({ from: PrimarySessionState, to: PrimarySessionState, reasonCode: NonEmptyText })
      .strict(),
  })
  .strict();

export const SessionTransversalChangedEvent = z
  .object({
    ...DecisionEventCommonShape,
    eventType: z.literal('session.transversal.changed'),
    payload: z
      .object({ state: SessionTransversalState, active: z.boolean(), reasonCode: NonEmptyText })
      .strict(),
  })
  .strict();

export const SessionProjectionUpdatedEvent = z
  .object({
    ...DecisionEventCommonShape,
    eventType: z.literal('session.projection.updated'),
    payload: z.object({ changes: ProjectionChanges, reasonCode: NonEmptyText }).strict(),
  })
  .strict();

export const SessionStateEvent = z.discriminatedUnion('eventType', [
  SessionInitializedEvent,
  SessionPrimaryTransitionedEvent,
  SessionTransversalChangedEvent,
  SessionProjectionUpdatedEvent,
]);
export type SessionStateEvent = z.infer<typeof SessionStateEvent>;
export type SessionInitializedEvent = z.infer<typeof SessionInitializedEvent>;
export type SessionDecisionEvent = Exclude<SessionStateEvent, SessionInitializedEvent>;

export const SessionDecisionMetadata = z
  .object({
    eventId: Id,
    occurredAt: IsoDateTime,
    decisionMaker: AuthoritativeDecisionMaker,
    autonomyStatus: EventAutonomyStatus,
  })
  .strict();
export type SessionDecisionMetadata = z.infer<typeof SessionDecisionMetadata>;

export const SessionInitializationMetadata = z
  .object({ eventId: Id, occurredAt: IsoDateTime })
  .strict();
export type SessionInitializationMetadata = z.infer<typeof SessionInitializationMetadata>;

export type SessionStateErrorCode =
  | 'BKT_SHADOW_DISABLED'
  | 'INVALID_EVENT'
  | 'INVALID_EVENT_SEQUENCE'
  | 'INVALID_STATE'
  | 'INVALID_TRANSITION'
  | 'PERSISTENCE_MISMATCH'
  | 'STATE_HASH_MISMATCH';

export class SessionStateMachineError extends Error {
  constructor(
    readonly code: SessionStateErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface SessionSnapshot {
  readonly state: SessionStructuredState;
  readonly projectionHash: string;
}

export interface SessionMutation {
  readonly event: SessionStateEvent;
  readonly snapshot: SessionSnapshot;
}

function hasBktShadowProperty(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.hasOwnProperty.call(value, 'masteryProbabilityShadow')
  );
}

function rejectBktShadowProperty(value: unknown): void {
  if (hasBktShadowProperty(value)) {
    throw new SessionStateMachineError(
      'BKT_SHADOW_DISABLED',
      'masteryProbabilityShadow está prohibido: CAL-11 no se ejecutó y BKT quedó deshabilitado.',
    );
  }
}

/** JSON canónico para que el hash no dependa del orden de propiedades. */
function canonicalJson(value: unknown, seen = new Set<object>()): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new SessionStateMachineError('INVALID_STATE', 'el estado contiene un número no finito');
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value !== 'object') {
    throw new SessionStateMachineError(
      'INVALID_STATE',
      `el estado contiene un valor no serializable (${typeof value})`,
    );
  }
  if (seen.has(value)) {
    throw new SessionStateMachineError('INVALID_STATE', 'el estado contiene una referencia circular');
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => canonicalJson(entry, seen)).join(',')}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new SessionStateMachineError('INVALID_STATE', 'el estado solo admite objetos JSON planos');
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key], seen)}`)
      .join(',')}}`;
  } finally {
    seen.delete(value);
  }
}

function parseState(value: unknown): SessionStructuredState {
  rejectBktShadowProperty(value);
  const parsed = SessionStructuredState.safeParse(value);
  if (!parsed.success) {
    throw new SessionStateMachineError('INVALID_STATE', z.prettifyError(parsed.error));
  }
  return parsed.data;
}

function hashParsedState(state: SessionStructuredState): string {
  return createHash('sha256').update(canonicalJson(state), 'utf8').digest('hex');
}

/** Hash reproducible de una proyección válida. */
export function sessionStateHash(value: unknown): string {
  return hashParsedState(parseState(value));
}

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (typeof value !== 'object' || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

function snapshot(stateValue: unknown, expectedHash?: string): SessionSnapshot {
  const state = parseState(stateValue);
  const projectionHash = hashParsedState(state);
  if (expectedHash !== undefined && projectionHash !== expectedHash) {
    throw new SessionStateMachineError(
      'STATE_HASH_MISMATCH',
      `hash de proyección inválido: esperado ${expectedHash}, calculado ${projectionHash}`,
    );
  }
  return deepFreeze({ state: deepFreeze(state), projectionHash });
}

function assertSnapshotIntegrity(value: SessionSnapshot): void {
  const actual = sessionStateHash(value.state);
  if (actual !== value.projectionHash) {
    throw new SessionStateMachineError(
      'STATE_HASH_MISMATCH',
      `snapshot alterado: declaró ${value.projectionHash}, calculó ${actual}`,
    );
  }
}

function initialState(event: SessionInitializedEvent): SessionStructuredState {
  const { payload } = event;
  return parseState({
    schemaVersion: SESSION_STATE_SCHEMA_VERSION,
    revision: 0,
    sessionId: payload.sessionId,
    runId: payload.runId,
    participantPseudoId: payload.participantPseudoId,
    courseId: payload.courseId,
    packageVersion: payload.packageVersion,
    primaryState: 'preparada',
    transverseStates: [],
    currentBlock: null,
    timing: {
      plannedDurationSeconds: payload.plannedDurationSeconds,
      elapsedSeconds: 0,
      startedAt: null,
      endedAt: null,
    },
    activeKcIds: [],
    operationalMastery: {},
    pedagogicalMode: 'LEARNING_MODE',
    selectedStrategy: null,
    assistanceLevel: 0,
    masteryEligibility: false,
    scaffoldingStage: 'none',
    observedErrors: [],
    assistanceByAttempt: [],
    attemptMasteryEligibility: [],
    nearTransfer: {},
    practiceSchedule: {},
    wheelSpinning: { active: false, kcIds: [], thresholdVersion: null },
    consumedActivityIds: [],
    pendingDoubts: [],
    planChanges: [],
    incidents: [],
    decisionAutonomy: [],
    nextSteps: [],
    createdAt: event.occurredAt,
    updatedAt: event.occurredAt,
  });
}

const TRANSVERSAL_ORDER = new Map(
  SESSION_TRANSVERSAL_STATES.map((state, index) => [state, index] as const),
);

function assertDecisionEventHeader(snapshotValue: SessionSnapshot, event: SessionDecisionEvent): void {
  assertSnapshotIntegrity(snapshotValue);
  const expectedSequence = snapshotValue.state.revision + 1;
  if (event.sequenceNumber !== expectedSequence) {
    throw new SessionStateMachineError(
      'INVALID_EVENT_SEQUENCE',
      `se esperaba secuencia ${expectedSequence}, se recibió ${event.sequenceNumber}`,
    );
  }
  if (event.previousStateHash !== snapshotValue.projectionHash) {
    throw new SessionStateMachineError(
      'STATE_HASH_MISMATCH',
      `previousStateHash no coincide con la proyección en revisión ${snapshotValue.state.revision}`,
    );
  }
  if (Date.parse(event.occurredAt) < Date.parse(snapshotValue.state.updatedAt)) {
    throw new SessionStateMachineError(
      'INVALID_EVENT_SEQUENCE',
      'occurredAt no puede retroceder respecto del último evento',
    );
  }
}

function decisionRecord(event: SessionDecisionEvent): z.infer<typeof SessionDecisionAutonomy> {
  return {
    decisionId: event.eventId,
    decisionType: event.eventType,
    decisionMaker: event.decisionMaker,
    autonomyStatus: event.autonomyStatus,
    reasonCode: event.payload.reasonCode,
    occurredAt: event.occurredAt,
  };
}

function reduceDecisionEvent(
  snapshotValue: SessionSnapshot,
  event: SessionDecisionEvent,
): SessionStructuredState {
  assertDecisionEventHeader(snapshotValue, event);
  const current = snapshotValue.state;
  let changed: Record<string, unknown>;

  switch (event.eventType) {
    case 'session.primary.transitioned': {
      if (event.decisionMaker !== 'engine') {
        throw new SessionStateMachineError(
          'INVALID_TRANSITION',
          'solo el motor puede decidir una transición primaria',
        );
      }
      if (event.payload.from !== current.primaryState) {
        throw new SessionStateMachineError(
          'INVALID_TRANSITION',
          `la transición declara ${event.payload.from}, pero el estado actual es ${current.primaryState}`,
        );
      }
      const index = SESSION_STATES.indexOf(current.primaryState);
      const expected = SESSION_STATES[index + 1];
      if (event.payload.to !== expected) {
        throw new SessionStateMachineError(
          'INVALID_TRANSITION',
          expected === undefined
            ? 'cierre es terminal'
            : `desde ${current.primaryState} solo se permite ${expected}`,
        );
      }
      changed = { ...current, primaryState: event.payload.to };
      break;
    }
    case 'session.transversal.changed': {
      if (event.decisionMaker !== 'engine') {
        throw new SessionStateMachineError(
          'INVALID_TRANSITION',
          'solo el motor puede decidir la entrada o salida de un estado transversal',
        );
      }
      const present = current.transverseStates.includes(event.payload.state);
      if (present === event.payload.active) {
        throw new SessionStateMachineError(
          'INVALID_TRANSITION',
          `${event.payload.state} ya está ${present ? 'activo' : 'inactivo'}`,
        );
      }
      const transverseStates = event.payload.active
        ? [...current.transverseStates, event.payload.state]
        : current.transverseStates.filter((state) => state !== event.payload.state);
      transverseStates.sort(
        (left, right) => (TRANSVERSAL_ORDER.get(left) ?? 0) - (TRANSVERSAL_ORDER.get(right) ?? 0),
      );
      changed = { ...current, transverseStates };
      break;
    }
    case 'session.projection.updated':
      rejectBktShadowProperty(event.payload.changes);
      changed = { ...current, ...event.payload.changes };
      break;
  }

  return parseState({
    ...changed,
    revision: event.sequenceNumber,
    updatedAt: event.occurredAt,
    decisionAutonomy: [...current.decisionAutonomy, decisionRecord(event)],
  });
}

function parseEvent(value: unknown): SessionStateEvent {
  if (
    typeof value === 'object' &&
    value !== null &&
    'payload' in value &&
    typeof value.payload === 'object' &&
    value.payload !== null &&
    'changes' in value.payload
  ) {
    rejectBktShadowProperty(value.payload.changes);
  }
  const parsed = SessionStateEvent.safeParse(value);
  if (!parsed.success) {
    throw new SessionStateMachineError('INVALID_EVENT', z.prettifyError(parsed.error));
  }
  return parsed.data;
}

/** Aplica un evento externo y verifica secuencia, hash previo y hash resultante. */
export function applySessionStateEvent(
  current: SessionSnapshot | undefined,
  eventValue: unknown,
): SessionSnapshot {
  const event = parseEvent(eventValue);
  if (current === undefined) {
    if (event.eventType !== 'session.initialized') {
      throw new SessionStateMachineError(
        'INVALID_EVENT_SEQUENCE',
        'el primer evento debe ser session.initialized',
      );
    }
    return snapshot(initialState(event), event.resultingStateHash);
  }
  if (event.eventType === 'session.initialized') {
    throw new SessionStateMachineError(
      'INVALID_EVENT_SEQUENCE',
      'session.initialized solo puede aparecer como primer evento',
    );
  }
  return snapshot(reduceDecisionEvent(current, event), event.resultingStateHash);
}

function finalizedMutation(
  current: SessionSnapshot,
  draft: SessionDecisionEvent,
): SessionMutation {
  const nextState = reduceDecisionEvent(current, draft);
  const projectionHash = hashParsedState(nextState);
  const event = parseEvent({ ...draft, resultingStateHash: projectionHash });
  return deepFreeze({ event, snapshot: snapshot(nextState, projectionHash) });
}

/** Crea el único estado inicial autorizado; no acepta snapshots parciales. */
export function initializeSessionState(
  initializationValue: SessionInitialization,
  metadataValue: SessionInitializationMetadata,
): SessionMutation {
  rejectBktShadowProperty(initializationValue);
  const initialization = InitializationPayload.parse(initializationValue);
  const metadata = SessionInitializationMetadata.parse(metadataValue);
  const draft = SessionInitializedEvent.parse({
    eventType: 'session.initialized',
    eventId: metadata.eventId,
    sequenceNumber: 0,
    occurredAt: metadata.occurredAt,
    previousStateHash: SESSION_STATE_GENESIS,
    resultingStateHash: '0'.repeat(64),
    decisionMaker: 'system',
    autonomyStatus: 'automatic-control',
    payload: initialization,
  });
  const state = initialState(draft);
  const projectionHash = hashParsedState(state);
  const event = SessionInitializedEvent.parse({ ...draft, resultingStateHash: projectionHash });
  return deepFreeze({ event, snapshot: snapshot(state, projectionHash) });
}

function decisionHeader(current: SessionSnapshot, metadataValue: SessionDecisionMetadata) {
  assertSnapshotIntegrity(current);
  const metadata = SessionDecisionMetadata.parse(metadataValue);
  return {
    eventId: metadata.eventId,
    sequenceNumber: current.state.revision + 1,
    occurredAt: metadata.occurredAt,
    previousStateHash: current.projectionHash,
    resultingStateHash: '0'.repeat(64),
    decisionMaker: metadata.decisionMaker,
    autonomyStatus: metadata.autonomyStatus,
  };
}

/** Avanza exactamente una posición en la secuencia literal de P-II §7.1. */
export function transitionPrimarySessionState(
  current: SessionSnapshot,
  to: z.infer<typeof PrimarySessionState>,
  reasonCode: string,
  metadata: SessionDecisionMetadata,
): SessionMutation {
  const draft = SessionPrimaryTransitionedEvent.parse({
    ...decisionHeader(current, metadata),
    eventType: 'session.primary.transitioned',
    payload: { from: current.state.primaryState, to, reasonCode },
  });
  return finalizedMutation(current, draft);
}

/** Activa o desactiva un estado transversal sin ocultar el estado principal. */
export function changeTransversalSessionState(
  current: SessionSnapshot,
  state: z.infer<typeof SessionTransversalState>,
  active: boolean,
  reasonCode: string,
  metadata: SessionDecisionMetadata,
): SessionMutation {
  const draft = SessionTransversalChangedEvent.parse({
    ...decisionHeader(current, metadata),
    eventType: 'session.transversal.changed',
    payload: { state, active, reasonCode },
  });
  return finalizedMutation(current, draft);
}

/**
 * Reemplaza campos estructurados completos. Identidad, versiones, revisión,
 * estados literales y autonomía quedan fuera del patch y solo cambian por sus
 * eventos autoritativos.
 */
export function updateSessionProjection(
  current: SessionSnapshot,
  changesValue: SessionProjectionChanges,
  reasonCode: string,
  metadata: SessionDecisionMetadata,
): SessionMutation {
  rejectBktShadowProperty(changesValue);
  const changes = ProjectionChanges.parse(changesValue);
  const draft = SessionProjectionUpdatedEvent.parse({
    ...decisionHeader(current, metadata),
    eventType: 'session.projection.updated',
    payload: { changes, reasonCode },
  });
  return finalizedMutation(current, draft);
}

/** Replay total: no tolera huecos, reordenamientos, duplicados ni alteraciones. */
export function replaySessionStateEvents(events: readonly unknown[]): SessionSnapshot {
  if (events.length === 0) {
    throw new SessionStateMachineError('INVALID_EVENT_SEQUENCE', 'el replay exige al menos un evento');
  }
  const eventIds = new Set<string>();
  let current: SessionSnapshot | undefined;
  for (const eventValue of events) {
    const event = parseEvent(eventValue);
    if (eventIds.has(event.eventId)) {
      throw new SessionStateMachineError(
        'INVALID_EVENT_SEQUENCE',
        `eventId duplicado: ${event.eventId}`,
      );
    }
    eventIds.add(event.eventId);
    current = applySessionStateEvent(current, event);
  }
  if (current === undefined) {
    throw new SessionStateMachineError('INVALID_EVENT_SEQUENCE', 'replay vacío');
  }
  return current;
}

/** Forma exacta de la fila `pedagogy.session_state`. */
export interface SessionStatePersistenceRow {
  readonly session_id: string;
  readonly run_id: string;
  readonly participant_pseudo_id: string;
  readonly course_id: string;
  readonly state: z.infer<typeof PrimarySessionState>;
  readonly pedagogical_mode: z.infer<typeof PedagogicalMode>;
  readonly selected_strategy: z.infer<typeof PedagogicalStrategy> | null;
  readonly assistance_level: number;
  readonly structured_state: unknown;
  readonly projection_hash: string;
  readonly updated_at: string | Date;
}

export function toSessionStatePersistenceRow(
  current: SessionSnapshot,
): SessionStatePersistenceRow {
  assertSnapshotIntegrity(current);
  const state = current.state;
  return {
    session_id: state.sessionId,
    run_id: state.runId,
    participant_pseudo_id: state.participantPseudoId,
    course_id: state.courseId,
    state: state.primaryState,
    pedagogical_mode: state.pedagogicalMode,
    selected_strategy: state.selectedStrategy,
    assistance_level: state.assistanceLevel,
    structured_state: state,
    projection_hash: current.projectionHash,
    updated_at: state.updatedAt,
  };
}

function parseJsonColumn(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new SessionStateMachineError('PERSISTENCE_MISMATCH', 'structured_state no es JSON válido');
  }
}

/** Restaura la fila solo si el JSON, el hash y todas sus columnas escalares coinciden. */
export function restoreSessionStateSnapshot(row: SessionStatePersistenceRow): SessionSnapshot {
  const stateValue = parseJsonColumn(row.structured_state);
  rejectBktShadowProperty(stateValue);
  const restored = snapshot(stateValue, row.projection_hash);
  const state = restored.state;
  const mismatches: string[] = [];
  if (row.session_id !== state.sessionId) mismatches.push('session_id');
  if (row.run_id !== state.runId) mismatches.push('run_id');
  if (row.participant_pseudo_id !== state.participantPseudoId) mismatches.push('participant_pseudo_id');
  if (row.course_id !== state.courseId) mismatches.push('course_id');
  if (row.state !== state.primaryState) mismatches.push('state');
  if (row.pedagogical_mode !== state.pedagogicalMode) mismatches.push('pedagogical_mode');
  if (row.selected_strategy !== state.selectedStrategy) mismatches.push('selected_strategy');
  if (row.assistance_level !== state.assistanceLevel) mismatches.push('assistance_level');
  const updatedAt = row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at;
  if (Date.parse(updatedAt) !== Date.parse(state.updatedAt)) mismatches.push('updated_at');
  if (mismatches.length > 0) {
    throw new SessionStateMachineError(
      'PERSISTENCE_MISMATCH',
      `columnas escalares inconsistentes con structured_state: ${mismatches.join(', ')}`,
    );
  }
  return restored;
}
