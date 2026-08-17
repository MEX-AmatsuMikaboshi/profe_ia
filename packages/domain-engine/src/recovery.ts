import { createHash } from 'node:crypto';
import {
  Id,
  IsoDateTime,
  PedagogicalMode,
  Sha256Hex,
  type PedagogicalStrategy,
} from '@profesor-ia/contracts';
import { z } from 'zod';

/** T-H6-04 — recuperación y límite pedagógico de P-I §8.7. */
export const RECOVERY_POLICY_SCHEMA_VERSION = 'recovery-policy-v1' as const;
export const RECOVERY_STATE_SCHEMA_VERSION = 'recovery-state-v1' as const;
export const RECOVERY_GRAPH_SCHEMA_VERSION = 'recovery-dependency-graph-v1' as const;
export const RECOVERY_POLICY_VERSION = 'recovery-policy-v1-three-plus-two' as const;

const NonEmptyText = z.string().trim().min(1).max(500);
const Purpose = z.enum(['material', 'test_fixture']);
const CycleNumber = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const LaterEpisodeNumber = z.union([z.literal(1), z.literal(2)]);
const RecoveryOutcome = z.enum(['progress_observed', 'failed']);

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (typeof value !== 'object' || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

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

function canonicalJson(value: unknown, seen = new Set<object>()): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RecoveryEngineError('INVALID_RECOVERY_POLICY', 'número no finito');
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value !== 'object') {
    throw new RecoveryEngineError('INVALID_RECOVERY_POLICY', 'valor no serializable');
  }
  if (seen.has(value)) {
    throw new RecoveryEngineError('INVALID_RECOVERY_POLICY', 'referencia circular');
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => canonicalJson(entry, seen)).join(',')}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new RecoveryEngineError('INVALID_RECOVERY_POLICY', 'solo se admiten objetos JSON planos');
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key], seen)}`)
      .join(',')}}`;
  } finally {
    seen.delete(value);
  }
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

const CycleOneDefinition = z
  .object({
    cycle: z.literal(1),
    actions: z.tuple([
      z.literal('specific_error_feedback'),
      z.literal('new_explanation_or_worked_example'),
      z.literal('guided_practice'),
    ]),
  })
  .strict();
const CycleTwoDefinition = z
  .object({
    cycle: z.literal(2),
    actions: z.tuple([
      z.literal('reduced_complexity'),
      z.literal('prerequisite_review_or_remediation'),
      z.literal('contingent_scaffolding'),
    ]),
  })
  .strict();
const CycleThreeDefinition = z
  .object({
    cycle: z.literal(3),
    actions: z.tuple([
      z.literal('alternative_representation'),
      z.literal('selective_guided_self_explanation'),
      z.literal('understanding_check'),
    ]),
  })
  .strict();

export const RecoveryPolicyDefinition = z
  .object({
    schemaVersion: z.literal(RECOVERY_POLICY_SCHEMA_VERSION),
    policyVersion: NonEmptyText,
    purpose: Purpose,
    inBlockCycles: z.tuple([
      CycleOneDefinition,
      CycleTwoDefinition,
      CycleThreeDefinition,
    ]),
    laterRecovery: z
      .object({
        maxEpisodesPerKc: z.literal(2),
        counterScope: z.literal('kc'),
        requiredReserve: z.literal('recovery'),
        requireDifferentMaterialFromFailure: z.literal(true),
        reevaluateSameKc: z.literal(true),
      })
      .strict(),
    closeBlockingDependentRoutes: z.literal(true),
    humanPedagogicalRescue: z.literal(false),
    parameterInterpretation: z.literal('operational_frozen_not_scientific_optimum'),
  })
  .strict();
export type RecoveryPolicyDefinition = z.infer<typeof RecoveryPolicyDefinition>;

export function createRecoveryPolicyDefinition(
  input: Readonly<{ policyVersion: string; purpose: z.infer<typeof Purpose> }>,
): RecoveryPolicyDefinition {
  return RecoveryPolicyDefinition.parse({
    schemaVersion: RECOVERY_POLICY_SCHEMA_VERSION,
    policyVersion: input.policyVersion,
    purpose: input.purpose,
    inBlockCycles: [
      {
        cycle: 1,
        actions: [
          'specific_error_feedback',
          'new_explanation_or_worked_example',
          'guided_practice',
        ],
      },
      {
        cycle: 2,
        actions: [
          'reduced_complexity',
          'prerequisite_review_or_remediation',
          'contingent_scaffolding',
        ],
      },
      {
        cycle: 3,
        actions: [
          'alternative_representation',
          'selective_guided_self_explanation',
          'understanding_check',
        ],
      },
    ],
    laterRecovery: {
      maxEpisodesPerKc: 2,
      counterScope: 'kc',
      requiredReserve: 'recovery',
      requireDifferentMaterialFromFailure: true,
      reevaluateSameKc: true,
    },
    closeBlockingDependentRoutes: true,
    humanPedagogicalRescue: false,
    parameterInterpretation: 'operational_frozen_not_scientific_optimum',
  });
}

export const RECOVERY_POLICY_V1 = deepFreeze(
  createRecoveryPolicyDefinition({
    policyVersion: RECOVERY_POLICY_VERSION,
    purpose: 'material',
  }),
);

export type RecoveryEngineErrorCode =
  | 'DEPENDENCY_GRAPH_DRIFT'
  | 'INVALID_DEPENDENCY_GRAPH'
  | 'INVALID_EVENT_SEQUENCE'
  | 'INVALID_RECOVERY_EVENT'
  | 'INVALID_RECOVERY_POLICY'
  | 'MATERIAL_FREEZE_REQUIRED'
  | 'RECOVERY_ORDER_VIOLATION'
  | 'RECOVERY_RESERVE_VIOLATION'
  | 'RUN_NOT_BOUND'
  | 'RUN_POLICY_DRIFT';

export class RecoveryEngineError extends Error {
  constructor(
    readonly code: RecoveryEngineErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface CompiledRecoveryPolicy {
  readonly definition: RecoveryPolicyDefinition;
  readonly policyHash: string;
}

export function compileRecoveryPolicy(value: unknown, expectedHash?: string): CompiledRecoveryPolicy {
  const parsed = RecoveryPolicyDefinition.safeParse(value);
  if (!parsed.success) {
    throw new RecoveryEngineError('INVALID_RECOVERY_POLICY', z.prettifyError(parsed.error));
  }
  const policyHash = hashJson(parsed.data);
  if (expectedHash !== undefined && policyHash !== expectedHash) {
    throw new RecoveryEngineError(
      'RUN_POLICY_DRIFT',
      `hash de política inválido: esperado ${expectedHash}, calculado ${policyHash}`,
    );
  }
  return deepFreeze({ definition: deepFreeze(parsed.data), policyHash });
}

export const RecoveryDependencyType = z.enum([
  'FORMAL',
  'POLITICA_CONTENIDO',
  'PEDAGOGICA',
  'CONCEPTUAL_ANALOGICA',
  'ESTADISTICA',
]);
export type RecoveryDependencyType = z.infer<typeof RecoveryDependencyType>;

/** C/A es útil y E nunca altera la corrida; las otras tres sí ordenan/bloquean ruta. */
export function dependencyBlocksRecoveryRoute(type: RecoveryDependencyType): boolean {
  return type === 'FORMAL' || type === 'POLITICA_CONTENIDO' || type === 'PEDAGOGICA';
}

export const RecoveryDependencyEdge = z
  .object({
    dependentKcId: Id,
    prerequisiteKcId: Id,
    dependencyType: RecoveryDependencyType,
    blocksRoute: z.boolean(),
  })
  .strict()
  .superRefine((edge, context) => {
    if (edge.dependentKcId === edge.prerequisiteKcId) {
      context.addIssue({ code: 'custom', message: 'una dependencia no puede ser reflexiva' });
    }
    if (edge.blocksRoute !== dependencyBlocksRecoveryRoute(edge.dependencyType)) {
      context.addIssue({
        code: 'custom',
        message: 'blocksRoute debe derivarse del tipo de dependencia congelado',
        path: ['blocksRoute'],
      });
    }
  });
export type RecoveryDependencyEdge = z.infer<typeof RecoveryDependencyEdge>;

export const RecoveryDependencyGraph = z
  .object({
    schemaVersion: z.literal(RECOVERY_GRAPH_SCHEMA_VERSION),
    graphVersion: NonEmptyText,
    purpose: Purpose,
    kcIds: uniqueArray(Id, 'kcIds').min(1),
    edges: uniqueArray(RecoveryDependencyEdge, 'edges'),
  })
  .strict()
  .superRefine((graph, context) => {
    const ids = new Set(graph.kcIds);
    for (const [index, edge] of graph.edges.entries()) {
      if (!ids.has(edge.dependentKcId) || !ids.has(edge.prerequisiteKcId)) {
        context.addIssue({
          code: 'custom',
          message: 'toda arista debe referenciar KC declarados',
          path: ['edges', index],
        });
      }
    }
  });
export type RecoveryDependencyGraph = z.infer<typeof RecoveryDependencyGraph>;

export interface CompiledRecoveryDependencyGraph {
  readonly definition: RecoveryDependencyGraph;
  readonly graphHash: string;
}

function assertBlockingGraphAcyclic(graph: RecoveryDependencyGraph): void {
  const outgoing = new Map<string, string[]>();
  for (const kcId of graph.kcIds) outgoing.set(kcId, []);
  for (const edge of graph.edges) {
    if (edge.blocksRoute) outgoing.get(edge.dependentKcId)?.push(edge.prerequisiteKcId);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (kcId: string): void => {
    if (visiting.has(kcId)) {
      throw new RecoveryEngineError(
        'INVALID_DEPENDENCY_GRAPH',
        `el grafo bloqueante contiene un ciclo que pasa por ${kcId}`,
      );
    }
    if (visited.has(kcId)) return;
    visiting.add(kcId);
    for (const next of outgoing.get(kcId) ?? []) visit(next);
    visiting.delete(kcId);
    visited.add(kcId);
  };
  for (const kcId of [...graph.kcIds].sort()) visit(kcId);
}

export function compileRecoveryDependencyGraph(
  value: unknown,
  expectedHash?: string,
): CompiledRecoveryDependencyGraph {
  const parsed = RecoveryDependencyGraph.safeParse(value);
  if (!parsed.success) {
    throw new RecoveryEngineError('INVALID_DEPENDENCY_GRAPH', z.prettifyError(parsed.error));
  }
  assertBlockingGraphAcyclic(parsed.data);
  const graphHash = hashJson(parsed.data);
  if (expectedHash !== undefined && graphHash !== expectedHash) {
    throw new RecoveryEngineError(
      'DEPENDENCY_GRAPH_DRIFT',
      `hash de dependencias inválido: esperado ${expectedHash}, calculado ${graphHash}`,
    );
  }
  return deepFreeze({ definition: deepFreeze(parsed.data), graphHash });
}

const RecoveryRunBinding = z
  .object({
    runId: Id,
    purpose: Purpose,
    policyVersion: NonEmptyText,
    policyHash: Sha256Hex,
    dependencyGraphVersion: NonEmptyText,
    dependencyGraphHash: Sha256Hex,
    recoveryInventoryVersion: NonEmptyText,
    recoveryInventoryHash: Sha256Hex,
  })
  .strict();
export type RecoveryRunBinding = z.infer<typeof RecoveryRunBinding>;

export class RecoveryRunRegistry {
  readonly #bindings = new Map<string, RecoveryRunBinding>();

  constructor(restored: readonly unknown[] = []) {
    for (const value of restored) {
      const parsed = RecoveryRunBinding.safeParse(value);
      if (!parsed.success) {
        throw new RecoveryEngineError('INVALID_RECOVERY_POLICY', z.prettifyError(parsed.error));
      }
      const current = this.#bindings.get(parsed.data.runId);
      if (current !== undefined && canonicalJson(current) !== canonicalJson(parsed.data)) {
        throw new RecoveryEngineError('RUN_POLICY_DRIFT', `bindings distintos para ${parsed.data.runId}`);
      }
      this.#bindings.set(parsed.data.runId, deepFreeze(parsed.data));
    }
  }

  bind(
    policy: CompiledRecoveryPolicy,
    graph: CompiledRecoveryDependencyGraph,
    value: unknown,
  ): RecoveryRunBinding {
    const parsed = RecoveryRunBinding.safeParse(value);
    if (!parsed.success) {
      throw new RecoveryEngineError('INVALID_RECOVERY_POLICY', z.prettifyError(parsed.error));
    }
    const binding = parsed.data;
    if (
      binding.purpose !== policy.definition.purpose ||
      binding.purpose !== graph.definition.purpose ||
      binding.policyVersion !== policy.definition.policyVersion ||
      binding.policyHash !== policy.policyHash ||
      binding.dependencyGraphVersion !== graph.definition.graphVersion ||
      binding.dependencyGraphHash !== graph.graphHash
    ) {
      throw new RecoveryEngineError('RUN_POLICY_DRIFT', 'binding, política y grafo no coinciden');
    }
    const current = this.#bindings.get(binding.runId);
    if (current !== undefined && canonicalJson(current) !== canonicalJson(binding)) {
      throw new RecoveryEngineError('RUN_POLICY_DRIFT', `la corrida ${binding.runId} ya tiene otro binding`);
    }
    if (current !== undefined) return current;
    const frozen = deepFreeze(binding);
    this.#bindings.set(binding.runId, frozen);
    return frozen;
  }

  assertBound(
    runId: string,
    policy: CompiledRecoveryPolicy,
    graph: CompiledRecoveryDependencyGraph,
  ): RecoveryRunBinding {
    const binding = this.#bindings.get(runId);
    if (binding === undefined) {
      throw new RecoveryEngineError('RUN_NOT_BOUND', `la corrida ${runId} no tiene política de recuperación`);
    }
    if (
      binding.purpose !== policy.definition.purpose ||
      binding.purpose !== graph.definition.purpose ||
      binding.policyVersion !== policy.definition.policyVersion ||
      binding.policyHash !== policy.policyHash ||
      binding.dependencyGraphVersion !== graph.definition.graphVersion ||
      binding.dependencyGraphHash !== graph.graphHash
    ) {
      throw new RecoveryEngineError('RUN_POLICY_DRIFT', `la corrida ${runId} usa otro binding`);
    }
    return binding;
  }

  bindings(): readonly RecoveryRunBinding[] {
    return deepFreeze([...this.#bindings.values()]);
  }
}

const CycleOneEvidence = z
  .object({
    feedback: z.object({ errorCode: NonEmptyText, artifactId: Id }).strict(),
    explanation: z
      .object({ kind: z.enum(['new_explanation', 'worked_example']), artifactId: Id })
      .strict(),
    guidedPractice: z.object({ activityId: Id, itemId: Id }).strict(),
  })
  .strict();
const CycleTwoEvidence = z
  .object({
    complexity: z
      .object({ fromIndex: z.number().min(0).max(100), toIndex: z.number().min(0).max(100) })
      .strict()
      .refine((value) => value.toIndex < value.fromIndex, 'el segundo ciclo debe reducir complejidad'),
    prerequisite: z
      .object({
        kcIds: uniqueArray(Id, 'prerequisite.kcIds').min(1),
        action: z.enum(['review', 'remediation']),
        artifactId: Id,
      })
      .strict(),
    scaffolding: z
      .object({ activityId: Id, itemId: Id, contingentOnPerformance: z.literal(true) })
      .strict(),
  })
  .strict();
const SelectiveSelfExplanation = z.discriminatedUnion('applied', [
  z.object({ applied: z.literal(true), promptId: Id }).strict(),
  z.object({ applied: z.literal(false), reasonCode: NonEmptyText }).strict(),
]);
const CycleThreeEvidence = z
  .object({
    representation: z
      .object({ previousRepresentationId: Id, alternativeRepresentationId: Id, activityId: Id })
      .strict()
      .refine(
        (value) => value.previousRepresentationId !== value.alternativeRepresentationId,
        'el tercer ciclo exige representación alternativa',
      ),
    selfExplanation: SelectiveSelfExplanation,
    understandingCheck: z.object({ activityId: Id, itemId: Id }).strict(),
  })
  .strict();

const CycleCompletionPayload = z.discriminatedUnion('cycle', [
  z
    .object({
      kcId: Id,
      programId: Id,
      cycle: z.literal(1),
      outcome: RecoveryOutcome,
      evidence: CycleOneEvidence,
    })
    .strict(),
  z
    .object({
      kcId: Id,
      programId: Id,
      cycle: z.literal(2),
      outcome: RecoveryOutcome,
      evidence: CycleTwoEvidence,
    })
    .strict(),
  z
    .object({
      kcId: Id,
      programId: Id,
      cycle: z.literal(3),
      outcome: RecoveryOutcome,
      evidence: CycleThreeEvidence,
    })
    .strict(),
]);

const EventCommon = {
  eventId: Id,
  sequenceNumber: z.number().int().positive(),
  occurredAt: IsoDateTime,
};
const RecoveryInitializedEvent = z
  .object({
    eventId: Id,
    eventType: z.literal('recovery.initialized'),
    sequenceNumber: z.literal(0),
    occurredAt: IsoDateTime,
    payload: z.object({ runId: Id, participantPseudoId: Id }).strict(),
  })
  .strict();
const RecoveryInBlockStartedEvent = z
  .object({
    ...EventCommon,
    eventType: z.literal('recovery.in_block.started'),
    payload: z
      .object({
        kcId: Id,
        failureAttemptId: Id,
        failedItemId: Id,
        errorObservationId: Id,
        errorCode: NonEmptyText,
        failureAttribution: z.literal('PEDAGOGICAL'),
        mode: PedagogicalMode,
      })
      .strict(),
  })
  .strict();
const RecoveryCycleCompletedEvent = z
  .object({
    ...EventCommon,
    eventType: z.literal('recovery.in_block.cycle.completed'),
    payload: CycleCompletionPayload,
  })
  .strict();
const RecoveryOpportunityAvailableEvent = z
  .object({
    ...EventCommon,
    eventType: z.literal('recovery.later.opportunity.available'),
    payload: z
      .object({
        kcId: Id,
        programId: Id,
        episodeNumber: LaterEpisodeNumber,
        authority: z.literal('recovery_reserve_registry'),
        inventoryVersion: NonEmptyText,
        inventoryHash: Sha256Hex,
        mode: z.literal('LEARNING_MODE'),
        reserve: z.literal('recovery'),
        activityId: Id,
        itemId: Id,
      })
      .strict(),
  })
  .strict();
const RecoveryReserveUnavailableEvent = z
  .object({
    ...EventCommon,
    eventType: z.literal('recovery.later.reserve.unavailable'),
    payload: z
      .object({
        kcId: Id,
        programId: Id,
        authority: z.literal('recovery_reserve_registry'),
        inventoryVersion: NonEmptyText,
        inventoryHash: Sha256Hex,
        reason: z.enum(['reserve_exhausted', 'no_distinct_material']),
      })
      .strict(),
  })
  .strict();
const RecoveryEpisodeStartedEvent = z
  .object({
    ...EventCommon,
    eventType: z.literal('recovery.later.episode.started'),
    payload: z
      .object({
        kcId: Id,
        programId: Id,
        episodeNumber: LaterEpisodeNumber,
        mode: z.literal('LEARNING_MODE'),
        reserve: z.literal('recovery'),
        activityId: Id,
        itemId: Id,
      })
      .strict(),
  })
  .strict();
const RecoveryEpisodeCompletedEvent = z
  .object({
    ...EventCommon,
    eventType: z.literal('recovery.later.episode.completed'),
    payload: z
      .object({
        kcId: Id,
        reevaluatedKcId: Id,
        programId: Id,
        episodeNumber: LaterEpisodeNumber,
        activityId: Id,
        itemId: Id,
        outcome: RecoveryOutcome,
        domainEvaluationRequired: z.literal(true),
      })
      .strict(),
  })
  .strict();
const RecoveryClosedWithoutOutcomeEvent = z
  .object({
    ...EventCommon,
    eventType: z.literal('recovery.program.closed_without_pedagogical_outcome'),
    payload: z
      .object({
        kcId: Id,
        programId: Id,
        reason: z.enum([
          'withdrawal',
          'session_ended',
          'incident',
          'operational_unavailable',
          'interface_perception',
        ]),
      })
      .strict(),
  })
  .strict();

export const RecoveryEvent = z.discriminatedUnion('eventType', [
  RecoveryInitializedEvent,
  RecoveryInBlockStartedEvent,
  RecoveryCycleCompletedEvent,
  RecoveryOpportunityAvailableEvent,
  RecoveryReserveUnavailableEvent,
  RecoveryEpisodeStartedEvent,
  RecoveryEpisodeCompletedEvent,
  RecoveryClosedWithoutOutcomeEvent,
]);
export type RecoveryEvent = z.infer<typeof RecoveryEvent>;

const RecoveryCycleRecord = z
  .object({
    cycle: CycleNumber,
    outcome: RecoveryOutcome,
    evidenceHash: Sha256Hex,
    materialIds: uniqueArray(Id, 'cycle.materialIds').min(1),
    completedAt: IsoDateTime,
  })
  .strict();
const LaterRecoveryEpisode = z
  .object({
    episodeNumber: LaterEpisodeNumber,
    status: z.enum(['scheduled', 'active', 'failed', 'progress_observed']),
    activityId: Id,
    itemId: Id,
    inventoryVersion: NonEmptyText,
    inventoryHash: Sha256Hex,
    scheduledAt: IsoDateTime,
    startedAt: IsoDateTime.nullable(),
    completedAt: IsoDateTime.nullable(),
  })
  .strict()
  .superRefine((episode, context) => {
    if (episode.status === 'scheduled' && (episode.startedAt !== null || episode.completedAt !== null)) {
      context.addIssue({ code: 'custom', message: 'episodio programado no puede estar iniciado' });
    }
    if (episode.status === 'active' && (episode.startedAt === null || episode.completedAt !== null)) {
      context.addIssue({ code: 'custom', message: 'episodio activo exige inicio y no cierre' });
    }
    if (
      (episode.status === 'failed' || episode.status === 'progress_observed') &&
      (episode.startedAt === null || episode.completedAt === null)
    ) {
      context.addIssue({ code: 'custom', message: 'episodio terminal exige inicio y cierre' });
    }
  });

const RecoveryProgram = z
  .object({
    programId: Id,
    failureAttemptId: Id,
    failedItemId: Id,
    errorObservationId: Id,
    errorCode: NonEmptyText,
    startedAt: IsoDateTime,
    nextCycle: CycleNumber.nullable(),
    cycles: z.array(RecoveryCycleRecord).max(3),
    laterEpisodes: z.array(LaterRecoveryEpisode).max(2),
  })
  .strict()
  .superRefine((program, context) => {
    for (const [index, cycle] of program.cycles.entries()) {
      if (cycle.cycle !== index + 1) {
        context.addIssue({ code: 'custom', message: 'los ciclos deben conservar orden 1→2→3' });
      }
      if (index < program.cycles.length - 1 && cycle.outcome !== 'failed') {
        context.addIssue({ code: 'custom', message: 'solo un ciclo fallido permite avanzar al siguiente' });
      }
    }
    if (
      program.nextCycle !== null &&
      (program.nextCycle !== program.cycles.length + 1 || program.cycles.some((cycle) => cycle.outcome !== 'failed'))
    ) {
      context.addIssue({ code: 'custom', message: 'nextCycle no corresponde a la historia del programa' });
    }
    for (let index = 1; index < program.laterEpisodes.length; index += 1) {
      const previous = program.laterEpisodes[index - 1];
      const current = program.laterEpisodes[index];
      if (
        previous === undefined ||
        current === undefined ||
        current.episodeNumber <= previous.episodeNumber
      ) {
        context.addIssue({ code: 'custom', message: 'episodios posteriores fuera de orden' });
      }
    }
  });
type RecoveryProgram = z.infer<typeof RecoveryProgram>;

const TerminalProgramStatus = z.enum([
  'returned_to_domain_evaluation',
  'not_mastered_no_reserve',
  'not_mastered_recovery_cap_reached',
  'pedagogical_limit_observed',
  'incomplete_missing',
  'route_closed_dependency',
]);
const RecoveryProgramHistory = RecoveryProgram.extend({
  terminalStatus: TerminalProgramStatus,
  completedAt: IsoDateTime,
});

export const RecoveryKcStatus = z.enum([
  'idle',
  'in_block_active',
  'awaiting_later_recovery',
  'later_recovery_scheduled',
  'later_recovery_active',
  'returned_to_domain_evaluation',
  'not_mastered_no_reserve',
  'not_mastered_recovery_cap_reached',
  'pedagogical_limit_observed',
  'incomplete_missing',
  'route_closed_dependency',
]);
export type RecoveryKcStatus = z.infer<typeof RecoveryKcStatus>;

const RecoveryKcRecord = z
  .object({
    kcId: Id,
    status: RecoveryKcStatus,
    recoveryEpisodeCount: z.number().int().min(0).max(2),
    failedRecoveryEpisodeCount: z.number().int().min(0).max(2),
    currentProgram: RecoveryProgram.nullable(),
    programHistory: z.array(RecoveryProgramHistory),
    consumedMaterialIds: uniqueArray(Id, 'consumedMaterialIds'),
    pedagogicalLimitObservedAt: IsoDateTime.nullable(),
    closedByKcId: Id.nullable(),
    updatedAt: IsoDateTime.nullable(),
  })
  .strict()
  .superRefine((record, context) => {
    const active = [
      'in_block_active',
      'awaiting_later_recovery',
      'later_recovery_scheduled',
      'later_recovery_active',
    ].includes(record.status);
    if (active !== (record.currentProgram !== null)) {
      context.addIssue({ code: 'custom', message: 'estado activo y programa actual no coinciden' });
    }
    if (record.failedRecoveryEpisodeCount > record.recoveryEpisodeCount) {
      context.addIssue({ code: 'custom', message: 'fallos posteriores exceden episodios consumidos' });
    }
    if (
      record.status === 'pedagogical_limit_observed' &&
      (record.failedRecoveryEpisodeCount !== 2 || record.pedagogicalLimitObservedAt === null)
    ) {
      context.addIssue({ code: 'custom', message: 'límite exige dos episodios fallidos y fecha' });
    }
    if (record.status !== 'pedagogical_limit_observed' && record.pedagogicalLimitObservedAt !== null) {
      context.addIssue({ code: 'custom', message: 'fecha de límite sin estado de límite' });
    }
    if (record.status === 'route_closed_dependency' && record.closedByKcId === null) {
      context.addIssue({ code: 'custom', message: 'ruta cerrada exige KC causante' });
    }
    if (record.status !== 'route_closed_dependency' && record.closedByKcId !== null) {
      context.addIssue({ code: 'custom', message: 'KC causante solo aplica a ruta cerrada' });
    }
    if ((record.status === 'idle') !== (record.updatedAt === null)) {
      context.addIssue({ code: 'custom', message: 'solo un KC idle carece de fecha de cambio' });
    }
    const programs = [
      ...record.programHistory,
      ...(record.currentProgram === null ? [] : [record.currentProgram]),
    ];
    const startedEpisodes = programs.flatMap((program) =>
      program.laterEpisodes.filter((episode) => episode.status !== 'scheduled'),
    );
    const failedEpisodes = startedEpisodes.filter((episode) => episode.status === 'failed');
    if (startedEpisodes.length !== record.recoveryEpisodeCount) {
      context.addIssue({ code: 'custom', message: 'contador de episodios no coincide con la historia' });
    }
    if (failedEpisodes.length !== record.failedRecoveryEpisodeCount) {
      context.addIssue({ code: 'custom', message: 'contador de fallos no coincide con la historia' });
    }
    const expectedMaterials = programs.flatMap((program) => [
      program.failedItemId,
      ...program.cycles.flatMap((cycle) => cycle.materialIds),
      ...program.laterEpisodes
        .filter((episode) => episode.status !== 'scheduled')
        .flatMap((episode) => [episode.activityId, episode.itemId]),
    ]);
    if (
      expectedMaterials.length !== record.consumedMaterialIds.length ||
      expectedMaterials.some((materialId) => !record.consumedMaterialIds.includes(materialId))
    ) {
      context.addIssue({ code: 'custom', message: 'material consumido no coincide con los programas' });
    }
    const programIds = programs.map((program) => program.programId);
    const failureAttemptIds = programs.map((program) => program.failureAttemptId);
    if (new Set(programIds).size !== programIds.length || new Set(failureAttemptIds).size !== failureAttemptIds.length) {
      context.addIssue({ code: 'custom', message: 'programa o intento fallido duplicado' });
    }
    const current = record.currentProgram;
    if (record.status === 'in_block_active' && current?.nextCycle === null) {
      context.addIssue({ code: 'custom', message: 'recuperación en bloque exige ciclo siguiente' });
    }
    if (
      ['awaiting_later_recovery', 'later_recovery_scheduled', 'later_recovery_active'].includes(record.status) &&
      (current?.nextCycle !== null ||
        current.cycles.length !== 3 ||
        current.cycles.some((cycle) => cycle.outcome !== 'failed'))
    ) {
      context.addIssue({ code: 'custom', message: 'recuperación posterior exige tres ciclos fallidos' });
    }
    const lastEpisode = current?.laterEpisodes.at(-1);
    if (record.status === 'later_recovery_scheduled' && lastEpisode?.status !== 'scheduled') {
      context.addIssue({ code: 'custom', message: 'estado programado sin episodio programado' });
    }
    if (record.status === 'later_recovery_active' && lastEpisode?.status !== 'active') {
      context.addIssue({ code: 'custom', message: 'estado activo sin episodio activo' });
    }
    const terminalStatuses = new Set([
      'returned_to_domain_evaluation',
      'not_mastered_no_reserve',
      'not_mastered_recovery_cap_reached',
      'pedagogical_limit_observed',
      'incomplete_missing',
    ]);
    if (
      terminalStatuses.has(record.status) &&
      record.programHistory.at(-1)?.terminalStatus !== record.status
    ) {
      context.addIssue({ code: 'custom', message: 'estado terminal no coincide con el último programa' });
    }
  });
export type RecoveryKcRecord = z.infer<typeof RecoveryKcRecord>;

const DependentRouteClosure = z
  .object({
    causeKcId: Id,
    closedKcId: Id,
    dependencyPath: z.array(Id).min(2),
    graphVersion: NonEmptyText,
    graphHash: Sha256Hex,
    closedAt: IsoDateTime,
  })
  .strict();

export const RecoveryRunState = z
  .object({
    schemaVersion: z.literal(RECOVERY_STATE_SCHEMA_VERSION),
    revision: z.number().int().nonnegative(),
    runId: Id,
    participantPseudoId: Id,
    policyVersion: NonEmptyText,
    policyHash: Sha256Hex,
    dependencyGraphVersion: NonEmptyText,
    dependencyGraphHash: Sha256Hex,
    recoveryInventoryVersion: NonEmptyText,
    recoveryInventoryHash: Sha256Hex,
    kcs: z.array(RecoveryKcRecord),
    closedRoutes: z.array(DependentRouteClosure),
    processedEventIds: uniqueArray(Id, 'processedEventIds'),
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
  })
  .strict()
  .superRefine((state, context) => {
    const kcIds = new Set<string>();
    for (const [index, record] of state.kcs.entries()) {
      if (kcIds.has(record.kcId)) {
        context.addIssue({ code: 'custom', message: 'KC duplicado', path: ['kcs', index, 'kcId'] });
      }
      kcIds.add(record.kcId);
    }
    const closures = new Set<string>();
    for (const [index, closure] of state.closedRoutes.entries()) {
      const key = `${closure.causeKcId}\u0000${closure.closedKcId}`;
      if (closures.has(key)) {
        context.addIssue({ code: 'custom', message: 'cierre duplicado', path: ['closedRoutes', index] });
      }
      closures.add(key);
      if (
        closure.dependencyPath[0] !== closure.causeKcId ||
        closure.dependencyPath.at(-1) !== closure.closedKcId
      ) {
        context.addIssue({ code: 'custom', message: 'ruta de dependencia incoherente', path: ['closedRoutes', index] });
      }
    }
  });
export type RecoveryRunState = z.infer<typeof RecoveryRunState>;

export type RecoveryDirective = Readonly<
  | { kind: 'initialized' }
  | { kind: 'none'; kcId: string }
  | {
      kind: 'execute_in_block_cycle';
      kcId: string;
      programId: string;
      cycle: 1 | 2 | 3;
      actions: readonly string[];
      strategy: z.infer<typeof PedagogicalStrategy>;
      assistanceLevel: number;
    }
  | { kind: 'inspect_recovery_reserve'; kcId: string; programId: string; nextEpisodeNumber: 1 | 2 }
  | {
      kind: 'start_later_recovery';
      kcId: string;
      programId: string;
      episodeNumber: 1 | 2;
      activityId: string;
      itemId: string;
    }
  | {
      kind: 'observe_later_recovery';
      kcId: string;
      programId: string;
      episodeNumber: 1 | 2;
      activityId: string;
      itemId: string;
    }
  | { kind: 'return_to_domain_evaluation'; kcId: string }
  | { kind: 'no_later_recovery'; kcId: string; reason: 'reserve_unavailable' | 'episode_cap_reached' }
  | { kind: 'pedagogical_limit'; kcId: string }
  | { kind: 'route_closed'; kcId: string; causeKcId: string }
  | { kind: 'missing'; kcId: string }
>;

export interface RecoveryMutation {
  readonly state: RecoveryRunState;
  readonly directive: RecoveryDirective;
}

function parseEvent(value: unknown): RecoveryEvent {
  const parsed = RecoveryEvent.safeParse(value);
  if (!parsed.success) {
    throw new RecoveryEngineError('INVALID_RECOVERY_EVENT', z.prettifyError(parsed.error));
  }
  return parsed.data;
}

function parseState(value: unknown): RecoveryRunState {
  const parsed = RecoveryRunState.safeParse(value);
  if (!parsed.success) {
    throw new RecoveryEngineError('INVALID_RECOVERY_EVENT', z.prettifyError(parsed.error));
  }
  return parsed.data;
}

function emptyKc(kcId: string): RecoveryKcRecord {
  return RecoveryKcRecord.parse({
    kcId,
    status: 'idle',
    recoveryEpisodeCount: 0,
    failedRecoveryEpisodeCount: 0,
    currentProgram: null,
    programHistory: [],
    consumedMaterialIds: [],
    pedagogicalLimitObservedAt: null,
    closedByKcId: null,
    updatedAt: null,
  });
}

function currentKc(state: RecoveryRunState, kcId: string): RecoveryKcRecord {
  return state.kcs.find((candidate) => candidate.kcId === kcId) ?? emptyKc(kcId);
}

function replaceKc(state: RecoveryRunState, next: RecoveryKcRecord): RecoveryKcRecord[] {
  return state.kcs.some((candidate) => candidate.kcId === next.kcId)
    ? state.kcs.map((candidate) => (candidate.kcId === next.kcId ? next : candidate))
    : [...state.kcs, next];
}

function assertHeader(
  state: RecoveryRunState,
  event: Exclude<RecoveryEvent, z.infer<typeof RecoveryInitializedEvent>>,
): void {
  if (event.sequenceNumber !== state.revision + 1) {
    throw new RecoveryEngineError(
      'INVALID_EVENT_SEQUENCE',
      `se esperaba secuencia ${state.revision + 1}, se recibió ${event.sequenceNumber}`,
    );
  }
  if (state.processedEventIds.includes(event.eventId)) {
    throw new RecoveryEngineError('INVALID_EVENT_SEQUENCE', `eventId duplicado: ${event.eventId}`);
  }
  if (Date.parse(event.occurredAt) < Date.parse(state.updatedAt)) {
    throw new RecoveryEngineError('INVALID_EVENT_SEQUENCE', 'occurredAt no puede retroceder');
  }
}

function withEventBase(
  state: RecoveryRunState,
  event: Exclude<RecoveryEvent, z.infer<typeof RecoveryInitializedEvent>>,
  changes: Partial<RecoveryRunState>,
): RecoveryRunState {
  return parseState({
    ...state,
    ...changes,
    revision: event.sequenceNumber,
    processedEventIds: [...state.processedEventIds, event.eventId],
    updatedAt: event.occurredAt,
  });
}

function initialState(
  event: z.infer<typeof RecoveryInitializedEvent>,
  policy: CompiledRecoveryPolicy,
  graph: CompiledRecoveryDependencyGraph,
  binding: RecoveryRunBinding,
): RecoveryRunState {
  return parseState({
    schemaVersion: RECOVERY_STATE_SCHEMA_VERSION,
    revision: 0,
    runId: event.payload.runId,
    participantPseudoId: event.payload.participantPseudoId,
    policyVersion: policy.definition.policyVersion,
    policyHash: policy.policyHash,
    dependencyGraphVersion: graph.definition.graphVersion,
    dependencyGraphHash: graph.graphHash,
    recoveryInventoryVersion: binding.recoveryInventoryVersion,
    recoveryInventoryHash: binding.recoveryInventoryHash,
    kcs: [],
    closedRoutes: [],
    processedEventIds: [event.eventId],
    createdAt: event.occurredAt,
    updatedAt: event.occurredAt,
  });
}

function terminalize(
  record: RecoveryKcRecord,
  status: z.infer<typeof TerminalProgramStatus>,
  at: string,
  closedByKcId: string | null = null,
): RecoveryKcRecord {
  const program = record.currentProgram;
  if (program === null) {
    throw new RecoveryEngineError('RECOVERY_ORDER_VIOLATION', 'no existe programa que cerrar');
  }
  return RecoveryKcRecord.parse({
    ...record,
    status,
    currentProgram: null,
    programHistory: [...record.programHistory, { ...program, terminalStatus: status, completedAt: at }],
    pedagogicalLimitObservedAt: status === 'pedagogical_limit_observed' ? at : null,
    closedByKcId: status === 'route_closed_dependency' ? closedByKcId : null,
    updatedAt: at,
  });
}

function materialIdsForCycle(payload: z.infer<typeof CycleCompletionPayload>): string[] {
  if (payload.cycle === 1) {
    return [
      payload.evidence.feedback.artifactId,
      payload.evidence.explanation.artifactId,
      payload.evidence.guidedPractice.activityId,
      payload.evidence.guidedPractice.itemId,
    ];
  }
  if (payload.cycle === 2) {
    return [
      payload.evidence.prerequisite.artifactId,
      payload.evidence.scaffolding.activityId,
      payload.evidence.scaffolding.itemId,
    ];
  }
  const ids = [
    payload.evidence.representation.activityId,
    payload.evidence.representation.alternativeRepresentationId,
    payload.evidence.understandingCheck.activityId,
    payload.evidence.understandingCheck.itemId,
  ];
  if (payload.evidence.selfExplanation.applied) ids.push(payload.evidence.selfExplanation.promptId);
  return ids;
}

function assertFreshMaterials(record: RecoveryKcRecord, ids: readonly string[]): void {
  if (new Set(ids).size !== ids.length) {
    throw new RecoveryEngineError('RECOVERY_RESERVE_VIOLATION', 'un ciclo repite material internamente');
  }
  const consumed = new Set(record.consumedMaterialIds);
  const repeated = ids.find((id) => consumed.has(id));
  if (repeated !== undefined) {
    throw new RecoveryEngineError(
      'RECOVERY_RESERVE_VIOLATION',
      `el material ${repeated} ya fue consumido o corresponde al intento fallido`,
    );
  }
}

function directiveFor(
  record: RecoveryKcRecord,
  policy: RecoveryPolicyDefinition,
): RecoveryDirective {
  const program = record.currentProgram;
  if (record.status === 'idle') return deepFreeze({ kind: 'none', kcId: record.kcId });
  if (record.status === 'in_block_active' && program !== null && program.nextCycle !== null) {
    const definition = policy.inBlockCycles[program.nextCycle - 1];
    if (definition === undefined) {
      throw new RecoveryEngineError('INVALID_RECOVERY_POLICY', 'ciclo ausente en política');
    }
    const strategy = program.nextCycle === 1
      ? 'guided_practice'
      : program.nextCycle === 2
        ? 'prerequisite_remediation'
        : 'self_explanation';
    return deepFreeze({
      kind: 'execute_in_block_cycle',
      kcId: record.kcId,
      programId: program.programId,
      cycle: program.nextCycle,
      actions: [...definition.actions],
      strategy,
      assistanceLevel: program.nextCycle === 1 ? 2 : program.nextCycle === 2 ? 3 : 2,
    });
  }
  if (record.status === 'awaiting_later_recovery' && program !== null) {
    const next = record.recoveryEpisodeCount + 1;
    if (next !== 1 && next !== 2) {
      throw new RecoveryEngineError('RECOVERY_ORDER_VIOLATION', 'se excedió el máximo de episodios');
    }
    return deepFreeze({
      kind: 'inspect_recovery_reserve',
      kcId: record.kcId,
      programId: program.programId,
      nextEpisodeNumber: next,
    });
  }
  if (record.status === 'later_recovery_scheduled' && program !== null) {
    const episode = program.laterEpisodes.at(-1);
    if (episode === undefined || episode.status !== 'scheduled') {
      throw new RecoveryEngineError('RECOVERY_ORDER_VIOLATION', 'falta episodio programado');
    }
    return deepFreeze({
      kind: 'start_later_recovery',
      kcId: record.kcId,
      programId: program.programId,
      episodeNumber: episode.episodeNumber,
      activityId: episode.activityId,
      itemId: episode.itemId,
    });
  }
  if (record.status === 'later_recovery_active' && program !== null) {
    const episode = program.laterEpisodes.at(-1);
    if (episode === undefined || episode.status !== 'active') {
      throw new RecoveryEngineError('RECOVERY_ORDER_VIOLATION', 'falta episodio activo');
    }
    return deepFreeze({
      kind: 'observe_later_recovery',
      kcId: record.kcId,
      programId: program.programId,
      episodeNumber: episode.episodeNumber,
      activityId: episode.activityId,
      itemId: episode.itemId,
    });
  }
  if (record.status === 'returned_to_domain_evaluation') {
    return deepFreeze({ kind: 'return_to_domain_evaluation', kcId: record.kcId });
  }
  if (record.status === 'not_mastered_no_reserve') {
    return deepFreeze({ kind: 'no_later_recovery', kcId: record.kcId, reason: 'reserve_unavailable' });
  }
  if (record.status === 'not_mastered_recovery_cap_reached') {
    return deepFreeze({ kind: 'no_later_recovery', kcId: record.kcId, reason: 'episode_cap_reached' });
  }
  if (record.status === 'pedagogical_limit_observed') {
    return deepFreeze({ kind: 'pedagogical_limit', kcId: record.kcId });
  }
  if (record.status === 'route_closed_dependency') {
    if (record.closedByKcId === null) {
      throw new RecoveryEngineError('INVALID_RECOVERY_EVENT', 'ruta cerrada sin KC causante');
    }
    return deepFreeze({ kind: 'route_closed', kcId: record.kcId, causeKcId: record.closedByKcId });
  }
  return deepFreeze({ kind: 'missing', kcId: record.kcId });
}

function blockingDependentPaths(
  causeKcId: string,
  graph: RecoveryDependencyGraph,
): ReadonlyMap<string, readonly string[]> {
  const dependents = new Map<string, string[]>();
  for (const kcId of graph.kcIds) dependents.set(kcId, []);
  for (const edge of graph.edges) {
    if (edge.blocksRoute) dependents.get(edge.prerequisiteKcId)?.push(edge.dependentKcId);
  }
  for (const values of dependents.values()) values.sort();
  const paths = new Map<string, readonly string[]>();
  const queue: string[][] = [[causeKcId]];
  while (queue.length > 0) {
    const path = queue.shift();
    if (path === undefined) break;
    const current = path.at(-1);
    if (current === undefined) continue;
    for (const dependent of dependents.get(current) ?? []) {
      if (paths.has(dependent) || dependent === causeKcId) continue;
      const nextPath = [...path, dependent];
      paths.set(dependent, nextPath);
      queue.push(nextPath);
    }
  }
  return paths;
}

function assertStateGraphIntegrity(
  state: RecoveryRunState,
  graph: CompiledRecoveryDependencyGraph,
): void {
  const knownKcs = new Set(graph.definition.kcIds);
  if (state.kcs.some((record) => !knownKcs.has(record.kcId))) {
    throw new RecoveryEngineError('INVALID_RECOVERY_EVENT', 'el estado contiene un KC ajeno al grafo');
  }
  const expectedClosures = new Map<string, readonly string[]>();
  for (const record of state.kcs) {
    if (record.status !== 'pedagogical_limit_observed') continue;
    for (const [closedKcId, path] of blockingDependentPaths(record.kcId, graph.definition)) {
      expectedClosures.set(`${record.kcId}\u0000${closedKcId}`, path);
    }
  }
  if (expectedClosures.size !== state.closedRoutes.length) {
    throw new RecoveryEngineError('INVALID_RECOVERY_EVENT', 'cierres de ruta incompletos o excedentes');
  }
  for (const closure of state.closedRoutes) {
    const expectedPath = expectedClosures.get(`${closure.causeKcId}\u0000${closure.closedKcId}`);
    if (
      expectedPath === undefined ||
      closure.graphVersion !== graph.definition.graphVersion ||
      closure.graphHash !== graph.graphHash ||
      canonicalJson(closure.dependencyPath) !== canonicalJson(expectedPath)
    ) {
      throw new RecoveryEngineError('INVALID_RECOVERY_EVENT', 'cierre de ruta no deriva del grafo congelado');
    }
  }
  for (const record of state.kcs) {
    if (
      record.status === 'route_closed_dependency' &&
      !state.closedRoutes.some(
        (closure) => closure.causeKcId === record.closedByKcId && closure.closedKcId === record.kcId,
      )
    ) {
      throw new RecoveryEngineError('INVALID_RECOVERY_EVENT', 'KC cerrado sin cierre derivado registrado');
    }
  }
}

function applyDependentClosures(
  state: RecoveryRunState,
  sourceRecord: RecoveryKcRecord,
  at: string,
  graph: CompiledRecoveryDependencyGraph,
): Pick<RecoveryRunState, 'kcs' | 'closedRoutes'> {
  let kcs = replaceKc(state, sourceRecord);
  const closures = [...state.closedRoutes];
  for (const [closedKcId, dependencyPath] of blockingDependentPaths(
    sourceRecord.kcId,
    graph.definition,
  )) {
    const existing = kcs.find((candidate) => candidate.kcId === closedKcId) ?? emptyKc(closedKcId);
    if (
      existing.status !== 'pedagogical_limit_observed' &&
      existing.status !== 'route_closed_dependency'
    ) {
      let closed = existing;
      if (closed.currentProgram !== null) {
        closed = terminalize(closed, 'route_closed_dependency', at, sourceRecord.kcId);
      }
      closed = RecoveryKcRecord.parse({
        ...closed,
        status: 'route_closed_dependency',
        currentProgram: null,
        closedByKcId: sourceRecord.kcId,
        updatedAt: at,
      });
      kcs = kcs.some((candidate) => candidate.kcId === closedKcId)
        ? kcs.map((candidate) => (candidate.kcId === closedKcId ? closed : candidate))
        : [...kcs, closed];
    }
    if (!closures.some((entry) => entry.causeKcId === sourceRecord.kcId && entry.closedKcId === closedKcId)) {
      closures.push({
        causeKcId: sourceRecord.kcId,
        closedKcId,
        dependencyPath: [...dependencyPath],
        graphVersion: graph.definition.graphVersion,
        graphHash: graph.graphHash,
        closedAt: at,
      });
    }
  }
  return { kcs, closedRoutes: closures };
}

function applyStarted(
  state: RecoveryRunState,
  event: z.infer<typeof RecoveryInBlockStartedEvent>,
  policy: RecoveryPolicyDefinition,
): RecoveryMutation {
  if (event.payload.mode !== 'LEARNING_MODE') {
    throw new RecoveryEngineError('RECOVERY_ORDER_VIOLATION', 'la recuperación pedagógica solo opera en LEARNING_MODE');
  }
  const record = currentKc(state, event.payload.kcId);
  if (
    record.currentProgram !== null ||
    record.status === 'pedagogical_limit_observed' ||
    record.status === 'route_closed_dependency'
  ) {
    throw new RecoveryEngineError('RECOVERY_ORDER_VIOLATION', `el KC ${record.kcId} no puede iniciar recuperación`);
  }
  if (record.consumedMaterialIds.includes(event.payload.failedItemId)) {
    throw new RecoveryEngineError('RECOVERY_RESERVE_VIOLATION', 'el intento fallido reutiliza material ya consumido');
  }
  const program: RecoveryProgram = {
    programId: `recovery:${state.runId}:${record.kcId}:${event.sequenceNumber}`,
    failureAttemptId: event.payload.failureAttemptId,
    failedItemId: event.payload.failedItemId,
    errorObservationId: event.payload.errorObservationId,
    errorCode: event.payload.errorCode,
    startedAt: event.occurredAt,
    nextCycle: 1,
    cycles: [],
    laterEpisodes: [],
  };
  const nextRecord = RecoveryKcRecord.parse({
    ...record,
    status: 'in_block_active',
    currentProgram: program,
    consumedMaterialIds: [...record.consumedMaterialIds, event.payload.failedItemId],
    closedByKcId: null,
    updatedAt: event.occurredAt,
  });
  const nextState = withEventBase(state, event, { kcs: replaceKc(state, nextRecord) });
  return deepFreeze({ state: deepFreeze(nextState), directive: directiveFor(nextRecord, policy) });
}

function applyCycleCompleted(
  state: RecoveryRunState,
  event: z.infer<typeof RecoveryCycleCompletedEvent>,
  policy: RecoveryPolicyDefinition,
  graph: CompiledRecoveryDependencyGraph,
): RecoveryMutation {
  const payload = event.payload;
  const record = currentKc(state, payload.kcId);
  const program = record.currentProgram;
  if (
    record.status !== 'in_block_active' ||
    program === null ||
    program.programId !== payload.programId ||
    program.nextCycle !== payload.cycle
  ) {
    throw new RecoveryEngineError('RECOVERY_ORDER_VIOLATION', 'el ciclo no es el siguiente del programa activo');
  }
  if (payload.cycle === 1 && payload.evidence.feedback.errorCode !== program.errorCode) {
    throw new RecoveryEngineError(
      'RECOVERY_ORDER_VIOLATION',
      'el feedback del primer ciclo no corresponde al error que activó recuperación',
    );
  }
  if (payload.cycle === 2) {
    const declared = new Set(
      graph.definition.edges
        .filter((edge) => edge.dependentKcId === payload.kcId)
        .map((edge) => edge.prerequisiteKcId),
    );
    if (payload.evidence.prerequisite.kcIds.some((kcId) => !declared.has(kcId))) {
      throw new RecoveryEngineError(
        'RECOVERY_ORDER_VIOLATION',
        'el segundo ciclo solo puede revisar prerrequisitos declarados del KC',
      );
    }
  }
  const materialIds = materialIdsForCycle(payload);
  assertFreshMaterials(record, materialIds);
  const cycleRecord = RecoveryCycleRecord.parse({
    cycle: payload.cycle,
    outcome: payload.outcome,
    evidenceHash: hashJson(payload.evidence),
    materialIds,
    completedAt: event.occurredAt,
  });
  const updatedProgram: RecoveryProgram = {
    ...program,
    nextCycle: payload.outcome === 'failed' && payload.cycle < 3
      ? ((payload.cycle + 1) as 2 | 3)
      : null,
    cycles: [...program.cycles, cycleRecord],
  };
  const updatedRecord = {
    ...record,
    currentProgram: updatedProgram,
    consumedMaterialIds: [...record.consumedMaterialIds, ...materialIds],
    updatedAt: event.occurredAt,
  } as RecoveryKcRecord;
  let nextRecord: RecoveryKcRecord;
  if (payload.outcome === 'progress_observed') {
    nextRecord = terminalize(updatedRecord, 'returned_to_domain_evaluation', event.occurredAt);
  } else if (payload.cycle === 3) {
    if (record.recoveryEpisodeCount >= policy.laterRecovery.maxEpisodesPerKc) {
      nextRecord = terminalize(updatedRecord, 'not_mastered_recovery_cap_reached', event.occurredAt);
    } else {
      nextRecord = RecoveryKcRecord.parse({ ...updatedRecord, status: 'awaiting_later_recovery' });
    }
  } else {
    nextRecord = RecoveryKcRecord.parse(updatedRecord);
  }
  const nextState = withEventBase(state, event, { kcs: replaceKc(state, nextRecord) });
  return deepFreeze({ state: deepFreeze(nextState), directive: directiveFor(nextRecord, policy) });
}

function applyOpportunityAvailable(
  state: RecoveryRunState,
  event: z.infer<typeof RecoveryOpportunityAvailableEvent>,
  policy: RecoveryPolicyDefinition,
): RecoveryMutation {
  const payload = event.payload;
  const record = currentKc(state, payload.kcId);
  const program = record.currentProgram;
  if (
    record.status !== 'awaiting_later_recovery' ||
    program === null ||
    program.programId !== payload.programId ||
    payload.episodeNumber !== record.recoveryEpisodeCount + 1
  ) {
    throw new RecoveryEngineError('RECOVERY_ORDER_VIOLATION', 'la oportunidad no corresponde al siguiente episodio');
  }
  if (
    payload.inventoryVersion !== state.recoveryInventoryVersion ||
    payload.inventoryHash !== state.recoveryInventoryHash
  ) {
    throw new RecoveryEngineError('RECOVERY_RESERVE_VIOLATION', 'la oportunidad usa otro inventario congelado');
  }
  assertFreshMaterials(record, [payload.activityId, payload.itemId]);
  const episode = LaterRecoveryEpisode.parse({
    episodeNumber: payload.episodeNumber,
    status: 'scheduled',
    activityId: payload.activityId,
    itemId: payload.itemId,
    inventoryVersion: payload.inventoryVersion,
    inventoryHash: payload.inventoryHash,
    scheduledAt: event.occurredAt,
    startedAt: null,
    completedAt: null,
  });
  const nextRecord = RecoveryKcRecord.parse({
    ...record,
    status: 'later_recovery_scheduled',
    currentProgram: { ...program, laterEpisodes: [...program.laterEpisodes, episode] },
    updatedAt: event.occurredAt,
  });
  const nextState = withEventBase(state, event, { kcs: replaceKc(state, nextRecord) });
  return deepFreeze({ state: deepFreeze(nextState), directive: directiveFor(nextRecord, policy) });
}

function applyReserveUnavailable(
  state: RecoveryRunState,
  event: z.infer<typeof RecoveryReserveUnavailableEvent>,
  policy: RecoveryPolicyDefinition,
): RecoveryMutation {
  const record = currentKc(state, event.payload.kcId);
  if (
    record.status !== 'awaiting_later_recovery' ||
    record.currentProgram?.programId !== event.payload.programId
  ) {
    throw new RecoveryEngineError('RECOVERY_ORDER_VIOLATION', 'no se esperaba evaluación de reserva');
  }
  if (
    event.payload.inventoryVersion !== state.recoveryInventoryVersion ||
    event.payload.inventoryHash !== state.recoveryInventoryHash
  ) {
    throw new RecoveryEngineError('RECOVERY_RESERVE_VIOLATION', 'la ausencia usa otro inventario congelado');
  }
  const nextRecord = terminalize(record, 'not_mastered_no_reserve', event.occurredAt);
  const nextState = withEventBase(state, event, { kcs: replaceKc(state, nextRecord) });
  return deepFreeze({ state: deepFreeze(nextState), directive: directiveFor(nextRecord, policy) });
}

function applyEpisodeStarted(
  state: RecoveryRunState,
  event: z.infer<typeof RecoveryEpisodeStartedEvent>,
  policy: RecoveryPolicyDefinition,
): RecoveryMutation {
  const payload = event.payload;
  const record = currentKc(state, payload.kcId);
  const program = record.currentProgram;
  const scheduled = program?.laterEpisodes.at(-1);
  if (
    record.status !== 'later_recovery_scheduled' ||
    program === null ||
    program.programId !== payload.programId ||
    scheduled === undefined ||
    scheduled.status !== 'scheduled' ||
    scheduled.episodeNumber !== payload.episodeNumber ||
    scheduled.activityId !== payload.activityId ||
    scheduled.itemId !== payload.itemId
  ) {
    throw new RecoveryEngineError('RECOVERY_ORDER_VIOLATION', 'el inicio no coincide con el episodio programado');
  }
  if (record.recoveryEpisodeCount >= policy.laterRecovery.maxEpisodesPerKc) {
    throw new RecoveryEngineError('RECOVERY_ORDER_VIOLATION', 'se alcanzó el máximo de episodios por KC');
  }
  const active = LaterRecoveryEpisode.parse({
    ...scheduled,
    status: 'active',
    startedAt: event.occurredAt,
  });
  const nextRecord = RecoveryKcRecord.parse({
    ...record,
    status: 'later_recovery_active',
    recoveryEpisodeCount: record.recoveryEpisodeCount + 1,
    currentProgram: {
      ...program,
      laterEpisodes: [...program.laterEpisodes.slice(0, -1), active],
    },
    consumedMaterialIds: [...record.consumedMaterialIds, payload.activityId, payload.itemId],
    updatedAt: event.occurredAt,
  });
  const nextState = withEventBase(state, event, { kcs: replaceKc(state, nextRecord) });
  return deepFreeze({ state: deepFreeze(nextState), directive: directiveFor(nextRecord, policy) });
}

function applyEpisodeCompleted(
  state: RecoveryRunState,
  event: z.infer<typeof RecoveryEpisodeCompletedEvent>,
  policy: RecoveryPolicyDefinition,
  graph: CompiledRecoveryDependencyGraph,
): RecoveryMutation {
  const payload = event.payload;
  if (payload.reevaluatedKcId !== payload.kcId) {
    throw new RecoveryEngineError('RECOVERY_ORDER_VIOLATION', 'el episodio debe reevaluar el mismo KC');
  }
  const record = currentKc(state, payload.kcId);
  const program = record.currentProgram;
  const active = program?.laterEpisodes.at(-1);
  if (
    record.status !== 'later_recovery_active' ||
    program === null ||
    program.programId !== payload.programId ||
    active === undefined ||
    active.status !== 'active' ||
    active.episodeNumber !== payload.episodeNumber ||
    active.activityId !== payload.activityId ||
    active.itemId !== payload.itemId
  ) {
    throw new RecoveryEngineError('RECOVERY_ORDER_VIOLATION', 'el resultado no coincide con el episodio activo');
  }
  const terminalEpisode = LaterRecoveryEpisode.parse({
    ...active,
    status: payload.outcome,
    completedAt: event.occurredAt,
  });
  const updatedRecord = {
    ...record,
    failedRecoveryEpisodeCount:
      record.failedRecoveryEpisodeCount + (payload.outcome === 'failed' ? 1 : 0),
    currentProgram: {
      ...program,
      laterEpisodes: [...program.laterEpisodes.slice(0, -1), terminalEpisode],
    },
    updatedAt: event.occurredAt,
  } as RecoveryKcRecord;
  let nextRecord: RecoveryKcRecord;
  let changes: Pick<RecoveryRunState, 'kcs' | 'closedRoutes'>;
  if (payload.outcome === 'progress_observed') {
    nextRecord = terminalize(updatedRecord, 'returned_to_domain_evaluation', event.occurredAt);
    changes = { kcs: replaceKc(state, nextRecord), closedRoutes: state.closedRoutes };
  } else if (updatedRecord.failedRecoveryEpisodeCount === 2) {
    nextRecord = terminalize(updatedRecord, 'pedagogical_limit_observed', event.occurredAt);
    changes = applyDependentClosures(state, nextRecord, event.occurredAt, graph);
  } else if (updatedRecord.recoveryEpisodeCount < policy.laterRecovery.maxEpisodesPerKc) {
    nextRecord = RecoveryKcRecord.parse({ ...updatedRecord, status: 'awaiting_later_recovery' });
    changes = { kcs: replaceKc(state, nextRecord), closedRoutes: state.closedRoutes };
  } else {
    nextRecord = terminalize(updatedRecord, 'not_mastered_recovery_cap_reached', event.occurredAt);
    changes = { kcs: replaceKc(state, nextRecord), closedRoutes: state.closedRoutes };
  }
  const nextState = withEventBase(state, event, changes);
  const projectedRecord = currentKc(nextState, payload.kcId);
  return deepFreeze({ state: deepFreeze(nextState), directive: directiveFor(projectedRecord, policy) });
}

function applyClosedWithoutOutcome(
  state: RecoveryRunState,
  event: z.infer<typeof RecoveryClosedWithoutOutcomeEvent>,
  policy: RecoveryPolicyDefinition,
): RecoveryMutation {
  const record = currentKc(state, event.payload.kcId);
  if (record.currentProgram?.programId !== event.payload.programId) {
    throw new RecoveryEngineError('RECOVERY_ORDER_VIOLATION', 'no existe el programa que se quiere cerrar');
  }
  const nextRecord = terminalize(record, 'incomplete_missing', event.occurredAt);
  const nextState = withEventBase(state, event, { kcs: replaceKc(state, nextRecord) });
  return deepFreeze({ state: deepFreeze(nextState), directive: directiveFor(nextRecord, policy) });
}

export class DeterministicRecoveryController {
  readonly policy: CompiledRecoveryPolicy;
  readonly graph: CompiledRecoveryDependencyGraph;
  readonly registry: RecoveryRunRegistry;

  constructor(
    policyValue: unknown,
    graphValue: unknown,
    options: Readonly<{
      expectedPolicyHash?: string;
      expectedGraphHash?: string;
      registry?: RecoveryRunRegistry;
    }> = {},
  ) {
    this.policy = compileRecoveryPolicy(policyValue, options.expectedPolicyHash);
    this.graph = compileRecoveryDependencyGraph(graphValue, options.expectedGraphHash);
    if (
      (this.policy.definition.purpose === 'material' || this.graph.definition.purpose === 'material') &&
      (options.expectedPolicyHash === undefined || options.expectedGraphHash === undefined)
    ) {
      throw new RecoveryEngineError(
        'MATERIAL_FREEZE_REQUIRED',
        'una corrida material exige hashes externos de política y grafo',
      );
    }
    if (this.policy.definition.purpose !== this.graph.definition.purpose) {
      throw new RecoveryEngineError('INVALID_RECOVERY_POLICY', 'política y grafo deben tener el mismo propósito');
    }
    this.registry = options.registry ?? new RecoveryRunRegistry();
  }

  bindRun(value: unknown): RecoveryRunBinding {
    return this.registry.bind(this.policy, this.graph, value);
  }

  applyEvent(stateValue: RecoveryRunState | null, eventValue: unknown): RecoveryMutation {
    const event = parseEvent(eventValue);
    if (event.eventType === 'recovery.initialized') {
      if (stateValue !== null) {
        throw new RecoveryEngineError('INVALID_EVENT_SEQUENCE', 'inicialización duplicada');
      }
      const binding = this.registry.assertBound(event.payload.runId, this.policy, this.graph);
      const state = initialState(event, this.policy, this.graph, binding);
      return deepFreeze({
        state: deepFreeze(state),
        directive: deepFreeze({ kind: 'initialized' }),
      });
    }
    if (stateValue === null) {
      throw new RecoveryEngineError('INVALID_EVENT_SEQUENCE', 'falta recovery.initialized');
    }
    const state = parseState(stateValue);
    const binding = this.registry.assertBound(state.runId, this.policy, this.graph);
    if (
      state.policyVersion !== this.policy.definition.policyVersion ||
      state.policyHash !== this.policy.policyHash ||
      state.dependencyGraphVersion !== this.graph.definition.graphVersion ||
      state.dependencyGraphHash !== this.graph.graphHash ||
      state.recoveryInventoryVersion !== binding.recoveryInventoryVersion ||
      state.recoveryInventoryHash !== binding.recoveryInventoryHash
    ) {
      throw new RecoveryEngineError('RUN_POLICY_DRIFT', 'el estado pertenece a otro binding');
    }
    assertStateGraphIntegrity(state, this.graph);
    if (!this.graph.definition.kcIds.includes(event.payload.kcId)) {
      throw new RecoveryEngineError(
        'INVALID_RECOVERY_EVENT',
        `el KC ${event.payload.kcId} no pertenece al grafo congelado`,
      );
    }
    assertHeader(state, event);
    switch (event.eventType) {
      case 'recovery.in_block.started':
        return applyStarted(state, event, this.policy.definition);
      case 'recovery.in_block.cycle.completed':
        return applyCycleCompleted(state, event, this.policy.definition, this.graph);
      case 'recovery.later.opportunity.available':
        return applyOpportunityAvailable(state, event, this.policy.definition);
      case 'recovery.later.reserve.unavailable':
        return applyReserveUnavailable(state, event, this.policy.definition);
      case 'recovery.later.episode.started':
        return applyEpisodeStarted(state, event, this.policy.definition);
      case 'recovery.later.episode.completed':
        return applyEpisodeCompleted(state, event, this.policy.definition, this.graph);
      case 'recovery.program.closed_without_pedagogical_outcome':
        return applyClosedWithoutOutcome(state, event, this.policy.definition);
    }
  }

  replay(values: readonly unknown[]): RecoveryRunState {
    if (values.length === 0) {
      throw new RecoveryEngineError('INVALID_EVENT_SEQUENCE', 'historia de recuperación vacía');
    }
    let state: RecoveryRunState | null = null;
    for (const value of values) state = this.applyEvent(state, value).state;
    if (state === null) {
      throw new RecoveryEngineError('INVALID_EVENT_SEQUENCE', 'historia sin estado');
    }
    return state;
  }

  directive(stateValue: unknown, kcId: string): RecoveryDirective {
    return directiveFor(currentKc(parseState(stateValue), kcId), this.policy.definition);
  }
}

export function recoveryKcProjection(
  stateValue: unknown,
  kcId: string,
): Readonly<{
  status: RecoveryKcStatus;
  inBlockCycle: 1 | 2 | 3 | null;
  recoveryEpisodeCount: number;
  failedRecoveryEpisodeCount: number;
  recoveryActive: boolean;
  notMastered: boolean;
  pedagogicalLimitObserved: boolean;
  routeClosed: boolean;
  closedByKcId: string | null;
  selectedStrategy: z.infer<typeof PedagogicalStrategy> | null;
  assistanceLevel: number;
  scaffoldingStage: 'none' | 'scaffolding';
  nextAction: string | null;
  updatedAt: string | null;
}> {
  const state = parseState(stateValue);
  const record = currentKc(state, kcId);
  const cycle = record.currentProgram?.nextCycle ?? null;
  const recoveryActive = [
    'in_block_active',
    'awaiting_later_recovery',
    'later_recovery_scheduled',
    'later_recovery_active',
  ].includes(record.status);
  const selectedStrategy = cycle === 1
    ? 'guided_practice'
    : cycle === 2
      ? 'prerequisite_remediation'
      : cycle === 3
        ? 'self_explanation'
        : record.status === 'later_recovery_scheduled' || record.status === 'later_recovery_active'
          ? 'guided_practice'
          : null;
  const nextActionByStatus: Readonly<Record<RecoveryKcStatus, string | null>> = {
    idle: null,
    in_block_active: cycle === null ? null : `execute_recovery_cycle_${cycle}`,
    awaiting_later_recovery: 'inspect_recovery_reserve',
    later_recovery_scheduled: 'start_later_recovery',
    later_recovery_active: 'observe_later_recovery',
    returned_to_domain_evaluation: 'return_to_domain_evaluation',
    not_mastered_no_reserve: 'close_not_mastered_no_reserve',
    not_mastered_recovery_cap_reached: 'close_not_mastered_recovery_cap_reached',
    pedagogical_limit_observed: 'close_pedagogical_limit_observed',
    incomplete_missing: 'record_recovery_missing',
    route_closed_dependency: 'close_dependent_route_unreachable',
  };
  return deepFreeze({
    status: record.status,
    inBlockCycle: cycle,
    recoveryEpisodeCount: record.recoveryEpisodeCount,
    failedRecoveryEpisodeCount: record.failedRecoveryEpisodeCount,
    recoveryActive,
    notMastered: [
      'awaiting_later_recovery',
      'later_recovery_scheduled',
      'later_recovery_active',
      'not_mastered_no_reserve',
      'not_mastered_recovery_cap_reached',
      'pedagogical_limit_observed',
      'route_closed_dependency',
    ].includes(record.status),
    pedagogicalLimitObserved: record.status === 'pedagogical_limit_observed',
    routeClosed: record.status === 'route_closed_dependency',
    closedByKcId: record.closedByKcId,
    selectedStrategy,
    assistanceLevel: cycle === 1 ? 2 : cycle === 2 ? 3 : cycle === 3 ? 2 : recoveryActive ? 1 : 0,
    scaffoldingStage: recoveryActive ? 'scaffolding' : 'none',
    nextAction: nextActionByStatus[record.status],
    updatedAt: record.updatedAt,
  });
}
