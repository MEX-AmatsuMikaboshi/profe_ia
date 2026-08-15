import { describe, expect, it } from 'vitest';
import {
  CANARY_ASSET_CLASSES,
  CANARY_DETECTOR_SCOPES,
  CANARY_INCIDENT_CATEGORY,
  CANARY_INCIDENT_LEVEL,
  CanaryPlanCalibrationPendingError,
  CanaryRegistry,
  CanaryRunBlock,
  DuplicateCanaryError,
  EmptyCanaryScopesError,
  type CanaryRecord,
} from '../src/index.js';

const CADENA = 'ZZ-CANARIO-DE-PRUEBA-4417';

function canario(overrides: Partial<CanaryRecord> = {}): CanaryRecord {
  return {
    canaryId: 'canary-01',
    assetClass: 'soluciones',
    location: 'private_solutions.solution.body',
    freezeVersion: 'freeze-2026-08-15',
    value: CADENA,
    scopes: ['contexto_construido', 'payload_saliente', 'salida_del_modelo'],
    incidentProcedure: 'abortar, incidente nivel 3, bloquear corrida, investigar la ruta',
    ...overrides,
  };
}

describe('registro de canarios (T-H4-05 ← P-II §11.3)', () => {
  it('las clases de activo y las superficies son las literales del §11.3', () => {
    expect(CANARY_ASSET_CLASSES).toEqual(['soluciones', 'sondas_futuras', 'claves']);
    expect(CANARY_DETECTOR_SCOPES).toEqual([
      'contexto_construido',
      'payload_saliente',
      'salida_del_modelo',
      'logs_y_trazas',
      'exportes',
    ]);
  });

  it('registra los seis metadatos que exige la norma', () => {
    const registro = new CanaryRegistry();
    registro.register(canario());

    expect(registro.size()).toBe(1);
  });

  it('un canary_id repetido es un fallo', () => {
    const registro = new CanaryRegistry();
    registro.register(canario());

    expect(() => registro.register(canario())).toThrow(DuplicateCanaryError);
  });

  it('un canario sin superficies no se registra: daría cobertura aparente', () => {
    const registro = new CanaryRegistry();

    expect(() => registro.register(canario({ scopes: [] }))).toThrow(EmptyCanaryScopesError);
  });
});

describe('detección y bloqueo de corrida', () => {
  function registroConCanario() {
    const registro = new CanaryRegistry();
    registro.register(canario());
    return registro;
  }

  it('detecta la cadena en una superficie declarada', () => {
    const registro = registroConCanario();
    const hits = registro.detect(`texto con ${CADENA} dentro`, 'payload_saliente');

    expect(hits).toEqual([
      { canaryId: 'canary-01', assetClass: 'soluciones', scope: 'payload_saliente' },
    ]);
  });

  it('no detecta en una superficie que el canario no declara', () => {
    const registro = registroConCanario();

    expect(registro.detect(`texto con ${CADENA}`, 'exportes')).toEqual([]);
  });

  it('un payload limpio no produce hits', () => {
    const registro = registroConCanario();

    expect(registro.detect('un texto cualquiera', 'payload_saliente')).toEqual([]);
    expect(registro.isRunBlocked()).toBe(false);
  });

  it('un hit bloquea la corrida y el bloqueo no se puede quitar', () => {
    const registro = registroConCanario();
    registro.observe(`fuga: ${CADENA}`, 'salida_del_modelo');

    expect(registro.isRunBlocked()).toBe(true);
    // No hay API para desbloquear: un bloqueo que se pudiera quitar sería
    // decorativo. Se comprueba que la superficie pública no la ofrece.
    expect(Object.keys(registro)).not.toContain('unblock');
    expect((registro as unknown as Record<string, unknown>)['unblock']).toBeUndefined();
    expect((registro as unknown as Record<string, unknown>)['reset']).toBeUndefined();
  });

  it('`observeOrThrow` aborta, que es la vía por omisión', () => {
    const registro = registroConCanario();

    expect(() => registro.observeOrThrow(`fuga: ${CADENA}`, 'contexto_construido')).toThrow(
      CanaryRunBlock,
    );
    expect(registro.isRunBlocked()).toBe(true);
  });

  it('el error nombra el incidente nivel 3 y su categoría, sin imprimir la cadena', () => {
    const registro = registroConCanario();

    try {
      registro.observeOrThrow(`fuga: ${CADENA}`, 'contexto_construido');
      expect.unreachable('debía abortar');
    } catch (error) {
      const mensaje = (error as Error).message;
      expect(mensaje).toContain(String(CANARY_INCIDENT_LEVEL));
      expect(mensaje).toContain(CANARY_INCIDENT_CATEGORY);
      expect(mensaje).toContain('canary-01');
      // La cadena canario no viaja en el mensaje: imprimirla la filtraría por
      // el mismo canal que vigila.
      expect(mensaje).not.toContain(CADENA);
    }
  });

  it('la categoría de nivel 3 nombra las tres clases de activo con canario', () => {
    for (const clase of ['soluciones', 'sondas', 'secretos']) {
      expect(CANARY_INCIDENT_CATEGORY).toContain(clase);
    }
  });

  it('el gate cuenta hits observados: cero mientras nada se filtre', () => {
    const registro = registroConCanario();
    expect(registro.observedHits()).toEqual([]);

    registro.observe(`fuga: ${CADENA}`, 'exportes'); // superficie no declarada
    expect(registro.observedHits()).toEqual([]);

    registro.observe(`fuga: ${CADENA}`, 'payload_saliente');
    expect(registro.observedHits()).toHaveLength(1);
  });

  it('el detector para el filtro de egreso devuelve ids, no cadenas', () => {
    const registro = registroConCanario();
    const detector = registro.detectorFor('contexto_construido');

    const ids = detector(`contexto con ${CADENA}`);
    expect(ids).toEqual(['canary-01']);
    expect(ids.join()).not.toContain(CADENA);
  });
});

describe('cantidad, patrón y rotación son calibrables (§11.3)', () => {
  it('pedir el plan falla cerrado en vez de fabricar una política', () => {
    expect(() => CanaryRegistry.plan()).toThrow(CanaryPlanCalibrationPendingError);
  });

  it('el error dice qué falta y que el gate sigue siendo cero hits', () => {
    try {
      CanaryRegistry.plan();
      expect.unreachable('debía fallar cerrado');
    } catch (error) {
      const mensaje = (error as Error).message;
      expect(mensaje).toContain('PENDING_CALIBRATION');
      expect(mensaje).toContain('rotación');
      expect(mensaje).toContain('cero hits protegidos observados');
    }
  });
});
