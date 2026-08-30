import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * T-H8-10 — contraste del acento cuando hace de texto (WCAG 2.2 SC 1.4.3).
 *
 * Esta guarda **no necesita navegador**, y por eso es la que protege de verdad:
 * `ci:a11y:baseline` sólo corre a mano, mientras que esto entra en `ci:unit` y
 * falla en cuanto alguien devuelva el acento claro a un rol de texto o cambie un
 * escalón de la paleta sin mirar.
 *
 * El cálculo se hace sobre los **valores reales** de `tokens.generated.css` y de
 * `a11y-contrast.css`, leídos de disco. Copiar aquí los hexadecimales dejaría la
 * prueba pasando sobre colores que ya no son los que la app pinta.
 */

const leer = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

const tokensCss = leer('../src/app/tokens.generated.css');
const contrasteCss = leer('../src/app/a11y-contrast.css');
const layoutTsx = leer('../src/app/layout.tsx');

/** Valor de una variable CSS declarada en `:root`. */
function token(nombre: string): string {
  const m = new RegExp(`--${nombre}:\\s*(#[0-9a-fA-F]{6})`).exec(tokensCss);
  if (m?.[1] === undefined) throw new Error(`no se encontró --${nombre} en tokens.generated.css`);
  return m[1];
}

/** Luminancia relativa (WCAG 2.x, definición literal). */
function luminancia(hex: string): number {
  const canales = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lineal = canales.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const [r = 0, g = 0, b = 0] = lineal;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [alta, baja] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return ((alta ?? 0) + 0.05) / ((baja ?? 0) + 0.05);
}

/** Umbral de AA para texto normal. El de texto grande (3.0) no aplica aquí. */
const AA_TEXTO_NORMAL = 4.5;

describe('T-H8-10 — contraste del acento como texto', () => {
  const fondo = token('color-bg');
  const superficie = token('color-surface');
  const acentoTexto = token('color-accent-700');

  it('el escalón elegido cumple AA sobre fondo y sobre superficie', () => {
    expect(contraste(acentoTexto, fondo)).toBeGreaterThanOrEqual(AA_TEXTO_NORMAL);
    expect(contraste(acentoTexto, superficie)).toBeGreaterThanOrEqual(AA_TEXTO_NORMAL);
  });

  it('y el acento de marca NO lo cumple, que es la razón de que exista este archivo', () => {
    // Control positivo. Si algún día `--color-accent` pasara AA, esta prueba
    // avisa de que la corrección sobra — en vez de quedarse aplicada para
    // siempre sin que nadie recuerde por qué.
    const acento = token('color-accent');
    expect(Math.min(contraste(acento, fondo), contraste(acento, superficie))).toBeLessThan(
      AA_TEXTO_NORMAL,
    );
  });

  it('los tres roles de texto usan el escalón corregido', () => {
    for (const rol of ['.card-kicker', '.tag-outline', '.btn-ghost']) {
      expect(contrasteCss, rol).toContain(rol);
    }
    expect(contrasteCss).toContain('var(--color-accent-700)');
  });

  it('no se redefine el token de marca: se corrigen roles', () => {
    // Un `--color-accent: …` aquí cambiaría también fondos, bordes y el anillo
    // de foco, que sí funcionan y son lenguaje visual de producto (§10.5).
    expect(contrasteCss).not.toMatch(/--color-accent\s*:/);
  });

  it('la hoja entra después de los tokens, o no ganaría', () => {
    const iTokens = layoutTsx.indexOf("tokens.generated.css");
    const iContraste = layoutTsx.indexOf('a11y-contrast.css');
    expect(iTokens).toBeGreaterThan(-1);
    expect(iContraste).toBeGreaterThan(iTokens);
  });

  it('el blanco sobre el acento sigue por debajo de AA, y está declarado como pendiente', () => {
    // No se arregla aquí: exigiría cambiar el fondo de marca o el color sobre
    // él. Hoy no se renderiza ningún `.btn-primary` en Clase, así que axe no lo
    // ve; el día que aparezca, esto es lo que hay que atender.
    expect(contraste('#ffffff', token('color-accent'))).toBeLessThan(AA_TEXTO_NORMAL);
    expect(contrasteCss).toContain('btn-primary');
  });
});
