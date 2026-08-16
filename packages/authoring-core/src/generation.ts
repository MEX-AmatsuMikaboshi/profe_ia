import {
  AUTHORIZED_CALCULUS_VERSION,
  VERIFIER_VERSION,
  entails,
  falsum,
  parse,
  print,
  renameAtoms,
  verify,
} from '@profesor-ia/logic-core';
import {
  BENCH04_HARNESS_VERSION,
  BENCH04_VARIANTS,
  CAL09_FROZEN_MANIFEST,
  CertificateRejectedError,
  classifyComplexity,
  complexityIndex,
  freezeWinningOrder,
  structuralComplexity,
  type Bench04Report,
  type ComplexityTier,
  type FoundProof,
  type SearchBudget,
  type SearchMode,
  type SearchOutcome,
  type SearchRequest,
  type StructuralComplexityProfile,
} from '@profesor-ia/proof-search';
import {
  areIsomorphic,
  canonicalAtomMapping,
  isTrivialDuplicate,
  structuralSignature,
  type CanonicalProof,
} from '@profesor-ia/isomorphism-canonicalizer';
import {
  AuthoritativeSolutionFromGeneratorError,
  ComplexityTargetMismatchError,
  HintPolicyError,
  PipelineOrderNotFrozenError,
  W3InputError,
} from './errors.js';
import { assertCritique, critiqueRiskFlags, type CritiqueCriterion, type ItemCritique } from './critique.js';
import { familyComponentsOf, FamilyRegistry } from './family.js';
import { assertHintSet, undisclosedSolutionFormulas, type HintSet } from './hints.js';
import { KC_IDS, type KcId } from './kc-map.js';
import { collisionProhibited, effectiveReserve, RESERVES, type Reserve } from './reserves.js';

/**
 * W3 — autoría automática (T-H5-05 [CRITICAL] ← Maestro §12 «W3», P-I §7.4–§7.7
 * y P-II §5.2–§5.4).
 *
 * Los diez pasos de W3 en el orden que la norma les da. Tres decisiones
 * gobiernan el módulo:
 *
 * **1. Rol C no entrega la solución, y no hay campo donde ponerla.** P-II §5.2
 * lo dice con esas palabras. La solución la produce el buscador y la certifica
 * `logic-core`; aceptar la del generador convertiría la afirmación de un modelo
 * en el patrón contra el que después se califica al alumno.
 *
 * **2. El orden del pipeline de validez no se cablea.** P-I §7.4: la
 * preferencia inicial `prefiltro semántico → proof search` es la que hay que
 * *benchmarkear*, y el ganador «se congela por versión; no se adopta como ley
 * universal sin medición». Entra como dato con su procedencia o el pipeline no
 * corre. Y no se ejecuta una réplica del orden: se ejecuta **la variante misma
 * del arnés** `BENCH04_VARIANTS`, para que lo que corre en autoría sea el
 * código que la medición midió.
 *
 * **3. La solución no viaja en el registro público del reactivo.** `W3Outcome`
 * separa `items` de `privateSolutions`, y el tipo de `items` **no tiene campo**
 * para el certificado. Es la separación física del paso 10 llevada al tipo: por
 * mucho que alguien serialice el registro entero hacia `items/`, la solución no
 * puede salir por ahí.
 */

/** Estados de la máquina de P-II §5.1 por los que pasa un artefacto en W3. */
export const W3_PIPELINE_STATES = [
  'candidatos_generados',
  'soluciones_encontradas',
  'filtros_superados',
] as const;
export type W3PipelineState = (typeof W3_PIPELINE_STATES)[number];

/**
 * Códigos de rechazo de W3. Lista **cerrada**, como la de códigos `E-*` del
 * verificador: el código es lo único que P-II §5.4 permite devolverle al agente
 * al regenerar, así que un código libre sería un canal por el que colar
 * indicaciones sobre la solución.
 *
 * `no_proof_exists_in_calculus` **no está** y no puede estar (CALC-03): agotar
 * el presupuesto no afirma inexistencia.
 */
export const W3_REJECTION_CODES = [
  'syntax_not_in_authorized_calculus',
  'kc_label_not_in_catalog',
  'kc_labels_missing',
  'bank_function_not_a_reserve',
  'goal_trivial',
  'premises_unsatisfiable',
  'premise_satisfiability_not_decidable',
  'semantically_invalid',
  'search_budget_exhausted',
  'no_proof_with_cost_at_most_k',
  'solution_leaked_in_statement',
  'hint_policy_violation',
  'trivial_duplicate_of_candidate',
  'isomorphic_to_candidate',
  'duplicate_of_corpus_exercise',
  'complexity_target_mismatch',
] as const;
export type W3RejectionCode = (typeof W3_REJECTION_CODES)[number];

export interface W3Rejection {
  readonly code: W3RejectionCode;
  readonly detail: string;
}

export interface ItemStatement {
  readonly premises: readonly string[];
  readonly goal: string;
}

/**
 * Salida de Rol C (P-II §5.2): enunciados estructurados, etiquetas KC, función
 * del banco, complejidad objetivo y prohibiciones. **No hay solución.**
 */
export interface ItemCandidate {
  readonly candidateId: string;
  /** Plantilla generadora; `T-H5-07` la usa para la pertenencia a familia. */
  readonly generatorTemplateId: string;
  readonly statement: ItemStatement;
  /** Redacción que ve el alumno. Es el único texto libre del reactivo. */
  readonly promptText: string;
  readonly targetKcs: readonly KcId[];
  /** Función del banco = reserva de P-I §7.7. */
  readonly bankFunction: Reserve;
  /**
   * Obligatorio cuando `bankFunction` es `replacement`: qué reserva repone
   * (D-21). Sin él no se sabe si al reactivo le aplica la disjunción de
   * medición, y suponerlo dejaría entrar una reposición isomorfa a una sonda.
   */
  readonly replacesReserve?: Reserve;
  /** Complejidad **objetivo** declarada por Rol C; no es una medida. */
  readonly targetComplexity: ComplexityTier;
  readonly prohibitions: readonly string[];
  /**
   * Si la contradicción es el objetivo explícito del reactivo. P-I §7.5 exige
   * premisas satisfacibles «salvo que la contradicción sea el objetivo
   * explícito», así que se **declara**: sin declaración, un reactivo trivial por
   * premisas contradictorias pasaría como si fuera intencionado.
   */
  readonly contradictionIsExplicitGoal: boolean;
}

/**
 * Claves con las que una solución podría llegar desde Rol C. La comprobación es
 * en ejecución porque la salida del modelo entra como JSON: el tipo la impide
 * en compilación, y esto la impide cuando el objeto viene de fuera.
 */
const CLAVES_DE_SOLUCION = [
  'solution',
  'solutionLines',
  'proof',
  'derivation',
  'certificate',
  'answer',
  'lines',
  'steps',
] as const;

/**
 * Rechaza una salida de Rol C que traiga solución (P-II §5.2: «No genera la
 * solución autoritativa»).
 */
export function assertNoAuthoritativeSolution(raw: unknown, candidateId: string): void {
  if (typeof raw !== 'object' || raw === null) return;
  const presentes = CLAVES_DE_SOLUCION.filter((clave) => clave in (raw as Record<string, unknown>));
  if (presentes.length > 0) {
    throw new AuthoritativeSolutionFromGeneratorError(
      `El candidato ${candidateId} llega con ${presentes.join(', ')}. Rol C «no genera la solución ` +
        `autoritativa» (P-II §5.2): la produce el buscador y la certifica logic-core. Aceptarla ` +
        `haría del texto de un modelo el patrón contra el que se califica al alumno.`,
    );
  }
}

/** Sobre qué corrió la medición que congeló el orden. */
export const BENCH04_MEASUREMENT_SCOPES = ['real_content_package', 'l0_harness_sample'] as const;
export type Bench04MeasurementScope = (typeof BENCH04_MEASUREMENT_SCOPES)[number];

/** Orden del pipeline de validez, congelado por `BENCH-04` con su procedencia. */
export interface FrozenValidityOrder {
  readonly benchmarkId: 'BENCH-04';
  /** Id de una de las variantes del arnés; no un nombre libre. */
  readonly variantId: string;
  readonly harnessVersion: string;
  readonly measuredOn: Bench04MeasurementScope;
  readonly contentPackageVersion: string;
  readonly reportRunId: string;
}

/**
 * Resuelve la variante del pipeline con la que W3 decide validez.
 *
 * Los tres caminos y por qué:
 *
 * - **sin nada** → falla: ejecutar con la preferencia inicial sería adoptarla
 *   como ley universal sin medición, que es lo que §7.4 prohíbe;
 * - **solo un informe del arnés** → se lo pasa a `freezeWinningOrder()`, que
 *   falla cerrado. Ese punto de fallo vive en `proof-search` desde `T-H2-16` y
 *   apunta aquí; se ejercita en vez de esquivarlo;
 * - **orden congelado** → se comprueba su procedencia y se devuelve la variante
 *   del arnés, no una réplica del orden.
 */
export function resolveValidityVariant(
  frozen?: FrozenValidityOrder,
  report?: Bench04Report,
): (typeof BENCH04_VARIANTS)[number] {
  if (frozen === undefined) {
    if (report !== undefined) freezeWinningOrder(report);
    throw new PipelineOrderNotFrozenError(
      'W3 no puede ejecutar el pipeline de validez sin el orden congelado por BENCH-04. La ' +
        'preferencia inicial es «prefiltro semántico → proof search», pero es la que hay que ' +
        'benchmarkear: P-I §7.4 dice que el ganador «se congela por versión; no se adopta como ley ' +
        'universal sin medición».',
    );
  }

  if (frozen.benchmarkId !== 'BENCH-04') {
    throw new PipelineOrderNotFrozenError(
      `El orden dice venir de ${frozen.benchmarkId}. Quien decide el orden del pipeline de autoría ` +
        `es BENCH-04 (P-I §7.4).`,
    );
  }
  if (frozen.harnessVersion !== BENCH04_HARNESS_VERSION) {
    throw new PipelineOrderNotFrozenError(
      `El orden se midió con el arnés ${frozen.harnessVersion} y el vigente es ` +
        `${BENCH04_HARNESS_VERSION}. Un orden congelado con otro arnés no se puede comparar con lo ` +
        `que hoy mide el arnés.`,
    );
  }
  if (frozen.measuredOn !== 'real_content_package') {
    throw new PipelineOrderNotFrozenError(
      'El orden se congeló sobre la muestra L0 del arnés. Esa muestra es con la que el arnés se ' +
        'prueba a sí mismo (T-H2-16); declarar desde ella un ganador para el paquete real sería ' +
        'exactamente la ley universal sin medición de P-I §7.4.',
    );
  }
  if (frozen.contentPackageVersion.trim() === '' || frozen.reportRunId.trim() === '') {
    throw new PipelineOrderNotFrozenError(
      'El orden congelado no dice sobre qué versión del paquete se midió ni en qué corrida. Sin ' +
        'esa procedencia no es un orden congelado, es un orden elegido.',
    );
  }

  const variante = BENCH04_VARIANTS.find((v) => v.id === frozen.variantId);
  if (variante === undefined) {
    throw new PipelineOrderNotFrozenError(
      `${frozen.variantId} no es una variante del arnés (${BENCH04_VARIANTS.map((v) => v.id).join(', ')}). ` +
        `W3 ejecuta la variante medida, no una reimplementación suya: si el orden que corre en ` +
        `autoría no es el que se midió, la medición no dice nada de esta corrida.`,
    );
  }
  return variante;
}

/** Ejercicio del corpus fuente contra el que se comprueba duplicación. */
export interface CorpusExercise {
  readonly exerciseId: string;
  /** Fragmento del corpus ingerido en W1 del que sale. */
  readonly fragmentId: string;
  readonly statement: ItemStatement;
}

/**
 * Forma canónica del enunciado, con la **misma convención** que la firma
 * estructural del canonicalizador: renombrado de átomos por orden de aparición
 * y premisas ordenadas después de renombrar. Dos enunciados que solo difieren
 * en los nombres de los átomos o en el orden de las premisas colisionan.
 */
export function canonicalStatement(statement: ItemStatement): string {
  const asts = [...statement.premises, statement.goal].map(parse);
  const mapping = canonicalAtomMapping(asts);
  const premisas = statement.premises
    .map((p) => print(renameAtoms(parse(p), mapping)))
    .sort();
  const meta = print(renameAtoms(parse(statement.goal), mapping));
  return `premisas[${premisas.join(';')}]⊢${meta}`;
}

/**
 * Paso 4 de W3: re-verificar el certificado con `logic-core`.
 *
 * El buscador ya re-verifica (T-H2-08) y aun así se vuelve a hacer aquí. P-I
 * §7.4 enumera la re-verificación como una función **distinta** del buscador, y
 * dejarla solo dentro de él haría que la garantía dependiera de que el buscador
 * se vigile a sí mismo. Es una función aparte, y no un `if` dentro del bucle,
 * para que se pueda probar con un certificado inválido sin abrirle al pipeline
 * una vía de inyección: un `verify` inyectable sería justo el agujero que este
 * paso cierra.
 *
 * Un certificado rechazado **no es un resultado de búsqueda**: es una
 * inconsistencia entre buscador y verificador, incidente de nivel 3 (P-I §13.1).
 * Por eso lanza y no se convierte en código de rechazo.
 */
export function assertCertificateReverified(certificate: FoundProof, goal: string): void {
  const verificacion = verify({ lines: certificate.lines, goal });
  if (!verificacion.valid || verificacion.goalReached !== true) {
    throw new CertificateRejectedError(
      goal,
      verificacion.errors.map((e) => e.code),
    );
  }
}

/** Reactivo ya aceptado contra el que se compara duplicación. */
export interface AcceptedItemShape {
  readonly candidateId: string;
  /** Enunciado en forma canónica. */
  readonly statement: string;
  readonly proof: CanonicalProof;
  /** Reserva efectiva: decide si la colisión está prohibida. */
  readonly reserve: Reserve;
}

/**
 * Primera colisión **prohibida** del candidato contra los ya aceptados, o
 * `null`.
 *
 * La palabra que decide es «prohibida». Dos reactivos isomorfos **dentro de la
 * misma reserva son una familia**, no un defecto: P-I §7.8 define familia como
 * los candidatos que comparten plantilla, función de banco, KC objetivo y la
 * misma `structural_signature`, y dice que renombrar átomos o reordenar pasos
 * independientes **no crea una familia nueva**. Rechazarlos dejaría toda familia
 * en un solo miembro. Quién colisiona con quién de forma prohibida lo decide
 * `collisionProhibited()`, en `reserves.ts`, para que la regla viva en un solo
 * sitio y `T-H5-06` y W3 no puedan separarse.
 *
 * Los dos casos se reportan por separado porque piden arreglos distintos: un
 * **duplicado trivial** es el mismo reactivo con otros nombres de átomo y se
 * corrige regenerando; un **isomorfo** puede tener otro enunciado y coincidir en
 * la estructura de prueba, y ahí lo que hay que cambiar es la plantilla. Y el
 * orden importa: el duplicado trivial es el caso más estricto (P-I §5.11), así
 * que se mira primero para no reportarlo con la etiqueta más floja.
 *
 * Se conserva **el primero** de la lista, que es el orden de entrada: cuál de
 * los dos gemelos sobrevive tiene que ser reproducible entre corridas.
 */
export function findDuplicateAmong(
  candidate: CanonicalProof,
  candidateReserve: Reserve,
  canonicalStatementOfCandidate: string,
  accepted: readonly AcceptedItemShape[],
): W3Rejection | null {
  for (const previo of accepted) {
    if (!collisionProhibited(candidateReserve, previo.reserve)) continue;
    if (isTrivialDuplicate(candidate, previo.proof)) {
      return {
        code: 'trivial_duplicate_of_candidate',
        detail: `duplicado trivial de ${previo.candidateId}: coinciden con solo renombrar átomos`,
      };
    }
    if (areIsomorphic(candidate, previo.proof)) {
      return {
        code: 'isomorphic_to_candidate',
        detail:
          `isomorfo a ${previo.candidateId} bajo la canonicalización congelada: misma estructura ` +
          `de prueba con los pasos independientes en otro orden`,
      };
    }
    if (previo.statement === canonicalStatementOfCandidate) {
      return {
        code: 'isomorphic_to_candidate',
        detail: `mismo enunciado canónico que ${previo.candidateId}`,
      };
    }
  }
  return null;
}

/** Registro **público** del reactivo. No tiene campo para la solución. */
export interface W3ItemRecord {
  readonly candidateId: string;
  readonly generatorTemplateId: string;
  readonly bankFunction: Reserve;
  readonly targetKcs: readonly KcId[];
  readonly pipelineState: W3PipelineState;
  /**
   * Estado de autoría de P-I §7.4. **Ausente cuando la búsqueda no llegó a
   * correr**, que es lo que ocurre si el candidato cae en los filtros de
   * sintaxis. Rellenarlo con `search_budget_exhausted` afirmaría algo del
   * buscador —que gastó su presupuesto— en un candidato que nunca vio.
   */
  readonly authoringState?: SearchOutcome['status'];
  readonly accepted: boolean;
  readonly rejections: readonly W3Rejection[];
  /** Perfil de complejidad de la solución hallada, cuando la hay. */
  readonly complexity?: StructuralComplexityProfile;
  /** Complejidad declarada por Rol C y estrato medido por CAL-09. */
  readonly targetComplexity: ComplexityTier;
  readonly measuredComplexityTier?: ComplexityTier;
  readonly complexityIndex?: number;
  /** Declarado siempre: `true` solo cuando hubo perfil medible y CAL-09 aplicó. */
  readonly complexityComparisonAvailable: boolean;
  /** Firma estructural de la solución; base del control de duplicados. */
  readonly structuralSignature?: string;
  /**
   * `item_family_id` inmutable (`T-H5-07` ← P-I §7.8). Se asigna aquí porque la
   * norma lo quiere **antes de auditoría**, y W3 es lo que precede a W4.
   *
   * Ausente cuando el candidato no llegó a tener certificado: la pertenencia
   * incluye la firma estructural del problema **y** la solución, así que sin
   * solución no hay familia que derivar. Inventarle una agruparía por tres
   * componentes lo que la norma agrupa por cuatro.
   */
  readonly itemFamilyId?: string;
  /** Criterios en los que Rol E dejó hallazgos. Señal para W4, no veredicto. */
  readonly criticRiskFlags: readonly CritiqueCriterion[];
  readonly criticised: boolean;
  readonly hintsProvided: boolean;
}

/** Certificado hacia `solutions-private/`. Nunca viaja en `W3ItemRecord`. */
export interface PrivateSolution {
  readonly itemId: string;
  readonly certificate: FoundProof;
  readonly structuralSignature: string;
  readonly authorizedCalculusVersion: typeof AUTHORIZED_CALCULUS_VERSION;
  readonly verifierVersion: typeof VERIFIER_VERSION;
  /** `true` solo si `exhaustive_k` cubrió todos los costes menores. */
  readonly minimalCostVerified: boolean;
}

export interface W3Input {
  readonly candidates: readonly ItemCandidate[];
  readonly frozenOrder?: FrozenValidityOrder;
  readonly benchReport?: Bench04Report;
  readonly budget: SearchBudget;
  readonly mode: SearchMode;
  readonly corpusExercises: readonly CorpusExercise[];
  readonly hintSets: readonly HintSet[];
  readonly critiques: readonly ItemCritique[];
  /**
   * Registro de familias. Se pasa desde fuera para que **sobreviva a las
   * regeneraciones**: la inmutabilidad de `item_family_id` (P-I §7.8) solo
   * significa algo si el registro es el mismo entre corridas, y `T-H5-09`
   * regenera. Sin él, cada corrida empezaría de cero y reasignar sería gratis.
   */
  readonly familyRegistry?: FamilyRegistry;
}

export interface W3Outcome {
  readonly items: readonly W3ItemRecord[];
  readonly privateSolutions: readonly PrivateSolution[];
  readonly variantId: string;
  readonly authorizedCalculusVersion: typeof AUTHORIZED_CALCULUS_VERSION;
}

const proofOf = (certificate: FoundProof, goal: string): CanonicalProof => ({
  lines: certificate.lines.map((l) => ({
    formula: l.formula,
    rule: l.rule,
    ...(l.refs === undefined ? {} : { refs: l.refs }),
    depth: l.depth,
  })),
  goal,
});

/**
 * Coherencia de la entrada de W3, antes de procesar nada.
 *
 * Dos candidatos con el mismo id guardarían dos certificados distintos bajo la
 * misma clave en `solutions-private/`, y la cadena de trazabilidad se
 * bifurcaría al recorrerla por id —el mismo motivo por el que W2 rechaza ids
 * repetidos—. Y una crítica o un conjunto de pistas que apunta a un candidato
 * ausente se ignoraría en silencio: el paso 8 constaría como ejecutado sobre un
 * reactivo que nadie criticó.
 */
export function assertCoherentW3Input(input: W3Input): void {
  const vistos = new Set<string>();
  for (const candidato of input.candidates) {
    if (vistos.has(candidato.candidateId)) {
      throw new W3InputError(
        `${candidato.candidateId} aparece dos veces entre los candidatos. Sus dos certificados ` +
          `compartirían clave en solutions-private y la trazabilidad por id se bifurcaría.`,
      );
    }
    vistos.add(candidato.candidateId);
  }

  for (const conjunto of input.hintSets) {
    if (!vistos.has(conjunto.itemId)) {
      throw new W3InputError(
        `Hay pistas para ${conjunto.itemId}, que no está entre los candidatos. Descartarlas en ` +
          `silencio ocultaría que Rol D trabajó sobre un reactivo que no existe en este lote.`,
      );
    }
  }
  for (const critica of input.critiques) {
    if (!vistos.has(critica.itemId)) {
      throw new W3InputError(
        `Hay una crítica de ${critica.itemId}, que no está entre los candidatos.`,
      );
    }
  }
}

/**
 * Ejecuta W3 sobre los candidatos de Rol C.
 *
 * **El orden de comprobación es el requisito**, igual que en la ingesta
 * (identidad → legibilidad → contenido) y en la clasificación de salida de la
 * pasarela. Sintaxis y etiquetas antes que semántica; trivialidad y
 * satisfacibilidad **antes** de buscar, porque una meta trivial vuelve con
 * `proof_found` y se mediría como reactivo legítimo; búsqueda; re-verificación;
 * complejidad; duplicados; pistas. Reordenarlo no cambia cuántos rechazos hay:
 * cambia cuál se reporta, y con él lo que el pipeline intenta arreglar.
 */
export function runW3Generation(input: W3Input): W3Outcome {
  const variante = resolveValidityVariant(input.frozenOrder, input.benchReport);

  const registroDeFamilias = input.familyRegistry ?? new FamilyRegistry();
  const items: W3ItemRecord[] = [];
  const privateSolutions: PrivateSolution[] = [];
  /** Aceptados hasta ahora: la comparación de duplicados es contra ellos. */
  const aceptados: AcceptedItemShape[] = [];

  const porEnunciadoDelCorpus = new Map<string, string>();
  for (const ejercicio of input.corpusExercises) {
    porEnunciadoDelCorpus.set(canonicalStatement(ejercicio.statement), ejercicio.exerciseId);
  }

  assertCoherentW3Input(input);

  for (const candidato of input.candidates) {
    // Paso 1: la salida de Rol C no puede traer solución.
    assertNoAuthoritativeSolution(candidato, candidato.candidateId);

    const rechazos: W3Rejection[] = [];
    const critica = input.critiques.find((c) => c.itemId === candidato.candidateId);
    const conjuntoDePistas = input.hintSets.find((h) => h.itemId === candidato.candidateId);

    if (critica !== undefined) assertCritique(critica);

    // 1. Sintaxis del cálculo autorizado y etiquetas.
    let estructural: { premises: string[]; goal: string } | null = null;
    try {
      estructural = {
        premises: candidato.statement.premises.map((p) => print(parse(p))),
        goal: print(parse(candidato.statement.goal)),
      };
    } catch (error) {
      rechazos.push({
        code: 'syntax_not_in_authorized_calculus',
        detail: error instanceof Error ? error.message : String(error),
      });
    }

    if (candidato.targetKcs.length === 0) {
      rechazos.push({
        code: 'kc_labels_missing',
        detail:
          'sin etiqueta KC no hay cobertura que medir ni ruta que abrir: el reactivo no pertenece ' +
          'a ningún punto del mapa',
      });
    }
    for (const kcId of candidato.targetKcs) {
      if (!(KC_IDS as readonly string[]).includes(kcId)) {
        rechazos.push({ code: 'kc_label_not_in_catalog', detail: kcId });
      }
    }
    if (!(RESERVES as readonly string[]).includes(candidato.bankFunction)) {
      rechazos.push({ code: 'bank_function_not_a_reserve', detail: candidato.bankFunction });
    }

    if (estructural === null) {
      items.push(registroRechazado(candidato, rechazos, critica, conjuntoDePistas !== undefined));
      continue;
    }

    // 2. Meta no trivial y premisas satisfacibles (P-I §7.5).
    if (estructural.premises.includes(estructural.goal)) {
      rechazos.push({
        code: 'goal_trivial',
        detail: `la meta «${estructural.goal}» ya está entre las premisas: el reactivo se cierra ` +
          `citando una línea y no ejercita ninguna regla`,
      });
    }

    const satisfacibilidad = entails(candidato.statement.premises.map(parse), falsum);
    if (satisfacibilidad.status === 'not-applicable') {
      rechazos.push({
        code: 'premise_satisfiability_not_decidable',
        detail:
          `${satisfacibilidad.reason}. No se puede afirmar que las premisas sean satisfacibles, y ` +
          `«no se pudo comprobar» no es «se comprobó»`,
      });
    } else if (satisfacibilidad.status === 'entails' && !candidato.contradictionIsExplicitGoal) {
      rechazos.push({
        code: 'premises_unsatisfiable',
        detail:
          'las premisas son contradictorias sin que la contradicción se declare objetivo: de ⊥ se ' +
          'sigue cualquier cosa, así que el reactivo sería trivial por accidente (P-I §7.5)',
      });
    }

    // 3. Validez determinista en el orden congelado.
    const request: SearchRequest = {
      premises: candidato.statement.premises,
      goal: candidato.statement.goal,
      mode: input.mode,
      budget: input.budget,
    };
    const resultado = variante.run(request);

    if (resultado.status !== 'proof_found') {
      rechazos.push({
        code: resultado.status,
        detail:
          resultado.status === 'search_budget_exhausted'
            ? `presupuesto agotado tras ${resultado.telemetry.workUnits} unidades de trabajo. **No ` +
              `significa inexistencia** (P-I §7.4): el candidato queda fuera del paquete, no ` +
              `declarado indemostrable`
            : resultado.status === 'no_proof_with_cost_at_most_k'
              ? `sin prueba de coste ≤ ${resultado.k}; no se infiere inexistencia global`
              : 'el oráculo semántico independiente exhibió un contramodelo',
      });
      items.push(registroRechazado(candidato, rechazos, critica, conjuntoDePistas !== undefined));
      continue;
    }

    // 4. Re-verificación del certificado con `logic-core`.
    assertCertificateReverified(resultado.proof, candidato.statement.goal);

    // 5. Complejidad estructural y comparación contra CAL-09 congelado.
    const complejidad = structuralComplexity({
      premises: candidato.statement.premises,
      goal: candidato.statement.goal,
      outcome: resultado,
    });
    const indiceDeComplejidad = complexityIndex(complejidad, CAL09_FROZEN_MANIFEST);
    const estratoMedido = classifyComplexity(complejidad, CAL09_FROZEN_MANIFEST);
    if (estratoMedido !== candidato.targetComplexity) {
      rechazos.push({
        code: 'complexity_target_mismatch',
        detail:
          `Rol C pidió complejidad ${candidato.targetComplexity}, pero CAL-09 midió ` +
          `${estratoMedido} (index=${indiceDeComplejidad}).`,
      });
    }

    // 6. Duplicados e isomorfismos sobre representación normalizada.
    const canonico = proofOf(resultado.proof, candidato.statement.goal);
    const enunciadoCanonico = canonicalStatement(candidato.statement);
    const firma = structuralSignature(canonico);

    const delCorpus = porEnunciadoDelCorpus.get(enunciadoCanonico);
    if (delCorpus !== undefined) {
      rechazos.push({
        code: 'duplicate_of_corpus_exercise',
        detail:
          `coincide con el ejercicio ${delCorpus} del corpus fuente bajo la canonicalización ` +
          `congelada: el alumno pudo verlo resuelto en el material`,
      });
    }
    const reservaEfectiva = effectiveReserve({
      itemId: candidato.candidateId,
      reserve: candidato.bankFunction,
      ...(candidato.replacesReserve === undefined
        ? {}
        : { replacesReserve: candidato.replacesReserve }),
    });
    const colision = findDuplicateAmong(canonico, reservaEfectiva, enunciadoCanonico, aceptados);
    if (colision !== null) rechazos.push(colision);

    // 7. Pistas (Rol D) y no revelación en el enunciado (P-I §7.5, §9.6).
    const noReveladas = undisclosedSolutionFormulas({
      solution: canonico,
      statementFormulas: [...candidato.statement.premises, candidato.statement.goal],
    });
    const sinEspacios = candidato.promptText.replace(/\s+/gu, '');
    const filtrada = noReveladas.find((formula) => sinEspacios.includes(formula));
    if (filtrada !== undefined) {
      rechazos.push({
        code: 'solution_leaked_in_statement',
        detail:
          `la redacción del enunciado contiene «${filtrada}», que es un paso de la solución ausente ` +
          `de premisas y meta (P-I §7.5)`,
      });
    }

    if (conjuntoDePistas !== undefined) {
      try {
        assertHintSet(conjuntoDePistas, {
          solution: canonico,
          statementFormulas: [...candidato.statement.premises, candidato.statement.goal],
        });
      } catch (error) {
        if (!(error instanceof HintPolicyError)) throw error;
        rechazos.push({ code: 'hint_policy_violation', detail: error.message });
      }
    }

    /**
     * Paso previo a la auditoría: `item_family_id` inmutable (P-I §7.8).
     *
     * Solo cuando los componentes de pertenencia son válidos. Un candidato con
     * una etiqueta KC que no existe o una función de banco que no es reserva ya
     * está **rechazado por eso mismo**: derivarle una familia obligaría a usar
     * el componente inválido, y hacerlo lanzar convertiría un defecto del
     * candidato —regenerable— en un fallo del pipeline, dejando sin alcanzar
     * los códigos de rechazo que lo describen.
     */
    const componentesInvalidos = rechazos.some(
      (r) =>
        r.code === 'kc_label_not_in_catalog' ||
        r.code === 'kc_labels_missing' ||
        r.code === 'bank_function_not_a_reserve',
    );
    const familia = componentesInvalidos
      ? undefined
      : registroDeFamilias.assign(
          candidato.candidateId,
          familyComponentsOf({
            generatorTemplateId: candidato.generatorTemplateId,
            bankFunction: candidato.bankFunction,
            targetKcs: candidato.targetKcs,
            proof: canonico,
          }),
        );

    const aceptado = rechazos.length === 0;
    items.push(
      Object.freeze({
        ...(familia === undefined ? {} : { itemFamilyId: familia.itemFamilyId }),
        candidateId: candidato.candidateId,
        generatorTemplateId: candidato.generatorTemplateId,
        bankFunction: candidato.bankFunction,
        targetKcs: candidato.targetKcs,
        pipelineState: aceptado ? 'filtros_superados' : 'soluciones_encontradas',
        authoringState: resultado.status,
        accepted: aceptado,
        rejections: Object.freeze([...rechazos]),
        complexity: complejidad,
        targetComplexity: candidato.targetComplexity,
        measuredComplexityTier: estratoMedido,
        complexityIndex: indiceDeComplejidad,
        complexityComparisonAvailable: true,
        structuralSignature: firma,
        criticRiskFlags: critica === undefined ? [] : critiqueRiskFlags(critica),
        criticised: critica !== undefined,
        hintsProvided: conjuntoDePistas !== undefined,
      } satisfies W3ItemRecord),
    );

    if (aceptado) {
      aceptados.push({
        candidateId: candidato.candidateId,
        statement: enunciadoCanonico,
        proof: canonico,
        reserve: reservaEfectiva,
      });
      privateSolutions.push(
        Object.freeze({
          itemId: candidato.candidateId,
          certificate: resultado.proof,
          structuralSignature: firma,
          authorizedCalculusVersion: AUTHORIZED_CALCULUS_VERSION,
          verifierVersion: VERIFIER_VERSION,
          minimalCostVerified: resultado.minimalCostVerified,
        }),
      );
    }
  }

  return Object.freeze({
    items: Object.freeze(items),
    privateSolutions: Object.freeze(privateSolutions),
    variantId: variante.id,
    authorizedCalculusVersion: AUTHORIZED_CALCULUS_VERSION,
  });
}

function registroRechazado(
  candidato: ItemCandidate,
  rechazos: readonly W3Rejection[],
  critica: ItemCritique | undefined,
  hintsProvided: boolean,
): W3ItemRecord {
  /**
   * Solo hay estado de autoría si el buscador corrió. Un candidato que cayó por
   * sintaxis no tiene ninguno, y **no se le inventa**: registrar
   * `search_budget_exhausted` diría que el presupuesto se gastó en algo que el
   * buscador nunca vio, y el pipeline intentaría arreglarlo subiendo el
   * presupuesto.
   */
  const rechazoDeBusqueda = rechazos.find(
    (r) =>
      r.code === 'semantically_invalid' ||
      r.code === 'search_budget_exhausted' ||
      r.code === 'no_proof_with_cost_at_most_k',
  );
  return Object.freeze({
    candidateId: candidato.candidateId,
    generatorTemplateId: candidato.generatorTemplateId,
    bankFunction: candidato.bankFunction,
    targetKcs: candidato.targetKcs,
    pipelineState: 'candidatos_generados',
    ...(rechazoDeBusqueda === undefined
      ? {}
      : { authoringState: rechazoDeBusqueda.code as SearchOutcome['status'] }),
    accepted: false,
    rejections: Object.freeze([...rechazos]),
    targetComplexity: candidato.targetComplexity,
    complexityComparisonAvailable: false,
    criticRiskFlags: critica === undefined ? [] : critiqueRiskFlags(critica),
    criticised: critica !== undefined,
    hintsProvided,
  } satisfies W3ItemRecord);
}

/**
 * Comparar la complejidad medida con la complejidad objetivo de Rol C.
 *
 * Usa el manifiesto congelado de T-H5-10; aceptar la declaración de Rol C sin
 * contrastarla convertiría al generador en la medida.
 */
export function assertMeasuredMatchesTargetComplexity(
  profile: StructuralComplexityProfile,
  targetComplexity: ComplexityTier,
): Readonly<{ index: number; measuredTier: ComplexityTier }> {
  const index = complexityIndex(profile, CAL09_FROZEN_MANIFEST);
  const measuredTier = classifyComplexity(profile, CAL09_FROZEN_MANIFEST);
  if (measuredTier !== targetComplexity) {
    throw new ComplexityTargetMismatchError(
      `complejidad objetivo ${targetComplexity}, medida ${measuredTier} (CAL-09 index=${index})`,
    );
  }
  return Object.freeze({ index, measuredTier });
}
