import { createHash } from 'node:crypto';
import { Id, IsoDateTime, PedagogicalMode, Sha256Hex } from '@profesor-ia/contracts';
import { z } from 'zod';
import { masteryDisqualifying, type MasteryHintFacts } from './hint-authority.js';

/** T-H6-03 — controlador de dominio operativo literal de P-I §5.3. */
export const DOMAIN_POLICY_SCHEMA_VERSION = 'domain-policy-v1' as const;
export const DOMAIN_STATE_SCHEMA_VERSION = 'domain-state-v1' as const;
export const DOMAIN_POLICY_VERSION = 'domain-policy-v1-cal09' as const;

const CAL09_SAMPLE_HASH = '9247a8b0df137c56b742e7650e59848be965fe38374e21c6c1ba5acddb1f830a';
const NonEmptyText = z.string().trim().min(1).max(500);
const Purpose = z.enum(['material', 'test_fixture']);

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (typeof value !== 'object' || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

function uniqueArray<T extends z.ZodType>(schema: T, label: string) {
  return z.array(schema).superRefine((values, context) => {
    const seen = new Set<unknown>();
    for (const [index, value] of values.entries()) {
      const key = typeof value === 'object' ? JSON.stringify(value) : value;
      if (seen.has(key)) {
        context.addIssue({ code: 'custom', message: `${label}: valor duplicado`, path: [index] });
      }
      seen.add(key);
    }
  });
}

export const ComplexityCalibrationBinding = z
  .object({
    parameterId: z.literal('CAL-09'),
    version: z.literal('cal-09-v1'),
    sampleHash: Sha256Hex,
    profileVersion: z.literal('structural-complexity-v1'),
    authorizedCalculusVersion: z.literal('authorized-calculus-v1'),
    verifierVersion: z.literal('0.1.0'),
  })
  .strict();
export type ComplexityCalibrationBinding = z.infer<typeof ComplexityCalibrationBinding>;

export const CAL09_DOMAIN_BINDING: ComplexityCalibrationBinding = deepFreeze({
  parameterId: 'CAL-09',
  version: 'cal-09-v1',
  sampleHash: CAL09_SAMPLE_HASH,
  profileVersion: 'structural-complexity-v1',
  authorizedCalculusVersion: 'authorized-calculus-v1',
  verifierVersion: '0.1.0',
});

export const DomainPolicyDefinition = z
  .object({
    schemaVersion: z.literal(DOMAIN_POLICY_SCHEMA_VERSION),
    policyVersion: NonEmptyText,
    purpose: Purpose,
    correctConsecutiveRequired: z.literal(3),
    complexityOrder: z.literal('non_decreasing'),
    nearTransferRequired: z.literal(true),
    nearTransferMustBeNonIsomorphic: z.literal(true),
    complexityCalibration: ComplexityCalibrationBinding,
    hintAuthority: z
      .object({
        levelOneReminderMayRemainEligible: z.literal(true),
        levelsTwoThroughFiveDisqualify: z.literal(true),
        decisiveContentAlwaysDisqualifies: z.literal(true),
        generatorProposalAuthoritative: z.literal(false),
      })
      .strict(),
    postMasteryReconfirmation: z
      .object({
        createPendingOnEveryDeclaration: z.literal(true),
        firstEligibleOpportunity: z.literal(true),
        learningModeOnly: z.literal(true),
        beforeDeliberateReteaching: z.literal(true),
        deadline: z.literal('before_next_session_targeting_kc'),
        requiredReserve: z.literal('independent_practice'),
        measurementReserveForbidden: z.literal(true),
        validAbsenceIsMissingNotFalseMastery: z.literal(true),
      })
      .strict(),
    bktAuthoritative: z.literal(false),
  })
  .strict();
export type DomainPolicyDefinition = z.infer<typeof DomainPolicyDefinition>;

export function createDomainPolicyDefinition(
  input: Readonly<{
    policyVersion: string;
    purpose: z.infer<typeof Purpose>;
    complexityCalibration?: ComplexityCalibrationBinding;
  }>,
): DomainPolicyDefinition {
  return DomainPolicyDefinition.parse({
    schemaVersion: DOMAIN_POLICY_SCHEMA_VERSION,
    policyVersion: input.policyVersion,
    purpose: input.purpose,
    correctConsecutiveRequired: 3,
    complexityOrder: 'non_decreasing',
    nearTransferRequired: true,
    nearTransferMustBeNonIsomorphic: true,
    complexityCalibration: input.complexityCalibration ?? CAL09_DOMAIN_BINDING,
    hintAuthority: {
      levelOneReminderMayRemainEligible: true,
      levelsTwoThroughFiveDisqualify: true,
      decisiveContentAlwaysDisqualifies: true,
      generatorProposalAuthoritative: false,
    },
    postMasteryReconfirmation: {
      createPendingOnEveryDeclaration: true,
      firstEligibleOpportunity: true,
      learningModeOnly: true,
      beforeDeliberateReteaching: true,
      deadline: 'before_next_session_targeting_kc',
      requiredReserve: 'independent_practice',
      measurementReserveForbidden: true,
      validAbsenceIsMissingNotFalseMastery: true,
    },
    bktAuthoritative: false,
  });
}

export const DOMAIN_POLICY_V1 = deepFreeze(
  createDomainPolicyDefinition({
    policyVersion: DOMAIN_POLICY_VERSION,
    purpose: 'material',
  }),
);

export type DomainEngineErrorCode =
  | 'CALIBRATION_MISMATCH'
  | 'DOMAIN_POLICY_HASH_MISMATCH'
  | 'INVALID_DOMAIN_EVENT'
  | 'INVALID_DOMAIN_POLICY'
  | 'INVALID_EVENT_SEQUENCE'
  | 'INVALID_RECONFIRMATION'
  | 'MATERIAL_FREEZE_REQUIRED'
  | 'RECONFIRMATION_ORDER_VIOLATION'
  | 'RUN_NOT_BOUND'
  | 'RUN_POLICY_DRIFT';

export class DomainEngineError extends Error {
  constructor(
    readonly code: DomainEngineErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function canonicalJson(value: unknown, seen = new Set<object>()): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new DomainEngineError('INVALID_DOMAIN_POLICY', 'número no finito');
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value !== 'object') {
    throw new DomainEngineError('INVALID_DOMAIN_POLICY', 'valor no serializable');
  }
  if (seen.has(value)) {
    throw new DomainEngineError('INVALID_DOMAIN_POLICY', 'referencia circular');
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => canonicalJson(entry, seen)).join(',')}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new DomainEngineError('INVALID_DOMAIN_POLICY', 'solo se admiten objetos JSON planos');
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

export interface CompiledDomainPolicy {
  readonly definition: DomainPolicyDefinition;
  readonly policyHash: string;
}

export function compileDomainPolicy(value: unknown, expectedHash?: string): CompiledDomainPolicy {
  const parsed = DomainPolicyDefinition.safeParse(value);
  if (!parsed.success) {
    throw new DomainEngineError('INVALID_DOMAIN_POLICY', z.prettifyError(parsed.error));
  }
  const policyHash = hashJson(parsed.data);
  if (expectedHash !== undefined && policyHash !== expectedHash) {
    throw new DomainEngineError(
      'DOMAIN_POLICY_HASH_MISMATCH',
      `hash de política inválido: esperado ${expectedHash}, calculado ${policyHash}`,
    );
  }
  return deepFreeze({ definition: deepFreeze(parsed.data), policyHash });
}

const RunDomainPolicyBinding = z
  .object({
    runId: Id,
    purpose: Purpose,
    policyVersion: NonEmptyText,
    policyHash: Sha256Hex,
  })
  .strict();
export type RunDomainPolicyBinding = z.infer<typeof RunDomainPolicyBinding>;

export class DomainPolicyRunRegistry {
  readonly #bindings = new Map<string, RunDomainPolicyBinding>();

  constructor(restored: readonly unknown[] = []) {
    for (const value of restored) {
      const parsed = RunDomainPolicyBinding.safeParse(value);
      if (!parsed.success) {
        throw new DomainEngineError('INVALID_DOMAIN_POLICY', z.prettifyError(parsed.error));
      }
      const current = this.#bindings.get(parsed.data.runId);
      if (current !== undefined && canonicalJson(current) !== canonicalJson(parsed.data)) {
        throw new DomainEngineError(
          'RUN_POLICY_DRIFT',
          `dos políticas persistidas para ${parsed.data.runId}`,
        );
      }
      this.#bindings.set(parsed.data.runId, deepFreeze(parsed.data));
    }
  }

  bind(compiled: CompiledDomainPolicy, value: unknown): RunDomainPolicyBinding {
    const parsed = RunDomainPolicyBinding.safeParse(value);
    if (!parsed.success) {
      throw new DomainEngineError('INVALID_DOMAIN_POLICY', z.prettifyError(parsed.error));
    }
    const binding = parsed.data;
    if (
      binding.purpose !== compiled.definition.purpose ||
      binding.policyVersion !== compiled.definition.policyVersion ||
      binding.policyHash !== compiled.policyHash
    ) {
      throw new DomainEngineError('RUN_POLICY_DRIFT', 'binding y política compilada no coinciden');
    }
    const current = this.#bindings.get(binding.runId);
    if (current !== undefined && canonicalJson(current) !== canonicalJson(binding)) {
      throw new DomainEngineError(
        'RUN_POLICY_DRIFT',
        `la corrida ${binding.runId} ya tiene otra política de dominio`,
      );
    }
    if (current !== undefined) return current;
    const frozen = deepFreeze(binding);
    this.#bindings.set(binding.runId, frozen);
    return frozen;
  }

  assertBound(runId: string, compiled: CompiledDomainPolicy): RunDomainPolicyBinding {
    const binding = this.#bindings.get(runId);
    if (binding === undefined) {
      throw new DomainEngineError('RUN_NOT_BOUND', `la corrida ${runId} no tiene política de dominio`);
    }
    if (
      binding.purpose !== compiled.definition.purpose ||
      binding.policyVersion !== compiled.definition.policyVersion ||
      binding.policyHash !== compiled.policyHash
    ) {
      throw new DomainEngineError('RUN_POLICY_DRIFT', `la corrida ${runId} usa otra política`);
    }
    return binding;
  }

  bindings(): readonly RunDomainPolicyBinding[] {
    return deepFreeze([...this.#bindings.values()]);
  }
}

const MasteryHintFactsSchema = z
  .object({
    level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    levelOneReminderOnly: z.boolean(),
    selectsRuleOrNextStep: z.boolean(),
    containsDecisiveContent: z.boolean(),
  })
  .strict();

const AttemptOutcome = z.enum(['correct', 'incorrect', 'invalid', 'missing']);
const PracticeReserve = z.enum(['guided_practice', 'independent_practice', 'recovery']);
const AnyReserve = z.enum([
  'guided_practice',
  'independent_practice',
  'recovery',
  'TRANSFER_MASTERY',
  'TRANSFER_MEASUREMENT',
  'probes_baseline',
  'probes_intervention',
  'retention',
]);

const AttemptCommon = {
  attemptId: Id,
  itemId: Id,
  itemFamilyId: Id,
  mode: PedagogicalMode,
  outcome: AttemptOutcome,
  complexityIndex: z.number().min(0).max(100),
  complexityCalibrationVersion: z.literal('cal-09-v1'),
  complexityCalibrationSampleHash: Sha256Hex,
  hints: uniqueArray(MasteryHintFactsSchema, 'hints'),
};

const PracticeAttempt = z
  .object({
    ...AttemptCommon,
    activityKind: z.literal('practice'),
    reserve: PracticeReserve,
  })
  .strict();
const NearTransferNonIsomorphismEvidence = z
  .object({
    authority: z.literal('isomorphism_canonicalizer'),
    canonicalizerVersion: NonEmptyText,
    evidenceHash: Sha256Hex,
    comparedImmediatePracticeItemIds: uniqueArray(Id, 'comparedImmediatePracticeItemIds').min(1),
    nonIsomorphic: z.boolean(),
  })
  .strict();
const NearTransferAttempt = z
  .object({
    ...AttemptCommon,
    activityKind: z.literal('near_transfer'),
    reserve: z.enum(['TRANSFER_MASTERY', 'TRANSFER_MEASUREMENT']),
    nonIsomorphismEvidence: NearTransferNonIsomorphismEvidence,
  })
  .strict();
const AssistedSuccessReconfirmationAttempt = z
  .object({
    ...AttemptCommon,
    activityKind: z.literal('assisted_success_reconfirmation'),
    reserve: PracticeReserve,
    reconfirmsAttemptId: Id,
  })
  .strict();
const PostMasteryReconfirmationAttempt = z
  .object({
    ...AttemptCommon,
    activityKind: z.literal('post_mastery_reconfirmation'),
    reserve: AnyReserve,
    opportunityId: Id,
  })
  .strict();

export const DomainAttempt = z.discriminatedUnion('activityKind', [
  PracticeAttempt,
  NearTransferAttempt,
  AssistedSuccessReconfirmationAttempt,
  PostMasteryReconfirmationAttempt,
]);
export type DomainAttempt = z.infer<typeof DomainAttempt>;

const EventCommon = {
  eventId: Id,
  sequenceNumber: z.number().int().positive(),
  occurredAt: IsoDateTime,
};

const DomainInitializedEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('domain.initialized'),
    sequenceNumber: z.literal(0),
    occurredAt: IsoDateTime,
    payload: z
      .object({ runId: Id, participantPseudoId: Id, kcId: Id })
      .strict(),
  })
  .strict();
const DomainAttemptObservedEvent = z
  .object({
    ...EventCommon,
    eventType: z.literal('domain.attempt.observed'),
    payload: DomainAttempt,
  })
  .strict();
const DomainOpportunityAvailableEvent = z
  .object({
    ...EventCommon,
    eventType: z.literal('domain.reconfirmation.opportunity.available'),
    payload: z
      .object({
        opportunityId: Id,
        itemId: Id,
        mode: PedagogicalMode,
        activityKind: z.enum(['independent_practice', 'guided_practice', 'other']),
        reserve: AnyReserve,
        available: z.boolean(),
      })
      .strict(),
  })
  .strict();
const DomainReteachingStartedEvent = z
  .object({
    ...EventCommon,
    eventType: z.literal('domain.deliberate_reteaching.started'),
    payload: z.object({ reasonCode: NonEmptyText }).strict(),
  })
  .strict();
const DomainTargetSessionStartedEvent = z
  .object({
    ...EventCommon,
    eventType: z.literal('domain.target_session.started'),
    payload: z.object({ sessionId: Id }).strict(),
  })
  .strict();
const DomainReconfirmationMissingEvent = z
  .object({
    ...EventCommon,
    eventType: z.literal('domain.reconfirmation.missing'),
    payload: z
      .object({
        reason: z.enum(['withdrawal', 'run_closed', 'incident', 'valid_reserve_absence']),
      })
      .strict(),
  })
  .strict();

export const DomainEvent = z.discriminatedUnion('eventType', [
  DomainInitializedEvent,
  DomainAttemptObservedEvent,
  DomainOpportunityAvailableEvent,
  DomainReteachingStartedEvent,
  DomainTargetSessionStartedEvent,
  DomainReconfirmationMissingEvent,
]);
export type DomainEvent = z.infer<typeof DomainEvent>;

export const AttemptEligibilityReason = z.enum([
  'ELIGIBLE',
  'MEASUREMENT_MODE',
  'INVALID_OR_MISSING',
  'MEASUREMENT_RESERVE',
  'MASTERY_DISQUALIFYING_HELP',
  'TRANSFER_WRONG_RESERVE',
  'TRANSFER_ISOMORPHIC',
  'RECONFIRMATION_WRONG_RESERVE',
]);
export type AttemptEligibilityReason = z.infer<typeof AttemptEligibilityReason>;

export const AttemptEvaluation = z
  .object({
    attemptId: Id,
    sequenceNumber: z.number().int().positive(),
    activityKind: z.enum([
      'practice',
      'near_transfer',
      'assisted_success_reconfirmation',
      'post_mastery_reconfirmation',
    ]),
    outcome: AttemptOutcome,
    eligible: z.boolean(),
    reasonCode: AttemptEligibilityReason,
    masteryDisqualifying: z.boolean(),
    complexityIndex: z.number().min(0).max(100),
    occurredAt: IsoDateTime,
  })
  .strict();
export type AttemptEvaluation = z.infer<typeof AttemptEvaluation>;

const CorrectEvidence = z
  .object({ attemptId: Id, sequenceNumber: z.number().int().positive(), complexityIndex: z.number() })
  .strict();
const AssistedSuccess = z
  .object({
    assistedAttemptId: Id,
    status: z.enum(['pending', 'incorrect', 'confirmed']),
    reconfirmationAttemptId: Id.nullable(),
  })
  .strict();
const MasteryDeclaration = z
  .object({
    declarationId: Id,
    declaredAt: IsoDateTime,
    consecutiveAttemptIds: z.tuple([Id, Id, Id]),
    nearTransferAttemptId: Id,
    complexityCalibrationVersion: z.literal('cal-09-v1'),
    domainPolicyVersion: NonEmptyText,
  })
  .strict();

const PostMasteryNotApplicable = z.object({ status: z.literal('not_applicable') }).strict();
const PostMasteryPending = z
  .object({ status: z.literal('pending'), declarationId: Id, createdAt: IsoDateTime })
  .strict();
const PostMasteryScheduled = z
  .object({
      status: z.literal('scheduled'),
      declarationId: Id,
      opportunityId: Id,
      itemId: Id,
      scheduledAt: IsoDateTime,
      reserve: z.literal('independent_practice'),
    })
  .strict();
const PostMasteryObserved = z
  .object({
      status: z.literal('observed'),
      declarationId: Id,
      opportunityId: Id,
      attemptId: Id,
      correct: z.boolean(),
      observedAt: IsoDateTime,
    })
  .strict();
const PostMasteryMissing = z
  .object({
      status: z.literal('missing'),
      declarationId: Id,
      reason: z.enum(['withdrawal', 'run_closed', 'incident', 'valid_reserve_absence']),
      recordedAt: IsoDateTime,
    })
  .strict();
const PostMasteryTerminal = z.discriminatedUnion('status', [
  PostMasteryObserved,
  PostMasteryMissing,
]);
const PostMasteryState = z.discriminatedUnion('status', [
  PostMasteryNotApplicable,
  PostMasteryPending,
  PostMasteryScheduled,
  PostMasteryObserved,
  PostMasteryMissing,
]);

export const DomainKcState = z
  .object({
    schemaVersion: z.literal(DOMAIN_STATE_SCHEMA_VERSION),
    revision: z.number().int().nonnegative(),
    runId: Id,
    participantPseudoId: Id,
    kcId: Id,
    policyVersion: NonEmptyText,
    policyHash: Sha256Hex,
    masteryStatus: z.enum(['not_mastered', 'mastered', 'reconfirmation_failed']),
    eligibleCorrectStreak: z.array(CorrectEvidence).max(3),
    eligibleNearTransferAttemptId: Id.nullable(),
    assistedSuccesses: z.array(AssistedSuccess),
    attemptEvaluations: z.array(AttemptEvaluation),
    masteryDeclaration: MasteryDeclaration.nullable(),
    masteryDeclarations: z.array(MasteryDeclaration),
    postMasteryReconfirmation: PostMasteryState,
    postMasteryHistory: z.array(PostMasteryTerminal),
    processedEventIds: uniqueArray(Id, 'processedEventIds'),
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
  })
  .strict()
  .superRefine((state, context) => {
    for (let index = 1; index < state.eligibleCorrectStreak.length; index += 1) {
      const previous = state.eligibleCorrectStreak[index - 1];
      const current = state.eligibleCorrectStreak[index];
      if (previous !== undefined && current !== undefined && current.complexityIndex < previous.complexityIndex) {
        context.addIssue({ code: 'custom', message: 'racha con complejidad decreciente' });
      }
    }
    if (state.masteryStatus === 'not_mastered' && state.masteryDeclaration !== null) {
      context.addIssue({ code: 'custom', message: 'not_mastered no admite declaración de dominio' });
    }
    if (state.masteryStatus !== 'not_mastered' && state.masteryDeclaration === null) {
      context.addIssue({ code: 'custom', message: 'estado de dominio exige declaración histórica' });
    }
    if (
      state.masteryDeclaration === null &&
      state.postMasteryReconfirmation.status !== 'not_applicable'
    ) {
      context.addIssue({ code: 'custom', message: 'reconfirmación post-dominio sin declaración' });
    }
    if (state.masteryDeclarations.length === 0 && state.masteryDeclaration !== null) {
      context.addIssue({ code: 'custom', message: 'declaración actual ausente del historial' });
    }
    if (
      state.masteryDeclarations.length > 0 &&
      state.masteryDeclaration?.declarationId !== state.masteryDeclarations.at(-1)?.declarationId
    ) {
      context.addIssue({ code: 'custom', message: 'la declaración actual no es la última histórica' });
    }
  });
export type DomainKcState = z.infer<typeof DomainKcState>;

export interface DomainMutation {
  readonly state: DomainKcState;
  readonly attemptEvaluation: AttemptEvaluation | null;
  readonly masteryDeclared: boolean;
}

function parseEvent(value: unknown): DomainEvent {
  const parsed = DomainEvent.safeParse(value);
  if (!parsed.success) {
    throw new DomainEngineError('INVALID_DOMAIN_EVENT', z.prettifyError(parsed.error));
  }
  return parsed.data;
}

function parseState(value: unknown): DomainKcState {
  const parsed = DomainKcState.safeParse(value);
  if (!parsed.success) {
    throw new DomainEngineError('INVALID_DOMAIN_EVENT', z.prettifyError(parsed.error));
  }
  return parsed.data;
}

export function evaluateAttemptEligibility(
  attempt: DomainAttempt,
  policy: DomainPolicyDefinition,
): Readonly<{ eligible: boolean; reasonCode: AttemptEligibilityReason; masteryDisqualifying: boolean }> {
  if (
    attempt.complexityCalibrationVersion !== policy.complexityCalibration.version ||
    attempt.complexityCalibrationSampleHash !== policy.complexityCalibration.sampleHash
  ) {
    throw new DomainEngineError(
      'CALIBRATION_MISMATCH',
      'el intento no fue ordenado con la calibración CAL-09 congelada por la corrida',
    );
  }
  const disqualifying = attempt.hints.some((hint) =>
    masteryDisqualifying(hint as MasteryHintFacts),
  );
  let reasonCode: AttemptEligibilityReason = 'ELIGIBLE';
  if (attempt.mode === 'MEASUREMENT_MODE') reasonCode = 'MEASUREMENT_MODE';
  else if (attempt.outcome === 'invalid' || attempt.outcome === 'missing') {
    reasonCode = 'INVALID_OR_MISSING';
  } else if (
    ['TRANSFER_MEASUREMENT', 'probes_baseline', 'probes_intervention', 'retention'].includes(
      attempt.reserve,
    )
  ) reasonCode = attempt.activityKind === 'near_transfer'
      ? 'TRANSFER_WRONG_RESERVE'
      : 'MEASUREMENT_RESERVE';
  else if (disqualifying) reasonCode = 'MASTERY_DISQUALIFYING_HELP';
  else if (
    attempt.activityKind === 'near_transfer' &&
    !attempt.nonIsomorphismEvidence.nonIsomorphic
  ) reasonCode = 'TRANSFER_ISOMORPHIC';
  else if (
    attempt.activityKind === 'post_mastery_reconfirmation' &&
    attempt.reserve !== 'independent_practice'
  ) reasonCode = 'RECONFIRMATION_WRONG_RESERVE';

  return deepFreeze({
    eligible: reasonCode === 'ELIGIBLE',
    reasonCode,
    masteryDisqualifying: disqualifying,
  });
}

function initialState(
  event: z.infer<typeof DomainInitializedEvent>,
  compiled: CompiledDomainPolicy,
): DomainKcState {
  return parseState({
    schemaVersion: DOMAIN_STATE_SCHEMA_VERSION,
    revision: 0,
    runId: event.payload.runId,
    participantPseudoId: event.payload.participantPseudoId,
    kcId: event.payload.kcId,
    policyVersion: compiled.definition.policyVersion,
    policyHash: compiled.policyHash,
    masteryStatus: 'not_mastered',
    eligibleCorrectStreak: [],
    eligibleNearTransferAttemptId: null,
    assistedSuccesses: [],
    attemptEvaluations: [],
    masteryDeclaration: null,
    masteryDeclarations: [],
    postMasteryReconfirmation: { status: 'not_applicable' },
    postMasteryHistory: [],
    processedEventIds: [event.eventId],
    createdAt: event.occurredAt,
    updatedAt: event.occurredAt,
  });
}

function assertEventHeader(state: DomainKcState, event: Exclude<DomainEvent, z.infer<typeof DomainInitializedEvent>>): void {
  if (event.sequenceNumber !== state.revision + 1) {
    throw new DomainEngineError(
      'INVALID_EVENT_SEQUENCE',
      `se esperaba secuencia ${state.revision + 1}, se recibió ${event.sequenceNumber}`,
    );
  }
  if (state.processedEventIds.includes(event.eventId)) {
    throw new DomainEngineError('INVALID_EVENT_SEQUENCE', `eventId duplicado: ${event.eventId}`);
  }
  if (Date.parse(event.occurredAt) < Date.parse(state.updatedAt)) {
    throw new DomainEngineError('INVALID_EVENT_SEQUENCE', 'occurredAt no puede retroceder');
  }
}

function withEventBase(
  state: DomainKcState,
  event: Exclude<DomainEvent, z.infer<typeof DomainInitializedEvent>>,
  changes: Partial<DomainKcState>,
): DomainKcState {
  return parseState({
    ...state,
    ...changes,
    revision: event.sequenceNumber,
    processedEventIds: [...state.processedEventIds, event.eventId],
    updatedAt: event.occurredAt,
  });
}

function applyAttempt(
  state: DomainKcState,
  event: z.infer<typeof DomainAttemptObservedEvent>,
  policy: DomainPolicyDefinition,
): DomainMutation {
  const attempt = event.payload;
  if (state.attemptEvaluations.some((evaluation) => evaluation.attemptId === attempt.attemptId)) {
    throw new DomainEngineError('INVALID_EVENT_SEQUENCE', `attemptId duplicado: ${attempt.attemptId}`);
  }
  const eligibility = evaluateAttemptEligibility(attempt, policy);
  const evaluation = AttemptEvaluation.parse({
    attemptId: attempt.attemptId,
    sequenceNumber: event.sequenceNumber,
    activityKind: attempt.activityKind,
    outcome: attempt.outcome,
    eligible: eligibility.eligible,
    reasonCode: eligibility.reasonCode,
    masteryDisqualifying: eligibility.masteryDisqualifying,
    complexityIndex: attempt.complexityIndex,
    occurredAt: event.occurredAt,
  });

  if (attempt.activityKind === 'post_mastery_reconfirmation') {
    const post = state.postMasteryReconfirmation;
    if (
      post.status !== 'scheduled' ||
      post.opportunityId !== attempt.opportunityId ||
      post.itemId !== attempt.itemId ||
      !eligibility.eligible ||
      (attempt.outcome !== 'correct' && attempt.outcome !== 'incorrect')
    ) {
      throw new DomainEngineError(
        'INVALID_RECONFIRMATION',
        'la reconfirmación post-dominio no coincide con la primera oportunidad programada y elegible',
      );
    }
    const correct = attempt.outcome === 'correct';
    const next = withEventBase(state, event, {
      masteryStatus: correct ? 'mastered' : 'reconfirmation_failed',
      eligibleCorrectStreak: correct ? state.eligibleCorrectStreak : [],
      eligibleNearTransferAttemptId: correct ? state.eligibleNearTransferAttemptId : null,
      attemptEvaluations: [...state.attemptEvaluations, evaluation],
      postMasteryReconfirmation: {
        status: 'observed',
        declarationId: post.declarationId,
        opportunityId: post.opportunityId,
        attemptId: attempt.attemptId,
        correct,
        observedAt: event.occurredAt,
      },
    });
    return deepFreeze({ state: deepFreeze(next), attemptEvaluation: evaluation, masteryDeclared: false });
  }

  if (
    state.masteryStatus === 'mastered' &&
    (state.postMasteryReconfirmation.status === 'pending' ||
      state.postMasteryReconfirmation.status === 'scheduled') &&
    attempt.activityKind === 'practice' &&
    attempt.mode === 'LEARNING_MODE' &&
    attempt.reserve === 'independent_practice'
  ) {
    throw new DomainEngineError(
      'RECONFIRMATION_ORDER_VIOLATION',
      'la primera práctica independiente posterior debía reservarse para reconfirmación',
    );
  }

  const assistedSuccesses = [...state.assistedSuccesses];
  if (
    attempt.outcome === 'correct' &&
    eligibility.masteryDisqualifying &&
    attempt.activityKind !== 'assisted_success_reconfirmation'
  ) {
    assistedSuccesses.push({
      assistedAttemptId: attempt.attemptId,
      status: 'pending',
      reconfirmationAttemptId: null,
    });
  }

  if (attempt.activityKind === 'assisted_success_reconfirmation') {
    const index = assistedSuccesses.findIndex(
      (record) => record.assistedAttemptId === attempt.reconfirmsAttemptId,
    );
    if (index < 0) {
      throw new DomainEngineError(
        'INVALID_RECONFIRMATION',
        `${attempt.reconfirmsAttemptId} no es un acierto asistido conocido`,
      );
    }
    if (eligibility.eligible) {
      assistedSuccesses[index] = {
        assistedAttemptId: attempt.reconfirmsAttemptId,
        status: attempt.outcome === 'correct' ? 'confirmed' : 'incorrect',
        reconfirmationAttemptId: attempt.attemptId,
      };
    }
  }

  let streak = [...state.eligibleCorrectStreak];
  let nearTransferAttemptId = state.eligibleNearTransferAttemptId;
  if (eligibility.eligible) {
    if (attempt.outcome === 'incorrect') {
      streak = [];
    } else if (attempt.outcome === 'correct') {
      const last = streak.at(-1);
      const evidence = {
        attemptId: attempt.attemptId,
        sequenceNumber: event.sequenceNumber,
        complexityIndex: attempt.complexityIndex,
      };
      streak = last !== undefined && attempt.complexityIndex < last.complexityIndex
        ? [evidence]
        : [...streak, evidence].slice(-policy.correctConsecutiveRequired);
      if (attempt.activityKind === 'near_transfer') {
        nearTransferAttemptId = attempt.attemptId;
      }
    }
  }

  const declaresMastery =
    state.masteryStatus !== 'mastered' &&
    streak.length === policy.correctConsecutiveRequired &&
    nearTransferAttemptId !== null;
  let declaration = state.masteryDeclaration;
  if (declaresMastery) {
    const [first, second, third] = streak;
    if (
      first === undefined ||
      second === undefined ||
      third === undefined ||
      nearTransferAttemptId === null
    ) {
      throw new DomainEngineError(
        'INVALID_DOMAIN_EVENT',
        'la declaración no tiene tres evidencias y transferencia',
      );
    }
    declaration = MasteryDeclaration.parse({
      declarationId: `mastery:${state.runId}:${state.kcId}:${event.sequenceNumber}`,
      declaredAt: event.occurredAt,
      consecutiveAttemptIds: [first.attemptId, second.attemptId, third.attemptId],
      nearTransferAttemptId,
      complexityCalibrationVersion: policy.complexityCalibration.version,
      domainPolicyVersion: policy.policyVersion,
    });
  }
  const previousPost = state.postMasteryReconfirmation;
  const postMasteryHistory = declaresMastery &&
      (previousPost.status === 'observed' || previousPost.status === 'missing')
    ? [...state.postMasteryHistory, previousPost]
    : state.postMasteryHistory;
  const masteryDeclarations = declaresMastery && declaration !== null
    ? [...state.masteryDeclarations, declaration]
    : state.masteryDeclarations;

  const next = withEventBase(state, event, {
    masteryStatus: declaresMastery ? 'mastered' : state.masteryStatus,
    eligibleCorrectStreak: streak,
    eligibleNearTransferAttemptId: nearTransferAttemptId,
    assistedSuccesses,
    attemptEvaluations: [...state.attemptEvaluations, evaluation],
    masteryDeclaration: declaration,
    masteryDeclarations,
    postMasteryReconfirmation: declaresMastery && declaration !== null
      ? { status: 'pending', declarationId: declaration.declarationId, createdAt: event.occurredAt }
      : state.postMasteryReconfirmation,
    postMasteryHistory,
  });
  return deepFreeze({
    state: deepFreeze(next),
    attemptEvaluation: evaluation,
    masteryDeclared: declaresMastery,
  });
}

function pendingReconfirmation(state: DomainKcState): boolean {
  return state.postMasteryReconfirmation.status === 'pending' ||
    state.postMasteryReconfirmation.status === 'scheduled';
}

function applyNonAttemptEvent(
  state: DomainKcState,
  event: Exclude<DomainEvent, z.infer<typeof DomainInitializedEvent> | z.infer<typeof DomainAttemptObservedEvent>>,
): DomainMutation {
  if (event.eventType === 'domain.reconfirmation.opportunity.available') {
    const post = state.postMasteryReconfirmation;
    const eligible =
      post.status === 'pending' &&
      event.payload.available &&
      event.payload.mode === 'LEARNING_MODE' &&
      event.payload.activityKind === 'independent_practice' &&
      event.payload.reserve === 'independent_practice';
    const next = withEventBase(state, event, eligible
      ? {
          postMasteryReconfirmation: {
            status: 'scheduled',
            declarationId: post.status === 'pending' ? post.declarationId : '',
            opportunityId: event.payload.opportunityId,
            itemId: event.payload.itemId,
            scheduledAt: event.occurredAt,
            reserve: 'independent_practice',
          },
        }
      : {});
    return deepFreeze({ state: deepFreeze(next), attemptEvaluation: null, masteryDeclared: false });
  }
  if (
    event.eventType === 'domain.deliberate_reteaching.started' ||
    event.eventType === 'domain.target_session.started'
  ) {
    if (pendingReconfirmation(state)) {
      throw new DomainEngineError(
        'RECONFIRMATION_ORDER_VIOLATION',
        event.eventType === 'domain.deliberate_reteaching.started'
          ? 'no se puede reenseñar el KC antes de observar o cerrar válidamente la reconfirmación'
          : 'la reconfirmación debe resolverse antes de la siguiente sesión que vuelva a hacer objetivo al KC',
      );
    }
    const next = withEventBase(state, event, {});
    return deepFreeze({ state: deepFreeze(next), attemptEvaluation: null, masteryDeclared: false });
  }
  const post = state.postMasteryReconfirmation;
  if (post.status !== 'pending' && post.status !== 'scheduled') {
    throw new DomainEngineError(
      'INVALID_RECONFIRMATION',
      'no existe reconfirmación pendiente que pueda registrarse como faltante',
    );
  }
  const next = withEventBase(state, event, {
    postMasteryReconfirmation: {
      status: 'missing',
      declarationId: post.declarationId,
      reason: event.payload.reason,
      recordedAt: event.occurredAt,
    },
  });
  return deepFreeze({ state: deepFreeze(next), attemptEvaluation: null, masteryDeclared: false });
}

export class DeterministicDomainController {
  readonly compiled: CompiledDomainPolicy;
  readonly registry: DomainPolicyRunRegistry;

  constructor(
    definition: unknown,
    options: { readonly expectedHash?: string; readonly registry?: DomainPolicyRunRegistry } = {},
  ) {
    this.compiled = compileDomainPolicy(definition, options.expectedHash);
    if (this.compiled.definition.purpose === 'material' && options.expectedHash === undefined) {
      throw new DomainEngineError(
        'MATERIAL_FREEZE_REQUIRED',
        'una política material exige el hash esperado del paquete congelado',
      );
    }
    this.registry = options.registry ?? new DomainPolicyRunRegistry();
  }

  bindRun(value: unknown): RunDomainPolicyBinding {
    return this.registry.bind(this.compiled, value);
  }

  applyEvent(stateValue: DomainKcState | null, eventValue: unknown): DomainMutation {
    const event = parseEvent(eventValue);
    if (event.eventType === 'domain.initialized') {
      if (stateValue !== null) {
        throw new DomainEngineError('INVALID_EVENT_SEQUENCE', 'inicialización duplicada');
      }
      this.registry.assertBound(event.payload.runId, this.compiled);
      const state = initialState(event, this.compiled);
      return deepFreeze({ state: deepFreeze(state), attemptEvaluation: null, masteryDeclared: false });
    }
    if (stateValue === null) {
      throw new DomainEngineError('INVALID_EVENT_SEQUENCE', 'falta domain.initialized');
    }
    const state = parseState(stateValue);
    this.registry.assertBound(state.runId, this.compiled);
    if (
      state.policyVersion !== this.compiled.definition.policyVersion ||
      state.policyHash !== this.compiled.policyHash
    ) {
      throw new DomainEngineError('RUN_POLICY_DRIFT', 'el estado pertenece a otra política');
    }
    assertEventHeader(state, event);
    return event.eventType === 'domain.attempt.observed'
      ? applyAttempt(state, event, this.compiled.definition)
      : applyNonAttemptEvent(state, event);
  }

  replay(values: readonly unknown[]): DomainKcState {
    if (values.length === 0) {
      throw new DomainEngineError('INVALID_EVENT_SEQUENCE', 'historia de dominio vacía');
    }
    let state: DomainKcState | null = null;
    for (const value of values) state = this.applyEvent(state, value).state;
    if (state === null) {
      throw new DomainEngineError('INVALID_EVENT_SEQUENCE', 'historia sin estado');
    }
    return state;
  }
}

/** Proyección compatible con `SessionStructuredState.operationalMastery[kcId]`. */
export function operationalMasteryProjection(stateValue: unknown): Readonly<{
  mastered: boolean;
  eligibleConsecutiveCorrect: number;
  highestEligibleComplexityIndex: number | null;
  nearTransferSatisfied: boolean;
  reconfirmationPending: boolean;
  lastChangedAt: string | null;
}> {
  const state = parseState(stateValue);
  return deepFreeze({
    mastered: state.masteryStatus === 'mastered',
    eligibleConsecutiveCorrect: state.eligibleCorrectStreak.length,
    highestEligibleComplexityIndex:
      state.eligibleCorrectStreak.at(-1)?.complexityIndex ?? null,
    nearTransferSatisfied: state.eligibleNearTransferAttemptId !== null,
    reconfirmationPending: pendingReconfirmation(state),
    lastChangedAt: state.updatedAt,
  });
}

/** Entrada autoritativa para `pedagogy-policy`; el modelo no aparece en el tipo. */
export function masteryEligibilityAuthorization(
  stateValue: unknown,
  attemptId: string,
): Readonly<{
  authority: 'domain_engine';
  eligible: boolean;
  reasonCode: AttemptEligibilityReason;
}> {
  const state = parseState(stateValue);
  const evaluation = state.attemptEvaluations.find((candidate) => candidate.attemptId === attemptId);
  if (evaluation === undefined) {
    throw new DomainEngineError(
      'INVALID_DOMAIN_EVENT',
      `${attemptId} no tiene evaluación autoritativa en el estado de ${state.kcId}`,
    );
  }
  return deepFreeze({
    authority: 'domain_engine',
    eligible: evaluation.eligible,
    reasonCode: evaluation.reasonCode,
  });
}
