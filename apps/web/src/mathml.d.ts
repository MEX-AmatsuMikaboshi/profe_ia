import type { HTMLAttributes, Key } from 'react';

/**
 * Elementos MathML para JSX (T-H8-10).
 *
 * `react-dom` **sí** renderiza MathML —resuelve el espacio de nombres al ver un
 * `<math>`, igual que hace con SVG—, pero `@types/react` 19 no declara las
 * etiquetas, así que el typecheck las rechaza aunque el runtime funcione. Esto
 * declara sólo las cinco que usa {@link ./clase/components/Formula.tsx}.
 *
 * Se declara el subconjunto usado y no MathML entero a propósito: una lista
 * corta que crece cuando hace falta deja ver qué se está emitiendo; una completa
 * copiada de la especificación admite en silencio etiquetas que nadie revisó.
 */

/**
 * `key` va explícito: al declarar `IntrinsicElements` desde una augmentación, TS
 * no une aquí el `IntrinsicAttributes` de React, y sin esto un `<mi key=…>`
 * dentro de un `map` no compila.
 */
type MathMLProps = HTMLAttributes<Element> & { readonly key?: Key | null | undefined };

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      readonly math: MathMLProps & {
        readonly xmlns?: string;
        readonly display?: 'block' | 'inline';
      };
      readonly mrow: MathMLProps;
      readonly mi: MathMLProps;
      readonly mn: MathMLProps;
      readonly mo: MathMLProps;
      readonly msub: MathMLProps;
    }
  }
}
