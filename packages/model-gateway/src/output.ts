import type { ModelOutputClassification, ModelOutputEnvelope } from '@profesor-ia/contracts';
import type { ZodType } from 'zod';

/**
 * Validación local fail-closed de toda salida (T-H4-03 ← P-II §8.4).
 *
 * «La salida estructurada del proveedor **no es evidencia suficiente de
 * validez**»: toda respuesta cruza este validador, que es independiente del
 * proveedor. El tipo de retorno lo hace estructural — los datos solo son
 * alcanzables tras estrechar por `classification === 'valid'`, así que no hay
 * forma de leerlos sin haber mirado la clasificación.
 */

/**
 * Resultado del proveedor ya leído por su adaptador, antes de validar nada.
 *
 * Es intermedio y **normalizado**: cada proveedor nombra su motivo de parada a
 * su manera, y traducirlo es trabajo del adaptador. Lo que no hace el adaptador
 * es decidir si la salida es válida.
 */
/**
 * Unidades facturadas que el proveedor **reportó**. Opcional a propósito: si no
 * las reporta, el campo va ausente y nadie puede confundirlo con cero. Un cero
 * fabricado haría parecer el gasto menor del real, que es la misma razón por la
 * que `priceCall` lanza ante una tarifa que falta en vez de valorarla en cero.
 */
export interface ProviderUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Lectura de caché; ausente cuando el proveedor no la desglosa. */
  readonly cachedInputTokens?: number;
}

export type ProviderOutcome =
  | {
      readonly kind: 'output';
      readonly text: string;
      readonly rawStopReason: string;
      readonly usage?: ProviderUsage;
    }
  | {
      readonly kind: 'truncated';
      readonly text: string;
      readonly rawStopReason: string;
      readonly usage?: ProviderUsage;
    }
  | {
      readonly kind: 'refusal';
      readonly text: string;
      readonly rawStopReason: string;
      readonly usage?: ProviderUsage;
    }
  | {
      readonly kind: 'provider_error';
      readonly status: number;
      readonly body: string;
      readonly usage?: ProviderUsage;
    };

export type ValidatedOutput<T> =
  | {
      readonly classification: 'valid';
      readonly envelope: ModelOutputEnvelope;
      readonly data: T;
      /** Lo que el proveedor reportó haber facturado; ausente si no lo reporta. */
      readonly usage?: ProviderUsage;
    }
  | {
      readonly classification: Exclude<ModelOutputClassification, 'valid'>;
      readonly envelope: ModelOutputEnvelope;
      readonly data?: undefined;
      readonly usage?: ProviderUsage;
    };

/** Valor de enum canonicalizado, conservando el bruto para auditoría (P-II §8.4). */
export interface CanonicalEnumValue<T extends string> {
  readonly canonical: T;
  readonly raw: string;
}

export interface CanonicalizeEnumOptions {
  /**
   * Normalizar mayúsculas/minúsculas. P-II §8.4 lo permite **«cuando el
   * contrato lo autorice»**, así que es una decisión explícita de quien llama y
   * no un comportamiento por omisión: normalizar sin autorización aceptaría
   * valores que el contrato no admite.
   */
  readonly caseInsensitive: boolean;
}

/**
 * Canonicaliza un valor de enum del proveedor de forma determinista y conserva
 * el bruto. Devuelve `null` si no corresponde a ningún miembro: **no inventa**
 * uno ni elige el más parecido.
 */
export function canonicalizeEnum<T extends string>(
  raw: string,
  allowed: readonly T[],
  options: CanonicalizeEnumOptions,
): CanonicalEnumValue<T> | null {
  const candidato = options.caseInsensitive ? raw.trim().toLowerCase() : raw.trim();

  for (const miembro of allowed) {
    const comparable = options.caseInsensitive ? miembro.toLowerCase() : miembro;
    if (comparable === candidato) {
      return { canonical: miembro, raw };
    }
  }
  return null;
}

/**
 * Qué hacer con una salida envuelta en un bloque de código (T-H4-10).
 *
 * Los modelos devuelven con frecuencia JSON válido dentro de una valla
 * ```` ```json ````, y `JSON.parse` se atraganta con ella. Medido el 2026-08-18
 * en el piloto de BENCH-01: 14 de 14 respuestas de `claude-haiku-4-5-20251001`
 * traían JSON correcto envuelto, y reforzar la instrucción de formato **no** lo
 * corrigió.
 *
 * - `reject`: la valla es una violación de formato y se clasifica como tal.
 * - `unwrap`: se retira la valla antes de parsear.
 *
 * **Obligatorio y sin valor por omisión.** P-II §8.4 admite normalizar «cuando
 * el contrato lo autorice», así que la autorización tiene que estar escrita en
 * el sitio que llama, igual que `caseInsensitive` en `canonicalizeEnum`. Un
 * valor por omisión convertiría una decisión de contrato en un comportamiento
 * que nadie eligió, en la dirección que sea.
 */
export type CodeFencePolicy = 'reject' | 'unwrap';

export interface ValidateOutputInput<T> {
  readonly operation: ModelOutputEnvelope['operation'];
  readonly bindingId: string;
  readonly outcome: ProviderOutcome;
  readonly schema: ZodType<T>;
  readonly attempt: number;
  readonly codeFence: CodeFencePolicy;
}

/**
 * Retira una valla de bloque de código **completa**, o devuelve el texto igual.
 *
 * Conservadora a propósito: sólo actúa si el texto empieza y termina con la
 * valla. Recortar por dentro convertiría una respuesta con prosa alrededor en
 * un JSON aparentemente limpio, que es precisamente lo que el gate de salidas
 * estructuralmente utilizables debe seguir contando como fallo.
 */
export function stripCodeFence(texto: string): string {
  const limpio = texto.trim();
  if (!limpio.startsWith('```') || !limpio.endsWith('```')) return texto;

  const finPrimeraLinea = limpio.indexOf('\n');
  if (finPrimeraLinea === -1) return texto;

  // La primera línea es la apertura con su etiqueta opcional (```json).
  const apertura = limpio.slice(3, finPrimeraLinea).trim();
  if (/[^A-Za-z0-9_-]/.test(apertura)) return texto;

  return limpio.slice(finPrimeraLinea + 1, limpio.length - 3).trim();
}

/**
 * Clasifica y valida. El orden de las comprobaciones **es** el requisito:
 * truncamiento, rechazo y error de proveedor se deciden **antes** de mirar el
 * esquema, porque una respuesta truncada casi siempre falla también el esquema
 * y reportarla como `schema_violation` escondería la causa real — exactamente
 * lo que P-II §8.4 prohíbe («no se ocultan truncamientos o rechazos dentro de
 * "fallo de esquema"»).
 */
export function validateModelOutput<T>({
  operation,
  bindingId,
  outcome,
  schema,
  attempt,
  codeFence,
}: ValidateOutputInput<T>): ValidatedOutput<T> {
  const base = { operation, bindingId, attempt, canaryHits: [] as string[] };
  // El uso reportado se arrastra tal cual. Con `exactOptionalPropertyTypes`, ausente
  // es ausente: no se rellena con ceros que nadie midió.
  const usage = outcome.usage === undefined ? {} : { usage: outcome.usage };

  if (outcome.kind === 'provider_error') {
    return {
      classification: 'provider_error',
      envelope: { ...base, classification: 'provider_error', rawOutput: outcome.body },
      ...usage,
    };
  }

  if (outcome.kind === 'truncated') {
    return {
      classification: 'truncated',
      envelope: { ...base, classification: 'truncated', rawOutput: outcome.text },
      ...usage,
    };
  }

  if (outcome.kind === 'refusal') {
    return {
      classification: 'refusal',
      envelope: { ...base, classification: 'refusal', rawOutput: outcome.text },
      ...usage,
    };
  }

  // Solo aquí se mira el esquema, y el bruto se conserva pase lo que pase.
  const envelope = { ...base, classification: 'schema_violation' as const, rawOutput: outcome.text };

  // El bruto del `envelope` sigue siendo el texto tal cual llegó: desenvolver
  // es para poder parsear, no para reescribir lo que el proveedor dijo.
  const paraParsear = codeFence === 'unwrap' ? stripCodeFence(outcome.text) : outcome.text;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(paraParsear);
  } catch {
    return { classification: 'schema_violation', envelope, ...usage };
  }

  const resultado = schema.safeParse(parsedJson);
  if (!resultado.success) {
    return { classification: 'schema_violation', envelope, ...usage };
  }

  return {
    classification: 'valid',
    ...usage,
    envelope: { ...base, classification: 'valid', rawOutput: outcome.text },
    data: resultado.data,
  };
}
