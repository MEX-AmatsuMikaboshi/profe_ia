import {
  equals,
  falsum,
  parse,
  print,
  verify,
  type Formula,
  type ProofLineInput,
  type Reference,
} from '@profesor-ia/logic-core';
import { entails } from '@profesor-ia/logic-core';
import type {
  FoundProof,
  SearchBudget,
  SearchMode,
  SearchOutcome,
  SearchRequest,
  SearchTelemetry,
} from './types.js';

/**
 * Buscador Fitch heurístico y exhaustivo-hasta-k (Plan.md T-H2-08).
 *
 * Corte primario: unidades de trabajo deterministas. El orden de exploración
 * está fijado y versionado; no hay azar, así que no hace falta semilla.
 *
 * `no_proof_exists_in_calculus` **no existe** en esta implementación: exige un
 * decisor terminante cuya sanidad y completitud estén documentadas para la
 * misma `authorizedCalculusVersion` (CALC-03). Mientras no exista, el buscador
 * solo puede decir «no encontré», nunca «no existe».
 */

export const SEARCH_ORDER_VERSION = 'search-order-v1' as const;

/**
 * El buscador produjo un certificado que `logic-core` rechaza. No es un
 * resultado de búsqueda sino una inconsistencia sistémica entre buscador y
 * verificador (P-I §13.1, nivel 3): se propaga para que el pipeline la trate
 * como incidente y no la confunda con «no encontré prueba».
 */
export class CertificateRejectedError extends Error {
  constructor(
    readonly goal: string,
    readonly verificationCodes: readonly string[],
  ) {
    super(
      `el certificado producido para «${goal}» no pasó la re-verificación de logic-core: ` +
        `${verificationCodes.join(', ') || 'sin códigos'}`,
    );
    this.name = 'CertificateRejectedError';
  }
}

/** Término de derivación antes de linealizar a líneas Fitch. */
type Term =
  | { kind: 'have'; formula: Formula }
  | {
      kind: 'rule';
      rule: string;
      formula: Formula;
      args: Term[];
      subs: { assumption: Formula; body: Term }[];
    };

const key = (f: Formula): string => print(f);
const contextKey = (fs: readonly Formula[]): string => fs.map(key).sort().join('|');

class WorkBudget {
  private used = 0;
  private readonly startedAt = Date.now();
  wallTimeoutHit = false;

  constructor(private readonly budget: SearchBudget) {}

  /** Consume una unidad. Devuelve `false` cuando ya no se puede seguir. */
  spend(): boolean {
    if (this.used >= this.budget.maxWorkUnits) return false;
    this.used += 1;
    // La salvaguarda de pared se consulta con poca frecuencia y solo protege
    // el proceso: no participa en ninguna afirmación lógica.
    if (this.budget.wallTimeoutMs !== undefined && this.used % 512 === 0) {
      if (Date.now() - this.startedAt > this.budget.wallTimeoutMs) {
        this.wallTimeoutHit = true;
        return false;
      }
    }
    return true;
  }

  get exhausted(): boolean {
    return this.used >= this.budget.maxWorkUnits || this.wallTimeoutHit;
  }

  get spent(): number {
    return this.used;
  }
}

/** Eliminaciones aplicables hacia adelante, en orden fijo y versionado. */
function forwardSteps(available: readonly Formula[]): { formula: Formula; term: Term }[] {
  const out: { formula: Formula; term: Term }[] = [];
  const have = (f: Formula) => available.some((a) => equals(a, f));

  for (const f of available) {
    if (f.kind === 'and') {
      for (const side of [f.left, f.right]) {
        if (!have(side)) {
          out.push({
            formula: side,
            term: { kind: 'rule', rule: '∧E', formula: side, args: [{ kind: 'have', formula: f }], subs: [] },
          });
        }
      }
    }
    if (f.kind === 'not' && f.sub.kind === 'not' && !have(f.sub.sub)) {
      out.push({
        formula: f.sub.sub,
        term: { kind: 'rule', rule: 'DNE', formula: f.sub.sub, args: [{ kind: 'have', formula: f }], subs: [] },
      });
    }
    if (f.kind === 'implies') {
      const antecedent = f.left;
      if (have(antecedent) && !have(f.right)) {
        out.push({
          formula: f.right,
          term: {
            kind: 'rule',
            rule: '→E',
            formula: f.right,
            args: [
              { kind: 'have', formula: f },
              { kind: 'have', formula: antecedent },
            ],
            subs: [],
          },
        });
      }
    }
    if (f.kind === 'iff') {
      for (const [from, to] of [
        [f.left, f.right],
        [f.right, f.left],
      ] as const) {
        if (have(from) && !have(to)) {
          out.push({
            formula: to,
            term: {
              kind: 'rule',
              rule: '↔E',
              formula: to,
              args: [
                { kind: 'have', formula: f },
                { kind: 'have', formula: from },
              ],
              subs: [],
            },
          });
        }
      }
    }
    if (f.kind === 'not') {
      const positive = f.sub;
      if (have(positive) && !have(falsum)) {
        out.push({
          formula: falsum,
          term: {
            kind: 'rule',
            rule: '¬E',
            formula: falsum,
            args: [
              { kind: 'have', formula: positive },
              { kind: 'have', formula: f },
            ],
            subs: [],
          },
        });
      }
    }
  }
  return out;
}

interface SearchState {
  readonly work: WorkBudget;
  readonly visiting: Set<string>;
  maxCostSeen: number;
}

/**
 * Búsqueda acotada por número de líneas derivadas. Devuelve `null` cuando no
 * encuentra prueba **dentro de esa cota** (nunca «no existe»).
 */
function prove(
  goal: Formula,
  available: readonly Formula[],
  linesLeft: number,
  state: SearchState,
): Term | null {
  if (state.work.exhausted) return null;

  for (const f of available) {
    if (equals(f, goal)) return { kind: 'have', formula: goal };
  }
  if (linesLeft <= 0) return null;

  const stateKey = `${key(goal)}⊢${contextKey(available)}@${linesLeft}`;
  if (state.visiting.has(stateKey)) return null; // poda conservativa: estado idéntico
  state.visiting.add(stateKey);
  state.maxCostSeen = Math.max(state.maxCostSeen, linesLeft);

  try {
    // 1. Explosión: si ⊥ es alcanzable, cualquier meta se sigue.
    if (available.some((f) => f.kind === 'falsum') && goal.kind !== 'falsum') {
      if (!state.work.spend()) return null;
      return {
        kind: 'rule',
        rule: 'X',
        formula: goal,
        args: [{ kind: 'have', formula: falsum }],
        subs: [],
      };
    }

    // 2. Introducciones dirigidas por la forma de la meta.
    if (goal.kind === 'and') {
      if (!state.work.spend()) return null;
      const left = prove(goal.left, available, linesLeft - 1, state);
      if (left) {
        const right = prove(goal.right, available, linesLeft - 1, state);
        if (right) {
          return { kind: 'rule', rule: '∧I', formula: goal, args: [left, right], subs: [] };
        }
      }
    }

    if (goal.kind === 'implies') {
      if (!state.work.spend()) return null;
      const extended = [...available, goal.left];
      const body = prove(goal.right, extended, linesLeft - 1, state);
      if (body) {
        return {
          kind: 'rule',
          rule: '→I',
          formula: goal,
          args: [],
          subs: [{ assumption: goal.left, body }],
        };
      }
    }

    if (goal.kind === 'not') {
      if (!state.work.spend()) return null;
      const body = prove(falsum, [...available, goal.sub], linesLeft - 1, state);
      if (body) {
        return {
          kind: 'rule',
          rule: '¬I',
          formula: goal,
          args: [],
          subs: [{ assumption: goal.sub, body }],
        };
      }
    }

    if (goal.kind === 'iff') {
      if (!state.work.spend()) return null;
      const forward = prove(goal.right, [...available, goal.left], linesLeft - 1, state);
      if (forward) {
        const backward = prove(goal.left, [...available, goal.right], linesLeft - 1, state);
        if (backward) {
          return {
            kind: 'rule',
            rule: '↔I',
            formula: goal,
            args: [],
            subs: [
              { assumption: goal.left, body: forward },
              { assumption: goal.right, body: backward },
            ],
          };
        }
      }
    }

    if (goal.kind === 'or') {
      if (!state.work.spend()) return null;
      for (const side of [goal.left, goal.right]) {
        const sub = prove(side, available, linesLeft - 1, state);
        if (sub) {
          return { kind: 'rule', rule: '∨I', formula: goal, args: [sub], subs: [] };
        }
      }
    }

    // 3. Eliminaciones hacia adelante.
    for (const step of forwardSteps(available)) {
      if (!state.work.spend()) return null;
      const rest = prove(goal, [...available, step.formula], linesLeft - 1, state);
      if (rest) return substitute(rest, step);
    }

    // 4. Análisis de casos: la **única** forma de usar una disyunción.
    //
    // No cabe en los otros dos sitios y por eso faltaba: no es una introducción
    // dirigida por la meta —la meta puede ser cualquier cosa— ni una
    // eliminación hacia adelante, porque no produce una subfórmula de lo
    // disponible sino la meta entera, y a cambio de dos subpruebas. Mientras no
    // estuvo, **ninguna premisa disyuntiva era utilizable**: `A∨B ⊢ B∨A` no se
    // probaba, y el buscador lo reportaba como «no encontré» —que es cierto y
    // por eso el hueco no se veía—.
    //
    // Va después de las eliminaciones y antes de IP: abrir dos subpruebas es
    // más caro que cualquier eliminación, y IP sigue siendo el último recurso.
    for (const f of available) {
      if (f.kind !== 'or') continue;
      // Con un disyunto ya disponible, el análisis de casos no añade nada: esa
      // rama repetiría el contexto actual. Podarlo evita además volver a entrar
      // por la misma disyunción en la recursión.
      if (available.some((a) => equals(a, f.left) || equals(a, f.right))) continue;
      if (!state.work.spend()) return null;

      const left = prove(goal, [...available, f.left], linesLeft - 1, state);
      if (!left) continue;
      const right = prove(goal, [...available, f.right], linesLeft - 1, state);
      if (!right) continue;

      return {
        kind: 'rule',
        rule: '∨E',
        formula: goal,
        args: [{ kind: 'have', formula: f }],
        subs: [
          { assumption: f.left, body: left },
          { assumption: f.right, body: right },
        ],
      };
    }

    // 5. Prueba indirecta como último recurso (regla primitiva del cálculo).
    if (goal.kind !== 'falsum') {
      if (!state.work.spend()) return null;
      const negated: Formula = { kind: 'not', sub: goal };
      const body = prove(falsum, [...available, negated], linesLeft - 1, state);
      if (body) {
        return {
          kind: 'rule',
          rule: 'IP',
          formula: goal,
          args: [],
          subs: [{ assumption: negated, body }],
        };
      }
    }

    return null;
  } finally {
    state.visiting.delete(stateKey);
  }
}

/** Inserta la derivación de un paso hacia adelante donde se use su fórmula. */
function substitute(term: Term, step: { formula: Formula; term: Term }): Term {
  if (term.kind === 'have') {
    return equals(term.formula, step.formula) ? step.term : term;
  }
  return {
    ...term,
    args: term.args.map((a) => substitute(a, step)),
    subs: term.subs.map((s) => ({ ...s, body: substitute(s.body, step) })),
  };
}

/** Linealiza el término a líneas Fitch numeradas. */
function linearize(premises: readonly Formula[], term: Term): ProofLineInput[] {
  const lines: ProofLineInput[] = [];
  const scopes: Map<string, number>[] = [new Map()];

  const lookup = (f: Formula): number | undefined => {
    for (let i = scopes.length - 1; i >= 0; i -= 1) {
      const found = scopes[i]?.get(key(f));
      if (found !== undefined) return found;
    }
    return undefined;
  };

  const record = (f: Formula, lineNumber: number): void => {
    scopes[scopes.length - 1]?.set(key(f), lineNumber);
  };

  for (const premise of premises) {
    lines.push({ formula: print(premise), rule: 'PR', depth: 0 });
    record(premise, lines.length);
  }

  const emit = (t: Term, depth: number): number => {
    const existing = lookup(t.formula);
    if (existing !== undefined) return existing;

    if (t.kind === 'have') {
      // Debe estar disponible por construcción; si no, la derivación es incoherente.
      throw new Error(`fórmula no disponible al linealizar: ${print(t.formula)}`);
    }

    const refs: Reference[] = [];
    for (const arg of t.args) refs.push(emit(arg, depth));

    for (const sub of t.subs) {
      scopes.push(new Map());
      lines.push({ formula: print(sub.assumption), rule: 'AS', depth: depth + 1 });
      const start = lines.length;
      record(sub.assumption, start);
      let end = emit(sub.body, depth + 1);
      // Si la conclusión de la subprueba ya estaba disponible fuera, su línea
      // vive en un ámbito exterior: hay que **reiterarla dentro** para que la
      // subprueba termine en una línea propia (convención Fitch).
      if (end < start) {
        lines.push({
          formula: print(sub.body.formula),
          rule: 'R',
          refs: [end],
          depth: depth + 1,
        });
        end = lines.length;
      }
      scopes.pop();
      refs.push([start, end] as const);
    }

    lines.push({ formula: print(t.formula), rule: t.rule, refs, depth });
    const lineNumber = lines.length;
    record(t.formula, lineNumber);
    return lineNumber;
  };

  const conclusion = emit(term, 0);

  // La misma convención Fitch que dentro de una subprueba, aplicada al ámbito
  // principal: si la conclusión ya estaba disponible en una línea anterior
  // —caso típico, la meta es una de las premisas y no la última—, `emit`
  // devuelve esa línea y no añade ninguna, así que la derivación **terminaría
  // en otra fórmula**. `verify` respondería `goalReached: false` sin ningún
  // código de error, y la re-verificación obligatoria escalaría a incidente de
  // nivel 3 una meta que solo era trivial. Se reitera para que la última línea
  // sea la meta.
  if (conclusion !== lines.length) {
    lines.push({ formula: print(term.formula), rule: 'R', refs: [conclusion], depth: 0 });
  }

  return lines;
}

function collectRules(term: Term, acc: Set<string> = new Set()): Set<string> {
  if (term.kind === 'rule') {
    acc.add(term.rule);
    for (const a of term.args) collectRules(a, acc);
    for (const s of term.subs) collectRules(s.body, acc);
  }
  return acc;
}

const telemetryOf = (
  work: WorkBudget,
  mode: SearchMode,
  costExplored: number,
): SearchTelemetry => ({
  workUnits: work.spent,
  costExplored,
  wallTimeoutHit: work.wallTimeoutHit,
  mode,
  searchOrderVersion: SEARCH_ORDER_VERSION,
});

/**
 * Posición del oráculo semántico en el pipeline (BENCH-04, T-H2-16).
 *
 * `prefilter` es el orden por omisión y el que hoy usa la autoría. Las otras
 * dos existen para poder **medir** el orden en L0 antes de congelarlo (P-I
 * §7.4): no se adopta un orden como ley universal sin medición.
 *
 *  - `prefilter`  — oráculo antes de buscar (orden de referencia);
 *  - `postfilter` — buscar primero y consultar al oráculo solo si no hubo
 *    prueba; mismos veredictos, distinto trabajo;
 *  - `off`        — sin oráculo. **No es equivalente**: sin él, un candidato
 *    semánticamente inválido solo puede reportarse como presupuesto agotado.
 */
export type SemanticOraclePlacement = 'prefilter' | 'postfilter' | 'off';

export interface SearchOptions {
  readonly semanticOracle?: SemanticOraclePlacement;
}

/**
 * Busca una derivación. Todo certificado se **re-verifica con `logic-core`**
 * antes de aceptarse (P-I §7.4, punto 4): si la re-verificación falla, no se
 * devuelve `proof_found`.
 */
export function search(request: SearchRequest, options: SearchOptions = {}): SearchOutcome {
  const placement: SemanticOraclePlacement = options.semanticOracle ?? 'prefilter';
  const premises = request.premises.map(parse);
  const goal = parse(request.goal);
  const work = new WorkBudget(request.budget);

  /**
   * El oráculo solo puede **rechazar**: que no haya contramodelo no demuestra
   * derivabilidad en el cálculo (P-I §7.4, última línea).
   */
  const semanticRejection = (costExplored: number): SearchOutcome | null => {
    const semantic = entails(premises, goal);
    return semantic.status === 'countermodel'
      ? {
          status: 'semantically_invalid',
          countermodel: semantic.valuation,
          telemetry: telemetryOf(work, request.mode, costExplored),
        }
      : null;
  };

  // 1. Prefiltro semántico: el oráculo independiente puede rechazar de entrada.
  if (placement === 'prefilter') {
    const rejected = semanticRejection(0);
    if (rejected) return rejected;
  }

  const maxCost =
    request.mode === 'exhaustive_k' ? Math.max(1, request.budget.maxCost ?? 8) : 12;

  let exhaustivelyCovered = 0;

  for (let cost = 1; cost <= maxCost; cost += 1) {
    const state: SearchState = { work, visiting: new Set(), maxCostSeen: 0 };
    const term = prove(goal, premises, cost, state);

    if (term) {
      const lines = linearize(premises, term);
      const verification = verify({ lines, goal: request.goal });

      // Re-verificación obligatoria (P-I §7.4, punto 4). Que falle no es un
      // resultado de búsqueda: es una inconsistencia entre buscador y
      // verificador, y debe escalar como incidente en vez de disfrazarse de
      // «no encontré».
      if (!verification.valid || verification.goalReached !== true) {
        throw new CertificateRejectedError(request.goal, verification.errors.map((e) => e.code));
      }

      const derivedLines = lines.filter((l) => l.rule !== 'PR').length;
      const proof: FoundProof = {
        lines,
        cost: derivedLines,
        rulesUsed: [...collectRules(term)].sort(),
      };

      return {
        status: 'proof_found',
        proof,
        // Solo `exhaustive_k` que agotó todos los costes menores puede afirmarlo.
        minimalCostVerified: request.mode === 'exhaustive_k' && exhaustivelyCovered === cost - 1,
        telemetry: telemetryOf(work, request.mode, cost),
      };
    }

    if (work.exhausted) {
      // Postfiltro: el oráculo se consulta solo cuando la búsqueda no halló
      // prueba. El veredicto es el mismo que con prefiltro; el trabajo, no.
      if (placement === 'postfilter') {
        const rejected = semanticRejection(cost);
        if (rejected) return rejected;
      }
      return { status: 'search_budget_exhausted', telemetry: telemetryOf(work, request.mode, cost) };
    }
    // Se completó la cota `cost` sin agotar presupuesto: queda cubierta.
    exhaustivelyCovered = cost;
  }

  if (placement === 'postfilter') {
    const rejected = semanticRejection(maxCost);
    if (rejected) return rejected;
  }

  if (request.mode === 'exhaustive_k') {
    return {
      status: 'no_proof_with_cost_at_most_k',
      k: maxCost,
      telemetry: telemetryOf(work, request.mode, maxCost),
    };
  }

  return { status: 'search_budget_exhausted', telemetry: telemetryOf(work, request.mode, maxCost) };
}
