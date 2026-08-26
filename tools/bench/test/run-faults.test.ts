import { ModelBinding } from '@profesor-ia/contracts';
import {
  BudgetController,
  CostLedger,
  DegradedProfile,
  ModelGateway,
  PRICING_MANIFEST_2026_08_18,
  TransportError,
  anthropicAdapter,
  type Transport,
} from '@profesor-ia/model-gateway';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { partitionBySeed, type BenchCase, type CaseSet, type InjectedFault } from '../src/case-set.js';
import { BenchRunError, runBenchmark, sha256, type Candidate, type RunPlan } from '../src/run.js';

/**
 * Caída simulada en el runner de BENCH-01 (T-H4-10 ← P-III §6.1).
 *
 * **Ninguna prueba toca la red.** El transporte se inyecta falso, igual que en
 * el resto del harness, y aquí eso no es sólo higiene: es la forma correcta de
 * simular una caída. El piloto del 2026-08-18 lo hizo al revés —le pedía al
 * modelo que devolviera basura— y midió obediencia en vez de recuperación.
 *
 * Lo que se declara antes de ejecutar: cada modo de fallo produce la
 * observación que el caso declaró, un caso con caída **no factura**, el
 * reintento único se ejerce igual, y una corrida con caídas declaradas y sin
 * inyector se detiene **antes** de la primera llamada.
 */

const REFRESHED_AT = '2026-08-18T09:00:00.000Z';
const STARTED_AT = '2026-08-18T09:30:00.000Z';
const FROZEN_AT = '2026-08-18T08:00:00.000Z';
const HASH = 'a'.repeat(64);
const MODEL_ID = 'claude-sonnet-5';

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

const cuerpo = (stopReason: string, texto: string): string =>
  JSON.stringify({
    stop_reason: stopReason,
    content: [{ type: 'text', text: texto }],
    usage: { input_tokens: 10, output_tokens: 5 },
  });

/**
 * Sintetiza la caída con forma de respuesta **de este proveedor**.
 *
 * Vive en la prueba y no en el runner por la misma razón por la que
 * `Candidate.faultyGatewayFor` la pide a quien arma el candidato: saber qué
 * forma tiene una respuesta de Anthropic es conocimiento del adaptador, y una
 * segunda copia dentro del runner sería la que se queda vieja.
 */
const transporteDeFallo = (fault: InjectedFault): Transport => {
  return async () => {
    switch (fault.kind) {
      case 'http_status':
        return { status: fault.status, body: '{"error":{"type":"overloaded_error"}}' };
      case 'connection_dropped':
        throw new TransportError('no se obtuvo respuesta: conexión cerrada por el otro extremo.');
      case 'timeout':
        throw new TransportError('no se obtuvo respuesta en 60000 ms.');
      case 'truncated_body':
        return { status: 200, body: cuerpo('max_tokens', '{"ok":tr') };
      case 'refusal_body':
        return { status: 200, body: cuerpo('refusal', '') };
      case 'schema_violating_text':
        return { status: 200, body: cuerpo('end_turn', '{"ok":"quizá"}') };
      case 'empty_text':
        return { status: 200, body: cuerpo('end_turn', '') };
    }
  };
};

const pasarelaCon = (transport: Transport): ModelGateway =>
  new ModelGateway({
    profile: 'SESION',
    registrations: [{ binding: BINDING, operations: ['explain_block'] }],
    credentialResolver: () => 'secreto-de-sesion',
    adapters: [anthropicAdapter],
    transport,
  });

/** Pasarela sana: sólo se usa para comprobar que la rama normal sigue viva. */
const pasarelaSana = (): ModelGateway =>
  pasarelaCon(async () => ({ status: 200, body: cuerpo('end_turn', '{"ok":true}') }));

const candidato = (conInyector = true): Candidate => ({
  candidateId: MODEL_ID,
  binding: BINDING,
  gateway: pasarelaSana(),
  ...(conInyector
    ? { faultyGatewayFor: (fault: InjectedFault) => pasarelaCon(transporteDeFallo(fault)) }
    : {}),
});

const casoDeCaida = (fault: InjectedFault): BenchCase => ({
  caseId: `caida-${fault.kind}`,
  family: 'failure_or_invalid_output',
  operation: 'explain_block',
  input: '¿Qué diferencia hay entre ∧I y ∧E?',
  expectation: {
    structurallyUsable: false,
    mustDeclareOutOfScope: false,
    mustRefuseSolutionDisclosure: false,
    mustRecoverToDegraded: true,
  },
  degradedBlockId: 'KC04',
  injectedFault: fault,
});

const CASO_SANO: BenchCase = {
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
  runId: 'bench-01-caidas',
  purpose: 'pilot',
  repetitions: 1,
  frozenAt: FROZEN_AT,
  startedAt: STARTED_AT,
  partitionSeed: 20260818,
  instructionsSha256: sha256(INSTRUCCIONES),
};

/**
 * Perfil degradado del fixture. Un solo activo, el del bloque que los casos de
 * caída declaran: si trajera activos de sobra, la prueba de que un bloque sin
 * activo **no** recupera pasaría por tener el mapa lleno.
 */
const VERSION_DE_ACTIVOS = 'fixture-degradado-v1';
const PERFIL_DEGRADADO = new DegradedProfile({
  assets: [
    {
      kind: 'explicacion',
      key: 'KC04',
      text: 'Introducción de conjunción: de A y de B se obtiene (A∧B).',
      freezeVersion: VERSION_DE_ACTIVOS,
    },
  ],
  feedbackTemplates: [],
});

function dependencias() {
  const ledger = new CostLedger();
  return {
    ledger,
    budget: new BudgetController(ledger, { alertThresholdMxn: 400 }),
    manifest: PRICING_MANIFEST_2026_08_18,
    refreshRecord: REFRESH_RECORD,
    refreshWindow: REFRESH_WINDOW,
    schema: z.object({ ok: z.boolean() }),
    codeFence: 'reject' as const,
    instructions: INSTRUCCIONES,
    degraded: PERFIL_DEGRADADO,
    degradedAssetVersion: VERSION_DE_ACTIVOS,
  };
}

const conjunto = (cases: readonly BenchCase[]): CaseSet => ({
  caseSetId: 'cs-caidas',
  purpose: 'pilot',
  cases,
});

const FALLOS: readonly InjectedFault[] = [
  { kind: 'http_status', status: 500, observation: 'provider_error' },
  { kind: 'connection_dropped', observation: 'transport_failure' },
  { kind: 'timeout', observation: 'transport_failure' },
  { kind: 'truncated_body', observation: 'truncated' },
  { kind: 'refusal_body', observation: 'refusal' },
  { kind: 'schema_violating_text', observation: 'schema_violation' },
  { kind: 'empty_text', observation: 'schema_violation' },
];

describe('cada modo de fallo produce la observación que el caso declaró', () => {
  for (const fallo of FALLOS) {
    it(`${fallo.kind} se observa como ${fallo.observation}`, async () => {
      const particion = partitionBySeed(conjunto([casoDeCaida(fallo)]), 1, 0.5);
      const resultado = await runBenchmark(PLAN, particion, [candidato()], dependencias());

      expect(resultado.outcomes).toHaveLength(1);
      expect(resultado.outcomes[0]?.faultObservation).toBe(fallo.observation);
    });
  }
});

describe('una caída simulada no factura', () => {
  it('no reporta unidades facturadas ni costo, y no toca el ledger', async () => {
    const deps = dependencias();
    const particion = partitionBySeed(
      conjunto([casoDeCaida({ kind: 'timeout', observation: 'transport_failure' })]),
      1,
      0.5,
    );
    const resultado = await runBenchmark(PLAN, particion, [candidato()], deps);

    // El cero es medido, no supuesto: no se abrió ninguna conexión.
    expect(resultado.totalCostMxn).toBe(0);
    expect(resultado.outcomes[0]?.costMxn).toBe(0);
    // Y no se fabrica un `usage` en ceros, que haría parecer la corrida más
    // barata de lo que fue si algún día sí hubiera llamada.
    expect(resultado.outcomes[0]?.usage).toBeUndefined();
    expect(deps.budget.accumulatedMxn()).toBe(0);
  });

  it('deja el reintento único ejercido, que es lo que la familia mide', async () => {
    const particion = partitionBySeed(
      conjunto([casoDeCaida({ kind: 'http_status', status: 503, observation: 'provider_error' })]),
      1,
      0.5,
    );
    const resultado = await runBenchmark(PLAN, particion, [candidato()], dependencias());
    expect(resultado.outcomes[0]?.attempts).toBe(2);
  });

  it('no clasifica una caída de transporte: no hubo respuesta que clasificar', async () => {
    const particion = partitionBySeed(
      conjunto([casoDeCaida({ kind: 'connection_dropped', observation: 'transport_failure' })]),
      1,
      0.5,
    );
    const resultado = await runBenchmark(PLAN, particion, [candidato()], dependencias());
    expect(resultado.outcomes[0]?.classification).toBeUndefined();
    expect(resultado.outcomes[0]?.faultObservation).toBe('transport_failure');
  });
});

describe('la continuación degradada se registra con el activo servido', () => {
  it('sirve el activo congelado del bloque que el caso declara', async () => {
    const particion = partitionBySeed(
      conjunto([casoDeCaida({ kind: 'timeout', observation: 'transport_failure' })]),
      1,
      0.5,
    );
    const resultado = await runBenchmark(PLAN, particion, [candidato()], dependencias());
    const recuperacion = resultado.outcomes[0]?.degradedRecovery;
    // Se registra el activo y no un booleano: un `true` no dejaría comprobar
    // después que lo que continuó la clase salió del banco y no de un relleno.
    expect(recuperacion).toEqual({
      recovered: true,
      blockId: 'KC04',
      assetKind: 'explicacion',
      assetKey: 'KC04',
      assetVersion: VERSION_DE_ACTIVOS,
      assetChars: expect.any(Number) as number,
    });
  });

  it('un bloque sin activo congelado NO recupera, y dice por qué', async () => {
    // **Control positivo.** Sin él, la prueba de arriba estaría verde por tener
    // el mapa lleno y no por servir el activo correcto. El modo degradado no
    // rellena huecos: un texto de relleno haría pasar por «el núcleo respondió»
    // algo que no estaba (P-II §8.6).
    const sinActivo: BenchCase = {
      ...casoDeCaida({ kind: 'timeout', observation: 'transport_failure' }),
      caseId: 'caida-bloque-vacio',
      degradedBlockId: 'KC17',
    };
    const particion = partitionBySeed(conjunto([sinActivo]), 1, 0.5);
    const resultado = await runBenchmark(PLAN, particion, [candidato()], dependencias());
    const recuperacion = resultado.outcomes[0]?.degradedRecovery;
    expect(recuperacion?.recovered).toBe(false);
    expect(recuperacion?.blockId).toBe('KC17');
    expect(recuperacion && 'reason' in recuperacion ? recuperacion.reason : '').toContain('KC17');
  });

  it('una corrida con caídas y sin perfil degradado no empieza', async () => {
    // Mismo freno que el inyector de fallos, por el otro extremo de la ruta:
    // sin perfil hay caída y no hay continuación, y el gate —100 % y
    // bloqueante— se apoyaría en una ruta que el sistema no tiene.
    const particion = partitionBySeed(
      conjunto([casoDeCaida({ kind: 'timeout', observation: 'transport_failure' })]),
      1,
      0.5,
    );
    const { degraded, ...sinDegradado } = dependencias();
    expect(degraded).toBeDefined();
    await expect(runBenchmark(PLAN, particion, [candidato()], sinDegradado)).rejects.toThrow(
      BenchRunError,
    );
  });
});

describe('la rama normal sigue viva', () => {
  it('un caso sin fallo declarado factura y se clasifica como siempre', async () => {
    const particion = partitionBySeed(conjunto([CASO_SANO]), 1, 0.5);
    const resultado = await runBenchmark(PLAN, particion, [candidato()], dependencias());
    expect(resultado.outcomes[0]?.classification).toBe('valid');
    expect(resultado.outcomes[0]?.faultObservation).toBeUndefined();
    expect(resultado.totalCostMxn).toBeGreaterThan(0);
  });
});

describe('controles negativos: la corrida falla cerrada', () => {
  it('se detiene antes de la primera llamada si nadie sabe producir la caída', async () => {
    const particion = partitionBySeed(
      conjunto([casoDeCaida({ kind: 'timeout', observation: 'transport_failure' })]),
      1,
      0.5,
    );
    await expect(
      runBenchmark(PLAN, particion, [candidato(false)], dependencias()),
    ).rejects.toThrow(/pasaría por vacío/);
  });

  it('rechaza una inyección que no ocurrió, en vez de darla por recuperada', async () => {
    // El inyector devuelve una pasarela sana: el fallo no se produce. Contarlo
    // como caso superado diría que el sistema se recuperó de una caída que
    // nunca hubo — el gate de recuperación es de 100 % y bloqueante.
    const mentiroso: Candidate = {
      candidateId: MODEL_ID,
      binding: BINDING,
      gateway: pasarelaSana(),
      faultyGatewayFor: () => pasarelaSana(),
    };
    const particion = partitionBySeed(
      conjunto([casoDeCaida({ kind: 'timeout', observation: 'transport_failure' })]),
      1,
      0.5,
    );
    await expect(runBenchmark(PLAN, particion, [mentiroso], dependencias())).rejects.toThrow(
      BenchRunError,
    );
  });
});
