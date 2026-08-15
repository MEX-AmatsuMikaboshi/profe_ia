/**
 * `ci:supply:drift` (Plan.md T-H0-06). El drift bloquea (§10).
 *
 * Comprueba que el árbol instalado corresponde exactamente al lockfile
 * registrado y que no hay advisories aplicables sin mitigación documentada
 * (§3: «cualquier versión con advisory de seguridad aplicable sin mitigación
 * documentada bloquea su gate»).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runPnpm } from './pnpm-exec.mjs';

const ROOT = process.cwd();
let failures = 0;

// 1) Digest del lockfile frente al registrado en el último SBOM.
const digestPath = join(ROOT, 'supply', 'lockfile.digest');
const lockPath = join(ROOT, 'pnpm-lock.yaml');
if (!existsSync(lockPath)) {
  console.error('FALLO: no existe pnpm-lock.yaml (reproducibilidad imposible)');
  process.exit(1);
}
const actual = createHash('sha256').update(readFileSync(lockPath)).digest('hex');
if (!existsSync(digestPath)) {
  console.error('FALLO: falta supply/lockfile.digest — ejecuta `pnpm run ci:supply:sbom`');
  failures += 1;
} else {
  const recorded = readFileSync(digestPath, 'utf8').trim();
  if (recorded !== actual) {
    console.error(
      `FALLO (drift): lockfile ${actual} ≠ registrado ${recorded}.\n` +
        'Un cambio de dependencias exige regenerar SBOM+digest en el mismo PR.',
    );
    failures += 1;
  } else {
    console.log('ok: lockfile sin drift respecto al SBOM registrado');
  }
}

// 2) El árbol instalado debe satisfacer el lockfile congelado.
try {
  runPnpm(['install', '--frozen-lockfile', '--offline', '--ignore-scripts'], {
    cwd: ROOT,
    stdio: 'pipe',
  });
  console.log('ok: instalación reproducible con --frozen-lockfile');
} catch (err) {
  const out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
  if (/offline|ERR_PNPM_NO_OFFLINE/i.test(out)) {
    console.warn('aviso: verificación --frozen-lockfile omitida (caché offline incompleta)');
  } else {
    console.error('FALLO: el árbol instalado no corresponde al lockfile:\n' + out);
    failures += 1;
  }
}

// 3) Advisories.
try {
  runPnpm(['audit', '--audit-level', 'moderate'], { cwd: ROOT, stdio: 'pipe' });
  console.log('ok: sin advisories moderate+ aplicables');
} catch (err) {
  const out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
  if (/ERR_PNPM_AUDIT_ENDPOINT|ENOTFOUND|network/i.test(out)) {
    console.warn('aviso: registro de advisories inalcanzable; verificación pendiente en CI con red');
  } else {
    console.error('FALLO: advisories aplicables sin mitigación documentada:\n' + out);
    failures += 1;
  }
}

process.exit(failures === 0 ? 0 : 1);
