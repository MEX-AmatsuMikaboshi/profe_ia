import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  AUTHORIZED_CALCULUS_VERSION,
  AUTHORIZED_RULE_IDS,
  CONNECTIVES,
  FALSUM,
  LINE_JUSTIFICATIONS,
  bin,
  equals,
  falsum,
  not,
  atom,
  parse,
  print,
  type BinaryOp,
  type Formula,
} from '@profesor-ia/logic-core';

import {
  LEXICON_CALCULUS_VERSION,
  deverbalizeFormulaText,
  deverbalizeRule,
  lexicalizedRuleIds,
  lexicalizedSymbols,
  verbalizeFormulaText,
  verbalizeRule,
} from '../src/lexicon.js';

/**
 * Control de correspondencia entre el lexicón y el cálculo congelado
 * (T-H8-02 ← P-I §8.10).
 *
 * ## Por qué la comprobación vive aquí y no en `src/`
 *
 * `packages/speech-gateway` **no puede importar `logic-core`**: la regla
 * `visual-sin-veredicto-formal` de `.dependency-cruiser.cjs` le prohíbe toda la
 * ruta de verificación, y a diferencia de `apps/web` no tiene la excepción del
 * subpath `syntax`. La regla está bien: un segundo parser del cálculo dentro del
 * paquete de voz sería exactamente la divergencia que
 * `sin-verificador-fuera-del-verificador` existe para impedir.
 *
 * Así que la tabla vive local y **este control comprueba que sigue
 * correspondiendo**. Es el patrón de `db:grants:check` (la migración generada
 * contra la matriz que la origina) y el de `ci:content:mangos` (la tabla de
 * mangos contra el corpus): el artefacto se escribe aparte y un control falla si
 * la fuente congelada se mueve.
 *
 * Los `*.test.ts` están excluidos del grafo de depcruise
 * (`exclude: '\\.test\\.tsx?$'`), así que este import no abre la arista que la
 * regla vigila. `src/` sigue sin poder tocarlo, y `no-verdict.test.ts` lo
 * comprueba leyendo el código fuente.
 *
 * ## Qué pasa el día que el cálculo cambie
 *
 * Este archivo se pone rojo. Es el punto donde alguien tiene que decidir cómo se
 * dice el conectivo nuevo, en vez de que el TTS lo diga como silencio.
 */

describe('el lexicón corresponde al cálculo congelado', () => {
  it('declara la misma versión de cálculo', () => {
    expect(LEXICON_CALCULUS_VERSION).toBe(AUTHORIZED_CALCULUS_VERSION);
  });

  it('cubre exactamente los conectivos y ⊥ del cálculo, más los dos paréntesis', () => {
    const delLexicon = new Set(lexicalizedSymbols());
    for (const c of CONNECTIVES) {
      expect(delLexicon.has(c), `el cálculo tiene «${c}» y el lexicón no lo dice`).toBe(true);
    }
    expect(delLexicon.has(FALSUM)).toBe(true);
    // Los paréntesis no son conectivos pero sí notación que hay que decir: sin
    // ellos, `(P∧Q)→R` y `P∧(Q→R)` sonarían igual.
    expect(delLexicon.has('(')).toBe(true);
    expect(delLexicon.has(')')).toBe(true);
    // Y nada más: un símbolo de más aquí sería notación que el cálculo no tiene.
    expect(delLexicon.size).toBe(CONNECTIVES.length + 3);
  });

  it('cubre exactamente las reglas autorizadas y las dos justificaciones', () => {
    const esperadas = [...AUTHORIZED_RULE_IDS, ...LINE_JUSTIFICATIONS].sort();
    expect([...lexicalizedRuleIds()].sort()).toStrictEqual(esperadas);
  });

  it('no lexicaliza ninguna regla prohibida', () => {
    // Control positivo del control: si `verbalizeRule` dejara de fallar cerrado,
    // esta prueba lo vería. Sin ella, la de arriba pasaría por vacío.
    for (const prohibida of ['DS', 'MT', 'DeM', 'LEM', 'TND']) {
      expect(() => verbalizeRule(prohibida)).toThrowError();
    }
  });

  it('la vuelta por nombre hablado devuelve el `rule_id` literal, sin traducir', () => {
    for (const id of AUTHORIZED_RULE_IDS) {
      expect(deverbalizeRule(verbalizeRule(id))).toBe(id);
    }
  });
});

/** Átomos como los imprime `logic-core`: letra mayúscula y subíndice opcional. */
const atomo = fc
  .tuple(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    fc.option(fc.integer({ min: 1, max: 99 }), { nil: undefined }),
  )
  .map(([letra, sub]) => atom(sub === undefined ? letra : `${letra}${sub}`));

const { formula } = fc.letrec<{ formula: Formula }>((tie) => ({
  formula: fc.oneof(
    { maxDepth: 4, withCrossShrink: true },
    atomo,
    fc.constant(falsum),
    tie('formula').map((f) => not(f)),
    fc
      .tuple(
        fc.constantFrom<BinaryOp>('and', 'or', 'implies', 'iff'),
        tie('formula'),
        tie('formula'),
      )
      .map(([op, izq, der]) => bin(op, izq, der)),
  ),
}));

describe('reconstrucción exacta de fórmulas (P-I §8.10)', () => {
  it('lo dicho vuelve como el mismo texto canónico', () => {
    // La norma pide que el lexicón «se valida por reconstrucción de fórmulas,
    // **no por naturalidad percibida**». Esta es esa validación: sin ella, un
    // lexicón que se comiera un paréntesis produciría audio impecable que dice
    // otra fórmula, y nadie que lo escuchara lo notaría.
    fc.assert(
      fc.property(formula, (f) => {
        const canonico = print(f);
        expect(deverbalizeFormulaText(verbalizeFormulaText(canonico))).toBe(canonico);
      }),
      { numRuns: 500 },
    );
  });

  it('y vuelve como la misma fórmula, no sólo como el mismo texto', () => {
    // La vuelta por texto podría cuadrar y aun así parsear distinto. Cerrar el
    // ciclo contra el parser del cálculo es lo que descarta esa clase entera.
    fc.assert(
      fc.property(formula, (f) => {
        const reconstruida = parse(deverbalizeFormulaText(verbalizeFormulaText(print(f))));
        expect(equals(reconstruida, f)).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it('control positivo: un lexicón que perdiera los paréntesis fallaría esta prueba', () => {
    // Sin esto, las dos propiedades de arriba podrían pasar por vacío si el
    // generador nunca produjera fórmulas anidadas. Se siembra el defecto a mano.
    const conParentesis = print(bin('implies', bin('and', atom('P'), atom('Q')), atom('R')));
    const mutilado = verbalizeFormulaText(conParentesis)
      .replace(/abre paréntesis /gu, '')
      .replace(/ cierra paréntesis/gu, '');
    expect(deverbalizeFormulaText(mutilado)).not.toBe(conParentesis);
  });
});
