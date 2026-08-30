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
 */
export function MateriaAccion({ card }: { readonly card: MateriaCard }) {
  const accion: PrimaryAction = card.action;
  const base = `/materias/${card.courseId}`;

  switch (accion.kind) {
    case 'continuar':
      return (
        <a
          className="btn"
          data-action="continuar"
          data-resume-point={accion.resumePoint}
          href={`${base}/clase`}
        >
          {MATERIAS_COPY.inicio.continueAction}
        </a>
      );
    case 'empezar':
      return (
        <a className="btn" data-action="empezar" href={`${base}/clase`}>
          {MATERIAS_COPY.inicio.startAction}
        </a>
      );
    case 'ver_preparacion':
      return (
        <a className="btn" data-action="ver-preparacion" data-estado={accion.state} href={base}>
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
