import { describe, expect, it } from 'vitest';
import { APP_ROLES } from '@profesor-ia/security-policy';
import {
  MIN_PASSWORD_LENGTH,
  REQUIRES_TWO_FACTOR,
  SESSION_MAX_AGE_SECONDS,
  authConfigFromEnv,
  createAuth,
  requiresTwoFactor,
} from '../src/auth.js';

/**
 * Política de autenticación (Plan.md T-H1-05 ← P-I §14.2, P-II §11.1).
 *
 * Lo que se prueba aquí es la **política**, no la biblioteca: que el correo no
 * sea autenticador único, que la administración exija segundo factor, que la
 * sesión caduque y que la configuración falle cerrado sin secretos. El flujo
 * WebAuthn completo necesita navegador y autenticador reales y se prueba en el
 * e2e de F7.
 */

const CONFIG = {
  databaseUrl: 'postgres://svc_api:x@localhost:5432/profesor_ia',
  secret: 'secreto-de-prueba-no-usado-en-ninguna-corrida',
  baseURL: 'http://localhost:3001',
  rpID: 'localhost',
};

describe('MFA para administración y auditoría (P-I §14.2)', () => {
  it('cada rol del catálogo tiene decisión explícita', () => {
    expect(Object.keys(REQUIRES_TWO_FACTOR).sort()).toEqual([...APP_ROLES].sort());
  });

  it('todo rol distinto de alumno exige segundo factor', () => {
    expect(requiresTwoFactor('auditor')).toBe(true);
    expect(requiresTwoFactor('responsable_tecnico')).toBe(true);
    expect(requiresTwoFactor('responsable_de_datos')).toBe(true);
    expect(requiresTwoFactor('investigador')).toBe(true);
  });

  it('el alumno no lo exige: la fricción de MFA no se le impone a quien aprende', () => {
    expect(requiresTwoFactor('alumno')).toBe(false);
  });

  it('un rol nuevo exigiría MFA salvo decisión explícita', () => {
    // La derivación es «distinto de alumno ⇒ MFA», no una lista blanca que
    // olvidaría al rol recién añadido.
    const conMfa = APP_ROLES.filter((r) => requiresTwoFactor(r));
    expect(conMfa).toHaveLength(APP_ROLES.length - 1);
  });
});

describe('el correo no es autenticador único', () => {
  const auth = createAuth(CONFIG);
  const options = auth.options as Record<string, unknown>;

  it('la contraseña, cuando se usa, es robusta y exige correo verificado', () => {
    const email = options.emailAndPassword as Record<string, unknown>;
    expect(email.enabled).toBe(true);
    expect(email.minPasswordLength).toBe(MIN_PASSWORD_LENGTH);
    expect(MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(12);
    expect(email.requireEmailVerification).toBe(true);
    // Sin alta automática: verificar el correo es un paso, no un trámite.
    expect(email.autoSignIn).toBe(false);
  });

  it('no hay inicio de sesión por enlace ni código de correo', () => {
    // Un `magicLink` o un `emailOTP` convertirían el correo en el único
    // autenticador, que es lo que P-I §14.2 prohíbe.
    const plugins = (options.plugins ?? []) as { id?: string }[];
    const ids = plugins.map((p) => p.id);
    expect(ids).not.toContain('magic-link');
    expect(ids).not.toContain('email-otp');
  });

  it('ofrece passkey y segundo factor', () => {
    const plugins = (options.plugins ?? []) as { id?: string }[];
    const ids = plugins.map((p) => p.id);
    expect(ids).toContain('passkey');
    expect(ids).toContain('two-factor');
  });
});

describe('sesiones seguras', () => {
  const options = createAuth(CONFIG).options as Record<string, unknown>;

  it('la sesión caduca y se renueva por uso', () => {
    const session = options.session as Record<string, unknown>;
    expect(session.expiresIn).toBe(SESSION_MAX_AGE_SECONDS);
    expect(SESSION_MAX_AGE_SECONDS).toBeLessThanOrEqual(24 * 60 * 60);
    expect(session.updateAge).toBeGreaterThan(0);
  });

  it('las cookies no son accesibles al script ni viajan en claro', () => {
    const advanced = options.advanced as Record<string, unknown>;
    const cookie = advanced.defaultCookieAttributes as Record<string, unknown>;
    expect(advanced.useSecureCookies).toBe(true);
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
    expect(cookie.sameSite).toBe('lax');
  });
});

describe('las tablas son las del esquema identity, con prefijo (D-14)', () => {
  const options = createAuth(CONFIG).options as Record<string, unknown>;

  it('ninguna tabla de la biblioteca pisa `identity.account`', () => {
    const account = options.account as Record<string, unknown>;
    const user = options.user as Record<string, unknown>;
    const session = options.session as Record<string, unknown>;
    expect(account.modelName).toBe('auth_account');
    expect(user.modelName).toBe('auth_user');
    expect(session.modelName).toBe('auth_session');
    // `identity.account` es la cuenta seudónima del participante, no una
    // credencial: si la biblioteca la usara, el modelo quedaría mezclado.
    expect(account.modelName).not.toBe('account');
  });
});

describe('configuración: falla cerrado', () => {
  it('sin secretos no arranca, y dice cuáles faltan', () => {
    expect(() => authConfigFromEnv({})).toThrow(/DATABASE_URL/);
    expect(() => authConfigFromEnv({})).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => authConfigFromEnv({})).toThrow(/WEBAUTHN_RP_ID/);
  });

  it('con un secreto vacío tampoco arranca: no hay valor por omisión', () => {
    expect(() =>
      authConfigFromEnv({
        DATABASE_URL: 'postgres://x',
        BETTER_AUTH_SECRET: '',
        BETTER_AUTH_URL: 'http://localhost:3001',
        WEBAUTHN_RP_ID: 'localhost',
      }),
    ).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('con todo presente devuelve la configuración', () => {
    const config = authConfigFromEnv({
      DATABASE_URL: 'postgres://x',
      BETTER_AUTH_SECRET: 's',
      BETTER_AUTH_URL: 'http://localhost:3001',
      WEBAUTHN_RP_ID: 'localhost',
    });
    expect(config.rpID).toBe('localhost');
  });
});
