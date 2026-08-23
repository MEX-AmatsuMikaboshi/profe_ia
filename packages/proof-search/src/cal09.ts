import {
  calibrateComplexity,
  structuralComplexity,
  type ComplexityCalibrationManifest,
  type ComplexityCalibrationSample,
  type ComplexityTier,
} from './complexity.js';
import { search } from './search.js';

/**
 * Muestra sintética predeclarada de CAL-09. Las etiquetas no se calculan del
 * índice: describen la construcción usada para crear cada caso antes de medir.
 * Todas las soluciones pasan `logic-core`; ninguna usa datos de participante.
 */
export const CAL09_CASES: readonly Readonly<{
  caseId: string;
  tier: ComplexityTier;
  premises: readonly string[];
  goal: string;
}>[] = Object.freeze([
  { caseId: 'cal09-low-conjunction-elim', tier: 'baja', premises: ['A∧B'], goal: 'A' },
  { caseId: 'cal09-low-modus-ponens', tier: 'baja', premises: ['A', 'A→B'], goal: 'B' },
  { caseId: 'cal09-low-disjunction-intro', tier: 'baja', premises: ['A'], goal: 'A∨B' },
  { caseId: 'cal09-low-contradiction', tier: 'baja', premises: ['¬A', 'A'], goal: '⊥' },
  { caseId: 'cal09-mid-reorder-conjunction', tier: 'media', premises: ['A∧B'], goal: 'B∧A' },
  { caseId: 'cal09-mid-one-subproof', tier: 'media', premises: ['B'], goal: 'A→B' },
  { caseId: 'cal09-mid-two-step-chain', tier: 'media', premises: ['A→B', 'B→C', 'A'], goal: 'C' },
  { caseId: 'cal09-mid-elim-and-chain', tier: 'media', premises: ['A∧B', 'B→C'], goal: 'C' },
  {
    caseId: 'cal09-high-three-step-chain',
    tier: 'alta',
    premises: ['A→B', 'B→C', 'C→D', 'A'],
    goal: 'D',
  },
  { caseId: 'cal09-high-nested-subproof', tier: 'alta', premises: ['B'], goal: 'A→(C→B)' },
  {
    caseId: 'cal09-high-chain-and-output',
    tier: 'alta',
    premises: ['A→B', 'B→C', 'A', 'D'],
    goal: 'C∧D',
  },
  {
    caseId: 'cal09-high-mixed-rules',
    tier: 'alta',
    premises: ['A∧B', 'B→C', 'C→D'],
    goal: 'A∧D',
  },
  {
    caseId: 'cal09-high-indirect',
    tier: 'alta',
    premises: ['¬A→B', '¬A→¬B'],
    goal: 'A',
  },
]);

export function cal09Samples(): readonly ComplexityCalibrationSample[] {
  return Object.freeze(
    CAL09_CASES.map((testCase) => {
      const premises = [...testCase.premises];
      const outcome = search(
        {
          premises,
          goal: testCase.goal,
          mode: 'heuristic',
          budget: { maxWorkUnits: 200_000 },
        },
        { semanticOracle: 'prefilter' },
      );
      if (outcome.status !== 'proof_found') {
        throw new Error(
          `${testCase.caseId}: la muestra predeclarada dejó de producir solución (${outcome.status})`,
        );
      }
      return Object.freeze({
        caseId: testCase.caseId,
        tier: testCase.tier,
        dataOrigin: 'synthetic_verified_solution' as const,
        profile: structuralComplexity({ premises, goal: testCase.goal, outcome }),
      });
    }),
  );
}

/** Reproduce el manifiesto que debe coincidir con `CAL09_FROZEN_MANIFEST`. */
export function runCal09Calibration(): ComplexityCalibrationManifest {
  return calibrateComplexity(cal09Samples(), '2026-08-22', 'cal-09-v2');
}

/**
 * **Historia, no calibración vigente.** `cal-09-v1` se congeló el 2026-08-16 y
 * dejó de reproducirse el 2026-08-22, cuando se aplicó el encadenamiento hacia
 * atrás de `→`/`↔` al buscador (D-66): el arreglo no cambia ninguna de las trece
 * derivaciones —mismas líneas, mismas reglas, mismo `costExplored`— pero sí el
 * **trabajo de búsqueda** en cinco casos, y `workUnitsLog2` pesa en el índice.
 *
 * Se conserva porque una calibración congelada es evidencia y no se sobrescribe:
 * los reactivos medidos bajo v1 lo fueron con estas bandas. **Las dos escalas no
 * son directamente comparables** y nada debe mezclarlas; quien necesite releer
 * una medida vieja necesita este manifiesto, no el vigente.
 */
export const CAL09_V1_FROZEN_MANIFEST: ComplexityCalibrationManifest = Object.freeze({
  calibrationId: 'CAL-09',
  version: 'cal-09-v1',
  status: 'frozen',
  frozenAt: '2026-08-16',
  dataPolicy: 'no_participant_data',
  method: 'pairwise_ordinal_concordance_v1',
  profileVersion: 'structural-complexity-v1',
  authorizedCalculusVersion: 'authorized-calculus-v1',
  verifierVersion: '0.1.0',
  searchMode: 'heuristic',
  searchOrderVersion: 'search-order-v1',
  features: Object.freeze({
    proofLength: Object.freeze({ min: 1, max: 5, weight: 52 }),
    distinctRuleCount: Object.freeze({ min: 1, max: 3, weight: 35 }),
    subproofCount: Object.freeze({ min: 0, max: 2, weight: 16 }),
    maxSubproofDepth: Object.freeze({ min: 0, max: 2, weight: 16 }),
    premiseCount: Object.freeze({ min: 1, max: 4, weight: 24 }),
    connectivesInStatement: Object.freeze({ min: 1, max: 5, weight: 49 }),
    requiresAssumptionDischarge: Object.freeze({ min: 0, max: 1, weight: 15 }),
    usesIndirectStrategy: Object.freeze({ min: 0, max: 1, weight: 8 }),
    structuralDistance: Object.freeze({ min: 2, max: 9, weight: 39 }),
    workUnitsLog2: Object.freeze({ min: 1, max: 6.3750394313469245, weight: 47 }),
    costExplored: Object.freeze({ min: 1, max: 4, weight: 49 }),
    distinctStrategiesFoundWithinBudget: Object.freeze({ min: 1, max: 1, weight: 0 }),
  }),
  tierBands: Object.freeze({
    baja: Object.freeze({ min: 0, max: 14.004071 }),
    media: Object.freeze({ min: 14.004071, max: 38.57128 }),
    alta: Object.freeze({ min: 38.57128, max: 100 }),
  }),
  comparabilityMaxDifference: 12.065296,
  sampleIds: Object.freeze([
    'cal09-low-conjunction-elim',
    'cal09-low-modus-ponens',
    'cal09-low-disjunction-intro',
    'cal09-low-contradiction',
    'cal09-mid-reorder-conjunction',
    'cal09-mid-one-subproof',
    'cal09-mid-two-step-chain',
    'cal09-mid-elim-and-chain',
    'cal09-high-three-step-chain',
    'cal09-high-nested-subproof',
    'cal09-high-chain-and-output',
    'cal09-high-mixed-rules',
    'cal09-high-indirect',
  ]),
  sampleHash: '9247a8b0df137c56b742e7650e59848be965fe38374e21c6c1ba5acddb1f830a',
});

/**
 * Resultado congelado de la corrida **vigente**. Es literal a propósito: si
 * cambia un caso, una versión, la búsqueda o el algoritmo, la prueba de drift
 * compara la nueva corrida con este artefacto y falla; recalcular en import lo
 * ocultaría.
 *
 * **`cal-09-v2`, congelada el 2026-08-22** al aplicar D-66. La anterior está en
 * `CAL09_V1_FROZEN_MANIFEST` y **no es comparable con ésta**.
 */
export const CAL09_FROZEN_MANIFEST: ComplexityCalibrationManifest = Object.freeze({
  calibrationId: 'CAL-09',
  version: 'cal-09-v2',
  status: 'frozen',
  frozenAt: '2026-08-22',
  dataPolicy: 'no_participant_data',
  method: 'pairwise_ordinal_concordance_v1',
  profileVersion: 'structural-complexity-v1',
  authorizedCalculusVersion: 'authorized-calculus-v1',
  verifierVersion: '0.1.0',
  searchMode: 'heuristic',
  searchOrderVersion: 'search-order-v1',
  features: Object.freeze({
    proofLength: Object.freeze({ min: 1, max: 5, weight: 52 }),
    distinctRuleCount: Object.freeze({ min: 1, max: 3, weight: 35 }),
    subproofCount: Object.freeze({ min: 0, max: 2, weight: 16 }),
    maxSubproofDepth: Object.freeze({ min: 0, max: 2, weight: 16 }),
    premiseCount: Object.freeze({ min: 1, max: 4, weight: 24 }),
    connectivesInStatement: Object.freeze({ min: 1, max: 5, weight: 49 }),
    requiresAssumptionDischarge: Object.freeze({ min: 0, max: 1, weight: 15 }),
    usesIndirectStrategy: Object.freeze({ min: 0, max: 1, weight: 8 }),
    structuralDistance: Object.freeze({ min: 2, max: 9, weight: 39 }),
    workUnitsLog2: Object.freeze({ min: 1, max: 6.6293566200796095, weight: 46 }),
    costExplored: Object.freeze({ min: 1, max: 4, weight: 49 }),
    distinctStrategiesFoundWithinBudget: Object.freeze({ min: 1, max: 1, weight: 0 }),
  }),
  tierBands: Object.freeze({
    baja: Object.freeze({ min: 0, max: 14.05492 }),
    media: Object.freeze({ min: 14.05492, max: 38.548779 }),
    alta: Object.freeze({ min: 38.548779, max: 100 }),
  }),
  comparabilityMaxDifference: 12.110589,
  sampleIds: Object.freeze([
    'cal09-low-conjunction-elim',
    'cal09-low-modus-ponens',
    'cal09-low-disjunction-intro',
    'cal09-low-contradiction',
    'cal09-mid-reorder-conjunction',
    'cal09-mid-one-subproof',
    'cal09-mid-two-step-chain',
    'cal09-mid-elim-and-chain',
    'cal09-high-three-step-chain',
    'cal09-high-nested-subproof',
    'cal09-high-chain-and-output',
    'cal09-high-mixed-rules',
    'cal09-high-indirect',
  ]),
  sampleHash: '9a0c1c76f6046d98405024ce41a148a97afe2dd8cff0bd8cda8f88b8473a97b9',
});
