import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import * as visual from '../src/index.js';

/**
 * `ci:visual:no-verdict` — la mitad de propiedad (T-H8-12 ← `DEC-VISION-001`).
 *
 * El AC de H8 pide **cero rutas arquitectónicamente posibles** de
 * `visual-interaction` hacia un veredicto formal, y lo pide con «prueba de
 * propiedad **+** depcruise». Son dos comprobaciones distintas y hacen falta las
 * dos:
 *
 * - **depcruise** (`visual-sin-veredicto-formal`, con siembra en
 *   `verify-depcruise-catches.mjs`) prohíbe la **arista**: este paquete no puede
 *   importar la ruta de verificación.
 * - **esto** prohíbe la **superficie**: que no exista aquí nada que *parezca* un
 *   veredicto, aunque no importe a nadie. Un `isValid()` propio en este paquete
 *   pasaría depcruise limpiamente y sería exactamente lo que DEC-VISION-001
 *   prohíbe: un score visual que autoriza.
 */

const SRC = join(import.meta.dirname, '..', 'src');

/** Nombres que sólo tienen sentido si algo aquí dictamina validez. */
const NOMBRES_DE_VEREDICTO = [
  'verify',
  'isValid',
  'valid',
  'goalReached',
  'applyRule',
  'entails',
  'grade',
  'score',
];

describe('ci:visual:no-verdict — superficie', () => {
  it('el paquete no exporta nada que dictamine validez', () => {
    const exportados = Object.keys(visual);
    for (const prohibido of NOMBRES_DE_VEREDICTO) {
      const coincide = exportados.filter(
        (e) => e.toLowerCase() === prohibido.toLowerCase(),
      );
      expect(coincide, `«${prohibido}» exportado desde visual-interaction`).toStrictEqual([]);
    }
  });

  it('ninguna acción de la política visual afirma validez', () => {
    // `observe` es la más permisiva y sólo autoriza registrar lo percibido.
    expect([...visual.VISION_ACTIONS]).toStrictEqual(['observe', 'confirm', 'decline']);
  });

  it('el código fuente no importa la ruta de verificación', () => {
    // Redundante con depcruise **a propósito**: esta prueba corre en la suite
    // unitaria, así que el defecto aparece antes de llegar al job de
    // arquitectura, y aparece con un mensaje que nombra la decisión.
    const archivos = readdirSync(SRC).filter((f) => f.endsWith('.ts'));
    expect(archivos.length).toBeGreaterThan(0);
    for (const archivo of archivos) {
      const fuente = readFileSync(join(SRC, archivo), 'utf8');
      const imports = [...fuente.matchAll(/^\s*import[^;]*from\s+'([^']+)'/gmu)].map((m) => m[1]);
      for (const especificador of imports) {
        expect(
          especificador,
          `${archivo} importa la ruta de verificación (DEC-VISION-001)`,
        ).not.toMatch(/logic-core|proof-search|verifier/u);
      }
    }
  });

  it('un fallo de percepción no puede contar como fallo de KC', () => {
    // La otra mitad de la misma idea: aunque nadie llame a `verify()`, si un
    // error de percepción contara como fallo del alumno, la visión estaría
    // decidiendo sobre su conocimiento por la puerta de atrás.
    const r = visual.classifyFailure({
      attemptId: 'att-x',
      rulings: {
        PERCEPTION_ERROR: { ruledOut: false, evidence: 'el OCR leyó ∨ donde había ∧' },
        INTERFACE_ERROR: { ruledOut: true, evidence: 'sin incidencias' },
        ACCESSIBILITY_ERROR: { ruledOut: true, evidence: 'sin incidencias' },
      },
    });
    expect(r.countsAsKcFailure).toBe(false);
  });
});
