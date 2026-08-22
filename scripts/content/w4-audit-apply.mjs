#!/usr/bin/env node
/**
 * Juicios de la auditoría previa de W4 (F6/H5, T-H5-14) y cómputo del gate.
 *
 * Uso: node scripts/content/w4-audit-apply.mjs
 *
 * **Qué es y qué no es esta auditoría.** La hizo el modelo asistente, que es el
 * mismo que redactó las plantillas, las pistas y las críticas. Eso no la
 * invalida —encuentra lo que encuentra— pero **no cierra el gate**: P-I §7.3
 * dice que el acuerdo de un crítico no independiente «no puede usarse como
 * evidencia de calidad», y P-III §6.2 exige auditoría humana en muestra ciega.
 * Lo que hace es dejar el trabajo hecho para que la lectura del propietario sea
 * una comprobación y no un descubrimiento desde cero.
 *
 * Los hallazgos que van aquí son los que se sostienen con **evidencia
 * comprobable**, no con impresiones: se derivan de los certificados y del
 * canonicalizador, y cada uno dice de dónde sale.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePreAudit } from '../../packages/authoring-core/dist/index.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CONTENIDO = join(RAIZ, 'content/unidad-deduccion-natural');
const AHORA = new Date().toISOString();

const AUDITOR = 'modelo asistente (anthropic-claude) — NO independiente del generador';

/**
 * Defectos hallados, con el código cerrado que les corresponde.
 *
 * Solo uno, y sale de una comprobación mecánica: recorrer cada certificado y
 * ver si la regla que el KC declara aparece en él. 96 de 97 la usan.
 */
const DEFECTOS = [
  {
    artifactId: 'kc03-transf',
    severity: 'major',
    code: 'incorrect_kc_label',
    canChangeAnswerOrVerdict: false,
    canContaminateMeasureLeakOrTeachFalseRule: true,
    scope: 'local',
    rationale:
      'El reactivo declara KC03 (reiteración, regla R) y su certificado no usa R en ninguna línea: ' +
      'el buscador obtiene el antecedente por ∧E dentro de la subprueba y cierra con →I. Un alumno ' +
      'que lo resuelva no habrá ejercitado la regla que el reactivo dice medir, y la cobertura de ' +
      'KC03 contaría una oportunidad que no lo es. Evidencia: reglas del certificado = →I, ∧E.',
  },
];

/**
 * Lo que se observó y **no** tiene código en el libro cerrado. Se registra
 * aparte en vez de forzarlo dentro de un código que no le corresponde: el
 * libro es cerrado por el mismo motivo que la lista de `E-*`, y meter aquí un
 * código nuevo sería ampliar por la puerta de atrás lo que el auditor evalúa.
 */
const OBSERVACIONES_SIN_CODIGO = [
  {
    alcance: 'las 97 pistas de nivel 3',
    observacion:
      'Las tres pistas son idénticas en los 97 reactivos: no mencionan el reactivo concreto, así ' +
      'que no pueden filtrar la solución —y por eso pasan la comprobación de fuga— pero tampoco ' +
      'ayudan de forma específica. §8.6 pide para el nivel 3 «indicar el siguiente tipo de operación ' +
      'sin resolverla», y una pista igual para todos no indica nada del reactivo que se tiene ' +
      'delante.',
    porQueNoLlevaCodigo:
      'El libro de códigos cubre la pista que resuelve de más (`hint_practically_solves`), no la que ' +
      'ayuda de menos. Inventar un código sería ampliar lo que el auditor evalúa.',
    consecuencia:
      'No bloquea el gate. Conviene resolverlo antes del freeze: las pistas deberían derivarse del ' +
      'reactivo, no ser una plantilla constante.',
  },
  {
    alcance: 'KC09',
    observacion:
      'Se quedó sin reactivo de transferencia porque su forma fue rechazada por desajuste de ' +
      'complejidad. Los otros 17 KC tienen el suyo, y los 17 son estructuralmente distintos de sus ' +
      'reactivos de práctica: ni duplicado trivial ni isomorfo bajo la canonicalización congelada.',
    porQueNoLlevaCodigo:
      'Es un hueco de cobertura ya declarado en la corrida de W3, no un defecto de un reactivo.',
    consecuencia: 'Ya cuenta como hueco `COV-KC-TRANSFER` y se arregla completando el banco.',
  },
];

function leerJsonConCabecera(ruta) {
  return JSON.parse(readFileSync(join(CONTENIDO, ruta), 'utf8').replace(/^(#[^\n]*\n)+/, ''));
}

function escribirYaml(ruta, cabecera, datos) {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, `# ${cabecera}\n${JSON.stringify(datos, null, 2)}\n`);
  console.log(`  escrito: ${ruta.slice(CONTENIDO.length + 1)}`);
}

function main() {
  console.log(`W4 — juicios de auditoría — ${AHORA}`);

  const muestra = leerJsonConCabecera('audits/w4-preaudit-sample.yaml');
  const familiaPorId = new Map(muestra.population.map((p) => [p.artifactId, p.itemFamilyId]));

  const judgments = DEFECTOS.map((d) => {
    const itemFamilyId = familiaPorId.get(d.artifactId);
    if (itemFamilyId === undefined) {
      throw new Error(`${d.artifactId} no está en la población auditada.`);
    }
    return { ...d, itemFamilyId };
  });

  // Se revisó la muestra entera: era censo, así que revisar «lo seleccionado»
  // y «todo» es lo mismo. Declararlo explícito evita que el gate compute sobre
  // un denominador distinto del que se leyó.
  const revisados = muestra.sample.selectedArtifactIds;

  console.log(`1/2 Evaluando: ${revisados.length} revisados, ${judgments.length} defecto(s)…`);
  const informe = evaluatePreAudit(muestra.sample, muestra.population, revisados, judgments);

  console.log(`  bloqueado: ${informe.blocked}`);
  console.log(
    `  críticos ${informe.critical.count}/${informe.critical.denominator} · ` +
      `mayores ${informe.major.count}/${informe.major.denominator} (${informe.major.percent.toFixed(2)} %) · ` +
      `menores ${informe.minor.count}/${informe.minor.denominator} (${informe.minor.percent.toFixed(2)} %)`,
  );
  for (const razon of informe.reasons) console.log(`  · ${razon}`);

  console.log('2/2 Escribiendo el informe…');
  escribirYaml(
    join(CONTENIDO, 'audits/w4-audit-report.yaml'),
    `Informe de auditoría previa (T-H5-14). Corrida del ${AHORA}. ` +
      `AUDITOR: ${AUDITOR}. **No cierra el gate**: P-I §7.3 y P-III §6.2 exigen lectura humana en ` +
      `muestra ciega, y aquí auditor y generador son el mismo modelo.`,
    {
      auditedAt: AHORA,
      auditor: AUDITOR,
      independent: false,
      closesGate: false,
      closesGateReason:
        'Auditor y generador son el mismo modelo. §7.3: el acuerdo de un crítico no independiente no ' +
        'puede usarse como evidencia de calidad para congelar la familia. Este informe adelanta el ' +
        'trabajo; la firma sigue siendo del propietario.',
      reviewedArtifactIds: revisados,
      judgments,
      observationsWithoutCode: OBSERVACIONES_SIN_CODIGO,
      gateReport: informe,
    },
  );

  console.log('W4 — auditoría registrada. La firma sigue pendiente.');
}

main();
