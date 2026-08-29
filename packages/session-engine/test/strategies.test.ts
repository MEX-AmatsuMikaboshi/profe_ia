import { describe, expect, it } from 'vitest';

import { PedagogicalStrategy } from '@profesor-ia/contracts';

import {
  declaredStrategies,
  sessionOperations,
  strategyExecution,
  StrategyExecutionError,
} from '../src/strategies.js';

/**
 * Pruebas de la ejecución lingüística de estrategias (T-H7-04).
 *
 * La que más rinde es la primera: contrasta las declaraciones contra el **enum
 * del contrato**, no contra una lista escrita a mano. Una lista a mano se
 * quedaría vieja en silencio el día que P-II §7.2.1 añada una estrategia, y el
 * fallo aparecería en producción como «la política eligió algo que el turno no
 * sabe ejecutar».
 */

describe('estrategias — la cobertura se comprueba contra el enum, no contra una lista', () => {
  it('las diez estrategias del contrato tienen ejecución declarada', () => {
    const delContrato = [...PedagogicalStrategy.options].sort();
    const declaradas = [...declaredStrategies()].sort();
    expect(declaradas).toStrictEqual(delContrato);
  });

  it('cada estrategia declara operación y directiva no vacías', () => {
    for (const strategy of PedagogicalStrategy.options) {
      const ejecucion = strategyExecution(strategy);
      expect(ejecucion.strategy).toBe(strategy);
      expect(ejecucion.operation.length).toBeGreaterThan(0);
      expect(ejecucion.directive.length).toBeGreaterThan(40);
    }
  });

  it('una estrategia desconocida lanza en vez de caer a explicación directa', () => {
    // Una caída silenciosa daría al alumno una explicación donde la política
    // pidió recuperación, y el registro diría que se ejecutó lo elegido.
    expect(() => strategyExecution('inventada' as never)).toThrow(StrategyExecutionError);
  });
});

describe('estrategias — la operación es la unidad que la pasarela autoriza', () => {
  it('el ejemplo trabajado y el problema de completar no van por explain_block', () => {
    // Mandarlos por `explain_block` pasaría por la puerta equivocada y haría
    // inútil la autorización por operación del binding (T-H4-01).
    expect(strategyExecution('worked_example').operation).toBe('draft_worked_example');
    expect(strategyExecution('completion_problem').operation).toBe('draft_completion_prompt');
    expect(strategyExecution('self_explanation').operation).toBe('draft_self_explanation_prompt');
  });

  it('las operaciones de sesión incluyen las dos de clasificación', () => {
    // No salen de ninguna estrategia: las usa el motor para encuadrar la duda y
    // el error del alumno dentro de sus enums.
    const ops = sessionOperations();
    expect(ops).toContain('classify_student_error');
    expect(ops).toContain('classify_question_scope');
  });

  it('la reformulación está autorizada: si no, una segunda pasada degradaría', async () => {
    // `rephrase_explanation` no sale de `EJECUCIONES`, la produce
    // `rephrasedExecution()`. Faltaba en la lista y la pasarela la rechazaba:
    // el turno caía a modo degradado y una segunda pasada sana se registraba
    // como caída de proveedor. Lo destapó `ci:e2e:live-session`; ninguna prueba
    // con puerto inyectado podía verlo, porque el puerto falso no comprueba
    // autorizaciones.
    expect(sessionOperations()).toContain('rephrase_explanation');
  });

  it('toda operación usada está en el enum cerrado del contrato', async () => {
    const { ModelOperation } = await import('@profesor-ia/contracts');
    for (const op of sessionOperations()) {
      expect(ModelOperation.options).toContain(op);
    }
  });
});

describe('estrategias — las directivas dicen qué NO hacer', () => {
  it('práctica independiente prohíbe adelantar el primer paso', () => {
    // Sin esa línea, «invita a intentarlo» deriva sola en práctica guiada, que
    // es otra estrategia que la política no eligió.
    expect(strategyExecution('independent_practice').directive).toMatch(/no adelantes/iu);
  });

  it('recuperación prohíbe incluir la respuesta', () => {
    expect(strategyExecution('retrieval').directive).toMatch(/no incluyas la respuesta/iu);
  });

  it('el ejemplo trabajado prohíbe usar el ejercicio en curso', () => {
    // Es la frontera con P-I §9.6: un «ejemplo» con las fórmulas del ejercicio
    // abierto es su solución con otra ropa.
    expect(strategyExecution('worked_example').directive).toMatch(/ejercicio en curso/iu);
  });

  it('autoexplicación prohíbe que el profesor conteste su propia pregunta', () => {
    expect(strategyExecution('self_explanation').directive).toMatch(/no respondas tú/iu);
  });
});
