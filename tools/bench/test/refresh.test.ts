import {
  DocumentaryRefreshRecord,
  RefreshWindowParameter,
  UnpinnedBindingError,
  assertRefreshAuthorizesBenchmark,
  verifiedAtFromRefresh,
} from '@profesor-ia/model-gateway';
import { describe, expect, it } from 'vitest';

import { assertMeetsFloors, countByFamily, CaseSetError } from '../src/case-set.js';
import { PILOT_CASE_SET, PILOT_INSTRUCTIONS } from '../src/pilot-cases.js';
import { REFRESH_2026_08_18, REFRESH_WINDOW_5D } from '../src/refresh-2026-08-18.js';

/**
 * Refresco documental material del 2026-08-18 y conjunto piloto (T-H4-10).
 *
 * Se comprueba antes de gastar: que la evidencia cumple el contrato, que
 * autoriza una corrida piloto, y que el conjunto piloto **no** puede pasar por
 * benchmark.
 */

const ARRANQUE = '2026-08-18T08:00:00.000Z';

describe('refresco documental material', () => {
  it('cumple el contrato', () => {
    expect(() => DocumentaryRefreshRecord.parse(REFRESH_2026_08_18)).not.toThrow();
    expect(() => RefreshWindowParameter.parse(REFRESH_WINDOW_5D)).not.toThrow();
  });

  it('la ventana son 5 días y declara quién la fijó', () => {
    expect(REFRESH_WINDOW_5D.maxAgeSeconds).toBe(432_000);
    expect(REFRESH_WINDOW_5D.purpose).toBe('material');
    expect(REFRESH_WINDOW_5D.provenance).toContain('propietario');
  });

  it('ningún campo de política queda en no_consultado', () => {
    for (const candidato of REFRESH_2026_08_18.candidates) {
      for (const campo of Object.values(candidato.dataPolicy)) {
        if (campo.known === false) {
          expect(campo.reason).toBe('no_publicado_por_el_proveedor');
        }
      }
    }
  });

  it('cada candidato trae fuentes con URL, fecha y hash de 64 hex', () => {
    for (const candidato of REFRESH_2026_08_18.candidates) {
      expect(candidato.sources.length).toBeGreaterThan(0);
      for (const fuente of candidato.sources) {
        expect(fuente.url).toMatch(/^https:\/\//);
        expect(fuente.contentSha256).toMatch(/^[0-9a-f]{64}$/);
      }
    }
  });

  it('autoriza al candidato con snapshot fechado y reporta su antigüedad', () => {
    const auth = assertRefreshAuthorizesBenchmark(REFRESH_2026_08_18, REFRESH_WINDOW_5D, {
      runId: 'piloto',
      startedAt: ARRANQUE,
      candidateIds: ['claude-haiku-4-5-20251001'],
      purpose: 'test_fixture',
    });
    expect(Object.keys(auth.ageSecondsByCandidate)).toEqual(['claude-haiku-4-5-20251001']);
    const edad = auth.ageSecondsByCandidate['claude-haiku-4-5-20251001'];
    expect(edad).toBeGreaterThanOrEqual(0);
    expect(edad).toBeLessThan(432_000);
  });

  /**
   * Hallazgo real del refresco del 2026-08-18, no una prueba de laboratorio:
   * OpenAI no publica snapshot fechado para `gpt-5.6-luna`, y sin snapshot
   * §8.1 exige huella de comportamiento sobre el set canario congelado. Un
   * alias puede cambiar de modelo por debajo sin avisar, y entonces el
   * benchmark habría medido algo que ya no existe.
   *
   * Inventarle una huella sería fabricar la evidencia que la regla pide, así
   * que el candidato **queda fuera** hasta producirla de verdad.
   */
  it('rechaza al candidato sin snapshot ni huella, aunque la corrida sea piloto', () => {
    expect(() =>
      assertRefreshAuthorizesBenchmark(REFRESH_2026_08_18, REFRESH_WINDOW_5D, {
        runId: 'piloto',
        startedAt: ARRANQUE,
        candidateIds: ['gpt-5.6-luna'],
        purpose: 'test_fixture',
      }),
    ).toThrow(UnpinnedBindingError);
  });

  it('un arranque más de 5 días después ya no está autorizado', () => {
    expect(() =>
      assertRefreshAuthorizesBenchmark(REFRESH_2026_08_18, REFRESH_WINDOW_5D, {
        runId: 'piloto',
        startedAt: '2026-08-24T00:00:00.000Z',
        candidateIds: ['claude-haiku-4-5-20251001'],
        purpose: 'test_fixture',
      }),
    ).toThrow();
  });

  it('el verifiedAt del binding se deriva del refresco, no se escribe a mano', () => {
    expect(verifiedAtFromRefresh(REFRESH_2026_08_18, 'claude-haiku-4-5-20251001')).toBe(
      REFRESH_2026_08_18.refreshedAt,
    );
  });
});

describe('conjunto piloto', () => {
  it('tiene dos casos por familia, catorce en total', () => {
    expect(PILOT_CASE_SET.cases).toHaveLength(14);
    for (const [, n] of countByFamily(PILOT_CASE_SET.cases)) {
      expect(n).toBe(2);
    }
  });

  it('no puede pasar por benchmark: los pisos lo rechazan por propósito', () => {
    expect(() => {
      assertMeetsFloors(PILOT_CASE_SET);
    }).toThrow(CaseSetError);
  });

  it('los adversariales declaran que no debe entregarse la solución', () => {
    const adversariales = PILOT_CASE_SET.cases.filter(
      (c) => c.family === 'adversarial_solution_extraction',
    );
    expect(adversariales).toHaveLength(2);
    for (const caso of adversariales) {
      expect(caso.expectation.mustRefuseSolutionDisclosure).toBe(true);
    }
  });

  it('los de fuera de alcance declaran que debe declararse', () => {
    for (const caso of PILOT_CASE_SET.cases.filter((c) => c.family === 'out_of_scope_question')) {
      expect(caso.expectation.mustDeclareOutOfScope).toBe(true);
    }
  });

  it('las instrucciones enumeran el cálculo congelado y prohíben entregar derivaciones', () => {
    for (const regla of ['∧E', '∨E', '→I', 'IP', 'DNE']) {
      expect(PILOT_INSTRUCTIONS).toContain(regla);
    }
    for (const prohibida of ['DS', 'MT', 'DeM', 'LEM', 'TND']) {
      expect(PILOT_INSTRUCTIONS).toContain(prohibida);
    }
    expect(PILOT_INSTRUCTIONS).toContain('Nunca entregues la derivación completa');
  });
});
