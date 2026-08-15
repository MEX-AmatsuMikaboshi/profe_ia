import { describe, expect, it } from 'vitest';
import {
  attributionDenominator,
  buildExtraction,
  buildSelectionManifest,
  CLAIM_TYPES,
  ClaimTypeViolationError,
  DuplicateExtractionIdError,
  EXTRACTION_SECTIONS,
  IncompleteExtractionError,
  ingestCorpus,
  saturationReport,
  sha256Hex,
  traceToSources,
  UnanchoredExtractionError,
  type ExtractionInput,
  type IngestedCorpus,
  type IngestionInput,
} from '../src/index.js';

const CONTENIDO_CALGARY = 'Capitulo 3. Reglas basicas de la deduccion natural.';
const CONTENIDO_OCW = 'Notas de clase del MIT sobre subpruebas y descarga.';

const TEXTO_CONJ_I = '∧I: de φ y de ψ se sigue φ∧ψ.';
const TEXTO_CONJ_E = '∧E: de φ∧ψ se sigue φ, y también ψ.';
const TEXTO_OCW = 'Una subprueba se cierra al descargar su supuesto.';

/** Corpus ingerido con dos componentes distintos, que es lo que exige el consenso. */
function corpusDeDosFuentes(overrides: Partial<IngestionInput> = {}): IngestedCorpus {
  const manifest = buildSelectionManifest({
    courseId: 'deduccion-natural',
    inventory: [
      {
        sourceComponent: 'calgary-cap-3',
        sourceVersion: 'Fall 2025',
        status: 'autorizado',
        snapshotSha256: sha256Hex(CONTENIDO_CALGARY),
        licenseEvidence: 'CC BY 4.0',
        attributionChain: ['forall x: Calgary'],
      },
      {
        sourceComponent: 'mit-ocw-notas',
        sourceVersion: '2024',
        status: 'autorizado',
        snapshotSha256: sha256Hex(CONTENIDO_OCW),
        licenseEvidence: 'CC BY-NC-SA, compatible declarada',
        attributionChain: ['MIT OpenCourseWare'],
      },
    ],
    licenseVerdicts: [
      {
        sourceComponent: 'calgary-cap-3',
        verdict: { status: 'autorizado', blocked: false, reason: 'CC BY' },
      },
    ],
    scores: [
      {
        sourceComponent: 'calgary-cap-3',
        observations: {
          autoridad: 0.9,
          revision: 0.8,
          estabilidad: 0.8,
          explicitud: 0.9,
          verificabilidad: 0.7,
          cobertura: 0.6,
        },
        scalarAvailable: false,
      },
    ],
    saturation: saturationReport([
      { round: 1, newItems: 5, reviewedItems: 10, lineages: ['calgary', 'ocw'] },
    ]),
    conflicts: [],
    selectionRationale: 'Calgary como ancla, OCW como contraste.',
    authorizableReferences: ['calgary-cap-3@Fall2025'],
  });

  const veredictos = (sourceComponent: string) =>
    (['fuente_documental', 'base_expresiva'] as const).map((intendedUse) => ({
      sourceComponent,
      intendedUse,
      verdict: { status: 'autorizado' as const, blocked: false, reason: 'licencia compatible' },
    }));

  return ingestCorpus({
    manifest,
    components: [
      {
        sourceComponent: 'calgary-cap-3',
        sourceVersion: 'Fall 2025',
        origin: 'https://forallx.openlogicproject.org/',
        notationFamily: 'fitch-forallx',
        content: CONTENIDO_CALGARY,
        sections: [
          { location: 'p. 41', kind: 'regla', text: TEXTO_CONJ_I, relatedConcepts: ['KC04'] },
          { location: 'p. 42', kind: 'regla', text: TEXTO_CONJ_E, relatedConcepts: ['KC05'] },
        ],
      },
      {
        sourceComponent: 'mit-ocw-notas',
        sourceVersion: '2024',
        origin: 'https://ocw.mit.edu/',
        notationFamily: 'fitch-forallx',
        content: CONTENIDO_OCW,
        sections: [
          { location: 'leccion 4', kind: 'nota', text: TEXTO_OCW, relatedConcepts: ['KC08'] },
        ],
      },
    ],
    authorizedNotationFamily: 'fitch-forallx',
    candidateKcs: ['KC04', 'KC05', 'KC08'],
    requiredSections: [{ sourceComponent: 'calgary-cap-3', location: 'p. 41' }],
    useVerdicts: [...veredictos('calgary-cap-3'), ...veredictos('mit-ocw-notas')],
    ...overrides,
  });
}

const CORPUS = corpusDeDosFuentes();

const ANCLA_CONJ_I = {
  fragmentId: 'calgary-cap-3@Fall 2025#p. 41',
  fragmentSha256: sha256Hex(TEXTO_CONJ_I),
};
const ANCLA_CONJ_E = {
  fragmentId: 'calgary-cap-3@Fall 2025#p. 42',
  fragmentSha256: sha256Hex(TEXTO_CONJ_E),
};
const ANCLA_OCW = {
  fragmentId: 'mit-ocw-notas@2024#leccion 4',
  fragmentSha256: sha256Hex(TEXTO_OCW),
};

function entrada(overrides: Partial<ExtractionInput> = {}): ExtractionInput {
  return {
    items: [
      {
        itemId: 'regla-conj-i',
        section: 'rules',
        statement: 'Introducción de conjunción.',
        anchors: [ANCLA_CONJ_I],
      },
      {
        itemId: 'notacion-fitch',
        section: 'notation',
        statement: 'Las líneas se citan por número.',
        anchors: [ANCLA_OCW],
      },
    ],
    claims: [
      {
        claimId: 'claim-conj-i',
        claimType: 'source_assertion',
        statement: 'De φ y ψ se sigue φ∧ψ.',
        anchors: [ANCLA_CONJ_I],
        supportingClaims: [],
      },
      {
        claimId: 'claim-consenso',
        claimType: 'cross_source_consensus',
        statement: 'Las subpruebas se cierran al descargar el supuesto.',
        anchors: [ANCLA_CONJ_E, ANCLA_OCW],
        supportingClaims: [],
      },
      {
        claimId: 'claim-inferido',
        claimType: 'system_inference',
        statement: 'El cálculo no admite conmutatividad automática.',
        anchors: [],
        supportingClaims: ['claim-conj-i'],
      },
    ],
    curricularDecisions: [
      {
        decisionId: 'dec-orden-kc',
        statement: 'KC04 se enseña antes que KC05.',
        supportingClaims: ['claim-conj-i'],
        justification: 'La eliminación presupone haber construido la conjunción.',
      },
    ],
    ...overrides,
  };
}

describe('W2 — extracción curricular, Rol A (T-H5-02 ← P-I §7.11)', () => {
  it('las dos listas cerradas son las literales', () => {
    expect(EXTRACTION_SECTIONS).toEqual([
      'definitions',
      'notation',
      'rules',
      'restrictions',
      'claims',
    ]);
    expect(CLAIM_TYPES).toEqual([
      'source_assertion',
      'cross_source_consensus',
      'system_inference',
    ]);
  });

  it('construye la extracción y hereda el curso del corpus ingerido', () => {
    const extraccion = buildExtraction(CORPUS, entrada());

    expect(extraccion.extractionVersion).toBe('w2-extraction-v1');
    expect(extraccion.courseId).toBe('deduccion-natural');
    expect(extraccion.claims).toHaveLength(3);
  });

  it('una extracción sin claims es «no se extrajo», no «no había nada»', () => {
    expect(() => buildExtraction(CORPUS, entrada({ claims: [] }))).toThrow(
      IncompleteExtractionError,
    );
  });
});

describe('anclaje estructural determinista', () => {
  it('un fragmento inexistente es una cita inventada', () => {
    const inventado = entrada({
      items: [
        {
          itemId: 'regla-fantasma',
          section: 'rules',
          statement: 'Regla que nadie escribió.',
          anchors: [{ fragmentId: 'calgary-cap-3@Fall 2025#p. 99', fragmentSha256: 'a'.repeat(64) }],
        },
      ],
    });

    expect(() => buildExtraction(CORPUS, inventado)).toThrow(UnanchoredExtractionError);
    expect(() => buildExtraction(CORPUS, inventado)).toThrow(/cita inventada/);
  });

  it('un hash que no cuadra es un ancla que envejeció', () => {
    // Sin comprobar el hash, el ancla seguiría pareciendo válida sobre un texto
    // que ya no dice eso.
    const viejo = entrada({
      claims: [
        {
          claimId: 'claim-conj-i',
          claimType: 'source_assertion',
          statement: 'De φ y ψ se sigue φ∧ψ.',
          anchors: [{ ...ANCLA_CONJ_I, fragmentSha256: sha256Hex('texto anterior') }],
          supportingClaims: [],
        },
      ],
    });

    expect(() => buildExtraction(CORPUS, viejo)).toThrow(UnanchoredExtractionError);
    expect(() => buildExtraction(CORPUS, viejo)).toThrow(/envejeció/);
  });

  it('no se cita como autoridad lo que W0 no permite como fuente documental', () => {
    // Es alcanzable: los veredictos son dato de W0 y W1 los transporta sin
    // recalcularlos (T-H5-01). Atribuir una afirmación a material no citable
    // fabricaría la cadena de atribución.
    const corpusSinPermiso = corpusDeDosFuentes({
      useVerdicts: [
        {
          sourceComponent: 'calgary-cap-3',
          intendedUse: 'base_expresiva',
          verdict: { status: 'autorizado', blocked: false, reason: 'CC BY' },
        },
        {
          sourceComponent: 'mit-ocw-notas',
          intendedUse: 'fuente_documental',
          verdict: { status: 'autorizado', blocked: false, reason: 'compatible' },
        },
      ],
      candidateKcs: ['KC08'],
      requiredSections: [{ sourceComponent: 'mit-ocw-notas', location: 'leccion 4' }],
    });

    const soloOcw = entrada({
      items: [],
      claims: [
        {
          claimId: 'claim-conj-i',
          claimType: 'source_assertion',
          statement: 'De φ y ψ se sigue φ∧ψ.',
          anchors: [ANCLA_CONJ_I],
          supportingClaims: [],
        },
      ],
      curricularDecisions: [],
    });

    expect(() => buildExtraction(corpusSinPermiso, soloOcw)).toThrow(UnanchoredExtractionError);
    expect(() => buildExtraction(corpusSinPermiso, soloOcw)).toThrow(/cadena de atribución/);
  });

  it('un elemento sin ninguna referencia no consta de dónde salió', () => {
    const sinAncla = entrada({
      items: [
        { itemId: 'definicion-suelta', section: 'definitions', statement: 'Algo.', anchors: [] },
      ],
    });

    expect(() => buildExtraction(CORPUS, sinAncla)).toThrow(UnanchoredExtractionError);
  });

  it('ids repetidos bifurcan la cadena de §7.11', () => {
    const repetido = entrada({
      items: [
        {
          itemId: 'claim-conj-i',
          section: 'rules',
          statement: 'Choca con el id de un claim.',
          anchors: [ANCLA_CONJ_I],
        },
      ],
    });

    expect(() => buildExtraction(CORPUS, repetido)).toThrow(DuplicateExtractionIdError);
  });
});

describe('el tipo de claim se comprueba, no se declara', () => {
  it('`source_assertion` sin cita no tiene contra qué verificarse', () => {
    const sinCita = entrada({
      claims: [
        {
          claimId: 'claim-suelto',
          claimType: 'source_assertion',
          statement: 'Lo dice alguna fuente.',
          anchors: [],
          supportingClaims: [],
        },
      ],
      curricularDecisions: [],
    });

    expect(() => buildExtraction(CORPUS, sinCita)).toThrow(ClaimTypeViolationError);
  });

  it('`cross_source_consensus` con dos fragmentos de la MISMA obra no es consenso', () => {
    // Es el caso fino: hay dos anclas, así que un conteo de anclas lo daría por
    // bueno. Dos fragmentos de la misma obra son una sola fuente.
    const falsoConsenso = entrada({
      claims: [
        {
          claimId: 'claim-falso-consenso',
          claimType: 'cross_source_consensus',
          statement: 'Coincide consigo mismo.',
          anchors: [ANCLA_CONJ_I, ANCLA_CONJ_E],
          supportingClaims: [],
        },
      ],
      curricularDecisions: [],
    });

    expect(() => buildExtraction(CORPUS, falsoConsenso)).toThrow(ClaimTypeViolationError);
    expect(() => buildExtraction(CORPUS, falsoConsenso)).toThrow(/una sola fuente/);
  });

  it('`cross_source_consensus` con dos obras distintas sí pasa', () => {
    expect(() => buildExtraction(CORPUS, entrada())).not.toThrow();
  });

  it('`system_inference` que cita una fuente sería una aserción disfrazada', () => {
    // Etiquetarla como inferencia la sacaría del denominador de atribución sin
    // que nadie tocara la métrica.
    const disfrazada = entrada({
      claims: [
        {
          claimId: 'claim-conj-i',
          claimType: 'source_assertion',
          statement: 'De φ y ψ se sigue φ∧ψ.',
          anchors: [ANCLA_CONJ_I],
          supportingClaims: [],
        },
        {
          claimId: 'claim-inferido',
          claimType: 'system_inference',
          statement: 'Se infiere, pero cita.',
          anchors: [ANCLA_CONJ_E],
          supportingClaims: ['claim-conj-i'],
        },
      ],
      curricularDecisions: [],
    });

    expect(() => buildExtraction(CORPUS, disfrazada)).toThrow(ClaimTypeViolationError);
    expect(() => buildExtraction(CORPUS, disfrazada)).toThrow(/denominador de atribución/);
  });

  it('`system_inference` sin claims de soporte no tiene trazabilidad que evaluar', () => {
    const sinSoporte = entrada({
      claims: [
        {
          claimId: 'claim-inferido',
          claimType: 'system_inference',
          statement: 'Sale de la nada.',
          anchors: [],
          supportingClaims: [],
        },
      ],
      curricularDecisions: [],
    });

    expect(() => buildExtraction(CORPUS, sinSoporte)).toThrow(ClaimTypeViolationError);
  });

  it('un claim que se apoya en sí mismo no se sostiene', () => {
    const circular = entrada({
      claims: [
        {
          claimId: 'claim-inferido',
          claimType: 'system_inference',
          statement: 'Se infiere de sí mismo.',
          anchors: [],
          supportingClaims: ['claim-inferido'],
        },
      ],
      curricularDecisions: [],
    });

    expect(() => buildExtraction(CORPUS, circular)).toThrow(ClaimTypeViolationError);
  });

  it('un soporte que no existe rompe la cadena', () => {
    const huerfano = entrada({
      claims: [
        {
          claimId: 'claim-inferido',
          claimType: 'system_inference',
          statement: 'Se apoya en un fantasma.',
          anchors: [],
          supportingClaims: ['claim-que-no-existe'],
        },
      ],
      curricularDecisions: [],
    });

    expect(() => buildExtraction(CORPUS, huerfano)).toThrow(UnanchoredExtractionError);
  });
});

describe('las decisiones pedagógicas van aparte (§7.11)', () => {
  it('no viven en la lista de claims', () => {
    // Mezcladas, una decisión nuestra se leería como algo que la fuente afirma.
    const extraccion = buildExtraction(CORPUS, entrada());

    expect(extraccion.claims.map((c) => c.claimId)).not.toContain('dec-orden-kc');
    expect(extraccion.curricularDecisions).toHaveLength(1);
  });

  it('una decisión sin soporte no se distingue de una preferencia', () => {
    const sinSoporte = entrada({
      curricularDecisions: [
        {
          decisionId: 'dec-suelta',
          statement: 'Se enseña así porque sí.',
          supportingClaims: [],
          justification: 'Parece razonable.',
        },
      ],
    });

    expect(() => buildExtraction(CORPUS, sinSoporte)).toThrow(IncompleteExtractionError);
  });

  it('una decisión sin justificación tampoco pasa', () => {
    const sinJustificar = entrada({
      curricularDecisions: [
        {
          decisionId: 'dec-suelta',
          statement: 'KC04 antes que KC05.',
          supportingClaims: ['claim-conj-i'],
          justification: '   ',
        },
      ],
    });

    expect(() => buildExtraction(CORPUS, sinJustificar)).toThrow(IncompleteExtractionError);
  });

  it('una decisión apoyada en un claim inexistente rompe la cadena', () => {
    const huerfana = entrada({
      curricularDecisions: [
        {
          decisionId: 'dec-suelta',
          statement: 'KC04 antes que KC05.',
          supportingClaims: ['claim-que-no-existe'],
          justification: 'Porque sí.',
        },
      ],
    });

    expect(() => buildExtraction(CORPUS, huerfana)).toThrow(UnanchoredExtractionError);
  });
});

describe('denominador de atribución y trazabilidad', () => {
  it('`system_inference` queda fuera del denominador, no contado como fallo', () => {
    // Literal de §7.11. Contarlo como fallo castigaría al sistema por razonar
    // bien: no se le puede exigir atribuibilidad a una fuente a algo que ninguna
    // fuente afirma.
    const extraccion = buildExtraction(CORPUS, entrada());
    const denominador = attributionDenominator(extraccion);

    expect(denominador.map((c) => c.claimId)).toEqual(['claim-conj-i', 'claim-consenso']);
    expect(denominador.map((c) => c.claimType)).not.toContain('system_inference');
  });

  it('la traza de un claim de fuente llega a su fragmento', () => {
    const extraccion = buildExtraction(CORPUS, entrada());

    expect(traceToSources(extraccion, 'claim-conj-i')).toEqual(['calgary-cap-3@Fall 2025#p. 41']);
  });

  it('la traza de una inferencia llega a las fuentes de sus soportes', () => {
    // Sin este recorrido, «se evalúa por su propia trazabilidad» no sería
    // comprobable: la inferencia no tiene anclas propias.
    const extraccion = buildExtraction(CORPUS, entrada());

    expect(traceToSources(extraccion, 'claim-inferido')).toEqual([
      'calgary-cap-3@Fall 2025#p. 41',
    ]);
  });

  it('la traza es determinista: mismo claim, mismo orden', () => {
    const extraccion = buildExtraction(CORPUS, entrada());

    expect(traceToSources(extraccion, 'claim-consenso')).toEqual(
      traceToSources(extraccion, 'claim-consenso'),
    );
    expect(traceToSources(extraccion, 'claim-consenso')).toEqual([
      'calgary-cap-3@Fall 2025#p. 42',
      'mit-ocw-notas@2024#leccion 4',
    ]);
  });
});
