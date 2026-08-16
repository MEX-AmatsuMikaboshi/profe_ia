import { createHash } from 'node:crypto';
import { AuthoringCoreError } from './errors.js';
import type { ComplexityTier } from '@profesor-ia/proof-search';
import type { KcId } from './kc-map.js';

export const AUDIT_SEVERITIES = ['critical', 'major', 'minor'] as const;
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];
export const AUDIT_RISKS = ['low', 'medium', 'high'] as const;
export type AuditRisk = (typeof AUDIT_RISKS)[number];

export const PREAUDIT_PARAMETERS = Object.freeze({
  version: 'cal-audit-pre-v1',
  functionFloorPercent: 20,
  minimumPerExistingFunction: 5,
  minimumPerKc: 1,
  highRiskPolicy: 'include_all' as const,
  majorBlockPercentExclusive: 5,
  minorBlockPercentExclusive: 15,
  majorDefectsPerFamilyBlock: 2,
});

export const AUDIT_CODEBOOK = Object.freeze({
  version: 'audit-codebook-v1',
  critical: Object.freeze([
    'incorrect_solution',
    'item_without_valid_solution',
    'solution_leak',
    'corpus_contradiction',
    'accepts_invalid_answer',
    'reused_or_contaminated_probe',
  ]),
  major: Object.freeze([
    'answer_changing_ambiguity',
    'difficulty_outside_declared_level',
    'hint_practically_solves',
    'incorrect_kc_label',
    'inapplicable_rubric',
  ]),
  minor: Object.freeze([
    'wording_without_interpretation_change',
    'inconsistent_format',
    'recoverable_incomplete_anchor',
    'stylistic_detail',
  ]),
});

export type AuditDefectCode =
  | (typeof AUDIT_CODEBOOK.critical)[number]
  | (typeof AUDIT_CODEBOOK.major)[number]
  | (typeof AUDIT_CODEBOOK.minor)[number];

export interface AuditableArtifact {
  readonly artifactId: string;
  readonly kcId: KcId;
  readonly bankFunction: string;
  readonly complexity: ComplexityTier;
  readonly ruleType: string;
  readonly origin: string;
  readonly hasSubproof: boolean;
  readonly risk: AuditRisk;
  readonly consequence: string;
  readonly itemFamilyId: string;
}

export interface AuditStratumRecord {
  readonly stratumKey: string;
  readonly N_h: number;
  readonly n_h: number;
  readonly fraction: number;
  readonly method: 'seeded_sha256_with_floor_augmentation';
  readonly seed: string;
  readonly inclusionProbability: null;
  readonly familyIds: readonly string[];
  readonly origins: readonly string[];
  readonly defectsBySeverity: Readonly<Record<AuditSeverity, number>>;
}

export interface PreAuditSample {
  readonly calibrationVersion: 'cal-audit-pre-v1';
  readonly codebookVersion: 'audit-codebook-v1';
  readonly seed: string;
  readonly populationSize: number;
  readonly selectedArtifactIds: readonly string[];
  readonly strata: readonly AuditStratumRecord[];
}

export class PreAuditError extends AuthoringCoreError {}

function stratumKey(item: AuditableArtifact): string {
  return [
    item.kcId,
    item.bankFunction,
    item.complexity,
    item.ruleType,
    item.origin,
    item.hasSubproof ? 'subproof' : 'no-subproof',
    item.risk,
  ].join('|');
}

function seededRank(seed: string, item: AuditableArtifact): string {
  return createHash('sha256').update(`${seed}\0${stratumKey(item)}\0${item.artifactId}`).digest('hex');
}

function chooseUntil(
  candidates: readonly AuditableArtifact[],
  selected: Set<string>,
  target: number,
  seed: string,
): void {
  const current = candidates.filter((item) => selected.has(item.artifactId)).length;
  const needed = Math.max(0, target - current);
  const remaining = candidates
    .filter((item) => !selected.has(item.artifactId))
    .sort((a, b) => seededRank(seed, a).localeCompare(seededRank(seed, b)));
  for (const item of remaining.slice(0, needed)) selected.add(item.artifactId);
}

export function generatePreAuditSample(
  population: readonly AuditableArtifact[],
  seed: string,
): PreAuditSample {
  if (population.length === 0) throw new PreAuditError('La población de auditoría está vacía.');
  if (seed.trim() === '') throw new PreAuditError('La muestra exige una semilla registrada.');
  const ids = population.map((item) => item.artifactId);
  if (new Set(ids).size !== ids.length) throw new PreAuditError('Hay artifactId repetidos en la población.');
  for (const item of population) {
    if (
      item.bankFunction.trim() === '' ||
      item.ruleType.trim() === '' ||
      item.origin.trim() === '' ||
      item.consequence.trim() === '' ||
      item.itemFamilyId.trim() === ''
    ) {
      throw new PreAuditError(`${item.artifactId} no declara todas las dimensiones del estrato.`);
    }
  }

  const selected = new Set<string>();
  const strata = new Map<string, AuditableArtifact[]>();
  for (const item of population) {
    const key = stratumKey(item);
    strata.set(key, [...(strata.get(key) ?? []), item]);
    if (item.risk === 'high') selected.add(item.artifactId);
  }
  // Cada estrato observado queda representado antes de aumentar otros pisos.
  for (const items of strata.values()) chooseUntil(items, selected, 1, seed);

  const functions = new Map<string, AuditableArtifact[]>();
  const kcs = new Map<KcId, AuditableArtifact[]>();
  for (const item of population) {
    functions.set(item.bankFunction, [...(functions.get(item.bankFunction) ?? []), item]);
    kcs.set(item.kcId, [...(kcs.get(item.kcId) ?? []), item]);
  }
  for (const items of functions.values()) {
    const target = Math.min(
      items.length,
      Math.max(
        Math.ceil((items.length * PREAUDIT_PARAMETERS.functionFloorPercent) / 100),
        PREAUDIT_PARAMETERS.minimumPerExistingFunction,
      ),
    );
    chooseUntil(items, selected, target, seed);
  }
  for (const items of kcs.values()) chooseUntil(items, selected, PREAUDIT_PARAMETERS.minimumPerKc, seed);

  const selectedArtifactIds = population
    .filter((item) => selected.has(item.artifactId))
    .sort((a, b) => seededRank(seed, a).localeCompare(seededRank(seed, b)))
    .map((item) => item.artifactId);
  const stratumRecords = [...strata.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => {
      const n = items.filter((item) => selected.has(item.artifactId)).length;
      return Object.freeze({
        stratumKey: key,
        N_h: items.length,
        n_h: n,
        fraction: Number((n / items.length).toFixed(6)),
        method: 'seeded_sha256_with_floor_augmentation' as const,
        seed,
        // La superposición de pisos altera probabilidades por artefacto; se
        // declara no calculable en vez de fingir n/N como diseño uniforme.
        inclusionProbability: null,
        familyIds: Object.freeze([...new Set(items.map((item) => item.itemFamilyId))].sort()),
        origins: Object.freeze([...new Set(items.map((item) => item.origin))].sort()),
        defectsBySeverity: Object.freeze({ critical: 0, major: 0, minor: 0 }),
      });
    });
  return Object.freeze({
    calibrationVersion: 'cal-audit-pre-v1',
    codebookVersion: 'audit-codebook-v1',
    seed,
    populationSize: population.length,
    selectedArtifactIds: Object.freeze(selectedArtifactIds),
    strata: Object.freeze(stratumRecords),
  });
}

export interface AuditDefectJudgment {
  readonly artifactId: string;
  readonly itemFamilyId: string;
  readonly severity: AuditSeverity;
  readonly code: AuditDefectCode;
  readonly canChangeAnswerOrVerdict: boolean;
  readonly canContaminateMeasureLeakOrTeachFalseRule: boolean;
  readonly scope: 'local' | 'common_cause';
  readonly rationale: string;
}

export interface AuditGateReport {
  readonly blocked: boolean;
  readonly sampleSize: number;
  readonly critical: Readonly<{ count: number; denominator: number }>;
  readonly major: Readonly<{ count: number; denominator: number; percent: number }>;
  readonly minor: Readonly<{ count: number; denominator: number; percent: number }>;
  readonly familiesWithAtLeastTwoMajor: readonly string[];
  readonly uncoveredStrata: readonly string[];
  readonly reasons: readonly string[];
  readonly affectedFamilies: readonly string[];
  readonly strata: readonly AuditStratumRecord[];
}

function codeSeverity(code: AuditDefectCode): AuditSeverity {
  if ((AUDIT_CODEBOOK.critical as readonly string[]).includes(code)) return 'critical';
  if ((AUDIT_CODEBOOK.major as readonly string[]).includes(code)) return 'major';
  return 'minor';
}

export function evaluatePreAudit(
  sample: PreAuditSample,
  population: readonly AuditableArtifact[],
  reviewedArtifactIds: readonly string[],
  judgments: readonly AuditDefectJudgment[],
): AuditGateReport {
  const selected = new Set(sample.selectedArtifactIds);
  if (
    new Set(reviewedArtifactIds).size !== reviewedArtifactIds.length ||
    reviewedArtifactIds.length !== selected.size ||
    reviewedArtifactIds.some((id) => !selected.has(id))
  ) {
    throw new PreAuditError(
      'La revisión no cubre exactamente la muestra congelada; un artefacto sin juicio no cuenta como limpio.',
    );
  }
  const populationById = new Map(population.map((item) => [item.artifactId, item]));
  for (const judgment of judgments) {
    const artifact = populationById.get(judgment.artifactId);
    if (!selected.has(judgment.artifactId) || artifact === undefined) {
      throw new PreAuditError(`${judgment.artifactId} no pertenece a la muestra congelada.`);
    }
    if (artifact.itemFamilyId !== judgment.itemFamilyId) {
      throw new PreAuditError(`${judgment.artifactId} fue reasignado de familia durante la auditoría.`);
    }
    if (codeSeverity(judgment.code) !== judgment.severity) {
      throw new PreAuditError(`${judgment.code} no pertenece a severidad ${judgment.severity}.`);
    }
    if (judgment.rationale.trim() === '') throw new PreAuditError(`${judgment.artifactId} no fundamenta severidad.`);
    const hasMaterialConsequence =
      judgment.canChangeAnswerOrVerdict || judgment.canContaminateMeasureLeakOrTeachFalseRule;
    if ((judgment.severity === 'critical' || judgment.severity === 'major') && !hasMaterialConsequence) {
      throw new PreAuditError(`${judgment.artifactId} clasifica ${judgment.severity} sin consecuencia material.`);
    }
    if (judgment.severity === 'minor' && (hasMaterialConsequence || judgment.scope !== 'local')) {
      throw new PreAuditError(`${judgment.artifactId} no puede ser menor con consecuencia material o causa común.`);
    }
  }
  const sampleSize = sample.selectedArtifactIds.length;
  const criticalCount = judgments.filter((j) => j.severity === 'critical').length;
  const majorCount = judgments.filter((j) => j.severity === 'major').length;
  const minorCount = judgments.filter((j) => j.severity === 'minor').length;
  const majorPercent = Number(((majorCount / sampleSize) * 100).toFixed(6));
  const minorPercent = Number(((minorCount / sampleSize) * 100).toFixed(6));
  const majorByFamily = new Map<string, number>();
  for (const judgment of judgments.filter((j) => j.severity === 'major')) {
    majorByFamily.set(judgment.itemFamilyId, (majorByFamily.get(judgment.itemFamilyId) ?? 0) + 1);
  }
  const familiesWithAtLeastTwoMajor = [...majorByFamily]
    .filter(([, count]) => count >= PREAUDIT_PARAMETERS.majorDefectsPerFamilyBlock)
    .map(([family]) => family)
    .sort();
  const uncoveredStrata = sample.strata.filter((stratum) => stratum.n_h < 1).map((s) => s.stratumKey);
  const auditedStrata = sample.strata.map((stratum) => {
    const counts = { critical: 0, major: 0, minor: 0 };
    for (const judgment of judgments) {
      const artifact = populationById.get(judgment.artifactId);
      if (artifact !== undefined && stratumKey(artifact) === stratum.stratumKey) counts[judgment.severity] += 1;
    }
    return Object.freeze({ ...stratum, defectsBySeverity: Object.freeze(counts) });
  });
  const reasons: string[] = [];
  if (criticalCount >= 1) reasons.push('critical_defect');
  if (majorPercent > PREAUDIT_PARAMETERS.majorBlockPercentExclusive) reasons.push('major_rate_above_5_percent');
  if (minorPercent > PREAUDIT_PARAMETERS.minorBlockPercentExclusive) reasons.push('minor_rate_above_15_percent');
  if (familiesWithAtLeastTwoMajor.length > 0) reasons.push('family_with_two_major_defects');
  if (uncoveredStrata.length > 0) reasons.push('uncovered_stratum');
  return Object.freeze({
    blocked: reasons.length > 0,
    sampleSize,
    critical: Object.freeze({ count: criticalCount, denominator: sampleSize }),
    major: Object.freeze({ count: majorCount, denominator: sampleSize, percent: majorPercent }),
    minor: Object.freeze({ count: minorCount, denominator: sampleSize, percent: minorPercent }),
    familiesWithAtLeastTwoMajor: Object.freeze(familiesWithAtLeastTwoMajor),
    uncoveredStrata: Object.freeze(uncoveredStrata),
    reasons: Object.freeze(reasons),
    affectedFamilies: Object.freeze([...new Set(judgments.map((j) => j.itemFamilyId))].sort()),
    strata: Object.freeze(auditedStrata),
  });
}

export interface FamilyRegenerationAction {
  readonly itemFamilyId: string;
  readonly initialJudgmentIds: readonly string[];
  readonly rootCause: string;
  readonly action: 'regenerate_entire_family';
  readonly replacementSampleSeed: string;
  readonly regressionIds: readonly string[];
}

export function assertBlockedAuditRemediation(
  report: AuditGateReport,
  actions: readonly FamilyRegenerationAction[],
): void {
  if (!report.blocked) return;
  const actionByFamily = new Map(actions.map((action) => [action.itemFamilyId, action]));
  for (const family of report.affectedFamilies) {
    const action = actionByFamily.get(family);
    if (
      action === undefined ||
      action.action !== 'regenerate_entire_family' ||
      action.initialJudgmentIds.length === 0 ||
      action.rootCause.trim() === '' ||
      action.replacementSampleSeed.trim() === '' ||
      action.regressionIds.length === 0
    ) {
      throw new PreAuditError(
        `${family} no conserva juicio, causa raíz, regeneración completa, muestra nueva y regresión.`,
      );
    }
  }
}
