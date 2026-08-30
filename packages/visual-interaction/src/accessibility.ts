/**
 * Línea base de accesibilidad H8 (T-H8-10 ← Maestro §10.5, UIUX §8, P-I §8.9.3).
 *
 * ## Qué es esto, y qué no es
 *
 * El Maestro exige que H8 **ejecute y documente** una línea base de accesibilidad
 * registrando «criterios verificados, no verificados y excepciones conocidas», y
 * dice acto seguido que el proyecto **no declara conformidad WCAG 2.2 AA global**
 * sin una auditoría criterio por criterio. Las dos mitades importan por igual: la
 * primera obliga a mirar, la segunda prohíbe presumir de haber mirado más de lo
 * que se miró.
 *
 * Este módulo es el **libro mayor** de esa línea base. No comprueba nada por sí
 * mismo —eso lo hace `ci:a11y:baseline` contra el navegador— sino que decide qué
 * puede declararse verificado y qué no. La distinción es la de siempre en este
 * repo: la prosa no verifica, y un criterio marcado a mano en un documento se
 * queda desactualizado el día que alguien cambia una hoja de estilo.
 *
 * ## Las tres reglas que se hacen cumplir, y por qué
 *
 * **1. `verificado` exige el nombre del check que lo verifica.** Un criterio que
 * se declara verificado sin instrumento es exactamente lo que este proyecto ya
 * cazó dos veces: `T-H7-05`, donde el check pasó en verde mirando la operación en
 * vez del `outcome`, y D-85, donde 43 pruebas no las compilaba nadie. En ambos el
 * árbol se veía verde. Aquí, sin check declarado, se lanza.
 *
 * **2. Un criterio cuya superficie no existe no puede estar verificado.** Es la
 * disciplina de controles positivos aplicada a la accesibilidad: axe sobre una
 * página que no monta el pizarrón «no encuentra problemas en el pizarrón», y ese
 * silencio es indistinguible de un pizarrón accesible. Hoy no hay micrófono, ni
 * pizarrón montado en la vista, ni overlay de anotaciones renderizado — y por eso
 * cuatro criterios salen `no_verificado` con su motivo, que es el resultado
 * honesto y no una carencia del instrumento.
 *
 * **3. No hay forma de expresar conformidad global.** El informe no tiene campo
 * donde escribirla: `wcagGlobalConformance` es el literal `'no_declarada'` y el
 * tipo no admite otro valor. Un campo booleano que hoy vale `false` es un campo
 * que alguien pone en `true` dentro de seis meses sin auditar nada.
 *
 * ## El registro de ayudas técnicas, y su conexión con `classifyFailure()`
 *
 * El Maestro pide registrar las ayudas técnicas del participante «para separar
 * barreras de interfaz de errores de contenido». Eso enlaza directamente con
 * `ACCESSIBILITY_ERROR` de {@link ./failure-attribution.js}: descartar una barrera
 * de accesibilidad exige saber con qué estaba trabajando el alumno.
 *
 * Por eso aquí **ausente y «ninguna» no son lo mismo**, igual que en el replay
 * multimodal de `T-H8-08`: una lista vacía dice «se preguntó y no usa ninguna»;
 * la falta de registro dice «nadie preguntó». Con lo segundo,
 * {@link canRuleOutAccessibilityBarrier} se niega a dar por descartada la barrera
 * — porque «no había barrera» y «no miramos» darían el mismo dato, y el segundo
 * acabaría anotado como conocimiento del alumno.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Superficies
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Las superficies de interfaz sobre las que se pronuncia la línea base.
 *
 * Lista cerrada: si aparece una superficie nueva, entra aquí y se declara su
 * estado, en vez de quedar fuera del libro mayor sin que nadie lo note.
 */
export const A11Y_SURFACES = [
  'editor-fitch',
  'controles-de-sesion',
  'transcripcion-y-profesor',
  'microfono',
  'pizarron',
  'overlay-anotaciones',
  'notacion-logica',
] as const;
export type A11ySurface = (typeof A11Y_SURFACES)[number];

/**
 * Si una superficie está montada en la vista, con el detalle de por qué.
 *
 * `present: false` no es un fallo: es el estado normal de lo que F10 todavía no
 * ha construido. Lo que sería un fallo es declarar verificado un criterio que
 * depende de ella.
 */
export interface SurfacePresence {
  readonly surface: A11ySurface;
  readonly present: boolean;
  readonly detail: string;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Criterios
 * ──────────────────────────────────────────────────────────────────────────── */

export const A11Y_CRITERION_IDS = [
  'CRIT-TECLADO',
  'CRIT-FOCO',
  'CRIT-SIN-TRAMPAS',
  'CRIT-ARRASTRE',
  'CRIT-OBJETIVO',
  'CRIT-OVERLAY',
  'CRIT-ESCENA-DOM',
  'CRIT-NOTACION',
  'CRIT-MOVIMIENTO',
  'CRIT-PALABRA',
  'CRIT-AYUDAS-TECNICAS',
] as const;
export type A11yCriterionId = (typeof A11Y_CRITERION_IDS)[number];

export interface A11yCriterion {
  readonly id: A11yCriterionId;
  /** Enunciado literal, en los términos de la norma que lo exige. */
  readonly statement: string;
  /** De dónde sale. Se cita para que nadie tenga que adivinar la autoridad. */
  readonly source: string;
  /** Superficies sin las cuales el criterio no se puede verificar. */
  readonly requires: readonly A11ySurface[];
  /**
   * Si la norma **anticipa** una excepción para este criterio. Sólo el Maestro
   * la menciona, y sólo para el arrastre: «con excepción documentada si una
   * acción del pizarrón es esencial». Marcarlo no impide documentar otras —el
   * cierre de §10.5 habla de «excepciones conocidas» en general— pero deja ver
   * cuál estaba prevista y cuál es hallazgo nuestro.
   */
  readonly exceptionAnticipated: boolean;
}

/**
 * Los once criterios, unión de Maestro §10.5 y UIUX §8.
 *
 * El Maestro lista ocho y UIUX diez; no son la misma lista. UIUX añade reducción
 * de movimiento y comunicación por palabra, que el Maestro no enumera, y separa
 * en dos el punto que el Maestro junta —foco visible y trampas de teclado—. Se
 * separan también aquí porque **se verifican con instrumentos distintos**: el foco
 * con una regla de estilo, la trampa recorriendo el foco con el teclado.
 */
export const A11Y_BASELINE_CRITERIA: readonly A11yCriterion[] = [
  {
    id: 'CRIT-TECLADO',
    statement:
      'Editor Fitch y controles críticos —micrófono, pistas, pausa, apelación y retirada— ' +
      'operables por teclado.',
    source: 'Maestro §10.5; UIUX §8',
    requires: ['editor-fitch', 'controles-de-sesion'],
    exceptionAnticipated: false,
  },
  {
    id: 'CRIT-FOCO',
    statement: 'Foco visible y no oscurecido.',
    source: 'Maestro §10.5; UIUX §8',
    requires: ['editor-fitch', 'controles-de-sesion'],
    exceptionAnticipated: false,
  },
  {
    id: 'CRIT-SIN-TRAMPAS',
    statement: 'Ausencia de trampas de teclado.',
    source: 'Maestro §10.5; UIUX §8',
    requires: ['editor-fitch', 'controles-de-sesion'],
    exceptionAnticipated: false,
  },
  {
    id: 'CRIT-ARRASTRE',
    statement:
      'Alternativa a gestos de arrastre cuando el control crítico la requiera, con excepción ' +
      'documentada si una acción del pizarrón es esencial.',
    source: 'Maestro §10.5; UIUX §8',
    requires: ['pizarron'],
    exceptionAnticipated: true,
  },
  {
    id: 'CRIT-OBJETIVO',
    statement:
      'Objetivos interactivos compatibles con WCAG 2.2 SC 2.5.8 (24×24 px CSS) o alternativa ' +
      'permitida por el criterio.',
    source: 'Maestro §10.5; UIUX §8',
    requires: ['editor-fitch', 'controles-de-sesion'],
    exceptionAnticipated: false,
  },
  {
    id: 'CRIT-OVERLAY',
    statement:
      'Overlay SVG no interactivo para tecnología asistiva (aria-hidden / sin captura de ' +
      'eventos) y equivalente textual de la anotación.',
    source: 'Maestro §10.5; UIUX §8',
    requires: ['overlay-anotaciones'],
    exceptionAnticipated: false,
  },
  {
    id: 'CRIT-ESCENA-DOM',
    statement: 'Representación DOM navegable de la escena estructurada del pizarrón.',
    source: 'Maestro §10.5; UIUX §8',
    requires: ['pizarron'],
    exceptionAnticipated: false,
  },
  {
    id: 'CRIT-NOTACION',
    statement:
      'Notación lógica expuesta semánticamente, preferentemente MathML con capa de ' +
      'compatibilidad cuando sea necesaria.',
    source: 'Maestro §10.5; UIUX §8',
    requires: ['notacion-logica'],
    exceptionAnticipated: false,
  },
  {
    id: 'CRIT-MOVIMIENTO',
    statement: 'Reducción de movimiento respetada (prefers-reduced-motion).',
    source: 'UIUX §8',
    requires: ['transcripcion-y-profesor'],
    exceptionAnticipated: false,
  },
  {
    id: 'CRIT-PALABRA',
    statement: 'Estados comunicados por palabra además de color o movimiento.',
    source: 'UIUX §3, §8',
    requires: ['controles-de-sesion', 'transcripcion-y-profesor'],
    exceptionAnticipated: false,
  },
  {
    id: 'CRIT-AYUDAS-TECNICAS',
    statement:
      'Registro de ayudas técnicas y configuraciones relevantes del participante, para separar ' +
      'barreras de interfaz de errores de contenido.',
    source: 'Maestro §10.5; P-I §8.9.3',
    // No depende de ninguna superficie de la vista: es un dato de la corrida.
    requires: [],
    exceptionAnticipated: false,
  },
];

/* ────────────────────────────────────────────────────────────────────────────
 * Dictámenes
 * ──────────────────────────────────────────────────────────────────────────── */

export type A11yStatus = 'verificado' | 'no_verificado' | 'excepcion';

/**
 * Lo que se declara sobre un criterio.
 *
 * `checks` son los nombres de los instrumentos que lo comprueban —por ejemplo
 * `ci:a11y:baseline#target-size`—. `note` explica el motivo cuando no está
 * verificado, o justifica la excepción.
 */
export interface A11yClaim {
  readonly criterionId: A11yCriterionId;
  readonly status: A11yStatus;
  readonly checks: readonly string[];
  readonly note: string;
}

export interface A11yRuling extends A11yClaim {
  readonly statement: string;
  readonly source: string;
  /** Superficies exigidas que no están montadas. Vacío si están todas. */
  readonly missingSurfaces: readonly A11ySurface[];
}

export type A11yBaselineErrorCode =
  | 'CRITERIO_DESCONOCIDO'
  | 'CRITERIO_SIN_DICTAMEN'
  | 'DICTAMEN_DUPLICADO'
  | 'SUPERFICIE_DESCONOCIDA'
  | 'SUPERFICIE_SIN_DECLARAR'
  | 'VERIFICADO_SIN_CHECK'
  | 'VERIFICADO_SIN_SUPERFICIE'
  | 'MOTIVO_AUSENTE';

export class A11yBaselineError extends Error {
  readonly code: A11yBaselineErrorCode;

  constructor(code: A11yBaselineErrorCode, detail: string) {
    super(detail);
    this.name = 'A11yBaselineError';
    this.code = code;
  }
}

export interface A11yBaselineInput {
  readonly surfaces: readonly SurfacePresence[];
  readonly claims: readonly A11yClaim[];
}

export interface A11yBaselineReport {
  readonly rulings: readonly A11yRuling[];
  readonly verified: readonly A11yCriterionId[];
  readonly notVerified: readonly A11yCriterionId[];
  readonly exceptions: readonly A11yCriterionId[];
  /**
   * No es un booleano a propósito. El Maestro §10.5 cierra diciendo que el
   * proyecto no declara conformidad WCAG 2.2 AA global sin auditoría criterio por
   * criterio, y un `false` de hoy es el `true` sin auditar de dentro de un año.
   * Aquí no hay dónde escribirlo.
   */
  readonly wcagGlobalConformance: 'no_declarada';
}

/**
 * Construye el informe de la línea base, o lanza.
 *
 * Exige dictamen para **los once** criterios: dejar uno fuera lo haría
 * desaparecer del informe en silencio, que es peor que declararlo no verificado.
 */
export function buildAccessibilityBaseline(input: A11yBaselineInput): A11yBaselineReport {
  const surfaceState = new Map<A11ySurface, SurfacePresence>();
  for (const entry of input.surfaces) {
    if (!(A11Y_SURFACES as readonly string[]).includes(entry.surface)) {
      throw new A11yBaselineError(
        'SUPERFICIE_DESCONOCIDA',
        `«${entry.surface}» no es una superficie de la línea base. La lista es cerrada.`,
      );
    }
    surfaceState.set(entry.surface, entry);
  }
  for (const surface of A11Y_SURFACES) {
    if (!surfaceState.has(surface)) {
      throw new A11yBaselineError(
        'SUPERFICIE_SIN_DECLARAR',
        `falta declarar si «${surface}» está montada. Sin saberlo no se puede decidir si un ` +
          `criterio se verificó o si el instrumento miró una página vacía.`,
      );
    }
  }

  const byCriterion = new Map<A11yCriterionId, A11yClaim>();
  for (const claim of input.claims) {
    if (!(A11Y_CRITERION_IDS as readonly string[]).includes(claim.criterionId)) {
      throw new A11yBaselineError(
        'CRITERIO_DESCONOCIDO',
        `«${claim.criterionId}» no es un criterio de la línea base. La lista es cerrada.`,
      );
    }
    if (byCriterion.has(claim.criterionId)) {
      throw new A11yBaselineError(
        'DICTAMEN_DUPLICADO',
        `${claim.criterionId} trae dos dictámenes. Con dos, el informe diría lo que diga el ` +
          `último en llegar.`,
      );
    }
    byCriterion.set(claim.criterionId, claim);
  }

  const rulings: A11yRuling[] = [];

  for (const criterion of A11Y_BASELINE_CRITERIA) {
    const claim = byCriterion.get(criterion.id);
    if (claim === undefined) {
      throw new A11yBaselineError(
        'CRITERIO_SIN_DICTAMEN',
        `${criterion.id} no tiene dictamen. Un criterio ausente del informe no es un criterio ` +
          `aprobado: es uno que nadie miró, y hay que decirlo.`,
      );
    }

    const missingSurfaces = criterion.requires.filter(
      (surface) => surfaceState.get(surface)?.present !== true,
    );

    if (claim.status === 'verificado') {
      if (claim.checks.length === 0) {
        throw new A11yBaselineError(
          'VERIFICADO_SIN_CHECK',
          `${criterion.id} se declara verificado sin nombrar ningún check. La prosa no ` +
            `verifica: sin instrumento, «verificado» sólo dice que alguien lo escribió.`,
        );
      }
      if (missingSurfaces.length > 0) {
        throw new A11yBaselineError(
          'VERIFICADO_SIN_SUPERFICIE',
          `${criterion.id} se declara verificado, pero ${missingSurfaces.join(', ')} no está ` +
            `montada. Un check sobre una superficie ausente no encuentra problemas, y ese ` +
            `silencio es indistinguible de haberla verificado.`,
        );
      }
    } else if (claim.note.trim() === '') {
      throw new A11yBaselineError(
        'MOTIVO_AUSENTE',
        `${criterion.id} se declara «${claim.status}» sin motivo. El Maestro §10.5 pide ` +
          `registrar criterios no verificados y excepciones, no sólo contarlos.`,
      );
    }

    rulings.push({
      ...claim,
      statement: criterion.statement,
      source: criterion.source,
      missingSurfaces,
    });
  }

  const idsWith = (status: A11yStatus): readonly A11yCriterionId[] =>
    rulings.filter((r) => r.status === status).map((r) => r.criterionId);

  return {
    rulings,
    verified: idsWith('verificado'),
    notVerified: idsWith('no_verificado'),
    exceptions: idsWith('excepcion'),
    wcagGlobalConformance: 'no_declarada',
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Registro de ayudas técnicas del participante
 * ──────────────────────────────────────────────────────────────────────────── */

/** Lista cerrada; `otra` obliga a describir en `name`. */
export const ASSISTIVE_TECHNOLOGY_KINDS = [
  'lector_de_pantalla',
  'magnificador',
  'teclado_alternativo',
  'reconocimiento_de_voz',
  'alto_contraste',
  'tamano_de_texto_aumentado',
  'reduccion_de_movimiento',
  'otra',
] as const;
export type AssistiveTechnologyKind = (typeof ASSISTIVE_TECHNOLOGY_KINDS)[number];

export interface AssistiveTechnology {
  readonly kind: AssistiveTechnologyKind;
  /** Nombre y versión tal como los declaró el participante. */
  readonly name: string;
  readonly notes: string;
}

/**
 * Lo que se preguntó al participante y lo que contestó.
 *
 * Que este objeto exista significa **que se preguntó**. `technologies: []` es una
 * respuesta —«no uso ninguna»—; la ausencia del registro entero es otra cosa muy
 * distinta, y por eso {@link canRuleOutAccessibilityBarrier} las trata distinto.
 */
export interface AssistiveTechnologyRecord {
  readonly participantId: string;
  readonly recordedAt: string;
  readonly technologies: readonly AssistiveTechnology[];
}

export type BarrierRuling =
  | { readonly canRuleOut: true; readonly rationale: string }
  | { readonly canRuleOut: false; readonly reason: 'sin_registro'; readonly rationale: string }
  | {
      readonly canRuleOut: false;
      readonly reason: 'ayudas_declaradas';
      readonly technologies: readonly AssistiveTechnologyKind[];
      readonly rationale: string;
    };

/**
 * ¿Se puede dar por descartada una barrera de accesibilidad en este intento?
 *
 * Es la pieza que le falta a {@link ./failure-attribution.js#classifyFailure}: allí
 * el descarte de `ACCESSIBILITY_ERROR` exige evidencia, y ésta es la evidencia.
 *
 * Tres respuestas, y las tres importan:
 *
 * - **Sin registro** → no se puede descartar. Nadie preguntó, así que «no había
 *   barrera» es una suposición; y una suposición aquí acaba contada como fallo
 *   conceptual, o sea anotada como algo que el alumno no sabía.
 * - **Con ayudas declaradas** → tampoco se descarta de oficio. Que el alumno use
 *   lector de pantalla no prueba que hubiera barrera, pero sí obliga a mirar antes
 *   de decir que no la hubo.
 * - **Registro con lista vacía** → se puede descartar: se preguntó y no usa
 *   ninguna.
 */
export function canRuleOutAccessibilityBarrier(
  record: AssistiveTechnologyRecord | undefined,
): BarrierRuling {
  if (record === undefined) {
    return {
      canRuleOut: false,
      reason: 'sin_registro',
      rationale:
        'no hay registro de ayudas técnicas del participante. Ausente y «ninguna» no son lo ' +
        'mismo: sin haber preguntado, descartar la barrera es adivinar, y el fallo acabaría ' +
        'imputado al KC del alumno.',
    };
  }

  if (record.technologies.length > 0) {
    return {
      canRuleOut: false,
      reason: 'ayudas_declaradas',
      technologies: record.technologies.map((t) => t.kind),
      rationale:
        `el participante ${record.participantId} declaró ${String(record.technologies.length)} ` +
        `ayuda(s) técnica(s). No prueba que hubiera barrera, pero obliga a mirarlo antes de ` +
        `decir que no la hubo.`,
    };
  }

  return {
    canRuleOut: true,
    rationale:
      `se preguntó al participante ${record.participantId} el ${record.recordedAt} y declaró no ` +
      `usar ayudas técnicas`,
  };
}
