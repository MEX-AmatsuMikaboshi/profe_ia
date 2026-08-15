// @profesor-ia/isomorphism-canonicalizer — Plan.md T-H2-09 [CRITICAL].
//
// **PROHIBIDO en la ruta de verificación.** La regla de dependency-cruiser
// `verificacion-sin-canonicalizador-de-isomorfismo` impide que `logic-core` o
// `apps/verifier` importen este paquete: la normalización que hace aquí
// (renombrado de átomos, reordenamiento de pasos independientes) es
// exactamente lo que el verificador tiene prohibido hacer.
//
// La dirección contraria sí es legítima: este paquete usa el parser y el
// impresor de `logic-core` para trabajar sobre el mismo AST autorizado.

export const PACKAGE_NAME = '@profesor-ia/isomorphism-canonicalizer' as const;

export * from './canonicalize.js';
