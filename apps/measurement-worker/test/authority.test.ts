import { describe, expect, it } from 'vitest';

import {
  ATOMIC_PROBE_CONSUMPTION_SQL,
  DeterministicMeasurementAuthority,
  MEASUREMENT_INVENTORY_SCHEMA_VERSION,
  MEASUREMENT_POLICY_SCHEMA_VERSION,
  MEASUREMENT_SEED_SCHEMA_VERSION,
  MEASUREMENT_STATE_SCHEMA_VERSION,
  MeasurementAuthorityError,
  MeasurementRunRegistry,
  MeasurementRunState,
  compileMeasurementInventory,
  compileMeasurementPolicy,
  compileMeasurementSeed,
  createMeasurementAuthorityPolicyDefinition,
  priorConsumptionBlocks,
  requestedReserve,
  type MeasurementEvent,
  type MeasurementRunState as MeasurementRunStateValue,
} from '../src/index.js';

const AT = '2026-08-17T02:00:00.000Z';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const PACKAGE_VERSION = {
  artifactId: 'content-package-measurement-fixture',
  version: 'fixture-v1',
  hash: HASH_A,
} as const;

function at(second: number): string {
  return `2026-08-17T02:00:${String(second).padStart(2, '0')}.000Z`;
}

const POLICY = createMeasurementAuthorityPolicyDefinition({
  policyVersion: 'measurement-authority-test-v1',
  purpose: 'test_fixture',
  reasonPolicy: [
    { reasonCode: 'invalid_participant_pause', operationalValidity: 'invalid' },
    { reasonCode: 'missing_session_time', operationalValidity: 'missing' },
    { reasonCode: 'withdrawal', operationalValidity: 'missing' },
    { reasonCode: 'schedule_invalid', operationalValidity: 'invalid' },
    { reasonCode: 'timeout', operationalValidity: 'invalid' },
    { reasonCode: 'incident', operationalValidity: 'invalid' },
    { reasonCode: 'reserve_exhausted', operationalValidity: 'missing' },
  ],
  incidentTaxonomy: [
    { incidentCode: 'fixture_minor', level: 1, validityEffect: 'continue' },
    { incidentCode: 'fixture_localized', level: 2, validityEffect: 'invalidate_act' },
    { incidentCode: 'fixture_systemic', level: 3, validityEffect: 'invalidate_run' },
  ],
});

function item(
  itemId: string,
  reserve: 'probes_baseline' | 'TRANSFER_MEASUREMENT' | 'retention',
  experimentalSet = 'A',
) {
  return {
    itemId,
    itemFamilyId: `family-${itemId}`,
    structuralSignature: HASH_B,
    experimentalSet,
    reserve,
    prompt: {
      itemId,
      statement: `Demuestra el reactivo ${itemId}.`,
      premises: ['A'],
      goal: 'A',
      responseFormat: 'fitch_proof' as const,
    },
    timeLimitSeconds: 90,
    verifierContract: 'authorized-calculus-v1',
  };
}

function inventory(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: MEASUREMENT_INVENTORY_SCHEMA_VERSION,
    inventoryVersion: 'measurement-inventory-test-v1',
    purpose: 'test_fixture',
    packageVersion: PACKAGE_VERSION,
    plans: [
      {
        planId: 'plan-primary-A-baseline',
        experimentalSet: 'A',
        phase: 'baseline',
        measureKind: 'primary_probe',
        reserve: 'probes_baseline',
        batchSize: 3,
        minValidItems: 2,
      },
      {
        planId: 'plan-transfer-A',
        experimentalSet: 'A',
        phase: 'intervention',
        measureKind: 'transfer_measurement',
        reserve: 'TRANSFER_MEASUREMENT',
        batchSize: 2,
        minValidItems: 1,
      },
      {
        planId: 'plan-retention-A',
        experimentalSet: 'A',
        phase: 'retention',
        measureKind: 'retention_probe',
        reserve: 'retention',
        batchSize: 1,
        minValidItems: 1,
      },
    ],
    items: [
      ...Array.from({ length: 5 }, (_, index) => item(`primary-${index + 1}`, 'probes_baseline')),
      ...Array.from({ length: 3 }, (_, index) => item(`transfer-${index + 1}`, 'TRANSFER_MEASUREMENT')),
      ...Array.from({ length: 2 }, (_, index) => item(`retention-${index + 1}`, 'retention')),
    ],
    ...overrides,
  };
}

function seed(seedValue = 'private-selection-seed-fixture') {
  return {
    schemaVersion: MEASUREMENT_SEED_SCHEMA_VERSION,
    seedVersion: 'measurement-seed-test-v1',
    purpose: 'test_fixture',
    seedId: 'measurement-seed-fixture-1',
    seedValue,
  };
}

function authority(
  inventoryValue: unknown = inventory(),
  seedValue: unknown = seed(),
  registry = new MeasurementRunRegistry(),
): DeterministicMeasurementAuthority {
  const value = new DeterministicMeasurementAuthority(POLICY, inventoryValue, seedValue, { registry });
  value.bindRun({
    runId: 'run-measurement-1',
    purpose: 'test_fixture',
    policyVersion: value.policy.definition.policyVersion,
    policyHash: value.policy.policyHash,
    inventoryVersion: value.inventory.definition.inventoryVersion,
    inventoryHash: value.inventory.inventoryHash,
    seedVersion: value.seed.definition.seedVersion,
    seedHash: value.seed.seedHash,
    packageVersion: value.inventory.definition.packageVersion,
  });
  return value;
}

function initialized(value: DeterministicMeasurementAuthority): MeasurementRunStateValue {
  return value.applyEvent(null, {
    eventId: 'measurement-event-0',
    eventType: 'measurement.initialized',
    sequenceNumber: 0,
    occurredAt: AT,
    payload: { runId: 'run-measurement-1', participantPseudoId: 'pseudo-measurement-1' },
  }).state;
}

function openEvent(
  sequenceNumber: number,
  overrides: Partial<Extract<MeasurementEvent, { eventType: 'measurement.opportunity.opened' }>['payload']> = {},
): MeasurementEvent {
  return {
    eventId: `measurement-event-${sequenceNumber}`,
    eventType: 'measurement.opportunity.opened',
    sequenceNumber,
    occurredAt: at(sequenceNumber),
    payload: {
      runId: 'run-measurement-1',
      participantPseudoId: 'pseudo-measurement-1',
      probeRoundId: 'probe-round-1',
      opportunityId: 'opportunity-primary-1',
      experimentalSet: 'A',
      phase: 'baseline',
      measureKind: 'primary_probe',
      ...overrides,
    },
  };
}

function deliveryEvent(sequenceNumber: number, opportunityId = 'opportunity-primary-1'): MeasurementEvent {
  return {
    eventId: `measurement-event-${sequenceNumber}`,
    eventType: 'measurement.delivery.requested',
    sequenceNumber,
    occurredAt: at(sequenceNumber),
    payload: { opportunityId },
  };
}

function outcomeEvent(
  sequenceNumber: number,
  probeInstanceId: string,
  outcome: Extract<MeasurementEvent, { eventType: 'measurement.item.outcome_observed' }>['payload']['outcome'],
  opportunityId = 'opportunity-primary-1',
): MeasurementEvent {
  return {
    eventId: `measurement-event-${sequenceNumber}`,
    eventType: 'measurement.item.outcome_observed',
    sequenceNumber,
    occurredAt: at(sequenceNumber),
    payload: { opportunityId, probeInstanceId, outcome },
  };
}

function expectCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error('se esperaba MeasurementAuthorityError');
  } catch (error) {
    expect(error).toBeInstanceOf(MeasurementAuthorityError);
    expect((error as MeasurementAuthorityError).code).toBe(code);
  }
}

function open(value: DeterministicMeasurementAuthority): MeasurementRunStateValue {
  return value.applyEvent(initialized(value), openEvent(1)).state;
}

/**
 * Elemento n-ésimo del fixture, o un fallo con nombre. Esparcir `lista[i]` sin
 * comprobarlo produce un objeto **incompleto** cuando el índice no existe, y el
 * caso acabaría comprobando el rechazo de un plan vacío en vez del del plan
 * alterado — que es la mitad de la prueba.
 */
function fijo<T>(lista: readonly T[], indice: number): T {
  const valor = lista[indice];
  if (valor === undefined) throw new Error(`fixture incompleto: falta la entrada ${indice}`);
  return valor;
}

describe('artefactos y frontera de autoridad (T-H6-06)', () => {
  it('fija autoridad exclusiva, modo, entrega individual y separación de ayuda', () => {
    expect(POLICY).toMatchObject({
      schemaVersion: MEASUREMENT_POLICY_SCHEMA_VERSION,
      authority: 'measurement_worker',
      mode: 'MEASUREMENT_MODE',
      selectionRegisteredBeforeDelivery: true,
      atomicConsumptionRequired: true,
      singleItemDelivery: true,
      hintsEnabled: false,
      immediateFeedbackEnabled: false,
      sessionMayChooseItemSeedTimeOrValidity: false,
      primaryCalibration: {
        version: 'sced-opportunity-h5-v1',
        kSet: 3,
        minValidItemsPerOpportunity: 2,
      },
    });
  });

  it('usa una sola política compartida de reserva y exclusión de consumo', () => {
    expect(requestedReserve('primary_probe', 'baseline')).toBe('probes_baseline');
    expect(requestedReserve('transfer_measurement', 'intervention')).toBe('TRANSFER_MEASUREMENT');
    expect(requestedReserve('retention_probe', 'retention')).toBe('retention');
    expectCode(() => requestedReserve('retention_probe', 'baseline'), 'PLAN_NOT_FROZEN');
    expect(priorConsumptionBlocks('guided_practice', 'retention')).toBe(true);
    expect(priorConsumptionBlocks('TRANSFER_MASTERY', 'TRANSFER_MEASUREMENT')).toBe(true);
    expect(priorConsumptionBlocks('diagnostic', 'probes_baseline')).toBe(false);
  });

  it('rechaza plan con reserva equivocada y parámetros primarios distintos de H5', () => {
    const wrongReserve = inventory();
    wrongReserve.plans[0] = { ...fijo(wrongReserve.plans, 0), reserve: 'retention' };
    expectCode(() => compileMeasurementInventory(wrongReserve), 'INVALID_ARTIFACT');

    const wrongBatch = inventory();
    wrongBatch.plans[0] = { ...fijo(wrongBatch.plans, 0), batchSize: 4 };
    expectCode(() => compileMeasurementInventory(wrongBatch), 'INVALID_ARTIFACT');
  });

  it('rechaza reactivos duplicados, prompt de otro ítem y campos de solución o pistas', () => {
    const duplicate = inventory();
    duplicate.items.push({ ...fijo(duplicate.items, 0) });
    expectCode(() => compileMeasurementInventory(duplicate), 'INVALID_ARTIFACT');

    const wrongPrompt = inventory();
    const first = wrongPrompt.items[0];
    if (first === undefined) throw new Error('fixture incompleto');
    wrongPrompt.items[0] = { ...first, prompt: { ...first.prompt, itemId: 'another-item' } };
    expectCode(() => compileMeasurementInventory(wrongPrompt), 'INVALID_ARTIFACT');

    const leaked = inventory();
    leaked.items[0] = { ...first, solution: 'A premise', hints: ['hazlo'] } as typeof first;
    expectCode(() => compileMeasurementInventory(leaked), 'INVALID_ARTIFACT');
  });

  it('material exige hashes externos exactos para política, inventario y semilla', () => {
    const materialPolicy = { ...POLICY, purpose: 'material' as const };
    const materialInventory = { ...inventory(), purpose: 'material' as const };
    const materialSeed = { ...seed(), purpose: 'material' as const };
    const compiledPolicy = compileMeasurementPolicy(materialPolicy);
    const compiledInventory = compileMeasurementInventory(materialInventory);
    const compiledSeed = compileMeasurementSeed(materialSeed);

    expectCode(
      () => new DeterministicMeasurementAuthority(materialPolicy, materialInventory, materialSeed),
      'MATERIAL_FREEZE_REQUIRED',
    );
    expect(() => new DeterministicMeasurementAuthority(materialPolicy, materialInventory, materialSeed, {
      expectedPolicyHash: compiledPolicy.policyHash,
      expectedInventoryHash: compiledInventory.inventoryHash,
      expectedSeedHash: compiledSeed.seedHash,
    })).not.toThrow();
  });

  it('restaura el binding y rechaza reasignar la semilla de una corrida', () => {
    const first = authority();
    const restored = new MeasurementRunRegistry(first.registry.bindings());
    expect(authority(inventory(), seed(), restored).registry.bindings()).toEqual(first.registry.bindings());

    const changed = new DeterministicMeasurementAuthority(POLICY, inventory(), seed('other-private-seed'), {
      registry: restored,
    });
    expectCode(() => changed.bindRun({
      ...first.registry.bindings()[0],
      seedHash: changed.seed.seedHash,
    }), 'RUN_POLICY_DRIFT');
  });
});

describe('selección, entrega y consumo', () => {
  it('selecciona reproduciblemente desde la semilla privada', () => {
    const first = authority();
    const second = authority();
    const firstDelivery = first.applyEvent(open(first), deliveryEvent(2)).delivery;
    const secondDelivery = second.applyEvent(open(second), deliveryEvent(2)).delivery;

    expect(firstDelivery).toEqual(secondDelivery);
    expect(firstDelivery?.prompt.itemId).toMatch(/^primary-/u);
  });

  it('registra selección y consumo en la misma transición antes de devolver', () => {
    const value = authority();
    const mutation = value.applyEvent(open(value), deliveryEvent(2));
    const selection = mutation.state.opportunities[0]?.selections[0];

    expect(mutation.delivery).not.toBeNull();
    expect(selection?.selectedAt).toBe(at(2));
    expect(selection?.consumedAt).toBe(at(2));
    expect(mutation.state.consumedItemIds).toEqual([mutation.delivery?.prompt.itemId]);
    expect(Object.isFrozen(mutation.state)).toBe(true);
  });

  it('aplica exclusiones de consumo previo desde almacenamiento, no desde ProbeRequest', () => {
    const value = authority();
    const initial = value.applyEvent(null, {
      eventId: 'measurement-event-0',
      eventType: 'measurement.initialized',
      sequenceNumber: 0,
      occurredAt: AT,
      payload: {
        runId: 'run-measurement-1',
        participantPseudoId: 'pseudo-measurement-1',
        priorConsumptions: [
          { itemId: 'primary-1', sourceReserve: 'guided_practice', consumedAt: AT },
          { itemId: 'primary-2', sourceReserve: 'diagnostic', consumedAt: AT },
        ],
      },
    }).state;
    const opened = value.applyEvent(initial, openEvent(1)).state;
    const delivered = value.applyEvent(opened, deliveryEvent(2));

    expect(initial.excludedMeasurementItemIds).toEqual(['primary-1']);
    expect(delivered.delivery?.prompt.itemId).not.toBe('primary-1');
    expect(delivered.state.priorConsumptions).toHaveLength(2);
  });

  it('la salida contiene un solo prompt y no banco, solución, pista, feedback ni semilla', () => {
    const value = authority();
    const mutation = value.applyEvent(open(value), deliveryEvent(2));
    const serialized = JSON.stringify(mutation.delivery);

    expect(mutation.delivery).toMatchObject({ itemOrdinal: 1, batchSize: 3, timeLimitSeconds: 90 });
    expect(serialized).not.toContain('private-selection-seed');
    expect(serialized).not.toMatch(/solution|hint|feedback|itemFamily|structuralSignature/iu);
    expect(mutation.state).not.toHaveProperty('seedValue');
    expect(mutation.state).not.toHaveProperty('inventory');
  });

  it('no entrega el segundo ítem mientras el primero carece de resultado', () => {
    const value = authority();
    const delivered = value.applyEvent(open(value), deliveryEvent(2));
    expectCode(() => value.applyEvent(delivered.state, deliveryEvent(3)), 'ITEM_OUTCOME_ORDER_VIOLATION');
  });

  it('el resultado de ítem no devuelve corrección ni feedback inmediato', () => {
    const value = authority();
    const delivered = value.applyEvent(open(value), deliveryEvent(2));
    const mutation = value.applyEvent(
      delivered.state,
      outcomeEvent(3, delivered.delivery?.probeInstanceId ?? '', { kind: 'scored', correct: true }),
    );

    expect(mutation.delivery).toBeNull();
    expect(mutation.result).toBeNull();
    expect(mutation.state.opportunities[0]?.outcomes[0]?.correct).toBe(true);
  });

  it('el mismo reactivo no reaparece en dos oportunidades', () => {
    const value = authority();
    let state = open(value);
    const firstOpportunityItems: string[] = [];
    for (let ordinal = 0; ordinal < 3; ordinal += 1) {
      const sequence = 2 + ordinal * 2;
      const delivered = value.applyEvent(state, deliveryEvent(sequence));
      firstOpportunityItems.push(delivered.delivery?.prompt.itemId ?? '');
      state = value.applyEvent(
        delivered.state,
        outcomeEvent(sequence + 1, delivered.delivery?.probeInstanceId ?? '', { kind: 'scored', correct: true }),
      ).state;
    }
    state = value.applyEvent(state, openEvent(8, {
      probeRoundId: 'probe-round-2',
      opportunityId: 'opportunity-primary-2',
    })).state;
    const next = value.applyEvent(state, deliveryEvent(9, 'opportunity-primary-2'));

    expect(firstOpportunityItems).not.toContain(next.delivery?.prompt.itemId);
  });

  it('transferencia sólo sale de TRANSFER_MEASUREMENT y retención de su reserva', () => {
    const transfer = authority();
    let transferState = transfer.applyEvent(initialized(transfer), openEvent(1, {
      probeRoundId: null,
      opportunityId: 'opportunity-transfer-1',
      phase: 'intervention',
      measureKind: 'transfer_measurement',
    })).state;
    const transferDelivery = transfer.applyEvent(transferState, deliveryEvent(2, 'opportunity-transfer-1'));
    expect(transferDelivery.delivery?.prompt.itemId).toMatch(/^transfer-/u);
    expect(transferDelivery.state.opportunities[0]?.reserve).toBe('TRANSFER_MEASUREMENT');

    const retention = authority();
    transferState = retention.applyEvent(initialized(retention), openEvent(1, {
      probeRoundId: null,
      opportunityId: 'opportunity-retention-1',
      phase: 'retention',
      measureKind: 'retention_probe',
    })).state;
    const retentionDelivery = retention.applyEvent(transferState, deliveryEvent(2, 'opportunity-retention-1'));
    expect(retentionDelivery.delivery?.prompt.itemId).toMatch(/^retention-/u);
    expect(retentionDelivery.state.opportunities[0]?.reserve).toBe('retention');
  });
});

describe('validez operacional y cierre de oportunidad', () => {
  function runPrimary(correctness: readonly boolean[]) {
    const value = authority();
    let state = open(value);
    let result = null;
    for (const [index, correct] of correctness.entries()) {
      const sequence = 2 + index * 2;
      const delivered = value.applyEvent(state, deliveryEvent(sequence));
      const observed = value.applyEvent(
        delivered.state,
        outcomeEvent(sequence + 1, delivered.delivery?.probeInstanceId ?? '', { kind: 'scored', correct }),
      );
      state = observed.state;
      result = observed.result;
    }
    return { value, state, result };
  }

  it('cierra 2/3 correctas como observación válida exacta', () => {
    const { state, result } = runPrimary([true, false, true]);

    expect(result).toEqual({
      opportunityId: 'opportunity-primary-1',
      probeRoundId: 'probe-round-1',
      plannedItems: 3,
      validScoredItems: 3,
      correctValidItems: 2,
      observation: 2 / 3,
      operationalValidity: 'valid',
      reasonCode: null,
    });
    expect(state.activeOpportunityId).toBeNull();
  });

  it('tolera un inválido cuando conserva el mínimo H5 de dos puntuados', () => {
    const value = authority();
    let state = open(value);
    let delivered = value.applyEvent(state, deliveryEvent(2));
    state = value.applyEvent(
      delivered.state,
      outcomeEvent(3, delivered.delivery?.probeInstanceId ?? '', { kind: 'scored', correct: true }),
    ).state;
    delivered = value.applyEvent(state, deliveryEvent(4));
    const paused = value.applyEvent(delivered.state, {
      eventId: 'measurement-event-5',
      eventType: 'measurement.pause.requested',
      sequenceNumber: 5,
      occurredAt: at(5),
      payload: { opportunityId: 'opportunity-primary-1' },
    });
    state = value.applyEvent(paused.state, {
      eventId: 'measurement-event-6',
      eventType: 'measurement.pause.resumed',
      sequenceNumber: 6,
      occurredAt: at(6),
      payload: { pauseEffectId: 'measurement-event-5' },
    }).state;
    delivered = value.applyEvent(state, deliveryEvent(7));
    const result = value.applyEvent(
      delivered.state,
      outcomeEvent(8, delivered.delivery?.probeInstanceId ?? '', { kind: 'scored', correct: false }),
    ).result;

    expect(result).toMatchObject({
      validScoredItems: 2,
      correctValidItems: 1,
      observation: 0.5,
      operationalValidity: 'valid',
      reasonCode: null,
    });
  });

  it('deriva invalid y missing desde la política, no desde el evento', () => {
    const invalidWorker = authority();
    let invalidState = open(invalidWorker);
    let delivered = invalidWorker.applyEvent(invalidState, deliveryEvent(2));
    invalidState = invalidWorker.applyEvent(
      delivered.state,
      outcomeEvent(3, delivered.delivery?.probeInstanceId ?? '', { kind: 'scored', correct: true }),
    ).state;
    delivered = invalidWorker.applyEvent(invalidState, deliveryEvent(4));
    let paused = invalidWorker.applyEvent(delivered.state, {
      eventId: 'measurement-event-5',
      eventType: 'measurement.pause.requested',
      sequenceNumber: 5,
      occurredAt: at(5),
      payload: { opportunityId: 'opportunity-primary-1' },
    });
    invalidState = invalidWorker.applyEvent(paused.state, {
      eventId: 'measurement-event-6',
      eventType: 'measurement.pause.resumed',
      sequenceNumber: 6,
      occurredAt: at(6),
      payload: { pauseEffectId: 'measurement-event-5' },
    }).state;
    delivered = invalidWorker.applyEvent(invalidState, deliveryEvent(7));
    paused = invalidWorker.applyEvent(delivered.state, {
      eventId: 'measurement-event-8',
      eventType: 'measurement.pause.requested',
      sequenceNumber: 8,
      occurredAt: at(8),
      payload: { opportunityId: 'opportunity-primary-1' },
    });
    const invalid = paused.result;
    expect(invalid).toMatchObject({ operationalValidity: 'invalid', reasonCode: 'invalid_participant_pause' });

    const missingWorker = authority();
    const shown = missingWorker.applyEvent(open(missingWorker), deliveryEvent(2));
    const missing = missingWorker.applyEvent(shown.state, {
      eventId: 'measurement-event-3',
      eventType: 'measurement.session_time.expired',
      sequenceNumber: 3,
      occurredAt: at(3),
      payload: { opportunityId: 'opportunity-primary-1', sessionDeadlineAt: at(3) },
    }).result;
    expect(missing).toMatchObject({
      validScoredItems: 0,
      observation: null,
      operationalValidity: 'missing',
      reasonCode: 'missing_session_time',
    });
  });

  it('rechaza un incident code que no pertenece a la taxonomía congelada', () => {
    const value = authority();
    const delivered = value.applyEvent(open(value), deliveryEvent(2));

    expectCode(() => value.applyEvent(
      delivered.state,
      {
        eventId: 'measurement-event-3',
        eventType: 'measurement.incident.recorded',
        sequenceNumber: 3,
        occurredAt: at(3),
        payload: {
          opportunityId: 'opportunity-primary-1',
          incident: {
            incidentId: 'incident-unfrozen',
            incidentCode: 'not_in_frozen_taxonomy',
            level: 2,
            action: 'invalidar_acto_o_bloque',
            detectedAt: at(3),
            affectedEventIds: [delivered.delivery?.probeInstanceId ?? ''],
            invalidatedOpportunityIds: ['opportunity-primary-1'],
          },
        },
      },
    ), 'INCIDENT_TAXONOMY_MISMATCH');
  });

  it('reserva insuficiente produce missing reserve_exhausted sin generar en caliente', () => {
    const sparse = inventory({
      items: [item('only-primary', 'probes_baseline')],
      plans: [inventory().plans[0]],
    });
    const value = authority(sparse);
    let state = open(value);
    const delivered = value.applyEvent(state, deliveryEvent(2));
    state = value.applyEvent(
      delivered.state,
      outcomeEvent(3, delivered.delivery?.probeInstanceId ?? '', { kind: 'scored', correct: true }),
    ).state;
    const exhausted = value.applyEvent(state, deliveryEvent(4));

    expect(exhausted.delivery).toBeNull();
    expect(exhausted.result).toMatchObject({
      plannedItems: 3,
      validScoredItems: 1,
      operationalValidity: 'missing',
      reasonCode: 'reserve_exhausted',
    });
  });

  it('agotamiento posterior al mínimo conserva la observación válida', () => {
    const sparse = inventory({
      items: [item('primary-one', 'probes_baseline'), item('primary-two', 'probes_baseline')],
      plans: [inventory().plans[0]],
    });
    const value = authority(sparse);
    let state = open(value);
    for (let index = 0; index < 2; index += 1) {
      const sequence = 2 + index * 2;
      const delivered = value.applyEvent(state, deliveryEvent(sequence));
      state = value.applyEvent(
        delivered.state,
        outcomeEvent(sequence + 1, delivered.delivery?.probeInstanceId ?? '', {
          kind: 'scored',
          correct: index === 0,
        }),
      ).state;
    }
    const exhausted = value.applyEvent(state, deliveryEvent(6));

    expect(exhausted.result).toMatchObject({
      validScoredItems: 2,
      correctValidItems: 1,
      observation: 0.5,
      operationalValidity: 'valid',
      reasonCode: null,
    });
  });
});

describe('replay, restauración y persistencia atómica', () => {
  it('replay reproduce exactamente selección, consumo y resultado', () => {
    const value = authority();
    const events: MeasurementEvent[] = [
      {
        eventId: 'measurement-event-0',
        eventType: 'measurement.initialized',
        sequenceNumber: 0,
        occurredAt: AT,
        // `priorConsumptions` va explícito y vacío. El esquema lo rellena con
        // `.default([])`, así que el valor es el mismo; lo que cambia es que el
        // tipo inferido —que es el que declara este array— lo exige, y omitirlo
        // no compilaba.
        payload: {
          runId: 'run-measurement-1',
          participantPseudoId: 'pseudo-measurement-1',
          priorConsumptions: [],
        },
      },
      openEvent(1),
      deliveryEvent(2),
      outcomeEvent(3, 'measurement-event-2', { kind: 'scored', correct: true }),
      deliveryEvent(4),
      outcomeEvent(5, 'measurement-event-4', { kind: 'scored', correct: false }),
      deliveryEvent(6),
      outcomeEvent(7, 'measurement-event-6', { kind: 'scored', correct: true }),
    ];
    const state = value.replay(events);

    expect(state.schemaVersion).toBe(MEASUREMENT_STATE_SCHEMA_VERSION);
    expect(state.revision).toBe(7);
    expect(value.replay(events)).toEqual(state);
  });

  it('rechaza huecos, ids duplicados y tiempo regresivo', () => {
    const value = authority();
    const state = initialized(value);
    expectCode(() => value.applyEvent(state, openEvent(2)), 'INVALID_EVENT_SEQUENCE');
    expectCode(() => value.applyEvent(state, { ...openEvent(1), eventId: 'measurement-event-0' }), 'INVALID_EVENT_SEQUENCE');
    expectCode(() => value.applyEvent(state, {
      ...openEvent(1),
      occurredAt: '2026-08-16T23:59:59.000Z',
    }), 'INVALID_EVENT_SEQUENCE');
  });

  it('rechaza selección, prompt o rango adulterados al continuar un snapshot', () => {
    const value = authority();
    const delivered = value.applyEvent(open(value), deliveryEvent(2));
    const opportunity = delivered.state.opportunities[0];
    const selection = opportunity?.selections[0];
    if (opportunity === undefined || selection === undefined) throw new Error('fixture incompleto');
    const tampered = {
      ...delivered.state,
      opportunities: [{
        ...opportunity,
        selections: [{
          ...selection,
          selectionRank: HASH_A,
          delivery: {
            ...selection.delivery,
            prompt: { ...selection.delivery.prompt, statement: 'Contenido sustituido' },
          },
        }],
      }],
    };
    expect(MeasurementRunState.safeParse(tampered).success).toBe(true);
    expectCode(() => value.applyEvent(
      tampered as MeasurementRunStateValue,
      outcomeEvent(3, selection.delivery.probeInstanceId, { kind: 'scored', correct: true }),
    ), 'INVALID_STATE');
  });

  it('el estado estricto excluye identidad real, solución, modelo, BKT y feedback', () => {
    const value = authority();
    const state = initialized(value);
    for (const extra of [
      { realIdentity: 'persona' },
      { solution: 'A premise' },
      { modelProposal: { itemId: 'x' } },
      { masteryProbabilityShadow: 0.9 },
      { feedback: 'correcto' },
    ]) {
      expect(MeasurementRunState.safeParse({ ...state, ...extra }).success).toBe(false);
    }
  });

  it('el SQL reclama y registra en una sola sentencia compare-and-set', () => {
    expect(ATOMIC_PROBE_CONSUMPTION_SQL).toMatch(/^WITH claimed AS/iu);
    expect(ATOMIC_PROBE_CONSUMPTION_SQL).toContain('UPDATE measurement.probe_reserve_item');
    expect(ATOMIC_PROBE_CONSUMPTION_SQL).toContain('AND consumed = false');
    expect(ATOMIC_PROBE_CONSUMPTION_SQL).toContain('INSERT INTO measurement.probe_consumption');
    expect(ATOMIC_PROBE_CONSUMPTION_SQL).toContain('RETURNING item_id');
    expect(ATOMIC_PROBE_CONSUMPTION_SQL).not.toMatch(/DELETE|solution|prompt/iu);
  });
});
