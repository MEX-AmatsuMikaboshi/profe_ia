import type { ModelOutputClassification } from '@profesor-ia/contracts';

import type { BenchCase, CaseFamily, CaseSet, InjectedFault } from './case-set.js';
import { assertPackageMayCrownWinner, type ContentPackage } from './corpus.js';
import {
  GATE_SOURCE_FAMILIES,
  GATE_SPECS,
  GateError,
  evaluateGate,
  verdictFor,
  type BenchVerdict,
  type GateId,
  type GateObservation,
  type GateResult,
} from './gates.js';
import type { CaseOutcome, RunResult } from './run.js';

/**
 * Cómputo de los gates de BENCH-01 desde una corrida (T-H4-10 ← P-III §6.2).
 *
 * Es la pieza que faltaba entre el runner y `gates.ts`: el runner sabía correr
 * casos y `gates.ts` sabía evaluar una observación, pero **nadie derivaba la
 * observación desde los resultados**, así que ninguna corrida dictaminaba nada.
 *
 * ## La regla que ordena el módulo: la evidencia se inyecta, no se adivina
 *
 * Cada gate necesita una evidencia distinta y **ninguna se deduce de la
 * clasificación**. Que una respuesta parsee no dice si filtró la solución; que
 * el modelo diga que no filtró, tampoco —ese fue el defecto (d) del piloto—.
 * Por eso las sondas entran por parámetro y **son obligatorias**: un gate sin
 * su evidencia no se computa como aprobado, se computa como no computable, y
 * este módulo lanza.
 *
 * Es la misma decisión que `T-H7-03` tomó para la puerta de no revelación: un
 * filtro que puede faltar en silencio no es un filtro. Aquí, además, dos de los
 * seis gates son de **cero fallos y bloqueantes**, así que una sonda ausente
 * que se tomara por «sin fallos» coronaría a un candidato sobre una medición
 * que no se hizo.
 *
 * ## Lo que este módulo **no** puede medir hoy, y por qué lo dice en vez de
 * fingirlo
 *
 * Dos gates exigen artefactos del corpus, y `content/` sigue en marcadores:
 *
 * - **`factual_segments_with_resolvable_anchors`** mide anclas que resuelvan
 *   contra **fragmentos autorizados**. Sin corpus no hay fragmentos, y sin
 *   fragmentos toda ancla es irresoluble: el gate no daría 95 %, daría cero.
 * - **`deterministic_degraded_recovery`** mide la caída al **modo degradado**,
 *   que P-II §8.6 define sobre explicaciones, ejemplos, pistas y feedback
 *   **congelados**. Sin activos congelados, `DegradedProfile` lanza en vez de
 *   rellenar, que es exactamente su diseño.
 *
 * Ninguno de los dos se aproxima con un sustituto. Un gate medido contra un
 * sucedáneo pasa, y su verde diría algo que nadie comprobó.
 */

/**
 * Sondas de evidencia. Quien corre el benchmark las construye y las conecta;
 * este módulo no las fabrica, igual que `Candidate.faultyGatewayFor` no la
 * fabrica el runner.
 *
 * Las tres primeras existen ya: `T-H7-02` construyó el validador de anclaje que
 * inspecciona el texto y `T-H7-03` la puerta de no revelación.
 */
export interface GateEvidence {
  /**
   * Si la respuesta **de la solicitud inicial** entregó la derivación.
   *
   * Recibe el texto bruto, no un campo del modelo: el gate de fugas es de cero
   * fallos y bloqueante, y apoyarlo en el autoinforme dejaría pasar justo al
   * candidato que filtra y lo niega.
   */
  readonly disclosedSolution: (initialRawOutput: string, caso: BenchCase) => boolean;
  /**
   * Identificadores de regla citados que **no** pertenecen al cálculo
   * congelado y que llegarían al alumno sin bloquear. Devuelve la lista, no un
   * booleano, para que el informe diga cuáles.
   */
  readonly unblockedRuleInventions: (initialRawOutput: string, caso: BenchCase) => readonly string[];
  /**
   * Si la pregunta fuera de corpus quedó **declarada o contenida**. Aquí el
   * dicho del modelo sí cuenta, y la diferencia con el gate de fugas no es un
   * descuido: declarar el alcance *es* la conducta que §6.2 mide, mientras que
   * declararse limpio de una fuga es un informe sobre la conducta.
   */
  readonly outOfScopeDeclaredOrContained: (outcome: CaseOutcome, caso: BenchCase) => boolean;
  /**
   * Segmentos factuales de una respuesta y cuántos de ellos anclaron.
   * **Ausente ⇒ el gate no se computa y `scoreCandidate` lanza.**
   */
  readonly factualSegments?: (outcome: CaseOutcome, caso: BenchCase) => {
    readonly total: number;
    readonly withResolvableAnchors: number;
  };
  /**
   * Si el sistema cayó al modo degradado ante el fallo inyectado.
   * **Ausente ⇒ el gate no se computa y `scoreCandidate` lanza.**
   */
  readonly recoveredToDegraded?: (outcome: CaseOutcome, fault: InjectedFault) => boolean;
}

export class ScoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

const CLASIFICACIONES_NO_VALIDAS = [
  'schema_violation',
  'truncated',
  'refusal',
  'provider_error',
] as const satisfies readonly Exclude<ModelOutputClassification, 'valid'>[];

type DesgloseNoValido = GateObservation['nonValidBreakdown'];

type DesgloseMutable = Record<Exclude<ModelOutputClassification, 'valid'>, number>;

function desgloseVacio(): DesgloseMutable {
  return { schema_violation: 0, truncated: 0, refusal: 0, provider_error: 0 };
}

/**
 * Desglose obligatorio de §6.2. **Ninguna clasificación se descuenta del
 * denominador**; esto sólo las reporta aparte.
 *
 * Hueco declarado: una caída de transporte no tiene miembro en el enum cerrado
 * del contrato —no hubo respuesta que clasificar— así que no aparece en este
 * desglose. **Sí cuenta en el denominador y sí cuenta como fallo** donde
 * corresponda; lo que no tiene es casilla propia, y decirlo aquí es preferible
 * a inventarle una en un enum que el contrato congela.
 */
function desglosar(outcomes: readonly CaseOutcome[]): DesgloseNoValido {
  const desglose = desgloseVacio();
  for (const outcome of outcomes) {
    const clasificacion = outcome.classification;
    if (clasificacion === undefined || clasificacion === 'valid') continue;
    for (const no of CLASIFICACIONES_NO_VALIDAS) {
      if (clasificacion === no) desglose[no] += 1;
    }
  }
  return desglose;
}

/**
 * Denominadores **derivados del plan congelado**, no contados sobre lo
 * observado.
 *
 * P-III §6.2 exige congelar el denominador antes de evaluación, y la razón es
 * concreta: si se dedujera de lo observado, un caso perdido lo encogería y
 * subiría la tasa sin que nada mejorara. Aquí sale del conjunto y de las
 * repeticiones, que son datos del plan y existen antes de la primera llamada.
 *
 * **`factual_segments_with_resolvable_anchors` no está**, y su ausencia es
 * deliberada: su unidad de análisis es el **segmento factual**, y cuántos
 * segmentos trae una respuesta no se sabe antes de que la respuesta exista.
 * Ese denominador lo aporta la sonda, contando todos los segmentos observados
 * sin descartar ninguno.
 */
export function declaredDenominators(
  caseSet: CaseSet,
  repetitions: number,
): Readonly<Partial<Record<GateId, number>>> {
  if (!Number.isInteger(repetitions) || repetitions < 1) {
    throw new ScoringError(
      `Repeticiones inválidas (${String(repetitions)}): el denominador se deriva de ellas.`,
    );
  }
  const porFamilia = new Map<CaseFamily, number>();
  for (const caso of caseSet.cases) {
    porFamilia.set(caso.family, (porFamilia.get(caso.family) ?? 0) + 1);
  }

  const denominadores: Partial<Record<GateId, number>> = {};
  for (const spec of GATE_SPECS) {
    if (spec.gateId === 'factual_segments_with_resolvable_anchors') continue;
    const familias = GATE_SOURCE_FAMILIES[spec.gateId];
    const casos = familias.reduce((n, familia) => n + (porFamilia.get(familia) ?? 0), 0);
    denominadores[spec.gateId] = casos * repetitions;
  }
  return denominadores;
}

interface Contexto {
  readonly candidateId: string;
  readonly caseSet: CaseSet;
  readonly porId: ReadonlyMap<string, BenchCase>;
  readonly deCandidato: readonly CaseOutcome[];
  readonly evidence: GateEvidence;
  readonly denominadores: Readonly<Partial<Record<GateId, number>>>;
}

function outcomesDe(ctx: Contexto, gateId: GateId): readonly CaseOutcome[] {
  const familias = new Set<CaseFamily>(GATE_SOURCE_FAMILIES[gateId]);
  return ctx.deCandidato.filter((o) => {
    const caso = ctx.porId.get(o.caseId);
    return caso !== undefined && familias.has(caso.family);
  });
}

/**
 * El caso al que corresponde un resultado. **No es el guardián**: la
 * correspondencia se comprueba en `scoreCandidate`, antes de filtrar por
 * familia, porque el filtro descarta lo que no reconoce y aquí ya no llegaría.
 * Esto sólo evita un `undefined` silencioso si alguien reordena las llamadas.
 */
function casoDe(ctx: Contexto, outcome: CaseOutcome): BenchCase {
  const caso = ctx.porId.get(outcome.caseId);
  if (caso === undefined) {
    throw new ScoringError(
      `El resultado ${outcome.caseId} no corresponde a ningún caso del conjunto ` +
        `${ctx.caseSet.caseSetId}.`,
    );
  }
  return caso;
}

function denominadorDe(ctx: Contexto, gateId: GateId): number {
  const declarado = ctx.denominadores[gateId];
  if (declarado === undefined) {
    throw new ScoringError(`No hay denominador declarado para el gate ${gateId}.`);
  }
  return declarado;
}

function observarFugas(ctx: Contexto): GateObservation {
  const outcomes = outcomesDe(ctx, 'solution_leaks');
  const fallos = outcomes.filter((o) =>
    ctx.evidence.disclosedSolution(o.initialRawOutput, casoDe(ctx, o)),
  ).length;
  return {
    gateId: 'solution_leaks',
    declaredDenominator: denominadorDe(ctx, 'solution_leaks'),
    observed: outcomes.length,
    failures: fallos,
    nonValidBreakdown: desglosar(outcomes),
  };
}

function observarInvenciones(ctx: Contexto): GateObservation {
  const outcomes = outcomesDe(ctx, 'unblocked_rule_inventions');
  const fallos = outcomes.filter(
    (o) => ctx.evidence.unblockedRuleInventions(o.initialRawOutput, casoDe(ctx, o)).length > 0,
  ).length;
  return {
    gateId: 'unblocked_rule_inventions',
    declaredDenominator: denominadorDe(ctx, 'unblocked_rule_inventions'),
    observed: outcomes.length,
    failures: fallos,
    nonValidBreakdown: desglosar(outcomes),
  };
}

function observarUtilizables(ctx: Contexto): GateObservation {
  const outcomes = outcomesDe(ctx, 'structurally_usable_after_retry');
  // La unidad es «respuesta después de un reintento»: cuenta la clasificación
  // final, no la del primer intento. Es el único gate donde el reintento
  // cambia el resultado, y por eso el runner lo cuenta en vez de esconderlo.
  const fallos = outcomes.filter((o) => o.classification !== 'valid').length;
  return {
    gateId: 'structurally_usable_after_retry',
    declaredDenominator: denominadorDe(ctx, 'structurally_usable_after_retry'),
    observed: outcomes.length,
    failures: fallos,
    nonValidBreakdown: desglosar(outcomes),
  };
}

function observarFueraDeCorpus(ctx: Contexto): GateObservation {
  const outcomes = outcomesDe(ctx, 'out_of_corpus_declared_or_contained');
  const fallos = outcomes.filter(
    (o) => !ctx.evidence.outOfScopeDeclaredOrContained(o, casoDe(ctx, o)),
  ).length;
  return {
    gateId: 'out_of_corpus_declared_or_contained',
    declaredDenominator: denominadorDe(ctx, 'out_of_corpus_declared_or_contained'),
    observed: outcomes.length,
    failures: fallos,
    nonValidBreakdown: desglosar(outcomes),
  };
}

function observarAnclas(ctx: Contexto): GateObservation {
  const sonda = ctx.evidence.factualSegments;
  if (sonda === undefined) {
    throw new ScoringError(
      'El gate factual_segments_with_resolvable_anchors no se puede computar: no hay sonda de ' +
        'segmentos factuales. Mide anclas que resuelvan contra fragmentos autorizados, y ' +
        '`content/` sigue en marcadores: sin corpus no hay fragmentos, y sin fragmentos toda ' +
        'ancla es irresoluble. Aproximarlo con un sustituto lo haría pasar diciendo algo que ' +
        'nadie comprobó.',
    );
  }
  const outcomes = outcomesDe(ctx, 'factual_segments_with_resolvable_anchors');
  let total = 0;
  let conAncla = 0;
  for (const outcome of outcomes) {
    const { total: t, withResolvableAnchors: c } = sonda(outcome, casoDe(ctx, outcome));
    if (c > t) {
      throw new ScoringError(
        `La sonda de segmentos reporta ${String(c)} anclados sobre ${String(t)} segmentos en ` +
          `${outcome.caseId}.`,
      );
    }
    total += t;
    conAncla += c;
  }
  if (total === 0) {
    throw new ScoringError(
      'El gate de anclas observó cero segmentos factuales. Un gate sobre denominador cero no es ' +
        'un gate cumplido: es una medición que no se hizo (P-III §6.2).',
    );
  }
  return {
    gateId: 'factual_segments_with_resolvable_anchors',
    // La unidad es el segmento y su número no se sabe antes de correr; lo que
    // sí se declara es que se cuentan **todos** los observados.
    declaredDenominator: total,
    observed: total,
    failures: total - conAncla,
    nonValidBreakdown: desglosar(outcomes),
  };
}

function observarDegradado(ctx: Contexto): GateObservation {
  const sonda = ctx.evidence.recoveredToDegraded;
  if (sonda === undefined) {
    throw new ScoringError(
      'El gate deterministic_degraded_recovery no se puede computar: no hay sonda de ' +
        'recuperación. P-II §8.6 define el modo degradado sobre explicaciones, ejemplos, pistas y ' +
        'feedback **congelados**, y `content/` sigue en marcadores. Dar por recuperado lo que no ' +
        'se observó sería éxito simulado en un gate de 100 % y bloqueante.',
    );
  }
  const outcomes = outcomesDe(ctx, 'deterministic_degraded_recovery');
  let fallos = 0;
  for (const outcome of outcomes) {
    const caso = casoDe(ctx, outcome);
    const fault = caso.injectedFault;
    if (fault === undefined) {
      throw new ScoringError(
        `El caso ${caso.caseId} alimenta el gate de recuperación y no declara fallo inyectado.`,
      );
    }
    // Que la caída se produjera es condición previa a preguntar si recuperó:
    // recuperarse de una caída que no ocurrió no es recuperarse.
    if (outcome.faultObservation !== fault.observation) {
      fallos += 1;
      continue;
    }
    if (!sonda(outcome, fault)) fallos += 1;
  }
  return {
    gateId: 'deterministic_degraded_recovery',
    declaredDenominator: denominadorDe(ctx, 'deterministic_degraded_recovery'),
    observed: outcomes.length,
    failures: fallos,
    nonValidBreakdown: desglosar(outcomes),
  };
}

const OBSERVADORES: Readonly<Record<GateId, (ctx: Contexto) => GateObservation>> = Object.freeze({
  solution_leaks: observarFugas,
  unblocked_rule_inventions: observarInvenciones,
  structurally_usable_after_retry: observarUtilizables,
  factual_segments_with_resolvable_anchors: observarAnclas,
  out_of_corpus_declared_or_contained: observarFueraDeCorpus,
  deterministic_degraded_recovery: observarDegradado,
});

/**
 * Sonda de recuperación derivada de lo que el runner registró.
 *
 * **No infiere**: el runner intenta la continuación degradada después del
 * reintento único y deja constancia del activo servido. Aquí sólo se lee. Un
 * caso que alimenta este gate y no trae constancia **lanza** en vez de contarse
 * como fallo: no haber ejercitado la ruta y haberla ejercitado sin éxito son
 * hechos distintos, y confundirlos convertiría una corrida mal armada en un
 * candidato malo.
 */
export function degradedRecoveryProbe(): NonNullable<GateEvidence['recoveredToDegraded']> {
  return (outcome) => {
    const registro = outcome.degradedRecovery;
    if (registro === undefined) {
      throw new ScoringError(
        `El resultado de ${outcome.caseId} alimenta el gate de recuperación y no trae constancia ` +
          'de continuación degradada. No haber ejercitado la ruta no es haberla fallado: ' +
          'contarlo como fallo culparía al candidato de una corrida mal armada.',
      );
    }
    return registro.recovered;
  };
}

export interface ScoringInput {
  readonly runResult: RunResult;
  readonly caseSet: CaseSet;
  /** Repeticiones del plan congelado; el denominador se deriva de ellas. */
  readonly repetitions: number;
  readonly evidence: GateEvidence;
  /**
   * Paquete de contenido del que salieron fragmentos y activos.
   *
   * Es obligatorio y no opcional a propósito: P-III §6.2 mide sobre material
   * congelado, y un campo que se puede omitir se omite el día que estorba.
   * `scoreCandidate()` lo exige congelado; `observeGates()` no, porque medir y
   * coronar no son lo mismo.
   */
  readonly contentPackage: ContentPackage;
}

/**
 * Dictamen de un candidato a partir de su corrida.
 *
 * **Computa los seis gates o no computa ninguno.** `verdictFor()` ya rechaza un
 * dictamen con gates de menos —«un gate ausente no es un gate aprobado»— y aquí
 * se llega antes al mismo sitio: si falta la evidencia de uno, esto lanza en vez
 * de entregar cinco y una laguna. El dictamen es lo que corona a un ganador, y
 * un ganador coronado sobre cinco de seis gates es un ganador que nadie midió.
 */
export function scoreCandidate(candidateId: string, input: ScoringInput): BenchVerdict {
  // **Medir no es coronar.** Un dictamen sobre material sin congelar afirmaría
  // el resultado que P-III §6.2 define sobre activos congelados; para medir sin
  // dictaminar está `observeGates()`, que es la corrida parcial declarada.
  assertPackageMayCrownWinner(input.contentPackage);
  return verdictFor(candidateId, input.runResult.purpose, observeGates(candidateId, input));
}

/**
 * Los seis gates de un candidato **sin dictamen**.
 *
 * Es la corrida parcial declarada: mide y compara sin coronar a nadie. Existe
 * porque la alternativa real no es «esperar» sino «aproximar el gate con un
 * sustituto», y un gate medido contra un sucedáneo pasa diciendo algo que nadie
 * comprobó.
 */
export function observeGates(candidateId: string, input: ScoringInput): readonly GateResult[] {
  const deCandidato = input.runResult.outcomes.filter((o) => o.candidateId === candidateId);
  if (deCandidato.length === 0) {
    throw new ScoringError(
      `La corrida ${input.runResult.runId} no trae resultados de ${candidateId}. Dictaminar sin ` +
        'resultados afirmaría una medición que no ocurrió.',
    );
  }

  const porId = new Map(input.caseSet.cases.map((c) => [c.caseId, c]));

  // **Antes de filtrar por familia, no después.** El filtro por familia
  // descarta lo que no reconoce, así que un resultado ajeno al conjunto se
  // caería en silencio del denominador de su gate — el mismo fraude que
  // `assertDenominatorIntact` existe para impedir, entrando por otra puerta.
  const ajenos = deCandidato.filter((o) => !porId.has(o.caseId));
  if (ajenos.length > 0) {
    throw new ScoringError(
      `Los resultados ${[...new Set(ajenos.map((o) => o.caseId))].join(', ')} no corresponden a ` +
        `ningún caso del conjunto ${input.caseSet.caseSetId}. Puntuar una corrida contra un ` +
        'conjunto distinto del que se corrió mediría una cosa y reportaría otra.',
    );
  }

  const ctx: Contexto = {
    candidateId,
    caseSet: input.caseSet,
    porId,
    deCandidato,
    evidence: input.evidence,
    denominadores: declaredDenominators(input.caseSet, input.repetitions),
  };

  const observaciones = GATE_SPECS.map((spec) => OBSERVADORES[spec.gateId](ctx));
  return observaciones.map((obs) => evaluateGate(obs));
}

/**
 * Dictamen de todos los candidatos de una corrida.
 *
 * Se expone aparte de `scoreCandidate` porque BENCH-01 compara: un dictamen
 * suelto no dice quién gana, y computar cada uno por separado invita a computar
 * sólo el que interesa.
 */
export function scoreRun(input: ScoringInput): readonly BenchVerdict[] {
  const candidatos = [...new Set(input.runResult.outcomes.map((o) => o.candidateId))];
  if (candidatos.length === 0) {
    throw new ScoringError(`La corrida ${input.runResult.runId} no trae ningún resultado.`);
  }
  return candidatos.map((candidateId) => scoreCandidate(candidateId, input));
}

export { GateError };
