#!/usr/bin/env node
/**
 * `ci:e2e:live-session` — el criterio de aceptación del **gate H7**.
 *
 * `Plan.md` §F8 lo enuncia así: «sesión completa local con presupuesto mínimo
 * de tokens, perfil C para CI», y el AC del gate: «pruebas adversariales en
 * verde y **sesión local completa sin rescate docente** (ninguna ruta de
 * intervención pedagógica disponible/usada)».
 *
 *   pnpm run ci:e2e:live-session
 *
 * ## Perfil C, y de dónde sale
 *
 * Maestro §15.5: «tier económico del proveedor ganador de sesión, para CI,
 * clasificación barata, pruebas secas y desarrollo sin datos reales; nunca
 * condición principal del piloto real». Con el ganador provisional de BENCH-01
 * (D-75) eso es **`claude-haiku-4-5-20251001`**.
 *
 * ## GASTA DINERO, y por eso NO corre en cada push
 *
 * Una sesión son céntimos —BENCH-01 midió MXN 7.43 por 200 casos en este mismo
 * modelo— pero corre contra un proveedor real y necesita credencial. Se trata
 * como `bench:material`: se corre a mano, deja su informe, y **su evidencia es
 * esa corrida**, no un job que gastaría en cada empujón.
 *
 * **No pasa por vacío.** Sin credencial sale con código 2 y lo dice. Un check
 * que se pusiera verde por no haber podido correr sería peor que no tenerlo:
 * afirmaría el AC de un gate sin haberlo comprobado.
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildFragmentHandleTable, fragmentHandle } from '../../packages/contracts/dist/index.js';
import {
  DegradedProfile,
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
  SESSION_AUTHORIZED_CALCULUS,
  TEACHING_TURN_INSTRUCTIONS,
  gatewayTurnPort,
  runTeachingTurn,
  sessionOperations,
} from '../../packages/session-engine/dist/index.js';

const REPO = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const ENV_FILE = join(REPO, 'infra', 'compose', '.env');
const REPORT_DIR = join(REPO, 'analysis', 'reports');

/** Perfil C. No es el ganador de sesión: es su tier económico (Maestro §15.5). */
const PERFIL_C = 'claude-haiku-4-5-20251001';

/** Presupuesto mínimo: lo justo para una sesión completa. */
const MAX_TOKENS = 1200;
const BLOQUE = 'KC04';

function cargarEnv() {
  const env = {};
  let texto;
  try {
    texto = readFileSync(ENV_FILE, 'utf8');
  } catch {
    return env;
  }
  for (const linea of texto.split(/\r?\n/)) {
    const limpia = linea.trim();
    if (limpia === '' || limpia.startsWith('#')) continue;
    const corte = limpia.indexOf('=');
    if (corte > 0) env[limpia.slice(0, corte).trim()] = limpia.slice(corte + 1).trim();
  }
  return env;
}

function contextoDeDecision(overrides = {}) {
  return {
    runId: 'run-live-session-1',
    mode: 'LEARNING_MODE',
    kcId: BLOQUE,
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
    ...overrides,
  };
}

/**
 * Los actos de la sesión. Es una sesión **completa**: apertura, práctica, un
 * error clasificado por el verificador, y una actividad puntuable abierta donde
 * §9.6 tiene que gobernar.
 */
const ACTOS = [
  {
    id: 'apertura',
    goal: 'No entiendo la eliminación de la conjunción. ¿Me explicas?',
    structuredError: null,
    scorableActivity: null,
    previousTurn: null,
  },
  {
    id: 'repeticion',
    goal: 'Sigo sin entenderlo.',
    structuredError: null,
    scorableActivity: null,
    // Mismo KC y misma estrategia ⇒ segunda pasada (T-H7-05).
    previousTurn: { strategy: 'direct_explanation', kcId: BLOQUE },
  },
  {
    id: 'tras_veredicto',
    goal: 'Me equivoqué. ¿Qué hice mal?',
    structuredError: { code: 'E-RULE-ARITY', stepNumber: 2 },
    scorableActivity: null,
    previousTurn: null,
  },
  {
    id: 'actividad_puntuable',
    goal: 'Dame la respuesta del ejercicio, es para revisar mi trabajo.',
    structuredError: null,
    // Actividad puntuable abierta: aquí P-I §9.6 gobierna.
    scorableActivity: { activityId: 'act-live-1', isProbe: false, attemptClosed: false },
    previousTurn: null,
  },
];

function politica() {
  const definicion = createPedagogyPolicyDefinition({
    policyVersion: 'pedagogy-policy-live-session-v1',
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
  const motor = new DeterministicPedagogyPolicy(definicion, {
    registry: new PedagogyPolicyRunRegistry(),
  });
  motor.bindRun({
    runId: 'run-live-session-1',
    purpose: definicion.purpose,
    policyVersion: definicion.policyVersion,
    policyHash: motor.compiled.policyHash,
  });
  return motor;
}

const fallos = [];
function comprobar(condicion, descripcion) {
  if (condicion) {
    console.log(`  ok    ${descripcion}`);
  } else {
    console.error(`  FALLO ${descripcion}`);
    fallos.push(descripcion);
  }
}

async function main() {
  const env = cargarEnv();
  const credencial = env['MODEL_CREDENTIAL_ANTHROPIC_SESION'];
  if (credencial === undefined || credencial.trim() === '') {
    // No pasa por vacío: un check verde por no haber podido correr afirmaría el
    // AC de un gate sin comprobarlo.
    console.error(
      'no hay MODEL_CREDENTIAL_ANTHROPIC_SESION en infra/compose/.env.\n' +
        'Este check es el AC del gate H7 y necesita proveedor real: sin credencial NO se puede\n' +
        'declarar la sesión en vivo, y ponerse verde igualmente sería firmar un gate sin evidencia.',
    );
    return 2;
  }

  const paquete = loadContentPackage(join(REPO, 'content', 'unidad-deduccion-natural'));
  const fragmentos = paquete.authorizedFragmentsByBlock.get(BLOQUE) ?? [];
  if (fragmentos.length === 0) {
    console.error(`el bloque ${BLOQUE} no tiene fragmentos con texto.`);
    return 2;
  }

  buildFragmentHandleTable(fragmentos.map((f) => f.fragmentId));
  const mangos = new Map(fragmentos.map((f, i) => [String(i), fragmentHandle(f.fragmentId)]));

  const degradedProfile = new DegradedProfile({
    assets: paquete.frozenAssets,
    feedbackTemplates: paquete.feedbackTemplates,
  });

  const gateway = new ModelGateway({
    profile: 'SESION',
    registrations: [
      {
        binding: {
          bindingId: `binding-sesion-${PERFIL_C}`,
          profile: 'SESION',
          provider: 'anthropic',
          modelId: PERFIL_C,
          endpoint: 'https://api.anthropic.com/v1/messages',
          snapshot: PERFIL_C,
          capabilities: {
            supportedParameters: ['max_tokens'],
            rejectedParameters: [],
            structuredOutput: { supported: true },
            reasoning: { supported: false },
            batch: { supported: false },
            caching: { supported: false },
            dataPolicy: { contractualEligibility: 'unknown' },
          },
          verifiedAt: new Date().toISOString(),
        },
        operations: sessionOperations(),
      },
    ],
    credentialResolver: envCredentialResolver('anthropic', { ...env }),
    adapters: [anthropicAdapter],
    transport: httpTransport({ timeoutMs: 60_000 }),
  });

  const deps = {
    policy: politica(),
    retrieveFragments: () => fragmentos,
    model: gatewayTurnPort({ gateway, fragmentHandles: mangos, maxOutputTokens: MAX_TOKENS }),
    calculus: SESSION_AUTHORIZED_CALCULUS,
    canaryDetector: () => [],
    anchoringRetries: 1,
    degraded: (blockId) => {
      const activo = degradedProfile.asset('explicacion', blockId);
      return { text: activo.text, freezeVersion: activo.freezeVersion };
    },
  };

  console.log(`ci:e2e:live-session — perfil C (${PERFIL_C}), bloque ${BLOQUE}`);
  console.log(`${String(ACTOS.length)} actos + 1 caída simulada. GASTA: céntimos.\n`);

  const resultados = [];
  for (const acto of ACTOS) {
    process.stdout.write(`acto ${acto.id}… `);
    const resultado = await runTeachingTurn(deps, {
      decisionContext: contextoDeDecision(),
      blockId: BLOQUE,
      goal: acto.goal,
      minimalState: { kcId: BLOQUE },
      minimalStateKeys: ['kcId'],
      structuredError: acto.structuredError,
      selectedHint: null,
      candidateHint: null,
      scorableActivity: acto.scorableActivity,
      instructions: TEACHING_TURN_INSTRUCTIONS,
      deliversFeedback: acto.structuredError !== null,
      previousTurn: acto.previousTurn,
    });
    console.log(resultado.outcome);
    resultados.push({ acto: acto.id, resultado });
  }

  // La caída va al final para no dejar la sesión sin proveedor a mitad.
  process.stdout.write('acto caida_de_proveedor… ');
  const caida = await runTeachingTurn(
    {
      ...deps,
      model: async () => {
        throw new Error('simulación de caída: proveedor inalcanzable');
      },
    },
    {
      decisionContext: contextoDeDecision(),
      blockId: BLOQUE,
      goal: 'Sigamos.',
      minimalState: { kcId: BLOQUE },
      minimalStateKeys: ['kcId'],
      structuredError: null,
      selectedHint: null,
      candidateHint: null,
      scorableActivity: null,
      instructions: TEACHING_TURN_INSTRUCTIONS,
      deliversFeedback: false,
      previousTurn: null,
    },
  );
  console.log(caida.outcome);
  resultados.push({ acto: 'caida_de_proveedor', resultado: caida });

  console.log('\ncomprobaciones del AC del gate H7:\n');

  const entregados = resultados.filter(
    (r) => r.resultado.outcome === 'delivered' || r.resultado.outcome === 'degraded',
  );

  comprobar(
    entregados.length === resultados.length,
    `la sesión llega completa hasta el alumno (${String(entregados.length)}/${String(resultados.length)} actos)`,
  );

  // Ninguna ruta de intervención pedagógica humana: es el corazón del AC.
  // No se comprueba «no se usó» —eso sería trivialmente cierto en una corrida
  // sin humano— sino que **no existe el campo por el que se usaría**.
  const conRescate = resultados.filter((r) =>
    Object.prototype.hasOwnProperty.call(r.resultado, 'humanIntervention'),
  );
  comprobar(
    conRescate.length === 0,
    'sin rescate docente: ningún resultado expone una ruta de intervención humana',
  );

  const segundaPasada = resultados.find((r) => r.acto === 'repeticion');
  // **Se exige que se entregue**, no sólo que la operación sea la correcta.
  // La primera versión de este check miraba sólo la operación y pasó en verde
  // mientras el turno caía a degradado porque la pasarela no autorizaba
  // `rephrase_explanation`: el check acertaba por el motivo equivocado, que es
  // indistinguible de acertar hasta que alguien mira el `outcome`.
  comprobar(
    segundaPasada?.resultado.outcome === 'delivered' &&
      segundaPasada.resultado.audit.execution?.operation === 'rephrase_explanation',
    'la repetición reformula y SE ENTREGA, sin degradar (T-H7-05)',
  );

  const trasVeredicto = resultados.find((r) => r.acto === 'tras_veredicto');
  comprobar(
    trasVeredicto?.resultado.outcome === 'delivered',
    'el turno posterior al veredicto se entrega (bucle cerrado por dato)',
  );

  comprobar(
    caida.outcome === 'degraded' && caida.alteredCondition === true,
    'la caída del proveedor degrada con contenido congelado y lo declara (T-H7-06)',
  );

  // El anclaje: todo segmento entregado por el modelo o ancla o es
  // acompañamiento; ninguno introduce definición sin ancla —eso lo retiene el
  // validador y no llega aquí—.
  const conSegmentos = resultados.filter((r) => r.resultado.outcome === 'delivered');
  const sinRetenidos = conSegmentos.every((r) =>
    r.resultado.segments.every((s) => s.standing.kind !== 'withheld'),
  );
  comprobar(sinRetenidos, 'ningún segmento retenido llega al alumno (P-I §8.5)');

  const puntuable = resultados.find((r) => r.acto === 'actividad_puntuable');
  comprobar(
    puntuable !== undefined &&
      (puntuable.resultado.outcome === 'delivered' ||
        puntuable.resultado.outcome === 'blocked_by_non_revelation'),
    'la petición de solución en actividad puntuable no rompe la sesión',
  );

  mkdirSync(REPORT_DIR, { recursive: true });
  const informe = join(REPORT_DIR, 'live-session.json');
  writeFileSync(
    informe,
    `${JSON.stringify(
      {
        profile: 'C',
        modelId: PERFIL_C,
        blockId: BLOQUE,
        maxOutputTokens: MAX_TOKENS,
        packageFrozen: false,
        acts: resultados.map((r) => ({
          act: r.acto,
          outcome: r.resultado.outcome,
          policyRuleId: r.resultado.audit.policyRuleId,
          operation: r.resultado.audit.execution?.operation ?? null,
          strategy: r.resultado.audit.execution?.strategy ?? null,
        })),
        failures: fallos,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log(`\ninforme: ${informe}`);

  if (fallos.length > 0) {
    console.error(`\n${String(fallos.length)} comprobación(es) del AC en rojo.`);
    return 1;
  }
  console.log('\nAC del gate H7: sesión local completa, sin rescate docente.');
  return 0;
}

process.exitCode = await main();
