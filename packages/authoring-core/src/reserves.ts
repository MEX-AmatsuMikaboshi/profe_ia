import { ReserveSeparationError } from './errors.js';

/**
 * Reservas del paquete y su separación **física** (T-H5-05, paso 10 de W3 ←
 * P-I §7.7 y P-II §3.2).
 *
 * Aquí solo vive la separación física: en qué directorio del árbol obligatorio
 * cae cada reserva y dónde va el certificado. La disjunción semántica —que un
 * reactivo consumido en práctica no reaparezca como medida primaria, y que las
 * reservas de medición sean disjuntas **también por isomorfismo**— es
 * `T-H5-06`.
 *
 * **La asimetría del árbol es real y no se tapa.** P-I §7.7 enumera **diez**
 * reservas; el árbol obligatorio de P-II §3.2 da **nueve** directorios bajo
 * `items/`, porque `TRANSFER_MASTERY` y `TRANSFER_MEASUREMENT` comparten
 * `items/transfer/`. El árbol es estructura obligatoria del Maestro y el
 * Maestro está por encima del plan (§0.1), así que no se crea un décimo
 * directorio: se declara que esas dos reservas **no son separables por
 * directorio** y se deja el hecho a la vista para que `T-H5-06` las separe por
 * otro medio. Es D-20.
 */

/** Las diez reservas literales de P-I §7.7, en su orden. */
export const RESERVES = [
  'diagnostic',
  'guided_practice',
  'independent_practice',
  'recovery',
  'probes_baseline',
  'probes_intervention',
  'TRANSFER_MASTERY',
  'TRANSFER_MEASUREMENT',
  'retention',
  'replacement',
] as const;
export type Reserve = (typeof RESERVES)[number];

/** Directorio de soluciones. «No se monta en los contenedores del agente ni de web» (P-II §3.2). */
export const SOLUTIONS_DIRECTORY = 'solutions-private' as const;

/** Raíz de los bancos de reactivos en el árbol obligatorio. */
export const ITEMS_ROOT = 'items' as const;

/**
 * Reserva → directorio del árbol obligatorio de P-II §3.2.
 *
 * Las dos de transferencia apuntan al mismo, y eso **es** el árbol: no es un
 * descuido de esta tabla.
 */
export const RESERVE_DIRECTORY: Readonly<Record<Reserve, string>> = Object.freeze({
  diagnostic: `${ITEMS_ROOT}/diagnostic`,
  guided_practice: `${ITEMS_ROOT}/guided-practice`,
  independent_practice: `${ITEMS_ROOT}/independent-practice`,
  recovery: `${ITEMS_ROOT}/recovery`,
  probes_baseline: `${ITEMS_ROOT}/probes-baseline`,
  probes_intervention: `${ITEMS_ROOT}/probes-intervention`,
  TRANSFER_MASTERY: `${ITEMS_ROOT}/transfer`,
  TRANSFER_MEASUREMENT: `${ITEMS_ROOT}/transfer`,
  retention: `${ITEMS_ROOT}/retention`,
  replacement: `${ITEMS_ROOT}/replacement`,
});

/**
 * Grupos de reservas que comparten directorio, **derivados** de la tabla en vez
 * de escritos aparte: si alguien reasignara un directorio, la lista lo seguiría
 * sola. Copiarla la dejaría envejecer sin que nada lo notara, que es el mismo
 * motivo por el que los `rule_id` del mapa de KC se derivan de `logic-core`.
 */
export function reservesSharingDirectory(
  table: Readonly<Record<Reserve, string>> = RESERVE_DIRECTORY,
): readonly (readonly Reserve[])[] {
  const porDirectorio = new Map<string, Reserve[]>();
  for (const reserva of RESERVES) {
    const directorio = table[reserva];
    porDirectorio.set(directorio, [...(porDirectorio.get(directorio) ?? []), reserva]);
  }
  return Object.freeze(
    [...porDirectorio.values()].filter((grupo) => grupo.length > 1).map((g) => Object.freeze(g)),
  );
}

/**
 * ¿La reserva queda separada de todas las demás por el solo hecho de estar en
 * su directorio?
 *
 * Falso para las dos de transferencia. Devolver `true` para todas sería la
 * afirmación cómoda: diría que la separación física está resuelta justo donde
 * el árbol no la resuelve, y `T-H5-06` heredaría una garantía que no existe.
 */
export function physicallySeparable(reserve: Reserve): boolean {
  return !reservesSharingDirectory().some((grupo) => grupo.includes(reserve));
}

export interface ItemPlacement {
  readonly itemId: string;
  readonly reserve: Reserve;
  /** Ruta del fichero del reactivo dentro del paquete de contenido. */
  readonly path: string;
  /** Ruta del certificado. Todo reactivo aceptado por W3 tiene solución. */
  readonly solutionPath: string;
}

export interface PhysicalSeparationReport {
  readonly placements: readonly ItemPlacement[];
  /**
   * Reservas que el árbol **no** separa por directorio. Se devuelve siempre,
   * incluso vacía: un informe que lo omitiera se leería como que la separación
   * física quedó completa.
   */
  readonly notSeparatedByDirectory: readonly (readonly Reserve[])[];
}

const bajoDirectorio = (ruta: string, directorio: string): boolean =>
  ruta === directorio || ruta.startsWith(`${directorio}/`);

/**
 * Separación física del paso 10 de W3.
 *
 * Comprueba cuatro cosas y ninguna es cosmética:
 *
 * 1. cada reactivo cae en el directorio de **su** reserva —un reactivo de
 *    recuperación archivado en `probes-baseline/` estaría en la reserva de
 *    medición sin que su etiqueta lo dijera—;
 * 2. ningún reactivo aparece en dos reservas;
 * 3. dos reactivos no comparten ruta;
 * 4. el certificado va bajo `solutions-private/` y **nunca** bajo `items/` ni
 *    `hints/`. Es la frontera de I-2: el contenedor del agente monta `items/` y
 *    no monta `solutions-private/`, así que un certificado escrito en `items/`
 *    entraría en el proceso que tiene prohibido leerlo.
 */
export function assertPhysicalSeparation(
  placements: readonly ItemPlacement[],
): PhysicalSeparationReport {
  const reservaPorItem = new Map<string, Reserve>();
  const itemPorRuta = new Map<string, string>();

  for (const p of placements) {
    const directorio = RESERVE_DIRECTORY[p.reserve];
    if (directorio === undefined) {
      throw new ReserveSeparationError(
        `${p.itemId} declara la reserva ${p.reserve}, que no está entre las diez de P-I §7.7.`,
      );
    }
    if (!bajoDirectorio(p.path, directorio)) {
      throw new ReserveSeparationError(
        `${p.itemId} es de la reserva ${p.reserve} y está archivado en «${p.path}», fuera de ` +
          `«${directorio}». La reserva de un reactivo es dónde está, no lo que dice su etiqueta.`,
      );
    }

    const yaVisto = reservaPorItem.get(p.itemId);
    if (yaVisto !== undefined && yaVisto !== p.reserve) {
      throw new ReserveSeparationError(
        `${p.itemId} está a la vez en ${yaVisto} y en ${p.reserve}. P-I §7.7 exige reservas «sin ` +
          `solapamiento»: un reactivo consumido en una de ellas dejaría de servir en la otra.`,
      );
    }
    reservaPorItem.set(p.itemId, p.reserve);

    const ocupante = itemPorRuta.get(p.path);
    if (ocupante !== undefined && ocupante !== p.itemId) {
      throw new ReserveSeparationError(
        `«${p.path}» la reclaman ${ocupante} y ${p.itemId}. Uno de los dos sobreescribiría al otro.`,
      );
    }
    itemPorRuta.set(p.path, p.itemId);

    if (!bajoDirectorio(p.solutionPath, SOLUTIONS_DIRECTORY)) {
      throw new ReserveSeparationError(
        `El certificado de ${p.itemId} se escribiría en «${p.solutionPath}», fuera de ` +
          `«${SOLUTIONS_DIRECTORY}». Ese directorio no se monta en el contenedor del agente ni en ` +
          `el de web (P-II §3.2, I-2); escribir la solución en cualquier otro sitio la mete en un ` +
          `proceso que tiene prohibido leerla.`,
      );
    }
  }

  return Object.freeze({
    placements: Object.freeze([...placements]),
    notSeparatedByDirectory: reservesSharingDirectory(),
  });
}
