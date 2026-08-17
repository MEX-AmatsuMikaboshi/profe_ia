// @profesor-ia/logic-core/syntax — superficie **sin veredicto** del núcleo lógico.
//
// Existe para una sola cosa: que el editor Fitch de `apps/web` valide sintaxis y
// estructura contra la misma gramática congelada que el verificador, sin poder
// afirmar validez (T-H6-13; P-I §8.9: «validación sintáctica local no
// autoritativa; veredicto autoritativo en servidor»).
//
// Reescribir una segunda gramática en el cliente separaría al editor del cálculo
// y el desajuste aparecería como un rechazo del servidor que el alumno no puede
// explicarse. Reexportar el barrel entero le daría `verify()`, y entonces habría
// **dos** verificadores con implementaciones distintas: la ruta de verificación
// dejaría de ser única. Este subpath es la frontera entre las dos cosas.
//
// Lo que este archivo NO reexporta, y por qué:
//
//   - `./verify.js`      — `verify()` **es** el veredicto.
//   - `./rules.js`       — `applyRule()` decide si un paso se sigue: es el veredicto por línea.
//   - `./semantics.js`   — `entails()` es el oráculo semántico.
//   - `./construction.js`— construye derivaciones; no le corresponde al cliente.
//   - `./calculus.js`    — el cálculo congelado y su hash pertenecen al servidor.
//
// La frontera no depende de que alguien recuerde esta lista: la regla
// `web-sin-verificador-autoritativo` de `.dependency-cruiser.cjs` prohíbe a
// `apps/web` alcanzar el barrel o cualquier otro subpath, y
// `scripts/arch/verify-depcruise-catches.mjs` siembra la violación para
// comprobar que la regla **detecta**.

export * from './ast.js';
export * from './errors.js';
export * from './tokenizer.js';
export * from './parser.js';
export * from './fitch.js';
