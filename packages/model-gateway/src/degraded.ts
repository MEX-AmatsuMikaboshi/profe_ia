import type { ModelOperation } from '@profesor-ia/contracts';
import { FrozenAssetMissingError, LiveGenerationDisabledError } from './errors.js';

/**
 * Modo degradado (T-H4-12 ← P-II §8.6).
 *
 * «Debe existir un perfil **sin generación en vivo**» que use explicaciones,
 * ejemplos y pistas **congelados** y retroalimentación plantillada. Sirve para
 * pruebas secas, continuidad ante caída, comparación técnica y —la razón que
 * más obliga a que no invente nada— **aislar si el fallo viene del modelo o del
 * núcleo**.
 *
 * Ese último uso es el que fija el diseño: si el modo degradado rellenara un
 * hueco con texto generado o genérico, dejaría de servir como control. Por eso
 * un activo congelado que falta **lanza** en vez de devolver un texto de
 * relleno: un relleno haría pasar por «el núcleo respondió» algo que en realidad
 * no estaba.
 */

/** Las cuatro clases literales de §8.6. */
export const FROZEN_ASSET_KINDS = ['explicacion', 'ejemplo', 'pista', 'feedback'] as const;
export type FrozenAssetKind = (typeof FROZEN_ASSET_KINDS)[number];

export interface FrozenAsset {
  readonly kind: FrozenAssetKind;
  readonly key: string;
  readonly text: string;
  /** Versión del freeze de la que sale, para que la comparación sea trazable. */
  readonly freezeVersion: string;
}

/** Plantilla de retroalimentación: huecos con nombre, sin lógica ni generación. */
export interface FeedbackTemplate {
  readonly key: string;
  readonly template: string;
  readonly freezeVersion: string;
}

export interface DegradedProfileOptions {
  readonly assets: readonly FrozenAsset[];
  readonly feedbackTemplates: readonly FeedbackTemplate[];
}

export class DegradedProfile {
  readonly #assets = new Map<string, FrozenAsset>();
  readonly #templates = new Map<string, FeedbackTemplate>();

  constructor(options: DegradedProfileOptions) {
    for (const asset of options.assets) {
      this.#assets.set(`${asset.kind}:${asset.key}`, asset);
    }
    for (const template of options.feedbackTemplates) {
      this.#templates.set(template.key, template);
    }
  }

  /**
   * Devuelve el activo congelado. **No genera nada** y no tiene texto por
   * omisión: si falta, lanza. Ver la nota de arriba sobre el aislamiento del
   * fallo.
   */
  asset(kind: FrozenAssetKind, key: string): FrozenAsset {
    const asset = this.#assets.get(`${kind}:${key}`);
    if (asset === undefined) {
      throw new FrozenAssetMissingError(
        `No hay ${kind} congelada para la clave ${key}. El modo degradado no rellena huecos: un ` +
          `texto de relleno haría pasar por «el núcleo respondió» algo que no estaba, y el perfil ` +
          `dejaría de servir para aislar si el fallo viene del modelo o del núcleo (P-II §8.6).`,
      );
    }
    return asset;
  }

  /**
   * Rellena una plantilla. Un hueco sin valor es un fallo, no una cadena vacía:
   * `«Te falta {paso}»` con `{paso}` vacío es una frase que el alumno leería
   * como si estuviera completa.
   */
  feedback(key: string, values: Readonly<Record<string, string>>): string {
    const plantilla = this.#templates.get(key);
    if (plantilla === undefined) {
      throw new FrozenAssetMissingError(
        `No hay plantilla de retroalimentación para la clave ${key}.`,
      );
    }

    return plantilla.template.replace(/\{(\w+)\}/g, (_coincidencia, hueco: string) => {
      const valor = values[hueco];
      if (valor === undefined) {
        throw new FrozenAssetMissingError(
          `La plantilla ${key} tiene el hueco {${hueco}} sin valor. Un hueco vacío produciría una ` +
            `frase que el alumno leería como completa.`,
        );
      }
      return valor;
    });
  }

  /**
   * Puerta que sustituye a la llamada al proveedor mientras el perfil está
   * activo. Siempre lanza: el modo degradado **es** «sin generación en vivo», y
   * una versión que dejara pasar la llamada bajo alguna condición convertiría el
   * perfil en una preferencia.
   */
  assertNoLiveGeneration(operation: ModelOperation): never {
    throw new LiveGenerationDisabledError(
      `El perfil degradado está activo: la operación ${operation} no llama al proveedor. Usa los ` +
        `activos congelados y la retroalimentación plantillada (P-II §8.6).`,
    );
  }

  size(): { readonly assets: number; readonly templates: number } {
    return { assets: this.#assets.size, templates: this.#templates.size };
  }
}

/**
 * Conmutador entre generación en vivo y perfil degradado (§8.6: «conmutable»).
 *
 * El estado es explícito y se consulta antes de cada operación facturable; no
 * hay conmutación automática por error del proveedor, porque caer solo a modo
 * degradado ante un fallo escondería el fallo justo cuando el perfil existe
 * para poder atribuirlo.
 */
export class GatewayMode {
  #degraded: DegradedProfile | null = null;

  enableDegraded(profile: DegradedProfile): void {
    this.#degraded = profile;
  }

  enableLive(): void {
    this.#degraded = null;
  }

  isDegraded(): boolean {
    return this.#degraded !== null;
  }

  /** El perfil activo, o `null` si la pasarela está en vivo. */
  degradedProfile(): DegradedProfile | null {
    return this.#degraded;
  }
}
