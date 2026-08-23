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
/**
 * Identidad fijada: snapshot fechado, o huella sobre el set canario congelado.
 *
 * Está extraída de `assertBindingUsable` porque el refresco documental de
 * T-H4-09 necesita la misma regla **antes** de que exista un binding. La
 * alternativa era construir allí un `ModelBinding` de mentira solo para poder
 * llamar aquí, lo que obligaba a inventarle capacidades —`batch`, `caching`,
 * `reasoning`— que el refresco nunca afirmó. Una regla en un sitio y dos
 * llamantes; no dos copias que puedan divergir.
 */
export function assertPinnedIdentity(
  label: string,
  identity: { readonly snapshot?: string | undefined; readonly behaviorFingerprint?: string | undefined },
): void {
  if (identity.snapshot === undefined && identity.behaviorFingerprint === undefined) {
    throw new UnpinnedBindingError(
      `${label} no fija snapshot ni huella de comportamiento. ` +
        `Un alias sin snapshot puede cambiar de modelo sin aviso, así que exige huella sobre el ` +
        `set canario congelado (T-H4-02).`,
    );
  }
}

/**
 * Consecuencia que hay que **escribir** para renunciar a la identidad fijada.
 * Es un literal y no un booleano por lo mismo que `EgressFilterReceipt` es un
 * objeto: una renuncia que se satisface poniendo `true` se pone sin leerla.
 */
export const UNPINNED_CONSEQUENCE =
  'la medición es exploratoria, no dictamina y no corona a nadie' as const;

/**
 * Renuncia explícita a la identidad fijada, para una medición **exploratoria y
 * no autoritativa**.
 *
 * ## Por qué existe, y qué NO autoriza
 *
 * §8.1 exige snapshot o huella porque un alias puede cambiar de modelo sin
 * aviso, y entonces la corrida deja de ser reproducible. Esa exigencia sigue
 * intacta para todo lo que **dictamine**: `assertRefreshAuthorizesBenchmark()`
 * **rechaza cualquier renuncia en una corrida material**, así que esto no abre
 * una puerta a BENCH-01 — abre una puerta a medir un candidato que BENCH-01 no
 * puede coronar, que es una pregunta legítima y distinta.
 *
 * ## Por qué cada campo es obligatorio
 *
 * `subject` ata la renuncia a **un** binding o candidato: sin él una renuncia
 * escrita para un modelo cubriría a todos los de la corrida. `authorizedBy` y
 * `reason` existen porque esto es una decisión, no un ajuste, y una decisión sin
 * autor no se puede revisar. `providerReportedModelId` y `probedAt` obligan a
 * **haber preguntado al proveedor** qué id resuelve: si algún día el proveedor
 * devolviera un id más específico que el pedido, esa sería la evidencia de
 * fijación que §8.1 quiere y la renuncia sobraría. Comprobado el 2026-08-23:
 * OpenAI devuelve el mismo id sin fecha, así que no sobra.
 */
export interface UnpinnedIdentityWaiver {
  /** `bindingId` o `candidateId` exacto. Una renuncia, un sujeto. */
  readonly subject: string;
  readonly authorizedBy: string;
  readonly reason: string;
  /** Id que el proveedor **reportó** al preguntárselo, y cuándo se preguntó. */
  readonly providerReportedModelId: string;
  readonly probedAt: string;
  readonly consequence: typeof UNPINNED_CONSEQUENCE;
}

/** La renuncia que cubre a este sujeto, si alguna lo hace. */
export function waiverFor(
  subject: string,
  waivers: readonly UnpinnedIdentityWaiver[] | undefined,
): UnpinnedIdentityWaiver | undefined {
  return waivers?.find((w) => w.subject === subject);
}

/**
 * Identidad fijada **o renunciada con todos sus campos**.
 *
 * Una renuncia incompleta no vale: sin autor, sin motivo o sin la consecuencia
 * escrita, lo que queda es un modelo sin identificar y nadie a quien preguntarle
 * por qué. En ese caso se cae al error de siempre.
 */
export function assertIdentityFixedOrWaived(
  subject: string,
  label: string,
  identity: { readonly snapshot?: string | undefined; readonly behaviorFingerprint?: string | undefined },
  waiver: UnpinnedIdentityWaiver | undefined,
): void {
  if (identity.snapshot !== undefined || identity.behaviorFingerprint !== undefined) return;
  if (waiver === undefined) {
    assertPinnedIdentity(label, identity);
    return;
  }
  if (waiver.subject !== subject) {
    throw new UnpinnedBindingError(
      `La renuncia de identidad se escribió para «${waiver.subject}» y se está usando con ` +
        `«${subject}». Una renuncia cubre a un sujeto y no se extiende al de al lado.`,
    );
  }
  if (waiver.consequence !== UNPINNED_CONSEQUENCE) {
    throw new UnpinnedBindingError(
      `La renuncia de identidad de ${subject} no declara su consecuencia literal. Hay que ` +
        `escribirla: «${UNPINNED_CONSEQUENCE}».`,
    );
  }
  const vacios = (['authorizedBy', 'reason', 'providerReportedModelId', 'probedAt'] as const).filter(
    (campo) => waiver[campo].trim() === '',
  );
  if (vacios.length > 0) {
    throw new UnpinnedBindingError(
      `La renuncia de identidad de ${subject} deja vacío ${vacios.join(', ')}. Una renuncia sin ` +
        `autor, sin motivo o sin constancia de haber preguntado al proveedor no es una decisión: ` +
        `es un modelo sin identificar.`,
    );
  }
  if (Number.isNaN(Date.parse(waiver.probedAt))) {
    throw new UnpinnedBindingError(
      `La renuncia de identidad de ${subject} trae un \`probedAt\` ilegible (${waiver.probedAt}).`,
    );
  }
}

export function assertBindingUsable(
  binding: ModelBinding,
  waiver?: UnpinnedIdentityWaiver,
): void {
  assertIdentityFixedOrWaived(
    binding.bindingId,
    `El binding ${binding.bindingId}`,
    binding,
    waiver,
  );

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
  waiver?: UnpinnedIdentityWaiver,
): AuthorizedParameters {
  assertBindingUsable(binding, waiver);

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
