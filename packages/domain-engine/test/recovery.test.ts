import { describe, expect, it } from 'vitest';

import {
  DeterministicRecoveryController,
  RECOVERY_GRAPH_SCHEMA_VERSION,
  RECOVERY_POLICY_V1,
  RecoveryEngineError,
  RecoveryKcStatus,
  RecoveryRunRegistry,
  RecoveryRunState,
  compileRecoveryDependencyGraph,
  compileRecoveryPolicy,
  createRecoveryPolicyDefinition,
  recoveryKcProjection,
  type RecoveryEvent,
  type RecoveryRunState as RecoveryRunStateValue,
} from '../src/index.js';

const AT = '2026-08-17T00:00:00.000Z';
const at = (seconds: number): string => `2026-08-17T00:00:${String(seconds).padStart(2, '0')}.000Z`;
const HASH = 'a'.repeat(64);

const FIXTURE_POLICY = createRecoveryPolicyDefinition({
  policyVersion: 'recovery-test-v1',
  purpose: 'test_fixture',
});

const FIXTURE_GRAPH = {
  schemaVersion: RECOVERY_GRAPH_SCHEMA_VERSION,
  graphVersion: 'kc-dependencies-test-v1',
  purpose: 'test_fixture',
  kcIds: ['KC00', 'KC01', 'KC02', 'KC03', 'KC04'],
  edges: [
    {
      dependentKcId: 'KC01',
      prerequisiteKcId: 'KC00',
      dependencyType: 'FORMAL',
      blocksRoute: true,
    },
    {
      dependentKcId: 'KC02',
      prerequisiteKcId: 'KC01',
      dependencyType: 'FORMAL',
      blocksRoute: true,
    },
    {
      dependentKcId: 'KC03',
      prerequisiteKcId: 'KC02',
      dependencyType: 'PEDAGOGICA',
      blocksRoute: true,
    },
    {
      dependentKcId: 'KC04',
      prerequisiteKcId: 'KC01',
      dependencyType: 'CONCEPTUAL_ANALOGICA',
      blocksRoute: false,
    },
  ],
} as const;

function controller(
  registry = new RecoveryRunRegistry(),
): DeterministicRecoveryController {
  const value = new DeterministicRecoveryController(FIXTURE_POLICY, FIXTURE_GRAPH, { registry });
  value.bindRun({
    runId: 'run-recovery-1',
    purpose: 'test_fixture',
    policyVersion: value.policy.definition.policyVersion,
    policyHash: value.policy.policyHash,
    dependencyGraphVersion: value.graph.definition.graphVersion,
    dependencyGraphHash: value.graph.graphHash,
    recoveryInventoryVersion: 'inventory-test-v1',
    recoveryInventoryHash: HASH,
  });
  return value;
}

function initialized(value: DeterministicRecoveryController): RecoveryRunStateValue {
  return value.applyEvent(null, {
    eventId: 'recovery-event-0',
    eventType: 'recovery.initialized',
    sequenceNumber: 0,
    occurredAt: AT,
    payload: { runId: 'run-recovery-1', participantPseudoId: 'pseudo-recovery-1' },
  }).state;
}

function startEvent(sequenceNumber: number, kcId = 'KC01', failedItemId = `failed-item-${sequenceNumber}`) {
  return {
    eventId: `recovery-event-${sequenceNumber}`,
    eventType: 'recovery.in_block.started' as const,
    sequenceNumber,
    occurredAt: at(sequenceNumber),
    payload: {
      kcId,
      failureAttemptId: `failed-attempt-${sequenceNumber}`,
      failedItemId,
      errorObservationId: `error-${sequenceNumber}`,
      errorCode: 'WRONG_RULE',
      failureAttribution: 'PEDAGOGICAL' as const,
      mode: 'LEARNING_MODE' as const,
    },
  };
}

function cycleEvidence(cycle: 1 | 2 | 3, seed: number) {
  if (cycle === 1) {
    return {
      feedback: { errorCode: 'WRONG_RULE', artifactId: `feedback-${seed}` },
      explanation: { kind: 'worked_example' as const, artifactId: `explanation-${seed}` },
      guidedPractice: { activityId: `guided-${seed}`, itemId: `guided-item-${seed}` },
    };
  }
  if (cycle === 2) {
    return {
      complexity: { fromIndex: 70, toIndex: 40 },
      prerequisite: {
        kcIds: ['KC00'],
        action: 'remediation' as const,
        artifactId: `prerequisite-${seed}`,
      },
      scaffolding: {
        activityId: `scaffolding-${seed}`,
        itemId: `scaffolding-item-${seed}`,
        contingentOnPerformance: true as const,
      },
    };
  }
  return {
    representation: {
      previousRepresentationId: `representation-old-${seed}`,
      alternativeRepresentationId: `representation-new-${seed}`,
      activityId: `alternative-${seed}`,
    },
    selfExplanation: { applied: true as const, promptId: `self-explanation-${seed}` },
    understandingCheck: { activityId: `check-${seed}`, itemId: `check-item-${seed}` },
  };
}

function cycleEvent(
  sequenceNumber: number,
  programId: string,
  cycle: 1 | 2 | 3,
  outcome: 'progress_observed' | 'failed' = 'failed',
  kcId = 'KC01',
) {
  const evidence = cycleEvidence(cycle, sequenceNumber);
  if (cycle === 2 && 'prerequisite' in evidence) {
    const prerequisiteByKc: Readonly<Record<string, string>> = {
      KC01: 'KC00',
      KC02: 'KC01',
      KC03: 'KC02',
      KC04: 'KC01',
    };
    evidence.prerequisite.kcIds = [prerequisiteByKc[kcId] ?? 'KC00'];
  }
  return {
    eventId: `recovery-event-${sequenceNumber}`,
    eventType: 'recovery.in_block.cycle.completed' as const,
    sequenceNumber,
    occurredAt: at(sequenceNumber),
    payload: {
      kcId,
      programId,
      cycle,
      outcome,
      evidence,
    },
  };
}

function opportunityEvent(
  sequenceNumber: number,
  programId: string,
  episodeNumber: 1 | 2,
  kcId = 'KC01',
) {
  return {
    eventId: `recovery-event-${sequenceNumber}`,
    eventType: 'recovery.later.opportunity.available' as const,
    sequenceNumber,
    occurredAt: at(sequenceNumber),
    payload: {
      kcId,
      programId,
      episodeNumber,
      authority: 'recovery_reserve_registry' as const,
      inventoryVersion: 'inventory-test-v1',
      inventoryHash: HASH,
      mode: 'LEARNING_MODE' as const,
      reserve: 'recovery' as const,
      activityId: `later-activity-${sequenceNumber}`,
      itemId: `later-item-${sequenceNumber}`,
    },
  };
}

function episodeStartEvent(
  sequenceNumber: number,
  programId: string,
  episodeNumber: 1 | 2,
  scheduledAtSequence: number,
  kcId = 'KC01',
) {
  return {
    eventId: `recovery-event-${sequenceNumber}`,
    eventType: 'recovery.later.episode.started' as const,
    sequenceNumber,
    occurredAt: at(sequenceNumber),
    payload: {
      kcId,
      programId,
      episodeNumber,
      mode: 'LEARNING_MODE' as const,
      reserve: 'recovery' as const,
      activityId: `later-activity-${scheduledAtSequence}`,
      itemId: `later-item-${scheduledAtSequence}`,
    },
  };
}

function episodeCompleteEvent(
  sequenceNumber: number,
  programId: string,
  episodeNumber: 1 | 2,
  scheduledAtSequence: number,
  outcome: 'progress_observed' | 'failed',
  kcId = 'KC01',
) {
  return {
    eventId: `recovery-event-${sequenceNumber}`,
    eventType: 'recovery.later.episode.completed' as const,
    sequenceNumber,
    occurredAt: at(sequenceNumber),
    payload: {
      kcId,
      reevaluatedKcId: kcId,
      programId,
      episodeNumber,
      activityId: `later-activity-${scheduledAtSequence}`,
      itemId: `later-item-${scheduledAtSequence}`,
      outcome,
      domainEvaluationRequired: true as const,
    },
  };
}

function exhaustInBlock(
  value: DeterministicRecoveryController,
  initial: RecoveryRunStateValue,
  firstSequence: number,
  kcId = 'KC01',
): { state: RecoveryRunStateValue; programId: string; nextSequence: number } {
  let state = value.applyEvent(initial, startEvent(firstSequence, kcId)).state;
  const programId = state.kcs.find((record) => record.kcId === kcId)?.currentProgram?.programId;
  if (programId === undefined) throw new Error('fixture sin programId');
  for (const cycle of [1, 2, 3] as const) {
    state = value.applyEvent(
      state,
      cycleEvent(firstSequence + cycle, programId, cycle, 'failed', kcId),
    ).state;
  }
  return { state, programId, nextSequence: firstSequence + 4 };
}

function runLaterEpisode(
  value: DeterministicRecoveryController,
  state: RecoveryRunStateValue,
  firstSequence: number,
  programId: string,
  episodeNumber: 1 | 2,
  outcome: 'progress_observed' | 'failed',
  kcId = 'KC01',
): { state: RecoveryRunStateValue; nextSequence: number } {
  state = value.applyEvent(state, opportunityEvent(firstSequence, programId, episodeNumber, kcId)).state;
  state = value.applyEvent(
    state,
    episodeStartEvent(firstSequence + 1, programId, episodeNumber, firstSequence, kcId),
  ).state;
  state = value.applyEvent(
    state,
    episodeCompleteEvent(firstSequence + 2, programId, episodeNumber, firstSequence, outcome, kcId),
  ).state;
  return { state, nextSequence: firstSequence + 3 };
}

function expectCode(fn: () => unknown, code: RecoveryEngineError['code']): void {
  try {
    fn();
    throw new Error('se esperaba RecoveryEngineError');
  } catch (error) {
    expect(error).toBeInstanceOf(RecoveryEngineError);
    expect((error as RecoveryEngineError).code).toBe(code);
  }
}

describe('política congelada de recuperación', () => {
  it('materializa literalmente los tres ciclos y el máximo 2 por KC', () => {
    expect(RECOVERY_POLICY_V1.inBlockCycles).toEqual([
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
    ]);
    expect(RECOVERY_POLICY_V1.laterRecovery).toMatchObject({
      maxEpisodesPerKc: 2,
      counterScope: 'kc',
      requiredReserve: 'recovery',
    });
    expect(RECOVERY_POLICY_V1.humanPedagogicalRescue).toBe(false);
    expect(Object.isFrozen(RECOVERY_POLICY_V1)).toBe(true);
  });

  it('exige hashes externos para política y grafo materiales', () => {
    const materialGraph = { ...FIXTURE_GRAPH, purpose: 'material' as const };
    expectCode(
      () => new DeterministicRecoveryController(RECOVERY_POLICY_V1, materialGraph),
      'MATERIAL_FREEZE_REQUIRED',
    );
    const policyHash = compileRecoveryPolicy(RECOVERY_POLICY_V1).policyHash;
    const graphHash = compileRecoveryDependencyGraph(materialGraph).graphHash;
    expect(new DeterministicRecoveryController(RECOVERY_POLICY_V1, materialGraph, {
      expectedPolicyHash: policyHash,
      expectedGraphHash: graphHash,
    }).policy.policyHash).toBe(policyHash);
  });

  it('restaura el binding y rechaza reasignación o deriva', () => {
    const value = controller();
    const restored = new RecoveryRunRegistry(value.registry.bindings());
    expect(controller(restored).registry.bindings()).toEqual(value.registry.bindings());
    expectCode(
      () => restored.bind(value.policy, value.graph, {
        ...value.registry.bindings()[0],
        policyHash: 'b'.repeat(64),
      }),
      'RUN_POLICY_DRIFT',
    );
  });

  it('rechaza drift y ciclos en el grafo bloqueante', () => {
    expectCode(
      () => compileRecoveryDependencyGraph(FIXTURE_GRAPH, 'b'.repeat(64)),
      'DEPENDENCY_GRAPH_DRIFT',
    );
    expectCode(
      () => compileRecoveryDependencyGraph({
        ...FIXTURE_GRAPH,
        edges: [
          ...FIXTURE_GRAPH.edges,
          {
            dependentKcId: 'KC01',
            prerequisiteKcId: 'KC03',
            dependencyType: 'FORMAL',
            blocksRoute: true,
          },
        ],
      }),
      'INVALID_DEPENDENCY_GRAPH',
    );
    expectCode(
      () => compileRecoveryDependencyGraph({
        ...FIXTURE_GRAPH,
        edges: [{ ...FIXTURE_GRAPH.edges[1], blocksRoute: false }],
      }),
      'INVALID_DEPENDENCY_GRAPH',
    );
  });
});

describe('tres ciclos dentro del bloque', () => {
  it('solo inicia en LEARNING_MODE y emite el ciclo 1 exacto', () => {
    const value = controller();
    const state = initialized(value);
    expectCode(
      () => value.applyEvent(state, {
        ...startEvent(1),
        payload: { ...startEvent(1).payload, mode: 'MEASUREMENT_MODE' },
      }),
      'RECOVERY_ORDER_VIOLATION',
    );
    const mutation = value.applyEvent(state, startEvent(1));
    expect(mutation.directive).toMatchObject({
      kind: 'execute_in_block_cycle',
      cycle: 1,
      strategy: 'guided_practice',
    });
    expect(mutation.state.kcs[0]).toMatchObject({
      kcId: 'KC01',
      status: 'in_block_active',
      recoveryEpisodeCount: 0,
    });
    expectCode(
      () => value.applyEvent(state, startEvent(1, 'KC99')),
      'INVALID_RECOVERY_EVENT',
    );
  });

  it('feedback y prerrequisito deben corresponder al fallo y al grafo congelado', () => {
    const value = controller();
    let state = value.applyEvent(initialized(value), startEvent(1)).state;
    const programId = state.kcs[0]?.currentProgram?.programId ?? '';
    const wrongFeedback = cycleEvent(2, programId, 1);
    wrongFeedback.payload.evidence.feedback.errorCode = 'ANOTHER_ERROR';
    expectCode(
      () => value.applyEvent(state, wrongFeedback),
      'RECOVERY_ORDER_VIOLATION',
    );
    state = value.applyEvent(state, cycleEvent(2, programId, 1)).state;
    const wrongPrerequisite = cycleEvent(3, programId, 2);
    wrongPrerequisite.payload.evidence.prerequisite.kcIds = ['KC03'];
    expectCode(
      () => value.applyEvent(state, wrongPrerequisite),
      'RECOVERY_ORDER_VIOLATION',
    );
  });

  it('impone orden 1→2→3 y valida la evidencia literal de cada ciclo', () => {
    const value = controller();
    let state = value.applyEvent(initialized(value), startEvent(1)).state;
    const programId = state.kcs[0]?.currentProgram?.programId ?? '';
    expectCode(
      () => value.applyEvent(state, cycleEvent(2, programId, 2)),
      'RECOVERY_ORDER_VIOLATION',
    );
    state = value.applyEvent(state, cycleEvent(2, programId, 1)).state;
    expect(value.directive(state, 'KC01')).toMatchObject({ cycle: 2, strategy: 'prerequisite_remediation' });
    state = value.applyEvent(state, cycleEvent(3, programId, 2)).state;
    expect(value.directive(state, 'KC01')).toMatchObject({ cycle: 3, strategy: 'self_explanation' });
    state = value.applyEvent(state, cycleEvent(4, programId, 3)).state;
    expect(value.directive(state, 'KC01')).toMatchObject({
      kind: 'inspect_recovery_reserve',
      nextEpisodeNumber: 1,
    });
  });

  it('progreso observado vuelve a evaluación de dominio sin afirmar dominio', () => {
    const value = controller();
    const state = value.applyEvent(initialized(value), startEvent(1)).state;
    const programId = state.kcs[0]?.currentProgram?.programId ?? '';
    const mutation = value.applyEvent(state, cycleEvent(2, programId, 1, 'progress_observed'));
    expect(mutation.directive).toEqual({ kind: 'return_to_domain_evaluation', kcId: 'KC01' });
    expect(mutation.state.kcs[0]).toMatchObject({
      status: 'returned_to_domain_evaluation',
      currentProgram: null,
    });
    expect(JSON.stringify(mutation.state)).not.toContain('"mastered":true');
  });

  it('rechaza repetición mecánica de material y reducción de complejidad falsa', () => {
    const value = controller();
    let state = value.applyEvent(initialized(value), startEvent(1)).state;
    const programId = state.kcs[0]?.currentProgram?.programId ?? '';
    const repeated = cycleEvent(2, programId, 1);
    repeated.payload.evidence.guidedPractice.itemId = 'failed-item-1';
    expectCode(() => value.applyEvent(state, repeated), 'RECOVERY_RESERVE_VIOLATION');
    state = value.applyEvent(state, cycleEvent(2, programId, 1)).state;
    const invalid = cycleEvent(3, programId, 2);
    invalid.payload.evidence.complexity.toIndex = 80;
    expectCode(() => value.applyEvent(state, invalid), 'INVALID_RECOVERY_EVENT');
  });

  it('rechaza propiedades de modelo, BKT o rescate fuera del contrato', () => {
    const value = controller();
    const state = initialized(value);
    for (const extra of [
      { proposedByModel: true },
      { masteryProbabilityShadow: 0.9 },
      { humanTeacherRequested: true },
    ]) {
      expectCode(
        () => value.applyEvent(state, {
          ...startEvent(1),
          eventId: `event-extra-${Object.keys(extra)[0]}`,
          payload: { ...startEvent(1).payload, ...extra },
        }),
        'INVALID_RECOVERY_EVENT',
      );
    }
  });
});

describe('episodios posteriores y límite por KC', () => {
  it('programar no incrementa el contador; consumir el episodio sí', () => {
    const value = controller();
    const exhausted = exhaustInBlock(value, initialized(value), 1);
    let state = value.applyEvent(
      exhausted.state,
      opportunityEvent(exhausted.nextSequence, exhausted.programId, 1),
    ).state;
    expect(state.kcs[0]).toMatchObject({ status: 'later_recovery_scheduled', recoveryEpisodeCount: 0 });
    state = value.applyEvent(
      state,
      episodeStartEvent(exhausted.nextSequence + 1, exhausted.programId, 1, exhausted.nextSequence),
    ).state;
    expect(state.kcs[0]).toMatchObject({ status: 'later_recovery_active', recoveryEpisodeCount: 1 });
  });

  it('exige reserva recovery, autoridad estructurada y material distinto', () => {
    const value = controller();
    const exhausted = exhaustInBlock(value, initialized(value), 1);
    const wrong = opportunityEvent(exhausted.nextSequence, exhausted.programId, 1);
    wrong.payload.itemId = 'failed-item-1';
    expectCode(
      () => value.applyEvent(exhausted.state, wrong),
      'RECOVERY_RESERVE_VIOLATION',
    );
    expectCode(
      () => value.applyEvent(exhausted.state, {
        ...opportunityEvent(exhausted.nextSequence, exhausted.programId, 1),
        payload: {
          ...opportunityEvent(exhausted.nextSequence, exhausted.programId, 1).payload,
          authority: 'model',
        },
      }),
      'INVALID_RECOVERY_EVENT',
    );
    expectCode(
      () => value.applyEvent(exhausted.state, {
        ...opportunityEvent(exhausted.nextSequence, exhausted.programId, 1),
        payload: {
          ...opportunityEvent(exhausted.nextSequence, exhausted.programId, 1).payload,
          inventoryHash: 'b'.repeat(64),
        },
      }),
      'RECOVERY_RESERVE_VIOLATION',
    );
  });

  it('un resultado posterior debe corresponder al episodio y reevaluar el mismo KC', () => {
    const value = controller();
    const exhausted = exhaustInBlock(value, initialized(value), 1);
    let state = value.applyEvent(
      exhausted.state,
      opportunityEvent(exhausted.nextSequence, exhausted.programId, 1),
    ).state;
    state = value.applyEvent(
      state,
      episodeStartEvent(exhausted.nextSequence + 1, exhausted.programId, 1, exhausted.nextSequence),
    ).state;
    expectCode(
      () => value.applyEvent(state, {
        ...episodeCompleteEvent(
          exhausted.nextSequence + 2,
          exhausted.programId,
          1,
          exhausted.nextSequence,
          'failed',
        ),
        payload: {
          ...episodeCompleteEvent(
            exhausted.nextSequence + 2,
            exhausted.programId,
            1,
            exhausted.nextSequence,
            'failed',
          ).payload,
          reevaluatedKcId: 'KC02',
        },
      }),
      'RECOVERY_ORDER_VIOLATION',
    );
  });

  it('un primer episodio fallido programa como máximo el segundo', () => {
    const value = controller();
    const exhausted = exhaustInBlock(value, initialized(value), 1);
    const result = runLaterEpisode(
      value,
      exhausted.state,
      exhausted.nextSequence,
      exhausted.programId,
      1,
      'failed',
    );
    expect(value.directive(result.state, 'KC01')).toMatchObject({
      kind: 'inspect_recovery_reserve',
      nextEpisodeNumber: 2,
    });
    expect(result.state.kcs[0]).toMatchObject({
      recoveryEpisodeCount: 1,
      failedRecoveryEpisodeCount: 1,
    });
  });

  it('dos episodios fallidos del mismo KC declaran límite y cierran dependientes transitivos', () => {
    const value = controller();
    const exhausted = exhaustInBlock(value, initialized(value), 1);
    const first = runLaterEpisode(
      value,
      exhausted.state,
      exhausted.nextSequence,
      exhausted.programId,
      1,
      'failed',
    );
    const second = runLaterEpisode(
      value,
      first.state,
      first.nextSequence,
      exhausted.programId,
      2,
      'failed',
    );
    expect(value.directive(second.state, 'KC01')).toEqual({ kind: 'pedagogical_limit', kcId: 'KC01' });
    expect(second.state.kcs.find((record) => record.kcId === 'KC01')).toMatchObject({
      status: 'pedagogical_limit_observed',
      recoveryEpisodeCount: 2,
      failedRecoveryEpisodeCount: 2,
    });
    expect(second.state.closedRoutes.map((closure) => closure.closedKcId)).toEqual(['KC02', 'KC03']);
    expect(second.state.closedRoutes[1]?.dependencyPath).toEqual(['KC01', 'KC02', 'KC03']);
    expect(value.directive(second.state, 'KC02')).toEqual({
      kind: 'route_closed',
      kcId: 'KC02',
      causeKcId: 'KC01',
    });
    expect(value.directive(second.state, 'KC04')).toEqual({ kind: 'none', kcId: 'KC04' });
  });

  it('dos episodios consumidos son el máximo aun si observaron progreso, sin fabricar límite', () => {
    const value = controller();
    const firstProgram = exhaustInBlock(value, initialized(value), 1);
    const firstEpisode = runLaterEpisode(
      value,
      firstProgram.state,
      firstProgram.nextSequence,
      firstProgram.programId,
      1,
      'progress_observed',
    );
    const secondProgram = exhaustInBlock(value, firstEpisode.state, firstEpisode.nextSequence);
    const secondEpisode = runLaterEpisode(
      value,
      secondProgram.state,
      secondProgram.nextSequence,
      secondProgram.programId,
      2,
      'progress_observed',
    );
    const thirdProgram = exhaustInBlock(value, secondEpisode.state, secondEpisode.nextSequence);
    expect(value.directive(thirdProgram.state, 'KC01')).toEqual({
      kind: 'no_later_recovery',
      kcId: 'KC01',
      reason: 'episode_cap_reached',
    });
    expect(thirdProgram.state.kcs.find((record) => record.kcId === 'KC01')).toMatchObject({
      status: 'not_mastered_recovery_cap_reached',
      recoveryEpisodeCount: 2,
      failedRecoveryEpisodeCount: 0,
      pedagogicalLimitObservedAt: null,
    });
  });

  it('una ruta cerrada no puede iniciar su propia recuperación', () => {
    const value = controller();
    const exhausted = exhaustInBlock(value, initialized(value), 1);
    const first = runLaterEpisode(value, exhausted.state, 5, exhausted.programId, 1, 'failed');
    const second = runLaterEpisode(value, first.state, 8, exhausted.programId, 2, 'failed');
    expectCode(
      () => value.applyEvent(second.state, startEvent(11, 'KC02')),
      'RECOVERY_ORDER_VIOLATION',
    );
  });

  it('límites superpuestos conservan la primera causa y registran todos los caminos', () => {
    const value = controller();
    const kcTwoProgram = exhaustInBlock(value, initialized(value), 1, 'KC02');
    const kcTwoFirst = runLaterEpisode(
      value,
      kcTwoProgram.state,
      kcTwoProgram.nextSequence,
      kcTwoProgram.programId,
      1,
      'failed',
      'KC02',
    );
    const kcTwoLimit = runLaterEpisode(
      value,
      kcTwoFirst.state,
      kcTwoFirst.nextSequence,
      kcTwoProgram.programId,
      2,
      'failed',
      'KC02',
    );
    const kcOneProgram = exhaustInBlock(value, kcTwoLimit.state, kcTwoLimit.nextSequence, 'KC01');
    const kcOneFirst = runLaterEpisode(
      value,
      kcOneProgram.state,
      kcOneProgram.nextSequence,
      kcOneProgram.programId,
      1,
      'failed',
      'KC01',
    );
    const kcOneLimit = runLaterEpisode(
      value,
      kcOneFirst.state,
      kcOneFirst.nextSequence,
      kcOneProgram.programId,
      2,
      'failed',
      'KC01',
    );
    expect(kcOneLimit.state.closedRoutes).toHaveLength(3);
    expect(kcOneLimit.state.kcs.find((record) => record.kcId === 'KC02')).toMatchObject({
      status: 'pedagogical_limit_observed',
      closedByKcId: null,
    });
    expect(kcOneLimit.state.kcs.find((record) => record.kcId === 'KC03')).toMatchObject({
      status: 'route_closed_dependency',
      closedByKcId: 'KC02',
    });
    expect(() => value.applyEvent(
      kcOneLimit.state,
      startEvent(kcOneLimit.nextSequence, 'KC04'),
    )).not.toThrow();
  });

  it('ausencia de reserva deja no dominio sin convertir una falta operativa en límite', () => {
    const value = controller();
    const exhausted = exhaustInBlock(value, initialized(value), 1);
    const mutation = value.applyEvent(exhausted.state, {
      eventId: `recovery-event-${exhausted.nextSequence}`,
      eventType: 'recovery.later.reserve.unavailable',
      sequenceNumber: exhausted.nextSequence,
      occurredAt: at(exhausted.nextSequence),
      payload: {
        kcId: 'KC01',
        programId: exhausted.programId,
        authority: 'recovery_reserve_registry',
        inventoryVersion: 'inventory-test-v1',
        inventoryHash: HASH,
        reason: 'reserve_exhausted',
      },
    });
    expect(mutation.directive).toEqual({
      kind: 'no_later_recovery',
      kcId: 'KC01',
      reason: 'reserve_unavailable',
    });
    expect(mutation.state.kcs[0]).toMatchObject({
      status: 'not_mastered_no_reserve',
      failedRecoveryEpisodeCount: 0,
      pedagogicalLimitObservedAt: null,
    });
  });

  it('cierre operativo queda missing y no consume ni falla un episodio', () => {
    const value = controller();
    const started = value.applyEvent(initialized(value), startEvent(1));
    const programId = started.state.kcs[0]?.currentProgram?.programId ?? '';
    const mutation = value.applyEvent(started.state, {
      eventId: 'recovery-event-2',
      eventType: 'recovery.program.closed_without_pedagogical_outcome',
      sequenceNumber: 2,
      occurredAt: at(2),
      payload: { kcId: 'KC01', programId, reason: 'incident' },
    });
    expect(mutation.directive).toEqual({ kind: 'missing', kcId: 'KC01' });
    expect(mutation.state.kcs[0]).toMatchObject({
      status: 'incomplete_missing',
      recoveryEpisodeCount: 0,
      failedRecoveryEpisodeCount: 0,
    });
  });

  it('el contador pertenece a cada KC, no al conjunto ni a la corrida', () => {
    const value = controller();
    const exhausted = exhaustInBlock(value, initialized(value), 1, 'KC04');
    const one = runLaterEpisode(
      value,
      exhausted.state,
      exhausted.nextSequence,
      exhausted.programId,
      1,
      'failed',
      'KC04',
    );
    const kcOneStart = value.applyEvent(one.state, startEvent(one.nextSequence, 'KC01'));
    expect(kcOneStart.state.kcs.find((record) => record.kcId === 'KC04')).toMatchObject({
      recoveryEpisodeCount: 1,
    });
    expect(kcOneStart.state.kcs.find((record) => record.kcId === 'KC01')).toMatchObject({
      recoveryEpisodeCount: 0,
    });
  });
});

describe('replay y proyección', () => {
  it('replay reproduce exactamente el estado aplicado', () => {
    const value = controller();
    const events: RecoveryEvent[] = [
      {
        eventId: 'recovery-event-0',
        eventType: 'recovery.initialized',
        sequenceNumber: 0,
        occurredAt: AT,
        payload: { runId: 'run-recovery-1', participantPseudoId: 'pseudo-recovery-1' },
      },
      startEvent(1),
    ];
    const direct = value.applyEvent(value.applyEvent(null, events[0]).state, events[1]).state;
    expect(value.replay(events)).toEqual(direct);
  });

  it('rechaza huecos, IDs repetidos, tiempo regresivo y estado adulterado', () => {
    const value = controller();
    const state = initialized(value);
    expectCode(
      () => value.applyEvent(state, { ...startEvent(2), eventId: 'gap-event' }),
      'INVALID_EVENT_SEQUENCE',
    );
    expectCode(
      () => value.applyEvent(state, { ...startEvent(1), eventId: 'recovery-event-0' }),
      'INVALID_EVENT_SEQUENCE',
    );
    expectCode(
      () => value.applyEvent(state, { ...startEvent(1), occurredAt: '2025-01-01T00:00:00.000Z' }),
      'INVALID_EVENT_SEQUENCE',
    );
    expectCode(
      () => value.applyEvent({ ...state, modelDecision: true } as never, startEvent(1)),
      'INVALID_RECOVERY_EVENT',
    );
  });

  it('proyecta ciclo, contador y cierre sin probabilidad sombra', () => {
    const value = controller();
    const started = value.applyEvent(initialized(value), startEvent(1)).state;
    expect(recoveryKcProjection(started, 'KC01')).toEqual({
      status: 'in_block_active',
      inBlockCycle: 1,
      recoveryEpisodeCount: 0,
      failedRecoveryEpisodeCount: 0,
      recoveryActive: true,
      notMastered: false,
      pedagogicalLimitObserved: false,
      routeClosed: false,
      closedByKcId: null,
      selectedStrategy: 'guided_practice',
      assistanceLevel: 2,
      scaffoldingStage: 'scaffolding',
      nextAction: 'execute_recovery_cycle_1',
      updatedAt: at(1),
    });
    expect(RecoveryKcStatus.parse('in_block_active')).toBe('in_block_active');
    expect(JSON.stringify(recoveryKcProjection(started, 'KC01'))).not.toContain('probability');
  });

  it('los esquemas de estado son estrictos y el estado está congelado', () => {
    const value = controller();
    const state = value.applyEvent(initialized(value), startEvent(1)).state;
    expect(RecoveryRunState.safeParse({ ...state, bkt: 0.8 }).success).toBe(false);
    expect(RecoveryRunState.safeParse({
      ...state,
      kcs: [{ ...state.kcs[0], recoveryEpisodeCount: 1 }],
    }).success).toBe(false);
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.kcs[0])).toBe(true);
  });
});
