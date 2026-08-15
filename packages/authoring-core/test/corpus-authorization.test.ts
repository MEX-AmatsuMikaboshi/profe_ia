import { describe, expect, it } from 'vitest';
import {
  assertNoHumanRewrite,
  buildSelectionManifest,
  CORPUS_DECISION_ROLE,
  decideOnCorpus,
  InvalidCorpusDecisionError,
  REJECTION_GROUNDS,
  saturationReport,
  type CorpusDecision,
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
        attributionChain: ['forall x: Calgary'],
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
    selectionRationale: 'Calgary cubre el calculo objetivo; el resto queda fuera por licencia.',
    authorizableReferences: ['calgary-cap-3@Fall2025'],
    ...overrides,
  };
}

describe('autorización externa (T-H45-07)', () => {
  const manifiesto = buildSelectionManifest(entrada());

  it('los cuatro motivos de rechazo son los literales', () => {
    expect(REJECTION_GROUNDS).toEqual(['alcance', 'seguridad', 'legalidad', 'gobernanza']);
  });

  it('autorizar lleva a corpus_autorizado', () => {
    const r = decideOnCorpus(manifiesto, {
      kind: 'autorizado',
      decidedBy: CORPUS_DECISION_ROLE,
    });

    expect(r.nextState).toBe('corpus_autorizado');
    expect(r.courseId).toBe('deduccion-natural');
  });

  it('rechazar lleva a corpus_rechazado y exige código y evidencia', () => {
    const r = decideOnCorpus(manifiesto, {
      kind: 'rechazado',
      decidedBy: CORPUS_DECISION_ROLE,
      ground: 'legalidad',
      rejectionReasonCode: 'LIC-UNRESOLVED-BLOQUEA',
      evidence: 'dictamen interno 2026-08-15',
    });

    expect(r.nextState).toBe('corpus_rechazado');
  });

  it('un rechazo sin código o sin evidencia no se acepta', () => {
    const base = {
      kind: 'rechazado',
      decidedBy: CORPUS_DECISION_ROLE,
      ground: 'alcance',
    } as const;

    expect(() =>
      decideOnCorpus(manifiesto, { ...base, rejectionReasonCode: '', evidence: 'x' } as CorpusDecision),
    ).toThrow(InvalidCorpusDecisionError);
    expect(() =>
      decideOnCorpus(manifiesto, { ...base, rejectionReasonCode: 'x', evidence: '' } as CorpusDecision),
    ).toThrow(InvalidCorpusDecisionError);
  });

  it('un motivo fuera de los cuatro no se acepta: excluye el rechazo pedagógico', () => {
    expect(() =>
      decideOnCorpus(manifiesto, {
        kind: 'rechazado',
        decidedBy: CORPUS_DECISION_ROLE,
        ground: 'no_me_gusta_pedagogicamente',
        rejectionReasonCode: 'X',
        evidence: 'y',
      } as unknown as CorpusDecision),
    ).toThrow(InvalidCorpusDecisionError);
  });

  it('solo el CORPUS_APPROVER decide', () => {
    expect(() =>
      decideOnCorpus(manifiesto, {
        kind: 'autorizado',
        decidedBy: 'SYSTEM_OWNER',
      } as unknown as CorpusDecision),
    ).toThrow(InvalidCorpusDecisionError);
  });
});

describe('sin reescritura pedagógica humana', () => {
  const presentado = buildSelectionManifest(entrada());

  it('el mismo manifiesto de vuelta pasa', () => {
    expect(() => assertNoHumanRewrite(presentado, presentado)).not.toThrow();
  });

  it('un manifiesto editado por el aprobador se rechaza', () => {
    // Si el humano pudiera reescribirla, la propuesta pasaría a ser suya y W0
    // dejaría de ser autónoma, que es justo lo que el veredicto de autonomía
    // tiene que poder medir.
    const editado = buildSelectionManifest(
      entrada({ selectionRationale: 'lo he reescrito yo para que quede mejor' }),
    );

    expect(() => assertNoHumanRewrite(presentado, editado)).toThrow(InvalidCorpusDecisionError);
  });

  it('incluso un cambio pequeño en el inventario se detecta', () => {
    // Un solo componente que pasa de `autorizado` a `excluido`: el cambio más
    // pequeño que puede hacer un aprobador editando en vez de decidir.
    const editado = buildSelectionManifest(
      entrada({
        inventory: [{ ...entrada().inventory[0]!, status: 'excluido' }],
      }),
    );

    expect(editado.counts.excluido).toBe(1);
    expect(() => assertNoHumanRewrite(presentado, editado)).toThrow(InvalidCorpusDecisionError);
  });
});
