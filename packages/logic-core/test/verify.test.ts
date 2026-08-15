import { describe, expect, it } from 'vitest';
import { printProof, verify } from '../src/verify.js';
import type { ProofInput } from '../src/fitch.js';

const codes = (input: ProofInput): string[] => verify(input).errors.map((e) => e.code);
const line = (formula: string, rule: string, refs?: (number | [number, number])[], depth = 0) => ({
  formula,
  rule,
  ...(refs ? { refs } : {}),
  depth,
});

describe('derivaciones válidas', () => {
  it('∧E sobre una premisa', () => {
    const r = verify({
      lines: [line('A∧B', 'PR'), line('A', '∧E', [1])],
      goal: 'A',
    });
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
    expect(r.goalReached).toBe(true);
    expect(r.semanticCheck).toBe('passed');
  });

  it('→I descarga el supuesto de la subprueba', () => {
    const r = verify({
      lines: [
        line('A∧B', 'PR'),
        line('A∧B', 'AS', undefined, 1),
        line('A', '∧E', [2], 1),
        line('(A∧B)→A', '→I', [[2, 3]]),
      ],
      goal: '(A∧B)→A',
    });
    expect(r.errors).toEqual([]);
    expect(r.goalReached).toBe(true);
  });

  it('∨E con dos subpruebas a la misma conclusión', () => {
    const r = verify({
      lines: [
        line('A∨B', 'PR'),
        line('A→C', 'PR'),
        line('B→C', 'PR'),
        line('A', 'AS', undefined, 1),
        line('C', '→E', [2, 4], 1),
        line('B', 'AS', undefined, 1),
        line('C', '→E', [3, 6], 1),
        line('C', '∨E', [1, [4, 5], [6, 7]]),
      ],
      goal: 'C',
    });
    expect(r.errors).toEqual([]);
    expect(r.goalReached).toBe(true);
  });

  it('IP: prueba indirecta clásica', () => {
    const r = verify({
      lines: [
        line('¬A→⊥', 'PR'),
        line('¬A', 'AS', undefined, 1),
        line('⊥', '→E', [1, 2], 1),
        line('A', 'IP', [[2, 3]]),
      ],
      goal: 'A',
    });
    expect(r.errors).toEqual([]);
  });

  it('¬I concluye la negación del supuesto', () => {
    const r = verify({
      lines: [
        line('¬A', 'PR'),
        line('A', 'AS', undefined, 1),
        line('⊥', '¬E', [2, 1], 1),
        line('¬A', '¬I', [[2, 3]]),
      ],
    });
    expect(r.errors).toEqual([]);
  });

  it('X: de ⊥ se sigue cualquier fórmula', () => {
    const r = verify({
      lines: [line('A', 'PR'), line('¬A', 'PR'), line('⊥', '¬E', [1, 2]), line('B∨C', 'X', [3])],
    });
    expect(r.errors).toEqual([]);
  });

  it('DNE elimina exactamente dos negaciones', () => {
    expect(verify({ lines: [line('¬¬A', 'PR'), line('A', 'DNE', [1])] }).errors).toEqual([]);
    expect(codes({ lines: [line('¬¬¬A', 'PR'), line('A', 'DNE', [1])] })).toContain('E-RULE-SHAPE');
  });

  it('subpruebas de una línea y descarga vacua son admisibles', () => {
    const r = verify({
      lines: [line('A', 'PR'), line('B', 'AS', undefined, 1), line('B→B', '→I', [[2, 2]])],
    });
    expect(r.errors).toEqual([]);
  });

  it('acepta alias de regla sin exponerlos en la traza', () => {
    const r = verify({
      lines: [line('A→B', 'PR'), line('A', 'PR'), line('B', 'MP', [1, 2])],
    });
    expect(r.errors).toEqual([]);
  });
});

describe('errores de regla', () => {
  it('E-RULE-UNKNOWN para una regla inexistente', () => {
    expect(codes({ lines: [line('A', 'PR'), line('B', 'Magia', [1])] })).toContain('E-RULE-UNKNOWN');
  });

  it.each(['DS', 'MT', 'DeM', 'LEM', 'TND', 'Taut Con'])(
    'E-RULE-FORBIDDEN para la regla no autorizada %s',
    (rule) => {
      expect(
        codes({ lines: [line('A∨B', 'PR'), line('¬A', 'PR'), line('B', rule, [1, 2])] }),
      ).toContain('E-RULE-FORBIDDEN');
    },
  );

  it('E-RULE-ARITY cuando el número de citas no corresponde', () => {
    expect(codes({ lines: [line('A∧B', 'PR'), line('A', '∧E', [1, 1])] })).toContain('E-RULE-ARITY');
    expect(codes({ lines: [line('A', 'PR'), line('B', 'PR'), line('A∧B', '∧I', [1])] })).toContain(
      'E-RULE-ARITY',
    );
  });

  it('E-RULE-MAINOP cuando el operador principal no corresponde', () => {
    expect(codes({ lines: [line('A∨B', 'PR'), line('A', '∧E', [1])] })).toContain('E-RULE-MAINOP');
    expect(codes({ lines: [line('A', 'PR'), line('B', 'X', [1])] })).toContain('E-RULE-MAINOP');
  });

  it('E-RULE-SHAPE cuando la forma no encaja con la regla', () => {
    expect(codes({ lines: [line('A∧B', 'PR'), line('C', '∧E', [1])] })).toContain('E-RULE-SHAPE');
    expect(codes({ lines: [line('A', 'PR'), line('B', 'R', [1])] })).toContain('E-RULE-SHAPE');
  });
});

describe('alcance, citas y descarga', () => {
  it('E-REF-FORWARD: una cita nunca apunta hacia adelante', () => {
    expect(codes({ lines: [line('A', 'PR'), line('B', 'R', [3]), line('B', 'PR')] })).toContain(
      'E-REF-FORWARD',
    );
  });

  it('E-REF-CLOSED: una línea de subprueba cerrada deja de ser accesible', () => {
    expect(
      codes({
        lines: [
          line('A', 'PR'),
          line('B', 'AS', undefined, 1),
          line('B', 'R', [2], 1),
          line('B→B', '→I', [[2, 3]]),
          line('B', 'R', [3]),
        ],
      }),
    ).toContain('E-REF-CLOSED');
  });

  it('E-REF-SUBPROOF-INCOMPLETE: el rango citado no es una subprueba completa', () => {
    expect(
      codes({
        lines: [
          line('A', 'PR'),
          line('B', 'AS', undefined, 1),
          line('C', 'AS', undefined, 2),
          line('C', 'R', [3], 2),
          line('C→C', '→I', [[3, 4]], 1),
          line('B→(C→C)', '→I', [[2, 4]]),
        ],
      }),
    ).toContain('E-REF-SUBPROOF-INCOMPLETE');
  });

  it('E-REF-SUBPROOF-NESTED-CLOSED: no se cita una subprueba dentro de otra ya cerrada', () => {
    expect(
      codes({
        lines: [
          line('A', 'PR'),
          line('B', 'AS', undefined, 1),
          line('C', 'AS', undefined, 2),
          line('C', 'R', [3], 2),
          line('C→C', '→I', [[3, 4]], 1),
          line('B→(C→C)', '→I', [[2, 5]]),
          line('C→C', '→I', [[3, 4]]),
        ],
      }),
    ).toContain('E-REF-SUBPROOF-NESTED-CLOSED');
  });

  it('E-STRUCT-AS-POSITION: AS solo abre subprueba', () => {
    expect(codes({ lines: [line('A', 'PR'), line('B', 'AS')] })).toContain('E-STRUCT-AS-POSITION');
  });

  it('E-STRUCT-PR-POSITION: PR solo en el bloque de premisas de nivel 0', () => {
    expect(codes({ lines: [line('A', 'PR'), line('A', 'R', [1]), line('B', 'PR')] })).toContain(
      'E-STRUCT-PR-POSITION',
    );
    expect(codes({ lines: [line('A', 'PR'), line('B', 'PR', undefined, 1)] })).toContain(
      'E-STRUCT-PR-POSITION',
    );
  });

  it('E-STRUCT-OPEN-ASSUMPTION y E-STRUCT-CONCLUSION-DEPTH al terminar dentro de una subprueba', () => {
    const found = codes({
      lines: [line('A', 'PR'), line('B', 'AS', undefined, 1), line('B', 'R', [2], 1)],
    });
    expect(found).toContain('E-STRUCT-OPEN-ASSUMPTION');
    expect(found).toContain('E-STRUCT-CONCLUSION-DEPTH');
  });

  it('⊥ no puede ser premisa ni supuesto inicial (política de Etapa 1)', () => {
    expect(codes({ lines: [line('⊥', 'PR'), line('A', 'X', [1])] })).toContain(
      'E-STRUCT-PR-POSITION',
    );
    expect(
      codes({ lines: [line('A', 'PR'), line('⊥', 'AS', undefined, 1), line('A', 'R', [1], 1)] }),
    ).toContain('E-STRUCT-AS-POSITION');
  });
});

describe('oráculo semántico independiente (asimetría literal)', () => {
  it('marca semanticCheck=passed cuando cada paso se sigue de sus supuestos', () => {
    expect(verify({ lines: [line('A∧B', 'PR'), line('B', '∧E', [1])] }).semanticCheck).toBe(
      'passed',
    );
  });

  it('un éxito semántico no certifica derivabilidad: valid depende de las reglas', () => {
    // `A∨¬A` es una verdad lógica, pero sin regla que la introduzca no hay derivación.
    const r = verify({ lines: [line('A', 'PR'), line('A∨¬A', 'LEM', [1])] });
    expect(r.valid).toBe(false);
    expect(r.errors.map((e) => e.code)).toContain('E-RULE-FORBIDDEN');
  });

  it('la meta no alcanzada no invalida una derivación bien formada', () => {
    const r = verify({ lines: [line('A∧B', 'PR'), line('A', '∧E', [1])], goal: 'B' });
    expect(r.valid).toBe(true);
    expect(r.goalReached).toBe(false);
  });
});

describe('determinismo y traza', () => {
  it('mismas entradas ⇒ mismo resultado', () => {
    const proof: ProofInput = {
      lines: [line('A∧B', 'PR'), line('B', '∧E', [1])],
      goal: 'B',
    };
    expect(JSON.stringify(verify(proof))).toBe(JSON.stringify(verify(proof)));
  });

  it('firstInvalidStep apunta a la primera línea con error', () => {
    const r = verify({
      lines: [line('A∧B', 'PR'), line('C', '∧E', [1]), line('D', '∧E', [1])],
    });
    expect(r.firstInvalidStep).toBe(2);
  });

  it('la traza registra el rule_id canónico, nunca el alias escrito', () => {
    const r = verify({ lines: [line('A→B', 'PR'), line('A', 'PR'), line('C', 'MP', [1, 2])] });
    const ruleIds = r.errors.map((e) => e.ruleId);
    expect(ruleIds).toContain('→E');
    expect(ruleIds).not.toContain('MP');
  });

  it('declara la versión del cálculo y del verificador', () => {
    const r = verify({ lines: [line('A', 'PR')] });
    expect(r.authorizedCalculusVersion).toBe('authorized-calculus-v1');
    expect(r.verifierVersion).toBeTruthy();
  });
});

/**
 * El contrato de las citas no es solo el código de error: `references` dice
 * **cuál** cita ofende, y es lo que el motor le muestra al alumno. Sin afirmarlo,
 * un verificador que perdiera esa información seguiría pareciendo correcto.
 */
describe('las citas rechazadas nombran la referencia ofensora', () => {
  it('cita hacia adelante a una línea', () => {
    const r = verify({
      lines: [line('A∧B', 'PR'), line('A', '∧E', [3]), line('B', '∧E', [1])],
    });
    const e = r.errors.find((x) => x.code === 'E-REF-FORWARD');
    expect(e?.references).toEqual(['3']);
  });

  it('un rango que termina en la propia línea todavía no es una subprueba cerrada', () => {
    const r = verify({
      lines: [
        line('A', 'PR'),
        line('B', 'AS', undefined, 1),
        line('B', 'R', [2], 1),
        line('B→B', '→I', [[2, 4]]),
      ],
    });
    const e = r.errors.find((x) => x.code === 'E-REF-FORWARD');
    expect(e?.references).toEqual(['2-4']);
  });

  it('un rango que empieza después de la línea que lo cita', () => {
    const r = verify({
      lines: [
        line('A', 'PR'),
        line('B', 'AS', undefined, 1),
        line('B', 'R', [2], 1),
        line('B→B', '→I', [[5, 2]]),
      ],
    });
    const e = r.errors.find((x) => x.code === 'E-REF-FORWARD');
    expect(e?.references).toEqual(['5-2']);
  });

  it('un rango que no corresponde a ninguna subprueba completa', () => {
    const r = verify({
      lines: [
        line('A', 'PR'),
        line('B', 'AS', undefined, 1),
        line('B', 'R', [2], 1),
        line('B→B', '→I', [[2, 2]]),
      ],
    });
    const e = r.errors.find((x) => x.code === 'E-REF-SUBPROOF-INCOMPLETE');
    expect(e?.references).toEqual(['2-2']);
  });

  it('una subprueba encerrada en otra ya cerrada', () => {
    const r = verify({
      lines: [
        line('A', 'PR'),
        line('B', 'AS', undefined, 1),
        line('C', 'AS', undefined, 2),
        line('C', 'R', [3], 2),
        line('C→C', '→I', [[3, 4]], 1),
        line('B→(C→C)', '→I', [[2, 5]]),
        line('C→C', '→I', [[3, 4]]),
      ],
    });
    const e = r.errors.find((x) => x.code === 'E-REF-SUBPROOF-NESTED-CLOSED');
    expect(e?.references).toEqual(['3-4']);
  });

  it('una línea dentro de una subprueba ya cerrada', () => {
    const r = verify({
      lines: [
        line('A', 'PR'),
        line('B', 'AS', undefined, 1),
        line('B', 'R', [2], 1),
        line('B→B', '→I', [[2, 3]]),
        line('B', 'R', [3]),
      ],
    });
    const e = r.errors.find((x) => x.code === 'E-REF-CLOSED');
    expect(e?.references).toEqual(['3']);
  });

  it('una cita a una línea que no existe, por debajo o por encima del rango', () => {
    const cero = verify({ lines: [line('A∧B', 'PR'), line('A', '∧E', [0])] });
    expect(cero.errors[0]?.code).toBe('E-SYN-PARSE');
    expect(cero.errors[0]?.references).toEqual(['0']);

    const alta = verify({ lines: [line('A∧B', 'PR'), line('A', '∧E', [99])] });
    expect(alta.errors[0]?.references).toEqual(['99']);
  });
});

describe('forma del resultado', () => {
  it('una derivación vacía se rechaza sin firstInvalidStep: el error no tiene línea', () => {
    const r = verify({ lines: [] });
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveLength(1);
    expect(r.firstInvalidStep).toBeUndefined();
    expect(r.semanticCheck).toBe('not-applicable');
    expect(r.semanticCheckReason).toBeDefined();
  });

  it('una derivación correcta no arrastra razón de semántica no aplicable', () => {
    const r = verify({ lines: [line('A∧B', 'PR'), line('A', '∧E', [1])], goal: 'A' });
    expect(r.semanticCheck).toBe('passed');
    expect('semanticCheckReason' in r).toBe(false);
  });

  it('sin meta declarada no se afirma nada sobre la meta', () => {
    const r = verify({ lines: [line('A∧B', 'PR'), line('A', '∧E', [1])] });
    expect('goalReached' in r).toBe(false);
  });

  it('la meta alcanzada dentro de una subprueba abierta no está alcanzada', () => {
    const r = verify({ lines: [line('A', 'PR'), line('B', 'AS', undefined, 1)], goal: 'B' });
    expect(r.goalReached).toBe(false);
    expect(r.valid).toBe(false);
  });

  it('una meta que no parsea no se da por alcanzada', () => {
    const r = verify({ lines: [line('A∧B', 'PR'), line('A', '∧E', [1])], goal: 'A∧' });
    expect(r.goalReached).toBe(false);
  });
});

describe('normalización de entrada y corte por sintaxis', () => {
  it('el rule_id se acepta con espacios alrededor', () => {
    const r = verify({ lines: [line('A∧B', 'PR'), line('A', '  ∧E  ', [1])], goal: 'A' });
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it('una regla que exige citas y no las trae falla por aridad, no por cita inexistente', () => {
    expect(codes({ lines: [line('A∧B', 'PR'), line('A', '∧E')] })).toEqual(['E-RULE-ARITY']);
  });

  it('un error de sintaxis corta el análisis y se reporta en su propia línea', () => {
    const r = verify({
      lines: [line('A∧B', 'PR'), line('A∧', '∧E', [1]), line('B', '∧E', [1])],
    });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]?.code).toBe('E-SYN-PARSE');
    expect(r.errors[0]?.line).toBe(2);
    expect(r.firstInvalidStep).toBe(2);
    expect(r.semanticCheck).toBe('not-applicable');
  });
});

describe('printProof: la traza que leen los humanos', () => {
  it('numera desde 1, indenta por profundidad y lista las citas', () => {
    const salida = printProof({
      lines: [
        line('A∧B', 'PR'),
        line('A∧B', 'AS', undefined, 1),
        line('A', '∧E', [2], 1),
        line('(A∧B)→A', '→I', [[2, 3]]),
      ],
    }).split('\n');

    expect(salida[0]).toBe('1. A∧B   PR');
    expect(salida[1]).toBe('2. | A∧B   AS');
    expect(salida[2]).toBe('3. | A   ∧E 2');
    expect(salida[3]).toBe('4. (A∧B)→A   →I 2-3');
  });

  it('reimprime en forma canónica y separa varias citas con coma', () => {
    const salida = printProof({
      lines: [line('(A→B)', 'PR'), line('A', 'PR'), line('B', '→E', [1, 2])],
    }).split('\n');

    expect(salida[0]).toBe('1. A→B   PR');
    expect(salida[2]).toBe('3. B   →E 1, 2');
  });

  it('deja intacta la línea que no parsea, en vez de ocultarla', () => {
    expect(printProof({ lines: [line('A∧', 'PR')] })).toBe('1. A∧   PR');
  });
});

/**
 * El oráculo semántico independiente (P-I §9.2) es una **segunda capa**: la
 * regla ya se aplicó bien y aun así el paso se comprueba contra la semántica.
 *
 * Parecía inalcanzable —toda regla autorizada es sana, así que un paso
 * correctamente aplicado no puede tener contramodelo— pero no lo es: cuando una
 * línea anterior quedó **rechazada** y otra posterior la cita, la regla puede
 * aplicarse impecablemente sobre una premisa que el cálculo nunca autorizó. Ahí
 * es donde el oráculo gana su sitio, y esto lo demuestra.
 */
describe('el oráculo semántico como segunda capa', () => {
  it('detecta un paso bien aplicado sobre una línea previamente rechazada', () => {
    const r = verify({
      lines: [
        line('A', 'PR'),
        // Rechazada: `A` no es una conjunción.
        line('B', '∧E', [1]),
        // ∧I se aplica **correctamente** sobre la línea 2… que no debió existir.
        line('B∧B', '∧I', [2, 2]),
      ],
    });

    const codigos = r.errors.map((e) => e.code);
    expect(codigos).toContain('E-RULE-MAINOP');
    expect(codigos).toContain('E-SEM-UNSOUND-STEP');
    expect(r.semanticCheck).toBe('failed');

    const semantico = r.errors.find((e) => e.code === 'E-SEM-UNSOUND-STEP');
    expect(semantico?.line).toBe(3);
    // La traza incluye el contramodelo: sin él, «no se sigue» no es revisable.
    expect(semantico?.detail).toMatch(/contramodelo/);
  });

  it('registra un solo fallo semántico aunque haya varios pasos afectados', () => {
    const r = verify({
      lines: [
        line('A', 'PR'),
        line('B', '∧E', [1]),
        line('B∧B', '∧I', [2, 2]),
        line('B∨C', '∨I', [2]),
      ],
    });
    expect(r.errors.filter((e) => e.code === 'E-SEM-UNSOUND-STEP')).toHaveLength(1);
  });
});

describe('la cota de la tabla de verdad (CALC-05)', () => {
  it('por encima de la cota el oráculo se declara no aplicable, con razón', () => {
    // 17 átomos distintos: una fila más que `MAX_ATOMS_FOR_TRUTH_TABLE`.
    const atomos = 'ABCDEFGHIJKLMNOPQ'.split('');
    const conjuncion = atomos.reduce((acc, a) => (acc === '' ? a : `(${acc})∧${a}`), '');
    // `∧E` sobre el miembro derecho, que es el último átomo: la derivación tiene
    // que ser **válida** para que el oráculo llegue a evaluarla.
    const ultimo = atomos[atomos.length - 1] as string;

    const r = verify({ lines: [line(conjuncion, 'PR'), line(ultimo, '∧E', [1])] });

    expect(r.semanticCheck).toBe('not-applicable');
    expect(r.semanticCheckReason).toMatch(/atom_count_exceeds_table_bound/);
    // No aplicable **no** es un fallo: la derivación sigue siendo válida.
    expect(r.valid).toBe(true);
  });
});
