/** Errores de `authoring-core`. Todos fallan cerrado. */

export class AuthoringCoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Se intentó contar por mayoría un claim de otro sistema formal
 * (T-H45-03 ← P-I §7.0). «La mayoría simple no decide una cuestión cuando las
 * fuentes describen sistemas distintos.»
 */
export class ForeignSystemInMajorityError extends AuthoringCoreError {}

/**
 * Ninguna fuente describe el sistema objetivo, así que no hay mayoría que
 * resolver. Se lanza en vez de devolver el más votado del conjunto ajeno, que
 * sería dejar que otro cálculo decida el nuestro.
 */
export class NoEligibleClaimsError extends AuthoringCoreError {}

/**
 * Al recurso le faltan campos de los cuatro mínimos de P-I §7.0
 * (`source_component`, `source_version`, `provenance_basis`,
 * `license_evidence`). Sin ellos no hay cadena de atribución que comprobar, y
 * clasificarlo sería afirmar un derecho que nadie registró.
 */
export class IncompleteLicenseRecordError extends AuthoringCoreError {}

/**
 * Modo de acceso fuera del conjunto cerrado (T-H45-02 ← P-I §7.0: «sin crawler
 * web general»). Si los modos fueran texto libre, el crawler entraría
 * escribiéndolo.
 */
export class GeneralCrawlerForbiddenError extends AuthoringCoreError {}

/** Al candidato le falta parte del registro obligatorio de §7.0. */
export class IncompleteDiscoveryRecordError extends AuthoringCoreError {}

/** Fuente fuera de la whitelist con un modo distinto de búsqueda abierta. */
export class SourceNotWhitelistedError extends AuthoringCoreError {}

/**
 * Todos los candidatos vienen de búsqueda abierta. §7.0 la admite «solo como
 * complemento», y sin nada de la whitelist no complementa: es la estrategia
 * principal.
 */
export class OpenSearchNotComplementError extends AuthoringCoreError {}

/**
 * Se pidió un valor que depende de una calibración abierta. Falla cerrado igual
 * que `complexityIndex()` en `proof-search`: el sistema no avanza apoyado en
 * pesos o umbrales fabricados, y la deuda queda visible.
 */
export class CalibrationPendingError extends AuthoringCoreError {
  constructor(
    readonly calibrationId: string,
    detail: string,
    closesIn: string,
  ) {
    super(`PENDING_CALIBRATION: ${calibrationId} (${detail}). Se congela en: ${closesIn}.`);
    this.name = new.target.name;
  }
}

/** `CAL-SOURCE-SCORE`: pesos del `source_suitability_score` (T-H45-04). */
export class SuitabilityCalibrationPendingError extends CalibrationPendingError {
  constructor(detail: string, closesIn: string) {
    super('CAL-SOURCE-SCORE', detail, closesIn);
  }
}

/** `CAL-SATURATION`: tamaño base, racha y umbral de información nueva (T-H45-04). */
export class SaturationCalibrationPendingError extends CalibrationPendingError {
  constructor(detail: string, closesIn: string) {
    super('CAL-SATURATION', detail, closesIn);
  }
}

/**
 * Al manifiesto de selección le falta alguno de los ocho entregables de
 * P-I §7.0 (T-H45-06). Ninguno es opcional: un manifiesto incompleto afirma
 * haber cerrado W0 sin haberlo hecho.
 */
export class IncompleteSelectionManifestError extends AuthoringCoreError {}

/**
 * El aprobador rechazó sin `rejection_reason_code`, o intentó reescribir
 * pedagógicamente la propuesta (T-H45-07 ← P-I §7.0).
 */
export class InvalidCorpusDecisionError extends AuthoringCoreError {}

/**
 * Al claim traducido le falta parte del rastro que exige `DEC-LANGUAGE-001`
 * (T-H45-08). Sin el original y su ubicación no se puede juzgar la
 * atribuibilidad contra la fuente.
 */
export class IncompleteTranslationTraceError extends AuthoringCoreError {}

/** `CAL-NLI`: fiabilidad del NLI por estrato; se congela en H5 (T-H45-08). */
export class NliCalibrationPendingError extends CalibrationPendingError {
  constructor(detail: string, closesIn: string) {
    super('CAL-NLI', detail, closesIn);
  }
}

/**
 * Lo cargado en W1 no tiene la identidad que W0 evaluó (T-H5-01 ← §12 «W1»,
 * paso 2). Cubre las dos mitades de esa identidad: los **bytes** —el SHA-256 no
 * reproduce el snapshot— y la **etiqueta de versión**, que viaja dentro del
 * `fragment_id` y haría que las anclas citaran una versión que nadie evaluó.
 *
 * Se lanza **antes** que cualquier validación de contenido: si el artefacto no es
 * el evaluado, todo lo que se midiera después hablaría de otro documento. Y la
 * salida no es actualizar el hash —eso borraría el hecho de que la fuente cambió
 * después de evaluarse— sino reevaluar en W0.
 */
export class CorpusDriftError extends AuthoringCoreError {}

/**
 * Un fragmento no pasa la validación de legibilidad (§12 «W1», paso 5).
 *
 * Solo hechos del decodificador, nunca umbrales: vacío, carácter de reemplazo
 * (que **es** el decodificador reportando un fallo) o control C0 no imprimible.
 * Una fracción mínima de caracteres legibles sería un parámetro que ninguna
 * autoridad fija.
 */
export class IllegibleFragmentError extends AuthoringCoreError {}

/**
 * Llegó a W1 un componente que W0 no autorizó (`excluido` o `pendiente`), o que
 * no aparece en el manifiesto de selección.
 *
 * No es un defecto del corpus sino del pipeline: ingerir un `pendiente` trataría
 * lo no decidido como autorizado.
 */
export class UnauthorizedComponentError extends AuthoringCoreError {}

/**
 * A la entrada de W1 le falta algo sin lo cual una validación pasaría **por
 * vacío**: sin KC candidatos no hay cobertura que comprobar y sin secciones
 * necesarias declaradas no hay ausencia que detectar.
 *
 * Un control que no puede fallar es peor que no tenerlo.
 */
export class IncompleteIngestionInputError extends AuthoringCoreError {}

/**
 * Un elemento extraído no ancla a un fragmento real del corpus ingerido
 * (T-H5-02 ← P-I §7.11: «el anclaje estructural es determinista»).
 *
 * Cubre las tres formas de no anclar: citar un fragmento que no existe, citarlo
 * con un hash que ya no es el suyo —el ancla envejeció y apunta a otro texto— y
 * citar como autoridad un fragmento que W0 no permite usar como fuente
 * documental.
 */
export class UnanchoredExtractionError extends AuthoringCoreError {}

/**
 * El claim no cumple lo que su propio tipo afirma (T-H5-02 ← P-I §7.11).
 *
 * Los tres tipos no son etiquetas decorativas: `cross_source_consensus` afirma
 * que varias fuentes coinciden y `system_inference` afirma que **no** lo dice
 * una fuente sino el sistema. Un tipo que no se comprueba deja de significar
 * nada y contamina el denominador de atribución.
 */
export class ClaimTypeViolationError extends AuthoringCoreError {}

/**
 * Dos elementos comparten identificador. La cadena
 * `fuente → fragmento → claim → decisión curricular → artefacto → actividad`
 * se recorre por id: con uno repetido, el recorrido se bifurca y deja de
 * reconstruir una sola pieza.
 */
export class DuplicateExtractionIdError extends AuthoringCoreError {}

/**
 * A la extracción le falta algo que la haría afirmar más de lo que tiene: una
 * extracción sin claims, o una decisión curricular sin soporte o sin
 * justificación.
 */
export class IncompleteExtractionError extends AuthoringCoreError {}

/**
 * El mapa de KC contradice el catálogo literal de P-I §5.2, el cálculo
 * autorizado o las reglas de §5.2.1 (T-H5-03).
 *
 * Cubre las cuatro formas: una regla que el cálculo no autoriza, un ciclo sin
 * justificar, un fundamento pre-SCED puesto como KC objetivo y un conjunto que
 * referencia otra versión del cálculo.
 */
export class KcMapError extends AuthoringCoreError {}

/**
 * La política pedagógica de autoría contradice P-I §5.9, §5.10, §8.3.1–§8.3.4 o
 * el contrato de P-II §7.2.1 (T-H5-04).
 *
 * Incluye el caso que más tienta: pedir el miembro de enum de una de las dos
 * entradas del catálogo que no lo tienen. Falla cerrado y dice por dónde se
 * expresan, en vez de devolver la estrategia más parecida —que registraría en la
 * traza que se dio ayuda justo en el paso en que se estaba retirando—.
 */
export class PedagogyPolicyError extends AuthoringCoreError {}

/**
 * Rol C entregó una solución (T-H5-05 ← P-II §5.2: «No genera la solución
 * autoritativa»).
 *
 * La solución autoritativa la produce el buscador y la certifica `logic-core`.
 * Aceptar la del generador convertiría la afirmación de un modelo en el patrón
 * contra el que después se califica al alumno, que es exactamente la autoridad
 * que P-I §7.1 le niega: «los modelos proponen; el código verifica».
 */
export class AuthoritativeSolutionFromGeneratorError extends AuthoringCoreError {}

/**
 * Dos reservas se solapan (T-H5-06 ← P-I §7.7, §5.11).
 *
 * Distinta de `ReserveSeparationError`, que es dónde está archivado el fichero:
 * esta es la disjunción **semántica**. Cubre el mismo id en dos reservas, los
 * ids compartidos entre las dos categorías de transferencia —«los bancos, IDs y
 * eventos de ambas categorías son distintos»— y la colisión por duplicado
 * trivial, isomorfismo o superficie entre una reserva de medición y cualquier
 * otra: un reactivo practicado que reaparece como sonda mide lo que el alumno
 * acaba de hacer, no lo que aprendió.
 */
export class ReserveOverlapError extends AuthoringCoreError {}

/**
 * `CAL-07` / `CAL-ISOMORPHISM` y `DUP-01`: precisión, recall y tolerancias del
 * detector de isomorfismo, y la prueba de aislamiento físico/isomórfico entre
 * `TRANSFER_MASTERY` y `TRANSFER_MEASUREMENT`. Se validan en H5/H10.
 */
export class IsomorphismCalibrationPendingError extends CalibrationPendingError {
  constructor(detail: string, closesIn: string) {
    super('CAL-07', detail, closesIn);
  }
}

/**
 * La entrada de W3 no es coherente consigo misma (T-H5-05): dos candidatos con
 * el mismo id, o un conjunto de pistas o una crítica que apunta a un candidato
 * que no está en el lote.
 *
 * No es un defecto del candidato sino del pipeline, y por eso lanza en vez de
 * ser un código de rechazo. Con dos ids repetidos, dos certificados distintos se
 * guardarían bajo la misma clave en `solutions-private/`; y una crítica
 * huérfana ignorada en silencio contaría como paso 8 ejecutado sobre un
 * reactivo que nadie criticó.
 */
export class W3InputError extends AuthoringCoreError {}

/**
 * Se pidió ejecutar el pipeline de validez sin el orden congelado por
 * `BENCH-04` (T-H5-05 ← P-I §7.4).
 *
 * La preferencia inicial **a benchmarkear** es `prefiltro semántico → proof
 * search`, y por eso no se cablea: adoptarla sin medición es la «ley universal
 * sin medición» que §7.4 prohíbe por su nombre. El orden entra como dato con su
 * procedencia, o no se ejecuta.
 */
export class PipelineOrderNotFrozenError extends AuthoringCoreError {}

/**
 * Una pista de Rol D contradice P-I §8.6 o el contrato de salida de P-II §5.2.
 *
 * Cubre la propuesta de `masteryDisqualifying = false` sin explicar por qué no
 * revela, la pista que contiene un paso derivado de la solución —«una pista
 * nunca puede transformarse silenciosamente en solución»— y el ejemplo del
 * nivel 4, que la norma exige **no isomorfo**.
 */
export class HintPolicyError extends AuthoringCoreError {}

/**
 * Se pidió el valor autoritativo de `masteryDisqualifying` a la propuesta de
 * Rol D (T-H5-05 ← P-I §8.6: «la bandera propuesta por el generador **no es
 * autoritativa**»).
 *
 * Falla cerrado igual que `toDecisionStrategy()` con las dos entradas sin
 * miembro de enum: quien recalcula es la política determinista (`T-H6-03`), y
 * el linter de paquete rechaza la discrepancia (`T-H5-13`). Devolver aquí la
 * propuesta la convertiría en autoridad por el camino de en medio.
 */
export class MasteryFlagNotAuthoritativeError extends AuthoringCoreError {}

/**
 * La crítica de Rol E no cumple P-II §5.2, o se intentó usar su acuerdo como
 * evidencia de calidad cuando el crítico no es independiente.
 *
 * «Su veredicto no certifica»: produce señales para los filtros. Un crítico de
 * la misma familia que el generador **no es independiente** y su acuerdo no
 * puede usarse para congelar esa familia.
 */
export class CritiqueError extends AuthoringCoreError {}

/**
 * Un artefacto quedó fuera de la separación física que exige P-I §7.7 y
 * P-II §3.2 (T-H5-05, paso 10 de W3).
 *
 * Cubre el reactivo archivado en el banco de otra reserva, el mismo reactivo en
 * dos reservas y —la que importa— el certificado escrito fuera de
 * `solutions-private/`, que es el directorio que «no se monta en los
 * contenedores del agente ni de la aplicación web».
 */
export class ReserveSeparationError extends AuthoringCoreError {}
