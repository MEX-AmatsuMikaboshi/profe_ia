import type { ProofInput, ProofLineInput, Reference } from '@profesor-ia/logic-core/syntax';

/**
 * Modelo de documento del editor Fitch estructurado (T-H6-13 ← P-I §8.9).
 *
 * Es **estructurado**, no un área de texto: las citas apuntan a la identidad de
 * la línea (`lineId`), no a su número. Un editor que guardara `refs: [2, 3]`
 * tendría que renumerar cada cita en cada inserción, borrado o reordenamiento, y
 * el día que fallara el alumno vería su derivación citando otra línea sin haber
 * tocado esa cita. Los números 1-based solo existen al exportar, que es donde la
 * norma los pide.
 *
 * Este módulo **no decide nada**: no hay validez, ni veredicto, ni «casi». Lo
 * que produce es el `ProofInput` que el servidor verifica con `logic-core`. La
 * frontera es ejecutable: la regla `web-sin-verificador-autoritativo` impide que
 * `apps/web` alcance el verificador.
 */

/** Cita del alumno, por identidad de línea. Se traduce a número al exportar. */
export type DraftReference =
  | { readonly kind: 'line'; readonly lineId: string }
  | { readonly kind: 'subproof'; readonly fromLineId: string; readonly toLineId: string };

export interface FitchLineDraft {
  /** Identidad estable de la línea durante toda la edición. */
  readonly lineId: string;
  /** Texto tal cual lo escribió el alumno; la normalización es del tokenizador. */
  readonly formula: string;
  /** `PR`, `AS`, un `rule_id` o un alias de entrada autorizado. */
  readonly rule: string;
  readonly refs: readonly DraftReference[];
  /** 0 = nivel superior. */
  readonly depth: number;
}

export interface FitchDocument {
  readonly lines: readonly FitchLineDraft[];
  /** Meta declarada de la actividad; `null` si la actividad no fija una. */
  readonly goal: string | null;
  /** Contador monótono de identidades. No hay azar ni reloj: el replay lo exige. */
  readonly nextLineOrdinal: number;
}

export type FitchEditErrorCode =
  | 'LINEA_INEXISTENTE'
  | 'PROFUNDIDAD_INVALIDA'
  | 'DOCUMENTO_VACIO'
  | 'HISTORIAL_VACIO';

export class FitchEditError extends Error {
  constructor(
    readonly code: FitchEditErrorCode,
    detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = 'FitchEditError';
  }
}

/**
 * Límite de anidamiento del editor. Es deliberadamente **más bajo** que el
 * `MAX_DEPTH` de `logic-core` (64): aquel es el límite de implementación del
 * verificador y este es de interfaz. Se mantienen separados a propósito, porque
 * igualarlos haría que un cambio del verificador moviera en silencio lo que el
 * alumno puede escribir.
 */
export const EDITOR_MAX_DEPTH = 16;

export function emptyFitchDocument(goal: string | null = null): FitchDocument {
  return { lines: [], goal, nextLineOrdinal: 1 };
}

/** Borrador de línea sin identidad: la asigna el documento. */
export interface FitchLineInput {
  readonly formula: string;
  readonly rule: string;
  readonly refs?: readonly DraftReference[];
  readonly depth?: number;
}

function nextId(document: FitchDocument): string {
  return `l${document.nextLineOrdinal}`;
}

function assertDepth(depth: number): void {
  if (!Number.isInteger(depth) || depth < 0 || depth > EDITOR_MAX_DEPTH) {
    throw new FitchEditError(
      'PROFUNDIDAD_INVALIDA',
      `profundidad ${depth} fuera del rango del editor [0, ${EDITOR_MAX_DEPTH}]`,
    );
  }
}

function indexOfLine(document: FitchDocument, lineId: string): number {
  const index = document.lines.findIndex((line) => line.lineId === lineId);
  if (index === -1) {
    throw new FitchEditError('LINEA_INEXISTENTE', `no hay ninguna línea ${lineId}`);
  }
  return index;
}

function materialize(input: FitchLineInput, lineId: string): FitchLineDraft {
  const depth = input.depth ?? 0;
  assertDepth(depth);
  return { lineId, formula: input.formula, rule: input.rule, refs: input.refs ?? [], depth };
}

export function appendLine(document: FitchDocument, input: FitchLineInput): FitchDocument {
  const line = materialize(input, nextId(document));
  return {
    ...document,
    lines: [...document.lines, line],
    nextLineOrdinal: document.nextLineOrdinal + 1,
  };
}

export function insertLineAfter(
  document: FitchDocument,
  afterLineId: string,
  input: FitchLineInput,
): FitchDocument {
  const index = indexOfLine(document, afterLineId);
  const line = materialize(input, nextId(document));
  const lines = [...document.lines];
  lines.splice(index + 1, 0, line);
  return { ...document, lines, nextLineOrdinal: document.nextLineOrdinal + 1 };
}

export type FitchLinePatch = Partial<Omit<FitchLineDraft, 'lineId'>>;

export function updateLine(
  document: FitchDocument,
  lineId: string,
  patch: FitchLinePatch,
): FitchDocument {
  const index = indexOfLine(document, lineId);
  const current = document.lines[index] as FitchLineDraft;
  if (patch.depth !== undefined) assertDepth(patch.depth);
  const updated: FitchLineDraft = { ...current, ...patch, lineId };
  const lines = [...document.lines];
  lines[index] = updated;
  return { ...document, lines };
}

/**
 * Borra la línea. **No** toca las citas que apuntaban a ella: quedan colgando y
 * la revisión local las reporta. Repararlas por cuenta propia —borrando la cita,
 * o moviéndola a la línea vecina— cambiaría la derivación del alumno sin que él
 * lo pidiera, y el cambio aparecería como suyo en la evidencia.
 */
export function removeLine(document: FitchDocument, lineId: string): FitchDocument {
  const index = indexOfLine(document, lineId);
  const lines = [...document.lines];
  lines.splice(index, 1);
  return { ...document, lines };
}

export function indentLine(document: FitchDocument, lineId: string): FitchDocument {
  const index = indexOfLine(document, lineId);
  const current = document.lines[index] as FitchLineDraft;
  return updateLine(document, lineId, { depth: current.depth + 1 });
}

export function outdentLine(document: FitchDocument, lineId: string): FitchDocument {
  const index = indexOfLine(document, lineId);
  const current = document.lines[index] as FitchLineDraft;
  return updateLine(document, lineId, { depth: current.depth - 1 });
}

export function setGoal(document: FitchDocument, goal: string | null): FitchDocument {
  return { ...document, goal };
}

/**
 * Abre una subprueba tras `afterLineId`: una línea `AS` un nivel más adentro.
 * Es la operación que el alumno reconoce como «abrir subprueba», y evita que
 * tenga que acertar a mano la combinación profundidad+`AS` que la estructura
 * exige.
 */
export function openSubproof(
  document: FitchDocument,
  afterLineId: string,
  assumption: string,
): FitchDocument {
  const index = indexOfLine(document, afterLineId);
  const current = document.lines[index] as FitchLineDraft;
  return insertLineAfter(document, afterLineId, {
    formula: assumption,
    rule: 'AS',
    depth: current.depth + 1,
  });
}

/** Cierra la subprueba abierta: la siguiente línea vuelve un nivel afuera. */
export function closeSubproof(
  document: FitchDocument,
  afterLineId: string,
  input: FitchLineInput,
): FitchDocument {
  const index = indexOfLine(document, afterLineId);
  const current = document.lines[index] as FitchLineDraft;
  if (current.depth === 0) {
    throw new FitchEditError(
      'PROFUNDIDAD_INVALIDA',
      `la línea ${afterLineId} ya está en el nivel superior: no hay subprueba que cerrar`,
    );
  }
  return insertLineAfter(document, afterLineId, { ...input, depth: current.depth - 1 });
}

// ─────────────────────────────── exportación ───────────────────────────────

export type ExportErrorCode = 'CITA_COLGANTE' | 'SUBPRUEBA_INVERTIDA';

export interface DanglingReference {
  readonly code: ExportErrorCode;
  /** Número 1-based de la línea que cita. */
  readonly line: number;
  readonly detail: string;
}

export interface ProofInputExport {
  readonly proof: ProofInput;
  /**
   * Citas que no se pudieron traducir a números. **No se omiten del resultado**:
   * exportar una derivación a la que le faltan citas, sin decirlo, la convertiría
   * en otra derivación distinta ante el verificador.
   */
  readonly dangling: readonly DanglingReference[];
}

/**
 * Traduce el documento al `ProofInput` que verifica el servidor.
 *
 * Es la única traducción identidad→número del sistema, y va acompañada de la
 * lista de citas que no se pudieron traducir. Quien exporte con `dangling` no
 * vacío está enviando una derivación incompleta y tiene que saberlo.
 */
export function toProofInput(document: FitchDocument): ProofInputExport {
  const numberOf = new Map<string, number>();
  for (const [index, line] of document.lines.entries()) numberOf.set(line.lineId, index + 1);

  const dangling: DanglingReference[] = [];
  const lines: ProofLineInput[] = document.lines.map((line, index) => {
    const lineNumber = index + 1;
    const refs: Reference[] = [];

    for (const ref of line.refs) {
      if (ref.kind === 'line') {
        const target = numberOf.get(ref.lineId);
        if (target === undefined) {
          dangling.push({
            code: 'CITA_COLGANTE',
            line: lineNumber,
            detail: `cita a la línea ${ref.lineId}, que ya no está en la derivación`,
          });
          continue;
        }
        refs.push(target);
        continue;
      }

      const from = numberOf.get(ref.fromLineId);
      const to = numberOf.get(ref.toLineId);
      if (from === undefined || to === undefined) {
        dangling.push({
          code: 'CITA_COLGANTE',
          line: lineNumber,
          detail: `cita a la subprueba ${ref.fromLineId}–${ref.toLineId}, que ya no está completa`,
        });
        continue;
      }
      if (from > to) {
        dangling.push({
          code: 'SUBPRUEBA_INVERTIDA',
          line: lineNumber,
          detail: `la subprueba citada empieza en ${from} y termina en ${to}`,
        });
        continue;
      }
      refs.push([from, to] as const);
    }

    return { formula: line.formula, rule: line.rule, refs, depth: line.depth };
  });

  const proof: ProofInput = document.goal === null ? { lines } : { lines, goal: document.goal };
  return { proof, dangling };
}

/**
 * Exportación legible para el alumno (P-I §8.9, «exportación»).
 *
 * No es la impresión canónica del servidor —esa vive en la ruta de verificación
 * y es parte de la evidencia—: es el texto que el alumno se lleva. Se declara
 * así para que nadie la confunda con un artefacto autoritativo.
 */
export function toFitchText(document: FitchDocument): string {
  const { proof } = toProofInput(document);
  const width = String(proof.lines.length).length;
  const body = proof.lines.map((line, index) => {
    const number = String(index + 1).padStart(width, ' ');
    const bars = '│ '.repeat(line.depth);
    const refs = (line.refs ?? [])
      .map((ref) => (typeof ref === 'number' ? String(ref) : `${ref[0]}–${ref[1]}`))
      .join(', ');
    const justification = refs.length > 0 ? `${line.rule} ${refs}` : line.rule;
    return `${number} │ ${bars}${line.formula}    ${justification}`;
  });

  const header = document.goal === null ? [] : [`Meta: ${document.goal}`, ''];
  return [...header, ...body].join('\n');
}

// ───────────────────────── historial de edición ─────────────────────────

/**
 * Historial del editor (P-I §8.9, «historial»): deshacer y rehacer.
 *
 * Es historial **de edición**, no de intentos: los intentos enviados son actos
 * con evidencia y viven en la bitácora, no en una pila que el alumno puede
 * vaciar. Confundir los dos permitiría «deshacer» un intento ya registrado.
 */
export interface FitchEditorHistory {
  readonly past: readonly FitchDocument[];
  readonly present: FitchDocument;
  readonly future: readonly FitchDocument[];
}

/** Tope de la pila. Un historial ilimitado crece con la sesión sin límite. */
export const HISTORY_LIMIT = 100;

export function initialHistory(document: FitchDocument): FitchEditorHistory {
  return { past: [], present: document, future: [] };
}

/** Registra una edición. Rehacer se descarta: la rama alternativa ya no existe. */
export function commitEdit(
  history: FitchEditorHistory,
  document: FitchDocument,
): FitchEditorHistory {
  const past = [...history.past, history.present].slice(-HISTORY_LIMIT);
  return { past, present: document, future: [] };
}

export function canUndo(history: FitchEditorHistory): boolean {
  return history.past.length > 0;
}

export function canRedo(history: FitchEditorHistory): boolean {
  return history.future.length > 0;
}

export function undo(history: FitchEditorHistory): FitchEditorHistory {
  if (!canUndo(history)) {
    throw new FitchEditError('HISTORIAL_VACIO', 'no hay ninguna edición que deshacer');
  }
  const previous = history.past[history.past.length - 1] as FitchDocument;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future].slice(0, HISTORY_LIMIT),
  };
}

export function redo(history: FitchEditorHistory): FitchEditorHistory {
  if (!canRedo(history)) {
    throw new FitchEditError('HISTORIAL_VACIO', 'no hay ninguna edición que rehacer');
  }
  const next = history.future[0] as FitchDocument;
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: history.future.slice(1),
  };
}
