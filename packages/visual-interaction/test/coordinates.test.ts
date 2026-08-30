import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  COORDINATE_FRAMES,
  CoordinateError,
  ROUNDTRIP_TOLERANCE,
  assertGeometry,
  convert,
  roundTripWithinTolerance,
  type CoordinateFrame,
  type SurfaceGeometry,
} from '../src/coordinates.js';

/**
 * `ci:coords:pbt` — transformaciones de coordenadas (T-H8-05).
 *
 * La propiedad que importa es **ida y vuelta**: convertir a otro marco y volver
 * tiene que devolver el punto de partida dentro de tolerancia. Sin ella, un
 * error de signo en una sola dirección pasaría desapercibido en las dos pruebas
 * de ejemplo que a nadie se le ocurre escribir al revés.
 */

const geometria = fc.record({
  cssWidth: fc.double({ min: 1, max: 8000, noNaN: true }),
  cssHeight: fc.double({ min: 1, max: 8000, noNaN: true }),
  scrollX: fc.double({ min: -5000, max: 5000, noNaN: true }),
  scrollY: fc.double({ min: -5000, max: 5000, noNaN: true }),
  zoom: fc.double({ min: 0.25, max: 5, noNaN: true }),
  devicePixelRatio: fc.double({ min: 0.5, max: 4, noNaN: true }),
  sceneOriginX: fc.double({ min: -5000, max: 5000, noNaN: true }),
  sceneOriginY: fc.double({ min: -5000, max: 5000, noNaN: true }),
});

const marco = fc.constantFrom<CoordinateFrame>(...COORDINATE_FRAMES);

describe('ci:coords:pbt — ida y vuelta', () => {
  it('convertir a otro marco y volver devuelve el punto, dentro de tolerancia', () => {
    fc.assert(
      fc.property(
        geometria,
        marco,
        marco,
        fc.double({ min: -1e4, max: 1e4, noNaN: true }),
        fc.double({ min: -1e4, max: 1e4, noNaN: true }),
        (g: SurfaceGeometry, desde, hasta, x, y) => {
          // Tolerancia relativa a la **escala del problema**, no a la del punto.
          //
          // La primera versión escalaba por `|x| + |y|` y el PBT la refutó a los
          // 138 casos con el punto (0,0): con `scrollX ≈ 4992` y `cssWidth = 1`,
          // el valor intermedio normalizado es ~1076 aunque la entrada y la
          // salida sean cero, así que el redondeo que acarrea no tiene nada que
          // ver con la magnitud del punto. Escalar por el punto pedía a IEEE-754
          // una precisión que no promete, y el fallo habría dicho «hay un bug»
          // donde sólo había coma flotante.
          const escala = Math.max(
            1,
            Math.abs(x),
            Math.abs(y),
            Math.abs(g.scrollX),
            Math.abs(g.scrollY),
            Math.abs(g.sceneOriginX),
            Math.abs(g.sceneOriginY),
            g.cssWidth * g.zoom,
            g.cssHeight * g.zoom,
          );
          const tolerancia = Math.max(ROUNDTRIP_TOLERANCE, escala * 1e-9);
          return roundTripWithinTolerance({ x, y, frame: desde }, hasta, g, tolerancia);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('convertir a su propio marco es la identidad exacta', () => {
    fc.assert(
      fc.property(geometria, marco, fc.double({ min: -1e4, max: 1e4, noNaN: true }), (g, f, x) => {
        const punto = { x, y: x, frame: f };
        const igual = convert(punto, f, g);
        // Exacta, no dentro de tolerancia: no hay aritmética que hacer.
        return igual.x === punto.x && igual.y === punto.y && igual.frame === f;
      }),
      { numRuns: 200 },
    );
  });

  it('el scroll mueve viewport_css y NO mueve board_scene', () => {
    // Control positivo del modelo: si el scroll afectara a los dos marcos, la
    // ida y vuelta seguiría cuadrando y la distinción entre marcos no serviría
    // de nada. Esta prueba es la que la hace significar algo.
    const base: SurfaceGeometry = {
      cssWidth: 1000,
      cssHeight: 800,
      scrollX: 0,
      scrollY: 0,
      zoom: 1,
      devicePixelRatio: 1,
      sceneOriginX: 0,
      sceneOriginY: 0,
    };
    const conScroll: SurfaceGeometry = { ...base, scrollX: 100, scrollY: 50 };
    const punto = { x: 0.5, y: 0.5, frame: 'normalized' as const };

    const vpSin = convert(punto, 'viewport_css', base);
    const vpCon = convert(punto, 'viewport_css', conScroll);
    expect(vpCon.x).toBeCloseTo(vpSin.x - 100, 9);
    expect(vpCon.y).toBeCloseTo(vpSin.y - 50, 9);

    const escenaSin = convert(punto, 'board_scene', base);
    const escenaCon = convert(punto, 'board_scene', conScroll);
    expect(escenaCon.x).toBeCloseTo(escenaSin.x, 9);
    expect(escenaCon.y).toBeCloseTo(escenaSin.y, 9);
  });

  it('el DPR mueve capture_pixel y no los demás', () => {
    const base: SurfaceGeometry = {
      cssWidth: 1000,
      cssHeight: 800,
      scrollX: 0,
      scrollY: 0,
      zoom: 1,
      devicePixelRatio: 1,
      sceneOriginX: 0,
      sceneOriginY: 0,
    };
    const retina: SurfaceGeometry = { ...base, devicePixelRatio: 2 };
    const punto = { x: 0.5, y: 0.5, frame: 'normalized' as const };

    expect(convert(punto, 'capture_pixel', retina).x).toBeCloseTo(
      convert(punto, 'capture_pixel', base).x * 2,
      9,
    );
    expect(convert(punto, 'viewport_css', retina).x).toBeCloseTo(
      convert(punto, 'viewport_css', base).x,
      9,
    );
  });
});

describe('ci:coords:pbt — geometrías imposibles fallan cerrado', () => {
  it('un zoom de cero lanza en vez de producir Infinity', () => {
    // Un `Infinity` que viaja como coordenada no da error más tarde: pinta la
    // anotación en un sitio arbitrario, y el alumno la cree.
    const g = {
      cssWidth: 100,
      cssHeight: 100,
      scrollX: 0,
      scrollY: 0,
      zoom: 0,
      devicePixelRatio: 1,
      sceneOriginX: 0,
      sceneOriginY: 0,
    };
    expect(() => assertGeometry(g)).toThrow(CoordinateError);
    expect(() => convert({ x: 1, y: 1, frame: 'viewport_css' }, 'normalized', g)).toThrow(
      /zoom/u,
    );
  });

  it('un DPR o un tamaño no positivos lanzan', () => {
    const base = {
      cssWidth: 100,
      cssHeight: 100,
      scrollX: 0,
      scrollY: 0,
      zoom: 1,
      devicePixelRatio: 1,
      sceneOriginX: 0,
      sceneOriginY: 0,
    };
    expect(() => assertGeometry({ ...base, devicePixelRatio: 0 })).toThrow(/devicePixelRatio/u);
    expect(() => assertGeometry({ ...base, cssWidth: -1 })).toThrow(/cssWidth/u);
    expect(() => assertGeometry({ ...base, scrollX: Number.NaN })).toThrow(/scrollX/u);
  });
});
