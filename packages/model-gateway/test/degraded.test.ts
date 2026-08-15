import { describe, expect, it } from 'vitest';
import {
  DegradedProfile,
  FROZEN_ASSET_KINDS,
  FrozenAssetMissingError,
  GatewayMode,
  LiveGenerationDisabledError,
} from '../src/index.js';

function perfil() {
  return new DegradedProfile({
    assets: [
      { kind: 'explicacion', key: 'bloque-01', text: '∧I une dos fórmulas ya probadas.', freezeVersion: 'f1' },
      { kind: 'ejemplo', key: 'bloque-01', text: 'De A y B se sigue A∧B.', freezeVersion: 'f1' },
      { kind: 'pista', key: 'bloque-01', text: 'Mira qué tienes ya probado.', freezeVersion: 'f1' },
    ],
    feedbackTemplates: [
      { key: 'paso-invalido', template: 'El paso {linea} no está justificado por {regla}.', freezeVersion: 'f1' },
    ],
  });
}

describe('perfil sin generación en vivo (T-H4-12 ← P-II §8.6)', () => {
  it('las cuatro clases congeladas son las literales del §8.6', () => {
    expect(FROZEN_ASSET_KINDS).toEqual(['explicacion', 'ejemplo', 'pista', 'feedback']);
  });

  it('sirve explicaciones, ejemplos y pistas congelados', () => {
    const p = perfil();

    expect(p.asset('explicacion', 'bloque-01').text).toBe('∧I une dos fórmulas ya probadas.');
    expect(p.asset('ejemplo', 'bloque-01').text).toBe('De A y B se sigue A∧B.');
    expect(p.asset('pista', 'bloque-01').freezeVersion).toBe('f1');
  });

  it('un activo que falta lanza: no se rellena con nada', () => {
    // Si rellenara, el perfil dejaría de servir para aislar si el fallo viene
    // del modelo o del núcleo, que es uno de los cuatro usos del §8.6.
    expect(() => perfil().asset('explicacion', 'bloque-99')).toThrow(FrozenAssetMissingError);
    expect(() => perfil().asset('pista', 'bloque-99')).toThrow(FrozenAssetMissingError);
  });

  it('la retroalimentación es plantillada, no generada', () => {
    const texto = perfil().feedback('paso-invalido', { linea: '4', regla: '∧E' });

    expect(texto).toBe('El paso 4 no está justificado por ∧E.');
  });

  it('un hueco sin valor lanza: una frase a medias se leería como completa', () => {
    expect(() => perfil().feedback('paso-invalido', { linea: '4' })).toThrow(FrozenAssetMissingError);
  });

  it('una plantilla inexistente lanza', () => {
    expect(() => perfil().feedback('no-existe', {})).toThrow(FrozenAssetMissingError);
  });

  it('con el perfil activo no se llama al proveedor', () => {
    expect(() => perfil().assertNoLiveGeneration('explain_block')).toThrow(
      LiveGenerationDisabledError,
    );
  });
});

describe('conmutación entre vivo y degradado (§8.6: «conmutable»)', () => {
  it('arranca en vivo y conmuta a degradado y de vuelta', () => {
    const modo = new GatewayMode();
    expect(modo.isDegraded()).toBe(false);
    expect(modo.degradedProfile()).toBeNull();

    modo.enableDegraded(perfil());
    expect(modo.isDegraded()).toBe(true);
    expect(modo.degradedProfile()).not.toBeNull();

    modo.enableLive();
    expect(modo.isDegraded()).toBe(false);
    expect(modo.degradedProfile()).toBeNull();
  });

  it('no conmuta sola ante un fallo del proveedor', () => {
    // No hay `onProviderError`, `autoFallback` ni equivalente: caer solo a modo
    // degradado escondería el fallo justo cuando el perfil existe para poder
    // atribuirlo.
    const modo = new GatewayMode() as unknown as Record<string, unknown>;

    for (const automatico of ['autoFallback', 'onProviderError', 'fallbackOnError', 'autoDegrade']) {
      expect(modo[automatico]).toBeUndefined();
    }
  });

  it('el perfil degradado no expone ninguna vía de generar', () => {
    const p = perfil() as unknown as Record<string, unknown>;

    for (const generar of ['generate', 'complete', 'call', 'send', 'execute']) {
      expect(p[generar]).toBeUndefined();
    }
  });
});
