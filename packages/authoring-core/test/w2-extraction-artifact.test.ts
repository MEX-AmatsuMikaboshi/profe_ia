import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AUTHORIZED_RULE_IDS } from '@profesor-ia/logic-core';
import { describe, expect, it } from 'vitest';

import {
  attributionDenominator,
  buildExtraction,
  EXTRACTION_SECTIONS,
  type ExtractedClaim,
  type ExtractedItem,
  type IngestedCorpus,
} from '../src/index.js';

/**
 * Guarda de la extracción materializada de W2 (T-H5-02), corrida el 2026-08-21
 * con `scripts/content/w2-extract-run.mjs`.
 *
 * Lo que comprueba no es el estilo del contenido sino que **siga siendo una
 * extracción válida**: que cada ancla resuelva contra el corpus de W1 con su
 * hash, que los tipos de claim sigan cumpliendo lo que afirman y que las
 * decisiones conserven soporte. Quien edite un `.yaml` a mano y cite un
 * fragmento inexistente, o reetiquete un `system_inference`, rompe esta prueba
 * — que es el paso 2 de §12 «W2» («linter verifica anclajes») convertido en
 * regresión permanente.
 *
 * Es offline a propósito: la comprobación contra el snapshot remoto la hace la
 * corrida, aquí solo se re-valida lo persistido.
 */
const CONTENIDO = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../content/unidad-deduccion-natural',
);

function leerJsonConCabecera<T>(ruta: string): T {
  return JSON.parse(readFileSync(join(CONTENIDO, ruta), 'utf8').replace(/^(#[^\n]*\n)+/, '')) as T;
}

interface SeccionDoc {
  readonly extractionVersion: string;
  readonly courseId: string;
  readonly section: string;
  readonly items: readonly ExtractedItem[];
}

interface ClaimsDoc {
  readonly claims: readonly ExtractedClaim[];
  readonly attributionDenominator: readonly string[];
}

interface AnchorsDoc {
  readonly fragmentsCited: number;
  readonly fragmentsTotal: number;
  readonly kcCovered: readonly string[];
  readonly kcInCorpus: readonly string[];
  readonly anchors: readonly {
    readonly fragmentId: string;
    readonly fragmentSha256: string;
    readonly citedBy: readonly string[];
  }[];
}

interface DecisionesDoc {
  readonly curricularDecisions: readonly {
    readonly decisionId: string;
    readonly statement: string;
    readonly supportingClaims: readonly string[];
    readonly justification: string;
  }[];
}

const manifiesto = leerJsonConCabecera<{
  corpusVersion: IngestedCorpus['corpusVersion'];
  courseId: string;
  components: IngestedCorpus['components'];
  kcsWithoutExpressiveBase?: readonly string[];
}>('source/manifest.yaml');

const fragmentos = leerJsonConCabecera<IngestedCorpus['fragments']>(
  'source/fragments/forallx-yyc--tfl-deduccion-natural.json',
);

const corpus: IngestedCorpus = {
  corpusVersion: manifiesto.corpusVersion,
  courseId: manifiesto.courseId,
  components: manifiesto.components,
  fragments: fragmentos,
  kcsWithoutExpressiveBase: manifiesto.kcsWithoutExpressiveBase ?? [],
};

const SECCIONES_DE_ITEMS = EXTRACTION_SECTIONS.filter((s) => s !== 'claims');

const secciones = SECCIONES_DE_ITEMS.map((s) => leerJsonConCabecera<SeccionDoc>(`extracted/${s}.yaml`));
const claimsDoc = leerJsonConCabecera<ClaimsDoc>('extracted/claims.yaml');
const anchorsDoc = leerJsonConCabecera<AnchorsDoc>('provenance/anchors.yaml');
const decisionesDoc = leerJsonConCabecera<DecisionesDoc>('provenance/curricular-decisions.yaml');

const items = secciones.flatMap((doc) => doc.items);

describe('extracción W2 materializada (T-H5-02)', () => {
  it('vuelve a validar entera contra el corpus de W1: anclas, tipos y soporte', () => {
    const extraccion = buildExtraction(corpus, {
      items,
      claims: claimsDoc.claims,
      curricularDecisions: decisionesDoc.curricularDecisions,
    });

    expect(extraccion.extractionVersion).toBe('w2-extraction-v1');
    expect(extraccion.courseId).toBe('unidad-deduccion-natural');
  });

  it('cubre las cuatro secciones de elementos, y cada archivo trae solo la suya', () => {
    expect(secciones.map((d) => d.section)).toEqual([...SECCIONES_DE_ITEMS]);
    for (const doc of secciones) {
      expect(doc.items.length).toBeGreaterThan(0);
      expect(doc.items.every((i) => i.section === doc.section)).toBe(true);
    }
  });

  it('extrae exactamente las reglas de authorized-calculus-v1, ni una más', () => {
    const reglas = items.filter((i) => i.section === 'rules');
    expect(reglas).toHaveLength(AUTHORIZED_RULE_IDS.length);
    for (const ruleId of AUTHORIZED_RULE_IDS) {
      expect(reglas.filter((r) => r.statement.endsWith(`(rule_id ${ruleId})`))).toHaveLength(1);
    }
  });

  it('no emite ningún cross_source_consensus: el corpus tiene un solo componente', () => {
    expect(claimsDoc.claims.some((c) => c.claimType === 'cross_source_consensus')).toBe(false);
    expect(new Set(corpus.fragments.map((f) => f.sourceComponent)).size).toBe(1);
    expect(decisionesDoc.curricularDecisions.map((d) => d.decisionId)).toContain(
      'dc-sin-consenso-cruzado',
    );
  });

  it('el denominador de atribución persistido es el que §7.11 exige', () => {
    const extraccion = buildExtraction(corpus, {
      items,
      claims: claimsDoc.claims,
      curricularDecisions: decisionesDoc.curricularDecisions,
    });
    expect(claimsDoc.attributionDenominator).toEqual(
      attributionDenominator(extraccion).map((c) => c.claimId),
    );
    expect(claimsDoc.attributionDenominator.length).toBeLessThan(claimsDoc.claims.length);
  });

  it('el índice de anclas coincide con lo que la extracción cita, hash incluido', () => {
    const porFragmento = new Map<string, string[]>();
    for (const e of [...items, ...claimsDoc.claims]) {
      const quien = 'itemId' in e ? e.itemId : e.claimId;
      for (const a of e.anchors) {
        porFragmento.set(a.fragmentId, [...(porFragmento.get(a.fragmentId) ?? []), quien]);
      }
    }

    expect(anchorsDoc.anchors).toHaveLength(porFragmento.size);
    expect(anchorsDoc.fragmentsCited).toBe(porFragmento.size);
    expect(anchorsDoc.fragmentsTotal).toBe(corpus.fragments.length);

    for (const anchor of anchorsDoc.anchors) {
      const fragmento = corpus.fragments.find((f) => f.fragmentId === anchor.fragmentId);
      expect(fragmento?.sha256).toBe(anchor.fragmentSha256);
      expect(anchor.citedBy).toEqual([...(porFragmento.get(anchor.fragmentId) ?? [])].sort());
    }
  });

  it('todo KC con base expresiva en el corpus tiene algo extraído', () => {
    const anclados = new Set(
      [...items, ...claimsDoc.claims].flatMap((e) => e.anchors.map((a) => a.fragmentId)),
    );
    const kcAnclados = new Set(
      corpus.fragments.filter((f) => anclados.has(f.fragmentId)).flatMap((f) => f.relatedConcepts),
    );
    const kcDelCorpus = new Set(corpus.fragments.flatMap((f) => f.relatedConcepts));

    expect([...kcDelCorpus].filter((kc) => !kcAnclados.has(kc))).toEqual([]);
    expect(anchorsDoc.kcCovered).toEqual([...kcAnclados].sort());
    expect(anchorsDoc.kcInCorpus).toEqual([...kcDelCorpus].sort());
  });
});
