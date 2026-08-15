import { describe, expect, it } from 'vitest';
import { equals, print, atom, bin, not, falsum } from '../src/ast.js';
import { parse, tryParse } from '../src/parser.js';

const code = (input: string): string | undefined => {
  const r = tryParse(input);
  return r.ok ? undefined : r.error.code;
};

describe('sintaxis sin precedencia (P-II §4.1.1)', () => {
  it('acepta la omisión del corchete exterior', () => {
    expect(equals(parse('A∧B'), bin('and', atom('A'), atom('B')))).toBe(true);
  });

  it('rechaza una cadena binaria sin corchetes internos', () => {
    expect(code('A∧B∧C')).toBe('E-SYN-PRECEDENCE');
    expect(code('A→B→C')).toBe('E-SYN-PRECEDENCE');
  });

  it('(A∧B)∧C y A∧(B∧C) son fórmulas distintas', () => {
    const left = parse('(A∧B)∧C');
    const right = parse('A∧(B∧C)');
    expect(equals(left, right)).toBe(false);
  });

  it('¬ se aplica a la unidad siguiente y admite anidamiento', () => {
    expect(equals(parse('¬¬A'), not(not(atom('A'))))).toBe(true);
    expect(equals(parse('¬(A∧B)'), not(bin('and', atom('A'), atom('B'))))).toBe(true);
    expect(equals(parse('¬A∧B'), bin('and', not(atom('A')), atom('B')))).toBe(true);
  });

  it('⊥ es un átomo distinguido, no un conectivo', () => {
    expect(equals(parse('⊥'), falsum)).toBe(true);
    expect(equals(parse('A→⊥'), bin('implies', atom('A'), falsum))).toBe(true);
  });
});

describe('alias de entrada cerrados', () => {
  it.each([
    ['A->B', 'A→B'],
    ['A=>B', 'A→B'],
    ['A/\\B', 'A∧B'],
    ['A&B', 'A∧B'],
    ['A\\/B', 'A∨B'],
    ['A|B', 'A∨B'],
    ['A<->B', 'A↔B'],
    ['A<=>B', 'A↔B'],
    ['~A', '¬A'],
    ['!A', '¬A'],
    ['_|_', '⊥'],
    ['#', '⊥'],
    ['!?', '⊥'],
  ])('«%s» se canonicaliza como «%s»', (input, canonical) => {
    expect(equals(parse(input), parse(canonical))).toBe(true);
  });

  it.each(['A>B', 'A-B', 'A and B', 'A or B', 'not A', 'A y B', 'A o B', 'no A'])(
    'rechaza el alias no autorizado en «%s»',
    (input) => {
      expect(code(input)).toBe('E-SYN-ALIAS');
    },
  );

  it('los átomos O, Y y N son válidos pese a colisionar con alias en minúscula', () => {
    for (const input of ['O', 'Y', 'N', 'O∧Y', '¬N', '(O∨Y)→N']) {
      expect(code(input), input).toBeUndefined();
    }
  });
});

describe('símbolos y estructura', () => {
  it('rechaza símbolos fuera del lenguaje', () => {
    expect(code('A∀B')).toBe('E-SYN-SYMBOL');
    expect(code('a∧b')).toBe('E-SYN-SYMBOL');
    expect(code('A%B')).toBe('E-SYN-SYMBOL');
  });

  it('rechaza corchetes desbalanceados y entrada vacía', () => {
    expect(code('(A∧B')).toBe('E-SYN-PARSE');
    expect(code('A∧B)')).toBe('E-SYN-PARSE');
    expect(code('')).toBe('E-SYN-PARSE');
    expect(code('∧A')).toBe('E-SYN-PARSE');
  });

  it('trata los glyphs de corchetes como equivalentes', () => {
    expect(equals(parse('[A∧B]∨C'), parse('(A∧B)∨C'))).toBe(true);
    expect(equals(parse('{A∧B}∨C'), parse('(A∧B)∨C'))).toBe(true);
  });

  it('canonicaliza subíndices y espacios', () => {
    expect(equals(parse('A_1 ∧ A₁'), bin('and', atom('A1'), atom('A1')))).toBe(true);
  });
});

describe('impresión canónica', () => {
  it('parse(print(ast)) conserva el AST', () => {
    for (const input of ['A', '¬¬A', 'A∧B', '(A∧B)∨C', 'A→(B↔C)', '¬(A∨B)', 'A_1∧B']) {
      const ast = parse(input);
      expect(equals(parse(print(ast)), ast), input).toBe(true);
    }
  });

  it('omite solo los corchetes exteriores', () => {
    expect(print(parse('(A∧B)'))).toBe('A∧B');
    expect(print(parse('(A∧B)∨C'))).toBe('(A∧B)∨C');
  });
});
