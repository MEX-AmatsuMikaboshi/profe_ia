import {
  AUTHORIZED_RULE_IDS,
  LINE_JUSTIFICATIONS,
  type RuleId,
} from '@profesor-ia/logic-core';

import { ProbeRuleClosureError } from './errors.js';
import { KC_CATALOG, type KcId } from './kc-map.js';
import { isMeasurementReserve, type Reserve } from './reserves.js';

/**
 * Clausura de reglas de una sonda respecto de la secuencia de enseñanza
 * (D-65 ← P-I §7.7, P-II §6.3).
 *
 * **El defecto que esta guarda existe para impedir.** Una sonda mide un KC en
 * una fase concreta del SCED. Si su derivación exige una regla que en esa fase
 * todavía **no se ha enseñado**, el alumno puede fallar por la regla ajena y no
 * por el KC medido, y la sonda deja de medir lo que dice medir. No es una
 * cuestión de dificultad —que `difficulty_outside_declared_level` ya cubre—
 * sino de validez: la respuesta incorrecta no es interpretable.
 *
 * Apareció al revisar el banco de la corrida de W3 del 2026-08-22, donde las
 * cuatro plantillas de sonda envuelven el núcleo del KC y **la envoltura importa
 * la regla de otro KC**: `sonda-cond_meta` importa `→I` (KC09),
 * `sonda-conj_premisa` importa `∧E` (KC05) y `sonda-disy_meta` importa `∨I`
 * (KC07). Setenta sondas de `probes_baseline` y `probes_intervention` exigían
 * así una regla posterior a la que medían.
 *
 * **Por qué se compara contra la secuencia y no contra el mapa.** Las aristas de
 * `kc/map.yaml` dicen qué KC depende de cuál, no en qué orden se enseñan. Lo que
 * decide si una regla está disponible es la posición en la `teachingSequence`
 * congelada por Rol B, que es un orden topológico de ese mapa. Por eso la
 * secuencia entra como parámetro: es un artefacto de contenido, y este paquete
 * no lee contenido.
 */

/**
 * Hasta dónde de la secuencia de enseñanza puede llegar una sonda de cada
 * reserva de medición, y por qué.
 *
 * `inclusive` significa que la sonda puede usar la regla del KC que mide;
 * `exclusive`, que solo puede usar reglas estrictamente anteriores;
 * `unconstrained`, que no hay techo.
 *
 * **La tabla es cerrada a propósito.** Una reserva de medición que no aparezca
 * aquí **lanza** en vez de tratarse como sin restricción: suponer que una
 * reserva nueva no tiene techo dejaría pasar en silencio justo el defecto que
 * esta guarda persigue. Es el mismo criterio que `measurementReserveFor()`.
 */
export const PROBE_RULE_HORIZON: Readonly<
  Record<string, { readonly horizon: 'inclusive' | 'unconstrained'; readonly why: string }>
> = Object.freeze({
  probes_baseline: Object.freeze({
    horizon: 'inclusive',
    why:
      'P-II §6.3 la asocia a la fase `baseline`, anterior a la intervención sobre ese KC. La ' +
      'regla del KC medido **sí** entra: que el alumno no la haya recibido todavía es justamente ' +
      'lo que la línea base mide, y un fallo por esa regla es el dato buscado. Lo que no entra es ' +
      'la regla de un KC posterior, porque entonces el fallo ya no distingue una cosa de la otra.',
  }),
  probes_intervention: Object.freeze({
    horizon: 'inclusive',
    why:
      'P-II §6.3 la asocia a la fase `intervention` del KC que mide, así que su regla ya se ' +
      'enseñó. Las de KC posteriores en la secuencia, no.',
  }),
  retention: Object.freeze({
    horizon: 'unconstrained',
    why:
      'La fase `retention` va después de la unidad: en ese momento se ha enseñado toda la ' +
      'secuencia y ninguna regla es ajena.',
  }),
  TRANSFER_MEASUREMENT: Object.freeze({
    horizon: 'unconstrained',
    why:
      'Medir transferencia es medir el uso del KC en una situación que combina lo aprendido ' +
      '(P-I §5.11). Acotar sus reglas anularía la reserva.',
  }),
});

/** Una sonda, con las reglas que su certificado usa **de verdad**. */
export interface ProbeRuleClosureInput {
  readonly itemId: string;
  /** Reserva **efectiva**: resuelve `replacement` con `effectiveReserve()` antes. */
  readonly reserve: Reserve;
  readonly targetKcId: KcId;
  /**
   * Justificaciones de las **líneas del certificado**, no el campo `rulesUsed`
   * de `FoundProof`.
   *
   * La distinción no es cosmética y ya produjo una conclusión falsa: la
   * reiteración se inserta al linealizar, así que `FoundProof.rulesUsed` **no la
   * contiene** y preguntarle concluye que ningún reactivo de KC03 usa `R`. Una
   * guarda alimentada desde ahí no vería nunca una violación por `R`.
   */
  readonly ruleIdsInCertificate: readonly string[];
}

export interface ProbeRuleClosureViolation {
  readonly itemId: string;
  readonly reserve: Reserve;
  readonly targetKcId: KcId;
  readonly targetPosition: number;
  /** Regla exigida por el certificado que todavía no se ha enseñado. */
  readonly ruleId: RuleId;
  /** KC dueño de esa regla. */
  readonly ruleKcId: KcId;
  readonly rulePosition: number;
}

/** KC dueño de cada regla, **derivado** de `KC_CATALOG` en vez de tabulado. */
function kcPorRegla(): ReadonlyMap<RuleId, KcId> {
  const mapa = new Map<RuleId, KcId>();
  for (const entrada of Object.values(KC_CATALOG)) {
    if (entrada.ruleId !== undefined) mapa.set(entrada.ruleId, entrada.kcId);
  }
  // Si el cálculo ganara una regla sin KC que la enseñe, la guarda se quedaría
  // corta en silencio: la sonda que la usara no tendría posición con la que
  // comparar y pasaría. Se prefiere que salte aquí, al construir el mapa.
  const huerfanas = AUTHORIZED_RULE_IDS.filter((r) => !mapa.has(r));
  if (huerfanas.length > 0) {
    throw new ProbeRuleClosureError(
      `Las reglas ${huerfanas.join(', ')} del cálculo autorizado no las enseña ningún KC del ` +
        `catálogo. Sin dueño no hay posición en la secuencia contra la que comprobar la clausura, ` +
        `y una sonda que las usara pasaría sin que nadie lo viera.`,
    );
  }
  return mapa;
}

/**
 * Posición de cada KC en la secuencia de enseñanza, comprobando que la
 * secuencia es completa: una secuencia parcial haría pasar por buenas las
 * sondas de los KC que le faltan.
 */
function posiciones(teachingSequence: readonly KcId[]): ReadonlyMap<KcId, number> {
  const mapa = new Map<KcId, number>();
  teachingSequence.forEach((kcId, indice) => {
    if (mapa.has(kcId)) {
      throw new ProbeRuleClosureError(`La secuencia de enseñanza repite ${kcId}.`);
    }
    mapa.set(kcId, indice);
  });
  const faltan = Object.keys(KC_CATALOG).filter((kcId) => !mapa.has(kcId as KcId));
  if (faltan.length > 0) {
    throw new ProbeRuleClosureError(
      `La secuencia de enseñanza no coloca ${faltan.join(', ')}. Comprobar la clausura contra una ` +
        `secuencia parcial daría por buenas las sondas de los KC que faltan.`,
    );
  }
  return mapa;
}

/**
 * Sondas que esta guarda **no puede juzgar**, y por qué se exponen aparte.
 *
 * Un KC sin `ruleId` —los tres de fundamento, KC01, KC02 y KC08— no enseña
 * ninguna regla, así que no hay «su regla» que incluir en el horizonte. Como
 * KC01 y KC02 abren la secuencia, *toda* derivación que se les plantee usa
 * reglas de KC posteriores: aplicarles la clausura los declararía inmedibles en
 * bloque, que es una conclusión sobre el diseño del SCED y no algo que decida
 * una guarda de reglas. §5.2.1 los trata como soporte pre-SCED (D-59).
 *
 * **Se devuelven en vez de descartarse en silencio.** Un recorte que no se
 * cuenta se lee como cobertura completa; quien llame a la guarda tiene que
 * poder fijar cuántas sondas quedaron fuera.
 */
export function probesExemptFromRuleClosure(
  probes: readonly ProbeRuleClosureInput[],
): readonly ProbeRuleClosureInput[] {
  return probes.filter(
    (sonda) =>
      isMeasurementReserve(sonda.reserve) && KC_CATALOG[sonda.targetKcId]?.ruleId === undefined,
  );
}

/**
 * Violaciones de clausura entre las sondas dadas.
 *
 * Los reactivos que no son de una reserva de medición **se ignoran**: la
 * clausura es una propiedad de las sondas. Un reactivo de enseñanza puede y
 * suele adelantar reglas —eso es el andamiaje—. Las sondas de KC sin regla
 * salen por `probesExemptFromRuleClosure()`.
 */
export function probeRuleClosureViolations(
  probes: readonly ProbeRuleClosureInput[],
  teachingSequence: readonly KcId[],
): readonly ProbeRuleClosureViolation[] {
  const posicion = posiciones(teachingSequence);
  const dueño = kcPorRegla();
  const violaciones: ProbeRuleClosureViolation[] = [];

  for (const sonda of probes) {
    if (!isMeasurementReserve(sonda.reserve)) continue;
    if (KC_CATALOG[sonda.targetKcId]?.ruleId === undefined) continue;

    const politica = PROBE_RULE_HORIZON[sonda.reserve];
    if (politica === undefined) {
      throw new ProbeRuleClosureError(
        `Ninguna política dice hasta dónde de la secuencia puede llegar una sonda de la reserva ` +
          `${sonda.reserve}. Tratarla como sin restricción dejaría pasar el defecto que esta ` +
          `guarda persigue.`,
      );
    }
    if (politica.horizon === 'unconstrained') continue;

    const posicionObjetivo = posicion.get(sonda.targetKcId);
    if (posicionObjetivo === undefined) {
      throw new ProbeRuleClosureError(
        `${sonda.itemId} declara medir ${sonda.targetKcId}, que no está en la secuencia.`,
      );
    }
    const techo = posicionObjetivo;

    for (const justificacion of new Set(sonda.ruleIdsInCertificate)) {
      // `PR` y `AS` no son reglas del cálculo sino justificaciones de línea: no
      // las enseña ningún KC y no tienen posición que comparar.
      if ((LINE_JUSTIFICATIONS as readonly string[]).includes(justificacion)) continue;
      if (!(AUTHORIZED_RULE_IDS as readonly string[]).includes(justificacion)) {
        throw new ProbeRuleClosureError(
          `${sonda.itemId} justifica una línea con «${justificacion}», que no es ni regla del ` +
            `cálculo autorizado ni justificación de línea. Saltarla supondría que es inocua.`,
        );
      }
      const regla = justificacion as RuleId;
      const kcDeLaRegla = dueño.get(regla) as KcId;
      const posicionRegla = posicion.get(kcDeLaRegla) as number;
      if (posicionRegla > techo) {
        violaciones.push({
          itemId: sonda.itemId,
          reserve: sonda.reserve,
          targetKcId: sonda.targetKcId,
          targetPosition: posicionObjetivo + 1,
          ruleId: regla,
          ruleKcId: kcDeLaRegla,
          rulePosition: posicionRegla + 1,
        });
      }
    }
  }
  return violaciones;
}

/** Igual, pero lanza. Pensado para W3: una sonda que no cierra no se acepta. */
export function assertProbeRuleClosure(
  probes: readonly ProbeRuleClosureInput[],
  teachingSequence: readonly KcId[],
): void {
  const violaciones = probeRuleClosureViolations(probes, teachingSequence);
  if (violaciones.length === 0) return;
  const detalle = violaciones
    .map(
      (v) =>
        `${v.itemId} (${v.reserve}) mide ${v.targetKcId} —posición ${v.targetPosition}— y usa ` +
        `${v.ruleId}, que enseña ${v.ruleKcId} en la posición ${v.rulePosition}`,
    )
    .join('; ');
  throw new ProbeRuleClosureError(
    `${violaciones.length} sonda(s) exigen una regla que en su fase todavía no se ha enseñado: ` +
      `${detalle}.`,
  );
}
