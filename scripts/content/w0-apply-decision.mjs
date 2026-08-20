#!/usr/bin/env node
/**
 * Aplica la decisión del CORPUS_APPROVER sobre la propuesta W0 (T-H45-07).
 *
 * Uso: node scripts/content/w0-apply-decision.mjs
 *
 * La propuesta vive en `research/selection-manifest.yaml` (estado
 * `propuesta_corpus`). Este script NO reejecuta la corrida: carga el
 * manifiesto que se presentó al aprobador y le aplica `applyCorpusDecision`.
 * La firma vale sobre ese manifiesto y ningún otro (`assertNoHumanRewrite`
 * es la otra mitad de la misma regla).
 *
 * Persiste `research/corpus-decision.yaml` con el DecisionRecord, la
 * historia completa y el estado final, y actualiza la cabecera de
 * `selection-manifest.yaml` al estado resultante.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyCorpusDecision } from '../../packages/authoring-core/dist/index.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '../..');
const RESEARCH = join(RAIZ, 'content/unidad-deduccion-natural/research');
const AHORA = new Date().toISOString();

function leerYaml(nombre) {
  const crudo = readFileSync(join(RESEARCH, nombre), 'utf8');
  // Los .yaml de research/ son JSON con una cabecera de comentario.
  return JSON.parse(crudo.replace(/^#[^\n]*\n/, ''));
}

function escribirYaml(nombre, cabecera, datos) {
  writeFileSync(join(RESEARCH, nombre), `# ${cabecera}\n${JSON.stringify(datos, null, 2)}\n`);
  console.log(`  escrito: research/${nombre}`);
}

const propuesta = leerYaml('selection-manifest.yaml');
const decision = { kind: 'autorizado', decidedBy: 'CORPUS_APPROVER' };

const { record, history, finalState } = applyCorpusDecision(
  {
    finalState: 'propuesta_corpus',
    manifest: propuesta.manifest,
    history: propuesta.history,
  },
  decision,
);

console.log(`decisión: ${record.decision.kind} → estado ${finalState}`);

escribirYaml(
  'corpus-decision.yaml',
  `Decisión del CORPUS_APPROVER (T-H45-07). Aplicada el ${AHORA}. El propietario revisó ` +
    `evaluations-2026-08-19.json y autorizó la propuesta tal cual: el corpus autorizado es el ` +
    `conjunto authorizableReferences del manifiesto. El componente modal queda fuera de esta ` +
    `unidad (cobertura 0.0); su autorización queda condicionada a permiso documentado de Trueman.`,
  {
    decidedAt: AHORA,
    record,
    history,
    finalState,
    nota:
      'La firma vale sobre el manifiesto de selection-manifest.yaml tal como se presentó. ' +
      'MIT OCW 24.241 permanece excluido (NC/SA sin compatibilidad declarada). ' +
      'forallx-yyc/logica-modal permanece LICENSE_UNRESOLVED y fuera de la base expresiva.',
  },
);

propuesta.estado = finalState;
escribirYaml(
  'selection-manifest.yaml',
  `Propuesta de corpus y autorización (T-H45-06/07). Corrida W0 en vivo del 2026-08-19. ` +
    `Estado: ${finalState} — decisión del CORPUS_APPROVER en corpus-decision.yaml (${AHORA}).`,
  propuesta,
);

console.log('Listo. W0 cierra en corpus_autorizado: se puede entrar a W1.');
