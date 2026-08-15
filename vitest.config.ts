import { defineConfig } from 'vitest/config';

/**
 * `ci:unit` corre este proyecto. El proyecto `db` (Testcontainers con
 * PostgreSQL real, `ci:db:testcontainers`) se da de alta en F1/H1 y por eso
 * hoy no tiene pruebas: un mock no prueba permisos (Plan.md §10).
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['packages/*/test/**/*.test.ts', 'tools/*/test/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'db',
          include: ['infra/database/test/**/*.test.ts'],
          environment: 'node',
          // Levantar PostgreSQL 17 real (descarga de imagen incluida) es lento.
          testTimeout: 120_000,
          hookTimeout: 300_000,
          // Un único contenedor por archivo: el estado de la BD es compartido.
          fileParallelism: false,
        },
      },
    ],
  },
});
