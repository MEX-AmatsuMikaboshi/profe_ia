import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      // Salida de `next build`: son cientos de bundles generados. Sin esto
      // `ci:lint` deja de terminar.
      '**/.next/**',
      '**/.turbo/**',
      '**/schema/**',
      '**/.stryker-tmp/**',
      'reports/**',
      'content/**',
      'analysis/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Globales de Node 24 (runtime autorizado, §3).
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        // Globales del runtime desde Node 18; los usa `ci:infra:otel`, que
        // habla con la api publicada desde el host.
        fetch: 'readonly',
        AbortSignal: 'readonly',
        // `Response` lo usa el route handler de `/health` de `apps/web`.
        Response: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        module: 'writable',
        require: 'readonly',
      },
    },
  },
  {
    // `scripts/a11y/` conduce un navegador: los cuerpos que se pasan a
    // `page.evaluate()` **se ejecutan en la página**, no en Node, así que
    // `document` y `getComputedStyle` son legítimos ahí y sólo ahí. Se abren por
    // ruta y no globalmente para que un `document` en un script de Node siga
    // siendo el error que es.
    files: ['scripts/a11y/**/*.mjs'],
    languageOptions: {
      globals: {
        document: 'readonly',
        getComputedStyle: 'readonly',
        // `CSS.escape`, para construir un selector con un `id` que puede traer
        // cualquier cosa dentro (T-H8-10). Concatenar el id a pelo rompería el
        // selector con un id que llevara comillas o dos puntos — y Excalidraw
        // los genera aleatorios.
        CSS: 'readonly',
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      // I-1: ninguna decisión verificable puede quedar silenciada por un catch vacío.
      'no-empty': ['error', { allowEmptyCatch: false }],
    },
  },
);
