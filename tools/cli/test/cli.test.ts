import { describe, expect, it } from 'vitest';
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

  it.each(COMMANDS.map((c) => c.path.join(' ')))('«%s» falla explícitamente, no simula éxito', (cmd) => {
    const result = run(cmd.split(' '));
    expect(result.exitCode).toBe(NOT_IMPLEMENTED_EXIT_CODE);
    expect(result.stderr).toContain('NO_IMPLEMENTADO');
  });

  it('un comando desconocido no se interpreta como éxito', () => {
    expect(run(['freeze', 'todo']).exitCode).toBe(USAGE_EXIT_CODE);
  });
});
