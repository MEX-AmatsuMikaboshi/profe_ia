/**
 * Del lienzo de Excalidraw al estado auditable del pizarrón (T-H8-03).
 *
 * `packages/visual-interaction/src/whiteboard.ts` define **qué es** un pizarrón
 * para esta sesión: elementos con `elementId` estable, actor por elemento y
 * referencia obligatoria a actividad y KC. Excalidraw define **cómo se dibuja**.
 * Este módulo es la junta entre los dos, y es el único sitio donde una forma de
 * Excalidraw se convierte en un hecho de la sesión.
 *
 * ## Por qué es un diff y no un volcado
 *
 * Excalidraw entrega el array entero en cada cambio. Guardar ese array como
 * estado sería perder justo lo que la norma pide: «movió el cuadro» y «borró uno
 * y dibujó otro» producirían volcados distintos sin decir cuál ocurrió. Así que
 * aquí se **deriva la operación** comparando con la escena anterior, y la escena
 * nueva sale de `applyBoardOperation()`, que es pura. El `id` de Excalidraw
 * sobrevive a mover, redimensionar y recolorear, que es exactamente la
 * estabilidad que `elementId` exige.
 *
 * ## Los tipos no mapeados **lanzan**
 *
 * `BOARD_ELEMENT_KINDS` es lista cerrada. Un tipo de Excalidraw que no esté en
 * la tabla no se ignora ni se mete en el cajón de `shape`: lanza. Ignorarlo
 * dejaría trazos del alumno fuera de la evidencia sin que nadie se enterase, y
 * meterlo en `shape` registraría un hecho que no ocurrió. La barra de
 * herramientas se restringe a los tipos soportados, así que este punto de fallo
 * sólo se alcanza si alguien la amplía sin ampliar el contrato — que es
 * precisamente cuando conviene enterarse.
 */

import {
  applyBoardOperation,
  type BoardElement,
  type BoardElementKind,
  type BoardOperation,
  type BoardScene,
} from '@profesor-ia/visual-interaction';

/**
 * Lo que este módulo necesita de un elemento de Excalidraw.
 *
 * Se declara aquí en vez de importar sus tipos: el paquete expone una superficie
 * enorme, y depender sólo de estos campos deja claro qué se lee del lienzo. Todo
 * lo demás —estilos, ángulos, agrupaciones— es presentación y no entra en la
 * evidencia.
 */
export interface CanvasElement {
  readonly id: string;
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly isDeleted?: boolean;
  readonly text?: string;
  /** Sube con cada cambio del elemento; Excalidraw la mantiene. */
  readonly version?: number;
}

export type BoardMappingErrorCode = 'TIPO_NO_MAPEADO';

export class BoardMappingError extends Error {
  readonly code: BoardMappingErrorCode;

  constructor(code: BoardMappingErrorCode, detail: string) {
    super(detail);
    this.name = 'BoardMappingError';
    this.code = code;
  }
}

/**
 * Tabla cerrada de correspondencia.
 *
 * `line` y `arrow` caen los dos en `arrow` porque para la evidencia son el mismo
 * hecho —el alumno trazó una conexión— y el contrato no distingue punta.
 */
const KIND_BY_CANVAS_TYPE: Readonly<Record<string, BoardElementKind>> = Object.freeze({
  text: 'text',
  freedraw: 'freedraw',
  arrow: 'arrow',
  line: 'arrow',
  rectangle: 'shape',
  ellipse: 'shape',
  diamond: 'shape',
  image: 'image',
});

/** Los tipos que la barra de herramientas puede ofrecer sin romper el contrato. */
export const SUPPORTED_CANVAS_TYPES: readonly string[] = Object.freeze(
  Object.keys(KIND_BY_CANVAS_TYPE),
);

export function boardKindOf(canvasType: string): BoardElementKind {
  const kind = KIND_BY_CANVAS_TYPE[canvasType];
  if (kind === undefined) {
    throw new BoardMappingError(
      'TIPO_NO_MAPEADO',
      `El lienzo produjo un elemento «${canvasType}», que no está en BOARD_ELEMENT_KINDS. ` +
        `Los mapeados son ${SUPPORTED_CANVAS_TYPES.join(', ')}. Ampliar la barra de herramientas ` +
        'exige ampliar antes el contrato de `visual-interaction`: registrar el trazo como ' +
        '`shape` diría que el alumno dibujó algo que no dibujó, e ignorarlo lo dejaría fuera de ' +
        'la evidencia sin aviso.',
    );
  }
  return kind;
}

export interface BoardBinding {
  /** A qué actividad y KC pertenece todo lo que se dibuje en esta sesión. */
  readonly activityId: string;
  readonly kcId: string;
}

function toBoardElement(element: CanvasElement, binding: BoardBinding): BoardElement {
  // `exactOptionalPropertyTypes`: `text` se omite, no se pone en `undefined`.
  const texto = element.text;
  return {
    elementId: element.id,
    kind: boardKindOf(element.type),
    actor: 'student',
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    activityId: binding.activityId,
    kcId: binding.kcId,
    ...(texto === undefined ? {} : { text: texto }),
  };
}

/** Los campos que un `update` puede cambiar. El actor y el id nunca están. */
function cambiosEntre(
  anterior: BoardElement,
  actual: BoardElement,
): Partial<Omit<BoardElement, 'elementId' | 'actor'>> {
  const cambios: Record<string, unknown> = {};
  if (anterior.x !== actual.x) cambios['x'] = actual.x;
  if (anterior.y !== actual.y) cambios['y'] = actual.y;
  if (anterior.width !== actual.width) cambios['width'] = actual.width;
  if (anterior.height !== actual.height) cambios['height'] = actual.height;
  if (anterior.text !== actual.text && actual.text !== undefined) cambios['text'] = actual.text;
  // El tipo puede cambiar sin que el elemento deje de ser el mismo: Excalidraw
  // conserva el `id` al convertir una forma. Si cambiara y no se registrase, la
  // escena reconstruida tendría un elemento de otra clase que el vivo.
  if (anterior.kind !== actual.kind) cambios['kind'] = actual.kind;
  return cambios as Partial<Omit<BoardElement, 'elementId' | 'actor'>>;
}

/**
 * Deriva las operaciones que llevan de `scene` al lienzo `elements`.
 *
 * El orden es borrados, altas y cambios. No es estético: aplicar un alta cuyo id
 * coincide con uno borrado en el mismo lote fallaría con `ELEMENTO_DUPLICADO` si
 * el borrado fuese después.
 */
export function diffBoardOperations(
  scene: BoardScene,
  elements: readonly CanvasElement[],
  binding: BoardBinding,
): readonly BoardOperation[] {
  const vivos = elements.filter((element) => element.isDeleted !== true);
  const porId = new Map(vivos.map((element) => [element.id, element]));
  const operaciones: BoardOperation[] = [];

  for (const elementId of scene.elements.keys()) {
    if (!porId.has(elementId)) operaciones.push({ op: 'delete', elementId });
  }

  for (const element of vivos) {
    const actual = toBoardElement(element, binding);
    const anterior = scene.elements.get(element.id);
    if (anterior === undefined) {
      operaciones.push({ op: 'create', element: actual });
      continue;
    }
    const changes = cambiosEntre(anterior, actual);
    if (Object.keys(changes).length > 0) {
      operaciones.push({ op: 'update', elementId: element.id, changes });
    }
  }

  return operaciones;
}

/**
 * Aplica el lote y devuelve la escena nueva más lo aplicado.
 *
 * Devuelve las operaciones además de la escena porque son ellas —no la escena—
 * lo que va al ledger: la escena es reconstruible desde ellas con
 * `replayBoard()`, y al revés no.
 */
export function advanceScene(
  scene: BoardScene,
  elements: readonly CanvasElement[],
  binding: BoardBinding,
): { readonly scene: BoardScene; readonly operations: readonly BoardOperation[] } {
  const operations = diffBoardOperations(scene, elements, binding);
  let siguiente = scene;
  for (const operation of operations) siguiente = applyBoardOperation(siguiente, operation);
  return { scene: siguiente, operations };
}
