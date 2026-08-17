/**
 * Build de `apps/web` (T-H6-13).
 *
 * Envuelve `next build` por dos razones, no por gusto:
 *
 * 1. **Telemetría apagada explícitamente.** Next envía telemetría anónima a un
 *    endpoint externo por omisión. En un sistema local-first (P-II §0.3) eso es
 *    tráfico saliente no declarado durante una corrida, así que se apaga aquí y
 *    no en un `.env` —que no se versiona— ni confiando en que alguien haya
 *    corrido `next telemetry disable` en su máquina.
 * 2. **`VAR=valor cmd` no es portable.** En Windows el shim de pnpm invoca
 *    `cmd`, donde ese prefijo no existe. Fijarlo desde Node funciona igual en
 *    las dos plataformas (§5 de docs/env/windows.md).
 *
 * Antes de construir se comprueba que la hoja de tokens derivada corresponde al
 * vendorizado: un build verde sobre una hoja que salió a la red sería éxito
 * simulado.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const WEB = join(ROOT, 'apps', 'web');

function run(args, cwd) {
  // Se invoca el entrypoint `.js`/`.mjs` con el propio Node: lanzar un `.cmd`
  // con execFile/spawn sin shell falla con EINVAL en Windows desde Node 20.
  const result = spawnSync(process.execPath, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

const tokensCheck = run([join(ROOT, 'scripts', 'web', 'generate-tokens-css.mjs'), '--check'], ROOT);
if (tokensCheck !== 0) process.exit(tokensCheck);

// pnpm no hoistea al `node_modules` de la raíz: `next` está en el del paquete
// que lo declara. Se resuelve desde ahí en vez de suponer una ruta hoisteada,
// que es lo que rompió la primera versión de este script.
const nextBin = join(WEB, 'node_modules', 'next', 'dist', 'bin', 'next');
if (!existsSync(nextBin)) {
  console.error(`No se encontró el entrypoint de Next en ${nextBin}. ¿Falta \`pnpm install\`?`);
  process.exit(1);
}
process.exit(run([nextBin, 'build'], WEB));
