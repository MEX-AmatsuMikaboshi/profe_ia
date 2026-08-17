import { ClaseSession } from '../../../../clase/components/ClaseSession';

/**
 * Vista de Clase (T-H6-13). Es la única vista implementada de `apps/web` en F7.
 *
 * En esta fase opera una **sesión seca** con paquete sintético de desarrollo: no
 * hay corpus congelado —nadie ha corrido W0 sobre fuentes reales— y no hay
 * modelo en vivo, que es precisamente lo que F7 define. La vista lo declara en
 * pantalla (UIUX §2).
 */
export default function ClasePage() {
  return <ClaseSession />;
}
