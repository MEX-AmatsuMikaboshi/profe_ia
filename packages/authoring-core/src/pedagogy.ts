import {
  PedagogicalStrategy,
  STRATEGY_CATALOG_ES,
  type PedagogicalMode,
} from '@profesor-ia/contracts';
import { PedagogyPolicyError } from './errors.js';
import { KC_IDS, type KcId } from './kc-map.js';

/**
 * Política pedagógica de autoría, Rol B (T-H5-04 ← P-I §5.9, §5.10, §8.3.1–§8.3.4;
 * P-II §7.2.1). Es el contenido versionado de `pedagogy/`, no el motor: quien
 * decide en sesión es `pedagogy-policy` en F7.
 *
 * Lo que gobierna el módulo es que **el catálogo es cerrado y de doce**, y que
 * dos de esos doce no tienen miembro en el enum de decisión de P-II §7.2.1. Esa
 * asimetría es real y está en el Maestro: §5.10 enumera doce acciones de
 * enseñanza y §7.2.1 da —«por ejemplo»— un contrato con diez estrategias. No se
 * resuelve inventando dos miembros de enum ni fingiendo que el catálogo son
 * diez: se resuelve **diciendo por dónde se expresa cada uno**, y fallando
 * cerrado si alguien intenta convertir en `strategy` uno que no lo tiene.
 *
 * `fading contingente` se expresa **bajando `assistanceLevel`**, que es un campo
 * del propio contrato de decisión —el *fading* literalmente es retirar ayuda—, y
 * `feedback correctivo` acompaña a la decisión en vez de competir con ella: se
 * puede dar feedback *y* elegir estrategia en el mismo paso, así que meterlo en
 * un enum de opciones mutuamente excluyentes lo habría vuelto incompatible con
 * las otras once.
 */

/** Los doce del catálogo, **derivados** del contrato para que no puedan divergir. */
export const STRATEGY_CATALOG_SIZE = 12;

/** Las diez del enum de decisión de P-II §7.2.1. */
export const DECISION_STRATEGY_COUNT = 10;

export interface StrategyCatalogEntry {
  readonly catalogEntryId: string;
  /** Nombre literal de P-I §5.10, tomado del contrato. */
  readonly es: string;
  /** Miembro del enum de decisión, cuando lo tiene. */
  readonly decisionStrategy?: PedagogicalStrategy;
  /** Cómo se expresa el que no tiene miembro de enum. */
  readonly expressedBy?: string;
}

const IDS_DEL_CATALOGO = [
  'explicacion_directa_breve',
  'ejemplo_trabajado',
  'ejemplo_incompleto',
  'practica_guiada',
  'practica_independiente',
  'scaffolding_contingente',
  'fading_contingente',
  'autoexplicacion_guiada',
  'retrieval_practice',
  'feedback_correctivo',
  'recuperacion_de_prerrequisito',
  'comprobacion_de_transferencia_cercana',
] as const;
export type StrategyCatalogEntryId = (typeof IDS_DEL_CATALOGO)[number];

/**
 * Correspondencia entrada del catálogo → miembro del enum. `null` marca las dos
 * que **no** tienen miembro, y es explícito a propósito: un hueco sin marcar se
 * leería como un olvido y alguien lo «arreglaría» inventando el enum.
 */
const ENUM_POR_ENTRADA: Readonly<Record<StrategyCatalogEntryId, PedagogicalStrategy | null>> =
  Object.freeze({
    explicacion_directa_breve: 'direct_explanation',
    ejemplo_trabajado: 'worked_example',
    ejemplo_incompleto: 'completion_problem',
    practica_guiada: 'guided_practice',
    practica_independiente: 'independent_practice',
    scaffolding_contingente: 'scaffolding',
    fading_contingente: null,
    autoexplicacion_guiada: 'self_explanation',
    retrieval_practice: 'retrieval',
    feedback_correctivo: null,
    recuperacion_de_prerrequisito: 'prerequisite_remediation',
    comprobacion_de_transferencia_cercana: 'near_transfer',
  });

const EXPRESION_SIN_ENUM: Readonly<Record<string, string>> = Object.freeze({
  fading_contingente:
    'bajando `assistanceLevel` en la decisión: el fading es literalmente retirar ayuda, y ' +
    '`assistanceLevel` ya es un campo del contrato de P-II §7.2.1.',
  feedback_correctivo:
    'acompañando a la decisión, no compitiendo con ella: se da feedback **y** se elige ' +
    'estrategia en el mismo paso, así que un enum de opciones excluyentes lo habría vuelto ' +
    'incompatible con las otras once.',
});

export const STRATEGY_CATALOG: readonly StrategyCatalogEntry[] = Object.freeze(
  IDS_DEL_CATALOGO.map((catalogEntryId, indice) => {
    const enumMember = ENUM_POR_ENTRADA[catalogEntryId];
    const es = STRATEGY_CATALOG_ES[indice] ?? '';
    return Object.freeze(
      enumMember === null
        ? { catalogEntryId, es, expressedBy: EXPRESION_SIN_ENUM[catalogEntryId] ?? '' }
        : { catalogEntryId, es, decisionStrategy: enumMember },
    );
  }),
);

/**
 * Comprueba que el catálogo no ha derivado de sus dos fuentes.
 *
 * Si §5.10 ganara una entrada o §7.2.1 un miembro y aquí no se reflejara, la
 * matriz de activación cubriría un catálogo que ya no es el vigente, y el hueco
 * no aparecería hasta que una estrategia no se pudiera activar en sesión.
 */
export function assertCatalogMatchesContracts(
  catalog: readonly StrategyCatalogEntry[] = STRATEGY_CATALOG,
): void {
  if (STRATEGY_CATALOG_ES.length !== STRATEGY_CATALOG_SIZE) {
    throw new PedagogyPolicyError(
      `P-I §5.10 tiene ${STRATEGY_CATALOG_ES.length} entradas y aquí se esperan ` +
        `${STRATEGY_CATALOG_SIZE}. El catálogo se congela por corrida: una entrada nueva es una ` +
        `decisión normativa, no un añadido.`,
    );
  }
  if (PedagogicalStrategy.options.length !== DECISION_STRATEGY_COUNT) {
    throw new PedagogyPolicyError(
      `El enum de decisión tiene ${PedagogicalStrategy.options.length} miembros y aquí se esperan ` +
        `${DECISION_STRATEGY_COUNT}.`,
    );
  }

  const mapeados = catalog.filter((e) => e.decisionStrategy !== undefined);
  if (mapeados.length !== DECISION_STRATEGY_COUNT) {
    throw new PedagogyPolicyError(
      `${mapeados.length} entradas del catálogo mapean al enum y deberían ser ` +
        `${DECISION_STRATEGY_COUNT}.`,
    );
  }

  for (const entrada of catalog) {
    if (entrada.decisionStrategy === undefined && (entrada.expressedBy ?? '').trim() === '') {
      throw new PedagogyPolicyError(
        `La entrada ${entrada.catalogEntryId} no tiene miembro de enum y tampoco dice por dónde se ` +
          `expresa. Un hueco sin marcar se lee como olvido y alguien lo «arregla» inventando el enum.`,
      );
    }
  }
}

/**
 * Traduce una entrada del catálogo a `PedagogicalDecision.strategy`.
 *
 * **Falla cerrado** en las dos que no tienen miembro, y el mensaje dice por
 * dónde se expresan. Devolver una estrategia parecida —`scaffolding` por
 * `fading`, pongamos— haría que la traza registrara que se dio ayuda justo en el
 * paso en que se estaba retirando.
 */
export function toDecisionStrategy(catalogEntryId: string): PedagogicalStrategy {
  const entrada = STRATEGY_CATALOG.find((e) => e.catalogEntryId === catalogEntryId);
  if (entrada === undefined) {
    throw new PedagogyPolicyError(
      `${catalogEntryId} no está en el catálogo de P-I §5.10. El agente de sesión no inventa ` +
        `categorías nuevas con autoridad operativa.`,
    );
  }
  if (entrada.decisionStrategy === undefined) {
    throw new PedagogyPolicyError(
      `${catalogEntryId} no tiene miembro en el enum de P-II §7.2.1. Se expresa ${entrada.expressedBy}`,
    );
  }
  return entrada.decisionStrategy;
}

/** Jerarquía de decisión pedagógica, literal y **en orden** (§8.3.1). */
export const DECISION_HIERARCHY = [
  'seguridad, integridad, modo pedagógico y límites de no revelación',
  'prerrequisitos bloqueantes',
  'política de dominio y recuperación',
  'selección de estrategia según tipo de KC y estado observable',
  'adaptación lingüística/visual de la IA dentro de la estrategia elegida',
] as const;

/** Nivel de la jerarquía en el que actúa una regla de activación (1–5). */
export type HierarchyLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Un paso de patrón: o es una entrada del catálogo, o es una acción del motor
 * que **no** es una estrategia. No se fuerza el mapeo, por lo mismo que
 * «disponer de una disyunción» no se convirtió en arista del mapa de KC:
 * inventarle una estrategia a «volver al KC objetivo» afirmaría una decisión
 * pedagógica donde solo hay una transición del motor.
 */
export type PatternStep =
  | { readonly catalogEntryId: StrategyCatalogEntryId }
  | { readonly engineAction: string };

export interface BasePattern {
  readonly patternId: string;
  readonly steps: readonly PatternStep[];
}

/** Los cinco patrones base literales de §8.3.2. La política debe poder representarlos. */
export const BASE_PATTERNS: readonly BasePattern[] = Object.freeze([
  {
    patternId: 'kc_procedimental_nuevo',
    steps: [
      { catalogEntryId: 'explicacion_directa_breve' },
      { catalogEntryId: 'ejemplo_trabajado' },
      { catalogEntryId: 'ejemplo_incompleto' },
      { catalogEntryId: 'practica_guiada' },
      { catalogEntryId: 'practica_independiente' },
      { catalogEntryId: 'comprobacion_de_transferencia_cercana' },
    ],
  },
  {
    patternId: 'dificultad_parcial',
    steps: [
      { catalogEntryId: 'scaffolding_contingente' },
      { engineAction: 'comprobación' },
      { catalogEntryId: 'fading_contingente' },
    ],
  },
  {
    patternId: 'error_repetido_mismo_tipo',
    steps: [
      { catalogEntryId: 'feedback_correctivo' },
      { catalogEntryId: 'autoexplicacion_guiada' },
      { engineAction: 'explicación dirigida / ejemplo contrastante' },
      { engineAction: 'nueva práctica' },
    ],
  },
  {
    patternId: 'fallo_de_prerrequisito',
    steps: [
      { engineAction: 'suspender avance del KC actual' },
      { catalogEntryId: 'recuperacion_de_prerrequisito' },
      { engineAction: 'volver al KC objetivo' },
    ],
  },
  {
    patternId: 'dominio_aparente_o_dependencia_de_ayuda',
    steps: [
      { engineAction: 'nuevo intento sin ayuda' },
      { catalogEntryId: 'comprobacion_de_transferencia_cercana' },
      { engineAction: 'sonda independiente cuando corresponda al calendario' },
    ],
  },
]);

export interface ActivationRule {
  readonly ruleId: string;
  readonly level: HierarchyLevel;
  readonly catalogEntryId: StrategyCatalogEntryId;
  /** Modos en los que la regla puede activarse. */
  readonly modes: readonly PedagogicalMode[];
  readonly whenObservable: string;
}

export interface ActivationMatrix {
  readonly policyVersion: string;
  readonly rules: readonly ActivationRule[];
}

/**
 * Comprueba la matriz de activación contra §5.9, §8.3.1 y §8.3.2.
 *
 * El punto duro es el primero: **ninguna regla activa una estrategia asistiva en
 * `MEASUREMENT_MODE`**. La jerarquía pone el modo pedagógico en el nivel 1 y la
 * selección de estrategia en el 4, así que una regla de nivel 4 que se activara
 * midiendo invertiría la jerarquía —y no de forma visible: se vería como una
 * ayuda oportuna justo donde la medición deja de valer—.
 */
export function assertActivationMatrix(matrix: ActivationMatrix): void {
  if (matrix.policyVersion.trim() === '') {
    throw new PedagogyPolicyError(
      'La matriz no declara versión. §7.2.1 exige que la tabla de transiciones se versione y ' +
        'congele por corrida: sin versión no se puede decir qué política gobernó una sesión.',
    );
  }
  if (matrix.rules.length === 0) {
    throw new PedagogyPolicyError(
      'La matriz no tiene reglas. Una matriz vacía no activa nada y dejaría al motor sin política.',
    );
  }

  for (const regla of matrix.rules) {
    if (!STRATEGY_CATALOG.some((e) => e.catalogEntryId === regla.catalogEntryId)) {
      throw new PedagogyPolicyError(
        `La regla ${regla.ruleId} activa ${regla.catalogEntryId}, que no está en el catálogo de ` +
          `P-I §5.10. No se crean categorías nuevas con autoridad operativa.`,
      );
    }
    if (regla.modes.length === 0) {
      throw new PedagogyPolicyError(
        `La regla ${regla.ruleId} no declara modo. «No consta» y «en cualquier modo» no son lo mismo.`,
      );
    }
    if (regla.modes.includes('MEASUREMENT_MODE')) {
      throw new PedagogyPolicyError(
        `La regla ${regla.ruleId} activaría ${regla.catalogEntryId} en MEASUREMENT_MODE. §5.9 ` +
          `deshabilita ahí la ayuda no autorizada, y §8.3.1 pone el modo pedagógico por encima de ` +
          `la selección de estrategia: una regla de nivel ${regla.level} no puede invertir la ` +
          `jerarquía. Se vería como una ayuda oportuna justo donde la medición deja de valer.`,
      );
    }
    if (regla.whenObservable.trim() === '') {
      throw new PedagogyPolicyError(
        `La regla ${regla.ruleId} no declara la señal observable que la activa. §5.10 exige ` +
          `selección «a partir de señales observables», no a criterio del agente.`,
      );
    }
  }

  assertBasePatternsRepresentable(matrix);
}

/**
 * «La política debe **poder representar**, al menos, estos patrones» (§8.3.2).
 *
 * Solo se exige a los pasos que son estrategias del catálogo: los que son
 * acciones del motor —«volver al KC objetivo»— los implementa F7 y exigirlos
 * aquí obligaría a inventarles una estrategia.
 */
export function assertBasePatternsRepresentable(matrix: ActivationMatrix): void {
  const activables = new Set(matrix.rules.map((r) => r.catalogEntryId));
  const faltantes: string[] = [];

  for (const patron of BASE_PATTERNS) {
    for (const paso of patron.steps) {
      if ('catalogEntryId' in paso && !activables.has(paso.catalogEntryId)) {
        faltantes.push(`${patron.patternId}→${paso.catalogEntryId}`);
      }
    }
  }

  if (faltantes.length > 0) {
    throw new PedagogyPolicyError(
      `La matriz no puede representar ${[...new Set(faltantes)].join(', ')}. §8.3.2 exige poder ` +
        `representar los cinco patrones base; sin regla que la active, esa estrategia está en el ` +
        `catálogo y no ocurre nunca.`,
    );
  }
}

export interface FadingRule {
  readonly ruleId: string;
  /** Si el retiro de ayuda se dispara por minutos o por número de ejercicios. */
  readonly triggeredByFixedTimeOrCount: boolean;
  /** Evidencia de preinscripción y validación expresa; obligatoria si lo anterior es cierto. */
  readonly preinscriptionEvidence?: string;
  readonly contingentOnPerformance: boolean;
}

/**
 * «El *fading* es contingente al desempeño. **No se retira ayuda por un simple
 * número fijo de minutos o ejercicios salvo que esa regla haya sido preinscrita
 * y validada expresamente**» (§8.3.2).
 *
 * La excepción existe en la norma, así que no se prohíbe: se exige la evidencia
 * que la norma exige. Sin ella, retirar ayuda por reloj mediría cuánto aguanta
 * el alumno sin ayuda, no cuánto ha aprendido.
 */
export function assertFadingPolicy(rules: readonly FadingRule[]): void {
  for (const regla of rules) {
    if (regla.triggeredByFixedTimeOrCount && (regla.preinscriptionEvidence ?? '').trim() === '') {
      throw new PedagogyPolicyError(
        `La regla de fading ${regla.ruleId} retira ayuda por un número fijo de minutos o ` +
          `ejercicios y no trae evidencia de preinscripción. §8.3.2 lo permite «salvo que esa regla ` +
          `haya sido preinscrita y validada expresamente»: sin la evidencia, la excepción no aplica.`,
      );
    }
    if (!regla.contingentOnPerformance && !regla.triggeredByFixedTimeOrCount) {
      throw new PedagogyPolicyError(
        `La regla de fading ${regla.ruleId} no es contingente al desempeño ni declara disparador. ` +
          `Un fading que no depende de nada no es contingente, es automático.`,
      );
    }
  }
}

/** Los tres disparadores literales de autoexplicación (§8.3.3). */
export const SELF_EXPLANATION_TRIGGERS = [
  'despues_de_paso_correcto_no_trivial',
  'tras_error_persistente',
  'para_distinguir_comprension_de_memorizacion',
] as const;
export type SelfExplanationTrigger = (typeof SELF_EXPLANATION_TRIGGERS)[number];

export interface SelfExplanationPolicy {
  readonly triggers: readonly SelfExplanationTrigger[];
  /** Si se pide en cada paso. §8.3.3 dice «de forma selectiva, no en cada paso». */
  readonly everyStep: boolean;
  /** El prompt debe ser dirigido y anclado al KC. */
  readonly anchoredToKc: boolean;
}

/**
 * §8.3.3: selectiva, no en cada paso; prompt dirigido y anclado al KC; su
 * respuesta sirve para diagnóstico, **no sustituye al verificador formal**.
 */
export function assertSelfExplanationPolicy(policy: SelfExplanationPolicy): void {
  if (policy.everyStep) {
    throw new PedagogyPolicyError(
      'La autoexplicación se usa «de forma selectiva, no en cada paso» (§8.3.3). Pedirla siempre ' +
        'la convierte en trámite y deja de distinguir comprensión de memorización de patrón, que ' +
        'es una de las tres cosas para las que existe.',
    );
  }
  if (policy.triggers.length === 0) {
    throw new PedagogyPolicyError(
      'La política de autoexplicación no declara ningún disparador: no se activaría nunca.',
    );
  }
  if (!policy.anchoredToKc) {
    throw new PedagogyPolicyError(
      'El prompt de autoexplicación debe ser dirigido y anclado al KC (§8.3.3). Sin anclaje, la ' +
        'respuesta no sirve para diagnóstico del KC que se está enseñando.',
    );
  }
}

export interface RetrievalPlanEntry {
  readonly kcId: KcId;
  /** El KC ya fue introducido por primera enseñanza antes de esta práctica. */
  readonly alreadyIntroduced: boolean;
  /** Si la revisión espaciada consume reserva de medición. */
  readonly usesMeasurementReserve: boolean;
}

/**
 * §8.3.4, las dos reglas.
 *
 * `retrieval practice` recupera conocimiento **ya introducido** y no sustituye a
 * la primera enseñanza; y la revisión espaciada y la sonda de retención son
 * funciones distintas —una enseña, la otra mide y permanece aislada—, así que
 * una revisión que consumiera reserva de medición gastaría el material con el
 * que después se mide.
 */
export function assertRetrievalPlan(entries: readonly RetrievalPlanEntry[]): void {
  for (const entrada of entries) {
    if (!(KC_IDS as readonly string[]).includes(entrada.kcId)) {
      throw new PedagogyPolicyError(`${entrada.kcId} no está en el catálogo de KC.`);
    }
    if (!entrada.alreadyIntroduced) {
      throw new PedagogyPolicyError(
        `El plan programa retrieval sobre ${entrada.kcId} sin primera enseñanza previa. §8.3.4: ` +
          `«recuperar conocimiento ya introducido, no sustituto de la primera enseñanza».`,
      );
    }
    if (entrada.usesMeasurementReserve) {
      throw new PedagogyPolicyError(
        `La revisión espaciada de ${entrada.kcId} consume reserva de medición. §8.3.4 las separa: ` +
          `una enseña/practica, la otra mide y permanece aislada. Gastarla aquí consumiría el ` +
          `material con el que después se mide la retención.`,
      );
    }
  }
}

export interface ObservableObjective {
  readonly kcId: KcId;
  readonly statement: string;
  /** Qué se observa para darlo por cumplido. Sin esto el objetivo no es observable. */
  readonly observableEvidence: string;
}

/**
 * Objetivos observables por KC. Un objetivo sin evidencia observable no es un
 * objetivo observable: es una intención, y no se puede decir si se cumplió.
 */
export function assertObservableObjectives(
  objectives: readonly ObservableObjective[],
  requiredKcs: readonly KcId[],
): void {
  if (requiredKcs.length === 0) {
    throw new PedagogyPolicyError(
      'No se declaró ningún KC que deba tener objetivo: la comprobación pasaría por vacío.',
    );
  }

  for (const objetivo of objectives) {
    if (objetivo.observableEvidence.trim() === '' || objetivo.statement.trim() === '') {
      throw new PedagogyPolicyError(
        `El objetivo de ${objetivo.kcId} no declara enunciado o evidencia observable. Un objetivo ` +
          `sin evidencia es una intención: no se puede decir si se cumplió.`,
      );
    }
  }

  const cubiertos = new Set(objectives.map((o) => o.kcId));
  const faltan = requiredKcs.filter((kcId) => !cubiertos.has(kcId));
  if (faltan.length > 0) {
    throw new PedagogyPolicyError(
      `Sin objetivo observable: ${faltan.join(', ')}. Un KC que se enseña sin objetivo no tiene ` +
        `criterio de cierre.`,
    );
  }
}
