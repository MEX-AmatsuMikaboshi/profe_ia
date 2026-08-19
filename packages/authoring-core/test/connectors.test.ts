import { describe, expect, it } from 'vitest';
import {
  candidateFromGithubSnapshot,
  candidateFromStablePage,
  ConnectorError,
  githubRepoSnapshot,
  openstaxCatalogSearch,
  sha256HexBytes,
  stablePageSnapshot,
  type FetchLike,
} from '../src/index.js';

/**
 * Conectores W0 con `fetch` inyectado: la red no entra en la suite. Cada
 * conector se prueba contra respuestas grabadas mínimas.
 */

function fakeFetch(routes: Readonly<Record<string, { status?: number; body: string }>>): FetchLike {
  return async (url: string) => {
    const route = routes[url];
    if (route === undefined) {
      return {
        ok: false,
        status: 404,
        text: async () => 'no sembrado',
        arrayBuffer: async () => new TextEncoder().encode('no sembrado').buffer as ArrayBuffer,
      };
    }
    const status = route.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => route.body,
      arrayBuffer: async () => new TextEncoder().encode(route.body).buffer as ArrayBuffer,
    };
  };
}

describe('conectores de descubrimiento W0 (T-H45-02)', () => {
  it('sha256HexBytes reproduce el vector conocido de «abc»', () => {
    expect(sha256HexBytes(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('githubRepoSnapshot junta commit, licencia y hash del tarball', async () => {
    const fetchImpl = fakeFetch({
      'https://api.github.com/repos/rzach/forallx-yyc': { body: JSON.stringify({
        default_branch: 'master',
        html_url: 'https://github.com/rzach/forallx-yyc',
        license: { spdx_id: 'CC-BY-4.0' },
      }) },
      'https://api.github.com/repos/rzach/forallx-yyc/commits/master': { body: JSON.stringify({
        sha: 'ec34df8',
        commit: { committer: { date: '2025-12-18T09:05:52Z' } },
      }) },
      'https://api.github.com/repos/rzach/forallx-yyc/tarball/ec34df8': { body: 'BYTES-DEL-TARBALL' },
    });

    const snapshot = await githubRepoSnapshot(fetchImpl, 'rzach', 'forallx-yyc');
    expect(snapshot.commitSha).toBe('ec34df8');
    expect(snapshot.licenseSpdx).toBe('CC-BY-4.0');
    expect(snapshot.tarballSha256).toBe(sha256HexBytes(new TextEncoder().encode('BYTES-DEL-TARBALL')));
    expect(snapshot.tarballSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('un índice que falla lanza ConnectorError; no se inventa el candidato', async () => {
    const fetchImpl = fakeFetch({});
    await expect(githubRepoSnapshot(fetchImpl, 'rzach', 'forallx-yyc')).rejects.toThrow(
      ConnectorError,
    );
    await expect(stablePageSnapshot(fetchImpl, 'https://ocw.mit.edu/courses/x/')).rejects.toThrow(
      ConnectorError,
    );
  });

  it('openstaxCatalogSearch registra el vacío cuando no hay título del tema', async () => {
    const fetchImpl = fakeFetch({
      'https://openstax.org/apps/cms/api/v2/pages/?type=books.Book&format=json&limit=200': {
        body: JSON.stringify({
          meta: { total_count: 3 },
          items: [{ title: 'Biology 2e' }, { title: 'Calculus Volume 1' }, { title: 'Physics' }],
        }) },
    });

    const resultado = await openstaxCatalogSearch(fetchImpl, 'logic');
    expect(resultado.totalCount).toBe(3);
    expect(resultado.matchingTitles).toEqual([]);
  });

  it('los candidatos construidos cumplen el registro de §7.0', async () => {
    const fetchImpl = fakeFetch({
      'https://api.github.com/repos/o/r': { body: JSON.stringify({
        default_branch: 'main',
        html_url: 'https://github.com/o/r',
        license: { spdx_id: 'CC-BY-4.0' },
      }) },
      'https://api.github.com/repos/o/r/commits/main': { body: JSON.stringify({
        sha: 'abc123',
        commit: { committer: { date: '2026-01-01T00:00:00Z' } },
      }) },
      'https://api.github.com/repos/o/r/tarball/abc123': { body: 'TARBALL' },
    });
    const repo = await githubRepoSnapshot(fetchImpl, 'o', 'r');
    const candidatoRepo = candidateFromGithubSnapshot(
      'open-logic-project',
      'Open Logic Project',
      repo,
      '2026-08-19T00:00:00.000Z',
      'CC BY 4.0 según el LICENSE del repositorio',
    );
    expect(candidatoRepo.accessMode).toBe('indice_estable');
    expect(candidatoRepo.record.snapshotSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(candidatoRepo.record.version).toContain('abc123');

    const pagina = await stablePageSnapshot(fetchImpl, 'https://ocw.mit.edu/courses/x/').catch(
      () => undefined,
    );
    expect(pagina).toBeUndefined();
    const candidatoPagina = candidateFromStablePage(
      'mit-opencourseware',
      'MIT OpenCourseWare',
      'Fall 2009',
      { requestedUrl: 'https://ocw.mit.edu/courses/24-241-logic-i-fall-2009/', bodySha256: 'f'.repeat(64), bodyBytes: new Uint8Array() },
      '2026-08-19T00:00:00.000Z',
      'CC BY-NC-SA 4.0 según el aviso del curso',
    );
    expect(candidatoPagina.record.version).toBe('Fall 2009');
  });
});
