/**
 * Puerta de no revelación (T-H7-03 ← P-I §9.6, con P-I §9.4 y §8.6).
 *
 * P-I §9.6 es literal y son cuatro condiciones. Una actividad puntuable se
 * ejecuta en modo de no revelación:
 *
 *  1. sin solución en contexto;
 *  2. sin ejemplos isomorfos inmediatos;
 *  3. sin pistas que completen el paso decisivo;
 *  4. sin retroalimentación hasta cerrar el intento cuando sea una sonda.
 *
 * ## Esta puerta no recalcula nada: se niega a entregar lo que no tiene respaldo
 *
 * Las dos condiciones que parecerían exigir análisis —isomorfismo y «paso
 * decisivo»— **ya están decididas aguas arriba y con evidencia**: el banco de
 * pistas guarda `facts.containsDecisiveContent` y
 * `analogousExampleEvidence.nonIsomorphic`, validados por el pipeline de autoría
 * y amarrados a un hash de contenido. Volver a decidirlos aquí, en vivo y con
 * otra implementación, crearía una segunda autoridad sobre el mismo hecho — y
 * cuando dos autoridades discrepan, gana la que corre más tarde, que es la peor
 * forma de elegir.
 *
 * Así que el trabajo de esta puerta es el contrario: **exigir la evidencia**.
 * Una pista de nivel 4 sin prueba de no isomorfismo no se entrega, no porque se
 * haya demostrado que es isomorfa, sino porque nadie demostró que no lo es. En
 * una actividad puntuable, la carga de la prueba va de ese lado.
 *
 * ## El filtro de egreso tiene que haber corrido, y eso se exige aquí
 *
 * P-I §9.4 lo pide «antes de enviar información al modelo». La tarea pide que
 * esté **activo en cada llamada**, y hasta ahora el detector de canarios era un
 * parámetro opcional de `buildSessionContext`: si nadie lo pasaba, la
 * comprobación no corría y nada lo decía. Un filtro que puede estar ausente en
 * silencio no es un filtro. La puerta exige el comprobante.
 *
 * ## Lo que esta puerta no puede hacer, y no finge hacer
 *
 * No detecta paráfrasis. El banco de pistas ya lo declara —
 * `detectionScope: 'literal_not_paraphrase'` y `paraphraseAuditRequired: true`—
 * y esta puerta no mejora eso: hereda el alcance de la evidencia que exige. Una
 * pista que reformule la solución con otras palabras y traiga sus banderas en
 * falso pasa. Por eso la auditoría de paráfrasis sigue siendo humana y sigue
 * siendo obligatoria.
 */

/** Causas de bloqueo, una por condición literal de P-I §9.6. */
export const NON_REVELATION_BLOCKS = [
  'solucion_en_contexto',
  'ejemplo_isomorfo_inmediato',
  'pista_completa_paso_decisivo',
  'retroalimentacion_antes_de_cerrar_sonda',
  'filtro_de_egreso_no_aplicado',
] as const;
export type NonRevelationBlock = (typeof NON_REVELATION_BLOCKS)[number];

export interface NonRevelationFinding {
  readonly block: NonRevelationBlock;
  readonly detail: string;
  /** La autoridad literal de la que sale, como en `doubt.ts`. */
  readonly authority: string;
}

/**
 * Comprobante de que el filtro de egreso corrió sobre este contexto. Es un
 * objeto y no un booleano suelto para que no se pueda satisfacer escribiendo
 * `true`: quien lo construye tiene que declarar **qué** comprobó.
 */
export interface EgressFilterReceipt {
  readonly canaryDetectorApplied: boolean;
  readonly fragmentsCheckedAgainstBlock: boolean;
  readonly helpLevelChecked: boolean;
}

/**
 * Pista candidata, con los hechos que el banco validó en autoría. Se copian tal
 * cual: esta puerta no los recalcula (ver cabecera).
 */
export interface CandidateHint {
  readonly hintId: string;
  readonly level: number;
  readonly containsDecisiveContent: boolean;
  /**
   * `true` sólo si el banco guarda evidencia del canonicalizador de que el
   * ejemplo análogo **no** es isomorfo. `false` incluye el caso «no hay
   * evidencia», que es distinto de «se comprobó que es isomorfo» y aquí se trata
   * igual: sin prueba no sale.
   */
  readonly nonIsomorphismProven: boolean;
  /** El nivel 4 de P-I §8.6 es «ejemplo análogo no isomorfo». */
  readonly isAnalogousExample: boolean;
}

export interface NonRevelationInput {
  /**
   * `null` cuando no hay actividad puntuable abierta. §9.6 gobierna **la
   * actividad puntuable**; fuera de ella no dice nada y esta puerta tampoco.
   */
  readonly scorableActivity: {
    readonly activityId: string;
    readonly isProbe: boolean;
    readonly attemptClosed: boolean;
  } | null;
  readonly egressFilter: EgressFilterReceipt;
  readonly hint: CandidateHint | null;
  /** ¿La operación pretende entregar retroalimentación al alumno? */
  readonly deliversFeedback: boolean;
  /**
   * Identificadores de canario detectados en el contexto ya construido. Vacío
   * es el caso normal; no vacío significa que una solución llegó al contexto.
   */
  readonly canaryHits: readonly string[];
}

export type NonRevelationVerdict =
  | { readonly outcome: 'allowed' }
  | { readonly outcome: 'blocked'; readonly findings: readonly NonRevelationFinding[] };

const AUTORIDAD = {
  solucion: 'P-I §9.6: una actividad puntuable se ejecuta «sin solución en contexto»',
  isomorfo: 'P-I §9.6: «sin ejemplos isomorfos inmediatos»; nivel 4 de P-I §8.6 es «ejemplo análogo no isomorfo»',
  decisivo: 'P-I §9.6: «sin pistas que completen el paso decisivo»',
  feedback:
    'P-I §9.6: «sin retroalimentación hasta cerrar el intento cuando sea una sonda»',
  egreso: 'P-I §9.4: el filtro de egreso se aplica «antes de enviar información al modelo»',
} as const;

/**
 * Decide si la operación puede salir en modo de no revelación.
 *
 * **Recoge todas las causas.** Devolver la primera haría creer que arreglarla
 * basta, y aquí cada causa es una fuga distinta.
 *
 * **Falla cerrado por construcción**: no hay ninguna rama que devuelva
 * `allowed` ante una duda. La ausencia de evidencia bloquea igual que la
 * evidencia en contra, porque en una actividad puntuable la carga de la prueba
 * está del lado de quien quiere entregar.
 */
export function checkNonRevelation(input: NonRevelationInput): NonRevelationVerdict {
  const findings: NonRevelationFinding[] = [];

  // Fuera de una actividad puntuable, §9.6 no gobierna. El filtro de egreso sí,
  // pero eso lo comprueba `buildSessionContext` en cada construcción.
  if (input.scorableActivity === null) return { outcome: 'allowed' };

  const actividad = input.scorableActivity;

  if (
    !input.egressFilter.canaryDetectorApplied ||
    !input.egressFilter.fragmentsCheckedAgainstBlock ||
    !input.egressFilter.helpLevelChecked
  ) {
    findings.push({
      block: 'filtro_de_egreso_no_aplicado',
      detail:
        `la actividad puntuable ${actividad.activityId} no trae comprobante completo del filtro ` +
        `de egreso (canarios=${input.egressFilter.canaryDetectorApplied}, ` +
        `bloque=${input.egressFilter.fragmentsCheckedAgainstBlock}, ` +
        `ayuda=${input.egressFilter.helpLevelChecked})`,
      authority: AUTORIDAD.egreso,
    });
  }

  if (input.canaryHits.length > 0) {
    findings.push({
      block: 'solucion_en_contexto',
      detail: `canarios en el contexto de una actividad puntuable: ${input.canaryHits.join(', ')}`,
      authority: AUTORIDAD.solucion,
    });
  }

  const pista = input.hint;
  if (pista !== null) {
    if (pista.containsDecisiveContent) {
      findings.push({
        block: 'pista_completa_paso_decisivo',
        detail:
          `la pista ${pista.hintId} (nivel ${pista.level}) trae ` +
          `containsDecisiveContent=true del banco validado`,
        authority: AUTORIDAD.decisivo,
      });
    }
    if (pista.isAnalogousExample && !pista.nonIsomorphismProven) {
      findings.push({
        block: 'ejemplo_isomorfo_inmediato',
        detail:
          `la pista ${pista.hintId} es un ejemplo análogo y el banco no guarda evidencia del ` +
          `canonicalizador de que no sea isomorfo: sin prueba no sale`,
        authority: AUTORIDAD.isomorfo,
      });
    }
  }

  // La cuarta condición está acotada a las sondas **en su letra**: «cuando sea
  // una sonda». No se extiende a toda actividad puntuable, porque extenderla
  // sería legislar de más sobre un texto que distingue los dos casos a
  // propósito.
  if (actividad.isProbe && !actividad.attemptClosed && input.deliversFeedback) {
    findings.push({
      block: 'retroalimentacion_antes_de_cerrar_sonda',
      detail:
        `la sonda ${actividad.activityId} tiene el intento abierto y la operación entregaría ` +
        `retroalimentación`,
      authority: AUTORIDAD.feedback,
    });
  }

  return findings.length > 0 ? { outcome: 'blocked', findings } : { outcome: 'allowed' };
}
