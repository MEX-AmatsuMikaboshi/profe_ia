import { search } from '@profesor-ia/proof-search';
import { structuralSignature } from '@profesor-ia/isomorphism-canonicalizer';
import { describe, expect, it } from 'vitest';
import {
  assertFamilyComponents,
  FamilyAssignmentError,
  FamilyRegistry,
  familyComponentsOf,
  itemFamilyId,
  sameFamily,
  type FamilyComponents,
} from '../src/index.js';

const pruebaDe = (premises: readonly string[], goal: string) => {
  const r = search(
    { premises: [...premises], goal, mode: 'heuristic', budget: { maxWorkUnits: 20_000 } },
    { semanticOracle: 'prefilter' },
  );
  if (r.status !== 'proof_found') throw new Error('fixture inválido');
  return { lines: r.proof.lines, goal };
};

const FIRMA = structuralSignature(pruebaDe(['A', 'B'], 'A∧B'));

function componentes(overrides: Partial<FamilyComponents> = {}): FamilyComponents {
  return {
    generatorTemplateId: 'tpl-conjuncion',
    bankFunction: 'guided_practice',
    targetKcs: ['KC09'],
    structuralSignature: FIRMA,
    ...overrides,
  };
}

describe('pertenencia a familia (T-H5-07 ← P-I §7.8, DEC-FAMILY-001)', () => {
  it('el id se deriva de los cuatro componentes y de nada más', () => {
    expect(itemFamilyId(componentes())).toBe(itemFamilyId(componentes()));
    for (const cambio of [
      { generatorTemplateId: 'tpl-otra' },
      { bankFunction: 'independent_practice' as const },
      { targetKcs: ['KC10'] as const },
      { structuralSignature: structuralSignature(pruebaDe(['A→B', '¬B'], '¬A')) },
    ]) {
      expect(itemFamilyId(componentes(cambio))).not.toBe(itemFamilyId(componentes()));
    }
  });

  it('el conjunto de KC es un conjunto: ni el orden ni la repetición crean familia nueva', () => {
    // §7.8 dice «**conjunto** de KC objetivo». Con lista ordenada, el mismo
    // conjunto escrito al revés partiría la familia en dos.
    expect(itemFamilyId(componentes({ targetKcs: ['KC09', 'KC10'] }))).toBe(
      itemFamilyId(componentes({ targetKcs: ['KC10', 'KC09'] })),
    );
    expect(itemFamilyId(componentes({ targetKcs: ['KC09', 'KC09'] }))).toBe(
      itemFamilyId(componentes({ targetKcs: ['KC09'] })),
    );
  });

  it('renombrar átomos no crea una familia nueva, y cambiar la estructura sí', () => {
    // Lo primero lo absorbe la firma estructural; lo segundo es «un cambio real
    // de estructura de prueba» (§7.8).
    const gemelo = familyComponentsOf({
      generatorTemplateId: 'tpl-conjuncion',
      bankFunction: 'guided_practice',
      targetKcs: ['KC09'],
      proof: pruebaDe(['P', 'Q'], 'P∧Q'),
    });
    const otraEstructura = familyComponentsOf({
      generatorTemplateId: 'tpl-conjuncion',
      bankFunction: 'guided_practice',
      targetKcs: ['KC09'],
      proof: pruebaDe(['A→B', '¬B'], '¬A'),
    });
    expect(sameFamily(gemelo, componentes())).toBe(true);
    expect(sameFamily(otraEstructura, componentes())).toBe(false);
  });

  it('la redacción no es uno de los cuatro componentes, así que no puede moverla', () => {
    // «cambios de … o redacción no crean una familia nueva»: aquí es una
    // consecuencia de la forma del tipo, no una regla que alguien recuerde.
    expect(Object.keys(componentes()).sort()).toEqual([
      'bankFunction',
      'generatorTemplateId',
      'structuralSignature',
      'targetKcs',
    ]);
  });

  it('la firma se recalcula del certificado en vez de aceptarse como dato', () => {
    const derivada = familyComponentsOf({
      generatorTemplateId: 'tpl-conjuncion',
      bankFunction: 'guided_practice',
      targetKcs: ['KC09'],
      proof: pruebaDe(['A', 'B'], 'A∧B'),
    });
    expect(derivada.structuralSignature).toBe(FIRMA);
  });

  it('rechaza componentes que harían familias sin significado', () => {
    expect(() => assertFamilyComponents(componentes({ generatorTemplateId: '  ' }))).toThrow(
      FamilyAssignmentError,
    );
    expect(() => assertFamilyComponents(componentes({ targetKcs: [] }))).toThrow(
      /familia fantasma/u,
    );
    // @ts-expect-error KC fuera del catálogo
    expect(() => assertFamilyComponents(componentes({ targetKcs: ['KC99'] }))).toThrow(
      FamilyAssignmentError,
    );
    // @ts-expect-error función de banco que no es reserva
    expect(() => assertFamilyComponents(componentes({ bankFunction: 'calentamiento' }))).toThrow(
      FamilyAssignmentError,
    );
    expect(() => assertFamilyComponents(componentes({ structuralSignature: 'no-es-un-hash' }))).toThrow(
      FamilyAssignmentError,
    );
  });
});

describe('inmutabilidad de la asignación (§7.8: sin reasignar tras conocer defectos)', () => {
  it('reprocesar el mismo candidato con los mismos componentes es idempotente', () => {
    const registro = new FamilyRegistry();
    const a = registro.assign('it-001', componentes());
    const b = registro.assign('it-001', componentes());
    expect(b.itemFamilyId).toBe(a.itemFamilyId);
    expect(registro.assignments()).toHaveLength(1);
  });

  it('reetiquetar la plantilla para sacar al candidato de su familia falla', () => {
    // Es la vía real de elusión: `generator_template_id` es cadena libre, así
    // que reetiquetarla sacaría a un candidato defectuoso de la familia que va
    // camino de quedar bloqueada por T-H5-09 y el umbral del 30 % se calcularía
    // sobre otra cosa. La derivación sola no lo impide; el registro sí.
    const registro = new FamilyRegistry();
    registro.assign('it-001', componentes());
    expect(() =>
      registro.assign('it-001', componentes({ generatorTemplateId: 'tpl-limpia' })),
    ).toThrow(/no puede reasignar familias/u);
  });

  it('mover el candidato de reserva o de KC tampoco lo reasigna', () => {
    const registro = new FamilyRegistry();
    registro.assign('it-001', componentes());
    expect(() =>
      registro.assign('it-001', componentes({ bankFunction: 'probes_baseline' })),
    ).toThrow(FamilyAssignmentError);
    expect(() => registro.assign('it-001', componentes({ targetKcs: ['KC10'] }))).toThrow(
      FamilyAssignmentError,
    );
  });

  it('el registro no expone forma de borrar ni de sobreescribir', () => {
    // Una inmutabilidad que se pudiera levantar programáticamente sería
    // decorativa, igual que en el cost-ledger de F4.
    const registro = new FamilyRegistry() as unknown as Record<string, unknown>;
    for (const metodo of ['remove', 'delete', 'clear', 'reassign', 'set', 'override']) {
      expect(registro[metodo]).toBeUndefined();
    }
  });

  it('la copia que devuelve `assignments()` está congelada', () => {
    const registro = new FamilyRegistry();
    registro.assign('it-001', componentes());
    expect(() => (registro.assignments() as unknown as unknown[]).push({})).toThrow();
  });

  it('agrupa por familia, que es lo que T-H5-09 y T-H5-14 cuentan', () => {
    const registro = new FamilyRegistry();
    registro.assign('it-001', componentes());
    registro.assign('it-002', componentes());
    registro.assign('it-003', componentes({ generatorTemplateId: 'tpl-otra' }));
    const miembros = registro.members();
    expect(miembros.size).toBe(2);
    expect(miembros.get(itemFamilyId(componentes()))).toEqual(['it-001', 'it-002']);
  });
});
