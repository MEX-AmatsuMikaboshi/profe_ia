import { describe, expect, it } from 'vitest';
import { DoubtScope } from '@profesor-ia/contracts';
import {
  DOUBT_DECLARATIONS,
  DOUBT_EVALUATION_ORDER,
  DOUBT_POLICY_SCHEMA_VERSION,
  DoubtPolicyError,
  classifyDoubt,
  doubtEffectFor,
  doubtPolicyIdentity,
} from '../src/index.js';
import type { DoubtObservation, DoubtOutcome } from '../src/index.js';

const AT = '2026-08-17T10:00:00.000Z';

/** Hechos de una duda que corresponde al bloque: todo resuelto y anclado. */
function facts(overrides: Partial<DoubtObservation> = {}): DoubtObservation {
  return {
    doubtId: 'doubt-fixture-1',
    occurredAt: AT,
    pedagogicalMode: 'LEARNING_MODE',
    safetyBlocked: false,
    blockingPrerequisiteKcIds: [],
    resolvedFragmentIds: ['fragment-fixture-1'],
    fragmentIdsInCurrentBlock: ['fragment-fixture-1'],
    anchorSufficient: true,
    scorableActivityOpen: false,
    ...overrides,
  };
}

function classified(outcome: DoubtOutcome) {
  if (outcome.suppressed) throw new Error('se esperaba una clasificación, no una supresión');
  return outcome;
}

function expectCode(operation: () => unknown, code: string): void {
  try {
    operation();
    throw new Error('se esperaba DoubtPolicyError');
  } catch (error) {
    expect(error).toBeInstanceOf(DoubtPolicyError);
    expect((error as DoubtPolicyError).code).toBe(code);
  }
}

describe('T-H6-10 — el enum y las declaraciones literales', () => {
  it('cubre exactamente los seis miembros del contrato, sin inventar ni omitir', () => {
    expect(Object.keys(DOUBT_DECLARATIONS).sort()).toEqual([...DoubtScope.options].sort());
    expect([...DOUBT_EVALUATION_ORDER].sort()).toEqual([...DoubtScope.options].sort());
  });

  it('conserva las cinco declaraciones literales de P-I §8.4', () => {
    expect(DOUBT_DECLARATIONS.current_block).toBe('corresponde al bloque');
    expect(DOUBT_DECLARATIONS.blocking_prerequisite).toBe('requiere un prerrequisito');
    expect(DOUBT_DECLARATIONS.later_in_unit).toBe('pertenece a otro momento de la unidad');
    expect(DOUBT_DECLARATIONS.outside_corpus).toBe('queda fuera del corpus');
    expect(DOUBT_DECLARATIONS.insufficient_anchor).toBe(
      'no puede responderse con suficiente anclaje',
    );
  });

  it('ningún alcance autoriza fundamentar calificación ni introducir una regla o definición', () => {
    for (const scope of DoubtScope.options) {
      const effect = doubtEffectFor(scope);
      expect(effect.mayGroundGrading).toBe(false);
      expect(effect.mayIntroduceRuleOrDefinition).toBe(false);
      expect(effect.declarationRequired).toBe(true);
      expect(effect.registeredForAudit).toBe(true);
      expect(effect.authority.length).toBeGreaterThan(0);
    }
  });

  it('sólo el bloque actual autoriza contenido factual', () => {
    for (const scope of DoubtScope.options) {
      expect(doubtEffectFor(scope).factualAnswerAuthorized).toBe(scope === 'current_block');
    }
  });
});

describe('T-H6-10 — el orden de evaluación es el requisito', () => {
  it('seguridad gana a prerrequisito, corpus y bloque a la vez', () => {
    const outcome = classified(
      classifyDoubt(
        facts({
          safetyBlocked: true,
          blockingPrerequisiteKcIds: ['KC03'],
          resolvedFragmentIds: [],
          fragmentIdsInCurrentBlock: [],
          anchorSufficient: false,
        }),
      ),
    );
    expect(outcome.scope).toBe('unsafe_or_disallowed');
    expect(outcome.effect.nonFactualAccompanimentAuthorized).toBe(false);
  });

  it('prerrequisito bloqueante gana al corpus y encamina a recuperación, no a una respuesta', () => {
    const outcome = classified(
      classifyDoubt(
        facts({ blockingPrerequisiteKcIds: ['KC03'], resolvedFragmentIds: [], fragmentIdsInCurrentBlock: [] }),
      ),
    );
    expect(outcome.scope).toBe('blocking_prerequisite');
    expect(outcome.effect.route).toBe('prerequisite_recovery');
    expect(outcome.effect.factualAnswerAuthorized).toBe(false);
  });

  it('sin fragmento resuelto es fuera de corpus', () => {
    const outcome = classified(
      classifyDoubt(facts({ resolvedFragmentIds: [], fragmentIdsInCurrentBlock: [] })),
    );
    expect(outcome.scope).toBe('outside_corpus');
  });

  /**
   * El caso que decide el orden: el fragmento existe pero es de otro bloque. Si el
   * anclaje se mirara antes, la duda se declararía `insufficient_anchor` y el
   * alumno oiría que el corpus no puede sostener la respuesta, cuando lo cierto es
   * que se enseña más adelante.
   */
  it('la pertenencia al bloque se decide antes que la suficiencia del anclaje', () => {
    const outcome = classified(
      classifyDoubt(facts({ fragmentIdsInCurrentBlock: [], anchorSufficient: false })),
    );
    expect(outcome.scope).toBe('later_in_unit');
    expect(outcome.effect.deferredToLaterOpportunity).toBe(true);
    expect(outcome.effect.factualAnswerAuthorized).toBe(false);
  });

  it('con fragmento del bloque pero anclaje insuficiente es insufficient_anchor', () => {
    const outcome = classified(classifyDoubt(facts({ anchorSufficient: false })));
    expect(outcome.scope).toBe('insufficient_anchor');
    expect(outcome.effect.deferredToLaterOpportunity).toBe(true);
  });

  it('todo resuelto, del bloque y anclado es current_block', () => {
    const outcome = classified(classifyDoubt(facts()));
    expect(outcome.scope).toBe('current_block');
    expect(outcome.effect.factualAnswerAuthorized).toBe(true);
    expect(outcome.withheldByNonRevelation).toBe(false);
  });
});

describe('T-H6-10 — no revelación y modo de medición', () => {
  it('una actividad puntuable retira la respuesta factual sin cambiar el alcance (§9.6)', () => {
    const outcome = classified(classifyDoubt(facts({ scorableActivityOpen: true })));
    expect(outcome.scope).toBe('current_block');
    expect(outcome.effect.factualAnswerAuthorized).toBe(false);
    expect(outcome.withheldByNonRevelation).toBe(true);
    expect(outcome.effect.authority).toContain('P-I §9.6');
  });

  it('no marca retención por no revelación donde el alcance ya no autorizaba responder', () => {
    const outcome = classified(
      classifyDoubt(facts({ scorableActivityOpen: true, anchorSufficient: false })),
    );
    expect(outcome.scope).toBe('insufficient_anchor');
    expect(outcome.withheldByNonRevelation).toBe(false);
  });

  it('MEASUREMENT_MODE suprime la clasificación en vez de fabricar unsafe_or_disallowed', () => {
    const outcome = classifyDoubt(facts({ pedagogicalMode: 'MEASUREMENT_MODE' }));
    expect(outcome.suppressed).toBe(true);
    if (!outcome.suppressed) throw new Error('inalcanzable');
    expect(outcome.reason).toBe('measurement_mode');
    expect(outcome.pedagogicalAnswerAuthorized).toBe(false);
    expect(outcome.rightsOrProcedureInformationAuthorized).toBe(true);
    expect(outcome.clockExtended).toBe(false);
    expect(outcome.deferredToLaterOpportunity).toBe(true);
    expect(outcome).not.toHaveProperty('scope');
  });

  it('la supresión de medición no depende de los hechos de contenido', () => {
    for (const override of [
      { safetyBlocked: true },
      { blockingPrerequisiteKcIds: ['KC03'] },
      { resolvedFragmentIds: [], fragmentIdsInCurrentBlock: [] },
      { anchorSufficient: false },
    ]) {
      const outcome = classifyDoubt(facts({ pedagogicalMode: 'MEASUREMENT_MODE', ...override }));
      expect(outcome.suppressed).toBe(true);
    }
  });
});

describe('T-H6-10 — la propuesta del modelo no decide', () => {
  it('una propuesta equivocada no mueve el alcance y queda registrada como desacuerdo', () => {
    const outcome = classified(classifyDoubt(facts(), 'outside_corpus'));
    expect(outcome.scope).toBe('current_block');
    expect(outcome.modelProposal).toBe('outside_corpus');
    expect(outcome.modelProposalAgreed).toBe(false);
  });

  it('una propuesta acertada tampoco es la causa del alcance, y se marca acuerdo', () => {
    const outcome = classified(classifyDoubt(facts(), 'current_block'));
    expect(outcome.scope).toBe('current_block');
    expect(outcome.modelProposalAgreed).toBe(true);
  });

  /** Sin propuesta el acuerdo es `null`, no `true`: un `true` sería acuerdo por vacío. */
  it('sin propuesta no se afirma acuerdo', () => {
    const outcome = classified(classifyDoubt(facts()));
    expect(outcome.modelProposal).toBeNull();
    expect(outcome.modelProposalAgreed).toBeNull();
  });

  it('la propuesta se conserva incluso cuando la medición suprime la clasificación', () => {
    const outcome = classifyDoubt(
      facts({ pedagogicalMode: 'MEASUREMENT_MODE' }),
      'current_block',
    );
    if (!outcome.suppressed) throw new Error('se esperaba supresión');
    expect(outcome.modelProposal).toBe('current_block');
  });

  it('rechaza una propuesta fuera del contrato en vez de aproximarla', () => {
    expectCode(() => classifyDoubt(facts(), 'probablemente_del_bloque'), 'DOUBT_SCOPE_UNKNOWN');
  });
});

describe('T-H6-10 — hechos inválidos', () => {
  it('rechaza hechos que no cumplen el contrato y campos no declarados', () => {
    expectCode(() => classifyDoubt({ ...facts(), doubtId: '' }), 'DOUBT_FACTS_INVALID');
    expectCode(
      () => classifyDoubt({ ...facts(), questionText: '¿por qué?' }),
      'DOUBT_FACTS_INVALID',
    );
  });

  it('rechaza declarar del bloque un fragmento que no está entre los resueltos', () => {
    expectCode(
      () => classifyDoubt(facts({ fragmentIdsInCurrentBlock: ['fragment-fixture-9'] })),
      'DOUBT_BLOCK_MEMBERSHIP_INCONSISTENT',
    );
  });
});

describe('T-H6-10 — identidad de la política', () => {
  it('declara versión y hash estables para el manifiesto del ledger', () => {
    const identity = doubtPolicyIdentity();
    expect(identity.version).toBe(DOUBT_POLICY_SCHEMA_VERSION);
    expect(identity.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(doubtPolicyIdentity().hash).toBe(identity.hash);
  });
});
