import {
  GeneralCrawlerForbiddenError,
  IncompleteDiscoveryRecordError,
  OpenSearchNotComplementError,
  SourceNotWhitelistedError,
} from './errors.js';

/**
 * Descubrimiento de menor complejidad (T-H45-02 ← P-I §7.0 «Descubrimiento»).
 *
 * Cuatro reglas literales, y la cuarta es la que más restringe: **sin crawler
 * web general**. Por eso los modos de acceso son un conjunto cerrado en vez de
 * una cadena libre: si fueran texto, «crawler» entraría escribiéndolo.
 *
 * Y una advertencia que la propia norma hace y conviene no perder: «la lista
 * blanca **no implica** que cada recurso sea confiable o jurídicamente
 * reutilizable». Estar en la whitelist autoriza a *buscar ahí*, no valida lo
 * encontrado; de eso se ocupan `T-H45-04` (idoneidad) y `T-H45-05` (licencia).
 */

/** Modos de acceso permitidos. Conjunto cerrado: el crawler general no está. */
export const ACCESS_MODES = ['api', 'indice_estable', 'busqueda_abierta'] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];

export interface WhitelistEntry {
  readonly sourceId: string;
  readonly name: string;
  readonly accessMode: AccessMode;
  readonly baseUrl: string;
}

/** Registro obligatorio por candidato (§7.0: URL/origen, versión, fecha, licencia). */
export interface DiscoveryRecord {
  readonly url: string;
  readonly origin: string;
  readonly version: string;
  /** Fecha de recuperación, ISO-8601. */
  readonly retrievedAt: string;
  readonly licenseEvidence: string;
  /**
   * Snapshot/hash generado **en W0 al evaluar idoneidad**. W1 comprobará
   * identidad antes de ingerir y bloqueará cualquier deriva no reevaluada, así
   * que sin este hash el candidato no puede llegar a W1.
   */
  readonly snapshotSha256: string;
}

export interface Candidate {
  readonly sourceId: string;
  readonly accessMode: AccessMode;
  readonly record: DiscoveryRecord;
}

const SHA256_HEX = /^[0-9a-f]{64}$/;

export function isAccessMode(value: string): value is AccessMode {
  return (ACCESS_MODES as readonly string[]).includes(value);
}

/**
 * Rechaza cualquier modo de acceso fuera del conjunto cerrado. El mensaje nombra
 * el crawler porque es el caso que la norma prohíbe por su nombre.
 */
export function assertAllowedAccessMode(mode: string): asserts mode is AccessMode {
  if (!isAccessMode(mode)) {
    throw new GeneralCrawlerForbiddenError(
      `Modo de acceso ${JSON.stringify(mode)} no permitido. Solo ${ACCESS_MODES.join(', ')}: ` +
        `P-I §7.0 prohíbe el crawler web general, y un modo libre lo dejaría entrar escribiéndolo.`,
    );
  }
}

/** Un registro incompleto no describe una fuente: no se acepta. */
export function assertCompleteDiscoveryRecord(record: DiscoveryRecord): void {
  const faltan = (
    ['url', 'origin', 'version', 'retrievedAt', 'licenseEvidence', 'snapshotSha256'] as const
  ).filter((campo) => (record[campo] ?? '').trim() === '');

  if (faltan.length > 0) {
    throw new IncompleteDiscoveryRecordError(
      `Al candidato le faltan ${faltan.join(', ')}. §7.0 los exige todos: sin ellos no hay ` +
        `trazabilidad, y un candidato sin fecha ni evidencia de licencia no se distingue de uno ` +
        `inventado.`,
    );
  }

  if (!SHA256_HEX.test(record.snapshotSha256)) {
    throw new IncompleteDiscoveryRecordError(
      `El snapshot ${record.snapshotSha256} no es un SHA-256 hexadecimal. El hash se genera en W0 ` +
        `y W1 comprueba identidad antes de ingerir; uno mal formado bloquearía esa comprobación.`,
    );
  }
}

export class Whitelist {
  readonly #porId = new Map<string, WhitelistEntry>();

  constructor(entries: readonly WhitelistEntry[]) {
    for (const entry of entries) {
      assertAllowedAccessMode(entry.accessMode);
      this.#porId.set(entry.sourceId, entry);
    }
  }

  has(sourceId: string): boolean {
    return this.#porId.has(sourceId);
  }

  entry(sourceId: string): WhitelistEntry | undefined {
    return this.#porId.get(sourceId);
  }

  size(): number {
    return this.#porId.size;
  }
}

/**
 * Acepta un candidato. Un candidato de búsqueda abierta **no** exige estar en la
 * whitelist —la búsqueda abierta es justamente lo que está fuera de ella—, pero
 * cualquier otro modo sí: decir «api» sobre una fuente no autorizada sería
 * saltarse la lista por la puerta de al lado.
 */
export function acceptCandidate(whitelist: Whitelist, candidate: Candidate): Candidate {
  assertAllowedAccessMode(candidate.accessMode);
  assertCompleteDiscoveryRecord(candidate.record);

  if (candidate.accessMode !== 'busqueda_abierta' && !whitelist.has(candidate.sourceId)) {
    throw new SourceNotWhitelistedError(
      `La fuente ${candidate.sourceId} no está en la whitelist y el modo declarado es ` +
        `${candidate.accessMode}. Solo la búsqueda abierta opera fuera de la lista, y solo como ` +
        `complemento.`,
    );
  }

  return candidate;
}

/**
 * «Búsqueda abierta **solo como complemento**»: complementa a algo, así que un
 * conjunto formado únicamente por resultados de búsqueda abierta no es un
 * complemento sino la estrategia principal, que es lo que la norma descarta.
 */
export function assertOpenSearchIsOnlyComplement(candidates: readonly Candidate[]): void {
  const abiertos = candidates.filter((c) => c.accessMode === 'busqueda_abierta');
  if (abiertos.length === 0) return;

  const deWhitelist = candidates.filter((c) => c.accessMode !== 'busqueda_abierta');
  if (deWhitelist.length === 0) {
    throw new OpenSearchNotComplementError(
      `Los ${abiertos.length} candidatos vienen todos de búsqueda abierta. La búsqueda abierta es ` +
        `complemento (P-I §7.0): sin ningún candidato de la whitelist no complementa nada, es la ` +
        `estrategia principal.`,
    );
  }
}
