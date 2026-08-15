import { describe, expect, it } from 'vitest';
import { verify } from '../src/verify.js';
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
