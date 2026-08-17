import type { VerificationResult } from '@profesor-ia/contracts';
import type { ProofInput } from '@profesor-ia/logic-core/syntax';

/**
 * Canal de veredicto del cliente (T-H6-13 ← P-I §8.9: «veredicto autoritativo
 * en servidor»).
 *
 * El cliente **pide** el veredicto; no lo calcula, no lo estima y no lo
 * adelanta. La revisión local (`local-review.ts`) dice si lo escrito se puede
 * leer; esto es lo único que dice si la derivación es válida, y viene de
 * `apps/verifier`, que corre sin red y se habla por spool (D-12).
 */

export const VERDICT_ROUTE_PATH = '/clase/verificacion' as const;

export interface ServerVerdict {
  readonly submissionId: string;
  readonly verification: VerificationResult;
  /** Contrapunto explícito de `LocalReview.authoritative === false`. */
  readonly authoritative: true;
  readonly decidedBy: 'verifier';
}

export type VerdictChannelFailure = {
  readonly code: string;
  readonly detail: string;
};

/**
 * Estado del envío.
 *
 * `canal_fallido` **no es** un veredicto y por eso es una rama distinta y no un
 * `ServerVerdict` con `valid: false`. Que el verificador no contestara no
 * significa que el alumno se equivocara, y registrarlo así le atribuiría un
 * error que nadie observó.
 */
export type SubmissionState =
  | { readonly kind: 'inactivo' }
  | { readonly kind: 'enviando'; readonly submissionId: string }
  | { readonly kind: 'veredicto'; readonly verdict: ServerVerdict }
  | { readonly kind: 'canal_fallido'; readonly failure: VerdictChannelFailure };

export interface VerdictPort {
  requestVerdict(submissionId: string, proof: ProofInput): Promise<ServerVerdict>;
}

export class VerdictChannelError extends Error {
  constructor(
    readonly code: string,
    detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = 'VerdictChannelError';
  }
}

/** `fetch` inyectado: la prueba no depende de la red ni de un servidor. */
export type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export function createHttpVerdictPort(fetchImpl: FetchLike, baseUrl = ''): VerdictPort {
  return {
    async requestVerdict(submissionId, proof) {
      const response = await fetchImpl(`${baseUrl}${VERDICT_ROUTE_PATH}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ submissionId, proof }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { code?: unknown; detail?: unknown; verification?: unknown; decidedBy?: unknown }
        | null;

      if (!response.ok) {
        throw new VerdictChannelError(
          typeof payload?.code === 'string' ? payload.code : `HTTP_${response.status}`,
          typeof payload?.detail === 'string' ? payload.detail : `respuesta ${response.status}`,
        );
      }

      if (payload === null || payload.decidedBy !== 'verifier') {
        // Una respuesta 200 que no declara quién decidió no se acepta como
        // veredicto: sin `decidedBy` no se puede afirmar que salió del
        // verificador, y esa afirmación es la que hace autoritativo el dato.
        throw new VerdictChannelError(
          'VEREDICTO_SIN_AUTORIDAD',
          'la respuesta no declara `decidedBy: "verifier"`',
        );
      }

      return {
        submissionId,
        verification: payload.verification as VerificationResult,
        authoritative: true,
        decidedBy: 'verifier',
      };
    },
  };
}

/** Envía y traduce el resultado a estado de la vista, sin inventar veredictos. */
export async function submitForVerdict(
  port: VerdictPort,
  submissionId: string,
  proof: ProofInput,
): Promise<SubmissionState> {
  try {
    const verdict = await port.requestVerdict(submissionId, proof);
    return { kind: 'veredicto', verdict };
  } catch (err) {
    if (err instanceof VerdictChannelError) {
      return { kind: 'canal_fallido', failure: { code: err.code, detail: err.message } };
    }
    return {
      kind: 'canal_fallido',
      failure: { code: 'CANAL_INDISPONIBLE', detail: String(err) },
    };
  }
}
