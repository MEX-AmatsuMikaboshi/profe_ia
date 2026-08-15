import type { ModelBinding } from '@profesor-ia/contracts';
import {
  ContradictoryCapabilitiesError,
  RejectedParameterError,
  UnpinnedBindingError,
  UnsupportedParameterError,
} from './errors.js';

/**
 * Capacidades por binding (T-H4-02 ← `DEC-MODEL-BINDING-001`, P-II §8.1–8.2).
 *
 * La pasarela envía **solo** parámetros declarados compatibles por el binding y
 * falla localmente ante uno desconocido. La comprobación no es una convención
 * que el adaptador deba recordar: `AuthorizedParameters` es un tipo que solo
 * `authorizeParameters` puede producir, así que un adaptador no puede recibir
 * parámetros sin autorizar ni aunque quiera.
 */

declare const authorizedBrand: unique symbol;

/** Parámetros ya contrastados contra `ModelCapabilities`. Marca no fabricable fuera de aquí. */
export type AuthorizedParameters = Readonly<Record<string, unknown>> & {
  readonly [authorizedBrand]: true;
};

/** Conjunto vacío autorizado: el caso por omisión es no enviar ningún parámetro. */
export const NO_PARAMETERS = Object.freeze({}) as AuthorizedParameters;

/**
 * Comprueba que el binding es utilizable antes de mandarle tráfico.
 *
 * Dos fallos cerrados:
 *
 * 1. **Sin snapshot fechado hace falta huella de comportamiento.** Un alias
 *    puede cambiar de modelo por debajo sin avisar; si el binding no fija un
 *    snapshot, la única forma de saber contra qué se está hablando es la huella
 *    sobre el set canario congelado (Plan.md T-H4-02). Sin una ni otra, el
 *    binding no identifica a nada reproducible.
 * 2. **Capacidades contradictorias.** Un parámetro declarado a la vez soportado
 *    y rechazado no es un empate a resolver por precedencia: es un binding mal
 *    escrito, y elegir una de las dos ramas decidiría por cuenta propia si un
 *    parámetro sale hacia el proveedor.
 */
export function assertBindingUsable(binding: ModelBinding): void {
  if (binding.snapshot === undefined && binding.behaviorFingerprint === undefined) {
    throw new UnpinnedBindingError(
      `El binding ${binding.bindingId} no fija snapshot ni huella de comportamiento. ` +
        `Un alias sin snapshot puede cambiar de modelo sin aviso, así que exige huella sobre el ` +
        `set canario congelado (T-H4-02).`,
    );
  }

  const { supportedParameters, rejectedParameters } = binding.capabilities;
  const rejected = new Set(rejectedParameters);
  const contradictorios = supportedParameters.filter((p) => rejected.has(p));
  if (contradictorios.length > 0) {
    throw new ContradictoryCapabilitiesError(
      `El binding ${binding.bindingId} declara ${contradictorios.join(', ')} como soportado y ` +
        `rechazado a la vez. No hay precedencia que aplicar: el binding está mal escrito.`,
    );
  }
}

/**
 * Autoriza los parámetros de una petición contra las capacidades del binding.
 *
 * Distingue **desconocido** de **rechazado** a propósito: que un proveedor no
 * documente un parámetro y que lo documente como incompatible son dos hechos
 * distintos, y colapsarlos en un solo error borraría la diferencia justo cuando
 * el refresco documental de T-H4-09 necesita verla.
 */
export function authorizeParameters(
  binding: ModelBinding,
  requested: Readonly<Record<string, unknown>>,
): AuthorizedParameters {
  assertBindingUsable(binding);

  const supported = new Set(binding.capabilities.supportedParameters);
  const rejected = new Set(binding.capabilities.rejectedParameters);
  const autorizados: Record<string, unknown> = {};

  for (const [name, value] of Object.entries(requested)) {
    if (rejected.has(name)) {
      throw new RejectedParameterError(
        `El binding ${binding.bindingId} declara ${name} como rechazado por el proveedor. ` +
          `No se envía.`,
      );
    }
    if (!supported.has(name)) {
      throw new UnsupportedParameterError(
        `El binding ${binding.bindingId} no declara ${name} entre sus parámetros soportados. ` +
          `La pasarela no envía parámetros no declarados (P-II §8.1: no hay plantilla universal ` +
          `de petición).`,
      );
    }
    autorizados[name] = value;
  }

  return Object.freeze(autorizados) as AuthorizedParameters;
}
