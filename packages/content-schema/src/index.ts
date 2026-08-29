// @profesor-ia/content-schema — Contrato del paquete de contenido (P-II §5.5).

export const PACKAGE_NAME = "@profesor-ia/content-schema" as const;

/**
 * El cargador del paquete de contenido vive aquí desde `T-H7-01`.
 *
 * Nació en `tools/bench/src/corpus.ts` porque BENCH-01 fue quien primero
 * necesitó fragmentos autorizados. Pero el bucle W7 los necesita también, y
 * `apps/api` no puede depender de una herramienta de medición: P-II §3.1
 * prohíbe crear paquetes nuevos y este paquete se declara «Contrato del paquete
 * de contenido», así que es su sitio.
 *
 * **Se movió en vez de copiarse, y eso no es una preferencia de estilo.**
 * `textoPorFragmento()` decide qué texto corresponde a cada `fragmentId`; dos
 * copias que se separen darían, para el mismo id, un texto en la sesión y otro
 * en el benchmark — y entonces el gate de anclas mediría algo que la sesión no
 * hace. `tools/bench` delega aquí.
 */
export * from './corpus.js';
