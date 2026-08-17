import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_CHAIN_GENESIS,
  EVIDENCE_CORRECTION_STAGES,
  EVIDENCE_EVENT_SCHEMA_VERSION,
  EVIDENCE_PROJECTION_TYPES,
  EvidenceLedger,
  EvidenceLedgerError,
  canonicalEvidenceJson,
  evidenceEventFromPersistenceRow,
  evidenceEventHash,
  evidenceEventInsertParameters,
  replayEvidenceEvents,
  toEvidenceEventPersistenceRow,
} from '../src/index.js';
import type {
  EvidenceAppendInput,
  EvidenceCorrectionInput,
  EvidenceLedgerErrorCode,
} from '../src/index.js';

const AT = '2026-08-16T15:00:00.000Z';
const VERSIONS = {
  'test-component': { version: 'test-fixture-v1', hash: 'a'.repeat(64) },
};

function serverAt(second: number): string {
  return `2026-08-16T15:00:${String(second).padStart(2, '0')}.000Z`;
}

function ledger(): EvidenceLedger {
  return new EvidenceLedger({
    streamId: 'stream-fixture-1',
    runId: 'run-fixture-1',
    participantPseudoId: 'pseudo-fixture-1',
    sessionId: 'session-fixture-1',
  });
}

function act(
  eventId = 'evidence-fixture-0',
  second = 0,
  overrides: Partial<EvidenceAppendInput> = {},
): EvidenceAppendInput {
  return {
    eventId,
    correlationId: 'correlation-fixture-1',
    eventType: 'fixture.act.recorded',
    act: { input: { kind: 'test_fixture' }, output: { accepted: true } },
    decisionMaker: 'engine',
    autonomyStatus: 'autonomous',
    versions: VERSIONS,
    occurredAt: second === 0 ? AT : serverAt(second),
    occurredAtServer: serverAt(second),
    validity: 'valid',
    ...overrides,
  };
}

function correction(
  stage: EvidenceCorrectionInput['stage'],
  index: number,
): EvidenceCorrectionInput {
  return {
    eventId: `correction-fixture-${index}`,
    correlationId: 'correlation-fixture-1',
    correctionOfEventId: 'evidence-fixture-original',
    stage,
    act: { finding: `fixture-${stage}` },
    decisionMaker: 'verifier',
    autonomyStatus: 'automatic-control',
    versions: VERSIONS,
    occurredAt: serverAt(index + 1),
    occurredAtServer: serverAt(index + 1),
    validity: stage === 'invalidation' ? 'invalid' : 'valid',
  };
}

function expectCode(operation: () => unknown, code: EvidenceLedgerErrorCode): void {
  try {
    operation();
    throw new Error('se esperaba EvidenceLedgerError');
  } catch (error) {
    expect(error).toBeInstanceOf(EvidenceLedgerError);
    expect((error as EvidenceLedgerError).code).toBe(code);
  }
}

describe('EvidenceLedger — emisión y cadena completa', () => {
  it('emite todos los campos literales, sella el objeto completo y encadena por stream', () => {
    const value = ledger();
    const first = value.append(act('evidence-fixture-0', 0));
    const second = value.append(act('evidence-fixture-1', 1, {
      causedByEventId: first.eventId,
      artifactRefs: ['artifact-fixture-1'],
      traceId: 'trace-fixture-1',
      validity: 'deviation',
    }));

    expect(first).toMatchObject({
      schemaVersion: EVIDENCE_EVENT_SCHEMA_VERSION,
      sequenceNumber: 0,
      previousHash: EVIDENCE_CHAIN_GENESIS,
      streamId: 'stream-fixture-1',
      runId: 'run-fixture-1',
      participantPseudoId: 'pseudo-fixture-1',
      sessionId: 'session-fixture-1',
      decisionMaker: 'engine',
      autonomyStatus: 'autonomous',
      validity: 'valid',
    });
    expect(first.hash).toBe(evidenceEventHash(first));
    expect(second.sequenceNumber).toBe(1);
    expect(second.previousHash).toBe(first.hash);
    expect(second.hash).toBe(evidenceEventHash(second));
    expect(second.occurredAtServer).toBe(serverAt(1));
    expect(second.versions).toEqual(VERSIONS);
  });

  it('el JSON y el hash no dependen del orden de propiedades', () => {
    expect(canonicalEvidenceJson({ z: 1, a: { y: true, b: -0 } })).toBe(
      canonicalEvidenceJson({ a: { b: 0, y: true }, z: 1 }),
    );
  });

  it('rechaza valores no JSON, versiones vacías y referencias de artefacto duplicadas', () => {
    expectCode(() => ledger().append(act('bad-json', 0, { act: { score: Number.NaN } })), 'NON_JSON_VALUE');
    expectCode(() => ledger().append(act('bad-versions', 0, { versions: {} })), 'INVALID_ACT');
    expectCode(
      () => ledger().append(act('bad-artifacts', 0, { artifactRefs: ['a1', 'a1'] })),
      'INVALID_ACT',
    );
  });

  it('es append-only y no expone mutación; eventos y copias están congelados', () => {
    const value = ledger();
    value.append(act());
    const surface = value as unknown as Record<string, unknown>;
    for (const forbidden of ['update', 'delete', 'remove', 'clear', 'truncate', 'set']) {
      expect(surface[forbidden]).toBeUndefined();
    }
    const events = value.events();
    expect(Object.isFrozen(events)).toBe(true);
    expect(Object.isFrozen(events[0])).toBe(true);
    expect(Object.isFrozen(events[0]?.payload)).toBe(true);
    expect(() => (events as unknown[]).push({})).toThrow();
    expect(value.events()).toHaveLength(1);
  });

  it('restaura una cadena verificada y continúa desde su cabeza', () => {
    const first = ledger();
    first.append(act('evidence-fixture-0', 0));
    first.append(act('evidence-fixture-1', 1));
    const restored = EvidenceLedger.restore(structuredClone(first.events()));
    const third = restored.append(act('evidence-fixture-2', 2));

    expect(third.sequenceNumber).toBe(2);
    expect(third.previousHash).toBe(first.events()[1]?.hash);
    expect(restored.reconstruct().headHash).toBe(third.hash);
  });

  it('mapea las 22 columnas de PostgreSQL y restaura sin perder validez ni hash', () => {
    const value = ledger();
    const event = value.append(act('persisted-fixture', 0, {
      artifactRefs: ['artifact-fixture-1'],
      validity: 'deviation',
    }));
    const row = toEvidenceEventPersistenceRow(event);
    const parameters = evidenceEventInsertParameters(event);

    expect(row).toMatchObject({
      event_id: event.eventId,
      stream_id: 'stream-fixture-1',
      occurred_at_server: serverAt(0),
      previous_hash: EVIDENCE_CHAIN_GENESIS,
      hash: event.hash,
      validity: 'deviation',
    });
    expect(parameters).toHaveLength(22);
    expect(parameters[20]).toBe(event.hash);
    expect(parameters[21]).toBe('deviation');
    expect(evidenceEventFromPersistenceRow({
      ...row,
      payload: JSON.stringify(row.payload),
      versions: JSON.stringify(row.versions),
      occurred_at: new Date(String(row.occurred_at)),
      occurred_at_server: new Date(String(row.occurred_at_server)),
    })).toEqual(event);
  });
});

describe('replay y proyecciones', () => {
  it('reconstruye las diez proyecciones y conserva tanto vista actual como historia', () => {
    const value = ledger();
    value.append(act('evidence-projections-0', 0, {
      projectionUpdates: EVIDENCE_PROJECTION_TYPES.map((projection) => ({
        projection,
        projectionId: `projection-fixture-${projection}`,
        value: { marker: projection, revision: 0 },
      })),
    }));
    value.append(act('evidence-projections-1', 1, {
      projectionUpdates: [{
        projection: 'session',
        projectionId: 'projection-fixture-session',
        value: { marker: 'session', revision: 1 },
      }],
    }));

    const rebuilt = value.reconstruct();
    for (const projection of EVIDENCE_PROJECTION_TYPES) {
      expect(rebuilt.projections[projection]).toHaveLength(1);
    }
    expect(rebuilt.projections.session[0]?.value).toEqual({ marker: 'session', revision: 1 });
    expect(rebuilt.projectionHistory).toHaveLength(11);
    expect(rebuilt.projectionHistory[0]?.value).toEqual({ marker: 'session', revision: 0 });
    expect(Object.isFrozen(rebuilt.projections)).toBe(true);
    expect(Object.isFrozen(rebuilt.projectionHistory)).toBe(true);
  });

  it('detecta alteración de payload, validez, versiones, secuencia y hash previo', () => {
    const value = ledger();
    value.append(act('evidence-fixture-0', 0));
    value.append(act('evidence-fixture-1', 1));
    const original = structuredClone(value.events());

    for (const mutate of [
      (events: typeof original) => { events[0]!.validity = 'invalid'; },
      (events: typeof original) => { events[0]!.decisionMaker = 'human'; },
      (events: typeof original) => { events[0]!.autonomyStatus = 'human-exception'; },
      (events: typeof original) => { events[0]!.versions = { changed: { version: 'v2' } }; },
      (events: typeof original) => { events[1]!.sequenceNumber = 7; },
      (events: typeof original) => { events[1]!.previousHash = 'f'.repeat(64); },
      (events: typeof original) => { events[0]!.hash = 'f'.repeat(64); },
      (events: typeof original) => {
        events[0]!.payload = { act: { changed: true }, projectionUpdates: [] };
      },
    ]) {
      const tampered = structuredClone(original);
      mutate(tampered);
      expectCode(() => replayEvidenceEvents(tampered), 'BROKEN_CHAIN');
    }
  });

  it('aunque el atacante reselle un evento aislado, detecta cambio de identidad y tiempo regresivo', () => {
    const value = ledger();
    value.append(act('evidence-fixture-0', 0));
    value.append(act('evidence-fixture-1', 1));

    const identity = structuredClone(value.events());
    identity[1]!.participantPseudoId = 'pseudo-distinto';
    identity[1]!.hash = evidenceEventHash(identity[1]!);
    expectCode(() => replayEvidenceEvents(identity), 'IDENTITY_MISMATCH');

    const time = structuredClone(value.events());
    time[1]!.occurredAtServer = '2026-08-16T14:59:59.000Z';
    time[1]!.hash = evidenceEventHash(time[1]!);
    expectCode(() => replayEvidenceEvents(time), 'NON_MONOTONIC_SERVER_TIME');
  });

  it('rechaza ids duplicados al emitir', () => {
    const value = ledger();
    value.append(act('same-id', 0));
    expectCode(() => value.append(act('same-id', 1)), 'DUPLICATE_EVENT');
  });
});

describe('corrección enlazada — P-II §9.6', () => {
  it('fija detección→clasificación→invalidación→reposición→resolución y conserva el original', () => {
    const value = ledger();
    const original = value.append(act('evidence-fixture-original', 0, {
      projectionUpdates: [{
        projection: 'results',
        projectionId: 'result-fixture-1',
        value: { status: 'reported' },
      }],
    }));
    const corrections = EVIDENCE_CORRECTION_STAGES.map((stage, index) =>
      value.appendCorrection(correction(stage, index)),
    );

    expect(value.events()[0]).toBe(original);
    expect(value.events()).toHaveLength(6);
    for (const [index, event] of corrections.entries()) {
      expect(event.correctionOfEventId).toBe(original.eventId);
      expect(event.eventType).toBe(`evidence.correction.${EVIDENCE_CORRECTION_STAGES[index]}`);
      expect(event.causedByEventId).toBe(index === 0 ? original.eventId : corrections[index - 1]?.eventId);
    }
    expect(value.reconstruct().events[0]?.eventId).toBe(original.eventId);
  });

  it('rechaza saltos, duplicados, blancos desconocidos y correcciones simuladas', () => {
    const value = ledger();
    value.append(act('evidence-fixture-original', 0));
    expectCode(() => value.appendCorrection(correction('classification', 0)), 'CORRECTION_SEQUENCE');
    expectCode(
      () => value.appendCorrection({ ...correction('detection', 0), correctionOfEventId: 'missing' }),
      'UNKNOWN_CORRECTION_TARGET',
    );
    expectCode(
      () => value.append(act('fake-correction', 1, { eventType: 'evidence.correction.detection' })),
      'INVALID_ACT',
    );
  });

  it('el replay rechaza correctionOfEventId sin la etapa y el enlace causal requeridos', () => {
    const value = ledger();
    value.append(act('evidence-fixture-original', 0));
    value.append(act('ordinary-fixture', 1));
    const events = structuredClone(value.events());
    events[1]!.correctionOfEventId = 'evidence-fixture-original';
    events[1]!.hash = evidenceEventHash(events[1]!);
    expectCode(() => replayEvidenceEvents(events), 'CORRECTION_SEQUENCE');
  });
});
