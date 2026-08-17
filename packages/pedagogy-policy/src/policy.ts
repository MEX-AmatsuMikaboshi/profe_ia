import { createHash } from 'node:crypto';
import {
  Id,
  PedagogicalDecision,
  PedagogicalMode,
  PedagogicalStrategy,
  Sha256Hex,
  type PedagogicalDecision as PedagogicalDecisionValue,
  type PedagogicalStrategy as PedagogicalStrategyValue,
} from '@profesor-ia/contracts';
import { z } from 'zod';

/**
 * T-H6-02. Este módulo solo acepta señales estructuradas y una tabla como datos.
 * No recibe texto de conversación ni propuestas de modelo, y no contiene una
 * salida de rescate docente.
 */
export const PEDAGOGY_POLICY_SCHEMA_VERSION = 'pedagogy-policy-v1' as const;
export const PEDAGOGY_TRANSITION_TABLE_VERSION = 'pedagogy-transition-table-v1' as const;

export const PEDAGOGY_DECISION_HIERARCHY = Object.freeze([
  'security_integrity_mode_no_revelation',
  'blocking_prerequisites',
  'mastery_and_recovery',
  'strategy_by_kc_and_observable_state',
  'linguistic_visual_adaptation_within_selected_strategy',
] as const);

export const SELF_EXPLANATION_TRIGGERS = Object.freeze([
  'after_correct_nontrivial_step',
  'after_persistent_error',
  'distinguish_understanding_from_memorization',
] as const);

export const BASE_PATTERN_IDS = Object.freeze([
  'new_procedural_kc',
  'partial_difficulty',
  'repeated_same_error',
  'prerequisite_failure',
  'apparent_mastery_or_help_dependence',
] as const);

const NonEmptyText = z.string().trim().min(1).max(500);
const PolicyPurpose = z.enum(['material', 'test_fixture']);
const HierarchyLevel = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
const KcType = z.enum(['procedural', 'declarative', 'strategic', 'mixed']);
const BasePatternId = z.enum(BASE_PATTERN_IDS);
const SelfExplanationTrigger = z.enum(SELF_EXPLANATION_TRIGGERS);

function uniqueArray<T extends z.ZodType>(schema: T, label: string) {
  return z.array(schema).superRefine((values, context) => {
    const seen = new Set<unknown>();
    for (const [index, value] of values.entries()) {
      const key = typeof value === 'object' ? JSON.stringify(value) : value;
      if (seen.has(key)) {
        context.addIssue({ code: 'custom', message: `${label}: valor duplicado`, path: [index] });
      }
      seen.add(key);
    }
  });
}

const PatternPosition = z
  .object({ patternId: BasePatternId, stepId: Id })
  .strict();
export type PatternPosition = z.infer<typeof PatternPosition>;

const StrategyPatternStep = z
  .object({ stepId: Id, kind: z.literal('strategy'), strategy: PedagogicalStrategy })
  .strict();
const FadingPatternStep = z
  .object({ stepId: Id, kind: z.literal('fading') })
  .strict();
const FeedbackPatternStep = z
  .object({ stepId: Id, kind: z.literal('corrective_feedback') })
  .strict();
const EnginePatternStep = z
  .object({
    stepId: Id,
    kind: z.literal('engine_action'),
    action: z.enum([
      'check_performance',
      'directed_explanation_or_contrast_example',
      'new_practice',
      'suspend_target_kc',
      'return_to_target_kc',
      'new_unassisted_attempt',
      'independent_calendar_probe',
    ]),
  })
  .strict();
const PatternStep = z.discriminatedUnion('kind', [
  StrategyPatternStep,
  FadingPatternStep,
  FeedbackPatternStep,
  EnginePatternStep,
]);
const BasePattern = z
  .object({ patternId: BasePatternId, steps: z.array(PatternStep).min(1) })
  .strict();
export type BasePattern = z.infer<typeof BasePattern>;

const BASE_PATTERNS_LITERAL = [
  {
    patternId: 'new_procedural_kc',
    steps: [
      { stepId: 'brief_explanation', kind: 'strategy', strategy: 'direct_explanation' },
      { stepId: 'worked_example', kind: 'strategy', strategy: 'worked_example' },
      { stepId: 'completion_or_fading', kind: 'strategy', strategy: 'completion_problem' },
      { stepId: 'guided_practice', kind: 'strategy', strategy: 'guided_practice' },
      { stepId: 'independent_practice', kind: 'strategy', strategy: 'independent_practice' },
      { stepId: 'near_transfer', kind: 'strategy', strategy: 'near_transfer' },
    ],
  },
  {
    patternId: 'partial_difficulty',
    steps: [
      { stepId: 'contingent_scaffolding', kind: 'strategy', strategy: 'scaffolding' },
      { stepId: 'check', kind: 'engine_action', action: 'check_performance' },
      { stepId: 'performance_fading', kind: 'fading' },
    ],
  },
  {
    patternId: 'repeated_same_error',
    steps: [
      { stepId: 'specific_feedback', kind: 'corrective_feedback' },
      { stepId: 'guided_self_explanation', kind: 'strategy', strategy: 'self_explanation' },
      {
        stepId: 'directed_explanation',
        kind: 'engine_action',
        action: 'directed_explanation_or_contrast_example',
      },
      { stepId: 'new_practice', kind: 'engine_action', action: 'new_practice' },
    ],
  },
  {
    patternId: 'prerequisite_failure',
    steps: [
      { stepId: 'suspend_target', kind: 'engine_action', action: 'suspend_target_kc' },
      {
        stepId: 'remediate_prerequisite',
        kind: 'strategy',
        strategy: 'prerequisite_remediation',
      },
      { stepId: 'return_to_target', kind: 'engine_action', action: 'return_to_target_kc' },
    ],
  },
  {
    patternId: 'apparent_mastery_or_help_dependence',
    steps: [
      { stepId: 'unassisted_attempt', kind: 'engine_action', action: 'new_unassisted_attempt' },
      { stepId: 'transfer_variant', kind: 'strategy', strategy: 'near_transfer' },
      { stepId: 'calendar_probe', kind: 'engine_action', action: 'independent_calendar_probe' },
    ],
  },
] as const;

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (typeof value !== 'object' || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

export const PEDAGOGY_BASE_PATTERNS = deepFreeze(
  z.array(BasePattern).parse(BASE_PATTERNS_LITERAL),
);

export const PedagogyObservableSignal = z.enum([
  'security_block',
  'integrity_block',
  'no_revelation_risk',
  'blocking_prerequisite',
  'mastery_recovery_required',
  'partial_difficulty',
  'repeated_same_error',
  'help_dependence',
  'self_explanation_correct_nontrivial',
  'self_explanation_persistent_error',
  'self_explanation_understanding_probe',
  'fading_authorized',
  'retrieval_due_by_engine_calendar',
  'wheel_spinning',
]);
export type PedagogyObservableSignal = z.infer<typeof PedagogyObservableSignal>;

const RuleConditions = z
  .object({
    modes: uniqueArray(PedagogicalMode, 'modes').min(1),
    requiredSignals: uniqueArray(PedagogyObservableSignal, 'requiredSignals'),
    kcTypes: uniqueArray(KcType, 'kcTypes'),
    patternPositions: uniqueArray(PatternPosition, 'patternPositions'),
  })
  .strict();

const SuppressEffect = z
  .object({ kind: z.literal('suppress'), reasonCode: NonEmptyText })
  .strict();
const DecisionEffect = z
  .object({
    kind: z.literal('decision'),
    strategy: PedagogicalStrategy,
    assistanceLevel: z.number().int().min(0).max(5),
    masteryEligible: z.boolean(),
    reasonCode: NonEmptyText,
    correctiveFeedbackRequired: z.boolean(),
  })
  .strict();
const FadingEffect = z
  .object({
    kind: z.literal('fading'),
    assistanceDecrease: z.number().int().positive().max(5),
    masteryEligibleWhenUnassisted: z.boolean(),
    reasonCode: NonEmptyText,
  })
  .strict();
const RuleEffect = z.discriminatedUnion('kind', [SuppressEffect, DecisionEffect, FadingEffect]);

export const PedagogyTransitionRule = z
  .object({
    ruleId: Id,
    hierarchyLevel: HierarchyLevel,
    priority: z.number().int().nonnegative(),
    conditions: RuleConditions,
    effect: RuleEffect,
  })
  .strict();
export type PedagogyTransitionRule = z.infer<typeof PedagogyTransitionRule>;

const WheelThreshold = z
  .object({
    eligibleAttemptWindow: z.number().int().positive(),
    minimumUnsuccessfulEligibleAttempts: z.number().int().positive(),
  })
  .strict()
  .superRefine((threshold, context) => {
    if (threshold.minimumUnsuccessfulEligibleAttempts > threshold.eligibleAttemptWindow) {
      context.addIssue({
        code: 'custom',
        message: 'el mínimo de intentos fallidos no puede superar la ventana elegible',
        path: ['minimumUnsuccessfulEligibleAttempts'],
      });
    }
  });

const PendingWheelCalibration = z
  .object({
    parameterId: z.literal('CAL-10'),
    registryAlias: z.literal('CAL-WHEEL'),
    status: z.literal('pending'),
  })
  .strict();
const MaterialWheelCalibration = z
  .object({
    parameterId: z.literal('CAL-10'),
    registryAlias: z.literal('CAL-WHEEL'),
    status: z.literal('material'),
    calibrationVersion: NonEmptyText,
    artifactHash: Sha256Hex,
    threshold: WheelThreshold,
  })
  .strict();
const TestFixtureWheelCalibration = z
  .object({
    parameterId: z.literal('CAL-10'),
    registryAlias: z.literal('CAL-WHEEL'),
    status: z.literal('test_fixture'),
    calibrationVersion: NonEmptyText,
    artifactHash: Sha256Hex,
    threshold: WheelThreshold,
  })
  .strict();
export const WheelSpinningCalibrationBinding = z.discriminatedUnion('status', [
  PendingWheelCalibration,
  MaterialWheelCalibration,
  TestFixtureWheelCalibration,
]);
export type WheelSpinningCalibrationBinding = z.infer<typeof WheelSpinningCalibrationBinding>;

const PolicyControls = z
  .object({
    fading: z
      .object({
        performanceContingent: z.literal(true),
        fixedTriggerRequiresPreRegistration: z.literal(true),
        fixedTriggerRequiresExpressValidation: z.literal(true),
      })
      .strict(),
    selfExplanation: z
      .object({
        triggers: z.tuple([
          z.literal('after_correct_nontrivial_step'),
          z.literal('after_persistent_error'),
          z.literal('distinguish_understanding_from_memorization'),
        ]),
        everyStep: z.literal(false),
        anchoredToKc: z.literal(true),
        diagnosticOnly: z.literal(true),
      })
      .strict(),
    retrievalSpacing: z
      .object({
        authority: z.literal('engine_calendar'),
        requiresPriorIntroduction: z.literal(true),
        measurementReserveForbidden: z.literal(true),
      })
      .strict(),
  })
  .strict();

export const PedagogyPolicyDefinition = z
  .object({
    schemaVersion: z.literal(PEDAGOGY_POLICY_SCHEMA_VERSION),
    policyVersion: NonEmptyText,
    transitionTableVersion: NonEmptyText,
    purpose: PolicyPurpose,
    decisionHierarchy: z.tuple([
      z.literal('security_integrity_mode_no_revelation'),
      z.literal('blocking_prerequisites'),
      z.literal('mastery_and_recovery'),
      z.literal('strategy_by_kc_and_observable_state'),
      z.literal('linguistic_visual_adaptation_within_selected_strategy'),
    ]),
    basePatterns: z.array(BasePattern),
    controls: PolicyControls,
    wheelSpinningCalibration: WheelSpinningCalibrationBinding,
    transitionRules: z.array(PedagogyTransitionRule).min(1),
  })
  .strict();
export type PedagogyPolicyDefinition = z.infer<typeof PedagogyPolicyDefinition>;

const TRANSITION_RULES_LITERAL = [
  {
    ruleId: 'mode.measurement.suppress',
    hierarchyLevel: 1,
    priority: 0,
    conditions: { modes: ['MEASUREMENT_MODE'], requiredSignals: [], kcTypes: [], patternPositions: [] },
    effect: { kind: 'suppress', reasonCode: 'MEASUREMENT_MODE_PEDAGOGY_SUPPRESSED' },
  },
  {
    ruleId: 'guard.security',
    hierarchyLevel: 1,
    priority: 1,
    conditions: { modes: ['LEARNING_MODE'], requiredSignals: ['security_block'], kcTypes: [], patternPositions: [] },
    effect: { kind: 'suppress', reasonCode: 'SECURITY_BLOCK' },
  },
  {
    ruleId: 'guard.integrity',
    hierarchyLevel: 1,
    priority: 2,
    conditions: { modes: ['LEARNING_MODE'], requiredSignals: ['integrity_block'], kcTypes: [], patternPositions: [] },
    effect: { kind: 'suppress', reasonCode: 'INTEGRITY_BLOCK' },
  },
  {
    ruleId: 'guard.no_revelation',
    hierarchyLevel: 1,
    priority: 3,
    conditions: { modes: ['LEARNING_MODE'], requiredSignals: ['no_revelation_risk'], kcTypes: [], patternPositions: [] },
    effect: { kind: 'suppress', reasonCode: 'NO_REVELATION_BLOCK' },
  },
  {
    ruleId: 'prerequisite.remediation',
    hierarchyLevel: 2,
    priority: 0,
    conditions: { modes: ['LEARNING_MODE'], requiredSignals: ['blocking_prerequisite'], kcTypes: [], patternPositions: [] },
    effect: {
      kind: 'decision', strategy: 'prerequisite_remediation', assistanceLevel: 2,
      masteryEligible: false, reasonCode: 'BLOCKING_PREREQUISITE', correctiveFeedbackRequired: false,
    },
  },
  {
    ruleId: 'recovery.wheel_spinning',
    hierarchyLevel: 3,
    priority: 0,
    conditions: { modes: ['LEARNING_MODE'], requiredSignals: ['wheel_spinning'], kcTypes: [], patternPositions: [] },
    effect: {
      kind: 'decision', strategy: 'scaffolding', assistanceLevel: 3,
      masteryEligible: false, reasonCode: 'WHEEL_SPINNING_RECOVERY', correctiveFeedbackRequired: true,
    },
  },
  {
    ruleId: 'recovery.mastery',
    hierarchyLevel: 3,
    priority: 1,
    conditions: { modes: ['LEARNING_MODE'], requiredSignals: ['mastery_recovery_required'], kcTypes: [], patternPositions: [] },
    effect: {
      kind: 'decision', strategy: 'scaffolding', assistanceLevel: 3,
      masteryEligible: false, reasonCode: 'MASTERY_RECOVERY_REQUIRED', correctiveFeedbackRequired: true,
    },
  },
  {
    ruleId: 'mastery.help_dependence',
    hierarchyLevel: 3,
    priority: 2,
    conditions: { modes: ['LEARNING_MODE'], requiredSignals: ['help_dependence'], kcTypes: [], patternPositions: [] },
    effect: {
      kind: 'decision', strategy: 'near_transfer', assistanceLevel: 0,
      masteryEligible: true, reasonCode: 'HELP_DEPENDENCE_TRANSFER_CHECK', correctiveFeedbackRequired: false,
    },
  },
  {
    ruleId: 'pattern.new_procedural.explain',
    hierarchyLevel: 4,
    priority: 0,
    conditions: { modes: ['LEARNING_MODE'], requiredSignals: [], kcTypes: ['procedural', 'mixed'], patternPositions: [{ patternId: 'new_procedural_kc', stepId: 'brief_explanation' }] },
    effect: {
      kind: 'decision', strategy: 'direct_explanation', assistanceLevel: 2,
      masteryEligible: false, reasonCode: 'NEW_PROCEDURAL_KC_EXPLANATION', correctiveFeedbackRequired: false,
    },
  },
  {
    ruleId: 'pattern.new_procedural.worked',
    hierarchyLevel: 4,
    priority: 1,
    conditions: { modes: ['LEARNING_MODE'], requiredSignals: [], kcTypes: ['procedural', 'mixed'], patternPositions: [{ patternId: 'new_procedural_kc', stepId: 'worked_example' }] },
    effect: {
      kind: 'decision', strategy: 'worked_example', assistanceLevel: 2,
      masteryEligible: false, reasonCode: 'NEW_PROCEDURAL_KC_WORKED_EXAMPLE', correctiveFeedbackRequired: false,
    },
  },
  {
    ruleId: 'pattern.new_procedural.completion',
    hierarchyLevel: 4,
    priority: 2,
    conditions: { modes: ['LEARNING_MODE'], requiredSignals: [], kcTypes: ['procedural', 'mixed'], patternPositions: [{ patternId: 'new_procedural_kc', stepId: 'completion_or_fading' }] },
    effect: {
      kind: 'decision', strategy: 'completion_problem', assistanceLevel: 1,
      masteryEligible: false, reasonCode: 'NEW_PROCEDURAL_KC_COMPLETION', correctiveFeedbackRequired: false,
    },
  },
  {
    ruleId: 'pattern.new_procedural.guided',
    hierarchyLevel: 4,
    priority: 3,
    conditions: { modes: ['LEARNING_MODE'], requiredSignals: [], kcTypes: ['procedural', 'mixed'], patternPositions: [{ patternId: 'new_procedural_kc', stepId: 'guided_practice' }] },
    effect: {
      kind: 'decision', strategy: 'guided_practice', assistanceLevel: 1,
      masteryEligible: false, reasonCode: 'NEW_PROCEDURAL_KC_GUIDED_PRACTICE', correctiveFeedbackRequired: false,
    },
  },
  {
    ruleId: 'pattern.new_procedural.independent',
    hierarchyLevel: 4,
    priority: 4,
    conditions: { modes: ['LEARNING_MODE'], requiredSignals: [], kcTypes: ['procedural', 'mixed'], patternPositions: [{ patternId: 'new_procedural_kc', stepId: 'independent_practice' }] },
    effect: {
      kind: 'decision', strategy: 'independent_practice', assistanceLevel: 0,
      masteryEligible: true, reasonCode: 'NEW_PROCEDURAL_KC_INDEPENDENT_PRACTICE', correctiveFeedbackRequired: false,
    },
  },
  {
    ruleId: 'pattern.new_procedural.transfer',
    hierarchyLevel: 4,
    priority: 5,
    conditions: { modes: ['LEARNING_MODE'], requiredSignals: [], kcTypes: ['procedural', 'mixed'], patternPositions: [{ patternId: 'new_procedural_kc', stepId: 'near_transfer' }] },
    effect: {
      kind: 'decision', strategy: 'near_transfer', assistanceLevel: 0,
      masteryEligible: true, reasonCode: 'NEW_PROCEDURAL_KC_NEAR_TRANSFER', correctiveFeedbackRequired: false,
    },
  },
  {
    ruleId: 'pattern.partial.scaffold',
    hierarchyLevel: 4,
    priority: 6,
    conditions: { modes: ['LEARNING_MODE'], requiredSignals: ['partial_difficulty'], kcTypes: [], patternPositions: [{ patternId: 'partial_difficulty', stepId: 'contingent_scaffolding' }] },
    effect: {
      kind: 'decision', strategy: 'scaffolding', assistanceLevel: 2,
      masteryEligible: false, reasonCode: 'PARTIAL_DIFFICULTY_SCAFFOLDING', correctiveFeedbackRequired: false,
    },
  },
  {
    ruleId: 'pattern.partial.fade',
    hierarchyLevel: 4,
    priority: 7,
    conditions: { modes: ['LEARNING_MODE'], requiredSignals: ['fading_authorized'], kcTypes: [], patternPositions: [{ patternId: 'partial_difficulty', stepId: 'performance_fading' }] },
    effect: {
      kind: 'fading', assistanceDecrease: 1, masteryEligibleWhenUnassisted: true,
      reasonCode: 'PERFORMANCE_CONTINGENT_FADING',
    },
  },
  {
    ruleId: 'pattern.repeated.feedback',
    hierarchyLevel: 4,
    priority: 8,
    conditions: { modes: ['LEARNING_MODE'], requiredSignals: ['repeated_same_error'], kcTypes: [], patternPositions: [{ patternId: 'repeated_same_error', stepId: 'specific_feedback' }] },
    effect: {
      kind: 'decision', strategy: 'guided_practice', assistanceLevel: 1,
      masteryEligible: false, reasonCode: 'REPEATED_ERROR_SPECIFIC_FEEDBACK', correctiveFeedbackRequired: true,
    },
  },
  {
    ruleId: 'pattern.repeated.self_explanation',
    hierarchyLevel: 4,
    priority: 9,
    conditions: { modes: ['LEARNING_MODE'], requiredSignals: ['self_explanation_persistent_error'], kcTypes: [], patternPositions: [{ patternId: 'repeated_same_error', stepId: 'guided_self_explanation' }] },
    effect: {
      kind: 'decision', strategy: 'self_explanation', assistanceLevel: 1,
      masteryEligible: false, reasonCode: 'PERSISTENT_ERROR_SELF_EXPLANATION', correctiveFeedbackRequired: false,
    },
  },
  {
    ruleId: 'pattern.apparent.transfer',
    hierarchyLevel: 4,
    priority: 10,
    conditions: { modes: ['LEARNING_MODE'], requiredSignals: [], kcTypes: [], patternPositions: [{ patternId: 'apparent_mastery_or_help_dependence', stepId: 'transfer_variant' }] },
    effect: {
      kind: 'decision', strategy: 'near_transfer', assistanceLevel: 0,
      masteryEligible: true, reasonCode: 'APPARENT_MASTERY_TRANSFER_VARIANT', correctiveFeedbackRequired: false,
    },
  },
  {
    ruleId: 'self_explanation.correct_nontrivial',
    hierarchyLevel: 4,
    priority: 11,
    conditions: { modes: ['LEARNING_MODE'], requiredSignals: ['self_explanation_correct_nontrivial'], kcTypes: [], patternPositions: [] },
    effect: {
      kind: 'decision', strategy: 'self_explanation', assistanceLevel: 0,
      masteryEligible: false, reasonCode: 'CORRECT_NONTRIVIAL_SELF_EXPLANATION', correctiveFeedbackRequired: false,
    },
  },
  {
    ruleId: 'self_explanation.understanding_probe',
    hierarchyLevel: 4,
    priority: 12,
    conditions: { modes: ['LEARNING_MODE'], requiredSignals: ['self_explanation_understanding_probe'], kcTypes: [], patternPositions: [] },
    effect: {
      kind: 'decision', strategy: 'self_explanation', assistanceLevel: 0,
      masteryEligible: false, reasonCode: 'UNDERSTANDING_VS_MEMORIZATION_SELF_EXPLANATION', correctiveFeedbackRequired: false,
    },
  },
  {
    ruleId: 'calendar.retrieval',
    hierarchyLevel: 4,
    priority: 13,
    conditions: { modes: ['LEARNING_MODE'], requiredSignals: ['retrieval_due_by_engine_calendar'], kcTypes: [], patternPositions: [] },
    effect: {
      kind: 'decision', strategy: 'retrieval', assistanceLevel: 0,
      masteryEligible: false, reasonCode: 'ENGINE_CALENDAR_RETRIEVAL', correctiveFeedbackRequired: false,
    },
  },
] as const;

export const PEDAGOGY_TRANSITION_RULES = deepFreeze(
  z.array(PedagogyTransitionRule).parse(TRANSITION_RULES_LITERAL),
);

const POLICY_CONTROLS_LITERAL = {
  fading: {
    performanceContingent: true,
    fixedTriggerRequiresPreRegistration: true,
    fixedTriggerRequiresExpressValidation: true,
  },
  selfExplanation: {
    triggers: SELF_EXPLANATION_TRIGGERS,
    everyStep: false,
    anchoredToKc: true,
    diagnosticOnly: true,
  },
  retrievalSpacing: {
    authority: 'engine_calendar',
    requiresPriorIntroduction: true,
    measurementReserveForbidden: true,
  },
} as const;

export interface CreatePedagogyPolicyDefinitionInput {
  readonly policyVersion: string;
  readonly purpose: z.infer<typeof PolicyPurpose>;
  readonly wheelSpinningCalibration: WheelSpinningCalibrationBinding;
  readonly transitionRules?: readonly PedagogyTransitionRule[];
}

/** Crea el artefacto de datos que después debe congelarse por corrida. */
export function createPedagogyPolicyDefinition(
  input: CreatePedagogyPolicyDefinitionInput,
): PedagogyPolicyDefinition {
  return PedagogyPolicyDefinition.parse({
    schemaVersion: PEDAGOGY_POLICY_SCHEMA_VERSION,
    policyVersion: input.policyVersion,
    transitionTableVersion: PEDAGOGY_TRANSITION_TABLE_VERSION,
    purpose: input.purpose,
    decisionHierarchy: PEDAGOGY_DECISION_HIERARCHY,
    basePatterns: PEDAGOGY_BASE_PATTERNS,
    controls: POLICY_CONTROLS_LITERAL,
    wheelSpinningCalibration: input.wheelSpinningCalibration,
    transitionRules: input.transitionRules ?? PEDAGOGY_TRANSITION_RULES,
  });
}

export const PENDING_WHEEL_CALIBRATION: WheelSpinningCalibrationBinding = deepFreeze({
  parameterId: 'CAL-10',
  registryAlias: 'CAL-WHEEL',
  status: 'pending',
});

export const PEDAGOGY_POLICY_V1_PENDING_CALIBRATION = deepFreeze(
  createPedagogyPolicyDefinition({
    policyVersion: 'pedagogy-policy-v1-pending-cal-10',
    purpose: 'material',
    wheelSpinningCalibration: PENDING_WHEEL_CALIBRATION,
  }),
);

export type PedagogyPolicyErrorCode =
  | 'AMBIGUOUS_TRANSITION_TABLE'
  | 'CALIBRATION_REQUIRED'
  | 'INVALID_CONTEXT'
  | 'INVALID_POLICY'
  | 'INVALID_SPECIAL_AUTHORIZATION'
  | 'MATERIAL_FREEZE_REQUIRED'
  | 'NO_TRANSITION'
  | 'POLICY_HASH_MISMATCH'
  | 'RUN_NOT_BOUND'
  | 'RUN_POLICY_DRIFT'
  | 'TEST_FIXTURE_FORBIDDEN';

export class PedagogyPolicyError extends Error {
  constructor(
    readonly code: PedagogyPolicyErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function canonicalJson(value: unknown, seen = new Set<object>()): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new PedagogyPolicyError('INVALID_POLICY', 'la política contiene un número no finito');
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value !== 'object') {
    throw new PedagogyPolicyError('INVALID_POLICY', 'la política debe ser JSON serializable');
  }
  if (seen.has(value)) {
    throw new PedagogyPolicyError('INVALID_POLICY', 'la política contiene una referencia circular');
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => canonicalJson(entry, seen)).join(',')}]`;
    }
    const record = value as Record<string, unknown>;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new PedagogyPolicyError('INVALID_POLICY', 'la política solo admite objetos JSON planos');
    }
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key], seen)}`)
      .join(',')}}`;
  } finally {
    seen.delete(value);
  }
}

function sha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

function assertSameBasePatterns(patterns: readonly BasePattern[]): void {
  if (canonicalJson(patterns) !== canonicalJson(PEDAGOGY_BASE_PATTERNS)) {
    throw new PedagogyPolicyError(
      'INVALID_POLICY',
      'los cinco patrones base y su orden deben permanecer literales; una variante exige nueva norma',
    );
  }
}

function assertPatternCoverage(definition: PedagogyPolicyDefinition): void {
  const missing: string[] = [];
  for (const pattern of definition.basePatterns) {
    for (const step of pattern.steps) {
      if (step.kind === 'engine_action') continue;
      const covered = definition.transitionRules.some((rule) => {
        const positions = rule.conditions.patternPositions;
        const positionMatches =
          positions.length === 0 ||
          positions.some((position) =>
            position.patternId === pattern.patternId && position.stepId === step.stepId,
          );
        if (!positionMatches) return false;
        if (step.kind === 'strategy') {
          return rule.effect.kind === 'decision' && rule.effect.strategy === step.strategy;
        }
        if (step.kind === 'fading') return rule.effect.kind === 'fading';
        return rule.effect.kind === 'decision' && rule.effect.correctiveFeedbackRequired;
      });
      if (!covered) missing.push(`${pattern.patternId}:${step.stepId}`);
    }
  }
  if (missing.length > 0) {
    throw new PedagogyPolicyError(
      'INVALID_POLICY',
      `la tabla no puede representar pasos base: ${missing.join(', ')}`,
    );
  }
}

function assertPolicySemantics(definition: PedagogyPolicyDefinition): void {
  assertSameBasePatterns(definition.basePatterns);
  if (definition.purpose === 'material' && definition.wheelSpinningCalibration.status === 'test_fixture') {
    throw new PedagogyPolicyError(
      'TEST_FIXTURE_FORBIDDEN',
      'una calibración test_fixture no puede autorizar una política material',
    );
  }
  if (definition.purpose === 'test_fixture' && definition.wheelSpinningCalibration.status === 'material') {
    throw new PedagogyPolicyError(
      'INVALID_POLICY',
      'una política test_fixture no debe etiquetar su calibración como evidencia material',
    );
  }

  const ruleIds = new Set<string>();
  const priorities = new Set<string>();
  let measurementGuard = false;
  for (const rule of definition.transitionRules) {
    if (ruleIds.has(rule.ruleId)) {
      throw new PedagogyPolicyError('INVALID_POLICY', `ruleId duplicado: ${rule.ruleId}`);
    }
    ruleIds.add(rule.ruleId);
    const priorityKey = `${rule.hierarchyLevel}:${rule.priority}`;
    if (priorities.has(priorityKey)) {
      throw new PedagogyPolicyError(
        'AMBIGUOUS_TRANSITION_TABLE',
        `prioridad ambigua en nivel ${rule.hierarchyLevel}: ${rule.priority}`,
      );
    }
    priorities.add(priorityKey);

    if (rule.hierarchyLevel === 5) {
      throw new PedagogyPolicyError(
        'INVALID_POLICY',
        `la regla ${rule.ruleId} intenta decidir en nivel 5; ahí solo cabe adaptar lenguaje/visual dentro de la estrategia ya elegida`,
      );
    }
    if (rule.conditions.modes.includes('MEASUREMENT_MODE')) {
      if (rule.hierarchyLevel !== 1 || rule.effect.kind !== 'suppress') {
        throw new PedagogyPolicyError(
          'INVALID_POLICY',
          `la regla ${rule.ruleId} activaría pedagogía en MEASUREMENT_MODE`,
        );
      }
      measurementGuard = true;
    }
    if (rule.effect.kind === 'suppress' && rule.hierarchyLevel !== 1) {
      throw new PedagogyPolicyError(
        'INVALID_POLICY',
        `la supresión ${rule.ruleId} debe pertenecer al nivel 1 de la jerarquía`,
      );
    }
  }
  if (!measurementGuard) {
    throw new PedagogyPolicyError(
      'INVALID_POLICY',
      'la tabla no tiene guarda de MEASUREMENT_MODE en el nivel 1',
    );
  }

  const representedStrategies = new Set(
    definition.transitionRules.flatMap((rule) =>
      rule.effect.kind === 'decision' ? [rule.effect.strategy] : [],
    ),
  );
  const missingStrategies = PedagogicalStrategy.options.filter(
    (strategy) => !representedStrategies.has(strategy),
  );
  if (missingStrategies.length > 0) {
    throw new PedagogyPolicyError(
      'INVALID_POLICY',
      `faltan estrategias literales del contrato: ${missingStrategies.join(', ')}`,
    );
  }
  assertPatternCoverage(definition);
}

export interface CompiledPedagogyPolicy {
  readonly definition: PedagogyPolicyDefinition;
  readonly policyHash: string;
}

/** Valida semántica, calcula hash canónico y congela recursivamente la tabla. */
export function compilePedagogyPolicy(
  value: unknown,
  expectedHash?: string,
): CompiledPedagogyPolicy {
  const parsed = PedagogyPolicyDefinition.safeParse(value);
  if (!parsed.success) {
    throw new PedagogyPolicyError('INVALID_POLICY', z.prettifyError(parsed.error));
  }
  assertPolicySemantics(parsed.data);
  const policyHash = sha256(parsed.data);
  if (expectedHash !== undefined && policyHash !== expectedHash) {
    throw new PedagogyPolicyError(
      'POLICY_HASH_MISMATCH',
      `hash de política inválido: esperado ${expectedHash}, calculado ${policyHash}`,
    );
  }
  return deepFreeze({ definition: deepFreeze(parsed.data), policyHash });
}

const RunPolicyBinding = z
  .object({
    runId: Id,
    purpose: PolicyPurpose,
    policyVersion: NonEmptyText,
    policyHash: Sha256Hex,
  })
  .strict();
export type RunPolicyBinding = z.infer<typeof RunPolicyBinding>;

/** Registro append-only en memoria; la persistencia del freeze conserva el mismo par versión/hash. */
export class PedagogyPolicyRunRegistry {
  readonly #bindings = new Map<string, RunPolicyBinding>();

  constructor(restoredBindings: readonly unknown[] = []) {
    for (const value of restoredBindings) {
      const parsed = RunPolicyBinding.safeParse(value);
      if (!parsed.success) {
        throw new PedagogyPolicyError('INVALID_POLICY', z.prettifyError(parsed.error));
      }
      const current = this.#bindings.get(parsed.data.runId);
      if (current !== undefined && canonicalJson(current) !== canonicalJson(parsed.data)) {
        throw new PedagogyPolicyError(
          'RUN_POLICY_DRIFT',
          `la persistencia contiene dos políticas para la corrida ${parsed.data.runId}`,
        );
      }
      this.#bindings.set(parsed.data.runId, deepFreeze(parsed.data));
    }
  }

  bind(compiled: CompiledPedagogyPolicy, value: unknown): RunPolicyBinding {
    const parsed = RunPolicyBinding.safeParse(value);
    if (!parsed.success) {
      throw new PedagogyPolicyError('INVALID_POLICY', z.prettifyError(parsed.error));
    }
    const binding = parsed.data;
    if (
      binding.policyVersion !== compiled.definition.policyVersion ||
      binding.policyHash !== compiled.policyHash ||
      binding.purpose !== compiled.definition.purpose
    ) {
      throw new PedagogyPolicyError(
        'RUN_POLICY_DRIFT',
        'la identidad declarada por la corrida no coincide con la política compilada',
      );
    }
    if (
      binding.purpose === 'material' &&
      compiled.definition.wheelSpinningCalibration.status === 'test_fixture'
    ) {
      throw new PedagogyPolicyError(
        'TEST_FIXTURE_FORBIDDEN',
        'una corrida material no puede enlazar una calibración test_fixture',
      );
    }
    const current = this.#bindings.get(binding.runId);
    if (current !== undefined && canonicalJson(current) !== canonicalJson(binding)) {
      throw new PedagogyPolicyError(
        'RUN_POLICY_DRIFT',
        `la corrida ${binding.runId} ya está congelada con otra versión/hash`,
      );
    }
    if (current !== undefined) return current;
    const frozen = deepFreeze(binding);
    this.#bindings.set(binding.runId, frozen);
    return frozen;
  }

  assertBound(runId: string, compiled: CompiledPedagogyPolicy): RunPolicyBinding {
    const binding = this.#bindings.get(runId);
    if (binding === undefined) {
      throw new PedagogyPolicyError('RUN_NOT_BOUND', `la corrida ${runId} no tiene política congelada`);
    }
    if (
      binding.policyVersion !== compiled.definition.policyVersion ||
      binding.policyHash !== compiled.policyHash ||
      binding.purpose !== compiled.definition.purpose
    ) {
      throw new PedagogyPolicyError(
        'RUN_POLICY_DRIFT',
        `la corrida ${runId} no está enlazada a esta política`,
      );
    }
    return binding;
  }

  bindingFor(runId: string): RunPolicyBinding | undefined {
    return this.#bindings.get(runId);
  }

  bindings(): readonly RunPolicyBinding[] {
    return deepFreeze([...this.#bindings.values()]);
  }
}

const Observations = z
  .object({
    securityBlocked: z.boolean(),
    integrityBlocked: z.boolean(),
    noRevelationRisk: z.boolean(),
    blockingPrerequisite: z.boolean(),
    masteryRecoveryRequired: z.boolean(),
    partialDifficulty: z.boolean(),
    repeatedSameError: z.boolean(),
    helpDependence: z.boolean(),
  })
  .strict();

const MasteryEligibilityAuthorization = z
  .object({
    authority: z.literal('domain_engine'),
    eligible: z.boolean(),
    reasonCode: NonEmptyText,
  })
  .strict();

const RetrievalRequest = z.discriminatedUnion('requested', [
  z.object({ requested: z.literal(false) }).strict(),
  z
    .object({
      requested: z.literal(true),
      authority: z.enum(['engine_calendar', 'caller', 'model']),
      due: z.boolean(),
      kcIntroduced: z.boolean(),
      reserveKind: z.enum(['practice', 'measurement']),
    })
    .strict(),
]);

const PreRegistrationEvidence = z
  .object({
    artifactId: Id,
    version: NonEmptyText,
    hash: Sha256Hex,
    expresslyValidated: z.boolean(),
  })
  .strict();
const FadingRequest = z.discriminatedUnion('requested', [
  z.object({ requested: z.literal(false) }).strict(),
  z
    .object({
      requested: z.literal(true),
      trigger: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('performance'), performanceImproved: z.boolean() }).strict(),
        z.object({ kind: z.literal('fixed'), preRegistration: PreRegistrationEvidence }).strict(),
      ]),
    })
    .strict(),
]);

const WheelAttempt = z
  .object({
    attemptId: Id,
    sequenceNumber: z.number().int().positive(),
    kcId: Id,
    eligible: z.boolean(),
    correct: z.boolean(),
  })
  .strict();
const WheelDiagnosticReview = z
  .object({
    practiceGranularityExamined: z.boolean(),
    strategyExamined: z.boolean(),
    assistanceLevelExamined: z.boolean(),
    persistentErrorExamined: z.boolean(),
    prerequisitesExamined: z.boolean(),
  })
  .strict();
const WheelEvaluationRequest = z.discriminatedUnion('requested', [
  z.object({ requested: z.literal(false) }).strict(),
  z
    .object({
      requested: z.literal(true),
      attempts: z.array(WheelAttempt),
      diagnosticReview: WheelDiagnosticReview,
    })
    .strict(),
]);

export const PedagogyDecisionContext = z
  .object({
    runId: Id,
    mode: PedagogicalMode,
    kcId: Id,
    kcType: KcType,
    currentStrategy: PedagogicalStrategy.nullable(),
    currentAssistanceLevel: z.number().int().min(0).max(5),
    masteryEligibility: MasteryEligibilityAuthorization,
    patternPosition: PatternPosition.nullable(),
    observations: Observations,
    selfExplanationTrigger: SelfExplanationTrigger.nullable(),
    retrieval: RetrievalRequest,
    fading: FadingRequest,
    wheelSpinning: WheelEvaluationRequest,
  })
  .strict();
export type PedagogyDecisionContext = z.infer<typeof PedagogyDecisionContext>;

export interface WheelSpinningDetection {
  readonly active: boolean;
  readonly reasonCode:
    | 'WHEEL_THRESHOLD_NOT_MET'
    | 'WHEEL_REVIEW_INCOMPLETE'
    | 'WHEEL_SPINNING_DETECTED';
  readonly eligibleAttemptsInWindow: number;
  readonly unsuccessfulEligibleAttempts: number;
  readonly calibrationVersion: string;
  readonly calibrationArtifactHash: string;
  readonly evidenceStatus: 'material' | 'test_fixture';
}

function detectWheelSpinning(
  kcId: string,
  request: Extract<z.infer<typeof WheelEvaluationRequest>, { requested: true }>,
  calibration: Exclude<WheelSpinningCalibrationBinding, { status: 'pending' }>,
): WheelSpinningDetection {
  const seenAttempts = new Set<string>();
  const seenSequences = new Set<number>();
  for (const attempt of request.attempts) {
    if (seenAttempts.has(attempt.attemptId) || seenSequences.has(attempt.sequenceNumber)) {
      throw new PedagogyPolicyError(
        'INVALID_CONTEXT',
        'la ventana de wheel_spinning contiene id o secuencia de intento duplicados',
      );
    }
    seenAttempts.add(attempt.attemptId);
    seenSequences.add(attempt.sequenceNumber);
  }
  const eligible = request.attempts
    .filter((attempt) => attempt.kcId === kcId && attempt.eligible)
    .sort((left, right) => left.sequenceNumber - right.sequenceNumber)
    .slice(-calibration.threshold.eligibleAttemptWindow);
  const unsuccessful = eligible.filter((attempt) => !attempt.correct).length;
  const thresholdMet = unsuccessful >= calibration.threshold.minimumUnsuccessfulEligibleAttempts;
  const reviewComplete = Object.values(request.diagnosticReview).every(Boolean);
  const active = thresholdMet && reviewComplete;
  return deepFreeze({
    active,
    reasonCode: active
      ? 'WHEEL_SPINNING_DETECTED'
      : thresholdMet
        ? 'WHEEL_REVIEW_INCOMPLETE'
        : 'WHEEL_THRESHOLD_NOT_MET',
    eligibleAttemptsInWindow: eligible.length,
    unsuccessfulEligibleAttempts: unsuccessful,
    calibrationVersion: calibration.calibrationVersion,
    calibrationArtifactHash: calibration.artifactHash,
    evidenceStatus: calibration.status,
  });
}

function observationSignals(
  context: PedagogyDecisionContext,
): Set<PedagogyObservableSignal> {
  const signals = new Set<PedagogyObservableSignal>();
  const observations: readonly [keyof typeof context.observations, PedagogyObservableSignal][] = [
    ['securityBlocked', 'security_block'],
    ['integrityBlocked', 'integrity_block'],
    ['noRevelationRisk', 'no_revelation_risk'],
    ['blockingPrerequisite', 'blocking_prerequisite'],
    ['masteryRecoveryRequired', 'mastery_recovery_required'],
    ['partialDifficulty', 'partial_difficulty'],
    ['repeatedSameError', 'repeated_same_error'],
    ['helpDependence', 'help_dependence'],
  ];
  for (const [field, signal] of observations) {
    if (context.observations[field]) signals.add(signal);
  }
  return signals;
}

function addLevelFourSignals(
  context: PedagogyDecisionContext,
  signals: Set<PedagogyObservableSignal>,
): void {
  if (context.selfExplanationTrigger === 'after_correct_nontrivial_step') {
    signals.add('self_explanation_correct_nontrivial');
  } else if (context.selfExplanationTrigger === 'after_persistent_error') {
    signals.add('self_explanation_persistent_error');
  } else if (context.selfExplanationTrigger === 'distinguish_understanding_from_memorization') {
    signals.add('self_explanation_understanding_probe');
  }

  if (context.retrieval.requested) {
    if (
      context.retrieval.authority !== 'engine_calendar' ||
      !context.retrieval.due ||
      !context.retrieval.kcIntroduced ||
      context.retrieval.reserveKind !== 'practice'
    ) {
      throw new PedagogyPolicyError(
        'INVALID_SPECIAL_AUTHORIZATION',
        'retrieval/spacing exige motor-calendario, KC ya introducido, vencimiento y reserva de práctica',
      );
    }
    signals.add('retrieval_due_by_engine_calendar');
  }

  if (context.fading.requested) {
    const authorized = context.fading.trigger.kind === 'performance'
      ? context.fading.trigger.performanceImproved
      : context.fading.trigger.preRegistration.expresslyValidated;
    if (!authorized) {
      throw new PedagogyPolicyError(
        'INVALID_SPECIAL_AUTHORIZATION',
        'fading exige desempeño observado o regla fija preinscrita y validada expresamente',
      );
    }
    signals.add('fading_authorized');
  }
}

function evaluateWheelSpinningSignal(
  context: PedagogyDecisionContext,
  definition: PedagogyPolicyDefinition,
  signals: Set<PedagogyObservableSignal>,
): WheelSpinningDetection | null {
  if (context.wheelSpinning.requested) {
    const calibration = definition.wheelSpinningCalibration;
    if (calibration.status === 'pending') {
      throw new PedagogyPolicyError(
        'CALIBRATION_REQUIRED',
        'CAL-10/CAL-WHEEL está pendiente; no existe umbral material que autorice wheel_spinning',
      );
    }
    const wheel = detectWheelSpinning(context.kcId, context.wheelSpinning, calibration);
    if (wheel.active) signals.add('wheel_spinning');
    return wheel;
  }
  return null;
}

function ruleMatches(
  rule: PedagogyTransitionRule,
  context: PedagogyDecisionContext,
  signals: ReadonlySet<PedagogyObservableSignal>,
): boolean {
  if (!rule.conditions.modes.includes(context.mode)) return false;
  if (
    rule.conditions.kcTypes.length > 0 &&
    !rule.conditions.kcTypes.includes(context.kcType)
  ) return false;
  if (!rule.conditions.requiredSignals.every((signal) => signals.has(signal))) return false;
  if (rule.conditions.patternPositions.length === 0) return true;
  if (context.patternPosition === null) return false;
  return rule.conditions.patternPositions.some(
    (position) =>
      position.patternId === context.patternPosition?.patternId &&
      position.stepId === context.patternPosition.stepId,
  );
}

interface OutcomeMetadata {
  readonly ruleId: string;
  readonly hierarchyLevel: number;
  readonly policyVersion: string;
  readonly policyHash: string;
  readonly transitionTableVersion: string;
  readonly wheelSpinning: WheelSpinningDetection | null;
  readonly masteryEligibilityReasonCode: string;
}

export interface PedagogyDecisionOutcome extends OutcomeMetadata {
  readonly kind: 'decision';
  readonly policyAction: 'select_strategy' | 'fading';
  readonly decision: PedagogicalDecisionValue;
  readonly correctiveFeedbackRequired: boolean;
}

export interface PedagogySuppressedOutcome extends OutcomeMetadata {
  readonly kind: 'suppressed';
  readonly mode: z.infer<typeof PedagogicalMode>;
  readonly reasonCode: string;
}

export type PedagogyPolicyOutcome = PedagogyDecisionOutcome | PedagogySuppressedOutcome;

/** Motor determinista. El orden efectivo es nivel de jerarquía y luego prioridad. */
export class DeterministicPedagogyPolicy {
  readonly compiled: CompiledPedagogyPolicy;
  readonly registry: PedagogyPolicyRunRegistry;

  constructor(
    definition: unknown,
    options: { readonly expectedHash?: string; readonly registry?: PedagogyPolicyRunRegistry } = {},
  ) {
    this.compiled = compilePedagogyPolicy(definition, options.expectedHash);
    if (this.compiled.definition.purpose === 'material' && options.expectedHash === undefined) {
      throw new PedagogyPolicyError(
        'MATERIAL_FREEZE_REQUIRED',
        'una política material exige el hash esperado aportado por el paquete congelado',
      );
    }
    this.registry = options.registry ?? new PedagogyPolicyRunRegistry();
  }

  bindRun(value: unknown): RunPolicyBinding {
    return this.registry.bind(this.compiled, value);
  }

  decide(value: unknown): PedagogyPolicyOutcome {
    const parsed = PedagogyDecisionContext.safeParse(value);
    if (!parsed.success) {
      throw new PedagogyPolicyError('INVALID_CONTEXT', z.prettifyError(parsed.error));
    }
    const context = parsed.data;
    this.registry.assertBound(context.runId, this.compiled);

    // La evaluación también respeta la jerarquía: no se valida retrieval/fading
    // si seguridad o un prerrequisito ya resolvieron la ruta.
    const signals = observationSignals(context);
    let wheel: WheelSpinningDetection | null = null;
    const firstAtLevel = (level: number): PedagogyTransitionRule | undefined =>
      this.compiled.definition.transitionRules
        .filter(
          (rule) =>
            rule.hierarchyLevel === level && ruleMatches(rule, context, signals),
        )
        .sort((left, right) => left.priority - right.priority)[0];

    let selected = firstAtLevel(1);
    if (selected === undefined) selected = firstAtLevel(2);
    if (selected === undefined) {
      wheel = evaluateWheelSpinningSignal(context, this.compiled.definition, signals);
      selected = firstAtLevel(3);
    }
    if (selected === undefined) {
      addLevelFourSignals(context, signals);
      selected = firstAtLevel(4);
    }
    if (selected === undefined) {
      throw new PedagogyPolicyError(
        'NO_TRANSITION',
        'ninguna transición congelada corresponde al estado observable',
      );
    }
    const metadata: OutcomeMetadata = {
      ruleId: selected.ruleId,
      hierarchyLevel: selected.hierarchyLevel,
      policyVersion: this.compiled.definition.policyVersion,
      policyHash: this.compiled.policyHash,
      transitionTableVersion: this.compiled.definition.transitionTableVersion,
      wheelSpinning: wheel,
      masteryEligibilityReasonCode: context.masteryEligibility.reasonCode,
    };
    if (selected.effect.kind === 'suppress') {
      return deepFreeze({
        ...metadata,
        kind: 'suppressed',
        mode: context.mode,
        reasonCode: selected.effect.reasonCode,
      });
    }

    let decision: PedagogicalDecisionValue;
    let policyAction: 'select_strategy' | 'fading';
    let correctiveFeedbackRequired: boolean;
    if (selected.effect.kind === 'fading') {
      if (
        !context.fading.requested ||
        context.currentStrategy === null ||
        context.currentAssistanceLevel === 0
      ) {
        throw new PedagogyPolicyError(
          'INVALID_SPECIAL_AUTHORIZATION',
          'fading exige solicitud autorizada, estrategia vigente y ayuda que todavía pueda retirarse',
        );
      }
      const assistanceLevel = Math.max(
        0,
        context.currentAssistanceLevel - selected.effect.assistanceDecrease,
      );
      decision = PedagogicalDecision.parse({
        mode: context.mode,
        strategy: context.currentStrategy,
        assistanceLevel,
        masteryEligible:
          selected.effect.masteryEligibleWhenUnassisted &&
          assistanceLevel === 0 &&
          context.masteryEligibility.eligible,
        reasonCode: selected.effect.reasonCode,
      });
      policyAction = 'fading';
      correctiveFeedbackRequired = false;
    } else {
      decision = PedagogicalDecision.parse({
        mode: context.mode,
        strategy: selected.effect.strategy,
        assistanceLevel: selected.effect.assistanceLevel,
        masteryEligible:
          selected.effect.masteryEligible && context.masteryEligibility.eligible,
        reasonCode: selected.effect.reasonCode,
      });
      policyAction = 'select_strategy';
      correctiveFeedbackRequired = selected.effect.correctiveFeedbackRequired;
    }
    return deepFreeze({
      ...metadata,
      kind: 'decision',
      policyAction,
      decision,
      correctiveFeedbackRequired,
    });
  }
}

/** Ayuda explícita para freezes: nunca toma la identidad de un prompt o modelo. */
export function pedagogyPolicyIdentity(compiled: CompiledPedagogyPolicy): Readonly<{
  artifactId: 'pedagogy-policy';
  version: string;
  hash: string;
}> {
  return deepFreeze({
    artifactId: 'pedagogy-policy',
    version: compiled.definition.policyVersion,
    hash: compiled.policyHash,
  });
}

/** Lista literal para pruebas de cobertura sin aceptar alias. */
export function representedDecisionStrategies(
  definition: PedagogyPolicyDefinition,
): readonly PedagogicalStrategyValue[] {
  return deepFreeze(
    [...new Set(
      definition.transitionRules.flatMap((rule) =>
        rule.effect.kind === 'decision' ? [rule.effect.strategy] : [],
      ),
    )].sort(),
  );
}
