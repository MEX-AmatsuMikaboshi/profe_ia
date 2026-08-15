import type { BuildRequestInput, ProviderAdapter, ProviderRequest } from '../adapter.js';

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

  buildRequest({ binding, credential, instructions, input }: BuildRequestInput): ProviderRequest {
    return {
      method: 'POST',
      url: binding.endpoint,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${credential.reveal()}`,
      },
      body: JSON.stringify({
        model: binding.modelId,
        instructions,
        input,
      }),
    };
  },
};
