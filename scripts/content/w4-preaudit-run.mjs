#!/usr/bin/env node
/**
 * Corrida W4 en vivo (F6/H5, T-H5-14): muestra de auditoría previa sobre los
 * reactivos que W3 aceptó.
 *
 * Uso: node scripts/content/w4-preaudit-run.mjs
 *
 * Qué hace y qué no:
 * - La lógica es `generatePreAuditSample()` (pura), con la política congelada
 *   `cal-audit-pre-v1`. Aquí solo se arma la población y se escribe el
 *   resultado.
 * - **La muestra no la elige nadie**: sale de un ranking SHA-256 con semilla
 *   registrada sobre el estrato completo. Elegir a mano qué se audita permitiría
 *   —sin querer— auditar justo lo que ya se sabe bueno.
 * - **`hasSubproof` se deriva del certificado, no se declara.** Es dato de
 *   estratificación, no del enunciado: vive en `solutions-private/` y no sale de
 *   aquí hacia `items/`.
 * - **El riesgo sí es un juicio declarado**, y por eso va con su consecuencia
 *   escrita al lado. La política congelada **incluye todo el alto riesgo** antes
 *   de subir pisos, así que marcar de más nunca desplaza cobertura: solo agranda
 *   la muestra.
 * - La corrida **no emite ningún veredicto**: `evaluatePreAudit()` necesita los
 *   juicios de defecto de una persona, y esos los pone el auditor.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AUDIT_CODEBOOK,
  PREAUDIT_PARAMETERS,
  generatePreAuditSample,
} from '../../packages/authoring-core/dist/index.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CONTENIDO = join(RAIZ, 'content/unidad-deduccion-natural');
const AHORA = new Date().toISOString();

/**
 * Semilla de la muestra. Se deriva del id de la corrida W3 que produjo la
 * población: así queda atada a **qué** se auditó, y volver a muestrear el mismo
 * paquete da la misma muestra. Una semilla libre permitiría repetir el sorteo
 * hasta que saliera una muestra cómoda.
 */
const SEMILLA_BASE = 'w4-preaudit';

/**
 * Riesgo por función del banco, con la consecuencia que lo justifica. Ninguna
 * autoridad enumera el riesgo por reserva: es un juicio declarado, y por eso
 * viaja con su motivo.
 */
const RIESGO = {
  TRANSFER_MASTERY: [
    'high',
    'Un defecto aquí hace afirmar transferencia que no hubo: §5.11 exige forma superficial distinta sobre el mismo KC, y si el reactivo no la tiene, el dominio se declara sobre una práctica repetida.',
  ],
  replacement: [
    'medium',
    'Repone otra reserva: un defecto se propaga a la reserva repuesta y puede colarse donde la disjunción de medición sí aplica.',
  ],
  diagnostic: [
    'medium',
    'Abre la ruta del alumno: un defecto manda a recuperación o adelanta bloque sobre una lectura equivocada.',
  ],
  recovery: [
    'medium',
    'Es la salida del alumno que ya falló: un defecto aquí lo deja sin vía de recuperación real.',
  ],
  guided_practice: [
    'low',
    'Va con ayuda disponible y el error es recuperable en el mismo paso.',
  ],
  independent_practice: [
    'low',
    'No decide ruta ni dominio por sí solo; el fallo se observa y se corrige en el siguiente intento.',
  ],
};

function leerJsonConCabecera(ruta) {
  return JSON.parse(readFileSync(join(CONTENIDO, ruta), 'utf8').replace(/^(#[^\n]*\n)+/, ''));
}

function escribirYaml(ruta, cabecera, datos) {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, `# ${cabecera}\n${JSON.stringify(datos, null, 2)}\n`);
  console.log(`  escrito: ${ruta.slice(CONTENIDO.length + 1)}`);
}

function main() {
  console.log(`W4 — muestra de auditoría previa — ${AHORA}`);

  console.log('1/3 Armando la población desde los reactivos aceptados…');
  const corrida = leerJsonConCabecera('audits/w3-run.yaml');
  const soluciones = leerJsonConCabecera('solutions-private/w3-solutions.yaml');
  const mapa = leerJsonConCabecera('kc/map.yaml');

  const reglaPorKc = new Map(mapa.nodes.map((n) => [n.kcId, n.ruleId ?? 'estructural']));
  const certificadoPorItem = new Map(soluciones.privateSolutions.map((s) => [s.itemId, s.certificate]));

  const aceptados = corrida.items.filter((i) => i.accepted);
  const population = aceptados.map((item) => {
    const certificado = certificadoPorItem.get(item.candidateId);
    if (certificado === undefined) {
      throw new Error(
        `${item.candidateId} está aceptado y no tiene certificado. Sin él no se puede estratificar ` +
          `por subprueba, y suponerlo pondría el reactivo en el estrato equivocado.`,
      );
    }
    const [risk, consequence] = RIESGO[item.bankFunction] ?? [];
    if (risk === undefined) {
      throw new Error(
        `La reserva ${item.bankFunction} no tiene riesgo declarado. Declarado, nunca omitido: sin ` +
          `riesgo, la política de alto riesgo no puede incluirlo y quedaría fuera sin que conste.`,
      );
    }
    return {
      artifactId: item.candidateId,
      kcId: item.targetKcs[0],
      bankFunction: item.bankFunction,
      complexity: item.measuredComplexityTier ?? item.targetComplexity,
      ruleType: reglaPorKc.get(item.targetKcs[0]) ?? 'estructural',
      origin: 'w3_generado',
      hasSubproof: certificado.lines.some((l) => l.depth > 0),
      risk,
      consequence,
      itemFamilyId: item.itemFamilyId ?? '',
    };
  });
  console.log(`  ${population.length} reactivos auditables`);

  console.log('2/3 Generando la muestra con semilla registrada…');
  const seed = `${SEMILLA_BASE}-${corrida.frozenOrder.reportRunId}`;
  const muestra = generatePreAuditSample(population, seed);
  const porRiesgo = new Map();
  for (const a of population) {
    if (!muestra.selectedArtifactIds.includes(a.artifactId)) continue;
    porRiesgo.set(a.risk, (porRiesgo.get(a.risk) ?? 0) + 1);
  }
  console.log(
    `  ${muestra.selectedArtifactIds.length} de ${muestra.populationSize} seleccionados ` +
      `en ${muestra.strata.length} estratos ` +
      `(${[...porRiesgo.entries()].sort().map(([r, n]) => `${r}: ${n}`).join(', ')})`,
  );

  console.log('3/3 Escribiendo la muestra…');
  escribirYaml(
    join(CONTENIDO, 'audits/w4-preaudit-sample.yaml'),
    `Muestra de auditoría previa (T-H5-14, ${PREAUDIT_PARAMETERS.version}). Corrida del ${AHORA}. ` +
      `Sin veredicto: los juicios de defecto los pone el auditor con el libro de códigos, y el gate ` +
      `lo computa evaluatePreAudit().`,
    {
      generatedAt: AHORA,
      seed,
      parameters: PREAUDIT_PARAMETERS,
      codebook: AUDIT_CODEBOOK,
      riskPolicy: Object.fromEntries(
        Object.entries(RIESGO).map(([reserva, [riesgo, motivo]]) => [reserva, { riesgo, motivo }]),
      ),
      sample: muestra,
      population,
    },
  );

  console.log('W4 — muestra lista. Falta el juicio del auditor.');
}

main();
