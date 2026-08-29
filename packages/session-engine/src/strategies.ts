import type { ModelOperation, PedagogicalStrategy } from '@profesor-ia/contracts';

/**
 * Ejecución lingüística de las estrategias pedagógicas (T-H7-04 ← P-I §5.10,
 * P-II §7.2.1).
 *
 * ## El hueco que esto cierra
 *
 * `T-H7-01` dejó el bucle encadenado, pero el turno mandaba **siempre** las
 * mismas instrucciones y la operación `explain_block`, dijera lo que dijera la
 * política. O sea: `DeterministicPedagogyPolicy` decidía entre diez estrategias
 * y el prompt ignoraba las diez. La decisión existía y no llegaba a ninguna
 * parte.
 *
 * ## Lo que NO cambia, y es lo que importa
 *
 * **El modelo sigue sin decidir la estrategia** (I-1, P-II §7.2). La elige la
 * política determinista sobre estado estructurado; esto sólo traduce esa
 * elección a la instrucción que la ejecuta. Un mapa de estrategia a texto no es
 * una decisión pedagógica: es la ejecución de una ya tomada.
 *
 * Y **el contrato de formato no se toca**: la directiva de estrategia se añade
 * a `TEACHING_TURN_INSTRUCTIONS`, que sigue fijando el esquema, el anclaje y la
 * negativa dentro del JSON. Reescribir el formato por estrategia daría diez
 * contratos distintos y diez maneras de romperlo.
 *
 * ## Por qué la operación también cambia
 *
 * La operación es la unidad que la pasarela **autoriza** (T-H4-01): un binding
 * declara qué operaciones puede atender y la pasarela rechaza el resto. Mandar
 * `explain_block` para redactar un ejemplo trabajado pasaría por la puerta
 * equivocada y haría inútil esa autorización.
 *
 * Las estrategias sin operación propia en el contrato usan `explain_block`. No
 * es un cajón de sastre: el enum de operaciones es **cerrado** (P-II §8.2) y
 * añadir `draft_guided_practice` porque encaja mejor sería inventar superficie.
 */

/** Lo que hace falta para ejecutar una estrategia con el proveedor. */
export interface StrategyExecution {
  readonly strategy: PedagogicalStrategy;
  readonly operation: ModelOperation;
  /**
   * Directiva que se añade al prompt base. Describe **el acto pedagógico**, no
   * el formato: el formato lo fija `TEACHING_TURN_INSTRUCTIONS` para todas.
   */
  readonly directive: string;
}

/**
 * Las diez estrategias del enum de P-II §7.2.1, cada una con su ejecución.
 *
 * Está completo a propósito y hay una prueba que lo comprueba contra el enum:
 * una estrategia sin entrada haría que la política eligiera algo que el turno
 * no sabe ejecutar, y ese fallo aparecería en producción y no aquí.
 */
const EJECUCIONES: Readonly<Record<PedagogicalStrategy, StrategyExecution>> = Object.freeze({
  direct_explanation: {
    strategy: 'direct_explanation',
    operation: 'explain_block',
    directive:
      'ACTO: explicación directa breve. Explica el punto que el objetivo pide, apoyándote en los ' +
      'fragmentos. Breve quiere decir breve: lo mínimo que deja al alumno en condiciones de ' +
      'intentarlo. No propongas ejercicio ni pidas que te explique nada todavía.',
  },

  worked_example: {
    strategy: 'worked_example',
    operation: 'draft_worked_example',
    directive:
      'ACTO: ejemplo trabajado. Muestra un caso **distinto** del que el alumno tiene abierto, ' +
      'paso a paso, citando en cada paso la regla del cálculo que lo autoriza. Nunca uses las ' +
      'fórmulas del ejercicio en curso ni una variante que se resuelva con la misma secuencia: ' +
      'eso sería entregar su solución con otra ropa.',
  },

  completion_problem: {
    strategy: 'completion_problem',
    operation: 'draft_completion_prompt',
    directive:
      'ACTO: ejemplo incompleto. Presenta una derivación con uno o dos pasos en blanco y pide ' +
      'que el alumno los complete. Los pasos que dejes escritos deben ser correctos y citar su ' +
      'regla. El hueco va donde está la dificultad que se quiere practicar, no al final por ' +
      'comodidad.',
  },

  guided_practice: {
    strategy: 'guided_practice',
    operation: 'explain_block',
    directive:
      'ACTO: práctica guiada. Acompaña al alumno en el intento que ya tiene abierto: señala qué ' +
      'mirar a continuación y qué regla es candidata, **sin dar el paso**. La diferencia entre ' +
      'guiar y resolver es que después de guiar el alumno todavía tiene algo que decidir.',
  },

  independent_practice: {
    strategy: 'independent_practice',
    operation: 'explain_block',
    directive:
      'ACTO: práctica independiente. Invita a intentarlo sin ayuda y quédate disponible. No ' +
      'adelantes el primer paso ni sugieras por dónde empezar: eso convertiría esto en práctica ' +
      'guiada, que es otra estrategia y la política no la eligió.',
  },

  scaffolding: {
    strategy: 'scaffolding',
    operation: 'explain_block',
    directive:
      'ACTO: andamiaje contingente. Da apoyo del nivel exacto que el contexto autoriza y ni un ' +
      'grado más. Si el nivel de ayuda permitido es bajo, el apoyo es una pregunta orientadora, ' +
      'no una indicación.',
  },

  self_explanation: {
    strategy: 'self_explanation',
    operation: 'draft_self_explanation_prompt',
    directive:
      'ACTO: autoexplicación guiada. Pide al alumno que explique con sus palabras por qué el ' +
      'paso que hizo (o el que va a hacer) está justificado. Formula UNA pregunta y para. No ' +
      'respondas tú a continuación: la explicación tiene que ser suya o no sirve.',
  },

  retrieval: {
    strategy: 'retrieval',
    operation: 'explain_block',
    directive:
      'ACTO: práctica de recuperación. Formula una pregunta breve sobre algo ya enseñado, para ' +
      'que el alumno lo traiga de memoria. **No incluyas la respuesta**, ni siquiera insinuada: ' +
      'el valor de recuperar está en el esfuerzo de recuperar.',
  },

  prerequisite_remediation: {
    strategy: 'prerequisite_remediation',
    operation: 'explain_block',
    directive:
      'ACTO: recuperación de prerrequisito. Lo que bloquea no es el objetivo actual sino algo ' +
      'anterior. Explica ese punto previo y sólo ese; volver al objetivo es decisión del motor, ' +
      'no tuya, así que no anuncies que se vuelve ni cuándo.',
  },

  near_transfer: {
    strategy: 'near_transfer',
    operation: 'explain_block',
    directive:
      'ACTO: comprobación de transferencia cercana. Plantea una situación con la misma ' +
      'estructura y superficie distinta, y pide que la resuelva. No la resuelvas tú ni señales ' +
      'el parecido: reconocer la estructura bajo otra ropa es justo lo que se está comprobando.',
  },
});

/** Error de ejecución de estrategia. La lista de códigos es cerrada. */
export class StrategyExecutionError extends Error {
  readonly code: 'UNKNOWN_STRATEGY';

  constructor(strategy: string) {
    super(
      `no hay ejecución lingüística declarada para la estrategia «${strategy}». La política ` +
        `eligió algo que el turno no sabe ejecutar; inventar una instrucción aquí sería decidir ` +
        `pedagogía en el sitio que sólo debe ejecutarla (I-1).`,
    );
    this.name = 'StrategyExecutionError';
    this.code = 'UNKNOWN_STRATEGY';
  }
}

/**
 * Ejecución de una estrategia. **Lanza si no la conoce**, en vez de caer a
 * `direct_explanation`: una caída silenciosa daría al alumno una explicación
 * donde la política pidió recuperación, y el registro diría que se ejecutó la
 * estrategia elegida.
 */
export function strategyExecution(strategy: PedagogicalStrategy): StrategyExecution {
  const ejecucion = EJECUCIONES[strategy];
  if (ejecucion === undefined) throw new StrategyExecutionError(strategy);
  return ejecucion;
}

/** Las operaciones que un binding de sesión tiene que autorizar para el bucle. */
export function sessionOperations(): readonly ModelOperation[] {
  const vistas = new Set<ModelOperation>();
  for (const ejecucion of Object.values(EJECUCIONES)) vistas.add(ejecucion.operation);
  // La reformulación tampoco sale de `EJECUCIONES`: la produce
  // `rephrasedExecution()` cuando la política repite estrategia sobre el mismo
  // KC (T-H7-05). **Faltaba aquí**, y el efecto era silencioso de la peor
  // manera: la pasarela rechazaba la operación no autorizada, el puerto lanzaba
  // y el turno caía a **modo degradado** — o sea que una segunda pasada
  // perfectamente sana se registraba como caída de proveedor. Lo destapó
  // `ci:e2e:live-session` corriendo de verdad; ninguna prueba con puerto
  // inyectado podía verlo, porque el puerto falso no comprueba autorizaciones.
  vistas.add('rephrase_explanation');
  // Las dos de clasificación no salen de una estrategia: las usa el motor para
  // encuadrar la duda y el error del alumno dentro de sus enums (T-H7-04).
  vistas.add('classify_student_error');
  vistas.add('classify_question_scope');
  return [...vistas];
}

/** Estrategias declaradas, para que las pruebas las contrasten con el enum. */
export function declaredStrategies(): readonly PedagogicalStrategy[] {
  return Object.keys(EJECUCIONES) as PedagogicalStrategy[];
}

/**
 * Ejecución **reformulada** de la misma estrategia (T-H7-05 ← P-I §5.10).
 *
 * ## Qué problema resuelve
 *
 * La política es determinista: ante el mismo estado observable elige la misma
 * estrategia. Eso es correcto y es lo que la hace auditable — pero si el alumno
 * no entendió una explicación, volver a ejecutarla produciría **el mismo acto
 * otra vez**, y repetir lo que ya falló no es enseñar.
 *
 * ## Por qué esto NO es el modelo adaptándose por su cuenta
 *
 * La estrategia **no cambia**: sigue siendo la que la política eligió, con su
 * mismo nivel de ayuda. Lo que cambia es la **representación**: otra vía de
 * entrada al mismo contenido. P-I §5.10 lo nombra como cambio de representación
 * al fallar la explicación, y es adaptación *dentro de límites* precisamente
 * porque no toca ni la estrategia, ni el nivel de ayuda, ni la elegibilidad.
 *
 * Si hiciera falta cambiar de estrategia, eso es de la política y llega por sus
 * señales —`repeated_same_error`, `partial_difficulty`— no por aquí.
 *
 * ## La operación sí cambia
 *
 * A `rephrase_explanation`, que existe en el enum del contrato desde F4 y **no
 * la usaba nadie**. Que la reformulación entre por su propia puerta permite al
 * binding autorizarla o negarla por separado, y deja en la evidencia que este
 * turno fue una segunda pasada y no la primera.
 */
export function rephrasedExecution(strategy: PedagogicalStrategy): StrategyExecution {
  const base = strategyExecution(strategy);
  return Object.freeze({
    strategy,
    operation: 'rephrase_explanation' as ModelOperation,
    directive:
      `${base.directive}\n\n` +
      'SEGUNDA PASADA: esto ya se intentó y no funcionó. Cambia la **representación**, no el ' +
      'fondo: si antes fue prosa, usa un caso concreto; si fue un caso, nombra la estructura; si ' +
      'fue general, baja al detalle. Prohibido repetir las mismas frases con otro orden. Y no ' +
      'subas el nivel de ayuda ni des el paso que el alumno tiene que dar: lo que se cambia es ' +
      'cómo se dice, no cuánto se entrega.',
  });
}
