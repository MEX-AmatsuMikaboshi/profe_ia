/**
 * `authorized-calculus-v1` — tablas literales de Maestro P-II §4.1.1
 * (Plan.md T-H2-01/03/05, [CRITICAL]).
 *
 * El artefacto autoritativo es el YAML congelado y hasheado
 * (`calculus/authorized-calculus-v1.yaml`, copia idéntica en
 * `content/unidad-deduccion-natural/kc/`). Este módulo expone las tablas como
 * datos tipados; `calculus.test.ts` verifica que ambos archivos son idénticos,
 * que su hash coincide con el registrado y que estas tablas no divergen del YAML.
 */

export const AUTHORIZED_CALCULUS_VERSION = 'authorized-calculus-v1' as const;
export const FORMAL_SYSTEM_ID = 'forallx-calgary-tfl' as const;

/** SHA-256 del artefacto congelado. Un cambio aquí es cambio de versión del cálculo. */
export const AUTHORIZED_CALCULUS_SHA256 =
  '904d3b44ab368a8608731806a8bcfa5a426a829e5a807fbf2a680423e038c757' as const;

/** SHA-256 del snapshot PDF de referencia (forall x: Calgary, Fall 2025 rev 8642250). */
export const SOURCE_SNAPSHOT_SHA256 =
  '2a8fea85b358fb45ba7835dee5166b5990b7a7c11ad4dc6c41ebdd9a265c1888' as const;
export const SOURCE_SNAPSHOT_SIZE_BYTES = 1_562_067 as const;

export const CONNECTIVES = ['¬', '∧', '∨', '→', '↔'] as const;
export type Connective = (typeof CONNECTIVES)[number];

/** `⊥` es un átomo distinguido con `v(⊥)=F`, no un conectivo. */
export const FALSUM = '⊥' as const;

export const PRIMITIVE_RULES = [
  'R',
  '∧I',
  '∧E',
  '∨I',
  '∨E',
  '→I',
  '→E',
  '↔I',
  '↔E',
  '¬I',
  '¬E',
  'X',
  'IP',
] as const;

export const LINE_JUSTIFICATIONS = ['PR', 'AS'] as const;

/** Única regla derivada autorizada: elimina exactamente dos negaciones. */
export const DERIVED_ALLOWED = ['DNE'] as const;

/** Whitelist cerrada: cualquier regla no listada falla cerrado. */
export const AUTHORIZED_RULE_IDS = [...PRIMITIVE_RULES, ...DERIVED_ALLOWED] as const;
export type RuleId = (typeof AUTHORIZED_RULE_IDS)[number];

/**
 * Reglas derivadas y de otros sistemas explícitamente prohibidas (P-II §4.1.1).
 * La lista es ilustrativa del rechazo: lo que no esté en la whitelist se rechaza igual.
 */
export const FORBIDDEN_RULES_EXAMPLES = ['DS', 'MT', 'DeM', 'LEM', 'TND', 'Taut Con'] as const;

/**
 * Alias de entrada cerrados para conectivos (P-II §4.1.1). Se canonicalizan
 * **antes** de verificar.
 */
export const CONNECTIVE_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  '->': '→',
  '=>': '→',
  '/\\': '∧',
  '&': '∧',
  '\\/': '∨',
  '|': '∨',
  '<->': '↔',
  '<=>': '↔',
  '~': '¬',
  '!': '¬',
  '_|_': '⊥',
  '!?': '⊥',
  '#': '⊥',
});

/** Alias rechazados de forma explícita: no se interpretan «con buena voluntad». */
export const REJECTED_CONNECTIVE_ALIASES = [
  '>',
  '-',
  'and',
  'or',
  'not',
  'y',
  'o',
  'no',
] as const;

/**
 * Alias de nombres de regla (P-II §4.1.1). Un alias **nunca** aparece como
 * `rule_id` en `VerificationResult`, trazas o evidencia.
 */
export const RULE_ALIASES: Readonly<Record<string, RuleId>> = Object.freeze({
  '⊥I': '¬E',
  Contra: '¬E',
  '⊥E': 'X',
  EFQ: 'X',
  Explosión: 'X',
  RAA: 'IP',
  Reductio: 'IP',
  'Prueba indirecta': 'IP',
  '¬¬E': 'DNE',
  DN: 'DNE',
  MP: '→E',
  CP: '→I',
  Reit: 'R',
  Rep: 'R',
  Casos: '∨E',
});

/** Formas autorizadas, en español canónico (tabla literal P-II §4.1.1). */
export const RULE_FORMS: Readonly<Record<RuleId, string>> = Object.freeze({
  R: 'de φ, concluye φ',
  '∧I': 'de φ, ψ, concluye φ∧ψ',
  '∧E': 'de φ∧ψ, concluye uno de sus dos miembros',
  '∨I': 'de φ, concluye φ∨ψ o ψ∨φ',
  '∨E': 'disyunción + dos subpruebas a la misma conclusión',
  '→I': 'subprueba φ ⇒ ψ, concluye φ→ψ',
  '→E': 'φ→ψ, φ ⟹ ψ',
  '↔I': 'dos subpruebas φ⇒ψ y ψ⇒φ',
  '↔E': 'φ↔ψ + uno de sus lados ⟹ el otro',
  '¬I': 'subprueba φ⇒⊥, concluye ¬φ',
  '¬E': 'φ, ¬φ ⟹ ⊥',
  X: '⊥ ⟹ cualquier ψ',
  IP: 'subprueba ¬φ⇒⊥, concluye φ',
  DNE: '¬¬φ ⟹ φ; elimina exactamente dos negaciones',
});

/** Lexicón español canónico (P-II §4.1.1). Los ids formales nunca se traducen en trazas. */
export const LEXICON_ES: Readonly<Record<string, string>> = Object.freeze({
  '¬': 'negación',
  '∧': 'conjunción',
  '∨': 'disyunción',
  '→': 'condicional',
  '↔': 'bicondicional',
  '⊥': 'absurdo',
  R: 'reiteración',
  '∧I': 'introducción de conjunción',
  '∧E': 'eliminación de conjunción',
  '∨I': 'introducción de disyunción',
  '∨E': 'eliminación de disyunción',
  '→I': 'introducción de condicional',
  '→E': 'eliminación de condicional',
  '↔I': 'introducción de bicondicional',
  '↔E': 'eliminación de bicondicional',
  '¬I': 'introducción de negación',
  '¬E': 'eliminación de negación',
  X: 'explosión',
  IP: 'prueba indirecta (RAA clásica)',
  DNE: 'eliminación de doble negación',
  PR: 'premisa',
  AS: 'supuesto',
});

/**
 * Normalizaciones **permitidas** en la ruta de verificación (conservadoras).
 * Todo lo demás está prohibido: conmutativa/asociativa/distributiva, DNE
 * automática, NNF/CNF/DNF, expansión de `↔` y el canonicalizador de isomorfismo.
 */
export const ALLOWED_NORMALIZATIONS = [
  'alias_a_simbolo_canonico',
  'espacios',
  'corchete_exterior',
  'equivalencia_de_glyphs_de_corchetes',
  'canonicalizacion_de_subindices',
] as const;

export const FORBIDDEN_NORMALIZATIONS = [
  'conmutativa',
  'asociativa',
  'distributiva',
  'dne_automatica',
  'nnf',
  'cnf',
  'dnf',
  'expansion_de_bicondicional',
  'canonicalizador_de_isomorfismo',
] as const;

/** Reglas de alcance y descarga (P-II §4.1.1). */
export const SCOPE_RULES = [
  'toda_linea_tiene_justificacion',
  'pr_solo_en_bloque_de_premisas_nivel_0',
  'as_solo_en_primera_linea_de_subprueba',
  'toda_cita_precede_a_la_linea_que_la_usa',
  'linea_en_subprueba_cerrada_no_accesible_desde_fuera',
  'subprueba_citada_completa_y_accesible',
  'conclusion_final_en_profundidad_0_sin_supuestos_abiertos',
  'subpruebas_de_una_linea_y_descarga_vacua_permitidas',
  'limite_de_profundidad_es_parametro_de_implementacion',
] as const;

/**
 * Política de decisión congelada: la completitud **no** se afirma y
 * `no_proof_exists_in_calculus` permanece deshabilitado hasta CALC-03.
 */
export const DECISION_POLICY = Object.freeze({
  completenessClaimed: false,
  noProofExistsInCalculusEnabled: false,
});

/** Política de contenido de Etapa 1: `⊥` prohibido como premisa/supuesto inicial. */
export const CONTENT_POLICY_STAGE1 = Object.freeze({
  falsumAsPremise: false,
  falsumAsInitialAssumption: false,
  atoms: 'A-Z',
});
