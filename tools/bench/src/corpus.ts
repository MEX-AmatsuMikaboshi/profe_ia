/**
 * El cargador del paquete de contenido se movió a `@profesor-ia/content-schema`
 * en `T-H7-01`: el bucle W7 lo necesita y `apps/api` no puede depender de una
 * herramienta de medición.
 *
 * Este archivo **delega y no duplica**. Una segunda copia de
 * `textoPorFragmento()` daría, para el mismo `fragmentId`, un texto en la
 * sesión y otro aquí, y el gate de anclas pasaría a medir algo que la sesión no
 * hace.
 */
export * from '@profesor-ia/content-schema';
