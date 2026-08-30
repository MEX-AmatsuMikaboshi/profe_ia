import { describe, expect, it } from 'vitest';
import {
  assertAdmissible,
  assertTeachable,
  beginPreparation,
  CourseIsolationError,
  createCourse,
  EvaluationAuthorityError,
  EXPERIMENTAL_SINKS,
  FUNCTIONAL_SINKS,
  assertMayEmitFormalVerdict,
  evaluateInDomain,
  forSced,
  initialProgress,
  isRetryable,
  partitionByTrack,
  preparationView,
  recordProgress,
  updateCourse,
  type Course,
  type CourseEnvelope,
} from '@profesor-ia/domain-engine';

import {
  runGeneralizedW0,
  type Candidate,
  type GeneralizedSourceEvaluation,
  type GeneralizedW0Input,
} from '../src/index.js';

/**
 * `ci:e2e:course-creation` — el criterio de aceptación de F9
 * (`Plan.md` §F9, `DEC-CUSTOM-COURSES-001`, tabla de trazabilidad §830:
 * «T-CC-01..05 · prueba de aislamiento · carril personalizado»).
 *
 * Recorre el flujo entero de UIUX §5.2 —sobre mínimo → investigación →
 * propuesta → crear materia → clase— sobre una materia que **no** es de lógica,
 * y después comprueba por consulta cruzada que nada de lo que produjo esa clase
 * entra en el experimento.
 *
 * ## Por qué la consulta cruzada y no una comprobación por registro
 *
 * Comprobar registro a registro que la etiqueta está puesta es comprobar lo que
 * ya prueba `course-isolation.test.ts`. Lo que aquí se ataca es el fallo de un
 * nivel más arriba: que la **consulta** que alimenta el análisis devuelva de
 * más. Ese fallo no es ruidoso —el análisis corre igual y produce números con la
 * misma cara que los buenos— así que la única forma de verlo es preguntar a la
 * proyección por lo que no debería tener.
 *
 * Y con su **control positivo**: se comprueba también que el curso de lógica
 * **sí** llega a los cuatro destinos experimentales. Sin eso, una puerta que
 * rechazara todo dejaría verde esta suite entera y al experimento sin datos.
 *
 * Determinista y sin red: los conectores entregan datos, y el reloj es una
 * constante.
 */

const AHORA = 1_756_512_000_000; // 2026-08-30T00:00:00Z
const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

const SOBRE: CourseEnvelope = {
  subject: 'Revolución mexicana',
  topic: 'Causas y primera fase (1910-1913)',
  level: 'bachillerato',
  personalGoal: 'Entender por qué empezó',
};

const OBSERVACIONES = {
  autoridad: 0.9,
  revision: 0.8,
  estabilidad: 0.7,
  explicitud: 0.9,
  verificabilidad: 0.8,
  cobertura: 0.6,
} as const;

function candidato(sourceId: string, url: string, sha: string): Candidate {
  return {
    sourceId,
    accessMode: 'api',
    record: {
      url,
      origin: `Repositorio de ${sourceId}`,
      version: 'v2026-01',
      retrievedAt: '2026-08-30T00:00:00.000Z',
      licenseEvidence: `Licencia de ${sourceId}, consultada 2026-08-30`,
      snapshotSha256: sha,
    },
  };
}

function evaluacion(url: string, componente: string): GeneralizedSourceEvaluation {
  return {
    candidateUrl: url,
    sourceComponent: componente,
    observations: OBSERVACIONES,
    licenseRecord: {
      sourceComponent: componente,
      sourceVersion: 'v2026-01',
      provenanceBasis: `Descargado de ${url}`,
      licenseEvidence: 'CC BY 4.0 archivada',
      terms: {
        licenseId: 'CC-BY-4.0',
        nonCommercial: false,
        shareAlike: false,
        noDerivatives: false,
        thirdPartyPermissionOnly: false,
      },
    },
    attributionChain: ['Autor original'],
  };
}

function entradaW0(course: Course): GeneralizedW0Input {
  return {
    course,
    whitelist: [
      {
        sourceId: 'unam-historia',
        name: 'UNAM · IIH',
        accessMode: 'api',
        baseUrl: 'https://example.test/unam',
      },
      {
        sourceId: 'inehrm',
        name: 'INEHRM',
        accessMode: 'api',
        baseUrl: 'https://example.test/inehrm',
      },
    ],
    candidates: [
      candidato('unam-historia', 'https://example.test/unam/revolucion', SHA_A),
      candidato('inehrm', 'https://example.test/inehrm/1910', SHA_B),
    ],
    discoveryRounds: [
      { round: 1, newItems: 2, reviewedItems: 2, lineages: ['unam', 'inehrm'] },
      { round: 2, newItems: 0, reviewedItems: 2, lineages: [] },
    ],
    evaluations: [
      evaluacion('https://example.test/unam/revolucion', 'unam/revolucion'),
      evaluacion('https://example.test/inehrm/1910', 'inehrm/1910'),
    ],
    licenseQuery: { intendedUse: 'base_expresiva' },
    selectionRationale:
      'Dos fuentes institucionales cubren el periodo con licencia preferida. Ningún escalar ' +
      'interviene: la selección se justifica por cobertura y licencia.',
  };
}

/**
 * Comprueba el **código** del error, no su mensaje.
 *
 * `CourseError` lleva el código en `.code` y la prosa aparte. Una aserción
 * sobre el texto pasaría el día que alguien reescriba el mensaje y fallaría sin
 * que nada esté roto — y, peor, podría pasar por casualidad con otro error cuyo
 * texto compartiera una palabra.
 */
function lanzaConCodigo(fn: () => unknown, code: string): void {
  expect(fn).toThrow();
  try {
    fn();
  } catch (error) {
    expect((error as { readonly code?: string }).code).toBe(code);
  }
}

/**
 * El recorrido completo, en una función, porque cada prueba lo necesita entero.
 * Si alguna etapa fallara, fallarían todas — que es lo correcto: un e2e cuya
 * primera mitad se puede saltar no es un e2e.
 */
function creaMateriaHastaLaClase(): { readonly course: Course; readonly proposalRef: string } {
  // 1. Sobre mínimo → investigación (UIUX §5.2, paso «definir qué aprender»).
  const draft = createCourse({
    courseId: 'revolucion-mexicana',
    courseType: 'CUSTOM_COURSE_UNVALIDATED',
    title: 'Revolución mexicana',
  });
  const investigando = beginPreparation(draft, SOBRE);
  expect(investigando.preparation).toBe('researching');

  // 2. W0 generalizado → propuesta de curso (T-CC-02).
  const w0 = runGeneralizedW0(entradaW0(investigando));
  expect(w0.course.preparation).toBe('proposal_ready');
  expect(w0.proposal).not.toBeNull();

  // 3. El usuario acepta → materia creada.
  const creada = updateCourse(w0.course, { preparation: 'created' });

  // 4. La clase se puede abrir. Es el final del recorrido de §5.2.
  assertTeachable(creada);

  return { course: creada, proposalRef: w0.proposal?.proposalVersion ?? '' };
}

describe('e2e crear-materia → clase (AC de F9)', () => {
  it('recorre sobre → investigación → propuesta → materia creada → clase', () => {
    const { course, proposalRef } = creaMateriaHastaLaClase();

    expect(course.preparation).toBe('created');
    expect(course.courseType).toBe('CUSTOM_COURSE_UNVALIDATED');
    expect(course.envelope?.subject).toBe('Revolución mexicana');
    // La propuesta que se aceptó es la generalizada, no un manifiesto de corpus.
    expect(proposalRef).toBe('generalized-course-proposal-v1');
  });

  it('la preparación fue observable en cada paso, no una rueda girando', () => {
    const investigando = beginPreparation(
      createCourse({
        courseId: 'revolucion-mexicana',
        courseType: 'CUSTOM_COURSE_UNVALIDATED',
        title: 'Revolución mexicana',
      }),
      SOBRE,
    );
    const w0 = runGeneralizedW0(entradaW0(investigando));
    const vista = preparationView({
      course: w0.course,
      artifacts: w0.artifacts,
      lastMessage: w0.message,
    });

    // Estado, artefactos y mensaje: lo que distingue «investigando» de «lleva
    // cuatro minutos parada».
    expect(vista.state).toBe('proposal_ready');
    expect(vista.artifacts.map((a) => a.kind)).toEqual(['sources_found', 'course_proposal']);
    expect(vista.lastMessageText).not.toBe('');
    expect(vista.backgroundPromise).toContain('mientras el entorno local esté encendido');
  });

  it('el tipo no cambia en ningún punto del recorrido', () => {
    const { course } = creaMateriaHastaLaClase();
    lanzaConCodigo(
      () => updateCourse(course, { courseType: 'VALIDATED_LOGIC_COURSE' }),
      'TIPO_INMUTABLE',
    );
  });
});

describe('la clase de una materia propia no emite veredictos formales (T-CC-04)', () => {
  it('evaluar una respuesta devuelve una forma sin campo de veredicto', () => {
    creaMateriaHastaLaClase();
    const evaluacionDeClase = evaluateInDomain({
      domainId: 'historia-mexico',
      observations: ['response_recorded', 'time_on_task'],
    });

    expect(evaluacionDeClase.authority).toBe('no_formal_authority');
    expect(evaluacionDeClase).not.toHaveProperty('valid');
    expect(evaluacionDeClase).not.toHaveProperty('verdictRef');
    if (evaluacionDeClase.authority !== 'no_formal_authority') throw new Error('rama equivocada');
    expect(evaluacionDeClase.formalVerdict).toBeNull();
    expect(evaluacionDeClase.disclaimer).not.toBe('');
  });

  it('y la superficie que pintaría corrección lanza', () => {
    expect(() => assertMayEmitFormalVerdict('historia-mexico')).toThrow(EvaluationAuthorityError);
  });

  it('control positivo: el curso de lógica sí obtiene su veredicto', () => {
    const conVerificador = evaluateInDomain({
      domainId: 'authorized-calculus-v1',
      verdictRef: 'evidence://verdict/abc',
    });
    expect(conVerificador.authority).toBe('deterministic_verifier');
    expect(() => assertMayEmitFormalVerdict('authorized-calculus-v1')).not.toThrow();
  });
});

describe('aislamiento por consulta cruzada (T-CC-03)', () => {
  /**
   * Lo que las dos clases dejaron escrito. La consulta se hace sobre la
   * **unión**, que es como estaría en la base: si la separación se hiciera al
   * exportar en vez de al escribir, este conjunto sería el mismo y la
   * proyección experimental traería de más.
   */
  function registrosDeLasDosClases() {
    const { course } = creaMateriaHastaLaClase();
    const logica = createCourse({
      courseId: 'logica',
      courseType: 'VALIDATED_LOGIC_COURSE',
      title: 'Deducción natural',
    });

    return [
      { courseType: logica.courseType, courseId: logica.courseId, attemptId: 'a1' },
      { courseType: course.courseType, courseId: course.courseId, attemptId: 'a2' },
      { courseType: logica.courseType, courseId: logica.courseId, attemptId: 'a3' },
      { courseType: course.courseType, courseId: course.courseId, attemptId: 'a4' },
    ];
  }

  it('la consulta del análisis SCED no devuelve ni un registro de la materia propia', () => {
    const paraSced = forSced(registrosDeLasDosClases());

    expect(paraSced).toHaveLength(2);
    expect(paraSced.every((r) => r.courseType === 'VALIDATED_LOGIC_COURSE')).toBe(true);
    expect(paraSced.some((r) => r.courseId === 'revolucion-mexicana')).toBe(false);
  });

  it('y ningún registro se pierde por el camino: las dos proyecciones suman el total', () => {
    // El otro fallo posible, y es el opuesto: una puerta que descartara en
    // silencio dejaría una corrida incompleta indistinguible de una en la que
    // esos datos nunca existieron.
    const registros = registrosDeLasDosClases();
    const { experimental, functional } = partitionByTrack(registros);
    expect(experimental.length + functional.length).toBe(registros.length);
    expect(functional.map((r) => r.attemptId)).toEqual(['a2', 'a4']);
  });

  it('escribir un registro de la materia propia en cualquier destino experimental lanza', () => {
    for (const sink of EXPERIMENTAL_SINKS) {
      expect(() =>
        assertAdmissible({ courseType: 'CUSTOM_COURSE_UNVALIDATED', sink }),
      ).toThrow(CourseIsolationError);
    }
  });

  it('control positivo: el curso de lógica sí alimenta los cuatro destinos experimentales', () => {
    // Sin esto, una puerta que rechazara todo dejaría verde la prueba de arriba
    // y al experimento sin datos.
    for (const sink of EXPERIMENTAL_SINKS) {
      expect(() => assertAdmissible({ courseType: 'VALIDATED_LOGIC_COURSE', sink })).not.toThrow();
    }
  });

  it('control positivo: la materia propia sí guarda progreso, coste y telemetría', () => {
    for (const sink of FUNCTIONAL_SINKS) {
      expect(() =>
        assertAdmissible({ courseType: 'CUSTOM_COURSE_UNVALIDATED', sink }),
      ).not.toThrow();
    }
  });
});

describe('continuidad después de la primera clase (OWNER-CONTINUITY-001)', () => {
  it('la materia propia guarda su punto de retorno y no lo cruza con otra', () => {
    const { course } = creaMateriaHastaLaClase();

    const inicial = initialProgress(course.courseId, AHORA);
    expect(inicial.resumePoint).toBeNull();

    const conAvance = recordProgress(inicial, {
      courseId: course.courseId,
      sessionId: 'sesion-1',
      resumePoint: 'unidad-1/actividad-3',
      atMs: AHORA + 1_000,
    });
    expect(conAvance.resumePoint).toBe('unidad-1/actividad-3');

    lanzaConCodigo(
      () =>
        recordProgress(conAvance, {
          courseId: 'logica',
          sessionId: 'sesion-2',
          resumePoint: 'kc-13/actividad-1',
          atMs: AHORA + 2_000,
        }),
      'PROGRESO_DE_OTRA_MATERIA',
    );
  });
});

describe('el camino de fallo también llega hasta la pantalla', () => {
  it('sin fuentes usables la materia queda en failed, y la vista lo dice sin ofrecer reintento', () => {
    const investigando = beginPreparation(
      createCourse({
        courseId: 'materia-imposible',
        courseType: 'CUSTOM_COURSE_UNVALIDATED',
        title: 'Materia imposible',
      }),
      { subject: 'Un tema sobre el que no hay fuentes' },
    );
    const base = entradaW0(investigando);
    const sinLicencia = base.evaluations.map((e) => ({
      ...e,
      licenseRecord: {
        ...e.licenseRecord,
        terms: {
          licenseId: 'propietaria',
          nonCommercial: true,
          shareAlike: false,
          noDerivatives: true,
          thirdPartyPermissionOnly: true,
        },
      },
    }));

    const w0 = runGeneralizedW0({ ...base, course: investigando, evaluations: sinLicencia });
    expect(w0.course.preparation).toBe('failed');
    expect(w0.message).toBe('no_sources_found');
    expect(isRetryable(w0.message)).toBe(false);

    const vista = preparationView({
      course: w0.course,
      artifacts: w0.artifacts,
      lastMessage: w0.message,
    });
    expect(vista.retryable).toBe(false);

    // Y la clase no se abre: entrar ahora enseñaría una clase con huecos que el
    // alumno leería como defecto del Profesor IA.
    lanzaConCodigo(() => assertTeachable(w0.course), 'CURSO_NO_ENSENABLE');
  });
});
