#!/usr/bin/env node
/**
 * Corrida de Rol B (F6/H5, T-H5-04): política pedagógica de autoría sobre el
 * mapa de KC materializado, y materialización de `objectives/`, `pedagogy/` y
 * `session-templates/` en el repo de contenido.
 *
 * Uso: node scripts/content/rolb-pedagogy-run.mjs
 *
 * Qué hace y qué no:
 * - La lógica es `pedagogy.ts` (pura): aquí hay disco y **datos declarados**,
 *   y todo pasa por los validadores del módulo antes de escribirse.
 * - **La secuencia se deriva, no se escribe.** Sale de un orden topológico
 *   determinista sobre `kc/map.yaml` y se comprueba arista por arista: una
 *   secuencia escrita a mano podría contradecir una dependencia formal sin que
 *   nada lo notara.
 * - **El catálogo de estrategias se proyecta de `STRATEGY_CATALOG`**, que a su
 *   vez se deriva de P-I §5.10 y del enum de P-II §7.2.1. No se transcribe: si
 *   se transcribiera, catálogo y contrato podrían separarse en silencio.
 * - **No se fija ningún intervalo de spacing.** §8.3.4 dice que la programación
 *   «corresponde al motor/calendario», así que aquí van las dos reglas que la
 *   norma sí fija y el intervalo lo pone el calendario SCED (T-H5-11). Escribir
 *   un número aquí sería fabricar una calibración que nadie congeló.
 * - **No se inventa una taxonomía de tipos de conocimiento.** El Maestro pide
 *   «perfil pedagógico por KC/tipo de conocimiento» (§7.2) y no define en
 *   ninguna parte qué tipos hay. El perfil se lleva por KC, con el patrón base
 *   de §8.3.2 que lo gobierna; el hueco queda declarado en el artefacto.
 * - Redactado por el modelo asistente, misma salvedad que D-41/D-48/D-52: los
 *   objetivos y las señales observables los audita el propietario antes del
 *   freeze de W5.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertActivationMatrix,
  assertCatalogMatchesContracts,
  assertFadingPolicy,
  assertObservableObjectives,
  assertRetrievalPlan,
  assertSelfExplanationPolicy,
  BASE_PATTERNS,
  DECISION_HIERARCHY,
  STRATEGY_CATALOG,
} from '../../packages/authoring-core/dist/index.js';
import { BKT_SHADOW_H5_CONFIGURATION } from '../../packages/experiment/dist/index.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CONTENIDO = join(RAIZ, 'content/unidad-deduccion-natural');
const AHORA = new Date().toISOString();

const POLICY_VERSION = 'pedagogy-policy-h5-v1';

/**
 * Objetivo observable por KC: qué se espera y **qué se observa** para darlo por
 * cumplido. La evidencia se apoya en lo que el verificador dice por sí mismo
 * —una derivación aceptada, un código `E-*` concreto—, no en una impresión del
 * agente: un objetivo cuya evidencia dependiera del juicio del modelo no sería
 * observable, sería opinable.
 */
const OBJETIVOS = {
  KC01: [
    'Escribir y leer fórmulas bien formadas del cálculo autorizado, con sus cinco conectivos y su paréntesis obligatorio.',
    'El alumno entrega fórmulas que el analizador acepta, y corrige las rechazadas leyendo el código: `E-SYN-PARSE`, `E-SYN-PRECEDENCE`, `E-SYN-SYMBOL` o `E-SYN-ALIAS`.',
  ],
  KC02: [
    'Leer una derivación en formato Fitch: numeración de líneas, justificación de cada línea y alcance de las subpruebas.',
    'El alumno cita líneas existentes y anteriores en sus justificaciones; sus intentos dejan de producir `E-REF-FORWARD`.',
  ],
  KC03: [
    'Aplicar `R` para reiterar una línea accesible.',
    'Una derivación aceptada en la que una línea se justifica con `R` sobre una línea accesible anterior.',
  ],
  KC04: [
    'Aplicar `∧I` para introducir una conjunción a partir de sus dos conyuntos.',
    'Una derivación aceptada en la que la conjunción se justifica con `∧I` citando las dos líneas, sin `E-RULE-ARITY` ni `E-RULE-SHAPE`.',
  ],
  KC05: [
    'Aplicar `∧E` para obtener cualquiera de los conyuntos de una conjunción.',
    'Una derivación aceptada con `∧E` sobre una línea cuya conjunción es el operador principal; el intento sobre un operador principal distinto produce `E-RULE-MAINOP` y el alumno lo corrige.',
  ],
  KC06: [
    'Aplicar `→E` a partir de un condicional y su antecedente.',
    'Una derivación aceptada en la que el consecuente se justifica con `→E` citando condicional y antecedente.',
  ],
  KC07: [
    'Aplicar `∨I` para introducir una disyunción desde uno de sus disyuntos.',
    'Una derivación aceptada con `∨I` sobre una línea accesible, en cualquiera de las dos posiciones del disyunto.',
  ],
  KC08: [
    'Abrir y cerrar subpruebas respetando alcance, accesibilidad y descarga de supuestos.',
    'El alumno deja de citar líneas de subpruebas cerradas: sus intentos no producen `E-REF-CLOSED`, `E-REF-SUBPROOF-INCOMPLETE` ni `E-REF-SUBPROOF-NESTED-CLOSED`.',
  ],
  KC09: [
    'Aplicar `→I` cerrando una subprueba que abre con el antecedente y termina en el consecuente.',
    'Una derivación aceptada en la que el condicional se justifica con `→I` citando la subprueba completa, no una línea suelta.',
  ],
  KC10: [
    'Obtener `⊥` con `¬E` a partir de una fórmula y su negación.',
    'Una derivación aceptada en la que `⊥` se justifica con `¬E` citando ambas líneas.',
  ],
  KC11: [
    'Aplicar `¬I` cerrando en `⊥` una subprueba que abre con el supuesto que se quiere negar.',
    'Una derivación aceptada en la que la negación se justifica con `¬I` sobre una subprueba que termina en `⊥`.',
  ],
  KC12: [
    'Aplicar `X` para obtener cualquier fórmula a partir de `⊥`.',
    'Una derivación aceptada en la que la línea se justifica con `X` citando una línea con `⊥` accesible.',
  ],
  KC13: [
    'Aplicar `∨E` con las dos subpruebas que llevan cada disyunto a la misma conclusión.',
    'Una derivación aceptada en la que la conclusión se justifica con `∨E` citando la disyunción y las dos subpruebas completas.',
  ],
  KC14: [
    'Aplicar `↔I` con las dos subpruebas recíprocas.',
    'Una derivación aceptada en la que el bicondicional se justifica con `↔I` citando ambas subpruebas.',
  ],
  KC15: [
    'Aplicar `↔E` en cualquiera de sus dos direcciones.',
    'Una derivación aceptada con `↔E` citando el bicondicional y el lado disponible.',
  ],
  KC16: [
    'Aplicar `DNE` para eliminar exactamente dos negaciones.',
    'Una derivación aceptada con `DNE` sobre una línea de la forma `¬¬A`; aplicarla sobre otra forma produce `E-RULE-SHAPE`.',
  ],
  KC17: [
    'Aplicar `IP` cuando la vía directa no prospera: suponer la negación de la meta y cerrar en `⊥`.',
    'Una derivación aceptada en la que la meta se justifica con `IP` sobre una subprueba que abre con su negación y termina en `⊥`.',
  ],
  KC18: [
    'Elegir estrategia ante una meta: trabajar hacia atrás desde el operador principal de la conclusión, hacia adelante desde lo disponible, o indirectamente.',
    'El alumno enuncia, antes de escribir la derivación, qué regla planea usar en la última línea y qué submetas abre; la derivación posterior es aceptada.',
  ],
};

/**
 * Matriz de activación: una regla por entrada del catálogo, con el nivel de la
 * jerarquía de §8.3.1 en el que actúa y **la señal observable** que la dispara.
 * Ninguna se activa en `MEASUREMENT_MODE`, que es lo que el módulo comprueba y
 * lo que §5.9 exige: medir con ayuda encendida deja de medir.
 */
const REGLAS_ACTIVACION = [
  ['ar-01', 4, 'explicacion_directa_breve', 'el KC objetivo no tiene intentos previos en la sesión'],
  ['ar-02', 4, 'ejemplo_trabajado', 'tras la explicación directa, antes del primer intento del alumno'],
  ['ar-03', 4, 'ejemplo_incompleto', 'el alumno completó el ejemplo trabajado sin error'],
  ['ar-04', 4, 'practica_guiada', 'el alumno completó el ejemplo incompleto sin error'],
  ['ar-05', 4, 'practica_independiente', 'el alumno resolvió la práctica guiada sin ayuda decisiva'],
  [
    'ar-06',
    4,
    'comprobacion_de_transferencia_cercana',
    'el alumno resolvió práctica independiente del KC, o hay sospecha de dominio aparente tras un intento sin ayuda',
  ],
  [
    'ar-07',
    4,
    'scaffolding_contingente',
    'el intento del alumno falla parcialmente: la derivación avanza pero una línea es rechazada',
  ],
  [
    'ar-08',
    5,
    'fading_contingente',
    'el alumno resuelve con el nivel de ayuda actual: se baja `assistanceLevel` un escalón',
  ],
  [
    'ar-09',
    4,
    'feedback_correctivo',
    'el verificador rechaza una línea: el feedback se centra en la tarea y el proceso, con el código `E-*` devuelto',
  ],
  [
    'ar-10',
    4,
    'autoexplicacion_guiada',
    'un paso correcto no trivial, un error persistente del mismo tipo, o duda entre comprensión y memorización de patrón',
  ],
  [
    'ar-11',
    2,
    'recuperacion_de_prerrequisito',
    'un KC del que depende formalmente el objetivo no está dominado: el avance del KC actual se suspende',
  ],
  [
    'ar-12',
    4,
    'retrieval_practice',
    'el calendario programa recuperación de un KC ya introducido por primera enseñanza',
  ],
];

/**
 * Fading. La única regla es contingente al desempeño: no hay ninguna que retire
 * ayuda por minutos o por número de ejercicios, así que la excepción de §8.3.2
 * —que exigiría preinscripción y validación expresa— **no se usa**. Registrar
 * una regla por reloj sin esa evidencia mediría cuánto aguanta el alumno sin
 * ayuda, no cuánto ha aprendido.
 */
const REGLAS_FADING = [
  {
    ruleId: 'fad-01',
    triggeredByFixedTimeOrCount: false,
    contingentOnPerformance: true,
  },
];

const POLITICA_AUTOEXPLICACION = {
  triggers: [
    'despues_de_paso_correcto_no_trivial',
    'tras_error_persistente',
    'para_distinguir_comprension_de_memorizacion',
  ],
  everyStep: false,
  anchoredToKc: true,
};

/** Plantillas de sesión, de autoexplicación y de feedback de tarea (§7.2, §8.3.3). */
const PLANTILLA_AUTOEXPLICACION = {
  templateId: 'plt-autoexplicacion-v1',
  appliesTo: 'autoexplicacion_guiada',
  prompt:
    '¿Por qué la línea {linea} se sigue de {citadas} por {regla}? Responde sobre {kcNombre}, no sobre el resultado.',
  placeholders: ['linea', 'citadas', 'regla', 'kcNombre'],
  anchoredToKc: true,
  note: 'El prompt es dirigido y anclado al KC (§8.3.3). Su respuesta sirve para diagnóstico y adaptación; **no sustituye al verificador formal**.',
};

const PLANTILLA_FEEDBACK = {
  templateId: 'plt-feedback-tarea-v1',
  appliesTo: 'feedback_correctivo',
  prompt:
    'La línea {linea} fue rechazada con {codigo}. Lo que el verificador señala es {detalle}. Revisa {que_revisar} antes del siguiente intento.',
  placeholders: ['linea', 'codigo', 'detalle', 'que_revisar'],
  note: 'Centrado en tarea y proceso (§5.10). El código `E-*` y el detalle los pone el verificador: el agente no los redacta ni los reinterpreta.',
};

function leerJsonConCabecera(ruta) {
  return JSON.parse(readFileSync(ruta, 'utf8').replace(/^(#[^\n]*\n)+/, ''));
}

function escribirYaml(ruta, cabecera, datos) {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, `# ${cabecera}\n${JSON.stringify(datos, null, 2)}\n`);
  console.log(`  escrito: ${ruta.slice(CONTENIDO.length + 1)}`);
}

/**
 * Orden topológico determinista sobre el mapa de KC: en cada paso entra el
 * menor id disponible cuyas dependencias ya entraron. Determinista porque el
 * desempate es por id, y la secuencia es un artefacto congelado.
 */
function secuenciaTopologica(nodos) {
  const dependencias = new Map(
    nodos.map((n) => [n.kcId, (n.dependencies ?? []).map((d) => d.on)]),
  );
  const orden = [];
  const dentro = new Set();

  while (orden.length < nodos.length) {
    const listos = nodos
      .map((n) => n.kcId)
      .filter((id) => !dentro.has(id) && dependencias.get(id).every((on) => dentro.has(on)))
      .sort();
    const siguiente = listos[0];
    if (siguiente === undefined) {
      const pendientes = nodos.map((n) => n.kcId).filter((id) => !dentro.has(id));
      throw new Error(
        `El mapa de KC no admite orden topológico: quedan ${pendientes.join(', ')} con ` +
          `dependencias sin satisfacer. Un ciclo aquí sería una secuencia de enseñanza imposible.`,
      );
    }
    orden.push(siguiente);
    dentro.add(siguiente);
  }
  return orden;
}

function main() {
  console.log(`Rol B en vivo — ${AHORA}`);

  // ── 1/5 Mapa de KC y secuencia derivada ───────────────────────────────────
  console.log('1/5 Derivando la secuencia de enseñanza del mapa de KC…');
  const mapa = leerJsonConCabecera(join(CONTENIDO, 'kc/map.yaml'));
  const secuencia = secuenciaTopologica(mapa.nodes);
  const posicion = new Map(secuencia.map((kcId, i) => [kcId, i + 1]));

  // Comprobación arista por arista: la secuencia derivada no vale por serlo.
  // Las posiciones se resuelven **antes** de compararlas y un id que no esté en
  // la secuencia aborta: la primera versión de esta guarda leía un campo que el
  // artefacto no tiene (`on` en vez de `to`), y `undefined >= undefined` es
  // falso, así que daba las 42 aristas por respetadas sin mirar ninguna. Una
  // comparación con `undefined` no falla: pasa.
  for (const arista of mapa.edges) {
    const desde = posicion.get(arista.from);
    const hacia = posicion.get(arista.to);
    if (desde === undefined || hacia === undefined) {
      throw new Error(
        `La arista ${JSON.stringify(arista)} no resuelve a dos KC de la secuencia. Comparar ` +
          `posiciones indefinidas no falla: pasa, y la comprobación se apagaría sola.`,
      );
    }
    if (hacia >= desde) {
      throw new Error(
        `La secuencia pone ${arista.from} (posición ${desde}) antes que su dependencia ` +
          `${arista.to} (posición ${hacia}), arista ${arista.type}.`,
      );
    }
  }
  console.log(`  ${secuencia.length} KC en orden, ${mapa.edges.length} aristas respetadas`);

  // ── 2/5 Catálogo y matriz de activación ───────────────────────────────────
  console.log('2/5 Validando catálogo, matriz de activación y fading…');
  assertCatalogMatchesContracts();

  const matriz = {
    policyVersion: POLICY_VERSION,
    rules: REGLAS_ACTIVACION.map(([ruleId, level, catalogEntryId, whenObservable]) => ({
      ruleId,
      level,
      catalogEntryId,
      modes: ['LEARNING_MODE'],
      whenObservable,
    })),
  };
  assertActivationMatrix(matriz);

  // Una regla por entrada del catálogo: una entrada sin regla no se activaría
  // nunca, y el hueco no aparecería hasta la sesión en que hiciera falta.
  const activables = new Set(matriz.rules.map((r) => r.catalogEntryId));
  const sinRegla = STRATEGY_CATALOG.map((e) => e.catalogEntryId).filter((id) => !activables.has(id));
  if (sinRegla.length > 0) {
    throw new Error(`Entradas del catálogo sin regla de activación: ${sinRegla.join(', ')}.`);
  }

  assertFadingPolicy(REGLAS_FADING);
  assertSelfExplanationPolicy(POLITICA_AUTOEXPLICACION);
  console.log(`  ${matriz.rules.length} reglas sobre ${STRATEGY_CATALOG.length} entradas, 0 en MEASUREMENT_MODE`);

  // ── 3/5 Objetivos observables ─────────────────────────────────────────────
  console.log('3/5 Validando objetivos observables…');
  const objetivos = secuencia.map((kcId) => {
    const declarado = OBJETIVOS[kcId];
    if (declarado === undefined) {
      throw new Error(`El KC ${kcId} no tiene objetivo declarado. Declarado, nunca omitido.`);
    }
    const [statement, observableEvidence] = declarado;
    return { kcId, statement, observableEvidence };
  });
  assertObservableObjectives(objetivos, secuencia);
  console.log(`  ${objetivos.length}/${secuencia.length} KC con objetivo y evidencia observable`);

  // ── 4/5 Plan de retrieval/spacing ─────────────────────────────────────────
  console.log('4/5 Validando el plan de retrieval/spacing…');
  // El plan se lleva **por bloque**, no por KC suelto. Con una entrada por KC,
  // `alreadyIntroduced` saldría cierta por construcción y el control pasaría por
  // vacío (D-18): la comprobación de §8.3.4 no puede depender de un campo que
  // nadie puede poner en falso. Aquí la elegibilidad se deriva de comparar dos
  // posiciones de la secuencia, así que un bloque mal colocado la vuelve falsa.
  const bloques = secuencia.map((kcId, indice) => ({
    blockPosition: indice + 1,
    teaches: kcId,
    eligibleForRetrieval: secuencia.slice(0, indice),
  }));
  const planRetrieval = bloques.flatMap((bloque) =>
    bloque.eligibleForRetrieval.map((kcId) => ({
      kcId,
      alreadyIntroduced: posicion.get(kcId) < bloque.blockPosition,
      usesMeasurementReserve: false,
    })),
  );
  assertRetrievalPlan(planRetrieval);
  console.log(
    `  ${bloques.length} bloques y ${planRetrieval.length} pares (bloque, KC) elegibles, ` +
      `ninguno consume reserva de medición`,
  );

  // ── 5/5 Materialización ───────────────────────────────────────────────────
  console.log('5/5 Escribiendo objectives/, pedagogy/ y session-templates/…');
  const cabecera = (qué) =>
    `${qué} (T-H5-04, Rol B). Corrida del ${AHORA} sobre kc/map.yaml. ` +
    `Redactado por el modelo asistente (salvedad D-41/D-48/D-52): el propietario audita ` +
    `objetivos y señales observables antes del freeze de W5.`;

  escribirYaml(
    join(CONTENIDO, 'objectives/objectives.yaml'),
    cabecera('Objetivos observables y secuencia de enseñanza'),
    {
      policyVersion: POLICY_VERSION,
      courseId: 'unidad-deduccion-natural',
      mapVersion: mapa.mapVersion,
      teachingSequence: secuencia,
      sequenceDerivation:
        'Orden topológico determinista sobre kc/map.yaml, desempate por id, comprobado arista por arista. No se escribe a mano.',
      objectives: objetivos,
    },
  );

  escribirYaml(
    join(CONTENIDO, 'pedagogy/strategy-catalog.yaml'),
    cabecera('Catálogo de estrategias, cerrado y de doce'),
    {
      policyVersion: POLICY_VERSION,
      catalogSize: STRATEGY_CATALOG.length,
      note: 'Proyección de STRATEGY_CATALOG, que se deriva de P-I §5.10 y del enum de P-II §7.2.1. Dos entradas no tienen miembro de enum y declaran por dónde se expresan; el catálogo no admite categorías nuevas con autoridad operativa.',
      decisionHierarchy: [...DECISION_HIERARCHY],
      entries: STRATEGY_CATALOG.map((e) => ({ ...e })),
    },
  );

  escribirYaml(
    join(CONTENIDO, 'pedagogy/selection-rules.yaml'),
    cabecera('Matriz de activación de estrategias y reglas de transición'),
    {
      ...matriz,
      note: 'Ninguna regla se activa en MEASUREMENT_MODE: §5.9 deshabilita ahí la ayuda no autorizada y §8.3.1 pone el modo pedagógico por encima de la selección de estrategia.',
      basePatterns: BASE_PATTERNS.map((p) => ({ ...p, steps: p.steps.map((s) => ({ ...s })) })),
      kcProfileNote:
        'El perfil se lleva por KC. El Maestro pide «perfil pedagógico por KC/tipo de conocimiento» (§7.2) y no define en ninguna parte qué tipos de conocimiento hay: no se inventa la taxonomía, se registra el hueco.',
      kcProfiles: secuencia.map((kcId) => ({
        kcId,
        sequencePosition: posicion.get(kcId),
        foundation: mapa.foundationKcs.includes(kcId),
        firstTeachingPattern: 'kc_procedimental_nuevo',
      })),
    },
  );

  escribirYaml(
    join(CONTENIDO, 'pedagogy/assistance-policy.yaml'),
    cabecera('Política de ayudas, scaffolding y fading contingente'),
    {
      policyVersion: POLICY_VERSION,
      fadingRules: REGLAS_FADING,
      fadingNote:
        'Ninguna regla retira ayuda por un número fijo de minutos o ejercicios, así que la excepción de §8.3.2 —preinscripción y validación expresa— no se usa. El fading se expresa bajando `assistanceLevel`, que es campo del contrato de P-II §7.2.1.',
      selfExplanation: POLITICA_AUTOEXPLICACION,
      templates: [PLANTILLA_AUTOEXPLICACION, PLANTILLA_FEEDBACK],
    },
  );

  escribirYaml(
    join(CONTENIDO, 'pedagogy/retrieval-spacing.yaml'),
    cabecera('Plan de retrieval y spacing'),
    {
      policyVersion: POLICY_VERSION,
      blocks: bloques,
      eligiblePairs: planRetrieval.length,
      note: 'Las dos reglas de §8.3.4: la recuperación actúa sobre conocimiento ya introducido y no sustituye a la primera enseñanza, y la revisión espaciada nunca consume reserva de medición —una enseña, la otra mide y permanece aislada—.',
      structureNote:
        'El plan va por bloque y no por KC suelto: con una entrada por KC, «ya introducido» saldría cierto por construcción y el control pasaría por vacío. Aquí se deriva de comparar la posición del KC con la del bloque, así que un bloque mal colocado lo vuelve falso.',
      intervalNote:
        'Aquí no se fija ningún intervalo: §8.3.4 dice que la programación «corresponde al motor/calendario», y el sobre lo congela el calendario SCED de T-H5-11. Escribir un número sería fabricar una calibración que nadie congeló.',
    },
  );

  escribirYaml(
    join(CONTENIDO, 'pedagogy/shadow-metrics.yaml'),
    cabecera('Métricas sombra (BKT opcional, sin autoridad)'),
    {
      policyVersion: POLICY_VERSION,
      note: 'Proyección literal de BKT_SHADOW_H5_CONFIGURATION (T-H5-16, DEC-BKT-001/CAL-11): deshabilitado, sin parámetros y sin superficie de lectura para la sesión. Habilitarlo exige calibración incorporada, no un cambio en este archivo.',
      bktShadow: { ...BKT_SHADOW_H5_CONFIGURATION },
    },
  );

  escribirYaml(
    join(CONTENIDO, 'session-templates/base-patterns.yaml'),
    cabecera('Plantillas de sesión derivadas de los patrones base de §8.3.2'),
    {
      policyVersion: POLICY_VERSION,
      note: 'Proyección de BASE_PATTERNS. Los pasos que son acciones del motor no se convierten en estrategia: inventarles una afirmaría una decisión pedagógica donde solo hay una transición, y quien las implementa es F7.',
      patterns: BASE_PATTERNS.map((p) => ({
        patternId: p.patternId,
        steps: p.steps.map((s) => ({ ...s })),
      })),
      selfExplanationTemplate: PLANTILLA_AUTOEXPLICACION,
      taskFeedbackTemplate: PLANTILLA_FEEDBACK,
    },
  );

  console.log('Rol B completado.');
}

main();
