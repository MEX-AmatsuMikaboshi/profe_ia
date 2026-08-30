/**
 * Estado estructurado del pizarrón (T-H8-03 ← `DEC-WHITEBOARD-001`, P-I §8.9.1).
 *
 * ## Qué es y qué no es
 *
 * Esto es el **adaptador de estado**: el modelo de datos del pizarrón, sus
 * operaciones y la reconstrucción desde ellas. **No** monta Excalidraw en la
 * vista — eso es integración de UI y queda pendiente, declarado en
 * `PLAN_STATUS.md`. Lo que se construye aquí es lo que hace falta antes: que el
 * pizarrón produzca **estado** y no sólo píxeles.
 *
 * ## La decisión que ordena el modelo: sin trazar el puntero
 *
 * `DEC-WHITEBOARD-001` pide escenas «reconstruibles **sin trazar el puntero**».
 * O sea: se registra que un elemento existe, dónde y de quién es — **no** el
 * recorrido del ratón que lo creó. Dos razones, y la segunda pesa más:
 *
 * 1. El recorrido es enorme y no aporta: para reconstruir la escena basta el
 *    resultado.
 * 2. El recorrido del puntero es **conducta observada momento a momento**, y
 *    registrar eso de un participante es una recolección que nadie autorizó.
 *
 * ## IDs estables
 *
 * Un elemento conserva su `elementId` mientras exista, aunque se mueva, se
 * redimensione o cambie de color. Sin eso, «el alumno movió el cuadro» y «el
 * alumno borró un cuadro y dibujó otro» serían el mismo par de eventos, y una
 * anotación que apunte al elemento se quedaría colgada en cuanto lo tocara.
 */

export const BOARD_ELEMENT_KINDS = [
  'text',
  'freedraw',
  'arrow',
  'shape',
  'image',
] as const;
export type BoardElementKind = (typeof BOARD_ELEMENT_KINDS)[number];

/** Quién puso el elemento. Un elemento sin actor no es auditable. */
export const BOARD_ACTORS = ['student', 'professor'] as const;
export type BoardActor = (typeof BOARD_ACTORS)[number];

export interface BoardElement {
  readonly elementId: string;
  readonly kind: BoardElementKind;
  readonly actor: BoardActor;
  /** Posición en el espacio de la escena, no en píxeles de pantalla. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Contenido textual del elemento, si lo tiene. */
  readonly text?: string;
  /**
   * A qué actividad y KC pertenece. Obligatorio: un elemento sin referencia no
   * se puede relacionar con nada de la sesión, y entonces sólo es un dibujo.
   */
  readonly activityId: string;
  readonly kcId: string;
}

export type BoardOperation =
  | { readonly op: 'create'; readonly element: BoardElement }
  | {
      readonly op: 'update';
      readonly elementId: string;
      readonly changes: Partial<Omit<BoardElement, 'elementId' | 'actor'>>;
    }
  | { readonly op: 'delete'; readonly elementId: string };

export type BoardErrorCode =
  | 'ELEMENTO_DUPLICADO'
  | 'ELEMENTO_INEXISTENTE'
  | 'ACTOR_INMUTABLE'
  | 'SIN_REFERENCIA';

export class BoardError extends Error {
  readonly code: BoardErrorCode;

  constructor(code: BoardErrorCode, detail: string) {
    super(detail);
    this.name = 'BoardError';
    this.code = code;
  }
}

export interface BoardScene {
  readonly elements: ReadonlyMap<string, BoardElement>;
  /** Sube con cada operación aplicada. Es la revisión que usan las anotaciones. */
  readonly revision: number;
}

export function emptyScene(): BoardScene {
  return { elements: new Map(), revision: 0 };
}

/**
 * Aplica una operación y devuelve la escena nueva.
 *
 * Es **pura**: no muta la escena que recibe. Así una reconstrucción desde
 * eventos y el estado en vivo no pueden divergir por un alias compartido, que
 * es el defecto clásico de un editor con historial.
 */
export function applyBoardOperation(scene: BoardScene, operation: BoardOperation): BoardScene {
  const elementos = new Map(scene.elements);

  switch (operation.op) {
    case 'create': {
      if (elementos.has(operation.element.elementId)) {
        throw new BoardError(
          'ELEMENTO_DUPLICADO',
          `el elemento ${operation.element.elementId} ya existe. Reutilizar un id haría que una ` +
            `anotación apuntara al elemento equivocado.`,
        );
      }
      if (operation.element.activityId === '' || operation.element.kcId === '') {
        throw new BoardError(
          'SIN_REFERENCIA',
          `el elemento ${operation.element.elementId} no referencia actividad ni KC. Sin eso no ` +
            `se puede relacionar con nada de la sesión, y entonces sólo es un dibujo.`,
        );
      }
      elementos.set(operation.element.elementId, operation.element);
      break;
    }

    case 'update': {
      const actual = elementos.get(operation.elementId);
      if (actual === undefined) {
        throw new BoardError(
          'ELEMENTO_INEXISTENTE',
          `no hay elemento ${operation.elementId} que actualizar.`,
        );
      }
      // El actor **no** se puede cambiar: un elemento del alumno que pasara a
      // ser del profesor reescribiría de quién fue el trabajo.
      if ('actor' in operation.changes) {
        throw new BoardError(
          'ACTOR_INMUTABLE',
          `el actor de ${operation.elementId} no se puede cambiar: reescribiría de quién fue el ` +
            `trabajo.`,
        );
      }
      elementos.set(operation.elementId, { ...actual, ...operation.changes });
      break;
    }

    case 'delete': {
      if (!elementos.has(operation.elementId)) {
        throw new BoardError(
          'ELEMENTO_INEXISTENTE',
          `no hay elemento ${operation.elementId} que borrar.`,
        );
      }
      elementos.delete(operation.elementId);
      break;
    }
  }

  return { elements: elementos, revision: scene.revision + 1 };
}

/**
 * Reconstruye una escena desde sus operaciones.
 *
 * Es la propiedad que `DEC-WHITEBOARD-001` pide: la escena **es** el resultado
 * de sus operaciones, y por eso un `board.scene.snapshot` es una comodidad —para
 * no reproducir mil operaciones— y nunca la fuente de verdad. Si el snapshot y
 * el replay discreparan, manda el replay.
 */
export function replayBoard(operations: readonly BoardOperation[]): BoardScene {
  return operations.reduce(applyBoardOperation, emptyScene());
}

/**
 * Elementos que el **alumno** puso, que es lo único que puede ser evidencia de
 * su trabajo. Lo que dibujó el profesor es material, no producción del alumno, y
 * mezclarlos atribuiría al alumno un trabajo que no hizo.
 */
export function studentElements(scene: BoardScene): readonly BoardElement[] {
  return [...scene.elements.values()].filter((e) => e.actor === 'student');
}
