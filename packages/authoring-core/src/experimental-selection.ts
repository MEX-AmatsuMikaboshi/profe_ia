import {
  CAL09_FROZEN_MANIFEST,
  assertComparable,
  complexityIndex,
  type StructuralComplexityProfile,
} from '@profesor-ia/proof-search';
import { ExperimentalSelectionError } from './errors.js';
import {
  EXPERIMENTAL_SET_IDS,
  assertExperimentalSets,
  crossSetEdges,
  type ExperimentalSet,
  type ExperimentalSetId,
  type KcEdge,
  type KcId,
} from './kc-map.js';
import {
  assertProbeInventoryCoverage,
  requiredProbesForCalendar,
  type ScedProbeCoveragePlan,
} from './coverage.js';

const SET_ORDER: Readonly<Record<ExperimentalSetId, number>> = Object.freeze({ A: 0, B: 1, C: 2 });

export interface CrossEdgeJustification {
  readonly from: KcId;
  readonly to: KcId;
  readonly type: 'FORMAL' | 'POLITICA_CONTENIDO';
  readonly explanation: string;
  readonly carryoverRiskAcknowledged: boolean;
  readonly retentionCompatibility: string;
}

export interface ExperimentalSelectionProposal {
  readonly proposalId: string;
  readonly sets: readonly ExperimentalSet[];
  /** Estrategias generales declaradas por KC objetivo; soporte no puntúa como diferenciador. */
  readonly generalStrategiesByTargetKc: Readonly<Record<string, readonly string[]>>;
  readonly complexityProfilesBySet: Readonly<
    Record<ExperimentalSetId, readonly StructuralComplexityProfile[]>
  >;
  readonly probeInventoryItemIdsBySet: Readonly<Record<ExperimentalSetId, readonly string[]>>;
  readonly transferMeasurementItemIdsBySet: Readonly<
    Record<ExperimentalSetId, readonly string[]>
  >;
  readonly crossEdgeJustifications: readonly CrossEdgeJustification[];
}

export interface SetComplexitySummary {
  readonly setId: ExperimentalSetId;
  readonly itemCount: number;
  readonly minIndex: number;
  readonly maxIndex: number;
  readonly meanIndex: number;
}

export interface SelectionEvaluation {
  readonly proposal: ExperimentalSelectionProposal;
  readonly formalCrossEdges: readonly KcEdge[];
  readonly contentPolicyCrossEdges: readonly KcEdge[];
  readonly otherCrossEdges: readonly KcEdge[];
  readonly carryoverRiskEdges: readonly KcEdge[];
  readonly sharedGeneralStrategyCount: number;
  readonly allCrossSetItemPairsComparable: boolean;
  readonly maximumComplexityDifference: number;
  readonly complexityInterpretation:
    'structurally_comparable_not_psychometrically_equivalent';
  readonly complexityBySet: readonly SetComplexitySummary[];
  readonly nominalProbeItemsBySet: Readonly<Record<ExperimentalSetId, number>>;
}

function edgeKey(edge: Pick<KcEdge, 'from' | 'to' | 'type'>): string {
  return `${edge.from}>${edge.to}:${edge.type}`;
}

function setMap(sets: readonly ExperimentalSet[]): ReadonlyMap<KcId, ExperimentalSetId> {
  return new Map(sets.flatMap((set) => set.targetKcs.map((kc) => [kc, set.setId] as const)));
}

function assertThreeNonEmptySets(sets: readonly ExperimentalSet[]): void {
  if (sets.length !== 3 || new Set(sets.map((set) => set.setId)).size !== 3) {
    throw new ExperimentalSelectionError('La propuesta debe contener exactamente A, B y C una vez.');
  }
  for (const setId of EXPERIMENTAL_SET_IDS) {
    const set = sets.find((candidate) => candidate.setId === setId);
    if (set === undefined || set.targetKcs.length === 0) {
      throw new ExperimentalSelectionError(`El conjunto ${setId} no tiene KC objetivo.`);
    }
  }
}

function assertNoCompleteLaterDependency(sets: readonly ExperimentalSet[]): void {
  const owner = setMap(sets);
  const cross = crossSetEdges(sets);
  const dependencyEdges = [...cross.formal, ...cross.politicaContenido];
  for (const set of sets) {
    const completelyDependent = set.targetKcs.every((kc) =>
      dependencyEdges.some(
        (edge) =>
          edge.from === kc &&
          owner.get(edge.to) !== undefined &&
          SET_ORDER[owner.get(edge.to) as ExperimentalSetId] > SET_ORDER[set.setId],
      ),
    );
    if (completelyDependent) {
      throw new ExperimentalSelectionError(
        `${set.setId} depende completamente de un conjunto cuyo inicio de enseñanza es posterior.`,
      );
    }
  }
}

function assertCrossEdgeJustifications(proposal: ExperimentalSelectionProposal): void {
  const cross = crossSetEdges(proposal.sets);
  const governed = [...cross.formal, ...cross.politicaContenido];
  const expected = new Set(governed.map(edgeKey));
  const owner = setMap(proposal.sets);
  const found = new Set<string>();
  for (const justification of proposal.crossEdgeJustifications) {
    const key = edgeKey(justification);
    if (!expected.has(key)) {
      throw new ExperimentalSelectionError(`La justificación ${key} no corresponde a una arista F/PC cruzada.`);
    }
    if (found.has(key)) throw new ExperimentalSelectionError(`La arista ${key} está justificada dos veces.`);
    if (justification.explanation.trim() === '' || justification.retentionCompatibility.trim() === '') {
      throw new ExperimentalSelectionError(`La justificación ${key} no explica interpretabilidad y retención.`);
    }
    const isCarryoverRisk =
      SET_ORDER[owner.get(justification.to) as ExperimentalSetId] <
      SET_ORDER[owner.get(justification.from) as ExperimentalSetId];
    if (isCarryoverRisk && !justification.carryoverRiskAcknowledged) {
      throw new ExperimentalSelectionError(`La justificación ${key} oculta el riesgo de covariación/carryover.`);
    }
    found.add(key);
  }
  const missing = [...expected].filter((key) => !found.has(key));
  if (missing.length > 0) {
    throw new ExperimentalSelectionError(`Aristas F/PC cruzadas sin justificar: ${missing.join(', ')}.`);
  }
}

function assertIndependentIds(
  label: string,
  idsBySet: Readonly<Record<ExperimentalSetId, readonly string[]>>,
): void {
  const owner = new Map<string, ExperimentalSetId>();
  for (const setId of EXPERIMENTAL_SET_IDS) {
    for (const id of idsBySet[setId]) {
      const previous = owner.get(id);
      if (previous !== undefined) {
        throw new ExperimentalSelectionError(
          `${label} ${id} aparece en ${previous} y ${setId}; los conjuntos requieren bancos independientes.`,
        );
      }
      owner.set(id, setId);
    }
  }
}

function sharedStrategyCount(proposal: ExperimentalSelectionProposal): number {
  const bySet = new Map<ExperimentalSetId, Set<string>>();
  for (const set of proposal.sets) {
    const strategies = new Set<string>();
    for (const kc of set.targetKcs) {
      const declared = proposal.generalStrategiesByTargetKc[kc];
      if (declared === undefined || declared.length === 0) {
        throw new ExperimentalSelectionError(
          `${kc} no declara estrategias generales; el solapamiento pasaría por vacío.`,
        );
      }
      for (const strategy of declared) {
        if (strategy.trim() === '') throw new ExperimentalSelectionError(`${kc} declara una estrategia vacía.`);
        strategies.add(strategy);
      }
    }
    bySet.set(set.setId, strategies);
  }
  let total = 0;
  for (let left = 0; left < EXPERIMENTAL_SET_IDS.length; left += 1) {
    for (let right = left + 1; right < EXPERIMENTAL_SET_IDS.length; right += 1) {
      const a = bySet.get(EXPERIMENTAL_SET_IDS[left] as ExperimentalSetId) ?? new Set();
      const b = bySet.get(EXPERIMENTAL_SET_IDS[right] as ExperimentalSetId) ?? new Set();
      total += [...a].filter((strategy) => b.has(strategy)).length;
    }
  }
  return total;
}

function evaluateComplexity(proposal: ExperimentalSelectionProposal): Pick<
  SelectionEvaluation,
  | 'allCrossSetItemPairsComparable'
  | 'maximumComplexityDifference'
  | 'complexityInterpretation'
  | 'complexityBySet'
> {
  const summaries: SetComplexitySummary[] = [];
  let allComparable = true;
  let maximumDifference = 0;
  for (const setId of EXPERIMENTAL_SET_IDS) {
    const profiles = proposal.complexityProfilesBySet[setId];
    if (profiles.length === 0) {
      throw new ExperimentalSelectionError(`${setId} no tiene perfiles de complejidad verificados.`);
    }
    const indexes = profiles.map((profile) => complexityIndex(profile, CAL09_FROZEN_MANIFEST));
    summaries.push({
      setId,
      itemCount: indexes.length,
      minIndex: Math.min(...indexes),
      maxIndex: Math.max(...indexes),
      meanIndex: Number((indexes.reduce((sum, value) => sum + value, 0) / indexes.length).toFixed(6)),
    });
  }
  for (let left = 0; left < EXPERIMENTAL_SET_IDS.length; left += 1) {
    for (let right = left + 1; right < EXPERIMENTAL_SET_IDS.length; right += 1) {
      const a = proposal.complexityProfilesBySet[EXPERIMENTAL_SET_IDS[left] as ExperimentalSetId];
      const b = proposal.complexityProfilesBySet[EXPERIMENTAL_SET_IDS[right] as ExperimentalSetId];
      for (const profileA of a) {
        for (const profileB of b) {
          const comparison = assertComparable(profileA, profileB, CAL09_FROZEN_MANIFEST);
          allComparable &&= comparison.comparable;
          maximumDifference = Math.max(maximumDifference, comparison.difference);
        }
      }
    }
  }
  return Object.freeze({
    allCrossSetItemPairsComparable: allComparable,
    maximumComplexityDifference: Number(maximumDifference.toFixed(6)),
    complexityInterpretation: 'structurally_comparable_not_psychometrically_equivalent' as const,
    complexityBySet: Object.freeze(summaries),
  });
}

export function evaluateSelectionProposal(
  proposal: ExperimentalSelectionProposal,
  calendar: ScedProbeCoveragePlan,
): SelectionEvaluation {
  if (proposal.proposalId.trim() === '') throw new ExperimentalSelectionError('La propuesta no tiene ID.');
  assertThreeNonEmptySets(proposal.sets);
  assertExperimentalSets(proposal.sets);
  assertNoCompleteLaterDependency(proposal.sets);
  assertCrossEdgeJustifications(proposal);
  assertIndependentIds('La sonda', proposal.probeInventoryItemIdsBySet);
  assertIndependentIds('La transferencia', proposal.transferMeasurementItemIdsBySet);
  assertProbeInventoryCoverage(calendar, proposal.probeInventoryItemIdsBySet);
  for (const setId of EXPERIMENTAL_SET_IDS) {
    if (proposal.transferMeasurementItemIdsBySet[setId].length === 0) {
      throw new ExperimentalSelectionError(`${setId} no permite una medida de transferencia.`);
    }
  }
  const cross = crossSetEdges(proposal.sets);
  const owner = setMap(proposal.sets);
  const carryover = [...cross.formal, ...cross.politicaContenido].filter(
    (edge) =>
      SET_ORDER[owner.get(edge.to) as ExperimentalSetId] <
      SET_ORDER[owner.get(edge.from) as ExperimentalSetId],
  );
  const nominalProbeItemsBySet = Object.freeze(
    Object.fromEntries(
      EXPERIMENTAL_SET_IDS.map((setId) => [setId, requiredProbesForCalendar(setId, calendar)]),
    ) as unknown as Record<ExperimentalSetId, number>,
  );
  return Object.freeze({
    proposal,
    formalCrossEdges: cross.formal,
    contentPolicyCrossEdges: cross.politicaContenido,
    otherCrossEdges: cross.otherTypes,
    carryoverRiskEdges: Object.freeze(carryover),
    sharedGeneralStrategyCount: sharedStrategyCount(proposal),
    ...evaluateComplexity(proposal),
    nominalProbeItemsBySet,
  });
}

/** Orden determinista: contaminación, estrategia compartida, diferencia y por último ID. */
export function rankSelectionProposals(
  proposals: readonly ExperimentalSelectionProposal[],
  calendar: ScedProbeCoveragePlan,
): readonly SelectionEvaluation[] {
  if (proposals.length === 0) throw new ExperimentalSelectionError('El pipeline no propuso agrupaciones.');
  const ids = proposals.map((proposal) => proposal.proposalId);
  if (new Set(ids).size !== ids.length) throw new ExperimentalSelectionError('Hay proposalId repetidos.');
  return Object.freeze(
    proposals
      .map((proposal) => evaluateSelectionProposal(proposal, calendar))
      .sort(
        (a, b) =>
          a.formalCrossEdges.length + a.contentPolicyCrossEdges.length -
            (b.formalCrossEdges.length + b.contentPolicyCrossEdges.length) ||
          a.sharedGeneralStrategyCount - b.sharedGeneralStrategyCount ||
          a.maximumComplexityDifference - b.maximumComplexityDifference ||
          a.proposal.proposalId.localeCompare(b.proposal.proposalId),
      ),
  );
}

export interface SelectionAuditDecision {
  readonly role: 'EXPERIMENT_AUDITOR';
  readonly proposalId: string;
  readonly decision: 'approve_plausibility' | 'reject_plausibility';
  readonly notes: string;
}

export interface FrozenExperimentalSelection {
  readonly version: string;
  readonly proposalId: string;
  readonly sets: readonly ExperimentalSet[];
  readonly calendarCalibrationVersion: string;
  readonly complexityCalibrationVersion: 'cal-09-v1';
  readonly audit: SelectionAuditDecision;
  readonly evaluation: SelectionEvaluation;
}

export function freezeExperimentalSelection(
  ranked: readonly SelectionEvaluation[],
  audit: SelectionAuditDecision,
  calendar: ScedProbeCoveragePlan,
  version: string,
): FrozenExperimentalSelection {
  const selected = ranked[0];
  if (selected === undefined) throw new ExperimentalSelectionError('No hay propuesta validada que congelar.');
  if ((audit as { role?: string }).role !== 'EXPERIMENT_AUDITOR') {
    throw new ExperimentalSelectionError('Solo EXPERIMENT_AUDITOR puede revisar plausibilidad.');
  }
  if (audit.proposalId !== selected.proposal.proposalId) {
    throw new ExperimentalSelectionError(
      'El auditor no diseña ni sustituye la secuencia: solo puede revisar la propuesta mejor ranqueada.',
    );
  }
  if (audit.decision !== 'approve_plausibility' || audit.notes.trim() === '') {
    throw new ExperimentalSelectionError('La plausibilidad no fue aprobada con notas auditables.');
  }
  if (version.trim() === '') throw new ExperimentalSelectionError('El freeze de selección no tiene versión.');
  return Object.freeze({
    version,
    proposalId: selected.proposal.proposalId,
    sets: Object.freeze(selected.proposal.sets),
    calendarCalibrationVersion: calendar.calibrationVersion,
    complexityCalibrationVersion: CAL09_FROZEN_MANIFEST.version,
    audit: Object.freeze(audit),
    evaluation: selected,
  });
}
