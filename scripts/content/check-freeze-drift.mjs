import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertFreezeManifest, detectFreezeDrift } from '@profesor-ia/experiment';

const flag = process.argv.indexOf('--content');
const root = resolve(flag >= 0 ? process.argv[flag + 1] : 'content/unidad-deduccion-natural');
try {
  const manifest = assertFreezeManifest(
    JSON.parse(readFileSync(resolve(root, 'freeze-manifest.json'), 'utf8')),
  );
  const report = detectFreezeDrift(root, manifest);
  if (!report.matches) {
    process.stderr.write(`FREEZE_DRIFT_BLOQUEADO: ${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`ok: paquete sin drift (${report.actualPackageHash})\n`);
  }
} catch (error) {
  process.stderr.write(
    `FREEZE_DRIFT_BLOQUEADO: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
