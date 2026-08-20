import { CorpusDriftError, IncompleteIngestionInputError } from './errors.js';
import {
  ingestCorpus,
  sha256Hex,
  type ComponentUseVerdict,
  type IngestedCorpus,
  type LoadedComponent,
  type RequiredSection,
} from './ingestion.js';
import type { InventoryItem, SelectionManifest } from './selection-manifest.js';

/**
 * Runner de W1 (T-H5-01): conecta la propuesta firmada de W0 con
 * `ingestCorpus()`. Puro: quien descarga el tarball, extrae los `.tex` y
 * escribe a disco es el script (`scripts/content/w1-ingest-run.mjs`), igual
 * que `w0-live-run.mjs` hizo con W0.
 *
 * ## La costura de identidad, dicha con precisión (D-51)
 *
 * W0 ancló la identidad del componente al **tarball**: `snapshotSha256` del
 * manifiesto es el SHA-256 de los bytes gzip que devolvió GitHub. W1 ingiere
 * **texto** extraído de ese tarball, y `ingestCorpus()` exige que
 * `sha256Hex(content)` reproduzca el snapshot del manifiesto. Un gzip no es
 * UTF-8 válido, así que ninguna cadena de texto puede reproducir ese hash:
 * son dos sustratos distintos de la misma identidad.
 *
 * La resolución **no** es tocar `ingestCorpus` (mecanismo verificado) ni
 * actualizar el hash del manifiesto firmado (eso borraría que la fuente
 * cambió). Es verificar la identidad **en dos niveles, cada uno en su
 * sustrato**:
 *
 * 1. **Nivel tarball (identidad W0).** El borde impuro hashea los bytes
 *    descargados y declara el resultado en `tarballSha256`; el runner lo
 *    compara con el `snapshotSha256` del inventario de W0. Si difieren ⇒
 *    deriva ⇒ `CorpusDriftError` y vuelta a W0, no re-hasheo.
 * 2. **Nivel contenido (identidad W1).** El runner hashea el texto cargado y
 *    lo compara con el registrado por la ingesta **previa**
 *    (`priorContentSha256` de `source/manifest.yaml`); en la primera ingesta
 *    no hay previa y el hash queda fijado —anclado externamente por el nivel
 *    1, que es lo que impide que «fijar en la primera corrida» sea aceptar lo
 *    que sea—. Luego invoca `ingestCorpus()` con una **proyección explícita**
 *    del manifiesto en la que `snapshotSha256` es el hash del contenido: la
 *    comprobación interna de `ingestCorpus` sigue corriendo, sobre el sustrato
 *    que ella misma define.
 */

/** Un componente cargado por el borde impuro, con su identidad a nivel bytes declarada. */
export interface W1ComponentLoad {
  readonly loaded: LoadedComponent;
  /**
   * SHA-256 de los **bytes del tarball** descargado, computado por el script.
   * El runner exige que coincida con el `snapshotSha256` que W0 registró: un
   * booleano «ya lo verifiqué» sería la garantía que se apaga sola (§3.1.e del
   * HANDOFF); aquí viaja el dato y la comparación la hace este código.
   */
  readonly tarballSha256: string;
}

export interface W1RunInput {
  /** Manifiesto de W0 tal como quedó firmado por el CORPUS_APPROVER. */
  readonly manifest: SelectionManifest;
  readonly components: readonly W1ComponentLoad[];
  readonly authorizedNotationFamily: string;
  readonly candidateKcs: readonly string[];
  readonly requiredSections: readonly RequiredSection[];
  readonly useVerdicts: readonly ComponentUseVerdict[];
  /**
   * Hash del contenido textual por componente según la ingesta **previa**
   * (`source/manifest.yaml`). Ausente en la primera ingesta: entonces el hash
   * se fija, anclado por la verificación de tarball del nivel 1.
   */
  readonly priorContentSha256?: Readonly<Record<string, string>>;
}

export interface W1RunResult {
  readonly corpus: IngestedCorpus;
  /** Hash del contenido textual por componente, para `source/manifest.yaml`. */
  readonly contentSha256: Readonly<Record<string, string>>;
  /** Qué se fijó en esta corrida (p. ej. primera ingesta), para el registro. */
  readonly identityNotes: readonly string[];
}

export function runW1(input: W1RunInput): W1RunResult {
  if (input.components.length === 0) {
    throw new IncompleteIngestionInputError(
      'runW1 recibió cero componentes. Un corpus vacío no es «no había nada», es «no se cargó».',
    );
  }

  const inventarioPorComponente = new Map(
    input.manifest.inventory.map((i) => [i.sourceComponent, i]),
  );
  const contentSha256: Record<string, string> = {};
  const identityNotes: string[] = [];

  for (const { loaded, tarballSha256 } of input.components) {
    const entrada = inventarioPorComponente.get(loaded.sourceComponent);
    if (entrada === undefined) {
      // Lo reporta ingestCorpus con su propio error; aquí solo se necesita la
      // entrada para los dos niveles de identidad.
      continue;
    }

    // Nivel 1: bytes del tarball contra el snapshot que W0 evaluó.
    if (tarballSha256 !== entrada.snapshotSha256) {
      throw new CorpusDriftError(
        `Deriva a nivel tarball en ${loaded.sourceComponent}: W0 registró ` +
          `${entrada.snapshotSha256} y la descarga hashea ${tarballSha256}. La fuente cambió ` +
          `después de evaluarse; la salida es reevaluar en W0, no re-hashear.`,
      );
    }

    // Nivel 2: texto cargado contra la ingesta previa, si la hay.
    const hash = sha256Hex(loaded.content);
    const previo = input.priorContentSha256?.[loaded.sourceComponent];
    if (previo !== undefined && previo !== hash) {
      throw new CorpusDriftError(
        `Deriva de contenido en ${loaded.sourceComponent}: la ingesta previa registró ${previo} ` +
          `y lo cargado hashea ${hash}. Mismo tarball, distinto texto: la extracción cambió y ` +
          `hay que mirar por qué antes de seguir.`,
      );
    }
    if (previo === undefined) {
      identityNotes.push(
        `${loaded.sourceComponent}: primera ingesta — se fija la identidad textual ${hash}, ` +
          `anclada al tarball verificado ${tarballSha256}.`,
      );
    }
    contentSha256[loaded.sourceComponent] = hash;
  }

  // Proyección explícita: ingestCorpus compara sha256Hex(content) con el
  // snapshot del manifiesto, y el del manifiesto firmado es del tarball. Se le
  // entrega el manifiesto con el hash en el sustrato que esa comprobación
  // define. El manifiesto firmado no se toca: esto es una copia.
  const manifiestoProyectado: SelectionManifest = {
    ...input.manifest,
    inventory: Object.freeze(
      input.manifest.inventory.map((item): InventoryItem => {
        const hash = contentSha256[item.sourceComponent];
        return hash === undefined ? item : { ...item, snapshotSha256: hash };
      }),
    ),
  };

  const corpus = ingestCorpus({
    manifest: manifiestoProyectado,
    components: input.components.map((c) => c.loaded),
    authorizedNotationFamily: input.authorizedNotationFamily,
    candidateKcs: input.candidateKcs,
    requiredSections: input.requiredSections,
    useVerdicts: input.useVerdicts,
  });

  return {
    corpus,
    contentSha256: Object.freeze(contentSha256),
    identityNotes: Object.freeze(identityNotes),
  };
}
