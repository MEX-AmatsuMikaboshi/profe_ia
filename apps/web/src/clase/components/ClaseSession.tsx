'use client';

import { useMemo, useRef, useState } from 'react';

import type { BoardOperation } from '@profesor-ia/visual-interaction';

import {
  DRY_SESSION_BLOCK_ID,
  drySessionDocument,
  drySessionViewInput,
} from '../dry-session';
import {
  appendLine,
  commitEdit,
  initialHistory,
  redo,
  toProofInput,
  undo,
  updateLine,
  type FitchEditorHistory,
} from '../fitch-document';
import { reviewFitchDocument } from '../local-review';
import {
  createHttpVerdictPort,
  submitForVerdict,
  type FetchLike,
  type SubmissionState,
} from '../verdict';
import { createHttpTurnPort } from '../turn';
import { buildClaseViewModel, type SaveState } from '../view-model';
import { ClaseView } from './ClaseView';
import { FitchEditor } from './FitchEditor';
import { Pizarron } from './Pizarron';
import { ProfesorPanel } from './ProfesorPanel';

/**
 * Sesión seca de Clase en el cliente (T-H6-13).
 *
 * Aquí vive lo interactivo: documento, historial, cursor, estado de guardado y
 * envío. Lo que **no** vive aquí es ninguna decisión pedagógica ni ningún
 * veredicto: el modelo de vista se deriva del estado de sesión y el veredicto se
 * pide al servidor.
 */

/** Adapta `fetch` al puerto sin recurrir a `any` (la regla de lint lo prohíbe). */
const browserFetch: FetchLike = async (input, init) => {
  const response = await fetch(input, init);
  return { ok: response.ok, status: response.status, json: () => response.json() };
};

export function ClaseSession() {
  const input = useMemo(() => drySessionViewInput(), []);
  const [history, setHistory] = useState<FitchEditorHistory>(() =>
    initialHistory(drySessionDocument()),
  );
  const [cursorLineId, setCursorLineId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(input.saveState);
  const [submission, setSubmission] = useState<SubmissionState>({ kind: 'inactivo' });
  /**
   * Las operaciones del pizarrón, en orden.
   *
   * Se acumulan aquí y **todavía no se emiten**: los emisores de las cinco
   * familias de `T-H8-08` piden el canal de evidencia, y la sesión seca no
   * escribe ledger. Guardarlas en vez de descartarlas conserva el orden
   * —`replayBoard()` reconstruye la escena desde esta lista, y no al revés—
   * para cuando el canal exista.
   *
   * Va en `ref` y no en `state` porque nada de la vista depende de ellas
   * todavía: un `state` forzaría un render por trazo para pintar lo mismo. La
   * señal observable de que el pizarrón produce estado auditable es
   * `data-revision` del propio pizarrón.
   */
  const boardOps = useRef<BoardOperation[]>([]);

  const review = useMemo(
    () =>
      reviewFitchDocument(
        history.present,
        cursorLineId === null ? {} : { cursorLineId },
      ),
    [history, cursorLineId],
  );

  const viewModel = useMemo(
    () => buildClaseViewModel({ ...input, saveState }),
    [input, saveState],
  );

  const edit = (next: Parameters<typeof commitEdit>[1]): void => {
    setHistory((current) => commitEdit(current, next));
    // Editar deja el documento sin guardar. No se marca «guardado» hasta que
    // alguien confirme que lo está.
    setSaveState({ kind: 'cambios_sin_guardar' });
  };

  const insertSymbol = (symbol: string): void => {
    const last = history.present.lines[history.present.lines.length - 1];
    if (last === undefined) {
      edit(appendLine(history.present, { formula: symbol, rule: '', depth: 0 }));
      return;
    }
    edit(updateLine(history.present, last.lineId, { formula: `${last.formula}${symbol}` }));
    setCursorLineId(last.lineId);
  };

  const submit = async (): Promise<void> => {
    const submissionId = `sub-${history.present.nextLineOrdinal}-${history.present.lines.length}`;
    setSubmission({ kind: 'enviando', submissionId });
    const { proof } = toProofInput(history.present);
    const port = createHttpVerdictPort(browserFetch);
    setSubmission(await submitForVerdict(port, submissionId, proof));
  };

  /**
   * La costura de los pasos 7 → 2 de W7 (T-H7-01): el error que **el
   * verificador** clasificó entra en el turno siguiente del profesor.
   *
   * Se toma el primer error y no todos: `firstInvalidStep` es lo que el
   * contrato declara como el punto donde la derivación se rompe, y darle al
   * profesor la lista entera le haría comentar errores que son consecuencia del
   * primero. No se deriva de la revisión local, que **no es autoritativa**.
   */
  const structuredError =
    submission.kind === 'veredicto' && !submission.verdict.verification.valid
      ? (() => {
          const first = submission.verdict.verification.errors[0];
          return first === undefined
            ? null
            : { code: first.code, stepNumber: first.line ?? null };
        })()
      : null;

  return (
    <ClaseView
      viewModel={viewModel}
      localReview={review}
      submission={submission}
      syntheticPackage
      board={
        // Sin actividad no se monta: `BoardElement` exige `activityId` y `kcId`,
        // y el contrato dice que un elemento sin esa referencia «sólo es un
        // dibujo». Inventar un identificador de relleno para poder pintar el
        // lienzo metería en la evidencia trazos atados a una actividad que no
        // existe, que es peor que no tener pizarrón.
        input.activity === null ? null : (
          <Pizarron
            binding={{ activityId: input.activity.activityId, kcId: input.activity.kcId }}
            onOperations={(operations) => boardOps.current.push(...operations)}
          />
        )
      }
      professor={
        <ProfesorPanel
          port={createHttpTurnPort(browserFetch)}
          blockId={DRY_SESSION_BLOCK_ID}
          structuredError={structuredError}
        />
      }
    >
      <>
        <FitchEditor
          history={history}
          review={review}
          cursorLineId={cursorLineId}
          onInsertSymbol={insertSymbol}
          onUndo={() => setHistory((current) => undo(current))}
          onRedo={() => setHistory((current) => redo(current))}
        />
        <button type="button" data-testid="enviar-verificador" onClick={() => void submit()}>
          Enviar al verificador
        </button>
      </>
    </ClaseView>
  );
}
