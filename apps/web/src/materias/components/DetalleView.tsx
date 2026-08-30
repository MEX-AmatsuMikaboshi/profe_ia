import { MATERIAS_COPY } from '../copy';
import type { DetalleViewModel } from '../view-model';
import { MateriaAccion, MateriaInsignia } from './MateriaAccion';

/**
 * Detalle de materia (T-CC-05 ← UIUX §6.4).
 *
 * §6.4 dice que «los indicadores no pueden inventar una medida de retención,
 * dominio o dificultad distinta de las fuentes de verdad del sistema». Por eso
 * aquí no hay barra de avance ni contador: la estructura se enseña, el progreso
 * se enseña en Progreso, y lo que no viene de una fuente no aparece.
 *
 * La preparación se pinta **sólo mientras la materia no es enseñable**. Dejarla
 * visible después convertiría en permanente el aviso de un proceso terminado, y
 * quien lo mirase concluiría que algo quedó a medias.
 */
export function DetalleView({ viewModel }: { readonly viewModel: DetalleViewModel }) {
  const { card, status, outline, history, scheduledReviews, preparation } = viewModel;

  return (
    <main className="materias-shell" data-testid="detalle-materia" data-materia={card.courseId}>
      <header>
        <h1>{card.title}</h1>
      </header>

      <MateriaInsignia card={card} />

      {preparation !== null && (
        <section className="card" data-testid="preparacion" aria-label={MATERIAS_COPY.detalle.preparationHeading}>
          <h2>{MATERIAS_COPY.detalle.preparationHeading}</h2>
          <p data-estado={preparation.state}>{preparation.lastMessageText}</p>

          <ul data-testid="artefactos">
            {preparation.artifacts.map((artifact) => (
              <li key={`${artifact.kind}-${artifact.ref}`} data-artefacto={artifact.kind}>
                {artifact.kind}: {artifact.ref}
              </li>
            ))}
          </ul>

          {preparation.retryable ? (
            <button type="button" className="btn" data-testid="reintentar">
              {MATERIAS_COPY.detalle.retryAction}
            </button>
          ) : (
            preparation.state === 'failed' && (
              // No basta con esconder el botón: un fallo sin salida visible se
              // lee como que el sistema se rindió. Se dice qué hacer.
              <p data-testid="no-reintentable">{MATERIAS_COPY.detalle.notRetryable}</p>
            )
          )}

          <p data-testid="promesa-de-fondo">{preparation.backgroundPromise}</p>
        </section>
      )}

      <section className="card" data-testid="estado-tecnico">
        <h2 className="card-kicker">{MATERIAS_COPY.misMaterias.statusTechnical}</h2>
        <p>{status.technicalPackage}</p>
        <h2 className="card-kicker">{MATERIAS_COPY.misMaterias.statusAudit}</h2>
        <p>{status.auditBenchmark}</p>
        <h2 className="card-kicker">{MATERIAS_COPY.misMaterias.statusExperimental}</h2>
        <p data-estado="experimental">
          {status.experimental ?? MATERIAS_COPY.misMaterias.noExperimental}
        </p>
      </section>

      <section aria-label={MATERIAS_COPY.detalle.outlineHeading}>
        <h2>{MATERIAS_COPY.detalle.outlineHeading}</h2>
        <ul className="materias-lista" data-testid="unidades">
          {outline.map((unit) => (
            <li key={unit.unitId} className="card" data-unidad={unit.unitId}>
              <h3>{unit.title}</h3>
              <p>{unit.kcIds.join(', ')}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-label={MATERIAS_COPY.detalle.historyHeading}>
        <h2>{MATERIAS_COPY.detalle.historyHeading}</h2>
        {history.length === 0 ? (
          <p data-testid="sin-historial">{MATERIAS_COPY.detalle.noHistory}</p>
        ) : (
          <ul data-testid="historial">
            {history.map((entry) => (
              <li key={entry.sessionId} data-sesion={entry.sessionId}>
                {entry.endedAt} — {entry.summary}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-label={MATERIAS_COPY.inicio.reviewsHeading}>
        <h2 className="card-kicker">{MATERIAS_COPY.inicio.reviewsHeading}</h2>
        {scheduledReviews.length === 0 ? (
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

      {card.teachable && (
        <p>
          <MateriaAccion card={card} />
        </p>
      )}

      <p>
        <a className="btn" data-action="ver-progreso" href={`/materias/${card.courseId}/progreso`}>
          {MATERIAS_COPY.progreso.title}
        </a>
      </p>
    </main>
  );
}
