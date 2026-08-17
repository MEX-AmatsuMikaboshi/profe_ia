import { createHash } from 'node:crypto';
import {
  INCIDENT_ACTION_BY_LEVEL,
  Id,
  Incident,
  IsoDateTime,
  KNOWN_PROBE_REASON_CODES,
  MeasureKind,
  MeasurementControlEffect,
  MeasurementReserve,
  MeasurementRunDisposition,
  OperationalValidity,
  ProbeDelivery,
  ProbeOpportunityResult,
  ProbeRequest,
  Reserve,
  Sha256Hex,
  StructuredItemPrompt,
  VersionRef,
  consumptionBlocksMeasurement,
  probeReserveFor,
  type MeasureKind as MeasureKindValue,
  type MeasurementControlEffect as MeasurementControlEffectValue,
  type MeasurementReserve as MeasurementReserveValue,
  type OperationalValidity as OperationalValidityValue,
  type ProbeDelivery as ProbeDeliveryValue,
  type ProbeOpportunityResult as ProbeOpportunityResultValue,
  type ProbeRequest as ProbeRequestValue,
} from '@profesor-ia/contracts';
import { SCED_OPPORTUNITY_H5_V1 } from '@profesor-ia/experiment';
import { z } from 'zod';

/** T-H6-06/08 — autoridad de oportunidad e interrupciones durante medición. */
export const MEASUREMENT_POLICY_SCHEMA_VERSION = 'measurement-authority-policy-v2' as const;
export const MEASUREMENT_INVENTORY_SCHEMA_VERSION = 'measurement-inventory-v1' as const;
export const MEASUREMENT_SEED_SCHEMA_VERSION = 'measurement-seed-v1' as const;
export const MEASUREMENT_STATE_SCHEMA_VERSION = 'measurement-state-v2' as const;

const Purpose = z.enum(['material', 'test_fixture']);
const NonEmptyText = z.string().trim().min(1).max(8_000);
const ShortText = z.string().trim().min(1).max(500);
const ProbeReasonCode = z.enum(KNOWN_PROBE_REASON_CODES);

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
    if (!Number.isFinite(value)) throw new MeasurementAuthorityError('INVALID_ARTIFACT', 'número no finito');
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value !== 'object') {
    throw new MeasurementAuthorityError('INVALID_ARTIFACT', 'valor no serializable');
  }
  if (seen.has(value)) throw new MeasurementAuthorityError('INVALID_ARTIFACT', 'referencia circular');
  seen.add(value);
  try {
    if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry, seen)).join(',')}]`;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new MeasurementAuthorityError('INVALID_ARTIFACT', 'solo se admiten objetos JSON planos');
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

function uniqueArray<T extends z.ZodType>(schema: T, label: string) {
  return z.array(schema).superRefine((values, context) => {
    const seen = new Set<unknown>();
    for (const [index, value] of values.entries()) {
      const key = typeof value === 'object' ? canonicalJson(value) : value;
      if (seen.has(key)) context.addIssue({ code: 'custom', message: `${label}: duplicado`, path: [index] });
      seen.add(key);
    }
  });
}

export type MeasurementAuthorityErrorCode =
  | 'ACTIVE_OPPORTUNITY_EXISTS'
  | 'ARTIFACT_HASH_MISMATCH'
  | 'INCIDENT_TAXONOMY_MISMATCH'
  | 'INVALID_ARTIFACT'
  | 'INVALID_EVENT'
  | 'INVALID_EVENT_SEQUENCE'
  | 'INVALID_STATE'
  | 'ITEM_OUTCOME_ORDER_VIOLATION'
  | 'MEASUREMENT_CONTROL_BLOCKED'
  | 'MATERIAL_FREEZE_REQUIRED'
  | 'OPPORTUNITY_CLOSED'
  | 'OPPORTUNITY_NOT_ACTIVE'
  | 'PLAN_NOT_FROZEN'
  | 'RUN_NOT_BOUND'
  | 'RUN_POLICY_DRIFT'
  | 'TIMER_NOT_EXPIRED';

export class MeasurementAuthorityError extends Error {
  constructor(
    readonly code: MeasurementAuthorityErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const ReasonPolicyEntry = z
  .object({
    reasonCode: ProbeReasonCode,
    operationalValidity: z.enum(['invalid', 'missing']),
  })
  .strict();

const IncidentTaxonomyEntry = z
  .object({
    incidentCode: ShortText,
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    validityEffect: z.enum(['continue', 'invalidate_act', 'invalidate_run']),
  })
  .strict();

export const MeasurementAuthorityPolicyDefinition = z
  .object({
    schemaVersion: z.literal(MEASUREMENT_POLICY_SCHEMA_VERSION),
    policyVersion: ShortText,
    purpose: Purpose,
    authority: z.literal('measurement_worker'),
    mode: z.literal('MEASUREMENT_MODE'),
    selectionAlgorithm: z.literal('sha256-ranked-frozen-seed-v1'),
    selectionRegisteredBeforeDelivery: z.literal(true),
    atomicConsumptionRequired: z.literal(true),
    singleItemDelivery: z.literal(true),
    hintsEnabled: z.literal(false),
    immediateFeedbackEnabled: z.literal(false),
    sessionMayChooseItemSeedTimeOrValidity: z.literal(false),
    interruptionSemantics: z
      .object({
        preItemPauseConsumes: z.literal(false),
        postItemPauseKeepsConsumption: z.literal(true),
        contentQuestionAllowsPedagogicalResponse: z.literal(false),
        contentQuestionExtendsClock: z.literal(false),
        timeoutUsesFrozenRubric: z.literal(true),
        sessionTimeoutReasonCode: z.literal('missing_session_time'),
        withdrawalForcesReplacement: z.literal(false),
        systemicIncidentSuspendsRun: z.literal(true),
      })
      .strict(),
    primaryCalibration: z
      .object({
        version: z.literal(SCED_OPPORTUNITY_H5_V1.version),
        kSet: z.literal(SCED_OPPORTUNITY_H5_V1.kSet),
        minValidItemsPerOpportunity: z.literal(
          SCED_OPPORTUNITY_H5_V1.minValidItemsPerOpportunity,
        ),
      })
      .strict(),
    reasonPolicy: z.array(ReasonPolicyEntry).min(1),
    incidentTaxonomy: z.array(IncidentTaxonomyEntry).min(1),
  })
  .strict()
  .superRefine((policy, context) => {
    const seen = new Set<string>();
    for (const [index, entry] of policy.reasonPolicy.entries()) {
      if (seen.has(entry.reasonCode)) {
        context.addIssue({ code: 'custom', message: 'reasonCode duplicado', path: ['reasonPolicy', index] });
      }
      seen.add(entry.reasonCode);
    }
    const reserveExhausted = policy.reasonPolicy.find((entry) => entry.reasonCode === 'reserve_exhausted');
    if (reserveExhausted?.operationalValidity !== 'missing') {
      context.addIssue({
        code: 'custom',
        message: 'reserve_exhausted debe producir dato faltante',
        path: ['reasonPolicy'],
      });
    }
    const requiredReasons = {
      invalid_participant_pause: 'invalid',
      missing_session_time: 'missing',
      withdrawal: 'missing',
      timeout: 'invalid',
      incident: 'invalid',
      reserve_exhausted: 'missing',
    } as const;
    for (const [reasonCode, operationalValidity] of Object.entries(requiredReasons)) {
      const entry = policy.reasonPolicy.find((candidate) => candidate.reasonCode === reasonCode);
      if (entry?.operationalValidity !== operationalValidity) {
        context.addIssue({
          code: 'custom',
          message: `${reasonCode} exige ${operationalValidity}`,
          path: ['reasonPolicy'],
        });
      }
    }
    const incidentCodes = new Set<string>();
    for (const [index, entry] of policy.incidentTaxonomy.entries()) {
      if (incidentCodes.has(entry.incidentCode)) {
        context.addIssue({
          code: 'custom',
          message: 'incidentCode duplicado',
          path: ['incidentTaxonomy', index, 'incidentCode'],
        });
      }
      incidentCodes.add(entry.incidentCode);
      const expectedEffect = entry.level === 1
        ? 'continue'
        : entry.level === 2
          ? 'invalidate_act'
          : 'invalidate_run';
      if (entry.validityEffect !== expectedEffect) {
        context.addIssue({
          code: 'custom',
          message: 'validityEffect no corresponde al nivel canónico',
          path: ['incidentTaxonomy', index, 'validityEffect'],
        });
      }
    }
  });
export type MeasurementAuthorityPolicyDefinition = z.infer<typeof MeasurementAuthorityPolicyDefinition>;

export function createMeasurementAuthorityPolicyDefinition(
  input: Readonly<{
    policyVersion: string;
    purpose: z.infer<typeof Purpose>;
    reasonPolicy: readonly z.input<typeof ReasonPolicyEntry>[];
    incidentTaxonomy: readonly z.input<typeof IncidentTaxonomyEntry>[];
  }>,
): MeasurementAuthorityPolicyDefinition {
  return MeasurementAuthorityPolicyDefinition.parse({
    schemaVersion: MEASUREMENT_POLICY_SCHEMA_VERSION,
    policyVersion: input.policyVersion,
    purpose: input.purpose,
    authority: 'measurement_worker',
    mode: 'MEASUREMENT_MODE',
    selectionAlgorithm: 'sha256-ranked-frozen-seed-v1',
    selectionRegisteredBeforeDelivery: true,
    atomicConsumptionRequired: true,
    singleItemDelivery: true,
    hintsEnabled: false,
    immediateFeedbackEnabled: false,
    sessionMayChooseItemSeedTimeOrValidity: false,
    interruptionSemantics: {
      preItemPauseConsumes: false,
      postItemPauseKeepsConsumption: true,
      contentQuestionAllowsPedagogicalResponse: false,
      contentQuestionExtendsClock: false,
      timeoutUsesFrozenRubric: true,
      sessionTimeoutReasonCode: 'missing_session_time',
      withdrawalForcesReplacement: false,
      systemicIncidentSuspendsRun: true,
    },
    primaryCalibration: {
      version: SCED_OPPORTUNITY_H5_V1.version,
      kSet: SCED_OPPORTUNITY_H5_V1.kSet,
      minValidItemsPerOpportunity: SCED_OPPORTUNITY_H5_V1.minValidItemsPerOpportunity,
    },
    reasonPolicy: [...input.reasonPolicy],
    incidentTaxonomy: [...input.incidentTaxonomy],
  });
}

export interface CompiledMeasurementPolicy {
  readonly definition: MeasurementAuthorityPolicyDefinition;
  readonly policyHash: string;
}

export function compileMeasurementPolicy(value: unknown, expectedHash?: string): CompiledMeasurementPolicy {
  const parsed = MeasurementAuthorityPolicyDefinition.safeParse(value);
  if (!parsed.success) throw new MeasurementAuthorityError('INVALID_ARTIFACT', z.prettifyError(parsed.error));
  const policyHash = hashJson(parsed.data);
  if (expectedHash !== undefined && policyHash !== expectedHash) {
    throw new MeasurementAuthorityError('ARTIFACT_HASH_MISMATCH', 'hash de política de medición inválido');
  }
  return deepFreeze({ definition: deepFreeze(parsed.data), policyHash });
}

export const MeasurementOpportunityPlan = z
  .object({
    planId: Id,
    experimentalSet: ShortText,
    phase: z.enum(['baseline', 'intervention', 'retention']),
    measureKind: MeasureKind,
    reserve: MeasurementReserve,
    batchSize: z.number().int().positive(),
    minValidItems: z.number().int().positive(),
  })
  .strict()
  .superRefine((plan, context) => {
    const expectedReserve = probeReserveFor(plan.measureKind, plan.phase);
    if (expectedReserve === null || expectedReserve !== plan.reserve) {
      context.addIssue({ code: 'custom', message: 'plan y reserva no coinciden con el contrato' });
    }
    if (plan.minValidItems > plan.batchSize) {
      context.addIssue({ code: 'custom', message: 'minValidItems supera batchSize' });
    }
    if (
      plan.measureKind === 'primary_probe' &&
      (plan.batchSize !== SCED_OPPORTUNITY_H5_V1.kSet ||
        plan.minValidItems !== SCED_OPPORTUNITY_H5_V1.minValidItemsPerOpportunity)
    ) {
      context.addIssue({ code: 'custom', message: 'plan primario discrepa de la calibración H5' });
    }
  });
export type MeasurementOpportunityPlan = z.infer<typeof MeasurementOpportunityPlan>;

export const MeasurementInventoryItem = z
  .object({
    itemId: Id,
    itemFamilyId: Id,
    structuralSignature: Sha256Hex,
    experimentalSet: ShortText,
    reserve: MeasurementReserve,
    prompt: StructuredItemPrompt,
    timeLimitSeconds: z.number().int().positive(),
    verifierContract: ShortText,
  })
  .strict()
  .superRefine((item, context) => {
    if (item.prompt.itemId !== item.itemId) {
      context.addIssue({ code: 'custom', message: 'prompt.itemId no coincide con itemId' });
    }
  });
export type MeasurementInventoryItem = z.infer<typeof MeasurementInventoryItem>;

export const FrozenMeasurementInventory = z
  .object({
    schemaVersion: z.literal(MEASUREMENT_INVENTORY_SCHEMA_VERSION),
    inventoryVersion: ShortText,
    purpose: Purpose,
    packageVersion: VersionRef,
    plans: z.array(MeasurementOpportunityPlan).min(1),
    items: z.array(MeasurementInventoryItem).min(1),
  })
  .strict()
  .superRefine((inventory, context) => {
    const planIds = new Set<string>();
    const planKeys = new Set<string>();
    for (const [index, plan] of inventory.plans.entries()) {
      const key = `${plan.experimentalSet}\u0000${plan.phase}\u0000${plan.measureKind}`;
      if (planIds.has(plan.planId)) {
        context.addIssue({ code: 'custom', message: 'planId duplicado', path: ['plans', index] });
      }
      if (planKeys.has(key)) {
        context.addIssue({ code: 'custom', message: 'dos planes para la misma solicitud', path: ['plans', index] });
      }
      planIds.add(plan.planId);
      planKeys.add(key);
      if (!inventory.items.some(
        (item) => item.experimentalSet === plan.experimentalSet && item.reserve === plan.reserve,
      )) {
        context.addIssue({ code: 'custom', message: 'plan sin ningún reactivo candidato', path: ['plans', index] });
      }
    }
    const itemIds = new Set<string>();
    for (const [index, item] of inventory.items.entries()) {
      if (itemIds.has(item.itemId)) {
        context.addIssue({ code: 'custom', message: 'itemId duplicado', path: ['items', index] });
      }
      itemIds.add(item.itemId);
      if (!inventory.plans.some(
        (plan) => plan.experimentalSet === item.experimentalSet && plan.reserve === item.reserve,
      )) {
        context.addIssue({ code: 'custom', message: 'reactivo sin plan autorizado', path: ['items', index] });
      }
    }
  });
export type FrozenMeasurementInventory = z.infer<typeof FrozenMeasurementInventory>;

export interface CompiledMeasurementInventory {
  readonly definition: FrozenMeasurementInventory;
  readonly inventoryHash: string;
}

export function compileMeasurementInventory(
  value: unknown,
  expectedHash?: string,
): CompiledMeasurementInventory {
  const parsed = FrozenMeasurementInventory.safeParse(value);
  if (!parsed.success) throw new MeasurementAuthorityError('INVALID_ARTIFACT', z.prettifyError(parsed.error));
  const inventoryHash = hashJson(parsed.data);
  if (expectedHash !== undefined && inventoryHash !== expectedHash) {
    throw new MeasurementAuthorityError('ARTIFACT_HASH_MISMATCH', 'hash de inventario inválido');
  }
  return deepFreeze({ definition: deepFreeze(parsed.data), inventoryHash });
}

export const MeasurementSeedDefinition = z
  .object({
    schemaVersion: z.literal(MEASUREMENT_SEED_SCHEMA_VERSION),
    seedVersion: ShortText,
    purpose: Purpose,
    seedId: Id,
    seedValue: NonEmptyText,
  })
  .strict();
export type MeasurementSeedDefinition = z.infer<typeof MeasurementSeedDefinition>;

export interface CompiledMeasurementSeed {
  readonly definition: MeasurementSeedDefinition;
  readonly seedHash: string;
}

export function compileMeasurementSeed(value: unknown, expectedHash?: string): CompiledMeasurementSeed {
  const parsed = MeasurementSeedDefinition.safeParse(value);
  if (!parsed.success) throw new MeasurementAuthorityError('INVALID_ARTIFACT', z.prettifyError(parsed.error));
  const seedHash = hashJson(parsed.data);
  if (expectedHash !== undefined && seedHash !== expectedHash) {
    throw new MeasurementAuthorityError('ARTIFACT_HASH_MISMATCH', 'hash de semilla inválido');
  }
  return deepFreeze({ definition: deepFreeze(parsed.data), seedHash });
}

const MeasurementRunBinding = z
  .object({
    runId: Id,
    purpose: Purpose,
    policyVersion: ShortText,
    policyHash: Sha256Hex,
    inventoryVersion: ShortText,
    inventoryHash: Sha256Hex,
    seedVersion: ShortText,
    seedHash: Sha256Hex,
    packageVersion: VersionRef,
  })
  .strict();
export type MeasurementRunBinding = z.infer<typeof MeasurementRunBinding>;

export class MeasurementRunRegistry {
  readonly #bindings = new Map<string, MeasurementRunBinding>();

  constructor(restored: readonly unknown[] = []) {
    for (const value of restored) {
      const parsed = MeasurementRunBinding.safeParse(value);
      if (!parsed.success) throw new MeasurementAuthorityError('INVALID_ARTIFACT', z.prettifyError(parsed.error));
      const current = this.#bindings.get(parsed.data.runId);
      if (current !== undefined && canonicalJson(current) !== canonicalJson(parsed.data)) {
        throw new MeasurementAuthorityError('RUN_POLICY_DRIFT', `bindings distintos para ${parsed.data.runId}`);
      }
      this.#bindings.set(parsed.data.runId, deepFreeze(parsed.data));
    }
  }

  bind(
    policy: CompiledMeasurementPolicy,
    inventory: CompiledMeasurementInventory,
    seed: CompiledMeasurementSeed,
    value: unknown,
  ): MeasurementRunBinding {
    const parsed = MeasurementRunBinding.safeParse(value);
    if (!parsed.success) throw new MeasurementAuthorityError('INVALID_ARTIFACT', z.prettifyError(parsed.error));
    const binding = parsed.data;
    if (!bindingMatches(binding, policy, inventory, seed)) {
      throw new MeasurementAuthorityError('RUN_POLICY_DRIFT', 'binding y artefactos de medición no coinciden');
    }
    const current = this.#bindings.get(binding.runId);
    if (current !== undefined && canonicalJson(current) !== canonicalJson(binding)) {
      throw new MeasurementAuthorityError('RUN_POLICY_DRIFT', `la corrida ${binding.runId} ya está ligada`);
    }
    if (current !== undefined) return current;
    const frozen = deepFreeze(binding);
    this.#bindings.set(binding.runId, frozen);
    return frozen;
  }

  assertBound(
    runId: string,
    policy: CompiledMeasurementPolicy,
    inventory: CompiledMeasurementInventory,
    seed: CompiledMeasurementSeed,
  ): MeasurementRunBinding {
    const binding = this.#bindings.get(runId);
    if (binding === undefined) throw new MeasurementAuthorityError('RUN_NOT_BOUND', `corrida sin binding: ${runId}`);
    if (!bindingMatches(binding, policy, inventory, seed)) {
      throw new MeasurementAuthorityError('RUN_POLICY_DRIFT', `artefactos distintos para ${runId}`);
    }
    return binding;
  }

  bindings(): readonly MeasurementRunBinding[] {
    return deepFreeze([...this.#bindings.values()]);
  }
}

function bindingMatches(
  binding: MeasurementRunBinding,
  policy: CompiledMeasurementPolicy,
  inventory: CompiledMeasurementInventory,
  seed: CompiledMeasurementSeed,
): boolean {
  return (
    binding.purpose === policy.definition.purpose &&
    binding.purpose === inventory.definition.purpose &&
    binding.purpose === seed.definition.purpose &&
    binding.policyVersion === policy.definition.policyVersion &&
    binding.policyHash === policy.policyHash &&
    binding.inventoryVersion === inventory.definition.inventoryVersion &&
    binding.inventoryHash === inventory.inventoryHash &&
    binding.seedVersion === seed.definition.seedVersion &&
    binding.seedHash === seed.seedHash &&
    canonicalJson(binding.packageVersion) === canonicalJson(inventory.definition.packageVersion)
  );
}

const MeasurementInitializedEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('measurement.initialized'),
    sequenceNumber: z.literal(0),
    occurredAt: IsoDateTime,
    payload: z
      .object({
        runId: Id,
        participantPseudoId: Id,
        priorConsumptions: z
          .array(
            z
              .object({
                itemId: Id,
                sourceReserve: Reserve,
                consumedAt: IsoDateTime,
              })
              .strict(),
          )
          .default([]),
      })
      .strict(),
  })
  .strict();
const OpportunityOpenedEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('measurement.opportunity.opened'),
    sequenceNumber: z.number().int().positive(),
    occurredAt: IsoDateTime,
    payload: ProbeRequest,
  })
  .strict();
const DeliveryRequestedEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('measurement.delivery.requested'),
    sequenceNumber: z.number().int().positive(),
    occurredAt: IsoDateTime,
    payload: z.object({ opportunityId: Id }).strict(),
  })
  .strict();
const ItemOutcome = z.object({ kind: z.literal('scored'), correct: z.boolean() }).strict();
const ItemOutcomeObservedEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('measurement.item.outcome_observed'),
    sequenceNumber: z.number().int().positive(),
    occurredAt: IsoDateTime,
    payload: z.object({ opportunityId: Id, probeInstanceId: Id, outcome: ItemOutcome }).strict(),
  })
  .strict();
const PauseRequestedEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('measurement.pause.requested'),
    sequenceNumber: z.number().int().positive(),
    occurredAt: IsoDateTime,
    payload: z.object({ opportunityId: Id }).strict(),
  })
  .strict();
const PauseResumedEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('measurement.pause.resumed'),
    sequenceNumber: z.number().int().positive(),
    occurredAt: IsoDateTime,
    payload: z.object({ pauseEffectId: Id }).strict(),
  })
  .strict();
const ContentQuestionRecordedEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('measurement.content_question.recorded'),
    sequenceNumber: z.number().int().positive(),
    occurredAt: IsoDateTime,
    payload: z
      .object({
        opportunityId: Id,
        probeInstanceId: Id,
        responseKind: z.enum(['none', 'rights_or_procedure']),
      })
      .strict(),
  })
  .strict();
const ProbeTimeoutEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('measurement.probe.timeout'),
    sequenceNumber: z.number().int().positive(),
    occurredAt: IsoDateTime,
    payload: z.object({ opportunityId: Id, probeInstanceId: Id }).strict(),
  })
  .strict();
const SessionTimeExpiredEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('measurement.session_time.expired'),
    sequenceNumber: z.number().int().positive(),
    occurredAt: IsoDateTime,
    payload: z.object({ opportunityId: Id, sessionDeadlineAt: IsoDateTime }).strict(),
  })
  .strict();
const WithdrawalRecordedEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('measurement.withdrawal.recorded'),
    sequenceNumber: z.number().int().positive(),
    occurredAt: IsoDateTime,
    payload: z.object({ opportunityId: Id, consentDecisionRef: Id }).strict(),
  })
  .strict();
const IncidentRecordedEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('measurement.incident.recorded'),
    sequenceNumber: z.number().int().positive(),
    occurredAt: IsoDateTime,
    payload: z.object({ opportunityId: Id, incident: Incident }).strict(),
  })
  .strict();

export const MeasurementEvent = z.discriminatedUnion('eventType', [
  MeasurementInitializedEvent,
  OpportunityOpenedEvent,
  DeliveryRequestedEvent,
  ItemOutcomeObservedEvent,
  PauseRequestedEvent,
  PauseResumedEvent,
  ContentQuestionRecordedEvent,
  ProbeTimeoutEvent,
  SessionTimeExpiredEvent,
  WithdrawalRecordedEvent,
  IncidentRecordedEvent,
]);
export type MeasurementEvent = z.infer<typeof MeasurementEvent>;
type MeasurementControlEvent =
  | z.infer<typeof PauseRequestedEvent>
  | z.infer<typeof PauseResumedEvent>
  | z.infer<typeof ContentQuestionRecordedEvent>
  | z.infer<typeof ProbeTimeoutEvent>
  | z.infer<typeof SessionTimeExpiredEvent>
  | z.infer<typeof WithdrawalRecordedEvent>
  | z.infer<typeof IncidentRecordedEvent>;

export const MeasurementSelectionRecord = z
  .object({
    selectionId: Id,
    itemId: Id,
    reserve: MeasurementReserve,
    selectionRank: Sha256Hex,
    delivery: ProbeDelivery,
    selectedAt: IsoDateTime,
    consumedAt: IsoDateTime,
  })
  .strict();
export type MeasurementSelectionRecord = z.infer<typeof MeasurementSelectionRecord>;

export const MeasurementItemOutcomeRecord = z
  .object({
    probeInstanceId: Id,
    itemOrdinal: z.number().int().positive(),
    operationalValidity: OperationalValidity,
    correct: z.boolean().nullable(),
    reasonCode: ProbeReasonCode.nullable(),
    observedAt: IsoDateTime,
  })
  .strict()
  .superRefine((outcome, context) => {
    if (outcome.operationalValidity === 'valid') {
      if (outcome.correct === null || outcome.reasonCode !== null) {
        context.addIssue({ code: 'custom', message: 'resultado puntuado incoherente' });
      }
    } else if (outcome.correct !== null || outcome.reasonCode === null) {
      context.addIssue({ code: 'custom', message: 'resultado no válido incoherente' });
    }
  });
export type MeasurementItemOutcomeRecord = z.infer<typeof MeasurementItemOutcomeRecord>;

export const MeasurementOpportunityState = z
  .object({
    request: ProbeRequest,
    planId: Id,
    reserve: MeasurementReserve,
    batchSize: z.number().int().positive(),
    minValidItems: z.number().int().positive(),
    status: z.enum(['open', 'closed']),
    selections: z.array(MeasurementSelectionRecord),
    outcomes: z.array(MeasurementItemOutcomeRecord),
    result: ProbeOpportunityResult.nullable(),
    openedAt: IsoDateTime,
    closedAt: IsoDateTime.nullable(),
  })
  .strict()
  .superRefine((opportunity, context) => {
    if (opportunity.minValidItems > opportunity.batchSize) {
      context.addIssue({ code: 'custom', message: 'mínimo mayor al lote' });
    }
    if (opportunity.selections.length > opportunity.batchSize) {
      context.addIssue({ code: 'custom', message: 'más selecciones que reactivos planificados' });
    }
    const outcomeIds = new Set(opportunity.outcomes.map((outcome) => outcome.probeInstanceId));
    if (outcomeIds.size !== opportunity.outcomes.length) {
      context.addIssue({ code: 'custom', message: 'resultado de ítem duplicado' });
    }
    if (opportunity.outcomes.some(
      (outcome) => !opportunity.selections.some(
        (selection) => selection.delivery.probeInstanceId === outcome.probeInstanceId,
      ),
    )) {
      context.addIssue({ code: 'custom', message: 'resultado sin selección' });
    }
    const outstanding = opportunity.selections.length - opportunity.outcomes.length;
    if (outstanding < 0 || outstanding > 1) {
      context.addIssue({ code: 'custom', message: 'se rompió la entrega de un ítem a la vez' });
    }
    if (opportunity.status === 'open' && (opportunity.result !== null || opportunity.closedAt !== null)) {
      context.addIssue({ code: 'custom', message: 'oportunidad abierta con resultado terminal' });
    }
    if (opportunity.status === 'closed' && (opportunity.result === null || opportunity.closedAt === null)) {
      context.addIssue({ code: 'custom', message: 'oportunidad cerrada sin resultado terminal' });
    }
  });
export type MeasurementOpportunityState = z.infer<typeof MeasurementOpportunityState>;

export const MeasurementRunState = z
  .object({
    schemaVersion: z.literal(MEASUREMENT_STATE_SCHEMA_VERSION),
    revision: z.number().int().nonnegative(),
    runId: Id,
    participantPseudoId: Id,
    policyVersion: ShortText,
    policyHash: Sha256Hex,
    inventoryVersion: ShortText,
    inventoryHash: Sha256Hex,
    seedVersion: ShortText,
    seedHash: Sha256Hex,
    packageVersion: VersionRef,
    runDisposition: MeasurementRunDisposition,
    activePauseEffectId: Id.nullable(),
    activeOpportunityId: Id.nullable(),
    opportunities: z.array(MeasurementOpportunityState),
    controlEffects: z.array(MeasurementControlEffect),
    priorConsumptions: uniqueArray(
      z.object({ itemId: Id, sourceReserve: Reserve, consumedAt: IsoDateTime }).strict(),
      'priorConsumptions',
    ),
    excludedMeasurementItemIds: uniqueArray(Id, 'excludedMeasurementItemIds'),
    consumedItemIds: uniqueArray(Id, 'consumedItemIds'),
    processedEventIds: uniqueArray(Id, 'processedEventIds'),
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
  })
  .strict()
  .superRefine((state, context) => {
    if (state.processedEventIds.length !== state.revision + 1) {
      context.addIssue({ code: 'custom', message: 'revisión no coincide con eventos' });
    }
    const opportunityIds = new Set<string>();
    for (const [index, opportunity] of state.opportunities.entries()) {
      if (opportunityIds.has(opportunity.request.opportunityId)) {
        context.addIssue({ code: 'custom', message: 'opportunityId duplicado', path: ['opportunities', index] });
      }
      opportunityIds.add(opportunity.request.opportunityId);
    }
    const open = state.opportunities.filter((opportunity) => opportunity.status === 'open');
    if (open.length > 1 || (open[0]?.request.opportunityId ?? null) !== state.activeOpportunityId) {
      context.addIssue({ code: 'custom', message: 'activeOpportunityId no coincide con oportunidades' });
    }
    const effectIds = new Set(state.controlEffects.map((effect) => effect.effectId));
    if (effectIds.size !== state.controlEffects.length) {
      context.addIssue({ code: 'custom', message: 'effectId de control duplicado' });
    }
    const activePause = state.activePauseEffectId === null
      ? null
      : state.controlEffects.find((effect) => effect.effectId === state.activePauseEffectId);
    if (
      (state.runDisposition === 'paused' &&
        (activePause?.kind !== 'pre_item_pause' && activePause?.kind !== 'post_item_pause')) ||
      (state.runDisposition !== 'paused' && state.activePauseEffectId !== null)
    ) {
      context.addIssue({ code: 'custom', message: 'pausa activa no coincide con disposición de corrida' });
    }
    const selectedIds = state.opportunities.flatMap((opportunity) =>
      opportunity.selections.map((selection) => selection.itemId),
    );
    if (canonicalJson(selectedIds) !== canonicalJson(state.consumedItemIds)) {
      context.addIssue({ code: 'custom', message: 'consumo no coincide con selecciones' });
    }
    if (Date.parse(state.updatedAt) < Date.parse(state.createdAt)) {
      context.addIssue({ code: 'custom', message: 'updatedAt retrocede' });
    }
  });
export type MeasurementRunState = z.infer<typeof MeasurementRunState>;

export interface MeasurementMutation {
  readonly state: MeasurementRunState;
  readonly delivery: ProbeDeliveryValue | null;
  readonly result: ProbeOpportunityResultValue | null;
  readonly controlEffect: MeasurementControlEffectValue | null;
}

function parseEvent(value: unknown): MeasurementEvent {
  const parsed = MeasurementEvent.safeParse(value);
  if (!parsed.success) throw new MeasurementAuthorityError('INVALID_EVENT', z.prettifyError(parsed.error));
  return parsed.data;
}

function parseState(value: unknown): MeasurementRunState {
  const parsed = MeasurementRunState.safeParse(value);
  if (!parsed.success) throw new MeasurementAuthorityError('INVALID_STATE', z.prettifyError(parsed.error));
  return parsed.data;
}

function planForRequest(
  inventory: CompiledMeasurementInventory,
  request: ProbeRequestValue,
): MeasurementOpportunityPlan {
  const plan = inventory.definition.plans.find(
    (candidate) =>
      candidate.experimentalSet === request.experimentalSet &&
      candidate.phase === request.phase &&
      candidate.measureKind === request.measureKind,
  );
  if (plan === undefined) {
    throw new MeasurementAuthorityError('PLAN_NOT_FROZEN', 'la solicitud no tiene plan congelado');
  }
  return plan;
}

function reasonValidity(
  policy: CompiledMeasurementPolicy,
  reasonCode: z.infer<typeof ProbeReasonCode>,
): Exclude<OperationalValidityValue, 'valid'> {
  const entry = policy.definition.reasonPolicy.find((candidate) => candidate.reasonCode === reasonCode);
  if (entry === undefined) {
    throw new MeasurementAuthorityError('INVALID_EVENT', `reasonCode no preinscrito: ${reasonCode}`);
  }
  return entry.operationalValidity;
}

function selectionRank(
  seed: CompiledMeasurementSeed,
  state: MeasurementRunState,
  opportunityId: string,
  itemId: string,
): string {
  return hashJson({
    algorithm: 'sha256-ranked-frozen-seed-v1',
    seedValue: seed.definition.seedValue,
    runId: state.runId,
    participantPseudoId: state.participantPseudoId,
    opportunityId,
    itemId,
  });
}

function eligibleItems(
  inventory: CompiledMeasurementInventory,
  seed: CompiledMeasurementSeed,
  state: MeasurementRunState,
  opportunity: MeasurementOpportunityState,
): readonly { item: MeasurementInventoryItem; rank: string }[] {
  return inventory.definition.items
    .filter(
      (item) =>
        item.experimentalSet === opportunity.request.experimentalSet &&
        item.reserve === opportunity.reserve &&
        !state.excludedMeasurementItemIds.includes(item.itemId) &&
        !state.consumedItemIds.includes(item.itemId),
    )
    .map((item) => ({
      item,
      rank: selectionRank(seed, state, opportunity.request.opportunityId, item.itemId),
    }))
    .sort((left, right) => left.rank.localeCompare(right.rank) || left.item.itemId.localeCompare(right.item.itemId));
}

function replaceOpportunity(
  state: MeasurementRunState,
  next: MeasurementOpportunityState,
): MeasurementOpportunityState[] {
  return state.opportunities.map((opportunity) =>
    opportunity.request.opportunityId === next.request.opportunityId ? next : opportunity,
  );
}

function opportunityResult(
  opportunity: MeasurementOpportunityState,
  policy: CompiledMeasurementPolicy,
  fallbackReason?: z.infer<typeof ProbeReasonCode>,
): ProbeOpportunityResultValue {
  const valid = opportunity.outcomes.filter((outcome) => outcome.operationalValidity === 'valid');
  const correct = valid.filter((outcome) => outcome.correct === true).length;
  if (valid.length >= opportunity.minValidItems) {
    return ProbeOpportunityResult.parse({
      opportunityId: opportunity.request.opportunityId,
      probeRoundId: opportunity.request.probeRoundId,
      plannedItems: opportunity.batchSize,
      validScoredItems: valid.length,
      correctValidItems: correct,
      observation: correct / valid.length,
      operationalValidity: 'valid',
      reasonCode: null,
    });
  }
  const firstReason = opportunity.outcomes.find((outcome) => outcome.reasonCode !== null)?.reasonCode
    ?? fallbackReason;
  if (firstReason === undefined) {
    throw new MeasurementAuthorityError('INVALID_STATE', 'no hay razón para cerrar sin observación válida');
  }
  return ProbeOpportunityResult.parse({
    opportunityId: opportunity.request.opportunityId,
    probeRoundId: opportunity.request.probeRoundId,
    plannedItems: opportunity.batchSize,
    validScoredItems: valid.length,
    correctValidItems: correct,
    observation: null,
    operationalValidity: reasonValidity(policy, firstReason),
    reasonCode: firstReason,
  });
}

function forcedOpportunityResult(
  opportunity: MeasurementOpportunityState,
  policy: CompiledMeasurementPolicy,
  reasonCode: z.infer<typeof ProbeReasonCode>,
): ProbeOpportunityResultValue {
  const valid = opportunity.outcomes.filter((outcome) => outcome.operationalValidity === 'valid');
  return ProbeOpportunityResult.parse({
    opportunityId: opportunity.request.opportunityId,
    probeRoundId: opportunity.request.probeRoundId,
    plannedItems: opportunity.batchSize,
    validScoredItems: valid.length,
    correctValidItems: valid.filter((outcome) => outcome.correct === true).length,
    observation: null,
    operationalValidity: reasonValidity(policy, reasonCode),
    reasonCode,
  });
}

function activeSelection(opportunity: MeasurementOpportunityState): MeasurementSelectionRecord | null {
  if (opportunity.selections.length === opportunity.outcomes.length) return null;
  return opportunity.selections.at(-1) ?? null;
}

function selectionDeadline(selection: MeasurementSelectionRecord): string {
  return new Date(
    Date.parse(selection.selectedAt) + selection.delivery.timeLimitSeconds * 1_000,
  ).toISOString();
}

function reasonOutcome(
  selection: MeasurementSelectionRecord,
  reasonCode: z.infer<typeof ProbeReasonCode>,
  occurredAt: string,
  policy: CompiledMeasurementPolicy,
): MeasurementItemOutcomeRecord {
  return MeasurementItemOutcomeRecord.parse({
    probeInstanceId: selection.delivery.probeInstanceId,
    itemOrdinal: selection.delivery.itemOrdinal,
    operationalValidity: reasonValidity(policy, reasonCode),
    correct: null,
    reasonCode,
    observedAt: occurredAt,
  });
}

function withReasonOutcome(
  opportunity: MeasurementOpportunityState,
  selection: MeasurementSelectionRecord | null,
  reasonCode: z.infer<typeof ProbeReasonCode>,
  occurredAt: string,
  policy: CompiledMeasurementPolicy,
  forceClose: boolean,
): { opportunity: MeasurementOpportunityState; result: ProbeOpportunityResultValue | null } {
  const outcomes = selection === null
    ? opportunity.outcomes
    : [...opportunity.outcomes, reasonOutcome(selection, reasonCode, occurredAt, policy)];
  const afterOutcome = MeasurementOpportunityState.parse({ ...opportunity, outcomes });
  const terminal = forceClose || outcomes.length === opportunity.batchSize;
  const result = terminal
    ? forceClose
      ? forcedOpportunityResult(afterOutcome, policy, reasonCode)
      : opportunityResult(afterOutcome, policy)
    : null;
  return {
    opportunity: MeasurementOpportunityState.parse({
      ...afterOutcome,
      status: terminal ? 'closed' : 'open',
      result,
      closedAt: terminal ? occurredAt : null,
    }),
    result,
  };
}

function assertHeader(state: MeasurementRunState, event: Exclude<MeasurementEvent, { sequenceNumber: 0 }>): void {
  if (event.sequenceNumber !== state.revision + 1) {
    throw new MeasurementAuthorityError(
      'INVALID_EVENT_SEQUENCE',
      `se esperaba ${state.revision + 1}, se recibió ${event.sequenceNumber}`,
    );
  }
  if (state.processedEventIds.includes(event.eventId)) {
    throw new MeasurementAuthorityError('INVALID_EVENT_SEQUENCE', `eventId duplicado: ${event.eventId}`);
  }
  if (Date.parse(event.occurredAt) < Date.parse(state.updatedAt)) {
    throw new MeasurementAuthorityError('INVALID_EVENT_SEQUENCE', 'occurredAt no puede retroceder');
  }
}

function assertStateMatchesArtifacts(
  state: MeasurementRunState,
  policy: CompiledMeasurementPolicy,
  inventory: CompiledMeasurementInventory,
  seed: CompiledMeasurementSeed,
): void {
  const expectedExcluded = inventory.definition.items
    .filter((item) =>
      state.priorConsumptions.some(
        (consumption) =>
          consumption.itemId === item.itemId &&
          consumptionBlocksMeasurement(consumption.sourceReserve, item.reserve),
      ),
    )
    .map((item) => item.itemId);
  if (canonicalJson(expectedExcluded) !== canonicalJson(state.excludedMeasurementItemIds)) {
    throw new MeasurementAuthorityError('INVALID_STATE', 'exclusiones de consumo previo adulteradas');
  }
  const reconstructedConsumed: string[] = [];
  for (const opportunity of state.opportunities) {
    const plan = planForRequest(inventory, opportunity.request);
    if (
      opportunity.planId !== plan.planId ||
      opportunity.reserve !== plan.reserve ||
      opportunity.batchSize !== plan.batchSize ||
      opportunity.minValidItems !== plan.minValidItems
    ) {
      throw new MeasurementAuthorityError('INVALID_STATE', 'oportunidad restaurada discrepa del plan');
    }
    for (const selection of opportunity.selections) {
      const item = inventory.definition.items.find((candidate) => candidate.itemId === selection.itemId);
      if (item === undefined || item.reserve !== opportunity.reserve) {
        throw new MeasurementAuthorityError('INVALID_STATE', 'selección restaurada no pertenece al inventario');
      }
      const expectedDelivery = ProbeDelivery.parse({
        probeInstanceId: selection.delivery.probeInstanceId,
        opportunityId: opportunity.request.opportunityId,
        itemOrdinal: reconstructedConsumed.filter((itemId) =>
          opportunity.selections.some((candidate) => candidate.itemId === itemId),
        ).length + 1,
        batchSize: opportunity.batchSize,
        prompt: item.prompt,
        timeLimitSeconds: item.timeLimitSeconds,
        verifierContract: item.verifierContract,
      });
      if (
        selection.selectionRank !== selectionRank(seed, state, opportunity.request.opportunityId, item.itemId) ||
        canonicalJson(selection.delivery) !== canonicalJson(expectedDelivery) ||
        selection.selectedAt !== selection.consumedAt
      ) {
        throw new MeasurementAuthorityError('INVALID_STATE', 'selección restaurada fue adulterada');
      }
      const simulatedState = { ...state, consumedItemIds: reconstructedConsumed } as MeasurementRunState;
      const expectedFirst = eligibleItems(inventory, seed, simulatedState, opportunity)[0];
      if (expectedFirst?.item.itemId !== item.itemId) {
        throw new MeasurementAuthorityError('INVALID_STATE', 'orden de selección no corresponde a la semilla');
      }
      reconstructedConsumed.push(item.itemId);
    }
    if (opportunity.result !== null) {
      const forcedEffect = [...state.controlEffects].reverse().find(
        (effect) =>
          effect.opportunityId === opportunity.request.opportunityId &&
          (effect.kind === 'session_time_expired' ||
            effect.kind === 'withdrawal' ||
            (effect.kind === 'incident' && effect.scope === 'systemic')),
      );
      const forcedReason = forcedEffect?.reasonCode ?? undefined;
      const expectedResult = forcedReason === undefined
        ? opportunityResult(
            opportunity,
            policy,
            opportunity.selections.length < opportunity.batchSize ? 'reserve_exhausted' : undefined,
          )
        : forcedOpportunityResult(opportunity, policy, forcedReason);
      if (canonicalJson(opportunity.result) !== canonicalJson(expectedResult)) {
        throw new MeasurementAuthorityError('INVALID_STATE', 'resultado restaurado no fue derivado por el worker');
      }
    }
  }
  if (canonicalJson(reconstructedConsumed) !== canonicalJson(state.consumedItemIds)) {
    throw new MeasurementAuthorityError('INVALID_STATE', 'consumo restaurado no coincide con selección');
  }

  let disposition: z.infer<typeof MeasurementRunDisposition> = 'active';
  let activePauseEffectId: string | null = null;
  let priorEffectEventIndex = -1;
  let priorEffectTime = state.createdAt;
  for (const effect of state.controlEffects) {
    const eventIndex = state.processedEventIds.indexOf(effect.effectId);
    if (
      eventIndex <= priorEffectEventIndex ||
      effect.runId !== state.runId ||
      effect.participantPseudoId !== state.participantPseudoId ||
      Date.parse(effect.occurredAt) < Date.parse(priorEffectTime) ||
      Date.parse(effect.occurredAt) > Date.parse(state.updatedAt)
    ) {
      throw new MeasurementAuthorityError('INVALID_STATE', 'historia de control adulterada');
    }
    priorEffectEventIndex = eventIndex;
    priorEffectTime = effect.occurredAt;
    const opportunity = state.opportunities.find(
      (candidate) => candidate.request.opportunityId === effect.opportunityId,
    );
    if (opportunity === undefined) {
      throw new MeasurementAuthorityError('INVALID_STATE', 'efecto de control sin oportunidad');
    }
    const selection = effect.probeInstanceId === null
      ? null
      : opportunity.selections.find(
          (candidate) => candidate.delivery.probeInstanceId === effect.probeInstanceId,
        ) ?? null;
    const linkedOutcome = selection === null
      ? null
      : opportunity.outcomes.find(
          (outcome) => outcome.probeInstanceId === selection.delivery.probeInstanceId,
        ) ?? null;
    if (selection !== null && Date.parse(effect.occurredAt) < Date.parse(selection.selectedAt)) {
      throw new MeasurementAuthorityError('INVALID_STATE', 'efecto de control anterior al ítem enlazado');
    }

    if (disposition === 'suspended' || disposition === 'withdrawn') {
      throw new MeasurementAuthorityError('INVALID_STATE', 'hay efectos posteriores al cierre de corrida');
    }
    if (effect.kind === 'pre_item_pause' || effect.kind === 'post_item_pause') {
      if (disposition !== 'active' || activePauseEffectId !== null) {
        throw new MeasurementAuthorityError('INVALID_STATE', 'pausa fuera de una corrida activa');
      }
      if (
        effect.kind === 'post_item_pause' &&
        (selection === null ||
          linkedOutcome?.reasonCode !== 'invalid_participant_pause' ||
          linkedOutcome.observedAt !== effect.occurredAt ||
          effect.opportunityClosed !== (selection.delivery.itemOrdinal === opportunity.batchSize))
      ) {
        throw new MeasurementAuthorityError('INVALID_STATE', 'pausa post-ítem sin invalidación derivada');
      }
      disposition = 'paused';
      activePauseEffectId = effect.effectId;
      continue;
    }
    if (effect.kind === 'pause_resumed') {
      const pauseEffect = state.controlEffects.find(
        (candidate) => candidate.effectId === effect.pauseEffectId,
      );
      if (disposition !== 'paused' || effect.pauseEffectId !== activePauseEffectId) {
        throw new MeasurementAuthorityError('INVALID_STATE', 'reanudación no corresponde a pausa activa');
      }
      if (
        (pauseEffect?.kind !== 'pre_item_pause' && pauseEffect?.kind !== 'post_item_pause') ||
        effect.opportunityId !== pauseEffect.opportunityId ||
        effect.opportunityClosed !== pauseEffect.opportunityClosed
      ) {
        throw new MeasurementAuthorityError('INVALID_STATE', 'reanudación adulteró el cierre de oportunidad');
      }
      disposition = 'active';
      activePauseEffectId = null;
      continue;
    }
    if (effect.kind === 'session_time_expired') {
      disposition = 'active';
      activePauseEffectId = null;
    } else if (effect.kind === 'withdrawal') {
      disposition = 'withdrawn';
      activePauseEffectId = null;
    } else if (effect.kind === 'incident' && effect.scope === 'systemic') {
      disposition = 'suspended';
      activePauseEffectId = null;
    } else if (disposition !== 'active') {
      throw new MeasurementAuthorityError('INVALID_STATE', 'acto de control ejecutado durante una pausa');
    }

    if (effect.kind === 'content_question') {
      if (
        selection === null ||
        effect.deadlineBeforeQuestion !== selectionDeadline(selection) ||
        Date.parse(effect.occurredAt) > Date.parse(effect.deadlineBeforeQuestion)
      ) {
        throw new MeasurementAuthorityError('INVALID_STATE', 'duda o reloj adulterado');
      }
    }
    if (
      effect.kind === 'session_time_expired' &&
      Date.parse(effect.occurredAt) < Date.parse(effect.sessionDeadlineAt)
    ) {
      throw new MeasurementAuthorityError('INVALID_STATE', 'fin de sesión anterior al límite declarado');
    }
    if (
      effect.kind === 'probe_timeout' &&
      (selection === null ||
        linkedOutcome?.reasonCode !== 'timeout' ||
        effect.rubricContract !== selection.delivery.verifierContract ||
        effect.deadlineAt !== selectionDeadline(selection) ||
        effect.opportunityClosed !== (selection.delivery.itemOrdinal === opportunity.batchSize) ||
        Date.parse(effect.occurredAt) < Date.parse(effect.deadlineAt))
    ) {
      throw new MeasurementAuthorityError('INVALID_STATE', 'timeout no deriva del reloj y rúbrica congelados');
    }
    if (
      (effect.kind === 'session_time_expired' || effect.kind === 'withdrawal') &&
      selection !== null &&
      (linkedOutcome?.reasonCode !== effect.reasonCode || linkedOutcome.observedAt !== effect.occurredAt)
    ) {
      throw new MeasurementAuthorityError('INVALID_STATE', 'cierre de sesión sin resultado derivado');
    }
    if (effect.kind === 'incident') {
      const taxonomy = policy.definition.incidentTaxonomy.find(
        (entry) => entry.incidentCode === effect.incident.incidentCode,
      );
      const invalidating = effect.incident.level >= 2;
      if (
        taxonomy?.level !== effect.incident.level ||
        effect.incident.action !== INCIDENT_ACTION_BY_LEVEL[effect.incident.level] ||
        effect.incident.detectedAt !== effect.occurredAt ||
        (invalidating &&
          !effect.incident.invalidatedOpportunityIds.includes(opportunity.request.opportunityId)) ||
        (invalidating && selection !== null &&
          !effect.incident.affectedEventIds.includes(selection.delivery.probeInstanceId)) ||
        (effect.incident.level === 2 && selection === null) ||
        (!invalidating &&
          (selection !== null || effect.incident.invalidatedOpportunityIds.length > 0)) ||
        (effect.reasonCode === 'incident' && selection !== null && linkedOutcome?.reasonCode !== 'incident')
      ) {
        throw new MeasurementAuthorityError('INVALID_STATE', 'incidente restaurado no coincide con taxonomía');
      }
    }
  }
  if (state.runDisposition !== disposition || state.activePauseEffectId !== activePauseEffectId) {
    throw new MeasurementAuthorityError('INVALID_STATE', 'disposición de corrida adulterada');
  }
  for (const opportunity of state.opportunities) {
    for (const outcome of opportunity.outcomes) {
      if (
        outcome.reasonCode !== null &&
        !state.controlEffects.some(
          (effect) =>
            effect.opportunityId === opportunity.request.opportunityId &&
            effect.probeInstanceId === outcome.probeInstanceId &&
            effect.reasonCode === outcome.reasonCode,
        )
      ) {
        throw new MeasurementAuthorityError('INVALID_STATE', 'resultado no válido sin acto de control');
      }
    }
  }
}

export class DeterministicMeasurementAuthority {
  readonly policy: CompiledMeasurementPolicy;
  readonly inventory: CompiledMeasurementInventory;
  readonly seed: CompiledMeasurementSeed;
  readonly registry: MeasurementRunRegistry;

  constructor(
    policyValue: unknown,
    inventoryValue: unknown,
    seedValue: unknown,
    options: Readonly<{
      expectedPolicyHash?: string;
      expectedInventoryHash?: string;
      expectedSeedHash?: string;
      registry?: MeasurementRunRegistry;
    }> = {},
  ) {
    this.policy = compileMeasurementPolicy(policyValue, options.expectedPolicyHash);
    this.inventory = compileMeasurementInventory(inventoryValue, options.expectedInventoryHash);
    this.seed = compileMeasurementSeed(seedValue, options.expectedSeedHash);
    if (
      (this.policy.definition.purpose === 'material' ||
        this.inventory.definition.purpose === 'material' ||
        this.seed.definition.purpose === 'material') &&
      (options.expectedPolicyHash === undefined ||
        options.expectedInventoryHash === undefined ||
        options.expectedSeedHash === undefined)
    ) {
      throw new MeasurementAuthorityError(
        'MATERIAL_FREEZE_REQUIRED',
        'una corrida material exige hashes externos de política, inventario y semilla',
      );
    }
    if (
      this.policy.definition.purpose !== this.inventory.definition.purpose ||
      this.policy.definition.purpose !== this.seed.definition.purpose
    ) {
      throw new MeasurementAuthorityError('INVALID_ARTIFACT', 'los tres artefactos deben tener el mismo propósito');
    }
    this.registry = options.registry ?? new MeasurementRunRegistry();
  }

  bindRun(value: unknown): MeasurementRunBinding {
    return this.registry.bind(this.policy, this.inventory, this.seed, value);
  }

  applyEvent(stateValue: MeasurementRunState | null, eventValue: unknown): MeasurementMutation {
    const event = parseEvent(eventValue);
    if (event.eventType === 'measurement.initialized') {
      if (stateValue !== null) {
        throw new MeasurementAuthorityError('INVALID_EVENT_SEQUENCE', 'inicialización duplicada');
      }
      this.registry.assertBound(event.payload.runId, this.policy, this.inventory, this.seed);
      const state = parseState({
        schemaVersion: MEASUREMENT_STATE_SCHEMA_VERSION,
        revision: 0,
        runId: event.payload.runId,
        participantPseudoId: event.payload.participantPseudoId,
        policyVersion: this.policy.definition.policyVersion,
        policyHash: this.policy.policyHash,
        inventoryVersion: this.inventory.definition.inventoryVersion,
        inventoryHash: this.inventory.inventoryHash,
        seedVersion: this.seed.definition.seedVersion,
        seedHash: this.seed.seedHash,
        packageVersion: this.inventory.definition.packageVersion,
        runDisposition: 'active',
        activePauseEffectId: null,
        activeOpportunityId: null,
        opportunities: [],
        controlEffects: [],
        priorConsumptions: event.payload.priorConsumptions,
        excludedMeasurementItemIds: this.inventory.definition.items
          .filter((item) =>
            event.payload.priorConsumptions.some(
              (consumption) =>
                consumption.itemId === item.itemId &&
                consumptionBlocksMeasurement(consumption.sourceReserve, item.reserve),
            ),
          )
          .map((item) => item.itemId),
        consumedItemIds: [],
        processedEventIds: [event.eventId],
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
      });
      return deepFreeze({ state: deepFreeze(state), delivery: null, result: null, controlEffect: null });
    }
    if (stateValue === null) {
      throw new MeasurementAuthorityError('INVALID_EVENT_SEQUENCE', 'falta inicialización');
    }
    const state = parseState(stateValue);
    this.registry.assertBound(state.runId, this.policy, this.inventory, this.seed);
    if (
      state.policyVersion !== this.policy.definition.policyVersion ||
      state.policyHash !== this.policy.policyHash ||
      state.inventoryVersion !== this.inventory.definition.inventoryVersion ||
      state.inventoryHash !== this.inventory.inventoryHash ||
      state.seedVersion !== this.seed.definition.seedVersion ||
      state.seedHash !== this.seed.seedHash ||
      canonicalJson(state.packageVersion) !== canonicalJson(this.inventory.definition.packageVersion)
    ) {
      throw new MeasurementAuthorityError('RUN_POLICY_DRIFT', 'estado ligado a otros artefactos');
    }
    assertStateMatchesArtifacts(state, this.policy, this.inventory, this.seed);
    assertHeader(state, event);

    if (state.runDisposition === 'suspended' || state.runDisposition === 'withdrawn') {
      throw new MeasurementAuthorityError(
        'MEASUREMENT_CONTROL_BLOCKED',
        `corrida ${state.runDisposition}: no admite actos posteriores`,
      );
    }
    if (
      state.runDisposition === 'paused' &&
      event.eventType !== 'measurement.pause.resumed' &&
      event.eventType !== 'measurement.session_time.expired' &&
      event.eventType !== 'measurement.withdrawal.recorded' &&
      event.eventType !== 'measurement.incident.recorded'
    ) {
      throw new MeasurementAuthorityError('MEASUREMENT_CONTROL_BLOCKED', 'la medición está pausada');
    }

    if (event.eventType === 'measurement.opportunity.opened') {
      return this.#openOpportunity(state, event);
    }
    if (event.eventType === 'measurement.delivery.requested') {
      return this.#deliver(state, event);
    }
    if (event.eventType === 'measurement.item.outcome_observed') {
      return this.#recordOutcome(state, event);
    }
    return this.#recordControl(state, event);
  }

  #openOpportunity(
    state: MeasurementRunState,
    event: z.infer<typeof OpportunityOpenedEvent>,
  ): MeasurementMutation {
    if (state.activeOpportunityId !== null) {
      throw new MeasurementAuthorityError('ACTIVE_OPPORTUNITY_EXISTS', 'ya existe una oportunidad abierta');
    }
    if (state.opportunities.some((candidate) => candidate.request.opportunityId === event.payload.opportunityId)) {
      throw new MeasurementAuthorityError('INVALID_EVENT_SEQUENCE', 'opportunityId reutilizado');
    }
    if (
      event.payload.runId !== state.runId ||
      event.payload.participantPseudoId !== state.participantPseudoId
    ) {
      throw new MeasurementAuthorityError('INVALID_EVENT', 'corrida o seudónimo no coincide');
    }
    const plan = planForRequest(this.inventory, event.payload);
    const opportunity = MeasurementOpportunityState.parse({
      request: event.payload,
      planId: plan.planId,
      reserve: plan.reserve,
      batchSize: plan.batchSize,
      minValidItems: plan.minValidItems,
      status: 'open',
      selections: [],
      outcomes: [],
      result: null,
      openedAt: event.occurredAt,
      closedAt: null,
    });
    const next = parseState({
      ...state,
      revision: event.sequenceNumber,
      activeOpportunityId: event.payload.opportunityId,
      opportunities: [...state.opportunities, opportunity],
      processedEventIds: [...state.processedEventIds, event.eventId],
      updatedAt: event.occurredAt,
    });
    return deepFreeze({ state: deepFreeze(next), delivery: null, result: null, controlEffect: null });
  }

  #activeOpportunity(state: MeasurementRunState, opportunityId: string): MeasurementOpportunityState {
    const opportunity = state.opportunities.find(
      (candidate) => candidate.request.opportunityId === opportunityId,
    );
    if (opportunity === undefined || state.activeOpportunityId !== opportunityId) {
      throw new MeasurementAuthorityError('OPPORTUNITY_NOT_ACTIVE', `oportunidad no activa: ${opportunityId}`);
    }
    if (opportunity.status === 'closed') {
      throw new MeasurementAuthorityError('OPPORTUNITY_CLOSED', `oportunidad cerrada: ${opportunityId}`);
    }
    return opportunity;
  }

  #deliver(
    state: MeasurementRunState,
    event: z.infer<typeof DeliveryRequestedEvent>,
  ): MeasurementMutation {
    const opportunity = this.#activeOpportunity(state, event.payload.opportunityId);
    if (opportunity.selections.length !== opportunity.outcomes.length) {
      throw new MeasurementAuthorityError(
        'ITEM_OUTCOME_ORDER_VIOLATION',
        'debe registrarse el resultado antes de pedir otro ítem',
      );
    }
    const selected = eligibleItems(this.inventory, this.seed, state, opportunity)[0];
    if (selected === undefined) {
      const result = opportunityResult(opportunity, this.policy, 'reserve_exhausted');
      const closed = MeasurementOpportunityState.parse({
        ...opportunity,
        status: 'closed',
        result,
        closedAt: event.occurredAt,
      });
      const next = parseState({
        ...state,
        revision: event.sequenceNumber,
        activeOpportunityId: null,
        opportunities: replaceOpportunity(state, closed),
        processedEventIds: [...state.processedEventIds, event.eventId],
        updatedAt: event.occurredAt,
      });
      return deepFreeze({
        state: deepFreeze(next),
        delivery: null,
        result: deepFreeze(result),
        controlEffect: null,
      });
    }
    const itemOrdinal = opportunity.selections.length + 1;
    const delivery = ProbeDelivery.parse({
      probeInstanceId: event.eventId,
      opportunityId: opportunity.request.opportunityId,
      itemOrdinal,
      batchSize: opportunity.batchSize,
      prompt: selected.item.prompt,
      timeLimitSeconds: selected.item.timeLimitSeconds,
      verifierContract: selected.item.verifierContract,
    });
    const selection = MeasurementSelectionRecord.parse({
      selectionId: event.eventId,
      itemId: selected.item.itemId,
      reserve: selected.item.reserve,
      selectionRank: selected.rank,
      delivery,
      selectedAt: event.occurredAt,
      consumedAt: event.occurredAt,
    });
    const updatedOpportunity = MeasurementOpportunityState.parse({
      ...opportunity,
      selections: [...opportunity.selections, selection],
    });
    const next = parseState({
      ...state,
      revision: event.sequenceNumber,
      opportunities: replaceOpportunity(state, updatedOpportunity),
      consumedItemIds: [...state.consumedItemIds, selected.item.itemId],
      processedEventIds: [...state.processedEventIds, event.eventId],
      updatedAt: event.occurredAt,
    });
    return deepFreeze({
      state: deepFreeze(next),
      delivery: deepFreeze(delivery),
      result: null,
      controlEffect: null,
    });
  }

  #recordOutcome(
    state: MeasurementRunState,
    event: z.infer<typeof ItemOutcomeObservedEvent>,
  ): MeasurementMutation {
    const opportunity = this.#activeOpportunity(state, event.payload.opportunityId);
    const selection = opportunity.selections.find(
      (candidate) => candidate.delivery.probeInstanceId === event.payload.probeInstanceId,
    );
    if (
      selection === undefined ||
      opportunity.outcomes.some((candidate) => candidate.probeInstanceId === event.payload.probeInstanceId) ||
      opportunity.selections.at(-1)?.delivery.probeInstanceId !== event.payload.probeInstanceId
    ) {
      throw new MeasurementAuthorityError('ITEM_OUTCOME_ORDER_VIOLATION', 'resultado no corresponde al ítem activo');
    }
    const outcome = MeasurementItemOutcomeRecord.parse({
      probeInstanceId: event.payload.probeInstanceId,
      itemOrdinal: selection.delivery.itemOrdinal,
      operationalValidity: 'valid',
      correct: event.payload.outcome.correct,
      reasonCode: null,
      observedAt: event.occurredAt,
    });
    const outcomes = [...opportunity.outcomes, outcome];
    const terminal = outcomes.length === opportunity.batchSize;
    const withOutcome = MeasurementOpportunityState.parse({
      ...opportunity,
      outcomes,
    });
    const result = terminal ? opportunityResult(withOutcome, this.policy) : null;
    const updatedOpportunity = MeasurementOpportunityState.parse({
      ...withOutcome,
      status: terminal ? 'closed' : 'open',
      result,
      closedAt: terminal ? event.occurredAt : null,
    });
    const next = parseState({
      ...state,
      revision: event.sequenceNumber,
      activeOpportunityId: terminal ? null : state.activeOpportunityId,
      opportunities: replaceOpportunity(state, updatedOpportunity),
      processedEventIds: [...state.processedEventIds, event.eventId],
      updatedAt: event.occurredAt,
    });
    return deepFreeze({
      state: deepFreeze(next),
      delivery: null,
      result: result === null ? null : deepFreeze(result),
      controlEffect: null,
    });
  }

  #controlMutation(
    state: MeasurementRunState,
    event: MeasurementControlEvent,
    opportunity: MeasurementOpportunityState | null,
    effect: MeasurementControlEffectValue,
    result: ProbeOpportunityResultValue | null,
  ): MeasurementMutation {
    const activePauseEffectId = effect.kind === 'pre_item_pause' || effect.kind === 'post_item_pause'
      ? effect.effectId
      : effect.kind === 'pause_resumed' || effect.kind === 'session_time_expired' ||
          effect.kind === 'withdrawal' ||
          (effect.kind === 'incident' && effect.scope === 'systemic')
        ? null
        : state.activePauseEffectId;
    const next = parseState({
      ...state,
      revision: event.sequenceNumber,
      runDisposition: effect.runDisposition,
      activePauseEffectId,
      activeOpportunityId: opportunity?.status === 'closed' ? null : state.activeOpportunityId,
      opportunities: opportunity === null ? state.opportunities : replaceOpportunity(state, opportunity),
      controlEffects: [...state.controlEffects, effect],
      processedEventIds: [...state.processedEventIds, event.eventId],
      updatedAt: event.occurredAt,
    });
    return deepFreeze({
      state: deepFreeze(next),
      delivery: null,
      result: result === null ? null : deepFreeze(result),
      controlEffect: deepFreeze(effect),
    });
  }

  #recordControl(state: MeasurementRunState, event: MeasurementControlEvent): MeasurementMutation {
    if (event.eventType === 'measurement.pause.resumed') {
      if (
        state.runDisposition !== 'paused' ||
        state.activePauseEffectId === null ||
        event.payload.pauseEffectId !== state.activePauseEffectId
      ) {
        throw new MeasurementAuthorityError('MEASUREMENT_CONTROL_BLOCKED', 'la reanudación no corresponde a la pausa activa');
      }
      const pause = state.controlEffects.find((effect) => effect.effectId === state.activePauseEffectId);
      if (pause?.kind !== 'pre_item_pause' && pause?.kind !== 'post_item_pause') {
        throw new MeasurementAuthorityError('INVALID_STATE', 'pausa activa sin efecto de origen');
      }
      const opportunity = state.opportunities.find(
        (candidate) => candidate.request.opportunityId === pause.opportunityId,
      );
      if (opportunity === undefined) {
        throw new MeasurementAuthorityError('INVALID_STATE', 'pausa sin oportunidad');
      }
      const effect = MeasurementControlEffect.parse({
        effectId: event.eventId,
        kind: 'pause_resumed',
        pauseEffectId: pause.effectId,
        runId: state.runId,
        participantPseudoId: state.participantPseudoId,
        opportunityId: pause.opportunityId,
        probeInstanceId: null,
        occurredAt: event.occurredAt,
        itemConsumedByEffect: false,
        immediateFeedbackProvided: false,
        pedagogicalResponseProvided: false,
        clockExtended: false,
        reasonCode: null,
        opportunityClosed: opportunity.status === 'closed',
        runDisposition: 'active',
        replacementDisposition: 'not_applicable',
      });
      return this.#controlMutation(state, event, null, effect, null);
    }

    const opportunity = this.#activeOpportunity(state, event.payload.opportunityId);
    const selection = activeSelection(opportunity);

    if (event.eventType === 'measurement.pause.requested') {
      const applied = selection === null
        ? { opportunity, result: null }
        : withReasonOutcome(
            opportunity,
            selection,
            'invalid_participant_pause',
            event.occurredAt,
            this.policy,
            false,
          );
      const effect = MeasurementControlEffect.parse({
        effectId: event.eventId,
        kind: selection === null ? 'pre_item_pause' : 'post_item_pause',
        runId: state.runId,
        participantPseudoId: state.participantPseudoId,
        opportunityId: event.payload.opportunityId,
        probeInstanceId: selection?.delivery.probeInstanceId ?? null,
        occurredAt: event.occurredAt,
        itemConsumedByEffect: false,
        immediateFeedbackProvided: false,
        pedagogicalResponseProvided: false,
        clockExtended: false,
        reasonCode: selection === null ? null : 'invalid_participant_pause',
        opportunityClosed: applied.opportunity.status === 'closed',
        runDisposition: 'paused',
        replacementDisposition: selection === null
          ? 'not_applicable'
          : 'calendar_independent_only',
      });
      return this.#controlMutation(state, event, applied.opportunity, effect, applied.result);
    }

    if (event.eventType === 'measurement.content_question.recorded') {
      if (selection?.delivery.probeInstanceId !== event.payload.probeInstanceId) {
        throw new MeasurementAuthorityError('ITEM_OUTCOME_ORDER_VIOLATION', 'duda no corresponde al ítem mostrado');
      }
      const deadline = selectionDeadline(selection);
      if (Date.parse(event.occurredAt) > Date.parse(deadline)) {
        throw new MeasurementAuthorityError('MEASUREMENT_CONTROL_BLOCKED', 'la duda llegó después del vencimiento');
      }
      const effect = MeasurementControlEffect.parse({
        effectId: event.eventId,
        kind: 'content_question',
        runId: state.runId,
        participantPseudoId: state.participantPseudoId,
        opportunityId: event.payload.opportunityId,
        probeInstanceId: event.payload.probeInstanceId,
        occurredAt: event.occurredAt,
        itemConsumedByEffect: false,
        responseKind: event.payload.responseKind,
        deadlineBeforeQuestion: deadline,
        deadlineAfterQuestion: deadline,
        immediateFeedbackProvided: false,
        pedagogicalResponseProvided: false,
        clockExtended: false,
        reasonCode: null,
        opportunityClosed: false,
        runDisposition: 'active',
        replacementDisposition: 'not_applicable',
      });
      return this.#controlMutation(state, event, opportunity, effect, null);
    }

    if (event.eventType === 'measurement.probe.timeout') {
      if (selection?.delivery.probeInstanceId !== event.payload.probeInstanceId) {
        throw new MeasurementAuthorityError('ITEM_OUTCOME_ORDER_VIOLATION', 'timeout no corresponde al ítem mostrado');
      }
      const deadline = selectionDeadline(selection);
      if (Date.parse(event.occurredAt) < Date.parse(deadline)) {
        throw new MeasurementAuthorityError('TIMER_NOT_EXPIRED', 'el reloj congelado todavía no vence');
      }
      const applied = withReasonOutcome(opportunity, selection, 'timeout', event.occurredAt, this.policy, false);
      const effect = MeasurementControlEffect.parse({
        effectId: event.eventId,
        kind: 'probe_timeout',
        runId: state.runId,
        participantPseudoId: state.participantPseudoId,
        opportunityId: event.payload.opportunityId,
        probeInstanceId: event.payload.probeInstanceId,
        occurredAt: event.occurredAt,
        itemConsumedByEffect: false,
        rubricContract: selection.delivery.verifierContract,
        deadlineAt: deadline,
        immediateFeedbackProvided: false,
        pedagogicalResponseProvided: false,
        clockExtended: false,
        reasonCode: 'timeout',
        opportunityClosed: applied.opportunity.status === 'closed',
        runDisposition: 'active',
        replacementDisposition: 'calendar_independent_only',
      });
      return this.#controlMutation(state, event, applied.opportunity, effect, applied.result);
    }

    if (event.eventType === 'measurement.session_time.expired') {
      if (Date.parse(event.occurredAt) < Date.parse(event.payload.sessionDeadlineAt)) {
        throw new MeasurementAuthorityError('TIMER_NOT_EXPIRED', 'el tiempo máximo de sesión todavía no vence');
      }
      const applied = withReasonOutcome(
        opportunity,
        selection,
        'missing_session_time',
        event.occurredAt,
        this.policy,
        true,
      );
      const effect = MeasurementControlEffect.parse({
        effectId: event.eventId,
        kind: 'session_time_expired',
        runId: state.runId,
        participantPseudoId: state.participantPseudoId,
        opportunityId: event.payload.opportunityId,
        probeInstanceId: selection?.delivery.probeInstanceId ?? null,
        sessionDeadlineAt: event.payload.sessionDeadlineAt,
        occurredAt: event.occurredAt,
        itemConsumedByEffect: false,
        immediateFeedbackProvided: false,
        pedagogicalResponseProvided: false,
        clockExtended: false,
        reasonCode: 'missing_session_time',
        opportunityClosed: true,
        runDisposition: 'active',
        replacementDisposition: 'calendar_independent_only',
      });
      return this.#controlMutation(state, event, applied.opportunity, effect, applied.result);
    }

    if (event.eventType === 'measurement.withdrawal.recorded') {
      const applied = withReasonOutcome(
        opportunity,
        selection,
        'withdrawal',
        event.occurredAt,
        this.policy,
        true,
      );
      const effect = MeasurementControlEffect.parse({
        effectId: event.eventId,
        kind: 'withdrawal',
        runId: state.runId,
        participantPseudoId: state.participantPseudoId,
        opportunityId: event.payload.opportunityId,
        probeInstanceId: selection?.delivery.probeInstanceId ?? null,
        consentDecisionRef: event.payload.consentDecisionRef,
        occurredAt: event.occurredAt,
        itemConsumedByEffect: false,
        immediateFeedbackProvided: false,
        pedagogicalResponseProvided: false,
        clockExtended: false,
        reasonCode: 'withdrawal',
        opportunityClosed: true,
        runDisposition: 'withdrawn',
        replacementDisposition: 'prohibited',
      });
      return this.#controlMutation(state, event, applied.opportunity, effect, applied.result);
    }

    const incident = event.payload.incident;
    const taxonomy = this.policy.definition.incidentTaxonomy.find(
      (entry) => entry.incidentCode === incident.incidentCode,
    );
    if (taxonomy?.level !== incident.level || incident.action !== INCIDENT_ACTION_BY_LEVEL[incident.level]) {
      throw new MeasurementAuthorityError(
        'INCIDENT_TAXONOMY_MISMATCH',
        'incidente no coincide con código, nivel y acción congelados',
      );
    }
    if (incident.detectedAt !== event.occurredAt) {
      throw new MeasurementAuthorityError('INVALID_EVENT', 'detectedAt del incidente no coincide con el evento');
    }
    const invalidating = incident.level >= 2;
    const systemic = incident.level === 3;
    if (state.runDisposition === 'paused' && !systemic) {
      throw new MeasurementAuthorityError(
        'MEASUREMENT_CONTROL_BLOCKED',
        'durante una pausa sólo un incidente sistémico puede cambiar la corrida',
      );
    }
    if (
      invalidating &&
      (!incident.invalidatedOpportunityIds.includes(opportunity.request.opportunityId) ||
        (selection !== null && !incident.affectedEventIds.includes(selection.delivery.probeInstanceId)))
    ) {
      throw new MeasurementAuthorityError('INVALID_EVENT', 'incidente invalidante no enlaza el acto afectado');
    }
    if (!invalidating && incident.invalidatedOpportunityIds.length > 0) {
      throw new MeasurementAuthorityError('INVALID_EVENT', 'incidente menor no puede invalidar una oportunidad');
    }
    if (incident.level === 2 && selection === null) {
      throw new MeasurementAuthorityError('INVALID_EVENT', 'incidente localizado exige un ítem activo');
    }
    const applied = invalidating
      ? withReasonOutcome(opportunity, selection, 'incident', event.occurredAt, this.policy, systemic)
      : { opportunity, result: null };
    const effect = MeasurementControlEffect.parse({
      effectId: event.eventId,
      kind: 'incident',
      runId: state.runId,
      participantPseudoId: state.participantPseudoId,
      opportunityId: event.payload.opportunityId,
      probeInstanceId: invalidating ? selection?.delivery.probeInstanceId ?? null : null,
      occurredAt: event.occurredAt,
      itemConsumedByEffect: false,
      incident,
      scope: systemic ? 'systemic' : 'localized',
      immediateFeedbackProvided: false,
      pedagogicalResponseProvided: false,
      clockExtended: false,
      reasonCode: invalidating ? 'incident' : null,
      opportunityClosed: systemic,
      runDisposition: systemic ? 'suspended' : 'active',
      replacementDisposition: incident.level === 2
        ? 'calendar_independent_only'
        : 'not_applicable',
    });
    return this.#controlMutation(state, event, applied.opportunity, effect, applied.result);
  }

  replay(values: readonly unknown[]): MeasurementRunState {
    if (values.length === 0) throw new MeasurementAuthorityError('INVALID_EVENT_SEQUENCE', 'historia vacía');
    let state: MeasurementRunState | null = null;
    for (const value of values) state = this.applyEvent(state, value).state;
    if (state === null) throw new MeasurementAuthorityError('INVALID_EVENT_SEQUENCE', 'historia sin estado');
    return state;
  }
}

/**
 * La persistencia llama esta función dentro de una transacción. El `UPDATE`
 * compare-and-set y el `INSERT` del consumo ocurren antes de devolver el ítem.
 */
export const ATOMIC_PROBE_CONSUMPTION_SQL = `
WITH claimed AS (
  UPDATE measurement.probe_reserve_item
     SET consumed = true
   WHERE item_id = $3
     AND reserve = $4
     AND experimental_set = $5
     AND consumed = false
   RETURNING item_id
)
INSERT INTO measurement.probe_consumption (
  consumption_id, opportunity_id, item_id, item_ordinal
)
SELECT $1, $2, item_id, $6
  FROM claimed
RETURNING item_id
`.trim();

export function priorConsumptionBlocks(
  sourceReserveValue: unknown,
  targetReserveValue: unknown,
): boolean {
  const source = Reserve.parse(sourceReserveValue);
  const target = MeasurementReserve.parse(targetReserveValue);
  return consumptionBlocksMeasurement(source, target);
}

export function requestedReserve(
  measureKindValue: MeasureKindValue,
  phaseValue: ProbeRequestValue['phase'],
): MeasurementReserveValue {
  const reserve = probeReserveFor(measureKindValue, phaseValue);
  if (reserve === null) throw new MeasurementAuthorityError('PLAN_NOT_FROZEN', 'combinación sin reserva');
  return reserve;
}
