-- Plan.md T-H1-01 [CRITICAL] ← Maestro P-II §9.2.
-- Los siete esquemas exactos. No se crea un octavo, tampoco para proveniencia.

-- migrate:up
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS pedagogy;
CREATE SCHEMA IF NOT EXISTS evidence;
CREATE SCHEMA IF NOT EXISTS private_solutions;
CREATE SCHEMA IF NOT EXISTS measurement;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS operations;

COMMENT ON SCHEMA identity IS 'Cuentas y vínculo con identidad real (P-II §9.2).';
COMMENT ON SCHEMA pedagogy IS 'Estado, contenido público, política versionada, proyección de proveniencia.';
COMMENT ON SCHEMA evidence IS 'Eventos append-only y artefactos suprimibles referenciados.';
COMMENT ON SCHEMA private_solutions IS 'Soluciones. Inalcanzable desde la ruta de sesión (I-2).';
COMMENT ON SCHEMA measurement IS 'Sondas, semillas y consumo. Aislado de la enseñanza (I-4).';
COMMENT ON SCHEMA audit IS 'Juicios humanos cegados, codebook, adjudicación.';
COMMENT ON SCHEMA operations IS 'Jobs, estado W0/H4.5/H5, tarifas y costos, carga humana.';

-- `PUBLIC` se revoca donde corresponda (P-II §11.2). Ningún rol obtiene
-- privilegios por pertenecer a PUBLIC.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM PUBLIC;
DO $$
BEGIN
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
END
$$;

-- migrate:down
DROP SCHEMA IF EXISTS operations CASCADE;
DROP SCHEMA IF EXISTS audit CASCADE;
DROP SCHEMA IF EXISTS measurement CASCADE;
DROP SCHEMA IF EXISTS private_solutions CASCADE;
DROP SCHEMA IF EXISTS evidence CASCADE;
DROP SCHEMA IF EXISTS pedagogy CASCADE;
DROP SCHEMA IF EXISTS identity CASCADE;
