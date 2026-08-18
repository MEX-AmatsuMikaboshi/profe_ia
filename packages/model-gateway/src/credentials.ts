import type { ModelProfile } from '@profesor-ia/contracts';
import { MissingCredentialError } from './errors.js';

/**
 * Credenciales por perfil (T-H4-01 ← P-II §8.2, decisión CONGELADA).
 *
 * `SESION` y `AUTORIA` usan credenciales separadas. La separación se sostiene
 * en que una pasarela **solo recibe la credencial de su propio perfil**: no hay
 * un mapa de credenciales por el que pudiera navegar hasta la del otro. Lo que
 * no se tiene no se puede filtrar.
 */

/** Resuelve el secreto de un perfil. Fuera de pruebas lo sirve Infisical. */
export type CredentialResolver = (profile: ModelProfile) => string | undefined;

/**
 * Nombre de la variable de entorno de un candidato (T-H4-09).
 *
 * `MODEL_CREDENTIAL_<PROVEEDOR>_<PERFIL>`. Los dos ejes son necesarios y por
 * motivos distintos:
 *
 *  - **por perfil**, porque P-II §8.2 congela que `SESION` y `AUTORIA` usan
 *    credenciales separadas, y la separación solo protege si las cadenas son
 *    distintas de verdad;
 *  - **por proveedor**, porque durante BENCH-01/02 varios proveedores compiten
 *    por el *mismo* perfil, así que un solo nombre por perfil no alcanzaría.
 *
 * La consecuencia práctica: hacen falta **dos claves por proveedor**, no una.
 * En la consola del proveedor se crean sobre el mismo saldo, sin costo extra.
 */
export function credentialEnvVar(provider: string, profile: ModelProfile): string {
  return `MODEL_CREDENTIAL_${provider.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${profile}`;
}

/**
 * Resolver que lee del entorno del proceso.
 *
 * Es el **modo de arranque**, no el de destino: cuando Infisical esté
 * inicializado los servicios leen de ahí (T-H3-04). Se declara así para que
 * nadie lo tome por la solución definitiva.
 *
 * Devuelve `undefined` cuando la variable falta o está vacía, y no cae a la de
 * otro perfil ni a una genérica: quien la pida se lleva `MissingCredentialError`
 * de `ProfileCredential.resolve`, que es la frontera que ya existe.
 */
export function envCredentialResolver(
  provider: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): CredentialResolver {
  return (profile) => {
    const value = env[credentialEnvVar(provider, profile)];
    return value === undefined || value.trim() === '' ? undefined : value;
  };
}

/**
 * Credencial ya resuelta y atada a un perfil. Deliberadamente **no** expone el
 * resolver original: quien tiene una `ProfileCredential` de `SESION` no tiene
 * ningún camino hacia la de `AUTORIA`.
 */
export class ProfileCredential {
  readonly #secret: string;

  private constructor(
    readonly profile: ModelProfile,
    secret: string,
  ) {
    this.#secret = secret;
  }

  /** Falla cerrado si el perfil no tiene credencial: nunca cae a otra. */
  static resolve(profile: ModelProfile, resolver: CredentialResolver): ProfileCredential {
    const secret = resolver(profile);
    if (secret === undefined || secret === '') {
      throw new MissingCredentialError(
        `El perfil ${profile} no tiene credencial. La pasarela no usa la de otro perfil: ` +
          `autoría y sesión están separadas por contrato (P-II §8.2).`,
      );
    }
    return new ProfileCredential(profile, secret);
  }

  /**
   * Entrega el secreto solo para construir la petición saliente. Es un método y
   * no un campo para que no aparezca en `JSON.stringify` ni en un volcado de
   * logs por accidente.
   */
  reveal(): string {
    return this.#secret;
  }

  /** Un secreto nunca se imprime: ni en logs, ni en un informe, ni en un error. */
  toString(): string {
    return `[ProfileCredential ${this.profile}]`;
  }

  toJSON(): string {
    return this.toString();
  }
}
