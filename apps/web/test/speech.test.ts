import { describe, expect, it } from 'vitest';

import { canonicalTextOf } from '@profesor-ia/speech-gateway';

import {
  SESSION_CALCULUS_VERSION,
  prepareSpeech,
  scriptFromSegments,
  scriptFromTurn,
  speakableSegments,
} from '../src/clase/speech';
import type { ProfessorTurn, TurnSegment } from '../src/clase/turn';

function turno(segments: readonly TurnSegment[]): ProfessorTurn {
  return {
    outcome: 'entregado',
    stoppedAt: 'fin',
    segments,
    canGroundEvaluation: true,
    attempts: 1,
    policyRuleId: 'PP-01',
    packagePurpose: 'test_fixture',
  };
}

const ANCLADO: TurnSegment = {
  text: 'De una conjunción puedes concluir cualquiera de sus miembros.',
  standing: 'anchored',
  anchors: ['F-1a2b3c4d'],
};
const ACOMPANAMIENTO: TurnSegment = {
  text: 'Vamos por partes.',
  standing: 'non_factual_accompaniment',
  anchors: [],
};
const RETENIDO: TurnSegment = {
  text: 'La solución completa es: aplica ∧E a la línea 1 y termina.',
  standing: 'withheld',
  anchors: [],
};

describe('T-H8-02 — del turno al guion hablado', () => {
  it('lo retenido por el filtro NO se habla', () => {
    // Es la propiedad que sostiene todo lo demás: poner un `withheld` en el
    // altavoz diría en voz alta justo lo que el filtro existe para callar, y
    // sonaría idéntico al resto.
    const hablables = speakableSegments([ANCLADO, RETENIDO, ACOMPANAMIENTO]);
    expect(hablables).toStrictEqual([ANCLADO, ACOMPANAMIENTO]);

    const script = scriptFromTurn(turno([ANCLADO, RETENIDO, ACOMPANAMIENTO]));
    expect(script).not.toBeNull();
    expect(canonicalTextOf(script!)).not.toContain('aplica ∧E');
    expect(canonicalTextOf(script!)).toContain('conjunción');
  });

  it('un `standing` desconocido se calla: ante lo que no entendemos, no se habla', () => {
    // Si un `standing` nuevo entrase por omisión en lo hablable, ampliar la
    // clasificación en el servidor abriría el altavoz sin que nadie lo decidiera.
    const raro: TurnSegment = { text: 'algo', standing: 'clasificacion_futura', anchors: [] };
    expect(speakableSegments([raro])).toStrictEqual([]);
    expect(scriptFromTurn(turno([raro]))).toBeNull();
  });

  it('un turno íntegramente retenido devuelve `null`, no un guion vacío', () => {
    // «El profesor no dijo nada» y «el profesor habló cero segmentos» no pueden
    // presentarse igual: el segundo haría creer que hubo locución.
    expect(scriptFromTurn(turno([RETENIDO]))).toBeNull();
    expect(prepareSpeech(turno([RETENIDO]))).toBeNull();
  });

  it('el guion declara haber pasado el filtro y trae la versión del cálculo', () => {
    const script = scriptFromTurn(turno([ANCLADO]));
    expect(script?.egressFiltered).toBe(true);
    expect(script?.calculusVersion).toBe(SESSION_CALCULUS_VERSION);
    expect(script?.lexiconVersion).toBe('verbalization-lexicon-v1');
  });

  it('`prepareSpeech` no habla todavía: deja la reproducción lista', () => {
    const preparado = prepareSpeech(turno([ANCLADO, ACOMPANAMIENTO]));
    expect(preparado?.playback.state).toBe('speaking');
    // Ningún segmento dicho aún: `-1` es «todavía ninguno», no «el primero».
    expect(preparado?.playback.spokenThrough).toBe(-1);
    expect(preparado?.spoken).toHaveLength(2);
  });

  it('el texto de degradación es el mismo que se iba a decir', () => {
    // «Una caída del TTS afecta la presentación, no la decisión pedagógica.»
    const preparado = prepareSpeech(turno([ANCLADO, ACOMPANAMIENTO]));
    expect(preparado?.canonicalText).toContain(ANCLADO.text);
    expect(preparado?.canonicalText).toContain(ACOMPANAMIENTO.text);
    expect(preparado?.canonicalText).not.toContain(RETENIDO.text);
  });

  it('la vía estructurada existe y verbaliza fórmulas por el lexicón', () => {
    // Hoy el contrato del turno es texto plano, así que `scriptFromTurn` sólo
    // produce prosa. Esta prueba fija que la vía para cuando el contrato
    // conserve la estructura **ya funciona**, y que no se está adivinando qué
    // trozo es fórmula mirando el texto.
    const script = scriptFromSegments([
      { kind: 'prose', text: 'Fíjate en' },
      { kind: 'formula', canonical: 'A∧B' },
    ]);
    expect(script.segments).toHaveLength(2);
    expect(canonicalTextOf(script)).toContain('A∧B');
  });
});
