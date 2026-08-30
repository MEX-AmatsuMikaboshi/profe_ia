import {
  updateCourse,
  type Course,
  type CourseEnvelope,
  type PreparationArtifact,
  type PreparationMessage,
} from '@profesor-ia/domain-engine';
import {
  acceptCandidate,
  assertOpenSearchIsOnlyComplement,
  Whitelist,
  type Candidate,
  type WhitelistEntry,
} from './discovery.js';
import { GeneralizedW0LaneError, IncompleteW0RunError } from './errors.js';
import {
  classifyInventory,
  type ComponentVerdict,
  type LicenseQuery,
  type LicenseRecord,
} from './licensing.js';
import {
  INVENTORY_STATUSES,
  type InventoryItem,
  type InventoryStatus,
  type ScoreEntry,
} from './selection-manifest.js';
import {
  saturationReport,
  type DiscoveryRound,
  type SaturationReport,
  type SuitabilityObservations,
} from './suitability.js';

/**
 * W0 generalizado para materias personalizadas
 * (T-CC-02 ← `DEC-CUSTOM-COURSES-001`, P-I §3.1.2, UIUX §5.2, `Plan.md` §556).
 *
 * Es el paso «sobre mínimo → **W0 generalizado** → propuesta de curso» del
 * flujo de creación. Reutiliza lo que P-I §7.0 tiene de generalizable —lista
 * blanca, correspondencia candidato↔evaluación, licencias, saturación,
 * inventario— y deja fuera la única etapa que **no** lo es.
 *
 * ## Lo que falta aquí no es una etapa omitida: es una etapa que no existe
 *
 * {@link runW0} resuelve por mayoría los claims de las fuentes **contra
 * `authorized-calculus-v1`**, y rechaza los que describen otro sistema formal.
 * Para «Revolución mexicana» o «bioquímica» no hay sistema formal contra el que
 * comparar, así que la mayoría no es que salga vacía: es que no hay pregunta
 * que responda.
 *
 * La tentación era aflojar la guarda de alcance de `runW0` y dejar pasar un
 * `formalSystemId` cualquiera. Sería el defecto silencioso de siempre: una
 * corrida de materia propia produciría un `SelectionManifest` idéntico al del
 * curso experimental, y a partir de ahí nada en el tipo distingue el corpus que
 * W1 puede ingerir del que no. P-I §3.1.2 lo prohíbe de frente —«los cursos
 * personalizados no usan por defecto el SCED de lógica, `authorized-calculus-v1`,
 * reservas experimentales ni el verificador formal»—, y la forma de cumplirlo
 * no es una comprobación sino la **ausencia de un campo donde declararlo**:
 * {@link GeneralizedScope} no tiene `formalSystemId`, y
 * {@link GeneralizedSourceEvaluation} no tiene `claims`. No está prohibido; no
 * existe. Es el patrón de `T-CC-04`, donde la rama sin verificador tampoco
 * tiene dónde escribir un veredicto.
 *
 * ## Y por eso la propuesta es de otro tipo, no del mismo con una etiqueta
 *
 * {@link CourseProposal} no es un `SelectionManifest`. Si lo fuera, la salida de
 * una materia propia entraría por la misma puerta que la del corpus congelable
 * y el compilador no diría nada. Son **dos tipos, no uno con `WHERE`** — la
 * misma razón por la que `partitionByTrack()` devuelve dos proyecciones (D-92):
 * un filtro se rompe en silencio el día que alguien escribe una consulta nueva
 * y lo olvida, y aquí el olvido metería material sin comparar en el análisis de
 * Etapa 1.
 *
 * ## La corrida es determinista, como la experimental
 *
 * Sin red, sin reloj, sin azar: los conectores entregan lo descubierto y lo
 * evaluado como datos. Un fallo de proveedor no se representa aquí sino como
 * `provider_unavailable` en la vista de preparación, que **sí** es reintentable
 * — y esa distinción es de `T-CC-02`, no de este módulo.
 */

/**
 * Alcance de una corrida generalizada.
 *
 * Sale del sobre mínimo de P-I §3.1.2 y **no tiene `formalSystemId`**. Ver la
 * nota de arriba: la ausencia del campo es la guarda.
 */
export interface GeneralizedScope {
  readonly subject: string;
  readonly topic?: string;
}

/** El alcance que se investiga, derivado del sobre. */
export function generalizedScope(envelope: CourseEnvelope): GeneralizedScope {
  const base = { subject: envelope.subject };
  return envelope.topic === undefined ? base : { ...base, topic: envelope.topic };
}

/**
 * Lo que la evaluación produjo sobre un candidato de una materia propia.
 *
 * Es {@link SourceEvaluation} menos `claims`: sin sistema formal objetivo, un
 * claim no tiene contra qué compararse ni cómo clasificarse.
 */
export interface GeneralizedSourceEvaluation {
  readonly candidateUrl: string;
  readonly sourceComponent: string;
  /** Las observaciones de §7.0. El escalar **no** se calcula (CAL-SOURCE-SCORE). */
  readonly observations: SuitabilityObservations;
  readonly licenseRecord: LicenseRecord;
  readonly attributionChain: readonly string[];
}

export interface GeneralizedW0Input {
  /**
   * El curso, no su id: el carril se comprueba aquí y no lo declara quien
   * llama. Ver {@link assertGeneralizableLane}.
   */
  readonly course: Course;
  readonly whitelist: readonly WhitelistEntry[];
  readonly candidates: readonly Candidate[];
  readonly discoveryRounds: readonly DiscoveryRound[];
  /** Una evaluación por candidato, ni una más ni una menos. */
  readonly evaluations: readonly GeneralizedSourceEvaluation[];
  readonly licenseQuery: LicenseQuery;
  readonly selectionRationale: string;
}

/**
 * La propuesta de curso que el usuario revisa (UIUX §5.2, §6.3).
 *
 * Deliberadamente **no** es un `SelectionManifest`: no lleva `conflicts` —no hubo
 * comparación— ni `authorizableReferences` —nada de esto es autorizable como
 * corpus experimental—. Lo que lleva es `usableReferences`: las fuentes con las
 * que esta materia se puede preparar.
 */
export interface CourseProposal {
  readonly proposalVersion: 'generalized-course-proposal-v1';
  readonly courseId: string;
  readonly scope: GeneralizedScope;
  readonly inventory: readonly InventoryItem[];
  readonly licenseVerdicts: readonly ComponentVerdict[];
  readonly scores: readonly ScoreEntry[];
  readonly saturation: SaturationReport;
  readonly selectionRationale: string;
  /** Fuentes con licencia resuelta a favor. Nunca vacío: sin ellas no hay propuesta. */
  readonly usableReferences: readonly string[];
  readonly counts: Readonly<Record<InventoryStatus, number>>;
}

export interface GeneralizedW0Result {
  readonly courseId: string;
  /** El curso ya transitado: `proposal_ready` o `failed`. */
  readonly course: Course;
  /** `null` cuando la corrida no encontró nada usable. */
  readonly proposal: CourseProposal | null;
  /** Mensaje de la lista cerrada de `T-CC-02`; la prosa vive allí. */
  readonly message: PreparationMessage;
  readonly artifacts: readonly PreparationArtifact[];
  readonly acceptedCandidates: readonly Candidate[];
  readonly licenseVerdicts: readonly ComponentVerdict[];
  readonly saturation: SaturationReport;
}

/**
 * Puerta de carril. **Lanza** con el curso experimental.
 *
 * Es la mitad simétrica de la guarda de alcance de `runW0`. Sin ella, pasar el
 * curso de lógica por aquí produciría su corpus **saltándose la resolución por
 * mayoría**: material que nadie comparó contra el cálculo congelado, con la
 * misma cara que el comparado. `runW0` protege el sentido contrario exigiendo
 * el `formal_system_id` objetivo.
 */
export function assertGeneralizableLane(course: Course): void {
  if (course.courseType !== 'CUSTOM_COURSE_UNVALIDATED') {
    throw new GeneralizedW0LaneError(
      `«${course.courseId}» es ${course.courseType} y el W0 generalizado sólo corre el carril ` +
        `personalizado. El curso experimental pasa por runW0(), que resuelve por mayoría contra ` +
        `${'authorized-calculus-v1'} y excluye los sistemas ajenos; correrlo aquí produciría su ` +
        `corpus sin esa comparación, indistinguible del comparado.`,
    );
  }
}

function indexByUrl(
  evaluations: readonly GeneralizedSourceEvaluation[],
): Map<string, GeneralizedSourceEvaluation> {
  const porUrl = new Map<string, GeneralizedSourceEvaluation>();
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
 * Corre W0 generalizado sobre una materia personalizada en `researching`.
 *
 * Devuelve el curso ya transitado, porque el enganche es justo eso: la corrida
 * y el estado observable de la preparación son la misma cosa. Dejarlos
 * separados obligaría a quien llama a acordarse de mover el estado, y el día
 * que se olvidara la pantalla diría «investigando» para siempre — que es el
 * fallo que `T-CC-02` existe para evitar.
 */
export function runGeneralizedW0(input: GeneralizedW0Input): GeneralizedW0Result {
  assertGeneralizableLane(input.course);

  if (input.course.envelope === undefined) {
    throw new IncompleteW0RunError(
      `«${input.course.courseId}» no tiene sobre. Investigar sin él gastaría llamadas al ` +
        `proveedor para producir una propuesta sobre nada.`,
    );
  }
  if (input.course.preparation !== 'researching') {
    throw new IncompleteW0RunError(
      `«${input.course.courseId}» está en «${input.course.preparation}» y W0 se corre desde ` +
        `«researching» (beginPreparation). Correrlo antes investigaría con un sobre que nadie ` +
        `validó; después, sobreescribiría una propuesta ya entregada.`,
    );
  }

  const scope = generalizedScope(input.course.envelope);

  // Descubrimiento: lista blanca, registro completo y búsqueda abierta sólo
  // como complemento. Esta parte es literal de §7.0 y no depende del dominio.
  const whitelist = new Whitelist(input.whitelist);
  const accepted = input.candidates.map((candidate) => acceptCandidate(whitelist, candidate));
  assertOpenSearchIsOnlyComplement(accepted);

  // Correspondencia en los dos sentidos, igual que la corrida experimental: un
  // candidato sin evaluar se contaría como visto sin mirarlo, y una evaluación
  // sin candidato sería material que nadie descubrió.
  const evaluaciones = indexByUrl(input.evaluations);
  for (const candidate of accepted) {
    if (!evaluaciones.has(candidate.record.url)) {
      throw new IncompleteW0RunError(
        `El candidato ${candidate.record.url} no tiene evaluación. Contarlo como visto sin ` +
          `haberlo mirado metería en la propuesta una fuente que nadie revisó.`,
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

  const licenseVerdicts = classifyInventory(
    input.evaluations.map((e) => e.licenseRecord),
    input.licenseQuery,
  );
  const saturation = saturationReport(input.discoveryRounds);

  const verdictPorComponente = new Map(licenseVerdicts.map((v) => [v.sourceComponent, v.verdict]));
  const inventory: InventoryItem[] = input.evaluations.map((evaluation) => {
    const candidate = accepted.find((c) => c.record.url === evaluation.candidateUrl);
    if (candidate === undefined) {
      // Inalcanzable: la correspondencia se comprobó arriba. Si se alcanzara, la
      // entrada cambió entre etapas y la corrida no debe seguir.
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

  const usableReferences = Object.freeze(
    inventory
      .filter((item) => item.status === 'autorizado')
      .map((item) => `${item.sourceComponent}@${item.sourceVersion}#${item.snapshotSha256}`),
  );

  // Sin fuentes usables no hay propuesta, y el estado es `failed` con
  // `no_sources_found` — que `T-CC-02` declara **no reintentable**: repetir la
  // misma búsqueda con el mismo sobre daría el mismo vacío, y el usuario
  // concluiría que el sistema está roto cuando falta información suya.
  //
  // Cubre los dos casos, y a propósito: ni un candidato aceptado, o candidatos
  // cuya licencia no autoriza el uso. Para quien mira la pantalla son lo mismo
  // —no hay con qué preparar la materia— y separarlos en dos mensajes pediría
  // al usuario que entendiera nuestro inventario de licencias.
  if (usableReferences.length === 0) {
    return {
      courseId: input.course.courseId,
      course: updateCourse(input.course, { preparation: 'failed' }),
      proposal: null,
      message: 'no_sources_found',
      // Se declara lo hallado aunque no sirva: la vista dice «encontré esto y
      // no me vale» en vez de «no encontré nada», que sería otra afirmación.
      artifacts:
        accepted.length === 0
          ? Object.freeze([])
          : Object.freeze([{ kind: 'sources_found' as const, ref: `${accepted.length} fuentes` }]),
      acceptedCandidates: Object.freeze(accepted),
      licenseVerdicts,
      saturation,
    };
  }

  const counts = Object.fromEntries(
    INVENTORY_STATUSES.map((estado) => [
      estado,
      inventory.filter((i) => i.status === estado).length,
    ]),
  ) as Record<InventoryStatus, number>;

  if (input.selectionRationale.trim() === '') {
    throw new IncompleteW0RunError(
      `La propuesta de «${input.course.courseId}» no trae justificación de selección. Entregarla ` +
        `sin ella pediría al usuario que aceptara un curso sin poder saber por qué es ése.`,
    );
  }

  const proposal: CourseProposal = {
    proposalVersion: 'generalized-course-proposal-v1',
    courseId: input.course.courseId,
    scope,
    inventory: Object.freeze(inventory),
    licenseVerdicts,
    scores: Object.freeze(
      input.evaluations.map((evaluation) => ({
        sourceComponent: evaluation.sourceComponent,
        observations: evaluation.observations,
        scalarAvailable: false as const,
      })),
    ),
    saturation,
    selectionRationale: input.selectionRationale,
    usableReferences,
    counts: Object.freeze(counts),
  };

  return {
    courseId: input.course.courseId,
    course: updateCourse(input.course, { preparation: 'proposal_ready' }),
    proposal,
    message: 'proposal_ready',
    artifacts: Object.freeze([
      { kind: 'sources_found' as const, ref: `${accepted.length} fuentes` },
      { kind: 'course_proposal' as const, ref: proposal.proposalVersion },
    ]),
    acceptedCandidates: Object.freeze(accepted),
    licenseVerdicts,
    saturation,
  };
}
