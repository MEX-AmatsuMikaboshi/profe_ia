import {
  CostEvent,
  PricingUnit,
  type PricingEntry,
  type PricingManifest,
} from '@profesor-ia/contracts';
import {
  CurrencyMismatchError,
  ManifestNotEffectiveError,
  ManifestRewriteError,
  MissingPricingEntryError,
  UnknownPricingManifestError,
} from './errors.js';

/**
 * `pricing-manifest` + `cost-ledger` (T-H4-06 ← `DEC-COST-001`, P-II §9.5).
 *
 * «El costo no se reconstruye a partir de precios actuales ni de estimaciones
 * globales.» De ahí las dos reglas duras de este módulo:
 *
 * 1. **Un cambio de tarifa crea un manifiesto nuevo y nunca reescribe costos.**
 *    Registrar contenido distinto bajo un `pricing_manifest_id` ya usado es
 *    `ManifestRewriteError`, no una actualización.
 * 2. **Una tarifa que falta no vale cero.** Sin entrada para una unidad
 *    facturada se lanza en vez de sumar 0, porque un cero fabricado haría que el
 *    gasto pareciera menor del real justo donde el gate de presupuesto mira.
 */

/** Unidades consumidas por una llamada. Los reintentos y fallos **cuentan**. */
export interface CallUsage {
  readonly provider: string;
  readonly modelId: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
  readonly audioSeconds: number;
  readonly images: number;
  readonly requests: number;
}

export interface PricedCall {
  readonly costCalculated: number;
  readonly currency: string;
  readonly pricingManifestId: string;
}

/** Cantidad facturada por unidad, en el orden fijo del contrato. */
function cantidadPorUnidad(usage: CallUsage, unit: PricingUnit): number {
  switch (unit) {
    case 'input_token':
      return usage.inputTokens;
    case 'output_token':
      return usage.outputTokens;
    case 'cached_input_token':
      return usage.cachedInputTokens;
    case 'audio_second':
      return usage.audioSeconds;
    case 'image':
      return usage.images;
    case 'request':
      return usage.requests;
  }
}

/**
 * Calcula el costo de una llamada con **el manifiesto vigente en esa fecha**.
 *
 * Recorre las unidades en el orden fijo de `PricingUnit`, no en el orden en que
 * vengan las entradas del manifiesto: así el resultado no depende de cómo se
 * escribió el manifiesto y dos manifiestos equivalentes dan el mismo número.
 *
 * No redondea. Ninguna autoridad fija una política de redondeo, y aplicar una
 * por cuenta propia cambiaría cifras de gasto que después alimentan un gate.
 */
export function priceCall(manifest: PricingManifest, usage: CallUsage): PricedCall {
  const aplicables = manifest.entries.filter(
    (e) => e.provider === usage.provider && e.modelId === usage.modelId,
  );

  const monedas = new Set(aplicables.map((e) => e.currency));
  if (monedas.size > 1) {
    throw new CurrencyMismatchError(
      `El manifiesto ${manifest.pricingManifestId} mezcla ${[...monedas].join(', ')} para ` +
        `${usage.provider}/${usage.modelId}. No hay conversión implícita (P-II §9.5).`,
    );
  }

  let total = 0;
  let currency: string | undefined;

  for (const unit of PricingUnit.options) {
    const cantidad = cantidadPorUnidad(usage, unit);
    if (cantidad === 0) continue;

    const entrada: PricingEntry | undefined = aplicables.find((e) => e.unit === unit);
    if (entrada === undefined) {
      throw new MissingPricingEntryError(
        `El manifiesto ${manifest.pricingManifestId} no declara tarifa de ${unit} para ` +
          `${usage.provider}/${usage.modelId}, y se facturaron ${cantidad}. Una tarifa que falta ` +
          `no vale cero: un cero fabricado haría parecer el gasto menor del real.`,
      );
    }

    total += entrada.unitPrice * cantidad;
    currency = entrada.currency;
  }

  if (currency === undefined) {
    // Sin unidades facturadas no hay moneda que deducir; se toma la del
    // manifiesto para ese modelo, que es un hecho declarado y no una suposición.
    const primera = aplicables[0];
    if (primera === undefined) {
      throw new MissingPricingEntryError(
        `El manifiesto ${manifest.pricingManifestId} no declara ninguna tarifa para ` +
          `${usage.provider}/${usage.modelId}.`,
      );
    }
    currency = primera.currency;
  }

  return { costCalculated: total, currency, pricingManifestId: manifest.pricingManifestId };
}

/**
 * Ledger de costos. Es **append-only**: no expone actualización ni borrado, del
 * mismo modo que el esquema `evidence` de la base (I-6). Una corrección sería un
 * evento nuevo, no la reescritura de uno viejo.
 */
export class CostLedger {
  readonly #manifiestos = new Map<string, PricingManifest>();
  readonly #eventos: CostEvent[] = [];

  /**
   * Registra un manifiesto. Volver a registrar el **mismo** contenido bajo el
   * mismo id es idempotente; registrar contenido **distinto** bajo un id ya
   * usado es un intento de reescribir la historia y falla.
   */
  registerManifest(manifest: PricingManifest): void {
    const previo = this.#manifiestos.get(manifest.pricingManifestId);
    if (previo !== undefined) {
      if (JSON.stringify(previo) !== JSON.stringify(manifest)) {
        throw new ManifestRewriteError(
          `El manifiesto ${manifest.pricingManifestId} ya está registrado con otro contenido. ` +
            `Un cambio de tarifa crea un pricing_manifest_id nuevo; nunca reescribe el histórico ` +
            `(P-II §9.5, DEC-COST-001).`,
        );
      }
      return;
    }
    this.#manifiestos.set(manifest.pricingManifestId, manifest);
  }

  manifest(pricingManifestId: string): PricingManifest {
    const manifiesto = this.#manifiestos.get(pricingManifestId);
    if (manifiesto === undefined) {
      throw new UnknownPricingManifestError(
        `No hay manifiesto registrado con id ${pricingManifestId}.`,
      );
    }
    return manifiesto;
  }

  /**
   * Añade un evento de costo. Comprueba que su manifiesto existe y que **ya
   * estaba vigente** cuando ocurrió la llamada: cobrar con una tarifa futura
   * sería reconstruir el costo con precios actuales, que es lo primero que
   * §9.5 prohíbe.
   */
  append(event: CostEvent): CostEvent {
    const parsed = CostEvent.parse(event);
    const manifiesto = this.manifest(parsed.pricingManifestId);

    if (Date.parse(parsed.occurredAt) < Date.parse(manifiesto.effectiveFrom)) {
      throw new ManifestNotEffectiveError(
        `El evento ocurrió en ${parsed.occurredAt} y el manifiesto ` +
          `${manifiesto.pricingManifestId} rige desde ${manifiesto.effectiveFrom}. El costo se ` +
          `registra con la tarifa vigente ese día, no con la actual (P-II §9.5).`,
      );
    }

    this.#eventos.push(parsed);
    return parsed;
  }

  /** Los eventos en orden de llegada. Copia: el ledger no se muta desde fuera. */
  events(): readonly CostEvent[] {
    return Object.freeze([...this.#eventos]);
  }

  /**
   * Suma por moneda. **No convierte** entre monedas: §9.5 no autoriza ninguna
   * tasa de cambio, e inventar una produciría un total que parece comparable y
   * no lo es.
   */
  totalsByCurrency(): ReadonlyMap<string, number> {
    const totales = new Map<string, number>();
    for (const evento of this.#eventos) {
      totales.set(evento.currency, (totales.get(evento.currency) ?? 0) + evento.costCalculated);
    }
    return totales;
  }
}
