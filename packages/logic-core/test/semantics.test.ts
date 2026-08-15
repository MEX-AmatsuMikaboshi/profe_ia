import { describe, expect, it } from 'vitest';
import { parse } from '../src/parser.js';
import {
  MAX_ATOMS_FOR_TRUTH_TABLE,
  describeValuation,
  entails,
  evaluate,
} from '../src/semantics.js';

/**
 * Oráculo semántico: tablas de verdad clásicas bivalentes con `v(⊥)=F`
 * (P-II §4.1.1). Se comprueba conectivo por conectivo, más la cota de
 * enumeración y la asimetría de uso.
 */

const V = { A: true, B: false, C: true };

describe('evaluación veritativo-funcional', () => {
  it('⊥ es siempre falso', () => {
    expect(evaluate(parse('⊥'), {})).toBe(false);
    expect(evaluate(parse('⊥'), V)).toBe(false);
  });

  it('un átomo ausente de la valuación se toma como falso', () => {
    expect(evaluate(parse('Z'), V)).toBe(false);
  });

  it.each([
    ['¬A', false],
    ['¬B', true],
    ['A∧B', false],
    ['A∧C', true],
    ['B∧C', false],
    ['A∨B', true],
    ['B∨B', false],
    ['A→B', false],
    ['B→A', true],
    ['B→B', true],
    ['A→C', true],
    ['A↔C', true],
    ['A↔B', false],
    ['B↔B', true],
  ])('%s evalúa a %s bajo A=V, B=F, C=V', (formula, expected) => {
    expect(evaluate(parse(formula), V)).toBe(expected);
  });

  it('las cuatro filas del condicional son las clásicas', () => {
    const rows: [boolean, boolean, boolean][] = [
      [true, true, true],
      [true, false, false],
      [false, true, true],
      [false, false, true],
    ];
    for (const [a, b, expected] of rows) {
      expect(evaluate(parse('A→B'), { A: a, B: b }), `A=${a} B=${b}`).toBe(expected);
    }
  });

  it('las cuatro filas del bicondicional son las clásicas', () => {
    const rows: [boolean, boolean, boolean][] = [
      [true, true, true],
      [true, false, false],
      [false, true, false],
      [false, false, true],
    ];
    for (const [a, b, expected] of rows) {
      expect(evaluate(parse('A↔B'), { A: a, B: b }), `A=${a} B=${b}`).toBe(expected);
    }
  });
});

describe('consecuencia lógica', () => {
  it('afirma consecuencia cuando no hay contramodelo', () => {
    expect(entails([parse('A∧B')], parse('A')).status).toBe('entails');
    expect(entails([parse('A'), parse('A→B')], parse('B')).status).toBe('entails');
    expect(entails([], parse('A∨¬A')).status).toBe('entails');
  });

  it('devuelve un contramodelo concreto cuando falla', () => {
    const result = entails([parse('A∨B')], parse('A'));
    expect(result.status).toBe('countermodel');
    if (result.status === 'countermodel') {
      // El contramodelo debe refutar de verdad: premisas verdaderas, conclusión falsa.
      expect(evaluate(parse('A∨B'), result.valuation)).toBe(true);
      expect(evaluate(parse('A'), result.valuation)).toBe(false);
    }
  });

  it('de ⊥ se sigue todo', () => {
    expect(entails([parse('⊥')], parse('A∧B')).status).toBe('entails');
  });

  it('premisas contradictorias implican cualquier cosa', () => {
    expect(entails([parse('A'), parse('¬A')], parse('B')).status).toBe('entails');
  });

  it('no confunde dirección: A→B no implica B→A', () => {
    expect(entails([parse('A→B')], parse('B→A')).status).toBe('countermodel');
  });
});

describe('cota de enumeración (CALC-05 pendiente)', () => {
  it('no adivina por encima de la cota: devuelve not-applicable con razón', () => {
    const atoms = Array.from({ length: MAX_ATOMS_FOR_TRUTH_TABLE + 1 }, (_, i) =>
      String.fromCharCode(65 + i),
    );
    const conjunction = atoms.reduce((acc, name) => (acc ? `(${acc})∧${name}` : name), '');
    const result = entails([parse(conjunction)], parse('A'));
    expect(result.status).toBe('not-applicable');
    if (result.status === 'not-applicable') {
      expect(result.reason).toContain('atom_count_exceeds_table_bound');
      expect(result.reason).toContain('CALC-05');
    }
  });

  it('justo en la cota sí evalúa', () => {
    const atoms = Array.from({ length: MAX_ATOMS_FOR_TRUTH_TABLE }, (_, i) =>
      String.fromCharCode(65 + i),
    );
    const conjunction = atoms.reduce((acc, name) => (acc ? `(${acc})∧${name}` : name), '');
    expect(entails([parse(conjunction)], parse('A')).status).toBe('entails');
  });
});

describe('presentación del contramodelo', () => {
  it('es determinista y ordenada alfabéticamente', () => {
    expect(describeValuation({ B: false, A: true })).toBe('A=V, B=F');
    expect(describeValuation({ A: true, B: false })).toBe('A=V, B=F');
  });

  it('no omite átomos falsos', () => {
    expect(describeValuation({ A: false })).toBe('A=F');
  });
});
