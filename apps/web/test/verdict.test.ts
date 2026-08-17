import { describe, expect, it } from 'vitest';

import {
  VerdictChannelError,
  createHttpVerdictPort,
  submitForVerdict,
  type FetchLike,
  type VerdictPort,
} from '../src/clase/verdict';

/**
 * T-H6-13. El cliente pide el veredicto; no lo calcula ni lo adelanta. Y un
 * fallo del canal **no** es un veredicto negativo.
 */

const PROOF = { lines: [{ formula: 'A', rule: 'PR', depth: 0 }] };

const VERIFICACION = {
  valid: true,
  goalReached: true,
  errors: [],
  semanticCheck: 'passed' as const,
  authorizedCalculusVersion: 'authorized-calculus-v1',
  verifierVersion: '0.1.0',
};

function fetchQueDevuelve(status: number, payload: unknown): FetchLike {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  });
}

describe('canal de veredicto del cliente (T-H6-13)', () => {
  it('devuelve el veredicto del verificador y lo marca autoritativo', async () => {
    const port = createHttpVerdictPort(
      fetchQueDevuelve(200, { verification: VERIFICACION, decidedBy: 'verifier' }),
    );
    const verdict = await port.requestVerdict('sub1', PROOF);
    expect(verdict.authoritative).toBe(true);
    expect(verdict.decidedBy).toBe('verifier');
    expect(verdict.verification.valid).toBe(true);
  });

  it('una respuesta 200 que no declara quién decidió no se acepta', async () => {
    const port = createHttpVerdictPort(fetchQueDevuelve(200, { verification: VERIFICACION }));
    await expect(port.requestVerdict('sub1', PROOF)).rejects.toMatchObject({
      code: 'VEREDICTO_SIN_AUTORIDAD',
    });
  });

  it('un 502 del canal se propaga con su código', async () => {
    const port = createHttpVerdictPort(
      fetchQueDevuelve(502, { code: 'VERIFICADOR_SIN_RESPUESTA', detail: 'sin veredicto' }),
    );
    await expect(port.requestVerdict('sub1', PROOF)).rejects.toBeInstanceOf(VerdictChannelError);
  });

  it('el fallo del canal es una rama distinta, no un veredicto negativo', async () => {
    const port: VerdictPort = {
      requestVerdict: async () => {
        throw new VerdictChannelError('VERIFICADOR_SIN_RESPUESTA', 'sin veredicto');
      },
    };
    const state = await submitForVerdict(port, 'sub1', PROOF);
    expect(state.kind).toBe('canal_fallido');
    // Lo que importa: en ningún punto aparece un `valid: false` inventado.
    expect(JSON.stringify(state)).not.toContain('"valid"');
  });

  it('un error inesperado tampoco se convierte en veredicto', async () => {
    const port: VerdictPort = {
      requestVerdict: async () => {
        throw new TypeError('red caída');
      },
    };
    const state = await submitForVerdict(port, 'sub1', PROOF);
    expect(state).toMatchObject({ kind: 'canal_fallido', failure: { code: 'CANAL_INDISPONIBLE' } });
  });

  it('la ruta feliz produce el estado de veredicto', async () => {
    const port = createHttpVerdictPort(
      fetchQueDevuelve(200, { verification: VERIFICACION, decidedBy: 'verifier' }),
    );
    const state = await submitForVerdict(port, 'sub1', PROOF);
    expect(state.kind).toBe('veredicto');
  });

  it('envía la derivación tal cual, sin recortarla', async () => {
    let enviado: string | null = null;
    const fetchImpl: FetchLike = async (_input, init) => {
      enviado = init.body;
      return { ok: true, status: 200, json: async () => ({ verification: VERIFICACION, decidedBy: 'verifier' }) };
    };
    await createHttpVerdictPort(fetchImpl).requestVerdict('sub1', PROOF);
    expect(JSON.parse(enviado ?? '{}')).toEqual({ submissionId: 'sub1', proof: PROOF });
  });
});
