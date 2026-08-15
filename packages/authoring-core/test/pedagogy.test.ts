import { PedagogicalStrategy, STRATEGY_CATALOG_ES } from '@profesor-ia/contracts';
import { describe, expect, it } from 'vitest';
import {
  assertActivationMatrix,
  assertBasePatternsRepresentable,
  assertCatalogMatchesContracts,
  assertFadingPolicy,
  assertObservableObjectives,
  assertRetrievalPlan,
  assertSelfExplanationPolicy,
  BASE_PATTERNS,
  DECISION_HIERARCHY,
  PedagogyPolicyError,
  SELF_EXPLANATION_TRIGGERS,
  STRATEGY_CATALOG,
  toDecisionStrategy,
  type ActivationMatrix,
  type ActivationRule,
  type SelfExplanationPolicy,
  type StrategyCatalogEntryId,
} from '../src/index.js';

/** Una regla por cada entrada del catálogo: la matriz mínima que representa los cinco patrones. */
function matrizCompleta(overrides: Partial<ActivationMatrix> = {}): ActivationMatrix {
  return {
    policyVersion: 'pedagogy-policy-v1',
    rules: STRATEGY_CATALOG.map(
      (entrada): ActivationRule => ({
        ruleId: `r-${entrada.catalogEntryId}`,
        level: 4,
        catalogEntryId: entrada.catalogEntryId as StrategyCatalogEntryId,
        modes: ['LEARNING_MODE'],
        whenObservable: 'estado observable del KC objetivo',
      }),
    ),
    ...overrides,
  };
}

describe('catálogo de estrategias (T-H5-04 ← P-I §5.10)', () => {
  it('son doce, derivados del contrato para que no puedan divergir', () => {
    expect(STRATEGY_CATALOG).toHaveLength(12);
    expect(STRATEGY_CATALOG.map((e) => e.es)).toEqual([...STRATEGY_CATALOG_ES]);
    expect(() => assertCatalogMatchesContracts()).not.toThrow();
  });

  it('diez mapean al enum de decisión y dos no, que es la asimetría real del Maestro', () => {
    // §5.10 enumera doce acciones y §7.2.1 da —«por ejemplo»— un contrato con
    // diez. No se resuelve inventando dos miembros ni fingiendo que son diez.
    const conEnum = STRATEGY_CATALOG.filter((e) => e.decisionStrategy !== undefined);
    const sinEnum = STRATEGY_CATALOG.filter((e) => e.decisionStrategy === undefined);

    expect(conEnum).toHaveLength(10);
    expect(sinEnum.map((e) => e.catalogEntryId)).toEqual([
      'fading_contingente',
      'feedback_correctivo',
    ]);
    expect(PedagogicalStrategy.options).toHaveLength(10);
  });

  it('las dos sin enum dicen por dónde se expresan, en vez de dejar el hueco', () => {
    // Un hueco sin marcar se lee como olvido y alguien lo «arregla» inventando
    // el miembro de enum.
    for (const entrada of STRATEGY_CATALOG.filter((e) => e.decisionStrategy === undefined)) {
      expect(entrada.expressedBy).toBeTruthy();
    }
    expect(STRATEGY_CATALOG.find((e) => e.catalogEntryId === 'fading_contingente')?.expressedBy)
      .toContain('assistanceLevel');
  });

  it('un catálogo con un hueco sin marcar se rechaza', () => {
    // La guarda se comprueba inyectando el catálogo: con la comprobación atada
    // a la constante interna no había forma de dispararla desde fuera, y una
    // guarda que no puede fallar es peor que no tenerla.
    const conHueco = STRATEGY_CATALOG.map((entrada) =>
      entrada.catalogEntryId === 'fading_contingente'
        ? { catalogEntryId: entrada.catalogEntryId, es: entrada.es }
        : entrada,
    );

    expect(() => assertCatalogMatchesContracts(conHueco)).toThrow(PedagogyPolicyError);
    expect(() => assertCatalogMatchesContracts(conHueco)).toThrow(/por dónde se expresa/);
  });

  it('cada entrada con enum traduce a su miembro', () => {
    expect(toDecisionStrategy('explicacion_directa_breve')).toBe('direct_explanation');
    expect(toDecisionStrategy('comprobacion_de_transferencia_cercana')).toBe('near_transfer');
  });

  it('pedir el enum de `fading` falla cerrado y explica por dónde se expresa', () => {
    // Devolver `scaffolding` por parecido haría que la traza registrara que se
    // dio ayuda justo en el paso en que se estaba retirando.
    expect(() => toDecisionStrategy('fading_contingente')).toThrow(PedagogyPolicyError);
    expect(() => toDecisionStrategy('fading_contingente')).toThrow(/assistanceLevel/);
    expect(() => toDecisionStrategy('feedback_correctivo')).toThrow(PedagogyPolicyError);
  });

  it('una categoría fuera del catálogo no se traduce', () => {
    expect(() => toDecisionStrategy('explicacion_larguisima')).toThrow(PedagogyPolicyError);
  });

  it('la jerarquía de decisión es la literal y está en orden', () => {
    expect(DECISION_HIERARCHY).toHaveLength(5);
    expect(DECISION_HIERARCHY[0]).toContain('modo pedagógico');
    expect(DECISION_HIERARCHY[3]).toContain('selección de estrategia');
  });
});

describe('matriz de activación (§8.3.1, §5.9)', () => {
  it('acepta una matriz completa', () => {
    expect(() => assertActivationMatrix(matrizCompleta())).not.toThrow();
  });

  it('sin versión no se puede decir qué política gobernó una sesión', () => {
    expect(() => assertActivationMatrix(matrizCompleta({ policyVersion: '  ' }))).toThrow(
      PedagogyPolicyError,
    );
  });

  it('ninguna regla activa una estrategia en MEASUREMENT_MODE', () => {
    // §8.3.1 pone el modo por encima de la selección de estrategia: una regla de
    // nivel 4 que se activara midiendo invertiría la jerarquía, y se vería como
    // una ayuda oportuna justo donde la medición deja de valer.
    const midiendo = matrizCompleta({
      rules: [
        {
          ruleId: 'r-mala',
          level: 4,
          catalogEntryId: 'scaffolding_contingente',
          modes: ['LEARNING_MODE', 'MEASUREMENT_MODE'],
          whenObservable: 'el alumno duda',
        },
      ],
    });

    expect(() => assertActivationMatrix(midiendo)).toThrow(PedagogyPolicyError);
    expect(() => assertActivationMatrix(midiendo)).toThrow(/MEASUREMENT_MODE/);
  });

  it('«no consta» y «en cualquier modo» no son lo mismo', () => {
    const sinModo = matrizCompleta({
      rules: matrizCompleta().rules.map((r) => ({ ...r, modes: [] })),
    });

    expect(() => assertActivationMatrix(sinModo)).toThrow(PedagogyPolicyError);
  });

  it('una regla sin señal observable no cumple §5.10', () => {
    const sinSenal = matrizCompleta({
      rules: matrizCompleta().rules.map((r) => ({ ...r, whenObservable: '' })),
    });

    expect(() => assertActivationMatrix(sinSenal)).toThrow(PedagogyPolicyError);
  });

  it('una estrategia fuera del catálogo no se puede activar', () => {
    // La matriz va **completa** más la regla inventada: con una matriz de una
    // sola regla, esta prueba pasaba por el fallo de patrones representables y
    // no por el del catálogo, que es lo que dice comprobar.
    const inventada = matrizCompleta({
      rules: [
        ...matrizCompleta().rules,
        {
          ruleId: 'r-inventada',
          level: 4,
          catalogEntryId: 'gamificacion' as StrategyCatalogEntryId,
          modes: ['LEARNING_MODE'],
          whenObservable: 'el alumno se aburre',
        },
      ],
    });

    expect(() => assertActivationMatrix(inventada)).toThrow(PedagogyPolicyError);
    expect(() => assertActivationMatrix(inventada)).toThrow(/no está en el catálogo/);
  });
});

describe('los cinco patrones base deben ser representables (§8.3.2)', () => {
  it('son los cinco literales', () => {
    expect(BASE_PATTERNS.map((p) => p.patternId)).toEqual([
      'kc_procedimental_nuevo',
      'dificultad_parcial',
      'error_repetido_mismo_tipo',
      'fallo_de_prerrequisito',
      'dominio_aparente_o_dependencia_de_ayuda',
    ]);
  });

  it('los pasos que no son estrategias se registran como acción del motor', () => {
    // Inventarle una estrategia a «volver al KC objetivo» afirmaría una decisión
    // pedagógica donde solo hay una transición del motor.
    const prerrequisito = BASE_PATTERNS.find((p) => p.patternId === 'fallo_de_prerrequisito');
    const acciones = (prerrequisito?.steps ?? []).filter((s) => 'engineAction' in s);

    expect(acciones).toHaveLength(2);
    expect(prerrequisito?.steps.filter((s) => 'catalogEntryId' in s)).toHaveLength(1);
  });

  it('quitar una estrategia del catálogo de la matriz rompe su patrón', () => {
    // Sin regla que la active, la estrategia está en el catálogo y no ocurre
    // nunca: el patrón dejaría de ser representable sin que nada lo dijera.
    const sinTransferencia = matrizCompleta({
      rules: matrizCompleta().rules.filter(
        (r) => r.catalogEntryId !== 'comprobacion_de_transferencia_cercana',
      ),
    });

    expect(() => assertBasePatternsRepresentable(sinTransferencia)).toThrow(PedagogyPolicyError);
    expect(() => assertBasePatternsRepresentable(sinTransferencia)).toThrow(/kc_procedimental_nuevo/);
  });

  it('las dos entradas sin enum también tienen que ser activables', () => {
    // `fading` y `feedback` aparecen en los patrones 2 y 3: que no tengan
    // miembro de enum no las saca del catálogo.
    const sinFading = matrizCompleta({
      rules: matrizCompleta().rules.filter((r) => r.catalogEntryId !== 'fading_contingente'),
    });

    expect(() => assertBasePatternsRepresentable(sinFading)).toThrow(/fading_contingente/);
  });
});

describe('fading contingente (§8.3.2)', () => {
  it('el fading por reloj o por número de ejercicios exige preinscripción expresa', () => {
    // Sin ella, retirar ayuda por reloj mediría cuánto aguanta el alumno sin
    // ayuda, no cuánto ha aprendido.
    expect(() =>
      assertFadingPolicy([
        { ruleId: 'f1', triggeredByFixedTimeOrCount: true, contingentOnPerformance: false },
      ]),
    ).toThrow(PedagogyPolicyError);
  });

  it('con la evidencia que la norma exige, la excepción sí aplica', () => {
    // La excepción está en el Maestro: no se prohíbe, se exige su evidencia.
    expect(() =>
      assertFadingPolicy([
        {
          ruleId: 'f1',
          triggeredByFixedTimeOrCount: true,
          preinscriptionEvidence: 'preinscrito en el plan SCED v1, validado en H5',
          contingentOnPerformance: false,
        },
      ]),
    ).not.toThrow();
  });

  it('un fading contingente al desempeño no necesita nada más', () => {
    expect(() =>
      assertFadingPolicy([
        { ruleId: 'f2', triggeredByFixedTimeOrCount: false, contingentOnPerformance: true },
      ]),
    ).not.toThrow();
  });

  it('un fading que no depende de nada es automático, no contingente', () => {
    expect(() =>
      assertFadingPolicy([
        { ruleId: 'f3', triggeredByFixedTimeOrCount: false, contingentOnPerformance: false },
      ]),
    ).toThrow(PedagogyPolicyError);
  });
});

describe('autoexplicación selectiva (§8.3.3)', () => {
  const politica: SelfExplanationPolicy = {
    triggers: [...SELF_EXPLANATION_TRIGGERS],
    everyStep: false,
    anchoredToKc: true,
  };

  it('los tres disparadores son los literales', () => {
    expect(SELF_EXPLANATION_TRIGGERS).toEqual([
      'despues_de_paso_correcto_no_trivial',
      'tras_error_persistente',
      'para_distinguir_comprension_de_memorizacion',
    ]);
    expect(() => assertSelfExplanationPolicy(politica)).not.toThrow();
  });

  it('pedirla en cada paso la convierte en trámite', () => {
    expect(() => assertSelfExplanationPolicy({ ...politica, everyStep: true })).toThrow(
      PedagogyPolicyError,
    );
  });

  it('sin disparadores no se activaría nunca', () => {
    expect(() => assertSelfExplanationPolicy({ ...politica, triggers: [] })).toThrow(
      PedagogyPolicyError,
    );
  });

  it('sin anclaje al KC la respuesta no sirve para diagnóstico', () => {
    expect(() => assertSelfExplanationPolicy({ ...politica, anchoredToKc: false })).toThrow(
      PedagogyPolicyError,
    );
  });
});

describe('retrieval y spacing (§8.3.4)', () => {
  it('retrieval no sustituye a la primera enseñanza de un KC', () => {
    expect(() =>
      assertRetrievalPlan([
        { kcId: 'KC04', alreadyIntroduced: false, usesMeasurementReserve: false },
      ]),
    ).toThrow(PedagogyPolicyError);
  });

  it('la revisión espaciada no consume reserva de medición', () => {
    // Una enseña, la otra mide y permanece aislada: gastarla aquí consumiría el
    // material con el que después se mide la retención.
    expect(() =>
      assertRetrievalPlan([
        { kcId: 'KC04', alreadyIntroduced: true, usesMeasurementReserve: true },
      ]),
    ).toThrow(/reserva de medición/);
  });

  it('un plan correcto pasa', () => {
    expect(() =>
      assertRetrievalPlan([
        { kcId: 'KC04', alreadyIntroduced: true, usesMeasurementReserve: false },
        { kcId: 'KC05', alreadyIntroduced: true, usesMeasurementReserve: false },
      ]),
    ).not.toThrow();
  });
});

describe('objetivos observables por KC', () => {
  it('un objetivo sin evidencia observable es una intención', () => {
    expect(() =>
      assertObservableObjectives(
        [{ kcId: 'KC04', statement: 'Entender la conjunción.', observableEvidence: '' }],
        ['KC04'],
      ),
    ).toThrow(PedagogyPolicyError);
  });

  it('un KC sin objetivo no tiene criterio de cierre', () => {
    expect(() =>
      assertObservableObjectives(
        [
          {
            kcId: 'KC04',
            statement: 'Aplicar ∧I.',
            observableEvidence: 'construye φ∧ψ citando las dos líneas',
          },
        ],
        ['KC04', 'KC05'],
      ),
    ).toThrow(/KC05/);
  });

  it('sin KC requeridos la comprobación pasaría por vacío', () => {
    expect(() => assertObservableObjectives([], [])).toThrow(PedagogyPolicyError);
  });
});
