import { describe, expect, it } from 'vitest';
import { ModelBinding, ModelOperation, ModelProfile } from '@profesor-ia/contracts';
import type { ModelProfile as Profile } from '@profesor-ia/contracts';
import {
  AmbiguousBindingError,
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

/** Transporte que registra lo enviado; las pruebas no tocan la red. */
function recordingTransport(): { transport: Transport; sent: ProviderRequest[] } {
  const sent: ProviderRequest[] = [];
  const transport: Transport = async (request) => {
    sent.push(request);
    return { status: 200, body: '{}' };
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
    capabilities: {
      supportedParameters: [],
      rejectedParameters: [],
      structuredOutput: { supported: true },
      reasoning: { supported: false },
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
): { gateway: ModelGateway; sent: ProviderRequest[] } {
  const { transport, sent } = recordingTransport();
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

describe('envío por transporte inyectado', () => {
  it('usa el transporte y no interpreta la respuesta (eso es T-H4-03)', async () => {
    const { gateway, sent } = gatewayDeSesion([
      { binding: binding(), operations: ['explain_block'] },
    ]);

    const { request, response } = await gateway.send({
      operation: 'explain_block',
      instructions: 'i',
      input: 'e',
    });

    expect(sent).toEqual([request]);
    expect(response).toEqual({ status: 200, body: '{}' });
  });

  it('una operación no autorizada no llega a tocar el transporte', async () => {
    const { gateway, sent } = gatewayDeSesion([
      { binding: binding(), operations: ['explain_block'] },
    ]);

    await expect(
      gateway.send({ operation: 'draft_feedback', instructions: 'i', input: 'e' }),
    ).rejects.toThrow(OperationNotAuthorizedForProfileError);
    expect(sent).toEqual([]);
  });
});
