/**
 * Autoridad de evaluación por dominio
 * (T-CC-04 `CRITICAL` ← P-I §3.1.2 y §16.3; `DEC-CUSTOM-COURSES-001`).
 *
 * ## La frase que este módulo hace cumplir
 *
 * «Cuando el dominio no disponga de un verificador determinista específico, la
 * evaluación se limita a mecanismos compatibles con la autoridad disponible y
 * **no finge equivalencia con `logic-core`**.»
 *
 * Fingir equivalencia no es un acto deliberado: es lo que pasa solo. Alguien
 * necesita evaluar una respuesta de historia, no hay verificador, y devuelve
 * `{ valid: false }` porque es la forma que ya existe en el sistema. A partir de
 * ahí, un juicio sin autoridad viaja por las mismas tuberías, se pinta con el
 * mismo color y se registra con el mismo nombre que un veredicto del cálculo
 * congelado. Nadie mintió y el resultado es indistinguible de una mentira.
 *
 * ## Por eso la forma del resultado cambia con la autoridad
 *
 * {@link DomainEvaluation} es una unión discriminada en la que la rama sin
 * autoridad formal **no tiene dónde escribir un veredicto**: no hay campo
 * `valid`, ni `verdict`, ni `correct`. No es que esté prohibido rellenarlo — es
 * que no existe. Un compilador vigila eso mejor que una revisión.
 *
 * ## El LLM-juez no es el sustituto por omisión
 *
 * El plan lo dice literal: «sin LLM-juez como sustituto por defecto». La palabra
 * que importa es *defecto*: no queda prohibido para siempre, queda fuera hasta
 * que una especificación posterior lo autorice. {@link llmJudgeAuthorization}
 * **lanza** salvo que se le pase esa autorización con su referencia normativa —
 * el mismo patrón que `assertPackageMayCrownWinner()` y que los valores
 * `[CALIBRATION]`: el punto de fallo es donde se enchufa la decisión que falta,
 * no un hueco que alguien rellene con lo plausible.
 */

export type EvaluationAuthorityErrorCode =
  | 'SIN_AUTORIDAD_FORMAL'
  | 'VERIFICADOR_NO_REGISTRADO'
  | 'LLM_JUEZ_SIN_AUTORIZACION';

export class EvaluationAuthorityError extends Error {
  readonly code: EvaluationAuthorityErrorCode;

  constructor(code: EvaluationAuthorityErrorCode, detail: string) {
    super(detail);
    this.name = 'EvaluationAuthorityError';
    this.code = code;
  }
}

/**
 * Los dos niveles que la norma distingue. No hay un tercero intermedio.
 *
 * La tentación sería un `partial_authority` para lo que «casi» verifica. Sería
 * el agujero: todo lo que no verifica acabaría ahí, y «casi» es exactamente la
 * equivalencia fingida que P-I §3.1.2 prohíbe.
 */
export const EVALUATION_AUTHORITIES = ['deterministic_verifier', 'no_formal_authority'] as const;
export type EvaluationAuthority = (typeof EVALUATION_AUTHORITIES)[number];

/**
 * Registro de verificadores deterministas.
 *
 * Hoy tiene **uno**, y esa escasez es el estado real del sistema, no una
 * simplificación: `logic-core` sobre `authorized-calculus-v1` es el único
 * verificador determinista que existe. Un dominio que no esté aquí no tiene
 * autoridad formal, y añadirlo exige escribir el verificador, no la entrada.
 */
const VERIFICADORES: Readonly<Record<string, string>> = Object.freeze({
  'authorized-calculus-v1': 'logic-core',
});

/** ¿Qué autoridad tiene este dominio? Total y sin adivinar. */
export function evaluationAuthorityFor(domainId: string): EvaluationAuthority {
  return Object.hasOwn(VERIFICADORES, domainId)
    ? 'deterministic_verifier'
    : 'no_formal_authority';
}

/** Dominios con verificador, para que las pruebas los recorran. */
export function verifiedDomains(): readonly string[] {
  return Object.keys(VERIFICADORES);
}

/**
 * Lo que se observa cuando no hay autoridad formal.
 *
 * Son descripciones de lo ocurrido, no juicios de corrección: se puede decir que
 * el alumno respondió, cuánto tardó y qué pidió, sin afirmar que acertó.
 */
export const UNVERIFIED_OBSERVATIONS = [
  'response_recorded',
  'self_reported_confidence',
  'time_on_task',
  'assistance_requested',
] as const;
export type UnverifiedObservation = (typeof UNVERIFIED_OBSERVATIONS)[number];

/**
 * Resultado de evaluar en un dominio.
 *
 * La asimetría entre las dos ramas **es** la tarea. Con verificador hay
 * veredicto —y lo emite el verificador, no este módulo—. Sin verificador hay
 * observación y `formalVerdict: null`, que se escribe explícito porque un campo
 * ausente diría «no se registró» y este dice «no lo hay, y no puede haberlo».
 */
export type DomainEvaluation =
  | {
      readonly authority: 'deterministic_verifier';
      readonly domainId: string;
      readonly verifierId: string;
      /** Lo emite el verificador; aquí sólo viaja. */
      readonly verdictRef: string;
    }
  | {
      readonly authority: 'no_formal_authority';
      readonly domainId: string;
      readonly observations: readonly UnverifiedObservation[];
      readonly formalVerdict: null;
      /**
       * Texto que la UI debe mostrar junto al resultado. Es obligatorio porque
       * un resultado sin autoridad presentado a secas se lee como veredicto.
       */
      readonly disclaimer: string;
    };

const DESCARGO =
  'Materia funcional no validada por el experimento de lógica: esta respuesta no recibe ' +
  'veredicto formal.';

/**
 * Evalúa según lo que el dominio permite.
 *
 * No recibe la respuesta del alumno, y eso es lo que la firma dice: este módulo
 * no juzga nada. Decide **quién puede juzgar** y con qué forma sale el
 * resultado.
 */
export function evaluateInDomain(input: {
  readonly domainId: string;
  readonly verdictRef?: string;
  readonly observations?: readonly UnverifiedObservation[];
}): DomainEvaluation {
  const authority = evaluationAuthorityFor(input.domainId);
  if (authority === 'deterministic_verifier') {
    const verifierId = VERIFICADORES[input.domainId] as string;
    if (input.verdictRef === undefined) {
      throw new EvaluationAuthorityError(
        'VERIFICADOR_NO_REGISTRADO',
        `«${input.domainId}» tiene verificador (${verifierId}) y la evaluación llegó sin ` +
          `veredicto. Emitir uno aquí sería un segundo verificador fuera de la única ruta de ` +
          `verificación.`,
      );
    }
    return {
      authority,
      domainId: input.domainId,
      verifierId,
      verdictRef: input.verdictRef,
    };
  }
  return {
    authority,
    domainId: input.domainId,
    observations: input.observations ?? ['response_recorded'],
    formalVerdict: null,
    disclaimer: DESCARGO,
  };
}

/**
 * Puerta hacia cualquier cosa que se presente como veredicto formal.
 *
 * **Lanza** para un dominio sin verificador. La llaman las superficies que
 * pintan corrección —la vista de Clase, la exportación, el expediente—, y su
 * mensaje nombra la decisión para que quien lo vea entienda que no es un fallo
 * técnico.
 */
export function assertMayEmitFormalVerdict(domainId: string): void {
  if (evaluationAuthorityFor(domainId) === 'no_formal_authority') {
    throw new EvaluationAuthorityError(
      'SIN_AUTORIDAD_FORMAL',
      `«${domainId}» no tiene verificador determinista, así que no hay veredicto formal que ` +
        `emitir (P-I §3.1.2). Devolver aquí un «válido/inválido» fingiría equivalencia con ` +
        `\`logic-core\`: el juicio viajaría por las mismas tuberías y se registraría con el mismo ` +
        `nombre que uno del cálculo congelado, y sería indistinguible sin que nadie mintiera. ` +
        `Con verificador: ${verifiedDomains().join(', ')}.`,
    );
  }
}

/**
 * Autorización explícita para usar un LLM como juez en un dominio.
 *
 * Existe como tipo para que la autorización que falta tenga forma, y la única
 * forma de obtenerla sea citando la especificación que la concede.
 */
export interface LlmJudgeAuthorization {
  readonly domainId: string;
  /** Referencia normativa que lo autoriza. Sin ella no hay autorización. */
  readonly authorizedBySpec: string;
}

/**
 * **Lanza** salvo que exista autorización normativa.
 *
 * Es el punto de fallo donde se enchufa la decisión que hoy no está tomada, y
 * por eso no devuelve `false` ni un juez degradado: un sustituto silencioso es
 * exactamente lo que «sin LLM-juez como sustituto **por defecto**» descarta.
 */
export function llmJudgeAuthorization(
  domainId: string,
  autorizacion?: LlmJudgeAuthorization,
): LlmJudgeAuthorization {
  if (
    autorizacion === undefined ||
    autorizacion.domainId !== domainId ||
    autorizacion.authorizedBySpec.trim() === ''
  ) {
    throw new EvaluationAuthorityError(
      'LLM_JUEZ_SIN_AUTORIZACION',
      `Un LLM no es el sustituto por omisión del verificador en «${domainId}» (P-I §3.1.2, ` +
        `§16.3). Queda fuera hasta que una especificación posterior lo autorice citando su ` +
        `referencia; este punto de fallo es donde esa decisión se enchufa, no un hueco que ` +
        `rellenar con lo plausible.`,
    );
  }
  return autorizacion;
}
