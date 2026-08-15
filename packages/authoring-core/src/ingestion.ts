import { createHash } from 'node:crypto';
import {
  AuthoringCoreError,
  CorpusDriftError,
  IllegibleFragmentError,
  IncompleteIngestionInputError,
  UnauthorizedComponentError,
} from './errors.js';
import type { LicenseUse, LicenseVerdict } from './licensing.js';
import type { InventoryItem, InventoryStatus, SelectionManifest } from './selection-manifest.js';

/**
 * W1 — Ingesta del corpus (T-H5-01 ← Maestro P-II §12 «W1», P-III §3.2 y §3.3).
 *
 * Los seis pasos de §12 en orden: cargar, hashear, registrar licencia y origen,
 * fragmentar con IDs estables, validar legibilidad y **bloquear la modificación
 * por el pipeline**.
 *
 * Dos cosas gobiernan el diseño y conviene no perderlas:
 *
 * 1. **W1 no decide nada sobre licencias.** Eso lo decidió W0 (`T-H45-05`) y aquí
 *    solo se transporta. Por eso los usos permitidos entran como veredictos ya
 *    emitidos y **un uso no declarado no está permitido**: si W1 volviera a
 *    clasificar, dos módulos podrían dar respuestas distintas sobre el mismo
 *    material, y el caso Calgary —documental sí, base expresiva no— dejaría de
 *    ser una sola verdad.
 * 2. **El orden de las comprobaciones es el requisito**, igual que en la
 *    clasificación de salida de la pasarela. Primero identidad (¿son los bytes
 *    que W0 evaluó?), después legibilidad, y solo entonces las seis validaciones
 *    de bloqueo de P-III §3.2. Al revés, un informe diría «KC sin cobertura» de
 *    un documento que ni siquiera es el evaluado.
 */

/**
 * Las **seis** causas literales por las que P-III §3.2 bloquea el corpus.
 * Lista cerrada: una causa nueva es un hallazgo que hay que ver, no una entrada
 * más.
 */
export const CORPUS_BLOCK_REASONS = [
  'reglas_contradictorias_sin_aclaracion',
  'notaciones_incompatibles',
  'kc_candidatos_sin_cobertura',
  'sin_anclaje_por_fragmento',
  'licencia_no_registrada',
  'secciones_faltantes',
] as const;
export type CorpusBlockReason = (typeof CORPUS_BLOCK_REASONS)[number];

export interface CorpusBlock {
  readonly reason: CorpusBlockReason;
  readonly detail: string;
}

/**
 * El corpus queda bloqueado. Lleva **todas** las causas encontradas, no la
 * primera: quien tenga que corregir el corpus necesita ver qué falta, no solo
 * que falta algo (mismo criterio que `manifestReadiness`).
 */
export class CorpusBlockedError extends AuthoringCoreError {
  constructor(readonly blocks: readonly CorpusBlock[]) {
    super(
      `El corpus se bloquea por ${blocks.length} causa(s) de P-III §3.2:\n` +
        blocks.map((b) => `  · ${b.reason}: ${b.detail}`).join('\n'),
    );
  }
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Sección cargada. Los campos son los de P-III §3.3 que no se derivan. */
export interface LoadedSection {
  /** Ubicación citable dentro del componente (§3.3 «ubicación»). */
  readonly location: string;
  /**
   * §3.3 «tipo». Cadena libre **a propósito**: la norma pide el campo pero no
   * enumera los tipos, y cerrar aquí un catálogo decidiría por cuenta propia qué
   * clases de material admite el corpus. Lo contrario que los modos de acceso de
   * W0, que sí están cerrados porque §7.0 prohíbe uno por su nombre.
   */
  readonly kind: string;
  readonly text: string;
  /** §3.3 «conceptos relacionados». Es lo que sostiene la cobertura de KC. */
  readonly relatedConcepts: readonly string[];
}

export interface LoadedComponent {
  readonly sourceComponent: string;
  readonly sourceVersion: string;
  /** §12 «W1» paso 3: se registra el origen junto con la licencia. */
  readonly origin: string;
  /** Familia de notación que el componente usa, como en `SourceClaim` de W0. */
  readonly notationFamily: string;
  /**
   * Aclaración cuando la notación difiere de la autorizada. Es la
   * `convencion_alternativa` de W0 hecha explícita por componente: una diferencia
   * **clasificada** no es una incompatibilidad, una sin aclarar sí.
   */
  readonly notationReconciliation?: string;
  /** Contenido completo tal como W0 lo hasheó. Su SHA-256 debe reproducir el snapshot. */
  readonly content: string;
  readonly sections: readonly LoadedSection[];
}

/** Sección declarada como necesaria; su ausencia es «faltan páginas o secciones». */
export interface RequiredSection {
  readonly sourceComponent: string;
  readonly location: string;
}

/**
 * Veredicto de licencia **por uso previsto**, tal como lo produjo W0. Un uso que
 * no aparezca aquí no queda permitido: lo desconocido no es permiso.
 */
export interface ComponentUseVerdict {
  readonly sourceComponent: string;
  readonly intendedUse: LicenseUse;
  readonly verdict: LicenseVerdict;
}

export interface IngestionInput {
  /** Salida de W0 (`T-H45-06`). Es la que fija la identidad esperada de cada componente. */
  readonly manifest: SelectionManifest;
  readonly components: readonly LoadedComponent[];
  readonly authorizedNotationFamily: string;
  /** KC candidatos del conjunto. El mapa se construye en W2; aquí solo se comprueba cobertura. */
  readonly candidateKcs: readonly string[];
  readonly requiredSections: readonly RequiredSection[];
  readonly useVerdicts: readonly ComponentUseVerdict[];
}

/** Fragmento con los siete campos de P-III §3.3, más los usos que W0 permitió. */
export interface Fragment {
  /** §3.3 «ID estable». Derivado, no correlativo: ver `fragmentId()`. */
  readonly fragmentId: string;
  /** §3.3 «fuente». */
  readonly sourceComponent: string;
  readonly sourceVersion: string;
  /** §3.3 «ubicación». */
  readonly location: string;
  /** §3.3 «hash». */
  readonly sha256: string;
  /** §3.3 «tipo». */
  readonly kind: string;
  /** §3.3 «conceptos relacionados». */
  readonly relatedConcepts: readonly string[];
  /** §3.3 «estado autorizado», heredado de la decisión de W0. */
  readonly authorizationStatus: InventoryStatus;
  readonly permittedUses: readonly LicenseUse[];
}

export interface IngestedComponent {
  readonly sourceComponent: string;
  readonly sourceVersion: string;
  readonly origin: string;
  readonly notationFamily: string;
  readonly snapshotSha256: string;
  readonly licenseEvidence: string;
  readonly authorizationStatus: InventoryStatus;
  readonly permittedUses: readonly LicenseUse[];
}

export interface IngestedCorpus {
  readonly corpusVersion: 'w1-corpus-v1';
  readonly courseId: string;
  readonly components: readonly IngestedComponent[];
  readonly fragments: readonly Fragment[];
  /**
   * KC cubiertos **solo** por fragmentos que no son base expresiva (caso
   * Calgary). No bloquea —ninguna autoridad dice que deba— pero queda registrado:
   * sin este dato, W3 descubriría en plena autoría que no puede construir
   * reactivos para ese KC, y el hueco parecería un fallo del generador.
   */
  readonly kcsWithoutExpressiveBase: readonly string[];
}

/**
 * ID estable de un fragmento (§12 «W1» paso 4).
 *
 * Se **deriva** de la terna que lo identifica en vez de asignarse por contador:
 * un correlativo cambiaría al reordenar o al añadir una sección, que es
 * exactamente lo que «estable» excluye. Es función pública para que W2 pueda
 * recalcular el ancla sin preguntarle a W1.
 */
export function fragmentId(
  sourceComponent: string,
  sourceVersion: string,
  location: string,
): string {
  return `${sourceComponent}@${sourceVersion}#${location}`;
}

/** U+FFFD: el decodificador reportando un byte que no pudo leer. */
const CARACTER_DE_REEMPLAZO = String.fromCodePoint(0xfffd);

/**
 * Controles C0 salvo tabulador, salto de linea y retorno de carro, mas DEL.
 * Se recorre por punto de codigo en vez de con una regex de rango: una clase con
 * caracteres de control literales es ilegible en el fuente y se lee mal al revisarla.
 */
function tieneControlNoImprimible(text: string): boolean {
  for (const caracter of text) {
    const codigo = caracter.codePointAt(0) ?? 0;
    if (codigo === 0x09 || codigo === 0x0a || codigo === 0x0d) continue;
    if (codigo < 0x20 || codigo === 0x7f) return true;
  }
  return false;
}

/**
 * Motivo de ilegibilidad, o `null` si el texto es legible.
 *
 * Los tres motivos son hechos comprobables del decodificador, no juicios: por eso
 * no hay ninguna fracción ni umbral. El carácter de reemplazo, en particular, es
 * el decodificador diciendo que no pudo leer un byte.
 */
export function legibilityFault(text: string): string | null {
  if (text.trim() === '') return 'el fragmento está vacío';
  if (text.includes(CARACTER_DE_REEMPLAZO)) {
    return 'contiene U+FFFD, que es el decodificador reportando un byte que no pudo leer';
  }
  if (tieneControlNoImprimible(text)) {
    return 'contiene controles C0 no imprimibles: residuo binario, no texto';
  }
  return null;
}

function congelarProfundo<T>(valor: T): T {
  if (Array.isArray(valor)) {
    for (const elemento of valor) congelarProfundo(elemento);
    return Object.freeze(valor);
  }
  if (typeof valor === 'object' && valor !== null) {
    for (const clave of Object.keys(valor)) {
      congelarProfundo((valor as Record<string, unknown>)[clave]);
    }
    return Object.freeze(valor);
  }
  return valor;
}

function usosPermitidos(
  sourceComponent: string,
  verdicts: readonly ComponentUseVerdict[],
): readonly LicenseUse[] {
  return Object.freeze(
    verdicts
      .filter((v) => v.sourceComponent === sourceComponent && !v.verdict.blocked)
      .map((v) => v.intendedUse),
  );
}

/**
 * Ejecuta W1 sobre el material cargado y devuelve el corpus ingerido, ya sellado.
 *
 * Lanza —nunca devuelve un corpus degradado— con **cinco** errores distintos,
 * porque las causas son distintas y colapsarlas escondería cuál ocurrió: entrada
 * incompleta, componente no autorizado por W0, deriva de identidad, ilegibilidad,
 * y las seis de P-III §3.2 agrupadas en `CorpusBlockedError`.
 */
export function ingestCorpus(input: IngestionInput): IngestedCorpus {
  assertEntradaCompleta(input);

  const inventarioPorComponente = new Map(
    input.manifest.inventory.map((i) => [i.sourceComponent, i]),
  );

  // Paso 1–2: identidad. Antes que nada, porque validar contenido de un
  // artefacto que no es el evaluado describiría otro documento. El par
  // (cargado, entrada de inventario) se conserva para no volver a buscarlo
  // después con una aserción de que «seguro está».
  const emparejados: { componente: LoadedComponent; entrada: InventoryItem }[] = [];

  for (const componente of input.components) {
    const entrada = inventarioPorComponente.get(componente.sourceComponent);
    if (entrada === undefined) {
      throw new UnauthorizedComponentError(
        `El componente ${componente.sourceComponent} no aparece en el manifiesto de W0. W1 ingiere ` +
          `lo que W0 evaluó y autorizó; lo demás no tiene identidad contra la que comprobarse.`,
      );
    }
    if (entrada.status === 'excluido' || entrada.status === 'pendiente') {
      throw new UnauthorizedComponentError(
        `El componente ${componente.sourceComponent} está ${entrada.status} en el manifiesto de W0 ` +
          `y no se ingiere. Ingerir un pendiente trataría lo no decidido como autorizado.`,
      );
    }

    if (componente.sourceVersion !== entrada.sourceVersion) {
      throw new CorpusDriftError(
        `El componente ${componente.sourceComponent} se carga como ${componente.sourceVersion} y W0 ` +
          `evaluó ${entrada.sourceVersion}. La etiqueta de versión viaja dentro del fragment_id, así ` +
          `que aceptarla haría que las anclas citaran una versión que nadie evaluó.`,
      );
    }

    const recalculado = sha256Hex(componente.content);
    if (recalculado !== entrada.snapshotSha256) {
      throw new CorpusDriftError(
        `Deriva en ${componente.sourceComponent}@${componente.sourceVersion}: W0 registró ` +
          `${entrada.snapshotSha256} y lo cargado hashea ${recalculado}. La salida no es actualizar ` +
          `el hash —eso borraría que la fuente cambió después de evaluarse— sino reevaluar en W0.`,
      );
    }

    emparejados.push({ componente, entrada });
  }

  // Paso 5: legibilidad, antes de las validaciones de contenido.
  for (const componente of input.components) {
    for (const seccion of componente.sections) {
      const fallo = legibilityFault(seccion.text);
      if (fallo !== null) {
        throw new IllegibleFragmentError(
          `El fragmento ${fragmentId(componente.sourceComponent, componente.sourceVersion, seccion.location)} ` +
            `no es legible: ${fallo}.`,
        );
      }
    }
  }

  // Pasos 3–4 y las seis validaciones de bloqueo de P-III §3.2.
  const componentes = emparejados.map(
    ({ componente, entrada }): IngestedComponent => ({
      sourceComponent: componente.sourceComponent,
      sourceVersion: componente.sourceVersion,
      origin: componente.origin,
      notationFamily: componente.notationFamily,
      snapshotSha256: entrada.snapshotSha256,
      licenseEvidence: entrada.licenseEvidence,
      authorizationStatus: entrada.status,
      permittedUses: usosPermitidos(componente.sourceComponent, input.useVerdicts),
    }),
  );

  const fragmentos = emparejados.flatMap(({ componente, entrada }) =>
    componente.sections.map(
      (seccion): Fragment => ({
        fragmentId: fragmentId(
          componente.sourceComponent,
          componente.sourceVersion,
          seccion.location,
        ),
        sourceComponent: componente.sourceComponent,
        sourceVersion: componente.sourceVersion,
        location: seccion.location,
        sha256: sha256Hex(seccion.text),
        kind: seccion.kind,
        relatedConcepts: Object.freeze([...seccion.relatedConcepts]),
        authorizationStatus: entrada.status,
        permittedUses: usosPermitidos(componente.sourceComponent, input.useVerdicts),
      }),
    ),
  );

  const bloqueos = [
    ...bloqueosPorContradiccion(input),
    ...bloqueosPorNotacion(input),
    ...bloqueosPorAnclaje(fragmentos),
    ...bloqueosPorLicencia(componentes),
    ...bloqueosPorSeccionFaltante(input, fragmentos),
    ...bloqueosPorCoberturaKc(input, fragmentos),
  ];

  if (bloqueos.length > 0) throw new CorpusBlockedError(Object.freeze(bloqueos));

  const documentales = fragmentos.filter((f) => f.permittedUses.includes('fuente_documental'));
  const expresivos = documentales.filter((f) => f.permittedUses.includes('base_expresiva'));
  const conBaseExpresiva = new Set(expresivos.flatMap((f) => [...f.relatedConcepts]));

  // Paso 6: bloqueo de modificación por el pipeline. El corpus sale congelado en
  // profundidad y sin ninguna función que lo altere: no hay `add`, `update` ni
  // `remove` en este módulo, y una corrección posterior es una ingesta nueva con
  // su propia identidad, no un parche sobre esta.
  return congelarProfundo({
    corpusVersion: 'w1-corpus-v1',
    courseId: input.manifest.courseId,
    components: componentes,
    fragments: fragmentos,
    kcsWithoutExpressiveBase: input.candidateKcs.filter((kc) => !conBaseExpresiva.has(kc)),
  } satisfies IngestedCorpus);
}

/**
 * Una entrada vacía haría pasar por vacío la validación correspondiente, y un
 * control que no puede fallar es peor que no tenerlo.
 */
function assertEntradaCompleta(input: IngestionInput): void {
  if (input.components.length === 0) {
    throw new IncompleteIngestionInputError(
      'No se cargó ningún componente. Un corpus vacío no es «no había nada», es «no se cargó».',
    );
  }
  if (input.candidateKcs.length === 0) {
    throw new IncompleteIngestionInputError(
      'No se declararon KC candidatos. Sin ellos la validación «no cubre los KC candidatos» ' +
        '(P-III §3.2) pasaría por vacío y el corpus parecería cubrirlo todo.',
    );
  }
  if (input.requiredSections.length === 0) {
    throw new IncompleteIngestionInputError(
      'No se declaró ninguna sección necesaria. Sin declararlas, «faltan páginas o secciones ' +
        'necesarias» (P-III §3.2) no puede detectar ninguna ausencia.',
    );
  }
  if (input.authorizedNotationFamily.trim() === '') {
    throw new IncompleteIngestionInputError(
      'No se declaró la familia de notación autorizada: sin ella no hay contra qué juzgar ' +
        'incompatibilidad.',
    );
  }
}

/** «Contiene reglas contradictorias sin aclaración». */
function bloqueosPorContradiccion(input: IngestionInput): readonly CorpusBlock[] {
  return input.manifest.conflicts
    .filter((c) => c.differenceClass === 'contradiccion_real' && c.resolution.trim() === '')
    .map((c) => ({
      reason: 'reglas_contradictorias_sin_aclaracion' as const,
      detail:
        `el conflicto sobre «${c.claim}» está clasificado contradiccion_real y no trae ` +
        `resolución. Una contradicción aclarada no bloquea; una sin aclarar sí.`,
    }));
}

/**
 * «Usa notaciones incompatibles».
 *
 * Una notación distinta **clasificada** como convención alternativa no es una
 * incompatibilidad —W0 tiene esa clase justamente para eso—; una distinta y sin
 * aclarar sí lo es.
 */
function bloqueosPorNotacion(input: IngestionInput): readonly CorpusBlock[] {
  return input.components
    .filter(
      (c) =>
        c.notationFamily !== input.authorizedNotationFamily &&
        (c.notationReconciliation ?? '').trim() === '',
    )
    .map((c) => ({
      reason: 'notaciones_incompatibles' as const,
      detail:
        `${c.sourceComponent} usa la familia de notación ${c.notationFamily} frente a la ` +
        `autorizada ${input.authorizedNotationFamily}, sin aclaración de convención alternativa.`,
    }));
}

/**
 * «No permite anclaje por fragmento».
 *
 * Dos fragmentos con la misma ubicación no se pueden anclar por separado: un
 * ancla que apunta a dos sitios no ancla. Y una ubicación vacía no ancla a nada.
 */
function bloqueosPorAnclaje(fragmentos: readonly Fragment[]): readonly CorpusBlock[] {
  const bloqueos: CorpusBlock[] = [];
  const vistos = new Set<string>();
  const repetidos = new Set<string>();

  for (const fragmento of fragmentos) {
    if (fragmento.location.trim() === '') {
      bloqueos.push({
        reason: 'sin_anclaje_por_fragmento',
        detail:
          `una sección de ${fragmento.sourceComponent} no declara ubicación, así que ningún ` +
          `claim puede citarla.`,
      });
      continue;
    }
    if (vistos.has(fragmento.fragmentId)) repetidos.add(fragmento.fragmentId);
    vistos.add(fragmento.fragmentId);
  }

  for (const id of repetidos) {
    bloqueos.push({
      reason: 'sin_anclaje_por_fragmento',
      detail: `la ubicación ${id} aparece más de una vez: un ancla que apunta a dos sitios no ancla.`,
    });
  }

  return bloqueos;
}

/** «Su licencia o autorización no está registrada». */
function bloqueosPorLicencia(componentes: readonly IngestedComponent[]): readonly CorpusBlock[] {
  const bloqueos: CorpusBlock[] = [];

  for (const componente of componentes) {
    if (componente.licenseEvidence.trim() === '') {
      bloqueos.push({
        reason: 'licencia_no_registrada',
        detail: `${componente.sourceComponent} no trae evidencia de licencia en el manifiesto de W0.`,
      });
    }
    if (componente.origin.trim() === '') {
      bloqueos.push({
        reason: 'licencia_no_registrada',
        detail:
          `${componente.sourceComponent} no trae origen. §12 «W1» registra licencia **y** origen: ` +
          `sin origen no hay cadena de atribución que comprobar.`,
      });
    }
    if (componente.permittedUses.length === 0) {
      bloqueos.push({
        reason: 'licencia_no_registrada',
        detail:
          `${componente.sourceComponent} no trae ningún veredicto de uso de W0. Un uso no ` +
          `declarado no está permitido, así que sin veredictos el componente no es utilizable ` +
          `para nada y no puede ingerirse como si lo fuera.`,
      });
    }
  }

  return bloqueos;
}

/** «Faltan páginas o secciones necesarias». */
function bloqueosPorSeccionFaltante(
  input: IngestionInput,
  fragmentos: readonly Fragment[],
): readonly CorpusBlock[] {
  const presentes = new Set(fragmentos.map((f) => `${f.sourceComponent}#${f.location}`));

  return input.requiredSections
    .filter((s) => !presentes.has(`${s.sourceComponent}#${s.location}`))
    .map((s) => ({
      reason: 'secciones_faltantes' as const,
      detail: `falta la sección declarada necesaria ${s.location} de ${s.sourceComponent}.`,
    }));
}

/**
 * «No cubre los KC candidatos».
 *
 * Cuenta solo fragmentos utilizables como **fuente documental**: uno que W0 no
 * permite ni consultar no documenta nada, y contarlo daría cobertura aparente.
 */
function bloqueosPorCoberturaKc(
  input: IngestionInput,
  fragmentos: readonly Fragment[],
): readonly CorpusBlock[] {
  const cubiertos = new Set(
    fragmentos
      .filter((f) => f.permittedUses.includes('fuente_documental'))
      .flatMap((f) => [...f.relatedConcepts]),
  );

  const sinCobertura = input.candidateKcs.filter((kc) => !cubiertos.has(kc));
  if (sinCobertura.length === 0) return [];

  return [
    {
      reason: 'kc_candidatos_sin_cobertura',
      detail: `ningún fragmento documenta ${sinCobertura.join(', ')}.`,
    },
  ];
}

/** Busca un fragmento por su ID estable. Lectura pura: el corpus no se modifica. */
export function findFragment(corpus: IngestedCorpus, id: string): Fragment | undefined {
  return corpus.fragments.find((f) => f.fragmentId === id);
}
