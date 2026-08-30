/**
 * Lexicón de verbalización congelado por `authorizedCalculusVersion`
 * (T-H8-02 ← P-I §8.10; `DEC-VOICE-001`).
 *
 * ## Un lexicón, dos direcciones
 *
 * La tentación es escribir dos tablas: una para decir fórmulas por el altavoz y
 * otra para entender al alumno por el micrófono. Sería el mismo defecto que
 * `formula-mathml.ts` documenta y evitó —dos verbalizaciones de la misma fórmula
 * divergiendo desde el primer día—, sólo que peor: aquí divergirían el canal de
 * salida y el de entrada, así que el Profesor IA diría «letra P implica letra Q»
 * y no reconocería esa misma frase de vuelta.
 *
 * Por eso hay **una** tabla y dos funciones inversas. `verbalize*` es lo que
 * `T-H8-02` manda al TTS; `deverbalize*` es el normalizador que `T-H8-01` aplica
 * a la transcripción. La reconstrucción exacta que la norma exige no es una
 * prueba añadida: es la relación que define la tabla.
 *
 * ## Reconstrucción antes que naturalidad, y lo dice la norma
 *
 * El átomo `P` se dice «letra P», no «P». Suena peor, y es deliberado: la norma
 * pide que la corrección del lexicón «se valida por reconstrucción de fórmulas,
 * **no por naturalidad percibida**». Sin la palabra marca, el átomo `O` y el
 * conectivo `∨` —que se dice «o»— serían el mismo sonido, y una disyunción
 * dictada volvería como un átomo. Un lexicón bonito que pierde una fórmula es
 * peor que uno feo que no pierde ninguna.
 *
 * ## Lo que este módulo NO hace
 *
 * No parsea. Recorre el texto canónico símbolo a símbolo y no construye AST, no
 * decide si `A∧B∧C` es fórmula ni si un paso se sigue. Ese es el trabajo de
 * `logic-core`, y **este paquete no puede importarlo**: la regla
 * `visual-sin-veredicto-formal` de `.dependency-cruiser.cjs` le prohíbe toda la
 * ruta de verificación, sin la excepción del subpath `syntax` que sí tiene
 * `apps/web`. La regla está bien y el import estaría mal: un segundo parser del
 * cálculo aquí sería exactamente la divergencia que
 * `sin-verificador-fuera-del-verificador` existe para impedir.
 *
 * Que la tabla siga correspondiendo al cálculo congelado lo comprueba
 * `test/calculus-correspondence.test.ts`, que sí importa `logic-core` porque los
 * `*.test.ts` están excluidos del grafo de depcruise. Es el patrón de
 * `db:grants:check` y de `ci:content:mangos`: la tabla vive local, y un control
 * falla si la fuente congelada cambia.
 */

/** Versión del lexicón. Entra en el `COMMIT` junto a la transcripción. */
export const LEXICON_VERSION = 'verbalization-lexicon-v1' as const;

/**
 * Cálculo al que este lexicón corresponde.
 *
 * Se escribe literal en vez de importarse, por la frontera de arriba, y
 * `test/calculus-correspondence.test.ts` comprueba que coincide con
 * `AUTHORIZED_CALCULUS_VERSION`.
 */
export const LEXICON_CALCULUS_VERSION = 'authorized-calculus-v1' as const;

export type SpeechLexiconErrorCode =
  | 'VERSION_DESCONOCIDA'
  | 'CARACTER_NO_LEXICALIZADO'
  | 'PALABRA_NO_LEXICALIZADA'
  | 'ATOMO_MAL_FORMADO'
  | 'REGLA_DESCONOCIDA'
  | 'REFERENCIA_MAL_FORMADA';

export class SpeechLexiconError extends Error {
  readonly code: SpeechLexiconErrorCode;

  constructor(code: SpeechLexiconErrorCode, detail: string) {
    super(detail);
    this.name = 'SpeechLexiconError';
    this.code = code;
  }
}

/** Palabra marca de átomo. Sin ella, `O` y `∨` colisionan. */
const MARCA_ATOMO = 'letra';
/** Palabra marca de subíndice: `A_1` ⇒ «letra A subíndice 1». */
const MARCA_SUBINDICE = 'subíndice';

/**
 * Notación → habla.
 *
 * `↔` se dice «si y sólo si», que **contiene** la palabra de `∧`. La
 * deverbalización casa la frase más larga primero; sin eso, «si y sólo si» se
 * leería como cuatro tokens sueltos y el bicondicional se perdería.
 */
const NOTACION: readonly (readonly [string, string])[] = Object.freeze([
  ['↔', 'si y sólo si'],
  ['→', 'implica'],
  ['∧', 'y'],
  ['∨', 'o'],
  ['¬', 'no'],
  ['⊥', 'contradicción'],
  ['(', 'abre paréntesis'],
  [')', 'cierra paréntesis'],
] as const);

const SIMBOLO_A_HABLA = new Map<string, string>(NOTACION.map(([s, h]) => [s, h]));

/** Frases ordenadas de más palabras a menos, para el emparejado largo-primero. */
const FRASES: readonly (readonly [readonly string[], string])[] = Object.freeze(
  [...NOTACION]
    .map(([simbolo, habla]) => [habla.split(' '), simbolo] as const)
    .sort((a, b) => b[0].length - a[0].length),
);

/**
 * `rule_id` → nombre hablado.
 *
 * Los `rule_id` **no se traducen**: `∧I` sigue siendo `∧I` en la evidencia, en
 * el contrato y en el veredicto. Esto es proyección de presentación, como el
 * mango de D-77 lo es del `fragmentId`: existe para que un altavoz no deletree
 * «cuña mayúscula i».
 *
 * La correspondencia es **biyectiva**, y hay prueba: dos reglas con el mismo
 * nombre hablado harían irreconstruible la justificación dictada.
 */
const REGLAS: readonly (readonly [string, string])[] = Object.freeze([
  ['R', 'reiteración'],
  ['∧I', 'introducción de la conjunción'],
  ['∧E', 'eliminación de la conjunción'],
  ['∨I', 'introducción de la disyunción'],
  ['∨E', 'eliminación de la disyunción'],
  ['→I', 'introducción del condicional'],
  ['→E', 'eliminación del condicional'],
  ['↔I', 'introducción del bicondicional'],
  ['↔E', 'eliminación del bicondicional'],
  ['¬I', 'introducción de la negación'],
  ['¬E', 'eliminación de la negación'],
  ['X', 'explosión'],
  ['IP', 'prueba indirecta'],
  ['DNE', 'eliminación de la doble negación'],
  ['PR', 'premisa'],
  ['AS', 'supuesto'],
] as const);

const REGLA_A_HABLA = new Map<string, string>(REGLAS.map(([r, h]) => [r, h]));
const HABLA_A_REGLA = new Map<string, string>(REGLAS.map(([r, h]) => [h, r]));

/** Los `rule_id` que este lexicón cubre, para que el control los recorra. */
export function lexicalizedRuleIds(): readonly string[] {
  return REGLAS.map(([r]) => r);
}

/** Los símbolos de notación que este lexicón cubre. */
export function lexicalizedSymbols(): readonly string[] {
  return NOTACION.map(([s]) => s);
}

/**
 * El lexicón de una versión del cálculo. **Lanza** ante una desconocida.
 *
 * No devuelve el de v1 «porque es el único»: el día que exista un
 * `authorized-calculus-v2`, un lexicón silenciosamente reutilizado diría las
 * fórmulas del cálculo nuevo con las palabras del viejo, y el audio sonaría
 * perfecto.
 */
export function verbalizationLexicon(calculusVersion: string): {
  readonly lexiconVersion: typeof LEXICON_VERSION;
  readonly calculusVersion: typeof LEXICON_CALCULUS_VERSION;
} {
  if (calculusVersion !== LEXICON_CALCULUS_VERSION) {
    throw new SpeechLexiconError(
      'VERSION_DESCONOCIDA',
      `No hay lexicón congelado para «${calculusVersion}». El único es ` +
        `«${LEXICON_CALCULUS_VERSION}» (${LEXICON_VERSION}). Reutilizar el de otra versión diría ` +
        `las fórmulas del cálculo nuevo con las palabras del viejo, y el audio sonaría bien.`,
    );
  }
  return { lexiconVersion: LEXICON_VERSION, calculusVersion: LEXICON_CALCULUS_VERSION };
}

const ES_MAYUSCULA = /^[A-Z]$/u;
const ES_DIGITO = /^[0-9]$/u;
const SOLO_DIGITOS = /^[0-9]+$/u;

/**
 * Texto canónico de fórmula → habla.
 *
 * Trabaja sobre la salida de `print()` de `logic-core`, que no lleva espacios y
 * pone paréntesis en toda subfórmula binaria porque el cálculo **no tiene
 * precedencia**. Se recorre carácter a carácter y **cualquier carácter que la
 * tabla no cubra lanza**: un espacio colado o un símbolo de otro cálculo
 * saldrían por el altavoz como silencio, y el alumno oiría una fórmula distinta
 * de la que hay en pantalla sin que nada lo señalara.
 */
export function verbalizeFormulaText(canonical: string): string {
  const palabras: string[] = [];
  let i = 0;
  while (i < canonical.length) {
    const c = canonical[i] as string;
    const habla = SIMBOLO_A_HABLA.get(c);
    if (habla !== undefined) {
      palabras.push(habla);
      i += 1;
      continue;
    }
    if (ES_MAYUSCULA.test(c)) {
      palabras.push(MARCA_ATOMO, c);
      i += 1;
      if (canonical[i] === '_') {
        i += 1;
        let digitos = '';
        while (i < canonical.length && ES_DIGITO.test(canonical[i] as string)) {
          digitos += canonical[i];
          i += 1;
        }
        if (digitos === '') {
          throw new SpeechLexiconError(
            'ATOMO_MAL_FORMADO',
            `«${canonical}»: un «_» sin dígitos detrás en la posición ${i - 1}.`,
          );
        }
        palabras.push(MARCA_SUBINDICE, digitos);
      }
      continue;
    }
    throw new SpeechLexiconError(
      'CARACTER_NO_LEXICALIZADO',
      `«${c}» (posición ${i} de «${canonical}») no está en el lexicón ${LEXICON_VERSION}. ` +
        `El lexicón falla cerrado: decirlo como silencio haría que el alumno oyera una fórmula ` +
        `distinta de la que ve, sin que nada lo señalara.`,
    );
  }
  return palabras.join(' ');
}

/**
 * Habla → texto canónico de fórmula. Inversa exacta de {@link verbalizeFormulaText}.
 *
 * Es también el normalizador de notación de `T-H8-01`: lo que el alumno dictó
 * vuelve a ser el texto que el editor Fitch habría recibido tecleado. **No
 * corrige razonamiento** —no reordena, no completa, no arregla una regla mal
 * citada—; sólo transcodifica notación, que es lo que P-I §8.10 autoriza.
 */
export function deverbalizeFormulaText(spoken: string): string {
  const palabras = spoken.split(/\s+/u).filter((p) => p !== '');
  let salida = '';
  let i = 0;
  while (i < palabras.length) {
    if (palabras[i] === MARCA_ATOMO) {
      const letra = palabras[i + 1];
      if (letra === undefined || !ES_MAYUSCULA.test(letra)) {
        throw new SpeechLexiconError(
          'ATOMO_MAL_FORMADO',
          `«${MARCA_ATOMO}» sin letra mayúscula detrás (palabra ${i} de «${spoken}»).`,
        );
      }
      salida += letra;
      i += 2;
      if (palabras[i] === MARCA_SUBINDICE) {
        const digitos = palabras[i + 1];
        if (digitos === undefined || !SOLO_DIGITOS.test(digitos)) {
          throw new SpeechLexiconError(
            'ATOMO_MAL_FORMADO',
            `«${MARCA_SUBINDICE}» sin dígitos detrás (palabra ${i + 1} de «${spoken}»).`,
          );
        }
        salida += `_${digitos}`;
        i += 2;
      }
      continue;
    }
    const casado = casarFrase(palabras, i);
    if (casado === null) {
      throw new SpeechLexiconError(
        'PALABRA_NO_LEXICALIZADA',
        `«${palabras[i]}» (palabra ${i} de «${spoken}») no está en el lexicón ` +
          `${LEXICON_VERSION}. Adivinar aquí convertiría ruido del micrófono en notación.`,
      );
    }
    salida += casado.simbolo;
    i += casado.consumidas;
  }
  return salida;
}

/** Emparejado largo-primero: «si y sólo si» antes que «y». */
function casarFrase(
  palabras: readonly string[],
  desde: number,
): { readonly simbolo: string; readonly consumidas: number } | null {
  for (const [frase, simbolo] of FRASES) {
    if (frase.every((p, k) => palabras[desde + k] === p)) {
      return { simbolo, consumidas: frase.length };
    }
  }
  return null;
}

/** `rule_id` → nombre hablado. **Lanza** ante una regla no autorizada. */
export function verbalizeRule(ruleId: string): string {
  const habla = REGLA_A_HABLA.get(ruleId);
  if (habla === undefined) {
    throw new SpeechLexiconError(
      'REGLA_DESCONOCIDA',
      `«${ruleId}» no está en el lexicón ${LEXICON_VERSION}. La whitelist del cálculo es cerrada ` +
        `y este lexicón la sigue: pronunciar una regla no autorizada la haría sonar legítima.`,
    );
  }
  return habla;
}

/** Nombre hablado → `rule_id`. Inversa exacta de {@link verbalizeRule}. */
export function deverbalizeRule(spoken: string): string {
  const regla = HABLA_A_REGLA.get(spoken.trim());
  if (regla === undefined) {
    throw new SpeechLexiconError(
      'REGLA_DESCONOCIDA',
      `«${spoken}» no nombra ninguna regla del lexicón ${LEXICON_VERSION}.`,
    );
  }
  return regla;
}

/** Cita de línea (`4`) o de subprueba (`[2, 5]`), como las escribe `logic-core`. */
export type SpokenReference = number | readonly [number, number];

/**
 * Cita → habla.
 *
 * Una línea y una subprueba se dicen distinto **a propósito**: `∨E` cita una
 * disyunción y dos subpruebas, y «línea 2» frente a «subprueba de la línea 2 a
 * la línea 5» es la diferencia entre citar un renglón y citar un bloque.
 */
export function verbalizeReference(ref: SpokenReference): string {
  if (typeof ref === 'number') {
    assertLineaValida(ref);
    return `línea ${ref}`;
  }
  const [inicio, fin] = ref;
  assertLineaValida(inicio);
  assertLineaValida(fin);
  return `subprueba de la línea ${inicio} a la línea ${fin}`;
}

function assertLineaValida(n: number): void {
  if (!Number.isInteger(n) || n < 1) {
    throw new SpeechLexiconError(
      'REFERENCIA_MAL_FORMADA',
      `«${n}» no es un número de línea: las líneas se citan 1-based y enteras.`,
    );
  }
}

const RE_LINEA = /^línea (\d+)$/u;
const RE_SUBPRUEBA = /^subprueba de la línea (\d+) a la línea (\d+)$/u;

/** Habla → cita. Inversa exacta de {@link verbalizeReference}. */
export function deverbalizeReference(spoken: string): SpokenReference {
  const texto = spoken.trim();
  const sub = RE_SUBPRUEBA.exec(texto);
  if (sub !== null) {
    return [Number(sub[1]), Number(sub[2])] as const;
  }
  const linea = RE_LINEA.exec(texto);
  if (linea !== null) {
    return Number(linea[1]);
  }
  throw new SpeechLexiconError(
    'REFERENCIA_MAL_FORMADA',
    `«${spoken}» no es una cita del lexicón ${LEXICON_VERSION}.`,
  );
}

/** Separador de citas. No aparece dentro de ninguna cita, así que la vuelta es exacta. */
const SEPARADOR_CITAS = ' y ';

/** Lista de citas → habla. */
export function verbalizeReferences(refs: readonly SpokenReference[]): string {
  return refs.map(verbalizeReference).join(SEPARADOR_CITAS);
}

/** Habla → lista de citas. Inversa exacta de {@link verbalizeReferences}. */
export function deverbalizeReferences(spoken: string): readonly SpokenReference[] {
  const texto = spoken.trim();
  if (texto === '') return [];
  return texto.split(SEPARADOR_CITAS).map(deverbalizeReference);
}
