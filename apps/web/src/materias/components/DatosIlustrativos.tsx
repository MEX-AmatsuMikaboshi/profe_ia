import { MATERIAS_COPY } from '../copy';

/**
 * Declaración de datos ilustrativos (UIUX §2).
 *
 * Lo pinta la ruta y no la vista: la vista es pura y no sabe de dónde vienen sus
 * datos, y esa ignorancia es lo que la hace comprobable. Quien decide alimentarla
 * con el paquete sintético es quien tiene que decirlo en pantalla.
 *
 * No es una nota al pie. Sin ella, una demostración con un progreso inventado se
 * lee como una medida —que es justo lo que §2 y §6.1 prohíben— y quien mire la
 * pantalla no tiene forma de saber que nada de eso salió de una corrida.
 */
export function DatosIlustrativos() {
  return (
    <aside className="demo-notice" data-testid="datos-ilustrativos" role="note">
      <p>
        <strong>Vista de demostración.</strong> Materias, avance y fechas son ilustrativos. Nada de esto es una medida.
      </p>
    </aside>
  );
}

/** Rótulo reutilizado por las rutas para el título del documento. */
export const TITULO_MATERIAS = MATERIAS_COPY.misMaterias.title;
