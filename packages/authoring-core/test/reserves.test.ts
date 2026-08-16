import { describe, expect, it } from 'vitest';
import {
  assertPhysicalSeparation,
  physicallySeparable,
  RESERVE_DIRECTORY,
  RESERVES,
  ReserveSeparationError,
  reservesSharingDirectory,
  SOLUTIONS_DIRECTORY,
  type ItemPlacement,
  type Reserve,
} from '../src/index.js';

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
