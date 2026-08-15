import { atom, bin, falsum, not, type BinaryOp, type Formula } from './ast.js';
import { ParseError } from './errors.js';
import { tokenize, type Token } from './tokenizer.js';

/**
 * Parser estricto (P-II §4.1.1):
 *  - binarios estrictamente binarios, **sin precedencia** entre ellos;
 *  - corchetes obligatorios salvo los exteriores;
 *  - `A∧B∧C` se rechaza como sintaxis ambigua (`E-SYN-PRECEDENCE`);
 *  - `(A∧B)∧C` y `A∧(B∧C)` son fórmulas distintas.
 *
 * `¬` es unario y se aplica a la unidad inmediatamente siguiente (átomo, `⊥` o
 * fórmula entre corchetes). La ausencia de precedencia que fija el cálculo es
 * **entre conectivos binarios**; un unario aplicado a una unidad no introduce
 * ambigüedad.
 */

const BINARY_TOKEN_TO_OP: Partial<Record<Token['kind'], BinaryOp>> = {
  and: 'and',
  or: 'or',
  implies: 'implies',
  iff: 'iff',
};

class Cursor {
  private index = 0;
  constructor(private readonly tokens: readonly Token[]) {}

  peek(): Token | undefined {
    return this.tokens[this.index];
  }

  next(): Token | undefined {
    return this.tokens[this.index++];
  }

  get position(): number {
    return this.index;
  }

  get done(): boolean {
    return this.index >= this.tokens.length;
  }
}

/** Unidad: átomo, `⊥`, negación de una unidad, o una fórmula entre corchetes. */
function parseUnit(c: Cursor): Formula {
  const token = c.next();
  if (!token) throw new ParseError('E-SYN-PARSE', 'fórmula incompleta: se esperaba una subfórmula');

  switch (token.kind) {
    case 'atom':
      return atom(token.name as string);
    case 'falsum':
      return falsum;
    case 'not':
      return not(parseUnit(c));
    case 'lparen': {
      const inner = parseExpression(c);
      const close = c.next();
      if (!close || close.kind !== 'rparen') {
        throw new ParseError('E-SYN-PARSE', 'corchete sin cerrar');
      }
      return inner;
    }
    case 'rparen':
      throw new ParseError('E-SYN-PARSE', `corchete de cierre inesperado en la posición ${token.at}`);
    default:
      throw new ParseError(
        'E-SYN-PARSE',
        `se esperaba una subfórmula y apareció un conectivo binario en la posición ${token.at}`,
      );
  }
}

/** Expresión: una unidad, opcionalmente seguida de **un solo** conectivo binario. */
function parseExpression(c: Cursor): Formula {
  const left = parseUnit(c);
  const next = c.peek();
  if (!next) return left;

  const op = BINARY_TOKEN_TO_OP[next.kind];
  if (!op) return left;

  c.next();
  const right = parseUnit(c);

  const after = c.peek();
  if (after && BINARY_TOKEN_TO_OP[after.kind]) {
    throw new ParseError(
      'E-SYN-PRECEDENCE',
      `sintaxis ambigua en la posición ${after.at}: no hay precedencia entre conectivos binarios, ` +
        'toda fórmula binaria interna requiere corchetes',
    );
  }

  return bin(op, left, right);
}

/** Parsea una fórmula completa. Lanza `ParseError` con su código `E-SYN-*`. */
export function parse(input: string): Formula {
  const { tokens } = tokenize(input);
  const cursor = new Cursor(tokens);
  const formula = parseExpression(cursor);

  if (!cursor.done) {
    const rest = cursor.peek() as Token;
    if (rest.kind === 'rparen') {
      throw new ParseError('E-SYN-PARSE', `corchete de cierre sin apertura en la posición ${rest.at}`);
    }
    throw new ParseError(
      'E-SYN-PARSE',
      `sobran símbolos desde la posición ${rest.at} (${cursor.position} tokens consumidos)`,
    );
  }

  return formula;
}

/** Variante que no lanza: útil para clasificar sin control de flujo por excepción. */
export function tryParse(
  input: string,
): { ok: true; formula: Formula } | { ok: false; error: ParseError } {
  try {
    return { ok: true, formula: parse(input) };
  } catch (err) {
    if (err instanceof ParseError) return { ok: false, error: err };
    throw err;
  }
}
