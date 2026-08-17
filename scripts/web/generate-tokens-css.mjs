/**
 * Deriva la hoja de tokens que consume `apps/web` a partir del CSS vendorizado
 * del design system (T-H0-09), retirando toda referencia remota.
 *
 * Por qué existe: `packages/ui-tokens/vendor/styles.css` abre con
 * `@import url('https://fonts.googleapis.com/css2?family=Archivo…')`. Eso es una
 * dependencia de red en tiempo de render, incompatible con local-first
 * (P-II §0.3) durante una corrida. El archivo vendorizado **no se edita** —está
 * hasheado y su proveniencia lo prohíbe expresamente
 * (`packages/ui-tokens/vendor/PROVENANCE.md`)—, así que la derivación vive aquí,
 * que es «la capa de la app» que esa nota señala.
 *
 * La fuente Archivo se autoaloja como dependencia (`@fontsource/archivo`), no
 * como binario descargado a mano: así pasa por el lockfile, el SBOM y el control
 * de drift como cualquier otra dependencia. La importan las capas de `apps/web`,
 * no esta hoja.
 *
 * Uso: node scripts/web/generate-tokens-css.mjs [--check]
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = process.cwd();
const VENDOR = join(ROOT, 'packages', 'ui-tokens', 'vendor', 'styles.css');
const OUT = join(ROOT, 'apps', 'web', 'src', 'app', 'tokens.generated.css');

/** Hash del material vendorizado; el mismo que declara `@profesor-ia/ui-tokens`. */
export const VENDOR_STYLES_SHA256 =
  'cf9fcf75ac84dfe7517177eb14acf5a20ca4410c55691ab9879c6af7b2168400';

/**
 * Una referencia remota es cualquier URL absoluta o protocol-relative. No se
 * distingue por dominio: permitir «solo Google Fonts» seguiría siendo red en
 * tiempo de render, que es justo lo que local-first prohíbe.
 */
const REMOTE_REFERENCE = /(?:https?:)?\/\//;

export class RemoteReferenceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RemoteReferenceError';
  }
}

/**
 * Devuelve el índice del `;` que cierra el `@import` que empieza en `start`.
 *
 * No se hace con una expresión regular `[^;]*;`: la URL de Google Fonts lleva
 * `;` dentro (`wght@400;600;800`), así que esa versión cortaba la sentencia a la
 * mitad y dejaba `600;800&display=swap');` suelto en la hoja — un CSS roto que
 * además pasaba el control de referencias remotas, porque al fragmento
 * superviviente ya no le quedaba ningún `//`. El escáner respeta comillas y
 * paréntesis, que es donde vive el problema.
 *
 * Devuelve `-1` si la sentencia no cierra.
 */
function endOfImportStatement(css, start) {
  let quote = null;
  let depth = 0;
  for (let i = start; i < css.length; i += 1) {
    const ch = css[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ';' && depth === 0) return i;
  }
  return -1;
}

/**
 * Retira los `@import` remotos y **comprueba** que no sobrevive ninguna
 * referencia remota ni ningún `@import`. Las dos comprobaciones son distintas y
 * ninguna sobra:
 *
 *  - un `url(https://…)` dentro de `background`/`src` no es un `@import`, así
 *    que la retirada sola no lo tocaría;
 *  - un `@import` local futuro tampoco es un caso previsto aquí.
 *
 * En ambos casos **falla en vez de limpiar**: adivinar cómo resolver una
 * referencia que nadie declaró sería inventar.
 */
export function deriveLocalFirstCss(css) {
  const removed = [];
  let out = '';
  // `cursor` marca lo ya copiado; `search` marca por dónde va la búsqueda. Son
  // dos cosas distintas: al saltarse un @import **no** remoto hay que seguir
  // buscando sin mover el cursor, o el texto que lo precede se pierde. Con un
  // solo índice, un @import local se llevaba por delante todo el CSS anterior.
  let cursor = 0;
  let search = 0;

  for (;;) {
    const at = css.indexOf('@import', search);
    if (at === -1) break;
    const end = endOfImportStatement(css, at);
    if (end === -1) {
      throw new RemoteReferenceError(
        `Un @import en la posición ${at} no cierra con ';'; el CSS de origen está malformado.`,
      );
    }

    const statement = css.slice(at, end + 1);
    if (!REMOTE_REFERENCE.test(statement)) {
      search = end + 1;
      continue;
    }

    removed.push(statement);
    out += css.slice(cursor, at);
    // Se consume también el salto de línea que quedaría huérfano.
    cursor = end + 1;
    if (css.startsWith('\r\n', cursor)) cursor += 2;
    else if (css[cursor] === '\n') cursor += 1;
    search = cursor;
  }
  out += css.slice(cursor);

  assertNoRemoteReference(out);
  assertNoImport(out);
  return { css: out, removed };
}

/**
 * Sustituye cada comentario `/* … *\/` por espacios, conservando los saltos de
 * línea para que los números de línea sigan siendo los del archivo real.
 *
 * Un comentario es inerte: el navegador no descarga nada de él. Por eso la
 * cabecera de procedencia puede citar textualmente el `@import` retirado —esa
 * cita **es** la evidencia de qué se quitó— sin que eso cuente como referencia
 * remota. Lo que se comprueba es el CSS activo.
 */
export function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\r\n]/g, ' '),
  );
}

/** Lanza si queda cualquier referencia remota en el CSS **activo** derivado. */
export function assertNoRemoteReference(css) {
  const offending = stripCssComments(css)
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => REMOTE_REFERENCE.test(line));

  if (offending.length > 0) {
    throw new RemoteReferenceError(
      `El CSS derivado conserva ${offending.length} referencia(s) remota(s), incompatibles con ` +
        `local-first (P-II §0.3):\n` +
        offending.map(({ number, line }) => `  línea ${number}: ${line}`).join('\n'),
    );
  }
}

/** Lanza si sobrevive cualquier `@import` activo, remoto o no. */
export function assertNoImport(css) {
  if (stripCssComments(css).includes('@import')) {
    throw new RemoteReferenceError(
      'El CSS derivado conserva un @import. Un @import local no es un caso previsto: decide qué ' +
        'hacer con él en vez de dejar que la derivación lo cuele.',
    );
  }
}

/** Cabecera con la procedencia, para que el diff diga de dónde salió el archivo. */
export function renderGeneratedCss(vendorCss) {
  const { css, removed } = deriveLocalFirstCss(vendorCss);
  const digest = createHash('sha256').update(vendorCss).digest('hex');
  const header = [
    '/* GENERADO por scripts/web/generate-tokens-css.mjs — NO EDITAR A MANO.',
    ' * Fuente: packages/ui-tokens/vendor/styles.css',
    ` * SHA-256 de la fuente: ${digest}`,
    ' * Regenerar: pnpm run web:tokens',
    ' *',
    ' * Retirado de la fuente para cumplir local-first (P-II §0.3):',
    ...removed.map((statement) => ` *   ${statement}`),
    ' *',
    ' * La fuente Archivo se autoaloja vía @fontsource/archivo, importada por el',
    ' * layout de la app. No se sustituye por una descarga a mano.',
    ' */',
    '',
  ].join('\n');

  return `${header}${css}`;
}

function main() {
  const vendorCss = readFileSync(VENDOR, 'utf8');
  const digest = createHash('sha256').update(vendorCss).digest('hex');
  if (digest !== VENDOR_STYLES_SHA256) {
    console.error(
      `El CSS vendorizado cambió (${digest} ≠ ${VENDOR_STYLES_SHA256}). Retunear el design ` +
        'system es una iteración de la UIUX: se reemplaza el vendorizado con nueva proveniencia ' +
        '(packages/ui-tokens/vendor/PROVENANCE.md), no se actualiza este hash a mano.',
    );
    process.exit(1);
  }

  let generated;
  try {
    generated = renderGeneratedCss(vendorCss);
  } catch (err) {
    console.error(String(err instanceof Error ? err.message : err));
    process.exit(1);
  }

  if (process.argv.includes('--check')) {
    let current;
    try {
      current = readFileSync(OUT, 'utf8');
    } catch {
      console.error(`DRIFT: falta ${OUT}. Ejecuta \`pnpm run web:tokens\`.`);
      process.exit(1);
    }
    if (current !== generated) {
      console.error(
        'DRIFT: apps/web/src/app/tokens.generated.css no corresponde al CSS vendorizado. ' +
          'Ejecuta `pnpm run web:tokens`.',
      );
      process.exit(1);
    }
    console.log('ok: la hoja de tokens de apps/web corresponde al vendorizado y no sale a la red');
    return;
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, generated, 'utf8');
  console.log(`tokens locales generados → ${OUT}`);
}

// `import.meta.main` no existe en Node 24; se compara la ruta invocada.
if (process.argv[1] && process.argv[1].endsWith('generate-tokens-css.mjs')) {
  main();
}
