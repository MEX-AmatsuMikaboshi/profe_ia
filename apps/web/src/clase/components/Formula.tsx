import type { ReactElement } from 'react';

import { presentFormula, type MathNode } from '../formula-mathml';

/**
 * Presentación de una fórmula (T-H8-10 ← Maestro §10.5).
 *
 * Toda la decisión vive en `presentFormula()`, que es pura y comprobable sin
 * DOM; esto sólo dibuja el árbol que aquélla devuelve. El componente no elige
 * nada, ni siquiera el caso de fallo.
 */

function renderNode(node: MathNode, key: string): ReactElement {
  switch (node.kind) {
    case 'mi':
      return <mi key={key}>{node.text}</mi>;
    case 'mn':
      return <mn key={key}>{node.text}</mn>;
    case 'mo':
      return <mo key={key}>{node.text}</mo>;
    case 'msub':
      return (
        <msub key={key}>
          {renderNode(node.base, `${key}.b`)}
          {renderNode(node.sub, `${key}.s`)}
        </msub>
      );
    case 'mrow':
      return (
        <mrow key={key}>
          {node.children.map((child, index) => renderNode(child, `${key}.${String(index)}`))}
        </mrow>
      );
  }
}

export function Formula({
  source,
  testId,
}: {
  readonly source: string;
  readonly testId: string;
}) {
  const presentation = presentFormula(source);

  if (presentation.kind === 'texto') {
    // Sin estructura no se inventa markup: se muestra lo que el alumno escribió.
    return (
      <span data-testid={testId} data-notation="texto" data-reason={presentation.reason}>
        {presentation.text}
      </span>
    );
  }

  return (
    <span data-testid={testId} data-notation="mathml">
      {/* Sin `aria-label`: la etiqueta ganaría a la estructura y volvería a dejar
          al lector de pantalla sin ella, que es justo el defecto que se corrige. */}
      <math xmlns="http://www.w3.org/1998/Math/MathML">
        {renderNode(presentation.node, 'm')}
      </math>
    </span>
  );
}
