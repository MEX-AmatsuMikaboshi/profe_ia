// CLI `profesor-ia` (Plan.md T-H0-07). En F0 los comandos son *stubs que
// fallan explícitamente*: nunca devuelven éxito simulado, porque un comando de
// gate que "pasa" sin implementación convertiría una falla en éxito silencioso
// (§16, criterio de éxito técnico).

export const NOT_IMPLEMENTED_EXIT_CODE = 3;
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
  return {
    exitCode: NOT_IMPLEMENTED_EXIT_CODE,
    stdout: '',
    stderr:
      `NO_IMPLEMENTADO: \`profesor-ia ${command.path.join(' ')}\` es un stub de F0/H0.\n` +
      `Se implementa en ${command.implementedBy}. Este comando falla a propósito: ` +
      `no puede reportar éxito sin ejecutar la verificación real.\n`,
  };
}
