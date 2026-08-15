import { describe, expect, it } from 'vitest';
import type { CostEvent, PricingManifest } from '@profesor-ia/contracts';
import {
  CostLedger,
  CurrencyMismatchError,
  ManifestNotEffectiveError,
  ManifestRewriteError,
  MissingPricingEntryError,
  priceCall,
  UnknownPricingManifestError,
  type CallUsage,
} from '../src/index.js';

const PROVEEDOR = 'anthropic';
const MODELO = 'modelo-del-binding';

function manifiesto(overrides: Partial<PricingManifest> = {}): PricingManifest {
  return {
    pricingManifestId: 'pm-2026-08-15',
    effectiveFrom: '2026-08-15T00:00:00+00:00',
    sourceEvidence: 'tarifa publicada, consultada el 2026-08-15',
    entries: [
      { provider: PROVEEDOR, modelId: MODELO, unit: 'input_token', unitPrice: 0.001, currency: 'MXN' },
      { provider: PROVEEDOR, modelId: MODELO, unit: 'output_token', unitPrice: 0.005, currency: 'MXN' },
    ],
    ...overrides,
  };
}

function uso(overrides: Partial<CallUsage> = {}): CallUsage {
  return {
    provider: PROVEEDOR,
    modelId: MODELO,
    inputTokens: 1000,
    outputTokens: 200,
    cachedInputTokens: 0,
    audioSeconds: 0,
    images: 0,
    requests: 0,
    ...overrides,
  };
}

function evento(overrides: Partial<CostEvent> = {}): CostEvent {
  return {
    costEventId: 'ce-1',
    occurredAt: '2026-08-15T10:00:00+00:00',
    stage: 'sesion',
    provider: PROVEEDOR,
    pricingManifestId: 'pm-2026-08-15',
    tokensIn: 1000,
    tokensOut: 200,
    tokensCached: 0,
    audioSeconds: 0,
    images: 0,
    attempts: 1,
    retries: 0,
    failures: 0,
    costCalculated: 2,
    currency: 'MXN',
    ...overrides,
  } as CostEvent;
}

describe('cálculo con el manifiesto vigente (T-H4-06 ← P-II §9.5)', () => {
  it('suma por unidad facturada', () => {
    const r = priceCall(manifiesto(), uso());

    expect(r.costCalculated).toBeCloseTo(1000 * 0.001 + 200 * 0.005, 10);
    expect(r.currency).toBe('MXN');
    expect(r.pricingManifestId).toBe('pm-2026-08-15');
  });

  it('una tarifa que falta NO vale cero', () => {
    // Se facturan imágenes y el manifiesto no declara su tarifa.
    expect(() => priceCall(manifiesto(), uso({ images: 3 }))).toThrow(MissingPricingEntryError);
  });

  it('no depende del orden en que se escribieron las entradas', () => {
    const alReves = manifiesto({ entries: [...manifiesto().entries].reverse() });

    expect(priceCall(alReves, uso()).costCalculated).toBe(priceCall(manifiesto(), uso()).costCalculated);
  });

  it('mezclar monedas para un mismo modelo es un fallo, no una conversión', () => {
    const mezclado = manifiesto({
      entries: [
        { provider: PROVEEDOR, modelId: MODELO, unit: 'input_token', unitPrice: 0.001, currency: 'MXN' },
        { provider: PROVEEDOR, modelId: MODELO, unit: 'output_token', unitPrice: 0.005, currency: 'USD' },
      ],
    });

    expect(() => priceCall(mezclado, uso())).toThrow(CurrencyMismatchError);
  });

  it('los reintentos y fallos cuentan como costo real: sus tokens se facturan', () => {
    const soloUnIntento = priceCall(manifiesto(), uso({ inputTokens: 1000 }));
    const conReintento = priceCall(manifiesto(), uso({ inputTokens: 2000 }));

    expect(conReintento.costCalculated).toBeGreaterThan(soloUnIntento.costCalculated);
  });
});

describe('un cambio de tarifa crea manifiesto nuevo, nunca reescribe (DEC-COST-001)', () => {
  it('registrar el mismo contenido bajo el mismo id es idempotente', () => {
    const ledger = new CostLedger();
    ledger.registerManifest(manifiesto());

    expect(() => ledger.registerManifest(manifiesto())).not.toThrow();
  });

  it('registrar contenido distinto bajo el mismo id es un intento de reescritura', () => {
    const ledger = new CostLedger();
    ledger.registerManifest(manifiesto());

    const subidaDePrecio = manifiesto({
      entries: [
        { provider: PROVEEDOR, modelId: MODELO, unit: 'input_token', unitPrice: 0.002, currency: 'MXN' },
        { provider: PROVEEDOR, modelId: MODELO, unit: 'output_token', unitPrice: 0.005, currency: 'MXN' },
      ],
    });

    expect(() => ledger.registerManifest(subidaDePrecio)).toThrow(ManifestRewriteError);
  });

  it('el costo histórico no cambia cuando sube la tarifa', () => {
    const ledger = new CostLedger();
    ledger.registerManifest(manifiesto());
    const viejo = ledger.append(evento());
    const costeViejo = viejo.costCalculated;

    // La subida entra como manifiesto NUEVO, con su propio id y vigencia.
    const nuevo = manifiesto({
      pricingManifestId: 'pm-2026-09-01',
      effectiveFrom: '2026-09-01T00:00:00+00:00',
      entries: [
        { provider: PROVEEDOR, modelId: MODELO, unit: 'input_token', unitPrice: 0.002, currency: 'MXN' },
        { provider: PROVEEDOR, modelId: MODELO, unit: 'output_token', unitPrice: 0.01, currency: 'MXN' },
      ],
    });
    ledger.registerManifest(nuevo);
    ledger.append(
      evento({
        costEventId: 'ce-2',
        occurredAt: '2026-09-02T10:00:00+00:00',
        pricingManifestId: 'pm-2026-09-01',
        costCalculated: 4,
      }),
    );

    const eventos = ledger.events();
    expect(eventos).toHaveLength(2);
    expect(eventos[0]?.costCalculated).toBe(costeViejo);
    expect(eventos[0]?.pricingManifestId).toBe('pm-2026-08-15');
    expect(eventos[1]?.pricingManifestId).toBe('pm-2026-09-01');
  });

  it('el ledger es append-only: no expone actualización ni borrado', () => {
    const ledger = new CostLedger();
    const superficie = ledger as unknown as Record<string, unknown>;

    for (const prohibido of ['update', 'delete', 'remove', 'clear', 'truncate', 'set']) {
      expect(superficie[prohibido]).toBeUndefined();
    }
  });

  it('la copia devuelta por `events()` no muta el ledger', () => {
    const ledger = new CostLedger();
    ledger.registerManifest(manifiesto());
    ledger.append(evento());

    expect(() => (ledger.events() as CostEvent[]).push(evento({ costEventId: 'ce-x' }))).toThrow();
    expect(ledger.events()).toHaveLength(1);
  });
});

describe('vigencia y trazabilidad del manifiesto', () => {
  it('un evento con manifiesto desconocido no entra', () => {
    const ledger = new CostLedger();

    expect(() => ledger.append(evento())).toThrow(UnknownPricingManifestError);
  });

  it('no se cobra con una tarifa que aún no regía', () => {
    const ledger = new CostLedger();
    ledger.registerManifest(manifiesto({ effectiveFrom: '2026-09-01T00:00:00+00:00' }));

    expect(() => ledger.append(evento({ occurredAt: '2026-08-20T10:00:00+00:00' }))).toThrow(
      ManifestNotEffectiveError,
    );
  });

  it('agrega por moneda sin convertir entre ellas', () => {
    const ledger = new CostLedger();
    ledger.registerManifest(manifiesto());
    ledger.registerManifest(
      manifiesto({
        pricingManifestId: 'pm-usd',
        entries: [
          { provider: PROVEEDOR, modelId: MODELO, unit: 'input_token', unitPrice: 0.0001, currency: 'USD' },
        ],
      }),
    );

    ledger.append(evento({ costCalculated: 2, currency: 'MXN' }));
    ledger.append(evento({ costEventId: 'ce-2', pricingManifestId: 'pm-usd', costCalculated: 0.1, currency: 'USD' }));

    const totales = ledger.totalsByCurrency();
    expect(totales.get('MXN')).toBe(2);
    expect(totales.get('USD')).toBe(0.1);
    expect(totales.size).toBe(2);
  });
});
