import { describe, expect, it } from 'vitest';

import {
  CourseIsolationError,
  EXPERIMENTAL_SINKS,
  FUNCTIONAL_SINKS,
  PROJECTIONS,
  assertAdmissible,
  forSced,
  isExperimentalSink,
  partitionByTrack,
  projectionFor,
} from '../src/course-isolation.js';

const LOGICA = 'VALIDATED_LOGIC_COURSE';
const CUSTOM = 'CUSTOM_COURSE_UNVALIDATED';

describe('los destinos experimentales son los cuatro del plan', () => {
  it('literal', () => {
    expect([...EXPERIMENTAL_SINKS]).toStrictEqual([
      'reservation',
      'probe_round',
      'primary_metric',
      'sced_analysis',
    ]);
  });

  it('y las proyecciones son dos, no una con filtro', () => {
    expect([...PROJECTIONS]).toStrictEqual(['experimental', 'functional']);
  });
});

describe('el carril personalizado no alimenta el experimento', () => {
  it('ninguno de los cuatro destinos lo acepta', () => {
    for (const sink of EXPERIMENTAL_SINKS) {
      expect(() => assertAdmissible({ courseType: CUSTOM, sink }), sink).toThrowError(
        /una corrida que nadie diseñó/u,
      );
    }
  });

  it('el código nombra la decisión, no un permiso', () => {
    try {
      assertAdmissible({ courseType: CUSTOM, sink: 'sced_analysis' });
    } catch (e) {
      expect((e as CourseIsolationError).code).toBe('CARRIL_PERSONALIZADO_EN_DESTINO_EXPERIMENTAL');
      expect((e as Error).message).toContain('DEC-CUSTOM-COURSES-001');
    }
  });
});

describe('control positivo: la puerta deja pasar lo que debe', () => {
  // Sin esto, un `assertAdmissible` que rechazara **todo** haría pasar por vacío
  // cada prueba negativa de arriba, y el experimento se quedaría sin datos sin
  // que nada lo dijera. Es la misma lección que la suite negativa de privilegios.
  it('el curso de lógica sí alimenta los cuatro destinos experimentales', () => {
    for (const sink of EXPERIMENTAL_SINKS) {
      expect(() => assertAdmissible({ courseType: LOGICA, sink }), sink).not.toThrow();
    }
  });

  it('y los dos carriles alimentan los destinos funcionales', () => {
    for (const sink of FUNCTIONAL_SINKS) {
      for (const tipo of [LOGICA, CUSTOM]) {
        expect(() => assertAdmissible({ courseType: tipo, sink }), `${tipo}/${sink}`).not.toThrow();
      }
    }
  });

  it('una materia personalizada guarda progreso y coste: es funcionalmente útil', () => {
    // P-I §3.1.2 pide no presentarla como defectuosa. Si no pudiera guardar
    // progreso, lo sería.
    expect(() => assertAdmissible({ courseType: CUSTOM, sink: 'progress' })).not.toThrow();
    expect(() => assertAdmissible({ courseType: CUSTOM, sink: 'cost_ledger' })).not.toThrow();
  });
});

describe('sin etiqueta no se pasa', () => {
  it('un carril no declarado lanza en vez de suponerse', () => {
    // Suponerlo decidiría en silencio a qué corrida pertenece el registro.
    expect(() => assertAdmissible({ courseType: '', sink: 'progress' })).toThrowError(
      /no es un carril/u,
    );
    expect(() => projectionFor('OTRO_CURSO')).toThrowError(/es un defecto/u);
  });

  it('un destino desconocido también', () => {
    // Un destino nuevo se declara aquí, y así nace vigilado en vez de abierto.
    expect(() => assertAdmissible({ courseType: LOGICA, sink: 'analisis_nuevo' })).toThrowError(
      /no es un destino declarado/u,
    );
  });

  it('`isExperimentalSink` no se cree nombres parecidos', () => {
    expect(isExperimentalSink('sced_analysis')).toBe(true);
    expect(isExperimentalSink('sced_analysis_v2')).toBe(false);
    expect(isExperimentalSink('probe_rounds')).toBe(false);
  });
});

describe('proyecciones separadas', () => {
  const registros = [
    { courseType: LOGICA, id: 'a' },
    { courseType: CUSTOM, id: 'b' },
    { courseType: LOGICA, id: 'c' },
  ];

  it('cada carril va a la suya', () => {
    const p = partitionByTrack(registros);
    expect(p.experimental.map((r) => r.id)).toStrictEqual(['a', 'c']);
    expect(p.functional.map((r) => r.id)).toStrictEqual(['b']);
  });

  it('el análisis SCED sólo ve el carril validado', () => {
    expect(forSced(registros).map((r) => r.id)).toStrictEqual(['a', 'c']);
  });

  it('un registro sin etiquetar lanza, no se descarta', () => {
    // Descartarlo en silencio lo haría desaparecer de las dos proyecciones, y
    // una corrida a la que le faltan datos no se distingue de una en la que esos
    // datos nunca existieron.
    expect(() => partitionByTrack([...registros, { courseType: 'ninguno', id: 'd' }])).toThrowError(
      CourseIsolationError,
    );
  });

  it('el reparto no pierde ni duplica nada', () => {
    const p = partitionByTrack(registros);
    expect(p.experimental.length + p.functional.length).toBe(registros.length);
  });
});
