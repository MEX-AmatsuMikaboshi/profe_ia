/**
 * Familias de evento multimodal en el ledger existente (T-H8-08 ← P-II §9.3).
 *
 * ## Por qué esto no crea un ledger nuevo
 *
 * La tarea dice «evidencia multimodal **en el ledger existente**», y es lo que
 * hay que hacer: un segundo registro tendría su propia cadena de hashes, su
 * propia secuencia, y reconstruir una sesión exigiría entrelazar dos historias
 * cuyas marcas de tiempo no son comparables. Aquí sólo se declara **qué tipos de
 * evento** son legítimos; el sobre, la cadena y el `append` siguen siendo los de
 * `T-H6-09`.
 *
 * ## Las familias son cerradas, y la validación falla cerrado
 *
 * `EvidenceEvent.eventType` es `string` en el contrato, así que sin esto
 * cualquier cadena pasaría — `board.elemento.creado`, `boards.element.created`,
 * `visual.foo` — y el registro acabaría con cinco maneras de nombrar lo mismo.
 * Un ledger append-only no se puede limpiar después: lo que entra, se queda.
 *
 * ## Lo que este módulo NO afirma
 *
 * Que una superficie multimodal exista. Declarar `speech.transcript.commit`
 * como tipo válido no implica que haya STT: implica que **si lo hubiera**, ése
 * es el nombre. Las superficies son `T-H8-01`…`T-H8-06` y siguen pendientes.
 */

/** Prefijos literales de P-II §9.3. La lista es cerrada. */
export const MULTIMODAL_EVENT_FAMILIES = [
  'speech',
  'tts',
  'board',
  'visual',
  'annotation',
] as const;
export type MultimodalEventFamily = (typeof MULTIMODAL_EVENT_FAMILIES)[number];

/**
 * Los tipos concretos por familia.
 *
 * Se enumeran en vez de admitir `familia.*` libre por la misma razón que las
 * familias son cerradas: `board.element.create` y `board.element.created` son
 * dos nombres para lo mismo, y un ledger append-only conserva los dos para
 * siempre.
 */
const TIPOS: Readonly<Record<MultimodalEventFamily, readonly string[]>> = Object.freeze({
  speech: [
    // Los parciales **no** se registran: son de interfaz y cambian cada pocos
    // milisegundos. Sólo el `COMMIT` es un hecho (P-I §8.10).
    'speech.transcript.commit',
    'speech.transcript.correction',
    'speech.capture.start',
    'speech.capture.end',
  ],
  tts: ['tts.utterance.start', 'tts.utterance.end', 'tts.utterance.interrupted'],
  board: [
    'board.element.created',
    'board.element.updated',
    'board.element.deleted',
    'board.scene.snapshot',
  ],
  visual: ['visual.capture.taken', 'visual.interpretation.observed', 'visual.interpretation.declined'],
  annotation: ['annotation.emitted', 'annotation.rejected_stale'],
});

export class MultimodalEventError extends Error {
  readonly code: 'FAMILIA_DESCONOCIDA' | 'TIPO_DESCONOCIDO' | 'REPLAY_INCOMPLETO';

  constructor(code: 'FAMILIA_DESCONOCIDA' | 'TIPO_DESCONOCIDO' | 'REPLAY_INCOMPLETO', detail: string) {
    super(detail);
    this.name = 'MultimodalEventError';
    this.code = code;
  }
}

/** ¿Es un `eventType` de una familia multimodal? (No dice si es válido.) */
export function isMultimodalEventType(eventType: string): boolean {
  const familia = eventType.slice(0, eventType.indexOf('.'));
  return (MULTIMODAL_EVENT_FAMILIES as readonly string[]).includes(familia);
}

/** Todos los tipos declarados, para que las pruebas los recorran. */
export function multimodalEventTypes(): readonly string[] {
  return Object.values(TIPOS).flat();
}

/**
 * Valida un `eventType` multimodal. **Lanza** ante uno inventado.
 *
 * Se llama sólo sobre los que parecen multimodales: los tipos de sesión, de
 * corrección y de dominio tienen sus propias reglas y no se tocan aquí.
 */
export function assertMultimodalEventType(eventType: string): void {
  const corte = eventType.indexOf('.');
  const familia = corte === -1 ? eventType : eventType.slice(0, corte);
  if (!(MULTIMODAL_EVENT_FAMILIES as readonly string[]).includes(familia)) {
    throw new MultimodalEventError(
      'FAMILIA_DESCONOCIDA',
      `«${familia}» no es una de las familias de P-II §9.3 ` +
        `(${MULTIMODAL_EVENT_FAMILIES.join(', ')}).`,
    );
  }
  const declarados = TIPOS[familia as MultimodalEventFamily];
  if (!declarados.includes(eventType)) {
    throw new MultimodalEventError(
      'TIPO_DESCONOCIDO',
      `«${eventType}» no está declarado en la familia «${familia}». Los tipos se enumeran a ` +
        `propósito: dos nombres para el mismo hecho quedan los dos para siempre en un ledger ` +
        `append-only. Declarados: ${declarados.join(', ')}.`,
    );
  }
}

/**
 * Lo que un replay multimodal tiene que poder reconstruir (T-H8-08).
 *
 * P-II lo enumera: estado, captura, versión, prompt, modelo y salida. Están los
 * seis como campos obligatorios porque **un replay al que le falta uno no es un
 * replay**: es una reconstrucción parcial que parece completa, y quien la mire
 * meses después no tendrá forma de saber qué faltaba.
 */
export interface MultimodalReplayRecord {
  readonly eventId: string;
  /** Estado estructurado en el momento del evento. */
  readonly structuredState: string;
  /** Referencia con hash al artefacto de captura; `null` si no hubo. */
  readonly captureRef: string | null;
  /** Versión del material y del normalizador implicados. */
  readonly versions: Readonly<Record<string, string>>;
  /** El prompt exacto que se envió; `null` si el evento no llamó al modelo. */
  readonly prompt: string | null;
  /** Binding del modelo; `null` si no lo hubo. */
  readonly modelBindingId: string | null;
  /** La salida tal como llegó; `null` si no la hubo. */
  readonly output: string | null;
}

/**
 * Comprueba que un registro de replay está **completo**.
 *
 * Los cuatro campos que admiten `null` lo admiten porque hay eventos que
 * genuinamente no llaman al modelo ni capturan nada —`board.element.created` es
 * uno—. Lo que **no** se admite es que falten: `null` dice «no hubo» y ausente
 * dice «no se registró», y confundirlos hace irreconstruible justo el evento que
 * alguien querrá revisar.
 */
export function assertReplayComplete(record: MultimodalReplayRecord): void {
  const obligatorios: readonly (readonly [string, unknown])[] = [
    ['eventId', record.eventId],
    ['structuredState', record.structuredState],
    ['versions', record.versions],
  ];
  for (const [nombre, valor] of obligatorios) {
    if (valor === undefined || valor === null || valor === '') {
      throw new MultimodalEventError(
        'REPLAY_INCOMPLETO',
        `el registro de replay no trae «${nombre}». Un replay al que le falta un campo no es un ` +
          `replay: es una reconstrucción parcial que parece completa.`,
      );
    }
  }
  for (const nombre of ['captureRef', 'prompt', 'modelBindingId', 'output'] as const) {
    if (!(nombre in record)) {
      throw new MultimodalEventError(
        'REPLAY_INCOMPLETO',
        `«${nombre}» está ausente. Si no hubo, va \`null\`: ausente dice «no se registró», y ` +
          `confundir las dos cosas hace irreconstruible el evento que alguien querrá revisar.`,
      );
    }
  }
  // Un prompt sin binding, o al revés, describe una llamada imposible.
  if ((record.prompt === null) !== (record.modelBindingId === null)) {
    throw new MultimodalEventError(
      'REPLAY_INCOMPLETO',
      'prompt y modelBindingId tienen que ir juntos: un prompt sin binding —o al revés— describe ' +
        'una llamada que no se puede reproducir.',
    );
  }
}
