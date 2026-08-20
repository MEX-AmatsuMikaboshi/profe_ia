#!/usr/bin/env node
/**
 * Corrida W1 en vivo (F6/H5, T-H5-01): descarga el snapshot autorizado,
 * verifica identidad contra W0, fragmenta las partes II–VI y materializa
 * `source/` en el repo de contenido. El subárbol `solutions/` del tarball va
 * a `solutions-private/` (I-2/I-4), fuera de la base expresiva.
 *
 * Uso: node scripts/content/w1-ingest-run.mjs
 *
 * Qué hace y qué no:
 * - Red y disco solo aquí; la lógica es `runW1()` + `ingestCorpus()` (puros).
 * - La identidad se verifica en dos niveles (D-51): bytes del tarball contra
 *   el snapshot que W0 registró, y texto contra la ingesta previa si la hay.
 * - El mapeo sección→KC está DECLARADO abajo con su procedencia; una sección
 *   parseada sin entrada en el mapa aborta la corrida (declarado, nunca
 *   omitido por descuido). Las secciones sin KC llevan `[]` explícito.
 * - Los artefactos se escriben como JSON con cabecera `#` (YAML 1.2 válido,
 *   convención de `research/`). No se inventa ningún dato.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyLicense,
  locationSlug,
  runW1,
  sectionsFromLatex,
} from '../../packages/authoring-core/dist/index.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CONTENIDO = join(RAIZ, 'content/unidad-deduccion-natural');
const RESEARCH = join(CONTENIDO, 'research');
const AHORA = new Date().toISOString();

const COMPONENTE = 'forallx-yyc/tfl-deduccion-natural';
const COMMIT = 'ec34df8f8f42ccba2bf2d24403ebad335afa93b9';
const VERSION = 'master@ec34df8 (2025-12-18)';

/** Las partes II–VI del libro, en orden fijo: de ellas se transcribió el cálculo (D-48). */
const ARCHIVOS = ['forallx-yyc-tfl.tex', 'forallx-yyc-truthtables.tex', 'forallx-yyc-prooftfl.tex'];

/**
 * Mapeo sección → KC, declarado. Procedencia: los scopes de los 13 claims de
 * `research/evaluations-2026-08-19.json` (reglas del cálculo) ↔ secciones de
 * `prooftfl.tex` ↔ `rule_id` de `KC_CATALOG`; KC01/KC02/KC08 se asignan a las
 * secciones de sintaxis, notación Fitch y subpruebas según sus nombres
 * literales en P-I §5.2. Las secciones de tablas de verdad (semántica) no
 * mapean a ningún KC del catálogo — el bloque las usa como apoyo documental.
 * Redactado por el asistente en W1; revisable como cualquier dato declarado.
 */
const SECCION_KC = {
  // ── prooftfl.tex — deducción natural ─────────────────────────────────────
  'forallx-yyc-prooftfl.tex#natural-deduction-for-tfl': [],
  'forallx-yyc-prooftfl.tex#the-very-idea-of-natural-deduction': ['KC02'],
  'forallx-yyc-prooftfl.tex#basic-rules-for-tfl': [],
  'forallx-yyc-prooftfl.tex#the-idea-of-a-formal-proof': ['KC02'],
  'forallx-yyc-prooftfl.tex#reiteration': ['KC03'],
  'forallx-yyc-prooftfl.tex#conjunction': ['KC04', 'KC05'],
  'forallx-yyc-prooftfl.tex#conditional': ['KC06', 'KC09'],
  'forallx-yyc-prooftfl.tex#additional-assumptions-and-subproofs': ['KC08'],
  'forallx-yyc-prooftfl.tex#biconditional': ['KC14', 'KC15'],
  'forallx-yyc-prooftfl.tex#disjunction': ['KC07', 'KC13'],
  'forallx-yyc-prooftfl.tex#contradiction-and-negation': ['KC10', 'KC11', 'KC12'],
  'forallx-yyc-prooftfl.tex#constructing-proofs': ['KC18'],
  'forallx-yyc-prooftfl.tex#working-backward-from-what-we-want': ['KC18'],
  'forallx-yyc-prooftfl.tex#working-forward-from-what-we-have': ['KC18'],
  'forallx-yyc-prooftfl.tex#strategies-at-work': ['KC18'],
  'forallx-yyc-prooftfl.tex#working-forward-from-ered': ['KC18'],
  'forallx-yyc-prooftfl.tex#proceed-indirectly': ['KC17'],
  'forallx-yyc-prooftfl.tex#indirect-proof-of-excluded-middle': ['KC17'],
  'forallx-yyc-prooftfl.tex#additional-rules-for-tfl': [],
  // DS, MT, DeM y LEM son reglas que el cálculo autorizado PROHÍBE (no están en
  // la whitelist): sus secciones documentan el sistema del libro pero no se
  // anclan a ningún KC — anclarlas enseñaría lo que el verificador rechaza.
  'forallx-yyc-prooftfl.tex#disjunctive-syllogism': [],
  'forallx-yyc-prooftfl.tex#modus-tollens': [],
  'forallx-yyc-prooftfl.tex#double-negation-elimination': ['KC16'],
  'forallx-yyc-prooftfl.tex#excluded-middle': [],
  'forallx-yyc-prooftfl.tex#de-morgan-rules': [],
  'forallx-yyc-prooftfl.tex#proof-theoretic-concepts': [],
  'forallx-yyc-prooftfl.tex#derived-rules': [],
  'forallx-yyc-prooftfl.tex#derivation-of-reiteration': [],
  'forallx-yyc-prooftfl.tex#derivation-of-disjunctive-syllogism': [],
  'forallx-yyc-prooftfl.tex#derivation-of-modus-tollens': [],
  'forallx-yyc-prooftfl.tex#derivation-of-double-negation-elimination': ['KC16'],
  'forallx-yyc-prooftfl.tex#derivation-of-excluded-middle': [],
  'forallx-yyc-prooftfl.tex#derivation-of-de-morgan-rules': [],
  'forallx-yyc-prooftfl.tex#soundness-and-completeness': [],
  // ── tfl.tex — sintaxis y conectivos (KC01) ───────────────────────────────
  'forallx-yyc-tfl.tex#truth-functional-logic': [],
  'forallx-yyc-tfl.tex#first-steps-to-symbolization': [],
  'forallx-yyc-tfl.tex#validity-in-virtue-of-form': [],
  'forallx-yyc-tfl.tex#validity-for-special-reasons': [],
  'forallx-yyc-tfl.tex#atomic-sentences': ['KC01'],
  'forallx-yyc-tfl.tex#connectives': ['KC01'],
  'forallx-yyc-tfl.tex#negation': ['KC01'],
  'forallx-yyc-tfl.tex#conjunction': ['KC01'],
  'forallx-yyc-tfl.tex#disjunction': ['KC01'],
  'forallx-yyc-tfl.tex#conditional': ['KC01'],
  'forallx-yyc-tfl.tex#biconditional': ['KC01'],
  'forallx-yyc-tfl.tex#unless': [],
  'forallx-yyc-tfl.tex#sentences-of-tfl': ['KC01'],
  'forallx-yyc-tfl.tex#expressions': ['KC01'],
  'forallx-yyc-tfl.tex#sentences': ['KC01'],
  'forallx-yyc-tfl.tex#bracketing-conventions': ['KC01'],
  'forallx-yyc-tfl.tex#ambiguity': [],
  'forallx-yyc-tfl.tex#use-and-mention': [],
  'forallx-yyc-tfl.tex#quotation-conventions': [],
  'forallx-yyc-tfl.tex#object-language-and-metalanguage': [],
  'forallx-yyc-tfl.tex#metavariables': [],
  'forallx-yyc-tfl.tex#quotation-conventions-for-arguments': [],
  // ── truthtables.tex — semántica; el catálogo KC no incluye KC semánticos ──
  'forallx-yyc-truthtables.tex#truth-tables': [],
  'forallx-yyc-truthtables.tex#characteristic-truth-tables': [],
  'forallx-yyc-truthtables.tex#truth-functional-connectives': [],
  'forallx-yyc-truthtables.tex#the-idea-of-truth-functionality': [],
  'forallx-yyc-truthtables.tex#symbolizing-versus-translating': [],
  'forallx-yyc-truthtables.tex#indicative-versus-subjunctive-conditionals': [],
  'forallx-yyc-truthtables.tex#complete-truth-tables': [],
  'forallx-yyc-truthtables.tex#a-worked-example': [],
  'forallx-yyc-truthtables.tex#building-complete-truth-tables': [],
  'forallx-yyc-truthtables.tex#more-about-brackets': [],
  'forallx-yyc-truthtables.tex#semantic-concepts': [],
  'forallx-yyc-truthtables.tex#tautologies-and-contradictions': [],
  'forallx-yyc-truthtables.tex#equivalence': [],
  'forallx-yyc-truthtables.tex#satisfiability': [],
  'forallx-yyc-truthtables.tex#entailment-and-validity': [],
  'forallx-yyc-truthtables.tex#the-double-turnstile': [],
  'forallx-yyc-truthtables.tex#entails-versus-eif': [],
  'forallx-yyc-truthtables.tex#limitations-of-tfl': [],
  'forallx-yyc-truthtables.tex#truth-table-shortcuts': [],
  'forallx-yyc-truthtables.tex#working-through-truth-tables': [],
  'forallx-yyc-truthtables.tex#testing-for-validity-and-entailment': [],
  'forallx-yyc-truthtables.tex#partial-truth-tables': [],
};

/**
 * Capítulos declarados necesarios (P-III §3.2 «secciones faltantes»): los de
 * las partes II–VI según el selectionRationale de D-48. Si el snapshot deja de
 * traer alguno, la ingesta bloquea en vez de pasar por vacío.
 */
const CAPITULOS_REQUERIDOS = {
  'forallx-yyc-tfl.tex': [
    'First steps to symbolization',
    'Connectives',
    'Sentences of TFL',
    'Ambiguity',
    'Use and mention',
  ],
  'forallx-yyc-truthtables.tex': [
    'Characteristic truth tables',
    'Truth-functional connectives',
    'Complete truth tables',
    'Semantic concepts',
    'Limitations of TFL',
    'Truth table shortcuts',
    'Partial truth tables',
  ],
  'forallx-yyc-prooftfl.tex': [
    'The very idea of natural deduction',
    'Basic rules for TFL',
    'Constructing proofs',
    'Additional rules for TFL',
    'Proof-theoretic concepts',
    'Derived rules',
    'Soundness and completeness',
  ],
};

function leerJsonConCabecera(ruta) {
  const crudo = readFileSync(ruta, 'utf8');
  return JSON.parse(crudo.replace(/^(#[^\n]*\n)+/, ''));
}

function escribirYaml(ruta, cabecera, datos) {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, `# ${cabecera}\n${JSON.stringify(datos, null, 2)}\n`);
  console.log(`  escrito: ${ruta.slice(CONTENIDO.length + 1)}`);
}

async function main() {
  console.log(`W1 en vivo — ${AHORA}`);

  // ── 1/6 Descarga e identidad a nivel bytes ────────────────────────────────
  console.log('1/6 Descargando el tarball del snapshot autorizado…');
  const respuesta = await fetch(`https://api.github.com/repos/rzach/forallx-yyc/tarball/${COMMIT}`, {
    headers: { 'user-agent': 'profesor-ia-w1-ingest', redirect: 'follow' },
  });
  if (!respuesta.ok) throw new Error(`GitHub respondió ${respuesta.status}`);
  const tarball = Buffer.from(await respuesta.arrayBuffer());
  const tarballSha256 = createHash('sha256').update(tarball).digest('hex');

  const candidato = leerJsonConCabecera(
    join(RESEARCH, 'candidates/open-logic-project--tfl-deduccion-natural.json'),
  );
  const esperado = candidato.record.snapshotSha256;
  if (tarballSha256 !== esperado) {
    console.error(
      `W1_DERIVA: W0 registró ${esperado} y la descarga hashea ${tarballSha256}. ` +
        `La fuente cambió después de evaluarse: reevaluar en W0, no re-hashear.`,
    );
    process.exit(2);
  }
  console.log(`  identidad tarball verificada: ${tarballSha256.slice(0, 12)}…`);

  // ── 2/6 Extracción ────────────────────────────────────────────────────────
  console.log('2/6 Extrayendo…');
  const tmp = join(tmpdir(), `w1-ingest-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  const tgz = join(tmp, 'snapshot.tar.gz');
  writeFileSync(tgz, tarball);
  // Rutas relativas: el tar de Git (GNU) lee «C:\…» como host remoto.
  execFileSync('tar', ['xzf', 'snapshot.tar.gz'], { cwd: tmp });
  const raiz = join(tmp, `rzach-forallx-yyc-${COMMIT.slice(0, 7)}`);
  if (!existsSync(raiz)) throw new Error(`No apareció el directorio esperado ${raiz}`);

  // solutions/ → solutions-private/ (I-2/I-4): fuera de la base expresiva.
  const solOrigen = join(raiz, 'solutions');
  const solDestino = join(CONTENIDO, 'solutions-private');
  const solArchivos = readdirSync(solOrigen);
  for (const nombre of solArchivos) {
    copyFileSync(join(solOrigen, nombre), join(solDestino, nombre));
  }
  escribirYaml(
    join(solDestino, 'procedencia.json'),
    `Procedencia de solutions-private (I-2/I-4). Copiado del subárbol solutions/ del tarball ${COMMIT} en la ingesta W1 del ${AHORA}. No es base expresiva: su contenido alimenta las soluciones de W3, nunca los fragmentos del corpus.`,
    {
      sourceComponent: COMPONENTE,
      sourceVersion: VERSION,
      snapshotSha256: esperado,
      copiedAt: AHORA,
      files: solArchivos,
    },
  );
  console.log(`  solutions/ → solutions-private/ (${solArchivos.length} archivos)`);

  // ── 3/6 Fragmentación ─────────────────────────────────────────────────────
  console.log('3/6 Fragmentando las partes II–VI…');
  const secciones = [];
  const partes = [];
  for (const archivo of ARCHIVOS) {
    const tex = readFileSync(join(raiz, archivo), 'utf8');
    partes.push(`\n%%SOURCE-FILE: ${archivo}\n${tex}`);
    for (const frag of sectionsFromLatex(tex, archivo)) {
      if (!(frag.location in SECCION_KC)) {
        throw new Error(
          `La sección ${frag.location} no tiene entrada declarada en SECCION_KC ` +
            `(aunque sea []). Declarado, nunca omitido por descuido.`,
        );
      }
      secciones.push({
        location: frag.location,
        kind: frag.kind,
        text: frag.text,
        relatedConcepts: SECCION_KC[frag.location],
      });
    }
  }
  console.log(`  ${secciones.length} fragmentos de ${ARCHIVOS.length} archivos`);

  // ── 4/6 Entrada y corrida ─────────────────────────────────────────────────
  console.log('4/6 Montando la entrada y ejecutando runW1…');
  const propuesta = leerJsonConCabecera(join(RESEARCH, 'selection-manifest.yaml'));
  const licencias = leerJsonConCabecera(join(RESEARCH, 'license-register.yaml'));
  const useVerdicts = licencias.records.flatMap((record) =>
    ['fuente_documental', 'base_expresiva'].map((intendedUse) => ({
      sourceComponent: record.sourceComponent,
      intendedUse,
      verdict: classifyLicense(record, { intendedUse }),
    })),
  );

  // Ingesta previa, si la hay: su hash de contenido ancla la re-ingesta.
  let priorContentSha256;
  try {
    const previo = leerJsonConCabecera(join(CONTENIDO, 'source/manifest.yaml'));
    if (previo.contentSha256 !== undefined) priorContentSha256 = previo.contentSha256;
  } catch {
    // Placeholder de F0 o primera ingesta: no hay identidad textual previa.
  }

  const { KC_IDS } = await import('../../packages/authoring-core/dist/index.js');
  const requiredSections = Object.entries(CAPITULOS_REQUERIDOS).flatMap(([archivo, titulos]) =>
    titulos.map((titulo) => ({
      sourceComponent: COMPONENTE,
      location: `${archivo}#${locationSlug(titulo)}`,
    })),
  );

  const resultado = runW1({
    manifest: propuesta.manifest,
    components: [
      {
        loaded: {
          sourceComponent: COMPONENTE,
          sourceVersion: VERSION,
          origin: 'Open Logic Project / University of Calgary (GitHub rzach/forallx-yyc)',
          notationFamily: 'fitch',
          content: partes.join(''),
          sections: secciones,
        },
        tarballSha256,
      },
    ],
    authorizedNotationFamily: 'fitch',
    candidateKcs: [...KC_IDS],
    requiredSections,
    useVerdicts,
    priorContentSha256,
  });

  // ── 5/6 Materialización ───────────────────────────────────────────────────
  console.log('5/6 Escribiendo source/…');
  escribirYaml(
    join(CONTENIDO, 'source/manifest.yaml'),
    `Manifiesto del corpus ingerido (T-H5-01). Corrida W1 del ${AHORA}. Identidad en dos niveles (D-51): tarball verificado contra W0 y contenido textual anclado a la ingesta previa.`,
    {
      corpusVersion: resultado.corpus.corpusVersion,
      courseId: resultado.corpus.courseId,
      ingestedAt: AHORA,
      components: resultado.corpus.components,
      contentSha256: resultado.contentSha256,
      tarballSha256: { [COMPONENTE]: tarballSha256 },
      fragmentCount: resultado.corpus.fragments.length,
      kcsWithoutExpressiveBase: resultado.corpus.kcsWithoutExpressiveBase,
      requiredSectionsDeclared: requiredSections.length,
      identityNotes: resultado.identityNotes,
      seccionKcProvenance:
        'Mapeo sección→KC declarado en scripts/content/w1-ingest-run.mjs (SECCION_KC), ' +
        'redactado por el asistente en W1 a partir de los claims de research/evaluations-2026-08-19.json.',
    },
  );
  escribirYaml(
    join(CONTENIDO, 'source/fragments/forallx-yyc--tfl-deduccion-natural.json'),
    `Fragmentos del componente ${COMPONENTE} (T-H5-01, §3.3). Corrida W1 del ${AHORA}. IDs estables derivados (D-17).`,
    resultado.corpus.fragments,
  );

  // ── 6/6 Resumen ───────────────────────────────────────────────────────────
  console.log('6/6 Resumen');
  console.log(`  fragmentos: ${resultado.corpus.fragments.length}`);
  console.log(
    `  kcsWithoutExpressiveBase: ${JSON.stringify(resultado.corpus.kcsWithoutExpressiveBase)}`,
  );
  for (const nota of resultado.identityNotes) console.log(`  identidad: ${nota}`);
  console.log('Listo. W1 cierra con el corpus ingerido y materializado.');
}

main().catch((error) => {
  console.error(`W1_FALLIDA: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
});
