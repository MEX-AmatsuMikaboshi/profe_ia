import type { CostLedger } from './cost.js';
import { BudgetBlockedError, InvalidAlertThresholdError } from './errors.js';

/**
 * Control de gasto del propietario (T-H4-07 ← `OWNER-BUDGET-001`, UI-CORR-11).
 *
 * Dos cifras son **literales** del Maestro y por eso están fijas aquí: el
 * objetivo ordinario ≈ MXN 500/mes y el umbral duro de MXN 700 acumulados que
 * bloquea nuevas operaciones facturables hasta que se registre la revisión
 * explícita del propietario.
 *
 * «El gate nunca degrada integridad»: por eso bloquear **lanza**. No hay un
 * camino de «continuar igualmente» ni una caída a un modo que finja resultados;
 * quedarse sin presupuesto detiene el gasto, no rebaja la exigencia.
 */

/** Objetivo ordinario mensual — literal (≈ MXN 500/mes). */
export const ORDINARY_MONTHLY_TARGET_MXN = 500 as const;

/** Umbral duro acumulado que exige revisión explícita — literal (MXN 700). */
export const HARD_REVIEW_THRESHOLD_MXN = 700 as const;

/** La moneda del gate. No hay conversión: el ledger agrega por moneda. */
export const BUDGET_CURRENCY = 'MXN' as const;

export interface OwnerReview {
  /** Evento registrado en el ledger que documenta la revisión. */
  readonly ownerReviewEventId: string;
  /** Acumulado en el momento de revisar, para que quede en el registro. */
  readonly reviewedUpToMxn: number;
}

export interface BudgetControllerOptions {
  /**
   * Acumulado a partir del cual se avisa de que se está acercando al objetivo
   * ordinario. **Sin valor por omisión y obligatorio**: el Maestro dice
   * «alerta al acercarse» sin cuantificar cuánto es acercarse, y elegir aquí un
   * 80 % fijaría por cuenta propia cuándo se avisa al propietario.
   */
  readonly alertThresholdMxn: number;
}

export interface BudgetStatus {
  readonly accumulatedMxn: number;
  readonly ordinaryMonthlyTargetMxn: typeof ORDINARY_MONTHLY_TARGET_MXN;
  readonly hardReviewThresholdMxn: typeof HARD_REVIEW_THRESHOLD_MXN;
  readonly alerting: boolean;
  readonly blocked: boolean;
  readonly ownerReviewEventId?: string;
}

export class BudgetController {
  readonly #ledger: CostLedger;
  readonly #alertThresholdMxn: number;
  #review: OwnerReview | null = null;

  constructor(ledger: CostLedger, options: BudgetControllerOptions) {
    if (!Number.isFinite(options.alertThresholdMxn) || options.alertThresholdMxn <= 0) {
      throw new InvalidAlertThresholdError(
        `El umbral de alerta debe ser un número positivo; llegó ${String(options.alertThresholdMxn)}.`,
      );
    }
    if (options.alertThresholdMxn > HARD_REVIEW_THRESHOLD_MXN) {
      throw new InvalidAlertThresholdError(
        `El umbral de alerta (${options.alertThresholdMxn}) es mayor que el umbral duro ` +
          `(${HARD_REVIEW_THRESHOLD_MXN}): avisaría después de bloquear, que es no avisar.`,
      );
    }
    this.#ledger = ledger;
    this.#alertThresholdMxn = options.alertThresholdMxn;
  }

  /** Acumulado en MXN según el ledger. Otras monedas no se suman ni se convierten. */
  accumulatedMxn(): number {
    return this.#ledger.totalsByCurrency().get(BUDGET_CURRENCY) ?? 0;
  }

  /**
   * Registra la revisión explícita del propietario, que es lo único que levanta
   * el bloqueo (`OWNER-BUDGET-001`). Guarda el acumulado revisado para que el
   * registro diga **qué** se revisó y no solo que alguien revisó.
   */
  registerOwnerReview(ownerReviewEventId: string): OwnerReview {
    const review: OwnerReview = { ownerReviewEventId, reviewedUpToMxn: this.accumulatedMxn() };
    this.#review = review;
    return review;
  }

  status(): BudgetStatus {
    const accumulatedMxn = this.accumulatedMxn();
    // «Superar» los MXN 700: estrictamente por encima. En 700 exactos todavía
    // no se superó, y redondear ese borde hacia el bloqueo sería endurecer una
    // cifra literal por cuenta propia.
    const excede = accumulatedMxn > HARD_REVIEW_THRESHOLD_MXN;
    const blocked = excede && this.#review === null;

    const base = {
      accumulatedMxn,
      ordinaryMonthlyTargetMxn: ORDINARY_MONTHLY_TARGET_MXN,
      hardReviewThresholdMxn: HARD_REVIEW_THRESHOLD_MXN,
      alerting: accumulatedMxn >= this.#alertThresholdMxn,
      blocked,
    };

    return this.#review === null ? base : { ...base, ownerReviewEventId: this.#review.ownerReviewEventId };
  }

  /**
   * Puerta de toda operación facturable. Lanza si está bloqueado.
   *
   * **No existe una variante que permita continuar.** El gate nunca degrada
   * integridad (T-H4-07): si hubiera un «continuar igualmente», el bloqueo sería
   * una sugerencia, y si hubiera una caída automática a resultados fingidos
   * sería éxito simulado. Lo único que levanta el bloqueo es la revisión
   * explícita del propietario registrada en el ledger.
   */
  assertBillableAllowed(): void {
    const estado = this.status();
    if (estado.blocked) {
      throw new BudgetBlockedError(
        `Gasto acumulado MXN ${estado.accumulatedMxn} por encima del umbral duro de ` +
          `MXN ${HARD_REVIEW_THRESHOLD_MXN}. Las operaciones facturables quedan bloqueadas hasta ` +
          `que se registre la revisión explícita del propietario (OWNER-BUDGET-001). El gate no ` +
          `degrada integridad: no hay forma de continuar sin esa revisión.`,
      );
    }
  }
}
