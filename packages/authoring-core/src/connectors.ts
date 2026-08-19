import { createHash } from 'node:crypto';
import type { Candidate } from './discovery.js';

/**
 * Conectores de descubrimiento W0 (F5/H4.5 ← T-H45-02, P-I §7.0).
 *
 * Son el **borde impuro** del pipeline: aquí y solo aquí W0 toca la red y el
 * reloj. El orquestador (`w0-runner.ts`) sigue siendo puro —recibe lo que estos
 * conectores producen como dato— y las pruebas inyectan un `fetch` falso, así
 * que la red no entra en la suite.
 *
 * Tres reglas de la casa:
 *
 * 1. **Sin crawler general.** Cada conector habla con un índice estable
 *    concreto (API de GitHub, página de curso de OCW, API del CMS de OpenStax);
 *    ninguno sigue enlaces ni barre sitios.
 * 2. **El snapshot se genera aquí, en W0.** W1 comprobará identidad contra este
 *    hash antes de ingerir; por eso el conector devuelve los bytes junto al
 *    hash, para que quien corre decida qué archivar.
 * 3. **La licencia se registra como evidencia, no como veredicto.** El veredicto
 *    es de `licensing.ts` (T-H45-05); el conector solo trae el dato (por
 *    ejemplo, el SPDX que detecta GitHub).
 */

/** Subconjunto de `fetch` que usan los conectores; inyectable en pruebas. */
export type FetchLike = (
  url: string,
) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

export class ConnectorError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`El conector recibió HTTP ${status} de ${url}. Un índice estable que falla no se ` +
      `suplanta con otra cosa: se registra el fallo y la corrida no inventa el candidato.`);
    this.name = 'ConnectorError';
  }
}

export function sha256HexBytes(bytes: ArrayBuffer | Uint8Array): string {
  return createHash('sha256').update(Buffer.from(bytes as ArrayBuffer)).digest('hex');
}

async function fetchJson(fetchImpl: FetchLike, url: string): Promise<unknown> {
  const response = await fetchImpl(url);
  if (!response.ok) throw new ConnectorError(url, response.status);
  return JSON.parse(await response.text()) as unknown;
}

async function fetchBytes(fetchImpl: FetchLike, url: string): Promise<ArrayBuffer> {
  const response = await fetchImpl(url);
  if (!response.ok) throw new ConnectorError(url, response.status);
  return response.arrayBuffer();
}

/** Snapshot de un repositorio GitHub: commit vigente, licencia detectada y tarball. */
export interface GithubRepoSnapshot {
  readonly repoUrl: string;
  readonly defaultBranch: string;
  readonly commitSha: string;
  readonly commitDate: string;
  /** SPDX que detecta GitHub; evidencia, no veredicto. */
  readonly licenseSpdx: string;
  readonly tarballSha256: string;
  readonly tarballBytes: Uint8Array;
}

interface GithubRepoMeta {
  readonly default_branch?: string;
  readonly html_url?: string;
  readonly license?: { readonly spdx_id?: string } | null;
}

interface GithubCommitMeta {
  readonly sha?: string;
  readonly commit?: { readonly committer?: { readonly date?: string } };
}

export async function githubRepoSnapshot(
  fetchImpl: FetchLike,
  owner: string,
  repo: string,
): Promise<GithubRepoSnapshot> {
  const meta = (await fetchJson(fetchImpl, `https://api.github.com/repos/${owner}/${repo}`)) as GithubRepoMeta;
  const branch = meta.default_branch ?? 'master';
  const commit = (await fetchJson(
    fetchImpl,
    `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`,
  )) as GithubCommitMeta;
  const commitSha = commit.sha ?? '';
  const commitDate = commit.commit?.committer?.date ?? '';
  const tarballBytes = new Uint8Array(
    await fetchBytes(fetchImpl, `https://api.github.com/repos/${owner}/${repo}/tarball/${commitSha}`),
  );

  return {
    repoUrl: meta.html_url ?? `https://github.com/${owner}/${repo}`,
    defaultBranch: branch,
    commitSha,
    commitDate,
    licenseSpdx: meta.license?.spdx_id ?? 'NOASSERTION',
    tarballSha256: sha256HexBytes(tarballBytes),
    tarballBytes,
  };
}

/** Snapshot de una página de índice estable (por ejemplo, un curso de OCW). */
export interface StablePageSnapshot {
  readonly requestedUrl: string;
  readonly bodySha256: string;
  readonly bodyBytes: Uint8Array;
}

export async function stablePageSnapshot(
  fetchImpl: FetchLike,
  url: string,
): Promise<StablePageSnapshot> {
  const bodyBytes = new Uint8Array(await fetchBytes(fetchImpl, url));
  return { requestedUrl: url, bodySha256: sha256HexBytes(bodyBytes), bodyBytes };
}

/** Resultado de buscar en el catálogo del CMS de OpenStax. */
export interface OpenstaxCatalogResult {
  readonly totalCount: number;
  readonly matchingTitles: readonly string[];
}

interface OpenstaxCatalogResponse {
  readonly meta?: { readonly total_count?: number };
  readonly items?: readonly { readonly title?: string }[];
}

/**
 * Busca títulos en el catálogo de OpenStax. Que no haya ninguno es un resultado
 * legítimo de descubrimiento: se registra la búsqueda y su vacío, no se
 * fabrica un candidato.
 */
export async function openstaxCatalogSearch(
  fetchImpl: FetchLike,
  query: string,
): Promise<OpenstaxCatalogResult> {
  const data = (await fetchJson(
    fetchImpl,
    'https://openstax.org/apps/cms/api/v2/pages/?type=books.Book&format=json&limit=200',
  )) as OpenstaxCatalogResponse;
  const titles = (data.items ?? [])
    .map((item) => item.title ?? '')
    .filter((title) => title !== '');
  const needle = query.toLowerCase();
  return {
    totalCount: data.meta?.total_count ?? titles.length,
    matchingTitles: Object.freeze(titles.filter((title) => title.toLowerCase().includes(needle))),
  };
}

/** Construye el candidato de §7.0 a partir de un snapshot de repositorio GitHub. */
export function candidateFromGithubSnapshot(
  sourceId: string,
  origin: string,
  snapshot: GithubRepoSnapshot,
  retrievedAt: string,
  licenseEvidence: string,
): Candidate {
  return {
    sourceId,
    accessMode: 'indice_estable',
    record: {
      url: snapshot.repoUrl,
      origin,
      version: `${snapshot.defaultBranch}@${snapshot.commitSha} (${snapshot.commitDate})`,
      retrievedAt,
      licenseEvidence,
      snapshotSha256: snapshot.tarballSha256,
    },
  };
}

/** Construye el candidato de §7.0 a partir de una página de índice estable. */
export function candidateFromStablePage(
  sourceId: string,
  origin: string,
  version: string,
  snapshot: StablePageSnapshot,
  retrievedAt: string,
  licenseEvidence: string,
): Candidate {
  return {
    sourceId,
    accessMode: 'indice_estable',
    record: {
      url: snapshot.requestedUrl,
      origin,
      version,
      retrievedAt,
      licenseEvidence,
      snapshotSha256: snapshot.bodySha256,
    },
  };
}
