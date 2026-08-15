import { ModelOperation, ModelProfile } from '@profesor-ia/contracts';

/**
 * Operaciones permitidas (T-H4-01 ← P-II §8.2).
 *
 * La lista es **exacta y cerrada**: se deriva del contrato en vez de
 * transcribirse, para que no puedan divergir. Una operación fuera de esta lista
 * no existe para la pasarela.
 */
export const MODEL_OPERATIONS: readonly ModelOperation[] = Object.freeze([
  ...ModelOperation.options,
]);

export const MODEL_PROFILES: readonly ModelProfile[] = Object.freeze([
  ...ModelProfile.options,
]);

/**
 * **No hay tabla operación → perfil, y su ausencia es deliberada (D-15).**
 *
 * P-II §8.2 enumera las once operaciones y exige que autoría y sesión usen
 * «perfiles y credenciales separadas», pero ninguna autoridad tabula qué
 * operación corre bajo qué perfil. El reparto no es evidente: `create_…` y
 * `critique_authoring_candidate` son inequívocamente de autoría, pero
 * `draft_worked_example` o `draft_feedback` los puede consumir tanto la sesión
 * como el canal de autoría de W1–W5, y cablearlos aquí decidiría por cuenta
 * propia qué credencial toca cada llamada — es decir, movería una frontera de
 * seguridad con una suposición.
 *
 * Así que el reparto es **dato de configuración**: cada binding declara qué
 * operaciones sirve al registrarse (`BindingRegistration.operations`) y la
 * pasarela rechaza toda operación no declarada. Este módulo no aporta ningún
 * valor por omisión; ese es justamente el punto donde se enchufa el reparto
 * cuando F6 defina el canal de autoría.
 */
export function isModelOperation(value: string): value is ModelOperation {
  return (MODEL_OPERATIONS as readonly string[]).includes(value);
}
