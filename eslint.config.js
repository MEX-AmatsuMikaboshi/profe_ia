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
        Buffer: 'readonly',
        __dirname: 'readonly',
        module: 'writable',
        require: 'readonly',
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
