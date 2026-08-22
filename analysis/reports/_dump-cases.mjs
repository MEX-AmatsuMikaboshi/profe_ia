// Vuelca MATERIAL_CASES a JSON para generar el documento de revisión humana.
// Artefacto de trabajo, no forma parte del repo.
import { writeFileSync } from 'node:fs';
import { MATERIAL_CASES } from '../../tools/bench/dist/material-cases.js';

writeFileSync(
  new URL('./material-cases.json', import.meta.url),
  JSON.stringify(MATERIAL_CASES, null, 2),
);
console.log(`casos: ${MATERIAL_CASES.length}`);
