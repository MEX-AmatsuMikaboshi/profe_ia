import { createHash } from 'node:crypto';

/**
 * Mango de ancla: el identificador **corto** con el que un modelo cita un
 * fragmento autorizado (D-77 ← P-II §8.4).
 *
 * ## Por qué existe
 *
 * P-II §8.4 fija `anchors: string[]` y exige que las anclas **resuelvan**. No
 * dice nada del formato de la cadena: el identificador de ~105 caracteres que
 * BENCH-01 pedía copiar —
 * `forallx-yyc/tfl-deduccion-natural@master@ec34df8 (2025-12-18)#forallx-yyc-tfl.tex#truth-functional-logic`
 * — es decisión nuestra, no norma. Y salió cara: en la corrida material del
 * 2026-08-23, `claude-haiku-4-5` **acortó el `fragmentId`** y produjo 136 anclas
 * inexistentes, hundiendo el gate a 15.4 % contra un piso de 95 % (D-75).
 *
 * El defecto es del identificador, no del candidato. Obliga a transcribir
 * literalmente una cadena con **espacio, paréntesis, dos `@`, dos `#` y una
 * barra** — seis clases de carácter que invitan al error—, gasta tokens en cada
 * fragmento de cada petición, y no aporta nada que una tabla de correspondencia
 * no dé.
 *
 * ## Por qué es derivado y no un correlativo
 *
 * Por la misma razón que `fragmentId()` lo es (D-17, §3.3 «ID estable»): un
 * contador cambia al reordenar o al insertar una sección, que es exactamente lo
 * que «estable» excluye. El mango se deriva del identificador canónico, así que
 * es función del fragmento y de nada más.
 *
 * ## Por qué es opaco, y eso es la característica
 *
 * Un mango legible —`F-truth-functional-logic`— volvería a tener estructura
 * visible, y la estructura visible es justo lo que un modelo «acorta». Ocho
 * dígitos hexadecimales no tienen nada que recortar: o se copian o no resuelven.
 * Un mango mal transcrito cae en `anchor_inexistente` en vez de resolver por
 * accidente a otro fragmento, que es el modo de fallo que hay que evitar.
 *
 * ## Lo que este módulo **no** hace
 *
 * No sustituye a `fragmentId`. El identificador canónico sigue siendo el de
 * proveniencia y el que viaja a `anchors.yaml`, al registro de auditoría y a los
 * artefactos ya escritos. El mango es una **proyección de presentación**: lo que
 * se le enseña al modelo y lo que el modelo devuelve. El validador de anclaje
 * acepta los dos, para que nada de lo ya emitido deje de resolver.
 */

/**
 * Dígitos hexadecimales del mango.
 *
 * Ocho son 32 bits. Sobre los 77 fragmentos del corpus vigente la probabilidad
 * de colisión es ~77²/(2·2³²) ≈ 7·10⁻⁷; sobre 10 000 fragmentos seguiría por
 * debajo de 1.2·10⁻². No se confía en esa cifra: `buildFragmentHandleTable()`
 * **comprueba** la unicidad y falla cerrado. El número está aquí para que
 * ampliarlo sea un cambio de una línea con su motivo al lado.
 */
const DIGITOS_DEL_MANGO = 8;

/** Prefijo. Marca la cadena como mango y no como prosa ni como id canónico. */
const PREFIJO = 'F-';

/** Forma exacta de un mango bien construido. */
export const FRAGMENT_HANDLE_PATTERN = /^F-[0-9a-f]{8}$/;

/**
 * Dos fragmentos distintos con el mismo mango. Es un fallo de construcción del
 * paquete de contenido, no una entrada del modelo: se lanza al armar la tabla,
 * antes de que nadie ancle nada.
 */
export class FragmentHandleCollisionError extends Error {
  override readonly name = 'FragmentHandleCollisionError';
}

/**
 * Mango de un fragmento, derivado de su identificador canónico.
 *
 * Determinista y sin estado: mismo `fragmentId`, mismo mango, en cualquier
 * proceso y en cualquier corrida. No consulta reloj, entorno ni azar.
 */
export function fragmentHandle(fragmentId: string): string {
  const digest = createHash('sha256').update(fragmentId, 'utf8').digest('hex');
  return `${PREFIJO}${digest.slice(0, DIGITOS_DEL_MANGO)}`;
}

/** Una fila de la tabla de correspondencia. */
export interface FragmentHandleEntry {
  readonly handle: string;
  readonly fragmentId: string;
}

/**
 * Tabla de correspondencia mango → identificador canónico.
 *
 * Falla cerrado ante colisión. Un mango repetido haría que un ancla resolviera
 * al fragmento equivocado —el modelo citaría A y el validador daría por bueno
 * B—, y una atribución falsa que **pasa** el validador es peor que una que
 * falla: I-7 dejaría de significar nada.
 */
export function buildFragmentHandleTable(
  fragmentIds: readonly string[],
): ReadonlyMap<string, string> {
  const tabla = new Map<string, string>();
  for (const fragmentId of fragmentIds) {
    const handle = fragmentHandle(fragmentId);
    const previo = tabla.get(handle);
    if (previo !== undefined && previo !== fragmentId) {
      throw new FragmentHandleCollisionError(
        `El mango ${handle} corresponde a dos fragmentos distintos:\n` +
          `  - ${previo}\n  - ${fragmentId}\n` +
          `Amplía DIGITOS_DEL_MANGO en fragment-handle.ts. No se desempata en ` +
          `silencio: un mango ambiguo haría resolver un ancla al fragmento ` +
          `equivocado y eso vacía I-7.`,
      );
    }
    tabla.set(handle, fragmentId);
  }
  return tabla;
}

/**
 * La tabla como lista ordenada por mango, para publicarla como artefacto
 * auditable. El orden es del mango y no de aparición: un artefacto que cambia
 * de orden al reordenar el corpus produce diffs que no significan nada.
 */
export function fragmentHandleEntries(
  fragmentIds: readonly string[],
): readonly FragmentHandleEntry[] {
  const tabla = buildFragmentHandleTable(fragmentIds);
  return [...tabla.entries()]
    .map(([handle, fragmentId]) => ({ handle, fragmentId }))
    .sort((a, b) => a.handle.localeCompare(b.handle));
}
