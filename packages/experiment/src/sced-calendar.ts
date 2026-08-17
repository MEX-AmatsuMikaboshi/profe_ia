import { createHash } from 'node:crypto';
import {
  Id,
  IsoDateTime,
  ProbeOpportunityResult,
  ProbeRequest,
  Sha256Hex,
  type ProbeOpportunityResult as ProbeOpportunityResultValue,
  type ProbeRequest as ProbeRequestValue,
} from '@profesor-ia/contracts';
import { z } from 'zod';
import { SCED_OPPORTUNITY_H5_V1 } from './sced-opportunity.js';

/** T-H6-07 — calendario SCED global, determinista y reconstruible. */
export const SCED_CALENDAR_POLICY_SCHEMA_VERSION = 'sced-calendar-policy-v1' as const;
export const SCED_CALENDAR_SEED_SCHEMA_VERSION = 'sced-calendar-seed-v1' as const;
export const SCED_CALENDAR_STATE_SCHEMA_VERSION = 'sced-calendar-state-v1' as const;

export const SCED_SET_IDS = ['A', 'B', 'C'] as const;
export const ScedSetId = z.enum(SCED_SET_IDS);
export type ScedSetId = z.infer<typeof ScedSetId>;

export const SCED_NON_ROUND_ACTIVITY_KINDS = [
  'transfer_measurement',
  'retention',
  'familiarization',
  'diagnostic',
  'post_mastery_reconfirmation',
] as const;
export const ScedNonRoundActivityKind = z.enum(SCED_NON_ROUND_ACTIVITY_KINDS);
export type ScedNonRoundActivityKind = z.infer<typeof ScedNonRoundActivityKind>;

const Purpose = z.enum(['material', 'test_fixture']);
const NonEmptyText = z.string().trim().min(1).max(8_000);
const ShortText = z.string().trim().min(1).max(500);
const Probability = z.number().min(0).max(1);
const StartPoints = z.object({ A: z.number().int(), B: z.number().int(), C: z.number().int() }).strict();

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (typeof value !== 'object' || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

function canonicalJson(value: unknown, seen = new Set<object>()): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new ScedCalendarError('INVALID_ARTIFACT', 'número no finito');
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value !== 'object') {
    throw new ScedCalendarError('INVALID_ARTIFACT', 'valor no serializable');
  }
  if (seen.has(value)) throw new ScedCalendarError('INVALID_ARTIFACT', 'referencia circular');
  seen.add(value);
  try {
    if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry, seen)).join(',')}]`;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new ScedCalendarError('INVALID_ARTIFACT', 'solo se admiten objetos JSON planos');
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

function hashJson(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

function opaqueId(prefix: string, ...parts: readonly string[]): string {
  return `${prefix}-${hashJson(parts).slice(0, 32)}`;
}

function addUtcCalendarDays(value: string, days: number): string {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function uniqueBy<T extends z.ZodType>(schema: T, key: (value: z.output<T>) => unknown, label: string) {
  return z.array(schema).superRefine((values, context) => {
    const seen = new Set<unknown>();
    for (const [index, value] of values.entries()) {
      const candidate = key(value);
      if (seen.has(candidate)) context.addIssue({ code: 'custom', message: `${label} duplicado`, path: [index] });
      seen.add(candidate);
    }
  });
}

export type ScedCalendarErrorCode =
  | 'ACTIVE_ROUND_EXISTS'
  | 'ARTIFACT_HASH_MISMATCH'
  | 'CALENDAR_COMPLETE'
  | 'INVALID_ARTIFACT'
  | 'INVALID_EVENT'
  | 'INVALID_EVENT_SEQUENCE'
  | 'INVALID_RESULT'
  | 'INVALID_STATE'
  | 'MATERIAL_FREEZE_REQUIRED'
  | 'OPPORTUNITY_NOT_ACTIVE'
  | 'RETENTION_BLACKOUT'
  | 'RETENTION_NOT_DUE'
  | 'RETENTION_NOT_SCHEDULED'
  | 'ROUND_NOT_ACTIVE'
  | 'RUN_NOT_BOUND'
  | 'RUN_POLICY_DRIFT';

export class ScedCalendarError extends Error {
  constructor(
    readonly code: ScedCalendarErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const Windows = z
  .object({
    A: z.object({ start: z.literal(6), end: z.literal(8) }).strict(),
    B: z.object({ start: z.literal(9), end: z.literal(11) }).strict(),
    C: z.object({ start: z.literal(12), end: z.literal(14) }).strict(),
  })
  .strict();

export const ScedCalendarPolicyDefinition = z
  .object({
    schemaVersion: z.literal(SCED_CALENDAR_POLICY_SCHEMA_VERSION),
    policyVersion: ShortText,
    purpose: Purpose,
    authority: z.literal('measurement_worker'),
    roundUnit: z.literal('probe_round'),
    requiredSets: z.tuple([z.literal('A'), z.literal('B'), z.literal('C')]),
    windows: Windows,
    plannedPointSelection: z.literal('sha256-ranked-restricted-triples-v1'),
    minimumStartSeparationValidRounds: z.literal(3),
    maximumExtensionValidRounds: z.literal(2),
    stabilityRule: z
      .object({
        lastValidObservations: z.literal(3),
        requireNotStrictlyIncreasing: z.literal(true),
        recentHistoricMaxima: z.literal(2),
        requireNotSuccessiveHistoricMaxima: z.literal(true),
      })
      .strict(),
    roundValidityRule: z.literal('all_required_sets_valid'),
    partialValidDataUse: z.literal('descriptive_only'),
    opportunityDefinition: z
      .object({
        version: z.literal(SCED_OPPORTUNITY_H5_V1.version),
        kSet: z.literal(SCED_OPPORTUNITY_H5_V1.kSet),
        minValidItemsPerOpportunity: z.literal(
          SCED_OPPORTUNITY_H5_V1.minValidItemsPerOpportunity,
        ),
        requiredValidRounds: z.literal(
          SCED_OPPORTUNITY_H5_V1.coverageEnvelope.requiredValidRounds,
        ),
      })
      .strict(),
    nonRoundActivities: z.tuple([
      z.literal('transfer_measurement'),
      z.literal('retention'),
      z.literal('familiarization'),
      z.literal('diagnostic'),
      z.literal('post_mastery_reconfirmation'),
    ]),
    retentionRule: z
      .object({
        unit: z.literal('experimental_set'),
        intervalCalendarDays: z.literal(7),
        clockStartsAt: z.literal('set_mastery_timestamp'),
        reserve: z.literal('retention'),
        directedTargetReteachingBlocked: z.literal(true),
        countsAsProbeRound: z.literal(false),
      })
      .strict(),
    covariationRule: z
      .object({
        recordBaselineChangeDuringOtherSetIntervention: z.literal(true),
      })
      .strict(),
  })
  .strict();
export type ScedCalendarPolicyDefinition = z.infer<typeof ScedCalendarPolicyDefinition>;

export function createScedCalendarPolicyDefinition(input: Readonly<{
  policyVersion: string;
  purpose: z.infer<typeof Purpose>;
}>): ScedCalendarPolicyDefinition {
  return ScedCalendarPolicyDefinition.parse({
    schemaVersion: SCED_CALENDAR_POLICY_SCHEMA_VERSION,
    policyVersion: input.policyVersion,
    purpose: input.purpose,
    authority: 'measurement_worker',
    roundUnit: 'probe_round',
    requiredSets: ['A', 'B', 'C'],
    windows: {
      A: { start: 6, end: 8 },
      B: { start: 9, end: 11 },
      C: { start: 12, end: 14 },
    },
    plannedPointSelection: 'sha256-ranked-restricted-triples-v1',
    minimumStartSeparationValidRounds: 3,
    maximumExtensionValidRounds: 2,
    stabilityRule: {
      lastValidObservations: 3,
      requireNotStrictlyIncreasing: true,
      recentHistoricMaxima: 2,
      requireNotSuccessiveHistoricMaxima: true,
    },
    roundValidityRule: 'all_required_sets_valid',
    partialValidDataUse: 'descriptive_only',
    opportunityDefinition: {
      version: SCED_OPPORTUNITY_H5_V1.version,
      kSet: SCED_OPPORTUNITY_H5_V1.kSet,
      minValidItemsPerOpportunity: SCED_OPPORTUNITY_H5_V1.minValidItemsPerOpportunity,
      requiredValidRounds: SCED_OPPORTUNITY_H5_V1.coverageEnvelope.requiredValidRounds,
    },
    nonRoundActivities: [...SCED_NON_ROUND_ACTIVITY_KINDS],
    retentionRule: {
      unit: 'experimental_set',
      intervalCalendarDays: 7,
      clockStartsAt: 'set_mastery_timestamp',
      reserve: 'retention',
      directedTargetReteachingBlocked: true,
      countsAsProbeRound: false,
    },
    covariationRule: { recordBaselineChangeDuringOtherSetIntervention: true },
  });
}

export interface CompiledScedCalendarPolicy {
  readonly definition: ScedCalendarPolicyDefinition;
  readonly policyHash: string;
}

export function compileScedCalendarPolicy(
  value: unknown,
  expectedHash?: string,
): CompiledScedCalendarPolicy {
  const parsed = ScedCalendarPolicyDefinition.safeParse(value);
  if (!parsed.success) throw new ScedCalendarError('INVALID_ARTIFACT', z.prettifyError(parsed.error));
  const policyHash = hashJson(parsed.data);
  if (expectedHash !== undefined && expectedHash !== policyHash) {
    throw new ScedCalendarError('ARTIFACT_HASH_MISMATCH', 'hash de política SCED inválido');
  }
  return deepFreeze({ definition: deepFreeze(parsed.data), policyHash });
}

export const ScedCalendarSeedDefinition = z
  .object({
    schemaVersion: z.literal(SCED_CALENDAR_SEED_SCHEMA_VERSION),
    seedVersion: ShortText,
    purpose: Purpose,
    seedId: Id,
    seedValue: NonEmptyText,
  })
  .strict();
export type ScedCalendarSeedDefinition = z.infer<typeof ScedCalendarSeedDefinition>;

export interface CompiledScedCalendarSeed {
  readonly definition: ScedCalendarSeedDefinition;
  readonly seedHash: string;
}

export function compileScedCalendarSeed(
  value: unknown,
  expectedHash?: string,
): CompiledScedCalendarSeed {
  const parsed = ScedCalendarSeedDefinition.safeParse(value);
  if (!parsed.success) throw new ScedCalendarError('INVALID_ARTIFACT', z.prettifyError(parsed.error));
  const seedHash = hashJson(parsed.data);
  if (expectedHash !== undefined && expectedHash !== seedHash) {
    throw new ScedCalendarError('ARTIFACT_HASH_MISMATCH', 'hash de semilla SCED inválido');
  }
  return deepFreeze({ definition: deepFreeze(parsed.data), seedHash });
}

interface RankedStartPoints {
  readonly starts: z.infer<typeof StartPoints>;
  readonly rank: string;
}

export function deriveRestrictedPlannedStarts(
  policy: CompiledScedCalendarPolicy,
  seed: CompiledScedCalendarSeed,
  runId: string,
): z.infer<typeof StartPoints> {
  Id.parse(runId);
  const { windows, minimumStartSeparationValidRounds: separation } = policy.definition;
  const candidates: RankedStartPoints[] = [];
  for (let A = windows.A.start; A <= windows.A.end; A += 1) {
    for (let B = windows.B.start; B <= windows.B.end; B += 1) {
      for (let C = windows.C.start; C <= windows.C.end; C += 1) {
        if (B - A < separation || C - B < separation) continue;
        const starts = StartPoints.parse({ A, B, C });
        candidates.push({
          starts,
          rank: hashJson({
            algorithm: policy.definition.plannedPointSelection,
            seedValue: seed.definition.seedValue,
            runId,
            starts,
          }),
        });
      }
    }
  }
  candidates.sort((left, right) => left.rank.localeCompare(right.rank) || canonicalJson(left.starts).localeCompare(canonicalJson(right.starts)));
  const selected = candidates[0];
  if (selected === undefined) {
    throw new ScedCalendarError('INVALID_ARTIFACT', 'las ventanas no contienen un triple con separación válida');
  }
  return deepFreeze(selected.starts);
}

const ScedCalendarRunBinding = z
  .object({
    runId: Id,
    purpose: Purpose,
    policyVersion: ShortText,
    policyHash: Sha256Hex,
    seedVersion: ShortText,
    seedHash: Sha256Hex,
    opportunityDefinitionVersion: z.literal(SCED_OPPORTUNITY_H5_V1.version),
    plannedStarts: StartPoints,
  })
  .strict();
export type ScedCalendarRunBinding = z.infer<typeof ScedCalendarRunBinding>;

function bindingMatches(
  binding: ScedCalendarRunBinding,
  policy: CompiledScedCalendarPolicy,
  seed: CompiledScedCalendarSeed,
): boolean {
  return (
    binding.purpose === policy.definition.purpose &&
    binding.purpose === seed.definition.purpose &&
    binding.policyVersion === policy.definition.policyVersion &&
    binding.policyHash === policy.policyHash &&
    binding.seedVersion === seed.definition.seedVersion &&
    binding.seedHash === seed.seedHash &&
    binding.opportunityDefinitionVersion === policy.definition.opportunityDefinition.version &&
    canonicalJson(binding.plannedStarts) ===
      canonicalJson(deriveRestrictedPlannedStarts(policy, seed, binding.runId))
  );
}

export class ScedCalendarRunRegistry {
  readonly #bindings = new Map<string, ScedCalendarRunBinding>();

  constructor(restored: readonly unknown[] = []) {
    for (const value of restored) {
      const parsed = ScedCalendarRunBinding.safeParse(value);
      if (!parsed.success) throw new ScedCalendarError('INVALID_ARTIFACT', z.prettifyError(parsed.error));
      const current = this.#bindings.get(parsed.data.runId);
      if (current !== undefined && canonicalJson(current) !== canonicalJson(parsed.data)) {
        throw new ScedCalendarError('RUN_POLICY_DRIFT', `bindings distintos para ${parsed.data.runId}`);
      }
      this.#bindings.set(parsed.data.runId, deepFreeze(parsed.data));
    }
  }

  bind(
    policy: CompiledScedCalendarPolicy,
    seed: CompiledScedCalendarSeed,
    value: unknown,
  ): ScedCalendarRunBinding {
    const parsed = ScedCalendarRunBinding.safeParse(value);
    if (!parsed.success) throw new ScedCalendarError('INVALID_ARTIFACT', z.prettifyError(parsed.error));
    if (!bindingMatches(parsed.data, policy, seed)) {
      throw new ScedCalendarError('RUN_POLICY_DRIFT', 'binding y artefactos SCED no coinciden');
    }
    const current = this.#bindings.get(parsed.data.runId);
    if (current !== undefined && canonicalJson(current) !== canonicalJson(parsed.data)) {
      throw new ScedCalendarError('RUN_POLICY_DRIFT', `la corrida ${parsed.data.runId} ya está ligada`);
    }
    if (current !== undefined) return current;
    const frozen = deepFreeze(parsed.data);
    this.#bindings.set(parsed.data.runId, frozen);
    return frozen;
  }

  assertBound(
    runId: string,
    policy: CompiledScedCalendarPolicy,
    seed: CompiledScedCalendarSeed,
  ): ScedCalendarRunBinding {
    const binding = this.#bindings.get(runId);
    if (binding === undefined) throw new ScedCalendarError('RUN_NOT_BOUND', `corrida sin binding: ${runId}`);
    if (!bindingMatches(binding, policy, seed)) {
      throw new ScedCalendarError('RUN_POLICY_DRIFT', `artefactos distintos para ${runId}`);
    }
    return binding;
  }

  bindings(): readonly ScedCalendarRunBinding[] {
    return deepFreeze([...this.#bindings.values()]);
  }
}

const ScedObservation = z
  .object({
    validRoundIndex: z.number().int().positive(),
    roundId: Id,
    observation: Probability,
    correctValidItems: z.number().int().nonnegative(),
    validScoredItems: z.number().int().positive(),
  })
  .strict();
export type ScedObservation = z.infer<typeof ScedObservation>;

const StartFailureReason = z.enum([
  'strictly_increasing_last_three',
  'successive_historic_maxima_last_two',
  'minimum_start_separation_not_met',
]);

const ScedStartEvaluation = z
  .object({
    validRoundIndex: z.number().int().positive(),
    lastThreeObservations: z.tuple([Probability, Probability, Probability]),
    strictlyIncreasing: z.boolean(),
    lastTwoSuccessiveHistoricMaxima: z.boolean(),
    separationSatisfied: z.boolean(),
    eligible: z.boolean(),
    failureReasons: z.array(StartFailureReason),
    decision: z.enum(['start_after_round', 'defer', 'not_start_under_preinscription']),
  })
  .strict();
export type ScedStartEvaluation = z.infer<typeof ScedStartEvaluation>;

const EmptyRetentionState = {
  status: 'not_scheduled' as const,
  masteryEventId: null,
  masteryTimestamp: null,
  dueAt: null,
  openEventId: null,
  openedAt: null,
  request: null,
  resultEventId: null,
  resultRecordedAt: null,
  result: null,
};

const ScedRetentionState = z
  .object({
    status: z.enum(['not_scheduled', 'scheduled', 'open', 'completed']),
    masteryEventId: Id.nullable(),
    masteryTimestamp: IsoDateTime.nullable(),
    dueAt: IsoDateTime.nullable(),
    openEventId: Id.nullable(),
    openedAt: IsoDateTime.nullable(),
    request: ProbeRequest.nullable(),
    resultEventId: Id.nullable(),
    resultRecordedAt: IsoDateTime.nullable(),
    result: ProbeOpportunityResult.nullable(),
  })
  .strict();
export type ScedRetentionState = z.infer<typeof ScedRetentionState>;

const ScedSetState = z
  .object({
    setId: ScedSetId,
    windowStart: z.number().int().positive(),
    windowEnd: z.number().int().positive(),
    plannedStart: z.number().int().positive(),
    extensionDeadline: z.number().int().positive(),
    startStatus: z.enum(['pending', 'started', 'not_started_under_preinscription']),
    interventionStartedAfterValidRound: z.number().int().positive().nullable(),
    terminalStartReason: z.literal('preinscription_window_exhausted').nullable(),
    baselineObservations: z.array(ScedObservation),
    interventionObservations: z.array(ScedObservation),
    startEvaluations: z.array(ScedStartEvaluation),
    retention: ScedRetentionState,
  })
  .strict();
export type ScedSetState = z.infer<typeof ScedSetState>;

const ScedRoundOpportunity = z
  .object({
    setId: ScedSetId,
    request: ProbeRequest,
    resultEventId: Id.nullable(),
    resultRecordedAt: IsoDateTime.nullable(),
    result: ProbeOpportunityResult.nullable(),
    scheduleValidity: z.enum(['pending', 'primary_valid', 'schedule_invalid']),
  })
  .strict();
export type ScedRoundOpportunity = z.infer<typeof ScedRoundOpportunity>;

export const ScedProbeRoundState = z
  .object({
    roundId: Id,
    openEventId: Id,
    attemptIndex: z.number().int().positive(),
    targetValidRoundIndex: z.number().int().positive(),
    status: z.enum(['open', 'closed']),
    calendarValidity: z.enum(['pending', 'valid', 'schedule_invalid']),
    reasonCode: z.literal('schedule_invalid').nullable(),
    opportunities: z.array(ScedRoundOpportunity).length(3),
    openedAt: IsoDateTime,
    closedAt: IsoDateTime.nullable(),
  })
  .strict()
  .superRefine((round, context) => {
    if (canonicalJson(round.opportunities.map((entry) => entry.setId)) !== canonicalJson(SCED_SET_IDS)) {
      context.addIssue({ code: 'custom', message: 'oportunidades debe conservar orden A/B/C' });
    }
  });
export type ScedProbeRoundState = z.infer<typeof ScedProbeRoundState>;

const ScedNonRoundActivity = z
  .object({
    eventId: Id,
    activityId: Id,
    kind: ScedNonRoundActivityKind,
    experimentalSet: ScedSetId.nullable(),
    referenceId: Id,
    occurredAt: IsoDateTime,
  })
  .strict();
export type ScedNonRoundActivity = z.infer<typeof ScedNonRoundActivity>;

const ScedTargetInstructionRecord = z
  .object({ eventId: Id, setId: ScedSetId, referenceId: Id, occurredAt: IsoDateTime })
  .strict();
export type ScedTargetInstructionRecord = z.infer<typeof ScedTargetInstructionRecord>;

const ScedCovariationRecord = z
  .object({
    recordId: Id,
    validRoundIndex: z.number().int().positive(),
    roundId: Id,
    unintervenedSet: ScedSetId,
    concurrentInterventionSets: z.array(ScedSetId).min(1),
    previousObservation: Probability,
    observation: Probability,
    direction: z.enum(['increase', 'decrease']),
  })
  .strict();
export type ScedCovariationRecord = z.infer<typeof ScedCovariationRecord>;

export const ScedCalendarState = z
  .object({
    schemaVersion: z.literal(SCED_CALENDAR_STATE_SCHEMA_VERSION),
    revision: z.number().int().nonnegative(),
    runId: Id,
    participantPseudoId: Id,
    policyVersion: ShortText,
    policyHash: Sha256Hex,
    seedVersion: ShortText,
    seedHash: Sha256Hex,
    opportunityDefinitionVersion: z.literal(SCED_OPPORTUNITY_H5_V1.version),
    plannedStarts: StartPoints,
    validRoundCount: z.number().int().nonnegative(),
    roundAttemptCount: z.number().int().nonnegative(),
    activeRoundId: Id.nullable(),
    sets: z.array(ScedSetState).length(3),
    rounds: z.array(ScedProbeRoundState),
    nonRoundActivities: uniqueBy(ScedNonRoundActivity, (value) => value.activityId, 'activityId'),
    targetInstructionRecords: uniqueBy(
      ScedTargetInstructionRecord,
      (value) => value.eventId,
      'eventId de instrucción',
    ),
    covariationRecords: uniqueBy(ScedCovariationRecord, (value) => value.recordId, 'recordId'),
    processedEventIds: uniqueBy(Id, (value) => value, 'eventId'),
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
  })
  .strict()
  .superRefine((state, context) => {
    if (state.processedEventIds.length !== state.revision + 1) {
      context.addIssue({ code: 'custom', message: 'revisión no coincide con eventos' });
    }
    if (state.roundAttemptCount !== state.rounds.length) {
      context.addIssue({ code: 'custom', message: 'roundAttemptCount no coincide con rondas' });
    }
    if (state.validRoundCount > SCED_OPPORTUNITY_H5_V1.coverageEnvelope.requiredValidRounds) {
      context.addIssue({ code: 'custom', message: 'validRoundCount supera el sobre H5' });
    }
    const roundIds = state.rounds.map((round) => round.roundId);
    if (new Set(roundIds).size !== roundIds.length) {
      context.addIssue({ code: 'custom', message: 'roundId duplicado' });
    }
    const ids = state.sets.map((entry) => entry.setId);
    if (canonicalJson(ids) !== canonicalJson(SCED_SET_IDS)) {
      context.addIssue({ code: 'custom', message: 'sets debe conservar orden A/B/C' });
    }
    const open = state.rounds.filter((round) => round.status === 'open');
    if (open.length > 1 || (open[0]?.roundId ?? null) !== state.activeRoundId) {
      context.addIssue({ code: 'custom', message: 'activeRoundId no coincide con rondas' });
    }
    if (Date.parse(state.updatedAt) < Date.parse(state.createdAt)) {
      context.addIssue({ code: 'custom', message: 'updatedAt retrocede' });
    }
  });
export type ScedCalendarState = z.infer<typeof ScedCalendarState>;

const InitializedEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('sced.initialized'),
    sequenceNumber: z.literal(0),
    occurredAt: IsoDateTime,
    payload: z.object({ runId: Id, participantPseudoId: Id }).strict(),
  })
  .strict();

const RoundOpenedEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('sced.round.opened'),
    sequenceNumber: z.number().int().positive(),
    occurredAt: IsoDateTime,
    payload: z.object({ roundId: Id }).strict(),
  })
  .strict();

const RoundResultRecordedEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('sced.round.result_recorded'),
    sequenceNumber: z.number().int().positive(),
    occurredAt: IsoDateTime,
    payload: z.object({ roundId: Id, setId: ScedSetId, result: ProbeOpportunityResult }).strict(),
  })
  .strict();

const NonRoundRecordedEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('sced.non_round.recorded'),
    sequenceNumber: z.number().int().positive(),
    occurredAt: IsoDateTime,
    payload: z
      .object({
        activityId: Id,
        kind: ScedNonRoundActivityKind,
        experimentalSet: ScedSetId.nullable(),
        referenceId: Id,
      })
      .strict(),
  })
  .strict()
  .superRefine((event, context) => {
    if (
      ['transfer_measurement', 'retention', 'post_mastery_reconfirmation'].includes(event.payload.kind) &&
      event.payload.experimentalSet === null
    ) {
      context.addIssue({
        code: 'custom',
        message: 'la actividad no SCED exige conjunto experimental',
        path: ['payload', 'experimentalSet'],
      });
    }
  });

const SetMasteryRecordedEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('sced.set_mastery.recorded'),
    sequenceNumber: z.number().int().positive(),
    occurredAt: IsoDateTime,
    payload: z.object({ setId: ScedSetId }).strict(),
  })
  .strict();

const RetentionOpenedEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('sced.retention.opened'),
    sequenceNumber: z.number().int().positive(),
    occurredAt: IsoDateTime,
    payload: z.object({ setId: ScedSetId }).strict(),
  })
  .strict();

const RetentionResultRecordedEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('sced.retention.result_recorded'),
    sequenceNumber: z.number().int().positive(),
    occurredAt: IsoDateTime,
    payload: z.object({ setId: ScedSetId, result: ProbeOpportunityResult }).strict(),
  })
  .strict();

const TargetInstructionRecordedEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('sced.target_instruction.recorded'),
    sequenceNumber: z.number().int().positive(),
    occurredAt: IsoDateTime,
    payload: z.object({ setId: ScedSetId, referenceId: Id }).strict(),
  })
  .strict();

export const ScedCalendarEvent = z.discriminatedUnion('eventType', [
  InitializedEvent,
  RoundOpenedEvent,
  RoundResultRecordedEvent,
  NonRoundRecordedEvent,
  SetMasteryRecordedEvent,
  RetentionOpenedEvent,
  RetentionResultRecordedEvent,
  TargetInstructionRecordedEvent,
]);
export type ScedCalendarEvent = z.infer<typeof ScedCalendarEvent>;

export interface ScedCalendarMutation {
  readonly state: ScedCalendarState;
  readonly probeRequests: readonly ProbeRequestValue[];
  readonly closedRound: ScedProbeRoundState | null;
}

interface SetPrimaryProjection {
  readonly setId: ScedSetId;
  readonly windowStart: number;
  readonly windowEnd: number;
  readonly plannedStart: number;
  readonly extensionDeadline: number;
  readonly startStatus: ScedSetState['startStatus'];
  readonly interventionStartedAfterValidRound: number | null;
  readonly terminalStartReason: ScedSetState['terminalStartReason'];
  readonly baselineObservations: readonly ScedObservation[];
  readonly interventionObservations: readonly ScedObservation[];
  readonly startEvaluations: readonly ScedStartEvaluation[];
}

function parseEvent(value: unknown): ScedCalendarEvent {
  const parsed = ScedCalendarEvent.safeParse(value);
  if (!parsed.success) throw new ScedCalendarError('INVALID_EVENT', z.prettifyError(parsed.error));
  return parsed.data;
}

function parseState(value: unknown): ScedCalendarState {
  const parsed = ScedCalendarState.safeParse(value);
  if (!parsed.success) throw new ScedCalendarError('INVALID_STATE', z.prettifyError(parsed.error));
  return parsed.data;
}

function initialPrimaryProjection(
  policy: CompiledScedCalendarPolicy,
  starts: z.infer<typeof StartPoints>,
): SetPrimaryProjection[] {
  return policy.definition.requiredSets.map((setId) => {
    const window = policy.definition.windows[setId];
    const plannedStart = starts[setId];
    return {
      setId,
      windowStart: window.start,
      windowEnd: window.end,
      plannedStart,
      extensionDeadline: Math.min(
        window.end,
        plannedStart + policy.definition.maximumExtensionValidRounds,
      ),
      startStatus: 'pending',
      interventionStartedAfterValidRound: null,
      terminalStartReason: null,
      baselineObservations: [],
      interventionObservations: [],
      startEvaluations: [],
    };
  });
}

function setPhase(set: SetPrimaryProjection): 'baseline' | 'intervention' {
  return set.startStatus === 'started' ? 'intervention' : 'baseline';
}

function expectedOpportunityId(roundId: string, setId: ScedSetId): string {
  return opaqueId('probe-opportunity', roundId, setId);
}

function expectedRoundRequest(
  state: Pick<ScedCalendarState, 'runId' | 'participantPseudoId'>,
  roundId: string,
  set: SetPrimaryProjection,
): ProbeRequestValue {
  return ProbeRequest.parse({
    runId: state.runId,
    participantPseudoId: state.participantPseudoId,
    probeRoundId: roundId,
    opportunityId: expectedOpportunityId(roundId, set.setId),
    experimentalSet: set.setId,
    phase: setPhase(set),
    measureKind: 'primary_probe',
  });
}

function primaryResultIsValid(
  policy: CompiledScedCalendarPolicy,
  request: ProbeRequestValue,
  result: ProbeOpportunityResultValue,
): boolean {
  if (
    result.opportunityId !== request.opportunityId ||
    result.probeRoundId !== request.probeRoundId ||
    result.plannedItems !== policy.definition.opportunityDefinition.kSet
  ) {
    throw new ScedCalendarError('INVALID_RESULT', 'resultado no coincide con oportunidad/calibración');
  }
  const reachesMinimum =
    result.validScoredItems >= policy.definition.opportunityDefinition.minValidItemsPerOpportunity;
  if (result.operationalValidity === 'valid' && !reachesMinimum) {
    throw new ScedCalendarError('INVALID_RESULT', 'resultado valid por debajo del mínimo H5');
  }
  if (result.operationalValidity !== 'valid' && reachesMinimum) {
    throw new ScedCalendarError('INVALID_RESULT', 'resultado no válido pese a alcanzar el mínimo H5');
  }
  return result.operationalValidity === 'valid';
}

export interface BaselineStability {
  readonly lastThree: readonly [number, number, number];
  readonly strictlyIncreasing: boolean;
  readonly lastTwoSuccessiveHistoricMaxima: boolean;
  readonly stable: boolean;
}

export function evaluateBaselineStability(
  values: readonly number[],
): BaselineStability {
  if (values.length < 3) {
    throw new ScedCalendarError('INVALID_STATE', 'la estabilidad exige tres observaciones válidas');
  }
  const lastThree = values.slice(-3) as [number, number, number];
  const [first, second, third] = lastThree;
  if (first === undefined || second === undefined || third === undefined) {
    throw new ScedCalendarError('INVALID_STATE', 'historia de estabilidad incompleta');
  }
  const strictlyIncreasing = first < second && second < third;
  const beforePenultimate = values.slice(0, -2);
  const beforeLast = values.slice(0, -1);
  const penultimate = values.at(-2);
  const last = values.at(-1);
  const penultimateIsNewMaximum =
    penultimate !== undefined && beforePenultimate.length > 0 &&
    penultimate > Math.max(...beforePenultimate);
  const lastIsNewMaximum =
    last !== undefined && beforeLast.length > 0 && last > Math.max(...beforeLast);
  const lastTwoSuccessiveHistoricMaxima = penultimateIsNewMaximum && lastIsNewMaximum;
  return deepFreeze({
    lastThree: deepFreeze(lastThree),
    strictlyIncreasing,
    lastTwoSuccessiveHistoricMaxima,
    stable: !strictlyIncreasing && !lastTwoSuccessiveHistoricMaxima,
  });
}

function evaluateStarts(
  projections: readonly SetPrimaryProjection[],
  validRoundIndex: number,
  policy: CompiledScedCalendarPolicy,
): SetPrimaryProjection[] {
  const next = projections.map((entry) => ({
    ...entry,
    baselineObservations: [...entry.baselineObservations],
    interventionObservations: [...entry.interventionObservations],
    startEvaluations: [...entry.startEvaluations],
  }));
  for (const setId of policy.definition.requiredSets) {
    const index = next.findIndex((entry) => entry.setId === setId);
    const set = next[index];
    if (
      set === undefined ||
      set.startStatus !== 'pending' ||
      validRoundIndex < set.plannedStart
    ) continue;
    const stability = evaluateBaselineStability(
      set.baselineObservations.map((observation) => observation.observation),
    );
    const previousStarts = next
      .filter((candidate) => candidate.setId !== setId)
      .map((candidate) => candidate.interventionStartedAfterValidRound)
      .filter((candidate): candidate is number => candidate !== null && candidate <= validRoundIndex);
    const latestPreviousStart = previousStarts.length === 0 ? null : Math.max(...previousStarts);
    const separationSatisfied =
      latestPreviousStart === null ||
      validRoundIndex - latestPreviousStart >= policy.definition.minimumStartSeparationValidRounds;
    const failureReasons: z.infer<typeof StartFailureReason>[] = [];
    if (stability.strictlyIncreasing) failureReasons.push('strictly_increasing_last_three');
    if (stability.lastTwoSuccessiveHistoricMaxima) {
      failureReasons.push('successive_historic_maxima_last_two');
    }
    if (!separationSatisfied) failureReasons.push('minimum_start_separation_not_met');
    const eligible = stability.stable && separationSatisfied;
    const deadlineReached = validRoundIndex >= set.extensionDeadline;
    const decision = eligible
      ? 'start_after_round'
      : deadlineReached
        ? 'not_start_under_preinscription'
        : 'defer';
    const evaluation = ScedStartEvaluation.parse({
      validRoundIndex,
      lastThreeObservations: stability.lastThree,
      strictlyIncreasing: stability.strictlyIncreasing,
      lastTwoSuccessiveHistoricMaxima: stability.lastTwoSuccessiveHistoricMaxima,
      separationSatisfied,
      eligible,
      failureReasons,
      decision,
    });
    next[index] = {
      ...set,
      startStatus: eligible
        ? 'started'
        : deadlineReached
          ? 'not_started_under_preinscription'
          : 'pending',
      interventionStartedAfterValidRound: eligible ? validRoundIndex : null,
      terminalStartReason: !eligible && deadlineReached ? 'preinscription_window_exhausted' : null,
      startEvaluations: [...set.startEvaluations, evaluation],
    };
  }
  return next;
}

function appendValidRound(
  projections: readonly SetPrimaryProjection[],
  round: ScedProbeRoundState,
  validRoundIndex: number,
  policy: CompiledScedCalendarPolicy,
): { projections: SetPrimaryProjection[]; covariation: ScedCovariationRecord[] } {
  let next: SetPrimaryProjection[] = projections.map((entry) => ({
    ...entry,
    baselineObservations: [...entry.baselineObservations],
    interventionObservations: [...entry.interventionObservations],
    startEvaluations: [...entry.startEvaluations],
  }));
  const phases = new Map(
    round.opportunities.map((opportunity) => [opportunity.setId, opportunity.request.phase]),
  );
  const covariation: ScedCovariationRecord[] = [];
  for (const opportunity of round.opportunities) {
    const result = opportunity.result;
    if (result?.observation === null || result?.observation === undefined) {
      throw new ScedCalendarError('INVALID_STATE', 'ronda válida sin observación');
    }
    const setIndex = next.findIndex((entry) => entry.setId === opportunity.setId);
    const set = next[setIndex];
    if (set === undefined) throw new ScedCalendarError('INVALID_STATE', 'set desconocido');
    const observation = ScedObservation.parse({
      validRoundIndex,
      roundId: round.roundId,
      observation: result.observation,
      correctValidItems: result.correctValidItems,
      validScoredItems: result.validScoredItems,
    });
    if (opportunity.request.phase === 'baseline') {
      const previous = set.baselineObservations.at(-1);
      const concurrentInterventionSets = SCED_SET_IDS.filter(
        (candidate) => candidate !== set.setId && phases.get(candidate) === 'intervention',
      );
      if (
        previous !== undefined &&
        previous.observation !== observation.observation &&
        concurrentInterventionSets.length > 0
      ) {
        covariation.push(ScedCovariationRecord.parse({
          recordId: opaqueId('covariation', round.roundId, set.setId),
          validRoundIndex,
          roundId: round.roundId,
          unintervenedSet: set.setId,
          concurrentInterventionSets,
          previousObservation: previous.observation,
          observation: observation.observation,
          direction: observation.observation > previous.observation ? 'increase' : 'decrease',
        }));
      }
      next[setIndex] = { ...set, baselineObservations: [...set.baselineObservations, observation] };
    } else {
      next[setIndex] = {
        ...set,
        interventionObservations: [...set.interventionObservations, observation],
      };
    }
  }
  next = evaluateStarts(next, validRoundIndex, policy);
  return { projections: next, covariation };
}

function primaryProjectionOf(set: ScedSetState): SetPrimaryProjection {
  return {
    setId: set.setId,
    windowStart: set.windowStart,
    windowEnd: set.windowEnd,
    plannedStart: set.plannedStart,
    extensionDeadline: set.extensionDeadline,
    startStatus: set.startStatus,
    interventionStartedAfterValidRound: set.interventionStartedAfterValidRound,
    terminalStartReason: set.terminalStartReason,
    baselineObservations: set.baselineObservations,
    interventionObservations: set.interventionObservations,
    startEvaluations: set.startEvaluations,
  };
}

function assertRetentionState(
  state: ScedCalendarState,
  set: ScedSetState,
  policy: CompiledScedCalendarPolicy,
): void {
  const retention = set.retention;
  if (retention.status === 'not_scheduled') {
    if (canonicalJson(retention) !== canonicalJson(EmptyRetentionState)) {
      throw new ScedCalendarError('INVALID_STATE', 'retención vacía adulterada');
    }
    return;
  }
  if (
    retention.masteryEventId === null ||
    retention.masteryTimestamp === null ||
    retention.dueAt === null ||
    set.interventionStartedAfterValidRound === null ||
    retention.dueAt !== addUtcCalendarDays(
      retention.masteryTimestamp,
      policy.definition.retentionRule.intervalCalendarDays,
    )
  ) {
    throw new ScedCalendarError('INVALID_STATE', 'programación de retención incoherente');
  }
  const startRound = state.rounds.find(
    (round) => round.targetValidRoundIndex === set.interventionStartedAfterValidRound && round.calendarValidity === 'valid',
  );
  if (startRound?.closedAt === null || startRound?.closedAt === undefined ||
      Date.parse(retention.masteryTimestamp) < Date.parse(startRound.closedAt)) {
    throw new ScedCalendarError('INVALID_STATE', 'dominio de conjunto anterior al inicio de intervención');
  }
  if (retention.status === 'scheduled') {
    if (
      retention.openEventId !== null || retention.openedAt !== null || retention.request !== null ||
      retention.resultEventId !== null || retention.resultRecordedAt !== null || retention.result !== null
    ) throw new ScedCalendarError('INVALID_STATE', 'retención scheduled con datos de aplicación');
    return;
  }
  if (retention.openEventId === null || retention.openedAt === null || retention.request === null) {
    throw new ScedCalendarError('INVALID_STATE', 'retención abierta sin solicitud');
  }
  const expectedRequest = ProbeRequest.parse({
    runId: state.runId,
    participantPseudoId: state.participantPseudoId,
    probeRoundId: null,
    opportunityId: opaqueId('retention-opportunity', retention.openEventId, set.setId),
    experimentalSet: set.setId,
    phase: 'retention',
    measureKind: 'retention_probe',
  });
  if (
    canonicalJson(retention.request) !== canonicalJson(expectedRequest) ||
    Date.parse(retention.openedAt) < Date.parse(retention.dueAt)
  ) {
    throw new ScedCalendarError('INVALID_STATE', 'solicitud de retención adulterada o anticipada');
  }
  if (retention.status === 'open') {
    if (retention.resultEventId !== null || retention.resultRecordedAt !== null || retention.result !== null) {
      throw new ScedCalendarError('INVALID_STATE', 'retención abierta con resultado');
    }
    return;
  }
  if (
    retention.resultEventId === null ||
    retention.resultRecordedAt === null ||
    retention.result === null ||
    retention.result.opportunityId !== expectedRequest.opportunityId ||
    retention.result.probeRoundId !== null ||
    Date.parse(retention.resultRecordedAt) < Date.parse(retention.openedAt)
  ) {
    throw new ScedCalendarError('INVALID_STATE', 'resultado de retención incoherente');
  }
}

function assertStateMatchesPolicy(
  state: ScedCalendarState,
  policy: CompiledScedCalendarPolicy,
  seed: CompiledScedCalendarSeed,
): void {
  const expectedStarts = deriveRestrictedPlannedStarts(policy, seed, state.runId);
  if (canonicalJson(state.plannedStarts) !== canonicalJson(expectedStarts)) {
    throw new ScedCalendarError('INVALID_STATE', 'puntos planificados no corresponden a la semilla');
  }
  let projections = initialPrimaryProjection(policy, expectedStarts);
  let validRoundCount = 0;
  let covariation: ScedCovariationRecord[] = [];
  let previousRoundClosedAt: string | null = null;
  for (const [index, round] of state.rounds.entries()) {
    if (round.attemptIndex !== index + 1 || round.targetValidRoundIndex !== validRoundCount + 1) {
      throw new ScedCalendarError('INVALID_STATE', 'índices de ronda adulterados');
    }
    if (canonicalJson(round.openEventId) !== canonicalJson(round.roundId)) {
      throw new ScedCalendarError('INVALID_STATE', 'roundId debe ser el eventId autoritativo de apertura');
    }
    if (
      previousRoundClosedAt !== null &&
      Date.parse(round.openedAt) < Date.parse(previousRoundClosedAt)
    ) {
      throw new ScedCalendarError('INVALID_STATE', 'una ronda abre antes del cierre anterior');
    }
    for (const set of projections) {
      const opportunity = round.opportunities.find((candidate) => candidate.setId === set.setId);
      const expectedRequest = expectedRoundRequest(state, round.roundId, set);
      if (opportunity === undefined || canonicalJson(opportunity.request) !== canonicalJson(expectedRequest)) {
        throw new ScedCalendarError('INVALID_STATE', 'solicitud de ronda adulterada');
      }
      if (opportunity.result === null) {
        if (
          opportunity.resultEventId !== null || opportunity.resultRecordedAt !== null ||
          opportunity.scheduleValidity !== 'pending'
        ) throw new ScedCalendarError('INVALID_STATE', 'oportunidad pendiente incoherente');
      } else {
        if (opportunity.resultEventId === null || opportunity.resultRecordedAt === null) {
          throw new ScedCalendarError('INVALID_STATE', 'resultado sin evento/tiempo');
        }
        if (Date.parse(opportunity.resultRecordedAt) < Date.parse(round.openedAt)) {
          throw new ScedCalendarError('INVALID_STATE', 'resultado anterior a la apertura de ronda');
        }
        const valid = primaryResultIsValid(policy, expectedRequest, opportunity.result);
        const expectedValidity = valid ? 'primary_valid' : 'schedule_invalid';
        if (opportunity.scheduleValidity !== expectedValidity) {
          throw new ScedCalendarError('INVALID_STATE', 'validez de oportunidad adulterada');
        }
      }
    }
    const resultsComplete = round.opportunities.every((opportunity) => opportunity.result !== null);
    if (!resultsComplete) {
      if (
        index !== state.rounds.length - 1 || round.status !== 'open' ||
        round.calendarValidity !== 'pending' || round.reasonCode !== null || round.closedAt !== null
      ) throw new ScedCalendarError('INVALID_STATE', 'ronda incompleta incoherente');
      continue;
    }
    const allValid = round.opportunities.every(
      (opportunity) => opportunity.scheduleValidity === 'primary_valid',
    );
    const latestResultAt = Math.max(
      ...round.opportunities.map((opportunity) => Date.parse(opportunity.resultRecordedAt ?? '')),
    );
    if (
      round.status !== 'closed' || round.closedAt === null || Date.parse(round.closedAt) !== latestResultAt ||
      round.calendarValidity !== (allValid ? 'valid' : 'schedule_invalid') ||
      round.reasonCode !== (allValid ? null : 'schedule_invalid')
    ) {
      throw new ScedCalendarError('INVALID_STATE', 'cierre de ronda no derivado');
    }
    if (allValid) {
      validRoundCount += 1;
      const advanced = appendValidRound(projections, round, validRoundCount, policy);
      projections = advanced.projections;
      covariation = [...covariation, ...advanced.covariation];
    }
    previousRoundClosedAt = round.closedAt;
  }
  if (
    state.validRoundCount !== validRoundCount ||
    canonicalJson(state.sets.map(primaryProjectionOf)) !== canonicalJson(projections) ||
    canonicalJson(state.covariationRecords) !== canonicalJson(covariation)
  ) {
    throw new ScedCalendarError('INVALID_STATE', 'proyección primaria SCED adulterada');
  }
  for (const set of state.sets) assertRetentionState(state, set, policy);
  for (const instruction of state.targetInstructionRecords) {
    const set = state.sets.find((candidate) => candidate.setId === instruction.setId);
    if (set === undefined) throw new ScedCalendarError('INVALID_STATE', 'instrucción para set desconocido');
    const retention = set.retention;
    if (
      retention.masteryTimestamp !== null &&
      Date.parse(instruction.occurredAt) >= Date.parse(retention.masteryTimestamp) &&
      (retention.resultRecordedAt === null ||
        Date.parse(instruction.occurredAt) < Date.parse(retention.resultRecordedAt))
    ) {
      throw new ScedCalendarError('INVALID_STATE', 'reenseñanza dentro del intervalo de retención');
    }
  }
  const derivedEventIds = [
    state.processedEventIds[0],
    ...state.rounds.flatMap((round) => [
      round.openEventId,
      ...round.opportunities.map((opportunity) => opportunity.resultEventId),
    ]),
    ...state.nonRoundActivities.map((activity) => activity.eventId),
    ...state.targetInstructionRecords.map((instruction) => instruction.eventId),
    ...state.sets.flatMap((set) => [
      set.retention.masteryEventId,
      set.retention.openEventId,
      set.retention.resultEventId,
    ]),
  ].filter((eventId): eventId is string => eventId !== null && eventId !== undefined);
  if (
    derivedEventIds.length !== state.processedEventIds.length ||
    new Set(derivedEventIds).size !== derivedEventIds.length ||
    derivedEventIds.some((eventId) => !state.processedEventIds.includes(eventId))
  ) {
    throw new ScedCalendarError('INVALID_STATE', 'processedEventIds no coincide con actos derivados');
  }
}

function assertHeader(
  state: ScedCalendarState,
  event: Exclude<ScedCalendarEvent, { sequenceNumber: 0 }>,
): void {
  if (event.sequenceNumber !== state.revision + 1) {
    throw new ScedCalendarError(
      'INVALID_EVENT_SEQUENCE',
      `se esperaba ${state.revision + 1}, se recibió ${event.sequenceNumber}`,
    );
  }
  if (state.processedEventIds.includes(event.eventId)) {
    throw new ScedCalendarError('INVALID_EVENT_SEQUENCE', `eventId duplicado: ${event.eventId}`);
  }
  if (Date.parse(event.occurredAt) < Date.parse(state.updatedAt)) {
    throw new ScedCalendarError('INVALID_EVENT_SEQUENCE', 'occurredAt no puede retroceder');
  }
}

function replaceSet(state: ScedCalendarState, replacement: ScedSetState): ScedSetState[] {
  return state.sets.map((set) => set.setId === replacement.setId ? replacement : set);
}

function replaceRound(state: ScedCalendarState, replacement: ScedProbeRoundState): ScedProbeRoundState[] {
  return state.rounds.map((round) => round.roundId === replacement.roundId ? replacement : round);
}

function withHeader(
  state: ScedCalendarState,
  event: Exclude<ScedCalendarEvent, { sequenceNumber: 0 }>,
  changes: Partial<ScedCalendarState>,
): ScedCalendarState {
  return parseState({
    ...state,
    ...changes,
    revision: event.sequenceNumber,
    processedEventIds: [...state.processedEventIds, event.eventId],
    updatedAt: event.occurredAt,
  });
}

export class DeterministicScedCalendar {
  readonly policy: CompiledScedCalendarPolicy;
  readonly seed: CompiledScedCalendarSeed;
  readonly registry: ScedCalendarRunRegistry;

  constructor(
    policyValue: unknown,
    seedValue: unknown,
    options: Readonly<{
      expectedPolicyHash?: string;
      expectedSeedHash?: string;
      registry?: ScedCalendarRunRegistry;
    }> = {},
  ) {
    this.policy = compileScedCalendarPolicy(policyValue, options.expectedPolicyHash);
    this.seed = compileScedCalendarSeed(seedValue, options.expectedSeedHash);
    if (
      (this.policy.definition.purpose === 'material' || this.seed.definition.purpose === 'material') &&
      (options.expectedPolicyHash === undefined || options.expectedSeedHash === undefined)
    ) {
      throw new ScedCalendarError(
        'MATERIAL_FREEZE_REQUIRED',
        'un calendario material exige hashes externos de política y semilla',
      );
    }
    if (this.policy.definition.purpose !== this.seed.definition.purpose) {
      throw new ScedCalendarError('INVALID_ARTIFACT', 'política y semilla deben tener el mismo propósito');
    }
    this.registry = options.registry ?? new ScedCalendarRunRegistry();
  }

  expectedBinding(runId: string): ScedCalendarRunBinding {
    return deepFreeze({
      runId: Id.parse(runId),
      purpose: this.policy.definition.purpose,
      policyVersion: this.policy.definition.policyVersion,
      policyHash: this.policy.policyHash,
      seedVersion: this.seed.definition.seedVersion,
      seedHash: this.seed.seedHash,
      opportunityDefinitionVersion: this.policy.definition.opportunityDefinition.version,
      plannedStarts: deriveRestrictedPlannedStarts(this.policy, this.seed, runId),
    });
  }

  bindRun(value: unknown): ScedCalendarRunBinding {
    return this.registry.bind(this.policy, this.seed, value);
  }

  applyEvent(stateValue: ScedCalendarState | null, eventValue: unknown): ScedCalendarMutation {
    const event = parseEvent(eventValue);
    if (event.eventType === 'sced.initialized') {
      if (stateValue !== null) {
        throw new ScedCalendarError('INVALID_EVENT_SEQUENCE', 'inicialización duplicada');
      }
      const binding = this.registry.assertBound(event.payload.runId, this.policy, this.seed);
      const primary = initialPrimaryProjection(this.policy, binding.plannedStarts);
      const state = parseState({
        schemaVersion: SCED_CALENDAR_STATE_SCHEMA_VERSION,
        revision: 0,
        runId: event.payload.runId,
        participantPseudoId: event.payload.participantPseudoId,
        policyVersion: this.policy.definition.policyVersion,
        policyHash: this.policy.policyHash,
        seedVersion: this.seed.definition.seedVersion,
        seedHash: this.seed.seedHash,
        opportunityDefinitionVersion: this.policy.definition.opportunityDefinition.version,
        plannedStarts: binding.plannedStarts,
        validRoundCount: 0,
        roundAttemptCount: 0,
        activeRoundId: null,
        sets: primary.map((set) => ({ ...set, retention: EmptyRetentionState })),
        rounds: [],
        nonRoundActivities: [],
        targetInstructionRecords: [],
        covariationRecords: [],
        processedEventIds: [event.eventId],
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
      });
      return deepFreeze({ state: deepFreeze(state), probeRequests: [], closedRound: null });
    }
    if (stateValue === null) {
      throw new ScedCalendarError('INVALID_EVENT_SEQUENCE', 'falta inicialización');
    }
    const state = parseState(stateValue);
    this.registry.assertBound(state.runId, this.policy, this.seed);
    if (
      state.policyVersion !== this.policy.definition.policyVersion ||
      state.policyHash !== this.policy.policyHash ||
      state.seedVersion !== this.seed.definition.seedVersion ||
      state.seedHash !== this.seed.seedHash ||
      state.opportunityDefinitionVersion !== this.policy.definition.opportunityDefinition.version
    ) {
      throw new ScedCalendarError('RUN_POLICY_DRIFT', 'estado ligado a otros artefactos');
    }
    assertStateMatchesPolicy(state, this.policy, this.seed);
    assertHeader(state, event);

    if (event.eventType === 'sced.round.opened') return this.#openRound(state, event);
    if (event.eventType === 'sced.round.result_recorded') return this.#recordRoundResult(state, event);
    if (event.eventType === 'sced.non_round.recorded') return this.#recordNonRound(state, event);
    if (event.eventType === 'sced.set_mastery.recorded') return this.#recordSetMastery(state, event);
    if (event.eventType === 'sced.retention.opened') return this.#openRetention(state, event);
    if (event.eventType === 'sced.retention.result_recorded') {
      return this.#recordRetentionResult(state, event);
    }
    return this.#recordTargetInstruction(state, event);
  }

  #openRound(state: ScedCalendarState, event: z.infer<typeof RoundOpenedEvent>): ScedCalendarMutation {
    if (state.activeRoundId !== null) {
      throw new ScedCalendarError('ACTIVE_ROUND_EXISTS', 'ya existe una ronda abierta');
    }
    if (state.validRoundCount >= this.policy.definition.opportunityDefinition.requiredValidRounds) {
      throw new ScedCalendarError('CALENDAR_COMPLETE', 'ya se alcanzó el sobre de rondas válidas H5');
    }
    if (event.payload.roundId !== event.eventId) {
      throw new ScedCalendarError('INVALID_EVENT', 'roundId debe ser el eventId autoritativo');
    }
    if (state.rounds.some((round) => round.roundId === event.payload.roundId)) {
      throw new ScedCalendarError('INVALID_EVENT_SEQUENCE', 'roundId reutilizado');
    }
    const projections = state.sets.map(primaryProjectionOf);
    const opportunities = projections.map((set) => ScedRoundOpportunity.parse({
      setId: set.setId,
      request: expectedRoundRequest(state, event.payload.roundId, set),
      resultEventId: null,
      resultRecordedAt: null,
      result: null,
      scheduleValidity: 'pending',
    }));
    const round = ScedProbeRoundState.parse({
      roundId: event.payload.roundId,
      openEventId: event.eventId,
      attemptIndex: state.roundAttemptCount + 1,
      targetValidRoundIndex: state.validRoundCount + 1,
      status: 'open',
      calendarValidity: 'pending',
      reasonCode: null,
      opportunities,
      openedAt: event.occurredAt,
      closedAt: null,
    });
    const next = withHeader(state, event, {
      roundAttemptCount: state.roundAttemptCount + 1,
      activeRoundId: round.roundId,
      rounds: [...state.rounds, round],
    });
    return deepFreeze({
      state: deepFreeze(next),
      probeRequests: deepFreeze(opportunities.map((opportunity) => opportunity.request)),
      closedRound: null,
    });
  }

  #recordRoundResult(
    state: ScedCalendarState,
    event: z.infer<typeof RoundResultRecordedEvent>,
  ): ScedCalendarMutation {
    const round = state.rounds.find((candidate) => candidate.roundId === event.payload.roundId);
    if (round === undefined || state.activeRoundId !== round.roundId || round.status !== 'open') {
      throw new ScedCalendarError('ROUND_NOT_ACTIVE', `ronda no activa: ${event.payload.roundId}`);
    }
    const opportunity = round.opportunities.find((candidate) => candidate.setId === event.payload.setId);
    if (opportunity === undefined || opportunity.result !== null) {
      throw new ScedCalendarError('OPPORTUNITY_NOT_ACTIVE', 'oportunidad inexistente o ya resuelta');
    }
    const valid = primaryResultIsValid(this.policy, opportunity.request, event.payload.result);
    const updatedOpportunity = ScedRoundOpportunity.parse({
      ...opportunity,
      resultEventId: event.eventId,
      resultRecordedAt: event.occurredAt,
      result: event.payload.result,
      scheduleValidity: valid ? 'primary_valid' : 'schedule_invalid',
    });
    const opportunities = round.opportunities.map((candidate) =>
      candidate.setId === updatedOpportunity.setId ? updatedOpportunity : candidate,
    );
    const complete = opportunities.every((candidate) => candidate.result !== null);
    const allValid = complete && opportunities.every(
      (candidate) => candidate.scheduleValidity === 'primary_valid',
    );
    const updatedRound = ScedProbeRoundState.parse({
      ...round,
      opportunities,
      status: complete ? 'closed' : 'open',
      calendarValidity: complete ? (allValid ? 'valid' : 'schedule_invalid') : 'pending',
      reasonCode: complete && !allValid ? 'schedule_invalid' : null,
      closedAt: complete ? event.occurredAt : null,
    });
    let sets = state.sets;
    let validRoundCount = state.validRoundCount;
    let covariationRecords = state.covariationRecords;
    if (allValid) {
      validRoundCount += 1;
      const advanced = appendValidRound(
        state.sets.map(primaryProjectionOf),
        updatedRound,
        validRoundCount,
        this.policy,
      );
      sets = state.sets.map((set) => {
        const primary = advanced.projections.find((candidate) => candidate.setId === set.setId);
        if (primary === undefined) throw new ScedCalendarError('INVALID_STATE', 'set perdido al avanzar');
        return ScedSetState.parse({ ...primary, retention: set.retention });
      });
      covariationRecords = [...state.covariationRecords, ...advanced.covariation];
    }
    const next = withHeader(state, event, {
      activeRoundId: complete ? null : state.activeRoundId,
      rounds: replaceRound(state, updatedRound),
      validRoundCount,
      sets,
      covariationRecords,
    });
    return deepFreeze({
      state: deepFreeze(next),
      probeRequests: [],
      closedRound: complete ? deepFreeze(updatedRound) : null,
    });
  }

  #recordNonRound(
    state: ScedCalendarState,
    event: z.infer<typeof NonRoundRecordedEvent>,
  ): ScedCalendarMutation {
    if (state.nonRoundActivities.some((activity) => activity.activityId === event.payload.activityId)) {
      throw new ScedCalendarError('INVALID_EVENT_SEQUENCE', 'activityId no puede reutilizarse');
    }
    const activity = ScedNonRoundActivity.parse({
      eventId: event.eventId,
      ...event.payload,
      occurredAt: event.occurredAt,
    });
    const next = withHeader(state, event, {
      nonRoundActivities: [...state.nonRoundActivities, activity],
    });
    return deepFreeze({ state: deepFreeze(next), probeRequests: [], closedRound: null });
  }

  #recordSetMastery(
    state: ScedCalendarState,
    event: z.infer<typeof SetMasteryRecordedEvent>,
  ): ScedCalendarMutation {
    const set = state.sets.find((candidate) => candidate.setId === event.payload.setId);
    if (set === undefined || set.startStatus !== 'started') {
      throw new ScedCalendarError('INVALID_EVENT', 'dominio de conjunto exige intervención iniciada');
    }
    if (set.retention.status !== 'not_scheduled') {
      throw new ScedCalendarError('INVALID_EVENT_SEQUENCE', 'set_mastery_timestamp ya registrado');
    }
    const retention = ScedRetentionState.parse({
      ...EmptyRetentionState,
      status: 'scheduled',
      masteryEventId: event.eventId,
      masteryTimestamp: event.occurredAt,
      dueAt: addUtcCalendarDays(
        event.occurredAt,
        this.policy.definition.retentionRule.intervalCalendarDays,
      ),
    });
    const next = withHeader(state, event, {
      sets: replaceSet(state, ScedSetState.parse({ ...set, retention })),
    });
    return deepFreeze({ state: deepFreeze(next), probeRequests: [], closedRound: null });
  }

  #openRetention(
    state: ScedCalendarState,
    event: z.infer<typeof RetentionOpenedEvent>,
  ): ScedCalendarMutation {
    const set = state.sets.find((candidate) => candidate.setId === event.payload.setId);
    if (set === undefined || set.retention.status !== 'scheduled' || set.retention.dueAt === null) {
      throw new ScedCalendarError('RETENTION_NOT_SCHEDULED', 'retención no programada o ya abierta');
    }
    if (Date.parse(event.occurredAt) < Date.parse(set.retention.dueAt)) {
      throw new ScedCalendarError('RETENTION_NOT_DUE', 'retención abierta antes de siete días calendario');
    }
    const request = ProbeRequest.parse({
      runId: state.runId,
      participantPseudoId: state.participantPseudoId,
      probeRoundId: null,
      opportunityId: opaqueId('retention-opportunity', event.eventId, set.setId),
      experimentalSet: set.setId,
      phase: 'retention',
      measureKind: 'retention_probe',
    });
    const retention = ScedRetentionState.parse({
      ...set.retention,
      status: 'open',
      openEventId: event.eventId,
      openedAt: event.occurredAt,
      request,
    });
    const next = withHeader(state, event, {
      sets: replaceSet(state, ScedSetState.parse({ ...set, retention })),
    });
    return deepFreeze({ state: deepFreeze(next), probeRequests: [deepFreeze(request)], closedRound: null });
  }

  #recordRetentionResult(
    state: ScedCalendarState,
    event: z.infer<typeof RetentionResultRecordedEvent>,
  ): ScedCalendarMutation {
    const set = state.sets.find((candidate) => candidate.setId === event.payload.setId);
    if (set === undefined || set.retention.status !== 'open' || set.retention.request === null) {
      throw new ScedCalendarError('RETENTION_NOT_SCHEDULED', 'no hay retención abierta');
    }
    if (
      event.payload.result.opportunityId !== set.retention.request.opportunityId ||
      event.payload.result.probeRoundId !== null
    ) {
      throw new ScedCalendarError('INVALID_RESULT', 'resultado no corresponde a la retención abierta');
    }
    const retention = ScedRetentionState.parse({
      ...set.retention,
      status: 'completed',
      resultEventId: event.eventId,
      resultRecordedAt: event.occurredAt,
      result: event.payload.result,
    });
    const next = withHeader(state, event, {
      sets: replaceSet(state, ScedSetState.parse({ ...set, retention })),
    });
    return deepFreeze({ state: deepFreeze(next), probeRequests: [], closedRound: null });
  }

  #recordTargetInstruction(
    state: ScedCalendarState,
    event: z.infer<typeof TargetInstructionRecordedEvent>,
  ): ScedCalendarMutation {
    const set = state.sets.find((candidate) => candidate.setId === event.payload.setId);
    if (set === undefined) throw new ScedCalendarError('INVALID_EVENT', 'set desconocido');
    const retention = set.retention;
    if (
      retention.masteryTimestamp !== null &&
      Date.parse(event.occurredAt) >= Date.parse(retention.masteryTimestamp) &&
      retention.status !== 'completed'
    ) {
      throw new ScedCalendarError(
        'RETENTION_BLACKOUT',
        'no se permite reenseñanza dirigida entre dominio de conjunto y retención',
      );
    }
    const record = ScedTargetInstructionRecord.parse({
      eventId: event.eventId,
      setId: event.payload.setId,
      referenceId: event.payload.referenceId,
      occurredAt: event.occurredAt,
    });
    const next = withHeader(state, event, {
      targetInstructionRecords: [...state.targetInstructionRecords, record],
    });
    return deepFreeze({ state: deepFreeze(next), probeRequests: [], closedRound: null });
  }

  replay(values: readonly unknown[]): ScedCalendarState {
    if (values.length === 0) throw new ScedCalendarError('INVALID_EVENT_SEQUENCE', 'historia vacía');
    let state: ScedCalendarState | null = null;
    for (const value of values) state = this.applyEvent(state, value).state;
    if (state === null) throw new ScedCalendarError('INVALID_EVENT_SEQUENCE', 'historia sin estado');
    return state;
  }
}
