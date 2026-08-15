import { z } from 'zod';
import { Id, IsoDateTime, Sha256Hex } from './primitives.js';

/**
 * Pasarela de modelo: binding, capacidades y clasificación de salida
 * (Plan.md T-H4-01/02/03; DEC-MODEL-BINDING-001).
 *
 * Los nombres de modelo son **candidatos fechados (2026-08-13)** y se
 * reverifican inmediatamente antes del benchmark (T-H4-09): este contrato
 * describe la forma del binding, no autoriza ningún modelo.
 */

/** Operaciones permitidas — lista exacta y cerrada (T-H4-01 ← P-II §8.2). */
export const ModelOperation = z.enum([
  'explain_block',
  'rephrase_explanation',
  'draft_worked_example',
  'draft_completion_prompt',
  'draft_self_explanation_prompt',
  'classify_student_error',
  'classify_question_scope',
  'draft_feedback',
  'create_authoring_candidate',
  'critique_authoring_candidate',
  'interpret_visual_context',
]);
export type ModelOperation = z.infer<typeof ModelOperation>;

/** Perfiles con credenciales separadas (T-H4-01). */
export const ModelProfile = z.enum(['SESION', 'AUTORIA']);
export type ModelProfile = z.infer<typeof ModelProfile>;

export const ModelCapabilities = z.object({
  /** Parámetros que el adaptador puede enviar; el resto falla localmente. */
  supportedParameters: z.array(z.string()),
  rejectedParameters: z.array(z.string()),
  structuredOutput: z.object({
    supported: z.boolean(),
    maxSchemaDepth: z.number().int().positive().optional(),
    notes: z.string().optional(),
  }),
  reasoning: z.object({ supported: z.boolean(), notes: z.string().optional() }),
  /** Política de datos conocida y verificable (elegibilidad H9, EXT-03). */
  dataPolicy: z.object({
    region: z.string().optional(),
    loggingRetentionDays: z.number().int().nonnegative().optional(),
    zeroDataRetention: z.boolean().optional(),
    contractualEligibility: z.enum(['unknown', 'available_not_enabled', 'enabled']),
  }),
  limits: z.record(z.string(), z.number()).optional(),
  failureCodes: z.array(z.string()).optional(),
});
export type ModelCapabilities = z.infer<typeof ModelCapabilities>;

export const ModelBinding = z.object({
  bindingId: Id,
  profile: ModelProfile,
  provider: z.string().min(1),
  /** Id/endpoint exacto; alias sin snapshot exige huella de comportamiento. */
  modelId: z.string().min(1),
  endpoint: z.string().min(1),
  snapshot: z.string().optional(),
  aliasResolvedAt: IsoDateTime.optional(),
  deprecationNotice: z.string().optional(),
  capabilities: ModelCapabilities,
  /** Huella sobre el set canario congelado cuando no hay snapshot fechado. */
  behaviorFingerprint: Sha256Hex.optional(),
  /** Evidencia fechada del refresco documental previo al benchmark (T-H4-09). */
  verifiedAt: IsoDateTime,
});
export type ModelBinding = z.infer<typeof ModelBinding>;

/**
 * Clasificación local fail-closed de toda salida (T-H4-03). Nada estructurado
 * del proveedor cruza sin validación local.
 */
export const ModelOutputClassification = z.enum([
  'valid',
  'schema_violation',
  'truncated',
  'refusal',
  'provider_error',
]);
export type ModelOutputClassification = z.infer<typeof ModelOutputClassification>;

export const ModelOutputEnvelope = z.object({
  operation: ModelOperation,
  bindingId: Id,
  classification: ModelOutputClassification,
  /** Valor bruto conservado incluso cuando se canoniza un enum (T-H4-03). */
  rawOutput: z.string(),
  attempt: z.number().int().positive(),
  /** Un hit de canario aborta la corrida y abre incidente (T-H4-05). */
  canaryHits: z.array(Id),
});
export type ModelOutputEnvelope = z.infer<typeof ModelOutputEnvelope>;

/** Flags de capacidad por corrida (T-H0-03, T-H8-13 ← P-II §5.7). */
export const CapabilityFlags = z.object({
  voiceInput: z.boolean(),
  voiceOutput: z.boolean(),
  whiteboard: z.boolean(),
  visualBoardInterpretation: z.boolean(),
  uiAnnotations: z.boolean(),
  internalUiCapture: z.boolean(),
  /** Experimental; OFF por defecto (P-II §11.6). */
  externalScreenCapture: z.boolean(),
});
export type CapabilityFlags = z.infer<typeof CapabilityFlags>;

/** Configuración recomendada de la corrida H8 (T-H8-13). */
export const H8_RECOMMENDED_CAPABILITY_FLAGS: CapabilityFlags = {
  voiceInput: true,
  voiceOutput: true,
  whiteboard: true,
  visualBoardInterpretation: true,
  uiAnnotations: true,
  internalUiCapture: true,
  externalScreenCapture: false,
};
