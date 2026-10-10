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
    <main className="materias-shell" data-testid="no-implementado" data-code="NO_IMPLEMENTADO">
      <header><div><p className="eyebrow">SECCIÓN NO DISPONIBLE</p><h1>Esta sección aún no está lista</h1></div></header>
      <p>Mientras tanto, puedes volver a tus materias y explorar las pantallas disponibles.</p>
      <p className="page-subtitle">Dirección solicitada: <code>{ruta}</code></p>
      <div className="course-actions"><a className="btn btn-secondary" href="/materias">Ir a mis materias</a><a className="btn btn-ghost" href="/">Volver al inicio</a></div>
    </main>
  );
}
