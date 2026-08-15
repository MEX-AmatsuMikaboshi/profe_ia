-- Plan.md T-H1-05 [REQUIRED] ← Maestro P-I §14.2, P-II §11.1.
--
-- Tablas de Better Auth autoalojado, **dentro del esquema `identity`**: P-II §9.2
-- fija siete esquemas exactos y no se crea un octavo.
--
-- Prefijo `auth_` por dos razones (D-14):
--   1. Better Auth llama `account` a su tabla de credenciales, y `identity.account`
--      ya existe con otro significado: la cuenta **seudónima** del participante.
--      Sin prefijo, la biblioteca pisaría la tabla de identidad del proyecto.
--   2. Deja legible qué tablas pertenecen al contrato de la biblioteca y cuáles
--      al modelo del proyecto, que es lo que la matriz de permisos gobierna.
--
-- Identificadores entre comillas: los nombres de campo son el contrato de Better
-- Auth y van en camelCase. PostgreSQL plegaría `createdAt` a `createdat` sin
-- comillas y la biblioteca no encontraría sus columnas.
--
-- `auth_user.id` **es** el `account_id` de `identity.account`: la credencial y la
-- cuenta seudónima son la misma entidad vista desde dos lados, y la llave de
-- vinculación con la identidad real sigue viviendo aparte, en
-- `identity.identity_link`, inalcanzable desde la ruta de sesión (P-I §14.4).

-- migrate:up

CREATE TABLE identity.auth_user (
  id                 text PRIMARY KEY REFERENCES identity.account (account_id),
  "name"             text NOT NULL,
  email              text NOT NULL UNIQUE,
  "emailVerified"    boolean NOT NULL DEFAULT false,
  image              text,
  "twoFactorEnabled" boolean NOT NULL DEFAULT false,
  "createdAt"        timestamptz NOT NULL DEFAULT now(),
  "updatedAt"        timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE identity.auth_user IS
  'Credencial de Better Auth. `id` = identity.account.account_id (cuenta seudónima). '
  'El correo sirve para validación y recuperación, nunca como único autenticador (P-I §14.2).';

CREATE TABLE identity.auth_session (
  id           text PRIMARY KEY,
  "userId"     text NOT NULL REFERENCES identity.auth_user (id) ON DELETE CASCADE,
  token        text NOT NULL UNIQUE,
  "expiresAt"  timestamptz NOT NULL,
  "ipAddress"  text,
  "userAgent"  text,
  "createdAt"  timestamptz NOT NULL DEFAULT now(),
  "updatedAt"  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE identity.auth_account (
  id                      text PRIMARY KEY,
  "userId"                text NOT NULL REFERENCES identity.auth_user (id) ON DELETE CASCADE,
  "accountId"             text NOT NULL,
  "providerId"            text NOT NULL,
  "accessToken"           text,
  "refreshToken"          text,
  "idToken"               text,
  "accessTokenExpiresAt"  timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope                   text,
  "password"              text,
  "createdAt"             timestamptz NOT NULL DEFAULT now(),
  "updatedAt"             timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE identity.auth_account IS
  'Credenciales por proveedor. `password` guarda el hash de Better Auth, nunca el texto claro.';

CREATE TABLE identity.auth_verification (
  id           text PRIMARY KEY,
  identifier   text NOT NULL,
  value        text NOT NULL,
  "expiresAt"  timestamptz NOT NULL,
  "createdAt"  timestamptz NOT NULL DEFAULT now(),
  "updatedAt"  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE identity.auth_verification IS
  'Recuperación y validación de correo: canal separado del autenticador (P-II §11.1).';

CREATE TABLE identity.auth_passkey (
  id             text PRIMARY KEY,
  "userId"       text NOT NULL REFERENCES identity.auth_user (id) ON DELETE CASCADE,
  "name"         text,
  "publicKey"    text NOT NULL,
  "credentialID" text NOT NULL,
  counter        integer NOT NULL DEFAULT 0,
  "deviceType"   text NOT NULL,
  "backedUp"     boolean NOT NULL DEFAULT false,
  transports     text,
  aaguid         text,
  "createdAt"    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE identity.auth_passkey IS
  'WebAuthn. Guarda clave pública y contador, nunca biometría: el autenticador '
  'no sale del dispositivo del usuario (P-I §14.2, «sin biometría por defecto»).';

CREATE TABLE identity.auth_two_factor (
  id                        text PRIMARY KEY,
  "userId"                  text NOT NULL REFERENCES identity.auth_user (id) ON DELETE CASCADE,
  secret                    text NOT NULL,
  "backupCodes"             text NOT NULL,
  verified                  boolean NOT NULL DEFAULT false,
  "failedVerificationCount" integer NOT NULL DEFAULT 0,
  "lockedUntil"             timestamptz
);
COMMENT ON TABLE identity.auth_two_factor IS
  'TOTP. Obligatorio para roles administrativos y de auditoría (P-I §14.2, MFA).';

CREATE INDEX auth_session_user_idx ON identity.auth_session ("userId");
CREATE INDEX auth_account_user_idx ON identity.auth_account ("userId");
CREATE INDEX auth_passkey_user_idx ON identity.auth_passkey ("userId");
CREATE UNIQUE INDEX auth_passkey_credential_idx ON identity.auth_passkey ("credentialID");
CREATE INDEX auth_verification_identifier_idx ON identity.auth_verification (identifier);

-- migrate:down

DROP TABLE IF EXISTS
  identity.auth_two_factor,
  identity.auth_passkey,
  identity.auth_verification,
  identity.auth_account,
  identity.auth_session,
  identity.auth_user
CASCADE;
