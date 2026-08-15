// @profesor-ia/ui-tokens — sistema visual de referencia v0.1 (Plan.md T-H0-09, §7.1).
//
// Los tokens se **vendorizan** desde el ZIP de mockups verificado; no se
// reconstruyen a mano (§0.2.3). Ninguna clase del design system altera
// comportamiento: la paleta puede iterar dentro de la UIUX sin tocar el Maestro.
//
// Consumo del CSS desde apps/web:  import '@profesor-ia/ui-tokens/styles.css';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_NAME = '@profesor-ia/ui-tokens' as const;

export const TOKENS_VENDORED = true;

/** Hashes del material vendorizado; el drift se detecta en pruebas. */
export const VENDOR_SHA256 = {
  'styles.css': 'cf9fcf75ac84dfe7517177eb14acf5a20ca4410c55691ab9879c6af7b2168400',
  'ds-manifest.json': '5a5662c539da3adb56123284636f7ab1a505ed0cd05bed3e38db93894bc5875e',
} as const;

/** SHA-256 del artefacto UX declarado por la UIUX (Plan.md §0.1), verificado. */
export const UX_ARTIFACT_SHA256 =
  'e1e1b730ec8516158e3318367b5d6005246a3865baf444f1cfa73918d46229a0' as const;

const VENDOR_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor');

export const vendorPath = (file: keyof typeof VENDOR_SHA256): string => join(VENDOR_DIR, file);

export interface DesignToken {
  readonly name: string;
  readonly value: string;
  readonly kind: string;
  readonly definedIn: string;
}

/**
 * Lee los tokens del manifiesto vendorizado. Uso en herramientas y pruebas
 * (Node); la app consume el CSS directamente.
 */
export function loadDesignTokens(): readonly DesignToken[] {
  const manifest = JSON.parse(readFileSync(vendorPath('ds-manifest.json'), 'utf8')) as {
    tokens?: DesignToken[];
  };
  return manifest.tokens ?? [];
}

/** CSS crudo vendorizado, sin transformar. */
export function tokensCss(): string {
  return readFileSync(vendorPath('styles.css'), 'utf8');
}
