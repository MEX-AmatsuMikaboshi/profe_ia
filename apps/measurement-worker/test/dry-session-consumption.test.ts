import { describe, expect, it } from 'vitest';
import { ProbeOpportunityResult } from '@profesor-ia/contracts';

import {
  DeterministicMeasurementAuthority,
  MEASUREMENT_INVENTORY_SCHEMA_VERSION,
  MEASUREMENT_SEED_SCHEMA_VERSION,
  MeasurementRunRegistry,
  createMeasurementAuthorityPolicyDefinition,
  priorConsumptionBlocks,
  type MeasurementEvent,
  type MeasurementRunState as MeasurementRunStateValue,
} from '../src/index.js';

/**
 * `ci:e2e:dry-session` — la mitad de la propiedad **«reactivo consumido no
 * reaparece»** que vive en la autoridad de medición (`Plan.md` §F7, AC del gate
 * H6). La otra mitad, la del motor de sesión, está en
 * `packages/session-engine/test/dry-session-e2e.test.ts`.
 *
 * Están separadas a propósito y no por comodidad: el motor no importa al worker
 * y el worker no importa al motor —esa es la autoridad aislada de
 * `DEC-MEAS-AUTHORITY-001`—, así que una suite que los importara a los dos
 * tendría que abrir una dependencia que la arquitectura niega. Las dos puertas
 * entre ellos son contratos, y que no lleven el reactivo se comprueba en la
 * suite del motor.
 *
 * El barrido es **exhaustivo hasta agotar la reserva**: no basta comprobar que
 * dos entregas seguidas difieren, porque la reaparición interesante es la de
 * la tercera oportunidad, cuando ya no queda inventario y reutilizar sería el
 * atajo cómodo.
 */

const AT = '2026-08-18T11:00:00.000Z';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const PAQUETE = {
  artifactId: 'paquete-sintetico-dev',
  version: '0.0.0-dev',
  hash: HASH_A,
} as const;

function at(second: number): string {
  return `2026-08-18T11:${String(Math.floor(second / 60)).padStart(2, '0')}:${String(second % 60).padStart(2, '0')}.000Z`;
}

const POLITICA = createMeasurementAuthorityPolicyDefinition({
  policyVersion: 'measurement-authority-dry-session-v1',
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

function reactivo(itemId: string) {
  return {
    itemId,
    itemFamilyId: `family-${itemId}`,
    structuralSignature: HASH_B,
    experimentalSet: 'A',
    reserve: 'probes_baseline' as const,
    prompt: {
      itemId,
      statement: `Demuestra el reactivo de sonda ${itemId}.`,
      premises: ['A∧B'],
      goal: 'A',
      responseFormat: 'fitch_proof' as const,
    },
    timeLimitSeconds: 90,
    verifierContract: 'authorized-calculus-v1',
  };
}

/** Seis reactivos: dos microbaterías completas de tres y ni uno de sobra. */
const REACTIVOS = Array.from({ length: 6 }, (_, index) => reactivo(`probe-baseline-${index + 1}`));

function inventario() {
  return {
    schemaVersion: MEASUREMENT_INVENTORY_SCHEMA_VERSION,
    inventoryVersion: 'measurement-inventory-dry-session-v1',
    purpose: 'test_fixture',
    packageVersion: PAQUETE,
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
    ],
    items: REACTIVOS,
  };
}

function semilla() {
  return {
    schemaVersion: MEASUREMENT_SEED_SCHEMA_VERSION,
    seedVersion: 'measurement-seed-dry-session-v1',
    purpose: 'test_fixture',
    seedId: 'measurement-seed-dry-session-1',
    seedValue: 'private-selection-seed-dry-session',
  };
}

function autoridad(): DeterministicMeasurementAuthority {
  const value = new DeterministicMeasurementAuthority(POLITICA, inventario(), semilla(), {
    registry: new MeasurementRunRegistry(),
  });
  value.bindRun({
    runId: 'run-dry-1',
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

interface Consumo {
  readonly itemId: string;
  readonly statement: string;
  readonly opportunityId: string;
}

/**
 * Corre una oportunidad completa contra la autoridad y devuelve lo entregado.
 * El contador de secuencia es del llamador porque el worker exige cabecera
 * monótona: un número repetido sería otro evento, no el mismo.
 */
function corre(
  value: DeterministicMeasurementAuthority,
  estado: MeasurementRunStateValue,
  opportunityId: string,
  desde: number,
): {
  readonly estado: MeasurementRunStateValue;
  readonly consumos: readonly Consumo[];
  readonly resultado: ReturnType<typeof ProbeOpportunityResult.parse> | null;
  readonly siguiente: number;
} {
  let actual = estado;
  let n = desde;
  const consumos: Consumo[] = [];
  let resultado: ReturnType<typeof ProbeOpportunityResult.parse> | null = null;

  const aplica = (event: MeasurementEvent) => value.applyEvent(actual, event);

  let mutation = aplica({
    eventId: `measurement-event-${n}`,
    eventType: 'measurement.opportunity.opened',
    sequenceNumber: n,
    occurredAt: at(n),
    payload: {
      runId: 'run-dry-1',
      participantPseudoId: 'pseudo-dry-1',
      probeRoundId: 'probe-round-1',
      opportunityId,
      experimentalSet: 'A',
      phase: 'baseline',
      measureKind: 'primary_probe',
    },
  });
  actual = mutation.state;

  for (let entrega = 0; entrega < 3; entrega += 1) {
    n += 1;
    mutation = aplica({
      eventId: `measurement-event-${n}`,
      eventType: 'measurement.delivery.requested',
      sequenceNumber: n,
      occurredAt: at(n),
      payload: { opportunityId },
    });
    actual = mutation.state;
    if (mutation.delivery === null) {
      // Reserva agotada: la autoridad cierra con razón declarada en vez de
      // volver a entregar algo ya consumido.
      resultado = mutation.result;
      return { estado: actual, consumos, resultado, siguiente: n + 1 };
    }
    consumos.push({
      itemId: mutation.delivery.prompt.itemId,
      statement: mutation.delivery.prompt.statement,
      opportunityId,
    });
    const probeInstanceId = mutation.delivery.probeInstanceId;
    n += 1;
    mutation = aplica({
      eventId: `measurement-event-${n}`,
      eventType: 'measurement.item.outcome_observed',
      sequenceNumber: n,
      occurredAt: at(n),
      payload: {
        opportunityId,
        probeInstanceId,
        outcome: { kind: 'scored', correct: entrega === 0 },
      },
    });
    actual = mutation.state;
    if (mutation.result !== null) resultado = mutation.result;
  }

  return { estado: actual, consumos, resultado, siguiente: n + 1 };
}

function inicializado(
  value: DeterministicMeasurementAuthority,
  priorConsumptions: readonly { itemId: string; sourceReserve: string; consumedAt: string }[] = [],
): MeasurementRunStateValue {
  return value.applyEvent(null, {
    eventId: 'measurement-event-0',
    eventType: 'measurement.initialized',
    sequenceNumber: 0,
    occurredAt: AT,
    payload: {
      runId: 'run-dry-1',
      participantPseudoId: 'pseudo-dry-1',
      priorConsumptions,
    },
  }).state;
}

describe('propiedad: un reactivo consumido no reaparece (autoridad de medición)', () => {
  it('dentro de una microbatería los tres reactivos son distintos', () => {
    const value = autoridad();
    const { consumos, resultado } = corre(value, inicializado(value), 'op-dry-1', 1);
    expect(consumos).toHaveLength(3);
    expect(new Set(consumos.map((consumo) => consumo.itemId)).size).toBe(3);
    expect(resultado).toMatchObject({
      opportunityId: 'op-dry-1',
      operationalValidity: 'valid',
      validScoredItems: 3,
      correctValidItems: 1,
    });
  });

  it('barre la reserva entera sin repetir ni uno, y al agotarse lo declara', () => {
    const value = autoridad();
    let estado = inicializado(value);
    let siguiente = 1;
    const consumos: Consumo[] = [];
    const resultados: (ReturnType<typeof ProbeOpportunityResult.parse> | null)[] = [];

    // Tres oportunidades de tres para seis reactivos: la tercera no tiene con qué.
    for (const opportunityId of ['op-dry-1', 'op-dry-2', 'op-dry-3']) {
      const vuelta = corre(value, estado, opportunityId, siguiente);
      estado = vuelta.estado;
      siguiente = vuelta.siguiente;
      consumos.push(...vuelta.consumos);
      resultados.push(vuelta.resultado);
    }

    expect(consumos).toHaveLength(6);
    expect(new Set(consumos.map((consumo) => consumo.itemId)).size).toBe(6);
    // Y son exactamente los del inventario: ni uno inventado.
    expect(consumos.map((consumo) => consumo.itemId).sort()).toEqual(
      REACTIVOS.map((item) => item.itemId).sort(),
    );
    expect(estado.consumedItemIds).toHaveLength(6);

    // La tercera oportunidad cierra sin observación y con la razón dicha.
    expect(resultados[2]).toMatchObject({
      opportunityId: 'op-dry-3',
      observation: null,
      operationalValidity: 'missing',
      reasonCode: 'reserve_exhausted',
    });
  });

  it('un consumo previo de una reserva que bloquea excluye el reactivo del barrido', () => {
    const excluido = REACTIVOS[0];
    if (excluido === undefined) throw new Error('inventario incompleto');
    // Control positivo de la premisa: esta reserva **sí** bloquea la de sondas.
    expect(priorConsumptionBlocks('guided_practice', 'probes_baseline')).toBe(true);

    const value = autoridad();
    const estado = inicializado(value, [
      { itemId: excluido.itemId, sourceReserve: 'guided_practice', consumedAt: at(0) },
    ]);
    expect(estado.excludedMeasurementItemIds).toEqual([excluido.itemId]);

    let actual = estado;
    let siguiente = 1;
    const consumos: Consumo[] = [];
    for (const opportunityId of ['op-dry-1', 'op-dry-2']) {
      const vuelta = corre(value, actual, opportunityId, siguiente);
      actual = vuelta.estado;
      siguiente = vuelta.siguiente;
      consumos.push(...vuelta.consumos);
    }
    // Quedan cinco disponibles: la segunda oportunidad se queda a uno.
    expect(consumos).toHaveLength(5);
    expect(consumos.map((consumo) => consumo.itemId)).not.toContain(excluido.itemId);
  });

  /**
   * Control positivo de la exclusión: sin esto, una implementación que excluyera
   * **todo** consumo previo pasaría la prueba anterior por exceso, y la política
   * compartida de reservas (`consumptionBlocksMeasurement`) dejaría de decir
   * nada. `diagnostic` no bloquea la reserva de sondas y por tanto no excluye.
   */
  it('un consumo previo que no bloquea no excluye nada', () => {
    const noExcluido = REACTIVOS[0];
    if (noExcluido === undefined) throw new Error('inventario incompleto');
    expect(priorConsumptionBlocks('diagnostic', 'probes_baseline')).toBe(false);

    const value = autoridad();
    const estado = inicializado(value, [
      { itemId: noExcluido.itemId, sourceReserve: 'diagnostic', consumedAt: at(0) },
    ]);
    expect(estado.excludedMeasurementItemIds).toEqual([]);

    const { consumos } = corre(value, estado, 'op-dry-1', 1);
    expect(consumos).toHaveLength(3);
  });

  it('entrega un reactivo a la vez: sin resultado no hay siguiente', () => {
    const value = autoridad();
    const estado = inicializado(value);
    const abierta = value.applyEvent(estado, {
      eventId: 'measurement-event-1',
      eventType: 'measurement.opportunity.opened',
      sequenceNumber: 1,
      occurredAt: at(1),
      payload: {
        runId: 'run-dry-1',
        participantPseudoId: 'pseudo-dry-1',
        probeRoundId: 'probe-round-1',
        opportunityId: 'op-dry-1',
        experimentalSet: 'A',
        phase: 'baseline',
        measureKind: 'primary_probe',
      },
    }).state;
    const primera = value.applyEvent(abierta, {
      eventId: 'measurement-event-2',
      eventType: 'measurement.delivery.requested',
      sequenceNumber: 2,
      occurredAt: at(2),
      payload: { opportunityId: 'op-dry-1' },
    }).state;

    expect(() =>
      value.applyEvent(primera, {
        eventId: 'measurement-event-3',
        eventType: 'measurement.delivery.requested',
        sequenceNumber: 3,
        occurredAt: at(3),
        payload: { opportunityId: 'op-dry-1' },
      }),
    ).toThrow(/resultado antes de pedir otro/u);
  });
});

describe('propiedad: lo que sale de la autoridad no lleva el reactivo', () => {
  /**
   * El motor de sesión consume el `ProbeOpportunityResult` y nada más. Aquí se
   * comprueba del lado del productor lo que la suite del motor comprueba del
   * lado del consumidor: el resultado que cruza la frontera **no contiene** ni
   * el id ni el enunciado de ningún reactivo entregado.
   */
  it('el resultado que cruza la frontera no contiene id ni enunciado de reactivo', () => {
    const value = autoridad();
    const { consumos, resultado } = corre(value, inicializado(value), 'op-dry-1', 1);
    expect(resultado).not.toBeNull();
    const serializado = JSON.stringify(resultado);
    for (const consumo of consumos) {
      expect(serializado).not.toContain(consumo.itemId);
      expect(serializado).not.toContain(consumo.statement);
    }
    // Y el contrato lo garantiza por forma, no por suerte: es `.strict()`.
    expect(ProbeOpportunityResult.safeParse({
      ...resultado,
      itemId: consumos[0]?.itemId,
    }).success).toBe(false);
  });

  it('el enunciado sólo aparece en la entrega, que no cruza al motor', () => {
    const value = autoridad();
    const estado = inicializado(value);
    const abierta = value.applyEvent(estado, {
      eventId: 'measurement-event-1',
      eventType: 'measurement.opportunity.opened',
      sequenceNumber: 1,
      occurredAt: at(1),
      payload: {
        runId: 'run-dry-1',
        participantPseudoId: 'pseudo-dry-1',
        probeRoundId: 'probe-round-1',
        opportunityId: 'op-dry-1',
        experimentalSet: 'A',
        phase: 'baseline',
        measureKind: 'primary_probe',
      },
    }).state;
    const mutation = value.applyEvent(abierta, {
      eventId: 'measurement-event-2',
      eventType: 'measurement.delivery.requested',
      sequenceNumber: 2,
      occurredAt: at(2),
      payload: { opportunityId: 'op-dry-1' },
    });

    expect(mutation.delivery).not.toBeNull();
    expect(mutation.result).toBeNull();
    // La entrega no trae solución ni pistas: no hay campo donde ponerlas.
    const entrega = JSON.stringify(mutation.delivery);
    expect(entrega).not.toMatch(/solution|certificate|hint/iu);
  });
});
