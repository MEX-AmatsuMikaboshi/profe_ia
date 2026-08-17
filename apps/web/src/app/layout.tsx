import type { ReactNode } from 'react';

// Fuente autoalojada. `@fontsource/archivo` entra por el lockfile, el SBOM y el
// control de drift; el `@import` a Google Fonts del CSS vendorizado se retira en
// `scripts/web/generate-tokens-css.mjs` porque una sesión local no sale a la red
// (P-II §0.3).
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/600.css';
import '@fontsource/archivo/800.css';
import './tokens.generated.css';

export const metadata = {
  title: 'Profesor IA',
  description: 'Cliente local de Profesor IA.',
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
