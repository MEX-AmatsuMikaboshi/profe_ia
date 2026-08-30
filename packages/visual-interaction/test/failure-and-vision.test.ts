import { describe, expect, it } from 'vitest';

import {
  FAILURE_CLASSES,
  FailureAttributionError,
  NON_CONCEPTUAL_CLASSES,
  classifyFailure,
  type FailureObservation,
} from '../src/failure-attribution.js';
import {
  VISION_GROUNDS,
  VisionPolicyError,
  isConfidentError,
  visionAction,
  visionEligibility,
  visionThresholds,
} from '../src/vision-policy.js';

const DESCARTADA = { ruledOut: true, evidence: 'revisado en el replay del intento' };
const ABIERTA = { ruledOut: false, evidence: 'la transcripción no coincide con el trazo' };

function observacion(overrides: Partial<FailureObservation['rulings']> = {}): FailureObservation {
  return {
    attemptId: 'att-1',
    rulings: {
      PERCEPTION_ERROR: DESCARTADA,
      INTERFACE_ERROR: DESCARTADA,
      ACCESSIBILITY_ERROR: DESCARTADA,
      ...overrides,
    },
  };
}

describe('T-H8-07 — atribución de fallos', () => {
  it('las cuatro clases son las de DEC-FAILURE-ATTRIBUTION-001', () => {
    expect([...FAILURE_CLASSES]).toStrictEqual([
      'PERCEPTION_ERROR',
      'INTERFACE_ERROR',
      'ACCESSIBILITY_ERROR',
      'CONCEPTUAL_ERROR',
    ]);
  });

  it('conceptual sólo con las otras tres descartadas', () => {
    const r = classifyFailure(observacion());
    expect(r.outcome).toBe('attributed');
    if (r.outcome !== 'attributed') return;
    expect(r.failureClass).toBe('CONCEPTUAL_ERROR');
    expect(r.countsAsKcFailure).toBe(true);
    expect(r.consumesEligibleAttempt).toBe(true);
  });

  it('las tres no conceptuales NO cuentan como fallo de KC ni consumen intento', () => {
    // Contar un PERCEPTION_ERROR como fallo de KC mide la calidad de nuestro OCR
    // y la anota como conocimiento del alumno.
    for (const clase of NON_CONCEPTUAL_CLASSES) {
      const r = classifyFailure(observacion({ [clase]: ABIERTA }));
      expect(r.outcome).toBe('attributed');
      if (r.outcome !== 'attributed') return;
      expect(r.failureClass).toBe(clase);
      expect(r.countsAsKcFailure).toBe(false);
      expect(r.consumesEligibleAttempt).toBe(false);
    }
  });

  it('varias clases abiertas quedan pendientes en vez de adivinar', () => {
    const r = classifyFailure(
      observacion({ PERCEPTION_ERROR: ABIERTA, INTERFACE_ERROR: ABIERTA }),
    );
    expect(r.outcome).toBe('pending_audit');
    if (r.outcome !== 'pending_audit') return;
    expect(r.unresolved).toHaveLength(2);
    // Un intento pendiente tampoco consume: todavía no se sabe si falló.
    expect(r.consumesEligibleAttempt).toBe(false);
  });

  it('un descarte sin evidencia LANZA: si no, «conceptual» sería el cajón por omisión', () => {
    expect(() =>
      classifyFailure(observacion({ PERCEPTION_ERROR: { ruledOut: true, evidence: '  ' } })),
    ).toThrow(FailureAttributionError);
  });

  it('falta un dictamen entero y lanza', () => {
    const rota = {
      attemptId: 'att-2',
      rulings: { PERCEPTION_ERROR: DESCARTADA, INTERFACE_ERROR: DESCARTADA },
    } as unknown as FailureObservation;
    expect(() => classifyFailure(rota)).toThrow(/ACCESSIBILITY_ERROR/u);
  });
});

describe('T-H8-04 — estado estructurado antes que visión', () => {
  it('si la estructura responde, la visión no entra', () => {
    const r = visionEligibility({
      structuredStateAnswers: true,
      ground: 'handwriting',
      confidence: 0.99,
    });
    // Ni siquiera con un motivo válido y confianza altísima: la pregunta ya
    // estaba respondida por un dato exacto.
    expect(r.outcome).toBe('not_needed');
  });

  it('sin motivo declarado se rechaza aunque la estructura no responda', () => {
    const r = visionEligibility({
      structuredStateAnswers: false,
      ground: null,
      confidence: 0.99,
    });
    expect(r.outcome).toBe('refused');
  });

  it('los cinco motivos de §8.9.1 son los que hay', () => {
    expect([...VISION_GROUNDS]).toStrictEqual([
      'handwriting',
      'semantic_drawing',
      'imported_image',
      'ambiguous_region',
      'authorized_capture',
    ]);
    for (const ground of VISION_GROUNDS) {
      expect(
        visionEligibility({ structuredStateAnswers: false, ground, confidence: 0.5 }).outcome,
      ).toBe('eligible');
    }
  });
});

describe('CAL-MULTIMODAL falla cerrado y ningún score valida', () => {
  it('`visionThresholds()` lanza en vez de devolver dos números plausibles', () => {
    expect(() => visionThresholds()).toThrow(VisionPolicyError);
    expect(() => visionThresholds()).toThrow(/CAL-MULTIMODAL|calibrad/u);
  });

  it('ninguna acción de la política es «dar por válido»', () => {
    // DEC-VISION-001. La más permisiva, `observe`, sólo autoriza registrar.
    const umbrales = { observe: 0.9, confirm: 0.6 };
    const acciones = [0.95, 0.7, 0.2].map((c) => visionAction(c, umbrales));
    expect(acciones).toStrictEqual(['observe', 'confirm', 'decline']);
    expect(acciones).not.toContain('validate');
    expect(acciones).not.toContain('accept');
  });

  it('una confianza fuera de 0..1 lanza', () => {
    expect(() => visionAction(1.5, { observe: 0.9, confirm: 0.6 })).toThrow(/0\.\.1/u);
  });

  it('un `decline` equivocado NO es un error confiado', () => {
    // El sistema dijo que no sabía, y acertó al decirlo. Contarlo como error
    // confiado castigaría justo la conducta que se quiere.
    expect(
      isConfidentError({
        observationId: 'obs-1',
        confidence: 0.2,
        actionTaken: 'decline',
        perceived: 'A∧B',
        actual: 'A∨B',
        ground: 'handwriting',
      }),
    ).toBe(false);
  });

  it('un `observe` equivocado SÍ es un error confiado', () => {
    expect(
      isConfidentError({
        observationId: 'obs-2',
        confidence: 0.97,
        actionTaken: 'observe',
        perceived: 'A∧B',
        actual: 'A∨B',
        ground: 'handwriting',
      }),
    ).toBe(true);
  });
});
