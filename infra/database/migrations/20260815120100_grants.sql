-- GENERADO por scripts/db/generate-grants.mjs — NO EDITAR A MANO.
-- Fuente de verdad: packages/security-policy/src/matrix.ts (Plan.md T-H1-02).
-- Regenerar: pnpm run db:grants
--
-- Lo que no aparece como GRANT explícito queda denegado. `ci:db:negative`
-- comprueba ambas mitades contra PostgreSQL real.

-- migrate:up

-- Punto de partida: ningún rol runtime tiene nada.
REVOKE ALL ON ALL TABLES IN SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_api;
REVOKE ALL ON SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_api;
REVOKE ALL ON ALL TABLES IN SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_session;
REVOKE ALL ON SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_session;
REVOKE ALL ON ALL TABLES IN SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_verifier;
REVOKE ALL ON SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_verifier;
REVOKE ALL ON ALL TABLES IN SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_authoring;
REVOKE ALL ON SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_authoring;
REVOKE ALL ON ALL TABLES IN SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_measurement;
REVOKE ALL ON SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_measurement;
REVOKE ALL ON ALL TABLES IN SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_background;
REVOKE ALL ON SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_background;
REVOKE ALL ON ALL TABLES IN SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_audit;
REVOKE ALL ON SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_audit;

-- ===== svc_api =====
GRANT USAGE ON SCHEMA evidence TO svc_api;
GRANT USAGE ON SCHEMA identity TO svc_api;
GRANT USAGE ON SCHEMA operations TO svc_api;
GRANT USAGE ON SCHEMA pedagogy TO svc_api;
GRANT SELECT, INSERT, UPDATE ON identity.account TO svc_api;
GRANT SELECT ON identity.app_role_assignment TO svc_api;
GRANT SELECT, INSERT, UPDATE ON identity.auth_user TO svc_api;
GRANT SELECT, INSERT, UPDATE ON identity.auth_account TO svc_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.auth_session TO svc_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.auth_verification TO svc_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.auth_passkey TO svc_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.auth_two_factor TO svc_api;
GRANT SELECT ON pedagogy.course TO svc_api;
GRANT SELECT ON pedagogy.kc TO svc_api;
GRANT SELECT ON pedagogy.kc_edge TO svc_api;
GRANT SELECT ON pedagogy.prov_source TO svc_api;
GRANT SELECT ON pedagogy.prov_fragment TO svc_api;
GRANT SELECT ON pedagogy.prov_claim TO svc_api;
GRANT SELECT ON pedagogy.prov_curricular_decision TO svc_api;
GRANT SELECT ON pedagogy.prov_artifact TO svc_api;
GRANT SELECT ON pedagogy.prov_anchor TO svc_api;
GRANT SELECT, INSERT, UPDATE ON pedagogy.session_state TO svc_api;
GRANT SELECT ON pedagogy.attempt TO svc_api;
GRANT SELECT, INSERT ON evidence.event TO svc_api;
GRANT SELECT ON evidence.checkpoint TO svc_api;
GRANT SELECT, INSERT ON evidence.suppressible_artifact TO svc_api;
GRANT SELECT ON operations.pricing_manifest TO svc_api;
GRANT SELECT ON operations.pricing_entry TO svc_api;
GRANT INSERT ON operations.cost_event TO svc_api;
GRANT SELECT, INSERT ON operations.job TO svc_api;

-- ===== svc_session =====
GRANT USAGE ON SCHEMA evidence TO svc_session;
GRANT USAGE ON SCHEMA operations TO svc_session;
GRANT USAGE ON SCHEMA pedagogy TO svc_session;
GRANT SELECT ON pedagogy.course TO svc_session;
GRANT SELECT ON pedagogy.kc TO svc_session;
GRANT SELECT ON pedagogy.kc_edge TO svc_session;
GRANT SELECT ON pedagogy.prov_source TO svc_session;
GRANT SELECT ON pedagogy.prov_fragment TO svc_session;
GRANT SELECT ON pedagogy.prov_claim TO svc_session;
GRANT SELECT ON pedagogy.prov_curricular_decision TO svc_session;
GRANT SELECT ON pedagogy.prov_artifact TO svc_session;
GRANT SELECT ON pedagogy.prov_anchor TO svc_session;
GRANT SELECT, INSERT, UPDATE ON pedagogy.session_state TO svc_session;
GRANT SELECT, INSERT, UPDATE ON pedagogy.attempt TO svc_session;
GRANT SELECT, INSERT ON pedagogy.hint_use TO svc_session;
GRANT SELECT, INSERT ON pedagogy.wheel_spinning_signal TO svc_session;
GRANT INSERT ON pedagogy.shadow_metric TO svc_session;
GRANT SELECT, INSERT ON evidence.event TO svc_session;
GRANT SELECT, INSERT ON evidence.suppressible_artifact TO svc_session;
GRANT INSERT ON operations.cost_event TO svc_session;

-- ===== svc_verifier =====
-- Sin concesiones: svc_verifier no accede a ningún dato.

-- ===== svc_authoring =====
GRANT USAGE ON SCHEMA evidence TO svc_authoring;
GRANT USAGE ON SCHEMA operations TO svc_authoring;
GRANT USAGE ON SCHEMA pedagogy TO svc_authoring;
GRANT USAGE ON SCHEMA private_solutions TO svc_authoring;
GRANT SELECT, INSERT, UPDATE ON pedagogy.course TO svc_authoring;
GRANT SELECT, INSERT, UPDATE ON pedagogy.kc TO svc_authoring;
GRANT SELECT, INSERT, UPDATE ON pedagogy.kc_edge TO svc_authoring;
GRANT SELECT, INSERT, UPDATE ON pedagogy.prov_source TO svc_authoring;
GRANT SELECT, INSERT, UPDATE ON pedagogy.prov_fragment TO svc_authoring;
GRANT SELECT, INSERT, UPDATE ON pedagogy.prov_claim TO svc_authoring;
GRANT SELECT, INSERT, UPDATE ON pedagogy.prov_curricular_decision TO svc_authoring;
GRANT SELECT, INSERT, UPDATE ON pedagogy.prov_artifact TO svc_authoring;
GRANT SELECT, INSERT, UPDATE ON pedagogy.prov_anchor TO svc_authoring;
GRANT SELECT, INSERT, UPDATE ON private_solutions.solution TO svc_authoring;
GRANT SELECT, INSERT, UPDATE ON private_solutions.item_solution_link TO svc_authoring;
GRANT INSERT ON evidence.event TO svc_authoring;
GRANT SELECT, INSERT, UPDATE ON operations.job TO svc_authoring;
GRANT SELECT, INSERT, UPDATE ON operations.w0_state TO svc_authoring;
GRANT INSERT ON operations.cost_event TO svc_authoring;
GRANT SELECT ON operations.pricing_manifest TO svc_authoring;
GRANT SELECT ON operations.pricing_entry TO svc_authoring;
GRANT SELECT ON operations.canary_registry TO svc_authoring;

-- ===== svc_measurement =====
GRANT USAGE ON SCHEMA evidence TO svc_measurement;
GRANT USAGE ON SCHEMA measurement TO svc_measurement;
GRANT USAGE ON SCHEMA operations TO svc_measurement;
GRANT USAGE ON SCHEMA private_solutions TO svc_measurement;
GRANT SELECT, INSERT, UPDATE ON measurement.probe_round TO svc_measurement;
GRANT SELECT, INSERT, UPDATE ON measurement.probe_opportunity TO svc_measurement;
GRANT SELECT, INSERT, UPDATE ON measurement.probe_reserve_item TO svc_measurement;
GRANT SELECT, INSERT, UPDATE ON measurement.probe_seed TO svc_measurement;
GRANT SELECT, INSERT ON measurement.probe_consumption TO svc_measurement;
GRANT SELECT ON private_solutions.solution TO svc_measurement;
GRANT SELECT, INSERT ON evidence.event TO svc_measurement;
GRANT SELECT, INSERT, UPDATE ON operations.job TO svc_measurement;
GRANT INSERT ON operations.cost_event TO svc_measurement;

-- ===== svc_background =====
GRANT USAGE ON SCHEMA audit TO svc_background;
GRANT USAGE ON SCHEMA evidence TO svc_background;
GRANT USAGE ON SCHEMA identity TO svc_background;
GRANT USAGE ON SCHEMA measurement TO svc_background;
GRANT USAGE ON SCHEMA operations TO svc_background;
GRANT USAGE ON SCHEMA pedagogy TO svc_background;
GRANT SELECT, INSERT, UPDATE ON identity.account TO svc_background;
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.identity_link TO svc_background;
GRANT SELECT, INSERT, UPDATE ON identity.app_role_assignment TO svc_background;
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.auth_user TO svc_background;
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.auth_account TO svc_background;
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.auth_session TO svc_background;
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.auth_verification TO svc_background;
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.auth_passkey TO svc_background;
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.auth_two_factor TO svc_background;
GRANT SELECT ON pedagogy.course TO svc_background;
GRANT SELECT ON pedagogy.kc TO svc_background;
GRANT SELECT ON pedagogy.kc_edge TO svc_background;
GRANT SELECT ON pedagogy.prov_source TO svc_background;
GRANT SELECT ON pedagogy.prov_fragment TO svc_background;
GRANT SELECT ON pedagogy.prov_claim TO svc_background;
GRANT SELECT ON pedagogy.prov_curricular_decision TO svc_background;
GRANT SELECT ON pedagogy.prov_artifact TO svc_background;
GRANT SELECT ON pedagogy.prov_anchor TO svc_background;
GRANT SELECT ON pedagogy.session_state TO svc_background;
GRANT SELECT ON pedagogy.attempt TO svc_background;
GRANT SELECT ON pedagogy.hint_use TO svc_background;
GRANT SELECT ON pedagogy.wheel_spinning_signal TO svc_background;
GRANT SELECT ON pedagogy.shadow_metric TO svc_background;
GRANT SELECT, INSERT ON evidence.event TO svc_background;
GRANT SELECT, INSERT ON evidence.checkpoint TO svc_background;
GRANT SELECT, INSERT, UPDATE, DELETE ON evidence.suppressible_artifact TO svc_background;
GRANT SELECT ON measurement.probe_opportunity TO svc_background;
GRANT SELECT ON measurement.probe_round TO svc_background;
GRANT SELECT ON audit.adjudication TO svc_background;
GRANT SELECT, INSERT, UPDATE ON operations.job TO svc_background;
GRANT SELECT, INSERT ON operations.human_load_entry TO svc_background;
GRANT SELECT, INSERT ON operations.pricing_manifest TO svc_background;
GRANT SELECT, INSERT ON operations.pricing_entry TO svc_background;
GRANT SELECT, INSERT ON operations.cost_event TO svc_background;
GRANT SELECT ON operations.canary_registry TO svc_background;

-- ===== svc_audit =====
GRANT USAGE ON SCHEMA audit TO svc_audit;
GRANT USAGE ON SCHEMA evidence TO svc_audit;
GRANT USAGE ON SCHEMA measurement TO svc_audit;
GRANT USAGE ON SCHEMA operations TO svc_audit;
GRANT USAGE ON SCHEMA pedagogy TO svc_audit;
GRANT SELECT, INSERT, UPDATE ON audit.audit_sample TO svc_audit;
GRANT SELECT, INSERT ON audit.blinded_judgment TO svc_audit;
GRANT SELECT, INSERT, UPDATE ON audit.codebook_version TO svc_audit;
GRANT SELECT, INSERT ON audit.adjudication TO svc_audit;
GRANT SELECT ON pedagogy.attempt TO svc_audit;
GRANT SELECT ON pedagogy.hint_use TO svc_audit;
GRANT SELECT ON pedagogy.prov_source TO svc_audit;
GRANT SELECT ON pedagogy.prov_fragment TO svc_audit;
GRANT SELECT ON pedagogy.prov_claim TO svc_audit;
GRANT SELECT ON pedagogy.prov_curricular_decision TO svc_audit;
GRANT SELECT ON pedagogy.prov_artifact TO svc_audit;
GRANT SELECT ON pedagogy.prov_anchor TO svc_audit;
GRANT SELECT, INSERT ON evidence.event TO svc_audit;
GRANT SELECT ON evidence.checkpoint TO svc_audit;
GRANT SELECT ON measurement.probe_opportunity TO svc_audit;
GRANT SELECT ON measurement.probe_round TO svc_audit;
GRANT SELECT ON operations.cost_event TO svc_audit;

-- Fronteras duras: la migración falla si la matriz las contradice.
DO $$
DECLARE
  offending text;
BEGIN
  SELECT string_agg(table_name, ', ') INTO offending
    FROM information_schema.table_privileges
   WHERE grantee = 'svc_api' AND table_schema = 'private_solutions';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'frontera violada: % tiene privilegios en % (%)', 'svc_api', 'private_solutions', offending;
  END IF;
  SELECT string_agg(table_name, ', ') INTO offending
    FROM information_schema.table_privileges
   WHERE grantee = 'svc_api' AND table_schema = 'measurement';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'frontera violada: % tiene privilegios en % (%)', 'svc_api', 'measurement', offending;
  END IF;
  SELECT string_agg(table_name, ', ') INTO offending
    FROM information_schema.table_privileges
   WHERE grantee = 'svc_session' AND table_schema = 'private_solutions';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'frontera violada: % tiene privilegios en % (%)', 'svc_session', 'private_solutions', offending;
  END IF;
  SELECT string_agg(table_name, ', ') INTO offending
    FROM information_schema.table_privileges
   WHERE grantee = 'svc_session' AND table_schema = 'measurement';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'frontera violada: % tiene privilegios en % (%)', 'svc_session', 'measurement', offending;
  END IF;
  SELECT string_agg(table_name, ', ') INTO offending
    FROM information_schema.table_privileges
   WHERE grantee = 'svc_verifier' AND table_schema = 'identity';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'frontera violada: % tiene privilegios en % (%)', 'svc_verifier', 'identity', offending;
  END IF;
  SELECT string_agg(table_name, ', ') INTO offending
    FROM information_schema.table_privileges
   WHERE grantee = 'svc_verifier' AND table_schema = 'pedagogy';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'frontera violada: % tiene privilegios en % (%)', 'svc_verifier', 'pedagogy', offending;
  END IF;
  SELECT string_agg(table_name, ', ') INTO offending
    FROM information_schema.table_privileges
   WHERE grantee = 'svc_verifier' AND table_schema = 'evidence';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'frontera violada: % tiene privilegios en % (%)', 'svc_verifier', 'evidence', offending;
  END IF;
  SELECT string_agg(table_name, ', ') INTO offending
    FROM information_schema.table_privileges
   WHERE grantee = 'svc_verifier' AND table_schema = 'private_solutions';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'frontera violada: % tiene privilegios en % (%)', 'svc_verifier', 'private_solutions', offending;
  END IF;
  SELECT string_agg(table_name, ', ') INTO offending
    FROM information_schema.table_privileges
   WHERE grantee = 'svc_verifier' AND table_schema = 'measurement';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'frontera violada: % tiene privilegios en % (%)', 'svc_verifier', 'measurement', offending;
  END IF;
  SELECT string_agg(table_name, ', ') INTO offending
    FROM information_schema.table_privileges
   WHERE grantee = 'svc_verifier' AND table_schema = 'audit';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'frontera violada: % tiene privilegios en % (%)', 'svc_verifier', 'audit', offending;
  END IF;
  SELECT string_agg(table_name, ', ') INTO offending
    FROM information_schema.table_privileges
   WHERE grantee = 'svc_verifier' AND table_schema = 'operations';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'frontera violada: % tiene privilegios en % (%)', 'svc_verifier', 'operations', offending;
  END IF;
  SELECT string_agg(table_name, ', ') INTO offending
    FROM information_schema.table_privileges
   WHERE grantee = 'svc_authoring' AND table_schema = 'identity';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'frontera violada: % tiene privilegios en % (%)', 'svc_authoring', 'identity', offending;
  END IF;
  SELECT string_agg(table_name, ', ') INTO offending
    FROM information_schema.table_privileges
   WHERE grantee = 'svc_authoring' AND table_schema = 'measurement';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'frontera violada: % tiene privilegios en % (%)', 'svc_authoring', 'measurement', offending;
  END IF;
  SELECT string_agg(table_name, ', ') INTO offending
    FROM information_schema.table_privileges
   WHERE grantee = 'svc_authoring' AND table_schema = 'audit';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'frontera violada: % tiene privilegios en % (%)', 'svc_authoring', 'audit', offending;
  END IF;
  SELECT string_agg(table_name, ', ') INTO offending
    FROM information_schema.table_privileges
   WHERE grantee = 'svc_measurement' AND table_schema = 'identity';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'frontera violada: % tiene privilegios en % (%)', 'svc_measurement', 'identity', offending;
  END IF;
  SELECT string_agg(table_name, ', ') INTO offending
    FROM information_schema.table_privileges
   WHERE grantee = 'svc_measurement' AND table_schema = 'audit';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'frontera violada: % tiene privilegios en % (%)', 'svc_measurement', 'audit', offending;
  END IF;
  SELECT string_agg(table_name, ', ') INTO offending
    FROM information_schema.table_privileges
   WHERE grantee = 'svc_background' AND table_schema = 'private_solutions';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'frontera violada: % tiene privilegios en % (%)', 'svc_background', 'private_solutions', offending;
  END IF;
  SELECT string_agg(table_name, ', ') INTO offending
    FROM information_schema.table_privileges
   WHERE grantee = 'svc_audit' AND table_schema = 'identity';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'frontera violada: % tiene privilegios en % (%)', 'svc_audit', 'identity', offending;
  END IF;
  SELECT string_agg(table_name, ', ') INTO offending
    FROM information_schema.table_privileges
   WHERE grantee = 'svc_audit' AND table_schema = 'private_solutions';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'frontera violada: % tiene privilegios en % (%)', 'svc_audit', 'private_solutions', offending;
  END IF;
END
$$;

-- migrate:down
REVOKE ALL ON ALL TABLES IN SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_api;
REVOKE ALL ON SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_api;
REVOKE ALL ON ALL TABLES IN SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_session;
REVOKE ALL ON SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_session;
REVOKE ALL ON ALL TABLES IN SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_verifier;
REVOKE ALL ON SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_verifier;
REVOKE ALL ON ALL TABLES IN SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_authoring;
REVOKE ALL ON SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_authoring;
REVOKE ALL ON ALL TABLES IN SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_measurement;
REVOKE ALL ON SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_measurement;
REVOKE ALL ON ALL TABLES IN SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_background;
REVOKE ALL ON SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_background;
REVOKE ALL ON ALL TABLES IN SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_audit;
REVOKE ALL ON SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM svc_audit;
