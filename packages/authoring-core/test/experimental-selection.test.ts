import { describe, expect, it } from 'vitest';
import { AUTHORIZED_CALCULUS_VERSION } from '@profesor-ia/logic-core';
import { cal09Samples } from '@profesor-ia/proof-search';

import {
  ExperimentalSelectionError,
  evaluateSelectionProposal,
  freezeExperimentalSelection,
  rankSelectionProposals,
  type ExperimentalSelectionProposal,
  type ExperimentalSet,
  type KcId,
} from '../src/index.js';

const calendar = {
  calibrationVersion: 'sced-opportunity-h5-v1',
  kSet: 3,
  minValidItemsPerOpportunity: 2,
  plannedOpportunitiesBySet: { A: 19, B: 19, C: 19 },
} as const;

const sampleProfiles = cal09Samples();
const low = sampleProfiles.find((sample) => sample.tier === 'baja')?.profile;
const high = sampleProfiles.find((sample) => sample.tier === 'alta')?.profile;
if (low === undefined || high === undefined) throw new Error('CAL-09 no contiene estratos de prueba.');

function sets(a: readonly KcId[], b: readonly KcId[], c: readonly KcId[]): readonly ExperimentalSet[] {
  return [
    { setId: 'A', targetKcs: a, supportKcs: ['KC01', 'KC02', 'KC08'], authorizedCalculusVersion: AUTHORIZED_CALCULUS_VERSION },
    { setId: 'B', targetKcs: b, supportKcs: ['KC01', 'KC02', 'KC08'], authorizedCalculusVersion: AUTHORIZED_CALCULUS_VERSION },
    { setId: 'C', targetKcs: c, supportKcs: ['KC01', 'KC02', 'KC08'], authorizedCalculusVersion: AUTHORIZED_CALCULUS_VERSION },
  ];
}

const ids = (prefix: string, count = 69) =>
  Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);

function proposal(overrides: Partial<ExperimentalSelectionProposal> = {}): ExperimentalSelectionProposal {
  return {
    proposalId: 'proposal-clean',
    sets: sets(['KC03'], ['KC04'], ['KC05']),
    generalStrategiesByTargetKc: {
      KC03: ['reiteración'],
      KC04: ['construcción'],
      KC05: ['descomposición'],
    },
    complexityProfilesBySet: { A: [low], B: [low], C: [low] },
    probeInventoryItemIdsBySet: { A: ids('a'), B: ids('b'), C: ids('c') },
    transferMeasurementItemIdsBySet: { A: ['ta'], B: ['tb'], C: ['tc'] },
    crossEdgeJustifications: [],
    ...overrides,
  };
}

describe('T-H5-12: evaluación de propuestas A/B/C', () => {
  it('valida tres conjuntos concurrentes sin contaminación y simula cobertura', () => {
    const result = evaluateSelectionProposal(proposal(), calendar);
    expect(result.formalCrossEdges).toEqual([]);
    expect(result.contentPolicyCrossEdges).toEqual([]);
    expect(result.sharedGeneralStrategyCount).toBe(0);
    expect(result.allCrossSetItemPairsComparable).toBe(true);
    expect(result.nominalProbeItemsBySet).toEqual({ A: 57, B: 57, C: 57 });
  });

  it('registra diferencia estructural sin llamarla equivalencia psicométrica', () => {
    const result = evaluateSelectionProposal(
      proposal({ complexityProfilesBySet: { A: [low], B: [low], C: [high] } }),
      calendar,
    );
    expect(result.allCrossSetItemPairsComparable).toBe(false);
    expect(result.maximumComplexityDifference).toBeGreaterThan(0);
    expect(result.complexityInterpretation).toBe(
      'structurally_comparable_not_psychometrically_equivalent',
    );
  });

  it('exige justificar por separado una arista de política y reconocer carryover', () => {
    const cross = proposal({
      sets: sets(['KC10'], ['KC12'], ['KC03']),
      generalStrategiesByTargetKc: { KC10: ['contradicción'], KC12: ['explosión'], KC03: ['reiteración'] },
    });
    expect(() => evaluateSelectionProposal(cross, calendar)).toThrow(/sin justificar/u);
    expect(() =>
      evaluateSelectionProposal(
        {
          ...cross,
          crossEdgeJustifications: [
            {
              from: 'KC12',
              to: 'KC10',
              type: 'POLITICA_CONTENIDO',
              explanation: 'La mejora concurrente se tratará como covariación, no como efecto independiente.',
              carryoverRiskAcknowledged: false,
              retentionCompatibility: 'La reserva de retención de B permanece independiente.',
            },
          ],
        },
        calendar,
      ),
    ).toThrow(/oculta el riesgo/u);
  });

  it('bloquea dependencia completa de un conjunto que se enseñará después', () => {
    expect(() =>
      evaluateSelectionProposal(
        proposal({
          sets: sets(['KC14'], ['KC03'], ['KC09']),
          generalStrategiesByTargetKc: { KC14: ['bicondicional'], KC03: ['reiteración'], KC09: ['subprueba'] },
          crossEdgeJustifications: [
            {
              from: 'KC14',
              to: 'KC09',
              type: 'FORMAL',
              explanation: 'Dependencia declarada.',
              carryoverRiskAcknowledged: false,
              retentionCompatibility: 'Reservas separadas.',
            },
          ],
        }),
        calendar,
      ),
    ).toThrow(/depende completamente/u);
  });

  it('no deja pasar estrategias, perfiles, transferencia o bancos por vacío', () => {
    expect(() => evaluateSelectionProposal(proposal({ generalStrategiesByTargetKc: {} }), calendar)).toThrow(
      /pasaría por vacío/u,
    );
    expect(() =>
      evaluateSelectionProposal(
        proposal({ complexityProfilesBySet: { A: [], B: [low], C: [low] } }),
        calendar,
      ),
    ).toThrow(/perfiles/u);
    expect(() =>
      evaluateSelectionProposal(
        proposal({ transferMeasurementItemIdsBySet: { A: [], B: ['tb'], C: ['tc'] } }),
        calendar,
      ),
    ).toThrow(/transferencia/u);
    expect(() =>
      evaluateSelectionProposal(
        proposal({ probeInventoryItemIdsBySet: { A: ids('same'), B: ids('same'), C: ids('c') } }),
        calendar,
      ),
    ).toThrow(/bancos independientes/u);
  });
});

describe('ranking y frontera del auditor', () => {
  it('prefiere menos aristas antes que el ID o la dificultad', () => {
    const withPolicyEdge = proposal({
      proposalId: 'a-cross-edge',
      sets: sets(['KC10'], ['KC12'], ['KC03']),
      generalStrategiesByTargetKc: { KC10: ['contradicción'], KC12: ['explosión'], KC03: ['reiteración'] },
      crossEdgeJustifications: [
        {
          from: 'KC12',
          to: 'KC10',
          type: 'POLITICA_CONTENIDO',
          explanation: 'Se registra como covariación.',
          carryoverRiskAcknowledged: true,
          retentionCompatibility: 'La retención usa banco independiente.',
        },
      ],
    });
    const ranked = rankSelectionProposals([withPolicyEdge, proposal()], calendar);
    expect(ranked.map((candidate) => candidate.proposal.proposalId)).toEqual([
      'proposal-clean',
      'a-cross-edge',
    ]);
  });

  it('el auditor solo revisa plausibilidad de la primera propuesta y no rediseña', () => {
    const ranked = rankSelectionProposals([proposal(), proposal({ proposalId: 'second' })], calendar);
    expect(() =>
      freezeExperimentalSelection(
        ranked,
        { role: 'EXPERIMENT_AUDITOR', proposalId: 'second', decision: 'approve_plausibility', notes: 'Plausible.' },
        calendar,
        'selection-v1',
      ),
    ).toThrow(/no diseña/u);
    expect(
      freezeExperimentalSelection(
        ranked,
        {
          role: 'EXPERIMENT_AUDITOR',
          proposalId: 'proposal-clean',
          decision: 'approve_plausibility',
          notes: 'Agrupación plausible; no sustituye la secuencia.',
        },
        calendar,
        'selection-v1',
      ).complexityCalibrationVersion,
    ).toBe('cal-09-v1');
    expect(() =>
      freezeExperimentalSelection(
        ranked,
        {
          role: 'CONTENT_REVIEWER',
          proposalId: 'proposal-clean',
          decision: 'approve_plausibility',
          notes: 'No tiene la autoridad requerida.',
        } as never,
        calendar,
        'selection-v1',
      ),
    ).toThrow(/EXPERIMENT_AUDITOR/u);
  });

  it('sin propuestas o con IDs repetidos no hay selección determinista', () => {
    expect(() => rankSelectionProposals([], calendar)).toThrow(ExperimentalSelectionError);
    expect(() => rankSelectionProposals([proposal(), proposal()], calendar)).toThrow(/proposalId/u);
  });
});
