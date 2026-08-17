import { describe, expect, it } from 'vitest';

import {
  GroundednessCalibrationError,
  NliCalibrationPendingError,
  analyzeGroundednessCalibration,
  classifyNliStratumEvidence,
  groundednessSampleManifestSha256,
  nliGate,
  nliSignal,
  requireDemonstratedNliStratum,
  sha256Hex,
  type NliCalibrationObservation,
  type NliCalibrationProtocol,
  type NliReliabilityCriteria,
  type NliStratum,
} from '../src/index.js';

const MODEL_BINDING = 'nli-unit-fixture-v1';

const DECLARATIVE: NliStratum = {
  stratumId: 'fixture-declarative-kc01',
  sourceLanguage: 'en',
  targetLanguage: 'es',
  logicalForm: 'definicion_declarativa',
  kcId: 'KC01',
  claimType: 'source_assertion',
};

const NEGATION: NliStratum = {
  stratumId: 'fixture-negation-kc10',
  sourceLanguage: 'en',
  targetLanguage: 'es',
  logicalForm: 'negacion',
  kcId: 'KC10',
  claimType: 'source_assertion',
};

const CRITERIA: NliReliabilityCriteria = {
  version: 'criteria-unit-fixture-v1',
  minimumTotalPerStratum: 4,
  minimumGoldPositivePerStratum: 2,
  minimumGoldNegativePerStratum: 2,
  maximumFalsePositiveRate: 0,
  maximumFalseNegativeRate: 0,
};

function protocol(overrides: Partial<NliCalibrationProtocol> = {}): NliCalibrationProtocol {
  return {
    calibrationId: 'CAL-06/CAL-NLI',
    protocolVersion: 'protocol-unit-fixture-v1',
    evidenceMode: 'test_fixture',
    preregistrationSha256: null,
    sampleManifestSha256: null,
    modelBinding: MODEL_BINDING,
    aisCodebookVersion: 'ais-codebook-unit-fixture-v1',
    decisionThreshold: 0.5,
    thresholdComparison: 'greater_than_or_equal',
    strata: [DECLARATIVE, NEGATION],
    criteria: CRITERIA,
    ...overrides,
  };
}

function observation(
  id: string,
  stratum: NliStratum,
  score: number,
  label: 'attributable' | 'not_attributable',
  overrides: Partial<NliCalibrationObservation> = {},
): NliCalibrationObservation {
  const fragmentText = `fragment fixture ${id}`;
  return {
    observationId: id,
    claimId: `claim-${id}`,
    fragmentId: `fragment-${id}`,
    fragmentSha256: sha256Hex(fragmentText),
    claimText: `claim fixture ${id}`,
    fragmentText,
    stratum,
    modelBinding: MODEL_BINDING,
    supportScore: score,
    gold: {
      judgmentId: `judgment-${id}`,
      label,
      reasonCode:
        label === 'attributable'
          ? 'supported_by_identified_fragment'
          : 'not_supported_by_identified_fragment',
      codebookVersion: 'ais-codebook-unit-fixture-v1',
      adjudicatorRole: 'EXPERIMENT_AUDITOR',
      evidenceSha256: null,
    },
    ...overrides,
  };
}

describe('T-H5-17: arnés CAL-06/CAL-NLI sin evidencia fabricada', () => {
  it('falla cerrado cuando la muestra AIS está vacía', () => {
    expect(() => analyzeGroundednessCalibration(protocol(), [])).toThrow(
      NliCalibrationPendingError,
    );
    expect(() => analyzeGroundednessCalibration(protocol(), [])).toThrow(/no se fabrican/u);
  });

  it('calcula TP/FP/TN/FN por estrato y conserva x/n', () => {
    const report = analyzeGroundednessCalibration(protocol(), [
      observation('d-tp', DECLARATIVE, 0.8, 'attributable'),
      observation('d-fp', DECLARATIVE, 0.8, 'not_attributable'),
      observation('d-tn', DECLARATIVE, 0.2, 'not_attributable'),
      observation('d-fn', DECLARATIVE, 0.2, 'attributable'),
      observation('n-tp', NEGATION, 0.8, 'attributable'),
      observation('n-tn', NEGATION, 0.2, 'not_attributable'),
    ]);

    expect(report.strata[0]?.matrix).toEqual({
      truePositive: 1,
      falsePositive: 1,
      trueNegative: 1,
      falseNegative: 1,
    });
    expect(report.strata[0]?.falsePositive).toEqual({ numerator: 1, denominator: 2, rate: 0.5 });
    expect(report.strata[0]?.falseNegative).toEqual({ numerator: 1, denominator: 2, rate: 0.5 });
    expect(report.strata[1]?.stratum.logicalForm).toBe('negacion');
    expect(report.strata[1]?.stratum.kcId).toBe('KC10');
  });

  it('el agregado es descriptivo y nunca autoriza un gate', () => {
    const report = analyzeGroundednessCalibration(protocol(), [
      observation('d-1', DECLARATIVE, 0.8, 'attributable'),
      observation('d-2', DECLARATIVE, 0.2, 'not_attributable'),
    ]);

    expect(report.aggregate.sampleSize).toBe(2);
    expect(report.aggregate.authorizesGate).toBe(false);
    expect(report.aggregate).not.toHaveProperty('passed');
  });

  it('un fixture nunca demuestra fiabilidad aunque sus conteos sean perfectos', () => {
    expect(
      classifyNliStratumEvidence(
        { truePositive: 2, falsePositive: 0, trueNegative: 2, falseNegative: 0 },
        CRITERIA,
        'test_fixture',
      ),
    ).toBe('fixture_only');
  });

  it('la clasificación matemática exige muestra, ambas clases y límites preinscritos', () => {
    expect(
      classifyNliStratumEvidence(
        { truePositive: 2, falsePositive: 0, trueNegative: 2, falseNegative: 0 },
        CRITERIA,
        'material',
      ),
    ).toBe('demonstrated');
    expect(
      classifyNliStratumEvidence(
        { truePositive: 2, falsePositive: 1, trueNegative: 1, falseNegative: 0 },
        CRITERIA,
        'material',
      ),
    ).toBe('error_limits_exceeded');
    expect(
      classifyNliStratumEvidence(
        { truePositive: 0, falsePositive: 0, trueNegative: 4, falseNegative: 0 },
        CRITERIA,
        'material',
      ),
    ).toBe('insufficient_positive_class');
  });

  it('rechaza estratos no preinscritos o alterados después de medir', () => {
    expect(() =>
      analyzeGroundednessCalibration(protocol(), [
        observation('unknown', { ...DECLARATIVE, kcId: 'KC99' }, 0.8, 'attributable'),
      ]),
    ).toThrow(/no preinscrito o alterado/u);
  });

  it('rechaza tipos que AIS excluye del denominador de atribución', () => {
    expect(() =>
      analyzeGroundednessCalibration(
        protocol({
          strata: [{ ...DECLARATIVE, claimType: 'system_inference' } as unknown as NliStratum],
        }),
        [observation('system', DECLARATIVE, 0.8, 'attributable')],
      ),
    ).toThrow(/source_assertion/u);
  });

  it('rechaza duplicados que inflarían los denominadores', () => {
    const first = observation('dup-a', DECLARATIVE, 0.8, 'attributable');
    const second = observation('dup-b', DECLARATIVE, 0.2, 'not_attributable', {
      claimId: first.claimId,
      fragmentId: first.fragmentId,
    });
    expect(() => analyzeGroundednessCalibration(protocol(), [first, second])).toThrow(/duplicado/u);
  });

  it('rechaza texto de fragmento que no reproduce el hash de W1', () => {
    const valid = observation('drift', DECLARATIVE, 0.8, 'attributable');
    expect(() =>
      analyzeGroundednessCalibration(protocol(), [
        { ...valid, fragmentText: `${valid.fragmentText} alterado` },
      ]),
    ).toThrow(/no reproduce/u);
  });

  it('el manifiesto de muestra es determinista y sensible al contenido', () => {
    const first = observation('hash-a', DECLARATIVE, 0.8, 'attributable');
    const second = observation('hash-b', NEGATION, 0.2, 'not_attributable');
    expect(groundednessSampleManifestSha256([first, second])).toBe(
      groundednessSampleManifestSha256([second, first]),
    );
    expect(
      groundednessSampleManifestSha256([
        first,
        { ...second, fragmentText: `${second.fragmentText} cambiado` },
      ]),
    ).not.toBe(groundednessSampleManifestSha256([first, second]));
  });

  it('un protocolo material exige hashes y juicios materiales reales', () => {
    expect(() =>
      analyzeGroundednessCalibration(
        protocol({ evidenceMode: 'material' }),
        [observation('material-falso', DECLARATIVE, 0.8, 'attributable')],
      ),
    ).toThrow(GroundednessCalibrationError);
  });

  it('ni el reporte fixture ni un score alto habilitan nliGate', () => {
    const report = analyzeGroundednessCalibration(protocol(), [
      observation('gate-fixture', DECLARATIVE, 1, 'attributable'),
    ]);
    const signal = nliSignal(1, DECLARATIVE, MODEL_BINDING);

    expect(() => requireDemonstratedNliStratum(report, signal)).toThrow(
      NliCalibrationPendingError,
    );
    expect(() => nliGate(signal, report)).toThrow(NliCalibrationPendingError);
  });
});
