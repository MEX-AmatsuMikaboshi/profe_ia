import { createHash } from 'node:crypto';
import {
  EvidenceEvent,
  Id,
  VersionManifest,
} from '@profesor-ia/contracts';
import type {
  DecisionMaker,
  EventAutonomyStatus,
  EventValidity,
  EvidenceEvent as EvidenceEventValue,
  VersionManifest as VersionManifestValue,
} from '@profesor-ia/contracts';

/** Versión del sobre y del algoritmo de hash de T-H6-09. */
export const EVIDENCE_EVENT_SCHEMA_VERSION = 'evidence-event-v1' as const;
export const EVIDENCE_CHAIN_GENESIS = 'GENESIS' as const;

/** Las diez proyecciones exigidas por T-H6-09 / P-II §9.4 con BKT congelado en OFF. */
export const EVIDENCE_PROJECTION_TYPES = [
  'session',
  'domain',
  'coverage',
  'strategy',
  'eligibility',
  'wheel_spinning',
  'intervention',
  'load',
  'incidents',
  'results',
] as const;
export type EvidenceProjectionType = (typeof EVIDENCE_PROJECTION_TYPES)[number];

/** Secuencia literal de P-II §9.6; el original nunca se sustituye. */
export const EVIDENCE_CORRECTION_STAGES = [
  'detection',
  'classification',
  'invalidation',
  'replacement',
  'resolution',
] as const;
export type EvidenceCorrectionStage = (typeof EVIDENCE_CORRECTION_STAGES)[number];

export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export type EvidenceLedgerErrorCode =
  | 'BROKEN_CHAIN'
  | 'CORRECTION_SEQUENCE'
  | 'DUPLICATE_EVENT'
  | 'IDENTITY_MISMATCH'
  | 'INVALID_ACT'
  | 'INVALID_EVENT'
  | 'NON_JSON_VALUE'
  | 'NON_MONOTONIC_SERVER_TIME'
  | 'UNKNOWN_CORRECTION_TARGET';

export class EvidenceLedgerError extends Error {
  constructor(
    readonly code: EvidenceLedgerErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface EvidenceStreamBinding {
  readonly streamId: string;
  readonly runId: string;
  readonly participantPseudoId: string;
  readonly sessionId: string;
}

export interface EvidenceProjectionUpdate extends JsonObject {
  readonly projection: EvidenceProjectionType;
  readonly projectionId: string;
  readonly value: JsonObject;
}

export interface EvidenceAppendInput {
  readonly eventId: string;
  readonly correlationId: string;
  readonly causedByEventId?: string;
  readonly artifactRefs?: readonly string[];
  readonly traceId?: string;
  readonly eventType: string;
  /** Entrada/salida estructurada minimizada o referencia al artefacto suprimible. */
  readonly act: JsonObject;
  readonly decisionMaker: DecisionMaker;
  readonly autonomyStatus: EventAutonomyStatus;
  readonly versions: VersionManifestValue;
  readonly occurredAt: string;
  /** Se exige antes de sellar: el valor por defecto de la BD no puede quedar fuera del hash. */
  readonly occurredAtServer: string;
  readonly validity: EventValidity;
  readonly projectionUpdates?: readonly EvidenceProjectionUpdate[];
}

export interface EvidenceCorrectionInput
  extends Omit<EvidenceAppendInput, 'causedByEventId' | 'eventType'> {
  readonly correctionOfEventId: string;
  readonly stage: EvidenceCorrectionStage;
}

interface EvidencePayloadEnvelope extends JsonObject {
  readonly act: JsonObject;
  readonly projectionUpdates: readonly EvidenceProjectionUpdate[];
  readonly correctionStage?: EvidenceCorrectionStage;
}

export interface EvidenceProjectedValue {
  readonly projection: EvidenceProjectionType;
  readonly projectionId: string;
  readonly value: JsonObject;
  readonly sourceEventId: string;
  readonly sequenceNumber: number;
  readonly validity: EventValidity;
}

export type EvidenceProjectionView = Readonly<{
  [Projection in EvidenceProjectionType]: readonly EvidenceProjectedValue[];
}>;

export interface ReconstructedEvidence {
  readonly binding: EvidenceStreamBinding | null;
  readonly events: readonly EvidenceEventValue[];
  readonly eventCount: number;
  readonly headHash: string | null;
  /** Último valor por `projection + projectionId`. */
  readonly projections: EvidenceProjectionView;
  /** Historial íntegro de actualizaciones, incluidas las reemplazadas por correcciones. */
  readonly projectionHistory: readonly EvidenceProjectedValue[];
}

/** Forma exacta de `evidence.event`; JSONB se mantiene estructurado. */
export interface EvidenceEventPersistenceRow {
  readonly event_id: string;
  readonly schema_version: string;
  readonly stream_id: string;
  readonly sequence_number: number;
  readonly correlation_id: string;
  readonly caused_by_event_id: string | null;
  readonly artifact_refs: readonly string[] | null;
  readonly trace_id: string | null;
  readonly run_id: string;
  readonly participant_pseudo_id: string;
  readonly session_id: string;
  readonly event_type: string;
  readonly payload: unknown;
  readonly decision_maker: DecisionMaker;
  readonly autonomy_status: EventAutonomyStatus;
  readonly versions: unknown;
  readonly occurred_at: string | Date;
  readonly occurred_at_server: string | Date;
  readonly correction_of_event_id: string | null;
  readonly previous_hash: string;
  readonly hash: string;
  readonly validity: EventValidity;
}

export const EVIDENCE_EVENT_INSERT_SQL = `
INSERT INTO evidence.event (
  event_id, schema_version, stream_id, sequence_number, correlation_id,
  caused_by_event_id, artifact_refs, trace_id, run_id, participant_pseudo_id,
  session_id, event_type, payload, decision_maker, autonomy_status, versions,
  occurred_at, occurred_at_server, correction_of_event_id, previous_hash, hash, validity
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
  $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
)
RETURNING *
`.trim();

const PROJECTION_TYPE_SET = new Set<string>(EVIDENCE_PROJECTION_TYPES);
const CORRECTION_STAGE_SET = new Set<string>(EVIDENCE_CORRECTION_STAGES);

function fail(code: EvidenceLedgerErrorCode, message: string): never {
  throw new EvidenceLedgerError(code, message);
}

function assertJson(value: unknown, path: string, seen: Set<object>): asserts value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('NON_JSON_VALUE', `${path}: número no finito`);
    return;
  }
  if (typeof value !== 'object') {
    fail('NON_JSON_VALUE', `${path}: valor ${typeof value} no serializable como JSON`);
  }
  if (seen.has(value)) fail('NON_JSON_VALUE', `${path}: referencia circular`);

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      for (const [index, entry] of value.entries()) assertJson(entry, `${path}[${index}]`, seen);
      return;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      fail('NON_JSON_VALUE', `${path}: solo se admiten objetos JSON planos`);
    }
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') fail('NON_JSON_VALUE', `${path}: clave simbólica no serializable`);
      assertJson((value as Record<string, unknown>)[key], `${path}.${key}`, seen);
    }
  } finally {
    seen.delete(value);
  }
}

/** Serialización canónica: claves ordenadas, -0 normalizado y solo valores JSON finitos. */
export function canonicalEvidenceJson(value: unknown): string {
  assertJson(value, '$', new Set<object>());

  function serialize(entry: JsonValue): string {
    if (entry === null) return 'null';
    if (typeof entry === 'string' || typeof entry === 'boolean') return JSON.stringify(entry);
    if (typeof entry === 'number') return JSON.stringify(Object.is(entry, -0) ? 0 : entry);
    if (Array.isArray(entry)) return `[${entry.map((item) => serialize(item)).join(',')}]`;
    const objectEntry = entry as JsonObject;
    return `{${Object.keys(objectEntry)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${serialize(objectEntry[key] as JsonValue)}`)
      .join(',')}}`;
  }

  return serialize(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(canonicalEvidenceJson(value)) as T;
}

/** Valida y copia un valor estructurado antes de incorporarlo al ledger. */
export function evidenceJsonObject(value: unknown): JsonObject {
  return cloneJson(asPlainRecord(value, 'value')) as JsonObject;
}

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (typeof value !== 'object' || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

function asPlainRecord(value: unknown, path: string): Record<string, unknown> {
  assertJson(value, path, new Set<object>());
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    return fail('INVALID_EVENT', `${path}: se esperaba un objeto JSON`);
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(
  record: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  path: string,
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      fail('INVALID_EVENT', `${path}: falta ${key}`);
    }
  }
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail('INVALID_EVENT', `${path}: campo no permitido ${key}`);
  }
}

function parseProjectionUpdate(value: unknown, path: string): EvidenceProjectionUpdate {
  const record = asPlainRecord(value, path);
  assertExactKeys(record, ['projection', 'projectionId', 'value'], [], path);
  if (typeof record.projection !== 'string' || !PROJECTION_TYPE_SET.has(record.projection)) {
    return fail('INVALID_EVENT', `${path}.projection: proyección desconocida`);
  }
  const projectionId = Id.safeParse(record.projectionId);
  if (!projectionId.success) fail('INVALID_EVENT', `${path}.projectionId: id inválido`);
  const projectionValue = asPlainRecord(record.value, `${path}.value`);
  return {
    projection: record.projection as EvidenceProjectionType,
    projectionId: projectionId.data,
    value: projectionValue as JsonObject,
  };
}

function parseEnvelope(payload: unknown): EvidencePayloadEnvelope {
  const record = asPlainRecord(payload, 'payload');
  assertExactKeys(record, ['act', 'projectionUpdates'], ['correctionStage'], 'payload');
  const act = asPlainRecord(record.act, 'payload.act') as JsonObject;
  if (!Array.isArray(record.projectionUpdates)) {
    return fail('INVALID_EVENT', 'payload.projectionUpdates: se esperaba un arreglo');
  }
  const projectionUpdates = record.projectionUpdates.map((entry, index) =>
    parseProjectionUpdate(entry, `payload.projectionUpdates[${index}]`),
  );
  const seen = new Set<string>();
  for (const update of projectionUpdates) {
    const key = `${update.projection}\u0000${update.projectionId}`;
    if (seen.has(key)) {
      fail('INVALID_EVENT', `payload.projectionUpdates: actualización duplicada ${update.projection}/${update.projectionId}`);
    }
    seen.add(key);
  }

  if (record.correctionStage === undefined) return { act, projectionUpdates };
  if (
    typeof record.correctionStage !== 'string' ||
    !CORRECTION_STAGE_SET.has(record.correctionStage)
  ) {
    return fail('INVALID_EVENT', 'payload.correctionStage: etapa desconocida');
  }
  return {
    act,
    projectionUpdates,
    correctionStage: record.correctionStage as EvidenceCorrectionStage,
  };
}

function parseVersions(value: unknown, code: EvidenceLedgerErrorCode): VersionManifestValue {
  const parsed = VersionManifest.safeParse(value);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return fail(code, 'versions debe declarar al menos una versión válida');
  }
  return parsed.data;
}

function parseBinding(value: EvidenceStreamBinding): EvidenceStreamBinding {
  const parsed = {
    streamId: Id.safeParse(value.streamId),
    runId: Id.safeParse(value.runId),
    participantPseudoId: Id.safeParse(value.participantPseudoId),
    sessionId: Id.safeParse(value.sessionId),
  };
  for (const [key, result] of Object.entries(parsed)) {
    if (!result.success) fail('INVALID_ACT', `${key}: id inválido`);
  }
  return deepFreeze({
    streamId: parsed.streamId.data as string,
    runId: parsed.runId.data as string,
    participantPseudoId: parsed.participantPseudoId.data as string,
    sessionId: parsed.sessionId.data as string,
  });
}

/** SHA-256 del evento completo salvo el propio campo `hash`. */
export function evidenceEventHash(
  eventValue: EvidenceEventValue | Omit<EvidenceEventValue, 'hash'>,
): string {
  const record = eventValue as EvidenceEventValue & { hash?: string };
  const covered: Record<string, unknown> = { ...record };
  Reflect.deleteProperty(covered, 'hash');
  return createHash('sha256').update(canonicalEvidenceJson(covered), 'utf8').digest('hex');
}

function parseStoredEvent(value: unknown): EvidenceEventValue {
  let cloned: unknown;
  try {
    cloned = cloneJson(value);
  } catch (error) {
    if (error instanceof EvidenceLedgerError) throw error;
    return fail('INVALID_EVENT', String(error));
  }
  const parsed = EvidenceEvent.safeParse(cloned);
  if (!parsed.success) fail('INVALID_EVENT', `EvidenceEvent inválido: ${parsed.error.message}`);
  if (parsed.data.schemaVersion !== EVIDENCE_EVENT_SCHEMA_VERSION) {
    fail('INVALID_EVENT', `schemaVersion no soportada: ${parsed.data.schemaVersion}`);
  }
  if (parsed.data.streamId === undefined || parsed.data.occurredAtServer === undefined) {
    fail('INVALID_EVENT', 'el ledger runtime exige streamId y occurredAtServer antes de sellar');
  }
  parseVersions(parsed.data.versions, 'INVALID_EVENT');
  parseEnvelope(parsed.data.payload);
  return deepFreeze(parsed.data);
}

function assertOwnHash(event: EvidenceEventValue): void {
  if (evidenceEventHash(event) !== event.hash) {
    fail('BROKEN_CHAIN', `hash inválido en ${event.eventId}`);
  }
}

function persistenceJson(value: unknown, column: string): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return fail('INVALID_EVENT', `${column} no contiene JSON válido`);
  }
}

function persistenceTime(value: string | Date, column: string): string {
  if (typeof value === 'string') return value;
  try {
    return value.toISOString();
  } catch {
    return fail('INVALID_EVENT', `${column} no contiene una fecha válida`);
  }
}

/** Mapea sin omitir `validity` ni el tiempo de servidor que ya quedó dentro del hash. */
export function toEvidenceEventPersistenceRow(
  eventValue: unknown,
): EvidenceEventPersistenceRow {
  const event = parseStoredEvent(eventValue);
  assertOwnHash(event);
  return deepFreeze({
    event_id: event.eventId,
    schema_version: event.schemaVersion,
    stream_id: event.streamId as string,
    sequence_number: event.sequenceNumber,
    correlation_id: event.correlationId,
    caused_by_event_id: event.causedByEventId ?? null,
    artifact_refs: event.artifactRefs ?? null,
    trace_id: event.traceId ?? null,
    run_id: event.runId,
    participant_pseudo_id: event.participantPseudoId,
    session_id: event.sessionId,
    event_type: event.eventType,
    payload: event.payload,
    decision_maker: event.decisionMaker,
    autonomy_status: event.autonomyStatus,
    versions: event.versions,
    occurred_at: event.occurredAt,
    occurred_at_server: event.occurredAtServer as string,
    correction_of_event_id: event.correctionOfEventId ?? null,
    previous_hash: event.previousHash,
    hash: event.hash,
    validity: event.validity,
  });
}

/** Orden exacto de parámetros de `EVIDENCE_EVENT_INSERT_SQL`. */
export function evidenceEventInsertParameters(eventValue: unknown): readonly unknown[] {
  const row = toEvidenceEventPersistenceRow(eventValue);
  return Object.freeze([
    row.event_id,
    row.schema_version,
    row.stream_id,
    row.sequence_number,
    row.correlation_id,
    row.caused_by_event_id,
    row.artifact_refs,
    row.trace_id,
    row.run_id,
    row.participant_pseudo_id,
    row.session_id,
    row.event_type,
    row.payload,
    row.decision_maker,
    row.autonomy_status,
    row.versions,
    row.occurred_at,
    row.occurred_at_server,
    row.correction_of_event_id,
    row.previous_hash,
    row.hash,
    row.validity,
  ]);
}

/** Restaura la fila PostgreSQL y vuelve a comprobar el hash antes del replay de la cadena. */
export function evidenceEventFromPersistenceRow(
  row: EvidenceEventPersistenceRow,
): EvidenceEventValue {
  const event = parseStoredEvent({
    eventId: row.event_id,
    schemaVersion: row.schema_version,
    streamId: row.stream_id,
    sequenceNumber: row.sequence_number,
    correlationId: row.correlation_id,
    ...(row.caused_by_event_id === null ? {} : { causedByEventId: row.caused_by_event_id }),
    ...(row.artifact_refs === null ? {} : { artifactRefs: row.artifact_refs }),
    ...(row.trace_id === null ? {} : { traceId: row.trace_id }),
    runId: row.run_id,
    participantPseudoId: row.participant_pseudo_id,
    sessionId: row.session_id,
    eventType: row.event_type,
    payload: persistenceJson(row.payload, 'payload'),
    decisionMaker: row.decision_maker,
    autonomyStatus: row.autonomy_status,
    versions: persistenceJson(row.versions, 'versions'),
    occurredAt: persistenceTime(row.occurred_at, 'occurred_at'),
    occurredAtServer: persistenceTime(row.occurred_at_server, 'occurred_at_server'),
    ...(row.correction_of_event_id === null
      ? {}
      : { correctionOfEventId: row.correction_of_event_id }),
    previousHash: row.previous_hash,
    hash: row.hash,
    validity: row.validity,
  });
  assertOwnHash(event);
  return event;
}

function emptyProjectionMaps(): Map<EvidenceProjectionType, Map<string, EvidenceProjectedValue>> {
  return new Map(EVIDENCE_PROJECTION_TYPES.map((projection) => [projection, new Map()]));
}

function projectionView(
  maps: Map<EvidenceProjectionType, Map<string, EvidenceProjectedValue>>,
): EvidenceProjectionView {
  const view = Object.fromEntries(
    EVIDENCE_PROJECTION_TYPES.map((projection) => [
      projection,
      Object.freeze([...(maps.get(projection)?.values() ?? [])]),
    ]),
  ) as Record<EvidenceProjectionType, readonly EvidenceProjectedValue[]>;
  return deepFreeze(view);
}

/**
 * Verifica contrato, cadena, identidad, tiempos, correcciones y reconstruye las
 * diez vistas. Recalcula cada hash; aceptar solo `previousHash` no detectaría
 * una historia resellada de forma incompleta.
 */
export function replayEvidenceEvents(eventValues: readonly unknown[]): ReconstructedEvidence {
  const events: EvidenceEventValue[] = [];
  const byId = new Map<string, EvidenceEventValue>();
  const hashes = new Set<string>();
  const projectionMaps = emptyProjectionMaps();
  const projectionHistory: EvidenceProjectedValue[] = [];
  const correctionProgress = new Map<string, { nextIndex: number; previousEventId: string }>();
  let binding: EvidenceStreamBinding | null = null;
  let previous: EvidenceEventValue | undefined;

  for (const value of eventValues) {
    const event = parseStoredEvent(value);
    const streamId = event.streamId as string;
    const occurredAtServer = event.occurredAtServer as string;
    const eventBinding = {
      streamId,
      runId: event.runId,
      participantPseudoId: event.participantPseudoId,
      sessionId: event.sessionId,
    };

    if (binding === null) binding = parseBinding(eventBinding);
    else if (canonicalEvidenceJson(binding) !== canonicalEvidenceJson(eventBinding)) {
      fail('IDENTITY_MISMATCH', `el evento ${event.eventId} cambia la identidad del stream`);
    }
    if (byId.has(event.eventId)) fail('DUPLICATE_EVENT', `eventId duplicado: ${event.eventId}`);
    if (hashes.has(event.hash)) fail('DUPLICATE_EVENT', `hash duplicado: ${event.hash}`);

    const expectedSequence = previous === undefined ? 0 : previous.sequenceNumber + 1;
    const expectedPreviousHash = previous === undefined ? EVIDENCE_CHAIN_GENESIS : previous.hash;
    if (
      event.sequenceNumber !== expectedSequence ||
      event.previousHash !== expectedPreviousHash ||
      evidenceEventHash(event) !== event.hash
    ) {
      fail('BROKEN_CHAIN', `cadena o hash inválido en ${event.eventId}`);
    }
    if (
      previous?.occurredAtServer !== undefined &&
      Date.parse(occurredAtServer) < Date.parse(previous.occurredAtServer)
    ) {
      fail('NON_MONOTONIC_SERVER_TIME', `occurredAtServer retrocede en ${event.eventId}`);
    }

    const envelope = parseEnvelope(event.payload);
    if (event.correctionOfEventId !== undefined) {
      const original = byId.get(event.correctionOfEventId);
      if (original === undefined) {
        fail('UNKNOWN_CORRECTION_TARGET', `corrección ${event.eventId} no referencia un original previo`);
      }
      if (event.correctionOfEventId === event.eventId || envelope.correctionStage === undefined) {
        fail('CORRECTION_SEQUENCE', `corrección inválida en ${event.eventId}`);
      }
      const progress = correctionProgress.get(event.correctionOfEventId) ?? {
        nextIndex: 0,
        previousEventId: original.eventId,
      };
      const expectedStage = EVIDENCE_CORRECTION_STAGES[progress.nextIndex];
      if (
        envelope.correctionStage !== expectedStage ||
        event.eventType !== `evidence.correction.${expectedStage}` ||
        event.causedByEventId !== progress.previousEventId
      ) {
        fail('CORRECTION_SEQUENCE', `etapa o enlace causal inválido en ${event.eventId}`);
      }
      correctionProgress.set(event.correctionOfEventId, {
        nextIndex: progress.nextIndex + 1,
        previousEventId: event.eventId,
      });
    } else if (
      envelope.correctionStage !== undefined ||
      event.eventType.startsWith('evidence.correction.')
    ) {
      fail('CORRECTION_SEQUENCE', `evento ${event.eventId} simula una corrección sin original`);
    }

    for (const update of envelope.projectionUpdates) {
      const projected = deepFreeze({
        ...update,
        sourceEventId: event.eventId,
        sequenceNumber: event.sequenceNumber,
        validity: event.validity,
      });
      projectionMaps.get(update.projection)?.set(update.projectionId, projected);
      projectionHistory.push(projected);
    }

    events.push(event);
    byId.set(event.eventId, event);
    hashes.add(event.hash);
    previous = event;
  }

  return deepFreeze({
    binding,
    events: Object.freeze(events),
    eventCount: events.length,
    headHash: previous?.hash ?? null,
    projections: projectionView(projectionMaps),
    projectionHistory: Object.freeze(projectionHistory),
  });
}

function normalizeEnvelope(
  actValue: JsonObject,
  updatesValue: readonly EvidenceProjectionUpdate[] | undefined,
  correctionStage?: EvidenceCorrectionStage,
): EvidencePayloadEnvelope {
  const act = asPlainRecord(actValue, 'act') as JsonObject;
  const updates = (updatesValue ?? []).map((update, index) =>
    parseProjectionUpdate(update, `projectionUpdates[${index}]`),
  );
  const seen = new Set<string>();
  for (const update of updates) {
    const key = `${update.projection}\u0000${update.projectionId}`;
    if (seen.has(key)) fail('INVALID_ACT', `proyección duplicada: ${update.projection}/${update.projectionId}`);
    seen.add(key);
  }
  return correctionStage === undefined
    ? { act, projectionUpdates: updates }
    : { act, projectionUpdates: updates, correctionStage };
}

/** Ledger de un solo stream. La superficie pública solo permite añadir o restaurar. */
export class EvidenceLedger {
  readonly #binding: EvidenceStreamBinding;
  readonly #events: EvidenceEventValue[] = [];

  constructor(binding: EvidenceStreamBinding) {
    this.#binding = parseBinding(binding);
  }

  static restore(eventValues: readonly unknown[]): EvidenceLedger {
    const reconstructed = replayEvidenceEvents(eventValues);
    if (reconstructed.binding === null) {
      return fail('INVALID_EVENT', 'no se puede restaurar un ledger vacío sin identidad de stream');
    }
    const ledger = new EvidenceLedger(reconstructed.binding);
    ledger.#events.push(...reconstructed.events);
    return ledger;
  }

  binding(): EvidenceStreamBinding {
    return this.#binding;
  }

  events(): readonly EvidenceEventValue[] {
    return Object.freeze([...this.#events]);
  }

  reconstruct(): ReconstructedEvidence {
    return replayEvidenceEvents(this.#events);
  }

  append(input: EvidenceAppendInput): EvidenceEventValue {
    if (input.eventType.startsWith('evidence.correction.')) {
      return fail('INVALID_ACT', 'las correcciones solo se añaden con appendCorrection()');
    }
    return this.#appendPrepared(input, normalizeEnvelope(input.act, input.projectionUpdates));
  }

  appendCorrection(input: EvidenceCorrectionInput): EvidenceEventValue {
    const original = this.#events.find((event) => event.eventId === input.correctionOfEventId);
    if (original === undefined) {
      return fail('UNKNOWN_CORRECTION_TARGET', `no existe ${input.correctionOfEventId}`);
    }
    const corrections = this.#events.filter(
      (event) => event.correctionOfEventId === input.correctionOfEventId,
    );
    const expectedStage = EVIDENCE_CORRECTION_STAGES[corrections.length];
    if (input.stage !== expectedStage) {
      return fail(
        'CORRECTION_SEQUENCE',
        `se esperaba ${expectedStage ?? 'ninguna etapa adicional'}, no ${input.stage}`,
      );
    }
    const causedByEventId = corrections.at(-1)?.eventId ?? original.eventId;
    return this.#appendPrepared(
      {
        ...input,
        causedByEventId,
        eventType: `evidence.correction.${input.stage}`,
      },
      normalizeEnvelope(input.act, input.projectionUpdates, input.stage),
      input.correctionOfEventId,
    );
  }

  #appendPrepared(
    input: EvidenceAppendInput,
    envelope: EvidencePayloadEnvelope,
    correctionOfEventId?: string,
  ): EvidenceEventValue {
    if (this.#events.some((event) => event.eventId === input.eventId)) {
      return fail('DUPLICATE_EVENT', `eventId duplicado: ${input.eventId}`);
    }
    if (input.causedByEventId === input.eventId) {
      return fail('INVALID_ACT', 'un evento no puede causarse a sí mismo');
    }
    const versions = parseVersions(input.versions, 'INVALID_ACT');
    const previous = this.#events.at(-1);
    if (
      previous?.occurredAtServer !== undefined &&
      Date.parse(input.occurredAtServer) < Date.parse(previous.occurredAtServer)
    ) {
      return fail('NON_MONOTONIC_SERVER_TIME', 'occurredAtServer no puede retroceder');
    }
    if (input.artifactRefs !== undefined && new Set(input.artifactRefs).size !== input.artifactRefs.length) {
      return fail('INVALID_ACT', 'artifactRefs contiene ids duplicados');
    }

    const draft = {
      schemaVersion: EVIDENCE_EVENT_SCHEMA_VERSION,
      eventId: input.eventId,
      sequenceNumber: previous === undefined ? 0 : previous.sequenceNumber + 1,
      streamId: this.#binding.streamId,
      correlationId: input.correlationId,
      ...(input.causedByEventId === undefined ? {} : { causedByEventId: input.causedByEventId }),
      ...(input.artifactRefs === undefined ? {} : { artifactRefs: [...input.artifactRefs] }),
      ...(input.traceId === undefined ? {} : { traceId: input.traceId }),
      runId: this.#binding.runId,
      participantPseudoId: this.#binding.participantPseudoId,
      sessionId: this.#binding.sessionId,
      eventType: input.eventType,
      payload: envelope,
      decisionMaker: input.decisionMaker,
      autonomyStatus: input.autonomyStatus,
      versions,
      occurredAt: input.occurredAt,
      occurredAtServer: input.occurredAtServer,
      ...(correctionOfEventId === undefined ? {} : { correctionOfEventId }),
      previousHash: previous?.hash ?? EVIDENCE_CHAIN_GENESIS,
      validity: input.validity,
    } satisfies Omit<EvidenceEventValue, 'hash'>;
    const candidate = { ...draft, hash: evidenceEventHash(draft) };
    const parsed = parseStoredEvent(candidate);
    if (this.#events.some((event) => event.hash === parsed.hash)) {
      return fail('DUPLICATE_EVENT', `hash duplicado: ${parsed.hash}`);
    }
    this.#events.push(parsed);
    return parsed;
  }
}
