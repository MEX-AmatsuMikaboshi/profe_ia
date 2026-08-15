import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ModelBinding, ModelOperation, ModelProfile } from '@profesor-ia/contracts';
import type { ModelProfile as Profile } from '@profesor-ia/contracts';
import {
  AmbiguousBindingError,
  ContradictoryCapabilitiesError,
  RejectedParameterError,
  UnpinnedBindingError,
  UnsupportedParameterError,
  ANTHROPIC_PROVIDER,
  anthropicAdapter,
  MODEL_OPERATIONS,
  MissingCredentialError,
  ModelGateway,
  OPENAI_PROVIDER,
  openaiAdapter,
  OperationNotAuthorizedForProfileError,
  ProfileCredential,
  ProfileMismatchError,
  UnknownProviderError,
  isModelOperation,
  type BindingRegistration,
  type ProviderRequest,
  type Transport,
} from '../src/index.js';

/** Respuesta de Anthropic con el motivo de parada y el texto pedidos. */
function respuestaAnthropic(stopReason: string, texto: string) {
  return {
    status: 200,
    body: JSON.stringify({ stop_reason: stopReason, content: [{ type: 'text', text: texto }] }),
  };
}

/** Transporte que registra lo enviado; las pruebas no tocan la red. */
function recordingTransport(respuesta?: { status: number; body: string }): {
  transport: Transport;
  sent: ProviderRequest[];
} {
  const sent: ProviderRequest[] = [];
  const transport: Transport = async (request) => {
    sent.push(request);
    return respuesta ?? { status: 200, body: '{}' };
  };
  return { transport, sent };
}

function binding(overrides: Partial<ReturnType<typeof baseBinding>> = {}) {
  return ModelBinding.parse({ ...baseBinding(), ...overrides });
}

function baseBinding() {
  return {
    bindingId: 'binding-sesion-anthropic',
    profile: 'SESION',
    provider: ANTHROPIC_PROVIDER,
    modelId: 'modelo-declarado-por-el-binding',
    endpoint: 'https://proveedor.example/v1/messages',
    // Snapshot fechado: sin él haría falta huella de comportamiento (T-H4-02).
    snapshot: 'snapshot-declarado-por-el-binding',
    capabilities: {
      supportedParameters: [],
      rejectedParameters: [],
      structuredOutput: { supported: true },
      reasoning: { supported: false },
      batch: { supported: false },
      caching: { supported: false },
      dataPolicy: { contractualEligibility: 'unknown' },
    },
    verifiedAt: '2026-08-13T00:00:00+00:00',
  };
}

const SECRETO_SESION = 'secreto-de-sesion';
const SECRETO_AUTORIA = 'secreto-de-autoria';

function resolverDeAmbos(vistos?: Profile[]) {
  return (profile: Profile): string | undefined => {
    vistos?.push(profile);
    return profile === 'SESION' ? SECRETO_SESION : SECRETO_AUTORIA;
  };
}

function gatewayDeSesion(
  registrations: readonly BindingRegistration[],
  vistos?: Profile[],
  respuesta?: { status: number; body: string },
): { gateway: ModelGateway; sent: ProviderRequest[] } {
  const { transport, sent } = recordingTransport(respuesta);
  const gateway = new ModelGateway({
    profile: 'SESION',
    registrations,
    credentialResolver: resolverDeAmbos(vistos),
    adapters: [anthropicAdapter, openaiAdapter],
    transport,
  });
  return { gateway, sent };
}

describe('operaciones permitidas (T-H4-01 ← P-II §8.2)', () => {
  it('son exactamente las once del contrato, sin añadidos', () => {
    expect(MODEL_OPERATIONS).toEqual(ModelOperation.options);
    expect(MODEL_OPERATIONS).toHaveLength(11);
  });

  it('la lista es cerrada: una operación inventada no es reconocida', () => {
    expect(isModelOperation('explain_block')).toBe(true);
    expect(isModelOperation('draft_solution')).toBe(false);
    expect(isModelOperation('')).toBe(false);
  });

  it('los dos perfiles son los del contrato y no hay un tercero', () => {
    expect(ModelProfile.options).toEqual(['SESION', 'AUTORIA']);
  });
});

describe('reparto operación↔perfil: dato, no valor por omisión (D-15)', () => {
  it('una operación no declarada falla cerrado aunque exista en el contrato', () => {
    const { gateway } = gatewayDeSesion([
      { binding: binding(), operations: ['explain_block'] },
    ]);

    expect(gateway.authorizedOperations()).toEqual(['explain_block']);
    expect(() => gateway.resolve('draft_feedback')).toThrow(OperationNotAuthorizedForProfileError);
  });

  it('sin operaciones declaradas la pasarela no sirve ninguna', () => {
    const { gateway } = gatewayDeSesion([{ binding: binding(), operations: [] }]);

    expect(gateway.authorizedOperations()).toEqual([]);
    for (const operation of MODEL_OPERATIONS) {
      expect(() => gateway.resolve(operation)).toThrow(OperationNotAuthorizedForProfileError);
    }
  });

  it('dos bindings para la misma operación es un fallo, no gana el primero', () => {
    expect(() =>
      gatewayDeSesion([
        { binding: binding({ bindingId: 'a' }), operations: ['explain_block'] },
        {
          binding: binding({ bindingId: 'b', provider: OPENAI_PROVIDER }),
          operations: ['explain_block'],
        },
      ]),
    ).toThrow(AmbiguousBindingError);
  });
});

describe('separación de perfiles y credenciales (P-II §8.2, CONGELADA)', () => {
  it('un binding de AUTORIA no se registra en una pasarela de SESION', () => {
    expect(() =>
      gatewayDeSesion([
        { binding: binding({ profile: 'AUTORIA' }), operations: ['create_authoring_candidate'] },
      ]),
    ).toThrow(ProfileMismatchError);
  });

  it('la pasarela de SESION solo pide la credencial de SESION', () => {
    const vistos: Profile[] = [];
    gatewayDeSesion([{ binding: binding(), operations: ['explain_block'] }], vistos);

    expect(vistos).toEqual(['SESION']);
    expect(vistos).not.toContain('AUTORIA');
  });

  it('sin credencial del perfil falla cerrado y no cae a la del otro', () => {
    const { transport } = recordingTransport();
    expect(
      () =>
        new ModelGateway({
          profile: 'AUTORIA',
          registrations: [],
          // Solo SESION tiene credencial: AUTORIA debe fallar, no heredarla.
          credentialResolver: (p) => (p === 'SESION' ? SECRETO_SESION : undefined),
          adapters: [anthropicAdapter],
          transport,
        }),
    ).toThrow(MissingCredentialError);
  });

  it('el mensaje de error no filtra ningún secreto', () => {
    const { transport } = recordingTransport();
    try {
      new ModelGateway({
        profile: 'AUTORIA',
        registrations: [],
        credentialResolver: (p) => (p === 'SESION' ? SECRETO_SESION : undefined),
        adapters: [anthropicAdapter],
        transport,
      });
      expect.unreachable('debía fallar por credencial ausente');
    } catch (error) {
      expect((error as Error).message).not.toContain(SECRETO_SESION);
    }
  });

  it('una credencial no se imprime ni se serializa', () => {
    const credential = ProfileCredential.resolve('SESION', resolverDeAmbos());

    expect(String(credential)).toBe('[ProfileCredential SESION]');
    expect(JSON.stringify({ credential })).not.toContain(SECRETO_SESION);
    expect(credential.reveal()).toBe(SECRETO_SESION);
  });
});

describe('adaptadores propios, sin plantilla universal (P-II §8.1)', () => {
  const registro: BindingRegistration[] = [
    { binding: binding(), operations: ['explain_block'] },
  ];

  it('el id del modelo sale del binding, no del adaptador', () => {
    const { gateway } = gatewayDeSesion(registro);
    const request = gateway.buildRequest({
      operation: 'explain_block',
      instructions: 'instrucciones',
      input: 'entrada',
    });

    expect(JSON.parse(request.body)).toMatchObject({ model: 'modelo-declarado-por-el-binding' });
    expect(request.url).toBe('https://proveedor.example/v1/messages');
  });

  it('no se envía ningún parámetro de muestreo: eso lo autoriza T-H4-02', () => {
    const { gateway } = gatewayDeSesion(registro);
    const body = JSON.parse(
      gateway.buildRequest({ operation: 'explain_block', instructions: 'i', input: 'e' }).body,
    ) as Record<string, unknown>;

    for (const parametro of ['temperature', 'top_p', 'top_k', 'reasoning', 'max_tokens']) {
      expect(body).not.toHaveProperty(parametro);
    }
  });

  it('los dos adaptadores construyen peticiones distintas', () => {
    const { gateway: sesionAnthropic } = gatewayDeSesion(registro);
    const { gateway: sesionOpenai } = gatewayDeSesion([
      {
        binding: binding({
          bindingId: 'binding-openai',
          provider: OPENAI_PROVIDER,
          endpoint: 'https://openai.example/v1/responses',
        }),
        operations: ['explain_block'],
      },
    ]);

    const a = sesionAnthropic.buildRequest({
      operation: 'explain_block',
      instructions: 'i',
      input: 'e',
    });
    const o = sesionOpenai.buildRequest({
      operation: 'explain_block',
      instructions: 'i',
      input: 'e',
    });

    expect(a.headers['x-api-key']).toBe(SECRETO_SESION);
    expect(a.headers).not.toHaveProperty('authorization');
    expect(o.headers['authorization']).toBe(`Bearer ${SECRETO_SESION}`);
    expect(o.headers).not.toHaveProperty('x-api-key');
    expect(a.body).not.toBe(o.body);
  });

  it('sin adaptador propio del proveedor, falla cerrado', () => {
    const { transport } = recordingTransport();
    const gateway = new ModelGateway({
      profile: 'SESION',
      registrations: registro,
      credentialResolver: resolverDeAmbos(),
      adapters: [openaiAdapter], // falta el de anthropic, que es el del binding
      transport,
    });

    expect(() => gateway.resolve('explain_block')).toThrow(UnknownProviderError);
  });
});

describe('capacidades por binding (T-H4-02 ← DEC-MODEL-BINDING-001)', () => {
  const conParametros = () =>
    binding({
      capabilities: {
        ...baseBinding().capabilities,
        supportedParameters: ['temperature', 'max_tokens'],
        rejectedParameters: ['top_k'],
      },
    });

  it('solo envía parámetros declarados compatibles', () => {
    const { gateway } = gatewayDeSesion([
      { binding: conParametros(), operations: ['explain_block'] },
    ]);

    const body = JSON.parse(
      gateway.buildRequest({
        operation: 'explain_block',
        instructions: 'i',
        input: 'e',
        parameters: { temperature: 0, max_tokens: 128 },
      }).body,
    ) as Record<string, unknown>;

    expect(body['temperature']).toBe(0);
    expect(body['max_tokens']).toBe(128);
  });

  it('un parámetro no declarado falla localmente, sin salir a la red', async () => {
    const { gateway, sent } = gatewayDeSesion([
      { binding: conParametros(), operations: ['explain_block'] },
    ]);

    await expect(
      gateway.execute({
        operation: 'explain_block',
        instructions: 'i',
        input: 'e',
        parameters: { top_p: 0.9 },
        schema: z.unknown(),
      }),
    ).rejects.toThrow(UnsupportedParameterError);
    expect(sent).toEqual([]);
  });

  it('desconocido y rechazado son errores distintos, no se colapsan', () => {
    const { gateway } = gatewayDeSesion([
      { binding: conParametros(), operations: ['explain_block'] },
    ]);
    const peticion = (parameters: Record<string, unknown>) => () =>
      gateway.buildRequest({ operation: 'explain_block', instructions: 'i', input: 'e', parameters });

    expect(peticion({ top_p: 0.9 })).toThrow(UnsupportedParameterError);
    expect(peticion({ top_k: 4 })).toThrow(RejectedParameterError);
    expect(peticion({ top_k: 4 })).not.toThrow(UnsupportedParameterError);
  });

  it('sin parámetros solicitados no se envía ninguno', () => {
    const { gateway } = gatewayDeSesion([
      { binding: conParametros(), operations: ['explain_block'] },
    ]);
    const body = JSON.parse(
      gateway.buildRequest({ operation: 'explain_block', instructions: 'i', input: 'e' }).body,
    ) as Record<string, unknown>;

    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('max_tokens');
  });

  it('un parámetro declarado no puede suplantar el id del modelo', () => {
    const { gateway } = gatewayDeSesion([
      {
        binding: binding({
          capabilities: { ...baseBinding().capabilities, supportedParameters: ['model'] },
        }),
        operations: ['explain_block'],
      },
    ]);

    const body = JSON.parse(
      gateway.buildRequest({
        operation: 'explain_block',
        instructions: 'i',
        input: 'e',
        parameters: { model: 'otro-modelo-cualquiera' },
      }).body,
    ) as Record<string, unknown>;

    expect(body['model']).toBe('modelo-declarado-por-el-binding');
  });

  it('sin snapshot ni huella el binding no se registra', () => {
    const sinFijar = binding({ snapshot: undefined });
    expect(sinFijar.snapshot).toBeUndefined();
    expect(sinFijar.behaviorFingerprint).toBeUndefined();

    expect(() => gatewayDeSesion([{ binding: sinFijar, operations: ['explain_block'] }])).toThrow(
      UnpinnedBindingError,
    );
  });

  it('un alias sin snapshot vale si trae huella de comportamiento', () => {
    const conHuella = binding({
      snapshot: undefined,
      behaviorFingerprint: 'a'.repeat(64),
      aliasResolvedAt: '2026-08-13T00:00:00+00:00',
    });

    expect(() =>
      gatewayDeSesion([{ binding: conHuella, operations: ['explain_block'] }]),
    ).not.toThrow();
  });

  it('capacidades contradictorias son un fallo, no una precedencia', () => {
    const contradictorio = binding({
      capabilities: {
        ...baseBinding().capabilities,
        supportedParameters: ['temperature'],
        rejectedParameters: ['temperature'],
      },
    });

    expect(() =>
      gatewayDeSesion([{ binding: contradictorio, operations: ['explain_block'] }]),
    ).toThrow(ContradictoryCapabilitiesError);
  });
});

describe('envío por transporte inyectado', () => {
  it('usa el transporte y valida la salida antes de devolverla', async () => {
    const { gateway, sent } = gatewayDeSesion(
      [{ binding: binding(), operations: ['explain_block'] }],
      undefined,
      respuestaAnthropic('end_turn', '{"ok":true}'),
    );

    const resultado = await gateway.execute({
      operation: 'explain_block',
      instructions: 'i',
      input: 'e',
      schema: z.object({ ok: z.boolean() }),
    });

    expect(sent).toHaveLength(1);
    expect(resultado.classification).toBe('valid');
    if (resultado.classification === 'valid') {
      expect(resultado.data).toEqual({ ok: true });
    }
  });

  it('una operación no autorizada no llega a tocar el transporte', async () => {
    const { gateway, sent } = gatewayDeSesion([
      { binding: binding(), operations: ['explain_block'] },
    ]);

    await expect(
      gateway.execute({
        operation: 'draft_feedback',
        instructions: 'i',
        input: 'e',
        schema: z.unknown(),
      }),
    ).rejects.toThrow(OperationNotAuthorizedForProfileError);
    expect(sent).toEqual([]);
  });
});
