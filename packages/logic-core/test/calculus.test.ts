import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  AUTHORIZED_CALCULUS_SHA256,
  AUTHORIZED_CALCULUS_VERSION,
  AUTHORIZED_RULE_IDS,
  CONNECTIVE_ALIASES,
  DECISION_POLICY,
  FORBIDDEN_NORMALIZATIONS,
  FORMAL_SYSTEM_ID,
  LINE_JUSTIFICATIONS,
  REJECTED_CONNECTIVE_ALIASES,
  RULE_ALIASES,
  RULE_FORMS,
  SOURCE_SNAPSHOT_SHA256,
} from '../src/calculus.js';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(here, '..', '..', '..');
const LOGIC_CORE_YAML = join(here, '..', 'calculus', 'authorized-calculus-v1.yaml');
const CONTENT_YAML = join(
  REPO_ROOT,
  'content',
  'unidad-deduccion-natural',
  'kc',
  'authorized-calculus-v1.yaml',
);

const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

describe('authorized-calculus-v1 (T-H2-01)', () => {
  it('el artefacto de logic-core y el del repositorio de contenido son idénticos', () => {
    expect(sha256(LOGIC_CORE_YAML)).toBe(sha256(CONTENT_YAML));
  });

  it('el hash del artefacto coincide con el registrado (drift = cambio de versión)', () => {
    expect(sha256(LOGIC_CORE_YAML)).toBe(AUTHORIZED_CALCULUS_SHA256);
  });

  it('el YAML declara la versión, el sistema formal y el snapshot esperados', () => {
    const yaml = readFileSync(CONTENT_YAML, 'utf8');
    expect(yaml).toContain(`authorizedCalculusVersion: ${AUTHORIZED_CALCULUS_VERSION}`);
    expect(yaml).toContain(`formal_system_id: ${FORMAL_SYSTEM_ID}`);
    expect(yaml).toContain(SOURCE_SNAPSHOT_SHA256);
    expect(yaml).toContain('status: CONGELADA');
  });
});

describe('whitelist cerrada de reglas', () => {
  it('son exactamente 13 primitivas + 1 derivada autorizada', () => {
    expect(AUTHORIZED_RULE_IDS).toHaveLength(14);
    expect(AUTHORIZED_RULE_IDS).toContain('DNE');
    expect(AUTHORIZED_RULE_IDS).not.toContain('DS');
    expect(AUTHORIZED_RULE_IDS).not.toContain('MT');
  });

  it('PR y AS son justificaciones de línea, no reglas de inferencia', () => {
    expect(LINE_JUSTIFICATIONS).toEqual(['PR', 'AS']);
    for (const justification of LINE_JUSTIFICATIONS) {
      expect(AUTHORIZED_RULE_IDS as readonly string[]).not.toContain(justification);
    }
  });

  it('cada regla autorizada declara su forma', () => {
    for (const id of AUTHORIZED_RULE_IDS) {
      expect(RULE_FORMS[id]).toBeTruthy();
    }
  });
});

describe('alias de entrada', () => {
  it('todo alias de regla resuelve a un rule_id autorizado', () => {
    for (const canonical of Object.values(RULE_ALIASES)) {
      expect(AUTHORIZED_RULE_IDS as readonly string[]).toContain(canonical);
    }
  });

  it('ningún alias es a su vez un rule_id (nunca aparece en trazas)', () => {
    for (const alias of Object.keys(RULE_ALIASES)) {
      expect(AUTHORIZED_RULE_IDS as readonly string[]).not.toContain(alias);
    }
  });

  it('los alias rechazados no están en la tabla de conectivos', () => {
    for (const rejected of REJECTED_CONNECTIVE_ALIASES) {
      expect(Object.keys(CONNECTIVE_ALIASES)).not.toContain(rejected);
    }
  });
});

describe('política congelada', () => {
  it('no se afirma completitud y no_proof_exists_in_calculus está deshabilitado', () => {
    expect(DECISION_POLICY.completenessClaimed).toBe(false);
    expect(DECISION_POLICY.noProofExistsInCalculusEnabled).toBe(false);
  });

  it('el canonicalizador de isomorfismo está entre las normalizaciones prohibidas', () => {
    expect(FORBIDDEN_NORMALIZATIONS).toContain('canonicalizador_de_isomorfismo');
    expect(FORBIDDEN_NORMALIZATIONS).toContain('dne_automatica');
  });
});
