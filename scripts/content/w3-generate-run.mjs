#!/usr/bin/env node
/**
 * Corrida W3 en vivo (F6/H5, T-H5-05): autoría automática sobre el mapa de KC y
 * el corpus real, con el orden de validez congelado por BENCH-04.
 *
 * Uso: node scripts/content/w3-generate-run.mjs
 *
 * Qué hace y qué no:
 * - La lógica es `runW3Generation()` (pura). Aquí hay disco y **plantillas
 *   declaradas**: Rol C entrega enunciados, KC objetivo, función de banco y
 *   complejidad **objetivo**, y ninguna solución. Las soluciones las produce el
 *   buscador y las certifica `logic-core`.
 * - **El orden de validez no se cablea.** Se lee de
 *   `audits/bench04-frozen-order.yaml` y se comprueba que se midió sobre **este**
 *   paquete: un orden congelado sobre otro contenido no dice nada de esta
 *   corrida.
 * - **La complejidad objetivo se declara antes de medir.** Si CAL-09 mide otro
 *   estrato, el reactivo se rechaza con `complexity_target_mismatch` y **no se
 *   reetiqueta**: cambiar la declaración para que cuadre con lo medido
 *   convertiría el objetivo en un espejo de la medida.
 * - **Los ejercicios del corpus entran de verdad** al control de duplicación: se
 *   extraen del snapshot las formas de argumento del libro, así que
 *   `duplicate_of_corpus_exercise` tiene contra qué comparar en vez de pasar por
 *   vacío.
 * - **El crítico no es independiente y se registra como tal.** Rol C/D y Rol E
 *   son el mismo modelo asistente: P-I §7.3 no lo prohíbe, invalida usar su
 *   acuerdo como evidencia para congelar la familia. Eso lo mira W5, no W3.
 * - Salvedad general (D-41/D-48/D-52/D-53): las plantillas, las pistas y las
 *   críticas las redactó el modelo asistente. El propietario las audita en W4.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  COVERAGE_PARAMETERS,
  criticIndependence,
  perKcCoverageGaps,
  premiseEntryRule,
  runW3Generation,
} from '../../packages/authoring-core/dist/index.js';
import { tryParse } from '../../packages/logic-core/dist/index.js';
import { BENCH04_L0_CASES, CAL09_FROZEN_MANIFEST } from '../../packages/proof-search/dist/index.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CONTENIDO = join(RAIZ, 'content/unidad-deduccion-natural');
const AHORA = new Date().toISOString();

const COMPONENTE = 'forallx-yyc/tfl-deduccion-natural';
const COMMIT = 'ec34df8f8f42ccba2bf2d24403ebad335afa93b9';
const ARCHIVO_ND = 'forallx-yyc-prooftfl.tex';
const FAMILIA_DEL_MODELO = 'anthropic-claude';

const BARRA = String.fromCharCode(92);
const THEREFORE = `${BARRA}therefore`;
const MACROS = [
  [`${BARRA}enot`, '¬'],
  [`${BARRA}eand`, '∧'],
  [`${BARRA}eor`, '∨'],
  [`${BARRA}lor`, '∨'],
  [`${BARRA}eiff`, '↔'],
  [`${BARRA}eif`, '→'],
  [`${BARRA}ered`, '⊥'],
];

/**
 * Plantillas de Rol C, una por KC: forma de enseñanza y forma de transferencia,
 * cada una con su complejidad **objetivo**.
 *
 * `p`, `q`, `r` son huecos de átomo que se sustituyen por variante. La forma de
 * transferencia **no es la de enseñanza con otros nombres**: §5.11 pide «una
 * forma superficial suficientemente distinta», y renombrar átomos es justo lo
 * que la norma dice que **no** crea una forma nueva.
 *
 * `contradiccionExplicita` marca los reactivos cuyo objetivo declarado *es*
 * trabajar desde una contradicción (KC10 y KC12): sus premisas son
 * insatisfacibles por construcción, y §7.5 admite exactamente ese caso siempre
 * que se declare. Sin la marca, el filtro los rechazaría —con razón— como
 * triviales por accidente.
 *
 * Regla de declaración de la complejidad objetivo, **fijada antes de medir** y
 * aplicada igual a todas las formas:
 *
 *   `baja`  — una sola aplicación de regla sobre las premisas, sin subprueba;
 *   `media` — dos o tres aplicaciones, **o** exactamente una subprueba;
 *   `alta`  — más de una subprueba, o más de tres aplicaciones.
 *
 * La primera corrida declaraba un objetivo por KC, no por forma, y **60 de 108
 * reactivos salieron con `complexity_target_mismatch` — todos medidos por
 * encima de lo declarado, ninguno por debajo**. Esa asimetría es lo que dice
 * que lo equivocado era la regla y no los reactivos uno a uno: la banda `baja`
 * de `cal-09-v1` ([0, 14.004]) es mucho más estrecha que «uno o dos pasos».
 * La regla se corrige **como regla** y se vuelve a correr; los desajustes que
 * queden se rechazan y se cuentan. Reetiquetar cada reactivo con lo que midió
 * CAL-09 convertiría el objetivo en un espejo de la medida, que es exactamente
 * lo que el conjunto dorado prohíbe.
 */
const PLANTILLAS = {
  KC01: { base: [['(p∧q)∧r'], 'p∧(q∧r)', 'alta'], transfer: [['p∧(q∧r)'], '(r∧q)∧p', 'alta'] },
  KC02: { base: [['p∧q'], 'q∧p', 'media'], transfer: [['p∧(q∧r)'], 'r∧p', 'alta'] },
  // Transferencia rehecha: `p∧q ⊢ r→p` era el **único defecto** que encontró la
  // auditoría de W4 (`incorrect_kc_label`). KC03 es reiteración, y el buscador
  // obtenía el consecuente por `∧E` **dentro** de la subprueba: quien lo
  // resolviera no habría reiterado nada, y la cobertura de KC03 contaría una
  // oportunidad que no lo era. Con el consecuente entero disponible fuera, la
  // única forma de tenerlo dentro es reiterarlo. Comprobado: el certificado pasa
  // de `PR, AS, ∧E, →I` a `PR, AS, R, →I`, y sigue midiendo `media`.
  KC03: { base: [['p'], 'q→p', 'media'], transfer: [['p∧q'], 'r→(p∧q)', 'media'] },
  KC04: { base: [['p', 'q'], 'p∧q', 'baja'], transfer: [['p', 'q', 'r'], '(p∧q)∧r', 'media'] },
  KC05: { base: [['p∧q'], 'p', 'baja'], transfer: [['(p∧q)∧r'], 'q', 'media'] },
  KC06: { base: [['p→q', 'p'], 'q', 'baja'], transfer: [['p→(q→r)', 'p', 'q'], 'r', 'media'] },
  KC07: { base: [['p'], 'p∨q', 'baja'], transfer: [['p∧q'], '(p∨r)∧q', 'alta'] },
  KC08: { base: [['p'], 'q→(p∧q)', 'media'], transfer: [['p'], 'q→(r→(p∧q))', 'alta'] },
  // Base y transferencia rehechas: las anteriores coincidían con ejercicios del
  // propio libro (corpus-ej-04 y corpus-ej-09), y el control de duplicación las
  // rechazó. No es un falso positivo: reproducían el ejercicio del corpus.
  KC09: { base: [['(p→q)∧(q→r)'], 'p→r', 'alta'], transfer: [['p→q'], '(p∧r)→q', 'media'] },
  KC10: {
    base: [['p', '¬p'], '⊥', 'baja'],
    transfer: [['p∧q', '¬q'], '⊥', 'media'],
    contradiccionExplicita: true,
  },
  // Base rehecha: la anterior era el ejercicio corpus-ej-07 del libro.
  KC11: { base: [['p→q', 'p→¬q'], '¬p', 'alta'], transfer: [['p→(q∧¬q)'], '¬p', 'alta'] },
  KC12: {
    base: [['p', '¬p'], 'q', 'media'],
    transfer: [['p∧¬p'], 'q∨r', 'alta'],
    contradiccionExplicita: true,
  },
  // Transferencia rehecha: `(p∧q)∨(p∧r) ⊢ p` es el ejercicio corpus-ej-05 del
  // libro. Antes se rechazaba por indemostrable y eso **tapaba** la
  // duplicación; con `∨E` arreglado (D-56) el control la vio.
  KC13: { base: [['p∨q', 'p→r', 'q→r'], 'r', 'alta'], transfer: [['(p∨q)∧r'], '(p∧r)∨(q∧r)', 'alta'] },
  // Base rehecha: la anterior era el ejercicio corpus-ej-10 del libro.
  KC14: { base: [['p', 'q'], 'p↔q', 'alta'], transfer: [['p→q', 'q→p'], 'p↔q', 'alta'] },
  KC15: { base: [['p↔q', 'p'], 'q', 'baja'], transfer: [['p↔q', 'q'], 'p', 'baja'] },
  KC16: { base: [['¬¬p'], 'p', 'baja'], transfer: [['¬¬(p∧q)'], 'q', 'media'] },
  KC17: { base: [['¬p→q', '¬p→¬q'], 'p', 'alta'], transfer: [['¬p→p'], 'p', 'alta'] },
  // Transferencia rehecha: `(p∧q)→r, p ⊢ q→r` es indemostrable para el buscador
  // de hoy, y no por presupuesto: no encadena `→E` sintetizando un antecedente
  // compuesto. Queda registrado como hueco del buscador, no como plantilla mala.
  KC18: { base: [['p→q', 'q→r', 'p'], 'r∧q', 'media'], transfer: [['(p→q)∧p'], 'q∨r', 'alta'] },
};

/**
 * Las seis variantes operativas por KC (piso `COV-KC-ACTIVITIES`), cada una con
 * su terna de átomos. Los renombrados entre reservas **de enseñanza** están
 * permitidos: §7.7 prohíbe la colisión solo cuando una de las dos reservas es de
 * medición, y practicar guiado y después independiente sobre la misma estructura
 * es *scaffolding* y *fading*, no contaminación.
 */
const VARIANTES = [
  { sufijo: 'diag', reserva: 'diagnostic', forma: 'base', atomos: ['A', 'B', 'C'] },
  { sufijo: 'guia', reserva: 'guided_practice', forma: 'base', atomos: ['D', 'E', 'F'] },
  { sufijo: 'indep', reserva: 'independent_practice', forma: 'base', atomos: ['G', 'H', 'J'] },
  { sufijo: 'recup', reserva: 'recovery', forma: 'base', atomos: ['K', 'L', 'M'] },
  { sufijo: 'transf', reserva: 'TRANSFER_MASTERY', forma: 'transfer', atomos: ['N', 'O', 'S'] },
  {
    sufijo: 'repos',
    reserva: 'replacement',
    repone: 'independent_practice',
    forma: 'base',
    atomos: ['T', 'U', 'V'],
  },
];

/** Carpeta de `items/` por reserva. */
const CARPETA = {
  diagnostic: 'diagnostic',
  guided_practice: 'guided-practice',
  independent_practice: 'independent-practice',
  recovery: 'recovery',
  TRANSFER_MASTERY: 'transfer',
  replacement: 'replacement',
  probes_baseline: 'probes-baseline',
  probes_intervention: 'probes-intervention',
  retention: 'retention',
  TRANSFER_MEASUREMENT: 'transfer',
};

/**
 * Envolturas de las sondas: el **núcleo del KC embebido en cuatro superficies
 * distintas**. No son el reactivo de enseñanza con otros nombres —renombrar
 * átomos no crea forma nueva (§7.8)— sino el mismo KC alcanzado por una ruta de
 * prueba distinta, que es lo que §5.11 pide para medir sin reutilizar.
 *
 * Hay exactamente cuatro porque hay cuatro reservas de medición y
 * `collisionProhibited()` **prohíbe la colisión entre dos reservas de medición
 * distintas**: dos sondas de reservas distintas no pueden ser isomorfas. Dentro
 * de una misma reserva sí pueden serlo —son una familia, formas paralelas del
 * mismo problema, que es justo lo que una serie SCED necesita para medir varias
 * veces sin gastar material nuevo cada vez—.
 */
const ENVOLTURAS = {
  // Añade una eliminación por delante: la premisa llega dentro de una conjunción.
  conj_premisa: (premises, goal, w) => [[`(${premises[0]})∧${w}`, ...premises.slice(1)], goal],
  // Añade una subprueba: la meta pasa a ser condicional.
  cond_meta: (premises, goal, w) => [premises, `${w}→(${goal})`],
  // Añade una introducción de disyunción sobre la meta.
  disy_meta: (premises, goal, w) => [premises, `(${goal})∨${w}`],
  // Añade una introducción de conjunción: hay que conservar además una premisa.
  conj_meta: (premises, goal) => [premises, `(${goal})∧(${premises[0]})`],
};

/**
 * Reserva de medición ← envoltura, y cuántas variantes de átomos por reserva.
 * Las primarias (`probes_baseline` y `probes_intervention`) llevan seis cada
 * una porque el calendario nominal pide 57 por conjunto y con reserva 69: con
 * 18 KC salen 216 primarias, por encima de las 207 de los tres conjuntos.
 */
const SONDAS = [
  { reserva: 'probes_baseline', envoltura: 'conj_premisa', variantes: 14 },
  { reserva: 'probes_intervention', envoltura: 'cond_meta', variantes: 14 },
  { reserva: 'retention', envoltura: 'disy_meta', variantes: 2 },
  { reserva: 'TRANSFER_MEASUREMENT', envoltura: 'conj_meta', variantes: 2 },
];

/** Ternas de átomos para las variantes de sonda, más la letra de la envoltura. */
const ATOMOS_SONDA = [
  [['A', 'B', 'C'], 'W'],
  [['D', 'E', 'F'], 'Y'],
  [['G', 'H', 'J'], 'Z'],
  [['K', 'L', 'M'], 'W'],
  [['N', 'O', 'S'], 'Y'],
  [['T', 'U', 'V'], 'Z'],
  [['P', 'Q', 'R'], 'W'],
  [['B', 'C', 'D'], 'Y'],
  [['E', 'F', 'G'], 'Z'],
  [['H', 'J', 'K'], 'W'],
  [['L', 'M', 'N'], 'Y'],
  [['O', 'P', 'Q'], 'Z'],
  [['R', 'S', 'T'], 'W'],
  [['U', 'V', 'A'], 'Y'],
];

/**
 * Ocho formas paralelas por reserva primaria, no una sola. Dentro de **una
 * misma** reserva la colisión no está prohibida (§7.7: solo lo está entre
 * reservas distintas cuando una es de medición), y una serie SCED mide el mismo
 * KC muchas veces: formas paralelas del mismo problema es exactamente lo que
 * hace falta para no reutilizar material entre oportunidades. Lo que **no** se
 * repite son las ternas de átomos: dos sondas con los mismos átomos y la misma
 * estructura serían el mismo reactivo con otro id, y eso el conteo por id no lo
 * distinguiría.
 */

function sustituir(formula, [p, q, r]) {
  return formula.split('p').join(p).split('q').join(q).split('r').join(r);
}

/* ── Rol D: pistas derivadas del reactivo ───────────────────────────────────
 *
 * La primera corrida daba a los 557 reactivos **las mismas tres pistas**. No
 * filtraban solución —por eso pasaban la comprobación de fuga— pero tampoco
 * decían nada del reactivo que el alumno tenía delante, y §8.6 pide para el
 * nivel 3 «indicar el siguiente tipo de operación», que es una afirmación
 * *sobre este* reactivo. Lo registró W4 como observación sin código: el libro
 * cerrado tiene código para la pista que resuelve de más (`hint_practically_
 * solves`) y ninguno para la que ayuda de menos.
 *
 * Las pistas se derivan ahora del **enunciado**, no del certificado: Rol D no
 * ve la solución, y con el enunciado basta para las tres primeras. Nombran
 * conectivos y reglas, **nunca fórmulas**, y eso no es estilo: la comprobación
 * de fuga busca en el texto, literalmente, toda fórmula del certificado ausente
 * del enunciado. El único átomo que una derivación introduce sin estar en el
 * enunciado es `⊥` —todos los demás vienen de las premisas o de la meta—, así
 * que escribirlo una sola vez tumbaría la pista de cualquier reactivo probado
 * por reducción. Por eso aquí se dice «la contradicción».
 */

/**
 * Nombre del conectivo y reglas que lo introducen y lo eliminan.
 *
 * `de` lleva la contracción hecha (`del condicional`, no `de el condicional`):
 * componer la preposición por concatenación produce texto que un alumno lee
 * como descuido, y una ayuda que se lee mal ayuda menos.
 */
const FORMAS = {
  and: { nombre: 'una conjunción', el: 'la conjunción', de: 'de la conjunción', simbolo: '∧', intro: '∧I', elim: '∧E' },
  or: { nombre: 'una disyunción', el: 'la disyunción', de: 'de la disyunción', simbolo: '∨', intro: '∨I', elim: '∨E' },
  implies: { nombre: 'un condicional', el: 'el condicional', de: 'del condicional', simbolo: '→', intro: '→I', elim: '→E' },
  iff: { nombre: 'un bicondicional', el: 'el bicondicional', de: 'del bicondicional', simbolo: '↔', intro: '↔I', elim: '↔E' },
  // Sin `elim`: la regla que abre una negación depende de si es simple o doble
  // (`¬E` frente a `DNE`), y la responde `premiseEntryRule()`. Tabular una sola
  // aquí es exactamente el defecto de D-65.
  not: { nombre: 'una negación', el: 'la negación', de: 'de la negación', simbolo: '¬', intro: '¬I', elim: null },
  // `⊥` **no es un conectivo**: es el átomo distinguido del cálculo. Por eso no
  // tiene símbolo que citar entre paréntesis ni entra en la lista de conectivos
  // a repasar, y por eso el nivel 2 lo trata en una rama propia en vez de decir
  // «el conectivo principal de la meta es la contradicción», que sería falso.
  falsum: { nombre: 'la contradicción', el: 'la contradicción', de: 'de la contradicción', simbolo: null, intro: '¬E', elim: 'X' },
  atom: { nombre: 'una letra proposicional', el: 'la letra proposicional', de: null, simbolo: null, intro: null, elim: null },
};

function analizar(texto) {
  const resultado = tryParse(texto);
  if (!resultado.ok) {
    throw new Error(`Rol D no puede describir «${texto}»: ${resultado.error.code}`);
  }
  return resultado.formula;
}

/** Conectivos que aparecen en la fórmula. `⊥` no entra: es un átomo, no un conectivo. */
function conectivosDe(formula, acumulado = new Set()) {
  if (formula.kind === 'not') {
    acumulado.add('not');
    conectivosDe(formula.sub, acumulado);
  } else if (['and', 'or', 'implies', 'iff'].includes(formula.kind)) {
    acumulado.add(formula.kind);
    conectivosDe(formula.left, acumulado);
    conectivosDe(formula.right, acumulado);
  }
  return acumulado;
}

const enumerar = (xs) =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;

/** «la conjunción (∧)», con el símbolo entre paréntesis salvo cuando no lo hay. */
const conSimbolo = (clave, caso = 'el') =>
  FORMAS[clave].simbolo === null
    ? FORMAS[clave][caso]
    : `${FORMAS[clave][caso]} (${FORMAS[clave].simbolo})`;

/** Nivel 1 (§8.6): recordar objetivo o definición. **No** selecciona regla ni paso. */
function textoNivel1(premises, goal) {
  const meta = FORMAS[analizar(goal).kind];
  const conectivos = new Set();
  for (const p of premises) conectivosDe(analizar(p), conectivos);
  conectivosDe(analizar(goal), conectivos);
  const lista = [...conectivos];
  const repaso =
    lista.length === 0
      ? 'Repasa en el texto la notación Fitch y qué se puede citar en cada línea'
      : `Repasa en el texto la definición ${enumerar(lista.map((k) => conSimbolo(k, 'de')))}`;
  return (
    `Vuelve a leer el reactivo antes de escribir nada: partes de ` +
    `${premises.length} premisa${premises.length === 1 ? '' : 's'} y tienes que llegar a una meta ` +
    `que es ${meta.nombre}. ${repaso}.`
  );
}

/** Nivel 2 (§8.6): señalar región o regla relevante. */
function textoNivel2(premises, goal) {
  const meta = analizar(goal);
  let parteMeta;
  if (meta.kind === 'atom') {
    parteMeta =
      'La meta es una letra proposicional y ninguna regla la introduce: mira en qué premisas ' +
      'aparece y con qué conectivo está unida, porque de ahí tendrá que salir';
  } else if (meta.kind === 'falsum') {
    parteMeta = `La meta es la contradicción, y la regla que la produce es ${FORMAS.falsum.intro}`;
  } else {
    parteMeta =
      `El conectivo principal de la meta es ${conSimbolo(meta.kind)}, y la regla que lo ` +
      `introduce es ${FORMAS[meta.kind].intro}`;
  }
  // La regla de entrada se pregunta por la **forma** de cada premisa, no por su
  // conectivo principal: `¬A` se ataca con `¬E` y `¬¬A` con `DNE`, y tabular la
  // negación con una sola regla mandaba al alumno a `¬E` desde `¬¬A`, donde no
  // aplica (D-65). Vive en `authoring-core` para poder probarse.
  const entradas = [];
  for (const p of premises) {
    const formula = analizar(p);
    const regla = premiseEntryRule(formula);
    if (regla === null) continue;
    if (!entradas.some((e) => e.kind === formula.kind && e.rule === regla)) {
      entradas.push({ kind: formula.kind, rule: regla });
    }
  }
  let partePremisas;
  if (entradas.length === 0) {
    partePremisas = 'Ninguna premisa tiene conectivo principal, así que no hay nada que eliminar en ellas';
  } else if (entradas.length === 1) {
    partePremisas =
      `En las premisas el conectivo principal es ${conSimbolo(entradas[0].kind)}, y la regla que ` +
      `lo elimina es ${entradas[0].rule}`;
  } else {
    const conectivos = [...new Set(entradas.map((e) => e.kind))];
    partePremisas =
      `En las premisas los conectivos principales son ${enumerar(conectivos.map((k) => conSimbolo(k)))}, ` +
      `y las reglas que los eliminan son ${enumerar(entradas.map((e) => e.rule))}`;
  }
  return `${parteMeta}. ${partePremisas}. Empieza por esas entradas del texto.`;
}

/**
 * Nivel 3 (§8.6): indicar el siguiente tipo de operación **sin resolverla**.
 *
 * Dice con qué se justifica la última línea y qué exige tener antes. No nombra
 * ninguna fórmula intermedia ni ninguna cita de línea, que es lo que separa
 * «indicar el tipo de operación» de «resolverla».
 */
const CIERRE = {
  and:
    'Para construir la meta directamente hace falta ∧I, que pide tener por separado cada uno de sus ' +
    'dos lados: comprueba si puedes conseguir los dos.',
  or:
    'Para construir la meta directamente hace falta ∨I, que pide solo uno de sus dos lados: decide ' +
    'cuál de los dos puedes alcanzar.',
  implies:
    'Para construir la meta directamente hace falta →I, que abre una subprueba: supón el ' +
    'antecedente y trabaja dentro hasta obtener el consecuente.',
  iff:
    'Para construir la meta directamente hace falta ↔I, que abre dos subpruebas, una por cada ' +
    'dirección.',
  not:
    'Para construir la meta directamente hace falta ¬I, que abre una subprueba: supón lo que la ' +
    'meta niega y busca dentro una contradicción.',
  falsum:
    'La meta es la contradicción y se obtiene con ¬E, que pide una fórmula y su negación ' +
    'disponibles en el mismo ámbito.',
  atom:
    'La meta no tiene conectivo principal, así que ninguna regla de introducción la construye: ' +
    'tendrá que salir de eliminar el conectivo principal de alguna premisa, o de una prueba ' +
    'indirecta (IP), que abre una subprueba suponiendo la negación de la meta.',
};

/**
 * Añadido para los reactivos cuyas premisas son insatisfacibles por diseño
 * (KC10, KC12 y las sondas construidas sobre sus núcleos).
 *
 * Sin él, el nivel 3 de un reactivo de explosión diría «para construir la meta
 * hace falta ∨I», que es cierto de la meta y **no es la vía**: la prueba pasa
 * por la contradicción y cierra con `X`. Es dato del enunciado, no del
 * certificado —la plantilla lo declara con `contradiccionExplicita`—, así que
 * Rol D lo puede decir sin haber visto la solución.
 */
const CIERRE_POR_EXPLOSION =
  ' Fíjate además en que las premisas no pueden ser verdaderas a la vez: de una contradicción se ' +
  'sigue cualquier fórmula con X.';

/**
 * Las tres pistas del reactivo, con sus hechos de dominio.
 *
 * **La propuesta de `masteryDisqualifying` cambió, y no por gusto.** La primera
 * corrida proponía `false` en los tres niveles; DEC-HINT-AUTHORITY-001 dice que
 * los niveles 2–5 **siempre** descalifican, así que el linter de paquete habría
 * rechazado 1114 registros por discrepancia en `authoritative_mastery_flags`
 * —una por cada pista de nivel 2 y 3— justo en el freeze. La propuesta no es
 * autoritativa, pero eso no la hace libre: es lo que el linter contrasta.
 */
function pistasDelReactivo(premises, goal, anclas, contradiccionExplicita) {
  const comunes = { anchors: anclas.slice(0, 2) };
  const meta = analizar(goal);
  const cierre =
    CIERRE[meta.kind] +
    (contradiccionExplicita && meta.kind !== 'falsum' ? CIERRE_POR_EXPLOSION : '');
  return [
    {
      level: 1,
      text: textoNivel1(premises, goal),
      ...comunes,
      proposedMasteryDisqualifying: false,
      nonRevelationExplanation:
        'Solo repite lo que el enunciado ya muestra —cuántas premisas hay y de qué forma es la ' +
        'meta— y remite a definiciones del texto: no nombra ninguna regla del paso ni ninguna ' +
        'fórmula que no esté a la vista.',
      masteryFacts: {
        level: 1,
        levelOneReminderOnly: true,
        selectsRuleOrNextStep: false,
        containsDecisiveContent: false,
      },
    },
    {
      level: 2,
      text: textoNivel2(premises, goal),
      ...comunes,
      proposedMasteryDisqualifying: true,
      nonRevelationExplanation:
        'Nombra la región relevante y el tipo de regla, sin decir sobre qué líneas se aplica ni ' +
        'qué fórmula intermedia produce.',
      masteryFacts: {
        level: 2,
        levelOneReminderOnly: false,
        selectsRuleOrNextStep: true,
        containsDecisiveContent: false,
      },
    },
    {
      level: 3,
      text: cierre,
      ...comunes,
      proposedMasteryDisqualifying: true,
      nonRevelationExplanation:
        'Indica con qué se justifica la última línea y qué exige tener antes, sin escribir ninguna ' +
        'fórmula intermedia ni ninguna cita de línea.',
      masteryFacts: {
        level: 3,
        levelOneReminderOnly: false,
        selectsRuleOrNextStep: true,
        containsDecisiveContent: false,
      },
    },
  ];
}

function leerJsonConCabecera(ruta) {
  return JSON.parse(readFileSync(ruta, 'utf8').replace(/^(#[^\n]*\n)+/, ''));
}

function escribirYaml(ruta, cabecera, datos) {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, `# ${cabecera}\n${JSON.stringify(datos, null, 2)}\n`);
  console.log(`  escrito: ${ruta.slice(CONTENIDO.length + 1)}`);
}

function traducir(crudo) {
  let texto = crudo;
  for (const [macro, simbolo] of MACROS) texto = texto.split(macro).join(simbolo);
  return texto
    .split('{[}')
    .join('[')
    .split('{]}')
    .join(']')
    .split(`${BARRA}small`)
    .join('')
    .split(`${BARRA},`)
    .join('')
    .replace(/[${}~]/g, '')
    .replace(/\s+/g, '');
}

/** Ejercicios del libro, para que el control de duplicación tenga contra qué comparar. */
function ejerciciosDelCorpus(tex, fragmentoPorLocation) {
  const reArgumento = new RegExp(
    `^(?:Show that${BARRA}s*)?(.*?)${BARRA}s*${BARRA}${BARRA}therefore${BARRA}s*(.*?)${BARRA}s*(?:is (?:valid|invalid)${BARRA}.?)?$`,
  );
  const reItem = new RegExp(`^${BARRA}${BARRA}item${BARRA}s*`);
  const salida = [];

  for (const cruda of tex.split('\n')) {
    if (!cruda.includes(THEREFORE)) continue;
    const linea = cruda.trim();
    if (linea.includes(BARRA + BARRA) || linea.includes('&')) continue;
    const partes = linea.replace(reItem, '').match(reArgumento);
    if (partes === null) continue;
    const [, izquierda, derecha] = partes;
    if (/[A-Za-z]{3,}/.test(traducir(izquierda)) || /[A-Za-z]{3,}/.test(traducir(derecha))) continue;
    const premises = izquierda
      .split(',')
      .map(traducir)
      .filter((p) => p !== '');
    const goal = traducir(derecha);
    if ([...premises, goal].some((f) => !tryParse(f).ok)) continue;
    salida.push({
      exerciseId: `corpus-ej-${String(salida.length + 1).padStart(2, '0')}`,
      fragmentId: fragmentoPorLocation.get(ARCHIVO_ND) ?? '',
      statement: { premises, goal },
    });
  }
  return salida;
}

async function main() {
  console.log(`W3 en vivo — ${AHORA}`);

  // ── 1/6 Corpus, orden congelado y su procedencia ──────────────────────────
  console.log('1/6 Cargando corpus y orden congelado por BENCH-04…');
  const manifiesto = leerJsonConCabecera(join(CONTENIDO, 'source/manifest.yaml'));
  const fragmentos = leerJsonConCabecera(
    join(CONTENIDO, 'source/fragments/forallx-yyc--tfl-deduccion-natural.json'),
  );
  const congelado = leerJsonConCabecera(join(CONTENIDO, 'audits/bench04-frozen-order.yaml'));
  const frozenOrder = congelado.frozenOrder;

  // El orden vale para **este** paquete o no vale: `resolveValidityVariant()`
  // solo comprueba que la procedencia no esté vacía, así que la correspondencia
  // con el contenido vigente se comprueba aquí.
  const versionEsperada = `${COMPONENTE}@${manifiesto.contentSha256[COMPONENTE].slice(0, 16)}`;
  if (frozenOrder.contentPackageVersion !== versionEsperada) {
    console.error(
      `W3_ORDEN_DE_OTRO_PAQUETE: BENCH-04 se congeló sobre ${frozenOrder.contentPackageVersion} y ` +
        `el paquete vigente es ${versionEsperada}. Volver a correr bench04-run.mjs, no reetiquetar.`,
    );
    process.exit(2);
  }
  console.log(`  orden ${frozenOrder.variantId} (${frozenOrder.reportRunId}), procedencia correcta`);

  // ── 2/6 Ejercicios del libro ──────────────────────────────────────────────
  console.log('2/6 Extrayendo los ejercicios del libro para el control de duplicación…');
  const respuesta = await fetch(`https://api.github.com/repos/rzach/forallx-yyc/tarball/${COMMIT}`, {
    headers: { 'user-agent': 'profesor-ia-w3' },
  });
  if (!respuesta.ok) throw new Error(`GitHub respondió ${respuesta.status}`);
  const tarball = Buffer.from(await respuesta.arrayBuffer());
  const tarballSha256 = createHash('sha256').update(tarball).digest('hex');
  if (tarballSha256 !== manifiesto.tarballSha256[COMPONENTE]) {
    console.error('W3_DERIVA: el snapshot ya no es el que W1 ingirió.');
    process.exit(2);
  }
  const tmp = join(tmpdir(), `w3-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  writeFileSync(join(tmp, 'snapshot.tar.gz'), tarball);
  execFileSync('tar', ['xzf', 'snapshot.tar.gz'], { cwd: tmp });
  const raiz = join(tmp, `rzach-forallx-yyc-${COMMIT.slice(0, 7)}`);
  if (!existsSync(raiz)) throw new Error(`No apareció el directorio esperado ${raiz}`);

  const fragmentoPorLocation = new Map();
  for (const f of fragmentos) fragmentoPorLocation.set(f.location.split('#')[0], f.fragmentId);
  const corpusExercises = ejerciciosDelCorpus(
    readFileSync(join(raiz, ARCHIVO_ND), 'utf8'),
    fragmentoPorLocation,
  );
  console.log(`  ${corpusExercises.length} ejercicios del libro`);

  // ── 3/6 Candidatos de Rol C ───────────────────────────────────────────────
  console.log('3/6 Generando candidatos desde las plantillas declaradas…');
  const anclasPorKc = new Map();
  for (const f of fragmentos) {
    for (const kc of f.relatedConcepts) {
      anclasPorKc.set(kc, [...(anclasPorKc.get(kc) ?? []), f.fragmentId]);
    }
  }

  const candidates = [];
  const hintSets = [];
  const critiques = [];

  for (const [kcId, plantilla] of Object.entries(PLANTILLAS)) {
    const anclas = anclasPorKc.get(kcId) ?? [];
    if (anclas.length === 0) {
      throw new Error(
        `${kcId} no tiene ningún fragmento del corpus al que anclar sus pistas. Rol D enumera ` +
          `anclajes entre su salida: sin corpus detrás, la ayuda no se puede auditar.`,
      );
    }

    const agregar = ({ candidateId, templateId, premises, goal, reserva, repone, objetivo }) => {
      candidates.push({
        candidateId,
        generatorTemplateId: templateId,
        statement: { premises, goal },
        promptText: `Deriva ${goal} a partir de ${premises.join(', ')} usando solo las reglas del cálculo autorizado.`,
        targetKcs: [kcId],
        bankFunction: reserva,
        ...(repone === undefined ? {} : { replacesReserve: repone }),
        targetComplexity: objetivo,
        prohibitions: [
          'no se admite ninguna regla fuera de la whitelist del cálculo autorizado',
          'no se admite precedencia entre conectivos binarios: los paréntesis son obligatorios salvo los externos',
        ],
        contradictionIsExplicitGoal: plantilla.contradiccionExplicita === true,
      });

      // Rol D. Los tres primeros niveles de §8.6, que es el piso de §4.2, y
      // **derivados del enunciado de este reactivo**: ver `pistasDelReactivo`.
      hintSets.push({
        itemId: candidateId,
        hints: pistasDelReactivo(premises, goal, anclas, plantilla.contradiccionExplicita === true),
      });

      // Rol E. Mismo modelo que Rol C/D: la crítica se registra y su acuerdo
      // **no** puede usarse como evidencia para congelar la familia (§7.3).
      critiques.push({
        itemId: candidateId,
        criticModelFamily: FAMILIA_DEL_MODELO,
        generatorModelFamily: FAMILIA_DEL_MODELO,
        justification: [
          {
            criterion: 'correspondencia_con_objetivo',
            observation: `El enunciado exige aplicar la regla asociada a ${kcId} para llegar a la meta.`,
            evidence: `Premisas ${premises.join(', ')} y meta ${goal}; el operador principal de la meta corresponde al KC objetivo.`,
          },
          {
            criterion: 'fuga',
            observation: 'El enunciado no contiene la derivación ni ninguna línea intermedia.',
            evidence: 'El candidato solo declara premisas, meta y prohibiciones; no hay campo de solución.',
          },
          {
            criterion: 'consistencia_de_notacion',
            observation: 'La notación es la del cálculo congelado, con paréntesis explícitos.',
            evidence: 'Todas las fórmulas del enunciado son analizables por logic-core sin alias ni precedencia.',
          },
        ],
        verdict: 'approve',
      });
    };

    for (const variante of VARIANTES) {
      const [premisasPlantilla, metaPlantilla, objetivo] = plantilla[variante.forma];
      agregar({
        candidateId: `${kcId.toLowerCase()}-${variante.sufijo}`,
        templateId: `plt-${kcId.toLowerCase()}-${variante.forma}`,
        premises: premisasPlantilla.map((p) => sustituir(p, variante.atomos)),
        goal: sustituir(metaPlantilla, variante.atomos),
        reserva: variante.reserva,
        repone: variante.repone,
        objetivo,
      });
    }

    // Sondas: el núcleo del KC en cuatro superficies distintas, una por reserva
    // de medición. La complejidad objetivo **sube un escalón** respecto de la
    // forma base porque cada envoltura añade pasos: declararla igual sería
    // declarar como equivalente algo que se sabe más largo.
    const [premisasNucleo, metaNucleo, objetivoNucleo] = plantilla.base;
    const SUBE = { baja: 'media', media: 'alta', alta: 'alta' };
    for (const sonda of SONDAS) {
      if (sonda.variantes > ATOMOS_SONDA.length) {
        throw new Error(
          `${sonda.reserva} pide ${sonda.variantes} variantes y solo hay ${ATOMOS_SONDA.length} ` +
            `ternas de átomos: la repetición produciría el mismo reactivo con otro id, y el ` +
            `conteo por id no lo distinguiría.`,
        );
      }
      for (let i = 0; i < sonda.variantes; i += 1) {
        const [atomos, w] = ATOMOS_SONDA[i];
        const nucleoPremisas = premisasNucleo.map((x) => sustituir(x, atomos));
        const nucleoMeta = sustituir(metaNucleo, atomos);
        const [premises, goal] = ENVOLTURAS[sonda.envoltura](nucleoPremisas, nucleoMeta, w);
        agregar({
          candidateId: `${kcId.toLowerCase()}-${sonda.reserva.toLowerCase()}-${i + 1}`,
          templateId: `plt-${kcId.toLowerCase()}-sonda-${sonda.envoltura}`,
          premises,
          goal,
          reserva: sonda.reserva,
          objetivo: SUBE[objetivoNucleo],
        });
      }
    }
  }
  console.log(`  ${candidates.length} candidatos, ${hintSets.length} conjuntos de pistas, ${critiques.length} críticas`);

  const independencia = criticIndependence(critiques[0]);
  console.log(`  independencia del crítico: ${independencia.independent} — ${independencia.reason}`);

  // ── 4/6 Pipeline ──────────────────────────────────────────────────────────
  console.log('4/6 Ejecutando el pipeline de W3…');
  const plantillaL0 = BENCH04_L0_CASES[0];
  const resultado = runW3Generation({
    candidates,
    frozenOrder,
    budget: plantillaL0.budget,
    mode: plantillaL0.mode,
    corpusExercises,
    hintSets,
    critiques,
  });

  const aceptados = resultado.items.filter((i) => i.accepted);
  const rechazados = resultado.items.filter((i) => !i.accepted);
  console.log(`  ${aceptados.length} aceptados, ${rechazados.length} rechazados`);

  const porCodigo = new Map();
  for (const item of rechazados) {
    for (const r of item.rejections) {
      porCodigo.set(r.code, [...(porCodigo.get(r.code) ?? []), item.candidateId]);
    }
  }
  for (const [codigo, ids] of [...porCodigo.entries()].sort()) {
    console.log(`    · ${codigo}: ${ids.length} — ${ids.slice(0, 6).join(', ')}${ids.length > 6 ? '…' : ''}`);
  }

  // ── 5/6 Cobertura ─────────────────────────────────────────────────────────
  console.log('5/6 Midiendo cobertura contra los pisos de P-III §4.2…');
  const kcsInPilot = Object.keys(PLANTILLAS);
  const coverageItems = aceptados.map((item) => ({
    itemId: item.candidateId,
    reserve: item.bankFunction,
    ...(candidates.find((c) => c.candidateId === item.candidateId).replacesReserve === undefined
      ? {}
      : { replacesReserve: candidates.find((c) => c.candidateId === item.candidateId).replacesReserve }),
    targetKcs: item.targetKcs,
    hintLevels: item.hintsProvided ? [1, 2, 3] : [],
  }));
  const corpusTraceByKc = Object.fromEntries(
    kcsInPilot.map((kcId) => [kcId, anclasPorKc.get(kcId) ?? []]),
  );
  const huecos = perKcCoverageGaps({ kcsInPilot, items: coverageItems, corpusTraceByKc });
  const porParametro = new Map();
  for (const h of huecos) porParametro.set(h.parameterId, (porParametro.get(h.parameterId) ?? 0) + 1);
  if (huecos.length === 0) {
    console.log('  sin huecos: los cinco pisos por KC se cumplen en los dieciocho KC');
  } else {
    for (const [parametro, cuenta] of [...porParametro.entries()].sort()) {
      console.log(`    · ${parametro}: ${cuenta} KC por debajo del piso`);
    }
  }

  // ── 6/6 Materialización ───────────────────────────────────────────────────
  console.log('6/6 Escribiendo items/ y solutions-private/…');
  const cabecera = (qué) =>
    `${qué} (T-H5-05, W3). Corrida del ${AHORA} con el orden ${frozenOrder.variantId} ` +
    `(${frozenOrder.reportRunId}). Plantillas, pistas y críticas del modelo asistente ` +
    `(salvedad D-41/D-48/D-52/D-53): las audita W4. El crítico **no es independiente**.`;

  // Se agrupa por **carpeta**, no por reserva, y esa es la corrección de un
  // defecto silencioso: `items/` tiene nueve carpetas fijadas por §4.3 del plan
  // y hay diez reservas, porque `TRANSFER_MASTERY` y `TRANSFER_MEASUREMENT`
  // comparten `transfer/`. Escribiendo por reserva, la segunda **sobrescribía**
  // el archivo de la primera y los 17 reactivos de `TRANSFER_MASTERY` no
  // llegaban al banco publicado: estaban en el informe y en los certificados,
  // pero no en `items/`. No se abre una décima carpeta —la lista es del plan—:
  // el archivo declara las reservas que contiene y cada reactivo la suya en
  // `bankFunction`, que es lo que `collisionProhibited()` mira.
  const porCarpeta = new Map();
  for (const item of aceptados) {
    const carpeta = CARPETA[item.bankFunction];
    porCarpeta.set(carpeta, [...(porCarpeta.get(carpeta) ?? []), item]);
  }
  for (const [carpeta, lista] of porCarpeta) {
    const reservas = [...new Set(lista.map((item) => item.bankFunction))].sort();
    escribirYaml(
      join(CONTENIDO, `items/${carpeta}/items.yaml`),
      cabecera(`Reactivos aceptados de ${reservas.join(' y ')}`),
      {
        courseId: 'unidad-deduccion-natural',
        reserves: reservas,
        authorizedCalculusVersion: resultado.authorizedCalculusVersion,
        variantId: resultado.variantId,
        items: lista.map((item) => ({
          ...item,
          statement: candidates.find((c) => c.candidateId === item.candidateId).statement,
          promptText: candidates.find((c) => c.candidateId === item.candidateId).promptText,
          hints: hintSets.find((h) => h.itemId === item.candidateId).hints,
        })),
      },
    );
  }

  escribirYaml(
    join(CONTENIDO, 'audits/w3-run.yaml'),
    cabecera('Informe de la corrida W3'),
    {
      ranAt: AHORA,
      frozenOrder,
      // Con qué calibración se midió la complejidad de este banco. Sin este
      // campo, un banco medido con una calibración retirada es indistinguible
      // de uno actual: los índices están en la escala vieja y nada lo dice
      // (D-66). Es el mismo agujero que se cerró en W4 exigiendo que la muestra
      // fuera de esta corrida de W3.
      complexityCalibration: {
        parameterId: CAL09_FROZEN_MANIFEST.calibrationId,
        version: CAL09_FROZEN_MANIFEST.version,
        sampleHash: CAL09_FROZEN_MANIFEST.sampleHash,
        frozenAt: CAL09_FROZEN_MANIFEST.frozenAt,
      },
      candidates: candidates.length,
      accepted: aceptados.length,
      rejected: rechazados.length,
      rejectionsByCode: Object.fromEntries([...porCodigo.entries()].map(([c, ids]) => [c, ids])),
      criticIndependence: independencia,
      coverageGaps: huecos,
      coverageFloors: Object.fromEntries(
        Object.entries(COVERAGE_PARAMETERS).map(([k, v]) => [k, { id: v.parameterId, value: v.value }]),
      ),
      items: resultado.items,
    },
  );

  escribirYaml(
    join(CONTENIDO, 'solutions-private/w3-solutions.yaml'),
    cabecera('Certificados de los reactivos aceptados — NO es base expresiva (I-2/I-4)'),
    {
      courseId: 'unidad-deduccion-natural',
      note: 'Los certificados viven aquí y no en items/: W3ItemRecord no tiene campo para la solución, así que serializar el registro público no puede sacarla.',
      privateSolutions: resultado.privateSolutions,
    },
  );

  console.log('W3 completada.');
}

await main();
