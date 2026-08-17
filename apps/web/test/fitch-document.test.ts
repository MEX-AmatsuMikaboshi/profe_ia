import { describe, expect, it } from 'vitest';

import {
  EDITOR_MAX_DEPTH,
  FitchEditError,
  HISTORY_LIMIT,
  appendLine,
  canRedo,
  canUndo,
  closeSubproof,
  commitEdit,
  emptyFitchDocument,
  indentLine,
  initialHistory,
  insertLineAfter,
  openSubproof,
  outdentLine,
  redo,
  removeLine,
  setGoal,
  toFitchText,
  toProofInput,
  undo,
  updateLine,
} from '../src/clase/fitch-document';

/** T-H6-13 — modelo de documento del editor Fitch estructurado (P-I §8.9). */

const conAndE = () => {
  let doc = emptyFitchDocument('A');
  doc = appendLine(doc, { formula: 'A∧B', rule: 'PR', depth: 0 });
  const premisa = doc.lines[0]!;
  doc = appendLine(doc, {
    formula: 'A',
    rule: '∧E',
    depth: 0,
    refs: [{ kind: 'line', lineId: premisa.lineId }],
  });
  return doc;
};

describe('documento Fitch (T-H6-13)', () => {
  it('asigna identidades estables y deterministas', () => {
    const doc = conAndE();
    expect(doc.lines.map((l) => l.lineId)).toEqual(['l1', 'l2']);
    expect(doc.nextLineOrdinal).toBe(3);
  });

  it('exporta las citas como números 1-based', () => {
    const { proof, dangling } = toProofInput(conAndE());
    expect(dangling).toEqual([]);
    expect(proof.lines[1]?.refs).toEqual([1]);
    expect(proof.goal).toBe('A');
  });

  it('insertar delante renumera la cita sin que nadie la toque', () => {
    // Es el motivo de que las citas sean por identidad: con números guardados,
    // esta inserción dejaría la línea 2 citando la nueva premisa.
    let doc = conAndE();
    const primera = doc.lines[0]!;
    doc = insertLineAfter(doc, primera.lineId, { formula: 'C∧D', rule: 'PR', depth: 0 });
    const { proof } = toProofInput(doc);
    expect(proof.lines.map((l) => l.formula)).toEqual(['A∧B', 'C∧D', 'A']);
    expect(proof.lines[2]?.refs).toEqual([1]);
  });

  it('borrar la línea citada deja la cita colgando, y lo dice', () => {
    const doc = removeLine(conAndE(), 'l1');
    const { proof, dangling } = toProofInput(doc);
    expect(dangling).toHaveLength(1);
    expect(dangling[0]?.code).toBe('CITA_COLGANTE');
    // La cita no se «repara» sola: la derivación exportada no la lleva…
    expect(proof.lines[0]?.refs).toEqual([]);
    // …y quien exporte con `dangling` no vacío está avisado.
    expect(dangling[0]?.line).toBe(1);
  });

  it('exporta rangos de subprueba y detecta el rango invertido', () => {
    let doc = emptyFitchDocument('A→A');
    doc = appendLine(doc, { formula: 'A', rule: 'AS', depth: 1 });
    doc = appendLine(doc, {
      formula: 'A→A',
      rule: '→I',
      depth: 0,
      refs: [{ kind: 'subproof', fromLineId: 'l1', toLineId: 'l1' }],
    });
    expect(toProofInput(doc).proof.lines[1]?.refs).toEqual([[1, 1]]);

    const invertido = updateLine(doc, 'l2', {
      refs: [{ kind: 'subproof', fromLineId: 'l2', toLineId: 'l1' }],
    });
    expect(toProofInput(invertido).dangling[0]?.code).toBe('SUBPRUEBA_INVERTIDA');
  });

  it('abrir subprueba pone AS un nivel adentro y cerrarla vuelve al nivel', () => {
    let doc = appendLine(emptyFitchDocument(), { formula: 'P', rule: 'PR', depth: 0 });
    doc = openSubproof(doc, 'l1', 'Q');
    expect(doc.lines[1]).toMatchObject({ formula: 'Q', rule: 'AS', depth: 1 });
    doc = closeSubproof(doc, 'l2', { formula: 'Q→Q', rule: '→I' });
    expect(doc.lines[2]?.depth).toBe(0);
  });

  it('no se puede cerrar una subprueba desde el nivel superior', () => {
    const doc = appendLine(emptyFitchDocument(), { formula: 'P', rule: 'PR', depth: 0 });
    expect(() => closeSubproof(doc, 'l1', { formula: 'P', rule: 'R' })).toThrow(FitchEditError);
  });

  it('rechaza profundidades fuera del rango del editor', () => {
    const doc = emptyFitchDocument();
    expect(() => appendLine(doc, { formula: 'P', rule: 'AS', depth: -1 })).toThrow(FitchEditError);
    expect(() =>
      appendLine(doc, { formula: 'P', rule: 'AS', depth: EDITOR_MAX_DEPTH + 1 }),
    ).toThrow(FitchEditError);
    expect(() => appendLine(doc, { formula: 'P', rule: 'AS', depth: 1.5 })).toThrow(FitchEditError);
  });

  it('sangrar y desangrar mueven un nivel', () => {
    let doc = appendLine(emptyFitchDocument(), { formula: 'P', rule: 'AS', depth: 0 });
    doc = indentLine(doc, 'l1');
    expect(doc.lines[0]?.depth).toBe(1);
    doc = outdentLine(doc, 'l1');
    expect(doc.lines[0]?.depth).toBe(0);
    expect(() => outdentLine(doc, 'l1')).toThrow(FitchEditError);
  });

  it('operar sobre una línea inexistente lanza en vez de no hacer nada', () => {
    const doc = emptyFitchDocument();
    expect(() => updateLine(doc, 'l99', { formula: 'X' })).toThrow(FitchEditError);
    expect(() => removeLine(doc, 'l99')).toThrow(FitchEditError);
  });

  it('la meta se puede fijar y retirar', () => {
    expect(setGoal(emptyFitchDocument(), 'A').goal).toBe('A');
    expect(toProofInput(setGoal(emptyFitchDocument('A'), null)).proof.goal).toBeUndefined();
  });

  it('exporta texto legible con numeración, barras y justificación', () => {
    const texto = toFitchText(conAndE());
    expect(texto).toContain('Meta: A');
    expect(texto).toContain('1 │ A∧B    PR');
    expect(texto).toContain('2 │ A    ∧E 1');
  });
});

describe('historial de edición (T-H6-13)', () => {
  it('deshace y rehace', () => {
    const base = emptyFitchDocument();
    let history = initialHistory(base);
    expect(canUndo(history)).toBe(false);

    const conLinea = appendLine(base, { formula: 'P', rule: 'PR', depth: 0 });
    history = commitEdit(history, conLinea);
    expect(history.present.lines).toHaveLength(1);

    history = undo(history);
    expect(history.present.lines).toHaveLength(0);
    expect(canRedo(history)).toBe(true);

    history = redo(history);
    expect(history.present.lines).toHaveLength(1);
  });

  it('una edición nueva descarta la rama de rehacer', () => {
    let history = initialHistory(emptyFitchDocument());
    history = commitEdit(history, appendLine(history.present, { formula: 'P', rule: 'PR' }));
    history = undo(history);
    history = commitEdit(history, appendLine(history.present, { formula: 'Q', rule: 'PR' }));
    expect(canRedo(history)).toBe(false);
    expect(history.present.lines[0]?.formula).toBe('Q');
  });

  it('deshacer o rehacer de más lanza en vez de devolver lo mismo', () => {
    const history = initialHistory(emptyFitchDocument());
    expect(() => undo(history)).toThrow(FitchEditError);
    expect(() => redo(history)).toThrow(FitchEditError);
  });

  it('la pila tiene tope: el historial no crece con la sesión sin límite', () => {
    let history = initialHistory(emptyFitchDocument());
    for (let i = 0; i < HISTORY_LIMIT + 20; i += 1) {
      history = commitEdit(history, appendLine(history.present, { formula: 'P', rule: 'PR' }));
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT);
  });
});
