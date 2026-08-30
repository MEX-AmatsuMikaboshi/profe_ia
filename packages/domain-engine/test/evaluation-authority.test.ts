import { describe, expect, it } from 'vitest';

import {
  EVALUATION_AUTHORITIES,
  EvaluationAuthorityError,
  UNVERIFIED_OBSERVATIONS,
  assertMayEmitFormalVerdict,
  evaluateInDomain,
  evaluationAuthorityFor,
  llmJudgeAuthorization,
  verifiedDomains,
} from '../src/evaluation-authority.js';

describe('los niveles de autoridad son dos', () => {
  it('sin un tercero intermedio', () => {
    // Un `partial_authority` sería el agujero: todo lo que no verifica acabaría
    // ahí, y «casi verifica» es la equivalencia fingida que la norma prohíbe.
    expect([...EVALUATION_AUTHORITIES]).toStrictEqual([
      'deterministic_verifier',
      'no_formal_authority',
    ]);
  });

  it('sólo el cálculo autorizado tiene verificador', () => {
    expect([...verifiedDomains()]).toStrictEqual(['authorized-calculus-v1']);
    expect(evaluationAuthorityFor('authorized-calculus-v1')).toBe('deterministic_verifier');
    expect(evaluationAuthorityFor('historia-de-la-imprenta')).toBe('no_formal_authority');
  });

  it('un dominio con nombre parecido no hereda autoridad', () => {
    expect(evaluationAuthorityFor('authorized-calculus-v2')).toBe('no_formal_authority');
    expect(evaluationAuthorityFor('authorized-calculus')).toBe('no_formal_authority');
  });
});

describe('sin verificador no hay veredicto que emitir', () => {
  it('la puerta lanza y nombra la decisión', () => {
    expect(() => assertMayEmitFormalVerdict('historia-de-la-imprenta')).toThrowError(
      /fingiría equivalencia con/u,
    );
    try {
      assertMayEmitFormalVerdict('historia-de-la-imprenta');
    } catch (e) {
      expect((e as EvaluationAuthorityError).code).toBe('SIN_AUTORIDAD_FORMAL');
    }
  });

  it('control positivo: el dominio con verificador sí pasa', () => {
    // Sin esto, un `assertMayEmitFormalVerdict` que lanzara siempre dejaría al
    // curso de lógica sin poder calificar, y todas las negativas seguirían
    // verdes.
    expect(() => assertMayEmitFormalVerdict('authorized-calculus-v1')).not.toThrow();
  });
});

describe('la forma del resultado cambia con la autoridad', () => {
  it('sin autoridad formal no hay dónde escribir un veredicto', () => {
    const r = evaluateInDomain({ domainId: 'historia-de-la-imprenta' });
    expect(r.authority).toBe('no_formal_authority');
    // No es que esté prohibido rellenarlo: es que no existe.
    expect(Object.keys(r)).not.toContain('valid');
    expect(Object.keys(r)).not.toContain('verdict');
    expect(Object.keys(r)).not.toContain('correct');
    expect(r.authority === 'no_formal_authority' && r.formalVerdict).toBeNull();
  });

  it('y el descargo es obligatorio, porque un resultado a secas se lee como veredicto', () => {
    const r = evaluateInDomain({ domainId: 'historia-de-la-imprenta' });
    expect(r.authority === 'no_formal_authority' && r.disclaimer).toContain('no validada');
    expect(r.authority === 'no_formal_authority' && r.disclaimer).toContain(
      'no recibe veredicto formal',
    );
  });

  it('las observaciones describen lo ocurrido, no si acertó', () => {
    expect([...UNVERIFIED_OBSERVATIONS]).toStrictEqual([
      'response_recorded',
      'self_reported_confidence',
      'time_on_task',
      'assistance_requested',
    ]);
    // Ninguna afirma corrección.
    for (const o of UNVERIFIED_OBSERVATIONS) {
      expect(o).not.toMatch(/correct|valid|score|grade/u);
    }
  });

  it('con verificador, el veredicto viaja pero no se emite aquí', () => {
    const r = evaluateInDomain({ domainId: 'authorized-calculus-v1', verdictRef: 'v-77' });
    expect(r).toStrictEqual({
      authority: 'deterministic_verifier',
      domainId: 'authorized-calculus-v1',
      verifierId: 'logic-core',
      verdictRef: 'v-77',
    });
  });

  it('y si llega sin veredicto, no se inventa uno', () => {
    // Emitirlo aquí sería un segundo verificador fuera de la única ruta.
    expect(() => evaluateInDomain({ domainId: 'authorized-calculus-v1' })).toThrowError(
      /segundo verificador/u,
    );
  });
});

describe('el LLM-juez no es el sustituto por omisión', () => {
  it('lanza sin autorización', () => {
    expect(() => llmJudgeAuthorization('historia-de-la-imprenta')).toThrowError(
      /no es el sustituto por omisión/u,
    );
    try {
      llmJudgeAuthorization('historia-de-la-imprenta');
    } catch (e) {
      expect((e as EvaluationAuthorityError).code).toBe('LLM_JUEZ_SIN_AUTORIZACION');
    }
  });

  it('no devuelve `false` ni un juez degradado: un sustituto silencioso es lo que se descarta', () => {
    expect(() => llmJudgeAuthorization('cualquiera')).toThrow();
  });

  it('una autorización sin referencia normativa no autoriza', () => {
    expect(() =>
      llmJudgeAuthorization('historia-de-la-imprenta', {
        domainId: 'historia-de-la-imprenta',
        authorizedBySpec: '   ',
      }),
    ).toThrowError(/citando su referencia/u);
  });

  it('una autorización de otro dominio no sirve', () => {
    expect(() =>
      llmJudgeAuthorization('historia-de-la-imprenta', {
        domainId: 'termodinamica',
        authorizedBySpec: 'P-I §99',
      }),
    ).toThrowError(EvaluationAuthorityError);
  });

  it('control positivo: con autorización citada, pasa', () => {
    // El punto de fallo es donde la decisión se enchufa. Si nunca pasara, no
    // sería un punto de enchufe sino una prohibición mal escrita.
    const a = llmJudgeAuthorization('historia-de-la-imprenta', {
      domainId: 'historia-de-la-imprenta',
      authorizedBySpec: 'especificación posterior, sin emitir',
    });
    expect(a.domainId).toBe('historia-de-la-imprenta');
  });
});
