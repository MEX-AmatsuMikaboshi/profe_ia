// Comprobador de coherencia de `docs/plan/PLAN_STATUS.md` (D-81).
//
// ## Por qué existe, y por qué no inventa nada
//
// `package.json` declaraba `plan:status` apuntando aquí desde el principio y el
// archivo **nunca existió**. La sesión del 2026-08-23 lo dejó roto a propósito,
// razonando que «no consta qué debía comprobar, y elegirlo sería inventar».
//
// Eso confunde dos cosas distintas. No saber qué quiso el autor original es
// cierto; que no haya reglas bien definidas que comprobar es falso: el propio
// `PLAN_STATUS.md` las declara sobre sí mismo en su cabecera, y CLAUDE.md §1 las
// repite. Este script **no elige** ninguna regla nueva; mecaniza cuatro que ya
// estaban escritas, y lee el conjunto de estados **del documento** en vez de
// copiarlo, para que no haya dos versiones de la misma lista.
//
// Las cuatro:
//
//   1. El estado de cada tarea empieza por uno de los estados declarados.
//   2. Los identificadores de decisión no se repiten.
//   3. No hay huecos: van de D-1 a D-max sin saltos.
//   4. Ninguna cita `D-N` del repositorio apunta a una decisión no declarada.
//
// La cuarta es la que más rinde: una referencia colgada es exactamente lo que
// pasa cuando alguien cita una decisión que pensaba escribir y no escribió.
//
//   node scripts/plan/check-status.mjs

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// `--root <ruta>` existe para que el verificador de siembra
// (`verify-check-status-catches.mjs`) apunte a un árbol de juguete en vez de
// tener que **modificar el repositorio real** para comprobar que esto detecta
// algo. Un control positivo que muta el archivo que vigila deja el árbol sucio
// el día que falle a mitad.
const indiceRoot = process.argv.indexOf('--root');
const RAIZ =
  indiceRoot === -1
    ? join(dirname(fileURLToPath(import.meta.url)), '..', '..')
    : (process.argv[indiceRoot + 1] ?? '.');
const STATUS = join(RAIZ, 'docs', 'plan', 'PLAN_STATUS.md');

/** Carpetas que no son fuente del repositorio y multiplicarían los resultados. */
const EXCLUIDAS = new Set(['node_modules', '.git', '.stryker-tmp', 'dist', '.turbo', '.next']);

const texto = readFileSync(STATUS, 'utf8');
const fallos = [];

// --- 1. Estados, leídos del propio documento -------------------------------
// La cabecera es la fuente: copiarla aquí crearía una segunda lista, y la que se
// queda vieja es siempre la copia.
const lineaEstados = texto.split('\n').find((l) => l.startsWith('Estados:'));
if (lineaEstados === undefined) {
  fallos.push('PLAN_STATUS.md no tiene la línea «Estados:» de la que se leen los estados válidos.');
}
const ESTADOS = new Set(
  (lineaEstados ?? '').match(/\b[A-Z][A-Z_]{3,}\b/g)?.filter((e) => e !== 'PLAN') ?? [],
);
if (ESTADOS.size === 0 && lineaEstados !== undefined) {
  fallos.push('No se pudo leer ningún estado de la línea «Estados:».');
}

// Los ids de tarea no son todos `T-Hx-nn`: F9 usa `T-CC-nn` y F11 `T-LSU-nn`
// (Plan.md §F9 y §F11). Con el patrón antiguo, esas filas **no se validaban** —
// un estado mal escrito en F9 pasaba inadvertido y el árbol se veía verde—, que
// es la misma clase de agujero que D-85: existir no es lo mismo que vigilar.
const filas = [...texto.matchAll(/^\| (T-(?:H[0-9.]+|CC|LSU)-[0-9]+) \| ([A-Z_]+) \| ([^|]+) \|/gm)];
if (filas.length === 0) fallos.push('No se reconoció ninguna fila de tarea en PLAN_STATUS.md.');
for (const fila of filas) {
  const tarea = fila[1];
  const estado = fila[3].trim();
  const primero = estado.match(/^[A-Z][A-Z_]*/)?.[0] ?? '';
  if (!ESTADOS.has(primero)) {
    fallos.push(`${tarea}: el estado «${estado.slice(0, 40)}» no empieza por un estado declarado.`);
  }
}

// --- 2 y 3. Decisiones: sin duplicados y sin huecos ------------------------
const declaradas = [...texto.matchAll(/^- \*\*D-(\d+) —/gm)].map((m) => Number(m[1]));
const conjunto = new Set(declaradas);
for (const n of conjunto) {
  const veces = declaradas.filter((d) => d === n).length;
  if (veces > 1) fallos.push(`D-${String(n)} está declarada ${String(veces)} veces.`);
}
const maxima = declaradas.length === 0 ? 0 : Math.max(...declaradas);
const huecos = [];
for (let i = 1; i <= maxima; i += 1) if (!conjunto.has(i)) huecos.push(i);
if (huecos.length > 0) {
  // Se resume en vez de listar uno por uno. Un identificador con un dígito de
  // más abre cientos de huecos de golpe y enterraría el fallo real bajo su
  // propio ruido, que es como se acaba ignorando un comprobador.
  //
  // (El ejemplo no se escribe con su identificador literal a propósito: esta
  // misma comprobación lo leería como una cita colgada. Excluir este archivo del
  // barrido sería más cómodo y crearía un punto ciego justo aquí.)
  const muestra = huecos.slice(0, 5).map((n) => `D-${String(n)}`).join(', ');
  const resto = huecos.length > 5 ? ` … y ${String(huecos.length - 5)} más` : '';
  fallos.push(
    `Hay ${String(huecos.length)} hueco(s) en la numeración hasta D-${String(maxima)}: ` +
      `${muestra}${resto}.`,
  );
}

// --- 4. Citas colgadas ------------------------------------------------------
const fuentes = [];
function recorrer(directorio) {
  for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
    if (EXCLUIDAS.has(entrada.name)) continue;
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) recorrer(ruta);
    else if (/\.(ts|tsx|mjs|cjs|md)$/.test(entrada.name)) fuentes.push(ruta);
  }
}
recorrer(RAIZ);

const colgadas = new Map();
for (const archivo of fuentes) {
  for (const cita of readFileSync(archivo, 'utf8').matchAll(/\bD-(\d{1,3})\b/g)) {
    const n = Number(cita[1]);
    if (conjunto.has(n)) continue;
    if (!colgadas.has(n)) colgadas.set(n, new Set());
    colgadas.get(n).add(relative(RAIZ, archivo));
  }
}
for (const [n, archivos] of [...colgadas].sort((a, b) => a[0] - b[0])) {
  const lista = [...archivos].slice(0, 5).join(', ');
  const resto = archivos.size > 5 ? ` (+${String(archivos.size - 5)} más)` : '';
  fallos.push(`D-${String(n)} se cita pero no está declarada en PLAN_STATUS.md: ${lista}${resto}`);
}

// --- Resultado --------------------------------------------------------------
if (fallos.length > 0) {
  console.error(`PLAN_STATUS.md incoherente — ${String(fallos.length)} fallo(s):\n`);
  for (const f of fallos) console.error(`  - ${f}`);
  console.error(
    '\nNo se «arregla» relajando la comprobación: cada regla la declara el propio documento.',
  );
  process.exit(1);
}

console.log(
  `ok  PLAN_STATUS.md coherente — ${String(filas.length)} tareas con estado declarado, ` +
    `D-1…D-${String(maxima)} sin huecos ni duplicados, ` +
    `${String(fuentes.length)} archivos sin citas colgadas`,
);
