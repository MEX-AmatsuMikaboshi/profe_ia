import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ACCESS_MODES,
  acceptCandidate,
  assertAllowedAccessMode,
  assertCompleteDiscoveryRecord,
  assertOpenSearchIsOnlyComplement,
  GeneralCrawlerForbiddenError,
  IncompleteDiscoveryRecordError,
  isAccessMode,
  OpenSearchNotComplementError,
  SourceNotWhitelistedError,
  Whitelist,
  type Candidate,
  type DiscoveryRecord,
} from '../src/index.js';

const SHA = 'a'.repeat(64);

function registro(overrides: Partial<DiscoveryRecord> = {}): DiscoveryRecord {
  return {
    url: 'https://openlogicproject.org/recurso',
    origin: 'open-logic-project',
    version: 'Fall 2025',
    retrievedAt: '2026-08-15T00:00:00+00:00',
    licenseEvidence: 'pagina de creditos, snapshot 2026-07-18',
    snapshotSha256: SHA,
    ...overrides,
  };
}

function candidato(overrides: Partial<Candidate> = {}): Candidate {
  return {
    sourceId: 'open-logic-project',
    accessMode: 'indice_estable',
    record: registro(),
    ...overrides,
  };
}

const WHITELIST = new Whitelist([
  {
    sourceId: 'open-logic-project',
    name: 'Open Logic Project',
    accessMode: 'indice_estable',
    baseUrl: 'https://openlogicproject.org/',
  },
]);

describe('sin crawler web general (T-H45-02 ← P-I §7.0)', () => {
  it('los modos de acceso son un conjunto cerrado de tres', () => {
    expect(ACCESS_MODES).toEqual(['api', 'indice_estable', 'busqueda_abierta']);
    expect(isAccessMode('crawler')).toBe(false);
    expect(isAccessMode('crawler_web_general')).toBe(false);
  });

  it('un modo fuera del conjunto se rechaza', () => {
    for (const modo of ['crawler', 'scraping', 'spider', '']) {
      expect(() => assertAllowedAccessMode(modo)).toThrow(GeneralCrawlerForbiddenError);
    }
  });

  it('los tres modos permitidos pasan', () => {
    for (const modo of ACCESS_MODES) {
      expect(() => assertAllowedAccessMode(modo)).not.toThrow();
    }
  });
});

describe('registro obligatorio por candidato', () => {
  it('exige los seis campos', () => {
    for (const campo of [
      'url',
      'origin',
      'version',
      'retrievedAt',
      'licenseEvidence',
      'snapshotSha256',
    ] as const) {
      expect(() =>
        assertCompleteDiscoveryRecord(registro({ [campo]: '' } as Partial<DiscoveryRecord>)),
      ).toThrow(IncompleteDiscoveryRecordError);
    }
  });

  it('el snapshot debe ser un SHA-256 bien formado', () => {
    for (const malo of ['abc', 'A'.repeat(64), 'z'.repeat(64), SHA.slice(0, 63)]) {
      expect(() => assertCompleteDiscoveryRecord(registro({ snapshotSha256: malo }))).toThrow(
        IncompleteDiscoveryRecordError,
      );
    }
  });

  it('un registro completo pasa', () => {
    expect(() => assertCompleteDiscoveryRecord(registro())).not.toThrow();
  });
});

describe('la whitelist manda salvo para búsqueda abierta', () => {
  it('acepta un candidato de fuente autorizada', () => {
    expect(() => acceptCandidate(WHITELIST, candidato())).not.toThrow();
  });

  it('una fuente no autorizada no entra declarando `api`', () => {
    expect(() =>
      acceptCandidate(WHITELIST, candidato({ sourceId: 'blog-cualquiera', accessMode: 'api' })),
    ).toThrow(SourceNotWhitelistedError);
  });

  it('la búsqueda abierta sí opera fuera de la lista', () => {
    expect(() =>
      acceptCandidate(
        WHITELIST,
        candidato({ sourceId: 'hallazgo-externo', accessMode: 'busqueda_abierta' }),
      ),
    ).not.toThrow();
  });
});

describe('la búsqueda abierta es complemento, no estrategia', () => {
  it('un conjunto solo de búsqueda abierta se rechaza', () => {
    expect(() =>
      assertOpenSearchIsOnlyComplement([
        candidato({ sourceId: 'a', accessMode: 'busqueda_abierta' }),
        candidato({ sourceId: 'b', accessMode: 'busqueda_abierta' }),
      ]),
    ).toThrow(OpenSearchNotComplementError);
  });

  it('con al menos un candidato de la whitelist, complementa', () => {
    expect(() =>
      assertOpenSearchIsOnlyComplement([
        candidato(),
        candidato({ sourceId: 'a', accessMode: 'busqueda_abierta' }),
      ]),
    ).not.toThrow();
  });

  it('sin búsqueda abierta no hay nada que comprobar', () => {
    expect(() => assertOpenSearchIsOnlyComplement([candidato()])).not.toThrow();
    expect(() => assertOpenSearchIsOnlyComplement([])).not.toThrow();
  });
});

describe('whitelist.yaml del repositorio de contenido', () => {
  const yaml = readFileSync(
    'content/unidad-deduccion-natural/research/whitelist.yaml',
    'utf8',
  );

  it('está poblada y declarada cerrada', () => {
    expect(yaml).toContain('whitelist_closed: true');
    expect(yaml).toContain('open-logic-project');
    expect(yaml).toContain('mit-opencourseware');
    expect(yaml).toContain('openstax');
  });

  it('no declara ningún modo de acceso prohibido', () => {
    for (const prohibido of ['crawler', 'scraping', 'spider']) {
      expect(yaml.toLowerCase()).not.toContain(`access_mode: ${prohibido}`);
    }
  });

  it('conserva la advertencia de que estar en la lista no valida el recurso', () => {
    // Sin esa advertencia, la whitelist se leería como una lista de fuentes
    // aprobadas, que es justo lo que §7.0 dice que no es. Se normalizan los
    // espacios porque la frase va en un comentario y el salto de línea la parte.
    const plano = yaml.replace(/[\s#]+/g, ' ');

    expect(plano).toContain('no implica que cada recurso sea confiable o jurídicamente reutilizable');
    expect(plano).toContain('cada recurso se evalúa individualmente');
  });
});
