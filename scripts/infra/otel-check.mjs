/**
 * `ci:infra:otel` — la telemetría llega al colector, y **sólo la telemetría**
 * (Plan.md T-H3-05 ← Maestro §2476: «OpenTelemetry desde desarrollo»,
 * CONGELADA, registro local y sin monitoreo de pago).
 *
 * Es la prueba que el propietario eligió para cerrar esta tarea, y **la única
 * que afirma que las trazas llegan**. Todo lo demás de T-H3-05 —el SDK
 * arrancado, el exportador configurado, el compose cableado, la regla de
 * dependency-cruiser— dice que el código *debería* exportar. Ninguna de esas
 * cosas ha visto un span del otro lado. Esta sí, o falla.
 *
 * Cuatro afirmaciones, y la cuarta es la que más importa:
 *
 *  a. **Llegaron los tres spans del canal de veredicto**, con sus atributos,
 *     colgando de un mismo `traceId` y atribuidos a `api`.
 *  b. **Llegó la línea del verificador por `filelog`**, con el mismo nombre de
 *     archivo del spool que llevan los spans. Ese nombre es el único puente:
 *     el verificador no tiene red (I-3) y no puede propagar contexto de traza.
 *  c. **Llegaron métricas**, que es lo que «desde el arranque» significa para
 *     un proceso que todavía no atiende nada.
 *  d. **La derivación del alumno no aparece en ninguna parte de la salida del
 *     colector.** La traza no es una segunda bitácora (P-II §9.3).
 *
 * ## Por qué (d) no es verde por vacío
 *
 * «No aparece» es la afirmación fácil de aprobar sin haber comprobado nada: si
 * la búsqueda no supiera mirar, o el exportador no imprimiera valores, saldría
 * verde igual. Por eso la corrida siembra un **canario**: el `submissionId`
 * lleva una cadena única de la corrida, viaja por el **mismo camino** que
 * tendría una fuga —atributo de span → OTLP → colector → salida— y la misma
 * búsqueda que debe *no* encontrar la derivación tiene que encontrarlo a él. Si
 * el canario no aparece, la corrida falla antes de opinar sobre la fuga.
 *
 * ## Por qué `detailed` y no `normal` (D-37)
 *
 * La justificación que traía esta tarea era que `normal` no imprime atributos.
 * **Es falsa** en el colector 0.115.1: `normal` los imprime, en una línea por
 * span. Se comprobó en las dos verbosidades antes de escribir esto.
 *
 * Lo que `normal` **no** imprime es todo lo demás que el colector recibió:
 * atributos de recurso, eventos de span y enlaces. Y (d) no es una afirmación
 * sobre los atributos: es una afirmación sobre **todo lo que llegó**. Con
 * `normal`, una fuga alojada en un atributo de recurso o en un evento de
 * excepción —`span.recordException()` graba el mensaje del error, y un mensaje
 * de error es el sitio clásico donde se cuela el dato de entrada— quedaría
 * fuera de la salida y el control pasaría sin haber mirado ahí.
 *
 * El costo es local y nulo: la salida es la bitácora de un contenedor en la PC
 * del propietario. Lo que no se hizo es tener dos configuraciones, una para
 * desarrollo y otra para el check: eso comprobaría una configuración que nadie
 * corre.
 *
 * ## Alcance de servicios
 *
 * Levanta **el canal de veredicto** (`otel-collector`, `api`, `verifier` y la
 * base de la que `api` depende), no el stack entero. Que el stack completo
 * arranque desde cero es lo que afirma `ci:infra:compose-up`, y duplicarlo aquí
 * ataría esta comprobación a fallos que no son suyos.
 *
 * El colector se **recrea** siempre. Compose no recrea un contenedor porque
 * cambie el contenido de un archivo montado, así que un colector vivo de una
 * sesión anterior seguiría corriendo con la configuración vieja y el check
 * estaría midiendo otra cosa.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '..', '..');
const COMPOSE_FILE = join(REPO, 'infra', 'compose', 'docker-compose.yml');
const ENV_FILE = join(REPO, 'infra', 'compose', '.env');

const DOCKER_BIN_WINDOWS = 'C:\\Program Files\\Docker\\Docker\\resources\\bin';
if (process.platform === 'win32' && existsSync(DOCKER_BIN_WINDOWS)) {
  process.env.PATH = `${DOCKER_BIN_WINDOWS};${process.env.PATH ?? ''}`;
}

if (!existsSync(ENV_FILE)) {
  console.error('falta `infra/compose/.env`; créalo con `pnpm run dev:env`.');
  process.exit(2);
}

/** Servicios del canal de veredicto. `postgres` entra solo por `depends_on`. */
const SERVICES = ['otel-collector', 'api', 'verifier'];

const failures = [];
const check = (ok, message) => {
  console.log(`${ok ? 'ok' : 'FALLO'}: ${message}`);
  if (!ok) failures.push(message);
};

const compose = (args, opts = {}) =>
  spawnSync('docker', ['compose', '-f', COMPOSE_FILE, '--env-file', ENV_FILE, ...args], {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    ...opts,
  });

function envValue(name, fallback) {
  const match = readFileSync(ENV_FILE, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'mu'));
  const value = match?.[1]?.trim();
  return value === undefined || value.length === 0 ? fallback : value;
}

// ---------------------------------------------------------------------------
// Marcadores de la corrida
//
// El canario va en el `submissionId`, que la ruta publica como atributo
// `spool.file`: recorre el mismo camino que recorrería una fuga. Los átomos
// viven **sólo** dentro de la derivación; llevan letra delante para que no
// puedan coincidir por azar con los dígitos de una marca de tiempo o de un
// identificador de traza.
// ---------------------------------------------------------------------------
const RUN = Date.now();
const CANARIO = `otel-canario-${RUN.toString(36)}`;
const DIGITOS = String(RUN).slice(-8);
const ATOMO_A = `P${DIGITOS}`;
const ATOMO_B = `Q${DIGITOS}`;
const DERIVACION = {
  submissionId: CANARIO,
  proof: {
    lines: [
      { formula: `${ATOMO_A}∧${ATOMO_B}`, rule: 'PR', depth: 0 },
      { formula: ATOMO_B, rule: '∧E', refs: [1], depth: 0 },
    ],
    goal: ATOMO_B,
  },
};

// ---------------------------------------------------------------------------
// Lectura de la salida del exportador `debug`
//
// Se analiza la **estructura** y no se busca subcadena suelta: «aparece
// `clase.verificacion`» lo cumpliría también un span huérfano con ese nombre y
// ningún atributo. Lo que se quiere afirmar es que llegaron tres spans de un
// mismo `traceId`, con padre e hijos, atribuidos a `api`.
// ---------------------------------------------------------------------------
const ATRIBUTO = /^\s*->\s(.+?):\s([A-Za-z]+)\((.*)\)\s*$/u;
const DESCRIPTOR = /^\s*->\s(.+?):\s(.*)$/u;
const CAMPO = /^ {4}([A-Za-z ]+?)\s*:\s?(.*)$/u;
/** El colector antepone su propia línea de log al primer renglón del bloque. */
const PREFIJO_LOG = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z\tinfo\t/u;

function parse(raw) {
  const spans = [];
  const logRecords = [];
  const metrics = [];

  let recurso = {};
  let seccion = null; // 'spans' | 'logs' | 'metrics'
  let actual = null;
  let modo = null; // 'recurso' | 'atributos' | 'campos'

  for (const bruta of raw.split('\n')) {
    const line = bruta.replace(PREFIJO_LOG, '').replace(/\r$/u, '');

    if (line.startsWith('ResourceSpans')) {
      seccion = 'spans';
      recurso = {};
      actual = null;
      modo = null;
      continue;
    }
    if (line.startsWith('ResourceLog')) {
      seccion = 'logs';
      recurso = {};
      actual = null;
      modo = null;
      continue;
    }
    if (line.startsWith('ResourceMetrics')) {
      seccion = 'metrics';
      recurso = {};
      actual = null;
      modo = null;
      continue;
    }
    if (line.startsWith('Resource attributes:')) {
      modo = 'recurso';
      continue;
    }
    if (line.startsWith('Scope') || line.startsWith('InstrumentationScope')) {
      modo = null;
      continue;
    }

    if (line.startsWith('Span #')) {
      actual = {
        resource: recurso,
        attributes: {},
        name: '',
        traceId: '',
        spanId: '',
        parentId: '',
      };
      spans.push(actual);
      modo = 'campos';
      continue;
    }
    if (line.startsWith('LogRecord #')) {
      actual = { resource: recurso, attributes: {}, body: '' };
      logRecords.push(actual);
      modo = 'campos';
      continue;
    }
    if (line.startsWith('Metric #')) {
      actual = { resource: recurso, attributes: {}, name: '' };
      metrics.push(actual);
      modo = 'campos';
      continue;
    }

    if (/^(Attributes|Data point attributes):/u.test(line)) {
      modo = 'atributos';
      continue;
    }
    // El descriptor de una métrica no lleva tipo: sus renglones son
    // `-> Clave: valor` pelados, no `-> clave: Tipo(valor)`. Analizarlo con el
    // patrón de atributos lo descartaba entero y dejaba la métrica sin nombre.
    if (line.startsWith('Descriptor:')) {
      modo = 'descriptor';
      continue;
    }
    // Fuera de un bloque conocido: se corta para no colgar atributos ajenos.
    if (line.startsWith('\t{"kind"') || line.trim().length === 0) {
      if (modo === 'atributos') modo = null;
      continue;
    }

    if (modo === 'descriptor') {
      const m = DESCRIPTOR.exec(line);
      if (m === null) {
        modo = null;
        continue;
      }
      if (actual !== null && m[1] === 'Name') actual.name = m[2];
      continue;
    }

    if (modo === 'recurso' || modo === 'atributos') {
      const m = ATRIBUTO.exec(line);
      if (m === null) {
        modo = null;
        continue;
      }
      const clave = m[1];
      const valor = m[3];
      if (modo === 'recurso') recurso[clave] = valor;
      else if (actual !== null) actual.attributes[clave] = valor;
      continue;
    }

    if (modo === 'campos' && actual !== null) {
      if (seccion === 'logs' && line.startsWith('Body: ')) {
        actual.body = line.slice('Body: '.length);
        continue;
      }
      const m = CAMPO.exec(line);
      if (m === null) continue;
      const campo = m[1];
      const valor = m[2];
      if (campo === 'Name') actual.name = valor;
      else if (campo === 'Trace ID') actual.traceId = valor;
      else if (campo === 'ID') actual.spanId = valor;
      else if (campo === 'Parent ID') actual.parentId = valor;
    }
  }

  return { spans, logRecords, metrics };
}

const salidaColector = () => {
  const r = compose(['logs', '--no-log-prefix', 'otel-collector']);
  return `${r.stdout ?? ''}${r.stderr ?? ''}`;
};

// ---------------------------------------------------------------------------
// 1. Levantar el canal, con el colector recreado.
// ---------------------------------------------------------------------------
console.log('# levantando el canal de veredicto (build incluido; la primera vez tarda)');
const up = compose(['up', '-d', '--build', '--wait', '--wait-timeout', '600', ...SERVICES], {
  stdio: 'inherit',
});
check(up.status === 0, 'el canal de veredicto levanta y llega a healthy');
if (up.status !== 0) {
  console.error('\nsin stack no hay nada que observar.');
  process.exit(1);
}

console.log('# recreando el colector para que lea la configuración del árbol');
const recreado = compose(['up', '-d', '--force-recreate', 'otel-collector'], { stdio: 'inherit' });
check(recreado.status === 0, 'el colector se recrea con la configuración vigente');

// ---------------------------------------------------------------------------
// 2. Una operación real por la ruta real.
// ---------------------------------------------------------------------------
const API_PORT = envValue('API_PORT', '3001');
const RUTA_VEREDICTO = `http://127.0.0.1:${API_PORT}/clase/verificacion`;

let veredicto = null;
for (let intento = 0; intento < 30 && veredicto === null; intento += 1) {
  try {
    const res = await fetch(RUTA_VEREDICTO, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(DERIVACION),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 200) veredicto = await res.json();
    else console.log(`  intento ${intento + 1}: HTTP ${res.status}`);
  } catch (err) {
    console.log(`  intento ${intento + 1}: ${String(err)}`);
  }
  if (veredicto === null) await delay(2000);
}

check(veredicto !== null, `la ruta ${RUTA_VEREDICTO} responde 200 a una derivación real`);
check(veredicto?.verification?.valid === true, 'el verificador aislado la da por válida');
check(veredicto?.decidedBy === 'verifier', 'el veredicto lo dicta el verificador, no la api');
if (veredicto === null) {
  console.error('\nsin operación no hay telemetría que observar.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 3. Esperar a que el lote salga. Se sondea en vez de dormir un número fijo:
//    entre el `BatchSpanProcessor` (5 s), el `batch` del colector (5 s) y el
//    lector periódico de métricas (15 s) hay margen de sobra, y un `sleep`
//    calculado al milímetro es una prueba intermitente esperando su turno.
// ---------------------------------------------------------------------------
const ARCHIVO_SPOOL = `${CANARIO}.json`;
const LIMITE_MS = 120_000;
const arranque = Date.now();
let salida = '';
let leido = { spans: [], logRecords: [], metrics: [] };

const spansDelCanario = (p) => p.spans.filter((s) => s.attributes['spool.file'] === ARCHIVO_SPOOL);
const registroDelVerificador = (p) =>
  p.logRecords.find(
    (l) =>
      l.attributes['log.file.name'] === 'verifier.log' && l.attributes['file'] === ARCHIVO_SPOOL,
  );
const metricaDeArranque = (p) => p.metrics.find((m) => m.name === 'profesor_ia.service.uptime');

while (Date.now() - arranque < LIMITE_MS) {
  salida = salidaColector();
  leido = parse(salida);
  const listo =
    spansDelCanario(leido).length >= 2 &&
    registroDelVerificador(leido) !== undefined &&
    metricaDeArranque(leido) !== undefined;
  if (listo) break;
  await delay(3000);
}
console.log(`# ${Math.round((Date.now() - arranque) / 1000)} s hasta tener la salida del colector`);

// ---------------------------------------------------------------------------
// (a) Los tres spans del canal, de un mismo traceId y atribuidos a `api`.
// ---------------------------------------------------------------------------
const hijos = spansDelCanario(leido);
check(hijos.length === 2, `llegan los dos tramos del spool medidos por separado (${hijos.length})`);

const nombres = hijos.map((s) => s.name).sort();
check(
  nombres.join(',') === 'clase.verificacion.spool_await,clase.verificacion.spool_submit',
  `los tramos son submit y await (${nombres.join(', ') || 'ninguno'})`,
);

const traceId = hijos[0]?.traceId ?? '';
check(
  traceId.length === 32 && hijos.every((s) => s.traceId === traceId),
  `los dos tramos comparten traceId (${traceId || 'ninguno'})`,
);

const padre = leido.spans.find(
  (s) => s.name === 'clase.verificacion' && s.traceId === traceId && traceId !== '',
);
check(padre !== undefined, 'llega el span de la operación completa con el mismo traceId');
check(
  padre !== undefined && hijos.every((s) => s.parentId === padre.spanId),
  'los dos tramos cuelgan del span de la operación, no son huérfanos',
);
check(
  padre?.attributes['http.route'] === '/clase/verificacion' &&
    padre?.attributes['http.status_code'] === '200',
  'el span de la operación lleva ruta y código de estado',
);
check(
  padre?.attributes['verdict.valid'] === 'true' &&
    padre?.attributes['verdict.goal_reached'] === 'true',
  'el span lleva el resultado del veredicto, que es un booleano',
);
check(
  [...hijos, ...(padre === undefined ? [] : [padre])].every(
    (s) => s.resource['service.name'] === 'api',
  ),
  'los tres spans están atribuidos al servicio `api`',
);

// ---------------------------------------------------------------------------
// (b) El verificador aporta por `filelog`, y el puente es el nombre de archivo.
// ---------------------------------------------------------------------------
const registro = registroDelVerificador(leido);
check(registro !== undefined, 'llega la línea del verificador por `filelog`');
check(
  registro?.attributes['service'] === 'verifier' && registro?.attributes['event'] === 'verified',
  'la línea es la del veredicto del verificador, no otra cualquiera',
);
check(
  registro !== undefined && hijos.length > 0,
  `el puente es el nombre de archivo del spool (${ARCHIVO_SPOOL}): mismo valor en el span y en la línea`,
);

/**
 * El verificador **no** puede aparecer como recurso OTLP. Corre con
 * `network_mode: none` y su única vía es el archivo; un `service.name:
 * verifier` en un span o en una métrica significaría que alguien le abrió una
 * salida de red y rompió I-3 sin que ninguna regla estática lo viera.
 */
const recursosOtlp = new Set(
  [...leido.spans, ...leido.metrics].map((x) => x.resource['service.name']).filter(Boolean),
);
check(
  !recursosOtlp.has('verifier'),
  `el verificador no exporta por OTLP; recursos vistos: ${[...recursosOtlp].join(', ') || 'ninguno'}`,
);

// ---------------------------------------------------------------------------
// (c) Métricas desde el arranque.
// ---------------------------------------------------------------------------
const metrica = metricaDeArranque(leido);
check(metrica !== undefined, 'llegan métricas del proceso (`profesor_ia.service.uptime`)');
check(
  metrica?.resource['service.name'] === 'api' && metrica?.attributes['service'] === 'api',
  'la métrica viene atribuida a un servicio real',
);

// ---------------------------------------------------------------------------
// (d) La derivación del alumno no está en ninguna parte — con su canario.
// ---------------------------------------------------------------------------
check(
  salida.includes(CANARIO),
  `control positivo: la búsqueda encuentra el canario sembrado (${CANARIO})`,
);
for (const atomo of [ATOMO_A, ATOMO_B]) {
  check(!salida.includes(atomo), `la derivación del alumno no aparece en la salida (${atomo})`);
}
check(
  !salida.includes('∧'),
  'ninguna fórmula del alumno aparece en la salida (ningún conectivo en el flujo)',
);

if (failures.length > 0) {
  console.error(`\n${failures.length} comprobación(es) fallida(s) sobre la telemetría local.`);
  process.exit(1);
}
console.log(
  `\nTelemetría local en verde: ${leido.spans.length} span(s), ${leido.logRecords.length} registro(s) ` +
    `y ${leido.metrics.length} métrica(s) leídos del colector; traza ${traceId}.`,
);
