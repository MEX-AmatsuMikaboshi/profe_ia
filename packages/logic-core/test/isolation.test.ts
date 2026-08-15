import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { verify } from '../src/verify.js';

/**
 * `ci:logic:no-net` — propiedades de aislamiento del núcleo (Plan.md T-H2-15).
 *
 * El verificador es una función pura, sin red, sin datos personales y
 * reproducible. La regla `i3-verifier-sin-red` de dependency-cruiser cubre el
 * grafo de módulos; aquí se comprueba el código fuente y el comportamiento.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? sourceFiles(full) : full.endsWith('.ts') ? [full] : [];
  });
}

describe('el núcleo lógico no tiene red', () => {
  const files = sourceFiles(SRC);

  it('encuentra los módulos del paquete', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each([
    ['fetch(', /\bfetch\s*\(/],
    ['XMLHttpRequest', /XMLHttpRequest/],
    ['node:http', /node:https?/],
    ['node:net', /node:(net|tls|dgram)/],
    ['WebSocket', /WebSocket/],
    ['child_process', /child_process/],
  ])('ningún módulo usa %s', (_label, pattern) => {
    const offenders = files.filter((f) => pattern.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('ningún módulo lee el entorno ni el reloj para decidir', () => {
    const offenders = files.filter((f) => {
      const src = readFileSync(f, 'utf8');
      return /process\.env|Date\.now\(|Math\.random\(/.test(src);
    });
    expect(offenders).toEqual([]);
  });
});

describe('el verificador es una función pura', () => {
  const proof = {
    lines: [
      { formula: 'A∧B', rule: 'PR', depth: 0 },
      { formula: 'B', rule: '∧E', refs: [1], depth: 0 },
    ],
    goal: 'B',
  };

  it('no muta su entrada', () => {
    const snapshot = JSON.stringify(proof);
    verify(proof);
    expect(JSON.stringify(proof)).toBe(snapshot);
  });

  it('da el mismo resultado en llamadas sucesivas', () => {
    const results = Array.from({ length: 5 }, () => JSON.stringify(verify(proof)));
    expect(new Set(results).size).toBe(1);
  });

  it('no propaga datos personales: el resultado solo contiene lógica y versiones', () => {
    const result = verify(proof);
    expect(Object.keys(result).sort()).toEqual(
      [
        'authorizedCalculusVersion',
        'errors',
        'goalReached',
        'semanticCheck',
        'valid',
        'verifierVersion',
      ].sort(),
    );
  });
});
