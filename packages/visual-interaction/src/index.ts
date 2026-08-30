// @profesor-ia/visual-interaction — whiteboard-adapter, captura, coordenadas,
// anotaciones. **Nunca veredicto formal** (DEC-VISION-001, ci:visual:no-verdict):
// la regla `visual-sin-veredicto-formal` de `.dependency-cruiser.cjs` impide que
// este paquete alcance la ruta de verificación, y tiene siembra que lo comprueba.

export const PACKAGE_NAME = "@profesor-ia/visual-interaction" as const;

export * from './coordinates.js';
export * from './annotations.js';
export * from './failure-attribution.js';
export * from './vision-policy.js';
