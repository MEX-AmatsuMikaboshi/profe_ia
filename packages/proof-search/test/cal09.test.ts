import { describe, expect, it } from 'vitest';
import {
  CAL09_FROZEN_MANIFEST,
  COMPLEXITY_FEATURES,
  CalibrationPendingError,
  assertComparable,
  cal09Samples,
  calibrateComplexity,
  classifyComplexity,
  complexityFeatureVector,
  complexityIndex,
  complexityTierMatches,
  runCal09Calibration,
  type ComplexityCalibrationSample,
  type StructuralComplexityProfile,
} from '../src/index.js';

describe('CAL-09: pesos y comparabilidad congelados en H5', () => {
  it('la corrida reproduce byte por byte el manifiesto literal congelado', () => {
    expect(runCal09Calibration()).toEqual(CAL09_FROZEN_MANIFEST);
  });

  it('las etiquetas predeclaradas baja/media/alta se recuperan en toda la muestra', () => {
    for (const sample of cal09Samples()) {
      expect(classifyComplexity(sample.profile, CAL09_FROZEN_MANIFEST), sample.caseId).toBe(
        sample.tier,
      );
      expect(complexityTierMatches(sample.profile, sample.tier, CAL09_FROZEN_MANIFEST)).toBe(true);
    }
  });

  it('usa soluciones verificadas sintéticas y declara que no hay datos de participante', () => {
    expect(CAL09_FROZEN_MANIFEST.dataPolicy).toBe('no_participant_data');
    expect(cal09Samples().every((sample) => sample.dataOrigin === 'synthetic_verified_solution')).toBe(
      true,
    );
    expect(CAL09_FROZEN_MANIFEST.sampleIds).toHaveLength(13);
    expect(CAL09_FROZEN_MANIFEST.sampleHash).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('cada medida normativa está visible y su peso deriva como entero; los ceros no se ocultan', () => {
    expect(Object.keys(CAL09_FROZEN_MANIFEST.features).sort()).toEqual(
      [...COMPLEXITY_FEATURES].sort(),
    );
    for (const feature of COMPLEXITY_FEATURES) {
      expect(Number.isInteger(CAL09_FROZEN_MANIFEST.features[feature].weight)).toBe(true);
      expect(CAL09_FROZEN_MANIFEST.features[feature].weight).toBeGreaterThanOrEqual(0);
    }
    expect(
      CAL09_FROZEN_MANIFEST.features.distinctStrategiesFoundWithinBudget.weight,
    ).toBe(0);
  });

  it('el índice queda acotado 0..100 incluso fuera del rango de la muestra', () => {
    const base = cal09Samples()[0]!.profile;
    const huge: StructuralComplexityProfile = {
      ...base,
      structural: {
        ...base.structural,
        proofLength: 1_000_000,
        distinctRuleCount: 1_000_000,
        subproofCount: 1_000_000,
        maxSubproofDepth: 1_000_000,
        premiseCount: 1_000_000,
        connectivesInStatement: 1_000_000,
        requiresAssumptionDischarge: true,
        usesIndirectStrategy: true,
        structuralDistance: 1_000_000,
      },
      searchRelative: {
        ...base.searchRelative,
        workUnitsSpent: Number.MAX_SAFE_INTEGER,
        costExplored: 1_000_000,
        distinctStrategiesFoundWithinBudget: 1_000_000,
      },
    };
    expect(complexityIndex(huge, CAL09_FROZEN_MANIFEST)).toBe(100);
  });

  it('la comparabilidad es simétrica y niega equivalencia psicométrica', () => {
    const samples = cal09Samples();
    const ab = assertComparable(samples[0]!.profile, samples[1]!.profile, CAL09_FROZEN_MANIFEST);
    const ba = assertComparable(samples[1]!.profile, samples[0]!.profile, CAL09_FROZEN_MANIFEST);
    expect(ab.comparable).toBe(true);
    expect(ab.difference).toBe(ba.difference);
    expect(ab.interpretation).toBe('structurally_comparable_not_psychometrically_equivalent');
  });

  it('separa casos cuya diferencia supera la banda congelada', () => {
    const samples = cal09Samples();
    const low = samples.find((sample) => sample.caseId === 'cal09-low-conjunction-elim')!;
    const high = samples.find((sample) => sample.caseId === 'cal09-high-indirect')!;
    expect(assertComparable(low.profile, high.profile, CAL09_FROZEN_MANIFEST).comparable).toBe(false);
  });

  it('no acepta manifiesto de otra versión ni telemetría con timeout', () => {
    const profile = cal09Samples()[0]!.profile;
    expect(() =>
      complexityIndex(profile, {
        ...CAL09_FROZEN_MANIFEST,
        verifierVersion: 'otra' as typeof CAL09_FROZEN_MANIFEST.verifierVersion,
      }),
    ).toThrow(CalibrationPendingError);
    expect(() =>
      complexityIndex(
        { ...profile, searchRelative: { ...profile.searchRelative, wallTimeoutHit: true } },
        CAL09_FROZEN_MANIFEST,
      ),
    ).toThrow(CalibrationPendingError);
  });

  it('el vector separa medidas estructurales de telemetría relativa', () => {
    const vector = complexityFeatureVector(cal09Samples()[0]!.profile);
    expect(vector).toHaveProperty('proofLength');
    expect(vector).toHaveProperty('workUnitsLog2');
    expect(vector).not.toHaveProperty('totalPaths');
  });

  it('falla cerrado con estrato insuficiente, ids repetidos o mezcla de modo', () => {
    const samples = cal09Samples();
    expect(() => calibrateComplexity(samples.slice(0, 2), '2026-08-16')).toThrow(
      CalibrationPendingError,
    );

    const duplicate: ComplexityCalibrationSample = { ...samples[1]!, caseId: samples[0]!.caseId };
    expect(() => calibrateComplexity([samples[0]!, duplicate, ...samples.slice(2)], '2026-08-16')).toThrow(
      /repetido/u,
    );

    const mixed: ComplexityCalibrationSample = {
      ...samples[1]!,
      profile: {
        ...samples[1]!.profile,
        searchRelative: { ...samples[1]!.profile.searchRelative, mode: 'exhaustive_k' },
      },
    };
    expect(() => calibrateComplexity([samples[0]!, mixed, ...samples.slice(2)], '2026-08-16')).toThrow(
      /modo/u,
    );
  });
});
