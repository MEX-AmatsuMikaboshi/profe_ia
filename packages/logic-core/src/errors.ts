/**
 * Códigos de error versionados (P-II §4.1.1, lista literal de 18).
 * Cualquier fallo del verificador se expresa con uno de estos códigos; no hay
 * categoría «otro» que oculte un caso no previsto.
 */
export const VERIFICATION_ERROR_CODES = [
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
] as const;

export type VerificationErrorCode = (typeof VERIFICATION_ERROR_CODES)[number];

export interface VerificationError {
  readonly code: VerificationErrorCode;
  /** Línea 1-based donde se detecta el error, si aplica. */
  readonly line?: number;
  /** `rule_id` canónico; nunca un alias de entrada (P-II §4.1.1). */
  readonly ruleId?: string;
  readonly references?: readonly string[];
  /** Detalle determinista para auditoría. Nunca contiene la solución. */
  readonly detail?: string;
}

export class ParseError extends Error {
  constructor(
    readonly code: VerificationErrorCode,
    readonly detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = 'ParseError';
  }
}
