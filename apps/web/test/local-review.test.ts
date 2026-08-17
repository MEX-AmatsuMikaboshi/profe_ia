import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { appendLine, emptyFitchDocument, updateLine } from '../src/clase/fitch-document';
import { hasLocalNotes, reviewFitchDocument } from '../src/clase/local-review';

/**
 * T-H6-13. La revisión local dice si lo escrito se **puede leer** y describe la
 * estructura. No dice si está bien: eso es el veredicto, y es del servidor.
 */

const REVIEW_SRC = fileURLToPath(new URL('../src/clase/local-review.ts', import.meta.url));

function docConLineas(lineas: readonly { formula: string; rule: string; depth?: number }[]) {
  let doc = emptyFitchDocument();
  for (const linea of lineas) doc = appendLine(doc, linea);
  return doc;
}

describe('revisión local no autoritativa (T-H6-13)', () => {
  it('no expone ningún campo que pueda leerse como veredicto', () => {
    const review = reviewFitchDocument(docConLineas([{ formula: 'A', rule: 'PR' }]));
    const prohibidos = /^(valid|invalid|correct|ok|passed|verdict|proved|goalReached)$/i;
    for (const key of Object.keys(review)) {
      expect(prohibidos.test(key), `LocalReview no puede tener el campo ${key}`).toBe(false);
    }
    expect(review.authoritative).toBe(false);
  });

  it('el módulo no importa el verificador ni por descuido', () => {
    // La regla de depcruise lo impide en el grafo; esto lo fija también en el
    // texto, que es lo que se lee al revisar el archivo.
    const source = readFileSync(REVIEW_SRC, 'utf8');
    expect(source).toContain("from '@profesor-ia/logic-core/syntax'");
    expect(source).not.toMatch(/from '@profesor-ia\/logic-core'/);
    expect(source).not.toMatch(/\bverify\s*\(/);
  });

  it('reporta la fórmula que no se puede leer, sin dejar de revisar el resto', () => {
    const review = reviewFitchDocument(
      docConLineas([
        { formula: 'A∧', rule: 'PR' },
        { formula: 'B', rule: 'PR' },
      ]),
    );
    expect(review.syntax).toHaveLength(1);
    expect(review.syntax[0]?.line).toBe(1);
    expect(review.lines).toHaveLength(2);
  });

  it('aplica la gramática congelada, incluida la ausencia de precedencia (D-8)', () => {
    const review = reviewFitchDocument(docConLineas([{ formula: 'A∧B∧C', rule: 'PR' }]));
    expect(review.syntax[0]?.code).toBe('E-SYN-PRECEDENCE');
  });

  it('sin observaciones no significa «correcta»: solo que se puede leer', () => {
    const review = reviewFitchDocument(docConLineas([{ formula: 'A', rule: 'PR' }]));
    expect(hasLocalNotes(review)).toBe(false);
    // Una derivación que el verificador rechazaría —`∧E` sin cita— tampoco
    // produce observaciones locales, y eso es correcto: no es asunto de la
    // revisión local.
    const sinCita = reviewFitchDocument(
      docConLineas([
        { formula: 'A∧B', rule: 'PR' },
        { formula: 'A', rule: '∧E' },
      ]),
    );
    expect(hasLocalNotes(sinCita)).toBe(false);
  });

  it('detecta la estructura: apertura, cierre y ruta de bloque', () => {
    const review = reviewFitchDocument(
      docConLineas([
        { formula: 'A', rule: 'PR', depth: 0 },
        { formula: 'B', rule: 'AS', depth: 1 },
        { formula: 'B', rule: 'R', depth: 1 },
        { formula: 'B→B', rule: '→I', depth: 0 },
      ]),
    );
    expect(review.structure).toEqual([]);
    expect(review.subproofs).toEqual([{ start: 2, end: 3, parentPath: [] }]);
    expect(review.lines[1]?.opensSubproof).toBe(true);
    expect(review.lines[2]?.closesSubproof).toBe(true);
    expect(review.lines[2]?.blockPath).toEqual([2]);
  });

  it('reporta PR fuera del bloque de premisas y AS fuera de la primera línea', () => {
    const review = reviewFitchDocument(
      docConLineas([
        { formula: 'A', rule: 'R', depth: 0 },
        { formula: 'B', rule: 'PR', depth: 0 },
      ]),
    );
    expect(review.structure.map((n) => n.code)).toContain('E-STRUCT-PR-POSITION');
  });

  it('emite el target de anotación estable que F10 va a señalar (§8.9.2)', () => {
    const review = reviewFitchDocument(
      docConLineas([
        { formula: 'A', rule: 'PR' },
        { formula: 'A', rule: 'R' },
      ]),
    );
    expect(review.lines.map((l) => l.annotationTarget)).toEqual(['fitch-line:1', 'fitch-line:2']);
  });

  it('marca qué líneas son citables desde el cursor', () => {
    const doc = docConLineas([
      { formula: 'A', rule: 'PR', depth: 0 },
      { formula: 'B', rule: 'AS', depth: 1 },
      { formula: 'B', rule: 'R', depth: 1 },
      { formula: 'B→B', rule: '→I', depth: 0 },
    ]);
    const desdeElFinal = reviewFitchDocument(doc, { cursorLineId: 'l4' });
    // La línea 1 es accesible; las de la subprueba cerrada, no.
    expect(desdeElFinal.lines[0]?.citableFromCursor).toBe(true);
    expect(desdeElFinal.lines[1]?.citableFromCursor).toBe(false);
    expect(desdeElFinal.lines[2]?.citableFromCursor).toBe(false);
    // La propia línea del cursor no se cita a sí misma.
    expect(desdeElFinal.lines[3]?.citableFromCursor).toBe(false);
  });

  it('sin cursor no afirma nada sobre citabilidad', () => {
    const review = reviewFitchDocument(docConLineas([{ formula: 'A', rule: 'PR' }]));
    expect(review.lines[0]?.citableFromCursor).toBeNull();
  });

  it('propaga la cita colgante como observación de referencia', () => {
    let doc = docConLineas([
      { formula: 'A∧B', rule: 'PR' },
      { formula: 'A', rule: '∧E' },
    ]);
    doc = updateLine(doc, 'l2', { refs: [{ kind: 'line', lineId: 'l99' }] });
    const review = reviewFitchDocument(doc);
    expect(review.references[0]?.code).toBe('CITA_COLGANTE');
    expect(hasLocalNotes(review)).toBe(true);
  });

  it('un documento vacío se revisa sin lanzar', () => {
    const review = reviewFitchDocument(emptyFitchDocument());
    expect(review.lines).toEqual([]);
    expect(hasLocalNotes(review)).toBe(false);
  });
});
