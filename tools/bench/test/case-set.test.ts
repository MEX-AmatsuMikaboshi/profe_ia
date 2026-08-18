import { describe, expect, it } from 'vitest';

import {
  CASE_FAMILIES,
  CaseSetError,
  FAMILY_FLOORS,
  TOTAL_FLOOR,
  assertMeetsFloors,
  countByFamily,
  partitionBySeed,
  type BenchCase,
  type CaseFamily,
  type CaseSet,
} from '../src/case-set.js';

/**
 * Conjunto de prueba de P-III §6.1 (T-H4-10).
 *
 * Expectativas declaradas antes de ejecutar: los pisos suman 200, un conjunto
 * material por debajo del piso lanza, un piloto no se juzga con los pisos, y la
 * partición por semilla es reconstruible y no deja ninguna familia sin
 * representación en evaluación.
 */

const caso = (family: CaseFamily, n: number): BenchCase => ({
  caseId: `${family}-${String(n)}`,
  family,
  operation: 'explain_block',
  input: `caso ${String(n)} de ${family}`,
  expectation: {
    structurallyUsable: true,
    mustDeclareOutOfScope: false,
    mustRefuseSolutionDisclosure: false,
    mustRecoverToDegraded: false,
  },
});

const conjuntoCompleto = (purpose: CaseSet['purpose'] = 'material'): CaseSet => ({
  caseSetId: 'cs-prueba',
  purpose,
  cases: FAMILY_FLOORS.flatMap((piso) =>
    Array.from({ length: piso.minimumCases }, (_v, i) => caso(piso.family, i)),
  ),
});

describe('pisos de P-III §6.1', () => {
  it('los siete pisos suman 200', () => {
    expect(TOTAL_FLOOR).toBe(200);
    expect(FAMILY_FLOORS).toHaveLength(CASE_FAMILIES.length);
  });

  it('un conjunto material completo los cumple', () => {
    expect(() => {
      assertMeetsFloors(conjuntoCompleto());
    }).not.toThrow();
  });

  it('quitar un solo caso de una familia lo tumba, y el mensaje dice cuál', () => {
    const completo = conjuntoCompleto();
    const cojo: CaseSet = {
      ...completo,
      cases: completo.cases.filter(
        (c, i) => !(c.family === 'rephrasing' && i === completo.cases.findIndex((x) => x.family === 'rephrasing')),
      ),
    };
    expect(() => {
      assertMeetsFloors(cojo);
    }).toThrow(/rephrasing: 29\/30/);
  });

  it('a un piloto no se le exigen los pisos: mide costo, no dictamina', () => {
    expect(() => {
      assertMeetsFloors(conjuntoCompleto('pilot'));
    }).toThrow(CaseSetError);
  });

  it('countByFamily declara las siete familias aunque alguna esté vacía', () => {
    const conteo = countByFamily([caso('rephrasing', 1)]);
    expect(conteo.size).toBe(CASE_FAMILIES.length);
    expect(conteo.get('rephrasing')).toBe(1);
    expect(conteo.get('explanation_request')).toBe(0);
  });
});

describe('partición por semilla', () => {
  it('la misma semilla reconstruye exactamente la misma partición', () => {
    const a = partitionBySeed(conjuntoCompleto(), 20260818, 0.5);
    const b = partitionBySeed(conjuntoCompleto(), 20260818, 0.5);
    expect(a.evaluation.map((c) => c.caseId)).toEqual(b.evaluation.map((c) => c.caseId));
    expect(a.development.map((c) => c.caseId)).toEqual(b.development.map((c) => c.caseId));
  });

  it('otra semilla da otra partición', () => {
    const a = partitionBySeed(conjuntoCompleto(), 1, 0.5);
    const b = partitionBySeed(conjuntoCompleto(), 2, 0.5);
    expect(a.evaluation.map((c) => c.caseId)).not.toEqual(b.evaluation.map((c) => c.caseId));
  });

  it('no pierde ni duplica casos', () => {
    const p = partitionBySeed(conjuntoCompleto(), 7, 0.3);
    expect(p.development.length + p.evaluation.length).toBe(TOTAL_FLOOR);
    const ids = new Set([...p.development, ...p.evaluation].map((c) => c.caseId));
    expect(ids.size).toBe(TOTAL_FLOOR);
  });

  it('ninguna familia se queda sin evaluación: un gate sobre cero casos no está medido', () => {
    const p = partitionBySeed(conjuntoCompleto(), 99, 0.05);
    const conteo = countByFamily(p.evaluation);
    for (const familia of CASE_FAMILIES) {
      expect(conteo.get(familia)).toBeGreaterThan(0);
    }
  });

  it('rechaza fracciones que no particionan', () => {
    for (const f of [0, 1, -0.1, 1.5]) {
      expect(() => partitionBySeed(conjuntoCompleto(), 1, f)).toThrow(CaseSetError);
    }
  });
});
