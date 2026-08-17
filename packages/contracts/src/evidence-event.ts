import { z } from 'zod';
import {
  DecisionMaker,
  EventAutonomyStatus,
  Id,
  IsoDateTime,
  Sha256Hex,
  VersionManifest,
} from './primitives.js';

/**
 * Evento mínimo de la bitácora — **transcripción literal de P-II §9.1**
 * (I-6, DEC-LEDGER-001).
 *
 * `participantPseudoId` nunca contiene identidad real. El payload es
 * estructurado y minimizado: cuando una respuesta libre, transcripción, audio,
 * imagen u otro contenido potencialmente identificable deba conservarse, se
 * almacena como artefacto **suprimible fuera de la cadena append-only** y el
 * evento guarda solo la referencia y, cuando proceda, su hash. Un hash o un
 * seudónimo no se presentan como anonimización.
 */

/** Payload: estructura minimizada o referencia a artefacto suprimible. */
export const EvidencePayload = z.union([
  z.record(z.string(), z.unknown()),
  z.object({ artifactRef: Id, artifactHash: Sha256Hex.optional() }),
]);
export type EvidencePayload = z.infer<typeof EvidencePayload>;

/** Validez del acto — literal P-II §9.1 (distinta de la validez operacional de sonda). */
export const EventValidity = z.enum(['valid', 'invalid', 'deviation']);
export type EventValidity = z.infer<typeof EventValidity>;

export const EvidenceEvent = z.object({
  schemaVersion: z.string().min(1),
  eventId: Id,
  sequenceNumber: z.number().int().nonnegative(),
  streamId: Id.optional(),
  correlationId: Id,
  causedByEventId: Id.optional(),
  artifactRefs: z.array(Id).optional(),
  traceId: Id.optional(),
  runId: Id,
  participantPseudoId: Id,
  sessionId: Id,
  eventType: z.string().min(1),
  payload: EvidencePayload,
  decisionMaker: DecisionMaker,
  autonomyStatus: EventAutonomyStatus,
  versions: VersionManifest,
  occurredAt: IsoDateTime,
  occurredAtServer: IsoDateTime.optional(),
  /** Una corrección es un evento nuevo enlazado; nunca sobrescribe (I-6). */
  correctionOfEventId: Id.optional(),
  previousHash: z.string().min(1),
  hash: Sha256Hex,
  validity: EventValidity,
}).strict();
export type EvidenceEvent = z.infer<typeof EvidenceEvent>;

/**
 * Familias mínimas de evento multimodal — literal P-II §9.3.
 * No se crea telemetría experimental paralela: voz, pizarrón, percepción y
 * anotaciones se registran en este mismo ledger.
 */
export const MULTIMODAL_EVENT_TYPES = [
  'speech.capture.started',
  'stt.committed',
  'speech.capture.stopped',
  'tts.requested',
  'tts.started',
  'tts.completed',
  'tts.interrupted',
  'tts.failed',
  'board.element.created',
  'board.element.updated',
  'board.element.deleted',
  'board.scene.snapshot',
  'visual.capture.created',
  'visual.analysis.requested',
  'visual.analysis.completed',
  'annotation.proposed',
  'annotation.resolved',
  'annotation.rendered',
  'annotation.cleared',
  'stt.transcript.corrected',
  'visual.interpretation.corrected',
] as const;

/** Checkpoint firmado de la cadena (Plan.md T-H10-01). */
export const LedgerCheckpoint = z.object({
  checkpointId: Id,
  streamId: Id.optional(),
  runId: Id,
  chainHead: Sha256Hex,
  fromSequence: z.number().int().nonnegative(),
  toSequence: z.number().int().nonnegative(),
  manifestHash: Sha256Hex,
  /** La clave privada es inaccesible para session-engine y model-gateway. */
  keyId: Id,
  signature: z.string().min(1),
  createdAt: IsoDateTime,
});
export type LedgerCheckpoint = z.infer<typeof LedgerCheckpoint>;
