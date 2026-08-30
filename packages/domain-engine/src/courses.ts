/**
 * Modelo de cursos y continuidad entre sesiones
 * (T-CC-01 ← P-I §3.1.2, `DEC-CUSTOM-COURSES-001`, `OWNER-CONTINUITY-001`).
 *
 * ## Los dos carriles no son dos niveles de calidad
 *
 * P-I §3.1.2 es explícito: la UI «debe mostrar esta diferencia de forma
 * comprensible **sin presentar el modo personalizado como defectuoso**: es
 * funcionalmente útil, pero metodológicamente no validado por este
 * experimento». Así que aquí no hay `isValidated: boolean` ni nada que ordene
 * los carriles de peor a mejor. Hay un tipo con dos miembros, y lo que cambia
 * entre ellos es **a qué tiene derecho cada uno**, no cuánto vale.
 *
 * ## El tipo de curso es inmutable, y es la puerta que hay que cerrar
 *
 * La forma en que este carril se rompería no es que alguien enseñe mal una
 * materia personalizada: es que un curso creado como `CUSTOM_COURSE_UNVALIDATED`
 * —investigado por el sistema, sin corpus autorizado, sin freeze— cambie de tipo
 * y sus intentos entren al análisis de la Etapa 1. Ahí no habría error visible:
 * habría un experimento con datos que nadie autorizó, indistinguibles de los
 * buenos. Por eso {@link retypeCourse} no existe y {@link updateCourse} **lanza**
 * si el tipo cambia.
 *
 * El sentido contrario tampoco se admite, y por una razón distinta: degradar el
 * curso de lógica a personalizado sacaría sus datos del análisis sin dejar
 * hueco, y una corrida a la que le faltan sesiones no se distingue de una en la
 * que esas sesiones nunca ocurrieron.
 *
 * ## La continuidad es requisito funcional, no comodidad
 *
 * `OWNER-CONTINUITY-001` la declara requisito, y UIUX §6.1 pide que Inicio
 * responda «dónde se quedó el usuario». Un punto de retorno que apunte a otra
 * materia manda al alumno a una clase que no es la suya, así que
 * {@link recordProgress} comprueba la correspondencia en vez de confiar en quien
 * llama.
 */

import { CourseType } from '@profesor-ia/contracts';

export type CourseErrorCode =
  | 'TIPO_INMUTABLE'
  | 'TRANSICION_INVALIDA'
  | 'SOBRE_INCOMPLETO'
  | 'PROGRESO_DE_OTRA_MATERIA'
  | 'CURSO_NO_ENSENABLE';

export class CourseError extends Error {
  readonly code: CourseErrorCode;

  constructor(code: CourseErrorCode, detail: string) {
    super(detail);
    this.name = 'CourseError';
    this.code = code;
  }
}

/** Los dos carriles de P-I §3.1.2. El enum vive en `contracts`; aquí se reusa. */
export const COURSE_TYPES = CourseType.options;

/**
 * Estados de preparación de una materia.
 *
 * Siguen el recorrido de UIUX §5.2 —definir qué aprender → investigación y
 * preparación → propuesta → crear materia—. `Plan.md` §283 declara que «nombres
 * y número de etapas del mockup **no** son normativos», así que lo que se
 * respeta es lo que sí lo es: que el proceso sea **observable**, con estado,
 * artefactos, mensajes y errores/reintentos.
 *
 * `failed` es un estado y no una excepción porque la norma pide reintentos
 * autorizados: un fallo que sólo existe como excepción no se puede mostrar en
 * pantalla ni reintentar.
 */
export const PREPARATION_STATES = [
  'draft',
  'envelope_ready',
  'researching',
  'proposal_ready',
  'created',
  'failed',
] as const;
export type PreparationState = (typeof PREPARATION_STATES)[number];

const TRANSICIONES: Readonly<Record<PreparationState, readonly PreparationState[]>> = Object.freeze({
  draft: ['envelope_ready'],
  envelope_ready: ['researching'],
  researching: ['proposal_ready', 'failed'],
  // Rechazar la propuesta devuelve a investigar, no a cero: el sobre sigue
  // valiendo y volver a pedirlo sería castigar al usuario por no aceptar.
  proposal_ready: ['created', 'researching'],
  created: [],
  failed: ['researching'],
});

/**
 * Sobre mínimo de P-I §3.1.2.
 *
 * `subject` es lo único obligatorio, y los otros cinco campos son opcionales
 * porque la norma los enumera como parte del sobre sin exigirlos todos —«tema/
 * subunidad **opcional**»—. Rellenar un nivel o un objetivo que el usuario no
 * dio sería inventar el perfil de quien va a estudiar.
 */
export interface CourseEnvelope {
  readonly subject: string;
  readonly topic?: string;
  readonly level?: string;
  readonly personalGoal?: string;
  readonly availableTime?: string;
  readonly constraints?: readonly string[];
}

export interface Course {
  readonly courseId: string;
  readonly courseType: CourseType;
  readonly title: string;
  readonly preparation: PreparationState;
  /** Sólo las personalizadas nacen de un sobre; el curso de lógica ya existía. */
  readonly envelope?: CourseEnvelope;
}

/** Un sobre sin materia no describe nada que investigar. */
export function assertEnvelopeComplete(envelope: CourseEnvelope): void {
  if (envelope.subject.trim() === '') {
    throw new CourseError(
      'SOBRE_INCOMPLETO',
      'El sobre mínimo necesita al menos la materia (P-I §3.1.2). Sin ella no hay nada que ' +
        'investigar, y empezar igualmente produciría una propuesta sobre un tema que el usuario ' +
        'no pidió.',
    );
  }
}

export function createCourse(input: {
  readonly courseId: string;
  readonly courseType: CourseType;
  readonly title: string;
  readonly envelope?: CourseEnvelope;
}): Course {
  if (input.envelope !== undefined) assertEnvelopeComplete(input.envelope);
  const base = {
    courseId: input.courseId,
    courseType: input.courseType,
    title: input.title,
    // El curso de lógica no se prepara: su paquete se congela en H5 y llega
    // creado. Una personalizada empieza en `draft`.
    preparation: (input.courseType === 'VALIDATED_LOGIC_COURSE'
      ? 'created'
      : 'draft') as PreparationState,
  };
  return input.envelope === undefined ? base : { ...base, envelope: input.envelope };
}

/**
 * Avanza la preparación. **Lanza** ante un cambio de tipo.
 *
 * El cambio de tipo es la única forma en que este carril contamina el
 * experimento, y no dejaría rastro: un curso personalizado retipado a validado
 * mete en el análisis de Etapa 1 datos sin corpus autorizado ni freeze,
 * indistinguibles de los buenos.
 */
export function updateCourse(
  course: Course,
  cambio: { readonly courseType?: CourseType; readonly preparation?: PreparationState },
): Course {
  if (cambio.courseType !== undefined && cambio.courseType !== course.courseType) {
    throw new CourseError(
      'TIPO_INMUTABLE',
      `«${course.courseId}» es ${course.courseType} y no puede pasar a ${cambio.courseType}. ` +
        `Promover una materia personalizada metería en el análisis de Etapa 1 datos sin corpus ` +
        `autorizado ni freeze, indistinguibles de los buenos; degradar el curso de lógica sacaría ` +
        `sesiones del análisis sin dejar hueco, y una corrida incompleta no se distingue de una ` +
        `en la que esas sesiones nunca ocurrieron.`,
    );
  }
  if (cambio.preparation === undefined || cambio.preparation === course.preparation) return course;
  const permitidos = TRANSICIONES[course.preparation];
  if (!permitidos.includes(cambio.preparation)) {
    throw new CourseError(
      'TRANSICION_INVALIDA',
      `«${course.courseId}» no puede pasar de «${course.preparation}» a «${cambio.preparation}». ` +
        `Desde «${course.preparation}» ` +
        `${permitidos.length === 0 ? 'no hay salida: es terminal' : `sólo ${permitidos.join(', ')}`}.`,
    );
  }
  return { ...course, preparation: cambio.preparation };
}

/** ¿Se puede dar clase ya? Sólo un curso `created`. */
export function isTeachable(course: Course): boolean {
  return course.preparation === 'created';
}

/**
 * Puerta hacia la clase. **Lanza** si la materia no está lista.
 *
 * Sin esto, entrar a una materia a medio preparar mostraría una clase con
 * huecos, y el alumno leería como defecto del Profesor IA lo que es una
 * preparación sin terminar.
 */
export function assertTeachable(course: Course): void {
  if (!isTeachable(course)) {
    throw new CourseError(
      'CURSO_NO_ENSENABLE',
      `«${course.courseId}» está en «${course.preparation}». Entrar ahora mostraría una clase con ` +
        `huecos que el alumno leería como defecto del Profesor IA.`,
    );
  }
}

// ───────────────────────── continuidad (OWNER-CONTINUITY-001) ─────────────────────────

/**
 * Dónde se quedó el usuario en una materia.
 *
 * Es lo que UIUX §6.1 pide representar en Inicio: materia activa, punto de
 * retorno y `Continuar clase`.
 */
export interface CourseProgress {
  readonly courseId: string;
  /** Última sesión de esta materia. `null` si nunca se abrió. */
  readonly lastSessionId: string | null;
  /**
   * A dónde vuelve `Continuar clase`. `null` dice «no hay dónde volver» y es
   * distinto de ausente, que diría «no se registró»: confundirlos manda al
   * usuario al principio de una materia que sí tenía avance.
   */
  readonly resumePoint: string | null;
  readonly updatedAtMs: number;
}

export function initialProgress(courseId: string, atMs: number): CourseProgress {
  return { courseId, lastSessionId: null, resumePoint: null, updatedAtMs: atMs };
}

/**
 * Registra avance. **Lanza** si el progreso es de otra materia.
 *
 * Cruzar dos materias aquí manda al alumno a una clase que no es la suya, y en
 * pantalla se vería como un fallo de navegación en vez de como lo que sería: el
 * punto de retorno de otra asignatura.
 */
export function recordProgress(
  previo: CourseProgress,
  avance: {
    readonly courseId: string;
    readonly sessionId: string;
    readonly resumePoint: string;
    readonly atMs: number;
  },
): CourseProgress {
  if (avance.courseId !== previo.courseId) {
    throw new CourseError(
      'PROGRESO_DE_OTRA_MATERIA',
      `El progreso es de «${previo.courseId}» y el avance de «${avance.courseId}». Mezclarlos ` +
        `mandaría al alumno al punto de retorno de otra asignatura.`,
    );
  }
  return {
    courseId: previo.courseId,
    lastSessionId: avance.sessionId,
    resumePoint: avance.resumePoint,
    updatedAtMs: avance.atMs,
  };
}
