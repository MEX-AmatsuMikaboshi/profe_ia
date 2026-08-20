import { describe, expect, it } from 'vitest';

import {
  CorpusBlockedError,
  CorpusDriftError,
  runW1,
  sha256Hex,
  UnauthorizedComponentError,
  type LoadedComponent,
  type SelectionManifest,
  type W1RunInput,
} from '../src/index.js';

const TARBALL_SHA = 'a'.repeat(64);

function manifiesto(): SelectionManifest {
  return {
    manifestVersion: 'w0-selection-manifest-v1',
    courseId: 'curso-fixture',
    inventory: [
      {
        sourceComponent: 'comp/a',
        sourceVersion: 'main@abc123 (2026-01-01)',
        status: 'autorizado',
        snapshotSha256: TARBALL_SHA,
        licenseEvidence: 'CC BY 4.0 — fixture',
        attributionChain: ['Autor Fixture'],
      },
    ],
    licenseVerdicts: [
      {
        sourceComponent: 'comp/a',
        verdict: { status: 'autorizado', blocked: false, reason: 'fixture' },
      },
    ],
    scores: [
      {
        sourceComponent: 'comp/a',
        observations: {
          autoridad: 1,
          revision: 1,
          estabilidad: 1,
          explicitud: 1,
          verificabilidad: 1,
          cobertura: 1,
        },
        scalarAvailable: false,
      },
    ],
    saturation: {
      curve: [{ round: 1, newItems: 1, newFraction: 1 }],
      diversity: { distinctLineages: 1, totalFindings: 1, diversityRatio: 1 },
      stopDecisionAvailable: false,
    },
    conflicts: [],
    selectionRationale: 'fixture',
    authorizableReferences: ['comp/a@main@abc123 (2026-01-01)#' + TARBALL_SHA],
    counts: { autorizado: 1, excluido: 0, LICENSE_UNRESOLVED: 0, pendiente: 0 },
  };
}

function componente(texto = 'contenido textual del componente'): LoadedComponent {
  return {
    sourceComponent: 'comp/a',
    sourceVersion: 'main@abc123 (2026-01-01)',
    origin: 'Fixture / pruebas',
    notationFamily: 'fitch',
    content: texto,
    sections: [
      {
        location: 'libro.tex#sec-1',
        kind: 'seccion',
        text: 'Texto de la sección uno.',
        relatedConcepts: ['KC01'],
      },
    ],
  };
}

function entrada(overrides: Partial<W1RunInput> = {}): W1RunInput {
  return {
    manifest: manifiesto(),
    components: [{ loaded: componente(), tarballSha256: TARBALL_SHA }],
    authorizedNotationFamily: 'fitch',
    candidateKcs: ['KC01'],
    requiredSections: [{ sourceComponent: 'comp/a', location: 'libro.tex#sec-1' }],
    useVerdicts: [
      {
        sourceComponent: 'comp/a',
        intendedUse: 'fuente_documental',
        verdict: { status: 'autorizado', blocked: false, reason: 'fixture' },
      },
      {
        sourceComponent: 'comp/a',
        intendedUse: 'base_expresiva',
        verdict: { status: 'autorizado', blocked: false, reason: 'fixture' },
      },
    ],
    ...overrides,
  };
}

describe('runW1 (T-H5-01)', () => {
  it('ingiere con identidad en dos niveles y fija el hash de contenido en la primera ingesta', () => {
    const resultado = runW1(entrada());

    expect(resultado.corpus.fragments).toHaveLength(1);
    expect(resultado.corpus.courseId).toBe('curso-fixture');
    const hashContenido = sha256Hex('contenido textual del componente');
    expect(resultado.contentSha256['comp/a']).toBe(hashContenido);
    expect(resultado.identityNotes[0]).toContain('primera ingesta');
    // La proyección: el componente ingerido registra el hash del contenido,
    // no el del tarball — cada nivel en su sustrato (D-51).
    expect(resultado.corpus.components[0].snapshotSha256).toBe(hashContenido);
  });

  it('rechaza deriva a nivel tarball: el hash de bytes no es el que W0 registró', () => {
    expect(() =>
      runW1(entrada({ components: [{ loaded: componente(), tarballSha256: 'b'.repeat(64) }] })),
    ).toThrow(CorpusDriftError);
  });

  it('rechaza deriva de contenido frente a la ingesta previa', () => {
    const previa = runW1(entrada());
    expect(() =>
      runW1(
        entrada({
          components: [{ loaded: componente('contenido EDITADO'), tarballSha256: TARBALL_SHA }],
          priorContentSha256: previa.contentSha256,
        }),
      ),
    ).toThrow(CorpusDriftError);
  });

  it('acepta una re-ingesta idéntica a la previa, sin notas de fijación', () => {
    const previa = runW1(entrada());
    const reingesta = runW1(entrada({ priorContentSha256: previa.contentSha256 }));
    expect(reingesta.identityNotes).toHaveLength(0);
    expect(reingesta.corpus.fragments).toHaveLength(1);
  });

  it('las seis validaciones de P-III §3.2 siguen mandando: sección requerida ausente bloquea', () => {
    expect(() =>
      runW1(
        entrada({
          requiredSections: [{ sourceComponent: 'comp/a', location: 'libro.tex#no-existe' }],
        }),
      ),
    ).toThrow(CorpusBlockedError);
  });

  it('un componente fuera del manifiesto de W0 no se ingiere', () => {
    const otro = { ...componente(), sourceComponent: 'comp/no-evaluado' };
    expect(() =>
      runW1(entrada({ components: [{ loaded: otro, tarballSha256: TARBALL_SHA }] })),
    ).toThrow(UnauthorizedComponentError);
  });

  it('sin veredictos de uso el componente no es utilizable y bloquea', () => {
    expect(() => runW1(entrada({ useVerdicts: [] }))).toThrow(CorpusBlockedError);
  });
});
