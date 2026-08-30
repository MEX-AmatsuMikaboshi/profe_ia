import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import * as speech from '../src/index.js';

/**
 * La mitad de superficie de `DEC-VOICE-001` (T-H8-01/02).
 *
 * «TTS/STT no reciben autoridad formal.» Como en `visual-interaction`, son dos
 * comprobaciones distintas y hacen falta las dos:
 *
 * - **depcruise** (`visual-sin-veredicto-formal`) prohíbe la **arista**: este
 *   paquete no puede importar la ruta de verificación.
 * - **esto** prohíbe la **superficie**: que no exista aquí nada que *parezca*
 *   veredicto aunque no importe a nadie. Un `isValid()` escrito a mano en este
 *   paquete pasaría depcruise limpiamente y sería justo lo que la decisión
 *   prohíbe — una transcripción que dictamina.
 *
 * El paquete declara `@profesor-ia/logic-core` como **devDependency** para que
 * `test/calculus-correspondence.test.ts` compruebe que el lexicón sigue
 * correspondiendo al cálculo congelado. Esa declaración hace que un import desde
 * `src/` **resuelva**, así que aquí se comprueba explícitamente que no lo hay:
 * sin esta prueba, la puerta que se abrió para el control quedaría abierta
 * también para el código de producción.
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

describe('DEC-VOICE-001 — superficie', () => {
  it('el paquete no exporta nada que dictamine validez', () => {
    const exportados = Object.keys(speech);
    for (const prohibido of NOMBRES_DE_VEREDICTO) {
      expect(
        exportados.filter((e) => e.toLowerCase() === prohibido.toLowerCase()),
        `«${prohibido}» exportado desde speech-gateway`,
      ).toStrictEqual([]);
    }
  });

  it('el código fuente no importa la ruta de verificación', () => {
    const archivos = readdirSync(SRC).filter((f) => f.endsWith('.ts'));
    expect(archivos.length).toBeGreaterThan(0);
    for (const archivo of archivos) {
      const fuente = readFileSync(join(SRC, archivo), 'utf8');
      const imports = [...fuente.matchAll(/^\s*import[^;]*from\s+'([^']+)'/gmu)].map((m) => m[1]);
      for (const especificador of imports) {
        expect(
          especificador,
          `${archivo} importa la ruta de verificación (DEC-VOICE-001)`,
        ).not.toMatch(/logic-core|proof-search|verifier/u);
      }
    }
  });

  it('la corrección post-COMMIT no puede recalificar por su cuenta', () => {
    // La forma que tomaría aquí «autoridad formal»: que rehacer el dictado
    // reescribiera un veredicto ya emitido. El campo se llama `adjudication` y
    // no `verdict` por eso mismo.
    const commit = speech.commitTranscript({
      commitId: 'c-1',
      captureMode: 'push_to_talk',
      transcript: speech.normalizeTranscript({ raw: 'letra P', target: 'formula' }),
      keyterms: { applied: false, reason: 'lexico_vacio' },
      scoreable: true,
    });
    const correccion = speech.correctAfterCommit({
      correctionId: 'k-1',
      commit,
      transcript: speech.normalizeTranscript({ raw: 'letra Q', target: 'formula' }),
    });
    expect(Object.keys(correccion)).not.toContain('verdict');
    expect(correccion.adjudication).toBe('required');
    expect(correccion.overwritesOriginal).toBe(false);
  });

  it('el TTS no tiene por dónde tocar una decisión pedagógica', () => {
    // `degradeToText` recibe la reproducción y un motivo, y nada más: no existe
    // la llamada con la que un fallo de audio degradaría la decisión.
    expect(speech.degradeToText.length).toBe(2);
  });
});
