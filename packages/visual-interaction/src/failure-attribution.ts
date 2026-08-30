/**
 * Clasificación de fallos con evidencia (T-H8-07 ← `DEC-FAILURE-ATTRIBUTION-001`,
 * P-I §8.9.3).
 *
 * ## Qué decide esto, y por qué importa tanto
 *
 * Cuando un alumno «falla», hay cuatro cosas distintas que pueden haber pasado, y
 * sólo una de ellas dice algo sobre lo que sabe:
 *
 * | Clase | Qué falló | ¿Cuenta como fallo de KC? |
 * |---|---|---|
 * | `PERCEPTION_ERROR` | el sistema leyó mal lo que el alumno hizo | **no** |
 * | `INTERFACE_ERROR` | la interfaz no dejó hacer lo que quería | **no** |
 * | `ACCESSIBILITY_ERROR` | una barrera de acceso lo impidió | **no** |
 * | `CONCEPTUAL_ERROR` | el alumno se equivocó | **sí** |
 *
 * Contar un `PERCEPTION_ERROR` como fallo de KC mide la calidad de nuestro OCR y
 * la anota como si fuera conocimiento del alumno. Es la forma más silenciosa de
 * arruinar una medida, porque el número sale, parece razonable y está mal.
 *
 * ## La regla de residuo, y por qué se hace cumplir con datos
 *
 * `CONCEPTUAL_ERROR` sólo se puede declarar **descartadas las otras tres**. Aquí
 * eso no es una recomendación: `classifyFailure()` exige la evidencia de los tres
 * descartes y **lanza** si falta alguno. Sin esa exigencia, «conceptual» sería el
 * cajón por omisión de todo lo que nadie miró — y por omisión es justo la clase
 * que no debe ganar.
 *
 * ## Y el tercer estado, que no es una cuarta clase
 *
 * `pending_audit` es legítimo (P-I §8.9.3): cuando no se puede descartar,
 * **dejarlo pendiente es mejor que adivinar**. Un intento pendiente no consume
 * intento elegible tampoco, porque todavía no se sabe si el alumno falló.
 */

export const FAILURE_CLASSES = [
  'PERCEPTION_ERROR',
  'INTERFACE_ERROR',
  'ACCESSIBILITY_ERROR',
  'CONCEPTUAL_ERROR',
] as const;
export type FailureClass = (typeof FAILURE_CLASSES)[number];

/** Las tres que hay que descartar antes de poder decir «conceptual». */
export const NON_CONCEPTUAL_CLASSES = [
  'PERCEPTION_ERROR',
  'INTERFACE_ERROR',
  'ACCESSIBILITY_ERROR',
] as const;
export type NonConceptualClass = (typeof NON_CONCEPTUAL_CLASSES)[number];

/**
 * El descarte de una clase, **con su evidencia**.
 *
 * `ruledOut: true` sin `evidence` no se admite: un descarte sin constancia es
 * indistinguible de no haber mirado, y toda la regla de residuo se apoya en que
 * se haya mirado.
 */
export interface Ruling {
  readonly ruledOut: boolean;
  readonly evidence: string;
}

export interface FailureObservation {
  readonly attemptId: string;
  /** Evidencia por clase no conceptual. Las tres son obligatorias. */
  readonly rulings: Readonly<Record<NonConceptualClass, Ruling>>;
}

export type FailureAttribution =
  | {
      readonly outcome: 'attributed';
      readonly failureClass: FailureClass;
      /** Sólo `CONCEPTUAL_ERROR` cuenta como fallo del KC (P-I §8.9.3). */
      readonly countsAsKcFailure: boolean;
      /** Sólo un fallo conceptual consume intento elegible para dominio. */
      readonly consumesEligibleAttempt: boolean;
      readonly rationale: string;
    }
  | {
      readonly outcome: 'pending_audit';
      readonly unresolved: readonly NonConceptualClass[];
      readonly countsAsKcFailure: false;
      readonly consumesEligibleAttempt: false;
      readonly rationale: string;
    };

export class FailureAttributionError extends Error {
  readonly code: 'DESCARTE_SIN_EVIDENCIA' | 'CLASE_DESCONOCIDA';

  constructor(code: 'DESCARTE_SIN_EVIDENCIA' | 'CLASE_DESCONOCIDA', detail: string) {
    super(detail);
    this.name = 'FailureAttributionError';
    this.code = code;
  }
}

/**
 * Atribuye el fallo.
 *
 * El orden importa: si alguna de las tres no conceptuales **no** está descartada,
 * ésa es la atribución —y si hay varias sin descartar, queda pendiente, porque
 * elegir una de ellas sería adivinar—. Sólo con las tres descartadas se llega a
 * `CONCEPTUAL_ERROR`.
 */
export function classifyFailure(observation: FailureObservation): FailureAttribution {
  for (const clase of NON_CONCEPTUAL_CLASSES) {
    const ruling = observation.rulings[clase];
    if (ruling === undefined) {
      throw new FailureAttributionError(
        'DESCARTE_SIN_EVIDENCIA',
        `el intento ${observation.attemptId} no trae dictamen para ${clase}. Sin los tres, ` +
          `«conceptual» sería el cajón por omisión de todo lo que nadie miró.`,
      );
    }
    if (ruling.ruledOut && ruling.evidence.trim() === '') {
      throw new FailureAttributionError(
        'DESCARTE_SIN_EVIDENCIA',
        `${clase} se declara descartada sin evidencia en el intento ${observation.attemptId}. Un ` +
          `descarte sin constancia es indistinguible de no haber mirado.`,
      );
    }
  }

  const sinDescartar = NON_CONCEPTUAL_CLASSES.filter((c) => !observation.rulings[c].ruledOut);

  if (sinDescartar.length === 1) {
    const clase = sinDescartar[0] as NonConceptualClass;
    return {
      outcome: 'attributed',
      failureClass: clase,
      // Las tres no conceptuales **no** cuentan como fallo de KC ni consumen
      // intento: miden el sistema, no al alumno.
      countsAsKcFailure: false,
      consumesEligibleAttempt: false,
      rationale: `${clase} no descartada: ${observation.rulings[clase].evidence}`,
    };
  }

  if (sinDescartar.length > 1) {
    // Varias abiertas: elegir una sería adivinar. Pendiente es legítimo.
    return {
      outcome: 'pending_audit',
      unresolved: sinDescartar,
      countsAsKcFailure: false,
      consumesEligibleAttempt: false,
      rationale:
        `quedan ${String(sinDescartar.length)} clases sin descartar (${sinDescartar.join(', ')}); ` +
        `elegir una sería adivinar, y P-I §8.9.3 admite dejarlo pendiente para auditoría`,
    };
  }

  return {
    outcome: 'attributed',
    failureClass: 'CONCEPTUAL_ERROR',
    countsAsKcFailure: true,
    consumesEligibleAttempt: true,
    rationale:
      'descartadas percepción, interfaz y accesibilidad con evidencia; el residuo es conceptual',
  };
}
