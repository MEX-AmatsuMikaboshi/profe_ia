/**
 * Invoca pnpm de forma reproducible en Windows y Linux.
 *
 * `pnpm run <script>` expone su propio entrypoint en `npm_execpath`; usarlo con
 * `process.execPath` evita lanzar un `.cmd` (EINVAL en Node ≥20 en Windows) y
 * evita `shell: true` (DEP0190).
 */
import { execFileSync } from 'node:child_process';

const PNPM_JS = process.env.npm_execpath;

export function runPnpm(args, options = {}) {
  const command = PNPM_JS ? process.execPath : process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const finalArgs = PNPM_JS ? [PNPM_JS, ...args] : args;
  return execFileSync(command, finalArgs, {
    encoding: 'utf8',
    ...(PNPM_JS ? {} : { shell: process.platform === 'win32' }),
    ...options,
  });
}
