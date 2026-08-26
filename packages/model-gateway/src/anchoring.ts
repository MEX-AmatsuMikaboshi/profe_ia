import {
  AnchoredOutput,
  buildFragmentHandleTable,
  fragmentHandle,
  type AnchorRejectionReason,
} from '@profesor-ia/contracts';

import { CanaryHitError } from './errors.js';
import type { AuthorizedFragment, CanaryDetector } from './session-context.js';

/**
 * Validador de anclaje (T-H7-02 ← I-7, P-II §8.4, P-I §8.5).
 *
 * P-II §8.4 fija las cinco causas de rechazo y la lista es **cerrada**:
 * `anchor_inexistente`, `simbolo_no_autorizado`,
 * `instruccion_contradice_calculo`, `solucion_o_canario`, `fuera_de_esquema`.
 * Aquí no se añade ninguna.
 *
 * ## La regla que ordena todo lo demás
 *
 * I-7 dice: «sin ancla no introduce reglas». De ahí sale el criterio con el que
 * este módulo decide **sin interpretar prosa**:
 *
 * > Un símbolo o un identificador de regla ajenos al cálculo se rechazan
 * > **salvo que aparezcan en alguno de los fragmentos a los que el segmento
 * > ancla**. Si el corpus lo dice, el modelo lo está **citando**; si el corpus
 * > no lo dice, lo está **introduciendo**.
 *
 * Sin esa exención, el validador impediría al Profesor IA enseñar lo que el
 * propio corpus enseña —«la conmutativa no está permitida en este cálculo» es
 * contenido correcto y necesario— y un validador que amordaza la enseñanza
 * correcta no protege nada: lo desactivarían.
 *
 * Y con ella, la decisión es determinista: no hay que distinguir «mencionar» de
 * «ordenar», que es lo que ningún validador local puede decidir sobre texto
 * libre. La distingue el ancla.
 *
 * ## Lo que este módulo **no** decide, y no finge decidir
 *
 * La whitelist de reglas del cálculo es cerrada («cualquier regla no listada
 * falla cerrado»), pero eso se hace cumplir donde las reglas se **aplican** —
 * `logic-core`, sobre una derivación—, no sobre prosa. Aquí se detecta la lista
 * ilustrativa de reglas prohibidas que el cálculo congela, exenta por anclaje.
 * Afirmar que este validador reconoce cualquier regla inventada en lenguaje
 * natural sería éxito simulado.
 *
 * ## Por qué el cálculo entra por parámetro
 *
 * `model-gateway` no depende de `logic-core` y no debe: la ruta de verificación
 * se mantiene aparte, y arrastrar el cálculo hasta el paquete que habla con
 * proveedores acercaría `verify()` a la pasarela por la puerta de atrás. El
 * conjunto congelado entra por `AuthorizedCalculus`, igual que el detector de
 * canarios entra por parámetro en `buildSessionContext`. Que lo inyectado sea
 * de verdad el conjunto congelado lo comprueba una prueba de correspondencia.
 */

/**
 * El cálculo congelado, tal como lo declara `logic-core`. Se inyecta; este
 * paquete no lo transcribe, porque dos copias de un artefacto hasheado son dos
 * artefactos y uno de los dos se quedará viejo.
 */
export interface AuthorizedCalculus {
  /** `authorizedCalculusVersion`; viaja al registro de auditoría. */
  readonly version: string;
  /** Símbolos canónicos del lenguaje: `¬ ∧ ∨ → ↔ ⊥`. */
  readonly canonicalSymbols: readonly string[];
  /**
   * Alias de entrada **autorizados** (`->`, `&`, `|`, `~`, `!`, …). El cálculo
   * los canonicaliza antes de verificar, así que no son símbolos ajenos: verlos
   * en la salida no es una violación. Costó leerlo para no rechazarlos.
   */
  readonly connectiveAliases: readonly string[];
  /** Identificadores de regla prohibidos que el cálculo congela como ejemplo. */
  readonly forbiddenRuleIds: readonly string[];
}

/** Un segmento sin anclas, registrado para auditoría (P-I §8.5). */
export interface UnanchoredSegmentRecord {
  readonly segmentIndex: number;
  readonly function: string;
  readonly withheld: boolean;
  readonly authority: string;
}

/**
 * Situación de cada segmento tras validar.
 *
 * `withheld` no es un rechazo de la salida: P-I §8.5 **limita** la salida no
 * anclada en vez de tirarla —«puede presentarse como lenguaje de acompañamiento
 * no factual»—, y las causas de rechazo de §8.4 son otras cinco y cerradas. Un
 * segmento sin anclas cuya función declarada es `definition` es el único caso
 * que no se puede presentar de ninguna forma: presentarlo **sería** introducir
 * una definición sin ancla, que es lo que §8.5 prohíbe con todas sus letras.
 */
export type SegmentStanding =
  | { readonly kind: 'anchored'; readonly resolvedAnchors: readonly string[] }
  | { readonly kind: 'non_factual_accompaniment' }
  | { readonly kind: 'withheld'; readonly authority: string };

export interface AnchorRejection {
  readonly reason: AnchorRejectionReason;
  /** `null` cuando la causa es de la salida entera y no de un segmento. */
  readonly segmentIndex: number | null;
  readonly detail: string;
  /** La autoridad literal de la que sale el rechazo, como en `doubt.ts`. */
  readonly authority: string;
}

export type AnchorVerdict =
  | { readonly outcome: 'rejected'; readonly rejections: readonly AnchorRejection[] }
  | {
      readonly outcome: 'accepted';
      readonly output: AnchoredOutput;
      readonly standings: readonly SegmentStanding[];
      /**
       * P-I §8.5: una salida no anclada «no puede fundamentar calificación».
       * Basta un segmento sin anclas para que la salida entera deje de poder
       * sostener una evaluación: la alternativa —decidir por segmento cuál
       * sostuvo la calificación— exigiría saber qué leyó el alumno, y ante la
       * duda esto falla hacia el lado que no califica.
       */
      readonly canGroundEvaluation: boolean;
      readonly auditRecord: readonly UnanchoredSegmentRecord[];
    };

export interface AnchorValidationInput {
  readonly blockId: string;
  readonly authorizedFragments: readonly AuthorizedFragment[];
  readonly calculus: AuthorizedCalculus;
}

export interface ValidateAnchoredOutputOptions {
  readonly canaryDetector?: CanaryDetector;
}

const AUTORIDAD = {
  schema: 'P-II §8.4: «El validador rechaza: … salida fuera de esquema»',
  anchor: 'P-II §8.4: «El validador rechaza: anchors inexistentes» (I-7)',
  simbolo: 'P-II §8.4: «texto que introduce símbolos no autorizados»',
  instruccion: 'P-II §8.4: «instrucciones que contradicen el cálculo»',
  canario: 'P-II §8.4: «solución o fragmentos canario»; P-II §11.3',
  definicion: 'P-I §8.5: una salida no anclada «no puede introducir una regla o definición»',
  acompanamiento:
    'P-I §8.5: una salida no anclada «puede presentarse como lenguaje de acompañamiento no factual» y «se registra para auditoría»',
} as const;

/**
 * Rangos Unicode donde vive la notación lógica y matemática. Se mira **aquí** y
 * no en el texto entero por una razón práctica: la prosa española lleva letras,
 * tildes y signos de puntuación, y tokenizar prosa con el tokenizador del
 * cálculo la rechazaría entera. Lo que interesa es el símbolo que pretende ser
 * notación.
 */
const RANGOS_DE_NOTACION: readonly (readonly [number, number])[] = [
  [0x2190, 0x21ff], // flechas: ⇒ ⇔ ↦ …
  [0x2200, 0x22ff], // operadores matemáticos: ∀ ∃ ⊢ ⊨ ≡ ∈ ∪ ∩ …
  [0x27f0, 0x27ff], // flechas suplementarias
  [0x2a00, 0x2aff], // operadores suplementarios
];

function esNotacion(codepoint: number): boolean {
  return RANGOS_DE_NOTACION.some(([desde, hasta]) => codepoint >= desde && codepoint <= hasta);
}

/** Símbolos de notación presentes en un texto, sin repetir. */
function simbolosDeNotacion(texto: string): readonly string[] {
  const vistos = new Set<string>();
  for (const ch of texto) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && esNotacion(cp)) vistos.add(ch);
  }
  return [...vistos];
}

/**
 * Identificadores de regla presentes como **palabra suelta**. `MT` dentro de
 * «MTB» no es una cita de regla, y tratarlo como tal llenaría de falsos
 * positivos cualquier texto.
 */
function reglasCitadas(texto: string, candidatas: readonly string[]): readonly string[] {
  const encontradas: string[] = [];
  for (const regla of candidatas) {
    const escapada = regla.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    // `\b` no sirve con símbolos como `∧I`: se delimita por ausencia de letra o
    // dígito a los lados, que es lo que separa una cita del interior de una
    // palabra.
    const patron = new RegExp(`(^|[^\\p{L}\\p{N}])${escapada}($|[^\\p{L}\\p{N}])`, 'u');
    if (patron.test(texto)) encontradas.push(regla);
  }
  return encontradas;
}

/**
 * Valida una salida candidata contra los fragmentos autorizados del bloque.
 *
 * **Recoge todas las causas** en vez de parar en la primera: quien lea el
 * rechazo necesita saber todo lo que estaba mal, y devolver una sola causa hace
 * creer que arreglarla basta.
 *
 * **Un canario aborta.** Se lanza `CanaryHitError` en vez de devolver un
 * veredicto, igual que hace `buildSessionContext`: un canario en la salida
 * significa que una solución llegó hasta aquí, y eso es un incidente de nivel 3
 * (P-II §11.3), no una validación fallida. Degradarlo a causa de rechazo lo
 * haría indistinguible de un `anchor` mal escrito. El error lleva el veredicto
 * completo para que el incidente se registre con todo lo que se vio.
 */
export function validateAnchoredOutput(
  candidate: unknown,
  input: AnchorValidationInput,
  options: ValidateAnchoredOutputOptions = {},
): AnchorVerdict {
  const rechazos: AnchorRejection[] = [];

  // 1. Esquema. Va primero porque todo lo demás lee campos: validar semántica
  //    sobre una forma desconocida sería adivinar.
  const parsed = AnchoredOutput.safeParse(candidate);
  if (!parsed.success) {
    return {
      outcome: 'rejected',
      rejections: [
        {
          reason: 'fuera_de_esquema',
          segmentIndex: null,
          detail: parsed.error.message,
          authority: AUTORIDAD.schema,
        },
      ],
    };
  }
  const salida = parsed.data;

  // 2. Canarios sobre la salida entera. `salida_del_modelo` es una de las
  //    superficies que §11.3 declara para el detector, así que este es su sitio.
  const detectar = options.canaryDetector;
  const hits = detectar === undefined ? [] : detectar(JSON.stringify(salida));
  if (hits.length > 0) {
    rechazos.push({
      reason: 'solucion_o_canario',
      segmentIndex: null,
      detail: `${hits.length} cadena(s) canario en la salida del modelo: ${hits.join(', ')}`,
      authority: AUTORIDAD.canario,
    });
  }

  // El bloque manda: un fragmento de otro bloque no es anclaje válido aquí, por
  // la misma razón por la que el filtro de egreso no deja entrar uno (P-I §9.4).
  //
  // Cada fragmento entra **dos veces**: por su identificador canónico y por su
  // mango corto (D-77). No es laxitud, son dos nombres del mismo objeto: el
  // mango se deriva del canónico y `buildFragmentHandleTable()` comprueba que la
  // correspondencia es inyectiva, así que ninguna cadena puede resolver a dos
  // fragmentos. Se admiten los dos porque el mango es la forma que se le enseña
  // al modelo desde D-77, y el canónico es el que llevan los artefactos ya
  // emitidos —`anchors.yaml`, el registro de auditoría, las corridas de
  // BENCH-01 anteriores—: retirarlo invalidaría anclaje correcto ya escrito.
  const delBloque = new Map<string, AuthorizedFragment>();
  const enBloque = input.authorizedFragments.filter((f) => f.blockId === input.blockId);
  // Falla cerrado si dos fragmentos del bloque comparten mango, antes de
  // resolver nada.
  buildFragmentHandleTable(enBloque.map((f) => f.fragmentId));
  for (const fragmento of enBloque) {
    delBloque.set(fragmento.fragmentId, fragmento);
    delBloque.set(fragmentHandle(fragmento.fragmentId), fragmento);
  }

  const standings: SegmentStanding[] = [];
  const auditoria: UnanchoredSegmentRecord[] = [];

  salida.segments.forEach((segmento, indice) => {
    const resueltos: string[] = [];
    for (const ancla of segmento.anchors) {
      const fragmento = delBloque.get(ancla);
      if (fragmento === undefined) {
        rechazos.push({
          reason: 'anchor_inexistente',
          segmentIndex: indice,
          detail:
            `el anchor «${ancla}» no resuelve a ningún fragmento autorizado del bloque ` +
            `${input.blockId}`,
          authority: AUTORIDAD.anchor,
        });
        continue;
      }
      resueltos.push(ancla);
    }

    // Texto de respaldo: **sólo** el de las anclas que resolvieron. Usar el del
    // bloque entero dejaría que un segmento se apoyara en un fragmento al que no
    // ancló, que es exactamente lo que I-7 impide.
    const respaldo = resueltos.map((id) => delBloque.get(id)?.text ?? '').join('\n');

    const autorizados = new Set([
      ...input.calculus.canonicalSymbols,
      ...input.calculus.connectiveAliases,
    ]);
    for (const simbolo of simbolosDeNotacion(segmento.text)) {
      if (autorizados.has(simbolo)) continue;
      if (respaldo.includes(simbolo)) continue; // lo dice el corpus: lo cita.
      rechazos.push({
        reason: 'simbolo_no_autorizado',
        segmentIndex: indice,
        detail:
          `«${simbolo}» no pertenece al cálculo ${input.calculus.version} y no aparece en ` +
          `ningún fragmento anclado por este segmento`,
        authority: AUTORIDAD.simbolo,
      });
    }

    for (const regla of reglasCitadas(segmento.text, input.calculus.forbiddenRuleIds)) {
      if (reglasCitadas(respaldo, [regla]).length > 0) continue; // el corpus la nombra.
      rechazos.push({
        reason: 'instruccion_contradice_calculo',
        segmentIndex: indice,
        detail:
          `la regla «${regla}» está prohibida en el cálculo ${input.calculus.version} y no ` +
          `aparece en ningún fragmento anclado por este segmento: el segmento la introduce`,
        authority: AUTORIDAD.instruccion,
      });
    }

    if (segmento.anchors.length > 0) {
      standings.push({ kind: 'anchored', resolvedAnchors: resueltos });
      return;
    }

    const introduceDefinicion = segmento.function === 'definition';
    standings.push(
      introduceDefinicion
        ? { kind: 'withheld', authority: AUTORIDAD.definicion }
        : { kind: 'non_factual_accompaniment' },
    );
    auditoria.push({
      segmentIndex: indice,
      function: segmento.function,
      withheld: introduceDefinicion,
      authority: introduceDefinicion ? AUTORIDAD.definicion : AUTORIDAD.acompanamiento,
    });
  });

  if (hits.length > 0) {
    throw new CanaryHitError(
      `La salida del modelo contiene ${hits.length} cadena(s) canario (${hits.join(', ')}). ` +
        `Un canario en la salida significa que una solución llegó hasta aquí: se aborta ` +
        `(P-II §11.3). Causas vistas: ${rechazos.map((r) => r.reason).join(', ')}.`,
    );
  }

  if (rechazos.length > 0) return { outcome: 'rejected', rejections: rechazos };

  return {
    outcome: 'accepted',
    output: salida,
    standings,
    canGroundEvaluation: auditoria.length === 0,
    auditRecord: auditoria,
  };
}
