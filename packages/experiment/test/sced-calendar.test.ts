import { describe, expect, it } from 'vitest';

import {
  DeterministicScedCalendar,
  SCED_CALENDAR_STATE_SCHEMA_VERSION,
  ScedCalendarError,
  ScedCalendarState,
  ScedCalendarRunRegistry,
  compileScedCalendarPolicy,
  compileScedCalendarSeed,
  createScedCalendarPolicyDefinition,
  deriveRestrictedPlannedStarts,
  evaluateBaselineStability,
  type ScedCalendarEvent,
  type ScedCalendarState as ScedCalendarStateValue,
  type ScedSetId,
} from '../src/index.js';

const AT = '2026-08-17T04:00:00.000Z';
const POLICY = createScedCalendarPolicyDefinition({
  policyVersion: 'sced-calendar-test-v1',
  purpose: 'test_fixture',
});
const SEED = {
  schemaVersion: 'sced-calendar-seed-v1' as const,
  seedVersion: 'sced-calendar-seed-test-v1',
  purpose: 'test_fixture' as const,
  seedId: 'sced-calendar-seed-test',
  seedValue: 'private-calendar-seed-test-value',
};

function at(index: number): string {
  return new Date(Date.parse(AT) + index * 60_000).toISOString();
}

function expectCode(action: () => unknown, code: ScedCalendarError['code']): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ScedCalendarError);
    expect((error as ScedCalendarError).code).toBe(code);
    return;
  }
  throw new Error('se esperaba ScedCalendarError');
}

function calendar(runId = 'run-sced-test-1'): DeterministicScedCalendar {
  const value = new DeterministicScedCalendar(POLICY, SEED);
  value.bindRun(value.expectedBinding(runId));
  return value;
}

function initialized(
  value: DeterministicScedCalendar,
  runId = 'run-sced-test-1',
): ScedCalendarStateValue {
  return value.applyEvent(null, {
    eventId: 'sced-event-0',
    eventType: 'sced.initialized',
    sequenceNumber: 0,
    occurredAt: AT,
    payload: { runId, participantPseudoId: 'pseudo-sced-test-1' },
  }).state;
}

type Fraction = readonly [correct: number, valid: number];

function validResult(
  request: { opportunityId: string; probeRoundId: string | null },
  [correct, valid]: Fraction = [1, 2],
) {
  return {
    opportunityId: request.opportunityId,
    probeRoundId: request.probeRoundId,
    plannedItems: 3,
    validScoredItems: valid,
    correctValidItems: correct,
    observation: correct / valid,
    operationalValidity: 'valid' as const,
    reasonCode: null,
  };
}

function invalidResult(
  request: { opportunityId: string; probeRoundId: string | null },
) {
  return {
    opportunityId: request.opportunityId,
    probeRoundId: request.probeRoundId,
    plannedItems: 3,
    validScoredItems: 1,
    correctValidItems: 1,
    observation: null,
    operationalValidity: 'invalid' as const,
    reasonCode: 'invalid_participant_pause',
  };
}

interface RoundRun {
  readonly state: ScedCalendarStateValue;
  readonly events: readonly ScedCalendarEvent[];
  readonly requests: readonly { opportunityId: string; probeRoundId: string | null }[];
}

function runRound(
  value: DeterministicScedCalendar,
  state: ScedCalendarStateValue,
  fractions: Partial<Record<ScedSetId, Fraction>> = {},
  invalidSet?: ScedSetId,
): RoundRun {
  const roundId = `sced-round-${state.roundAttemptCount + 1}`;
  const openEvent = {
    eventId: roundId,
    eventType: 'sced.round.opened' as const,
    sequenceNumber: state.revision + 1,
    occurredAt: at(state.revision + 1),
    payload: { roundId },
  };
  const opened = value.applyEvent(state, openEvent);
  const events: ScedCalendarEvent[] = [openEvent];
  let next = opened.state;
  for (const setId of ['A', 'B', 'C'] as const) {
    const request = opened.probeRequests.find((candidate) => candidate.experimentalSet === setId);
    if (request === undefined) throw new Error('solicitud de fixture ausente');
    const resultEvent = {
      eventId: `sced-result-${next.revision + 1}-${setId}`,
      eventType: 'sced.round.result_recorded' as const,
      sequenceNumber: next.revision + 1,
      occurredAt: at(next.revision + 1),
      payload: {
        roundId,
        setId,
        result: invalidSet === setId
          ? invalidResult(request)
          : validResult(request, fractions[setId] ?? [1, 2]),
      },
    };
    next = value.applyEvent(next, resultEvent).state;
    events.push(resultEvent);
  }
  return { state: next, events, requests: opened.probeRequests };
}

function runUntil(
  value: DeterministicScedCalendar,
  state: ScedCalendarStateValue,
  targetValidRound: number,
  fractionsForRound: (round: number) => Partial<Record<ScedSetId, Fraction>> = () => ({}),
): ScedCalendarStateValue {
  let next = state;
  while (next.validRoundCount < targetValidRound) {
    const target = next.validRoundCount + 1;
    next = runRound(value, next, fractionsForRound(target)).state;
  }
  return next;
}

function fractionAt(value: number): Fraction {
  if (value === 0) return [0, 2];
  if (value === 1 / 3) return [1, 3];
  if (value === 1 / 2) return [1, 2];
  if (value === 2 / 3) return [2, 3];
  if (value === 1) return [2, 2];
  throw new Error(`fracción de fixture no representable: ${value}`);
}

function runIdWith(
  predicate: (starts: Readonly<Record<ScedSetId, number>>) => boolean,
): string {
  const policy = compileScedCalendarPolicy(POLICY);
  const seed = compileScedCalendarSeed(SEED);
  for (let index = 1; index <= 500; index += 1) {
    const runId = `run-sced-candidate-${index}`;
    if (predicate(deriveRestrictedPlannedStarts(policy, seed, runId))) return runId;
  }
  throw new Error('no se encontró corrida fixture para el predicado');
}

describe('freeze, semilla y binding del calendario', () => {
  it('fija literalmente ventanas, estabilidad, extensión, conteo y retención', () => {
    expect(POLICY).toMatchObject({
      authority: 'measurement_worker',
      roundUnit: 'probe_round',
      requiredSets: ['A', 'B', 'C'],
      windows: { A: { start: 6, end: 8 }, B: { start: 9, end: 11 }, C: { start: 12, end: 14 } },
      minimumStartSeparationValidRounds: 3,
      maximumExtensionValidRounds: 2,
      stabilityRule: { lastValidObservations: 3, recentHistoricMaxima: 2 },
      roundValidityRule: 'all_required_sets_valid',
      partialValidDataUse: 'descriptive_only',
      opportunityDefinition: { kSet: 3, minValidItemsPerOpportunity: 2, requiredValidRounds: 19 },
      retentionRule: { intervalCalendarDays: 7, reserve: 'retention', countsAsProbeRound: false },
    });
  });

  it('elige reproduciblemente sólo triples dentro de ventana y separados por tres', () => {
    const value = calendar();
    const starts = value.expectedBinding('run-sced-test-1').plannedStarts;
    expect(starts.A).toBeGreaterThanOrEqual(6);
    expect(starts.A).toBeLessThanOrEqual(8);
    expect(starts.B).toBeGreaterThanOrEqual(9);
    expect(starts.B).toBeLessThanOrEqual(11);
    expect(starts.C).toBeGreaterThanOrEqual(12);
    expect(starts.C).toBeLessThanOrEqual(14);
    expect(starts.B - starts.A).toBeGreaterThanOrEqual(3);
    expect(starts.C - starts.B).toBeGreaterThanOrEqual(3);
    expect(value.expectedBinding('run-sced-test-1').plannedStarts).toEqual(starts);
  });

  it('material exige hashes externos exactos sin fabricar freeze', () => {
    const materialPolicy = { ...POLICY, purpose: 'material' as const };
    const materialSeed = { ...SEED, purpose: 'material' as const };
    const compiledPolicy = compileScedCalendarPolicy(materialPolicy);
    const compiledSeed = compileScedCalendarSeed(materialSeed);
    expectCode(
      () => new DeterministicScedCalendar(materialPolicy, materialSeed),
      'MATERIAL_FREEZE_REQUIRED',
    );
    expect(() => new DeterministicScedCalendar(materialPolicy, materialSeed, {
      expectedPolicyHash: compiledPolicy.policyHash,
      expectedSeedHash: compiledSeed.seedHash,
    })).not.toThrow();
    expectCode(
      () => compileScedCalendarSeed(materialSeed, 'a'.repeat(64)),
      'ARTIFACT_HASH_MISMATCH',
    );
  });

  it('restaura binding y rechaza reasignar puntos o semilla', () => {
    const first = calendar();
    const restored = new ScedCalendarRunRegistry(first.registry.bindings());
    const second = new DeterministicScedCalendar(POLICY, SEED, { registry: restored });
    expect(second.registry.bindings()).toEqual(first.registry.bindings());
    expectCode(
      () => second.bindRun({ ...second.expectedBinding('run-sced-test-1'), plannedStarts: { A: 8, B: 11, C: 14 } }),
      'RUN_POLICY_DRIFT',
    );
  });

  it('el estado guarda hashes y puntos, nunca el valor privado de semilla', () => {
    const value = calendar();
    const state = initialized(value);
    expect(state.schemaVersion).toBe(SCED_CALENDAR_STATE_SCHEMA_VERSION);
    expect(JSON.stringify(state)).not.toContain(SEED.seedValue);
    expect(state).not.toHaveProperty('realIdentity');
    expect(state).not.toHaveProperty('modelProposal');
    expect(Object.isFrozen(state)).toBe(true);
  });
});

describe('ronda global y observación primaria', () => {
  it('abre una ronda con exactamente A/B/C y solicitudes primarias internas', () => {
    const value = calendar();
    const result = runRound(value, initialized(value));
    expect(result.requests).toHaveLength(3);
    expect(result.requests.map((request) => request.experimentalSet)).toEqual(['A', 'B', 'C']);
    expect(result.requests.every((request) =>
      request.probeRoundId === 'sced-round-1' &&
      request.measureKind === 'primary_probe' &&
      request.phase === 'baseline'
    )).toBe(true);
    expect(JSON.stringify(result.requests)).not.toMatch(/seed|plannedStart|window/iu);
  });

  it('avanza una sola ronda cuando los tres conjuntos producen observación válida', () => {
    const value = calendar();
    const result = runRound(value, initialized(value), { A: [2, 3], B: [1, 2], C: [0, 2] });
    const round = result.state.rounds[0];
    expect(round).toMatchObject({
      targetValidRoundIndex: 1,
      status: 'closed',
      calendarValidity: 'valid',
      reasonCode: null,
    });
    expect(result.state.validRoundCount).toBe(1);
    expect(result.state.sets.map((set) => set.baselineObservations[0]?.observation)).toEqual([
      2 / 3,
      0.5,
      0,
    ]);
  });

  it('una oportunidad inválida vuelve schedule_invalid toda la ronda y no alimenta series', () => {
    const value = calendar();
    const result = runRound(value, initialized(value), { A: [2, 3], C: [0, 2] }, 'B');
    expect(result.state.rounds[0]).toMatchObject({
      targetValidRoundIndex: 1,
      calendarValidity: 'schedule_invalid',
      reasonCode: 'schedule_invalid',
    });
    expect(result.state.rounds[0]?.opportunities.map((entry) => entry.scheduleValidity)).toEqual([
      'primary_valid',
      'schedule_invalid',
      'primary_valid',
    ]);
    expect(result.state.validRoundCount).toBe(0);
    expect(result.state.sets.every((set) => set.baselineObservations.length === 0)).toBe(true);
    const retry = runRound(value, result.state);
    expect(retry.state.rounds[1]?.targetValidRoundIndex).toBe(1);
  });

  it('rechaza que validez y mínimo H5 se contradigan', () => {
    const value = calendar();
    const state = initialized(value);
    const roundId = 'manual-round-minimum';
    const opened = value.applyEvent(state, {
      eventId: roundId,
      eventType: 'sced.round.opened',
      sequenceNumber: 1,
      occurredAt: at(1),
      payload: { roundId },
    });
    const request = opened.probeRequests[0];
    if (request === undefined) throw new Error('fixture incompleto');
    expectCode(() => value.applyEvent(opened.state, {
      eventId: 'manual-result-minimum',
      eventType: 'sced.round.result_recorded',
      sequenceNumber: 2,
      occurredAt: at(2),
      payload: {
        roundId,
        setId: 'A',
        result: { ...validResult(request), validScoredItems: 1, correctValidItems: 1, observation: 1 },
      },
    }), 'INVALID_RESULT');
    expectCode(() => value.applyEvent(opened.state, {
      eventId: 'manual-result-invalid-above-minimum',
      eventType: 'sced.round.result_recorded',
      sequenceNumber: 2,
      occurredAt: at(2),
      payload: {
        roundId,
        setId: 'A',
        result: {
          ...invalidResult(request),
          validScoredItems: 2,
          correctValidItems: 1,
        },
      },
    }), 'INVALID_RESULT');
  });

  it('no abre otra ronda mientras falte un resultado', () => {
    const value = calendar();
    const state = initialized(value);
    const opened = value.applyEvent(state, {
      eventId: 'partial-round',
      eventType: 'sced.round.opened',
      sequenceNumber: 1,
      occurredAt: at(1),
      payload: { roundId: 'partial-round' },
    });
    expectCode(() => value.applyEvent(opened.state, {
      eventId: 'other-round',
      eventType: 'sced.round.opened',
      sequenceNumber: 2,
      occurredAt: at(2),
      payload: { roundId: 'other-round' },
    }), 'ACTIVE_ROUND_EXISTS');
  });

  it('transferencia, retención, familiarización, diagnóstico y reconfirmación no avanzan ventanas', () => {
    const value = calendar();
    let state = initialized(value);
    expectCode(() => value.applyEvent(state, {
      eventId: 'retention-without-set',
      eventType: 'sced.non_round.recorded',
      sequenceNumber: 1,
      occurredAt: at(1),
      payload: {
        activityId: 'retention-without-set',
        kind: 'retention',
        experimentalSet: null,
        referenceId: 'retention-without-set',
      },
    }), 'INVALID_EVENT');
    for (const [index, kind] of [
      'transfer_measurement',
      'retention',
      'familiarization',
      'diagnostic',
      'post_mastery_reconfirmation',
    ].entries()) {
      state = value.applyEvent(state, {
        eventId: `non-round-event-${index}`,
        eventType: 'sced.non_round.recorded',
        sequenceNumber: state.revision + 1,
        occurredAt: at(state.revision + 1),
        payload: {
          activityId: `non-round-activity-${index}`,
          kind,
          experimentalSet: [0, 1, 4].includes(index) ? 'A' : null,
          referenceId: `non-round-reference-${index}`,
        },
      }).state;
    }
    expect(state.nonRoundActivities).toHaveLength(5);
    expect(state.validRoundCount).toBe(0);
    expect(state.roundAttemptCount).toBe(0);
  });

  it('detiene nuevas rondas al completar el sobre H5 de 19', () => {
    const value = calendar();
    const state = runUntil(value, initialized(value), 19);
    expect(state.validRoundCount).toBe(19);
    expectCode(() => value.applyEvent(state, {
      eventId: 'round-after-envelope',
      eventType: 'sced.round.opened',
      sequenceNumber: state.revision + 1,
      occurredAt: at(state.revision + 1),
      payload: { roundId: 'round-after-envelope' },
    }), 'CALENDAR_COMPLETE');
  });
});

describe('estabilidad, diferimiento y separación', () => {
  it('implementa las dos condiciones literales sobre historia válida', () => {
    expect(evaluateBaselineStability([0, 1 / 3, 2 / 3])).toMatchObject({
      strictlyIncreasing: true,
      lastTwoSuccessiveHistoricMaxima: true,
      stable: false,
    });
    expect(evaluateBaselineStability([0.5, 0.25, 0.5])).toMatchObject({
      strictlyIncreasing: false,
      lastTwoSuccessiveHistoricMaxima: false,
      stable: true,
    });
    expectCode(() => evaluateBaselineStability([0, 1]), 'INVALID_STATE');
  });

  it('inicia A después de la ronda planificada cuando la línea es estable', () => {
    const value = calendar();
    const initial = initialized(value);
    const planned = initial.plannedStarts.A;
    const state = runUntil(value, initial, planned);
    const setA = state.sets[0];
    expect(setA).toMatchObject({
      startStatus: 'started',
      interventionStartedAfterValidRound: planned,
    });
    expect(setA?.startEvaluations.at(-1)).toMatchObject({
      validRoundIndex: planned,
      eligible: true,
      decision: 'start_after_round',
    });
    const next = runRound(value, state);
    expect(next.requests.find((request) => request.experimentalSet === 'A')?.phase).toBe('intervention');
  });

  it('difiere una ronda válida por vez sin re-aleatorizar y luego inicia', () => {
    const runId = runIdWith((starts) => starts.A < 8);
    const value = calendar(runId);
    const initial = initialized(value, runId);
    const planned = initial.plannedStarts.A;
    const fractions = (round: number) => {
      if (round === planned - 2) return { A: fractionAt(0) };
      if (round === planned - 1) return { A: fractionAt(1 / 3) };
      if (round === planned) return { A: fractionAt(1 / 2) };
      return { A: fractionAt(1 / 2) };
    };
    const atPlanned = runUntil(value, initial, planned, fractions);
    expect(atPlanned.sets[0]?.startEvaluations.at(-1)).toMatchObject({
      decision: 'defer',
      strictlyIncreasing: true,
    });
    expect(atPlanned.plannedStarts.A).toBe(planned);
    const afterOne = runUntil(value, atPlanned, planned + 1, fractions);
    expect(afterOne.sets[0]).toMatchObject({
      startStatus: 'started',
      interventionStartedAfterValidRound: planned + 1,
    });
  });

  it('no inicia si la condición falla hasta el límite de extensión dentro de ventana', () => {
    const value = calendar();
    const initial = initialized(value);
    const deadline = initial.sets[0]?.extensionDeadline ?? 0;
    const rising = [0, 1 / 3, 1 / 2, 2 / 3, 1];
    const state = runUntil(value, initial, deadline, (round) => {
      const offset = round - (deadline - 4);
      return offset >= 0 && offset < rising.length
        ? { A: fractionAt(rising[offset] ?? 0) }
        : { A: fractionAt(0) };
    });
    expect(state.sets[0]).toMatchObject({
      startStatus: 'not_started_under_preinscription',
      interventionStartedAfterValidRound: null,
      terminalStartReason: 'preinscription_window_exhausted',
    });
    expect(state.sets[0]?.startEvaluations.at(-1)).toMatchObject({
      validRoundIndex: deadline,
      eligible: false,
      decision: 'not_start_under_preinscription',
    });
  });

  it('conserva separación mínima entre inicios efectivos aunque A se difiera', () => {
    const runId = runIdWith(
      (starts) => starts.B - starts.A === 3 && starts.A < 8 && starts.B < 11,
    );
    const value = calendar(runId);
    const initial = initialized(value, runId);
    const plannedA = initial.plannedStarts.A;
    const plannedB = initial.plannedStarts.B;
    const state = runUntil(value, initial, plannedB + 1, (round) => {
      if (round === plannedA - 2) return { A: fractionAt(0) };
      if (round === plannedA - 1) return { A: fractionAt(1 / 3) };
      if (round >= plannedA) return { A: fractionAt(1 / 2) };
      return {};
    });
    expect(state.sets[0]?.interventionStartedAfterValidRound).toBe(plannedA + 1);
    const setB = state.sets[1];
    expect(setB?.startEvaluations.find((entry) => entry.validRoundIndex === plannedB)).toMatchObject({
      separationSatisfied: false,
      decision: 'defer',
    });
    expect(setB?.interventionStartedAfterValidRound).toBe(plannedB + 1);
    expect(
      (setB?.interventionStartedAfterValidRound ?? 0) -
      (state.sets[0]?.interventionStartedAfterValidRound ?? 0),
    ).toBeGreaterThanOrEqual(3);
  });

  it('una ronda inválida no se usa para estabilidad ni consume extensión', () => {
    const value = calendar();
    let state = initialized(value);
    const planned = state.plannedStarts.A;
    state = runUntil(value, state, planned - 1);
    const invalid = runRound(value, state, { A: [2, 2] }, 'B').state;
    expect(invalid.validRoundCount).toBe(planned - 1);
    expect(invalid.sets[0]?.baselineObservations).toHaveLength(planned - 1);
    expect(invalid.sets[0]?.startEvaluations).toHaveLength(0);
    const valid = runRound(value, invalid).state;
    expect(valid.validRoundCount).toBe(planned);
    expect(valid.sets[0]?.startEvaluations).toHaveLength(1);
  });
});

describe('covariación y retención por conjunto', () => {
  it('registra un cambio de línea base concurrente con intervención ajena', () => {
    const value = calendar();
    let state = initialized(value);
    state = runUntil(value, state, state.plannedStarts.A);
    const afterStart = runRound(value, state, { B: [2, 2] }).state;
    expect(afterStart.covariationRecords).toContainEqual(expect.objectContaining({
      validRoundIndex: state.validRoundCount + 1,
      unintervenedSet: 'B',
      concurrentInterventionSets: ['A'],
      previousObservation: 0.5,
      observation: 1,
      direction: 'increase',
    }));
    const unchanged = runRound(value, afterStart, { B: [2, 2] }).state;
    expect(unchanged.covariationRecords).toHaveLength(afterStart.covariationRecords.length);
  });

  it('programa retención exactamente siete días desde dominio y fuera de probe_round', () => {
    const value = calendar();
    let state = initialized(value);
    state = runUntil(value, state, state.plannedStarts.A);
    const countBefore = state.validRoundCount;
    const masteryAt = new Date(Date.parse(state.updatedAt) + 60_000).toISOString();
    state = value.applyEvent(state, {
      eventId: 'set-mastery-A',
      eventType: 'sced.set_mastery.recorded',
      sequenceNumber: state.revision + 1,
      occurredAt: masteryAt,
      payload: { setId: 'A' },
    }).state;
    const dueAt = new Date(Date.parse(masteryAt) + 7 * 24 * 60 * 60 * 1_000).toISOString();
    expect(state.sets[0]?.retention).toMatchObject({ status: 'scheduled', dueAt });
    expectCode(() => value.applyEvent(state, {
      eventId: 'retention-A-too-early',
      eventType: 'sced.retention.opened',
      sequenceNumber: state.revision + 1,
      occurredAt: new Date(Date.parse(dueAt) - 1).toISOString(),
      payload: { setId: 'A' },
    }), 'RETENTION_NOT_DUE');
    const opened = value.applyEvent(state, {
      eventId: 'retention-A-open',
      eventType: 'sced.retention.opened',
      sequenceNumber: state.revision + 1,
      occurredAt: dueAt,
      payload: { setId: 'A' },
    });
    const request = opened.probeRequests[0];
    expect(request).toMatchObject({
      probeRoundId: null,
      experimentalSet: 'A',
      phase: 'retention',
      measureKind: 'retention_probe',
    });
    if (request === undefined) throw new Error('fixture de retención incompleto');
    state = value.applyEvent(opened.state, {
      eventId: 'retention-A-result',
      eventType: 'sced.retention.result_recorded',
      sequenceNumber: opened.state.revision + 1,
      occurredAt: new Date(Date.parse(dueAt) + 60_000).toISOString(),
      payload: { setId: 'A', result: validResult(request) },
    }).state;
    expect(state.sets[0]?.retention.status).toBe('completed');
    expect(state.validRoundCount).toBe(countBefore);
  });

  it('bloquea reenseñanza dirigida desde dominio hasta observar retención', () => {
    const value = calendar();
    let state = initialized(value);
    state = runUntil(value, state, state.plannedStarts.A);
    state = value.applyEvent(state, {
      eventId: 'instruction-before-mastery',
      eventType: 'sced.target_instruction.recorded',
      sequenceNumber: state.revision + 1,
      occurredAt: new Date(Date.parse(state.updatedAt) + 60_000).toISOString(),
      payload: { setId: 'A', referenceId: 'instruction-before' },
    }).state;
    const masteryAt = new Date(Date.parse(state.updatedAt) + 60_000).toISOString();
    state = value.applyEvent(state, {
      eventId: 'mastery-for-blackout',
      eventType: 'sced.set_mastery.recorded',
      sequenceNumber: state.revision + 1,
      occurredAt: masteryAt,
      payload: { setId: 'A' },
    }).state;
    expectCode(() => value.applyEvent(state, {
      eventId: 'instruction-during-blackout',
      eventType: 'sced.target_instruction.recorded',
      sequenceNumber: state.revision + 1,
      occurredAt: new Date(Date.parse(masteryAt) + 60_000).toISOString(),
      payload: { setId: 'A', referenceId: 'instruction-blocked' },
    }), 'RETENTION_BLACKOUT');
  });

  it('rechaza dominio antes de intervención y resultado de otra retención', () => {
    const value = calendar();
    let state = initialized(value);
    expectCode(() => value.applyEvent(state, {
      eventId: 'premature-mastery',
      eventType: 'sced.set_mastery.recorded',
      sequenceNumber: 1,
      occurredAt: at(1),
      payload: { setId: 'A' },
    }), 'INVALID_EVENT');
    state = runUntil(value, state, state.plannedStarts.A);
    const masteryAt = new Date(Date.parse(state.updatedAt) + 60_000).toISOString();
    state = value.applyEvent(state, {
      eventId: 'mastery-for-mismatch',
      eventType: 'sced.set_mastery.recorded',
      sequenceNumber: state.revision + 1,
      occurredAt: masteryAt,
      payload: { setId: 'A' },
    }).state;
    const dueAt = state.sets[0]?.retention.dueAt ?? '';
    const opened = value.applyEvent(state, {
      eventId: 'retention-for-mismatch',
      eventType: 'sced.retention.opened',
      sequenceNumber: state.revision + 1,
      occurredAt: dueAt,
      payload: { setId: 'A' },
    });
    const request = opened.probeRequests[0];
    if (request === undefined) throw new Error('fixture incompleto');
    expectCode(() => value.applyEvent(opened.state, {
      eventId: 'wrong-retention-result',
      eventType: 'sced.retention.result_recorded',
      sequenceNumber: opened.state.revision + 1,
      occurredAt: new Date(Date.parse(dueAt) + 60_000).toISOString(),
      payload: {
        setId: 'A',
        result: { ...validResult(request), opportunityId: 'another-opportunity' },
      },
    }), 'INVALID_RESULT');
  });
});

describe('replay y restauración', () => {
  it('replay reproduce rondas válidas, inválidas y actividades no SCED', () => {
    const value = calendar();
    const initEvent: ScedCalendarEvent = {
      eventId: 'sced-event-0',
      eventType: 'sced.initialized',
      sequenceNumber: 0,
      occurredAt: AT,
      payload: { runId: 'run-sced-test-1', participantPseudoId: 'pseudo-sced-test-1' },
    };
    let state = value.applyEvent(null, initEvent).state;
    const first = runRound(value, state);
    state = first.state;
    const second = runRound(value, state, {}, 'C');
    state = second.state;
    const nonRoundEvent: ScedCalendarEvent = {
      eventId: 'replay-transfer-event',
      eventType: 'sced.non_round.recorded',
      sequenceNumber: state.revision + 1,
      occurredAt: at(state.revision + 1),
      payload: {
        activityId: 'replay-transfer',
        kind: 'transfer_measurement',
        experimentalSet: 'A',
        referenceId: 'transfer-result-1',
      },
    };
    state = value.applyEvent(state, nonRoundEvent).state;
    const events = [initEvent, ...first.events, ...second.events, nonRoundEvent];
    expect(value.replay(events)).toEqual(state);
  });

  it('rechaza secuencia, tiempo, puntos, fase o conteo adulterados', () => {
    const value = calendar();
    const state = initialized(value);
    expectCode(() => value.applyEvent(state, {
      eventId: 'gap-round',
      eventType: 'sced.round.opened',
      sequenceNumber: 2,
      occurredAt: at(2),
      payload: { roundId: 'gap-round' },
    }), 'INVALID_EVENT_SEQUENCE');
    expectCode(() => value.applyEvent(state, {
      eventId: 'backward-round',
      eventType: 'sced.round.opened',
      sequenceNumber: 1,
      occurredAt: '2026-08-17T03:59:59.000Z',
      payload: { roundId: 'backward-round' },
    }), 'INVALID_EVENT_SEQUENCE');
    const tamperedStarts = { ...state, plannedStarts: { ...state.plannedStarts, A: 8 } };
    expect(ScedCalendarState.safeParse(tamperedStarts).success).toBe(true);
    expectCode(() => value.applyEvent(tamperedStarts as ScedCalendarStateValue, {
      eventId: 'after-tampered-starts',
      eventType: 'sced.non_round.recorded',
      sequenceNumber: 1,
      occurredAt: at(1),
      payload: {
        activityId: 'tampered-activity',
        kind: 'diagnostic',
        experimentalSet: null,
        referenceId: 'diagnostic-1',
      },
    }), 'INVALID_STATE');

    const completed = runRound(value, state).state;
    const round = completed.rounds[0];
    if (round === undefined) throw new Error('fixture incompleto');
    const tamperedPhase = {
      ...completed,
      rounds: [{
        ...round,
        opportunities: round.opportunities.map((entry, index) => index === 0
          ? { ...entry, request: { ...entry.request, phase: 'intervention' as const } }
          : entry),
      }],
    };
    expect(ScedCalendarState.safeParse(tamperedPhase).success).toBe(true);
    expectCode(() => value.applyEvent(tamperedPhase as ScedCalendarStateValue, {
      eventId: 'after-tampered-phase',
      eventType: 'sced.non_round.recorded',
      sequenceNumber: completed.revision + 1,
      occurredAt: at(completed.revision + 1),
      payload: {
        activityId: 'tampered-phase-activity',
        kind: 'diagnostic',
        experimentalSet: null,
        referenceId: 'diagnostic-2',
      },
    }), 'INVALID_STATE');
  });

  it('el estado estricto excluye semilla, identidad real, decisión de modelo e imputación', () => {
    const value = calendar();
    const state = initialized(value);
    for (const extra of [
      { seedValue: 'leak' },
      { realIdentity: 'persona' },
      { modelChosenStart: 6 },
      { imputedObservation: 0.5 },
    ]) {
      expect(ScedCalendarState.safeParse({ ...state, ...extra }).success).toBe(false);
    }
  });
});
