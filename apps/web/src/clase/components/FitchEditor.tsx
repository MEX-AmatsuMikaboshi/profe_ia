import { CLASE_COPY } from '../copy';
import { Formula } from './Formula';
import type { FitchDocument, FitchEditorHistory } from '../fitch-document';
import { canRedo, canUndo, toFitchText } from '../fitch-document';
import type { LineDecoration, LocalReview } from '../local-review';

/**
 * Editor Fitch estructurado (T-H6-13 ← P-I §8.9).
 *
 * Presentación pura: recibe documento, decoración y manejadores. Los conectivos
 * se insertan desde una paleta con los **símbolos canónicos** del cálculo; el
 * tokenizador acepta alias de entrada, pero ofrecer un botón «->» enseñaría una
 * notación que la evidencia después no muestra.
 *
 * La marca de subprueba se dibuja con barras y sangría **y** con el número de
 * línea de apertura en el dato (`data-block-path`): UIUX §3 pide texto + señal,
 * no solo señal visual.
 */

/** Símbolos canónicos del lenguaje (P-II §4.1.1). Sin alias en la paleta. */
export const NOTATION_PALETTE = ['¬', '∧', '∨', '→', '↔', '⊥', '(', ')'] as const;

export interface FitchEditorProps {
  readonly history: FitchEditorHistory;
  readonly review: LocalReview;
  readonly cursorLineId: string | null;
  readonly onInsertSymbol?: (symbol: string) => void;
  readonly onUndo?: () => void;
  readonly onRedo?: () => void;
  readonly onExport?: (text: string) => void;
}

function decorationOf(
  review: LocalReview,
  lineId: string,
): LineDecoration | undefined {
  return review.lines.find((decoration) => decoration.lineId === lineId);
}

function noteCodesFor(review: LocalReview, lineNumber: number): readonly string[] {
  return [...review.syntax, ...review.structure, ...review.references]
    .filter((note) => note.line === lineNumber)
    .map((note) => note.code);
}

export function FitchEditor({
  history,
  review,
  cursorLineId,
  onInsertSymbol,
  onUndo,
  onRedo,
  onExport,
}: FitchEditorProps) {
  const document: FitchDocument = history.present;

  return (
    <section data-testid="editor-fitch" aria-label={CLASE_COPY.editor.title}>
      <h2>{CLASE_COPY.editor.title}</h2>

      {document.goal === null ? null : <p data-testid="meta">Meta: {document.goal}</p>}

      <div role="group" aria-label="Notación">
        {NOTATION_PALETTE.map((symbol) => (
          <button
            key={symbol}
            type="button"
            data-testid={`simbolo-${symbol}`}
            onClick={onInsertSymbol === undefined ? undefined : () => onInsertSymbol(symbol)}
          >
            {symbol}
          </button>
        ))}
      </div>

      <ol data-testid="lineas">
        {document.lines.map((line) => {
          const decoration = decorationOf(review, line.lineId);
          const codes = decoration === undefined ? [] : noteCodesFor(review, decoration.lineNumber);
          return (
            <li
              key={line.lineId}
              data-line-id={line.lineId}
              data-line-number={decoration?.lineNumber ?? ''}
              data-depth={line.depth}
              data-opens-subproof={String(decoration?.opensSubproof ?? false)}
              data-closes-subproof={String(decoration?.closesSubproof ?? false)}
              data-block-path={(decoration?.blockPath ?? []).join('.')}
              data-annotation-target={decoration?.annotationTarget ?? ''}
              data-citable={String(decoration?.citableFromCursor ?? '')}
              data-cursor={String(line.lineId === cursorLineId)}
              data-notes={codes.join(' ')}
            >
              <span aria-hidden="true">{'│ '.repeat(line.depth)}</span>
              <Formula source={line.formula} testId={`formula-${line.lineId}`} />
              <span data-testid={`justificacion-${line.lineId}`}>{line.rule}</span>
              {/* Texto además de la señal visual: la sangría sola no se lee con
                  lector de pantalla ni sobrevive a una captura en gris. */}
              {decoration?.depth ? (
                <span data-testid={`subprueba-${line.lineId}`}>
                  subprueba nivel {decoration.depth}
                </span>
              ) : null}
              {codes.length > 0 ? <span data-testid={`aviso-${line.lineId}`}>{codes.join(', ')}</span> : null}
            </li>
          );
        })}
      </ol>

      <div role="group" aria-label="Historial">
        <button
          type="button"
          data-testid="deshacer"
          disabled={!canUndo(history)}
          onClick={onUndo}
        >
          {CLASE_COPY.editor.undo}
        </button>
        <button type="button" data-testid="rehacer" disabled={!canRedo(history)} onClick={onRedo}>
          {CLASE_COPY.editor.redo}
        </button>
        <button
          type="button"
          data-testid="exportar"
          onClick={onExport === undefined ? undefined : () => onExport(toFitchText(document))}
        >
          {CLASE_COPY.editor.export}
        </button>
      </div>
    </section>
  );
}
