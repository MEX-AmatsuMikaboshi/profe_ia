#!/usr/bin/env node
/**
 * Escribe `kc/map.yaml` desde `KC_CATALOG` (T-H5-03).
 *
 * Uso: node scripts/content/kc-map-write.mjs
 *
 * El mapa es una proyección del catálogo que vive en código
 * (`packages/authoring-core/src/kc-map.ts`, literal del Maestro P-I §5.2).
 * No se edita a mano: la prueba `kc-map-artifact.test.ts` exige igualdad
 * profunda con `kcMapDocument()`. JSON con cabecera de comentario, que es
 * YAML 1.2 válido (misma convención que `research/`).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kcMapDocument } from '../../packages/authoring-core/dist/index.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DESTINO = join(RAIZ, 'content/unidad-deduccion-natural/kc/map.yaml');

const documento = kcMapDocument();
writeFileSync(
  DESTINO,
  `# Mapa de conocimiento KC01–KC18 (T-H5-03, P-I §5.2). Generado por scripts/content/kc-map-write.mjs desde KC_CATALOG — no se edita a mano; la prueba kc-map-artifact exige igualdad profunda con el catálogo.\n` +
    `${JSON.stringify(documento, null, 2)}\n`,
);
console.log(
  `escrito: kc/map.yaml — ${documento.nodes.length} nodos, ${documento.edges.length} aristas, ` +
    `fundamentos ${documento.foundationKcs.join('/')}`,
);
