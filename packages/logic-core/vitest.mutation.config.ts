import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Configuración exclusiva de `ci:logic:mutation` (StrykerJS).
 *
 * Dos diferencias con la suite normal, ambas deliberadas:
 *
 * 1. Solo corre el núcleo lógico. El proyecto `db` de la raíz levanta
 *    PostgreSQL con Testcontainers; ejecutarlo una vez por mutante sería
 *    inviable y no aporta nada al núcleo.
 * 2. Excluye `isolation.test.ts`, que **lee el código fuente** para comprobar
 *    que no hay red, reloj ni entorno. Stryker instrumenta las fuentes e
 *    inyecta su propio `process.env`, así que ese escaneo estático fallaría
 *    sobre la copia instrumentada. La propiedad se verifica en la suite normal
 *    (`ci:logic:no-net`), que es donde tiene sentido: ningún mutante del
 *    cálculo puede detectarse leyendo texto.
 *
 * `root` se fija a este paquete para que funcione igual desde la raíz del
 * monorepo (como la ejecuta Stryker) o desde aquí.
 */
const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    root: here,
    include: ['test/**/*.test.ts'],
    exclude: ['test/isolation.test.ts'],
    environment: 'node',
  },
});
