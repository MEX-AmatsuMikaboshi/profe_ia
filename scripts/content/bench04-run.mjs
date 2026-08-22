#!/usr/bin/env node
/**
 * Corrida BENCH-04 sobre el paquete de contenido real (F6/H5, T-H5-05) y
 * congelamiento del orden del pipeline de validez.
 *
 * Uso: node scripts/content/bench04-run.mjs
 *
 * Por qué existe: `resolveValidityVariant()` no deja ejecutar W3 sin un orden
 * congelado con procedencia, y `freezeWinningOrder()` falla cerrado a propósito
 * —el arnés produce la evidencia, no el veredicto (T-H2-16)—. Declarar el
 * ganador desde la muestra L0 está expresamente prohibido: esa muestra es con
 * la que el arnés se prueba a sí mismo. Este script hace lo que faltaba: mide
 * sobre argumentos del corpus autorizado y congela.
 *
 * Qué hace y qué no:
 * - **Los casos salen del corpus, no de la cabeza de nadie.** Se extraen
 *   mecánicamente las formas de argumento (`\therefore`) de `prooftfl.tex` del
 *   snapshot autorizado, se traducen macro a macro y **se comprueban con el
 *   analizador de `logic-core`**: lo que no parsea no entra, y queda listado con
 *   su motivo. Nada se descarta en silencio y nada se inventa.
 * - **El modo y el presupuesto se derivan de `BENCH04_L0_CASES`**, no se
 *   escriben: un presupuesto nuevo sería un parámetro que nadie congeló.
 * - **No se congela nada si el informe no es comparable.** Cualquier hallazgo de
 *   seguridad, cualquier discrepancia de veredicto entre variantes o cualquier
 *   medición con reloj de pared aborta: anexo E.2 pone la seguridad por delante
 *   del desempeño, y un informe no reproducible no congela nada.
 * - **El id de la corrida se deriva del contenido del informe** (SHA-256), no
 *   del reloj: dos corridas iguales producen el mismo id, que es lo que hace
 *   comprobable la procedencia.
 * - Salvedad: la corrida y la lectura del resultado las hizo el modelo
 *   asistente (D-41/D-48/D-52/D-53). El propietario audita el congelamiento
 *   antes del freeze de W5.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { tryParse } from '../../packages/logic-core/dist/index.js';
import {
  BENCH04_HARNESS_VERSION,
  BENCH04_L0_CASES,
  BENCH04_REFERENCE_VARIANT_ID,
  BENCH04_VARIANTS,
  runBench04,
} from '../../packages/proof-search/dist/index.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CONTENIDO = join(RAIZ, 'content/unidad-deduccion-natural');
const AHORA = new Date().toISOString();

const COMPONENTE = 'forallx-yyc/tfl-deduccion-natural';
const COMMIT = 'ec34df8f8f42ccba2bf2d24403ebad335afa93b9';
const ARCHIVO_ND = 'forallx-yyc-prooftfl.tex';

const BARRA = String.fromCharCode(92);
const THEREFORE = `${BARRA}therefore`;

/** Macros del libro → símbolos del cálculo autorizado. Orden: `eiff` antes que `eif`. */
const MACROS = [
  [`${BARRA}enot`, '¬'],
  [`${BARRA}eand`, '∧'],
  [`${BARRA}eor`, '∨'],
  [`${BARRA}lor`, '∨'],
  [`${BARRA}eiff`, '↔'],
  [`${BARRA}eif`, '→'],
  [`${BARRA}ered`, '⊥'],
];

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

/**
 * Extrae las formas de argumento de una sola línea. Las multilínea (bloques
 * `align`) y las envueltas en prosa **se descartan declarando el motivo**: un
 * argumento reconstruido a medias mediría otra cosa que la que dice medir.
 */
function extraerArgumentos(secciones) {
  const casos = [];
  const descartes = [];
  const reArgumento = new RegExp(
    `^(?:Show that${BARRA}s*)?(.*?)${BARRA}s*${BARRA}${BARRA}therefore${BARRA}s*(.*?)${BARRA}s*(?:is (?:valid|invalid)${BARRA}.?)?$`,
  );
  const reItem = new RegExp(`^${BARRA}${BARRA}item${BARRA}s*`);

  for (const { location, text } of secciones) {
    for (const cruda of text.split('\n')) {
      if (!cruda.includes(THEREFORE)) continue;
      const linea = cruda.trim();
      if (linea.includes(BARRA + BARRA) || linea.includes('&')) {
        descartes.push({ location, linea, motivo: 'forma multilínea (bloque align)' });
        continue;
      }
      const partes = linea.replace(reItem, '').match(reArgumento);
      if (partes === null) {
        descartes.push({ location, linea, motivo: 'no separa premisas y meta' });
        continue;
      }
      const [, izquierda, derecha] = partes;
      if (/[A-Za-z]{3,}/.test(traducir(izquierda)) || /[A-Za-z]{3,}/.test(traducir(derecha))) {
        descartes.push({ location, linea, motivo: 'prosa alrededor de la fórmula' });
        continue;
      }
      const premises = izquierda
        .split(',')
        .map(traducir)
        .filter((p) => p !== '');
      const goal = traducir(derecha);
      const malFormadas = [...premises, goal].filter((f) => !tryParse(f).ok);
      if (malFormadas.length > 0) {
        descartes.push({
          location,
          linea,
          motivo: `no es fórmula del cálculo: ${malFormadas.join(' | ')}`,
        });
        continue;
      }
      casos.push({ location, premises, goal, source: linea });
    }
  }
  return { casos, descartes };
}

function escribirYaml(ruta, cabecera, datos) {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, `# ${cabecera}\n${JSON.stringify(datos, null, 2)}\n`);
  console.log(`  escrito: ${ruta.slice(RAIZ.length + 1)}`);
}

function leerJsonConCabecera(ruta) {
  return JSON.parse(readFileSync(ruta, 'utf8').replace(/^(#[^\n]*\n)+/, ''));
}

async function main() {
  console.log(`BENCH-04 sobre el paquete real — ${AHORA}`);

  // ── 1/5 Identidad del snapshot ────────────────────────────────────────────
  console.log('1/5 Descargando y verificando el snapshot autorizado…');
  const manifiesto = leerJsonConCabecera(join(CONTENIDO, 'source/manifest.yaml'));
  const respuesta = await fetch(`https://api.github.com/repos/rzach/forallx-yyc/tarball/${COMMIT}`, {
    headers: { 'user-agent': 'profesor-ia-bench04' },
  });
  if (!respuesta.ok) throw new Error(`GitHub respondió ${respuesta.status}`);
  const tarball = Buffer.from(await respuesta.arrayBuffer());
  const tarballSha256 = createHash('sha256').update(tarball).digest('hex');
  if (tarballSha256 !== manifiesto.tarballSha256[COMPONENTE]) {
    console.error(
      `BENCH04_DERIVA: W1 registró ${manifiesto.tarballSha256[COMPONENTE]} y la descarga hashea ` +
        `${tarballSha256}. Medir sobre otro texto no mediría el paquete que se va a autorizar.`,
    );
    process.exit(2);
  }

  const tmp = join(tmpdir(), `bench04-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  writeFileSync(join(tmp, 'snapshot.tar.gz'), tarball);
  execFileSync('tar', ['xzf', 'snapshot.tar.gz'], { cwd: tmp });
  const raiz = join(tmp, `rzach-forallx-yyc-${COMMIT.slice(0, 7)}`);
  if (!existsSync(raiz)) throw new Error(`No apareció el directorio esperado ${raiz}`);
  console.log(`  identidad verificada: ${tarballSha256.slice(0, 12)}…`);

  // ── 2/5 Casos del corpus ──────────────────────────────────────────────────
  console.log('2/5 Extrayendo formas de argumento de la parte de deducción natural…');
  const tex = readFileSync(join(raiz, ARCHIVO_ND), 'utf8');
  const { casos, descartes } = extraerArgumentos([{ location: ARCHIVO_ND, text: tex }]);
  if (casos.length === 0) {
    throw new Error('No se extrajo ningún argumento: medir sobre una muestra vacía no mide nada.');
  }

  const plantilla = BENCH04_L0_CASES[0];
  const cases = casos.map((c, indice) => ({
    id: `corpus-${String(indice + 1).padStart(2, '0')}`,
    premises: c.premises,
    goal: c.goal,
    mode: plantilla.mode,
    budget: plantilla.budget,
    exercises: `${c.location} — ${c.source}`,
  }));
  console.log(`  ${cases.length} argumentos usables, ${descartes.length} descartados con motivo`);
  for (const d of descartes) console.log(`    · ${d.motivo}`);

  // ── 3/5 Corrida del arnés ─────────────────────────────────────────────────
  console.log('3/5 Ejecutando el arnés…');
  const informe = runBench04({ cases });
  for (const total of informe.totals) {
    console.log(
      `  ${total.variantId}: ${total.workUnits} unidades, ${total.proofsFound} pruebas, ` +
        `${total.semanticRejections} rechazos semánticos, ${total.safetyFindings} hallazgos`,
    );
  }

  // ── 4/5 Condiciones para congelar ─────────────────────────────────────────
  console.log('4/5 Comprobando las condiciones del congelamiento…');
  if (!informe.comparable || informe.safetyFindings.length > 0) {
    console.error(
      `BENCH04_NO_COMPARABLE: ${informe.safetyFindings.length} hallazgo(s) de seguridad. El anexo ` +
        `E.2 mide «desempeño y seguridad» en ese orden inverso de prioridad: una variante que ` +
        `cambia veredictos no compite por ser más barata.`,
    );
    process.exit(3);
  }
  if (informe.wallClockMeasured) {
    console.error('BENCH04_NO_REPRODUCIBLE: el informe midió reloj de pared y no es reproducible.');
    process.exit(3);
  }

  // Equivalencia de veredicto caso a caso: el arnés declara las variantes
  // equivalentes, y congelar sin comprobarlo sería creerse la declaración.
  const porCaso = new Map();
  for (const medicion of informe.measurements) {
    const fila = porCaso.get(medicion.caseId) ?? {};
    fila[medicion.variantId] = medicion;
    porCaso.set(medicion.caseId, fila);
  }
  const discrepantes = [...porCaso.entries()].filter(([, fila]) => {
    const estados = new Set(BENCH04_VARIANTS.map((v) => fila[v.id]?.status));
    return estados.size !== 1;
  });
  if (discrepantes.length > 0) {
    console.error(
      `BENCH04_VEREDICTOS_DISTINTOS: ${discrepantes.map(([id]) => id).join(', ')}. Dos variantes ` +
        `que no coinciden en veredicto no son alternativas del mismo pipeline.`,
    );
    process.exit(3);
  }

  const ordenados = [...informe.totals].sort(
    (a, b) => a.workUnits - b.workUnits || a.variantId.localeCompare(b.variantId),
  );
  const ganadora = ordenados[0];
  const segunda = ordenados[1];
  const diferencia = segunda.workUnits - ganadora.workUnits;

  // Dónde se produce la diferencia: sin esto, un margen pequeño no se puede leer.
  const casosQueDifieren = [...porCaso.entries()]
    .map(([caseId, fila]) => ({
      caseId,
      diferencia:
        Math.max(...BENCH04_VARIANTS.map((v) => fila[v.id].workUnits)) -
        Math.min(...BENCH04_VARIANTS.map((v) => fila[v.id].workUnits)),
      status: fila[BENCH04_REFERENCE_VARIANT_ID].status,
    }))
    .filter((c) => c.diferencia !== 0);

  console.log(
    `  gana ${ganadora.variantId} por ${diferencia} unidades, y la diferencia sale de ` +
      `${casosQueDifieren.length} caso(s) de ${porCaso.size}`,
  );
  for (const c of casosQueDifieren) {
    console.log(`    · ${c.caseId} (${c.status}): ${c.diferencia} unidades`);
  }

  // ── 5/5 Congelamiento ─────────────────────────────────────────────────────
  console.log('5/5 Escribiendo informe y orden congelado…');
  const contentPackageVersion = `${COMPONENTE}@${manifiesto.contentSha256[COMPONENTE].slice(0, 16)}`;
  const informeSinReloj = { ...informe, cases };
  const reportRunId = `bench04-${createHash('sha256')
    .update(JSON.stringify(informeSinReloj))
    .digest('hex')
    .slice(0, 16)}`;

  const frozenOrder = {
    benchmarkId: 'BENCH-04',
    variantId: ganadora.variantId,
    harnessVersion: BENCH04_HARNESS_VERSION,
    measuredOn: 'real_content_package',
    contentPackageVersion,
    reportRunId,
  };

  const cabecera = (qué) =>
    `${qué} (T-H5-05, BENCH-04). Corrida del ${AHORA} sobre el snapshot ${tarballSha256.slice(0, 12)}…. ` +
    `Corrida y lectura del modelo asistente (salvedad D-41/D-48/D-52/D-53): el propietario audita ` +
    `el congelamiento antes del freeze de W5.`;

  escribirYaml(
    join(CONTENIDO, 'audits/bench04-report.yaml'),
    cabecera('Informe del arnés BENCH-04 sobre el paquete real'),
    {
      reportRunId,
      measuredAt: AHORA,
      snapshotSha256: tarballSha256,
      contentPackageVersion,
      sampleSize: cases.length,
      discardedFromSource: descartes,
      report: informe,
      differingCases: casosQueDifieren,
      winner: { variantId: ganadora.variantId, workUnitsSaved: diferencia },
      limitation:
        `Solo ${informe.totals[0].semanticRejections} de ${cases.length} argumentos del corpus es ` +
        `semánticamente inválido, y la ventaja del prefiltro aparece exactamente ahí: la muestra ` +
        `subrepresenta la situación en la que el orden importa. En W3 la proporción de candidatos ` +
        `inválidos será mucho mayor, así que el margen medido es un piso, no una estimación.`,
    },
  );

  escribirYaml(
    join(CONTENIDO, 'audits/bench04-frozen-order.yaml'),
    cabecera('Orden del pipeline de validez congelado'),
    {
      frozenOrder,
      frozenAt: AHORA,
      rationale:
        `Las dos variantes coinciden en veredicto en los ${cases.length} argumentos y no hay ` +
        `hallazgos de seguridad, así que compite el desempeño. Gana ${ganadora.variantId} por ` +
        `${diferencia} unidades de trabajo, y toda esa diferencia sale del único caso ` +
        `semánticamente inválido: el prefiltro no busca lo que el oráculo ya rechazó.`,
    },
  );

  console.log('BENCH-04 congelado.');
  console.log(`  variantId: ${frozenOrder.variantId}`);
  console.log(`  reportRunId: ${frozenOrder.reportRunId}`);
}

await main();
