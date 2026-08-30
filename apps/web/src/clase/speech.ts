/**
 * Del turno del Profesor IA al guion hablado (T-H8-02 ← P-I §8.10).
 *
 * `packages/speech-gateway` define la política: el TTS va **después** del filtro
 * de egreso, una pausa cita la decisión que la ordenó, y una caída de audio es
 * presentación y no decisión. Este módulo es la junta entre esa política y lo
 * que `/clase/turno` devuelve.
 *
 * ## Lo que no se habla
 *
 * Un segmento `withheld` es el que el validador de anclaje **retuvo**. Ponerlo
 * en el altavoz sería decir en voz alta justo lo que el filtro existe para
 * callar, y sonaría idéntico al resto. Así que se filtra aquí, antes de
 * construir el guion, y `speakableSegments()` es la única puerta.
 *
 * ## La estructura de fórmula que el turno no trae, y que no se inventa
 *
 * `CanonicalSegment` distingue `prose`, `formula`, `rule` y `reference` para que
 * el TTS **no tenga que adivinar**: el comentario de `tts.ts` lo dice —adivinar
 * mal «significa deletrear una fórmula o leer “P implica Q” como si fuera
 * prosa»—. Pero `TurnSegment` es texto plano con su `standing`: la estructura se
 * perdió al aplanar la salida del modelo en el contrato del turno.
 *
 * Aquí **no se reconstruye por heurística**. Buscar fórmulas con una expresión
 * regular sobre el texto sería exactamente el adivinar que la estructura existe
 * para evitar, y rompería en silencio la propiedad que valida esta tubería:
 * `deverbalizeFormulaText(verbalizeFormulaText(f)) === f` sólo se sostiene sobre
 * una fórmula canónica entera, no sobre un trozo recortado a ojo. Un símbolo
 * suelto leído mal no falla: se oye raro, y nadie lo comprueba.
 *
 * Así que todo lo que llega del turno se habla como `prose`, y la vía para
 * fórmulas queda abierta y tipada en {@link scriptFromSegments}: el día que
 * `TurnSegment` conserve la estructura del modelo, se pasa por ahí sin tocar
 * este módulo. Lo que falta es el campo en el contrato, no el código aquí.
 */

import {
  acceptFromEgressFilter,
  canonicalTextOf,
  degradeToText,
  startPlayback,
  toSpokenScript,
  type CanonicalScript,
  type CanonicalSegment,
  type Playback,
  type SpokenSegment,
} from '@profesor-ia/speech-gateway';

import type { ProfessorTurn, TurnSegment } from './turn';

/** La versión del cálculo que gobierna el lexicón de esta sesión. */
export const SESSION_CALCULUS_VERSION = 'authorized-calculus-v1' as const;

/**
 * Los segmentos que pueden sonar.
 *
 * `anchored` y `non_factual_accompaniment` pasaron el validador;
 * `withheld` no. Cualquier `standing` desconocido se trata como **no hablable**:
 * ante una clasificación que no reconocemos, callar es el único fallo seguro —
 * hablar sería decidir que un veredicto que no entendemos autoriza audio.
 */
export function speakableSegments(segments: readonly TurnSegment[]): readonly TurnSegment[] {
  return segments.filter(
    (segment) => segment.standing === 'anchored' || segment.standing === 'non_factual_accompaniment',
  );
}

/**
 * Construye el guion desde segmentos ya estructurados.
 *
 * Es la vía que espera a que el contrato del turno conserve la estructura. Hoy
 * la usa {@link scriptFromTurn} con segmentos de sólo prosa.
 */
export function scriptFromSegments(segments: readonly CanonicalSegment[]): CanonicalScript {
  return acceptFromEgressFilter({
    segments,
    calculusVersion: SESSION_CALCULUS_VERSION,
    // El turno vuelve de `/clase/turno`, que corre el validador de anclaje y el
    // filtro de egreso en el servidor; `standing` **es** su clasificación. Lo
    // retenido ya se quitó en `speakableSegments()`. Declararlo aquí no es un
    // trámite: es la afirmación de que lo que suena pasó por esa puerta.
    passedEgressFilter: true,
  });
}

/**
 * Guion del turno, o `null` si no queda nada que decir.
 *
 * `null` y «guion vacío» son distintos a propósito: un turno íntegramente
 * retenido no debe producir una locución de cero segmentos que la UI presente
 * como «el profesor habló».
 */
export function scriptFromTurn(turn: ProfessorTurn): CanonicalScript | null {
  const hablables = speakableSegments(turn.segments);
  if (hablables.length === 0) return null;
  const segments: readonly CanonicalSegment[] = hablables.map((segment) => ({
    kind: 'prose',
    text: segment.text,
  }));
  return scriptFromSegments(segments);
}

export interface PreparedSpeech {
  readonly script: CanonicalScript;
  readonly spoken: readonly SpokenSegment[];
  readonly playback: Playback;
  /** Lo que se escribe si el audio se cae. Idéntico a lo que se iba a decir. */
  readonly canonicalText: string;
}

/** Deja el turno listo para sonar, sin haber sonado todavía. */
export function prepareSpeech(turn: ProfessorTurn): PreparedSpeech | null {
  const script = scriptFromTurn(turn);
  if (script === null) return null;
  return {
    script,
    spoken: toSpokenScript(script),
    playback: startPlayback(script),
    canonicalText: canonicalTextOf(script),
  };
}

/**
 * Degrada a texto conservando el guion.
 *
 * Se reexporta desde aquí para que la vista no tenga que conocer el paquete: lo
 * que la vista necesita saber es que un fallo de audio **no cambia la decisión**,
 * y eso viaja en el propio resultado (`decisionChanged: false`).
 */
export function fallbackToText(playback: Playback, failureReason: string) {
  return degradeToText(playback, failureReason);
}
