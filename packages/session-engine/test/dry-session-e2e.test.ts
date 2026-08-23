import { describe, expect, it } from 'vitest';
import { ProbeOpportunityResult } from '@profesor-ia/contracts';
import {
  CAL09_BINDING_VERSION,
  CAL09_DOMAIN_BINDING,
  DOMAIN_POLICY_V1,
  DeterministicDomainController,
  compileDomainPolicy,
} from '@profesor-ia/domain-engine';
import { EvidenceLedger, EvidenceLedgerError } from '@profesor-ia/evidence';

import {
  MeasurementSessionIntent,
  ScriptedActKind,
  SessionScriptModeController,
  SessionScriptModeError,
  SessionStateMachineError,
  SessionStructuredState,
  appendSessionMeasurementExitEvidence,
  appendSessionMutationEvidence,
  changeTransversalSessionState,
  enterMeasurementModeForProbe,
  exitMeasurementModeFromProbeResult,
  initializeSessionState,
  replaySessionStateEvents,
  sessionStateHash,
  transitionPrimarySessionState,
  updateSessionFromDomainState,
  updateSessionProjection,
  type ScriptedCatalog,
  type SessionDecisionMetadata,
  type SessionEvidenceMetadata,
  type SessionMutation,
  type SessionSnapshot,
} from '../src/index.js';

/**
 * `ci:e2e:dry-session` — la otra mitad del AC del gate H6 (`Plan.md` §F7).
 *
 * El plan pide una **sesión seca completa con datos sintéticos, reconstruible
 * desde eventos**, y cinco propiedades declaradas: reactivo consumido no
 * reaparece; sonda nunca en contexto del agente; dominio no se alcanza sin
 * transferencia; corrección no elimina original; intervención humana
 * registrada. La separación de modos es la otra suite (`ci:mode-separation`).
 *
 * Las expectativas se declaran antes de ejecutar y cada propiedad se ataca
 * **por la vía genérica** —la puerta que cualquiera podría empujar— y no por el
 * camino que uno espera que se use: una propiedad comprobada sólo sobre el
 * camino previsto no dice nada de los otros. Dos puertas laterales aparecieron
 * así y están anotadas donde se cierran.
 *
 * No hay reloj, ni azar, ni red: los tiempos son constantes y el paquete es
 * sintético (`purpose: 'test_fixture'`), que es lo que §F7 admite mientras no
 * exista corpus.
 */

const DIA = '2026-08-18';
const PAQUETE = {
  artifactId: 'paquete-sintetico-dev',
  version: '0.0.0-dev',
  hash: 'a'.repeat(64),
} as const;

function at(second: number): string {
  return `${DIA}T09:${String(Math.floor(second / 60)).padStart(2, '0')}:${String(second % 60).padStart(2, '0')}.000Z`;
}

function meta(
  eventId: string,
  second: number,
  overrides: Partial<SessionDecisionMetadata> = {},
): SessionDecisionMetadata {
  return {
    eventId,
    occurredAt: at(second),
    decisionMaker: 'engine',
    autonomyStatus: 'autonomous',
    ...overrides,
  };
}

/**
 * Catálogo congelado sintético. Es el mismo diseño que
 * `apps/web/src/clase/dry-session.ts` y por la misma razón: sin corrida W0 no
 * hay corpus, y `purpose` lo declara en vez de disfrazarlo de material.
 */
const CATALOGO: ScriptedCatalog = {
  schemaVersion: 'session-script-mode-v1',
  catalogVersion: 'dry-session-e2e-v1',
  purpose: 'test_fixture',
  packageVersion: { artifactId: PAQUETE.artifactId, version: PAQUETE.version },
  entries: [
    {
      contentId: 'c-explicacion-kc06',
      kind: 'explanation',
      kcId: 'KC06',
      selectorKey: 'apertura',
      text: 'De una conjunción puedes concluir cualquiera de sus dos miembros en un solo paso.',
      anchors: ['fr-kc06-001'],
    },
    {
      contentId: 'c-comprobacion-kc06',
      kind: 'completion_prompt',
      kcId: 'KC06',
      selectorKey: 'comprobacion-1',
      text: 'Completa la justificación que falta en la línea 2.',
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
    {
      contentId: 'c-feedback-kc06',
      kind: 'templated_feedback',
      kcId: 'KC06',
      selectorKey: 'practica-1-correcta',
      text: 'Correcto: citaste la línea de la conjunción y aplicaste la regla en un paso.',
      anchors: ['fr-kc06-001'],
    },
  ],
};

/** Reactivos de sonda de la corrida. El agente no debe verlos nunca. */
const REACTIVOS_DE_SONDA = [
  { itemId: 'probe-baseline-1', statement: 'Demuestra el reactivo de sonda 1.' },
  { itemId: 'probe-baseline-2', statement: 'Demuestra el reactivo de sonda 2.' },
  { itemId: 'probe-baseline-3', statement: 'Demuestra el reactivo de sonda 3.' },
] as const;

const RESULTADO_DE_SONDA = {
  opportunityId: 'op-dry-1',
  probeRoundId: 'round-dry-1',
  plannedItems: 3,
  validScoredItems: 2,
  correctValidItems: 1,
  observation: 0.5,
  operationalValidity: 'valid',
  reasonCode: null,
} as const;

/** Estado autoritativo de dominio: dos prácticas elegibles y una transferencia. */
// El tipo se **infiere** del controlador de dominio. Declararlo `unknown` era
// tirar la información justo antes de pasársela a `updateSessionFromDomainState`,
// que sí tiene tipo: la llamada no compilaba y nadie lo veía.
function estadoDeDominio(conTransferencia: boolean) {
  const policyHash = compileDomainPolicy(DOMAIN_POLICY_V1).policyHash;
  const controller = new DeterministicDomainController(DOMAIN_POLICY_V1, {
    expectedHash: policyHash,
  });
  // La política de dominio es la **real** (`purpose: 'material'`): lo sintético de
  // una sesión seca es el paquete de contenido, no la regla de dominio, que es
  // literal de P-I §5.3 y no depende del corpus. Probar la propiedad contra una
  // política de juguete no diría nada de la que va a correr.
  controller.bindRun({
    runId: 'run-dry-1',
    purpose: 'material',
    policyVersion: DOMAIN_POLICY_V1.policyVersion,
    policyHash,
  });
  const intento = (sequenceNumber: number) => ({
    attemptId: `dry-attempt-${sequenceNumber}`,
    itemId: `dry-item-${sequenceNumber}`,
    itemFamilyId: `dry-family-${sequenceNumber}`,
    mode: 'LEARNING_MODE' as const,
    outcome: 'correct' as const,
    complexityIndex: sequenceNumber,
    complexityCalibrationVersion: CAL09_BINDING_VERSION,
    complexityCalibrationSampleHash: CAL09_DOMAIN_BINDING.sampleHash,
    hints: [],
  });
  const practica = (sequenceNumber: number) => ({
    eventId: `dry-domain-${sequenceNumber}`,
    eventType: 'domain.attempt.observed',
    sequenceNumber,
    occurredAt: at(sequenceNumber + 100),
    payload: {
      ...intento(sequenceNumber),
      activityKind: 'practice',
      reserve: 'independent_practice',
    },
  });
  const transferencia = {
    eventId: 'dry-domain-3',
    eventType: 'domain.attempt.observed',
    sequenceNumber: 3,
    occurredAt: at(103),
    payload: {
      ...intento(3),
      activityKind: 'near_transfer',
      reserve: 'TRANSFER_MASTERY',
      nonIsomorphismEvidence: {
        authority: 'isomorphism_canonicalizer',
        canonicalizerVersion: 'dry-session-e2e-v1',
        evidenceHash: 'c'.repeat(64),
        comparedImmediatePracticeItemIds: ['dry-item-1', 'dry-item-2'],
        nonIsomorphic: true,
      },
    },
  };
  return controller.replay([
    {
      eventId: 'dry-domain-0',
      eventType: 'domain.initialized',
      sequenceNumber: 0,
      occurredAt: at(100),
      payload: { runId: 'run-dry-1', participantPseudoId: 'pseudo-dry-1', kcId: 'KC06' },
    },
    practica(1),
    practica(2),
    // El tercer acto elegible es la transferencia sólo en la rama que la tiene;
    // en la otra es una práctica más, para que la racha llegue igual a tres y la
    // única diferencia entre las dos ramas sea la transferencia.
    conTransferencia ? transferencia : practica(3),
  ]);
}

interface SesionSeca {
  readonly mutaciones: readonly SessionMutation[];
  readonly eventos: readonly unknown[];
  readonly final: SessionSnapshot;
  readonly guion: readonly ReturnType<SessionScriptModeController['deliver']>[];
}

/**
 * La sesión seca completa, de `preparada` a `cierre`, acto por acto: guion,
 * práctica, dominio autoritativo, sonda, intervención humana y cierre. Nada se
 * genera en vivo y nada consulta el reloj.
 */
function sesionSeca(): SesionSeca {
  const mutaciones: SessionMutation[] = [];
  const guion: ReturnType<SessionScriptModeController['deliver']>[] = [];
  const controlador = new SessionScriptModeController(CATALOGO);

  const inicial = initializeSessionState(
    {
      sessionId: 'ses-dry-1',
      runId: 'run-dry-1',
      participantPseudoId: 'pseudo-dry-1',
      courseId: 'curso-logica',
      packageVersion: PAQUETE,
      plannedDurationSeconds: 2_700,
    },
    { eventId: 'dry-event-0', occurredAt: at(0) },
  );
  mutaciones.push(inicial);
  let actual = inicial.snapshot;
  let n = 0;
  const siguiente = (): number => (n += 1);

  const empuja = (mutation: SessionMutation): void => {
    mutaciones.push(mutation);
    actual = mutation.snapshot;
  };

  const avanza = (
    to: Parameters<typeof transitionPrimarySessionState>[1],
    reasonCode: string,
  ): void => {
    const paso = siguiente();
    empuja(
      transitionPrimarySessionState(actual, to, reasonCode, meta(`dry-event-${paso}`, paso)),
    );
  };

  avanza('autenticacion', 'dry_session:autenticacion');
  avanza('consentimiento_confirmado', 'dry_session:consentimiento');
  avanza('diagnostico', 'dry_session:diagnostico');

  // Diagnóstico: abre bloque, fija el KC activo y arranca el reloj declarado.
  let paso = siguiente();
  empuja(
    updateSessionProjection(
      actual,
      {
        currentBlock: { blockId: 'bloque-kc06', objectiveId: 'KC06' },
        activeKcIds: ['KC06'],
        timing: {
          plannedDurationSeconds: 2_700,
          elapsedSeconds: 0,
          startedAt: at(paso),
          endedAt: null,
        },
      },
      'dry_session:apertura_de_bloque',
      meta(`dry-event-${paso}`, paso),
    ),
  );

  avanza('explicacion', 'dry_session:explicacion');
  guion.push(controlador.deliver('script', {
    kind: 'explanation',
    kcId: 'KC06',
    selectorKey: 'apertura',
  }));

  avanza('comprobacion', 'dry_session:comprobacion');
  guion.push(controlador.deliver('script', {
    kind: 'completion_prompt',
    kcId: 'KC06',
    selectorKey: 'comprobacion-1',
  }));

  avanza('practica', 'dry_session:practica');
  guion.push(controlador.deliver('script', {
    kind: 'practice_statement',
    kcId: 'KC06',
    selectorKey: 'practica-1',
  }));

  // Práctica guiada: se consume el reactivo y se registra la ayuda del intento.
  paso = siguiente();
  empuja(
    updateSessionProjection(
      actual,
      {
        selectedStrategy: 'guided_practice',
        assistanceLevel: 1,
        scaffoldingStage: 'scaffolding',
        consumedActivityIds: ['act-practica-1'],
        assistanceByAttempt: [
          {
            attemptId: 'dry-attempt-1',
            hintLevelsUsed: [1],
            maximumHintLevel: 1,
            masteryDisqualifying: false,
          },
        ],
      },
      'dry_session:practica_guiada',
      meta(`dry-event-${paso}`, paso),
    ),
  );
  guion.push(controlador.deliver('script', {
    kind: 'templated_feedback',
    kcId: 'KC06',
    selectorKey: 'practica-1-correcta',
  }));

  // Segundo reactivo consumido: el registro crece, nunca se reescribe.
  paso = siguiente();
  empuja(
    updateSessionProjection(
      actual,
      { consumedActivityIds: ['act-practica-1', 'act-practica-2'] },
      'dry_session:practica_independiente',
      meta(`dry-event-${paso}`, paso),
    ),
  );

  // Dominio: lo declara `domain-engine`, no la sesión.
  paso = siguiente();
  empuja(
    updateSessionFromDomainState(
      actual,
      estadoDeDominio(true),
      'dry_session:dominio_proyectado',
      meta(`dry-event-${paso}`, paso),
    ),
  );

  // Sonda: el motor sólo pide conjunto/fase/tipo y entra en modo.
  paso = siguiente();
  empuja(
    changeTransversalSessionState(
      actual,
      'sonda',
      true,
      'dry_session:sonda_abierta',
      meta(`dry-event-${paso}`, paso),
    ),
  );
  paso = siguiente();
  empuja(
    enterMeasurementModeForProbe(
      actual,
      { experimentalSet: 'A', phase: 'baseline', measureKind: 'primary_probe' },
      'dry_session:sonda_entrada',
      meta(`dry-event-${paso}`, paso),
    ).mutation,
  );
  paso = siguiente();
  const salida = exitMeasurementModeFromProbeResult(
    actual,
    RESULTADO_DE_SONDA,
    'dry_session:sonda_resultado',
    meta(`dry-event-${paso}`, paso),
  );
  empuja(salida.mutation);
  paso = siguiente();
  empuja(
    changeTransversalSessionState(
      actual,
      'sonda',
      false,
      'dry_session:sonda_cerrada',
      meta(`dry-event-${paso}`, paso),
    ),
  );

  // Intervención humana: el propietario registra un incidente de interfaz. Queda
  // atribuida a `human`, no al motor, y con `human-exception` en la autonomía.
  paso = siguiente();
  empuja(
    updateSessionProjection(
      actual,
      {
        incidents: [
          {
            incidentId: 'inc-dry-1',
            taxonomyCode: 'interface_localized',
            scope: 'localized',
            status: 'open',
            occurredAt: at(paso),
          },
        ],
      },
      'dry_session:intervencion_humana',
      meta(`dry-event-${paso}`, paso, {
        decisionMaker: 'human',
        autonomyStatus: 'human-exception',
      }),
    ),
  );

  avanza('evaluacion_operativa', 'dry_session:evaluacion_operativa');
  avanza('cierre', 'dry_session:cierre');

  paso = siguiente();
  empuja(
    updateSessionProjection(
      actual,
      {
        timing: {
          plannedDurationSeconds: 2_700,
          elapsedSeconds: paso,
          startedAt: at(4),
          endedAt: at(paso),
        },
      },
      'dry_session:reloj_cerrado',
      meta(`dry-event-${paso}`, paso),
    ),
  );

  return {
    mutaciones,
    eventos: mutaciones.map((mutation) => mutation.event),
    final: actual,
    guion,
  };
}

function ledgerDeSesion(): EvidenceLedger {
  return new EvidenceLedger({
    streamId: 'stream-dry-1',
    runId: 'run-dry-1',
    participantPseudoId: 'pseudo-dry-1',
    sessionId: 'ses-dry-1',
  });
}

function evidencia(eventId: string, second: number): SessionEvidenceMetadata {
  return {
    evidenceEventId: eventId,
    correlationId: 'correlation-dry-1',
    occurredAtServer: at(second),
    versions: { 'dry-session-e2e': { version: 'dry-session-e2e-v1' } },
    validity: 'valid',
  };
}

/** Emite un `EvidenceEvent` por cada acto de la sesión seca, en orden. */
function bitacoraDeSesionSeca(sesion: SesionSeca): EvidenceLedger {
  const ledger = ledgerDeSesion();
  sesion.mutaciones.forEach((mutation, index) => {
    const metadata = evidencia(`dry-evidence-${index}`, index);
    if (
      mutation.event.eventType === 'session.projection.updated' &&
      mutation.event.payload.reasonCode === 'dry_session:sonda_resultado'
    ) {
      appendSessionMeasurementExitEvidence(
        ledger,
        { result: RESULTADO_DE_SONDA, mutation },
        metadata,
      );
      return;
    }
    appendSessionMutationEvidence(ledger, mutation, metadata);
  });
  return ledger;
}

describe('sesión seca completa (ci:e2e:dry-session)', () => {
  it('recorre la máquina literal de principio a fin sin generación en vivo', () => {
    const sesion = sesionSeca();
    expect(sesion.final.state.primaryState).toBe('cierre');
    expect(sesion.final.state.transverseStates).toEqual([]);
    expect(sesion.final.state.pedagogicalMode).toBe('LEARNING_MODE');
    expect(sesion.final.state.timing.endedAt).not.toBeNull();
    // Ningún turno del Profesor IA se generó: los cuatro salen del catálogo.
    expect(sesion.guion).toHaveLength(4);
    expect(sesion.guion.every((entrega) => entrega.liveGeneration === false)).toBe(true);
    expect(sesion.guion.every((entrega) => entrega.mode === 'script')).toBe(true);
  });

  it('el estado final es exactamente el replay de sus eventos', () => {
    const sesion = sesionSeca();
    expect(replaySessionStateEvents(sesion.eventos)).toEqual(sesion.final);
    // Y el hash de proyección se recalcula, no se arrastra.
    expect(replaySessionStateEvents(sesion.eventos).projectionHash).toBe(
      sesion.final.projectionHash,
    );
  });

  it('el replay no tolera hueco, reordenamiento ni duplicado', () => {
    const { eventos } = sesionSeca();
    const sinUno = [...eventos.slice(0, 5), ...eventos.slice(6)];
    expect(() => replaySessionStateEvents(sinUno)).toThrow(SessionStateMachineError);

    const desordenado = [...eventos];
    const quinto = desordenado[5];
    const sexto = desordenado[6];
    if (quinto === undefined || sexto === undefined) throw new Error('sesión seca incompleta');
    desordenado[5] = sexto;
    desordenado[6] = quinto;
    expect(() => replaySessionStateEvents(desordenado)).toThrow(SessionStateMachineError);

    const duplicado = [...eventos.slice(0, 6), eventos[5], ...eventos.slice(6)];
    expect(() => replaySessionStateEvents(duplicado)).toThrow(/duplicado/u);
  });

  it('la bitácora emite un evento por acto y reconstruye las diez proyecciones', () => {
    const sesion = sesionSeca();
    const reconstruido = bitacoraDeSesionSeca(sesion).reconstruct();

    expect(reconstruido.eventCount).toBe(sesion.mutaciones.length);
    expect(reconstruido.projections.session[0]?.value).toEqual(sesion.final.state);
    expect(reconstruido.projections.results[0]).toMatchObject({
      projectionId: RESULTADO_DE_SONDA.opportunityId,
      value: RESULTADO_DE_SONDA,
    });
    expect(reconstruido.projections.coverage[0]?.value).toEqual({
      consumedActivityIds: ['act-practica-1', 'act-practica-2'],
    });
    expect(reconstruido.projections.domain[0]?.value).toMatchObject({
      operationalMastery: { KC06: { mastered: true, nearTransferSatisfied: true } },
    });
    expect(reconstruido.projections.incidents[0]?.value).toMatchObject({
      incidents: [{ incidentId: 'inc-dry-1' }],
    });
    // La cadena queda cerrada sobre sí misma: restaurar exige los mismos hashes.
    expect(() => EvidenceLedger.restore(reconstruido.events)).not.toThrow();
  });
});

describe('propiedad: reactivo consumido no reaparece', () => {
  it('el registro de consumo sólo crece', () => {
    const sesion = sesionSeca();
    const consumos = sesion.mutaciones
      .map((mutation) => mutation.snapshot.state.consumedActivityIds)
      .filter((ids) => ids.length > 0);
    consumos.forEach((ids, index) => {
      const previos = consumos[index - 1] ?? [];
      previos.forEach((id) => expect(ids).toContain(id));
    });
    expect(sesion.final.state.consumedActivityIds).toEqual([
      'act-practica-1',
      'act-practica-2',
    ]);
  });

  /**
   * La puerta genérica no es «volver a presentar el reactivo» —para eso hay que
   * pasar por el consumo—, es **retirarlo del registro**: un reactivo que
   * desaparece de `consumedActivityIds` vuelve a estar disponible y se puede
   * presentar otra vez sin que ningún duplicado lo delate. Estaba abierta y se
   * cerró en el reductor (D-35).
   */
  it('retirar un reactivo ya consumido del registro se rechaza', () => {
    const sesion = sesionSeca();
    expect(() =>
      updateSessionProjection(
        sesion.final,
        { consumedActivityIds: ['act-practica-2'] },
        'retirada_de_consumo',
        meta('dry-event-retirada', 200),
      ),
    ).toThrow(/no se retira del registro/u);
  });

  /**
   * El evento forjado lleva su `resultingStateHash` **bien calculado**: el estado
   * que retira el consumo es válido para el esquema —la monotonía es de
   * transición, no de estado— así que se puede hashear y el evento es intachable
   * salvo por la propiedad. Sin esa precaución la prueba pasaría por
   * `STATE_HASH_MISMATCH` con la guarda quitada, o sea por vacío.
   */
  it('el rechazo vale también en replay, no sólo al escribir', () => {
    const sesion = sesionSeca();
    const ultima = sesion.mutaciones.at(-1);
    if (ultima === undefined) throw new Error('sesión seca vacía');
    const sequenceNumber = sesion.final.state.revision + 1;
    const occurredAt = at(230);
    const reasonCode = 'retirada_forjada';
    const resultante = {
      ...sesion.final.state,
      consumedActivityIds: [],
      revision: sequenceNumber,
      updatedAt: occurredAt,
      decisionAutonomy: [
        ...sesion.final.state.decisionAutonomy,
        {
          decisionId: 'dry-event-forjado',
          decisionType: 'session.projection.updated',
          decisionMaker: 'engine',
          autonomyStatus: 'autonomous',
          reasonCode,
          occurredAt,
        },
      ],
    };
    const forjado = {
      ...ultima.event,
      eventId: 'dry-event-forjado',
      sequenceNumber,
      occurredAt,
      previousStateHash: sesion.final.projectionHash,
      resultingStateHash: sessionStateHash(resultante),
      payload: { changes: { consumedActivityIds: [] }, reasonCode },
    };
    // El evento es válido en todo lo demás: el hash cuadra con su estado.
    expect(SessionStructuredState.safeParse(resultante).success).toBe(true);
    expect(() => replaySessionStateEvents([...sesion.eventos, forjado])).toThrow(
      /no se retira del registro/u,
    );
  });

  it('un reactivo repetido dentro del propio registro se rechaza', () => {
    const sesion = sesionSeca();
    expect(() =>
      updateSessionProjection(
        sesion.final,
        { consumedActivityIds: ['act-practica-1', 'act-practica-2', 'act-practica-2'] },
        'consumo_duplicado',
        meta('dry-event-duplicado', 201),
      ),
    ).toThrow(/duplicado/u);
  });
});

describe('propiedad: la sonda nunca entra en el contexto del agente', () => {
  /**
   * La comprobación no busca cadenas conocidas: fija que el **conjunto
   * entregable** es exactamente el catálogo y que el catálogo no puede
   * contener sonda. Con eso, cualquiera que sea el reactivo de sonda, no cabe.
   */
  it('el catálogo congelado es el único conjunto entregable y no tiene sonda', () => {
    const controlador = new SessionScriptModeController(CATALOGO);
    const entregables = new Set(CATALOGO.entries.map((entry) => entry.contentId));
    expect(entregables.size).toBe(CATALOGO.entries.length);
    // No hay clase de acto de sonda en el enum: no es que no se use, es que no existe.
    expect(ScriptedActKind.options).not.toContain('probe_item');
    expect(
      ScriptedActKind.options.some((kind) => /probe|sonda|measurement/iu.test(kind)),
    ).toBe(false);
    // Y una clave que no está en el catálogo no se rellena con «lo más parecido».
    expect(() =>
      controlador.deliver('script', {
        kind: 'practice_statement',
        kcId: 'KC06',
        selectorKey: 'probe-baseline-1',
      }),
    ).toThrow(SessionScriptModeError);
  });

  it('un catálogo que traiga sonda o solución se rechaza, no se limpia', () => {
    const conSonda = {
      ...CATALOGO,
      entries: [
        ...CATALOGO.entries,
        {
          contentId: 'c-sonda',
          kind: 'probe_item',
          kcId: 'KC06',
          selectorKey: 'sonda-1',
          text: REACTIVOS_DE_SONDA[0].statement,
          anchors: [],
        },
      ],
    };
    expect(() => new SessionScriptModeController(conSonda)).toThrow(SessionScriptModeError);
  });

  it('ninguna entrega del guion contiene un reactivo de sonda', () => {
    const sesion = sesionSeca();
    const contexto = JSON.stringify(sesion.guion);
    for (const reactivo of REACTIVOS_DE_SONDA) {
      expect(contexto).not.toContain(reactivo.itemId);
      expect(contexto).not.toContain(reactivo.statement);
    }
  });

  /**
   * Las dos únicas puertas entre `measurement-worker` y el motor son estos dos
   * contratos, y **ninguno tiene sitio** para el ítem: la solicitud lleva
   * conjunto/fase/tipo y la respuesta lleva conteos. Ambos son `.strict()`, así
   * que el intento de colar el reactivo se rechaza en el borde.
   */
  it('las dos puertas de medición no tienen sitio para el reactivo', () => {
    expect(Object.keys(MeasurementSessionIntent.shape).sort()).toEqual([
      'experimentalSet',
      'measureKind',
      'phase',
    ]);
    expect(Object.keys(ProbeOpportunityResult.shape)).not.toContain('itemId');

    expect(
      MeasurementSessionIntent.safeParse({
        experimentalSet: 'A',
        phase: 'baseline',
        measureKind: 'primary_probe',
        itemId: REACTIVOS_DE_SONDA[0].itemId,
      }).success,
    ).toBe(false);
    expect(
      ProbeOpportunityResult.safeParse({
        ...RESULTADO_DE_SONDA,
        itemStatement: REACTIVOS_DE_SONDA[0].statement,
      }).success,
    ).toBe(false);
  });

  it('el estado de sesión tras la sonda no conserva ningún rastro del reactivo', () => {
    const sesion = sesionSeca();
    const estado = JSON.stringify(sesion.final.state);
    for (const reactivo of REACTIVOS_DE_SONDA) {
      expect(estado).not.toContain(reactivo.itemId);
      expect(estado).not.toContain(reactivo.statement);
    }
    // Lo que sí queda es el resultado, que es lo que la sesión tiene derecho a ver.
    expect(estado).toContain(RESULTADO_DE_SONDA.opportunityId);
  });
});

describe('propiedad: el dominio no se alcanza sin transferencia', () => {
  it('tres correctas consecutivas sin transferencia no declaran dominio', () => {
    const sinTransferencia = estadoDeDominio(false);
    expect(sinTransferencia.masteryStatus).toBe('not_mastered');

    const sesion = sesionSeca();
    const proyectado = updateSessionFromDomainState(
      sesion.final,
      sinTransferencia,
      'dominio_sin_transferencia',
      meta('dry-event-sin-transferencia', 210),
    );
    expect(proyectado.snapshot.state.operationalMastery.KC06).toMatchObject({
      mastered: false,
      nearTransferSatisfied: false,
    });
    expect(proyectado.snapshot.state.nearTransfer.KC06).toMatchObject({ status: 'pending' });
  });

  it('con transferencia elegible sí, y la sesión no la recalcula', () => {
    const sesion = sesionSeca();
    expect(sesion.final.state.operationalMastery.KC06).toMatchObject({
      mastered: true,
      eligibleConsecutiveCorrect: 3,
      nearTransferSatisfied: true,
      reconfirmationPending: true,
    });
    expect(sesion.final.state.nearTransfer.KC06).toMatchObject({
      status: 'satisfied',
      attemptId: 'dry-attempt-3',
    });
    // Un dominio abre su reconfirmación posterior: la ausencia sería faltante.
    expect(sesion.final.state.nextSteps).toContainEqual({
      stepId: 'post-mastery-reconfirmation:KC06',
      action: 'post_mastery_reconfirmation_pending',
      targetId: 'KC06',
      plannedAt: null,
    });
  });

  /**
   * La puerta genérica: `updateSessionProjection()` acepta `operationalMastery`
   * completo, así que se podía escribir `mastered: true` con
   * `nearTransferSatisfied: false` sin pasar por `domain-engine` — y esa
   * proyección **es** la que la bitácora registra como dominio. Estaba abierta y
   * se cerró en el esquema, que es donde este repositorio pone los invariantes
   * (D-35).
   */
  it('escribir dominio a mano sin transferencia se rechaza', () => {
    const sesion = sesionSeca();
    expect(() =>
      updateSessionProjection(
        sesion.final,
        {
          operationalMastery: {
            KC07: {
              mastered: true,
              eligibleConsecutiveCorrect: 3,
              highestEligibleComplexityIndex: 3,
              nearTransferSatisfied: false,
              reconfirmationPending: false,
              lastChangedAt: at(211),
            },
          },
        },
        'dominio_a_mano',
        meta('dry-event-dominio-a-mano', 211),
      ),
    ).toThrow(/dominio sin transferencia/u);
  });

  /**
   * Al estar en el esquema, el invariante no necesita guarda en el replay: el
   * estado con falso dominio **no tiene hash válido**, porque no es un estado.
   * Ningún evento puede declararlo como resultado, ni escrito ni forjado, y esa
   * es la diferencia entre poner el invariante en el esquema y ponerlo en una
   * función.
   */
  it('un estado con falso dominio no es un estado: no hay evento que lo declare', () => {
    const sesion = sesionSeca();
    const falso = {
      ...sesion.final.state,
      revision: sesion.final.state.revision + 1,
      updatedAt: at(212),
      operationalMastery: {
        ...sesion.final.state.operationalMastery,
        KC07: {
          mastered: true,
          eligibleConsecutiveCorrect: 3,
          highestEligibleComplexityIndex: 3,
          nearTransferSatisfied: false,
          reconfirmationPending: false,
          lastChangedAt: at(212),
        },
      },
    };
    expect(SessionStructuredState.safeParse(falso).success).toBe(false);
    expect(() => sessionStateHash(falso)).toThrow(SessionStateMachineError);
  });

  /**
   * Se intentó refutar el invariante antes de escribirlo, y el intento acotó su
   * forma: tras declarar dominio, un intento elegible incorrecto vacía la racha
   * y `masteryStatus` sigue en `mastered`, así que `mastered: true` con racha 0
   * es un estado autoritativo legítimo. Por eso el invariante habla de la
   * transferencia y **no** de la racha.
   */
  it('dominio con racha vacía sigue siendo un estado válido', () => {
    const sesion = sesionSeca();
    expect(() =>
      updateSessionProjection(
        sesion.final,
        {
          operationalMastery: {
            KC07: {
              mastered: true,
              eligibleConsecutiveCorrect: 0,
              highestEligibleComplexityIndex: null,
              nearTransferSatisfied: true,
              reconfirmationPending: false,
              lastChangedAt: at(213),
            },
          },
        },
        'dominio_con_racha_vacia',
        meta('dry-event-racha-vacia', 213),
      ),
    ).not.toThrow();
  });
});

describe('propiedad: una corrección no elimina el original', () => {
  function conCorreccion(): {
    readonly ledger: EvidenceLedger;
    readonly originalId: string;
  } {
    const sesion = sesionSeca();
    const ledger = bitacoraDeSesionSeca(sesion);
    const original = ledger
      .events()
      .find((event) => event.eventType === 'session.projection.updated');
    if (original === undefined) throw new Error('bitácora sin acto corregible');

    const etapas = ['detection', 'classification', 'invalidation', 'replacement', 'resolution'] as const;
    etapas.forEach((stage, index) => {
      ledger.appendCorrection({
        eventId: `dry-correction-${stage}`,
        correlationId: 'correlation-dry-1',
        correctionOfEventId: original.eventId,
        stage,
        act: { component: 'session-engine', stage, note: `etapa ${stage}` },
        decisionMaker: 'human',
        autonomyStatus: 'human-exception',
        versions: { 'dry-session-e2e': { version: 'dry-session-e2e-v1' } },
        occurredAt: at(300 + index),
        occurredAtServer: at(300 + index),
        validity: index >= 2 ? 'invalid' : 'valid',
      });
    });
    return { ledger, originalId: original.eventId };
  }

  it('la cadena de cinco etapas se enlaza al original y lo deja intacto', () => {
    const { ledger, originalId } = conCorreccion();
    const eventos = ledger.events();
    const original = eventos.find((event) => event.eventId === originalId);
    expect(original).toBeDefined();

    const correcciones = eventos.filter((event) => event.correctionOfEventId === originalId);
    expect(correcciones.map((event) => event.eventType)).toEqual([
      'evidence.correction.detection',
      'evidence.correction.classification',
      'evidence.correction.invalidation',
      'evidence.correction.replacement',
      'evidence.correction.resolution',
    ]);
    // Cada etapa apunta a la anterior; la primera al original.
    expect(correcciones[0]?.causedByEventId).toBe(originalId);
    correcciones.slice(1).forEach((event, index) => {
      expect(event.causedByEventId).toBe(correcciones[index]?.eventId);
    });
    // El original conserva su hash: la corrección añade, no reescribe.
    expect(ledger.reconstruct().events.find((event) => event.eventId === originalId)?.hash).toBe(
      original?.hash,
    );
  });

  it('la proyección corregida conserva el valor anterior en el historial', () => {
    const { ledger, originalId } = conCorreccion();
    const reconstruido = ledger.reconstruct();
    const historial = reconstruido.projectionHistory.filter(
      (entry) => entry.projection === 'session',
    );
    expect(historial.length).toBeGreaterThan(1);
    expect(historial.some((entry) => entry.sourceEventId === originalId)).toBe(true);
  });

  it('no se puede saltar una etapa ni corregir un acto que no existe', () => {
    const ledger = bitacoraDeSesionSeca(sesionSeca());
    const original = ledger.events()[1];
    if (original === undefined) throw new Error('bitácora incompleta');
    const base = {
      correlationId: 'correlation-dry-1',
      act: { component: 'session-engine' },
      decisionMaker: 'human' as const,
      autonomyStatus: 'human-exception' as const,
      versions: { 'dry-session-e2e': { version: 'dry-session-e2e-v1' } },
      occurredAt: at(310),
      occurredAtServer: at(310),
      validity: 'valid' as const,
    };
    expect(() =>
      ledger.appendCorrection({
        ...base,
        eventId: 'dry-correction-salto',
        correctionOfEventId: original.eventId,
        stage: 'invalidation',
      }),
    ).toThrow(EvidenceLedgerError);
    expect(() =>
      ledger.appendCorrection({
        ...base,
        eventId: 'dry-correction-fantasma',
        correctionOfEventId: 'no-existe',
        stage: 'detection',
      }),
    ).toThrow(EvidenceLedgerError);
  });

  it('borrar el original rompe la cadena en vez de pasar desapercibido', () => {
    const { ledger, originalId } = conCorreccion();
    const sinOriginal = ledger.events().filter((event) => event.eventId !== originalId);
    expect(() => EvidenceLedger.restore(sinOriginal)).toThrow(EvidenceLedgerError);
  });
});

describe('propiedad: la intervención humana queda registrada', () => {
  it('el acto humano se atribuye a `human` con excepción de autonomía', () => {
    const sesion = sesionSeca();
    const humanas = sesion.final.state.decisionAutonomy.filter(
      (decision) => decision.decisionMaker === 'human',
    );
    expect(humanas).toHaveLength(1);
    expect(humanas[0]).toMatchObject({
      decisionType: 'session.projection.updated',
      autonomyStatus: 'human-exception',
      reasonCode: 'dry_session:intervencion_humana',
    });
    // El resto de la sesión sigue siendo del motor: la intervención no la tiñe.
    expect(
      sesion.final.state.decisionAutonomy.filter(
        (decision) => decision.decisionMaker === 'engine',
      ).length,
    ).toBeGreaterThan(0);
  });

  it('sobrevive al replay y llega a la bitácora con su atribución', () => {
    const sesion = sesionSeca();
    const replay = replaySessionStateEvents(sesion.eventos);
    expect(
      replay.state.decisionAutonomy.filter((decision) => decision.decisionMaker === 'human'),
    ).toHaveLength(1);

    const humanas = bitacoraDeSesionSeca(sesion)
      .events()
      .filter((event) => event.decisionMaker === 'human');
    expect(humanas).toHaveLength(1);
    expect(humanas[0]?.autonomyStatus).toBe('human-exception');
  });

  it('el modelo no puede figurar como autor de una decisión autoritativa', () => {
    const sesion = sesionSeca();
    expect(() =>
      updateSessionProjection(
        sesion.final,
        { activeKcIds: ['KC06', 'KC07'] },
        'decision_del_modelo',
        meta('dry-event-modelo', 220, {
          decisionMaker: 'model' as never,
          autonomyStatus: 'autonomous',
        }),
      ),
    ).toThrow();
    expect(
      sesion.final.state.decisionAutonomy.some(
        (decision) => (decision.decisionMaker as string) === 'model',
      ),
    ).toBe(false);
  });

  it('una transición primaria no se puede atribuir a una persona', () => {
    const sesion = sesionSeca();
    const enPractica = sesion.mutaciones.find(
      (mutation) => mutation.snapshot.state.primaryState === 'practica',
    );
    if (enPractica === undefined) throw new Error('la sesión seca no llegó a práctica');
    expect(() =>
      transitionPrimarySessionState(
        enPractica.snapshot,
        'evaluacion_operativa',
        'transicion_humana',
        meta('dry-event-transicion-humana', 221, {
          decisionMaker: 'human',
          autonomyStatus: 'human-exception',
        }),
      ),
    ).toThrow(/solo el motor/u);
  });
});
