import { createHash } from 'node:crypto';
import { Id, IsoDateTime, PedagogicalMode, Sha256Hex, VersionRef } from '@profesor-ia/contracts';
import { z } from 'zod';
import { masteryDisqualifying, type MasteryHintFacts } from './hint-authority.js';

/** T-H6-05 — recuperación de pistas exclusivamente desde banco congelado. */
export const HINT_POLICY_SCHEMA_VERSION = 'hint-policy-v1' as const;
export const HINT_BANK_SCHEMA_VERSION = 'hint-bank-v1' as const;
export const HINT_STATE_SCHEMA_VERSION = 'hint-state-v1' as const;
export const HINT_POLICY_VERSION = 'hint-policy-v1-five-levels' as const;
export const HINT_LEVELS = [1, 2, 3, 4, 5] as const;

const NonEmptyText = z.string().trim().min(1).max(8_000);
const ShortText = z.string().trim().min(1).max(500);
const Purpose = z.enum(['material', 'test_fixture']);
export const HintLevel = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export type HintLevel = z.infer<typeof HintLevel>;

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

function canonicalJson(value: unknown, seen = new Set<object>()): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new HintEngineError('INVALID_HINT_BANK', 'número no finito');
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value !== 'object') throw new HintEngineError('INVALID_HINT_BANK', 'valor no serializable');
  if (seen.has(value)) throw new HintEngineError('INVALID_HINT_BANK', 'referencia circular');
  seen.add(value);
  try {
    if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry, seen)).join(',')}]`;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new HintEngineError('INVALID_HINT_BANK', 'solo se admiten objetos JSON planos');
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

export const HintPolicyDefinition = z
  .object({
    schemaVersion: z.literal(HINT_POLICY_SCHEMA_VERSION),
    policyVersion: ShortText,
    purpose: Purpose,
    levels: z.tuple([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
    ]),
    sourceDuringSession: z.literal('frozen_bank_only'),
    measurementMode: z.literal('disabled'),
    nearestLevelFallback: z.literal(false),
    masteryFlagAuthority: z.literal('domain_engine_code'),
    generatorProposalAuthoritative: z.literal(false),
    fading: z.literal('contingent_on_performance'),
    silentSolutionTransformationForbidden: z.literal(true),
  })
  .strict();
export type HintPolicyDefinition = z.infer<typeof HintPolicyDefinition>;

export function createHintPolicyDefinition(
  input: Readonly<{ policyVersion: string; purpose: z.infer<typeof Purpose> }>,
): HintPolicyDefinition {
  return HintPolicyDefinition.parse({
    schemaVersion: HINT_POLICY_SCHEMA_VERSION,
    policyVersion: input.policyVersion,
    purpose: input.purpose,
    levels: HINT_LEVELS,
    sourceDuringSession: 'frozen_bank_only',
    measurementMode: 'disabled',
    nearestLevelFallback: false,
    masteryFlagAuthority: 'domain_engine_code',
    generatorProposalAuthoritative: false,
    fading: 'contingent_on_performance',
    silentSolutionTransformationForbidden: true,
  });
}

export const HINT_POLICY_V1 = deepFreeze(
  createHintPolicyDefinition({ policyVersion: HINT_POLICY_VERSION, purpose: 'material' }),
);

export type HintEngineErrorCode =
  | 'HINT_BANK_HASH_MISMATCH'
  | 'HINT_ORDER_VIOLATION'
  | 'INVALID_EVENT_SEQUENCE'
  | 'INVALID_HINT_BANK'
  | 'INVALID_HINT_EVENT'
  | 'INVALID_HINT_POLICY'
  | 'MATERIAL_FREEZE_REQUIRED'
  | 'RUN_NOT_BOUND'
  | 'RUN_POLICY_DRIFT';

export class HintEngineError extends Error {
  constructor(
    readonly code: HintEngineErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface CompiledHintPolicy {
  readonly definition: HintPolicyDefinition;
  readonly policyHash: string;
}

export function compileHintPolicy(value: unknown, expectedHash?: string): CompiledHintPolicy {
  const parsed = HintPolicyDefinition.safeParse(value);
  if (!parsed.success) throw new HintEngineError('INVALID_HINT_POLICY', z.prettifyError(parsed.error));
  const policyHash = hashJson(parsed.data);
  if (expectedHash !== undefined && policyHash !== expectedHash) {
    throw new HintEngineError(
      'RUN_POLICY_DRIFT',
      `hash de política inválido: esperado ${expectedHash}, calculado ${policyHash}`,
    );
  }
  return deepFreeze({ definition: deepFreeze(parsed.data), policyHash });
}

const HintFacts = z
  .object({
    level: HintLevel,
    levelOneReminderOnly: z.boolean(),
    selectsRuleOrNextStep: z.boolean(),
    containsDecisiveContent: z.boolean(),
  })
  .strict();

const NonRevelationEvidence = z
  .object({
    authority: z.literal('authoring_hint_validator'),
    validatorVersion: ShortText,
    validatedContentHash: Sha256Hex,
    literalLeakCheckPassed: z.literal(true),
    detectionScope: z.literal('literal_not_paraphrase'),
    paraphraseAuditRequired: z.literal(true),
    anchorsValidated: z.literal(true),
    solutionSeparated: z.literal(true),
  })
  .strict();

const NonIsomorphismEvidence = z
  .object({
    authority: z.literal('isomorphism_canonicalizer'),
    canonicalizerVersion: ShortText,
    evidenceHash: Sha256Hex,
    nonIsomorphic: z.literal(true),
  })
  .strict();

const HintBankEntryBase = z
  .object({
    hintId: Id,
    itemId: Id,
    kcId: Id,
    level: HintLevel,
    text: NonEmptyText,
    anchors: uniqueArray(Id, 'anchors').min(1),
    facts: HintFacts,
    proposedMasteryDisqualifying: z.boolean(),
    nonRevelationEvidence: NonRevelationEvidence,
    analogousExampleEvidence: NonIsomorphismEvidence.nullable(),
  })
  .strict();
export type HintBankEntryInput = z.input<typeof HintBankEntryBase>;

export function hintValidatedContentHash(
  value: Readonly<{
    hintId: string;
    itemId: string;
    kcId: string;
    level: HintLevel;
    text: string;
    anchors: readonly string[];
    facts: z.infer<typeof HintFacts>;
    analogousExampleEvidence: z.infer<typeof NonIsomorphismEvidence> | null;
  }>,
): string {
  return hashJson({
    hintId: value.hintId,
    itemId: value.itemId,
    kcId: value.kcId,
    level: value.level,
    text: value.text,
    anchors: [...value.anchors],
    facts: value.facts,
    analogousExampleEvidence: value.analogousExampleEvidence,
  });
}

export const HintBankEntry = HintBankEntryBase.superRefine((entry, context) => {
  if (entry.facts.level !== entry.level) {
    context.addIssue({ code: 'custom', message: 'facts.level no coincide con level', path: ['facts', 'level'] });
  }
  if (entry.level !== 1 && entry.facts.levelOneReminderOnly) {
    context.addIssue({
      code: 'custom',
      message: 'levelOneReminderOnly solo puede ser verdadero en nivel 1',
      path: ['facts', 'levelOneReminderOnly'],
    });
  }
  const authoritative = masteryDisqualifying(entry.facts as MasteryHintFacts);
  if (entry.proposedMasteryDisqualifying !== authoritative) {
    context.addIssue({
      code: 'custom',
      message: 'la propuesta generativa discrepa del valor recalculado por código',
      path: ['proposedMasteryDisqualifying'],
    });
  }
  if ((entry.level === 4) !== (entry.analogousExampleEvidence !== null)) {
    context.addIssue({
      code: 'custom',
      message: 'solo el nivel 4 exige evidencia de ejemplo análogo no isomorfo',
      path: ['analogousExampleEvidence'],
    });
  }
  const contentHash = hintValidatedContentHash(entry);
  if (entry.nonRevelationEvidence.validatedContentHash !== contentHash) {
    context.addIssue({
      code: 'custom',
      message: 'la evidencia de no revelación no corresponde al contenido congelado',
      path: ['nonRevelationEvidence', 'validatedContentHash'],
    });
  }
});
export type HintBankEntry = z.infer<typeof HintBankEntry>;

export const FrozenHintBank = z
  .object({
    schemaVersion: z.literal(HINT_BANK_SCHEMA_VERSION),
    bankVersion: ShortText,
    purpose: Purpose,
    packageVersion: VersionRef,
    authoringPipelineVersion: ShortText,
    supportedLevels: z.tuple([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
    ]),
    entries: z.array(HintBankEntry).min(1),
  })
  .strict()
  .superRefine((bank, context) => {
    const hintIds = new Set<string>();
    const itemLevels = new Set<string>();
    const levelsByItem = new Map<string, Set<number>>();
    const kcByItem = new Map<string, string>();
    for (const [index, entry] of bank.entries.entries()) {
      if (hintIds.has(entry.hintId)) {
        context.addIssue({ code: 'custom', message: 'hintId duplicado', path: ['entries', index, 'hintId'] });
      }
      hintIds.add(entry.hintId);
      const itemLevel = `${entry.itemId}\u0000${entry.level}`;
      if (itemLevels.has(itemLevel)) {
        context.addIssue({ code: 'custom', message: 'dos pistas para item+nivel', path: ['entries', index] });
      }
      itemLevels.add(itemLevel);
      const levels = levelsByItem.get(entry.itemId) ?? new Set<number>();
      levels.add(entry.level);
      levelsByItem.set(entry.itemId, levels);
      const currentKc = kcByItem.get(entry.itemId);
      if (currentKc !== undefined && currentKc !== entry.kcId) {
        context.addIssue({
          code: 'custom',
          message: 'un reactivo no puede pertenecer a dos KC dentro del banco',
          path: ['entries', index, 'kcId'],
        });
      }
      kcByItem.set(entry.itemId, entry.kcId);
    }
    for (const [itemId, levels] of levelsByItem) {
      for (const level of HINT_LEVELS) {
        if (!levels.has(level)) {
          context.addIssue({
            code: 'custom',
            message: `el reactivo ${itemId} no contiene el nivel ${level}`,
            path: ['entries'],
          });
        }
      }
    }
  });
export type FrozenHintBank = z.infer<typeof FrozenHintBank>;

export interface CompiledHintBank {
  readonly definition: FrozenHintBank;
  readonly bankHash: string;
}

export function compileHintBank(value: unknown, expectedHash?: string): CompiledHintBank {
  const parsed = FrozenHintBank.safeParse(value);
  if (!parsed.success) throw new HintEngineError('INVALID_HINT_BANK', z.prettifyError(parsed.error));
  const bankHash = hashJson(parsed.data);
  if (expectedHash !== undefined && bankHash !== expectedHash) {
    throw new HintEngineError(
      'HINT_BANK_HASH_MISMATCH',
      `hash de banco inválido: esperado ${expectedHash}, calculado ${bankHash}`,
    );
  }
  return deepFreeze({ definition: deepFreeze(parsed.data), bankHash });
}

const HintRunBinding = z
  .object({
    runId: Id,
    purpose: Purpose,
    policyVersion: ShortText,
    policyHash: Sha256Hex,
    bankVersion: ShortText,
    bankHash: Sha256Hex,
    packageVersion: VersionRef,
  })
  .strict();
export type HintRunBinding = z.infer<typeof HintRunBinding>;

export class HintRunRegistry {
  readonly #bindings = new Map<string, HintRunBinding>();

  constructor(restored: readonly unknown[] = []) {
    for (const value of restored) {
      const parsed = HintRunBinding.safeParse(value);
      if (!parsed.success) throw new HintEngineError('INVALID_HINT_POLICY', z.prettifyError(parsed.error));
      const current = this.#bindings.get(parsed.data.runId);
      if (current !== undefined && canonicalJson(current) !== canonicalJson(parsed.data)) {
        throw new HintEngineError('RUN_POLICY_DRIFT', `bindings distintos para ${parsed.data.runId}`);
      }
      this.#bindings.set(parsed.data.runId, deepFreeze(parsed.data));
    }
  }

  bind(policy: CompiledHintPolicy, bank: CompiledHintBank, value: unknown): HintRunBinding {
    const parsed = HintRunBinding.safeParse(value);
    if (!parsed.success) throw new HintEngineError('INVALID_HINT_POLICY', z.prettifyError(parsed.error));
    const binding = parsed.data;
    if (
      binding.purpose !== policy.definition.purpose ||
      binding.purpose !== bank.definition.purpose ||
      binding.policyVersion !== policy.definition.policyVersion ||
      binding.policyHash !== policy.policyHash ||
      binding.bankVersion !== bank.definition.bankVersion ||
      binding.bankHash !== bank.bankHash ||
      canonicalJson(binding.packageVersion) !== canonicalJson(bank.definition.packageVersion)
    ) {
      throw new HintEngineError('RUN_POLICY_DRIFT', 'binding, política y banco no coinciden');
    }
    const current = this.#bindings.get(binding.runId);
    if (current !== undefined && canonicalJson(current) !== canonicalJson(binding)) {
      throw new HintEngineError('RUN_POLICY_DRIFT', `la corrida ${binding.runId} ya tiene otro banco`);
    }
    if (current !== undefined) return current;
    const frozen = deepFreeze(binding);
    this.#bindings.set(binding.runId, frozen);
    return frozen;
  }

  assertBound(runId: string, policy: CompiledHintPolicy, bank: CompiledHintBank): HintRunBinding {
    const binding = this.#bindings.get(runId);
    if (binding === undefined) throw new HintEngineError('RUN_NOT_BOUND', `la corrida ${runId} no tiene banco`);
    if (
      binding.purpose !== policy.definition.purpose ||
      binding.purpose !== bank.definition.purpose ||
      binding.policyVersion !== policy.definition.policyVersion ||
      binding.policyHash !== policy.policyHash ||
      binding.bankVersion !== bank.definition.bankVersion ||
      binding.bankHash !== bank.bankHash ||
      canonicalJson(binding.packageVersion) !== canonicalJson(bank.definition.packageVersion)
    ) {
      throw new HintEngineError('RUN_POLICY_DRIFT', `la corrida ${runId} usa otro banco`);
    }
    return binding;
  }

  bindings(): readonly HintRunBinding[] {
    return deepFreeze([...this.#bindings.values()]);
  }
}

const HintRequestPayload = z
  .object({
    requestId: Id,
    attemptId: Id,
    itemId: Id,
    mode: PedagogicalMode,
    authorizedAssistanceLevel: z.number().int().min(0).max(5),
  })
  .strict();

const HintInitializedEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('hints.initialized'),
    sequenceNumber: z.literal(0),
    occurredAt: IsoDateTime,
    payload: z.object({ runId: Id, participantPseudoId: Id }).strict(),
  })
  .strict();
const HintRequestedEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('hints.requested'),
    sequenceNumber: z.number().int().positive(),
    occurredAt: IsoDateTime,
    payload: HintRequestPayload,
  })
  .strict();

export const HintEvent = z.discriminatedUnion('eventType', [HintInitializedEvent, HintRequestedEvent]);
export type HintEvent = z.infer<typeof HintEvent>;

export const HintRequestOutcome = z.enum([
  'delivered',
  'disabled_measurement_mode',
  'no_assistance_authorized',
  'level_unavailable',
  'already_delivered',
]);
export type HintRequestOutcome = z.infer<typeof HintRequestOutcome>;

const HintRequestRecord = z
  .object({
    requestId: Id,
    attemptId: Id,
    itemId: Id,
    mode: PedagogicalMode,
    authorizedAssistanceLevel: z.number().int().min(0).max(5),
    outcome: HintRequestOutcome,
    hintId: Id.nullable(),
    occurredAt: IsoDateTime,
  })
  .strict()
  .superRefine((request, context) => {
    const identifiesHint = request.outcome === 'delivered' || request.outcome === 'already_delivered';
    if (identifiesHint !== (request.hintId !== null)) {
      context.addIssue({
        code: 'custom',
        message: 'hintId no coincide con el resultado de la solicitud',
        path: ['hintId'],
      });
    }
  });

export const HintDeliveryRecord = z
  .object({
    requestId: Id,
    hintId: Id,
    itemId: Id,
    kcId: Id,
    level: HintLevel,
    text: NonEmptyText,
    anchors: uniqueArray(Id, 'delivery.anchors').min(1),
    facts: HintFacts,
    masteryDisqualifying: z.boolean(),
    deliveredAt: IsoDateTime,
  })
  .strict()
  .superRefine((delivery, context) => {
    if (delivery.facts.level !== delivery.level) {
      context.addIssue({ code: 'custom', message: 'facts.level no coincide con la entrega' });
    }
    if (delivery.masteryDisqualifying !== masteryDisqualifying(delivery.facts as MasteryHintFacts)) {
      context.addIssue({ code: 'custom', message: 'bandera de dominio no fue recalculada por código' });
    }
  });
export type HintDeliveryRecord = z.infer<typeof HintDeliveryRecord>;

export const HintAttemptRecord = z
  .object({
    attemptId: Id,
    itemId: Id,
    kcId: Id,
    deliveries: z.array(HintDeliveryRecord).min(1),
    maximumHintLevel: z.number().int().min(0).max(5),
    masteryDisqualifying: z.boolean(),
    updatedAt: IsoDateTime,
  })
  .strict()
  .superRefine((attempt, context) => {
    const requestIds = new Set<string>();
    const hintIds = new Set<string>();
    for (const [index, delivery] of attempt.deliveries.entries()) {
      if (requestIds.has(delivery.requestId)) {
        context.addIssue({ code: 'custom', message: 'requestId de entrega duplicado', path: ['deliveries', index] });
      }
      if (hintIds.has(delivery.hintId)) {
        context.addIssue({ code: 'custom', message: 'una pista no puede entregarse dos veces al intento', path: ['deliveries', index] });
      }
      requestIds.add(delivery.requestId);
      hintIds.add(delivery.hintId);
    }
    const levels = attempt.deliveries.map((delivery) => delivery.level);
    const maximum = levels.length === 0 ? 0 : Math.max(...levels);
    if (maximum !== attempt.maximumHintLevel) {
      context.addIssue({ code: 'custom', message: 'maximumHintLevel no coincide con entregas' });
    }
    if (attempt.masteryDisqualifying !== attempt.deliveries.some((delivery) => delivery.masteryDisqualifying)) {
      context.addIssue({ code: 'custom', message: 'bandera agregada no coincide con entregas' });
    }
    if (attempt.deliveries.some((delivery) => delivery.itemId !== attempt.itemId || delivery.kcId !== attempt.kcId)) {
      context.addIssue({ code: 'custom', message: 'entrega de otro reactivo o KC en el intento' });
    }
  });
export type HintAttemptRecord = z.infer<typeof HintAttemptRecord>;

export const HintSessionState = z
  .object({
    schemaVersion: z.literal(HINT_STATE_SCHEMA_VERSION),
    revision: z.number().int().nonnegative(),
    runId: Id,
    participantPseudoId: Id,
    policyVersion: ShortText,
    policyHash: Sha256Hex,
    bankVersion: ShortText,
    bankHash: Sha256Hex,
    packageVersion: VersionRef,
    attempts: z.array(HintAttemptRecord),
    requests: z.array(HintRequestRecord),
    processedEventIds: uniqueArray(Id, 'processedEventIds'),
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
  })
  .strict()
  .superRefine((state, context) => {
    const attemptIds = new Set<string>();
    for (const [index, attempt] of state.attempts.entries()) {
      if (attemptIds.has(attempt.attemptId)) {
        context.addIssue({ code: 'custom', message: 'attempt duplicado', path: ['attempts', index] });
      }
      attemptIds.add(attempt.attemptId);
    }
    const requestIds = new Set<string>();
    for (const [index, request] of state.requests.entries()) {
      if (requestIds.has(request.requestId)) {
        context.addIssue({ code: 'custom', message: 'request duplicado', path: ['requests', index] });
      }
      requestIds.add(request.requestId);
    }
    if (state.requests.length !== state.revision || state.processedEventIds.length !== state.revision + 1) {
      context.addIssue({ code: 'custom', message: 'revisión no coincide con el historial registrado' });
    }
    if (Date.parse(state.updatedAt) < Date.parse(state.createdAt)) {
      context.addIssue({ code: 'custom', message: 'updatedAt no puede preceder a createdAt' });
    }
    const deliveryByRequestId = new Map<string, { attemptId: string; delivery: HintDeliveryRecord }>();
    for (const attempt of state.attempts) {
      for (const delivery of attempt.deliveries) {
        if (deliveryByRequestId.has(delivery.requestId)) {
          context.addIssue({ code: 'custom', message: 'una solicitud tiene más de una entrega' });
        }
        deliveryByRequestId.set(delivery.requestId, { attemptId: attempt.attemptId, delivery });
      }
    }
    for (const request of state.requests) {
      const matched = deliveryByRequestId.get(request.requestId);
      if ((request.outcome === 'delivered') !== (matched !== undefined)) {
        context.addIssue({ code: 'custom', message: 'solicitud y entrega no coinciden' });
      } else if (
        matched !== undefined &&
        (matched.attemptId !== request.attemptId ||
          matched.delivery.itemId !== request.itemId ||
          matched.delivery.hintId !== request.hintId)
      ) {
        context.addIssue({ code: 'custom', message: 'la entrega no corresponde a su solicitud' });
      }
    }
  });
export type HintSessionState = z.infer<typeof HintSessionState>;

export interface HintMutation {
  readonly state: HintSessionState;
  readonly outcome: HintRequestOutcome | 'initialized';
  readonly delivery: HintDeliveryRecord | null;
}

function parseEvent(value: unknown): HintEvent {
  const parsed = HintEvent.safeParse(value);
  if (!parsed.success) throw new HintEngineError('INVALID_HINT_EVENT', z.prettifyError(parsed.error));
  return parsed.data;
}

function parseState(value: unknown): HintSessionState {
  const parsed = HintSessionState.safeParse(value);
  if (!parsed.success) throw new HintEngineError('INVALID_HINT_EVENT', z.prettifyError(parsed.error));
  return parsed.data;
}

/**
 * Recalcula el resultado de cada solicitud contra el banco fijado. Así un
 * snapshot restaurado no puede introducir texto, nivel o bandera que no haya
 * salido exactamente del artefacto congelado, aun si conserva forma válida.
 */
function assertStateMatchesBank(state: HintSessionState, bank: CompiledHintBank): void {
  const deliveriesByRequest = new Map<string, { attemptId: string; delivery: HintDeliveryRecord }>();
  for (const attempt of state.attempts) {
    for (const delivery of attempt.deliveries) {
      deliveriesByRequest.set(delivery.requestId, { attemptId: attempt.attemptId, delivery });
    }
  }
  const deliveredHintsByAttempt = new Map<string, Set<string>>();
  const itemByAttempt = new Map<string, string>();
  let deliveredCount = 0;
  for (const request of state.requests) {
    const entry = request.mode === 'MEASUREMENT_MODE' || request.authorizedAssistanceLevel === 0
      ? undefined
      : bank.definition.entries.find(
          (candidate) =>
            candidate.itemId === request.itemId &&
            candidate.level === request.authorizedAssistanceLevel,
        );
    const deliveredHints = deliveredHintsByAttempt.get(request.attemptId) ?? new Set<string>();
    let expectedOutcome: HintRequestOutcome;
    if (request.mode === 'MEASUREMENT_MODE') expectedOutcome = 'disabled_measurement_mode';
    else if (request.authorizedAssistanceLevel === 0) expectedOutcome = 'no_assistance_authorized';
    else if (entry === undefined) expectedOutcome = 'level_unavailable';
    else {
      const previousItemId = itemByAttempt.get(request.attemptId);
      if (previousItemId !== undefined && previousItemId !== request.itemId) {
        throw new HintEngineError('HINT_ORDER_VIOLATION', 'un intento restaurado cambia de reactivo');
      }
      expectedOutcome = deliveredHints.has(entry.hintId) ? 'already_delivered' : 'delivered';
    }
    const expectedHintId = entry === undefined ? null : entry.hintId;
    if (request.outcome !== expectedOutcome || request.hintId !== expectedHintId) {
      throw new HintEngineError(
        'INVALID_HINT_EVENT',
        `resultado restaurado inválido para ${request.requestId}`,
      );
    }
    const matched = deliveriesByRequest.get(request.requestId);
    if (expectedOutcome === 'delivered' && entry !== undefined) {
      if (matched === undefined || matched.attemptId !== request.attemptId) {
        throw new HintEngineError('INVALID_HINT_EVENT', `falta entrega para ${request.requestId}`);
      }
      const expectedDelivery = HintDeliveryRecord.parse({
        requestId: request.requestId,
        hintId: entry.hintId,
        itemId: entry.itemId,
        kcId: entry.kcId,
        level: entry.level,
        text: entry.text,
        anchors: entry.anchors,
        facts: entry.facts,
        masteryDisqualifying: masteryDisqualifying(entry.facts as MasteryHintFacts),
        deliveredAt: request.occurredAt,
      });
      if (canonicalJson(matched.delivery) !== canonicalJson(expectedDelivery)) {
        throw new HintEngineError(
          'INVALID_HINT_EVENT',
          `entrega restaurada no pertenece al banco para ${request.requestId}`,
        );
      }
      deliveredCount += 1;
      deliveredHints.add(entry.hintId);
      deliveredHintsByAttempt.set(request.attemptId, deliveredHints);
      itemByAttempt.set(request.attemptId, request.itemId);
    } else if (matched !== undefined) {
      throw new HintEngineError('INVALID_HINT_EVENT', `entrega inesperada para ${request.requestId}`);
    }
  }
  if (deliveriesByRequest.size !== deliveredCount) {
    throw new HintEngineError('INVALID_HINT_EVENT', 'el estado contiene entregas sin solicitud');
  }
}

function initialState(
  event: z.infer<typeof HintInitializedEvent>,
  policy: CompiledHintPolicy,
  bank: CompiledHintBank,
): HintSessionState {
  return parseState({
    schemaVersion: HINT_STATE_SCHEMA_VERSION,
    revision: 0,
    runId: event.payload.runId,
    participantPseudoId: event.payload.participantPseudoId,
    policyVersion: policy.definition.policyVersion,
    policyHash: policy.policyHash,
    bankVersion: bank.definition.bankVersion,
    bankHash: bank.bankHash,
    packageVersion: bank.definition.packageVersion,
    attempts: [],
    requests: [],
    processedEventIds: [event.eventId],
    createdAt: event.occurredAt,
    updatedAt: event.occurredAt,
  });
}

function assertHeader(state: HintSessionState, event: z.infer<typeof HintRequestedEvent>): void {
  if (event.sequenceNumber !== state.revision + 1) {
    throw new HintEngineError(
      'INVALID_EVENT_SEQUENCE',
      `se esperaba secuencia ${state.revision + 1}, se recibió ${event.sequenceNumber}`,
    );
  }
  if (state.processedEventIds.includes(event.eventId)) {
    throw new HintEngineError('INVALID_EVENT_SEQUENCE', `eventId duplicado: ${event.eventId}`);
  }
  if (Date.parse(event.occurredAt) < Date.parse(state.updatedAt)) {
    throw new HintEngineError('INVALID_EVENT_SEQUENCE', 'occurredAt no puede retroceder');
  }
  if (state.requests.some((request) => request.requestId === event.payload.requestId)) {
    throw new HintEngineError('INVALID_EVENT_SEQUENCE', `requestId duplicado: ${event.payload.requestId}`);
  }
}

function replaceAttempt(state: HintSessionState, next: HintAttemptRecord): HintAttemptRecord[] {
  return state.attempts.some((attempt) => attempt.attemptId === next.attemptId)
    ? state.attempts.map((attempt) => (attempt.attemptId === next.attemptId ? next : attempt))
    : [...state.attempts, next];
}

function requestRecord(
  event: z.infer<typeof HintRequestedEvent>,
  outcome: HintRequestOutcome,
  hintId: string | null,
): z.infer<typeof HintRequestRecord> {
  return HintRequestRecord.parse({
    ...event.payload,
    outcome,
    hintId,
    occurredAt: event.occurredAt,
  });
}

export class DeterministicHintController {
  readonly policy: CompiledHintPolicy;
  readonly bank: CompiledHintBank;
  readonly registry: HintRunRegistry;

  constructor(
    policyValue: unknown,
    bankValue: unknown,
    options: Readonly<{
      expectedPolicyHash?: string;
      expectedBankHash?: string;
      registry?: HintRunRegistry;
    }> = {},
  ) {
    this.policy = compileHintPolicy(policyValue, options.expectedPolicyHash);
    this.bank = compileHintBank(bankValue, options.expectedBankHash);
    if (
      (this.policy.definition.purpose === 'material' || this.bank.definition.purpose === 'material') &&
      (options.expectedPolicyHash === undefined || options.expectedBankHash === undefined)
    ) {
      throw new HintEngineError(
        'MATERIAL_FREEZE_REQUIRED',
        'una corrida material exige hashes externos de política y banco',
      );
    }
    if (this.policy.definition.purpose !== this.bank.definition.purpose) {
      throw new HintEngineError('INVALID_HINT_POLICY', 'política y banco deben tener el mismo propósito');
    }
    this.registry = options.registry ?? new HintRunRegistry();
  }

  bindRun(value: unknown): HintRunBinding {
    return this.registry.bind(this.policy, this.bank, value);
  }

  applyEvent(stateValue: HintSessionState | null, eventValue: unknown): HintMutation {
    const event = parseEvent(eventValue);
    if (event.eventType === 'hints.initialized') {
      if (stateValue !== null) throw new HintEngineError('INVALID_EVENT_SEQUENCE', 'inicialización duplicada');
      this.registry.assertBound(event.payload.runId, this.policy, this.bank);
      const state = initialState(event, this.policy, this.bank);
      return deepFreeze({ state: deepFreeze(state), outcome: 'initialized', delivery: null });
    }
    if (stateValue === null) throw new HintEngineError('INVALID_EVENT_SEQUENCE', 'falta hints.initialized');
    const state = parseState(stateValue);
    this.registry.assertBound(state.runId, this.policy, this.bank);
    if (
      state.policyVersion !== this.policy.definition.policyVersion ||
      state.policyHash !== this.policy.policyHash ||
      state.bankVersion !== this.bank.definition.bankVersion ||
      state.bankHash !== this.bank.bankHash ||
      canonicalJson(state.packageVersion) !== canonicalJson(this.bank.definition.packageVersion)
    ) {
      throw new HintEngineError('RUN_POLICY_DRIFT', 'el estado pertenece a otro banco o política');
    }
    assertStateMatchesBank(state, this.bank);
    assertHeader(state, event);

    const payload = event.payload;
    let outcome: HintRequestOutcome;
    let entry: HintBankEntry | undefined;
    if (payload.mode === 'MEASUREMENT_MODE') outcome = 'disabled_measurement_mode';
    else if (payload.authorizedAssistanceLevel === 0) outcome = 'no_assistance_authorized';
    else {
      entry = this.bank.definition.entries.find(
        (candidate) =>
          candidate.itemId === payload.itemId &&
          candidate.level === payload.authorizedAssistanceLevel,
      );
      if (entry === undefined) outcome = 'level_unavailable';
      else {
        const current = state.attempts.find((attempt) => attempt.attemptId === payload.attemptId);
        if (current !== undefined && current.itemId !== payload.itemId) {
          throw new HintEngineError('HINT_ORDER_VIOLATION', 'un intento no puede cambiar de reactivo');
        }
        outcome = current?.deliveries.some((delivery) => delivery.hintId === entry?.hintId)
          ? 'already_delivered'
          : 'delivered';
      }
    }

    let attempts = state.attempts;
    let delivery: HintDeliveryRecord | null = null;
    if (outcome === 'delivered' && entry !== undefined) {
      const authoritative = masteryDisqualifying(entry.facts as MasteryHintFacts);
      delivery = HintDeliveryRecord.parse({
        requestId: payload.requestId,
        hintId: entry.hintId,
        itemId: entry.itemId,
        kcId: entry.kcId,
        level: entry.level,
        text: entry.text,
        anchors: entry.anchors,
        facts: entry.facts,
        masteryDisqualifying: authoritative,
        deliveredAt: event.occurredAt,
      });
      const current = state.attempts.find((attempt) => attempt.attemptId === payload.attemptId);
      const deliveries = [...(current?.deliveries ?? []), delivery];
      const nextAttempt = HintAttemptRecord.parse({
        attemptId: payload.attemptId,
        itemId: payload.itemId,
        kcId: entry.kcId,
        deliveries,
        maximumHintLevel: Math.max(...deliveries.map((candidate) => candidate.level)),
        masteryDisqualifying: deliveries.some((candidate) => candidate.masteryDisqualifying),
        updatedAt: event.occurredAt,
      });
      attempts = replaceAttempt(state, nextAttempt);
    }
    const nextState = parseState({
      ...state,
      revision: event.sequenceNumber,
      attempts,
      requests: [...state.requests, requestRecord(event, outcome, entry?.hintId ?? null)],
      processedEventIds: [...state.processedEventIds, event.eventId],
      updatedAt: event.occurredAt,
    });
    return deepFreeze({ state: deepFreeze(nextState), outcome, delivery });
  }

  replay(values: readonly unknown[]): HintSessionState {
    if (values.length === 0) throw new HintEngineError('INVALID_EVENT_SEQUENCE', 'historia vacía');
    let state: HintSessionState | null = null;
    for (const value of values) state = this.applyEvent(state, value).state;
    if (state === null) throw new HintEngineError('INVALID_EVENT_SEQUENCE', 'historia sin estado');
    return state;
  }
}

export function hintAttemptProjection(stateValue: unknown, attemptId: string): HintAttemptRecord {
  const state = parseState(stateValue);
  const attempt = state.attempts.find((candidate) => candidate.attemptId === attemptId);
  if (attempt === undefined) {
    throw new HintEngineError('HINT_ORDER_VIOLATION', `${attemptId} no tiene pistas entregadas`);
  }
  return deepFreeze(attempt);
}
