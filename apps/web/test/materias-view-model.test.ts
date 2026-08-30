import { describe, expect, it } from 'vitest';
import {
  createCourse,
  initialProgress,
  recordProgress,
  updateCourse,
  PREPARATION_ARTIFACTS,
  type Course,
  type CourseProgress,
} from '@profesor-ia/domain-engine';
import { DomainKcState } from '@profesor-ia/domain-engine';

import { courseStatusPanel } from '../src/clase/course-badge';
import { MATERIAS_COPY, progresoDisclaimer } from '../src/materias/copy';
import {
  AUTHORITATIVE_MASTERY_STATUSES,
  detalleView,
  inicioView,
  KC_PROGRESS_STATES,
  MateriasViewError,
  misMateriasView,
  primaryAction,
  progresoView,
  type MateriaInput,
} from '../src/materias/view-model';

/**
 * Las cuatro vistas de materia (T-CC-05). Lo que se comprueba aquí no es que
 * pinten: es que **no afirmen** lo que nadie midió.
 */

const AHORA = 1_756_512_000_000;

function logica(): Course {
  return createCourse({
    courseId: 'logica',
    courseType: 'VALIDATED_LOGIC_COURSE',
    title: 'Deducción natural',
  });
}

function propia(preparation: 'draft' | 'created' = 'created'): Course {
  const base = createCourse({
    courseId: 'historia',
    courseType: 'CUSTOM_COURSE_UNVALIDATED',
    title: 'Revolución mexicana',
    envelope: { subject: 'Revolución mexicana' },
  });
  if (preparation === 'draft') return base;
  return updateCourse(
    updateCourse(
      updateCourse(updateCourse(base, { preparation: 'envelope_ready' }), {
        preparation: 'researching',
      }),
      { preparation: 'proposal_ready' },
    ),
    { preparation: 'created' },
  );
}

function conAvance(courseId: string): CourseProgress {
  return recordProgress(initialProgress(courseId, AHORA), {
    courseId,
    sessionId: 's1',
    resumePoint: 'kc-13/actividad-2',
    atMs: AHORA,
  });
}

const ESTADO = courseStatusPanel({
  technicalPackage: 'paquete sintético',
  auditBenchmark: 'BENCH-01 provisional',
  h11VerdictsExist: false,
});

describe('acción principal (UIUX §6.1)', () => {
  it('sin punto de retorno ofrece empezar, no continuar', () => {
    expect(primaryAction(logica(), initialProgress('logica', AHORA))).toEqual({ kind: 'empezar' });
  });

  it('con punto de retorno ofrece continuar, y lo lleva puesto', () => {
    expect(primaryAction(logica(), conAvance('logica'))).toEqual({
      kind: 'continuar',
      resumePoint: 'kc-13/actividad-2',
    });
  });

  it('una materia sin preparar no ofrece clase de ninguna forma', () => {
    const accion = primaryAction(propia('draft'), initialProgress('historia', AHORA));
    expect(accion).toEqual({ kind: 'ver_preparacion', state: 'draft' });
  });
});

describe('Inicio (UIUX §6.1)', () => {
  const materias: readonly MateriaInput[] = [
    { course: logica(), progress: conAvance('logica') },
    { course: propia('draft'), progress: initialProgress('historia', AHORA) },
  ];

  function vista(overrides: Partial<Parameters<typeof inicioView>[0]> = {}) {
    return inicioView({
      materias,
      activeCourseId: 'logica',
      scheduledReviews: [],
      cost: null,
      capabilitiesNote: 'sesión seca',
      ...overrides,
    });
  }

  it('separa las enseñables de las que se están preparando', () => {
    const vm = vista();
    expect(vm.enCurso.map((c) => c.courseId)).toEqual(['logica']);
    expect(vm.enPreparacion.map((c) => c.courseId)).toEqual(['historia']);
  });

  it('una materia activa que no está en la lista lanza en vez de elegir otra', () => {
    expect(() => vista({ activeCourseId: 'no-existe' })).toThrow(MateriasViewError);
    try {
      vista({ activeCourseId: 'no-existe' });
    } catch (error) {
      expect((error as MateriasViewError).code).toBe('MATERIA_ACTIVA_AUSENTE');
    }
  });

  it('cruzar el progreso de otra materia lanza', () => {
    expect(() =>
      inicioView({
        materias: [{ course: logica(), progress: conAvance('historia') }],
        activeCourseId: null,
        scheduledReviews: [],
        cost: null,
        capabilitiesNote: '',
      }),
    ).toThrow(MateriasViewError);
  });

  it('el coste ausente es null y no un cero', () => {
    expect(vista().cost).toBeNull();
  });
});

describe('Mis materias (UIUX §6.2, UI-CORR-01)', () => {
  const vm = misMateriasView({
    materias: [
      { course: logica(), progress: conAvance('logica'), status: ESTADO },
      { course: propia(), progress: initialProgress('historia', AHORA), status: ESTADO },
    ],
  });

  it('los dos carriles van en listas separadas', () => {
    expect(vm.validado.map((f) => f.courseId)).toEqual(['logica']);
    expect(vm.personalizadas.map((f) => f.courseId)).toEqual(['historia']);
  });

  it('el hueco experimental sigue vacío mientras H11 no concluya', () => {
    expect(vm.validado[0]?.status.experimental).toBeNull();
    expect(vm.personalizadas[0]?.status.experimental).toBeNull();
  });
});

describe('Detalle (UIUX §6.4)', () => {
  it('enseña la preparación sólo mientras la materia no es enseñable', () => {
    const enPreparacion = detalleView({
      materia: { course: propia('draft'), progress: initialProgress('historia', AHORA) },
      status: ESTADO,
      outline: [],
      history: [],
      scheduledReviews: [],
      preparationArtifacts: [{ kind: 'sources_found', ref: '3 fuentes' }],
      lastPreparationMessage: 'researching_sources',
    });
    expect(enPreparacion.preparation?.state).toBe('draft');

    const creada = detalleView({
      materia: { course: propia(), progress: initialProgress('historia', AHORA) },
      status: ESTADO,
      outline: [],
      history: [],
      scheduledReviews: [],
      preparationArtifacts: [],
      lastPreparationMessage: 'course_created',
    });
    expect(creada.preparation).toBeNull();
  });
});

describe('Progreso (UIUX §6.6, T-CC-04)', () => {
  const CATALOGO = ['KC01', 'KC02', 'KC11'];

  function vista(overrides: Partial<Parameters<typeof progresoView>[0]> = {}) {
    return progresoView({
      materia: { course: logica(), progress: conAvance('logica') },
      kcCatalog: CATALOGO,
      projections: [
        { kcId: 'KC01', masteryStatus: 'mastered', lastChangedAt: '2026-08-29' },
        { kcId: 'KC02', masteryStatus: 'reconfirmation_failed', lastChangedAt: '2026-08-30' },
      ],
      retention: { kind: 'no_evaluada', declaredCode: 'retention_not_evaluated' },
      scheduledReviews: [],
      history: [],
      disclaimer: progresoDisclaimer(),
      ...overrides,
    });
  }

  it('un KC sin proyección es «pendiente», que no es un cero', () => {
    const vm = vista();
    if (vm.kind !== 'con_autoridad_de_dominio') throw new Error('rama equivocada');
    expect(vm.kcs.find((k) => k.kcId === 'KC11')).toEqual({
      kcId: 'KC11',
      state: 'pendiente',
      lastChangedAt: null,
    });
    expect(vm.counts).toEqual({
      dominado: 1,
      en_aprendizaje: 0,
      reconfirmacion_fallida: 1,
      pendiente: 1,
    });
  });

  it('la reconfirmación fallida no se funde con «en aprendizaje»', () => {
    const vm = vista();
    if (vm.kind !== 'con_autoridad_de_dominio') throw new Error('rama equivocada');
    expect(vm.kcs.find((k) => k.kcId === 'KC02')?.state).toBe('reconfirmacion_fallida');
    expect(MATERIAS_COPY.progreso.states.reconfirmacion_fallida).not.toBe(
      MATERIAS_COPY.progreso.states.en_aprendizaje,
    );
  });

  it('una materia propia devuelve la rama sin dominio, que no tiene recuentos', () => {
    const vm = progresoView({
      materia: { course: propia(), progress: initialProgress('historia', AHORA) },
      kcCatalog: [],
      projections: [],
      retention: { kind: 'no_evaluada', declaredCode: 'retention_not_evaluated' },
      scheduledReviews: [],
      history: [],
      disclaimer: progresoDisclaimer(),
    });
    expect(vm.kind).toBe('sin_autoridad_de_dominio');
    expect(vm).not.toHaveProperty('kcs');
    expect(vm).not.toHaveProperty('counts');
    expect(vm).not.toHaveProperty('retention');
  });

  it('proyecciones de dominio en una materia sin verificador lanzan', () => {
    expect(() =>
      progresoView({
        materia: { course: propia(), progress: initialProgress('historia', AHORA) },
        kcCatalog: ['KC01'],
        projections: [{ kcId: 'KC01', masteryStatus: 'mastered', lastChangedAt: null }],
        retention: { kind: 'no_evaluada', declaredCode: 'retention_not_evaluated' },
        scheduledReviews: [],
        history: [],
        disclaimer: progresoDisclaimer(),
      }),
    ).toThrow(/DOMINIO_SIN_AUTORIDAD/);
  });

  it('un estado de KC fuera del catálogo lanza en vez de aparecer en pantalla', () => {
    expect(() =>
      vista({
        projections: [{ kcId: 'KC99', masteryStatus: 'mastered', lastChangedAt: null }],
      }),
    ).toThrow(/ESTADO_DE_KC_FUERA_DEL_CATALOGO/);
  });

  it('la retención no evaluada se declara, no se estima', () => {
    const vm = vista();
    if (vm.kind !== 'con_autoridad_de_dominio') throw new Error('rama equivocada');
    expect(vm.retention).toEqual({ kind: 'no_evaluada', declaredCode: 'retention_not_evaluated' });
  });
});

describe('correspondencia con la fuente de verdad', () => {
  /**
   * `apps/web` copia los tres estados de `masteryStatus` porque no alcanza el
   * estado de dominio. Esta prueba es lo que impide que la copia se separe del
   * original en silencio — el mismo patrón que `db:grants:check`.
   */
  it('los estados copiados son exactamente los de DomainKcState', () => {
    const declarados = DomainKcState.shape.masteryStatus.options as readonly string[];
    expect([...AUTHORITATIVE_MASTERY_STATUSES].sort()).toEqual([...declarados].sort());
  });

  it('cada artefacto de preparación tiene prosa', () => {
    // Sin esto, un artefacto nuevo en `PREPARATION_ARTIFACTS` renderiza
    // `undefined` en la pantalla de preparación — que es la pantalla que existe
    // justo para que el usuario sepa que el proceso sigue vivo.
    for (const kind of PREPARATION_ARTIFACTS) {
      expect(MATERIAS_COPY.detalle.artifacts[kind], `«${kind}» sin prosa`).toBeTruthy();
    }
    expect(Object.keys(MATERIAS_COPY.detalle.artifacts).sort()).toEqual(
      [...PREPARATION_ARTIFACTS].sort(),
    );
  });

  it('cada estado de pantalla tiene rótulo y ninguno se repite', () => {
    const rotulos = KC_PROGRESS_STATES.map((e) => MATERIAS_COPY.progreso.states[e]);
    expect(rotulos.filter((r) => r.trim() === '')).toHaveLength(0);
    expect(new Set(rotulos).size).toBe(KC_PROGRESS_STATES.length);
  });
});
