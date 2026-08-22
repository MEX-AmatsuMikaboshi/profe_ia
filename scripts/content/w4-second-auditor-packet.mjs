#!/usr/bin/env node
/**
 * Paquete para el **segundo auditor independiente** (F6/H5, T-H5-14).
 *
 * Uso: node scripts/content/w4-second-auditor-packet.mjs
 *
 * **Qué instrumento es este, y cuál no.** El Maestro §11.7 admite preinscribir
 * «un segundo auditor independiente en una submuestra de calibración/
 * adjudicación», y §I.145 exige que el crítico generativo que contribuya al gate
 * de autoría sea de **familia distinta** del generador. Este paquete es
 * exactamente eso: una submuestra preinscrita para un crítico de otra familia.
 *
 * **No sustituye** el paso 19 del pipeline de contenido —«ejecuta auditoría
 * humana por muestra sobre el paquete candidato»—, que sigue pidiendo una
 * persona. Lo que hace es que esa lectura sea una comprobación y no un
 * descubrimiento desde cero, y que exista por fin un juicio que **sí** cuenta
 * como evidencia de calidad, cosa que el del generador no puede ser.
 *
 * **El paquete va ciego, y eso es norma, no cortesía** (§13.4): el auditor
 * bloquea su primera decisión antes de ver el veredicto del sistema, y en
 * primera pasada se ocultan los metadatos de generador e historial que no hacen
 * falta. Por eso aquí no aparece quién generó el material, ni el resultado de la
 * auditoría previa, ni las banderas del crítico interno.
 *
 * **La selección se declara antes de mirar.** Semilla registrada, un reactivo de
 * enseñanza y uno de medición por cada uno de los dieciocho KC. Elegir a mano
 * qué se audita permite —sin querer— auditar justo lo que ya se sabe bueno.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AUDIT_CODEBOOK, KC_CATALOG } from '../../packages/authoring-core/dist/index.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CONTENIDO = join(RAIZ, 'content/unidad-deduccion-natural');
const AHORA = new Date().toISOString();

/** Semilla de la submuestra. Fija, para que volver a armarla dé lo mismo. */
const SEMILLA = 'w4-segundo-auditor-v1';

/** Reservas de enseñanza y de medición, según P-I §7.7. */
const ENSENANZA = new Set([
  'diagnostic',
  'guided_practice',
  'independent_practice',
  'recovery',
  'replacement',
  'TRANSFER_MASTERY',
]);
const MEDICION = new Set([
  'probes_baseline',
  'probes_intervention',
  'retention',
  'TRANSFER_MEASUREMENT',
]);

/**
 * Qué mira cada código del libro cerrado, dicho para quien no ha leído el
 * Maestro. **No son definiciones nuevas**: son las del codebook con la pregunta
 * que hay que hacerse delante del reactivo.
 */
const QUE_MIRAR = Object.freeze({
  incorrect_solution: 'La derivación adjunta ¿es correcta? ¿Alguna línea cita mal o no se sigue?',
  item_without_valid_solution: '¿Existe derivación válida para lo que el enunciado pide?',
  solution_leak: '¿El enunciado o alguna pista escribe un paso de la solución que no esté ya a la vista?',
  corpus_contradiction: '¿El reactivo afirma algo que contradiga el material del curso?',
  accepts_invalid_answer: '¿La forma en que está planteado admitiría como buena una respuesta que no lo es?',
  reused_or_contaminated_probe:
    '¿Esta sonda de medición repite, con otros nombres, un reactivo que el alumno ya practicó?',
  answer_changing_ambiguity: '¿El enunciado admite dos lecturas que llevan a respuestas distintas?',
  difficulty_outside_declared_level:
    '¿La dificultad real corresponde al nivel declarado (baja/media/alta)?',
  hint_practically_solves: '¿Alguna pista resuelve el reactivo en la práctica en vez de orientar?',
  incorrect_kc_label:
    '¿La derivación ejercita de verdad la regla que el reactivo dice enseñar? Es el defecto que ya apareció una vez.',
  inapplicable_rubric: '¿La rúbrica declarada sirve para puntuar esta respuesta?',
  wording_without_interpretation_change: 'Redacción mejorable que no cambia lo que se entiende.',
  inconsistent_format: 'Formato o notación distintos de los del resto del banco.',
  recoverable_incomplete_anchor: 'Una pista cita el material del curso de forma incompleta pero recuperable.',
  stylistic_detail: 'Detalle de estilo, sin consecuencia.',
});

function leerJsonConCabecera(ruta) {
  return JSON.parse(readFileSync(join(CONTENIDO, ruta), 'utf8').replace(/^(#[^\n]*\n)+/, ''));
}

function escribirYaml(ruta, cabecera, datos) {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, `# ${cabecera}\n${JSON.stringify(datos, null, 2)}\n`);
  console.log(`  escrito: ${ruta.slice(CONTENIDO.length + 1)}`);
}

/** Orden determinista dentro de un estrato. */
const rango = (id) => createHash('sha256').update(`${SEMILLA}:${id}`).digest('hex');

function main() {
  console.log(`W4 — paquete para el segundo auditor — ${AHORA}`);

  const corrida = leerJsonConCabecera('audits/w3-run.yaml');
  const soluciones = new Map(
    leerJsonConCabecera('solutions-private/w3-solutions.yaml').privateSolutions.map((s) => [
      s.itemId,
      s.certificate,
    ]),
  );

  // Los enunciados y las pistas viven en `items/`; el informe de la corrida no
  // los lleva, y el certificado vive aparte a propósito (I-2).
  const publicados = new Map();
  for (const carpeta of [
    'diagnostic',
    'guided-practice',
    'independent-practice',
    'recovery',
    'replacement',
    'transfer',
    'probes-baseline',
    'probes-intervention',
    'retention',
  ]) {
    for (const item of leerJsonConCabecera(`items/${carpeta}/items.yaml`).items) {
      publicados.set(item.candidateId, item);
    }
  }

  console.log('1/3 Seleccionando por semilla registrada…');
  const seleccionados = [];
  const sinCobertura = [];
  for (const kcId of Object.keys(KC_CATALOG)) {
    for (const [lado, reservas] of [
      ['ensenanza', ENSENANZA],
      ['medicion', MEDICION],
    ]) {
      const estrato = corrida.items
        .filter((i) => i.accepted && i.targetKcs.includes(kcId) && reservas.has(i.bankFunction))
        .sort((a, b) => rango(a.candidateId).localeCompare(rango(b.candidateId)));
      const elegido = estrato[0];
      if (elegido === undefined) {
        sinCobertura.push(`${kcId}/${lado}`);
        continue;
      }
      seleccionados.push({ kcId, lado, item: elegido });
    }
  }
  console.log(`  ${seleccionados.length} reactivos, ${sinCobertura.length} estratos sin cobertura`);
  if (sinCobertura.length > 0) console.log(`    · sin cobertura: ${sinCobertura.join(', ')}`);

  console.log('2/3 Armando el paquete ciego…');
  const artefactos = seleccionados.map(({ kcId, lado, item }) => {
    const publicado = publicados.get(item.candidateId);
    const certificado = soluciones.get(item.candidateId);
    if (publicado === undefined || certificado === undefined) {
      throw new Error(
        `${item.candidateId}: falta enunciado o certificado. Un artefacto incompleto en el paquete ` +
          `haría que el auditor juzgara por vacío justo el reactivo que no puede ver.`,
      );
    }
    const kc = KC_CATALOG[kcId];
    return {
      artifactId: item.candidateId,
      kcId,
      kcName: kc.name,
      // La regla que el reactivo **dice** ejercitar. Los KC de notación, alcance
      // y estrategia no tienen una: exigírsela sería inventarla.
      declaredRuleId: kc.ruleId ?? null,
      side: lado,
      bankFunction: item.bankFunction,
      declaredComplexity: item.targetComplexity,
      measuredComplexityTier: item.measuredComplexityTier,
      statement: publicado.statement,
      promptText: publicado.promptText,
      hints: publicado.hints.map((h) => ({ level: h.level, text: h.text })),
      // El certificado es lo que permite juzgar corrección y etiqueta de KC. Va
      // aquí y **no** en `items/`: el banco público no lleva soluciones.
      certificate: certificado.lines,
    };
  });

  console.log('3/3 Escribiendo…');
  escribirYaml(
    join(CONTENIDO, 'audits/w4-second-auditor-packet.yaml'),
    `Submuestra preinscrita para el segundo auditor independiente (T-H5-14, Maestro §11.7). ` +
      `Armada el ${AHORA} con la semilla ${SEMILLA}. **Paquete ciego** (§13.4): no lleva el ` +
      `veredicto del sistema ni metadatos de generador. Contiene soluciones: no debe entregarse a ` +
      `ningún modelo que vaya a conducir sesiones sobre este banco.`,
    {
      packetId: `w4-second-auditor-${SEMILLA}`,
      builtAt: AHORA,
      seed: SEMILLA,
      selectionRule:
        'Un reactivo de enseñanza y uno de medición por cada uno de los dieciocho KC, elegidos por ' +
        'el menor SHA-256 de «semilla:artifactId» dentro de su estrato. Declarado antes de mirar: ' +
        'elegir a mano qué se audita permite auditar justo lo que ya se sabe bueno.',
      blinding:
        'Primera pasada ciega. No se incluye el veredicto de la auditoría previa, ni la familia del ' +
        'modelo generador, ni las banderas del crítico interno.',
      strataWithoutCoverage: sinCobertura,
      codebook: {
        version: AUDIT_CODEBOOK.version,
        critical: AUDIT_CODEBOOK.critical,
        major: AUDIT_CODEBOOK.major,
        minor: AUDIT_CODEBOOK.minor,
        whatToLookFor: QUE_MIRAR,
        severityRule:
          'La severidad se fundamenta en tres preguntas (Maestro §11.7): si el defecto puede cambiar ' +
          'la respuesta o el veredicto; si puede contaminar la medición, revelar una solución o ' +
          'enseñar una regla falsa; y si parece local o señal de causa común del generador.',
      },
      calculus: {
        version: corrida.items[0]?.complexity?.authorizedCalculusVersion ?? 'authorized-calculus-v1',
        rules:
          'Deducción natural proposicional en formato Fitch. Reglas autorizadas: R, ∧I, ∧E, ∨I, ∨E, ' +
          '→I, →E, ↔I, ↔E, ¬I, ¬E, X, DNE, IP, PR (premisa), AS (supuesto). No hay precedencia ' +
          'entre conectivos binarios: los paréntesis son obligatorios salvo los externos. Están ' +
          'prohibidas conmutativa, asociativa y las formas normales.',
      },
      artifactCount: artefactos.length,
      artifacts: artefactos,
    },
  );

  console.log('Paquete listo.');
}

main();
