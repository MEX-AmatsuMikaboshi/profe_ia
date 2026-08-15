import { describe, expect, it } from 'vitest';
import {
  AUTHORIZED_CALCULUS_SHA256,
  AUTHORIZED_CALCULUS_VERSION,
  FORMAL_SYSTEM_ID,
  SOURCE_SNAPSHOT_SHA256,
} from '@profesor-ia/logic-core';
import {
  assertNoForeignSystemInMajority,
  CALGARY_ANCHOR,
  classifyDifference,
  countsAsW0Autonomy,
  DIFFERENCE_CLASSES,
  ForeignSystemInMajorityError,
  isTargetSystem,
  NoEligibleClaimsError,
  resolveByMajority,
  TARGET_FORMAL_SYSTEM_ID,
  type SourceClaim,
} from '../src/index.js';

function claim(overrides: Partial<SourceClaim> = {}): SourceClaim {
  return {
    sourceId: 'fuente-1',
    formalSystemId: TARGET_FORMAL_SYSTEM_ID,
    notationFamily: 'forallx',
    version: 'Fall 2025',
    scope: 'reglas de ∧',
    statement: '∧E extrae cualquiera de los dos conyuntos',
    ...overrides,
  };
}

describe('sistema formal objetivo (T-H45-03 ← DEC-CALCULUS-001)', () => {
  it('es `forallx-calgary-tfl` y se deriva de logic-core, no se transcribe', () => {
    expect(TARGET_FORMAL_SYSTEM_ID).toBe('forallx-calgary-tfl');
    expect(TARGET_FORMAL_SYSTEM_ID).toBe(FORMAL_SYSTEM_ID);
  });

  it('el ancla lleva el SHA del cálculo y el del snapshot, derivados', () => {
    expect(CALGARY_ANCHOR.calculusSha256).toBe(AUTHORIZED_CALCULUS_SHA256);
    expect(CALGARY_ANCHOR.sourceSnapshotSha256).toBe(SOURCE_SNAPSHOT_SHA256);
    expect(CALGARY_ANCHOR.authorizedCalculusVersion).toBe(AUTHORIZED_CALCULUS_VERSION);
    // Son dos hashes distintos: el del cálculo transcrito y el del PDF de origen.
    expect(CALGARY_ANCHOR.calculusSha256).not.toBe(CALGARY_ANCHOR.sourceSnapshotSha256);
  });

  it('las cinco clases de diferencia son las literales', () => {
    expect(DIFFERENCE_CLASSES).toEqual([
      'contradiccion_real',
      'convencion_alternativa',
      'sistema_formal_distinto',
      'diferencia_pedagogica',
      'informacion_complementaria',
    ]);
  });
});

describe('una fuente de otro sistema no contamina el cálculo', () => {
  const ajeno = claim({ sourceId: 'manual-otro', formalSystemId: 'sistema-natural-distinto' });

  it('se clasifica `sistema_formal_distinto` pase lo que pase', () => {
    expect(isTargetSystem(ajeno)).toBe(false);

    // Aunque quien clasifica lo declare como contradicción real, gana el sistema:
    // llamar «contradicción» a lo que dice otro cálculo convertiría una
    // diferencia de sistema en un error del nuestro.
    for (const declarada of DIFFERENCE_CLASSES) {
      expect(classifyDifference(ajeno, declarada)).toBe('sistema_formal_distinto');
    }
  });

  it('un claim del sistema objetivo conserva la clase declarada', () => {
    for (const declarada of DIFFERENCE_CLASSES) {
      expect(classifyDifference(claim(), declarada)).toBe(declarada);
    }
  });

  it('no participa por mayoría, ni siquiera siendo más numeroso', () => {
    const resultado = resolveByMajority([
      claim({ sourceId: 'propio', statement: 'lo correcto' }),
      ajeno,
      claim({ sourceId: 'ajeno-2', formalSystemId: 'otro', statement: 'lo de otro cálculo' }),
      claim({ sourceId: 'ajeno-3', formalSystemId: 'otro', statement: 'lo de otro cálculo' }),
    ]);

    // Tres a uno en bruto, pero los tres describen otro sistema.
    expect(resultado.statement).toBe('lo correcto');
    expect(resultado.supporting).toEqual(['propio']);
    expect(resultado.excludedForeignSystems).toEqual(['manual-otro', 'ajeno-2', 'ajeno-3']);
  });

  it('sin ningún claim del sistema objetivo no hay resultado', () => {
    expect(() => resolveByMajority([ajeno])).toThrow(NoEligibleClaimsError);
  });

  it('la guarda explícita detecta un ajeno colado en un recuento', () => {
    expect(() => assertNoForeignSystemInMajority([claim(), ajeno])).toThrow(
      ForeignSystemInMajorityError,
    );
    expect(() => assertNoForeignSystemInMajority([claim()])).not.toThrow();
  });
});

describe('mayoría determinista', () => {
  it('gana el más apoyado', () => {
    const r = resolveByMajority([
      claim({ sourceId: 'a', statement: 'X' }),
      claim({ sourceId: 'b', statement: 'X' }),
      claim({ sourceId: 'c', statement: 'Y' }),
    ]);

    expect(r.statement).toBe('X');
    expect(r.supporting).toEqual(['a', 'b']);
  });

  it('un empate se rompe siempre igual, no por orden de llegada', () => {
    const unOrden = resolveByMajority([
      claim({ sourceId: 'a', statement: 'Zeta' }),
      claim({ sourceId: 'b', statement: 'Alfa' }),
    ]);
    const otroOrden = resolveByMajority([
      claim({ sourceId: 'b', statement: 'Alfa' }),
      claim({ sourceId: 'a', statement: 'Zeta' }),
    ]);

    expect(unOrden.statement).toBe(otroOrden.statement);
    expect(unOrden.statement).toBe('Alfa');
  });
});

describe('DEC-W0-SCOPE-001: el sobre congelado no es autonomía de W0', () => {
  it('el cálculo y el ancla no cuentan', () => {
    expect(countsAsW0Autonomy(AUTHORIZED_CALCULUS_VERSION)).toBe(false);
    expect(countsAsW0Autonomy('forallx-calgary-anchor')).toBe(false);
  });

  it('una fuente que W0 sí descubrió cuenta', () => {
    expect(countsAsW0Autonomy('manual-hallado-en-w0')).toBe(true);
  });
});
