import { describe, expect, it } from 'vitest';
import {
  assertCriticalPointTransfers,
  assertFamilyDeclarations,
  assertHintCoveragePerErrorType,
  assertPerKcCoverage,
  assertPostMasteryReconfirmationCapacity,
  assertRetentionReserveSufficient,
  CalibrationPendingError,
  countsAsOperationalOpportunity,
  COVERAGE_PARAMETERS,
  CoverageError,
  minimumProbeInventory,
  perKcCoverageGaps,
  requiredProbesForCalendar,
  retentionCoverage,
  type CoverageItem,
  type PerKcCoverageInput,
  type Reserve,
} from '../src/index.js';

const KC = 'KC09' as const;

function item(id: string, reserve: Reserve, extra: Partial<CoverageItem> = {}): CoverageItem {
  return { itemId: id, reserve, targetKcs: [KC], hintLevels: [], ...extra };
}

/** Banco que cumple los cinco pisos del KC: 6 operativas, 3 niveles, 1 transferencia, 1 recuperación. */
function bancoCompleto(): readonly CoverageItem[] {
  return [
    item('p-1', 'guided_practice', { hintLevels: [1, 2] }),
    item('p-2', 'guided_practice', { hintLevels: [3] }),
    item('p-3', 'independent_practice'),
    item('p-4', 'independent_practice'),
    item('d-1', 'diagnostic'),
    item('rec-1', 'recovery'),
    item('tm-1', 'TRANSFER_MASTERY'),
  ];
}

function entrada(overrides: Partial<PerKcCoverageInput> = {}): PerKcCoverageInput {
  return {
    kcsInPilot: [KC],
    items: bancoCompleto(),
    corpusTraceByKc: { [KC]: ['openlogic@v1#cap4'] },
    ...overrides,
  };
}

describe('parámetros de cobertura (T-H5-08 ← P-III §4.2)', () => {
  it('las cifras son las literales de la norma y llevan su id de parámetro', () => {
    expect(COVERAGE_PARAMETERS['operationalActivitiesPerKc']?.value).toBe(6);
    expect(COVERAGE_PARAMETERS['hintLevelsPerKc']?.value).toBe(3);
    expect(COVERAGE_PARAMETERS['transferActivitiesPerKc']?.value).toBe(1);
    expect(COVERAGE_PARAMETERS['probeReservePercent']?.value).toBe(20);
    expect(COVERAGE_PARAMETERS['retentionIntervalDays']?.value).toBe(7);
    for (const p of Object.values(COVERAGE_PARAMETERS)) {
      expect(p.parameterId).not.toBe('');
      expect(p.source).toMatch(/§/u);
    }
  });

  it('el informe declara que el registro de parámetros todavía no los tiene', () => {
    // §4.2: son «parámetros operativos de cobertura de esta versión», que «se
    // identifican en el registro de parámetros y se congelan».
    // `docs/params/registry.yaml` está vacío a propósito.
    expect(assertPerKcCoverage(entrada()).parametersFrozenInRegistry).toBe(false);
  });
});

describe('pisos por KC', () => {
  it('un banco completo no deja huecos', () => {
    expect(perKcCoverageGaps(entrada())).toEqual([]);
  });

  it('sin KC declarados la cobertura saldría completa sin un solo reactivo', () => {
    expect(() => perKcCoverageGaps(entrada({ kcsInPilot: [], items: [] }))).toThrow(CoverageError);
  });

  it('rechaza un KC que no está en el catálogo', () => {
    // @ts-expect-error KC inexistente
    expect(() => perKcCoverageGaps(entrada({ kcsInPilot: ['KC99'] }))).toThrow(CoverageError);
  });

  it('reporta **todos** los huecos, no el primero', () => {
    const huecos = perKcCoverageGaps(entrada({ items: [], corpusTraceByKc: {} }));
    expect(huecos.map((h) => h.parameterId).sort()).toEqual([
      'COV-KC-ACTIVITIES',
      'COV-KC-HINT-LEVELS',
      'COV-KC-RECOVERY',
      'COV-KC-TRACEABILITY',
      'COV-KC-TRANSFER',
    ]);
  });

  it('cinco actividades operativas no llegan al piso de seis', () => {
    // `bancoCompleto()` tiene siete: quitando dos quedan cinco.
    const huecos = perKcCoverageGaps(
      entrada({ items: bancoCompleto().filter((i) => i.itemId !== 'p-4' && i.itemId !== 'p-3') }),
    );
    expect(huecos.find((h) => h.parameterId === 'COV-KC-ACTIVITIES')).toMatchObject({
      found: 5,
      required: 6,
    });
  });

  it('las sondas **no** cuentan como oportunidad operativa (D-22)', () => {
    // §10.3 separa enseñanza de medición y exige «sin reutilización»: una sonda
    // no es una oportunidad de practicar el KC, es la medida de si se aprendió.
    // Contarlas dejaría llegar al piso gastando el material con el que se mide.
    expect(countsAsOperationalOpportunity(item('s-1', 'probes_baseline'))).toBe(false);
    expect(countsAsOperationalOpportunity(item('s-2', 'retention'))).toBe(false);
    expect(countsAsOperationalOpportunity(item('p-1', 'guided_practice'))).toBe(true);

    // Cinco operativas más dos sondas: si las sondas contaran, el KC llegaría a
    // siete y el piso saldría cubierto.
    const conSondas = [
      ...bancoCompleto().filter((i) => i.itemId !== 'p-4' && i.itemId !== 'p-3'),
      item('s-1', 'probes_baseline'),
      item('s-2', 'probes_intervention'),
    ];
    const huecos = perKcCoverageGaps(entrada({ items: conSondas }));
    expect(huecos.find((h) => h.parameterId === 'COV-KC-ACTIVITIES')?.found).toBe(5);
  });

  it('una reposición cuenta según lo que repone (D-21)', () => {
    const conReposicion = [
      ...bancoCompleto().filter((i) => i.itemId !== 'p-4' && i.itemId !== 'p-3'),
      item('r-1', 'replacement', { replacesReserve: 'independent_practice' }),
      item('r-2', 'replacement', { replacesReserve: 'guided_practice' }),
    ];
    expect(
      perKcCoverageGaps(entrada({ items: conReposicion })).find(
        (h) => h.parameterId === 'COV-KC-ACTIVITIES',
      ),
    ).toBeUndefined();
  });

  it('los tres niveles de pista se cuentan distintos, no repetidos', () => {
    const conNivelesRepetidos = bancoCompleto().map((i) =>
      i.itemId === 'p-2' ? { ...i, hintLevels: [1 as const] } : i,
    );
    const huecos = perKcCoverageGaps(entrada({ items: conNivelesRepetidos }));
    expect(huecos.find((h) => h.parameterId === 'COV-KC-HINT-LEVELS')).toMatchObject({
      found: 2,
      required: 3,
    });
  });

  it('una transferencia de **medición** no cubre el piso de transferencia del KC', () => {
    // §5.11: TRANSFER_MASTERY la usa el controlador para comprobar dominio
    // operativo; TRANSFER_MEASUREMENT va sin agente ni feedback y solo alimenta
    // la medida experimental. Como §5.3 exige una transferencia cercana
    // **elegible** para declarar dominio, contar la de medición dejaría el piso
    // cubierto y el dominio inalcanzable.
    const conTransferenciaDeMedicion = [
      ...bancoCompleto().filter((i) => i.itemId !== 'tm-1'),
      item('tx-1', 'TRANSFER_MEASUREMENT'),
      item('p-5', 'guided_practice'),
    ];
    const huecos = perKcCoverageGaps(entrada({ items: conTransferenciaDeMedicion }));
    expect(huecos.find((h) => h.parameterId === 'COV-KC-TRANSFER')).toMatchObject({
      found: 0,
      required: 1,
    });
  });

  it('un KC sin trazabilidad al corpus se enseñaría sin poder decir de dónde sale', () => {
    const huecos = perKcCoverageGaps(entrada({ corpusTraceByKc: { [KC]: [] } }));
    expect(huecos.map((h) => h.parameterId)).toContain('COV-KC-TRACEABILITY');
  });

  it('`assertPerKcCoverage` lanza enumerando los huecos', () => {
    expect(() => assertPerKcCoverage(entrada({ items: [], corpusTraceByKc: {} }))).toThrow(
      /5 punto\(s\)/u,
    );
  });
});

describe('sondas por conjunto: la regla sí, la entrada no (P-I §7.8)', () => {
  it('cuántas sondas pide el calendario falla cerrado', () => {
    // «La cantidad exacta se calcula desde el calendario», y el calendario se
    // congela en T-H5-11 / T-H6-07. Un número aquí decide si el piloto se abre.
    expect(() => requiredProbesForCalendar('A')).toThrow(CalibrationPendingError);
    expect(() => requiredProbesForCalendar('A')).toThrow(/CAL-01/u);
  });

  it('la reserva del 20 % se implementa y redondea hacia arriba', () => {
    // Una reserva que se quedara corta por el redondeo dejaría de ser «reserva
    // adicional mínima».
    expect(minimumProbeInventory(10)).toBe(12);
    expect(minimumProbeInventory(1)).toBe(2);
    expect(minimumProbeInventory(7)).toBe(9);
    expect(minimumProbeInventory(0)).toBe(0);
  });

  it('rechaza una exigencia de calendario que no es un entero no negativo', () => {
    expect(() => minimumProbeInventory(-1)).toThrow(CoverageError);
    expect(() => minimumProbeInventory(1.5)).toThrow(CoverageError);
  });
});

describe('puntos críticos y tipos de error: la norma los nombra sin definirlos', () => {
  it('sin puntos críticos declarados la comprobación pasaría por vacío', () => {
    expect(() =>
      assertCriticalPointTransfers({ criticalPoints: [], transferFormsByCriticalPoint: {} }),
    ).toThrow(CoverageError);
  });

  it('exige al menos una forma de transferencia por punto crítico', () => {
    expect(() =>
      assertCriticalPointTransfers({
        criticalPoints: ['descarga de supuestos', 'prueba indirecta'],
        transferFormsByCriticalPoint: { 'descarga de supuestos': ['forma-1'] },
      }),
    ).toThrow(/prueba indirecta/u);
    expect(() =>
      assertCriticalPointTransfers({
        criticalPoints: ['descarga de supuestos'],
        transferFormsByCriticalPoint: { 'descarga de supuestos': ['forma-1'] },
      }),
    ).not.toThrow();
  });

  it('cada tipo de error prioritario necesita pista en los cinco niveles', () => {
    expect(() => assertHintCoveragePerErrorType([], {})).toThrow(CoverageError);
    expect(() =>
      assertHintCoveragePerErrorType(['cita fuera de alcance'], {
        'cita fuera de alcance': [1, 2, 3],
      }),
    ).toThrow(/faltan niveles 4, 5/u);
    expect(() =>
      assertHintCoveragePerErrorType(['cita fuera de alcance'], {
        'cita fuera de alcance': [1, 2, 3, 4, 5],
      }),
    ).not.toThrow();
  });
});

describe('familias paramétricas (§7.8: generador, restricciones y verificador)', () => {
  const familia = {
    itemFamilyId: 'fam-1',
    generatorTemplateId: 'tpl-1',
    restrictions: ['sin reglas derivadas fuera de DNE'],
    verifierContract: 'authorized-calculus-v1',
  };

  it('exige los tres', () => {
    expect(() => assertFamilyDeclarations([familia])).not.toThrow();
    expect(() => assertFamilyDeclarations([{ ...familia, restrictions: [] }])).toThrow(
      /restricciones/u,
    );
    expect(() => assertFamilyDeclarations([{ ...familia, verifierContract: ' ' }])).toThrow(
      /verificador/u,
    );
    expect(() => assertFamilyDeclarations([{ ...familia, generatorTemplateId: '' }])).toThrow(
      /generador/u,
    );
  });

  it('sin familias la declaración pasaría por vacío', () => {
    expect(() => assertFamilyDeclarations([])).toThrow(CoverageError);
  });
});

describe('retención (P-I §5.5, CAL-13)', () => {
  it('con reserva, el informe no afirma suficiencia', () => {
    const informe = retentionCoverage({ willEvaluate: true, reserveItemIds: ['ret-1', 'ret-2'] });
    expect(informe.intervalDays).toBe(7);
    expect(informe.reserveItems).toBe(2);
    // Que la reserva no esté vacía no la hace suficiente para el calendario.
    expect(informe.sufficiencyDemonstrated).toBe(false);
    expect(informe.declaredCode).toBeNull();
  });

  it('decir que se medirá con la reserva vacía no se degrada solo al código', () => {
    // La salida que la norma prevé es declarar `retention_not_evaluated`.
    // Degradarlo aquí convertiría una decisión preinscrita de la corrida en un
    // apaño del validador.
    expect(() => retentionCoverage({ willEvaluate: true, reserveItemIds: [] })).toThrow(
      CoverageError,
    );
  });

  it('la declaración de no evaluar exige motivo registrado', () => {
    expect(() =>
      retentionCoverage({
        willEvaluate: false,
        declaredCode: 'retention_not_evaluated',
        reason: '  ',
      }),
    ).toThrow(CoverageError);
    const informe = retentionCoverage({
      willEvaluate: false,
      declaredCode: 'retention_not_evaluated',
      reason: 'sin reserva aislada para el intervalo de 7 días',
    });
    expect(informe.declaredCode).toBe('retention_not_evaluated');
  });

  it('afirmar suficiencia de la reserva falla cerrado con CAL-13', () => {
    const informe = retentionCoverage({ willEvaluate: true, reserveItemIds: ['ret-1'] });
    expect(() => assertRetentionReserveSufficient(informe)).toThrow(CalibrationPendingError);
    expect(() => assertRetentionReserveSufficient(informe)).toThrow(/CAL-13/u);
  });
});

describe('reconfirmación post-dominio (§7.8)', () => {
  it('exige capacidad desde la reserva de práctica independiente', () => {
    const items = bancoCompleto();
    expect(() => assertPostMasteryReconfirmationCapacity({ [KC]: 2 }, items)).not.toThrow();
    expect(() => assertPostMasteryReconfirmationCapacity({ [KC]: 3 }, items)).toThrow(
      /ráctica independiente insuficiente/u,
    );
  });

  it('la capacidad se cuenta por KC, no en total', () => {
    // Con total global, los dos reactivos de KC09 cubrirían la declaración de
    // KC10, y KC10 se quedaría sin la reconfirmación que lo confirma.
    const items = [...bancoCompleto(), item('otro-1', 'guided_practice', { targetKcs: ['KC10'] })];
    expect(() =>
      assertPostMasteryReconfirmationCapacity({ [KC]: 1, KC10: 1 }, items),
    ).toThrow(/KC10: 0\/1/u);
  });

  it('no vale la capacidad de otra reserva', () => {
    const soloGuiada = bancoCompleto().filter((i) => i.reserve !== 'independent_practice');
    expect(() => assertPostMasteryReconfirmationCapacity({ [KC]: 1 }, soloGuiada)).toThrow(
      CoverageError,
    );
  });

  it('cero declaraciones, o el mapa vacío, cumplirían la capacidad por vacío', () => {
    expect(() => assertPostMasteryReconfirmationCapacity({ [KC]: 0 }, bancoCompleto())).toThrow(
      CoverageError,
    );
    expect(() => assertPostMasteryReconfirmationCapacity({}, bancoCompleto())).toThrow(
      CoverageError,
    );
  });
});
