import { Id, IsoDateTime, RESERVES } from '@profesor-ia/contracts';
import type { Reserve } from '@profesor-ia/contracts';
import { MEASUREMENT_RESERVES } from '@profesor-ia/authoring-core';
import { z } from 'zod';

/**
 * T-H6-12 — `foundation_phase` de P-I §5.2.1. Los tres KC y el bloqueo son
 * literales; el **criterio de suficiencia no lo es**, y por eso entra como dato
 * preinscrito con procedencia en vez de cablearse aquí.
 */
export const FOUNDATION_PHASE_SCHEMA_VERSION = 'foundation-phase-v1' as const;

/** «KC01, KC02 y KC08 son fundamentos compartidos de Etapa 1» — literal. */
export const FOUNDATION_KC_IDS = Object.freeze(['KC01', 'KC02', 'KC08'] as const);
export type FoundationKcId = (typeof FOUNDATION_KC_IDS)[number];

export const FOUNDATION_NOT_READY = 'foundation_not_ready' as const;

/**
 * Reservas experimentales de las que `foundation_phase` **no** puede tomar
 * material. Se reutiliza `MEASUREMENT_RESERVES`, que `authoring-core` ya deriva
 * recorriendo el contrato, en vez de escribir aquí una segunda lista que
 * envejecería aparte.
 *
 * **`replacement` no está**, y no es un olvido: D-21 dejó registrado que ninguna
 * autoridad dice si el banco de reposición es de enseñanza o de medición, y por
 * eso se resuelve como dato mediante `replacesReserve`. Meterlo aquí a mano
 * decidiría por invención lo que D-21 dejó expresamente abierto.
 */
export const EXPERIMENTAL_RESERVES: readonly Reserve[] = MEASUREMENT_RESERVES;

export type FoundationErrorCode =
  | 'FOUNDATION_INPUT_INVALID'
  | 'FOUNDATION_KC_NOT_FOUNDATION'
  | 'FOUNDATION_TARGET_KC_CONFLICT'
  | 'FOUNDATION_MATERIAL_FROM_EXPERIMENTAL_RESERVE'
  | 'FOUNDATION_CRITERION_NOT_PREINSCRIBED'
  | 'FOUNDATION_HUMAN_TEACHING_PROHIBITED';

export class FoundationPhaseError extends Error {
  constructor(
    readonly code: FoundationErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function fail(code: FoundationErrorCode, message: string): never {
  throw new FoundationPhaseError(code, message);
}

/**
 * El criterio de suficiencia es **preinscrito** (§5.2.1 literal), no derivable de
 * ninguna autoridad de este repositorio. Entra como dato con procedencia y con la
 * evidencia de que se fijó **antes** de mirar resultados; sin eso no se evalúa.
 */
export const FoundationSufficiencyCriterion = z
  .object({
    criterionId: Id,
    /** Procedencia: quién y cuándo lo preinscribió. */
    preregisteredAt: IsoDateTime,
    preregistrationRef: z.string().trim().min(1),
    purpose: z.enum(['material', 'test_fixture']),
    /** Aciertos exigidos por KC de fundamento. */
    requiredCorrectPerKc: z.number().int().positive(),
    /** Oportunidades máximas antes de declarar `foundation_not_ready`. */
    maximumOpportunitiesPerKc: z.number().int().positive(),
  })
  .strict()
  .superRefine((criterion, context) => {
    if (criterion.requiredCorrectPerKc > criterion.maximumOpportunitiesPerKc) {
      context.addIssue({
        code: 'custom',
        message: 'el criterio exige más aciertos de los que permite intentar',
      });
    }
  });
export type FoundationSufficiencyCriterion = z.infer<typeof FoundationSufficiencyCriterion>;

export const FoundationMaterial = z
  .object({
    materialId: Id,
    kcId: z.enum(FOUNDATION_KC_IDS),
    reserve: z.enum(RESERVES),
    /** D-21: sólo `replacement` la usa, y ahí es obligatoria. */
    replacesReserve: z.enum(RESERVES).optional(),
  })
  .strict()
  .superRefine((material, context) => {
    if (material.reserve === 'replacement' && material.replacesReserve === undefined) {
      context.addIssue({
        code: 'custom',
        message:
          'un material de reposición debe declarar a qué reserva repone (D-21): su naturaleza no la fija ninguna autoridad',
      });
    }
    if (material.reserve !== 'replacement' && material.replacesReserve !== undefined) {
      context.addIssue({
        code: 'custom',
        message: 'sólo un material de reposición declara `replacesReserve`',
      });
    }
  });
export type FoundationMaterial = z.infer<typeof FoundationMaterial>;

export const FoundationObservation = z
  .object({
    observationId: Id,
    kcId: z.enum(FOUNDATION_KC_IDS),
    materialId: Id,
    correct: z.boolean(),
    observedAt: IsoDateTime,
    /** §5.2.1: la enseñanza de fundamentos la realiza Profesor IA. */
    taughtBy: z.enum(['profesor_ia', 'human']),
  })
  .strict();
export type FoundationObservation = z.infer<typeof FoundationObservation>;

export const FoundationPhaseInput = z
  .object({
    runId: Id,
    criterion: FoundationSufficiencyCriterion,
    /** KC objetivo declarados de A/B/C, para comprobar que no incluyen fundamentos. */
    experimentalTargetKcIds: z.array(Id),
    materials: z.array(FoundationMaterial),
    observations: z.array(FoundationObservation),
    /** La familiarización de interfaz precede a la fase (§5.2.1). */
    interfaceFamiliarizationCompleted: z.boolean(),
  })
  .strict();
export type FoundationPhaseInput = z.infer<typeof FoundationPhaseInput>;

export interface FoundationKcOutcome {
  readonly kcId: FoundationKcId;
  readonly correct: number;
  readonly opportunities: number;
  readonly sufficient: boolean;
}

export interface FoundationPhaseAssessment {
  readonly runId: string;
  readonly criterionId: string;
  readonly perKc: readonly FoundationKcOutcome[];
  readonly sufficient: boolean;
  /** `foundation_not_ready` bloquea el inicio experimental (§5.2.1). */
  readonly status: 'foundation_ready' | typeof FOUNDATION_NOT_READY;
  readonly experimentalRunMayStart: boolean;
  /**
   * §5.2.1: el resultado «cuenta para autonomía/viabilidad y como límite
   * descriptivo de la preparación, pero **no** como resultado negativo de una
   * transición A/B/C».
   */
  readonly countsForAutonomyAndViability: true;
  readonly countsAsNegativeAbcTransition: false;
  /** §5.2.1: sus resultados no se mezclan con `probe_accuracy` de A/B/C. */
  readonly metricNamespace: 'foundation_phase';
  readonly entersScedCausalInference: false;
  readonly policyVersion: typeof FOUNDATION_PHASE_SCHEMA_VERSION;
}

export function assessFoundationPhase(inputValue: unknown): FoundationPhaseAssessment {
  const parsed = FoundationPhaseInput.safeParse(inputValue);
  if (!parsed.success) {
    fail('FOUNDATION_INPUT_INVALID', `entrada inválida: ${parsed.error.message}`);
  }
  const input = parsed.data;

  if (!input.interfaceFamiliarizationCompleted) {
    fail(
      'FOUNDATION_INPUT_INVALID',
      'la fase va después de la familiarización puramente de interfaz',
    );
  }

  /** «no pueden ser KC objetivo de los conjuntos A/B/C» — literal. */
  for (const kcId of input.experimentalTargetKcIds) {
    if ((FOUNDATION_KC_IDS as readonly string[]).includes(kcId)) {
      fail(
        'FOUNDATION_TARGET_KC_CONFLICT',
        `${kcId} es fundamento compartido y no puede ser KC objetivo de A/B/C`,
      );
    }
  }

  /** «con materiales que no pertenecen a las reservas experimentales» — literal. */
  const materialById = new Map<string, FoundationMaterial>();
  for (const material of input.materials) {
    /** D-21: una reposición cuenta por la reserva que repone, no por su etiqueta. */
    const effective = material.replacesReserve ?? material.reserve;
    if (EXPERIMENTAL_RESERVES.includes(effective)) {
      fail(
        'FOUNDATION_MATERIAL_FROM_EXPERIMENTAL_RESERVE',
        `el material ${material.materialId} sale de la reserva experimental ${effective}`,
      );
    }
    materialById.set(material.materialId, material);
  }

  const perKc = FOUNDATION_KC_IDS.map((kcId) => {
    const observed = input.observations.filter((observation) => observation.kcId === kcId);
    for (const observation of observed) {
      /** «un humano no puede completarla pedagógicamente para habilitar el piloto». */
      if (observation.taughtBy === 'human') {
        fail(
          'FOUNDATION_HUMAN_TEACHING_PROHIBITED',
          `la observación ${observation.observationId} declara enseñanza humana de fundamentos`,
        );
      }
      const material = materialById.get(observation.materialId);
      if (material === undefined) {
        fail(
          'FOUNDATION_INPUT_INVALID',
          `la observación ${observation.observationId} cita un material no declarado`,
        );
      }
      if (material.kcId !== kcId) {
        fail(
          'FOUNDATION_KC_NOT_FOUNDATION',
          `la observación ${observation.observationId} usa material de ${material.kcId} para ${kcId}`,
        );
      }
    }
    const correct = observed.filter((observation) => observation.correct).length;
    return Object.freeze({
      kcId,
      correct,
      opportunities: observed.length,
      sufficient: correct >= input.criterion.requiredCorrectPerKc,
    });
  });

  const sufficient = perKc.every((outcome) => outcome.sufficient);
  return Object.freeze({
    runId: input.runId,
    criterionId: input.criterion.criterionId,
    perKc: Object.freeze(perKc),
    sufficient,
    status: sufficient ? ('foundation_ready' as const) : FOUNDATION_NOT_READY,
    experimentalRunMayStart: sufficient,
    countsForAutonomyAndViability: true,
    countsAsNegativeAbcTransition: false,
    metricNamespace: 'foundation_phase',
    entersScedCausalInference: false,
    policyVersion: FOUNDATION_PHASE_SCHEMA_VERSION,
  });
}

/**
 * Una corrida material exige un criterio preinscrito **material**. Un
 * `test_fixture` prueba el mecanismo y no habilita el inicio experimental: dejarlo
 * pasar convertiría un umbral de prueba en la puerta del piloto.
 */
export function assertFoundationCriterionPreregistered(
  criterionValue: unknown,
  purpose: 'material' | 'test_fixture',
): FoundationSufficiencyCriterion {
  const parsed = FoundationSufficiencyCriterion.safeParse(criterionValue);
  if (!parsed.success) {
    fail('FOUNDATION_CRITERION_NOT_PREINSCRIBED', `criterio inválido: ${parsed.error.message}`);
  }
  if (purpose === 'material' && parsed.data.purpose !== 'material') {
    fail(
      'FOUNDATION_CRITERION_NOT_PREINSCRIBED',
      'una corrida material exige un criterio de suficiencia preinscrito material',
    );
  }
  return parsed.data;
}
