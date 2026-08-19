import {
  acceptCandidate,
  assertOpenSearchIsOnlyComplement,
  Whitelist,
  type Candidate,
  type WhitelistEntry,
} from './discovery.js';
import { IncompleteW0RunError, W0ScopeError } from './errors.js';
import {
  classifyDifference,
  resolveByMajority,
  TARGET_FORMAL_SYSTEM_ID,
  type DifferenceClass,
  type MajorityOutcome,
  type SourceClaim,
} from './formal-system.js';
import {
  classifyInventory,
  type ComponentVerdict,
  type LicenseQuery,
  type LicenseRecord,
} from './licensing.js';
import {
  buildSelectionManifest,
  manifestReadiness,
  type ConflictEntry,
  type InventoryItem,
  type SelectionManifest,
} from './selection-manifest.js';
import {
  saturationReport,
  type DiscoveryRound,
  type SaturationReport,
  type SuitabilityObservations,
} from './suitability.js';
import {
  decideOnCorpus,
  type CorpusDecision,
  type DecisionRecord,
} from './corpus-authorization.js';
import { W0Machine, type W0State, type W0Step } from './w0-state.js';

/**
 * Orquestador de una corrida W0 (F5/H4.5 ← P-I §7.0, §12 «W0»).
 *
 * Hasta aquí, F5 construyó los **validadores** —máquina de estados, descubrimiento,
 * idoneidad, licencias, manifiesto, autorización— pero ninguna pieza los ejecuta
 * en orden: no hay comando de W0 en el CLI y `authoring-worker` no ejecuta
 * ninguna etapa (HANDOFF §9, pregunta abierta 5). Este módulo es esa pieza.
 *
 * Tres decisiones de diseño, todas de la casa:
 *
 * 1. **La entrada es dato, no funciones.** Los conectores reales (APIs de la
 *    whitelist) llegarán con el worker; el orquestador recibe lo descubierto y
 *    lo evaluado como datos. Es lo que hace posible el replay determinista
 *    sobre fixtures que las «Pruebas» de F5 (Plan.md) exigen, y lo que impide
 *    que el orquestador esconda red, reloj o azar.
 * 2. **Ningún escalar.** La idoneidad se registra como observaciones y la
 *    saturación declara `stopDecisionAvailable: false`. El orquestador no
 *    llama jamás a `suitabilityScore()` ni a `shouldStopDiscovery()`: esos
 *    puntos de fallo son donde se enchufan los valores congelados en H4.5.
 * 3. **La máquina no persiste.** Como `W0Machine`, el orquestador devuelve la
 *    historia; quien la usa la graba en `operations.w0_state`.
 */

/** Alcance acotado: lo primero que se declara, antes de comparar nada. */
export interface W0Scope {
  /**
   * `formal_system_id` objetivo, declarado **antes** de comparar (T-H45-03).
   * Si no es el del cálculo autorizado, la corrida no arranca: declarar otro
   * sería poner a W0 a investigar para otro sistema formal.
   */
  readonly formalSystemId: string;
  /** Subunidad o bloque que el corpus debe cubrir, en prosa. */
  readonly topic: string;
}

/** Un claim con la clase que quien evaluó declaró; la reclasificación es del sistema. */
export interface DeclaredClaim extends SourceClaim {
  readonly declaredClass: DifferenceClass;
}

/**
 * Lo que la etapa de evaluación produjo sobre un candidato descubierto.
 *
 * La correspondencia es por `record.url`: un candidato sin evaluación no puede
 * llegar a `fuentes_evaluadas`, y una evaluación sin candidato es material que
 * nadie descubrió —las dos cosas lanzan, ninguna se ignora.
 */
export interface SourceEvaluation {
  /** URL del candidato evaluado (`Candidate.record.url`). */
  readonly candidateUrl: string;
  /** Nombre del componente que entrará al inventario (`source_component`). */
  readonly sourceComponent: string;
  /** Las seis observaciones de §7.0. El escalar **no** se calcula. */
  readonly observations: SuitabilityObservations;
  /** Claims extraídos de la fuente, con la clase declarada por quien evaluó. */
  readonly claims: readonly DeclaredClaim[];
  /** Registro de licencia del componente (los cuatro campos mínimos + rasgos). */
  readonly licenseRecord: LicenseRecord;
  /** Cadena de atribución requerida por la licencia; puede ser vacía si no exige. */
  readonly attributionChain: readonly string[];
}

/** Entrada completa de una corrida W0. Todo dato, todo serializable. */
export interface W0RunInput {
  readonly courseId: string;
  readonly scope: W0Scope;
  readonly whitelist: readonly WhitelistEntry[];
  /** Candidatos hallados al descubrir (whitelist y, como complemento, búsqueda abierta). */
  readonly candidates: readonly Candidate[];
  /** Rondas de descubrimiento observadas: alimentan el informe de saturación. */
  readonly discoveryRounds: readonly DiscoveryRound[];
  /** Una evaluación por candidato, ni una más ni una menos. */
  readonly evaluations: readonly SourceEvaluation[];
  /** Uso previsto declarado para clasificar licencias (`base_expresiva` para corpus). */
  readonly licenseQuery: LicenseQuery;
  /** Justificación de la selección, en prosa (§7.0, «Salida de W0»). */
  readonly selectionRationale: string;
}

/** Resultado de una comparación: la mayoría resuelta y las diferencias clasificadas. */
export interface ComparisonOutcome {
  readonly scope: string;
  readonly majority: MajorityOutcome;
  readonly classified: readonly { readonly claim: SourceClaim; readonly differenceClass: DifferenceClass }[];
}

export interface W0RunResult {
  readonly courseId: string;
  /** Estado en que queda la corrida: `propuesta_corpus`, esperando al aprobador. */
  readonly finalState: W0State;
  /** Historia de transiciones, para persistir en `operations.w0_state`. */
  readonly history: readonly W0Step[];
  readonly acceptedCandidates: readonly Candidate[];
  readonly comparisons: readonly ComparisonOutcome[];
  readonly licenseVerdicts: readonly ComponentVerdict[];
  readonly saturation: SaturationReport;
  readonly manifest: SelectionManifest;
  readonly readiness: ReturnType<typeof manifestReadiness>;
}

function indexByUrl(evaluations: readonly SourceEvaluation[]): Map<string, SourceEvaluation> {
  const porUrl = new Map<string, SourceEvaluation>();
  for (const evaluation of evaluations) {
    if (porUrl.has(evaluation.candidateUrl)) {
      throw new IncompleteW0RunError(
        `Hay dos evaluaciones para ${evaluation.candidateUrl}. Una corrida no puede evaluar dos ` +
          `veces lo mismo sin decir cuál cuenta.`,
      );
    }
    porUrl.set(evaluation.candidateUrl, evaluation);
  }
  return porUrl;
}

/**
 * Ejecuta una corrida W0 desde `solicitud_curso` hasta `propuesta_corpus`.
 *
 * Ahí se detiene a propósito: la autorización es una frontera externa de
 * gobernanza (T-H45-07) y la aplica `applyCorpusDecision`, no la corrida.
 *
 * Determinista: sin red, sin reloj, sin azar. La misma entrada produce el mismo
 * resultado, que es lo que hace replayable una corrida sobre fixtures.
 */
export function runW0(input: W0RunInput): W0RunResult {
  const machine = new W0Machine();

  // solicitud_curso → alcance_acotado: el sistema formal objetivo se declara
  // antes de comparar (T-H45-03), y es el del cálculo autorizado o nada.
  if (input.scope.formalSystemId !== TARGET_FORMAL_SYSTEM_ID) {
    throw new W0ScopeError(
      `El alcance declara ${JSON.stringify(input.scope.formalSystemId)} y el sistema objetivo es ` +
        `${TARGET_FORMAL_SYSTEM_ID}. W0 investiga para el cálculo autorizado; declarar otro ` +
        `pondría la mayoría a trabajar para un sistema que no es el nuestro.`,
    );
  }
  machine.transition('alcance_acotado');

  // alcance_acotado → fuentes_descubiertas: whitelist, registro completo y
  // búsqueda abierta solo como complemento (T-H45-02).
  const whitelist = new Whitelist(input.whitelist);
  const accepted = input.candidates.map((candidate) => acceptCandidate(whitelist, candidate));
  assertOpenSearchIsOnlyComplement(accepted);
  machine.transition('fuentes_descubiertas');

  // fuentes_descubiertas → fuentes_evaluadas: cada candidato tiene su evaluación
  // y cada evaluación su candidato. Las observaciones se registran; el escalar no.
  const evaluaciones = indexByUrl(input.evaluations);
  for (const candidate of accepted) {
    if (!evaluaciones.has(candidate.record.url)) {
      throw new IncompleteW0RunError(
        `El candidato ${candidate.record.url} no tiene evaluación. No se transita a ` +
          `fuentes_evaluadas con un candidato sin evaluar: sería contarlo como visto sin haberlo ` +
          `mirado.`,
      );
    }
  }
  for (const url of evaluaciones.keys()) {
    if (!accepted.some((c) => c.record.url === url)) {
      throw new IncompleteW0RunError(
        `La evaluación de ${url} no corresponde a ningún candidato descubierto. Evaluar material ` +
          `que nadie descubrió saltaría el registro de §7.0.`,
      );
    }
  }
  machine.transition('fuentes_evaluadas');

  // fuentes_evaluadas → fuentes_comparadas: mayoría por alcance, solo entre
  // claims del sistema objetivo; los ajenos se excluyen y quedan reportados (T-H45-03).
  const porAlcance = new Map<string, DeclaredClaim[]>();
  for (const evaluation of input.evaluations) {
    for (const claim of evaluation.claims) {
      const previos = porAlcance.get(claim.scope) ?? [];
      previos.push(claim);
      porAlcance.set(claim.scope, previos);
    }
  }
  const comparisons: ComparisonOutcome[] = [...porAlcance.entries()].map(([scope, claims]) => ({
    scope,
    majority: resolveByMajority(claims),
    classified: Object.freeze(
      claims.map((claim) => ({
        claim,
        differenceClass: classifyDifference(claim, claim.declaredClass),
      })),
    ),
  }));
  machine.transition('fuentes_comparadas');

  // fuentes_comparadas → licencias_clasificadas: veredicto por componente y por
  // uso previsto; un bloqueo no arrastra a sus hermanos (T-H45-05).
  const records: LicenseRecord[] = input.evaluations.map((e) => e.licenseRecord);
  const licenseVerdicts = classifyInventory(records, input.licenseQuery);
  machine.transition('licencias_clasificadas');

  // licencias_clasificadas → cobertura_evaluada: el informe de saturación es la
  // parte medible; la parada no está calibrada y el informe lo declara (T-H45-04).
  const saturation = saturationReport(input.discoveryRounds);
  machine.transition('cobertura_evaluada');

  // cobertura_evaluada → propuesta_corpus: el manifiesto con sus ocho secciones
  // (T-H45-06). Si no hay nada que proponer, `buildSelectionManifest` lanza:
  // «no había nada» y «no se buscó» no son lo mismo.
  const verdictPorComponente = new Map(licenseVerdicts.map((v) => [v.sourceComponent, v.verdict]));
  const inventory: InventoryItem[] = input.evaluations.map((evaluation) => {
    const candidate = accepted.find((c) => c.record.url === evaluation.candidateUrl);
    if (candidate === undefined) {
      // Inalcanzable: la correspondencia se comprobó arriba. Si algún día se
      // alcanza, la entrada cambió entre etapas y la corrida no debe seguir.
      throw new IncompleteW0RunError(
        `La evaluación de ${evaluation.candidateUrl} perdió su candidato entre etapas.`,
      );
    }
    const verdict = verdictPorComponente.get(evaluation.sourceComponent);
    if (verdict === undefined) {
      throw new IncompleteW0RunError(
        `El componente ${evaluation.sourceComponent} no tiene veredicto de licencia.`,
      );
    }
    return {
      sourceComponent: evaluation.sourceComponent,
      sourceVersion: evaluation.licenseRecord.sourceVersion,
      status: verdict.status,
      snapshotSha256: candidate.record.snapshotSha256,
      licenseEvidence: evaluation.licenseRecord.licenseEvidence,
      attributionChain: evaluation.attributionChain,
    };
  });

  const conflicts: ConflictEntry[] = comparisons.flatMap((comparison) =>
    comparison.classified
      .filter(({ claim }) => claim.statement !== comparison.majority.statement)
      .map(({ claim, differenceClass }) => ({
        claim: claim.statement,
        differenceClass,
        resolution: comparison.majority.statement,
        excludedForeignSystems: comparison.majority.excludedForeignSystems,
      })),
  );

  const manifest = buildSelectionManifest({
    courseId: input.courseId,
    inventory,
    licenseVerdicts,
    scores: input.evaluations.map((evaluation) => ({
      sourceComponent: evaluation.sourceComponent,
      observations: evaluation.observations,
      scalarAvailable: false,
    })),
    saturation,
    conflicts,
    selectionRationale: input.selectionRationale,
    authorizableReferences: Object.freeze(
      inventory
        .filter((item) => item.status === 'autorizado')
        .map((item) => `${item.sourceComponent}@${item.sourceVersion}#${item.snapshotSha256}`),
    ),
  });
  machine.transition('propuesta_corpus');

  return {
    courseId: input.courseId,
    finalState: machine.state(),
    history: machine.history(),
    acceptedCandidates: Object.freeze(accepted),
    comparisons: Object.freeze(comparisons),
    licenseVerdicts,
    saturation,
    manifest,
    readiness: manifestReadiness(manifest),
  };
}

/**
 * Aplica la decisión del `CORPUS_APPROVER` sobre la propuesta (T-H45-07).
 *
 * Solo es válida sobre una corrida detenida en `propuesta_corpus`: autorizar o
 * rechazar otra cosa sería decidir sobre un manifiesto que no existe.
 */
export function applyCorpusDecision(
  result: W0RunResult,
  decision: CorpusDecision,
): { readonly record: DecisionRecord; readonly history: readonly W0Step[]; readonly finalState: W0State } {
  if (result.finalState !== 'propuesta_corpus') {
    throw new IncompleteW0RunError(
      `La corrida está en ${result.finalState} y solo se decide sobre propuesta_corpus.`,
    );
  }
  const machine = new W0Machine('propuesta_corpus');
  const record = decideOnCorpus(result.manifest, decision);
  machine.transition(
    record.nextState,
    decision.kind === 'rechazado' ? { rejectionReasonCode: decision.rejectionReasonCode } : {},
  );
  return {
    record,
    history: Object.freeze([...result.history, ...machine.history()]),
    finalState: machine.state(),
  };
}
