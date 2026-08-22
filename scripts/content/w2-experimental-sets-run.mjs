#!/usr/bin/env node
/**
 * Selección de conjuntos experimentales (F6/H5, T-H5-12; paso 5 de §12 «W2»).
 *
 * Uso: node scripts/content/w2-experimental-sets-run.mjs
 *
 * Qué hace y qué no:
 * - La lógica es `evaluateSelectionProposal()` y `rankSelectionProposals()`
 *   (puras). Aquí se arman las propuestas desde el banco real y se escribe el
 *   resultado.
 * - **Se proponen varias particiones y se ordenan**, no se elige una. El orden
 *   es el congelado: menos contaminación entre conjuntos, menos estrategia
 *   compartida, menor diferencia estructural y por último el id. Proponer una
 *   sola haría que «la mejor» significara «la única».
 * - **Una propuesta que no valida no se arregla: se descarta con su motivo.**
 *   El evaluador lanza, y esa excepción es información —dice qué invariante
 *   rompe la partición— no un estorbo que haya que sortear.
 * - **Los KC fundamento (KC01, KC02, KC08) nunca son objetivo**, solo soporte:
 *   §5.2.1 los pone antes de la serie SCED, y medirlos como objetivo mediría
 *   desconocimiento del formato Fitch en vez de los KC experimentales.
 * - **El congelamiento no se hace aquí.** `freezeExperimentalSelection()` exige
 *   la decisión del `EXPERIMENT_AUDITOR`, y ese rol solo aprueba o rechaza la
 *   plausibilidad de la primera propuesta: no puede sustituirla.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  STRATEGY_CATALOG,
  evaluateSelectionProposal,
  rankSelectionProposals,
} from '../../packages/authoring-core/dist/index.js';
import { AUTHORIZED_CALCULUS_VERSION } from '../../packages/logic-core/dist/index.js';
import { SCED_OPPORTUNITY_H5_V1 } from '../../packages/experiment/dist/index.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CONTENIDO = join(RAIZ, 'content/unidad-deduccion-natural');
const AHORA = new Date().toISOString();

const FUNDAMENTOS = ['KC01', 'KC02', 'KC08'];
const RESERVAS_PRIMARIAS = ['probes_baseline', 'probes_intervention'];

/**
 * Particiones candidatas de los quince KC que no son fundamento.
 *
 * No se busca la mejor por fuerza bruta: 15 KC en tres grupos de cinco son
 * 126 126 particiones, y elegir por búsqueda exhaustiva optimizaría el número
 * en vez de la interpretabilidad. Se proponen tres con criterio declarado y se
 * dejan ordenar por la regla congelada.
 */
const PARTICIONES = [
  {
    proposalId: 'sel-topologica',
    criterio:
      'Bloques consecutivos del orden de enseñanza. Toda dependencia cruzada apunta hacia atrás, ' +
      'que es la dirección en la que el alumno ya vio el prerrequisito.',
    sets: { A: ['KC03', 'KC04', 'KC05', 'KC06', 'KC07'], B: ['KC09', 'KC10', 'KC11', 'KC12', 'KC13'], C: ['KC14', 'KC15', 'KC16', 'KC17', 'KC18'] },
  },
  {
    proposalId: 'sel-por-conectivo',
    criterio:
      'Agrupa por familia de conectivo: conjunción y disyunción, condicional y bicondicional, ' +
      'negación y lo que depende de ⊥. Busca que cada conjunto tenga una identidad temática.',
    sets: { A: ['KC03', 'KC04', 'KC05', 'KC07', 'KC13'], B: ['KC06', 'KC09', 'KC14', 'KC15', 'KC18'], C: ['KC10', 'KC11', 'KC12', 'KC16', 'KC17'] },
  },
  {
    proposalId: 'sel-alterna',
    criterio:
      'Reparto alterno por posición en la secuencia. Control: si una partición que ignora la ' +
      'estructura del mapa saliera bien ordenada, el criterio de orden no estaría midiendo nada.',
    sets: { A: ['KC03', 'KC06', 'KC11', 'KC14', 'KC17'], B: ['KC04', 'KC07', 'KC12', 'KC15', 'KC18'], C: ['KC05', 'KC09', 'KC10', 'KC13', 'KC16'] },
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
  console.log(`W2 paso 5 — conjuntos experimentales — ${AHORA}`);

  console.log('1/4 Cargando el banco y el sobre congelado del calendario…');
  const w3 = leerJsonConCabecera('audits/w3-run.yaml');
  const mapa = leerJsonConCabecera('kc/map.yaml');
  const aceptados = w3.items.filter((i) => i.accepted);

  const calendar = {
    calibrationVersion: SCED_OPPORTUNITY_H5_V1.version,
    kSet: SCED_OPPORTUNITY_H5_V1.kSet,
    minValidItemsPerOpportunity: SCED_OPPORTUNITY_H5_V1.minValidItemsPerOpportunity,
    plannedOpportunitiesBySet: SCED_OPPORTUNITY_H5_V1.coverageEnvelope.plannedOpportunitiesBySet,
  };
  console.log(`  ${aceptados.length} reactivos, sobre ${calendar.calibrationVersion}, k_set ${calendar.kSet}`);

  // Estrategias por KC objetivo. Son las mismas para todos porque la matriz de
  // activación de Rol B es única: no se inventa variedad por conjunto para
  // bajar el solapamiento, que sería fabricar el diferenciador que se mide.
  const estrategias = STRATEGY_CATALOG.map((e) => e.catalogEntryId);

  console.log('2/4 Armando las propuestas desde el banco…');
  const porKc = new Map();
  for (const item of aceptados) {
    const kc = item.targetKcs[0];
    porKc.set(kc, [...(porKc.get(kc) ?? []), item]);
  }

  const armar = ({ proposalId, criterio, sets }) => {
    const kcsPorSet = sets;
    const idsDeReserva = (setId, reservas) =>
      kcsPorSet[setId]
        .flatMap((kc) => porKc.get(kc) ?? [])
        .filter((i) => reservas.includes(i.bankFunction))
        .map((i) => i.candidateId);

    // Soporte: los fundamentos, más los KC objetivo de otros conjuntos de los
    // que este depende. Declararlos es lo que hace legible la contaminación.
    const soporte = (setId) => {
      const objetivos = new Set(kcsPorSet[setId]);
      const dependencias = mapa.edges
        .filter((e) => objetivos.has(e.from) && !objetivos.has(e.to))
        .map((e) => e.to);
      return [...new Set([...FUNDAMENTOS, ...dependencias])].sort();
    };

    const proposal = {
      proposalId,
      sets: ['A', 'B', 'C'].map((setId) => ({
        setId,
        targetKcs: kcsPorSet[setId],
        supportKcs: soporte(setId),
        authorizedCalculusVersion: AUTHORIZED_CALCULUS_VERSION,
      })),
      generalStrategiesByTargetKc: Object.fromEntries(
        Object.values(kcsPorSet).flat().map((kc) => [kc, estrategias]),
      ),
      complexityProfilesBySet: Object.fromEntries(
        ['A', 'B', 'C'].map((setId) => [
          setId,
          kcsPorSet[setId]
            .flatMap((kc) => porKc.get(kc) ?? [])
            .map((i) => i.complexity)
            .filter((p) => p !== undefined),
        ]),
      ),
      probeInventoryItemIdsBySet: Object.fromEntries(
        ['A', 'B', 'C'].map((setId) => [setId, idsDeReserva(setId, RESERVAS_PRIMARIAS)]),
      ),
      transferMeasurementItemIdsBySet: Object.fromEntries(
        ['A', 'B', 'C'].map((setId) => [setId, idsDeReserva(setId, ['TRANSFER_MEASUREMENT'])]),
      ),
      crossEdgeJustifications: [],
      criterio,
    };

    // Las aristas F/PC cruzadas se justifican **una por una**, y la de
    // carryover se reconoce cuando la dependencia queda en un conjunto que se
    // enseña antes: ocultarlo lo rechaza el evaluador, y con razón.
    const duenoDe = new Map(
      Object.entries(kcsPorSet).flatMap(([setId, kcs]) => kcs.map((kc) => [kc, setId])),
    );
    const orden = { A: 0, B: 1, C: 2 };
    proposal.crossEdgeJustifications = mapa.edges
      .filter((e) => {
        const a = duenoDe.get(e.from);
        const b = duenoDe.get(e.to);
        return a && b && a !== b && (e.type === 'FORMAL' || e.type === 'POLITICA_CONTENIDO');
      })
      .map((e) => {
        const haciaAtras = orden[duenoDe.get(e.to)] < orden[duenoDe.get(e.from)];
        const nombre = (kc) => mapa.nodes.find((n) => n.kcId === kc)?.name ?? kc;
        return {
          from: e.from,
          to: e.to,
          type: e.type,
          explanation:
            `${e.from} (${nombre(e.from)}) depende de ${e.to} (${nombre(e.to)}) por una arista ` +
            `${e.type} y quedan en conjuntos distintos. ` +
            (haciaAtras
              ? 'La dependencia se enseña antes, así que el alumno llega al conjunto posterior con ' +
                'el prerrequisito ya practicado: el efecto medido incluye ese arrastre y se ' +
                'interpreta como tal, no como efecto puro del KC objetivo.'
              : 'La dependencia se enseña después, lo que obliga a apoyarla como KC de soporte ' +
                'dentro de este conjunto en vez de darla por practicada.'),
          carryoverRiskAcknowledged: haciaAtras,
          retentionCompatibility:
            'La retención se mide con la reserva `retention`, disjunta de la práctica del ' +
            'prerrequisito (§7.7), así que el arrastre afecta a la interpretación del efecto y no ' +
            'contamina el material con el que se mide.',
        };
      });

    return proposal;
  };

  const propuestas = PARTICIONES.map(armar);

  console.log('3/4 Evaluando cada propuesta por separado…');
  const validas = [];
  const descartadas = [];
  for (const propuesta of propuestas) {
    try {
      evaluateSelectionProposal(propuesta, calendar);
      validas.push(propuesta);
      console.log(`  ✓ ${propuesta.proposalId}`);
    } catch (error) {
      const motivo = error instanceof Error ? error.message : String(error);
      descartadas.push({ proposalId: propuesta.proposalId, motivo });
      console.log(`  ✗ ${propuesta.proposalId}: ${motivo.slice(0, 110)}`);
    }
  }
  if (validas.length === 0) {
    throw new Error('Ninguna partición propuesta valida. No se congela nada sobre una sola opción rota.');
  }

  console.log('4/4 Ordenando por la regla congelada y escribiendo…');
  const ranking = rankSelectionProposals(validas, calendar);
  for (const evaluacion of ranking) {
    console.log(
      `  ${evaluacion.proposal.proposalId}: ` +
        `${evaluacion.formalCrossEdges.length} F + ${evaluacion.contentPolicyCrossEdges.length} PC cruzadas, ` +
        `estrategia compartida ${evaluacion.sharedGeneralStrategyCount}, ` +
        `dif. estructural máx ${evaluacion.maximumComplexityDifference.toFixed(3)}, ` +
        `comparables: ${evaluacion.allCrossSetItemPairsComparable}`,
    );
  }
  const ganadora = ranking[0];

  escribirYaml(
    join(CONTENIDO, 'kc/experimental-sets.yaml'),
    `Propuesta de conjuntos experimentales (T-H5-12). Corrida del ${AHORA}. ` +
      `**No congelada**: freezeExperimentalSelection() exige la decisión del EXPERIMENT_AUDITOR, ` +
      `que solo puede aprobar o rechazar la plausibilidad de la primera propuesta.`,
    {
      generatedAt: AHORA,
      status: 'propuesta_ordenada_sin_congelar',
      calendar,
      discardedProposals: descartadas,
      ranking: ranking.map((e) => ({
        proposalId: e.proposal.proposalId,
        criterio: e.proposal.criterio,
        formalCrossEdges: e.formalCrossEdges,
        contentPolicyCrossEdges: e.contentPolicyCrossEdges,
        otherCrossEdges: e.otherCrossEdges,
        carryoverRiskEdges: e.carryoverRiskEdges,
        sharedGeneralStrategyCount: e.sharedGeneralStrategyCount,
        maximumComplexityDifference: e.maximumComplexityDifference,
        complexityInterpretation: e.complexityInterpretation,
        complexityBySet: e.complexityBySet,
        nominalProbeItemsBySet: e.nominalProbeItemsBySet,
        sets: e.proposal.sets,
        probeCountsBySet: Object.fromEntries(
          Object.entries(e.proposal.probeInventoryItemIdsBySet).map(([s, ids]) => [s, ids.length]),
        ),
        transferMeasurementCountsBySet: Object.fromEntries(
          Object.entries(e.proposal.transferMeasurementItemIdsBySet).map(([s, ids]) => [s, ids.length]),
        ),
        crossEdgeJustifications: e.proposal.crossEdgeJustifications,
      })),
      leadingProposalId: ganadora.proposal.proposalId,
      leadingProposalInventory: {
        probeInventoryItemIdsBySet: ganadora.proposal.probeInventoryItemIdsBySet,
        transferMeasurementItemIdsBySet: ganadora.proposal.transferMeasurementItemIdsBySet,
      },
    },
  );

  console.log(`W2 paso 5 — encabeza ${ganadora.proposal.proposalId}. Falta la decisión del auditor.`);
}

main();
