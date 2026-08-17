import {
  analyzeStructure,
  isAccessible,
  tryParse,
  type Formula,
  type VerificationError,
} from '@profesor-ia/logic-core/syntax';

import { toProofInput, type DanglingReference, type FitchDocument } from './fitch-document';

/**
 * Revisión **local y no autoritativa** del editor Fitch (T-H6-13 ← P-I §8.9:
 * «validación sintáctica local no autoritativa; veredicto autoritativo en
 * servidor»).
 *
 * Qué hace: dice si lo escrito se puede leer —se parsea con la gramática
 * congelada— y describe la estructura del documento para resaltar líneas y
 * subpruebas.
 *
 * Qué **no** hace, y no por falta de código sino por diseño: no dice si un paso
 * se sigue, no dice si la derivación es correcta y no dice si se alcanzó la
 * meta. Eso es el veredicto y lo emite el servidor con `logic-core`. Si el
 * cliente pudiera afirmarlo habría dos verificadores con implementaciones
 * distintas, y el sistema dejaría de tener una sola ruta de verificación.
 *
 * Por eso `LocalReview` **no tiene ningún campo booleano de resultado**. No hay
 * `valid`, ni `correct`, ni `ok`: una revisión sin observaciones significa «esto
 * se puede leer», nunca «esto está bien». Una prueba comprueba que ese campo no
 * aparece, porque el día que alguien lo añada la frontera se habrá movido sin
 * que nadie lo note.
 */

export const LOCAL_REVIEW_SCHEMA_VERSION = 'clase-local-review-v1' as const;

/** Observación local: sintáctica, estructural o de cita. Nunca de validez. */
export interface LocalNote {
  /** Código cerrado de `logic-core` (`E-SYN-*`, `E-STRUCT-*`) o del editor. */
  readonly code: string;
  /** Número 1-based, o `null` si la observación es del documento entero. */
  readonly line: number | null;
  readonly detail: string;
}

export interface LineDecoration {
  readonly lineId: string;
  readonly lineNumber: number;
  readonly depth: number;
  readonly rule: string;
  /** Abre una subprueba: es la línea `AS` inicial de un bloque. */
  readonly opensSubproof: boolean;
  /** Última línea de al menos una subprueba. */
  readonly closesSubproof: boolean;
  /** Líneas `AS` que abren cada bloque abierto aquí. */
  readonly blockPath: readonly number[];
  /**
   * Referencia semántica estable para el overlay de anotaciones (P-I §8.9.2:
   * `fitch-line:4`). Se emite ya, aunque el overlay llegue en F10: si los
   * targets nacieran entonces, el modelo señalaría posiciones y no elementos.
   */
  readonly annotationTarget: `fitch-line:${number}`;
  /** ¿Es citable desde la línea del cursor? `null` si no hay cursor. */
  readonly citableFromCursor: boolean | null;
}

export interface SubproofSpan {
  readonly start: number;
  readonly end: number;
  readonly parentPath: readonly number[];
}

export interface LocalReview {
  readonly schemaVersion: typeof LOCAL_REVIEW_SCHEMA_VERSION;
  /**
   * Marca explícita, en el dato y no solo en la documentación: lo que sigue no
   * autoriza nada.
   */
  readonly authoritative: false;
  /** Fórmulas que no se pueden leer con la gramática congelada. */
  readonly syntax: readonly LocalNote[];
  /** Estructura Fitch: posición de `PR`/`AS`, saltos de profundidad. */
  readonly structure: readonly LocalNote[];
  /** Citas que no resuelven a una línea existente del documento. */
  readonly references: readonly LocalNote[];
  readonly lines: readonly LineDecoration[];
  readonly subproofs: readonly SubproofSpan[];
}

function toNote(error: VerificationError): LocalNote {
  // `detail` es opcional en el contrato. Se conserva el código en su lugar en
  // vez de dejar el texto vacío: un aviso sin nada que leer no es un aviso.
  return { code: error.code, line: error.line ?? null, detail: error.detail ?? error.code };
}

function danglingToNote(dangling: DanglingReference): LocalNote {
  return { code: dangling.code, line: dangling.line, detail: dangling.detail };
}

export interface ReviewOptions {
  /** Línea desde la que se está citando, para marcar qué es accesible. */
  readonly cursorLineId?: string;
}

/**
 * Revisa el documento. Nunca lanza por contenido del alumno: una fórmula
 * ilegible es una observación, no una excepción — el editor tiene que seguir
 * mostrando el documento mientras se escribe.
 */
export function reviewFitchDocument(
  document: FitchDocument,
  options: ReviewOptions = {},
): LocalReview {
  const syntax: LocalNote[] = [];
  const parsed: (Formula | null)[] = [];

  for (const [index, line] of document.lines.entries()) {
    const result = tryParse(line.formula);
    if (result.ok) {
      parsed.push(result.formula);
      continue;
    }
    parsed.push(null);
    syntax.push({ code: result.error.code, line: index + 1, detail: result.error.detail });
  }

  const { proof, dangling } = toProofInput(document);
  const references = dangling.map(danglingToNote);

  // La estructura se analiza solo con las líneas legibles. Inventar una fórmula
  // para las que no lo son produciría un análisis de un documento que no es el
  // que el alumno escribió.
  const readable = document.lines
    .map((line, index) => ({ line, index, formula: parsed[index] ?? null }))
    .filter((entry): entry is { line: (typeof document.lines)[number]; index: number; formula: Formula } =>
      entry.formula !== null,
    );

  const analyzable = readable.length === document.lines.length;
  const analysis = analyzable
    ? analyzeStructure(
        readable.map((entry, position) => ({
          depth: entry.line.depth,
          rule: entry.line.rule,
          formula: entry.formula,
          refs: proof.lines[position]?.refs ?? [],
        })),
      )
    : { analyzed: [], subproofs: new Map<number, { start: number; end: number; parentPath: readonly number[] }>(), errors: [] };

  const structure = analysis.errors.map(toNote);
  const subproofs: SubproofSpan[] = [...analysis.subproofs.values()]
    .map((span) => ({ start: span.start, end: span.end, parentPath: span.parentPath }))
    .sort((a, b) => a.start - b.start);

  const blockPathByNumber = new Map<number, readonly number[]>();
  for (const analyzed of analysis.analyzed) blockPathByNumber.set(analyzed.lineNumber, analyzed.blockPath);

  const cursorNumber =
    options.cursorLineId === undefined
      ? null
      : document.lines.findIndex((line) => line.lineId === options.cursorLineId) + 1 || null;
  const cursorPath = cursorNumber === null ? null : blockPathByNumber.get(cursorNumber) ?? null;

  const closesAt = new Set(subproofs.map((span) => span.end));

  const lines: LineDecoration[] = document.lines.map((line, index) => {
    const lineNumber = index + 1;
    const blockPath = blockPathByNumber.get(lineNumber) ?? [];
    return {
      lineId: line.lineId,
      lineNumber,
      depth: line.depth,
      rule: line.rule,
      opensSubproof: analysis.subproofs.has(lineNumber),
      closesSubproof: closesAt.has(lineNumber),
      blockPath,
      annotationTarget: `fitch-line:${lineNumber}`,
      citableFromCursor:
        cursorPath === null || cursorNumber === null
          ? null
          : // Una cita precede a la línea que la usa, y la línea citada no puede
            // estar dentro de una subprueba ya cerrada.
            lineNumber < cursorNumber && isAccessible(blockPath, cursorPath),
    };
  });

  return {
    schemaVersion: LOCAL_REVIEW_SCHEMA_VERSION,
    authoritative: false,
    syntax,
    structure,
    references,
    lines,
    subproofs,
  };
}

/**
 * ¿Hay algo que el alumno pueda arreglar antes de enviar? Es una cuenta de
 * observaciones, **no** un juicio: `false` significa «se puede leer», no «está
 * bien». El nombre lo dice para que no se lea como lo segundo.
 */
export function hasLocalNotes(review: LocalReview): boolean {
  return review.syntax.length + review.structure.length + review.references.length > 0;
}
