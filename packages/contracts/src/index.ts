// @profesor-ia/contracts — JSON Schema + Zod compartidos (Plan.md T-H0-03).
//
// Un mismo contrato sirve para HTTP, eventos y salidas de modelo (§3).
// Regla §0.2.5: ningún catálogo del Maestro se inventa aquí; lo no transcrito
// falla cerrado vía `pendingCatalog` y queda listado en `pendingCatalogs()`.

export * from './pending.js';
export * from './primitives.js';
export * from './verification-result.js';
export * from './evidence-event.js';
export * from './pedagogical-decision.js';
export * from './probe.js';
export * from './anchored-segment.js';
export * from './model-binding.js';
export * from './cost.js';
export * from './incident.js';
export * from './manifests.js';
