/**
 * Estado estructurado antes que visión (T-H8-04 ← P-I §8.9.1, `DEC-VISION-001`).
 *
 * ## El orden, que es lo que la tarea fija
 *
 * > **Se lee la estructura primero.** La percepción sólo entra donde la
 * > estructura no llega.
 *
 * El editor Fitch, el pizarrón y la interfaz ya producen **estado**: la línea 4
 * es un dato, no una región de píxeles. Mirar la pantalla para averiguar algo que
 * el motor ya sabe cambia una lectura exacta por una estimada, y encima gasta.
 *
 * Por eso `visionEligibility()` no pregunta «¿puedo usar visión?» sino «¿queda
 * algo que la estructura no cubra?», y la respuesta por omisión es **no**.
 *
 * ## Los cinco casos donde sí, y son cerrados
 *
 * P-I §8.9.1 los enumera: manuscrito, dibujo semántico, imagen importada, región
 * ambigua y captura autorizada. La lista no se amplía aquí.
 *
 * ## Lo que ningún score autoriza
 *
 * `DEC-VISION-001`: **ningún score visual autoriza un veredicto formal**. Este
 * módulo devuelve `observe | confirm | decline` —qué hacer con lo percibido— y
 * ninguna de las tres es «dar por válido». La imposibilidad es además
 * arquitectónica: la regla `visual-sin-veredicto-formal` impide que este paquete
 * alcance la ruta de verificación, y `ci:visual:no-verdict` lo comprueba.
 */

/** Los cinco casos donde la estructura no llega (P-I §8.9.1). Lista cerrada. */
export const VISION_GROUNDS = [
  'handwriting',
  'semantic_drawing',
  'imported_image',
  'ambiguous_region',
  'authorized_capture',
] as const;
export type VisionGround = (typeof VISION_GROUNDS)[number];

/**
 * Acciones de la política visual. **Ninguna es «dar por válido»**: la más
 * permisiva, `observe`, sólo autoriza *registrar lo percibido*.
 */
export const VISION_ACTIONS = ['observe', 'confirm', 'decline'] as const;
export type VisionAction = (typeof VISION_ACTIONS)[number];

export interface VisionRequest {
  /** ¿El estado estructurado responde ya la pregunta? */
  readonly structuredStateAnswers: boolean;
  /** Por qué la estructura no llega. `null` si sí llega. */
  readonly ground: VisionGround | null;
  /**
   * Confianza del reconocedor, 0..1. Se acepta **sólo** para decidir entre
   * `observe` y `confirm`; nunca para validar nada.
   */
  readonly confidence: number;
}

export type VisionEligibility =
  | { readonly outcome: 'not_needed'; readonly reason: string }
  | { readonly outcome: 'eligible'; readonly ground: VisionGround }
  | { readonly outcome: 'refused'; readonly reason: string };

export type VisionPolicyErrorCode = 'THRESHOLDS_NOT_CALIBRATED' | 'INVALID_CONFIDENCE';

export class VisionPolicyError extends Error {
  readonly code: VisionPolicyErrorCode;

  constructor(code: VisionPolicyErrorCode, detail: string) {
    super(detail);
    this.name = 'VisionPolicyError';
    this.code = code;
  }
}

/**
 * ¿Entra la visión? Por omisión **no**.
 *
 * No mira confianza ni umbrales: eso es de después. Aquí sólo se decide si queda
 * algo que la estructura no cubra, que es la pregunta que P-I §8.9.1 pone
 * primero.
 */
export function visionEligibility(request: VisionRequest): VisionEligibility {
  if (request.structuredStateAnswers) {
    return {
      outcome: 'not_needed',
      reason:
        'el estado estructurado responde la pregunta; mirar la pantalla cambiaría una lectura ' +
        'exacta por una estimada (P-I §8.9.1)',
    };
  }
  if (request.ground === null) {
    return {
      outcome: 'refused',
      reason:
        'la estructura no responde y no se declara ninguno de los cinco motivos de §8.9.1. Sin ' +
        'motivo declarado, «hacía falta visión» y «se recurrió a visión sin mirar el estado» son ' +
        'indistinguibles',
    };
  }
  if (!VISION_GROUNDS.includes(request.ground)) {
    return {
      outcome: 'refused',
      reason: `«${String(request.ground)}» no es uno de los cinco motivos; la lista es cerrada`,
    };
  }
  return { outcome: 'eligible', ground: request.ground };
}

/**
 * Umbrales de la política visual.
 *
 * **`[CALIBRATION CAL-MULTIMODAL]` — no tienen valor y no se les pone uno.**
 * P-I §8.9.1 los pide «calibrados sobre conjunto dorado propio», y ese conjunto
 * es de `T-H8-12` (BENCH-03). Elegir aquí dos números plausibles decidiría, con
 * una suposición, cuándo el sistema afirma haber leído bien un manuscrito — que
 * es exactamente la frontera donde nacen los **errores confiados**.
 */
export function visionThresholds(): { readonly observe: number; readonly confirm: number } {
  throw new VisionPolicyError(
    'THRESHOLDS_NOT_CALIBRATED',
    'CAL-MULTIMODAL no está congelada. P-I §8.9.1 pide umbrales calibrados sobre conjunto dorado ' +
      'propio, y ese conjunto es de BENCH-03 (T-H8-12). Dos números plausibles aquí decidirían con ' +
      'una suposición cuándo el sistema afirma haber leído bien, que es donde nacen los errores ' +
      'confiados.',
  );
}

/**
 * Qué hacer con lo percibido, **dados** unos umbrales congelados.
 *
 * Los umbrales entran por parámetro y no se leen de `visionThresholds()`: así
 * quien los tenga puede decidir, y quien no, choca con el punto de fallo en vez
 * de recibir un valor inventado.
 *
 * `decline` no es un error: es el sistema diciendo que no está en condiciones de
 * afirmar lo que vio. Es la salida correcta y tiene que ser barata de tomar.
 */
export function visionAction(
  confidence: number,
  thresholds: { readonly observe: number; readonly confirm: number },
): VisionAction {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new VisionPolicyError(
      'INVALID_CONFIDENCE',
      `la confianza tiene que estar en 0..1 y llegó ${String(confidence)}.`,
    );
  }
  if (confidence >= thresholds.observe) return 'observe';
  if (confidence >= thresholds.confirm) return 'confirm';
  return 'decline';
}

/**
 * Un **error confiado**: el sistema afirmó con confianza alta y se equivocó.
 *
 * P-I §8.9.1 exige registrarlos siempre. Son la medida que importa de un
 * reconocedor: un sistema que se equivoca dudando es incómodo, y uno que se
 * equivoca seguro es peligroso, porque nadie lo revisa.
 */
export interface ConfidentError {
  readonly observationId: string;
  readonly confidence: number;
  readonly actionTaken: VisionAction;
  readonly perceived: string;
  readonly actual: string;
  readonly ground: VisionGround;
}

/**
 * ¿Fue un error confiado? Sólo si el sistema **actuó** sobre lo percibido.
 *
 * Un `decline` que resultó equivocado no es un error confiado: el sistema dijo
 * que no sabía, y acertó al decirlo.
 */
export function isConfidentError(error: ConfidentError): boolean {
  return error.actionTaken === 'observe' && error.perceived !== error.actual;
}
