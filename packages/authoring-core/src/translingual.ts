import { IncompleteTranslationTraceError, NliCalibrationPendingError } from './errors.js';

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

/** Estrato demostrado por `CAL-NLI`: par de idiomas + forma lógica relevante. */
export interface NliStratum {
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly logicalForm: string;
}

/**
 * Señal auxiliar del NLI. Se puede producir y registrar: lo que no se puede es
 * usarla como gate sin estrato demostrado.
 */
export interface NliSignal {
  readonly supportScore: number;
  readonly stratum: NliStratum;
  /** Siempre `false`: una señal auxiliar no es un veredicto. */
  readonly isVerdict: false;
}

export function nliSignal(supportScore: number, stratum: NliStratum): NliSignal {
  return { supportScore, stratum, isVerdict: false };
}

/**
 * Usar el NLI como **gate**. Falla cerrado (`CAL-NLI`, se congela en H5).
 *
 * Ningún estrato tiene fiabilidad demostrada todavía, así que no hay par de
 * idioma en el que el gate pueda habilitarse. Devolver aquí un booleano
 * convertiría un verificador estadístico en autoridad determinista, que es lo
 * que el Maestro descarta por su nombre.
 */
export function nliGate(signal: NliSignal): never {
  throw new NliCalibrationPendingError(
    `no hay estrato con fiabilidad demostrada para ` +
      `${signal.stratum.sourceLanguage}→${signal.stratum.targetLanguage} / ` +
      `${signal.stratum.logicalForm}; el NLI es verificador estadístico auxiliar, no autoridad ` +
      `determinista`,
    'H5 (CAL-NLI), estratificado por forma lógica',
  );
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
