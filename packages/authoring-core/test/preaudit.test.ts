import { describe, expect, it } from 'vitest';

import {
  AUDIT_CODEBOOK,
  PREAUDIT_PARAMETERS,
  PreAuditError,
  assertBlockedAuditRemediation,
  evaluatePreAudit,
  generatePreAuditSample,
  type AuditableArtifact,
  type AuditDefectJudgment,
} from '../src/index.js';


/**
 * Código n-ésimo del libro cerrado. Indexar y confiar deja `undefined` dentro
 * del tipo, y un `undefined` que llega como código de defecto no se distingue
 * de «sin código» en la evaluación del gate.
 */
function codigo<T>(lista: readonly T[], indice = 0): T {
  const valor = lista[indice];
  if (valor === undefined) {
    throw new Error(`el libro de códigos no tiene entrada ${indice} para esa severidad`);
  }
  return valor;
}

function artifact(index: number, overrides: Partial<AuditableArtifact> = {}): AuditableArtifact {
  return {
    artifactId: `item-${index}`,
    kcId: 'KC03',
    bankFunction: 'guided_practice',
    complexity: 'baja',
    ruleType: 'R',
    origin: 'source-a',
    hasSubproof: false,
    risk: 'low',
    consequence: 'El defecto podría afectar aprendizaje.',
    itemFamilyId: `family-${index % 3}`,
    ...overrides,
  };
}

const population = (count: number, overrides: Partial<AuditableArtifact> = {}) =>
  Array.from({ length: count }, (_, index) => artifact(index + 1, overrides));

function defect(
  artifactId: string,
  itemFamilyId: string,
  severity: AuditDefectJudgment['severity'],
  code: AuditDefectJudgment['code'],
): AuditDefectJudgment {
  return {
    artifactId,
    itemFamilyId,
    severity,
    code,
    canChangeAnswerOrVerdict: severity !== 'minor',
    canContaminateMeasureLeakOrTeachFalseRule: severity === 'critical',
    scope: 'local',
    rationale: 'Clasificación fundamentada con las tres preguntas del codebook.',
  };
}

describe('T-H5-14: muestra previa estratificada', () => {
  it('aplica el máximo entre 20 % y cinco por función', () => {
    expect(generatePreAuditSample(population(10), 'seed-a').selectedArtifactIds).toHaveLength(5);
    expect(generatePreAuditSample(population(30), 'seed-a').selectedArtifactIds).toHaveLength(6);
  });

  it('incluye todos los de alto riesgo sin reducir pisos', () => {
    const items = [
      ...population(10),
      ...population(4, { risk: 'high', bankFunction: 'probe', origin: 'source-b' }).map((item, index) => ({
        ...item,
        artifactId: `high-${index}`,
      })),
    ];
    const sample = generatePreAuditSample(items, 'seed-risk');
    expect(sample.selectedArtifactIds.filter((id) => id.startsWith('high-'))).toHaveLength(4);
    expect(sample.selectedArtifactIds.filter((id) => id.startsWith('item-'))).toHaveLength(5);
    expect(PREAUDIT_PARAMETERS.highRiskPolicy).toBe('include_all');
  });

  it('cubre cada estrato observado y conserva N_h/n_h/fracción/semilla', () => {
    const items = [
      artifact(1),
      artifact(2, { kcId: 'KC04', complexity: 'media', hasSubproof: true, ruleType: '∧I' }),
      artifact(3, { kcId: 'KC05', complexity: 'alta', bankFunction: 'probe' }),
    ];
    const sample = generatePreAuditSample(items, 'seed-strata');
    expect(sample.strata).toHaveLength(3);
    expect(sample.strata.every((stratum) => stratum.n_h >= 1)).toBe(true);
    expect(sample.strata[0]).toMatchObject({
      N_h: 1,
      n_h: 1,
      fraction: 1,
      seed: 'seed-strata',
      inclusionProbability: null,
    });
  });

  it('misma semilla reproduce y otra semilla puede cambiar la selección', () => {
    const items = population(30);
    const first = generatePreAuditSample(items, 'seed-1').selectedArtifactIds;
    expect(generatePreAuditSample(items, 'seed-1').selectedArtifactIds).toEqual(first);
    expect(generatePreAuditSample(items, 'seed-2').selectedArtifactIds).not.toEqual(first);
  });

  it('rechaza población vacía, semilla vacía, IDs repetidos o dimensiones vacías', () => {
    expect(() => generatePreAuditSample([], 'seed')).toThrow(PreAuditError);
    expect(() => generatePreAuditSample(population(2), '')).toThrow(PreAuditError);
    expect(() => generatePreAuditSample([artifact(1), artifact(1)], 'seed')).toThrow(/repetidos/u);
    expect(() => generatePreAuditSample([artifact(1, { origin: '' })], 'seed')).toThrow(/dimensiones/u);
  });
});

describe('codebook y gates de aceptación', () => {
  const items = population(20, { risk: 'high' });
  const sample = generatePreAuditSample(items, 'gate-seed');
  const reviewed = sample.selectedArtifactIds;

  it('exige juicio explícito para cada artefacto de la muestra', () => {
    expect(() => evaluatePreAudit(sample, items, reviewed.slice(1), [])).toThrow(/exactamente/u);
    expect(evaluatePreAudit(sample, items, reviewed, []).blocked).toBe(false);
  });

  it('un crítico bloquea y conserva x/n', () => {
    const id = reviewed[0] as string;
    const family = items.find((item) => item.artifactId === id)?.itemFamilyId as string;
    const report = evaluatePreAudit(sample, items, reviewed, [
      defect(id, family, 'critical', codigo(AUDIT_CODEBOOK.critical)),
    ]);
    expect(report.blocked).toBe(true);
    expect(report.critical).toEqual({ count: 1, denominator: 20 });
    expect(report.reasons).toContain('critical_defect');
    expect(report.strata.reduce((sum, stratum) => sum + stratum.defectsBySeverity.critical, 0)).toBe(1);
  });

  it('5 % mayor y 15 % menor no bloquean; superarlos sí', () => {
    const judgments = reviewed.slice(0, 5).map((id, index) => {
      const family = items.find((item) => item.artifactId === id)?.itemFamilyId as string;
      return index === 0
        ? defect(id, family, 'major', codigo(AUDIT_CODEBOOK.major))
        : defect(id, family, 'minor', codigo(AUDIT_CODEBOOK.minor));
    });
    const exact = evaluatePreAudit(sample, items, reviewed, judgments.slice(0, 4));
    expect(exact.major.percent).toBe(5);
    expect(exact.minor.percent).toBe(15);
    expect(exact.blocked).toBe(false);
    const above = evaluatePreAudit(sample, items, reviewed, judgments);
    expect(above.minor.percent).toBe(20);
    expect(above.reasons).toContain('minor_rate_above_15_percent');
  });

  it('dos mayores de una familia bloquean aunque se evalúen por separado', () => {
    const sameFamily = items.filter((item) => item.itemFamilyId === 'family-1').slice(0, 2);
    const report = evaluatePreAudit(
      sample,
      items,
      reviewed,
      sameFamily.map((item) => defect(item.artifactId, item.itemFamilyId, 'major', codigo(AUDIT_CODEBOOK.major, 1))),
    );
    expect(report.familiesWithAtLeastTwoMajor).toEqual(['family-1']);
    expect(report.reasons).toContain('family_with_two_major_defects');
  });

  it('código/severidad o familia reasignada no se aceptan', () => {
    const id = reviewed[0] as string;
    expect(() =>
      evaluatePreAudit(sample, items, reviewed, [defect(id, 'otra-familia', 'major', codigo(AUDIT_CODEBOOK.major))]),
    ).toThrow(/reasignado/u);
    const family = items.find((item) => item.artifactId === id)?.itemFamilyId as string;
    expect(() =>
      evaluatePreAudit(sample, items, reviewed, [defect(id, family, 'minor', codigo(AUDIT_CODEBOOK.major))]),
    ).toThrow(/severidad/u);
    expect(() =>
      evaluatePreAudit(sample, items, reviewed, [
        {
          ...defect(id, family, 'major', codigo(AUDIT_CODEBOOK.major)),
          canChangeAnswerOrVerdict: false,
          canContaminateMeasureLeakOrTeachFalseRule: false,
        },
      ]),
    ).toThrow(/consecuencia material/u);
  });

  it('un bloqueo exige regeneración completa, muestra nueva y regresión', () => {
    const id = reviewed[0] as string;
    const family = items.find((item) => item.artifactId === id)?.itemFamilyId as string;
    const report = evaluatePreAudit(sample, items, reviewed, [
      defect(id, family, 'critical', codigo(AUDIT_CODEBOOK.critical)),
    ]);
    expect(() => assertBlockedAuditRemediation(report, [])).toThrow(/regeneración completa/u);
    expect(() =>
      assertBlockedAuditRemediation(report, [
        {
          itemFamilyId: family,
          initialJudgmentIds: [`judgment-${id}`],
          rootCause: 'Plantilla produce una solución incorrecta.',
          action: 'regenerate_entire_family',
          replacementSampleSeed: 'replacement-seed',
          regressionIds: [`regression-${id}`],
        },
      ]),
    ).not.toThrow();
  });
});
