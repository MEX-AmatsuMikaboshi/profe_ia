import { atoms, type Formula } from './ast.js';

/**
 * Oráculo semántico independiente (Plan.md T-H2-07 ← P-II §4.1.1).
 *
 * Semántica clásica bivalente veritativo-funcional con `v(⊥)=F`.
 *
 * **Asimetría literal**: si encuentra un contraejemplo a `Γ ⊨ φ`, puede
 * rechazar una pretensión de derivación por contraposición de la sanidad. Si
 * confirma `Γ ⊨ φ`, **no** certifica `Γ ⊢ φ`: la completitud de esta
 * implementación no se afirma (`completeness_claimed: false`).
 */

export type Valuation = Readonly<Record<string, boolean>>;

export function evaluate(f: Formula, v: Valuation): boolean {
  switch (f.kind) {
    case 'atom':
      return v[f.name] ?? false;
    case 'falsum':
      return false;
    case 'not':
      return !evaluate(f.sub, v);
    case 'and':
      return evaluate(f.left, v) && evaluate(f.right, v);
    case 'or':
      return evaluate(f.left, v) || evaluate(f.right, v);
    case 'implies':
      return !evaluate(f.left, v) || evaluate(f.right, v);
    case 'iff':
      return evaluate(f.left, v) === evaluate(f.right, v);
  }
}

/**
 * Cota de enumeración por tabla de verdad.
 *
 * `[CALIBRATION CALC-05 / CAL-SAT-ROUTE]`: la ruta tabla↔SAT y el motor SAT
 * quedan por calibrar (P-II §4.1.1). Hasta entonces el oráculo **no adivina**:
 * por encima de la cota devuelve `not-applicable` con razón prevista en vez de
 * afirmar validez o invalidez.
 */
export const MAX_ATOMS_FOR_TRUTH_TABLE = 16;

export type EntailmentResult =
  | { readonly status: 'entails' }
  | { readonly status: 'countermodel'; readonly valuation: Valuation }
  | { readonly status: 'not-applicable'; readonly reason: string };

/** ¿`premises ⊨ conclusion`? Enumeración exhaustiva sobre los átomos presentes. */
export function entails(
  premises: readonly Formula[],
  conclusion: Formula,
): EntailmentResult {
  const names: string[] = [];
  for (const f of [...premises, conclusion]) atoms(f, names);

  if (names.length > MAX_ATOMS_FOR_TRUTH_TABLE) {
    return {
      status: 'not-applicable',
      reason: `atom_count_exceeds_table_bound:${names.length}>${MAX_ATOMS_FOR_TRUTH_TABLE} (CALC-05 pendiente)`,
    };
  }

  const total = 2 ** names.length;
  for (let mask = 0; mask < total; mask += 1) {
    const valuation: Record<string, boolean> = {};
    for (const [i, name] of names.entries()) {
      valuation[name] = (mask & (1 << i)) !== 0;
    }
    if (premises.every((p) => evaluate(p, valuation)) && !evaluate(conclusion, valuation)) {
      return { status: 'countermodel', valuation };
    }
  }
  return { status: 'entails' };
}

/** Presentación determinista de un contramodelo, para la traza de auditoría. */
export function describeValuation(v: Valuation): string {
  return Object.keys(v)
    .sort()
    .map((name) => `${name}=${v[name] ? 'V' : 'F'}`)
    .join(', ');
}
