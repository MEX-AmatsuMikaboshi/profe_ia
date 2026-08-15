import {
  AUTHORIZED_CALCULUS_VERSION,
  AUTHORIZED_RULE_IDS,
  type RuleId,
} from '@profesor-ia/logic-core';
import { KcMapError } from './errors.js';

/**
 * Mapa de componentes de conocimiento, Rol B (T-H5-03 ← P-I §5.2, §5.2.1,
 * `DEC-FOUNDATION-001`; §12 «W2» pasos 3–4).
 *
 * El catálogo KC01–KC18 y sus dependencias **son literales del Maestro**: esta
 * tarea los transcribe y los hace comprobables, no los diseña. Tres cosas que
 * conviene tener claras antes de tocar nada:
 *
 * 1. **Los `rule_id` se derivan de `logic-core`, no se copian.** Si se copiaran,
 *    el mapa y el cálculo autorizado podrían separarse sin que nada lo notara —el
 *    mismo motivo por el que el ancla Calgary se deriva en `formal-system.ts`—.
 * 2. **Las aristas llevan tipo y el tipo importa.** `KC12 PC:KC10` es una
 *    dependencia de **política de contenido**, no una necesidad lógica: existe
 *    porque en Etapa 1 `⊥` no aparece como premisa ni supuesto inicial. Tratarla
 *    como formal afirmaría una necesidad del cálculo que no existe; tratarla como
 *    inexistente perdería una ruta de contaminación entre conjuntos.
 * 3. **`¬I` e `IP` permanecen separados** en contenido, etiquetado y trazas, y
 *    por eso son dos KC distintos con dos reglas distintas. `¬I` supone φ y
 *    concluye ¬φ; `IP` supone ¬φ y concluye φ al derivar ⊥.
 */

export const KC_IDS = [
  'KC01',
  'KC02',
  'KC03',
  'KC04',
  'KC05',
  'KC06',
  'KC07',
  'KC08',
  'KC09',
  'KC10',
  'KC11',
  'KC12',
  'KC13',
  'KC14',
  'KC15',
  'KC16',
  'KC17',
  'KC18',
] as const;
export type KcId = (typeof KC_IDS)[number];

/**
 * Los cinco tipos de dependencia que el Maestro etiqueta `F`, `PC`, `P`, `C/A` y
 * `E`, con su significado literal. Conjunto cerrado.
 */
export const DEPENDENCY_TYPES = [
  'FORMAL',
  'POLITICA_CONTENIDO',
  'PEDAGOGICA',
  'CONCEPTUAL_ANALOGICA',
  'ESTADISTICA',
] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

/** Los siete estados literales de la columna «Estado en Etapa 1». */
export const STAGE1_STATUSES = [
  'Obligatorio',
  'Transversal',
  'Condicional al alcance del conjunto',
  'Obligatorio cuando el conjunto lo requiera',
  'Derivada permitida',
  'Primitiva clásica',
  'Opcional y no determinante',
] as const;
export type Stage1Status = (typeof STAGE1_STATUSES)[number];

export interface KcDependency {
  readonly on: KcId;
  readonly type: DependencyType;
}

export interface KcEntry {
  readonly kcId: KcId;
  readonly name: string;
  readonly dependencies: readonly KcDependency[];
  readonly stage1Status: Stage1Status;
  /** Regla del cálculo autorizado, cuando el KC es una regla. */
  readonly ruleId?: RuleId;
  /**
   * Condiciones que el Maestro enuncia y **no** son aristas a otro KC. Se
   * registran como texto en vez de fabricarles un KC de destino: convertir
   * «disponer de una disyunción» en una arista inventaría una dependencia.
   */
  readonly conditions?: readonly string[];
}

const F = 'FORMAL' as const;
const PC = 'POLITICA_CONTENIDO' as const;
const P = 'PEDAGOGICA' as const;
const CA = 'CONCEPTUAL_ANALOGICA' as const;

/** `KC18 P/integración: KC03–KC17`. */
const KC03_A_KC17: readonly KcDependency[] = Object.freeze(
  KC_IDS.slice(2, 17).map((on) => Object.freeze({ on, type: P })),
);

/** Catálogo literal de P-I §5.2. */
export const KC_CATALOG: Readonly<Record<KcId, KcEntry>> = Object.freeze({
  KC01: {
    kcId: 'KC01',
    name: 'Fórmulas bien formadas, conectivos y corchetes del cálculo',
    dependencies: [],
    stage1Status: 'Obligatorio',
  },
  KC02: {
    kcId: 'KC02',
    name: 'Notación Fitch, citas de líneas y lectura de subpruebas',
    dependencies: [{ on: 'KC01', type: F }],
    stage1Status: 'Obligatorio',
  },
  KC03: {
    kcId: 'KC03',
    name: 'Reiteración `R`',
    dependencies: [{ on: 'KC02', type: F }],
    stage1Status: 'Obligatorio',
    ruleId: 'R',
  },
  KC04: {
    kcId: 'KC04',
    name: 'Introducción de conjunción `∧I`',
    dependencies: [
      { on: 'KC01', type: F },
      { on: 'KC02', type: F },
    ],
    stage1Status: 'Obligatorio',
    ruleId: '∧I',
  },
  KC05: {
    kcId: 'KC05',
    name: 'Eliminación de conjunción `∧E`',
    dependencies: [
      { on: 'KC01', type: F },
      { on: 'KC02', type: F },
    ],
    stage1Status: 'Obligatorio',
    ruleId: '∧E',
  },
  KC06: {
    kcId: 'KC06',
    name: 'Eliminación del condicional `→E`',
    dependencies: [
      { on: 'KC01', type: F },
      { on: 'KC02', type: F },
    ],
    stage1Status: 'Obligatorio',
    ruleId: '→E',
  },
  KC07: {
    kcId: 'KC07',
    name: 'Introducción de disyunción `∨I`',
    dependencies: [
      { on: 'KC01', type: F },
      { on: 'KC02', type: F },
    ],
    stage1Status: 'Obligatorio',
    ruleId: '∨I',
  },
  KC08: {
    kcId: 'KC08',
    name: 'Alcance, accesibilidad y descarga de supuestos',
    dependencies: [{ on: 'KC02', type: F }],
    stage1Status: 'Transversal',
  },
  KC09: {
    kcId: 'KC09',
    name: 'Introducción del condicional `→I`',
    dependencies: [{ on: 'KC08', type: F }],
    stage1Status: 'Condicional al alcance del conjunto',
    ruleId: '→I',
  },
  KC10: {
    kcId: 'KC10',
    name: 'Obtención de `⊥` mediante `¬E`',
    dependencies: [
      { on: 'KC01', type: F },
      { on: 'KC02', type: F },
    ],
    stage1Status: 'Obligatorio cuando el conjunto lo requiera',
    // «KC10 registra siempre rule_id = "¬E". No existe una regla canónica `⊥I`.»
    ruleId: '¬E',
  },
  KC11: {
    kcId: 'KC11',
    name: 'Introducción de negación `¬I`',
    dependencies: [
      { on: 'KC08', type: F },
      { on: 'KC10', type: F },
    ],
    stage1Status: 'Obligatorio cuando el conjunto lo requiera',
    ruleId: '¬I',
  },
  KC12: {
    kcId: 'KC12',
    name: 'Explosión `X` (`⊥E`)',
    // La única arista de política de contenido del catálogo, y el Maestro lo
    // dice con todas las letras: «es una dependencia de política de contenido,
    // no una necesidad lógica del cálculo general».
    dependencies: [{ on: 'KC10', type: PC }],
    stage1Status: 'Obligatorio cuando el conjunto lo requiera',
    ruleId: 'X',
  },
  KC13: {
    kcId: 'KC13',
    name: 'Eliminación de disyunción / prueba por casos `∨E`',
    dependencies: [
      { on: 'KC08', type: F },
      { on: 'KC07', type: P },
    ],
    stage1Status: 'Condicional al alcance del conjunto',
    ruleId: '∨E',
    conditions: ['disponer de una disyunción'],
  },
  KC14: {
    kcId: 'KC14',
    name: 'Introducción del bicondicional `↔I`',
    dependencies: [
      { on: 'KC08', type: F },
      { on: 'KC09', type: F },
    ],
    stage1Status: 'Obligatorio cuando el conjunto lo requiera',
    ruleId: '↔I',
  },
  KC15: {
    kcId: 'KC15',
    name: 'Eliminación del bicondicional `↔E`',
    dependencies: [{ on: 'KC06', type: CA }],
    stage1Status: 'Obligatorio cuando el conjunto lo requiera',
    ruleId: '↔E',
  },
  KC16: {
    kcId: 'KC16',
    name: 'Eliminación de doble negación `DNE`',
    dependencies: [
      { on: 'KC01', type: F },
      { on: 'KC10', type: CA },
      { on: 'KC11', type: CA },
    ],
    stage1Status: 'Derivada permitida',
    ruleId: 'DNE',
  },
  KC17: {
    kcId: 'KC17',
    name: 'Prueba indirecta `IP` — RAA clásica',
    // El orden respecto de KC16 es **P, no necesidad formal**, así que no hay
    // arista KC17→KC16: fabricarla afirmaría una dependencia del cálculo que el
    // Maestro niega explícitamente.
    dependencies: [
      { on: 'KC08', type: F },
      { on: 'KC10', type: F },
    ],
    stage1Status: 'Primitiva clásica',
    ruleId: 'IP',
    conditions: ['el orden respecto de KC16 es P, no necesidad formal'],
  },
  KC18: {
    kcId: 'KC18',
    name: 'Selección de estrategia y trabajo hacia atrás',
    dependencies: KC03_A_KC17,
    stage1Status: 'Opcional y no determinante',
  },
});

/**
 * Fundamentos compartidos previos a la línea base (§5.2.1,
 * `DEC-FOUNDATION-001`). **No pueden ser KC objetivo de A/B/C**: si lo fueran,
 * la línea base mediría desconocimiento del formato Fitch en vez de los KC
 * experimentales.
 */
export const FOUNDATION_KCS = ['KC01', 'KC02', 'KC08'] as const;
export type FoundationKc = (typeof FOUNDATION_KCS)[number];

export const EXPERIMENTAL_SET_IDS = ['A', 'B', 'C'] as const;
export type ExperimentalSetId = (typeof EXPERIMENTAL_SET_IDS)[number];

export interface ExperimentalSet {
  readonly setId: ExperimentalSetId;
  readonly targetKcs: readonly KcId[];
  readonly supportKcs: readonly KcId[];
  /** Los tres conjuntos referencian **exactamente** `authorized-calculus-v1`. */
  readonly authorizedCalculusVersion: string;
}

export interface KcEdge {
  readonly from: KcId;
  readonly to: KcId;
  readonly type: DependencyType;
}

/** Todas las aristas del catálogo, en orden determinista. */
export function kcEdges(): readonly KcEdge[] {
  return Object.freeze(
    KC_IDS.flatMap((kcId) =>
      KC_CATALOG[kcId].dependencies.map((dep) => ({ from: kcId, to: dep.on, type: dep.type })),
    ),
  );
}

/**
 * Comprueba que el catálogo no ha derivado del cálculo autorizado.
 *
 * Es la contrapartida de derivar los `rule_id`: si alguien escribiera aquí una
 * regla que el cálculo no autoriza, el mapa enseñaría algo que el verificador
 * rechazaría, y el desajuste no aparecería hasta la primera corrección.
 */
export function assertCatalogMatchesCalculus(): void {
  for (const kcId of KC_IDS) {
    const { ruleId } = KC_CATALOG[kcId];
    if (ruleId !== undefined && !(AUTHORIZED_RULE_IDS as readonly string[]).includes(ruleId)) {
      throw new KcMapError(
        `${kcId} declara la regla ${ruleId}, que no está en la whitelist del cálculo autorizado. ` +
          `El mapa enseñaría algo que el verificador rechaza.`,
      );
    }
  }

  // `¬I` e `IP` permanecen separados: dos KC, dos reglas.
  if (KC_CATALOG.KC11.ruleId === KC_CATALOG.KC17.ruleId) {
    throw new KcMapError(
      '¬I e IP quedaron con la misma regla. El Maestro los mantiene separados en contenido, ' +
        'etiquetado y trazas: ¬I supone φ y concluye ¬φ; IP supone ¬φ y concluye φ al derivar ⊥.',
    );
  }

  // «KC10 registra siempre rule_id = "¬E"»; no existe una regla canónica `⊥I`.
  if (KC_CATALOG.KC10.ruleId !== '¬E') {
    throw new KcMapError(
      `KC10 debe registrar siempre rule_id "¬E" y registra ${String(KC_CATALOG.KC10.ruleId)}. ` +
        `No existe una regla canónica ⊥I en el cálculo autorizado.`,
    );
  }
}

export interface CycleFinding {
  readonly cycle: readonly KcId[];
}

/** Clave independiente de rotación: un ciclo es el mismo se empiece por donde se empiece. */
function claveDeCiclo(cycle: readonly KcId[]): string {
  return [...new Set(cycle)].sort().join('>');
}

/** Detecta ciclos sobre **todas** las aristas, sea cual sea su tipo. */
export function findCycles(edges: readonly KcEdge[] = kcEdges()): readonly CycleFinding[] {
  const salientes = new Map<KcId, KcId[]>();
  for (const edge of edges) {
    salientes.set(edge.from, [...(salientes.get(edge.from) ?? []), edge.to]);
  }

  const encontrados = new Map<string, readonly KcId[]>();
  const enPila: KcId[] = [];
  const estado = new Map<KcId, 'abierto' | 'cerrado'>();

  const visitar = (nodo: KcId): void => {
    estado.set(nodo, 'abierto');
    enPila.push(nodo);

    for (const siguiente of salientes.get(nodo) ?? []) {
      if (estado.get(siguiente) === 'abierto') {
        const desde = enPila.indexOf(siguiente);
        const ciclo = enPila.slice(desde);
        encontrados.set(claveDeCiclo(ciclo), Object.freeze([...ciclo]));
      } else if (estado.get(siguiente) === undefined) {
        visitar(siguiente);
      }
    }

    enPila.pop();
    estado.set(nodo, 'cerrado');
  };

  for (const kcId of KC_IDS) {
    if (estado.get(kcId) === undefined) visitar(kcId);
  }

  return Object.freeze([...encontrados.values()].map((cycle) => ({ cycle })));
}

export interface JustifiedCycle {
  readonly cycle: readonly KcId[];
  readonly justification: string;
}

/**
 * «Grafo acíclico **o ciclos justificados**».
 *
 * Un ciclo sin justificación registrada bloquea: un ciclo silencioso en el mapa
 * de prerrequisitos produce una secuencia de enseñanza que no se puede empezar
 * por ningún sitio, y el fallo aparecería en sesión, no aquí.
 */
export function assertAcyclicOrJustified(
  justifiedCycles: readonly JustifiedCycle[] = [],
  edges: readonly KcEdge[] = kcEdges(),
): void {
  const justificados = new Map(
    justifiedCycles
      .filter((j) => j.justification.trim() !== '')
      .map((j) => [claveDeCiclo(j.cycle), j]),
  );

  const sinJustificar = findCycles(edges).filter(
    (f) => !justificados.has(claveDeCiclo(f.cycle)),
  );

  if (sinJustificar.length > 0) {
    throw new KcMapError(
      `El mapa tiene ${sinJustificar.length} ciclo(s) sin justificar: ` +
        sinJustificar.map((f) => f.cycle.join('→')).join('; ') +
        `. El grafo debe ser acíclico o traer la justificación del ciclo.`,
    );
  }
}

export interface CrossSetEdges {
  /** Aristas FORMAL que cruzan conjuntos. */
  readonly formal: readonly KcEdge[];
  /** Aristas POLITICA_CONTENIDO que cruzan conjuntos. */
  readonly politicaContenido: readonly KcEdge[];
  /**
   * Aristas de los otros tres tipos que también cruzan. §5.2 solo trata F y PC
   * como posibles rutas de contaminación, así que estas no se suman a las
   * anteriores; se listan aparte porque omitirlas dejaría el informe incompleto
   * sin decirlo.
   */
  readonly otherTypes: readonly KcEdge[];
}

/**
 * Enumera las aristas que cruzan entre conjuntos experimentales, **FORMAL y
 * POLITICA_CONTENIDO por separado** (§5.2, literal).
 *
 * Por separado y no sumadas: una arista formal es una necesidad del cálculo y
 * una de política de contenido es una decisión de Etapa 1 que podría levantarse.
 * Un total conjunto diría cuántas rutas de contaminación hay y **no** cuál de
 * las dos se puede quitar cambiando una política, que es justo lo que un
 * seleccionador de conjuntos necesita saber.
 */
export function crossSetEdges(sets: readonly ExperimentalSet[]): CrossSetEdges {
  const conjuntoDe = new Map<KcId, ExperimentalSetId>();
  for (const set of sets) {
    for (const kcId of set.targetKcs) conjuntoDe.set(kcId, set.setId);
  }

  const cruzadas = kcEdges().filter((edge) => {
    const origen = conjuntoDe.get(edge.from);
    const destino = conjuntoDe.get(edge.to);
    return origen !== undefined && destino !== undefined && origen !== destino;
  });

  return Object.freeze({
    formal: Object.freeze(cruzadas.filter((e) => e.type === 'FORMAL')),
    politicaContenido: Object.freeze(cruzadas.filter((e) => e.type === 'POLITICA_CONTENIDO')),
    otherTypes: Object.freeze(
      cruzadas.filter((e) => e.type !== 'FORMAL' && e.type !== 'POLITICA_CONTENIDO'),
    ),
  });
}

/**
 * Comprueba los conjuntos experimentales contra las reglas vinculantes de §5.2 y
 * §5.2.1 que ya son exigibles aquí.
 */
export function assertExperimentalSets(sets: readonly ExperimentalSet[]): void {
  for (const set of sets) {
    if (set.authorizedCalculusVersion !== AUTHORIZED_CALCULUS_VERSION) {
      throw new KcMapError(
        `El conjunto ${set.setId} referencia ${set.authorizedCalculusVersion} y los tres deben ` +
          `referenciar exactamente ${AUTHORIZED_CALCULUS_VERSION}. La referencia por conjunto ` +
          `existe para trazabilidad, no para habilitar inventarios distintos de reglas.`,
      );
    }

    const fundamentos = set.targetKcs.filter((kcId) =>
      (FOUNDATION_KCS as readonly string[]).includes(kcId),
    );
    if (fundamentos.length > 0) {
      throw new KcMapError(
        `El conjunto ${set.setId} declara ${fundamentos.join(', ')} como KC objetivo. KC01, KC02 y ` +
          `KC08 son fundamentos pre-SCED (§5.2.1): pueden aparecer como soporte, nunca como ` +
          `objetivo, o la línea base mediría desconocimiento del formato Fitch en vez de los KC ` +
          `experimentales.`,
      );
    }
  }

  const objetivos = sets.flatMap((s) => s.targetKcs);
  const repetidos = objetivos.filter((kc, i) => objetivos.indexOf(kc) !== i);
  if (repetidos.length > 0) {
    throw new KcMapError(
      `Los KC ${[...new Set(repetidos)].join(', ')} son objetivo de más de un conjunto. Un mismo KC ` +
        `objetivo en dos conjuntos haría indistinguibles sus efectos.`,
    );
  }
}
