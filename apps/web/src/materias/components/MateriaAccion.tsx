import { MATERIAS_COPY } from '../copy';
import type { MateriaCard, PrimaryAction } from '../view-model';

/**
 * La acción principal de una materia (T-CC-05 ← UIUX §3, «una acción primaria
 * dominante por pantalla cuando exista una acción principal clara»).
 *
 * Las tres ramas de {@link PrimaryAction} se pintan distintas **y con destinos
 * distintos**. Que «Continuar» y «Empezar» compartieran el mismo enlace sería
 * el defecto que el modelo de vista existe para impedir: llevar al alumno al
 * principio de una materia que sí tenía avance, con cara de fallo de navegación.
 *
 * ## `.btn` a secas no es un botón
 *
 * El sistema vendorizado define `.btn` con fondo y borde **transparentes**: la
 * apariencia la da la variante (`btn-primary`, `btn-secondary`, `btn-ghost`).
 * La primera versión de estas vistas usaba `.btn` sola, y «Continuar clase»
 * salía como texto en negrita — clicable, del tamaño correcto, y sin parecer un
 * control. UIUX §3 pide «una acción primaria dominante por pantalla cuando
 * exista una acción principal clara», y una acción que no se ve no domina nada.
 *
 * No lo caza ninguna prueba sin navegador ni `ci:a11y:baseline`, que audita sólo
 * la vista de Clase: se vio abriendo la demo. Por eso la variante se comprueba
 * por clase en {@link ACCION_PRIMARIA}, que es lo que sí puede vigilar una
 * prueba de render.
 */

/** La variante que hace dominante a la acción de entrar en clase. */
export const ACCION_PRIMARIA = 'btn btn-primary';
/** Las que llevan a una pantalla intermedia, no a la clase. */
export const ACCION_SECUNDARIA = 'btn btn-secondary';

export function MateriaAccion({ card }: { readonly card: MateriaCard }) {
  const accion: PrimaryAction = card.action;
  const base = `/materias/${card.courseId}`;

  switch (accion.kind) {
    case 'continuar':
      return (
        <a
          className={ACCION_PRIMARIA}
          data-action="continuar"
          data-resume-point={accion.resumePoint}
          href={`${base}/clase`}
        >
          {MATERIAS_COPY.inicio.continueAction}
        </a>
      );
    case 'empezar':
      return (
        <a className={ACCION_PRIMARIA} data-action="empezar" href={`${base}/clase`}>
          {MATERIAS_COPY.inicio.startAction}
        </a>
      );
    case 'ver_preparacion':
      // Secundaria a propósito: la materia todavía no se puede estudiar, y
      // darle el mismo peso que a «Continuar clase» invitaría al clic que no
      // lleva a ninguna clase.
      return (
        <a
          className={ACCION_SECUNDARIA}
          data-action="ver-preparacion"
          data-estado={accion.state}
          href={base}
        >
          {MATERIAS_COPY.detalle.preparationHeading}
        </a>
      );
  }
}

/**
 * Insignia de carril con su explicación.
 *
 * La explicación **no es opcional**: la insignia sola nombra el carril y quien
 * la vea por primera vez no sabe qué implica. Va como texto y no como `title`,
 * que un lector de pantalla puede no anunciar.
 */
export function MateriaInsignia({ card }: { readonly card: MateriaCard }) {
  return (
    <p className="tag" data-track={card.badge.track}>
      <strong>{card.badge.label}</strong> — {card.badge.explanation}
    </p>
  );
}
