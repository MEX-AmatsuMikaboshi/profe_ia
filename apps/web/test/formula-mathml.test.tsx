import { parse, equals, print } from '@profesor-ia/logic-core/syntax';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Formula } from '../src/clase/components/Formula';
import { mathText, presentFormula, toMathNode } from '../src/clase/formula-mathml';

/**
 * T-H8-10 — notación lógica expuesta semánticamente (Maestro §10.5, UIUX §8).
 *
 * La prueba que sostiene todo lo demás es la de reconstrucción: el MathML tiene
 * que **decir la misma fórmula**. Un renderizador que se coma un paréntesis
 * produce markup válido que afirma otra cosa, y nadie lo notaría mirando la
 * pantalla — porque el paréntesis perdido tampoco se ve.
 */

/** Cubre las cuatro binarias, la negación, `⊥`, subíndices y anidamiento. */
const FORMULAS = [
  'P',
  'A_1',
  '⊥',
  '¬P',
  '¬¬P',
  '(P∧Q)',
  '(P∨Q)',
  '(P→Q)',
  '(P↔Q)',
  '(P→(Q∧R))',
  '((P∨Q)→⊥)',
  '¬(P∧¬Q)',
  '((A_1∧A_2)→(A_3∨¬A_4))',
] as const;

describe('T-H8-10 — MathML de las fórmulas', () => {
  it('el texto reconstruido desde el MathML vuelve a parsear a la misma fórmula', () => {
    for (const source of FORMULAS) {
      const formula = parse(source);
      const reconstruido = mathText(toMathNode(formula));
      // Ida y vuelta completa: árbol → MathML → texto → árbol.
      expect(equals(parse(reconstruido), formula), `${source} → ${reconstruido}`).toBe(true);
      // Y coincide con la impresión canónica, no sólo con «algo que parsea».
      expect(reconstruido).toBe(print(formula));
    }
  });

  it('los paréntesis se conservan: el cálculo no tiene precedencia que los supla', () => {
    // Si `toMathNode` los omitiera «porque mrow ya agrupa», estas dos darían el
    // mismo texto, y son fórmulas distintas.
    const a = mathText(toMathNode(parse('(P∧(Q∨R))')));
    const b = mathText(toMathNode(parse('((P∧Q)∨R)')));
    expect(a).not.toBe(b);
  });

  it('un átomo con subíndice sale como msub y reintroduce el guion bajo', () => {
    const node = toMathNode(parse('A_12'));
    expect(node.kind).toBe('msub');
    expect(mathText(node)).toBe('A_12');
  });

  describe('lo que no parsea no se inventa', () => {
    it('cae a texto plano, con el motivo', () => {
      const presentation = presentFormula('P∧');
      expect(presentation.kind).toBe('texto');
      expect(presentation.kind === 'texto' && presentation.text).toBe('P∧');
      expect(presentation.kind === 'texto' && presentation.reason).toMatch(/E-SYN/);
    });

    it('una fórmula sin precedencia declarada no se adivina', () => {
      // `A∧B∧C` se rechaza con E-SYN-PRECEDENCE (D-8): no hay lectura correcta
      // que elegir, así que no se elige ninguna.
      expect(presentFormula('A∧B∧C').kind).toBe('texto');
    });
  });

  describe('render', () => {
    it('emite <math> y no lo tapa con aria-label', () => {
      const html = renderToStaticMarkup(<Formula source="(P→Q)" testId="formula-1" />);
      expect(html).toContain('<math');
      expect(html).toContain('<mi>P</mi>');
      expect(html).toContain('<mo>→</mo>');
      // Un aria-label ganaría a la estructura y devolvería al lector de pantalla
      // al mismo sitio donde estaba.
      expect(html).not.toContain('aria-label');
      expect(html).toContain('data-notation="mathml"');
    });

    it('el caso de fallo se marca en el dato, no en silencio', () => {
      const html = renderToStaticMarkup(<Formula source="P∧" testId="formula-2" />);
      expect(html).toContain('data-notation="texto"');
      expect(html).not.toContain('<math');
    });

    it('el testId se conserva: la vista y sus pruebas siguen encontrando la línea', () => {
      const html = renderToStaticMarkup(<Formula source="P" testId="formula-abc" />);
      expect(html).toContain('data-testid="formula-abc"');
    });
  });
});
