import { describe, expect, it } from 'vitest';

import { LEXICON_VERSION } from '../src/lexicon.js';
import {
  PLAYBACK_STATES,
  type SpeechSynthesisError,
  acceptFromEgressFilter,
  canonicalTextOf,
  completePlayback,
  degradeToText,
  interruptPlayback,
  pausePlayback,
  resumePlayback,
  startPlayback,
  toSpokenScript,
  type CanonicalSegment,
} from '../src/tts.js';

const SEGMENTOS: readonly CanonicalSegment[] = [
  { kind: 'prose', text: 'Para cerrar el condicional necesitas' },
  { kind: 'rule', ruleId: '→I' },
  { kind: 'prose', text: 'sobre' },
  { kind: 'reference', refs: [[2, 5]] },
  { kind: 'pause', ms: 800, orderedBy: { strategy: 'scaffolding', reasonCode: 'espera-respuesta' } },
  { kind: 'formula', canonical: '(P∧Q)→R' },
];

const guion = () =>
  acceptFromEgressFilter({
    segments: SEGMENTOS,
    calculusVersion: 'authorized-calculus-v1',
    passedEgressFilter: true,
  });

describe('el TTS va después del filtro de egreso', () => {
  it('acepta el texto que lo pasó', () => {
    const g = guion();
    expect(g.egressFiltered).toBe(true);
    expect(g.lexiconVersion).toBe(LEXICON_VERSION);
  });

  it('rechaza el que no', () => {
    // Sintetizar texto sin filtrar pondría en el altavoz justo lo que el filtro
    // existe para retener, y sonaría idéntico a lo demás.
    expect(() =>
      acceptFromEgressFilter({
        segments: SEGMENTOS,
        calculusVersion: 'authorized-calculus-v1',
        passedEgressFilter: false,
      }),
    ).toThrowError(/después.*del filtro de egreso/u);
  });

  it('rechaza un cálculo sin lexicón congelado, antes de abrir el audio', () => {
    expect(() =>
      acceptFromEgressFilter({
        segments: SEGMENTOS,
        calculusVersion: 'authorized-calculus-v2',
        passedEgressFilter: true,
      }),
    ).toThrowError(/No hay lexicón congelado/u);
  });
});

describe('las pausas son órdenes de la política, no criterio del sintetizador', () => {
  it('una pausa con la decisión que la ordenó pasa', () => {
    expect(() => guion()).not.toThrow();
  });

  it('una pausa sin `reasonCode` lanza', () => {
    const sinOrden: readonly CanonicalSegment[] = [
      { kind: 'pause', ms: 800, orderedBy: { strategy: 'scaffolding', reasonCode: '  ' } },
    ];
    expect(() =>
      acceptFromEgressFilter({
        segments: sinOrden,
        calculusVersion: 'authorized-calculus-v1',
        passedEgressFilter: true,
      }),
    ).toThrowError(/no una decisión libre del TTS/u);
    try {
      acceptFromEgressFilter({
        segments: sinOrden,
        calculusVersion: 'authorized-calculus-v1',
        passedEgressFilter: true,
      });
    } catch (e) {
      expect((e as SpeechSynthesisError).code).toBe('PAUSA_SIN_ORDEN');
    }
  });
});

describe('verbalización del guion', () => {
  it('cada segmento se dice según su clase, sin que el TTS adivine', () => {
    const dicho = toSpokenScript(guion());
    expect(dicho.map((s) => s.spoken)).toStrictEqual([
      'Para cerrar el condicional necesitas',
      'introducción del condicional',
      'sobre',
      'subprueba de la línea 2 a la línea 5',
      '',
      'abre paréntesis letra P y letra Q cierra paréntesis implica letra R',
    ]);
  });

  it('una pausa no aporta texto: es tiempo, no contenido', () => {
    expect(canonicalTextOf(guion())).not.toContain('undefined');
    expect(canonicalTextOf(guion())).toBe(
      'Para cerrar el condicional necesitas →I sobre 2–5 (P∧Q)→R',
    );
  });
});

describe('pausar e interrumpir no alteran el texto (P-I §8.10)', () => {
  it('el texto canónico sobrevive a pausa y reanudación byte a byte', () => {
    const g = guion();
    const antes = canonicalTextOf(g);
    const p = resumePlayback(pausePlayback(startPlayback(g), 2));
    expect(canonicalTextOf(p.script)).toBe(antes);
    expect(p.state).toBe('speaking');
  });

  it('la interrupción registra hasta dónde se dijo, y el texto entero', () => {
    const g = guion();
    const { playback, event } = interruptPlayback(startPlayback(g), 2);
    expect(playback.state).toBe('interrupted');
    expect(event.eventType).toBe('tts.utterance.interrupted');
    expect(event.spokenThrough).toBe(2);
    // Recortar el texto haría que la evidencia registrara una explicación que el
    // Profesor IA nunca decidió dar, y el replay reconstruiría otra clase.
    expect(event.canonicalText).toBe(canonicalTextOf(g));
  });

  it('interrumpido y completado son terminales', () => {
    const { playback } = interruptPlayback(startPlayback(guion()), 1);
    expect(() => resumePlayback(playback)).toThrowError(/es terminal/u);
    expect(() => completePlayback(playback)).toThrowError(/es terminal/u);
  });

  it('los seis estados son los declarados', () => {
    expect([...PLAYBACK_STATES]).toStrictEqual([
      'idle',
      'speaking',
      'paused',
      'interrupted',
      'completed',
      'degraded_to_text',
    ]);
  });
});

describe('una caída del TTS es presentación, no decisión', () => {
  it('degradar a texto conserva el canónico byte a byte y declara que nada cambió', () => {
    const g = guion();
    const { playback, fallback } = degradeToText(startPlayback(g), 'proveedor 503');
    expect(playback.state).toBe('degraded_to_text');
    expect(fallback.presentation).toBe('text');
    expect(fallback.canonicalText).toBe(canonicalTextOf(g));
    expect(fallback.decisionChanged).toBe(false);
    expect(fallback.failureReason).toBe('proveedor 503');
  });

  it('se puede degradar desde pausa, que es donde suele caerse', () => {
    const { fallback } = degradeToText(pausePlayback(startPlayback(guion()), 1), 'timeout');
    expect(fallback.canonicalText).toBe(canonicalTextOf(guion()));
  });
});
