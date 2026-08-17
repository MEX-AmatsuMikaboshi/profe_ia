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
};

export default nextConfig;
