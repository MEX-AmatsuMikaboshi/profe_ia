import { describe, expect, it } from 'vitest';
import { CanaryRegistry } from '@profesor-ia/security-policy';
import { fragmentHandle } from '@profesor-ia/contracts';
import {
  AUTHORIZED_RULE_IDS,
  CONNECTIVE_ALIASES,
  FORBIDDEN_RULES_EXAMPLES,
  tokenize,
} from '@profesor-ia/logic-core';
import {
  CanaryHitError,
  validateAnchoredOutput,
  type AnchorValidationInput,
  type AnchorVerdict,
  type AuthorizedCalculus,
} from '../src/index.js';

/**
 * T-H7-02 — validador de anclaje (I-7, P-II §8.4, P-I §8.5).
 *
 * `logic-core` entra **sólo en las pruebas**, como devDependency, para
 * comprobar que lo que se inyecta al validador corresponde de verdad al cálculo
 * congelado. En `src/` está prohibido por la regla depcruise
 * `pasarela-sin-nucleo-logico`: el cálculo entra por parámetro, no por import.
 */

const CALCULO: AuthorizedCalculus = {
  version: 'authorized-calculus-v1',
  canonicalSymbols: ['¬', '∧', '∨', '→', '↔', '⊥'],
  connectiveAliases: Object.keys(CONNECTIVE_ALIASES),
  forbiddenRuleIds: [...FORBIDDEN_RULES_EXAMPLES],
};

const FRAGMENTOS = [
  {
    fragmentId: 'f1',
    blockId: 'bloque-01',
    text: 'Regla ∧I: de A y de B se sigue A∧B.',
  },
  {
    fragmentId: 'f2',
    blockId: 'bloque-01',
    text: 'En este cálculo no se admite MT como regla derivada.',
  },
  {
    fragmentId: 'ajeno',
    blockId: 'bloque-02',
    text: 'Fragmento de otro bloque.',
  },
];

function entrada(overrides: Partial<AnchorValidationInput> = {}): AnchorValidationInput {
  return {
    blockId: 'bloque-01',
    authorizedFragments: FRAGMENTOS,
    calculus: CALCULO,
    ...overrides,
  };
}

function salida(segments: readonly unknown[]): unknown {
  return { operationId: 'op-1', authorizedBlockId: 'bloque-01', segments };
}

function razones(v: AnchorVerdict): readonly string[] {
  return v.outcome === 'rejected' ? v.rejections.map((r) => r.reason) : [];
}

describe('validateAnchoredOutput — control positivo', () => {
  it('acepta una salida anclada y bien formada', () => {
    const v = validateAnchoredOutput(
      salida([{ text: 'De A y de B se sigue A∧B.', anchors: ['f1'], function: 'explanation' }]),
      entrada(),
    );
    expect(v.outcome).toBe('accepted');
    if (v.outcome !== 'accepted') return;
    expect(v.standings[0]).toEqual({ kind: 'anchored', resolvedAnchors: ['f1'] });
    expect(v.canGroundEvaluation).toBe(true);
    expect(v.auditRecord).toHaveLength(0);
  });

  it('acepta los alias de conectivo, que el cálculo autoriza', () => {
    // Se rechazaban en el primer diseño por parecer notación ajena. El cálculo
    // los canonicaliza antes de verificar, así que no lo son.
    for (const alias of ['->', '&', '|', '~', '!', '<->']) {
      const v = validateAnchoredOutput(
        salida([{ text: `Puedes escribir A ${alias} B.`, anchors: ['f1'], function: 'explanation' }]),
        entrada(),
      );
      expect(razones(v), alias).toEqual([]);
    }
  });
});

describe('las cinco causas de rechazo de P-II §8.4', () => {
  it('fuera_de_esquema: forma que no es AnchoredOutput', () => {
    const v = validateAnchoredOutput({ segments: 'no es una lista' }, entrada());
    expect(razones(v)).toEqual(['fuera_de_esquema']);
  });

  it('fuera_de_esquema corta y no inventa causas semánticas sobre una forma desconocida', () => {
    const v = validateAnchoredOutput({ cualquier: 'cosa' }, entrada());
    expect(razones(v)).toHaveLength(1);
  });

  it('anchor_inexistente: el anchor no resuelve', () => {
    const v = validateAnchoredOutput(
      salida([{ text: 'Texto.', anchors: ['no-existe'], function: 'explanation' }]),
      entrada(),
    );
    expect(razones(v)).toEqual(['anchor_inexistente']);
  });

  it('anchor_inexistente: un fragmento de otro bloque no ancla aquí (P-I §9.4)', () => {
    const v = validateAnchoredOutput(
      salida([{ text: 'Texto.', anchors: ['ajeno'], function: 'explanation' }]),
      entrada(),
    );
    expect(razones(v)).toEqual(['anchor_inexistente']);
  });

  it('simbolo_no_autorizado: notación que el cálculo no tiene', () => {
    const v = validateAnchoredOutput(
      salida([{ text: 'Para todo x, ∀x P(x).', anchors: ['f1'], function: 'explanation' }]),
      entrada(),
    );
    expect(razones(v)).toEqual(['simbolo_no_autorizado']);
  });

  it('instruccion_contradice_calculo: introduce una regla prohibida', () => {
    const v = validateAnchoredOutput(
      salida([{ text: 'Aplica MT para cerrar la línea.', anchors: ['f1'], function: 'explanation' }]),
      entrada(),
    );
    expect(razones(v)).toEqual(['instruccion_contradice_calculo']);
  });

  it('solucion_o_canario: aborta con CanaryHitError en vez de degradarse a rechazo', () => {
    const registro = new CanaryRegistry();
    const detector = (payload: string): readonly string[] =>
      payload.includes('CANARIO-XYZ') ? ['CANARIO-XYZ'] : [];
    expect(registro).toBeDefined();
    expect(() =>
      validateAnchoredOutput(
        salida([{ text: 'La solución es CANARIO-XYZ.', anchors: ['f1'], function: 'explanation' }]),
        entrada(),
        { canaryDetector: detector },
      ),
    ).toThrow(CanaryHitError);
  });
});

describe('la exención por anclaje — «si el corpus lo dice, lo cita» (I-7)', () => {
  it('no rechaza una regla prohibida que el fragmento anclado nombra', () => {
    const v = validateAnchoredOutput(
      salida([
        {
          text: 'En este cálculo no se admite MT como regla derivada.',
          anchors: ['f2'],
          function: 'explanation',
        },
      ]),
      entrada(),
    );
    expect(razones(v)).toEqual([]);
  });

  it('sí la rechaza cuando el segmento ancla a otro fragmento que no la nombra', () => {
    // Control negativo del anterior: la exención viene del ancla concreta, no de
    // que el corpus del bloque la mencione en alguna parte.
    const v = validateAnchoredOutput(
      salida([
        {
          text: 'En este cálculo no se admite MT como regla derivada.',
          anchors: ['f1'],
          function: 'explanation',
        },
      ]),
      entrada(),
    );
    expect(razones(v)).toEqual(['instruccion_contradice_calculo']);
  });

  it('no confunde una regla con el interior de una palabra', () => {
    const v = validateAnchoredOutput(
      salida([{ text: 'El valor MTB no es una regla.', anchors: ['f1'], function: 'explanation' }]),
      entrada(),
    );
    expect(razones(v)).toEqual([]);
  });
});

describe('salida no anclada — P-I §8.5 limita, no rechaza', () => {
  it('una transición sin anclas es acompañamiento no factual y se audita', () => {
    const v = validateAnchoredOutput(
      salida([{ text: 'Sigamos.', anchors: [], function: 'transition' }]),
      entrada(),
    );
    expect(v.outcome).toBe('accepted');
    if (v.outcome !== 'accepted') return;
    expect(v.standings[0]).toEqual({ kind: 'non_factual_accompaniment' });
    expect(v.auditRecord).toHaveLength(1);
    expect(v.auditRecord[0]?.withheld).toBe(false);
  });

  it('una definición sin anclas se retiene: presentarla sería introducir una definición', () => {
    const v = validateAnchoredOutput(
      salida([{ text: 'Una tautología es…', anchors: [], function: 'definition' }]),
      entrada(),
    );
    expect(v.outcome).toBe('accepted');
    if (v.outcome !== 'accepted') return;
    expect(v.standings[0]?.kind).toBe('withheld');
    expect(v.auditRecord[0]?.withheld).toBe(true);
  });

  it('un solo segmento sin anclas quita a la salida entera el poder de calificar', () => {
    const v = validateAnchoredOutput(
      salida([
        { text: 'De A y de B se sigue A∧B.', anchors: ['f1'], function: 'explanation' },
        { text: 'Sigamos.', anchors: [], function: 'transition' },
      ]),
      entrada(),
    );
    expect(v.outcome).toBe('accepted');
    if (v.outcome !== 'accepted') return;
    expect(v.canGroundEvaluation).toBe(false);
  });
});

describe('se recogen todas las causas, no la primera', () => {
  it('un segmento con anchor malo y símbolo ajeno reporta las dos', () => {
    const v = validateAnchoredOutput(
      salida([{ text: 'Para todo ∀x.', anchors: ['no-existe'], function: 'explanation' }]),
      entrada(),
    );
    expect(razones(v)).toEqual(['anchor_inexistente', 'simbolo_no_autorizado']);
  });

  it('cada rechazo declara la autoridad literal de la que sale', () => {
    const v = validateAnchoredOutput(
      salida([{ text: 'Para todo ∀x.', anchors: ['no-existe'], function: 'explanation' }]),
      entrada(),
    );
    if (v.outcome !== 'rejected') throw new Error('debía rechazar');
    for (const r of v.rejections) expect(r.authority).toMatch(/P-I{1,2} §/u);
  });
});

/**
 * Control positivo que mantiene sincronizados el validador y el cálculo
 * congelado. Sin él, `canonicalSymbols` podría quedarse vieja y el validador
 * empezaría a rechazar notación legítima —o a dejar pasar la ajena— sin que
 * ninguna prueba se enterara.
 */
describe('correspondencia con el cálculo congelado de logic-core', () => {
  it('todo símbolo canónico declarado es tokenizable por el cálculo', () => {
    for (const simbolo of CALCULO.canonicalSymbols) {
      expect(() => tokenize(simbolo), simbolo).not.toThrow();
    }
  });

  it('todo alias declarado canonicaliza a un símbolo del cálculo', () => {
    for (const alias of CALCULO.connectiveAliases) {
      expect(() => tokenize(alias), alias).not.toThrow();
    }
  });

  it('todo símbolo que el validador rechaza es rechazado también por el cálculo', () => {
    for (const ajeno of ['∀', '∃', '⊢', '⊨', '≡', '⇒', '∈', '∪']) {
      const v = validateAnchoredOutput(
        salida([{ text: `x ${ajeno} y`, anchors: ['f1'], function: 'explanation' }]),
        entrada(),
      );
      expect(razones(v), ajeno).toEqual(['simbolo_no_autorizado']);
      expect(() => tokenize(ajeno), ajeno).toThrow();
    }
  });

  it('ninguna regla prohibida declarada está en la whitelist del cálculo', () => {
    for (const regla of CALCULO.forbiddenRuleIds) {
      expect(AUTHORIZED_RULE_IDS as readonly string[]).not.toContain(regla);
    }
  });
});

describe('anclaje por mango corto (D-77)', () => {
  const MANGO_F1 = fragmentHandle('f1');

  it('resuelve un ancla citada por mango', () => {
    const v = validateAnchoredOutput(
      salida([
        { text: 'De A y de B se sigue A∧B.', anchors: [MANGO_F1], function: 'explanation' },
      ]),
      entrada(),
    );
    expect(razones(v)).toEqual([]);
    expect(v.outcome).toBe('accepted');
    if (v.outcome !== 'accepted') return;
    expect(v.standings[0]).toEqual({ kind: 'anchored', resolvedAnchors: [MANGO_F1] });
  });

  it('sigue resolviendo el identificador canónico: lo ya emitido no se invalida', () => {
    const v = validateAnchoredOutput(
      salida([{ text: 'De A y de B se sigue A∧B.', anchors: ['f1'], function: 'explanation' }]),
      entrada(),
    );
    expect(razones(v)).toEqual([]);
  });

  it('el mango exime del rechazo por símbolo, igual que el canónico', () => {
    // El texto de respaldo se toma del fragmento resuelto, así que citar por
    // mango tiene que dar exactamente el mismo respaldo. Si el mango resolviera
    // «a medias», MT dejaría de estar exenta y esto lo detecta.
    const v = validateAnchoredOutput(
      salida([
        {
          text: 'En este cálculo no se admite MT como regla derivada.',
          anchors: [fragmentHandle('f2')],
          function: 'explanation',
        },
      ]),
      entrada(),
    );
    expect(razones(v)).toEqual([]);
  });

  it('un mango de otro bloque no resuelve: el bloque sigue mandando (P-I §9.4)', () => {
    const v = validateAnchoredOutput(
      salida([
        { text: 'Algo del otro bloque.', anchors: [fragmentHandle('ajeno')], function: 'explanation' },
      ]),
      entrada(),
    );
    expect(razones(v)).toEqual(['anchor_inexistente']);
  });

  it('un mango acortado no resuelve — que es el modo de fallo que D-77 quiere', () => {
    // `claude-haiku-4-5` acortaba el identificador y producía anclas
    // inexistentes. Con el mango, acortar sigue fallando; la diferencia es que
    // ya no hay nada que invite a hacerlo.
    const v = validateAnchoredOutput(
      salida([
        { text: 'De A y de B se sigue A∧B.', anchors: [MANGO_F1.slice(0, 6)], function: 'explanation' },
      ]),
      entrada(),
    );
    expect(razones(v)).toEqual(['anchor_inexistente']);
  });
});
