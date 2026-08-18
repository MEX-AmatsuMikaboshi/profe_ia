import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { anthropicAdapter } from '../src/adapters/anthropic.js';
import { openaiAdapter } from '../src/adapters/openai.js';
import { validateModelOutput } from '../src/output.js';

/**
 * Extracción de unidades facturadas (T-H4-10).
 *
 * Sin esto no hay costo medido, sólo costo estimado, y el piloto de BENCH-01
 * existe justamente para sustituir la estimación por una medición.
 *
 * La propiedad que más importa **no** es que lea bien el `usage` presente, sino
 * que un `usage` ausente o malformado quede en `undefined` y jamás en ceros: un
 * cero fabricado entra al ledger como gasto medido y hace parecer la corrida
 * más barata de lo que fue.
 */

const respuestaAnthropic = (usage: unknown): string =>
  JSON.stringify({
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: '{"ok":true}' }],
    ...(usage === undefined ? {} : { usage }),
  });

const respuestaOpenai = (usage: unknown): string =>
  JSON.stringify({
    status: 'completed',
    output: [{ type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }],
    ...(usage === undefined ? {} : { usage }),
  });

describe('Anthropic', () => {
  it('lee input, output y lectura de caché', () => {
    const outcome = anthropicAdapter.parseResponse({
      status: 200,
      body: respuestaAnthropic({
        input_tokens: 1234,
        output_tokens: 567,
        cache_read_input_tokens: 89,
      }),
    });
    expect(outcome.usage).toEqual({
      inputTokens: 1234,
      outputTokens: 567,
      cachedInputTokens: 89,
    });
  });

  it('sin desglose de caché, el campo va ausente y no en cero', () => {
    const outcome = anthropicAdapter.parseResponse({
      status: 200,
      body: respuestaAnthropic({ input_tokens: 10, output_tokens: 20 }),
    });
    expect(outcome.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
    expect(outcome.usage && 'cachedInputTokens' in outcome.usage).toBe(false);
  });

  it('sin usage, undefined: nunca ceros fabricados', () => {
    const outcome = anthropicAdapter.parseResponse({
      status: 200,
      body: respuestaAnthropic(undefined),
    });
    expect(outcome.usage).toBeUndefined();
  });

  it('usage malformado no se rescata a medias', () => {
    for (const malo of [{ input_tokens: 'diez', output_tokens: 20 }, { input_tokens: 10 }, null, 7]) {
      const outcome = anthropicAdapter.parseResponse({
        status: 200,
        body: respuestaAnthropic(malo),
      });
      expect(outcome.usage).toBeUndefined();
    }
  });
});

describe('OpenAI', () => {
  it('lee input, output y cached_tokens del desglose', () => {
    const outcome = openaiAdapter.parseResponse({
      status: 200,
      body: respuestaOpenai({
        input_tokens: 900,
        output_tokens: 120,
        input_tokens_details: { cached_tokens: 300 },
      }),
    });
    expect(outcome.usage).toEqual({
      inputTokens: 900,
      outputTokens: 120,
      cachedInputTokens: 300,
    });
  });

  it('sin desglose de caché, el campo va ausente', () => {
    const outcome = openaiAdapter.parseResponse({
      status: 200,
      body: respuestaOpenai({ input_tokens: 5, output_tokens: 6 }),
    });
    expect(outcome.usage).toEqual({ inputTokens: 5, outputTokens: 6 });
  });

  it('sin usage, undefined', () => {
    const outcome = openaiAdapter.parseResponse({
      status: 200,
      body: respuestaOpenai(undefined),
    });
    expect(outcome.usage).toBeUndefined();
  });
});

describe('el uso sobrevive a la validación', () => {
  const schema = z.object({ ok: z.boolean() });

  it('llega intacto en una salida válida', () => {
    const outcome = anthropicAdapter.parseResponse({
      status: 200,
      body: respuestaAnthropic({ input_tokens: 11, output_tokens: 22 }),
    });
    const validado = validateModelOutput({
      operation: 'explain_block',
      bindingId: 'b1',
      outcome,
      schema,
      attempt: 1,
    });
    expect(validado.classification).toBe('valid');
    expect(validado.usage).toEqual({ inputTokens: 11, outputTokens: 22 });
  });

  it('llega también cuando la salida se descarta: un rechazo también se cobra', () => {
    const validado = validateModelOutput({
      operation: 'explain_block',
      bindingId: 'b1',
      outcome: {
        kind: 'refusal',
        text: 'no',
        rawStopReason: 'refusal',
        usage: { inputTokens: 7, outputTokens: 1 },
      },
      schema,
      attempt: 1,
    });
    expect(validado.classification).toBe('refusal');
    expect(validado.usage).toEqual({ inputTokens: 7, outputTokens: 1 });
  });

  it('sin uso reportado, el validado tampoco lo inventa', () => {
    const validado = validateModelOutput({
      operation: 'explain_block',
      bindingId: 'b1',
      outcome: { kind: 'output', text: '{"ok":true}', rawStopReason: 'end_turn' },
      schema,
      attempt: 1,
    });
    expect(validado.usage).toBeUndefined();
  });
});
