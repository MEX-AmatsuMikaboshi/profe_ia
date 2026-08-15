import { describe, expect, it } from 'vitest';
import {
  buildSelectionManifest,
  CORPUS_BLOCK_REASONS,
  CorpusBlockedError,
  CorpusDriftError,
  fragmentId,
  IllegibleFragmentError,
  IncompleteIngestionInputError,
  ingestCorpus,
  legibilityFault,
  saturationReport,
  sha256Hex,
  UnauthorizedComponentError,
  type Fragment,
  type IngestedCorpus,
  type IngestionInput,
  type LoadedComponent,
  type SelectionManifestInput,
} from '../src/index.js';

const CONTENIDO_CALGARY = 'Capitulo 3. Reglas basicas de la deduccion natural.';
const CONTENIDO_OCW = 'Notas de clase sobre subpruebas.';

const SECCIONES_CALGARY = [
  {
    location: 'p. 41',
    kind: 'regla',
    text: '∧I: de φ y de ψ se sigue φ∧ψ.',
    relatedConcepts: ['KC04'],
  },
  {
    location: 'p. 42',
    kind: 'regla',
    text: '∧E: de φ∧ψ se sigue φ, y también ψ.',
    relatedConcepts: ['KC05'],
  },
] as const;

function componente(overrides: Partial<LoadedComponent> = {}): LoadedComponent {
  return {
    sourceComponent: 'calgary-cap-3',
    sourceVersion: 'Fall 2025',
    origin: 'https://forallx.openlogicproject.org/ — Open Logic Project',
    notationFamily: 'fitch-forallx',
    content: CONTENIDO_CALGARY,
    sections: [...SECCIONES_CALGARY],
    ...overrides,
  };
}

function manifiesto(overrides: Partial<SelectionManifestInput> = {}) {
  return buildSelectionManifest({
    courseId: 'deduccion-natural',
    inventory: [
      {
        sourceComponent: 'calgary-cap-3',
        sourceVersion: 'Fall 2025',
        status: 'autorizado',
        snapshotSha256: sha256Hex(CONTENIDO_CALGARY),
        licenseEvidence: 'CC BY 4.0, pagina de creditos',
        attributionChain: ['forall x: Calgary', 'Open Logic Project'],
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
      { round: 1, newItems: 5, reviewedItems: 10, lineages: ['calgary'] },
    ]),
    conflicts: [],
    selectionRationale: 'Calgary cubre el cálculo objetivo.',
    authorizableReferences: ['calgary-cap-3@Fall2025'],
    ...overrides,
  });
}

function entrada(overrides: Partial<IngestionInput> = {}): IngestionInput {
  return {
    manifest: manifiesto(),
    components: [componente()],
    authorizedNotationFamily: 'fitch-forallx',
    candidateKcs: ['KC04', 'KC05'],
    requiredSections: [{ sourceComponent: 'calgary-cap-3', location: 'p. 41' }],
    useVerdicts: [
      {
        sourceComponent: 'calgary-cap-3',
        intendedUse: 'fuente_documental',
        verdict: { status: 'autorizado', blocked: false, reason: 'CC BY' },
      },
      {
        sourceComponent: 'calgary-cap-3',
        intendedUse: 'base_expresiva',
        verdict: { status: 'autorizado', blocked: false, reason: 'CC BY' },
      },
    ],
    ...overrides,
  };
}

/** Devuelve las causas de bloqueo de una ingesta que debe fallar. */
function causasDeBloqueo(input: IngestionInput): readonly string[] {
  try {
    ingestCorpus(input);
  } catch (error) {
    if (error instanceof CorpusBlockedError) return error.blocks.map((b) => b.reason);
    throw error;
  }
  throw new Error('se esperaba CorpusBlockedError y la ingesta no falló');
}

describe('W1 — ingesta del corpus (T-H5-01 ← §12 «W1», P-III §3.2/§3.3)', () => {
  it('ingiere y produce los siete campos de fragmento de P-III §3.3', () => {
    const corpus = ingestCorpus(entrada());

    expect(corpus.corpusVersion).toBe('w1-corpus-v1');
    expect(corpus.fragments).toHaveLength(2);

    const primero = corpus.fragments[0] as Fragment;
    expect(primero.fragmentId).toBe('calgary-cap-3@Fall 2025#p. 41');
    expect(primero.sourceComponent).toBe('calgary-cap-3');
    expect(primero.location).toBe('p. 41');
    expect(primero.sha256).toBe(sha256Hex(SECCIONES_CALGARY[0].text));
    expect(primero.kind).toBe('regla');
    expect(primero.relatedConcepts).toEqual(['KC04']);
    expect(primero.authorizationStatus).toBe('autorizado');
  });

  it('registra licencia y origen por componente (§12 «W1» paso 3)', () => {
    const corpus = ingestCorpus(entrada());

    expect(corpus.components[0]?.licenseEvidence).toBe('CC BY 4.0, pagina de creditos');
    expect(corpus.components[0]?.origin).toContain('Open Logic Project');
    expect(corpus.components[0]?.snapshotSha256).toBe(sha256Hex(CONTENIDO_CALGARY));
  });
});

describe('identidad con el snapshot de W0 y bloqueo ante deriva', () => {
  it('un byte distinto del evaluado en W0 bloquea la ingesta', () => {
    const derivado = entrada({ components: [componente({ content: `${CONTENIDO_CALGARY} ` })] });

    expect(() => ingestCorpus(derivado)).toThrow(CorpusDriftError);
  });

  it('la salida es reevaluar en W0, no actualizar el hash', () => {
    const derivado = entrada({ components: [componente({ content: 'otra cosa' })] });

    // Si la deriva se resolviera actualizando el snapshot, el registro perdería
    // el hecho de que la fuente cambió después de evaluarse.
    expect(() => ingestCorpus(derivado)).toThrow(/reevaluar en W0/);
  });

  it('la etiqueta de versión también es identidad, no solo los bytes', () => {
    // Con los mismos bytes pero otra versión declarada, el fragment_id citaría
    // una versión que W0 nunca evaluó y el ancla apuntaría a un fantasma.
    const remarcado = entrada({
      components: [componente({ sourceVersion: 'Spring 2026' })],
    });

    expect(() => ingestCorpus(remarcado)).toThrow(CorpusDriftError);
    expect(() => ingestCorpus(remarcado)).toThrow(/versión que nadie evaluó/);
  });

  it('la deriva se detecta antes que cualquier validación de contenido', () => {
    // El mismo material con deriva **y** sin cobertura de KC. Si el orden fuera el
    // contrario, el informe hablaría de la cobertura de un documento que ni
    // siquiera es el que W0 evaluó.
    const ambas = entrada({
      components: [componente({ content: 'otra cosa' })],
      candidateKcs: ['KC04', 'KC05', 'KC13'],
    });

    expect(() => ingestCorpus(ambas)).toThrow(CorpusDriftError);
  });
});

describe('IDs estables (§12 «W1» paso 4)', () => {
  it('dos ingestas del mismo material dan los mismos IDs', () => {
    const a = ingestCorpus(entrada());
    const b = ingestCorpus(entrada());

    expect(a.fragments.map((f) => f.fragmentId)).toEqual(b.fragments.map((f) => f.fragmentId));
  });

  it('añadir una sección no renumera las demás', () => {
    // Es el modo de fallo que un correlativo tendría: insertar al principio
    // desplazaría todos los IDs y rompería cualquier ancla ya emitida.
    const base = ingestCorpus(entrada());

    const conNueva = ingestCorpus(
      entrada({
        components: [
          componente({
            sections: [
              {
                location: 'p. 40',
                kind: 'definicion',
                text: 'Una fórmula bien formada es…',
                relatedConcepts: ['KC01'],
              },
              ...SECCIONES_CALGARY,
            ],
          }),
        ],
        candidateKcs: ['KC01', 'KC04', 'KC05'],
      }),
    );

    for (const anterior of base.fragments) {
      expect(conNueva.fragments.map((f) => f.fragmentId)).toContain(anterior.fragmentId);
    }
  });

  it('el ID es derivable sin preguntarle a W1, que es lo que lo hace ancla', () => {
    const corpus = ingestCorpus(entrada());

    expect(corpus.fragments[1]?.fragmentId).toBe(
      fragmentId('calgary-cap-3', 'Fall 2025', 'p. 42'),
    );
  });
});

describe('validación de legibilidad (§12 «W1» paso 5)', () => {
  it('detecta vacío, carácter de reemplazo y controles no imprimibles', () => {
    expect(legibilityFault('   ')).toContain('vacío');
    expect(legibilityFault(`texto ${String.fromCodePoint(0xfffd)} roto`)).toContain('U+FFFD');
    expect(legibilityFault(`texto ${String.fromCharCode(0x00)} roto`)).toContain('C0');
  });

  it('el texto con tabuladores y saltos de línea es legible', () => {
    // Si contaran como control no imprimible, cualquier fragmento con formato
    // quedaría bloqueado y la validación sería inservible.
    expect(legibilityFault('linea 1\n\tlinea 2\r\n')).toBeNull();
  });

  it('un fragmento ilegible bloquea la ingesta y se nombra por su ID', () => {
    const ilegible = entrada({
      components: [
        componente({
          sections: [{ ...SECCIONES_CALGARY[0], text: `roto ${String.fromCodePoint(0xfffd)}` }],
        }),
        // El contenido no cambia, así que la identidad sigue cuadrando: lo que
        // falla es la legibilidad, no la deriva.
      ],
      candidateKcs: ['KC04'],
    });

    expect(() => ingestCorpus(ilegible)).toThrow(IllegibleFragmentError);
    expect(() => ingestCorpus(ilegible)).toThrow(/calgary-cap-3@Fall 2025#p\. 41/);
  });
});

describe('las seis validaciones de bloqueo de P-III §3.2', () => {
  it('la lista de causas es la literal y está cerrada', () => {
    expect(CORPUS_BLOCK_REASONS).toEqual([
      'reglas_contradictorias_sin_aclaracion',
      'notaciones_incompatibles',
      'kc_candidatos_sin_cobertura',
      'sin_anclaje_por_fragmento',
      'licencia_no_registrada',
      'secciones_faltantes',
    ]);
  });

  it('reglas contradictorias sin aclaración', () => {
    const sinAclarar = entrada({
      manifest: manifiesto({
        conflicts: [
          {
            claim: '¬I e IP son la misma regla',
            differenceClass: 'contradiccion_real',
            resolution: '',
            excludedForeignSystems: [],
          },
        ],
      }),
    });

    expect(causasDeBloqueo(sinAclarar)).toContain('reglas_contradictorias_sin_aclaracion');
  });

  it('una contradicción **aclarada** no bloquea', () => {
    const aclarada = entrada({
      manifest: manifiesto({
        conflicts: [
          {
            claim: '¬I e IP son la misma regla',
            differenceClass: 'contradiccion_real',
            resolution: 'Se sigue el cálculo autorizado: ¬I e IP permanecen separados.',
            excludedForeignSystems: [],
          },
        ],
      }),
    });

    expect(() => ingestCorpus(aclarada)).not.toThrow();
  });

  it('notaciones incompatibles: otra familia sin aclaración de convención alternativa', () => {
    const otraNotacion = entrada({
      components: [componente({ notationFamily: 'gentzen-secuentes' })],
    });

    expect(causasDeBloqueo(otraNotacion)).toContain('notaciones_incompatibles');
  });

  it('la misma diferencia **clasificada** como convención alternativa no bloquea', () => {
    // W0 tiene la clase `convencion_alternativa` justamente para esto: una
    // notación distinta y explicada no es una incompatibilidad.
    const conciliada = entrada({
      components: [
        componente({
          notationFamily: 'gentzen-secuentes',
          notationReconciliation: 'Convención alternativa: ⊢ se lee como la barra Fitch.',
        }),
      ],
    });

    expect(() => ingestCorpus(conciliada)).not.toThrow();
  });

  it('KC candidatos sin cobertura, nombrando cuáles', () => {
    const sinCobertura = entrada({ candidateKcs: ['KC04', 'KC05', 'KC13'] });

    expect(causasDeBloqueo(sinCobertura)).toContain('kc_candidatos_sin_cobertura');
    expect(() => ingestCorpus(sinCobertura)).toThrow(/KC13/);
  });

  it('sin anclaje: dos fragmentos en la misma ubicación', () => {
    const ambiguo = entrada({
      components: [
        componente({
          sections: [SECCIONES_CALGARY[0], { ...SECCIONES_CALGARY[1], location: 'p. 41' }],
        }),
      ],
      candidateKcs: ['KC04'],
    });

    // Un ancla que apunta a dos sitios no ancla.
    expect(causasDeBloqueo(ambiguo)).toContain('sin_anclaje_por_fragmento');
  });

  it('sin anclaje: ubicación vacía', () => {
    const sinUbicacion = entrada({
      components: [componente({ sections: [{ ...SECCIONES_CALGARY[0], location: '  ' }] })],
      candidateKcs: ['KC04'],
      requiredSections: [{ sourceComponent: 'calgary-cap-3', location: '  ' }],
    });

    expect(causasDeBloqueo(sinUbicacion)).toContain('sin_anclaje_por_fragmento');
  });

  it('licencia no registrada: sin origen', () => {
    const sinOrigen = entrada({ components: [componente({ origin: '' })] });

    expect(causasDeBloqueo(sinOrigen)).toContain('licencia_no_registrada');
  });

  it('licencia no registrada: sin ningún veredicto de uso de W0', () => {
    // Un uso no declarado no está permitido, así que sin veredictos el
    // componente no es utilizable para nada: ingerirlo como si lo fuera
    // convertiría el silencio de W0 en un permiso.
    const sinVeredictos = entrada({ useVerdicts: [] });

    expect(causasDeBloqueo(sinVeredictos)).toContain('licencia_no_registrada');
  });

  it('faltan secciones necesarias, nombrando cuáles', () => {
    const falta = entrada({
      requiredSections: [
        { sourceComponent: 'calgary-cap-3', location: 'p. 41' },
        { sourceComponent: 'calgary-cap-3', location: 'p. 99' },
      ],
    });

    expect(causasDeBloqueo(falta)).toContain('secciones_faltantes');
    expect(() => ingestCorpus(falta)).toThrow(/p\. 99/);
  });

  it('reporta todas las causas, no la primera', () => {
    // Quien tenga que corregir el corpus necesita ver qué falta, no solo que
    // falta algo.
    const variasFallas = entrada({
      components: [componente({ notationFamily: 'gentzen-secuentes', origin: '' })],
      candidateKcs: ['KC04', 'KC05', 'KC13'],
      requiredSections: [{ sourceComponent: 'calgary-cap-3', location: 'p. 99' }],
    });

    const causas = causasDeBloqueo(variasFallas);
    expect(causas).toContain('notaciones_incompatibles');
    expect(causas).toContain('licencia_no_registrada');
    expect(causas).toContain('kc_candidatos_sin_cobertura');
    expect(causas).toContain('secciones_faltantes');
  });
});

describe('lo que W0 no autorizó no entra', () => {
  it('un componente ausente del manifiesto no tiene identidad contra la que comprobarse', () => {
    const ajeno = entrada({
      components: [componente({ sourceComponent: 'apuntes-sueltos', content: CONTENIDO_OCW })],
    });

    expect(() => ingestCorpus(ajeno)).toThrow(UnauthorizedComponentError);
  });

  it('un componente `pendiente` no se ingiere: lo no decidido no es autorizado', () => {
    const pendiente = entrada({
      manifest: manifiesto({
        inventory: [
          {
            sourceComponent: 'calgary-cap-3',
            sourceVersion: 'Fall 2025',
            status: 'pendiente',
            snapshotSha256: sha256Hex(CONTENIDO_CALGARY),
            licenseEvidence: 'en revisión',
            attributionChain: ['forall x: Calgary'],
          },
        ],
      }),
    });

    expect(() => ingestCorpus(pendiente)).toThrow(UnauthorizedComponentError);
  });

  it('un componente `excluido` tampoco', () => {
    const excluido = entrada({
      manifest: manifiesto({
        inventory: [
          {
            sourceComponent: 'calgary-cap-3',
            sourceVersion: 'Fall 2025',
            status: 'excluido',
            snapshotSha256: sha256Hex(CONTENIDO_CALGARY),
            licenseEvidence: 'ND sin revisión jurídica',
            attributionChain: ['forall x: Calgary'],
          },
        ],
      }),
    });

    expect(() => ingestCorpus(excluido)).toThrow(UnauthorizedComponentError);
  });
});

describe('el caso Calgary sobrevive a la ingesta', () => {
  const manifiestoUnresolved = manifiesto({
    inventory: [
      {
        sourceComponent: 'calgary-cap-3',
        sourceVersion: 'Fall 2025',
        status: 'LICENSE_UNRESOLVED',
        snapshotSha256: sha256Hex(CONTENIDO_CALGARY),
        licenseEvidence: 'used with permission, sin proveniencia granular',
        attributionChain: ['forall x: Calgary'],
      },
    ],
  });

  const soloDocumental = entrada({
    manifest: manifiestoUnresolved,
    useVerdicts: [
      {
        sourceComponent: 'calgary-cap-3',
        intendedUse: 'fuente_documental',
        verdict: {
          status: 'LICENSE_UNRESOLVED',
          blocked: false,
          reason: 'uso documental del cálculo no bloqueado',
        },
      },
      {
        sourceComponent: 'calgary-cap-3',
        intendedUse: 'base_expresiva',
        verdict: {
          status: 'LICENSE_UNRESOLVED',
          blocked: true,
          reason: 'proveniencia no resuelta',
        },
      },
    ],
  });

  it('el material documental entra, pero no como base expresiva', () => {
    // El mismo veredicto por uso que produjo W0 (T-H45-05). Colapsarlo en un
    // booleano aquí obligaría a elegir una de las dos respuestas ciertas.
    const corpus = ingestCorpus(soloDocumental);

    expect(corpus.fragments[0]?.permittedUses).toEqual(['fuente_documental']);
    expect(corpus.fragments[0]?.authorizationStatus).toBe('LICENSE_UNRESOLVED');
  });

  it('deja registrado qué KC quedan sin base expresiva', () => {
    // Sin este dato, W3 descubriría en plena autoría que no puede construir
    // reactivos para esos KC y el hueco parecería un fallo del generador.
    const corpus = ingestCorpus(soloDocumental);

    expect(corpus.kcsWithoutExpressiveBase).toEqual(['KC04', 'KC05']);
  });

  it('con base expresiva permitida, la lista queda vacía', () => {
    expect(ingestCorpus(entrada()).kcsWithoutExpressiveBase).toEqual([]);
  });

  it('un fragmento sin permiso documental no da cobertura de KC', () => {
    // El caso es alcanzable porque los veredictos son **dato de entrada**: W1 no
    // los recalcula, así que no puede suponer que el uso documental siempre esté
    // permitido. Si contara igual, un KC quedaría dado por cubierto por material
    // que nadie autorizó ni a consultar.
    const documentalBloqueado = entrada({
      useVerdicts: [
        {
          sourceComponent: 'calgary-cap-3',
          intendedUse: 'fuente_documental',
          verdict: { status: 'excluido', blocked: true, reason: 'no citable como autoridad' },
        },
        {
          sourceComponent: 'calgary-cap-3',
          intendedUse: 'base_expresiva',
          verdict: { status: 'autorizado', blocked: false, reason: 'CC BY' },
        },
      ],
    });

    expect(causasDeBloqueo(documentalBloqueado)).toContain('kc_candidatos_sin_cobertura');
  });
});

describe('entradas que harían pasar un control por vacío', () => {
  it('sin KC candidatos, la cobertura no podría fallar nunca', () => {
    expect(() => ingestCorpus(entrada({ candidateKcs: [] }))).toThrow(
      IncompleteIngestionInputError,
    );
  });

  it('sin secciones necesarias declaradas, no hay ausencia detectable', () => {
    expect(() => ingestCorpus(entrada({ requiredSections: [] }))).toThrow(
      IncompleteIngestionInputError,
    );
  });

  it('sin componentes, «no había nada» y «no se cargó» se confundirían', () => {
    expect(() => ingestCorpus(entrada({ components: [] }))).toThrow(IncompleteIngestionInputError);
  });

  it('sin familia de notación autorizada no hay contra qué juzgar incompatibilidad', () => {
    expect(() => ingestCorpus(entrada({ authorizedNotationFamily: '  ' }))).toThrow(
      IncompleteIngestionInputError,
    );
  });
});

describe('bloqueo de modificación por el pipeline (§12 «W1» paso 6)', () => {
  it('el corpus sale congelado en profundidad', () => {
    const corpus = ingestCorpus(entrada());

    expect(Object.isFrozen(corpus)).toBe(true);
    expect(Object.isFrozen(corpus.fragments)).toBe(true);
    expect(Object.isFrozen(corpus.fragments[0])).toBe(true);
    expect(Object.isFrozen(corpus.fragments[0]?.relatedConcepts)).toBe(true);
    expect(Object.isFrozen(corpus.components[0])).toBe(true);
  });

  it('escribir en el corpus lanza en vez de mutar en silencio', () => {
    const corpus = ingestCorpus(entrada());
    const superficie = corpus as unknown as Record<string, unknown>;

    expect(() => {
      superficie.courseId = 'otro-curso';
    }).toThrow(TypeError);
    expect(() => (corpus.fragments as Fragment[]).push(corpus.fragments[0] as Fragment)).toThrow();
    expect(corpus.courseId).toBe('deduccion-natural');
  });

  it('el corpus no expone ninguna vía de alterarlo', () => {
    // Una corrección posterior es una ingesta nueva con su propia identidad, no
    // un parche sobre esta: un `update` haría del bloqueo una sugerencia.
    const superficie = ingestCorpus(entrada()) as unknown as Record<string, unknown>;

    for (const prohibido of ['add', 'update', 'remove', 'patch', 'replace', 'set', 'clear']) {
      expect(superficie[prohibido]).toBeUndefined();
    }
  });

  it('el tipo del corpus no declara ningún mutador', () => {
    const claves: readonly (keyof IngestedCorpus)[] = [
      'corpusVersion',
      'courseId',
      'components',
      'fragments',
      'kcsWithoutExpressiveBase',
    ];

    expect(Object.keys(ingestCorpus(entrada())).sort()).toEqual([...claves].sort());
  });
});
