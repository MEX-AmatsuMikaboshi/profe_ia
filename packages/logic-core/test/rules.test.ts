import { describe, expect, it } from 'vitest';
import { parse } from '../src/parser.js';
import { applyRule, canonicalRuleId, RULE_ARITY, type RuleContext } from '../src/rules.js';
import { AUTHORIZED_RULE_IDS, type RuleId } from '../src/calculus.js';

/**
 * Cobertura rama a rama de las 14 formas autorizadas (P-II §4.1.1).
 *
 * `verify.test.ts` prueba el verificador de extremo a extremo; aquí se ejercita
 * cada regla aislada, incluidas las orientaciones alternativas y cada motivo de
 * rechazo, que es donde el mutation testing encontró huecos.
 */

const f = (s: string) => parse(s);

const ctx = (
  conclusion: string,
  lines: string[] = [],
  subproofs: { assumption: string; conclusion: string }[] = [],
): RuleContext => ({
  lineNumber: 10,
  conclusion: f(conclusion),
  lines: lines.map((formula, i) => ({ lineNumber: i + 1, formula: f(formula) })),
  subproofs: subproofs.map((s, i) => ({
    start: i * 2 + 1,
    end: i * 2 + 2,
    assumption: f(s.assumption),
    conclusion: f(s.conclusion),
  })),
});

const code = (rule: RuleId, c: RuleContext): string | undefined => applyRule(rule, c)?.code;

describe('canonicalización de nombres de regla', () => {
  it('acepta cada rule_id autorizado tal cual', () => {
    for (const id of AUTHORIZED_RULE_IDS) {
      const r = canonicalRuleId(id);
      expect(r.ok && r.ruleId).toBe(id);
    }
  });

  it('resuelve cada alias a su regla canónica', () => {
    const expected: Record<string, RuleId> = {
      '⊥I': '¬E',
      Contra: '¬E',
      '⊥E': 'X',
      EFQ: 'X',
      Explosión: 'X',
      RAA: 'IP',
      Reductio: 'IP',
      'Prueba indirecta': 'IP',
      '¬¬E': 'DNE',
      DN: 'DNE',
      MP: '→E',
      CP: '→I',
      Reit: 'R',
      Rep: 'R',
      Casos: '∨E',
    };
    for (const [alias, ruleId] of Object.entries(expected)) {
      const r = canonicalRuleId(alias);
      expect(r.ok && r.ruleId, alias).toBe(ruleId);
    }
  });

  it('ignora espacios alrededor del nombre', () => {
    const r = canonicalRuleId('  MP  ');
    expect(r.ok && r.ruleId).toBe('→E');
  });

  it('distingue regla prohibida de regla desconocida', () => {
    const forbidden = canonicalRuleId('DS');
    expect(!forbidden.ok && forbidden.error.code).toBe('E-RULE-FORBIDDEN');
    const unknown = canonicalRuleId('Modus Cornutus');
    expect(!unknown.ok && unknown.error.code).toBe('E-RULE-UNKNOWN');
  });

  it('el rechazo de regla prohibida no depende de mayúsculas', () => {
    const r = canonicalRuleId('taut con');
    expect(!r.ok && r.error.code).toBe('E-RULE-FORBIDDEN');
  });
});

describe('aridad exacta de cada regla', () => {
  it('la tabla cubre las 14 reglas', () => {
    expect(Object.keys(RULE_ARITY).sort()).toEqual([...AUTHORIZED_RULE_IDS].sort());
  });

  it.each(AUTHORIZED_RULE_IDS)('%s rechaza un número de citas distinto al declarado', (ruleId) => {
    const expected = RULE_ARITY[ruleId];
    // Una cita de línea de más siempre viola la aridad declarada.
    const lines = Array.from({ length: expected.lines + 1 }, () => 'A');
    const subproofs = Array.from({ length: expected.subproofs }, () => ({
      assumption: 'A',
      conclusion: 'A',
    }));
    expect(code(ruleId, ctx('A', lines, subproofs))).toBe('E-RULE-ARITY');
  });

  it('faltar una cita también viola la aridad', () => {
    expect(code('∧I', ctx('A∧B', ['A']))).toBe('E-RULE-ARITY');
    expect(code('→I', ctx('A→A', []))).toBe('E-RULE-ARITY');
  });
});

describe('R — reiteración', () => {
  it('acepta la repetición exacta', () => {
    expect(applyRule('R', ctx('A∧B', ['A∧B']))).toBeNull();
  });
  it('rechaza cualquier otra fórmula', () => {
    expect(code('R', ctx('B∧A', ['A∧B']))).toBe('E-RULE-SHAPE');
  });
});

describe('∧I / ∧E', () => {
  it('∧I acepta las dos órdenes de cita', () => {
    expect(applyRule('∧I', ctx('A∧B', ['A', 'B']))).toBeNull();
    expect(applyRule('∧I', ctx('A∧B', ['B', 'A']))).toBeNull();
  });
  it('∧I exige que la conclusión sea conjunción', () => {
    expect(code('∧I', ctx('A∨B', ['A', 'B']))).toBe('E-RULE-MAINOP');
  });
  it('∧I rechaza miembros que no son las líneas citadas', () => {
    expect(code('∧I', ctx('A∧C', ['A', 'B']))).toBe('E-RULE-SHAPE');
  });
  it('∧E extrae cualquiera de los dos miembros', () => {
    expect(applyRule('∧E', ctx('A', ['A∧B']))).toBeNull();
    expect(applyRule('∧E', ctx('B', ['A∧B']))).toBeNull();
  });
  it('∧E exige una conjunción citada', () => {
    expect(code('∧E', ctx('A', ['A∨B']))).toBe('E-RULE-MAINOP');
  });
  it('∧E rechaza una fórmula ajena a la conjunción', () => {
    expect(code('∧E', ctx('C', ['A∧B']))).toBe('E-RULE-SHAPE');
  });
});

describe('∨I / ∨E', () => {
  it('∨I admite el disyunto citado en cualquiera de los dos lados', () => {
    expect(applyRule('∨I', ctx('A∨C', ['A']))).toBeNull();
    expect(applyRule('∨I', ctx('C∨A', ['A']))).toBeNull();
  });
  it('∨I exige que la conclusión sea disyunción', () => {
    expect(code('∨I', ctx('A∧C', ['A']))).toBe('E-RULE-MAINOP');
  });
  it('∨I rechaza una disyunción sin el disyunto citado', () => {
    expect(code('∨I', ctx('B∨C', ['A']))).toBe('E-RULE-SHAPE');
  });

  const disjunction = 'A∨B';
  it('∨E acepta las subpruebas en cualquier orden', () => {
    expect(
      applyRule(
        '∨E',
        ctx('C', [disjunction], [
          { assumption: 'A', conclusion: 'C' },
          { assumption: 'B', conclusion: 'C' },
        ]),
      ),
    ).toBeNull();
    expect(
      applyRule(
        '∨E',
        ctx('C', [disjunction], [
          { assumption: 'B', conclusion: 'C' },
          { assumption: 'A', conclusion: 'C' },
        ]),
      ),
    ).toBeNull();
  });
  it('∨E exige una disyunción citada', () => {
    expect(
      code('∨E', ctx('C', ['A∧B'], [
        { assumption: 'A', conclusion: 'C' },
        { assumption: 'B', conclusion: 'C' },
      ])),
    ).toBe('E-RULE-MAINOP');
  });
  it('∨E exige que cada subprueba suponga un disyunto', () => {
    expect(
      code('∨E', ctx('C', [disjunction], [
        { assumption: 'A', conclusion: 'C' },
        { assumption: 'D', conclusion: 'C' },
      ])),
    ).toBe('E-RULE-SHAPE');
  });
  it('∨E exige la misma conclusión en ambas subpruebas', () => {
    expect(
      code('∨E', ctx('C', [disjunction], [
        { assumption: 'A', conclusion: 'C' },
        { assumption: 'B', conclusion: 'D' },
      ])),
    ).toBe('E-RULE-SHAPE');
  });
});

describe('→I / →E', () => {
  it('→I construye el condicional de la subprueba', () => {
    expect(applyRule('→I', ctx('A→B', [], [{ assumption: 'A', conclusion: 'B' }]))).toBeNull();
  });
  it('→I exige que la conclusión sea condicional', () => {
    expect(code('→I', ctx('A∧B', [], [{ assumption: 'A', conclusion: 'B' }]))).toBe(
      'E-RULE-MAINOP',
    );
  });
  it('→I rechaza antecedente o consecuente que no corresponden', () => {
    expect(code('→I', ctx('C→B', [], [{ assumption: 'A', conclusion: 'B' }]))).toBe('E-RULE-SHAPE');
    expect(code('→I', ctx('A→C', [], [{ assumption: 'A', conclusion: 'B' }]))).toBe('E-RULE-SHAPE');
  });

  it('→E acepta las dos órdenes de cita', () => {
    expect(applyRule('→E', ctx('B', ['A→B', 'A']))).toBeNull();
    expect(applyRule('→E', ctx('B', ['A', 'A→B']))).toBeNull();
  });
  it('→E exige un condicional entre las citas', () => {
    expect(code('→E', ctx('B', ['A∧B', 'A']))).toBe('E-RULE-MAINOP');
  });
  it('→E rechaza antecedente o consecuente equivocados', () => {
    expect(code('→E', ctx('B', ['A→B', 'C']))).toBe('E-RULE-SHAPE');
    expect(code('→E', ctx('C', ['A→B', 'A']))).toBe('E-RULE-SHAPE');
  });
});

describe('↔I / ↔E', () => {
  it('↔I acepta las subpruebas en cualquier orientación', () => {
    expect(
      applyRule('↔I', ctx('A↔B', [], [
        { assumption: 'A', conclusion: 'B' },
        { assumption: 'B', conclusion: 'A' },
      ])),
    ).toBeNull();
    expect(
      applyRule('↔I', ctx('A↔B', [], [
        { assumption: 'B', conclusion: 'A' },
        { assumption: 'A', conclusion: 'B' },
      ])),
    ).toBeNull();
  });
  it('↔I exige que la conclusión sea bicondicional', () => {
    expect(
      code('↔I', ctx('A→B', [], [
        { assumption: 'A', conclusion: 'B' },
        { assumption: 'B', conclusion: 'A' },
      ])),
    ).toBe('E-RULE-MAINOP');
  });
  it('↔I rechaza dos subpruebas que no cubren ambas direcciones', () => {
    expect(
      code('↔I', ctx('A↔B', [], [
        { assumption: 'A', conclusion: 'B' },
        { assumption: 'A', conclusion: 'B' },
      ])),
    ).toBe('E-RULE-SHAPE');
  });

  it('↔E concluye cualquiera de los dos lados', () => {
    expect(applyRule('↔E', ctx('B', ['A↔B', 'A']))).toBeNull();
    expect(applyRule('↔E', ctx('A', ['A↔B', 'B']))).toBeNull();
  });
  it('↔E acepta las dos órdenes de cita', () => {
    expect(applyRule('↔E', ctx('B', ['A', 'A↔B']))).toBeNull();
  });
  it('↔E exige un bicondicional entre las citas', () => {
    expect(code('↔E', ctx('B', ['A→B', 'A']))).toBe('E-RULE-MAINOP');
  });
  it('↔E rechaza un lado que no pertenece al bicondicional', () => {
    expect(code('↔E', ctx('B', ['A↔B', 'C']))).toBe('E-RULE-SHAPE');
  });
});

describe('¬I / ¬E / X / IP / DNE', () => {
  it('¬I concluye la negación del supuesto que llevó a ⊥', () => {
    expect(applyRule('¬I', ctx('¬A', [], [{ assumption: 'A', conclusion: '⊥' }]))).toBeNull();
  });
  it('¬I exige conclusión negada y subprueba terminada en ⊥', () => {
    expect(code('¬I', ctx('A', [], [{ assumption: 'A', conclusion: '⊥' }]))).toBe('E-RULE-MAINOP');
    expect(code('¬I', ctx('¬A', [], [{ assumption: 'A', conclusion: 'B' }]))).toBe('E-RULE-SHAPE');
    expect(code('¬I', ctx('¬B', [], [{ assumption: 'A', conclusion: '⊥' }]))).toBe('E-RULE-SHAPE');
  });

  it('¬E deriva ⊥ de φ y ¬φ en cualquier orden', () => {
    expect(applyRule('¬E', ctx('⊥', ['A', '¬A']))).toBeNull();
    expect(applyRule('¬E', ctx('⊥', ['¬A', 'A']))).toBeNull();
  });
  it('¬E exige concluir ⊥ y una contradicción real', () => {
    expect(code('¬E', ctx('A', ['A', '¬A']))).toBe('E-RULE-MAINOP');
    expect(code('¬E', ctx('⊥', ['A', '¬B']))).toBe('E-RULE-SHAPE');
  });

  it('X deriva cualquier fórmula de ⊥', () => {
    expect(applyRule('X', ctx('(A∧B)∨C', ['⊥']))).toBeNull();
  });
  it('X exige ⊥ en la línea citada', () => {
    expect(code('X', ctx('A', ['B']))).toBe('E-RULE-MAINOP');
  });

  it('IP concluye φ desde ¬φ ⇒ ⊥', () => {
    expect(applyRule('IP', ctx('A', [], [{ assumption: '¬A', conclusion: '⊥' }]))).toBeNull();
  });
  it('IP exige supuesto negado, cierre en ⊥ y correspondencia', () => {
    expect(code('IP', ctx('A', [], [{ assumption: 'A', conclusion: '⊥' }]))).toBe('E-RULE-MAINOP');
    expect(code('IP', ctx('A', [], [{ assumption: '¬A', conclusion: 'B' }]))).toBe('E-RULE-SHAPE');
    expect(code('IP', ctx('B', [], [{ assumption: '¬A', conclusion: '⊥' }]))).toBe('E-RULE-SHAPE');
  });

  it('DNE elimina exactamente dos negaciones', () => {
    expect(applyRule('DNE', ctx('A', ['¬¬A']))).toBeNull();
    expect(applyRule('DNE', ctx('¬A', ['¬¬¬A']))).toBeNull();
  });
  it('DNE exige una doble negación en la cita', () => {
    expect(code('DNE', ctx('A', ['¬A']))).toBe('E-RULE-MAINOP');
    expect(code('DNE', ctx('A', ['A']))).toBe('E-RULE-MAINOP');
  });
  it('DNE no salta más de dos negaciones', () => {
    expect(code('DNE', ctx('A', ['¬¬¬¬A']))).toBe('E-RULE-SHAPE');
  });
});

/**
 * Orientaciones **a medias**: la conclusión coincide con una parte de la
 * orientación autorizada y no con la otra. Son los casos que distinguen `&&` de
 * `||` en cada comprobación de forma; sin ellos, una regla que acepte media
 * coincidencia pasa desapercibida. Huecos que destapó el mutation testing.
 */
describe('coincidencias parciales: aceptar media orientación sería aceptar de más', () => {
  it('∧I rechaza que solo uno de los miembros corresponda a una cita', () => {
    // Izquierdo = línea 1, derecho ajeno.
    expect(code('∧I', ctx('A∧C', ['A', 'B']))).toBe('E-RULE-SHAPE');
    // Izquierdo = línea 2 (orientación invertida), derecho ajeno.
    expect(code('∧I', ctx('B∧C', ['A', 'B']))).toBe('E-RULE-SHAPE');
  });

  it('∨E rechaza que solo una subprueba suponga un disyunto', () => {
    expect(
      code(
        '∨E',
        ctx('C', ['A∨B'], [
          { assumption: 'B', conclusion: 'C' },
          { assumption: 'C', conclusion: 'C' },
        ]),
      ),
    ).toBe('E-RULE-SHAPE');
  });

  it('↔I rechaza que una subprueba encaje y la otra no', () => {
    expect(
      code(
        '↔I',
        ctx('A↔B', [], [
          { assumption: 'A', conclusion: 'C' },
          { assumption: 'B', conclusion: 'A' },
        ]),
      ),
    ).toBe('E-RULE-SHAPE');
    expect(
      code(
        '↔I',
        ctx('A↔B', [], [
          { assumption: 'A', conclusion: 'B' },
          { assumption: 'B', conclusion: 'C' },
        ]),
      ),
    ).toBe('E-RULE-SHAPE');
  });

  it('↔E rechaza el lado correcto con la conclusión equivocada', () => {
    expect(code('↔E', ctx('C', ['A↔B', 'B']))).toBe('E-RULE-SHAPE');
    expect(code('↔E', ctx('C', ['A↔B', 'A']))).toBe('E-RULE-SHAPE');
  });

  it('¬E exige una contradicción real entre las dos citas', () => {
    expect(code('¬E', ctx('⊥', ['A', 'B']))).toBe('E-RULE-SHAPE');
    expect(code('¬E', ctx('⊥', ['A', '¬B']))).toBe('E-RULE-SHAPE');
  });
});

/**
 * `E-RULE-MAINOP` y `E-RULE-SHAPE` no son intercambiables: el primero dice que
 * la forma citada no es la que la regla exige; el segundo, que siéndolo, las
 * piezas no encajan. Confundirlos degradaría el diagnóstico que ve el alumno.
 */
describe('MAINOP y SHAPE se distinguen', () => {
  it('→E: sin condicional es MAINOP; con condicional que no encaja es SHAPE', () => {
    expect(code('→E', ctx('C', ['A', 'B']))).toBe('E-RULE-MAINOP');
    expect(code('→E', ctx('C', ['A→B', 'A']))).toBe('E-RULE-SHAPE');
    expect(code('→E', ctx('B', ['A→B', 'C']))).toBe('E-RULE-SHAPE');
  });

  it('↔E: sin bicondicional es MAINOP; con bicondicional que no encaja es SHAPE', () => {
    expect(code('↔E', ctx('C', ['A', 'B']))).toBe('E-RULE-MAINOP');
    expect(code('↔E', ctx('C', ['A↔B', 'D']))).toBe('E-RULE-SHAPE');
  });
});

/**
 * `→E` y `↔E` miran **las dos** citas para decidir si el error es de forma o de
 * operador principal. Estos casos ponen la fórmula correcta en la segunda cita:
 * si el verificador solo mirara la primera, degradaría el diagnóstico a
 * `E-RULE-MAINOP` cuando el problema real es que las piezas no encajan.
 */
describe('la segunda cita también cuenta para elegir el código de error', () => {
  it('→E: el condicional en la segunda línea sigue dando SHAPE, no MAINOP', () => {
    expect(code('→E', ctx('C', ['A', 'A→B']))).toBe('E-RULE-SHAPE');
  });

  it('↔E: el bicondicional en la segunda línea sigue dando SHAPE, no MAINOP', () => {
    expect(code('↔E', ctx('C', ['A', 'A↔B']))).toBe('E-RULE-SHAPE');
  });
});

/**
 * `↔I` acepta las dos subpruebas en cualquier orden. Estos casos entran por la
 * orientación invertida y fallan en un solo conjunto: comprueban que la
 * orientación de vuelta se exige **completa**, no a trozos.
 */
describe('↔I: la orientación invertida también se exige completa', () => {
  it('rechaza cuando la vuelta encaja salvo la última conclusión', () => {
    expect(
      code(
        '↔I',
        ctx('A↔B', [], [
          { assumption: 'B', conclusion: 'C' },
          { assumption: 'A', conclusion: 'B' },
        ]),
      ),
    ).toBe('E-RULE-SHAPE');
  });

  it('rechaza cuando la vuelta encaja salvo la conclusión intermedia', () => {
    expect(
      code(
        '↔I',
        ctx('A↔B', [], [
          { assumption: 'B', conclusion: 'A' },
          { assumption: 'A', conclusion: 'C' },
        ]),
      ),
    ).toBe('E-RULE-SHAPE');
  });
});
