// @profesor-ia/bench — Harness de BENCH-01/BENCH-02 (T-H4-10/11).
//
// El conjunto y los gates son de P-III §6.1/§6.2; el runner es el único punto
// del repositorio donde se gasta dinero. Ver docs/model/bench-01.md.

export const PACKAGE_NAME = '@profesor-ia/bench' as const;

export {
  CASE_FAMILIES,
  CaseSetError,
  FAMILY_FLOORS,
  TOTAL_FLOOR,
  assertExpectationsMatchFamily,
  ANCHOR_GATE_FAMILIES,
  assertAnchorBlocksDeclared,
  assertFaultDeclarationCoherent,
  assertMaterialSetUsable,
  assertMeetsFloors,
  assertUniqueCaseIds,
  countByFamily,
  partitionBySeed,
  type BenchCase,
  type CaseExpectation,
  type CaseFamily,
  type CaseSet,
  type CaseSetPurpose,
  type FamilyFloor,
  type FaultObservation,
  type InjectedFault,
  type Partition,
  type PartitionedCaseSet,
} from './case-set.js';

export {
  GATE_IDS,
  GATE_SOURCE_FAMILIES,
  GATE_SPECS,
  GateError,
  assertDenominatorIntact,
  evaluateGate,
  ruleOfThreeUpperBound,
  verdictFor,
  type BenchVerdict,
  type GateId,
  type GateKind,
  type GateObservation,
  type GateResult,
  type GateSpec,
} from './gates.js';

export {
  BenchRunError,
  runBenchmark,
  type Candidate,
  type CaseOutcome,
  type RunDependencies,
  type DegradedRecovery,
  type RunPlan,
  type RunResult,
} from './run.js';

export {
  CorpusLoadError,
  anchoredSegmentsProbe,
  assertPackageMayCrownWinner,
  loadContentPackage,
  type AssetKindNotDerivable,
  type ContentPackage,
} from './corpus.js';

export {
  MINIMO_PASOS_PARA_SER_SECUENCIA,
  derivationSteps,
  findSolutionLeak,
  outOfScopeProbe,
  ruleInventionProbe,
  solutionLeakProbe,
  type DerivationStep,
  type SolutionLeakFinding,
} from './evidence.js';

export {
  anthropicFaultTransport,
  anthropicFaultyGatewayFactory,
  openaiFaultTransport,
  openaiFaultyGatewayFactory,
  type FaultyGatewayOptions,
  type OpenAIFaultyGatewayOptions,
} from './fault-gateway.js';

export { EXPLORATION_CASE_SET } from './exploration.js';
export {
  OPENAI_IDENTITY_PROBED_AT,
  OPENAI_LUNA_BINDING_WAIVER,
  OPENAI_LUNA_WAIVER,
  REFRESH_OPENAI_2026_08_23,
} from './refresh-openai-2026-08-23.js';

export {
  ScoringError,
  declaredDenominators,
  degradedRecoveryProbe,
  observeGates,
  scoreCandidate,
  scoreRun,
  type GateEvidence,
  type ScoringInput,
} from './scoring.js';

export {
  assessMaterialReadiness,
  formatReadiness,
  type MaterialReadiness,
  type MaterialReadinessInput,
  type ReadinessCheck,
} from './readiness.js';

export { PILOT_CASES, PILOT_CASE_SET, PILOT_INSTRUCTIONS } from './pilot-cases.js';
export {
  MATERIAL_CASES,
  MATERIAL_CASE_SET,
  MATERIAL_INSTRUCTIONS,
  MATERIAL_RESPONSE_SCHEMA,
  type MaterialResponse,
} from './material-cases.js';
export {
  HALLAZGOS_2026_08_18,
  REFRESH_2026_08_18,
  REFRESH_WINDOW_5D,
} from './refresh-2026-08-18.js';
export { REFRESH_2026_08_23 } from './refresh-2026-08-23.js';
