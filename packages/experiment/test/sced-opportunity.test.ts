import { describe, expect, it } from 'vitest';

import {
  SCED_OPPORTUNITY_H5_V1,
  calibrateScedOpportunity,
  deriveScedCoverageEnvelope,
  reproduceScedOpportunityCalibration,
} from '../src/index.js';

describe('T-H5-11: calibración de la oportunidad SCED', () => {
  it('reproduce exactamente el literal congelado', () => {
    expect(reproduceScedOpportunityCalibration()).toEqual(SCED_OPPORTUNITY_H5_V1);
  });

  it('elige la menor carga que conserva mayoría y tolera un inválido', () => {
    expect(calibrateScedOpportunity()).toEqual({
      kSet: 3,
      minValidItemsPerOpportunity: 2,
    });
    expect(SCED_OPPORTUNITY_H5_V1.minValidItemsPerOpportunity).toBeGreaterThan(
      SCED_OPPORTUNITY_H5_V1.kSet / 2,
    );
    expect(SCED_OPPORTUNITY_H5_V1.kSet - 1).toBeGreaterThanOrEqual(
      SCED_OPPORTUNITY_H5_V1.minValidItemsPerOpportunity,
    );
  });

  it('no presenta la calibración operativa como evidencia de participantes', () => {
    expect(SCED_OPPORTUNITY_H5_V1.dataPolicy).toBe(
      'operational_constraints_no_participant_data',
    );
  });

  it('falla si el espacio candidato no contiene una solución', () => {
    expect(() => calibrateScedOpportunity(1)).toThrow(/Ningún candidato/u);
    expect(() => calibrateScedOpportunity(1.5)).toThrow(/entero positivo/u);
  });
});

describe('sobre nominal de cobertura', () => {
  it('cubre el peor inicio de C y cinco observaciones posteriores', () => {
    const envelope = deriveScedCoverageEnvelope();
    expect(envelope.latestInterventionStartBySet).toEqual({ A: 8, B: 11, C: 14 });
    expect(envelope.requiredValidRounds).toBe(19);
    expect(envelope.plannedOpportunitiesBySet).toEqual({ A: 19, B: 19, C: 19 });
  });

  it('mantiene concurrencia dando una oportunidad nominal por set y ronda válida', () => {
    const envelope = deriveScedCoverageEnvelope();
    for (const opportunities of Object.values(envelope.plannedOpportunitiesBySet)) {
      expect(opportunities).toBe(envelope.requiredValidRounds);
    }
  });
});
