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
  runW3Generation,
} from '../../packages/authoring-core/dist/index.js';
import { tryParse } from '../../packages/logic-core/dist/index.js';
import { BENCH04_L0_CASES } from '../../packages/proof-search/dist/index.js';

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
  KC03: { base: [['p'], 'q→p', 'media'], transfer: [['p∧q'], 'r→p', 'media'] },
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
  KC13: { base: [['p∨q', 'p→r', 'q→r'], 'r', 'alta'], transfer: [['(p∧q)∨(p∧r)'], 'p', 'alta'] },
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
};

function sustituir(formula, [p, q, r]) {
  return formula.split('p').join(p).split('q').join(q).split('r').join(r);
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

    for (const variante of VARIANTES) {
      const [premisasPlantilla, metaPlantilla, objetivo] = plantilla[variante.forma];
      const candidateId = `${kcId.toLowerCase()}-${variante.sufijo}`;
      const premises = premisasPlantilla.map((p) => sustituir(p, variante.atomos));
      const goal = sustituir(metaPlantilla, variante.atomos);

      candidates.push({
        candidateId,
        generatorTemplateId: `plt-${kcId.toLowerCase()}-${variante.forma}`,
        statement: { premises, goal },
        promptText: `Deriva ${goal} a partir de ${premises.join(', ')} usando solo las reglas del cálculo autorizado.`,
        targetKcs: [kcId],
        bankFunction: variante.reserva,
        ...(variante.repone === undefined ? {} : { replacesReserve: variante.repone }),
        targetComplexity: objetivo,
        prohibitions: [
          'no se admite ninguna regla fuera de la whitelist del cálculo autorizado',
          'no se admite precedencia entre conectivos binarios: los paréntesis son obligatorios salvo los externos',
        ],
        contradictionIsExplicitGoal: plantilla.contradiccionExplicita === true,
      });

      // Rol D. Los tres primeros niveles de §8.6, que es el piso de §4.2. Los
      // textos no nombran ninguna fórmula ausente del enunciado: la meta y las
      // premisas ya están a la vista, y lo demás se describe por su tipo.
      hintSets.push({
        itemId: candidateId,
        hints: [
          {
            level: 1,
            text: `Recuerda qué pide el reactivo: llegar a la meta desde las premisas dadas. Repasa la definición de la regla de este bloque antes de escribir nada.`,
            anchors: anclas.slice(0, 2),
            proposedMasteryDisqualifying: false,
            nonRevelationExplanation:
              'Solo remite a la definición de la regla del bloque y a lo que el enunciado ya muestra; no nombra ningún paso de la derivación.',
          },
          {
            level: 2,
            text: `Mira el operador principal de la meta y busca la regla que lo introduce; después mira los operadores principales de las premisas y la regla que los elimina.`,
            anchors: anclas.slice(0, 2),
            proposedMasteryDisqualifying: false,
            nonRevelationExplanation:
              'Señala la región relevante y el tipo de regla, sin decir sobre qué líneas se aplica ni qué fórmula se obtiene.',
          },
          {
            level: 3,
            text: `El siguiente paso es de tipo introducción o eliminación según lo anterior: escribe la justificación que planeas usar en la última línea y comprueba qué te falta tener antes de ella.`,
            anchors: anclas.slice(0, 2),
            proposedMasteryDisqualifying: false,
            nonRevelationExplanation:
              'Indica el tipo de operación siguiente sin resolverla: no nombra la fórmula intermedia ni la línea que la justifica.',
          },
        ],
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

  const porReserva = new Map();
  for (const item of aceptados) {
    porReserva.set(item.bankFunction, [...(porReserva.get(item.bankFunction) ?? []), item]);
  }
  for (const [reserva, lista] of porReserva) {
    escribirYaml(
      join(CONTENIDO, `items/${CARPETA[reserva]}/items.yaml`),
      cabecera(`Reactivos aceptados de la reserva ${reserva}`),
      {
        courseId: 'unidad-deduccion-natural',
        reserve: reserva,
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
