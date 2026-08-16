import { describe, expect, it } from 'vitest';
import { AUTHORIZED_CALCULUS_VERSION } from '@profesor-ia/logic-core';

import {
  PACKAGE_LINT_CHECK_IDS,
  PackageLintError,
  assertContentPackageValid,
  lintContentPackage,
  type PackageLintFacts,
} from '../src/index.js';

const SHA = 'a'.repeat(64);

function validFacts(): PackageLintFacts {
  return {
    packageVersion: 'content-v1',
    corpus: { componentCount: 2, fragmentCount: 12, expectedSha256: SHA, actualSha256: SHA },
    fragmentReferences: { danglingIds: [] },
    calculus: {
      version: AUTHORIZED_CALCULUS_VERSION,
      sha256: SHA,
      ruleCatalogComplete: true,
      aliasCatalogComplete: true,
      semanticDecisionPolicyComplete: true,
    },
    experimentalSets: [
      { setId: 'A', targetKcs: ['KC03'], supportKcs: ['KC01'], authorizedCalculusVersion: AUTHORIZED_CALCULUS_VERSION },
      { setId: 'B', targetKcs: ['KC04'], supportKcs: ['KC02'], authorizedCalculusVersion: AUTHORIZED_CALCULUS_VERSION },
      { setId: 'C', targetKcs: ['KC05'], supportKcs: ['KC08'], authorizedCalculusVersion: AUTHORIZED_CALCULUS_VERSION },
    ],
    map: { unjustifiedCycles: [] },
    coverage: { gapIds: [] },
    reserves: { collisionIds: [] },
    scorableItemIds: ['i-1'],
    solutionItemIds: ['i-1'],
    probes: { missingBySet: { A: 0, B: 0, C: 0 } },
    hints: {
      missingItemIds: [],
      missingLevelsByItem: { 'i-1': [] },
      masteryFlags: [
        {
          itemId: 'i-1',
          hintOrdinal: 1,
          level: 1,
          levelOneReminderOnly: true,
          selectsRuleOrNextStep: false,
          containsDecisiveContent: false,
          proposedMasteryDisqualifying: false,
        },
        {
          itemId: 'i-1',
          hintOrdinal: 2,
          level: 2,
          levelOneReminderOnly: false,
          selectsRuleOrNextStep: true,
          containsDecisiveContent: false,
          proposedMasteryDisqualifying: true,
        },
      ],
    },
    rubricItemIds: ['i-1'],
    pedagogy: {
      missingCatalogEntries: [],
      missingPolicyIds: [],
      scaffoldingFadingViolationIds: [],
    },
    retrievalSpacing: { calendarConflictIds: [], measurementReserveConsumptionIds: [] },
    modeSeparationViolationIds: [],
    prohibitedDuplicatePairIds: [],
    golden: { suiteCount: 5, failingCaseIds: [], constructedAcceptanceCaseCount: 10 },
    audit: { auditId: 'audit-1', sampleSeed: 'seed-1', strataCount: 4 },
    versions: { calculus: 'v1', verifier: 'v1', prompts: 'v1' },
    requiredVersionKeys: ['calculus', 'verifier', 'prompts'],
  };
}

describe('T-H5-13: linter integral del paquete', () => {
  it('ejecuta exactamente la lista completa y acepta hechos coherentes', () => {
    const report = lintContentPackage(validFacts());
    expect(report.valid).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.checksRun).toEqual(PACKAGE_LINT_CHECK_IDS);
    expect(new Set(report.checksRun).size).toBe(20);
  });

  it('enumera todos los controles fallidos en una sola pasada', () => {
    const facts = validFacts();
    const report = lintContentPackage({
      ...facts,
      packageVersion: '',
      corpus: { ...facts.corpus, componentCount: 0 },
      fragmentReferences: { danglingIds: ['missing-fragment'] },
      calculus: { ...facts.calculus, aliasCatalogComplete: false },
      experimentalSets: [],
      map: { unjustifiedCycles: [['KC03', 'KC04']] },
      coverage: { gapIds: ['KC03'] },
      reserves: { collisionIds: ['i-1/i-2'] },
      scorableItemIds: [],
      solutionItemIds: [],
      probes: { missingBySet: { A: 1, B: 2 } },
      hints: { missingItemIds: ['i-1'], missingLevelsByItem: { 'i-1': [2] }, masteryFlags: [] },
      rubricItemIds: [],
      pedagogy: {
        missingCatalogEntries: ['feedback'],
        missingPolicyIds: ['policy-1'],
        scaffoldingFadingViolationIds: ['fade-by-clock'],
      },
      retrievalSpacing: { calendarConflictIds: ['r-1'], measurementReserveConsumptionIds: [] },
      modeSeparationViolationIds: ['measurement-hint'],
      prohibitedDuplicatePairIds: ['i-1/i-2'],
      golden: { suiteCount: 0, failingCaseIds: [], constructedAcceptanceCaseCount: 0 },
      audit: { auditId: '', sampleSeed: '', strataCount: 0 },
      versions: {},
    });
    expect(report.valid).toBe(false);
    expect(report.issues.map((issue) => issue.checkId)).toEqual(PACKAGE_LINT_CHECK_IDS);
  });

  it('recalcula masteryDisqualifying y rechaza la propuesta generativa discrepante', () => {
    const facts = validFacts();
    const report = lintContentPackage({
      ...facts,
      hints: {
        ...facts.hints,
        masteryFlags: [
          {
            itemId: 'i-1',
            hintOrdinal: 5,
            level: 1,
            levelOneReminderOnly: true,
            selectsRuleOrNextStep: false,
            containsDecisiveContent: true,
            proposedMasteryDisqualifying: false,
          },
        ],
      },
    });
    expect(report.issues).toEqual([
      expect.objectContaining({
        checkId: 'authoritative_mastery_flags',
        detail: expect.stringContaining('i-1#5'),
      }),
    ]);
  });

  it('niveles 2–5 descalifican aunque no se marquen decisivos', () => {
    const facts = validFacts();
    for (const level of [2, 3, 4, 5] as const) {
      const report = lintContentPackage({
        ...facts,
        hints: {
          ...facts.hints,
          masteryFlags: [
            {
              itemId: `i-${level}`,
              hintOrdinal: level,
              level,
              levelOneReminderOnly: false,
              selectsRuleOrNextStep: false,
              containsDecisiveContent: false,
              proposedMasteryDisqualifying: false,
            },
          ],
        },
      });
      expect(report.issues.map((issue) => issue.checkId)).toContain('authoritative_mastery_flags');
    }
  });

  it('la excepción de nivel 1 deja de aplicar si selecciona regla o paso', () => {
    const facts = validFacts();
    const record = facts.hints.masteryFlags[0];
    if (record === undefined) throw new Error('fixture incompleto');
    const report = lintContentPackage({
      ...facts,
      hints: {
        ...facts.hints,
        masteryFlags: [{ ...record, selectsRuleOrNextStep: true }],
      },
    });
    expect(report.issues.map((issue) => issue.checkId)).toContain('authoritative_mastery_flags');
  });

  it('la aserción conserva el informe completo al bloquear', () => {
    const facts = validFacts();
    try {
      assertContentPackageValid({ ...facts, coverage: { gapIds: ['KC17'] } });
      throw new Error('debió bloquear');
    } catch (error) {
      expect(error).toBeInstanceOf(PackageLintError);
      expect((error as PackageLintError).report).toMatchObject({ valid: false });
    }
  });
});
