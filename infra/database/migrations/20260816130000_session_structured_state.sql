-- Plan.md T-H6-01 [CRITICAL]. La proyección completa de P-I §8.2 se persiste
-- junto con su hash. No se fabrica un estado estructurado para filas antiguas.

-- migrate:up

DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pedagogy.session_state) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'T-H6-01: existen sesiones sin historia estructurada; migrarlas exige replay material';
  END IF;
END
$migration$;

ALTER TABLE pedagogy.session_state
  ADD COLUMN structured_state jsonb NOT NULL,
  ADD COLUMN projection_hash text NOT NULL;

ALTER TABLE pedagogy.session_state
  ADD CONSTRAINT session_state_primary_literal CHECK (
    state IN (
      'preparada',
      'autenticacion',
      'consentimiento_confirmado',
      'diagnostico',
      'explicacion',
      'comprobacion',
      'practica',
      'evaluacion_operativa',
      'cierre'
    )
  ),
  ADD CONSTRAINT session_state_strategy_literal CHECK (
    selected_strategy IS NULL OR selected_strategy IN (
      'direct_explanation',
      'worked_example',
      'completion_problem',
      'guided_practice',
      'independent_practice',
      'scaffolding',
      'self_explanation',
      'retrieval',
      'prerequisite_remediation',
      'near_transfer'
    )
  ),
  ADD CONSTRAINT session_state_projection_hash_sha256 CHECK (
    projection_hash ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT session_state_structured_object CHECK (
    jsonb_typeof(structured_state) = 'object'
  ),
  ADD CONSTRAINT session_state_structured_required CHECK (
    structured_state ?& ARRAY[
      'schemaVersion',
      'revision',
      'sessionId',
      'runId',
      'participantPseudoId',
      'courseId',
      'packageVersion',
      'primaryState',
      'transverseStates',
      'currentBlock',
      'timing',
      'activeKcIds',
      'operationalMastery',
      'pedagogicalMode',
      'selectedStrategy',
      'assistanceLevel',
      'masteryEligibility',
      'scaffoldingStage',
      'observedErrors',
      'assistanceByAttempt',
      'attemptMasteryEligibility',
      'nearTransfer',
      'practiceSchedule',
      'wheelSpinning',
      'consumedActivityIds',
      'pendingDoubts',
      'planChanges',
      'incidents',
      'decisionAutonomy',
      'nextSteps',
      'createdAt',
      'updatedAt'
    ]::text[]
    AND structured_state ->> 'schemaVersion' = 'session-state-v1'
    AND jsonb_typeof(structured_state -> 'revision') = 'number'
    AND (structured_state ->> 'revision') ~ '^[0-9]+$'
    AND jsonb_typeof(structured_state -> 'packageVersion') = 'object'
    AND jsonb_typeof(structured_state -> 'transverseStates') = 'array'
    AND jsonb_typeof(structured_state -> 'timing') = 'object'
    AND jsonb_typeof(structured_state -> 'activeKcIds') = 'array'
    AND jsonb_typeof(structured_state -> 'operationalMastery') = 'object'
    AND jsonb_typeof(structured_state -> 'masteryEligibility') = 'boolean'
    AND jsonb_typeof(structured_state -> 'wheelSpinning') = 'object'
    AND jsonb_typeof(structured_state -> 'decisionAutonomy') = 'array'
  ),
  ADD CONSTRAINT session_state_structured_scalar_match CHECK (
    structured_state ->> 'sessionId' = session_id
    AND structured_state ->> 'runId' = run_id
    AND structured_state ->> 'participantPseudoId' = participant_pseudo_id
    AND structured_state ->> 'courseId' = course_id
    AND structured_state ->> 'primaryState' = state
    AND structured_state ->> 'pedagogicalMode' = pedagogical_mode
    AND selected_strategy IS NOT DISTINCT FROM (structured_state ->> 'selectedStrategy')
    AND (structured_state ->> 'assistanceLevel')::integer = assistance_level
    AND (structured_state ->> 'updatedAt')::timestamptz = updated_at
  ),
  ADD CONSTRAINT session_state_bkt_shadow_absent CHECK (
    NOT (structured_state ? 'masteryProbabilityShadow')
  );

COMMENT ON COLUMN pedagogy.session_state.structured_state IS
  'Proyección completa session-state-v1, reconstruible desde eventos (T-H6-01, I-5).';
COMMENT ON COLUMN pedagogy.session_state.projection_hash IS
  'SHA-256 del JSON canónico validado por session-engine; detecta snapshot alterado.';

-- migrate:down

ALTER TABLE pedagogy.session_state
  DROP CONSTRAINT session_state_bkt_shadow_absent,
  DROP CONSTRAINT session_state_structured_scalar_match,
  DROP CONSTRAINT session_state_structured_required,
  DROP CONSTRAINT session_state_structured_object,
  DROP CONSTRAINT session_state_projection_hash_sha256,
  DROP CONSTRAINT session_state_strategy_literal,
  DROP CONSTRAINT session_state_primary_literal,
  DROP COLUMN projection_hash,
  DROP COLUMN structured_state;
