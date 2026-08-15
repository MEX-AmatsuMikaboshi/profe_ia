import { describe, expect, it } from 'vitest';
import {
  BENCH04_HARNESS_VERSION,
  BENCH04_L0_CASES,
  BENCH04_REFERENCE_VARIANT_ID,
  BENCH04_VARIANTS,
  BenchmarkPendingError,
  freezeWinningOrder,
  runBench04,
  type BenchCase,
  type PipelineVariant,
} from '../src/bench.js';
import { CertificateRejectedError, SEARCH_ORDER_VERSION, search } from '../src/search.js';
import type { SearchOutcome, SearchRequest } from '../src/types.js';

const caseById = (id: string): BenchCase => {
  const found = BENCH04_L0_CASES.find((c) => c.id === id);
  if (!found) throw new Error(`caso inexistente: ${id}`);
  return found;
};

const telemetry = {
  workUnits: 0,
  costExplored: 0,
  wallTimeoutHit: false,
  mode: 'heuristic',
  searchOrderVersion: SEARCH_ORDER_VERSION,
} as const;

const reference = BENCH04_VARIANTS.find((v) => v.id === BENCH04_REFERENCE_VARIANT_ID) as PipelineVariant;

/** Variante sembrada: confunde validez semántica con derivabilidad (P-I §7.4). */
const prefilterAsProof: PipelineVariant = {
  id: 'prefilter_as_proof',
  description: 'Sembrada: toma la validez semántica del prefiltro por prueba.',
  run: (request: SearchRequest): SearchOutcome => ({
    status: 'proof_found',
    proof: {
      lines: request.premises.map((p) => ({ formula: p, rule: 'PR', depth: 0 })),
      cost: 0,
      rulesUsed: [],
    },
    minimalCostVerified: false,
    telemetry,
  }),
};

describe('arnés BENCH-04: la muestra L0', () => {
  it('corre las dos alternativas equivalentes sin hallazgos de seguridad', () => {
    const report = runBench04();

    expect(report.benchmarkId).toBe('BENCH-04');
    expect(report.harnessVersion).toBe(BENCH04_HARNESS_VERSION);
    expect(report.referenceVariantId).toBe(BENCH04_REFERENCE_VARIANT_ID);
    expect(report.caseIds).toEqual(BENCH04_L0_CASES.map((c) => c.id));
    expect(report.safetyFindings).toEqual([]);
    expect(report.comparable).toBe(true);
    expect(report.measurements).toHaveLength(BENCH04_L0_CASES.length * BENCH04_VARIANTS.length);
  });

  it('todo `proof_found` de la muestra queda re-verificado por el arnés', () => {
    const report = runBench04();
    const encontrados = report.measurements.filter((m) => m.status === 'proof_found');

    expect(encontrados.length).toBeGreaterThan(0);
    expect(encontrados.every((m) => m.certificateReverified === true)).toBe(true);
  });

  it('sin reloj inyectado el informe es determinista y reproducible', () => {
    expect(runBench04()).toEqual(runBench04());
    expect(runBench04().wallClockMeasured).toBe(false);
    expect(runBench04().measurements.every((m) => m.wallClockMs === undefined)).toBe(true);
  });

  it('el reloj de pared se registra aparte y solo si se pide', () => {
    let tick = 0;
    const report = runBench04({ clock: () => (tick += 7) });

    expect(report.wallClockMeasured).toBe(true);
    expect(report.measurements.every((m) => m.wallClockMs === 7)).toBe(true);
  });
});

describe('lo que BENCH-04 tiene que poder mostrar', () => {
  it('el prefiltro ahorra trabajo cuando el candidato es semánticamente inválido', () => {
    const report = runBench04({ cases: [caseById('semantically-invalid')] });
    const conPrefiltro = report.measurements.find((m) => m.variantId === BENCH04_REFERENCE_VARIANT_ID);
    const conPostfiltro = report.measurements.find((m) => m.variantId === 'search_then_prefilter');

    expect(conPrefiltro?.status).toBe('semantically_invalid');
    expect(conPostfiltro?.status).toBe('semantically_invalid');
    // Mismo veredicto, distinto trabajo: eso es exactamente lo que se mide.
    expect(conPrefiltro?.workUnits).toBe(0);
    expect(conPostfiltro?.workUnits).toBeGreaterThan(0);
  });

  it('el trabajo se agrega por variante en unidades reproducibles', () => {
    const report = runBench04();
    const totals = Object.fromEntries(report.totals.map((t) => [t.variantId, t]));

    expect(report.totals).toHaveLength(BENCH04_VARIANTS.length);
    expect(totals[BENCH04_REFERENCE_VARIANT_ID]?.workUnits).toBeLessThan(
      totals['search_then_prefilter']?.workUnits as number,
    );
    expect(totals[BENCH04_REFERENCE_VARIANT_ID]?.proofsFound).toBe(
      totals['search_then_prefilter']?.proofsFound,
    );
  });
});

describe('seguridad: una variante que cambia veredictos no compite', () => {
  it('detecta que buscar sin oráculo no es una alternativa equivalente', () => {
    const sinOraculo: PipelineVariant = {
      id: 'search_without_oracle',
      description: 'Sembrada: sin oráculo semántico.',
      run: (request) => search(request, { semanticOracle: 'off' }),
    };

    const report = runBench04({
      cases: [caseById('semantically-invalid')],
      variants: [reference, sinOraculo],
    });

    expect(report.comparable).toBe(false);
    expect(report.safetyFindings.map((f) => f.code)).toContain('STATUS_DISAGREEMENT');
    expect(report.safetyFindings[0]?.variantId).toBe('search_without_oracle');
  });

  it('detecta que la validez semántica se tome por prueba de derivabilidad', () => {
    const report = runBench04({
      cases: [caseById('semantically-invalid')],
      variants: [reference, prefilterAsProof],
    });

    expect(report.comparable).toBe(false);
    expect(report.safetyFindings.map((f) => f.code)).toContain('UNVERIFIED_CERTIFICATE');
    const medicion = report.measurements.find((m) => m.variantId === prefilterAsProof.id);
    expect(medicion?.certificateReverified).toBe(false);
  });

  it('trata un certificado rechazado como incidente, no como resultado', () => {
    const rechazado: PipelineVariant = {
      id: 'rejected_certificate',
      description: 'Sembrada: produce un certificado que logic-core rechaza.',
      run: () => {
        throw new CertificateRejectedError('B', ['E-RULE-FORM']);
      },
    };

    const report = runBench04({
      cases: [caseById('forward-elimination')],
      variants: [reference, rechazado],
    });

    expect(report.comparable).toBe(false);
    expect(report.safetyFindings.map((f) => f.code)).toContain('CERTIFICATE_REJECTED');
    expect(report.measurements.find((m) => m.variantId === rechazado.id)?.status).toBe('threw');
  });

  it('detecta una afirmación de minimalidad fuera del modo exhaustivo', () => {
    const minimalidadIndebida: PipelineVariant = {
      id: 'claims_minimality',
      description: 'Sembrada: afirma minimalidad en modo heurístico.',
      run: (request) => {
        const outcome = search(request);
        return outcome.status === 'proof_found' ? { ...outcome, minimalCostVerified: true } : outcome;
      },
    };

    const report = runBench04({
      cases: [caseById('forward-elimination')],
      variants: [reference, minimalidadIndebida],
    });

    expect(report.safetyFindings.map((f) => f.code)).toContain('UNSUPPORTED_MINIMALITY_CLAIM');
    expect(report.comparable).toBe(false);
  });

  it('detecta el uso del corte de pared como afirmación lógica', () => {
    const cortadoPorPared: PipelineVariant = {
      id: 'wall_timeout_claim',
      description: 'Sembrada: afirma cobertura hasta k tras cortar por reloj.',
      run: () => ({
        status: 'no_proof_with_cost_at_most_k',
        k: 6,
        telemetry: { ...telemetry, mode: 'exhaustive_k', wallTimeoutHit: true },
      }),
    };

    const report = runBench04({
      cases: [caseById('exhaustive-small-k')],
      variants: [reference, cortadoPorPared],
    });

    expect(report.safetyFindings.map((f) => f.code)).toContain('WALL_TIMEOUT_AS_LOGICAL_CLAIM');
    expect(report.comparable).toBe(false);
  });
});

describe('el arnés mide; F6 congela', () => {
  it('el informe no declara ganador', () => {
    const claves = Object.keys(runBench04()).join(' ');
    expect(claves).not.toMatch(/winner|ganador|best|recommended/i);
  });

  it('pedir el orden congelado falla cerrado hasta F6', () => {
    const report = runBench04();
    expect(() => freezeWinningOrder(report)).toThrow(BenchmarkPendingError);
    expect(() => freezeWinningOrder(report)).toThrow(/BENCH-04/);
    expect(() => freezeWinningOrder(report)).toThrow(/T-H5-05/);
  });
});
