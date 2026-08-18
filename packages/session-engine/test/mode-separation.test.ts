import { describe, expect, it } from 'vitest';

import {
  SessionStateMachineError,
  enterMeasurementModeForProbe,
  exitMeasurementModeFromProbeResult,
  initializeSessionState,
  transitionPrimarySessionState,
  updateSessionFromDoubtClassification,
  updateSessionProjection,
  type SessionDecisionMetadata,
  type SessionSnapshot,
} from '../src/index.js';

/**
 * `ci:mode-separation` — AC del gate H6 (Plan.md §F7).
 *
 * El plan pide dos cosas: que `LEARNING_MODE` y `MEASUREMENT_MODE` estén
 * **separados por pruebas automatizadas**, y que **la sonda desactive la
 * ayuda**. No es una propiedad decorativa: si una sonda midiera con andamiaje
 * activo, `probe_accuracy` estaría midiendo la ayuda y no al alumno, y la
 * medida primaria del experimento quedaría contaminada sin que nadie lo note.
 *
 * Las expectativas están declaradas antes de ejecutar. Donde el motor todavía
 * no garantiza la propiedad, la prueba lo dice en vez de rebajarse a comprobar
 * lo que sí hace.
 */

const AT = '2026-08-18T12:00:00.000Z';

function at(second: number): string {
  return `2026-08-18T12:00:${String(second).padStart(2, '0')}.000Z`;
}

function metadata(
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

const INTENT = {
  experimentalSet: 'set-A',
  phase: 'baseline',
  measureKind: 'primary_probe',
} as const;

/** Tres de tres correctas: `observation` tiene que ser exactamente 1. */
const RESULT = {
  opportunityId: 'op-1',
  probeRoundId: null,
  plannedItems: 3,
  validScoredItems: 3,
  correctValidItems: 3,
  observation: 1,
  operationalValidity: 'valid',
  reasonCode: null,
} as const;

function sesionEnPractica(): SessionSnapshot {
  let snapshot = initializeSessionState(
    {
      sessionId: 'session-mode-1',
      runId: 'run-mode-1',
      participantPseudoId: 'pseudo-mode-1',
      courseId: 'course-mode-1',
      packageVersion: {
        artifactId: 'paquete-sintetico-dev',
        version: '0.0.0-dev',
        hash: 'a'.repeat(64),
      },
      plannedDurationSeconds: 3_600,
    },
    { eventId: 'event-mode-0', occurredAt: AT },
  ).snapshot;

  const ruta = [
    'autenticacion',
    'consentimiento_confirmado',
    'diagnostico',
    'explicacion',
    'comprobacion',
    'practica',
  ] as const;
  ruta.forEach((estado, indice) => {
    snapshot = transitionPrimarySessionState(
      snapshot,
      estado,
      `ruta:${estado}`,
      metadata(`event-mode-${String(indice + 1)}`, indice + 1),
    ).snapshot;
  });
  return snapshot;
}

describe('separación de modos', () => {
  it('la sesión arranca en LEARNING_MODE', () => {
    expect(sesionEnPractica().state.pedagogicalMode).toBe('LEARNING_MODE');
  });

  it('entrar en sonda apaga la ayuda y la elegibilidad de dominio', () => {
    const practica = sesionEnPractica();
    const { mutation } = enterMeasurementModeForProbe(
      practica,
      INTENT,
      'sonda:apertura',
      metadata('event-mode-probe', 10),
    );

    expect(mutation.snapshot.state.pedagogicalMode).toBe('MEASUREMENT_MODE');
    // «Sonda desactiva ayuda»: nivel de asistencia a cero y sin estrategia.
    expect(mutation.snapshot.state.assistanceLevel).toBe(0);
    expect(mutation.snapshot.state.selectedStrategy).toBeNull();
    // Una sonda no acredita dominio: la elegibilidad se apaga al entrar.
    expect(mutation.snapshot.state.masteryEligibility).toBe(false);
  });

  it('deja rastro de que la sonda está activa', () => {
    const { mutation } = enterMeasurementModeForProbe(
      sesionEnPractica(),
      INTENT,
      'sonda:apertura',
      metadata('event-mode-probe', 10),
    );
    const activa = mutation.snapshot.state.nextSteps.filter(
      (step) => step.action === 'measurement_mode_active',
    );
    expect(activa).toHaveLength(1);
    expect(activa[0]?.targetId).toBe('set-A');
  });

  it('no se entra dos veces en MEASUREMENT_MODE', () => {
    const { mutation } = enterMeasurementModeForProbe(
      sesionEnPractica(),
      INTENT,
      'sonda:apertura',
      metadata('event-mode-probe', 10),
    );
    expect(() =>
      enterMeasurementModeForProbe(
        mutation.snapshot,
        INTENT,
        'sonda:otra',
        metadata('event-mode-probe-2', 11),
      ),
    ).toThrow(SessionStateMachineError);
  });

  it('no se consume un resultado de sonda fuera de MEASUREMENT_MODE', () => {
    expect(() =>
      exitMeasurementModeFromProbeResult(
        sesionEnPractica(),
        RESULT,
        'sonda:cierre',
        metadata('event-mode-exit', 12),
      ),
    ).toThrow(/fuera de MEASUREMENT_MODE/);
  });

  it('salir de la sonda devuelve a LEARNING_MODE y retira el rastro', () => {
    const dentro = enterMeasurementModeForProbe(
      sesionEnPractica(),
      INTENT,
      'sonda:apertura',
      metadata('event-mode-probe', 10),
    ).mutation.snapshot;

    const fuera = exitMeasurementModeFromProbeResult(
      dentro,
      RESULT,
      'sonda:cierre',
      metadata('event-mode-exit', 12),
    ).mutation.snapshot;

    expect(fuera.state.pedagogicalMode).toBe('LEARNING_MODE');
    expect(fuera.state.assistanceLevel).toBe(0);
    expect(
      fuera.state.nextSteps.some((step) => step.action === 'measurement_mode_active'),
    ).toBe(false);
  });

  it('el resultado de la sonda queda registrado como cambio de plan, no se pierde', () => {
    const dentro = enterMeasurementModeForProbe(
      sesionEnPractica(),
      INTENT,
      'sonda:apertura',
      metadata('event-mode-probe', 10),
    ).mutation.snapshot;

    const fuera = exitMeasurementModeFromProbeResult(
      dentro,
      RESULT,
      'sonda:cierre',
      metadata('event-mode-exit', 12),
    ).mutation.snapshot;

    const registrado = fuera.state.planChanges.filter((cambio) =>
      cambio.description.startsWith('measurement:op-1:'),
    );
    expect(registrado).toHaveLength(1);
    expect(registrado[0]?.description).toContain('valid');
  });

  it('salir de la sonda no vuelve a habilitar la elegibilidad de dominio por su cuenta', () => {
    const dentro = enterMeasurementModeForProbe(
      sesionEnPractica(),
      INTENT,
      'sonda:apertura',
      metadata('event-mode-probe', 10),
    ).mutation.snapshot;

    const fuera = exitMeasurementModeFromProbeResult(
      dentro,
      RESULT,
      'sonda:cierre',
      metadata('event-mode-exit', 12),
    ).mutation.snapshot;

    // Que la sonda termine no acredita nada: quien acredita dominio es
    // `domain-engine` con su transferencia, no el hecho de haber medido.
    expect(fuera.state.masteryEligibility).toBe(false);
  });
});

/**
 * El invariante está en el **esquema del estado**, no en una comprobación por
 * función, y esa es la diferencia que importa: vale para todos los caminos que
 * produzcan un estado, incluidos los que todavía no existen. Una guarda por
 * función protege la función que alguien se acordó de proteger.
 */
describe('la sonda apaga la ayuda por invariante de estado, no por cortesía', () => {
  function enSonda(): SessionSnapshot {
    return enterMeasurementModeForProbe(
      sesionEnPractica(),
      INTENT,
      'sonda:apertura',
      metadata('event-mode-probe', 10),
    ).mutation.snapshot;
  }

  it('no se puede subir el nivel de ayuda estando en sonda', () => {
    expect(() =>
      updateSessionProjection(
        enSonda(),
        { assistanceLevel: 2 },
        'pista:nivel-2',
        metadata('event-mode-hint', 11),
      ),
    ).toThrow(/MEASUREMENT_MODE no admite estrategia, ayuda ni elegibilidad/);
  });

  it('no se puede seleccionar estrategia pedagógica estando en sonda', () => {
    expect(() =>
      updateSessionProjection(
        enSonda(),
        { selectedStrategy: 'worked_example' },
        'estrategia:ejemplo',
        metadata('event-mode-strategy', 11),
      ),
    ).toThrow(/MEASUREMENT_MODE no admite/);
  });

  it('no se puede acreditar elegibilidad de dominio estando en sonda', () => {
    expect(() =>
      updateSessionProjection(
        enSonda(),
        { masteryEligibility: true },
        'dominio:elegible',
        metadata('event-mode-mastery', 11),
      ),
    ).toThrow(/MEASUREMENT_MODE no admite/);
  });

  it('en sonda, una duda tiene que venir suprimida; si no, se rechaza', () => {
    const noSuprimida = {
      doubtId: 'doubt-1',
      scope: 'in_scope' as const,
      suppressed: false,
      classification: 'clarification' as const,
    };
    expect(() =>
      updateSessionFromDoubtClassification(
        enSonda(),
        noSuprimida as never,
        'duda:clasificada',
        metadata('event-mode-doubt', 11),
      ),
    ).toThrow(SessionStateMachineError);
  });
});
