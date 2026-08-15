import { describe, expect, it } from 'vitest';
import {
  compareSuitability,
  lineageDiversity,
  newInformationCurve,
  SaturationCalibrationPendingError,
  saturationReport,
  shouldStopDiscovery,
  SUITABILITY_DIMENSIONS,
  suitabilityScore,
  SuitabilityCalibrationPendingError,
  type DiscoveryRound,
  type SuitabilityObservations,
} from '../src/index.js';

const OBS: SuitabilityObservations = {
  autoridad: 0.9,
  revision: 0.8,
  estabilidad: 0.7,
  explicitud: 0.9,
  verificabilidad: 0.6,
  cobertura: 0.5,
};

const RONDAS: readonly DiscoveryRound[] = [
  { round: 1, newItems: 8, reviewedItems: 10, lineages: ['calgary', 'ocw', 'openstax'] },
  { round: 2, newItems: 3, reviewedItems: 10, lineages: ['calgary', 'calgary'] },
  { round: 3, newItems: 0, reviewedItems: 10, lineages: [] },
];

describe('las seis variables observables (T-H45-04 ← P-I §7.0)', () => {
  it('son las literales', () => {
    expect(SUITABILITY_DIMENSIONS).toEqual([
      'autoridad',
      'revision',
      'estabilidad',
      'explicitud',
      'verificabilidad',
      'cobertura',
    ]);
  });

  it('la licencia NO es una de ellas: es un gate separado', () => {
    // Si la licencia pesara dentro del score, una fuente jurídicamente
    // inutilizable podría compensar con autoridad y cobertura y salir mejor
    // ordenada que una utilizable.
    for (const prohibida of ['licencia', 'license', 'licensing', 'derechos']) {
      expect(SUITABILITY_DIMENSIONS as readonly string[]).not.toContain(prohibida);
    }
  });
});

describe('el escalar de idoneidad falla cerrado (CAL-SOURCE-SCORE)', () => {
  it('no devuelve un número con pesos inventados', () => {
    expect(() => suitabilityScore(OBS)).toThrow(SuitabilityCalibrationPendingError);
  });

  it('comparar tampoco: ordenar exige los mismos pesos que agregar', () => {
    expect(() => compareSuitability(OBS, OBS)).toThrow(SuitabilityCalibrationPendingError);
  });

  it('el error dice qué falta y dónde se congela', () => {
    try {
      suitabilityScore(OBS);
      expect.unreachable('debía fallar cerrado');
    } catch (error) {
      const mensaje = (error as Error).message;
      expect(mensaje).toContain('PENDING_CALIBRATION');
      expect(mensaje).toContain('CAL-SOURCE-SCORE');
      expect(mensaje).toContain('H4.5');
    }
  });
});

describe('lo medible sí se mide', () => {
  it('la curva de información nueva se calcula y va ordenada por ronda', () => {
    const curva = newInformationCurve([...RONDAS].reverse());

    expect(curva.map((p) => p.round)).toEqual([1, 2, 3]);
    expect(curva[0]?.newFraction).toBeCloseTo(0.8, 10);
    expect(curva[2]?.newFraction).toBe(0);
  });

  it('una ronda sin revisiones no divide por cero', () => {
    const curva = newInformationCurve([{ round: 1, newItems: 0, reviewedItems: 0, lineages: [] }]);

    expect(curva[0]?.newFraction).toBe(0);
  });

  it('la diversidad de linaje distingue hallazgos de fuentes', () => {
    // Cinco hallazgos, tres linajes: los dos `calgary` extra no son fuentes
    // nuevas, y sin esta medida la saturación mediría agotamiento donde hubo
    // endogamia.
    const d = lineageDiversity(RONDAS);

    expect(d.totalFindings).toBe(5);
    expect(d.distinctLineages).toBe(3);
    expect(d.diversityRatio).toBeCloseTo(3 / 5, 10);
  });

  it('sin hallazgos la diversidad es 0 y no NaN', () => {
    expect(lineageDiversity([]).diversityRatio).toBe(0);
  });
});

describe('la regla de parada falla cerrado (CAL-SATURATION)', () => {
  it('no decide parar aunque la última ronda no traiga nada nuevo', () => {
    // «Paro tras una ronda sin novedad» suena razonable y es exactamente lo que
    // no se puede inventar: una parada prematura cierra el corpus antes de
    // tiempo y una tardía quema presupuesto, y ninguna se nota en el resultado.
    expect(() => shouldStopDiscovery(RONDAS)).toThrow(SaturationCalibrationPendingError);
  });

  it('el informe declara explícitamente que la parada no está disponible', () => {
    const informe = saturationReport(RONDAS);

    expect(informe.stopDecisionAvailable).toBe(false);
    expect(informe.curve).toHaveLength(3);
    expect(informe.diversity.distinctLineages).toBe(3);
  });

  it('el informe no trae ningún campo que parezca una decisión de parada', () => {
    const informe = saturationReport(RONDAS) as unknown as Record<string, unknown>;

    for (const campo of ['shouldStop', 'saturated', 'stop', 'converged']) {
      expect(informe[campo]).toBeUndefined();
    }
  });
});
