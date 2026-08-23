import type { ModelBinding, ModelOperation } from '@profesor-ia/contracts';
import {
  ModelGateway,
  TransportError,
  anthropicAdapter,
  openaiAdapter,
  type CredentialResolver,
  type Transport,
  type UnpinnedIdentityWaiver,
} from '@profesor-ia/model-gateway';

import type { InjectedFault } from './case-set.js';

/**
 * Pasarela que **produce** la caída pedida, con forma de respuesta de Anthropic
 * (T-H4-10 ← P-III §6.2, D-42).
 *
 * ## Por qué vive aquí y no en el runner
 *
 * `Candidate.faultyGatewayFor` la pide a quien arma el candidato, y la razón
 * está escrita en `run.ts`: sintetizar una respuesta con forma de caída exige
 * saber la forma de la respuesta **de ese** proveedor, y ese conocimiento vive
 * en el adaptador y en quien lo elige. Una segunda copia dentro del runner sería
 * la que se queda vieja el día que el proveedor cambie el contrato.
 *
 * ## El fallo entra por debajo de la pasarela, no en su lugar
 *
 * Se sustituye el **transporte**, no la pasarela: así la respuesta sintética
 * recorre las rutas reales —traducción del adaptador, clasificación de salida,
 * reintento único— que es lo que el gate dice medir. Sustituir la pasarela
 * entera mediría el simulacro.
 *
 * **No abre una conexión y no factura**: `runBenchmark()` lleva estos casos por
 * su propia rama, sin `assertBillableAllowed()` y con costo cero medido.
 */

/** Respuesta de Anthropic con `stop_reason` y texto, tal como llega del proveedor. */
function cuerpoAnthropic(stopReason: string, texto: string): string {
  return JSON.stringify({
    stop_reason: stopReason,
    content: [{ type: 'text', text: texto }],
    // Las unidades van declaradas y no en cero: aunque estos casos no facturan,
    // un cero fabricado dentro del cuerpo enseñaría al adaptador a leer un cero
    // como dato medido. Lo que no factura es la rama del runner, no el cuerpo.
    usage: { input_tokens: 0, output_tokens: 0 },
  });
}

/**
 * Transporte que produce exactamente la caída declarada por el caso.
 *
 * Los siete modos son los de `InjectedFault`, y cada uno produce la observación
 * que el caso declaró. El runner comprueba después que lo observado coincide con
 * lo declarado; si no coincidiera, el caso cuenta como fallo del gate en vez de
 * pasar por recuperación.
 */
export function anthropicFaultTransport(fault: InjectedFault): Transport {
  return async () => {
    switch (fault.kind) {
      case 'http_status':
        return {
          status: fault.status,
          body: JSON.stringify({ type: 'error', error: { type: 'overloaded_error' } }),
        };
      case 'connection_dropped':
        throw new TransportError(
          'no se obtuvo respuesta: conexión cerrada por el otro extremo (caída simulada).',
        );
      case 'timeout':
        throw new TransportError('no se obtuvo respuesta en el tope de tiempo (caída simulada).');
      case 'truncated_body':
        // Cortado a media clave: el JSON no cierra y `stop_reason` lo declara.
        return { status: 200, body: cuerpoAnthropic('max_tokens', '{"segmentos":[{"text":"El b') };
      case 'refusal_body':
        return { status: 200, body: cuerpoAnthropic('refusal', '') };
      case 'schema_violating_text':
        // JSON válido que no es el esquema material: no hay `segmentos`.
        return {
          status: 200,
          body: cuerpoAnthropic('end_turn', '{"respuesta":"lo que sea","otra":1}'),
        };
      case 'empty_text':
        return { status: 200, body: cuerpoAnthropic('end_turn', '') };
    }
  };
}

export interface FaultyGatewayOptions {
  readonly binding: ModelBinding;
  readonly operations: readonly ModelOperation[];
  readonly credentialResolver: CredentialResolver;
}

/**
 * Fábrica de pasarelas defectuosas para un candidato de Anthropic.
 *
 * El binding y el resolver son los **mismos** que usa la pasarela sana: si
 * fueran otros, la caída se mediría contra una configuración distinta de la que
 * se está evaluando.
 */
export function anthropicFaultyGatewayFactory(
  options: FaultyGatewayOptions,
): (fault: InjectedFault) => ModelGateway {
  return (fault) =>
    new ModelGateway({
      profile: 'SESION',
      registrations: [{ binding: options.binding, operations: [...options.operations] }],
      credentialResolver: options.credentialResolver,
      adapters: [anthropicAdapter],
      transport: anthropicFaultTransport(fault),
    });
}

/**
 * Respuesta de la API de respuestas de OpenAI: `status`, bloques `output` y
 * `usage`. **No comparte forma con la de Anthropic**, por lo mismo que hay dos
 * adaptadores y no un constructor parametrizado: el truncamiento se lee de
 * `status: 'incomplete'` más `incomplete_details.reason`, y el rechazo de un
 * bloque `refusal`, no de un único `stop_reason`.
 */
function cuerpoOpenAI(
  status: string,
  texto: string,
  extra: Readonly<Record<string, unknown>> = {},
): string {
  return JSON.stringify({
    status,
    output: [{ type: 'message', content: [{ type: 'output_text', text: texto }] }],
    usage: { input_tokens: 0, output_tokens: 0 },
    ...extra,
  });
}

/** Los mismos siete modos de caída, con la forma de respuesta de OpenAI. */
export function openaiFaultTransport(fault: InjectedFault): Transport {
  return async () => {
    switch (fault.kind) {
      case 'http_status':
        return {
          status: fault.status,
          body: JSON.stringify({ error: { type: 'server_error', message: 'caída simulada' } }),
        };
      case 'connection_dropped':
        throw new TransportError(
          'no se obtuvo respuesta: conexión cerrada por el otro extremo (caída simulada).',
        );
      case 'timeout':
        throw new TransportError('no se obtuvo respuesta en el tope de tiempo (caída simulada).');
      case 'truncated_body':
        return {
          status: 200,
          body: cuerpoOpenAI('incomplete', '{"segmentos":[{"text":"El b', {
            incomplete_details: { reason: 'max_output_tokens' },
          }),
        };
      case 'refusal_body':
        return {
          status: 200,
          body: JSON.stringify({
            status: 'completed',
            output: [
              { type: 'message', content: [{ type: 'refusal', refusal: 'no puedo ayudar con eso' }] },
            ],
            usage: { input_tokens: 0, output_tokens: 0 },
          }),
        };
      case 'schema_violating_text':
        return {
          status: 200,
          body: cuerpoOpenAI('completed', '{"respuesta":"lo que sea","otra":1}'),
        };
      case 'empty_text':
        return { status: 200, body: cuerpoOpenAI('completed', '') };
    }
  };
}

export interface OpenAIFaultyGatewayOptions extends FaultyGatewayOptions {
  /**
   * Renuncia a la identidad fijada del binding. **Obligatoria aquí**: el
   * candidato de OpenAI no trae snapshot, así que sin ella la pasarela ni
   * siquiera se construye — y esta fábrica existe sólo para ese candidato.
   */
  readonly waiver: UnpinnedIdentityWaiver;
}

export function openaiFaultyGatewayFactory(
  options: OpenAIFaultyGatewayOptions,
): (fault: InjectedFault) => ModelGateway {
  return (fault) =>
    new ModelGateway({
      profile: 'SESION',
      registrations: [{ binding: options.binding, operations: [...options.operations] }],
      credentialResolver: options.credentialResolver,
      adapters: [openaiAdapter],
      transport: openaiFaultTransport(fault),
      unpinnedIdentityWaivers: [options.waiver],
    });
}
