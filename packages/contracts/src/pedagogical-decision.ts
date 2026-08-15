import { z } from 'zod';
import { PedagogicalMode } from './primitives.js';

/**
 * Política pedagógica determinista — **transcripción literal de P-II §7.2.1**.
 *
 * La decide el código, nunca el modelo (I-1, P-II §7.2): el modelo no decide
 * estrategia, modo pedagógico, elegibilidad de un intento para dominio ni
 * nivel máximo de ayuda. `pedagogy-policy` recibe únicamente estado
 * estructurado y señales autorizadas; la tabla concreta de transiciones se
 * versiona y congela por corrida, y **no se codifica únicamente en prompts**.
 */

/** Enum literal de estrategias (P-II §7.2.1). El catálogo base está en P-I §5.10. */
export const PedagogicalStrategy = z.enum([
  'direct_explanation',
  'worked_example',
  'completion_problem',
  'guided_practice',
  'independent_practice',
  'scaffolding',
  'self_explanation',
  'retrieval',
  'prerequisite_remediation',
  'near_transfer',
]);
export type PedagogicalStrategy = z.infer<typeof PedagogicalStrategy>;

export const PedagogicalDecision = z.object({
  mode: PedagogicalMode,
  strategy: PedagogicalStrategy,
  assistanceLevel: z.number().int().nonnegative(),
  masteryEligible: z.boolean(),
  reasonCode: z.string().min(1),
});
export type PedagogicalDecision = z.infer<typeof PedagogicalDecision>;

/**
 * Catálogo base de estrategias en prosa (P-I §5.10). El agente de sesión no
 * inventa categorías nuevas con autoridad operativa. `fading` y `feedback`
 * aparecen en el catálogo base como acciones de política y se expresan a
 * través del `assistanceLevel` y del enum anterior, que es el contrato.
 */
export const STRATEGY_CATALOG_ES = [
  'explicación directa breve',
  'ejemplo trabajado',
  'ejemplo incompleto/completion problem',
  'práctica guiada',
  'práctica independiente',
  'scaffolding contingente',
  'fading contingente',
  'autoexplicación guiada',
  'retrieval practice',
  'feedback correctivo centrado en tarea/proceso',
  'recuperación de prerrequisito',
  'comprobación de transferencia cercana',
] as const;

/** Clasificación de dudas fuera de guion (Plan.md T-H6-10). */
export const DoubtScope = z.enum([
  'current_block',
  'blocking_prerequisite',
  'later_in_unit',
  'outside_corpus',
  'unsafe_or_disallowed',
  'insufficient_anchor',
]);
export type DoubtScope = z.infer<typeof DoubtScope>;

/** Exposición externa registrada al inicio (Plan.md T-H6-11 ← P-I §10.8). */
export const ExternalExposure = z.enum([
  'NONE',
  'UNRELATED_OR_FOUNDATION',
  'TARGET_KC_EXPOSURE',
  'DIRECT_ITEM_EXPOSURE',
]);
export type ExternalExposure = z.infer<typeof ExternalExposure>;

/**
 * Atribución de fallo (Plan.md T-H8-07, DEC-FAILURE-ATTRIBUTION-001).
 * Los tres primeros no consumen intento elegible ni cuentan como fallo de KC;
 * `CONCEPTUAL_ERROR` solo tras descartar los otros.
 */
export const FailureAttribution = z.enum([
  'PERCEPTION_ERROR',
  'INTERFACE_ERROR',
  'ACCESSIBILITY_ERROR',
  'CONCEPTUAL_ERROR',
]);
export type FailureAttribution = z.infer<typeof FailureAttribution>;

/** Estados literales de la máquina de sesión (Plan.md T-H6-01). */
export const SESSION_STATES = [
  'preparada',
  'autenticacion',
  'consentimiento_confirmado',
  'diagnostico',
  'explicacion',
  'comprobacion',
  'practica',
  'evaluacion_operativa',
  'cierre',
] as const;

/** Estados transversales literales (Plan.md T-H6-01). */
export const SESSION_TRANSVERSAL_STATES = [
  'pausa',
  'duda',
  'recuperacion',
  'sonda',
  'fallo_pedagogico',
  'incidente',
  'invalidacion',
  'retirada',
] as const;

export const SessionState = z.enum(SESSION_STATES);
export type SessionState = z.infer<typeof SessionState>;

export const SessionTransversalState = z.enum(SESSION_TRANSVERSAL_STATES);
export type SessionTransversalState = z.infer<typeof SessionTransversalState>;
