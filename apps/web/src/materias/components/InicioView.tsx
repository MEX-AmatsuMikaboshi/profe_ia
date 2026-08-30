import { MATERIAS_COPY } from '../copy';
import type { InicioViewModel, MateriaCard } from '../view-model';
import { MateriaAccion, MateriaInsignia } from './MateriaAccion';

/**
 * Inicio (T-CC-05 ← UIUX §6.1).
 *
 * Componente puro: recibe el modelo ya derivado. Los tres sitios donde esta
 * pantalla podría afirmar de más —repasos, consumo y punto de retorno— pintan
 * una frase explícita cuando no hay dato, en vez de un hueco o un cero. Un hueco
 * se lee como «todavía cargando» y un cero como «medido y salió cero».
 */

function Tarjeta({ card }: { readonly card: MateriaCard }) {
  return (
    <li className="card" data-materia={card.courseId}>
      <h3>{card.title}</h3>
      <MateriaInsignia card={card} />
      <MateriaAccion card={card} />
    </li>
  );
}

export function InicioView({ viewModel }: { readonly viewModel: InicioViewModel }) {
  const { active, enCurso, enPreparacion, scheduledReviews, cost } = viewModel;

  return (
    <main className="materias-shell" data-testid="inicio">
      <header>
        <h1>{MATERIAS_COPY.inicio.title}</h1>
      </header>

      <section className="card" aria-label={MATERIAS_COPY.inicio.activeHeading}>
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

      <section aria-label={MATERIAS_COPY.inicio.enCursoHeading}>
        <h2>{MATERIAS_COPY.inicio.enCursoHeading}</h2>
        <ul className="materias-lista" data-testid="materias-en-curso">
          {enCurso.map((card) => (
            <Tarjeta key={card.courseId} card={card} />
          ))}
        </ul>
      </section>

      {enPreparacion.length > 0 && (
        <section aria-label={MATERIAS_COPY.inicio.enPreparacionHeading}>
          <h2>{MATERIAS_COPY.inicio.enPreparacionHeading}</h2>
          <ul className="materias-lista" data-testid="materias-en-preparacion">
            {enPreparacion.map((card) => (
              <Tarjeta key={card.courseId} card={card} />
            ))}
          </ul>
        </section>
      )}

      <section className="card" aria-label={MATERIAS_COPY.inicio.reviewsHeading}>
        <h2>{MATERIAS_COPY.inicio.reviewsHeading}</h2>
        {scheduledReviews.length === 0 ? (
          // §6.1 pide los repasos «cuando el motor los haya programado». Vacío
          // es una afirmación sobre el motor, no sobre lo que falta repasar.
          <p data-testid="sin-repasos">{MATERIAS_COPY.inicio.noReviews}</p>
        ) : (
          <ul data-testid="repasos">
            {scheduledReviews.map((review) => (
              <li key={`${review.kcId}-${review.scheduledFor}`}>
                {review.kcId} — {review.scheduledFor}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-label={MATERIAS_COPY.inicio.costHeading}>
        <h2 className="card-kicker">{MATERIAS_COPY.inicio.costHeading}</h2>
        {cost === null ? (
          <p data-testid="sin-consumo">{MATERIAS_COPY.inicio.noCost}</p>
        ) : (
          <p data-testid="consumo">
            {cost.amount} {cost.currency} ({cost.entries})
          </p>
        )}
      </section>

      <section className="card" aria-label={MATERIAS_COPY.inicio.capabilitiesHeading}>
        <h2 className="card-kicker">{MATERIAS_COPY.inicio.capabilitiesHeading}</h2>
        <p data-testid="capacidades">{viewModel.capabilitiesNote}</p>
      </section>
    </main>
  );
}
