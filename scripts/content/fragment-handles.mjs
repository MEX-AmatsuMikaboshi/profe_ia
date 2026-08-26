// Tabla de correspondencia mango → fragmentId (D-77).
//
// El mango es lo que el modelo cita; el identificador canónico es lo que lleva
// la proveniencia. Un informe de BENCH-01 lleno de `F-…` no es auditable sin
// esta tabla, así que se publica como artefacto.
//
// Es **derivado**: se regenera del corpus y el diff debe ser vacío, igual que el
// conjunto dorado. Si no lo es, cambió el corpus, no la tabla.
//
//   node scripts/content/fragment-handles.mjs [--check]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fragmentHandleEntries } from '../../packages/contracts/dist/fragment-handle.js';
import { loadContentPackage } from '../../tools/bench/dist/corpus.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONTENIDO = join(RAIZ, 'content', 'unidad-deduccion-natural');
const DESTINO = join(RAIZ, 'analysis', 'reports', 'fragment-handles.json');

const paquete = loadContentPackage(CONTENIDO);

const fragmentos = [...paquete.authorizedFragmentsByBlock.values()]
  .flat()
  .map((f) => ({ fragmentId: f.fragmentId, blockId: f.blockId }));

const porId = new Map(fragmentos.map((f) => [f.fragmentId, f.blockId]));
const filas = fragmentHandleEntries([...porId.keys()]).map((e) => ({
  handle: e.handle,
  fragmentId: e.fragmentId,
  blockId: porId.get(e.fragmentId),
}));

const artefacto = {
  generadoPor: 'scripts/content/fragment-handles.mjs',
  decision: 'D-77',
  assetVersion: paquete.assetVersion,
  corpusVersion: paquete.corpusVersion,
  total: filas.length,
  // Cuánto se ahorra, medido y no supuesto: es la justificación de D-77.
  longitudCanonicaMedia:
    filas.length === 0
      ? 0
      : Number(
          (filas.reduce((a, f) => a + f.fragmentId.length, 0) / filas.length).toFixed(1),
        ),
  longitudDelMango: filas[0]?.handle.length ?? 0,
  entradas: filas,
};

const serializado = `${JSON.stringify(artefacto, null, 2)}\n`;

if (process.argv.includes('--check')) {
  let previo;
  try {
    previo = readFileSync(DESTINO, 'utf8');
  } catch {
    console.error(`No existe ${DESTINO}. Genera la tabla antes de comprobarla.`);
    process.exit(1);
  }
  if (previo !== serializado) {
    console.error(
      'La tabla de mangos publicada no corresponde al corpus vigente. Regenérala con ' +
        '`node scripts/content/fragment-handles.mjs` y revisa el diff: si no esperabas cambios, ' +
        'cambió el corpus.',
    );
    process.exit(1);
  }
  console.log(`ok  tabla de mangos reproducible — ${String(artefacto.total)} fragmentos`);
} else {
  mkdirSync(dirname(DESTINO), { recursive: true });
  writeFileSync(DESTINO, serializado, 'utf8');
  console.log(
    `escrita ${DESTINO} — ${String(artefacto.total)} fragmentos, ` +
      `${String(artefacto.longitudCanonicaMedia)} → ${String(artefacto.longitudDelMango)} caracteres`,
  );
}
