/**
 * Errores de la pasarela (T-H4-01).
 *
 * Todos fallan cerrado: ninguno tiene una rama que devuelva un resultado
 * benigno. Un fallo aquí nunca se disfraza de «no disponible» ni cae a otro
 * perfil, porque la separación de credenciales `SESION`/`AUTORIA` es una
 * frontera de seguridad (P-II §8.2, decisión CONGELADA del Maestro).
 */

export class ModelGatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** La operación no está declarada para el perfil de esta pasarela. */
export class OperationNotAuthorizedForProfileError extends ModelGatewayError {}

/** El binding registrado declara un perfil distinto al de la pasarela. */
export class ProfileMismatchError extends ModelGatewayError {}

/**
 * Dos bindings declaran la misma operación. No se elige el primero: una
 * pasarela ambigua enviaría tráfico a un modelo no determinado.
 */
export class AmbiguousBindingError extends ModelGatewayError {}

/** No hay credencial para el perfil. Nunca se cae a la del otro perfil. */
export class MissingCredentialError extends ModelGatewayError {}

/** No hay adaptador propio para el proveedor que declara el binding. */
export class UnknownProviderError extends ModelGatewayError {}
