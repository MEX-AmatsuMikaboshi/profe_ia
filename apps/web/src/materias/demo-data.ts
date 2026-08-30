import {
  beginPreparation,
  createCourse,
  initialProgress,
  recordProgress,
  updateCourse,
  type Course,
  type CourseProgress,
} from '@profesor-ia/domain-engine';

import { courseStatusPanel, type CourseStatusPanel } from '../clase/course-badge';
import { progresoDisclaimer } from './copy';
import {
  detalleView,
  inicioView,
  misMateriasView,
  progresoView,
  type DetalleViewModel,
  type InicioViewModel,
  type MateriaInput,
  type MisMateriasViewModel,
  type ProgresoViewModel,
} from './view-model';

/**
 * Paquete sintético de desarrollo para las cuatro vistas (T-CC-05 ← UIUX §2).
 *
 * Es el equivalente de `clase/dry-session.ts`: mientras no haya `apps/api`
 * sirviendo cursos reales, las vistas se alimentan de aquí **y lo declaran en
 * pantalla**. La regla de datos ilustrativos de UIUX §2 es explícita en que
 * nada de esto son defaults, umbrales ni fixtures autoritativos.
 *
 * Dos cosas de este paquete no son decorativas y por eso están así:
 *
 * - La materia propia se deja **en preparación**, no creada. Es el estado en el
 *   que un usuario la encuentra la primera vez, y el único en el que se ve la
 *   pantalla de preparación observable de `T-CC-02`.
 * - El hueco experimental de UI-CORR-01 va **vacío en las dos**, porque H11 no
 *   ha producido ningún veredicto. Rellenarlo con el resultado de BENCH-01
 *   sería exactamente lo que esa corrección prohíbe.
 */

const AHORA_MS = 1_756_512_000_000; // 2026-08-30T00:00:00Z, fijo: la vista no lee el reloj.

export function cursoLogica(): Course {
  return createCourse({
    courseId: 'logica',
    courseType: 'VALIDATED_LOGIC_COURSE',
    title: 'Deducción natural proposicional',
  });
}

export function materiaPropia(): Course {
  const curso = createCourse({
    courseId: 'revolucion-mexicana',
    courseType: 'CUSTOM_COURSE_UNVALIDATED',
    title: 'Revolución mexicana',
  });
  return beginPreparation(curso, {
    subject: 'Revolución mexicana',
    topic: 'Causas y primera fase (1910-1913)',
    level: 'bachillerato',
  });
}

export function progresoLogica(): CourseProgress {
  return recordProgress(initialProgress('logica', AHORA_MS), {
    courseId: 'logica',
    sessionId: 'sesion-seca-1',
    resumePoint: 'kc-13/actividad-2',
    atMs: AHORA_MS,
  });
}

/** La materia propia no tiene punto de retorno: todavía se está preparando. */
export function progresoMateriaPropia(): CourseProgress {
  return initialProgress('revolucion-mexicana', AHORA_MS);
}

/** Los tres huecos de UI-CORR-01. El experimental queda `null` en las dos. */
export function estadoLogica(): CourseStatusPanel {
  return courseStatusPanel({
    technicalPackage: 'Paquete de desarrollo sintético; el corpus real no está congelado (W5).',
    auditBenchmark: 'BENCH-01 corrió con ganador provisional; la auditoría humana sigue pendiente.',
    h11VerdictsExist: false,
  });
}

export function estadoMateriaPropia(): CourseStatusPanel {
  return courseStatusPanel({
    technicalPackage: 'En preparación: todavía no hay propuesta de curso aceptada.',
    auditBenchmark: 'No aplica: esta materia no entra en los benchmarks del experimento.',
    h11VerdictsExist: false,
  });
}

function materias(): readonly MateriaInput[] {
  return [
    { course: cursoLogica(), progress: progresoLogica() },
    { course: materiaPropia(), progress: progresoMateriaPropia() },
  ];
}

export function inicioDemo(): InicioViewModel {
  return inicioView({
    materias: materias(),
    activeCourseId: 'logica',
    // El motor no ha programado repasos en el paquete sintético, y la vista lo
    // dice con esas palabras en vez de enseñar una lista vacía.
    scheduledReviews: [],
    // Sin ledger poblado: `null`, no `0,00`.
    cost: null,
    capabilitiesNote:
      'Sesión seca con paquete sintético: sin voz, sin pizarrón y sin modelo en vivo.',
  });
}

export function misMateriasDemo(): MisMateriasViewModel {
  return misMateriasView({
    materias: [
      { course: cursoLogica(), progress: progresoLogica(), status: estadoLogica() },
      {
        course: materiaPropia(),
        progress: progresoMateriaPropia(),
        status: estadoMateriaPropia(),
      },
    ],
  });
}

const CURSOS: Readonly<Record<string, () => MateriaInput & { readonly status: CourseStatusPanel }>> =
  Object.freeze({
    logica: () => ({ course: cursoLogica(), progress: progresoLogica(), status: estadoLogica() }),
    'revolucion-mexicana': () => ({
      course: materiaPropia(),
      progress: progresoMateriaPropia(),
      status: estadoMateriaPropia(),
    }),
  });

export function conoceMateria(courseId: string): boolean {
  return Object.hasOwn(CURSOS, courseId);
}

const KC_CATALOGO_LOGICA = [
  'KC01',
  'KC02',
  'KC03',
  'KC11',
  'KC12',
  'KC13',
] as const;

export function detalleDemo(courseId: string): DetalleViewModel {
  const entrada = CURSOS[courseId];
  if (entrada === undefined) throw new Error(`materia desconocida: ${courseId}`);
  const materia = entrada();
  const esLogica = courseId === 'logica';

  return detalleView({
    materia: { course: materia.course, progress: materia.progress },
    status: materia.status,
    outline: esLogica
      ? [
          { unitId: 'u1', title: 'Reglas de introducción', kcIds: ['KC01', 'KC02', 'KC03'] },
          { unitId: 'u2', title: 'Subpruebas', kcIds: ['KC11', 'KC12', 'KC13'] },
        ]
      : [],
    history: esLogica
      ? [
          {
            sessionId: 'sesion-seca-1',
            endedAt: '2026-08-30',
            summary: 'Sesión seca con paquete sintético.',
          },
        ]
      : [],
    scheduledReviews: [],
    preparationArtifacts: esLogica ? [] : [{ kind: 'sources_found', ref: '3 fuentes' }],
    lastPreparationMessage: esLogica ? null : 'researching_sources',
  });
}

export function progresoDemo(courseId: string): ProgresoViewModel {
  const entrada = CURSOS[courseId];
  if (entrada === undefined) throw new Error(`materia desconocida: ${courseId}`);
  const materia = entrada();
  const esLogica = courseId === 'logica';

  return progresoView({
    materia: { course: materia.course, progress: materia.progress },
    kcCatalog: esLogica ? [...KC_CATALOGO_LOGICA] : [],
    // Sólo el curso con verificador trae proyecciones. Para la materia propia va
    // vacío **y la rama devuelta es otra**, no la misma con la lista corta.
    projections: esLogica
      ? [
          { kcId: 'KC01', masteryStatus: 'mastered', lastChangedAt: '2026-08-29' },
          { kcId: 'KC02', masteryStatus: 'mastered', lastChangedAt: '2026-08-29' },
          { kcId: 'KC11', masteryStatus: 'not_mastered', lastChangedAt: '2026-08-30' },
          { kcId: 'KC12', masteryStatus: 'reconfirmation_failed', lastChangedAt: '2026-08-30' },
        ]
      : [],
    retention: { kind: 'no_evaluada', declaredCode: 'retention_not_evaluated' },
    scheduledReviews: [],
    history: esLogica
      ? [
          {
            sessionId: 'sesion-seca-1',
            endedAt: '2026-08-30',
            summary: 'Sesión seca con paquete sintético.',
          },
        ]
      : [],
    disclaimer: progresoDisclaimer(),
  });
}

/**
 * La materia propia, ya creada, para el recorrido de extremo a extremo.
 *
 * No se usa en las pantallas de demostración —allí interesa verla en
 * preparación— pero sí en el e2e crear-materia → clase.
 */
export function materiaPropiaCreada(): Course {
  const enInvestigacion = materiaPropia();
  return updateCourse(updateCourse(enInvestigacion, { preparation: 'proposal_ready' }), {
    preparation: 'created',
  });
}
