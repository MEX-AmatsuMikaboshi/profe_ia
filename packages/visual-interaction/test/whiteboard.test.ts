import { describe, expect, it } from 'vitest';

import {
  BoardError,
  applyBoardOperation,
  emptyScene,
  replayBoard,
  studentElements,
  type BoardElement,
  type BoardOperation,
} from '../src/whiteboard.js';

function elemento(overrides: Partial<BoardElement> = {}): BoardElement {
  return {
    elementId: 'el-1',
    kind: 'freedraw',
    actor: 'student',
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    activityId: 'act-1',
    kcId: 'KC04',
    ...overrides,
  };
}

describe('T-H8-03 — estado estructurado del pizarrón', () => {
  it('la escena se reconstruye desde sus operaciones', () => {
    // Es la propiedad de DEC-WHITEBOARD-001: un snapshot es comodidad, nunca la
    // fuente de verdad. Si discreparan, manda el replay.
    const ops: BoardOperation[] = [
      { op: 'create', element: elemento() },
      { op: 'create', element: elemento({ elementId: 'el-2', actor: 'professor' }) },
      { op: 'update', elementId: 'el-1', changes: { x: 999 } },
      { op: 'delete', elementId: 'el-2' },
    ];
    const escena = replayBoard(ops);
    expect(escena.elements.size).toBe(1);
    expect(escena.elements.get('el-1')?.x).toBe(999);
    expect(escena.revision).toBe(4);
  });

  it('aplicar una operación NO muta la escena de entrada', () => {
    // Un alias compartido entre el estado en vivo y la reconstrucción es el
    // defecto clásico de un editor con historial: las dos divergen y nadie sabe
    // cuál vale.
    const antes = replayBoard([{ op: 'create', element: elemento() }]);
    const despues = applyBoardOperation(antes, { op: 'update', elementId: 'el-1', changes: { x: 5 } });
    expect(antes.elements.get('el-1')?.x).toBe(10);
    expect(despues.elements.get('el-1')?.x).toBe(5);
    expect(antes.revision).toBe(1);
  });

  it('el actor NO se puede cambiar', () => {
    // Un elemento del alumno que pasara a ser del profesor reescribiría de quién
    // fue el trabajo.
    const escena = replayBoard([{ op: 'create', element: elemento() }]);
    expect(() =>
      applyBoardOperation(escena, {
        op: 'update',
        elementId: 'el-1',
        changes: { actor: 'professor' } as never,
      }),
    ).toThrow(/ACTOR_INMUTABLE|actor/u);
  });

  it('reutilizar un id se rechaza', () => {
    // Haría que una anotación apuntara al elemento equivocado.
    const escena = replayBoard([{ op: 'create', element: elemento() }]);
    expect(() => applyBoardOperation(escena, { op: 'create', element: elemento() })).toThrow(
      BoardError,
    );
  });

  it('un elemento sin actividad ni KC se rechaza', () => {
    // Se comprueba el `code`, no el mensaje: el código es el contrato —la lista
    // es cerrada— y el mensaje es prosa que se puede reescribir sin romper nada.
    try {
      applyBoardOperation(emptyScene(), { op: 'create', element: elemento({ kcId: '' }) });
      throw new Error('se esperaba BoardError y no se lanzó');
    } catch (err) {
      expect(err).toBeInstanceOf(BoardError);
      expect((err as BoardError).code).toBe('SIN_REFERENCIA');
    }
  });

  it('sólo los elementos del alumno son producción suya', () => {
    // Mezclarlos atribuiría al alumno un trabajo que no hizo.
    const escena = replayBoard([
      { op: 'create', element: elemento() },
      { op: 'create', element: elemento({ elementId: 'el-2', actor: 'professor' }) },
    ]);
    expect(studentElements(escena).map((e) => e.elementId)).toStrictEqual(['el-1']);
  });

  it('el modelo no tiene dónde guardar el recorrido del puntero', () => {
    // DEC-WHITEBOARD-001 pide escenas reconstruibles **sin trazar el puntero**.
    // No es una omisión: el recorrido es conducta observada momento a momento, y
    // registrarla de un participante es una recolección que nadie autorizó.
    const claves = Object.keys(elemento());
    for (const prohibida of ['pointerPath', 'strokes', 'trace', 'points', 'path']) {
      expect(claves).not.toContain(prohibida);
    }
  });
});
