import type { ReactNode } from 'react';

// Fuente autoalojada. `@fontsource/archivo` entra por el lockfile, el SBOM y el
// control de drift; el `@import` a Google Fonts del CSS vendorizado se retira en
// `scripts/web/generate-tokens-css.mjs` porque una sesión local no sale a la red
// (P-II §0.3).
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/600.css';
import '@fontsource/archivo/800.css';
import './tokens.generated.css';
// Corrección de contraste del acento cuando hace de texto (T-H8-10). Va después
// de los tokens y antes de la disposición: corrige roles del sistema de diseño,
// no la colocación de la vista.
import './a11y-contrast.css';
// Estilos propios de Excalidraw (T-H8-03). Van **antes** de la disposición de
// Clase para que las reglas de `.clase-pizarron-*` puedan colocarlo sin pelear
// por especificidad, y se importan en la raíz porque el componente entra por
// `next/dynamic` y su CSS no viajaría con el chunk.
import '@excalidraw/excalidraw/index.css';
// Disposición de la vista de Clase. No redefine tokens: sólo coloca.
import './globals-clase.css';
// Disposición de las cuatro vistas de materia (T-CC-05). Tampoco redefine tokens.
import './globals-materias.css';

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
