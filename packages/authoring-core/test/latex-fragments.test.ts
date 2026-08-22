import { describe, expect, it } from 'vitest';

import {
  LatexStructureError,
  locationSlug,
  sectionsFromLatex,
} from '../src/index.js';

const LIBRO = `% Comentario de preámbulo
\\chapter{First steps}
Texto del capítulo.
\\section{Validity in virtue of form}\\label{s:Validity}
Texto de la sección.
\\section{Atomic sentences}
Más texto.
\\chapter{Connectives}
\\section{Negation}
Texto con $\\ered$ y símbolos.
% \\section{Ghost section}
Resto.
`;

describe('sectionsFromLatex (T-H5-01)', () => {
  it('corta capítulos y secciones con ubicaciones estables y texto íntegro', () => {
    const fragmentos = sectionsFromLatex(LIBRO, 'libro.tex');

    expect(fragmentos.map((f) => f.location)).toEqual([
      'libro.tex#first-steps',
      'libro.tex#validity-in-virtue-of-form',
      'libro.tex#atomic-sentences',
      'libro.tex#connectives',
      'libro.tex#negation',
    ]);
    expect(fragmentos[0]?.kind).toBe('capitulo');
    expect(fragmentos[1]?.kind).toBe('seccion');
    // El fragmento abarca hasta el encabezado siguiente, sin solapes ni huecos.
    expect(fragmentos[1]?.text).toContain('Texto de la sección.');
    expect(fragmentos[1]?.text.endsWith('\\section{Atomic sentences}')).toBe(false);
    expect(fragmentos[2]?.text.startsWith('\\section{Atomic sentences}')).toBe(true);
  });

  it('ignora encabezados comentados', () => {
    const fragmentos = sectionsFromLatex(LIBRO, 'libro.tex');
    expect(fragmentos.some((f) => f.location.includes('ghost'))).toBe(false);
    expect(fragmentos[4]?.text).toContain('% \\section{Ghost section}');
  });

  it('rechaza texto antes del primer capítulo: no hay dónde anclarlo', () => {
    expect(() => sectionsFromLatex('Texto suelto.\n\\chapter{C}\nX', 'x.tex')).toThrow(
      LatexStructureError,
    );
  });

  it('rechaza un archivo sin estructura capítulo/sección', () => {
    expect(() => sectionsFromLatex('solo texto\n', 'x.tex')).toThrow(LatexStructureError);
  });

  it('rechaza ubicaciones duplicadas: un ancla que apunta a dos sitios no ancla', () => {
    const duplicado = '\\chapter{A}\n\\section{Negation}\nx\n\\section{Negation}\ny\n';
    expect(() => sectionsFromLatex(duplicado, 'x.tex')).toThrow(LatexStructureError);
  });

  it('el slug es determinista y no depende del orden', () => {
    expect(locationSlug('Working forward from $\\ered$')).toBe('working-forward-from-ered');
    expect(locationSlug('Sentences of TFL')).toBe('sentences-of-tfl');
    expect(locationSlug('Sentences of TFL')).toBe(locationSlug('Sentences of TFL'));
  });
});
