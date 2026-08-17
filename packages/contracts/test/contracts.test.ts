import { describe, expect, it } from 'vitest';
import {
  AnchoredSegment,
  AutonomyVerdict,
  CapabilityFlags,
  DecisionMaker,
  EvidenceEvent,
  FreezeManifest,
  H8_RECOMMENDED_CAPABILITY_FLAGS,
  INCIDENT_ACTION_BY_LEVEL,
  METRIC_IDS,
  ModelOperation,
  PedagogicalDecision,
  PedagogicalStrategy,
  PedagogicalVerdict,
  ProbeDelivery,
  ProbeOpportunityResult,
  ProbeRequest,
  VERDICT_ORDER,
  VerificationErrorCode,
  consumptionBlocksMeasurement,
  pendingCatalog,
  pendingCatalogs,
  probeReserveFor,
} from '../src/index.js';

describe('EvidenceEvent — literal P-II §9.1', () => {
  const valid = {
    schemaVersion: '1',
    eventId: 'e1',
    sequenceNumber: 0,
    correlationId: 'c1',
    runId: 'r1',
    participantPseudoId: 'p-anon-1',
    sessionId: 's1',
    eventType: 'stt.committed',
    payload: { artifactRef: 'a1' },
    decisionMaker: 'engine' as const,
    autonomyStatus: 'autonomous' as const,
    versions: { 'authorized-calculus': { version: 'authorized-calculus-v1' } },
    occurredAt: '2026-08-14T10:00:00.000Z',
    previousHash: 'GENESIS',
    hash: 'a'.repeat(64),
    validity: 'valid' as const,
  };

  it('acepta el evento mínimo', () => {
    expect(EvidenceEvent.safeParse(valid).success).toBe(true);
  });

  it('los cinco decisionMaker son los del contrato', () => {
    expect(DecisionMaker.options).toEqual(['engine', 'verifier', 'model', 'human', 'system']);
  });

  it('una corrección se enlaza al original en vez de sustituirlo (I-6)', () => {
    const correction = { ...valid, eventId: 'e2', sequenceNumber: 1, correctionOfEventId: 'e1' };
    const parsed = EvidenceEvent.safeParse(correction);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.correctionOfEventId).toBe('e1');
  });

  it('rechaza un autonomyStatus fuera del enum', () => {
    expect(EvidenceEvent.safeParse({ ...valid, autonomyStatus: 'not-evaluated' }).success).toBe(
      false,
    );
  });

  it('exige la validez literal y rechaza campos que no pertenecen al evento', () => {
    const withoutValidity: Record<string, unknown> = { ...valid };
    Reflect.deleteProperty(withoutValidity, 'validity');
    expect(EvidenceEvent.safeParse(withoutValidity).success).toBe(false);
    expect(EvidenceEvent.safeParse({ ...valid, validity: 'missing' }).success).toBe(false);
    expect(EvidenceEvent.safeParse({ ...valid, realIdentity: 'persona@example.test' }).success).toBe(
      false,
    );
  });
});

describe('PedagogicalDecision — literal P-II §7.2.1', () => {
  it('tiene exactamente las 10 estrategias del enum', () => {
    expect(PedagogicalStrategy.options).toEqual([
      'direct_explanation',
      'worked_example',
      'completion_problem',
      'guided_practice',
      'independent_practice',
      'scaffolding',
      'self_explanation',
      'retrieval',
      'prerequisite_remediation',
      'near_transfer',
    ]);
  });

  it('acepta una decisión bien formada y rechaza una estrategia inventada', () => {
    const base = {
      mode: 'LEARNING_MODE' as const,
      strategy: 'worked_example',
      assistanceLevel: 0,
      masteryEligible: true,
      reasonCode: 'R-001',
    };
    expect(PedagogicalDecision.safeParse(base).success).toBe(true);
    expect(PedagogicalDecision.safeParse({ ...base, strategy: 'explicacion_magistral' }).success).toBe(
      false,
    );
  });
});

describe('Contrato de medición — literal P-II §6.3', () => {
  it('permite probeRoundId nulo para transferencia/retención fuera de la serie SCED', () => {
    const r = ProbeRequest.safeParse({
      runId: 'r1',
      participantPseudoId: 'p1',
      probeRoundId: null,
      opportunityId: 'o1',
      experimentalSet: 'A',
      phase: 'retention',
      measureKind: 'retention_probe',
    });
    expect(r.success).toBe(true);
  });

  it('los faltantes no se imputan: observation puede ser null', () => {
    const r = ProbeOpportunityResult.safeParse({
      opportunityId: 'o1',
      probeRoundId: 'pr1',
      plannedItems: 3,
      validScoredItems: 0,
      correctValidItems: 0,
      observation: null,
      operationalValidity: 'missing',
      reasonCode: 'missing_session_time',
    });
    expect(r.success).toBe(true);
  });

  it('el motor no puede introducir item, semilla, tiempo ni una combinación fuera de serie', () => {
    const base = {
      runId: 'r1',
      participantPseudoId: 'p1',
      probeRoundId: 'round-1',
      opportunityId: 'o1',
      experimentalSet: 'A',
      phase: 'baseline' as const,
      measureKind: 'primary_probe' as const,
    };
    expect(ProbeRequest.safeParse({ ...base, itemId: 'forzado' }).success).toBe(false);
    expect(ProbeRequest.safeParse({ ...base, seed: 'forzada' }).success).toBe(false);
    expect(ProbeRequest.safeParse({ ...base, timeLimitSeconds: 999 }).success).toBe(false);
    expect(ProbeRequest.safeParse({ ...base, probeRoundId: null }).success).toBe(false);
    expect(ProbeRequest.safeParse({ ...base, phase: 'retention' }).success).toBe(false);
    expect(ProbeRequest.safeParse({
      ...base,
      probeRoundId: null,
      phase: 'intervention',
      measureKind: 'retention_probe',
    }).success).toBe(false);
  });

  it('la entrega es de un solo ítem, sin solución, y su ordinal cabe en la microbatería', () => {
    const delivery = {
      probeInstanceId: 'probe-1',
      opportunityId: 'o1',
      itemOrdinal: 1,
      batchSize: 3,
      prompt: {
        itemId: 'item-1',
        statement: 'Demuestra la meta.',
        premises: ['A'],
        goal: 'A',
        responseFormat: 'fitch_proof' as const,
      },
      timeLimitSeconds: 60,
      verifierContract: 'authorized-calculus-v1',
    };
    expect(ProbeDelivery.safeParse(delivery).success).toBe(true);
    expect(ProbeDelivery.safeParse({ ...delivery, itemOrdinal: 4 }).success).toBe(false);
    expect(ProbeDelivery.safeParse({
      ...delivery,
      prompt: { ...delivery.prompt, solution: 'A premise' },
    }).success).toBe(false);
  });

  it('la reserva y las exclusiones de consumo se derivan en un solo contrato', () => {
    expect(probeReserveFor('primary_probe', 'baseline')).toBe('probes_baseline');
    expect(probeReserveFor('primary_probe', 'intervention')).toBe('probes_intervention');
    expect(probeReserveFor('transfer_measurement', 'baseline')).toBe('TRANSFER_MEASUREMENT');
    expect(probeReserveFor('retention_probe', 'retention')).toBe('retention');
    expect(probeReserveFor('retention_probe', 'baseline')).toBeNull();
    expect(consumptionBlocksMeasurement('guided_practice', 'probes_baseline')).toBe(true);
    expect(consumptionBlocksMeasurement('TRANSFER_MASTERY', 'TRANSFER_MEASUREMENT')).toBe(true);
    expect(consumptionBlocksMeasurement('diagnostic', 'probes_baseline')).toBe(false);
  });

  it('un resultado válido o faltante debe ser aritmética y semánticamente coherente', () => {
    const valid = {
      opportunityId: 'o1',
      probeRoundId: 'round-1',
      plannedItems: 3,
      validScoredItems: 2,
      correctValidItems: 1,
      observation: 0.5,
      operationalValidity: 'valid' as const,
      reasonCode: null,
    };
    expect(ProbeOpportunityResult.safeParse(valid).success).toBe(true);
    expect(ProbeOpportunityResult.safeParse({ ...valid, correctValidItems: 3 }).success).toBe(false);
    expect(ProbeOpportunityResult.safeParse({ ...valid, observation: 0.75 }).success).toBe(false);
    expect(ProbeOpportunityResult.safeParse({
      ...valid,
      operationalValidity: 'missing',
      observation: null,
      reasonCode: null,
    }).success).toBe(false);
  });
});

describe('Salida anclada — literal P-II §8.4', () => {
  it('acepta las cuatro funciones de segmento', () => {
    for (const f of ['definition', 'explanation', 'example', 'transition']) {
      const r = AnchoredSegment.safeParse({ text: 'x', anchors: ['frag:1'], function: f });
      expect(r.success).toBe(true);
    }
  });

  it('rechaza una función fuera del enum', () => {
    const r = AnchoredSegment.safeParse({ text: 'x', anchors: [], function: 'conclusion' });
    expect(r.success).toBe(false);
  });
});

describe('Catálogos literales del cálculo, gateway y veredictos', () => {
  it('el contrato de freeze rechaza el esqueleto v0 no firmado de F0', () => {
    expect(
      FreezeManifest.safeParse({
        manifestVersion: '0',
        runId: 'placeholder',
        createdAt: null,
        contentPackageHash: null,
        artifacts: [],
      }).success,
    ).toBe(false);
  });

  it('tiene los 18 códigos E-* de P-II §4.1.1', () => {
    expect(VerificationErrorCode.options).toHaveLength(18);
    expect(VerificationErrorCode.options).toContain('E-SEM-UNSOUND-STEP');
  });

  it('tiene las 11 operaciones exactas del gateway (P-II §8.2)', () => {
    expect(ModelOperation.options).toHaveLength(11);
  });

  it('tiene 7 capabilityFlags y externalScreenCapture OFF en H8', () => {
    expect(Object.keys(CapabilityFlags.shape)).toHaveLength(7);
    expect(H8_RECOMMENDED_CAPABILITY_FLAGS.externalScreenCapture).toBe(false);
  });

  it('tiene las 7 métricas contratadas y ningún escalar phase_change', () => {
    expect(METRIC_IDS).toHaveLength(7);
    expect(METRIC_IDS as readonly string[]).not.toContain('phase_change');
  });

  it('congela el orden Integridad → Autonomía → Pedagogía → Viabilidad', () => {
    expect(VERDICT_ORDER).toEqual(['integridad', 'autonomia', 'pedagogia', 'viabilidad']);
  });

  it('sin retención evaluable no puede haber veredicto pedagógico "fuerte"', () => {
    // El valor existe en el enum, pero la regla P-I §12.3 lo condiciona; aquí se
    // fija el enum literal y `verdict-engine` (F13) aplicará la tabla.
    expect(PedagogicalVerdict.options).toContain('fuerte');
    expect(PedagogicalVerdict.options).toContain('no_interpretable');
  });

  it('el veredicto de autonomía distingue contaminación por intervención humana', () => {
    expect(AutonomyVerdict.options).toContain('contaminada_por_intervencion_humana');
  });

  it('un incidente nivel 3 obliga a suspender el piloto (P-I §13.1)', () => {
    expect(INCIDENT_ACTION_BY_LEVEL[3]).toBe('suspender_piloto');
    expect(INCIDENT_ACTION_BY_LEVEL[2]).toBe('invalidar_acto_o_bloque');
  });
});

describe('Mecanismo de catálogo pendiente (§0.2.5)', () => {
  it('no queda ningún catálogo pendiente tras transcribir el Maestro', () => {
    expect(pendingCatalogs()).toHaveLength(0);
  });

  it('un catálogo pendiente rechaza cualquier valor en vez de inventarlo', () => {
    const schema = pendingCatalog({
      catalogId: 'ejemplo',
      source: 'Maestro §X',
      closesIn: 'T-EJEMPLO',
    });
    const parsed = schema.safeParse('valor_plausible');
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toContain('PENDING_MAESTRO_LITERAL');
  });
});
