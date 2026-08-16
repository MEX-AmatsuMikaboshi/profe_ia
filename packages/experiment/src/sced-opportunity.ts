/**
 * Calibración operativa H5 de la microbatería SCED (DEC-PROBE-ROUND-001).
 *
 * No usa resultados de participantes ni afirma optimalidad psicométrica. Busca
 * la configuración de menor carga que satisface simultáneamente dos criterios
 * predeclarados: (1) una observación válida conserva mayoría de los reactivos
 * planificados y (2) la oportunidad tolera la invalidación de un reactivo.
 */

export interface ScedOpportunityCandidate {
  readonly kSet: number;
  readonly minValidItemsPerOpportunity: number;
}

export interface ScedCoverageEnvelope {
  readonly firstValidRound: 1;
  readonly latestInterventionStartBySet: Readonly<Record<'A' | 'B' | 'C', number>>;
  readonly validInterventionObservationsAfterStart: number;
  readonly requiredValidRounds: number;
  readonly plannedOpportunitiesBySet: Readonly<Record<'A' | 'B' | 'C', number>>;
}

export interface ScedOpportunityCalibration {
  readonly version: string;
  readonly frozenAt: string;
  readonly dataPolicy: 'operational_constraints_no_participant_data';
  readonly method: 'minimum_burden_majority_with_one_item_fault_tolerance_v1';
  readonly kSet: number;
  readonly minValidItemsPerOpportunity: number;
  readonly maxCandidateKSet: number;
  readonly coverageEnvelope: ScedCoverageEnvelope;
}

function positiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} debe ser un entero positivo.`);
}

export function calibrateScedOpportunity(maxKSet = 12): ScedOpportunityCandidate {
  positiveInteger(maxKSet, 'maxKSet');
  const candidates: ScedOpportunityCandidate[] = [];
  for (let kSet = 2; kSet <= maxKSet; kSet += 1) {
    for (let minimum = 1; minimum <= kSet; minimum += 1) {
      const preservesMajority = minimum > kSet / 2;
      const toleratesOneInvalidItem = kSet - 1 >= minimum;
      if (preservesMajority && toleratesOneInvalidItem) {
        candidates.push({ kSet, minValidItemsPerOpportunity: minimum });
      }
    }
  }
  candidates.sort(
    (a, b) =>
      a.kSet - b.kSet ||
      b.minValidItemsPerOpportunity - a.minValidItemsPerOpportunity,
  );
  const selected = candidates[0];
  if (selected === undefined) {
    throw new Error('Ningún candidato satisface mayoría y tolerancia de un reactivo inválido.');
  }
  return Object.freeze(selected);
}

export function deriveScedCoverageEnvelope(): ScedCoverageEnvelope {
  const latestInterventionStartBySet = Object.freeze({ A: 8, B: 11, C: 14 });
  const validInterventionObservationsAfterStart = 5;
  // El inicio ocurre después de comprobar elegibilidad con la observación de
  // línea base de esa ronda. Por eso las cinco observaciones de intervención
  // de C son 15..19 en el peor punto permitido (14).
  const requiredValidRounds =
    latestInterventionStartBySet.C + validInterventionObservationsAfterStart;
  return Object.freeze({
    firstValidRound: 1,
    latestInterventionStartBySet,
    validInterventionObservationsAfterStart,
    requiredValidRounds,
    plannedOpportunitiesBySet: Object.freeze({
      A: requiredValidRounds,
      B: requiredValidRounds,
      C: requiredValidRounds,
    }),
  });
}

/** Literal congelado: la prueba de deriva lo compara con el procedimiento. */
export const SCED_OPPORTUNITY_H5_V1: ScedOpportunityCalibration = Object.freeze({
  version: 'sced-opportunity-h5-v1',
  frozenAt: '2026-08-16',
  dataPolicy: 'operational_constraints_no_participant_data',
  method: 'minimum_burden_majority_with_one_item_fault_tolerance_v1',
  kSet: 3,
  minValidItemsPerOpportunity: 2,
  maxCandidateKSet: 12,
  coverageEnvelope: Object.freeze({
    firstValidRound: 1,
    latestInterventionStartBySet: Object.freeze({ A: 8, B: 11, C: 14 }),
    validInterventionObservationsAfterStart: 5,
    requiredValidRounds: 19,
    plannedOpportunitiesBySet: Object.freeze({ A: 19, B: 19, C: 19 }),
  }),
});

export function reproduceScedOpportunityCalibration(): ScedOpportunityCalibration {
  const selected = calibrateScedOpportunity(SCED_OPPORTUNITY_H5_V1.maxCandidateKSet);
  return Object.freeze({
    version: SCED_OPPORTUNITY_H5_V1.version,
    frozenAt: SCED_OPPORTUNITY_H5_V1.frozenAt,
    dataPolicy: SCED_OPPORTUNITY_H5_V1.dataPolicy,
    method: SCED_OPPORTUNITY_H5_V1.method,
    ...selected,
    maxCandidateKSet: SCED_OPPORTUNITY_H5_V1.maxCandidateKSet,
    coverageEnvelope: deriveScedCoverageEnvelope(),
  });
}
