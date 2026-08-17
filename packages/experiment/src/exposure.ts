import { ExternalExposure, Id, IsoDateTime } from '@profesor-ia/contracts';
import type { ExternalExposure as ExternalExposureValue } from '@profesor-ia/contracts';
import { z } from 'zod';

/**
 * T-H6-11 — `DEC-EXPOSURE-001`. P-I §10.8 es literal en las cuatro categorías y en
 * sus efectos; este módulo los transcribe sin añadir ninguno.
 */
export const EXTERNAL_EXPOSURE_SCHEMA_VERSION = 'external-exposure-v1' as const;

/** Marca literal de §10.8 para una transición o retención contaminada. */
export const EXTERNAL_EXPOSURE_MARK = 'EXTERNAL_EXPOSURE' as const;
export const NOT_INTERPRETABLE_CEILING = 'NOT_INTERPRETABLE_CEILING' as const;
export const NOT_INTERPRETABLE_FLOOR = 'NOT_INTERPRETABLE_FLOOR' as const;

export interface ExposureEffect {
  readonly exposure: ExternalExposureValue;
  /** §10.8: sólo `DIRECT_ITEM_EXPOSURE` invalida el reactivo/oportunidad. */
  readonly invalidatesAffectedOpportunity: boolean;
  readonly consumesItem: boolean;
  /** Reposición **sólo** desde reserva independiente, y sólo cuando aplica. */
  readonly replacementFromIndependentReserveAllowed: boolean;
  /** §10.8: la contaminación de `TARGET_KC_EXPOSURE` es conceptual, no del ítem. */
  readonly contaminatesAttribution: boolean;
  /** Una transición/retención afectada no puede sostener un veredicto positivo. */
  readonly blocksPositiveVerdict: boolean;
  readonly mark: typeof EXTERNAL_EXPOSURE_MARK | null;
  readonly authority: readonly string[];
}

const EFFECTS: Readonly<Record<ExternalExposureValue, ExposureEffect>> = Object.freeze({
  NONE: Object.freeze({
    exposure: 'NONE',
    invalidatesAffectedOpportunity: false,
    consumesItem: false,
    replacementFromIndependentReserveAllowed: false,
    contaminatesAttribution: false,
    blocksPositiveVerdict: false,
    mark: null,
    authority: Object.freeze(['P-I §10.8']),
  }),
  /** «se registra y no invalida por sí solo» — literal. */
  UNRELATED_OR_FOUNDATION: Object.freeze({
    exposure: 'UNRELATED_OR_FOUNDATION',
    invalidatesAffectedOpportunity: false,
    consumesItem: false,
    replacementFromIndependentReserveAllowed: false,
    contaminatesAttribution: false,
    blocksPositiveVerdict: false,
    mark: null,
    authority: Object.freeze(['P-I §10.8']),
  }),
  /**
   * «contamina la atribución desde el momento declarado (…) no se "limpia"
   * mediante una reposición de reactivo porque la contaminación es conceptual, no
   * del ítem». Por eso `replacementFromIndependentReserveAllowed` es `false`:
   * ofrecer reposición aquí sugeriría que reponer el ítem arregla algo.
   */
  TARGET_KC_EXPOSURE: Object.freeze({
    exposure: 'TARGET_KC_EXPOSURE',
    invalidatesAffectedOpportunity: false,
    consumesItem: false,
    replacementFromIndependentReserveAllowed: false,
    contaminatesAttribution: true,
    blocksPositiveVerdict: true,
    mark: EXTERNAL_EXPOSURE_MARK,
    authority: Object.freeze(['P-I §10.8']),
  }),
  /** «invalida el reactivo/oportunidad afectada, consume el ítem y solo permite
   * reposición desde reserva independiente» — literal. */
  DIRECT_ITEM_EXPOSURE: Object.freeze({
    exposure: 'DIRECT_ITEM_EXPOSURE',
    invalidatesAffectedOpportunity: true,
    consumesItem: true,
    replacementFromIndependentReserveAllowed: true,
    contaminatesAttribution: false,
    blocksPositiveVerdict: false,
    mark: null,
    authority: Object.freeze(['P-I §10.8']),
  }),
});

export type ExposureErrorCode =
  | 'EXPOSURE_DECLARATION_INVALID'
  | 'EXPOSURE_UNKNOWN'
  | 'EXPOSURE_TARGET_MISSING'
  | 'EXPOSURE_SCOPE_UNSUPPORTED'
  | 'CEILING_FLOOR_EVIDENCE_MISSING';

export class ExposureError extends Error {
  constructor(
    readonly code: ExposureErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function fail(code: ExposureErrorCode, message: string): never {
  throw new ExposureError(code, message);
}

/**
 * Se registra **al inicio de cada sesión**, y cubre la exposición «desde la sesión
 * anterior» (§10.8). `declaredAt` es el momento declarado desde el que corre la
 * contaminación, no el momento en que se captura.
 */
export const ExposureDeclaration = z
  .object({
    exposureId: Id,
    sessionId: Id,
    capturedAt: IsoDateTime,
    declaredAt: IsoDateTime,
    exposure: ExternalExposure,
    /** Conjunto experimental afectado; ausente sólo si la exposición no lo toca. */
    experimentalSet: z.string().trim().min(1).optional(),
    affectedKcIds: z.array(Id),
    /** Obligatorio para `DIRECT_ITEM_EXPOSURE`: sin él no se sabe qué invalidar. */
    affectedOpportunityId: Id.optional(),
    /** §10.8: enseñanza humana deliberada sobre KC objetivo. */
    deliberateHumanTeaching: z.boolean(),
  })
  .strict();
export type ExposureDeclaration = z.infer<typeof ExposureDeclaration>;

export interface ExposureAssessment {
  readonly exposureId: string;
  readonly sessionId: string;
  readonly declaredAt: string;
  readonly effect: ExposureEffect;
  readonly affectedOpportunityId: string | null;
  /**
   * §10.8 última viñeta: la enseñanza humana deliberada sobre KC objetivo
   * «mantiene además la regla de intervención pedagógica prohibida». Se conserva
   * como hallazgo de autonomía, no como un efecto más de la exposición.
   */
  readonly prohibitedPedagogicalInterventionObserved: boolean;
  readonly policyVersion: typeof EXTERNAL_EXPOSURE_SCHEMA_VERSION;
}

export function exposureEffectFor(exposureValue: unknown): ExposureEffect {
  const parsed = ExternalExposure.safeParse(exposureValue);
  if (!parsed.success) fail('EXPOSURE_UNKNOWN', 'categoría de exposición fuera del contrato');
  return EFFECTS[parsed.data];
}

export function assessExposure(declarationValue: unknown): ExposureAssessment {
  const parsed = ExposureDeclaration.safeParse(declarationValue);
  if (!parsed.success) {
    fail('EXPOSURE_DECLARATION_INVALID', `declaración inválida: ${parsed.error.message}`);
  }
  const declaration = parsed.data;
  const effect = EFFECTS[declaration.exposure];

  if (declaration.exposure === 'DIRECT_ITEM_EXPOSURE' && declaration.affectedOpportunityId === undefined) {
    fail(
      'EXPOSURE_TARGET_MISSING',
      'DIRECT_ITEM_EXPOSURE invalida una oportunidad concreta y exige declararla',
    );
  }
  if (declaration.exposure === 'TARGET_KC_EXPOSURE' && declaration.affectedKcIds.length === 0) {
    fail(
      'EXPOSURE_TARGET_MISSING',
      'TARGET_KC_EXPOSURE contamina KC objetivo concretos y exige declararlos',
    );
  }
  /**
   * Declarar enseñanza humana deliberada con una categoría que no toca KC
   * objetivo describiría una intervención prohibida sobre nada. Falla en vez de
   * registrarse como benigna.
   */
  if (
    declaration.deliberateHumanTeaching &&
    declaration.exposure !== 'TARGET_KC_EXPOSURE' &&
    declaration.exposure !== 'DIRECT_ITEM_EXPOSURE'
  ) {
    fail(
      'EXPOSURE_SCOPE_UNSUPPORTED',
      'la enseñanza humana deliberada de §10.8 se declara sobre KC objetivo',
    );
  }

  return Object.freeze({
    exposureId: declaration.exposureId,
    sessionId: declaration.sessionId,
    declaredAt: declaration.declaredAt,
    effect,
    affectedOpportunityId: declaration.affectedOpportunityId ?? null,
    prohibitedPedagogicalInterventionObserved: declaration.deliberateHumanTeaching,
    policyVersion: EXTERNAL_EXPOSURE_SCHEMA_VERSION,
  });
}

/** Observación válida de línea base: proporción en `[0,1]`. */
export const BaselineObservation = z
  .object({
    opportunityId: Id,
    observedAt: IsoDateTime,
    score: z.number().min(0).max(1),
  })
  .strict();
export type BaselineObservation = z.infer<typeof BaselineObservation>;

export type BaselineInterpretability =
  | { readonly interpretable: true; readonly mark: null }
  | {
      readonly interpretable: false;
      readonly mark: typeof NOT_INTERPRETABLE_CEILING | typeof NOT_INTERPRETABLE_FLOOR;
      readonly startsIntervention: boolean;
    };

export interface BaselineCeilingFloorInput {
  /** Observaciones **válidas** previas al inicio planificado, en orden temporal. */
  readonly observations: readonly BaselineObservation[];
  /** §10.8 techo: «no existe rango ascendente observable». */
  readonly ascendingRangeObservable: boolean;
  /**
   * §10.8 suelo: la evidencia de fundamentos/interfaz que muestra que el
   * participante **no puede** producir una respuesta puntuable por una barrera
   * previa al KC objetivo. Sin ella, un `0` sigue siendo interpretable.
   */
  readonly foundationOrInterfaceBarrierEvidence: boolean;
}

/**
 * Regla de techo/suelo de §10.8. **El suelo no se declara solo por ceros**: una
 * línea baja o incluso `0` no es por sí sola inválida, y hace falta además la
 * evidencia de barrera. Si las respuestas son válidas y el `0` representa
 * desconocimiento real del KC, la línea sigue siendo interpretable — que es
 * justamente el hallazgo que el diseño busca.
 */
export function assessBaselineCeilingFloor(
  input: BaselineCeilingFloorInput,
): BaselineInterpretability {
  const observations = z.array(BaselineObservation).parse(input.observations);
  const lastThree = observations.slice(-3);
  if (lastThree.length < 3) return Object.freeze({ interpretable: true, mark: null });

  if (lastThree.every((observation) => observation.score === 1) && !input.ascendingRangeObservable) {
    return Object.freeze({
      interpretable: false,
      mark: NOT_INTERPRETABLE_CEILING,
      /** §10.8: «el conjunto no inicia intervención». */
      startsIntervention: false,
    });
  }

  if (lastThree.every((observation) => observation.score === 0)) {
    if (!input.foundationOrInterfaceBarrierEvidence) {
      return Object.freeze({ interpretable: true, mark: null });
    }
    return Object.freeze({
      interpretable: false,
      mark: NOT_INTERPRETABLE_FLOOR,
      startsIntervention: false,
    });
  }

  return Object.freeze({ interpretable: true, mark: null });
}
