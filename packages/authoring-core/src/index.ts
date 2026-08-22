// @profesor-ia/authoring-core — Etapas y validadores del pipeline W1–W5.
// F0/H0: esqueleto sin lógica. Ver docs/plan/PLAN_STATUS.md.

export const PACKAGE_NAME = "@profesor-ia/authoring-core" as const;

export * from './errors.js';
export * from './w0-state.js';
export * from './w0-runner.js';
export * from './connectors.js';
export * from './formal-system.js';
export * from './licensing.js';
export * from './discovery.js';
export * from './suitability.js';
export * from './selection-manifest.js';
export * from './corpus-authorization.js';
export * from './translingual.js';
export * from './groundedness-calibration.js';
export * from './ingestion.js';
export * from './latex-fragments.js';
export * from './w1-runner.js';
export * from './extraction.js';
export * from './kc-map.js';
export * from './kc-map-yaml.js';
export * from './pedagogy.js';
export * from './reserves.js';
export * from './hints.js';
export * from './critique.js';
export * from './coverage.js';
export * from './family.js';
export * from './generation.js';
export * from './regeneration.js';
export * from './experimental-selection.js';
export * from './package-linter.js';
export * from './preaudit.js';
export * from './probe-rule-closure.js';
