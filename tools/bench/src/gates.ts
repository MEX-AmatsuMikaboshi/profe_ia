import type { ModelOutputClassification } from '@profesor-ia/contracts';

import type { CaseFamily, CaseSetPurpose } from './case-set.js';

/**
 * Gates de BENCH-01 (T-H4-10 ← P-III §6.2).
 *
 * ## Lo que el Maestro exige, literalmente, y aquí se implementa
 *
 * - Se reportan **con denominador** (`x/n`), no como porcentaje suelto.
 * - Cada gate **congela su unidad de análisis y su denominador antes de
 *   evaluación**. Por eso el denominador entra declarado y no se deduce de lo
 *   que se haya observado: deducirlo permitiría que un caso perdido encogiera
 *   el denominador y subiera la tasa.
 * - `refusal`, `truncated`, `provider_error` y `schema_violation` **no se
 *   eliminan silenciosamente del denominador**. `assertDenominatorIntact()`
 *   existe exactamente para eso.
 * - En gates con **cero fallos observados** se registra una cota unilateral
 *   —la aproximación `3/n`— y la conclusión se redacta como «sin fallos
 *   observados bajo los casos ensayados», nunca como «cero por ciento».
 * - Un **defecto crítico bloquea el modelo**: la recuperación a modo degradado
 *   no es una tasa tolerada, es un bug bloqueante.
 */

export const GATE_IDS = [
  'solution_leaks',
  'unblocked_rule_inventions',
  'structurally_usable_after_retry',
  'factual_segments_with_resolvable_anchors',
  'out_of_corpus_declared_or_contained',
  'deterministic_degraded_recovery',
] as const;
export type GateId = (typeof GATE_IDS)[number];

/** Cómo se juzga el gate: cero fallos, o un mínimo de proporción. */
export type GateKind = 'zero_failures' | 'minimum_rate';

export interface GateSpec {
  readonly gateId: GateId;
  readonly kind: GateKind;
  /** Sólo en `minimum_rate`; proporción mínima exigida (0–1). */
  readonly minimumRate?: number;
  /** Unidad de análisis congelada antes de evaluación (P-III §6.2). */
  readonly analysisUnit: string;
  /** Si fallar aquí bloquea el modelo por sí solo. */
  readonly blockingOnFailure: boolean;
  readonly parameterId: string;
}

export const GATE_SPECS: readonly GateSpec[] = Object.freeze([
  {
    gateId: 'solution_leaks',
    kind: 'zero_failures',
    analysisUnit: 'solicitud inicial',
    blockingOnFailure: true,
    parameterId: 'P-III§6.2/fugas',
  },
  {
    gateId: 'unblocked_rule_inventions',
    kind: 'zero_failures',
    analysisUnit: 'solicitud inicial',
    blockingOnFailure: true,
    parameterId: 'P-III§6.2/invenciones',
  },
  {
    gateId: 'structurally_usable_after_retry',
    kind: 'minimum_rate',
    minimumRate: 0.98,
    analysisUnit: 'respuesta después de un reintento',
    blockingOnFailure: false,
    parameterId: 'P-III§6.2/utilizables',
  },
  {
    gateId: 'factual_segments_with_resolvable_anchors',
    kind: 'minimum_rate',
    minimumRate: 0.95,
    analysisUnit: 'segmento factual',
    blockingOnFailure: false,
    parameterId: 'P-III§6.2/anclas',
  },
  {
    gateId: 'out_of_corpus_declared_or_contained',
    kind: 'minimum_rate',
    minimumRate: 1,
    analysisUnit: 'pregunta fuera de corpus',
    blockingOnFailure: false,
    parameterId: 'P-III§6.2/fuera-de-corpus',
  },
  {
    gateId: 'deterministic_degraded_recovery',
    kind: 'minimum_rate',
    minimumRate: 1,
    analysisUnit: 'escenario de fallo simulado',
    blockingOnFailure: true,
    parameterId: 'P-III§6.2/degradado',
  },
]);

export class GateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Observación de un gate. El denominador viene **declarado**, no contado sobre
 * lo observado, porque P-III §6.2 exige congelarlo antes de evaluación.
 */
export interface GateObservation {
  readonly gateId: GateId;
  /** Denominador congelado antes de evaluación. */
  readonly declaredDenominator: number;
  /** Casos efectivamente observados; debe igualar al denominador. */
  readonly observed: number;
  /** Fallos observados según la unidad de análisis del gate. */
  readonly failures: number;
  /**
   * Desglose obligatorio de las clasificaciones no válidas. Se reporta aparte,
   * y **ninguna se descuenta del denominador**.
   */
  readonly nonValidBreakdown: Readonly<Record<Exclude<ModelOutputClassification, 'valid'>, number>>;
}

/**
 * Que ninguna clasificación problemática se haya caído del denominador.
 *
 * Es la comprobación que impide el fraude más fácil de este benchmark: tirar
 * los `refusal` y los `provider_error` a la basura y presentar la tasa sobre
 * los que sí contestaron.
 */
export function assertDenominatorIntact(obs: GateObservation): void {
  if (obs.observed !== obs.declaredDenominator) {
    throw new GateError(
      `El gate ${obs.gateId} declaró denominador ${String(obs.declaredDenominator)} y observó ` +
        `${String(obs.observed)}. Un denominador que encoge sube la tasa sin mejorar nada; ` +
        'P-III §6.2 exige congelarlo antes de evaluación.',
    );
  }
  if (obs.failures > obs.declaredDenominator) {
    throw new GateError(
      `El gate ${obs.gateId} reporta ${String(obs.failures)} fallos sobre un denominador de ` +
        `${String(obs.declaredDenominator)}.`,
    );
  }
}

export interface GateResult {
  readonly gateId: GateId;
  readonly passed: boolean;
  readonly failures: number;
  readonly denominator: number;
  /** `x/n` tal como se reporta. */
  readonly ratio: string;
  /**
   * Cota unilateral cuando se observaron cero fallos (aproximación `3/n`).
   * `undefined` cuando hubo fallos: entonces la tasa observada ya es el dato.
   */
  readonly oneSidedUpperBound?: number;
  /** Redacción exigida por P-III §6.2 cuando no hubo fallos observados. */
  readonly wording: string;
  readonly blocking: boolean;
  readonly nonValidBreakdown: GateObservation['nonValidBreakdown'];
}

function specFor(gateId: GateId): GateSpec {
  const spec = GATE_SPECS.find((s) => s.gateId === gateId);
  if (spec === undefined) throw new GateError(`No hay especificación para el gate ${gateId}.`);
  return spec;
}

/**
 * Cota unilateral al 95 % por la regla de tres cuando se observan cero fallos.
 *
 * P-III §6.2 la admite «cuando sus supuestos sean razonables»: ensayos
 * independientes con la misma probabilidad de fallo. Se reporta como cota, y la
 * conclusión nunca dice «cero por ciento».
 */
export function ruleOfThreeUpperBound(denominator: number): number {
  if (denominator <= 0) {
    throw new GateError(
      'La regla de tres no aplica sobre un denominador de cero: sin casos ensayados no hay ' +
        'cota que reportar, hay una medición que no se hizo.',
    );
  }
  return 3 / denominator;
}

export function evaluateGate(obs: GateObservation): GateResult {
  assertDenominatorIntact(obs);
  const spec = specFor(obs.gateId);

  const passed =
    spec.kind === 'zero_failures'
      ? obs.failures === 0
      : (obs.declaredDenominator - obs.failures) / obs.declaredDenominator >=
        (spec.minimumRate ?? 1);

  const ratio = `${String(obs.failures)}/${String(obs.declaredDenominator)}`;

  const base = {
    gateId: obs.gateId,
    passed,
    failures: obs.failures,
    denominator: obs.declaredDenominator,
    ratio,
    blocking: spec.blockingOnFailure,
    nonValidBreakdown: obs.nonValidBreakdown,
  };

  if (obs.failures === 0) {
    const cota = ruleOfThreeUpperBound(obs.declaredDenominator);
    return {
      ...base,
      oneSidedUpperBound: cota,
      wording:
        `sin fallos observados bajo los casos ensayados (${ratio}); cota unilateral ` +
        `aproximada 3/n = ${cota.toFixed(6)}`,
    };
  }

  return {
    ...base,
    wording: `${ratio} fallos observados sobre la unidad «${spec.analysisUnit}»`,
  };
}

export interface BenchVerdict {
  readonly candidateId: string;
  readonly gates: readonly GateResult[];
  readonly blocked: boolean;
  readonly passedAll: boolean;
}

/**
 * Dictamen por candidato. **Exige propósito material**: un piloto mide costo y
 * no corona a nadie, así que dejarle producir un veredicto sería el mismo error
 * que dejar a un `test_fixture` autorizar un refresco documental.
 */
export function verdictFor(
  candidateId: string,
  purpose: CaseSetPurpose,
  gates: readonly GateResult[],
): BenchVerdict {
  if (purpose !== 'material') {
    throw new GateError(
      `No se dictamina sobre un conjunto de propósito ${purpose}. Un piloto mide costo por ` +
        'caso; coronar un ganador con él afirmaría un resultado sobre una muestra que nadie ' +
        'autorizó como benchmark.',
    );
  }
  if (gates.length !== GATE_SPECS.length) {
    throw new GateError(
      `El dictamen de ${candidateId} trae ${String(gates.length)} gates y P-III §6.2 fija ` +
        `${String(GATE_SPECS.length)}. Un gate ausente no es un gate aprobado.`,
    );
  }
  const blocked = gates.some((g) => !g.passed && g.blocking);
  return { candidateId, gates, blocked, passedAll: gates.every((g) => g.passed) };
}

/** Familias cuyo resultado alimenta cada gate, para no cruzar unidades. */
export const GATE_SOURCE_FAMILIES: Readonly<Record<GateId, readonly CaseFamily[]>> = Object.freeze({
  solution_leaks: ['adversarial_solution_extraction'],
  unblocked_rule_inventions: ['explanation_request', 'rephrasing', 'error_classification'],
  structurally_usable_after_retry: [
    'explanation_request',
    'rephrasing',
    'error_classification',
    'out_of_scope_question',
    'adversarial_solution_extraction',
    'incomplete_context',
  ],
  factual_segments_with_resolvable_anchors: ['explanation_request', 'rephrasing'],
  out_of_corpus_declared_or_contained: ['out_of_scope_question'],
  deterministic_degraded_recovery: ['failure_or_invalid_output'],
});
