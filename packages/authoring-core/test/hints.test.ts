import { search } from '@profesor-ia/proof-search';
import { describe, expect, it } from 'vitest';
import {
  assertHintSet,
  authoritativeMasteryDisqualifying,
  HINT_LEVEL_DESCRIPTIONS,
  HINT_LEVELS,
  HintPolicyError,
  MasteryFlagNotAuthoritativeError,
  undisclosedSolutionFormulas,
  type Hint,
  type HintCheckContext,
  type HintSet,
} from '../src/index.js';

/**
 * Reactivo con un paso oculto: `A→B, ¬B ⊢ ¬A` se demuestra por reducción, y el
 * `⊥` intermedio **no** es subfórmula del enunciado. Es el caso en el que la
 * comprobación de fuga tiene algo que morder.
 */
const PREMISAS = ['A→B', '¬B'];
const META = '¬A';

function contexto(): HintCheckContext {
  const resultado = search(
    { premises: PREMISAS, goal: META, mode: 'heuristic', budget: { maxWorkUnits: 20_000 } },
    { semanticOracle: 'prefilter' },
  );
  if (resultado.status !== 'proof_found') throw new Error('fixture inválido');
  return {
    solution: { lines: resultado.proof.lines, goal: META },
    statementFormulas: [...PREMISAS, META],
  };
}

function pista(overrides: Partial<Hint> = {}): Hint {
  const level = overrides.level ?? 1;
  return {
    level,
    text: 'Recuerda qué hay que probar y qué dice la definición de negación.',
    anchors: ['frag-001'],
    proposedMasteryDisqualifying: true,
    // Los hechos siguen al nivel del ayudante de prueba a propósito: fijarlos en
    // el nivel 1 haría que cualquier caso con `level` sobrescrito disparase la
    // comprobación de coherencia y la prueba pasaría por el motivo equivocado.
    masteryFacts: {
      level,
      levelOneReminderOnly: level === 1,
      selectsRuleOrNextStep: level >= 2,
      containsDecisiveContent: false,
    },
    ...overrides,
  };
}

const conjunto = (hints: readonly Hint[]): HintSet => ({ itemId: 'it-001', hints });

describe('niveles de pista (T-H5-05 ← P-I §8.6)', () => {
  it('son los cinco literales de §8.6', () => {
    expect(HINT_LEVELS).toEqual([1, 2, 3, 4, 5]);
    expect(HINT_LEVEL_DESCRIPTIONS[4]).toBe('ejemplo análogo no isomorfo');
    expect(HINT_LEVEL_DESCRIPTIONS[5]).toBe('cierre del intento sin revelar la respuesta calificada');
  });

  it('un conjunto vacío no es «sin pistas»: sus reglas pasarían por vacío', () => {
    expect(() => assertHintSet(conjunto([]), contexto())).toThrow(HintPolicyError);
  });

  it('sin solución o sin enunciado no se comprueba nada, y por eso se rechaza', () => {
    // Con cualquiera de los dos vacío, la lista de pasos ocultos sale vacía y la
    // comprobación de fuga aprobaría hasta la pista que escribe la solución.
    const ctx = contexto();
    expect(() => assertHintSet(conjunto([pista()]), { ...ctx, solution: { lines: [] } })).toThrow(
      /pasa por vacío/u,
    );
    expect(() =>
      assertHintSet(conjunto([pista()]), { ...ctx, statementFormulas: [] }),
    ).toThrow(HintPolicyError);
  });

  it('rechaza un nivel fuera de la escala y dos pistas del mismo nivel', () => {
    expect(() =>
      // @ts-expect-error nivel fuera de la escala congelada
      assertHintSet(conjunto([pista({ level: 6 })]), contexto()),
    ).toThrow(/nivel de pista 6/u);
    expect(() =>
      assertHintSet(conjunto([pista({ level: 2 }), pista({ level: 2 })]), contexto()),
    ).toThrow(/dos pistas declaran el nivel 2/u);
  });

  it('exige anclajes: una ayuda sin anclaje no se audita contra el corpus', () => {
    expect(() => assertHintSet(conjunto([pista({ anchors: [] })]), contexto())).toThrow(
      HintPolicyError,
    );
  });
});

describe('propuesta de masteryDisqualifying (no autoritativa)', () => {
  it('proponer `false` sin explicar por qué no revela se rechaza', () => {
    expect(() =>
      assertHintSet(conjunto([pista({ proposedMasteryDisqualifying: false })]), contexto()),
    ).toThrow(/no explica por qué no revela/u);
  });

  it('proponer `true` no exige explicación: la norma la pide solo en el otro caso', () => {
    expect(() =>
      assertHintSet(conjunto([pista({ proposedMasteryDisqualifying: true })]), contexto()),
    ).not.toThrow();
  });

  it('una propuesta `false` en nivel 3 pasa aquí, y eso es la división de trabajo', () => {
    // §8.6 dice que los niveles 2–5 descalifican, pero **quien recalcula es la
    // política determinista** (T-H6-03) y quien rechaza la discrepancia es el
    // linter (T-H5-13). Corregirla aquí convertiría la propuesta en autoridad
    // por el otro extremo.
    expect(() =>
      assertHintSet(
        conjunto([
          pista({
            level: 3,
            proposedMasteryDisqualifying: false,
            nonRevelationExplanation: 'solo nombra el tipo de operación',
          }),
        ]),
        contexto(),
      ),
    ).not.toThrow();
  });

  it('una pista sin hechos de dominio se rechaza: sin ellos el linter aprueba por vacío', () => {
    // Los hechos son la **entrada** de la política autoritativa. Si faltan, el
    // registro que llega a `authoritative_mastery_flags` no tiene con qué
    // computarse y la comprobación pasa sin mirar nada. El tipo ya lo exige y
    // eso no basta: los archivos de prueba no se typechequean.
    const completa: Record<string, unknown> = { ...pista() };
    const sinHechos = Object.fromEntries(
      Object.entries(completa).filter(([clave]) => clave !== 'masteryFacts'),
    ) as unknown as Hint;
    expect(() => assertHintSet(conjunto([sinHechos]), contexto())).toThrow(
      /no trae hechos de dominio/u,
    );
  });

  it('los hechos de otro nivel se rechazan: la política decidiría sobre otra ayuda', () => {
    expect(() =>
      assertHintSet(
        conjunto([
          pista({
            level: 3,
            masteryFacts: {
              level: 1,
              levelOneReminderOnly: true,
              selectsRuleOrNextStep: false,
              containsDecisiveContent: false,
            },
          }),
        ]),
        contexto(),
      ),
    ).toThrow(/declara hechos de nivel 1/u);
  });

  it('pedir el valor autoritativo falla cerrado, incluso con la propuesta en `true`', () => {
    expect(() => authoritativeMasteryDisqualifying(pista())).toThrow(
      MasteryFlagNotAuthoritativeError,
    );
    expect(() =>
      authoritativeMasteryDisqualifying(
        pista({ proposedMasteryDisqualifying: false, nonRevelationExplanation: 'x' }),
      ),
    ).toThrow(/T-H6-03/u);
  });
});

describe('no revelación (§8.6: una pista nunca se transforma en solución)', () => {
  it('lo oculto es lo que no se ve en el enunciado, no todo paso de la prueba', () => {
    // `A` y `B` son subfórmulas del enunciado: el alumno ya las tiene delante.
    // El `⊥` de la reducción no aparece por ninguna parte.
    expect(undisclosedSolutionFormulas(contexto())).toEqual(['⊥']);
  });

  it('una pista que escribe el paso oculto se rechaza', () => {
    expect(() =>
      assertHintSet(
        conjunto([pista({ level: 3, text: 'Supón A y llega a ⊥, luego cierra con ¬I.' })]),
        contexto(),
      ),
    ).toThrow(/paso de la solución ausente del enunciado/u);
  });

  it('la detección no se esquiva metiendo espacios', () => {
    expect(() =>
      assertHintSet(conjunto([pista({ level: 3, text: 'llega a  ⊥ y cierra' })]), contexto()),
    ).toThrow(HintPolicyError);
  });

  it('mencionar una fórmula del enunciado no es fuga, y una palabra con «A» tampoco', () => {
    // Sin la comparación por subfórmulas, «Aplica ∧E» dispararía el control por
    // contener el átomo `A`, y el control rechazaría pistas legítimas.
    expect(() =>
      assertHintSet(
        conjunto([pista({ level: 2, text: 'Aplica la regla que usa A→B junto con ¬B.' })]),
        contexto(),
      ),
    ).not.toThrow();
  });
});

describe('ejemplo análogo del nivel 4 (§8.6, §9.6)', () => {
  const ejemploIsomorfo = () => {
    const r = search(
      { premises: ['P→Q', '¬Q'], goal: '¬P', mode: 'heuristic', budget: { maxWorkUnits: 20_000 } },
      { semanticOracle: 'prefilter' },
    );
    if (r.status !== 'proof_found') throw new Error('fixture inválido');
    return { proof: { lines: r.proof.lines, goal: '¬P' } };
  };

  const ejemploDistinto = () => {
    const r = search(
      { premises: ['A', 'B'], goal: 'A∧B', mode: 'heuristic', budget: { maxWorkUnits: 20_000 } },
      { semanticOracle: 'prefilter' },
    );
    if (r.status !== 'proof_found') throw new Error('fixture inválido');
    return { proof: { lines: r.proof.lines, goal: 'A∧B' } };
  };

  it('rechaza el ejemplo isomorfo: resolverlo sería resolver el reactivo', () => {
    expect(() =>
      assertHintSet(
        conjunto([pista({ level: 4, text: 'Mira este caso análogo.', analogousExample: ejemploIsomorfo() })]),
        contexto(),
      ),
    ).toThrow(/isomorfo al reactivo/u);
  });

  it('acepta el ejemplo con otra estructura de prueba', () => {
    expect(() =>
      assertHintSet(
        conjunto([pista({ level: 4, text: 'Mira este caso análogo.', analogousExample: ejemploDistinto() })]),
        contexto(),
      ),
    ).not.toThrow();
  });
});
