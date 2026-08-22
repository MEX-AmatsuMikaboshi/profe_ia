import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

/**
 * El artefacto de Rol B tiene que seguir declarando **exactamente** la
 * configuración congelada.
 *
 * Esta comprobación vivía en la guarda de artefactos de `authoring-core`, y allí
 * obligaba a importar `@profesor-ia/experiment` desde un paquete que **no lo
 * declara como dependencia** — y que no puede declararlo, porque `experiment`
 * depende de `authoring-core` y sería un ciclo. Resolvía en local y no en CI, y
 * no lo vio nadie hasta que se activó el typecheck de las pruebas (D-62). Aquí
 * la dirección es la correcta: `experiment` ya depende de `authoring-core`.
 */
describe('el artefacto de Rol B declara la configuración congelada (T-H5-04)', () => {
  const CONTENIDO = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../content/unidad-deduccion-natural',
  );

  /** Cabecera de comentarios `#` que llevan los artefactos antes del JSON. */
  const CABECERA = /^(#[^\n]*\n)+/u;

  it('BKT sombra sigue congelado en deshabilitado, sin parámetros ni autoridad', () => {
    const crudo = readFileSync(join(CONTENIDO, 'pedagogy/shadow-metrics.yaml'), 'utf8');
    const sombra = JSON.parse(crudo.replace(CABECERA, '')) as { bktShadow: unknown };
    expect(sombra.bktShadow).toEqual({ ...BKT_SHADOW_H5_CONFIGURATION });
  });
});
