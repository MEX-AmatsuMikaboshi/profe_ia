import { describe, expect, it } from 'vitest';

import {
  MULTIMODAL_EVENT_FAMILIES,
  MultimodalEventError,
  assertMultimodalEventType,
  assertReplayComplete,
  isMultimodalEventType,
  multimodalEventTypes,
  type MultimodalReplayRecord,
} from '../src/multimodal.js';

/**
 * T-H8-08 — familias de evento multimodal.
 *
 * Un ledger append-only no se puede limpiar después: lo que entra, se queda. Por
 * eso lo que se prueba aquí no es que los nombres buenos pasen —eso es fácil—
 * sino que los **parecidos** no pasen.
 */

function replay(overrides: Partial<MultimodalReplayRecord> = {}): MultimodalReplayRecord {
  return {
    eventId: 'ev-1',
    structuredState: '{"kcId":"KC04"}',
    captureRef: null,
    versions: { corpus: 'w1-corpus-v1' },
    prompt: null,
    modelBindingId: null,
    output: null,
    ...overrides,
  };
}

describe('familias multimodales', () => {
  it('las cinco de P-II §9.3 y ni una más', () => {
    expect([...MULTIMODAL_EVENT_FAMILIES]).toStrictEqual([
      'speech',
      'tts',
      'board',
      'visual',
      'annotation',
    ]);
  });

  it('todos los tipos declarados se validan', () => {
    for (const tipo of multimodalEventTypes()) {
      expect(() => assertMultimodalEventType(tipo)).not.toThrow();
    }
  });

  it('un nombre PARECIDO no cuela', () => {
    // Éste es el caso que importa: `created` vs `create` son dos nombres del
    // mismo hecho, y los dos quedarían para siempre.
    expect(() => assertMultimodalEventType('board.element.create')).toThrow(MultimodalEventError);
    expect(() => assertMultimodalEventType('boards.element.created')).toThrow(/familia/iu);
    expect(() => assertMultimodalEventType('visual.foo')).toThrow(/no está declarado/u);
  });

  it('los parciales de voz NO son tipo de evento', () => {
    // P-I §8.10: los parciales son de interfaz y cambian cada pocos ms. Sólo el
    // COMMIT es un hecho. Registrarlos llenaría el ledger de ruido irrepetible.
    expect(multimodalEventTypes()).toContain('speech.transcript.commit');
    expect(multimodalEventTypes()).not.toContain('speech.transcript.partial');
    expect(() => assertMultimodalEventType('speech.transcript.partial')).toThrow();
  });

  it('un tipo de sesión no se confunde con uno multimodal', () => {
    expect(isMultimodalEventType('session.primary.transitioned')).toBe(false);
    expect(isMultimodalEventType('annotation.emitted')).toBe(true);
  });
});

describe('replay multimodal', () => {
  it('un registro completo pasa', () => {
    expect(() => assertReplayComplete(replay())).not.toThrow();
  });

  it('null y ausente NO son lo mismo', () => {
    // `null` dice «no hubo»; ausente dice «no se registró». Confundirlos hace
    // irreconstruible justo el evento que alguien querrá revisar.
    const sinCampo = { ...replay() } as Record<string, unknown>;
    delete sinCampo['captureRef'];
    expect(() => assertReplayComplete(sinCampo as unknown as MultimodalReplayRecord)).toThrow(
      /captureRef/u,
    );
    // Con `null` explícito, pasa.
    expect(() => assertReplayComplete(replay({ captureRef: null }))).not.toThrow();
  });

  it('un prompt sin binding describe una llamada imposible', () => {
    expect(() => assertReplayComplete(replay({ prompt: 'explica ∧E' }))).toThrow(
      /juntos|imposible|reproducir/iu,
    );
    expect(() =>
      assertReplayComplete(replay({ prompt: 'explica ∧E', modelBindingId: 'binding-1' })),
    ).not.toThrow();
  });

  it('falta el estado estructurado y lanza', () => {
    expect(() => assertReplayComplete(replay({ structuredState: '' }))).toThrow(
      /structuredState/u,
    );
  });
});
