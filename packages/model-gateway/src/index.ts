// @profesor-ia/model-gateway — Proveedores, bindings, filtros, cost-ledger (F4/H4).
// T-H4-01: adaptadores propios, operaciones exactas y perfiles con credenciales
// separadas. El resto de F4 (capacidades, validación de salida, canarios,
// cost-ledger) entra por sus tareas. Ver docs/plan/PLAN_STATUS.md.

export const PACKAGE_NAME = "@profesor-ia/model-gateway" as const;

export {
  ModelGatewayError,
  OperationNotAuthorizedForProfileError,
  ProfileMismatchError,
  AmbiguousBindingError,
  MissingCredentialError,
  UnknownProviderError,
  UnsupportedParameterError,
  RejectedParameterError,
  UnpinnedBindingError,
  ContradictoryCapabilitiesError,
  UnknownProviderContractError,
  FragmentOutsideBlockError,
  HelpLevelExceededError,
  UndeclaredStateKeyError,
  CanaryHitError,
  ManifestRewriteError,
  UnknownPricingManifestError,
  ManifestNotEffectiveError,
  MissingPricingEntryError,
  CurrencyMismatchError,
  BudgetBlockedError,
  InvalidAlertThresholdError,
  ModalityNotEligibleError,
  FrozenAssetMissingError,
  LiveGenerationDisabledError,
} from './errors.js';

export {
  DegradedProfile,
  FROZEN_ASSET_KINDS,
  GatewayMode,
  type DegradedProfileOptions,
  type FeedbackTemplate,
  type FrozenAsset,
  type FrozenAssetKind,
} from './degraded.js';

export {
  assertModalityEligible,
  cacheTelemetryFor,
  checkModalityEligibility,
  DATA_CLASSIFICATIONS,
  MODALITIES,
  type CacheTelemetry,
  type DataClassification,
  type EligibilityInput,
  type EligibilityVerdict,
  type Modality,
} from './modality.js';

export { CostLedger, priceCall, type CallUsage, type PricedCall } from './cost.js';

export {
  BudgetController,
  BUDGET_CURRENCY,
  HARD_REVIEW_THRESHOLD_MXN,
  ORDINARY_MONTHLY_TARGET_MXN,
  type BudgetControllerOptions,
  type BudgetStatus,
  type OwnerReview,
} from './budget.js';

export {
  buildSessionContext,
  type AuthorizedFragment,
  type BuildSessionContextOptions,
  type CanaryDetector,
  type SelectedHint,
  type SessionContext,
  type SessionContextInput,
  type StructuredError,
} from './session-context.js';

export {
  canonicalizeEnum,
  validateModelOutput,
  type CanonicalEnumValue,
  type CanonicalizeEnumOptions,
  type ProviderOutcome,
  type ValidatedOutput,
  type ValidateOutputInput,
} from './output.js';

export {
  assertRefreshAuthorizesBenchmark,
  verifiedAtFromRefresh,
  CandidateDataPolicy,
  CandidateDeprecation,
  CandidateRefresh,
  DocumentaryFact,
  DocumentaryRefreshError,
  DocumentaryRefreshRecord,
  DocumentarySource,
  DOCUMENTARY_REFRESH_SCHEMA_VERSION,
  RefreshWindowParameter,
  type BenchmarkRun,
  type RefreshAuthorization,
} from './documentary-refresh.js';

export {
  assertBindingUsable,
  assertPinnedIdentity,
  authorizeParameters,
  NO_PARAMETERS,
  type AuthorizedParameters,
} from './capabilities.js';

export { MODEL_OPERATIONS, MODEL_PROFILES, isModelOperation } from './operations.js';
export {
  ProfileCredential,
  credentialEnvVar,
  envCredentialResolver,
  type CredentialResolver,
} from './credentials.js';
export type {
  BuildRequestInput,
  ProviderAdapter,
  ProviderRequest,
  ProviderResponse,
  Transport,
} from './adapter.js';
export { ANTHROPIC_PROVIDER, anthropicAdapter } from './adapters/anthropic.js';
export { OPENAI_PROVIDER, openaiAdapter } from './adapters/openai.js';
export {
  ModelGateway,
  type BindingRegistration,
  type DispatchInput,
  type ExecuteInput,
  type ModelGatewayOptions,
} from './gateway.js';
