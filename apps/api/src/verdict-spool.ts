import { readFileSync, renameSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { VerificationResult } from '@profesor-ia/contracts';
import type { ProofInput } from '@profesor-ia/logic-core/syntax';

/**
 * Canal de veredicto de la vista de Clase (T-H6-13 ← P-I §8.9: «veredicto
 * autoritativo en servidor»).
 *
 * El verificador corre en `apps/verifier` con `network_mode: none` y su
 * transporte es un spool en disco (D-12, I-3). `apps/api` **no verifica**: le
 * pasa la derivación al verificador y devuelve lo que este dijo. Importar
 * `verify()` aquí sería más corto y crearía un segundo verificador fuera del
 * contenedor sin red; la regla `sin-verificador-fuera-del-verificador` de
 * dependency-cruiser lo impide, y de este paquete solo entra el tipo
 * `ProofInput` por el subpath sin veredicto.
 */

export type VerdictErrorCode =
  | 'VERIFICADOR_SIN_RESPUESTA'
  | 'VERIFICADOR_RECHAZO_ENTRADA'
  | 'VEREDICTO_ILEGIBLE';

export class VerdictError extends Error {
  constructor(
    readonly code: VerdictErrorCode,
    detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = 'VerdictError';
  }
}

export interface SpoolPaths {
  readonly inbox: string;
  readonly outbox: string;
  readonly failed: string;
}

export interface SpoolTiming {
  readonly pollMs: number;
  readonly timeoutMs: number;
  /** Inyectables para que la prueba no dependa del reloj real. */
  readonly now: () => number;
  readonly sleep: (ms: number) => Promise<void>;
}

export const DEFAULT_SPOOL_TIMING: Omit<SpoolTiming, 'now' | 'sleep'> = {
  pollMs: 50,
  timeoutMs: 10_000,
};

/**
 * Deja la solicitud en el spool de entrada de forma **atómica**.
 *
 * El verificador recorre `SPOOL_IN` y procesa todo `.json` que encuentre, así
 * que escribir directamente con ese nombre le deja leer un archivo a medio
 * escribir y contestar `unreadable_request` a una derivación que estaba bien.
 * Se escribe con otra extensión y se renombra, que en el mismo sistema de
 * archivos es atómico.
 */
export function submitToSpool(paths: SpoolPaths, submissionId: string, proof: ProofInput): void {
  mkdirSync(paths.inbox, { recursive: true });
  const staging = join(paths.inbox, `${submissionId}.json.parcial`);
  writeFileSync(staging, `${JSON.stringify(proof)}\n`, 'utf8');
  renameSync(staging, join(paths.inbox, `${submissionId}.json`));
}

/**
 * Espera el veredicto. **No devuelve nada benigno si no llega**: agotar el plazo
 * lanza. Un «no válido» inventado por un timeout se registraría como el
 * resultado del alumno.
 */
export async function awaitVerdict(
  paths: SpoolPaths,
  timing: SpoolTiming,
  submissionId: string,
): Promise<VerificationResult> {
  const name = `${submissionId}.json`;
  const outPath = join(paths.outbox, name);
  const failedPath = join(paths.failed, `${name}.error`);
  const deadline = timing.now() + timing.timeoutMs;

  for (;;) {
    if (existsSync(outPath)) {
      const raw = readFileSync(outPath, 'utf8');
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        throw new VerdictError('VEREDICTO_ILEGIBLE', `${name}: ${String(err)}`);
      }
      const result = VerificationResult.safeParse(parsed);
      if (!result.success) {
        // Un veredicto fuera de contrato no se «arregla» rellenando campos: el
        // resultado que se enseñaría al alumno no sería el del verificador.
        throw new VerdictError('VEREDICTO_ILEGIBLE', `${name}: ${result.error.message}`);
      }
      return result.data;
    }

    if (existsSync(failedPath)) {
      throw new VerdictError(
        'VERIFICADOR_RECHAZO_ENTRADA',
        `${name}: el verificador apartó la solicitud como ilegible`,
      );
    }

    if (timing.now() >= deadline) {
      throw new VerdictError(
        'VERIFICADOR_SIN_RESPUESTA',
        `${name}: sin veredicto tras ${timing.timeoutMs} ms`,
      );
    }

    await timing.sleep(timing.pollMs);
  }
}

export async function requestVerdict(
  paths: SpoolPaths,
  timing: SpoolTiming,
  submissionId: string,
  proof: ProofInput,
): Promise<VerificationResult> {
  submitToSpool(paths, submissionId, proof);
  return awaitVerdict(paths, timing, submissionId);
}
