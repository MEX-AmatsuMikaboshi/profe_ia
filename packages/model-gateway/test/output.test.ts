import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  anthropicAdapter,
  canonicalizeEnum,
  openaiAdapter,
  UnknownProviderContractError,
  validateModelOutput,
  type ProviderAdapter,
  type ProviderOutcome,
} from '../src/index.js';

const SCHEMA = z.object({ ok: z.boolean() });

function validar(outcome: ProviderOutcome) {
  return validateModelOutput({
    operation: 'explain_block',
    bindingId: 'binding-de-prueba',
    outcome,
    schema: SCHEMA,
    attempt: 1,
  });
}

describe('clasificación separada de la salida (T-H4-03 ← P-II §8.4)', () => {
  it('una salida en esquema es válida y solo entonces expone datos', () => {
    const resultado = validar({ kind: 'output', text: '{"ok":true}', rawStopReason: 'end_turn' });

    expect(resultado.classification).toBe('valid');
    if (resultado.classification !== 'valid') throw new Error('debía ser válida');
    expect(resultado.data).toEqual({ ok: true });
  });

  it('las cinco causas se clasifican por separado', () => {
    expect(validar({ kind: 'output', text: '{"ok":"no"}', rawStopReason: 'end_turn' }).classification).toBe(
      'schema_violation',
    );
    expect(validar({ kind: 'truncated', text: '{"ok":tr', rawStopReason: 'max_tokens' }).classification).toBe(
      'truncated',
    );
    expect(validar({ kind: 'refusal', text: 'no puedo', rawStopReason: 'refusal' }).classification).toBe(
      'refusal',
    );
    expect(validar({ kind: 'provider_error', status: 500, body: 'boom' }).classification).toBe(
      'provider_error',
    );
  });

  it('un truncamiento NO se reporta como fallo de esquema aunque también lo falle', () => {
    // `{"ok":tr` es a la vez truncado e inválido. La causa que se reporta es la
    // real; reportar `schema_violation` la escondería (P-II §8.4).
    const resultado = validar({ kind: 'truncated', text: '{"ok":tr', rawStopReason: 'max_tokens' });

    expect(resultado.classification).toBe('truncated');
    expect(resultado.classification).not.toBe('schema_violation');
  });

  it('un rechazo NO se reporta como fallo de esquema aunque no sea JSON', () => {
    const resultado = validar({ kind: 'refusal', text: 'no puedo ayudarte', rawStopReason: 'refusal' });

    expect(resultado.classification).toBe('refusal');
    expect(resultado.classification).not.toBe('schema_violation');
  });

  it('el valor bruto se conserva en toda clasificación, para auditoría', () => {
    const casos: ProviderOutcome[] = [
      { kind: 'output', text: '{"ok":true}', rawStopReason: 'end_turn' },
      { kind: 'output', text: 'no es json', rawStopReason: 'end_turn' },
      { kind: 'truncated', text: '{"ok":tr', rawStopReason: 'max_tokens' },
      { kind: 'refusal', text: 'no puedo', rawStopReason: 'refusal' },
      { kind: 'provider_error', status: 500, body: 'boom' },
    ];

    for (const caso of casos) {
      const esperado = caso.kind === 'provider_error' ? caso.body : caso.text;
      expect(validar(caso).envelope.rawOutput).toBe(esperado);
    }
  });

  it('sin datos fuera del caso válido: no hay camino a la salida sin clasificar', () => {
    const resultado = validar({ kind: 'output', text: 'no es json', rawStopReason: 'end_turn' });

    expect(resultado.classification).toBe('schema_violation');
    expect(resultado.data).toBeUndefined();
  });
});

describe('canonicalización determinista de enums (P-II §8.4)', () => {
  const permitidos = ['definition', 'explanation', 'example', 'transition'] as const;

  it('conserva el valor bruto junto al canónico', () => {
    const r = canonicalizeEnum('Explanation', permitidos, { caseInsensitive: true });

    expect(r).toEqual({ canonical: 'explanation', raw: 'Explanation' });
  });

  it('no normaliza mayúsculas si el contrato no lo autoriza', () => {
    expect(canonicalizeEnum('Explanation', permitidos, { caseInsensitive: false })).toBeNull();
    expect(canonicalizeEnum('explanation', permitidos, { caseInsensitive: false })).toEqual({
      canonical: 'explanation',
      raw: 'explanation',
    });
  });

  it('un valor fuera del enum devuelve null: no elige el más parecido', () => {
    expect(canonicalizeEnum('explanations', permitidos, { caseInsensitive: true })).toBeNull();
    expect(canonicalizeEnum('expl', permitidos, { caseInsensitive: true })).toBeNull();
    expect(canonicalizeEnum('', permitidos, { caseInsensitive: true })).toBeNull();
  });

  it('es determinista: la misma entrada da siempre la misma salida', () => {
    const una = canonicalizeEnum('  EXAMPLE  ', permitidos, { caseInsensitive: true });
    const otra = canonicalizeEnum('  EXAMPLE  ', permitidos, { caseInsensitive: true });

    expect(una).toEqual(otra);
    expect(una?.canonical).toBe('example');
    expect(una?.raw).toBe('  EXAMPLE  ');
  });
});

/**
 * Contract tests equivalentes por adaptador (`ci:gateway:contracts` ← P-II §8.4:
 * «CI ejecuta contract tests equivalentes sobre cada adaptador para comprobar
 * que una misma operación conserva invariantes de entrada/salida aunque cambien
 * las peculiaridades del proveedor»).
 *
 * Cada adaptador recibe la respuesta **en su propia forma** —que es distinta a
 * propósito— y debe producir el mismo `ProviderOutcome` normalizado.
 */
const CASOS_EQUIVALENTES = [
  {
    caso: 'salida completa',
    esperado: { kind: 'output', text: '{"ok":true}' },
    anthropic: { stop_reason: 'end_turn', content: [{ type: 'text', text: '{"ok":true}' }] },
    openai: {
      status: 'completed',
      output: [{ content: [{ type: 'output_text', text: '{"ok":true}' }] }],
    },
  },
  {
    caso: 'truncamiento',
    esperado: { kind: 'truncated', text: '{"ok":tr' },
    anthropic: { stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"ok":tr' }] },
    openai: {
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      output: [{ content: [{ type: 'output_text', text: '{"ok":tr' }] }],
    },
  },
  {
    caso: 'rechazo',
    esperado: { kind: 'refusal', text: 'no puedo' },
    anthropic: { stop_reason: 'refusal', content: [{ type: 'text', text: 'no puedo' }] },
    openai: {
      status: 'completed',
      output: [{ content: [{ type: 'refusal', refusal: 'no puedo' }] }],
    },
  },
] as const;

describe('contract tests equivalentes por adaptador', () => {
  for (const { caso, esperado, anthropic, openai } of CASOS_EQUIVALENTES) {
    it(`${caso}: los dos adaptadores producen el mismo resultado normalizado`, () => {
      const a = anthropicAdapter.parseResponse({ status: 200, body: JSON.stringify(anthropic) });
      const o = openaiAdapter.parseResponse({ status: 200, body: JSON.stringify(openai) });

      expect(a.kind).toBe(esperado.kind);
      expect(o.kind).toBe(esperado.kind);
      expect(a).toMatchObject({ text: esperado.text });
      expect(o).toMatchObject({ text: esperado.text });

      // Y la clasificación final coincide, que es el invariante que importa.
      expect(validar(a).classification).toBe(validar(o).classification);
    });
  }

  it('las formas de respuesta son distintas: el caso no es trivial', () => {
    for (const { anthropic, openai } of CASOS_EQUIVALENTES) {
      expect(JSON.stringify(anthropic)).not.toBe(JSON.stringify(openai));
    }
  });

  const adaptadores: readonly [string, ProviderAdapter][] = [
    ['anthropic', anthropicAdapter],
    ['openai', openaiAdapter],
  ];

  for (const [nombre, adaptador] of adaptadores) {
    it(`${nombre}: un estado no 2xx es provider_error, no una excepción`, () => {
      const r = adaptador.parseResponse({ status: 503, body: 'no disponible' });

      expect(r).toEqual({ kind: 'provider_error', status: 503, body: 'no disponible' });
    });

    it(`${nombre}: un contrato desconocido falla cerrado en vez de suponer que fue bien`, () => {
      const desconocido =
        nombre === 'anthropic'
          ? { stop_reason: 'motivo_que_no_existia_ayer', content: [] }
          : { status: 'estado_que_no_existia_ayer', output: [] };

      expect(() =>
        adaptador.parseResponse({ status: 200, body: JSON.stringify(desconocido) }),
      ).toThrow(UnknownProviderContractError);
    });

    it(`${nombre}: 2xx con cuerpo que no es JSON falla cerrado`, () => {
      expect(() => adaptador.parseResponse({ status: 200, body: '<html>' })).toThrow(
        UnknownProviderContractError,
      );
    });
  }
});
