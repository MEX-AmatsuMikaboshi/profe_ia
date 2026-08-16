import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { COMMANDS, NOT_IMPLEMENTED_EXIT_CODE, USAGE_EXIT_CODE, run } from '../src/index.js';

describe('CLI profesor-ia (T-H0-07)', () => {
  it('expone los cuatro comandos del plan', () => {
    expect(COMMANDS.map((c) => c.path.join(' ')).sort()).toEqual([
      'content validate',
      'experiment freeze',
      'ledger verify',
      'restore drill',
    ]);
  });

  it.each(COMMANDS.filter((c) => c.path.join(' ') !== 'content validate').map((c) => c.path.join(' ')))(
    '«%s» falla explícitamente, no simula éxito',
    (cmd) => {
    const result = run(cmd.split(' '));
    expect(result.exitCode).toBe(NOT_IMPLEMENTED_EXIT_CODE);
    expect(result.stderr).toContain('NO_IMPLEMENTADO');
    },
  );

  it('content validate ejecuta el linter y falla si solo hay placeholders', () => {
    const directory = mkdtempSync(join(tmpdir(), 'profesor-ia-empty-'));
    const result = run(['content', 'validate', directory]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('falta');
  });

  it('content validate enumera fallos de un manifiesto incompleto', () => {
    const directory = mkdtempSync(join(tmpdir(), 'profesor-ia-invalid-'));
    writeFileSync(join(directory, 'lint-input.json'), JSON.stringify({ packageVersion: '' }));
    const result = run(['content', 'validate', directory]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('ilegible o incompleto');
  });

  it('un comando desconocido no se interpreta como éxito', () => {
    expect(run(['freeze', 'todo']).exitCode).toBe(USAGE_EXIT_CODE);
  });
});
