import type { ProviderRequest, ProviderResponse, Transport } from './adapter.js';
import { TransportError } from './errors.js';

/**
 * Transporte HTTP real (T-H4-10 ← P-II §8.1, I-1).
 *
 * Es el **único** lugar del repositorio que abre una conexión a un proveedor.
 * Hasta ahora el transporte siempre se inyectaba falso, que es lo que mantiene
 * a las pruebas sin red y deterministas; esto no cambia esa propiedad, sólo
 * añade la implementación que la corrida material necesita. La pasarela lo
 * sigue recibiendo por inyección: nadie lo alcanza por accidente.
 *
 * ## Lo que deliberadamente no hace
 *
 * **No reintenta.** Un reintento automático sobre una petición que ya llegó al
 * proveedor la cobra dos veces, y el fallo que lo motiva —un timeout— es
 * exactamente el caso en que no se sabe si llegó. Reintentar es una decisión de
 * la corrida, que además debe contarla: `T-H4-10` mide «utilizables **tras un
 * reintento**» y ese reintento tiene que ser visible, no escondido aquí.
 *
 * **No sigue redirecciones.** Un 3xx en un POST autenticado reenviaría la
 * credencial a otro host. Se trata como error, no como camino alterno.
 *
 * **No registra cuerpos ni cabeceras.** Las cabeceras llevan la credencial y el
 * cuerpo lleva trabajo del alumno. Un log de depuración aquí sería una fuga.
 *
 * **No interpreta el estado.** Un 4xx o un 5xx se devuelven como
 * `ProviderResponse` para que el adaptador los traduzca (T-H4-03); convertirlos
 * en excepción aquí robaría al adaptador la información del error del
 * proveedor. Sólo lo que impide obtener una respuesta —red caída, timeout,
 * redirección— lanza.
 */

export interface HttpTransportOptions {
  /**
   * Tope de tiempo por petición. Sin valor por omisión a propósito: una corrida
   * facturable con un timeout implícito puede quedarse colgada gastando.
   */
  readonly timeoutMs: number;
  /**
   * Inyectable para las pruebas. Por omisión, el `fetch` global de Node 24.
   * No se usa SDK de proveedor (CONGELADA: «adaptadores propios»).
   */
  readonly fetchImpl?: typeof globalThis.fetch;
}

export function httpTransport(options: HttpTransportOptions): Transport {
  const { timeoutMs } = options;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TransportError(`timeoutMs debe ser un número positivo; llegó ${String(timeoutMs)}.`);
  }
  const doFetch = options.fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== 'function') {
    throw new TransportError('no hay implementación de fetch disponible.');
  }

  return async (request: ProviderRequest): Promise<ProviderResponse> => {
    const abort = new AbortController();
    const temporizador = setTimeout(() => {
      abort.abort();
    }, timeoutMs);

    let respuesta: Response;
    try {
      respuesta = await doFetch(request.url, {
        method: request.method,
        headers: { ...request.headers },
        body: request.body,
        redirect: 'error',
        signal: abort.signal,
      });
    } catch (error) {
      // El mensaje no incluye ni cabeceras ni cuerpo: sólo destino y causa.
      const causa = error instanceof Error ? error.message : String(error);
      const motivo = abort.signal.aborted ? `sin respuesta en ${timeoutMs} ms` : causa;
      throw new TransportError(
        `no se obtuvo respuesta de ${request.url}: ${motivo}. ` +
          'No se reintenta: la petición pudo haber llegado y se cobraría dos veces.',
      );
    } finally {
      clearTimeout(temporizador);
    }

    let body: string;
    try {
      body = await respuesta.text();
    } catch (error) {
      const causa = error instanceof Error ? error.message : String(error);
      throw new TransportError(`respuesta de ${request.url} ilegible: ${causa}.`);
    }

    return { status: respuesta.status, body };
  };
}
