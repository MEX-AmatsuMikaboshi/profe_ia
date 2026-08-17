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

/** Las diez reservas literales de P-I §7.7, compartidas por autoría y medición. */
export const RESERVES = [
  'diagnostic',
  'guided_practice',
  'independent_practice',
  'recovery',
  'probes_baseline',
  'probes_intervention',
  'TRANSFER_MASTERY',
  'TRANSFER_MEASUREMENT',
  'retention',
  'replacement',
] as const;
export const Reserve = z.enum(RESERVES);
export type Reserve = z.infer<typeof Reserve>;

/** Únicas reservas de las que puede entregar `measurement-worker`. */
export const MEASUREMENT_RESERVES = [
  'TRANSFER_MEASUREMENT',
  'probes_baseline',
  'probes_intervention',
  'retention',
] as const satisfies readonly Reserve[];
export const MeasurementReserve = z.enum(MEASUREMENT_RESERVES);
export type MeasurementReserve = z.infer<typeof MeasurementReserve>;

export const ScedPhase = z.enum(['baseline', 'intervention', 'retention']);
export type ScedPhase = z.infer<typeof ScedPhase>;

export const MeasureKind = z.enum(['primary_probe', 'transfer_measurement', 'retention_probe']);
export type MeasureKind = z.infer<typeof MeasureKind>;

export const ProbeRequest = z
  .object({
    runId: Id,
    participantPseudoId: Id,
    probeRoundId: ProbeRoundId,
    opportunityId: Id,
    /** Conjunto experimental: identificador libre; los conjuntos se congelan en H5. */
    experimentalSet: z.string().trim().min(1),
    phase: ScedPhase,
    measureKind: MeasureKind,
  })
  .strict()
  .superRefine((request, context) => {
    if (request.measureKind === 'primary_probe') {
      if (request.probeRoundId === null) {
        context.addIssue({ code: 'custom', message: 'primary_probe exige probeRoundId' });
      }
      if (request.phase === 'retention') {
        context.addIssue({ code: 'custom', message: 'primary_probe no usa fase retention' });
      }
    } else if (request.probeRoundId !== null) {
      context.addIssue({
        code: 'custom',
        message: 'transferencia y retención quedan fuera de la serie probe_round',
      });
    }
    if (request.measureKind === 'retention_probe' && request.phase !== 'retention') {
      context.addIssue({ code: 'custom', message: 'retention_probe exige fase retention' });
    }
  });
export type ProbeRequest = z.infer<typeof ProbeRequest>;

/**
 * Enunciado estructurado del reactivo. El Maestro lo referencia como
 * `StructuredItemPrompt` sin definirlo literalmente; se implementa como
 * estructura mínima sin solución ni metadatos que permitan inferirla
 * (decisión de ingeniería D-4).
 */
export const StructuredItemPrompt = z
  .object({
    itemId: Id,
    statement: z.string().trim().min(1),
    premises: z.array(z.string().trim().min(1)).default([]),
    goal: z.string().trim().min(1),
    responseFormat: z.enum(['fitch_proof', 'structured_choice', 'free_text']),
  })
  .strict();
export type StructuredItemPrompt = z.infer<typeof StructuredItemPrompt>;

/** Entrega de **un** ítem a la vez de la microbatería (Plan.md T-H6-06). */
export const ProbeDelivery = z
  .object({
    probeInstanceId: Id,
    opportunityId: Id,
    itemOrdinal: z.number().int().positive(),
    batchSize: z.number().int().positive(),
    prompt: StructuredItemPrompt,
    timeLimitSeconds: z.number().int().positive(),
    verifierContract: z.string().trim().min(1),
  })
  .strict()
  .refine((delivery) => delivery.itemOrdinal <= delivery.batchSize, {
    message: 'itemOrdinal no puede superar batchSize',
    path: ['itemOrdinal'],
  });
export type ProbeDelivery = z.infer<typeof ProbeDelivery>;

/** Validez **operacional** de la oportunidad (distinta de la validez de evento). */
export const OperationalValidity = z.enum(['valid', 'invalid', 'missing']);
export type OperationalValidity = z.infer<typeof OperationalValidity>;

export const ProbeOpportunityResult = z
  .object({
    opportunityId: Id,
    probeRoundId: ProbeRoundId,
    plannedItems: z.number().int().positive(),
    validScoredItems: z.number().int().nonnegative(),
    correctValidItems: z.number().int().nonnegative(),
    /** `null` cuando no hay observación válida; los faltantes no se imputan. */
    observation: z.number().min(0).max(1).nullable(),
    operationalValidity: OperationalValidity,
    reasonCode: z.string().trim().min(1).nullable(),
  })
  .strict()
  .superRefine((result, context) => {
    if (result.validScoredItems > result.plannedItems) {
      context.addIssue({ code: 'custom', message: 'validScoredItems supera plannedItems' });
    }
    if (result.correctValidItems > result.validScoredItems) {
      context.addIssue({ code: 'custom', message: 'correctValidItems supera validScoredItems' });
    }
    if (result.operationalValidity === 'valid') {
      if (result.validScoredItems === 0 || result.observation === null || result.reasonCode !== null) {
        context.addIssue({ code: 'custom', message: 'resultado valid exige observación y no reasonCode' });
      } else {
        const expected = result.correctValidItems / result.validScoredItems;
        if (Math.abs(result.observation - expected) > Number.EPSILON) {
          context.addIssue({ code: 'custom', message: 'observation no coincide con correctas/válidas' });
        }
      }
    } else if (result.observation !== null || result.reasonCode === null) {
      context.addIssue({ code: 'custom', message: 'invalid/missing exige reasonCode y observation null' });
    }
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

/**
 * Mapeo único de solicitud a reserva. `null` significa que la combinación no
 * está autorizada; ningún consumidor debe escoger una alternativa plausible.
 */
export function probeReserveFor(
  measureKind: MeasureKind,
  phase: ScedPhase,
): MeasurementReserve | null {
  if (measureKind === 'transfer_measurement') return 'TRANSFER_MEASUREMENT';
  if (measureKind === 'retention_probe' && phase === 'retention') return 'retention';
  if (measureKind === 'primary_probe' && phase === 'baseline') return 'probes_baseline';
  if (measureKind === 'primary_probe' && phase === 'intervention') return 'probes_intervention';
  return null;
}

/** P-I §7.7: consumo de enseñanza que excluye cualquier reserva de medición. */
export const MEASUREMENT_CONSUMPTION_EXCLUSIONS: Readonly<
  Partial<Record<Reserve, readonly MeasurementReserve[]>>
> = Object.freeze({
  guided_practice: Object.freeze([...MEASUREMENT_RESERVES]),
  independent_practice: Object.freeze([...MEASUREMENT_RESERVES]),
  recovery: Object.freeze([...MEASUREMENT_RESERVES]),
  TRANSFER_MASTERY: Object.freeze([...MEASUREMENT_RESERVES]),
});

export function consumptionBlocksMeasurement(
  sourceReserve: Reserve,
  targetReserve: MeasurementReserve,
): boolean {
  return MEASUREMENT_CONSUMPTION_EXCLUSIONS[sourceReserve]?.includes(targetReserve) ?? false;
}
