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
  TransportError,
  FragmentOutsideBlockError,
  HelpLevelExceededError,
  UndeclaredStateKeyError,
  CanaryHitError,
  MissingEgressFilterError,
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
  validateAnchoredOutput,
  type AnchorRejection,
  type AnchorValidationInput,
  type AnchorVerdict,
  type AuthorizedCalculus,
  type SegmentStanding,
  type UnanchoredSegmentRecord,
  type ValidateAnchoredOutputOptions,
} from './anchoring.js';

export {
  canonicalizeEnum,
  stripCodeFence,
  validateModelOutput,
  type CanonicalEnumValue,
  type CanonicalizeEnumOptions,
  type CodeFencePolicy,
  type ProviderOutcome,
  type ProviderUsage,
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
export { httpTransport, type HttpTransportOptions } from './transport.js';
export {
  ANTHROPIC_SOURCE,
  FIX_MXN_PER_USD,
  FIX_SOURCE,
  OPENAI_SOURCE,
  PRICING_MANIFEST_2026_08_18,
  PUBLISHED_USD_PRICES,
  mxnPerToken,
} from './pricing-manifest.js';
export { ANTHROPIC_PROVIDER, anthropicAdapter } from './adapters/anthropic.js';
export { OPENAI_PROVIDER, openaiAdapter } from './adapters/openai.js';
export {
  ModelGateway,
  type BindingRegistration,
  type DispatchInput,
  type ExecuteInput,
  type ModelGatewayOptions,
} from './gateway.js';
