import { describe, expect, it } from 'vitest';

import {
  DeterministicHintController,
  HINT_BANK_SCHEMA_VERSION,
  HINT_LEVELS,
  HINT_POLICY_SCHEMA_VERSION,
  HINT_POLICY_V1,
  HINT_STATE_SCHEMA_VERSION,
  HintEngineError,
  HintRunRegistry,
  HintSessionState,
  compileHintBank,
  compileHintPolicy,
  createHintPolicyDefinition,
  hintAttemptProjection,
  hintValidatedContentHash,
  masteryDisqualifying,
  type FrozenHintBank,
  type HintBankEntryInput,
  type HintEvent,
  type HintSessionState as HintSessionStateValue,
} from '../src/index.js';

const AT = '2026-08-17T01:00:00.000Z';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const PACKAGE_VERSION = {
  artifactId: 'content-package-hints-fixture',
  version: 'fixture-v1',
  hash: HASH_A,
} as const;

function at(second: number): string {
  return `2026-08-17T01:00:${String(second).padStart(2, '0')}.000Z`;
}

const FIXTURE_POLICY = createHintPolicyDefinition({
  policyVersion: 'hint-policy-test-fixture-v1',
  purpose: 'test_fixture',
});

function entry(
  itemId: string,
  kcId: string,
  level: 1 | 2 | 3 | 4 | 5,
  overrides: Partial<HintBankEntryInput> = {},
): HintBankEntryInput {
  const analogousExampleEvidence = level === 4
    ? {
        authority: 'isomorphism_canonicalizer' as const,
        canonicalizerVersion: 'canonicalizer-test-fixture-v1',
        evidenceHash: HASH_B,
        nonIsomorphic: true as const,
      }
    : null;
  const text = `Pista congelada de nivel ${level} para ${itemId}`;
  const anchors = [`fragment-${itemId}-${level}`];
  const facts = {
    level,
    levelOneReminderOnly: level === 1,
    selectsRuleOrNextStep: level === 2 || level === 3,
    containsDecisiveContent: false,
  };
  const hintId = `hint-${itemId}-${level}`;
  const base: HintBankEntryInput = {
    hintId,
    itemId,
    kcId,
    level,
    text,
    anchors,
    facts,
    proposedMasteryDisqualifying: masteryDisqualifying(facts),
    nonRevelationEvidence: {
      authority: 'authoring_hint_validator',
      validatorVersion: 'authoring-test-fixture-v1',
      validatedContentHash: hintValidatedContentHash({
        hintId,
        itemId,
        kcId,
        level,
        text,
        anchors,
        facts,
        analogousExampleEvidence,
      }),
      literalLeakCheckPassed: true,
      detectionScope: 'literal_not_paraphrase',
      paraphraseAuditRequired: true,
      anchorsValidated: true,
      solutionSeparated: true,
    },
    analogousExampleEvidence,
  };
  return { ...base, ...overrides };
}

function entriesFor(itemId: string, kcId: string): HintBankEntryInput[] {
  return HINT_LEVELS.map((level) => entry(itemId, kcId, level));
}

function bank(entries: HintBankEntryInput[] = entriesFor('item-hint-1', 'KC03')): FrozenHintBank {
  return {
    schemaVersion: HINT_BANK_SCHEMA_VERSION,
    bankVersion: 'hint-bank-test-fixture-v1',
    purpose: 'test_fixture',
    packageVersion: PACKAGE_VERSION,
    authoringPipelineVersion: 'authoring-test-fixture-v1',
    supportedLevels: [1, 2, 3, 4, 5],
    entries,
  } as FrozenHintBank;
}

function controller(
  bankValue: unknown = bank(),
  registry = new HintRunRegistry(),
): DeterministicHintController {
  const value = new DeterministicHintController(FIXTURE_POLICY, bankValue, { registry });
  value.bindRun({
    runId: 'run-hints-1',
    purpose: 'test_fixture',
    policyVersion: value.policy.definition.policyVersion,
    policyHash: value.policy.policyHash,
    bankVersion: value.bank.definition.bankVersion,
    bankHash: value.bank.bankHash,
    packageVersion: value.bank.definition.packageVersion,
  });
  return value;
}

function initialized(value: DeterministicHintController): HintSessionStateValue {
  return value.applyEvent(null, {
    eventId: 'hint-event-0',
    eventType: 'hints.initialized',
    sequenceNumber: 0,
    occurredAt: AT,
    payload: { runId: 'run-hints-1', participantPseudoId: 'pseudo-hints-1' },
  }).state;
}

function request(
  sequenceNumber: number,
  overrides: Partial<Extract<HintEvent, { eventType: 'hints.requested' }>['payload']> = {},
): HintEvent {
  return {
    eventId: `hint-event-${sequenceNumber}`,
    eventType: 'hints.requested',
    sequenceNumber,
    occurredAt: at(sequenceNumber),
    payload: {
      requestId: `hint-request-${sequenceNumber}`,
      attemptId: 'attempt-hint-1',
      itemId: 'item-hint-1',
      mode: 'LEARNING_MODE',
      authorizedAssistanceLevel: 1,
      ...overrides,
    },
  };
}

function expectCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error('se esperaba HintEngineError');
  } catch (error) {
    expect(error).toBeInstanceOf(HintEngineError);
    expect((error as HintEngineError).code).toBe(code);
  }
}

describe('política y banco congelado de pistas (T-H6-05)', () => {
  it('fija los cinco niveles y las prohibiciones literales de §8.6', () => {
    expect(HINT_POLICY_V1).toEqual({
      schemaVersion: HINT_POLICY_SCHEMA_VERSION,
      policyVersion: 'hint-policy-v1-five-levels',
      purpose: 'material',
      levels: [1, 2, 3, 4, 5],
      sourceDuringSession: 'frozen_bank_only',
      measurementMode: 'disabled',
      nearestLevelFallback: false,
      masteryFlagAuthority: 'domain_engine_code',
      generatorProposalAuthoritative: false,
      fading: 'contingent_on_performance',
      silentSolutionTransformationForbidden: true,
    });
    expect(Object.isFrozen(HINT_POLICY_V1)).toBe(true);
  });

  it('compila y congela un banco versionado con hash canónico', () => {
    const compiled = compileHintBank(bank());

    expect(compiled.bankHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(compiled.definition.supportedLevels).toEqual([1, 2, 3, 4, 5]);
    expect(Object.isFrozen(compiled.definition.entries[0])).toBe(true);
    expect(() => compileHintBank(bank(), HASH_B)).toThrow(/hash de banco inválido/u);
  });

  it('una ejecución material exige hashes externos exactos de política y banco', () => {
    const materialBank = { ...bank(), purpose: 'material' as const };
    const policy = compileHintPolicy(HINT_POLICY_V1);
    const compiledBank = compileHintBank(materialBank);

    expectCode(() => new DeterministicHintController(HINT_POLICY_V1, materialBank), 'MATERIAL_FREEZE_REQUIRED');
    expect(() => new DeterministicHintController(HINT_POLICY_V1, materialBank, {
      expectedPolicyHash: policy.policyHash,
      expectedBankHash: compiledBank.bankHash,
    })).not.toThrow();
  });

  it('restaura el binding y rechaza deriva de banco para la misma corrida', () => {
    const first = controller();
    const restored = new HintRunRegistry(first.registry.bindings());
    const same = controller(bank(), restored);

    expect(same.registry.bindings()).toEqual(first.registry.bindings());
    const changed = new DeterministicHintController(
      FIXTURE_POLICY,
      { ...bank(), bankVersion: 'hint-bank-test-fixture-v2' },
      { registry: restored },
    );
    expectCode(() => changed.bindRun({
      ...first.registry.bindings()[0],
      bankVersion: changed.bank.definition.bankVersion,
      bankHash: changed.bank.bankHash,
    }), 'RUN_POLICY_DRIFT');
  });

  it('cada reactivo, no sólo el banco global, debe contener los cinco niveles', () => {
    const incompleteSecond = [
      ...entriesFor('item-hint-1', 'KC03'),
      ...entriesFor('item-hint-2', 'KC04').filter((candidate) => candidate.level !== 5),
    ];

    expectCode(() => compileHintBank(bank(incompleteSecond)), 'INVALID_HINT_BANK');
  });

  it('rechaza ids duplicados, dos pistas del mismo item+nivel y KC incoherente', () => {
    const complete = entriesFor('item-hint-1', 'KC03');
    expectCode(() => compileHintBank(bank([...complete, { ...complete[0] }])), 'INVALID_HINT_BANK');

    const wrongKc = complete.map((candidate) =>
      candidate.level === 5 ? { ...candidate, kcId: 'KC04' } : candidate,
    );
    expectCode(() => compileHintBank(bank(wrongKc)), 'INVALID_HINT_BANK');
  });

  it('vincula la evidencia a identidad, clasificación y contenido congelados', () => {
    const changed = entriesFor('item-hint-1', 'KC03');
    changed[0] = { ...changed[0], text: 'Texto alterado después de validar' };

    expectCode(() => compileHintBank(bank(changed)), 'INVALID_HINT_BANK');

    const reclassified = entriesFor('item-hint-1', 'KC03');
    const first = reclassified[0];
    if (first === undefined) throw new Error('fixture incompleto');
    reclassified[0] = {
      ...first,
      facts: { ...first.facts, selectsRuleOrNextStep: true },
      proposedMasteryDisqualifying: true,
    };
    expectCode(() => compileHintBank(bank(reclassified)), 'INVALID_HINT_BANK');
  });

  it('la propuesta generativa discrepante nunca se vuelve autoridad', () => {
    const changed = entriesFor('item-hint-1', 'KC03');
    changed[1] = { ...changed[1], proposedMasteryDisqualifying: false };

    expectCode(() => compileHintBank(bank(changed)), 'INVALID_HINT_BANK');
  });

  it('el nivel 4 exige evidencia no isomorfa y ningún otro nivel puede suplantarla', () => {
    const missing = entriesFor('item-hint-1', 'KC03');
    missing[3] = { ...missing[3], analogousExampleEvidence: null };
    expectCode(() => compileHintBank(bank(missing)), 'INVALID_HINT_BANK');

    const extra = entriesFor('item-hint-1', 'KC03');
    extra[2] = { ...extra[2], analogousExampleEvidence: extra[3]?.analogousExampleEvidence ?? null };
    expectCode(() => compileHintBank(bank(extra)), 'INVALID_HINT_BANK');
  });
});

describe('entrega determinista y autoridad por intento', () => {
  it('MEASUREMENT_MODE suprime la ayuda antes de consultar si el reactivo existe', () => {
    const value = controller();
    const mutation = value.applyEvent(initialized(value), request(1, {
      itemId: 'item-that-must-not-be-looked-up',
      mode: 'MEASUREMENT_MODE',
      authorizedAssistanceLevel: 5,
    }));

    expect(mutation.outcome).toBe('disabled_measurement_mode');
    expect(mutation.delivery).toBeNull();
    expect(mutation.state.attempts).toEqual([]);
    expect(mutation.state.requests[0]?.hintId).toBeNull();
  });

  it('nivel autorizado 0 registra ausencia de ayuda sin consultar el banco', () => {
    const value = controller();
    const mutation = value.applyEvent(initialized(value), request(1, {
      itemId: 'unknown-item',
      authorizedAssistanceLevel: 0,
    }));

    expect(mutation.outcome).toBe('no_assistance_authorized');
    expect(mutation.state.attempts).toEqual([]);
  });

  it('un reactivo desconocido no recibe una pista cercana ni de otro reactivo', () => {
    const value = controller();
    const mutation = value.applyEvent(initialized(value), request(1, {
      itemId: 'unknown-item',
      authorizedAssistanceLevel: 3,
    }));

    expect(mutation.outcome).toBe('level_unavailable');
    expect(mutation.delivery).toBeNull();
  });

  it('nivel 1 puramente recordatorio conserva elegibilidad y queda registrado', () => {
    const value = controller();
    const mutation = value.applyEvent(initialized(value), request(1));

    expect(mutation.outcome).toBe('delivered');
    expect(mutation.delivery).toMatchObject({
      level: 1,
      masteryDisqualifying: false,
      text: 'Pista congelada de nivel 1 para item-hint-1',
    });
    expect(hintAttemptProjection(mutation.state, 'attempt-hint-1')).toMatchObject({
      maximumHintLevel: 1,
      masteryDisqualifying: false,
    });
  });

  it('los niveles 2–5 descalifican siempre por código', () => {
    for (const level of [2, 3, 4, 5] as const) {
      const value = controller();
      const mutation = value.applyEvent(initialized(value), request(1, {
        authorizedAssistanceLevel: level,
      }));
      expect(mutation.delivery?.masteryDisqualifying).toBe(true);
    }
  });

  it('contenido decisivo descalifica incluso en nivel 1', () => {
    const decisiveEntries = entriesFor('item-hint-1', 'KC03');
    const original = decisiveEntries[0];
    if (original === undefined) throw new Error('fixture incompleto');
    const facts = { ...original.facts, containsDecisiveContent: true };
    decisiveEntries[0] = {
      ...original,
      facts,
      proposedMasteryDisqualifying: true,
      nonRevelationEvidence: {
        ...original.nonRevelationEvidence,
        validatedContentHash: hintValidatedContentHash({
          hintId: original.hintId,
          itemId: original.itemId,
          kcId: original.kcId,
          level: original.level,
          text: original.text,
          anchors: original.anchors,
          facts,
          analogousExampleEvidence: original.analogousExampleEvidence,
        }),
      },
    };
    const value = controller(bank(decisiveEntries));

    expect(value.applyEvent(initialized(value), request(1)).delivery?.masteryDisqualifying).toBe(true);
  });

  it('agrega máximo y descalificación desde todas las entregas del intento', () => {
    const value = controller();
    let state = initialized(value);
    state = value.applyEvent(state, request(1)).state;
    state = value.applyEvent(state, request(2, { authorizedAssistanceLevel: 3 })).state;

    expect(hintAttemptProjection(state, 'attempt-hint-1')).toMatchObject({
      maximumHintLevel: 3,
      masteryDisqualifying: true,
    });
    expect(hintAttemptProjection(state, 'attempt-hint-1').deliveries.map((delivery) => delivery.level)).toEqual([1, 3]);
  });

  it('repetir la misma pista no crea una segunda entrega', () => {
    const value = controller();
    const once = value.applyEvent(initialized(value), request(1));
    const twice = value.applyEvent(once.state, request(2, {
      requestId: 'hint-request-repeat',
    }));

    expect(twice.outcome).toBe('already_delivered');
    expect(twice.delivery).toBeNull();
    expect(twice.state.attempts[0]?.deliveries).toHaveLength(1);
    expect(twice.state.requests[1]?.hintId).toBe('hint-item-hint-1-1');
  });

  it('un intento con entrega no puede cambiar de reactivo', () => {
    const value = controller(bank([
      ...entriesFor('item-hint-1', 'KC03'),
      ...entriesFor('item-hint-2', 'KC04'),
    ]));
    const once = value.applyEvent(initialized(value), request(1));

    expectCode(() => value.applyEvent(once.state, request(2, {
      itemId: 'item-hint-2',
      authorizedAssistanceLevel: 2,
    })), 'HINT_ORDER_VIOLATION');
  });
});

describe('replay, restauración y adulteración', () => {
  it('replay reproduce exactamente el estado y conserva las versiones', () => {
    const value = controller();
    const events: HintEvent[] = [
      {
        eventId: 'hint-event-0',
        eventType: 'hints.initialized',
        sequenceNumber: 0,
        occurredAt: AT,
        payload: { runId: 'run-hints-1', participantPseudoId: 'pseudo-hints-1' },
      },
      request(1),
      request(2, { authorizedAssistanceLevel: 2 }),
    ];
    const replayed = value.replay(events);

    expect(replayed.schemaVersion).toBe(HINT_STATE_SCHEMA_VERSION);
    expect(replayed.revision).toBe(2);
    expect(value.replay(events)).toEqual(replayed);
    expect(Object.isFrozen(replayed)).toBe(true);
  });

  it('rechaza huecos, ids duplicados y tiempo que retrocede', () => {
    const value = controller();
    const state = initialized(value);
    expectCode(() => value.applyEvent(state, request(2)), 'INVALID_EVENT_SEQUENCE');
    expectCode(() => value.applyEvent(state, {
      ...request(1),
      eventId: 'hint-event-0',
    }), 'INVALID_EVENT_SEQUENCE');
    expectCode(() => value.applyEvent(state, {
      ...request(1),
      occurredAt: '2026-08-16T23:59:59.000Z',
    }), 'INVALID_EVENT_SEQUENCE');
  });

  it('el esquema estricto excluye solución, BKT y propuesta de modelo', () => {
    const value = controller();
    const state = initialized(value);

    expect(HintSessionState.safeParse({ ...state, solution: 'secreta' }).success).toBe(false);
    expect(HintSessionState.safeParse({ ...state, masteryProbabilityShadow: 0.9 }).success).toBe(false);
    expect(HintSessionState.safeParse({ ...state, modelProposal: { level: 1 } }).success).toBe(false);
  });

  it('rechaza un snapshot con texto válido pero distinto del banco congelado', () => {
    const value = controller();
    const delivered = value.applyEvent(initialized(value), request(1)).state;
    const attempt = delivered.attempts[0];
    const firstDelivery = attempt?.deliveries[0];
    if (attempt === undefined || firstDelivery === undefined) throw new Error('fixture incompleto');
    const tampered = {
      ...delivered,
      attempts: [{
        ...attempt,
        deliveries: [{ ...firstDelivery, text: 'Pista sustituida fuera del banco' }],
      }],
    };
    expect(HintSessionState.safeParse(tampered).success).toBe(true);

    expectCode(() => value.applyEvent(tampered as HintSessionStateValue, request(2, {
      authorizedAssistanceLevel: 2,
    })), 'INVALID_HINT_EVENT');
  });

  it('la proyección falla cerrado si el intento nunca recibió una pista', () => {
    const value = controller();
    expectCode(() => hintAttemptProjection(initialized(value), 'attempt-without-hints'), 'HINT_ORDER_VIOLATION');
  });
});
