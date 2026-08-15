/**
 * Canarios (T-H4-05 ← P-II §11.3).
 *
 * Se insertan cadenas canario en soluciones, sondas futuras y claves. Si una
 * aparece en el contexto o la salida del modelo hay que **abortar, registrar
 * incidente, bloquear la corrida e investigar la ruta** — las cuatro cosas, no
 * la que resulte cómoda.
 *
 * Lo que aquí **no** se decide: cantidad, patrón y rotación de canarios son
 * calibrables (§11.3). Este módulo aporta el mecanismo y falla cerrado cuando
 * se le pide el plan, en vez de fabricar un patrón que aparentaría cobertura.
 */

/** Clases de activo que llevan canario — literal §11.3. */
export const CANARY_ASSET_CLASSES = ['soluciones', 'sondas_futuras', 'claves'] as const;
export type CanaryAssetClass = (typeof CANARY_ASSET_CLASSES)[number];

/** Superficies que observan los detectores — literal §11.3. */
export const CANARY_DETECTOR_SCOPES = [
  'contexto_construido',
  'payload_saliente',
  'salida_del_modelo',
  'logs_y_trazas',
  'exportes',
] as const;
export type CanaryDetectorScope = (typeof CANARY_DETECTOR_SCOPES)[number];

/**
 * Un canario registrado. Los seis campos son los que §11.3 exige registrar:
 * `canary_id`, clase de activo, ubicación, freeze/versión, detector —qué
 * superficies observa— y procedimiento de incidente.
 */
export interface CanaryRecord {
  readonly canaryId: string;
  readonly assetClass: CanaryAssetClass;
  readonly location: string;
  readonly freezeVersion: string;
  /**
   * La cadena en sí, **inyectada en memoria desde el gestor de secretos**
   * (Infisical). No se versiona ni se guarda en la base: este paquete es datos y
   * política, no almacén de secretos. Nunca se imprime en un error ni en un log
   * — un mensaje que mostrara el canario lo filtraría por el mismo canal que
   * vigila.
   */
  readonly value: string;
  readonly scopes: readonly CanaryDetectorScope[];
  readonly incidentProcedure: string;
}

export interface CanaryHit {
  readonly canaryId: string;
  readonly assetClass: CanaryAssetClass;
  readonly scope: CanaryDetectorScope;
}

/**
 * Nivel e incidente de un hit. §11.3 no fija un `incident_code` —P-I §13 dice
 * que el código se congela por corrida en el `run-manifest`, así que inventarlo
 * aquí sería fabricar un miembro de un catálogo congelado—, pero el nivel y la
 * categoría sí son literales: un canario visto es sistémico, y la categoría de
 * nivel 3 `ruta_efectiva_no_autorizada_a_soluciones_sondas_secretos` nombra
 * exactamente las tres clases de activo que llevan canario.
 */
export const CANARY_INCIDENT_LEVEL = 3 as const;
export const CANARY_INCIDENT_CATEGORY =
  'ruta_efectiva_no_autorizada_a_soluciones_sondas_secretos' as const;

export class CanaryPlanCalibrationPendingError extends Error {
  constructor(detail: string) {
    super(
      `PENDING_CALIBRATION: cantidad, patrón y rotación de canarios (${detail}). ` +
        `Se congela en: el gate que fije la política de canarios (P-II §11.3). ` +
        `El gate sigue siendo cero hits protegidos observados.`,
    );
    this.name = 'CanaryPlanCalibrationPendingError';
  }
}

export class DuplicateCanaryError extends Error {
  constructor(canaryId: string) {
    super(`Ya hay un canario registrado con canary_id ${canaryId}.`);
    this.name = 'DuplicateCanaryError';
  }
}

export class EmptyCanaryScopesError extends Error {
  constructor(canaryId: string) {
    super(
      `El canario ${canaryId} no declara ninguna superficie de detección. Un canario que no se ` +
        `observa en ningún sitio no protege nada y daría cobertura aparente.`,
    );
    this.name = 'EmptyCanaryScopesError';
  }
}

/**
 * Corrida bloqueada por un hit. Una vez disparado **no se limpia**: §11.3 pide
 * bloquear la corrida e investigar la ruta, y un bloqueo que se pudiera quitar
 * programáticamente sería un bloqueo decorativo.
 */
export class CanaryRunBlock extends Error {
  constructor(readonly hits: readonly CanaryHit[]) {
    const ids = hits.map((h) => h.canaryId).join(', ');
    super(
      `CANARIO_DETECTADO: ${hits.length} hit(s) [${ids}] en ` +
        `${[...new Set(hits.map((h) => h.scope))].join(', ')}. ` +
        `Incidente nivel ${CANARY_INCIDENT_LEVEL} (${CANARY_INCIDENT_CATEGORY}): la corrida queda ` +
        `bloqueada y hay que investigar la ruta (P-II §11.3).`,
    );
    this.name = 'CanaryRunBlock';
  }
}

export class CanaryRegistry {
  readonly #porId = new Map<string, CanaryRecord>();
  #hitsObservados: CanaryHit[] = [];
  #bloqueada = false;

  register(record: CanaryRecord): void {
    if (this.#porId.has(record.canaryId)) {
      throw new DuplicateCanaryError(record.canaryId);
    }
    if (record.scopes.length === 0) {
      throw new EmptyCanaryScopesError(record.canaryId);
    }
    this.#porId.set(record.canaryId, record);
  }

  /**
   * Busca en una superficie concreta. Solo considera los canarios que declaran
   * observarla, que es lo que dice «según aplique» en §11.3.
   */
  detect(payload: string, scope: CanaryDetectorScope): readonly CanaryHit[] {
    const hits: CanaryHit[] = [];
    for (const record of this.#porId.values()) {
      if (!record.scopes.includes(scope)) continue;
      if (payload.includes(record.value)) {
        hits.push({ canaryId: record.canaryId, assetClass: record.assetClass, scope });
      }
    }
    return hits;
  }

  /**
   * Registra los hits y **bloquea la corrida** si los hay. Devuelve los hits
   * para que quien llama construya el incidente con el `incident_code` congelado
   * de su corrida; aquí no se inventa ese código.
   */
  observe(payload: string, scope: CanaryDetectorScope): readonly CanaryHit[] {
    const hits = this.detect(payload, scope);
    if (hits.length > 0) {
      this.#hitsObservados = [...this.#hitsObservados, ...hits];
      this.#bloqueada = true;
    }
    return hits;
  }

  /** Igual que `observe`, pero aborta. Es la vía por omisión: un hit no continúa. */
  observeOrThrow(payload: string, scope: CanaryDetectorScope): void {
    const hits = this.observe(payload, scope);
    if (hits.length > 0) {
      throw new CanaryRunBlock(hits);
    }
  }

  /**
   * Detector con la firma que espera el filtro de egreso de la pasarela
   * (T-H4-04). Devuelve los `canary_id`, nunca las cadenas: un mensaje de error
   * que imprimiera el canario lo filtraría por el propio canal que vigila.
   */
  detectorFor(scope: CanaryDetectorScope): (payload: string) => readonly string[] {
    return (payload) => this.observe(payload, scope).map((h) => h.canaryId);
  }

  /** Gate de §11.3: cero hits protegidos observados. */
  observedHits(): readonly CanaryHit[] {
    return Object.freeze([...this.#hitsObservados]);
  }

  isRunBlocked(): boolean {
    return this.#bloqueada;
  }

  size(): number {
    return this.#porId.size;
  }

  /**
   * Plan de canarios: cuántos, con qué patrón y cada cuánto rotan.
   *
   * Falla cerrado a propósito (§11.3: «la cantidad, patrón y rotación de
   * canarios se calibran»). Devolver un número aquí daría por cubierta una
   * política que nadie ha fijado, que es peor que no tenerla: el gate mide
   * hits observados, y con un plan inventado un cero significaría solo que los
   * canarios estaban mal puestos.
   */
  static plan(): never {
    throw new CanaryPlanCalibrationPendingError(
      'no hay política congelada de cuántos canarios, con qué patrón ni con qué rotación',
    );
  }
}
