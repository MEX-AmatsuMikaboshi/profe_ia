import { describe, expect, it } from 'vitest';

import type { AuthorizedFragment } from '@profesor-ia/model-gateway';
import {
  DeterministicPedagogyPolicy,
  PedagogyPolicyRunRegistry,
  createPedagogyPolicyDefinition,
} from '@profesor-ia/pedagogy-policy';
import type { TurnModelPort } from '@profesor-ia/session-engine';

import {
  TURN_PACKAGE_PURPOSE,
  TURN_ROUTE_PATH,
  TurnRequestBody,
  handleTurnRequest,
  type TurnResponse,
  type TurnRuntime,
} from '../src/clase-turn-route.js';

/**
 * Estrecha la respuesta a su rama de fallo.
 *
 * Hace falta porque `TurnResponse` es una unión discriminada por `status`, y el
 * typecheck de los archivos de prueba —que este repositorio sí ejecuta (D-62)—
 * no deja leer `code` sin discriminar. Eso es lo correcto: sin la guarda, una
 * prueba que esperase un fallo pasaría igual si la ruta devolviera un 200.
 */
function failure(response: TurnResponse): { readonly code: string; readonly detail: string } {
  if (response.status === 200) {
    throw new Error(`se esperaba un fallo y llegó 200 con ${String(response.body.outcome)}`);
  }
  return response.body;
}

/**
 * Pruebas de la ruta del turno (T-H7-01).
 *
 * **Sin red y sin gasto.** El puerto del modelo se inyecta, que es justo para
 * lo que `TurnRuntime.modelFor` es una fábrica de puerto y no una pasarela.
 * Lo que se ejercita es todo lo demás: validación de la solicitud, el corte
 * previo cuando el bloque no tiene material, y que **cada salida no entregada
 * lleva su propio código** en vez de colapsar en uno genérico.
 */

const FRAGMENT: AuthorizedFragment = {
  fragmentId: 'forallx-yyc/tfl@abc123#conjuncion',
  blockId: 'KC06',
  text: 'De una conjunción puedes concluir cualquiera de sus dos miembros citando su línea.',
};

/**
 * Tracer mínimo. `withSpan` llama `startSpan` y luego `setAttributes`,
 * `recordException`, `setStatus` y `end` sobre lo que devuelva; la ruta no lee
 * nada del span, así que basta con que los cinco existan.
 */
const TRACER = {
  startSpan: () => ({
    setAttributes: () => undefined,
    recordException: () => undefined,
    setStatus: () => undefined,
    end: () => undefined,
  }),
} as unknown as TurnRuntime['tracer'];

function policy(): DeterministicPedagogyPolicy {
  const definition = createPedagogyPolicyDefinition({
    policyVersion: 'pedagogy-policy-clase-turno-dev-v1',
    purpose: TURN_PACKAGE_PURPOSE,
    wheelSpinningCalibration: {
      parameterId: 'CAL-10',
      registryAlias: 'CAL-WHEEL',
      status: TURN_PACKAGE_PURPOSE,
      calibrationVersion: 'cal-wheel-dev-v1',
      artifactHash: 'a'.repeat(64),
      threshold: { eligibleAttemptWindow: 3, minimumUnsuccessfulEligibleAttempts: 2 },
    },
  });
  const engine = new DeterministicPedagogyPolicy(definition, {
    registry: new PedagogyPolicyRunRegistry(),
  });
  engine.bindRun({
    runId: 'run-clase-dev-1',
    purpose: definition.purpose,
    policyVersion: definition.policyVersion,
    policyHash: engine.compiled.policyHash,
  });
  return engine;
}

function runtime(model: TurnModelPort, fragments: readonly AuthorizedFragment[] = [FRAGMENT]) {
  return {
    contentPackage: {
      authorizedFragmentsByBlock: new Map([['KC06', fragments]]),
    },
    policy: policy(),
    modelFor: () => model,
    tracer: TRACER,
  } as unknown as TurnRuntime;
}

/** Salida anclada por el **mango corto** del fragmento (D-77). */
function anchoredBy(handle: string): TurnModelPort {
  return async () => ({
    operationId: 'explain_block',
    authorizedBlockId: 'KC06',
    segments: [
      { text: 'De una conjunción se concluye cualquiera de sus miembros.', anchors: [handle], function: 'explanation' },
    ],
  });
}

describe('/clase/turno — la solicitud', () => {
  it('la ruta es la que el cliente espera', () => {
    expect(TURN_ROUTE_PATH).toBe('/clase/turno');
  });

  it('rechaza un blockId con forma no autorizada sin llamar al modelo', async () => {
    let llamadas = 0;
    const response = await handleTurnRequest(
      runtime(async () => {
        llamadas += 1;
        return {};
      }),
      { blockId: '../../etc', goal: 'hola' },
    );

    expect(response.status).toBe(400);
    expect(failure(response).code).toBe('SOLICITUD_INVALIDA');
    expect(llamadas).toBe(0);
  });

  it('rechaza campos de más: la solicitud es estricta', () => {
    const parsed = TurnRequestBody.safeParse({
      blockId: 'KC06',
      goal: 'hola',
      // Un campo no declarado no se ignora en silencio: ignorarlo escondería
      // que alguien intentó meter algo en el turno.
      nombreDelAlumno: 'Gabriel',
    });
    expect(parsed.success).toBe(false);
  });

  it('`structuredError` por omisión es null, no ausente', () => {
    const parsed = TurnRequestBody.parse({ blockId: 'KC06', goal: 'hola' });
    expect(parsed.structuredError).toBeNull();
  });
});

describe('/clase/turno — no se gasta sin material', () => {
  it('un bloque sin fragmentos corta ANTES de llamar al proveedor', async () => {
    let llamadas = 0;
    const response = await handleTurnRequest(
      runtime(async () => {
        llamadas += 1;
        return {};
      }, []),
      { blockId: 'KC06', goal: '¿qué es una conjunción?' },
    );

    expect(response.status).toBe(422);
    expect(failure(response).code).toBe('BLOQUE_SIN_FRAGMENTOS');
    // Un turno sin fragmentos sólo podría producir prosa sin anclar, que es lo
    // que I-7 impide entregar. Llamar al proveedor sería gastar para nada.
    expect(llamadas).toBe(0);
  });
});

describe('/clase/turno — la respuesta', () => {
  it('entrega los segmentos con su situación y sus anclas resueltas', async () => {
    // El modelo cita por mango corto; el validador lo resuelve al canónico.
    const { fragmentHandle } = await import('@profesor-ia/contracts');
    const response = await handleTurnRequest(
      runtime(anchoredBy(fragmentHandle(FRAGMENT.fragmentId))),
      { blockId: 'KC06', goal: '¿qué es una conjunción?' },
    );

    expect(response.status).toBe(200);
    if (response.status !== 200) return;
    expect(response.body.outcome).toBe('delivered');
    expect(response.body.segments).toHaveLength(1);
    expect(response.body.segments[0]?.standing).toBe('anchored');
    expect(response.body.segments[0]?.anchors).toHaveLength(1);
    expect(response.body.canGroundEvaluation).toBe(true);
    // UIUX §2: que el paquete no es material viaja en la respuesta, para que la
    // vista pueda declararlo. No depende de que el cliente lo recuerde.
    expect(response.body.packagePurpose).toBe('test_fixture');
  });

  it('un ancla inexistente vuelve como RECHAZADO_POR_ANCLAJE, no como 200 vacío', async () => {
    const response = await handleTurnRequest(runtime(anchoredBy('F-00000000')), {
      blockId: 'KC06',
      goal: '¿qué es una conjunción?',
    });

    expect(response.status).toBe(422);
    expect(failure(response).code).toBe('RECHAZADO_POR_ANCLAJE');
    expect(failure(response).detail).toContain('anchor_inexistente');
  });

  it('un fallo del proveedor vuelve 502 y no se disfraza de turno vacío', async () => {
    const response = await handleTurnRequest(
      runtime(async () => {
        throw new Error('el proveedor no contestó');
      }),
      { blockId: 'KC06', goal: '¿qué es una conjunción?' },
    );

    expect(response.status).toBe(502);
    expect(failure(response).code).toBe('TURNO_FALLIDO');
  });

  it('cada salida no entregada lleva su propio código', async () => {
    // El contrapunto de la prueba anterior: si todas devolvieran el mismo
    // código, quien lea la respuesta no podría distinguir una garantía actuando
    // de una avería, que es justo lo que la vista necesita separar.
    const anclaje = await handleTurnRequest(runtime(anchoredBy('F-00000000')), {
      blockId: 'KC06',
      goal: 'x',
    });
    const averia = await handleTurnRequest(
      runtime(async () => {
        throw new Error('caído');
      }),
      { blockId: 'KC06', goal: 'x' },
    );
    const sinMaterial = await handleTurnRequest(runtime(anchoredBy('F-0'), []), {
      blockId: 'KC06',
      goal: 'x',
    });

    expect(
      new Set([failure(anclaje).code, failure(averia).code, failure(sinMaterial).code]).size,
    ).toBe(3);
  });
});
