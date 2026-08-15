import type { SchemaName, ServiceRole } from './roles.js';

/**
 * Matriz ejecutable **servicio → esquema → tabla → operación**
 * (Maestro P-II §11.2; Plan.md T-H1-02 [CRITICAL]).
 *
 * Es un dato, no un comentario: `scripts/db/generate-grants.mjs` la traduce a
 * `GRANT` explícitos y `ci:db:negative` comprueba contra PostgreSQL real que
 * todo lo no concedido está efectivamente denegado.
 */

export type Operation = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';

export interface TableGrant {
  readonly schema: SchemaName;
  readonly table: string;
  readonly operations: readonly Operation[];
}

/** Inventario canónico de tablas por esquema. Las migraciones lo materializan. */
export const TABLES: Readonly<Record<SchemaName, readonly string[]>> = Object.freeze({
  identity: ['account', 'identity_link', 'app_role_assignment'],
  pedagogy: [
    'course',
    'kc',
    'kc_edge',
    'session_state',
    'attempt',
    'hint_use',
    'wheel_spinning_signal',
    'shadow_metric',
    'prov_source',
    'prov_fragment',
    'prov_claim',
    'prov_curricular_decision',
    'prov_artifact',
    'prov_anchor',
  ],
  evidence: ['event', 'checkpoint', 'suppressible_artifact'],
  private_solutions: ['solution', 'item_solution_link'],
  measurement: [
    'probe_round',
    'probe_opportunity',
    'probe_reserve_item',
    'probe_seed',
    'probe_consumption',
  ],
  audit: ['audit_sample', 'blinded_judgment', 'codebook_version', 'adjudication'],
  operations: [
    'job',
    'pricing_manifest',
    'pricing_entry',
    'cost_event',
    'w0_state',
    'human_load_entry',
    'canary_registry',
  ],
});

const RO = ['SELECT'] as const;
const RW = ['SELECT', 'INSERT', 'UPDATE'] as const;
const APPEND = ['INSERT'] as const;

const g = (schema: SchemaName, table: string, operations: readonly Operation[]): TableGrant => ({
  schema,
  table,
  operations,
});

const PEDAGOGY_READONLY_REFERENCE = ['course', 'kc', 'kc_edge'] as const;
const PROVENANCE = [
  'prov_source',
  'prov_fragment',
  'prov_claim',
  'prov_curricular_decision',
  'prov_artifact',
  'prov_anchor',
] as const;

/**
 * Concesiones explícitas. Lo que no aparece aquí **no se concede**.
 *
 * Notas de diseño verificadas por la suite negativa:
 *  - `svc_verifier` no recibe ninguna concesión: el verificador es una función
 *    pura sin datos ni red (T-H2-15).
 *  - `identity.identity_link` (identidad real ↔ seudónimo) no es alcanzable
 *    desde la ruta de sesión: solo `svc_background`, que atiende derechos y
 *    borrados (P-I §14.4).
 *  - Nadie recibe `UPDATE`/`DELETE` sobre `evidence.event` (I-6); además hay
 *    trigger en la base.
 *  - Nadie recibe `UPDATE`/`DELETE` sobre `operations.cost_event` ni sobre los
 *    manifiestos de tarifas: un cambio de tarifa crea un `pricing_manifest_id`
 *    nuevo, nunca reescribe costos (P-II §9.5).
 *  - `shadow_metric` se escribe pero no se lee desde la ruta de sesión: la
 *    métrica sombra no puede sesgar al agente (DEC-BKT-001).
 */
export const PERMISSION_MATRIX: Readonly<Record<ServiceRole, readonly TableGrant[]>> = Object.freeze(
  {
    svc_api: [
      g('identity', 'account', RW),
      g('identity', 'app_role_assignment', RO),
      ...PEDAGOGY_READONLY_REFERENCE.map((t) => g('pedagogy', t, RO)),
      ...PROVENANCE.map((t) => g('pedagogy', t, RO)),
      g('pedagogy', 'session_state', RW),
      g('pedagogy', 'attempt', RO),
      g('evidence', 'event', ['SELECT', 'INSERT']),
      g('evidence', 'checkpoint', RO),
      g('evidence', 'suppressible_artifact', ['SELECT', 'INSERT']),
      g('operations', 'pricing_manifest', RO),
      g('operations', 'pricing_entry', RO),
      g('operations', 'cost_event', APPEND),
      g('operations', 'job', ['SELECT', 'INSERT']),
    ],
    svc_session: [
      ...PEDAGOGY_READONLY_REFERENCE.map((t) => g('pedagogy', t, RO)),
      ...PROVENANCE.map((t) => g('pedagogy', t, RO)),
      g('pedagogy', 'session_state', RW),
      g('pedagogy', 'attempt', RW),
      g('pedagogy', 'hint_use', ['SELECT', 'INSERT']),
      g('pedagogy', 'wheel_spinning_signal', ['SELECT', 'INSERT']),
      // Escribe la métrica sombra pero no puede leerla (DEC-BKT-001).
      g('pedagogy', 'shadow_metric', APPEND),
      g('evidence', 'event', ['SELECT', 'INSERT']),
      g('evidence', 'suppressible_artifact', ['SELECT', 'INSERT']),
      g('operations', 'cost_event', APPEND),
    ],
    // El verificador no recibe ninguna concesión.
    svc_verifier: [],
    svc_authoring: [
      ...PEDAGOGY_READONLY_REFERENCE.map((t) => g('pedagogy', t, RW)),
      ...PROVENANCE.map((t) => g('pedagogy', t, RW)),
      g('private_solutions', 'solution', RW),
      g('private_solutions', 'item_solution_link', RW),
      g('evidence', 'event', APPEND),
      g('operations', 'job', RW),
      g('operations', 'w0_state', RW),
      g('operations', 'cost_event', APPEND),
      g('operations', 'pricing_manifest', RO),
      g('operations', 'pricing_entry', RO),
      g('operations', 'canary_registry', RO),
    ],
    svc_measurement: [
      g('measurement', 'probe_round', RW),
      g('measurement', 'probe_opportunity', RW),
      g('measurement', 'probe_reserve_item', RW),
      g('measurement', 'probe_seed', RW),
      g('measurement', 'probe_consumption', ['SELECT', 'INSERT']),
      // Puntúa reactivos; no es el agente de sesión (I-2 protege a la sesión).
      g('private_solutions', 'solution', RO),
      g('evidence', 'event', ['SELECT', 'INSERT']),
      g('operations', 'job', ['SELECT', 'INSERT', 'UPDATE']),
      g('operations', 'cost_event', APPEND),
    ],
    svc_background: [
      // Único servicio que resuelve identidad real: derechos, borrados, alta.
      g('identity', 'account', RW),
      g('identity', 'identity_link', ['SELECT', 'INSERT', 'UPDATE', 'DELETE']),
      g('identity', 'app_role_assignment', RW),
      ...PEDAGOGY_READONLY_REFERENCE.map((t) => g('pedagogy', t, RO)),
      ...PROVENANCE.map((t) => g('pedagogy', t, RO)),
      g('pedagogy', 'session_state', RO),
      g('pedagogy', 'attempt', RO),
      g('pedagogy', 'hint_use', RO),
      g('pedagogy', 'wheel_spinning_signal', RO),
      g('pedagogy', 'shadow_metric', RO),
      g('evidence', 'event', ['SELECT', 'INSERT']),
      g('evidence', 'checkpoint', ['SELECT', 'INSERT']),
      // Supresión de artefactos sin romper la cadena del ledger (T-H10-07).
      g('evidence', 'suppressible_artifact', ['SELECT', 'INSERT', 'UPDATE', 'DELETE']),
      g('measurement', 'probe_opportunity', RO),
      g('measurement', 'probe_round', RO),
      g('audit', 'adjudication', RO),
      g('operations', 'job', RW),
      g('operations', 'human_load_entry', ['SELECT', 'INSERT']),
      g('operations', 'pricing_manifest', ['SELECT', 'INSERT']),
      g('operations', 'pricing_entry', ['SELECT', 'INSERT']),
      g('operations', 'cost_event', ['SELECT', 'INSERT']),
      g('operations', 'canary_registry', RO),
    ],
    svc_audit: [
      g('audit', 'audit_sample', RW),
      g('audit', 'blinded_judgment', ['SELECT', 'INSERT']),
      g('audit', 'codebook_version', RW),
      g('audit', 'adjudication', ['SELECT', 'INSERT']),
      g('pedagogy', 'attempt', RO),
      g('pedagogy', 'hint_use', RO),
      ...PROVENANCE.map((t) => g('pedagogy', t, RO)),
      g('evidence', 'event', ['SELECT', 'INSERT']),
      g('evidence', 'checkpoint', RO),
      g('measurement', 'probe_opportunity', RO),
      g('measurement', 'probe_round', RO),
      g('operations', 'cost_event', RO),
    ],
  },
);

/** Tablas sobre las que **ningún** rol runtime puede escribir de forma destructiva. */
export const NO_DESTRUCTIVE_WRITE = [
  { schema: 'evidence', table: 'event', reason: 'I-6: bitácora append-only' },
  { schema: 'operations', table: 'cost_event', reason: 'P-II §9.5: los costos no se reescriben' },
  {
    schema: 'operations',
    table: 'pricing_manifest',
    reason: 'P-II §9.5: un cambio de tarifa crea un manifiesto nuevo',
  },
] as const;

/** ¿Concede la matriz esta operación a este rol? */
export function grants(
  role: ServiceRole,
  schema: SchemaName,
  table: string,
  operation: Operation,
): boolean {
  return (PERMISSION_MATRIX[role] ?? []).some(
    (entry) =>
      entry.schema === schema && entry.table === table && entry.operations.includes(operation),
  );
}
