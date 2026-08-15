import { describe, expect, it } from 'vitest';
import { ModelBinding } from '@profesor-ia/contracts';
import {
  assertModalityEligible,
  cacheTelemetryFor,
  checkModalityEligibility,
  DATA_CLASSIFICATIONS,
  MODALITIES,
  ModalityNotEligibleError,
} from '../src/index.js';

type Capacidades = Parameters<typeof ModelBinding.parse>[0];

function binding(capabilities: Record<string, unknown> = {}) {
  return ModelBinding.parse({
    bindingId: 'binding-01',
    profile: 'SESION',
    provider: 'anthropic',
    modelId: 'modelo-del-binding',
    endpoint: 'https://proveedor.example/v1/messages',
    snapshot: 'snapshot-fechado',
    capabilities: {
      supportedParameters: [],
      rejectedParameters: [],
      structuredOutput: { supported: true },
      reasoning: { supported: false },
      batch: { supported: true },
      caching: { supported: true, ttlSeconds: 300 },
      dataPolicy: { contractualEligibility: 'enabled', loggingRetentionDays: 0 },
      ...capabilities,
    },
    verifiedAt: '2026-08-13T00:00:00+00:00',
  } as Capacidades);
}

const FREEZE_MAX_RETENCION = 0;

function verdict(overrides: Record<string, unknown> = {}) {
  return checkModalityEligibility({
    binding: binding(),
    modality: 'batch',
    dataClassification: 'con_datos_de_participante',
    maxRetentionDaysAtFreeze: FREEZE_MAX_RETENCION,
    ...overrides,
  } as Parameters<typeof checkModalityEligibility>[0]);
}

describe('batch y caching son capacidades explícitas (T-H4-08 ← P-II §8.4)', () => {
  it('el contrato del binding las exige declaradas', () => {
    expect(() =>
      binding({ batch: undefined, caching: undefined } as unknown as Record<string, unknown>),
    ).toThrow();
  });

  it('una modalidad no declarada no se usa, aunque no haya datos de participante', () => {
    const v = verdict({
      binding: binding({ batch: { supported: false } }),
      dataClassification: 'sin_datos_de_participante',
    });

    expect(v.eligible).toBe(false);
    expect(v.reason).toContain('no declara batch');
  });

  it('la clasificación de datos tiene solo las dos clases que traza §8.4', () => {
    expect(DATA_CLASSIFICATIONS).toEqual([
      'con_datos_de_participante',
      'sin_datos_de_participante',
    ]);
    expect(MODALITIES).toEqual(['batch', 'caching']);
  });
});

describe('el tráfico de participante no va a modalidades incompatibles', () => {
  it('pasa con elegibilidad enabled y retención dentro del freeze', () => {
    expect(verdict().eligible).toBe(true);
  });

  it('elegibilidad `unknown` no habilita: no consta no es consta que se puede', () => {
    const v = verdict({
      binding: binding({ dataPolicy: { contractualEligibility: 'unknown', loggingRetentionDays: 0 } }),
    });

    expect(v.eligible).toBe(false);
    expect(v.reason).toContain('unknown');
  });

  it('`available_not_enabled` tampoco habilita', () => {
    const v = verdict({
      binding: binding({
        dataPolicy: { contractualEligibility: 'available_not_enabled', loggingRetentionDays: 0 },
      }),
    });

    expect(v.eligible).toBe(false);
  });

  it('sin retención declarada no es elegible: lo desconocido no es permiso', () => {
    const v = verdict({
      binding: binding({ dataPolicy: { contractualEligibility: 'enabled' } }),
    });

    expect(v.eligible).toBe(false);
    expect(v.reason).toContain('no declara retención');
  });

  it('una retención por encima de la del freeze no es elegible', () => {
    const v = verdict({
      binding: binding({
        dataPolicy: { contractualEligibility: 'enabled', loggingRetentionDays: 30 },
      }),
      maxRetentionDaysAtFreeze: 0,
    });

    expect(v.eligible).toBe(false);
    expect(v.reason).toContain('supera');
  });

  it('`zeroDataRetention` cuenta como retención 0', () => {
    const v = verdict({
      binding: binding({
        dataPolicy: { contractualEligibility: 'enabled', zeroDataRetention: true },
      }),
    });

    expect(v.eligible).toBe(true);
  });

  it('sin datos de participante basta con que la modalidad esté declarada', () => {
    // Elegibilidad `unknown` y retención larga: aun así pasa, porque la regla de
    // §8.4 protege el tráfico **de participante**, no todo el tráfico.
    const v = verdict({
      binding: binding({
        dataPolicy: { contractualEligibility: 'unknown', loggingRetentionDays: 365 },
      }),
      dataClassification: 'sin_datos_de_participante',
    });

    expect(v.eligible).toBe(true);
  });

  it('`assertModalityEligible` aborta, que es la vía por omisión', () => {
    expect(() =>
      assertModalityEligible({
        binding: binding({ dataPolicy: { contractualEligibility: 'unknown' } }),
        modality: 'caching',
        dataClassification: 'con_datos_de_participante',
        maxRetentionDaysAtFreeze: 0,
      }),
    ).toThrow(ModalityNotEligibleError);
  });
});

describe('telemetría de caché al cost-ledger (§8.4)', () => {
  it('lleva hits, misses, tokens cacheados y TTL cuando se conoce', () => {
    const t = cacheTelemetryFor(binding(), { hits: 3, misses: 1, cachedTokens: 900 });

    expect(t).toEqual({ hits: 3, misses: 1, cachedTokens: 900, ttlSeconds: 300 });
  });

  it('sin TTL conocido el campo no aparece: un cero afirmaría que no hay caché', () => {
    const sinTtl = binding({ caching: { supported: true } });
    const t = cacheTelemetryFor(sinTtl, { hits: 0, misses: 2, cachedTokens: 0 });

    expect(t).not.toHaveProperty('ttlSeconds');
    expect(t).toEqual({ hits: 0, misses: 2, cachedTokens: 0 });
  });
});
