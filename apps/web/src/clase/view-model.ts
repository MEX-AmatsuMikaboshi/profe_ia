import type { SessionStructuredState } from '@profesor-ia/session-engine';

/**
 * Modelo de vista de Clase (T-H6-13 ← P-I §8.9, UIUX §6.5, UI-CORR-02/04).
 *
 * Todo lo que la vista muestra o habilita se **deriva** del estado estructurado
 * de sesión. La interfaz no decide: si el modo es de medición, las pistas no se
 * apagan porque un componente lo recuerde, sino porque aquí no hay forma de
 * construir un modelo con pistas disponibles en ese modo — y el intento falla en
 * vez de degradarse.
 *
 * La razón no es de estilo. Una vista que decidiera por su cuenta sería una
 * segunda política pedagógica, con otra implementación, capaz de discrepar del
 * motor justo en la sesión que después se analiza como evidencia.
 */

export const CLASE_VIEW_MODEL_SCHEMA_VERSION = 'clase-view-model-v1' as const;

export type ClaseViewErrorCode =
  | 'CAPACIDAD_NO_IMPLEMENTADA'
  | 'MODO_MEDICION_INCOHERENTE'
  | 'FEEDBACK_EN_MEDICION'
  | 'RUBRICA_AUSENTE'
  | 'ENTREGA_GENERADA_EN_VIVO';

export class ClaseViewError extends Error {
  constructor(
    readonly code: ClaseViewErrorCode,
    detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = 'ClaseViewError';
  }
}

function fail(code: ClaseViewErrorCode, detail: string): never {
  throw new ClaseViewError(code, detail);
}

// ───────────────────────────── capacidades ─────────────────────────────

/**
 * Capacidades de la corrida (P-II §13-H8 fija el juego completo en `T-H8-13`).
 * Se declaran todas, incluidas las que esta fase no implementa: una capacidad
 * ausente del tipo se leería como «no aplica» en vez de «todavía no».
 */
export interface ClaseCapabilityFlags {
  readonly voiceInput: boolean;
  readonly voiceOutput: boolean;
  readonly whiteboard: boolean;
  readonly visualBoardInterpretation: boolean;
  readonly uiAnnotations: boolean;
  readonly internalUiCapture: boolean;
  readonly externalScreenCapture: boolean;
}

/** Capacidades que F7 implementa: ninguna multimodal. `T-H7-07` es literal. */
export const F7_SUPPORTED_CAPABILITIES: ClaseCapabilityFlags = Object.freeze({
  voiceInput: false,
  voiceOutput: false,
  whiteboard: false,
  visualBoardInterpretation: false,
  uiAnnotations: false,
  internalUiCapture: false,
  externalScreenCapture: false,
});

/**
 * Configuración **recomendada** de la corrida H8 (T-H8-13 ← P-II §13-H8).
 *
 * Es literal de la norma y se declara ahora, aunque **no esté activa**: tenerla
 * escrita deja ver de un vistazo qué separa la fase de hoy de la corrida
 * multimodal, y evita que alguien la reconstruya de memoria cuando llegue F10.
 *
 * `externalScreenCapture` es la única en `false`, y no por falta de tiempo:
 * P-II §11.6 la declara experimental y **apagada**, con activación por acción
 * explícita. Encenderla por omisión capturaría pantalla fuera de la aplicación.
 *
 * **Encender cualquiera de las otras hoy lanza `CAPACIDAD_NO_IMPLEMENTADA`**,
 * porque las superficies que las atienden son de F10 (`T-H8-01`…`T-H8-06`). Esa
 * constante y esa guarda juntas son lo que impide que la corrida crea tener una
 * capacidad que nadie implementó.
 */
export const H8_RECOMMENDED_CAPABILITIES: ClaseCapabilityFlags = Object.freeze({
  voiceInput: true,
  voiceOutput: true,
  whiteboard: true,
  visualBoardInterpretation: true,
  uiAnnotations: true,
  internalUiCapture: true,
  externalScreenCapture: false,
});

/**
 * Una capacidad encendida sin superficie que la atienda **lanza**.
 *
 * `T-H7-07` dice que voz y pizarrón llegan en F10 y que Clase opera texto+Fitch.
 * Renderizar la clase con `voiceInput: true` y sin micrófono sería decirle a la
 * corrida que la capacidad estaba activa cuando no lo estaba, y eso contamina la
 * matriz de autonomía. Este punto de fallo es donde F10 se enchufa.
 */
export function assertCapabilitiesImplemented(flags: ClaseCapabilityFlags): void {
  const enabled = (Object.keys(F7_SUPPORTED_CAPABILITIES) as (keyof ClaseCapabilityFlags)[]).filter(
    (key) => flags[key] && !F7_SUPPORTED_CAPABILITIES[key],
  );
  if (enabled.length > 0) {
    fail(
      'CAPACIDAD_NO_IMPLEMENTADA',
      `la interfaz de Clase de F7 es texto+Fitch (T-H7-07); no implementa ${enabled.join(', ')}. ` +
        'Llegan en F10 (T-H8-01…05).',
    );
  }
}

// ─────────────────────────── entradas de la vista ───────────────────────────

/** Procedencia de cada turno; sin ella la conversación no es reconstruible. */
export type TranscriptProvenance =
  | {
      readonly kind: 'scripted';
      readonly contentId: string;
      readonly catalogVersion: string;
      readonly deliveryMode: 'script' | 'degraded';
      /** Literal del contrato de guion: nunca hubo generación en vivo. */
      readonly liveGeneration: false;
    }
  | { readonly kind: 'participant' }
  | { readonly kind: 'engine'; readonly eventCode: string };

export interface ClaseTranscriptEntry {
  readonly entryId: string;
  readonly speaker: 'profesor_ia' | 'alumno' | 'sistema';
  readonly text: string;
  readonly at: string;
  /** Acto del guion, cuando lo hay: distingue feedback de explicación. */
  readonly actKind: string | null;
  readonly provenance: TranscriptProvenance;
}

export interface ClaseRubricCriterion {
  readonly criterionId: string;
  readonly text: string;
}

/** Rúbrica del reactivo puntuable, del paquete congelado (`rubrics/`). */
export interface ClaseRubric {
  readonly rubricId: string;
  readonly version: string;
  readonly criteria: readonly ClaseRubricCriterion[];
}

export interface ClaseActivity {
  readonly activityId: string;
  readonly kcId: string;
  readonly statement: string;
  /** Puntuable ⇒ el paquete congelado garantiza rúbrica (`applicable_rubrics`). */
  readonly scorable: boolean;
  readonly rubric: ClaseRubric | null;
  /** ¿Hay ítem de sonda presentado ahora mismo? Decide la semántica de pausa. */
  readonly probeItemPresented: boolean;
}

export type SaveState =
  | { readonly kind: 'guardado'; readonly atRevision: number; readonly at: string }
  | { readonly kind: 'guardando' }
  | { readonly kind: 'cambios_sin_guardar' }
  | { readonly kind: 'error'; readonly code: string; readonly detail: string };

export interface ClaseViewInput {
  readonly session: SessionStructuredState;
  readonly capabilities: ClaseCapabilityFlags;
  readonly transcript: readonly ClaseTranscriptEntry[];
  readonly activity: ClaseActivity | null;
  readonly saveState: SaveState;
  /** Niveles de pista ya entregados en el intento vigente, del motor. */
  readonly hintLevelsDelivered: readonly number[];
  /** Nivel máximo del banco para este reactivo; `null` si no hay banco. */
  readonly hintMaximumLevel: number | null;
}

// ─────────────────────────── salida de la vista ───────────────────────────

export type HintUnavailableReason =
  | 'measurement_mode'
  | 'sin_actividad'
  | 'sin_banco'
  | 'banco_agotado'
  | 'sesion_pausada';

export type HintControl =
  | { readonly available: true; readonly nextLevel: number; readonly maximumLevel: number }
  | { readonly available: false; readonly reason: HintUnavailableReason };

/** Consecuencia literal de pausar, según la política congelada de T-H6-08. */
export type PauseConsequence = 'ninguna' | 'invalida_el_reactivo_de_sonda_en_curso';

export interface PauseControl {
  readonly available: boolean;
  readonly paused: boolean;
  readonly consequence: PauseConsequence;
}

/**
 * Aviso de modo sonda (UI-CORR-02). Los cuatro campos son los cuatro puntos que
 * la corrección enumera; no es una lista de sugerencias.
 */
export interface ProbeNotice {
  readonly hintsDisabled: true;
  readonly pedagogicalFeedbackSuppressed: true;
  /** El agente no tiene autoridad sobre selección, tiempo ni consumo. */
  readonly agentWithoutMeasurementAuthority: true;
  /** Ni bancos futuros ni soluciones se muestran. */
  readonly futureBanksHidden: true;
}

/**
 * Apelación (UI-CORR-04). `liveHumanPedagogicalIntervention` es `false` en el
 * tipo, no en una comprobación: la corrección prohíbe que apelar abra una vía
 * para que un humano decida el avance en vivo, e I-9 prohíbe el endpoint de
 * rescate docente. Si el campo pudiera valer `true`, la prohibición sería una
 * declaración de intenciones.
 */
export interface AppealControl {
  readonly available: true;
  readonly effect: 'registro_para_revision_humana_posterior';
  readonly liveHumanPedagogicalIntervention: false;
}

export interface WithdrawalControl {
  readonly available: true;
  readonly effect: 'detiene_la_participacion';
}

export interface ClaseViewModel {
  readonly schemaVersion: typeof CLASE_VIEW_MODEL_SCHEMA_VERSION;
  readonly sessionId: string;
  readonly primaryState: SessionStructuredState['primaryState'];
  readonly transverseStates: readonly SessionStructuredState['transverseStates'][number][];
  readonly pedagogicalMode: SessionStructuredState['pedagogicalMode'];
  readonly measurementMode: boolean;
  /** Presente exactamente cuando el modo es de medición. */
  readonly probeNotice: ProbeNotice | null;
  readonly activity: ClaseActivity | null;
  readonly rubric: ClaseRubric | null;
  readonly transcript: readonly ClaseTranscriptEntry[];
  readonly hints: HintControl;
  readonly pause: PauseControl;
  readonly appeal: AppealControl;
  readonly withdrawal: WithdrawalControl;
  readonly saveState: SaveState;
  readonly capabilities: ClaseCapabilityFlags;
  /** UIUX §3: la navegación lateral se reduce u oculta en Clase. */
  readonly navigationVisible: false;
  /** El editor Fitch se ofrece para actividades formales de lógica. */
  readonly fitchEditorVisible: boolean;
}

/** Actos del guion que son feedback pedagógico y no pueden sonar en medición. */
const PEDAGOGICAL_FEEDBACK_ACTS = new Set([
  'templated_feedback',
  'self_explanation_prompt',
  'worked_example',
  'completion_prompt',
]);

function assertMeasurementCoherence(session: SessionStructuredState): void {
  if (session.pedagogicalMode !== 'MEASUREMENT_MODE') return;
  const offending: string[] = [];
  if (session.selectedStrategy !== null) offending.push(`selectedStrategy=${session.selectedStrategy}`);
  if (session.assistanceLevel !== 0) offending.push(`assistanceLevel=${session.assistanceLevel}`);
  if (session.masteryEligibility) offending.push('masteryEligibility=true');
  if (offending.length > 0) {
    fail(
      'MODO_MEDICION_INCOHERENTE',
      `MEASUREMENT_MODE no admite estrategia, ayuda ni elegibilidad: ${offending.join(', ')}`,
    );
  }
}

function assertNoFeedbackDuringMeasurement(input: ClaseViewInput): void {
  if (input.session.pedagogicalMode !== 'MEASUREMENT_MODE') return;
  const offending = input.transcript.filter(
    (entry) => entry.actKind !== null && PEDAGOGICAL_FEEDBACK_ACTS.has(entry.actKind),
  );
  if (offending.length > 0) {
    fail(
      'FEEDBACK_EN_MEDICION',
      'UI-CORR-02: durante la sonda no hay feedback pedagógico. Entradas ofensoras: ' +
        offending.map((entry) => `${entry.entryId} (${entry.actKind})`).join(', '),
    );
  }
}

/**
 * Ninguna entrega puede declararse generada en vivo en esta fase: F7 es sesión
 * seca (`T-H6-14`). Una entrada sin la marca del guion sería contenido de
 * procedencia desconocida en la transcripción que después se audita.
 */
function assertNoLiveGeneration(input: ClaseViewInput): void {
  for (const entry of input.transcript) {
    if (entry.speaker !== 'profesor_ia') continue;
    if (entry.provenance.kind !== 'scripted') {
      fail(
        'ENTREGA_GENERADA_EN_VIVO',
        `el turno ${entry.entryId} del Profesor IA no viene del catálogo congelado; F7 es sesión seca`,
      );
    }
  }
}

function assertRubricPresent(activity: ClaseActivity | null): void {
  if (activity === null || !activity.scorable) return;
  if (activity.rubric === null) {
    fail(
      'RUBRICA_AUSENTE',
      `la actividad ${activity.activityId} es puntuable y el linter del paquete exige rúbrica ` +
        '(`applicable_rubrics`). Mostrar el panel vacío ocultaría un paquete incompleto.',
    );
  }
}

function deriveHints(input: ClaseViewInput): HintControl {
  if (input.session.pedagogicalMode === 'MEASUREMENT_MODE') {
    return { available: false, reason: 'measurement_mode' };
  }
  if (input.session.transverseStates.includes('pausa')) {
    return { available: false, reason: 'sesion_pausada' };
  }
  if (input.activity === null) return { available: false, reason: 'sin_actividad' };
  if (input.hintMaximumLevel === null) return { available: false, reason: 'sin_banco' };

  const delivered = input.hintLevelsDelivered;
  const highest = delivered.length === 0 ? 0 : Math.max(...delivered);
  const nextLevel = highest + 1;
  if (nextLevel > input.hintMaximumLevel) return { available: false, reason: 'banco_agotado' };
  return { available: true, nextLevel, maximumLevel: input.hintMaximumLevel };
}

function derivePause(input: ClaseViewInput): PauseControl {
  const paused = input.session.transverseStates.includes('pausa');
  const measurement = input.session.pedagogicalMode === 'MEASUREMENT_MODE';
  // T-H6-08 literal: la pausa pre-ítem no selecciona ni consume; la post-ítem
  // conserva el consumo y deriva `invalid_participant_pause`. Se declara porque
  // es consecuencia de la política congelada, no una interpretación de la vista.
  const consequence: PauseConsequence =
    measurement && input.activity?.probeItemPresented === true
      ? 'invalida_el_reactivo_de_sonda_en_curso'
      : 'ninguna';
  return { available: !paused, paused, consequence };
}

export function buildClaseViewModel(input: ClaseViewInput): ClaseViewModel {
  assertCapabilitiesImplemented(input.capabilities);
  assertMeasurementCoherence(input.session);
  assertNoFeedbackDuringMeasurement(input);
  assertNoLiveGeneration(input);
  assertRubricPresent(input.activity);

  const measurementMode = input.session.pedagogicalMode === 'MEASUREMENT_MODE';

  return {
    schemaVersion: CLASE_VIEW_MODEL_SCHEMA_VERSION,
    sessionId: input.session.sessionId,
    primaryState: input.session.primaryState,
    transverseStates: input.session.transverseStates,
    pedagogicalMode: input.session.pedagogicalMode,
    measurementMode,
    probeNotice: measurementMode
      ? {
          hintsDisabled: true,
          pedagogicalFeedbackSuppressed: true,
          agentWithoutMeasurementAuthority: true,
          futureBanksHidden: true,
        }
      : null,
    activity: input.activity,
    rubric: input.activity?.rubric ?? null,
    transcript: input.transcript,
    hints: deriveHints(input),
    pause: derivePause(input),
    appeal: {
      available: true,
      effect: 'registro_para_revision_humana_posterior',
      liveHumanPedagogicalIntervention: false,
    },
    withdrawal: { available: true, effect: 'detiene_la_participacion' },
    saveState: input.saveState,
    capabilities: input.capabilities,
    navigationVisible: false,
    fitchEditorVisible: input.activity !== null,
  };
}
