import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
  type KeyObject,
} from 'node:crypto';
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import {
  CapabilityFlags,
  FreezeManifest as FreezeManifestContract,
  FREEZE_MANIFEST_REQUIRED_SECTIONS,
  type VersionRef,
} from '@profesor-ia/contracts';
import {
  assertContentPackageValid,
  PACKAGE_LINT_CHECK_IDS,
  type PackageLintFacts,
  type PackageLintReport,
} from '@profesor-ia/authoring-core';
import { SCED_OPPORTUNITY_H5_V1 } from './sced-opportunity.js';

const SHA256 = /^[a-f0-9]{64}$/u;
const PLACEHOLDER_TOKEN = /(?:^|[^a-z0-9])(placeholder|todo|tbd|pendiente)(?:$|[^a-z0-9])/iu;
const GENERATED_SECTIONS = new Set<string>([
  'hashes',
  'firma',
  'inventario_de_artefactos',
  'identificador_unico_de_corrida',
]);
const EXTERNAL_SECTIONS = FREEZE_MANIFEST_REQUIRED_SECTIONS.filter(
  (section) => !GENERATED_SECTIONS.has(section),
);

export interface RequiredFreezeArtifactRule {
  readonly ruleId: string;
  readonly exactPath?: string;
  readonly prefix?: string;
}

/** Árbol material mínimo de Plan.md §4.3; un README no satisface un banco. */
export const REQUIRED_FREEZE_ARTIFACT_RULES: readonly RequiredFreezeArtifactRule[] = Object.freeze([
  { ruleId: 'research_selection', exactPath: 'research/selection-manifest.yaml' },
  { ruleId: 'research_licenses', exactPath: 'research/license-register.yaml' },
  { ruleId: 'source_manifest', exactPath: 'source/manifest.yaml' },
  { ruleId: 'source_fragments', prefix: 'source/fragments/' },
  { ruleId: 'extracted_definitions', exactPath: 'extracted/definitions.yaml' },
  { ruleId: 'extracted_notation', exactPath: 'extracted/notation.yaml' },
  { ruleId: 'extracted_rules', exactPath: 'extracted/rules.yaml' },
  { ruleId: 'extracted_claims', exactPath: 'extracted/claims.yaml' },
  { ruleId: 'provenance_anchors', exactPath: 'provenance/anchors.yaml' },
  { ruleId: 'provenance_decisions', exactPath: 'provenance/curricular-decisions.yaml' },
  { ruleId: 'kc_calculus', exactPath: 'kc/authorized-calculus-v1.yaml' },
  { ruleId: 'kc_map', exactPath: 'kc/map.yaml' },
  { ruleId: 'experimental_sets', exactPath: 'kc/experimental-sets.yaml' },
  { ruleId: 'objectives', prefix: 'objectives/' },
  { ruleId: 'strategy_catalog', exactPath: 'pedagogy/strategy-catalog.yaml' },
  { ruleId: 'selection_rules', exactPath: 'pedagogy/selection-rules.yaml' },
  { ruleId: 'assistance_policy', exactPath: 'pedagogy/assistance-policy.yaml' },
  { ruleId: 'retrieval_spacing', exactPath: 'pedagogy/retrieval-spacing.yaml' },
  { ruleId: 'shadow_metrics', exactPath: 'pedagogy/shadow-metrics.yaml' },
  { ruleId: 'session_templates', prefix: 'session-templates/' },
  { ruleId: 'items_diagnostic', prefix: 'items/diagnostic/' },
  { ruleId: 'items_guided', prefix: 'items/guided-practice/' },
  { ruleId: 'items_independent', prefix: 'items/independent-practice/' },
  { ruleId: 'items_recovery', prefix: 'items/recovery/' },
  { ruleId: 'items_probes_baseline', prefix: 'items/probes-baseline/' },
  { ruleId: 'items_probes_intervention', prefix: 'items/probes-intervention/' },
  { ruleId: 'items_transfer', prefix: 'items/transfer/' },
  { ruleId: 'items_retention', prefix: 'items/retention/' },
  { ruleId: 'items_replacement', prefix: 'items/replacement/' },
  { ruleId: 'hints', prefix: 'hints/' },
  { ruleId: 'rubrics', prefix: 'rubrics/' },
  { ruleId: 'private_solutions', prefix: 'solutions-private/' },
  { ruleId: 'golden_tests', prefix: 'golden-tests/' },
  { ruleId: 'preaudit', prefix: 'audits/' },
]);

export class FreezeError extends Error {}

export interface FreezeSectionInput {
  /** Versión del esquema o artefacto agrupador de esta sección. */
  readonly version: string;
  /** Datos materiales; W5 calcula y firma su hash en vez de confiar en uno declarado. */
  readonly content: unknown;
}

export interface FreezeInput {
  readonly manifestVersion: '1';
  readonly runId: string;
  readonly createdAt: string;
  readonly authorizedCalculusVersion: VersionRef;
  readonly capabilityFlags: Readonly<Record<string, boolean>>;
  readonly sections: Readonly<Record<string, FreezeSectionInput>>;
}

export interface FrozenArtifact {
  readonly path: string;
  readonly hash: string;
  readonly bytes: number;
}

export interface FreezeSignature {
  readonly keyId: string;
  readonly algorithm: 'Ed25519';
  readonly publicKeySha256: string;
  readonly signature: string;
  readonly signedAt: string;
}

export interface CompleteFreezeManifest {
  readonly manifestVersion: '1';
  readonly runId: string;
  readonly createdAt: string;
  readonly contentPackageHash: string;
  readonly authorizedCalculusVersion: VersionRef;
  readonly artifacts: readonly FrozenArtifact[];
  readonly capabilityFlags: Readonly<Record<string, boolean>>;
  readonly sections: Readonly<Record<string, unknown>>;
  readonly lintReport: PackageLintReport;
  readonly signature: FreezeSignature;
}

function sha256(bytes: string | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** JSON canónico mínimo: rechaza valores que JSON.stringify perdería o alteraría. */
function canonical(value: unknown, seen = new Set<object>()): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new FreezeError('El manifiesto contiene un número no finito.');
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value !== 'object') {
    throw new FreezeError(`El manifiesto contiene un valor no serializable (${typeof value}).`);
  }
  if (seen.has(value)) throw new FreezeError('El manifiesto contiene una referencia circular.');
  seen.add(value);
  try {
    if (Array.isArray(value)) return `[${value.map((entry) => canonical(entry, seen)).join(',')}]`;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new FreezeError('El manifiesto solo admite objetos JSON planos.');
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key], seen)}`)
      .join(',')}}`;
  } finally {
    seen.delete(value);
  }
}

function isMaterial(value: unknown): boolean {
  if (value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return false;
}

function comparePortablePaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertRootDirectory(root: string): void {
  if (!existsSync(root)) throw new FreezeError(`El directorio de contenido no existe: ${root}.`);
  const stat = lstatSync(root);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new FreezeError('La raíz del paquete debe ser un directorio real, no un enlace simbólico.');
  }
}

function artifactFiles(root: string): readonly string[] {
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const name of readdirSync(directory).sort(comparePortablePaths)) {
      if (name === '.git' || name === 'freeze-manifest.json') continue;
      const path = resolve(directory, name);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new FreezeError(`El paquete contiene un enlace simbólico: ${path}.`);
      if (stat.isDirectory()) visit(path);
      else if (stat.isFile()) {
        if (stat.nlink > 1) throw new FreezeError(`El paquete contiene un hard link mutable externamente: ${path}.`);
        files.push(path);
      }
    }
  };
  visit(root);
  return Object.freeze(files);
}

export function inventoryContentPackage(rootPath: string): readonly FrozenArtifact[] {
  const root = resolve(rootPath);
  assertRootDirectory(root);
  return Object.freeze(
    artifactFiles(root).map((path) => {
      const bytes = readFileSync(path);
      const portablePath = relative(root, path).split(sep).join('/');
      if (
        portablePath.startsWith('../') ||
        portablePath === '' ||
        portablePath.includes('\\') ||
        isAbsolute(portablePath)
      ) {
        throw new FreezeError(`Artefacto fuera del paquete: ${path}.`);
      }
      return Object.freeze({ path: portablePath, hash: sha256(bytes), bytes: bytes.length });
    }),
  );
}

export function contentPackageHash(artifacts: readonly FrozenArtifact[]): string {
  if (artifacts.length === 0) throw new FreezeError('No se congela un paquete sin artefactos.');
  const paths = artifacts.map((artifact) => artifact.path);
  if (new Set(paths).size !== paths.length) throw new FreezeError('El inventario repite rutas.');
  if (new Set(paths.map((path) => path.toLocaleLowerCase('en-US'))).size !== paths.length) {
    throw new FreezeError('El inventario contiene rutas que colisionan en sistemas sin distinción de mayúsculas.');
  }
  for (const artifact of artifacts) {
    if (
      artifact.path.trim() === '' ||
      artifact.path.includes('\\') ||
      isAbsolute(artifact.path) ||
      artifact.path.split('/').includes('..') ||
      !SHA256.test(artifact.hash) ||
      !Number.isSafeInteger(artifact.bytes) ||
      artifact.bytes < 0
    ) {
      throw new FreezeError(`Artefacto inválido: ${artifact.path}.`);
    }
  }
  return sha256(
    [...artifacts]
      .sort((left, right) => comparePortablePaths(left.path, right.path))
      .map((artifact) => `${artifact.path}\0${artifact.hash}\0${artifact.bytes}`)
      .join('\n'),
  );
}

function materialPathsForRule(
  artifacts: readonly FrozenArtifact[],
  rule: RequiredFreezeArtifactRule,
): readonly string[] {
  return artifacts
    .map((artifact) => artifact.path)
    .filter((path) => {
      if (rule.exactPath !== undefined) return path === rule.exactPath;
      if (rule.prefix === undefined || !path.startsWith(rule.prefix)) return false;
      return !path.endsWith('/README.md') && path !== `${rule.prefix}README.md`;
    });
}

export function requiredFreezeArtifactGaps(
  artifacts: readonly FrozenArtifact[],
): readonly string[] {
  return Object.freeze(
    REQUIRED_FREEZE_ARTIFACT_RULES.filter(
      (rule) => materialPathsForRule(artifacts, rule).length === 0,
    ).map((rule) => rule.ruleId),
  );
}

function assertRequiredFreezeArtifacts(rootPath: string, artifacts: readonly FrozenArtifact[]): void {
  const gaps = requiredFreezeArtifactGaps(artifacts);
  if (gaps.length > 0) {
    throw new FreezeError(`El paquete no materializa grupos obligatorios de §4.3: ${gaps.join(', ')}.`);
  }
  const root = resolve(rootPath);
  const materialPaths = new Set(
    REQUIRED_FREEZE_ARTIFACT_RULES.flatMap((rule) => materialPathsForRule(artifacts, rule)),
  );
  for (const path of materialPaths) {
    if (!['.json', '.yaml', '.yml', '.txt', '.md'].includes(extname(path).toLowerCase())) continue;
    const text = readFileSync(resolve(root, path), 'utf8');
    if (text.includes('\uFFFD') || PLACEHOLDER_TOKEN.test(text)) {
      throw new FreezeError(`El artefacto obligatorio ${path} es ilegible o contiene placeholder/TODO.`);
    }
  }
}

function assertExactCapabilityFlags(flags: Readonly<Record<string, boolean>>): void {
  const parsed = CapabilityFlags.safeParse(flags);
  const expected = Object.keys(CapabilityFlags.shape).sort();
  const actual = Object.keys(flags).sort();
  if (!parsed.success || canonical(actual) !== canonical(expected)) {
    throw new FreezeError('capabilityFlags no contiene exactamente los siete flags literales.');
  }
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || Object.keys(value).length === 0) {
    throw new FreezeError(`${label} debe ser un objeto material.`);
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new FreezeError(`${label}.${key} debe ser una cadena no vacía.`);
  }
  return value;
}

function requireSha256(record: Record<string, unknown>, key: string, label: string): string {
  const value = requireString(record, key, label);
  if (!SHA256.test(value)) throw new FreezeError(`${label}.${key} debe ser SHA-256.`);
  return value;
}

function sectionInputContent(input: FreezeInput, name: string): Record<string, unknown> {
  const section = input.sections[name];
  if (section === undefined) throw new FreezeError(`Falta la sección ${name}.`);
  return requireRecord(section.content, name);
}

function assertVersionMap(value: unknown, label: string): void {
  const entries = requireRecord(value, label);
  for (const [id, rawEntry] of Object.entries(entries)) {
    const entry = requireRecord(rawEntry, `${label}.${id}`);
    requireString(entry, 'version', `${label}.${id}`);
    requireSha256(entry, 'hash', `${label}.${id}`);
  }
}

function assertSectionSemantics(
  input: FreezeInput,
  expectedAudit?: Readonly<{ auditId: string; sampleSeed: string }>,
): void {
  const versions = sectionInputContent(input, 'versiones_de_modelos');
  assertVersionMap(versions.models, 'versiones_de_modelos.models');
  assertVersionMap(versions.prompts, 'versiones_de_modelos.prompts');

  const seeds = sectionInputContent(input, 'semillas');
  for (const [name, seed] of Object.entries(seeds)) {
    if (
      !(
        (typeof seed === 'string' && seed.trim() !== '') ||
        (typeof seed === 'number' && Number.isSafeInteger(seed) && seed >= 0)
      )
    ) {
      throw new FreezeError(`semillas.${name} debe ser cadena o entero no negativo.`);
    }
  }

  const results = sectionInputContent(
    input,
    'resultados_de_pruebas_y_manifiesto_de_validacion_del_nucleo_logico',
  );
  for (const field of [
    'validationManifestHash',
    'logicValidationManifestHash',
    'mapHash',
    'banksHash',
    'solutionsHash',
    'rubricsHash',
    'hintsHash',
    'verifierManifestHash',
    'complexityManifestHash',
  ]) {
    requireSha256(results, field, 'resultados_de_pruebas');
  }
  const checks = results.checks;
  if (!Array.isArray(checks) || checks.length === 0 || checks.some((check) => typeof check !== 'string' || check === '')) {
    throw new FreezeError('resultados_de_pruebas.checks debe enumerar checks ejecutados.');
  }

  const calculus = sectionInputContent(
    input,
    'authorized_calculus_version_hash_semantica_y_autoridad_de_decision_por_conjunto',
  );
  requireString(calculus, 'semanticPolicyVersion', 'calculo_autorizado');
  const authorities = requireRecord(calculus.decisionAuthorityBySet, 'calculo_autorizado.decisionAuthorityBySet');
  if (
    Object.keys(authorities).sort().join(',') !== 'A,B,C' ||
    Object.values(authorities).some((authority) => typeof authority !== 'string' || authority.trim() === '')
  ) {
    throw new FreezeError('La autoridad de decisión debe declararse exactamente para A, B y C.');
  }

  const budgets = sectionInputContent(
    input,
    'presupuestos_proof_search_timeout_y_parametros_k_coste',
  );
  requireString(budgets, 'proofSearchVersion', 'presupuestos_proof_search');
  requireSha256(budgets, 'parametersHash', 'presupuestos_proof_search');
  if (!Number.isSafeInteger(budgets.timeoutMs) || (budgets.timeoutMs as number) < 1) {
    throw new FreezeError('presupuestos_proof_search.timeoutMs debe ser entero positivo.');
  }
  if (!Number.isSafeInteger(budgets.kCost) || (budgets.kCost as number) < 0) {
    throw new FreezeError('presupuestos_proof_search.kCost debe ser entero no negativo.');
  }

  const audit = sectionInputContent(
    input,
    'politica_de_auditoria_codebook_muestreo_y_capacidad_de_deteccion',
  );
  const auditId = requireString(audit, 'auditId', 'auditoria');
  const sampleSeed = requireString(audit, 'sampleSeed', 'auditoria');
  if (
    expectedAudit !== undefined &&
    (auditId !== expectedAudit.auditId || sampleSeed !== expectedAudit.sampleSeed)
  ) {
    throw new FreezeError('La auditoría del freeze no coincide con la registrada por el linter.');
  }
  requireString(audit, 'codebookVersion', 'auditoria');
  requireSha256(audit, 'codebookHash', 'auditoria');
  requireSha256(audit, 'samplingManifestHash', 'auditoria');
  requireRecord(audit.detectionCapacity, 'auditoria.detectionCapacity');
  if (audit.passed !== true) throw new FreezeError('La auditoría previa no está dentro de umbral.');

  const licenses = sectionInputContent(
    input,
    'mapa_de_licencias_snapshots_w0_y_atribucion_en_cadena',
  );
  requireSha256(licenses, 'w0SnapshotHash', 'licencias');
  requireSha256(licenses, 'licenseMapHash', 'licencias');
  requireSha256(licenses, 'chainAttributionHash', 'licencias');
  requireRecord(licenses.perSection, 'licencias.perSection');

  const sced = sectionInputContent(input, 'plan_sced_preinscrito');
  requireString(sced, 'planVersion', 'plan_sced');
  requireSha256(sced, 'planHash', 'plan_sced');
  if (
    sced.opportunityDefinitionVersion !== SCED_OPPORTUNITY_H5_V1.version ||
    sced.kSet !== SCED_OPPORTUNITY_H5_V1.kSet ||
    sced.minValidItemsPerOpportunity !== SCED_OPPORTUNITY_H5_V1.minValidItemsPerOpportunity
  ) {
    throw new FreezeError('El plan SCED no coincide con la oportunidad congelada por T-H5-11.');
  }

  const pedagogy = sectionInputContent(input, 'hash_version_politica_pedagogica');
  requireString(pedagogy, 'policyVersion', 'politica_pedagogica');
  requireSha256(pedagogy, 'policyHash', 'politica_pedagogica');

  const eligibility = sectionInputContent(
    input,
    'reglas_de_elegibilidad_para_dominio_y_niveles_de_ayuda',
  );
  requireString(eligibility, 'policyVersion', 'elegibilidad');
  requireSha256(eligibility, 'eligibilityPolicyHash', 'elegibilidad');
  requireSha256(eligibility, 'helpLevelsHash', 'elegibilidad');
  requireSha256(eligibility, 'scaffoldingFadingPolicyHash', 'elegibilidad');
  requireSha256(eligibility, 'retrievalSpacingPolicyHash', 'elegibilidad');

  const wheelSpinning = sectionInputContent(input, 'configuracion_wheel_spinning');
  requireString(wheelSpinning, 'version', 'wheel_spinning');
  requireSha256(wheelSpinning, 'hash', 'wheel_spinning');

  const bkt = sectionInputContent(input, 'configuracion_bkt_sombra_si_se_habilita');
  if (typeof bkt.enabled !== 'boolean') throw new FreezeError('configuracion_bkt.enabled debe ser booleano.');
  if (bkt.enabled) {
    requireString(bkt, 'parametersVersion', 'configuracion_bkt');
    requireSha256(bkt, 'parametersHash', 'configuracion_bkt');
    if (bkt.hiddenFromAgent !== true || bkt.authority !== 'none') {
      throw new FreezeError('BKT habilitado debe permanecer invisible al agente y sin autoridad.');
    }
  } else {
    requireString(bkt, 'reason', 'configuracion_bkt');
  }

  const providers = sectionInputContent(
    input,
    'proveedores_modelos_y_politicas_tts_stt_vision',
  );
  const assertProvider = (name: 'stt' | 'tts' | 'vision', expectedEnabled: boolean): void => {
    const provider = requireRecord(providers[name], `proveedores.${name}`);
    if (provider.enabled !== expectedEnabled) {
      throw new FreezeError(`proveedores.${name}.enabled no coincide con capabilityFlags.`);
    }
    if (expectedEnabled) {
      requireString(provider, 'provider', `proveedores.${name}`);
      requireString(provider, 'modelId', `proveedores.${name}`);
      requireString(provider, 'bindingVersion', `proveedores.${name}`);
      requireSha256(provider, 'bindingHash', `proveedores.${name}`);
      requireSha256(provider, 'policyHash', `proveedores.${name}`);
    }
  };
  assertProvider('stt', input.capabilityFlags.voiceInput ?? false);
  assertProvider('tts', input.capabilityFlags.voiceOutput ?? false);
  assertProvider('vision', input.capabilityFlags.visualBoardInterpretation ?? false);
}

function assertFreezeInput(input: FreezeInput, lintFacts: PackageLintFacts): void {
  if (input.manifestVersion !== '1' || input.runId.trim() === '' || input.runId.length > 200) {
    throw new FreezeError('Freeze sin versión material o runId válido.');
  }
  if (Number.isNaN(Date.parse(input.createdAt)) || !input.createdAt.includes('T')) {
    throw new FreezeError('createdAt no es ISO-8601 válido.');
  }
  const calculus = input.authorizedCalculusVersion;
  if (
    calculus.artifactId.trim() === '' ||
    calculus.version.trim() === '' ||
    calculus.hash === undefined ||
    !SHA256.test(calculus.hash)
  ) {
    throw new FreezeError('authorizedCalculusVersion exige artifactId, versión y hash SHA-256.');
  }
  if (calculus.version !== lintFacts.calculus.version || calculus.hash !== lintFacts.calculus.sha256) {
    throw new FreezeError('El cálculo del freeze no coincide con el cálculo verificado por el linter.');
  }
  assertExactCapabilityFlags(input.capabilityFlags);

  const missing = EXTERNAL_SECTIONS.filter((section) => input.sections[section] === undefined);
  const allowed = new Set<string>(EXTERNAL_SECTIONS);
  const extra = Object.keys(input.sections).filter((section) => !allowed.has(section));
  if (missing.length > 0 || extra.length > 0) {
    throw new FreezeError(
      `Secciones externas inválidas; ausentes=${missing.join(', ') || 'ninguna'}; ` +
        `no autorizadas=${extra.join(', ') || 'ninguna'}.`,
    );
  }
  for (const name of EXTERNAL_SECTIONS) {
    const section = input.sections[name];
    if (section === undefined || section.version.trim() === '' || !isMaterial(section.content)) {
      throw new FreezeError(`La sección ${name} no tiene versión y contenido material.`);
    }
    const serialized = canonical(section);
    if (PLACEHOLDER_TOKEN.test(serialized)) {
      throw new FreezeError(`La sección ${name} contiene un placeholder/TODO.`);
    }
  }
  const flagsSection = input.sections.capability_flags_multimodales;
  if (flagsSection === undefined || canonical(flagsSection.content) !== canonical(input.capabilityFlags)) {
    throw new FreezeError('La sección capability_flags_multimodales no coincide con capabilityFlags.');
  }
  const calculusSection = input.sections
    .authorized_calculus_version_hash_semantica_y_autoridad_de_decision_por_conjunto;
  const calculusContent = calculusSection?.content;
  if (
    typeof calculusContent !== 'object' ||
    calculusContent === null ||
    Array.isArray(calculusContent) ||
    (calculusContent as Record<string, unknown>).authorizedCalculusVersion !== calculus.version ||
    (calculusContent as Record<string, unknown>).authorizedCalculusSha256 !== calculus.hash
  ) {
    throw new FreezeError('La sección del cálculo no coincide con la versión/hash autorizados.');
  }
  assertSectionSemantics(input, lintFacts.audit);
}

function payloadWithoutSignature(manifest: Omit<CompleteFreezeManifest, 'signature'>): string {
  return canonical(manifest);
}

function freezeExternalSections(
  input: Readonly<Record<string, FreezeSectionInput>>,
): Readonly<Record<string, unknown>> {
  return Object.freeze(
    Object.fromEntries(
      EXTERNAL_SECTIONS.map((name) => {
        const section = input[name];
        if (section === undefined) throw new FreezeError(`Sección ausente durante freeze: ${name}.`);
        const contentSha256 = sha256(canonical(section.content));
        return [
          name,
          Object.freeze({
            version: section.version,
            contentSha256,
            content: section.content,
          }),
        ];
      }),
    ),
  );
}

export function createFreezeManifest(
  rootPath: string,
  input: FreezeInput,
  lintFacts: PackageLintFacts,
  signingPrivateKeyPem: string,
  keyId: string,
): CompleteFreezeManifest {
  assertFreezeInput(input, lintFacts);
  if (signingPrivateKeyPem.trim() === '' || keyId.trim() === '' || keyId.length > 200) {
    throw new FreezeError('Falta clave privada Ed25519 o keyId; no se genera una clave de desarrollo.');
  }
  const lintReport = assertContentPackageValid(lintFacts);
  const artifacts = inventoryContentPackage(rootPath);
  assertRequiredFreezeArtifacts(rootPath, artifacts);
  let privateKey: KeyObject;
  try {
    privateKey = createPrivateKey(signingPrivateKeyPem);
  } catch {
    throw new FreezeError('La clave privada de freeze no es válida.');
  }
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new FreezeError('La firma de freeze exige Ed25519.');
  const publicKey = createPublicKey(privateKey);
  const publicDer = publicKey.export({ type: 'spki', format: 'der' });
  const publicKeySha256 = sha256(publicDer);
  const packageHash = contentPackageHash(artifacts);
  const externalSections = freezeExternalSections(input.sections);
  const sectionContentSha256 = Object.fromEntries(
    EXTERNAL_SECTIONS.map((name) => {
      const section = externalSections[name] as { readonly contentSha256: string };
      return [name, section.contentSha256];
    }),
  );
  const sections: Readonly<Record<string, unknown>> = Object.freeze({
    ...externalSections,
    hashes: Object.freeze({
      algorithm: 'sha256',
      contentPackageSha256: packageHash,
      sectionContentSha256: Object.freeze(sectionContentSha256),
    }),
    firma: Object.freeze({ keyId, algorithm: 'Ed25519', publicKeySha256 }),
    inventario_de_artefactos: Object.freeze({ formatVersion: '1', count: artifacts.length }),
    identificador_unico_de_corrida: input.runId,
  });
  const unsigned: Omit<CompleteFreezeManifest, 'signature'> = Object.freeze({
    manifestVersion: input.manifestVersion,
    runId: input.runId,
    createdAt: input.createdAt,
    contentPackageHash: packageHash,
    authorizedCalculusVersion: Object.freeze({ ...input.authorizedCalculusVersion }),
    artifacts,
    capabilityFlags: Object.freeze({ ...input.capabilityFlags }),
    sections,
    lintReport,
  });
  const signatureBytes = sign(null, Buffer.from(payloadWithoutSignature(unsigned)), privateKey);
  const manifest: CompleteFreezeManifest = Object.freeze({
    ...unsigned,
    signature: Object.freeze({
      keyId,
      algorithm: 'Ed25519',
      publicKeySha256,
      signature: signatureBytes.toString('base64'),
      signedAt: input.createdAt,
    }),
  });
  return assertFreezeManifest(manifest);
}

function sectionRecord(manifest: CompleteFreezeManifest, name: string): Record<string, unknown> {
  const value = manifest.sections[name];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new FreezeError(`La sección ${name} no tiene estructura material.`);
  }
  return value as Record<string, unknown>;
}

/** Valida forma, referencias cruzadas y hashes internos antes de usar un manifest leído de disco. */
export function assertFreezeManifest(value: unknown): CompleteFreezeManifest {
  const parsed = FreezeManifestContract.safeParse(value);
  if (!parsed.success) {
    throw new FreezeError(`freeze-manifest.json inválido: ${parsed.error.issues.map((issue) => issue.message).join('; ')}.`);
  }
  const manifest = value as CompleteFreezeManifest;
  assertExactCapabilityFlags(manifest.capabilityFlags);
  const calculus = manifest.authorizedCalculusVersion;
  if (
    Object.keys(calculus).sort().join(',') !== 'artifactId,hash,version' ||
    calculus.hash === undefined ||
    !SHA256.test(calculus.hash)
  ) {
    throw new FreezeError('La referencia firmada al cálculo no contiene exactamente id, versión y hash.');
  }
  if (
    manifest.signature.signedAt !== manifest.createdAt ||
    Buffer.from(manifest.signature.signature, 'base64').length !== 64 ||
    Buffer.from(manifest.signature.signature, 'base64').toString('base64') !== manifest.signature.signature
  ) {
    throw new FreezeError('La firma no es una firma Ed25519/base64 fechada con el freeze.');
  }
  if (
    canonical(manifest.lintReport.checksRun) !== canonical(PACKAGE_LINT_CHECK_IDS) ||
    manifest.lintReport.issues.length !== 0
  ) {
    throw new FreezeError('El informe firmado no ejecutó exactamente todos los controles del linter.');
  }
  if (contentPackageHash(manifest.artifacts) !== manifest.contentPackageHash) {
    throw new FreezeError('El hash agregado no coincide con el inventario firmado.');
  }
  const paths = manifest.artifacts.map((artifact) => artifact.path);
  if (canonical(paths) !== canonical([...paths].sort(comparePortablePaths))) {
    throw new FreezeError('El inventario firmado no está ordenado canónicamente.');
  }
  const hashes = sectionRecord(manifest, 'hashes');
  if (
    Object.keys(hashes).sort().join(',') !==
      'algorithm,contentPackageSha256,sectionContentSha256' ||
    hashes.algorithm !== 'sha256' ||
    hashes.contentPackageSha256 !== manifest.contentPackageHash
  ) {
    throw new FreezeError('La sección hashes no coincide con el paquete firmado.');
  }
  const inventory = sectionRecord(manifest, 'inventario_de_artefactos');
  if (
    Object.keys(inventory).sort().join(',') !== 'count,formatVersion' ||
    inventory.formatVersion !== '1' ||
    inventory.count !== manifest.artifacts.length
  ) {
    throw new FreezeError('La sección de inventario no coincide con los artefactos firmados.');
  }
  if (manifest.sections.identificador_unico_de_corrida !== manifest.runId) {
    throw new FreezeError('El identificador de corrida interno no coincide con runId.');
  }
  const signatureSection = sectionRecord(manifest, 'firma');
  if (
    Object.keys(signatureSection).sort().join(',') !== 'algorithm,keyId,publicKeySha256' ||
    signatureSection.keyId !== manifest.signature.keyId ||
    signatureSection.algorithm !== manifest.signature.algorithm ||
    signatureSection.publicKeySha256 !== manifest.signature.publicKeySha256
  ) {
    throw new FreezeError('La sección firma no coincide con la firma externa.');
  }
  const sectionHashes = hashes.sectionContentSha256;
  if (typeof sectionHashes !== 'object' || sectionHashes === null || Array.isArray(sectionHashes)) {
    throw new FreezeError('La tabla de hashes por sección está ausente.');
  }
  if (
    canonical(Object.keys(sectionHashes).sort()) !== canonical([...EXTERNAL_SECTIONS].sort())
  ) {
    throw new FreezeError('La tabla de hashes no cubre exactamente las secciones externas.');
  }
  for (const name of EXTERNAL_SECTIONS) {
    const section = sectionRecord(manifest, name);
    if (
      Object.keys(section).sort().join(',') !== 'content,contentSha256,version' ||
      typeof section.version !== 'string' ||
      section.version.trim() === '' ||
      !isMaterial(section.content)
    ) {
      throw new FreezeError(`La sección firmada ${name} no es material.`);
    }
    if (PLACEHOLDER_TOKEN.test(canonical(section))) {
      throw new FreezeError(`La sección firmada ${name} contiene un placeholder/TODO.`);
    }
    const actualHash = sha256(canonical(section.content));
    if (section.contentSha256 !== actualHash || (sectionHashes as Record<string, unknown>)[name] !== actualHash) {
      throw new FreezeError(`El hash interno de la sección ${name} no coincide.`);
    }
  }
  const externalInputSections = Object.fromEntries(
    EXTERNAL_SECTIONS.map((name) => {
      const section = sectionRecord(manifest, name);
      return [name, { version: section.version as string, content: section.content }];
    }),
  ) as Readonly<Record<string, FreezeSectionInput>>;
  assertSectionSemantics({
    manifestVersion: '1',
    runId: manifest.runId,
    createdAt: manifest.createdAt,
    authorizedCalculusVersion: manifest.authorizedCalculusVersion,
    capabilityFlags: manifest.capabilityFlags,
    sections: externalInputSections,
  });
  const frozenFlags = sectionRecord(manifest, 'capability_flags_multimodales');
  if (canonical(frozenFlags.content) !== canonical(manifest.capabilityFlags)) {
    throw new FreezeError('Los capabilityFlags internos no coinciden con el manifest.');
  }
  const frozenCalculus = sectionRecord(
    manifest,
    'authorized_calculus_version_hash_semantica_y_autoridad_de_decision_por_conjunto',
  ).content;
  if (
    typeof frozenCalculus !== 'object' ||
    frozenCalculus === null ||
    Array.isArray(frozenCalculus) ||
    (frozenCalculus as Record<string, unknown>).authorizedCalculusVersion !== calculus.version ||
    (frozenCalculus as Record<string, unknown>).authorizedCalculusSha256 !== calculus.hash
  ) {
    throw new FreezeError('La referencia interna al cálculo no coincide con la referencia superior.');
  }
  return manifest;
}

export function verifyFreezeSignature(manifest: CompleteFreezeManifest, publicKeyPem: string): boolean {
  try {
    assertFreezeManifest(manifest);
    const { signature, ...unsigned } = manifest;
    const publicKey = createPublicKey(publicKeyPem);
    if (publicKey.asymmetricKeyType !== 'ed25519') return false;
    const publicDer = publicKey.export({ type: 'spki', format: 'der' });
    if (sha256(publicDer) !== signature.publicKeySha256) return false;
    return verify(
      null,
      Buffer.from(payloadWithoutSignature(unsigned)),
      publicKey,
      Buffer.from(signature.signature, 'base64'),
    );
  } catch {
    return false;
  }
}

export interface FreezeDriftReport {
  readonly matches: boolean;
  readonly expectedPackageHash: string;
  readonly actualPackageHash: string | null;
  readonly changedPaths: readonly string[];
  readonly missingPaths: readonly string[];
  readonly addedPaths: readonly string[];
}

export function detectFreezeDrift(rootPath: string, value: unknown): FreezeDriftReport {
  const manifest = assertFreezeManifest(value);
  const current = inventoryContentPackage(rootPath);
  const expected = new Map(manifest.artifacts.map((artifact) => [artifact.path, artifact.hash]));
  const actual = new Map(current.map((artifact) => [artifact.path, artifact.hash]));
  const changedPaths = [...expected]
    .filter(([path, hash]) => actual.get(path) !== undefined && actual.get(path) !== hash)
    .map(([path]) => path);
  const missingPaths = [...expected.keys()].filter((path) => !actual.has(path));
  const addedPaths = [...actual.keys()].filter((path) => !expected.has(path));
  const actualPackageHash = current.length === 0 ? null : contentPackageHash(current);
  return Object.freeze({
    matches:
      changedPaths.length === 0 &&
      missingPaths.length === 0 &&
      addedPaths.length === 0 &&
      actualPackageHash === manifest.contentPackageHash,
    expectedPackageHash: manifest.contentPackageHash,
    actualPackageHash,
    changedPaths: Object.freeze(changedPaths.sort(comparePortablePaths)),
    missingPaths: Object.freeze(missingPaths.sort(comparePortablePaths)),
    addedPaths: Object.freeze(addedPaths.sort(comparePortablePaths)),
  });
}

/** Aplica permisos mínimos después de publicar el manifest. */
export function applyFrozenPermissions(rootPath: string, value: unknown): void {
  const manifest = assertFreezeManifest(value);
  const root = resolve(rootPath);
  assertRootDirectory(root);
  for (const artifact of manifest.artifacts) {
    const path = resolve(root, artifact.path);
    if (path === root || !path.startsWith(`${root}${sep}`) || !lstatSync(path).isFile()) {
      throw new FreezeError(`Ruta fuera del paquete al aplicar permisos: ${artifact.path}.`);
    }
    chmodSync(path, artifact.path.startsWith('solutions-private/') ? 0o400 : 0o444);
  }
  const freezeManifestPath = resolve(root, 'freeze-manifest.json');
  chmodSync(freezeManifestPath, 0o444);

  const directories: string[] = [];
  const visit = (directory: string): void => {
    directories.push(directory);
    for (const name of readdirSync(directory)) {
      if (name === '.git') continue;
      const path = resolve(directory, name);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new FreezeError(`Enlace simbólico después del freeze: ${path}.`);
      if (stat.isDirectory()) visit(path);
    }
  };
  visit(root);
  for (const directory of directories.sort((left, right) => right.length - left.length)) {
    chmodSync(directory, 0o555);
  }

  // En POSIX se comprueba lo aplicado. Windows solo expone el bit de solo
  // lectura mediante chmod; la separación entre servicios se provisiona en el
  // runtime Linux del paquete, no se finge una ACL equivalente aquí.
  if (process.platform !== 'win32') {
    for (const artifact of manifest.artifacts) {
      const mode = lstatSync(resolve(root, artifact.path)).mode & 0o777;
      const expected = artifact.path.startsWith('solutions-private/') ? 0o400 : 0o444;
      if (mode !== expected) throw new FreezeError(`Permisos inesperados en ${artifact.path}.`);
    }
    if ((lstatSync(freezeManifestPath).mode & 0o777) !== 0o444) {
      throw new FreezeError('freeze-manifest.json no quedó en modo 0444.');
    }
    for (const directory of directories) {
      if ((lstatSync(directory).mode & 0o777) !== 0o555) {
        throw new FreezeError(`Directorio de freeze con permisos inesperados: ${directory}.`);
      }
    }
  }
}

export interface PublishedFreeze {
  readonly manifestPath: string;
  readonly manifest: CompleteFreezeManifest;
}

/** Crea, publica atómicamente el manifest, comprueba drift y vuelve inmutable el paquete. */
export function freezeContentPackage(
  rootPath: string,
  input: FreezeInput,
  lintFacts: PackageLintFacts,
  signingPrivateKeyPem: string,
  keyId: string,
): PublishedFreeze {
  const root = resolve(rootPath);
  const manifestPath = resolve(root, 'freeze-manifest.json');
  const temporaryPath = resolve(root, '.freeze-manifest.tmp');
  if (existsSync(temporaryPath)) {
    throw new FreezeError(`Publicación bloqueada por temporal preexistente: ${temporaryPath}.`);
  }
  if (existsSync(manifestPath)) {
    try {
      const existing = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
      if (FreezeManifestContract.safeParse(existing).success) {
        throw new FreezeError('El paquete ya tiene un freeze material; no se sobrescribe una publicación inmutable.');
      }
    } catch (error) {
      if (error instanceof FreezeError) throw error;
      // Un placeholder/JSON inválido de F0 sí se reemplaza, pero jamás se acepta como evidencia.
    }
  }
  const manifest = createFreezeManifest(root, input, lintFacts, signingPrivateKeyPem, keyId);
  const beforePublish = detectFreezeDrift(root, manifest);
  if (!beforePublish.matches) throw new FreezeError('El paquete derivó mientras se preparaba el freeze.');

  let descriptor: number | undefined;
  let temporaryCreated = false;
  try {
    descriptor = openSync(temporaryPath, 'wx', 0o600);
    temporaryCreated = true;
    writeSync(descriptor, `${JSON.stringify(manifest, null, 2)}\n`, undefined, 'utf8');
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    renameSync(temporaryPath, manifestPath);
    temporaryCreated = false;
    const afterPublish = detectFreezeDrift(root, manifest);
    if (!afterPublish.matches) throw new FreezeError('Drift inmediatamente después de publicar el freeze.');
    applyFrozenPermissions(root, manifest);
    return Object.freeze({ manifestPath, manifest });
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    if (temporaryCreated && existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
}
