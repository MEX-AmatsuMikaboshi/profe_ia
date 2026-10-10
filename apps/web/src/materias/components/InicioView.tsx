import { MATERIAS_COPY } from '../copy';
import type { InicioViewModel, MateriaCard } from '../view-model';
import { MateriaAccion, MateriaInsignia } from './MateriaAccion';

function Tarjeta({ card }: { readonly card: MateriaCard }) {
  return (
    <li className="card" data-materia={card.courseId}>
      <h3 className="course-card-title"><a href={`/materias/${card.courseId}`}>{card.title}</a></h3>
      <MateriaInsignia card={card} />
      <a className="course-card-link" data-action={card.action.kind === 'ver_preparacion' ? 'ver-preparacion' : 'ver-materia'} href={`/materias/${card.courseId}`}>
        {card.action.kind === 'ver_preparacion' ? 'Ver preparación' : 'Ver materia'} →
      </a>
    </li>
  );
}

/** UIUX §6.1: una acción principal y datos secundarios sin inventar medidas. */
export function InicioView({ viewModel }: { readonly viewModel: InicioViewModel }) {
  const { active, enCurso, enPreparacion, scheduledReviews, cost } = viewModel;
  return (
    <main className="materias-shell" data-testid="inicio">
      <header><div>
        <p className="eyebrow">TU ESPACIO DE APRENDIZAJE</p>
        <h1>{MATERIAS_COPY.inicio.title}</h1>
        <p className="page-subtitle">Retoma tu clase o explora tus materias.</p>
      </div></header>
      <div className="home-lead">
        <section className="card resume-card" aria-label={MATERIAS_COPY.inicio.activeHeading}>
          <h2>{MATERIAS_COPY.inicio.activeHeading}</h2>
          {active === null ? (
            <p data-testid="sin-materia-activa">{MATERIAS_COPY.inicio.noActive}</p>
          ) : (
            <div data-testid="materia-activa" data-materia={active.courseId}>
              <h3>{active.title}</h3>
              <MateriaInsignia card={active} />
              <MateriaAccion card={active} />
            </div>
          )}
        </section>
        <section className="card" aria-label={MATERIAS_COPY.inicio.reviewsHeading}>
          <p className="eyebrow">EN TU AGENDA</p>
          <h2>{MATERIAS_COPY.inicio.reviewsHeading}</h2>
          {scheduledReviews.length === 0 ? (
            <p data-testid="sin-repasos">{MATERIAS_COPY.inicio.noReviews}</p>
          ) : (
            <ul data-testid="repasos">{scheduledReviews.map((review) => (
              <li key={`${review.kcId}-${review.scheduledFor}`}>{review.kcId} — {review.scheduledFor}</li>
            ))}</ul>
          )}
        </section>
      </div>
      <div className="section-heading"><h2>Tu biblioteca</h2><a href="/materias">Ver todas las materias →</a></div>
      <div className="home-library">
        <section aria-label={MATERIAS_COPY.inicio.enCursoHeading}>
          <h2>{MATERIAS_COPY.inicio.enCursoHeading}</h2>
          <ul className="materias-lista" data-testid="materias-en-curso">
            {enCurso.map((card) => <Tarjeta key={card.courseId} card={card} />)}
          </ul>
        </section>
        {enPreparacion.length > 0 && (
          <section aria-label={MATERIAS_COPY.inicio.enPreparacionHeading}>
            <h2>{MATERIAS_COPY.inicio.enPreparacionHeading}</h2>
            <ul className="materias-lista" data-testid="materias-en-preparacion">
              {enPreparacion.map((card) => <Tarjeta key={card.courseId} card={card} />)}
            </ul>
          </section>
        )}
      </div>
      <details className="workspace-details">
        <summary>Consumo y capacidades</summary>
        <div className="home-system">
          <section className="card" aria-label={MATERIAS_COPY.inicio.costHeading}>
            <h2 className="card-kicker">{MATERIAS_COPY.inicio.costHeading}</h2>
            {cost === null ? <p data-testid="sin-consumo">{MATERIAS_COPY.inicio.noCost}</p> : (
              <p data-testid="consumo">{cost.amount} {cost.currency} ({cost.entries})</p>
            )}
          </section>
          <section className="card" aria-label={MATERIAS_COPY.inicio.capabilitiesHeading}>
            <h2 className="card-kicker">{MATERIAS_COPY.inicio.capabilitiesHeading}</h2>
            <p data-testid="capacidades">{viewModel.capabilitiesNote}</p>
          </section>
        </div>
      </details>
    </main>
  );
}
