import { equals, mainOperator, type Formula } from './ast.js';
import { AUTHORIZED_RULE_IDS, FORBIDDEN_RULES_EXAMPLES, RULE_ALIASES, type RuleId } from './calculus.js';
import type { VerificationError } from './errors.js';

/**
 * Aplicación de las 14 formas autorizadas (Plan.md T-H2-05 ← tabla literal
 * P-II §4.1.1). Cualquier regla no listada **falla cerrado**.
 */

export interface CitedLine {
  readonly lineNumber: number;
  readonly formula: Formula;
}

export interface CitedSubproof {
  readonly start: number;
  readonly end: number;
  readonly assumption: Formula;
  readonly conclusion: Formula;
}

export interface RuleContext {
  readonly lineNumber: number;
  readonly conclusion: Formula;
  readonly lines: readonly CitedLine[];
  readonly subproofs: readonly CitedSubproof[];
}

/** Aridad exacta: número de citas de línea y de subprueba. */
export const RULE_ARITY: Readonly<Record<RuleId, { lines: number; subproofs: number }>> =
  Object.freeze({
    R: { lines: 1, subproofs: 0 },
    '∧I': { lines: 2, subproofs: 0 },
    '∧E': { lines: 1, subproofs: 0 },
    '∨I': { lines: 1, subproofs: 0 },
    '∨E': { lines: 1, subproofs: 2 },
    '→I': { lines: 0, subproofs: 1 },
    '→E': { lines: 2, subproofs: 0 },
    '↔I': { lines: 0, subproofs: 2 },
    '↔E': { lines: 2, subproofs: 0 },
    '¬I': { lines: 0, subproofs: 1 },
    '¬E': { lines: 2, subproofs: 0 },
    X: { lines: 1, subproofs: 0 },
    IP: { lines: 0, subproofs: 1 },
    DNE: { lines: 1, subproofs: 0 },
  });

/**
 * Canonicaliza el nombre de regla escrito por el alumno.
 * Un alias **nunca** sale de aquí: lo que se registra es el `rule_id`.
 */
export function canonicalRuleId(
  written: string,
): { ok: true; ruleId: RuleId } | { ok: false; error: VerificationError } {
  const trimmed = written.trim();

  if ((AUTHORIZED_RULE_IDS as readonly string[]).includes(trimmed)) {
    return { ok: true, ruleId: trimmed as RuleId };
  }

  const aliased = RULE_ALIASES[trimmed];
  if (aliased) return { ok: true, ruleId: aliased };

  const normalized = trimmed.toLowerCase();
  const forbidden = FORBIDDEN_RULES_EXAMPLES.find((r) => r.toLowerCase() === normalized);
  if (forbidden) {
    return {
      ok: false,
      error: {
        code: 'E-RULE-FORBIDDEN',
        detail: `«${trimmed}» no pertenece al cálculo autorizado: la whitelist es cerrada`,
      },
    };
  }

  return {
    ok: false,
    error: {
      code: 'E-RULE-UNKNOWN',
      detail: `regla desconocida «${trimmed}»`,
    },
  };
}

const shape = (lineNumber: number, ruleId: RuleId, detail: string): VerificationError => ({
  code: 'E-RULE-SHAPE',
  line: lineNumber,
  ruleId,
  detail,
});

const mainOp = (lineNumber: number, ruleId: RuleId, detail: string): VerificationError => ({
  code: 'E-RULE-MAINOP',
  line: lineNumber,
  ruleId,
  detail,
});

/** Comprueba la aridad declarada antes de mirar formas. */
export function checkArity(ruleId: RuleId, ctx: RuleContext): VerificationError | null {
  const expected = RULE_ARITY[ruleId];
  if (ctx.lines.length !== expected.lines || ctx.subproofs.length !== expected.subproofs) {
    return {
      code: 'E-RULE-ARITY',
      line: ctx.lineNumber,
      ruleId,
      detail:
        `${ruleId} exige ${expected.lines} cita(s) de línea y ${expected.subproofs} de subprueba; ` +
        `recibió ${ctx.lines.length} y ${ctx.subproofs.length}`,
    };
  }
  return null;
}

/** Aplica la regla. Devuelve `null` si el paso es correcto. */
export function applyRule(ruleId: RuleId, ctx: RuleContext): VerificationError | null {
  const arityError = checkArity(ruleId, ctx);
  if (arityError) return arityError;

  const { conclusion: c, lineNumber: n } = ctx;
  const L = (i: number): Formula => (ctx.lines[i] as CitedLine).formula;
  const S = (i: number): CitedSubproof => ctx.subproofs[i] as CitedSubproof;

  switch (ruleId) {
    case 'R':
      return equals(c, L(0)) ? null : shape(n, ruleId, 'R reitera exactamente la línea citada');

    case '∧I': {
      if (c.kind !== 'and') return mainOp(n, ruleId, '∧I concluye una conjunción');
      const ok =
        (equals(c.left, L(0)) && equals(c.right, L(1))) ||
        (equals(c.left, L(1)) && equals(c.right, L(0)));
      return ok ? null : shape(n, ruleId, 'los miembros de la conjunción deben ser las líneas citadas');
    }

    case '∧E': {
      const cited = L(0);
      if (cited.kind !== 'and') {
        return mainOp(n, ruleId, `∧E exige una conjunción; la línea citada es ${mainOperator(cited)}`);
      }
      return equals(c, cited.left) || equals(c, cited.right)
        ? null
        : shape(n, ruleId, '∧E concluye uno de los dos miembros de la conjunción citada');
    }

    case '∨I': {
      if (c.kind !== 'or') return mainOp(n, ruleId, '∨I concluye una disyunción');
      return equals(c.left, L(0)) || equals(c.right, L(0))
        ? null
        : shape(n, ruleId, 'uno de los disyuntos debe ser la línea citada');
    }

    case '∨E': {
      const disjunction = L(0);
      if (disjunction.kind !== 'or') {
        return mainOp(
          n,
          ruleId,
          `∨E exige una disyunción; la línea citada es ${mainOperator(disjunction)}`,
        );
      }
      const [a, b] = [S(0), S(1)];
      const matchesDisjuncts =
        (equals(a.assumption, disjunction.left) && equals(b.assumption, disjunction.right)) ||
        (equals(a.assumption, disjunction.right) && equals(b.assumption, disjunction.left));
      if (!matchesDisjuncts) {
        return shape(n, ruleId, 'cada subprueba debe suponer uno de los disyuntos citados');
      }
      return equals(a.conclusion, c) && equals(b.conclusion, c)
        ? null
        : shape(n, ruleId, 'ambas subpruebas deben llegar a la misma conclusión');
    }

    case '→I': {
      if (c.kind !== 'implies') return mainOp(n, ruleId, '→I concluye un condicional');
      const sub = S(0);
      return equals(c.left, sub.assumption) && equals(c.right, sub.conclusion)
        ? null
        : shape(n, ruleId, 'el condicional debe ir del supuesto a la conclusión de la subprueba');
    }

    case '→E': {
      const candidates: [Formula, Formula][] = [
        [L(0), L(1)],
        [L(1), L(0)],
      ];
      for (const [maybeCond, maybeAnt] of candidates) {
        if (
          maybeCond.kind === 'implies' &&
          equals(maybeCond.left, maybeAnt) &&
          equals(maybeCond.right, c)
        ) {
          return null;
        }
      }
      if (L(0).kind !== 'implies' && L(1).kind !== 'implies') {
        return mainOp(n, ruleId, '→E exige un condicional entre las líneas citadas');
      }
      return shape(n, ruleId, 'el antecedente citado y la conclusión deben corresponder al condicional');
    }

    case '↔I': {
      if (c.kind !== 'iff') return mainOp(n, ruleId, '↔I concluye un bicondicional');
      const [a, b] = [S(0), S(1)];
      const forward =
        equals(a.assumption, c.left) &&
        equals(a.conclusion, c.right) &&
        equals(b.assumption, c.right) &&
        equals(b.conclusion, c.left);
      const backward =
        equals(b.assumption, c.left) &&
        equals(b.conclusion, c.right) &&
        equals(a.assumption, c.right) &&
        equals(a.conclusion, c.left);
      return forward || backward
        ? null
        : shape(n, ruleId, 'se exigen las dos subpruebas φ⇒ψ y ψ⇒φ del bicondicional concluido');
    }

    case '↔E': {
      const candidates: [Formula, Formula][] = [
        [L(0), L(1)],
        [L(1), L(0)],
      ];
      for (const [maybeIff, side] of candidates) {
        if (maybeIff.kind !== 'iff') continue;
        if (equals(maybeIff.left, side) && equals(maybeIff.right, c)) return null;
        if (equals(maybeIff.right, side) && equals(maybeIff.left, c)) return null;
      }
      if (L(0).kind !== 'iff' && L(1).kind !== 'iff') {
        return mainOp(n, ruleId, '↔E exige un bicondicional entre las líneas citadas');
      }
      return shape(n, ruleId, 'de φ↔ψ y uno de sus lados se concluye el otro');
    }

    case '¬I': {
      if (c.kind !== 'not') return mainOp(n, ruleId, '¬I concluye una negación');
      const sub = S(0);
      if (sub.conclusion.kind !== 'falsum') {
        return shape(n, ruleId, '¬I exige que la subprueba termine en ⊥');
      }
      return equals(c.sub, sub.assumption)
        ? null
        : shape(n, ruleId, 'la negación concluida debe corresponder al supuesto de la subprueba');
    }

    case '¬E': {
      if (c.kind !== 'falsum') return mainOp(n, ruleId, '¬E concluye ⊥');
      const [x, y] = [L(0), L(1)];
      const contradiction =
        (x.kind === 'not' && equals(x.sub, y)) || (y.kind === 'not' && equals(y.sub, x));
      return contradiction
        ? null
        : shape(n, ruleId, '¬E exige φ y ¬φ entre las líneas citadas');
    }

    case 'X': {
      const cited = L(0);
      return cited.kind === 'falsum'
        ? null
        : mainOp(n, ruleId, `X exige ⊥; la línea citada es ${mainOperator(cited)}`);
    }

    case 'IP': {
      const sub = S(0);
      if (sub.conclusion.kind !== 'falsum') {
        return shape(n, ruleId, 'IP exige que la subprueba termine en ⊥');
      }
      if (sub.assumption.kind !== 'not') {
        return mainOp(n, ruleId, 'IP exige suponer ¬φ');
      }
      return equals(sub.assumption.sub, c)
        ? null
        : shape(n, ruleId, 'la conclusión debe ser la fórmula negada en el supuesto');
    }

    case 'DNE': {
      const cited = L(0);
      if (cited.kind !== 'not' || cited.sub.kind !== 'not') {
        return mainOp(n, ruleId, 'DNE exige ¬¬φ en la línea citada');
      }
      // Elimina **exactamente** dos negaciones.
      return equals(cited.sub.sub, c)
        ? null
        : shape(n, ruleId, 'DNE elimina exactamente dos negaciones');
    }
  }
}
