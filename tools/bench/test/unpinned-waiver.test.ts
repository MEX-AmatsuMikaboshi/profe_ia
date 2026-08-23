import { ModelBinding } from '@profesor-ia/contracts';
import {
  DocumentaryRefreshError,
  ModelGateway,
  UnpinnedBindingError,
  assertBindingUsable,
  assertRefreshAuthorizesBenchmark,
  openaiAdapter,
  type UNPINNED_CONSEQUENCE,
  type UnpinnedIdentityWaiver,
} from '@profesor-ia/model-gateway';
import { describe, expect, it } from 'vitest';

import { EXPLORATION_CASE_SET } from '../src/exploration.js';
import { MATERIAL_CASE_SET } from '../src/material-cases.js';
import { REFRESH_WINDOW_5D } from '../src/refresh-2026-08-18.js';
import { REFRESH_2026_08_23 } from '../src/refresh-2026-08-23.js';
import {
  OPENAI_LUNA_BINDING_WAIVER,
  OPENAI_LUNA_WAIVER,
  REFRESH_OPENAI_2026_08_23,
} from '../src/refresh-openai-2026-08-23.js';

/**
 * La renuncia a la identidad fijada (T-H4-02 ← P-II §8.1).
 *
 * **Lo que estas pruebas tienen que demostrar no es que la renuncia funcione:
 * es que no sirve para colar a nadie en BENCH-01.** Una renuncia que abriera
 * también la puerta del benchmark habría convertido un freno documentado en un
 * parámetro, y el ganador quedaría atado a un id que puede cambiar de modelo sin
 * aviso — que es justo lo que §8.1 impide.
 *
 * Por eso el peso está en los controles negativos, y son **tres puertas
 * independientes**: el propósito del conjunto, el propósito del refresco y el
 * rechazo de renuncias en corrida material. Se comprueban por separado a
 * propósito: si sólo se comprobara el efecto conjunto, quitar dos de las tres
 * pasaría desapercibido.
 */

const SIN_FIJAR = {
  bindingId: 'binding-sesion-gpt-5.6-luna',
  profile: 'SESION',
  provider: 'openai',
  modelId: 'gpt-5.6-luna',
  endpoint: 'https://api.openai.com/v1/responses',
  capabilities: {
    supportedParameters: ['max_output_tokens'],
    rejectedParameters: [],
    structuredOutput: { supported: true },
    reasoning: { supported: false },
    batch: { supported: false },
    caching: { supported: false },
    dataPolicy: { contractualEligibility: 'unknown' },
  },
  verifiedAt: REFRESH_OPENAI_2026_08_23.refreshedAt,
} as const;

const BINDING = ModelBinding.parse(SIN_FIJAR);

const corrida = (purpose: 'material' | 'test_fixture', waivers?: readonly UnpinnedIdentityWaiver[]) => ({
  runId: 'r',
  startedAt: '2026-08-23T23:00:00.000Z',
  candidateIds: ['gpt-5.6-luna'],
  purpose,
  ...(waivers === undefined ? {} : { unpinnedIdentityWaivers: waivers }),
});

describe('CONTROL NEGATIVO — sin renuncia, la regla sigue exactamente donde estaba', () => {
  it('el binding sin snapshot ni huella no se registra en la pasarela', () => {
    expect(
      () =>
        new ModelGateway({
          profile: 'SESION',
          registrations: [{ binding: BINDING, operations: ['explain_block'] }],
          credentialResolver: () => 'secreto',
          adapters: [openaiAdapter],
          transport: async () => ({ status: 200, body: '{}' }),
        }),
    ).toThrow(UnpinnedBindingError);
  });

  it('y `assertBindingUsable` lo rechaza por su cuenta', () => {
    expect(() => {
      assertBindingUsable(BINDING);
    }).toThrow(UnpinnedBindingError);
  });

  it('el candidato sin fijar no pasa la autorización del refresco', () => {
    expect(() =>
      assertRefreshAuthorizesBenchmark(
        REFRESH_OPENAI_2026_08_23,
        REFRESH_WINDOW_5D,
        corrida('test_fixture'),
      ),
    ).toThrow(UnpinnedBindingError);
  });
});

describe('PUERTA 1 — una corrida material rechaza toda renuncia', () => {
  it('la rechaza aunque la renuncia esté completa y bien escrita', () => {
    expect(() =>
      assertRefreshAuthorizesBenchmark(
        REFRESH_OPENAI_2026_08_23,
        REFRESH_WINDOW_5D,
        corrida('material', [OPENAI_LUNA_WAIVER]),
      ),
    ).toThrow(DocumentaryRefreshError);
  });

  it('y el mensaje dice por qué: se puede medir, no coronar', () => {
    let mensaje = '';
    try {
      assertRefreshAuthorizesBenchmark(
        REFRESH_OPENAI_2026_08_23,
        REFRESH_WINDOW_5D,
        corrida('material', [OPENAI_LUNA_WAIVER]),
      );
    } catch (error) {
      mensaje = error instanceof Error ? error.message : '';
    }
    expect(mensaje).toContain('nunca a coronarlo');
  });

  it('la corrida material de verdad —la de Anthropic— sigue autorizada sin renuncias', () => {
    const autorizacion = assertRefreshAuthorizesBenchmark(REFRESH_2026_08_23, REFRESH_WINDOW_5D, {
      runId: 'r',
      startedAt: '2026-08-23T23:00:00.000Z',
      candidateIds: ['claude-sonnet-5'],
      purpose: 'material',
    });
    expect(autorizacion.refreshId).toBe('refresh-2026-08-23-bench01');
  });
});

describe('PUERTA 2 — el refresco de exploración no es material', () => {
  it('declara `test_fixture`, así que ni siquiera con identidad fijada autorizaría a coronar', () => {
    expect(REFRESH_OPENAI_2026_08_23.purpose).toBe('test_fixture');
  });
});

describe('PUERTA 3 — el conjunto de exploración es piloto', () => {
  it('trae los mismos 200 casos que el material, para que la comparación valga', () => {
    expect(EXPLORATION_CASE_SET.cases).toBe(MATERIAL_CASE_SET.cases);
    expect(EXPLORATION_CASE_SET.cases).toHaveLength(200);
  });

  it('y su propósito es `pilot`, que `verdictFor()` no dictamina', () => {
    expect(EXPLORATION_CASE_SET.purpose).toBe('pilot');
    expect(EXPLORATION_CASE_SET.caseSetId).not.toBe(MATERIAL_CASE_SET.caseSetId);
  });
});

describe('la renuncia sólo vale entera, y sólo para su sujeto', () => {
  it('CONTROL POSITIVO: completa y con el sujeto correcto, deja construir la pasarela', () => {
    const pasarela = new ModelGateway({
      profile: 'SESION',
      registrations: [{ binding: BINDING, operations: ['explain_block'] }],
      credentialResolver: () => 'secreto',
      adapters: [openaiAdapter],
      transport: async () => ({ status: 200, body: '{}' }),
      unpinnedIdentityWaivers: [OPENAI_LUNA_BINDING_WAIVER],
    });
    expect(pasarela.authorizedOperations()).toEqual(['explain_block']);
  });

  it('no cubre al binding de al lado', () => {
    expect(() => {
      assertBindingUsable(BINDING, { ...OPENAI_LUNA_BINDING_WAIVER, subject: 'otro-binding' });
    }).toThrow(UnpinnedBindingError);
  });

  it('sin la consecuencia escrita, no vale', () => {
    expect(() => {
      assertBindingUsable(BINDING, {
        ...OPENAI_LUNA_BINDING_WAIVER,
        consequence: 'lo que sea' as typeof UNPINNED_CONSEQUENCE,
      });
    }).toThrow(/consecuencia literal/u);
  });

  it('sin autor, sin motivo o sin constancia de haber preguntado al proveedor, no vale', () => {
    for (const campo of ['authorizedBy', 'reason', 'providerReportedModelId'] as const) {
      expect(() => {
        assertBindingUsable(BINDING, { ...OPENAI_LUNA_BINDING_WAIVER, [campo]: '  ' });
      }).toThrow(UnpinnedBindingError);
    }
  });

  it('con un `probedAt` ilegible, no vale', () => {
    expect(() => {
      assertBindingUsable(BINDING, { ...OPENAI_LUNA_BINDING_WAIVER, probedAt: 'ayer' });
    }).toThrow(/probedAt/u);
  });
});

describe('el refresco de OpenAI registra lo que se comprobó, no lo que se supone', () => {
  it('el candidato NO declara snapshot: escribirlo afirmaría una fijación que nadie publicó', () => {
    const candidato = REFRESH_OPENAI_2026_08_23.candidates[0];
    expect(candidato?.snapshot).toBeUndefined();
    expect(candidato?.behaviorFingerprint).toBeUndefined();
  });

  it('la renuncia deja constancia de que el proveedor devolvió el mismo id sin fecha', () => {
    expect(OPENAI_LUNA_WAIVER.providerReportedModelId).toBe('gpt-5.6-luna');
    expect(Number.isNaN(Date.parse(OPENAI_LUNA_WAIVER.probedAt))).toBe(false);
  });

  it('las cuatro fuentes apuntan al contenido en markdown, que es lo reproducible (D-73)', () => {
    const fuentes = REFRESH_OPENAI_2026_08_23.candidates[0]?.sources ?? [];
    expect(fuentes).toHaveLength(4);
    expect(fuentes.every((f) => f.url.endsWith('.md'))).toBe(true);
  });

  it('la política de datos no deja nada en `no_consultado`', () => {
    const politica = REFRESH_OPENAI_2026_08_23.candidates[0]?.dataPolicy;
    const campos = ['region', 'logging', 'retention', 'contractualEligibility'] as const;
    for (const campo of campos) {
      const hecho = politica?.[campo];
      expect(hecho?.known === true || hecho?.reason !== 'no_consultado').toBe(true);
    }
  });
});
