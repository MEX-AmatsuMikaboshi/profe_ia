import { context, trace, type Attributes, type AttributeValue, type Span, type Tracer } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchSpanProcessor, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

/**
 * `@profesor-ia/observability` — arranque local de OpenTelemetry (Plan.md
 * T-H3-05; Maestro §2476: «OpenTelemetry desde desarrollo», CONGELADA, con
 * registro **local** y sin monitoreo de pago).
 *
 * Vive en `tools/` y no en `packages/` porque la lista de `packages/` es
 * obligatoria (P-II §3.1) y no contempla observabilidad; es el mismo criterio
 * de D-1 (CLI) y D-32 (harness de benchmark). Queda registrado como **D-36**.
 *
 * **No puede vivir en `contracts`**, que sería el otro sitio compartido: todo
 * el mundo depende de `contracts`, `logic-core` incluido, así que meter aquí un
 * exportador HTTP arrastraría un cliente de red a la ruta de verificación y
 * rompería I-3. Lo cazarían `ci:logic:no-net` y la regla `i3-verifier-sin-red`,
 * y tendrían razón.
 *
 * ## Lo que este módulo **no** es
 *
 * No es una segunda bitácora. P-II §9.3 lo dice de la evidencia multimodal y el
 * principio es general: **no se crea una telemetría experimental paralela**. La
 * evidencia vive en el `evidence-ledger`, con su cadena de hashes, y es lo que
 * un auditor lee. Las trazas sirven para otra cosa —latencia, fallo, dónde se
 * atascó una operación— y se enlazan con la evidencia por `traceId`, campo que
 * `EvidenceEvent` ya reserva (P-II §9.1).
 *
 * Que esa frontera se respete no se deja a la buena voluntad de quien escribe
 * un span: `assertOperationalAttributes()` **rechaza** el atributo que parezca
 * contenido en vez de identificador, y se aplica en `withSpan()`.
 */

/**
 * Se reexporta la superficie de tipos que las apps necesitan para que
 * `@opentelemetry/api` sea dependencia de **un solo** workspace. Con cada app
 * declarándolo por su cuenta, dos servicios podrían acabar con versiones
 * distintas del registro global de OTel, que es de proceso: los spans de uno
 * dejarían de verse desde el otro sin que nada lo dijera.
 */
export type { Attributes, Span, Tracer } from '@opentelemetry/api';

export const OBSERVABILITY_SCHEMA_VERSION = 'observability-v1' as const;

export type ObservabilityErrorCode =
  | 'OTEL_ENDPOINT_MISSING'
  | 'PROHIBITED_ATTRIBUTE'
  | 'TELEMETRY_ALREADY_STARTED';

export class ObservabilityError extends Error {
  constructor(
    readonly code: ObservabilityErrorCode,
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = 'ObservabilityError';
  }
}

/**
 * Nombres de atributo prohibidos en un span. La lista mira la **forma** del
 * nombre, no su valor exacto, porque lo que se quiere impedir es la categoría:
 * enunciados, derivaciones, respuestas, transcripciones y todo lo que pueda
 * identificar a una persona.
 *
 * `participantPseudoId` entra en la lista aunque sea un seudónimo. El Maestro
 * es explícito: «un hash o un seudónimo no se presentan como anonimización»
 * (P-II §9.1). El seudónimo pertenece a la bitácora, que está en la base con
 * sus permisos; una traza acaba en la salida estándar de un colector.
 */
const PROHIBITED_ATTRIBUTE_PATTERN =
  /(formula|proof|derivation|derivacion|solution|solucion|certificate|certificado|answer|respuesta|statement|enunciado|transcript|transcripcion|prompt|hint|pista|participant|pseudo|email|correo|name|nombre|text|texto|payload|body|content|contenido)/iu;

/**
 * Tope de longitud de un valor de texto. Un identificador cabe de sobra; un
 * enunciado o una derivación, no. Es la segunda mitad del control: sin él,
 * bastaría llamar `detalle` a un atributo para colar la derivación entera.
 */
export const MAX_ATTRIBUTE_TEXT_LENGTH = 200;

function assertAttributeValue(key: string, value: AttributeValue | undefined): void {
  if (value === undefined) return;
  if (Array.isArray(value)) {
    for (const entry of value) assertAttributeValue(key, entry ?? undefined);
    return;
  }
  if (typeof value === 'string' && value.length > MAX_ATTRIBUTE_TEXT_LENGTH) {
    throw new ObservabilityError(
      'PROHIBITED_ATTRIBUTE',
      `${key}: ${value.length} caracteres supera el tope de ${MAX_ATTRIBUTE_TEXT_LENGTH}; ` +
        'un span lleva identificadores y resultados, no contenido',
    );
  }
}

/**
 * Aplica la frontera de P-II §9.3 sobre los atributos de un span. **Lanza** en
 * vez de recortar: un atributo que se limpiara solo dejaría al que lo escribió
 * creyendo que registró algo que no está.
 */
export function assertOperationalAttributes(attributes: Attributes): void {
  for (const [key, value] of Object.entries(attributes)) {
    if (PROHIBITED_ATTRIBUTE_PATTERN.test(key)) {
      throw new ObservabilityError(
        'PROHIBITED_ATTRIBUTE',
        `${key}: la traza no es una segunda bitácora (P-II §9.3); la evidencia va al ledger y se enlaza por traceId`,
      );
    }
    assertAttributeValue(key, value);
  }
}

export interface TelemetryOptions {
  /** Nombre del servicio, tal cual aparece en el compose. */
  readonly service: string;
  readonly version?: string;
  /**
   * Endpoint OTLP/HTTP del colector local. Por omisión se lee de
   * `OTEL_EXPORTER_OTLP_ENDPOINT`, que el compose define por servicio.
   */
  readonly endpoint?: string;
  /** Intervalo de exportación de métricas. */
  readonly metricIntervalMs?: number;
  /** Para que el llamador registre lo que pasa con su propio formato de log. */
  readonly onDiagnostic?: (event: string, fields: Record<string, unknown>) => void;
}

export interface TelemetryHandle {
  readonly service: string;
  readonly endpoint: string;
  readonly tracer: Tracer;
  shutdown(): Promise<void>;
}

const DEFAULT_METRIC_INTERVAL_MS = 15_000;

/**
 * Arranca trazas y métricas contra el colector local.
 *
 * **El endpoint es obligatorio y su ausencia lanza.** T-H3-05 pide OTel «desde
 * el arranque»: un servicio que levanta sin saber a dónde exportar está mal
 * configurado, y arrancar igual con la telemetría apagada es justo la
 * degradación silenciosa que este repositorio no admite. Distinto es que el
 * colector no conteste **en marcha**: eso se registra por `onDiagnostic` y no
 * tumba el servicio, porque una clase no se cae porque falle su telemetría.
 */
export function startTelemetry(options: TelemetryOptions): TelemetryHandle {
  const endpoint = options.endpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (endpoint === undefined || endpoint.trim().length === 0) {
    throw new ObservabilityError(
      'OTEL_ENDPOINT_MISSING',
      'define OTEL_EXPORTER_OTLP_ENDPOINT: T-H3-05 exige telemetría desde el arranque, ' +
        'y arrancar con la telemetría apagada sin decirlo sería degradación silenciosa',
    );
  }

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: options.service,
    ...(options.version === undefined ? {} : { [ATTR_SERVICE_VERSION]: options.version }),
  });

  const traceExporter = new OTLPTraceExporter({ url: `${endpoint}/v1/traces` });
  const tracerProvider = new NodeTracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor(traceExporter)],
  });
  tracerProvider.register();

  const meterProvider = new MeterProvider({
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
        exportIntervalMillis: options.metricIntervalMs ?? DEFAULT_METRIC_INTERVAL_MS,
      }),
    ],
  });

  /**
   * Métricas **desde el arranque**, trazas cuando hay operación. Un servicio
   * que todavía no atiende nada emite su latido de proceso —que es un dato
   * real— y ningún span: un span de «arranqué» para poder decir que hay trazas
   * sería éxito simulado, y es la razón por la que esta tarea llevaba abierta
   * desde F3.
   */
  const meter = meterProvider.getMeter(options.service);
  const uptime = meter.createObservableGauge('profesor_ia.service.uptime', {
    description: 'Segundos desde que el proceso arrancó.',
    unit: 's',
  });
  const startedAt = process.hrtime.bigint();
  uptime.addCallback((result) => {
    result.observe(Number(process.hrtime.bigint() - startedAt) / 1e9, {
      service: options.service,
    });
  });

  options.onDiagnostic?.('telemetry_started', {
    service: options.service,
    endpoint,
    schemaVersion: OBSERVABILITY_SCHEMA_VERSION,
  });

  return {
    service: options.service,
    endpoint,
    tracer: tracerProvider.getTracer(options.service),
    async shutdown(): Promise<void> {
      // Vaciar antes de salir. Sin esto, la última operación de una sesión
      // —justo la que suele interesar cuando algo falló— se queda en el lote.
      await tracerProvider.shutdown();
      await meterProvider.shutdown();
      options.onDiagnostic?.('telemetry_stopped', { service: options.service });
    },
  };
}

/**
 * Ejecuta `fn` dentro de un span, con los atributos ya comprobados contra la
 * frontera de §9.3. Un error marca el span y **se vuelve a lanzar**: un span
 * que registrara el fallo y se lo tragara convertiría la telemetría en un
 * sumidero de errores.
 */
export async function withSpan<T>(
  tracer: Tracer,
  name: string,
  attributes: Attributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  assertOperationalAttributes(attributes);
  const span = tracer.startSpan(name, { attributes });
  try {
    return await context.with(trace.setSpan(context.active(), span), () => fn(span));
  } catch (err) {
    span.recordException(err instanceof Error ? err : new Error(String(err)));
    span.setStatus({ code: 2, message: err instanceof Error ? err.name : 'error' });
    throw err;
  } finally {
    span.end();
  }
}

/** Añade atributos a un span en curso, con la misma frontera. */
export function setOperationalAttributes(span: Span, attributes: Attributes): void {
  assertOperationalAttributes(attributes);
  span.setAttributes(attributes);
}

/**
 * `traceId` del span activo, para escribirlo en la línea de log y en el
 * `EvidenceEvent`. Es el único puente entre las dos: la traza no duplica la
 * evidencia, la referencia.
 */
export function currentTraceId(): string | undefined {
  const active = trace.getSpan(context.active());
  const traceId = active?.spanContext().traceId;
  return traceId === undefined || /^0+$/u.test(traceId) ? undefined : traceId;
}
