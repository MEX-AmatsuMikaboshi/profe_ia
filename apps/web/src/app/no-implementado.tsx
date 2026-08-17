/**
 * Superficie no implementada (D-11).
 *
 * `apps/web` implementa en F7 **sólo** la vista de Clase (T-H6-13). El resto de
 * las rutas de §7 —Inicio, Mis materias, Crear materia, Progreso,
 * Investigación, Configuración, consolas— son de F9/F13 y aquí lo dicen. Una
 * pantalla vacía con la navegación puesta parecería una vista terminada a la
 * que no le ha llegado el contenido, y eso es éxito simulado.
 */
export function NoImplementado({ ruta }: { readonly ruta: string }) {
  return (
    <main data-testid="no-implementado">
      <h1>NO_IMPLEMENTADO</h1>
      <p>
        La ruta <code>{ruta}</code> no está implementada todavía. En F7 sólo existe la vista de
        Clase (T-H6-13); las demás vistas llegan en su fase.
      </p>
    </main>
  );
}
