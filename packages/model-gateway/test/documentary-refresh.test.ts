import { describe, expect, it } from 'vitest';

import { MissingCredentialError } from '../src/errors.js';
import { ProfileCredential, credentialEnvVar, envCredentialResolver } from '../src/credentials.js';
import {
  DocumentaryRefreshError,
  assertRefreshAuthorizesBenchmark,
  verifiedAtFromRefresh,
  type BenchmarkRun,
  type CandidateRefresh,
  type DocumentaryRefreshRecord,
  type RefreshWindowParameter,
} from '../src/documentary-refresh.js';

/**
 * T-H4-09. El refresco documental es la evidencia fechada que §8.1 exige
 * **inmediatamente antes** del benchmark. Lo que se comprueba aquí es que no
 * autoriza una corrida cuando no debe.
 */

const HASH = 'a'.repeat(64);
const FINGERPRINT = 'b'.repeat(64);

const REFRESHED_AT = '2026-08-18T09:00:00.000Z';
const RUN_STARTED_AT = '2026-08-18T09:30:00.000Z';

function candidate(overrides: Partial<CandidateRefresh> = {}): CandidateRefresh {
  return {
    candidateId: 'claude-sonnet-5',
    provider: 'anthropic',
    profile: 'SESION',
    modelId: 'claude-sonnet-5',
    endpoint: 'https://api.anthropic.com/v1/messages',
    snapshot: 'claude-sonnet-5-20260813',
    supportedParameters: ['max_tokens'],
    rejectedParameters: ['top_k'],
    snapshotAliasPolicy: 'snapshots fechados; el alias sigue al último snapshot',
    deprecation: { deprecated: false },
    dataPolicy: {
      region: { known: true, value: 'us' },
      logging: { known: true, value: 'sin entrenamiento sobre entradas de API' },
      retention: { known: true, value: '30 días' },
      contractualEligibility: { known: false, reason: 'no_publicado_por_el_proveedor' },
    },
    sources: [
      { url: 'https://docs.example/models', retrievedAt: REFRESHED_AT, contentSha256: HASH },
    ],
    refreshedAt: REFRESHED_AT,
    ...overrides,
  } as CandidateRefresh;
}

function record(overrides: Partial<DocumentaryRefreshRecord> = {}): DocumentaryRefreshRecord {
  return {
    schemaVersion: 'documentary-refresh-v1',
    refreshId: 'refresh-1',
    purpose: 'material',
    refreshedAt: REFRESHED_AT,
    candidates: [candidate()],
    ...overrides,
  } as DocumentaryRefreshRecord;
}

const WINDOW: RefreshWindowParameter = {
  parameterId: 'refresh-window-h4',
  maxAgeSeconds: 7_200,
  purpose: 'material',
  provenance: 'protocolo H4, fijado por el propietario',
};

const RUN: BenchmarkRun = {
  runId: 'bench-01-run-1',
  startedAt: RUN_STARTED_AT,
  candidateIds: ['claude-sonnet-5'],
  purpose: 'material',
};

describe('refresco documental de candidatos (T-H4-09)', () => {
  it('autoriza la corrida y reporta la antigüedad observada', () => {
    const auth = assertRefreshAuthorizesBenchmark(record(), WINDOW, RUN);
    expect(auth.refreshId).toBe('refresh-1');
    // 30 minutos entre refresco y arranque: el auditor ve el número, no un «ok».
    expect(auth.ageSecondsByCandidate['claude-sonnet-5']).toBe(1_800);
    expect(auth.windowParameterId).toBe('refresh-window-h4');
  });

  // ─────────────────── material vs test_fixture ───────────────────

  it('un refresco de prueba no habilita una corrida material', () => {
    expect(() =>
      assertRefreshAuthorizesBenchmark(record({ purpose: 'test_fixture' }), WINDOW, RUN),
    ).toThrow(/no reverifica nada/);
  });

  it('una ventana de prueba tampoco', () => {
    expect(() =>
      assertRefreshAuthorizesBenchmark(record(), { ...WINDOW, purpose: 'test_fixture' }, RUN),
    ).toThrow(/no es la puerta del benchmark/);
  });

  it('una corrida de prueba sí admite fixtures: el mecanismo se puede ejercitar', () => {
    expect(() =>
      assertRefreshAuthorizesBenchmark(
        record({ purpose: 'test_fixture' }),
        { ...WINDOW, purpose: 'test_fixture' },
        { ...RUN, purpose: 'test_fixture' },
      ),
    ).not.toThrow();
  });

  // ─────────────────── frescura ───────────────────

  it('evidencia caducada bloquea, en vez de pasar con aviso', () => {
    expect(() =>
      assertRefreshAuthorizesBenchmark(record(), { ...WINDOW, maxAgeSeconds: 600 }, RUN),
    ).toThrow(/caducada/);
  });

  it('refrescar después de arrancar la corrida no verifica lo que se midió', () => {
    const tarde = record({
      refreshedAt: '2026-08-18T10:00:00.000Z',
      candidates: [candidate({ refreshedAt: '2026-08-18T10:00:00.000Z' })],
    });
    expect(() => assertRefreshAuthorizesBenchmark(tarde, WINDOW, RUN)).toThrow(
      /se refrescó después de arrancar/,
    );
  });

  // ─────────────────── deprecación ───────────────────

  it('un candidato deprecado no entra al benchmark', () => {
    const deprecado = record({
      candidates: [
        candidate({
          deprecation: { deprecated: true, notice: 'retirado el 2026-09-01' },
        }),
      ],
    });
    expect(() => assertRefreshAuthorizesBenchmark(deprecado, WINDOW, RUN)).toThrow(/deprecado/);
  });

  // ─────────────────── cobertura de candidatos ───────────────────

  it('medir un candidato que el refresco no cubre está prohibido', () => {
    expect(() =>
      assertRefreshAuthorizesBenchmark(record(), WINDOW, {
        ...RUN,
        candidateIds: ['claude-sonnet-5', 'gpt-5.6-sol'],
      }),
    ).toThrow(/no aparece en el refresco/);
  });

  // ─────────── «cuando se conozcan» no es «no miré» ───────────

  it('un campo de política sin consultar bloquea una corrida material', () => {
    const sinConsultar = record({
      candidates: [
        candidate({
          dataPolicy: {
            region: { known: true, value: 'us' },
            logging: { known: false, reason: 'no_consultado' },
            retention: { known: true, value: '30 días' },
            contractualEligibility: { known: false, reason: 'no_publicado_por_el_proveedor' },
          },
        }),
      ],
    });
    expect(() => assertRefreshAuthorizesBenchmark(sinConsultar, WINDOW, RUN)).toThrow(
      /deja sin consultar logging/,
    );
  });

  it('lo que el proveedor no publica sí se admite: son hechos distintos', () => {
    const noPublicado = record({
      candidates: [
        candidate({
          dataPolicy: {
            region: { known: false, reason: 'no_publicado_por_el_proveedor' },
            logging: { known: false, reason: 'no_publicado_por_el_proveedor' },
            retention: { known: false, reason: 'no_publicado_por_el_proveedor' },
            contractualEligibility: { known: false, reason: 'no_publicado_por_el_proveedor' },
          },
        }),
      ],
    });
    expect(() => assertRefreshAuthorizesBenchmark(noPublicado, WINDOW, RUN)).not.toThrow();
  });

  // ─────────────────── alias y snapshot ───────────────────

  it('un alias sin snapshot exige huella de comportamiento', () => {
    const alias = record({
      candidates: [
        candidate({
          candidateId: 'gpt-5.6',
          provider: 'openai',
          modelId: 'gpt-5.6',
          endpoint: 'https://api.openai.com/v1/responses',
          snapshot: undefined,
          aliasResolvedAt: REFRESHED_AT,
        }),
      ],
    });
    expect(() =>
      assertRefreshAuthorizesBenchmark(alias, WINDOW, { ...RUN, candidateIds: ['gpt-5.6'] }),
    ).toThrow(/huella de comportamiento/);
  });

  it('el mismo alias con huella sí pasa: la prueba anterior no es por vacío', () => {
    const alias = record({
      candidates: [
        candidate({
          candidateId: 'gpt-5.6',
          provider: 'openai',
          modelId: 'gpt-5.6',
          endpoint: 'https://api.openai.com/v1/responses',
          snapshot: undefined,
          aliasResolvedAt: REFRESHED_AT,
          behaviorFingerprint: FINGERPRINT,
        }),
      ],
    });
    expect(() =>
      assertRefreshAuthorizesBenchmark(alias, WINDOW, { ...RUN, candidateIds: ['gpt-5.6'] }),
    ).not.toThrow();
  });

  // ─────────────────── forma de la evidencia ───────────────────

  it('un candidato sin ninguna fuente documental no es evidencia', () => {
    expect(() =>
      assertRefreshAuthorizesBenchmark(record({ candidates: [candidate({ sources: [] })] }), WINDOW, RUN),
    ).toThrow(DocumentaryRefreshError);
  });

  it('una fuente leída después del refresco que dice sustentarla se rechaza', () => {
    const futura = record({
      candidates: [
        candidate({
          sources: [
            {
              url: 'https://docs.example/models',
              retrievedAt: '2026-08-18T09:30:00.000Z',
              contentSha256: HASH,
            },
          ],
        }),
      ],
    });
    expect(() => assertRefreshAuthorizesBenchmark(futura, WINDOW, RUN)).toThrow(
      /se leyó después del refresco/,
    );
  });

  it('un parámetro soportado y rechazado a la vez es un refresco mal escrito', () => {
    const contradictorio = record({
      candidates: [candidate({ supportedParameters: ['top_k'], rejectedParameters: ['top_k'] })],
    });
    expect(() => assertRefreshAuthorizesBenchmark(contradictorio, WINDOW, RUN)).toThrow(
      /soportado y rechazado/,
    );
  });

  it('dos entradas para el mismo candidato se rechazan', () => {
    const duplicado = record({ candidates: [candidate(), candidate()] });
    expect(() => assertRefreshAuthorizesBenchmark(duplicado, WINDOW, RUN)).toThrow(
      /candidato duplicado/,
    );
  });

  it('un candidato refrescado después del registro que lo contiene se rechaza', () => {
    const incoherente = record({
      candidates: [candidate({ refreshedAt: '2026-08-18T09:15:00.000Z' })],
    });
    expect(() => assertRefreshAuthorizesBenchmark(incoherente, WINDOW, RUN)).toThrow(
      /se refrescó después del registro/,
    );
  });

  // ─────────────────── enlace con el binding ───────────────────

  it('`verifiedAt` del binding se deriva del refresco, no se escribe a mano', () => {
    expect(verifiedAtFromRefresh(record(), 'claude-sonnet-5')).toBe(REFRESHED_AT);
  });

  it('pedir el `verifiedAt` de un candidato no refrescado lanza', () => {
    expect(() => verifiedAtFromRefresh(record(), 'gpt-5.6-sol')).toThrow(/no cubre al candidato/);
  });
});

describe('credenciales por proveedor y perfil (T-H4-09)', () => {
  const env = {
    MODEL_CREDENTIAL_ANTHROPIC_SESION: 'clave-sesion',
    MODEL_CREDENTIAL_ANTHROPIC_AUTORIA: 'clave-autoria',
    MODEL_CREDENTIAL_OPENAI_SESION: '   ',
  };

  it('nombra la variable por proveedor y perfil', () => {
    expect(credentialEnvVar('anthropic', 'SESION')).toBe('MODEL_CREDENTIAL_ANTHROPIC_SESION');
    expect(credentialEnvVar('openai', 'AUTORIA')).toBe('MODEL_CREDENTIAL_OPENAI_AUTORIA');
  });

  it('resuelve cada perfil a su propia credencial', () => {
    const resolver = envCredentialResolver('anthropic', env);
    expect(ProfileCredential.resolve('SESION', resolver).reveal()).toBe('clave-sesion');
    expect(ProfileCredential.resolve('AUTORIA', resolver).reveal()).toBe('clave-autoria');
  });

  it('una credencial ausente no cae a la del otro perfil', () => {
    // Es la frontera de P-II §8.2: lo que no se tiene no se puede filtrar.
    const resolver = envCredentialResolver('openai', env);
    expect(() => ProfileCredential.resolve('AUTORIA', resolver)).toThrow(MissingCredentialError);
  });

  it('una variable en blanco cuenta como ausente, no como credencial vacía', () => {
    const resolver = envCredentialResolver('openai', env);
    expect(() => ProfileCredential.resolve('SESION', resolver)).toThrow(MissingCredentialError);
  });

  it('el secreto no se imprime al serializar', () => {
    const credential = ProfileCredential.resolve('SESION', envCredentialResolver('anthropic', env));
    expect(JSON.stringify({ credential })).not.toContain('clave-sesion');
    expect(String(credential)).not.toContain('clave-sesion');
  });
});
