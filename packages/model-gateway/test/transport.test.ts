import { describe, expect, it, vi } from 'vitest';

import { httpTransport } from '../src/transport.js';
import { TransportError } from '../src/errors.js';
import type { ProviderRequest } from '../src/adapter.js';

/**
 * Transporte HTTP real (T-H4-10).
 *
 * Las propiedades que importan no son «hace una petición», sino las que
 * protegen el gasto y la credencial: no reintenta, no sigue redirecciones, no
 * traga un timeout, y devuelve 4xx/5xx como respuesta en vez de excepción para
 * que el adaptador los traduzca.
 */

const PETICION: ProviderRequest = {
  method: 'POST',
  url: 'https://api.ejemplo.invalid/v1/messages',
  headers: { 'x-api-key': 'sk-secreta-no-debe-aparecer', 'content-type': 'application/json' },
  body: '{"modelo":"x"}',
};

const respuesta = (status: number, body: string): Response =>
  new Response(body, { status }) as unknown as Response;

describe('httpTransport', () => {
  it('exige un timeout positivo: una corrida facturable no se cuelga por omisión', () => {
    expect(() => httpTransport({ timeoutMs: 0 })).toThrow(TransportError);
    expect(() => httpTransport({ timeoutMs: -1 })).toThrow(TransportError);
    expect(() => httpTransport({ timeoutMs: Number.NaN })).toThrow(TransportError);
    expect(() => httpTransport({ timeoutMs: Number.POSITIVE_INFINITY })).toThrow(TransportError);
  });

  it('envía método, url, cabeceras y cuerpo tal como los construyó el adaptador', async () => {
    const fetchImpl = vi.fn(async () => respuesta(200, '{"ok":true}'));
    const transport = httpTransport({ timeoutMs: 1_000, fetchImpl: fetchImpl as never });

    await transport(PETICION);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(PETICION.url);
    expect(init.method).toBe('POST');
    expect(init.body).toBe(PETICION.body);
    expect(init.headers).toEqual(PETICION.headers);
  });

  it('no sigue redirecciones: reenviarían la credencial a otro host', async () => {
    const fetchImpl = vi.fn(async () => respuesta(200, '{}'));
    const transport = httpTransport({ timeoutMs: 1_000, fetchImpl: fetchImpl as never });

    await transport(PETICION);

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.redirect).toBe('error');
  });

  it('devuelve 4xx y 5xx como respuesta, porque traducirlos es del adaptador', async () => {
    for (const status of [400, 401, 429, 500, 529]) {
      const fetchImpl = vi.fn(async () => respuesta(status, '{"error":"x"}'));
      const transport = httpTransport({ timeoutMs: 1_000, fetchImpl: fetchImpl as never });

      await expect(transport(PETICION)).resolves.toEqual({ status, body: '{"error":"x"}' });
    }
  });

  it('lanza cuando no hay respuesta, y no reintenta', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    const transport = httpTransport({ timeoutMs: 1_000, fetchImpl: fetchImpl as never });

    await expect(transport(PETICION)).rejects.toThrow(TransportError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('no filtra la credencial ni el cuerpo en el mensaje de error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('fallo de red');
    });
    const transport = httpTransport({ timeoutMs: 1_000, fetchImpl: fetchImpl as never });

    const error = await transport(PETICION).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TransportError);
    const mensaje = (error as Error).message;
    expect(mensaje).not.toContain('sk-secreta-no-debe-aparecer');
    expect(mensaje).not.toContain(PETICION.body);
    expect(mensaje).toContain(PETICION.url);
  });

  it('aborta al vencer el timeout y lo dice en el mensaje', async () => {
    const fetchImpl = vi.fn(
      async (_url: string, init: RequestInit) =>
        await new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new Error('The operation was aborted.'));
          });
        }),
    );
    const transport = httpTransport({ timeoutMs: 20, fetchImpl: fetchImpl as never });

    const error = await transport(PETICION).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TransportError);
    expect((error as Error).message).toContain('sin respuesta en 20 ms');
  });

  it('lanza si el cuerpo de la respuesta es ilegible', async () => {
    const cuerpoRoto = {
      status: 200,
      text: async () => {
        throw new Error('stream cortado');
      },
    } as unknown as Response;
    const fetchImpl = vi.fn(async () => cuerpoRoto);
    const transport = httpTransport({ timeoutMs: 1_000, fetchImpl: fetchImpl as never });

    await expect(transport(PETICION)).rejects.toThrow(TransportError);
  });
});
