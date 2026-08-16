import { MeasureKind, ScedPhase, TransferBank } from '@profesor-ia/contracts';
import {
  canonicalForm,
  structuralSignature,
  type CanonicalProof,
} from '@profesor-ia/isomorphism-canonicalizer';
import {
  IsomorphismCalibrationPendingError,
  ReserveOverlapError,
  ReserveSeparationError,
} from './errors.js';

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

// ---------------------------------------------------------------------------
// T-H5-06 — disjunción semántica de las reservas (P-I §7.7, §5.11).
// ---------------------------------------------------------------------------

/**
 * Reserva de la que `measurement-worker` puede seleccionar para una combinación
 * de `measureKind` y fase. **Derivada del contrato de P-II §6.3**, no tabulada
 * aquí por cuenta propia: los nombres de fase son los de las dos reservas de
 * sondas y el contrato dice con todas sus letras que «`transfer_measurement`
 * solo selecciona de la reserva `TRANSFER_MEASUREMENT`».
 *
 * Las combinaciones que ninguna autoridad describe —una sonda de retención en
 * fase de línea base, pongamos— **lanzan** en vez de caer en una reserva
 * plausible: elegir una decidiría por cuenta propia de qué banco sale una
 * medida.
 */
export function measurementReserveFor(measureKind: MeasureKind, phase: ScedPhase): Reserve {
  if (measureKind === 'transfer_measurement') return 'TRANSFER_MEASUREMENT';
  if (measureKind === 'retention_probe' && phase === 'retention') return 'retention';
  if (measureKind === 'primary_probe' && phase === 'baseline') return 'probes_baseline';
  if (measureKind === 'primary_probe' && phase === 'intervention') return 'probes_intervention';
  throw new ReserveOverlapError(
    `Ninguna autoridad dice de qué reserva sale una medida ${measureKind} en fase ${phase}. ` +
      `Elegir una decidiría por cuenta propia de qué banco se toma una medida.`,
  );
}

/**
 * Las reservas de medición, **derivadas** recorriendo el contrato en vez de
 * escritas a mano: si `MeasureKind` o `ScedPhase` ganaran un miembro, la lista
 * lo seguiría o la combinación nueva lanzaría, en vez de quedarse corta en
 * silencio.
 */
export const MEASUREMENT_RESERVES: readonly Reserve[] = Object.freeze(
  [
    ...new Set(
      MeasureKind.options.flatMap((kind) =>
        ScedPhase.options.flatMap((phase) => {
          try {
            return [measurementReserveFor(kind, phase)];
          } catch {
            return [];
          }
        }),
      ),
    ),
  ].sort(),
);

/**
 * Reserva efectiva de un reactivo a efectos de disjunción.
 *
 * `replacement` no la fija: P-I §13.2 dice que una reposición «usa reserva
 * independiente» y P-II §6.1 da a `measurement-worker` autoridad sobre «la
 * reposición desde reserva cuando la regla lo permita», pero **ninguna
 * autoridad dice si el banco de reposición es de enseñanza o de medición**. Se
 * resuelve como los demás mapeos que faltan (D-15, D-18): es dato, y se exige
 * declarado. Suponerlo de enseñanza dejaría entrar una reposición isomorfa a
 * una sonda; suponerlo de medición prohibiría reposiciones legítimas de
 * práctica. Es D-21.
 */
export function effectiveReserve(item: {
  readonly reserve: Reserve;
  readonly replacesReserve?: Reserve;
  readonly itemId: string;
}): Reserve {
  if (item.reserve !== 'replacement') return item.reserve;
  if (item.replacesReserve === undefined) {
    throw new ReserveOverlapError(
      `${item.itemId} está en la reserva de reposición y no declara a qué reserva repone. Sin ese ` +
        `dato no se sabe si le aplica la disjunción de medición, y suponerlo dejaría pasar una ` +
        `reposición isomorfa a una sonda o prohibiría una de práctica.`,
    );
  }
  if (item.replacesReserve === 'replacement') {
    throw new ReserveOverlapError(`${item.itemId} declara reponer a la propia reserva de reposición.`);
  }
  return item.replacesReserve;
}

export function isMeasurementReserve(reserve: Reserve): boolean {
  return MEASUREMENT_RESERVES.includes(reserve);
}

/**
 * ¿Una colisión entre estas dos reservas está **prohibida**?
 *
 * La palabra de P-I §7.7 es «isomorfismos **prohibidos**», no «isomorfismos», y
 * la diferencia decide el diseño entero:
 *
 * - **Dentro de una misma reserva, no está prohibida**: P-I §7.8 define familia
 *   como los candidatos que comparten plantilla, función de banco, KC objetivo y
 *   **la misma `structural_signature`**, y dice que renombrar átomos, reordenar
 *   pasos independientes o cambiar la redacción **no crean una familia nueva**.
 *   Es decir: los miembros de una familia son isomorfos entre sí por
 *   definición. Prohibirlo dejaría toda familia en un solo miembro y volvería
 *   inalcanzables los pisos de §7.8 y de P-III §4.2.
 * - **Entre dos reservas de enseñanza, tampoco**: practicar guiado y después
 *   independiente sobre la misma estructura es scaffolding y fading, no
 *   contaminación.
 * - **En cuanto una de las dos es de medición, sí**: «las reservas de medición
 *   son disjuntas también respecto de duplicados/isomorfismos prohibidos», y
 *   §5.11 lo dice de las dos categorías de transferencia con todas sus letras.
 *   Un reactivo practicado que reaparece como sonda mide lo que el alumno acaba
 *   de hacer, no lo que aprendió.
 */
export function collisionProhibited(a: Reserve, b: Reserve): boolean {
  // `replacement` nunca es una reserva **efectiva**: sin saber qué repone no se
  // puede decir si le aplica la disjunción de medición, y responder `false`
  // dejaría pasar en silencio una reposición isomorfa a una sonda.
  for (const reserva of [a, b]) {
    if (reserva === 'replacement') {
      throw new ReserveOverlapError(
        'Se preguntó por una colisión con la reserva de reposición sin resolverla antes con ' +
          '`effectiveReserve()`. Sin saber qué repone, la respuesta sería una suposición (D-21).',
      );
    }
  }
  if (a === b) return false;
  return isMeasurementReserve(a) || isMeasurementReserve(b);
}

/**
 * P-I §7.7, literal: «Un reactivo consumido en práctica, recuperación o
 * `TRANSFER_MASTERY` no puede usarse como medida primaria, como
 * `TRANSFER_MEASUREMENT` ni como retención.»
 *
 * «Práctica» son las dos reservas de práctica que §7.7 enumera —cubrir solo una
 * sería arbitrario— y «medida primaria» son las dos de sondas, que es de donde
 * sale `probe_accuracy` (§10.4). El consumo ocurre en sesión y lo gobierna
 * `measurement-worker` (`T-H6-06`); esta tabla es la razón por la que los
 * bancos tienen que estar separados antes, y la que aquel tendrá que aplicar.
 */
export const CONSUMPTION_EXCLUSIONS: Readonly<Record<string, readonly Reserve[]>> = Object.freeze({
  guided_practice: Object.freeze<Reserve[]>([
    'probes_baseline',
    'probes_intervention',
    'TRANSFER_MEASUREMENT',
    'retention',
  ]),
  independent_practice: Object.freeze<Reserve[]>([
    'probes_baseline',
    'probes_intervention',
    'TRANSFER_MEASUREMENT',
    'retention',
  ]),
  recovery: Object.freeze<Reserve[]>([
    'probes_baseline',
    'probes_intervention',
    'TRANSFER_MEASUREMENT',
    'retention',
  ]),
  TRANSFER_MASTERY: Object.freeze<Reserve[]>([
    'probes_baseline',
    'probes_intervention',
    'TRANSFER_MEASUREMENT',
    'retention',
  ]),
});

export interface PackageItem {
  readonly itemId: string;
  readonly reserve: Reserve;
  /** Obligatorio cuando `reserve` es `replacement` (D-21). */
  readonly replacesReserve?: Reserve;
  /** Certificado re-verificado. Firma y forma canónica se **recalculan** de aquí. */
  readonly proof: CanonicalProof;
  /** Redacción que ve el alumno; base del control de superficie de §5.11. */
  readonly promptText: string;
}

export const COLLISION_KINDS = [
  'duplicate_item_id',
  'same_id_in_two_reserves',
  'trivial_duplicate',
  'isomorphic',
  'identical_surface',
] as const;
export type CollisionKind = (typeof COLLISION_KINDS)[number];

export interface ReserveCollision {
  readonly kind: CollisionKind;
  readonly itemA: string;
  readonly reserveA: Reserve;
  readonly itemB: string;
  readonly reserveB: Reserve;
}

export interface TransferIsolation {
  readonly masteryItems: number;
  readonly measurementItems: number;
  readonly pairsCompared: number;
  /**
   * `null` cuando alguno de los dos bancos está vacío. **No es `true`**: sin
   * pares que comparar no hay aislamiento que afirmar, y un `true` ahí sería la
   * prueba que pasa por vacío —justo la que `DUP-01` existe para evitar—.
   */
  readonly isolated: boolean | null;
}

export interface ReserveDisjointnessReport {
  readonly itemsChecked: number;
  readonly measurementReserves: readonly Reserve[];
  readonly transferIsolation: TransferIsolation;
  /**
   * Declarado siempre. El informe dice **qué colisiones detectó el detector
   * congelado**, no que no haya otras: su precisión y recall son `CAL-07`, y se
   * validan en H5/H10.
   */
  readonly detectorPrecisionValidated: false;
}

/** Superficie normalizada: solo se colapsan los espacios. Sin umbrales. */
const superficie = (texto: string): string => texto.replace(/\s+/gu, ' ').trim();

/**
 * Disjunción de reservas del paquete (T-H5-06).
 *
 * Comprueba, en este orden y **reportando todas las causas**, no la primera:
 *
 * 1. ningún id en dos reservas —«sin solapamiento» (§7.7) y «los bancos, IDs y
 *    eventos de ambas categorías son distintos» (§5.11)—;
 * 2. sin duplicado trivial, isomorfismo ni superficie idéntica entre reservas
 *    donde la colisión está prohibida (`collisionProhibited`).
 *
 * El control de superficie existe porque §5.11 dice que el detector opera sobre
 * la representación estructural **además de controles de superficie**. El de
 * aquí es el que no necesita umbral: dos redacciones que solo difieren en
 * espacios son la misma. Cualquier medida de *parecido* lo necesitaría, y por
 * eso `surfaceSimilarity()` falla cerrado.
 */
export function assertReserveDisjointness(
  items: readonly PackageItem[],
): ReserveDisjointnessReport {
  const reservaPorId = new Map<string, Reserve>();
  const colisiones: ReserveCollision[] = [];

  for (const item of items) {
    const previa = reservaPorId.get(item.itemId);
    if (previa !== undefined) {
      // Un id repetido **no** es un duplicado estructural, y clasificarlo como
      // tal diría que dos reactivos comparten estructura cuando lo que
      // comparten es el nombre. Son defectos distintos y se arreglan distinto.
      colisiones.push({
        kind: previa === item.reserve ? 'duplicate_item_id' : 'same_id_in_two_reserves',
        itemA: item.itemId,
        reserveA: previa,
        itemB: item.itemId,
        reserveB: item.reserve,
      });
    }
    reservaPorId.set(item.itemId, item.reserve);
  }

  const preparados = items.map((item) => ({
    item,
    efectiva: effectiveReserve(item),
    firma: structuralSignature(item.proof),
    forma: canonicalForm(item.proof),
    superficie: superficie(item.promptText),
  }));

  let paresDeTransferencia = 0;

  for (let i = 0; i < preparados.length; i += 1) {
    for (let j = i + 1; j < preparados.length; j += 1) {
      const a = preparados[i];
      const b = preparados[j];
      if (a === undefined || b === undefined) continue;

      const esParDeTransferencia =
        (a.efectiva === 'TRANSFER_MASTERY' && b.efectiva === 'TRANSFER_MEASUREMENT') ||
        (a.efectiva === 'TRANSFER_MEASUREMENT' && b.efectiva === 'TRANSFER_MASTERY');
      if (esParDeTransferencia) paresDeTransferencia += 1;

      if (!collisionProhibited(a.efectiva, b.efectiva)) continue;

      const kind: CollisionKind | null =
        a.forma === b.forma
          ? 'trivial_duplicate'
          : a.firma === b.firma
            ? 'isomorphic'
            : a.superficie === b.superficie
              ? 'identical_surface'
              : null;

      if (kind !== null) {
        colisiones.push({
          kind,
          itemA: a.item.itemId,
          reserveA: a.efectiva,
          itemB: b.item.itemId,
          reserveB: b.efectiva,
        });
      }
    }
  }

  if (colisiones.length > 0) {
    const detalle = colisiones
      .map((c) => `${c.itemA} (${c.reserveA}) ↔ ${c.itemB} (${c.reserveB}): ${c.kind}`)
      .join('; ');
    throw new ReserveOverlapError(
      `Las reservas se solapan en ${colisiones.length} punto(s): ${detalle}. P-I §7.7 exige ` +
        `reservas sin solapamiento y disjuntas también respecto de duplicados e isomorfismos; ` +
        `§5.11 lo dice de las dos categorías de transferencia con todas sus letras.`,
    );
  }

  const mastery = preparados.filter((p) => p.efectiva === 'TRANSFER_MASTERY').length;
  const measurement = preparados.filter((p) => p.efectiva === 'TRANSFER_MEASUREMENT').length;

  return Object.freeze({
    itemsChecked: items.length,
    measurementReserves: MEASUREMENT_RESERVES,
    transferIsolation: Object.freeze({
      masteryItems: mastery,
      measurementItems: measurement,
      pairsCompared: paresDeTransferencia,
      isolated: mastery === 0 || measurement === 0 ? null : true,
    }),
    detectorPrecisionValidated: false,
  });
}

/**
 * Afirmar que el aislamiento de transferencia está **demostrado**. No se puede
 * todavía, y este es el punto donde `DUP-01` se enchufa.
 *
 * `assertReserveDisjointness()` dice qué colisiones **detectó** el detector
 * congelado. Que no detectara ninguna no demuestra que no las haya: eso exige la
 * precisión y el recall del detector, que son `CAL-07`/`CAL-ISOMORPHISM` y se
 * validan en H5/H10 con sus falsos positivos y negativos auditados (§5.11).
 * Devolver aquí un «aislado» convertiría la ausencia de hallazgos en evidencia.
 */
export function assertTransferIsolationDemonstrated(report: ReserveDisjointnessReport): never {
  throw new IsomorphismCalibrationPendingError(
    `el informe cubrió ${report.transferIsolation.pairsCompared} par(es) TRANSFER_MASTERY↔` +
      `TRANSFER_MEASUREMENT y no detectó colisiones, pero la precisión y el recall del detector no ` +
      `están validados, así que «no detecté» no es «no hay» (DUP-01)`,
    'H5/H10 / T-H10-09',
  );
}

/**
 * Parecido de superficie entre dos redacciones. **Falla cerrado**: cualquier
 * medida de parecido necesita una tolerancia, y las tolerancias del detector son
 * `CAL-ISOMORPHISM`. El control de superficie que sí opera es la igualdad
 * normalizada, que no necesita ninguna.
 */
export function surfaceSimilarity(a: string, b: string): never {
  throw new IsomorphismCalibrationPendingError(
    `no hay tolerancia congelada con la que decidir si «${superficie(a).slice(0, 24)}…» y ` +
      `«${superficie(b).slice(0, 24)}…» son suficientemente parecidas; un umbral inventado movería ` +
      `qué reactivos entran a las reservas de medición`,
    'H5/H10 / T-H10-09',
  );
}

/**
 * Los dos bancos de transferencia, **derivados** del contrato (P-I §5.11).
 *
 * Se comprueba que cada miembro del enum es una reserva de §7.7 en vez de
 * castearlo: un `as Reserve` a ciegas dejaría que el contrato y el catálogo se
 * separaran sin que nada lo notara, que es el mismo motivo por el que los
 * `rule_id` del mapa de KC se derivan de `logic-core`.
 *
 * Los dos parámetros llevan valor por omisión —como `findCycles(edges)`— porque
 * con el contrato y el catálogo de hoy la guarda **no se puede disparar desde
 * fuera**: solo salta si los dos divergen, y hoy no divergen. Sin inyección, la
 * comprobación sería indistinguible de no tenerla.
 */
export function transferBanksFrom(
  bankNames: readonly string[] = TransferBank.options,
  reserves: readonly Reserve[] = RESERVES,
): readonly Reserve[] {
  return Object.freeze(
    bankNames.map((banco) => {
      const reserva = reserves.find((r) => r === banco);
      if (reserva === undefined) {
        throw new ReserveOverlapError(
          `El contrato nombra el banco de transferencia ${banco}, que no está entre las diez ` +
            `reservas de P-I §7.7. Contrato y catálogo se han separado.`,
        );
      }
      return reserva;
    }),
  );
}

export const TRANSFER_BANKS: readonly Reserve[] = transferBanksFrom();
