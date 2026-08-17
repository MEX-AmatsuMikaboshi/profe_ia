import {
  GroundednessCalibrationError,
  IncompleteTranslationTraceError,
  NliCalibrationPendingError,
} from './errors.js';
import {
  requireDemonstratedNliStratum,
  type GroundednessCalibrationReport,
  type NliSignal,
  type NliStratum,
} from './groundedness-calibration.js';

export type { NliSignal, NliStratum } from './groundedness-calibration.js';

/**
 * Trazabilidad translingüe (T-H45-08 ← `DEC-LANGUAGE-001`, P-I §7.0).
 *
 * Dos reglas, y la segunda es la que evita el error caro:
 *
 * 1. Todo claim traducido conserva `source_text_original`, fragmento/ubicación,
 *    `translated_text`, idioma origen/destino y versión del traductor.
 * 2. **La atribuibilidad se juzga contra el fragmento original**, no contra la
 *    traducción. Juzgarla contra la traducción mediría si el traductor fue
 *    coherente consigo mismo, no si la fuente dice lo que se le atribuye.
 *
 * Y el NLI: es «verificador estadístico auxiliar, **no autoridad
 * determinista**». Solo puede actuar como gate en pares de idioma y estratos
 * cuya fiabilidad haya demostrado `CAL-NLI`, así que pedirle un veredicto de
 * gate falla cerrado.
 */

export interface TranslationTrace {
  readonly sourceTextOriginal: string;
  /** Fragmento/ubicación exacta dentro de la fuente. */
  readonly sourceLocation: string;
  readonly translatedText: string;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  /** Versión del traductor o modelo, cuando aplique. */
  readonly translatorVersion: string;
}

/** Un rastro incompleto no es trazabilidad: se rechaza. */
export function assertCompleteTranslationTrace(trace: TranslationTrace): void {
  const faltan = (
    [
      'sourceTextOriginal',
      'sourceLocation',
      'translatedText',
      'sourceLanguage',
      'targetLanguage',
      'translatorVersion',
    ] as const
  ).filter((campo) => (trace[campo] ?? '').trim() === '');

  if (faltan.length > 0) {
    throw new IncompleteTranslationTraceError(
      `Al claim traducido le faltan ${faltan.join(', ')}. Sin el original y su ubicación no se ` +
        `puede juzgar la atribuibilidad contra la fuente, que es contra lo que hay que juzgarla.`,
    );
  }

  if (trace.sourceLanguage === trace.targetLanguage) {
    throw new IncompleteTranslationTraceError(
      `El rastro declara ${trace.sourceLanguage} como origen y destino: no hay traducción que ` +
        `trazar, y registrarlo como traducido ocultaría que el texto nunca se tradujo.`,
    );
  }
}

/**
 * El texto contra el que se juzga la atribuibilidad. Devuelve **siempre** el
 * original: es una función y no un campo elegible para que no exista la opción
 * de juzgar contra la traducción.
 */
export function attributionTarget(trace: TranslationTrace): string {
  assertCompleteTranslationTrace(trace);
  return trace.sourceTextOriginal;
}

export function nliSignal(
  supportScore: number,
  stratum: NliStratum,
  modelBinding: string,
): NliSignal {
  if (!Number.isFinite(supportScore) || supportScore < 0 || supportScore > 1) {
    throw new GroundednessCalibrationError('supportScore debe estar en [0,1].');
  }
  if (modelBinding.trim() === '') {
    throw new GroundednessCalibrationError('modelBinding es obligatorio para una señal NLI.');
  }
  return { supportScore, stratum, modelBinding, isVerdict: false };
}

export interface NliGateScreening {
  readonly passesCalibratedAuxiliaryGate: boolean;
  readonly threshold: number;
  readonly stratumId: string;
  /** El NLI filtra; no emite el veredicto final de groundedness. */
  readonly isVerdict: false;
  readonly independentGroundednessDecisionRequired: true;
}

/**
 * Usar el NLI como **gate**. Falla cerrado (`CAL-NLI`, se congela en H5).
 *
 * Sin un reporte material el gate permanece cerrado. Con reporte, exige el
 * binding y estrato completos y sólo devuelve un filtro auxiliar: nunca un
 * veredicto de groundedness, que convertiría un clasificador estadístico en la
 * autoridad determinista que el Maestro descarta.
 */
export function nliGate(
  signal: NliSignal,
  report?: GroundednessCalibrationReport,
): NliGateScreening {
  if (report === undefined) {
    throw new NliCalibrationPendingError(
      `no hay estrato con fiabilidad demostrada para ` +
        `${signal.stratum.sourceLanguage}→${signal.stratum.targetLanguage} / ` +
        `${signal.stratum.logicalForm}; el NLI es verificador estadístico auxiliar, no autoridad ` +
        `determinista`,
      'H5 (CAL-NLI), estratificado por forma lógica/KC/idioma',
    );
  }
  requireDemonstratedNliStratum(report, signal);
  return Object.freeze({
    passesCalibratedAuxiliaryGate: signal.supportScore >= report.decisionThreshold,
    threshold: report.decisionThreshold,
    stratumId: signal.stratum.stratumId,
    isVerdict: false,
    independentGroundednessDecisionRequired: true,
  });
}

/**
 * Qué hacer mientras el gate no exista: señal auxiliar **y** auditoría humana.
 * Se devuelve como requisito explícito para que nadie lo lea como «pasó el NLI».
 */
export interface TranslingualReview {
  readonly trace: TranslationTrace;
  readonly attributionJudgedAgainst: string;
  readonly nli: NliSignal;
  readonly humanAuditRequired: true;
}

export function translingualReview(trace: TranslationTrace, nli: NliSignal): TranslingualReview {
  return {
    trace,
    attributionJudgedAgainst: attributionTarget(trace),
    nli,
    humanAuditRequired: true,
  };
}
