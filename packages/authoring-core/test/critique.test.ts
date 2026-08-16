import { describe, expect, it } from 'vitest';
import {
  assertAgreementUsableAsEvidence,
  assertCritique,
  CRITIQUE_CRITERIA,
  criticIndependence,
  critiqueQualityReport,
  critiqueRiskFlags,
  CritiqueError,
  type ItemCritique,
} from '../src/index.js';

function critica(overrides: Partial<ItemCritique> = {}): ItemCritique {
  return {
    itemId: 'it-001',
    criticModelFamily: 'familia-E',
    generatorModelFamily: 'familia-C',
    justification: [
      {
        criterion: 'claridad',
        observation: 'el enunciado nombra las dos premisas y la meta sin ambigüedad',
        evidence: 'enunciado del candidato it-001',
      },
    ],
    verdict: 'approve',
    ...overrides,
  };
}

describe('Rol E — forma de la crítica (T-H5-05 ← P-II §5.2)', () => {
  it('evalúa los seis criterios literales', () => {
    expect(CRITIQUE_CRITERIA).toEqual([
      'claridad',
      'ambiguedad',
      'correspondencia_con_objetivo',
      'fuga',
      'sobreajuste_a_ejemplos',
      'consistencia_de_notacion',
    ]);
  });

  it('exige justificación estructurada incluso cuando el veredicto es «approve»', () => {
    // La norma la pide «antes de su veredicto»: un aprobado sin justificación no
    // se distingue de no haber mirado.
    expect(() => assertCritique(critica({ justification: [], verdict: 'approve' }))).toThrow(
      CritiqueError,
    );
  });

  it('rechaza un criterio que no es uno de los seis', () => {
    expect(() =>
      assertCritique(
        critica({
          justification: [
            {
              // @ts-expect-error criterio fuera del catálogo cerrado
              criterion: 'elegancia',
              observation: 'o',
              evidence: 'e',
            },
          ],
        }),
      ),
    ).toThrow(/no es uno de los seis/u);
  });

  it('rechaza el hallazgo sin evidencia: sería una opinión con formato de hallazgo', () => {
    expect(() =>
      assertCritique(
        critica({
          justification: [{ criterion: 'fuga', observation: 'parece filtrar', evidence: '  ' }],
        }),
      ),
    ).toThrow(CritiqueError);
  });
});

describe('independencia generativa (P-I §7.3, P-II §5.2)', () => {
  it('misma familia: no independiente, y **no lanza**', () => {
    // La norma prevé el caso: la misma familia no invalida la crítica, invalida
    // su uso como evidencia de calidad.
    const c = critica({ criticModelFamily: 'f1', generatorModelFamily: 'f1' });
    expect(() => assertCritique(c)).not.toThrow();
    expect(criticIndependence(c).independent).toBe(false);
  });

  it('usar su acuerdo como evidencia cuando no es independiente sí falla cerrado', () => {
    const c = critica({ criticModelFamily: 'f1', generatorModelFamily: 'f1' });
    expect(() => assertAgreementUsableAsEvidence(c)).toThrow(CritiqueError);
    expect(() => assertAgreementUsableAsEvidence(critica())).not.toThrow();
  });
});

describe('calidad de la crítica: el acuerdo nunca va solo (P-II §5.2)', () => {
  it('sin ningún defectuoso la tasa es `null` y **no** cero', () => {
    // Un cero se leería como «el crítico no aprobó ninguno de los defectuosos»
    // cuando lo cierto es que no se le presentó ninguno: la métrica que pasa por
    // vacío.
    const informe = critiqueQualityReport([critica()], []);
    expect(informe.approvalRateOverDeterministicallyDefective).toBeNull();
    expect(informe.defectiveConsidered).toBe(0);
  });

  it('mide la aprobación sobre los que el validador determinista clasificó defectuosos', () => {
    const informe = critiqueQualityReport(
      [
        critica({ itemId: 'malo-1', verdict: 'approve' }),
        critica({ itemId: 'malo-2', verdict: 'reject' }),
        critica({ itemId: 'bueno-1', verdict: 'approve' }),
      ],
      ['malo-1', 'malo-2'],
    );
    expect(informe.approvalRateOverDeterministicallyDefective).toBe(0.5);
    expect(informe.agreementRate).toBeCloseTo(2 / 3);
    expect(informe.agreementAloneIsNotAQualityIndicator).toBe(true);
  });

  it('un informe sobre cero críticas no se emite', () => {
    expect(() => critiqueQualityReport([], [])).toThrow(CritiqueError);
  });
});

describe('señales para los filtros', () => {
  it('los criterios con hallazgo salen sin repetir y en orden estable', () => {
    const c = critica({
      justification: [
        { criterion: 'fuga', observation: 'o1', evidence: 'e1' },
        { criterion: 'claridad', observation: 'o2', evidence: 'e2' },
        { criterion: 'fuga', observation: 'o3', evidence: 'e3' },
      ],
    });
    expect(critiqueRiskFlags(c)).toEqual(['fuga', 'claridad']);
  });
});
