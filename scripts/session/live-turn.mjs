#!/usr/bin/env node
/**
 * Turno de enseñanza **en vivo** contra el proveedor real (T-H7-01).
 *
 * Es el control positivo del bucle W7: las pruebas de `turn.test.ts` corren con
 * un puerto inyectado y demuestran que el orquestador encadena bien; esto
 * demuestra que **un modelo de verdad responde en el formato que el validador
 * de anclaje acepta**, que es una afirmación distinta y no se sigue de la otra.
 *
 * **GASTA DINERO**, poco: un turno son centavos. Lo dice antes de gastarlo.
 *
 *   node scripts/session/live-turn.mjs [KC] [pregunta del alumno]
 *
 * Sin argumentos usa KC04 y una pregunta de apertura.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildFragmentHandleTable, fragmentHandle } from '../../packages/contracts/dist/index.js';
import {
  ModelGateway,
  anthropicAdapter,
  envCredentialResolver,
  httpTransport,
} from '../../packages/model-gateway/dist/index.js';
import { loadContentPackage } from '../../packages/content-schema/dist/index.js';
import {
  DeterministicPedagogyPolicy,
  PedagogyPolicyRunRegistry,
  createPedagogyPolicyDefinition,
} from '../../packages/pedagogy-policy/dist/index.js';
import {
  TEACHING_TURN_INSTRUCTIONS,
  gatewayTurnPort,
  runTeachingTurn,
} from '../../packages/session-engine/dist/index.js';
import {
  AUTHORIZED_CALCULUS_VERSION,
  CONNECTIVE_ALIASES,
  FORBIDDEN_RULES_EXAMPLES,
} from '../../packages/logic-core/dist/index.js';

const REPO = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const ENV_FILE = join(REPO, 'infra', 'compose', '.env');

const KC = process.argv[2] ?? 'KC04';
const PREGUNTA = process.argv[3] ?? 'No entiendo cómo usar la conjunción. ¿Me explicas?';
const MODEL_ID = process.env.LIVE_MODEL ?? 'claude-sonnet-5';

function cargarEnv() {
  const env = {};
  for (const linea of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const limpia = linea.trim();
    if (limpia === '' || limpia.startsWith('#')) continue;
    const corte = limpia.indexOf('=');
    if (corte <= 0) continue;
    env[limpia.slice(0, corte).trim()] = limpia.slice(corte + 1).trim();
  }
  return env;
}

/** El cálculo congelado se inyecta; este script no lo transcribe. */
const CALCULO = {
  version: AUTHORIZED_CALCULUS_VERSION,
  canonicalSymbols: ['¬', '∧', '∨', '→', '↔', '⊥'],
  connectiveAliases: Object.keys(CONNECTIVE_ALIASES),
  forbiddenRuleIds: [...FORBIDDEN_RULES_EXAMPLES],
};

function politicaDeDesarrollo() {
  // `test_fixture`, no `material`: una política material exige el hash del
  // paquete congelado y W5 no ha corrido. F7 admite expresamente el paquete
  // sintético de desarrollo, y declararlo es lo que impide que un dato de
  // desarrollo se cite luego como evidencia.
  const definicion = createPedagogyPolicyDefinition({
    policyVersion: 'pedagogy-policy-live-turn-dev-v1',
    purpose: 'test_fixture',
    wheelSpinningCalibration: {
      parameterId: 'CAL-10',
      registryAlias: 'CAL-WHEEL',
      status: 'test_fixture',
      calibrationVersion: 'cal-wheel-dev-v1',
      artifactHash: 'a'.repeat(64),
      threshold: { eligibleAttemptWindow: 3, minimumUnsuccessfulEligibleAttempts: 2 },
    },
  });
  const engine = new DeterministicPedagogyPolicy(definicion, {
    registry: new PedagogyPolicyRunRegistry(),
  });
  engine.bindRun({
    runId: 'run-live-1',
    purpose: definicion.purpose,
    policyVersion: definicion.policyVersion,
    policyHash: engine.compiled.policyHash,
  });
  return engine;
}

async function main() {
  const env = cargarEnv();
  const paquete = loadContentPackage(join(REPO, 'content', 'unidad-deduccion-natural'));

  const fragmentos = paquete.authorizedFragmentsByBlock.get(KC) ?? [];
  if (fragmentos.length === 0) {
    console.error(
      `el bloque ${KC} no tiene fragmentos con texto. Bloques disponibles: ` +
        [...paquete.authorizedFragmentsByBlock.keys()].join(', '),
    );
    return 2;
  }

  // Falla cerrado si dos fragmentos del bloque comparten mango, antes de gastar.
  buildFragmentHandleTable(fragmentos.map((f) => f.fragmentId));
  const mangosPorIndice = new Map(
    fragmentos.map((f, i) => [String(i), fragmentHandle(f.fragmentId)]),
  );

  console.log(`bloque ${KC} — ${String(fragmentos.length)} fragmentos autorizados`);
  console.log(`modelo: ${MODEL_ID}   (esto GASTA: un turno son centavos)`);
  console.log(`alumno: «${PREGUNTA}»\n`);

  const binding = {
    bindingId: `binding-sesion-live-${MODEL_ID}`,
    profile: 'SESION',
    provider: 'anthropic',
    modelId: MODEL_ID,
    endpoint: 'https://api.anthropic.com/v1/messages',
    // El id sin fecha **es** el snapshot fijado en la familia Claude 4.6+, y lo
    // dice la documentación citada en el refresco documental del 2026-08-23. Sin
    // esto la pasarela falla cerrado con `UnpinnedBindingError`, que es lo
    // correcto: un alias que puede cambiar de modelo sin aviso no se mide.
    snapshot: MODEL_ID,
    capabilities: {
      // Sólo `max_tokens`. El refresco declara el resto como rechazados, y la
      // pasarela no envía parámetros que el binding no declare.
      supportedParameters: ['max_tokens'],
      rejectedParameters: [],
      structuredOutput: true,
      toolUse: false,
      streaming: false,
      vision: false,
    },
    verifiedAt: new Date().toISOString(),
  };

  const gateway = new ModelGateway({
    profile: 'SESION',
    registrations: [
      { binding, operations: ['explain_block', 'rephrase_explanation', 'classify_student_error'] },
    ],
    credentialResolver: envCredentialResolver('anthropic', env),
    adapters: [anthropicAdapter],
    transport: httpTransport({ timeoutMs: 60_000 }),
  });

  const resultado = await runTeachingTurn(
    {
      policy: politicaDeDesarrollo(),
      retrieveFragments: () => fragmentos,
      model: gatewayTurnPort({
        gateway,
        fragmentHandles: mangosPorIndice,
        maxOutputTokens: 3000,
      }),
      calculus: CALCULO,
      canaryDetector: () => [],
    },
    {
      decisionContext: {
        runId: 'run-live-1',
        mode: 'LEARNING_MODE',
        kcId: KC,
        kcType: 'procedural',
        currentStrategy: null,
        currentAssistanceLevel: 0,
        masteryEligibility: {
          authority: 'domain_engine',
          eligible: false,
          reasonCode: 'NOT_AN_ELIGIBLE_ATTEMPT',
        },
        patternPosition: { patternId: 'new_procedural_kc', stepId: 'brief_explanation' },
        observations: {
          securityBlocked: false,
          integrityBlocked: false,
          noRevelationRisk: false,
          blockingPrerequisite: false,
          masteryRecoveryRequired: false,
          partialDifficulty: false,
          repeatedSameError: false,
          helpDependence: false,
        },
        selfExplanationTrigger: null,
        retrieval: { requested: false },
        fading: { requested: false },
        wheelSpinning: { requested: false },
      },
      blockId: KC,
      goal: PREGUNTA,
      minimalState: { kcId: KC },
      minimalStateKeys: ['kcId'],
      structuredError: null,
      selectedHint: null,
      candidateHint: null,
      scorableActivity: null,
      operation: 'explain_block',
      instructions: TEACHING_TURN_INSTRUCTIONS,
      deliversFeedback: false,
    },
  );

  console.log(`resultado: ${resultado.outcome}  (paró en «${resultado.stoppedAt}»)`);
  console.log(`regla de política aplicada: ${resultado.audit.policyRuleId}\n`);

  if (resultado.outcome === 'delivered') {
    for (const [i, segmento] of resultado.segments.entries()) {
      const anclas =
        segmento.standing.kind === 'anchored'
          ? segmento.standing.resolvedAnchors.join(', ')
          : segmento.standing.kind;
      console.log(`  [${String(i + 1)}] (${anclas})`);
      console.log(`      ${segmento.text}\n`);
    }
    console.log(`puede fundamentar calificación: ${String(resultado.canGroundEvaluation)}`);
    return 0;
  }

  if (resultado.outcome === 'rejected_by_anchoring') {
    for (const r of resultado.rejections) {
      console.log(`  ✗ ${r.reason} (segmento ${String(r.segmentIndex)}): ${r.detail}`);
    }
    return 1;
  }

  console.log(JSON.stringify(resultado, null, 2));
  return 1;
}

process.exitCode = await main();
