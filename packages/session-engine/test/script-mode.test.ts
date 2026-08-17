import { describe, expect, it } from 'vitest';
import {
  SESSION_SCRIPT_MODE_SCHEMA_VERSION,
  ScriptedActKind,
  SessionScriptModeController,
  SessionScriptModeError,
  assertNoFrozenSolution,
  assertNoLiveGeneration,
  catalogHash,
  enterDegradedMode,
} from '../src/index.js';
import type { ScriptedCatalog } from '../src/index.js';

const AT = '2026-08-17T11:00:00.000Z';

function catalog(overrides: Partial<ScriptedCatalog> = {}): ScriptedCatalog {
  return {
    schemaVersion: SESSION_SCRIPT_MODE_SCHEMA_VERSION,
    catalogVersion: 'script-catalog-fixture-v1',
    purpose: 'test_fixture',
    packageVersion: {
      artifactId: 'content-package-fixture',
      version: 'fixture-v1',
      hash: 'a'.repeat(64),
    },
    entries: [
      {
        contentId: 'content-explanation-1',
        kind: 'explanation',
        kcId: 'KC03',
        selectorKey: 'intro',
        text: 'Explicación congelada de KC03.',
        anchors: ['fragment-1'],
      },
      {
        contentId: 'content-feedback-1',
        kind: 'templated_feedback',
        kcId: 'KC03',
        selectorKey: 'E-SYN-PRECEDENCE',
        text: 'Revisa el uso de paréntesis entre conectivos binarios.',
        anchors: ['fragment-2'],
      },
    ],
    ...overrides,
  };
}

function expectCode(operation: () => unknown, code: string): void {
  try {
    operation();
    throw new Error('se esperaba SessionScriptModeError');
  } catch (error) {
    expect(error).toBeInstanceOf(SessionScriptModeError);
    expect((error as SessionScriptModeError).code).toBe(code);
  }
}

describe('T-H6-14 — entrega desde contenido congelado', () => {
  it('entrega la entrada exacta y declara que no hubo generación en vivo', () => {
    const controller = new SessionScriptModeController(catalog());
    const delivery = controller.deliver('script', {
      kind: 'explanation',
      kcId: 'KC03',
      selectorKey: 'intro',
    });
    expect(delivery.contentId).toBe('content-explanation-1');
    expect(delivery.text).toBe('Explicación congelada de KC03.');
    expect(delivery.liveGeneration).toBe(false);
    expect(delivery.catalogVersion).toBe('script-catalog-fixture-v1');
  });

  it('el feedback plantillado se selecciona por código de error cerrado', () => {
    const controller = new SessionScriptModeController(catalog());
    const delivery = controller.deliver('degraded', {
      kind: 'templated_feedback',
      kcId: 'KC03',
      selectorKey: 'E-SYN-PRECEDENCE',
    });
    expect(delivery.kind).toBe('templated_feedback');
    expect(delivery.mode).toBe('degraded');
  });

  /**
   * El punto de §15.3: el modo degradado **no rellena huecos**. Devolver lo más
   * parecido lo convertiría en una generación silenciosa, que es exactamente lo
   * que la norma prohíbe.
   */
  it('sin la clave exacta falla en vez de devolver lo más parecido', () => {
    const controller = new SessionScriptModeController(catalog());
    expectCode(
      () => controller.deliver('script', {
        kind: 'explanation',
        kcId: 'KC03',
        selectorKey: 'intro-alternativa',
      }),
      'SCRIPT_CONTENT_MISSING',
    );
    expectCode(
      () => controller.deliver('script', {
        kind: 'explanation',
        kcId: 'KC99',
        selectorKey: 'intro',
      }),
      'SCRIPT_CONTENT_MISSING',
    );
  });

  it('rechaza un catálogo con dos entradas para la misma clave', () => {
    const base = catalog();
    expectCode(
      () => new SessionScriptModeController({
        ...base,
        entries: [...base.entries, { ...base.entries[0]!, contentId: 'content-explanation-2' }],
      }),
      'SCRIPT_CATALOG_INVALID',
    );
  });

  it('el hash del catálogo es estable', () => {
    expect(catalogHash(catalog())).toBe(catalogHash(catalog()));
    expect(catalogHash(catalog())).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('T-H6-14 — ninguna ruta de generación en vivo', () => {
  it('guion y degradado lanzan donde el bucle en vivo llamaría al proveedor', () => {
    for (const mode of ['script', 'degraded'] as const) {
      expectCode(
        () => assertNoLiveGeneration(mode, 'explain_block'),
        'SCRIPT_LIVE_GENERATION_PROHIBITED',
      );
    }
    expect(() => assertNoLiveGeneration('live', 'explain_block')).not.toThrow();
  });

  it('el controlador no expone ninguna forma de generar', () => {
    const controller = new SessionScriptModeController(catalog());
    for (const name of ['generate', 'complete', 'send', 'execute', 'fallbackText']) {
      expect(name in controller).toBe(false);
      expect((controller as unknown as Record<string, unknown>)[name]).toBeUndefined();
    }
  });

  it('rechaza cualquier solución dentro del contenido congelado', () => {
    expect(() => assertNoFrozenSolution(catalog())).not.toThrow();
    expectCode(
      () => assertNoFrozenSolution({ entries: [{ text: 'x', solution: 'A∧B ⊢ A' }] }),
      'SCRIPT_SOLUTION_PROHIBITED',
    );
    expectCode(
      () => assertNoFrozenSolution({ nested: { deep: { certificate: {} } } }),
      'SCRIPT_SOLUTION_PROHIBITED',
    );
  });
});

describe('T-H6-14 — desviación del bloque en modo degradado', () => {
  function entry(overrides: Record<string, unknown> = {}) {
    return {
      eventId: 'degraded-event-1',
      occurredAt: AT,
      blockId: 'block-1',
      providerFailureRef: 'failure-1',
      substantiveConditionAlteration: false,
      alterationJustification: 'El bloque completó todos sus actos con contenido congelado.',
      uncoveredActKinds: [] as string[],
      ...overrides,
    };
  }

  it('sin actos descubiertos admite declarar que la condición no cambió', () => {
    const assessment = enterDegradedMode(entry());
    expect(assessment.blockMarkedAsDeviation).toBe(false);
    expect(assessment.mode).toBe('degraded');
  });

  it('marca desviación cuando se declara alteración sustantiva', () => {
    const assessment = enterDegradedMode(
      entry({
        substantiveConditionAlteration: true,
        alterationJustification: 'Se sustituyó la práctica guiada por una explicación congelada.',
      }),
    );
    expect(assessment.blockMarkedAsDeviation).toBe(true);
  });

  /**
   * La asimetría es el control: declarar desviación siempre se admite, pero
   * declarar que no la hubo con actos sin cubrir se rechaza. Si el guion no pudo
   * entregar lo que el bloque pedía, la condición cambió por definición, y
   * aceptar ahí un «no sustantivo» dejaría la desviación fuera del registro justo
   * en el caso en que más importa.
   */
  it('rechaza declarar «sin alteración» cuando quedaron actos sin contenido congelado', () => {
    expectCode(
      () => enterDegradedMode(entry({ uncoveredActKinds: ['practice_statement'] })),
      'SCRIPT_DEVIATION_UNDERSTATED',
    );
    const assessment = enterDegradedMode(
      entry({
        uncoveredActKinds: ['practice_statement'],
        substantiveConditionAlteration: true,
      }),
    );
    expect(assessment.blockMarkedAsDeviation).toBe(true);
    expect(assessment.uncoveredActKinds).toEqual(['practice_statement']);
  });

  it('exige justificación y referencia del fallo de proveedor', () => {
    expectCode(
      () => enterDegradedMode(entry({ alterationJustification: '' })),
      'SCRIPT_CATALOG_INVALID',
    );
    const withoutFailure = Object.fromEntries(
      Object.entries(entry()).filter(([key]) => key !== 'providerFailureRef'),
    );
    expectCode(() => enterDegradedMode(withoutFailure), 'SCRIPT_CATALOG_INVALID');
  });

  it('los actos descubiertos deben ser del catálogo cerrado de actos', () => {
    expectCode(
      () => enterDegradedMode(entry({ uncoveredActKinds: ['improvisacion'] })),
      'SCRIPT_CATALOG_INVALID',
    );
    expect(ScriptedActKind.options).toContain('templated_feedback');
  });
});
