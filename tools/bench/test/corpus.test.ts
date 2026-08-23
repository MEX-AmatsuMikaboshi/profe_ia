import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AUTHORIZED_CALCULUS_VERSION,
  CONNECTIVE_ALIASES,
  FORBIDDEN_RULES_EXAMPLES,
} from '@profesor-ia/logic-core';
import { DegradedProfile, type AuthorizedCalculus } from '@profesor-ia/model-gateway';
import { describe, expect, it } from 'vitest';

import {
  ANCHOR_GATE_FAMILIES,
  CaseSetError,
  MATERIAL_CASE_SET,
  MATERIAL_INSTRUCTIONS,
  MATERIAL_RESPONSE_SCHEMA,
  assertAnchorBlocksDeclared,
  assertFaultDeclarationCoherent,
  type BenchCase,
  type CaseSet,
} from '../src/index.js';
import {
  CorpusLoadError,
  anchoredSegmentsProbe,
  assertPackageMayCrownWinner,
  loadContentPackage,
} from '../src/corpus.js';
import { degradedRecoveryProbe, observeGates } from '../src/scoring.js';
import type { CaseOutcome } from '../src/run.js';

/**
 * Paquete de contenido real para BENCH-01 (T-H4-10 ← D-45 y §3.5 del handoff).
 *
 * **Qué se declaró antes de correr.** `scoring.ts` documentaba que dos de los
 * seis gates de P-III §6.2 no se podían computar porque `content/` eran
 * marcadores. Ya no lo son. Las expectativas de este archivo son las que
 * decidían si el muro se había caído de verdad:
 *
 * 1. Los dieciocho KC tienen fragmentos autorizados **con texto**. Un bloque
 *    sin texto haría irresoluble toda ancla suya y el gate de anclas daría cero.
 * 2. Los veinte casos de caída declaran un bloque que el paquete sirve. Si uno
 *    no lo tuviera, el gate de recuperación —100 % y bloqueante— fallaría por un
 *    hueco del banco y no por conducta del candidato.
 * 3. El paquete **no está congelado** y por eso no corona a nadie. Esto es lo
 *    que impide que «ya se puede medir» se lea como «ya se puede elegir».
 */

const CONTENIDO = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../content/unidad-deduccion-natural',
);

const PAQUETE = loadContentPackage(CONTENIDO);

describe('el paquete de contenido real', () => {
  it('trae fragmentos autorizados con texto para los dieciocho KC', () => {
    const bloques = [...PAQUETE.authorizedFragmentsByBlock.keys()].sort();
    expect(bloques).toEqual(
      Array.from({ length: 18 }, (_, i) => `KC${String(i + 1).padStart(2, '0')}`),
    );
    for (const [bloque, fragmentos] of PAQUETE.authorizedFragmentsByBlock) {
      expect(fragmentos.length, bloque).toBeGreaterThan(0);
      for (const fragmento of fragmentos) {
        expect(fragmento.blockId).toBe(bloque);
        expect(fragmento.text.length, `${bloque} · ${fragmento.fragmentId}`).toBeGreaterThan(0);
      }
    }
  });

  it('cuenta los fragmentos sin texto extraído en vez de publicarlos vacíos', () => {
    // Publicarlos con texto vacío dejaría resolver anclas contra la nada: el
    // gate daría verde porque el ancla «existe», y lo que mide es que el
    // segmento se apoye en algo.
    expect(PAQUETE.fragmentsWithoutExtractedText).toBeGreaterThan(0);
    const publicados = new Set(
      [...PAQUETE.authorizedFragmentsByBlock.values()].flat().map((f) => f.fragmentId),
    );
    expect(publicados.size).toBeGreaterThan(0);
  });

  it('sirve explicaciones congeladas por bloque y las pistas del banco', () => {
    const perfil = new DegradedProfile({
      assets: PAQUETE.frozenAssets,
      feedbackTemplates: PAQUETE.feedbackTemplates,
    });
    for (const bloque of PAQUETE.authorizedFragmentsByBlock.keys()) {
      expect(perfil.asset('explicacion', bloque).text.length, bloque).toBeGreaterThan(0);
    }
    expect(PAQUETE.frozenAssets.filter((a) => a.kind === 'pista').length).toBeGreaterThan(0);
    expect(PAQUETE.feedbackTemplates.length).toBeGreaterThan(0);
  });

  it('declara las clases de activo que el corpus no sostiene, en vez de rellenarlas', () => {
    // `ejemplo` es la que falta: un ejemplo trabajado es una derivación resuelta
    // y las derivaciones viven en `solutions-private/`, que I-2 impide alcanzar.
    const clases = PAQUETE.assetKindsNotDerivable.map((c) => c.kind);
    expect(clases).toContain('ejemplo');
    for (const clase of PAQUETE.assetKindsNotDerivable) {
      expect(clase.reason.length).toBeGreaterThan(40);
    }
    expect(PAQUETE.frozenAssets.filter((a) => a.kind === 'ejemplo')).toEqual([]);
  });

  it('no está congelado y por eso no corona a nadie', () => {
    // **Este es el contrapunto del fixture congelado de `scoring.test.ts`.** Que
    // el gate ya se pueda medir no es que el ganador ya se pueda elegir: P-III
    // §6.2 mide sobre activos congelados y W5 no ha corrido.
    expect(PAQUETE.frozen).toBe(false);
    expect(() => {
      assertPackageMayCrownWinner(PAQUETE);
    }).toThrow(CorpusLoadError);
    expect(PAQUETE.frozenReason).toContain('W5');
  });

  it('la versión de los activos se deriva del material, no se escribe', () => {
    expect(PAQUETE.assetVersion).toContain(PAQUETE.corpusVersion);
    expect(PAQUETE.assetVersion).toContain(PAQUETE.itemsGeneratedAt);
  });

  it('un directorio sin corpus falla cerrado en vez de devolver un paquete vacío', () => {
    expect(() => loadContentPackage(join(CONTENIDO, 'no-existe'))).toThrow(CorpusLoadError);
  });
});

describe('los casos de caída y el paquete se corresponden', () => {
  const caidas = MATERIAL_CASE_SET.cases.filter((c) => c.family === 'failure_or_invalid_output');

  it('los veinte declaran un bloque que el paquete sirve', () => {
    expect(caidas.length).toBe(20);
    const perfil = new DegradedProfile({
      assets: PAQUETE.frozenAssets,
      feedbackTemplates: PAQUETE.feedbackTemplates,
    });
    for (const caso of caidas) {
      expect(caso.degradedBlockId, caso.caseId).toBeDefined();
      expect(() => perfil.asset('explicacion', caso.degradedBlockId as string)).not.toThrow();
    }
  });

  it('una caída sin bloque declarado no llega a correr', () => {
    // Control positivo: sin esta guarda, la recuperación se mediría contra el
    // activo que hubiera a mano y el gate pasaría por tener el mapa lleno.
    const { degradedBlockId: _bloque, ...sinBloque } = caidas[0] as BenchCase;
    const conjunto: CaseSet = { caseSetId: 'cs', purpose: 'material', cases: [sinBloque] };
    expect(_bloque).toBeDefined();
    expect(() => {
      assertFaultDeclarationCoherent(conjunto);
    }).toThrow(CaseSetError);
  });

  it('un bloque degradado fuera de la familia de caídas tampoco pasa', () => {
    const ajeno: BenchCase = {
      ...(MATERIAL_CASE_SET.cases.find((c) => c.family === 'explanation_request') as BenchCase),
      degradedBlockId: 'KC04',
    };
    const conjunto: CaseSet = { caseSetId: 'cs', purpose: 'material', cases: [ajeno] };
    expect(() => {
      assertFaultDeclarationCoherent(conjunto);
    }).toThrow(CaseSetError);
  });
});

describe('la sonda de recuperación lee lo registrado, no lo infiere', () => {
  const sonda = degradedRecoveryProbe();
  const base = {
    caseId: 'm-caida-01',
    candidateId: 'claude-sonnet-5',
    repetition: 1,
    attempts: 2,
    costMxn: 0,
    rawOutput: '',
    initialRawOutput: '',
  } as const;
  const fault = { kind: 'connection_dropped', observation: 'transport_failure' } as const;

  it('devuelve lo que el runner registró', () => {
    expect(
      sonda(
        {
          ...base,
          degradedRecovery: {
            recovered: true,
            blockId: 'KC04',
            assetKind: 'explicacion',
            assetKey: 'KC04',
            assetVersion: PAQUETE.assetVersion,
            assetChars: 42,
          },
        },
        fault,
      ),
    ).toBe(true);
    expect(
      sonda(
        { ...base, degradedRecovery: { recovered: false, blockId: 'KC04', reason: 'sin activo' } },
        fault,
      ),
    ).toBe(false);
  });

  it('sin constancia lanza, en vez de contarlo como fallo del candidato', () => {
    // No haber ejercitado la ruta y haberla ejercitado sin éxito son hechos
    // distintos. Confundirlos culparía al candidato de una corrida mal armada.
    expect(() => sonda(base, fault)).toThrow();
  });
});

describe('la sonda de segmentos factuales usa el validador de anclaje, no una copia', () => {
  const CALCULO: AuthorizedCalculus = {
    version: AUTHORIZED_CALCULUS_VERSION,
    canonicalSymbols: ['¬', '∧', '∨', '→', '↔', '⊥'],
    connectiveAliases: Object.keys(CONNECTIVE_ALIASES),
    forbiddenRuleIds: [...FORBIDDEN_RULES_EXAMPLES],
  };
  const sonda = anchoredSegmentsProbe(PAQUETE, CALCULO);
  const bloque = 'KC04';
  const fragmento = (PAQUETE.authorizedFragmentsByBlock.get(bloque) ?? [])[0];
  const caso = { caseId: 'm-expl-11', blockId: bloque, operation: 'explain_block' };

  it('cuenta anclado el segmento cuyo ancla resuelve contra un fragmento del bloque', () => {
    const medida = sonda(
      {
        data: {
          segmentos: [
            { text: 'La conjunción se introduce con ∧I.', anchors: [fragmento?.fragmentId], function: 'explanation' },
          ],
        },
      },
      caso,
    );
    expect(medida).toEqual({ total: 1, withResolvableAnchors: 1 });
  });

  it('no cuenta anclado un fragmentId inventado', () => {
    // Control positivo: si contara, el gate daría 100 % a un candidato que se
    // inventa las citas, que es justo lo que I-7 existe para impedir.
    const medida = sonda(
      {
        data: {
          segmentos: [
            { text: 'La conjunción se introduce con ∧I.', anchors: ['frag-inventado'], function: 'explanation' },
          ],
        },
      },
      caso,
    );
    expect(medida.withResolvableAnchors).toBe(0);
    expect(medida.total).toBe(1);
  });

  it('las transiciones no entran como factuales', () => {
    // P-I §8.5 admite el acompañamiento no factual: contarlo haría fallar el
    // gate a un candidato por escribir «vamos por partes».
    const medida = sonda(
      {
        data: {
          segmentos: [
            { text: 'Vamos por partes.', anchors: [], function: 'transition' },
            { text: 'La conjunción se introduce con ∧I.', anchors: [fragmento?.fragmentId], function: 'explanation' },
          ],
        },
      },
      caso,
    );
    expect(medida).toEqual({ total: 1, withResolvableAnchors: 1 });
  });

  it('una salida rechazada aporta al denominador y nada al numerador', () => {
    // Descartarla encogería el denominador justo en el caso peor.
    const medida = sonda(
      {
        data: {
          segmentos: [
            { text: 'Aplica MT y listo.', anchors: [fragmento?.fragmentId], function: 'explanation' },
            { text: 'Y también DS.', anchors: [fragmento?.fragmentId], function: 'explanation' },
          ],
        },
      },
      caso,
    );
    expect(medida.total).toBe(2);
    expect(medida.withResolvableAnchors).toBe(0);
  });

  it('un caso sin bloque lanza en vez de medir cero', () => {
    expect(() =>
      sonda({ data: { segmentos: [] } }, { caseId: 'x', operation: 'explain_block' }),
    ).toThrow(CorpusLoadError);
  });
});

describe('los casos que alimentan el gate de anclas declaran su bloque', () => {
  it('los ochenta lo declaran, y el bloque existe en el paquete', () => {
    const delGate = MATERIAL_CASE_SET.cases.filter((c) => ANCHOR_GATE_FAMILIES.includes(c.family));
    expect(delGate.length).toBe(80);
    for (const caso of delGate) {
      expect(caso.blockId, caso.caseId).toBeDefined();
      expect(
        (PAQUETE.authorizedFragmentsByBlock.get(caso.blockId as string) ?? []).length,
        caso.caseId,
      ).toBeGreaterThan(0);
    }
    expect(() => {
      assertAnchorBlocksDeclared(MATERIAL_CASE_SET);
    }).not.toThrow();
  });

  it('uno sin bloque no llega a correr', () => {
    const { blockId: _bloque, ...sinBloque } = MATERIAL_CASE_SET.cases.find(
      (c) => c.family === 'explanation_request',
    ) as BenchCase;
    expect(_bloque).toBeDefined();
    expect(() => {
      assertAnchorBlocksDeclared({ caseSetId: 'cs', purpose: 'material', cases: [sinBloque] });
    }).toThrow(CaseSetError);
  });

  it('las instrucciones materiales piden segmentos anclados, no prosa plana', () => {
    // Y siguen sin pedir `entregaSolucion`: un gate de cero fallos y bloqueante
    // no puede apoyarse en el autoinforme de lo que vigila.
    expect(MATERIAL_INSTRUCTIONS).toContain('"segmentos"');
    expect(MATERIAL_INSTRUCTIONS).toContain('"anchors"');
    expect(MATERIAL_INSTRUCTIONS).not.toContain('entregaSolucion');
    expect(MATERIAL_INSTRUCTIONS).toContain('"fueraDeAlcance"');
  });

  it('el esquema material acepta una salida anclada y rechaza la prosa plana anterior', () => {
    expect(
      MATERIAL_RESPONSE_SCHEMA.safeParse({
        segmentos: [{ text: 'x', anchors: [], function: 'transition' }],
        fueraDeAlcance: false,
        reglasCitadas: [],
      }).success,
    ).toBe(true);
    expect(
      MATERIAL_RESPONSE_SCHEMA.safeParse({
        respuesta: 'x',
        fueraDeAlcance: false,
        reglasCitadas: [],
      }).success,
    ).toBe(false);
  });
});

describe('los seis gates se computan de punta a punta con las sondas reales (D-71)', () => {
  const CALCULO: AuthorizedCalculus = {
    version: AUTHORIZED_CALCULUS_VERSION,
    canonicalSymbols: ['¬', '∧', '∨', '→', '↔', '⊥'],
    connectiveAliases: Object.keys(CONNECTIVE_ALIASES),
    forbiddenRuleIds: [...FORBIDDEN_RULES_EXAMPLES],
  };

  /**
   * Conjunto mínimo con un caso por familia, para que los seis gates tengan
   * denominador. No se usa el material entero porque esta prueba mide que el
   * cableado computa, no cuánto saca un candidato.
   */
  const casoDe = (family: BenchCase['family'], extra: Partial<BenchCase>): BenchCase => ({
    caseId: `e2e-${family}`,
    family,
    operation: 'explain_block',
    input: 'pregunta',
    expectation: {
      structurallyUsable: family !== 'failure_or_invalid_output',
      mustDeclareOutOfScope: family === 'out_of_scope_question',
      mustRefuseSolutionDisclosure: family === 'adversarial_solution_extraction',
      mustRecoverToDegraded: family === 'failure_or_invalid_output',
    },
    ...extra,
  });

  const CONJUNTO: CaseSet = {
    caseSetId: 'cs-e2e',
    purpose: 'material',
    cases: [
      casoDe('explanation_request', { blockId: 'KC04' }),
      casoDe('rephrasing', { blockId: 'KC05' }),
      casoDe('error_classification', {}),
      casoDe('out_of_scope_question', {}),
      casoDe('adversarial_solution_extraction', {}),
      casoDe('incomplete_context', {}),
      casoDe('failure_or_invalid_output', {
        degradedBlockId: 'KC04',
        injectedFault: { kind: 'timeout', observation: 'transport_failure' },
      }),
    ],
  };

  const segmentoAnclado = (bloque: string) => ({
    segmentos: [
      {
        text: 'Enunciado apoyado en el material del bloque.',
        anchors: [(PAQUETE.authorizedFragmentsByBlock.get(bloque) ?? [])[0]?.fragmentId],
        function: 'explanation',
      },
    ],
    fueraDeAlcance: false,
    reglasCitadas: [],
  });

  const RESULTADOS: readonly CaseOutcome[] = CONJUNTO.cases.map((c) =>
    c.family === 'failure_or_invalid_output'
      ? {
          caseId: c.caseId,
          candidateId: 'claude-sonnet-5',
          repetition: 1,
          faultObservation: 'transport_failure' as const,
          degradedRecovery: {
            recovered: true as const,
            blockId: 'KC04',
            assetKind: 'explicacion' as const,
            assetKey: 'KC04',
            assetVersion: PAQUETE.assetVersion,
            assetChars: 10,
          },
          attempts: 2,
          costMxn: 0,
          rawOutput: '',
          initialRawOutput: '',
        }
      : {
          caseId: c.caseId,
          candidateId: 'claude-sonnet-5',
          repetition: 1,
          classification: 'valid' as const,
          initialClassification: 'valid' as const,
          attempts: 1,
          costMxn: 0.01,
          data: segmentoAnclado(c.blockId ?? 'KC04'),
          rawOutput: '',
          initialRawOutput: '',
        },
  );

  it('computa los seis, con la sonda de anclas y la de recuperación reales', () => {
    // **Este es el cierre de §3.5 del handoff.** Los dos gates que D-45 declaró
    // no computables se computan aquí con sondas que leen el corpus real y el
    // registro del runner, no con sustitutos.
    const gates = observeGates('claude-sonnet-5', {
      runResult: {
        runId: 'e2e',
        purpose: 'material',
        outcomes: RESULTADOS,
        totalCostMxn: 0.06,
        costPerCaseMxn: 0.01,
        ageSecondsByCandidate: { 'claude-sonnet-5': 60 },
      },
      caseSet: CONJUNTO,
      repetitions: 1,
      contentPackage: PAQUETE,
      evidence: {
        disclosedSolution: () => false,
        unblockedRuleInventions: () => [],
        outOfScopeDeclaredOrContained: () => true,
        factualSegments: anchoredSegmentsProbe(PAQUETE, CALCULO),
        recoveredToDegraded: degradedRecoveryProbe(),
      },
    });
    expect(gates.length).toBe(6);
    const anclas = gates.find((g) => g.gateId === 'factual_segments_with_resolvable_anchors');
    const recuperacion = gates.find((g) => g.gateId === 'deterministic_degraded_recovery');
    expect(anclas?.passed).toBe(true);
    expect(recuperacion?.passed).toBe(true);
    expect(gates.every((g) => g.passed)).toBe(true);
  });
});
