import type { CostEvent, ModelBinding, PricingManifest } from '@profesor-ia/contracts';
import {
  assertRefreshAuthorizesBenchmark,
  priceCall,
  type BudgetController,
  type CodeFencePolicy,
  type CostLedger,
  type ModelGateway,
  type ProviderUsage,
  type ValidatedOutput,
} from '@profesor-ia/model-gateway';
import type { ZodType } from 'zod';

import type { BenchCase, CaseSetPurpose, PartitionedCaseSet } from './case-set.js';

/**
 * Runner de BENCH-01 (T-H4-10 ← P-III §6.1/§6.2).
 *
 * Es el único punto de todo el repositorio donde se gasta dinero, así que las
 * propiedades que defiende no son de medición sino de freno:
 *
 * 1. **El presupuesto se comprueba antes de cada llamada facturable**, no
 *    después. Comprobar después registra el gasto que ya se hizo; el bloqueo de
 *    `OWNER-BUDGET-001` existe para que no se haga.
 * 2. **El refresco documental autoriza la corrida antes de la primera llamada.**
 *    Si la evidencia caducó, el gasto no ha empezado todavía.
 * 3. **El reintento es único y se cuenta.** P-III §6.2 mide «utilizables después
 *    de un reintento»; un reintento invisible falsearía tanto la tasa como el
 *    costo. El transporte no reintenta por su cuenta justamente para que el
 *    único reintento del sistema esté aquí, contado.
 * 4. **Un uso no reportado detiene la corrida.** Sin tokens no hay costo, y
 *    seguir gastando sin poder tarifar es gastar a ciegas. No se asume cero.
 * 5. **El plan se congela antes de evaluación.** Tamaño y repeticiones se fijan
 *    antes de mirar resultados (P-III §6.1); si el plan se congelara después,
 *    elegir el número de repeticiones sería elegir el resultado.
 */

export class BenchRunError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export interface Candidate {
  readonly candidateId: string;
  readonly binding: ModelBinding;
  readonly gateway: ModelGateway;
}

/**
 * Plan congelado antes de evaluación. `frozenAt` no es decorativo: se compara
 * contra `startedAt` y una corrida cuyo plan se congeló después de empezar
 * queda rechazada.
 */
export interface RunPlan {
  readonly runId: string;
  readonly purpose: CaseSetPurpose;
  readonly repetitions: number;
  readonly frozenAt: string;
  readonly startedAt: string;
}

export interface RunDependencies {
  readonly ledger: CostLedger;
  readonly budget: BudgetController;
  readonly manifest: PricingManifest;
  /** Registro del refresco documental (T-H4-09) y su ventana. */
  readonly refreshRecord: unknown;
  readonly refreshWindow: unknown;
  /** Esquema local contra el que se valida cada salida (T-H4-03). */
  readonly schema: ZodType<unknown>;
  /**
   * Política de bloque de código, declarada por la corrida (T-H4-03). Es de la
   * corrida y no del caso: si un caso desenvolviera y otro no, la tasa de
   * salidas utilizables mezclaría dos criterios distintos.
   */
  readonly codeFence: CodeFencePolicy;
  /** Instrucciones de sistema; el runner no redacta contenido pedagógico. */
  readonly instructions: string;
  /**
   * Parámetros solicitados por llamada (T-H4-02). Los contrasta la pasarela
   * contra `ModelCapabilities`; van aquí porque son de la corrida, no del caso:
   * dos casos con distinto `max_tokens` no serían comparables.
   */
  readonly parameters?: Readonly<Record<string, unknown>>;
}

export interface CaseOutcome {
  readonly caseId: string;
  readonly candidateId: string;
  readonly repetition: number;
  readonly classification: ValidatedOutput<unknown>['classification'];
  /** Intentos consumidos: 1, o 2 cuando hubo el reintento único. */
  readonly attempts: number;
  readonly usage: ProviderUsage;
  readonly costMxn: number;
  /**
   * Lo que el modelo respondió, ya validado. **Sin esto no hay gates**: fugas
   * de solución, preguntas fuera de corpus e invenciones de reglas se miden
   * sobre el contenido, no sobre la clasificación. Un benchmark que descarta la
   * respuesta sólo sabe decir si parseó.
   */
  readonly data?: unknown;
  /**
   * Texto bruto tal como llegó, incluso cuando la salida se descartó. Es lo
   * único que permite auditar después por qué un caso se clasificó como se
   * clasificó, y P-II §8.4 exige conservarlo pase lo que pase.
   */
  readonly rawOutput: string;
}

export interface RunResult {
  readonly runId: string;
  readonly purpose: CaseSetPurpose;
  readonly outcomes: readonly CaseOutcome[];
  readonly totalCostMxn: number;
  /** Lo que el piloto existe para responder. */
  readonly costPerCaseMxn: number;
  readonly ageSecondsByCandidate: Readonly<Record<string, number>>;
}

function assertPlanFrozenBeforeStart(plan: RunPlan): void {
  const congelado = Date.parse(plan.frozenAt);
  const arranque = Date.parse(plan.startedAt);
  if (Number.isNaN(congelado) || Number.isNaN(arranque)) {
    throw new BenchRunError(
      `El plan ${plan.runId} trae fechas ilegibles (frozenAt=${plan.frozenAt}, ` +
        `startedAt=${plan.startedAt}).`,
    );
  }
  if (congelado > arranque) {
    throw new BenchRunError(
      `El plan ${plan.runId} se congeló después de arrancar. Fijar tamaño y repeticiones ` +
        'mirando resultados es elegir el resultado (P-III §6.1).',
    );
  }
  if (plan.repetitions < 1 || !Number.isInteger(plan.repetitions)) {
    throw new BenchRunError(
      `Repeticiones inválidas (${String(plan.repetitions)}): debe ser un entero ≥ 1.`,
    );
  }
}

function usageOrFail(
  validado: ValidatedOutput<unknown>,
  caso: BenchCase,
  candidato: Candidate,
): ProviderUsage {
  if (validado.usage !== undefined) return validado.usage;

  // Un error de proveedor **no se reporta como «faltan tokens»**: la causa real
  // es el error, y esconderla detrás de la consecuencia es exactamente lo que
  // P-II §8.4 prohíbe al hablar de truncamientos disfrazados de fallo de
  // esquema. El cuerpo entra en el mensaje porque sin él no se depura nada.
  if (validado.classification === 'provider_error') {
    throw new BenchRunError(
      `${candidato.candidateId} devolvió un error de proveedor en el caso ${caso.caseId}: ` +
        `${validado.envelope.rawOutput}`,
    );
  }

  throw new BenchRunError(
    `${candidato.candidateId} no reportó unidades facturadas en el caso ${caso.caseId} ` +
      `(clasificación ${validado.classification}). Sin tokens no hay costo, y seguir gastando ` +
      'sin poder tarifar es gastar a ciegas. No se asume cero: un cero fabricado haría parecer ' +
      'la corrida más barata de lo que fue.',
  );
}

/**
 * Ejecuta la corrida. Cada llamada pasa por el gate de presupuesto **antes** de
 * salir a la red, y el costo entra al ledger inmediatamente después, para que
 * la siguiente comprobación vea el gasto ya hecho.
 */
export async function runBenchmark(
  plan: RunPlan,
  partition: PartitionedCaseSet,
  candidates: readonly Candidate[],
  deps: RunDependencies,
): Promise<RunResult> {
  assertPlanFrozenBeforeStart(plan);

  if (plan.purpose !== partition.purpose) {
    throw new BenchRunError(
      `El plan es ${plan.purpose} y el conjunto ${partition.purpose}. Mezclarlos dejaría que ` +
        'un conjunto piloto alimentara una corrida material, o al revés.',
    );
  }
  if (candidates.length === 0) {
    throw new BenchRunError('Una corrida sin candidatos no mide nada.');
  }

  // Antes de la primera llamada, y por tanto antes del primer peso gastado.
  const autorizacion = assertRefreshAuthorizesBenchmark(deps.refreshRecord, deps.refreshWindow, {
    runId: plan.runId,
    startedAt: plan.startedAt,
    candidateIds: candidates.map((c) => c.candidateId),
    purpose: plan.purpose === 'material' ? 'material' : 'test_fixture',
  });

  deps.ledger.registerManifest(deps.manifest);

  const casos = [...partition.development, ...partition.evaluation];
  const outcomes: CaseOutcome[] = [];
  let totalCostMxn = 0;
  let secuencia = 0;

  for (const candidato of candidates) {
    for (const caso of casos) {
      for (let repeticion = 1; repeticion <= plan.repetitions; repeticion += 1) {
        // El freno, antes de la red. Lanza `BudgetBlockedError` si toca.
        deps.budget.assertBillableAllowed();

        let validado = await candidato.gateway.execute({
          operation: caso.operation,
          instructions: deps.instructions,
          input: caso.input,
          schema: deps.schema,
          codeFence: deps.codeFence,
          attempt: 1,
          ...(deps.parameters === undefined ? {} : { parameters: deps.parameters }),
        });
        let intentos = 1;
        let usage = usageOrFail(validado, caso, candidato);
        let costoDelCaso = registrar(deps, plan, candidato, usage, intentos, secuencia++);

        // El reintento único de P-III §6.2. Se vuelve a comprobar presupuesto:
        // el intento anterior ya gastó y pudo cruzar el umbral.
        if (validado.classification !== 'valid') {
          deps.budget.assertBillableAllowed();
          validado = await candidato.gateway.execute({
            operation: caso.operation,
            instructions: deps.instructions,
            input: caso.input,
            schema: deps.schema,
            codeFence: deps.codeFence,
            attempt: 2,
            ...(deps.parameters === undefined ? {} : { parameters: deps.parameters }),
          });
          intentos = 2;
          const usageReintento = usageOrFail(validado, caso, candidato);
          costoDelCaso += registrar(deps, plan, candidato, usageReintento, intentos, secuencia++);
          usage = sumarUso(usage, usageReintento);
        }

        totalCostMxn += costoDelCaso;
        outcomes.push({
          caseId: caso.caseId,
          candidateId: candidato.candidateId,
          repetition: repeticion,
          classification: validado.classification,
          attempts: intentos,
          usage,
          costMxn: costoDelCaso,
          ...(validado.classification === 'valid' ? { data: validado.data } : {}),
          rawOutput: validado.envelope.rawOutput,
        });
      }
    }
  }

  return {
    runId: plan.runId,
    purpose: plan.purpose,
    outcomes,
    totalCostMxn,
    costPerCaseMxn: outcomes.length === 0 ? 0 : totalCostMxn / outcomes.length,
    ageSecondsByCandidate: autorizacion.ageSecondsByCandidate,
  };
}

function sumarUso(a: ProviderUsage, b: ProviderUsage): ProviderUsage {
  const cache = (a.cachedInputTokens ?? 0) + (b.cachedInputTokens ?? 0);
  const base = {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
  };
  // Sólo se declara la caché si alguno de los dos la reportó: sumar dos
  // ausencias no produce un cero medido.
  return a.cachedInputTokens === undefined && b.cachedInputTokens === undefined
    ? base
    : { ...base, cachedInputTokens: cache };
}

function registrar(
  deps: RunDependencies,
  plan: RunPlan,
  candidato: Candidate,
  usage: ProviderUsage,
  attempt: number,
  secuencia: number,
): number {
  const precio = priceCall(deps.manifest, {
    provider: candidato.binding.provider,
    modelId: candidato.binding.modelId,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cachedInputTokens: usage.cachedInputTokens ?? 0,
    audioSeconds: 0,
    images: 0,
    requests: 0,
  });

  const evento: CostEvent = {
    costEventId: `${plan.runId}-${String(secuencia)}`,
    occurredAt: plan.startedAt,
    stage: 'benchmark',
    provider: candidato.binding.provider,
    bindingId: candidato.binding.bindingId,
    pricingManifestId: deps.manifest.pricingManifestId,
    tokensIn: usage.inputTokens,
    tokensOut: usage.outputTokens,
    tokensCached: usage.cachedInputTokens ?? 0,
    audioSeconds: 0,
    images: 0,
    attempts: attempt,
    retries: attempt - 1,
    failures: 0,
    costCalculated: precio.costCalculated,
    currency: precio.currency,
  };
  deps.ledger.append(evento);
  return precio.costCalculated;
}
