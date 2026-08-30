import {
  BINARY_SYMBOL,
  isBinary,
  print,
  tryParse,
  type Formula,
  // Por el subpath **sin veredicto**, no por el barrel: el cliente parsea con la
  // misma gramática congelada que el verificador y no alcanza `verify()`. Lo
  // cazó `sin-verificador-fuera-del-verificador` al primer intento.
} from '@profesor-ia/logic-core/syntax';

/**
 * Notación lógica expuesta semánticamente (T-H8-10 ← Maestro §10.5, UIUX §8).
 *
 * ## El defecto que esto corrige
 *
 * Las fórmulas se renderizaban como texto plano dentro de un `<span>`. Para
 * quien lee la pantalla eso funciona; para quien la escucha, no: un lector de
 * pantalla ante `P→(Q∧R)` dice los símbolos uno a uno, sin estructura, y el
 * alumno no recibe la fórmula sino una lista de caracteres. Lo detectó
 * `ci:a11y:baseline` con el criterio `CRIT-NOTACION`.
 *
 * ## Por qué MathML y no una etiqueta hablada
 *
 * La tentación es poner un `aria-label` con la fórmula dicha en castellano —«P
 * implica Q»— y quedarse tranquilo. Sería un error, y de los caros: `T-H8-02`
 * define un **lexicón de verbalización** por `authorizedCalculusVersion`
 * «validado por reconstrucción exacta de fórmulas». Escribir aquí una segunda
 * verbalización, sin validar y sin versionar, dejaría dos formas distintas de
 * decir la misma fórmula —la de la pantalla y la de la voz— divergiendo desde el
 * primer día.
 *
 * MathML no tiene ese problema porque **no verbaliza**: entrega la estructura y
 * deja hablar al lector de pantalla, en el idioma y con las convenciones que el
 * alumno ya tiene configuradas. Por eso el Maestro lo pide «preferentemente».
 *
 * ## La propiedad que lo mantiene honesto
 *
 * {@link mathText} reconstruye el texto canónico desde el árbol MathML, y hay
 * prueba de que `parse(mathText(toMathNode(f)))` devuelve la fórmula original
 * para todo el conjunto. Sin esa vuelta, un renderizador que se comiera un
 * paréntesis produciría markup precioso que **dice otra fórmula** — y nadie que
 * mire la pantalla lo notaría, porque el paréntesis perdido tampoco se ve.
 *
 * ## Y si no parsea, no se inventa
 *
 * `toMathNode` sólo se aplica a lo que `tryParse` acepta. Una línea a medio
 * escribir no tiene estructura que exponer, y adivinarla produciría markup que
 * afirma una lectura que el alumno no escribió. En ese caso se cae al texto
 * plano de siempre, que es lo que hay.
 */

export type MathNode =
  | { readonly kind: 'mi'; readonly text: string }
  | { readonly kind: 'mn'; readonly text: string }
  | { readonly kind: 'mo'; readonly text: string }
  | { readonly kind: 'msub'; readonly base: MathNode; readonly sub: MathNode }
  | { readonly kind: 'mrow'; readonly children: readonly MathNode[] };

const mi = (text: string): MathNode => ({ kind: 'mi', text });
const mo = (text: string): MathNode => ({ kind: 'mo', text });
const mrow = (children: readonly MathNode[]): MathNode => ({ kind: 'mrow', children });

/** `A` va como `<mi>`; `A_1` como `<msub><mi>A</mi><mn>1</mn></msub>`. */
function atomNode(name: string): MathNode {
  const head = name.slice(0, 1);
  const digits = name.slice(1);
  if (digits === '') return mi(head);
  return { kind: 'msub', base: mi(head), sub: { kind: 'mn', text: digits } };
}

/**
 * Árbol MathML de una fórmula.
 *
 * Los paréntesis se emiten en las mismas posiciones que {@link print}: toda
 * subfórmula binaria va entre paréntesis porque el cálculo congelado **no tiene
 * precedencia** entre conectivos binarios (P-II §4.1.1, `E-SYN-PRECEDENCE`).
 * Omitirlos aquí «porque MathML agrupa» rompería la correspondencia con lo que
 * el alumno escribió y con lo que la evidencia registra.
 */
export function toMathNode(f: Formula): MathNode {
  switch (f.kind) {
    case 'atom':
      return atomNode(f.name);
    case 'falsum':
      return mo('⊥');
    case 'not':
      return mrow([mo('¬'), inner(f.sub)]);
    default:
      return mrow([inner(f.left), mo(BINARY_SYMBOL[f.kind]), inner(f.right)]);
  }
}

function inner(f: Formula): MathNode {
  return isBinary(f) ? mrow([mo('('), toMathNode(f), mo(')')]) : toMathNode(f);
}

/**
 * Texto canónico que codifica el árbol.
 *
 * El subíndice reintroduce el `_`: `<msub>` tiene contenido textual `A1`, pero
 * la forma canónica del átomo es `A_1` y es la que `parse` vuelve a aceptar. Sin
 * esta regla la vuelta no cerraría, y una prueba que no cierra por un detalle de
 * notación acabaría relajada hasta dejar de comprobar nada.
 */
export function mathText(node: MathNode): string {
  switch (node.kind) {
    case 'mi':
    case 'mn':
    case 'mo':
      return node.text;
    case 'msub':
      return `${mathText(node.base)}_${mathText(node.sub)}`;
    case 'mrow':
      return node.children.map(mathText).join('');
  }
}

export type FormulaPresentation =
  | { readonly kind: 'mathml'; readonly node: MathNode; readonly text: string }
  | { readonly kind: 'texto'; readonly text: string; readonly reason: string };

/**
 * Cómo presentar una fórmula escrita por el alumno.
 *
 * Devuelve datos, no JSX, para que la decisión sea comprobable sin DOM — igual
 * que `ClaseView` recibe su modelo ya derivado.
 */
export function presentFormula(source: string): FormulaPresentation {
  const parsed = tryParse(source);
  if (!parsed.ok) {
    return {
      kind: 'texto',
      text: source,
      reason: `no parsea (${parsed.error.code}): sin estructura no hay nada semántico que exponer`,
    };
  }
  return { kind: 'mathml', node: toMathNode(parsed.formula), text: print(parsed.formula) };
}
