import { describe, expect, it } from 'vitest';
import {
  buildSelectionManifest,
  IncompleteSelectionManifestError,
  INVENTORY_STATUSES,
  manifestReadiness,
  saturationReport,
  type SelectionManifestInput,
} from '../src/index.js';

const SHA = 'b'.repeat(64);

function entrada(overrides: Partial<SelectionManifestInput> = {}): SelectionManifestInput {
  return {
    courseId: 'deduccion-natural',
    inventory: [
      {
        sourceComponent: 'calgary-cap-3',
        sourceVersion: 'Fall 2025',
        status: 'autorizado',
        snapshotSha256: SHA,
        licenseEvidence: 'CC BY 4.0, pagina de creditos',
        attributionChain: ['forall x: Calgary', 'Open Logic Project'],
      },
      {
        sourceComponent: 'ejercicio-de-tercero',
        sourceVersion: 'Fall 2025',
        status: 'LICENSE_UNRESOLVED',
        snapshotSha256: SHA,
        licenseEvidence: 'used with permission, sin proveniencia granular',
        attributionChain: ['forall x: Lorain County Remix'],
      },
    ],
    licenseVerdicts: [
      {
        sourceComponent: 'calgary-cap-3',
        verdict: { status: 'autorizado', blocked: false, reason: 'CC BY' },
      },
    ],
    scores: [
      {
        sourceComponent: 'calgary-cap-3',
        observations: {
          autoridad: 0.9,
          revision: 0.8,
          estabilidad: 0.8,
          explicitud: 0.9,
          verificabilidad: 0.7,
          cobertura: 0.6,
        },
        scalarAvailable: false,
      },
    ],
    saturation: saturationReport([
      { round: 1, newItems: 5, reviewedItems: 10, lineages: ['calgary', 'ocw'] },
    ]),
    conflicts: [],
    selectionRationale: 'Calgary cubre el cálculo objetivo; el resto queda fuera por licencia.',
    authorizableReferences: ['calgary-cap-3@Fall2025'],
    ...overrides,
  };
}

describe('salida de W0 completa (T-H45-06 ← P-I §7.0)', () => {
  it('los cuatro estados de inventario son los literales', () => {
    expect(INVENTORY_STATUSES).toEqual([
      'autorizado',
      'excluido',
      'LICENSE_UNRESOLVED',
      'pendiente',
    ]);
  });

  it('construye el manifiesto y cuenta por estado', () => {
    const m = buildSelectionManifest(entrada());

    expect(m.manifestVersion).toBe('w0-selection-manifest-v1');
    expect(m.counts).toEqual({
      autorizado: 1,
      excluido: 0,
      LICENSE_UNRESOLVED: 1,
      pendiente: 0,
    });
  });

  it('ninguna sección es opcional', () => {
    const vacios: readonly Partial<SelectionManifestInput>[] = [
      { courseId: '' },
      { inventory: [] },
      { licenseVerdicts: [] },
      { scores: [] },
      { selectionRationale: '   ' },
      { authorizableReferences: [] },
    ];

    for (const hueco of vacios) {
      expect(() => buildSelectionManifest(entrada(hueco))).toThrow(IncompleteSelectionManifestError);
    }
  });

  it('un inventario vacío no es «no había nada», es «no se buscó»', () => {
    expect(() => buildSelectionManifest(entrada({ inventory: [] }))).toThrow(
      IncompleteSelectionManifestError,
    );
  });

  it('cada componente exige snapshot válido y evidencia de licencia', () => {
    const sinSnapshot = entrada({
      inventory: [{ ...entrada().inventory[0]!, snapshotSha256: 'corto' }],
    });
    const sinEvidencia = entrada({
      inventory: [{ ...entrada().inventory[0]!, licenseEvidence: '' }],
    });

    expect(() => buildSelectionManifest(sinSnapshot)).toThrow(IncompleteSelectionManifestError);
    expect(() => buildSelectionManifest(sinEvidencia)).toThrow(IncompleteSelectionManifestError);
  });

  it('los scores van como observaciones y declaran que el escalar no está', () => {
    // Si el manifiesto guardara un número, presentaría al aprobador como medido
    // un orden que nadie ha calibrado (T-H45-04).
    const m = buildSelectionManifest(entrada());

    expect(m.scores[0]?.scalarAvailable).toBe(false);
    expect(m.scores[0]).not.toHaveProperty('score');
    expect(m.saturation.stopDecisionAvailable).toBe(false);
  });

  it('la disponibilidad para el gate detalla qué falta, no solo que falta', () => {
    const m = buildSelectionManifest(entrada());
    const r = manifestReadiness(m);

    expect(r.hasAuthorized).toBe(true);
    expect(r.unresolvedComponents).toEqual(['ejercicio-de-tercero']);
    expect(r.pendingComponents).toEqual([]);
  });
});
