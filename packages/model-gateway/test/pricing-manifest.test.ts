import { PricingManifest } from '@profesor-ia/contracts';
import { describe, expect, it } from 'vitest';

import { CostLedger, priceCall } from '../src/cost.js';
import { BudgetController } from '../src/budget.js';
import {
  FIX_MXN_PER_USD,
  PRICING_MANIFEST_2026_08_18,
  PUBLISHED_USD_PRICES,
  mxnPerToken,
} from '../src/pricing-manifest.js';

/**
 * Manifiesto de precios reales (T-H4-10).
 *
 * Lo que estas pruebas defienden no es la aritmética —que es trivial— sino la
 * propiedad por la que el manifiesto está en MXN: que el gate de presupuesto
 * **sí** cuenta lo que se gasta. Un manifiesto en USD lo dejaría ciego, y esa
 * es la razón de existir de este archivo.
 */

describe('manifiesto de precios 2026-08-18', () => {
  it('cumple el contrato', () => {
    expect(() => PricingManifest.parse(PRICING_MANIFEST_2026_08_18)).not.toThrow();
  });

  it('está entero en MXN, que es la moneda que el gate sabe juzgar', () => {
    const monedas = new Set(PRICING_MANIFEST_2026_08_18.entries.map((e) => e.currency));
    expect([...monedas]).toEqual(['MXN']);
  });

  it('deriva cada precio del publicado en USD por el FIX, sin cifras a mano', () => {
    for (const publicado of PUBLISHED_USD_PRICES) {
      const entrada = PRICING_MANIFEST_2026_08_18.entries.find(
        (e) => e.modelId === publicado.modelId && e.unit === 'input_token',
      );
      expect(entrada).toBeDefined();
      expect(entrada?.unitPrice).toBeCloseTo((publicado.input * FIX_MXN_PER_USD) / 1e6, 12);

      const salida = PRICING_MANIFEST_2026_08_18.entries.find(
        (e) => e.modelId === publicado.modelId && e.unit === 'output_token',
      );
      expect(salida).toBeDefined();
      expect(salida?.unitPrice).toBeCloseTo((publicado.output * FIX_MXN_PER_USD) / 1e6, 12);
    }
  });

  it('cita las tres fuentes: los dos proveedores y el tipo de cambio', () => {
    const evidencia = PRICING_MANIFEST_2026_08_18.sourceEvidence;
    expect(evidencia).toContain('banxico.org.mx');
    expect(evidencia).toContain('platform.claude.com');
    expect(evidencia).toContain('developers.openai.com');
  });

  it('lleva el tipo de cambio en el id: mismos precios con otro FIX es otro manifiesto', () => {
    expect(PRICING_MANIFEST_2026_08_18.pricingManifestId).toContain(String(FIX_MXN_PER_USD));
  });

  it('un gasto tarifado con él llega a la cubeta que el gate observa', () => {
    const ledger = new CostLedger();
    ledger.registerManifest(PRICING_MANIFEST_2026_08_18);

    // Un millón de tokens de salida de claude-sonnet-5: USD 10 al FIX declarado.
    const precio = priceCall(PRICING_MANIFEST_2026_08_18, {
      provider: 'anthropic',
      modelId: 'claude-sonnet-5',
      inputTokens: 0,
      outputTokens: 1_000_000,
      cachedInputTokens: 0,
      audioSeconds: 0,
      images: 0,
      requests: 0,
    });
    expect(precio.currency).toBe('MXN');
    expect(precio.costCalculated).toBeCloseTo(10 * FIX_MXN_PER_USD, 6);

    ledger.append({
      costEventId: 'e-1',
      occurredAt: '2026-08-18T00:00:00+00:00',
      stage: 'benchmark',
      provider: 'anthropic',
      pricingManifestId: PRICING_MANIFEST_2026_08_18.pricingManifestId,
      tokensIn: 0,
      tokensOut: 1_000_000,
      tokensCached: 0,
      audioSeconds: 0,
      images: 0,
      attempts: 1,
      retries: 0,
      failures: 0,
      costCalculated: precio.costCalculated,
      currency: precio.currency,
    });

    const gate = new BudgetController(ledger, { alertThresholdMxn: 400 });
    expect(gate.accumulatedMxn()).toBeCloseTo(10 * FIX_MXN_PER_USD, 6);
  });

  it('acumulando lo suficiente, el bloqueo duro llega a dispararse', () => {
    const ledger = new CostLedger();
    ledger.registerManifest(PRICING_MANIFEST_2026_08_18);

    // Cinco millones de tokens de salida de sonnet-5: USD 50 ≈ MXN 851, por
    // encima del umbral duro de 700. Es la propiedad que un manifiesto en USD
    // habría perdido en silencio.
    const precio = priceCall(PRICING_MANIFEST_2026_08_18, {
      provider: 'anthropic',
      modelId: 'claude-sonnet-5',
      inputTokens: 0,
      outputTokens: 5_000_000,
      cachedInputTokens: 0,
      audioSeconds: 0,
      images: 0,
      requests: 0,
    });
    ledger.append({
      costEventId: 'e-2',
      occurredAt: '2026-08-18T00:00:00+00:00',
      stage: 'benchmark',
      provider: 'anthropic',
      pricingManifestId: PRICING_MANIFEST_2026_08_18.pricingManifestId,
      tokensIn: 0,
      tokensOut: 5_000_000,
      tokensCached: 0,
      audioSeconds: 0,
      images: 0,
      attempts: 1,
      retries: 0,
      failures: 0,
      costCalculated: precio.costCalculated,
      currency: precio.currency,
    });

    const gate = new BudgetController(ledger, { alertThresholdMxn: 400 });
    expect(gate.accumulatedMxn()).toBeGreaterThan(700);
    expect(gate.status().blocked).toBe(true);
  });

  it('mxnPerToken no convierte nada por su cuenta: exige el tipo de cambio', () => {
    expect(mxnPerToken(1, 20)).toBeCloseTo(0.00002, 12);
    expect(mxnPerToken(0, 17.0245)).toBe(0);
  });
});
