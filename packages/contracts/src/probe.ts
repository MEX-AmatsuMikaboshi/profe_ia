import { z } from 'zod';
import { Id } from './primitives.js';

/**
 * Contrato del servicio de medición aislado — **transcripción literal de
 * P-II §6.3** (DEC-MEAS-AUTHORITY-001).
 *
 * No se devuelve solución ni metadatos que permitan inferirla.
 * `participantPseudoId` es el identificador de trabajo: `measurement-worker`
 * no recibe identidad real. `transfer_measurement` solo selecciona de la
 * reserva `TRANSFER_MEASUREMENT`; nunca reutiliza `TRANSFER_MASTERY` (P-I §5.11).
 */

/** `null` para transferencia/retención fuera de la serie SCED (P-II §6.3). */
const ProbeRoundId = Id.nullable();

export const ScedPhase = z.enum(['baseline', 'intervention', 'retention']);
export type ScedPhase = z.infer<typeof ScedPhase>;

export const MeasureKind = z.enum(['primary_probe', 'transfer_measurement', 'retention_probe']);
export type MeasureKind = z.infer<typeof MeasureKind>;

export const ProbeRequest = z.object({
  runId: Id,
  participantPseudoId: Id,
  probeRoundId: ProbeRoundId,
  opportunityId: Id,
  /** Conjunto experimental: identificador libre; los conjuntos se congelan en H5. */
  experimentalSet: z.string().min(1),
  phase: ScedPhase,
  measureKind: MeasureKind,
});
export type ProbeRequest = z.infer<typeof ProbeRequest>;

/**
 * Enunciado estructurado del reactivo. El Maestro lo referencia como
 * `StructuredItemPrompt` sin definirlo literalmente; se implementa como
 * estructura mínima sin solución ni metadatos que permitan inferirla
 * (decisión de ingeniería D-4).
 */
export const StructuredItemPrompt = z.object({
  itemId: Id,
  statement: z.string().min(1),
  premises: z.array(z.string()).default([]),
  goal: z.string().min(1),
  responseFormat: z.enum(['fitch_proof', 'structured_choice', 'free_text']),
});
export type StructuredItemPrompt = z.infer<typeof StructuredItemPrompt>;

/** Entrega de **un** ítem a la vez de la microbatería (Plan.md T-H6-06). */
export const ProbeDelivery = z.object({
  probeInstanceId: Id,
  opportunityId: Id,
  itemOrdinal: z.number().int().positive(),
  batchSize: z.number().int().positive(),
  prompt: StructuredItemPrompt,
  timeLimitSeconds: z.number().nonnegative(),
  verifierContract: z.string().min(1),
});
export type ProbeDelivery = z.infer<typeof ProbeDelivery>;

/** Validez **operacional** de la oportunidad (distinta de la validez de evento). */
export const OperationalValidity = z.enum(['valid', 'invalid', 'missing']);
export type OperationalValidity = z.infer<typeof OperationalValidity>;

export const ProbeOpportunityResult = z.object({
  opportunityId: Id,
  probeRoundId: ProbeRoundId,
  plannedItems: z.number().int().nonnegative(),
  validScoredItems: z.number().int().nonnegative(),
  correctValidItems: z.number().int().nonnegative(),
  /** `null` cuando no hay observación válida; los faltantes no se imputan. */
  observation: z.number().nullable(),
  operationalValidity: OperationalValidity,
  reasonCode: z.string().nullable(),
});
export type ProbeOpportunityResult = z.infer<typeof ProbeOpportunityResult>;

/**
 * Códigos de razón enunciados por el plan (T-H6-07/08) y por P-I §13.2
 * (`reserve_exhausted`). El catálogo se congela por corrida en el freeze de
 * preinscripción (T-FRZ-01): un código nuevo se añade ahí, no en código ad hoc.
 */
export const KNOWN_PROBE_REASON_CODES = [
  'invalid_participant_pause',
  'missing_session_time',
  'withdrawal',
  'schedule_invalid',
  'timeout',
  'incident',
  'reserve_exhausted',
] as const;

/** Dos usos operativamente distintos de transferencia (P-I §5.11). */
export const TransferBank = z.enum(['TRANSFER_MASTERY', 'TRANSFER_MEASUREMENT']);
export type TransferBank = z.infer<typeof TransferBank>;
