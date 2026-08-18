import type {
  BuildRequestInput,
  ProviderAdapter,
  ProviderRequest,
  ProviderResponse,
} from '../adapter.js';
import { UnknownProviderContractError } from '../errors.js';
import type { ProviderOutcome, ProviderUsage } from '../output.js';

/**
 * Adaptador propio para OpenAI (T-H4-01).
 *
 * Deliberadamente **no** comparte forma con el adaptador de Anthropic: la
 * autenticación va en `Authorization: Bearer` en vez de `x-api-key`, y las
 * instrucciones viajan en su propio campo en vez de en `system`. Esa diferencia
 * es la razón de que existan dos adaptadores y no un constructor parametrizado
 * (P-II §8.1: no hay plantilla universal de petición).
 *
 * Igual que el otro: el id del modelo lo trae el binding, y aquí no se escribe
 * ningún nombre ni parámetro de muestreo.
 */
export const OPENAI_PROVIDER = 'openai' as const;

export const openaiAdapter: ProviderAdapter = {
  provider: OPENAI_PROVIDER,

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
        authorization: `Bearer ${credential.reveal()}`,
      },
      // Igual que en el adaptador de Anthropic: los campos del binding se
      // escriben después de los parámetros y ganan, para que ninguno pueda
      // suplantar el id del modelo.
      body: JSON.stringify({
        ...parameters,
        model: binding.modelId,
        instructions,
        input,
      }),
    };
  },

  /**
   * Nótese que **no** comparte lógica con el adaptador de Anthropic: aquí el
   * truncamiento se lee de `status: 'incomplete'` + `incomplete_details.reason`
   * y el rechazo de un bloque `refusal`, no de un único `stop_reason`. Es la
   * misma razón por la que hay dos adaptadores y no uno parametrizado.
   */
  parseResponse(response: ProviderResponse): ProviderOutcome {
    if (response.status < 200 || response.status >= 300) {
      return { kind: 'provider_error', status: response.status, body: response.body };
    }

    let cuerpo: unknown;
    try {
      cuerpo = JSON.parse(response.body);
    } catch {
      throw new UnknownProviderContractError(
        `OpenAI devolvió 2xx con un cuerpo que no es JSON. No se supone que fue bien.`,
      );
    }

    const estado = leerCampo(cuerpo, 'status');
    const usage = leerUso(cuerpo);
    const uso = usage === undefined ? {} : { usage };
    const rechazo = primerRechazo(cuerpo);
    if (rechazo !== null) {
      return { kind: 'refusal', text: rechazo, rawStopReason: 'refusal', ...uso };
    }

    if (estado === 'completed') {
      return { kind: 'output', text: concatenarTexto(cuerpo), rawStopReason: 'completed', ...uso };
    }

    if (estado === 'incomplete') {
      const detalles = leerCampo(cuerpo, 'incomplete_details');
      const motivo =
        typeof detalles === 'object' && detalles !== null
          ? (detalles as { reason?: unknown }).reason
          : undefined;

      if (motivo === 'max_output_tokens') {
        return {
          kind: 'truncated',
          text: concatenarTexto(cuerpo),
          rawStopReason: `incomplete:${motivo}`,
          ...uso,
        };
      }
      throw new UnknownProviderContractError(
        `OpenAI devolvió status incomplete con motivo ${JSON.stringify(motivo)}, que este ` +
          `adaptador no reconoce (P-II §8.4).`,
      );
    }

    throw new UnknownProviderContractError(
      `OpenAI devolvió status ${JSON.stringify(estado)}, que este adaptador no reconoce. ` +
        `Un estado nuevo es un hallazgo que hay que ver, no un caso que absorber (P-II §8.4).`,
    );
  },
};

function leerCampo(cuerpo: unknown, campo: string): unknown {
  if (typeof cuerpo !== 'object' || cuerpo === null) return undefined;
  return (cuerpo as Record<string, unknown>)[campo];
}

function bloquesDeContenido(cuerpo: unknown): unknown[] {
  const output = leerCampo(cuerpo, 'output');
  if (!Array.isArray(output)) return [];

  return output.flatMap((item) => {
    const content = leerCampo(item, 'content');
    return Array.isArray(content) ? content : [];
  });
}

function primerRechazo(cuerpo: unknown): string | null {
  for (const bloque of bloquesDeContenido(cuerpo)) {
    const { type, refusal } = (bloque ?? {}) as { type?: unknown; refusal?: unknown };
    if (type === 'refusal' && typeof refusal === 'string') return refusal;
  }
  return null;
}

function concatenarTexto(cuerpo: unknown): string {
  return bloquesDeContenido(cuerpo)
    .map((bloque) => {
      const { type, text } = (bloque ?? {}) as { type?: unknown; text?: unknown };
      return type === 'output_text' && typeof text === 'string' ? text : '';
    })
    .join('');
}

/**
 * Lee `usage` tal como lo reporta OpenAI. Devuelve `undefined` si falta o viene
 * mal formado: no se rellena con ceros que nadie midió.
 */
function leerUso(cuerpo: unknown): ProviderUsage | undefined {
  if (typeof cuerpo !== 'object' || cuerpo === null) return undefined;
  const usage = (cuerpo as { usage?: unknown }).usage;
  if (typeof usage !== 'object' || usage === null) return undefined;

  const { input_tokens: entrada, output_tokens: salida, input_tokens_details: detalles } = usage as {
    input_tokens?: unknown;
    output_tokens?: unknown;
    input_tokens_details?: unknown;
  };
  if (typeof entrada !== 'number' || typeof salida !== 'number') return undefined;

  const cache =
    typeof detalles === 'object' && detalles !== null
      ? (detalles as { cached_tokens?: unknown }).cached_tokens
      : undefined;

  return typeof cache === 'number'
    ? { inputTokens: entrada, outputTokens: salida, cachedInputTokens: cache }
    : { inputTokens: entrada, outputTokens: salida };
}
