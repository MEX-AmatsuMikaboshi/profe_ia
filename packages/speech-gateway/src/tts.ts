/**
 * TTS: del texto canónico validado al audio (T-H8-02 ← P-I §8.10;
 * `DEC-VOICE-001`).
 *
 * ## La voz va al final de la tubería, y eso es lo que hay que defender
 *
 * P-I §8.10 dibuja el orden: modelo pedagógico → salida textual estructurada →
 * validadores/anclajes/filtro de egreso → **texto canónico registrado** → TTS →
 * audio. Todo lo interesante ya ocurrió antes de que este módulo exista. Su
 * único trabajo es decir en voz alta algo que ya está decidido, validado y
 * registrado.
 *
 * De ahí las tres propiedades que el módulo sostiene, y que son la tarea:
 *
 * 1. **No se habla lo que no pasó el filtro de egreso.** El TTS no recibe un
 *    `string`: recibe un {@link CanonicalScript}, y la única función que lo
 *    produce es {@link acceptFromEgressFilter}, que exige declararlo. Escribir
 *    ese objeto a mano sigue siendo posible —el compilador no lee la norma—,
 *    pero obliga a poner `egressFiltered: true` de forma explícita, en una línea
 *    que un revisor ve, en vez de que sea un `speak(texto)` que nadie mira dos
 *    veces.
 * 2. **Pausar o interrumpir no altera el texto.** La norma lo dice literal, y
 *    aquí el texto canónico es de sólo lectura y viaja intacto por los cuatro
 *    estados. Una interrupción devuelve **hasta dónde se dijo**, no un texto
 *    recortado: recortarlo haría que la evidencia registrara una explicación que
 *    el Profesor IA nunca decidió dar.
 * 3. **Una caída del TTS es presentación, no decisión.** {@link degradeToText}
 *    devuelve el mismo texto canónico por escrito. No hay parámetro con el que
 *    un fallo de audio pueda tocar la decisión pedagógica, y hay prueba de que
 *    la degradación conserva el texto byte a byte.
 *
 * ## Las pausas son órdenes, no criterio del sintetizador
 *
 * «Las pausas pedagógicas son órdenes estructuradas de la política y no
 * decisiones libres del TTS.» Así que una pausa **cita la decisión que la
 * ordenó** —estrategia y `reasonCode`, los mismos campos de
 * `PedagogicalDecision`— y una pausa sin esa cita lanza. No se inventa aquí un
 * catálogo de motivos de pausa: eso sería justamente el TTS decidiendo.
 */

import type { PedagogicalStrategy } from '@profesor-ia/contracts';

import {
  type LEXICON_VERSION,
  verbalizationLexicon,
  verbalizeFormulaText,
  verbalizeReferences,
  verbalizeRule,
  type SpokenReference,
} from './lexicon.js';

export type SpeechSynthesisErrorCode =
  | 'TEXTO_SIN_FILTRO_DE_EGRESO'
  | 'PAUSA_SIN_ORDEN'
  | 'TRANSICION_INVALIDA'
  | 'SEGMENTO_DESCONOCIDO';

export class SpeechSynthesisError extends Error {
  readonly code: SpeechSynthesisErrorCode;

  constructor(code: SpeechSynthesisErrorCode, detail: string) {
    super(detail);
    this.name = 'SpeechSynthesisError';
    this.code = code;
  }
}

// ───────────────────────── la salida estructurada ─────────────────────────

/**
 * Un trozo de lo que el Profesor IA va a decir.
 *
 * La salida es **estructurada** por norma, y aquí se ve por qué hace falta que
 * lo sea: sin marcar qué trozo es fórmula, el TTS tendría que adivinarlo mirando
 * el texto —y adivinar mal significa deletrear una fórmula o leer «P implica Q»
 * como si fuera prosa—. Con la estructura declarada no hay nada que adivinar.
 */
export type CanonicalSegment =
  | { readonly kind: 'prose'; readonly text: string }
  | { readonly kind: 'formula'; readonly canonical: string }
  | { readonly kind: 'rule'; readonly ruleId: string }
  | { readonly kind: 'reference'; readonly refs: readonly SpokenReference[] }
  | { readonly kind: 'pause'; readonly ms: number; readonly orderedBy: PauseOrder };

/**
 * Quién ordenó la pausa.
 *
 * Son los campos de `PedagogicalDecision` que identifican la decisión, no un
 * catálogo nuevo. Si algún día la política gana un tipo de pausa, se declara
 * allí y aquí no hay nada que tocar.
 */
export interface PauseOrder {
  readonly strategy: PedagogicalStrategy;
  readonly reasonCode: string;
}

/**
 * Texto canónico que **ya pasó** el filtro de egreso.
 *
 * El campo `egressFiltered` está tipado al literal `true`: no hay
 * `CanonicalScript` que diga lo contrario. No impide que alguien lo escriba a
 * mano —ningún tipo impide mentir—, pero convierte la mentira en una línea
 * explícita que un revisor ve, y deja `acceptFromEgressFilter` como el único
 * camino normal.
 */
export interface CanonicalScript {
  readonly egressFiltered: true;
  readonly segments: readonly CanonicalSegment[];
  readonly calculusVersion: string;
  readonly lexiconVersion: typeof LEXICON_VERSION;
}

/**
 * Única puerta de entrada al TTS.
 *
 * Exige que quien llama declare que el texto pasó anclajes y filtro de egreso, y
 * de paso valida el lexicón **antes** de abrir el audio.
 */
export function acceptFromEgressFilter(input: {
  readonly segments: readonly CanonicalSegment[];
  readonly calculusVersion: string;
  readonly passedEgressFilter: boolean;
}): CanonicalScript {
  if (!input.passedEgressFilter) {
    throw new SpeechSynthesisError(
      'TEXTO_SIN_FILTRO_DE_EGRESO',
      'El TTS va **después** del filtro de egreso (P-I §8.10). Sintetizar texto que no pasó por ' +
        'él pondría en el altavoz justo lo que el filtro existe para retener, y sonaría idéntico ' +
        'a lo demás.',
    );
  }
  // Valida la versión del cálculo aquí y no al hablar: un lexicón que no
  // corresponde se descubre antes de abrir el audio, no a mitad de una frase.
  const { lexiconVersion } = verbalizationLexicon(input.calculusVersion);
  for (const segmento of input.segments) {
    if (segmento.kind === 'pause') assertPausaOrdenada(segmento.orderedBy);
  }
  return {
    egressFiltered: true,
    segments: input.segments,
    calculusVersion: input.calculusVersion,
    lexiconVersion,
  };
}

function assertPausaOrdenada(orden: PauseOrder | undefined): void {
  if (orden === undefined || orden.reasonCode.trim() === '') {
    throw new SpeechSynthesisError(
      'PAUSA_SIN_ORDEN',
      'Una pausa pedagógica es una orden estructurada de la política, no una decisión libre del ' +
        'TTS (P-I §8.10). Sin la decisión que la ordenó, un silencio de tres segundos sería ' +
        'criterio del sintetizador presentándose como pedagogía.',
    );
  }
}

// ───────────────────────── verbalización ─────────────────────────

export interface SpokenSegment {
  readonly source: CanonicalSegment;
  /** Lo que se manda al proveedor. Para una pausa, cadena vacía. */
  readonly spoken: string;
}

/**
 * Guion hablado.
 *
 * Cada segmento de fórmula pasa por el lexicón congelado, así que
 * `deverbalizeFormulaText(spoken) === canonical` para todos ellos. Esa vuelta
 * **es** la validación que la norma pide —«se valida por reconstrucción de
 * fórmulas, no por naturalidad percibida»— y la recorre
 * `test/lexicon-roundtrip.test.ts` sobre fórmulas generadas.
 */
export function toSpokenScript(script: CanonicalScript): readonly SpokenSegment[] {
  return script.segments.map((source) => ({ source, spoken: verbalizeSegment(source) }));
}

function verbalizeSegment(segmento: CanonicalSegment): string {
  switch (segmento.kind) {
    case 'prose':
      return segmento.text;
    case 'formula':
      return verbalizeFormulaText(segmento.canonical);
    case 'rule':
      return verbalizeRule(segmento.ruleId);
    case 'reference':
      return verbalizeReferences(segmento.refs);
    case 'pause':
      return '';
  }
}

/**
 * El texto canónico en plano, para registrar y para degradar.
 *
 * Es lo que se escribe si el audio se cae, y es idéntico a lo que se habría
 * dicho. Las pausas no aportan texto: son tiempo, no contenido.
 */
export function canonicalTextOf(script: CanonicalScript): string {
  return script.segments
    .map((s) => {
      switch (s.kind) {
        case 'prose':
          return s.text;
        case 'formula':
          return s.canonical;
        case 'rule':
          return s.ruleId;
        case 'reference':
          return s.refs
            .map((r) => (typeof r === 'number' ? String(r) : `${r[0]}–${r[1]}`))
            .join(', ');
        case 'pause':
          return '';
      }
    })
    .filter((t) => t !== '')
    .join(' ');
}

// ───────────────────────── reproducción ─────────────────────────

export const PLAYBACK_STATES = [
  'idle',
  'speaking',
  'paused',
  'interrupted',
  'completed',
  'degraded_to_text',
] as const;
export type PlaybackState = (typeof PLAYBACK_STATES)[number];

export interface Playback {
  readonly state: PlaybackState;
  readonly script: CanonicalScript;
  /** Índice del último segmento efectivamente dicho. `-1` si todavía ninguno. */
  readonly spokenThrough: number;
}

const TRANSICIONES: Readonly<Record<PlaybackState, readonly PlaybackState[]>> = Object.freeze({
  idle: ['speaking', 'degraded_to_text'],
  speaking: ['paused', 'interrupted', 'completed', 'degraded_to_text'],
  paused: ['speaking', 'interrupted', 'degraded_to_text'],
  interrupted: [],
  completed: [],
  degraded_to_text: [],
});

export function startPlayback(script: CanonicalScript): Playback {
  return { state: 'speaking', script, spokenThrough: -1 };
}

function transicionar(playback: Playback, destino: PlaybackState, spokenThrough: number): Playback {
  const permitidos = TRANSICIONES[playback.state];
  if (!permitidos.includes(destino)) {
    throw new SpeechSynthesisError(
      'TRANSICION_INVALIDA',
      `No se puede pasar de «${playback.state}» a «${destino}». Desde «${playback.state}» sólo ` +
        `${permitidos.length === 0 ? 'no hay salida: es terminal' : permitidos.join(', ')}.`,
    );
  }
  return { state: destino, script: playback.script, spokenThrough };
}

/** Pausa. El texto canónico no se toca: `script` viaja por referencia. */
export function pausePlayback(playback: Playback, spokenThrough: number): Playback {
  return transicionar(playback, 'paused', spokenThrough);
}

export function resumePlayback(playback: Playback): Playback {
  return transicionar(playback, 'speaking', playback.spokenThrough);
}

export interface InterruptionEvent {
  readonly eventType: 'tts.utterance.interrupted';
  readonly spokenThrough: number;
  /**
   * El texto entero, **no** el trozo que se llegó a decir.
   *
   * Recortarlo haría que la evidencia registrara una explicación que el Profesor
   * IA nunca decidió dar, y el replay reconstruiría una clase distinta de la que
   * hubo. Cuánto se oyó es {@link spokenThrough}; qué se decidió decir es esto.
   */
  readonly canonicalText: string;
}

/** Interrumpe. Estado terminal: lo que sigue es otra locución, no la misma. */
export function interruptPlayback(
  playback: Playback,
  spokenThrough: number,
): { readonly playback: Playback; readonly event: InterruptionEvent } {
  const siguiente = transicionar(playback, 'interrupted', spokenThrough);
  return {
    playback: siguiente,
    event: {
      eventType: 'tts.utterance.interrupted',
      spokenThrough,
      canonicalText: canonicalTextOf(playback.script),
    },
  };
}

export function completePlayback(playback: Playback): Playback {
  return transicionar(playback, 'completed', playback.script.segments.length - 1);
}

export interface TextFallback {
  readonly presentation: 'text';
  readonly canonicalText: string;
  /**
   * Siempre `false`. Es campo y no comentario porque quien lea este resultado
   * suelto —en un log, en un replay— necesita ver que el fallo de audio no tocó
   * la decisión, sin ir a buscar la norma.
   */
  readonly decisionChanged: false;
  readonly failureReason: string;
}

/**
 * Caída del TTS ⇒ se presenta por escrito y se sigue.
 *
 * «Una caída del TTS afecta la presentación, no la decisión pedagógica.» El
 * texto sale byte a byte igual al que se iba a decir, y no hay parámetro con el
 * que un fallo de audio pueda modificar nada más: la firma no admite una
 * decisión pedagógica, así que no existe la llamada que la degradaría.
 */
export function degradeToText(
  playback: Playback,
  failureReason: string,
): { readonly playback: Playback; readonly fallback: TextFallback } {
  const siguiente = transicionar(playback, 'degraded_to_text', playback.spokenThrough);
  return {
    playback: siguiente,
    fallback: {
      presentation: 'text',
      canonicalText: canonicalTextOf(playback.script),
      decisionChanged: false,
      failureReason,
    },
  };
}
