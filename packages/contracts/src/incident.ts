import { z } from 'zod';
import { HumanRole, Id, IsoDateTime } from './primitives.js';

/**
 * Taxonomía canónica de incidentes — **P-I §13** (fuente única para toda la
 * especificación). El manifiesto congela `incident_code`, nivel y efecto de
 * validez; Parte III referencia esta taxonomía y **no puede crear una
 * severidad paralela con el mismo nombre**.
 *
 * Por eso `incidentCode` es un identificador libre validado contra la lista
 * congelada de la corrida (T-FRZ-01), no un enum fijo en código: el nivel sí
 * es literal y cerrado.
 */

/** Nivel 1 menor · 2 pedagógico/evaluativo localizado · 3 sistémico (P-I §13.1). */
export const IncidentLevel = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type IncidentLevel = z.infer<typeof IncidentLevel>;

/** Categorías literales de nivel 2 (P-I §13.1). */
export const LEVEL_2_CATEGORIES = [
  'explicacion_incorrecta',
  'reactivo_ambiguo',
  'falso_negativo',
  'pista_demasiado_reveladora',
  'perdida_de_evidencia_de_un_acto',
  'decision_de_avance_incorrecta',
  'correccion_post_commit_o_fallo_percepcion_interfaz_en_acto_puntuable',
] as const;

/** Categorías literales de nivel 3 (P-I §13.1). */
export const LEVEL_3_CATEGORIES = [
  'falso_positivo_verificador_no_contenido',
  'contaminacion_del_banco',
  'fuga_de_soluciones',
  'cambio_no_registrado_de_modelo_o_contenido',
  'perdida_transversal_de_evidencias',
  'fallo_de_identidad',
  'vulneracion_de_privacidad',
  'ruta_efectiva_no_autorizada_a_soluciones_sondas_secretos',
  'inconsistencia_sistemica_ledger_manifest_privilegios',
] as const;

/**
 * Acción obligatoria por nivel (P-I §13.1):
 *  1 → registrar, corregir en versión posterior, continuar si no afecta integridad;
 *  2 → invalidar el acto o bloque, conservar evidencia, clasificar como fallo de
 *      autonomía; **no se rescata manualmente dentro de la condición**;
 *  3 → suspender el piloto, contener, investigar, decidir si se reinicia la fase.
 */
export const IncidentAction = z.enum([
  'registrar_y_continuar',
  'invalidar_acto_o_bloque',
  'suspender_piloto',
]);
export type IncidentAction = z.infer<typeof IncidentAction>;

export const INCIDENT_ACTION_BY_LEVEL = {
  1: 'registrar_y_continuar',
  2: 'invalidar_acto_o_bloque',
  3: 'suspender_piloto',
} as const;

export const Incident = z.object({
  incidentId: Id,
  /** Validado contra la lista congelada del `run-manifest` (T-FRZ-01). */
  incidentCode: z.string().min(1),
  level: IncidentLevel,
  action: IncidentAction,
  detectedAt: IsoDateTime,
  /** Eventos afectados; la corrección nunca borra el original (I-6). */
  affectedEventIds: z.array(Id).default([]),
  invalidatedOpportunityIds: z.array(Id).default([]),
  responsibleRole: HumanRole.optional(),
  approverRole: HumanRole.optional(),
  notes: z.string().optional(),
});
export type Incident = z.infer<typeof Incident>;

/**
 * Reposición (P-I §13.2): usa reserva independiente, mantiene el registro
 * original marcado como inválido, no borra el fallo, no cuenta como éxito
 * autónomo si requirió intervención pedagógica humana, y documenta versión,
 * causa y corrección.
 *
 * Si la reserva válida se agota durante H11 **no se generan ni autorizan
 * reactivos nuevos en caliente**: se registra `reserve_exhausted`.
 */
export const Replacement = z.object({
  replacementId: Id,
  originalEventId: Id,
  reserveBankId: Id,
  cause: z.string().min(1),
  requiredProhibitedHumanTeaching: z.boolean(),
  documentedVersion: z.string().min(1),
});
export type Replacement = z.infer<typeof Replacement>;
