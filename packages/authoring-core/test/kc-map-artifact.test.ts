import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { kcMapDocument } from '../src/index.js';

/**
 * Guarda de deriva del artefacto `content/unidad-deduccion-natural/kc/map.yaml`
 * (T-H5-03): el mapa materializado debe ser exactamente la proyección de
 * `KC_CATALOG`. Quien edite el YAML a mano rompe esta prueba, que es para lo
 * que está: el mapa se cambia en el catálogo o no se cambia.
 *
 * Mismo patrón que los golden tests, que ya leen de `content/`.
 */
const MAP_YAML = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../content/unidad-deduccion-natural/kc/map.yaml',
);

function leerMapYaml(): unknown {
  const crudo = readFileSync(MAP_YAML, 'utf8');
  return JSON.parse(crudo.replace(/^(#[^\n]*\n)+/, ''));
}

describe('kc/map.yaml materializado (T-H5-03)', () => {
  it('es exactamente la proyección de KC_CATALOG: igualdad profunda', () => {
    expect(leerMapYaml()).toEqual(kcMapDocument());
  });

  it('trae los dieciocho nodos y marca los fundamentos pre-SCED', () => {
    const doc = leerMapYaml() as ReturnType<typeof kcMapDocument>;
    expect(doc.nodes).toHaveLength(18);
    expect(doc.foundationKcs).toEqual(['KC01', 'KC02', 'KC08']);
  });
});
