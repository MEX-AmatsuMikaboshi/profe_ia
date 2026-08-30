import { describe, expect, it } from 'vitest';

import {
  PREPARATION_ARTIFACTS,
  PREPARATION_MESSAGES,
  backgroundPromise,
  beginPreparation,
  isRetryable,
  messageText,
  preparationView,
} from '../src/course-creation.js';
import { createCourse, updateCourse, type Course } from '../src/courses.js';

const nueva = (): Course =>
  createCourse({
    courseId: 'c-imprenta',
    courseType: 'CUSTOM_COURSE_UNVALIDATED',
    title: 'Historia de la imprenta',
  });

describe('el flujo de UIUX §5.2', () => {
  it('el sobre arranca la investigación', () => {
    const c = beginPreparation(nueva(), { subject: 'Historia de la imprenta' });
    expect(c.preparation).toBe('researching');
    expect(c.envelope?.subject).toBe('Historia de la imprenta');
  });

  it('un sobre vacío no gasta llamadas al proveedor', () => {
    // Se valida antes de mover el estado: investigar con un sobre vacío
    // produciría una propuesta sobre nada.
    expect(() => beginPreparation(nueva(), { subject: '' })).toThrowError(/al menos la materia/u);
    // Y el curso no se movió.
    expect(nueva().preparation).toBe('draft');
  });
});

describe('la preparación es observable, no una rueda girando', () => {
  it('la vista trae estado, artefactos y el último mensaje', () => {
    // Una rueda no distingue «investigando» de «lleva cuatro minutos parada» ni
    // de «falló y nadie lo dijo». Las tres se ven igual.
    const c = beginPreparation(nueva(), { subject: 'Historia de la imprenta' });
    const v = preparationView({
      course: c,
      artifacts: [{ kind: 'sources_found', ref: 'a-1' }],
      lastMessage: 'researching_sources',
    });
    expect(v.state).toBe('researching');
    expect(v.artifacts).toHaveLength(1);
    expect(v.lastMessageText).toBe('Buscando y comparando fuentes para esta materia.');
  });

  it('los artefactos y los mensajes son listas cerradas', () => {
    expect([...PREPARATION_ARTIFACTS]).toStrictEqual(['sources_found', 'course_proposal']);
    // Un `message: string` suelto produce diez maneras de decir lo mismo.
    for (const m of PREPARATION_MESSAGES) {
      expect(messageText(m).length).toBeGreaterThan(10);
    }
  });

  it('los mensajes están en castellano y no son códigos', () => {
    expect(messageText('no_sources_found')).toContain('No encontré fuentes');
  });
});

describe('errores y reintentos autorizados', () => {
  it('el proveedor caído se reintenta', () => {
    expect(isRetryable('provider_unavailable')).toBe(true);
  });

  it('«no hay fuentes» NO se reintenta con el mismo sobre', () => {
    // Reintentar repetiría la misma búsqueda y el mismo vacío, y el usuario
    // concluiría que el sistema está roto cuando falta información suya.
    expect(isRetryable('no_sources_found')).toBe(false);
  });

  it('la vista sólo ofrece reintentar cuando el fallo lo admite', () => {
    const fallado = updateCourse(
      beginPreparation(nueva(), { subject: 'Historia de la imprenta' }),
      { preparation: 'failed' },
    );
    expect(
      preparationView({ course: fallado, artifacts: [], lastMessage: 'provider_unavailable' })
        .retryable,
    ).toBe(true);
    expect(
      preparationView({ course: fallado, artifacts: [], lastMessage: 'no_sources_found' }).retryable,
    ).toBe(false);
  });

  it('y no ofrece reintentar lo que no ha fallado', () => {
    const investigando = beginPreparation(nueva(), { subject: 'Historia de la imprenta' });
    expect(
      preparationView({ course: investigando, artifacts: [], lastMessage: 'researching_sources' })
        .retryable,
    ).toBe(false);
  });
});

describe('PLAN-UX-001 — lo que se promete del segundo plano', () => {
  it('promete que sigue con la pestaña cerrada', () => {
    expect(backgroundPromise()).toContain('aunque cierres esta pestaña');
  });

  it('y NO promete ejecución con el ordenador apagado', () => {
    // Una promesa de más se paga con el usuario volviendo al día siguiente a una
    // materia que no avanzó.
    const texto = backgroundPromise().toLowerCase();
    expect(texto).toContain('si apagas el ordenador');
    expect(texto).not.toMatch(/siempre|24|continuamente|en la nube/u);
  });

  it('la vista la lleva, así que ninguna pantalla puede olvidarla', () => {
    const v = preparationView({
      course: beginPreparation(nueva(), { subject: 'X' }),
      artifacts: [],
      lastMessage: 'researching_sources',
    });
    expect(v.backgroundPromise).toBe(backgroundPromise());
  });
});
