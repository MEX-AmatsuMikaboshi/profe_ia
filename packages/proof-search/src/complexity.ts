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
import { createHash } from 'node:crypto';
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
 *     antes de H6. `complexityIndex()` exige el manifiesto congelado y falla
 *     cerrado si falta o no corresponde a las versiones medidas.
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

export const COMPLEXITY_TIERS = ['baja', 'media', 'alta'] as const;
export type ComplexityTier = (typeof COMPLEXITY_TIERS)[number];

export const COMPLEXITY_FEATURES = [
  'proofLength',
  'distinctRuleCount',
  'subproofCount',
  'maxSubproofDepth',
  'premiseCount',
  'connectivesInStatement',
  'requiresAssumptionDischarge',
  'usesIndirectStrategy',
  'structuralDistance',
  'workUnitsLog2',
  'costExplored',
  'distinctStrategiesFoundWithinBudget',
] as const;
export type ComplexityFeature = (typeof COMPLEXITY_FEATURES)[number];

export interface ComplexityCalibrationSample {
  readonly caseId: string;
  readonly tier: ComplexityTier;
  readonly dataOrigin: 'verified_solution' | 'synthetic_verified_solution' | 'generated_package';
  readonly profile: StructuralComplexityProfile;
}

export interface CalibratedFeature {
  readonly min: number;
  readonly max: number;
  /** Peso entero derivado de concordancia ordinal; 0 = sin señal en la muestra. */
  readonly weight: number;
}

/**
 * Versiones de CAL-09 que existen. **Conjunto cerrado**: una versión desconocida
 * se rechaza en `assertCalibrationApplies()` en vez de aceptarse por ser una
 * cadena. `cal-09-v1` se conserva porque los reactivos medidos bajo ella lo
 * fueron con sus bandas; **las dos escalas no son comparables** (D-66).
 */
export const CAL09_VERSIONS = ['cal-09-v1', 'cal-09-v2'] as const;
export type Cal09Version = (typeof CAL09_VERSIONS)[number];

export interface ComplexityCalibrationManifest {
  readonly calibrationId: 'CAL-09';
  readonly version: Cal09Version;
  readonly status: 'frozen';
  readonly frozenAt: string;
  readonly dataPolicy: 'no_participant_data';
  readonly method: 'pairwise_ordinal_concordance_v1';
  readonly profileVersion: typeof COMPLEXITY_PROFILE_VERSION;
  readonly authorizedCalculusVersion: typeof AUTHORIZED_CALCULUS_VERSION;
  readonly verifierVersion: typeof VERIFIER_VERSION;
  readonly searchMode: SearchTelemetry['mode'];
  readonly searchOrderVersion: string;
  readonly features: Readonly<Record<ComplexityFeature, CalibratedFeature>>;
  readonly tierBands: Readonly<Record<ComplexityTier, Readonly<{ min: number; max: number }>>>;
  /** Mitad de la menor separación entre medianas de estratos adyacentes. */
  readonly comparabilityMaxDifference: number;
  readonly sampleIds: readonly string[];
  readonly sampleHash: string;
}

export interface ComplexityComparison {
  readonly comparable: boolean;
  readonly indexA: number;
  readonly indexB: number;
  readonly difference: number;
  readonly maxDifference: number;
  readonly interpretation: 'structurally_comparable_not_psychometrically_equivalent';
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
 * Escalar del índice de complejidad. CAL-09 se congeló en H5 con soluciones
 * verificadas sintéticas y sin datos de participante. El manifiesto entra como
 * dato explícito; omitirlo sigue fallando cerrado para que otro flujo no use
 * pesos implícitos o de otra versión.
 */
export function complexityIndex(
  profile: StructuralComplexityProfile,
  calibration?: ComplexityCalibrationManifest,
): number {
  if (calibration === undefined) {
    throw new CalibrationPendingError(
      'CAL-09',
      'H5 / T-H5-10',
      `no se proporcionó un manifiesto congelado para ${profile.profileVersion}; ` +
        'agregar con pesos inventados violaría §0.2.5',
    );
  }
  assertCalibrationApplies(profile, calibration);
  const vector = complexityFeatureVector(profile);
  const totalWeight = COMPLEXITY_FEATURES.reduce(
    (sum, feature) => sum + calibration.features[feature].weight,
    0,
  );
  if (totalWeight <= 0) {
    throw new CalibrationPendingError('CAL-09', 'H5 / T-H5-10', 'el manifiesto no tiene peso positivo');
  }
  const score = COMPLEXITY_FEATURES.reduce((sum, feature) => {
    const configured = calibration.features[feature];
    const range = configured.max - configured.min;
    const normalized =
      range === 0 ? 0 : Math.max(0, Math.min(1, (vector[feature] - configured.min) / range));
    return sum + normalized * configured.weight;
  }, 0);
  return round6((score / totalWeight) * 100);
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
  calibration?: ComplexityCalibrationManifest,
): ComplexityComparison {
  if (calibration === undefined) {
    throw new CalibrationPendingError(
      'CAL-09',
      'H5 / T-H5-10',
      `el criterio de comparabilidad no está congelado (${a.profileVersion} vs ${b.profileVersion}); ` +
        'además, índices iguales no implican equivalencia psicométrica (P-I §7.6)',
    );
  }
  const indexA = complexityIndex(a, calibration);
  const indexB = complexityIndex(b, calibration);
  const difference = round6(Math.abs(indexA - indexB));
  return Object.freeze({
    comparable: difference <= calibration.comparabilityMaxDifference,
    indexA,
    indexB,
    difference,
    maxDifference: calibration.comparabilityMaxDifference,
    interpretation: 'structurally_comparable_not_psychometrically_equivalent',
  });
}

/**
 * Congela CAL-09 a partir de estratos declarados **antes** de calcular los
 * pesos. Cada peso es la concordancia neta de esa medida con todos los pares
 * ordenados baja<media<alta; la parte negativa se trunca en cero. No hay pesos
 * elegidos a mano y cada cero queda visible en el manifiesto.
 */
export function calibrateComplexity(
  samples: readonly ComplexityCalibrationSample[],
  frozenAt: string,
  /**
   * Versión que se congela. **Obligatoria y sin valor por omisión**: una
   * calibración nueva que heredara en silencio la versión anterior se
   * confundiría con ella, y las escalas de dos versiones **no** son
   * directamente comparables (D-66).
   */
  version: Cal09Version,
): ComplexityCalibrationManifest {
  assertCalibrationSample(samples);
  const vectors = samples.map((sample) => ({ sample, vector: complexityFeatureVector(sample.profile) }));
  const features = Object.fromEntries(
    COMPLEXITY_FEATURES.map((feature) => {
      const values = vectors.map(({ vector }) => vector[feature]);
      let signal = 0;
      for (const lower of vectors) {
        for (const higher of vectors) {
          if (tierRank(lower.sample.tier) >= tierRank(higher.sample.tier)) continue;
          signal += Math.sign(higher.vector[feature] - lower.vector[feature]);
        }
      }
      return [
        feature,
        Object.freeze({ min: Math.min(...values), max: Math.max(...values), weight: Math.max(0, signal) }),
      ];
    }),
  ) as unknown as Readonly<Record<ComplexityFeature, CalibratedFeature>>;

  if (COMPLEXITY_FEATURES.every((feature) => features[feature].weight === 0)) {
    throw new CalibrationPendingError(
      'CAL-09',
      'H5 / T-H5-10',
      'la muestra no aporta ninguna señal ordinal positiva; no se puede congelar un índice',
    );
  }

  const base = {
    calibrationId: 'CAL-09',
    version,
    status: 'frozen',
    frozenAt,
    dataPolicy: 'no_participant_data',
    method: 'pairwise_ordinal_concordance_v1',
    profileVersion: COMPLEXITY_PROFILE_VERSION,
    authorizedCalculusVersion: AUTHORIZED_CALCULUS_VERSION,
    verifierVersion: VERIFIER_VERSION,
    searchMode: samples[0]!.profile.searchRelative.mode,
    searchOrderVersion: samples[0]!.profile.searchRelative.searchOrderVersion,
    features: Object.freeze(features),
  } as const;

  const provisional = {
    ...base,
    tierBands: { baja: { min: 0, max: 0 }, media: { min: 0, max: 0 }, alta: { min: 0, max: 0 } },
    comparabilityMaxDifference: 0,
    sampleIds: samples.map((s) => s.caseId),
    sampleHash: '0'.repeat(64),
  } satisfies ComplexityCalibrationManifest;
  const scores = samples.map((sample) => ({ sample, score: complexityIndex(sample.profile, provisional) }));
  const medians = COMPLEXITY_TIERS.map((tier) =>
    median(scores.filter((s) => s.sample.tier === tier).map((s) => s.score)),
  );
  if (!(medians[0]! < medians[1]! && medians[1]! < medians[2]!)) {
    throw new CalibrationPendingError(
      'CAL-09',
      'H5 / T-H5-10',
      `los estratos no quedan ordenados por mediana (${medians.join(' < ')}); revisar la muestra`,
    );
  }
  const lowMediumBoundary = round6((medians[0]! + medians[1]!) / 2);
  const mediumHighBoundary = round6((medians[1]! + medians[2]!) / 2);
  const tierBands: ComplexityCalibrationManifest['tierBands'] = Object.freeze({
    baja: Object.freeze({ min: 0, max: lowMediumBoundary }),
    media: Object.freeze({ min: lowMediumBoundary, max: mediumHighBoundary }),
    alta: Object.freeze({ min: mediumHighBoundary, max: 100 }),
  });
  const comparabilityMaxDifference = round6(
    Math.min(medians[1]! - medians[0]!, medians[2]! - medians[1]!) / 2,
  );
  const misclassified = scores.filter(({ sample, score }) => {
    const classified: ComplexityTier =
      score <= lowMediumBoundary ? 'baja' : score <= mediumHighBoundary ? 'media' : 'alta';
    return classified !== sample.tier;
  });
  if (misclassified.length > 0) {
    throw new CalibrationPendingError(
      'CAL-09',
      'H5 / T-H5-10',
      `el índice no recupera los estratos predeclarados: ${misclassified
        .map(({ sample }) => sample.caseId)
        .join(', ')}`,
    );
  }
  const sampleMaterial = samples.map((sample, index) => ({
    caseId: sample.caseId,
    tier: sample.tier,
    dataOrigin: sample.dataOrigin,
    features: vectors[index]!.vector,
  }));
  return Object.freeze({
    ...base,
    tierBands: Object.freeze(tierBands),
    comparabilityMaxDifference,
    sampleIds: Object.freeze(samples.map((s) => s.caseId)),
    sampleHash: createHash('sha256').update(JSON.stringify(sampleMaterial)).digest('hex'),
  });
}

export function complexityTierMatches(
  profile: StructuralComplexityProfile,
  target: ComplexityTier,
  calibration: ComplexityCalibrationManifest,
): boolean {
  return classifyComplexity(profile, calibration) === target;
}

export function classifyComplexity(
  profile: StructuralComplexityProfile,
  calibration: ComplexityCalibrationManifest,
): ComplexityTier {
  const score = complexityIndex(profile, calibration);
  if (score <= calibration.tierBands.baja.max) return 'baja';
  if (score <= calibration.tierBands.media.max) return 'media';
  return 'alta';
}

export function complexityFeatureVector(
  profile: StructuralComplexityProfile,
): Readonly<Record<ComplexityFeature, number>> {
  return Object.freeze({
    proofLength: profile.structural.proofLength,
    distinctRuleCount: profile.structural.distinctRuleCount,
    subproofCount: profile.structural.subproofCount,
    maxSubproofDepth: profile.structural.maxSubproofDepth,
    premiseCount: profile.structural.premiseCount,
    connectivesInStatement: profile.structural.connectivesInStatement,
    requiresAssumptionDischarge: Number(profile.structural.requiresAssumptionDischarge),
    usesIndirectStrategy: Number(profile.structural.usesIndirectStrategy),
    structuralDistance: profile.structural.structuralDistance,
    workUnitsLog2: Math.log2(1 + profile.searchRelative.workUnitsSpent),
    costExplored: profile.searchRelative.costExplored,
    distinctStrategiesFoundWithinBudget: profile.searchRelative.distinctStrategiesFoundWithinBudget,
  });
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

function assertCalibrationSample(samples: readonly ComplexityCalibrationSample[]): void {
  if (samples.length === 0) {
    throw new CalibrationPendingError('CAL-09', 'H5 / T-H5-10', 'muestra de calibración vacía');
  }
  const ids = new Set<string>();
  for (const sample of samples) {
    if (ids.has(sample.caseId)) {
      throw new CalibrationPendingError(
        'CAL-09',
        'H5 / T-H5-10',
        `caseId repetido: ${sample.caseId}`,
      );
    }
    ids.add(sample.caseId);
    if (sample.profile.searchRelative.wallTimeoutHit) {
      throw new CalibrationPendingError(
        'CAL-09',
        'H5 / T-H5-10',
        `${sample.caseId} disparó timeout de pared y no es comparable`,
      );
    }
    if (
      sample.profile.profileVersion !== COMPLEXITY_PROFILE_VERSION ||
      sample.profile.authorizedCalculusVersion !== AUTHORIZED_CALCULUS_VERSION ||
      sample.profile.verifierVersion !== VERIFIER_VERSION
    ) {
      throw new CalibrationPendingError(
        'CAL-09',
        'H5 / T-H5-10',
        `${sample.caseId} mezcla versiones fuera del sobre de calibración`,
      );
    }
    if (
      sample.profile.searchRelative.mode !== samples[0]!.profile.searchRelative.mode ||
      sample.profile.searchRelative.searchOrderVersion !==
        samples[0]!.profile.searchRelative.searchOrderVersion
    ) {
      throw new CalibrationPendingError(
        'CAL-09',
        'H5 / T-H5-10',
        `${sample.caseId} mezcla modo u orden de búsqueda; la telemetría relativa no sería comparable`,
      );
    }
  }
  for (const tier of COMPLEXITY_TIERS) {
    if (samples.filter((sample) => sample.tier === tier).length < 3) {
      throw new CalibrationPendingError(
        'CAL-09',
        'H5 / T-H5-10',
        `el estrato ${tier} necesita al menos tres soluciones verificadas`,
      );
    }
  }
}

function assertCalibrationApplies(
  profile: StructuralComplexityProfile,
  calibration: ComplexityCalibrationManifest,
): void {
  const invalid: string[] = [];
  if (calibration.calibrationId !== 'CAL-09') invalid.push('calibrationId');
  if (!(CAL09_VERSIONS as readonly string[]).includes(calibration.version)) invalid.push('version');
  if (calibration.status !== 'frozen') invalid.push('status');
  if (calibration.dataPolicy !== 'no_participant_data') invalid.push('dataPolicy');
  if (calibration.method !== 'pairwise_ordinal_concordance_v1') invalid.push('method');
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(calibration.frozenAt)) invalid.push('frozenAt');
  if (!/^[0-9a-f]{64}$/u.test(calibration.sampleHash)) invalid.push('sampleHash');
  if (calibration.sampleIds.length === 0) invalid.push('sampleIds');
  if (calibration.profileVersion !== profile.profileVersion) invalid.push('profileVersion');
  if (calibration.authorizedCalculusVersion !== profile.authorizedCalculusVersion) {
    invalid.push('authorizedCalculusVersion');
  }
  if (calibration.verifierVersion !== profile.verifierVersion) invalid.push('verifierVersion');
  if (invalid.length > 0) {
    throw new CalibrationPendingError(
      'CAL-09',
      'H5 / T-H5-10',
      `el manifiesto no está congelado para el perfil medido: ${invalid.join(', ')}`,
    );
  }
  for (const feature of COMPLEXITY_FEATURES) {
    const configured = calibration.features[feature];
    if (
      configured === undefined ||
      !Number.isFinite(configured.min) ||
      !Number.isFinite(configured.max) ||
      configured.min > configured.max ||
      !Number.isInteger(configured.weight) ||
      configured.weight < 0
    ) {
      throw new CalibrationPendingError(
        'CAL-09',
        'H5 / T-H5-10',
        `configuración inválida de la medida ${feature}`,
      );
    }
  }
  if (
    !Number.isFinite(calibration.comparabilityMaxDifference) ||
    calibration.comparabilityMaxDifference < 0
  ) {
    throw new CalibrationPendingError(
      'CAL-09',
      'H5 / T-H5-10',
      'criterio de comparabilidad inválido',
    );
  }
  if (
    profile.searchRelative.wallTimeoutHit ||
    profile.searchRelative.mode !== calibration.searchMode ||
    profile.searchRelative.searchOrderVersion !== calibration.searchOrderVersion
  ) {
    throw new CalibrationPendingError(
      'CAL-09',
      'H5 / T-H5-10',
      'la telemetría relativa no es comparable con el modo/orden congelado o tuvo timeout',
    );
  }
}

function tierRank(tier: ComplexityTier): number {
  return COMPLEXITY_TIERS.indexOf(tier);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
