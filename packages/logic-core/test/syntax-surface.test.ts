import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as barrel from '../src/index.js';
import * as syntax from '../src/syntax.js';

/**
 * T-H6-13. El subpath `@profesor-ia/logic-core/syntax` es la frontera que hace
 * posible que el editor Fitch del cliente valide sintaxis **sin** poder emitir
 * un veredicto (P-I §8.9). Si alguna vez reexporta el veredicto, deja de ser una
 * frontera y pasa a ser un segundo verificador.
 */

const SYNTAX_SRC = fileURLToPath(new URL('../src/syntax.ts', import.meta.url));

/** Reexportaciones autorizadas, literales. Ampliarla es una decisión, no un descuido. */
const ALLOWED_REEXPORTS = ['./ast.js', './errors.js', './tokenizer.js', './parser.js', './fitch.js'];

/** Símbolos que **son** el veredicto, o un insumo directo suyo. */
const VERDICT_SYMBOLS = [
  'verify',
  'printProof',
  'VERIFIER_VERSION',
  'applyRule',
  'canonicalRuleId',
  'entails',
  'describeValuation',
  'AUTHORIZED_CALCULUS_VERSION',
  'AUTHORIZED_RULE_IDS',
  'CONTENT_POLICY_STAGE1',
];

describe('subpath ./syntax — superficie sin veredicto (T-H6-13)', () => {
  it('reexporta exactamente los módulos autorizados', () => {
    const source = readFileSync(SYNTAX_SRC, 'utf8');
    const reexports = [...source.matchAll(/^export \* from '([^']+)';$/gm)].map((m) => m[1]);
    expect(reexports).toEqual(ALLOWED_REEXPORTS);
  });

  it('no expone ningún símbolo capaz de afirmar validez', () => {
    const exposed = Object.keys(syntax);
    for (const symbol of VERDICT_SYMBOLS) {
      expect(exposed, `./syntax no puede exponer ${symbol}`).not.toContain(symbol);
    }
  });

  it('los símbolos prohibidos existen en el barrel, así que la prueba no pasa por vacío', () => {
    const exposedByBarrel = Object.keys(barrel);
    for (const symbol of VERDICT_SYMBOLS) {
      expect(exposedByBarrel, `${symbol} debería existir en el barrel`).toContain(symbol);
    }
  });

  it('sí expone lo que el editor necesita: tokenizar, parsear y analizar estructura', () => {
    const exposed = Object.keys(syntax);
    for (const symbol of ['tokenize', 'parse', 'tryParse', 'analyzeStructure', 'isAccessible']) {
      expect(exposed, `./syntax debe exponer ${symbol}`).toContain(symbol);
    }
  });

  it('parsea con la gramática congelada, incluida la ausencia de precedencia (D-8)', () => {
    const ok = syntax.tryParse('A ∧ B');
    expect(ok.ok).toBe(true);

    const chained = syntax.tryParse('A ∧ B ∧ C');
    expect(chained.ok).toBe(false);
    if (!chained.ok) expect(chained.error.code).toBe('E-SYN-PRECEDENCE');
  });
});
