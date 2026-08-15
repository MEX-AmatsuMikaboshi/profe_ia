import type { Formula } from './ast.js';
import type { VerificationError } from './errors.js';

/**
 * Estructura Fitch, alcance y descarga (Plan.md T-H2-04 ← P-II §4.1.1):
 *
 *  - toda línea tiene justificación;
 *  - `PR` solo en el bloque de premisas de nivel 0;
 *  - `AS` solo en la primera línea de una subprueba;
 *  - toda cita precede a la línea que la usa;
 *  - una línea dentro de una subprueba cerrada deja de ser accesible desde fuera;
 *  - una subprueba citada debe ser completa y accesible;
 *  - la conclusión final está en profundidad 0 y no depende de supuestos abiertos;
 *  - se permiten subpruebas de una línea y descarga vacua;
 *  - el límite de profundidad es parámetro de implementación, no regla lógica.
 */

/** Cita: una línea, o un rango que debe corresponder a una subprueba completa. */
export type Reference = number | readonly [number, number];

export interface ProofLineInput {
  /** Fórmula en texto; se normaliza y parsea con las reglas del cálculo. */
  readonly formula: string;
  /** `rule_id`, justificación (`PR`/`AS`) o alias de entrada autorizado. */
  readonly rule: string;
  readonly refs?: readonly Reference[];
  /** 0 = nivel superior. */
  readonly depth: number;
}

export interface ProofInput {
  readonly lines: readonly ProofLineInput[];
  /** Meta opcional; si se declara, la última línea debe coincidir. */
  readonly goal?: string;
}

export interface AnalyzedLine {
  /** 1-based, como se cita. */
  readonly lineNumber: number;
  readonly depth: number;
  readonly formula: Formula;
  readonly rule: string;
  readonly refs: readonly Reference[];
  /** Índices (1-based) de las líneas `AS` que abren cada bloque abierto en esta línea. */
  readonly blockPath: readonly number[];
  /** Para líneas `AS`: última línea de su subprueba. */
  readonly subproofEnd?: number;
}

export interface Subproof {
  readonly start: number;
  readonly end: number;
  readonly parentPath: readonly number[];
}

/** Límite de anidamiento: parámetro de implementación, no regla lógica. */
export const MAX_DEPTH = 64;

/**
 * Calcula bloques y accesibilidad. Devuelve errores estructurales detectados
 * en la propia forma del árbol (posición de `PR`/`AS`, saltos de profundidad).
 */
export function analyzeStructure(
  lines: readonly { depth: number; rule: string; formula: Formula; refs: readonly Reference[] }[],
): { analyzed: AnalyzedLine[]; subproofs: Map<number, Subproof>; errors: VerificationError[] } {
  const errors: VerificationError[] = [];
  const analyzed: AnalyzedLine[] = [];
  const subproofs = new Map<number, Subproof>();

  const path: number[] = [];
  let previousDepth = 0;
  let sawNonPremise = false;

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    const depth = line.depth;

    if (depth < 0 || depth > MAX_DEPTH) {
      errors.push({
        code: 'E-SYN-PARSE',
        line: lineNumber,
        detail: `profundidad ${depth} fuera del rango de implementación [0, ${MAX_DEPTH}]`,
      });
      break;
    }

    if (depth > previousDepth + 1) {
      errors.push({
        code: 'E-STRUCT-AS-POSITION',
        line: lineNumber,
        detail: `salto de profundidad ${previousDepth} → ${depth}: una subprueba abre exactamente un nivel`,
      });
    }

    const closeTopBlock = (): void => {
      const startLine = path.pop() as number;
      const sub = subproofs.get(startLine);
      if (sub) subproofs.set(startLine, { ...sub, end: lineNumber - 1 });
    };

    // Cierre de bloques al bajar de profundidad.
    while (path.length > depth) closeTopBlock();

    // Subprueba hermana: un `AS` a la misma profundidad cierra la anterior y
    // abre otra. Una subprueba tiene exactamente un supuesto, en su primera línea.
    if (line.rule === 'AS' && depth > 0 && path.length === depth) closeTopBlock();

    // Apertura de bloque al subir.
    if (depth > path.length) {
      subproofs.set(lineNumber, { start: lineNumber, end: lineNumber, parentPath: [...path] });
      path.push(lineNumber);
    }

    if (line.rule === 'AS') {
      const opensHere = path[path.length - 1] === lineNumber;
      if (!opensHere) {
        errors.push({
          code: 'E-STRUCT-AS-POSITION',
          line: lineNumber,
          detail: 'AS solo puede aparecer en la primera línea de una subprueba',
        });
      }
    } else if (line.rule === 'PR') {
      if (depth !== 0) {
        errors.push({
          code: 'E-STRUCT-PR-POSITION',
          line: lineNumber,
          detail: 'PR solo aparece en el bloque de premisas de nivel 0',
        });
      } else if (sawNonPremise) {
        errors.push({
          code: 'E-STRUCT-PR-POSITION',
          line: lineNumber,
          detail: 'PR aparece después de una línea derivada: el bloque de premisas ya se cerró',
        });
      }
    } else if (depth > 0 && path[path.length - 1] === lineNumber) {
      errors.push({
        code: 'E-STRUCT-AS-POSITION',
        line: lineNumber,
        detail: `la primera línea de una subprueba debe justificarse con AS, no con ${line.rule}`,
      });
    }

    if (line.rule !== 'PR') sawNonPremise = true;

    analyzed.push({
      lineNumber,
      depth,
      formula: line.formula,
      rule: line.rule,
      refs: line.refs,
      blockPath: [...path],
    });

    previousDepth = depth;
  }

  // Bloques que siguen abiertos al final.
  while (path.length > 0) {
    const startLine = path.pop() as number;
    const sub = subproofs.get(startLine);
    if (sub) subproofs.set(startLine, { ...sub, end: lines.length });
  }

  return { analyzed, subproofs, errors };
}

/** ¿Es `citedPath` un prefijo de `citingPath`? (línea accesible, no cerrada). */
export function isAccessible(
  citedPath: readonly number[],
  citingPath: readonly number[],
): boolean {
  if (citedPath.length > citingPath.length) return false;
  return citedPath.every((block, i) => citingPath[i] === block);
}
