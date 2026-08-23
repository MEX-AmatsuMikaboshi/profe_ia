import type { CaseSet } from './case-set.js';
import { MATERIAL_CASES } from './material-cases.js';

/**
 * Conjunto de la **medición exploratoria** (T-H4-10 ← P-III §6.1, P-II §8.1).
 *
 * ## Los mismos 200 casos, y un propósito distinto
 *
 * Los casos son literalmente `MATERIAL_CASES` —no una copia, la misma
 * referencia—, porque comparar dos candidatos con exámenes distintos no compara
 * nada. Lo que cambia es el **propósito declarado**: `pilot`, no `material`.
 *
 * Eso no es una etiqueta: `verdictFor()` rechaza dictaminar sobre un conjunto
 * que no sea `material` —«un piloto mide costo por caso; coronar un ganador con
 * él afirmaría un resultado sobre una muestra que nadie autorizó como
 * benchmark»— y `runBenchmark()` exige que plan y conjunto coincidan en
 * propósito. Así que un candidato medido con este conjunto **no puede ser
 * coronado por construcción**, que es exactamente lo que se quiso al autorizar
 * la exploración de un modelo cuya identidad el proveedor no fija.
 *
 * `observeGates()` sí lo acepta, y también a propósito: medir los seis gates y
 * dictaminar con ellos son dos cosas distintas, y la separación es de D-70.
 *
 * ## Por qué el `caseSetId` es otro
 *
 * Porque las dos corridas son distintas y sus informes conviven en el mismo
 * directorio. Un id compartido dejaría dos corridas de propósito distinto
 * indistinguibles al leer el reporte, y la que se confundiría sería siempre la
 * que no corona.
 */
export const EXPLORATION_CASE_SET: CaseSet = {
  caseSetId: 'cs-exploracion-bench01-v1',
  purpose: 'pilot',
  cases: MATERIAL_CASES,
};
