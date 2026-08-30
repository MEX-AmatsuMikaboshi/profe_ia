/**
 * Aislamiento experimental del carril personalizado
 * (T-CC-03 `CRITICAL` ← `DEC-CUSTOM-COURSES-001`, P-I §3.1.2).
 *
 * ## Qué se está protegiendo, exactamente
 *
 * `DEC-CUSTOM-COURSES-001` dice que «únicamente la subunidad de lógica cubierta
 * por la Etapa 1 puede alimentar los veredictos experimentales». El fallo que
 * eso previene no es ruidoso: si los intentos de una materia personalizada
 * —investigada por el sistema, sin corpus autorizado, sin freeze, sin
 * calendario SCED— entran a las métricas primarias, el análisis sigue corriendo
 * y **produce números**. Números de una corrida que nadie diseñó, presentados
 * con la misma cara que los buenos.
 *
 * Por eso esto no es un filtro que se aplica al exportar: es una puerta que se
 * cruza en cada escritura, y **falla cerrado**.
 *
 * ## Sin etiqueta no se pasa
 *
 * {@link assertAdmissible} exige el tipo de curso y lanza si no lo reconoce. La
 * alternativa —«si no viene etiqueta, será del experimento», o su contraria—
 * convierte un registro mal formado en una decisión silenciosa sobre a qué
 * corrida pertenece. Un dato sin procedencia no es un dato experimental ni
 * funcional: es un defecto, y tiene que sonar como tal.
 *
 * ## Las proyecciones son dos, no una con `WHERE`
 *
 * El plan pide «proyecciones separadas». Una sola proyección con un filtro se
 * rompe en silencio el día que alguien escribe una consulta nueva y olvida el
 * `WHERE`; dos proyecciones se rompen en voz alta, porque la tabla que falta no
 * existe.
 */

import type { CourseType } from '@profesor-ia/contracts';

/**
 * Los cuatro destinos que el carril personalizado no puede alimentar.
 *
 * Literal del plan: «los datos/eventos de cursos personalizados **no** entran a
 * reservas, `probe_round`, métricas primarias ni análisis SCED de lógica». La
 * lista es cerrada por la misma razón que las familias de evento: un destino
 * escrito de dos maneras deja una de las dos sin vigilar.
 */
export const EXPERIMENTAL_SINKS = [
  'reservation',
  'probe_round',
  'primary_metric',
  'sced_analysis',
] as const;
export type ExperimentalSink = (typeof EXPERIMENTAL_SINKS)[number];

/** Destinos abiertos a los dos carriles: describen uso, no resultado experimental. */
export const FUNCTIONAL_SINKS = ['progress', 'cost_ledger', 'telemetry'] as const;
export type FunctionalSink = (typeof FUNCTIONAL_SINKS)[number];

export type Sink = ExperimentalSink | FunctionalSink;

/** Las dos proyecciones. Separadas, no una con filtro. */
export const PROJECTIONS = ['experimental', 'functional'] as const;
export type Projection = (typeof PROJECTIONS)[number];

export type IsolationErrorCode =
  | 'CARRIL_NO_DECLARADO'
  | 'DESTINO_DESCONOCIDO'
  | 'CARRIL_PERSONALIZADO_EN_DESTINO_EXPERIMENTAL';

export class CourseIsolationError extends Error {
  readonly code: IsolationErrorCode;

  constructor(code: IsolationErrorCode, detail: string) {
    super(detail);
    this.name = 'CourseIsolationError';
    this.code = code;
  }
}

const TIPOS_VALIDOS: readonly string[] = ['VALIDATED_LOGIC_COURSE', 'CUSTOM_COURSE_UNVALIDATED'];

function assertCarrilDeclarado(courseType: string): asserts courseType is CourseType {
  if (!TIPOS_VALIDOS.includes(courseType)) {
    throw new CourseIsolationError(
      'CARRIL_NO_DECLARADO',
      `«${courseType}» no es un carril de P-I §3.1.2. Un registro sin procedencia no es ` +
        `experimental ni funcional: es un defecto, y suponerle carril decidiría en silencio a qué ` +
        `corrida pertenece.`,
    );
  }
}

export function isExperimentalSink(sink: string): sink is ExperimentalSink {
  return (EXPERIMENTAL_SINKS as readonly string[]).includes(sink);
}

/** A qué proyección va un carril. Total: los dos tienen destino. */
export function projectionFor(courseType: string): Projection {
  assertCarrilDeclarado(courseType);
  return courseType === 'VALIDATED_LOGIC_COURSE' ? 'experimental' : 'functional';
}

/**
 * Puerta de escritura. **Lanza** si una materia personalizada intenta alimentar
 * un destino experimental.
 *
 * El mensaje nombra el destino y la decisión: quien lo lea en un log a los seis
 * meses tiene que poder entender que no es una restricción de permisos sino la
 * frontera entre dos corridas.
 */
export function assertAdmissible(input: {
  readonly courseType: string;
  readonly sink: string;
}): void {
  assertCarrilDeclarado(input.courseType);
  if (
    !isExperimentalSink(input.sink) &&
    !(FUNCTIONAL_SINKS as readonly string[]).includes(input.sink)
  ) {
    throw new CourseIsolationError(
      'DESTINO_DESCONOCIDO',
      `«${input.sink}» no es un destino declarado. Los experimentales son ` +
        `${EXPERIMENTAL_SINKS.join(', ')}; los funcionales, ${FUNCTIONAL_SINKS.join(', ')}. Un ` +
        `destino nuevo se declara aquí, y así nace vigilado en vez de nacer abierto.`,
    );
  }
  if (input.courseType === 'CUSTOM_COURSE_UNVALIDATED' && isExperimentalSink(input.sink)) {
    throw new CourseIsolationError(
      'CARRIL_PERSONALIZADO_EN_DESTINO_EXPERIMENTAL',
      `Una materia \`CUSTOM_COURSE_UNVALIDATED\` no alimenta «${input.sink}» ` +
        `(\`DEC-CUSTOM-COURSES-001\`: sólo la subunidad de lógica de la Etapa 1 alimenta los ` +
        `veredictos experimentales). Dejarla pasar no daría error: el análisis seguiría corriendo ` +
        `y produciría números de una corrida que nadie diseñó, con la misma cara que los buenos.`,
    );
  }
}

/** Registro mínimo que este módulo sabe encaminar. */
export interface TrackedRecord {
  readonly courseType: string;
}

export interface Partition<T> {
  readonly experimental: readonly T[];
  readonly functional: readonly T[];
}

/**
 * Reparte registros por carril. **Lanza** ante uno sin etiquetar.
 *
 * Lanzar en vez de descartar es deliberado: un registro descartado en silencio
 * desaparece de las dos proyecciones, y una corrida a la que le faltan datos no
 * se distingue de una en la que esos datos nunca existieron.
 */
export function partitionByTrack<T extends TrackedRecord>(records: readonly T[]): Partition<T> {
  const experimental: T[] = [];
  const functional: T[] = [];
  for (const r of records) {
    if (projectionFor(r.courseType) === 'experimental') experimental.push(r);
    else functional.push(r);
  }
  return { experimental, functional };
}

/**
 * Lo que el análisis SCED puede leer.
 *
 * Existe para que la consulta no se escriba a mano en cada sitio: el defecto
 * que esto evita es un `WHERE` olvidado, y un `WHERE` olvidado no falla — pasa
 * de más.
 */
export function forSced<T extends TrackedRecord>(records: readonly T[]): readonly T[] {
  return partitionByTrack(records).experimental;
}
