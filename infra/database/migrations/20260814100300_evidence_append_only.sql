-- Plan.md T-H1-03 [CRITICAL] ← Maestro P-I §15.4, DEC-LEDGER-001.
--
-- «append-only» operacional: los roles runtime no pueden modificar ni borrar
-- eventos históricos; una corrección es un evento nuevo que referencia al
-- original. La base **debe impedir** UPDATE/DELETE con credenciales runtime.
--
-- Aquí se impide para todos: no se usan actualizaciones destructivas para
-- corregir el historial (P-I §15.4). La supresión de contenido personal ocurre
-- en `evidence.suppressible_artifact`, fuera de la cadena.

-- migrate:up
CREATE OR REPLACE FUNCTION evidence.deny_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'evidence.event es append-only (I-6): % denegado. Una corrección es un evento nuevo enlazado por correction_of_event_id.',
    TG_OP
    USING ERRCODE = 'insufficient_privilege';
END
$$;

CREATE TRIGGER event_no_update
  BEFORE UPDATE ON evidence.event
  FOR EACH ROW EXECUTE FUNCTION evidence.deny_mutation();

CREATE TRIGGER event_no_delete
  BEFORE DELETE ON evidence.event
  FOR EACH ROW EXECUTE FUNCTION evidence.deny_mutation();

CREATE TRIGGER event_no_truncate
  BEFORE TRUNCATE ON evidence.event
  FOR EACH STATEMENT EXECUTE FUNCTION evidence.deny_mutation();

-- Cadena `previousHash → hash` y secuencia monótona por stream.
-- El primer evento de un stream declara previous_hash = 'GENESIS'.
CREATE OR REPLACE FUNCTION evidence.enforce_chain() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  last_hash text;
  last_seq  bigint;
BEGIN
  SELECT hash, sequence_number INTO last_hash, last_seq
  FROM evidence.event
  WHERE stream_id = NEW.stream_id
  ORDER BY sequence_number DESC
  LIMIT 1;

  IF last_hash IS NULL THEN
    IF NEW.sequence_number <> 0 THEN
      RAISE EXCEPTION 'el primer evento del stream % debe tener sequence_number = 0 (recibido %)',
        NEW.stream_id, NEW.sequence_number USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.previous_hash <> 'GENESIS' THEN
      RAISE EXCEPTION 'el primer evento del stream % debe declarar previous_hash = GENESIS',
        NEW.stream_id USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    IF NEW.sequence_number <> last_seq + 1 THEN
      RAISE EXCEPTION 'secuencia no monótona en stream %: esperado %, recibido %',
        NEW.stream_id, last_seq + 1, NEW.sequence_number USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.previous_hash <> last_hash THEN
      RAISE EXCEPTION 'cadena rota en stream %: previous_hash no coincide con el hash del evento anterior',
        NEW.stream_id USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER event_enforce_chain
  BEFORE INSERT ON evidence.event
  FOR EACH ROW EXECUTE FUNCTION evidence.enforce_chain();

-- Una corrección referencia al original y nunca lo sustituye.
ALTER TABLE evidence.event
  ADD CONSTRAINT correction_is_not_self CHECK (correction_of_event_id IS DISTINCT FROM event_id);

-- migrate:down
ALTER TABLE evidence.event DROP CONSTRAINT IF EXISTS correction_is_not_self;
DROP TRIGGER IF EXISTS event_enforce_chain ON evidence.event;
DROP TRIGGER IF EXISTS event_no_truncate ON evidence.event;
DROP TRIGGER IF EXISTS event_no_delete ON evidence.event;
DROP TRIGGER IF EXISTS event_no_update ON evidence.event;
DROP FUNCTION IF EXISTS evidence.enforce_chain();
DROP FUNCTION IF EXISTS evidence.deny_mutation();
