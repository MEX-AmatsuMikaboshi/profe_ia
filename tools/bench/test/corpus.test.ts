import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DegradedProfile } from '@profesor-ia/model-gateway';
import { describe, expect, it } from 'vitest';

import {
  CaseSetError,
  MATERIAL_CASE_SET,
  assertFaultDeclarationCoherent,
  type BenchCase,
  type CaseSet,
} from '../src/index.js';
import {
  CorpusLoadError,
  assertPackageMayCrownWinner,
  loadContentPackage,
} from '../src/corpus.js';
import { degradedRecoveryProbe } from '../src/scoring.js';

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
