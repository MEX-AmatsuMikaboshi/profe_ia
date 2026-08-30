import { describe, expect, it } from 'vitest';
import {
  beginPreparation,
  createCourse,
  isRetryable,
  messageText,
  preparationView,
  type Course,
  type CourseEnvelope,
} from '@profesor-ia/domain-engine';
import {
  GeneralizedW0LaneError,
  IncompleteW0RunError,
  OpenSearchNotComplementError,
  runGeneralizedW0,
  runW0,
  SourceNotWhitelistedError,
  generalizedScope,
  type Candidate,
  type GeneralizedSourceEvaluation,
  type GeneralizedW0Input,
} from '../src/index.js';

/**
 * W0 generalizado (T-CC-02). El fixture es una materia que **no** tiene sistema
 * formal —historia—, porque es el caso que la corrida experimental no puede
 * atender y el que justifica que exista este módulo.
 */

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);

const OBSERVACIONES = {
  autoridad: 0.9,
  revision: 0.8,
  estabilidad: 0.7,
  explicitud: 0.9,
  verificabilidad: 0.8,
  cobertura: 0.6,
} as const;

const SOBRE: CourseEnvelope = {
  subject: 'Revolución mexicana',
  topic: 'Causas y primera fase (1910-1913)',
  level: 'bachillerato',
  personalGoal: 'Entender por qué empezó, no memorizar fechas',
};

function candidato(
  sourceId: string,
  accessMode: Candidate['accessMode'],
  url: string,
  sha: string,
): Candidate {
  return {
    sourceId,
    accessMode,
    record: {
      url,
      origin: `Repositorio de ${sourceId}`,
      version: 'v2026-01',
      retrievedAt: '2026-08-30T00:00:00.000Z',
      licenseEvidence: `Página de licencia de ${sourceId}, consultada 2026-08-30`,
      snapshotSha256: sha,
    },
  };
}

function evaluacion(
  candidateUrl: string,
  sourceComponent: string,
  overrides: Partial<GeneralizedSourceEvaluation> = {},
): GeneralizedSourceEvaluation {
  return {
    candidateUrl,
    sourceComponent,
    observations: OBSERVACIONES,
    licenseRecord: {
      sourceComponent,
      sourceVersion: 'v2026-01',
      provenanceBasis: `Descargado de ${candidateUrl}`,
      licenseEvidence: 'CC BY 4.0, texto de la licencia archivado',
      terms: {
        licenseId: 'CC-BY-4.0',
        nonCommercial: false,
        shareAlike: false,
        noDerivatives: false,
        thirdPartyPermissionOnly: false,
      },
    },
    attributionChain: ['Autor original', 'Repositorio'],
    ...overrides,
  };
}

/** Una materia propia recién puesta a investigar, como la deja `beginPreparation`. */
function materiaEnInvestigacion(): Course {
  const curso = createCourse({
    courseId: 'revolucion-mexicana',
    courseType: 'CUSTOM_COURSE_UNVALIDATED',
    title: 'Revolución mexicana',
  });
  return beginPreparation(curso, SOBRE);
}

function fixture(): GeneralizedW0Input {
  return {
    course: materiaEnInvestigacion(),
    whitelist: [
      {
        sourceId: 'unam-historia',
        name: 'UNAM · Instituto de Investigaciones Históricas',
        accessMode: 'api',
        baseUrl: 'https://example.test/unam',
      },
      {
        sourceId: 'inehrm',
        name: 'INEHRM',
        accessMode: 'indice_estable',
        baseUrl: 'https://example.test/inehrm',
      },
    ],
    candidates: [
      candidato('unam-historia', 'api', 'https://example.test/unam/revolucion', SHA_A),
      candidato('inehrm', 'indice_estable', 'https://example.test/inehrm/1910', SHA_B),
      candidato('blog-ajeno', 'busqueda_abierta', 'https://example.test/blog/notas', SHA_C),
    ],
    discoveryRounds: [
      { round: 1, newItems: 2, reviewedItems: 2, lineages: ['unam', 'inehrm'] },
      { round: 2, newItems: 1, reviewedItems: 3, lineages: ['notas-blog'] },
    ],
    evaluations: [
      evaluacion('https://example.test/unam/revolucion', 'unam/revolucion'),
      evaluacion('https://example.test/inehrm/1910', 'inehrm/1910'),
      evaluacion('https://example.test/blog/notas', 'blog/notas'),
    ],
    licenseQuery: { intendedUse: 'base_expresiva' },
    selectionRationale:
      'Dos fuentes institucionales cubren el periodo con licencia preferida; la de búsqueda ' +
      'abierta complementa cronología. Ningún escalar interviene.',
  };
}

describe('W0 generalizado (T-CC-02 ← DEC-CUSTOM-COURSES-001, P-I §3.1.2)', () => {
  it('deja la materia en proposal_ready con propuesta y los dos artefactos', () => {
    const result = runGeneralizedW0(fixture());

    expect(result.course.preparation).toBe('proposal_ready');
    expect(result.message).toBe('proposal_ready');
    expect(result.proposal).not.toBeNull();
    expect(result.artifacts.map((a) => a.kind)).toEqual(['sources_found', 'course_proposal']);
    expect(result.proposal?.usableReferences).toHaveLength(3);
  });

  it('es determinista: dos corridas y un viaje por JSON dan lo mismo', () => {
    const input = fixture();
    const primera = runGeneralizedW0(input);
    const segunda = runGeneralizedW0(input);
    const rehidratada = runGeneralizedW0(JSON.parse(JSON.stringify(input)) as GeneralizedW0Input);

    expect(JSON.stringify(segunda)).toBe(JSON.stringify(primera));
    expect(JSON.stringify(rehidratada)).toBe(JSON.stringify(primera));
  });

  // ─────────── la separación de carriles, que es el punto de la tarea ───────────

  it('rechaza el curso experimental: su corpus no sale de aquí', () => {
    const logica = createCourse({
      courseId: 'deduccion-natural-u1',
      courseType: 'VALIDATED_LOGIC_COURSE',
      title: 'Deducción natural',
    });
    expect(() => runGeneralizedW0({ ...fixture(), course: logica })).toThrow(GeneralizedW0LaneError);
  });

  it('la propuesta no es un manifiesto de selección: ni conflictos ni referencias autorizables', () => {
    const { proposal } = runGeneralizedW0(fixture());

    // Lo que **no** tiene es lo que impide confundirla con el corpus congelable.
    expect(proposal?.proposalVersion).toBe('generalized-course-proposal-v1');
    expect(proposal).not.toHaveProperty('conflicts');
    expect(proposal).not.toHaveProperty('authorizableReferences');
    expect(proposal).not.toHaveProperty('manifestVersion');
  });

  it('el alcance generalizado no tiene dónde declarar un sistema formal', () => {
    const scope = generalizedScope(SOBRE);

    expect(scope).toEqual({
      subject: 'Revolución mexicana',
      topic: 'Causas y primera fase (1910-1913)',
    });
    expect(scope).not.toHaveProperty('formalSystemId');
  });

  it('y la guarda simétrica sigue puesta: la corrida experimental exige su cálculo', () => {
    // Control positivo del otro lado. Sin esto, la prueba de arriba podría
    // pasar con `runW0` aceptando cualquier cosa.
    expect(() =>
      runW0({
        courseId: 'revolucion-mexicana',
        scope: { formalSystemId: 'ninguno', topic: 'Revolución mexicana' },
        whitelist: [],
        candidates: [],
        discoveryRounds: [],
        evaluations: [],
        licenseQuery: { intendedUse: 'base_expresiva' },
        selectionRationale: 'x',
      }),
    ).toThrow(/authorized-calculus-v1|forallx/);
  });

  // ─────────────────────── el enganche con la preparación ───────────────────────

  it('sin fuentes usables cae a failed con no_sources_found, que no es reintentable', () => {
    const input = fixture();
    const sinLicencia = input.evaluations.map((e) =>
      evaluacion(e.candidateUrl, e.sourceComponent, {
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
      }),
    );
    const result = runGeneralizedW0({ ...input, evaluations: sinLicencia });

    expect(result.course.preparation).toBe('failed');
    expect(result.message).toBe('no_sources_found');
    expect(result.proposal).toBeNull();
    expect(isRetryable(result.message)).toBe(false);
    // Declara lo hallado aunque no sirva: «encontré esto y no me vale» no es
    // «no encontré nada».
    expect(result.artifacts.map((a) => a.kind)).toEqual(['sources_found']);
  });

  it('la vista de preparación se arma del resultado sin que nadie recuerde mover el estado', () => {
    const result = runGeneralizedW0(fixture());
    const vista = preparationView({
      course: result.course,
      artifacts: result.artifacts,
      lastMessage: result.message,
    });

    expect(vista.state).toBe('proposal_ready');
    expect(vista.lastMessageText).toBe(messageText('proposal_ready'));
    expect(vista.retryable).toBe(false);
    expect(vista.artifacts).toHaveLength(2);
  });

  // ───────────────────────── coherencia de la entrada ─────────────────────────

  it('no corre fuera de researching', () => {
    const enBorrador = createCourse({
      courseId: 'revolucion-mexicana',
      courseType: 'CUSTOM_COURSE_UNVALIDATED',
      title: 'Revolución mexicana',
      envelope: SOBRE,
    });
    expect(() => runGeneralizedW0({ ...fixture(), course: enBorrador })).toThrow(
      IncompleteW0RunError,
    );

    const yaPropuesto = runGeneralizedW0(fixture()).course;
    expect(() => runGeneralizedW0({ ...fixture(), course: yaPropuesto })).toThrow(
      IncompleteW0RunError,
    );
  });

  it('no corre sin sobre', () => {
    const sinSobre: Course = {
      courseId: 'x',
      courseType: 'CUSTOM_COURSE_UNVALIDATED',
      title: 'X',
      preparation: 'researching',
    };
    expect(() => runGeneralizedW0({ ...fixture(), course: sinSobre })).toThrow(
      IncompleteW0RunError,
    );
  });

  it('exige la correspondencia candidato↔evaluación en los dos sentidos', () => {
    const input = fixture();

    const sinEvaluar = { ...input, evaluations: input.evaluations.slice(0, 2) };
    expect(() => runGeneralizedW0(sinEvaluar)).toThrow(IncompleteW0RunError);

    const huerfana = {
      ...input,
      evaluations: [...input.evaluations, evaluacion('https://example.test/nadie', 'nadie')],
    };
    expect(() => runGeneralizedW0(huerfana)).toThrow(IncompleteW0RunError);

    const duplicada = {
      ...input,
      evaluations: [...input.evaluations, evaluacion('https://example.test/unam/revolucion', 'otro')],
    };
    expect(() => runGeneralizedW0(duplicada)).toThrow(IncompleteW0RunError);
  });

  it('mantiene las reglas de descubrimiento de §7.0, que sí son generalizables', () => {
    const input = fixture();

    const colado = {
      ...input,
      candidates: [...input.candidates, candidato('desconocida', 'api', 'https://x.test/a', SHA_A)],
    };
    expect(() => runGeneralizedW0(colado)).toThrow(SourceNotWhitelistedError);

    const soloAbiertos = {
      ...input,
      candidates: [
        candidato('blog-ajeno', 'busqueda_abierta', 'https://example.test/blog/notas', SHA_C),
      ],
      evaluations: [evaluacion('https://example.test/blog/notas', 'blog/notas')],
    };
    expect(() => runGeneralizedW0(soloAbiertos)).toThrow(OpenSearchNotComplementError);
  });

  it('exige justificación de selección', () => {
    expect(() => runGeneralizedW0({ ...fixture(), selectionRationale: '   ' })).toThrow(
      IncompleteW0RunError,
    );
  });

  it('no calcula el escalar de idoneidad: lo declara ausente (CAL-SOURCE-SCORE)', () => {
    const { proposal } = runGeneralizedW0(fixture());
    expect(proposal?.scores.every((s) => s.scalarAvailable === false)).toBe(true);
    expect(proposal?.saturation.stopDecisionAvailable).toBe(false);
  });
});
