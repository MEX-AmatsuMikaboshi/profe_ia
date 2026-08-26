import { appendFileSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ModelBinding, type ModelOperation } from '@profesor-ia/contracts';
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
  openaiAdapter,
  envCredentialResolver,
  httpTransport,
  verifiedAtFromRefresh,
  type AuthorizedCalculus,
  type DocumentaryRefreshRecord,
} from '@profesor-ia/model-gateway';
import { z } from 'zod';

import { partitionBySeed } from './case-set.js';

/**
 * Semillas de la partición desarrollo/evaluación de §8.5 (D-80).
 *
 * Estaban como literales en el cuerpo de cada subcomando y **no viajaban a
 * ningún informe**: dos corridas con particiones distintas producían artefactos
 * indistinguibles, y reproducir una exigía leer el código de la versión con la
 * que se corrió. Ahora se nombran aquí, entran en el plan y salen en el informe.
 *
 * Son la fecha en que se declaró cada conjunto, no un número bonito: elegirlas
 * después de ver resultados sería elegir qué mitad cuenta como evaluación.
 */
const SEMILLA_PARTICION_MATERIAL = 20260823;
const SEMILLA_PARTICION_EXPLORACION = 20260823;
const SEMILLA_PARTICION_PILOTO = 20260818;
import { anchoredSegmentsProbe, loadContentPackage } from './corpus.js';
import { outOfScopeProbe, ruleInventionProbe, solutionLeakProbe } from './evidence.js';
import { EXPLORATION_CASE_SET } from './exploration.js';
import {
  anthropicFaultyGatewayFactory,
  openaiFaultyGatewayFactory,
} from './fault-gateway.js';
import { MATERIAL_CASE_SET, MATERIAL_INSTRUCTIONS, MATERIAL_RESPONSE_SCHEMA } from './material-cases.js';
import { assessMaterialReadiness, formatReadiness } from './readiness.js';
import { PILOT_CASE_SET, PILOT_INSTRUCTIONS } from './pilot-cases.js';
import { REFRESH_2026_08_18, REFRESH_WINDOW_5D } from './refresh-2026-08-18.js';
import { REFRESH_2026_08_23 } from './refresh-2026-08-23.js';
import {
  OPENAI_LUNA_BINDING_WAIVER,
  OPENAI_LUNA_WAIVER,
  REFRESH_OPENAI_2026_08_23,
} from './refresh-openai-2026-08-23.js';
import { degradedRecoveryProbe, observeGates, type GateEvidence } from './scoring.js';
import { runBenchmark, sha256, type Candidate, type CaseOutcome, type RunPlan } from './run.js';

/**
 * Corrida piloto de BENCH-01 (T-H4-10).
 *
 * **Gasta dinero de verdad.** Por eso no tiene valores por omisión cómodos: el
 * `runId` y el instante de congelación entran por argumento, y sin credenciales
 * en el entorno falla antes de abrir un socket.
 *
 * El propósito es `pilot`: mide tokens por caso y **no dictamina**. El dictamen
 * lo bloquea `verdictFor()`, no la buena voluntad de quien lo ejecute.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const ENV_FILE = join(REPO, 'infra', 'compose', '.env');
const REPORT_DIR = join(REPO, 'analysis', 'reports');

/** Lee el `.env` no versionado. No lo imprime nunca. */
function cargarEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  let texto: string;
  try {
    texto = readFileSync(ENV_FILE, 'utf8');
  } catch {
    console.error(`no se pudo leer ${ENV_FILE}. Sin credenciales no hay corrida.`);
    process.exit(2);
  }
  for (const linea of texto.split(/\r?\n/)) {
    const limpia = linea.trim();
    if (limpia === '' || limpia.startsWith('#')) continue;
    const corte = limpia.indexOf('=');
    if (corte <= 0) continue;
    env[limpia.slice(0, corte).trim()] = limpia.slice(corte + 1).trim();
  }
  return env;
}

/** Esquema local de la salida (T-H4-03). Nada del proveedor cruza sin validar. */
const RESPUESTA = z.object({
  respuesta: z.string().min(1),
  fueraDeAlcance: z.boolean(),
  entregaSolucion: z.boolean(),
  reglasCitadas: z.array(z.string()),
});

function bindingDe(candidateId: string, provider: string): ModelBinding {
  const refresco = REFRESH_2026_08_18.candidates.find((c) => c.candidateId === candidateId);
  if (refresco === undefined) {
    console.error(`el refresco documental no cubre a ${candidateId}; medirlo sin reverificar es ` +
      'lo que P-II §8.1 prohíbe.');
    process.exit(2);
  }
  return ModelBinding.parse({
    bindingId: `binding-sesion-${candidateId}`,
    profile: 'SESION',
    provider,
    modelId: refresco.modelId,
    endpoint: refresco.endpoint,
    ...(refresco.snapshot === undefined ? {} : { snapshot: refresco.snapshot }),
    capabilities: {
      supportedParameters: refresco.supportedParameters,
      rejectedParameters: refresco.rejectedParameters,
      structuredOutput: { supported: true },
      reasoning: { supported: false },
      batch: { supported: false },
      caching: { supported: false },
      dataPolicy: { contractualEligibility: 'unknown' },
    },
    // Derivado del refresco, nunca escrito a mano: un binding con una fecha que
    // ningún refresco respalda afirmaría una reverificación que nadie hizo.
    verifiedAt: verifiedAtFromRefresh(REFRESH_2026_08_18, candidateId),
  });
}

/**
 * `preparacion <runId> [candidatoA,candidatoB]` — ¿está todo para la corrida
 * material?
 *
 * **No abre un socket, no lee credenciales y no cuesta nada.** Responde la
 * pregunta anterior a gastar: qué falta. Los frenos del runner siguen donde
 * estaban —esto los adelanta, no los sustituye—, y el motivo de adelantarlos es
 * que para llegar hasta ellos hay que haber montado credenciales, pasarelas y
 * transporte, y descubrir así que falta un bloque obliga a repetirlo todo.
 *
 * Sale con 0 si se puede correr y con 1 si no. El 1 no es un error del comando:
 * es su respuesta.
 */
function preparacion(): number {
  const runId = process.argv[3];
  if (runId === undefined || runId.trim() === '') {
    console.error('uso: node dist/bin.js preparacion <runId> [candidatoA,candidatoB]');
    return 2;
  }
  const candidateIds = (process.argv[4] ?? 'claude-sonnet-5')
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c !== '');

  const readiness = assessMaterialReadiness({
    runId,
    assessedAt: new Date().toISOString(),
    caseSet: MATERIAL_CASE_SET,
    contentPackage: loadContentPackage(join(REPO, 'content', 'unidad-deduccion-natural')),
    // El vigente. El del 2026-08-18 caducó y además no cubre a
    // `claude-sonnet-5`; se conserva en el repositorio porque es la evidencia
    // del piloto, no porque siga autorizando nada.
    refreshRecord: REFRESH_2026_08_23,
    refreshWindow: REFRESH_WINDOW_5D,
    candidateIds,
  });
  console.log(formatReadiness(readiness));
  return readiness.readyToRun ? 0 : 1;
}

const OPERACIONES_DE_SESION: readonly ModelOperation[] = [
  'explain_block',
  'rephrase_explanation',
  'classify_student_error',
  'classify_question_scope',
];

/**
 * El cálculo congelado, inyectado. `logic-core` es la autoridad; esto no lo
 * transcribe, lo pasa. Es la misma frontera que `anchoredSegmentsProbe()` fija
 * al pedirlo por parámetro.
 */
const CALCULO_CONGELADO: AuthorizedCalculus = {
  version: AUTHORIZED_CALCULUS_VERSION,
  canonicalSymbols: ['¬', '∧', '∨', '→', '↔', '⊥'],
  connectiveAliases: Object.keys(CONNECTIVE_ALIASES),
  forbiddenRuleIds: [...FORBIDDEN_RULES_EXAMPLES],
};

/** Binding derivado del refresco que se le pase. Nunca escrito a mano. */
function bindingDesde(
  refresco: DocumentaryRefreshRecord,
  candidateId: string,
  provider: string,
): ModelBinding {
  const candidato = refresco.candidates.find((c) => c.candidateId === candidateId);
  if (candidato === undefined) {
    console.error(
      `el refresco ${refresco.refreshId} no cubre a ${candidateId}; medirlo sin reverificar es ` +
        'lo que P-II §8.1 prohíbe.',
    );
    process.exit(2);
  }
  return ModelBinding.parse({
    bindingId: `binding-sesion-${candidateId}`,
    profile: 'SESION',
    provider,
    modelId: candidato.modelId,
    endpoint: candidato.endpoint,
    ...(candidato.snapshot === undefined ? {} : { snapshot: candidato.snapshot }),
    capabilities: {
      supportedParameters: candidato.supportedParameters,
      rejectedParameters: candidato.rejectedParameters,
      structuredOutput: { supported: true },
      reasoning: { supported: false },
      batch: { supported: false },
      caching: { supported: false },
      dataPolicy: { contractualEligibility: 'unknown' },
    },
    verifiedAt: verifiedAtFromRefresh(refresco, candidateId),
  });
}

/**
 * `material <runId> <candidatos> <repeticiones> [timeoutMs]` — la corrida
 * material de BENCH-01 (T-H4-10 ← P-III §6.1/§6.2).
 *
 * **Gasta dinero de verdad y mucho más que el piloto.** Nada tiene valor por
 * omisión: el `runId`, los candidatos y las repeticiones entran por argumento,
 * porque las tres son decisiones del plan y §6.1 exige congelarlas antes de
 * mirar un solo resultado.
 *
 * **Mide y no corona.** Se usa `observeGates()`, no `scoreCandidate()`: el
 * paquete de contenido no está congelado —W5 no ha corrido— y el código lo
 * impide a propósito. Lo que sale de aquí es la medición de los seis gates con
 * su `x/n`, que es lo que el propietario necesita para decidir; el dictamen
 * formal sigue esperando a W5.
 */
async function material(): Promise<number> {
  const runId = process.argv[3];
  const candidatosArg = process.argv[4];
  const repeticionesArg = process.argv[5];
  const maxTokensArg = process.argv[6];
  if (
    runId === undefined ||
    candidatosArg === undefined ||
    repeticionesArg === undefined ||
    maxTokensArg === undefined
  ) {
    console.error(
      'uso: node dist/bin.js material <runId> <candidatoA,candidatoB> <repeticiones> ' +
        '<maxTokens> [timeoutMs]',
    );
    return 2;
  }
  const candidateIds = candidatosArg
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c !== '');
  const repetitions = Number.parseInt(repeticionesArg, 10);
  // `max_tokens` es de la corrida y **entra por argumento sin valor por
  // omisión**: §8.5 lo pone expresamente entre lo que la fase de desarrollo
  // itera, y un tope escondido en el código sería una decisión de configuración
  // que nadie declaró. Además un tope que ata trunca las respuestas y el gate de
  // utilizables mediría el harness en vez de al candidato.
  const maxTokens = Number.parseInt(maxTokensArg, 10);
  const timeoutMs = Number.parseInt(process.argv[7] ?? '120000', 10);
  if (!Number.isInteger(repetitions) || repetitions < 1) {
    console.error(`repeticiones inválidas: ${repeticionesArg}`);
    return 2;
  }
  if (!Number.isInteger(maxTokens) || maxTokens < 1) {
    console.error(`maxTokens inválido: ${maxTokensArg}`);
    return 2;
  }

  const contentRoot = join(REPO, 'content', 'unidad-deduccion-natural');
  const paquete = loadContentPackage(contentRoot);

  // El plan se congela **antes** de arrancar, y por eso son dos instantes
  // distintos y no uno reutilizado: §6.1 rechaza un plan congelado después.
  const frozenAt = new Date().toISOString();

  const preparacionMaterial = assessMaterialReadiness({
    runId,
    assessedAt: frozenAt,
    caseSet: MATERIAL_CASE_SET,
    contentPackage: paquete,
    refreshRecord: REFRESH_2026_08_23,
    refreshWindow: REFRESH_WINDOW_5D,
    candidateIds,
  });
  console.log(formatReadiness(preparacionMaterial));
  console.log('');
  if (!preparacionMaterial.readyToRun) {
    console.error('no se corre: hay comprobaciones bloqueantes en rojo.');
    return 1;
  }

  const env = cargarEnv();
  const transport = httpTransport({ timeoutMs });
  const credentialResolver = envCredentialResolver('anthropic', env);

  const candidatos: Candidate[] = candidateIds.map((candidateId) => {
    const binding = bindingDesde(REFRESH_2026_08_23, candidateId, 'anthropic');
    return {
      candidateId,
      binding,
      gateway: new ModelGateway({
        profile: 'SESION',
        registrations: [{ binding, operations: [...OPERACIONES_DE_SESION] }],
        credentialResolver,
        adapters: [anthropicAdapter],
        transport,
      }),
      faultyGatewayFor: anthropicFaultyGatewayFactory({
        binding,
        operations: OPERACIONES_DE_SESION,
        credentialResolver,
      }),
    };
  });

  const ledger = new CostLedger();
  const budget = new BudgetController(ledger, { alertThresholdMxn: 300 });
  const degraded = new DegradedProfile({
    assets: paquete.frozenAssets,
    feedbackTemplates: paquete.feedbackTemplates,
  });

  mkdirSync(REPORT_DIR, { recursive: true });
  const bitacora = join(REPORT_DIR, `${runId}.outcomes.jsonl`);
  writeFileSync(bitacora, '', 'utf8');

  const plan: RunPlan = {
    runId,
    purpose: 'material',
    repetitions,
    frozenAt,
    startedAt: new Date().toISOString(),
    partitionSeed: SEMILLA_PARTICION_MATERIAL,
    instructionsSha256: sha256(MATERIAL_INSTRUCTIONS),
  };

  // La partición desarrollo/evaluación es de §8.5 y va por semilla. La semilla
  // es del plan y se declara aquí: elegirla después de ver resultados sería
  // elegir qué mitad cuenta como evaluación.
  //
  // **No cambia al iterar el prompt** (D-80). §8.5 pide volver a congelar y
  // **re-correr** la evaluación con las instrucciones nuevas; cambiar además la
  // semilla movería los casos de mitad y haría incomparables las dos corridas
  // por una razón distinta de la que se quería medir. Lo que caduca son los
  // números viejos, no la partición.
  const particion = partitionBySeed(MATERIAL_CASE_SET, SEMILLA_PARTICION_MATERIAL, 0.5);

  console.log(
    `corriendo BENCH-01 material — ${String(MATERIAL_CASE_SET.cases.length)} casos × ` +
      `${String(candidatos.length)} candidatos × ${String(repetitions)} repeticiones`,
  );
  console.log(`bitácora incremental: ${bitacora}`);

  let hechos = 0;
  const resultado = await runBenchmark(plan, particion, candidatos, {
    ledger,
    budget,
    manifest: PRICING_MANIFEST_2026_08_18,
    refreshRecord: REFRESH_2026_08_23,
    refreshWindow: REFRESH_WINDOW_5D,
    degraded,
    degradedAssetVersion: paquete.assetVersion,
    contentPackage: paquete,
    schema: MATERIAL_RESPONSE_SCHEMA,
    // Medido el 2026-08-18 sobre este mismo proveedor: devuelve JSON dentro de
    // una valla ```json y reforzar la instrucción no lo corrige.
    codeFence: 'unwrap',
    instructions: MATERIAL_INSTRUCTIONS,
    parameters: { max_tokens: maxTokens },
    onOutcome: (outcome) => {
      appendFileSync(bitacora, `${JSON.stringify(outcome)}\n`, 'utf8');
      hechos += 1;
      if (hechos % 25 === 0) {
        console.log(`  ${String(hechos)} casos — MXN ${budget.accumulatedMxn().toFixed(4)}`);
      }
    },
  });

  const destino = join(REPORT_DIR, `${runId}.json`);
  writeFileSync(destino, JSON.stringify(resultado, null, 2), 'utf8');

  // Las cinco sondas. Ninguna se omite: `observeGates()` lanza si falta una, y
  // un gate sin sonda no es un gate aprobado.
  const evidence: GateEvidence = {
    disclosedSolution: solutionLeakProbe(),
    unblockedRuleInventions: ruleInventionProbe(),
    outOfScopeDeclaredOrContained: outOfScopeProbe(),
    factualSegments: anchoredSegmentsProbe(paquete, CALCULO_CONGELADO),
    recoveredToDegraded: degradedRecoveryProbe(),
  };

  const medicion = candidateIds.map((candidateId) => {
    const gates = observeGates(candidateId, {
      runResult: resultado,
      caseSet: MATERIAL_CASE_SET,
      repetitions,
      evidence,
      contentPackage: paquete,
    });
    const suyos = resultado.outcomes.filter((o: CaseOutcome) => o.candidateId === candidateId);
    const costMxn = suyos.reduce((n: number, o: CaseOutcome) => n + o.costMxn, 0);
    return { candidateId, gates, costMxn, outcomes: suyos.length };
  });

  const gatesDestino = join(REPORT_DIR, `${runId}.gates.json`);
  writeFileSync(
    gatesDestino,
    JSON.stringify(
      {
        runId,
        purpose: 'material',
        plan: {
          repetitions,
          frozenAt,
          startedAt: plan.startedAt,
          seed: 20260823,
          maxTokens,
          timeoutMs,
        },
        caseSetId: MATERIAL_CASE_SET.caseSetId,
        assetVersion: paquete.assetVersion,
        packageFrozen: paquete.frozen,
        refreshId: REFRESH_2026_08_23.refreshId,
        ageSecondsByCandidate: resultado.ageSecondsByCandidate,
        totalCostMxn: resultado.totalCostMxn,
        measurements: medicion,
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log('');
  for (const m of medicion) {
    console.log(`── ${m.candidateId} — ${String(m.outcomes)} resultados, MXN ${m.costMxn.toFixed(4)}`);
    for (const g of m.gates) {
      console.log(`   ${g.passed ? 'ok   ' : 'FALLA'} ${g.gateId}  ${g.wording}`);
    }
    const bloquea = m.gates.some((g) => !g.passed && g.blocking);
    console.log(`   bloqueado por gate bloqueante: ${bloquea ? 'SÍ' : 'no'}`);
    console.log('');
  }
  console.log(`costo total: MXN ${resultado.totalCostMxn.toFixed(4)}`);
  console.log(`reporte: ${destino}`);
  console.log(`gates:   ${gatesDestino}`);
  console.log('');
  console.log(
    'Esto MIDE y no corona: el paquete de contenido no está congelado (W5 no ha corrido) y ' +
      '`scoreCandidate()` lo impide. La elección de ganador es del propietario.',
  );
  return 0;
}

/**
 * `exploratorio <runId> <maxOutputTokens> [timeoutMs]` — la medición
 * exploratoria de `gpt-5.6-luna` (P-II §8.1, §8.5).
 *
 * **Gasta dinero de verdad, y no corona a nadie.** Corre los **mismos 200
 * casos** que la corrida material —la misma referencia, no una copia: comparar
 * con exámenes distintos no compara nada— pero con propósito `pilot`, así que
 * `verdictFor()` rechazaría dictaminar con ellos.
 *
 * ## Las tres puertas que impiden que esto corone, y son independientes
 *
 * 1. **El conjunto es `pilot`.** `verdictFor()` no dictamina sobre un piloto.
 * 2. **El refresco es `test_fixture`.** `assertRefreshAuthorizesBenchmark()`
 *    rechaza un refresco no material para una corrida material.
 * 3. **La renuncia de identidad se rechaza en corrida material**, por sí sola.
 *
 * Tres y no una porque una puerta es una puerta que alguien quita.
 */
async function exploratorio(): Promise<number> {
  const runId = process.argv[3];
  const maxTokensArg = process.argv[4];
  if (runId === undefined || maxTokensArg === undefined) {
    console.error('uso: node dist/bin.js exploratorio <runId> <maxOutputTokens> [timeoutMs]');
    return 2;
  }
  const maxOutputTokens = Number.parseInt(maxTokensArg, 10);
  const timeoutMs = Number.parseInt(process.argv[5] ?? '180000', 10);
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1) {
    console.error(`maxOutputTokens inválido: ${maxTokensArg}`);
    return 2;
  }

  const candidateId = 'gpt-5.6-luna';
  const paquete = loadContentPackage(join(REPO, 'content', 'unidad-deduccion-natural'));
  const frozenAt = new Date().toISOString();

  const env = cargarEnv();
  const transport = httpTransport({ timeoutMs });
  const credentialResolver = envCredentialResolver('openai', env);
  const binding = bindingDesde(REFRESH_OPENAI_2026_08_23, candidateId, 'openai');

  const candidato: Candidate = {
    candidateId,
    binding,
    gateway: new ModelGateway({
      profile: 'SESION',
      registrations: [{ binding, operations: [...OPERACIONES_DE_SESION] }],
      credentialResolver,
      adapters: [openaiAdapter],
      transport,
      unpinnedIdentityWaivers: [OPENAI_LUNA_BINDING_WAIVER],
    }),
    faultyGatewayFor: openaiFaultyGatewayFactory({
      binding,
      operations: OPERACIONES_DE_SESION,
      credentialResolver,
      waiver: OPENAI_LUNA_BINDING_WAIVER,
    }),
  };

  const ledger = new CostLedger();
  const budget = new BudgetController(ledger, { alertThresholdMxn: 300 });
  const degraded = new DegradedProfile({
    assets: paquete.frozenAssets,
    feedbackTemplates: paquete.feedbackTemplates,
  });

  mkdirSync(REPORT_DIR, { recursive: true });
  const bitacora = join(REPORT_DIR, `${runId}.outcomes.jsonl`);
  writeFileSync(bitacora, '', 'utf8');

  const plan: RunPlan = {
    runId,
    purpose: 'pilot',
    repetitions: 1,
    frozenAt,
    startedAt: new Date().toISOString(),
    partitionSeed: SEMILLA_PARTICION_EXPLORACION,
    instructionsSha256: sha256(MATERIAL_INSTRUCTIONS),
  };

  console.log(`EXPLORATORIA — ${candidateId}, ${String(EXPLORATION_CASE_SET.cases.length)} casos`);
  console.log(`identidad NO fijada; renuncia de ${OPENAI_LUNA_BINDING_WAIVER.authorizedBy}`);
  console.log(`bitácora incremental: ${bitacora}`);

  let hechos = 0;
  const resultado = await runBenchmark(
    plan,
    partitionBySeed(EXPLORATION_CASE_SET, SEMILLA_PARTICION_EXPLORACION, 0.5),
    [candidato],
    {
      ledger,
      budget,
      manifest: PRICING_MANIFEST_2026_08_18,
      refreshRecord: REFRESH_OPENAI_2026_08_23,
      refreshWindow: REFRESH_WINDOW_5D,
      unpinnedIdentityWaivers: [OPENAI_LUNA_WAIVER],
      degraded,
      degradedAssetVersion: paquete.assetVersion,
      contentPackage: paquete,
      schema: MATERIAL_RESPONSE_SCHEMA,
      codeFence: 'unwrap',
      instructions: MATERIAL_INSTRUCTIONS,
      parameters: { max_output_tokens: maxOutputTokens },
      onOutcome: (outcome) => {
        appendFileSync(bitacora, `${JSON.stringify(outcome)}\n`, 'utf8');
        hechos += 1;
        if (hechos % 25 === 0) {
          console.log(`  ${String(hechos)} casos — MXN ${budget.accumulatedMxn().toFixed(4)}`);
        }
      },
    },
  );

  writeFileSync(join(REPORT_DIR, `${runId}.json`), JSON.stringify(resultado, null, 2), 'utf8');

  const gates = observeGates(candidateId, {
    runResult: resultado,
    caseSet: EXPLORATION_CASE_SET,
    repetitions: 1,
    evidence: {
      disclosedSolution: solutionLeakProbe(),
      unblockedRuleInventions: ruleInventionProbe(),
      outOfScopeDeclaredOrContained: outOfScopeProbe(),
      factualSegments: anchoredSegmentsProbe(paquete, CALCULO_CONGELADO),
      recoveredToDegraded: degradedRecoveryProbe(),
    },
    contentPackage: paquete,
  });

  const gatesDestino = join(REPORT_DIR, `${runId}.gates.json`);
  writeFileSync(
    gatesDestino,
    JSON.stringify(
      {
        runId,
        purpose: 'exploratorio',
        crowningImpossible:
          'conjunto piloto, refresco test_fixture y renuncia de identidad: las tres puertas ' +
          'impiden el dictamen por separado',
        identityWaiver: OPENAI_LUNA_WAIVER,
        plan: {
          repetitions: 1,
          frozenAt,
          startedAt: plan.startedAt,
          seed: 20260823,
          maxOutputTokens,
          timeoutMs,
        },
        caseSetId: EXPLORATION_CASE_SET.caseSetId,
        assetVersion: paquete.assetVersion,
        refreshId: REFRESH_OPENAI_2026_08_23.refreshId,
        totalCostMxn: resultado.totalCostMxn,
        measurements: [
          {
            candidateId,
            gates,
            costMxn: resultado.outcomes.reduce((n: number, o: CaseOutcome) => n + o.costMxn, 0),
            outcomes: resultado.outcomes.length,
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log('');
  console.log(`── ${candidateId} — ${String(resultado.outcomes.length)} resultados`);
  for (const g of gates) {
    console.log(`   ${g.passed ? 'ok   ' : 'FALLA'} ${g.gateId}  ${g.wording}`);
  }
  console.log('');
  console.log(`costo total: MXN ${resultado.totalCostMxn.toFixed(4)}`);
  console.log(`gates:   ${gatesDestino}`);
  console.log('');
  console.log(
    'ESTO NO CORONA A NADIE. La identidad de este modelo no está fijada por el proveedor: si ' +
      'cambia el modelo bajo el id, esta medición no se puede rehacer.',
  );
  return 0;
}

/**
 * `puntuar <runId> <material|exploratorio>` — recomputa los seis gates desde una
 * corrida ya guardada. **No abre un socket y no cuesta nada.**
 *
 * ## Por qué hace falta, y qué disciplina respeta
 *
 * Los resultados y las sondas son cosas distintas: `RunResult` guarda lo que el
 * proveedor contestó —que es un hecho y no cambia— y las sondas son el criterio
 * con que se lee. §8.5 pone los **validadores** entre lo que la fase de
 * desarrollo itera, así que corregir una sonda y volver a puntuar es el
 * procedimiento previsto, no un atajo.
 *
 * **Lo que NO permite:** volver a puntuar no vuelve a preguntar. Si la sonda
 * cambia, cambia para **todos** los candidatos de todas las corridas, porque
 * lee el mismo archivo con el mismo código. Ajustar una sonda hasta que gane
 * uno exigiría un criterio que dependa del candidato, y aquí no hay ninguno:
 * las sondas no reciben `candidateId`.
 */
function puntuar(): number {
  const runId = process.argv[3];
  const clase = process.argv[4];
  if (runId === undefined || (clase !== 'material' && clase !== 'exploratorio')) {
    console.error('uso: node dist/bin.js puntuar <runId> <material|exploratorio>');
    return 2;
  }

  const paquete = loadContentPackage(join(REPO, 'content', 'unidad-deduccion-natural'));
  const origen = join(REPORT_DIR, `${runId}.json`);
  let resultado: {
    readonly runId: string;
    readonly purpose: 'pilot' | 'material';
    readonly outcomes: readonly CaseOutcome[];
    readonly totalCostMxn: number;
    readonly costPerCaseMxn: number;
    readonly ageSecondsByCandidate: Readonly<Record<string, number>>;
    // Opcionales al **leer** porque los informes anteriores a D-80 no los
    // traen. No lo son al escribir: `RunResult` los exige.
    readonly partitionSeed?: number;
    readonly instructionsSha256?: string;
  };
  try {
    resultado = JSON.parse(readFileSync(origen, 'utf8')) as typeof resultado;
  } catch (error) {
    console.error(`no se pudo leer ${origen}: ${error instanceof Error ? error.message : ''}`);
    return 2;
  }

  // Proveniencia del informe leído (D-80). Un informe anterior a D-80 no la
  // trae, y **no se fabrica**: se marca como desconocida con un centinela
  // greppable. Poner un cero o una cadena vacía diría «semilla 0, prompt
  // vacío», que es una afirmación falsa disfrazada de valor por omisión —
  // exactamente lo que `pendingCatalog()` existe para no hacer.
  const PROVENIENCIA_LEIDA = {
    partitionSeed: resultado.partitionSeed ?? -1,
    instructionsSha256:
      resultado.instructionsSha256 ?? 'desconocida:informe-anterior-a-D-80',
  } as const;
  if (resultado.partitionSeed === undefined || resultado.instructionsSha256 === undefined) {
    console.warn(
      `aviso: ${origen} es anterior a D-80 y no registra ni la semilla de partición ni la ` +
        'huella de las instrucciones. Se puntúa igual —los resultados son hechos y no ' +
        'cambian—, pero sus números no son comparables con los de otra corrida sin ' +
        'comprobar a mano con qué prompt salieron.',
    );
  }

  const caseSet = clase === 'material' ? MATERIAL_CASE_SET : EXPLORATION_CASE_SET;
  const evidence: GateEvidence = {
    disclosedSolution: solutionLeakProbe(),
    unblockedRuleInventions: ruleInventionProbe(),
    outOfScopeDeclaredOrContained: outOfScopeProbe(),
    factualSegments: anchoredSegmentsProbe(paquete, CALCULO_CONGELADO),
    recoveredToDegraded: degradedRecoveryProbe(),
  };

  // Las repeticiones se derivan de lo observado y **se comprueban**: el
  // denominador de §6.2 sale del plan, así que si los resultados no son un
  // múltiplo exacto del conjunto, la corrida está incompleta y puntuarla
  // reportaría una tasa sobre un denominador que encogió.
  const candidatos = [...new Set(resultado.outcomes.map((o) => o.candidateId))];
  const medicion = candidatos.map((candidateId) => {
    const suyos = resultado.outcomes.filter((o) => o.candidateId === candidateId);
    const repetitions = suyos.length / caseSet.cases.length;
    if (!Number.isInteger(repetitions) || repetitions < 1) {
      throw new Error(
        `${candidateId} trae ${String(suyos.length)} resultados y el conjunto tiene ` +
          `${String(caseSet.cases.length)} casos: no es un múltiplo, así que la corrida está ` +
          'incompleta. Puntuarla daría una tasa sobre un denominador que encogió (P-III §6.2).',
      );
    }
    const gates = observeGates(candidateId, {
      runResult: { ...resultado, ...PROVENIENCIA_LEIDA },
      caseSet,
      repetitions,
      evidence,
      contentPackage: paquete,
    });
    return {
      candidateId,
      repetitions,
      gates,
      costMxn: suyos.reduce((n, o) => n + o.costMxn, 0),
      outcomes: suyos.length,
    };
  });

  const destino = join(REPORT_DIR, `${runId}.gates.json`);
  writeFileSync(
    destino,
    JSON.stringify(
      {
        runId,
        purpose: clase,
        rescoredAt: new Date().toISOString(),
        caseSetId: caseSet.caseSetId,
        caseSetPurpose: caseSet.purpose,
        assetVersion: paquete.assetVersion,
        packageFrozen: paquete.frozen,
        totalCostMxn: resultado.totalCostMxn,
        measurements: medicion,
      },
      null,
      2,
    ),
    'utf8',
  );

  for (const m of medicion) {
    console.log(`── ${m.candidateId} — ${String(m.outcomes)} resultados, MXN ${m.costMxn.toFixed(4)}`);
    for (const g of m.gates) {
      console.log(`   ${g.passed ? 'ok   ' : 'FALLA'} ${g.gateId}  ${g.wording}`);
    }
    console.log(`   bloqueado: ${m.gates.some((g) => !g.passed && g.blocking) ? 'SÍ' : 'no'}`);
    console.log('');
  }
  console.log(`gates: ${destino}`);
  return 0;
}

async function main(): Promise<number> {
  if (process.argv[2] === 'preparacion') return preparacion();
  if (process.argv[2] === 'material') return material();
  if (process.argv[2] === 'exploratorio') return exploratorio();
  if (process.argv[2] === 'puntuar') return puntuar();

  const runId = process.argv[2];
  const timeoutMs = Number.parseInt(process.argv[3] ?? '60000', 10);
  if (runId === undefined || runId.trim() === '') {
    console.error(
      [
        'uso: node dist/bin.js <runId> [timeoutMs]   (corrida piloto, GASTA DINERO)',
        '     node dist/bin.js material <runId> <candidatos> <repeticiones> <maxTokens> [timeoutMs]',
        '                                                (corrida material, GASTA MUCHO MÁS)',
        '     node dist/bin.js exploratorio <runId> <maxOutputTokens> [timeoutMs]',
        '                                                (exploratoria OpenAI, NO corona)',
        '     node dist/bin.js puntuar <runId> <material|exploratorio>   (repuntúa, no gasta)',
        '     node dist/bin.js preparacion <runId> [candidatos]   (comprobación, no gasta)',
      ].join('\n'),
    );
    return 2;
  }

  const env = cargarEnv();
  const transport = httpTransport({ timeoutMs });

  // **Sólo Anthropic.** `gpt-5.6-luna` no publica snapshot fechado y sin él
  // §8.1 exige huella de comportamiento sobre el set canario; no existe todavía
  // e inventarla sería fabricar la evidencia que la regla pide.
  // `assertRefreshAuthorizesBenchmark` lo rechaza solo si se le cuela.
  const bindingHaiku = bindingDe('claude-haiku-4-5-20251001', 'anthropic');
  const candidatos: Candidate[] = [
    {
      candidateId: 'claude-haiku-4-5-20251001',
      binding: bindingHaiku,
      gateway: new ModelGateway({
        profile: 'SESION',
        registrations: [
          {
            binding: bindingHaiku,
            operations: [
              'explain_block',
              'rephrase_explanation',
              'classify_student_error',
              'classify_question_scope',
            ],
          },
        ],
        credentialResolver: envCredentialResolver('anthropic', env),
        adapters: [anthropicAdapter],
        transport,
      }),
    },
  ];

  const ledger = new CostLedger();
  const budget = new BudgetController(ledger, { alertThresholdMxn: 300 });

  const ahora = new Date().toISOString();
  const plan: RunPlan = {
    runId,
    purpose: 'pilot',
    repetitions: 1,
    // El plan se congela antes de arrancar; aquí coinciden porque el piloto no
    // tiene fase de evaluación que mirar.
    frozenAt: ahora,
    startedAt: ahora,
    partitionSeed: SEMILLA_PARTICION_PILOTO,
    instructionsSha256: sha256(PILOT_INSTRUCTIONS),
  };

  const particion = partitionBySeed(PILOT_CASE_SET, SEMILLA_PARTICION_PILOTO, 0.5);

  const resultado = await runBenchmark(plan, particion, candidatos, {
    ledger,
    budget,
    manifest: PRICING_MANIFEST_2026_08_18,
    refreshRecord: REFRESH_2026_08_18,
    refreshWindow: REFRESH_WINDOW_5D,
    schema: RESPUESTA,
    // Medido el 2026-08-18: el modelo devuelve JSON válido dentro de una valla
    // ```json y reforzar la instrucción no lo corrige. Se autoriza desenvolver.
    codeFence: 'unwrap',
    instructions: PILOT_INSTRUCTIONS,
    // Anthropic exige `max_tokens`; está declarado en supportedParameters del
    // refresco, así que la pasarela lo autoriza. Es de la corrida y no del caso:
    // dos casos con distinto tope no serían comparables.
    parameters: { max_tokens: 1024 },
  });

  mkdirSync(REPORT_DIR, { recursive: true });
  const destino = join(REPORT_DIR, `${runId}.json`);
  writeFileSync(destino, JSON.stringify(resultado, null, 2), 'utf8');

  console.log(`corrida ${runId} — ${String(resultado.outcomes.length)} resultados`);
  console.log(`costo total: MXN ${resultado.totalCostMxn.toFixed(4)}`);
  console.log(`costo por caso: MXN ${resultado.costPerCaseMxn.toFixed(4)}`);
  console.log(`acumulado del gate: MXN ${budget.accumulatedMxn().toFixed(4)}`);
  console.log(`reporte: ${destino}`);
  return 0;
}

process.exit(await main());
