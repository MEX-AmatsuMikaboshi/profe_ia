/**
 * Estado de W0 (T-H45-01 ← P-I §7.0, §12 «W0», `DEC-CORPUS-001`).
 *
 * `operations.w0_state` ya existía con los trece estados y un `CHECK`, pero un
 * `CHECK` de pertenencia **permite cualquier orden**: acepta saltar de
 * `solicitud_curso` a `corpus_autorizado` sin haber descubierto una sola fuente.
 * Lo que falta —y es lo que aporta esta tarea— son las transiciones.
 *
 * Ninguna transición de aquí es inventada. El flujo principal es el literal de
 * `Plan.md` T-H45-01; el ciclo de rechazo es el literal del Maestro
 * (`corpus_rechazado → W0_reinvestigacion → propuesta_corpus`); y el cierre en
 * fallo sale del paso 12 de §12 —«si la regla de saturación demuestra que no
 * quedan candidatos autorizables … cerrar H4.5 como
 * `failed_no_authorizable_corpus`»—, que se aplica tras medir cobertura y
 * también tras una reinvestigación agotada.
 */

export const W0_STATES = [
  'solicitud_curso',
  'alcance_acotado',
  'fuentes_descubiertas',
  'fuentes_evaluadas',
  'fuentes_comparadas',
  'licencias_clasificadas',
  'cobertura_evaluada',
  'propuesta_corpus',
  'corpus_autorizado',
  'W1_ingesta',
  'corpus_rechazado',
  'W0_reinvestigacion',
  'failed_no_authorizable_corpus',
] as const;
export type W0State = (typeof W0_STATES)[number];

export const W0_INITIAL_STATE: W0State = 'solicitud_curso';

/** Estados sin salida. `W1_ingesta` cierra bien; el otro cierra H4.5 en fallo. */
export const W0_TERMINAL_STATES = ['W1_ingesta', 'failed_no_authorizable_corpus'] as const;

/**
 * Transiciones autorizadas. Un estado que no aparece como origen es terminal, y
 * un destino que no está en su lista **no ocurre**: no hay comodín.
 */
export const W0_TRANSITIONS: Readonly<Record<W0State, readonly W0State[]>> = Object.freeze({
  solicitud_curso: ['alcance_acotado'],
  alcance_acotado: ['fuentes_descubiertas'],
  fuentes_descubiertas: ['fuentes_evaluadas'],
  fuentes_evaluadas: ['fuentes_comparadas'],
  fuentes_comparadas: ['licencias_clasificadas'],
  licencias_clasificadas: ['cobertura_evaluada'],
  // Paso 7 de §12: tras medir cobertura se aplica el criterio de saturación, y
  // si demuestra que no quedan candidatos autorizables, se cierra en fallo.
  cobertura_evaluada: ['propuesta_corpus', 'failed_no_authorizable_corpus'],
  // Paso 9–11: la autorización externa autoriza o rechaza.
  propuesta_corpus: ['corpus_autorizado', 'corpus_rechazado'],
  corpus_autorizado: ['W1_ingesta'],
  corpus_rechazado: ['W0_reinvestigacion'],
  // Literal del Maestro: `corpus_rechazado → W0_reinvestigacion → propuesta_corpus`.
  // Y si al reinvestigar se agota el sobre permitido, cierra en fallo.
  W0_reinvestigacion: ['propuesta_corpus', 'failed_no_authorizable_corpus'],
  W1_ingesta: [],
  failed_no_authorizable_corpus: [],
});

export class W0TransitionError extends Error {
  constructor(
    readonly from: W0State,
    readonly to: W0State,
  ) {
    const permitidas = W0_TRANSITIONS[from];
    super(
      `W0 no transita de ${from} a ${to}. ` +
        (permitidas.length === 0
          ? `${from} es un estado terminal.`
          : `Desde ${from} solo se puede ir a ${permitidas.join(' o ')}.`),
    );
    this.name = 'W0TransitionError';
  }
}

/**
 * Un rechazo sin código de causa no se registra. El Maestro dice que «la causa
 * se registra mediante código y evidencia», y un rechazo anónimo dejaría a la
 * reinvestigación sin saber qué corregir.
 */
export class MissingRejectionReasonError extends Error {
  constructor() {
    super(
      'La transición a corpus_rechazado exige rejection_reason_code: la causa se registra por ' +
        'código y evidencia (P-I §7.0). Un rechazo anónimo dejaría a la reinvestigación sin saber ' +
        'qué corregir.',
    );
    this.name = 'MissingRejectionReasonError';
  }
}

export function isW0State(value: string): value is W0State {
  return (W0_STATES as readonly string[]).includes(value);
}

export function isTerminalW0State(state: W0State): boolean {
  return (W0_TERMINAL_STATES as readonly string[]).includes(state);
}

export interface W0TransitionOptions {
  /** Obligatorio al pasar a `corpus_rechazado`. */
  readonly rejectionReasonCode?: string;
}

/** Comprueba una transición. Falla cerrado ante cualquiera no declarada. */
export function assertW0Transition(
  from: W0State,
  to: W0State,
  options: W0TransitionOptions = {},
): void {
  if (!W0_TRANSITIONS[from].includes(to)) {
    throw new W0TransitionError(from, to);
  }
  if (to === 'corpus_rechazado' && (options.rejectionReasonCode ?? '') === '') {
    throw new MissingRejectionReasonError();
  }
}

export interface W0Step {
  readonly from: W0State;
  readonly to: W0State;
  readonly rejectionReasonCode?: string;
}

/**
 * Máquina de estados de una corrida W0. No guarda nada por su cuenta: quien la
 * usa persiste en `operations.w0_state`.
 */
export class W0Machine {
  #state: W0State = W0_INITIAL_STATE;
  readonly #history: W0Step[] = [];

  constructor(initial: W0State = W0_INITIAL_STATE) {
    this.#state = initial;
  }

  state(): W0State {
    return this.#state;
  }

  history(): readonly W0Step[] {
    return Object.freeze([...this.#history]);
  }

  transition(to: W0State, options: W0TransitionOptions = {}): W0State {
    assertW0Transition(this.#state, to, options);

    const step: W0Step =
      options.rejectionReasonCode === undefined
        ? { from: this.#state, to }
        : { from: this.#state, to, rejectionReasonCode: options.rejectionReasonCode };

    this.#history.push(step);
    this.#state = to;
    return this.#state;
  }
}
