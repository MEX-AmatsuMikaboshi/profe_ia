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
export type ProviderOutcome =
  | { readonly kind: 'output'; readonly text: string; readonly rawStopReason: string }
  | { readonly kind: 'truncated'; readonly text: string; readonly rawStopReason: string }
  | { readonly kind: 'refusal'; readonly text: string; readonly rawStopReason: string }
  | { readonly kind: 'provider_error'; readonly status: number; readonly body: string };

export type ValidatedOutput<T> =
  | { readonly classification: 'valid'; readonly envelope: ModelOutputEnvelope; readonly data: T }
  | {
      readonly classification: Exclude<ModelOutputClassification, 'valid'>;
      readonly envelope: ModelOutputEnvelope;
      readonly data?: undefined;
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

export interface ValidateOutputInput<T> {
  readonly operation: ModelOutputEnvelope['operation'];
  readonly bindingId: string;
  readonly outcome: ProviderOutcome;
  readonly schema: ZodType<T>;
  readonly attempt: number;
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
}: ValidateOutputInput<T>): ValidatedOutput<T> {
  const base = { operation, bindingId, attempt, canaryHits: [] as string[] };

  if (outcome.kind === 'provider_error') {
    return {
      classification: 'provider_error',
      envelope: { ...base, classification: 'provider_error', rawOutput: outcome.body },
    };
  }

  if (outcome.kind === 'truncated') {
    return {
      classification: 'truncated',
      envelope: { ...base, classification: 'truncated', rawOutput: outcome.text },
    };
  }

  if (outcome.kind === 'refusal') {
    return {
      classification: 'refusal',
      envelope: { ...base, classification: 'refusal', rawOutput: outcome.text },
    };
  }

  // Solo aquí se mira el esquema, y el bruto se conserva pase lo que pase.
  const envelope = { ...base, classification: 'schema_violation' as const, rawOutput: outcome.text };

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(outcome.text);
  } catch {
    return { classification: 'schema_violation', envelope };
  }

  const resultado = schema.safeParse(parsedJson);
  if (!resultado.success) {
    return { classification: 'schema_violation', envelope };
  }

  return {
    classification: 'valid',
    envelope: { ...base, classification: 'valid', rawOutput: outcome.text },
    data: resultado.data,
  };
}
