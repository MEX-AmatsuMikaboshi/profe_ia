import { ModelOutputClassification } from '@profesor-ia/contracts';
import { describe, expect, it } from 'vitest';

import {
  CASE_FAMILIES,
  CaseSetError,
  FAMILY_FLOORS,
  TOTAL_FLOOR,
  assertExpectationsMatchFamily,
  assertFaultDeclarationCoherent,
  assertMaterialSetUsable,
  assertUniqueCaseIds,
  countByFamily,
  partitionBySeed,
  type BenchCase,
  type CaseSet,
  type InjectedFault,
} from '../src/case-set.js';
import {
  MATERIAL_CASES,
  MATERIAL_CASE_SET,
  MATERIAL_INSTRUCTIONS,
} from '../src/material-cases.js';

/**
 * El conjunto material de BENCH-01 (T-H4-10 ← P-III §6.1).
 *
 * Estas pruebas no juzgan si un caso está bien redactado —eso lo ve la muestra
 * ciega de §6.2— sino que el conjunto sea **utilizable como benchmark**: que
 * alcance los pisos, que ningún id se repita, que la expectativa corresponda a
 * la familia y que la familia de caídas simule de verdad una caída.
 *
 * Cada comprobación viene con su **control negativo**: un conjunto sembrado con
 * el defecto que la comprobación dice cazar. Sin él no se distingue un control
 * que funciona de uno que pasa por vacío.
 */

const conCasos = (cases: readonly BenchCase[]): CaseSet => ({
  caseSetId: 'cs-sembrado',
  purpose: 'material',
  cases,
});

describe('conjunto material de BENCH-01', () => {
  it('es utilizable como benchmark material', () => {
    expect(() => {
      assertMaterialSetUsable(MATERIAL_CASE_SET);
    }).not.toThrow();
  });

  it('trae exactamente los 200 casos que suman los pisos de P-III §6.1', () => {
    expect(MATERIAL_CASES).toHaveLength(TOTAL_FLOOR);
    expect(TOTAL_FLOOR).toBe(200);
  });

  it('cubre cada familia justo en su piso, sin sobras ni faltantes', () => {
    const conteo = countByFamily(MATERIAL_CASES);
    for (const piso of FAMILY_FLOORS) {
      expect(conteo.get(piso.family)).toBe(piso.minimumCases);
    }
  });

  it('no repite ningún caseId', () => {
    expect(() => {
      assertUniqueCaseIds(MATERIAL_CASE_SET);
    }).not.toThrow();
    expect(new Set(MATERIAL_CASES.map((c) => c.caseId)).size).toBe(MATERIAL_CASES.length);
  });

  it('distingue sus ids de los del piloto con el prefijo m-', () => {
    // Un informe que mezclara las dos corridas no debe poder confundirlas: el
    // piloto midió costo y este dictamina, y `expl-1` frente a `expl-01` es una
    // diferencia demasiado fácil de leer mal.
    for (const caso of MATERIAL_CASES) expect(caso.caseId.startsWith('m-')).toBe(true);
  });
});

describe('la familia de caídas simula la caída, no la pide', () => {
  const caidas = MATERIAL_CASES.filter((c) => c.family === 'failure_or_invalid_output');

  it('declara un fallo inyectado en cada caso, y sólo ahí', () => {
    expect(() => {
      assertFaultDeclarationCoherent(MATERIAL_CASE_SET);
    }).not.toThrow();
    expect(caidas.every((c) => c.injectedFault !== undefined)).toBe(true);
    expect(
      MATERIAL_CASES.filter((c) => c.family !== 'failure_or_invalid_output').every(
        (c) => c.injectedFault === undefined,
      ),
    ).toBe(true);
  });

  it('ninguna entrada le pide al modelo que devuelva basura', () => {
    // El defecto del piloto, escrito como control: pedirle a un modelo que
    // ignore el formato mide su obediencia, no la recuperación del sistema.
    for (const caso of caidas) {
      const texto = caso.input.toLowerCase();
      expect(texto).not.toContain('xml');
      expect(texto).not.toContain('error');
      expect(texto).not.toContain('ignora');
      expect(texto).not.toContain('sin ninguna estructura');
    }
  });

  it('la observación declarada corresponde al modo de fallo', () => {
    const esperado: Record<InjectedFault['kind'], string> = {
      http_status: 'provider_error',
      connection_dropped: 'transport_failure',
      timeout: 'transport_failure',
      truncated_body: 'truncated',
      refusal_body: 'refusal',
      schema_violating_text: 'schema_violation',
      empty_text: 'schema_violation',
    };
    for (const caso of caidas) {
      const fallo = caso.injectedFault;
      expect(fallo).toBeDefined();
      if (fallo === undefined) continue;
      expect(fallo.observation).toBe(esperado[fallo.kind]);
    }
  });

  it('cubre las cuatro clasificaciones no válidas del contrato y la caída de transporte', () => {
    // La lista **se deriva** del enum cerrado del contrato en vez de
    // transcribirse: si mañana el contrato añade una clasificación, esta prueba
    // cae y obliga a decidir si la nueva necesita un caso, en vez de quedarse
    // sin cubrir en silencio.
    const exigidas = new Set<string>([
      ...ModelOutputClassification.options.filter((o) => o !== 'valid'),
      'transport_failure',
    ]);
    const cubiertas = new Set(caidas.map((c) => c.injectedFault?.observation));
    expect(cubiertas).toEqual(exigidas);
  });
});

describe('las expectativas se declaran antes de correr y corresponden a su familia', () => {
  it('el conjunto es coherente', () => {
    expect(() => {
      assertExpectationsMatchFamily(MATERIAL_CASE_SET);
    }).not.toThrow();
  });

  it('toda pregunta fuera de alcance exige declararlo', () => {
    for (const caso of MATERIAL_CASES.filter((c) => c.family === 'out_of_scope_question')) {
      expect(caso.expectation.mustDeclareOutOfScope).toBe(true);
    }
  });

  it('todo adversarial exige negar la revelación y seguir siendo utilizable', () => {
    for (const caso of MATERIAL_CASES.filter(
      (c) => c.family === 'adversarial_solution_extraction',
    )) {
      expect(caso.expectation.mustRefuseSolutionDisclosure).toBe(true);
      // Negarse **con una respuesta útil** es la conducta buscada: una negativa
      // ilegible fallaría el gate de utilizables aunque no filtrara nada.
      expect(caso.expectation.structurallyUsable).toBe(true);
    }
  });

  it('sólo la familia de caídas espera recuperación a modo degradado', () => {
    for (const caso of MATERIAL_CASES) {
      expect(caso.expectation.mustRecoverToDegraded).toBe(
        caso.family === 'failure_or_invalid_output',
      );
    }
  });
});

describe('instrucciones de la corrida material', () => {
  it('no le pide al modelo que se autodenuncie de haber filtrado', () => {
    // El agujero de §3.3(d): un modelo que filtrara y contestara `false` habría
    // pasado un gate de cero fallos y bloqueante.
    expect(MATERIAL_INSTRUCTIONS).not.toContain('entregaSolucion');
  });

  it('conserva la declaración de alcance, que es conducta y no autoinforme', () => {
    expect(MATERIAL_INSTRUCTIONS).toContain('fueraDeAlcance');
  });

  it('enumera la whitelist cerrada de reglas del cálculo congelado', () => {
    for (const regla of ['∧I', '∧E', '∨I', '∨E', '→I', '→E', '↔I', '↔E', '¬I', '¬E', 'IP', 'DNE']) {
      expect(MATERIAL_INSTRUCTIONS).toContain(regla);
    }
  });
});

describe('partición por semilla registrada', () => {
  it('reconstruye la misma partición desde la misma semilla', () => {
    const a = partitionBySeed(MATERIAL_CASE_SET, 20260818, 0.5);
    const b = partitionBySeed(MATERIAL_CASE_SET, 20260818, 0.5);
    expect(a.evaluation.map((c) => c.caseId)).toEqual(b.evaluation.map((c) => c.caseId));
    expect(a.development.length + a.evaluation.length).toBe(TOTAL_FLOOR);
  });

  it('deja al menos un caso de cada familia en evaluación', () => {
    const particion = partitionBySeed(MATERIAL_CASE_SET, 20260818, 0.5);
    const enEvaluacion = countByFamily(particion.evaluation);
    for (const familia of CASE_FAMILIES) {
      expect(enEvaluacion.get(familia) ?? 0).toBeGreaterThan(0);
    }
  });
});

describe('controles negativos: cada comprobación caza el defecto que dice cazar', () => {
  it('un id repetido se detecta', () => {
    const primero = MATERIAL_CASES[0];
    expect(primero).toBeDefined();
    if (primero === undefined) return;
    expect(() => {
      assertUniqueCaseIds(conCasos([...MATERIAL_CASES, primero]));
    }).toThrow(CaseSetError);
  });

  it('una caída sin fallo inyectado se detecta', () => {
    // Se **retira** la clave en vez de ponerla en `undefined`: con
    // `exactOptionalPropertyTypes` un `injectedFault: undefined` presente no es
    // lo mismo que ausente, y lo que este caso simula es un caso de la familia
    // de caídas que no declara fallo ninguno.
    const sinFallo = MATERIAL_CASES.map((c) => {
      if (c.family !== 'failure_or_invalid_output') return c;
      const copia: Record<string, unknown> = { ...c };
      delete copia['injectedFault'];
      return copia as unknown as BenchCase;
    });
    expect(() => {
      assertFaultDeclarationCoherent(conCasos(sinFallo));
    }).toThrow(/no declaran fallo inyectado/);
  });

  it('un fallo inyectado fuera de su familia se detecta', () => {
    const explicacion = MATERIAL_CASES.find((c) => c.family === 'explanation_request');
    expect(explicacion).toBeDefined();
    if (explicacion === undefined) return;
    const contaminado: BenchCase = {
      ...explicacion,
      injectedFault: { kind: 'timeout', observation: 'transport_failure' },
    };
    expect(() => {
      assertFaultDeclarationCoherent(conCasos([contaminado]));
    }).toThrow(/fuera de/);
  });

  it('un adversarial que no exige negarse se detecta', () => {
    const adversarial = MATERIAL_CASES.find(
      (c) => c.family === 'adversarial_solution_extraction',
    );
    expect(adversarial).toBeDefined();
    if (adversarial === undefined) return;
    const flojo: BenchCase = {
      ...adversarial,
      expectation: { ...adversarial.expectation, mustRefuseSolutionDisclosure: false },
    };
    expect(() => {
      assertExpectationsMatchFamily(conCasos([flojo]));
    }).toThrow(/mustRefuseSolutionDisclosure/);
  });

  it('una caída declarada como utilizable se detecta', () => {
    const caida = MATERIAL_CASES.find((c) => c.family === 'failure_or_invalid_output');
    expect(caida).toBeDefined();
    if (caida === undefined) return;
    const incoherente: BenchCase = {
      ...caida,
      expectation: { ...caida.expectation, structurallyUsable: true },
    };
    expect(() => {
      assertExpectationsMatchFamily(conCasos([incoherente]));
    }).toThrow(/estructuralmente utilizable/);
  });

  it('un conjunto por debajo del piso se detecta', () => {
    expect(() => {
      assertMaterialSetUsable(conCasos(MATERIAL_CASES.slice(0, 199)));
    }).toThrow(CaseSetError);
  });
});
