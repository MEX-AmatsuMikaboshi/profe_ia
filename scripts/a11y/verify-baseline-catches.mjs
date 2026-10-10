#!/usr/bin/env node
/**
 * Control positivo de `ci:a11y:baseline` (T-H8-10).
 *
 *   pnpm run ci:a11y:catches
 *
 * Siembra un defecto de cada clase en la página y comprueba que el instrumento
 * correspondiente **lo detecta**. Sin esto, el verde de la línea base no
 * distingue «la vista es accesible» de «el instrumento no mira»: es la misma
 * disciplina que `verify-depcruise-catches.mjs` y que las positivas de la suite
 * de privilegios — sin ellas, una base rota haría pasar todas las negativas por
 * vacío.
 *
 * La siembra se hace **en el DOM y en el estilo ya cargados**, no editando
 * fuentes: así cada caso cuesta milisegundos en vez de una reconstrucción de
 * Next, y se ejercita exactamente el mismo camino de medición —geometría real en
 * un navegador real— que corre en la auditoría de verdad.
 */

import { chromium } from 'playwright';

import {
  RUTA,
  arrancaWeb,
  corrreAxe,
  detectaTrampas,
  estadosConPalabra,
  midetObjetivos,
  movimientoReducido,
  notacionSemantica,
  recorreFoco,
} from './baseline.mjs';

const casos = [];
let fallos = 0;

function comprueba(nombre, condicion, detalle) {
  casos.push({ nombre, ok: condicion, detalle });
  if (!condicion) fallos += 1;
  console.log(`  ${condicion ? '✓' : '✗'} ${nombre}`);
  if (!condicion) console.log(`      ${detalle}`);
}

const { hijo, base } = await arrancaWeb();
let navegador;

try {
  try {
    navegador = await chromium.launch();
  } catch {
    navegador = await chromium.launch({ channel: 'chrome' });
  }

  /** Página limpia por caso: una siembra no debe contaminar la siguiente. */
  async function pagina() {
    const contexto = await navegador.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await contexto.newPage();
    await page.goto(`${base}${RUTA}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="clase"]');
    return page;
  }

  console.log('\nControl positivo de la línea base de accesibilidad\n');

  /* 1 — tamaño de objetivo
   *
   * La siembra deshace exactamente el arreglo que T-H8-10 introdujo en
   * `globals-clase.css` y el espaciado añadido en la reorganización visual.
   * Es mejor que inventar un botón diminuto: reproduce el
   * defecto real —la paleta de notación, ocho botones pegados de 21 px de alto—
   * y por eso vigila que nadie borre esa regla sin enterarse.
   *
   * Un botón suelto de 20×20 al final del contenedor **no** sirve de siembra
   * para axe, y conviene saber por qué: su regla `target-size` implementa la
   * excepción de espaciado de SC 2.5.8, y un objetivo aislado con hueco de sobra
   * a su alrededor conforma. Los de la paleta no, porque se estorban entre sí.
   */
  {
    const page = await pagina();
    const antes = (await midetObjetivos(page)).length;
    await page.addStyleTag({
      content: '.clase-shell button { min-block-size: 0; min-inline-size: 0; }',
    });
    const despues = await midetObjetivos(page);
    comprueba(
      'tamaño de objetivo: quitar la altura mínima devuelve la paleta por debajo de 24×24',
      antes === 0 && despues.some((o) => o.testid.startsWith('simbolo-')),
      `antes ${String(antes)}, después ${String(despues.length)}`,
    );
    // La nueva separación de 8px satisface la excepción de espaciado de axe
    // aun al quitar el mínimo. Para sembrar una infracción de WCAG también
    // hay que retirar esa separación; no se reduce el espacio de la UI real.
    await page.addStyleTag({
      content: '.clase-shell [data-testid="editor-fitch"] [aria-label="Notación"] { gap: 0; }',
    });
    const axe = await corrreAxe(page);
    comprueba(
      'tamaño de objetivo: axe detecta la paleta pequeña sin separación',
      axe.enLineaBase.some((v) => v.id === 'target-size'),
      `axe en línea base: ${axe.enLineaBase.map((v) => v.id).join(', ') || '(ninguna)'}`,
    );
    await page.context().close();
  }

  /* 2 — foco visible */
  {
    const page = await pagina();
    const antes = (await recorreFoco(page, 12)).filter((f) => f !== null && !f.focoVisible);
    await page.addStyleTag({
      content: '*:focus-visible { outline: none !important; box-shadow: none !important; }',
    });
    const despues = (await recorreFoco(page, 12)).filter((f) => f !== null && !f.focoVisible);
    comprueba(
      'foco visible: quitar el contorno se detecta',
      antes.length === 0 && despues.length > 0,
      `antes ${String(antes.length)} sin foco visible, después ${String(despues.length)}`,
    );
    await page.context().close();
  }

  /* 3 — trampa de teclado */
  {
    const page = await pagina();
    const antes = detectaTrampas((await recorreFoco(page, 16)).filter((f) => f !== null));
    await page.evaluate(() => {
      const preso = document.querySelector('[data-testid="pausa"]');
      preso?.focus();
      document.addEventListener(
        'keydown',
        (e) => {
          if (e.key === 'Tab') {
            e.preventDefault();
            preso?.focus();
          }
        },
        true,
      );
    });
    const despues = detectaTrampas((await recorreFoco(page, 16)).filter((f) => f !== null));
    comprueba(
      'trampa de teclado: Tab que no mueve el foco se detecta',
      antes.length === 0 && despues.length > 0,
      `antes ${String(antes.length)} trampas, después ${String(despues.length)}`,
    );
    await page.context().close();
  }

  /* 4 — estado sin palabra */
  {
    const page = await pagina();
    const antes = (await estadosConPalabra(page)).length;
    await page.evaluate(() => {
      const s = document.createElement('span');
      // Estado sólo en el dato y en el símbolo: nada que leer en voz.
      s.setAttribute('data-save-state', 'guardado');
      s.textContent = '✓';
      document.querySelector('.clase-shell')?.appendChild(s);
    });
    const despues = await estadosConPalabra(page);
    comprueba(
      'estado por palabra: un indicador sin texto se detecta',
      antes === 0 && despues.length > 0,
      `antes ${String(antes)}, después ${String(despues.length)}`,
    );
    await page.context().close();
  }

  /* 5 — notación semántica */
  {
    const page = await pagina();
    const antes = await notacionSemantica(page);
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('[data-testid^="formula-"]')) {
        el.textContent = 'P→Q'; // texto plano: se lleva por delante el <math>
      }
    });
    const despues = await notacionSemantica(page);
    comprueba(
      'notación: sustituir el MathML por texto plano se detecta',
      antes.conSemantica === antes.formulas &&
        antes.formulas > 0 &&
        despues.conSemantica < despues.formulas,
      `antes ${String(antes.conSemantica)}/${String(antes.formulas)}, después ` +
        `${String(despues.conSemantica)}/${String(despues.formulas)}`,
    );
    await page.context().close();
  }

  /* 6 — reducción de movimiento */
  {
    const page = await pagina();
    const antes = (await movimientoReducido(page)).length;
    await page.addStyleTag({ content: '.clase-shell { transition: opacity 2s linear; }' });
    const despues = await movimientoReducido(page);
    comprueba(
      'movimiento reducido: una transición larga se detecta con la preferencia puesta',
      antes === 0 && despues.length > 0,
      `antes ${String(antes)} animados, después ${String(despues.length)}`,
    );
    await page.context().close();
  }

  console.log(
    `\n  ${String(casos.length - fallos)}/${String(casos.length)} siembras detectadas\n`,
  );

  if (fallos > 0) {
    console.error(
      `FALLA: ${String(fallos)} siembras que el instrumento NO detectó. Un check que no ` +
        `detecta su propio defecto sembrado no verifica nada.`,
    );
    process.exitCode = 1;
  }
} finally {
  if (navegador !== undefined) await navegador.close();
  hijo.kill();
}
