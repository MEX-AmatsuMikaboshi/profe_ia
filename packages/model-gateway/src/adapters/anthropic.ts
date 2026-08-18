import type {
  BuildRequestInput,
  ProviderAdapter,
  ProviderRequest,
  ProviderResponse,
} from '../adapter.js';
import { UnknownProviderContractError } from '../errors.js';
import type { ProviderOutcome, ProviderUsage } from '../output.js';

/**
 * Adaptador propio para Anthropic (T-H4-01).
 *
 * Candidato fechado 2026-08-13; el id concreto **lo trae el binding**, no este
 * módulo, y se reverifica antes del benchmark (T-H4-09). Aquí no hay ningún
 * nombre de modelo escrito: elegir uno sería anticipar un ganador que solo
 * BENCH-01/02 puede decidir.
 *
 * Tampoco hay parámetros de muestreo. `temperature`/`top_p`/`reasoning` solo
 * pueden salir de `binding.capabilities.supportedParameters`, y quien los añade
 * es T-H4-02: mandarlos desde aquí sería exactamente la «plantilla universal de
 * petición» que P-II §8.1 prohíbe.
 */
export const ANTHROPIC_PROVIDER = 'anthropic' as const;

/**
 * Versión del contrato HTTP del proveedor, no del modelo. Vive en el adaptador
 * y no en el binding porque describe la forma de la petición que construye este
 * módulo; el refresco documental de T-H4-09 la reverifica con lo demás.
 */
const ANTHROPIC_API_VERSION = '2023-06-01';

export const anthropicAdapter: ProviderAdapter = {
  provider: ANTHROPIC_PROVIDER,

  buildRequest({
    binding,
    credential,
    instructions,
    input,
    parameters,
  }: BuildRequestInput): ProviderRequest {
    return {
      method: 'POST',
      url: binding.endpoint,
      headers: {
        'content-type': 'application/json',
        'x-api-key': credential.reveal(),
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      // Los parámetros autorizados van primero: los campos que fija el binding
      // se escriben después y ganan, de modo que ningún parámetro declarado
      // pueda suplantar el id del modelo y romper la identidad del binding.
      body: JSON.stringify({
        ...parameters,
        model: binding.modelId,
        system: instructions,
        messages: [{ role: 'user', content: input }],
      }),
    };
  },

  parseResponse(response: ProviderResponse): ProviderOutcome {
    if (response.status < 200 || response.status >= 300) {
      return { kind: 'provider_error', status: response.status, body: response.body };
    }

    let cuerpo: unknown;
    try {
      cuerpo = JSON.parse(response.body);
    } catch {
      throw new UnknownProviderContractError(
        `Anthropic devolvió 2xx con un cuerpo que no es JSON. No se supone que fue bien.`,
      );
    }

    const stopReason = leerStopReason(cuerpo);
    const texto = concatenarTexto(cuerpo);
    const usage = leerUso(cuerpo);
    const uso = usage === undefined ? {} : { usage };

    switch (stopReason) {
      case 'end_turn':
      case 'stop_sequence':
        return { kind: 'output', text: texto, rawStopReason: stopReason, ...uso };
      case 'max_tokens':
        return { kind: 'truncated', text: texto, rawStopReason: stopReason, ...uso };
      case 'refusal':
        return { kind: 'refusal', text: texto, rawStopReason: stopReason, ...uso };
      default:
        throw new UnknownProviderContractError(
          `Anthropic devolvió el motivo de parada ${JSON.stringify(stopReason)}, que este ` +
            `adaptador no reconoce. Un motivo nuevo es un hallazgo que hay que ver, no un caso ` +
            `que absorber (P-II §8.4).`,
        );
    }
  },
};

function leerStopReason(cuerpo: unknown): unknown {
  if (typeof cuerpo !== 'object' || cuerpo === null) return undefined;
  return (cuerpo as { stop_reason?: unknown }).stop_reason;
}

/** Concatena los bloques de texto; los demás tipos de bloque no son texto. */
function concatenarTexto(cuerpo: unknown): string {
  if (typeof cuerpo !== 'object' || cuerpo === null) return '';
  const content = (cuerpo as { content?: unknown }).content;
  if (!Array.isArray(content)) return '';

  return content
    .map((bloque) => {
      if (typeof bloque !== 'object' || bloque === null) return '';
      const { type, text } = bloque as { type?: unknown; text?: unknown };
      return type === 'text' && typeof text === 'string' ? text : '';
    })
    .join('');
}

/**
 * Lee `usage` tal como lo reporta Anthropic. Devuelve `undefined` si falta o
 * viene mal formado: **no se rellena con ceros**, porque un cero fabricado
 * haría parecer el gasto menor del real y el ledger lo daría por medido.
 */
function leerUso(cuerpo: unknown): ProviderUsage | undefined {
  if (typeof cuerpo !== 'object' || cuerpo === null) return undefined;
  const usage = (cuerpo as { usage?: unknown }).usage;
  if (typeof usage !== 'object' || usage === null) return undefined;

  const { input_tokens: entrada, output_tokens: salida, cache_read_input_tokens: cache } =
    usage as {
      input_tokens?: unknown;
      output_tokens?: unknown;
      cache_read_input_tokens?: unknown;
    };
  if (typeof entrada !== 'number' || typeof salida !== 'number') return undefined;

  return typeof cache === 'number'
    ? { inputTokens: entrada, outputTokens: salida, cachedInputTokens: cache }
    : { inputTokens: entrada, outputTokens: salida };
}
