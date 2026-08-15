import type { ModelBinding } from '@profesor-ia/contracts';
import { ModalityNotEligibleError } from './errors.js';

/**
 * Elegibilidad de batch y caching (T-H4-08 ← P-II §8.4).
 *
 * «Batch y caching son capacidades explícitas de `ModelCapabilities`, no
 * optimizaciones transparentes.» De ahí que nada aquí se active solo: una
 * modalidad se usa cuando el binding la declara **y** la clasificación de datos
 * de la operación lo permite.
 */

/**
 * Clasificación de datos de la operación.
 *
 * §8.4 traza **una sola** distinción —«el tráfico de sesión con datos del
 * participante»— y ninguna autoridad enumera más clases. Se implementa esa y no
 * una taxonomía inventada: una clasificación fabricada daría permisos con
 * granularidad que nadie ha autorizado.
 */
export const DATA_CLASSIFICATIONS = [
  'con_datos_de_participante',
  'sin_datos_de_participante',
] as const;
export type DataClassification = (typeof DATA_CLASSIFICATIONS)[number];

export const MODALITIES = ['batch', 'caching'] as const;
export type Modality = (typeof MODALITIES)[number];

export interface EligibilityInput {
  readonly binding: ModelBinding;
  readonly modality: Modality;
  readonly dataClassification: DataClassification;
  /**
   * Retención máxima en días que el freeze admite para datos de participante.
   * Se pasa desde fuera porque el freeze aún no está congelado: fijar aquí un
   * número decidiría por cuenta propia qué retención es aceptable.
   */
  readonly maxRetentionDaysAtFreeze: number;
}

export interface EligibilityVerdict {
  readonly eligible: boolean;
  readonly reason: string;
}

function declarada(binding: ModelBinding, modality: Modality): boolean {
  return modality === 'batch'
    ? binding.capabilities.batch.supported
    : binding.capabilities.caching.supported;
}

/**
 * Decide si una modalidad puede atender una operación. **Lo desconocido no es
 * permiso**: una política de datos sin retención declarada o con elegibilidad
 * contractual `unknown` no habilita tráfico de participante, porque «no consta»
 * y «consta que se puede» no son lo mismo.
 */
export function checkModalityEligibility(input: EligibilityInput): EligibilityVerdict {
  const { binding, modality, dataClassification, maxRetentionDaysAtFreeze } = input;

  if (!declarada(binding, modality)) {
    return {
      eligible: false,
      reason: `El binding ${binding.bindingId} no declara ${modality} como capacidad soportada.`,
    };
  }

  if (dataClassification === 'sin_datos_de_participante') {
    return { eligible: true, reason: `${modality} declarada y sin datos de participante.` };
  }

  const { dataPolicy } = binding.capabilities;

  if (dataPolicy.contractualEligibility !== 'enabled') {
    return {
      eligible: false,
      reason:
        `La elegibilidad contractual del binding ${binding.bindingId} es ` +
        `${dataPolicy.contractualEligibility}, no 'enabled'. El tráfico con datos de participante ` +
        `no se enruta a una modalidad cuya elegibilidad contradiga el freeze (P-II §8.4); ` +
        `«no consta» no es «consta que se puede».`,
    };
  }

  const retencion = dataPolicy.zeroDataRetention === true ? 0 : dataPolicy.loggingRetentionDays;
  if (retencion === undefined) {
    return {
      eligible: false,
      reason:
        `El binding ${binding.bindingId} no declara retención. Sin ese dato no se puede afirmar ` +
        `que no contradice el freeze, y lo desconocido no es permiso.`,
    };
  }

  if (retencion > maxRetentionDaysAtFreeze) {
    return {
      eligible: false,
      reason:
        `La retención declarada (${retencion} d) supera la que admite el freeze ` +
        `(${maxRetentionDaysAtFreeze} d) para datos de participante.`,
    };
  }

  return {
    eligible: true,
    reason: `${modality} declarada, elegibilidad 'enabled' y retención ${retencion} d dentro del freeze.`,
  };
}

/** Igual, pero aborta. Es la vía por omisión: una modalidad no elegible no se usa. */
export function assertModalityEligible(input: EligibilityInput): void {
  const verdict = checkModalityEligibility(input);
  if (!verdict.eligible) {
    throw new ModalityNotEligibleError(verdict.reason);
  }
}

/**
 * Telemetría de caché que va al `cost-ledger` (§8.4: «hits/misses, TTL cuando se
 * conozca, tokens cacheados y costo»).
 *
 * `ttlSeconds` es opcional **a propósito**: la norma dice «cuando se conozca», y
 * un cero por omisión afirmaría que no hay caché cuando lo cierto es que no se
 * sabe cuánto dura.
 */
export interface CacheTelemetry {
  readonly hits: number;
  readonly misses: number;
  readonly cachedTokens: number;
  readonly ttlSeconds?: number;
}

export function cacheTelemetryFor(binding: ModelBinding, observed: {
  readonly hits: number;
  readonly misses: number;
  readonly cachedTokens: number;
}): CacheTelemetry {
  const ttl = binding.capabilities.caching.ttlSeconds;
  return ttl === undefined ? { ...observed } : { ...observed, ttlSeconds: ttl };
}
