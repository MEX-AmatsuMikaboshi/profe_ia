import { describe, expect, it } from 'vitest';

import { drySessionViewInput } from '../src/clase/dry-session';
import {
  ClaseViewError,
  F7_SUPPORTED_CAPABILITIES,
  assertCapabilitiesImplemented,
  buildClaseViewModel,
  type ClaseViewInput,
} from '../src/clase/view-model';

/**
 * T-H6-13 — la vista no decide: se deriva del estado de sesión, y lo que la
 * norma prohíbe no se puede construir (UI-CORR-02, UI-CORR-04, T-H7-07).
 */

const base = (): ClaseViewInput => drySessionViewInput();

/** Mismo estado, en modo de medición y coherente con lo que el motor exige. */
function enMedicion(input: ClaseViewInput, probeItemPresented = false): ClaseViewInput {
  return {
    ...input,
    session: {
      ...input.session,
      pedagogicalMode: 'MEASUREMENT_MODE',
      selectedStrategy: null,
      assistanceLevel: 0,
      masteryEligibility: false,
    },
    // En medición no hay feedback: la transcripción de guion tampoco lo lleva.
    transcript: input.transcript.filter((entry) => entry.actKind === 'practice_statement'),
    activity: input.activity === null ? null : { ...input.activity, probeItemPresented },
  };
}

describe('modelo de vista de Clase (T-H6-13)', () => {
  it('la sesión seca produce un modelo completo', () => {
    const vm = buildClaseViewModel(base());
    expect(vm.pedagogicalMode).toBe('LEARNING_MODE');
    expect(vm.probeNotice).toBeNull();
    expect(vm.primaryState).toBe('practica');
    expect(vm.rubric?.criteria).toHaveLength(3);
    expect(vm.navigationVisible).toBe(false);
    expect(vm.fitchEditorVisible).toBe(true);
  });

  it('en LEARNING_MODE ofrece la pista siguiente y respeta el tope del banco', () => {
    expect(buildClaseViewModel(base()).hints).toEqual({
      available: true,
      nextLevel: 1,
      maximumLevel: 5,
    });
    expect(
      buildClaseViewModel({ ...base(), hintLevelsDelivered: [1, 2] }).hints,
    ).toMatchObject({ available: true, nextLevel: 3 });
    expect(
      buildClaseViewModel({ ...base(), hintLevelsDelivered: [1, 2, 3, 4, 5] }).hints,
    ).toEqual({ available: false, reason: 'banco_agotado' });
    expect(buildClaseViewModel({ ...base(), hintMaximumLevel: null }).hints).toEqual({
      available: false,
      reason: 'sin_banco',
    });
  });

  // ─────────────────────────── UI-CORR-02 ───────────────────────────

  it('en MEASUREMENT_MODE emite el aviso con sus cuatro puntos', () => {
    const vm = buildClaseViewModel(enMedicion(base()));
    expect(vm.probeNotice).toEqual({
      hintsDisabled: true,
      pedagogicalFeedbackSuppressed: true,
      agentWithoutMeasurementAuthority: true,
      futureBanksHidden: true,
    });
  });

  it('en MEASUREMENT_MODE las pistas no se pueden habilitar', () => {
    const vm = buildClaseViewModel({ ...enMedicion(base()), hintLevelsDelivered: [] });
    expect(vm.hints).toEqual({ available: false, reason: 'measurement_mode' });
  });

  it('un estado de medición incoherente lanza en vez de renderizarse', () => {
    const input = enMedicion(base());
    for (const parche of [
      { assistanceLevel: 3 },
      { masteryEligibility: true },
      { selectedStrategy: 'direct_explanation' as const },
    ]) {
      expect(() =>
        buildClaseViewModel({ ...input, session: { ...input.session, ...parche } }),
      ).toThrow(ClaseViewError);
    }
  });

  it('un feedback pedagógico durante la sonda lanza: no se oculta y ya', () => {
    const input = enMedicion(base());
    const conFeedback: ClaseViewInput = {
      ...input,
      transcript: [
        ...input.transcript,
        {
          entryId: 't-feedback',
          speaker: 'profesor_ia',
          text: 'Casi, revisa la línea 2.',
          at: '2026-01-01T10:00:20.000Z',
          actKind: 'templated_feedback',
          provenance: {
            kind: 'scripted',
            contentId: 'c-fb',
            catalogVersion: 'dry-session-dev-v1',
            deliveryMode: 'script',
            liveGeneration: false,
          },
        },
      ],
    };
    expect(() => buildClaseViewModel(conFeedback)).toThrow(/FEEDBACK_EN_MEDICION/);
  });

  // ─────────────────────────── pausa (T-H6-08) ───────────────────────────

  it('pausar antes de ver el reactivo no tiene consecuencia declarada', () => {
    expect(buildClaseViewModel(enMedicion(base(), false)).pause.consequence).toBe('ninguna');
  });

  it('pausar con el reactivo ya presentado lo invalida, y se declara', () => {
    expect(buildClaseViewModel(enMedicion(base(), true)).pause.consequence).toBe(
      'invalida_el_reactivo_de_sonda_en_curso',
    );
  });

  it('en pausa no hay pistas ni se puede volver a pausar', () => {
    const input = base();
    const vm = buildClaseViewModel({
      ...input,
      session: { ...input.session, transverseStates: ['pausa'] },
    });
    expect(vm.pause).toMatchObject({ available: false, paused: true });
    expect(vm.hints).toEqual({ available: false, reason: 'sesion_pausada' });
  });

  // ─────────────────────────── UI-CORR-04 ───────────────────────────

  it('apelación y retirada están siempre disponibles, y la apelación no abre rescate en vivo', () => {
    for (const input of [base(), enMedicion(base())]) {
      const vm = buildClaseViewModel(input);
      expect(vm.appeal).toEqual({
        available: true,
        effect: 'registro_para_revision_humana_posterior',
        liveHumanPedagogicalIntervention: false,
      });
      expect(vm.withdrawal.available).toBe(true);
    }
  });

  // ─────────────────────────── T-H7-07 ───────────────────────────

  it('una capacidad multimodal encendida lanza: F7 es texto+Fitch', () => {
    for (const capacidad of ['voiceInput', 'voiceOutput', 'whiteboard', 'uiAnnotations'] as const) {
      expect(() =>
        assertCapabilitiesImplemented({ ...F7_SUPPORTED_CAPABILITIES, [capacidad]: true }),
      ).toThrow(/CAPACIDAD_NO_IMPLEMENTADA/);
    }
    expect(() => assertCapabilitiesImplemented(F7_SUPPORTED_CAPABILITIES)).not.toThrow();
  });

  // ─────────────────────── procedencia y rúbrica ───────────────────────

  it('un turno del Profesor IA sin procedencia de guion lanza: F7 es sesión seca', () => {
    const input = base();
    expect(() =>
      buildClaseViewModel({
        ...input,
        transcript: [
          {
            entryId: 't-live',
            speaker: 'profesor_ia',
            text: 'Improvisado.',
            at: '2026-01-01T10:00:30.000Z',
            actKind: null,
            provenance: { kind: 'engine', eventCode: 'x' },
          },
        ],
      }),
    ).toThrow(/ENTREGA_GENERADA_EN_VIVO/);
  });

  it('una actividad puntuable sin rúbrica lanza en vez de dejar el panel vacío', () => {
    const input = base();
    expect(() =>
      buildClaseViewModel({
        ...input,
        activity: { ...input.activity!, rubric: null },
      }),
    ).toThrow(/RUBRICA_AUSENTE/);
  });

  it('una actividad no puntuable sin rúbrica es correcta', () => {
    const input = base();
    const vm = buildClaseViewModel({
      ...input,
      activity: { ...input.activity!, scorable: false, rubric: null },
    });
    expect(vm.rubric).toBeNull();
  });

  it('el estado de guardado se propaga sin reinterpretarse', () => {
    const vm = buildClaseViewModel({
      ...base(),
      saveState: { kind: 'error', code: 'IO', detail: 'disco lleno' },
    });
    expect(vm.saveState).toEqual({ kind: 'error', code: 'IO', detail: 'disco lleno' });
  });
});
