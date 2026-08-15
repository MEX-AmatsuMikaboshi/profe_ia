import { betterAuth } from 'better-auth';
import { twoFactor } from 'better-auth/plugins';
import { passkey } from '@better-auth/passkey';
import pg from 'pg';
import { APP_ROLES, type AppRole } from '@profesor-ia/security-policy';

/**
 * Autenticación autoalojada (Plan.md T-H1-05 [REQUIRED] ← Maestro P-I §14.2,
 * P-II §11.1).
 *
 * Las cinco exigencias literales y dónde se cumple cada una:
 *
 *  - **cuenta seudónima** → `auth_user.id` es el `account_id` de
 *    `identity.account`; la identidad real vive en `identity.identity_link`,
 *    que este servicio **no puede leer** (la matriz solo se lo concede a
 *    `svc_background`);
 *  - **passkey o contraseña robusta** → plugin `passkey` (WebAuthn) y, como
 *    alternativa, contraseña con longitud mínima;
 *  - **MFA administrativo** → plugin `twoFactor` (TOTP); qué roles lo exigen lo
 *    fija `REQUIRES_TWO_FACTOR`, derivado del catálogo de roles;
 *  - **sesiones seguras** → cookies `httpOnly`, `sameSite`, `secure`, caducidad
 *    corta y renovación por uso;
 *  - **recuperación separada** → el correo sirve para validar y recuperar, y
 *    **nunca** como autenticador único: no se habilita ningún inicio de sesión
 *    por enlace mágico ni por código de correo.
 *
 * Nada de esto se apoya en documentos oficiales, biometría ni cámara (P-I §14.2).
 * Una passkey guarda clave pública y contador; el factor biométrico, cuando el
 * usuario lo use, no sale de su dispositivo.
 */

/**
 * Roles que exigen segundo factor: «MFA para administración y auditoría»
 * (P-I §14.2). Se deriva del catálogo para que un rol nuevo entre exigiendo MFA
 * salvo decisión explícita, y no al revés.
 */
export const REQUIRES_TWO_FACTOR: Readonly<Record<AppRole, boolean>> = Object.freeze(
  Object.fromEntries(APP_ROLES.map((role) => [role, role !== 'alumno'])) as Record<AppRole, boolean>,
);

export function requiresTwoFactor(role: AppRole): boolean {
  return REQUIRES_TWO_FACTOR[role];
}

/** Longitud mínima de contraseña cuando se usa en vez de passkey. */
export const MIN_PASSWORD_LENGTH = 12;

/** Duración de sesión y ventana de renovación, en segundos. */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const SESSION_UPDATE_AGE_SECONDS = 60 * 60;

export interface AuthConfigInput {
  /** Cadena de conexión del rol `svc_api`. */
  readonly databaseUrl: string;
  /** Secreto de firma. Se inyecta en runtime (Infisical), nunca se versiona. */
  readonly secret: string;
  /** Origen público de la aplicación; entra en la validación WebAuthn. */
  readonly baseURL: string;
  /** `relying party id` de WebAuthn: el dominio, sin esquema ni puerto. */
  readonly rpID: string;
}

/**
 * Lee la configuración del entorno y **falla cerrado**. Un servicio de
 * autenticación que arranca con secretos por omisión no protege nada.
 */
export function authConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AuthConfigInput {
  const missing: string[] = [];
  const required = (name: string): string => {
    const value = env[name];
    if (!value) missing.push(name);
    return value ?? '';
  };

  const config: AuthConfigInput = {
    databaseUrl: required('DATABASE_URL'),
    secret: required('BETTER_AUTH_SECRET'),
    baseURL: required('BETTER_AUTH_URL'),
    rpID: required('WEBAUTHN_RP_ID'),
  };

  if (missing.length > 0) {
    throw new Error(
      `configuración de autenticación incompleta: falta ${missing.join(', ')}. ` +
        'No se arranca con valores por omisión (P-II §11.1).',
    );
  }
  return config;
}

/**
 * Conexión con `search_path` fijado al esquema `identity`.
 *
 * Better Auth nombra sus tablas sin esquema; en vez de calificar cada nombre
 * —lo que rompería su generador de consultas— se fija el esquema en la conexión.
 * El rol `svc_api` no tiene `USAGE` sobre ningún otro esquema de identidad, así
 * que un `search_path` mal puesto falla, no escala privilegios.
 */
export function createAuthPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({
    connectionString: databaseUrl,
    options: '-c search_path=identity',
    max: 10,
  });
}

/**
 * Superficie de la instancia de autenticación que este paquete expone hoy.
 *
 * Se declara explícitamente por dos razones. La técnica: el tipo que infiere
 * Better Auth cita paquetes del almacén virtual de pnpm y TypeScript no puede
 * nombrarlos desde aquí (`TS2742`), que es el precio del aislamiento estricto
 * de dependencias. La de diseño: los endpoints son de F7, así que exponer ya
 * toda la superficie de la biblioteca sería adelantar contrato. Cuando F7
 * necesite `auth.api`, esta interfaz se amplía a propósito.
 */
export interface AuthInstance {
  /** Manejador HTTP de las rutas de autenticación. */
  readonly handler: (request: Request) => Promise<Response>;
  /** Opciones efectivas, para inspección y pruebas de política. */
  readonly options: Readonly<Record<string, unknown>>;
}

/**
 * Instancia de Better Auth con la política del proyecto.
 *
 * Los `modelName` mapean a las tablas prefijadas de `identity` (D-14): la
 * biblioteca llama `account` a su tabla de credenciales y `identity.account` ya
 * significa otra cosa —la cuenta seudónima del participante—, así que el prefijo
 * evita que una pise a la otra.
 */
export function createAuth(config: AuthConfigInput): AuthInstance {
  const auth = betterAuth({
    appName: 'Profesor IA',
    database: createAuthPool(config.databaseUrl),
    secret: config.secret,
    baseURL: config.baseURL,

    // El correo valida y recupera. **No** se habilita inicio de sesión por
    // enlace mágico ni por código de correo: sería convertirlo en autenticador
    // único, que es justo lo que P-I §14.2 prohíbe.
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      requireEmailVerification: true,
      autoSignIn: false,
    },

    session: {
      modelName: 'auth_session',
      expiresIn: SESSION_MAX_AGE_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
      freshAge: 15 * 60,
    },

    advanced: {
      useSecureCookies: true,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
      },
    },

    user: { modelName: 'auth_user' },
    account: { modelName: 'auth_account' },
    verification: { modelName: 'auth_verification' },

    plugins: [
      passkey({
        rpID: config.rpID,
        rpName: 'Profesor IA',
        schema: { passkey: { modelName: 'auth_passkey' } },
      }),
      twoFactor({
        issuer: 'Profesor IA',
        schema: { twoFactor: { modelName: 'auth_two_factor' } },
      }),
    ],
  });

  return {
    handler: auth.handler,
    options: auth.options as unknown as Readonly<Record<string, unknown>>,
  };
}
