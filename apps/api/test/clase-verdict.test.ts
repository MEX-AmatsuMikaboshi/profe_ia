import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { handleVerdictRequest, VerdictRequestBody } from '../src/clase-verdict-route.js';
import {
  VerdictError,
  awaitVerdict,
  submitToSpool,
  type SpoolPaths,
  type SpoolTiming,
} from '../src/verdict-spool.js';

/**
 * T-H6-13. `apps/api` no verifica: lleva la derivación al verificador aislado
 * (D-12, I-3) y devuelve lo que este dijo. Lo que se comprueba aquí es que el
 * canal no fabrica veredictos cuando el verificador no contesta.
 */

function makeSpool(): SpoolPaths {
  const root = mkdtempSync(join(tmpdir(), 'clase-verdict-'));
  const paths = {
    inbox: join(root, 'in'),
    outbox: join(root, 'out'),
    failed: join(root, 'failed'),
  };
  for (const dir of Object.values(paths)) mkdirSync(dir, { recursive: true });
  return paths;
}

/** Reloj y espera falsos: la prueba no depende del reloj real ni tarda. */
function makeTiming(overrides: Partial<SpoolTiming> = {}): SpoolTiming {
  let clock = 0;
  return {
    pollMs: 10,
    timeoutMs: 100,
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
    ...overrides,
  };
}

const VALID_RESULT = {
  valid: true,
  goalReached: true,
  errors: [],
  semanticCheck: 'passed',
  authorizedCalculusVersion: 'authorized-calculus-v1',
  verifierVersion: '0.1.0',
};

const PROOF = {
  lines: [
    { formula: 'A∧B', rule: 'PR', depth: 0 },
    { formula: 'A', rule: '∧E', refs: [1], depth: 0 },
  ],
  goal: 'A',
};

describe('canal de veredicto de Clase (T-H6-13)', () => {
  it('escribe en el spool de forma atómica: nada visible a medio escribir', () => {
    const paths = makeSpool();
    submitToSpool(paths, 'sub1', PROOF);
    const entries = readdirSync(paths.inbox);
    // El verificador procesa todo `.json` que ve; un parcial con esa extensión
    // le haría leer un archivo incompleto y contestar «ilegible» a una
    // derivación que estaba bien.
    expect(entries).toEqual(['sub1.json']);
    expect(JSON.parse(readFileSync(join(paths.inbox, 'sub1.json'), 'utf8'))).toEqual(PROOF);
  });

  it('devuelve el veredicto del verificador tal cual', async () => {
    const paths = makeSpool();
    writeFileSync(join(paths.outbox, 'sub1.json'), JSON.stringify(VALID_RESULT), 'utf8');
    const result = await awaitVerdict(paths, makeTiming(), 'sub1');
    expect(result.valid).toBe(true);
    expect(result.goalReached).toBe(true);
    expect(result.verifierVersion).toBe('0.1.0');
  });

  it('conserva `goalReached` separado de `valid` (D-9)', async () => {
    const paths = makeSpool();
    // Derivación impecable de otra cosa: válida y no resuelve el reactivo.
    writeFileSync(
      join(paths.outbox, 'sub1.json'),
      JSON.stringify({ ...VALID_RESULT, goalReached: false }),
      'utf8',
    );
    const result = await awaitVerdict(paths, makeTiming(), 'sub1');
    expect(result.valid).toBe(true);
    expect(result.goalReached).toBe(false);
  });

  it('agotar el plazo lanza: no inventa un veredicto negativo', async () => {
    const paths = makeSpool();
    await expect(awaitVerdict(paths, makeTiming(), 'sub1')).rejects.toMatchObject({
      code: 'VERIFICADOR_SIN_RESPUESTA',
    });
  });

  it('una entrada apartada por el verificador es error de canal, no del alumno', async () => {
    const paths = makeSpool();
    writeFileSync(join(paths.failed, 'sub1.json.error'), '{"detail":"ilegible"}', 'utf8');
    await expect(awaitVerdict(paths, makeTiming(), 'sub1')).rejects.toMatchObject({
      code: 'VERIFICADOR_RECHAZO_ENTRADA',
    });
  });

  it('un veredicto fuera de contrato no se rellena: lanza', async () => {
    const paths = makeSpool();
    writeFileSync(join(paths.outbox, 'sub1.json'), JSON.stringify({ valid: true }), 'utf8');
    await expect(awaitVerdict(paths, makeTiming(), 'sub1')).rejects.toBeInstanceOf(VerdictError);
  });

  it('un veredicto ilegible tampoco se disfraza', async () => {
    const paths = makeSpool();
    writeFileSync(join(paths.outbox, 'sub1.json'), 'no es json', 'utf8');
    await expect(awaitVerdict(paths, makeTiming(), 'sub1')).rejects.toMatchObject({
      code: 'VEREDICTO_ILEGIBLE',
    });
  });

  it('rechaza un submissionId que se saldría del directorio del spool', () => {
    for (const submissionId of ['../fuera', 'a/b', 'con espacio', '', '.']) {
      expect(VerdictRequestBody.safeParse({ submissionId, proof: PROOF }).success).toBe(false);
    }
    expect(VerdictRequestBody.safeParse({ submissionId: 'sub-1_A', proof: PROOF }).success).toBe(
      true,
    );
  });

  it('una solicitud malformada vuelve 400 sin tocar el spool', async () => {
    const paths = makeSpool();
    const response = await handleVerdictRequest(
      { paths, timing: makeTiming() },
      { submissionId: 'sub1', proof: { lines: [] } },
    );
    expect(response.status).toBe(400);
    expect(readdirSync(paths.inbox)).toEqual([]);
  });

  it('un fallo del canal vuelve 502, nunca un veredicto', async () => {
    const paths = makeSpool();
    const response = await handleVerdictRequest(
      { paths, timing: makeTiming() },
      { submissionId: 'sub1', proof: PROOF },
    );
    expect(response.status).toBe(502);
    expect(JSON.stringify(response.body)).not.toContain('"valid"');
  });

  it('la ruta feliz responde 200 con el veredicto del verificador', async () => {
    const paths = makeSpool();
    writeFileSync(join(paths.outbox, 'sub1.json'), JSON.stringify(VALID_RESULT), 'utf8');
    const response = await handleVerdictRequest(
      { paths, timing: makeTiming() },
      { submissionId: 'sub1', proof: PROOF },
    );
    expect(response.status).toBe(200);
    if (response.status === 200) {
      expect(response.body.decidedBy).toBe('verifier');
      expect(response.body.verification.valid).toBe(true);
    }
  });
});
