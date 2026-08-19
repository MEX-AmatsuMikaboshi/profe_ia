import { describe, expect, it } from 'vitest';
import { CanaryRegistry } from '@profesor-ia/security-policy';
import {
  buildSessionContext,
  CanaryHitError,
  FragmentOutsideBlockError,
  HelpLevelExceededError,
  UndeclaredStateKeyError,
  type SessionContextInput,
} from '../src/index.js';

function entrada(overrides: Partial<SessionContextInput> = {}): SessionContextInput {
  return {
    blockId: 'bloque-01',
    authorizedFragments: [
      { fragmentId: 'f1', blockId: 'bloque-01', text: 'Regla ∧I: de A y B se sigue A∧B.' },
    ],
    minimalState: { intentos: 2 },
    minimalStateKeys: ['intentos'],
    goal: 'Derivar A∧B',
    mode: 'LEARNING_MODE',
    strategy: 'worked_example',
    allowedHelpLevel: 2,
    structuredError: null,
    selectedHint: null,
    // T-H7-03: estas pruebas son de la whitelist y del filtro de egreso fuera de
    // una actividad puntuable, que es donde nacieron. El caso puntuable —donde
    // §9.6 exige el detector— tiene sus propias pruebas en `non-revelation`.
    scorableActivityOpen: false,
    ...overrides,
  };
}

describe('whitelist del contexto de sesión (T-H4-04 ← P-II §8.3)', () => {
  it('arma el contexto con los campos autorizados', () => {
    const contexto = buildSessionContext(entrada());

    expect(contexto.goal).toBe('Derivar A∧B');
    expect(contexto.mode).toBe('LEARNING_MODE');
    expect(contexto.strategy).toBe('worked_example');
    expect(contexto.fragments).toEqual(['Regla ∧I: de A y B se sigue A∧B.']);
    expect(contexto.minimalState).toEqual({ intentos: 2 });
  });

  it('no arrastra ningún campo fuera de la whitelist', () => {
    const conExtra = { ...entrada(), participantEmail: 'alumno@example.com' };
    const contexto = buildSessionContext(conExtra as SessionContextInput);

    expect(JSON.stringify(contexto)).not.toContain('alumno@example.com');
    expect(contexto).not.toHaveProperty('participantEmail');
  });

  it('el contexto no tiene campo para identificadores: la ausencia es estructural', () => {
    const contexto = buildSessionContext(entrada());
    const claves = Object.keys(contexto);

    for (const prohibida of ['participantId', 'accountId', 'sessionId', 'email', 'userId']) {
      expect(claves).not.toContain(prohibida);
    }
  });

  it('una clave de estado no declarada falla, no se ignora en silencio', () => {
    expect(() =>
      buildSessionContext(
        entrada({ minimalState: { intentos: 2, accountId: 'cuenta-7' }, minimalStateKeys: ['intentos'] }),
      ),
    ).toThrow(UndeclaredStateKeyError);
  });

  it('solo copia las claves declaradas, aunque el estado traiga menos', () => {
    const contexto = buildSessionContext(
      entrada({ minimalState: {}, minimalStateKeys: ['intentos', 'racha'] }),
    );

    expect(contexto.minimalState).toEqual({});
  });
});

describe('filtro de egreso (P-I §9.4)', () => {
  it('un fragmento de otro bloque no sale', () => {
    expect(() =>
      buildSessionContext(
        entrada({
          authorizedFragments: [{ fragmentId: 'f9', blockId: 'bloque-99', text: 'ajeno' }],
        }),
      ),
    ).toThrow(FragmentOutsideBlockError);
  });

  it('una pista por encima del nivel permitido no sale', () => {
    expect(() =>
      buildSessionContext(
        entrada({
          allowedHelpLevel: 1,
          selectedHint: { hintId: 'h3', helpLevel: 3, text: 'aplica ∧I al paso 4' },
        }),
      ),
    ).toThrow(HelpLevelExceededError);
  });

  it('una pista dentro del nivel permitido sí sale', () => {
    const contexto = buildSessionContext(
      entrada({
        allowedHelpLevel: 3,
        selectedHint: { hintId: 'h1', helpLevel: 1, text: 'mira las premisas' },
      }),
    );

    expect(contexto.hint).toEqual({ helpLevel: 1, text: 'mira las premisas' });
  });

  it('el nivel exacto permitido no se pasa de la raya', () => {
    const contexto = buildSessionContext(
      entrada({ allowedHelpLevel: 2, selectedHint: { hintId: 'h2', helpLevel: 2, text: 'pista' } }),
    );

    expect(contexto.hint?.helpLevel).toBe(2);
  });

  it('una cadena canario en el contexto aborta la construcción', () => {
    const detector = (payload: string) => (payload.includes('CANARIO-7') ? ['CANARIO-7'] : []);

    expect(() =>
      buildSessionContext(
        entrada({
          authorizedFragments: [
            { fragmentId: 'f1', blockId: 'bloque-01', text: 'texto con CANARIO-7 dentro' },
          ],
        }),
        { canaryDetector: detector },
      ),
    ).toThrow(CanaryHitError);
  });

  it('el detector mira el payload serializado, no solo los fragmentos', () => {
    const visto: string[] = [];
    buildSessionContext(entrada(), {
      canaryDetector: (payload) => {
        visto.push(payload);
        return [];
      },
    });

    expect(visto).toHaveLength(1);
    expect(visto[0]).toContain('Derivar A∧B');
    expect(visto[0]).toContain('worked_example');
  });

  it('el registro real de canarios encaja como detector del filtro (T-H4-05)', () => {
    const registro = new CanaryRegistry();
    registro.register({
      canaryId: 'canary-sol-01',
      assetClass: 'soluciones',
      location: 'private_solutions.solution.body',
      freezeVersion: 'freeze-2026-08-15',
      value: 'ZZ-CANARIO-9902',
      scopes: ['contexto_construido'],
      incidentProcedure: 'abortar, incidente nivel 3, bloquear corrida, investigar la ruta',
    });

    expect(() =>
      buildSessionContext(
        entrada({
          authorizedFragments: [
            { fragmentId: 'f1', blockId: 'bloque-01', text: 'la solución es ZZ-CANARIO-9902' },
          ],
        }),
        { canaryDetector: registro.detectorFor('contexto_construido') },
      ),
    ).toThrow(CanaryHitError);

    // Y el hit quedó observado y la corrida bloqueada, no solo abortada la llamada.
    expect(registro.isRunBlocked()).toBe(true);
    expect(registro.observedHits()).toHaveLength(1);
  });

  it('un contexto limpio con el registro real no bloquea nada', () => {
    const registro = new CanaryRegistry();
    registro.register({
      canaryId: 'canary-sol-01',
      assetClass: 'soluciones',
      location: 'private_solutions.solution.body',
      freezeVersion: 'freeze-2026-08-15',
      value: 'ZZ-CANARIO-9902',
      scopes: ['contexto_construido'],
      incidentProcedure: 'abortar, incidente nivel 3, bloquear corrida, investigar la ruta',
    });

    expect(() =>
      buildSessionContext(entrada(), {
        canaryDetector: registro.detectorFor('contexto_construido'),
      }),
    ).not.toThrow();
    expect(registro.isRunBlocked()).toBe(false);
    expect(registro.observedHits()).toEqual([]);
  });

  it('sin detector el contexto se construye, pero nada lo da por limpio', () => {
    // El detector es opcional aquí porque lo llena T-H4-05; su ausencia no
    // afirma que no haya canarios, solo que aún no se comprueban.
    expect(() => buildSessionContext(entrada())).not.toThrow();
  });
});
