import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BKT_SHADOW_H5_CONFIGURATION } from '@profesor-ia/experiment';
import { describe, expect, it } from 'vitest';

import {
  assertActivationMatrix,
  assertFadingPolicy,
  assertObservableObjectives,
  assertRetrievalPlan,
  assertSelfExplanationPolicy,
  BASE_PATTERNS,
  DECISION_HIERARCHY,
  STRATEGY_CATALOG,
  type ActivationMatrix,
  type FadingRule,
  type KcId,
  type ObservableObjective,
  type SelfExplanationPolicy,
} from '../src/index.js';

/**
 * Guarda de los artefactos de Rol B (T-H5-04), materializados el 2026-08-21 con
 * `scripts/content/rolb-pedagogy-run.mjs`.
 *
 * Como en la de W2, lo que comprueba no es el estilo sino que sigan siendo una
 * política válida: que ninguna regla active ayuda en `MEASUREMENT_MODE`, que
 * los dieciocho KC conserven objetivo con evidencia observable, que la
 * secuencia respete todas las aristas del mapa y que el catálogo siga siendo la
 * proyección de `STRATEGY_CATALOG`, no una copia que pueda separarse de él.
 *
 * Las posiciones de las aristas se resuelven antes de compararse: la primera
 * versión de esta comprobación en el script leía un campo inexistente y
 * `undefined >= undefined` daba las 42 aristas por respetadas sin mirar una.
 */
const CONTENIDO = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../content/unidad-deduccion-natural',
);

function leerJsonConCabecera<T>(ruta: string): T {
  return JSON.parse(readFileSync(join(CONTENIDO, ruta), 'utf8').replace(/^(#[^\n]*\n)+/, '')) as T;
}

/**
 * Vistas tipadas de los artefactos. Los identificadores de KC se declaran como
 * `KcId` y no como `string`: el artefacto se genera desde `KC_CATALOG`, y con
 * `string` las comprobaciones que los pasan a la API del paquete no compilaban
 * —cosa que no se veía porque las pruebas no se typechequeaban—.
 */
interface MapaKc {
  readonly foundationKcs: readonly KcId[];
  readonly nodes: readonly { readonly kcId: KcId }[];
  readonly edges: readonly { readonly from: KcId; readonly to: KcId; readonly type: string }[];
}

interface ObjetivosDoc {
  readonly teachingSequence: readonly KcId[];
  readonly objectives: readonly ObservableObjective[];
}

interface SeleccionDoc extends ActivationMatrix {
  readonly basePatterns: readonly { readonly patternId: string }[];
  readonly kcProfiles: readonly {
    readonly kcId: string;
    readonly sequencePosition: number;
    readonly foundation: boolean;
  }[];
}

interface AyudasDoc {
  readonly fadingRules: readonly FadingRule[];
  readonly selfExplanation: SelfExplanationPolicy;
  readonly templates: readonly { readonly templateId: string; readonly anchoredToKc?: boolean }[];
}

interface RetrievalDoc {
  readonly blocks: readonly {
    readonly blockPosition: number;
    readonly teaches: KcId;
    readonly eligibleForRetrieval: readonly KcId[];
  }[];
  readonly eligiblePairs: number;
}

interface CatalogoDoc {
  readonly catalogSize: number;
  readonly decisionHierarchy: readonly string[];
  readonly entries: readonly { readonly catalogEntryId: string }[];
}

const mapa = leerJsonConCabecera<MapaKc>('kc/map.yaml');
const objetivosDoc = leerJsonConCabecera<ObjetivosDoc>('objectives/objectives.yaml');
const seleccion = leerJsonConCabecera<SeleccionDoc>('pedagogy/selection-rules.yaml');
const ayudas = leerJsonConCabecera<AyudasDoc>('pedagogy/assistance-policy.yaml');
const retrieval = leerJsonConCabecera<RetrievalDoc>('pedagogy/retrieval-spacing.yaml');
const catalogo = leerJsonConCabecera<CatalogoDoc>('pedagogy/strategy-catalog.yaml');
const sombra = leerJsonConCabecera<{ bktShadow: unknown }>('pedagogy/shadow-metrics.yaml');
const plantillas = leerJsonConCabecera<{ patterns: readonly { patternId: string }[] }>(
  'session-templates/base-patterns.yaml',
);

const posicion = new Map(objetivosDoc.teachingSequence.map((kcId, i) => [kcId, i + 1]));

describe('política pedagógica de Rol B materializada (T-H5-04)', () => {
  it('la secuencia cubre los dieciocho KC y respeta todas las aristas del mapa', () => {
    expect(objetivosDoc.teachingSequence).toHaveLength(mapa.nodes.length);
    expect(new Set(objetivosDoc.teachingSequence).size).toBe(mapa.nodes.length);

    expect(mapa.edges.length).toBeGreaterThan(0);
    for (const arista of mapa.edges) {
      const desde = posicion.get(arista.from);
      const hacia = posicion.get(arista.to);
      // Resolver antes de comparar: comparar con `undefined` no falla, pasa.
      expect(desde, `${arista.from} fuera de la secuencia`).toBeDefined();
      expect(hacia, `${arista.to} fuera de la secuencia`).toBeDefined();
      expect(hacia as number).toBeLessThan(desde as number);
    }
  });

  it('los dieciocho KC conservan objetivo con evidencia observable', () => {
    expect(() =>
      assertObservableObjectives(objetivosDoc.objectives, objetivosDoc.teachingSequence),
    ).not.toThrow();
    expect(objetivosDoc.objectives).toHaveLength(mapa.nodes.length);
  });

  it('ninguna regla de activación enciende ayuda en MEASUREMENT_MODE', () => {
    expect(() => assertActivationMatrix(seleccion)).not.toThrow();
    expect(seleccion.rules.every((r) => !r.modes.includes('MEASUREMENT_MODE'))).toBe(true);
  });

  it('las doce entradas del catálogo tienen regla, y el catálogo es la proyección del módulo', () => {
    const conRegla = new Set<string>(seleccion.rules.map((r) => r.catalogEntryId));
    for (const entrada of STRATEGY_CATALOG) {
      expect(conRegla.has(entrada.catalogEntryId), entrada.catalogEntryId).toBe(true);
    }
    expect(catalogo.catalogSize).toBe(STRATEGY_CATALOG.length);
    expect(catalogo.entries.map((e) => e.catalogEntryId)).toEqual(
      STRATEGY_CATALOG.map((e) => e.catalogEntryId),
    );
    expect(catalogo.decisionHierarchy).toEqual([...DECISION_HIERARCHY]);
  });

  it('el fading es contingente y la autoexplicación es selectiva y anclada al KC', () => {
    expect(() => assertFadingPolicy(ayudas.fadingRules)).not.toThrow();
    expect(ayudas.fadingRules.every((r) => !r.triggeredByFixedTimeOrCount)).toBe(true);
    expect(() => assertSelfExplanationPolicy(ayudas.selfExplanation)).not.toThrow();
    expect(ayudas.templates.find((t) => t.templateId.includes('autoexplicacion'))?.anchoredToKc).toBe(
      true,
    );
  });

  it('el plan de retrieval solo ofrece KC ya introducidos y no toca la reserva de medición', () => {
    const pares = retrieval.blocks.flatMap((bloque) =>
      bloque.eligibleForRetrieval.map((kcId) => ({
        kcId,
        alreadyIntroduced: (posicion.get(kcId) as number) < bloque.blockPosition,
        usesMeasurementReserve: false,
      })),
    );
    expect(pares).toHaveLength(retrieval.eligiblePairs);
    expect(() => assertRetrievalPlan(pares)).not.toThrow();
    // El primer bloque no ofrece nada: no hay KC introducido todavía.
    expect(retrieval.blocks[0]?.eligibleForRetrieval).toEqual([]);
  });

  it('las plantillas de sesión son los cinco patrones base, sin inventarles estrategia', () => {
    expect(plantillas.patterns.map((p) => p.patternId)).toEqual(
      BASE_PATTERNS.map((p) => p.patternId),
    );
    expect(seleccion.basePatterns.map((p) => p.patternId)).toEqual(
      BASE_PATTERNS.map((p) => p.patternId),
    );
  });

  it('BKT sombra sigue congelado en deshabilitado, sin parámetros ni autoridad', () => {
    expect(sombra.bktShadow).toEqual({ ...BKT_SHADOW_H5_CONFIGURATION });
  });

  it('los perfiles por KC no inventan tipos de conocimiento y marcan los fundamentos', () => {
    const fundamentos = seleccion.kcProfiles.filter((p) => p.foundation).map((p) => p.kcId);
    expect(fundamentos).toEqual([...mapa.foundationKcs]);
    expect(seleccion.kcProfiles.every((p) => !('knowledgeType' in p))).toBe(true);
  });
});
