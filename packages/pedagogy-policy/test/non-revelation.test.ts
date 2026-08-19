import { describe, expect, it } from 'vitest';
import {
  checkNonRevelation,
  type CandidateHint,
  type NonRevelationInput,
  type NonRevelationVerdict,
} from '../src/index.js';

/**
 * T-H7-03 — puerta de no revelación (P-I §9.6), con el filtro de egreso de §9.4.
 */

const FILTRO_COMPLETO = {
  canaryDetectorApplied: true,
  fragmentsCheckedAgainstBlock: true,
  helpLevelChecked: true,
} as const;

function entrada(overrides: Partial<NonRevelationInput> = {}): NonRevelationInput {
  return {
    scorableActivity: { activityId: 'act-1', isProbe: false, attemptClosed: false },
    egressFilter: FILTRO_COMPLETO,
    hint: null,
    deliversFeedback: false,
    canaryHits: [],
    ...overrides,
  };
}

function pista(overrides: Partial<CandidateHint> = {}): CandidateHint {
  return {
    hintId: 'h1',
    level: 2,
    containsDecisiveContent: false,
    nonIsomorphismProven: false,
    isAnalogousExample: false,
    ...overrides,
  };
}

function bloqueos(v: NonRevelationVerdict): readonly string[] {
  return v.outcome === 'blocked' ? v.findings.map((f) => f.block) : [];
}

describe('control positivo', () => {
  it('deja pasar una actividad puntuable con todo en regla', () => {
    expect(checkNonRevelation(entrada()).outcome).toBe('allowed');
  });

  it('fuera de una actividad puntuable §9.6 no gobierna y no bloquea', () => {
    // Sin este control, escribir la puerta de más —aplicarla siempre— dejaría el
    // árbol verde diciendo lo que no dice: §9.6 habla de la actividad puntuable.
    const v = checkNonRevelation(
      entrada({
        scorableActivity: null,
        egressFilter: {
          canaryDetectorApplied: false,
          fragmentsCheckedAgainstBlock: false,
          helpLevelChecked: false,
        },
        hint: pista({ containsDecisiveContent: true }),
        deliversFeedback: true,
      }),
    );
    expect(v.outcome).toBe('allowed');
  });
});

describe('las cuatro condiciones literales de P-I §9.6', () => {
  it('sin solución en contexto: un canario bloquea', () => {
    const v = checkNonRevelation(entrada({ canaryHits: ['CAN-1'] }));
    expect(bloqueos(v)).toEqual(['solucion_en_contexto']);
  });

  it('sin pistas que completen el paso decisivo', () => {
    const v = checkNonRevelation(entrada({ hint: pista({ containsDecisiveContent: true }) }));
    expect(bloqueos(v)).toEqual(['pista_completa_paso_decisivo']);
  });

  it('sin ejemplos isomorfos inmediatos: falta de prueba bloquea igual que la prueba en contra', () => {
    const v = checkNonRevelation(
      entrada({ hint: pista({ level: 4, isAnalogousExample: true, nonIsomorphismProven: false }) }),
    );
    expect(bloqueos(v)).toEqual(['ejemplo_isomorfo_inmediato']);
  });

  it('un ejemplo análogo con evidencia del canonicalizador sí pasa', () => {
    const v = checkNonRevelation(
      entrada({ hint: pista({ level: 4, isAnalogousExample: true, nonIsomorphismProven: true }) }),
    );
    expect(v.outcome).toBe('allowed');
  });

  it('sin retroalimentación hasta cerrar el intento cuando sea una sonda', () => {
    const v = checkNonRevelation(
      entrada({
        scorableActivity: { activityId: 'sonda-1', isProbe: true, attemptClosed: false },
        deliversFeedback: true,
      }),
    );
    expect(bloqueos(v)).toEqual(['retroalimentacion_antes_de_cerrar_sonda']);
  });

  it('con el intento cerrado, la sonda sí puede recibir retroalimentación', () => {
    const v = checkNonRevelation(
      entrada({
        scorableActivity: { activityId: 'sonda-1', isProbe: true, attemptClosed: true },
        deliversFeedback: true,
      }),
    );
    expect(v.outcome).toBe('allowed');
  });

  it('la cuarta condición no se extiende a toda actividad puntuable: dice «cuando sea una sonda»', () => {
    const v = checkNonRevelation(
      entrada({
        scorableActivity: { activityId: 'act-1', isProbe: false, attemptClosed: false },
        deliversFeedback: true,
      }),
    );
    expect(v.outcome).toBe('allowed');
  });
});

describe('el comprobante del filtro de egreso (P-I §9.4)', () => {
  for (const campo of [
    'canaryDetectorApplied',
    'fragmentsCheckedAgainstBlock',
    'helpLevelChecked',
  ] as const) {
    it(`un comprobante sin ${campo} bloquea`, () => {
      const v = checkNonRevelation(
        entrada({ egressFilter: { ...FILTRO_COMPLETO, [campo]: false } }),
      );
      expect(bloqueos(v)).toEqual(['filtro_de_egreso_no_aplicado']);
    });
  }
});

describe('recoge todas las causas y declara autoridad', () => {
  it('varias fugas a la vez se reportan todas', () => {
    const v = checkNonRevelation(
      entrada({
        scorableActivity: { activityId: 'sonda-1', isProbe: true, attemptClosed: false },
        egressFilter: { ...FILTRO_COMPLETO, canaryDetectorApplied: false },
        canaryHits: ['CAN-1'],
        hint: pista({ level: 4, isAnalogousExample: true, containsDecisiveContent: true }),
        deliversFeedback: true,
      }),
    );
    expect(bloqueos(v)).toEqual([
      'filtro_de_egreso_no_aplicado',
      'solucion_en_contexto',
      'pista_completa_paso_decisivo',
      'ejemplo_isomorfo_inmediato',
      'retroalimentacion_antes_de_cerrar_sonda',
    ]);
  });

  it('cada bloqueo declara la autoridad literal de la que sale', () => {
    const v = checkNonRevelation(entrada({ canaryHits: ['CAN-1'] }));
    if (v.outcome !== 'blocked') throw new Error('debía bloquear');
    for (const f of v.findings) expect(f.authority).toMatch(/P-I §9\.[46]/u);
  });
});
