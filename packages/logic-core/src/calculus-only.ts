// @profesor-ia/logic-core/calculus — el cálculo congelado, **sin veredicto**.
//
// Existe para que el orquestador de sesión (T-H7-01) pueda construir el
// `AuthorizedCalculus` que `validateAnchoredOutput()` exige, sin alcanzar
// `verify()`.
//
// `model-gateway` pide el cálculo **por parámetro** a propósito: no depende de
// `logic-core` y no debe, porque arrastrarlo hasta el paquete que habla con
// proveedores acercaría el verificador a la pasarela. Pero alguien tiene que
// proveer ese dato, y hasta ahora el único que lo hacía era `tools/bench`, que
// puede importar el barrel entero porque no es `apps/`.
//
// Lo que este subpath NO reexporta es exactamente lo que importa:
//
//   - `./verify.js`      — `verify()` **es** el veredicto.
//   - `./rules.js`       — `applyRule()` es el veredicto por línea.
//   - `./semantics.js`   — `entails()` es el oráculo semántico.
//   - `./construction.js`— construye derivaciones.
//
// Por eso este subpath no debilita `sin-verificador-fuera-del-verificador`:
// quien lo importe recibe **datos congelados**, no la capacidad de emitir un
// veredicto. Es el mismo corte que `./syntax` hace para el editor del cliente,
// que además excluye esto último con todas sus letras —«el cálculo congelado y
// su hash pertenecen al servidor»—, y `apps/api` es el servidor.

export {
  AUTHORIZED_CALCULUS_VERSION,
  CONNECTIVE_ALIASES,
  FORBIDDEN_RULES_EXAMPLES,
  REJECTED_CONNECTIVE_ALIASES,
} from './calculus.js';
