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
