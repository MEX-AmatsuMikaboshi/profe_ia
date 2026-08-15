/** Errores de `authoring-core`. Todos fallan cerrado. */

export class AuthoringCoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Se intentó contar por mayoría un claim de otro sistema formal
 * (T-H45-03 ← P-I §7.0). «La mayoría simple no decide una cuestión cuando las
 * fuentes describen sistemas distintos.»
 */
export class ForeignSystemInMajorityError extends AuthoringCoreError {}

/**
 * Ninguna fuente describe el sistema objetivo, así que no hay mayoría que
 * resolver. Se lanza en vez de devolver el más votado del conjunto ajeno, que
 * sería dejar que otro cálculo decida el nuestro.
 */
export class NoEligibleClaimsError extends AuthoringCoreError {}

/**
 * Al recurso le faltan campos de los cuatro mínimos de P-I §7.0
 * (`source_component`, `source_version`, `provenance_basis`,
 * `license_evidence`). Sin ellos no hay cadena de atribución que comprobar, y
 * clasificarlo sería afirmar un derecho que nadie registró.
 */
export class IncompleteLicenseRecordError extends AuthoringCoreError {}

/**
 * Modo de acceso fuera del conjunto cerrado (T-H45-02 ← P-I §7.0: «sin crawler
 * web general»). Si los modos fueran texto libre, el crawler entraría
 * escribiéndolo.
 */
export class GeneralCrawlerForbiddenError extends AuthoringCoreError {}

/** Al candidato le falta parte del registro obligatorio de §7.0. */
export class IncompleteDiscoveryRecordError extends AuthoringCoreError {}

/** Fuente fuera de la whitelist con un modo distinto de búsqueda abierta. */
export class SourceNotWhitelistedError extends AuthoringCoreError {}

/**
 * Todos los candidatos vienen de búsqueda abierta. §7.0 la admite «solo como
 * complemento», y sin nada de la whitelist no complementa: es la estrategia
 * principal.
 */
export class OpenSearchNotComplementError extends AuthoringCoreError {}
