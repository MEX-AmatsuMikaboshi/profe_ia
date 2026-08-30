import { describe, expect, it } from 'vitest';

import {
  ANNOTATION_PRIMITIVES,
  AnnotationError,
  SurfaceRevisions,
  assertAnnotation,
  checkStaleness,
  formatTarget,
  maxAnnotationAgeMs,
  parseTarget,
  type Annotation,
} from '../src/annotations.js';

/**
 * `ci:annotations:staleness` y la forma de las anotaciones (T-H8-05).
 *
 * Lo que se protege aquí no es la geometría —de eso va `coordinates.test.ts`—
 * sino dos cosas que un overlay hace mal por omisión: señalar donde ya no hay
 * nada, y señalar sin decirlo para quien no ve la pantalla.
 */

function anotacion(overrides: Partial<Annotation> = {}): Annotation {
  return {
    annotationId: 'ann-1',
    primitive: 'circle',
    aim: { kind: 'semantic', target: { kind: 'fitch-line', value: '4' } },
    textEquivalent: 'Señalo la línea 4 de tu derivación.',
    surfaceId: 'clase',
    surfaceRevision: 3,
    issuedAtMs: 1_000,
    ...overrides,
  };
}

describe('targets semánticos', () => {
  it('las primitivas son las cinco de P-I §8.9.2 y ni una más', () => {
    expect([...ANNOTATION_PRIMITIVES]).toStrictEqual([
      'point',
      'highlight',
      'circle',
      'arrow',
      'underline',
    ]);
  });

  it('ida y vuelta del target', () => {
    for (const raw of ['fitch-line:4', 'kc-definition:KC06', 'board', 'hint-button']) {
      const parsed = parseTarget(raw);
      expect(parsed).not.toBeNull();
      expect(formatTarget(parsed!)).toBe(raw);
    }
  });

  it('un target inventado con prefijo válido NO cuela', () => {
    // `board:algo` tiene un prefijo de familia real. Aceptarlo dejaría entrar
    // targets que después nadie sabe resolver.
    expect(parseTarget('board:algo')).toBeNull();
    expect(parseTarget('fitch-line')).toBeNull();
    expect(parseTarget('fitch-line:')).toBeNull();
    expect(parseTarget('tabla-de-verdad:3')).toBeNull();
  });
});

describe('la forma de la anotación', () => {
  it('sin equivalente textual se rechaza', () => {
    // Sin él la anotación no existe para quien no ve la pantalla.
    expect(() => assertAnnotation(anotacion({ textEquivalent: '   ' }))).toThrow(
      /SIN_EQUIVALENTE_TEXTUAL|equivalente textual/u,
    );
  });

  it('coordenadas sin motivo se rechazan', () => {
    // «No había target lógico» y «no se buscó» tienen que ser distinguibles.
    expect(() =>
      assertAnnotation(
        anotacion({
          aim: {
            kind: 'perceived',
            frame: 'viewport_css',
            points: [{ x: 10, y: 20, frame: 'viewport_css' }],
            reason: '',
          },
        }),
      ),
    ).toThrow(/COORDENADAS_SIN_MOTIVO|por qué/u);
  });

  it('un punto en otro marco que el declarado se rechaza', () => {
    expect(() =>
      assertAnnotation(
        anotacion({
          aim: {
            kind: 'perceived',
            frame: 'viewport_css',
            points: [{ x: 10, y: 20, frame: 'capture_pixel' }],
            reason: 'trazo manuscrito sin elemento del DOM detrás',
          },
        }),
      ),
    ).toThrow(AnnotationError);
  });

  it('una anotación percibida bien formada pasa', () => {
    expect(() =>
      assertAnnotation(
        anotacion({
          aim: {
            kind: 'perceived',
            frame: 'board_scene',
            points: [{ x: 1, y: 2, frame: 'board_scene' }],
            reason: 'dibujo a mano alzada en el pizarrón, sin target lógico',
          },
          textEquivalent: 'Rodeo el trazo que hiciste arriba a la izquierda.',
        }),
      ),
    ).not.toThrow();
  });
});

describe('ci:annotations:staleness — rechazo duro de lo obsoleto', () => {
  it('una anotación de una revisión anterior es obsoleta', () => {
    const revs = new SurfaceRevisions();
    revs.bump('clase', 5);
    const verdict = checkStaleness(anotacion({ surfaceRevision: 3 }), revs, 2_000);
    expect(verdict.outcome).toBe('stale');
    if (verdict.outcome !== 'stale') return;
    expect(verdict.reason).toBe('surface_revised');
  });

  it('una anotación de la revisión vigente es fresca', () => {
    const revs = new SurfaceRevisions();
    revs.bump('clase', 3);
    expect(checkStaleness(anotacion({ surfaceRevision: 3 }), revs, 2_000).outcome).toBe('fresh');
  });

  it('la revisión es monotónica: retroceder lanza', () => {
    // Retroceder haría que una anotación obsoleta volviera a parecer vigente.
    const revs = new SurfaceRevisions();
    revs.bump('clase', 5);
    expect(() => revs.bump('clase', 4)).toThrow(/REVISION_NO_MONOTONICA|monotónica|retroced/iu);
    expect(() => revs.bump('clase', 5)).toThrow();
  });

  it('la antigüedad sólo se juzga si se aporta el umbral', () => {
    const revs = new SurfaceRevisions();
    revs.bump('clase', 3);
    const vieja = anotacion({ surfaceRevision: 3, issuedAtMs: 0 });
    // Sin umbral no se inventa uno: se juzga sólo lo que se puede juzgar.
    expect(checkStaleness(vieja, revs, 10_000).outcome).toBe('fresh');
    // Con umbral aportado, se aplica.
    const verdict = checkStaleness(vieja, revs, 10_000, 500);
    expect(verdict.outcome).toBe('stale');
    if (verdict.outcome !== 'stale') return;
    expect(verdict.reason).toBe('too_old');
  });
});

describe('CAL-MULTIMODAL falla cerrado', () => {
  it('`maxAnnotationAgeMs()` lanza en vez de devolver un número plausible', () => {
    // Es el punto donde se enchufa el valor congelado de T-H8-11. Devolver un
    // número movería la frontera entre «vigente» y «obsoleta» con una
    // suposición: alto deja pasar obsoletas, bajo tira buenas en una máquina
    // lenta.
    expect(() => maxAnnotationAgeMs()).toThrow(/MAX_AGE_NO_CALIBRADO|CAL-MULTIMODAL/u);
  });
});
