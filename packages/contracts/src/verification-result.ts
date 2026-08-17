import { z } from 'zod';
import { Id } from './primitives.js';

/**
 * Códigos de error del verificador — lista literal y cerrada
 * (Plan.md T-H2-06; Maestro P-II §4.1.1). Versionados: agregar un código es
 * cambio de versión del cálculo, no un parche silencioso.
 */
export const VerificationErrorCode = z.enum([
  'E-SYN-PARSE',
  'E-SYN-PRECEDENCE',
  'E-SYN-ALIAS',
  'E-SYN-SYMBOL',
  'E-RULE-UNKNOWN',
  'E-RULE-FORBIDDEN',
  'E-RULE-ARITY',
  'E-RULE-SHAPE',
  'E-RULE-MAINOP',
  'E-REF-FORWARD',
  'E-REF-CLOSED',
  'E-REF-SUBPROOF-INCOMPLETE',
  'E-REF-SUBPROOF-NESTED-CLOSED',
  'E-STRUCT-AS-POSITION',
  'E-STRUCT-PR-POSITION',
  'E-STRUCT-OPEN-ASSUMPTION',
  'E-STRUCT-CONCLUSION-DEPTH',
  'E-SEM-UNSOUND-STEP',
]);
export type VerificationErrorCode = z.infer<typeof VerificationErrorCode>;

/**
 * Reglas primitivas + derivada autorizada (T-H2-01). `rule_id` nunca es un
 * alias de entrada (T-H2-03): los alias se normalizan antes y no aparecen en trazas.
 */
export const RuleId = z.enum([
  'R',
  '∧I',
  '∧E',
  '∨I',
  '∨E',
  '→I',
  '→E',
  '↔I',
  '↔E',
  '¬I',
  '¬E',
  'X',
  'IP',
  'DNE',
]);
export type RuleId = z.infer<typeof RuleId>;

/** Justificaciones estructurales admitidas (T-H2-01). */
export const JustificationId = z.enum(['PR', 'AS']);
export type JustificationId = z.infer<typeof JustificationId>;

/**
 * Resultado del oráculo semántico. Asimetría literal (T-H2-07): un fallo
 * semántico rechaza y abre incidente; un éxito **no** certifica derivabilidad.
 */
export const SemanticCheck = z.enum(['passed', 'failed', 'not-applicable']);
export type SemanticCheck = z.infer<typeof SemanticCheck>;

export const VerificationError = z.object({
  code: VerificationErrorCode,
  /** Línea 1-based de la derivación donde se detecta el error. */
  line: z.number().int().positive().optional(),
  /** Regla mal aplicada, si el error es de regla. */
  ruleId: RuleId.optional(),
  /** Referencias/alcance implicados (líneas o rangos citados). */
  references: z.array(z.string()).optional(),
  /** KC afectado, cuando el contenido lo permite mapear. */
  kcId: Id.optional(),
  /**
   * Detalle determinista para auditoría; nunca contiene la solución.
   *
   * Se llamaba `trace` y **nada lo emitía**: `logic-core` produce `detail`, así
   * que al parsear la salida real del verificador contra este contrato Zod
   * descartaba el campo en silencio y el alumno se quedaba sin la explicación
   * del error. Renombrado en T-H6-13, cuando el primer consumidor del canal lo
   * destapó.
   */
  detail: z.string().optional(),
});
export type VerificationError = z.infer<typeof VerificationError>;

export const VerificationResult = z.object({
  valid: z.boolean(),
  /**
   * ¿La última línea es la meta pedida? Separado de `valid` a propósito (D-9):
   * una derivación impecable **de otra cosa** es válida y no resuelve el
   * reactivo. Ausente cuando la actividad no declara meta.
   *
   * Estaba en `logic-core` desde T-H2-06 y faltaba en este contrato, que es el
   * que cruza procesos. Sin él, un cliente sólo ve `valid: true` y lo lee como
   * «resolvió el ejercicio», que es exactamente la confusión que D-9 separa.
   * Añadido en T-H6-13, cuando el primer cliente —la vista de Clase— necesitó
   * distinguir los dos casos.
   */
  goalReached: z.boolean().optional(),
  /** Primer paso inválido (1-based); ausente si `valid`. */
  firstInvalidStep: z.number().int().positive().optional(),
  errors: z.array(VerificationError),
  semanticCheck: SemanticCheck,
  /** Razón obligatoria cuando `semanticCheck === 'not-applicable'` (T-H2-07). */
  semanticCheckReason: z.string().optional(),
  /**
   * Corrección por autoridad superior (§0.1). El Maestro fija
   * `authorizedCalculusVersion = "authorized-calculus-v1"` como **cadena**
   * (P-I §1, `DEC-CALCULUS-001`), y así lo emiten `logic-core` y
   * `domain-engine`. Este contrato la tipaba como `VersionRef` —un objeto—, de
   * modo que la salida real del verificador **no validaba contra el contrato
   * que dice gobernarla**. No se notó porque nadie había parseado esa salida
   * hasta que T-H6-13 abrió el canal de veredicto hacia la vista de Clase.
   *
   * Se corrige el contrato, no la implementación: es el contrato el que
   * contradecía al Maestro. `manifests.ts` y `freeze.ts` conservan `VersionRef`
   * a propósito — ahí sí se referencia un artefacto con su hash.
   */
  authorizedCalculusVersion: z.string().min(1),
  verifierVersion: z.string().min(1),
});
export type VerificationResult = z.infer<typeof VerificationResult>;

/** Estados terminales del buscador (T-H2-08, DEC-PROOF-001). */
export const ProofSearchOutcome = z.enum([
  'proof_found',
  'semantically_invalid',
  'search_budget_exhausted',
  'no_proof_with_cost_at_most_k',
  /**
   * Deshabilitado por política hasta CALC-03
   * (`decision_policy.no_proof_exists_in_calculus_enabled=false`).
   */
  'no_proof_exists_in_calculus',
]);
export type ProofSearchOutcome = z.infer<typeof ProofSearchOutcome>;
