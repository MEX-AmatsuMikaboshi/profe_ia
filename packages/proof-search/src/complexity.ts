import {
  AUTHORIZED_CALCULUS_VERSION,
  RULE_ARITY,
  VERIFIER_VERSION,
  canonicalRuleId,
  isBinary,
  parse,
  print,
  verify,
  type Formula,
  type RuleId,
} from '@profesor-ia/logic-core';
import type { FoundProof, SearchOutcome, SearchTelemetry } from './types.js';

/**
 * Índice de complejidad estructural (Plan.md T-H2-14 [REQUIRED] ← Maestro
 * P-I §7.6).
 *
 * Tres fronteras que el Maestro fija y este módulo respeta:
 *
 *  1. Las medidas se calculan **sobre soluciones realmente encontradas dentro
 *     del presupuesto**, nunca sobre un candidato sin certificado. Por eso la
 *     entrada es un `proof_found` y se re-verifica con `logic-core` antes de
 *     medir nada.
 *  2. El coste/nodos explorados **no es el total de caminos posibles**. Las
 *     medidas se devuelven en dos grupos separados: `structural` depende solo
 *     de la solución y del enunciado; `searchRelative` depende del presupuesto
 *     y de la estrategia, y no admite lectura absoluta.
 *  3. Los **pesos y el criterio de comparabilidad** son `[CALIBRATION CAL-09]`
 *     y se congelan en H5 (`T-H5-10`), antes de seleccionar los conjuntos y
 *     antes de H6. Hasta entonces no existe un escalar: `complexityIndex()`
 *     falla cerrado en vez de agregar con pesos inventados (§0.2.5).
 *
 * El módulo vive en `proof-search` y no en `logic-core` porque consume
 * telemetría de búsqueda (presupuesto, garantía de minimalidad, diversidad),
 * que solo existe en la ruta de autoría. La ruta de verificación no lo importa.
 */

/** Versión del perfil de medidas; entra en la traza y en el freeze. */
export const COMPLEXITY_PROFILE_VERSION = 'structural-complexity-v1' as const;

/**
 * Reglas que descargan supuestos: exactamente las que citan al menos una
 * subprueba. Se derivan de `RULE_ARITY` en vez de repetirse a mano, para que
 * una regla nueva del cálculo no deje la lista desactualizada en silencio.
 */
export const DISCHARGE_RULES: readonly RuleId[] = Object.freeze(
  (Object.entries(RULE_ARITY) as readonly [RuleId, { lines: number; subproofs: number }][])
    .filter(([, arity]) => arity.subproofs > 0)
    .map(([ruleId]) => ruleId)
    .sort(),
);

/**
 * Estrategia indirecta: `IP` es la prueba indirecta del cálculo autorizado
 * («prueba indirecta (RAA clásica)» en el lexicón, P-II §4.1.1). `¬I` descarga
 * un supuesto pero no es prueba indirecta, así que cuenta en `DISCHARGE_RULES`
 * y no aquí.
 */
export const INDIRECT_RULES: readonly RuleId[] = Object.freeze(['IP']);

/**
 * Se pidió medir una solución que `logic-core` no acepta. No es un resultado de
 * medición: medir un artefacto sin certificado sería atribuir complejidad a algo
 * que no es una prueba (P-I §7.6, «sobre soluciones realmente encontradas»).
 */
export class UnverifiedSolutionError extends Error {
  constructor(
    readonly goal: string,
    readonly verificationCodes: readonly string[],
  ) {
    super(
      `no se calcula complejidad sobre una solución no verificada para «${goal}»: ` +
        `${verificationCodes.join(', ') || 'sin códigos'}`,
    );
    this.name = 'UnverifiedSolutionError';
  }
}

/**
 * Se pidió un valor que depende de una calibración todavía abierta. Falla
 * cerrado igual que `pendingCatalog()`: el sistema no avanza apoyado en pesos
 * fabricados, y la deuda queda visible.
 */
export class CalibrationPendingError extends Error {
  constructor(
    readonly calibrationId: string,
    readonly closesIn: string,
    detail: string,
  ) {
    super(`PENDING_CALIBRATION: ${calibrationId} (${detail}). Se congela en: ${closesIn}.`);
    this.name = 'CalibrationPendingError';
  }
}

/**
 * Medidas que dependen solo del enunciado y de la solución encontrada. Dos
 * corridas con presupuestos distintos que hallen la misma prueba coinciden aquí.
 */
export interface StructuralMeasures {
  /** Longitud de la mejor prueba encontrada: líneas derivadas (`proof_line_count`). */
  readonly proofLength: number;
  /** Líneas totales, premisas y supuestos incluidos. */
  readonly totalLineCount: number;
  /** Número de premisas del enunciado. */
  readonly premiseCount: number;
  /** Reglas distintas efectivamente usadas, en ids canónicos y orden estable. */
  readonly rulesUsed: readonly RuleId[];
  readonly distinctRuleCount: number;
  readonly subproofCount: number;
  /** Profundidad máxima de anidamiento (0 = sin subpruebas). */
  readonly maxSubproofDepth: number;
  /** Conectivos del enunciado (premisas + meta). `⊥` es átomo, no conectivo. */
  readonly connectivesInStatement: number;
  /** Conectivos de todas las líneas de la solución. */
  readonly connectivesInProof: number;
  /** ¿La solución necesitó descargar algún supuesto? */
  readonly requiresAssumptionDischarge: boolean;
  readonly dischargeRulesUsed: readonly RuleId[];
  /** ¿Usó prueba indirecta (`IP`)? */
  readonly usesIndirectStrategy: boolean;
  /**
   * Distancia estructural entre premisas y conclusión: diferencia simétrica de
   * los multiconjuntos de subfórmulas (D-10). 0 cuando la meta ya está entre las
   * premisas y no sobra nada.
   */
  readonly structuralDistance: number;
}

/**
 * Medidas relativas al presupuesto y a la estrategia. **Ninguna es absoluta**:
 * `costExplored` y `workUnitsSpent` describen lo que esta corrida exploró, no el
 * espacio de búsqueda; `distinctStrategiesFoundWithinBudget` cuenta lo hallado
 * dentro del presupuesto y **no** el total de caminos posibles (P-I §7.6).
 */
export interface SearchRelativeMeasures {
  /** `true` solo si `exhaustive_k` cubrió todos los costes menores. */
  readonly minimalityGuaranteed: boolean;
  /** Alcance exacto de esa garantía; nunca minimalidad global. */
  readonly minimalityScope: 'none' | 'exhaustive_below_found_cost';
  readonly workUnitsSpent: number;
  readonly costExplored: number;
  readonly mode: SearchTelemetry['mode'];
  readonly searchOrderVersion: string;
  /** Si se disparó la salvaguarda de pared, la corrida no es comparable sin nota. */
  readonly wallTimeoutHit: boolean;
  /** Estrategias distintas halladas dentro del presupuesto (esqueleto profundidad+regla). */
  readonly distinctStrategiesFoundWithinBudget: number;
  /**
   * Recordatorio ejecutable de la prohibición de P-I §7.6: estas cifras son
   * relativas al presupuesto, no el total de caminos posibles.
   */
  readonly interpretation: 'budget_relative_not_total_paths';
}

export interface StructuralComplexityProfile {
  readonly structural: StructuralMeasures;
  readonly searchRelative: SearchRelativeMeasures;
  readonly authorizedCalculusVersion: typeof AUTHORIZED_CALCULUS_VERSION;
  readonly verifierVersion: typeof VERIFIER_VERSION;
  readonly profileVersion: typeof COMPLEXITY_PROFILE_VERSION;
}

export interface ComplexityInput {
  readonly premises: readonly string[];
  readonly goal: string;
  /** Resultado de búsqueda con certificado: solo `proof_found` es medible. */
  readonly outcome: Extract<SearchOutcome, { status: 'proof_found' }>;
  /**
   * Otras soluciones halladas para el mismo reactivo dentro del mismo
   * presupuesto, si el pipeline las conservó. Su único uso es la diversidad de
   * estrategias; no se mide complejidad sobre ellas.
   */
  readonly alternativeSolutions?: readonly FoundProof[];
}

/**
 * Perfil de complejidad estructural de una solución encontrada.
 *
 * Re-verifica el certificado con `logic-core` antes de medir: sin veredicto
 * `valid` + `goalReached`, lanza `UnverifiedSolutionError` en vez de devolver
 * un perfil (nada de degradación silenciosa).
 */
export function structuralComplexity(input: ComplexityInput): StructuralComplexityProfile {
  const { proof, telemetry, minimalCostVerified } = input.outcome;

  const verification = verify({ lines: proof.lines, goal: input.goal });
  if (!verification.valid || verification.goalReached !== true) {
    throw new UnverifiedSolutionError(
      input.goal,
      verification.errors.map((e) => e.code),
    );
  }

  const premises = input.premises.map(parse);
  const goal = parse(input.goal);

  const rulesUsed = canonicalRulesOf(proof);
  const dischargeRulesUsed = rulesUsed.filter((r) => DISCHARGE_RULES.includes(r));

  const structural: StructuralMeasures = {
    proofLength: proof.cost,
    totalLineCount: proof.lines.length,
    premiseCount: premises.length,
    rulesUsed,
    distinctRuleCount: rulesUsed.length,
    subproofCount: proof.lines.filter((l) => l.rule === 'AS').length,
    maxSubproofDepth: proof.lines.reduce((max, l) => Math.max(max, l.depth), 0),
    connectivesInStatement:
      premises.reduce((sum, f) => sum + countConnectives(f), 0) + countConnectives(goal),
    connectivesInProof: proof.lines.reduce((sum, l) => sum + countConnectives(parse(l.formula)), 0),
    requiresAssumptionDischarge: dischargeRulesUsed.length > 0,
    dischargeRulesUsed,
    usesIndirectStrategy: rulesUsed.some((r) => INDIRECT_RULES.includes(r)),
    structuralDistance: structuralDistance(premises, goal),
  };

  const strategies = new Set<string>([
    strategySignature(proof),
    ...(input.alternativeSolutions ?? []).map(strategySignature),
  ]);

  const searchRelative: SearchRelativeMeasures = {
    minimalityGuaranteed: minimalCostVerified,
    minimalityScope: minimalCostVerified ? 'exhaustive_below_found_cost' : 'none',
    workUnitsSpent: telemetry.workUnits,
    costExplored: telemetry.costExplored,
    mode: telemetry.mode,
    searchOrderVersion: telemetry.searchOrderVersion,
    wallTimeoutHit: telemetry.wallTimeoutHit,
    distinctStrategiesFoundWithinBudget: strategies.size,
    interpretation: 'budget_relative_not_total_paths',
  };

  return {
    structural,
    searchRelative,
    authorizedCalculusVersion: AUTHORIZED_CALCULUS_VERSION,
    verifierVersion: VERIFIER_VERSION,
    profileVersion: COMPLEXITY_PROFILE_VERSION,
  };
}

/**
 * Escalar del índice de complejidad. **No existe todavía**: los pesos son
 * `[CALIBRATION CAL-09]` y se fijan en H5 (`T-H5-10`) con corpus, soluciones
 * verificadas y pruebas sintéticas, antes de seleccionar/congelar conjuntos y
 * antes de H6.
 *
 * Firma `never` a propósito: mientras la calibración esté abierta, la única
 * respuesta correcta es el fallo. Cuando H5 congele los pesos, esta función
 * devolverá un número y la firma dejará de ser `never`.
 */
export function complexityIndex(profile: StructuralComplexityProfile): never {
  throw new CalibrationPendingError(
    'CAL-09',
    'H5 / T-H5-10',
    `los pesos del índice de complejidad no están congelados para ${profile.profileVersion}; ` +
      'agregar con pesos inventados violaría §0.2.5',
  );
}

/**
 * Criterio de comparabilidad entre dos perfiles. También `[CALIBRATION CAL-09]`.
 *
 * Aparte de la calibración pendiente, P-I §7.6 prohíbe una conclusión concreta:
 * **coincidir en el índice no hace psicométricamente equivalentes a dos
 * reactivos**. Latencia, error, pistas y correcciones pueden validar el orden de
 * dificultad en H10, solo para una versión futura, y nunca reordenan un paquete
 * congelado. Por eso no hay ni habrá un `equals` de perfiles.
 */
export function assertComparable(
  a: StructuralComplexityProfile,
  b: StructuralComplexityProfile,
): never {
  throw new CalibrationPendingError(
    'CAL-09',
    'H5 / T-H5-10',
    `el criterio de comparabilidad no está congelado (${a.profileVersion} vs ${b.profileVersion}); ` +
      'además, índices iguales no implican equivalencia psicométrica (P-I §7.6)',
  );
}

/** Ids canónicos de las reglas de la solución, sin `PR`/`AS`, ordenados y sin repetir. */
function canonicalRulesOf(proof: FoundProof): readonly RuleId[] {
  const ids = new Set<RuleId>();
  for (const line of proof.lines) {
    if (line.rule === 'PR' || line.rule === 'AS') continue;
    const resolution = canonicalRuleId(line.rule);
    // La solución ya pasó la re-verificación, así que toda regla resuelve; el
    // guardia evita que un cambio futuro la mida con un alias sin canonicalizar.
    if (resolution.ok) ids.add(resolution.ruleId);
  }
  return [...ids].sort();
}

/** `⊥` es un átomo distinguido: no suma conectivo. */
function countConnectives(f: Formula): number {
  switch (f.kind) {
    case 'atom':
    case 'falsum':
      return 0;
    case 'not':
      return 1 + countConnectives(f.sub);
    default:
      return 1 + countConnectives(f.left) + countConnectives(f.right);
  }
}

/** Multiconjunto de subfórmulas, en impresión canónica (la fórmula se incluye a sí misma). */
function subformulas(f: Formula, acc: string[] = []): string[] {
  acc.push(print(f));
  if (f.kind === 'not') subformulas(f.sub, acc);
  else if (isBinary(f)) {
    subformulas(f.left, acc);
    subformulas(f.right, acc);
  }
  return acc;
}

/**
 * Distancia estructural premisas↔conclusión (D-10, definición de ingeniería):
 * ocurrencias de subfórmula de la meta ausentes de las premisas, más
 * ocurrencias de subfórmula de las premisas ausentes de la meta. Determinista,
 * simétrica y 0 cuando ambos lados coinciden estructuralmente. Su peso relativo
 * dentro del índice es `[CALIBRATION CAL-09]`.
 */
function structuralDistance(premises: readonly Formula[], goal: Formula): number {
  const premiseSubs = premises.flatMap((p) => subformulas(p));
  const goalSubs = subformulas(goal);
  const premiseSet = new Set(premiseSubs);
  const goalSet = new Set(goalSubs);
  return (
    goalSubs.filter((s) => !premiseSet.has(s)).length +
    premiseSubs.filter((s) => !goalSet.has(s)).length
  );
}

/**
 * Esqueleto de estrategia: secuencia de `profundidad:regla`, sin fórmulas. Dos
 * soluciones con el mismo esqueleto usaron la misma estrategia aunque cambien
 * los átomos. No sustituye al canonicalizador de isomorfismo (T-H2-09), que
 * decide duplicados con otra firma y en otro paquete.
 */
function strategySignature(proof: FoundProof): string {
  return proof.lines.map((l) => `${l.depth}:${l.rule}`).join('|');
}
