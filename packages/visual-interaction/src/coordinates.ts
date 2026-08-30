/**
 * Marcos de coordenadas y sus transformaciones (T-H8-05 ← P-I §8.9.2).
 *
 * ## Por qué hay cuatro marcos y no uno
 *
 * Una anotación puede nacer en sitios con reglas distintas, y aplanarlos a uno
 * solo perdería justo lo que hace falta para volver:
 *
 * | Marco | Origen | Qué lo mueve |
 * |---|---|---|
 * | `viewport_css` | píxeles CSS de la ventana | scroll y zoom del navegador |
 * | `board_scene` | espacio de la escena del pizarrón | pan y zoom del propio pizarrón |
 * | `capture_pixel` | píxeles de una captura | el DPR con que se capturó |
 * | `normalized` | 0..1 sobre una superficie | nada: es el marco de intercambio |
 *
 * `normalized` es el pivote. Convertir A→B pasando por él evita escribir doce
 * conversiones y, sobre todo, evita que dos de ellas se contradigan.
 *
 * ## Lo que NO hace este módulo
 *
 * No decide **dónde** va una anotación con target semántico: eso lo resuelve el
 * frontend contra el DOM (P-I §8.9.2, «el modelo decide qué, el frontend
 * resuelve dónde»). Esto sólo transforma coordenadas que ya existen, que es el
 * caso de visión sin target lógico.
 *
 * Y no redondea a entero por su cuenta. Redondear es una decisión de
 * presentación; hacerlo aquí rompería la ida y vuelta y la tolerancia dejaría
 * de significar lo que dice.
 */

export const COORDINATE_FRAMES = [
  'viewport_css',
  'board_scene',
  'capture_pixel',
  'normalized',
] as const;
export type CoordinateFrame = (typeof COORDINATE_FRAMES)[number];

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Un punto **con su marco**. Un punto suelto no significa nada. */
export interface FramedPoint extends Point {
  readonly frame: CoordinateFrame;
}

/**
 * Lo que hace falta saber de la superficie para convertir entre marcos.
 *
 * Todo entra por parámetro: este paquete no lee el DOM ni pregunta por el DPR.
 * Que sea dato lo hace probable, y hace que la misma transformación se pueda
 * reproducir en un replay meses después (T-H8-08).
 */
export interface SurfaceGeometry {
  /** Tamaño de la superficie en píxeles CSS. */
  readonly cssWidth: number;
  readonly cssHeight: number;
  /** Desplazamiento del contenido dentro de la superficie, en píxeles CSS. */
  readonly scrollX: number;
  readonly scrollY: number;
  /** Zoom del navegador o del pizarrón. 1 es sin zoom. */
  readonly zoom: number;
  /** `devicePixelRatio` con el que se tomó la captura. */
  readonly devicePixelRatio: number;
  /** Origen de la escena del pizarrón, en píxeles CSS de la superficie. */
  readonly sceneOriginX: number;
  readonly sceneOriginY: number;
}

export class CoordinateError extends Error {
  readonly code: 'INVALID_GEOMETRY' | 'UNKNOWN_FRAME';

  constructor(code: 'INVALID_GEOMETRY' | 'UNKNOWN_FRAME', detail: string) {
    super(detail);
    this.name = 'CoordinateError';
    this.code = code;
  }
}

/**
 * Una geometría con cero o negativos no se «corrige»: lanza.
 *
 * Un `zoom` de 0 haría una división por cero que produce `Infinity`, y un
 * `Infinity` que viaja como coordenada acaba pintando una anotación en un sitio
 * arbitrario en vez de fallar. Vale lo mismo para el DPR y para el tamaño.
 */
export function assertGeometry(geometry: SurfaceGeometry): void {
  const positivos: readonly (readonly [string, number])[] = [
    ['cssWidth', geometry.cssWidth],
    ['cssHeight', geometry.cssHeight],
    ['zoom', geometry.zoom],
    ['devicePixelRatio', geometry.devicePixelRatio],
  ];
  for (const [nombre, valor] of positivos) {
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new CoordinateError(
        'INVALID_GEOMETRY',
        `${nombre} tiene que ser un número finito positivo; llegó ${String(valor)}. Un cero o un ` +
          `infinito aquí no da error más tarde: pinta la anotación en un sitio arbitrario.`,
      );
    }
  }
  for (const [nombre, valor] of [
    ['scrollX', geometry.scrollX],
    ['scrollY', geometry.scrollY],
    ['sceneOriginX', geometry.sceneOriginX],
    ['sceneOriginY', geometry.sceneOriginY],
  ] as const) {
    if (!Number.isFinite(valor)) {
      throw new CoordinateError(
        'INVALID_GEOMETRY',
        `${nombre} tiene que ser finito; llegó ${String(valor)}.`,
      );
    }
  }
}

/** Cualquier marco → `normalized` (0..1 sobre la superficie). */
export function toNormalized(point: FramedPoint, geometry: SurfaceGeometry): FramedPoint {
  assertGeometry(geometry);
  switch (point.frame) {
    case 'normalized':
      return point;

    case 'viewport_css':
      return {
        frame: 'normalized',
        x: (point.x + geometry.scrollX) / (geometry.cssWidth * geometry.zoom),
        y: (point.y + geometry.scrollY) / (geometry.cssHeight * geometry.zoom),
      };

    case 'board_scene':
      return {
        frame: 'normalized',
        x: (point.x * geometry.zoom + geometry.sceneOriginX) / geometry.cssWidth,
        y: (point.y * geometry.zoom + geometry.sceneOriginY) / geometry.cssHeight,
      };

    case 'capture_pixel':
      return {
        frame: 'normalized',
        x: point.x / (geometry.cssWidth * geometry.devicePixelRatio),
        y: point.y / (geometry.cssHeight * geometry.devicePixelRatio),
      };
  }
}

/** `normalized` → cualquier marco. Inversa exacta de `toNormalized`. */
export function fromNormalized(
  point: FramedPoint,
  frame: CoordinateFrame,
  geometry: SurfaceGeometry,
): FramedPoint {
  assertGeometry(geometry);
  if (point.frame !== 'normalized') {
    throw new CoordinateError(
      'UNKNOWN_FRAME',
      `fromNormalized espera un punto en «normalized» y llegó en «${point.frame}».`,
    );
  }
  switch (frame) {
    case 'normalized':
      return point;

    case 'viewport_css':
      return {
        frame,
        x: point.x * geometry.cssWidth * geometry.zoom - geometry.scrollX,
        y: point.y * geometry.cssHeight * geometry.zoom - geometry.scrollY,
      };

    case 'board_scene':
      return {
        frame,
        x: (point.x * geometry.cssWidth - geometry.sceneOriginX) / geometry.zoom,
        y: (point.y * geometry.cssHeight - geometry.sceneOriginY) / geometry.zoom,
      };

    case 'capture_pixel':
      return {
        frame,
        x: point.x * geometry.cssWidth * geometry.devicePixelRatio,
        y: point.y * geometry.cssHeight * geometry.devicePixelRatio,
      };
  }
}

/** Conversión entre dos marcos cualesquiera, pasando por `normalized`. */
export function convert(
  point: FramedPoint,
  target: CoordinateFrame,
  geometry: SurfaceGeometry,
): FramedPoint {
  if (point.frame === target) return point;
  return fromNormalized(toNormalized(point, geometry), target, geometry);
}

/**
 * Tolerancia de la ida y vuelta, en fracción de superficie.
 *
 * **No es una calibración**: es el error de coma flotante que acumulan dos
 * conversiones, no un umbral pedagógico ni perceptivo. `1e-9` sobre una
 * coordenada normalizada es ~1 nanómetro en una pantalla de 1000 px, o sea muy
 * por debajo de cualquier píxel. Si alguna vez hiciera falta un umbral de
 * *precisión visual* —cuándo dos anotaciones se consideran en el mismo sitio—
 * ése sí sería calibración y no éste.
 */
export const ROUNDTRIP_TOLERANCE = 1e-9;

/** ¿La ida y vuelta cae dentro de tolerancia? Lo usa el PBT de `ci:coords:pbt`. */
export function roundTripWithinTolerance(
  point: FramedPoint,
  target: CoordinateFrame,
  geometry: SurfaceGeometry,
  tolerance: number = ROUNDTRIP_TOLERANCE,
): boolean {
  const ida = convert(point, target, geometry);
  const vuelta = convert(ida, point.frame, geometry);
  return (
    Math.abs(vuelta.x - point.x) <= tolerance && Math.abs(vuelta.y - point.y) <= tolerance
  );
}
