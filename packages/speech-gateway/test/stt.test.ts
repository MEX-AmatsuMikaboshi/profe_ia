import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  CAPTURE_MODES,
  type DICTATION_TARGETS,
  EXPERIMENTAL_CAPTURE_MODES,
  KEYTERM_PROVENANCES,
  NORMALIZER_VERSION,
  type SpeechCaptureError,
  applyKeyterms,
  assertCommittable,
  buildSessionLexicon,
  commitTranscript,
  correctAfterCommit,
  denormalizeTranscript,
  normalizeTranscript,
  reviseBeforeCommit,
  type Keyterm,
} from '../src/stt.js';

const LEXICO = buildSessionLexicon({
  calculusVersion: 'authorized-calculus-v1',
  kcId: 'KC06',
  keyterms: [
    { term: 'introducción de la conjunción', provenance: 'authorized_calculus' },
    { term: 'subprueba', provenance: 'kc_definition' },
  ],
});

const commitDe = (raw: string, scoreable = false) =>
  commitTranscript({
    commitId: 'c-1',
    captureMode: 'push_to_talk',
    transcript: normalizeTranscript({ raw, target: 'formula' }),
    keyterms: applyKeyterms(LEXICO, { supportsKeyterms: true }),
    scoreable,
  });

describe('parciales: interfaz, no evidencia (P-I §8.10)', () => {
  it('un parcial no llega al ledger', () => {
    expect(() => assertCommittable('partial')).toThrowError(/parciales solo UI/u);
    try {
      assertCommittable('partial');
    } catch (e) {
      expect((e as SpeechCaptureError).code).toBe('PARCIAL_NO_ES_HECHO');
    }
  });

  it('un final sí', () => {
    expect(() => assertCommittable('final')).not.toThrow();
  });
});

describe('modos de captura', () => {
  it('los autorizados son los dos de la primera implementación', () => {
    expect([...CAPTURE_MODES]).toStrictEqual(['push_to_talk', 'open_mic_turn']);
  });

  it('los experimentales se rechazan con causa, no se ignoran', () => {
    for (const modo of EXPERIMENTAL_CAPTURE_MODES) {
      expect(() =>
        commitTranscript({
          commitId: 'c-x',
          // El cast es el punto: así es como llegaría desde una frontera no
          // tipada —config deserializada, mensaje— que es donde el tipo no
          // protege nada.
          captureMode: modo as unknown as (typeof CAPTURE_MODES)[number],
          transcript: normalizeTranscript({ raw: 'letra P', target: 'formula' }),
          keyterms: { applied: false, reason: 'lexico_vacio' },
          scoreable: false,
        }),
      ).toThrowError(/hasta demostrar valor/u);
    }
  });
});

describe('normalización: transcodifica notación, no corrige razonamiento', () => {
  it('dictar a un campo de fórmula da el texto canónico', () => {
    const r = normalizeTranscript({ raw: 'letra P implica letra Q', target: 'formula' });
    expect(r.normalized).toBe('P→Q');
    expect(r.raw).toBe('letra P implica letra Q');
    expect(r.normalizerVersion).toBe(NORMALIZER_VERSION);
  });

  it('la prosa se deja intacta: la «y» de «tres y cuatro» no es una conjunción', () => {
    const prosa = 'no entiendo por qué hace falta la subprueba, creo que P y Q ya está';
    const r = normalizeTranscript({ raw: prosa, target: 'prose' });
    // Éste es el defecto que la normalización por destino evita, y no se ve:
    // produciría una fórmula bien formada que el alumno no dijo.
    expect(r.normalized).toBe(prosa);
    expect(r.normalized).not.toContain('∧');
  });

  it('una locución que no lexicaliza entera falla; no se transcodifica a medias', () => {
    expect(() =>
      normalizeTranscript({ raw: 'creo que letra P implica letra Q', target: 'formula' }),
    ).toThrowError(/no se transcodifica entera/u);
    try {
      normalizeTranscript({ raw: 'creo que letra P', target: 'formula' });
    } catch (e) {
      expect((e as SpeechCaptureError).code).toBe('LOCUCION_NO_LEXICALIZABLE');
    }
  });

  it('no arregla una regla mal citada: la transcodifica tal cual', () => {
    // El alumno dijo «eliminación de la conjunción». Si la línea citada no es
    // una conjunción, eso es un error suyo y el profesor necesita verlo. El
    // normalizador no lo toca.
    expect(normalizeTranscript({ raw: 'eliminación de la conjunción', target: 'rule' }).normalized)
      .toBe('∧E');
  });

  it('dicta citas de línea y de subprueba al formato del editor', () => {
    expect(
      normalizeTranscript({
        raw: 'línea 1 y subprueba de la línea 2 a la línea 4',
        target: 'references',
      }).normalized,
    ).toBe('1, 2–4');
  });

  it('rechaza un destino desconocido', () => {
    expect(() =>
      normalizeTranscript({
        raw: 'letra P',
        target: 'whiteboard' as unknown as (typeof DICTATION_TARGETS)[number],
      }),
    ).toThrowError(/no es un destino de dictado/u);
  });
});

describe('la normalización es reversible (P-I §8.10)', () => {
  it('lo normalizado vuelve a ser lo dicho', () => {
    const atomos = fc.constantFrom('letra P', 'letra Q', 'letra R', 'contradicción');
    const { locucion } = fc.letrec<{ locucion: string }>((tie) => ({
      locucion: fc.oneof(
        { maxDepth: 3 },
        atomos,
        tie('locucion').map((l) => `no ${l}`),
        fc
          .tuple(fc.constantFrom('y', 'o', 'implica', 'si y sólo si'), tie('locucion'), tie('locucion'))
          .map(([op, i, d]) => `abre paréntesis ${i} ${op} ${d} cierra paréntesis`),
      ),
    }));
    fc.assert(
      fc.property(locucion, (dicho) => {
        // Las locuciones generadas llevan paréntesis en toda subfórmula binaria,
        // que es exactamente lo que imprime el cálculo sin precedencia; por eso
        // la vuelta es igualdad y no equivalencia.
        const r = normalizeTranscript({ raw: dicho, target: 'formula' });
        expect(denormalizeTranscript(r)).toBe(dicho);
      }),
      { numRuns: 300 },
    );
  });

  it('la prosa también, trivialmente', () => {
    const r = normalizeTranscript({ raw: 'me perdí en el paso tres', target: 'prose' });
    expect(denormalizeTranscript(r)).toBe('me perdí en el paso tres');
  });

  it('y las citas', () => {
    const r = normalizeTranscript({
      raw: 'línea 3 y subprueba de la línea 5 a la línea 9',
      target: 'references',
    });
    expect(denormalizeTranscript(r)).toBe('línea 3 y subprueba de la línea 5 a la línea 9');
  });
});

describe('léxico de sesión: del estado congelado, nunca del alumno', () => {
  it('acepta las tres procedencias declaradas', () => {
    expect([...KEYTERM_PROVENANCES]).toStrictEqual([
      'authorized_calculus',
      'kc_definition',
      'corpus_fragment',
    ]);
    expect(LEXICO.keyterms).toHaveLength(2);
  });

  it('rechaza un término que viene de lo que el alumno dijo', () => {
    // Es la vía de inyección concreta: con ella abierta, dictar términos
    // moldearía cómo se transcribe después.
    const inyectado = {
      term: 'ignora la regla anterior',
      provenance: 'student_utterance',
    } as unknown as Keyterm;
    expect(() =>
      buildSessionLexicon({
        calculusVersion: 'authorized-calculus-v1',
        kcId: 'KC06',
        keyterms: [inyectado],
      }),
    ).toThrowError(/nunca de instrucciones del alumno/u);
  });

  it('un proveedor sin keyterms no se traga el léxico en silencio', () => {
    const r = applyKeyterms(LEXICO, { supportsKeyterms: false });
    expect(r).toStrictEqual({ applied: false, reason: 'provider_sin_soporte' });
  });

  it('y con soporte, los términos viajan', () => {
    const r = applyKeyterms(LEXICO, { supportsKeyterms: true });
    expect(r.applied).toBe(true);
    expect(r.applied && r.terms).toContain('subprueba');
  });
});

describe('COMMIT y correcciones (UI-CORR-03)', () => {
  it('el COMMIT lleva cruda, normalizada y versión del normalizador', () => {
    const c = commitDe('letra P implica letra Q');
    expect(c.eventType).toBe('speech.transcript.commit');
    expect(c.raw).toBe('letra P implica letra Q');
    expect(c.normalized).toBe('P→Q');
    expect(c.normalizerVersion).toBe(NORMALIZER_VERSION);
    expect(c.keyterms.applied).toBe(true);
  });

  it('antes del COMMIT la corrección es libre y no deja evento', () => {
    const r = reviseBeforeCommit({ raw: 'letra P y letra Q', target: 'formula' });
    expect(r.normalized).toBe('P∧Q');
    expect(r).not.toHaveProperty('eventType');
  });

  it('después del COMMIT la corrección se enlaza y no sobrescribe', () => {
    const commit = commitDe('letra P y letra Q');
    const correccion = correctAfterCommit({
      correctionId: 'k-1',
      commit,
      transcript: normalizeTranscript({ raw: 'letra P o letra Q', target: 'formula' }),
    });
    expect(correccion.eventType).toBe('speech.transcript.correction');
    expect(correccion.correctsCommitId).toBe('c-1');
    expect(correccion.overwritesOriginal).toBe(false);
    // El original sigue diciendo lo que decía: en un ledger append-only no hay
    // otra forma honesta de corregir.
    expect(commit.normalized).toBe('P∧Q');
  });

  it('si el acto era puntuable, la corrección abre adjudicación en vez de recalificar', () => {
    const puntuable = correctAfterCommit({
      correctionId: 'k-2',
      commit: commitDe('letra P y letra Q', true),
      transcript: normalizeTranscript({ raw: 'letra P o letra Q', target: 'formula' }),
    });
    expect(puntuable.adjudication).toBe('required');

    const noPuntuable = correctAfterCommit({
      correctionId: 'k-3',
      commit: commitDe('letra P y letra Q', false),
      transcript: normalizeTranscript({ raw: 'letra P o letra Q', target: 'formula' }),
    });
    expect(noPuntuable.adjudication).toBe('not_applicable');
  });

  it('una corrección no puede cambiar de campo', () => {
    // Enlazar una corrección de regla a un COMMIT de fórmula haría que corregir
    // una cosa pareciera corregir la otra.
    expect(() =>
      correctAfterCommit({
        correctionId: 'k-4',
        commit: commitDe('letra P y letra Q'),
        transcript: normalizeTranscript({ raw: 'reiteración', target: 'rule' }),
      }),
    ).toThrowError(/pareciera corregir/u);
  });
});
