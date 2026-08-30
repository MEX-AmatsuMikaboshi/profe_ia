import type { CoordinateFrame, FramedPoint } from './coordinates.js';

/**
 * Overlay de anotaciones del Profesor IA (T-H8-05 ← P-I §8.9.2).
 *
 * ## La regla que ordena todo lo demás
 *
 * > **El modelo decide QUÉ, el frontend resuelve DÓNDE.**
 *
 * Por eso una anotación normal **no lleva coordenadas**: lleva un *target
 * semántico* —`fitch-line:4`, `hint-button`, `kc-definition:KC06`— y el
 * frontend lo resuelve contra el DOM y el estado. Que el modelo mandara píxeles
 * significaría que ha tenido que mirar la pantalla para señalar la línea 4,
 * cuando la línea 4 es un dato que el motor ya tiene.
 *
 * Las coordenadas sólo aparecen **cuando no hay target lógico** —manuscrito,
 * dibujo del pizarrón, región de una imagen importada— y entonces vienen de
 * visión, con su marco declarado. Esa asimetría es el contrato, no una
 * comodidad: se comprueba en `assertAnnotation()`.
 *
 * ## Y la que impide que esto autorice nada
 *
 * `DEC-VISION-001`: **ningún score visual autoriza un veredicto formal**. Este
 * paquete no importa `logic-core` ni puede —la regla `visual-sin-veredicto-formal`
 * de `.dependency-cruiser.cjs` lo prohíbe y tiene siembra—. Una anotación señala;
 * no dice si algo está bien.
 */

/** Primitivas literales de P-I §8.9.2. La lista es cerrada. */
export const ANNOTATION_PRIMITIVES = [
  'point',
  'highlight',
  'circle',
  'arrow',
  'underline',
] as const;
export type AnnotationPrimitive = (typeof ANNOTATION_PRIMITIVES)[number];

/**
 * Familias de target semántico estable.
 *
 * Son **estables** en el sentido que importa: sobreviven a que la página se
 * repinte, se desplace o cambie de tamaño, porque nombran una cosa del dominio
 * y no un sitio de la pantalla.
 */
export const TARGET_KINDS = [
  /** `fitch-line:4` — una línea de la derivación, por su ordinal. */
  'fitch-line',
  /** `hint-button` — un control de la interfaz. */
  'hint-button',
  /** `kc-definition:KC06` — la definición de un KC en el material. */
  'kc-definition',
  /** `board` — el pizarrón como superficie. */
  'board',
] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];

/** Los que llevan `:valor`; los demás son el target entero. */
const TARGETS_CON_VALOR: ReadonlySet<TargetKind> = new Set(['fitch-line', 'kc-definition']);

export interface SemanticTarget {
  readonly kind: TargetKind;
  /** `4` en `fitch-line:4`; ausente en `board` y `hint-button`. */
  readonly value?: string;
}

/** Serializa un target a la forma literal que P-I §8.9.2 usa. */
export function formatTarget(target: SemanticTarget): string {
  return target.value === undefined ? target.kind : `${target.kind}:${target.value}`;
}

/** Parsea un target. Devuelve `null` si no corresponde a ninguna familia. */
export function parseTarget(raw: string): SemanticTarget | null {
  const corte = raw.indexOf(':');
  const kind = (corte === -1 ? raw : raw.slice(0, corte)) as TargetKind;
  if (!TARGET_KINDS.includes(kind)) return null;

  if (!TARGETS_CON_VALOR.has(kind)) {
    // `board:algo` no es un `board`: aceptarlo dejaría pasar targets inventados
    // con prefijo válido.
    return corte === -1 ? { kind } : null;
  }
  if (corte === -1) return null;
  const value = raw.slice(corte + 1);
  return value === '' ? null : { kind, value };
}

/**
 * Una anotación. O señala un target semántico, o señala coordenadas — **nunca
 * las dos cosas y nunca ninguna**.
 */
export type AnnotationAim =
  | { readonly kind: 'semantic'; readonly target: SemanticTarget }
  | {
      readonly kind: 'perceived';
      readonly points: readonly FramedPoint[];
      readonly frame: CoordinateFrame;
      /**
       * Por qué no hubo target lógico. Obligatorio: sin esto, «no había target»
       * y «no me molesté en buscarlo» son indistinguibles, y la segunda es
       * exactamente la que hay que poder auditar.
       */
      readonly reason: string;
    };

export interface Annotation {
  readonly annotationId: string;
  readonly primitive: AnnotationPrimitive;
  readonly aim: AnnotationAim;
  /**
   * Equivalente textual **obligatorio** (P-I §8.9.2, §7.6).
   *
   * Sin él, una anotación no existe para quien no ve la pantalla, y la clase
   * pasaría a depender de un canal que no todo el mundo tiene. Es obligatorio en
   * el tipo **y** se comprueba en ejecución, porque los archivos de prueba de
   * este repositorio se typechequean pero un llamador de fuera podría no
   * compilarse (la lección de `scorableActivityOpen`, T-H7-03).
   */
  readonly textEquivalent: string;
  /** La superficie que se anota, y en qué revisión estaba. */
  readonly surfaceId: string;
  readonly surfaceRevision: number;
  /** Cuándo se emitió, en ms desde época. Lo pone quien emite, no este módulo. */
  readonly issuedAtMs: number;
}

export type AnnotationErrorCode =
  | 'AIM_AMBIGUO'
  | 'TARGET_DESCONOCIDO'
  | 'SIN_EQUIVALENTE_TEXTUAL'
  | 'REVISION_NO_MONOTONICA'
  | 'COORDENADAS_SIN_MOTIVO'
  | 'MAX_AGE_NO_CALIBRADO';

export class AnnotationError extends Error {
  readonly code: AnnotationErrorCode;

  constructor(code: AnnotationErrorCode, detail: string) {
    super(detail);
    this.name = 'AnnotationError';
    this.code = code;
  }
}

/** Valida la forma de una anotación antes de que llegue a la pantalla. */
export function assertAnnotation(annotation: Annotation): void {
  if (typeof annotation.textEquivalent !== 'string' || annotation.textEquivalent.trim() === '') {
    throw new AnnotationError(
      'SIN_EQUIVALENTE_TEXTUAL',
      `la anotación ${annotation.annotationId} no trae equivalente textual. Sin él no existe para ` +
        `quien no ve la pantalla, y la clase pasaría a depender de un canal que no todos tienen ` +
        `(P-I §8.9.2, §7.6).`,
    );
  }

  if (annotation.aim.kind === 'semantic') {
    if (!TARGET_KINDS.includes(annotation.aim.target.kind)) {
      throw new AnnotationError(
        'TARGET_DESCONOCIDO',
        `«${formatTarget(annotation.aim.target)}» no pertenece a ninguna familia de target ` +
          `estable. La lista es cerrada a propósito: un target inventado no lo resuelve nadie.`,
      );
    }
    const conValor = TARGETS_CON_VALOR.has(annotation.aim.target.kind);
    if (conValor !== (annotation.aim.target.value !== undefined)) {
      throw new AnnotationError(
        'TARGET_DESCONOCIDO',
        `«${annotation.aim.target.kind}» ${conValor ? 'exige' : 'no admite'} un valor.`,
      );
    }
    return;
  }

  const aim = annotation.aim;
  if (aim.points.length === 0) {
    throw new AnnotationError(
      'AIM_AMBIGUO',
      `la anotación ${annotation.annotationId} dice apuntar a coordenadas y no trae ninguna.`,
    );
  }
  if (aim.reason.trim() === '') {
    throw new AnnotationError(
      'COORDENADAS_SIN_MOTIVO',
      `la anotación ${annotation.annotationId} usa coordenadas sin decir por qué no había target ` +
        `lógico. Sin ese motivo, «no había target» y «no se buscó» son indistinguibles, y la ` +
        `segunda es justo la que hay que poder auditar (P-I §8.9.1).`,
    );
  }
  const distinto = aim.points.find((p) => p.frame !== aim.frame);
  if (distinto !== undefined) {
    throw new AnnotationError(
      'AIM_AMBIGUO',
      `la anotación declara el marco «${aim.frame}» y trae un punto en «${distinto.frame}».`,
    );
  }
}

/**
 * Revisión monotónica por superficie.
 *
 * Cada cambio de una superficie sube su revisión. Una anotación emitida contra
 * la revisión 7 y aplicada cuando la superficie va por la 9 apunta a algo que ya
 * no está ahí — y una flecha que señala la línea equivocada es peor que ninguna
 * flecha, porque el alumno la cree.
 */
export class SurfaceRevisions {
  readonly #revisiones = new Map<string, number>();

  current(surfaceId: string): number {
    return this.#revisiones.get(surfaceId) ?? 0;
  }

  /** Sube la revisión. **Monotónica**: retroceder lanza. */
  bump(surfaceId: string, revision: number): void {
    const actual = this.current(surfaceId);
    if (revision <= actual) {
      throw new AnnotationError(
        'REVISION_NO_MONOTONICA',
        `la superficie ${surfaceId} va por la revisión ${String(actual)} y se intentó fijar ` +
          `${String(revision)}. Retroceder haría que una anotación obsoleta volviera a parecer ` +
          `vigente.`,
      );
    }
    this.#revisiones.set(surfaceId, revision);
  }
}

/**
 * Antigüedad máxima admisible de una anotación.
 *
 * **`[CALIBRATION CAL-MULTIMODAL]` — no tiene valor y no se le pone uno.**
 * P-I §8.9.2 la pide «calibrada», y elegir aquí un número plausible movería una
 * frontera real con una suposición: demasiado alto deja pasar anotaciones
 * obsoletas, demasiado bajo tira anotaciones buenas en una máquina lenta. Este
 * punto de fallo es donde se enchufa el valor congelado en `T-H8-11`.
 */
export function maxAnnotationAgeMs(): number {
  throw new AnnotationError(
    'MAX_AGE_NO_CALIBRADO',
    'CAL-MULTIMODAL no está congelada: P-I §8.9.2 pide una antigüedad máxima **calibrada** y no ' +
      'hay valor. Devolver aquí un número plausible movería la frontera entre «anotación vigente» ' +
      'y «obsoleta» con una suposición. Se congela en T-H8-11.',
  );
}

export type StalenessVerdict =
  | { readonly outcome: 'fresh' }
  | {
      readonly outcome: 'stale';
      readonly reason: 'surface_revised' | 'too_old';
      readonly detail: string;
    };

/**
 * ¿La anotación sigue siendo aplicable? **Rechazo duro**, no aviso.
 *
 * La comprobación de revisión no necesita calibración —o la superficie cambió o
 * no— y por eso se hace siempre. La de antigüedad sí la necesita, así que
 * `maxAgeMs` **entra por parámetro**: quien lo tenga congelado lo pasa, y quien
 * no, no puede llamar a esta función con él sin pasar antes por
 * `maxAnnotationAgeMs()`, que falla cerrado.
 */
export function checkStaleness(
  annotation: Annotation,
  revisions: SurfaceRevisions,
  nowMs: number,
  maxAgeMs?: number,
): StalenessVerdict {
  const actual = revisions.current(annotation.surfaceId);
  if (annotation.surfaceRevision < actual) {
    return {
      outcome: 'stale',
      reason: 'surface_revised',
      detail:
        `emitida contra la revisión ${String(annotation.surfaceRevision)} de ` +
        `${annotation.surfaceId}, que va por la ${String(actual)}`,
    };
  }
  if (maxAgeMs !== undefined) {
    const edad = nowMs - annotation.issuedAtMs;
    if (edad > maxAgeMs) {
      return {
        outcome: 'stale',
        reason: 'too_old',
        detail: `${String(edad)} ms de antigüedad contra un máximo de ${String(maxAgeMs)} ms`,
      };
    }
  }
  return { outcome: 'fresh' };
}
