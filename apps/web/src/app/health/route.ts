/**
 * `/health` de `apps/web` (Plan.md T-H3-01: «el servicio arranca desde cero y
 * responde a un healthcheck»).
 *
 * Vive aquí y no en un servidor aparte porque **el contenedor sirve la
 * aplicación de Next**, no un proceso mínimo al lado. Hasta `T-H6-13` el
 * entrypoint era `src/main.ts`, un servidor de `node:http` que respondía
 * `/health` y `NO_IMPLEMENTADO`; desde que la vista de Clase existe, servir
 * aquel servidor sería anunciar que no hay interfaz cuando sí la hay. El
 * `NO_IMPLEMENTADO` de D-11 lo da hoy el catch-all `[...ruta]`, que es la
 * superficie real.
 *
 * `force-dynamic` a propósito: prerenderizada, esta ruta contestaría con el
 * instante de la **compilación** y un contenedor recién muerto seguiría
 * pareciendo sano. Un healthcheck que no consulta el proceso no es un
 * healthcheck.
 */
export const dynamic = 'force-dynamic';

const SERVICE = 'web';

export function GET(): Response {
  // El arranque se deriva de `process.uptime()` y no de una constante de módulo:
  // el módulo se carga cuando llega la primera petición, no cuando arranca el
  // proceso, y esa diferencia es justo la que interesa cuando algo tardó en
  // levantar.
  const startedAt = new Date(Date.now() - process.uptime() * 1000).toISOString();
  return Response.json({ service: SERVICE, status: 'ok', startedAt });
}
