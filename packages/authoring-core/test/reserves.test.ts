import { MeasureKind, ScedPhase } from '@profesor-ia/contracts';
import { search } from '@profesor-ia/proof-search';
import { describe, expect, it } from 'vitest';
import {
  assertPhysicalSeparation,
  assertReserveDisjointness,
  assertTransferIsolationDemonstrated,
  CalibrationPendingError,
  collisionProhibited,
  CONSUMPTION_EXCLUSIONS,
  effectiveReserve,
  isMeasurementReserve,
  MEASUREMENT_RESERVES,
  measurementReserveFor,
  physicallySeparable,
  RESERVE_DIRECTORY,
  RESERVES,
  ReserveOverlapError,
  ReserveSeparationError,
  reservesSharingDirectory,
  SOLUTIONS_DIRECTORY,
  surfaceSimilarity,
  TRANSFER_BANKS,
  transferBanksFrom,
  type ItemPlacement,
  type PackageItem,
  type Reserve,
} from '../src/index.js';

const pruebaDe = (premises: readonly string[], goal: string) => {
  const r = search(
    { premises: [...premises], goal, mode: 'heuristic', budget: { maxWorkUnits: 20_000 } },
    { semanticOracle: 'prefilter' },
  );
  if (r.status !== 'proof_found') throw new Error('fixture inválido');
  return { lines: r.proof.lines, goal };
};

/** `A, B ⊢ A∧B` y su gemelo por renombrado: isomorfos bajo la canonicalización. */
const CONJUNCION = () => pruebaDe(['A', 'B'], 'A∧B');
const CONJUNCION_RENOMBRADA = () => pruebaDe(['P', 'Q'], 'P∧Q');
const OTRA_ESTRUCTURA = () => pruebaDe(['A→B', '¬B'], '¬A');

function paquete(overrides: Partial<PackageItem> = {}): PackageItem {
  return {
    itemId: 'it-001',
    reserve: 'guided_practice',
    proof: CONJUNCION(),
    promptText: 'Demuestra la conclusión a partir de las premisas.',
    ...overrides,
  };
}

function colocacion(overrides: Partial<ItemPlacement> = {}): ItemPlacement {
  return {
    itemId: 'it-001',
    reserve: 'guided_practice',
    path: 'items/guided-practice/it-001.yaml',
    solutionPath: 'solutions-private/it-001.yaml',
    ...overrides,
  };
}

describe('catálogo de reservas (T-H5-05 ← P-I §7.7)', () => {
  it('son las diez literales de §7.7, en su orden', () => {
    expect(RESERVES).toEqual([
      'diagnostic',
      'guided_practice',
      'independent_practice',
      'recovery',
      'probes_baseline',
      'probes_intervention',
      'TRANSFER_MASTERY',
      'TRANSFER_MEASUREMENT',
      'retention',
      'replacement',
    ]);
  });

  it('el árbol obligatorio da nueve directorios para diez reservas, y la asimetría se dice', () => {
    // P-II §3.2 fija la estructura y el Maestro está por encima del plan: no se
    // crea un décimo directorio. Lo que se hace es declarar que esas dos no
    // quedan separadas por directorio (D-20).
    const directorios = new Set(RESERVES.map((r) => RESERVE_DIRECTORY[r]));
    expect(directorios.size).toBe(9);
    expect(reservesSharingDirectory()).toEqual([['TRANSFER_MASTERY', 'TRANSFER_MEASUREMENT']]);
  });

  it('`physicallySeparable` es falso justo en esas dos y cierto en las otras ocho', () => {
    // Devolver `true` para todas afirmaría que la separación física está
    // resuelta donde el árbol no la resuelve, y T-H5-06 heredaría una garantía
    // inexistente.
    expect(physicallySeparable('TRANSFER_MASTERY')).toBe(false);
    expect(physicallySeparable('TRANSFER_MEASUREMENT')).toBe(false);
    const separables = RESERVES.filter((r) => physicallySeparable(r));
    expect(separables).toHaveLength(8);
  });

  it('la lista de reservas que comparten directorio se deriva de la tabla, no se copia', () => {
    // Si alguien reasignara un directorio, la lista lo seguiría sola: copiarla
    // aparte la dejaría envejecer sin que nada lo notara.
    const tablaSembrada: Record<Reserve, string> = {
      ...RESERVE_DIRECTORY,
      retention: 'items/recovery',
    };
    const grupos = reservesSharingDirectory(tablaSembrada);
    expect(grupos).toContainEqual(['recovery', 'retention']);
  });
});

describe('separación física (paso 10 de W3)', () => {
  it('acepta una colocación coherente y devuelve siempre el hueco del árbol', () => {
    const informe = assertPhysicalSeparation([colocacion()]);
    // El informe trae `notSeparatedByDirectory` incluso cuando todo está bien:
    // omitirlo se leería como que la separación física quedó completa.
    expect(informe.notSeparatedByDirectory).toEqual([
      ['TRANSFER_MASTERY', 'TRANSFER_MEASUREMENT'],
    ]);
  });

  it('rechaza el reactivo archivado en el directorio de otra reserva', () => {
    expect(() =>
      assertPhysicalSeparation([
        colocacion({ reserve: 'recovery', path: 'items/probes-baseline/it-001.yaml' }),
      ]),
    ).toThrow(ReserveSeparationError);
  });

  it('rechaza el mismo reactivo en dos reservas', () => {
    expect(() =>
      assertPhysicalSeparation([
        colocacion(),
        colocacion({ reserve: 'retention', path: 'items/retention/it-001.yaml' }),
      ]),
    ).toThrow(/está a la vez en/u);
  });

  it('rechaza dos reactivos que reclaman la misma ruta', () => {
    expect(() =>
      assertPhysicalSeparation([colocacion(), colocacion({ itemId: 'it-002' })]),
    ).toThrow(/sobreescribiría/u);
  });

  it('rechaza el certificado escrito fuera de solutions-private', () => {
    // Es la frontera de I-2: el contenedor del agente monta `items/` y no monta
    // `solutions-private/`.
    expect(() =>
      assertPhysicalSeparation([
        colocacion({ solutionPath: 'items/guided-practice/it-001.solution.yaml' }),
      ]),
    ).toThrow(ReserveSeparationError);
    expect(() =>
      assertPhysicalSeparation([colocacion({ solutionPath: 'hints/it-001.yaml' })]),
    ).toThrow(ReserveSeparationError);
    expect(SOLUTIONS_DIRECTORY).toBe('solutions-private');
  });

  it('no acepta un prefijo que solo se parece al directorio de soluciones', () => {
    expect(() =>
      assertPhysicalSeparation([colocacion({ solutionPath: 'solutions-private-copia/it.yaml' })]),
    ).toThrow(ReserveSeparationError);
  });

  it('las dos reservas de transferencia sí conviven en su directorio compartido', () => {
    // No es un permiso: es el hecho del árbol. Que convivan aquí es justo lo
    // que obliga a T-H5-06 a separarlas por otro medio.
    const informe = assertPhysicalSeparation([
      colocacion({
        itemId: 'tm-01',
        reserve: 'TRANSFER_MASTERY',
        path: 'items/transfer/tm-01.yaml',
        solutionPath: 'solutions-private/tm-01.yaml',
      }),
      colocacion({
        itemId: 'tx-01',
        reserve: 'TRANSFER_MEASUREMENT',
        path: 'items/transfer/tx-01.yaml',
        solutionPath: 'solutions-private/tx-01.yaml',
      }),
    ]);
    expect(informe.placements).toHaveLength(2);
    expect(informe.notSeparatedByDirectory[0]).toContain('TRANSFER_MEASUREMENT');
  });
});

describe('reservas de medición, derivadas del contrato (T-H5-06 ← P-II §6.3)', () => {
  it('son las cuatro alcanzables desde `measureKind` × fase', () => {
    expect(MEASUREMENT_RESERVES).toEqual([
      'TRANSFER_MEASUREMENT',
      'probes_baseline',
      'probes_intervention',
      'retention',
    ]);
    expect(TRANSFER_BANKS).toEqual(['TRANSFER_MASTERY', 'TRANSFER_MEASUREMENT']);
  });

  it('si el contrato nombrara un banco que no es reserva, la derivación lo detecta', () => {
    // La guarda no se puede disparar con el contrato de hoy —solo salta si
    // contrato y catálogo divergen, y no divergen—, así que se hace inyectable
    // igual que `findCycles(edges)`. Sin inyección sería indistinguible de no
    // tenerla.
    expect(() => transferBanksFrom(['TRANSFER_MASTERY', 'TRANSFER_TERCERO'])).toThrow(
      /Contrato y catálogo se han separado/u,
    );
    expect(transferBanksFrom()).toEqual([...TRANSFER_BANKS]);
  });

  it('cada combinación descrita cae en su reserva, y las demás lanzan', () => {
    // «`transfer_measurement` solo selecciona de la reserva TRANSFER_MEASUREMENT»
    // es literal del contrato; los nombres de fase son los de las dos reservas
    // de sondas.
    expect(measurementReserveFor('primary_probe', 'baseline')).toBe('probes_baseline');
    expect(measurementReserveFor('primary_probe', 'intervention')).toBe('probes_intervention');
    expect(measurementReserveFor('retention_probe', 'retention')).toBe('retention');
    for (const phase of ScedPhase.options) {
      expect(measurementReserveFor('transfer_measurement', phase)).toBe('TRANSFER_MEASUREMENT');
    }
    // Una sonda de retención en fase de línea base no la describe nadie: elegir
    // una reserva decidiría por cuenta propia de qué banco sale una medida.
    expect(() => measurementReserveFor('retention_probe', 'baseline')).toThrow(ReserveOverlapError);
    expect(() => measurementReserveFor('primary_probe', 'retention')).toThrow(ReserveOverlapError);
  });

  it('la derivación recorre el contrato entero, así que no se queda corta en silencio', () => {
    const alcanzadas = new Set<Reserve>();
    for (const kind of MeasureKind.options) {
      for (const phase of ScedPhase.options) {
        try {
          alcanzadas.add(measurementReserveFor(kind, phase));
        } catch {
          /* combinación no descrita */
        }
      }
    }
    expect([...alcanzadas].sort()).toEqual([...MEASUREMENT_RESERVES]);
    expect(MEASUREMENT_RESERVES.every((r) => isMeasurementReserve(r))).toBe(true);
    expect(isMeasurementReserve('guided_practice')).toBe(false);
  });
});

describe('qué colisión está prohibida (P-I §7.7, §7.8, §5.11)', () => {
  it('dentro de una misma reserva no lo está: es la familia de §7.8', () => {
    // `replacement` queda fuera porque no es una reserva **efectiva**: se
    // resuelve antes con `effectiveReserve()`, y preguntarla aquí lanza.
    for (const reserva of RESERVES.filter((r) => r !== 'replacement')) {
      expect(collisionProhibited(reserva, reserva)).toBe(false);
    }
  });

  it('entre dos reservas de enseñanza tampoco', () => {
    expect(collisionProhibited('guided_practice', 'independent_practice')).toBe(false);
    expect(collisionProhibited('diagnostic', 'recovery')).toBe(false);
  });

  it('en cuanto una es de medición, sí, y en las dos direcciones', () => {
    expect(collisionProhibited('guided_practice', 'probes_baseline')).toBe(true);
    expect(collisionProhibited('probes_baseline', 'guided_practice')).toBe(true);
    expect(collisionProhibited('TRANSFER_MASTERY', 'TRANSFER_MEASUREMENT')).toBe(true);
    expect(collisionProhibited('probes_baseline', 'retention')).toBe(true);
  });

  it('preguntar por `replacement` sin resolverla antes lanza en vez de responder `false`', () => {
    // Responder `false` dejaría pasar en silencio una reposición isomorfa a una
    // sonda; la reserva efectiva se resuelve con `effectiveReserve()`.
    expect(() => collisionProhibited('replacement', 'probes_baseline')).toThrow(ReserveOverlapError);
    expect(() => collisionProhibited('guided_practice', 'replacement')).toThrow(ReserveOverlapError);
  });
});

describe('reserva efectiva de una reposición (D-21)', () => {
  it('una reposición sin declarar a qué repone se rechaza', () => {
    // Ninguna autoridad dice si el banco de reposición es de enseñanza o de
    // medición. Suponerlo dejaría entrar una reposición isomorfa a una sonda.
    expect(() => effectiveReserve({ itemId: 'r-1', reserve: 'replacement' })).toThrow(
      ReserveOverlapError,
    );
  });

  it('declarada, hereda la clasificación de lo que repone', () => {
    expect(
      effectiveReserve({ itemId: 'r-1', reserve: 'replacement', replacesReserve: 'retention' }),
    ).toBe('retention');
    expect(
      effectiveReserve({
        itemId: 'r-2',
        reserve: 'replacement',
        replacesReserve: 'guided_practice',
      }),
    ).toBe('guided_practice');
  });

  it('una reposición que dice reponer a la reserva de reposición se rechaza', () => {
    expect(() =>
      effectiveReserve({ itemId: 'r-3', reserve: 'replacement', replacesReserve: 'replacement' }),
    ).toThrow(ReserveOverlapError);
  });

  it('las demás reservas son su propia reserva efectiva', () => {
    expect(effectiveReserve({ itemId: 'x', reserve: 'diagnostic' })).toBe('diagnostic');
  });
});

describe('disjunción de reservas del paquete (T-H5-06)', () => {
  it('acepta un paquete coherente y declara siempre que el detector no está validado', () => {
    const informe = assertReserveDisjointness([
      paquete(),
      paquete({ itemId: 'it-002', reserve: 'probes_baseline', proof: OTRA_ESTRUCTURA(),
        promptText: 'Resuelve.' }),
    ]);
    expect(informe.itemsChecked).toBe(2);
    expect(informe.detectorPrecisionValidated).toBe(false);
  });

  it('rechaza el mismo id en dos reservas, y **no** lo llama duplicado estructural', () => {
    // Un id repetido no es un duplicado de estructura: clasificarlo así diría
    // que dos reactivos comparten estructura cuando lo que comparten es el
    // nombre, y se arreglan distinto.
    expect(() =>
      assertReserveDisjointness([
        paquete(),
        paquete({ reserve: 'retention', proof: OTRA_ESTRUCTURA(), promptText: 'otra' }),
      ]),
    ).toThrow(/same_id_in_two_reserves/u);
  });

  it('rechaza el id repetido dentro de una misma reserva, con su propio código', () => {
    expect(() =>
      assertReserveDisjointness([
        paquete(),
        paquete({ proof: OTRA_ESTRUCTURA(), promptText: 'otra' }),
      ]),
    ).toThrow(/duplicate_item_id/u);
  });

  it('rechaza el duplicado trivial entre práctica y sonda', () => {
    expect(() =>
      assertReserveDisjointness([
        paquete({ itemId: 'p-1', reserve: 'guided_practice', proof: CONJUNCION() }),
        paquete({
          itemId: 's-1',
          reserve: 'probes_baseline',
          proof: CONJUNCION_RENOMBRADA(),
          promptText: 'otra redaccion',
        }),
      ]),
    ).toThrow(/trivial_duplicate/u);
  });

  it('deja pasar esa misma pareja cuando las dos son de enseñanza', () => {
    expect(() =>
      assertReserveDisjointness([
        paquete({ itemId: 'p-1', reserve: 'guided_practice', proof: CONJUNCION() }),
        paquete({
          itemId: 'p-2',
          reserve: 'independent_practice',
          proof: CONJUNCION_RENOMBRADA(),
          promptText: 'otra redaccion',
        }),
      ]),
    ).not.toThrow();
  });

  it('rechaza el isomorfo con los pasos independientes en otro orden', () => {
    const base = {
      lines: [
        { formula: 'A', rule: 'PR', depth: 0 },
        { formula: 'B', rule: 'PR', depth: 0 },
        { formula: 'A∧B', rule: '∧I', refs: [1, 2], depth: 0 },
      ],
      goal: 'A∧B',
    };
    const citasAlReves = {
      lines: [
        { formula: 'A', rule: 'PR', depth: 0 },
        { formula: 'B', rule: 'PR', depth: 0 },
        { formula: 'A∧B', rule: '∧I', refs: [2, 1], depth: 0 },
      ],
      goal: 'A∧B',
    };
    expect(() =>
      assertReserveDisjointness([
        paquete({ itemId: 'tm-1', reserve: 'TRANSFER_MASTERY', proof: base }),
        paquete({
          itemId: 'tx-1',
          reserve: 'TRANSFER_MEASUREMENT',
          proof: citasAlReves,
          promptText: 'otra redaccion',
        }),
      ]),
    ).toThrow(/isomorphic/u);
  });

  it('el control de superficie atrapa la redacción idéntica aunque la prueba difiera', () => {
    // §5.11: el detector opera sobre la representación estructural **además de
    // controles de superficie**. Este es el que no necesita umbral.
    expect(() =>
      assertReserveDisjointness([
        paquete({ itemId: 'p-1', reserve: 'guided_practice', promptText: 'Demuestra  B∧A.' }),
        paquete({
          itemId: 's-1',
          reserve: 'probes_baseline',
          proof: OTRA_ESTRUCTURA(),
          promptText: 'Demuestra B∧A.',
        }),
      ]),
    ).toThrow(/identical_surface/u);
  });

  it('reporta todas las colisiones, no la primera', () => {
    try {
      assertReserveDisjointness([
        paquete({ itemId: 'p-1', reserve: 'guided_practice', proof: CONJUNCION() }),
        paquete({
          itemId: 's-1',
          reserve: 'probes_baseline',
          proof: CONJUNCION_RENOMBRADA(),
          promptText: 'a',
        }),
        paquete({
          itemId: 's-2',
          reserve: 'retention',
          proof: CONJUNCION_RENOMBRADA(),
          promptText: 'b',
        }),
      ]);
      throw new Error('debió lanzar');
    } catch (error) {
      expect((error as Error).message).toMatch(/3 punto\(s\)/u);
    }
  });

  it('una reposición de una reserva de medición arrastra su disjunción', () => {
    expect(() =>
      assertReserveDisjointness([
        paquete({ itemId: 'p-1', reserve: 'guided_practice', proof: CONJUNCION() }),
        paquete({
          itemId: 'r-1',
          reserve: 'replacement',
          replacesReserve: 'probes_baseline',
          proof: CONJUNCION_RENOMBRADA(),
          promptText: 'otra',
        }),
      ]),
    ).toThrow(ReserveOverlapError);
  });
});

describe('aislamiento de transferencia (DUP-01)', () => {
  it('con uno de los dos bancos vacío el aislamiento es `null`, **no** `true`', () => {
    // Sin pares que comparar no hay aislamiento que afirmar: un `true` ahí sería
    // la prueba que pasa por vacío, que es justo la que DUP-01 existe para evitar.
    const informe = assertReserveDisjointness([
      paquete({ itemId: 'tm-1', reserve: 'TRANSFER_MASTERY' }),
    ]);
    expect(informe.transferIsolation.isolated).toBeNull();
    expect(informe.transferIsolation.pairsCompared).toBe(0);
  });

  it('con los dos bancos poblados cuenta los pares comparados', () => {
    const informe = assertReserveDisjointness([
      paquete({ itemId: 'tm-1', reserve: 'TRANSFER_MASTERY', proof: CONJUNCION() }),
      paquete({
        itemId: 'tx-1',
        reserve: 'TRANSFER_MEASUREMENT',
        proof: OTRA_ESTRUCTURA(),
        promptText: 'otra',
      }),
    ]);
    expect(informe.transferIsolation.pairsCompared).toBe(1);
    expect(informe.transferIsolation.isolated).toBe(true);
  });

  it('afirmar que el aislamiento está **demostrado** falla cerrado (CAL-07)', () => {
    // «No detecté» no es «no hay»: eso exige la precisión y el recall del
    // detector, que se validan en H5/H10.
    const informe = assertReserveDisjointness([
      paquete({ itemId: 'tm-1', reserve: 'TRANSFER_MASTERY', proof: CONJUNCION() }),
      paquete({
        itemId: 'tx-1',
        reserve: 'TRANSFER_MEASUREMENT',
        proof: OTRA_ESTRUCTURA(),
        promptText: 'otra',
      }),
    ]);
    expect(() => assertTransferIsolationDemonstrated(informe)).toThrow(CalibrationPendingError);
    expect(() => assertTransferIsolationDemonstrated(informe)).toThrow(/DUP-01/u);
  });

  it('el parecido de superficie con tolerancia falla cerrado; la igualdad no la necesita', () => {
    expect(() => surfaceSimilarity('Demuestra A∧B', 'Demuestra B∧A')).toThrow(
      CalibrationPendingError,
    );
  });
});

describe('exclusiones por consumo (P-I §7.7 literal)', () => {
  it('las cuatro reservas que consumen excluyen las cuatro de medición', () => {
    expect(Object.keys(CONSUMPTION_EXCLUSIONS).sort()).toEqual([
      'TRANSFER_MASTERY',
      'guided_practice',
      'independent_practice',
      'recovery',
    ]);
    for (const excluidas of Object.values(CONSUMPTION_EXCLUSIONS)) {
      expect([...excluidas].sort()).toEqual([...MEASUREMENT_RESERVES]);
    }
  });

  it('ninguna exclusión nombra una reserva que no exista', () => {
    for (const excluidas of Object.values(CONSUMPTION_EXCLUSIONS)) {
      for (const reserva of excluidas) expect(RESERVES).toContain(reserva);
    }
  });
});
