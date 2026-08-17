import { createHash } from 'node:crypto';
import { DoubtScope, Id, IsoDateTime } from '@profesor-ia/contracts';
import type { DoubtScope as DoubtScopeValue } from '@profesor-ia/contracts';
import { z } from 'zod';

/**
 * T-H6-10. El modelo puede proponer la categoría; **el motor aplica la política**
 * (P-II §7.5 literal). Por eso este módulo no recibe texto de conversación: sólo
 * hechos estructurados que el motor ya conoce. La propuesta del modelo entra
 * aparte, se contrasta y se registra, y nunca decide.
 */
export const DOUBT_POLICY_SCHEMA_VERSION = 'doubt-policy-v1' as const;

/**
 * Las cinco declaraciones son **literales de P-I §8.4**: «El agente debe declarar
 * cuando una pregunta: corresponde al bloque; requiere un prerrequisito;
 * pertenece a otro momento de la unidad; queda fuera del corpus; no puede
 * responderse con suficiente anclaje». `unsafe_or_disallowed` es el sexto miembro
 * del enum de P-II §7.5 y su efecto lo fija el nivel 1 de la jerarquía §8.3.1.
 */
export const DOUBT_DECLARATIONS: Readonly<Record<DoubtScopeValue, string>> = Object.freeze({
  current_block: 'corresponde al bloque',
  blocking_prerequisite: 'requiere un prerrequisito',
  later_in_unit: 'pertenece a otro momento de la unidad',
  outside_corpus: 'queda fuera del corpus',
  insufficient_anchor: 'no puede responderse con suficiente anclaje',
  unsafe_or_disallowed: 'no puede atenderse por seguridad, integridad o no revelación',
});

/**
 * Orden de evaluación. **Es el requisito, no una preferencia**: la jerarquía de
 * P-I §8.3.1 pone seguridad y prerrequisitos por encima de cualquier otra
 * consideración, y dentro del contenido la pertenencia al bloque se decide antes
 * que la calidad del anclaje. Clasificar como `insufficient_anchor` una pregunta
 * que sólo pertenece a un bloque posterior le diría al alumno que el corpus no
 * puede sostener la respuesta, cuando lo cierto es que se enseña más adelante.
 */
export const DOUBT_EVALUATION_ORDER = Object.freeze([
  'unsafe_or_disallowed',
  'blocking_prerequisite',
  'outside_corpus',
  'later_in_unit',
  'insufficient_anchor',
  'current_block',
] as const);

export type DoubtRouteEffect = 'none' | 'prerequisite_recovery';

export interface DoubtEffect {
  readonly scope: DoubtScopeValue;
  /** P-I §8.4: la declaración es obligatoria en los cinco casos que enumera. */
  readonly declarationRequired: true;
  readonly declaration: string;
  /** Sólo el bloque actual puede sostener contenido factual anclado. */
  readonly factualAnswerAuthorized: boolean;
  /** P-I §8.5: una salida no anclada es acompañamiento no factual. */
  readonly nonFactualAccompanimentAuthorized: boolean;
  /** P-I §8.5 literal: una salida no anclada no puede fundamentar calificación. */
  readonly mayGroundGrading: false;
  /** P-I §8.5 literal: no puede introducir una regla o definición. */
  readonly mayIntroduceRuleOrDefinition: false;
  readonly route: DoubtRouteEffect;
  /**
   * La duda **no puede atenderse en este bloque** y espera otra oportunidad. No
   * es lo mismo que estar pendiente: toda duda clasificada queda pendiente en el
   * estado (P-I §8.2) hasta que se resuelve, incluida una `current_block` que aún
   * no se ha respondido.
   */
  readonly deferredToLaterOpportunity: boolean;
  /** P-I §8.5 literal: se registra para auditoría. */
  readonly registeredForAudit: true;
  /** Autoridad literal de la que sale cada efecto; no es prosa decorativa. */
  readonly authority: readonly string[];
}

/**
 * Ningún efecto autoriza fundamentar calificación ni introducir una regla o
 * definición: P-I §8.5 lo prohíbe de toda salida, y una duda nunca es la vía por
 * la que entra una regla nueva al cálculo.
 */
const EFFECTS: Readonly<Record<DoubtScopeValue, DoubtEffect>> = Object.freeze({
  unsafe_or_disallowed: Object.freeze({
    scope: 'unsafe_or_disallowed',
    declarationRequired: true,
    declaration: DOUBT_DECLARATIONS.unsafe_or_disallowed,
    factualAnswerAuthorized: false,
    nonFactualAccompanimentAuthorized: false,
    mayGroundGrading: false,
    mayIntroduceRuleOrDefinition: false,
    route: 'none',
    deferredToLaterOpportunity: false,
    registeredForAudit: true,
    authority: Object.freeze(['P-I §8.3.1 nivel 1', 'P-I §9.6']),
  }),
  blocking_prerequisite: Object.freeze({
    scope: 'blocking_prerequisite',
    declarationRequired: true,
    declaration: DOUBT_DECLARATIONS.blocking_prerequisite,
    factualAnswerAuthorized: false,
    nonFactualAccompanimentAuthorized: true,
    mayGroundGrading: false,
    mayIntroduceRuleOrDefinition: false,
    route: 'prerequisite_recovery',
    deferredToLaterOpportunity: false,
    registeredForAudit: true,
    authority: Object.freeze(['P-I §8.3.1 nivel 2', 'P-I §8.3.2 «fallo de prerrequisito»']),
  }),
  outside_corpus: Object.freeze({
    scope: 'outside_corpus',
    declarationRequired: true,
    declaration: DOUBT_DECLARATIONS.outside_corpus,
    factualAnswerAuthorized: false,
    nonFactualAccompanimentAuthorized: true,
    mayGroundGrading: false,
    mayIntroduceRuleOrDefinition: false,
    route: 'none',
    deferredToLaterOpportunity: false,
    registeredForAudit: true,
    authority: Object.freeze(['P-I §8.5']),
  }),
  later_in_unit: Object.freeze({
    scope: 'later_in_unit',
    declarationRequired: true,
    declaration: DOUBT_DECLARATIONS.later_in_unit,
    factualAnswerAuthorized: false,
    nonFactualAccompanimentAuthorized: true,
    mayGroundGrading: false,
    mayIntroduceRuleOrDefinition: false,
    route: 'none',
    deferredToLaterOpportunity: true,
    registeredForAudit: true,
    authority: Object.freeze(['P-I §9.4 «pertenencia del fragmento al bloque»', 'P-I §8.2']),
  }),
  insufficient_anchor: Object.freeze({
    scope: 'insufficient_anchor',
    declarationRequired: true,
    declaration: DOUBT_DECLARATIONS.insufficient_anchor,
    factualAnswerAuthorized: false,
    nonFactualAccompanimentAuthorized: true,
    mayGroundGrading: false,
    mayIntroduceRuleOrDefinition: false,
    route: 'none',
    deferredToLaterOpportunity: true,
    registeredForAudit: true,
    authority: Object.freeze(['P-I §8.5']),
  }),
  current_block: Object.freeze({
    scope: 'current_block',
    declarationRequired: true,
    declaration: DOUBT_DECLARATIONS.current_block,
    factualAnswerAuthorized: true,
    nonFactualAccompanimentAuthorized: true,
    mayGroundGrading: false,
    mayIntroduceRuleOrDefinition: false,
    route: 'none',
    deferredToLaterOpportunity: false,
    registeredForAudit: true,
    authority: Object.freeze(['P-I §8.4', 'P-I §8.5', 'P-I §9.4']),
  }),
});

export type DoubtPolicyErrorCode =
  | 'DOUBT_FACTS_INVALID'
  | 'DOUBT_SCOPE_UNKNOWN'
  | 'DOUBT_BLOCK_MEMBERSHIP_INCONSISTENT';

export class DoubtPolicyError extends Error {
  constructor(
    readonly code: DoubtPolicyErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function fail(code: DoubtPolicyErrorCode, message: string): never {
  throw new DoubtPolicyError(code, message);
}

/**
 * Hechos que el motor ya posee. No hay campo para el texto de la pregunta: si el
 * texto entrara, la clasificación dependería de interpretarlo y volvería a ser
 * una decisión del modelo por la puerta de atrás.
 */
export const DoubtObservation = z
  .object({
    doubtId: Id,
    occurredAt: IsoDateTime,
    /** `MEASUREMENT_MODE` suprime la clasificación pedagógica entera. */
    pedagogicalMode: z.enum(['LEARNING_MODE', 'MEASUREMENT_MODE']),
    /** Resultado del cribado de seguridad/integridad/no revelación (nivel 1). */
    safetyBlocked: z.boolean(),
    /** Prerrequisitos bloqueantes que el grafo de dominio ya declaró abiertos. */
    blockingPrerequisiteKcIds: z.array(Id),
    /** Fragmentos del corpus que la resolución encontró para la duda. */
    resolvedFragmentIds: z.array(Id),
    /** De los anteriores, los que el filtro de egreso admite por bloque (§9.4). */
    fragmentIdsInCurrentBlock: z.array(Id),
    /** Si los fragmentos admisibles sostienen un anclaje suficiente (§8.5). */
    anchorSufficient: z.boolean(),
    /** Una actividad puntuable abierta impone además §9.6. */
    scorableActivityOpen: z.boolean(),
  })
  .strict();
export type DoubtObservation = z.infer<typeof DoubtObservation>;

export interface DoubtClassification {
  readonly suppressed: false;
  readonly doubtId: string;
  readonly occurredAt: string;
  readonly scope: DoubtScopeValue;
  readonly effect: DoubtEffect;
  /**
   * Verdadero sólo cuando §9.6 recorta un efecto que el alcance sí autorizaba.
   * Se conserva aparte para que la traza distinga «no correspondía responder» de
   * «correspondía, y la no revelación lo impidió».
   */
  readonly withheldByNonRevelation: boolean;
  readonly modelProposal: DoubtScopeValue | null;
  /** `null` cuando no hubo propuesta; nunca se convierte en acuerdo por vacío. */
  readonly modelProposalAgreed: boolean | null;
  readonly policyVersion: typeof DOUBT_POLICY_SCHEMA_VERSION;
}

/**
 * En `MEASUREMENT_MODE` no se clasifica. La duda de contenido durante una sonda
 * «no recibe respuesta pedagógica; el sistema puede responder únicamente sobre
 * derechos/procedimiento» (P-I §7.1.1, ya implementado en T-H6-08), y el reloj no
 * se amplía. Devolver `unsafe_or_disallowed` sería más cómodo y **diría algo
 * falso**: la pregunta no es insegura ni está prohibida, simplemente no es el
 * momento de responderla. Es el mismo defecto que reportar un truncamiento como
 * violación de esquema.
 */
export interface DoubtSuppressedClassification {
  readonly suppressed: true;
  readonly doubtId: string;
  readonly occurredAt: string;
  readonly reason: 'measurement_mode';
  readonly pedagogicalAnswerAuthorized: false;
  readonly rightsOrProcedureInformationAuthorized: true;
  readonly clockExtended: false;
  readonly deferredToLaterOpportunity: true;
  readonly modelProposal: DoubtScopeValue | null;
  readonly policyVersion: typeof DOUBT_POLICY_SCHEMA_VERSION;
}

export type DoubtOutcome = DoubtClassification | DoubtSuppressedClassification;

function deriveScope(facts: DoubtObservation): DoubtScopeValue {
  if (facts.safetyBlocked) return 'unsafe_or_disallowed';
  if (facts.blockingPrerequisiteKcIds.length > 0) return 'blocking_prerequisite';
  if (facts.resolvedFragmentIds.length === 0) return 'outside_corpus';
  if (facts.fragmentIdsInCurrentBlock.length === 0) return 'later_in_unit';
  if (!facts.anchorSufficient) return 'insufficient_anchor';
  return 'current_block';
}

/**
 * Clasifica una duda a partir de hechos estructurados. La propuesta del modelo se
 * registra y se contrasta; no entra en `deriveScope()` en ninguna rama.
 */
export function classifyDoubt(
  observationValue: unknown,
  modelProposalValue?: unknown,
): DoubtOutcome {
  const parsed = DoubtObservation.safeParse(observationValue);
  if (!parsed.success) {
    fail('DOUBT_FACTS_INVALID', `hechos de duda inválidos: ${parsed.error.message}`);
  }
  const facts = parsed.data;

  const inBlock = new Set(facts.fragmentIdsInCurrentBlock);
  const resolved = new Set(facts.resolvedFragmentIds);
  for (const fragmentId of inBlock) {
    if (!resolved.has(fragmentId)) {
      fail(
        'DOUBT_BLOCK_MEMBERSHIP_INCONSISTENT',
        `el fragmento ${fragmentId} se declara del bloque sin estar entre los resueltos`,
      );
    }
  }

  let modelProposal: DoubtScopeValue | null = null;
  if (modelProposalValue !== undefined) {
    const proposal = DoubtScope.safeParse(modelProposalValue);
    if (!proposal.success) {
      fail('DOUBT_SCOPE_UNKNOWN', 'la propuesta del modelo no es un DoubtScope del contrato');
    }
    modelProposal = proposal.data;
  }

  if (facts.pedagogicalMode === 'MEASUREMENT_MODE') {
    return Object.freeze({
      suppressed: true as const,
      doubtId: facts.doubtId,
      occurredAt: facts.occurredAt,
      reason: 'measurement_mode' as const,
      pedagogicalAnswerAuthorized: false as const,
      rightsOrProcedureInformationAuthorized: true as const,
      clockExtended: false as const,
      deferredToLaterOpportunity: true as const,
      modelProposal,
      policyVersion: DOUBT_POLICY_SCHEMA_VERSION,
    });
  }

  const scope = deriveScope(facts);
  const derived = EFFECTS[scope];

  /**
   * §9.6: una actividad puntuable corre en no revelación. Recorta la respuesta
   * factual que `current_block` autorizaría, sin cambiar el alcance declarado.
   */
  const withheldByNonRevelation = facts.scorableActivityOpen && derived.factualAnswerAuthorized;
  const effect: DoubtEffect = withheldByNonRevelation
    ? Object.freeze({
        ...derived,
        factualAnswerAuthorized: false,
        authority: Object.freeze([...derived.authority, 'P-I §9.6']),
      })
    : derived;

  return Object.freeze({
    suppressed: false as const,
    doubtId: facts.doubtId,
    occurredAt: facts.occurredAt,
    scope,
    effect,
    withheldByNonRevelation,
    modelProposal,
    modelProposalAgreed: modelProposal === null ? null : modelProposal === scope,
    policyVersion: DOUBT_POLICY_SCHEMA_VERSION,
  });
}

export function doubtEffectFor(scopeValue: unknown): DoubtEffect {
  const parsed = DoubtScope.safeParse(scopeValue);
  if (!parsed.success) fail('DOUBT_SCOPE_UNKNOWN', 'alcance de duda desconocido');
  return EFFECTS[parsed.data];
}

/** Identidad de la política para el manifiesto de versiones del ledger. */
export function doubtPolicyIdentity(): Readonly<{ version: string; hash: string }> {
  const canonical = JSON.stringify({
    version: DOUBT_POLICY_SCHEMA_VERSION,
    order: DOUBT_EVALUATION_ORDER,
    effects: DOUBT_EVALUATION_ORDER.map((scope) => EFFECTS[scope]),
  });
  return Object.freeze({
    version: DOUBT_POLICY_SCHEMA_VERSION,
    hash: createHash('sha256').update(canonical, 'utf8').digest('hex'),
  });
}
