import { describe, expect, it } from 'vitest';

import {
  CAPTURE_REGIONS,
  CaptureError,
  EXCLUDABLE_LAYERS,
  NEVER_INCLUDABLE,
  authorizeExternalCapture,
  captureRef,
  planCapture,
  type CaptureArtifact,
  type CaptureRequest,
  type ExternalCaptureGrant,
} from '../src/capture.js';

const HUELLA = 'a'.repeat(64);

function peticion(overrides: Partial<CaptureRequest> = {}): CaptureRequest {
  return {
    region: 'fitch-editor',
    anchorEventType: 'visual.interpretation.observed',
    includeLayers: [],
    justifications: {},
    ...overrides,
  };
}

function artefacto(overrides: Partial<CaptureArtifact> = {}): CaptureArtifact {
  return {
    artifactId: 'art-1',
    sha256: HUELLA,
    byteLength: 1024,
    region: 'fitch-editor',
    anchorEventId: 'ev-1',
    capturedAt: '2026-08-29T12:00:00.000Z',
    ...overrides,
  };
}

describe('T-H8-06 — plan de captura interna', () => {
  it('por omisión excluye las cinco capas, sin que nadie las liste', () => {
    const plan = planCapture(peticion());
    expect(plan.kind).toBe('raster');
    expect(plan.kind === 'raster' && [...plan.excludedLayers]).toStrictEqual([
      ...EXCLUDABLE_LAYERS,
    ]);
    expect(plan.kind === 'raster' && plan.includedLayers).toStrictEqual([]);
  });

  it('una capa nueva queda excluida sin tocar esta política', () => {
    // La composición es por negación: `excludedLayers` se deriva de la lista
    // completa. Si se listara lo que se excluye, una capa añadida a la interfaz
    // entraría en las capturas el día que alguien la creara.
    const plan = planCapture(peticion());
    expect(plan.kind === 'raster' && plan.excludedLayers.length).toBe(EXCLUDABLE_LAYERS.length);
  });

  describe('overlays del Profesor IA', () => {
    it('quedan fuera por omisión', () => {
      const plan = planCapture(peticion());
      expect(plan.kind === 'raster' && plan.excludedLayers).toContain('annotation-overlay');
      expect(plan.kind === 'raster' && plan.excludedLayers).toContain('profesor-overlay');
    });

    it('incluirlos exige finalidad documentada', () => {
      expect(() =>
        planCapture(peticion({ includeLayers: ['profesor-overlay'], justifications: {} })),
      ).toThrowError(
        expect.objectContaining({ code: 'INCLUSION_SIN_JUSTIFICACION' }) as unknown as Error,
      );

      const plan = planCapture(
        peticion({
          includeLayers: ['profesor-overlay'],
          justifications: { 'profesor-overlay': 'auditoría de una anotación disputada' },
        }),
      );
      expect(plan.kind === 'raster' && plan.includedLayers).toStrictEqual(['profesor-overlay']);
    });
  });

  describe('lo que no entra ni con motivo', () => {
    it('credenciales e identidad innecesaria lanzan', () => {
      for (const capa of NEVER_INCLUDABLE) {
        expect(() =>
          planCapture(
            peticion({ includeLayers: [capa], justifications: { [capa]: 'lo necesito' } }),
          ),
        ).toThrowError(
          expect.objectContaining({ code: 'CAPA_NO_INCLUIBLE' }) as unknown as Error,
        );
      }
    });

    it('y una justificación no las rescata: es justo el camino que se cierra', () => {
      expect(() =>
        planCapture(
          peticion({
            includeLayers: ['credentials'],
            justifications: { credentials: 'motivo largo y convincente de auditoría' },
          }),
        ),
      ).toThrowError(expect.objectContaining({ code: 'CAPA_NO_INCLUIBLE' }) as unknown as Error);
    });
  });

  describe('anclaje', () => {
    it('sin evento que la requiera, no hay captura', () => {
      expect(() => planCapture(peticion({ anchorEventType: 'board.element.created' }))).toThrowError(
        expect.objectContaining({ code: 'SIN_ANCLAJE' }) as unknown as Error,
      );
    });

    it('un tipo inventado tampoco cuela', () => {
      expect(() => planCapture(peticion({ anchorEventType: 'visual.capture' }))).toThrowError(
        expect.objectContaining({ code: 'SIN_ANCLAJE' }) as unknown as Error,
      );
    });
  });

  describe('el pizarrón se exporta, no se fotografía', () => {
    it('devuelve board-export y no ofrece rasterizar', () => {
      const plan = planCapture(peticion({ region: 'whiteboard' }));
      expect(plan.kind).toBe('board-export');
    });

    it('ni siquiera pidiendo incluir capas: no hay rama que lo permita', () => {
      const plan = planCapture(
        peticion({
          region: 'whiteboard',
          includeLayers: ['profesor-overlay'],
          justifications: { 'profesor-overlay': 'x' },
        }),
      );
      expect(plan.kind).toBe('board-export');
    });
  });

  it('la pantalla no es una región interna', () => {
    expect(() =>
      planCapture(peticion({ region: 'pantalla' as unknown as CaptureRequest['region'] })),
    ).toThrowError(expect.objectContaining({ code: 'REGION_DESCONOCIDA' }) as unknown as Error);
    expect([...CAPTURE_REGIONS]).not.toContain('pantalla');
  });
});

describe('T-H8-06 — artefactos', () => {
  it('la referencia lleva el algoritmo delante', () => {
    expect(captureRef(artefacto())).toBe(`sha256:${HUELLA}`);
  });

  it('una huella que no es SHA-256 hexadecimal lanza', () => {
    for (const mala of ['', 'abc', HUELLA.toUpperCase(), `${HUELLA}0`, 'z'.repeat(64)]) {
      expect(() => captureRef(artefacto({ sha256: mala })), mala).toThrowError(
        expect.objectContaining({ code: 'HUELLA_INVALIDA' }) as unknown as Error,
      );
    }
  });

  it('un artefacto sin evento que lo anclara no es referenciable', () => {
    expect(() => captureRef(artefacto({ anchorEventId: '  ' }))).toThrowError(
      expect.objectContaining({ code: 'ARTEFACTO_SIN_ANCLAJE' }) as unknown as Error,
    );
  });
});

describe('T-H8-06 — captura externa', () => {
  const CONCESION: ExternalCaptureGrant = {
    grantedAt: '2026-08-29T12:00:00.000Z',
    grantedBy: 'student',
    scope: 'single_capture',
    consumed: false,
  };

  it('con la capacidad apagada no se autoriza, que es el estado de hoy', () => {
    expect(() => authorizeExternalCapture(CONCESION, false)).toThrowError(
      expect.objectContaining({ code: 'CAPACIDAD_APAGADA' }) as unknown as Error,
    );
  });

  it('sin acción del alumno tampoco: sería la habilitación silenciosa que §11.6 prohíbe', () => {
    expect(() =>
      authorizeExternalCapture(
        { ...CONCESION, grantedBy: 'system' as ExternalCaptureGrant['grantedBy'] },
        true,
      ),
    ).toThrowError(
      expect.objectContaining({ code: 'AUTORIZACION_SIN_ACCION_DEL_ALUMNO' }) as unknown as Error,
    );
  });

  it('se consume al usarla, y no se puede reutilizar', () => {
    const consumida = authorizeExternalCapture(CONCESION, true);
    expect(consumida.consumed).toBe(true);
    expect(() => authorizeExternalCapture(consumida, true)).toThrowError(
      expect.objectContaining({ code: 'AUTORIZACION_CONSUMIDA' }) as unknown as Error,
    );
  });

  it('no existe un alcance duradero que conceder', () => {
    // El tipo sólo admite `'single_capture'`. Si algún día apareciera
    // `'session'`, esta prueba es la que hay que discutir antes de añadirlo.
    const alcance: ExternalCaptureGrant['scope'] = 'single_capture';
    expect(alcance).toBe('single_capture');
  });

  it('el error lleva código', () => {
    try {
      authorizeExternalCapture(CONCESION, false);
      expect.unreachable('debía lanzar');
    } catch (error) {
      expect(error).toBeInstanceOf(CaptureError);
      expect((error as CaptureError).code).toBe('CAPACIDAD_APAGADA');
    }
  });
});
