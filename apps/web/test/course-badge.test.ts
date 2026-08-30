import { describe, expect, it } from 'vitest';

import {
  type CourseLabelError,
  TERMINOS_QUE_AFIRMAN_VALIDACION,
  TERMINOS_QUE_DEGRADAN,
  courseBadge,
  courseStatusPanel,
} from '../src/clase/course-badge.js';

describe('la etiqueta no afirma validación que no existe', () => {
  it('la materia propia no lleva ninguna palabra que la afirme', () => {
    // El día que alguien reescriba el copy «para que suene mejor» es cuando
    // entra «verificado».
    const b = courseBadge('CUSTOM_COURSE_UNVALIDATED');
    const texto = `${b.label} ${b.explanation}`.toLowerCase();
    for (const termino of TERMINOS_QUE_AFIRMAN_VALIDACION) {
      // `validada` aparece sólo negada («no está validada»), que es lo contrario
      // de afirmarlo.
      const afirma = texto.includes(termino) && !texto.includes(`no está ${termino}`);
      expect(afirma, `«${termino}» afirmando validación en la materia propia`).toBe(false);
    }
  });

  it('y dice explícitamente que no cuenta como resultado experimental', () => {
    expect(courseBadge('CUSTOM_COURSE_UNVALIDATED').explanation).toContain(
      'no cuenta como resultado experimental',
    );
  });

  it('el curso de lógica nombra qué es, no que haya salido bien', () => {
    const b = courseBadge('VALIDATED_LOGIC_COURSE');
    expect(b.explanation).not.toMatch(/funciona|eficaz|demostrad/u);
  });
});

describe('la etiqueta tampoco la presenta como defectuosa', () => {
  it('ninguna palabra la degrada', () => {
    // La mitad del error que se olvida: un aviso amarillo junto a cada materia
    // del usuario dice que el sistema desconfía de lo que él pidió aprender.
    const b = courseBadge('CUSTOM_COURSE_UNVALIDATED');
    const texto = `${b.label} ${b.explanation}`.toLowerCase();
    for (const termino of TERMINOS_QUE_DEGRADAN) {
      expect(texto, `«${termino}» degradando la materia propia`).not.toContain(termino);
    }
  });

  it('empieza por lo que sí hace', () => {
    expect(courseBadge('CUSTOM_COURSE_UNVALIDATED').explanation).toMatch(/^Funciona igual/u);
  });

  it('la insignia no tiene tono de severidad que ordene los carriles', () => {
    // `track` dice a qué carril pertenece; no hay `severity` ni `tone`.
    const claves = Object.keys(courseBadge('CUSTOM_COURSE_UNVALIDATED'));
    expect(claves).toStrictEqual(['label', 'track', 'explanation']);
  });

  it('los dos carriles tienen insignia, y la explicación es obligatoria en ambos', () => {
    for (const tipo of ['VALIDATED_LOGIC_COURSE', 'CUSTOM_COURSE_UNVALIDATED'] as const) {
      expect(courseBadge(tipo).explanation.length).toBeGreaterThan(20);
      expect(courseBadge(tipo).track).toBe(tipo);
    }
  });
});

describe('UI-CORR-01 — tres estados, tres huecos', () => {
  it('sin veredictos de H11, el resultado experimental es null', () => {
    const p = courseStatusPanel({
      technicalPackage: 'paquete v1 congelado',
      auditBenchmark: 'BENCH-01 corrido, sin ganador coronado',
      h11VerdictsExist: false,
    });
    expect(p.experimental).toBeNull();
    // Explícitamente nulo, no ausente: ausente diría «no se consultó».
    expect(Object.hasOwn(p, 'experimental')).toBe(true);
  });

  it('un benchmark técnico no puede ocupar el hueco experimental', () => {
    // Es el defecto concreto: se enchufa ahí porque es el único hueco que había.
    expect(() =>
      courseStatusPanel({
        technicalPackage: 'paquete v1',
        auditBenchmark: 'BENCH-01: 4 de 6 gates',
        experimental: 'BENCH-01: 4 de 6 gates',
        h11VerdictsExist: false,
      }),
    ).toThrowError(/se leería como validación del aprendizaje/u);
    try {
      courseStatusPanel({
        technicalPackage: 'p',
        auditBenchmark: 'b',
        experimental: 'x',
        h11VerdictsExist: false,
      });
    } catch (e) {
      expect((e as CourseLabelError).code).toBe('RESULTADO_EXPERIMENTAL_SIN_VEREDICTOS');
    }
  });

  it('control positivo: con veredictos de H11 sí se muestra', () => {
    // Si nunca pasara, el hueco no sería un hueco sino una prohibición, y el día
    // que H11 concluya nadie sabría por dónde enchufarlo.
    const p = courseStatusPanel({
      technicalPackage: 'paquete v1',
      auditBenchmark: 'BENCH-01: 4 de 6 gates',
      experimental: 'H11: veredicto emitido',
      h11VerdictsExist: true,
    });
    expect(p.experimental).toBe('H11: veredicto emitido');
    // Y los tres siguen separados: el benchmark no se mezcló.
    expect(p.auditBenchmark).not.toBe(p.experimental);
  });

  it('los tres campos son distintos y ninguno se deriva de otro', () => {
    const p = courseStatusPanel({
      technicalPackage: 'a',
      auditBenchmark: 'b',
      h11VerdictsExist: false,
    });
    expect([p.technicalPackage, p.auditBenchmark, p.experimental]).toStrictEqual(['a', 'b', null]);
  });
});
