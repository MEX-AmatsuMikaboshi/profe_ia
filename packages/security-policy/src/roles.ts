/**
 * Roles de base de datos (Plan.md T-H1-02 ← Maestro P-II §11.2,
 * `DEC-PRIVILEGE-001`).
 *
 * Reglas duras del Maestro para credenciales runtime:
 *  - no son `SUPERUSER`, owner de tablas sensibles ni `BYPASSRLS`;
 *  - no heredan ni pueden `SET ROLE` hacia roles más privilegiados;
 *  - reciben solo `GRANT` explícitos necesarios y `PUBLIC` se revoca;
 *  - **no obtienen acceso a `private_solutions` o `measurement` por confiar en RLS**.
 */

/** Los siete esquemas exactos (P-II §9.2). No se crea un octavo. */
export const SCHEMAS = [
  'identity',
  'pedagogy',
  'evidence',
  'private_solutions',
  'measurement',
  'audit',
  'operations',
] as const;
export type SchemaName = (typeof SCHEMAS)[number];

/**
 * Rol propietario/migración, separado del uso ordinario (P-II §11.2).
 *
 * Desviación D-6: `Plan.md` T-H1-02 lo nombra `pg_owner_migrations`; PostgreSQL
 * reserva el prefijo `pg_` y rechaza crear ese rol. El Maestro no fija nombre,
 * solo exige la separación.
 */
export const OWNER_ROLE = 'owner_migrations' as const;

/** Un rol runtime por servicio (Plan.md T-H1-02). */
export const SERVICE_ROLES = [
  'svc_api',
  'svc_session',
  'svc_verifier',
  'svc_authoring',
  'svc_measurement',
  'svc_background',
  'svc_audit',
] as const;
export type ServiceRole = (typeof SERVICE_ROLES)[number];

/** Roles de aplicación (P-II §11.2). Distintos de los roles de base de datos. */
export const APP_ROLES = [
  'alumno',
  'auditor',
  'responsable_tecnico',
  'responsable_de_datos',
  'investigador',
] as const;
export type AppRole = (typeof APP_ROLES)[number];

/**
 * Fronteras que ninguna concesión puede cruzar. Se expresan aquí como datos
 * para que la suite negativa (`ci:db:negative`) las verifique contra la base
 * real, no contra la intención del autor de la matriz.
 */
export const FORBIDDEN_SCHEMA_ACCESS: Readonly<Record<ServiceRole, readonly SchemaName[]>> =
  Object.freeze({
    /** I-2: la ruta de sesión y la pasarela nunca alcanzan soluciones ni sondas. */
    svc_api: ['private_solutions', 'measurement'],
    svc_session: ['private_solutions', 'measurement'],
    /** El verificador es función pura: sin acceso a datos (T-H2-15). */
    svc_verifier: [
      'identity',
      'pedagogy',
      'evidence',
      'private_solutions',
      'measurement',
      'audit',
      'operations',
    ],
    /** I-3/I-4: la autoría ocurre fuera de sesión y no toca la medición runtime. */
    svc_authoring: ['identity', 'measurement', 'audit'],
    /** La medición no necesita identidad ni auditoría cegada. */
    svc_measurement: ['identity', 'audit'],
    svc_background: ['private_solutions'],
    /** El auditor no necesita acceso a identidad real (P-II §11.2). */
    svc_audit: ['identity', 'private_solutions'],
  });
