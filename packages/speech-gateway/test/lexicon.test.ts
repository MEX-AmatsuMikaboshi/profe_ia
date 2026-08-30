import { describe, expect, it } from 'vitest';

import {
  LEXICON_CALCULUS_VERSION,
  LEXICON_VERSION,
  SpeechLexiconError,
  deverbalizeFormulaText,
  deverbalizeReference,
  deverbalizeReferences,
  deverbalizeRule,
  lexicalizedRuleIds,
  lexicalizedSymbols,
  verbalizationLexicon,
  verbalizeFormulaText,
  verbalizeReference,
  verbalizeReferences,
  verbalizeRule,
} from '../src/lexicon.js';

describe('lexicón — versión del cálculo', () => {
  it('devuelve el lexicón de la versión congelada', () => {
    expect(verbalizationLexicon(LEXICON_CALCULUS_VERSION)).toStrictEqual({
      lexiconVersion: LEXICON_VERSION,
      calculusVersion: LEXICON_CALCULUS_VERSION,
    });
  });

  it('lanza ante una versión desconocida en vez de reutilizar la única que hay', () => {
    // El defecto que esto evita es silencioso: un `authorized-calculus-v2`
    // dicho con las palabras de v1 produce audio que suena perfecto.
    expect(() => verbalizationLexicon('authorized-calculus-v2')).toThrowError(SpeechLexiconError);
    try {
      verbalizationLexicon('authorized-calculus-v2');
    } catch (e) {
      expect((e as SpeechLexiconError).code).toBe('VERSION_DESCONOCIDA');
    }
  });
});

describe('lexicón — fórmulas', () => {
  it('marca los átomos, porque «O» y «∨» suenan igual', () => {
    expect(verbalizeFormulaText('O')).toBe('letra O');
    expect(verbalizeFormulaText('∨')).toBe('o');
    // Y la vuelta los distingue, que es lo que importa.
    expect(deverbalizeFormulaText('letra O')).toBe('O');
    expect(deverbalizeFormulaText('o')).toBe('∨');
  });

  it('dice el bicondicional entero y no como cuatro palabras sueltas', () => {
    expect(verbalizeFormulaText('P↔Q')).toBe('letra P si y sólo si letra Q');
    // El emparejado largo-primero: «si y sólo si» contiene la «y» de `∧`.
    expect(deverbalizeFormulaText('letra P si y sólo si letra Q')).toBe('P↔Q');
  });

  it('conserva los paréntesis, que en este cálculo no son decorativos', () => {
    // Sin precedencia entre binarios, `(P∧Q)→R` y `P∧(Q→R)` son fórmulas
    // distintas: perder un paréntesis dice otra cosa, no lo mismo más corto.
    expect(verbalizeFormulaText('(P∧Q)→R')).toBe(
      'abre paréntesis letra P y letra Q cierra paréntesis implica letra R',
    );
    expect(deverbalizeFormulaText(verbalizeFormulaText('(P∧Q)→R'))).toBe('(P∧Q)→R');
    expect(deverbalizeFormulaText(verbalizeFormulaText('P∧(Q→R)'))).toBe('P∧(Q→R)');
  });

  it('dice subíndices', () => {
    expect(verbalizeFormulaText('A_1')).toBe('letra A subíndice 1');
    expect(deverbalizeFormulaText('letra A subíndice 12')).toBe('A_12');
  });

  it('dice ⊥ y ¬', () => {
    expect(verbalizeFormulaText('¬⊥')).toBe('no contradicción');
    expect(deverbalizeFormulaText('no contradicción')).toBe('¬⊥');
  });

  it('lanza ante un carácter que no lexicaliza, en vez de callarlo', () => {
    // Un símbolo de otro cálculo saldría por el altavoz como silencio, y el
    // alumno oiría una fórmula distinta de la que ve.
    expect(() => verbalizeFormulaText('P∀Q')).toThrowError(/no está en el lexicón/u);
    expect(() => verbalizeFormulaText('P ∧ Q')).toThrowError(/no está en el lexicón/u);
  });

  it('lanza ante una palabra que no lexicaliza, en vez de adivinar', () => {
    expect(() => deverbalizeFormulaText('letra P entonces letra Q')).toThrowError(
      /no está en el lexicón/u,
    );
  });

  it('lanza ante una marca de átomo sin letra detrás', () => {
    expect(() => deverbalizeFormulaText('letra implica letra Q')).toThrowError(
      /sin letra mayúscula detrás/u,
    );
    expect(() => deverbalizeFormulaText('letra P subíndice y')).toThrowError(
      /sin dígitos detrás/u,
    );
  });
});

describe('lexicón — reglas', () => {
  it('la correspondencia regla ↔ nombre hablado es biyectiva', () => {
    const nombres = lexicalizedRuleIds().map(verbalizeRule);
    // Dos reglas con el mismo nombre hablado harían irreconstruible una
    // justificación dictada, y el error aparecería como un rechazo del
    // verificador que el alumno no puede explicarse.
    expect(new Set(nombres).size).toBe(nombres.length);
    for (const id of lexicalizedRuleIds()) {
      expect(deverbalizeRule(verbalizeRule(id))).toBe(id);
    }
  });

  it('lanza ante una regla fuera de la whitelist del cálculo', () => {
    // `DS` y `MT` están en `FORBIDDEN_RULES_EXAMPLES`: pronunciarlas las haría
    // sonar legítimas.
    expect(() => verbalizeRule('DS')).toThrowError(/no está en el lexicón/u);
    expect(() => verbalizeRule('MT')).toThrowError(/no está en el lexicón/u);
    expect(() => deverbalizeRule('silogismo disyuntivo')).toThrowError(/no nombra ninguna regla/u);
  });
});

describe('lexicón — citas', () => {
  it('distingue citar un renglón de citar un bloque', () => {
    expect(verbalizeReference(4)).toBe('línea 4');
    expect(verbalizeReference([2, 5])).toBe('subprueba de la línea 2 a la línea 5');
    expect(deverbalizeReference('línea 4')).toBe(4);
    expect(deverbalizeReference('subprueba de la línea 2 a la línea 5')).toStrictEqual([2, 5]);
  });

  it('va y vuelve con una lista mixta, como la que cita ∨E', () => {
    const refs = [1, [2, 4], [5, 7]] as const;
    expect(deverbalizeReferences(verbalizeReferences(refs))).toStrictEqual([1, [2, 4], [5, 7]]);
  });

  it('la lista vacía va y vuelve vacía', () => {
    expect(verbalizeReferences([])).toBe('');
    expect(deverbalizeReferences('')).toStrictEqual([]);
  });

  it('rechaza líneas que no son 1-based enteras', () => {
    expect(() => verbalizeReference(0)).toThrowError(/1-based y enteras/u);
    expect(() => verbalizeReference(-3)).toThrowError(/1-based y enteras/u);
    expect(() => verbalizeReference(2.5)).toThrowError(/1-based y enteras/u);
    expect(() => deverbalizeReference('la cuarta')).toThrowError(/no es una cita/u);
  });
});

describe('lexicón — inventario', () => {
  it('cubre los cinco conectivos, ⊥ y los dos paréntesis', () => {
    expect([...lexicalizedSymbols()].sort()).toStrictEqual(
      ['(', ')', '¬', '∧', '∨', '→', '↔', '⊥'].sort(),
    );
  });

  it('ningún símbolo comparte palabra hablada con otro', () => {
    const hablas = lexicalizedSymbols().map(verbalizeFormulaText);
    expect(new Set(hablas).size).toBe(hablas.length);
  });
});
