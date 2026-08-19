import { describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { FreezeManifest, FREEZE_MANIFEST_REQUIRED_SECTIONS } from '@profesor-ia/contracts';
import {
  BKT_SHADOW_H5_CONFIGURATION,
  REQUIRED_FREEZE_ARTIFACT_RULES,
} from '@profesor-ia/experiment';
import { COMMANDS, NOT_IMPLEMENTED_EXIT_CODE, USAGE_EXIT_CODE, run } from '../src/index.js';

const SHA = 'a'.repeat(64);

function validLintFacts(): unknown {
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

function validFreezeInput(): unknown {
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
  const sections: Record<string, unknown> = Object.fromEntries(
    FREEZE_MANIFEST_REQUIRED_SECTIONS.filter((section) => !generated.has(section)).map((section) => [
      section,
      { version: `${section}-v1`, content: { evidence: 'verified-test-fixture' } },
    ]),
  );
  sections.capability_flags_multimodales = { version: 'flags-v1', content: capabilityFlags };
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
  sections.semillas = { version: 'seeds-v1', content: { authoring: 'seed-1', audit: 'audit-seed' } };
  sections.resultados_de_pruebas_y_manifiesto_de_validacion_del_nucleo_logico = {
    version: 'validation-v1',
    content: {
      validationManifestHash: SHA, logicValidationManifestHash: SHA, mapHash: SHA, banksHash: SHA,
      solutionsHash: SHA, rubricsHash: SHA, hintsHash: SHA, verifierManifestHash: SHA,
      complexityManifestHash: SHA, checks: ['ci:unit'],
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
    version: 'pedagogy-v1', content: { policyVersion: 'pedagogy-v1', policyHash: SHA },
  };
  sections.reglas_de_elegibilidad_para_dominio_y_niveles_de_ayuda = {
    version: 'eligibility-v1',
    content: {
      policyVersion: 'eligibility-v1', eligibilityPolicyHash: SHA, helpLevelsHash: SHA,
      scaffoldingFadingPolicyHash: SHA, retrievalSpacingPolicyHash: SHA,
    },
  };
  sections.configuracion_wheel_spinning = {
    version: 'wheel-v1', content: { version: 'wheel-v1', hash: SHA },
  };
  sections.configuracion_bkt_sombra_si_se_habilita = {
    version: 'bkt-disabled-v1', content: BKT_SHADOW_H5_CONFIGURATION,
  };
  sections.proveedores_modelos_y_politicas_tts_stt_vision = {
    version: 'providers-v1',
    content: { stt: { enabled: false }, tts: { enabled: false }, vision: { enabled: false } },
  };
  return {
    manifestVersion: '1',
    runId: 'cli-freeze-test-run',
    createdAt: '2026-08-16T23:00:00.000Z',
    authorizedCalculusVersion: {
      artifactId: 'authorized-calculus', version: 'authorized-calculus-v1', hash: SHA,
    },
    capabilityFlags,
    sections,
  };
}

describe('CLI profesor-ia (T-H0-07)', () => {
  it('expone los cinco comandos del plan', () => {
    expect(COMMANDS.map((c) => c.path.join(' ')).sort()).toEqual([
      'content validate',
      'experiment freeze',
      'ledger verify',
      'restore drill',
      'w0 replay',
    ]);
  });

  it.each(
    COMMANDS.filter((c) => !['content validate', 'experiment freeze', 'w0 replay'].includes(c.path.join(' '))).map(
      (c) => c.path.join(' '),
    ),
  )(
    '«%s» falla explícitamente, no simula éxito',
    (cmd) => {
      const result = run(cmd.split(' '));
      expect(result.exitCode).toBe(NOT_IMPLEMENTED_EXIT_CODE);
      expect(result.stderr).toContain('NO_IMPLEMENTADO');
    },
  );

  it('content validate ejecuta el linter y falla si solo hay placeholders', () => {
    const directory = mkdtempSync(join(tmpdir(), 'profesor-ia-empty-'));
    const result = run(['content', 'validate', directory]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('falta');
  });

  it('content validate enumera fallos de un manifiesto incompleto', () => {
    const directory = mkdtempSync(join(tmpdir(), 'profesor-ia-invalid-'));
    writeFileSync(join(directory, 'lint-input.json'), JSON.stringify({ packageVersion: '' }));
    const result = run(['content', 'validate', directory]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('ilegible o incompleto');
  });

  it('experiment freeze dejó de ser stub y bloquea placeholders antes de pedir firma', () => {
    const directory = mkdtempSync(join(tmpdir(), 'profesor-ia-freeze-cli-'));
    const result = run(['experiment', 'freeze', '--content', directory], {});
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('no se firma un placeholder');
    expect(result.stderr).not.toContain('NO_IMPLEMENTADO');
  });

  it('experiment freeze publica un manifest contractual con una clave proporcionada', () => {
    const directory = mkdtempSync(join(tmpdir(), 'profesor-ia-freeze-cli-valid-'));
    writeFileSync(join(directory, 'content.json'), '{"item":"i-1"}\n');
    for (const rule of REQUIRED_FREEZE_ARTIFACT_RULES) {
      const path = rule.exactPath ?? `${rule.prefix}verified-fixture.json`;
      mkdirSync(dirname(join(directory, path)), { recursive: true });
      writeFileSync(join(directory, path), JSON.stringify({ status: 'verified-test-fixture' }));
    }
    writeFileSync(join(directory, 'lint-input.json'), JSON.stringify(validLintFacts()));
    writeFileSync(join(directory, 'freeze-input.json'), JSON.stringify(validFreezeInput()));
    const keys = generateKeyPairSync('ed25519');
    const privateKey = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const result = run(
      ['experiment', 'freeze', '--content', directory],
      {
        PROFESOR_IA_FREEZE_PRIVATE_KEY_PEM: privateKey,
        PROFESOR_IA_FREEZE_KEY_ID: 'cli-test-key',
      },
    );
    expect(result).toMatchObject({ exitCode: 0, stderr: '' });
    const manifest = JSON.parse(readFileSync(join(directory, 'freeze-manifest.json'), 'utf8')) as unknown;
    expect(FreezeManifest.safeParse(manifest).success).toBe(true);
  });

  it('un comando desconocido no se interpreta como éxito', () => {
    expect(run(['freeze', 'todo']).exitCode).toBe(USAGE_EXIT_CODE);
  });

  it('w0 replay ejecuta la corrida sobre fixtures y devuelve manifiesto y readiness', () => {
    const directory = mkdtempSync(join(tmpdir(), 'profesor-ia-w0-'));
    const sha = 'b'.repeat(64);
    writeFileSync(
      join(directory, 'corrida.json'),
      JSON.stringify({
        courseId: 'deduccion-natural-u1',
        scope: { formalSystemId: 'forallx-calgary-tfl', topic: 'Deducción natural' },
        whitelist: [
          {
            sourceId: 'open-logic-project',
            name: 'Open Logic Project',
            accessMode: 'api',
            baseUrl: 'https://example.test/olp',
          },
        ],
        candidates: [
          {
            sourceId: 'open-logic-project',
            accessMode: 'api',
            record: {
              url: 'https://example.test/olp/forallx',
              origin: 'Open Logic Project',
              version: 'v2026-01',
              retrievedAt: '2026-08-19T00:00:00.000Z',
              licenseEvidence: 'CC BY 4.0 archivada',
              snapshotSha256: sha,
            },
          },
        ],
        discoveryRounds: [{ round: 1, newItems: 1, reviewedItems: 1, lineages: ['forallx'] }],
        evaluations: [
          {
            candidateUrl: 'https://example.test/olp/forallx',
            sourceComponent: 'olp/forallx',
            observations: {
              autoridad: 0.9, revision: 0.8, estabilidad: 0.7,
              explicitud: 0.9, verificabilidad: 0.8, cobertura: 0.6,
            },
            claims: [
              {
                sourceId: 'olp/forallx',
                formalSystemId: 'forallx-calgary-tfl',
                notationFamily: 'fitch',
                version: 'v2026-01',
                scope: 'introduccion-conjuncion',
                statement: 'De A∧B se deriva A.',
                declaredClass: 'informacion_complementaria',
              },
            ],
            licenseRecord: {
              sourceComponent: 'olp/forallx',
              sourceVersion: 'v2026-01',
              provenanceBasis: 'Descargado del repositorio',
              licenseEvidence: 'CC BY 4.0 archivada',
              terms: {
                licenseId: 'CC-BY-4.0',
                nonCommercial: false,
                shareAlike: false,
                noDerivatives: false,
                thirdPartyPermissionOnly: false,
              },
            },
            attributionChain: ['Autor', 'Repositorio'],
          },
        ],
        licenseQuery: { intendedUse: 'base_expresiva' },
        selectionRationale: 'Una fuente de la whitelist cubre el bloque con licencia preferida.',
      }),
    );
    const result = run(['w0', 'replay', join(directory, 'corrida.json')]);
    expect(result.exitCode).toBe(0);
    const salida = JSON.parse(result.stdout) as {
      finalState: string;
      readiness: { hasAuthorized: boolean };
    };
    expect(salida.finalState).toBe('propuesta_corpus');
    expect(salida.readiness.hasAuthorized).toBe(true);
  });

  it('w0 replay falla nombrando lo que falta, no con un genérico', () => {
    const directory = mkdtempSync(join(tmpdir(), 'profesor-ia-w0-mal-'));
    writeFileSync(
      join(directory, 'corrida.json'),
      JSON.stringify({
        courseId: 'x',
        scope: { formalSystemId: 'otro-calculo', topic: 'lo que sea' },
      }),
    );
    const result = run(['w0', 'replay', join(directory, 'corrida.json')]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('W0_REPLAY_FALLIDO');
    expect(result.stderr).toContain('forallx-calgary-tfl');
    expect(result.stderr).not.toContain('NO_IMPLEMENTADO');
  });
});
