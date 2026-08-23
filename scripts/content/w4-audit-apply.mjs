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

import {
  AUDIT_CODEBOOK,
  KC_CATALOG,
  evaluatePreAudit,
} from '../../packages/authoring-core/dist/index.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CONTENIDO = join(RAIZ, 'content/unidad-deduccion-natural');
const AHORA = new Date().toISOString();

const AUDITOR = 'modelo asistente (anthropic-claude) — NO independiente del generador';

/**
 * Defectos de etiqueta de KC, **derivados** y no escritos a mano.
 *
 * La corrida anterior los traía como una lista literal, con la nota de que
 * salían «de recorrer cada certificado». Eso hacía la conclusión imposible de
 * repetir: si un reactivo nuevo perdía su regla, la lista no se enteraba. Aquí
 * se recorre de verdad — por cada reactivo aceptado, si el KC que declara tiene
 * `ruleId`, esa regla tiene que aparecer en alguna línea de su certificado.
 *
 * **Se miran las líneas del certificado, no `rulesUsed`.** `rulesUsed` sale del
 * término de derivación y la reiteración se inserta al linealizar, así que `R`
 * no aparece ahí ni cuando la prueba la usa: quien pregunte por `rulesUsed`
 * concluiría que **ningún** reactivo de KC03 ejercita su regla.
 *
 * KC01, KC02, KC08 y KC18 no tienen `ruleId` en el catálogo —son de notación,
 * alcance y estrategia— y por eso no entran: exigirles una regla concreta sería
 * inventarles una que el Maestro no les da.
 */
function defectosDeEtiquetaKc(poblacion, soluciones) {
  const certificadoPorId = new Map(soluciones.map((s) => [s.itemId, s.certificate]));
  const defectos = [];
  let comprobados = 0;

  for (const artefacto of poblacion) {
    const regla = KC_CATALOG[artefacto.kcId]?.ruleId;
    if (regla === undefined) continue;
    const certificado = certificadoPorId.get(artefacto.artifactId);
    if (certificado === undefined) {
      throw new Error(
        `${artefacto.artifactId} está en la población auditada y no tiene certificado. Sin él, la ` +
          `comprobación de etiqueta pasaría por vacío justo en el reactivo que no se puede mirar.`,
      );
    }
    comprobados += 1;
    const reglas = [...new Set(certificado.lines.map((l) => l.rule))];
    if (reglas.includes(regla)) continue;
    defectos.push({
      artifactId: artefacto.artifactId,
      severity: 'major',
      code: 'incorrect_kc_label',
      canChangeAnswerOrVerdict: false,
      canContaminateMeasureLeakOrTeachFalseRule: true,
      scope: 'local',
      rationale:
        `El reactivo declara ${artefacto.kcId} (regla ${regla}) y su certificado no usa ${regla} en ` +
        `ninguna línea. Un alumno que lo resuelva no habrá ejercitado la regla que el reactivo dice ` +
        `medir, y la cobertura de ${artefacto.kcId} contaría una oportunidad que no lo es. ` +
        `Evidencia: reglas del certificado = ${reglas.join(', ')}.`,
    });
  }
  return { defectos, comprobados };
}

/**
 * Lo que se observó y **no** tiene código en el libro cerrado. Se registra
 * aparte en vez de forzarlo dentro de un código que no le corresponde: el
 * libro es cerrado por el mismo motivo que la lista de `E-*`, y meter aquí un
 * código nuevo sería ampliar por la puerta de atrás lo que el auditor evalúa.
 */
/**
 * Lo que se observó y **no** tiene código en el libro cerrado, **derivado de la
 * corrida de W3 en disco**.
 *
 * La corrida anterior lo traía como una lista literal —«KC09 se quedó sin
 * reactivo de transferencia»— y esa frase sobrevivió al banco que la hacía
 * cierta: D-68 regeneró W3, KC09 recuperó su transferencia y `coverageGaps`
 * quedó vacío, pero la lista no se enteró. Un informe de auditoría que publica
 * una carencia que ya no existe es exactamente el defecto que la auditoría
 * busca en otros, así que se deriva.
 *
 * Se registra aparte de `judgments` en vez de forzarlo dentro de un código que
 * no le corresponde: el libro es cerrado por el mismo motivo que la lista de
 * `E-*`, y meter aquí un código nuevo ampliaría por la puerta de atrás lo que el
 * auditor evalúa.
 */
function observacionesSinCodigo(corrida) {
  const observaciones = [];

  for (const hueco of corrida.coverageGaps ?? []) {
    observaciones.push({
      alcance: hueco.kcId ?? hueco.setId ?? 'banco',
      observacion:
        `La corrida de W3 declara el hueco de cobertura \`${hueco.code ?? 'COV'}\`: ` +
        `${String(hueco.detail ?? JSON.stringify(hueco)).replace(/\.$/, '')}.`,
      porQueNoLlevaCodigo:
        'Es un hueco de cobertura declarado por la corrida de W3, no un defecto de un reactivo ' +
        'concreto: no hay reactivo al que asignarle un código del libro.',
      consecuencia: 'Se arregla completando el banco, no corrigiendo un reactivo.',
    });
  }

  for (const reserva of corrida.probeReservesNotGenerated ?? []) {
    observaciones.push({
      alcance: reserva.kcId ?? 'banco',
      observacion:
        `No se generó la reserva \`${reserva.reserve ?? reserva.bankFunction}\`: ` +
        `${(reserva.reason ?? 'sin motivo declarado').replace(/\.$/, '')}.`,
      porQueNoLlevaCodigo:
        'Es una consecuencia declarada del cálculo y de la secuencia congelada —la reserva no ' +
        'existe—, no un reactivo defectuoso. Auditar lo que no se generó no tiene objeto; lo que ' +
        'hay que decidir es si el diseño experimental lo admite.',
      consecuencia:
        'El conjunto experimental que lleve ese KC como objetivo trae menos sondas primarias. La ' +
        'selección A/B/C lo registra y comprueba que sigue por encima del piso del calendario.',
    });
  }

  if (observaciones.length === 0) {
    observaciones.push({
      alcance: 'banco',
      observacion:
        'La corrida de W3 no declara huecos de cobertura ni reservas sin generar, así que no hay ' +
        'nada observado fuera del libro de códigos.',
      porQueNoLlevaCodigo: 'No hay observación que codificar.',
      consecuencia:
        'Ninguna. **Esto no dice que el paquete esté bien**: dice que W3 no dejó carencias ' +
        'declaradas, que es un dato distinto del de la lectura humana pendiente.',
    });
  }

  return observaciones;
}

/*
 * La observación sobre las pistas de la corrida anterior —«las tres pistas son
 * idénticas en los 97 reactivos»— **ya no describe este paquete**: se derivan del
 * enunciado desde esta corrida de W3. No se conserva aquí porque el informe
 * describe lo que se auditó hoy; el rastro de que existió está en PLAN_STATUS.
 */


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
  const soluciones = leerJsonConCabecera('solutions-private/w3-solutions.yaml').privateSolutions;
  const familiaPorId = new Map(muestra.population.map((p) => [p.artifactId, p.itemFamilyId]));

  // La muestra tiene que ser de **esta** corrida de W3. Un informe computado
  // sobre una población vieja cuadraría igual —el gate divide por el denominador
  // que le den— y estaría midiendo un banco que ya no existe.
  const corrida = leerJsonConCabecera('audits/w3-run.yaml');
  const aceptados = new Set(
    corrida.items.filter((item) => item.accepted).map((item) => item.candidateId),
  );
  const poblacion = new Set(muestra.population.map((p) => p.artifactId));
  const faltan = [...aceptados].filter((id) => !poblacion.has(id));
  const sobran = [...poblacion].filter((id) => !aceptados.has(id));
  if (faltan.length > 0 || sobran.length > 0) {
    throw new Error(
      `la muestra de W4 no corresponde a la corrida de W3 en disco: ${faltan.length} aceptados sin ` +
        `auditar y ${sobran.length} auditados que ya no existen. Vuelve a correr ` +
        `\`w4-preaudit-run.mjs\` antes de juzgar.`,
    );
  }

  const { defectos, comprobados } = defectosDeEtiquetaKc(muestra.population, soluciones);
  console.log(
    `0/2 Etiqueta de KC: ${comprobados} certificados recorridos, ${defectos.length} defecto(s).`,
  );

  const judgments = defectos.map((d) => {
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
      // **Qué se comprobó de verdad, y qué no.** Un informe con cero defectos
      // se lee como «todo bien», y aquí lo único que se recorrió a máquina son
      // las etiquetas de KC. Los demás códigos del libro —fuga, notación,
      // correspondencia con el objetivo— siguen dependiendo de una lectura, y
      // la lectura que hubo no es independiente. Sin este apartado, el cero
      // afirmaría algo que nadie comprobó.
      checksApplied: [
        {
          check: 'etiqueta_de_kc',
          codes: ['incorrect_kc_label'],
          mechanical: true,
          coverage: `${comprobados} de ${muestra.population.length} reactivos — los que declaran un KC con \`ruleId\` en el catálogo; KC01, KC02, KC08 y KC18 no lo tienen`,
          method:
            'Por cada reactivo aceptado cuyo KC declara `ruleId`, esa regla debe aparecer en alguna ' +
            'línea de su certificado. Se leen las líneas, no `rulesUsed`: la reiteración se inserta ' +
            'al linealizar y no consta en el término.',
        },
        {
          check: 'resto_del_libro_de_codigos',
          codes: [
            ...AUDIT_CODEBOOK.critical,
            ...AUDIT_CODEBOOK.major,
            ...AUDIT_CODEBOOK.minor,
          ].filter((code) => code !== 'incorrect_kc_label'),
          mechanical: false,
          coverage: 'ninguna comprobación automática',
          method:
            'Requieren lectura. La de esta corrida la hizo el mismo modelo que generó el material, ' +
            'así que **no cuenta como evidencia de calidad** (§7.3): el cero de esta fila significa ' +
            '«no se halló», no «se comprobó y no hay».',
        },
      ],
      judgments,
      observationsWithoutCode: observacionesSinCodigo(corrida),
      gateReport: informe,
    },
  );

  console.log('W4 — auditoría registrada. La firma sigue pendiente.');
}

main();
