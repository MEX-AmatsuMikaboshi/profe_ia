import { ParseError } from './errors.js';

/**
 * Tokenizador con normalización **conservadora** (P-II §4.1.1):
 * alias → símbolo canónico, espacios, equivalencia de glyphs de corchetes y
 * canonicalización de subíndices. Nada más: ninguna reescritura lógica ocurre
 * aquí ni en ninguna otra parte de la ruta de verificación.
 */

export type TokenKind =
  | 'atom'
  | 'falsum'
  | 'not'
  | 'and'
  | 'or'
  | 'implies'
  | 'iff'
  | 'lparen'
  | 'rparen';

export interface Token {
  readonly kind: TokenKind;
  /** Nombre canónico del átomo (`A`, `A1`), solo para `kind === 'atom'`. */
  readonly name?: string;
  /** Posición 0-based en la entrada normalizada, para el detalle del error. */
  readonly at: number;
}

/** Alias de conectivo, ordenados de más largo a más corto para no partirlos. */
const CONNECTIVE_ALIASES: readonly (readonly [string, string])[] = [
  ['<->', '↔'],
  ['<=>', '↔'],
  ['_|_', '⊥'],
  ['->', '→'],
  ['=>', '→'],
  ['/\\', '∧'],
  ['\\/', '∨'],
  ['!?', '⊥'],
  ['#', '⊥'],
  ['&', '∧'],
  ['|', '∨'],
  ['~', '¬'],
  ['!', '¬'],
];

/** Rechazados explícitamente como alias de conectivo (P-II §4.1.1). */
const REJECTED_SYMBOL_ALIASES = ['>', '-'] as const;
const REJECTED_WORD_ALIASES = ['and', 'or', 'not', 'y', 'o', 'no'] as const;

const OPEN_BRACKETS = ['(', '[', '{', '⟨'] as const;
const CLOSE_BRACKETS = [')', ']', '}', '⟩'] as const;

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

/**
 * Normaliza la entrada a la forma canónica antes de tokenizar.
 * Devuelve también la cadena normalizada para que los errores citen posiciones
 * estables.
 */
export function normalize(input: string): string {
  let s = input.normalize('NFC');

  // Palabras rechazadas: se detectan antes de tocar nada más.
  //
  // La comparación es **sensible a mayúsculas** a propósito. Los alias
  // rechazados por P-II §4.1.1 son palabras en minúscula (`and`, `or`, `not`,
  // `y`, `o`, `no`), mientras que los átomos del lenguaje son letras A–Z: una
  // comparación insensible rechazaría los átomos válidos `O`, `Y` y `N`.
  for (const word of REJECTED_WORD_ALIASES) {
    const re = new RegExp(`(^|[^A-Za-z])${word}([^A-Za-z]|$)`);
    if (re.test(s)) {
      throw new ParseError(
        'E-SYN-ALIAS',
        `«${word}» no es un alias de conectivo autorizado (P-II §4.1.1)`,
      );
    }
  }
  // Primero los alias autorizados (de más largo a más corto): `->` es válido
  // aunque contenga `>`, que aislado sí está rechazado.
  for (const [alias, canonical] of CONNECTIVE_ALIASES) {
    s = s.split(alias).join(canonical);
  }

  // Lo que sobra de los símbolos rechazados ya no puede ser parte de un alias válido.
  for (const sym of REJECTED_SYMBOL_ALIASES) {
    if (s.includes(sym)) {
      throw new ParseError(
        'E-SYN-ALIAS',
        `«${sym}» está rechazado como alias de conectivo (P-II §4.1.1)`,
      );
    }
  }

  // Glyphs de corchetes: equivalentes entre sí.
  for (const b of OPEN_BRACKETS) s = s.split(b).join('(');
  for (const b of CLOSE_BRACKETS) s = s.split(b).join(')');

  // Subíndices Unicode → dígitos ASCII; `A_1` → `A1`.
  s = s.replace(/[₀-₉]/g, (d) => String(SUBSCRIPT_DIGITS.indexOf(d)));
  s = s.replace(/_(?=\d)/g, '');

  // Espacios, incluido el no separable (U+00A0).
  return s.replace(/[\s\u00A0]+/g, '');
}

export function tokenize(input: string): { tokens: Token[]; normalized: string } {
  const normalized = normalize(input);
  if (normalized.length === 0) {
    throw new ParseError('E-SYN-PARSE', 'fórmula vacía');
  }

  const tokens: Token[] = [];
  let i = 0;
  while (i < normalized.length) {
    const ch = normalized[i] as string;
    switch (ch) {
      case '(':
        tokens.push({ kind: 'lparen', at: i });
        i += 1;
        continue;
      case ')':
        tokens.push({ kind: 'rparen', at: i });
        i += 1;
        continue;
      case '¬':
        tokens.push({ kind: 'not', at: i });
        i += 1;
        continue;
      case '∧':
        tokens.push({ kind: 'and', at: i });
        i += 1;
        continue;
      case '∨':
        tokens.push({ kind: 'or', at: i });
        i += 1;
        continue;
      case '→':
        tokens.push({ kind: 'implies', at: i });
        i += 1;
        continue;
      case '↔':
        tokens.push({ kind: 'iff', at: i });
        i += 1;
        continue;
      case '⊥':
        tokens.push({ kind: 'falsum', at: i });
        i += 1;
        continue;
      default:
        break;
    }

    if (ch >= 'A' && ch <= 'Z') {
      let j = i + 1;
      while (j < normalized.length && normalized[j]! >= '0' && normalized[j]! <= '9') j += 1;
      tokens.push({ kind: 'atom', name: normalized.slice(i, j), at: i });
      i = j;
      continue;
    }

    throw new ParseError(
      'E-SYN-SYMBOL',
      `símbolo no autorizado «${ch}» en la posición ${i}; el lenguaje admite A–Z, ⊥ y ¬ ∧ ∨ → ↔`,
    );
  }

  return { tokens, normalized };
}
