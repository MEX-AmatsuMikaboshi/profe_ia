/**
 * STT: captura, transcripción y `COMMIT` (T-H8-01 ← P-I §8.10, UI-CORR-03;
 * `DEC-VOICE-001`).
 *
 * ## El hecho es el `COMMIT`, y sólo el `COMMIT`
 *
 * Un STT en streaming emite parciales cada pocos milisegundos: «la re», «la
 * regla», «la regla de intro»… Registrarlos sería registrar el titubeo del
 * micrófono como si fuera trabajo del alumno, en un ledger que **no se puede
 * limpiar después**. P-I §8.10 lo zanja —«parciales solo UI»— y aquí eso no es
 * una convención sino una frontera: {@link assertCommittable} lanza ante un
 * parcial, y `packages/evidence` no declara ningún tipo de evento para ellos.
 *
 * ## La normalización transcodifica notación; no arregla al alumno
 *
 * La norma la acota a «transcodificar notación/variantes lingüísticas
 * autorizadas» y añade que **no corrige razonamiento**. La frontera es fácil de
 * cruzar sin darse cuenta: un normalizador que «entienda» que el alumno quiso
 * decir `∧E` cuando dijo «elimino la conjunción» de una línea que no es
 * conjunción estaría corrigiendo el razonamiento y borrando el error que el
 * profesor necesita ver.
 *
 * Por eso la normalización es **por destino declarado** y no adivina. Dictar a
 * un campo de fórmula exige que **toda** la locución sea lexicalizable: o el
 * enunciado entero se transcodifica, o falla. La alternativa —recorrer prosa
 * buscando trozos que parezcan notación— convertiría la «y» de «tres y cuatro»
 * en una conjunción, y ese defecto no se ve: produce una fórmula perfectamente
 * bien formada que el alumno no dijo.
 *
 * ## Léxico de sesión: del estado congelado, nunca del alumno
 *
 * El *keyterm prompting* mejora el reconocimiento de términos raros, y por eso
 * mismo es una vía de inyección: si el léxico saliera de lo que el alumno dice,
 * bastaría con dictar términos para moldear cómo se transcribe después.
 * {@link buildSessionLexicon} sólo acepta términos con procedencia declarada, y
 * `student_utterance` **no es miembro del tipo**: no hay valor que escribir.
 */

import {
  LEXICON_VERSION,
  SpeechLexiconError,
  deverbalizeFormulaText,
  deverbalizeReferences,
  deverbalizeRule,
  verbalizeFormulaText,
  verbalizeReferences,
  verbalizeRule,
  type SpokenReference,
} from './lexicon.js';

/**
 * Modos de captura autorizados en la primera implementación.
 *
 * P-I §8.10: «La primera implementación prioriza *push-to-talk* o micrófono
 * activo durante el turno. Full duplex, barge-in automático y turn-taking
 * completamente autónomo quedan **experimentales** hasta demostrar valor.» Los
 * experimentales no son miembros: un enum que los admitiera dejaría que una
 * corrida los activara sin que nadie hubiera demostrado ese valor.
 */
export const CAPTURE_MODES = ['push_to_talk', 'open_mic_turn'] as const;
export type CaptureMode = (typeof CAPTURE_MODES)[number];

/** Modos que la norma deja experimentales. Se nombran para poder rechazarlos con causa. */
export const EXPERIMENTAL_CAPTURE_MODES = [
  'full_duplex',
  'auto_barge_in',
  'autonomous_turn_taking',
] as const;

/**
 * A qué campo se dicta.
 *
 * `prose` es la identidad: la prosa **no es notación** y transcodificarla sería
 * inventar. Los otros tres exigen que la locución entera sea lexicalizable.
 */
export const DICTATION_TARGETS = ['formula', 'rule', 'references', 'prose'] as const;
export type DictationTarget = (typeof DICTATION_TARGETS)[number];

/** Versión del normalizador. Va en el `COMMIT`, como exige P-I §8.10. */
export const NORMALIZER_VERSION = `stt-normalizer-v1+${LEXICON_VERSION}` as const;

export type SpeechCaptureErrorCode =
  | 'MODO_EXPERIMENTAL'
  | 'PARCIAL_NO_ES_HECHO'
  | 'DESTINO_DESCONOCIDO'
  | 'LOCUCION_NO_LEXICALIZABLE'
  | 'PROCEDENCIA_NO_AUTORIZADA'
  | 'CORRECCION_SIN_COMMIT'
  | 'SOBRESCRITURA_PROHIBIDA';

export class SpeechCaptureError extends Error {
  readonly code: SpeechCaptureErrorCode;

  constructor(code: SpeechCaptureErrorCode, detail: string) {
    super(detail);
    this.name = 'SpeechCaptureError';
    this.code = code;
  }
}

// ───────────────────────── parciales: interfaz, no evidencia ─────────────────────────

export type UtteranceKind = 'partial' | 'final';

/**
 * Lo que el STT va devolviendo mientras el alumno habla. **No es evidencia.**
 *
 * No tiene `eventType` ni identificador estable a propósito: un parcial no es un
 * hecho al que nada pueda enlazarse después.
 */
export interface PartialUtterance {
  readonly kind: 'partial';
  readonly text: string;
}

/**
 * Puerta única hacia el ledger. **Lanza** ante un parcial.
 *
 * Es redundante con que `packages/evidence` no declare tipo para parciales, y la
 * redundancia es deliberada: el defecto aparece aquí, con el nombre de la norma
 * en el mensaje, en vez de aparecer como «tipo desconocido» tres capas más
 * abajo.
 */
export function assertCommittable(kind: UtteranceKind): asserts kind is 'final' {
  if (kind === 'partial') {
    throw new SpeechCaptureError(
      'PARCIAL_NO_ES_HECHO',
      'Un parcial de STT es interfaz, no evidencia (P-I §8.10: «parciales solo UI»). ' +
        'Registrarlo metería el titubeo del micrófono en un ledger append-only que no se ' +
        'puede limpiar después.',
    );
  }
}

// ───────────────────────── léxico de sesión ─────────────────────────

/**
 * De dónde puede venir un término del léxico de sesión.
 *
 * La lista es cerrada y **el alumno no está en ella**. No es que su locución se
 * filtre: es que no hay valor con el que declararla, así que la vía de inyección
 * no se cierra con una comprobación que alguien pueda olvidar.
 */
export const KEYTERM_PROVENANCES = [
  'authorized_calculus',
  'kc_definition',
  'corpus_fragment',
] as const;
export type KeytermProvenance = (typeof KEYTERM_PROVENANCES)[number];

export interface Keyterm {
  readonly term: string;
  readonly provenance: KeytermProvenance;
}

export interface SessionLexicon {
  readonly calculusVersion: string;
  readonly kcId: string;
  readonly keyterms: readonly Keyterm[];
}

/**
 * Léxico de sesión desde el estado congelado.
 *
 * La comprobación de procedencia en tiempo de ejecución existe para la frontera
 * no tipada —lo que llega deserializado de la base o de un mensaje—, donde el
 * tipo no protege nada.
 */
export function buildSessionLexicon(input: {
  readonly calculusVersion: string;
  readonly kcId: string;
  readonly keyterms: readonly Keyterm[];
}): SessionLexicon {
  for (const kt of input.keyterms) {
    if (!(KEYTERM_PROVENANCES as readonly string[]).includes(kt.provenance)) {
      throw new SpeechCaptureError(
        'PROCEDENCIA_NO_AUTORIZADA',
        `El término «${kt.term}» declara procedencia «${kt.provenance}». El léxico de sesión sale ` +
          `del estado congelado y nunca de instrucciones del alumno (P-I §8.10): con esa vía ` +
          `abierta, dictar términos moldearía cómo se transcribe después. Autorizadas: ` +
          `${KEYTERM_PROVENANCES.join(', ')}.`,
      );
    }
  }
  return { calculusVersion: input.calculusVersion, kcId: input.kcId, keyterms: input.keyterms };
}

/**
 * Resultado de intentar aplicar el léxico como *keyterm prompting*.
 *
 * La norma dice «cuando el proveedor lo soporte», y un proveedor que no lo
 * soporta **no es un error**: es una capacidad ausente. Lo que sí sería un
 * defecto es que el léxico se descartara en silencio y la corrida creyera
 * haberlo aplicado, así que el no-aplicado se declara con causa y viaja al
 * `COMMIT`.
 */
export type KeytermApplication =
  | { readonly applied: true; readonly terms: readonly string[] }
  | { readonly applied: false; readonly reason: 'provider_sin_soporte' | 'lexico_vacio' };

export function applyKeyterms(
  lexicon: SessionLexicon,
  provider: { readonly supportsKeyterms: boolean },
): KeytermApplication {
  if (!provider.supportsKeyterms) return { applied: false, reason: 'provider_sin_soporte' };
  if (lexicon.keyterms.length === 0) return { applied: false, reason: 'lexico_vacio' };
  return { applied: true, terms: lexicon.keyterms.map((k) => k.term) };
}

// ───────────────────────── normalización ─────────────────────────

export interface NormalizedTranscript {
  /** Lo que el proveedor devolvió, intacto. */
  readonly raw: string;
  /** Notación transcodificada. Para `prose`, idéntica a {@link raw}. */
  readonly normalized: string;
  readonly normalizerVersion: typeof NORMALIZER_VERSION;
  readonly target: DictationTarget;
}

/**
 * Transcodifica una locución al texto canónico de su campo.
 *
 * Determinista: sin reloj, sin azar, sin red. **Falla cerrado**: si la locución
 * no es lexicalizable entera, no se transcodifica un trozo y se deja el resto —
 * eso produciría un campo mitad notación mitad castellano que ni el editor ni el
 * verificador pueden leer, y que en pantalla parecería un despiste del alumno.
 */
export function normalizeTranscript(input: {
  readonly raw: string;
  readonly target: DictationTarget;
}): NormalizedTranscript {
  const { raw, target } = input;
  if (!(DICTATION_TARGETS as readonly string[]).includes(target)) {
    throw new SpeechCaptureError(
      'DESTINO_DESCONOCIDO',
      `«${target}» no es un destino de dictado. Los declarados: ${DICTATION_TARGETS.join(', ')}.`,
    );
  }
  if (target === 'prose') {
    // La prosa no es notación. Tocarla sería inventar, y además convertiría la
    // «y» de «tres y cuatro» en una conjunción.
    return { raw, normalized: raw, normalizerVersion: NORMALIZER_VERSION, target };
  }
  try {
    const normalized =
      target === 'formula'
        ? deverbalizeFormulaText(raw)
        : target === 'rule'
          ? deverbalizeRule(raw)
          : printReferences(deverbalizeReferences(raw));
    return { raw, normalized, normalizerVersion: NORMALIZER_VERSION, target };
  } catch (causa) {
    if (causa instanceof SpeechLexiconError) {
      throw new SpeechCaptureError(
        'LOCUCION_NO_LEXICALIZABLE',
        `La locución «${raw}» no se transcodifica entera al campo «${target}»: ${causa.message} ` +
          `El normalizador no transcodifica a medias: un campo mitad notación mitad castellano ` +
          `parecería un despiste del alumno y no lo es.`,
      );
    }
    throw causa;
  }
}

/**
 * Reconstruye la locución desde la forma normalizada.
 *
 * Es lo que hace *reversible* a la normalización en el sentido de la norma:
 * `denormalize(normalize(x)) === x` para toda locución canónica, y hay propiedad
 * que lo recorre. Guardar la cruda al lado ya permitiría compararlas; esto
 * además demuestra que las dos **dicen lo mismo**, que es lo que hace auditable
 * un `COMMIT`.
 */
export function denormalizeTranscript(record: NormalizedTranscript): string {
  switch (record.target) {
    case 'prose':
      return record.normalized;
    case 'formula':
      return verbalizeFormulaText(record.normalized);
    case 'rule':
      return verbalizeRule(record.normalized);
    case 'references':
      return verbalizeReferences(parseReferences(record.normalized));
  }
}

/** Mismo formato que `toFitchText` de `apps/web`: `3, 4` y `2–5`. Uno, no dos. */
function printReferences(refs: readonly SpokenReference[]): string {
  return refs
    .map((ref) => (typeof ref === 'number' ? String(ref) : `${ref[0]}–${ref[1]}`))
    .join(', ');
}

function parseReferences(text: string): readonly SpokenReference[] {
  if (text.trim() === '') return [];
  return text.split(', ').map((parte) => {
    const guion = parte.indexOf('–');
    if (guion === -1) return Number(parte);
    return [Number(parte.slice(0, guion)), Number(parte.slice(guion + 1))] as const;
  });
}

// ───────────────────────── COMMIT y correcciones ─────────────────────────

export interface TranscriptCommit {
  readonly eventType: 'speech.transcript.commit';
  readonly commitId: string;
  readonly captureMode: CaptureMode;
  readonly target: DictationTarget;
  readonly raw: string;
  readonly normalized: string;
  readonly normalizerVersion: typeof NORMALIZER_VERSION;
  readonly lexiconVersion: typeof LEXICON_VERSION;
  readonly keyterms: KeytermApplication;
  /** Si el acto era puntuable. Decide si una corrección posterior abre adjudicación. */
  readonly scoreable: boolean;
}

/**
 * Emite el `COMMIT`.
 *
 * Los tres campos que P-I §8.10 exige «al menos» —cruda, normalizada y versión
 * del normalizador— son obligatorios en el tipo. Sin la cruda no hay forma de
 * auditar la normalización; sin la versión, una normalización futura distinta
 * haría irreproducible este `COMMIT` sin que nada avisara.
 */
export function commitTranscript(input: {
  readonly commitId: string;
  readonly captureMode: CaptureMode;
  readonly transcript: NormalizedTranscript;
  readonly keyterms: KeytermApplication;
  readonly scoreable: boolean;
}): TranscriptCommit {
  if (!(CAPTURE_MODES as readonly string[]).includes(input.captureMode)) {
    throw new SpeechCaptureError(
      'MODO_EXPERIMENTAL',
      `«${input.captureMode}» no es un modo de captura de la primera implementación. ` +
        `P-I §8.10 deja experimentales ${EXPERIMENTAL_CAPTURE_MODES.join(', ')} «hasta demostrar ` +
        `valor», y aceptarlos aquí los activaría sin que nadie lo hubiera demostrado. ` +
        `Autorizados: ${CAPTURE_MODES.join(', ')}.`,
    );
  }
  return {
    eventType: 'speech.transcript.commit',
    commitId: input.commitId,
    captureMode: input.captureMode,
    target: input.transcript.target,
    raw: input.transcript.raw,
    normalized: input.transcript.normalized,
    normalizerVersion: input.transcript.normalizerVersion,
    lexiconVersion: LEXICON_VERSION,
    keyterms: input.keyterms,
    scoreable: input.scoreable,
  };
}

/**
 * Corrección **antes** del `COMMIT`: libre y sin rastro (UI-CORR-03).
 *
 * Devuelve una transcripción nueva y ya está. No hay evento porque todavía no
 * hay hecho: el alumno está escribiendo, y registrar cada arreglo previo sería
 * el mismo error que registrar los parciales.
 */
export function reviseBeforeCommit(input: {
  readonly raw: string;
  readonly target: DictationTarget;
}): NormalizedTranscript {
  return normalizeTranscript(input);
}

export interface TranscriptCorrection {
  readonly eventType: 'speech.transcript.correction';
  readonly correctionId: string;
  /** El `COMMIT` corregido. Sigue vigente: esto se enlaza, no lo sustituye. */
  readonly correctsCommitId: string;
  readonly raw: string;
  readonly normalized: string;
  readonly normalizerVersion: typeof NORMALIZER_VERSION;
  /**
   * Siempre `false`, y es un campo y no un comentario: UI-CORR-03 dice que la
   * corrección «no sobrescribe silenciosamente el original», y quien lea el
   * evento suelto necesita verlo sin ir a buscar la norma.
   */
  readonly overwritesOriginal: false;
  /**
   * Si el acto era puntuable, la corrección **no cambia el veredicto por sí
   * sola**: abre el procedimiento de adjudicación. Cambiarlo aquí sería dejar
   * que rehacer el dictado reescribiera una calificación ya emitida.
   */
  readonly adjudication: 'required' | 'not_applicable';
}

/**
 * Corrección **después** del `COMMIT`: evento enlazado (UI-CORR-03).
 *
 * No recibe el `COMMIT` para modificarlo sino para citarlo, y no devuelve un
 * `COMMIT` nuevo: devuelve otro hecho que apunta al primero. En un ledger
 * append-only es la única forma honesta de corregir, porque el original no se
 * puede quitar aunque se quisiera.
 */
export function correctAfterCommit(input: {
  readonly correctionId: string;
  readonly commit: TranscriptCommit;
  readonly transcript: NormalizedTranscript;
}): TranscriptCorrection {
  if (input.commit.eventType !== 'speech.transcript.commit') {
    throw new SpeechCaptureError(
      'CORRECCION_SIN_COMMIT',
      'Una corrección post-`COMMIT` cita un `COMMIT`. Sin él sería una transcripción suelta ' +
        'presentándose como enmienda de algo que nadie registró.',
    );
  }
  if (input.transcript.target !== input.commit.target) {
    throw new SpeechCaptureError(
      'SOBRESCRITURA_PROHIBIDA',
      `La corrección dicta al campo «${input.transcript.target}» y el \`COMMIT\` era del campo ` +
        `«${input.commit.target}». Enlazarlos haría que corregir la fórmula pareciera corregir la ` +
        `regla.`,
    );
  }
  return {
    eventType: 'speech.transcript.correction',
    correctionId: input.correctionId,
    correctsCommitId: input.commit.commitId,
    raw: input.transcript.raw,
    normalized: input.transcript.normalized,
    normalizerVersion: input.transcript.normalizerVersion,
    overwritesOriginal: false,
    adjudication: input.commit.scoreable ? 'required' : 'not_applicable',
  };
}
