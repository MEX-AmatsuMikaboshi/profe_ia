import { describe, expect, it } from 'vitest';
import type { CostEvent, PricingManifest } from '@profesor-ia/contracts';
import {
  BudgetBlockedError,
  BudgetController,
  CostLedger,
  HARD_REVIEW_THRESHOLD_MXN,
  InvalidAlertThresholdError,
  ORDINARY_MONTHLY_TARGET_MXN,
} from '../src/index.js';

const MANIFIESTO: PricingManifest = {
  pricingManifestId: 'pm-2026-08-15',
  effectiveFrom: '2026-08-15T00:00:00+00:00',
  sourceEvidence: 'tarifa publicada, consultada el 2026-08-15',
  entries: [
    { provider: 'anthropic', modelId: 'm', unit: 'input_token', unitPrice: 0.001, currency: 'MXN' },
  ],
};

function ledgerCon(...costes: readonly { mxn: number; id: string }[]): CostLedger {
  const ledger = new CostLedger();
  ledger.registerManifest(MANIFIESTO);
  for (const { mxn, id } of costes) {
    ledger.append({
      costEventId: id,
      occurredAt: '2026-08-16T10:00:00+00:00',
      stage: 'sesion',
      provider: 'anthropic',
      pricingManifestId: 'pm-2026-08-15',
      tokensIn: 1,
      tokensOut: 0,
      tokensCached: 0,
      audioSeconds: 0,
      images: 0,
      attempts: 1,
      retries: 0,
      failures: 0,
      costCalculated: mxn,
      currency: 'MXN',
    } as CostEvent);
  }
  return ledger;
}

const OPCIONES = { alertThresholdMxn: 400 };

describe('cifras literales del Maestro (T-H4-07 ← OWNER-BUDGET-001)', () => {
  it('objetivo ordinario 500 y umbral duro 700', () => {
    expect(ORDINARY_MONTHLY_TARGET_MXN).toBe(500);
    expect(HARD_REVIEW_THRESHOLD_MXN).toBe(700);
  });

  it('el umbral de alerta es obligatorio y no tiene valor por omisión', () => {
    const ledger = ledgerCon();

    // «Alerta al acercarse» no está cuantificado: elegir aquí un 80 % fijaría
    // por cuenta propia cuándo se avisa al propietario.
    expect(() => new BudgetController(ledger, { alertThresholdMxn: 0 })).toThrow(
      InvalidAlertThresholdError,
    );
    expect(() => new BudgetController(ledger, { alertThresholdMxn: Number.NaN })).toThrow(
      InvalidAlertThresholdError,
    );
  });

  it('un umbral de alerta por encima del duro se rechaza: avisaría tras bloquear', () => {
    expect(() => new BudgetController(ledgerCon(), { alertThresholdMxn: 900 })).toThrow(
      InvalidAlertThresholdError,
    );
  });
});

describe('alerta y bloqueo', () => {
  it('por debajo del umbral de alerta no avisa ni bloquea', () => {
    const gate = new BudgetController(ledgerCon({ mxn: 100, id: 'e1' }), OPCIONES);

    expect(gate.status()).toMatchObject({ accumulatedMxn: 100, alerting: false, blocked: false });
  });

  it('avisa al acercarse, sin bloquear todavía', () => {
    const gate = new BudgetController(ledgerCon({ mxn: 450, id: 'e1' }), OPCIONES);

    expect(gate.status()).toMatchObject({ alerting: true, blocked: false });
    expect(() => gate.assertBillableAllowed()).not.toThrow();
  });

  it('en 700 exactos aún no se superó el umbral', () => {
    const gate = new BudgetController(ledgerCon({ mxn: 700, id: 'e1' }), OPCIONES);

    expect(gate.status().blocked).toBe(false);
    expect(() => gate.assertBillableAllowed()).not.toThrow();
  });

  it('por encima de 700 bloquea las operaciones facturables', () => {
    const gate = new BudgetController(ledgerCon({ mxn: 700.01, id: 'e1' }), OPCIONES);

    expect(gate.status().blocked).toBe(true);
    expect(() => gate.assertBillableAllowed()).toThrow(BudgetBlockedError);
  });

  it('el bloqueo no ofrece ninguna vía de continuar: el gate no degrada integridad', () => {
    const gate = new BudgetController(ledgerCon({ mxn: 900, id: 'e1' }), OPCIONES);
    const superficie = gate as unknown as Record<string, unknown>;

    for (const escape of ['force', 'override', 'bypass', 'continueAnyway', 'allowDegraded']) {
      expect(superficie[escape]).toBeUndefined();
    }
    expect(() => gate.assertBillableAllowed()).toThrow(BudgetBlockedError);
  });
});

describe('revisión explícita del propietario', () => {
  it('es lo único que levanta el bloqueo', () => {
    const gate = new BudgetController(ledgerCon({ mxn: 900, id: 'e1' }), OPCIONES);
    expect(gate.status().blocked).toBe(true);

    gate.registerOwnerReview('evento-de-revision-1');

    expect(gate.status().blocked).toBe(false);
    expect(gate.status().ownerReviewEventId).toBe('evento-de-revision-1');
    expect(() => gate.assertBillableAllowed()).not.toThrow();
  });

  it('la revisión registra qué acumulado se revisó, no solo que alguien revisó', () => {
    const gate = new BudgetController(ledgerCon({ mxn: 900, id: 'e1' }), OPCIONES);
    const review = gate.registerOwnerReview('evento-de-revision-1');

    expect(review).toEqual({ ownerReviewEventId: 'evento-de-revision-1', reviewedUpToMxn: 900 });
  });
});

describe('agregación desde el ledger', () => {
  it('suma los eventos del ledger, incluidos los de reintentos y fallos', () => {
    const gate = new BudgetController(
      ledgerCon({ mxn: 300, id: 'e1' }, { mxn: 250, id: 'e2' }, { mxn: 200, id: 'e3' }),
      OPCIONES,
    );

    expect(gate.accumulatedMxn()).toBe(750);
    expect(gate.status().blocked).toBe(true);
  });

  it('no suma otras monedas ni las convierte', () => {
    const ledger = ledgerCon({ mxn: 100, id: 'e1' });
    ledger.registerManifest({
      ...MANIFIESTO,
      pricingManifestId: 'pm-usd',
      entries: [
        { provider: 'anthropic', modelId: 'm', unit: 'input_token', unitPrice: 0.1, currency: 'USD' },
      ],
    });
    ledger.append({
      costEventId: 'e-usd',
      occurredAt: '2026-08-16T10:00:00+00:00',
      stage: 'sesion',
      provider: 'anthropic',
      pricingManifestId: 'pm-usd',
      tokensIn: 1,
      tokensOut: 0,
      tokensCached: 0,
      audioSeconds: 0,
      images: 0,
      attempts: 1,
      retries: 0,
      failures: 0,
      costCalculated: 5000,
      currency: 'USD',
    } as CostEvent);

    const gate = new BudgetController(ledger, OPCIONES);

    // Los 5000 USD no se convierten ni se suman: el acumulado sigue siendo MXN.
    expect(gate.accumulatedMxn()).toBe(100);
    expect(gate.status().blocked).toBe(false);
  });
});
