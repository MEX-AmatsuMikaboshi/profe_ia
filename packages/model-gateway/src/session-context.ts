import type { PedagogicalMode, PedagogicalStrategy } from '@profesor-ia/contracts';
import {
  CanaryHitError,
  FragmentOutsideBlockError,
  HelpLevelExceededError,
  MissingEgressFilterError,
  UndeclaredStateKeyError,
} from './errors.js';

/**
 * Constructor de contexto de sesión por whitelist y filtro de egreso
 * (T-H4-04 ← P-II §8.3 y P-I §9.4).
 *
 * Dos ideas sostienen esto:
 *
 * 1. **La whitelist es la estructura, no una comprobación.** El contexto se
 *    arma copiando exactamente los ocho campos que P-II §8.3 autoriza. No hay
 *    un «resto» que pudiera colarse, porque no se copia nada más.
 * 2. **No consulta soluciones porque no puede.** Este módulo no recibe ninguna
 *    fuente de datos: todo entra por parámetro. Que `model-gateway` no alcance
 *    `solutions-private` lo impone además la regla depcruise del invariante I-2,
 *    no un prompt (P-I §9.3: «mediante procesos, credenciales y permisos, no
 *    solo mediante prompts»).
 */

/** Fragmento autorizado, con el bloque al que pertenece (P-I §9.4). */
export interface AuthorizedFragment {
  readonly fragmentId: string;
  readonly blockId: string;
  readonly text: string;
}

/** Pista ya seleccionada por el motor, con su nivel de ayuda. */
export interface SelectedHint {
  readonly hintId: string;
  readonly helpLevel: number;
  readonly text: string;
}

/** Error del alumno ya estructurado por el motor; nunca texto libre del modelo. */
export interface StructuredError {
  readonly code: string;
  readonly stepNumber: number | null;
}

export interface SessionContextInput {
  readonly blockId: string;
  readonly authorizedFragments: readonly AuthorizedFragment[];
  /**
   * Estado mínimo. P-II §8.3 lo nombra sin definirlo, así que en vez de fijar un
   * esquema por cuenta propia se copia **solo** lo que `minimalStateKeys`
   * declare: una whitelist dentro de la whitelist. Una clave no declarada es un
   * fallo, no un campo que se ignora en silencio — ignorarlo escondería que
   * alguien intentó meter algo en el contexto.
   */
  readonly minimalState: Readonly<Record<string, string | number | boolean>>;
  readonly minimalStateKeys: readonly string[];
  readonly goal: string;
  readonly mode: PedagogicalMode;
  readonly strategy: PedagogicalStrategy;
  readonly allowedHelpLevel: number;
  readonly structuredError: StructuredError | null;
  readonly selectedHint: SelectedHint | null;
  /**
   * ¿Hay una actividad puntuable abierta? (T-H7-03 ← P-I §9.6). Es obligatorio
   * y no tiene valor por omisión: un `false` implícito dejaría el modo de no
   * revelación apagado por olvido, que es exactamente como se pierden estas
   * garantías.
   */
  readonly scorableActivityOpen: boolean;
}

/**
 * Contexto ya filtrado. Los ocho campos de P-II §8.3, y **ningún
 * identificador**: la whitelist no tiene campo para uno, que es la forma
 * estructural de cumplir «sin identificadores personales innecesarios».
 */
export interface SessionContext {
  readonly blockId: string;
  readonly fragments: readonly string[];
  readonly minimalState: Readonly<Record<string, string | number | boolean>>;
  readonly goal: string;
  readonly mode: PedagogicalMode;
  readonly strategy: PedagogicalStrategy;
  readonly allowedHelpLevel: number;
  readonly structuredError: StructuredError | null;
  readonly hint: { readonly helpLevel: number; readonly text: string } | null;
}

/**
 * Detector de cadenas canario. Lo llena T-H4-05 (`security-policy`); aquí entra
 * como parámetro para que el filtro de egreso ya tenga su punto de enganche y
 * no haya que reabrir esta ruta después.
 */
export type CanaryDetector = (payload: string) => readonly string[];

export interface BuildSessionContextOptions {
  readonly canaryDetector?: CanaryDetector;
}

/**
 * Construye el contexto aplicando el filtro de egreso de P-I §9.4.
 *
 * Comprueba, en este orden: pertenencia del fragmento al bloque, nivel de ayuda
 * permitido, claves de estado declaradas y ausencia de cadenas canario sobre el
 * **payload ya serializado** — que es el único sitio donde tiene sentido
 * mirarlo, porque es lo que de verdad saldría hacia el proveedor.
 */
export function buildSessionContext(
  input: SessionContextInput,
  options: BuildSessionContextOptions = {},
): SessionContext {
  for (const fragmento of input.authorizedFragments) {
    if (fragmento.blockId !== input.blockId) {
      throw new FragmentOutsideBlockError(
        `El fragmento ${fragmento.fragmentId} pertenece al bloque ${fragmento.blockId} y el ` +
          `contexto es del bloque ${input.blockId}. No sale del bloque (P-I §9.4).`,
      );
    }
  }

  if (input.selectedHint !== null && input.selectedHint.helpLevel > input.allowedHelpLevel) {
    throw new HelpLevelExceededError(
      `La pista ${input.selectedHint.hintId} tiene nivel de ayuda ${input.selectedHint.helpLevel} ` +
        `y el permitido es ${input.allowedHelpLevel} (P-I §9.4).`,
    );
  }

  const declaradas = new Set(input.minimalStateKeys);
  const estado: Record<string, string | number | boolean> = {};
  for (const [clave, valor] of Object.entries(input.minimalState)) {
    if (!declaradas.has(clave)) {
      throw new UndeclaredStateKeyError(
        `La clave de estado ${clave} no está declarada en minimalStateKeys. El contexto se arma ` +
          `por whitelist (P-II §8.3): una clave no declarada no viaja, y tampoco se ignora en ` +
          `silencio.`,
      );
    }
    estado[clave] = valor;
  }

  // Se copian **solo** los ocho campos autorizados. No hay difusión de lo demás.
  const contexto: SessionContext = {
    blockId: input.blockId,
    fragments: input.authorizedFragments.map((f) => f.text),
    minimalState: Object.freeze(estado),
    goal: input.goal,
    mode: input.mode,
    strategy: input.strategy,
    allowedHelpLevel: input.allowedHelpLevel,
    structuredError: input.structuredError,
    hint:
      input.selectedHint === null
        ? null
        : { helpLevel: input.selectedHint.helpLevel, text: input.selectedHint.text },
  };

  // El campo es obligatorio en el tipo, pero los archivos de prueba de este
  // repositorio **no se typechequean** (`tsc` incluye sólo `src/**`), así que un
  // llamador podía omitirlo y recibir el comportamiento antiguo: `undefined` es
  // falsy y la garantía se apagaba sola. Se comprueba en ejecución para que la
  // garantía no dependa de que alguien haya compilado el llamador.
  if (typeof input.scorableActivityOpen !== 'boolean') {
    throw new MissingEgressFilterError(
      `scorableActivityOpen es obligatorio y llegó ${String(input.scorableActivityOpen)}. ` +
        `Un valor ausente se leería como «no hay actividad puntuable» y apagaría el modo de no ` +
        `revelación por olvido (P-I §9.6).`,
    );
  }

  const detectar = options.canaryDetector;
  // P-I §9.6: en una actividad puntuable el filtro de egreso no puede faltar.
  // Antes el detector era opcional siempre, así que no pasarlo apagaba la
  // comprobación sin decirlo — y «sin solución en contexto» quedaba sin
  // comprobar justo donde §9.6 lo exige.
  if (input.scorableActivityOpen && detectar === undefined) {
    throw new MissingEgressFilterError(
      `La actividad puntuable del bloque ${input.blockId} exige detector de canarios: P-I §9.6 ` +
        `pide «sin solución en contexto» y P-I §9.4 aplica el filtro antes de enviar nada al ` +
        `modelo. Sin detector la comprobación no corre, y no correr no es pasar.`,
    );
  }
  if (detectar !== undefined) {
    const hits = detectar(JSON.stringify(contexto));
    if (hits.length > 0) {
      // Un hit aborta. El incidente y el bloqueo de corrida son T-H4-05.
      throw new CanaryHitError(
        `El contexto construido contiene ${hits.length} cadena(s) canario (${hits.join(', ')}). ` +
          `Un canario en el egreso significa que una solución llegó hasta aquí: se aborta ` +
          `(P-II §11.3).`,
      );
    }
  }

  return contexto;
}
