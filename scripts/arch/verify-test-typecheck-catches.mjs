/**
 * Control positivo del typecheck de las pruebas.
 *
 * `ci:typecheck` compila ahora dos proyectos por paquete: `tsconfig.json`
 * —solo `src/`, que es lo que se publica— y `tsconfig.test.json`, que añade
 * `test/`. El segundo es fácil de dejar sin efecto sin que nadie se entere: basta
 * que alguien recorte su `include`, y a partir de ahí el check pasa **sin mirar
 * ninguna prueba**. Eso es exactamente lo que llevaba pasando antes de que
 * existiera, y lo que costó dos defectos: un generador de fast-check declarado y
 * nunca usado, y un campo obligatorio nuevo que dejó de proteger.
 *
 * Aquí se siembra un error de tipos **dentro de un archivo de prueba** y se
 * comprueba que el proyecto de pruebas lo ve y el de `src/` no. La siembra se
 * retira siempre.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

/**
 * Paquetes con `test/`. Se descubren, no se enumeran: una lista escrita a mano
 * se queda vieja en cuanto alguien añade un paquete, y el control diría que todo
 * está cubierto mirando lo que ya estaba.
 */
function subdirectorios(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => entrada.name);
}

function paquetesConPruebas() {
  const salida = [];
  for (const grupo of ['apps', 'packages', 'tools']) {
    const dir = join(ROOT, grupo);
    if (!existsSync(dir)) continue;
    for (const nombre of subdirectorios(dir)) {
      const paquete = join(dir, nombre);
      if (!existsSync(join(paquete, 'test'))) continue;
      salida.push({ nombre: `${grupo}/${nombre}`, ruta: paquete });
    }
  }
  return salida;
}

/** Corre `tsc -p` y dice si falló. */
function compila(proyecto, extra = []) {
  try {
    execFileSync(process.execPath, [tscBin(), '-p', proyecto, ...extra], {
      cwd: ROOT,
      stdio: 'pipe',
    });
    return { ok: true, salida: '' };
  } catch (error) {
    return { ok: false, salida: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

/**
 * Ruta del `tsc` instalado. Se invoca con `process.execPath` y no por el `.cmd`:
 * `execFile` sin shell sobre un `.cmd` falla con `EINVAL` desde Node 20, que es
 * la trampa nº 4 de `docs/env/windows.md`.
 */
function tscBin() {
  return join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
}

/**
 * Proyecto que compila `test/` en ese paquete, o `null` si no lo compila nadie.
 *
 * Hay dos formas legítimas y las dos cuentan: un `tsconfig.test.json` aparte
 * —lo normal, porque `tsconfig.json` emite a `dist/` con `rootDir: src` y meter
 * las pruebas ahí las publicaría— o un `tsconfig.json` que ya las incluya, que
 * es el caso de `apps/web`, donde Next no emite y el proyecto es `noEmit`.
 */
function proyectoDePruebas(ruta) {
  if (existsSync(join(ruta, 'tsconfig.test.json'))) return join(ruta, 'tsconfig.test.json');
  const principal = join(ruta, 'tsconfig.json');
  if (!existsSync(principal)) return null;
  // Se lee como texto: `tsconfig.json` admite comentarios y `JSON.parse` no.
  const crudo = readFileSync(principal, 'utf8');
  return /"test\/\*\*/u.test(crudo) ? principal : null;
}

function main() {
  const conPruebas = paquetesConPruebas();
  const sinCubrir = conPruebas.filter(({ ruta }) => proyectoDePruebas(ruta) === null);
  if (sinCubrir.length > 0) {
    throw new Error(
      `estos paquetes tienen test/ y ningún proyecto de TypeScript los compila, así que sus ` +
        `pruebas no se typechequean en ningún sitio: ${sinCubrir.map((p) => p.nombre).join(', ')}`,
    );
  }

  const paquetes = conPruebas.filter(({ ruta }) => existsSync(join(ruta, 'tsconfig.test.json')));
  if (paquetes.length === 0) {
    throw new Error(
      'ningún paquete declara `tsconfig.test.json`: el typecheck de las pruebas no cubre nada, ' +
        'y este control habría pasado por vacío.',
    );
  }

  // Se siembra en el primero por orden alfabético para que la corrida sea
  // reproducible, y se comprueba de paso que **todos** declaran el proyecto.
  const objetivo = paquetes[0];
  const archivo = join(objetivo.ruta, 'test', '__typecheck_probe__.test.ts');
  const SEMBRADO = [
    '// Archivo sembrado por scripts/arch/verify-test-typecheck-catches.mjs.',
    '// Si sobrevive a una corrida, bórralo: no es una prueba.',
    'const noEsUnNumero: number = «texto»;',
    'export default noEsUnNumero;',
    '',
  ]
    .join('\n')
    .replace('«texto»', "'texto'");

  try {
    writeFileSync(archivo, SEMBRADO);

    const conPruebas = compila(join(objetivo.ruta, 'tsconfig.test.json'));
    if (conPruebas.ok) {
      throw new Error(
        `${objetivo.nombre}: se sembró un error de tipos en test/ y \`tsconfig.test.json\` lo dejó ` +
          `pasar. El proyecto de pruebas no está mirando test/.`,
      );
    }
    if (!conPruebas.salida.includes('__typecheck_probe__')) {
      throw new Error(
        `${objetivo.nombre}: el typecheck de pruebas falló, pero no por la siembra. Salida:\n` +
          conPruebas.salida,
      );
    }
    console.log(`ok: ${objetivo.nombre} — el proyecto de pruebas detecta el error sembrado`);

    const soloSrc = compila(join(objetivo.ruta, 'tsconfig.json'), ['--noEmit']);
    if (!soloSrc.ok) {
      throw new Error(
        `${objetivo.nombre}: el proyecto de \`src/\` falló con la siembra puesta. Debería ignorar ` +
          `test/ por completo. Salida:\n${soloSrc.salida}`,
      );
    }
    console.log(`ok: ${objetivo.nombre} — el proyecto de src/ no mira test/, como debe`);
  } finally {
    rmSync(archivo, { force: true });
  }

  console.log(
    `ok: los ${conPruebas.length} paquetes con test/ tienen quien los compile ` +
      `(${paquetes.length} con proyecto propio)`,
  );

  // El script de `typecheck` tiene que invocarlo; declarar el proyecto y no
  // correrlo deja el mismo hueco con más archivos.
  const sinScript = paquetes.filter(({ ruta }) => {
    const paquete = JSON.parse(readFileSync(join(ruta, 'package.json'), 'utf8'));
    return !(paquete.scripts?.typecheck ?? '').includes('tsconfig.test.json');
  });
  if (sinScript.length > 0) {
    throw new Error(
      `estos paquetes declaran tsconfig.test.json y su script \`typecheck\` no lo corre: ` +
        `${sinScript.map((p) => p.nombre).join(', ')}`,
    );
  }
  console.log('ok: todos lo corren desde su script `typecheck`');
}

main();
