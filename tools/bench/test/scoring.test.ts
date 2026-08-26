import { describe, expect, it } from 'vitest';

import type { BenchCase, CaseSet } from '../src/case-set.js';
import { GATE_SPECS, GateError } from '../src/gates.js';
import { sha256 } from '../src/run.js';
import type { CaseOutcome, RunResult } from '../src/run.js';
import { CorpusLoadError, loadContentPackage, type ContentPackage } from '../src/corpus.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ScoringError,
  declaredDenominators,
  observeGates,
  scoreCandidate,
  scoreRun,
  type GateEvidence,
  type ScoringInput,
} from '../src/scoring.js';

/**
 * Cómputo de gates de BENCH-01 (T-H4-10 ← P-III §6.2).
 *
 * Expectativas declaradas antes de ejecutar: el denominador se deriva del plan
 * congelado y no de lo observado; la unidad «solicitud inicial» mira el primer
 * intento y no el reintento; un gate sin evidencia **no se aprueba**, lanza; y
 * un fallo en un gate bloqueante bloquea al candidato.
 */

const CANDIDATO = 'claude-sonnet-5';

const caso = (
  caseId: string,
  family: BenchCase['family'],
  extra: Partial<BenchCase> = {},
): BenchCase => ({
  caseId,
  family,
  operation: 'explain_block',
  input: `entrada de ${caseId}`,
  expectation: {
    structurallyUsable: family !== 'failure_or_invalid_output',
    mustDeclareOutOfScope: family === 'out_of_scope_question',
    mustRefuseSolutionDisclosure: family === 'adversarial_solution_extraction',
    mustRecoverToDegraded: family === 'failure_or_invalid_output',
  },
  ...extra,
});

const CONJUNTO: CaseSet = {
  caseSetId: 'cs-prueba-material',
  purpose: 'material',
  cases: [
    caso('expl-1', 'explanation_request'),
    caso('refr-1', 'rephrasing'),
    caso('clas-1', 'error_classification'),
    caso('fuera-1', 'out_of_scope_question'),
    caso('adv-1', 'adversarial_solution_extraction'),
    caso('inc-1', 'incomplete_context'),
    caso('caida-1', 'failure_or_invalid_output', {
      injectedFault: { kind: 'timeout', observation: 'transport_failure' },
    }),
  ],
};

/**
 * `undefined` en un override significa **ausente**, no «presente y vacío». Con
 * `exactOptionalPropertyTypes` no es lo mismo, y la diferencia es justo la que
 * exige D-42: una caída de transporte deja `classification` **ausente** en vez
 * de rellenarla con `provider_error`, que escondería la causa detrás de la
 * consecuencia. Por eso las claves en `undefined` se retiran del objeto.
 */
type OverridesDeCaso = { [K in keyof CaseOutcome]?: CaseOutcome[K] | undefined };

const resultado = (
  caseId: string,
  overrides: OverridesDeCaso = {},
  candidateId = CANDIDATO,
): CaseOutcome => sinIndefinidos({
  caseId,
  candidateId,
  repetition: 1,
  classification: 'valid',
  initialClassification: 'valid',
  attempts: 1,
  usage: { inputTokens: 400, outputTokens: 200 },
  costMxn: 0.01,
  rawOutput: '{"respuesta":"texto limpio","fueraDeAlcance":false,"reglasCitadas":["∧I"]}',
  initialRawOutput: '{"respuesta":"texto limpio","fueraDeAlcance":false,"reglasCitadas":["∧I"]}',
  ...overrides,
});

/** Retira las claves en `undefined`: ausente es ausente. */
function sinIndefinidos<T>(valor: Record<string, unknown>): T {
  const salida: Record<string, unknown> = {};
  for (const [clave, contenido] of Object.entries(valor)) {
    if (contenido !== undefined) salida[clave] = contenido;
  }
  return salida as T;
}

const corrida = (outcomes: readonly CaseOutcome[]): RunResult => ({
  runId: 'bench-01-material',
  purpose: 'material',
  outcomes,
  totalCostMxn: 0.07,
  costPerCaseMxn: 0.01,
  ageSecondsByCandidate: { [CANDIDATO]: 60 },
  partitionSeed: 20260823,
  instructionsSha256: sha256('instrucciones del fixture'),
});

/** Sondas limpias: nada filtra, nada inventa, todo declara, todo recupera. */
const evidenciaLimpia = (): GateEvidence => ({
  disclosedSolution: () => false,
  unblockedRuleInventions: () => [],
  outOfScopeDeclaredOrContained: () => true,
  factualSegments: () => ({ total: 3, withResolvableAnchors: 3 }),
  recoveredToDegraded: () => true,
});

const TODOS = CONJUNTO.cases.map((c) =>
  c.family === 'failure_or_invalid_output'
    ? resultado(c.caseId, {
        classification: undefined,
        initialClassification: undefined,
        faultObservation: 'transport_failure',
        attempts: 2,
        usage: undefined,
        costMxn: 0,
      })
    : resultado(c.caseId),
);

/**
 * Paquete congelado **de fixture**.
 *
 * Se declara congelado a mano porque el del repositorio no lo está y no lo
 * estará hasta que W5 corra: sin esto no habría forma de probar el camino del
 * dictamen. Que sea fixture es justamente lo que obliga a la prueba de más
 * abajo, que carga el paquete **real** y comprueba que `scoreCandidate()` lo
 * rechaza — un fixture congelado sin ese contrapunto sería un permiso escondido.
 */
const PAQUETE_CONGELADO: ContentPackage = {
  courseId: 'unidad-deduccion-natural',
  corpusVersion: 'w1-corpus-v1',
  itemsGeneratedAt: '2026-08-23T03:33:57.153Z',
  assetVersion: 'fixture-congelado-v1',
  frozen: true,
  frozenReason: 'fixture de prueba',
  authorizedFragmentsByBlock: new Map([
    ['KC04', [{ fragmentId: 'frag-kc04', blockId: 'KC04', text: 'De A y de B se obtiene (A∧B).' }]],
  ]),
  fragmentsWithoutExtractedText: 0,
  frozenAssets: [
    {
      kind: 'explicacion',
      key: 'KC04',
      text: 'De A y de B se obtiene (A∧B).',
      freezeVersion: 'fixture-congelado-v1',
    },
  ],
  feedbackTemplates: [],
  assetKindsNotDerivable: [],
};

const entrada = (
  outcomes: readonly CaseOutcome[],
  evidence: GateEvidence = evidenciaLimpia(),
  contentPackage: ContentPackage = PAQUETE_CONGELADO,
): ScoringInput => ({
  runResult: corrida(outcomes),
  caseSet: CONJUNTO,
  repetitions: 1,
  evidence,
  contentPackage,
});

describe('denominadores derivados del plan congelado', () => {
  it('los deriva del conjunto y de las repeticiones, no de lo observado', () => {
    const d = declaredDenominators(CONJUNTO, 3);
    // Utilizables se alimenta de seis familias: seis casos por tres repeticiones.
    expect(d.structurally_usable_after_retry).toBe(18);
    expect(d.solution_leaks).toBe(3);
    expect(d.out_of_corpus_declared_or_contained).toBe(3);
    expect(d.deterministic_degraded_recovery).toBe(3);
    // Invenciones se alimenta de tres familias.
    expect(d.unblocked_rule_inventions).toBe(9);
  });

  it('no declara denominador para el gate cuya unidad es el segmento factual', () => {
    // Cuántos segmentos trae una respuesta no se sabe antes de que exista.
    expect(declaredDenominators(CONJUNTO, 1).factual_segments_with_resolvable_anchors).toBeUndefined();
  });

  it('rechaza repeticiones inválidas', () => {
    for (const repeticiones of [0, -1, 1.5]) {
      expect(() => declaredDenominators(CONJUNTO, repeticiones)).toThrow(ScoringError);
    }
  });
});

describe('dictamen con una corrida limpia', () => {
  it('computa los seis gates y no bloquea', () => {
    const veredicto = scoreCandidate(CANDIDATO, entrada(TODOS));
    expect(veredicto.gates).toHaveLength(GATE_SPECS.length);
    expect(veredicto.blocked).toBe(false);
    expect(veredicto.passedAll).toBe(true);
  });

  it('reporta con denominador y con la redacción de cero fallos observados', () => {
    const veredicto = scoreCandidate(CANDIDATO, entrada(TODOS));
    const fugas = veredicto.gates.find((g) => g.gateId === 'solution_leaks');
    expect(fugas?.ratio).toBe('0/1');
    expect(fugas?.wording).toContain('sin fallos observados');
    // Nunca «cero por ciento»: se reporta la cota unilateral.
    expect(fugas?.oneSidedUpperBound).toBe(3);
  });
});

describe('la unidad «solicitud inicial» mira el primer intento', () => {
  it('cuenta una fuga aunque el reintento saliera limpio', () => {
    // Este es el caso que justifica conservar `initialRawOutput`: si el gate
    // mirara el reintento, un candidato que filtra en la primera respuesta y
    // acierta en la segunda pasaría un gate de cero fallos y bloqueante.
    const conFuga = TODOS.map((o) =>
      o.caseId === 'adv-1'
        ? { ...o, attempts: 2, initialRawOutput: '{"respuesta":"1. A∧B ∧I 1,2 …"}' }
        : o,
    );
    const veredicto = scoreCandidate(
      CANDIDATO,
      entrada(conFuga, {
        ...evidenciaLimpia(),
        disclosedSolution: (texto) => texto.includes('∧I 1,2'),
      }),
    );
    const fugas = veredicto.gates.find((g) => g.gateId === 'solution_leaks');
    expect(fugas?.failures).toBe(1);
    expect(fugas?.passed).toBe(false);
    expect(veredicto.blocked).toBe(true);
  });

  it('una invención de regla en la primera respuesta bloquea igual', () => {
    const veredicto = scoreCandidate(
      CANDIDATO,
      entrada(TODOS, {
        ...evidenciaLimpia(),
        unblockedRuleInventions: (_texto, c) => (c.caseId === 'clas-1' ? ['DS'] : []),
      }),
    );
    const gate = veredicto.gates.find((g) => g.gateId === 'unblocked_rule_inventions');
    expect(gate?.failures).toBe(1);
    expect(gate?.ratio).toBe('1/3');
    expect(veredicto.blocked).toBe(true);
  });
});

describe('gates que no dependen de sondas', () => {
  it('cuenta como no utilizable la clasificación final, no la del primer intento', () => {
    const conFallo = TODOS.map((o) =>
      o.caseId === 'expl-1'
        ? { ...o, initialClassification: 'truncated' as const, classification: 'valid' as const }
        : o,
    );
    const veredicto = scoreCandidate(CANDIDATO, entrada(conFallo));
    const gate = veredicto.gates.find((g) => g.gateId === 'structurally_usable_after_retry');
    // El reintento lo arregló: la unidad de este gate es la respuesta **tras**
    // el reintento, y por eso aquí sí manda la clasificación final.
    expect(gate?.failures).toBe(0);
  });

  it('reporta el desglose de no válidas sin descontarlas del denominador', () => {
    const conFallo = TODOS.map((o) =>
      o.caseId === 'refr-1' ? { ...o, classification: 'refusal' as const } : o,
    );
    const veredicto = scoreCandidate(CANDIDATO, entrada(conFallo));
    const gate = veredicto.gates.find((g) => g.gateId === 'structurally_usable_after_retry');
    expect(gate?.denominator).toBe(6);
    expect(gate?.failures).toBe(1);
    expect(gate?.nonValidBreakdown.refusal).toBe(1);
  });

  it('una pregunta fuera de corpus no declarada falla el gate al 100 %', () => {
    const veredicto = scoreCandidate(
      CANDIDATO,
      entrada(TODOS, { ...evidenciaLimpia(), outOfScopeDeclaredOrContained: () => false }),
    );
    const gate = veredicto.gates.find((g) => g.gateId === 'out_of_corpus_declared_or_contained');
    expect(gate?.passed).toBe(false);
    // No es bloqueante por sí solo: §6.2 sólo bloquea por fugas, invenciones y
    // recuperación degradada.
    expect(veredicto.blocked).toBe(false);
    expect(veredicto.passedAll).toBe(false);
  });
});

describe('el gate de recuperación exige que la caída ocurriera', () => {
  it('falla si lo observado no es el fallo declarado', () => {
    const otraCosa = TODOS.map((o) =>
      o.caseId === 'caida-1' ? { ...o, faultObservation: 'refusal' as const } : o,
    );
    const veredicto = scoreCandidate(CANDIDATO, entrada(otraCosa));
    const gate = veredicto.gates.find((g) => g.gateId === 'deterministic_degraded_recovery');
    expect(gate?.failures).toBe(1);
    expect(veredicto.blocked).toBe(true);
  });

  it('falla si la caída ocurrió y el sistema no recuperó', () => {
    const veredicto = scoreCandidate(
      CANDIDATO,
      entrada(TODOS, { ...evidenciaLimpia(), recoveredToDegraded: () => false }),
    );
    const gate = veredicto.gates.find((g) => g.gateId === 'deterministic_degraded_recovery');
    expect(gate?.failures).toBe(1);
    expect(veredicto.blocked).toBe(true);
  });
});

describe('un gate sin evidencia no se aprueba: se declara no computable', () => {
  it('sin sonda de segmentos factuales, lanza y nombra el corpus', () => {
    const completa = evidenciaLimpia();
    const sinAnclas = sinIndefinidos<GateEvidence>({ ...completa, factualSegments: undefined });
    expect(() => scoreCandidate(CANDIDATO, entrada(TODOS, sinAnclas))).toThrow(
      /marcadores|fragmentos/,
    );
  });

  it('sin sonda de recuperación, lanza y nombra el modo degradado', () => {
    const completa = evidenciaLimpia();
    const sinDegradado = sinIndefinidos<GateEvidence>({
      ...completa,
      recoveredToDegraded: undefined,
    });
    expect(() => scoreCandidate(CANDIDATO, entrada(TODOS, sinDegradado))).toThrow(
      /modo degradado/,
    );
  });

  it('el gate de anclas sobre cero segmentos no pasa por vacío', () => {
    expect(() =>
      scoreCandidate(
        CANDIDATO,
        entrada(TODOS, {
          ...evidenciaLimpia(),
          factualSegments: () => ({ total: 0, withResolvableAnchors: 0 }),
        }),
      ),
    ).toThrow(/no se hizo/);
  });
});

describe('controles negativos del cómputo', () => {
  it('un resultado que falta encoge el denominador y queda cazado', () => {
    // El fraude más fácil del benchmark: perder un caso y presentar la tasa
    // sobre los que sí contestaron.
    const faltaUno = TODOS.filter((o) => o.caseId !== 'adv-1');
    expect(() => scoreCandidate(CANDIDATO, entrada(faltaUno))).toThrow(GateError);
  });

  it('puntuar contra un conjunto distinto del que se corrió queda cazado', () => {
    const ajeno = [...TODOS, resultado('caso-de-otro-conjunto')];
    expect(() => scoreCandidate(CANDIDATO, entrada(ajeno))).toThrow(/no corresponden a ningún caso/);
  });

  it('no dictamina sobre un candidato sin resultados', () => {
    expect(() => scoreCandidate('gpt-5.6-luna', entrada(TODOS))).toThrow(ScoringError);
  });

  it('no dictamina sobre una corrida piloto', () => {
    const piloto: ScoringInput = {
      ...entrada(TODOS),
      runResult: { ...corrida(TODOS), purpose: 'pilot' },
    };
    expect(() => scoreCandidate(CANDIDATO, piloto)).toThrow(GateError);
  });
});

describe('scoreRun compara candidatos', () => {
  it('dictamina uno por candidato', () => {
    const otro = 'claude-opus-5';
    const dobles = [...TODOS, ...TODOS.map((o) => ({ ...o, candidateId: otro }))];
    const veredictos = scoreRun(entrada(dobles));
    expect(veredictos.map((v) => v.candidateId)).toEqual([CANDIDATO, otro]);
    expect(veredictos.every((v) => v.gates.length === GATE_SPECS.length)).toBe(true);
  });
});

describe('medir no es coronar: el paquete real se mide y no dictamina (D-70)', () => {
  const PAQUETE_REAL = loadContentPackage(
    join(dirname(fileURLToPath(import.meta.url)), '../../../content/unidad-deduccion-natural'),
  );

  it('observeGates computa los seis gates sobre material sin congelar', () => {
    // Ésta es la corrida parcial declarada de §3.5 del handoff: mide y compara,
    // no corona. La alternativa real no era esperar, era aproximar el gate con
    // un sustituto — y un gate medido contra un sucedáneo pasa diciendo algo
    // que nadie comprobó.
    const gates = observeGates(CANDIDATO, entrada(TODOS, evidenciaLimpia(), PAQUETE_REAL));
    expect(gates.length).toBe(GATE_SPECS.length);
    expect(gates.every((g) => g.passed)).toBe(true);
  });

  it('scoreCandidate se niega sobre ese mismo paquete', () => {
    // Y este es el punto: los mismos seis gates verdes **no** producen ganador.
    // P-III §6.2 mide sobre activos congelados y W5 no ha corrido.
    expect(PAQUETE_REAL.frozen).toBe(false);
    expect(() =>
      scoreCandidate(CANDIDATO, entrada(TODOS, evidenciaLimpia(), PAQUETE_REAL)),
    ).toThrow(CorpusLoadError);
  });
});
