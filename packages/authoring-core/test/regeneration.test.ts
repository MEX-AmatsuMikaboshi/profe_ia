import { describe, expect, it } from 'vitest';
import {
  FamilyRegistry,
  REGENERATION_PARAMETERS,
  RegenerationInputError,
  RegenerationLimitError,
  RegenerationRegistry,
  SAFE_REGENERATION_CONSTRAINTS,
  type FamilyComponents,
  type W3ItemRecord,
  type W3RejectionCode,
} from '../src/index.js';

const SIGNATURE = 'a'.repeat(64);

function components(overrides: Partial<FamilyComponents> = {}): FamilyComponents {
  return {
    generatorTemplateId: 'tpl-regeneration',
    bankFunction: 'guided_practice',
    targetKcs: ['KC09'],
    structuralSignature: SIGNATURE,
    ...overrides,
  };
}

function families(ids: readonly string[], value = components()): FamilyRegistry {
  const registry = new FamilyRegistry();
  for (const id of ids) registry.assign(id, value);
  return registry;
}

function item(
  candidateId: string,
  familyRegistry: FamilyRegistry,
  rejectionCodes: readonly W3RejectionCode[] = ['semantically_invalid'],
): W3ItemRecord {
  const assignment = familyRegistry.get(candidateId);
  return {
    candidateId,
    generatorTemplateId: 'tpl-regeneration',
    bankFunction: 'guided_practice',
    targetKcs: ['KC09'],
    pipelineState: 'filtros_superados',
    authoringState: 'proof_found',
    accepted: rejectionCodes.length === 0,
    rejections: rejectionCodes.map((code) => ({
      code,
      detail: 'SECRETO: certificado A, contramodelo B y pasos de solución',
    })),
    targetComplexity: 'alta',
    complexityComparisonAvailable: false,
    structuralSignature: SIGNATURE,
    ...(assignment === undefined ? {} : { itemFamilyId: assignment.itemFamilyId }),
    criticRiskFlags: [],
    criticised: true,
    hintsProvided: true,
  };
}

describe('límites y política de regeneración (T-H5-09)', () => {
  it('expone las tres cifras literales como parámetros congelables', () => {
    expect(Object.values(REGENERATION_PARAMETERS).map((p) => p.value)).toEqual([5, 3, 30]);
    expect(
      new Set(Object.values(REGENERATION_PARAMETERS).map((p) => p.parameterId)).size,
    ).toBe(3);
  });

  it('el informe al agente contiene solo códigos cerrados y restricciones seguras', () => {
    const familyRegistry = families(['c1', 'c2', 'c3', 'c4']);
    const registry = new RegenerationRegistry(familyRegistry);
    const feedback = registry.recordAttempt(
      item('c1', familyRegistry, ['semantically_invalid', 'solution_leaked_in_statement']),
    );

    expect(feedback).toEqual({
      candidateId: 'c1',
      attemptNumber: 1,
      failureCodes: ['semantically_invalid', 'solution_leaked_in_statement'],
      safeConstraints: ['stay_within_semantically_valid_statements', 'do_not_include_solution_content'],
    });
    expect(JSON.stringify(feedback)).not.toContain('SECRETO');
    expect(JSON.stringify(feedback)).not.toContain('certificate');
    expect(JSON.stringify(feedback)).not.toContain('countermodel');
    expect(
      feedback?.safeConstraints.every((constraint) =>
        (SAFE_REGENERATION_CONSTRAINTS as readonly string[]).includes(constraint),
      ),
    ).toBe(true);
    expect(registry.attempts()[0]?.causes[0]?.detail).toContain('SECRETO');
  });

  it('no devuelve informe cuando el candidato fue aceptado', () => {
    const familyRegistry = families(['ok']);
    const registry = new RegenerationRegistry(familyRegistry);
    expect(registry.recordAttempt(item('ok', familyRegistry, []))).toBeNull();
  });

  it('permite cinco intentos por candidato y bloquea el sexto', () => {
    const familyRegistry = families(['c1', 'c2', 'c3', 'c4']);
    const registry = new RegenerationRegistry(familyRegistry);
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(registry.recordAttempt(item('c1', familyRegistry))?.attemptNumber).toBe(attempt);
    }
    expect(() => registry.recordAttempt(item('c1', familyRegistry))).toThrow(RegenerationLimitError);
    expect(registry.attempts()).toHaveLength(5);
  });

  it('permite tres regeneraciones por familia y bloquea la cuarta', () => {
    const familyRegistry = families(['c1', 'c2', 'c3', 'c4']);
    const registry = new RegenerationRegistry(familyRegistry);
    registry.recordAttempt(item('c1', familyRegistry));

    for (let regeneration = 1; regeneration <= 3; regeneration += 1) {
      expect(registry.requestRegeneration('c1').failureCodes).toEqual(['semantically_invalid']);
      expect(registry.familyStatus(familyRegistry.get('c1')!.itemFamilyId).regenerationCount).toBe(
        regeneration,
      );
    }
    // La tercera regeneración ya fue autorizada: puede evaluarse. Lo que se
    // bloquea ahora es pedir una cuarta, no procesar el candidato ya generado.
    expect(() => registry.recordAttempt(item('c2', familyRegistry, []))).not.toThrow();
    expect(() => registry.requestRegeneration('c1')).toThrow(RegenerationLimitError);
    expect(registry.familyStatus(familyRegistry.get('c1')!.itemFamilyId).blocked).toBe(true);
  });

  it('30 % exacto no es inestable; más de 30 % sí y queda fuera del pipeline', () => {
    const ids = Array.from({ length: 10 }, (_, index) => `c${index + 1}`);
    const familyRegistry = families(ids);
    const registry = new RegenerationRegistry(familyRegistry);
    for (const id of ids.slice(0, 3)) registry.recordAttempt(item(id, familyRegistry));

    const familyId = familyRegistry.get('c1')!.itemFamilyId;
    expect(registry.familyStatus(familyId)).toMatchObject({
      memberCount: 10,
      automaticallyRejectedMembers: 3,
      automaticRejectionPercent: 30,
      unstable: false,
      blocked: false,
    });

    registry.recordAttempt(item('c4', familyRegistry));
    expect(registry.familyStatus(familyId)).toMatchObject({
      automaticallyRejectedMembers: 4,
      automaticRejectionPercent: 40,
      unstable: true,
      blocked: true,
    });
    expect(() => registry.recordAttempt(item('c5', familyRegistry))).toThrow(RegenerationLimitError);
    expect(() => registry.requestRegeneration('c4')).toThrow(RegenerationLimitError);
  });

  it('reintentar el mismo miembro no infla el numerador de rechazo familiar', () => {
    const familyRegistry = families(['c1', 'c2', 'c3', 'c4']);
    const registry = new RegenerationRegistry(familyRegistry);
    registry.recordAttempt(item('c1', familyRegistry));
    registry.recordAttempt(item('c1', familyRegistry));
    const status = registry.familyStatus(familyRegistry.get('c1')!.itemFamilyId);
    expect(status.automaticallyRejectedMembers).toBe(1);
    expect(status.automaticRejectionPercent).toBe(25);
  });

  it('no inventa familia para un rechazo que no llegó a tener certificado', () => {
    const familyRegistry = new FamilyRegistry();
    const registry = new RegenerationRegistry(familyRegistry);
    const rejected = item('sin-familia', familyRegistry, ['syntax_not_in_authorized_calculus']);
    expect(registry.recordAttempt(rejected)?.safeConstraints).toEqual([
      'use_authorized_calculus_syntax',
    ]);
    expect(() => registry.requestRegeneration('sin-familia')).toThrow(RegenerationInputError);
  });

  it('rechaza una familia declarada que el registro inmutable no confirma', () => {
    const familyRegistry = families(['c1']);
    const registry = new RegenerationRegistry(familyRegistry);
    expect(() =>
      registry.recordAttempt({ ...item('c1', familyRegistry), itemFamilyId: 'fam-falsa' }),
    ).toThrow(RegenerationInputError);
  });

  it('rechaza estados incoherentes en vez de falsear la tasa', () => {
    const familyRegistry = families(['c1']);
    const registry = new RegenerationRegistry(familyRegistry);
    expect(() =>
      registry.recordAttempt({ ...item('c1', familyRegistry), accepted: true }),
    ).toThrow(RegenerationInputError);
    expect(() =>
      registry.recordAttempt({ ...item('c1', familyRegistry, []), accepted: false }),
    ).toThrow(RegenerationInputError);
  });

  it('prioriza control por regeneraciones y después por rechazo, sin inventar categorías', () => {
    const familyRegistry = new FamilyRegistry();
    familyRegistry.assign('a1', components({ structuralSignature: 'a'.repeat(64) }));
    familyRegistry.assign('a2', components({ structuralSignature: 'a'.repeat(64) }));
    familyRegistry.assign('a3', components({ structuralSignature: 'a'.repeat(64) }));
    familyRegistry.assign('a4', components({ structuralSignature: 'a'.repeat(64) }));
    familyRegistry.assign('b1', components({ structuralSignature: 'b'.repeat(64) }));
    familyRegistry.assign('b2', components({ structuralSignature: 'b'.repeat(64) }));
    familyRegistry.assign('b3', components({ structuralSignature: 'b'.repeat(64) }));
    familyRegistry.assign('b4', components({ structuralSignature: 'b'.repeat(64) }));
    const registry = new RegenerationRegistry(familyRegistry);
    registry.recordAttempt(item('a1', familyRegistry));
    registry.recordAttempt(item('b1', familyRegistry));
    registry.requestRegeneration('b1');

    expect(registry.controlPriority().map((status) => status.itemFamilyId)).toEqual([
      familyRegistry.get('b1')!.itemFamilyId,
      familyRegistry.get('a1')!.itemFamilyId,
    ]);
    expect(registry.controlReport()).toMatchObject({
      parametersFrozenInRegistry: false,
      parameters: REGENERATION_PARAMETERS,
    });
  });

  it('la API no ofrece reparación manual, borrado ni reinicio silencioso', () => {
    const methods = Object.getOwnPropertyNames(RegenerationRegistry.prototype);
    for (const forbidden of ['update', 'repair', 'patch', 'remove', 'delete', 'clear', 'reset']) {
      expect(methods).not.toContain(forbidden);
    }
  });

  it('las copias expuestas no permiten alterar el ledger interno', () => {
    const familyRegistry = families(['c1', 'c2', 'c3', 'c4']);
    const registry = new RegenerationRegistry(familyRegistry);
    registry.recordAttempt(item('c1', familyRegistry));
    const exposed = registry.attempts() as RegenerationAttemptRecordForTest[];
    expect(() => exposed.push(exposed[0]!)).toThrow();
    expect(registry.attempts()).toHaveLength(1);
  });
});

type RegenerationAttemptRecordForTest = ReturnType<RegenerationRegistry['attempts']>[number];
