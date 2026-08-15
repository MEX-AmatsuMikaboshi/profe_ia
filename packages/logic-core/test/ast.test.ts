import { describe, expect, it } from 'vitest';
import { atom, atoms, bin, falsum, mainOperator, not, print, renameAtoms } from '../src/ast.js';
import { parse } from '../src/parser.js';

/**
 * El AST se ejercita de sobra a través del parser y de las reglas, pero sus
 * funciones auxiliares solo se observaban **dentro del texto de los mensajes**
 * de error. Afirmar ese texto congelaría la redacción sin proteger ninguna
 * decisión (categoría 2 del baseline de mutación), así que se prueban aquí de
 * frente, que es donde sí gobiernan algo.
 */

describe('mainOperator: la forma que cada regla exige', () => {
  it('nombra el operador principal de cada forma del lenguaje', () => {
    expect(mainOperator(atom('A'))).toBe('atom');
    expect(mainOperator(falsum)).toBe('falsum');
    expect(mainOperator(not(atom('A')))).toBe('not');
    expect(mainOperator(bin('and', atom('A'), atom('B')))).toBe('and');
    expect(mainOperator(parse('A∨B'))).toBe('or');
    expect(mainOperator(parse('A→B'))).toBe('implies');
    expect(mainOperator(parse('A↔B'))).toBe('iff');
  });

  it('mira el operador principal, no los internos', () => {
    expect(mainOperator(parse('¬(A∧B)'))).toBe('not');
    expect(mainOperator(parse('(A∧B)→C'))).toBe('implies');
  });
});

describe('impresión canónica de los átomos', () => {
  it('el átomo sin subíndice no lleva guion bajo y el que lo tiene sí', () => {
    expect(print(atom('A'))).toBe('A');
    expect(print(atom('A1'))).toBe('A_1');
    expect(print(atom('B12'))).toBe('B_12');
  });
});

describe('atoms: inventario de átomos', () => {
  it('los recoge en orden de aparición y sin repetir', () => {
    expect(atoms(parse('(B∧A)∨B'))).toEqual(['B', 'A']);
  });

  it('⊥ no es un átomo del inventario: es el falsum distinguido', () => {
    expect(atoms(parse('A∧⊥'))).toEqual(['A']);
  });

  it('cada llamada parte de un acumulador vacío', () => {
    expect(atoms(parse('A'))).toEqual(['A']);
    expect(atoms(parse('B'))).toEqual(['B']);
  });
});

describe('renameAtoms: renombrado biyectivo', () => {
  it('deja intacto el átomo que el mapa no menciona', () => {
    expect(print(renameAtoms(parse('A∧B'), { A: 'C' }))).toBe('C∧B');
  });

  it('no toca ⊥ ni la estructura', () => {
    expect(print(renameAtoms(parse('¬(A∧⊥)'), { A: 'C' }))).toBe('¬(C∧⊥)');
  });

  it('con el mapa vacío devuelve la misma fórmula', () => {
    expect(print(renameAtoms(parse('A→(B∨A)'), {}))).toBe('A→(B∨A)');
  });
});
