import {
  checkNonRevelation,
  type DeterministicPedagogyPolicy,
  type CandidateHint,
  type EgressFilterReceipt,
  type NonRevelationFinding,
  type PedagogyDecisionContext,
  type PedagogyPolicyOutcome,
} from '@profesor-ia/pedagogy-policy';

import {
  rephrasedExecution,
  strategyExecution,
  type StrategyExecution,
} from './strategies.js';
import {
  buildSessionContext,
  validateAnchoredOutput,
  type AnchorRejection,
  type AuthorizedCalculus,
  type AuthorizedFragment,
  type CanaryDetector,
  type SegmentStanding,
  type SelectedHint,
  type SessionContext,
  type StructuredError,
} from '@profesor-ia/model-gateway';

/**
 * Orquestador del turno de enseñanza — el bucle W7 (T-H7-01).
 *
 * `Plan.md` §255 fija los nueve pasos, literalmente: «motor fija LEARNING_MODE →
 * pedagogy-policy selecciona → fragmentos autorizados → modelo ejecuta
 * lingüísticamente → validador/anclaje/no-revelación → verificador clasifica →
 * ajuste por política → evidencia», y `T-H7-01` los enumera como
 * motor→política→fragmentos→modelo→validador→alumno→verificador→ajuste→evidencia.
 *
 * Hasta esta tarea **todas las piezas existían y ninguna llamaba a otra**: el
 * validador de anclaje (`T-H7-02`) y la puerta de no revelación (`T-H7-03`)
 * estaban las dos `VERIFICADA` y no había un solo archivo que importara ambas.
 * Esto es ese archivo.
 *
 * ## Alcance de esta tarea, declarado
 *
 * Cubre los pasos **1 a 6 y el 9**: el turno en que el Profesor IA produce
 * lenguaje para el alumno. Los pasos **7 (verificador clasifica)** y **8
 * (ajuste por política)** **no se implementan aquí**, y no por olvido: el
 * veredicto ya tiene su propia ruta —`apps/api` → spool → `apps/verifier`, con
 * el verificador corriendo sin red (I-3)— y duplicar aquí esa llamada acercaría
 * `verify()` al paquete que habla con proveedores por la puerta de atrás.
 *
 * El bucle se cierra por **dato, no por llamada**: el veredicto del turno
 * anterior entra como `structuredError` del siguiente. Es la costura que hace
 * que el profesor reaccione al error real del alumno, y es de ida y vuelta sin
 * que este módulo toque la ruta de verificación.
 *
 * ## El orden de las dos puertas, que no es el que sugiere la lectura rápida
 *
 * El paso 5 del plan nombra «validador/anclaje/no-revelación» junto, y eso
 * invita a ponerlas las dos después del modelo. Sería un error, y las dos
 * autoridades lo dicen por separado:
 *
 * - **No revelación va ANTES de llamar al proveedor.** P-I §9.6 gobierna lo que
 *   entra en contexto —«sin solución en contexto», «sin pistas que completen el
 *   paso decisivo»—, y `checkNonRevelation()` recibe justamente el recibo del
 *   filtro de egreso y la pista candidata. Comprobarlo después del modelo sería
 *   comprobarlo cuando la solución ya viajó.
 * - **El anclaje va DESPUÉS.** P-II §8.4 valida *la salida*, que antes de la
 *   llamada no existe.
 *
 * Hoy nada más fija ese orden, así que lo fija esto y lo fijan sus pruebas.
 *
 * ## Nada de degradación silenciosa
 *
 * Cada paso que no se puede completar devuelve un resultado que **dice en qué
 * paso paró y con qué autoridad**. No hay rama que devuelva un texto vacío ni
 * un «sin novedad» cuando una puerta bloqueó: un turno bloqueado y un turno
 * entregado son observables distintos, y confundirlos es exactamente cómo se
 * pierde una garantía sin que nadie lo note.
 */

/** Los nueve pasos de W7, con el nombre que les da `Plan.md`. */
export const W7_STEPS = [
  'motor',
  'politica',
  'fragmentos',
  'modelo',
  'validador',
  'alumno',
  'verificador',
  'ajuste',
  'evidencia',
] as const;
export type W7Step = (typeof W7_STEPS)[number];

/**
 * Los pasos que **este** orquestador ejecuta. `verificador` y `ajuste` viven en
 * la ruta de veredicto y entran al turno siguiente como `structuredError`.
 */
export const TEACHING_TURN_STEPS = [
  'motor',
  'politica',
  'fragmentos',
  'modelo',
  'validador',
  'alumno',
  'evidencia',
] as const satisfies readonly W7Step[];

/**
 * Recuperador de fragmentos autorizados del bloque (paso 3).
 *
 * Entra por parámetro y no se resuelve aquí: `session-engine` no sabe dónde
 * vive el corpus, y cablearlo ataría el motor a una disposición de archivos.
 * Devuelve **sólo** fragmentos del bloque pedido; `buildSessionContext()` lo
 * comprueba de nuevo y lanza si alguno se cuela, que es el control positivo de
 * que esta promesa no se cree por confianza.
 */
export type FragmentRetriever = (blockId: string) => readonly AuthorizedFragment[];

/** Lo que el puerto del modelo recibe. El contexto ya está filtrado (paso 4). */
export interface TurnModelRequest {
  readonly operation: string;
  readonly instructions: string;
  readonly context: SessionContext;
}

/**
 * Puerto del modelo. Inyectado a propósito, igual que hace la sesión seca:
 * mantiene las pruebas sin red y deterministas, y deja que el llamador decida
 * si detrás hay una pasarela real o un guion. `session-engine` **no** construye
 * la pasarela ni resuelve credenciales.
 *
 * Devuelve la salida ya validada de esquema por la pasarela (T-H4-03), todavía
 * sin validar de anclaje: eso es el paso 5 y es de aquí.
 */
export type TurnModelPort = (request: TurnModelRequest) => Promise<unknown>;

/**
 * Fuente de contenido **congelado** para el modo degradado (T-H7-06 ← P-II §8.6).
 *
 * Es un puerto y no `DegradedProfile` directamente para que el turno se pruebe
 * sin montar el paquete entero, y porque lo único que necesita del perfil es
 * esto: el texto autorizado del bloque y de qué freeze sale.
 *
 * **Lanza si no lo tiene.** No devuelve `null` ni una cadena vacía: un texto de
 * relleno haría pasar por «el núcleo respondió» algo que no estaba, y el perfil
 * degradado existe justamente para aislar si el fallo viene del modelo o del
 * núcleo.
 */
export type DegradedSource = (blockId: string) => {
  readonly text: string;
  readonly freezeVersion: string;
};

export interface SessionTurnDependencies {
  readonly policy: DeterministicPedagogyPolicy;
  readonly retrieveFragments: FragmentRetriever;
  readonly model: TurnModelPort;
  readonly calculus: AuthorizedCalculus;
  /**
   * Detector de canarios. Opcional en el tipo porque `buildSessionContext()` lo
   * exige sólo donde P-I §9.6 lo exige —actividad puntuable abierta— y allí
   * falla cerrado él mismo. No se le da valor por omisión aquí: un detector
   * vacío por omisión apagaría la comprobación sin decirlo.
   */
  readonly canaryDetector?: CanaryDetector;
  /**
   * Reintentos ante **rechazo de anclaje**. Cero por omisión.
   *
   * `httpTransport` no reintenta a propósito y lo documenta: «reintentar es una
   * decisión de la corrida, que además debe contarla», porque BENCH-01 mide
   * «utilizables **tras un reintento**» y ese reintento tiene que ser visible.
   * Aquí pasa lo mismo, así que el número de intentos viaja en el resultado y
   * no se esconde.
   *
   * **Sólo se reintenta el rechazo de anclaje.** Una supresión de política y un
   * bloqueo de §9.6 son deterministas sobre la misma entrada: repetirlos daría
   * el mismo resultado y sólo serviría para gastar dos veces. El anclaje no:
   * BENCH-01 midió 84.2 % de anclas resolubles en `claude-sonnet-5`, o sea que
   * una segunda pasada sobre el mismo contexto sí puede salir bien.
   *
   * **Un reintento no es un rescate.** Si se agotan, el turno se rechaza igual y
   * lo dice: rebajar el listón tras N intentos convertiría la garantía en una
   * sugerencia.
   */
  readonly anchoringRetries?: number;
  /**
   * Contenido congelado para cuando el proveedor cae (T-H7-06).
   *
   * **Opcional a propósito, y su ausencia no se disfraza:** sin fuente
   * degradada una caída del proveedor **propaga el error**. Inventar aquí un
   * texto por omisión sería exactamente la degradación silenciosa que P-II §8.6
   * prohíbe, y dejaría la clase continuando sobre nada.
   */
  readonly degraded?: DegradedSource;
}

export interface SessionTurnInput {
  /**
   * Contexto de decisión ya derivado del estado de sesión (paso 1, «el motor
   * fija»). Lo construye el llamador porque la derivación depende de la
   * proyección de sesión, que es de `state-machine.ts`.
   */
  readonly decisionContext: PedagogyDecisionContext;
  readonly blockId: string;
  readonly goal: string;
  readonly minimalState: Readonly<Record<string, string | number | boolean>>;
  readonly minimalStateKeys: readonly string[];
  /**
   * El error del alumno ya clasificado — normalmente por el veredicto del turno
   * anterior (paso 7). `null` en el turno de apertura. **Nunca texto libre del
   * modelo**: si lo fuera, el profesor estaría reaccionando a su propia prosa.
   */
  readonly structuredError: StructuredError | null;
  readonly selectedHint: SelectedHint | null;
  /** La pista candidata con los hechos que validó el banco de autoría. */
  readonly candidateHint: CandidateHint | null;
  readonly scorableActivity: {
    readonly activityId: string;
    readonly isProbe: boolean;
    readonly attemptClosed: boolean;
  } | null;
  /**
   * Instrucciones **base**: formato, anclaje y negativa dentro del esquema. El
   * acto pedagógico NO viene de aquí: sale de la estrategia que la política
   * eligió (T-H7-04), y se le añade a esto. Si el llamador pudiera fijar el
   * acto, estaría decidiendo pedagogía desde fuera de la política.
   */
  readonly instructions: string;
  /** ¿Este turno pretende entregar retroalimentación al alumno? (P-I §9.6). */
  readonly deliversFeedback: boolean;
  /**
   * El turno anterior, para el cambio de representación de T-H7-05.
   *
   * Si la política vuelve a elegir la **misma** estrategia sobre el **mismo**
   * KC, repetirla al pie de la letra sería repetir lo que ya falló. Se
   * reformula: cambia la representación, no la estrategia ni el nivel de ayuda.
   *
   * `null` en el turno de apertura. Lo aporta el llamador porque vive en la
   * proyección de sesión, igual que `decisionContext`.
   */
  readonly previousTurn: {
    readonly strategy: string;
    readonly kcId: string;
  } | null;
}

/** Lo que se registra del turno, pase lo que pase. Es el paso 9. */
export interface TurnAuditTrail {
  readonly reachedStep: W7Step;
  readonly policyRuleId: string;
  readonly policyVersion: string;
  readonly policyHash: string;
  readonly blockId: string;
  readonly fragmentIds: readonly string[];
  readonly egressFilter: EgressFilterReceipt;
  /**
   * La estrategia que se **ejecutó** y con qué operación. Va aparte de
   * `policyRuleId` a propósito: la regla dice qué se decidió y esto qué se
   * hizo, y sólo teniendo los dos se puede comprobar que coinciden.
   */
  readonly execution: StrategyExecution | null;
}

export type SessionTurnResult =
  /** La política suprimió el turno: no se llama al proveedor (paso 2). */
  | {
      readonly outcome: 'suppressed';
      readonly stoppedAt: 'politica';
      readonly policyOutcome: PedagogyPolicyOutcome;
      readonly audit: TurnAuditTrail;
    }
  /** P-I §9.6 bloqueó **antes** de llamar al proveedor (paso 5, primera mitad). */
  | {
      readonly outcome: 'blocked_by_non_revelation';
      readonly stoppedAt: 'validador';
      readonly findings: readonly NonRevelationFinding[];
      readonly policyOutcome: PedagogyPolicyOutcome;
      readonly audit: TurnAuditTrail;
    }
  /** El validador de anclaje rechazó la salida (paso 5, segunda mitad). */
  | {
      readonly outcome: 'rejected_by_anchoring';
      readonly stoppedAt: 'validador';
      readonly rejections: readonly AnchorRejection[];
      /** Los rechazos del **último** intento; `attempts` dice cuántos hubo. */
      readonly attempts: number;
      readonly policyOutcome: PedagogyPolicyOutcome;
      readonly audit: TurnAuditTrail;
    }
  /**
   * El proveedor cayó y la sesión **continúa con contenido congelado**
   * (T-H7-06). Es una rama propia y no un `delivered` con otro texto: quien lea
   * la evidencia tiene que poder distinguir lo que dijo el modelo de lo que
   * dijo el corpus, y en modo experimento esto altera la condición.
   */
  | {
      readonly outcome: 'degraded';
      readonly stoppedAt: 'alumno';
      readonly segments: readonly { readonly text: string; readonly standing: SegmentStanding }[];
      readonly cause: 'provider_unavailable';
      /** De qué freeze sale el texto. Sin esto no sería trazable. */
      readonly freezeVersion: string;
      readonly providerError: string;
      /**
       * P-II §8.6: continuar con contenido congelado **altera la condición** de
       * una corrida experimental. Se declara aquí para que quien registre la
       * evidencia emita la desviación; el turno no decide si la corrida es
       * material, sólo dice que esto pasó.
       */
      readonly alteredCondition: true;
      readonly policyOutcome: PedagogyPolicyOutcome;
      readonly audit: TurnAuditTrail;
    }
  /** Salida aceptada y entregable al alumno (paso 6). */
  | {
      readonly outcome: 'delivered';
      readonly stoppedAt: 'alumno';
      readonly segments: readonly { readonly text: string; readonly standing: SegmentStanding }[];
      /** P-I §8.5: una salida no anclada no puede fundamentar calificación. */
      readonly canGroundEvaluation: boolean;
      /** Intentos que costó. `1` es el caso normal; `2` significa que el
       *  primero se rechazó por anclaje y el segundo pasó. Se publica porque
       *  un turno que costó dos llamadas y uno que costó una no son el mismo
       *  hecho, ni para el coste ni para lo que dice del proveedor. */
      readonly attempts: number;
      readonly policyOutcome: PedagogyPolicyOutcome;
      readonly audit: TurnAuditTrail;
    };

/**
 * Ejecuta un turno de enseñanza completo.
 *
 * No tiene reloj ni azar: lo que necesite marca de tiempo la pone quien
 * registre la evidencia. Es la misma razón por la que la sesión seca es
 * reproducible acto por acto.
 */
export async function runTeachingTurn(
  deps: SessionTurnDependencies,
  input: SessionTurnInput,
): Promise<SessionTurnResult> {
  // ── Paso 2: la política selecciona ────────────────────────────────────────
  // Va antes que nada porque puede suprimir el turno entero, y recuperar
  // fragmentos o llamar al proveedor para algo que la política ya suprimió
  // sería trabajo —y gasto— sobre una decisión ya tomada.
  const policyOutcome = deps.policy.decide(input.decisionContext);

  const baseAudit = {
    policyRuleId: policyOutcome.ruleId,
    policyVersion: policyOutcome.policyVersion,
    policyHash: policyOutcome.policyHash,
    blockId: input.blockId,
  } as const;

  if (policyOutcome.kind === 'suppressed') {
    return {
      outcome: 'suppressed',
      stoppedAt: 'politica',
      policyOutcome,
      audit: {
        ...baseAudit,
        reachedStep: 'politica',
        fragmentIds: [],
        egressFilter: NO_EGRESS_YET,
        // No hubo estrategia que ejecutar: la política suprimió el turno.
        execution: null,
      },
    };
  }

  // ── Paso 3 (antes): traducir la estrategia decidida a su ejecución ────────
  // Va antes de tocar el corpus porque una estrategia sin ejecución declarada
  // es un fallo de configuración, no un turno a medias: mejor lanzar aquí que
  // recuperar fragmentos y gastar una llamada para descubrirlo después.
  // Misma estrategia sobre el mismo KC que el turno anterior ⇒ segunda pasada.
  // La estrategia y el nivel de ayuda **no cambian** —eso sería adaptarse por
  // fuera de la política—; cambia la representación (P-I §5.10, T-H7-05).
  const esSegundaPasada =
    input.previousTurn !== null &&
    input.previousTurn.strategy === policyOutcome.decision.strategy &&
    input.previousTurn.kcId === input.decisionContext.kcId;

  const execution = esSegundaPasada
    ? rephrasedExecution(policyOutcome.decision.strategy)
    : strategyExecution(policyOutcome.decision.strategy);

  // ── Paso 3: fragmentos autorizados ────────────────────────────────────────
  const fragments = deps.retrieveFragments(input.blockId);
  const fragmentIds = fragments.map((f) => f.fragmentId);

  // ── Paso 4: contexto filtrado (P-I §9.4, P-II §8.3) ───────────────────────
  // `buildSessionContext()` es quien aplica el filtro de egreso y quien lanza
  // si un fragmento no es del bloque, si la pista excede el nivel permitido o
  // si una clave de estado no está declarada. No se repite aquí: repetirlo
  // crearía una segunda autoridad que se quedaría vieja.
  const context: SessionContext = buildSessionContext(
    {
      blockId: input.blockId,
      authorizedFragments: fragments,
      minimalState: input.minimalState,
      minimalStateKeys: input.minimalStateKeys,
      goal: input.goal,
      mode: input.decisionContext.mode,
      strategy: policyOutcome.decision.strategy,
      allowedHelpLevel: policyOutcome.decision.assistanceLevel,
      structuredError: input.structuredError,
      selectedHint: input.selectedHint,
      scorableActivityOpen: input.scorableActivity !== null,
    },
    deps.canaryDetector === undefined ? {} : { canaryDetector: deps.canaryDetector },
  );

  // El recibo declara qué comprobó de verdad `buildSessionContext()`. Los tres
  // campos son `true` porque los tres son incondicionales ahí dentro y lanzan
  // si fallan — no es un recibo optimista: si alguno no se hubiera hecho, no
  // habría contexto que firmar porque la construcción habría lanzado.
  const egressFilter: EgressFilterReceipt = {
    canaryDetectorApplied: deps.canaryDetector !== undefined,
    fragmentsCheckedAgainstBlock: true,
    helpLevelChecked: true,
  };

  const audit: TurnAuditTrail = {
    ...baseAudit,
    reachedStep: 'modelo',
    fragmentIds,
    egressFilter,
    execution,
  };

  // ── Paso 5a: no revelación, ANTES del proveedor (P-I §9.6) ────────────────
  const revelation = checkNonRevelation({
    scorableActivity: input.scorableActivity,
    egressFilter,
    hint: input.candidateHint,
    deliversFeedback: input.deliversFeedback,
    // Vacío porque `buildSessionContext()` **aborta** con `CanaryHitError` si
    // detecta uno: si la ejecución llegó hasta aquí, no había. Pasar un canario
    // detectado como dato en vez de como incidente lo degradaría a hallazgo, y
    // P-II §11.3 lo declara incidente de nivel 3.
    canaryHits: [],
  });

  if (revelation.outcome === 'blocked') {
    return {
      outcome: 'blocked_by_non_revelation',
      stoppedAt: 'validador',
      findings: revelation.findings,
      policyOutcome,
      audit: { ...audit, reachedStep: 'validador' },
    };
  }

  // ── Pasos 4 y 5b: el modelo ejecuta, el validador comprueba ───────────────
  // El reintento vive aquí y no en el transporte: `httpTransport` no reintenta
  // porque no puede saber si la petición llegó, y esta decisión sí sabe qué
  // falló —el anclaje— y qué cuesta repetirlo.
  const intentosMaximos = 1 + Math.max(0, deps.anchoringRetries ?? 0);
  let verdict: ReturnType<typeof validateAnchoredOutput> | undefined;
  let attempts = 0;

  while (attempts < intentosMaximos) {
    attempts += 1;
    let raw: unknown;
    try {
      raw = await deps.model({
      operation: execution.operation,
      // Base + acto. En este orden: el contrato de formato manda, y la
      // directiva de estrategia no puede reescribirlo.
      instructions: `${input.instructions}

${execution.directive}`,
        context,
      });
    } catch (err) {
      // ── T-H7-06: el proveedor cayó ────────────────────────────────────────
      // No se reintenta: el reintento de arriba es para el **anclaje**, que es
      // un fallo del contenido y puede salir bien a la segunda. Una caída del
      // proveedor no se arregla repitiendo de inmediato, y repetirla cobraría
      // dos veces una petición que quizá llegó.
      const degradada = deps.degraded;
      if (degradada === undefined) throw err;

      const congelado = degradada(input.blockId);
      return {
        outcome: 'degraded',
        stoppedAt: 'alumno',
        // El texto congelado sale del corpus del bloque, así que está anclado
        // por construcción — pero **no** se marca `anchored`: no pasó por el
        // validador porque no vino del modelo, y decir que sí lo hizo sería
        // firmar una comprobación que no ocurrió.
        segments: [{ text: congelado.text, standing: { kind: 'non_factual_accompaniment' } }],
        cause: 'provider_unavailable',
        freezeVersion: congelado.freezeVersion,
        providerError: String(err),
        alteredCondition: true,
        policyOutcome,
        audit: { ...audit, reachedStep: 'alumno' },
      };
    }

    // ── Paso 5b: validador de anclaje, DESPUÉS (P-II §8.4, I-7) ─────────────
    verdict = validateAnchoredOutput(
      raw,
      { blockId: input.blockId, authorizedFragments: fragments, calculus: deps.calculus },
      deps.canaryDetector === undefined ? {} : { canaryDetector: deps.canaryDetector },
    );
    if (verdict.outcome === 'accepted') break;
  }

  // `verdict` está definido: el bucle corre al menos una vez porque
  // `intentosMaximos` es 1 como mínimo.
  if (verdict === undefined || verdict.outcome === 'rejected') {
    return {
      outcome: 'rejected_by_anchoring',
      stoppedAt: 'validador',
      rejections: verdict === undefined ? [] : verdict.rejections,
      attempts,
      policyOutcome,
      audit: { ...audit, reachedStep: 'validador' },
    };
  }

  // ── Paso 6: al alumno ─────────────────────────────────────────────────────
  // Un segmento `withheld` no se entrega: P-I §8.5 sólo permite presentar lo
  // anclado y el acompañamiento no factual. Se filtra aquí y **se cuenta** en
  // el veredicto, que ya lo lleva en `auditRecord`.
  const segments = verdict.output.segments
    .map((segment, index) => ({
      text: segment.text,
      standing: verdict.standings[index] as SegmentStanding,
    }))
    .filter((s) => s.standing.kind !== 'withheld');

  return {
    outcome: 'delivered',
    stoppedAt: 'alumno',
    segments,
    canGroundEvaluation: verdict.canGroundEvaluation,
    attempts,
    policyOutcome,
    audit: { ...audit, reachedStep: 'alumno' },
  };
}

/**
 * Recibo del filtro de egreso cuando **no se llegó a construir contexto**. Los
 * tres `false` son literales: decir `true` de una comprobación que no se hizo
 * sería firmar un control inexistente.
 */
const NO_EGRESS_YET: EgressFilterReceipt = Object.freeze({
  canaryDetectorApplied: false,
  fragmentsCheckedAgainstBlock: false,
  helpLevelChecked: false,
});
