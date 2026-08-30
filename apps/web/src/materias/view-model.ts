import {
  courseBadge,
  type CourseBadge,
  type CourseStatusPanel,
} from '../clase/course-badge';
import {
  isTeachable,
  preparationView,
  type Course,
  type CourseProgress,
  type PreparationArtifact,
  type PreparationMessage,
  type PreparationView,
} from '@profesor-ia/domain-engine';

/**
 * Modelos de las cuatro vistas de materia
 * (T-CC-05 ← UIUX §6.1, §6.2, §6.4, §6.6, UI-CORR-01, P-I §3.1.2).
 *
 * Igual que en Clase, la vista no decide: recibe lo que las fuentes de verdad
 * dan y lo ordena. Aquí eso importa más que allí, porque las cuatro vistas son
 * exactamente donde la especificación prohíbe **inventar una medida**.
 *
 * ## Los tres números que esta capa no calcula, y por qué
 *
 * 1. **Progreso.** §6.1: «no debe inferir por sí misma reglas pedagógicas a
 *    partir de porcentajes ficticios del mockup». Aquí no hay ninguna división.
 *    Lo que se muestra es un **recuento por estado autoritativo**, que no es una
 *    estimación: cuatro KC dominados de trece son cuatro y trece, no un 31 %.
 * 2. **Retención.** §6.6: «no se implementan porcentajes de "retención
 *    estimada"». Por eso {@link RetentionState} es una unión: o hay medidas, o
 *    consta `retention_not_evaluated`. No hay tercer caso donde quepa un número
 *    inventado.
 * 3. **Coste.** §6.1 lo pide «cuando exista en `cost-ledger`». Un `0,00 MXN` con
 *    el ledger vacío afirma que no se ha gastado nada, que es distinto de no
 *    saberlo — y en una corrida con presupuesto esa diferencia decide.
 *
 * ## El estado de un KC se nombra como lo nombra su fuente
 *
 * `masteryStatus` tiene tres miembros (`not_mastered`, `mastered`,
 * `reconfirmation_failed`) y aquí hay cuatro estados: los tres más `pendiente`,
 * que es **no tener estado**. La traducción es uno a uno y la prosa comprensible
 * vive en {@link MATERIAS_COPY}. Fundir `reconfirmation_failed` dentro de «en
 * aprendizaje» —que era lo cómodo, porque §6.6 enumera cuatro rótulos
 * amables— borraría de la pantalla que el dominio llegó a declararse y después
 * falló al reconfirmarse, que es justo lo que un alumno necesita saber.
 *
 * ## Y por eso Progreso tiene dos formas, no una con bandera
 *
 * Una materia propia **no tiene autoridad de evaluación** (`T-CC-04`): no hay
 * verificador, ni KC del cálculo congelado, ni declaración de dominio. Si esta
 * capa devolviera la misma forma con la lista vacía, la pantalla diría «0
 * dominados de 0» — una afirmación sobre el aprendizaje del alumno que nadie
 * midió. {@link progresoView} devuelve una rama **sin campo de dominio**, y la
 * vista enseña historial y actividad en su lugar. Es el patrón de D-92: la rama
 * sin autoridad no tiene dónde escribir el veredicto.
 */

export const MATERIAS_VIEW_SCHEMA_VERSION = 'materias-view-v1' as const;

export type MateriasViewErrorCode =
  | 'PROGRESO_DE_OTRA_MATERIA'
  | 'DOMINIO_SIN_AUTORIDAD'
  | 'ESTADO_DE_KC_FUERA_DEL_CATALOGO'
  | 'MATERIA_ACTIVA_AUSENTE';

export class MateriasViewError extends Error {
  constructor(
    readonly code: MateriasViewErrorCode,
    detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = 'MateriasViewError';
  }
}

// ──────────────────────────── entradas autoritativas ────────────────────────────

/**
 * Los tres estados de `DomainKcState.masteryStatus`, tal cual.
 *
 * Se copian en vez de importarse porque `apps/web` no alcanza el estado de
 * dominio: lo recibe ya proyectado. Una prueba comprueba que la copia sigue
 * correspondiendo, igual que hace `mastery.ts` con la calibración.
 */
export const AUTHORITATIVE_MASTERY_STATUSES = [
  'not_mastered',
  'mastered',
  'reconfirmation_failed',
] as const;
export type AuthoritativeMasteryStatus = (typeof AUTHORITATIVE_MASTERY_STATUSES)[number];

/** Estado de un KC en pantalla. `pendiente` es **no tener estado**, no un cero. */
export const KC_PROGRESS_STATES = [
  'dominado',
  'en_aprendizaje',
  'reconfirmacion_fallida',
  'pendiente',
] as const;
export type KcProgressState = (typeof KC_PROGRESS_STATES)[number];

const POR_ESTADO_AUTORITATIVO: Readonly<Record<AuthoritativeMasteryStatus, KcProgressState>> =
  Object.freeze({
    mastered: 'dominado',
    not_mastered: 'en_aprendizaje',
    reconfirmation_failed: 'reconfirmacion_fallida',
  });

/** Proyección de dominio que llega desde `domain-engine`, ya calculada allí. */
export interface KcMasteryProjection {
  readonly kcId: string;
  readonly masteryStatus: AuthoritativeMasteryStatus;
  /** Última vez que el estado cambió. `null` si nunca cambió. */
  readonly lastChangedAt: string | null;
}

export interface RetentionMeasurement {
  readonly kcId: string;
  readonly correct: boolean;
  readonly measuredAt: string;
}

/**
 * Retención: medida o declarada no evaluada. **No hay rama estimada**, y esa
 * ausencia es la que cumple §6.6.
 */
export type RetentionState =
  | { readonly kind: 'medida'; readonly measurements: readonly RetentionMeasurement[] }
  | { readonly kind: 'no_evaluada'; readonly declaredCode: 'retention_not_evaluated' };

/** Repaso que el motor **ya** programó. La lista vacía dice que no programó ninguno. */
export interface ScheduledReview {
  readonly kcId: string;
  readonly scheduledFor: string;
}

/**
 * Consumo real, tal como lo trae `cost-ledger`. `null` es «no hay registro», y
 * la vista lo dice con esas palabras en vez de enseñar un cero.
 */
export interface CostSummary {
  readonly currency: string;
  /** Cadena, no `number`: el ledger la trae ya formateada y redondear aquí movería una cifra de gasto. */
  readonly amount: string;
  readonly entries: number;
}

// ──────────────────────────────── §6.1 Inicio ────────────────────────────────

/** La acción principal de una materia. `continuar` sólo si hay dónde volver. */
export type PrimaryAction =
  | { readonly kind: 'continuar'; readonly resumePoint: string }
  | { readonly kind: 'empezar' }
  | { readonly kind: 'ver_preparacion'; readonly state: PreparationView['state'] };

/**
 * Elige la acción. `resumePoint === null` **no** da «Continuar».
 *
 * Ofrecer «Continuar clase» y dejar al alumno en el principio es un fallo que en
 * pantalla parece de navegación y en realidad es de datos: el usuario concluye
 * que la aplicación perdió su avance. Por eso las dos ramas se distinguen aquí y
 * no en el componente, donde una condición olvidada no rompe nada visible.
 */
export function primaryAction(course: Course, progress: CourseProgress): PrimaryAction {
  if (!isTeachable(course)) return { kind: 'ver_preparacion', state: course.preparation };
  return progress.resumePoint === null
    ? { kind: 'empezar' }
    : { kind: 'continuar', resumePoint: progress.resumePoint };
}

export interface MateriaCard {
  readonly courseId: string;
  readonly title: string;
  readonly badge: CourseBadge;
  readonly teachable: boolean;
  readonly action: PrimaryAction;
  readonly lastSessionId: string | null;
  readonly updatedAtMs: number;
}

export interface InicioViewModel {
  readonly schemaVersion: typeof MATERIAS_VIEW_SCHEMA_VERSION;
  /** La materia a la que el usuario vuelve. `null` si no ha abierto ninguna. */
  readonly active: MateriaCard | null;
  /** Materias enseñables, la activa incluida. */
  readonly enCurso: readonly MateriaCard[];
  /** Materias que todavía se están preparando (§6.1: «materias en preparación»). */
  readonly enPreparacion: readonly MateriaCard[];
  readonly scheduledReviews: readonly ScheduledReview[];
  /** `null` cuando el ledger no tiene nada. Ver la nota de cabecera. */
  readonly cost: CostSummary | null;
  /** Estado de capacidades/proveedor, secundario por norma. */
  readonly capabilitiesNote: string;
}

export interface MateriaInput {
  readonly course: Course;
  readonly progress: CourseProgress;
}

function card(input: MateriaInput): MateriaCard {
  if (input.progress.courseId !== input.course.courseId) {
    throw new MateriasViewError(
      'PROGRESO_DE_OTRA_MATERIA',
      `«${input.course.courseId}» viene con el progreso de «${input.progress.courseId}». ` +
        `Pintarlos juntos ofrecería «Continuar» hacia el punto de retorno de otra asignatura.`,
    );
  }
  return {
    courseId: input.course.courseId,
    title: input.course.title,
    badge: courseBadge(input.course.courseType),
    teachable: isTeachable(input.course),
    action: primaryAction(input.course, input.progress),
    lastSessionId: input.progress.lastSessionId,
    updatedAtMs: input.progress.updatedAtMs,
  };
}

export function inicioView(input: {
  readonly materias: readonly MateriaInput[];
  /** Id de la materia activa. `null` si el usuario no ha abierto ninguna. */
  readonly activeCourseId: string | null;
  readonly scheduledReviews: readonly ScheduledReview[];
  readonly cost: CostSummary | null;
  readonly capabilitiesNote: string;
}): InicioViewModel {
  const cards = input.materias.map(card);

  // Una materia activa que no está entre las materias es un id colgado: la
  // pantalla enseñaría «Continuar» sobre una tarjeta que no existe, o —peor—
  // se elegiría la primera de la lista y el usuario volvería a otra clase.
  const active =
    input.activeCourseId === null
      ? null
      : (cards.find((c) => c.courseId === input.activeCourseId) ??
        (() => {
          throw new MateriasViewError(
            'MATERIA_ACTIVA_AUSENTE',
            `La materia activa «${input.activeCourseId}» no está entre las ${cards.length} ` +
              `materias. Elegir otra en su lugar mandaría al alumno a una clase que no es la suya.`,
          );
        })());

  return {
    schemaVersion: MATERIAS_VIEW_SCHEMA_VERSION,
    active,
    enCurso: Object.freeze(cards.filter((c) => c.teachable)),
    enPreparacion: Object.freeze(cards.filter((c) => !c.teachable)),
    scheduledReviews: Object.freeze([...input.scheduledReviews]),
    cost: input.cost,
    capabilitiesNote: input.capabilitiesNote,
  };
}

// ─────────────────────────────── §6.2 Mis materias ───────────────────────────────

export interface MateriaRow extends MateriaCard {
  /** Los tres huecos de UI-CORR-01, ya separados por `courseStatusPanel`. */
  readonly status: CourseStatusPanel;
}

export interface MisMateriasViewModel {
  readonly schemaVersion: typeof MATERIAS_VIEW_SCHEMA_VERSION;
  /**
   * Las dos listas van **separadas estructuralmente**, que es lo que §6.2 pide.
   * Una sola lista ordenada con la insignia al lado deja al carril validado
   * arriba por accidente de orden, y un orden es una jerarquía que P-I §3.1.2
   * prohíbe insinuar.
   */
  readonly validado: readonly MateriaRow[];
  readonly personalizadas: readonly MateriaRow[];
}

export function misMateriasView(input: {
  readonly materias: readonly (MateriaInput & { readonly status: CourseStatusPanel })[];
}): MisMateriasViewModel {
  const filas: MateriaRow[] = input.materias.map((m) => ({ ...card(m), status: m.status }));
  return {
    schemaVersion: MATERIAS_VIEW_SCHEMA_VERSION,
    validado: Object.freeze(filas.filter((f) => f.badge.track === 'VALIDATED_LOGIC_COURSE')),
    personalizadas: Object.freeze(
      filas.filter((f) => f.badge.track === 'CUSTOM_COURSE_UNVALIDATED'),
    ),
  };
}

// ──────────────────────────── §6.4 Detalle de materia ────────────────────────────

export interface UnitOutline {
  readonly unitId: string;
  readonly title: string;
  readonly kcIds: readonly string[];
}

export interface SessionHistoryEntry {
  readonly sessionId: string;
  readonly endedAt: string;
  readonly summary: string;
}

export interface DetalleViewModel {
  readonly schemaVersion: typeof MATERIAS_VIEW_SCHEMA_VERSION;
  readonly card: MateriaCard;
  readonly status: CourseStatusPanel;
  readonly outline: readonly UnitOutline[];
  readonly history: readonly SessionHistoryEntry[];
  readonly scheduledReviews: readonly ScheduledReview[];
  /** Sólo cuando la materia todavía se prepara; `null` en cuanto está creada. */
  readonly preparation: PreparationView | null;
}

export function detalleView(input: {
  readonly materia: MateriaInput;
  readonly status: CourseStatusPanel;
  readonly outline: readonly UnitOutline[];
  readonly history: readonly SessionHistoryEntry[];
  readonly scheduledReviews: readonly ScheduledReview[];
  readonly preparationArtifacts: readonly PreparationArtifact[];
  readonly lastPreparationMessage: PreparationMessage | null;
}): DetalleViewModel {
  const tarjeta = card(input.materia);
  const preparation =
    tarjeta.teachable || input.lastPreparationMessage === null
      ? null
      : preparationView({
          course: input.materia.course,
          artifacts: input.preparationArtifacts,
          lastMessage: input.lastPreparationMessage,
        });
  return {
    schemaVersion: MATERIAS_VIEW_SCHEMA_VERSION,
    card: tarjeta,
    status: input.status,
    outline: Object.freeze([...input.outline]),
    history: Object.freeze([...input.history]),
    scheduledReviews: Object.freeze([...input.scheduledReviews]),
    preparation,
  };
}

// ────────────────────────────────── §6.6 Progreso ──────────────────────────────────

export interface KcProgressRow {
  readonly kcId: string;
  readonly state: KcProgressState;
  readonly lastChangedAt: string | null;
}

/** Recuento por estado. Son cuentas, no porcentajes: ver la cabecera. */
export type KcCounts = Readonly<Record<KcProgressState, number>>;

/**
 * Progreso, en las dos formas que la autoridad de evaluación permite.
 *
 * La rama `sin_autoridad_de_dominio` **no tiene** `kcs` ni `counts`: no es que
 * vengan vacíos, es que para esa materia nadie puede afirmar dominio.
 */
export type ProgresoViewModel =
  | {
      readonly schemaVersion: typeof MATERIAS_VIEW_SCHEMA_VERSION;
      readonly kind: 'con_autoridad_de_dominio';
      readonly courseId: string;
      readonly badge: CourseBadge;
      readonly kcs: readonly KcProgressRow[];
      readonly counts: KcCounts;
      readonly retention: RetentionState;
      readonly scheduledReviews: readonly ScheduledReview[];
      readonly history: readonly SessionHistoryEntry[];
    }
  | {
      readonly schemaVersion: typeof MATERIAS_VIEW_SCHEMA_VERSION;
      readonly kind: 'sin_autoridad_de_dominio';
      readonly courseId: string;
      readonly badge: CourseBadge;
      /** Se dice por qué, con estas palabras, y no se deja el hueco mudo. */
      readonly disclaimer: string;
      readonly scheduledReviews: readonly ScheduledReview[];
      readonly history: readonly SessionHistoryEntry[];
    };

export function progresoView(input: {
  readonly materia: MateriaInput;
  /** Catálogo de KC de la materia. Un KC sin proyección es `pendiente`. */
  readonly kcCatalog: readonly string[];
  readonly projections: readonly KcMasteryProjection[];
  readonly retention: RetentionState;
  readonly scheduledReviews: readonly ScheduledReview[];
  readonly history: readonly SessionHistoryEntry[];
  readonly disclaimer: string;
}): ProgresoViewModel {
  const badge = courseBadge(input.materia.course.courseType);
  const base = {
    schemaVersion: MATERIAS_VIEW_SCHEMA_VERSION,
    courseId: input.materia.course.courseId,
    badge,
    scheduledReviews: Object.freeze([...input.scheduledReviews]),
    history: Object.freeze([...input.history]),
  } as const;

  if (input.materia.course.courseType === 'CUSTOM_COURSE_UNVALIDATED') {
    // Recibir proyecciones de dominio para una materia sin verificador es señal
    // de que alguien las fabricó aguas arriba. Se lanza en vez de ignorarlas:
    // descartarlas en silencio dejaría el error vivo y sin rastro.
    if (input.projections.length > 0) {
      throw new MateriasViewError(
        'DOMINIO_SIN_AUTORIDAD',
        `«${input.materia.course.courseId}» es CUSTOM_COURSE_UNVALIDATED y trae ` +
          `${input.projections.length} proyecciones de dominio. Sin verificador determinista no ` +
          `hay quien declare dominio (T-CC-04), y pintarlas afirmaría un aprendizaje que nadie ` +
          `midió.`,
      );
    }
    return { ...base, kind: 'sin_autoridad_de_dominio', disclaimer: input.disclaimer };
  }

  const catalogo = new Set(input.kcCatalog);
  const porKc = new Map<string, KcMasteryProjection>();
  for (const projection of input.projections) {
    if (!catalogo.has(projection.kcId)) {
      throw new MateriasViewError(
        'ESTADO_DE_KC_FUERA_DEL_CATALOGO',
        `El estado de «${projection.kcId}» no corresponde a ningún KC de esta materia. Pintarlo ` +
          `añadiría a la pantalla una unidad que el mapa de KC no tiene.`,
      );
    }
    porKc.set(projection.kcId, projection);
  }

  const kcs: KcProgressRow[] = input.kcCatalog.map((kcId) => {
    const projection = porKc.get(kcId);
    return projection === undefined
      ? { kcId, state: 'pendiente' as const, lastChangedAt: null }
      : {
          kcId,
          state: POR_ESTADO_AUTORITATIVO[projection.masteryStatus],
          lastChangedAt: projection.lastChangedAt,
        };
  });

  const counts = Object.fromEntries(
    KC_PROGRESS_STATES.map((estado) => [estado, kcs.filter((k) => k.state === estado).length]),
  ) as Record<KcProgressState, number>;

  return {
    ...base,
    kind: 'con_autoridad_de_dominio',
    kcs: Object.freeze(kcs),
    counts: Object.freeze(counts),
    retention: input.retention,
  };
}
