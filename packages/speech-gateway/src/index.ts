// @profesor-ia/speech-gateway — STT, TTS y lexicón de verbalización (F10/H8,
// T-H8-01 y T-H8-02).
//
// Frontera dura: `DEC-VOICE-001` dice que «TTS/STT no reciben autoridad
// formal», y la regla `visual-sin-veredicto-formal` de `.dependency-cruiser.cjs`
// lo hace cumplir prohibiendo a este paquete toda la ruta de verificación —sin
// la excepción del subpath `syntax` que sí tiene `apps/web`—. Por eso el lexicón
// no parsea: no hay AST aquí, y `test/no-verdict.test.ts` comprueba además que
// no existe **superficie** que parezca veredicto, que es la mitad que depcruise
// no ve.
//
// Determinismo: sin reloj, sin azar y sin red en `src/`. Los adaptadores de
// proveedor viven fuera de este paquete; aquí está la política que los gobierna.

export const PACKAGE_NAME = '@profesor-ia/speech-gateway' as const;

export * from './lexicon.js';
export * from './stt.js';
export * from './tts.js';
