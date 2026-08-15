// @profesor-ia/logic-core — parser, AST, reglas, semántica y Fitch (Plan.md F2/H2).
//
// Frontera dura: este paquete está en la ruta de verificación, así que no puede
// importar `@profesor-ia/isomorphism-canonicalizer` ni ningún cliente HTTP
// (reglas `verificacion-sin-canonicalizador-de-isomorfismo` e `i3-verifier-sin-red`).
//
// Determinismo: mismas entradas y versiones ⇒ mismo resultado. No hay red, no
// hay modelo generativo, no hay heurística.

export const PACKAGE_NAME = '@profesor-ia/logic-core' as const;

export * from './calculus.js';
export * from './ast.js';
export * from './errors.js';
export * from './tokenizer.js';
export * from './parser.js';
export * from './fitch.js';
export * from './rules.js';
export * from './semantics.js';
export * from './verify.js';
export * from './construction.js';
