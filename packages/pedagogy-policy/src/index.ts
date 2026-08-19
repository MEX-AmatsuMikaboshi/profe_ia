// @profesor-ia/pedagogy-policy — Estrategias, modos, andamiaje, selección determinista.

export const PACKAGE_NAME = "@profesor-ia/pedagogy-policy" as const;

export * from './policy.js';
export * from './doubt.js';

export {
  checkNonRevelation,
  NON_REVELATION_BLOCKS,
  type CandidateHint,
  type EgressFilterReceipt,
  type NonRevelationBlock,
  type NonRevelationFinding,
  type NonRevelationInput,
  type NonRevelationVerdict,
} from './non-revelation.js';
