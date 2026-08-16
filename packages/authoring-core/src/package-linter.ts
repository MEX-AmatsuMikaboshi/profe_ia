import { masteryDisqualifying, type MasteryHintFacts } from '@profesor-ia/domain-engine';
import { AUTHORIZED_CALCULUS_VERSION } from '@profesor-ia/logic-core';
import { PackageLintError } from './errors.js';
import { assertExperimentalSets, type ExperimentalSet } from './kc-map.js';

export const PACKAGE_LINT_CHECK_IDS = [
  'corpus_integrity',
  'referencable_fragments',
  'authorized_calculus_complete',
  'set_calculus_correspondence',
  'acyclic_or_justified_map',
  'minimum_coverage',
  'separated_banks',
  'solutions_for_scorable_items',
  'sufficient_probes',
  'sufficient_hints',
  'applicable_rubrics',
  'complete_pedagogy',
  'valid_scaffolding_fading',
  'retrieval_spacing_compatible',
  'learning_measurement_separation',
  'no_prohibited_duplicates',
  'approved_golden_tests',
  'registered_sample_audit',
  'complete_versions',
  'authoritative_mastery_flags',
] as const;
export type PackageLintCheckId = (typeof PACKAGE_LINT_CHECK_IDS)[number];

export interface MasteryFlagLintRecord extends MasteryHintFacts {
  readonly itemId: string;
  readonly hintOrdinal: number;
  readonly proposedMasteryDisqualifying: boolean;
}

/**
 * Hechos producidos por los validadores del paquete. Son conteos/IDs y no
 * booleanos `passed`: el linter deriva el resultado para que un manifest no
 * pueda aprobarse escribiendo `true` en veinte campos.
 */
export interface PackageLintFacts {
  readonly packageVersion: string;
  readonly corpus: {
    readonly componentCount: number;
    readonly fragmentCount: number;
    readonly expectedSha256: string;
    readonly actualSha256: string;
  };
  readonly fragmentReferences: { readonly danglingIds: readonly string[] };
  readonly calculus: {
    readonly version: string;
    readonly sha256: string;
    readonly ruleCatalogComplete: boolean;
    readonly aliasCatalogComplete: boolean;
    readonly semanticDecisionPolicyComplete: boolean;
  };
  readonly experimentalSets: readonly ExperimentalSet[];
  readonly map: { readonly unjustifiedCycles: readonly (readonly string[])[] };
  readonly coverage: { readonly gapIds: readonly string[] };
  readonly reserves: { readonly collisionIds: readonly string[] };
  readonly scorableItemIds: readonly string[];
  readonly solutionItemIds: readonly string[];
  readonly probes: { readonly missingBySet: Readonly<Record<string, number>> };
  readonly hints: {
    readonly missingItemIds: readonly string[];
    readonly missingLevelsByItem: Readonly<Record<string, readonly number[]>>;
    readonly masteryFlags: readonly MasteryFlagLintRecord[];
  };
  readonly rubricItemIds: readonly string[];
  readonly pedagogy: {
    readonly missingCatalogEntries: readonly string[];
    readonly missingPolicyIds: readonly string[];
    readonly scaffoldingFadingViolationIds: readonly string[];
  };
  readonly retrievalSpacing: {
    readonly calendarConflictIds: readonly string[];
    readonly measurementReserveConsumptionIds: readonly string[];
  };
  readonly modeSeparationViolationIds: readonly string[];
  readonly prohibitedDuplicatePairIds: readonly string[];
  readonly golden: {
    readonly suiteCount: number;
    readonly failingCaseIds: readonly string[];
    readonly constructedAcceptanceCaseCount: number;
  };
  readonly audit: {
    readonly auditId: string;
    readonly sampleSeed: string;
    readonly strataCount: number;
  };
  readonly versions: Readonly<Record<string, string>>;
  readonly requiredVersionKeys: readonly string[];
}

export interface PackageLintIssue {
  readonly checkId: PackageLintCheckId;
  readonly detail: string;
}

export interface PackageLintReport {
  readonly valid: boolean;
  readonly checksRun: readonly PackageLintCheckId[];
  readonly issues: readonly PackageLintIssue[];
}

const SHA256 = /^[a-f0-9]{64}$/u;
const duplicates = (ids: readonly string[]): readonly string[] =>
  [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];

export function lintContentPackage(facts: PackageLintFacts): PackageLintReport {
  const issues: PackageLintIssue[] = [];
  const fail = (checkId: PackageLintCheckId, detail: string): void => {
    issues.push(Object.freeze({ checkId, detail }));
  };

  if (
    facts.corpus.componentCount < 1 ||
    facts.corpus.fragmentCount < 1 ||
    !SHA256.test(facts.corpus.expectedSha256) ||
    facts.corpus.expectedSha256 !== facts.corpus.actualSha256
  ) {
    fail('corpus_integrity', 'corpus vacío, hash inválido o identidad distinta del snapshot W0');
  }
  if (facts.fragmentReferences.danglingIds.length > 0) {
    fail('referencable_fragments', `referencias colgantes: ${facts.fragmentReferences.danglingIds.join(', ')}`);
  }
  if (
    facts.calculus.version !== AUTHORIZED_CALCULUS_VERSION ||
    !SHA256.test(facts.calculus.sha256) ||
    !facts.calculus.ruleCatalogComplete ||
    !facts.calculus.aliasCatalogComplete ||
    !facts.calculus.semanticDecisionPolicyComplete
  ) {
    fail('authorized_calculus_complete', 'cálculo, hash, reglas, alias o política semántica/de decisión incompletos');
  }
  try {
    assertExperimentalSets(facts.experimentalSets);
    if (
      facts.experimentalSets.length !== 3 ||
      new Set(facts.experimentalSets.map((set) => set.setId)).size !== 3
    ) {
      throw new Error('no aparecen exactamente A, B y C una vez');
    }
  } catch (error) {
    fail('set_calculus_correspondence', error instanceof Error ? error.message : String(error));
  }
  if (facts.map.unjustifiedCycles.length > 0) {
    fail('acyclic_or_justified_map', `${facts.map.unjustifiedCycles.length} ciclo(s) sin justificar`);
  }
  if (facts.coverage.gapIds.length > 0) fail('minimum_coverage', facts.coverage.gapIds.join(', '));
  if (facts.reserves.collisionIds.length > 0) fail('separated_banks', facts.reserves.collisionIds.join(', '));

  const repeatedScorable = duplicates(facts.scorableItemIds);
  const solutionSet = new Set(facts.solutionItemIds);
  const missingSolutions = facts.scorableItemIds.filter((id) => !solutionSet.has(id));
  if (facts.scorableItemIds.length === 0 || repeatedScorable.length > 0 || missingSolutions.length > 0) {
    fail(
      'solutions_for_scorable_items',
      `puntuables=${facts.scorableItemIds.length}; repetidos=${repeatedScorable.join(',')}; sin solución=${missingSolutions.join(',')}`,
    );
  }
  const missingProbes = Object.entries(facts.probes.missingBySet).filter(([, count]) => count > 0);
  const probeSets = Object.keys(facts.probes.missingBySet).sort().join(',');
  if (probeSets !== 'A,B,C' || missingProbes.length > 0) {
    fail('sufficient_probes', `faltantes: ${missingProbes.map(([set, count]) => `${set}:${count}`).join(', ')}`);
  }
  if (
    facts.hints.missingItemIds.length > 0 ||
    Object.values(facts.hints.missingLevelsByItem).some((levels) => levels.length > 0)
  ) {
    fail('sufficient_hints', 'hay reactivos sin pistas o sin niveles requeridos');
  }

  const rubricSet = new Set(facts.rubricItemIds);
  const missingRubrics = facts.scorableItemIds.filter((id) => !rubricSet.has(id));
  if (facts.rubricItemIds.length === 0 || missingRubrics.length > 0) {
    fail('applicable_rubrics', `sin rúbrica: ${missingRubrics.join(', ') || 'ninguna declarada'}`);
  }
  if (
    facts.pedagogy.missingCatalogEntries.length > 0 ||
    facts.pedagogy.missingPolicyIds.length > 0
  ) {
    fail('complete_pedagogy', 'catálogo o política pedagógica incompletos');
  }
  if (facts.pedagogy.scaffoldingFadingViolationIds.length > 0) {
    fail('valid_scaffolding_fading', facts.pedagogy.scaffoldingFadingViolationIds.join(', '));
  }
  if (
    facts.retrievalSpacing.calendarConflictIds.length > 0 ||
    facts.retrievalSpacing.measurementReserveConsumptionIds.length > 0
  ) {
    fail('retrieval_spacing_compatible', 'retrieval/spacing entra en conflicto con calendario o reservas');
  }
  if (facts.modeSeparationViolationIds.length > 0) {
    fail('learning_measurement_separation', facts.modeSeparationViolationIds.join(', '));
  }
  if (facts.prohibitedDuplicatePairIds.length > 0) {
    fail('no_prohibited_duplicates', facts.prohibitedDuplicatePairIds.join(', '));
  }
  if (
    facts.golden.suiteCount < 1 ||
    facts.golden.failingCaseIds.length > 0 ||
    facts.golden.constructedAcceptanceCaseCount < 1
  ) {
    fail('approved_golden_tests', 'golden vacío/fallido o sin aceptación por construcción');
  }
  if (
    facts.audit.auditId.trim() === '' ||
    facts.audit.sampleSeed.trim() === '' ||
    facts.audit.strataCount < 1
  ) {
    fail('registered_sample_audit', 'auditoría, semilla o estratos ausentes');
  }
  const missingVersions = facts.requiredVersionKeys.filter(
    (key) => (facts.versions[key] ?? '').trim() === '',
  );
  if (
    facts.packageVersion.trim() === '' ||
    facts.requiredVersionKeys.length === 0 ||
    missingVersions.length > 0
  ) {
    fail('complete_versions', `versiones ausentes: ${missingVersions.join(', ')}`);
  }

  const flagMismatches = facts.hints.masteryFlags.filter(
    (record) => masteryDisqualifying(record) !== record.proposedMasteryDisqualifying,
  );
  if (facts.hints.masteryFlags.length === 0 || flagMismatches.length > 0) {
    fail(
      'authoritative_mastery_flags',
      `sin registros=${facts.hints.masteryFlags.length === 0}; discrepancias=${flagMismatches
        .map((record) => `${record.itemId}#${record.hintOrdinal}`)
        .join(', ')}`,
    );
  }

  return Object.freeze({
    valid: issues.length === 0,
    checksRun: PACKAGE_LINT_CHECK_IDS,
    issues: Object.freeze(issues),
  });
}

export function assertContentPackageValid(facts: PackageLintFacts): PackageLintReport {
  const report = lintContentPackage(facts);
  if (!report.valid) {
    throw new PackageLintError(
      `Paquete inválido (${report.issues.length} control(es)): ${report.issues
        .map((issue) => `${issue.checkId}: ${issue.detail}`)
        .join('; ')}`,
      report,
    );
  }
  return report;
}
