import type { PricingEntry, PricingManifest } from '@profesor-ia/contracts';

/**
 * Manifiesto de precios con tarifas reales (T-H4-10 ← DEC-COST-001, P-II §9.5).
 *
 * ## Por qué está en MXN y no en USD
 *
 * El gate de presupuesto (T-H4-07) agrega **por moneda y no convierte**:
 * `accumulatedMxn()` lee la cubeta `MXN` del ledger y las demás monedas no se
 * suman. Los proveedores facturan en USD. Con un manifiesto en USD, cada
 * llamada se registraría en la cubeta USD, la cubeta MXN quedaría en cero y el
 * bloqueo duro de MXN 700 **no observaría nada**: sería un freno desconectado.
 *
 * El Maestro congela las cifras en MXN y los proveedores cobran en USD; la
 * costura entre ambos no la resuelve ninguna autoridad. Decisión del
 * propietario (2026-08-18): registrar en MXN convirtiendo con un tipo de cambio
 * **declarado con fuente**, en vez de dejar el gate ciego o endurecerlo por
 * cuenta propia.
 *
 * ## Por qué la conversión se hace aquí y no a mano
 *
 * Los precios en MXN son números **derivados**. Escribirlos ya multiplicados
 * dejaría en el archivo una cifra que no se puede contrastar con ninguna
 * fuente. Aquí quedan los dos factores tal como los publica quien los publica
 * —el precio en USD del proveedor y el FIX de Banxico— y la multiplicación es
 * código, revisable y probado. No hay ningún número inventado en el camino.
 *
 * ## Lo que no hace
 *
 * No consulta a nadie. Igual que `documentary-refresh.ts`, registrar es una
 * cosa y averiguar es otra: las cifras las leyó una persona de la página del
 * proveedor y quedan aquí con su URL y su fecha. Un módulo que fuera a buscar
 * el precio estaría produciendo la evidencia que dice registrar.
 *
 * Un cambio de tarifa **no se edita aquí**: produce un `pricingManifestId`
 * nuevo, porque el ledger es append-only y reescribir un manifiesto ya usado
 * reescribiría costos ya registrados (`ci:cost:ledger`).
 */

/** Precio publicado por el proveedor, en USD por millón de tokens. */
interface UsdPricePerMillionTokens {
  readonly provider: string;
  readonly modelId: string;
  readonly input: number;
  readonly output: number;
  /** Lectura de caché. `undefined` cuando el proveedor no la tarifa aparte. */
  readonly cachedInput?: number;
}

/**
 * Tipo de cambio FIX del Banco de México, en MXN por USD.
 *
 * FIX y no el tipo de la tarjeta a propósito: el saldo del propietario está
 * **prepagado** en cada proveedor, así que en el momento de la llamada no hay
 * ninguna conversión real que replicar. El FIX es la referencia pública y
 * fechada que permite al gate en MXN juzgar un gasto en USD.
 */
export const FIX_MXN_PER_USD = 17.0245 as const;

export const FIX_SOURCE =
  'Banco de México, tipo de cambio FIX determinado el 2026-08-17, ' +
  'https://www.banxico.org.mx/tipcamb/llenarTiposCambioAction.do?idioma=sp';

/** Tarifas leídas de la documentación de Anthropic el 2026-08-18. */
export const ANTHROPIC_SOURCE =
  'Anthropic, «Pricing», leída el 2026-08-18, ' +
  'https://platform.claude.com/docs/en/about-claude/pricing';

/** Tarifas leídas de la documentación de OpenAI el 2026-08-18. */
export const OPENAI_SOURCE =
  'OpenAI, «Pricing», leída el 2026-08-18, https://developers.openai.com/api/docs/pricing';

/**
 * Precios publicados, en USD por millón de tokens, tal como aparecen en las
 * páginas citadas. **No se editan para redondear**: si una cifra no coincide
 * con la fuente, la que está mal es esta lista.
 */
export const PUBLISHED_USD_PRICES: readonly UsdPricePerMillionTokens[] = [
  // Anthropic — precio base de entrada, salida, y lectura de caché (0.1x entrada).
  // Id **fechado**, que es el que lleva el binding: tarifar por el alias dejaría
  // la tarifa sin encontrar y `priceCall` lanzaría en mitad de la corrida.
  {
    provider: 'anthropic',
    modelId: 'claude-haiku-4-5-20251001',
    input: 1,
    output: 5,
    cachedInput: 0.1,
  },
  { provider: 'anthropic', modelId: 'claude-sonnet-5', input: 2, output: 10, cachedInput: 0.2 },
  // OpenAI — entrada, entrada cacheada y salida.
  { provider: 'openai', modelId: 'gpt-5.6-luna', input: 0.2, output: 1.2, cachedInput: 0.02 },
  { provider: 'openai', modelId: 'gpt-5', input: 1.25, output: 10, cachedInput: 0.125 },
] as const;

const TOKENS_PER_MILLION = 1_000_000;

/** Convierte un precio por millón de tokens en USD a precio por token en MXN. */
export function mxnPerToken(usdPerMillionTokens: number, fixMxnPerUsd: number): number {
  return (usdPerMillionTokens * fixMxnPerUsd) / TOKENS_PER_MILLION;
}

function entriesFor(precio: UsdPricePerMillionTokens, fix: number): PricingEntry[] {
  const entradas: PricingEntry[] = [
    {
      provider: precio.provider,
      modelId: precio.modelId,
      unit: 'input_token',
      unitPrice: mxnPerToken(precio.input, fix),
      currency: 'MXN',
    },
    {
      provider: precio.provider,
      modelId: precio.modelId,
      unit: 'output_token',
      unitPrice: mxnPerToken(precio.output, fix),
      currency: 'MXN',
    },
  ];
  if (precio.cachedInput !== undefined) {
    entradas.push({
      provider: precio.provider,
      modelId: precio.modelId,
      unit: 'cached_input_token',
      unitPrice: mxnPerToken(precio.cachedInput, fix),
      currency: 'MXN',
    });
  }
  return entradas;
}

/**
 * El manifiesto vigente. El id lleva la fecha de las fuentes **y** el FIX
 * aplicado: dos manifiestos con los mismos precios en USD y distinto tipo de
 * cambio son manifiestos distintos, y confundirlos mezclaría costos que no son
 * comparables.
 */
export const PRICING_MANIFEST_2026_08_18: PricingManifest = {
  pricingManifestId: 'pm-2026-08-18-fix-17.0245',
  effectiveFrom: '2026-08-18T00:00:00+00:00',
  sourceEvidence: [
    `Tipo de cambio: ${FIX_SOURCE}, ${String(FIX_MXN_PER_USD)} MXN/USD.`,
    `Tarifas Anthropic: ${ANTHROPIC_SOURCE}.`,
    `Tarifas OpenAI: ${OPENAI_SOURCE}.`,
    'Los precios en MXN son derivados: precio publicado en USD por millón de tokens × FIX ÷ 1e6.',
  ].join(' '),
  entries: PUBLISHED_USD_PRICES.flatMap((precio) => entriesFor(precio, FIX_MXN_PER_USD)),
};
