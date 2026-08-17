import { createHash } from 'node:crypto';
import {
  Id,
  IsoDateTime,
  KNOWN_PROBE_REASON_CODES,
  MeasureKind,
  MeasurementReserve,
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
  type MeasurementReserve as MeasurementReserveValue,
  type OperationalValidity as OperationalValidityValue,
  type ProbeDelivery as ProbeDeliveryValue,
  type ProbeOpportunityResult as ProbeOpportunityResultValue,
  type ProbeRequest as ProbeRequestValue,
} from '@profesor-ia/contracts';
import { SCED_OPPORTUNITY_H5_V1 } from '@profesor-ia/experiment';
import { z } from 'zod';

/** T-H6-06 — autoridad de oportunidad; recibe solicitudes del calendario T-H6-07. */
export const MEASUREMENT_POLICY_SCHEMA_VERSION = 'measurement-authority-policy-v1' as const;
export const MEASUREMENT_INVENTORY_SCHEMA_VERSION = 'measurement-inventory-v1' as const;
export const MEASUREMENT_SEED_SCHEMA_VERSION = 'measurement-seed-v1' as const;
export const MEASUREMENT_STATE_SCHEMA_VERSION = 'measurement-state-v1' as const;

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
  | 'INVALID_ARTIFACT'
  | 'INVALID_EVENT'
  | 'INVALID_EVENT_SEQUENCE'
  | 'INVALID_STATE'
  | 'ITEM_OUTCOME_ORDER_VIOLATION'
  | 'MATERIAL_FREEZE_REQUIRED'
  | 'OPPORTUNITY_CLOSED'
  | 'OPPORTUNITY_NOT_ACTIVE'
  | 'PLAN_NOT_FROZEN'
  | 'RUN_NOT_BOUND'
  | 'RUN_POLICY_DRIFT';

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
  });
export type MeasurementAuthorityPolicyDefinition = z.infer<typeof MeasurementAuthorityPolicyDefinition>;

export function createMeasurementAuthorityPolicyDefinition(
  input: Readonly<{
    policyVersion: string;
    purpose: z.infer<typeof Purpose>;
    reasonPolicy: readonly z.input<typeof ReasonPolicyEntry>[];
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
    primaryCalibration: {
      version: SCED_OPPORTUNITY_H5_V1.version,
      kSet: SCED_OPPORTUNITY_H5_V1.kSet,
      minValidItemsPerOpportunity: SCED_OPPORTUNITY_H5_V1.minValidItemsPerOpportunity,
    },
    reasonPolicy: [...input.reasonPolicy],
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
const ItemOutcome = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('scored'), correct: z.boolean() }).strict(),
  z.object({ kind: z.literal('operational_reason'), reasonCode: ProbeReasonCode }).strict(),
]);
const ItemOutcomeObservedEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('measurement.item.outcome_observed'),
    sequenceNumber: z.number().int().positive(),
    occurredAt: IsoDateTime,
    payload: z.object({ opportunityId: Id, probeInstanceId: Id, outcome: ItemOutcome }).strict(),
  })
  .strict();

export const MeasurementEvent = z.discriminatedUnion('eventType', [
  MeasurementInitializedEvent,
  OpportunityOpenedEvent,
  DeliveryRequestedEvent,
  ItemOutcomeObservedEvent,
]);
export type MeasurementEvent = z.infer<typeof MeasurementEvent>;

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
    activeOpportunityId: Id.nullable(),
    opportunities: z.array(MeasurementOpportunityState),
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
      const fallback = opportunity.selections.length < opportunity.batchSize
        ? 'reserve_exhausted'
        : undefined;
      if (canonicalJson(opportunity.result) !== canonicalJson(opportunityResult(opportunity, policy, fallback))) {
        throw new MeasurementAuthorityError('INVALID_STATE', 'resultado restaurado no fue derivado por el worker');
      }
    }
  }
  if (canonicalJson(reconstructedConsumed) !== canonicalJson(state.consumedItemIds)) {
    throw new MeasurementAuthorityError('INVALID_STATE', 'consumo restaurado no coincide con selección');
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
        activeOpportunityId: null,
        opportunities: [],
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
      return deepFreeze({ state: deepFreeze(state), delivery: null, result: null });
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

    if (event.eventType === 'measurement.opportunity.opened') {
      return this.#openOpportunity(state, event);
    }
    if (event.eventType === 'measurement.delivery.requested') {
      return this.#deliver(state, event);
    }
    return this.#recordOutcome(state, event);
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
    return deepFreeze({ state: deepFreeze(next), delivery: null, result: null });
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
      return deepFreeze({ state: deepFreeze(next), delivery: null, result: deepFreeze(result) });
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
    return deepFreeze({ state: deepFreeze(next), delivery: deepFreeze(delivery), result: null });
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
    const outcome = event.payload.outcome.kind === 'scored'
      ? MeasurementItemOutcomeRecord.parse({
          probeInstanceId: event.payload.probeInstanceId,
          itemOrdinal: selection.delivery.itemOrdinal,
          operationalValidity: 'valid',
          correct: event.payload.outcome.correct,
          reasonCode: null,
          observedAt: event.occurredAt,
        })
      : MeasurementItemOutcomeRecord.parse({
          probeInstanceId: event.payload.probeInstanceId,
          itemOrdinal: selection.delivery.itemOrdinal,
          operationalValidity: reasonValidity(this.policy, event.payload.outcome.reasonCode),
          correct: null,
          reasonCode: event.payload.outcome.reasonCode,
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
    });
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
