import { z } from 'zod';

/** SHA-256 en hexadecimal minúsculo. */
export const Sha256Hex = z.string().regex(/^[0-9a-f]{64}$/, 'sha256_hex_esperado');
export type Sha256Hex = z.infer<typeof Sha256Hex>;

/** Marca temporal ISO-8601 con zona. */
export const IsoDateTime = z.iso.datetime({ offset: true });
export type IsoDateTime = z.infer<typeof IsoDateTime>;

/** Identificador opaco no vacío (los ids formales nunca se traducen — P-II §4.1.1). */
export const Id = z.string().min(1).max(200);
export type Id = z.infer<typeof Id>;

/**
 * `VersionManifest` — el Maestro lo referencia en `EvidenceEvent` (P-II §9.1)
 * pero no lo define literalmente. Se implementa como el conjunto de versiones
 * que el freeze congela (P-II §5.7): id de artefacto → versión + hash.
 * Decisión de ingeniería D-4 (`docs/plan/PLAN_STATUS.md`), sin autoridad normativa.
 */
export const VersionManifest = z.record(
  z.string().min(1),
  z.object({ version: z.string().min(1), hash: Sha256Hex.optional() }),
);
export type VersionManifest = z.infer<typeof VersionManifest>;

export const VersionRef = z.object({
  artifactId: Id,
  version: z.string().min(1),
  hash: Sha256Hex.optional(),
});
export type VersionRef = z.infer<typeof VersionRef>;

/**
 * Quién tomó la decisión registrada — literal P-II §9.1.
 * `model` nunca aparece como `decisionMaker` de una decisión verificable (I-1).
 */
export const DecisionMaker = z.enum(['engine', 'verifier', 'model', 'human', 'system']);
export type DecisionMaker = z.infer<typeof DecisionMaker>;

/**
 * Estado de autonomía del acto registrado — literal P-II §9.1 (4 valores).
 * La matriz de autonomía (P-I §5.6) añade `not-evaluated`, que no es un valor
 * de evento sino un estado de la matriz: `no evaluada` permanece visible y
 * nunca se convierte implícitamente en éxito.
 */
export const EventAutonomyStatus = z.enum([
  'autonomous',
  'automatic-control',
  'human-exception',
  'failed',
]);
export type EventAutonomyStatus = z.infer<typeof EventAutonomyStatus>;

export const AutonomyMatrixState = z.enum([
  'autonomous',
  'automatic-control',
  'human-exception',
  'failed',
  'not-evaluated',
]);
export type AutonomyMatrixState = z.infer<typeof AutonomyMatrixState>;

/** Criticidad por función — literal P-I §5.6.1. */
export const CriticalityClass = z.enum([
  'SEGURIDAD',
  'INTEGRIDAD_EVIDENCIA',
  'EVALUACION',
  'PEDAGOGIA',
  'EXPERIENCIA',
]);
export type CriticalityClass = z.infer<typeof CriticalityClass>;

/**
 * Efecto de fallo. `EXPERIENCIA` es DEGRADABLE salvo que impida acceso válido
 * a la tarea; el resto es BLOCKING (P-I §5.6.1). Un número alto de fallos
 * `EXPERIENCIA` nunca compensa ni oculta uno de las clases bloqueantes.
 */
export const FailureEffect = z.enum(['BLOCKING', 'DEGRADABLE']);
export type FailureEffect = z.infer<typeof FailureEffect>;

/** Clasificación de toda acción humana relacionada con el piloto — literal P-I §5.7. */
export const HumanInterventionKind = z.enum([
  'configuracion_sobre_experimental',
  'autorizacion_inicial',
  'seguridad_o_privacidad',
  'apelacion_o_retirada',
  'auditoria_posterior',
  'correccion_entre_versiones',
  'intervencion_pedagogica_prohibida',
]);
export type HumanInterventionKind = z.infer<typeof HumanInterventionKind>;

/** Roles humanos canónicos (Plan.md §5.2, DEC-GOVERNANCE-ROLES-001). */
export const HumanRole = z.enum([
  'SYSTEM_OWNER',
  'CORPUS_APPROVER',
  'TECHNICAL_AUDITOR',
  'EXPERIMENT_AUDITOR',
  'SECURITY_PRIVACY_RESPONSIBLE',
  'PROFESSIONAL_REVIEWER',
]);
export type HumanRole = z.infer<typeof HumanRole>;

/** Tipo de curso (Plan.md §2.1, DEC-CUSTOM-COURSES-001). */
export const CourseType = z.enum(['VALIDATED_LOGIC_COURSE', 'CUSTOM_COURSE_UNVALIDATED']);
export type CourseType = z.infer<typeof CourseType>;

/** Modo pedagógico — literal P-I §5.9. Lo decide el motor; el modelo no puede cambiarlo. */
export const PedagogicalMode = z.enum(['LEARNING_MODE', 'MEASUREMENT_MODE']);
export type PedagogicalMode = z.infer<typeof PedagogicalMode>;
