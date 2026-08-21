#!/usr/bin/env node
/**
 * Corrida W2 en vivo (F6/H5, T-H5-02): extracción curricular (Rol A) sobre los
 * 77 fragmentos reales que W1 materializó, y materialización de `extracted/` y
 * `provenance/` en el repo de contenido.
 *
 * Uso: node scripts/content/w2-extract-run.mjs
 *
 * Qué hace y qué no:
 * - La lógica es `buildExtraction()` (pura). Aquí solo hay red, disco y **datos
 *   declarados**: el contenido extraído está escrito abajo, con su ancla.
 * - **La identidad se vuelve a comprobar, no se cree.** Se descarga el snapshot
 *   autorizado, se re-derivan las secciones y se exige que cada fragmento
 *   persistido hashee igual. Una deriva aquí no se re-hashea: se reevalúa en W0.
 * - Las anclas se declaran por `location` y el script las **resuelve** contra el
 *   corpus persistido; una `location` que no sea fragmento aborta la corrida.
 *   Copiar el par (id, sha256) a mano sería justo el ancla que envejece sola.
 * - Los `rule_id` se **derivan de `logic-core`** (mismo motivo que en T-H5-03):
 *   si la whitelist del cálculo cambiara, esta corrida falla en vez de extraer
 *   un conjunto de reglas que ya no es el del cálculo.
 * - **No hay ningún claim `cross_source_consensus`**, y no es un olvido: el
 *   corpus autorizado tiene un solo componente (D-50). Queda registrado como
 *   decisión curricular en vez de fabricarse una segunda fuente.
 * - Redactado por el modelo asistente, misma salvedad que D-41/D-48: el
 *   CORPUS_APPROVER audita esta extracción antes del freeze de W5.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  attributionDenominator,
  buildExtraction,
  sectionsFromLatex,
} from '../../packages/authoring-core/dist/index.js';
import { AUTHORIZED_RULE_IDS } from '../../packages/logic-core/dist/index.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CONTENIDO = join(RAIZ, 'content/unidad-deduccion-natural');
const AHORA = new Date().toISOString();

const COMPONENTE = 'forallx-yyc/tfl-deduccion-natural';
const COMMIT = 'ec34df8f8f42ccba2bf2d24403ebad335afa93b9';
const ARCHIVOS = ['forallx-yyc-tfl.tex', 'forallx-yyc-truthtables.tex', 'forallx-yyc-prooftfl.tex'];

// Atajos de `location` para que las anclas se lean de un vistazo.
const P = (s) => `forallx-yyc-prooftfl.tex#${s}`;
const T = (s) => `forallx-yyc-tfl.tex#${s}`;

/**
 * Las catorce reglas del cálculo autorizado, cada una con la sección del libro
 * que la enuncia. Los enunciados de las trece primitivas son los mismos que el
 * propietario cotejó regla por regla al firmar el corpus (D-50,
 * `research/evaluations-2026-08-19.json`); aquí quedan **anclados al fragmento
 * que los sostiene** en vez de a `quickreference.tex`, que no se fragmentó.
 */
const REGLAS = {
  R: [P('reiteration'), 'R: de A (línea m) se reitera A.'],
  '∧I': [P('conjunction'), '∧I: de A y B se deriva A∧B.'],
  '∧E': [P('conjunction'), '∧E: de A∧B se deriva A, y de A∧B se deriva B.'],
  '∨I': [P('disjunction'), '∨I: de A se deriva A∨B, y de A se deriva B∨A.'],
  '∨E': [
    P('disjunction'),
    '∨E: de A∨B, una subprueba de A a C y una subprueba de B a C, se deriva C.',
  ],
  '→I': [
    P('conditional'),
    '→I: de una subprueba que abre con el supuesto A y cierra en B se deriva A→B.',
  ],
  '→E': [P('conditional'), '→E: de A→B y A se deriva B.'],
  '↔I': [P('biconditional'), '↔I: de una subprueba de A a B y una de B a A se deriva A↔B.'],
  '↔E': [P('biconditional'), '↔E: de A↔B y A se deriva B; de A↔B y B se deriva A.'],
  '¬I': [
    P('contradiction-and-negation'),
    '¬I: de una subprueba que abre con el supuesto A y cierra en ⊥ se deriva ¬A.',
  ],
  '¬E': [P('contradiction-and-negation'), '¬E: de ¬A y A se deriva ⊥.'],
  X: [P('contradiction-and-negation'), 'X: de ⊥ se deriva cualquier fórmula A.'],
  IP: [
    P('contradiction-and-negation'),
    'IP: de una subprueba que abre con el supuesto ¬A y cierra en ⊥ se deriva A.',
  ],
  DNE: [P('double-negation-elimination'), 'DNE: de ¬¬A se deriva A.'],
};

/** Sufijo estable de id por regla: los símbolos no viajan bien en un id. */
const SLUG = {
  R: 'r',
  '∧I': 'conj-i',
  '∧E': 'conj-e',
  '∨I': 'disy-i',
  '∨E': 'disy-e',
  '→I': 'cond-i',
  '→E': 'cond-e',
  '↔I': 'bicond-i',
  '↔E': 'bicond-e',
  '¬I': 'neg-i',
  '¬E': 'neg-e',
  X: 'x',
  IP: 'ip',
  DNE: 'dne',
};

/** Definiciones, notación y restricciones: `[id, sección, locations, enunciado]`. */
const ELEMENTOS = [
  // ── definiciones ─────────────────────────────────────────────────────────
  [
    'def-oracion-tfl',
    'definitions',
    [T('sentences')],
    'Oración de TFL, definición inductiva de siete cláusulas: toda letra oracional es una oración; si A es oración, ¬A es oración; si A y B son oraciones, lo son (A∧B), (A∨B), (A→B) y (A↔B); nada más es una oración.',
  ],
  [
    'def-letra-oracional',
    'definitions',
    [T('atomic-sentences')],
    'Letra oracional (oración atómica): una letra mayúscula, opcionalmente con subíndice, que representa una oración básica y no puede descomponerse.',
  ],
  [
    'def-expresion-vs-oracion',
    'definitions',
    [T('bracketing-conventions')],
    'Expresión frente a oración: «Q∧R» sin paréntesis no es, en sentido estricto, una oración de TFL, sino una mera expresión.',
  ],
  [
    'def-prueba-formal',
    'definitions',
    [P('the-idea-of-a-formal-proof')],
    'Prueba formal (derivación): una secuencia de oraciones, algunas marcadas como supuestos iniciales o premisas, cuya última línea es la conclusión.',
  ],
  [
    'def-supuesto',
    'definitions',
    [P('the-idea-of-a-formal-proof')],
    'Supuesto: todo lo escrito sobre la raya de una prueba. Lo escrito debajo o se sigue de los supuestos o es un supuesto nuevo.',
  ],
  [
    'def-subprueba',
    'definitions',
    [P('additional-assumptions-and-subproofs')],
    'Subprueba: prueba subsidiaria dentro de la principal, abierta con un supuesto adicional; plantea qué podría mostrarse si además se supusiera eso.',
  ],
  [
    'def-descarga',
    'definitions',
    [P('additional-assumptions-and-subproofs')],
    'Descarga: cerrar una subprueba es descargar sus supuestos; a partir de ahí no se puede recurrir a nada obtenido bajo el supuesto descargado.',
  ],
  [
    'def-contradiccion',
    'definitions',
    [P('contradiction-and-negation')],
    'Contradicción (⊥): símbolo que se introduce cuando la prueba contiene a la vez una oración y su negación. Oficialmente se adopta como letra oracional que solo puede ser falsa.',
  ],
  [
    'def-deduccion-natural',
    'definitions',
    [P('the-very-idea-of-natural-deduction')],
    'Sistema de deducción natural: sistema que muestra la validez de un argumento manipulando oraciones según reglas fijadas de antemano, en vez de recorrer valuaciones.',
  ],
  [
    'def-estrategia-hacia-atras',
    'definitions',
    [P('working-backward-from-what-we-want')],
    'Trabajar hacia atrás: mirar el operador principal de la conclusión buscada y planear la regla de introducción de ese operador, convirtiendo sus premisas o subpruebas en las nuevas metas.',
  ],
  [
    'def-estrategia-hacia-adelante',
    'definitions',
    [P('working-forward-from-what-we-have')],
    'Trabajar hacia adelante: aplicar las reglas de eliminación del operador principal de las premisas y supuestos disponibles para rellenar los pasos que faltan.',
  ],
  [
    'def-estrategia-indirecta',
    'definitions',
    [P('proceed-indirectly')],
    'Proceder indirectamente: cuando trabajar hacia atrás y hacia adelante no da resultado, abrir una subprueba con el supuesto ¬A y buscar dentro de ella una prueba de ⊥ para cerrar con IP.',
  ],
  [
    'def-falsum-comodin',
    'definitions',
    [P('working-forward-from-ered')],
    'Comodín ⊥: una vez justificado ⊥, la regla X permite justificar cualquier cosa, de modo que ⊥ funciona como comodín dentro de la prueba.',
  ],
  [
    'def-sin-receta',
    'definitions',
    [P('constructing-proofs')],
    'Construcción de pruebas: no hay receta simple para encontrar una prueba ni sustituto de la práctica; lo que hay son reglas de pulgar y estrategias.',
  ],

  // ── notación ─────────────────────────────────────────────────────────────
  [
    'not-numeracion-lineas',
    'notation',
    [P('the-idea-of-a-formal-proof')],
    'Toda línea de la prueba va numerada, para poder citarla después; bajo las premisas se traza una raya.',
  ],
  [
    'not-justificacion-linea',
    'notation',
    [P('reiteration')],
    'Cada línea que no sea supuesto lleva justificación: el nombre de la regla y las líneas a las que se aplica (por ejemplo «R 4»).',
  ],
  [
    'not-metavariables',
    'notation',
    [P('reiteration')],
    'Las metavariables A, B no son oraciones de TFL sino símbolos del metalenguaje para hablar de cualquier oración; m, n hacen lo propio con los números de línea y no aparecen en una prueba real.',
  ],
  [
    'not-subprueba-vertical',
    'notation',
    [P('conditional')],
    'Un supuesto adicional se marca con una raya debajo y una línea vertical adicional que sangra la subprueba; al cerrarla se vuelve a una sola línea vertical.',
  ],
  [
    'not-corchetes',
    'notation',
    [T('bracketing-conventions')],
    'Los corchetes «[» y «]» se admiten en lugar de los paréntesis: no hay diferencia lógica entre (P∨Q) y [P∨Q].',
  ],
  [
    'not-parentesis-externos',
    'notation',
    [T('bracketing-conventions')],
    'Se permite omitir los paréntesis más externos de una oración, con la obligación de reponerlos al incrustarla en otra más compleja.',
  ],
  [
    'not-cinco-conectivos',
    'notation',
    [T('sentences')],
    'Los conectivos de TFL son cinco: ¬, ∧, ∨, → y ↔; los cuatro binarios se aplican siempre a exactamente dos oraciones.',
  ],
  [
    'not-simbolo-falsum',
    'notation',
    [P('contradiction-and-negation')],
    'El símbolo ⊥ se lee «contradicción»; al citar ¬E es convención poner primero el número de la negación y después el de la oración negada.',
  ],

  // ── restricciones ────────────────────────────────────────────────────────
  [
    'res-cita-linea',
    'restrictions',
    [P('additional-assumptions-and-subproofs')],
    'Para citar una línea suelta: debe venir antes de la línea que aplica la regla, y no estar dentro de una subprueba ya cerrada en ese punto.',
  ],
  [
    'res-cita-subprueba',
    'restrictions',
    [P('additional-assumptions-and-subproofs')],
    'Para citar una subprueba: debe estar entera antes de la aplicación, no puede quedar dentro de otra subprueba ya cerrada, y su última línea no puede estar dentro de una subprueba anidada.',
  ],
  [
    'res-linea-vs-subprueba',
    'restrictions',
    [P('additional-assumptions-and-subproofs')],
    'Donde la regla pide una línea no vale citar una subprueba, y donde pide una subprueba no vale citar una línea.',
  ],
  [
    'res-parentesis-indispensables',
    'restrictions',
    [T('bracketing-conventions')],
    'Los paréntesis son parte indispensable de la oración: quitarlos cambia el alcance, y ¬(Q∧R) es muy distinto de ¬Q∧R.',
  ],
  [
    'res-conjuncion-binaria',
    'restrictions',
    [P('conjunction')],
    'La definición oficial solo admite conjunciones de dos conyuntos; el libro mantiene la convención estricta de paréntesis y no suprime los internos en las pruebas.',
  ],
  [
    'res-eliminacion-operador-principal',
    'restrictions',
    [P('conjunction')],
    '∧E solo se aplica cuando la conjunción es el operador principal de la línea citada: de C∨(D∧E) no se sigue D.',
  ],
  [
    'res-explosion-exige-falsum',
    'restrictions',
    [P('contradiction-and-negation')],
    'X solo se aplica cuando ya se tiene ⊥ en la prueba, y ⊥ solo se obtiene de supuestos contradictorios.',
  ],
];

/** Claims tipados: `[id, tipo, locations, enunciado, soportes]`. */
const CLAIMS = [
  [
    'c-oracion-inductiva',
    'source_assertion',
    [T('sentences')],
    'La fuente define «oración de TFL» inductivamente con siete cláusulas, y la séptima cierra la definición: nada más es una oración.',
    [],
  ],
  [
    'c-parentesis-indispensables',
    'source_assertion',
    [T('bracketing-conventions')],
    'La fuente afirma que los paréntesis son parte indispensable de la oración y que solo se permite omitir los más externos.',
    [],
  ],
  [
    'c-negacion-alcance',
    'source_assertion',
    [T('bracketing-conventions')],
    'La fuente señala que «¬Q∧R» se lee con naturalidad como (¬Q)∧R, y que eso es muy distinto de ¬(Q∧R).',
    [],
  ],
  [
    'c-falsum-letra-oracional',
    'source_assertion',
    [P('contradiction-and-negation')],
    'La fuente adopta oficialmente ⊥ como letra oracional que siempre es falsa, entre tres lecturas posibles del símbolo.',
    [],
  ],
  [
    'c-ip-no-elimina',
    'source_assertion',
    [P('contradiction-and-negation')],
    'La fuente afirma que IP no introduce ni elimina ningún conectivo, a diferencia de ¬E, que sí tiene una premisa de la forma ¬A.',
    [],
  ],
  [
    'c-subprueba-alcance',
    'source_assertion',
    [P('additional-assumptions-and-subproofs')],
    'La fuente estipula que no se puede citar una línea de una subprueba cerrada, y que cerrar una subprueba descarga sus supuestos.',
    [],
  ],
  [
    'c-nd-frente-a-tablas',
    'source_assertion',
    [P('the-very-idea-of-natural-deduction')],
    'La fuente presenta la deducción natural como una vía distinta de las tablas de verdad, motivada por comprensión y por necesidad práctica.',
    [],
  ],
  [
    'c-adicionales-derivables',
    'source_assertion',
    [P('additional-rules-for-tfl'), P('derived-rules')],
    'La fuente introduce sus reglas en dos tandas y declara que las reglas adicionales no son estrictamente necesarias: se derivan de las básicas.',
    [],
  ],
  [
    'c-sin-receta',
    'source_assertion',
    [P('constructing-proofs')],
    'La fuente afirma que no hay receta simple para encontrar pruebas ni sustituto de la práctica: ofrece reglas de pulgar y estrategias, no un algoritmo.',
    [],
  ],
  [
    'c-estrategia-operador-principal',
    'source_assertion',
    [P('working-backward-from-what-we-want'), P('working-forward-from-what-we-have')],
    'La fuente hace depender la estrategia del operador principal: hacia atrás se planea su regla de introducción, y hacia adelante se aplica la de eliminación del operador principal de lo disponible.',
    [],
  ],
  [
    'c-estrategias-combinables',
    'source_assertion',
    [P('strategies-at-work')],
    'La fuente muestra en un ejemplo trabajado que ambas estrategias se combinan dentro de una misma prueba, alternando metas y submetas.',
    [],
  ],
  [
    'c-ip-ultimo-recurso',
    'source_assertion',
    [P('proceed-indirectly')],
    'La fuente presenta IP como recurso para los casos en que trabajar hacia adelante y hacia atrás no da resultado, y advierte que dentro de la subprueba se dispone del supuesto ¬A que antes no se tenía.',
    [],
  ],
  [
    'c-falsum-comodin',
    'source_assertion',
    [P('working-forward-from-ered')],
    'La fuente describe ⊥ como comodín: justificado ⊥, la regla de explosión permite justificar cualquier oración.',
    [],
  ],
  // ── inferencias del sistema: ninguna fuente las afirma ────────────────────
  [
    'c-sin-precedencia',
    'system_inference',
    [],
    'El sistema concluye que entre los conectivos binarios no hay precedencia: la fuente no fija ninguna y exige los paréntesis, así que el alcance solo lo da el paréntesis.',
    ['c-parentesis-indispensables', 'c-oracion-inductiva'],
  ],
  [
    'c-base-coincide-con-calculo',
    'system_inference',
    [],
    'El sistema concluye que las trece reglas primitivas de authorized-calculus-v1 son exactamente las reglas básicas de TFL de la fuente, y que DNE, su única derivada autorizada, la fuente la presenta como regla adicional derivable.',
    ['c-regla-r', 'c-regla-dne', 'c-adicionales-derivables'],
  ],
  [
    'c-derivadas-fuera-whitelist',
    'system_inference',
    [],
    'El sistema concluye que DS, MT, LEM y DeM, que la fuente presenta como reglas adicionales, quedan fuera de la whitelist cerrada del cálculo autorizado: una derivación que las cite se rechaza.',
    ['c-adicionales-derivables', 'c-base-coincide-con-calculo'],
  ],
];

/** Decisiones curriculares: van aparte de los claims (P-I §7.11). */
const DECISIONES = [
  [
    'dc-alcance-reglas',
    'La unidad enseña las trece reglas primitivas del cálculo autorizado más DNE. DS, MT, LEM y DeM quedan fuera aunque la fuente las presente.',
    ['c-derivadas-fuera-whitelist', 'c-adicionales-derivables'],
    'La whitelist de authorized-calculus-v1 es cerrada y el verificador rechaza lo que no esté en ella. Enseñar una regla que el verificador rechaza produciría un fallo garantizado en la primera corrección, y el alumno lo leería como error suyo.',
  ],
  [
    'dc-parentesis-obligatorios',
    'La unidad adopta paréntesis obligatorios salvo los más externos y no reconoce precedencia entre conectivos binarios.',
    ['c-sin-precedencia', 'c-parentesis-indispensables', 'c-negacion-alcance'],
    'Es la convención de la propia fuente y la que el verificador implementa: A∧B∧C se rechaza con E-SYN-PRECEDENCE. Adoptar la precedencia habitual en matemáticas enseñaría a escribir lo que el verificador rechaza.',
  ],
  [
    'dc-semantica-como-apoyo',
    'Las secciones de tablas de verdad entran en la unidad como apoyo documental, no como base expresiva de ningún KC.',
    ['c-nd-frente-a-tablas'],
    'El catálogo KC01–KC18 de P-I §5.2 no contiene ningún KC semántico: anclarles fragmentos de tablas de verdad les daría un KC de destino que nadie declaró. El material queda citable como fuente, que es lo que sí sostiene.',
  ],
  [
    'dc-sin-consenso-cruzado',
    'Esta extracción no emite ningún claim de tipo cross_source_consensus.',
    ['c-oracion-inductiva', 'c-parentesis-indispensables', 'c-adicionales-derivables'],
    'El corpus autorizado tiene un solo componente (D-50: solo forallx-yyc/tfl-deduccion-natural), y cross_source_consensus exige dos componentes distintos. Emitir uno exigiría una segunda fuente que nadie autorizó; la ausencia se registra en vez de fabricarse.',
  ],
];

function leerJsonConCabecera(ruta) {
  return JSON.parse(readFileSync(ruta, 'utf8').replace(/^(#[^\n]*\n)+/, ''));
}

function escribirYaml(ruta, cabecera, datos) {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, `# ${cabecera}\n${JSON.stringify(datos, null, 2)}\n`);
  console.log(`  escrito: ${ruta.slice(CONTENIDO.length + 1)}`);
}

async function main() {
  console.log(`W2 en vivo — ${AHORA}`);

  // ── 1/5 Corpus persistido ─────────────────────────────────────────────────
  console.log('1/5 Cargando el corpus que W1 materializó…');
  const manifiesto = leerJsonConCabecera(join(CONTENIDO, 'source/manifest.yaml'));
  const fragmentos = leerJsonConCabecera(
    join(CONTENIDO, 'source/fragments/forallx-yyc--tfl-deduccion-natural.json'),
  );
  const corpus = {
    corpusVersion: manifiesto.corpusVersion,
    courseId: manifiesto.courseId,
    components: manifiesto.components,
    fragments: fragmentos,
    kcsWithoutExpressiveBase: manifiesto.kcsWithoutExpressiveBase ?? [],
  };
  console.log(`  ${corpus.fragments.length} fragmentos, curso ${corpus.courseId}`);

  // ── 2/5 Identidad: se recomprueba, no se cree ─────────────────────────────
  console.log('2/5 Re-verificando la identidad del corpus contra el snapshot…');
  const respuesta = await fetch(`https://api.github.com/repos/rzach/forallx-yyc/tarball/${COMMIT}`, {
    headers: { 'user-agent': 'profesor-ia-w2-extract' },
  });
  if (!respuesta.ok) throw new Error(`GitHub respondió ${respuesta.status}`);
  const tarball = Buffer.from(await respuesta.arrayBuffer());
  const tarballSha256 = createHash('sha256').update(tarball).digest('hex');
  const esperadoTarball = manifiesto.tarballSha256[COMPONENTE];
  if (tarballSha256 !== esperadoTarball) {
    console.error(
      `W2_DERIVA: W1 registró el tarball ${esperadoTarball} y la descarga hashea ${tarballSha256}. ` +
        `La fuente cambió después de ingerirse: reevaluar en W0, no re-hashear.`,
    );
    process.exit(2);
  }

  const tmp = join(tmpdir(), `w2-extract-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  writeFileSync(join(tmp, 'snapshot.tar.gz'), tarball);
  // Rutas relativas: el tar de Git (GNU) lee «C:\…» como host remoto.
  execFileSync('tar', ['xzf', 'snapshot.tar.gz'], { cwd: tmp });
  const raiz = join(tmp, `rzach-forallx-yyc-${COMMIT.slice(0, 7)}`);
  if (!existsSync(raiz)) throw new Error(`No apareció el directorio esperado ${raiz}`);

  const hashPorLocation = new Map();
  for (const archivo of ARCHIVOS) {
    const tex = readFileSync(join(raiz, archivo), 'utf8');
    for (const frag of sectionsFromLatex(tex, archivo)) {
      hashPorLocation.set(
        frag.location,
        createHash('sha256').update(frag.text, 'utf8').digest('hex'),
      );
    }
  }
  const derivados = corpus.fragments.filter((f) => hashPorLocation.get(f.location) !== f.sha256);
  if (derivados.length > 0) {
    console.error(
      `W2_DERIVA: ${derivados.length} fragmento(s) persistidos no coinciden con el texto re-derivado ` +
        `(${derivados.map((f) => f.location).join(', ')}). Reingerir en W1, no re-hashear.`,
    );
    process.exit(2);
  }
  console.log(
    `  tarball ${tarballSha256.slice(0, 12)}… y ${corpus.fragments.length} fragmentos sin deriva`,
  );

  // ── 3/5 Resolución de anclas ──────────────────────────────────────────────
  console.log('3/5 Resolviendo anclas declaradas por location…');
  const porLocation = new Map(corpus.fragments.map((f) => [f.location, f]));
  const anclar = (quien, locations) =>
    locations.map((location) => {
      const fragmento = porLocation.get(location);
      if (fragmento === undefined) {
        throw new Error(
          `${quien} declara el ancla ${location}, que no es un fragmento del corpus ingerido. ` +
            `Las anclas se resuelven contra el corpus, nunca se copian a mano.`,
        );
      }
      return { fragmentId: fragmento.fragmentId, fragmentSha256: fragmento.sha256 };
    });

  // La whitelist manda: si el cálculo cambiara, esto falla en vez de extraer un
  // conjunto de reglas que ya no es el suyo.
  const declaradas = Object.keys(REGLAS);
  const faltan = AUTHORIZED_RULE_IDS.filter((id) => !declaradas.includes(id));
  const sobran = declaradas.filter((id) => !AUTHORIZED_RULE_IDS.includes(id));
  if (faltan.length > 0 || sobran.length > 0) {
    throw new Error(
      `Las reglas declaradas no son las de authorized-calculus-v1 ` +
        `(faltan: ${faltan.join(', ') || '—'}; sobran: ${sobran.join(', ') || '—'}).`,
    );
  }

  const items = [
    ...AUTHORIZED_RULE_IDS.map((ruleId) => {
      const [location, statement] = REGLAS[ruleId];
      return {
        itemId: `regla-${SLUG[ruleId]}`,
        section: 'rules',
        statement: `${statement} (rule_id ${ruleId})`,
        anchors: anclar(`La regla ${ruleId}`, [location]),
      };
    }),
    ...ELEMENTOS.map(([itemId, section, locations, statement]) => ({
      itemId,
      section,
      statement,
      anchors: anclar(`El elemento ${itemId}`, locations),
    })),
  ];

  const claims = [
    ...AUTHORIZED_RULE_IDS.map((ruleId) => {
      const [location, statement] = REGLAS[ruleId];
      return {
        claimId: `c-regla-${SLUG[ruleId]}`,
        claimType: 'source_assertion',
        statement: `La fuente enuncia ${statement}`,
        anchors: anclar(`El claim de ${ruleId}`, [location]),
        supportingClaims: [],
      };
    }),
    ...CLAIMS.map(([claimId, claimType, locations, statement, supportingClaims]) => ({
      claimId,
      claimType,
      statement,
      anchors: anclar(`El claim ${claimId}`, locations),
      supportingClaims,
    })),
  ];

  const curricularDecisions = DECISIONES.map(
    ([decisionId, statement, supportingClaims, justification]) => ({
      decisionId,
      statement,
      supportingClaims,
      justification,
    }),
  );

  // ── 4/5 Extracción validada ───────────────────────────────────────────────
  console.log('4/5 Construyendo la extracción (linter de anclaje incluido)…');
  const extraccion = buildExtraction(corpus, { items, claims, curricularDecisions });
  const denominador = attributionDenominator(extraccion);
  const porSeccion = (s) => extraccion.items.filter((i) => i.section === s);
  const SECCIONES = ['definitions', 'notation', 'rules', 'restrictions'];
  console.log(
    `  ${extraccion.items.length} elementos ` +
      `(${SECCIONES.map((s) => `${s}: ${porSeccion(s).length}`).join(', ')}), ` +
      `${extraccion.claims.length} claims, ${extraccion.curricularDecisions.length} decisiones`,
  );
  console.log(
    `  denominador de atribución: ${denominador.length} claims ` +
      `(${extraccion.claims.length - denominador.length} system_inference fuera, §7.11)`,
  );

  // Cobertura KC de la extracción. No la exige ninguna autoridad para W2; es el
  // mismo motivo por el que W1 registra `kcsWithoutExpressiveBase`: sin esta
  // comprobación, W3 descubriría en plena autoría que un KC con base expresiva
  // no tiene nada extraído, y el hueco parecería fallo del generador. La primera
  // corrida la disparó de verdad: KC17 y KC18 quedaban sin un solo elemento.
  const kcDelCorpus = new Set(corpus.fragments.flatMap((f) => f.relatedConcepts));
  const anclados = new Set(
    [...extraccion.items, ...extraccion.claims].flatMap((e) => e.anchors.map((a) => a.fragmentId)),
  );
  const kcAnclados = new Set(
    corpus.fragments.filter((f) => anclados.has(f.fragmentId)).flatMap((f) => f.relatedConcepts),
  );
  const kcSinExtraccion = [...kcDelCorpus].filter((kc) => !kcAnclados.has(kc)).sort();
  if (kcSinExtraccion.length > 0) {
    throw new Error(
      `KC con base expresiva en el corpus y sin ningún elemento ni claim extraído: ` +
        `${kcSinExtraccion.join(', ')}. W3 no podría anclar sus reactivos a nada.`,
    );
  }
  console.log(`  cobertura KC de la extracción: ${kcAnclados.size}/${kcDelCorpus.size}`);

  // ── 5/5 Materialización ───────────────────────────────────────────────────
  console.log('5/5 Escribiendo extracted/ y provenance/…');
  const cabecera = (qué) =>
    `${qué} (T-H5-02, Rol A). Corrida W2 del ${AHORA} sobre el corpus W1 ` +
    `(tarball ${tarballSha256.slice(0, 12)}…). Redactado por el modelo asistente ` +
    `(salvedad D-41/D-48): el CORPUS_APPROVER lo audita antes del freeze de W5.`;

  for (const section of SECCIONES) {
    escribirYaml(
      join(CONTENIDO, `extracted/${section}.yaml`),
      cabecera(`Sección «${section}» del esquema cerrado`),
      {
        extractionVersion: extraccion.extractionVersion,
        courseId: extraccion.courseId,
        section,
        items: porSeccion(section),
      },
    );
  }

  escribirYaml(join(CONTENIDO, 'extracted/claims.yaml'), cabecera('Claims tipados'), {
    extractionVersion: extraccion.extractionVersion,
    courseId: extraccion.courseId,
    claims: extraccion.claims,
    attributionDenominator: denominador.map((c) => c.claimId),
  });

  // Índice inverso: qué cita cada fragmento. Es lo que el validador de anclaje
  // de T-H7-02 resuelve en vivo, y lo que hace comprobable «anclas resolubles».
  const citantes = new Map();
  const anotar = (fragmentId, quien) => {
    if (!citantes.has(fragmentId)) citantes.set(fragmentId, []);
    citantes.get(fragmentId).push(quien);
  };
  for (const item of extraccion.items) for (const a of item.anchors) anotar(a.fragmentId, item.itemId);
  for (const claim of extraccion.claims) for (const a of claim.anchors) anotar(a.fragmentId, claim.claimId);
  const porId = new Map(corpus.fragments.map((f) => [f.fragmentId, f]));

  escribirYaml(
    join(CONTENIDO, 'provenance/anchors.yaml'),
    cabecera('Anclas resolubles a fragmentos (I-7)'),
    {
      extractionVersion: extraccion.extractionVersion,
      courseId: extraccion.courseId,
      sourceComponent: COMPONENTE,
      fragmentsCited: citantes.size,
      fragmentsTotal: corpus.fragments.length,
      kcCovered: [...kcAnclados].sort(),
      kcInCorpus: [...kcDelCorpus].sort(),
      anchors: [...citantes.entries()]
        .map(([fragmentId, citedBy]) => ({
          fragmentId,
          fragmentSha256: porId.get(fragmentId).sha256,
          citedBy: [...citedBy].sort(),
        }))
        .sort((a, b) => a.fragmentId.localeCompare(b.fragmentId)),
    },
  );

  escribirYaml(
    join(CONTENIDO, 'provenance/curricular-decisions.yaml'),
    cabecera('Decisiones curriculares con soporte y justificación'),
    {
      extractionVersion: extraccion.extractionVersion,
      courseId: extraccion.courseId,
      curricularDecisions: extraccion.curricularDecisions,
    },
  );

  console.log('W2 completada.');
}

await main();
