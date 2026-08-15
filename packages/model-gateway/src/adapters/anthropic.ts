import type { BuildRequestInput, ProviderAdapter, ProviderRequest } from '../adapter.js';

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

  buildRequest({ binding, credential, instructions, input }: BuildRequestInput): ProviderRequest {
    return {
      method: 'POST',
      url: binding.endpoint,
      headers: {
        'content-type': 'application/json',
        'x-api-key': credential.reveal(),
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify({
        model: binding.modelId,
        system: instructions,
        messages: [{ role: 'user', content: input }],
      }),
    };
  },
};
