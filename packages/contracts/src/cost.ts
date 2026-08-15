import { z } from 'zod';
import { Id, IsoDateTime } from './primitives.js';
import { ModelOperation, ModelProfile } from './model-binding.js';

/**
 * `pricing-manifest` + `cost_event` (Plan.md T-H4-06; DEC-COST-001, P-II §9.5).
 *
 * Un cambio de tarifa produce un `pricing_manifest_id` nuevo; **nunca** se
 * reescriben costos ya registrados (`ci:cost:ledger`).
 */

export const PricingUnit = z.enum([
  'input_token',
  'output_token',
  'cached_input_token',
  'audio_second',
  'image',
  'request',
]);
export type PricingUnit = z.infer<typeof PricingUnit>;

export const PricingEntry = z.object({
  provider: z.string().min(1),
  modelId: z.string().min(1),
  unit: PricingUnit,
  /** Precio por unidad en la moneda declarada; sin conversiones implícitas. */
  unitPrice: z.number().nonnegative(),
  currency: z.string().length(3),
});
export type PricingEntry = z.infer<typeof PricingEntry>;

export const PricingManifest = z.object({
  pricingManifestId: Id,
  effectiveFrom: IsoDateTime,
  /** Evidencia fechada de la tarifa publicada. */
  sourceEvidence: z.string().min(1),
  entries: z.array(PricingEntry).min(1),
});
export type PricingManifest = z.infer<typeof PricingManifest>;

export const CostEvent = z.object({
  costEventId: Id,
  occurredAt: IsoDateTime,
  /** Etapa del plan/flujo (benchmark, W0, autoría, sesión, auditoría…). */
  stage: z.string().min(1),
  operation: ModelOperation.optional(),
  profile: ModelProfile.optional(),
  provider: z.string().min(1),
  bindingId: Id.optional(),
  pricingManifestId: Id,
  tokensIn: z.number().int().nonnegative().default(0),
  tokensOut: z.number().int().nonnegative().default(0),
  tokensCached: z.number().int().nonnegative().default(0),
  audioSeconds: z.number().nonnegative().default(0),
  images: z.number().int().nonnegative().default(0),
  attempts: z.number().int().positive().default(1),
  retries: z.number().int().nonnegative().default(0),
  failures: z.number().int().nonnegative().default(0),
  latencyLocalMs: z.number().nonnegative().optional(),
  latencyProviderMs: z.number().nonnegative().optional(),
  /** Costo calculado localmente y costo reportado por el proveedor. */
  costCalculated: z.number().nonnegative(),
  costReported: z.number().nonnegative().optional(),
  currency: z.string().length(3),
  /** Solo ids seudónimos: el ledger de costos no porta datos personales. */
  pseudonymousSubjectId: Id.optional(),
});
export type CostEvent = z.infer<typeof CostEvent>;

/**
 * Gate de gasto del propietario (OWNER-BUDGET-001, UI-CORR-11, T-H4-07).
 * Superar el umbral **bloquea** nuevas operaciones facturables hasta que se
 * registre la revisión explícita; nunca autoriza degradar integridad.
 */
export const BudgetGate = z.object({
  /** Objetivo ordinario mensual declarado por el Maestro. */
  ordinaryMonthlyTargetMxn: z.literal(500),
  /** Umbral duro acumulado que exige revisión explícita del propietario. */
  hardReviewThresholdMxn: z.literal(700),
  accumulatedMxn: z.number().nonnegative(),
  blocked: z.boolean(),
  /** Evento de revisión registrado en el ledger que desbloquea. */
  ownerReviewEventId: Id.optional(),
});
export type BudgetGate = z.infer<typeof BudgetGate>;
