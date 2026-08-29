import {
  SessionScriptModeController,
  initializeSessionState,
  transitionPrimarySessionState,
  type ScriptedCatalog,
  type SessionSnapshot,
} from '@profesor-ia/session-engine';

import { appendLine, emptyFitchDocument, type FitchDocument } from './fitch-document';
import type {
  ClaseActivity,
  ClaseTranscriptEntry,
  ClaseViewInput,
} from './view-model';
import { F7_SUPPORTED_CAPABILITIES } from './view-model';

/**
 * Sesión seca con **paquete sintético de desarrollo** (T-H6-13; F7 admite
 * expresamente «paquete congelado o paquete sintético de desarrollo
 * equivalente»).
 *
 * Es lo que permite operar la vista antes de que exista corpus: nadie ha corrido
 * W0 sobre fuentes reales, así que `content/` sigue en placeholders. El catálogo
 * lleva `purpose: 'test_fixture'` y la vista lo declara en pantalla (UIUX §2):
 * un dato ilustrativo que se presentara como real acabaría citado como
 * evidencia.
 *
 * No hay reloj ni azar: las marcas de tiempo son fijas para que la sesión seca
 * sea reproducible acto por acto, que es lo que el AC del gate H6 exige.
 */

export const DRY_SESSION_PACKAGE_IS_SYNTHETIC = true;

/**
 * Bloque de la sesión (T-H7-01). El bloque es el KC (P-I §9.4, §5.2), y es el
 * que el Profesor IA usa para pedir sus fragmentos autorizados al corpus real.
 *
 * El catálogo de arriba es sintético; **este id no lo es**: nombra un bloque
 * que existe en `content/`, y el turno del profesor falla con
 * `BLOQUE_SIN_FRAGMENTOS` si no tuviera material. Es la única costura entre la
 * sesión seca de desarrollo y el corpus de verdad.
 */
export const DRY_SESSION_BLOCK_ID = 'KC06' as const;

const T0 = '2026-01-01T10:00:00.000Z';
const T1 = '2026-01-01T10:00:05.000Z';
const T2 = '2026-01-01T10:00:10.000Z';

/** Catálogo congelado sintético. `purpose` lo declara: no es material. */
export const DRY_SESSION_CATALOG: ScriptedCatalog = {
  schemaVersion: 'session-script-mode-v1',
  catalogVersion: 'dry-session-dev-v1',
  purpose: 'test_fixture',
  packageVersion: { artifactId: 'paquete-sintetico-dev', version: '0.0.0-dev' },
  entries: [
    {
      contentId: 'c-explicacion-kc06',
      kind: 'explanation',
      kcId: 'KC06',
      selectorKey: 'apertura',
      text:
        'Vamos a trabajar la eliminación de la conjunción. De una conjunción puedes concluir ' +
        'cualquiera de sus dos miembros, en un solo paso y citando la línea de la conjunción.',
      anchors: ['fr-kc06-001'],
    },
    {
      contentId: 'c-practica-kc06',
      kind: 'practice_statement',
      kcId: 'KC06',
      selectorKey: 'practica-1',
      text: 'Deriva A a partir de la premisa A∧B.',
      anchors: ['fr-kc06-001'],
    },
  ],
};

export const DRY_SESSION_ACTIVITY: ClaseActivity = {
  activityId: 'act-kc06-1',
  kcId: 'KC06',
  statement: 'Deriva A a partir de la premisa A∧B.',
  scorable: true,
  rubric: {
    rubricId: 'rub-kc06-1',
    version: 'dry-session-dev-v1',
    criteria: [
      { criterionId: 'r1', text: 'Cada línea lleva justificación.' },
      { criterionId: 'r2', text: 'La última línea es la meta pedida.' },
      { criterionId: 'r3', text: 'Sólo se usan reglas del cálculo autorizado.' },
    ],
  },
  probeItemPresented: false,
};

/** Estado de sesión seca: preparada → autenticacion → … → practica. */
export function drySessionSnapshot(): SessionSnapshot {
  let mutation = initializeSessionState(
    {
      sessionId: 'ses-dev-1',
      runId: 'run-dev-1',
      participantPseudoId: 'part-dev-1',
      courseId: 'curso-logica',
      packageVersion: { artifactId: 'paquete-sintetico-dev', version: '0.0.0-dev' },
      plannedDurationSeconds: 2_700,
    },
    { eventId: 'ev-0', occurredAt: T0 },
  );

  const sequence = [
    'autenticacion',
    'consentimiento_confirmado',
    'diagnostico',
    'explicacion',
    'comprobacion',
    'practica',
  ] as const;

  for (const [index, state] of sequence.entries()) {
    mutation = transitionPrimarySessionState(mutation.snapshot, state, 'dry_session', {
      eventId: `ev-${index + 1}`,
      occurredAt: T1,
      decisionMaker: 'engine',
      autonomyStatus: 'automatic-control',
    });
  }

  return mutation.snapshot;
}

/** Turnos entregados desde el catálogo congelado; ninguno generado en vivo. */
export function drySessionTranscript(): readonly ClaseTranscriptEntry[] {
  const controller = new SessionScriptModeController(DRY_SESSION_CATALOG);
  const requests = [
    { kind: 'explanation', kcId: 'KC06', selectorKey: 'apertura' },
    { kind: 'practice_statement', kcId: 'KC06', selectorKey: 'practica-1' },
  ] as const;

  return requests.map((request, index) => {
    const delivery = controller.deliver('script', request);
    return {
      entryId: `t-${index + 1}`,
      speaker: 'profesor_ia' as const,
      text: delivery.text,
      at: T2,
      actKind: delivery.kind,
      provenance: {
        kind: 'scripted' as const,
        contentId: delivery.contentId,
        catalogVersion: delivery.catalogVersion,
        deliveryMode: delivery.mode,
        liveGeneration: false as const,
      },
    };
  });
}

/** Documento inicial: la premisa dada, sin ninguna línea derivada de regalo. */
export function drySessionDocument(): FitchDocument {
  return appendLine(emptyFitchDocument('A'), { formula: 'A∧B', rule: 'PR', depth: 0 });
}

export function drySessionViewInput(): ClaseViewInput {
  return {
    session: drySessionSnapshot().state,
    capabilities: F7_SUPPORTED_CAPABILITIES,
    transcript: drySessionTranscript(),
    activity: DRY_SESSION_ACTIVITY,
    saveState: { kind: 'guardado', atRevision: 6, at: T2 },
    hintLevelsDelivered: [],
    hintMaximumLevel: 5,
  };
}
