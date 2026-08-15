/**
 * AST de verificación (Plan.md T-H2-02 ← P-II §4.1.1).
 *
 * `⊥` es un **átomo distinguido**, no un conectivo. Los binarios son
 * estrictamente binarios y no hay precedencia: `(A∧B)∧C` y `A∧(B∧C)` son
 * fórmulas distintas y `A∧B∧C` no es una fórmula.
 */

export type BinaryOp = 'and' | 'or' | 'implies' | 'iff';

export type Formula =
  | { readonly kind: 'atom'; readonly name: string }
  | { readonly kind: 'falsum' }
  | { readonly kind: 'not'; readonly sub: Formula }
  | { readonly kind: BinaryOp; readonly left: Formula; readonly right: Formula };

export const atom = (name: string): Formula => ({ kind: 'atom', name });
export const falsum: Formula = { kind: 'falsum' };
export const not = (sub: Formula): Formula => ({ kind: 'not', sub });
export const bin = (kind: BinaryOp, left: Formula, right: Formula): Formula => ({
  kind,
  left,
  right,
});

export const BINARY_SYMBOL: Readonly<Record<BinaryOp, string>> = Object.freeze({
  and: '∧',
  or: '∨',
  implies: '→',
  iff: '↔',
});

export const isBinary = (f: Formula): f is Extract<Formula, { left: Formula }> =>
  f.kind === 'and' || f.kind === 'or' || f.kind === 'implies' || f.kind === 'iff';

/** Operador principal de la fórmula, para `E-RULE-MAINOP`. */
export const mainOperator = (f: Formula): string =>
  f.kind === 'atom' ? 'atom' : f.kind === 'falsum' ? 'falsum' : f.kind;

/**
 * Impresión canónica. Los corchetes exteriores se omiten (única omisión
 * autorizada), así que `parse(print(ast))` conserva el AST.
 */
export function print(f: Formula): string {
  switch (f.kind) {
    case 'atom':
      return printAtomName(f.name);
    case 'falsum':
      return '⊥';
    case 'not':
      return `¬${printInner(f.sub)}`;
    default:
      return `${printInner(f.left)}${BINARY_SYMBOL[f.kind]}${printInner(f.right)}`;
  }
}

/** Toda subfórmula binaria va entre corchetes: no hay precedencia que la desambigüe. */
function printInner(f: Formula): string {
  return isBinary(f) ? `(${print(f)})` : print(f);
}

/** `A` sin subíndice; `A_1` con subíndice (forma canónica de impresión). */
function printAtomName(name: string): string {
  const digits = name.slice(1);
  return digits.length > 0 ? `${name[0]}_${digits}` : name;
}

/** Igualdad estructural. No hay normalización conmutativa/asociativa (P-II §4.1.1). */
export function equals(a: Formula, b: Formula): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'atom':
      return a.name === (b as Extract<Formula, { kind: 'atom' }>).name;
    case 'falsum':
      return true;
    case 'not':
      return equals(a.sub, (b as Extract<Formula, { kind: 'not' }>).sub);
    default: {
      const other = b as Extract<Formula, { left: Formula }>;
      return equals(a.left, other.left) && equals(a.right, other.right);
    }
  }
}

/** Átomos que aparecen en la fórmula, en orden de aparición y sin repetir. */
export function atoms(f: Formula, acc: string[] = []): string[] {
  switch (f.kind) {
    case 'atom':
      if (!acc.includes(f.name)) acc.push(f.name);
      return acc;
    case 'falsum':
      return acc;
    case 'not':
      return atoms(f.sub, acc);
    default:
      atoms(f.left, acc);
      return atoms(f.right, acc);
  }
}

/** Renombrado biyectivo de átomos (propiedad PBT: no cambia el veredicto). */
export function renameAtoms(f: Formula, mapping: Readonly<Record<string, string>>): Formula {
  switch (f.kind) {
    case 'atom':
      return atom(mapping[f.name] ?? f.name);
    case 'falsum':
      return falsum;
    case 'not':
      return not(renameAtoms(f.sub, mapping));
    default:
      return bin(f.kind, renameAtoms(f.left, mapping), renameAtoms(f.right, mapping));
  }
}
