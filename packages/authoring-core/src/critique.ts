import { CritiqueError } from './errors.js';

/**
 * Rol E — crítico (T-H5-05, paso 8 de W3 ← P-II §5.2).
 *
 * Tres frases del Maestro gobiernan el módulo entero, y las tres son
 * restricciones sobre lo que el crítico **no** puede hacer:
 *
 * 1. «Antes de su veredicto, el crítico produce una justificación estructurada
 *    referida a criterios observables y evidencia disponible.»
 * 2. «Su veredicto no certifica. Produce señales para los filtros.»
 * 3. «El acuerdo global entre generador y crítico no se usa **por sí solo**
 *    como indicador de calidad.»
 *
 * De la segunda sale la forma del módulo: la crítica no entra en la decisión de
 * aceptación de W3, ni para aceptar ni para rechazar. Un `approve` que salvara
 * a un candidato rechazado por un validador determinista sería certificar; un
 * `reject` que tumbara a uno que los validadores aceptan también, solo que en
 * la dirección que parece prudente. Lo que la crítica sí hace es dejar señales
 * y marcar riesgo para el sobremuestreo de la auditoría previa (`T-H5-14`).
 */

/** Los seis criterios literales que evalúa Rol E (P-II §5.2). */
export const CRITIQUE_CRITERIA = [
  'claridad',
  'ambiguedad',
  'correspondencia_con_objetivo',
  'fuga',
  'sobreajuste_a_ejemplos',
  'consistencia_de_notacion',
] as const;
export type CritiqueCriterion = (typeof CRITIQUE_CRITERIA)[number];

export interface CritiqueFinding {
  readonly criterion: CritiqueCriterion;
  /** Qué se observa. Debe ser observable, no una impresión. */
  readonly observation: string;
  /** Evidencia disponible que la sostiene. */
  readonly evidence: string;
}

export type CritiqueVerdict = 'approve' | 'reject';

export interface ItemCritique {
  readonly itemId: string;
  /** Familia del modelo que criticó. */
  readonly criticModelFamily: string;
  /** Familia del modelo que generó el candidato (Rol C/D). */
  readonly generatorModelFamily: string;
  /** Justificación estructurada, **anterior** al veredicto. */
  readonly justification: readonly CritiqueFinding[];
  readonly verdict: CritiqueVerdict;
}

/**
 * Comprueba la forma de la crítica.
 *
 * La justificación se exige **no vacía** aunque el veredicto sea `approve`: la
 * norma la pide «antes de su veredicto», y un aprobado sin justificación no se
 * distingue de un aprobado por omisión. Cada hallazgo necesita observación y
 * evidencia, que es lo que lo hace auditable; sin evidencia sería una opinión
 * con formato de hallazgo.
 */
export function assertCritique(critique: ItemCritique): void {
  if (critique.justification.length === 0) {
    throw new CritiqueError(
      `La crítica de ${critique.itemId} no trae justificación estructurada. P-II §5.2 la exige ` +
        `**antes** del veredicto: sin ella, un «approve» no se distingue de no haber mirado.`,
    );
  }

  for (const hallazgo of critique.justification) {
    if (!(CRITIQUE_CRITERIA as readonly string[]).includes(hallazgo.criterion)) {
      throw new CritiqueError(
        `La crítica de ${critique.itemId} evalúa «${hallazgo.criterion}», que no es uno de los seis ` +
          `criterios de P-II §5.2. El crítico no amplía por su cuenta lo que evalúa.`,
      );
    }
    if (hallazgo.observation.trim() === '' || hallazgo.evidence.trim() === '') {
      throw new CritiqueError(
        `El hallazgo de ${hallazgo.criterion} en ${critique.itemId} no declara observación o ` +
          `evidencia. La justificación es «referida a criterios observables y evidencia ` +
          `disponible»: sin evidencia es una opinión con formato de hallazgo.`,
      );
    }
  }
}

export interface CriticIndependence {
  readonly independent: boolean;
  readonly reason: string;
}

/**
 * Independencia generativa (P-I §7.3, P-II §5.2): «C/D (generación) y E
 * (crítica generativa que participe en el gate de autoría) deben usar familias
 * distintas».
 *
 * **No lanza**, y es a propósito. La norma prevé el caso: «Si por
 * indisponibilidad temporal no puede cumplirse, el crítico se considera no
 * independiente y su acuerdo no puede usarse como evidencia de calidad para
 * congelar esa familia». Es decir: la misma familia no invalida la crítica,
 * invalida su uso como evidencia. Prohibirla aquí y permitir usarla después
 * sería peor que registrarlo.
 */
export function criticIndependence(critique: ItemCritique): CriticIndependence {
  const misma = critique.criticModelFamily === critique.generatorModelFamily;
  return Object.freeze({
    independent: !misma,
    reason: misma
      ? `crítico y generador comparten la familia ${critique.criticModelFamily}: el error ` +
        `correlacionado no se reduce y el acuerdo no es evidencia de calidad`
      : `familias distintas (${critique.generatorModelFamily} / ${critique.criticModelFamily})`,
  });
}

/**
 * Puerta para usar el acuerdo del crítico como evidencia al congelar una
 * familia. Falla cerrado cuando el crítico no es independiente.
 */
export function assertAgreementUsableAsEvidence(critique: ItemCritique): void {
  const independencia = criticIndependence(critique);
  if (!independencia.independent) {
    throw new CritiqueError(
      `El acuerdo del crítico sobre ${critique.itemId} no puede usarse como evidencia de calidad: ` +
        `${independencia.reason} (P-II §5.2).`,
    );
  }
}

export interface CritiqueQualityReport {
  readonly critiquesConsidered: number;
  /**
   * Acuerdo global generador↔crítico. Se calcula, pero **nunca va solo**: por
   * eso vive en el mismo informe que la tasa sobre defectuosos y junto a la
   * declaración de abajo.
   */
  readonly agreementRate: number;
  /**
   * Lo que P-II §5.2 pide «además»: tasa de aprobación del crítico sobre
   * candidatos que los validadores deterministas o el conjunto dorado
   * clasifican como defectuosos.
   *
   * `null` cuando no hubo ningún defectuoso. **No es 0**: un cero se leería
   * como «el crítico no aprobó ninguno de los defectuosos» cuando lo cierto es
   * que no se le presentó ninguno, que es la métrica que pasa por vacío.
   */
  readonly approvalRateOverDeterministicallyDefective: number | null;
  readonly defectiveConsidered: number;
  /** Recordatorio ejecutable de la prohibición: el acuerdo por sí solo no mide calidad. */
  readonly agreementAloneIsNotAQualityIndicator: true;
}

/**
 * Informe de calidad de la crítica.
 *
 * `deterministicallyDefectiveItemIds` es **obligatorio** —aunque sea vacío—
 * porque sin la clasificación determinista solo quedaría el acuerdo, que es lo
 * que la norma prohíbe usar solo. Pasar el conjunto es la forma de que el
 * llamante declare que la tiene.
 */
export function critiqueQualityReport(
  critiques: readonly ItemCritique[],
  deterministicallyDefectiveItemIds: readonly string[],
): CritiqueQualityReport {
  if (critiques.length === 0) {
    throw new CritiqueError(
      'No hay críticas que resumir. Un informe sobre cero críticas daría tasas de 0 o 1 que se ' +
        'leerían como medidas.',
    );
  }

  const defectuosos = new Set(deterministicallyDefectiveItemIds);
  const sobreDefectuosos = critiques.filter((c) => defectuosos.has(c.itemId));
  const aprobados = critiques.filter((c) => c.verdict === 'approve');

  return Object.freeze({
    critiquesConsidered: critiques.length,
    agreementRate: aprobados.length / critiques.length,
    approvalRateOverDeterministicallyDefective:
      sobreDefectuosos.length === 0
        ? null
        : sobreDefectuosos.filter((c) => c.verdict === 'approve').length / sobreDefectuosos.length,
    defectiveConsidered: sobreDefectuosos.length,
    agreementAloneIsNotAQualityIndicator: true,
  });
}

/**
 * Criterios sobre los que el crítico dejó algún hallazgo. Es la señal que W3
 * traslada a los filtros y al sobremuestreo de riesgo de `T-H5-14`, no un
 * veredicto: por eso son criterios y no una decisión.
 */
export function critiqueRiskFlags(critique: ItemCritique): readonly CritiqueCriterion[] {
  const vistos: CritiqueCriterion[] = [];
  for (const hallazgo of critique.justification) {
    if (!vistos.includes(hallazgo.criterion)) vistos.push(hallazgo.criterion);
  }
  return Object.freeze(vistos);
}
