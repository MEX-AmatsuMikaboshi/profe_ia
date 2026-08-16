import {
  AUTHORIZED_CALCULUS_VERSION,
  VERIFIER_VERSION,
} from '@profesor-ia/logic-core';
import {
  BENCH04_HARNESS_VERSION,
  BENCH04_VARIANTS,
  BenchmarkPendingError,
  CertificateRejectedError,
  runBench04,
  search,
} from '@profesor-ia/proof-search';
import { describe, expect, it } from 'vitest';
import {
  assertCertificateReverified,
  assertMeasuredMatchesTargetComplexity,
  assertNoAuthoritativeSolution,
  AuthoritativeSolutionFromGeneratorError,
  CalibrationPendingError,
  canonicalStatement,
  findDuplicateAmong,
  PipelineOrderNotFrozenError,
  resolveValidityVariant,
  runW3Generation,
  W3_REJECTION_CODES,
  W3InputError,
  type CorpusExercise,
  type FrozenValidityOrder,
  type Hint,
  type ItemCandidate,
  type ItemCritique,
  type W3Input,
} from '../src/index.js';

const ORDEN_CONGELADO: FrozenValidityOrder = {
  benchmarkId: 'BENCH-04',
  variantId: 'prefilter_then_search',
  harnessVersion: BENCH04_HARNESS_VERSION,
  measuredOn: 'real_content_package',
  contentPackageVersion: 'unidad-deduccion-natural@2026-08-15',
  reportRunId: 'bench04-run-0001',
};

function candidato(overrides: Partial<ItemCandidate> = {}): ItemCandidate {
  return {
    candidateId: 'it-001',
    generatorTemplateId: 'tpl-modus-tollens',
    statement: { premises: ['A→B', '¬B'], goal: '¬A' },
    promptText: 'Demuestra la conclusión a partir de las premisas.',
    targetKcs: ['KC09'],
    bankFunction: 'guided_practice',
    targetComplexity: 'media',
    prohibitions: ['sin reglas derivadas fuera de DNE'],
    contradictionIsExplicitGoal: false,
    ...overrides,
  };
}

function critica(overrides: Partial<ItemCritique> = {}): ItemCritique {
  return {
    itemId: 'it-001',
    criticModelFamily: 'familia-E',
    generatorModelFamily: 'familia-C',
    justification: [
      { criterion: 'claridad', observation: 'enunciado inequívoco', evidence: 'it-001' },
    ],
    verdict: 'approve',
    ...overrides,
  };
}

function entrada(overrides: Partial<W3Input> = {}): W3Input {
  return {
    candidates: [candidato()],
    frozenOrder: ORDEN_CONGELADO,
    budget: { maxWorkUnits: 20_000 },
    mode: 'heuristic',
    corpusExercises: [],
    hintSets: [],
    critiques: [],
    ...overrides,
  };
}

describe('Rol C no entrega la solución (T-H5-05 ← P-II §5.2)', () => {
  it('rechaza cualquier clave con la que la solución podría colarse', () => {
    for (const clave of [
      'solution',
      'solutionLines',
      'proof',
      'derivation',
      'certificate',
      'answer',
      'lines',
      'steps',
    ]) {
      expect(() => assertNoAuthoritativeSolution({ ...candidato(), [clave]: 'x' }, 'it-001')).toThrow(
        AuthoritativeSolutionFromGeneratorError,
      );
    }
  });

  it('acepta la salida limpia y no se atraganta con un no-objeto', () => {
    expect(() => assertNoAuthoritativeSolution(candidato(), 'it-001')).not.toThrow();
    expect(() => assertNoAuthoritativeSolution('texto', 'it-001')).not.toThrow();
    expect(() => assertNoAuthoritativeSolution(null, 'it-001')).not.toThrow();
  });

  it('el pipeline aplica la guarda, no solo la exporta', () => {
    // El control existía y `runW3Generation` no lo llamaba: un candidato con
    // solución habría atravesado W3 entero. Se encontró releyendo el módulo.
    const conSolucion = { ...candidato(), proof: { lines: [] } } as unknown as ItemCandidate;
    expect(() => runW3Generation(entrada({ candidates: [conSolucion] }))).toThrow(
      AuthoritativeSolutionFromGeneratorError,
    );
  });
});

describe('coherencia de la entrada de W3', () => {
  it('dos candidatos con el mismo id detienen el pipeline', () => {
    // Sus dos certificados compartirían clave en solutions-private.
    expect(() =>
      runW3Generation(entrada({ candidates: [candidato(), candidato()] })),
    ).toThrow(W3InputError);
  });

  it('unas pistas o una crítica huérfanas no se descartan en silencio', () => {
    expect(() =>
      runW3Generation(
        entrada({ hintSets: [{ itemId: 'it-999', hints: [] }] }),
      ),
    ).toThrow(W3InputError);
    expect(() =>
      runW3Generation(entrada({ critiques: [critica({ itemId: 'it-999' })] })),
    ).toThrow(W3InputError);
  });
});

describe('el orden del pipeline no se cablea (P-I §7.4, BENCH-04)', () => {
  it('sin orden congelado no se ejecuta', () => {
    expect(() => resolveValidityVariant()).toThrow(PipelineOrderNotFrozenError);
    expect(() => resolveValidityVariant()).toThrow(/ley universal sin medición/u);
  });

  it('con solo un informe del arnés se cae por el punto de fallo de T-H2-16', () => {
    // `freezeWinningOrder()` vive en proof-search y apunta a esta tarea: se
    // ejercita en vez de esquivarlo.
    expect(() => resolveValidityVariant(undefined, runBench04())).toThrow(BenchmarkPendingError);
  });

  it('rechaza un orden congelado desde la muestra L0 del arnés', () => {
    expect(() =>
      resolveValidityVariant({ ...ORDEN_CONGELADO, measuredOn: 'l0_harness_sample' }),
    ).toThrow(/muestra L0/u);
  });

  it('rechaza el arnés de otra versión, otro benchmark y una variante inexistente', () => {
    expect(() =>
      resolveValidityVariant({ ...ORDEN_CONGELADO, harnessVersion: 'bench04-harness-v0' }),
    ).toThrow(PipelineOrderNotFrozenError);
    expect(() =>
      // @ts-expect-error el orden lo decide BENCH-04, no otro benchmark
      resolveValidityVariant({ ...ORDEN_CONGELADO, benchmarkId: 'BENCH-01' }),
    ).toThrow(PipelineOrderNotFrozenError);
    expect(() =>
      resolveValidityVariant({ ...ORDEN_CONGELADO, variantId: 'prefiltro-a-mano' }),
    ).toThrow(/no es una variante del arnés/u);
  });

  it('rechaza el orden sin procedencia: sin ella no está congelado, está elegido', () => {
    expect(() =>
      resolveValidityVariant({ ...ORDEN_CONGELADO, contentPackageVersion: '  ' }),
    ).toThrow(PipelineOrderNotFrozenError);
    expect(() => resolveValidityVariant({ ...ORDEN_CONGELADO, reportRunId: '' })).toThrow(
      PipelineOrderNotFrozenError,
    );
  });

  it('devuelve la variante **del arnés**, no una reimplementación del orden', () => {
    const variante = resolveValidityVariant(ORDEN_CONGELADO);
    expect(BENCH04_VARIANTS).toContain(variante);
  });

  it('W3 corre con la variante que se le congele, y las dos dan el mismo veredicto', () => {
    const conPrefiltro = runW3Generation(entrada());
    const conPostfiltro = runW3Generation(
      entrada({ frozenOrder: { ...ORDEN_CONGELADO, variantId: 'search_then_prefilter' } }),
    );
    expect(conPrefiltro.variantId).toBe('prefilter_then_search');
    expect(conPostfiltro.variantId).toBe('search_then_prefilter');
    expect(conPostfiltro.items[0]?.accepted).toBe(conPrefiltro.items[0]?.accepted);
  });
});

describe('W3: candidato que supera el pipeline', () => {
  it('queda aceptado con su estado de autoría y su perfil de complejidad', () => {
    const salida = runW3Generation(entrada());
    const item = salida.items[0];
    expect(item?.accepted).toBe(true);
    expect(item?.authoringState).toBe('proof_found');
    expect(item?.pipelineState).toBe('filtros_superados');
    expect(item?.complexity?.structural.usesIndirectStrategy).toBe(false);
    expect(item?.complexity?.structural.requiresAssumptionDischarge).toBe(true);
    expect(salida.authorizedCalculusVersion).toBe(AUTHORIZED_CALCULUS_VERSION);
  });

  it('la complejidad se mide pero **no se compara** con la objetivo: eso es CAL-09', () => {
    const salida = runW3Generation(entrada());
    const item = salida.items[0];
    expect(item?.targetComplexity).toBe('media');
    // Se declara siempre, aunque sea `false`: omitirlo se leería como que sí se
    // comparó.
    expect(item?.complexityComparisonAvailable).toBe(false);
    expect(() =>
      assertMeasuredMatchesTargetComplexity(item!.complexity!, item!.targetComplexity),
    ).toThrow(CalibrationPendingError);
    expect(() =>
      assertMeasuredMatchesTargetComplexity(item!.complexity!, item!.targetComplexity),
    ).toThrow(/CAL-09/u);
  });

  it('el certificado va a `privateSolutions` y **no cabe** en el registro del reactivo', () => {
    // Es la separación física llevada al tipo: `W3ItemRecord` no tiene campo
    // para la solución, así que serializar el registro entero hacia `items/` no
    // puede sacarla.
    const salida = runW3Generation(entrada());
    expect(JSON.stringify(salida.items)).not.toContain('⊥');
    expect(JSON.stringify(salida.privateSolutions)).toContain('⊥');
    expect(salida.privateSolutions[0]?.itemId).toBe('it-001');
    expect(salida.privateSolutions[0]?.verifierVersion).toBe(VERIFIER_VERSION);
    expect(salida.privateSolutions[0]?.minimalCostVerified).toBe(false);
  });
});

describe('estados de autoría (P-I §7.4)', () => {
  it('`no_proof_exists_in_calculus` no existe entre los códigos de rechazo (CALC-03)', () => {
    expect(W3_REJECTION_CODES).not.toContain('no_proof_exists_in_calculus');
  });

  it('el contramodelo del oráculo rechaza sin dejar solución privada', () => {
    const salida = runW3Generation(
      entrada({ candidates: [candidato({ statement: { premises: ['A'], goal: 'B' } })] }),
    );
    expect(salida.items[0]?.accepted).toBe(false);
    expect(salida.items[0]?.rejections.map((r) => r.code)).toContain('semantically_invalid');
    expect(salida.privateSolutions).toHaveLength(0);
  });

  it('agotar el presupuesto no afirma inexistencia, y el detalle lo dice', () => {
    const salida = runW3Generation(
      entrada({
        budget: { maxWorkUnits: 1 },
        candidates: [
          candidato({ statement: { premises: ['A→B', 'B→C', 'A'], goal: 'C' } }),
        ],
      }),
    );
    const rechazo = salida.items[0]?.rejections.find((r) => r.code === 'search_budget_exhausted');
    expect(rechazo).toBeDefined();
    expect(rechazo?.detail).toMatch(/No significa inexistencia/u);
    expect(salida.items[0]?.pipelineState).toBe('candidatos_generados');
  });
});

describe('filtros deterministas del verificador de reactivos (P-I §7.5)', () => {
  it('una meta trivial se rechaza antes de que la búsqueda la devuelva como prueba', () => {
    // `A∧B ⊢ A∧B` vuelve con `proof_found`: sin este filtro se mediría como
    // reactivo legítimo.
    const salida = runW3Generation(
      entrada({ candidates: [candidato({ statement: { premises: ['A∧B'], goal: 'A∧B' } })] }),
    );
    expect(salida.items[0]?.authoringState).toBe('proof_found');
    expect(salida.items[0]?.accepted).toBe(false);
    expect(salida.items[0]?.rejections.map((r) => r.code)).toContain('goal_trivial');
  });

  it('premisas contradictorias sin declararlo se rechazan; declarándolo, pasan', () => {
    const sinDeclarar = runW3Generation(
      entrada({ candidates: [candidato({ statement: { premises: ['A', '¬A'], goal: '⊥' } })] }),
    );
    expect(sinDeclarar.items[0]?.rejections.map((r) => r.code)).toContain('premises_unsatisfiable');

    const declarado = runW3Generation(
      entrada({
        candidates: [
          candidato({
            statement: { premises: ['A', '¬A'], goal: '⊥' },
            contradictionIsExplicitGoal: true,
          }),
        ],
      }),
    );
    expect(declarado.items[0]?.accepted).toBe(true);
  });

  it('rechaza la etiqueta KC fuera del catálogo y la ausencia de etiqueta', () => {
    const fuera = runW3Generation(
      // @ts-expect-error KC que no está en el catálogo de P-I §5.2
      entrada({ candidates: [candidato({ targetKcs: ['KC99'] })] }),
    );
    expect(fuera.items[0]?.rejections.map((r) => r.code)).toContain('kc_label_not_in_catalog');

    const sinEtiqueta = runW3Generation(entrada({ candidates: [candidato({ targetKcs: [] })] }));
    expect(sinEtiqueta.items[0]?.rejections.map((r) => r.code)).toContain('kc_labels_missing');
  });

  it('una fórmula que el cálculo no admite corta antes de buscar', () => {
    // `A∧B∧C` es `E-SYN-PRECEDENCE`: no hay precedencia entre binarios (D-8).
    const salida = runW3Generation(
      entrada({ candidates: [candidato({ statement: { premises: ['A∧B∧C'], goal: 'A' } })] }),
    );
    expect(salida.items[0]?.rejections.map((r) => r.code)).toContain(
      'syntax_not_in_authorized_calculus',
    );
    expect(salida.items[0]?.pipelineState).toBe('candidatos_generados');
    expect(salida.items[0]?.complexity).toBeUndefined();
  });

  it('un candidato que no llegó a la búsqueda **no tiene** estado de autoría', () => {
    // Rellenarlo con `search_budget_exhausted` afirmaría que el buscador gastó
    // su presupuesto en algo que nunca vio, y el pipeline lo «arreglaría»
    // subiendo el presupuesto.
    const salida = runW3Generation(
      entrada({ candidates: [candidato({ statement: { premises: ['A∧B∧C'], goal: 'A' } })] }),
    );
    expect(salida.items[0]?.authoringState).toBeUndefined();
    expect(JSON.stringify(salida.items[0])).not.toContain('search_budget_exhausted');
  });

  it('una función de banco que no es una reserva se rechaza', () => {
    const salida = runW3Generation(
      // @ts-expect-error función de banco fuera de las diez de P-I §7.7
      entrada({ candidates: [candidato({ bankFunction: 'calentamiento' })] }),
    );
    expect(salida.items[0]?.rejections.map((r) => r.code)).toContain('bank_function_not_a_reserve');
  });

  it('la solución no puede aparecer en la redacción del enunciado', () => {
    const salida = runW3Generation(
      entrada({
        candidates: [candidato({ promptText: 'Supón A, deriva ⊥ y descarga el supuesto.' })],
      }),
    );
    expect(salida.items[0]?.rejections.map((r) => r.code)).toContain('solution_leaked_in_statement');
  });

  it('el orden de comprobación es el requisito: se reportan todos y en su orden', () => {
    // Trivial **y** con premisas contradictorias. Reordenar no cambiaría cuántos
    // rechazos hay: cambiaría cuál se reporta primero, y con él lo que el
    // pipeline intentaría arreglar.
    const salida = runW3Generation(
      entrada({ candidates: [candidato({ statement: { premises: ['A', '¬A'], goal: 'A' } })] }),
    );
    expect(salida.items[0]?.rejections.map((r) => r.code)).toEqual([
      'goal_trivial',
      'premises_unsatisfiable',
    ]);
  });
});

describe('duplicados e isomorfismos (paso 6 de W3)', () => {
  const pruebaDe = (premises: readonly string[], goal: string) => {
    const r = search(
      { premises: [...premises], goal, mode: 'heuristic', budget: { maxWorkUnits: 20_000 } },
      { semanticOracle: 'prefilter' },
    );
    if (r.status !== 'proof_found') throw new Error('fixture inválido');
    return { lines: r.proof.lines, goal };
  };

  it('el duplicado trivial se reporta como tal, que es el caso más estricto', () => {
    const previo = {
      candidateId: 'it-001',
      statement: canonicalStatement({ premises: ['A', 'B'], goal: 'A∧B' }),
      proof: pruebaDe(['A', 'B'], 'A∧B'),
    };
    const colision = findDuplicateAmong(
      pruebaDe(['P', 'Q'], 'P∧Q'),
      canonicalStatement({ premises: ['P', 'Q'], goal: 'P∧Q' }),
      [previo],
    );
    expect(colision?.code).toBe('trivial_duplicate_of_candidate');
  });

  it('el isomorfo con los pasos independientes en otro orden se reporta aparte', () => {
    // Mismas líneas, citas en otro orden: la forma canónica difiere —el orden de
    // citas está en ella— y la firma estructural coincide, porque se construye
    // sobre el grafo de dependencias.
    const base = {
      lines: [
        { formula: 'A', rule: 'PR', depth: 0 },
        { formula: 'B', rule: 'PR', depth: 0 },
        { formula: 'A∧B', rule: '∧I', refs: [1, 2], depth: 0 },
      ],
      goal: 'A∧B',
    };
    const citasAlReves = {
      lines: [
        { formula: 'A', rule: 'PR', depth: 0 },
        { formula: 'B', rule: 'PR', depth: 0 },
        { formula: 'A∧B', rule: '∧I', refs: [2, 1], depth: 0 },
      ],
      goal: 'A∧B',
    };
    const colision = findDuplicateAmong(citasAlReves, 'otro-enunciado', [
      { candidateId: 'it-001', statement: 'enunciado-previo', proof: base },
    ]);
    expect(colision?.code).toBe('isomorphic_to_candidate');
  });

  it('sin colisión devuelve `null`', () => {
    expect(
      findDuplicateAmong(pruebaDe(['A', 'B'], 'A∧B'), 'x', [
        { candidateId: 'it-000', statement: 'y', proof: pruebaDe(['A→B', '¬B'], '¬A') },
      ]),
    ).toBeNull();
  });

  it('en el pipeline se queda el primero, y cuál sobrevive es reproducible', () => {
    const salida = runW3Generation(
      entrada({
        candidates: [
          candidato({ candidateId: 'it-001', statement: { premises: ['A', 'B'], goal: 'A∧B' } }),
          candidato({ candidateId: 'it-002', statement: { premises: ['P', 'Q'], goal: 'P∧Q' } }),
        ],
      }),
    );
    expect(salida.items[0]?.accepted).toBe(true);
    expect(salida.items[1]?.accepted).toBe(false);
    expect(salida.items[1]?.rejections[0]?.code).toBe('trivial_duplicate_of_candidate');
    expect(salida.privateSolutions).toHaveLength(1);
  });

  it('un candidato que repite un ejercicio del corpus fuente se rechaza', () => {
    const ejercicio: CorpusExercise = {
      exerciseId: 'ej-4.2',
      fragmentId: 'openlogic@v1#cap4',
      statement: { premises: ['P→Q', '¬Q'], goal: '¬P' },
    };
    const salida = runW3Generation(entrada({ corpusExercises: [ejercicio] }));
    expect(salida.items[0]?.rejections.map((r) => r.code)).toContain('duplicate_of_corpus_exercise');
  });
});

describe('pistas y crítica dentro del pipeline (pasos 7 y 8)', () => {
  const pistaFiltrada: Hint = {
    level: 3,
    text: 'Supón A y llega a ⊥.',
    anchors: ['frag-001'],
    proposedMasteryDisqualifying: true,
  };

  it('una pista que filtra un paso oculto tumba al reactivo', () => {
    const salida = runW3Generation(
      entrada({ hintSets: [{ itemId: 'it-001', hints: [pistaFiltrada] }] }),
    );
    expect(salida.items[0]?.accepted).toBe(false);
    expect(salida.items[0]?.rejections.map((r) => r.code)).toContain('hint_policy_violation');
  });

  it('sin pistas el reactivo pasa, y el registro dice que no las trae', () => {
    // Cuántas pistas hace falta por KC lo fija T-H5-08 con sus parámetros de
    // cobertura; decidirlo aquí sería inventar el reparto.
    const salida = runW3Generation(entrada());
    expect(salida.items[0]?.hintsProvided).toBe(false);
    expect(salida.items[0]?.accepted).toBe(true);
  });

  it('el veredicto del crítico no mueve la aceptación en ninguna dirección', () => {
    // «Su veredicto no certifica»: ni un `approve` salva ni un `reject` tumba.
    const aprobado = runW3Generation(entrada({ critiques: [critica({ verdict: 'approve' })] }));
    const rechazado = runW3Generation(entrada({ critiques: [critica({ verdict: 'reject' })] }));
    expect(aprobado.items[0]?.accepted).toBe(true);
    expect(rechazado.items[0]?.accepted).toBe(true);
  });

  it('un `approve` no salva a un candidato que los validadores deterministas rechazan', () => {
    const salida = runW3Generation(
      entrada({
        candidates: [candidato({ statement: { premises: ['A'], goal: 'B' } })],
        critiques: [critica({ verdict: 'approve' })],
      }),
    );
    expect(salida.items[0]?.accepted).toBe(false);
  });

  it('los criterios con hallazgo llegan al registro como señal, no como veredicto', () => {
    const salida = runW3Generation(
      entrada({
        critiques: [
          critica({
            justification: [
              { criterion: 'fuga', observation: 'revisar el enunciado', evidence: 'it-001' },
            ],
          }),
        ],
      }),
    );
    expect(salida.items[0]?.criticRiskFlags).toEqual(['fuga']);
    expect(salida.items[0]?.criticised).toBe(true);
    expect(salida.items[0]?.accepted).toBe(true);
  });

  it('una crítica mal formada detiene el pipeline en vez de contarse como hecha', () => {
    expect(() =>
      runW3Generation(entrada({ critiques: [critica({ justification: [] })] })),
    ).toThrow(/justificación estructurada/u);
  });
});

describe('re-verificación del certificado (paso 4)', () => {
  it('un certificado que logic-core rechaza es incidente, no «no encontré»', () => {
    expect(() =>
      assertCertificateReverified(
        {
          lines: [
            { formula: 'A→B', rule: 'PR', depth: 0 },
            { formula: '¬A', rule: '→E', refs: [1], depth: 0 },
          ],
          cost: 2,
          rulesUsed: ['→E'],
        },
        '¬A',
      ),
    ).toThrow(CertificateRejectedError);
  });

  it('acepta el certificado que sí verifica', () => {
    const r = search(
      { premises: ['A', 'B'], goal: 'A∧B', mode: 'heuristic', budget: { maxWorkUnits: 20_000 } },
      { semanticOracle: 'prefilter' },
    );
    if (r.status !== 'proof_found') throw new Error('fixture inválido');
    expect(() => assertCertificateReverified(r.proof, 'A∧B')).not.toThrow();
  });
});
