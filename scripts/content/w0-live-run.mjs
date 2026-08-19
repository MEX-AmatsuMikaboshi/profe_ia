#!/usr/bin/env node
/**
 * Corrida W0 en vivo (F5/H4.5, D-47): descubre con los conectores reales,
 * alimenta el orquestador puro y escribe los artefactos de `research/`.
 *
 * Uso: node scripts/content/w0-live-run.mjs
 *
 * Qué hace y qué no:
 * - Descubre en las tres fuentes de la whitelist (índice estable; sin crawler).
 * - El snapshot se genera AQUÍ (W0); W1 comprobará identidad contra el hash.
 * - Las evaluaciones (observaciones, claims, licencias) se leen de
 *   `research/evaluations-2026-08-19.json`, con su procedencia declarada.
 * - Los artefactos `.yaml` se escriben como JSON (JSON es YAML 1.2 válido),
 *   con cabecera de comentario. No se inventa ningún dato.
 * - La corrida se detiene en `propuesta_corpus`: la autorización es del
 *   CORPUS_APPROVER, no del script.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  runW0,
  githubRepoSnapshot,
  stablePageSnapshot,
  openstaxCatalogSearch,
  candidateFromGithubSnapshot,
  candidateFromStablePage,
} from '../../packages/authoring-core/dist/index.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '../..');
const RESEARCH = join(RAIZ, 'content/unidad-deduccion-natural/research');
const AHORA = new Date().toISOString();

// GitHub exige User-Agent; el FetchLike de los conectores solo pide la URL.
const fetchImpl = (url) =>
  fetch(url, { headers: { 'user-agent': 'profesor-ia-w0-discovery', redirect: 'follow' } });

function escribirYaml(nombre, cabecera, datos) {
  const ruta = join(RESEARCH, nombre);
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, `# ${cabecera}\n${JSON.stringify(datos, null, 2)}\n`);
  console.log(`  escrito: research/${nombre}`);
}

async function main() {
  console.log(`W0 en vivo — ${AHORA}`);

  // ── Descubrimiento ────────────────────────────────────────────────────────
  console.log('1/4 Descubriendo en la whitelist…');
  const repo = await githubRepoSnapshot(fetchImpl, 'rzach', 'forallx-yyc');
  console.log(`  forallx-yyc @ ${repo.commitSha.slice(0, 7)} (${repo.commitDate}), ${repo.licenseSpdx}`);

  const ocw = await stablePageSnapshot(fetchImpl, 'https://ocw.mit.edu/courses/24-241-logic-i-fall-2009/');
  console.log(`  OCW 24.241 Fall 2009, snapshot ${ocw.bodySha256.slice(0, 12)}…`);

  const openstax = await openstaxCatalogSearch(fetchImpl, 'logic');
  console.log(`  OpenStax: ${openstax.totalCount} títulos revisados, ${openstax.matchingTitles.length} de lógica`);

  // Dos componentes del mismo repo: misma instantánea, URLs de componente
  // distintas (ancla sobre el árbol). El registro dice la verdad: un repo,
  // dos componentes evaluados por separado (T-H45-05: el bloqueo es por
  // componente).
  const candidatos = [
    {
      ...candidateFromGithubSnapshot(
        'open-logic-project',
        'Open Logic Project / University of Calgary (GitHub rzach/forallx-yyc)',
        repo,
        AHORA,
        'CC BY 4.0 — LICENSE.md del repo + detección SPDX de GitHub + frontmatter del libro',
      ),
      record: {
        ...candidateFromGithubSnapshot(
          'open-logic-project',
          'Open Logic Project / University of Calgary (GitHub rzach/forallx-yyc)',
          repo,
          AHORA,
          'CC BY 4.0 — LICENSE.md del repo + detección SPDX de GitHub + frontmatter del libro',
        ).record,
        url: 'https://github.com/rzach/forallx-yyc/tree/master#tfl-deduccion-natural',
      },
    },
    {
      ...candidateFromGithubSnapshot(
        'open-logic-project',
        'Open Logic Project / University of Calgary (GitHub rzach/forallx-yyc)',
        repo,
        AHORA,
        '«used with permission» (A Modal Logic Primer, Robert Trueman) — frontmatter del libro',
      ),
      record: {
        ...candidateFromGithubSnapshot(
          'open-logic-project',
          'Open Logic Project / University of Calgary (GitHub rzach/forallx-yyc)',
          repo,
          AHORA,
          '«used with permission» (A Modal Logic Primer, Robert Trueman) — frontmatter del libro',
        ).record,
        url: 'https://github.com/rzach/forallx-yyc/tree/master#logica-modal',
      },
    },
    candidateFromStablePage(
      'mit-opencourseware',
      'MIT OpenCourseWare (24.241 Logic I, Dr. Ephraim Glick)',
      'Fall 2009 (archivado)',
      ocw,
      AHORA,
      'CC BY-NC-SA 4.0 — aviso de licencia del curso y condiciones de uso de MIT OCW',
    ),
  ];

  // ── Entrada de la corrida ─────────────────────────────────────────────────
  console.log('2/4 Montando la entrada…');
  const evaluaciones = JSON.parse(
    readFileSync(join(RESEARCH, 'evaluations-2026-08-19.json'), 'utf8'),
  );
  const whitelist = [
    { sourceId: 'open-logic-project', name: 'Open Logic Project', accessMode: 'indice_estable', baseUrl: 'https://openlogicproject.org/' },
    { sourceId: 'mit-opencourseware', name: 'MIT OpenCourseWare', accessMode: 'indice_estable', baseUrl: 'https://ocw.mit.edu/' },
    { sourceId: 'openstax', name: 'OpenStax', accessMode: 'indice_estable', baseUrl: 'https://openstax.org/' },
  ];
  const input = {
    courseId: 'unidad-deduccion-natural',
    scope: {
      formalSystemId: 'forallx-calgary-tfl',
      topic: 'Deducción natural proposicional en formato Fitch (bloque TFL de forall x: Calgary)',
    },
    whitelist,
    candidates: candidatos,
    discoveryRounds: [
      { round: 1, newItems: 2, reviewedItems: 2, lineages: ['forallx-yyc', 'ocw-24.241-f09'] },
      { round: 2, newItems: 0, reviewedItems: openstax.totalCount, lineages: [] },
    ],
    evaluations: evaluaciones.evaluations,
    licenseQuery: { intendedUse: 'base_expresiva' },
    selectionRationale:
      'El componente primario es forallx-yyc/tfl-deduccion-natural: CC BY 4.0 verificada por tres ' +
      'vías, cubre los dieciocho KC del bloque y sus claims se verifican mecánicamente contra el ' +
      'cálculo autorizado (de esta obra se transcribió). El componente modal queda ' +
      'LICENSE_UNRESOLVED (material «used with permission» de Trueman) y no se necesita para el ' +
      'bloque. MIT OCW 24.241 queda excluido como base expresiva por NC/SA — es el default ' +
      'conservador; declarar compatibilidad es decisión del aprobador, no de la corrida. OpenStax ' +
      'no tiene ningún título de lógica en su catálogo de 129. El subárbol solutions/ del repo se ' +
      'excluye de la base expresiva: su lugar es solutions-private en W1 (I-2/I-4).',
  };

  // ── Corrida ───────────────────────────────────────────────────────────────
  console.log('3/4 Ejecutando el orquestador…');
  const result = runW0(input);
  console.log(`  estado final: ${result.finalState}`);
  console.log(`  inventario: ${JSON.stringify(result.manifest.counts)}`);
  console.log(`  readiness: ${JSON.stringify(result.readiness)}`);

  // ── Artefactos ────────────────────────────────────────────────────────────
  console.log('4/4 Escribiendo research/…');
  for (const candidato of result.acceptedCandidates) {
    const nombre = candidato.record.url.includes('ocw.mit.edu')
      ? 'mit-ocw--24.241-logic-i-fall-2009'
      : `open-logic-project--${candidato.record.url.split('#')[1]}`;
    escribirYaml(`candidates/${nombre}.json`, `Candidato W0 con snapshot generado en W0 (${AHORA}). W1 verifica identidad contra snapshotSha256.`, candidato);
  }
  escribirYaml('license-register.yaml', `Registro de licencias por componente y uso previsto (T-H45-05). Corrida del ${AHORA}.`, {
    licenseQuery: input.licenseQuery,
    verdicts: result.licenseVerdicts,
    records: evaluaciones.evaluations.map((e) => e.licenseRecord),
  });
  escribirYaml('source-scores.yaml', `Observaciones de idoneidad (T-H45-04). scalarAvailable: false — los pesos se congelan en H4.5 con el corpus real. Corrida del ${AHORA}.`, {
    scores: result.manifest.scores,
    notes: evaluaciones.observationNotes,
  });
  escribirYaml('coverage-saturation.yaml', `Informe de saturación (T-H45-04). stopDecisionAvailable: false — la parada no está calibrada. Corrida del ${AHORA}.`, result.saturation);
  escribirYaml('conflicts.yaml', `Conflictos y clasificación de diferencias (T-H45-03). Corrida del ${AHORA}.`, {
    conflicts: result.manifest.conflicts,
    comparisons: result.comparisons.map((c) => ({
      scope: c.scope,
      majority: c.majority,
    })),
  });
  escribirYaml('selection-manifest.yaml', `Propuesta de corpus y autorización (T-H45-06/07). Corrida W0 en vivo del ${AHORA}. Estado: ${result.finalState} — espera la decisión del CORPUS_APPROVER.`, {
    manifest: result.manifest,
    readiness: result.readiness,
    history: result.history,
    openstaxSearch: { query: 'logic', ...openstax },
    note: 'El veredicto de autonomía de W0 debe tratar forallx-yyc conservadoramente: es la obra de la que se transcribió el cálculo autorizado (DEC-W0-SCOPE-001).',
  });

  console.log('Listo. La propuesta espera al CORPUS_APPROVER.');
}

main().catch((error) => {
  console.error(`W0_REPLAY_FALLIDO: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
});
