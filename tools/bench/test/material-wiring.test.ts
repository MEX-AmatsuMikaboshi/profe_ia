import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ModelBinding } from '@profesor-ia/contracts';
import {
  AUTHORIZED_CALCULUS_VERSION,
  CONNECTIVE_ALIASES,
  FORBIDDEN_RULES_EXAMPLES,
} from '@profesor-ia/logic-core';
import {
  BudgetController,
  CostLedger,
  DegradedProfile,
  ModelGateway,
  PRICING_MANIFEST_2026_08_18,
  anthropicAdapter,
  verifiedAtFromRefresh,
  type AuthorizedCalculus,
  type Transport,
} from '@profesor-ia/model-gateway';
import { describe, expect, it } from 'vitest';

import { partitionBySeed } from '../src/case-set.js';
import { anchoredSegmentsProbe, loadContentPackage } from '../src/corpus.js';
import { outOfScopeProbe, ruleInventionProbe, solutionLeakProbe } from '../src/evidence.js';
import { anthropicFaultyGatewayFactory } from '../src/fault-gateway.js';
import {
  MATERIAL_CASE_SET,
  MATERIAL_INSTRUCTIONS,
  MATERIAL_RESPONSE_SCHEMA,
} from '../src/material-cases.js';
import { REFRESH_2026_08_23 } from '../src/refresh-2026-08-23.js';
import { REFRESH_WINDOW_5D } from '../src/refresh-2026-08-18.js';
import { runBenchmark, type Candidate, type RunPlan } from '../src/run.js';
import { degradedRecoveryProbe, observeGates } from '../src/scoring.js';

/**
 * Cableado completo de la corrida material, **sin red y sin gastar**
 * (T-H4-10 ← P-III §6.1/§6.2).
 *
 * ## Por qué existe, dicho sin adornos
 *
 * La corrida material es el único punto del repositorio donde se gasta dinero y
 * son más de mil llamadas seguidas. Descubrir **después de pagarlas** que una de
 * las cinco sondas no estaba conectada, o que el conjunto de 200 casos produce
 * un denominador que `assertDenominatorIntact()` rechaza, dejaría la factura
 * hecha y el dictamen sin computar. Esto recorre exactamente el mismo camino
 * —los 200 casos, las siete familias, las veinte caídas, los seis gates y las
 * cinco sondas reales— con el transporte inyectado.
 *
 * **No mide a ningún candidato y no lo pretende:** el modelo de esta prueba
 * contesta siempre bien porque lo que se comprueba es el harness. Lo que sí se
 * declara antes de correr es que los seis gates se computan, que sus
 * denominadores salen del plan y que la caída simulada no factura.
 */

const CONTENIDO = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../content/unidad-deduccion-natural',
);
const PAQUETE = loadContentPackage(CONTENIDO);

const CALCULO: AuthorizedCalculus = {
  version: AUTHORIZED_CALCULUS_VERSION,
  canonicalSymbols: ['¬', '∧', '∨', '→', '↔', '⊥'],
  connectiveAliases: Object.keys(CONNECTIVE_ALIASES),
  forbiddenRuleIds: [...FORBIDDEN_RULES_EXAMPLES],
};

const CANDIDATO = 'claude-sonnet-5';

const BINDING = ModelBinding.parse({
  bindingId: `binding-sesion-${CANDIDATO}`,
  profile: 'SESION',
  provider: 'anthropic',
  modelId: CANDIDATO,
  endpoint: 'https://api.anthropic.com/v1/messages',
  snapshot: CANDIDATO,
  capabilities: {
    supportedParameters: ['max_tokens'],
    rejectedParameters: ['temperature', 'top_p', 'top_k'],
    structuredOutput: { supported: true },
    reasoning: { supported: false },
    batch: { supported: false },
    caching: { supported: false },
    dataPolicy: { contractualEligibility: 'unknown' },
  },
  verifiedAt: verifiedAtFromRefresh(REFRESH_2026_08_23, CANDIDATO),
});

const OPERACIONES = [
  'explain_block',
  'rephrase_explanation',
  'classify_student_error',
  'classify_question_scope',
] as const;

/**
 * Modelo simulado que contesta bien.
 *
 * **Ancla contra el fragmento que recibió**, extrayéndolo del cuerpo de la
 * petición igual que haría un modelo de verdad. Inventar un `fragmentId` en la
 * prueba haría que el gate de anclas diera cero por culpa del simulacro y no
 * enseñaría nada sobre el cableado.
 */
const transporteSano: Transport = async (request) => {
  // El cuerpo llega como JSON, así que los saltos vienen escapados. Los
  // `fragmentId` reales traen espacios y dos puntos —son rutas del snapshot del
  // libro—, de modo que el corte va por el `: ` que los separa de su texto.
  const cuerpo = (request.body ?? '').replace(/\\n/gu, '\n');
  const ancla = /\n- (.+?): /u.exec(cuerpo)?.[1];
  const texto = JSON.stringify({
    segmentos: [
      {
        text: 'Una explicación de acompañamiento que no introduce reglas ni definiciones.',
        anchors: [],
        function: 'transition',
      },
      ...(ancla === undefined
        ? []
        : [
            {
              text: 'El cálculo autorizado lo dice así, y aquí queda apoyado en el material.',
              anchors: [ancla],
              function: 'explanation' as const,
            },
          ]),
    ],
    fueraDeAlcance: true,
    reglasCitadas: ['∧I', '→E'],
  });
  return {
    status: 200,
    body: JSON.stringify({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: texto }],
      usage: { input_tokens: 700, output_tokens: 200 },
    }),
  };
};

function candidato(): Candidate {
  return {
    candidateId: CANDIDATO,
    binding: BINDING,
    gateway: new ModelGateway({
      profile: 'SESION',
      registrations: [{ binding: BINDING, operations: [...OPERACIONES] }],
      credentialResolver: () => 'secreto-de-prueba',
      adapters: [anthropicAdapter],
      transport: transporteSano,
    }),
    faultyGatewayFor: anthropicFaultyGatewayFactory({
      binding: BINDING,
      operations: OPERACIONES,
      credentialResolver: () => 'secreto-de-prueba',
    }),
  };
}

describe('la corrida material completa, con transporte inyectado', () => {
  const ledger = new CostLedger();
  const budget = new BudgetController(ledger, { alertThresholdMxn: 300 });
  const anotados: string[] = [];

  const plan: RunPlan = {
    runId: 'wiring-material',
    purpose: 'material',
    repetitions: 1,
    frozenAt: '2026-08-23T00:00:00.000Z',
    startedAt: REFRESH_2026_08_23.refreshedAt,
  };

  it('recorre los 200 casos y anota cada resultado en cuanto termina', async () => {
    const resultado = await runBenchmark(
      plan,
      partitionBySeed(MATERIAL_CASE_SET, 20260823, 0.5),
      [candidato()],
      {
        ledger,
        budget,
        manifest: PRICING_MANIFEST_2026_08_18,
        refreshRecord: REFRESH_2026_08_23,
        refreshWindow: REFRESH_WINDOW_5D,
        degraded: new DegradedProfile({
          assets: PAQUETE.frozenAssets,
          feedbackTemplates: PAQUETE.feedbackTemplates,
        }),
        contentPackage: PAQUETE,
        schema: MATERIAL_RESPONSE_SCHEMA,
        codeFence: 'unwrap',
        instructions: MATERIAL_INSTRUCTIONS,
        parameters: { max_tokens: 2048 },
        onOutcome: (o) => anotados.push(o.caseId),
      },
    );

    expect(resultado.outcomes).toHaveLength(MATERIAL_CASE_SET.cases.length);
    expect(anotados).toHaveLength(MATERIAL_CASE_SET.cases.length);

    // Las veinte caídas no facturan: es costo cero **medido**, no supuesto.
    const caidas = resultado.outcomes.filter((o) => o.caseId.startsWith('m-caida-'));
    expect(caidas).toHaveLength(20);
    expect(caidas.every((o) => o.costMxn === 0)).toBe(true);
    expect(caidas.every((o) => o.attempts === 2)).toBe(true);
    expect(caidas.every((o) => o.degradedRecovery?.recovered === true)).toBe(true);

    // Y las 180 restantes sí, con el manifiesto real.
    expect(resultado.totalCostMxn).toBeGreaterThan(0);

    const gates = observeGates(CANDIDATO, {
      runResult: resultado,
      caseSet: MATERIAL_CASE_SET,
      repetitions: 1,
      contentPackage: PAQUETE,
      evidence: {
        disclosedSolution: solutionLeakProbe(),
        unblockedRuleInventions: ruleInventionProbe(),
        outOfScopeDeclaredOrContained: outOfScopeProbe(),
        factualSegments: anchoredSegmentsProbe(PAQUETE, CALCULO),
        recoveredToDegraded: degradedRecoveryProbe(),
      },
    });

    // Los seis, con los denominadores derivados del plan y no de lo observado.
    expect(gates.map((g) => g.gateId).sort()).toEqual(
      [
        'deterministic_degraded_recovery',
        'factual_segments_with_resolvable_anchors',
        'out_of_corpus_declared_or_contained',
        'solution_leaks',
        'structurally_usable_after_retry',
        'unblocked_rule_inventions',
      ].sort(),
    );
    expect(gates.find((g) => g.gateId === 'solution_leaks')?.denominator).toBe(30);
    expect(gates.find((g) => g.gateId === 'out_of_corpus_declared_or_contained')?.denominator).toBe(
      20,
    );
    expect(gates.find((g) => g.gateId === 'deterministic_degraded_recovery')?.denominator).toBe(20);
    expect(gates.filter((g) => !g.passed).map((g) => `${g.gateId} ${g.wording}`)).toEqual([]);
  }, 120_000);
});
