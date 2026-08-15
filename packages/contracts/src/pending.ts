import { z } from 'zod';

/**
 * Catálogos cuyo contenido literal vive en el Maestro (jerarquía §0.1) y que
 * `Plan.md` no transcribe. Regla §0.2.5: «decisión faltante ⇒ no inventar».
 *
 * En vez de inventar miembros de enum, se declara un esquema que **falla
 * cerrado**: cualquier valor es rechazado hasta que el catálogo se transcriba
 * literalmente desde su fuente. Así el sistema no puede avanzar apoyado en
 * valores fabricados y la deuda queda visible en `docs/plan/pending-literals.md`.
 */
export interface PendingCatalog {
  readonly catalogId: string;
  /** Sección exacta de la fuente autoritativa que debe transcribirse. */
  readonly source: string;
  /** Tarea del plan que cerrará el hueco. */
  readonly closesIn: string;
}

const REGISTRY: PendingCatalog[] = [];

export function pendingCatalog<T = never>(entry: PendingCatalog): z.ZodType<T> {
  REGISTRY.push(entry);
  const message =
    `PENDING_MAESTRO_LITERAL: catálogo "${entry.catalogId}" no transcrito. ` +
    `Fuente autoritativa: ${entry.source}. Cierra en: ${entry.closesIn}.`;
  return z.custom<T>(() => false, { message, abort: true });
}

/** Catálogos pendientes registrados hasta ahora (para docs y pruebas). */
export function pendingCatalogs(): readonly PendingCatalog[] {
  return [...REGISTRY];
}
