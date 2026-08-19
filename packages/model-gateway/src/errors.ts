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

/**
 * El parámetro no está declarado en `supportedParameters` (T-H4-02). Distinto de
 * `RejectedParameterError`: aquí el proveedor no lo documenta, allí lo documenta
 * como incompatible.
 */
export class UnsupportedParameterError extends ModelGatewayError {}

/** El binding declara el parámetro como rechazado por el proveedor (T-H4-02). */
export class RejectedParameterError extends ModelGatewayError {}

/**
 * El binding no fija snapshot ni huella de comportamiento, así que no identifica
 * nada reproducible: un alias puede cambiar de modelo sin aviso (T-H4-02).
 */
export class UnpinnedBindingError extends ModelGatewayError {}

/** El binding declara un parámetro como soportado y rechazado a la vez. */
export class ContradictoryCapabilitiesError extends ModelGatewayError {}

/**
 * El proveedor devolvió una forma o un motivo de parada que el adaptador no
 * reconoce (T-H4-03 ← P-II §8.4: el flujo falla cerrado ante «contrato
 * desconocido»).
 *
 * Se lanza en vez de clasificarlo como una de las cinco causas: la lista de
 * `ModelOutputClassification` es cerrada, y meter ahí lo desconocido lo haría
 * indistinguible de una causa real. Un motivo de parada nuevo del proveedor es
 * un hallazgo que hay que ver, no un caso que absorber en silencio.
 */
export class UnknownProviderContractError extends ModelGatewayError {}

/**
 * No se obtuvo respuesta del proveedor: red caída, timeout o redirección
 * (T-H4-10). Distinto de un 4xx/5xx, que **sí** es respuesta y la traduce el
 * adaptador. No se reintenta desde el transporte: la petición pudo haber
 * llegado y se cobraría dos veces.
 */
export class TransportError extends ModelGatewayError {}

/** El fragmento no pertenece al bloque del contexto (T-H4-04 ← P-I §9.4). */
export class FragmentOutsideBlockError extends ModelGatewayError {}

/** La pista seleccionada supera el nivel de ayuda permitido (P-I §9.4). */
export class HelpLevelExceededError extends ModelGatewayError {}

/**
 * Una clave de estado no declarada intentó entrar en el contexto. Es un fallo y
 * no un campo que se ignora: ignorarlo escondería el intento (P-II §8.3).
 */
export class UndeclaredStateKeyError extends ModelGatewayError {}

/**
 * Cadena canario detectada en el egreso (P-II §11.3). Significa que una solución
 * llegó hasta el contexto construido: se aborta. El incidente y el bloqueo de
 * corrida los añade T-H4-05.
 */
export class CanaryHitError extends ModelGatewayError {}

/**
 * Se pidió construir contexto para una actividad **puntuable** sin detector de
 * canarios (T-H7-03 ← P-I §9.4 y §9.6).
 *
 * Hasta esta tarea el detector era opcional y su ausencia hacía que la
 * comprobación **no corriera**, sin decirlo. Un filtro que puede faltar en
 * silencio no es un filtro, y «sin solución en contexto» era entonces una
 * afirmación que nadie comprobaba justo cuando más importa. Se exige donde
 * §9.6 gobierna; fuera de una actividad puntuable sigue siendo opcional, que es
 * lo que era antes.
 */
export class MissingEgressFilterError extends ModelGatewayError {}

/**
 * Se intentó registrar contenido distinto bajo un `pricing_manifest_id` ya
 * usado (T-H4-06 ← P-II §9.5). Un cambio de tarifa crea un id nuevo; nunca
 * reescribe el costo histórico.
 */
export class ManifestRewriteError extends ModelGatewayError {}

/** El manifiesto citado por el evento de costo no está registrado. */
export class UnknownPricingManifestError extends ModelGatewayError {}

/**
 * El evento ocurrió antes de que su manifiesto entrara en vigor: sería cobrar
 * con una tarifa futura, que es reconstruir el costo con precios actuales.
 */
export class ManifestNotEffectiveError extends ModelGatewayError {}

/**
 * Se facturó una unidad sin tarifa declarada. Falla en vez de sumar cero: un
 * cero fabricado haría parecer el gasto menor del real justo donde mira el gate
 * de presupuesto.
 */
export class MissingPricingEntryError extends ModelGatewayError {}

/** El manifiesto mezcla monedas para un mismo modelo; no hay conversión implícita. */
export class CurrencyMismatchError extends ModelGatewayError {}

/**
 * Gasto acumulado por encima del umbral duro sin revisión del propietario
 * (T-H4-07 ← `OWNER-BUDGET-001`). No tiene variante permisiva: el gate nunca
 * degrada integridad, así que no hay «continuar igualmente».
 */
export class BudgetBlockedError extends ModelGatewayError {}

/** Umbral de alerta ausente o incoherente con el umbral duro. */
export class InvalidAlertThresholdError extends ModelGatewayError {}

/**
 * La modalidad (batch o caching) no es elegible para esta operación
 * (T-H4-08 ← P-II §8.4). Lo desconocido no es permiso: una política de datos sin
 * retención declarada no habilita tráfico de participante.
 */
export class ModalityNotEligibleError extends ModelGatewayError {}

/**
 * Falta un activo congelado o el valor de un hueco de plantilla en modo
 * degradado (T-H4-12 ← P-II §8.6). No se rellena: un relleno haría pasar por
 * «el núcleo respondió» algo que no estaba, y el perfil dejaría de servir para
 * aislar si el fallo viene del modelo o del núcleo.
 */
export class FrozenAssetMissingError extends ModelGatewayError {}

/** Se intentó generar en vivo con el perfil degradado activo (P-II §8.6). */
export class LiveGenerationDisabledError extends ModelGatewayError {}
