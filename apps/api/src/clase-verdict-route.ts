import { z } from 'zod';
import type { VerificationResult } from '@profesor-ia/contracts';
import type { ProofInput } from '@profesor-ia/logic-core/syntax';

import {
  VerdictError,
  requestVerdict,
  type SpoolPaths,
  type SpoolTiming,
} from './verdict-spool.js';

/**
 * Ruta del canal de veredicto de Clase (T-H6-13).
 *
 * Es la única ruta que `apps/api` implementa en F7; el resto sigue respondiendo
 * `NO_IMPLEMENTADO` (D-11). No monta sesión, no escribe evidencia y no decide
 * corrección del intento: eso es del motor y llega en F8 (`T-H7-01`). Lo único
 * que hace es llevar la derivación al verificador aislado y devolver su
 * veredicto tal cual.
 */

const Reference = z.union([
  z.number().int().positive(),
  z.tuple([z.number().int().positive(), z.number().int().positive()]),
]);

/**
 * Forma de la derivación en el cable. Se valida **antes** de tocar el spool: una
 * entrada malformada debe volver como error de solicitud, no como
 * `unreadable_request` del verificador, que es un incidente suyo y no del
 * alumno.
 */
export const VerdictRequestBody = z
  .object({
    submissionId: z
      .string()
      .trim()
      // El id nombra un archivo del spool: cualquier separador o `..` lo sacaría
      // del directorio. Se restringe la forma en vez de sanear la ruta después.
      .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/, 'submissionId con forma no autorizada'),
    proof: z
      .object({
        lines: z
          .array(
            z
              .object({
                formula: z.string().min(1).max(2_000),
                rule: z.string().min(1).max(64),
                refs: z.array(Reference).max(64).optional(),
                depth: z.number().int().min(0).max(64),
              })
              .strict(),
          )
          .min(1)
          .max(500),
        goal: z.string().min(1).max(2_000).optional(),
      })
      .strict(),
  })
  .strict();
export type VerdictRequestBody = z.infer<typeof VerdictRequestBody>;

export type VerdictResponse =
  | { readonly status: 200; readonly body: { readonly submissionId: string; readonly verification: VerificationResult; readonly decidedBy: 'verifier' } }
  | { readonly status: 400; readonly body: { readonly code: 'SOLICITUD_INVALIDA'; readonly detail: string } }
  | { readonly status: 502; readonly body: { readonly code: string; readonly detail: string } };

export interface VerdictRouteDeps {
  readonly paths: SpoolPaths;
  readonly timing: SpoolTiming;
}

/**
 * Maneja la solicitud. Devuelve la respuesta en vez de escribirla para poder
 * probarla sin levantar un socket.
 */
export async function handleVerdictRequest(
  deps: VerdictRouteDeps,
  rawBody: unknown,
): Promise<VerdictResponse> {
  const parsed = VerdictRequestBody.safeParse(rawBody);
  if (!parsed.success) {
    return { status: 400, body: { code: 'SOLICITUD_INVALIDA', detail: parsed.error.message } };
  }

  const proof = parsed.data.proof as ProofInput;
  try {
    const verification = await requestVerdict(
      deps.paths,
      deps.timing,
      parsed.data.submissionId,
      proof,
    );
    return {
      status: 200,
      body: { submissionId: parsed.data.submissionId, verification, decidedBy: 'verifier' },
    };
  } catch (err) {
    if (err instanceof VerdictError) {
      // Un fallo del canal se reporta como fallo del canal. Devolver un
      // veredicto negativo porque el verificador no contestó le atribuiría al
      // alumno un error que nadie observó.
      return { status: 502, body: { code: err.code, detail: err.message } };
    }
    throw err;
  }
}

export const VERDICT_ROUTE_PATH = '/clase/verificacion' as const;
