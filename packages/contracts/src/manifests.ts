import { z } from 'zod';
import { HumanRole, Id, IsoDateTime, Sha256Hex, VersionRef } from './primitives.js';
import { CapabilityFlags } from './model-binding.js';

/**
 * Manifiestos (Plan.md T-H0-03: «esqueletos»). El contenido íntegro se congela
 * en su fase: freeze de contenido en H5 (P-II §5.7), preinscripción de la
 * corrida en F14 (P-I §10.7).
 */

export const ManifestSignature = z.object({
  keyId: Id,
  signature: z.string().min(1),
  signedAt: IsoDateTime,
});
export type ManifestSignature = z.infer<typeof ManifestSignature>;

/**
 * Contenido obligatorio del manifiesto de freeze — literal P-II §5.7.
 * `profesor-ia experiment freeze` debe producir **todos** estos elementos;
 * el linter del comando verifica la lista completa (T-H5-15).
 */
export const FREEZE_MANIFEST_REQUIRED_SECTIONS = [
  'hashes',
  'firma',
  'inventario_de_artefactos',
  'versiones_de_modelos',
  'semillas',
  'resultados_de_pruebas_y_manifiesto_de_validacion_del_nucleo_logico',
  'authorized_calculus_version_hash_semantica_y_autoridad_de_decision_por_conjunto',
  'presupuestos_proof_search_timeout_y_parametros_k_coste',
  'politica_de_auditoria_codebook_muestreo_y_capacidad_de_deteccion',
  'mapa_de_licencias_snapshots_w0_y_atribucion_en_cadena',
  'plan_sced_preinscrito',
  'hash_version_politica_pedagogica',
  'reglas_de_elegibilidad_para_dominio_y_niveles_de_ayuda',
  'configuracion_wheel_spinning',
  'configuracion_bkt_sombra_si_se_habilita',
  'capability_flags_multimodales',
  'proveedores_modelos_y_politicas_tts_stt_vision',
  'identificador_unico_de_corrida',
] as const;

export const FreezeManifest = z.object({
  manifestVersion: z.literal('0'),
  runId: Id,
  createdAt: IsoDateTime,
  contentPackageHash: Sha256Hex,
  authorizedCalculusVersion: VersionRef,
  artifacts: z.array(z.object({ path: z.string().min(1), hash: Sha256Hex })),
  capabilityFlags: CapabilityFlags.optional(),
  signature: ManifestSignature.optional(),
});
export type FreezeManifest = z.infer<typeof FreezeManifest>;

/** Asignación de personas a roles; H11 exige ≥2 personas naturales (P-I §14.1). */
export const RoleAssignment = z.object({
  role: HumanRole,
  /** Identificador de persona natural. Ningún modelo de IA puede ser approver_role. */
  personId: Id,
});
export type RoleAssignment = z.infer<typeof RoleAssignment>;

export const RunManifest = z.object({
  manifestVersion: z.literal('0'),
  runId: Id,
  createdAt: IsoDateTime,
  roleAssignments: z.array(RoleAssignment),
  capabilityFlags: CapabilityFlags,
  environment: z.enum(['local', 'remote']),
  budgetLimitMxn: z.number().nonnegative(),
  freezeManifestHash: Sha256Hex.optional(),
  /** Lista congelada de `incident_code` de la corrida (P-I §13). */
  incidentCodes: z.array(z.string().min(1)).default([]),
  signature: ManifestSignature.optional(),
});
export type RunManifest = z.infer<typeof RunManifest>;

/**
 * Métricas con contrato congelado (P-I §10.4/§10.5). Etapa 1 **no adopta un
 * escalar `phase_change`**: el cambio de fase se representa con análisis visual
 * estructurado y el complemento Tau-U preinscrito.
 */
export const METRIC_IDS = [
  'probe_accuracy',
  'transfer_measurement_accuracy',
  'retention_accuracy',
  'false_mastery_rate',
  'hint_dependency',
  'time_to_mastery',
  'wheel_spinning',
] as const;

export const MetricId = z.enum(METRIC_IDS);
export type MetricId = z.infer<typeof MetricId>;

/**
 * Toda medida interpretada lleva contrato versionado con unidad, población/
 * denominador, inclusión/exclusión, faltantes, dirección interpretativa y
 * vínculo al veredicto (P-I §10.5).
 */
export const MetricContract = z.object({
  metricId: MetricId,
  unit: z.string().min(1),
  numerator: z.string().min(1),
  denominator: z.string().min(1),
  inclusionExclusion: z.string().min(1),
  missingDataPolicy: z.string().min(1),
  interpretiveDirection: z.string().min(1),
  linkedVerdict: z.enum(['pedagogico', 'autonomia', 'integridad', 'viabilidad']),
  /** Cobertura reportada junto a la tasa (p. ej. válidas/planificadas). */
  coverage: z.string().optional(),
});
export type MetricContract = z.infer<typeof MetricContract>;

export const MetricsManifest = z.object({
  manifestVersion: z.literal('0'),
  runId: Id,
  metrics: z.array(MetricContract).min(1),
  signature: ManifestSignature.optional(),
});
export type MetricsManifest = z.infer<typeof MetricsManifest>;

/** Clase de transición A/B/C — literal P-I §10.5.1. Exactamente una por transición. */
export const TransitionClass = z.enum(['FAVORABLE', 'NO_FAVORABLE', 'NOT_INTERPRETABLE']);
export type TransitionClass = z.infer<typeof TransitionClass>;

/** Dimensiones del análisis visual estructurado (P-I §10.5/§10.5.1). */
export const VISUAL_DIMENSIONS = [
  'nivel',
  'tendencia',
  'variabilidad',
  'inmediatez',
  'solapamiento',
  'consistencia',
] as const;

/** A. Veredicto pedagógico — literal P-I §12.3. */
export const PedagogicalVerdict = z.enum([
  'fuerte',
  'parcial',
  'solo_asistido',
  'negativo',
  'no_interpretable',
]);
export type PedagogicalVerdict = z.infer<typeof PedagogicalVerdict>;

/** B. Veredicto de autonomía — literal P-I §12.3. */
export const AutonomyVerdict = z.enum([
  'completa_dentro_del_alcance',
  'completa_con_controles_automaticos',
  'parcial_con_excepciones',
  'fallida',
  'contaminada_por_intervencion_humana',
]);
export type AutonomyVerdict = z.infer<typeof AutonomyVerdict>;

/** C. Veredicto de integridad y seguridad — literal P-I §12.3. */
export const IntegrityVerdict = z.enum([
  'valida',
  'valida_con_desviaciones',
  'con_reservas',
  'invalida',
]);
export type IntegrityVerdict = z.infer<typeof IntegrityVerdict>;

/** D. Veredicto de viabilidad — literal P-I §12.3. */
export const ViabilityVerdict = z.enum([
  'prometedora',
  'costosa_pero_reducible',
  'no_sostenible',
  'no_evaluada',
]);
export type ViabilityVerdict = z.infer<typeof ViabilityVerdict>;

/**
 * Orden de interpretación obligatorio (P-I §12.3):
 * C. Integridad → B. Autonomía → A. Pedagogía → D. Viabilidad.
 */
export const VERDICT_ORDER = ['integridad', 'autonomia', 'pedagogia', 'viabilidad'] as const;

export const VerdictManifest = z.object({
  manifestVersion: z.literal('0'),
  runId: Id,
  /** Anclajes operativos CAL-15, hasheados; ajustarlos post hoc exige nueva corrida. */
  visualDimensionAnchorsHash: Sha256Hex.optional(),
  order: z.tuple([
    z.literal('integridad'),
    z.literal('autonomia'),
    z.literal('pedagogia'),
    z.literal('viabilidad'),
  ]),
  /** Ningún LLM tiene autoridad para fijar la clase final (P-I §10.5.1). */
  approverRole: z.literal('EXPERIMENT_AUDITOR'),
  /** Mínimo de observaciones válidas por fase para interpretabilidad (P-I §10.5). */
  minValidObservationsPerPhase: z.literal(5),
  signature: ManifestSignature.optional(),
});
export type VerdictManifest = z.infer<typeof VerdictManifest>;
