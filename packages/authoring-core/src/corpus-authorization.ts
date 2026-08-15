import { InvalidCorpusDecisionError } from './errors.js';
import type { SelectionManifest } from './selection-manifest.js';
import type { W0State } from './w0-state.js';

/**
 * Autorización externa del corpus (T-H45-07 ← P-I §7.0).
 *
 * «La autorización del corpus es una **frontera externa de gobernanza** y no
 * constituye autoría docente ordinaria.» De ahí las dos reglas que este módulo
 * hace ejecutables:
 *
 * 1. El aprobador **decide**, no edita. No hay forma de devolver una propuesta
 *    modificada: la decisión es autorizar o rechazar, y rechazar manda a
 *    reinvestigación. Si el humano pudiera reescribirla, la propuesta pasaría a
 *    ser suya y W0 dejaría de ser autónoma — que es justo lo que el veredicto de
 *    autonomía tiene que poder medir.
 * 2. Rechazar exige `rejection_reason_code` **y** motivo de entre los cuatro que
 *    la norma enumera: alcance, seguridad, legalidad, gobernanza.
 */

/** Los cuatro motivos literales de rechazo. */
export const REJECTION_GROUNDS = ['alcance', 'seguridad', 'legalidad', 'gobernanza'] as const;
export type RejectionGround = (typeof REJECTION_GROUNDS)[number];

/** Solo el `CORPUS_APPROVER` decide (Plan.md §5.2, gate H4.5). */
export const CORPUS_DECISION_ROLE = 'CORPUS_APPROVER' as const;

export type CorpusDecision =
  | { readonly kind: 'autorizado'; readonly decidedBy: typeof CORPUS_DECISION_ROLE }
  | {
      readonly kind: 'rechazado';
      readonly decidedBy: typeof CORPUS_DECISION_ROLE;
      readonly ground: RejectionGround;
      readonly rejectionReasonCode: string;
      readonly evidence: string;
    };

export interface DecisionRecord {
  readonly decision: CorpusDecision;
  /** Estado de W0 al que lleva la decisión. */
  readonly nextState: W0State;
  /** Manifiesto sobre el que se decidió, identificado por su curso y versión. */
  readonly courseId: string;
  readonly manifestVersion: string;
}

export function isRejectionGround(value: string): value is RejectionGround {
  return (REJECTION_GROUNDS as readonly string[]).includes(value);
}

/**
 * Aplica la decisión del aprobador sobre un manifiesto.
 *
 * Devuelve el estado siguiente en vez de mutar nada: quien persiste es
 * `operations.w0_state`, y la transición la valida `assertW0Transition`.
 */
export function decideOnCorpus(
  manifest: SelectionManifest,
  decision: CorpusDecision,
): DecisionRecord {
  if (decision.decidedBy !== CORPUS_DECISION_ROLE) {
    throw new InvalidCorpusDecisionError(
      `Solo ${CORPUS_DECISION_ROLE} autoriza o rechaza el corpus; llegó ` +
        `${String(decision.decidedBy)}.`,
    );
  }

  if (decision.kind === 'rechazado') {
    if (!isRejectionGround(decision.ground)) {
      throw new InvalidCorpusDecisionError(
        `Motivo de rechazo ${JSON.stringify(decision.ground)} fuera de los cuatro de §7.0 ` +
          `(${REJECTION_GROUNDS.join(', ')}). Un motivo libre permitiría rechazar por razones ` +
          `pedagógicas, que es lo que esta frontera excluye.`,
      );
    }
    if (decision.rejectionReasonCode.trim() === '' || decision.evidence.trim() === '') {
      throw new InvalidCorpusDecisionError(
        `Un rechazo exige rejection_reason_code y evidencia: «la causa se registra mediante ` +
          `código y evidencia» (§7.0). Sin ellos la reinvestigación no sabría qué corregir.`,
      );
    }
  }

  return {
    decision,
    nextState: decision.kind === 'autorizado' ? 'corpus_autorizado' : 'corpus_rechazado',
    courseId: manifest.courseId,
    manifestVersion: manifest.manifestVersion,
  };
}

/**
 * Comprueba que lo que vuelve del aprobador es **el mismo** manifiesto.
 *
 * Es la mitad ejecutable de «sin reescritura pedagógica humana»: la firma del
 * aprobador vale sobre el manifiesto que se le presentó, y si el que vuelve
 * difiere, la propuesta se editó por el camino. Sin esta comprobación la regla
 * sería una declaración de intenciones.
 */
export function assertNoHumanRewrite(
  presented: SelectionManifest,
  returned: SelectionManifest,
): void {
  if (JSON.stringify(presented) !== JSON.stringify(returned)) {
    throw new InvalidCorpusDecisionError(
      `El manifiesto devuelto por el aprobador no es el que se le presentó. La autorización es ` +
        `una frontera de gobernanza, no autoría: el humano decide sobre la propuesta, no la ` +
        `reescribe (§7.0). Si hace falta cambiarla, se rechaza y vuelve a reinvestigación.`,
    );
  }
}
