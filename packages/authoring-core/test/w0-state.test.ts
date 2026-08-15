import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  assertW0Transition,
  isTerminalW0State,
  isW0State,
  MissingRejectionReasonError,
  W0_INITIAL_STATE,
  W0_STATES,
  W0_TRANSITIONS,
  W0Machine,
  W0TransitionError,
  type W0State,
} from '../src/index.js';

/** Camino feliz literal de Plan.md T-H45-01. */
const CAMINO_PRINCIPAL: readonly W0State[] = [
  'alcance_acotado',
  'fuentes_descubiertas',
  'fuentes_evaluadas',
  'fuentes_comparadas',
  'licencias_clasificadas',
  'cobertura_evaluada',
  'propuesta_corpus',
  'corpus_autorizado',
  'W1_ingesta',
];

describe('estados de W0 (T-H45-01 ← P-I §7.0)', () => {
  it('son los trece literales y arranca en solicitud_curso', () => {
    expect(W0_STATES).toHaveLength(13);
    expect(W0_INITIAL_STATE).toBe('solicitud_curso');
    expect(isW0State('solicitud_curso')).toBe(true);
    expect(isW0State('estado_inventado')).toBe(false);
  });

  it('coinciden con el CHECK de `operations.w0_state`, sin derivar', () => {
    // Si el código y la migración se separan, uno de los dos miente.
    const sql = readFileSync('infra/database/migrations/20260814100200_tables.sql', 'utf8');
    const bloque = sql.slice(sql.indexOf('CREATE TABLE operations.w0_state'));
    const check = bloque.slice(0, bloque.indexOf(')'));

    for (const estado of W0_STATES) {
      expect(check).toContain(`'${estado}'`);
    }
  });

  it('los terminales son el cierre bueno y el cierre en fallo', () => {
    expect(isTerminalW0State('W1_ingesta')).toBe(true);
    expect(isTerminalW0State('failed_no_authorizable_corpus')).toBe(true);
    expect(isTerminalW0State('propuesta_corpus')).toBe(false);
    expect(W0_TRANSITIONS['W1_ingesta']).toEqual([]);
    expect(W0_TRANSITIONS['failed_no_authorizable_corpus']).toEqual([]);
  });
});

describe('el flujo principal es el literal', () => {
  it('recorre solicitud_curso → … → W1_ingesta', () => {
    const m = new W0Machine();
    for (const destino of CAMINO_PRINCIPAL) {
      expect(m.transition(destino)).toBe(destino);
    }
    expect(m.state()).toBe('W1_ingesta');
    expect(m.history()).toHaveLength(CAMINO_PRINCIPAL.length);
  });

  it('no se puede saltar una etapa', () => {
    const m = new W0Machine();

    // El CHECK de la base aceptaría este salto; la máquina no.
    expect(() => m.transition('corpus_autorizado')).toThrow(W0TransitionError);
    expect(() => m.transition('propuesta_corpus')).toThrow(W0TransitionError);
    expect(m.state()).toBe('solicitud_curso');
  });

  it('un estado terminal no transita a ningún sitio', () => {
    const m = new W0Machine('W1_ingesta');

    for (const estado of W0_STATES) {
      expect(() => m.transition(estado)).toThrow(W0TransitionError);
    }
  });

  it('no hay comodín: todo destino no declarado falla', () => {
    for (const origen of W0_STATES) {
      const permitidos = W0_TRANSITIONS[origen];
      for (const destino of W0_STATES) {
        if (permitidos.includes(destino)) continue;
        expect(() => assertW0Transition(origen, destino, { rejectionReasonCode: 'x' })).toThrow(
          W0TransitionError,
        );
      }
    }
  });
});

describe('ciclo de rechazo, literal del Maestro', () => {
  function hastaPropuesta() {
    const m = new W0Machine();
    for (const destino of CAMINO_PRINCIPAL.slice(0, 7)) m.transition(destino);
    return m;
  }

  it('corpus_rechazado → W0_reinvestigacion → propuesta_corpus', () => {
    const m = hastaPropuesta();
    expect(m.state()).toBe('propuesta_corpus');

    m.transition('corpus_rechazado', { rejectionReasonCode: 'alcance' });
    m.transition('W0_reinvestigacion');
    m.transition('propuesta_corpus');

    expect(m.state()).toBe('propuesta_corpus');
  });

  it('un rechazo sin código de causa no se registra', () => {
    const m = hastaPropuesta();

    expect(() => m.transition('corpus_rechazado')).toThrow(MissingRejectionReasonError);
    expect(() => m.transition('corpus_rechazado', { rejectionReasonCode: '' })).toThrow(
      MissingRejectionReasonError,
    );
    expect(m.state()).toBe('propuesta_corpus');
  });

  it('el código de causa queda en el historial', () => {
    const m = hastaPropuesta();
    m.transition('corpus_rechazado', { rejectionReasonCode: 'legalidad' });

    expect(m.history().at(-1)).toEqual({
      from: 'propuesta_corpus',
      to: 'corpus_rechazado',
      rejectionReasonCode: 'legalidad',
    });
  });

  it('la reinvestigación no vuelve a descubrir fuentes: vuelve a la propuesta', () => {
    // El Maestro fija el ciclo literal `corpus_rechazado → W0_reinvestigacion →
    // propuesta_corpus`. Volver a `fuentes_descubiertas` sería una rama inventada.
    expect(W0_TRANSITIONS['W0_reinvestigacion']).not.toContain('fuentes_descubiertas');
    expect(W0_TRANSITIONS['W0_reinvestigacion']).toContain('propuesta_corpus');
  });
});

describe('cierre en fallo por saturación (§12, paso 12)', () => {
  it('se puede cerrar en fallo tras medir cobertura', () => {
    const m = new W0Machine();
    for (const destino of CAMINO_PRINCIPAL.slice(0, 6)) m.transition(destino);
    expect(m.state()).toBe('cobertura_evaluada');

    m.transition('failed_no_authorizable_corpus');
    expect(m.state()).toBe('failed_no_authorizable_corpus');
  });

  it('y también tras una reinvestigación agotada', () => {
    const m = new W0Machine('W0_reinvestigacion');

    expect(() => m.transition('failed_no_authorizable_corpus')).not.toThrow();
  });

  it('el fallo no se puede disfrazar de avance', () => {
    const m = new W0Machine('failed_no_authorizable_corpus');

    expect(() => m.transition('propuesta_corpus')).toThrow(W0TransitionError);
    expect(() => m.transition('W1_ingesta')).toThrow(W0TransitionError);
  });
});
