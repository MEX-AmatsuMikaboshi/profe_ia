import { AUTHORIZED_CALCULUS_VERSION, verify } from '@profesor-ia/logic-core';
import { CertificateRejectedError, SEARCH_ORDER_VERSION, search } from './search.js';
import type { SearchBudget, SearchMode, SearchOutcome, SearchRequest } from './types.js';

/**
 * Arnés BENCH-04 (Plan.md T-H2-16 [BENCHMARK] ← Maestro P-I §7.4 y anexo E.2).
 *
 * Compara en L0 el orden `prefiltro semántico → proof search` frente a
 * alternativas equivalentes. **Solo el arnés**: la corrida con el corpus real y
 * el congelamiento del orden ganador son de F6 (`T-H5-05`). Por eso el informe
 * no tiene campo «ganador» y `freezeWinningOrder()` falla cerrado.
 *
 * Lo que BENCH-04 mide es «desempeño **y seguridad**» (anexo E.2), en ese orden
 * de prioridad inverso: un orden más barato que cambie un veredicto no compite.
 * De ahí la regla dura del arnés: **cualquier hallazgo de seguridad vuelve el
 * informe no comparable**, y el desempeño deja de ser un argumento.
 *
 * La trampa que vigila explícitamente es la de P-I §7.4: la validez semántica
 * del prefiltro **no es** una prueba de derivabilidad. Una variante que emita
 * `proof_found` sin certificado re-verificado queda marcada, no medida.
 */

export const BENCH04_HARNESS_VERSION = 'bench04-harness-v1' as const;

/** Orden de referencia: el que hoy usa la autoría. */
export const BENCH04_REFERENCE_VARIANT_ID = 'prefilter_then_search' as const;

export interface PipelineVariant {
  readonly id: string;
  readonly description: string;
  /** Ejecuta el pipeline completo para un reactivo. */
  readonly run: (request: SearchRequest) => SearchOutcome;
}

/**
 * Alternativas **equivalentes en veredicto** que se comparan en L0. `off`
 * (buscar sin oráculo) no está aquí porque no es equivalente: sin oráculo, un
 * candidato semánticamente inválido solo puede reportarse como presupuesto
 * agotado. Se conserva en `search()` como variante medible por separado y como
 * control del propio arnés.
 */
export const BENCH04_VARIANTS: readonly PipelineVariant[] = Object.freeze([
  {
    id: BENCH04_REFERENCE_VARIANT_ID,
    description: 'Oráculo semántico antes de buscar (orden de referencia).',
    run: (request: SearchRequest) => search(request, { semanticOracle: 'prefilter' }),
  },
  {
    id: 'search_then_prefilter',
    description: 'Buscar primero; consultar al oráculo solo si no hubo prueba.',
    run: (request: SearchRequest) => search(request, { semanticOracle: 'postfilter' }),
  },
]);

export interface BenchCase {
  readonly id: string;
  readonly premises: readonly string[];
  readonly goal: string;
  readonly mode: SearchMode;
  readonly budget: SearchBudget;
  /** Qué ejercita el caso; se imprime en el informe para que la muestra sea auditable. */
  readonly exercises: string;
}

const L0_BUDGET: SearchBudget = Object.freeze({ maxWorkUnits: 20_000 });

/**
 * Muestra L0 fija y versionada. Cubre los cuatro estados de autoría y los dos
 * extremos de costo: el candidato inválido (donde el prefiltro debería ganar) y
 * el candidato demostrable (donde el prefiltro es trabajo añadido).
 *
 * No es el corpus de F6: es la muestra mínima con la que el arnés se prueba a
 * sí mismo. La corrida que decide el orden usa el paquete de contenido real.
 */
export const BENCH04_L0_CASES: readonly BenchCase[] = Object.freeze([
  {
    id: 'trivial-goal',
    premises: ['A∧B'],
    goal: 'A∧B',
    mode: 'heuristic',
    budget: L0_BUDGET,
    exercises: 'meta ya presente entre las premisas',
  },
  {
    id: 'forward-elimination',
    premises: ['A∧B'],
    goal: 'B',
    mode: 'heuristic',
    budget: L0_BUDGET,
    exercises: 'eliminación hacia adelante, costo mínimo',
  },
  {
    id: 'modus-ponens-chain',
    premises: ['A', 'A→B', 'B→C'],
    goal: 'C',
    mode: 'heuristic',
    budget: L0_BUDGET,
    exercises: 'encadenamiento de →E',
  },
  {
    id: 'conditional-subproof',
    premises: ['B'],
    goal: 'A→B',
    mode: 'heuristic',
    budget: L0_BUDGET,
    exercises: 'subprueba con descarga de supuesto',
  },
  {
    id: 'semantically-invalid',
    premises: ['A'],
    goal: 'B',
    mode: 'heuristic',
    budget: L0_BUDGET,
    exercises: 'candidato inválido: el prefiltro corta antes de buscar',
  },
  {
    id: 'invalid-with-structure',
    premises: ['A∨B'],
    goal: 'A∧B',
    mode: 'heuristic',
    budget: L0_BUDGET,
    exercises: 'inválido con estructura que invita a buscar',
  },
  {
    id: 'exhaustive-small-k',
    premises: ['A∧B'],
    goal: 'B∧A',
    mode: 'exhaustive_k',
    budget: { maxWorkUnits: 20_000, maxCost: 6 },
    exercises: 'modo exhaustivo hasta k con garantía de minimalidad',
  },
]);

export type SafetyCode =
  /** La variante emitió `proof_found` con un certificado que `logic-core` rechaza. */
  | 'UNVERIFIED_CERTIFICATE'
  /** La variante lanzó `CertificateRejectedError`: incidente nivel 3, no un resultado. */
  | 'CERTIFICATE_REJECTED'
  /** La variante contradice el veredicto del orden de referencia. */
  | 'STATUS_DISAGREEMENT'
  /** Afirmó minimalidad fuera de `exhaustive_k`, que es el único modo que puede certificarla. */
  | 'UNSUPPORTED_MINIMALITY_CLAIM'
  /** Usó el corte de pared para sostener una afirmación lógica (cobertura hasta k). */
  | 'WALL_TIMEOUT_AS_LOGICAL_CLAIM';

export interface SafetyFinding {
  readonly code: SafetyCode;
  readonly caseId: string;
  readonly variantId: string;
  readonly detail: string;
}

export interface VariantMeasurement {
  readonly caseId: string;
  readonly variantId: string;
  readonly status: SearchOutcome['status'] | 'threw';
  /** Corte primario: reproducible entre corridas y entre máquinas. */
  readonly workUnits: number;
  readonly costExplored: number;
  readonly wallTimeoutHit: boolean;
  /** Coste de la prueba hallada, si la hubo. */
  readonly proofCost?: number;
  /** `true` solo si `logic-core` volvió a aceptar el certificado en el arnés. */
  readonly certificateReverified?: boolean;
  readonly minimalityGuaranteed?: boolean;
  /**
   * Reloj de pared, solo si se pidió con `clock`. **No es comparable entre
   * máquinas** y no sostiene ninguna afirmación lógica; se registra aparte.
   */
  readonly wallClockMs?: number;
}

export interface VariantTotals {
  readonly variantId: string;
  readonly workUnits: number;
  readonly proofsFound: number;
  readonly semanticRejections: number;
  readonly safetyFindings: number;
}

export interface Bench04Report {
  readonly benchmarkId: 'BENCH-04';
  readonly harnessVersion: typeof BENCH04_HARNESS_VERSION;
  readonly searchOrderVersion: typeof SEARCH_ORDER_VERSION;
  readonly authorizedCalculusVersion: typeof AUTHORIZED_CALCULUS_VERSION;
  readonly referenceVariantId: string;
  readonly caseIds: readonly string[];
  readonly measurements: readonly VariantMeasurement[];
  readonly totals: readonly VariantTotals[];
  readonly safetyFindings: readonly SafetyFinding[];
  /**
   * `false` con cualquier hallazgo de seguridad: el desempeño de una variante
   * que cambia veredictos no se compara (anexo E.2, «desempeño **y seguridad**»).
   */
  readonly comparable: boolean;
  /** `true` si alguna medición usó reloj de pared, y por tanto el informe no es reproducible. */
  readonly wallClockMeasured: boolean;
}

export interface Bench04Options {
  readonly variants?: readonly PipelineVariant[];
  readonly cases?: readonly BenchCase[];
  readonly referenceVariantId?: string;
  /**
   * Reloj inyectado para medir pared. Por omisión **no se mide**: sin reloj el
   * informe es determinista y sirve como prueba de regresión.
   */
  readonly clock?: () => number;
}

/**
 * Ejecuta el arnés. No decide nada: mide, contrasta contra el orden de
 * referencia y reporta. El congelamiento del orden es de F6 (`T-H5-05`).
 */
export function runBench04(options: Bench04Options = {}): Bench04Report {
  const variants = options.variants ?? BENCH04_VARIANTS;
  const cases = options.cases ?? BENCH04_L0_CASES;
  const referenceVariantId = options.referenceVariantId ?? BENCH04_REFERENCE_VARIANT_ID;
  const clock = options.clock;

  const measurements: VariantMeasurement[] = [];
  const safetyFindings: SafetyFinding[] = [];

  for (const benchCase of cases) {
    const request: SearchRequest = {
      premises: benchCase.premises,
      goal: benchCase.goal,
      mode: benchCase.mode,
      budget: benchCase.budget,
    };

    const byVariant = new Map<string, SearchOutcome | null>();

    for (const variant of variants) {
      const startedAt = clock?.();
      let outcome: SearchOutcome | null = null;
      let threw: unknown;
      try {
        outcome = variant.run(request);
      } catch (err) {
        threw = err;
      }
      const wallClockMs = startedAt === undefined ? undefined : (clock as () => number)() - startedAt;
      byVariant.set(variant.id, outcome);

      if (outcome === null) {
        // Un certificado rechazado por el verificador es una inconsistencia
        // sistémica (P-I §13, nivel 3), no un resultado de búsqueda.
        safetyFindings.push({
          code: 'CERTIFICATE_REJECTED',
          caseId: benchCase.id,
          variantId: variant.id,
          detail:
            threw instanceof CertificateRejectedError
              ? threw.message
              : `la variante lanzó: ${String(threw)}`,
        });
        measurements.push({
          caseId: benchCase.id,
          variantId: variant.id,
          status: 'threw',
          workUnits: 0,
          costExplored: 0,
          wallTimeoutHit: false,
          ...(wallClockMs === undefined ? {} : { wallClockMs }),
        });
        continue;
      }

      measurements.push(
        measure(benchCase, variant.id, outcome, wallClockMs, safetyFindings),
      );
    }

    // Equivalencia: toda variante debe coincidir en veredicto con la referencia.
    const reference = byVariant.get(referenceVariantId);
    if (reference) {
      for (const variant of variants) {
        if (variant.id === referenceVariantId) continue;
        const other = byVariant.get(variant.id);
        if (other && other.status !== reference.status) {
          safetyFindings.push({
            code: 'STATUS_DISAGREEMENT',
            caseId: benchCase.id,
            variantId: variant.id,
            detail: `la referencia dice «${reference.status}» y esta variante «${other.status}»`,
          });
        }
      }
    }
  }

  return {
    benchmarkId: 'BENCH-04',
    harnessVersion: BENCH04_HARNESS_VERSION,
    searchOrderVersion: SEARCH_ORDER_VERSION,
    authorizedCalculusVersion: AUTHORIZED_CALCULUS_VERSION,
    referenceVariantId,
    caseIds: cases.map((c) => c.id),
    measurements,
    totals: totalsOf(variants, measurements, safetyFindings),
    safetyFindings,
    comparable: safetyFindings.length === 0,
    wallClockMeasured: clock !== undefined,
  };
}

function measure(
  benchCase: BenchCase,
  variantId: string,
  outcome: SearchOutcome,
  wallClockMs: number | undefined,
  safetyFindings: SafetyFinding[],
): VariantMeasurement {
  const base = {
    caseId: benchCase.id,
    variantId,
    status: outcome.status,
    workUnits: outcome.telemetry.workUnits,
    costExplored: outcome.telemetry.costExplored,
    wallTimeoutHit: outcome.telemetry.wallTimeoutHit,
    ...(wallClockMs === undefined ? {} : { wallClockMs }),
  };

  if (outcome.status === 'no_proof_with_cost_at_most_k' && outcome.telemetry.wallTimeoutHit) {
    safetyFindings.push({
      code: 'WALL_TIMEOUT_AS_LOGICAL_CLAIM',
      caseId: benchCase.id,
      variantId,
      detail:
        'la salvaguarda de pared cortó la búsqueda: la cobertura hasta k no está establecida (P-I §7.4)',
    });
  }

  if (outcome.status !== 'proof_found') return base;

  // Re-verificación independiente del arnés: la variante no se cree a sí misma.
  const verification = verify({ lines: outcome.proof.lines, goal: benchCase.goal });
  const certificateReverified = verification.valid && verification.goalReached === true;
  if (!certificateReverified) {
    safetyFindings.push({
      code: 'UNVERIFIED_CERTIFICATE',
      caseId: benchCase.id,
      variantId,
      detail:
        `«proof_found» sin certificado aceptado por logic-core: ` +
        `${verification.errors.map((e) => e.code).join(', ') || 'la meta no es la derivada'}`,
    });
  }

  if (outcome.minimalCostVerified && benchCase.mode !== 'exhaustive_k') {
    safetyFindings.push({
      code: 'UNSUPPORTED_MINIMALITY_CLAIM',
      caseId: benchCase.id,
      variantId,
      detail: 'solo `exhaustive_k` que cubrió todo coste menor puede certificar minimalidad',
    });
  }

  return {
    ...base,
    proofCost: outcome.proof.cost,
    certificateReverified,
    minimalityGuaranteed: outcome.minimalCostVerified,
  };
}

function totalsOf(
  variants: readonly PipelineVariant[],
  measurements: readonly VariantMeasurement[],
  safetyFindings: readonly SafetyFinding[],
): readonly VariantTotals[] {
  return variants.map((variant) => {
    const own = measurements.filter((m) => m.variantId === variant.id);
    return {
      variantId: variant.id,
      workUnits: own.reduce((sum, m) => sum + m.workUnits, 0),
      proofsFound: own.filter((m) => m.status === 'proof_found').length,
      semanticRejections: own.filter((m) => m.status === 'semantically_invalid').length,
      safetyFindings: safetyFindings.filter((f) => f.variantId === variant.id).length,
    };
  });
}

/**
 * Se pidió una decisión que depende de una medición todavía no ejecutada.
 * Falla cerrado, igual que las calibraciones abiertas.
 */
export class BenchmarkPendingError extends Error {
  constructor(
    readonly benchmarkId: string,
    readonly closesIn: string,
    detail: string,
  ) {
    super(`PENDING_BENCHMARK: ${benchmarkId} (${detail}). Se ejecuta y congela en: ${closesIn}.`);
    this.name = 'BenchmarkPendingError';
  }
}

/**
 * Orden ganador del pipeline de autoría. **No se decide aquí**: la corrida con
 * el corpus real y el congelamiento por versión son de F6 (`T-H5-05`). Este
 * arnés produce la evidencia; declarar un ganador desde una muestra L0 sería
 * exactamente la «ley universal sin medición» que P-I §7.4 prohíbe.
 */
export function freezeWinningOrder(report: Bench04Report): never {
  throw new BenchmarkPendingError(
    'BENCH-04',
    'F6 / T-H5-05',
    `el arnés mide (${report.harnessVersion}, ${report.caseIds.length} casos L0); ` +
      'el orden ganador se congela por versión con el corpus real',
  );
}
