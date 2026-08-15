-- Plan.md T-H1-01 [CRITICAL]. Tablas iniciales mínimas por esquema.
-- Los nombres y columnas siguen los contratos de `@profesor-ia/contracts`
-- (transcritos del Maestro). El inventario canónico vive en
-- `packages/security-policy/src/matrix.ts` (TABLES).

-- migrate:up

-- ===== identity =====================================================
-- Separación de datos (P-I §14.4): identidad real y llave de vinculación
-- viven aparte del expediente seudonimizado.
CREATE TABLE identity.account (
  account_id            text PRIMARY KEY,
  participant_pseudo_id text NOT NULL UNIQUE,
  created_at            timestamptz NOT NULL DEFAULT now(),
  disabled_at           timestamptz
);
COMMENT ON COLUMN identity.account.participant_pseudo_id IS
  'Seudónimo de trabajo. Nunca equivale a identidad real (P-II §9.1).';

CREATE TABLE identity.identity_link (
  account_id     text PRIMARY KEY REFERENCES identity.account (account_id),
  real_identity  text NOT NULL,
  linked_at      timestamptz NOT NULL DEFAULT now(),
  blocked_at     timestamptz,
  suppressed_at  timestamptz
);
COMMENT ON TABLE identity.identity_link IS
  'Llave de vinculación. Inalcanzable desde la ruta de sesión: solo svc_background.';

CREATE TABLE identity.app_role_assignment (
  account_id text NOT NULL REFERENCES identity.account (account_id),
  app_role   text NOT NULL CHECK (app_role IN
    ('alumno', 'auditor', 'responsable_tecnico', 'responsable_de_datos', 'investigador')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, app_role)
);

-- ===== pedagogy =====================================================
CREATE TABLE pedagogy.course (
  course_id   text PRIMARY KEY,
  course_type text NOT NULL CHECK (course_type IN
    ('VALIDATED_LOGIC_COURSE', 'CUSTOM_COURSE_UNVALIDATED')),
  title       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pedagogy.kc (
  kc_id       text PRIMARY KEY,
  course_id   text NOT NULL REFERENCES pedagogy.course (course_id),
  label       text NOT NULL,
  is_foundation boolean NOT NULL DEFAULT false
);
COMMENT ON COLUMN pedagogy.kc.is_foundation IS
  'KC01/KC02/KC08 son fundamentos pre-SCED; nunca objetivo A/B/C (DEC-FOUNDATION-001).';

CREATE TABLE pedagogy.kc_edge (
  from_kc_id text NOT NULL REFERENCES pedagogy.kc (kc_id),
  to_kc_id   text NOT NULL REFERENCES pedagogy.kc (kc_id),
  edge_type  text NOT NULL CHECK (edge_type IN ('FORMAL', 'POLITICA_CONTENIDO', 'PC')),
  PRIMARY KEY (from_kc_id, to_kc_id, edge_type)
);

CREATE TABLE pedagogy.session_state (
  session_id            text PRIMARY KEY,
  run_id                text NOT NULL,
  participant_pseudo_id text NOT NULL,
  course_id             text NOT NULL REFERENCES pedagogy.course (course_id),
  state                 text NOT NULL,
  pedagogical_mode      text NOT NULL CHECK (pedagogical_mode IN ('LEARNING_MODE', 'MEASUREMENT_MODE')),
  selected_strategy     text,
  assistance_level      integer NOT NULL DEFAULT 0 CHECK (assistance_level BETWEEN 0 AND 5),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pedagogy.attempt (
  attempt_id            text PRIMARY KEY,
  session_id            text NOT NULL REFERENCES pedagogy.session_state (session_id),
  participant_pseudo_id text NOT NULL,
  kc_id                 text NOT NULL REFERENCES pedagogy.kc (kc_id),
  item_id               text NOT NULL,
  item_family_id        text NOT NULL,
  mastery_eligible      boolean NOT NULL,
  mastery_disqualifying boolean NOT NULL,
  correct               boolean,
  failure_attribution   text CHECK (failure_attribution IN
    ('PERCEPTION_ERROR', 'INTERFACE_ERROR', 'ACCESSIBILITY_ERROR', 'CONCEPTUAL_ERROR')),
  occurred_at           timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN pedagogy.attempt.mastery_disqualifying IS
  'Recalculado por código; la propuesta del generador no es autoritativa (DEC-HINT-AUTHORITY-001).';

CREATE TABLE pedagogy.hint_use (
  hint_use_id           text PRIMARY KEY,
  attempt_id            text NOT NULL REFERENCES pedagogy.attempt (attempt_id),
  hint_level            integer NOT NULL CHECK (hint_level BETWEEN 1 AND 5),
  mastery_disqualifying boolean NOT NULL,
  used_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pedagogy.wheel_spinning_signal (
  signal_id  text PRIMARY KEY,
  session_id text NOT NULL REFERENCES pedagogy.session_state (session_id),
  kc_id      text NOT NULL REFERENCES pedagogy.kc (kc_id),
  threshold_version text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pedagogy.shadow_metric (
  shadow_metric_id text PRIMARY KEY,
  session_id       text NOT NULL,
  kc_id            text NOT NULL,
  metric_name      text NOT NULL,
  value            double precision NOT NULL,
  computed_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE pedagogy.shadow_metric IS
  'Métrica sombra sin autoridad. La ruta de sesión escribe pero no lee (DEC-BKT-001).';

-- Proyección de proveniencia curricular dentro de `pedagogy` (P-II §9.2).
CREATE TABLE pedagogy.prov_source (
  source_id      text PRIMARY KEY,
  locator        text NOT NULL,
  source_version text NOT NULL,
  license        text,
  license_status text NOT NULL DEFAULT 'UNKNOWN'
);
CREATE TABLE pedagogy.prov_fragment (
  fragment_id text PRIMARY KEY,
  source_id   text NOT NULL REFERENCES pedagogy.prov_source (source_id),
  locator     text NOT NULL,
  content_hash text NOT NULL
);
CREATE TABLE pedagogy.prov_claim (
  claim_id   text PRIMARY KEY,
  claim_type text NOT NULL CHECK (claim_type IN
    ('source_assertion', 'cross_source_consensus', 'system_inference')),
  statement  text NOT NULL
);
CREATE TABLE pedagogy.prov_curricular_decision (
  curricular_decision_id text PRIMARY KEY,
  statement              text NOT NULL,
  justification          text NOT NULL
);
CREATE TABLE pedagogy.prov_artifact (
  artifact_id text PRIMARY KEY,
  kind        text NOT NULL,
  content_hash text NOT NULL
);
CREATE TABLE pedagogy.prov_anchor (
  anchor_id   text PRIMARY KEY,
  fragment_id text NOT NULL REFERENCES pedagogy.prov_fragment (fragment_id),
  claim_id    text REFERENCES pedagogy.prov_claim (claim_id),
  artifact_id text REFERENCES pedagogy.prov_artifact (artifact_id)
);

-- ===== evidence =====================================================
-- Evento mínimo literal (P-II §9.1). El append-only lo impone el trigger de
-- la migración siguiente, además de la matriz de privilegios.
CREATE TABLE evidence.event (
  event_id              text PRIMARY KEY,
  schema_version        text NOT NULL,
  stream_id             text NOT NULL,
  sequence_number       bigint NOT NULL CHECK (sequence_number >= 0),
  correlation_id        text NOT NULL,
  caused_by_event_id    text,
  artifact_refs         text[],
  trace_id              text,
  run_id                text NOT NULL,
  participant_pseudo_id text NOT NULL,
  session_id            text NOT NULL,
  event_type            text NOT NULL,
  payload               jsonb NOT NULL,
  decision_maker        text NOT NULL CHECK (decision_maker IN
    ('engine', 'verifier', 'model', 'human', 'system')),
  autonomy_status       text NOT NULL CHECK (autonomy_status IN
    ('autonomous', 'automatic-control', 'human-exception', 'failed')),
  versions              jsonb NOT NULL,
  occurred_at           timestamptz NOT NULL,
  occurred_at_server    timestamptz NOT NULL DEFAULT now(),
  correction_of_event_id text REFERENCES evidence.event (event_id),
  previous_hash         text NOT NULL,
  hash                  text NOT NULL,
  validity              text NOT NULL CHECK (validity IN ('valid', 'invalid', 'deviation')),
  CONSTRAINT event_stream_sequence_unique UNIQUE (stream_id, sequence_number),
  CONSTRAINT event_hash_unique UNIQUE (hash)
);
CREATE INDEX event_stream_seq_idx ON evidence.event (stream_id, sequence_number DESC);

CREATE TABLE evidence.checkpoint (
  checkpoint_id text PRIMARY KEY,
  stream_id     text NOT NULL,
  run_id        text NOT NULL,
  chain_head    text NOT NULL,
  from_sequence bigint NOT NULL,
  to_sequence   bigint NOT NULL,
  manifest_hash text NOT NULL,
  key_id        text NOT NULL,
  signature     text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE evidence.checkpoint IS
  'Checkpoint firmado. La clave privada no está disponible para session-engine ni model-gateway (P-I §15.4).';

-- Artefactos suprimibles FUERA de la cadena append-only (P-I §15.4, §14.4).
-- Se borran para ejercer derechos sin romper la verificabilidad del ledger:
-- el evento conserva la referencia y el hash.
CREATE TABLE evidence.suppressible_artifact (
  artifact_id   text PRIMARY KEY,
  kind          text NOT NULL CHECK (kind IN ('free_text', 'audio', 'image', 'capture', 'transcript')),
  content       bytea,
  content_hash  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  suppressed_at timestamptz
);

-- ===== private_solutions ============================================
CREATE TABLE private_solutions.solution (
  solution_id       text PRIMARY KEY,
  item_id           text NOT NULL,
  certificate       jsonb NOT NULL,
  complexity        jsonb,
  reverified_by_logic_core boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE private_solutions.solution IS
  'Todo certificado se re-verifica con logic-core antes de aceptarse (DEC-PROOF-001).';

CREATE TABLE private_solutions.item_solution_link (
  item_id     text NOT NULL,
  solution_id text NOT NULL REFERENCES private_solutions.solution (solution_id),
  PRIMARY KEY (item_id, solution_id)
);

-- ===== measurement ==================================================
CREATE TABLE measurement.probe_round (
  probe_round_id text PRIMARY KEY,
  run_id         text NOT NULL,
  round_index    integer NOT NULL,
  opened_at      timestamptz NOT NULL DEFAULT now(),
  closed_at      timestamptz,
  round_valid    boolean
);

CREATE TABLE measurement.probe_opportunity (
  opportunity_id      text PRIMARY KEY,
  probe_round_id      text REFERENCES measurement.probe_round (probe_round_id),
  experimental_set    text NOT NULL,
  phase               text NOT NULL CHECK (phase IN ('baseline', 'intervention', 'retention')),
  measure_kind        text NOT NULL CHECK (measure_kind IN
    ('primary_probe', 'transfer_measurement', 'retention_probe')),
  planned_items       integer NOT NULL,
  valid_scored_items  integer NOT NULL DEFAULT 0,
  correct_valid_items integer NOT NULL DEFAULT 0,
  observation         double precision,
  operational_validity text CHECK (operational_validity IN ('valid', 'invalid', 'missing')),
  reason_code         text,
  closed_at           timestamptz
);

CREATE TABLE measurement.probe_reserve_item (
  item_id          text PRIMARY KEY,
  reserve          text NOT NULL,
  experimental_set text NOT NULL,
  item_family_id   text NOT NULL,
  structural_signature text NOT NULL,
  consumed         boolean NOT NULL DEFAULT false
);
COMMENT ON TABLE measurement.probe_reserve_item IS
  'Reservas disjuntas, también por isomorfismo (P-I §7.7, DUP-01).';

CREATE TABLE measurement.probe_seed (
  seed_id    text PRIMARY KEY,
  run_id     text NOT NULL,
  purpose    text NOT NULL,
  seed_value text NOT NULL
);
COMMENT ON TABLE measurement.probe_seed IS 'Semillas invisibles para el agente (I-4).';

CREATE TABLE measurement.probe_consumption (
  consumption_id text PRIMARY KEY,
  opportunity_id text NOT NULL REFERENCES measurement.probe_opportunity (opportunity_id),
  item_id        text NOT NULL REFERENCES measurement.probe_reserve_item (item_id),
  item_ordinal   integer NOT NULL,
  consumed_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT probe_item_consumed_once UNIQUE (item_id)
);
COMMENT ON CONSTRAINT probe_item_consumed_once ON measurement.probe_consumption IS
  'Un reactivo consumido no reaparece (P-II §14.2).';

-- ===== audit ========================================================
CREATE TABLE audit.codebook_version (
  codebook_version_id text PRIMARY KEY,
  content_hash        text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit.audit_sample (
  sample_id      text PRIMARY KEY,
  stratum        text NOT NULL,
  population_n   integer NOT NULL,
  sample_n       integer NOT NULL,
  inclusion_probability double precision NOT NULL,
  seed_value     text NOT NULL,
  drawn_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit.blinded_judgment (
  judgment_id    text PRIMARY KEY,
  sample_id      text NOT NULL REFERENCES audit.audit_sample (sample_id),
  target_ref     text NOT NULL,
  codebook_version_id text NOT NULL REFERENCES audit.codebook_version (codebook_version_id),
  judgment       jsonb NOT NULL,
  locked         boolean NOT NULL DEFAULT true,
  unblinded_at   timestamptz
);
COMMENT ON COLUMN audit.blinded_judgment.locked IS
  'Juicio inicial bloqueado antes de descegar (P-I §11.4).';

CREATE TABLE audit.adjudication (
  adjudication_id text PRIMARY KEY,
  judgment_id     text NOT NULL REFERENCES audit.blinded_judgment (judgment_id),
  outcome         text NOT NULL,
  severity        text CHECK (severity IN ('critical', 'major', 'minor')),
  decided_at      timestamptz NOT NULL DEFAULT now()
);

-- ===== operations ===================================================
CREATE TABLE operations.job (
  job_id     text PRIMARY KEY,
  queue      text NOT NULL,
  state      text NOT NULL,
  payload    jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE operations.pricing_manifest (
  pricing_manifest_id text PRIMARY KEY,
  effective_from      timestamptz NOT NULL,
  source_evidence     text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE operations.pricing_manifest IS
  'Un cambio de tarifa crea un manifiesto nuevo; nunca reescribe (P-II §9.5).';

CREATE TABLE operations.pricing_entry (
  pricing_manifest_id text NOT NULL REFERENCES operations.pricing_manifest (pricing_manifest_id),
  provider   text NOT NULL,
  model_id   text NOT NULL,
  unit       text NOT NULL,
  unit_price numeric(20, 10) NOT NULL,
  currency   char(3) NOT NULL,
  PRIMARY KEY (pricing_manifest_id, provider, model_id, unit)
);

CREATE TABLE operations.cost_event (
  cost_event_id       text PRIMARY KEY,
  occurred_at         timestamptz NOT NULL DEFAULT now(),
  stage               text NOT NULL,
  operation           text,
  profile             text CHECK (profile IN ('SESION', 'AUTORIA')),
  provider            text NOT NULL,
  binding_id          text,
  pricing_manifest_id text NOT NULL REFERENCES operations.pricing_manifest (pricing_manifest_id),
  tokens_in           bigint NOT NULL DEFAULT 0,
  tokens_out          bigint NOT NULL DEFAULT 0,
  tokens_cached       bigint NOT NULL DEFAULT 0,
  audio_seconds       numeric(12, 3) NOT NULL DEFAULT 0,
  images              integer NOT NULL DEFAULT 0,
  attempts            integer NOT NULL DEFAULT 1,
  retries             integer NOT NULL DEFAULT 0,
  failures            integer NOT NULL DEFAULT 0,
  latency_local_ms    integer,
  latency_provider_ms integer,
  cost_calculated     numeric(20, 10) NOT NULL,
  cost_reported       numeric(20, 10),
  currency            char(3) NOT NULL
);

CREATE TABLE operations.w0_state (
  course_id  text PRIMARY KEY,
  state      text NOT NULL CHECK (state IN (
    'solicitud_curso', 'alcance_acotado', 'fuentes_descubiertas', 'fuentes_evaluadas',
    'fuentes_comparadas', 'licencias_clasificadas', 'cobertura_evaluada', 'propuesta_corpus',
    'corpus_autorizado', 'W1_ingesta', 'corpus_rechazado', 'W0_reinvestigacion',
    'failed_no_authorizable_corpus')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE operations.human_load_entry (
  entry_id   text PRIMARY KEY,
  category   text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at   timestamptz,
  load_class text NOT NULL CHECK (load_class IN ('FIJO', 'MARGINAL')),
  without_conventional_equivalent boolean NOT NULL DEFAULT false,
  method     text NOT NULL CHECK (method IN ('MEDIDO', 'ESTIMADO'))
);

CREATE TABLE operations.canary_registry (
  canary_id   text PRIMARY KEY,
  asset_class text NOT NULL,
  location    text NOT NULL,
  freeze_version text NOT NULL,
  detector    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE operations.canary_registry IS
  'Solo metadatos del canario (P-II §11.3). La cadena canario vive en el gestor de secretos, nunca en la base.';

-- migrate:down
DROP TABLE IF EXISTS operations.canary_registry, operations.human_load_entry, operations.w0_state,
  operations.cost_event, operations.pricing_entry, operations.pricing_manifest, operations.job CASCADE;
DROP TABLE IF EXISTS audit.adjudication, audit.blinded_judgment, audit.audit_sample,
  audit.codebook_version CASCADE;
DROP TABLE IF EXISTS measurement.probe_consumption, measurement.probe_seed,
  measurement.probe_reserve_item, measurement.probe_opportunity, measurement.probe_round CASCADE;
DROP TABLE IF EXISTS private_solutions.item_solution_link, private_solutions.solution CASCADE;
DROP TABLE IF EXISTS evidence.suppressible_artifact, evidence.checkpoint, evidence.event CASCADE;
DROP TABLE IF EXISTS pedagogy.prov_anchor, pedagogy.prov_artifact, pedagogy.prov_curricular_decision,
  pedagogy.prov_claim, pedagogy.prov_fragment, pedagogy.prov_source, pedagogy.shadow_metric,
  pedagogy.wheel_spinning_signal, pedagogy.hint_use, pedagogy.attempt, pedagogy.session_state,
  pedagogy.kc_edge, pedagogy.kc, pedagogy.course CASCADE;
DROP TABLE IF EXISTS identity.app_role_assignment, identity.identity_link, identity.account CASCADE;
