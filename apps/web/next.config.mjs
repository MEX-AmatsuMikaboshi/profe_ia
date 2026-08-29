/**
 * Configuración de Next para `apps/web` (T-H6-13).
 *
 * Local-first (P-II §0.3): nada de esta app puede depender de la red en tiempo
 * de render. Por eso los tokens se consumen desde
 * `src/app/tokens.generated.css` —derivado sin el `@import` remoto del
 * vendorizado, ver `scripts/web/generate-tokens-css.mjs`— y la fuente Archivo
 * se autoaloja vía `@fontsource/archivo`.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  // El cliente no porta credenciales (P-II §11.1, regla depcruise
  // `web-sin-claves-ni-gateway`): no se expone ninguna variable de entorno.
  env: {},
  // `poweredByHeader` anuncia la pila al exterior sin dar nada a cambio.
  poweredByHeader: false,
  // El optimizador de imágenes queda declarado como apagado, no como algo que
  // se cae en runtime. Necesita `sharp`, que arrastra `@img/sharp-libvips-*`
  // bajo LGPL-3.0-or-later; la app no usa `next/image` en ningún sitio, así
  // que la dependencia se excluye del árbol (`ignoredOptionalDependencies` en
  // la raíz) en vez de registrarle una excepción de licencia.
  images: { unoptimized: true },
  // Next 16 escribe `AGENTS.md` y `CLAUDE.md` dentro de `apps/web` al arrancar.
  // Este repositorio ya tiene su `CLAUDE.md` en la raíz y es documento de
  // trabajo: no se quiere un segundo archivo generado compitiendo con él.
  agentRules: false,
  /**
   * Las rutas de Clase las sirve `apps/api`, no Next (T-H7-01).
   *
   * El cliente llama a su **propio origen** —`createHttpVerdictPort` y
   * `createHttpTurnPort` usan `baseUrl = ''`— y este reenvío es lo que lo lleva
   * al servicio de api. Hasta ahora faltaba, así que `/clase/verificacion`
   * nunca llegó a `api` desde el navegador: la ruta existía en los dos lados y
   * no había puente entre ellos.
   *
   * **Se reenvía desde el servidor de Next, no desde el navegador.**
   * `API_ORIGIN` se lee aquí, en el proceso servidor; no entra en `env: {}` y
   * por tanto no se expone al cliente, que es lo que la regla depcruise
   * `web-sin-claves-ni-gateway` protege: el cliente no habla con la pasarela ni
   * sabe dónde vive.
   */
  async rewrites() {
    const apiOrigin = process.env.API_ORIGIN ?? 'http://api:3001';
    return [{ source: '/clase/:path*', destination: `${apiOrigin}/clase/:path*` }];
  },
};

export default nextConfig;
