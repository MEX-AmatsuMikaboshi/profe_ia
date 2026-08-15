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
