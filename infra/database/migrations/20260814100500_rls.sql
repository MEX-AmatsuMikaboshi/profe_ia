-- Plan.md T-H1-06 ← Maestro P-II §11.2.
--
-- RLS es **segunda capa**, nunca la frontera única de `private_solutions` ni
-- de `measurement`: esos esquemas se protegen por privilegios (migración de
-- grants). Aquí se separan filas por participante/sesión, y las pruebas cubren
-- owner, BYPASSRLS, membresías y FORCE ROW LEVEL SECURITY.

-- migrate:up
ALTER TABLE pedagogy.session_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedagogy.session_state FORCE ROW LEVEL SECURITY;
ALTER TABLE pedagogy.attempt ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedagogy.attempt FORCE ROW LEVEL SECURITY;

-- El participante activo se declara por sesión de base de datos.
-- Sin `app.participant_pseudo_id`, la política no deja ver ninguna fila.
CREATE POLICY session_state_by_participant ON pedagogy.session_state
  USING (participant_pseudo_id = current_setting('app.participant_pseudo_id', true))
  WITH CHECK (participant_pseudo_id = current_setting('app.participant_pseudo_id', true));

CREATE POLICY attempt_by_participant ON pedagogy.attempt
  USING (participant_pseudo_id = current_setting('app.participant_pseudo_id', true))
  WITH CHECK (participant_pseudo_id = current_setting('app.participant_pseudo_id', true));

-- Los servicios que operan sobre el conjunto completo (reportes, auditoría)
-- declaran su alcance de forma explícita en vez de eludir RLS.
CREATE POLICY session_state_full_scope ON pedagogy.session_state
  FOR SELECT TO svc_background, svc_audit USING (true);
CREATE POLICY attempt_full_scope ON pedagogy.attempt
  FOR SELECT TO svc_background, svc_audit USING (true);

-- migrate:down
DROP POLICY IF EXISTS attempt_full_scope ON pedagogy.attempt;
DROP POLICY IF EXISTS session_state_full_scope ON pedagogy.session_state;
DROP POLICY IF EXISTS attempt_by_participant ON pedagogy.attempt;
DROP POLICY IF EXISTS session_state_by_participant ON pedagogy.session_state;
ALTER TABLE pedagogy.attempt NO FORCE ROW LEVEL SECURITY;
ALTER TABLE pedagogy.attempt DISABLE ROW LEVEL SECURITY;
ALTER TABLE pedagogy.session_state NO FORCE ROW LEVEL SECURITY;
ALTER TABLE pedagogy.session_state DISABLE ROW LEVEL SECURITY;
