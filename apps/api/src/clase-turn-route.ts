import { z } from 'zod';
import { withSpan, type Tracer } from '@profesor-ia/observability';
import { buildFragmentHandleTable, fragmentHandle } from '@profesor-ia/contracts';
import { loadContentPackage, type ContentPackage } from '@profesor-ia/content-schema';
import {
  ModelGateway,
  anthropicAdapter,
  envCredentialResolver,
  httpTransport,
} from '@profesor-ia/model-gateway';
import {
  DeterministicPedagogyPolicy,
  PedagogyPolicyRunRegistry,
  createPedagogyPolicyDefinition,
} from '@profesor-ia/pedagogy-policy';
import {
  SESSION_AUTHORIZED_CALCULUS,
  TEACHING_TURN_INSTRUCTIONS,
  gatewayTurnPort,
  runTeachingTurn,
  type SessionTurnResult,
  type TurnModelPort,
} from '@profesor-ia/session-engine';

/**
 * Ruta del turno de enseñanza de Clase (T-H7-01).
 *
 * Es la segunda ruta que `apps/api` implementa. La primera —`/clase/verificacion`
 * (T-H6-13)— lleva la derivación al verificador aislado; ésta ejecuta el bucle
 * W7 y devuelve lo que el Profesor IA puede decirle al alumno.
 *
 * Las dos juntas cierran el ciclo: el veredicto de la primera vuelve como
 * `structuredError` de la segunda, y así el profesor reacciona al error **que el
 * verificador clasificó**, no a su propia lectura de la derivación. Ésa es la
 * costura de los pasos 7→8→2 de W7, y es de dato, no de llamada: esta ruta no
 * toca la ruta de verificación (I-3).
 *
 * ## Lo que esta ruta NO hace, declarado
 *
 * **No monta sesión persistida ni escribe evidencia en base.** El paso 9 de W7
 * emite hoy su traza en el `TurnAuditTrail` que el orquestador devuelve y en el
 * span, no en `evidence`. `EVIDENCE_EVENT_INSERT_SQL` sigue sin llamador en
 * ejecución, y fingir aquí un `EvidenceLedger` a medias sería peor que no
 * tenerlo: dejaría una cadena de hashes incompleta que parece completa.
 *
 * **No elige bloque.** El bloque llega en la petición. La elección de bloque y
 * la derivación `objectiveId → goal` son el hueco 4 de W7 y siguen abiertos.
 */

export const TURN_ROUTE_PATH = '/clase/turno' as const;

/** Modo de paquete. `test_fixture` mientras W5 no haya corrido, y se declara. */
export const TURN_PACKAGE_PURPOSE = 'test_fixture' as const;

export const TurnRequestBody = z
  .object({
    /** El bloque es el KC (P-I §9.4, §5.2). */
    blockId: z
      .string()
      .trim()
      .regex(/^KC\d{2}$/u, 'blockId con forma no autorizada'),
    /** Lo que el alumno pregunta o el objetivo del turno. */
    goal: z.string().trim().min(1).max(2_000),
    /**
     * El error ya clasificado por el verificador en el turno anterior. **Nunca
     * texto libre**: si lo fuera, el profesor reaccionaría a prosa en vez de a
     * un veredicto.
     */
    structuredError: z
      .object({
        code: z.string().trim().min(1).max(64),
        stepNumber: z.number().int().positive().nullable(),
      })
      .strict()
      .nullable()
      .default(null),
  })
  .strict();

export type TurnRequestBody = z.infer<typeof TurnRequestBody>;

export interface TurnSegmentDto {
  readonly text: string;
  /** `anchored` con sus anclas resueltas, o el tipo de acompañamiento. */
  readonly standing: string;
  readonly anchors: readonly string[];
}

export type TurnResponse =
  | {
      readonly status: 200;
      readonly body: {
        readonly outcome: SessionTurnResult['outcome'];
        readonly stoppedAt: string;
        readonly segments: readonly TurnSegmentDto[];
        readonly canGroundEvaluation: boolean;
        readonly policyRuleId: string;
        /** Que el paquete no es material se dice en la respuesta (UIUX §2). */
        readonly packagePurpose: typeof TURN_PACKAGE_PURPOSE;
      };
    }
  | {
      readonly status: 400 | 422 | 502;
      readonly body: {
        readonly code: string;
        readonly detail: string;
        readonly outcome?: SessionTurnResult['outcome'];
      };
    };

export interface TurnRuntime {
  readonly contentPackage: ContentPackage;
  readonly policy: DeterministicPedagogyPolicy;
  /**
   * Fábrica del puerto del modelo, no la pasarela.
   *
   * Es fábrica y no puerto ya construido porque los mangos de fragmento
   * dependen del bloque, y el bloque llega en la petición. Y es **puerto** y no
   * `ModelGateway` para que esta ruta se pueda probar sin red: una prueba
   * inyecta un puerto que devuelve una salida fija y ejercita todo lo demás
   * —política, filtro de egreso, §9.6, anclaje y los códigos de respuesta— sin
   * gastar un peso ni depender de que un proveedor conteste.
   */
  readonly modelFor: (handles: ReadonlyMap<string, string>) => TurnModelPort;
  readonly tracer: Tracer;
}

export interface BuildTurnRuntimeOptions {
  readonly contentRoot: string;
  readonly modelId: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly tracer: Tracer;
  readonly timeoutMs?: number;
  readonly maxOutputTokens?: number;
}

/**
 * Compone el runtime del turno **una vez, al arrancar**.
 *
 * Cargar el corpus y compilar la política por petición volvería a leer y
 * hashear el paquete entero en cada turno; y sobre todo, un fallo de
 * composición debe impedir arrancar, no aparecer a mitad de una clase.
 */
export function buildTurnRuntime(options: BuildTurnRuntimeOptions): TurnRuntime {
  const contentPackage = loadContentPackage(options.contentRoot);

  // `test_fixture` y no `material`: una política material exige el hash del
  // paquete congelado, y W5 no ha corrido — `contentPackage.frozen` es `false`.
  // Declararlo es lo que impide que un dato de desarrollo se cite como evidencia.
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
  const policy = new DeterministicPedagogyPolicy(definition, {
    registry: new PedagogyPolicyRunRegistry(),
  });
  policy.bindRun({
    runId: RUN_ID,
    purpose: definition.purpose,
    policyVersion: definition.policyVersion,
    policyHash: policy.compiled.policyHash,
  });

  const gateway = new ModelGateway({
    profile: 'SESION',
    registrations: [
      {
        binding: {
          bindingId: `binding-sesion-${options.modelId}`,
          profile: 'SESION',
          provider: 'anthropic',
          modelId: options.modelId,
          endpoint: 'https://api.anthropic.com/v1/messages',
          // El id sin fecha **es** el snapshot fijado en la familia Claude 4.6+,
          // según la documentación citada en el refresco del 2026-08-23. Sin
          // esto la pasarela falla cerrado, que es lo correcto.
          snapshot: options.modelId,
          capabilities: {
            // Sólo `max_tokens`: el refresco documental del 2026-08-23 declara
            // el resto como rechazados, y la pasarela no envía parámetros que
            // el binding no declare.
            supportedParameters: ['max_tokens'],
            rejectedParameters: [],
            structuredOutput: { supported: true },
            reasoning: { supported: false },
            // Batch y caching son capacidades **explícitas** (P-II §8.4): un
            // binding declara si las tiene, y no declararlas no puede quedar a
            // medio camino entre «no» y «no se preguntó».
            batch: { supported: false },
            caching: { supported: false },
            dataPolicy: { contractualEligibility: 'unknown' },
          },
          verifiedAt: new Date().toISOString(),
        },
        operations: ['explain_block', 'rephrase_explanation', 'classify_student_error'],
      },
    ],
    credentialResolver: envCredentialResolver('anthropic', options.env),
    adapters: [anthropicAdapter],
    transport: httpTransport({ timeoutMs: options.timeoutMs ?? 60_000 }),
  });

  const maxOutputTokens = options.maxOutputTokens ?? 3_000;

  return {
    contentPackage,
    policy,
    modelFor: (fragmentHandles) =>
      gatewayTurnPort({ gateway, fragmentHandles, maxOutputTokens }),
    tracer: options.tracer,
  };
}

const RUN_ID = 'run-clase-dev-1' as const;

export async function handleTurnRequest(
  runtime: TurnRuntime,
  raw: unknown,
): Promise<TurnResponse> {
  const parsed = TurnRequestBody.safeParse(raw);
  if (!parsed.success) {
    return {
      status: 400,
      body: { code: 'SOLICITUD_INVALIDA', detail: z.prettifyError(parsed.error) },
    };
  }
  const body = parsed.data;

  const fragments = runtime.contentPackage.authorizedFragmentsByBlock.get(body.blockId) ?? [];
  if (fragments.length === 0) {
    // No se llama al proveedor sin material: un turno sin fragmentos sólo puede
    // producir prosa sin anclar, que es justo lo que I-7 impide entregar.
    return {
      status: 422,
      body: {
        code: 'BLOQUE_SIN_FRAGMENTOS',
        detail: `el bloque ${body.blockId} no tiene fragmentos autorizados con texto extraído`,
      },
    };
  }

  // Falla cerrado si dos fragmentos del bloque comparten mango, antes de gastar.
  buildFragmentHandleTable(fragments.map((f) => f.fragmentId));
  const handles = new Map(fragments.map((f, i) => [String(i), fragmentHandle(f.fragmentId)]));

  return withSpan(
    runtime.tracer,
    'clase.turno',
    { 'http.route': TURN_ROUTE_PATH },
    async (span): Promise<TurnResponse> => {
      let result: SessionTurnResult;
      try {
        result = await runTeachingTurn(
          {
            policy: runtime.policy,
            retrieveFragments: () => fragments,
            model: runtime.modelFor(handles),
            calculus: SESSION_AUTHORIZED_CALCULUS,
            canaryDetector: () => [],
          },
          {
            decisionContext: {
              runId: RUN_ID,
              mode: 'LEARNING_MODE',
              kcId: body.blockId,
              kcType: 'procedural',
              currentStrategy: null,
              currentAssistanceLevel: 0,
              masteryEligibility: {
                authority: 'domain_engine',
                eligible: false,
                reasonCode: 'NOT_AN_ELIGIBLE_ATTEMPT',
              },
              patternPosition: {
                patternId: 'new_procedural_kc',
                stepId: 'brief_explanation',
              },
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
            },
            blockId: body.blockId,
            goal: body.goal,
            minimalState: { kcId: body.blockId },
            minimalStateKeys: ['kcId'],
            structuredError: body.structuredError,
            selectedHint: null,
            candidateHint: null,
            scorableActivity: null,
            operation: 'explain_block',
            instructions: TEACHING_TURN_INSTRUCTIONS,
            deliversFeedback: false,
          },
        );
      } catch (err) {
        // Un fallo del proveedor o del filtro de egreso **no se disfraza** de
        // turno vacío. El alumno ve que algo falló, no un profesor mudo.
        span.setAttributes({ 'http.status_code': 502 });
        return {
          status: 502,
          body: { code: 'TURNO_FALLIDO', detail: String(err) },
        };
      }

      // Los atributos son del resultado, no del contenido: la derivación del
      // alumno y la prosa del profesor se quedan fuera del span (P-II §9.3).
      span.setAttributes({
        'http.status_code': result.outcome === 'delivered' ? 200 : 422,
        'turn.outcome': result.outcome,
        'turn.policy_rule_id': result.audit.policyRuleId,
      });

      if (result.outcome !== 'delivered') {
        return {
          status: 422,
          body: {
            code: codeFor(result),
            detail: detailFor(result),
            outcome: result.outcome,
          },
        };
      }

      return {
        status: 200,
        body: {
          outcome: result.outcome,
          stoppedAt: result.stoppedAt,
          segments: result.segments.map((s) => ({
            text: s.text,
            standing: s.standing.kind,
            anchors: s.standing.kind === 'anchored' ? s.standing.resolvedAnchors : [],
          })),
          canGroundEvaluation: result.canGroundEvaluation,
          policyRuleId: result.audit.policyRuleId,
          packagePurpose: TURN_PACKAGE_PURPOSE,
        },
      };
    },
  );
}

/** Cada salida no entregada tiene su código. No se colapsan en uno genérico. */
function codeFor(result: Exclude<SessionTurnResult, { outcome: 'delivered' }>): string {
  switch (result.outcome) {
    case 'suppressed':
      return 'TURNO_SUPRIMIDO_POR_POLITICA';
    case 'blocked_by_non_revelation':
      return 'BLOQUEADO_POR_NO_REVELACION';
    case 'rejected_by_anchoring':
      return 'RECHAZADO_POR_ANCLAJE';
  }
}

function detailFor(result: Exclude<SessionTurnResult, { outcome: 'delivered' }>): string {
  switch (result.outcome) {
    case 'suppressed':
      return `la política suprimió el turno con la regla ${result.audit.policyRuleId}`;
    case 'blocked_by_non_revelation':
      return result.findings.map((f) => f.authority).join('; ');
    case 'rejected_by_anchoring':
      return result.rejections.map((r) => `${r.reason}: ${r.detail}`).join('; ');
  }
}
