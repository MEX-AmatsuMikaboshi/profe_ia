import { AuthoringCoreError } from './errors.js';

/**
 * Fragmentación LaTeX para W1 (T-H5-01 ← §12 «W1» paso 4: «fragmentación con
 * IDs estables»).
 *
 * El corpus autorizado (forall x: Calgary) es un libro en LaTeX con estructura
 * limpia de `\part{}` / `\chapter{}` / `\section{}`. Este módulo corta el texto
 * en las unidades que W1 convierte en fragmentos: el fragmento es la sección,
 * y el texto entre un encabezado y el siguiente es el fragmento de ese nivel.
 *
 * Dos decisiones de diseño:
 *
 * 1. **El parser no sabe nada de KC.** Devuelve ubicación, tipo y texto; los
 *    `relatedConcepts` los añade quien llama desde un mapeo **declarado** con
 *    procedencia. Un parser que adivinara conceptos del texto estaría
 *    produciendo el juicio curricular que la norma pide declarado.
 * 2. **Fallo cerrado ante estructura irreconocible.** Un título con llaves
 *    desbalanceadas, un fragmento sin título o dos ubicaciones iguales lanzan:
 *    cortar «más o menos» un libro produciría anclas que citan otra cosa, y el
 *    desajuste aparecería en sesión, no aquí.
 */

export class LatexStructureError extends AuthoringCoreError {}

export type LatexFragmentKind = 'parte' | 'capitulo' | 'seccion';

/** Fragmento crudo: sin `relatedConcepts`, que son un dato declarado, no parseado. */
export interface LatexFragment {
  /** `archivo#slug-del-titulo` — la «ubicación» citable de P-III §3.3. */
  readonly location: string;
  readonly kind: LatexFragmentKind;
  readonly title: string;
  readonly text: string;
}

/**
 * Slug determinista del título para la ubicación. Minúsculas, sin `$`, y todo
 * lo que no sea letra ASCII o dígito se colapsa en un guion. Estable por
 * construcción: depende solo del título, no del orden ni de un contador.
 */
export function locationSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/\$/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface Encabezado {
  readonly kind: LatexFragmentKind;
  readonly title: string;
  /** Índice del primer carácter de la línea del encabezado en el texto. */
  readonly start: number;
}

/**
 * Lee el título de un encabezado `\chapter{...}` / `\section{...}` con llaves
 * balanceadas. Una lectura con `[^}]*` se rompería en silencio el día que un
 * título traiga una llave; aquí el desbalance lanza.
 */
function leerTitulo(linea: string, desde: number): { title: string; end: number } {
  let depth = 0;
  let i = desde;
  for (; i < linea.length; i++) {
    const c = linea.charAt(i);
    if (c === '{') {
      depth++;
      if (depth === 1) continue;
    } else if (c === '}') {
      depth--;
      if (depth === 0) return { title: linea.slice(desde + 1, i), end: i };
    }
    if (depth === 0 && c !== '{' && !/\s/.test(c)) break;
  }
  throw new LatexStructureError(
    `Encabezado con llaves desbalanceadas: «${linea}». Cortar «más o menos» produciría ` +
      `anclas que citan otra cosa.`,
  );
}

const MARCADOR = /^(part|chapter|section)\{/;

/**
 * Corta un archivo LaTeX en fragmentos por capítulo y sección.
 *
 * Reglas:
 * - Una línea de encabezado comentada (`% \section{...}`) no abre fragmento.
 * - Lo que precede al primer `\chapter` debe ser comentario o blanco: texto
 *   suelto ahí significa que el archivo no tiene la estructura que este parser
 *   sabe cortar, y se dice en vez de adivinar.
 * - Dos encabezados con la misma ubicación lanzan: un ancla que apunta a dos
 *   sitios no ancla (P-III §3.2, «sin anclaje por fragmento»).
 */
export function sectionsFromLatex(tex: string, file: string): readonly LatexFragment[] {
  const encabezados: Encabezado[] = [];
  let cursor = 0;

  for (const linea of tex.split('\n')) {
    const recortada = linea.trimStart();
    if (recortada.startsWith('%')) {
      cursor += linea.length + 1;
      continue;
    }
    const sinBarra = recortada.startsWith('\\') ? recortada.slice(1) : null;
    if (sinBarra !== null) {
      const m = MARCADOR.exec(sinBarra);
      if (m !== null) {
        const { title } = leerTitulo(sinBarra, m[0].length - 1);
        encabezados.push({
          kind: m[1] === 'part' ? 'parte' : m[1] === 'chapter' ? 'capitulo' : 'seccion',
          title,
          start: cursor + (linea.length - recortada.length),
        });
      }
    }
    cursor += linea.length + 1;
  }

  const primero = encabezados[0];
  if (primero === undefined) {
    throw new LatexStructureError(
      `${file} no tiene ningún \\chapter o \\section: no es el libro que W1 sabe fragmentar.`,
    );
  }

  const preambulo = tex
    .slice(0, primero.start)
    .split('\n')
    .filter((l) => l.trim() !== '' && !l.trimStart().startsWith('%'));
  const primeraLineaSuelta = preambulo[0];
  if (primeraLineaSuelta !== undefined) {
    throw new LatexStructureError(
      `${file} trae texto antes del primer \\chapter («${primeraLineaSuelta.trim().slice(0, 60)}…»). ` +
        `Fuera de la estructura capítulo/sección este parser no sabe dónde anclarlo.`,
    );
  }

  const fragmentos: LatexFragment[] = [];
  const ubicaciones = new Set<string>();

  for (let i = 0; i < encabezados.length; i++) {
    const enc = encabezados[i];
    if (enc === undefined) continue; // inalcanzable; noUncheckedIndexedAccess
    const siguiente = encabezados[i + 1];
    const fin = siguiente === undefined ? tex.length : siguiente.start;
    const location = `${file}#${locationSlug(enc.title)}`;
    if (ubicaciones.has(location)) {
      throw new LatexStructureError(
        `La ubicación ${location} aparece dos veces en ${file}: un ancla que apunta a dos ` +
          `sitios no ancla.`,
      );
    }
    ubicaciones.add(location);
    fragmentos.push({ location, kind: enc.kind, title: enc.title, text: tex.slice(enc.start, fin) });
  }

  return Object.freeze(fragmentos);
}
