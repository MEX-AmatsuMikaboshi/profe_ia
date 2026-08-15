// @profesor-ia/proof-search — buscador de demostraciones (Plan.md T-H2-08).
//
// **Paquete de autoría, no de sesión** (P-II §4.4). El agente de sesión no lo
// invoca: las soluciones que produce se guardan en `private_solutions`, que la
// ruta de sesión no puede leer (I-2).
//
// Estados posibles: `proof_found`, `semantically_invalid`,
// `search_budget_exhausted`, `no_proof_with_cost_at_most_k`.
// `no_proof_exists_in_calculus` **no está disponible**: exige un decisor
// terminante documentado para la misma versión del cálculo (CALC-03).

export const PACKAGE_NAME = '@profesor-ia/proof-search' as const;

export * from './types.js';
export * from './search.js';
export * from './complexity.js';
export * from './bench.js';
