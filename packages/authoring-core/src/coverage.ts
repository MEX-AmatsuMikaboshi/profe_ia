import { CalibrationPendingError, CoverageError } from './errors.js';
import { HINT_LEVELS, type HintLevel } from './hints.js';
import { KC_IDS, type KcId } from './kc-map.js';
import { effectiveReserve, isMeasurementReserve, type Reserve } from './reserves.js';

/**
 * Cobertura mínima antes de congelar (T-H5-08 ← P-III §4.2 y P-I §7.8).
 *
 * **Las cifras son literales de la norma, pero no son constantes universales.**
 * §4.2 lo dice con todas sus letras: son «parámetros operativos de cobertura de
 * esta versión, no constantes científicas», que «se identifican en el registro
 * de parámetros y se congelan», y §7.8 remata: «heurísticas operativas del
 * proyecto derivadas del calendario, no mínimos psicométricos universales». Por
 * eso cada piso lleva aquí su `parameterId`; su freeze queda visible en
 * `docs/params/registry.yaml` junto con las calibraciones que lo habilitan.
 *
 * Y por eso mismo hay una frontera dura dentro de la tarea. Lo que la norma
 * **cifra** se comprueba: 6 actividades por KC, 3 niveles de pista, 1
 * transferencia, reserva de recuperación, trazabilidad, y el 20 % de reserva de
 * sondas. Lo que la norma **deriva del calendario** no se puede comprobar
 * antes de T-H5-11, porque «la cantidad exacta se calcula desde el calendario».
 * Ahora `requiredProbesForCalendar()` exige el sobre congelado y deriva el
 * total; el scheduler completo sigue correspondiendo a `T-H6-07`.
 */

export interface CoverageParameter {
  readonly parameterId: string;
  readonly value: number;
  /** Dónde lo dice la norma. */
  readonly source: string;
}

/**
 * Los pisos, con su id de parámetro para el registro de §4.2. Se exponen como
 * datos y no como números sueltos en el código para que el freeze pueda
 * enumerarlos: un piso que solo viva dentro de un `if` no se puede congelar.
 */
export const COVERAGE_PARAMETERS: Readonly<Record<string, CoverageParameter>> = Object.freeze({
  operationalActivitiesPerKc: Object.freeze({
    parameterId: 'COV-KC-ACTIVITIES',
    value: 6,
    source: 'P-III §4.2 y P-I §7.8: «6 actividades operativas como piso»',
  }),
  hintLevelsPerKc: Object.freeze({
    parameterId: 'COV-KC-HINT-LEVELS',
    value: 3,
    source: 'P-III §4.2: «3 niveles de pista como mínimo»',
  }),
  transferActivitiesPerKc: Object.freeze({
    parameterId: 'COV-KC-TRANSFER',
    value: 1,
    source: 'P-III §4.2: «1 actividad de transferencia»',
  }),
  recoveryItemsPerKc: Object.freeze({
    parameterId: 'COV-KC-RECOVERY',
    value: 1,
    source: 'P-III §4.2: «reserva de recuperación»',
  }),
  probeReservePercent: Object.freeze({
    parameterId: 'COV-SET-PROBE-RESERVE',
    value: 20,
    source: 'P-III §4.2 y P-I §7.8: «reserva adicional mínima del 20 %»',
  }),
  retentionIntervalDays: Object.freeze({
    parameterId: 'COV-RETENTION-INTERVAL',
    value: 7,
    source: 'P-I §5.5: «un único intervalo primario de 7 días calendario por conjunto»',
  }),
});

export interface CoverageItem {
  readonly itemId: string;
  readonly reserve: Reserve;
  /** Obligatorio si `reserve` es `replacement` (D-21). */
  readonly replacesReserve?: Reserve;
  readonly targetKcs: readonly KcId[];
  /** Niveles de pista disponibles para este reactivo (`hints.ts`). */
  readonly hintLevels: readonly HintLevel[];
}

/**
 * ¿Cuenta el reactivo como **oportunidad operativa** del KC?
 *
 * Ninguna autoridad enumera qué reservas cuentan, así que esto es una lectura y
 * queda registrada como tal (**D-22**): cuenta lo que **no** es de medición.
 * El motivo es de la propia norma, no una preferencia: §10.3 separa enseñanza de
 * medición y exige «sin reutilización» en las sondas, así que una sonda no es
 * una oportunidad de practicar el KC —es la medida de si se aprendió—. Contarlas
 * haría que un KC llegara al piso gastando el material con el que después se le
 * mide.
 */
export function countsAsOperationalOpportunity(item: CoverageItem): boolean {
  return !isMeasurementReserve(effectiveReserve(item));
}

export interface KcCoverageGap {
  readonly kcId: KcId;
  readonly parameterId: string;
  readonly found: number;
  readonly required: number;
  readonly detail: string;
}

export interface PerKcCoverageInput {
  /**
   * KC que entran al piloto. **Declarado, no inferido de los reactivos**: si se
   * dedujera de lo que hay, un KC sin un solo reactivo desaparecería del cálculo
   * y la cobertura saldría completa justo donde falta todo (D-18).
   */
  readonly kcsInPilot: readonly KcId[];
  readonly items: readonly CoverageItem[];
  /** Fragmentos del corpus a los que traza cada KC (§4.2: «trazabilidad al corpus»). */
  readonly corpusTraceByKc: Readonly<Record<string, readonly string[]>>;
}

/**
 * Los cinco pisos por KC de P-III §4.2, **reportando todos los huecos** y no el
 * primero: quien tenga que rellenar el banco necesita la lista entera, igual que
 * las causas de bloqueo de W1.
 */
export function perKcCoverageGaps(input: PerKcCoverageInput): readonly KcCoverageGap[] {
  if (input.kcsInPilot.length === 0) {
    throw new CoverageError(
      'No se declaró ningún KC en el piloto. Con la lista vacía todos los pisos se cumplirían por ' +
        'vacío y la cobertura saldría completa sin un solo reactivo.',
    );
  }
  for (const kcId of input.kcsInPilot) {
    if (!(KC_IDS as readonly string[]).includes(kcId)) {
      throw new CoverageError(`${kcId} no está en el catálogo de KC de P-I §5.2.`);
    }
  }

  const huecos: KcCoverageGap[] = [];

  for (const kcId of input.kcsInPilot) {
    const delKc = input.items.filter((i) => i.targetKcs.includes(kcId));

    const operativas = delKc.filter(countsAsOperationalOpportunity).length;
    const piso = COVERAGE_PARAMETERS['operationalActivitiesPerKc'];
    if (piso !== undefined && operativas < piso.value) {
      huecos.push({
        kcId,
        parameterId: piso.parameterId,
        found: operativas,
        required: piso.value,
        detail: 'actividades operativas (fuera de las reservas de medición)',
      });
    }

    const niveles = new Set<HintLevel>();
    for (const item of delKc) for (const nivel of item.hintLevels) niveles.add(nivel);
    const pisoPistas = COVERAGE_PARAMETERS['hintLevelsPerKc'];
    if (pisoPistas !== undefined && niveles.size < pisoPistas.value) {
      huecos.push({
        kcId,
        parameterId: pisoPistas.parameterId,
        found: niveles.size,
        required: pisoPistas.value,
        detail: 'niveles de pista distintos disponibles',
      });
    }

    /**
     * Solo `TRANSFER_MASTERY`. Una de medición **no sirve** para este piso: §5.11
     * dice que `TRANSFER_MASTERY` es «usada por el controlador para comprobar
     * dominio operativo» y que `TRANSFER_MEASUREMENT` va «sin agente, pistas ni
     * retroalimentación» y solo alimenta la medida experimental. Como §5.3 exige
     * al menos una transferencia cercana **elegible** para declarar dominio,
     * contar la de medición dejaría al KC con el piso cubierto y el dominio
     * inalcanzable. Es la misma frontera que aplica `countsAsOperationalOpportunity`.
     */
    const transferencias = delKc.filter(
      (i) => effectiveReserve(i) === 'TRANSFER_MASTERY',
    ).length;
    const pisoTransfer = COVERAGE_PARAMETERS['transferActivitiesPerKc'];
    if (pisoTransfer !== undefined && transferencias < pisoTransfer.value) {
      huecos.push({
        kcId,
        parameterId: pisoTransfer.parameterId,
        found: transferencias,
        required: pisoTransfer.value,
        detail: 'actividades de transferencia',
      });
    }

    const recuperacion = delKc.filter((i) => effectiveReserve(i) === 'recovery').length;
    const pisoRecuperacion = COVERAGE_PARAMETERS['recoveryItemsPerKc'];
    if (pisoRecuperacion !== undefined && recuperacion < pisoRecuperacion.value) {
      huecos.push({
        kcId,
        parameterId: pisoRecuperacion.parameterId,
        found: recuperacion,
        required: pisoRecuperacion.value,
        detail: 'reserva de recuperación',
      });
    }

    const traza = input.corpusTraceByKc[kcId] ?? [];
    if (traza.length === 0) {
      huecos.push({
        kcId,
        parameterId: 'COV-KC-TRACEABILITY',
        found: 0,
        required: 1,
        detail:
          'trazabilidad al corpus: sin un solo fragmento de origen, el KC se enseñaría sin poder ' +
          'decir de dónde sale',
      });
    }
  }

  return Object.freeze(huecos);
}

/** Entrada mínima del sobre de cobertura congelado en H5 (T-H5-11).
 *
 * No es todavía el scheduler de T-H6-07: solo contiene cuántas oportunidades
 * nominales debe poder servir cada conjunto y los dos parámetros que hacen de
 * cada oportunidad una observación comparable.
 */
export interface ScedProbeCoveragePlan {
  readonly calibrationVersion: string;
  readonly kSet: number;
  readonly minValidItemsPerOpportunity: number;
  readonly plannedOpportunitiesBySet: Readonly<Record<string, number>>;
}

function assertScedProbeCoveragePlan(plan: ScedProbeCoveragePlan): void {
  if (plan.calibrationVersion.trim() === '') {
    throw new CoverageError('El sobre SCED no identifica la versión de calibración congelada.');
  }
  if (!Number.isInteger(plan.kSet) || plan.kSet < 2) {
    throw new CoverageError(`k_set=${plan.kSet} no define una microbatería de al menos dos ítems.`);
  }
  if (
    !Number.isInteger(plan.minValidItemsPerOpportunity) ||
    plan.minValidItemsPerOpportunity < 1 ||
    plan.minValidItemsPerOpportunity > plan.kSet
  ) {
    throw new CoverageError(
      `min_valid_items_per_opportunity=${plan.minValidItemsPerOpportunity} no cabe en k_set=${plan.kSet}.`,
    );
  }
  if (plan.minValidItemsPerOpportunity <= plan.kSet / 2) {
    throw new CoverageError(
      'El mínimo válido no conserva la mayoría estricta predeclarada por la calibración H5.',
    );
  }
  if (plan.kSet - 1 < plan.minValidItemsPerOpportunity) {
    throw new CoverageError(
      'La microbatería no tolera la invalidación de un reactivo como exige la calibración H5.',
    );
  }
}

/**
 * Cuántas sondas únicas exige el calendario nominal para un conjunto.
 *
 * §7.8: «la cantidad exacta se calcula desde el calendario». Por eso la
 * función multiplica oportunidades por el `k_set` **congelado** y no guarda un
 * número paralelo que pueda divergir. La reserva adicional del 20 % se aplica
 * después con `minimumProbeInventory()`.
 */
export function requiredProbesForCalendar(
  experimentalSetId: string,
  plan: ScedProbeCoveragePlan,
): number {
  assertScedProbeCoveragePlan(plan);
  const oportunidades = plan.plannedOpportunitiesBySet[experimentalSetId];
  if (oportunidades === undefined) {
    throw new CoverageError(
      `El conjunto ${experimentalSetId} no aparece en el sobre de cobertura ${plan.calibrationVersion}.`,
    );
  }
  if (!Number.isInteger(oportunidades) || oportunidades < 1) {
    throw new CoverageError(
      `El conjunto ${experimentalSetId} declara ${oportunidades} oportunidades nominales; se espera un entero positivo.`,
    );
  }
  return oportunidades * plan.kSet;
}

export interface ProbeInventoryGap {
  readonly experimentalSetId: string;
  readonly available: number;
  readonly requiredByCalendar: number;
  readonly requiredWithReserve: number;
  readonly missing: number;
}

/** Verifica el banco real contra calendario nominal + reserva literal del 20 %. */
export function probeInventoryGaps(
  plan: ScedProbeCoveragePlan,
  inventoryBySet: Readonly<Record<string, readonly string[]>>,
): readonly ProbeInventoryGap[] {
  assertScedProbeCoveragePlan(plan);
  const gaps: ProbeInventoryGap[] = [];
  for (const setId of Object.keys(plan.plannedOpportunitiesBySet)) {
    const ids = inventoryBySet[setId];
    const requiredByCalendar = requiredProbesForCalendar(setId, plan);
    const requiredWithReserve = minimumProbeInventory(requiredByCalendar);
    if (ids === undefined) {
      gaps.push({
        experimentalSetId: setId,
        available: 0,
        requiredByCalendar,
        requiredWithReserve,
        missing: requiredWithReserve,
      });
      continue;
    }
    const unique = new Set(ids);
    if (unique.size !== ids.length) {
      throw new CoverageError(
        `El inventario de ${setId} repite IDs; una sonda consumida no puede volver al banco.`,
      );
    }
    if (unique.size < requiredWithReserve) {
      gaps.push({
        experimentalSetId: setId,
        available: unique.size,
        requiredByCalendar,
        requiredWithReserve,
        missing: requiredWithReserve - unique.size,
      });
    }
  }
  return Object.freeze(gaps);
}

export function assertProbeInventoryCoverage(
  plan: ScedProbeCoveragePlan,
  inventoryBySet: Readonly<Record<string, readonly string[]>>,
): void {
  const gaps = probeInventoryGaps(plan, inventoryBySet);
  if (gaps.length > 0) {
    throw new CoverageError(
      `Cobertura SCED insuficiente: ${gaps
        .map((gap) => `${gap.experimentalSetId}: ${gap.available}/${gap.requiredWithReserve}`)
        .join('; ')}. El piloto no abre.`,
    );
  }
}

/**
 * Inventario mínimo de sondas para un conjunto: lo que pide el calendario **más
 * la reserva del 20 %**.
 *
 * La regla sí es literal y por eso se implementa; lo que no está disponible es
 * su entrada. Se redondea **hacia arriba** porque una reserva del 20 % que se
 * quedara corta por el redondeo dejaría de ser «reserva adicional mínima».
 */
export function minimumProbeInventory(requiredByCalendar: number): number {
  if (!Number.isInteger(requiredByCalendar) || requiredByCalendar < 0) {
    throw new CoverageError(
      `El calendario no puede exigir ${requiredByCalendar} sondas. Se espera un entero no negativo.`,
    );
  }
  const porcentaje = COVERAGE_PARAMETERS['probeReservePercent']?.value ?? 0;
  return requiredByCalendar + Math.ceil((requiredByCalendar * porcentaje) / 100);
}

export interface CriticalPointCoverage {
  /**
   * Puntos críticos del conjunto. **La norma los nombra sin definirlos**
   * (P-III §4.2: «al menos una forma de transferencia por punto crítico»), así
   * que son dato declarado y no una lista que este módulo invente: elegir qué es
   * crítico decidiría por cuenta propia dónde se exige transferencia.
   */
  readonly criticalPoints: readonly string[];
  /** Formas de transferencia disponibles por punto crítico. */
  readonly transferFormsByCriticalPoint: Readonly<Record<string, readonly string[]>>;
}

/** «Al menos una forma de transferencia por punto crítico» (P-III §4.2). */
export function assertCriticalPointTransfers(input: CriticalPointCoverage): void {
  if (input.criticalPoints.length === 0) {
    throw new CoverageError(
      'No se declaró ningún punto crítico. La norma los nombra sin definirlos, así que la lista ' +
        'es dato: vacía, la comprobación pasaría por vacío y el conjunto parecería cubierto.',
    );
  }
  const sinTransferencia = input.criticalPoints.filter(
    (punto) => (input.transferFormsByCriticalPoint[punto] ?? []).length === 0,
  );
  if (sinTransferencia.length > 0) {
    throw new CoverageError(
      `Sin forma de transferencia para: ${sinTransferencia.join(', ')}. P-III §4.2 exige al menos ` +
        `una por punto crítico.`,
    );
  }
}

/**
 * «Cada tipo de error prioritario debe tener al menos una pista por nivel»
 * (P-I §7.8). Los niveles son los cinco de §8.6.
 *
 * «Tipo de error prioritario» tampoco lo define ninguna autoridad, así que la
 * lista es dato declarado por el mismo motivo que los puntos críticos.
 */
export function assertHintCoveragePerErrorType(
  priorityErrorTypes: readonly string[],
  hintLevelsByErrorType: Readonly<Record<string, readonly HintLevel[]>>,
): void {
  if (priorityErrorTypes.length === 0) {
    throw new CoverageError(
      'No se declaró ningún tipo de error prioritario: la comprobación pasaría por vacío.',
    );
  }
  const faltan: string[] = [];
  for (const tipo of priorityErrorTypes) {
    const niveles = new Set(hintLevelsByErrorType[tipo] ?? []);
    const ausentes = HINT_LEVELS.filter((n) => !niveles.has(n));
    if (ausentes.length > 0) faltan.push(`${tipo} (faltan niveles ${ausentes.join(', ')})`);
  }
  if (faltan.length > 0) {
    throw new CoverageError(
      `Tipos de error prioritarios sin pista en todos los niveles: ${faltan.join('; ')}. P-I §7.8 ` +
        `pide «al menos una pista por nivel» para cada uno.`,
    );
  }
}

export interface FamilyDeclaration {
  readonly itemFamilyId: string;
  /** Los tres que exige §7.8 para una familia paramétrica. */
  readonly generatorTemplateId: string;
  readonly restrictions: readonly string[];
  readonly verifierContract: string;
}

/** «Cada familia paramétrica debe declarar generador, restricciones y verificador» (§7.8). */
export function assertFamilyDeclarations(families: readonly FamilyDeclaration[]): void {
  if (families.length === 0) {
    throw new CoverageError('No hay familias que comprobar: la declaración pasaría por vacío.');
  }
  for (const familia of families) {
    const faltantes: string[] = [];
    if (familia.generatorTemplateId.trim() === '') faltantes.push('generador');
    if (familia.restrictions.length === 0) faltantes.push('restricciones');
    if (familia.verifierContract.trim() === '') faltantes.push('verificador');
    if (faltantes.length > 0) {
      throw new CoverageError(
        `La familia ${familia.itemFamilyId} no declara: ${faltantes.join(', ')}. §7.8 exige los ` +
          `tres; sin restricciones declaradas no se puede decir qué genera la plantilla ni qué no.`,
      );
    }
  }
}

/** Decisión de la corrida sobre la medida de retención (P-I §5.5, P-III §4.2). */
export type RetentionPlan =
  | { readonly willEvaluate: true; readonly reserveItemIds: readonly string[] }
  | { readonly willEvaluate: false; readonly declaredCode: 'retention_not_evaluated'; readonly reason: string };

export interface RetentionCoverageReport {
  readonly intervalDays: number;
  readonly reserveItems: number;
  /**
   * **Siempre `false`.** La suficiencia real del banco y del calendario para
   * siete días sin reutilización es `CAL-13`/`CAL-RETENTION-BANK`, y se
   * comprueba en H5/H10. Que la reserva no esté vacía no la hace suficiente.
   */
  readonly sufficiencyDemonstrated: false;
  readonly declaredCode: 'retention_not_evaluated' | null;
}

/**
 * Cobertura de retención.
 *
 * Las dos salidas de la norma son estas y ninguna más: o la corrida va a medir
 * retención con reserva válida, o **declara `retention_not_evaluated` antes de
 * H11**. §5.5: «no se sustituye por otro intervalo elegido post hoc ni se infiere
 * retención desde dominio o transferencia inmediata». Por eso una reserva vacía
 * con `willEvaluate: true` se rechaza en vez de degradarse sola al código: la
 * declaración es una decisión de la corrida, no un apaño del validador.
 */
export function retentionCoverage(plan: RetentionPlan): RetentionCoverageReport {
  const dias = COVERAGE_PARAMETERS['retentionIntervalDays']?.value ?? 0;

  if (!plan.willEvaluate) {
    if (plan.reason.trim() === '') {
      throw new CoverageError(
        'Se declara `retention_not_evaluated` sin motivo. La declaración es preinscrita y entra al ' +
          'freeze: sin causa registrada no se puede auditar por qué no se midió retención.',
      );
    }
    return Object.freeze({
      intervalDays: dias,
      reserveItems: 0,
      sufficiencyDemonstrated: false,
      declaredCode: 'retention_not_evaluated',
    });
  }

  if (plan.reserveItemIds.length === 0) {
    throw new CoverageError(
      'La corrida dice que medirá retención y la reserva está vacía. La salida que la norma prevé ' +
        'es declarar `retention_not_evaluated`, no medir sin reserva: degradarlo aquí ' +
        'convertiría una decisión preinscrita de la corrida en un apaño del validador.',
    );
  }

  return Object.freeze({
    intervalDays: dias,
    reserveItems: plan.reserveItemIds.length,
    sufficiencyDemonstrated: false,
    declaredCode: null,
  });
}

/**
 * Suficiencia de la reserva de retención. **Falla cerrado** con `CAL-13`.
 *
 * §5.5 lo deja escrito: «la suficiencia real del banco/calendario sigue siendo
 * un pendiente operativo `CALIBRABLE` que se comprueba en H5/H10». Contar los
 * reactivos de la reserva dice cuántos hay, no si alcanzan para el calendario
 * preinscrito sin reutilizar ninguno.
 */
export function assertRetentionReserveSufficient(report: RetentionCoverageReport): never {
  throw new CalibrationPendingError(
    'CAL-13',
    `la reserva tiene ${report.reserveItems} reactivo(s) para el intervalo de ` +
      `${report.intervalDays} días, pero cuántos hacen falta sin reutilizar ninguno lo fija el ` +
      `calendario preinscrito, que no está congelado`,
    'H5/H10 / T-H5-11 y T-H10-09',
  );
}

/**
 * «Cada declaración válida de dominio debe disponer de capacidad para al menos
 * una reconfirmación post-dominio **desde la reserva de práctica
 * independiente**» (P-I §7.8).
 *
 * La capacidad se cuenta **por KC**, no en total. El dominio se declara por KC
 * (§5.3), así que un total global dejaría que diez reactivos de práctica
 * independiente de un solo KC cubrieran las declaraciones de otros nueve, y esos
 * nueve se quedarían sin la reconfirmación que los confirma. Cuántas
 * declaraciones se esperan por KC lo decide la corrida, así que entra declarado.
 */
export function assertPostMasteryReconfirmationCapacity(
  expectedMasteryDeclarationsByKc: Readonly<Record<string, number>>,
  items: readonly CoverageItem[],
): void {
  const entradas = Object.entries(expectedMasteryDeclarationsByKc);
  if (entradas.length === 0) {
    throw new CoverageError(
      'No se declaró ninguna expectativa de dominio. Con el mapa vacío, la capacidad de ' +
        'reconfirmación se cumpliría por vacío.',
    );
  }

  const faltantes: string[] = [];
  for (const [kcId, esperadas] of entradas) {
    if (!Number.isInteger(esperadas) || esperadas < 1) {
      throw new CoverageError(
        `${kcId} espera ${esperadas} declaraciones de dominio. Con cero, su capacidad de ` +
          `reconfirmación se cumpliría por vacío.`,
      );
    }
    const disponibles = items.filter(
      (i) => i.targetKcs.includes(kcId as KcId) && effectiveReserve(i) === 'independent_practice',
    ).length;
    if (disponibles < esperadas) {
      faltantes.push(`${kcId}: ${disponibles}/${esperadas}`);
    }
  }

  if (faltantes.length > 0) {
    throw new CoverageError(
      `Práctica independiente insuficiente para la reconfirmación post-dominio (${faltantes.join(', ')}). ` +
        `P-I §7.8 exige capacidad para al menos una reconfirmación por declaración y **desde esa ` +
        `reserva**: sin ella, un dominio declarado se quedaría sin la comprobación que lo confirma ` +
        `y contaría igual.`,
    );
  }
}

export interface CoverageReport {
  readonly kcsChecked: number;
  readonly gaps: readonly KcCoverageGap[];
  /**
   * Declarado siempre. `docs/params/registry.yaml` está vacío a propósito: §4.2
   * exige que estos pisos se identifiquen en el registro y se congelen, y hasta
   * que eso ocurra el informe no puede decir que la cobertura esté cerrada.
   */
  readonly parametersFrozenInRegistry: false;
  readonly parameters: Readonly<Record<string, CoverageParameter>>;
}

/** Informe de cobertura por KC. Lanza si hay huecos, con **todos** enumerados. */
export function assertPerKcCoverage(input: PerKcCoverageInput): CoverageReport {
  const gaps = perKcCoverageGaps(input);
  if (gaps.length > 0) {
    const detalle = gaps
      .map((g) => `${g.kcId}: ${g.found}/${g.required} ${g.detail} [${g.parameterId}]`)
      .join('; ');
    throw new CoverageError(
      `Cobertura por KC incompleta en ${gaps.length} punto(s): ${detalle}. P-III §4.2 fija estos ` +
        `pisos para cada KC que entre al piloto.`,
    );
  }
  return Object.freeze({
    kcsChecked: input.kcsInPilot.length,
    gaps,
    parametersFrozenInRegistry: false,
    parameters: COVERAGE_PARAMETERS,
  });
}
