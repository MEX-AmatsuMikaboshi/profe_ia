import { describe, expect, it } from 'vitest';

import {
  BKT_SHADOW_DISABLED_REASON,
  BKT_SHADOW_H5_CONFIGURATION,
  BktCalibrationRequiredError,
  assertBktShadowH5Configuration,
} from '../src/index.js';

describe('T-H5-16: BKT sombra opcional', () => {
  it('congela BKT deshabilitado porque CAL-11 no se ejecutó', () => {
    expect(BKT_SHADOW_H5_CONFIGURATION).toEqual({
      version: 'bkt-shadow-disabled-h5-v1',
      enabled: false,
      reasonCode: 'CAL_11_NOT_EXECUTED',
      parameters: null,
      authority: 'none',
      visibility: 'analysis_only',
      affectsAdvance: false,
      affectsMastery: false,
      affectsRecovery: false,
      affectsClosure: false,
    });
    expect(BKT_SHADOW_DISABLED_REASON).toBe('CAL_11_NOT_EXECUTED');
    expect(Object.isFrozen(BKT_SHADOW_H5_CONFIGURATION)).toBe(true);
  });

  it('acepta únicamente el literal congelado y devuelve la misma referencia', () => {
    expect(assertBktShadowH5Configuration({ ...BKT_SHADOW_H5_CONFIGURATION })).toBe(
      BKT_SHADOW_H5_CONFIGURATION,
    );
    expect(() =>
      assertBktShadowH5Configuration({
        ...BKT_SHADOW_H5_CONFIGURATION,
        reasonCode: 'disabled_by_preference',
      }),
    ).toThrow(BktCalibrationRequiredError);
  });

  it('rechaza parámetros inventados aunque declaren modo sombra', () => {
    expect(() =>
      assertBktShadowH5Configuration({
        enabled: true,
        mode: 'shadow_only',
        authority: 'none',
        parameters: { initialMastery: 0.5, learn: 0.1, slip: 0.1, guess: 0.2 },
      }),
    ).toThrow(/CAL-11/u);
  });

  it('no contiene salida probabilística ni palancas de decisión', () => {
    const keys = Object.keys(BKT_SHADOW_H5_CONFIGURATION);
    expect(keys).not.toContain('masteryProbabilityShadow');
    expect(keys).not.toContain('threshold');
    expect(keys).not.toContain('decision');
    expect(BKT_SHADOW_H5_CONFIGURATION.authority).toBe('none');
    expect(BKT_SHADOW_H5_CONFIGURATION.visibility).toBe('analysis_only');
  });
});
