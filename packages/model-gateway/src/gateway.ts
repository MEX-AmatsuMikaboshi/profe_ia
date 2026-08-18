import type { ModelBinding, ModelOperation, ModelProfile } from '@profesor-ia/contracts';
import type { ZodType } from 'zod';
import type { BuildRequestInput, ProviderAdapter, ProviderRequest, Transport } from './adapter.js';
import { assertBindingUsable, authorizeParameters, NO_PARAMETERS } from './capabilities.js';
import { ProfileCredential, type CredentialResolver } from './credentials.js';
import {
  validateModelOutput,
  type CodeFencePolicy,
  type ValidatedOutput,
} from './output.js';
import {
  AmbiguousBindingError,
  OperationNotAuthorizedForProfileError,
  ProfileMismatchError,
  UnknownProviderError,
} from './errors.js';

/**
 * Pasarela de modelo por perfil (T-H4-01 ← P-II §8.2).
 *
 * Una instancia sirve a **un** perfil. No existe una pasarela «de los dos»: es
 * lo que hace que la separación de credenciales sea estructural y no una
 * convención que alguien pueda saltarse con un parámetro.
 */

/**
 * Registro de un binding con las operaciones que sirve.
 *
 * `operations` es obligatorio y sin valor por omisión. Ver D-15 y el comentario
 * de `operations.ts`: ninguna autoridad tabula qué operación corre bajo qué
 * perfil, así que el reparto entra como dato y la pasarela rechaza lo que no
 * esté declarado, en vez de suponerlo.
 */
export interface BindingRegistration {
  readonly binding: ModelBinding;
  readonly operations: readonly ModelOperation[];
}

export interface ModelGatewayOptions {
  readonly profile: ModelProfile;
  readonly registrations: readonly BindingRegistration[];
  readonly credentialResolver: CredentialResolver;
  readonly adapters: readonly ProviderAdapter[];
  readonly transport: Transport;
}

export interface DispatchInput {
  readonly operation: ModelOperation;
  readonly instructions: string;
  readonly input: string;
  /**
   * Parámetros **solicitados**, aún sin autorizar (T-H4-02). La pasarela los
   * contrasta contra `ModelCapabilities` del binding que va a atender la
   * operación y falla localmente ante uno desconocido o rechazado. Omitirlo es
   * no enviar ninguno, que es el caso por omisión.
   */
  readonly parameters?: Readonly<Record<string, unknown>>;
}

export interface ExecuteInput<T> extends DispatchInput {
  /** Esquema local contra el que se valida la salida (T-H4-03). Obligatorio. */
  readonly schema: ZodType<T>;
  /** Intento, para distinguir el reintento único que permite BENCH-01. */
  readonly attempt?: number;
  /**
   * Qué hacer con una salida envuelta en un bloque de código. **Obligatorio y
   * sin valor por omisión**: normalizar sólo vale «cuando el contrato lo
   * autorice» (P-II §8.4), así que la autorización se escribe aquí, en el sitio
   * que llama, y no la elige la pasarela por nadie.
   */
  readonly codeFence: CodeFencePolicy;
}

export class ModelGateway {
  readonly profile: ModelProfile;

  readonly #byOperation: ReadonlyMap<ModelOperation, BindingRegistration>;
  readonly #adapters: ReadonlyMap<string, ProviderAdapter>;
  readonly #credential: ProfileCredential;
  readonly #transport: Transport;

  constructor(options: ModelGatewayOptions) {
    this.profile = options.profile;
    this.#transport = options.transport;

    // La credencial se resuelve **una vez, para este perfil**. La pasarela no
    // guarda el resolver, así que no tiene camino hacia la del otro perfil.
    this.#credential = ProfileCredential.resolve(options.profile, options.credentialResolver);

    const byOperation = new Map<ModelOperation, BindingRegistration>();
    for (const registration of options.registrations) {
      const { binding, operations } = registration;

      // Un binding sin snapshot ni huella, o con capacidades contradictorias, no
      // llega a registrarse: fallar al arrancar es preferible a descubrirlo en
      // la primera llamada facturable (T-H4-02).
      assertBindingUsable(binding);

      if (binding.profile !== options.profile) {
        throw new ProfileMismatchError(
          `El binding ${binding.bindingId} declara el perfil ${binding.profile} y esta pasarela ` +
            `sirve a ${options.profile}. Un binding no cambia de perfil al registrarse.`,
        );
      }

      for (const operation of operations) {
        const previous = byOperation.get(operation);
        if (previous !== undefined) {
          // No gana el primero: una pasarela ambigua mandaría tráfico a un
          // modelo indeterminado, y eso no es un empate, es un fallo.
          throw new AmbiguousBindingError(
            `Los bindings ${previous.binding.bindingId} y ${binding.bindingId} declaran ambos la ` +
              `operación ${operation} en el perfil ${options.profile}.`,
          );
        }
        byOperation.set(operation, registration);
      }
    }
    this.#byOperation = byOperation;

    const adapters = new Map<string, ProviderAdapter>();
    for (const adapter of options.adapters) {
      adapters.set(adapter.provider, adapter);
    }
    this.#adapters = adapters;
  }

  /** Operaciones que esta pasarela sirve, en el orden declarado. */
  authorizedOperations(): readonly ModelOperation[] {
    return Object.freeze([...this.#byOperation.keys()]);
  }

  /**
   * Resuelve binding y adaptador. Falla cerrado si la operación no está
   * declarada para este perfil o si no hay adaptador propio del proveedor.
   */
  resolve(operation: ModelOperation): { binding: ModelBinding; adapter: ProviderAdapter } {
    const registration = this.#byOperation.get(operation);
    if (registration === undefined) {
      throw new OperationNotAuthorizedForProfileError(
        `La operación ${operation} no está declarada para el perfil ${this.profile}. ` +
          `El reparto operación↔perfil es dato de configuración (D-15), no un valor por omisión.`,
      );
    }

    const adapter = this.#adapters.get(registration.binding.provider);
    if (adapter === undefined) {
      throw new UnknownProviderError(
        `No hay adaptador propio para el proveedor ${registration.binding.provider} ` +
          `(binding ${registration.binding.bindingId}).`,
      );
    }

    return { binding: registration.binding, adapter };
  }

  /** Construye la petición saliente sin enviarla. Útil para inspeccionarla. */
  buildRequest(input: DispatchInput): ProviderRequest {
    const { binding, adapter } = this.resolve(input.operation);
    const parameters =
      input.parameters === undefined
        ? NO_PARAMETERS
        : authorizeParameters(binding, input.parameters);

    const buildInput: BuildRequestInput = {
      binding,
      operation: input.operation,
      credential: this.#credential,
      instructions: input.instructions,
      input: input.input,
      parameters,
    };
    return adapter.buildRequest(buildInput);
  }

  /**
   * Envía, traduce con el adaptador y **valida localmente** (T-H4-03).
   *
   * No existe un camino que devuelva la salida cruda del proveedor: P-II §8.4
   * dice que la salida estructurada del proveedor no es evidencia suficiente de
   * validez, así que exponer un `send()` sin validar sería precisamente el
   * agujero que esa norma cierra. Los datos solo son alcanzables tras estrechar
   * por `classification === 'valid'`.
   */
  async execute<T>(input: ExecuteInput<T>): Promise<ValidatedOutput<T>> {
    const { binding, adapter } = this.resolve(input.operation);
    const request = this.buildRequest(input);
    const response = await this.#transport(request);

    return validateModelOutput({
      operation: input.operation,
      bindingId: binding.bindingId,
      outcome: adapter.parseResponse(response),
      schema: input.schema,
      attempt: input.attempt ?? 1,
      codeFence: input.codeFence,
    });
  }
}
