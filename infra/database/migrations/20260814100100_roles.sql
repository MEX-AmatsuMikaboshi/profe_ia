-- Plan.md T-H1-02 [CRITICAL] ← Maestro P-II §11.2, DEC-PRIVILEGE-001.
--
-- Rol propietario/migración separado del uso ordinario. Las credenciales
-- runtime no son SUPERUSER, no son owner de tablas sensibles, no son
-- BYPASSRLS, no heredan (NOINHERIT) y no pueden escalar por SET ROLE.
--
-- Las contraseñas NO se fijan aquí: se inyectan por entorno (Infisical) o las
-- fija el arnés de pruebas. Nunca se versiona un secreto.
--
-- Desviación documentada (D-6): `Plan.md` T-H1-02 nombra este rol
-- `pg_owner_migrations`, pero PostgreSQL reserva el prefijo `pg_` y rechaza
-- `CREATE ROLE pg_...`. El Maestro (P-II §11.2) solo exige que exista «un rol
-- propietario/migración separado del uso ordinario», sin fijar su nombre, así
-- que se usa `owner_migrations`.

-- migrate:up
DO $$
DECLARE
  r text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'owner_migrations') THEN
    CREATE ROLE owner_migrations NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;

  FOREACH r IN ARRAY ARRAY[
    'svc_api', 'svc_session', 'svc_verifier', 'svc_authoring',
    'svc_measurement', 'svc_background', 'svc_audit'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format(
        'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
        r
      );
    END IF;
    -- Sin USAGE explícito, un rol runtime no ve ningún esquema.
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA identity, pedagogy, evidence, private_solutions, measurement, audit, operations FROM %I', r);
  END LOOP;
END
$$;

COMMENT ON ROLE owner_migrations IS
  'Propietario de objetos y ejecutor de migraciones. No se usa en runtime (P-II §11.2).';

-- migrate:down
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'svc_api', 'svc_session', 'svc_verifier', 'svc_authoring',
    'svc_measurement', 'svc_background', 'svc_audit', 'owner_migrations'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('DROP OWNED BY %I', r);
      EXECUTE format('DROP ROLE %I', r);
    END IF;
  END LOOP;
END
$$;
