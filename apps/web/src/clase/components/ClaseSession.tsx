'use client';

import { useMemo, useState } from 'react';

import { drySessionDocument, drySessionViewInput } from '../dry-session';
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
import { buildClaseViewModel, type SaveState } from '../view-model';
import { ClaseView } from './ClaseView';
import { FitchEditor } from './FitchEditor';

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

  return (
    <ClaseView
      viewModel={viewModel}
      localReview={review}
      submission={submission}
      syntheticPackage
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
