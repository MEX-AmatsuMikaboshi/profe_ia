// CLI `profesor-ia` (Plan.md T-H0-07). Los comandos no implementados fallan
// explícitamente; `content validate` dejó de ser stub en T-H5-13.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  lintContentPackage,
  type PackageLintFacts,
} from '@profesor-ia/authoring-core';

export const NOT_IMPLEMENTED_EXIT_CODE = 3;
export const VALIDATION_FAILED_EXIT_CODE = 2;
export const USAGE_EXIT_CODE = 64;

export interface CommandSpec {
  /** Ruta del comando: `['content','validate']`. */
  readonly path: readonly string[];
  readonly summary: string;
  /** Tarea del plan que lo implementa. */
  readonly implementedBy: string;
}

export const COMMANDS: readonly CommandSpec[] = [
  {
    path: ['content', 'validate'],
    summary: 'Valida el paquete de contenido contra la lista P-II §5.5.',
    implementedBy: 'T-H5-13 (F6/H5)',
  },
  {
    path: ['experiment', 'freeze'],
    summary: 'Produce y firma el manifiesto de freeze del paquete (I-8).',
    implementedBy: 'T-H5-15 (F6/H5)',
  },
  {
    path: ['ledger', 'verify'],
    summary: 'Verifica cadena, checkpoints y firmas de la bitácora.',
    implementedBy: 'T-H10-01 (F13/H10)',
  },
  {
    path: ['restore', 'drill'],
    summary: 'Ejecuta el ensayo de restauración en entorno limpio.',
    implementedBy: 'T-H10-02 (F13/H10)',
  },
];

export function findCommand(argv: readonly string[]): CommandSpec | undefined {
  return COMMANDS.find((c) => c.path.every((segment, i) => argv[i] === segment));
}

export function usage(): string {
  const lines = COMMANDS.map(
    (c) => `  profesor-ia ${c.path.join(' ')}${' '.repeat(Math.max(1, 22 - c.path.join(' ').length))}${c.summary}`,
  );
  return ['Uso: profesor-ia <comando> [opciones]', '', 'Comandos:', ...lines, ''].join('\n');
}

export interface RunResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export function run(argv: readonly string[]): RunResult {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    return { exitCode: USAGE_EXIT_CODE, stdout: usage(), stderr: '' };
  }
  const command = findCommand(argv);
  if (!command) {
    return {
      exitCode: USAGE_EXIT_CODE,
      stdout: '',
      stderr: `comando desconocido: ${argv.join(' ')}\n\n${usage()}`,
    };
  }
  if (command.path[0] === 'content' && command.path[1] === 'validate') {
    const packagePath = argv[2];
    if (packagePath === undefined || packagePath.trim() === '') {
      return {
        exitCode: USAGE_EXIT_CODE,
        stdout: '',
        stderr: 'uso: profesor-ia content validate <directorio-del-paquete>\n',
      };
    }
    const factsPath = resolve(packagePath, 'lint-input.json');
    if (!existsSync(factsPath)) {
      return {
        exitCode: VALIDATION_FAILED_EXIT_CODE,
        stdout: '',
        stderr:
          `PAQUETE_INVALIDO: falta ${factsPath}. El pipeline debe materializar los hechos ` +
          `del linter; no se infieren de placeholders.\n`,
      };
    }
    try {
      const facts = JSON.parse(readFileSync(factsPath, 'utf8')) as PackageLintFacts;
      const report = lintContentPackage(facts);
      if (!report.valid) {
        return {
          exitCode: VALIDATION_FAILED_EXIT_CODE,
          stdout: JSON.stringify(report, null, 2) + '\n',
          stderr: `PAQUETE_INVALIDO: ${report.issues.length} control(es) fallaron.\n`,
        };
      }
      return {
        exitCode: 0,
        stdout: JSON.stringify(report, null, 2) + '\n',
        stderr: '',
      };
    } catch (error) {
      return {
        exitCode: VALIDATION_FAILED_EXIT_CODE,
        stdout: '',
        stderr: `PAQUETE_INVALIDO: lint-input.json ilegible o incompleto: ${
          error instanceof Error ? error.message : String(error)
        }\n`,
      };
    }
  }
  return {
    exitCode: NOT_IMPLEMENTED_EXIT_CODE,
    stdout: '',
    stderr:
      `NO_IMPLEMENTADO: \`profesor-ia ${command.path.join(' ')}\` es un stub de F0/H0.\n` +
      `Se implementa en ${command.implementedBy}. Este comando falla a propósito: ` +
      `no puede reportar éxito sin ejecutar la verificación real.\n`,
  };
}
