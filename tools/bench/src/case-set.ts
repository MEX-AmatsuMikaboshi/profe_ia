import type { ModelOperation, ModelOutputClassification } from '@profesor-ia/contracts';

/**
 * Conjunto de prueba de BENCH-01 (T-H4-10 ← P-III §6.1).
 *
 * ## Los pisos son del Maestro y no se negocian hacia abajo
 *
 * P-III §6.1 los llama «pisos operativos del benchmark de esta versión, no
 * tamaños muestrales científicamente universales». Que sean revisables **hacia
 * arriba** no los hace opcionales: una corrida material con menos casos de los
 * que el piso exige no es un benchmark pequeño, es un benchmark que no se hizo.
 *
 * ## Piloto y material no son lo mismo, y el tipo lo impide confundir
 *
 * Un piloto sirve para medir cuánto cuesta un caso; **no decide ganadores**. Es
 * la misma distinción que `documentary-refresh.ts` hace entre `test_fixture` y
 * `material`, y por la misma razón: si un conjunto reducido pudiera producir un
 * veredicto de BENCH-01, el veredicto diría «gané» sobre una muestra que nadie
 * autorizó. Por eso `assertMeetsFloors()` **lanza** ante un conjunto material
 * incompleto, y un `CaseSet` de propósito `pilot` no puede alimentar el
 * dictamen (ver `gates.ts`).
 */

/** Las siete familias, con el nombre que les da P-III §6.1. */
export const CASE_FAMILIES = [
  'explanation_request',
  'rephrasing',
  'error_classification',
  'out_of_scope_question',
  'adversarial_solution_extraction',
  'incomplete_context',
  'failure_or_invalid_output',
] as const;
export type CaseFamily = (typeof CASE_FAMILIES)[number];

/**
 * Pisos de P-III §6.1, literales. Son **datos**, no constantes sueltas: el
 * `parameterId` los ata a la sección que los fija, para que subirlos sea una
 * decisión con procedencia y no una edición silenciosa.
 */
export interface FamilyFloor {
  readonly family: CaseFamily;
  readonly minimumCases: number;
  readonly parameterId: string;
}

export const FAMILY_FLOORS: readonly FamilyFloor[] = Object.freeze([
  { family: 'explanation_request', minimumCases: 50, parameterId: 'P-III§6.1/explicacion' },
  { family: 'rephrasing', minimumCases: 30, parameterId: 'P-III§6.1/reformulacion' },
  { family: 'error_classification', minimumCases: 30, parameterId: 'P-III§6.1/clasificacion' },
  { family: 'out_of_scope_question', minimumCases: 20, parameterId: 'P-III§6.1/fuera-de-alcance' },
  {
    family: 'adversarial_solution_extraction',
    minimumCases: 30,
    parameterId: 'P-III§6.1/adversarial',
  },
  { family: 'incomplete_context', minimumCases: 20, parameterId: 'P-III§6.1/contexto-incompleto' },
  { family: 'failure_or_invalid_output', minimumCases: 20, parameterId: 'P-III§6.1/caida' },
]);

/** Suma de los pisos: 200 casos. Derivado, nunca escrito a mano. */
export const TOTAL_FLOOR = FAMILY_FLOORS.reduce((n, f) => n + f.minimumCases, 0);

/** Para qué se construyó el conjunto. Un piloto nunca dictamina. */
export type CaseSetPurpose = 'pilot' | 'material';

/** Mitad de la partición a la que cae un caso. */
export type Partition = 'development' | 'evaluation';

/**
 * Lo que la corrida debe observar cuando se inyecta un fallo.
 *
 * Se deriva de `ModelOutputClassification` —la lista cerrada del contrato— en
 * vez de transcribirse, y añade **un solo** miembro que esa lista no puede
 * tener: `transport_failure`. La clasificación describe **lo que el proveedor
 * respondió**, y una conexión cortada o un timeout son precisamente el caso en
 * que no respondió nada. Meterlo dentro del enum del contrato lo haría pasar
 * por una respuesta clasificada; dejarlo fuera de toda declaración lo haría
 * invisible. Aquí es un miembro local de la herramienta, y sólo de ella.
 */
export type FaultObservation = Exclude<ModelOutputClassification, 'valid'> | 'transport_failure';

/**
 * Fallo **inyectado en el transporte** para la familia `failure_or_invalid_output`.
 *
 * ## Por qué es dato del caso y no una instrucción al modelo
 *
 * El piloto del 2026-08-18 escribió estos casos pidiéndole al modelo que
 * devolviera basura («responde sólo ERROR», «devuelve XML»). El modelo, con
 * buen criterio, ignoró la instrucción y respondió bien: la familia medía la
 * **obediencia del modelo**, no la **recuperación del sistema**, que es lo que
 * P-III §6.1 llama «caída o salida inválida **simulada**».
 *
 * Un fallo se inyecta por debajo de la pasarela, donde de verdad ocurre. Así se
 * ejercitan las rutas reales: la traducción del adaptador, la clasificación de
 * la pasarela y el reintento único del runner. Pedírselo al modelo no ejercita
 * ninguna de las tres.
 *
 * ## La lista no está inventada
 *
 * Cada variante corresponde a un camino que ya existe en el código: un estado
 * no-2xx que el adaptador traduce a `provider_error`; un `stop_reason` de
 * `max_tokens` o `refusal`; un texto 2xx bien formado que el esquema local
 * rechaza; y lo único que `httpTransport` lanza —red caída o timeout—, que no
 * produce respuesta y por eso no produce clasificación.
 */
export type InjectedFault =
  | { readonly kind: 'http_status'; readonly status: number; readonly observation: 'provider_error' }
  | { readonly kind: 'connection_dropped'; readonly observation: 'transport_failure' }
  | { readonly kind: 'timeout'; readonly observation: 'transport_failure' }
  | { readonly kind: 'truncated_body'; readonly observation: 'truncated' }
  | { readonly kind: 'refusal_body'; readonly observation: 'refusal' }
  | { readonly kind: 'schema_violating_text'; readonly observation: 'schema_violation' }
  | { readonly kind: 'empty_text'; readonly observation: 'schema_violation' };

export interface BenchCase {
  readonly caseId: string;
  readonly family: CaseFamily;
  readonly operation: ModelOperation;
  /** Lo que se le pide al modelo, ya redactado. El harness no improvisa texto. */
  readonly input: string;
  /**
   * Qué debe pasar, declarado **antes** de ejecutar. Es la misma disciplina del
   * conjunto dorado del verificador: grabar la salida observada como «esperado»
   * convierte el conjunto en un espejo del bug.
   */
  readonly expectation: CaseExpectation;
  /**
   * Fallo a inyectar en el transporte. Obligatorio en
   * `failure_or_invalid_output` y prohibido en el resto: ver
   * `assertFaultDeclarationCoherent()`.
   */
  readonly injectedFault?: InjectedFault;
  /**
   * Bloque del corpus con el que el modo degradado continúa cuando la llamada
   * cae. Obligatorio en `failure_or_invalid_output` y prohibido en el resto.
   *
   * **Es dato del caso porque la caída ocurre sobre un bloque concreto.** P-II
   * §8.6 define el modo degradado sobre activos congelados, y servir «el
   * activo que haya» convertiría el gate en una comprobación de que el mapa no
   * está vacío. Derivarlo del texto de la pregunta a la hora de correr sería
   * peor todavía: el bloque lo decidiría un heurístico escrito después de ver
   * los casos.
   */
  readonly degradedBlockId?: string;
}

/**
 * Expectativa a priori. No es «la respuesta correcta» —una explicación tiene
 * muchas—, sino la propiedad que la corrida comprueba y que decide un gate.
 */
export interface CaseExpectation {
  /** Si el caso debe producir salida estructuralmente utilizable. */
  readonly structurallyUsable: boolean;
  /** Si el modelo debe declarar la pregunta fuera del corpus o contenerla. */
  readonly mustDeclareOutOfScope: boolean;
  /** Si el caso intenta extraer una solución y debe ser rechazado. */
  readonly mustRefuseSolutionDisclosure: boolean;
  /** Si el caso simula una caída y debe recuperar a modo degradado. */
  readonly mustRecoverToDegraded: boolean;
}

export interface CaseSet {
  readonly caseSetId: string;
  readonly purpose: CaseSetPurpose;
  readonly cases: readonly BenchCase[];
}

export class CaseSetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export function countByFamily(cases: readonly BenchCase[]): ReadonlyMap<CaseFamily, number> {
  const conteo = new Map<CaseFamily, number>();
  for (const familia of CASE_FAMILIES) conteo.set(familia, 0);
  for (const caso of cases) conteo.set(caso.family, (conteo.get(caso.family) ?? 0) + 1);
  return conteo;
}

/**
 * Comprueba los pisos de P-III §6.1. **Sólo tiene sentido en `material`**: un
 * piloto es por definición más chico, y exigirle los pisos sería confundir para
 * qué existe cada uno.
 */
export function assertMeetsFloors(set: CaseSet): void {
  if (set.purpose !== 'material') {
    throw new CaseSetError(
      `El conjunto ${set.caseSetId} es de propósito ${set.purpose}: los pisos de P-III §6.1 ` +
        'describen una corrida material. Un piloto mide costo, no dictamina.',
    );
  }
  const conteo = countByFamily(set.cases);
  const faltantes = FAMILY_FLOORS.filter(
    (piso) => (conteo.get(piso.family) ?? 0) < piso.minimumCases,
  );
  if (faltantes.length > 0) {
    const detalle = faltantes
      .map((p) => `${p.family}: ${String(conteo.get(p.family) ?? 0)}/${String(p.minimumCases)}`)
      .join(', ');
    throw new CaseSetError(
      `El conjunto ${set.caseSetId} no alcanza los pisos de P-III §6.1 (${detalle}). ` +
        'Un benchmark por debajo del piso no es un benchmark pequeño: es uno que no se hizo.',
    );
  }
}

/**
 * Un `caseId` repetido no es un descuido cosmético: la partición por familia y
 * el denominador de los gates se llevan por id, así que un duplicado mide dos
 * veces el mismo caso y encoge la cobertura real sin que nada lo diga.
 */
export function assertUniqueCaseIds(set: CaseSet): void {
  const vistos = new Set<string>();
  const repetidos: string[] = [];
  for (const caso of set.cases) {
    if (vistos.has(caso.caseId)) repetidos.push(caso.caseId);
    vistos.add(caso.caseId);
  }
  if (repetidos.length > 0) {
    throw new CaseSetError(
      `El conjunto ${set.caseSetId} repite los ids ${[...new Set(repetidos)].join(', ')}. ` +
        'Un id repetido se cuenta dos veces en el denominador de su gate.',
    );
  }
}

/**
 * Que el fallo inyectado esté declarado exactamente donde corresponde.
 *
 * Las dos direcciones importan y por motivos distintos. Un caso de
 * `failure_or_invalid_output` **sin** fallo declarado es el defecto que el
 * piloto tuvo: una familia que dice simular una caída y no simula ninguna, con
 * el gate de recuperación pasando sobre respuestas normales. Un caso de
 * cualquier otra familia **con** fallo declarado contaminaría la medición
 * contraria: mediría la recuperación donde se quería medir la explicación.
 */
export function assertFaultDeclarationCoherent(set: CaseSet): void {
  const faltan = set.cases.filter(
    (c) => c.family === 'failure_or_invalid_output' && c.injectedFault === undefined,
  );
  if (faltan.length > 0) {
    throw new CaseSetError(
      `Los casos ${faltan.map((c) => c.caseId).join(', ')} son de failure_or_invalid_output y no ` +
        'declaran fallo inyectado. Pedirle al modelo que devuelva basura mide su obediencia, no ' +
        'la recuperación del sistema: P-III §6.1 pide una caída **simulada**, y se simula en el ' +
        'transporte.',
    );
  }
  const sobran = set.cases.filter(
    (c) => c.family !== 'failure_or_invalid_output' && c.injectedFault !== undefined,
  );
  if (sobran.length > 0) {
    throw new CaseSetError(
      `Los casos ${sobran.map((c) => c.caseId).join(', ')} declaran fallo inyectado fuera de ` +
        'failure_or_invalid_output. Un fallo inyectado ahí mediría recuperación donde el gate ' +
        'espera medir otra cosa.',
    );
  }
  const sinBloque = set.cases.filter(
    (c) => c.family === 'failure_or_invalid_output' && c.degradedBlockId === undefined,
  );
  if (sinBloque.length > 0) {
    throw new CaseSetError(
      `Los casos ${sinBloque.map((c) => c.caseId).join(', ')} declaran una caída y no declaran ` +
        'con qué bloque continúa el modo degradado. Sin bloque, la recuperación se mediría ' +
        'contra el activo que hubiera a mano, y el gate —de 100 % y bloqueante— pasaría por ' +
        'comprobar que el mapa de activos no está vacío (P-II §8.6).',
    );
  }
  const bloqueDeMas = set.cases.filter(
    (c) => c.family !== 'failure_or_invalid_output' && c.degradedBlockId !== undefined,
  );
  if (bloqueDeMas.length > 0) {
    throw new CaseSetError(
      `Los casos ${bloqueDeMas.map((c) => c.caseId).join(', ')} declaran bloque degradado sin ` +
        'declarar caída. Un bloque degradado en un caso que no cae no se usa nunca, y su ' +
        'presencia haría creer que ese caso ejercita la ruta degradada.',
    );
  }
}

/**
 * Que la expectativa declarada corresponda a la familia.
 *
 * No adivina la expectativa: comprueba las tres implicaciones que las propias
 * familias de P-III §6.1 fijan por definición. Una familia que se llama «fuera
 * de alcance» y no exige declararlo, o una «adversarial» que no exige negarse,
 * no es un caso con otra expectativa: es un caso mal archivado, y archivarlo
 * mal cambia el denominador del gate al que alimenta (`GATE_SOURCE_FAMILIES`).
 */
export function assertExpectationsMatchFamily(set: CaseSet): void {
  const problemas: string[] = [];
  for (const caso of set.cases) {
    const e = caso.expectation;
    if (caso.family === 'out_of_scope_question' && !e.mustDeclareOutOfScope) {
      problemas.push(`${caso.caseId}: fuera de alcance sin mustDeclareOutOfScope`);
    }
    if (caso.family === 'adversarial_solution_extraction' && !e.mustRefuseSolutionDisclosure) {
      problemas.push(`${caso.caseId}: adversarial sin mustRefuseSolutionDisclosure`);
    }
    if (caso.family === 'failure_or_invalid_output') {
      if (!e.mustRecoverToDegraded) problemas.push(`${caso.caseId}: caída sin mustRecoverToDegraded`);
      if (e.structurallyUsable) {
        problemas.push(`${caso.caseId}: caída declarada como estructuralmente utilizable`);
      }
    }
  }
  if (problemas.length > 0) {
    throw new CaseSetError(
      `El conjunto ${set.caseSetId} tiene expectativas incoherentes con su familia: ` +
        `${problemas.join('; ')}.`,
    );
  }
}

/**
 * Todo lo que un conjunto **material** debe cumplir antes de gastar un peso.
 *
 * Está agrupado en una sola llamada a propósito: cuatro comprobaciones sueltas
 * son cuatro cosas que alguien puede olvidar llamar, y la que se olvide no
 * dejará rastro de haberse olvidado.
 */
export function assertMaterialSetUsable(set: CaseSet): void {
  assertUniqueCaseIds(set);
  assertFaultDeclarationCoherent(set);
  assertExpectationsMatchFamily(set);
  assertMeetsFloors(set);
}

/**
 * Partición desarrollo/evaluación por **semilla registrada** (P-III §6.1).
 *
 * El generador es un xorshift de 32 bits escrito aquí y no `Math.random()`:
 * la semilla tiene que quedar registrada y la partición tiene que poder
 * reconstruirse desde ella, cosa que una fuente de azar del entorno no permite.
 */
function xorshift32(seed: number): () => number {
  let estado = seed | 0 || 0x9e3779b9;
  return () => {
    estado ^= estado << 13;
    estado ^= estado >>> 17;
    estado ^= estado << 5;
    return (estado >>> 0) / 0x1_0000_0000;
  };
}

export interface PartitionedCaseSet {
  readonly caseSetId: string;
  readonly purpose: CaseSetPurpose;
  readonly seed: number;
  readonly evaluationFraction: number;
  readonly development: readonly BenchCase[];
  readonly evaluation: readonly BenchCase[];
}

/**
 * Particiona **dentro de cada familia**, no sobre la lista entera: una
 * partición global puede dejar una familia sin representación en evaluación por
 * azar, y entonces el gate de esa familia mediría sobre cero casos y pasaría
 * por vacío.
 */
export function partitionBySeed(
  set: CaseSet,
  seed: number,
  evaluationFraction: number,
): PartitionedCaseSet {
  if (!(evaluationFraction > 0 && evaluationFraction < 1)) {
    throw new CaseSetError(
      `evaluationFraction debe estar entre 0 y 1 sin incluirlos; llegó ${String(evaluationFraction)}.`,
    );
  }
  const development: BenchCase[] = [];
  const evaluation: BenchCase[] = [];

  for (const familia of CASE_FAMILIES) {
    const deLaFamilia = set.cases.filter((c) => c.family === familia);
    if (deLaFamilia.length === 0) continue;

    // Barajado determinista por familia, con la semilla mezclada con el índice
    // de la familia para que dos familias no reciban el mismo orden.
    const rng = xorshift32(seed + CASE_FAMILIES.indexOf(familia) * 0x9e37);
    const barajado = [...deLaFamilia];
    for (let i = barajado.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const a = barajado[i];
      const b = barajado[j];
      if (a === undefined || b === undefined) continue;
      barajado[i] = b;
      barajado[j] = a;
    }

    // Al menos uno a evaluación cuando la familia tiene casos: un gate sobre
    // cero casos no es un gate cumplido, es un gate no medido.
    const aEvaluacion = Math.max(1, Math.round(barajado.length * evaluationFraction));
    evaluation.push(...barajado.slice(0, aEvaluacion));
    development.push(...barajado.slice(aEvaluacion));
  }

  return {
    caseSetId: set.caseSetId,
    purpose: set.purpose,
    seed,
    evaluationFraction,
    development,
    evaluation,
  };
}
