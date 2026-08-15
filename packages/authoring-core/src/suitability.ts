import { SaturationCalibrationPendingError, SuitabilityCalibrationPendingError } from './errors.js';

/**
 * Idoneidad de fuentes y regla de parada
 * (T-H45-04 ← P-I §7.0, `CAL-SOURCE-SCORE` y `CAL-SATURATION`).
 *
 * §7.0 permite calcular un `source_suitability_score` con seis variables
 * observables, pero dice que «pesos y umbrales **se calibran en H4.5 con el
 * corpus real**». Así que aquí se mide lo medible y **falla cerrado** todo lo
 * que exija un peso o un umbral, igual que `complexityIndex()`.
 *
 * Y una frase que conviene no perder de vista: los scores «**no son
 * probabilidades de verdad**». Un 0.9 no dice que la fuente tenga razón nueve de
 * cada diez veces; ordena candidatos, nada más.
 */

/** Las seis variables observables literales. La licencia **no** está aquí. */
export const SUITABILITY_DIMENSIONS = [
  'autoridad',
  'revision',
  'estabilidad',
  'explicitud',
  'verificabilidad',
  'cobertura',
] as const;
export type SuitabilityDimension = (typeof SUITABILITY_DIMENSIONS)[number];

export type SuitabilityObservations = Readonly<Record<SuitabilityDimension, number>>;

/**
 * La licencia es un **gate separado** (§7.0): no entra en el score.
 *
 * No es un detalle de organización. Si la licencia pesara dentro del score, una
 * fuente jurídicamente inutilizable podría compensar con autoridad y cobertura y
 * salir mejor ordenada que una utilizable — y el orden es lo que decide qué se
 * mira primero.
 */
export const LICENSE_IS_SEPARATE_GATE = true as const;

/**
 * Agrega las seis observaciones en un escalar. **Falla cerrado**: los pesos se
 * congelan en H4.5 con el corpus real, y devolver un número con pesos iguales
 * inventados daría un orden de candidatos que parecería medido y no lo sería.
 * Este punto de fallo es donde se enchufa el vector congelado.
 */
export function suitabilityScore(observations: SuitabilityObservations): never {
  throw new SuitabilityCalibrationPendingError(
    `los pesos de las ${Object.keys(observations).length} variables observables no están ` +
      `congelados; agregar con pesos inventados daría un orden que parecería medido`,
    'H4.5, con el corpus real',
  );
}

/**
 * Ordena dos candidatos por idoneidad. Falla por la misma razón: comparar exige
 * los mismos pesos que agregar, y un orden inventado es tan falso como un
 * número inventado.
 */
export function compareSuitability(
  a: SuitabilityObservations,
  b: SuitabilityObservations,
): never {
  throw new SuitabilityCalibrationPendingError(
    `no hay pesos con los que ordenar los dos candidatos (${Object.keys(a).length} y ` +
      `${Object.keys(b).length} observaciones); un orden inventado es tan falso como un número ` +
      `inventado`,
    'H4.5, con el corpus real',
  );
}

/** Una ronda de descubrimiento, con lo hallado y el linaje de cada hallazgo. */
export interface DiscoveryRound {
  readonly round: number;
  /** Candidatos nuevos —no vistos antes— hallados en esta ronda. */
  readonly newItems: number;
  /** Candidatos totales revisados en la ronda. */
  readonly reviewedItems: number;
  /** Linaje de cada hallazgo: obra/edición de la que desciende. */
  readonly lineages: readonly string[];
}

export interface NewInformationPoint {
  readonly round: number;
  readonly newItems: number;
  /** Fracción de novedad de la ronda; 0 cuando no se revisó nada. */
  readonly newFraction: number;
}

/**
 * Curva de información nueva. **Sí se puede calcular**: es una medición, no un
 * umbral. Lo que no se puede es decidir con ella cuándo parar.
 */
export function newInformationCurve(
  rounds: readonly DiscoveryRound[],
): readonly NewInformationPoint[] {
  return Object.freeze(
    [...rounds]
      .sort((a, b) => a.round - b.round)
      .map(({ round, newItems, reviewedItems }) => ({
        round,
        newItems,
        newFraction: reviewedItems === 0 ? 0 : newItems / reviewedItems,
      })),
  );
}

export interface LineageDiversity {
  readonly distinctLineages: number;
  readonly totalFindings: number;
  /** Linajes distintos por hallazgo; 1 = cada hallazgo de un linaje distinto. */
  readonly diversityRatio: number;
}

/**
 * Diversidad de linaje. Importa porque veinte hallazgos que descienden todos de
 * la misma obra **no son veinte fuentes**: la saturación mediría agotamiento
 * cuando lo que hubo fue endogamia.
 */
export function lineageDiversity(rounds: readonly DiscoveryRound[]): LineageDiversity {
  const todos = rounds.flatMap((r) => r.lineages);
  const distintos = new Set(todos).size;

  return {
    distinctLineages: distintos,
    totalFindings: todos.length,
    diversityRatio: todos.length === 0 ? 0 : distintos / todos.length,
  };
}

/**
 * Decide si parar de descubrir. **Falla cerrado**: tamaño base, racha y umbral
 * de información nueva son los tres parámetros que §7.0 manda calibrar con el
 * corpus real.
 *
 * Es el punto que más tienta a inventar —«paro tras tres rondas sin novedad»
 * suena razonable—, y por eso el que más importa que falle: una parada
 * prematura cierra el corpus antes de tiempo y una tardía quema presupuesto,
 * y ninguna de las dos se notaría mirando el resultado.
 */
export function shouldStopDiscovery(rounds: readonly DiscoveryRound[]): never {
  throw new SaturationCalibrationPendingError(
    `tamaño base, racha y umbral de información nueva sin congelar; con ${rounds.length} ronda(s) ` +
      `observadas no hay criterio con el que decidir la parada`,
    'H4.5, con el corpus real',
  );
}

export interface SaturationReport {
  readonly curve: readonly NewInformationPoint[];
  readonly diversity: LineageDiversity;
  /** Siempre `false`: la parada no está calibrada y no se afirma que lo esté. */
  readonly stopDecisionAvailable: false;
}

/**
 * Informe de saturación: la parte medible, y la declaración explícita de que la
 * decisión de parar **no** está disponible. Un informe que omitiera ese campo se
 * leería como si la parada estuviera resuelta.
 */
export function saturationReport(rounds: readonly DiscoveryRound[]): SaturationReport {
  return {
    curve: newInformationCurve(rounds),
    diversity: lineageDiversity(rounds),
    stopDecisionAvailable: false,
  };
}
