// Emite JSON Schema desde los contratos Zod (§3: «un mismo contrato para HTTP,
// eventos y salidas de modelo»). Salida: packages/contracts/schema/*.json
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import { EvidenceEvent, LedgerCheckpoint } from './evidence-event.js';
import { PedagogicalDecision } from './pedagogical-decision.js';
import { ProbeRequest, ProbeDelivery, ProbeOpportunityResult } from './probe.js';
import { AnchoredSegment, AnchoredOutput } from './anchored-segment.js';
import { VerificationResult } from './verification-result.js';
import { ModelBinding, ModelCapabilities, CapabilityFlags } from './model-binding.js';
import { PricingManifest, CostEvent } from './cost.js';
import { Incident } from './incident.js';
import { FreezeManifest, RunManifest, MetricsManifest, VerdictManifest } from './manifests.js';

const SCHEMAS: Record<string, z.ZodType> = {
  EvidenceEvent,
  LedgerCheckpoint,
  PedagogicalDecision,
  ProbeRequest,
  ProbeDelivery,
  ProbeOpportunityResult,
  AnchoredSegment,
  AnchoredOutput,
  VerificationResult,
  ModelBinding,
  ModelCapabilities,
  CapabilityFlags,
  PricingManifest,
  CostEvent,
  Incident,
  FreezeManifest,
  RunManifest,
  MetricsManifest,
  VerdictManifest,
};

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'schema');
mkdirSync(outDir, { recursive: true });

let count = 0;
for (const [name, schema] of Object.entries(SCHEMAS)) {
  // `unrepresentable: 'any'` deja pasar los catálogos pendientes (fail-closed
  // en runtime) sin bloquear la emisión del resto del contrato.
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  writeFileSync(join(outDir, `${name}.schema.json`), JSON.stringify(json, null, 2) + '\n', 'utf8');
  count += 1;
}

console.log(`json-schema emitido: ${count} contratos → ${outDir}`);
