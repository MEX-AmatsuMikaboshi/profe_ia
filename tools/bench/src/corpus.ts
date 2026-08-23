import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  AuthorizedFragment,
  FeedbackTemplate,
  FrozenAsset,
  FrozenAssetKind,
} from '@profesor-ia/model-gateway';

/**
 * Carga del paquete de contenido real para BENCH-01 (T-H4-10 ← D-45, §3.5 del
 * handoff).
 *
 * ## Por qué existe este módulo
 *
 * `scoring.ts` documentó que **dos de los seis gates de P-III §6.2 no se podían
 * computar**: el de anclas necesita fragmentos autorizados y el de recuperación
 * necesita activos congelados, y `content/` eran marcadores. Ya no lo son —W0 a
 * W4 corrieron sobre el corpus real—, así que lo que faltaba deja de ser un
 * muro y pasa a ser este cargador.
 *
 * ## Las tres decisiones que lo ordenan
 *
 * **1. El texto del fragmento sale de la extracción, no del tarball.** W1
 * guarda de cada fragmento su id, su hash y su autorización, pero **no su
 * texto**: la unidad de anclaje es el id, y copiar el libro dentro del
 * repositorio no era lo que la ingesta prometía. El texto autorizado que sí
 * existe es el de `extracted/` —definiciones, reglas, notación, restricciones y
 * afirmaciones—, cada uno con las anclas del fragmento del que salió. Un
 * fragmento reúne los enunciados que lo citan.
 *
 * **2. Un fragmento sin texto extraído no se publica como fragmento
 * autorizado.** Publicarlo con texto vacío dejaría resolver anclas contra la
 * nada: el gate de anclas daría verde porque el ancla «existe», y lo que mide
 * es que el segmento se apoye en algo. Se cuentan aparte y el número viaja en
 * el paquete.
 *
 * **3. Esto NO es un freeze, y el paquete lo dice.** W5 no ha corrido:
 * `freeze-manifest.json` sigue siendo el marcador de F0 y `ci:freeze:drift`
 * falla cerrado contra él, que es el resultado correcto. `frozen` va en
 * `false`, `assetVersion` se deriva de la corrida que produjo el material, y
 * `assertPackageMayCrownWinner()` impide que una corrida sobre material sin
 * congelar corone a nadie. P-III §6.2 mide sobre activos congelados; medir
 * sobre los de hoy es legítimo y **orientativo**, y decir lo contrario sería el
 * mismo éxito simulado que el gate existe para cazar.
 */

export class CorpusLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Clases de activo que el corpus de hoy **no** puede sostener, con su motivo. */
export interface AssetKindNotDerivable {
  readonly kind: FrozenAssetKind;
  readonly reason: string;
}

export interface ContentPackage {
  readonly courseId: string;
  /** `corpusVersion` de `source/manifest.yaml`. */
  readonly corpusVersion: string;
  /** Momento de la corrida W3 que produjo los reactivos y sus pistas. */
  readonly itemsGeneratedAt: string;
  /**
   * Versión del material con la que se etiquetan los activos. **Derivada**, no
   * escrita: si el corpus o la corrida de autoría cambian, cambia sola.
   */
  readonly assetVersion: string;
  /** Falso mientras W5 no haya corrido. Ver la decisión 3 de la cabecera. */
  readonly frozen: boolean;
  readonly frozenReason: string;
  /** Fragmentos autorizados por bloque; el bloque es el KC (P-I §9.4, §5.2). */
  readonly authorizedFragmentsByBlock: ReadonlyMap<string, readonly AuthorizedFragment[]>;
  /** Fragmentos del corpus sin texto extraído, contados y no publicados. */
  readonly fragmentsWithoutExtractedText: number;
  readonly frozenAssets: readonly FrozenAsset[];
  readonly feedbackTemplates: readonly FeedbackTemplate[];
  readonly assetKindsNotDerivable: readonly AssetKindNotDerivable[];
}

interface FragmentoDeCorpus {
  readonly fragmentId: string;
  readonly location: string;
  readonly relatedConcepts: readonly string[];
  readonly authorizationStatus: string;
}

interface EnunciadoExtraido {
  readonly itemId: string;
  readonly section: string;
  readonly statement: string;
  readonly anchors: readonly { readonly fragmentId: string }[];
}

interface PistaDeReactivo {
  readonly level: number;
  readonly text: string;
}

interface ReactivoPublicado {
  readonly candidateId: string;
  readonly targetKcs: readonly string[];
  readonly hints: readonly PistaDeReactivo[];
}

/** Secciones de `extracted/` que aportan texto de fragmento. */
const SECCIONES_EXTRAIDAS = ['definitions', 'rules', 'notation', 'restrictions'] as const;

/** Reservas de `items/` de las que salen las pistas congeladas. */
const RESERVAS_CON_PISTAS = [
  'diagnostic',
  'guided-practice',
  'independent-practice',
  'recovery',
  'replacement',
  'transfer',
] as const;

function leerJsonConCabecera(ruta: string): unknown {
  let crudo: string;
  try {
    crudo = readFileSync(ruta, 'utf8');
  } catch {
    throw new CorpusLoadError(
      `No se pudo leer ${ruta}. El cargador no sustituye un artefacto ausente por uno vacío: un ` +
        `paquete a medias mediría gates sobre material que nadie produjo.`,
    );
  }
  return JSON.parse(crudo.replace(/^(#[^\n]*\n)+/, '')) as unknown;
}

/**
 * Reúne el texto autorizado de cada fragmento desde `extracted/`.
 *
 * Los enunciados se ordenan por `itemId` y no por el orden del archivo: el
 * texto de un fragmento entra en el prompt de una sesión, y que dependa del
 * orden de escritura haría dos paquetes distintos de la misma extracción.
 */
function textoPorFragmento(contenido: string): ReadonlyMap<string, string> {
  const porFragmento = new Map<string, string[]>();
  for (const seccion of SECCIONES_EXTRAIDAS) {
    const archivo = leerJsonConCabecera(join(contenido, 'extracted', `${seccion}.yaml`)) as {
      readonly items?: readonly EnunciadoExtraido[];
    };
    const items = archivo.items ?? [];
    if (items.length === 0) {
      throw new CorpusLoadError(
        `\`extracted/${seccion}.yaml\` no trae enunciados. Sin ellos los fragmentos de esa ` +
          `sección quedarían sin texto y sus anclas resolverían contra la nada.`,
      );
    }
    for (const item of [...items].sort((a, b) => a.itemId.localeCompare(b.itemId))) {
      for (const ancla of item.anchors) {
        porFragmento.set(ancla.fragmentId, [
          ...(porFragmento.get(ancla.fragmentId) ?? []),
          item.statement,
        ]);
      }
    }
  }
  return new Map([...porFragmento].map(([id, partes]) => [id, partes.join(' ')]));
}

/**
 * Pistas congeladas, una por reactivo y nivel.
 *
 * La clave es `${candidateId}:${level}` porque es la que el motor conoce: en
 * modo degradado la pista se sirve del banco, y `DegradedProfile` lanza si la
 * clave no está, que es lo que impide que un hueco se lea como «el núcleo
 * respondió».
 */
function pistasCongeladas(contenido: string, assetVersion: string): readonly FrozenAsset[] {
  const activos: FrozenAsset[] = [];
  for (const reserva of RESERVAS_CON_PISTAS) {
    const archivo = leerJsonConCabecera(join(contenido, 'items', reserva, 'items.yaml')) as {
      readonly items?: readonly ReactivoPublicado[];
    };
    for (const reactivo of archivo.items ?? []) {
      for (const pista of reactivo.hints) {
        activos.push({
          kind: 'pista',
          key: `${reactivo.candidateId}:${String(pista.level)}`,
          text: pista.text,
          freezeVersion: assetVersion,
        });
      }
    }
  }
  return activos;
}

/**
 * Explicaciones congeladas: un activo por enunciado extraído y uno por KC.
 *
 * El de KC es el que sirve al modo degradado cuando la operación es
 * `explain_block`: la caída ocurre sobre un bloque, no sobre una definición
 * suelta. Se compone de los enunciados de los fragmentos de ese KC, en orden de
 * `itemId`, sin una sola palabra añadida — si se redactara un enlace entre
 * ellos, el modo degradado dejaría de servir para aislar si el fallo vino del
 * modelo o del núcleo, que es su razón de existir (P-II §8.6).
 */
function explicacionesCongeladas(
  contenido: string,
  fragmentosPorBloque: ReadonlyMap<string, readonly AuthorizedFragment[]>,
  assetVersion: string,
): readonly FrozenAsset[] {
  const activos: FrozenAsset[] = [];
  for (const seccion of SECCIONES_EXTRAIDAS) {
    const archivo = leerJsonConCabecera(join(contenido, 'extracted', `${seccion}.yaml`)) as {
      readonly items?: readonly EnunciadoExtraido[];
    };
    for (const item of archivo.items ?? []) {
      activos.push({
        kind: 'explicacion',
        key: item.itemId,
        text: item.statement,
        freezeVersion: assetVersion,
      });
    }
  }
  for (const [bloque, fragmentos] of fragmentosPorBloque) {
    activos.push({
      kind: 'explicacion',
      key: bloque,
      text: fragmentos.map((f) => f.text).join(' '),
      freezeVersion: assetVersion,
    });
  }
  return activos;
}

function plantillasDeFeedback(contenido: string, assetVersion: string): readonly FeedbackTemplate[] {
  const patrones = leerJsonConCabecera(
    join(contenido, 'session-templates', 'base-patterns.yaml'),
  ) as {
    readonly selfExplanationTemplate?: { readonly templateId: string; readonly prompt: string };
    readonly taskFeedbackTemplate?: { readonly templateId: string; readonly prompt: string };
  };
  const plantillas: FeedbackTemplate[] = [];
  for (const plantilla of [patrones.taskFeedbackTemplate, patrones.selfExplanationTemplate]) {
    if (plantilla === undefined) continue;
    plantillas.push({
      key: plantilla.templateId,
      template: plantilla.prompt,
      freezeVersion: assetVersion,
    });
  }
  if (plantillas.length === 0) {
    throw new CorpusLoadError(
      '`session-templates/base-patterns.yaml` no trae ninguna plantilla de retroalimentación. ' +
        'P-II §8.6 define el modo degradado con retroalimentación plantillada; sin plantillas no ' +
        'hay modo degradado que medir.',
    );
  }
  return plantillas;
}

/**
 * Lo que el corpus de hoy no sostiene, declarado en vez de rellenado.
 *
 * `ejemplo` es la clase que falta y **no se fabrica**: un ejemplo trabajado es
 * una derivación resuelta, las derivaciones viven en `solutions-private/` y el
 * invariante I-2 impide que `model-gateway` las alcance. Servir el enunciado de
 * un reactivo llamándolo ejemplo trabajado sería dar por resuelto lo que no lo
 * está, y en modo degradado eso es exactamente lo que no puede pasar.
 */
const CLASES_NO_DERIVABLES: readonly AssetKindNotDerivable[] = Object.freeze([
  {
    kind: 'ejemplo',
    reason:
      'Un ejemplo trabajado es una derivación resuelta y las derivaciones viven en ' +
      '`solutions-private/`, que `model-gateway` no puede alcanzar (I-2). Servir el enunciado de ' +
      'un reactivo como si fuera un ejemplo trabajado daría por resuelto lo que no lo está.',
  },
  {
    kind: 'feedback',
    reason:
      'La retroalimentación congelada es plantillada, no un activo con texto fijo: entra por ' +
      '`feedbackTemplates` y sus huecos los rellena el verificador (P-II §8.6, §5.10).',
  },
]);

/**
 * Carga el paquete de contenido desde el directorio del curso.
 *
 * No cachea a propósito: la corrida material se hace una vez y una caché
 * escondería que el material cambió entre dos llamadas.
 */
export function loadContentPackage(contentRoot: string): ContentPackage {
  const manifiesto = leerJsonConCabecera(join(contentRoot, 'source', 'manifest.yaml')) as {
    readonly corpusVersion: string;
    readonly courseId: string;
    readonly components: readonly { readonly sourceComponent: string }[];
  };
  const corrida = leerJsonConCabecera(join(contentRoot, 'audits', 'w3-run.yaml')) as {
    readonly ranAt: string;
  };
  const assetVersion = `${manifiesto.corpusVersion}+w3@${corrida.ranAt}`;

  const textos = textoPorFragmento(contentRoot);

  const porBloque = new Map<string, AuthorizedFragment[]>();
  let sinTexto = 0;
  for (const componente of manifiesto.components) {
    const archivo = componente.sourceComponent.replace(/\//g, '--');
    const fragmentos = leerJsonConCabecera(
      join(contentRoot, 'source', 'fragments', `${archivo}.json`),
    ) as readonly FragmentoDeCorpus[];
    for (const fragmento of fragmentos) {
      if (fragmento.authorizationStatus !== 'autorizado') continue;
      const texto = textos.get(fragmento.fragmentId);
      if (texto === undefined || texto.length === 0) {
        sinTexto += 1;
        continue;
      }
      for (const bloque of fragmento.relatedConcepts) {
        porBloque.set(bloque, [
          ...(porBloque.get(bloque) ?? []),
          { fragmentId: fragmento.fragmentId, blockId: bloque, text: texto },
        ]);
      }
    }
  }
  if (porBloque.size === 0) {
    throw new CorpusLoadError(
      'Ningún fragmento autorizado quedó asociado a un bloque. Un paquete sin fragmentos por ' +
        'bloque haría irresoluble toda ancla, y el gate de anclas no daría 95 %: daría cero.',
    );
  }
  const fragmentosPorBloque: ReadonlyMap<string, readonly AuthorizedFragment[]> = new Map(
    [...porBloque]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bloque, fragmentos]) => [
        bloque,
        [...fragmentos].sort((x, y) => x.fragmentId.localeCompare(y.fragmentId)),
      ]),
  );

  return Object.freeze({
    courseId: manifiesto.courseId,
    corpusVersion: manifiesto.corpusVersion,
    itemsGeneratedAt: corrida.ranAt,
    assetVersion,
    frozen: false,
    frozenReason:
      'W5 no ha corrido: `freeze-manifest.json` sigue siendo el marcador de F0 y ' +
      '`ci:freeze:drift` falla cerrado contra él. P-III §6.2 mide sobre activos congelados, así ' +
      'que una corrida sobre este material es orientativa y no corona a nadie.',
    authorizedFragmentsByBlock: fragmentosPorBloque,
    fragmentsWithoutExtractedText: sinTexto,
    frozenAssets: Object.freeze([
      ...explicacionesCongeladas(contentRoot, fragmentosPorBloque, assetVersion),
      ...pistasCongeladas(contentRoot, assetVersion),
    ]),
    feedbackTemplates: plantillasDeFeedback(contentRoot, assetVersion),
    assetKindsNotDerivable: CLASES_NO_DERIVABLES,
  });
}

/**
 * Freno antes de coronar. Un dictamen exige material congelado (P-III §6.2), y
 * `verdictFor()` ya impide que un piloto dictamine; esto cierra la otra puerta,
 * la de una corrida material sobre un paquete que todavía no pasó por W5.
 */
export function assertPackageMayCrownWinner(paquete: ContentPackage): void {
  if (!paquete.frozen) {
    throw new CorpusLoadError(
      `El paquete de contenido \`${paquete.assetVersion}\` no está congelado, así que ninguna ` +
        `corrida sobre él corona un ganador de BENCH-01. ${paquete.frozenReason}`,
    );
  }
}
