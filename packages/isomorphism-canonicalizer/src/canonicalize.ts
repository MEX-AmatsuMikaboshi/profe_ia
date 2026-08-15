import { createHash } from 'node:crypto';
import { atoms, parse, print, renameAtoms, type Formula } from '@profesor-ia/logic-core';

/**
 * Definición **operacional** de isomorfismo (Maestro P-I §5.11):
 *
 * > dos reactivos son isomorfos cuando su estructura de prueba normalizada
 * > coincide bajo renombrado de átomos y reordenamiento de pasos
 * > independientes permitido por el cálculo.
 *
 * Es una convención de ingeniería del proyecto, **no** una afirmación de que
 * exista una única noción científica universal de isomorfismo pedagógico. Su
 * precisión se valida antes del freeze y sus falsos positivos/negativos se
 * auditan (`[CALIBRATION CAL-07]`).
 *
 * Los duplicados triviales son un caso más estricto: coinciden con solo
 * renombrar átomos, sin necesidad de reordenar nada.
 */

export interface CanonicalProofLine {
  readonly formula: string;
  readonly rule: string;
  readonly refs?: readonly (number | readonly [number, number])[];
  readonly depth: number;
}

export interface CanonicalProof {
  readonly lines: readonly CanonicalProofLine[];
  readonly goal?: string;
}

/**
 * Renombrado canónico: los átomos se numeran por orden de aparición.
 *
 * Los nombres canónicos son **átomos válidos del lenguaje** (letra con
 * subíndice, `A_1`, `A_2`, …), no etiquetas inventadas: así la forma canónica
 * sigue siendo una fórmula del cálculo y puede volver a parsearse.
 */
export function canonicalAtomMapping(formulas: readonly Formula[]): Record<string, string> {
  const seen: string[] = [];
  for (const f of formulas) atoms(f, seen);
  return Object.fromEntries(seen.map((name, i) => [name, `A${i + 1}`]));
}

/** Forma canónica de una fórmula aislada, bajo renombrado de átomos. */
export function canonicalizeFormula(input: string): string {
  const parsed = parse(input);
  return print(renameAtoms(parsed, canonicalAtomMapping([parsed])));
}

const isRange = (r: number | readonly [number, number]): r is readonly [number, number] =>
  Array.isArray(r);

/**
 * Firma estructural de una derivación.
 *
 * Se construye sobre el **grafo de dependencias**, no sobre la secuencia de
 * líneas: por eso es invariante al reordenamiento de pasos independientes. Las
 * citas de un mismo paso se ordenan, porque el cálculo ya acepta ambas órdenes
 * en las reglas binarias.
 */
export function structuralSignature(proof: CanonicalProof): string {
  const parsedLines = proof.lines.map((line) => ({ ...line, ast: parse(line.formula) }));
  const mapping = canonicalAtomMapping(parsedLines.map((l) => l.ast));

  const canonicalFormula = (ast: Formula): string => print(renameAtoms(ast, mapping));

  const memo = new Map<number, string>();

  const signatureOf = (lineNumber: number): string => {
    const cached = memo.get(lineNumber);
    if (cached !== undefined) return cached;

    const line = parsedLines[lineNumber - 1];
    if (!line) return '⟨ausente⟩';

    // Marca provisional: una cita circular no puede colgar el cálculo.
    memo.set(lineNumber, '⟨ciclo⟩');

    const formula = canonicalFormula(line.ast);
    let signature: string;

    if (line.rule === 'PR' || line.rule === 'AS') {
      signature = `${line.rule}(${formula})`;
    } else {
      const parts = (line.refs ?? []).map((ref) =>
        isRange(ref)
          ? `SUB[${signatureOf(ref[0])}⇒${signatureOf(ref[1])}]`
          : signatureOf(ref),
      );
      // Orden estable e independiente de cómo se escribieron las citas.
      parts.sort();
      signature = `${line.rule}(${formula}←${parts.join(',')})`;
    }

    memo.set(lineNumber, signature);
    return signature;
  };

  const conclusionIndex = parsedLines.length;
  const conclusion = signatureOf(conclusionIndex);
  const premises = parsedLines
    .filter((l) => l.rule === 'PR')
    .map((l) => canonicalFormula(l.ast))
    .sort();

  const canonicalForm = `premisas[${premises.join(';')}]⊢${conclusion}`;
  return createHash('sha256').update(canonicalForm).digest('hex');
}

/** Forma canónica legible, útil para auditar por qué dos reactivos colisionan. */
export function canonicalForm(proof: CanonicalProof): string {
  const parsedLines = proof.lines.map((line) => ({ ...line, ast: parse(line.formula) }));
  const mapping = canonicalAtomMapping(parsedLines.map((l) => l.ast));
  return parsedLines
    .map((l, i) => {
      const refs = (l.refs ?? [])
        .map((r) => (isRange(r) ? `${r[0]}-${r[1]}` : String(r)))
        .join(',');
      return `${i + 1}|${l.depth}|${l.rule}|${print(renameAtoms(l.ast, mapping))}|${refs}`;
    })
    .join('\n');
}

/** ¿Dos derivaciones son isomorfas bajo la canonicalización congelada? */
export function areIsomorphic(a: CanonicalProof, b: CanonicalProof): boolean {
  return structuralSignature(a) === structuralSignature(b);
}

/**
 * Duplicado trivial: coinciden con **solo** renombrar átomos, sin reordenar.
 * Caso más estricto que el isomorfismo (P-I §5.11).
 */
export function isTrivialDuplicate(a: CanonicalProof, b: CanonicalProof): boolean {
  return canonicalForm(a) === canonicalForm(b);
}

/** Agrupa reactivos por firma: la base del control de reservas disjuntas (DUP-01). */
export function groupByStructuralSignature<T extends { id: string; proof: CanonicalProof }>(
  items: readonly T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const signature = structuralSignature(item.proof);
    const bucket = groups.get(signature) ?? [];
    bucket.push(item);
    groups.set(signature, bucket);
  }
  return groups;
}
