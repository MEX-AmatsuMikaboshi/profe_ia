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
  readonly operation: string;
  readonly instructions: string;
  /** ¿Este turno pretende entregar retroalimentación al alumno? (P-I §9.6). */
  readonly deliversFeedback: boolean;
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
      },
    };
  }

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

  // ── Paso 4 (cont.): el modelo ejecuta lingüísticamente ────────────────────
  const raw = await deps.model({
    operation: input.operation,
    instructions: input.instructions,
    context,
  });

  // ── Paso 5b: validador de anclaje, DESPUÉS (P-II §8.4, I-7) ───────────────
  const verdict = validateAnchoredOutput(
    raw,
    { blockId: input.blockId, authorizedFragments: fragments, calculus: deps.calculus },
    deps.canaryDetector === undefined ? {} : { canaryDetector: deps.canaryDetector },
  );

  if (verdict.outcome === 'rejected') {
    return {
      outcome: 'rejected_by_anchoring',
      stoppedAt: 'validador',
      rejections: verdict.rejections,
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
