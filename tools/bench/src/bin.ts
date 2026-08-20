import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ModelBinding } from '@profesor-ia/contracts';
import {
  BudgetController,
  CostLedger,
  ModelGateway,
  PRICING_MANIFEST_2026_08_18,
  anthropicAdapter,
  envCredentialResolver,
  httpTransport,
  verifiedAtFromRefresh,
} from '@profesor-ia/model-gateway';
import { z } from 'zod';

import { partitionBySeed } from './case-set.js';
import { PILOT_CASE_SET, PILOT_INSTRUCTIONS } from './pilot-cases.js';
import { REFRESH_2026_08_18, REFRESH_WINDOW_5D } from './refresh-2026-08-18.js';
import { runBenchmark, type Candidate, type RunPlan } from './run.js';

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

async function main(): Promise<number> {
  const runId = process.argv[2];
  const timeoutMs = Number.parseInt(process.argv[3] ?? '60000', 10);
  if (runId === undefined || runId.trim() === '') {
    console.error('uso: node dist/bin.js <runId> [timeoutMs]');
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
  };

  const particion = partitionBySeed(PILOT_CASE_SET, 20260818, 0.5);

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
