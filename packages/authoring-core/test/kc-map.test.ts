import { AUTHORIZED_CALCULUS_VERSION, AUTHORIZED_RULE_IDS } from '@profesor-ia/logic-core';
import { describe, expect, it } from 'vitest';
import {
  assertAcyclicOrJustified,
  assertCatalogMatchesCalculus,
  assertExperimentalSets,
  crossSetEdges,
  DEPENDENCY_TYPES,
  FOUNDATION_KCS,
  findCycles,
  KC_CATALOG,
  KC_IDS,
  kcEdges,
  KcMapError,
  type ExperimentalSet,
  type KcEdge,
} from '../src/index.js';

function conjunto(overrides: Partial<ExperimentalSet> = {}): ExperimentalSet {
  return {
    setId: 'A',
    targetKcs: ['KC04', 'KC05'],
    supportKcs: ['KC01', 'KC02'],
    authorizedCalculusVersion: AUTHORIZED_CALCULUS_VERSION,
    ...overrides,
  };
}

describe('catálogo KC literal (T-H5-03 ← P-I §5.2)', () => {
  it('son los dieciocho KC, y cada dependencia apunta a uno que existe', () => {
    expect(KC_IDS).toHaveLength(18);

    for (const kcId of KC_IDS) {
      expect(KC_CATALOG[kcId].kcId).toBe(kcId);
      for (const dep of KC_CATALOG[kcId].dependencies) {
        expect(KC_IDS).toContain(dep.on);
        expect(DEPENDENCY_TYPES).toContain(dep.type);
      }
    }
  });

  it('los rule_id se derivan del cálculo autorizado y no divergen', () => {
    // Si se copiaran, el mapa y el cálculo podrían separarse sin que nada lo
    // notara, y el desajuste aparecería en la primera corrección.
    expect(() => assertCatalogMatchesCalculus()).not.toThrow();

    for (const kcId of KC_IDS) {
      const { ruleId } = KC_CATALOG[kcId];
      if (ruleId !== undefined) expect(AUTHORIZED_RULE_IDS).toContain(ruleId);
    }
  });

  it('`KC12 PC:KC10` es política de contenido, no necesidad lógica', () => {
    // Tratarla como formal afirmaría una necesidad del cálculo que no existe.
    expect(KC_CATALOG.KC12.dependencies).toEqual([
      { on: 'KC10', type: 'POLITICA_CONTENIDO' },
    ]);
  });

  it('KC10 registra siempre `¬E`: no existe una regla canónica `⊥I`', () => {
    expect(KC_CATALOG.KC10.ruleId).toBe('¬E');
    expect(AUTHORIZED_RULE_IDS).not.toContain('⊥I');
  });

  it('`¬I` e `IP` permanecen separados, en dos KC y dos reglas', () => {
    expect(KC_CATALOG.KC11.ruleId).toBe('¬I');
    expect(KC_CATALOG.KC17.ruleId).toBe('IP');
    expect(KC_CATALOG.KC11.ruleId).not.toBe(KC_CATALOG.KC17.ruleId);
  });

  it('KC16 es derivada permitida y KC17 primitiva clásica', () => {
    expect(KC_CATALOG.KC16.stage1Status).toBe('Derivada permitida');
    expect(KC_CATALOG.KC16.ruleId).toBe('DNE');
    expect(KC_CATALOG.KC17.stage1Status).toBe('Primitiva clásica');
  });

  it('KC17 NO depende formalmente de KC16: el orden entre ambas es pedagógico', () => {
    // «el orden respecto de KC16 es P, no necesidad formal». Fabricar la arista
    // afirmaría una dependencia del cálculo que el Maestro niega.
    expect(KC_CATALOG.KC17.dependencies.map((d) => d.on)).not.toContain('KC16');
    expect(KC_CATALOG.KC17.dependencies).toEqual([
      { on: 'KC08', type: 'FORMAL' },
      { on: 'KC10', type: 'FORMAL' },
    ]);
  });

  it('«disponer de una disyunción» es condición, no arista inventada', () => {
    expect(KC_CATALOG.KC13.conditions).toContain('disponer de una disyunción');
    expect(KC_CATALOG.KC13.dependencies).toEqual([
      { on: 'KC08', type: 'FORMAL' },
      { on: 'KC07', type: 'PEDAGOGICA' },
    ]);
  });

  it('KC18 integra KC03–KC17 por vía pedagógica', () => {
    const deps = KC_CATALOG.KC18.dependencies;

    expect(deps).toHaveLength(15);
    expect(deps.map((d) => d.on)).toEqual(KC_IDS.slice(2, 17));
    expect(deps.every((d) => d.type === 'PEDAGOGICA')).toBe(true);
  });

  it('las aristas salen en orden determinista', () => {
    expect(kcEdges()).toEqual(kcEdges());
  });
});

describe('grafo acíclico o ciclos justificados', () => {
  it('el catálogo literal es acíclico', () => {
    expect(findCycles()).toEqual([]);
    expect(() => assertAcyclicOrJustified()).not.toThrow();
  });

  // KC03 depende de KC02, así que la arista inversa cierra un ciclo de dos y
  // **solo** uno. Importa que sea uno solo: la primera versión de esta prueba
  // sembró KC01→KC04, que cierra dos ciclos a la vez ({KC01,KC04} y
  // {KC01,KC02,KC04}), y la prueba fallaba por estar mal escrita, no el módulo.
  const UN_SOLO_CICLO: readonly KcEdge[] = [
    ...kcEdges(),
    { from: 'KC02', to: 'KC03', type: 'FORMAL' },
  ];

  it('un ciclo sembrado se detecta', () => {
    // Sin esta comprobación, un ciclo produciría una secuencia de enseñanza que
    // no se puede empezar por ningún sitio, y el fallo saldría en sesión.
    expect(findCycles(UN_SOLO_CICLO)).toHaveLength(1);
    expect(() => assertAcyclicOrJustified([], UN_SOLO_CICLO)).toThrow(KcMapError);
  });

  it('un ciclo justificado no bloquea, y la justificación no puede ir vacía', () => {
    const ciclo = findCycles(UN_SOLO_CICLO)[0]?.cycle ?? [];

    expect(() =>
      assertAcyclicOrJustified(
        [{ cycle: ciclo, justification: 'Se enseñan en espiral.' }],
        UN_SOLO_CICLO,
      ),
    ).not.toThrow();

    expect(() =>
      assertAcyclicOrJustified([{ cycle: ciclo, justification: '   ' }], UN_SOLO_CICLO),
    ).toThrow(KcMapError);
  });

  it('la justificación vale sea cual sea el punto por el que se escriba el ciclo', () => {
    // Un ciclo es el mismo se empiece por donde se empiece; exigir una rotación
    // concreta convertiría la justificación en un acertijo.
    const ciclo = findCycles(UN_SOLO_CICLO)[0]?.cycle ?? [];
    const rotado = [...ciclo.slice(1), ...ciclo.slice(0, 1)];

    expect(() =>
      assertAcyclicOrJustified([{ cycle: rotado, justification: 'Espiral.' }], UN_SOLO_CICLO),
    ).not.toThrow();
  });

  it('justificar un ciclo no silencia los demás', () => {
    // Una arista puede cerrar más de un ciclo: KC01→KC04 cierra {KC01,KC04} y
    // {KC01,KC02,KC04}. Si justificar uno tapara el otro, bastaría con
    // justificar el más inocente para que pasara cualquier cosa.
    const dosCiclos: readonly KcEdge[] = [
      ...kcEdges(),
      { from: 'KC01', to: 'KC04', type: 'FORMAL' },
    ];
    const hallados = findCycles(dosCiclos);

    expect(hallados).toHaveLength(2);
    expect(() =>
      assertAcyclicOrJustified(
        [{ cycle: hallados[0]?.cycle ?? [], justification: 'Solo este.' }],
        dosCiclos,
      ),
    ).toThrow(KcMapError);
  });
});

describe('aristas cruzadas entre conjuntos, FORMAL y POLITICA_CONTENIDO por separado', () => {
  // KC10 en A; KC11 (F:KC10) y KC12 (PC:KC10) en B; KC13 (P:KC07) en C con KC07
  // en A. Así cruzan a la vez una formal, una de política y una pedagógica.
  const sets: readonly ExperimentalSet[] = [
    conjunto({ setId: 'A', targetKcs: ['KC10', 'KC07'] }),
    conjunto({ setId: 'B', targetKcs: ['KC11', 'KC12'] }),
    conjunto({ setId: 'C', targetKcs: ['KC13'] }),
  ];

  it('las enumera en listas distintas, no en un total conjunto', () => {
    // Un total diría cuántas rutas de contaminación hay y no cuál se puede
    // quitar cambiando una política, que es lo que decide la selección.
    const cruzadas = crossSetEdges(sets);

    expect(cruzadas.formal).toEqual([{ from: 'KC11', to: 'KC10', type: 'FORMAL' }]);
    expect(cruzadas.politicaContenido).toEqual([
      { from: 'KC12', to: 'KC10', type: 'POLITICA_CONTENIDO' },
    ]);
  });

  it('ninguna lista contiene aristas del otro tipo', () => {
    const cruzadas = crossSetEdges(sets);

    expect(cruzadas.formal.every((e) => e.type === 'FORMAL')).toBe(true);
    expect(cruzadas.politicaContenido.every((e) => e.type === 'POLITICA_CONTENIDO')).toBe(true);
  });

  it('las de otros tipos se listan aparte en vez de desaparecer', () => {
    const cruzadas = crossSetEdges(sets);

    expect(cruzadas.otherTypes).toEqual([{ from: 'KC13', to: 'KC07', type: 'PEDAGOGICA' }]);
  });

  it('sin cruces, las tres listas quedan vacías', () => {
    const sinCruce: readonly ExperimentalSet[] = [
      conjunto({ setId: 'A', targetKcs: ['KC04'] }),
      conjunto({ setId: 'B', targetKcs: ['KC05'] }),
      conjunto({ setId: 'C', targetKcs: ['KC06'] }),
    ];
    const cruzadas = crossSetEdges(sinCruce);

    expect(cruzadas.formal).toEqual([]);
    expect(cruzadas.politicaContenido).toEqual([]);
    expect(cruzadas.otherTypes).toEqual([]);
  });
});

describe('fundamentos pre-SCED y referencia al cálculo (§5.2.1, DEC-FOUNDATION-001)', () => {
  it('KC01, KC02 y KC08 son los fundamentos', () => {
    expect(FOUNDATION_KCS).toEqual(['KC01', 'KC02', 'KC08']);
  });

  it('un fundamento como KC objetivo bloquea', () => {
    // Si lo fuera, la línea base mediría desconocimiento del formato Fitch en
    // vez de los KC experimentales.
    for (const fundamento of FOUNDATION_KCS) {
      expect(() => assertExperimentalSets([conjunto({ targetKcs: [fundamento] })])).toThrow(
        KcMapError,
      );
    }
  });

  it('el mismo fundamento como soporte sí pasa', () => {
    expect(() =>
      assertExperimentalSets([conjunto({ targetKcs: ['KC04'], supportKcs: ['KC01', 'KC08'] })]),
    ).not.toThrow();
  });

  it('los tres conjuntos referencian exactamente `authorized-calculus-v1`', () => {
    expect(() =>
      assertExperimentalSets([conjunto({ authorizedCalculusVersion: 'authorized-calculus-v2' })]),
    ).toThrow(KcMapError);

    expect(() => assertExperimentalSets([conjunto()])).not.toThrow();
  });

  it('un KC objetivo en dos conjuntos haría indistinguibles sus efectos', () => {
    expect(() =>
      assertExperimentalSets([
        conjunto({ setId: 'A', targetKcs: ['KC04'] }),
        conjunto({ setId: 'B', targetKcs: ['KC04'] }),
      ]),
    ).toThrow(KcMapError);
  });
});
