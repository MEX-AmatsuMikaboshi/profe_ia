/**
 * Arranque de Docker Desktop en Windows con limpieza previa de sockets fantasma.
 *
 * Resuelve la trampa nº 6 del entorno (docs/env/windows.md). Docker Desktop crea
 * sus sockets AF_UNIX como reparse points de cero bytes. En esta máquina esos
 * archivos sobreviven al apagado —limpio o no— y después **no se pueden borrar
 * ni consultar**: `DeleteFile` y `fsutil reparsepoint query` devuelven el error
 * 1920 (`ERROR_CANT_ACCESS_FILE`). Al arrancar, Docker intenta remover el socket
 * anterior antes de rebindear, ese `remove` falla, y el backend se cae con:
 *
 *   starting services: initializing Inference manager: listening on
 *   unix://…/dockerInference: remove …/dockerInference:
 *   The file cannot be accessed by the system.
 *
 * Crear los sockets sí funciona; lo único roto es borrar los que ya están. Por
 * eso basta con que los directorios estén vacíos en cada arranque. Los archivos
 * que no se dejan borrar se apartan moviendo su directorio padre a
 * `<dir>.fantasma\<n>`: mover el padre sí está permitido aunque su contenido sea
 * inaccesible.
 *
 * **Son dos directorios, no uno.** Limpiar sólo `Docker\run` mueve el fallo al
 * `Secrets Engine`, que usa `docker-secrets-engine`. Comprobado: con los dos
 * limpios, el motor levanta en 5 s.
 *
 * Subcomandos: `start` (limpia y arranca esperando al motor), `clean` (sólo
 * limpia), `stop`.
 *
 * No degrada en silencio: si no puede dejar un directorio vacío, o si el fallo
 * aparece en un tercer directorio que no conoce, sale con código distinto de
 * cero **diciendo la ruta**, en vez de dejar un Docker que se va a caer.
 */
import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

const DOCKER_BIN_WINDOWS = 'C:\\Program Files\\Docker\\Docker\\resources\\bin';
const DOCKER_DESKTOP_EXE = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe';
const ESPERA_MOTOR_MS = 180_000;
const SONDEO_MS = 5_000;
const INTENTOS = 3;

if (process.platform !== 'win32') {
  console.error('este script sólo aplica a Windows; en otras plataformas usa Docker directamente.');
  process.exit(2);
}

if (existsSync(DOCKER_BIN_WINDOWS)) {
  process.env.PATH = `${DOCKER_BIN_WINDOWS};${process.env.PATH ?? ''}`;
}

const LOCALAPPDATA = process.env.LOCALAPPDATA;
if (!LOCALAPPDATA) {
  console.error('LOCALAPPDATA no está definido; no se puede localizar el directorio de sockets.');
  process.exit(2);
}

/** Los dos directorios de sockets observados. El orden es el del arranque. */
const DIRECTORIOS_SOCKET = [
  join(LOCALAPPDATA, 'Docker', 'run'),
  join(LOCALAPPDATA, 'docker-secrets-engine'),
];

const LOG_BACKEND = join(LOCALAPPDATA, 'Docker', 'log', 'host', 'com.docker.backend.exe.log');

/** Intenta borrar lo apartado en corridas anteriores. Que no se pueda es lo normal. */
const purgarCuarentena = (dir) => {
  const cuarentena = `${dir}.fantasma`;
  if (!existsSync(cuarentena)) return;
  for (const nombre of readdirSync(cuarentena)) {
    try {
      rmSync(join(cuarentena, nombre), { recursive: true, force: true });
      console.log(`  ${cuarentena}: ${nombre} ya se pudo borrar`);
    } catch {
      /* sigue inaccesible; se queda donde está */
    }
  }
};

/** Deja `dir` vacío, o sale con error. Devuelve la descripción de lo que hizo. */
const limpiar = (dir) => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    return 'no existía; creado vacío';
  }

  const entradas = readdirSync(dir);
  if (entradas.length === 0) return 'ya estaba vacío';

  const rebeldes = [];
  for (const nombre of entradas) {
    try {
      unlinkSync(join(dir, nombre));
    } catch {
      rebeldes.push(nombre);
    }
  }
  if (rebeldes.length === 0) return `borrados ${entradas.length} socket(s)`;

  const cuarentena = `${dir}.fantasma`;
  mkdirSync(cuarentena, { recursive: true });
  const usados = readdirSync(cuarentena)
    .map((n) => Number.parseInt(n, 10))
    .filter((n) => Number.isInteger(n));
  const siguiente = String((usados.length === 0 ? 0 : Math.max(...usados)) + 1);

  try {
    renameSync(dir, join(cuarentena, siguiente));
  } catch (error) {
    console.error(
      `no se pudo apartar ${dir} (${rebeldes.join(', ')} no se dejan borrar): ${
        error instanceof Error ? error.message : String(error)
      }\n` + 'Docker Desktop se caería al arrancar. Cierra todo proceso de Docker y reintenta.',
    );
    process.exit(2);
  }
  mkdirSync(dir, { recursive: true });
  return `${rebeldes.length} inaccesible(s) apartado(s) en ${cuarentena}\\${siguiente}`;
};

const limpiarTodos = (dirs) => {
  for (const dir of dirs) {
    purgarCuarentena(dir);
    console.log(`${dir}: ${limpiar(dir)}`);
  }
};

const motorArriba = () => {
  const r = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { encoding: 'utf8' });
  return r.status === 0 ? (r.stdout ?? '').trim() : null;
};

/** Última caída registrada por el backend, o `null`. */
const ultimaCaida = () => {
  if (!existsSync(LOG_BACKEND)) return null;
  const lineas = readFileSync(LOG_BACKEND, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('crashed, dumping'));
  return lineas.length > 0 ? (lineas[lineas.length - 1] ?? null) : null;
};

/**
 * Directorio del socket culpable de una caída, en forma nativa de Windows.
 * El mensaje siempre tiene la forma `listening on unix://<ruta>: remove <ruta>:`.
 */
const directorioCulpable = (caida) => {
  const m = /unix:\/\/(.+?): remove /.exec(caida ?? '');
  if (m === null || m[1] === undefined) return null;
  return dirname(m[1].replace(/\//g, '\\'));
};

const matarRestos = () => {
  for (const imagen of ['Docker Desktop.exe', 'com.docker.backend.exe']) {
    spawnSync('taskkill', ['/F', '/IM', imagen, '/T'], { stdio: 'ignore' });
  }
};

const dormir = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const esperarMotor = () => {
  const limite = Date.now() + ESPERA_MOTOR_MS;
  while (Date.now() < limite) {
    dormir(SONDEO_MS);
    const version = motorArriba();
    if (version !== null) return version;
  }
  return null;
};

const COMMANDS = {
  clean: () => {
    limpiarTodos(DIRECTORIOS_SOCKET);
    return 0;
  },

  stop: () => {
    const r = spawnSync('docker', ['desktop', 'stop'], { stdio: 'inherit' });
    return r.status ?? 0;
  },

  start: () => {
    const ya = motorArriba();
    if (ya !== null) {
      console.log(`el motor ya estaba arriba (ServerVersion ${ya}).`);
      return 0;
    }
    if (!existsSync(DOCKER_DESKTOP_EXE)) {
      console.error(`no se encontró ${DOCKER_DESKTOP_EXE}.`);
      return 2;
    }

    const dirs = [...DIRECTORIOS_SOCKET];
    for (let intento = 1; intento <= INTENTOS; intento += 1) {
      matarRestos();
      dormir(2_000);
      limpiarTodos(dirs);

      spawn(DOCKER_DESKTOP_EXE, [], { detached: true, stdio: 'ignore' }).unref();
      const version = esperarMotor();
      if (version !== null) {
        console.log(`motor arriba (ServerVersion ${version}) al intento ${intento}.`);
        return 0;
      }

      const caida = ultimaCaida();
      const culpable = directorioCulpable(caida);
      if (culpable !== null && !dirs.includes(culpable)) {
        console.error(`caída en un directorio de sockets no previsto: ${culpable}`);
        console.error('se añade a la limpieza y se reintenta; añádelo a DIRECTORIOS_SOCKET.');
        dirs.push(culpable);
        continue;
      }

      console.error(`el motor no respondió en ${ESPERA_MOTOR_MS / 1000} s.`);
      if (caida !== null) console.error(`última caída registrada:\n${caida}`);
      return 1;
    }

    console.error(`se agotaron los ${INTENTOS} intentos.`);
    return 1;
  },
};

const [subcommand] = process.argv.slice(2);
const run = COMMANDS[subcommand];
if (!run) {
  console.error(`uso: node scripts/dev/docker-desktop.mjs <${Object.keys(COMMANDS).join('|')}>`);
  process.exit(2);
}
process.exit(run());
