/**
 * Canal del turno de enseñanza del cliente (T-H7-01).
 *
 * El cliente **pide** el turno; no lo genera, no lo completa y no lo adivina.
 * Igual que con el veredicto (`verdict.ts`), lo autoritativo vive en el
 * servidor: aquí sólo se pinta lo que vuelve, con sus anclas.
 *
 * **Las anclas se muestran.** No es decoración: P-I §8.5 distingue lo anclado
 * del acompañamiento no factual, y esa distinción es justamente lo que el
 * alumno necesita ver para saber qué se apoya en el material del curso y qué
 * es el profesor hablando. Esconderla dejaría las dos cosas indistinguibles en
 * pantalla, que es el problema que el anclaje existe para resolver.
 */

export const TURN_ROUTE_PATH = '/clase/turno' as const;

/** Situación de un segmento, tal como la clasificó el validador de anclaje. */
export type TurnSegmentStanding = 'anchored' | 'non_factual_accompaniment' | 'withheld';

export interface TurnSegment {
  readonly text: string;
  readonly standing: string;
  readonly anchors: readonly string[];
}

export interface ProfessorTurn {
  readonly outcome: string;
  readonly stoppedAt: string;
  readonly segments: readonly TurnSegment[];
  /** P-I §8.5: una salida no anclada no puede fundamentar calificación. */
  readonly canGroundEvaluation: boolean;
  readonly policyRuleId: string;
  readonly packagePurpose: string;
}

export interface TurnFailure {
  readonly code: string;
  readonly detail: string;
}

/**
 * Estado del turno.
 *
 * `bloqueado` y `canal_fallido` son ramas distintas a propósito. Que la puerta
 * de no revelación pare un turno es el sistema **funcionando**; que el canal se
 * caiga es una avería. Colapsarlos haría que una garantía cumplida se leyera
 * como un error, y al revés.
 */
export type TurnState =
  | { readonly kind: 'inactivo' }
  | { readonly kind: 'preguntando'; readonly goal: string }
  | { readonly kind: 'turno'; readonly turn: ProfessorTurn }
  | { readonly kind: 'bloqueado'; readonly failure: TurnFailure }
  | { readonly kind: 'canal_fallido'; readonly failure: TurnFailure };

export interface TurnRequest {
  readonly blockId: string;
  readonly goal: string;
  readonly structuredError: { readonly code: string; readonly stepNumber: number | null } | null;
}

export interface TurnPort {
  requestTurn(request: TurnRequest): Promise<TurnState>;
}

export type FetchLike = (
  input: string,
  init: { readonly method: string; readonly headers: Record<string, string>; readonly body: string },
) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  readonly json: () => Promise<unknown>;
}>;

export function createHttpTurnPort(fetchImpl: FetchLike, baseUrl = ''): TurnPort {
  return {
    async requestTurn(request) {
      let response;
      try {
        response = await fetchImpl(`${baseUrl}${TURN_ROUTE_PATH}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(request),
        });
      } catch (err) {
        return {
          kind: 'canal_fallido',
          failure: { code: 'CANAL_INALCANZABLE', detail: String(err) },
        };
      }

      const body = (await response.json()) as Record<string, unknown>;

      if (response.ok) {
        return { kind: 'turno', turn: body as unknown as ProfessorTurn };
      }

      const failure: TurnFailure = {
        code: typeof body['code'] === 'string' ? body['code'] : `HTTP_${String(response.status)}`,
        detail: typeof body['detail'] === 'string' ? body['detail'] : '',
      };

      // 422 es el sistema decidiendo que ese turno no se entrega —política, no
      // revelación o anclaje—. 4xx/5xx restantes son avería del canal.
      return response.status === 422
        ? { kind: 'bloqueado', failure }
        : { kind: 'canal_fallido', failure };
    },
  };
}

/** Texto para cada situación, en español y sin depender del color (UIUX §3). */
export function standingLabel(standing: string): string {
  switch (standing) {
    case 'anchored':
      return 'anclado al material';
    case 'non_factual_accompaniment':
      return 'acompañamiento, sin anclar';
    case 'withheld':
      return 'retenido';
    default:
      return standing;
  }
}
