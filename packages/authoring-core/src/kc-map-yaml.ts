import { AUTHORIZED_CALCULUS_VERSION } from '@profesor-ia/logic-core';
import {
  FOUNDATION_KCS,
  KC_CATALOG,
  KC_IDS,
  kcEdges,
  type DependencyType,
} from './kc-map.js';

/**
 * Documento `kc/map.yaml` (T-H5-03): el mapa de KC **materializado** desde
 * `KC_CATALOG`.
 *
 * El catálogo vive en código porque sus entradas son literales del Maestro
 * (P-I §5.2) y sus `ruleId` se derivan de `logic-core`. El archivo en
 * `content/` es una **proyección** de ese catálogo: lo escribe
 * `scripts/content/kc-map-write.mjs` y lo vigila la prueba de deriva
 * `kc-map-artifact.test.ts`, que exige igualdad profunda con este documento.
 * Quien edite el YAML a mano rompe la prueba, que es exactamente para lo que
 * está: el mapa se cambia en el catálogo o no se cambia.
 */

export const KC_MAP_VERSION = 'kc-map-v1' as const;

export interface KcMapDocument {
  readonly mapVersion: typeof KC_MAP_VERSION;
  readonly provenance: string;
  readonly authorizedCalculusVersion: string;
  /** Fundamentos pre-SCED (DEC-FOUNDATION-001): nunca objetivo de A/B/C. */
  readonly foundationKcs: readonly string[];
  readonly nodes: readonly {
    readonly kcId: string;
    readonly name: string;
    readonly stage1Status: string;
    readonly ruleId?: string;
    readonly dependencies: readonly { readonly on: string; readonly type: DependencyType }[];
    readonly conditions?: readonly string[];
  }[];
  /** Todas las aristas en orden determinista; las cruzadas se enumeran con conjuntos (W3). */
  readonly edges: readonly { readonly from: string; readonly to: string; readonly type: DependencyType }[];
}

export function kcMapDocument(): KcMapDocument {
  return {
    mapVersion: KC_MAP_VERSION,
    provenance:
      'Transcripción literal del catálogo KC01–KC18 del Maestro (P-I §5.2) tal como vive en ' +
      'packages/authoring-core/src/kc-map.ts (KC_CATALOG). Generado por kcMapDocument(); no se ' +
      'edita a mano — la prueba kc-map-artifact exige igualdad profunda con el catálogo.',
    authorizedCalculusVersion: AUTHORIZED_CALCULUS_VERSION,
    foundationKcs: [...FOUNDATION_KCS],
    nodes: KC_IDS.map((kcId) => {
      const entrada = KC_CATALOG[kcId];
      return {
        kcId: entrada.kcId,
        name: entrada.name,
        stage1Status: entrada.stage1Status,
        ...(entrada.ruleId !== undefined ? { ruleId: entrada.ruleId } : {}),
        dependencies: entrada.dependencies.map((d) => ({ on: d.on, type: d.type })),
        ...(entrada.conditions !== undefined ? { conditions: [...entrada.conditions] } : {}),
      };
    }),
    edges: kcEdges().map((e) => ({ from: e.from, to: e.to, type: e.type })),
  };
}
