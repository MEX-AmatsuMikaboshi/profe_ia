/**
 * Telemetría H8 de recursos y costos (T-H8-09 ← P-II §13-H8, `INFRA-01`,
 * `CAL-12`).
 *
 * ## Para qué existe esta medida
 *
 * No es un panel bonito. El Maestro §172 lo dice sin rodeos: «la SKU de un VPS y
 * los límites de Compose se seleccionan **después** de esa telemetría, no por una
 * cifra histórica». O sea que estos números son la **única** entrada autorizada
 * para dimensionar la infraestructura, y por eso {@link deriveResourceEnvelope}
 * se niega a producir un sobre a partir de una ventana que no da la talla, en vez
 * de devolver un número plausible que alguien pondría en un `docker-compose.yml`.
 *
 * ## Lo que separa este módulo del resto de la observabilidad
 *
 * `startTelemetry()` arranca OTel y vigila que un span no se convierta en
 * bitácora paralela. Esto de aquí es otra cosa: **qué se mide y cómo se resume**.
 * Se separa porque el catálogo de métricas es normativo —está enumerado en
 * §13-H8— y un catálogo abierto acaba con `cpu`, `cpu_pct` y `service.cpu`
 * midiendo lo mismo con tres nombres, que es lo que hace irreconciliables dos
 * corridas.
 *
 * ## La separación de latencias, que es lo que más rinde
 *
 * §13-H8 pide «separar latencia local de latencia de cada proveedor», y conviene
 * ver por qué no es un refinamiento. Si el tiempo de espera del proveedor se
 * suma al tiempo local, la latencia observada crece con la lentitud de una API
 * remota — y quien lea ese número concluirá que **la máquina** va justa. Se
 * dimensionaría un VPS más grande para arreglar una espera de red. La medida
 * diría la verdad y la decisión sería errónea, que es la peor combinación.
 *
 * Por eso {@link splitLatency} **exige las dos partes** y rechaza que la del
 * proveedor supere el total: eso no es un dato ruidoso, es una contabilidad
 * imposible, y aceptarla dejaría la parte local en negativo.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Catálogo de métricas
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Las métricas de §13-H8, enumeradas.
 *
 * La lista es cerrada por la misma razón que las familias de evento de
 * `T-H8-08`: dos nombres para el mismo hecho conviven para siempre en cuanto los
 * dos se han emitido una vez.
 */
export const H8_METRICS = [
  // Por servicio.
  'service.cpu.percent',
  'service.rss.bytes',
  'service.io.read.bytes',
  'service.io.write.bytes',
  // Del host.
  'host.memory.available.bytes',
  'host.disk.free.bytes',
  'host.disk.growth.bytes_per_hour',
  // PostgreSQL.
  'postgres.connections.active',
  'postgres.queries.slow.count',
  // Colas.
  'queue.depth',
  'queue.oldest.age.seconds',
  // Latencia.
  'latency.end_to_end.ms',
  'latency.local.ms',
  'latency.provider.ms',
] as const;
export type H8Metric = (typeof H8_METRICS)[number];

/** Unidad por métrica. Un número sin unidad no se compara entre corridas. */
export const H8_METRIC_UNITS: Readonly<Record<H8Metric, string>> = Object.freeze({
  'service.cpu.percent': '%',
  'service.rss.bytes': 'By',
  'service.io.read.bytes': 'By',
  'service.io.write.bytes': 'By',
  'host.memory.available.bytes': 'By',
  'host.disk.free.bytes': 'By',
  'host.disk.growth.bytes_per_hour': 'By/h',
  'postgres.connections.active': '{connection}',
  'postgres.queries.slow.count': '{query}',
  'queue.depth': '{job}',
  'queue.oldest.age.seconds': 's',
  'latency.end_to_end.ms': 'ms',
  'latency.local.ms': 'ms',
  'latency.provider.ms': 'ms',
});

export type H8MetricsErrorCode =
  | 'METRICA_DESCONOCIDA'
  | 'MUESTRA_VACIA'
  | 'LATENCIA_INCOMPLETA'
  | 'LATENCIA_IMPOSIBLE'
  | 'VENTANA_INSUFICIENTE'
  | 'SERVICIO_SIN_MEDIR';

export class H8MetricsError extends Error {
  readonly code: H8MetricsErrorCode;

  constructor(code: H8MetricsErrorCode, detail: string) {
    super(detail);
    this.name = 'H8MetricsError';
    this.code = code;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Resumen: media, p95 y máximo
 * ──────────────────────────────────────────────────────────────────────────── */

export interface MetricSummary {
  readonly metric: H8Metric;
  readonly samples: number;
  readonly mean: number;
  readonly p95: number;
  readonly max: number;
}

/**
 * Resume una serie.
 *
 * El p95 se calcula por **interpolación lineal** entre los dos vecinos, no
 * eligiendo el elemento de índice redondeado. Con muestras pocas —y en una
 * corrida de H8 las hay— redondear el índice hace que el p95 salte al máximo y
 * los dos números pasen a decir lo mismo. Un p95 que siempre iguala al máximo no
 * es un percentil: es el máximo con otro nombre, y dimensionar con él pagaría el
 * pico de una vez como si fuera la carga.
 *
 * Una muestra vacía **lanza**. Devolver ceros daría un sobre de recursos
 * diminuto y perfectamente creíble.
 */
export function summarize(metric: H8Metric, samples: readonly number[]): MetricSummary {
  if (!(H8_METRICS as readonly string[]).includes(metric)) {
    throw new H8MetricsError(
      'METRICA_DESCONOCIDA',
      `«${metric}» no está en el catálogo de §13-H8. La lista es cerrada: dos nombres para el ` +
        `mismo hecho hacen irreconciliables dos corridas.`,
    );
  }
  if (samples.length === 0) {
    throw new H8MetricsError(
      'MUESTRA_VACIA',
      `no hay muestras de ${metric}. Resumir cero muestras daría media, p95 y máximo en 0, que ` +
        `es un sobre de recursos diminuto y perfectamente creíble.`,
    );
  }

  const ordenadas = [...samples].sort((a, b) => a - b);
  const suma = ordenadas.reduce((acc, v) => acc + v, 0);
  const posicion = 0.95 * (ordenadas.length - 1);
  const bajo = Math.floor(posicion);
  const alto = Math.ceil(posicion);
  const vBajo = ordenadas[bajo] ?? 0;
  const vAlto = ordenadas[alto] ?? vBajo;
  const p95 = bajo === alto ? vBajo : vBajo + (vAlto - vBajo) * (posicion - bajo);

  return {
    metric,
    samples: ordenadas.length,
    mean: suma / ordenadas.length,
    p95,
    max: ordenadas[ordenadas.length - 1] ?? 0,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Latencia local frente a latencia del proveedor
 * ──────────────────────────────────────────────────────────────────────────── */

export interface LatencySplit {
  readonly endToEndMs: number;
  readonly localMs: number;
  readonly providerMs: number;
  /** Qué proporción del total se fue esperando al proveedor. */
  readonly providerShare: number;
}

/**
 * Separa la latencia de una operación en local y de proveedor.
 *
 * Las dos partes son **obligatorias**. Admitir que falte la del proveedor
 * dejaría que una operación remota se contabilizara entera como local, que es
 * exactamente la confusión que §13-H8 manda deshacer.
 *
 * `providerMs > endToEndMs` no se acepta como ruido de medición: la parte local
 * quedaría negativa, y un número negativo propagado a un sobre de recursos no se
 * nota hasta que alguien resta.
 */
export function splitLatency(endToEndMs: number, providerMs: number | undefined): LatencySplit {
  if (providerMs === undefined) {
    throw new H8MetricsError(
      'LATENCIA_INCOMPLETA',
      'falta la latencia del proveedor. Sin ella la espera remota se contabiliza como carga ' +
        'local, y se dimensionaría la máquina para arreglar una espera de red.',
    );
  }
  if (endToEndMs < 0 || providerMs < 0) {
    throw new H8MetricsError('LATENCIA_IMPOSIBLE', 'una latencia negativa no es una medición.');
  }
  if (providerMs > endToEndMs) {
    throw new H8MetricsError(
      'LATENCIA_IMPOSIBLE',
      `el proveedor tardó ${String(providerMs)} ms dentro de una operación de ` +
        `${String(endToEndMs)} ms. La parte local saldría negativa.`,
    );
  }
  const localMs = endToEndMs - providerMs;
  return {
    endToEndMs,
    localMs,
    providerMs,
    providerShare: endToEndMs === 0 ? 0 : providerMs / endToEndMs,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Sobre de recursos — INFRA-01 / CAL-12
 * ──────────────────────────────────────────────────────────────────────────── */

/** Los servicios del compose que tienen que aparecer en una ventana válida. */
export const H8_SERVICES = [
  'api',
  'web',
  'verifier',
  'authoring-worker',
  'measurement-worker',
  'background-worker',
  'postgres',
] as const;
export type H8Service = (typeof H8_SERVICES)[number];

export interface ObservationWindow {
  readonly runId: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly durationMinutes: number;
  /** Resúmenes por servicio y métrica. */
  readonly perService: Readonly<Record<string, readonly MetricSummary[]>>;
  /** Si la corrida ejercitó las capacidades multimodales de H8. */
  readonly multimodalCapabilitiesActive: boolean;
}

/**
 * Mínimos para que una ventana sirva de base a `INFRA-01`.
 *
 * No salen de ninguna norma —el Maestro no fija duración— y por eso van aquí,
 * declarados y con nombre, en vez de escondidos dentro de un `if`. Son el
 * criterio de que la ventana **existe**, no un umbral calibrado: `CAL-12` fija
 * los límites operativos, no la talla de la muestra que los sostiene.
 */
export const WINDOW_MINIMUMS = Object.freeze({
  durationMinutes: 30,
  samplesPerMetric: 20,
});

export interface ResourceEnvelope {
  readonly runId: string;
  readonly perService: Readonly<
    Record<string, { readonly cpuPercentP95: number; readonly rssBytesMax: number }>
  >;
  /**
   * El sobre **no** trae los límites de Compose ya escritos. Trae lo observado,
   * que es lo que la norma autoriza a usar; poner aquí un `cpus: '1.5'` sería
   * fijar el límite desde el código en vez de desde la medida.
   */
  readonly basis: string;
}

/**
 * Deriva el sobre de recursos observado, o se niega.
 *
 * **Este es el punto donde `INFRA-01` se enchufa.** El mecanismo está completo:
 * en cuanto exista una corrida de H8 con sus capacidades activas, devuelve el
 * sobre. Lo que no hace nunca es rellenar lo que falta — ni con un valor por
 * omisión ni con la última cifra conocida—, porque la única razón por la que
 * §13-H8 existe es que la infraestructura **no** se dimensione por una cifra
 * histórica.
 */
export function deriveResourceEnvelope(window: ObservationWindow): ResourceEnvelope {
  if (window.durationMinutes < WINDOW_MINIMUMS.durationMinutes) {
    throw new H8MetricsError(
      'VENTANA_INSUFICIENTE',
      `la ventana dura ${String(window.durationMinutes)} min y el mínimo declarado es ` +
        `${String(WINDOW_MINIMUMS.durationMinutes)}. Un pico de arranque no es carga de régimen.`,
    );
  }
  if (!window.multimodalCapabilitiesActive) {
    throw new H8MetricsError(
      'VENTANA_INSUFICIENTE',
      'la corrida no tenía activas las capacidades multimodales de H8. Dimensionar con ella ' +
        'mediría un sistema que sólo escribe texto y lo aplicaría a uno que además transcribe, ' +
        'habla e interpreta imágenes.',
    );
  }

  const perService: Record<string, { cpuPercentP95: number; rssBytesMax: number }> = {};

  for (const servicio of H8_SERVICES) {
    const resumenes = window.perService[servicio];
    if (resumenes === undefined || resumenes.length === 0) {
      throw new H8MetricsError(
        'SERVICIO_SIN_MEDIR',
        `no hay medidas de «${servicio}». Un servicio ausente del sobre pasaría por no consumir ` +
          `nada, y el sobre saldría más pequeño que el sistema que describe.`,
      );
    }
    const cpu = resumenes.find((r) => r.metric === 'service.cpu.percent');
    const rss = resumenes.find((r) => r.metric === 'service.rss.bytes');
    if (cpu === undefined || rss === undefined) {
      throw new H8MetricsError(
        'SERVICIO_SIN_MEDIR',
        `«${servicio}» no trae CPU y RSS, que son las dos que dimensionan. §13-H8 las pide por ` +
          `servicio, no agregadas.`,
      );
    }
    for (const resumen of [cpu, rss]) {
      if (resumen.samples < WINDOW_MINIMUMS.samplesPerMetric) {
        throw new H8MetricsError(
          'VENTANA_INSUFICIENTE',
          `«${servicio}» tiene ${String(resumen.samples)} muestras de ${resumen.metric} y el ` +
            `mínimo declarado es ${String(WINDOW_MINIMUMS.samplesPerMetric)}.`,
        );
      }
    }
    perService[servicio] = { cpuPercentP95: cpu.p95, rssBytesMax: rss.max };
  }

  return {
    runId: window.runId,
    perService,
    basis:
      `observado en ${window.runId} durante ${String(window.durationMinutes)} min con las ` +
      `capacidades multimodales activas; CPU por p95 y memoria por máximo, porque una clase que ` +
      `se queda sin RAM se cae y una que pasa del p95 de CPU sólo va lenta`,
  };
}
