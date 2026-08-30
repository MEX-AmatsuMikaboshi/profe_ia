import { describe, expect, it } from 'vitest';

import {
  H8MetricsError,
  H8_METRICS,
  H8_METRIC_UNITS,
  H8_SERVICES,
  WINDOW_MINIMUMS,
  deriveResourceEnvelope,
  splitLatency,
  summarize,
  type MetricSummary,
  type ObservationWindow,
} from '../src/h8-metrics.js';

// `samples: number` explícito: `WINDOW_MINIMUMS` está congelado y su
// `samplesPerMetric` tiene tipo literal `20`, así que el parámetro se inferiría
// como `20` y pasarle `3` no compilaría. Lo cazó `ci:arch:test-typecheck`.
function resumenes(samples: number = WINDOW_MINIMUMS.samplesPerMetric): readonly MetricSummary[] {
  return [
    summarize('service.cpu.percent', Array.from({ length: samples }, (_, i) => i + 1)),
    summarize('service.rss.bytes', Array.from({ length: samples }, (_, i) => (i + 1) * 1_000_000)),
  ];
}

function ventana(overrides: Partial<ObservationWindow> = {}): ObservationWindow {
  const perService: Record<string, readonly MetricSummary[]> = {};
  for (const s of H8_SERVICES) perService[s] = resumenes();
  return {
    runId: 'h8-run-1',
    startedAt: '2026-08-29T10:00:00.000Z',
    endedAt: '2026-08-29T11:00:00.000Z',
    durationMinutes: 60,
    perService,
    multimodalCapabilitiesActive: true,
    ...overrides,
  };
}

describe('T-H8-09 — catálogo de métricas', () => {
  it('cubre las categorías que §13-H8 enumera', () => {
    const nombres = [...H8_METRICS];
    for (const esperada of [
      'service.cpu.percent',
      'service.rss.bytes',
      'host.memory.available.bytes',
      'host.disk.free.bytes',
      'host.disk.growth.bytes_per_hour',
      'postgres.connections.active',
      'postgres.queries.slow.count',
      'queue.depth',
      'queue.oldest.age.seconds',
      'latency.end_to_end.ms',
      'latency.local.ms',
      'latency.provider.ms',
    ]) {
      expect(nombres, esperada).toContain(esperada);
    }
  });

  it('toda métrica declara unidad: un número sin unidad no se compara entre corridas', () => {
    for (const m of H8_METRICS) {
      expect(H8_METRIC_UNITS[m], m).toBeTruthy();
    }
    expect(Object.keys(H8_METRIC_UNITS)).toHaveLength(H8_METRICS.length);
  });

  it('una métrica fuera del catálogo lanza', () => {
    expect(() =>
      summarize('service.cpu' as unknown as (typeof H8_METRICS)[number], [1]),
    ).toThrowError(expect.objectContaining({ code: 'METRICA_DESCONOCIDA' }) as unknown as Error);
  });
});

describe('T-H8-09 — resumen', () => {
  it('media, p95 y máximo de una serie conocida', () => {
    const r = summarize('service.cpu.percent', [10, 20, 30, 40, 50]);
    expect(r.samples).toBe(5);
    expect(r.mean).toBe(30);
    expect(r.max).toBe(50);
    // p95 interpolado: posición 0.95·4 = 3.8 → 40 + (50-40)·0.8 = 48
    expect(r.p95).toBeCloseTo(48, 6);
  });

  it('el p95 no es el máximo con otro nombre', () => {
    // Con índice redondeado los dos coincidirían y el percentil dejaría de
    // informar: se dimensionaría pagando el pico como si fuera la carga.
    const r = summarize('service.cpu.percent', [1, 1, 1, 1, 1, 1, 1, 1, 1, 100]);
    expect(r.p95).toBeLessThan(r.max);
  });

  it('el orden de llegada no cambia el resumen', () => {
    const a = summarize('service.rss.bytes', [5, 1, 4, 2, 3]);
    const b = summarize('service.rss.bytes', [1, 2, 3, 4, 5]);
    expect(a).toStrictEqual(b);
  });

  it('una muestra vacía lanza en vez de devolver ceros', () => {
    expect(() => summarize('service.cpu.percent', [])).toThrowError(
      expect.objectContaining({ code: 'MUESTRA_VACIA' }) as unknown as Error,
    );
  });

  it('una sola muestra da los tres iguales, sin inventar dispersión', () => {
    const r = summarize('queue.depth', [7]);
    expect([r.mean, r.p95, r.max]).toStrictEqual([7, 7, 7]);
  });
});

describe('T-H8-09 — latencia local frente a la del proveedor', () => {
  it('separa las dos partes y da la proporción remota', () => {
    const s = splitLatency(1000, 800);
    expect(s.localMs).toBe(200);
    expect(s.providerMs).toBe(800);
    expect(s.providerShare).toBeCloseTo(0.8, 6);
  });

  it('sin la parte del proveedor lanza: se contabilizaría como carga local', () => {
    expect(() => splitLatency(1000, undefined)).toThrowError(
      expect.objectContaining({ code: 'LATENCIA_INCOMPLETA' }) as unknown as Error,
    );
  });

  it('un proveedor más lento que el total no es ruido: dejaría lo local en negativo', () => {
    expect(() => splitLatency(500, 900)).toThrowError(
      expect.objectContaining({ code: 'LATENCIA_IMPOSIBLE' }) as unknown as Error,
    );
  });

  it('una latencia negativa no es una medición', () => {
    expect(() => splitLatency(-1, 0)).toThrowError(
      expect.objectContaining({ code: 'LATENCIA_IMPOSIBLE' }) as unknown as Error,
    );
  });

  it('una operación sin proveedor es local entera', () => {
    const s = splitLatency(120, 0);
    expect(s.localMs).toBe(120);
    expect(s.providerShare).toBe(0);
  });
});

describe('T-H8-09 — sobre de recursos (INFRA-01)', () => {
  it('con una ventana completa devuelve el sobre observado', () => {
    const sobre = deriveResourceEnvelope(ventana());
    expect(Object.keys(sobre.perService).sort()).toStrictEqual([...H8_SERVICES].sort());
    expect(sobre.basis).toContain('h8-run-1');
  });

  it('el sobre no trae límites de Compose escritos: trae lo observado', () => {
    const sobre = deriveResourceEnvelope(ventana());
    const primero = sobre.perService['api'];
    expect(Object.keys(primero ?? {})).toStrictEqual(['cpuPercentP95', 'rssBytesMax']);
    // Nada de `cpus` ni `mem_limit`: eso sería fijar el límite desde el código.
    expect(JSON.stringify(sobre)).not.toMatch(/cpus|mem_limit/);
  });

  describe('se niega antes que rellenar', () => {
    it('una ventana demasiado corta lanza: un pico de arranque no es carga de régimen', () => {
      expect(() => deriveResourceEnvelope(ventana({ durationMinutes: 5 }))).toThrowError(
        expect.objectContaining({ code: 'VENTANA_INSUFICIENTE' }) as unknown as Error,
      );
    });

    it('sin capacidades multimodales activas lanza', () => {
      // Medir un sistema que sólo escribe texto y aplicarlo a uno que además
      // transcribe, habla e interpreta imágenes es la cifra histórica que
      // §13-H8 existe para prohibir.
      expect(() =>
        deriveResourceEnvelope(ventana({ multimodalCapabilitiesActive: false })),
      ).toThrowError(expect.objectContaining({ code: 'VENTANA_INSUFICIENTE' }) as unknown as Error);
    });

    it('un servicio sin medir lanza, en vez de pasar por no consumir nada', () => {
      const v = ventana();
      const perService = { ...v.perService };
      delete perService['verifier'];
      expect(() => deriveResourceEnvelope({ ...v, perService })).toThrowError(
        expect.objectContaining({ code: 'SERVICIO_SIN_MEDIR' }) as unknown as Error,
      );
    });

    it('un servicio con CPU pero sin RSS lanza: §13-H8 pide las dos', () => {
      const v = ventana();
      const perService = { ...v.perService };
      perService['api'] = [summarize('service.cpu.percent', [1, 2, 3])];
      expect(() => deriveResourceEnvelope({ ...v, perService })).toThrowError(
        expect.objectContaining({ code: 'SERVICIO_SIN_MEDIR' }) as unknown as Error,
      );
    });

    it('muestras por debajo del mínimo declarado lanzan', () => {
      const v = ventana();
      const perService = { ...v.perService };
      perService['web'] = resumenes(3);
      expect(() => deriveResourceEnvelope({ ...v, perService })).toThrowError(
        expect.objectContaining({ code: 'VENTANA_INSUFICIENTE' }) as unknown as Error,
      );
    });
  });

  it('los mínimos están declarados con nombre, no escondidos en un if', () => {
    expect(WINDOW_MINIMUMS.durationMinutes).toBeGreaterThan(0);
    expect(WINDOW_MINIMUMS.samplesPerMetric).toBeGreaterThan(0);
  });

  it('el error lleva código', () => {
    try {
      deriveResourceEnvelope(ventana({ durationMinutes: 1 }));
      expect.unreachable('debía lanzar');
    } catch (error) {
      expect(error).toBeInstanceOf(H8MetricsError);
      expect((error as H8MetricsError).code).toBe('VENTANA_INSUFICIENTE');
    }
  });
});
