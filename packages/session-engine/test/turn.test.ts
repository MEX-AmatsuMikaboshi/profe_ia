import { describe, expect, it } from 'vitest';

import {
  DeterministicPedagogyPolicy,
  PedagogyPolicyRunRegistry,
  createPedagogyPolicyDefinition,
  type PedagogyDecisionContext,
  type PedagogyPolicyDefinition,
} from '@profesor-ia/pedagogy-policy';
import type { AuthorizedCalculus, AuthorizedFragment } from '@profesor-ia/model-gateway';

import {
  runTeachingTurn,
  TEACHING_TURN_STEPS,
  W7_STEPS,
  type SessionTurnDependencies,
  type SessionTurnInput,
  type TurnModelRequest,
} from '../src/turn.js';

/**
 * Pruebas del orquestador de turno (T-H7-01).
 *
 * Lo que estas pruebas fijan, y que **antes no fijaba nada**, es el **orden de
 * las dos puertas**: la de no revelación corre antes de llamar al proveedor y
 * la de anclaje después. El resto de las piezas ya tenían sus pruebas; lo que
 * no existía era un llamador que las encadenara, así que tampoco existía nada
 * que se rompiera si alguien las encadenaba mal.
 *
 * Por eso casi todas las pruebas de bloqueo miran `llamadas.length === 0`: no
 * basta con que el turno devuelva «bloqueado», hace falta que **el proveedor no
 * se haya llamado**. Un turno que bloquea después de enviar la solución al
 * proveedor devolvería exactamente el mismo veredicto y habría fugado igual.
 */

const CALIBRATION_HASH = 'a'.repeat(64);

const CALCULO: AuthorizedCalculus = {
  version: 'authorized-calculus-v1',
  canonicalSymbols: ['¬', '∧', '∨', '→', '↔', '⊥'],
  connectiveAliases: ['->', '&', '|', '~', '!'],
  forbiddenRuleIds: ['MT', 'DS', 'DNE'],
};

const FRAGMENTO: AuthorizedFragment = {
  fragmentId: 'fr-kc04-001',
  blockId: 'bloque-kc04',
  text: 'De una conjunción puedes concluir cualquiera de sus dos miembros citando su línea.',
};

function testPolicy(): PedagogyPolicyDefinition {
  return createPedagogyPolicyDefinition({
    policyVersion: 'pedagogy-policy-turn-test-v1',
    purpose: 'test_fixture',
    wheelSpinningCalibration: {
      parameterId: 'CAL-10',
      registryAlias: 'CAL-WHEEL',
      status: 'test_fixture',
      calibrationVersion: 'cal-wheel-test-fixture-v1',
      artifactHash: CALIBRATION_HASH,
      threshold: { eligibleAttemptWindow: 3, minimumUnsuccessfulEligibleAttempts: 2 },
    },
  });
}

function boundEngine(): DeterministicPedagogyPolicy {
  const definition = testPolicy();
  const engine = new DeterministicPedagogyPolicy(definition, {
    registry: new PedagogyPolicyRunRegistry(),
  });
  engine.bindRun({
    runId: 'run-turn-1',
    purpose: definition.purpose,
    policyVersion: definition.policyVersion,
    policyHash: engine.compiled.policyHash,
  });
  return engine;
}

function decisionContext(
  overrides: Partial<PedagogyDecisionContext> = {},
): PedagogyDecisionContext {
  return {
    runId: 'run-turn-1',
    mode: 'LEARNING_MODE',
    kcId: 'KC04',
    kcType: 'procedural',
    currentStrategy: null,
    currentAssistanceLevel: 0,
    masteryEligibility: {
      authority: 'domain_engine',
      eligible: false,
      reasonCode: 'NOT_AN_ELIGIBLE_ATTEMPT',
    },
    patternPosition: { patternId: 'new_procedural_kc', stepId: 'brief_explanation' },
    observations: {
      securityBlocked: false,
      integrityBlocked: false,
      noRevelationRisk: false,
      blockingPrerequisite: false,
      masteryRecoveryRequired: false,
      partialDifficulty: false,
      repeatedSameError: false,
      helpDependence: false,
    },
    selfExplanationTrigger: null,
    retrieval: { requested: false },
    fading: { requested: false },
    wheelSpinning: { requested: false },
    ...overrides,
  };
}

/** Salida anclada bien formada, con el ancla resolviendo al fragmento. */
function salidaAnclada(anchors: readonly string[] = [FRAGMENTO.fragmentId]): unknown {
  return {
    operationId: 'op-1',
    authorizedBlockId: 'bloque-kc04',
    segments: [
      {
        text: 'De una conjunción se concluye cualquiera de sus miembros.',
        anchors: [...anchors],
        function: 'explanation',
      },
    ],
  };
}

interface Arnes {
  readonly deps: SessionTurnDependencies;
  /** Cada llamada al proveedor queda registrada. Vacío = no se llamó. */
  readonly llamadas: TurnModelRequest[];
}

function arnes(salida: unknown = salidaAnclada()): Arnes {
  const llamadas: TurnModelRequest[] = [];
  return {
    llamadas,
    deps: {
      policy: boundEngine(),
      retrieveFragments: () => [FRAGMENTO],
      model: async (request) => {
        llamadas.push(request);
        return salida;
      },
      calculus: CALCULO,
      canaryDetector: () => [],
    },
  };
}

function turnInput(overrides: Partial<SessionTurnInput> = {}): SessionTurnInput {
  return {
    decisionContext: decisionContext(),
    blockId: 'bloque-kc04',
    goal: 'Derivar A a partir de A∧B.',
    minimalState: { kcId: 'KC04' },
    minimalStateKeys: ['kcId'],
    structuredError: null,
    selectedHint: null,
    candidateHint: null,
    scorableActivity: null,
    operation: 'explain_block',
    instructions: 'Explica el bloque citando los fragmentos autorizados.',
    deliversFeedback: false,
    ...overrides,
  };
}

describe('runTeachingTurn — los nueve pasos de W7', () => {
  it('declara los nueve pasos de Plan.md §255 y cuáles ejecuta', () => {
    expect(W7_STEPS).toStrictEqual([
      'motor',
      'politica',
      'fragmentos',
      'modelo',
      'validador',
      'alumno',
      'verificador',
      'ajuste',
      'evidencia',
    ]);
    // El alcance declarado: `verificador` y `ajuste` no están, y no por olvido.
    // Viven en la ruta de veredicto y vuelven como `structuredError`.
    expect(TEACHING_TURN_STEPS).not.toContain('verificador');
    expect(TEACHING_TURN_STEPS).not.toContain('ajuste');
  });

  it('entrega una salida anclada y registra la traza del turno', async () => {
    const { deps, llamadas } = arnes();
    const result = await runTeachingTurn(deps, turnInput());

    expect(result.outcome).toBe('delivered');
    if (result.outcome !== 'delivered') return;
    expect(result.stoppedAt).toBe('alumno');
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.standing.kind).toBe('anchored');
    expect(result.canGroundEvaluation).toBe(true);
    expect(result.audit.fragmentIds).toStrictEqual([FRAGMENTO.fragmentId]);
    expect(result.audit.reachedStep).toBe('alumno');
    // El proveedor se llamó exactamente una vez, con el contexto ya filtrado.
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]?.context.blockId).toBe('bloque-kc04');
    expect(llamadas[0]?.context.fragments).toStrictEqual([FRAGMENTO.text]);
  });

  it('el contexto que viaja al proveedor lleva sólo los campos de la whitelist', async () => {
    const { deps, llamadas } = arnes();
    await runTeachingTurn(deps, turnInput());

    // P-II §8.3: ocho campos y **ningún identificador**. Que no haya `runId` ni
    // `kcId` sueltos es estructural, no una omisión de esta prueba.
    expect(Object.keys(llamadas[0]?.context ?? {}).sort()).toStrictEqual([
      'allowedHelpLevel',
      'blockId',
      'fragments',
      'goal',
      'hint',
      'minimalState',
      'mode',
      'strategy',
      'structuredError',
    ]);
  });
});

describe('runTeachingTurn — las puertas, y en qué orden corren', () => {
  it('§9.6 bloquea ANTES de llamar al proveedor', async () => {
    const { deps, llamadas } = arnes();
    // Actividad puntuable abierta + pista con contenido decisivo: P-I §9.6 lo
    // prohíbe expresamente («sin pistas que completen el paso decisivo»).
    const result = await runTeachingTurn(
      deps,
      turnInput({
        scorableActivity: { activityId: 'act-1', isProbe: false, attemptClosed: false },
        candidateHint: {
          hintId: 'h-1',
          level: 3,
          containsDecisiveContent: true,
          nonIsomorphismProven: false,
          isAnalogousExample: false,
        },
        deliversFeedback: true,
      }),
    );

    expect(result.outcome).toBe('blocked_by_non_revelation');
    if (result.outcome !== 'blocked_by_non_revelation') return;
    expect(result.findings.length).toBeGreaterThan(0);
    // **Lo que de verdad prueba esta prueba.** Sin esto, un orquestador que
    // llamara primero y comprobara después pasaría igual.
    expect(llamadas).toHaveLength(0);
  });

  it('el validador de anclaje rechaza DESPUÉS, con el proveedor ya llamado', async () => {
    // Ancla que no resuelve a ningún fragmento del bloque (I-7).
    const { deps, llamadas } = arnes(salidaAnclada(['fr-inexistente-999']));
    const result = await runTeachingTurn(deps, turnInput());

    expect(result.outcome).toBe('rejected_by_anchoring');
    if (result.outcome !== 'rejected_by_anchoring') return;
    expect(result.rejections.map((r) => r.reason)).toContain('anchor_inexistente');
    // Aquí sí se llamó: la salida no existe antes de la llamada. Es el
    // contrapunto de la prueba anterior y es lo que fija que las dos puertas
    // están en lados distintos del proveedor.
    expect(llamadas).toHaveLength(1);
  });

  it('una salida fuera de esquema se rechaza sin fingir que hubo respuesta', async () => {
    const { deps } = arnes({ no: 'es una salida anclada' });
    const result = await runTeachingTurn(deps, turnInput());

    expect(result.outcome).toBe('rejected_by_anchoring');
    if (result.outcome !== 'rejected_by_anchoring') return;
    expect(result.rejections[0]?.reason).toBe('fuera_de_esquema');
  });

  it('un segmento sin ancla cuya función es definition no se entrega', async () => {
    const { deps } = arnes({
      operationId: 'op-1',
      authorizedBlockId: 'bloque-kc04',
      segments: [
        // `transition` sin anclas es acompañamiento no factual: P-I §8.5 lo
        // admite. `accompaniment` no existe en `SegmentFunction` —el enum es
        // definition|explanation|example|transition— y usarlo daría
        // `fuera_de_esquema`, que es otra causa y probaría otra cosa.
        { text: 'Vamos a ver esto con calma.', anchors: [], function: 'transition' },
        { text: 'Una conjunción es una fórmula con ∧.', anchors: [], function: 'definition' },
      ],
    });
    const result = await runTeachingTurn(deps, turnInput());

    expect(result.outcome).toBe('delivered');
    if (result.outcome !== 'delivered') return;
    // El acompañamiento pasa; la definición sin ancla se retiene (P-I §8.5).
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.standing.kind).toBe('non_factual_accompaniment');
    // Y la salida entera deja de poder sostener una calificación.
    expect(result.canGroundEvaluation).toBe(false);
  });
});

describe('runTeachingTurn — la política manda antes que el gasto', () => {
  it('si la política suprime, no se recuperan fragmentos ni se llama al proveedor', async () => {
    const { deps, llamadas } = arnes();
    let recuperaciones = 0;
    const conCuenta: SessionTurnDependencies = {
      ...deps,
      retrieveFragments: (blockId) => {
        recuperaciones += 1;
        return deps.retrieveFragments(blockId);
      },
    };

    // `securityBlocked` es nivel 1 de la jerarquía: suprime el turno.
    const result = await runTeachingTurn(
      conCuenta,
      turnInput({
        decisionContext: decisionContext({
          observations: {
            ...decisionContext().observations,
            securityBlocked: true,
          },
        }),
      }),
    );

    expect(result.outcome).toBe('suppressed');
    if (result.outcome !== 'suppressed') return;
    expect(result.stoppedAt).toBe('politica');
    expect(llamadas).toHaveLength(0);
    // Ni siquiera se tocó el corpus: la supresión corta antes del paso 3.
    expect(recuperaciones).toBe(0);
    // Y el recibo del filtro de egreso NO afirma comprobaciones que no se
    // hicieron. Firmar `true` aquí sería firmar un control inexistente.
    expect(result.audit.egressFilter).toStrictEqual({
      canaryDetectorApplied: false,
      fragmentsCheckedAgainstBlock: false,
      helpLevelChecked: false,
    });
  });
});

describe('runTeachingTurn — el filtro de egreso no se puede esquivar', () => {
  it('un fragmento de otro bloque aborta el turno', async () => {
    const { deps } = arnes();
    const fugado: SessionTurnDependencies = {
      ...deps,
      retrieveFragments: () => [
        { fragmentId: 'fr-otro-001', blockId: 'bloque-kc09', text: 'De otro bloque.' },
      ],
    };

    // No devuelve un veredicto: lanza. Un fragmento de otro bloque en el
    // contexto es una violación de P-I §9.4, no un turno con menos material.
    await expect(runTeachingTurn(fugado, turnInput())).rejects.toThrow(/bloque/u);
  });

  it('una clave de estado no declarada aborta el turno', async () => {
    const { deps } = arnes();
    await expect(
      runTeachingTurn(
        deps,
        turnInput({ minimalState: { kcId: 'KC04', nombreDelAlumno: 'Gabriel' } }),
      ),
    ).rejects.toThrow(/nombreDelAlumno/u);
  });

  it('una pista por encima del nivel permitido aborta el turno', async () => {
    const { deps } = arnes();
    await expect(
      runTeachingTurn(
        deps,
        turnInput({
          selectedHint: { hintId: 'h-9', helpLevel: 5, text: 'La respuesta es A.' },
        }),
      ),
    ).rejects.toThrow(/nivel de ayuda/u);
  });
});

describe('runTeachingTurn — el bucle se cierra por dato', () => {
  it('el error clasificado del turno anterior llega al contexto del siguiente', async () => {
    const { deps, llamadas } = arnes();
    await runTeachingTurn(
      deps,
      turnInput({ structuredError: { code: 'E-RULE-CONJ-ELIM-BAD-CITE', stepNumber: 3 } }),
    );

    // Esta es la costura del paso 7 → paso 2 sin que `session-engine` toque la
    // ruta de verificación: el veredicto entra como dato estructurado.
    expect(llamadas[0]?.context.structuredError).toStrictEqual({
      code: 'E-RULE-CONJ-ELIM-BAD-CITE',
      stepNumber: 3,
    });
  });
});
