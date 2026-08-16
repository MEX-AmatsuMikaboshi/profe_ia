import { RegenerationInputError, RegenerationLimitError } from './errors.js';
import { type FamilyRegistry } from './family.js';
import {
  W3_REJECTION_CODES,
  type W3ItemRecord,
  type W3RejectionCode,
} from './generation.js';

/**
 * Límites de regeneración (T-H5-09 ← P-III §4.3 y P-II §5.4).
 *
 * Son cifras literales, pero P-III las llama «parámetros operativos iniciales
 * de la versión». Por eso se exponen como datos con `parameterId`: W5 puede
 * enumerarlas y congelarlas en vez de depender de números escondidos en `if`.
 */
export const REGENERATION_PARAMETERS = Object.freeze({
  attemptsPerCandidate: Object.freeze({
    parameterId: 'REGEN-CANDIDATE-MAX-ATTEMPTS',
    value: 5,
    source: 'P-III §4.3: «máximo 5 intentos por candidato individual»',
  }),
  regenerationsPerFamily: Object.freeze({
    parameterId: 'REGEN-FAMILY-MAX-REGENERATIONS',
    value: 3,
    source: 'P-III §4.3: «máximo 3 regeneraciones por familia antes de bloqueo»',
  }),
  automaticRejectionPercent: Object.freeze({
    parameterId: 'REGEN-FAMILY-UNSTABLE-REJECTION-PERCENT',
    value: 30,
    source: 'P-III §4.3: «más de 30 % de rechazo automático»',
  }),
});

/**
 * Restricciones que pueden volver al agente. Es un catálogo cerrado y no
 * contiene fórmulas, pasos, contramodelos ni texto libre del verificador.
 */
export const SAFE_REGENERATION_CONSTRAINTS = [
  'use_authorized_calculus_syntax',
  'use_catalogued_kc_labels',
  'declare_at_least_one_target_kc',
  'use_declared_bank_reserve',
  'make_goal_non_trivial',
  'keep_premises_jointly_satisfiable_unless_declared',
  'stay_within_semantically_valid_statements',
  'reduce_search_complexity_without_assuming_nonexistence',
  'do_not_include_solution_content',
  'respect_frozen_hint_policy',
  'change_candidate_identity_or_structure',
  'avoid_source_exercise_similarity',
] as const;
export type SafeRegenerationConstraint = (typeof SAFE_REGENERATION_CONSTRAINTS)[number];

const SAFE_CONSTRAINT_BY_REJECTION: Readonly<
  Record<W3RejectionCode, readonly SafeRegenerationConstraint[]>
> = Object.freeze({
  syntax_not_in_authorized_calculus: ['use_authorized_calculus_syntax'],
  kc_label_not_in_catalog: ['use_catalogued_kc_labels'],
  kc_labels_missing: ['declare_at_least_one_target_kc'],
  bank_function_not_a_reserve: ['use_declared_bank_reserve'],
  goal_trivial: ['make_goal_non_trivial'],
  premises_unsatisfiable: ['keep_premises_jointly_satisfiable_unless_declared'],
  premise_satisfiability_not_decidable: ['reduce_search_complexity_without_assuming_nonexistence'],
  semantically_invalid: ['stay_within_semantically_valid_statements'],
  search_budget_exhausted: ['reduce_search_complexity_without_assuming_nonexistence'],
  no_proof_with_cost_at_most_k: ['reduce_search_complexity_without_assuming_nonexistence'],
  solution_leaked_in_statement: ['do_not_include_solution_content'],
  hint_policy_violation: ['respect_frozen_hint_policy'],
  trivial_duplicate_of_candidate: ['change_candidate_identity_or_structure'],
  isomorphic_to_candidate: ['change_candidate_identity_or_structure'],
  duplicate_of_corpus_exercise: ['avoid_source_exercise_similarity'],
});

export interface RegenerationFeedback {
  readonly candidateId: string;
  readonly attemptNumber: number;
  readonly failureCodes: readonly W3RejectionCode[];
  readonly safeConstraints: readonly SafeRegenerationConstraint[];
}

export interface RegenerationAttemptRecord {
  readonly candidateId: string;
  readonly itemFamilyId?: string;
  readonly attemptNumber: number;
  readonly accepted: boolean;
  readonly failureCodes: readonly W3RejectionCode[];
  /** Causa interna para auditoría. Nunca forma parte de `RegenerationFeedback`. */
  readonly causes: readonly Readonly<{ code: W3RejectionCode; detail: string }>[];
}

export interface FamilyRegenerationStatus {
  readonly itemFamilyId: string;
  readonly memberCount: number;
  readonly automaticallyRejectedMembers: number;
  readonly automaticRejectionPercent: number;
  readonly regenerationCount: number;
  readonly unstable: boolean;
  readonly blocked: boolean;
}

export interface RegenerationControlReport {
  readonly parameters: typeof REGENERATION_PARAMETERS;
  /** W5 lo cambia mediante el manifiesto; este mecanismo por sí solo no finge freeze. */
  readonly parametersFrozenInRegistry: false;
  readonly familiesByControlPriority: readonly FamilyRegenerationStatus[];
}

/**
 * Registro append-only en memoria de los intentos de W3. No ofrece `update`,
 * `repair`, `remove` ni `clear`: P-II §5.4 exige candidato nuevo y prohíbe la
 * reparación manual silenciosa.
 */
export class RegenerationRegistry {
  readonly #families: FamilyRegistry;
  readonly #attempts: RegenerationAttemptRecord[] = [];
  readonly #regenerations = new Map<string, number>();

  constructor(families: FamilyRegistry) {
    this.#families = families;
  }

  recordAttempt(item: W3ItemRecord): RegenerationFeedback | null {
    this.#assertCoherentItem(item);
    if (item.itemFamilyId !== undefined && this.familyStatus(item.itemFamilyId).unstable) {
      throw new RegenerationLimitError(
        `${item.itemFamilyId} está bloqueada por inestable y no puede volver al pipeline ` +
          'hasta rediseñar su plantilla.',
      );
    }

    const attemptNumber = this.#attempts.filter((a) => a.candidateId === item.candidateId).length + 1;
    if (attemptNumber > REGENERATION_PARAMETERS.attemptsPerCandidate.value) {
      throw new RegenerationLimitError(
        `${item.candidateId} excede ${REGENERATION_PARAMETERS.attemptsPerCandidate.value} intentos ` +
          `(${REGENERATION_PARAMETERS.attemptsPerCandidate.parameterId}).`,
      );
    }

    const failureCodes = Object.freeze([...new Set(item.rejections.map((r) => r.code))]);
    this.#attempts.push(
      Object.freeze({
        candidateId: item.candidateId,
        ...(item.itemFamilyId === undefined ? {} : { itemFamilyId: item.itemFamilyId }),
        attemptNumber,
        accepted: item.accepted,
        failureCodes,
        causes: Object.freeze(item.rejections.map((r) => Object.freeze({ ...r }))),
      }),
    );

    if (item.accepted) return null;
    return feedbackFor(item.candidateId, attemptNumber, failureCodes);
  }

  /**
   * Autoriza la creación de un candidato nuevo. La operación cuenta antes de
   * devolver el informe, de modo que una caída posterior no regala un intento.
   */
  requestRegeneration(candidateId: string): RegenerationFeedback {
    const last = this.#attempts.findLast((a) => a.candidateId === candidateId);
    if (last === undefined || last.accepted || last.failureCodes.length === 0) {
      throw new RegenerationInputError(
        `${candidateId} no tiene un rechazo automático registrado que justifique regeneración.`,
      );
    }
    if (last.itemFamilyId === undefined) {
      throw new RegenerationInputError(
        `${candidateId} no tiene familia verificable. Sin los cuatro componentes de P-I §7.8 ` +
          'no se puede cargar una regeneración a una familia inventada.',
      );
    }

    const before = this.familyStatus(last.itemFamilyId);
    if (before.unstable) {
      throw new RegenerationLimitError(
        `${last.itemFamilyId} tiene ${before.automaticRejectionPercent}% de rechazo automático; ` +
          `supera ${REGENERATION_PARAMETERS.automaticRejectionPercent.value}% y requiere rediseño.`,
      );
    }
    if (before.regenerationCount >= REGENERATION_PARAMETERS.regenerationsPerFamily.value) {
      throw new RegenerationLimitError(
        `${last.itemFamilyId} agotó ${before.regenerationCount} regeneraciones ` +
          `(${REGENERATION_PARAMETERS.regenerationsPerFamily.parameterId}).`,
      );
    }

    this.#regenerations.set(last.itemFamilyId, before.regenerationCount + 1);
    return feedbackFor(last.candidateId, last.attemptNumber, last.failureCodes);
  }

  attempts(): readonly RegenerationAttemptRecord[] {
    return Object.freeze(this.#attempts.map((a) => Object.freeze({ ...a })));
  }

  familyStatus(itemFamilyId: string): FamilyRegenerationStatus {
    const members = this.#families.members().get(itemFamilyId);
    if (members === undefined || members.length === 0) {
      throw new RegenerationInputError(`${itemFamilyId} no existe en el registro inmutable de familias.`);
    }
    const memberSet = new Set(members);
    const rejected = new Set(
      this.#attempts
        .filter((a) => a.itemFamilyId === itemFamilyId && !a.accepted && memberSet.has(a.candidateId))
        .map((a) => a.candidateId),
    );
    const automaticRejectionPercent = (rejected.size / memberSet.size) * 100;
    const regenerationCount = this.#regenerations.get(itemFamilyId) ?? 0;
    const unstable =
      automaticRejectionPercent > REGENERATION_PARAMETERS.automaticRejectionPercent.value;
    return Object.freeze({
      itemFamilyId,
      memberCount: memberSet.size,
      automaticallyRejectedMembers: rejected.size,
      automaticRejectionPercent,
      regenerationCount,
      unstable,
      blocked:
        unstable || regenerationCount >= REGENERATION_PARAMETERS.regenerationsPerFamily.value,
    });
  }

  /** Orden requerido antes del freeze: más regeneraciones, luego mayor rechazo. */
  controlPriority(): readonly FamilyRegenerationStatus[] {
    return Object.freeze(
      [...this.#families.members().keys()]
        .map((id) => this.familyStatus(id))
        .sort(
          (a, b) =>
            b.regenerationCount - a.regenerationCount ||
            b.automaticRejectionPercent - a.automaticRejectionPercent ||
            a.itemFamilyId.localeCompare(b.itemFamilyId),
        ),
    );
  }

  controlReport(): RegenerationControlReport {
    return Object.freeze({
      parameters: REGENERATION_PARAMETERS,
      parametersFrozenInRegistry: false,
      familiesByControlPriority: this.controlPriority(),
    });
  }

  #assertCoherentItem(item: W3ItemRecord): void {
    if (item.accepted === (item.rejections.length > 0)) {
      throw new RegenerationInputError(
        `${item.candidateId} contradice accepted y rejections; el conteo no puede decidir si fue rechazo.`,
      );
    }
    for (const rejection of item.rejections) {
      if (!(W3_REJECTION_CODES as readonly string[]).includes(rejection.code)) {
        throw new RegenerationInputError(`Código de rechazo no autorizado: ${String(rejection.code)}.`);
      }
    }
    const assignment = this.#families.get(item.candidateId);
    if (item.itemFamilyId !== undefined) {
      if (assignment === undefined || assignment.itemFamilyId !== item.itemFamilyId) {
        throw new RegenerationInputError(
          `${item.candidateId} declara ${item.itemFamilyId}, pero el registro inmutable no lo confirma.`,
        );
      }
    } else if (assignment !== undefined) {
      throw new RegenerationInputError(
        `${item.candidateId} omite la familia ${assignment.itemFamilyId} que ya consta en el registro.`,
      );
    }
  }
}

function feedbackFor(
  candidateId: string,
  attemptNumber: number,
  failureCodes: readonly W3RejectionCode[],
): RegenerationFeedback {
  const safeConstraints = Object.freeze([
    ...new Set(failureCodes.flatMap((code) => SAFE_CONSTRAINT_BY_REJECTION[code])),
  ]);
  return Object.freeze({ candidateId, attemptNumber, failureCodes, safeConstraints });
}
