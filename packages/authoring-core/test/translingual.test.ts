import { describe, expect, it } from 'vitest';
import {
  assertCompleteTranslationTrace,
  attributionTarget,
  IncompleteTranslationTraceError,
  NliCalibrationPendingError,
  nliGate,
  nliSignal,
  translingualReview,
  type NliStratum,
  type TranslationTrace,
} from '../src/index.js';

function rastro(overrides: Partial<TranslationTrace> = {}): TranslationTrace {
  return {
    sourceTextOriginal: 'Conjunction elimination lets you infer either conjunct.',
    sourceLocation: 'forall x: Calgary, cap. 15, p. 142',
    translatedText: 'La eliminación de la conjunción permite inferir cualquiera de los conyuntos.',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    translatorVersion: 'traductor-humano-2026-08',
    ...overrides,
  };
}

const ESTRATO: NliStratum = {
  sourceLanguage: 'en',
  targetLanguage: 'es',
  logicalForm: 'conjuncion',
};

describe('rastro de traducción (T-H45-08 ← DEC-LANGUAGE-001)', () => {
  it('exige los seis campos', () => {
    for (const campo of [
      'sourceTextOriginal',
      'sourceLocation',
      'translatedText',
      'sourceLanguage',
      'targetLanguage',
      'translatorVersion',
    ] as const) {
      expect(() =>
        assertCompleteTranslationTrace(rastro({ [campo]: '' } as Partial<TranslationTrace>)),
      ).toThrow(IncompleteTranslationTraceError);
    }
  });

  it('un rastro completo pasa', () => {
    expect(() => assertCompleteTranslationTrace(rastro())).not.toThrow();
  });

  it('mismo idioma origen y destino no es una traducción', () => {
    // Registrarlo como traducido ocultaría que el texto nunca se tradujo.
    expect(() =>
      assertCompleteTranslationTrace(rastro({ sourceLanguage: 'es', targetLanguage: 'es' })),
    ).toThrow(IncompleteTranslationTraceError);
  });
});

describe('la atribuibilidad se juzga contra el original', () => {
  it('devuelve siempre el texto original, no el traducido', () => {
    const r = rastro();

    expect(attributionTarget(r)).toBe(r.sourceTextOriginal);
    expect(attributionTarget(r)).not.toBe(r.translatedText);
  });

  it('no hay forma de elegir la traducción como objetivo', () => {
    // Es una función y no un campo elegible justamente para eso: juzgar contra
    // la traducción mediría si el traductor fue coherente consigo mismo, no si
    // la fuente dice lo que se le atribuye.
    const revision = translingualReview(rastro(), nliSignal(0.9, ESTRATO));

    expect(revision.attributionJudgedAgainst).toBe(rastro().sourceTextOriginal);
  });
});

describe('el NLI es señal auxiliar, no autoridad (CAL-NLI)', () => {
  it('una señal se puede producir y se marca como no veredicto', () => {
    const s = nliSignal(0.87, ESTRATO);

    expect(s.supportScore).toBe(0.87);
    expect(s.isVerdict).toBe(false);
  });

  it('usarla como gate falla cerrado, incluso con un score altísimo', () => {
    // Un 0.99 no habilita nada: ningún estrato tiene fiabilidad demostrada, y
    // devolver un booleano convertiría un verificador estadístico en autoridad
    // determinista.
    expect(() => nliGate(nliSignal(0.99, ESTRATO))).toThrow(NliCalibrationPendingError);
    expect(() => nliGate(nliSignal(1, ESTRATO))).toThrow(NliCalibrationPendingError);
  });

  it('el error nombra el estrato y dónde se congela', () => {
    try {
      nliGate(nliSignal(0.9, ESTRATO));
      expect.unreachable('debía fallar cerrado');
    } catch (error) {
      const mensaje = (error as Error).message;
      expect(mensaje).toContain('CAL-NLI');
      expect(mensaje).toContain('en→es');
      expect(mensaje).toContain('H5');
    }
  });

  it('mientras no haya gate, la revisión exige auditoría humana', () => {
    const revision = translingualReview(rastro(), nliSignal(0.95, ESTRATO));

    expect(revision.humanAuditRequired).toBe(true);
    expect(revision.nli.isVerdict).toBe(false);
  });

  it('la revisión no trae ningún campo que parezca un veredicto aprobado', () => {
    const revision = translingualReview(rastro(), nliSignal(0.95, ESTRATO)) as unknown as Record<
      string,
      unknown
    >;

    for (const campo of ['passed', 'approved', 'entailed', 'verified']) {
      expect(revision[campo]).toBeUndefined();
    }
  });
});
