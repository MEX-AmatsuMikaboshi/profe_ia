import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// El generador es la única fuente de la derivación; la prueba lo importa en vez
// de reimplementar la regla, que es como se separan dos copias de lo mismo.
import {
  RemoteReferenceError,
  assertNoImport,
  assertNoRemoteReference,
  deriveLocalFirstCss,
  renderGeneratedCss,
  stripCssComments,
  VENDOR_STYLES_SHA256,
} from '../../../scripts/web/generate-tokens-css.mjs';

/**
 * T-H6-13. Los tokens vendorizados abren con un `@import` a Google Fonts. En
 * cuanto `apps/web` los consumiera, la sesión dejaría de ser local (P-II §0.3).
 * El vendorizado no se edita —está hasheado y su proveniencia lo prohíbe—, así
 * que la derivación vive en el generador y esto comprueba que hace su trabajo.
 */

const VENDOR = fileURLToPath(
  new URL('../../../packages/ui-tokens/vendor/styles.css', import.meta.url),
);
const GENERATED = fileURLToPath(new URL('../src/app/tokens.generated.css', import.meta.url));

const vendorCss = readFileSync(VENDOR, 'utf8');
const generatedCss = readFileSync(GENERATED, 'utf8');

describe('hoja de tokens local-first de apps/web (T-H6-13)', () => {
  it('el vendorizado sigue siendo el material del que se derivó', async () => {
    const { createHash } = await import('node:crypto');
    expect(createHash('sha256').update(vendorCss).digest('hex')).toBe(VENDOR_STYLES_SHA256);
  });

  it('el vendorizado sí trae la referencia remota, así que la prueba no pasa por vacío', () => {
    expect(vendorCss).toContain("@import url('https://fonts.googleapis.com");
    expect(() => assertNoRemoteReference(vendorCss)).toThrow(RemoteReferenceError);
  });

  it('el archivo generado corresponde al vendorizado vigente', () => {
    expect(generatedCss).toBe(renderGeneratedCss(vendorCss));
  });

  it('el CSS activo generado no sale a la red', () => {
    const active = stripCssComments(generatedCss);
    expect(active).not.toMatch(/(?:https?:)?\/\//);
    expect(active).not.toContain('@import');
  });

  it('conserva los tokens: retirar el @import no puede llevarse el sistema visual', () => {
    expect(generatedCss).toContain('--color-accent');
    expect(generatedCss).toContain('--font-heading');
    expect(generatedCss).toContain('--space-4');
    // La familia declarada sigue siendo Archivo; lo que cambia es de dónde sale.
    expect(generatedCss).toContain('"Archivo"');
  });

  it('retira el @import completo aunque la URL lleve `;` dentro', () => {
    // Es el caso real: `wght@400;600;800`. Una regex `[^;]*;` cortaba aquí y
    // dejaba `600;800&display=swap');` suelto en la hoja.
    const css = `@import url('https://fonts.example/css2?family=X:wght@400;600;800&display=swap');\n:root { --a: 1px; }\n`;
    const { css: derived, removed } = deriveLocalFirstCss(css);
    expect(removed).toHaveLength(1);
    expect(derived).toBe(':root { --a: 1px; }\n');
    expect(derived).not.toContain('600;800');
  });

  it('un @import local no se retira, y entonces falla en vez de colarlo', () => {
    expect(() => deriveLocalFirstCss("@import url('./local.css');\n:root{}\n")).toThrow(
      RemoteReferenceError,
    );
  });

  it('no pierde el CSS que precede a un @import no remoto', () => {
    // Con un solo índice para copiar y buscar, saltarse un @import local se
    // llevaba por delante todo lo anterior. Se comprueba sobre el caso mixto,
    // que es el único donde el bucle llega a saltarse uno sin retirarlo.
    const css = `:root { --a: 1px; }\n@import url('./local.css');\n@import url('https://x/y.css');\n:root { --b: 2px; }\n`;
    let thrown: unknown;
    try {
      deriveLocalFirstCss(css);
    } catch (err) {
      thrown = err;
    }
    // Falla por el @import local que queda, no por haber perdido nada…
    expect(thrown).toBeInstanceOf(RemoteReferenceError);
    // …y sin el local, la retirada del remoto conserva ambos bloques.
    const { css: derived } = deriveLocalFirstCss(
      `:root { --a: 1px; }\n@import url('https://x/y.css');\n:root { --b: 2px; }\n`,
    );
    expect(derived).toBe(':root { --a: 1px; }\n:root { --b: 2px; }\n');
  });

  it('falla ante una referencia remota que no es un @import, en vez de limpiarla', () => {
    const css = ':root { background: url("https://cdn.example/x.png"); }\n';
    expect(() => deriveLocalFirstCss(css)).toThrow(RemoteReferenceError);
  });

  it('retira también un @import protocol-relative: `//host` es red igual', () => {
    const { css: derived, removed } = deriveLocalFirstCss(
      "@import url('//fonts.example/x.css');\n:root{}\n",
    );
    expect(removed).toEqual(["@import url('//fonts.example/x.css');"]);
    expect(derived).toBe(':root{}\n');
  });

  it('falla si un @import no cierra, en vez de tragárselo entero', () => {
    expect(() => deriveLocalFirstCss("@import url('https://fonts.example/x.css')\n")).toThrow(
      RemoteReferenceError,
    );
  });

  it('un comentario con URL no cuenta como referencia remota, y uno activo sí', () => {
    expect(() => assertNoRemoteReference('/* ver https://ejemplo/x */\n:root{}\n')).not.toThrow();
    expect(() => assertNoRemoteReference(':root { src: url(https://ejemplo/x); }\n')).toThrow(
      RemoteReferenceError,
    );
    expect(() => assertNoImport('/* @import antiguo */\n:root{}\n')).not.toThrow();
  });

  it('el despojo de comentarios conserva los números de línea', () => {
    const stripped = stripCssComments('a\n/* x\ny */\nb\n');
    expect(stripped.split('\n')).toHaveLength(5);
    expect(stripped.split('\n')[3]).toBe('b');
  });
});
