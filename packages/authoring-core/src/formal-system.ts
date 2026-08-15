import {
  AUTHORIZED_CALCULUS_SHA256,
  AUTHORIZED_CALCULUS_VERSION,
  FORMAL_SYSTEM_ID,
  SOURCE_SNAPSHOT_SHA256,
  SOURCE_SNAPSHOT_SIZE_BYTES,
} from '@profesor-ia/logic-core';
import { ForeignSystemInMajorityError, NoEligibleClaimsError } from './errors.js';

/**
 * Sistema formal objetivo y clasificación de diferencias
 * (T-H45-03 ← P-I §7.0, `DEC-W0-SCOPE-001`, `DEC-CALCULUS-001`).
 *
 * La regla que sostiene todo esto es una sola frase del Maestro: «la mayoría
 * simple de fuentes **no decide** una cuestión cuando describen sistemas
 * distintos». Sin ella, tres manuales de otro cálculo podrían "corregir" el
 * cálculo autorizado por votación, que es exactamente cómo se contamina un
 * sistema formal.
 *
 * El ancla **se deriva** de `logic-core` en vez de transcribirse: si se copiara,
 * las dos podrían separarse sin que nada lo notara.
 */

export const TARGET_FORMAL_SYSTEM_ID = FORMAL_SYSTEM_ID;

/** Ancla documental Calgary, con el SHA del cálculo y el del snapshot. */
export const CALGARY_ANCHOR = Object.freeze({
  formalSystemId: FORMAL_SYSTEM_ID,
  authorizedCalculusVersion: AUTHORIZED_CALCULUS_VERSION,
  calculusSha256: AUTHORIZED_CALCULUS_SHA256,
  sourceSnapshotSha256: SOURCE_SNAPSHOT_SHA256,
  sourceSnapshotSizeBytes: SOURCE_SNAPSHOT_SIZE_BYTES,
});

/** Las cinco clases literales de diferencia (Maestro §«claims»). */
export const DIFFERENCE_CLASSES = [
  'contradiccion_real',
  'convencion_alternativa',
  'sistema_formal_distinto',
  'diferencia_pedagogica',
  'informacion_complementaria',
] as const;
export type DifferenceClass = (typeof DIFFERENCE_CLASSES)[number];

/** Cada claim conserva sistema, familia de notación, versión y alcance. */
export interface SourceClaim {
  readonly sourceId: string;
  readonly formalSystemId: string;
  readonly notationFamily: string;
  readonly version: string;
  readonly scope: string;
  readonly statement: string;
}

export function isTargetSystem(claim: SourceClaim): boolean {
  return claim.formalSystemId === TARGET_FORMAL_SYSTEM_ID;
}

/**
 * Clasifica la diferencia de un claim frente al sistema objetivo.
 *
 * Si el claim describe **otro** sistema, la clase es `sistema_formal_distinto`
 * y esa determinación **gana sobre lo que declare quien clasifica**: llamar
 * «contradicción real» a lo que dice un manual de otro cálculo convertiría una
 * diferencia de sistema en un error del nuestro.
 */
export function classifyDifference(
  claim: SourceClaim,
  declaredClass: DifferenceClass,
): DifferenceClass {
  return isTargetSystem(claim) ? declaredClass : 'sistema_formal_distinto';
}

export interface MajorityOutcome {
  readonly statement: string;
  readonly supporting: readonly string[];
  /** Fuentes descartadas por describir otro sistema, para que quede el rastro. */
  readonly excludedForeignSystems: readonly string[];
}

/**
 * Resuelve una cuestión del sistema objetivo por mayoría **entre claims del
 * sistema objetivo**.
 *
 * Los de otro sistema no se cuentan, no empatan y no desempatan: se excluyen y
 * se reportan. Si no queda ninguno elegible, **no hay resultado**: se lanza en
 * vez de devolver el más votado del conjunto ajeno, que sería dejar que otro
 * cálculo decida el nuestro.
 */
export function resolveByMajority(claims: readonly SourceClaim[]): MajorityOutcome {
  const excluded = claims.filter((c) => !isTargetSystem(c)).map((c) => c.sourceId);
  const eligible = claims.filter(isTargetSystem);

  if (eligible.length === 0) {
    throw new NoEligibleClaimsError(
      `Ninguno de los ${claims.length} claims describe ${TARGET_FORMAL_SYSTEM_ID}. La mayoría ` +
        `simple no decide una cuestión cuando las fuentes describen sistemas distintos, así que ` +
        `no hay resultado que devolver.`,
    );
  }

  const conteo = new Map<string, string[]>();
  for (const claim of eligible) {
    const previo = conteo.get(claim.statement) ?? [];
    previo.push(claim.sourceId);
    conteo.set(claim.statement, previo);
  }

  // Orden determinista: más apoyos y, a igualdad, el enunciado menor. Sin esto
  // dos corridas con el mismo material podrían dar ganadores distintos.
  const ordenado = [...conteo.entries()].sort(
    ([enunciadoA, apoyosA], [enunciadoB, apoyosB]) =>
      apoyosB.length - apoyosA.length || enunciadoA.localeCompare(enunciadoB),
  );

  const primero = ordenado[0];
  if (primero === undefined) {
    throw new NoEligibleClaimsError('No hay claims elegibles.');
  }

  return {
    statement: primero[0],
    supporting: Object.freeze([...primero[1]]),
    excludedForeignSystems: Object.freeze(excluded),
  };
}

/**
 * Guarda explícita para quien construya un recuento por su cuenta: si en la
 * lista que va a contar hay un claim de otro sistema, es un fallo.
 */
export function assertNoForeignSystemInMajority(claims: readonly SourceClaim[]): void {
  const ajeno = claims.find((c) => !isTargetSystem(c));
  if (ajeno !== undefined) {
    throw new ForeignSystemInMajorityError(
      `El claim de ${ajeno.sourceId} describe ${ajeno.formalSystemId}, no ` +
        `${TARGET_FORMAL_SYSTEM_ID}: no participa por mayoría.`,
    );
  }
}

/**
 * `DEC-W0-SCOPE-001`: el cálculo autorizado y el ancla Calgary pertenecen al
 * **sobre congelado** y no cuentan como autonomía de W0.
 *
 * Importa para el veredicto de autonomía: si contaran, W0 parecería haber
 * descubierto por su cuenta el sistema formal que en realidad se le entregó.
 */
export function countsAsW0Autonomy(sourceId: string): boolean {
  return !FROZEN_ENVELOPE_SOURCE_IDS.includes(sourceId);
}

export const FROZEN_ENVELOPE_SOURCE_IDS: readonly string[] = Object.freeze([
  AUTHORIZED_CALCULUS_VERSION,
  'forallx-calgary-anchor',
]);
