import { IncompleteSelectionManifestError } from './errors.js';
import type { ComponentVerdict } from './licensing.js';
import type { SaturationReport, SuitabilityObservations } from './suitability.js';

/**
 * Salida de W0 (T-H45-06 ← P-I §7.0 «Salida de W0»).
 *
 * Los ocho entregables que la norma enumera, y **ninguno opcional**: un
 * manifiesto al que le falte una sección no es un manifiesto incompleto, es uno
 * que afirma haber cerrado W0 sin haberlo hecho. Por eso `buildSelectionManifest`
 * comprueba las ocho y lanza con el nombre de las que faltan.
 *
 * El punto más delicado son los **scores**. `T-H45-04` deja el escalar fallando
 * cerrado hasta H4.5, así que el manifiesto registra las **observaciones** y
 * dice explícitamente que el escalar no está disponible. Si guardara un número,
 * el manifiesto —que es lo que lee el `CORPUS_APPROVER`— presentaría como
 * medido un orden que nadie ha calibrado.
 */

/** Los cuatro estados de inventario que enumera §7.0. */
export const INVENTORY_STATUSES = [
  'autorizado',
  'excluido',
  'LICENSE_UNRESOLVED',
  'pendiente',
] as const;
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

export interface InventoryItem {
  readonly sourceComponent: string;
  readonly sourceVersion: string;
  readonly status: InventoryStatus;
  /** Snapshot/hash de **cada versión evaluada** (§7.0). */
  readonly snapshotSha256: string;
  readonly licenseEvidence: string;
  /** Cadena de atribución requerida por la licencia del componente. */
  readonly attributionChain: readonly string[];
}

export interface ScoreEntry {
  readonly sourceComponent: string;
  readonly observations: SuitabilityObservations;
  /**
   * Siempre `false`. Ver la nota de arriba: el escalar se congela en H4.5 y
   * declararlo ausente es lo que impide leer el manifiesto como si lo tuviera.
   */
  readonly scalarAvailable: false;
}

export interface ConflictEntry {
  readonly claim: string;
  readonly differenceClass: string;
  readonly resolution: string;
  /** Fuentes descartadas por describir otro sistema formal (T-H45-03). */
  readonly excludedForeignSystems: readonly string[];
}

export interface SelectionManifestInput {
  readonly courseId: string;
  readonly inventory: readonly InventoryItem[];
  readonly licenseVerdicts: readonly ComponentVerdict[];
  readonly scores: readonly ScoreEntry[];
  readonly saturation: SaturationReport;
  readonly conflicts: readonly ConflictEntry[];
  /** Justificación de la selección, en prosa. No puede quedar vacía. */
  readonly selectionRationale: string;
  /** Referencias o snapshots autorizables que se entregan a W1. */
  readonly authorizableReferences: readonly string[];
}

export interface SelectionManifest extends SelectionManifestInput {
  readonly manifestVersion: 'w0-selection-manifest-v1';
  readonly counts: Readonly<Record<InventoryStatus, number>>;
}

const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Construye el manifiesto comprobando las ocho secciones.
 *
 * `inventory` vacío es un fallo, no un manifiesto de cero fuentes: W0 que no
 * evaluó nada no ha terminado, y entregarlo vacío se leería como «no había
 * nada» en vez de «no se buscó».
 */
export function buildSelectionManifest(input: SelectionManifestInput): SelectionManifest {
  const faltan: string[] = [];

  if (input.courseId.trim() === '') faltan.push('courseId');
  if (input.inventory.length === 0) faltan.push('inventory');
  if (input.licenseVerdicts.length === 0) faltan.push('licenseVerdicts');
  if (input.scores.length === 0) faltan.push('scores');
  if (input.saturation.curve.length === 0) faltan.push('saturation.curve');
  if (input.selectionRationale.trim() === '') faltan.push('selectionRationale');
  if (input.authorizableReferences.length === 0) faltan.push('authorizableReferences');

  if (faltan.length > 0) {
    throw new IncompleteSelectionManifestError(
      `Al manifiesto de selección le faltan ${faltan.join(', ')}. §7.0 enumera ocho entregables y ` +
        `ninguno es opcional: un manifiesto incompleto afirma haber cerrado W0 sin haberlo hecho.`,
    );
  }

  // `conflicts` puede estar vacío —puede no haber conflictos— pero el campo
  // tiene que existir: su ausencia y «no hubo» no son lo mismo.

  for (const item of input.inventory) {
    if (!SHA256_HEX.test(item.snapshotSha256)) {
      throw new IncompleteSelectionManifestError(
        `El componente ${item.sourceComponent} no trae snapshot válido. §7.0 exige snapshot/hash ` +
          `de **cada versión evaluada**, y sin él W1 no puede comprobar identidad antes de ingerir.`,
      );
    }
    if (item.licenseEvidence.trim() === '') {
      throw new IncompleteSelectionManifestError(
        `El componente ${item.sourceComponent} no trae evidencia de licencia.`,
      );
    }
  }

  const counts = Object.fromEntries(
    INVENTORY_STATUSES.map((estado) => [
      estado,
      input.inventory.filter((i) => i.status === estado).length,
    ]),
  ) as Record<InventoryStatus, number>;

  return { ...input, manifestVersion: 'w0-selection-manifest-v1', counts: Object.freeze(counts) };
}

/**
 * ¿Puede este manifiesto pasar al gate de autorización?
 *
 * Un componente `pendiente` no bloquea el manifiesto —queda inventariado como
 * pendiente, que es información— pero **sí** impide declarar el corpus completo.
 * Devuelve el detalle en vez de un booleano suelto para que el aprobador vea
 * qué falta, no solo que falta algo.
 */
export function manifestReadiness(manifest: SelectionManifest): {
  readonly hasAuthorized: boolean;
  readonly pendingComponents: readonly string[];
  readonly unresolvedComponents: readonly string[];
} {
  return {
    hasAuthorized: manifest.counts.autorizado > 0,
    pendingComponents: Object.freeze(
      manifest.inventory.filter((i) => i.status === 'pendiente').map((i) => i.sourceComponent),
    ),
    unresolvedComponents: Object.freeze(
      manifest.inventory
        .filter((i) => i.status === 'LICENSE_UNRESOLVED')
        .map((i) => i.sourceComponent),
    ),
  };
}
