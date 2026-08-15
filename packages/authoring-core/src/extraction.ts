import {
  ClaimTypeViolationError,
  DuplicateExtractionIdError,
  IncompleteExtractionError,
  UnanchoredExtractionError,
} from './errors.js';
import type { Fragment, IngestedCorpus } from './ingestion.js';

/**
 * W2 — Extracción curricular, Rol A (T-H5-02 ← P-I §7.11, P-II §5.2 «Rol A»,
 * §12 «W2» pasos 1–2).
 *
 * La tarea la gobierna una sola cadena, la de §7.11:
 *
 * ```text
 * fuente → fragmento → claim → decisión curricular → artefacto → actividad
 * ```
 *
 * Este módulo construye los dos eslabones centrales y comprueba que el anterior
 * sostiene: todo lo extraído ancla a un fragmento **del corpus ingerido en W1**,
 * con su hash, y el ancla se recalcula en vez de creerse. Tres consecuencias que
 * conviene no perder:
 *
 * 1. **El tipo de claim se comprueba, no se declara.** `cross_source_consensus`
 *    afirma que varias fuentes coinciden y `system_inference` afirma que no lo
 *    dice una fuente sino el sistema. Si el tipo no se comprueba, deja de
 *    significar nada — y como §7.11 saca `system_inference` del denominador de
 *    atribución, una etiqueta falsa movería la métrica de groundedness sin que
 *    nadie tocara la métrica.
 * 2. **Las decisiones pedagógicas van aparte y no son claims.** §7.11 lo dice
 *    literalmente. Mezcladas, una decisión nuestra se leería como algo que la
 *    fuente afirma, que es exactamente la confusión que la separación evita.
 * 3. **W2 no juzga la verdad de nada.** Comprueba anclaje, tipo e identidad. Si
 *    el claim se sigue del fragmento citado lo mide la muestra dorada de
 *    `T-H5-17`, y el NLI **nunca** es autoridad (`CAL-NLI`, `T-H45-08`).
 */

/**
 * Las cinco secciones del esquema cerrado que enumera `Plan.md` T-H5-02
 * («claims/definiciones/reglas/notación/restricciones»). Cerrada: una sección
 * nueva sería material curricular que nadie autorizó a extraer.
 */
export const EXTRACTION_SECTIONS = [
  'definitions',
  'notation',
  'rules',
  'restrictions',
  'claims',
] as const;
export type ExtractionSection = (typeof EXTRACTION_SECTIONS)[number];

/** Los tres tipos literales de claim de P-I §7.11. Lista cerrada. */
export const CLAIM_TYPES = [
  'source_assertion',
  'cross_source_consensus',
  'system_inference',
] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

/**
 * Ancla determinista a un fragmento (§7.11: «IDs, hashes, referencias»).
 *
 * Lleva el hash **además** del id porque el id localiza y el hash identifica el
 * contenido: sin el hash, un ancla seguiría pareciendo válida después de que el
 * fragmento cambiara, y el claim quedaría atribuido a un texto que ya no dice
 * eso.
 */
export interface FragmentAnchor {
  readonly fragmentId: string;
  readonly fragmentSha256: string;
}

/** Elemento extraído de las cuatro secciones que no son claims. */
export interface ExtractedItem {
  readonly itemId: string;
  readonly section: Exclude<ExtractionSection, 'claims'>;
  readonly statement: string;
  /** Referencias exactas: al menos una, o no hay de dónde salió. */
  readonly anchors: readonly FragmentAnchor[];
}

export interface ExtractedClaim {
  readonly claimId: string;
  readonly claimType: ClaimType;
  readonly statement: string;
  /** Vacío **solo** para `system_inference`: no lo dice una fuente. */
  readonly anchors: readonly FragmentAnchor[];
  /** Claims de los que se infiere. Obligatorio para `system_inference`. */
  readonly supportingClaims: readonly string[];
}

/**
 * Decisión pedagógica, registrada **aparte** de los claims (§7.11), con sus
 * claims de soporte y su justificación.
 */
export interface CurricularDecision {
  readonly decisionId: string;
  readonly statement: string;
  readonly supportingClaims: readonly string[];
  readonly justification: string;
}

export interface ExtractionInput {
  readonly items: readonly ExtractedItem[];
  readonly claims: readonly ExtractedClaim[];
  readonly curricularDecisions: readonly CurricularDecision[];
}

export interface Extraction extends ExtractionInput {
  readonly extractionVersion: 'w2-extraction-v1';
  readonly courseId: string;
}

/**
 * Comprueba un ancla contra el corpus **real**, no contra lo que declara.
 *
 * Las tres formas de no anclar se distinguen en el mensaje porque exigen
 * arreglos distintos: un fragmento inexistente es una cita inventada, un hash
 * que no cuadra es un ancla que envejeció, y un fragmento sin permiso documental
 * es material que W0 no autorizó a citar como autoridad.
 */
function assertAnchor(corpus: IngestedCorpus, quien: string, anchor: FragmentAnchor): void {
  const fragmento: Fragment | undefined = corpus.fragments.find(
    (f) => f.fragmentId === anchor.fragmentId,
  );

  if (fragmento === undefined) {
    throw new UnanchoredExtractionError(
      `${quien} cita el fragmento ${anchor.fragmentId}, que no está en el corpus ingerido. Un ancla ` +
        `a un fragmento inexistente no es una referencia, es una cita inventada.`,
    );
  }

  if (fragmento.sha256 !== anchor.fragmentSha256) {
    throw new UnanchoredExtractionError(
      `${quien} ancla a ${anchor.fragmentId} con hash ${anchor.fragmentSha256}, pero el fragmento ` +
        `hashea ${fragmento.sha256}. El ancla envejeció: sin comprobar el hash, seguiría pareciendo ` +
        `válida sobre un texto que ya no dice eso.`,
    );
  }

  if (!fragmento.permittedUses.includes('fuente_documental')) {
    throw new UnanchoredExtractionError(
      `${quien} cita ${anchor.fragmentId} como autoridad, y W0 no permite ese fragmento como fuente ` +
        `documental. Atribuir una afirmación a material que no se puede citar sería fabricar la ` +
        `cadena de atribución.`,
    );
  }
}

/**
 * Comprueba que el claim cumple lo que su tipo afirma.
 *
 * `source_assertion` necesita al menos una fuente que lo asevere.
 * `cross_source_consensus` necesita **dos componentes distintos**: coincidir
 * consigo mismo no es consenso, y dos fragmentos de la misma obra son una sola
 * fuente. `system_inference` no se ancla a ninguna fuente —si lo dijera una, no
 * sería inferencia sino aserción— y a cambio debe declarar de qué claims se
 * infiere, que es la «propia trazabilidad» con la que §7.11 lo evalúa.
 */
function assertClaimType(corpus: IngestedCorpus, claim: ExtractedClaim): void {
  const componentes = new Set(
    claim.anchors.map(
      (a) => corpus.fragments.find((f) => f.fragmentId === a.fragmentId)?.sourceComponent,
    ),
  );

  switch (claim.claimType) {
    case 'source_assertion':
      if (claim.anchors.length === 0) {
        throw new ClaimTypeViolationError(
          `El claim ${claim.claimId} es source_assertion y no cita ningún fragmento. §7.11 pide que ` +
            `sea verificable desde el fragmento citado sin conocimiento externo, y sin cita no hay ` +
            `nada contra lo que verificarlo.`,
        );
      }
      return;

    case 'cross_source_consensus':
      if (componentes.size < 2) {
        throw new ClaimTypeViolationError(
          `El claim ${claim.claimId} es cross_source_consensus y solo se apoya en ` +
            `${componentes.size} componente(s). Coincidir consigo mismo no es consenso, y dos ` +
            `fragmentos de la misma obra son una sola fuente.`,
        );
      }
      return;

    case 'system_inference':
      if (claim.anchors.length > 0) {
        throw new ClaimTypeViolationError(
          `El claim ${claim.claimId} es system_inference y cita fragmentos. Si una fuente lo ` +
            `aseverase sería source_assertion; etiquetarlo como inferencia lo sacaría del ` +
            `denominador de atribución de §7.11 sin que nadie tocara la métrica.`,
        );
      }
      if (claim.supportingClaims.length === 0) {
        throw new ClaimTypeViolationError(
          `El claim ${claim.claimId} es system_inference y no declara de qué claims se infiere. ` +
            `§7.11 lo evalúa «por su propia trazabilidad»: sin soporte no hay ninguna.`,
        );
      }
      return;
  }
}

/**
 * Construye la extracción validada de W2.
 *
 * Lanza en vez de devolver una extracción parcial: una extracción a medias se
 * leería como el corpus completo ya extraído, y W3 generaría reactivos sobre un
 * mapa que no cubre lo que dice cubrir.
 */
export function buildExtraction(corpus: IngestedCorpus, input: ExtractionInput): Extraction {
  if (input.claims.length === 0) {
    throw new IncompleteExtractionError(
      'La extracción no tiene ningún claim. Eso no es «el corpus no afirmaba nada», es «no se ' +
        'extrajo»: sin claims no hay eslabón entre fragmento y decisión curricular.',
    );
  }

  // Identidad primero: si dos elementos comparten id, cualquier comprobación
  // posterior podría estar mirando el elemento equivocado.
  const ids = [
    ...input.items.map((i) => i.itemId),
    ...input.claims.map((c) => c.claimId),
    ...input.curricularDecisions.map((d) => d.decisionId),
  ];
  const repetidos = ids.filter((id, indice) => ids.indexOf(id) !== indice);
  if (repetidos.length > 0) {
    throw new DuplicateExtractionIdError(
      `Identificadores repetidos: ${[...new Set(repetidos)].join(', ')}. La cadena de §7.11 se ` +
        `recorre por id, y con uno repetido el recorrido se bifurca en vez de reconstruir una pieza.`,
    );
  }

  for (const item of input.items) {
    if (item.anchors.length === 0) {
      throw new UnanchoredExtractionError(
        `El elemento ${item.itemId} (${item.section}) no cita ningún fragmento. Rol A entrega ` +
          `«referencias exactas»: sin ellas no consta de dónde salió.`,
      );
    }
    for (const anchor of item.anchors) {
      assertAnchor(corpus, `El elemento ${item.itemId}`, anchor);
    }
  }

  const claimsPorId = new Map(input.claims.map((c) => [c.claimId, c]));

  for (const claim of input.claims) {
    for (const anchor of claim.anchors) {
      assertAnchor(corpus, `El claim ${claim.claimId}`, anchor);
    }
    assertClaimType(corpus, claim);

    for (const soporte of claim.supportingClaims) {
      if (!claimsPorId.has(soporte)) {
        throw new UnanchoredExtractionError(
          `El claim ${claim.claimId} se apoya en ${soporte}, que no es un claim de esta extracción.`,
        );
      }
      if (soporte === claim.claimId) {
        throw new ClaimTypeViolationError(
          `El claim ${claim.claimId} se apoya en sí mismo. Una inferencia que se sostiene sola no ` +
            `tiene trazabilidad que evaluar.`,
        );
      }
    }
  }

  for (const decision of input.curricularDecisions) {
    if (decision.supportingClaims.length === 0) {
      throw new IncompleteExtractionError(
        `La decisión ${decision.decisionId} no declara claims de soporte. §7.11 las registra «con ` +
          `sus claims de soporte y su justificación»: sin soporte, la decisión no se distingue de ` +
          `una preferencia.`,
      );
    }
    if (decision.justification.trim() === '') {
      throw new IncompleteExtractionError(
        `La decisión ${decision.decisionId} no trae justificación.`,
      );
    }
    for (const soporte of decision.supportingClaims) {
      if (!claimsPorId.has(soporte)) {
        throw new UnanchoredExtractionError(
          `La decisión ${decision.decisionId} se apoya en ${soporte}, que no es un claim de esta ` +
            `extracción.`,
        );
      }
    }
  }

  return Object.freeze({
    extractionVersion: 'w2-extraction-v1',
    courseId: corpus.courseId,
    items: Object.freeze([...input.items]),
    claims: Object.freeze([...input.claims]),
    curricularDecisions: Object.freeze([...input.curricularDecisions]),
  } satisfies Extraction);
}

/**
 * Claims que entran en el **denominador de atribución de fuente** (§7.11).
 *
 * `system_inference` queda fuera —literal de la norma— «en lugar de contarse
 * automáticamente como fallo»: no se le puede exigir atribuibilidad a una fuente
 * a algo que ninguna fuente afirma, y contarlo como fallo castigaría al sistema
 * por razonar bien.
 */
export function attributionDenominator(extraction: Extraction): readonly ExtractedClaim[] {
  return Object.freeze(extraction.claims.filter((c) => c.claimType !== 'system_inference'));
}

/**
 * Reconstruye la cadena de §7.11 hacia atrás desde un claim, hasta las fuentes.
 *
 * Un `system_inference` no tiene fuentes propias, así que se recorre por sus
 * claims de soporte: sin ese recorrido, «se evalúa por su propia trazabilidad»
 * no sería comprobable.
 */
export function traceToSources(extraction: Extraction, claimId: string): readonly string[] {
  const porId = new Map(extraction.claims.map((c) => [c.claimId, c]));
  const fuentes = new Set<string>();
  const vistos = new Set<string>();

  const recorrer = (id: string): void => {
    if (vistos.has(id)) return;
    vistos.add(id);

    const claim = porId.get(id);
    if (claim === undefined) return;

    for (const anchor of claim.anchors) fuentes.add(anchor.fragmentId);
    for (const soporte of claim.supportingClaims) recorrer(soporte);
  };

  recorrer(claimId);
  return Object.freeze([...fuentes].sort());
}
