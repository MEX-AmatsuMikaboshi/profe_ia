import type { MasteryHintFacts } from '@profesor-ia/domain-engine';
import {
  AUTHORIZED_RULE_IDS,
  isBinary,
  parse,
  print,
  type Formula,
  type RuleId,
} from '@profesor-ia/logic-core';
import { areIsomorphic, type CanonicalProof } from '@profesor-ia/isomorphism-canonicalizer';
import { HintPolicyError, MasteryFlagNotAuthoritativeError } from './errors.js';

/**
 * Rol D — generador de pistas (T-H5-05, paso 7 de W3 ← P-II §5.2 y P-I §8.6).
 *
 * Rol D produce niveles de ayuda, anclajes y una **propuesta** de
 * `masteryDisqualifying` «para auditoría de autoría; **no es autoritativa** y
 * debe coincidir con el valor recalculado por la política determinista». Este
 * módulo hace exactamente eso y nada más: guarda la propuesta como propuesta.
 * Quien recalcula el valor autoritativo es `T-H6-03`, y quien rechaza la
 * discrepancia es el linter de paquete (`T-H5-13`).
 *
 * Por eso `authoritativeMasteryDisqualifying()` **falla cerrado**. Devolver la
 * propuesta convertiría en autoridad, por el camino de en medio, justo lo que
 * §8.6 le niega: la bandera decide si un acierto cuenta como dominio, así que
 * una propuesta complaciente del generador daría por dominado un KC que se
 * acertó con ayuda decisiva.
 */

export const HINT_LEVELS = [1, 2, 3, 4, 5] as const;
export type HintLevel = (typeof HINT_LEVELS)[number];

/** Los cinco niveles mínimos, literales de P-I §8.6. */
export const HINT_LEVEL_DESCRIPTIONS: Readonly<Record<HintLevel, string>> = Object.freeze({
  1: 'recordar objetivo o definición',
  2: 'señalar región o regla relevante',
  3: 'indicar el siguiente tipo de operación sin resolverla',
  4: 'ejemplo análogo no isomorfo',
  5: 'cierre del intento sin revelar la respuesta calificada',
});

export interface AnalogousExample {
  /** Derivación del ejemplo. Sin ella no se puede comprobar que no es isomorfo. */
  readonly proof: CanonicalProof;
}

export interface Hint {
  readonly level: HintLevel;
  readonly text: string;
  /** Anclajes a fragmentos del corpus (salida de Rol D). */
  readonly anchors: readonly string[];
  /**
   * Propuesta de Rol D **no autoritativa**. El nombre lleva `proposed` a
   * propósito: un campo llamado `masteryDisqualifying` se leería como el valor.
   */
  readonly proposedMasteryDisqualifying: boolean;
  /**
   * Hechos estructurados sobre el contenido de la ayuda. **Son la entrada de
   * la política autoritativa** (`masteryDisqualifying()`, DEC-HINT-AUTHORITY-001)
   * y por eso viajan con la pista: sin ellos, el linter de paquete (`T-H5-13`)
   * no tiene contra qué contrastar `proposedMasteryDisqualifying` y su
   * comprobación `authoritative_mastery_flags` **pasaría por vacío**.
   *
   * Describirlos es trabajo de Rol D —dice qué hace su pista—; convertirlos en
   * el valor de dominio no lo es, y por eso aquí no se calcula nada.
   */
  readonly masteryFacts: MasteryHintFacts;
  /** Obligatoria cuando la propuesta es `false` (P-II §5.2, salida de Rol D). */
  readonly nonRevelationExplanation?: string;
  /** Ejemplo análogo; §8.6 lo sitúa en el nivel 4 y lo exige **no isomorfo**. */
  readonly analogousExample?: AnalogousExample;
}

export interface HintSet {
  readonly itemId: string;
  readonly hints: readonly Hint[];
}

/** Contexto determinista contra el que se comprueba una pista. */
export interface HintCheckContext {
  /** Certificado re-verificado del reactivo. */
  readonly solution: CanonicalProof;
  /**
   * Enunciado **separado en premisas y meta**, no como una lista plana.
   *
   * La comprobación de fuga solo necesita el conjunto de fórmulas visibles, y
   * con una lista bastaba. La de **fidelidad** (D-67) necesita saber cuál es
   * cuál: la regla que *abre* una premisa y la que *construye* la meta no son la
   * misma, y esa distinción es justamente el defecto de KC16 —`¬E` donde va
   * `DNE`—. Separarlo en el tipo es lo que impide que la comprobación de
   * fidelidad quede como un extra opcional que se olvida de llamar.
   */
  readonly statement: {
    readonly premises: readonly string[];
    readonly goal: string;
  };
}

/** Fórmulas visibles del enunciado. Lo que ya está aquí no es fuga. */
const formulasDelEnunciado = (context: HintCheckContext): readonly string[] => [
  ...context.statement.premises,
  context.statement.goal,
];

const sinEspacios = (s: string): string => s.replace(/\s+/gu, '');

/** Subfórmulas de una fórmula, en forma impresa y sin espacios. */
function subformulasImpresas(f: Formula, acc: Set<string>): void {
  acc.add(sinEspacios(print(f)));
  if (f.kind === 'not') subformulasImpresas(f.sub, acc);
  else if (isBinary(f)) {
    subformulasImpresas(f.left, acc);
    subformulasImpresas(f.right, acc);
  }
}

/**
 * Fórmulas de la solución que el alumno **no puede ver** en el enunciado.
 *
 * La comparación es contra las **subfórmulas** del enunciado, no contra sus
 * fórmulas completas, y esa es la diferencia que hace útil el control. Si un
 * paso escribe `A` y el enunciado dice `A∧B`, el alumno ya tiene `A` delante:
 * marcarlo como fuga rechazaría pistas legítimas de nivel 2 —«señalar la región
 * relevante» es literalmente eso— y, peor, una prohibición de escribir `A`
 * saltaría con cualquier palabra que empiece por A. Lo que sí es un paso oculto
 * es una fórmula que no aparece por ninguna parte del enunciado: el `⊥` de una
 * reducción al absurdo delata la estrategia entera.
 */
export function undisclosedSolutionFormulas(context: HintCheckContext): readonly string[] {
  const visibles = new Set<string>();
  for (const f of formulasDelEnunciado(context)) subformulasImpresas(parse(f), visibles);

  const salida: string[] = [];
  for (const linea of context.solution.lines) {
    const normalizada = sinEspacios(print(parse(linea.formula)));
    if (!visibles.has(normalizada) && !salida.includes(normalizada)) salida.push(normalizada);
  }
  return Object.freeze(salida);
}

/**
 * Comprueba un conjunto de pistas contra P-I §8.6 y la salida de Rol D.
 *
 * **Lo que detecta la comprobación de fuga es literalidad, no paráfrasis**, y
 * el módulo no afirma más: una pista que describa el paso decisivo con otras
 * palabras pasa por aquí y la ve la auditoría por muestra de W4. Afirmar que
 * este control garantiza no revelación sería justamente el éxito simulado que
 * el proyecto evita.
 */
export function assertHintSet(set: HintSet, context: HintCheckContext): void {
  if (context.solution.lines.length === 0 || context.statement.goal.trim() === '') {
    throw new HintPolicyError(
      `${set.itemId}: se pidió comprobar las pistas sin solución o sin enunciado. Con cualquiera de ` +
        `los dos vacío, la lista de pasos ocultos sale vacía y **la comprobación de fuga pasa por ` +
        `vacío**: aprobaría cualquier pista, incluida la que escribe la solución entera.`,
    );
  }

  if (set.hints.length === 0) {
    throw new HintPolicyError(
      `El conjunto de pistas de ${set.itemId} está vacío. Un conjunto vacío no es «sin pistas»: es ` +
        `un conjunto que no se comprueba, y todas sus reglas pasarían por vacío.`,
    );
  }

  const noReveladas = undisclosedSolutionFormulas(context);
  // Las reglas que este enunciado permite nombrar. Se calculan una vez y **desde
  // el enunciado**, no desde el certificado: Rol D no ve la solución, y el nivel
  // 3 puede nombrar con verdad alternativas que el certificado no usó.
  const reglasEsperadas = expectedHintRules(context.statement);
  const nivelesVistos = new Set<HintLevel>();

  for (const pista of set.hints) {
    if (!(HINT_LEVELS as readonly number[]).includes(pista.level)) {
      throw new HintPolicyError(
        `${set.itemId}: nivel de pista ${pista.level}. §8.6 fija cinco niveles y el banco se ` +
          `congela; un nivel fuera de la escala no se puede registrar por intento.`,
      );
    }
    if (nivelesVistos.has(pista.level)) {
      throw new HintPolicyError(
        `${set.itemId}: dos pistas declaran el nivel ${pista.level}. El nivel utilizado se registra ` +
          `por intento (§8.6): con dos pistas del mismo nivel, el registro no dice cuál se dio.`,
      );
    }
    nivelesVistos.add(pista.level);

    if (pista.text.trim() === '') {
      throw new HintPolicyError(`${set.itemId}: la pista de nivel ${pista.level} no tiene texto.`);
    }
    // El campo es obligatorio en el tipo, y eso **no protege a nadie**: los
    // archivos de prueba no se typechequean y `undefined` es falsy, así que una
    // pista sin hechos llegaría al linter y su comprobación de banderas pasaría
    // por vacío. La garantía la hace esta comprobación, no la declaración.
    const hechos = pista.masteryFacts as MasteryHintFacts | undefined;
    if (hechos === undefined) {
      throw new HintPolicyError(
        `${set.itemId}: la pista de nivel ${pista.level} no trae hechos de dominio. Son la entrada ` +
          `de la política autoritativa (DEC-HINT-AUTHORITY-001): sin ellos, la propuesta no se ` +
          `puede contrastar con nada y el linter aprobaría cualquier bandera.`,
      );
    }
    if (hechos.level !== pista.level) {
      throw new HintPolicyError(
        `${set.itemId}: la pista de nivel ${pista.level} declara hechos de nivel ${hechos.level}. ` +
          `La política decide por nivel, así que con los hechos de otro nivel calcularía la bandera ` +
          `de una ayuda que no es esta.`,
      );
    }

    if (pista.anchors.length === 0) {
      throw new HintPolicyError(
        `${set.itemId}: la pista de nivel ${pista.level} no trae anclajes, y Rol D los enumera ` +
          `entre su salida (P-II §5.2). Una ayuda sin anclaje no se puede auditar contra el corpus.`,
      );
    }

    if (
      !pista.proposedMasteryDisqualifying &&
      (pista.nonRevelationExplanation ?? '').trim() === ''
    ) {
      throw new HintPolicyError(
        `${set.itemId}: la pista de nivel ${pista.level} propone masteryDisqualifying = false y no ` +
          `explica por qué no revela la solución. P-II §5.2 exige esa explicación exactamente en ` +
          `ese caso: es la propuesta que, de aceptarse, deja el intento contando como dominio.`,
      );
    }

    const textoNormalizado = sinEspacios(pista.text);
    const filtrada = noReveladas.find((formula) => textoNormalizado.includes(formula));
    if (filtrada !== undefined) {
      throw new HintPolicyError(
        `${set.itemId}: la pista de nivel ${pista.level} contiene «${filtrada}», que es un paso de ` +
          `la solución ausente del enunciado. «Una pista nunca puede transformarse silenciosamente ` +
          `en solución» (§8.6).`,
      );
    }

    // Fidelidad de la regla nombrada (D-67, G4). Una pista que manda a `¬E`
    // desde `¬¬A` no revela de más: **enseña una aplicación falsa de la regla**,
    // que es peor. El libro cerrado tenía código para la pista que resuelve de
    // más y ninguno para la que dirige mal; éste es ese punto de fallo.
    const ajenas = hintNamesForeignRule(pista.text, reglasEsperadas);
    if (ajenas.length > 0) {
      const detalle = ajenas
        .map((a) => `«${a.named}» como regla de ${a.clause === 'introduction' ? 'introducción' : 'eliminación'}`)
        .join(', ');
      throw new HintPolicyError(
        `${set.itemId}: la pista de nivel ${pista.level} nombra ${detalle}, que no es la que ` +
          `corresponde a este enunciado. Esperadas: introducción ` +
          `${reglasEsperadas.goalIntroduction ?? '—'}, eliminación ` +
          `${reglasEsperadas.premiseEntries.join('/') || '—'}. Dirigir al alumno a una regla que ` +
          `ahí no aplica no es ayudar de menos: es enseñar la regla mal.`,
      );
    }

    if (pista.analogousExample !== undefined) {
      if (areIsomorphic(pista.analogousExample.proof, context.solution)) {
        throw new HintPolicyError(
          `${set.itemId}: el ejemplo de la pista de nivel ${pista.level} es isomorfo al reactivo ` +
            `bajo la canonicalización congelada. §8.6 pide «ejemplo análogo **no isomorfo**» y ` +
            `§9.6 prohíbe ejemplos isomorfos inmediatos en actividad puntuable: resolver el ` +
            `ejemplo sería resolver el reactivo con otros nombres de átomo.`,
        );
      }
    }
  }
}

/**
 * Valor autoritativo de `masteryDisqualifying`. **No se obtiene aquí.**
 *
 * §8.6: «la bandera propuesta por el generador no es autoritativa». La
 * recalcula por código la política de dominio (`T-H6-03`) a partir del nivel
 * utilizado y de si el contenido de la ayuda fue decisivo, y el linter de
 * paquete rechaza la discrepancia con la propuesta (`T-H5-13`). Este punto de
 * fallo es donde se enchufa esa política, no un hueco.
 */
export function authoritativeMasteryDisqualifying(hint: Hint): never {
  throw new MasteryFlagNotAuthoritativeError(
    `La pista de nivel ${hint.level} propone masteryDisqualifying = ` +
      `${String(hint.proposedMasteryDisqualifying)}, y esa propuesta no es autoritativa (P-I §8.6). ` +
      `El valor lo recalcula la política determinista de dominio (T-H6-03) y el linter de paquete ` +
      `rechaza la discrepancia (T-H5-13).`,
  );
}

/**
 * Regla que abre una premisa: la que el nivel 2 puede nombrar como entrada
 * cuando dice «la regla que lo elimina es …» (D-65 ← P-I §8.6).
 *
 * **Existe por un defecto concreto.** El generador de pistas tabulaba la regla
 * de eliminación por el **conectivo principal** de la premisa, y para la
 * negación devolvía siempre `¬E`. Pero `¬E` es «φ, ¬φ ⊢ ⊥»: consume una fórmula
 * y su negación para producir `⊥`, y **no saca `A` de `¬¬A`». La regla que quita
 * la doble negación es `DNE`, «¬¬A ⊢ A». Con premisa `¬¬A` la pista mandaba al
 * alumno a una regla que ahí no aplica —el hallazgo de KC16, diez reactivos en
 * siete reservas—.
 *
 * La distinción es de **forma de la premisa**, no de conectivo: `¬A` sí se ataca
 * con `¬E`. Por eso no basta corregir la tabla.
 *
 * Devuelve `null` cuando no hay nada que eliminar: un átomo o `⊥` no tienen
 * conectivo principal que abrir.
 */
export function premiseEntryRule(premise: Formula): RuleId | null {
  switch (premise.kind) {
    case 'and':
      return '∧E';
    case 'or':
      return '∨E';
    case 'implies':
      return '→E';
    case 'iff':
      return '↔E';
    case 'not':
      return premise.sub.kind === 'not' ? 'DNE' : '¬E';
    default:
      // `atom` y `falsum`. `X` elimina `⊥`, pero `⊥` como premisa no es una
      // situación de Etapa 1 (`KC12 PC:KC10`) y afirmar una entrada aquí
      // inventaría una orientación que el corpus no da.
      return null;
  }
}

/**
 * Regla que **construye** una meta según su conectivo principal (D-67).
 *
 * Contrapartida de `premiseEntryRule()`. Devuelve `null` para una letra
 * proposicional: ninguna regla la introduce, y decir una la inventaría.
 */
export function goalIntroductionRule(goal: Formula): RuleId | null {
  switch (goal.kind) {
    case 'and':
      return '∧I';
    case 'or':
      return '∨I';
    case 'implies':
      return '→I';
    case 'iff':
      return '↔I';
    case 'not':
      return '¬I';
    case 'falsum':
      // `⊥` no es un conectivo sino el átomo distinguido, y lo que lo produce es
      // `¬E`. Se nombra porque el nivel 2 tiene una rama propia para esa meta.
      return '¬E';
    default:
      return null;
  }
}

/** Reglas que una pista puede nombrar con verdad para este enunciado. */
export interface ExpectedHintRules {
  readonly goalIntroduction: RuleId | null;
  readonly premiseEntries: readonly RuleId[];
}

export function expectedHintRules(statement: {
  readonly premises: readonly string[];
  readonly goal: string;
}): ExpectedHintRules {
  const entries: RuleId[] = [];
  for (const premise of statement.premises) {
    const rule = premiseEntryRule(parse(premise));
    if (rule !== null && !entries.includes(rule)) entries.push(rule);
  }
  return { goalIntroduction: goalIntroductionRule(parse(statement.goal)), premiseEntries: entries };
}

/**
 * Reglas del cálculo que un texto de pista nombra **como salida de una premisa**
 * o **como constructora de la meta**, y que no lo son para ese enunciado (D-67).
 *
 * **Por qué se lee el texto y no una estructura.** Rol D emite prosa; el reactivo
 * no guarda qué regla dijo la pista. Se acota el riesgo de dos formas: se busca
 * solo dentro de las cláusulas directivas —«la regla que lo introduce es X», «la
 * regla que lo elimina es X»—, no en todo el texto, y solo se reconocen ids del
 * cálculo autorizado. El nivel 3 nombra alternativas legítimas que el certificado
 * no usa —`IP` cuando la meta es un átomo—, así que una comprobación de «toda
 * regla nombrada aparece en el certificado» daría falsos positivos: por eso se
 * comparan las cláusulas directivas contra `expectedHintRules()` y no contra el
 * certificado.
 *
 * Lo encontró el defecto de KC16: la pista mandaba a `¬E` desde `¬¬A`, donde la
 * regla es `DNE`.
 */
export function hintNamesForeignRule(
  hintText: string,
  expected: ExpectedHintRules,
): readonly { readonly named: RuleId; readonly clause: 'introduction' | 'elimination' }[] {
  const foreign: { named: RuleId; clause: 'introduction' | 'elimination' }[] = [];
  for (const [clause, patron, permitidas] of [
    ['introduction', /introduce[n]? (?:es|son)([^.]*)/gu, expected.goalIntroduction === null ? [] : [expected.goalIntroduction]],
    ['elimination', /elimina[n]? (?:es|son)([^.]*)/gu, expected.premiseEntries],
  ] as const) {
    for (const match of hintText.matchAll(patron)) {
      const fragmento = match[1] ?? '';
      for (const regla of AUTHORIZED_RULE_IDS) {
        if (!fragmento.includes(regla)) continue;
        // `¬E` es subcadena de nada, pero `∧E`/`∨E` sí podrían confundirse con
        // otra si se ampliara el cálculo: se compara el id completo.
        if ((permitidas as readonly RuleId[]).includes(regla)) continue;
        if (!foreign.some((f) => f.named === regla && f.clause === clause)) {
          foreign.push({ named: regla, clause });
        }
      }
    }
  }
  return foreign;
}
