import { describe, expect, it } from 'vitest';

import {
  assertSurfaceControl,
  surfaceControlViolations,
  surfaceOverlap,
  surfaceOverlapCensus,
  SurfaceControlError,
  TRANSFER_SURFACE_RESERVES,
  type SurfaceItem,
} from '../src/index.js';

/**
 * Guarda G3 de D-67: los controles de superficie que P-I §5.11 exige «además de»
 * la representación estructural, y que no existían.
 */
const ensenanza = (parcial: Partial<SurfaceItem> = {}): SurfaceItem => ({
  itemId: 'kc05-guia',
  reserve: 'guided_practice',
  targetKcId: 'KC05',
  premises: ['D∧E'],
  goal: 'D',
  ...parcial,
});

const sonda = (parcial: Partial<SurfaceItem> = {}): SurfaceItem => ({
  itemId: 'kc05-probe-1',
  reserve: 'probes_intervention',
  targetKcId: 'KC05',
  premises: ['E∧F'],
  goal: 'Z→E',
  ...parcial,
});

describe('clasificación de superficie (D-67, G3)', () => {
  it('reconoce el enunciado idéntico bajo renombrado', () => {
    // §7.8: renombrar átomos no crea forma nueva. La sonda **es** el reactivo.
    expect(surfaceOverlap(sonda({ premises: ['G∧H'], goal: 'G' }), ensenanza())).toBe(
      'statement_renaming',
    );
  });

  it('distingue premisas literales de premisas bajo renombrado', () => {
    expect(surfaceOverlap(sonda({ premises: ['D∧E'] }), ensenanza())).toBe('premises_literal');
    expect(surfaceOverlap(sonda({ premises: ['P∧Q'] }), ensenanza())).toBe('premises_renaming');
  });

  it('llama distinta a la que cambia de verdad la superficie', () => {
    // La envoltura de premisa entierra la premisa en una conjunción: el alumno
    // ya no lee lo mismo. Es lo que hace `sonda-conj_premisa`.
    expect(surfaceOverlap(sonda({ premises: ['(D∧E)∧Z'] }), ensenanza())).toBe('distinct');
  });

  it('la clasificación es del enunciado, no del orden en que se escriban las premisas', () => {
    const a = sonda({ premises: ['A→B', 'A'] });
    const b = ensenanza({ premises: ['A', 'A→B'], goal: 'B' });
    expect(surfaceOverlap(a, b)).toBe('premises_literal');
  });
});

describe('qué incumple y qué solo se cuenta (D-67, G3)', () => {
  // ── Control positivo: el defecto real del banco ─────────────────────────
  it('transferencia con premisas idénticas incumple §5.11', () => {
    // «Una forma superficial suficientemente distinta de las prácticas
    // inmediatas» es el requisito que define la reserva. Treinta de las 34
    // `TRANSFER_MEASUREMENT` del banco repiten las premisas con las mismas letras.
    const v = surfaceControlViolations(
      [sonda({ itemId: 'kc05-transfer_measurement-1', reserve: 'TRANSFER_MEASUREMENT', premises: ['D∧E'], goal: 'D∧(D∧E)' })],
      [ensenanza()],
    );
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ overlap: 'premises_literal', comparedWith: 'kc05-guia' });
  });

  it('las mismas premisas fuera de transferencia se cuentan, pero NO son violación', () => {
    // Ninguna autoridad fija ahí un umbral. Declararlo violación sería decidir
    // por cuenta propia; no contarlo dejaría el control pasando por vacío.
    const s = sonda({ premises: ['D∧E'] });
    expect(surfaceControlViolations([s], [ensenanza()])).toEqual([]);
    expect(surfaceOverlapCensus([s], [ensenanza()]).probes_intervention).toMatchObject({
      premises_literal: 1,
      distinct: 0,
    });
  });

  it('el enunciado renombrado incumple en TODA reserva de medición', () => {
    for (const reserve of ['probes_baseline', 'probes_intervention', 'retention'] as const) {
      const v = surfaceControlViolations(
        [sonda({ reserve, premises: ['G∧H'], goal: 'G' })],
        [ensenanza()],
      );
      expect(v.map((x) => x.overlap)).toEqual(['statement_renaming']);
    }
  });

  it('no compara contra reactivos de otro KC', () => {
    const s = sonda({ targetKcId: 'KC07', premises: ['D∧E'], reserve: 'TRANSFER_MEASUREMENT' });
    expect(surfaceControlViolations([s], [ensenanza()])).toEqual([]);
  });

  it('ignora lo que no es sonda: dos reactivos de enseñanza pueden compartir superficie', () => {
    // §7.7 y `collisionProhibited()`: entre dos reservas de enseñanza la
    // colisión no está prohibida, porque guiada y después independiente sobre la
    // misma estructura es andamiaje.
    const otra = ensenanza({ itemId: 'kc05-indep', reserve: 'independent_practice' });
    expect(surfaceControlViolations([otra], [ensenanza()])).toEqual([]);
  });

  it('lanza si se le pasa una sonda como reactivo de enseñanza', () => {
    // Comparar sonda contra sonda es el control **estructural**; confundirlos
    // haría que este control dijera cosas sobre una relación que no gobierna.
    expect(() =>
      surfaceControlViolations([sonda()], [ensenanza({ reserve: 'retention' })]),
    ).toThrow(SurfaceControlError);
  });

  it('la lista de reservas de transferencia es la de §5.11, las dos', () => {
    expect([...TRANSFER_SURFACE_RESERVES].sort()).toEqual([
      'TRANSFER_MASTERY',
      'TRANSFER_MEASUREMENT',
    ]);
  });

  it('`assertSurfaceControl` nombra sonda, reactivo comparado y solapamiento', () => {
    const mala = sonda({ reserve: 'TRANSFER_MEASUREMENT', premises: ['D∧E'] });
    expect(() => assertSurfaceControl([mala], [ensenanza()])).toThrow(
      /kc05-probe-1.*kc05-guia.*premises_literal/,
    );
    expect(() => assertSurfaceControl([sonda()], [ensenanza()])).not.toThrow();
  });
});
