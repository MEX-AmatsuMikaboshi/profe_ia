/**
 * Flujo «Crear materia», observable de principio a fin
 * (T-CC-02 ← UIUX §5.2, P-I §3.1.2, `PLAN-UX-001`).
 *
 * ## Qué significa «observable», y por qué no es una barra de progreso
 *
 * `Plan.md` §283 lo enumera: estado, artefactos, fuentes/propuesta, mensajes
 * comprensibles, errores y reintentos autorizados. Lo que eso descarta es el
 * patrón habitual —una rueda girando y un «preparando tu materia…»— porque
 * cuando la preparación tarda diez minutos, esa pantalla no distingue entre
 * *está investigando*, *lleva cuatro minutos parada* y *falló y nadie lo dijo*.
 * Las tres se ven igual, y el usuario espera indefinidamente en la tercera.
 *
 * Por eso {@link PreparationView} tiene los artefactos ya producidos y el último
 * mensaje: un proceso del que se puede ver **qué lleva hecho** es un proceso del
 * que se sabe si sigue vivo.
 *
 * ## Los mensajes son códigos, no prosa suelta
 *
 * Un `message: string` escrito en cada punto de fallo produce diez maneras de
 * decir «no encontré fuentes», intraducibles y no agrupables. {@link
 * PREPARATION_MESSAGES} es lista cerrada y la prosa vive en un solo sitio.
 *
 * ## Trabajo en segundo plano: exactamente lo que `PLAN-UX-001` promete
 *
 * La decisión de plan dice que los trabajos continúan «mientras el stack Docker
 * Compose local esté en ejecución, aunque la pestaña o el navegador se cierren»,
 * y que **no** se promete ejecución con la computadora apagada.
 * {@link backgroundPromise} devuelve ese texto y nada más ambicioso, porque una
 * promesa de más aquí se paga con el usuario volviendo al día siguiente a una
 * materia que no avanzó.
 */

import {
  assertEnvelopeComplete,
  updateCourse,
  type Course,
  type CourseEnvelope,
  type PreparationState,
} from './courses.js';

/**
 * Artefactos que la preparación va dejando.
 *
 * Son los de UIUX §5.2 y §5.2-adyacentes: lo investigado, lo propuesto. La
 * lista es cerrada para que la vista sepa qué puede encontrarse.
 */
export const PREPARATION_ARTIFACTS = ['sources_found', 'course_proposal'] as const;
export type PreparationArtifactKind = (typeof PREPARATION_ARTIFACTS)[number];

export interface PreparationArtifact {
  readonly kind: PreparationArtifactKind;
  /** Referencia al artefacto real. Este módulo no lo transporta. */
  readonly ref: string;
}

/** Mensajes comprensibles, en lista cerrada. La prosa vive en un solo sitio. */
export const PREPARATION_MESSAGES = [
  'envelope_received',
  'researching_sources',
  'proposal_ready',
  'no_sources_found',
  'provider_unavailable',
  'course_created',
] as const;
export type PreparationMessage = (typeof PREPARATION_MESSAGES)[number];

const PROSA: Readonly<Record<PreparationMessage, string>> = Object.freeze({
  envelope_received: 'Recibido lo que quieres aprender.',
  researching_sources: 'Buscando y comparando fuentes para esta materia.',
  proposal_ready: 'Hay una propuesta de curso lista para que la revises.',
  no_sources_found: 'No encontré fuentes suficientes para esta materia con lo que me diste.',
  provider_unavailable: 'El proveedor no respondió. Se puede reintentar.',
  course_created: 'La materia está creada y puedes empezar la clase.',
});

export function messageText(message: PreparationMessage): string {
  return PROSA[message];
}

/**
 * Los dos fallos que el usuario puede encontrarse, y si se reintenta.
 *
 * `no_sources_found` **no** es reintentable con el mismo sobre: reintentar
 * repetiría la misma búsqueda y produciría el mismo vacío, y el usuario
 * concluiría que el sistema está roto cuando lo que pasa es que hace falta más
 * información suya. Distinguirlo es la diferencia entre un botón útil y uno que
 * miente.
 */
const REINTENTABLE: Readonly<Record<string, boolean>> = Object.freeze({
  no_sources_found: false,
  provider_unavailable: true,
});

export function isRetryable(message: PreparationMessage): boolean {
  return REINTENTABLE[message] ?? false;
}

/** Lo que la vista de preparación necesita para no tener que adivinar nada. */
export interface PreparationView {
  readonly courseId: string;
  readonly state: PreparationState;
  readonly artifacts: readonly PreparationArtifact[];
  readonly lastMessage: PreparationMessage;
  readonly lastMessageText: string;
  readonly retryable: boolean;
  readonly backgroundPromise: string;
}

/**
 * Lo que se le promete al usuario sobre el trabajo en segundo plano.
 *
 * Texto único y deliberadamente modesto: `PLAN-UX-001` autoriza esto y no más.
 */
export function backgroundPromise(): string {
  return (
    'La preparación sigue aunque cierres esta pestaña, mientras el entorno local esté encendido. ' +
    'Si apagas el ordenador, se reanuda cuando vuelvas a levantarlo.'
  );
}

export function preparationView(input: {
  readonly course: Course;
  readonly artifacts: readonly PreparationArtifact[];
  readonly lastMessage: PreparationMessage;
}): PreparationView {
  return {
    courseId: input.course.courseId,
    state: input.course.preparation,
    artifacts: input.artifacts,
    lastMessage: input.lastMessage,
    lastMessageText: messageText(input.lastMessage),
    retryable: input.course.preparation === 'failed' && isRetryable(input.lastMessage),
    backgroundPromise: backgroundPromise(),
  };
}

/**
 * Arranca la preparación desde el sobre mínimo.
 *
 * Es el paso «definir qué aprender → investigación» de UIUX §5.2. El sobre se
 * valida **antes** de mover el estado: empezar a investigar con un sobre vacío
 * gastaría llamadas al proveedor para producir una propuesta sobre nada.
 */
export function beginPreparation(course: Course, envelope: CourseEnvelope): Course {
  assertEnvelopeComplete(envelope);
  const conSobre: Course = { ...course, envelope };
  return updateCourse(updateCourse(conSobre, { preparation: 'envelope_ready' }), {
    preparation: 'researching',
  });
}
