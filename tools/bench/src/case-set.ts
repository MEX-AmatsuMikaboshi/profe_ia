import type { ModelOperation } from '@profesor-ia/contracts';

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
