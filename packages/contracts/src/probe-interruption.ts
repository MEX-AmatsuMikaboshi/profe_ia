import { z } from 'zod';
import { INCIDENT_ACTION_BY_LEVEL, Incident } from './incident.js';
import { Id, IsoDateTime } from './primitives.js';

/** Efectos públicos y no pedagógicos de P-II §7.1.1 (T-H6-08). */
export const MeasurementRunDisposition = z.enum(['active', 'paused', 'suspended', 'withdrawn']);
export type MeasurementRunDisposition = z.infer<typeof MeasurementRunDisposition>;

export const MeasurementReplacementDisposition = z.enum([
  'not_applicable',
  'calendar_independent_only',
  'prohibited',
]);
export type MeasurementReplacementDisposition = z.infer<typeof MeasurementReplacementDisposition>;

const Common = {
  effectId: Id,
  runId: Id,
  participantPseudoId: Id,
  opportunityId: Id,
  occurredAt: IsoDateTime,
  immediateFeedbackProvided: z.literal(false),
  pedagogicalResponseProvided: z.literal(false),
  clockExtended: z.literal(false),
};

const PreItemPauseEffect = z
  .object({
    ...Common,
    kind: z.literal('pre_item_pause'),
    probeInstanceId: z.null(),
    itemConsumedByEffect: z.literal(false),
    reasonCode: z.null(),
    opportunityClosed: z.literal(false),
    runDisposition: z.literal('paused'),
    replacementDisposition: z.literal('not_applicable'),
  })
  .strict();

const PostItemPauseEffect = z
  .object({
    ...Common,
    kind: z.literal('post_item_pause'),
    probeInstanceId: Id,
    itemConsumedByEffect: z.literal(false),
    reasonCode: z.literal('invalid_participant_pause'),
    opportunityClosed: z.boolean(),
    runDisposition: z.literal('paused'),
    replacementDisposition: z.literal('calendar_independent_only'),
  })
  .strict();

const PauseResumedEffect = z
  .object({
    ...Common,
    kind: z.literal('pause_resumed'),
    pauseEffectId: Id,
    probeInstanceId: z.null(),
    itemConsumedByEffect: z.literal(false),
    reasonCode: z.null(),
    opportunityClosed: z.boolean(),
    runDisposition: z.literal('active'),
    replacementDisposition: z.literal('not_applicable'),
  })
  .strict();

const ContentQuestionEffect = z
  .object({
    ...Common,
    kind: z.literal('content_question'),
    probeInstanceId: Id,
    itemConsumedByEffect: z.literal(false),
    responseKind: z.enum(['none', 'rights_or_procedure']),
    deadlineBeforeQuestion: IsoDateTime,
    deadlineAfterQuestion: IsoDateTime,
    reasonCode: z.null(),
    opportunityClosed: z.literal(false),
    runDisposition: z.literal('active'),
    replacementDisposition: z.literal('not_applicable'),
  })
  .strict()
  .refine((effect) => effect.deadlineBeforeQuestion === effect.deadlineAfterQuestion, {
    message: 'una duda de contenido no puede ampliar el reloj',
    path: ['deadlineAfterQuestion'],
  });

const ProbeTimeoutEffect = z
  .object({
    ...Common,
    kind: z.literal('probe_timeout'),
    probeInstanceId: Id,
    itemConsumedByEffect: z.literal(false),
    rubricContract: z.string().trim().min(1).max(500),
    deadlineAt: IsoDateTime,
    reasonCode: z.literal('timeout'),
    opportunityClosed: z.boolean(),
    runDisposition: z.literal('active'),
    replacementDisposition: z.literal('calendar_independent_only'),
  })
  .strict();

const SessionTimeExpiredEffect = z
  .object({
    ...Common,
    kind: z.literal('session_time_expired'),
    probeInstanceId: Id.nullable(),
    sessionDeadlineAt: IsoDateTime,
    itemConsumedByEffect: z.literal(false),
    reasonCode: z.literal('missing_session_time'),
    opportunityClosed: z.literal(true),
    runDisposition: z.literal('active'),
    replacementDisposition: z.literal('calendar_independent_only'),
  })
  .strict();

const WithdrawalEffect = z
  .object({
    ...Common,
    kind: z.literal('withdrawal'),
    probeInstanceId: Id.nullable(),
    consentDecisionRef: Id,
    itemConsumedByEffect: z.literal(false),
    reasonCode: z.literal('withdrawal'),
    opportunityClosed: z.literal(true),
    runDisposition: z.literal('withdrawn'),
    replacementDisposition: z.literal('prohibited'),
  })
  .strict();

const IncidentEffect = z
  .object({
    ...Common,
    kind: z.literal('incident'),
    probeInstanceId: Id.nullable(),
    itemConsumedByEffect: z.literal(false),
    incident: Incident,
    scope: z.enum(['localized', 'systemic']),
    reasonCode: z.literal('incident').nullable(),
    opportunityClosed: z.boolean(),
    runDisposition: MeasurementRunDisposition,
    replacementDisposition: MeasurementReplacementDisposition,
  })
  .strict()
  .superRefine((effect, context) => {
    const expectedAction = INCIDENT_ACTION_BY_LEVEL[effect.incident.level];
    if (effect.incident.action !== expectedAction) {
      context.addIssue({ code: 'custom', message: 'acción no corresponde al nivel canónico', path: ['incident'] });
    }
    const systemic = effect.incident.level === 3;
    const invalidating = effect.incident.level >= 2;
    if (effect.scope !== (systemic ? 'systemic' : 'localized')) {
      context.addIssue({ code: 'custom', message: 'alcance no corresponde al nivel', path: ['scope'] });
    }
    if (effect.reasonCode !== (invalidating ? 'incident' : null)) {
      context.addIssue({ code: 'custom', message: 'reasonCode no corresponde al efecto del incidente' });
    }
    if (effect.opportunityClosed !== systemic) {
      context.addIssue({ code: 'custom', message: 'solo un incidente sistémico cierra la oportunidad' });
    }
    if (effect.runDisposition !== (systemic ? 'suspended' : 'active')) {
      context.addIssue({ code: 'custom', message: 'disposición de corrida no corresponde al incidente' });
    }
    const replacement = effect.incident.level === 2
      ? 'calendar_independent_only'
      : 'not_applicable';
    if (effect.replacementDisposition !== replacement) {
      context.addIssue({ code: 'custom', message: 'reposición no corresponde al nivel del incidente' });
    }
  });

export const MeasurementControlEffect = z.discriminatedUnion('kind', [
  PreItemPauseEffect,
  PostItemPauseEffect,
  PauseResumedEffect,
  ContentQuestionEffect,
  ProbeTimeoutEffect,
  SessionTimeExpiredEffect,
  WithdrawalEffect,
  IncidentEffect,
]);
export type MeasurementControlEffect = z.infer<typeof MeasurementControlEffect>;
