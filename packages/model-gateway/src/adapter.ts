import type { ModelBinding, ModelOperation } from '@profesor-ia/contracts';
import type { AuthorizedParameters } from './capabilities.js';
import type { ProfileCredential } from './credentials.js';
import type { ProviderOutcome } from './output.js';

/**
 * Adaptadores **propios** (T-H4-01 ← Maestro §«Pasarela de modelo», CONGELADA:
 * «Adaptadores propios TypeScript + Zod»).
 *
 * No se usa el SDK de ningún proveedor: cada adaptador construye su propia
 * petición HTTP. Dos razones, las dos del Maestro: el invariante I-1 concentra
 * aquí todo contacto con proveedores, y «no existe un template universal de
 * petición» (P-II §8.1) — cada proveedor tiene su forma y se escribe aparte.
 *
 * El transporte se inyecta, así que las pruebas corren sin red y son
 * deterministas. La pasarela no abre sockets por su cuenta.
 */

export interface ProviderRequest {
  readonly method: 'POST';
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export interface ProviderResponse {
  readonly status: number;
  readonly body: string;
}

export type Transport = (request: ProviderRequest) => Promise<ProviderResponse>;

export interface BuildRequestInput {
  readonly binding: ModelBinding;
  readonly operation: ModelOperation;
  readonly credential: ProfileCredential;
  /**
   * Cuerpo ya construido por la capa de contexto (T-H4-04). El adaptador lo
   * coloca en la forma del proveedor; no lo inventa ni lo reescribe.
   */
  readonly instructions: string;
  readonly input: string;
  /**
   * Parámetros ya contrastados contra `ModelCapabilities` (T-H4-02). El tipo
   * solo lo produce `authorizeParameters`, así que un adaptador no puede
   * recibir parámetros sin autorizar aunque el llamante se equivoque.
   */
  readonly parameters: AuthorizedParameters;
}

export interface ProviderAdapter {
  /** Debe coincidir con `binding.provider`. */
  readonly provider: string;
  buildRequest(input: BuildRequestInput): ProviderRequest;
  /**
   * Traduce la respuesta del proveedor al resultado normalizado (T-H4-03).
   *
   * El adaptador **solo traduce**: dice qué pasó según el proveedor —salida,
   * truncamiento, rechazo, error— y nunca decide si la salida es válida. Esa
   * decisión es de `validateModelOutput`, que es independiente del proveedor.
   *
   * Ante una forma o un motivo de parada que no reconoce, lanza
   * `UnknownProviderContractError` en vez de suponer que todo fue bien.
   */
  parseResponse(response: ProviderResponse): ProviderOutcome;
}
