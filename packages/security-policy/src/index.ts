// @profesor-ia/security-policy — matriz de permisos y canarios
// (Plan.md T-H1-02, T-H4-05; DEC-PRIVILEGE-001).
//
// Este paquete es **datos y política**, no acceso: no abre conexiones ni
// contiene secretos. Los strings canario viven en el gestor de secretos
// (Infisical), nunca en la base ni en el repositorio; aquí solo se modela su
// registro de metadatos.

export const PACKAGE_NAME = '@profesor-ia/security-policy' as const;

export * from './roles.js';
export * from './matrix.js';
export * from './canary.js';
