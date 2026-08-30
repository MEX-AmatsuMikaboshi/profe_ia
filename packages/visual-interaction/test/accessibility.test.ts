import { describe, expect, it } from 'vitest';

import {
  A11Y_BASELINE_CRITERIA,
  A11Y_CRITERION_IDS,
  A11Y_SURFACES,
  A11yBaselineError,
  buildAccessibilityBaseline,
  canRuleOutAccessibilityBarrier,
  type A11yClaim,
  type A11yCriterionId,
  type AssistiveTechnologyRecord,
  type SurfacePresence,
} from '../src/accessibility.js';

/** Las superficies tal como están hoy: la vista de Clase existe, F10 no entera. */
const SUPERFICIES_HOY: readonly SurfacePresence[] = [
  { surface: 'editor-fitch', present: true, detail: 'FitchEditor.tsx montado en la vista' },
  { surface: 'controles-de-sesion', present: true, detail: 'pistas, pausa, apelación, retirada' },
  { surface: 'transcripcion-y-profesor', present: true, detail: 'ClaseView + ProfesorPanel' },
  { surface: 'microfono', present: false, detail: 'T-H8-01 sin credencial de proveedor de voz' },
  { surface: 'pizarron', present: false, detail: 'T-H8-03 dejó el adaptador; falta montarlo' },
  { surface: 'overlay-anotaciones', present: false, detail: 'T-H8-05 dejó el modelo; falta la capa' },
  { surface: 'notacion-logica', present: true, detail: 'las fórmulas se renderizan en el editor' },
];

function todasPresentes(): readonly SurfacePresence[] {
  return A11Y_SURFACES.map((surface) => ({ surface, present: true, detail: 'montada' }));
}

/** Un dictamen verificado por criterio, con check declarado. */
function dictamenesVerificados(
  overrides: readonly A11yClaim[] = [],
): readonly A11yClaim[] {
  const base = A11Y_CRITERION_IDS.map(
    (criterionId): A11yClaim => ({
      criterionId,
      status: 'verificado',
      checks: ['ci:a11y:baseline'],
      note: '',
    }),
  );
  const porId = new Map<A11yCriterionId, A11yClaim>(base.map((c) => [c.criterionId, c]));
  for (const o of overrides) porId.set(o.criterionId, o);
  return [...porId.values()];
}

describe('T-H8-10 — línea base de accesibilidad', () => {
  it('los once criterios son la unión de Maestro §10.5 y UIUX §8, sin duplicados', () => {
    expect(A11Y_BASELINE_CRITERIA).toHaveLength(A11Y_CRITERION_IDS.length);
    const ids = A11Y_BASELINE_CRITERIA.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toStrictEqual([...A11Y_CRITERION_IDS]);
    // Los dos que sólo trae UIUX: si alguien recorta la lista al Maestro, saltan.
    expect(ids).toContain('CRIT-MOVIMIENTO');
    expect(ids).toContain('CRIT-PALABRA');
  });

  it('todo criterio cita su autoridad y ninguno se queda sin enunciado', () => {
    for (const criterion of A11Y_BASELINE_CRITERIA) {
      expect(criterion.statement.trim()).not.toBe('');
      expect(criterion.source).toMatch(/Maestro|UIUX|P-I/);
    }
  });

  it('la única excepción anticipada por la norma es la del arrastre', () => {
    const anticipadas = A11Y_BASELINE_CRITERIA.filter((c) => c.exceptionAnticipated);
    expect(anticipadas.map((c) => c.id)).toStrictEqual(['CRIT-ARRASTRE']);
  });

  it('el informe no tiene dónde declarar conformidad WCAG global', () => {
    const report = buildAccessibilityBaseline({
      surfaces: todasPresentes(),
      claims: dictamenesVerificados(),
    });
    // El tipo es el literal; esto fija que el valor tampoco puede ser otro.
    expect(report.wcagGlobalConformance).toBe('no_declarada');
  });

  describe('«verificado» exige instrumento', () => {
    it('sin check declarado, lanza', () => {
      expect(() =>
        buildAccessibilityBaseline({
          surfaces: todasPresentes(),
          claims: dictamenesVerificados([
            { criterionId: 'CRIT-FOCO', status: 'verificado', checks: [], note: 'se ve bien' },
          ]),
        }),
      ).toThrowError(
        expect.objectContaining({ code: 'VERIFICADO_SIN_CHECK' }) as unknown as Error,
      );
    });

    it('con check declarado, pasa', () => {
      const report = buildAccessibilityBaseline({
        surfaces: todasPresentes(),
        claims: dictamenesVerificados(),
      });
      expect(report.verified).toHaveLength(A11Y_CRITERION_IDS.length);
      expect(report.notVerified).toHaveLength(0);
    });
  });

  describe('un criterio sin su superficie no puede estar verificado', () => {
    it('lanza aunque traiga check: el silencio de axe no es una verificación', () => {
      expect(() =>
        buildAccessibilityBaseline({
          surfaces: SUPERFICIES_HOY,
          claims: dictamenesVerificados([
            {
              criterionId: 'CRIT-ESCENA-DOM',
              status: 'verificado',
              checks: ['ci:a11y:baseline#escena'],
              note: '',
            },
          ]),
        }),
      ).toThrowError(
        expect.objectContaining({ code: 'VERIFICADO_SIN_SUPERFICIE' }) as unknown as Error,
      );
    });

    it('declarado «no verificado» con motivo, entra en el informe y dice qué falta', () => {
      const report = buildAccessibilityBaseline({
        surfaces: SUPERFICIES_HOY,
        claims: dictamenesVerificados([
          {
            criterionId: 'CRIT-ESCENA-DOM',
            status: 'no_verificado',
            checks: [],
            note: 'el pizarrón no está montado en la vista (T-H8-03 dejó sólo el adaptador)',
          },
          {
            criterionId: 'CRIT-ARRASTRE',
            status: 'no_verificado',
            checks: [],
            note: 'sin pizarrón no hay gesto de arrastre que ofrecer alternativa',
          },
          {
            criterionId: 'CRIT-OVERLAY',
            status: 'no_verificado',
            checks: [],
            note: 'la capa de anotaciones no se renderiza todavía',
          },
        ]),
      });
      expect(report.notVerified).toContain('CRIT-ESCENA-DOM');
      const escena = report.rulings.find((r) => r.criterionId === 'CRIT-ESCENA-DOM');
      expect(escena?.missingSurfaces).toStrictEqual(['pizarron']);
    });
  });

  describe('el informe se niega a estar incompleto', () => {
    it('un criterio sin dictamen lanza, en vez de desaparecer del informe', () => {
      const claims = dictamenesVerificados().filter((c) => c.criterionId !== 'CRIT-NOTACION');
      expect(() =>
        buildAccessibilityBaseline({ surfaces: todasPresentes(), claims }),
      ).toThrowError(
        expect.objectContaining({ code: 'CRITERIO_SIN_DICTAMEN' }) as unknown as Error,
      );
    });

    it('una superficie sin declarar lanza', () => {
      const surfaces = todasPresentes().filter((s) => s.surface !== 'pizarron');
      expect(() =>
        buildAccessibilityBaseline({ surfaces, claims: dictamenesVerificados() }),
      ).toThrowError(
        expect.objectContaining({ code: 'SUPERFICIE_SIN_DECLARAR' }) as unknown as Error,
      );
    });

    it('dos dictámenes del mismo criterio lanzan', () => {
      const claims = [
        ...dictamenesVerificados(),
        { criterionId: 'CRIT-FOCO', status: 'no_verificado', checks: [], note: 'x' } as A11yClaim,
      ];
      expect(() =>
        buildAccessibilityBaseline({ surfaces: todasPresentes(), claims }),
      ).toThrowError(
        expect.objectContaining({ code: 'DICTAMEN_DUPLICADO' }) as unknown as Error,
      );
    });

    it('«no verificado» o «excepción» sin motivo lanzan', () => {
      for (const status of ['no_verificado', 'excepcion'] as const) {
        expect(() =>
          buildAccessibilityBaseline({
            surfaces: todasPresentes(),
            claims: dictamenesVerificados([
              { criterionId: 'CRIT-ARRASTRE', status, checks: [], note: '   ' },
            ]),
          }),
        ).toThrowError(
          expect.objectContaining({ code: 'MOTIVO_AUSENTE' }) as unknown as Error,
        );
      }
    });

    it('un criterio o una superficie fuera de la lista cerrada lanzan', () => {
      expect(() =>
        buildAccessibilityBaseline({
          surfaces: todasPresentes(),
          claims: [
            ...dictamenesVerificados(),
            { criterionId: 'CRIT-INVENTADO', status: 'verificado', checks: ['x'], note: '' } as unknown as A11yClaim,
          ],
        }),
      ).toThrowError(
        expect.objectContaining({ code: 'CRITERIO_DESCONOCIDO' }) as unknown as Error,
      );

      expect(() =>
        buildAccessibilityBaseline({
          surfaces: [
            ...todasPresentes(),
            { surface: 'holograma', present: true, detail: '' } as unknown as SurfacePresence,
          ],
          claims: dictamenesVerificados(),
        }),
      ).toThrowError(
        expect.objectContaining({ code: 'SUPERFICIE_DESCONOCIDA' }) as unknown as Error,
      );
    });
  });

  it('el error lleva código, no sólo texto', () => {
    try {
      buildAccessibilityBaseline({ surfaces: todasPresentes(), claims: [] });
      expect.unreachable('debía lanzar');
    } catch (error) {
      expect(error).toBeInstanceOf(A11yBaselineError);
      expect((error as A11yBaselineError).code).toBe('CRITERIO_SIN_DICTAMEN');
    }
  });
});

describe('T-H8-10 — registro de ayudas técnicas', () => {
  const REGISTRO: AssistiveTechnologyRecord = {
    participantId: 'p-1',
    recordedAt: '2026-08-29',
    technologies: [],
  };

  it('sin registro no se puede descartar la barrera: nadie preguntó', () => {
    const ruling = canRuleOutAccessibilityBarrier(undefined);
    expect(ruling.canRuleOut).toBe(false);
    expect(ruling.canRuleOut === false && ruling.reason).toBe('sin_registro');
  });

  it('lista vacía sí descarta: es una respuesta, no una ausencia', () => {
    const ruling = canRuleOutAccessibilityBarrier(REGISTRO);
    expect(ruling.canRuleOut).toBe(true);
  });

  it('ausente y «ninguna» no dan el mismo dictamen', () => {
    // Es la distinción entera del módulo: si estos dos coincidieran, «no había
    // barrera» y «no miramos» serían el mismo dato.
    const sinRegistro = canRuleOutAccessibilityBarrier(undefined);
    const declaroNinguna = canRuleOutAccessibilityBarrier(REGISTRO);
    expect(sinRegistro.canRuleOut).not.toBe(declaroNinguna.canRuleOut);
  });

  it('con ayudas declaradas no se descarta de oficio, y se dice cuáles', () => {
    const ruling = canRuleOutAccessibilityBarrier({
      ...REGISTRO,
      technologies: [{ kind: 'lector_de_pantalla', name: 'NVDA 2025.1', notes: '' }],
    });
    expect(ruling.canRuleOut).toBe(false);
    expect(ruling.canRuleOut === false && ruling.reason).toBe('ayudas_declaradas');
    expect(
      ruling.canRuleOut === false && ruling.reason === 'ayudas_declaradas' && ruling.technologies,
    ).toStrictEqual(['lector_de_pantalla']);
  });
});
