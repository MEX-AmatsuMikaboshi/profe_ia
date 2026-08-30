import { describe, expect, it } from 'vitest';

import { emptyScene, replayBoard, studentElements } from '@profesor-ia/visual-interaction';

import {
  BoardMappingError,
  SUPPORTED_CANVAS_TYPES,
  advanceScene,
  boardKindOf,
  diffBoardOperations,
  type CanvasElement,
} from '../src/clase/board-scene';

const BINDING = { activityId: 'act-kc06-1', kcId: 'KC04' } as const;

function elemento(overrides: Partial<CanvasElement> & { id: string }): CanvasElement {
  return { type: 'rectangle', x: 0, y: 0, width: 10, height: 10, ...overrides };
}

describe('T-H8-03 — del lienzo al estado auditable', () => {
  it('mapea cada tipo soportado a su clase del contrato', () => {
    expect(boardKindOf('text')).toBe('text');
    expect(boardKindOf('freedraw')).toBe('freedraw');
    expect(boardKindOf('image')).toBe('image');
    // Flecha y línea son el mismo hecho para la evidencia: el alumno trazó una
    // conexión. El contrato no distingue punta.
    expect(boardKindOf('arrow')).toBe('arrow');
    expect(boardKindOf('line')).toBe('arrow');
    for (const forma of ['rectangle', 'ellipse', 'diamond']) {
      expect(boardKindOf(forma)).toBe('shape');
    }
  });

  it('un tipo no mapeado LANZA en vez de caer en `shape` o desaparecer', () => {
    // Excalidraw ofrece marcos, incrustados y láser. Meterlos en `shape`
    // registraría un hecho que no ocurrió; ignorarlos dejaría trazos del alumno
    // fuera de la evidencia sin aviso. Las dos son peores que fallar.
    for (const tipo of ['frame', 'embeddable', 'magicframe', 'iframe']) {
      expect(() => boardKindOf(tipo)).toThrow(BoardMappingError);
      expect(() => boardKindOf(tipo)).toThrow(/TIPO_NO_MAPEADO|no está en BOARD_ELEMENT_KINDS/u);
    }
  });

  it('el mensaje nombra la herramienta y los tipos que sí valen', () => {
    // Un código opaco obligaría a leer el código fuente para saber qué se
    // dibujó, justo cuando lo que hay que decidir es si ampliar el contrato.
    let mensaje = '';
    try {
      boardKindOf('frame');
    } catch (error) {
      mensaje = error instanceof Error ? error.message : String(error);
    }
    expect(mensaje).toContain('frame');
    for (const tipo of SUPPORTED_CANVAS_TYPES) expect(mensaje).toContain(tipo);
  });

  it('un elemento nuevo produce `create` con actor y referencia obligatorios', () => {
    const ops = diffBoardOperations(emptyScene(), [elemento({ id: 'e1' })], BINDING);
    expect(ops).toHaveLength(1);
    const [op] = ops;
    expect(op?.op).toBe('create');
    if (op?.op !== 'create') throw new Error('rama imposible');
    expect(op.element).toMatchObject({
      elementId: 'e1',
      kind: 'shape',
      actor: 'student',
      activityId: 'act-kc06-1',
      kcId: 'KC04',
    });
  });

  it('mover un elemento es `update`, NO borrar y crear', () => {
    // Es la propiedad que el contrato pide: sin `elementId` estable, «movió el
    // cuadro» y «borró uno y dibujó otro» serían el mismo par de eventos, y una
    // anotación que apunte al elemento quedaría colgada en cuanto lo tocara.
    const primera = advanceScene(emptyScene(), [elemento({ id: 'e1' })], BINDING);
    const segunda = advanceScene(
      primera.scene,
      [elemento({ id: 'e1', x: 120, y: 40 })],
      BINDING,
    );
    expect(segunda.operations).toHaveLength(1);
    const [op] = segunda.operations;
    expect(op?.op).toBe('update');
    if (op?.op !== 'update') throw new Error('rama imposible');
    expect(op.elementId).toBe('e1');
    expect(op.changes).toStrictEqual({ x: 120, y: 40 });
    expect(segunda.scene.elements.get('e1')?.elementId).toBe('e1');
  });

  it('un cambio que no cambia nada no produce operación', () => {
    // Excalidraw notifica en cada movimiento del ratón. Emitir un `update` por
    // notificación llenaría el ledger de hechos que no ocurrieron.
    const primera = advanceScene(emptyScene(), [elemento({ id: 'e1' })], BINDING);
    const segunda = advanceScene(primera.scene, [elemento({ id: 'e1' })], BINDING);
    expect(segunda.operations).toStrictEqual([]);
    expect(segunda.scene.revision).toBe(primera.scene.revision);
  });

  it('`isDeleted` produce `delete`, y desaparecer del array también', () => {
    const primera = advanceScene(
      emptyScene(),
      [elemento({ id: 'e1' }), elemento({ id: 'e2' })],
      BINDING,
    );

    const porBandera = diffBoardOperations(
      primera.scene,
      [elemento({ id: 'e1' }), elemento({ id: 'e2', isDeleted: true })],
      BINDING,
    );
    expect(porBandera).toStrictEqual([{ op: 'delete', elementId: 'e2' }]);

    const porAusencia = diffBoardOperations(primera.scene, [elemento({ id: 'e1' })], BINDING);
    expect(porAusencia).toStrictEqual([{ op: 'delete', elementId: 'e2' }]);
  });

  it('los borrados van antes que las altas en el mismo lote', () => {
    // Un alta cuyo id coincide con uno borrado fallaría con ELEMENTO_DUPLICADO
    // si el borrado fuese después. No es estético: es que el lote no aplicaría.
    const primera = advanceScene(emptyScene(), [elemento({ id: 'e1' })], BINDING);
    const ops = diffBoardOperations(primera.scene, [elemento({ id: 'e2' })], BINDING);
    expect(ops[0]?.op).toBe('delete');
    expect(ops[1]?.op).toBe('create');
    expect(() => advanceScene(primera.scene, [elemento({ id: 'e2' })], BINDING)).not.toThrow();
  });

  it('el texto entra cuando lo hay y se omite cuando no', () => {
    // `exactOptionalPropertyTypes`: `text: undefined` no es lo mismo que ausente.
    const conTexto = advanceScene(
      emptyScene(),
      [elemento({ id: 'e1', type: 'text', text: 'A∧B' })],
      BINDING,
    );
    expect(conTexto.scene.elements.get('e1')?.text).toBe('A∧B');

    const sinTexto = advanceScene(emptyScene(), [elemento({ id: 'e2' })], BINDING);
    expect(Object.hasOwn(sinTexto.scene.elements.get('e2') ?? {}, 'text')).toBe(false);
  });

  it('la escena se reconstruye desde las operaciones, que es lo que va al ledger', () => {
    // `replayBoard()` sobre lo emitido tiene que dar la misma escena que el
    // estado en vivo. Si divergieran, el replay contaría una clase distinta de
    // la que hubo — y es el defecto clásico de un editor con historial.
    const emitidas = [];
    let escena = emptyScene();

    for (const lienzo of [
      [elemento({ id: 'e1' })],
      [elemento({ id: 'e1', x: 50 }), elemento({ id: 'e2', type: 'freedraw' })],
      [elemento({ id: 'e2', type: 'freedraw', width: 99 })],
    ]) {
      const paso = advanceScene(escena, lienzo, BINDING);
      escena = paso.scene;
      emitidas.push(...paso.operations);
    }

    const reconstruida = replayBoard(emitidas);
    expect([...reconstruida.elements.keys()].sort()).toStrictEqual(
      [...escena.elements.keys()].sort(),
    );
    expect(reconstruida.elements.get('e2')).toStrictEqual(escena.elements.get('e2'));
    expect(studentElements(reconstruida)).toHaveLength(1);
  });

  it('`advanceScene` no muta la escena que recibe', () => {
    const antes = advanceScene(emptyScene(), [elemento({ id: 'e1' })], BINDING).scene;
    const revisionAntes = antes.revision;
    advanceScene(antes, [elemento({ id: 'e1' }), elemento({ id: 'e2' })], BINDING);
    expect(antes.revision).toBe(revisionAntes);
    expect(antes.elements.has('e2')).toBe(false);
  });
});
