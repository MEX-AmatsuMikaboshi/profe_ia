/**
 * Captura interna (T-H8-06 ← P-II §11.6, P-I §8.9).
 *
 * ## Lo que decide este módulo
 *
 * Qué se puede capturar, qué queda fuera y con qué constancia. **No rasteriza
 * nada**: la conversión de una región del DOM a píxeles la hace el cliente con
 * la librería que se verifique (`html-to-image` es candidata en `Plan.md`, no
 * elección tomada). Separarlo importa porque la política es lo que hay que poder
 * auditar, y una política enredada con un rasterizador no se audita: se ejecuta.
 *
 * ## Por qué los overlays del Profesor IA quedan fuera, y no es una preferencia
 *
 * P-II §11.6 excluye «secretos, identidad innecesaria, overlays del Profesor IA
 * y componentes no relevantes». Lo de los overlays tiene una consecuencia
 * concreta que conviene ver: si una captura incluye la capa de anotaciones,
 * **la siguiente pasada de visión lee las marcas del propio Profesor IA como si
 * fueran trabajo del alumno**. El sistema se confirmaría a sí mismo, con toda la
 * apariencia de haber observado algo. Es la versión visual de dejar que un
 * modelo evalúe su propia salida.
 *
 * ## El pizarrón se exporta, no se fotografía
 *
 * `Plan.md` pide «export del pizarrón preferido». La razón es la misma que en
 * `T-H8-03`: el pizarrón **produce estado**, y ese estado ya es exacto. Una foto
 * de él es una degradación —pierde `elementId`, actor y referencia a KC— que
 * después habría que reconstruir adivinando. Por eso {@link planCapture} devuelve
 * `board-export` para el pizarrón y ni siquiera ofrece rasterizarlo.
 *
 * ## Anclaje: una captura sin evento necesario no se guarda
 *
 * «Frames/artefactos no anclados a un evento necesario se descartan». Aquí eso
 * es una negativa, no un barrido posterior: sin `anchorEventType` de la familia
 * `visual.*` no hay plan de captura. Capturar «por si acaso» y limpiar luego
 * significa que el material sensible existió, y que borrarlo depende de que el
 * barrido corra.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Regiones y capas
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Regiones **propias** capturables. Lista cerrada.
 *
 * Todas son superficies que el sistema dibuja. No hay una entrada «pantalla» ni
 * «ventana»: eso es captura externa y va por otra puerta ({@link
 * authorizeExternalCapture}).
 */
export const CAPTURE_REGIONS = [
  'fitch-editor',
  'whiteboard',
  'activity-statement',
  'local-review',
  'verdict-panel',
] as const;
export type CaptureRegion = (typeof CAPTURE_REGIONS)[number];

/**
 * Capas excluidas por omisión (P-II §11.6).
 *
 * `profesor-overlay` y `annotation-overlay` son las dos caras de lo mismo: lo
 * que el Profesor IA puso en pantalla. `credentials` y `participant-identity`
 * son los secretos y la identidad innecesaria.
 */
export const EXCLUDABLE_LAYERS = [
  'profesor-overlay',
  'annotation-overlay',
  'credentials',
  'participant-identity',
  'irrelevant-chrome',
] as const;
export type CaptureLayer = (typeof EXCLUDABLE_LAYERS)[number];

/**
 * Las que **no** se pueden incluir ni con justificación.
 *
 * Las otras dos —overlays— son exclusiones por omisión que una finalidad
 * documentada podría levantar; una credencial en una captura no tiene finalidad
 * que la justifique, y la identidad innecesaria es innecesaria por definición.
 * Admitir un `include` con motivo para éstas convertiría el motivo en el camino
 * por el que entra justo lo que la norma saca.
 */
export const NEVER_INCLUDABLE: readonly CaptureLayer[] = ['credentials', 'participant-identity'];

/** Eventos que pueden requerir una captura (familia `visual.*` de P-II §9.3). */
export const CAPTURE_ANCHOR_EVENTS = [
  'visual.capture.taken',
  'visual.interpretation.observed',
] as const;
export type CaptureAnchorEvent = (typeof CAPTURE_ANCHOR_EVENTS)[number];

/* ────────────────────────────────────────────────────────────────────────────
 * Plan de captura
 * ──────────────────────────────────────────────────────────────────────────── */

export interface CaptureRequest {
  readonly region: CaptureRegion;
  /** El evento que la hace necesaria. Sin él no hay captura. */
  readonly anchorEventType: string;
  /** Capas que se piden incluir pese a la exclusión por omisión. */
  readonly includeLayers: readonly CaptureLayer[];
  /** Justificación por capa incluida. Sin ella, la inclusión se rechaza. */
  readonly justifications: Readonly<Record<string, string>>;
}

export type CapturePlan =
  | {
      readonly kind: 'board-export';
      readonly region: 'whiteboard';
      readonly rationale: string;
    }
  | {
      readonly kind: 'raster';
      readonly region: CaptureRegion;
      readonly excludedLayers: readonly CaptureLayer[];
      readonly includedLayers: readonly CaptureLayer[];
      readonly anchorEventType: CaptureAnchorEvent;
      readonly rationale: string;
    };

export type CaptureErrorCode =
  | 'REGION_DESCONOCIDA'
  | 'SIN_ANCLAJE'
  | 'CAPA_DESCONOCIDA'
  | 'CAPA_NO_INCLUIBLE'
  | 'INCLUSION_SIN_JUSTIFICACION'
  | 'HUELLA_INVALIDA'
  | 'ARTEFACTO_SIN_ANCLAJE'
  | 'AUTORIZACION_CONSUMIDA'
  | 'AUTORIZACION_SIN_ACCION_DEL_ALUMNO'
  | 'CAPACIDAD_APAGADA';

export class CaptureError extends Error {
  readonly code: CaptureErrorCode;

  constructor(code: CaptureErrorCode, detail: string) {
    super(detail);
    this.name = 'CaptureError';
    this.code = code;
  }
}

/**
 * Decide cómo capturar, o lanza.
 *
 * Composición **por negación**: se parte de todas las capas excluidas y sólo se
 * levanta la exclusión de las que se pidan con motivo. Al revés —listar lo que
 * se excluye— una capa nueva entraría en las capturas el día que alguien la
 * añade a la interfaz, sin que nadie tocara esta política.
 */
export function planCapture(request: CaptureRequest): CapturePlan {
  if (!(CAPTURE_REGIONS as readonly string[]).includes(request.region)) {
    throw new CaptureError(
      'REGION_DESCONOCIDA',
      `«${request.region}» no es una región capturable. La lista es cerrada, y no incluye la ` +
        `pantalla ni la ventana: eso es captura externa y va por authorizeExternalCapture().`,
    );
  }

  if (!(CAPTURE_ANCHOR_EVENTS as readonly string[]).includes(request.anchorEventType)) {
    throw new CaptureError(
      'SIN_ANCLAJE',
      `«${request.anchorEventType}» no es un evento que requiera captura. P-II §11.6 descarta los ` +
        `artefactos no anclados a un evento necesario, y descartarlos después significa que el ` +
        `material existió: aquí no se captura.`,
    );
  }
  const anchorEventType = request.anchorEventType as CaptureAnchorEvent;

  if (request.region === 'whiteboard') {
    // No se ofrece rasterizarlo, ni con motivo: la foto perdería `elementId`,
    // actor y referencia a KC, que el estado sí tiene (T-H8-03).
    return {
      kind: 'board-export',
      region: 'whiteboard',
      rationale:
        'el pizarrón produce estado estructurado y exacto; una imagen de él es una degradación ' +
        'que después habría que reconstruir adivinando',
    };
  }

  for (const capa of request.includeLayers) {
    if (!(EXCLUDABLE_LAYERS as readonly string[]).includes(capa)) {
      throw new CaptureError('CAPA_DESCONOCIDA', `«${capa}» no es una capa conocida.`);
    }
    if (NEVER_INCLUDABLE.includes(capa)) {
      throw new CaptureError(
        'CAPA_NO_INCLUIBLE',
        `«${capa}» no se incluye en una captura ni con justificación. Admitir un motivo la ` +
          `convertiría en el camino por el que entra justo lo que P-II §11.6 saca.`,
      );
    }
    const motivo = request.justifications[capa];
    if (motivo === undefined || motivo.trim() === '') {
      throw new CaptureError(
        'INCLUSION_SIN_JUSTIFICACION',
        `se pide incluir «${capa}» sin finalidad documentada. La exclusión es por omisión: ` +
          `levantarla exige decir para qué.`,
      );
    }
  }

  const includedLayers = [...request.includeLayers];
  const excludedLayers = EXCLUDABLE_LAYERS.filter((capa) => !includedLayers.includes(capa));

  return {
    kind: 'raster',
    region: request.region,
    excludedLayers,
    includedLayers,
    anchorEventType,
    rationale:
      includedLayers.length === 0
        ? 'exclusión por omisión de las cinco capas; ninguna inclusión pedida'
        : `exclusión por omisión levantada para: ${includedLayers.join(', ')}`,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Artefactos
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * El artefacto resultante.
 *
 * La huella la calcula quien produce los bytes; aquí se **valida** y se
 * convierte en referencia. El módulo no importa `node:crypto` a propósito: la
 * captura ocurre en el cliente, y arrastrar criptografía de Node a un paquete
 * que el navegador carga lo haría inservible justo donde se usa.
 */
export interface CaptureArtifact {
  readonly artifactId: string;
  /** SHA-256 en hexadecimal, 64 caracteres. */
  readonly sha256: string;
  readonly byteLength: number;
  readonly region: CaptureRegion;
  readonly anchorEventId: string;
  readonly capturedAt: string;
}

const HEX_64 = /^[0-9a-f]{64}$/;

/**
 * Referencia con hash para el `captureRef` del replay multimodal (T-H8-08).
 *
 * El formato lleva el algoritmo delante. Un hash desnudo obliga a quien lo lea
 * dentro de dos años a deducir con qué se calculó, y la deducción sale mal el
 * día que se cambie de algoritmo.
 */
export function captureRef(artifact: CaptureArtifact): string {
  if (!HEX_64.test(artifact.sha256)) {
    throw new CaptureError(
      'HUELLA_INVALIDA',
      `«${artifact.sha256}» no es un SHA-256 hexadecimal de 64 caracteres. Un artefacto sin ` +
        `huella válida no es referenciable, y una referencia que no se puede comprobar no ` +
        `distingue el artefacto original de otro puesto en su lugar.`,
    );
  }
  if (artifact.anchorEventId.trim() === '') {
    throw new CaptureError(
      'ARTEFACTO_SIN_ANCLAJE',
      'el artefacto no nombra el evento que lo requería. P-II §11.6 descarta los no anclados.',
    );
  }
  return `sha256:${artifact.sha256}`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Captura externa
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Autorización del alumno para una captura externa (`getDisplayMedia`).
 *
 * `scope` es siempre `'single_capture'` y no hay otro valor. P-II §11.6 dice que
 * no puede mantenerse habilitada silenciosamente, y la forma de que eso sea
 * cierto por construcción es que **no exista** una autorización duradera que
 * alguien pueda conceder una vez y olvidar.
 */
export interface ExternalCaptureGrant {
  readonly grantedAt: string;
  /** Sólo el alumno concede. Un `system` aquí sería habilitación silenciosa. */
  readonly grantedBy: 'student';
  readonly scope: 'single_capture';
  readonly consumed: boolean;
}

/**
 * Consume la autorización, o lanza.
 *
 * Tres puertas, y las tres tienen que estar abiertas a la vez: la capacidad
 * encendida —que hoy está en `false` en `H8_RECOMMENDED_CAPABILITIES` porque
 * §11.6 la declara experimental—, una autorización del alumno, y que esa
 * autorización no se haya usado ya.
 */
export function authorizeExternalCapture(
  grant: ExternalCaptureGrant,
  capabilityEnabled: boolean,
): ExternalCaptureGrant {
  if (!capabilityEnabled) {
    throw new CaptureError(
      'CAPACIDAD_APAGADA',
      'externalScreenCapture está apagada. P-II §11.6 la declara experimental y OFF: encenderla ' +
        'es acción explícita, no un valor por omisión que alguien cambió.',
    );
  }
  if (grant.grantedBy !== 'student') {
    throw new CaptureError(
      'AUTORIZACION_SIN_ACCION_DEL_ALUMNO',
      'la captura externa exige acción explícita del alumno. Cualquier otro concedente es ' +
        'exactamente la habilitación silenciosa que §11.6 prohíbe.',
    );
  }
  if (grant.consumed) {
    throw new CaptureError(
      'AUTORIZACION_CONSUMIDA',
      'esta autorización ya se usó. El alcance es una captura: reutilizarla la convertiría en ' +
        'permiso permanente concedido una vez.',
    );
  }
  return { ...grant, consumed: true };
}
