import { canonicalizeFormula } from '@profesor-ia/isomorphism-canonicalizer';

import { SurfaceControlError } from './errors.js';
import { isMeasurementReserve, type Reserve } from './reserves.js';

/**
 * Controles de **superficie** entre una sonda y los reactivos de enseñanza de su
 * KC (D-67 ← P-I §5.11).
 *
 * **Por qué existen.** §5.11 dice, de la protección de reservas, que «el
 * detector opera sobre representación estructural/grafo normalizado **además de
 * controles de superficie**». La parte estructural estaba —es
 * `structuralSignature()` y la aplica `collisionProhibited()`—; **la de
 * superficie no existía**. El hueco importa porque las dos miden cosas
 * distintas: una envoltura que añade un paso cambia la firma estructural y deja
 * la superficie intacta, así que el control estructural la aprueba y el alumno
 * lee exactamente las mismas premisas que ya practicó.
 *
 * **Y para transferencia la norma es más fuerte y explícita.** §5.11 abre
 * diciendo que una actividad de transferencia «exige aplicar el mismo KC o
 * estructura profunda en una forma superficial **suficientemente distinta de las
 * prácticas inmediatas**». Eso no es una heurística del proyecto: es el
 * requisito que define la reserva.
 *
 * **Qué se comprueba y qué solo se cuenta.** La regla de transferencia y la de
 * enunciado-renombrado salen del texto normativo y **fallan**. El solapamiento
 * de premisas en las reservas que no son de transferencia **se censa y se
 * informa, pero no se declara violación**: ninguna autoridad fija ahí un umbral,
 * e inventarlo sería decidir por cuenta propia. Contarlo es lo que impide que el
 * control pase por vacío.
 */

/** Clasificación de superficie de una sonda frente a un reactivo de enseñanza. */
export type SurfaceOverlap =
  /** Premisas y meta coinciden bajo renombrado de átomos: §7.8 dice que eso no es forma nueva. */
  | 'statement_renaming'
  /** Las premisas son las mismas cadenas, carácter por carácter. */
  | 'premises_literal'
  /** Las premisas coinciden bajo renombrado de átomos. */
  | 'premises_renaming'
  /** Nada de lo anterior. */
  | 'distinct';

export interface SurfaceItem {
  readonly itemId: string;
  /** Reserva **efectiva**: resuelve `replacement` con `effectiveReserve()` antes. */
  readonly reserve: Reserve;
  readonly targetKcId: string;
  readonly premises: readonly string[];
  readonly goal: string;
}

export interface SurfaceFinding {
  readonly itemId: string;
  readonly reserve: Reserve;
  readonly targetKcId: string;
  /** Reactivo de enseñanza con el que se solapa. */
  readonly comparedWith: string;
  readonly overlap: Exclude<SurfaceOverlap, 'distinct'>;
}

const listaCanonica = (premises: readonly string[]): string =>
  JSON.stringify([...premises].map(canonicalizeFormula).sort());
const listaLiteral = (premises: readonly string[]): string => JSON.stringify([...premises].sort());

/** Solapamiento de superficie entre dos enunciados, del más fuerte al más débil. */
export function surfaceOverlap(probe: SurfaceItem, teaching: SurfaceItem): SurfaceOverlap {
  const mismasPremisasCanon = listaCanonica(probe.premises) === listaCanonica(teaching.premises);
  if (mismasPremisasCanon && canonicalizeFormula(probe.goal) === canonicalizeFormula(teaching.goal)) {
    return 'statement_renaming';
  }
  if (listaLiteral(probe.premises) === listaLiteral(teaching.premises)) return 'premises_literal';
  if (mismasPremisasCanon) return 'premises_renaming';
  return 'distinct';
}

/**
 * Reservas a las que aplica el requisito **explícito** de §5.11 de forma
 * superficial suficientemente distinta de las prácticas inmediatas.
 *
 * Son las dos categorías de transferencia, que es de lo que habla el párrafo. No
 * se extiende a las demás por analogía: el texto no lo dice, y estirarlo sería
 * inventar el umbral que precisamente no está fijado.
 */
export const TRANSFER_SURFACE_RESERVES: readonly Reserve[] = Object.freeze([
  'TRANSFER_MASTERY',
  'TRANSFER_MEASUREMENT',
] as const);

/** Solapamientos que **incumplen** una regla normativa, no los que solo se cuentan. */
export function surfaceControlViolations(
  probes: readonly SurfaceItem[],
  teaching: readonly SurfaceItem[],
): readonly SurfaceFinding[] {
  const porKc = new Map<string, SurfaceItem[]>();
  for (const t of teaching) {
    if (isMeasurementReserve(t.reserve)) {
      throw new SurfaceControlError(
        `${t.itemId} se pasó como reactivo de enseñanza y está en la reserva de medición ` +
          `${t.reserve}. Comparar una sonda contra otra sonda es el control estructural de ` +
          `\`collisionProhibited()\`, no éste.`,
      );
    }
    porKc.set(t.targetKcId, [...(porKc.get(t.targetKcId) ?? []), t]);
  }

  const hallazgos: SurfaceFinding[] = [];
  for (const sonda of probes) {
    if (!isMeasurementReserve(sonda.reserve)) continue;
    const esTransferencia = TRANSFER_SURFACE_RESERVES.includes(sonda.reserve);
    for (const ensenanza of porKc.get(sonda.targetKcId) ?? []) {
      const overlap = surfaceOverlap(sonda, ensenanza);
      if (overlap === 'distinct') continue;
      // Enunciado idéntico bajo renombrado: §7.8 dice que renombrar átomos no
      // crea forma nueva, así que la sonda **es** el reactivo practicado.
      // Aplica a toda reserva de medición.
      if (overlap === 'statement_renaming') {
        hallazgos.push({ ...comun(sonda, ensenanza), overlap });
        continue;
      }
      // Premisas compartidas: solo incumple en transferencia, donde §5.11 exige
      // «suficientemente distinta de las prácticas inmediatas». Fuera de ahí se
      // cuenta con `surfaceOverlapCensus()` y no se declara violación.
      if (esTransferencia) hallazgos.push({ ...comun(sonda, ensenanza), overlap });
    }
  }
  return hallazgos;
}

const comun = (sonda: SurfaceItem, ensenanza: SurfaceItem) => ({
  itemId: sonda.itemId,
  reserve: sonda.reserve,
  targetKcId: sonda.targetKcId,
  comparedWith: ensenanza.itemId,
});

/**
 * Censo de solapamiento por reserva, **incluido el que no es violación**.
 *
 * §5.11 exige que los controles de superficie **operen**, y un control que no
 * cuenta lo que ve no demuestra haber operado: sobre un banco vacío devolvería
 * cero violaciones y parecería sano. Además, el solapamiento fuera de
 * transferencia es el dato con el que el propietario puede decidir si hace falta
 * un umbral ahí; hoy no lo fija ninguna autoridad.
 */
export function surfaceOverlapCensus(
  probes: readonly SurfaceItem[],
  teaching: readonly SurfaceItem[],
): Readonly<Record<string, Readonly<Record<SurfaceOverlap, number>>>> {
  const porKc = new Map<string, SurfaceItem[]>();
  for (const t of teaching) porKc.set(t.targetKcId, [...(porKc.get(t.targetKcId) ?? []), t]);

  const censo: Record<string, Record<SurfaceOverlap, number>> = {};
  for (const sonda of probes) {
    if (!isMeasurementReserve(sonda.reserve)) continue;
    const fila = (censo[sonda.reserve] ??= {
      statement_renaming: 0,
      premises_literal: 0,
      premises_renaming: 0,
      distinct: 0,
    });
    // El peor solapamiento contra cualquier reactivo de enseñanza del KC, para
    // que una sonda cuente una vez y no una por comparación.
    const orden: readonly SurfaceOverlap[] = [
      'statement_renaming',
      'premises_literal',
      'premises_renaming',
      'distinct',
    ];
    let peor: SurfaceOverlap = 'distinct';
    for (const ensenanza of porKc.get(sonda.targetKcId) ?? []) {
      const o = surfaceOverlap(sonda, ensenanza);
      if (orden.indexOf(o) < orden.indexOf(peor)) peor = o;
    }
    fila[peor] += 1;
  }
  return censo;
}

/** Igual que `surfaceControlViolations`, pero lanza. Pensado para W3 y el linter. */
export function assertSurfaceControl(
  probes: readonly SurfaceItem[],
  teaching: readonly SurfaceItem[],
): void {
  const hallazgos = surfaceControlViolations(probes, teaching);
  if (hallazgos.length === 0) return;
  const detalle = hallazgos
    .map((h) => `${h.itemId} (${h.reserve}) ~ ${h.comparedWith} [${h.overlap}]`)
    .join('; ');
  throw new SurfaceControlError(
    `${hallazgos.length} sonda(s) no superan el control de superficie de §5.11: ${detalle}.`,
  );
}
