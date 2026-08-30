import { describe, expect, it } from 'vitest';

import {
  COURSE_TYPES,
  type CourseError,
  PREPARATION_STATES,
  assertEnvelopeComplete,
  assertTeachable,
  createCourse,
  initialProgress,
  isTeachable,
  recordProgress,
  updateCourse,
  type Course,
} from '../src/courses.js';

const personalizada = (): Course =>
  createCourse({
    courseId: 'c-historia',
    courseType: 'CUSTOM_COURSE_UNVALIDATED',
    title: 'Historia de la imprenta',
    envelope: { subject: 'Historia de la imprenta', level: 'principiante' },
  });

const logica = (): Course =>
  createCourse({
    courseId: 'c-logica',
    courseType: 'VALIDATED_LOGIC_COURSE',
    title: 'Deducción natural',
  });

describe('los dos carriles', () => {
  it('son exactamente los de P-I §3.1.2', () => {
    expect([...COURSE_TYPES]).toStrictEqual(['VALIDATED_LOGIC_COURSE', 'CUSTOM_COURSE_UNVALIDATED']);
  });

  it('no hay campo que ordene un carril por encima del otro', () => {
    // La norma pide mostrarlos «sin presentar el modo personalizado como
    // defectuoso». Un `isValidated: boolean` los ordenaría de peor a mejor.
    const claves = Object.keys(personalizada());
    expect(claves).not.toContain('isValidated');
    expect(claves).not.toContain('quality');
  });

  it('el curso de lógica nace creado y la personalizada en borrador', () => {
    expect(logica().preparation).toBe('created');
    expect(personalizada().preparation).toBe('draft');
  });
});

describe('el tipo de curso es inmutable', () => {
  it('una materia personalizada no puede promoverse a validada', () => {
    // Es la única forma en que este carril contamina el experimento, y no
    // dejaría rastro visible.
    expect(() =>
      updateCourse(personalizada(), { courseType: 'VALIDATED_LOGIC_COURSE' }),
    ).toThrowError(/sin corpus autorizado ni freeze/u);
    try {
      updateCourse(personalizada(), { courseType: 'VALIDATED_LOGIC_COURSE' });
    } catch (e) {
      expect((e as CourseError).code).toBe('TIPO_INMUTABLE');
    }
  });

  it('y el curso de lógica tampoco puede degradarse', () => {
    expect(() =>
      updateCourse(logica(), { courseType: 'CUSTOM_COURSE_UNVALIDATED' }),
    ).toThrowError(/no se distingue de una/u);
  });

  it('declarar el mismo tipo no es un cambio', () => {
    expect(() =>
      updateCourse(personalizada(), { courseType: 'CUSTOM_COURSE_UNVALIDATED' }),
    ).not.toThrow();
  });
});

describe('preparación observable', () => {
  it('los seis estados son los declarados', () => {
    expect([...PREPARATION_STATES]).toStrictEqual([
      'draft',
      'envelope_ready',
      'researching',
      'proposal_ready',
      'created',
      'failed',
    ]);
  });

  it('el recorrido completo de UIUX §5.2 llega a enseñable', () => {
    let c = personalizada();
    for (const paso of ['envelope_ready', 'researching', 'proposal_ready', 'created'] as const) {
      c = updateCourse(c, { preparation: paso });
    }
    expect(isTeachable(c)).toBe(true);
    expect(() => assertTeachable(c)).not.toThrow();
  });

  it('un fallo es estado, no excepción, y se puede reintentar', () => {
    // La norma pide reintentos autorizados: un fallo que sólo existe como
    // excepción no se puede mostrar en pantalla ni reintentar.
    let c = updateCourse(updateCourse(personalizada(), { preparation: 'envelope_ready' }), {
      preparation: 'researching',
    });
    c = updateCourse(c, { preparation: 'failed' });
    expect(c.preparation).toBe('failed');
    expect(updateCourse(c, { preparation: 'researching' }).preparation).toBe('researching');
  });

  it('rechazar la propuesta vuelve a investigar, no a cero', () => {
    let c = updateCourse(updateCourse(personalizada(), { preparation: 'envelope_ready' }), {
      preparation: 'researching',
    });
    c = updateCourse(c, { preparation: 'proposal_ready' });
    expect(updateCourse(c, { preparation: 'researching' }).preparation).toBe('researching');
    // Volver a pedir el sobre castigaría al usuario por no aceptar.
    expect(() => updateCourse(c, { preparation: 'draft' })).toThrowError(/no puede pasar/u);
  });

  it('no se salta etapas', () => {
    expect(() => updateCourse(personalizada(), { preparation: 'created' })).toThrowError(
      /no puede pasar de «draft» a «created»/u,
    );
  });

  it('creado es terminal', () => {
    expect(() => updateCourse(logica(), { preparation: 'researching' })).toThrowError(
      /es terminal/u,
    );
  });

  it('entrar a una materia sin preparar lanza', () => {
    // Mostraría una clase con huecos que el alumno leería como defecto del
    // Profesor IA.
    expect(() => assertTeachable(personalizada())).toThrowError(/huecos/u);
  });
});

describe('sobre mínimo', () => {
  it('la materia es lo único obligatorio', () => {
    expect(() => assertEnvelopeComplete({ subject: 'Termodinámica' })).not.toThrow();
  });

  it('los otros cinco campos son opcionales y no se rellenan solos', () => {
    // Inventar un nivel o un objetivo sería inventar el perfil de quien estudia.
    const c = createCourse({
      courseId: 'c-t',
      courseType: 'CUSTOM_COURSE_UNVALIDATED',
      title: 'Termodinámica',
      envelope: { subject: 'Termodinámica' },
    });
    expect(c.envelope).toStrictEqual({ subject: 'Termodinámica' });
  });

  it('un sobre sin materia no describe nada que investigar', () => {
    expect(() => assertEnvelopeComplete({ subject: '   ' })).toThrowError(/al menos la materia/u);
  });
});

describe('continuidad entre sesiones (OWNER-CONTINUITY-001)', () => {
  it('sin avance, `null` dice «no hay dónde volver»', () => {
    const p = initialProgress('c-historia', 1000);
    expect(p.resumePoint).toBeNull();
    // Distinto de ausente, que diría «no se registró».
    expect(Object.hasOwn(p, 'resumePoint')).toBe(true);
  });

  it('el punto de retorno se registra y avanza', () => {
    const p = recordProgress(initialProgress('c-historia', 1000), {
      courseId: 'c-historia',
      sessionId: 's-1',
      resumePoint: 'kc-03/actividad-2',
      atMs: 2000,
    });
    expect(p.resumePoint).toBe('kc-03/actividad-2');
    expect(p.lastSessionId).toBe('s-1');
    expect(p.updatedAtMs).toBe(2000);
  });

  it('no se puede cruzar el progreso de dos materias', () => {
    // Mandaría al alumno al punto de retorno de otra asignatura, y en pantalla
    // parecería un fallo de navegación.
    expect(() =>
      recordProgress(initialProgress('c-historia', 1000), {
        courseId: 'c-logica',
        sessionId: 's-9',
        resumePoint: 'kc-01',
        atMs: 2000,
      }),
    ).toThrowError(/otra asignatura/u);
  });
});
