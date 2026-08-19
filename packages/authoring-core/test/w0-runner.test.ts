import { describe, expect, it } from 'vitest';
import {
  applyCorpusDecision,
  IncompleteSelectionManifestError,
  IncompleteW0RunError,
  InvalidCorpusDecisionError,
  NoEligibleClaimsError,
  OpenSearchNotComplementError,
  runW0,
  SourceNotWhitelistedError,
  W0ScopeError,
  type Candidate,
  type SourceEvaluation,
  type W0RunInput,
} from '../src/index.js';

/**
 * Replay determinista de una corrida W0 sobre fixtures: la línea de «Pruebas»
 * de F5 (Plan.md) que ninguna tarea T-H45 cubría. Los fixtures son datos
 * completos y válidos; cada prueba tuerce una sola cosa.
 */

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);

const OBSERVACIONES = {
  autoridad: 0.9,
  revision: 0.8,
  estabilidad: 0.7,
  explicitud: 0.9,
  verificabilidad: 0.8,
  cobertura: 0.6,
} as const;

function candidato(
  sourceId: string,
  accessMode: Candidate['accessMode'],
  url: string,
  sha: string,
): Candidate {
  return {
    sourceId,
    accessMode,
    record: {
      url,
      origin: `Repositorio de ${sourceId}`,
      version: 'v2026-01',
      retrievedAt: '2026-08-19T00:00:00.000Z',
      licenseEvidence: `Página de licencia de ${sourceId}, consultada 2026-08-19`,
      snapshotSha256: sha,
    },
  };
}

function evaluacion(
  candidateUrl: string,
  sourceComponent: string,
  overrides: Partial<SourceEvaluation> = {},
): SourceEvaluation {
  return {
    candidateUrl,
    sourceComponent,
    observations: OBSERVACIONES,
    claims: [
      {
        sourceId: sourceComponent,
        formalSystemId: 'forallx-calgary-tfl',
        notationFamily: 'fitch',
        version: 'v2026-01',
        scope: 'introduccion-conjuncion',
        statement: 'De A∧B se deriva A, y de A∧B se deriva B.',
        declaredClass: 'informacion_complementaria',
      },
    ],
    licenseRecord: {
      sourceComponent,
      sourceVersion: 'v2026-01',
      provenanceBasis: `Descargado de ${candidateUrl}`,
      licenseEvidence: 'CC BY 4.0, texto de la licencia archivado',
      terms: {
        licenseId: 'CC-BY-4.0',
        nonCommercial: false,
        shareAlike: false,
        noDerivatives: false,
        thirdPartyPermissionOnly: false,
      },
    },
    attributionChain: ['Autor original', 'Repositorio'],
    ...overrides,
  };
}

function fixture(): W0RunInput {
  const candidatos = [
    candidato('open-logic-project', 'api', 'https://example.test/olp/forallx', SHA_A),
    candidato('mit-ocw', 'indice_estable', 'https://example.test/ocw/logica', SHA_B),
    candidato('blog-ajeno', 'busqueda_abierta', 'https://example.test/blog/notas', SHA_C),
  ];
  return {
    courseId: 'deduccion-natural-u1',
    scope: { formalSystemId: 'forallx-calgary-tfl', topic: 'Deducción natural proposicional' },
    whitelist: [
      {
        sourceId: 'open-logic-project',
        name: 'Open Logic Project',
        accessMode: 'api',
        baseUrl: 'https://example.test/olp',
      },
      {
        sourceId: 'mit-ocw',
        name: 'MIT OpenCourseWare',
        accessMode: 'indice_estable',
        baseUrl: 'https://example.test/ocw',
      },
    ],
    candidates: candidatos,
    discoveryRounds: [
      { round: 1, newItems: 2, reviewedItems: 2, lineages: ['forallx', 'ocw-6.045'] },
      { round: 2, newItems: 1, reviewedItems: 3, lineages: ['notas-blog'] },
    ],
    evaluations: [
      evaluacion('https://example.test/olp/forallx', 'olp/forallx'),
      evaluacion('https://example.test/ocw/logica', 'mit-ocw/logica'),
      evaluacion('https://example.test/blog/notas', 'blog/notas'),
    ],
    licenseQuery: { intendedUse: 'base_expresiva' },
    selectionRationale:
      'Dos fuentes de la whitelist cubren el bloque con licencias preferidas; la de búsqueda ' +
      'abierta complementa ejemplos. Ningún escalar interviene: la selección se justifica por ' +
      'cobertura y licencia, no por un número.',
  };
}

describe('orquestador de W0 (F5/H4.5 ← P-I §7.0)', () => {
  it('recorre el flujo literal hasta propuesta_corpus y ahí se detiene', () => {
    const result = runW0(fixture());

    expect(result.finalState).toBe('propuesta_corpus');
    expect(result.history.map((paso) => paso.to)).toEqual([
      'alcance_acotado',
      'fuentes_descubiertas',
      'fuentes_evaluadas',
      'fuentes_comparadas',
      'licencias_clasificadas',
      'cobertura_evaluada',
      'propuesta_corpus',
    ]);
  });

  it('es determinista: dos corridas y un viaje de ida y vuelta por JSON dan lo mismo', () => {
    const input = fixture();
    const primera = runW0(input);
    const segunda = runW0(input);
    const rehidratada = runW0(JSON.parse(JSON.stringify(input)) as W0RunInput);

    expect(JSON.stringify(segunda)).toBe(JSON.stringify(primera));
    expect(JSON.stringify(rehidratada)).toBe(JSON.stringify(primera));
  });

  it('no arranca si el alcance declara otro sistema formal (T-H45-03)', () => {
    const input = fixture();
    const mal = { ...input, scope: { ...input.scope, formalSystemId: 'otro-calculo' } };
    expect(() => runW0(mal)).toThrow(W0ScopeError);
  });

  it('rechaza un candidato «api» fuera de la whitelist y una corrida solo de búsqueda abierta', () => {
    const input = fixture();
    const colado = {
      ...input,
      candidates: [...input.candidates, candidato('desconocida', 'api', 'https://x.test/a', SHA_A)],
    };
    expect(() => runW0(colado)).toThrow(SourceNotWhitelistedError);

    const soloAbiertos = {
      ...input,
      candidates: [candidato('blog-ajeno', 'busqueda_abierta', 'https://example.test/blog/notas', SHA_C)],
    };
    expect(() => runW0(soloAbiertos)).toThrow(OpenSearchNotComplementError);
  });

  it('un candidato sin evaluar o una evaluación sin candidato bloquean la corrida', () => {
    const input = fixture();
    const sinEvaluar = { ...input, evaluations: input.evaluations.slice(1) };
    expect(() => runW0(sinEvaluar)).toThrow(IncompleteW0RunError);

    const huerfana = {
      ...input,
      evaluations: [
        ...input.evaluations,
        evaluacion('https://example.test/nadie-la-descubrio', 'nadie'),
      ],
    };
    expect(() => runW0(huerfana)).toThrow(IncompleteW0RunError);
  });

  it('sin claims del sistema objetivo no hay mayoría que resolver (T-H45-03)', () => {
    const input = fixture();
    const ajenos = input.evaluations.map((e) => ({
      ...e,
      claims: e.claims.map((c) => ({ ...c, formalSystemId: 'otro-calculo' })),
    }));
    expect(() => runW0({ ...input, evaluations: ajenos })).toThrow(NoEligibleClaimsError);
  });

  it('el claim ajeno se reclasifica como sistema_formal_distinto y queda en conflicts', () => {
    const input = fixture();
    const conAjeno = input.evaluations.map((e, i) =>
      i === 0
        ? {
            ...e,
            claims: [
              ...e.claims,
              {
                sourceId: 'manual-ajeno',
                formalSystemId: 'otro-calculo',
                notationFamily: 'arbol',
                version: 'v1',
                scope: 'introduccion-conjuncion',
                statement: 'La conjunción se introduce por bifurcación.',
                // Quien evaluó lo declaró contradicción; ser de otro sistema gana.
                declaredClass: 'contradiccion_real' as const,
              },
            ],
          }
        : e,
    );
    const result = runW0({ ...input, evaluations: conAjeno });

    const comparacion = result.comparisons.find((c) => c.scope === 'introduccion-conjuncion');
    const reclasificado = comparacion?.classified.find(
      (c) => c.claim.sourceId === 'manual-ajeno',
    );
    expect(reclasificado?.differenceClass).toBe('sistema_formal_distinto');
    expect(comparacion?.majority.excludedForeignSystems).toContain('manual-ajeno');

    const conflicto = result.manifest.conflicts.find(
      (c) => c.claim === 'La conjunción se introduce por bifurcación.',
    );
    expect(conflicto?.differenceClass).toBe('sistema_formal_distinto');
    expect(conflicto?.resolution).toBe('De A∧B se deriva A, y de A∧B se deriva B.');
  });

  it('el caso Calgary queda LICENSE_UNRESOLVED: usable como fuente documental, no como base expresiva', () => {
    const input = fixture();
    const calgary = input.evaluations.map((e, i) =>
      i === 0
        ? {
            ...e,
            licenseRecord: {
              ...e.licenseRecord,
              terms: { ...e.licenseRecord.terms, thirdPartyPermissionOnly: true },
            },
          }
        : e,
    );
    const result = runW0({ ...input, evaluations: calgary });

    const verdict = result.licenseVerdicts.find((v) => v.sourceComponent === 'olp/forallx');
    expect(verdict?.verdict.status).toBe('LICENSE_UNRESOLVED');
    expect(verdict?.verdict.blocked).toBe(true);
    expect(result.readiness.unresolvedComponents).toContain('olp/forallx');
    expect(result.readiness.hasAuthorized).toBe(true);
    // Y no entra en las referencias autorizables que se entregan a W1.
    expect(
      result.manifest.authorizableReferences.some((r) => r.startsWith('olp/forallx@')),
    ).toBe(false);
  });

  it('no produce ningún escalar: observaciones sí, número agregado no', () => {
    const result = runW0(fixture());

    for (const entry of result.manifest.scores) {
      expect(entry.scalarAvailable).toBe(false);
      expect(entry).not.toHaveProperty('score');
    }
    expect(result.saturation.stopDecisionAvailable).toBe(false);
    expect(result.manifest).not.toHaveProperty('shouldStop');
    // Pero la parte medible sí está: curva ordenada y diversidad de linaje.
    expect(result.saturation.curve.map((p) => p.round)).toEqual([1, 2]);
    expect(result.saturation.diversity.distinctLineages).toBe(3);
  });

  it('una corrida sin candidatos no cierra: «no se buscó» no es «no había nada»', () => {
    const input = fixture();
    const vacia = { ...input, candidates: [], evaluations: [], discoveryRounds: [] };
    expect(() => runW0(vacia)).toThrow(IncompleteSelectionManifestError);
  });

  it('la autorización externa lleva a corpus_autorizado y deja la historia completa', () => {
    const result = runW0(fixture());
    const decidida = applyCorpusDecision(result, {
      kind: 'autorizado',
      decidedBy: 'CORPUS_APPROVER',
    });

    expect(decidida.finalState).toBe('corpus_autorizado');
    expect(decidida.record.nextState).toBe('corpus_autorizado');
    expect(decidida.history.map((paso) => paso.to)).toEqual([
      ...result.history.map((paso) => paso.to),
      'corpus_autorizado',
    ]);
  });

  it('el rechazo exige código y motivo, y lleva a corpus_rechazado', () => {
    const result = runW0(fixture());

    expect(() =>
      applyCorpusDecision(result, {
        kind: 'rechazado',
        decidedBy: 'CORPUS_APPROVER',
        ground: 'legalidad',
        rejectionReasonCode: '',
        evidence: 'Oficio del jurídico',
      }),
    ).toThrow(InvalidCorpusDecisionError);

    const rechazada = applyCorpusDecision(result, {
      kind: 'rechazado',
      decidedBy: 'CORPUS_APPROVER',
      ground: 'legalidad',
      rejectionReasonCode: 'LIC-01',
      evidence: 'Proveniencia «used with permission» sin resolver',
    });
    expect(rechazada.finalState).toBe('corpus_rechazado');
  });

  it('no se decide sobre una corrida que no está en propuesta_corpus', () => {
    const result = runW0(fixture());
    const noPropuesta = { ...result, finalState: 'fuentes_descubiertas' as const };
    expect(() =>
      applyCorpusDecision(noPropuesta, { kind: 'autorizado', decidedBy: 'CORPUS_APPROVER' }),
    ).toThrow(IncompleteW0RunError);
  });
});
