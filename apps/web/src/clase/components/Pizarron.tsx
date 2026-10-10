'use client';

import dynamic from 'next/dynamic';
import { useCallback, useRef, useState } from 'react';

import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

import {
  emptyScene,
  type BoardElement,
  type BoardOperation,
  type BoardScene,
} from '@profesor-ia/visual-interaction';

import {
  BoardMappingError,
  advanceScene,
  type BoardBinding,
  type CanvasElement,
} from '../board-scene';
import { CLASE_COPY } from '../copy';

/**
 * Pizarrón de la sesión (T-H8-03 ← P-I §8.9).
 *
 * Excalidraw sólo puede montarse en el cliente: toca `window` al cargar el
 * módulo, así que entra por `next/dynamic` con `ssr: false`. Si se importara
 * normalmente, el render del servidor de la vista de Clase reventaría entero por
 * una superficie secundaria.
 *
 * ## Lo que este componente sostiene
 *
 * El lienzo dibuja; la evidencia la lleva `BoardScene`. Cada cambio se traduce a
 * operaciones con `advanceScene()` y se sube por `onOperations`, que es lo que
 * acabará en el ledger. La escena vive en un `ref` y no en un `state` porque el
 * diff necesita el valor **anterior** en el mismo tick en que Excalidraw
 * notifica: con `state` se compararía contra una escena ya rendida y se
 * perderían operaciones.
 *
 * ## Una herramienta no soportada se dice, no se traga
 *
 * Excalidraw ofrece marcos, incrustados y láser, que `BOARD_ELEMENT_KINDS` no
 * tiene. `advanceScene()` lanza ante uno de ellos —lista cerrada— y aquí se
 * atrapa para **no tumbar la clase**, pero el aviso sale en pantalla nombrando
 * la herramienta. Tragárselo dejaría trazos del alumno fuera de la evidencia sin
 * que nadie se enterase, que es el fallo silencioso que este repositorio
 * persigue; reventar la vista por dibujar un marco sería peor remedio que
 * enfermedad.
 */

const Excalidraw = dynamic(
  async () => (await import('@excalidraw/excalidraw')).Excalidraw,
  {
    ssr: false,
    loading: () => <p data-testid="pizarron-cargando">{CLASE_COPY.board.loading}</p>,
  },
);

/**
 * Cómo se anuncia un elemento.
 *
 * Posición redondeada y en el espacio de la escena, no en píxeles de pantalla:
 * anunciar «x 412.7318» no ayuda a nadie, y anunciar píxeles de pantalla daría
 * una posición distinta con otro zoom para el mismo elemento.
 */
function describirElemento(elemento: BoardElement): string {
  const que = CLASE_COPY.board.kinds[elemento.kind];
  const quien =
    elemento.actor === 'student' ? CLASE_COPY.board.actorStudent : CLASE_COPY.board.actorProfessor;
  const donde = `x ${String(Math.round(elemento.x))}, y ${String(Math.round(elemento.y))}`;
  const texto = elemento.text === undefined ? '' : `, con el texto «${elemento.text}»`;
  return `${que} de ${quien}, en ${donde}${texto}.`;
}

/** Lo que se puede insertar sin arrastrar. */
const INSERTABLES = ['rectangle', 'ellipse', 'arrow'] as const;
type Insertable = (typeof INSERTABLES)[number];

export interface PizarronProps {
  readonly binding: BoardBinding;
  /**
   * Recibe el lote aplicado. No recibe la escena: la escena se reconstruye
   * desde las operaciones con `replayBoard()`, y al revés no se puede.
   */
  readonly onOperations?: (operations: readonly BoardOperation[], scene: BoardScene) => void;
}

export function Pizarron({ binding, onOperations }: PizarronProps) {
  const escena = useRef<BoardScene>(emptyScene());
  const [elementosNoSoportados, setElementosNoSoportados] = useState<readonly string[]>([]);
  const [revision, setRevision] = useState(0);
  /**
   * Espejo accesible de la escena.
   *
   * Excalidraw dibuja en `<canvas>`: sus elementos **no existen en el DOM**, así
   * que un lector de pantalla no encuentra nada que leer y el criterio
   * CRIT-ESCENA-DOM no puede cumplirse con el lienzo solo. No es un defecto de
   * Excalidraw —es lo que un canvas es—, y por eso la alternativa accesible la
   * pone la aplicación.
   *
   * Se puede porque el estado auditable ya existe: `BoardScene` tiene los
   * elementos con su clase, su actor y su posición, que es justo lo que hay que
   * anunciar. El lienzo es la presentación; esta lista es el equivalente.
   */
  const [elementos, setElementos] = useState<readonly BoardElement[]>([]);
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  const [textoNuevo, setTextoNuevo] = useState('');

  /**
   * Inserción sin arrastre (WCAG 2.5.7).
   *
   * Excalidraw dibuja arrastrando, y para el trazo a mano alzada eso es
   * **esencial**: la excepción del criterio lo cubre, porque un trazo libre no
   * se puede describir con un solo clic sin dejar de ser un trazo libre. Pero
   * colocar una forma, una flecha o un texto **no** es esencialmente arrastre, y
   * ahí el criterio no admite excepción: hace falta la alternativa. Es esta.
   *
   * Se inserta en el centro de lo que se está viendo, no en un punto fijo de la
   * escena: con la vista desplazada, un origen fijo dejaría el elemento fuera de
   * la pantalla y parecería que el botón no hizo nada.
   */
  const insertar = useCallback(async (que: Insertable | 'text', texto?: string) => {
    const actual = api.current;
    if (actual === null) return;
    const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw');
    const estado = actual.getAppState();
    const zoom = estado.zoom.value === 0 ? 1 : estado.zoom.value;
    const centroX = -estado.scrollX + estado.width / 2 / zoom;
    const centroY = -estado.scrollY + estado.height / 2 / zoom;
    const base = { x: Math.round(centroX - 60), y: Math.round(centroY - 40) };

    const esqueleto =
      que === 'text'
        ? { type: 'text' as const, ...base, text: texto ?? '' }
        : { type: que, ...base, width: 120, height: 80 };

    const nuevos = convertToExcalidrawElements([esqueleto]);
    actual.updateScene({ elements: [...actual.getSceneElements(), ...nuevos] });
  }, []);

  const alCambiar = useCallback(
    (elements: readonly CanvasElement[]) => {
      try {
        const { scene, operations } = advanceScene(escena.current, elements, binding);
        escena.current = scene;
        if (operations.length > 0) {
          setRevision(scene.revision);
          setElementos([...scene.elements.values()]);
          onOperations?.(operations, scene);
        }
        if (elementosNoSoportados.length > 0) setElementosNoSoportados([]);
      } catch (error) {
        if (!(error instanceof BoardMappingError)) throw error;
        // El tipo va en el mensaje; se muestra tal cual para que el aviso nombre
        // la herramienta y no un código opaco.
        setElementosNoSoportados((previos) =>
          previos.includes(error.message) ? previos : [...previos, error.message],
        );
      }
    },
    [binding, elementosNoSoportados.length, onOperations],
  );

  return (
    <section
      className="card clase-pizarron"
      aria-label={CLASE_COPY.board.title}
      data-testid="pizarron"
      data-revision={String(revision)}
    >
      <header className="clase-pizarron-encabezado">
        <h2 className="card-title">{CLASE_COPY.board.title}</h2>
        <p className="clase-pizarron-nota">{CLASE_COPY.board.notice}</p>
      </header>

      {elementosNoSoportados.length > 0 ? (
        <p role="alert" data-testid="pizarron-no-soportado">
          {CLASE_COPY.board.unsupported}
          {elementosNoSoportados.map((mensaje) => (
            <span key={mensaje}> {mensaje}</span>
          ))}
        </p>
      ) : null}

      {/* WCAG 2.5.7: toda función que use arrastre necesita alternativa de un
          solo puntero, salvo que el arrastre sea esencial. Colocar una forma no
          lo es; el trazo a mano alzada sí, y por eso no está aquí. */}
      <div className="clase-pizarron-sin-arrastre" data-testid="pizarron-sin-arrastre">
        <p className="clase-pizarron-nota" id="pizarron-sin-arrastre-ayuda">
          {CLASE_COPY.board.noDragHelp}
        </p>
        {INSERTABLES.map((que) => (
          <button
            key={que}
            className="btn btn-secondary"
            type="button"
            data-testid={`pizarron-insertar-${que}`}
            aria-describedby="pizarron-sin-arrastre-ayuda"
            onClick={() => void insertar(que)}
          >
            {CLASE_COPY.board.insert[que]}
          </button>
        ))}
        <label className="field" htmlFor="pizarron-texto">
          {CLASE_COPY.board.insert.textLabel}
        </label>
        <input
          className="input"
          id="pizarron-texto"
          data-testid="pizarron-texto"
          value={textoNuevo}
          onChange={(e) => setTextoNuevo(e.target.value)}
        />
        <button
          className="btn btn-secondary"
          type="button"
          data-testid="pizarron-insertar-text"
          disabled={textoNuevo.trim() === ''}
          onClick={() => {
            void insertar('text', textoNuevo.trim());
            setTextoNuevo('');
          }}
        >
          {CLASE_COPY.board.insert.text}
        </button>
      </div>

      {/* El equivalente accesible de lo que hay en el lienzo. `aria-live` en
          `polite` y no `assertive`: se anuncia al terminar un trazo, sin cortar
          lo que el lector esté diciendo. */}
      <ul
        className="clase-pizarron-escena"
        data-testid="pizarron-escena"
        data-elementos={String(elementos.length)}
        aria-live="polite"
        aria-label={CLASE_COPY.board.sceneLabel}
      >
        {elementos.length === 0 ? (
          <li>{CLASE_COPY.board.sceneEmpty}</li>
        ) : (
          elementos.map((elemento) => (
            <li key={elemento.elementId} data-kind={elemento.kind} data-actor={elemento.actor}>
              {describirElemento(elemento)}
            </li>
          ))
        )}
      </ul>

      <div className="clase-pizarron-lienzo">
        <Excalidraw
          excalidrawAPI={(instancia: ExcalidrawImperativeAPI) => {
            api.current = instancia;
          }}
          langCode="es-ES"
          onChange={(elements: readonly CanvasElement[]) => alCambiar(elements)}
          UIOptions={{
            canvasActions: {
              // La sesión es la unidad de evidencia: cargar un `.excalidraw`
              // ajeno metería elementos sin actor ni referencia, y exportar o
              // publicar un enlace saca material de la sesión fuera de ella.
              loadScene: false,
              saveToActiveFile: false,
              export: false,
              saveAsImage: false,
              toggleTheme: false,
            },
          }}
        />
      </div>
    </section>
  );
}
