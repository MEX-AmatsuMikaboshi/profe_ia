import { equals, print, type Formula } from './ast.js';
import { AUTHORIZED_CALCULUS_VERSION, CONTENT_POLICY_STAGE1 } from './calculus.js';
import { ParseError, type VerificationError } from './errors.js';
import {
  analyzeStructure,
  isAccessible,
  type AnalyzedLine,
  type ProofInput,
  type Reference,
  type Subproof,
} from './fitch.js';
import { parse } from './parser.js';
import { applyRule, canonicalRuleId, type CitedLine, type CitedSubproof } from './rules.js';
import { describeValuation, entails } from './semantics.js';

/** Versión del verificador; entra en la traza y en el manifiesto de freeze. */
export const VERIFIER_VERSION = '0.1.0' as const;

export type SemanticCheck = 'passed' | 'failed' | 'not-applicable';

export interface VerificationResult {
  /** La derivación está bien formada y **todo** paso está autorizado. */
  readonly valid: boolean;
  /**
   * ¿La última línea es la meta pedida? Separado de `valid`: una derivación
   * impecable de otra cosa es válida pero no resuelve el reactivo. Quien decide
   * la corrección del intento es el motor, con ambos datos.
   */
  readonly goalReached?: boolean;
  /** Primera línea (1-based) con error; ausente si no hay errores con línea. */
  readonly firstInvalidStep?: number;
  readonly errors: readonly VerificationError[];
  readonly semanticCheck: SemanticCheck;
  readonly semanticCheckReason?: string;
  readonly authorizedCalculusVersion: typeof AUTHORIZED_CALCULUS_VERSION;
  readonly verifierVersion: typeof VERIFIER_VERSION;
}

const isRange = (r: Reference): r is readonly [number, number] => Array.isArray(r);

/**
 * Verifica una derivación Fitch contra `authorized-calculus-v1`.
 *
 * Determinista: mismas entradas y versiones ⇒ mismo resultado. No hay red, no
 * hay modelo generativo y no hay heurística: lo que no está autorizado falla
 * cerrado.
 */
export function verify(input: ProofInput): VerificationResult {
  const errors: VerificationError[] = [];

  if (input.lines.length === 0) {
    return result([{ code: 'E-SYN-PARSE', detail: 'derivación vacía' }], 'not-applicable', 'derivación vacía');
  }

  // 1) Sintaxis de cada línea.
  const parsed: { formula: Formula; rule: string; refs: readonly Reference[]; depth: number }[] = [];
  for (const [index, line] of input.lines.entries()) {
    const lineNumber = index + 1;
    try {
      parsed.push({
        formula: parse(line.formula),
        rule: line.rule.trim(),
        refs: line.refs ?? [],
        depth: line.depth,
      });
    } catch (err) {
      if (!(err instanceof ParseError)) throw err;
      errors.push({ code: err.code, line: lineNumber, detail: err.detail });
      // Sin AST no se puede seguir analizando esta línea; se conserva un hueco.
      parsed.push({ formula: { kind: 'falsum' }, rule: line.rule.trim(), refs: [], depth: line.depth });
    }
  }
  if (errors.length > 0) {
    return result(errors, 'not-applicable', 'no se evalúa semántica sobre una derivación con error sintáctico');
  }

  // 2) Estructura, alcance y descarga.
  const { analyzed, subproofs, errors: structuralErrors } = analyzeStructure(parsed);
  errors.push(...structuralErrors);

  // 3) Política de contenido de Etapa 1: ⊥ prohibido como premisa/supuesto inicial.
  for (const line of analyzed) {
    const forbidsFalsum =
      (line.rule === 'PR' && !CONTENT_POLICY_STAGE1.falsumAsPremise) ||
      (line.rule === 'AS' && !CONTENT_POLICY_STAGE1.falsumAsInitialAssumption);
    if (forbidsFalsum && line.formula.kind === 'falsum') {
      errors.push({
        code: line.rule === 'PR' ? 'E-STRUCT-PR-POSITION' : 'E-STRUCT-AS-POSITION',
        line: line.lineNumber,
        detail: '⊥ no puede introducirse como premisa ni como supuesto inicial (política de Etapa 1)',
      });
    }
  }

  // 4) Reglas, citas y accesibilidad.
  let semanticFailure: VerificationError | undefined;
  let notApplicableReason: string | undefined;

  for (const line of analyzed) {
    if (line.rule === 'PR' || line.rule === 'AS') continue;

    const ruleResolution = canonicalRuleId(line.rule);
    if (!ruleResolution.ok) {
      errors.push({ ...ruleResolution.error, line: line.lineNumber });
      continue;
    }
    const ruleId = ruleResolution.ruleId;

    const resolution = resolveReferences(line, analyzed, subproofs);
    if (resolution.errors.length > 0) {
      errors.push(...resolution.errors.map((e) => ({ ...e, ruleId })));
      continue;
    }

    const ruleError = applyRule(ruleId, {
      lineNumber: line.lineNumber,
      conclusion: line.formula,
      lines: resolution.lines,
      subproofs: resolution.subproofs,
    });
    if (ruleError) {
      errors.push(ruleError);
      continue;
    }

    // 5) Oráculo semántico independiente, paso a paso.
    const assumptions = accessibleAssumptions(line, analyzed);
    const check = entails(assumptions, line.formula);
    if (check.status === 'countermodel') {
      semanticFailure ??= {
        code: 'E-SEM-UNSOUND-STEP',
        line: line.lineNumber,
        ruleId,
        detail:
          `el paso no se sigue semánticamente de sus supuestos accesibles; ` +
          `contramodelo: ${describeValuation(check.valuation)}`,
      };
    } else if (check.status === 'not-applicable') {
      notApplicableReason ??= check.reason;
    }
  }

  if (semanticFailure) errors.push(semanticFailure);

  // 6) Conclusión final: profundidad 0 y sin supuestos abiertos.
  const last = analyzed[analyzed.length - 1] as AnalyzedLine;
  if (last.depth !== 0) {
    errors.push({
      code: 'E-STRUCT-OPEN-ASSUMPTION',
      line: last.lineNumber,
      detail: 'la derivación termina con una subprueba abierta: el supuesto nunca se descarga',
    });
    errors.push({
      code: 'E-STRUCT-CONCLUSION-DEPTH',
      line: last.lineNumber,
      detail: `la conclusión final debe estar en profundidad 0 (está en ${last.depth})`,
    });
  }

  let goalReached: boolean | undefined;
  if (input.goal !== undefined) {
    try {
      goalReached = last.depth === 0 && equals(parse(input.goal), last.formula);
    } catch {
      goalReached = false;
    }
  }

  const semanticCheck: SemanticCheck = semanticFailure
    ? 'failed'
    : notApplicableReason
      ? 'not-applicable'
      : 'passed';

  return result(errors, semanticCheck, notApplicableReason, goalReached);
}

function result(
  errors: readonly VerificationError[],
  semanticCheck: SemanticCheck,
  semanticCheckReason?: string,
  goalReached?: boolean,
): VerificationResult {
  const lines = errors.map((e) => e.line).filter((l): l is number => typeof l === 'number');
  return {
    valid: errors.length === 0,
    ...(goalReached === undefined ? {} : { goalReached }),
    ...(lines.length > 0 ? { firstInvalidStep: Math.min(...lines) } : {}),
    errors,
    semanticCheck,
    ...(semanticCheckReason === undefined ? {} : { semanticCheckReason }),
    authorizedCalculusVersion: AUTHORIZED_CALCULUS_VERSION,
    verifierVersion: VERIFIER_VERSION,
  };
}

/** Premisas de nivel 0 más los supuestos de las subpruebas abiertas en esa línea. */
function accessibleAssumptions(line: AnalyzedLine, analyzed: readonly AnalyzedLine[]): Formula[] {
  const assumptions: Formula[] = [];
  for (const other of analyzed) {
    if (other.lineNumber >= line.lineNumber) break;
    if (other.rule === 'PR' && other.depth === 0) assumptions.push(other.formula);
  }
  for (const blockStart of line.blockPath) {
    const opener = analyzed[blockStart - 1];
    if (opener && opener.rule === 'AS') assumptions.push(opener.formula);
  }
  return assumptions;
}

function resolveReferences(
  line: AnalyzedLine,
  analyzed: readonly AnalyzedLine[],
  subproofs: ReadonlyMap<number, Subproof>,
): { lines: CitedLine[]; subproofs: CitedSubproof[]; errors: VerificationError[] } {
  const citedLines: CitedLine[] = [];
  const citedSubproofs: CitedSubproof[] = [];
  const errors: VerificationError[] = [];

  for (const ref of line.refs) {
    if (isRange(ref)) {
      const [start, end] = ref;
      const label = `${start}-${end}`;

      if (end >= line.lineNumber || start >= line.lineNumber) {
        errors.push({
          code: 'E-REF-FORWARD',
          line: line.lineNumber,
          references: [label],
          detail: 'toda cita precede a la línea que la usa',
        });
        continue;
      }

      const sub = subproofs.get(start);
      if (!sub || sub.end !== end) {
        errors.push({
          code: 'E-REF-SUBPROOF-INCOMPLETE',
          line: line.lineNumber,
          references: [label],
          detail: 'una subprueba citada debe ser completa: el rango no coincide con ninguna subprueba',
        });
        continue;
      }

      if (!isAccessible(sub.parentPath, line.blockPath)) {
        errors.push({
          code: 'E-REF-SUBPROOF-NESTED-CLOSED',
          line: line.lineNumber,
          references: [label],
          detail: 'la subprueba citada está dentro de una subprueba ya cerrada',
        });
        continue;
      }

      const opener = analyzed[start - 1];
      const closer = analyzed[end - 1];
      if (!opener || !closer || opener.rule !== 'AS') {
        errors.push({
          code: 'E-REF-SUBPROOF-INCOMPLETE',
          line: line.lineNumber,
          references: [label],
          detail: 'la subprueba citada no comienza con AS',
        });
        continue;
      }

      citedSubproofs.push({
        start,
        end,
        assumption: opener.formula,
        conclusion: closer.formula,
      });
      continue;
    }

    const target = analyzed[ref - 1];
    if (ref < 1 || !target) {
      errors.push({
        code: 'E-SYN-PARSE',
        line: line.lineNumber,
        references: [String(ref)],
        detail: `cita a una línea inexistente (${ref})`,
      });
      continue;
    }

    if (ref >= line.lineNumber) {
      errors.push({
        code: 'E-REF-FORWARD',
        line: line.lineNumber,
        references: [String(ref)],
        detail: 'toda cita precede a la línea que la usa',
      });
      continue;
    }

    if (!isAccessible(target.blockPath, line.blockPath)) {
      errors.push({
        code: 'E-REF-CLOSED',
        line: line.lineNumber,
        references: [String(ref)],
        detail: 'la línea citada está dentro de una subprueba cerrada y ya no es accesible',
      });
      continue;
    }

    citedLines.push({ lineNumber: ref, formula: target.formula });
  }

  return { lines: citedLines, subproofs: citedSubproofs, errors };
}

/** Reimpresión canónica de una derivación, para trazas y golden tests. */
export function printProof(input: ProofInput): string {
  return input.lines
    .map((line, i) => {
      const refs = (line.refs ?? [])
        .map((r) => (isRange(r) ? `${r[0]}-${r[1]}` : String(r)))
        .join(', ');
      const indent = '| '.repeat(line.depth);
      let formula: string;
      try {
        formula = print(parse(line.formula));
      } catch {
        formula = line.formula;
      }
      return `${i + 1}. ${indent}${formula}   ${line.rule}${refs ? ' ' + refs : ''}`;
    })
    .join('\n');
}
