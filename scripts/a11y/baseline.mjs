#!/usr/bin/env node
/**
 * `ci:a11y:baseline` — línea base de accesibilidad H8 (T-H8-10 ← Maestro §10.5,
 * UIUX §8).
 *
 *   pnpm run ci:build && pnpm run ci:a11y:baseline
 *
 * Levanta `apps/web` construida, abre la vista de Clase con Chromium y ejecuta
 * los instrumentos que deciden qué criterio puede declararse verificado. El
 * dictamen final no lo emite este archivo: lo emite
 * `buildAccessibilityBaseline()` de `@profesor-ia/visual-interaction`, que se
 * niega a marcar verificado un criterio sin check o sin superficie montada.
 *
 * ## Por qué navegador de verdad y no jsdom
 *
 * Dos de los criterios —tamaño de objetivo (WCAG 2.2 SC 2.5.8) y foco visible—
 * son geométricos: dependen de la caja que resulta de la hoja de estilo. jsdom no
 * calcula disposición, así que devolvería «sin problemas» para los dos, que es la
 * forma más limpia de aprobar por vacío. El primer defecto real que encontró este
 * check —los botones de la paleta de notación— es justo de esa clase.
 *
 * ## Lo que este check NO hace
 *
 * - **No implementa la excepción de espaciado** de SC 2.5.8. Un objetivo menor de
 *   24×24 con separación suficiente puede conformar igualmente; aquí se reporta
 *   y se decide a mano. Sobra-reportar es preferible a callar.
 * - **No declara conformidad WCAG global.** Ni puede: el informe no tiene campo.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as espera } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

import { buildAccessibilityBaseline } from '../../packages/visual-interaction/dist/accessibility.js';

const REPO = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const WEB = join(REPO, 'apps', 'web');
const PORT = process.env.A11Y_PORT ?? '3020';
export const RUTA = '/materias/logica/clase';
const SALIDA = join(REPO, 'analysis', 'reports', 'a11y-baseline.json');

/** Los controles críticos que el Maestro §10.5 nombra uno a uno. */
const CONTROLES_CRITICOS = [
  { testid: 'pausa', nombre: 'pausa' },
  { testid: 'apelacion', nombre: 'apelación' },
  { testid: 'retirada', nombre: 'retirada' },
  // «pistas» aparece como botón o como aviso de no disponible, según el modo.
  { testid: 'pedir-pista', nombre: 'pistas', opcional: 'pistas-no-disponibles' },
];

const MIN_OBJETIVO_PX = 24;

function log(msg) {
  console.log(msg);
}

/* ── servidor ──────────────────────────────────────────────────────────────── */

export async function arrancaWeb() {
  if (!existsSync(join(WEB, '.next', 'BUILD_ID'))) {
    console.error(
      'No hay build de `apps/web`. Este check audita la salida de producción, no el\n' +
        'servidor de desarrollo: el overlay de Next inyecta DOM propio y contaminaría\n' +
        'el resultado de axe.\n\n  pnpm run ci:build\n',
    );
    process.exit(2);
  }

  const next = join(WEB, 'node_modules', 'next', 'dist', 'bin', 'next');
  const hijo = spawn(process.execPath, [next, 'start', '-p', PORT], {
    cwd: WEB,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const base = `http://localhost:${PORT}`;
  const limite = Date.now() + 60_000;
  for (;;) {
    if (Date.now() > limite) {
      hijo.kill();
      throw new Error(`la web no respondió en ${base} en 60 s`);
    }
    try {
      const res = await fetch(`${base}${RUTA}`);
      if (res.ok) break;
    } catch {
      /* todavía arrancando */
    }
    await espera(400);
  }
  return { hijo, base };
}

/* ── instrumentos ──────────────────────────────────────────────────────────── */

/**
 * Reglas de axe que corresponden a un criterio de la línea base.
 *
 * La distinción no es burocrática. Los once criterios son los que el Maestro
 * §10.5 y UIUX §8 exigen desde H8; axe comprueba WCAG entero, que es más. Una
 * violación **fuera** de esa lista es un hallazgo real y se publica, pero no
 * puede tumbar el check: haría que este archivo exigiera de facto una
 * conformidad que las dos autoridades declaran expresamente no exigir todavía
 * —y decidir el lenguaje visual está diferido a producto (§10.5)—.
 */
const AXE_A_CRITERIO = {
  'target-size': 'CRIT-OBJETIVO',
  'focus-order-semantics': 'CRIT-FOCO',
  'aria-hidden-focus': 'CRIT-OVERLAY',
};

/** axe-core sobre la página, con las etiquetas WCAG que aplican a la línea base. */
export async function corrreAxe(page) {
  const resultado = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const violaciones = resultado.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    criterion: AXE_A_CRITERIO[v.id] ?? null,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5),
  }));
  return {
    enLineaBase: violaciones.filter((v) => v.criterion !== null),
    fueraDeLineaBase: violaciones.filter((v) => v.criterion === null),
  };
}

/**
 * Recorre el foco con Tab y devuelve el orden observado.
 *
 * Sirve a dos criterios a la vez: la ausencia de trampas —si el foco se queda
 * clavado en un elemento, se ve aquí— y el foco visible, que se mide sobre el
 * elemento realmente enfocado por teclado. `element.focus()` no vale: en Chromium
 * el foco programático no dispara `:focus-visible`, así que mediría el estilo
 * equivocado y diría que no hay foco visible donde sí lo hay.
 */
export async function recorreFoco(page, pasos) {
  const visitados = [];
  for (let i = 0; i < pasos; i += 1) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (el === null || el === document.body) return null;
      const estilo = getComputedStyle(el);
      const caja = el.getBoundingClientRect();
      const anchoContorno = Number.parseFloat(estilo.outlineWidth) || 0;
      const sinContorno = estilo.outlineStyle === 'none' || anchoContorno === 0;
      return {
        etiqueta: el.tagName.toLowerCase(),
        testid: el.getAttribute('data-testid') ?? '',
        texto: (el.textContent ?? '').trim().slice(0, 40),
        focoVisible: !sinContorno || estilo.boxShadow !== 'none',
        ancho: Math.round(caja.width * 10) / 10,
        alto: Math.round(caja.height * 10) / 10,
      };
    });
    visitados.push(info);
  }
  return visitados;
}

/** Tamaño de objetivo de todo lo interactivo (SC 2.5.8), medido en el navegador. */
export async function midetObjetivos(page) {
  return page.evaluate((minimo) => {
    const sel = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const pequenos = [];

    /**
     * La caja que recibe el puntero, que no siempre es la del elemento.
     *
     * SC 2.5.8 mide el **objetivo**: la superficie que hay que acertar con el
     * dedo. Un `<input type="radio">` dentro de un `<label>` no es ese objetivo
     * —el label lo es, y activarlo activa el input—, así que medir el input
     * reporta 13×13 donde el usuario tiene 36×36.
     *
     * Se descubrió al montar el pizarrón (T-H8-03): Excalidraw construye así
     * toda su barra, y el criterio señaló trece objetivos pequeños que en
     * pantalla no lo son. Un falso positivo aquí es tan malo como un falso
     * negativo: enseña a ignorar el criterio.
     *
     * Sólo se amplía a `label`, y sólo cuando **contiene** al control o lo
     * referencia con `for`: son los dos casos en que el navegador reenvía el
     * clic. Cualquier otro envoltorio no recibe el puntero y no cuenta.
     */
    const objetivoDe = (el) => {
      const propia = el.getBoundingClientRect();
      const esControl = el.tagName === 'INPUT' || el.tagName === 'SELECT';
      if (!esControl) return propia;
      const envolvente = el.closest('label');
      const porFor =
        el.id === '' ? null : document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      const label = envolvente ?? porFor;
      if (label === null) return propia;
      const caja = label.getBoundingClientRect();
      // El label tiene que ser al menos tan grande: si fuera menor, el objetivo
      // efectivo sigue siendo el control y ampliarlo sería aprobar por vacío.
      return caja.width >= propia.width && caja.height >= propia.height ? caja : propia;
    };

    for (const el of document.querySelectorAll(sel)) {
      const propia = el.getBoundingClientRect();
      if (propia.width === 0 && propia.height === 0) continue; // no renderizado
      const caja = objetivoDe(el);
      if (caja.width < minimo || caja.height < minimo) {
        pequenos.push({
          etiqueta: el.tagName.toLowerCase(),
          testid: el.getAttribute('data-testid') ?? '',
          texto: (el.textContent ?? '').trim().slice(0, 24),
          ancho: Math.round(caja.width * 10) / 10,
          alto: Math.round(caja.height * 10) / 10,
        });
      }
    }
    return pequenos;
  }, MIN_OBJETIVO_PX);
}

/**
 * Estados comunicados por palabra además de color o movimiento (UIUX §3, §8).
 *
 * Se comprueba sobre los portadores de estado reales de la vista: si un elemento
 * lleva el estado en un atributo de datos pero no lo dice con texto, quien no ve
 * la pantalla no lo recibe.
 */
export async function estadosConPalabra(page) {
  return page.evaluate(() => {
    const portadores = [
      '[data-save-state]',
      '[data-standing]',
      '[data-valid]',
      '[data-consequence]',
      '[data-reason]',
    ];
    const mudos = [];
    for (const sel of portadores) {
      for (const el of document.querySelectorAll(sel)) {
        const texto = (el.textContent ?? '').replace(/[✓✕•…│\s]/g, '');
        if (texto === '') {
          mudos.push({ selector: sel, html: el.outerHTML.slice(0, 120) });
        }
      }
    }
    return mudos;
  });
}

/** Notación lógica expuesta semánticamente (MathML preferido). */
export async function notacionSemantica(page) {
  return page.evaluate(() => {
    const mathml = document.querySelectorAll('math').length;
    const formulas = document.querySelectorAll('[data-testid^="formula-"]');
    const conSemantica = [...formulas].filter(
      (el) =>
        el.querySelector('math') !== null ||
        el.getAttribute('aria-label') !== null ||
        el.getAttribute('role') === 'math',
    ).length;
    return { mathml, formulas: formulas.length, conSemantica };
  });
}

/** Reducción de movimiento respetada: nada animado con la preferencia puesta. */
export async function movimientoReducido(page) {
  return page.evaluate(() => {
    const animados = [];
    for (const el of document.querySelectorAll('*')) {
      const e = getComputedStyle(el);
      const dur = (s) => s.split(',').reduce((max, v) => Math.max(max, Number.parseFloat(v) || 0), 0);
      if (dur(e.animationDuration) > 0.01 || dur(e.transitionDuration) > 0.01) {
        animados.push({ etiqueta: el.tagName.toLowerCase(), clase: el.className?.toString?.() ?? '' });
      }
    }
    return animados.slice(0, 10);
  });
}

/**
 * Trampa de teclado: el foco se queda clavado en el mismo elemento.
 *
 * Se mira una ventana de cuatro pulsaciones consecutivas. Con menos, un patrón
 * legítimo —dos controles idénticos seguidos— daría falso positivo; el criterio
 * es que Tab deje de mover el foco, no que dos elementos se parezcan.
 */
export function detectaTrampas(enfocados) {
  const trampas = [];
  for (let i = 3; i < enfocados.length; i += 1) {
    const ventana = enfocados
      .slice(i - 3, i + 1)
      .map((f) => `${f.etiqueta}:${f.testid}:${f.texto}`);
    if (new Set(ventana).size === 1) trampas.push(ventana[0]);
  }
  return trampas;
}

/* ── corrida ───────────────────────────────────────────────────────────────── */

async function main() {
  const { hijo, base } = await arrancaWeb();
  let navegador;
  let canal = 'chromium (empaquetado)';

  try {
    try {
      navegador = await chromium.launch();
    } catch {
      // Sin el binario empaquetado se usa el Chrome del sistema. Se dice cuál,
      // porque un resultado geométrico depende del motor que lo midió.
      navegador = await chromium.launch({ channel: 'chrome' });
      canal = 'chrome (del sistema)';
    }

    const contexto = await navegador.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await contexto.newPage();
    await page.goto(`${base}${RUTA}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="clase"]');

    log(`\n  motor     ${canal}`);
    log(`  vista     ${base}${RUTA}\n`);

    const axe = await corrreAxe(page);
    const objetivosPequenos = await midetObjetivos(page);
    const mudos = await estadosConPalabra(page);
    const notacion = await notacionSemantica(page);
    const animados = await movimientoReducido(page);
    const foco = await recorreFoco(page, 40);

    const enfocados = foco.filter((f) => f !== null);
    const sinFocoVisible = enfocados.filter((f) => !f.focoVisible);
    const alcanzables = new Set(enfocados.map((f) => f.testid).filter((t) => t !== ''));

    const trampas = detectaTrampas(enfocados);

    const noAlcanzables = CONTROLES_CRITICOS.filter(
      (c) => !alcanzables.has(c.testid) && (c.opcional === undefined || !alcanzables.has(c.opcional)),
    );
    // El micrófono no existe todavía: no se cuenta como control no alcanzable,
    // se declara superficie ausente más abajo.

    /* ── superficies ── */
    const presentes = async (sel) => (await page.locator(sel).count()) > 0;
    const superficies = [
      {
        surface: 'editor-fitch',
        present: await presentes('[data-testid="editor-fitch"]'),
        detail: 'FitchEditor en la vista de Clase',
      },
      {
        surface: 'controles-de-sesion',
        present: await presentes('[data-testid="pausa"]'),
        detail: 'pistas, pausa, apelación y retirada',
      },
      {
        surface: 'transcripcion-y-profesor',
        present: await presentes('[data-testid="conversacion"]'),
        detail: 'conversación y panel del Profesor IA',
      },
      {
        surface: 'microfono',
        present: await presentes('[data-testid="microfono"]'),
        detail: 'T-H8-01 pendiente: sin credencial de proveedor de voz no hay captura',
      },
      {
        surface: 'pizarron',
        present: await presentes('[data-testid="pizarron"]'),
        detail: 'T-H8-03 dejó el adaptador de estado; falta montarlo en la vista',
      },
      {
        surface: 'overlay-anotaciones',
        present: await presentes('[data-testid="overlay-anotaciones"]'),
        detail: 'T-H8-05 dejó el modelo de anotación; falta la capa que lo dibuja',
      },
      {
        surface: 'notacion-logica',
        present: notacion.formulas > 0,
        detail: `${String(notacion.formulas)} fórmulas renderizadas en el editor`,
      },
    ];
    const montada = (s) => superficies.find((x) => x.surface === s)?.present === true;

    /* ── dictámenes ── */
    const claims = [];
    const push = (criterionId, ok, checks, motivo) =>
      claims.push(
        ok
          ? { criterionId, status: 'verificado', checks, note: '' }
          : { criterionId, status: 'no_verificado', checks: [], note: motivo },
      );

    push(
      'CRIT-TECLADO',
      noAlcanzables.length === 0,
      ['ci:a11y:baseline#recorrido-de-foco'],
      `no se alcanzan con Tab: ${noAlcanzables.map((c) => c.nombre).join(', ')}`,
    );
    push(
      'CRIT-FOCO',
      sinFocoVisible.length === 0,
      ['ci:a11y:baseline#foco-visible'],
      `${String(sinFocoVisible.length)} elementos enfocados sin contorno ni sombra visible`,
    );
    push(
      'CRIT-SIN-TRAMPAS',
      trampas.length === 0,
      ['ci:a11y:baseline#recorrido-de-foco'],
      `el foco se queda clavado en: ${trampas.join(', ')}`,
    );
    push(
      'CRIT-OBJETIVO',
      objetivosPequenos.length === 0,
      ['ci:a11y:baseline#tamano-de-objetivo', 'axe#target-size'],
      `${String(objetivosPequenos.length)} objetivos por debajo de ${String(MIN_OBJETIVO_PX)}×${String(MIN_OBJETIVO_PX)} px: ` +
        objetivosPequenos
          .slice(0, 6)
          .map((o) => `${o.testid || o.texto} (${String(o.ancho)}×${String(o.alto)})`)
          .join(', '),
    );
    push(
      'CRIT-PALABRA',
      mudos.length === 0,
      ['ci:a11y:baseline#estado-por-palabra'],
      `${String(mudos.length)} portadores de estado sin texto`,
    );
    push(
      'CRIT-MOVIMIENTO',
      animados.length === 0,
      ['ci:a11y:baseline#movimiento-reducido'],
      `${String(animados.length)} elementos siguen animados con prefers-reduced-motion: reduce`,
    );
    push(
      'CRIT-NOTACION',
      montada('notacion-logica') && notacion.conSemantica === notacion.formulas,
      ['ci:a11y:baseline#notacion-semantica'],
      `${String(notacion.formulas - notacion.conSemantica)} de ${String(notacion.formulas)} fórmulas se ` +
        `renderizan como texto plano, sin MathML ni equivalente accesible`,
    );

    // Estos dos dependen del pizarrón, y **se preguntan por él** en vez de
    // declararse. Estuvieron fijos en `no_verificado` mientras la superficie no
    // existía; al montarla (T-H8-03) el texto pasó a ser falso —decía «no está
    // montado» con el pizarrón en pantalla— y un motivo que miente es peor que
    // un criterio sin verificar, porque nadie vuelve a mirarlo.
    if (!montada('pizarron')) {
      claims.push({
        criterionId: 'CRIT-ARRASTRE',
        status: 'no_verificado',
        checks: [],
        note: 'el pizarrón no está montado en la vista: no hay gesto de arrastre que auditar (T-H8-03)',
      });
      claims.push({
        criterionId: 'CRIT-ESCENA-DOM',
        status: 'no_verificado',
        checks: [],
        note: 'el pizarrón no está montado en la vista; su adaptador de estado existe pero no se renderiza (T-H8-03)',
      });
    } else {
      // WCAG 2.5.7. Excalidraw dibuja arrastrando. Para el trazo a mano alzada
      // el arrastre **es esencial** y el criterio lo exceptúa; para colocar una
      // forma, una flecha o un texto no lo es, así que hace falta alternativa de
      // un solo puntero. Se comprueba que existe y que es alcanzable, no que
      // esté escrita en alguna parte.
      const sinArrastre = await page.evaluate(() => {
        const zona = document.querySelector('[data-testid="pizarron-sin-arrastre"]');
        if (zona === null) return null;
        const botones = [...zona.querySelectorAll('button')];
        return {
          total: botones.length,
          conNombre: botones.filter((b) => (b.textContent ?? '').trim() !== '').length,
          conAyuda: zona.querySelector('[id="pizarron-sin-arrastre-ayuda"]') !== null,
        };
      });
      push(
        'CRIT-ARRASTRE',
        sinArrastre !== null &&
          sinArrastre.total >= 3 &&
          sinArrastre.total === sinArrastre.conNombre &&
          sinArrastre.conAyuda,
        ['ci:a11y:baseline#alternativa-sin-arrastre'],
        sinArrastre === null
          ? 'el pizarrón está montado y sólo se puede usar arrastrando: no hay alternativa de un ' +
            'solo puntero para colocar elementos (WCAG 2.5.7)'
          : `la alternativa sin arrastre está incompleta: ${String(sinArrastre.total)} controles, ` +
            `${String(sinArrastre.conNombre)} con nombre accesible, ayuda ${sinArrastre.conAyuda ? 'sí' : 'no'}`,
      );
      // El lienzo es `<canvas>`: sus elementos no están en el DOM. Lo que se
      // audita es el **equivalente accesible** que la aplicación pone al lado, y
      // que tiene que reflejar la misma escena: una lista vacía con elementos
      // dibujados sería un equivalente que miente.
      const escena = await page.evaluate(() => {
        const lista = document.querySelector('[data-testid="pizarron-escena"]');
        if (lista === null) return null;
        return {
          declarados: Number(lista.getAttribute('data-elementos') ?? '-1'),
          entradas: lista.querySelectorAll('li').length,
          etiquetada: (lista.getAttribute('aria-label') ?? '').trim() !== '',
          enVivo: lista.getAttribute('aria-live') === 'polite',
        };
      });
      const coherente =
        escena !== null &&
        escena.etiquetada &&
        escena.enVivo &&
        // Con la escena vacía la lista lleva una entrada que lo dice.
        escena.entradas === Math.max(escena.declarados, 1);
      push(
        'CRIT-ESCENA-DOM',
        coherente,
        ['ci:a11y:baseline#escena-equivalente'],
        escena === null
          ? 'el pizarrón está montado pero no expone equivalente accesible de la escena: un ' +
            '<canvas> no tiene contenido que un lector de pantalla pueda recorrer'
          : `el equivalente accesible no corresponde a la escena: declara ${String(escena.declarados)} ` +
            `elementos y lista ${String(escena.entradas)} entradas`,
      );
    }
    claims.push({
      criterionId: 'CRIT-OVERLAY',
      status: 'no_verificado',
      checks: [],
      note: 'la capa de anotaciones no se dibuja todavía; T-H8-05 dejó el modelo, no el renderizado',
    });
    claims.push({
      criterionId: 'CRIT-AYUDAS-TECNICAS',
      status: 'no_verificado',
      checks: [],
      note:
        'no hay corrida con participante: el registro se llena en T-H8-14, que es humana. ' +
        'El mecanismo está en canRuleOutAccessibilityBarrier() y sus pruebas',
    });

    const report = buildAccessibilityBaseline({ surfaces: superficies, claims });

    /* ── salida ── */
    const documento = {
      task: 'T-H8-10',
      generatedBy: 'ci:a11y:baseline',
      engine: canal,
      view: RUTA,
      wcagGlobalConformance: report.wcagGlobalConformance,
      surfaces: superficies,
      rulings: report.rulings,
      findings: {
        axeInBaseline: axe.enLineaBase,
        // Hallazgos reales que **no** son de los once criterios. Se publican
        // para que nadie tenga que redescubrirlos, y no tumban el check.
        axeOutsideBaseline: axe.fueraDeLineaBase,
        targetSize: objetivosPequenos,
        focusWithoutIndicator: sinFocoVisible,
        keyboardTraps: trampas,
        stateWithoutWords: mudos,
        animatedWithReducedMotion: animados,
        notation: notacion,
      },
    };
    mkdirSync(join(REPO, 'analysis', 'reports'), { recursive: true });
    writeFileSync(SALIDA, `${JSON.stringify(documento, null, 2)}\n`, 'utf8');

    for (const r of report.rulings) {
      const marca = r.status === 'verificado' ? '✓' : r.status === 'excepcion' ? '!' : '·';
      log(`  ${marca} ${r.criterionId.padEnd(20)} ${r.status}`);
      if (r.status !== 'verificado') log(`      ${r.note}`);
    }
    log(
      `\n  verificados ${String(report.verified.length)} · no verificados ` +
        `${String(report.notVerified.length)} · excepciones ${String(report.exceptions.length)}`,
    );
    log(`  conformidad WCAG global: ${report.wcagGlobalConformance}`);
    log(`  informe: ${SALIDA}\n`);

    for (const v of axe.enLineaBase) {
      log(`  axe [${v.impact}] ${v.id} (${v.criterion}): ${v.nodes.join(', ')}`);
    }
    if (axe.fueraDeLineaBase.length > 0) {
      log(`\n  Fuera de los once criterios — hallazgos reales, no tumban el check:`);
      for (const v of axe.fueraDeLineaBase) {
        log(`    - [${v.impact}] ${v.id}: ${v.help}`);
        log(`      ${v.nodes.join(', ')}`);
      }
      log(
        `    Ninguno está en Maestro §10.5 ni UIUX §8. El lenguaje visual está diferido a\n` +
          `    producto (§10.5): cambiar la paleta aquí decidiría por quien tiene esa autoridad.\n`,
      );
    }

    // Falla si un criterio **cuya superficie está montada** no se verificó: eso
    // es un defecto real. Los que dependen de superficies ausentes no fallan,
    // porque su motivo es que F10 no ha llegado ahí, y ya está escrito.
    const defectos = report.rulings.filter(
      (r) =>
        r.status === 'no_verificado' &&
        r.missingSurfaces.length === 0 &&
        r.criterionId !== 'CRIT-AYUDAS-TECNICAS',
    );
    if (defectos.length > 0 || axe.enLineaBase.length > 0) {
      console.error(
        `\nFALLA: ${String(defectos.length)} criterios con superficie montada sin verificar ` +
          `(${defectos.map((d) => d.criterionId).join(', ')}) y ` +
          `${String(axe.enLineaBase.length)} violaciones de axe dentro de la línea base.`,
      );
      process.exitCode = 1;
    } else {
      log('  línea base en verde para las superficies que existen hoy.\n');
    }
  } finally {
    if (navegador !== undefined) await navegador.close();
    hijo.kill();
  }
}

// Sólo corre como entrypoint: `verify-baseline-catches.mjs` importa los
// instrumentos para sembrarles defectos y comprobar que los detectan.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
