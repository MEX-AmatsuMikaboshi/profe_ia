import { ModelBinding } from '@profesor-ia/contracts';
import {
  BudgetBlockedError,
  BudgetController,
  CostLedger,
  ModelGateway,
  PRICING_MANIFEST_2026_08_18,
  anthropicAdapter,
  type ProviderRequest,
  type Transport,
} from '@profesor-ia/model-gateway';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { partitionBySeed, type BenchCase, type CaseSet } from '../src/case-set.js';
import { BenchRunError, runBenchmark, sha256, type Candidate, type RunPlan } from '../src/run.js';

/**
 * Runner de BENCH-01 (T-H4-10).
 *
 * **Ninguna prueba toca la red ni gasta**: el transporte se inyecta falso, que
 * es exactamente la propiedad que permite ejercitar el único punto del
 * repositorio donde se gasta dinero sin gastar ninguno.
 *
 * Expectativas declaradas antes de ejecutar: el presupuesto se comprueba
 * **antes** de salir a la red, un uso no reportado detiene la corrida, el
 * reintento es único y se cuenta, y un plan congelado tarde queda rechazado.
 */

const REFRESHED_AT = '2026-08-18T09:00:00.000Z';
const STARTED_AT = '2026-08-18T09:30:00.000Z';
const FROZEN_AT = '2026-08-18T08:00:00.000Z';
const HASH = 'a'.repeat(64);

const MODEL_ID = 'claude-sonnet-5';

const respuesta = (texto: string, usage?: unknown) => ({
  status: 200,
  body: JSON.stringify({
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: texto }],
    ...(usage === undefined ? {} : { usage }),
  }),
});

const USO = { input_tokens: 1_000, output_tokens: 500 };

function transporteQueDevuelve(
  respuestas: readonly { status: number; body: string }[],
): { transport: Transport; sent: ProviderRequest[] } {
  const sent: ProviderRequest[] = [];
  let i = 0;
  const transport: Transport = async (request) => {
    sent.push(request);
    const r = respuestas[Math.min(i, respuestas.length - 1)];
    i += 1;
    return r ?? { status: 200, body: '{}' };
  };
  return { transport, sent };
}

const BINDING = ModelBinding.parse({
  bindingId: 'binding-sesion-anthropic',
  profile: 'SESION',
  provider: 'anthropic',
  modelId: MODEL_ID,
  endpoint: 'https://api.anthropic.com/v1/messages',
  snapshot: 'claude-sonnet-5-20260813',
  capabilities: {
    supportedParameters: [],
    rejectedParameters: [],
    structuredOutput: { supported: true },
    reasoning: { supported: false },
    batch: { supported: false },
    caching: { supported: false },
    dataPolicy: { contractualEligibility: 'unknown' },
  },
  verifiedAt: REFRESHED_AT,
});

function candidato(respuestas: readonly { status: number; body: string }[]): {
  candidate: Candidate;
  sent: ProviderRequest[];
} {
  const { transport, sent } = transporteQueDevuelve(respuestas);
  const gateway = new ModelGateway({
    profile: 'SESION',
    registrations: [{ binding: BINDING, operations: ['explain_block'] }],
    credentialResolver: () => 'secreto-de-sesion',
    adapters: [anthropicAdapter],
    transport,
  });
  return { candidate: { candidateId: MODEL_ID, binding: BINDING, gateway }, sent };
}

const CASO: BenchCase = {
  caseId: 'expl-1',
  family: 'explanation_request',
  operation: 'explain_block',
  input: 'explica ∨E',
  expectation: {
    structurallyUsable: true,
    mustDeclareOutOfScope: false,
    mustRefuseSolutionDisclosure: false,
    mustRecoverToDegraded: false,
  },
};

const CONJUNTO: CaseSet = { caseSetId: 'cs-piloto', purpose: 'pilot', cases: [CASO] };

const REFRESH_RECORD = {
  schemaVersion: 'documentary-refresh-v1',
  refreshId: 'refresh-prueba',
  purpose: 'test_fixture',
  refreshedAt: REFRESHED_AT,
  candidates: [
    {
      candidateId: MODEL_ID,
      provider: 'anthropic',
      profile: 'SESION',
      modelId: MODEL_ID,
      endpoint: 'https://api.anthropic.com/v1/messages',
      snapshot: 'claude-sonnet-5-20260813',
      supportedParameters: ['max_tokens'],
      rejectedParameters: ['top_k'],
      snapshotAliasPolicy: 'snapshots fechados',
      deprecation: { deprecated: false },
      dataPolicy: {
        region: { known: true, value: 'us' },
        logging: { known: true, value: 'sin entrenamiento' },
        retention: { known: true, value: '30 días' },
        contractualEligibility: { known: false, reason: 'no_publicado_por_el_proveedor' },
      },
      sources: [{ url: 'https://docs.example/m', retrievedAt: REFRESHED_AT, contentSha256: HASH }],
      refreshedAt: REFRESHED_AT,
    },
  ],
};

const REFRESH_WINDOW = {
  parameterId: 'refresh-window-h4',
  maxAgeSeconds: 86_400,
  purpose: 'test_fixture',
  provenance: 'ventana de 24 h fijada por el propietario el 2026-08-18',
};

/** Instrucciones del fixture. Una sola copia: el plan las hashea y las deps las envían,
 * y `assertInstructionsDigestMatches()` comprueba que son la misma (D-80). */
const INSTRUCCIONES = 'instrucciones de sesión';

const PLAN: RunPlan = {
  runId: 'bench-01-piloto',
  purpose: 'pilot',
  repetitions: 1,
  frozenAt: FROZEN_AT,
  startedAt: STARTED_AT,
  partitionSeed: 20260818,
  instructionsSha256: sha256(INSTRUCCIONES),
};

function dependencias(overrides: { alertThresholdMxn?: number } = {}) {
  const ledger = new CostLedger();
  const budget = new BudgetController(ledger, {
    alertThresholdMxn: overrides.alertThresholdMxn ?? 400,
  });
  return {
    ledger,
    budget,
    manifest: PRICING_MANIFEST_2026_08_18,
    refreshRecord: REFRESH_RECORD,
    refreshWindow: REFRESH_WINDOW,
    schema: z.object({ ok: z.boolean() }),
    codeFence: 'reject' as const,
    instructions: INSTRUCCIONES,
  };
}

const particion = () => partitionBySeed(CONJUNTO, 1, 0.5);

describe('plan congelado', () => {
  it('rechaza un plan congelado después de arrancar', async () => {
    const { candidate } = candidato([respuesta('{"ok":true}', USO)]);
    await expect(
      runBenchmark(
        { ...PLAN, frozenAt: '2026-08-18T10:00:00.000Z' },
        particion(),
        [candidate],
        dependencias(),
      ),
    ).rejects.toThrow(BenchRunError);
  });

  // D-80 — la proveniencia de la corrida: con qué partición y con qué prompt.
  it('rechaza un plan cuya huella no corresponde a las instrucciones enviadas', async () => {
    // Control positivo. Sin esto el campo sería decorativo: dos copias del
    // mismo hecho, y la que se queda vieja es siempre la copia.
    const { candidate } = candidato([respuesta('{"ok":true}', USO)]);
    await expect(
      runBenchmark(
        { ...PLAN, instructionsSha256: sha256('otro prompt distinto') },
        particion(),
        [candidate],
        dependencias(),
      ),
    ).rejects.toThrow(BenchRunError);
  });

  it('rechaza una semilla de partición que no es entera', async () => {
    const { candidate } = candidato([respuesta('{"ok":true}', USO)]);
    await expect(
      runBenchmark({ ...PLAN, partitionSeed: 1.5 }, particion(), [candidate], dependencias()),
    ).rejects.toThrow(BenchRunError);
  });

  it('el informe lleva la semilla y la huella con las que se corrió', async () => {
    // Control negativo del anterior: la guarda tiene que dejar pasar el plan
    // correcto, y el resultado tiene que **publicar** lo que se comprobó. Un
    // informe sin proveniencia no es reproducible ni comparable (D-80).
    const { candidate } = candidato([respuesta('{"ok":true}', USO)]);
    const resultado = await runBenchmark(PLAN, particion(), [candidate], dependencias());
    expect(resultado.partitionSeed).toBe(PLAN.partitionSeed);
    expect(resultado.instructionsSha256).toBe(sha256(INSTRUCCIONES));
    expect(resultado.instructionsSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rechaza repeticiones no enteras o menores que uno', async () => {
    const { candidate } = candidato([respuesta('{"ok":true}', USO)]);
    for (const repetitions of [0, -1, 1.5]) {
      await expect(
        runBenchmark({ ...PLAN, repetitions }, particion(), [candidate], dependencias()),
      ).rejects.toThrow(BenchRunError);
    }
  });

  it('rechaza mezclar propósito de plan y de conjunto', async () => {
    const { candidate } = candidato([respuesta('{"ok":true}', USO)]);
    await expect(
      runBenchmark({ ...PLAN, purpose: 'material' }, particion(), [candidate], dependencias()),
    ).rejects.toThrow(/Mezclarlos/);
  });

  it('una corrida sin candidatos no mide nada', async () => {
    await expect(runBenchmark(PLAN, particion(), [], dependencias())).rejects.toThrow(BenchRunError);
  });
});

describe('el presupuesto frena antes de la red', () => {
  it('con el gate bloqueado no se envía ni una petición', async () => {
    const { candidate, sent } = candidato([respuesta('{"ok":true}', USO)]);
    const deps = dependencias();

    // Gasto previo por encima del umbral duro, sin revisión del propietario.
    deps.ledger.registerManifest(PRICING_MANIFEST_2026_08_18);
    deps.ledger.append({
      costEventId: 'previo',
      occurredAt: STARTED_AT,
      stage: 'benchmark',
      provider: 'anthropic',
      pricingManifestId: PRICING_MANIFEST_2026_08_18.pricingManifestId,
      tokensIn: 0,
      tokensOut: 0,
      tokensCached: 0,
      audioSeconds: 0,
      images: 0,
      attempts: 1,
      retries: 0,
      failures: 0,
      costCalculated: 701,
      currency: 'MXN',
    });

    await expect(runBenchmark(PLAN, particion(), [candidate], deps)).rejects.toThrow(
      BudgetBlockedError,
    );
    expect(sent).toHaveLength(0);
  });
});

describe('uso reportado', () => {
  it('sin usage la corrida se detiene en vez de asumir cero', async () => {
    const { candidate } = candidato([respuesta('{"ok":true}')]);
    await expect(runBenchmark(PLAN, particion(), [candidate], dependencias())).rejects.toThrow(
      /no reportó unidades facturadas/,
    );
  });

  it('con usage tarifa y acumula en la cubeta que el gate observa', async () => {
    const { candidate } = candidato([respuesta('{"ok":true}', USO)]);
    const deps = dependencias();
    const resultado = await runBenchmark(PLAN, particion(), [candidate], deps);

    // 1000 tokens de entrada a USD 2/MTok y 500 de salida a USD 10/MTok, al FIX.
    const esperado = ((1_000 * 2) / 1e6 + (500 * 10) / 1e6) * 17.0245;
    expect(resultado.totalCostMxn).toBeCloseTo(esperado, 10);
    expect(resultado.costPerCaseMxn).toBeCloseTo(esperado, 10);
    expect(deps.budget.accumulatedMxn()).toBeCloseTo(esperado, 10);
  });
});

describe('el reintento único', () => {
  it('reintenta una sola vez ante salida no válida, y lo cuenta', async () => {
    const { candidate, sent } = candidato([
      respuesta('esto no es json', USO),
      respuesta('{"ok":true}', USO),
    ]);
    const resultado = await runBenchmark(PLAN, particion(), [candidate], dependencias());

    expect(sent).toHaveLength(2);
    expect(resultado.outcomes[0]?.attempts).toBe(2);
    expect(resultado.outcomes[0]?.classification).toBe('valid');
  });

  it('no reintenta una tercera vez: dos fallos quedan como fallo', async () => {
    const { candidate, sent } = candidato([respuesta('no json', USO), respuesta('tampoco', USO)]);
    const resultado = await runBenchmark(PLAN, particion(), [candidate], dependencias());

    expect(sent).toHaveLength(2);
    expect(resultado.outcomes[0]?.classification).toBe('schema_violation');
  });

  it('el reintento también se cobra: el costo del caso suma los dos intentos', async () => {
    const { candidate } = candidato([respuesta('no json', USO), respuesta('{"ok":true}', USO)]);
    const resultado = await runBenchmark(PLAN, particion(), [candidate], dependencias());

    const unaLlamada = ((1_000 * 2) / 1e6 + (500 * 10) / 1e6) * 17.0245;
    expect(resultado.outcomes[0]?.costMxn).toBeCloseTo(unaLlamada * 2, 10);
    expect(resultado.outcomes[0]?.usage).toEqual({ inputTokens: 2_000, outputTokens: 1_000 });
  });
});

describe('repeticiones', () => {
  it('ejecuta cada caso tantas veces como diga el plan congelado', async () => {
    const { candidate, sent } = candidato([respuesta('{"ok":true}', USO)]);
    const resultado = await runBenchmark(
      { ...PLAN, repetitions: 3 },
      particion(),
      [candidate],
      dependencias(),
    );
    expect(sent).toHaveLength(3);
    expect(resultado.outcomes).toHaveLength(3);
    expect(resultado.outcomes.map((o) => o.repetition)).toEqual([1, 2, 3]);
  });
});

describe('refresco documental', () => {
  it('una ventana caducada detiene la corrida antes de gastar', async () => {
    const { candidate, sent } = candidato([respuesta('{"ok":true}', USO)]);
    const deps = { ...dependencias(), refreshWindow: { ...REFRESH_WINDOW, maxAgeSeconds: 60 } };

    await expect(runBenchmark(PLAN, particion(), [candidate], deps)).rejects.toThrow();
    expect(sent).toHaveLength(0);
  });

  it('reporta la antigüedad observada por candidato', async () => {
    const { candidate } = candidato([respuesta('{"ok":true}', USO)]);
    const resultado = await runBenchmark(PLAN, particion(), [candidate], dependencias());
    expect(resultado.ageSecondsByCandidate[MODEL_ID]).toBe(1_800);
  });
});
