import {
  DocumentaryRefreshError,
  DocumentaryRefreshRecord,
  assertRefreshAuthorizesBenchmark,
} from '@profesor-ia/model-gateway';
import { describe, expect, it } from 'vitest';

import { REFRESH_2026_08_18, REFRESH_2026_08_23, REFRESH_WINDOW_5D } from '../src/index.js';

/**
 * Refresco documental vigente (T-H4-09 ← P-II §8.1).
 *
 * **Lo que estas pruebas fijan es un hallazgo, no una preferencia de estilo.**
 * El 2026-08-23 se comprobó que las huellas del refresco anterior **no son
 * reproducibles**: se tomaron sobre los bytes del HTML de la documentación, y
 * esas páginas sirven un `nonce` de CSP distinto en cada respuesta. Tres
 * descargas seguidas de la misma URL, sin que la documentación cambiara, dan
 * tres hashes distintos.
 *
 * Un hash irreproducible **parece** evidencia y no lo es: quien auditara
 * volvería a descargar, vería otro número y no podría decidir si cambió la
 * documentación o el servidor. Por eso la regla que se fija abajo —toda fuente
 * apunta al contenido en markdown— no es cosmética: es la que hace que la
 * huella signifique algo.
 */

const AHORA = '2026-08-23T09:00:00.000Z';

const correr = (candidateIds: readonly string[], startedAt = AHORA): void => {
  assertRefreshAuthorizesBenchmark(REFRESH_2026_08_23, REFRESH_WINDOW_5D, {
    runId: 'bench-01-material',
    startedAt,
    candidateIds,
    purpose: 'material',
  });
};

describe('el registro es válido y autoriza la corrida material', () => {
  it('valida contra el contrato', () => {
    expect(DocumentaryRefreshRecord.safeParse(REFRESH_2026_08_23).success).toBe(true);
  });

  it('autoriza a `claude-sonnet-5`, que es lo que el anterior no podía', () => {
    expect(() => {
      correr(['claude-sonnet-5']);
    }).not.toThrow();
    // Y el anterior, con el mismo instante, no: no lo cubre.
    expect(() =>
      assertRefreshAuthorizesBenchmark(REFRESH_2026_08_18, REFRESH_WINDOW_5D, {
        runId: 'bench-01-material',
        startedAt: AHORA,
        candidateIds: ['claude-sonnet-5'],
        purpose: 'material',
      }),
    ).toThrow(DocumentaryRefreshError);
  });

  it('autoriza también a haiku, que entra para comparar y no para coronar', () => {
    expect(() => {
      correr(['claude-sonnet-5', 'claude-haiku-4-5-20251001']);
    }).not.toThrow();
    const haiku = REFRESH_2026_08_23.candidates.find(
      (c) => c.candidateId === 'claude-haiku-4-5-20251001',
    );
    expect(haiku?.snapshotAliasPolicy).toContain('no para coronarlo');
  });

  it('caduca, y la ventana no se amplía para que quepa', () => {
    // Seis días después. La respuesta correcta es refrescar, no subir el techo.
    expect(() => {
      correr(['claude-sonnet-5'], '2026-08-29T09:00:00.000Z');
    }).toThrow(DocumentaryRefreshError);
  });

  it('un candidato que no está en el registro no se mide', () => {
    expect(() => {
      correr(['gpt-5.6-luna']);
    }).toThrow(DocumentaryRefreshError);
  });
});

describe('las huellas son de contenido documental, y por eso son reproducibles', () => {
  const fuentes = REFRESH_2026_08_23.candidates.flatMap((c) => c.sources);

  it('toda fuente apunta al markdown, no al HTML de la página', () => {
    // **Ésta es la regla que arregla el defecto.** Una URL de página HTML aquí
    // devolvería un hash distinto en cada descarga, y el registro afirmaría una
    // reproducibilidad que no tiene.
    expect(fuentes.length).toBeGreaterThan(0);
    for (const fuente of fuentes) {
      expect(fuente.url, fuente.url).toMatch(/\.md$/);
    }
  });

  it('el refresco anterior sí apuntaba al HTML: el defecto existió', () => {
    // Control positivo de la regla de arriba. Si el registro anterior también
    // hubiera apuntado a markdown, la regla no estaría arreglando nada y podría
    // haber pasado por casualidad.
    const anteriores = REFRESH_2026_08_18.candidates.flatMap((c) => c.sources);
    expect(anteriores.some((f) => !f.url.endsWith('.md'))).toBe(true);
  });

  it('cada candidato cita las cuatro fuentes, y ninguna huella se repite', () => {
    for (const candidato of REFRESH_2026_08_23.candidates) {
      expect(candidato.sources.length, candidato.candidateId).toBe(4);
    }
    const huellas = new Set(fuentes.map((f) => f.contentSha256));
    // Cuatro fuentes distintas compartidas por los dos candidatos.
    expect(huellas.size).toBe(4);
  });
});

describe('lo que el proveedor declara, transcrito y no parafraseado', () => {
  it('el id sin fecha es snapshot fijado, con la cita que lo sostiene', () => {
    // Sin la cita, «Anthropic fija sus ids» sería una creencia nuestra, y §8.1
    // exigiría huella de comportamiento sobre el set canario.
    const sonnet = REFRESH_2026_08_23.candidates.find((c) => c.candidateId === 'claude-sonnet-5');
    expect(sonnet?.snapshot).toBe('claude-sonnet-5');
    expect(sonnet?.snapshotAliasPolicy).toContain('pinned snapshot');
    expect(sonnet?.behaviorFingerprint).toBeUndefined();
  });

  it('temperature, top_p y top_k van como rechazados en todos', () => {
    // El proveedor documenta 400 con valor no por omisión en 4.7 y posteriores.
    // Declararlos soportados haría que la pasarela los enviara y la llamada
    // fallara con la factura ya hecha.
    for (const candidato of REFRESH_2026_08_23.candidates) {
      for (const parametro of ['temperature', 'top_p', 'top_k']) {
        expect(candidato.rejectedParameters, candidato.candidateId).toContain(parametro);
        expect(candidato.supportedParameters, candidato.candidateId).not.toContain(parametro);
      }
    }
  });

  it('lo no publicado queda como no conocido, no relleno con lo habitual', () => {
    for (const candidato of REFRESH_2026_08_23.candidates) {
      expect(candidato.dataPolicy.region.known).toBe(false);
      expect(candidato.dataPolicy.contractualEligibility.known).toBe(false);
      expect(candidato.dataPolicy.logging.known).toBe(true);
    }
  });

  it('ningún candidato de OpenAI: sigue sin haber huella de comportamiento', () => {
    // Y por eso BENCH-02 —que exige familias distintas— sigue bloqueado. El
    // registro lo refleja en vez de colar un id sin snapshot ni huella.
    expect(REFRESH_2026_08_23.candidates.every((c) => c.provider === 'anthropic')).toBe(true);
  });
});
