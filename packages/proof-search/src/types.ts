import type { Formula } from '@profesor-ia/logic-core';

/**
 * Contrato del buscador de demostraciones (Plan.md T-H2-08 [CRITICAL] ←
 * Maestro P-I §7.4 y P-II §4.4).
 *
 * **El buscador se usa en autoría, no en sesión.**
 *
 * Las cuatro funciones de P-I §7.4 no se colapsan: el oráculo semántico
 * (`logic-core`), el buscador heurístico (este paquete), el decisor terminante
 * (no existe aún) y la re-verificación por `logic-core` son piezas distintas.
 */

export type SearchMode = 'heuristic' | 'exhaustive_k';

export interface SearchBudget {
  /**
   * Corte **primario**: trabajo reproducible en unidades de inferencia
   * intentada. Es lo único que decide cuándo parar; no depende del reloj.
   */
  readonly maxWorkUnits: number;
  /** Coste máximo explorado en `exhaustive_k`. Métrica: número de líneas. */
  readonly maxCost?: number;
  /**
   * Salvaguarda de pared. Protege el proceso pero **no se usa para afirmar
   * propiedades lógicas**; si se dispara, queda registrado por separado.
   */
  readonly wallTimeoutMs?: number;
}

export interface SearchTelemetry {
  /** Unidades de trabajo consumidas: reproducible entre corridas. */
  readonly workUnits: number;
  /** Coste máximo (en líneas) explorado exhaustivamente. */
  readonly costExplored: number;
  /** `true` solo si la salvaguarda de pared cortó la búsqueda. */
  readonly wallTimeoutHit: boolean;
  readonly mode: SearchMode;
  /** Orden de exploración congelado por versión. */
  readonly searchOrderVersion: string;
}

export interface FoundProof {
  /** Derivación en el formato que `logic-core` verifica. */
  readonly lines: readonly {
    readonly formula: string;
    readonly rule: string;
    readonly refs?: readonly (number | readonly [number, number])[];
    readonly depth: number;
  }[];
  /** Métrica de coste declarada por el cálculo: `proof_line_count`. */
  readonly cost: number;
  /**
   * Reglas necesarias en la solución encontrada (P-II §4.4).
   *
   * **No es la lista de reglas del certificado, y la diferencia importa.** Sale
   * del término de derivación, y la **reiteración se inserta al linealizar**:
   * cuando la conclusión de una subprueba ya estaba disponible fuera, `linearize`
   * añade una línea `R` que aquí no consta. Quien pregunte «¿esta prueba usa
   * `R`?» por este campo concluirá que **ningún** reactivo de KC03 ejercita su
   * regla, que es falso. Para eso hay que recorrer `lines`.
   *
   * No se corrige por lo que cuesta, no porque esté bien: `distinctRuleCount` se
   * deriva de aquí y pesa 35 en el índice de complejidad, así que arreglarlo
   * movería el manifiesto congelado `cal-09-v1` —`cal09-mid-one-subproof`
   * reitera—. Re-congelar una calibración es decisión del propietario (D-61).
   */
  readonly rulesUsed: readonly string[];
}

export type SearchOutcome =
  | {
      readonly status: 'proof_found';
      readonly proof: FoundProof;
      /**
       * Solo `true` si `exhaustive_k` agotó **todos** los costes menores.
       * Nunca se afirma minimalidad global.
       */
      readonly minimalCostVerified: boolean;
      readonly telemetry: SearchTelemetry;
    }
  | {
      readonly status: 'semantically_invalid';
      /** Contramodelo del oráculo independiente. */
      readonly countermodel: Readonly<Record<string, boolean>>;
      readonly telemetry: SearchTelemetry;
    }
  | {
      /** Agotó el presupuesto. **No** significa inexistencia (P-I §7.4). */
      readonly status: 'search_budget_exhausted';
      readonly telemetry: SearchTelemetry;
    }
  | {
      /** Exploró exhaustivamente hasta `k` sin hallar prueba. No infiere inexistencia global. */
      readonly status: 'no_proof_with_cost_at_most_k';
      readonly k: number;
      readonly telemetry: SearchTelemetry;
    };

export interface SearchRequest {
  readonly premises: readonly string[];
  readonly goal: string;
  readonly mode: SearchMode;
  readonly budget: SearchBudget;
}

/** Meta trivial: la conclusión ya está entre las premisas (P-II §4.4). */
export interface TrivialGoal {
  readonly trivial: true;
  readonly premiseIndex: number;
}

export interface InternalContext {
  readonly available: readonly { formula: Formula; source: number }[];
}
