import { createHash } from 'node:crypto';

import {
  GroundednessCalibrationError,
  NliCalibrationPendingError,
} from './errors.js';

/**
 * CAL-06 / CAL-NLI — arnés de calibración de groundedness (T-H5-17).
 *
 * No contiene corpus, juicios humanos, umbrales ni bindings de modelo. Esos
 * datos entran mediante una preinscripción material. Los datos marcados como
 * `test_fixture` sirven para probar la aritmética, pero por construcción nunca
 * pueden demostrar un estrato ni habilitar el gate.
 */

const SHA256 = /^[a-f0-9]{64}$/u;

/** Ejemplos literales de P-I §7.11; el plan puede declarar otros antes de medir. */
export const AIS_LOGICAL_FORM_EXAMPLES = [
  'definicion_declarativa',
  'condicional',
  'negacion',
  'cuantificacion',
  'convencion_notacional',
] as const;

/** Estrato CAL-NLI completo: idioma, forma lógica, KC y tipo atribuible. */
export interface NliStratum {
  readonly stratumId: string;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly logicalForm: string;
  readonly kcId: string;
  readonly claimType: 'source_assertion';
}

/** Señal versionada del clasificador; nunca es por sí misma un veredicto. */
export interface NliSignal {
  readonly supportScore: number;
  readonly stratum: NliStratum;
  readonly modelBinding: string;
  readonly isVerdict: false;
}

export type CalibrationEvidenceMode = 'material' | 'test_fixture';

export interface NliReliabilityCriteria {
  readonly version: string;
  readonly minimumTotalPerStratum: number;
  readonly minimumGoldPositivePerStratum: number;
  readonly minimumGoldNegativePerStratum: number;
  readonly maximumFalsePositiveRate: number;
  readonly maximumFalseNegativeRate: number;
}

export interface NliCalibrationProtocol {
  readonly calibrationId: 'CAL-06/CAL-NLI';
  readonly protocolVersion: string;
  readonly evidenceMode: CalibrationEvidenceMode;
  /** Hash de la preinscripción, nulo únicamente en fixtures de prueba. */
  readonly preregistrationSha256: string | null;
  /** Hash del inventario de pares claim↔fragmento, nulo solo en fixtures. */
  readonly sampleManifestSha256: string | null;
  readonly modelBinding: string;
  readonly aisCodebookVersion: string;
  readonly decisionThreshold: number;
  readonly thresholdComparison: 'greater_than_or_equal';
  /** Estratos declarados antes de observar resultados. */
  readonly strata: readonly NliStratum[];
  /** Criterios aportados por la preinscripción; este módulo no fija sus cifras. */
  readonly criteria: NliReliabilityCriteria;
}

export type AisGoldLabel = 'attributable' | 'not_attributable';
export type AisJudgmentReason =
  | 'supported_by_identified_fragment'
  | 'not_supported_by_identified_fragment'
  | 'external_knowledge_required';

export interface AisGoldJudgment {
  readonly judgmentId: string;
  readonly label: AisGoldLabel;
  readonly reasonCode: AisJudgmentReason;
  readonly codebookVersion: string;
  readonly adjudicatorRole: 'EXPERIMENT_AUDITOR';
  /** Evidencia externa del juicio; nula únicamente en fixtures inhabilitantes. */
  readonly evidenceSha256: string | null;
}

export interface NliCalibrationObservation {
  readonly observationId: string;
  readonly claimId: string;
  readonly fragmentId: string;
  readonly fragmentSha256: string;
  /** Necesarios para que el juicio AIS sea auditable; no se copian al reporte. */
  readonly claimText: string;
  readonly fragmentText: string;
  readonly stratum: NliStratum;
  readonly modelBinding: string;
  readonly supportScore: number;
  readonly gold: AisGoldJudgment;
}

export interface ConfusionMatrix {
  readonly truePositive: number;
  readonly falsePositive: number;
  readonly trueNegative: number;
  readonly falseNegative: number;
}

export interface ErrorFraction {
  readonly numerator: number;
  readonly denominator: number;
  readonly rate: number | null;
}

export type NliStratumEvidenceStatus =
  | 'fixture_only'
  | 'insufficient_sample'
  | 'insufficient_positive_class'
  | 'insufficient_negative_class'
  | 'error_limits_exceeded'
  | 'demonstrated';

export interface NliStratumMetrics {
  readonly stratum: NliStratum;
  readonly sampleSize: number;
  readonly goldPositiveCount: number;
  readonly goldNegativeCount: number;
  readonly matrix: ConfusionMatrix;
  readonly falsePositive: ErrorFraction;
  readonly falseNegative: ErrorFraction;
  readonly precision: ErrorFraction;
  readonly recall: ErrorFraction;
  readonly evidenceStatus: NliStratumEvidenceStatus;
}

export interface GroundednessCalibrationReport {
  readonly calibrationId: 'CAL-06/CAL-NLI';
  readonly protocolVersion: string;
  readonly evidenceMode: CalibrationEvidenceMode;
  readonly preregistrationSha256: string | null;
  readonly sampleManifestSha256: string | null;
  readonly modelBinding: string;
  readonly aisCodebookVersion: string;
  readonly decisionThreshold: number;
  readonly thresholdComparison: 'greater_than_or_equal';
  readonly criteria: NliReliabilityCriteria;
  readonly strata: readonly NliStratumMetrics[];
  readonly aggregate: {
    readonly sampleSize: number;
    readonly matrix: ConfusionMatrix;
    /** Un agregado descriptivo nunca habilita un estrato. */
    readonly authorizesGate: false;
  };
}

function nonEmpty(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new GroundednessCalibrationError(`${field} es obligatorio y no puede estar vacío.`);
  }
}

function validRate(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new GroundednessCalibrationError(`${field} debe estar en [0,1].`);
  }
}

function positiveInteger(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new GroundednessCalibrationError(`${field} debe ser entero positivo.`);
  }
}

function assertSha(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !SHA256.test(value)) {
    throw new GroundednessCalibrationError(`${field} debe ser SHA-256 hexadecimal.`);
  }
}

function sha256Text(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function stratumKey(stratum: NliStratum): string {
  return [
    stratum.stratumId,
    stratum.sourceLanguage,
    stratum.targetLanguage,
    stratum.logicalForm,
    stratum.kcId,
    stratum.claimType,
  ].join('\u001f');
}

function semanticStratumKey(stratum: NliStratum): string {
  return [
    stratum.sourceLanguage,
    stratum.targetLanguage,
    stratum.logicalForm,
    stratum.kcId,
    stratum.claimType,
  ].join('\u001f');
}

function assertStratum(stratum: NliStratum, field: string): void {
  nonEmpty(stratum.stratumId, `${field}.stratumId`);
  nonEmpty(stratum.sourceLanguage, `${field}.sourceLanguage`);
  nonEmpty(stratum.targetLanguage, `${field}.targetLanguage`);
  nonEmpty(stratum.logicalForm, `${field}.logicalForm`);
  nonEmpty(stratum.kcId, `${field}.kcId`);
  if (stratum.claimType !== 'source_assertion') {
    throw new GroundednessCalibrationError(
      `${field}.claimType debe ser source_assertion: AIS no cuenta system_inference como fallo de atribución.`,
    );
  }
}

function assertProtocol(protocol: NliCalibrationProtocol): void {
  if (protocol.calibrationId !== 'CAL-06/CAL-NLI') {
    throw new GroundednessCalibrationError('calibrationId debe ser CAL-06/CAL-NLI.');
  }
  nonEmpty(protocol.protocolVersion, 'protocolVersion');
  nonEmpty(protocol.modelBinding, 'modelBinding');
  nonEmpty(protocol.aisCodebookVersion, 'aisCodebookVersion');
  validRate(protocol.decisionThreshold, 'decisionThreshold');
  if (protocol.thresholdComparison !== 'greater_than_or_equal') {
    throw new GroundednessCalibrationError('thresholdComparison no pertenece al protocolo soportado.');
  }
  if (protocol.evidenceMode !== 'material' && protocol.evidenceMode !== 'test_fixture') {
    throw new GroundednessCalibrationError('evidenceMode inválido.');
  }
  if (protocol.evidenceMode === 'material') {
    assertSha(protocol.preregistrationSha256, 'preregistrationSha256');
    assertSha(protocol.sampleManifestSha256, 'sampleManifestSha256');
  } else if (protocol.preregistrationSha256 !== null || protocol.sampleManifestSha256 !== null) {
    throw new GroundednessCalibrationError(
      'Un test_fixture no puede portar hashes que parezcan evidencia material.',
    );
  }
  if (protocol.strata.length === 0) {
    throw new GroundednessCalibrationError('La preinscripción debe declarar al menos un estrato.');
  }
  const ids = new Set<string>();
  const keys = new Set<string>();
  for (const [index, stratum] of protocol.strata.entries()) {
    assertStratum(stratum, `strata[${index}]`);
    if (ids.has(stratum.stratumId)) {
      throw new GroundednessCalibrationError(`stratumId repetido: ${stratum.stratumId}.`);
    }
    ids.add(stratum.stratumId);
    const key = semanticStratumKey(stratum);
    if (keys.has(key)) {
      throw new GroundednessCalibrationError(`Estrato semántico repetido: ${stratum.stratumId}.`);
    }
    keys.add(key);
  }
  assertCriteria(protocol.criteria);
}

function assertCriteria(criteria: NliReliabilityCriteria): void {
  nonEmpty(criteria.version, 'criteria.version');
  positiveInteger(criteria.minimumTotalPerStratum, 'minimumTotalPerStratum');
  positiveInteger(criteria.minimumGoldPositivePerStratum, 'minimumGoldPositivePerStratum');
  positiveInteger(criteria.minimumGoldNegativePerStratum, 'minimumGoldNegativePerStratum');
  validRate(criteria.maximumFalsePositiveRate, 'maximumFalsePositiveRate');
  validRate(criteria.maximumFalseNegativeRate, 'maximumFalseNegativeRate');
}

function assertMatrix(matrix: ConfusionMatrix): void {
  for (const [field, value] of Object.entries(matrix)) {
    if (!Number.isInteger(value) || value < 0) {
      throw new GroundednessCalibrationError(`${field} debe ser un conteo entero no negativo.`);
    }
  }
}

function fraction(numerator: number, denominator: number): ErrorFraction {
  return Object.freeze({
    numerator,
    denominator,
    rate: denominator === 0 ? null : numerator / denominator,
  });
}

function total(matrix: ConfusionMatrix): number {
  return matrix.truePositive + matrix.falsePositive + matrix.trueNegative + matrix.falseNegative;
}

export function classifyNliStratumEvidence(
  matrix: ConfusionMatrix,
  criteria: NliReliabilityCriteria,
  evidenceMode: CalibrationEvidenceMode,
): NliStratumEvidenceStatus {
  assertMatrix(matrix);
  assertCriteria(criteria);
  if (evidenceMode !== 'material' && evidenceMode !== 'test_fixture') {
    throw new GroundednessCalibrationError('evidenceMode inválido.');
  }
  if (evidenceMode === 'test_fixture') return 'fixture_only';
  const positives = matrix.truePositive + matrix.falseNegative;
  const negatives = matrix.trueNegative + matrix.falsePositive;
  if (total(matrix) < criteria.minimumTotalPerStratum) return 'insufficient_sample';
  if (positives < criteria.minimumGoldPositivePerStratum) return 'insufficient_positive_class';
  if (negatives < criteria.minimumGoldNegativePerStratum) return 'insufficient_negative_class';
  const falsePositiveRate = matrix.falsePositive / negatives;
  const falseNegativeRate = matrix.falseNegative / positives;
  if (
    falsePositiveRate > criteria.maximumFalsePositiveRate ||
    falseNegativeRate > criteria.maximumFalseNegativeRate
  ) {
    return 'error_limits_exceeded';
  }
  return 'demonstrated';
}

function addMatrix(left: ConfusionMatrix, right: ConfusionMatrix): ConfusionMatrix {
  return {
    truePositive: left.truePositive + right.truePositive,
    falsePositive: left.falsePositive + right.falsePositive,
    trueNegative: left.trueNegative + right.trueNegative,
    falseNegative: left.falseNegative + right.falseNegative,
  };
}

function metricsFor(
  stratum: NliStratum,
  observations: readonly NliCalibrationObservation[],
  protocol: NliCalibrationProtocol,
): NliStratumMetrics {
  let matrix: ConfusionMatrix = {
    truePositive: 0,
    falsePositive: 0,
    trueNegative: 0,
    falseNegative: 0,
  };
  for (const observation of observations) {
    const predictedPositive = observation.supportScore >= protocol.decisionThreshold;
    const goldPositive = observation.gold.label === 'attributable';
    if (predictedPositive && goldPositive) matrix = addMatrix(matrix, { truePositive: 1, falsePositive: 0, trueNegative: 0, falseNegative: 0 });
    else if (predictedPositive) matrix = addMatrix(matrix, { truePositive: 0, falsePositive: 1, trueNegative: 0, falseNegative: 0 });
    else if (goldPositive) matrix = addMatrix(matrix, { truePositive: 0, falsePositive: 0, trueNegative: 0, falseNegative: 1 });
    else matrix = addMatrix(matrix, { truePositive: 0, falsePositive: 0, trueNegative: 1, falseNegative: 0 });
  }
  const positives = matrix.truePositive + matrix.falseNegative;
  const negatives = matrix.trueNegative + matrix.falsePositive;
  return Object.freeze({
    stratum: Object.freeze({ ...stratum }),
    sampleSize: total(matrix),
    goldPositiveCount: positives,
    goldNegativeCount: negatives,
    matrix: Object.freeze(matrix),
    falsePositive: fraction(matrix.falsePositive, negatives),
    falseNegative: fraction(matrix.falseNegative, positives),
    precision: fraction(matrix.truePositive, matrix.truePositive + matrix.falsePositive),
    recall: fraction(matrix.truePositive, positives),
    evidenceStatus: classifyNliStratumEvidence(matrix, protocol.criteria, protocol.evidenceMode),
  });
}

function assertObservation(
  observation: NliCalibrationObservation,
  protocol: NliCalibrationProtocol,
  registered: ReadonlyMap<string, NliStratum>,
): void {
  for (const [field, value] of [
    ['observationId', observation.observationId],
    ['claimId', observation.claimId],
    ['fragmentId', observation.fragmentId],
    ['claimText', observation.claimText],
    ['fragmentText', observation.fragmentText],
  ] as const) nonEmpty(value, field);
  assertSha(observation.fragmentSha256, 'fragmentSha256');
  if (sha256Text(observation.fragmentText) !== observation.fragmentSha256) {
    throw new GroundednessCalibrationError(
      `El fragmento ${observation.fragmentId} no reproduce su fragmentSha256.`,
    );
  }
  assertStratum(observation.stratum, `observation ${observation.observationId}.stratum`);
  const expected = registered.get(observation.stratum.stratumId);
  if (expected === undefined || stratumKey(expected) !== stratumKey(observation.stratum)) {
    throw new GroundednessCalibrationError(
      `La observación ${observation.observationId} pertenece a un estrato no preinscrito o alterado.`,
    );
  }
  if (observation.modelBinding !== protocol.modelBinding) {
    throw new GroundednessCalibrationError(
      `La observación ${observation.observationId} usa otro modelBinding.`,
    );
  }
  validRate(observation.supportScore, 'supportScore');
  nonEmpty(observation.gold.judgmentId, 'gold.judgmentId');
  nonEmpty(observation.gold.codebookVersion, 'gold.codebookVersion');
  if (observation.gold.codebookVersion !== protocol.aisCodebookVersion) {
    throw new GroundednessCalibrationError(
      `El juicio ${observation.gold.judgmentId} usa otro codebook AIS.`,
    );
  }
  if (observation.gold.adjudicatorRole !== 'EXPERIMENT_AUDITOR') {
    throw new GroundednessCalibrationError('El juicio dorado debe venir del EXPERIMENT_AUDITOR.');
  }
  if (
    observation.gold.label !== 'attributable' &&
    observation.gold.label !== 'not_attributable'
  ) {
    throw new GroundednessCalibrationError(`Etiqueta AIS inválida en ${observation.gold.judgmentId}.`);
  }
  if (
    observation.gold.reasonCode !== 'supported_by_identified_fragment' &&
    observation.gold.reasonCode !== 'not_supported_by_identified_fragment' &&
    observation.gold.reasonCode !== 'external_knowledge_required'
  ) {
    throw new GroundednessCalibrationError(
      `reasonCode AIS inválido en ${observation.gold.judgmentId}.`,
    );
  }
  const supported = observation.gold.reasonCode === 'supported_by_identified_fragment';
  if ((observation.gold.label === 'attributable') !== supported) {
    throw new GroundednessCalibrationError(
      `El juicio ${observation.gold.judgmentId} contradice su reasonCode AIS.`,
    );
  }
  if (protocol.evidenceMode === 'material') {
    assertSha(observation.gold.evidenceSha256, 'gold.evidenceSha256');
  } else if (observation.gold.evidenceSha256 !== null) {
    throw new GroundednessCalibrationError(
      'Un juicio test_fixture no puede portar un hash que parezca adjudicación material.',
    );
  }
}

/**
 * Hash reproducible del inventario que se debe preinscribir antes de observar
 * etiquetas o scores. Excluye deliberadamente ambos resultados.
 */
export function groundednessSampleManifestSha256(
  observations: readonly NliCalibrationObservation[],
): string {
  const inventory = observations
    .map((observation) => ({
      observationId: observation.observationId,
      claimId: observation.claimId,
      fragmentId: observation.fragmentId,
      fragmentSha256: observation.fragmentSha256,
      claimText: observation.claimText,
      fragmentText: observation.fragmentText,
      stratum: {
        stratumId: observation.stratum.stratumId,
        sourceLanguage: observation.stratum.sourceLanguage,
        targetLanguage: observation.stratum.targetLanguage,
        logicalForm: observation.stratum.logicalForm,
        kcId: observation.stratum.kcId,
        claimType: observation.stratum.claimType,
      },
    }))
    .sort((left, right) => left.observationId.localeCompare(right.observationId));
  return createHash('sha256').update(JSON.stringify(inventory), 'utf8').digest('hex');
}

export function analyzeGroundednessCalibration(
  protocol: NliCalibrationProtocol,
  observations: readonly NliCalibrationObservation[],
): GroundednessCalibrationReport {
  assertProtocol(protocol);
  if (observations.length === 0) {
    throw new NliCalibrationPendingError(
      'la muestra AIS está vacía; no se fabrican pares claim↔fragmento ni juicios dorados',
      'H5 (T-H5-17), después de W1/W2 y adjudicación externa',
    );
  }
  const registered = new Map(protocol.strata.map((stratum) => [stratum.stratumId, stratum]));
  const observationIds = new Set<string>();
  const claimFragmentPairs = new Set<string>();
  for (const observation of observations) {
    assertObservation(observation, protocol, registered);
    if (observationIds.has(observation.observationId)) {
      throw new GroundednessCalibrationError(`observationId repetido: ${observation.observationId}.`);
    }
    observationIds.add(observation.observationId);
    const pair = `${observation.claimId}\u001f${observation.fragmentId}`;
    if (claimFragmentPairs.has(pair)) {
      throw new GroundednessCalibrationError(
        `El par ${observation.claimId}↔${observation.fragmentId} está duplicado y sesgaría los denominadores.`,
      );
    }
    claimFragmentPairs.add(pair);
  }
  if (
    protocol.evidenceMode === 'material' &&
    groundednessSampleManifestSha256(observations) !== protocol.sampleManifestSha256
  ) {
    throw new GroundednessCalibrationError(
      'sampleManifestSha256 no corresponde al inventario material analizado.',
    );
  }

  const strata = protocol.strata.map((stratum) =>
    metricsFor(
      stratum,
      observations.filter((observation) => observation.stratum.stratumId === stratum.stratumId),
      protocol,
    ),
  );
  const aggregateMatrix = strata.reduce<ConfusionMatrix>(
    (sum, metric) => addMatrix(sum, metric.matrix),
    { truePositive: 0, falsePositive: 0, trueNegative: 0, falseNegative: 0 },
  );
  return Object.freeze({
    calibrationId: 'CAL-06/CAL-NLI',
    protocolVersion: protocol.protocolVersion,
    evidenceMode: protocol.evidenceMode,
    preregistrationSha256: protocol.preregistrationSha256,
    sampleManifestSha256: protocol.sampleManifestSha256,
    modelBinding: protocol.modelBinding,
    aisCodebookVersion: protocol.aisCodebookVersion,
    decisionThreshold: protocol.decisionThreshold,
    thresholdComparison: protocol.thresholdComparison,
    criteria: Object.freeze({ ...protocol.criteria }),
    strata: Object.freeze(strata),
    aggregate: Object.freeze({
      sampleSize: total(aggregateMatrix),
      matrix: Object.freeze(aggregateMatrix),
      authorizesGate: false,
    }),
  });
}

/**
 * Devuelve la evidencia de un estrato solo si es material y demostró los
 * criterios preinscritos. Un fixture, un agregado o un estrato parecido no
 * sirven como autorización.
 */
export function requireDemonstratedNliStratum(
  report: GroundednessCalibrationReport,
  signal: NliSignal,
): NliStratumMetrics {
  if (report.evidenceMode !== 'material') {
    throw new NliCalibrationPendingError(
      'un reporte test_fixture nunca puede habilitar el gate',
      'H5 (CAL-NLI), con muestra y adjudicación materiales',
    );
  }
  assertSha(report.preregistrationSha256, 'preregistrationSha256');
  assertSha(report.sampleManifestSha256, 'sampleManifestSha256');
  if (signal.modelBinding !== report.modelBinding) {
    throw new NliCalibrationPendingError(
      `el binding ${signal.modelBinding} no es el calibrado ${report.modelBinding}`,
      'H5 (CAL-NLI), por binding exacto',
    );
  }
  const key = stratumKey(signal.stratum);
  const metric = report.strata.find((candidate) => stratumKey(candidate.stratum) === key);
  if (metric === undefined || metric.evidenceStatus !== 'demonstrated') {
    throw new NliCalibrationPendingError(
      `el estrato ${signal.stratum.stratumId} no tiene fiabilidad material demostrada`,
      'H5 (CAL-NLI), por forma lógica/KC/idioma/tipo de claim',
    );
  }
  return metric;
}
