import { generateKeyPairSync } from 'node:crypto';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FreezeManifest, FREEZE_MANIFEST_REQUIRED_SECTIONS } from '@profesor-ia/contracts';
import type { PackageLintFacts } from '@profesor-ia/authoring-core';

import {
  FreezeError,
  REQUIRED_FREEZE_ARTIFACT_RULES,
  assertFreezeManifest,
  createFreezeManifest,
  detectFreezeDrift,
  freezeContentPackage,
  requiredFreezeArtifactGaps,
  verifyFreezeSignature,
  type FreezeSectionInput,
  type FreezeInput,
} from '../src/index.js';

const SHA = 'a'.repeat(64);

function lintFacts(): PackageLintFacts {
  return {
    packageVersion: 'content-v1',
    corpus: { componentCount: 1, fragmentCount: 1, expectedSha256: SHA, actualSha256: SHA },
    fragmentReferences: { danglingIds: [] },
    calculus: {
      version: 'authorized-calculus-v1',
      sha256: SHA,
      ruleCatalogComplete: true,
      aliasCatalogComplete: true,
      semanticDecisionPolicyComplete: true,
    },
    experimentalSets: [
      { setId: 'A', targetKcs: ['KC03'], supportKcs: ['KC01'], authorizedCalculusVersion: 'authorized-calculus-v1' },
      { setId: 'B', targetKcs: ['KC04'], supportKcs: ['KC02'], authorizedCalculusVersion: 'authorized-calculus-v1' },
      { setId: 'C', targetKcs: ['KC05'], supportKcs: ['KC08'], authorizedCalculusVersion: 'authorized-calculus-v1' },
    ],
    map: { unjustifiedCycles: [] },
    coverage: { gapIds: [] },
    reserves: { collisionIds: [] },
    scorableItemIds: ['i-1'],
    solutionItemIds: ['i-1'],
    probes: { missingBySet: { A: 0, B: 0, C: 0 } },
    hints: {
      missingItemIds: [],
      missingLevelsByItem: { 'i-1': [] },
      masteryFlags: [
        {
          itemId: 'i-1', hintOrdinal: 1, level: 1, levelOneReminderOnly: true,
          selectsRuleOrNextStep: false, containsDecisiveContent: false,
          proposedMasteryDisqualifying: false,
        },
      ],
    },
    rubricItemIds: ['i-1'],
    pedagogy: { missingCatalogEntries: [], missingPolicyIds: [], scaffoldingFadingViolationIds: [] },
    retrievalSpacing: { calendarConflictIds: [], measurementReserveConsumptionIds: [] },
    modeSeparationViolationIds: [],
    prohibitedDuplicatePairIds: [],
    golden: { suiteCount: 1, failingCaseIds: [], constructedAcceptanceCaseCount: 1 },
    audit: { auditId: 'audit-1', sampleSeed: 'audit-seed', strataCount: 1 },
    versions: { calculus: 'v1' },
    requiredVersionKeys: ['calculus'],
  };
}

function input(): FreezeInput {
  const generated = new Set(['hashes', 'firma', 'inventario_de_artefactos', 'identificador_unico_de_corrida']);
  const capabilityFlags = {
    voiceInput: false,
    voiceOutput: false,
    whiteboard: true,
    visualBoardInterpretation: false,
    uiAnnotations: true,
    internalUiCapture: true,
    externalScreenCapture: false,
  };
  const sections: Record<string, FreezeSectionInput> = Object.fromEntries(
    FREEZE_MANIFEST_REQUIRED_SECTIONS.filter((section) => !generated.has(section)).map((section) => [
      section,
      { version: `${section}-v1`, content: { evidence: 'verified-fixture' } },
    ]),
  );
  sections.capability_flags_multimodales = {
    version: 'capability-flags-v1',
    content: capabilityFlags,
  };
  sections.authorized_calculus_version_hash_semantica_y_autoridad_de_decision_por_conjunto = {
    version: 'calculus-binding-v1',
    content: {
      authorizedCalculusVersion: 'authorized-calculus-v1',
      authorizedCalculusSha256: SHA,
      semanticPolicyVersion: 'semantic-policy-v1',
      decisionAuthorityBySet: { A: 'logic-core', B: 'logic-core', C: 'logic-core' },
    },
  };
  sections.versiones_de_modelos = {
    version: 'model-prompt-bindings-v1',
    content: {
      models: { authoring: { version: 'authoring-model-v1', hash: SHA } },
      prompts: { candidate: { version: 'candidate-prompt-v1', hash: SHA } },
    },
  };
  sections.semillas = {
    version: 'seeds-v1',
    content: { authoring: 'authoring-seed', audit: 'audit-seed', sced: 17 },
  };
  sections.resultados_de_pruebas_y_manifiesto_de_validacion_del_nucleo_logico = {
    version: 'validation-results-v1',
    content: {
      validationManifestHash: SHA,
      logicValidationManifestHash: SHA,
      mapHash: SHA,
      banksHash: SHA,
      solutionsHash: SHA,
      rubricsHash: SHA,
      hintsHash: SHA,
      verifierManifestHash: SHA,
      complexityManifestHash: SHA,
      checks: ['ci:unit', 'ci:logic:golden'],
    },
  };
  sections.presupuestos_proof_search_timeout_y_parametros_k_coste = {
    version: 'proof-search-budget-v1',
    content: { proofSearchVersion: 'proof-search-v1', parametersHash: SHA, timeoutMs: 5_000, kCost: 12 },
  };
  sections.politica_de_auditoria_codebook_muestreo_y_capacidad_de_deteccion = {
    version: 'preaudit-v1',
    content: {
      auditId: 'audit-1', sampleSeed: 'audit-seed', codebookVersion: 'codebook-v1',
      codebookHash: SHA, samplingManifestHash: SHA, detectionCapacity: { critical: 1 }, passed: true,
    },
  };
  sections.mapa_de_licencias_snapshots_w0_y_atribucion_en_cadena = {
    version: 'licenses-v1',
    content: {
      w0SnapshotHash: SHA, licenseMapHash: SHA, chainAttributionHash: SHA,
      perSection: { source: 'license-record-1' },
    },
  };
  sections.plan_sced_preinscrito = {
    version: 'sced-plan-v1',
    content: {
      planVersion: 'sced-plan-v1', planHash: SHA,
      opportunityDefinitionVersion: 'sced-opportunity-h5-v1', kSet: 3,
      minValidItemsPerOpportunity: 2,
    },
  };
  sections.hash_version_politica_pedagogica = {
    version: 'pedagogy-policy-v1',
    content: { policyVersion: 'pedagogy-policy-v1', policyHash: SHA },
  };
  sections.reglas_de_elegibilidad_para_dominio_y_niveles_de_ayuda = {
    version: 'eligibility-v1',
    content: {
      policyVersion: 'eligibility-v1', eligibilityPolicyHash: SHA, helpLevelsHash: SHA,
      scaffoldingFadingPolicyHash: SHA, retrievalSpacingPolicyHash: SHA,
    },
  };
  sections.configuracion_wheel_spinning = {
    version: 'wheel-spinning-v1',
    content: { version: 'wheel-spinning-v1', hash: SHA },
  };
  sections.configuracion_bkt_sombra_si_se_habilita = {
    version: 'bkt-disabled-v1',
    content: { enabled: false, reason: 'optional_not_enabled' },
  };
  sections.proveedores_modelos_y_politicas_tts_stt_vision = {
    version: 'multimodal-providers-v1',
    content: { stt: { enabled: false }, tts: { enabled: false }, vision: { enabled: false } },
  };
  return {
    manifestVersion: '1',
    runId: 'run-freeze-1',
    createdAt: '2026-08-16T23:00:00.000Z',
    authorizedCalculusVersion: {
      artifactId: 'authorized-calculus',
      version: 'authorized-calculus-v1',
      hash: SHA,
    },
    capabilityFlags,
    sections,
  };
}

const keys = generateKeyPairSync('ed25519');
const privatePem = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicPem = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();

function packageDirectory(): string {
  const root = mkdtempSync(join(tmpdir(), 'profesor-ia-freeze-'));
  writeFileSync(join(root, 'content.json'), JSON.stringify({ item: 'i-1' }));
  writeFileSync(join(root, 'policy.txt'), 'policy-v1');
  for (const rule of REQUIRED_FREEZE_ARTIFACT_RULES) {
    const path = rule.exactPath ?? `${rule.prefix}verified-fixture.json`;
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), JSON.stringify({ ruleId: rule.ruleId, status: 'verified-test-fixture' }));
  }
  return root;
}

describe('T-H5-15: freeze firmado', () => {
  it('produce las 18 secciones, inventario, hash y firma Ed25519 verificable', () => {
    const root = packageDirectory();
    const manifest = createFreezeManifest(root, input(), lintFacts(), privatePem, 'freeze-key-1');
    expect(Object.keys(manifest.sections).sort()).toEqual([...FREEZE_MANIFEST_REQUIRED_SECTIONS].sort());
    expect(manifest.artifacts.map((artifact) => artifact.path)).toContain('content.json');
    expect(manifest.artifacts.map((artifact) => artifact.path)).toContain('solutions-private/verified-fixture.json');
    expect(requiredFreezeArtifactGaps(manifest.artifacts)).toEqual([]);
    expect(manifest.contentPackageHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(manifest.signature).toMatchObject({ keyId: 'freeze-key-1', algorithm: 'Ed25519' });
    expect(FreezeManifest.safeParse(manifest).success).toBe(true);
    expect(assertFreezeManifest(manifest)).toBe(manifest);
    expect(verifyFreezeSignature(manifest, publicPem)).toBe(true);
  });

  it('misma entrada, bytes, fecha y clave produce el mismo manifiesto', () => {
    const root = packageDirectory();
    expect(createFreezeManifest(root, input(), lintFacts(), privatePem, 'freeze-key-1')).toEqual(
      createFreezeManifest(root, input(), lintFacts(), privatePem, 'freeze-key-1'),
    );
  });

  it('la firma deja de verificar si cambia cualquier campo', () => {
    const root = packageDirectory();
    const manifest = createFreezeManifest(root, input(), lintFacts(), privatePem, 'freeze-key-1');
    expect(verifyFreezeSignature({ ...manifest, runId: 'altered' }, publicPem)).toBe(false);
    const other = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }).toString();
    expect(verifyFreezeSignature(manifest, other)).toBe(false);
  });

  it('detecta bytes cambiados, archivos añadidos y faltantes', () => {
    const root = packageDirectory();
    const manifest = createFreezeManifest(root, input(), lintFacts(), privatePem, 'freeze-key-1');
    expect(detectFreezeDrift(root, manifest).matches).toBe(true);
    writeFileSync(join(root, 'content.json'), '{"item":"changed"}');
    expect(detectFreezeDrift(root, manifest).changedPaths).toEqual(['content.json']);
    writeFileSync(join(root, 'added.txt'), 'new');
    expect(detectFreezeDrift(root, manifest).addedPaths).toEqual(['added.txt']);
    rmSync(join(root, 'policy.txt'));
    expect(detectFreezeDrift(root, manifest).missingPaths).toEqual(['policy.txt']);
  });

  it('no firma sin clave, con RSA, con secciones ausentes o placeholders', () => {
    const root = packageDirectory();
    expect(() => createFreezeManifest(root, input(), lintFacts(), '', '')).toThrow(/no se genera/u);
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey
      .export({ type: 'pkcs8', format: 'pem' })
      .toString();
    expect(() => createFreezeManifest(root, input(), lintFacts(), rsa, 'rsa')).toThrow(/Ed25519/u);
    const missing = input();
    const sections = { ...missing.sections };
    delete sections.plan_sced_preinscrito;
    expect(() => createFreezeManifest(root, { ...missing, sections }, lintFacts(), privatePem, 'key')).toThrow(
      /ausentes/u,
    );
    expect(() =>
      createFreezeManifest(
        root,
        {
          ...input(),
          sections: {
            ...input().sections,
            plan_sced_preinscrito: { version: 'sced-v1', content: 'PLACEHOLDER' },
          },
        },
        lintFacts(),
        privatePem,
        'key',
      ),
    ).toThrow(/placeholder/u);
  });

  it('rechaza secciones vacías, extras y referencias cruzadas incoherentes', () => {
    const root = packageDirectory();
    expect(() =>
      createFreezeManifest(
        root,
        {
          ...input(),
          sections: {
            ...input().sections,
            plan_sced_preinscrito: { version: 'sced-v1', content: {} },
          },
        },
        lintFacts(),
        privatePem,
        'key',
      ),
    ).toThrow(/contenido material/u);
    expect(() =>
      createFreezeManifest(
        root,
        { ...input(), sections: { ...input().sections, seccion_inventada: { version: 'v1', content: true } } },
        lintFacts(),
        privatePem,
        'key',
      ),
    ).toThrow(/no autorizadas/u);
    expect(() =>
      createFreezeManifest(
        root,
        {
          ...input(),
          sections: {
            ...input().sections,
            capability_flags_multimodales: {
              version: 'capability-flags-v1',
              content: { ...input().capabilityFlags, voiceInput: true },
            },
          },
        },
        lintFacts(),
        privatePem,
        'key',
      ),
    ).toThrow(/no coincide/u);
    expect(() =>
      createFreezeManifest(
        root,
        {
          ...input(),
          authorizedCalculusVersion: { ...input().authorizedCalculusVersion, hash: 'b'.repeat(64) },
        },
        lintFacts(),
        privatePem,
        'key',
      ),
    ).toThrow(/no coincide/u);
  });

  it('exige los campos materiales de modelos, auditoría, SCED, BKT y proveedores', () => {
    const root = packageDirectory();
    const replaceContent = (name: string, content: unknown): FreezeInput => {
      const base = input();
      const current = base.sections[name];
      if (current === undefined) throw new Error(`fixture sin sección ${name}`);
      return {
        ...base,
        sections: { ...base.sections, [name]: { ...current, content } },
      };
    };
    expect(() =>
      createFreezeManifest(
        root,
        replaceContent('versiones_de_modelos', {
          models: { authoring: { version: 'v1', hash: SHA } },
          prompts: {},
        }),
        lintFacts(), privatePem, 'key',
      ),
    ).toThrow(/prompts/u);
    expect(() =>
      createFreezeManifest(
        root,
        replaceContent('politica_de_auditoria_codebook_muestreo_y_capacidad_de_deteccion', {
          auditId: 'audit-1', sampleSeed: 'audit-seed', codebookVersion: 'v1',
          codebookHash: SHA, samplingManifestHash: SHA, detectionCapacity: { critical: 1 }, passed: false,
        }),
        lintFacts(), privatePem, 'key',
      ),
    ).toThrow(/no está dentro/u);
    expect(() =>
      createFreezeManifest(
        root,
        replaceContent('plan_sced_preinscrito', {
          planVersion: 'v1', planHash: SHA, opportunityDefinitionVersion: 'sced-opportunity-h5-v1',
          kSet: 4, minValidItemsPerOpportunity: 2,
        }),
        lintFacts(), privatePem, 'key',
      ),
    ).toThrow(/T-H5-11/u);
    expect(() =>
      createFreezeManifest(
        root,
        replaceContent('configuracion_bkt_sombra_si_se_habilita', {
          enabled: true, parametersVersion: 'bkt-v1', parametersHash: SHA,
          hiddenFromAgent: false, authority: 'mastery',
        }),
        lintFacts(), privatePem, 'key',
      ),
    ).toThrow(/sin autoridad/u);
    expect(() =>
      createFreezeManifest(
        root,
        replaceContent('proveedores_modelos_y_politicas_tts_stt_vision', {
          stt: { enabled: true }, tts: { enabled: false }, vision: { enabled: false },
        }),
        lintFacts(), privatePem, 'key',
      ),
    ).toThrow(/no coincide/u);
  });

  it('el linter bloquea el freeze antes de firmar', () => {
    const root = packageDirectory();
    const invalid = lintFacts();
    expect(() =>
      createFreezeManifest(root, input(), { ...invalid, coverage: { gapIds: ['KC03'] } }, privatePem, 'key'),
    ).toThrow(/Paquete inválido/u);
  });

  it('rechaza paquete sin artefactos', () => {
    const root = mkdtempSync(join(tmpdir(), 'profesor-ia-empty-freeze-'));
    expect(() => createFreezeManifest(root, input(), lintFacts(), privatePem, 'key')).toThrow(FreezeError);
  });

  it('un README no cubre un grupo material y un TODO en un artefacto bloquea', () => {
    const missing = packageDirectory();
    rmSync(join(missing, 'source', 'fragments', 'verified-fixture.json'));
    writeFileSync(join(missing, 'source', 'fragments', 'README.md'), 'documentación');
    expect(() => createFreezeManifest(missing, input(), lintFacts(), privatePem, 'key')).toThrow(
      /source_fragments/u,
    );

    const placeholder = packageDirectory();
    writeFileSync(join(placeholder, 'kc', 'map.yaml'), 'status: TODO\n');
    expect(() => createFreezeManifest(placeholder, input(), lintFacts(), privatePem, 'key')).toThrow(
      /placeholder/u,
    );
  });

  it('publica atómicamente, detecta drift y no permite recongelar', () => {
    const root = packageDirectory();
    writeFileSync(join(root, 'freeze-manifest.json'), '{"manifestVersion":"0","status":"PLACEHOLDER"}\n');
    const published = freezeContentPackage(root, input(), lintFacts(), privatePem, 'freeze-key-1');
    const onDisk = assertFreezeManifest(JSON.parse(readFileSync(published.manifestPath, 'utf8')));
    expect(onDisk).toEqual(published.manifest);
    expect(detectFreezeDrift(root, onDisk).matches).toBe(true);
    if (process.platform !== 'win32') {
      expect(lstatSync(join(root, 'content.json')).mode & 0o222).toBe(0);
      expect(lstatSync(published.manifestPath).mode & 0o222).toBe(0);
      expect(lstatSync(root).mode & 0o222).toBe(0);
    }
    expect(() => freezeContentPackage(root, input(), lintFacts(), privatePem, 'freeze-key-1')).toThrow(
      /no se sobrescribe/u,
    );
  });

  it('un temporal preexistente bloquea sin borrarlo', () => {
    const root = packageDirectory();
    const temporary = join(root, '.freeze-manifest.tmp');
    writeFileSync(temporary, 'publicación ajena');
    expect(() => freezeContentPackage(root, input(), lintFacts(), privatePem, 'key')).toThrow(/preexistente/u);
    expect(readFileSync(temporary, 'utf8')).toBe('publicación ajena');
  });
});
