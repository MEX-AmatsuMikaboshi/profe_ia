import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  TOKENS_VENDORED,
  VENDOR_SHA256,
  loadDesignTokens,
  tokensCss,
  vendorPath,
} from '../src/index.js';

describe('vendorizado del design system (T-H0-09)', () => {
  it('los archivos vendorizados no derivaron de su origen verificado', () => {
    for (const [file, expected] of Object.entries(VENDOR_SHA256)) {
      const actual = createHash('sha256')
        .update(readFileSync(vendorPath(file as keyof typeof VENDOR_SHA256)))
        .digest('hex');
      expect(actual, `${file} cambió respecto al material vendorizado`).toBe(expected);
    }
  });

  it('declara los tokens vendorizados en lugar de reconstruirlos', () => {
    expect(TOKENS_VENDORED).toBe(true);
    const tokens = loadDesignTokens();
    expect(tokens.length).toBeGreaterThan(40);
    const names = tokens.map((t) => t.name);
    expect(names).toContain('--color-accent');
    expect(names).toContain('--font-heading');
    expect(names).toContain('--space-4');
  });

  it('conserva la dirección visual congelable: radios en 0 (§7.1)', () => {
    const radii = loadDesignTokens().filter((t) => t.kind === 'radius');
    expect(radii.length).toBeGreaterThan(0);
    for (const r of radii) expect(r.value).toBe('0px');
  });

  it('el CSS se expone tal cual, sin transformar', () => {
    expect(tokensCss()).toContain('--color-accent');
  });
});
