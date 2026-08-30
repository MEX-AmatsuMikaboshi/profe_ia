import { MATERIAS_COPY } from '../copy';
import { KC_PROGRESS_STATES, type ProgresoViewModel } from '../view-model';
import { MateriaInsignia } from './MateriaAccion';

/**
 * Progreso (T-CC-05 ← UIUX §6.6, P-I §3.1.2, T-CC-04).
 *
 * Dos ramas, y son de verdad distintas. La materia con verificador enseña el
 * estado por KC y su recuento; la materia propia **no tiene esa sección**,
 * porque nadie puede declarar dominio en ella. Pintarla vacía diría «0 dominados
 * de 0», que es una afirmación sobre el aprendizaje del alumno que nadie midió.
 *
 * En ningún sitio de esta vista se divide nada. §6.6 prohíbe los porcentajes de
 * «retención estimada» y §6.1 prohíbe inferir reglas pedagógicas de porcentajes;
 * lo que se enseña son **cuentas** —cuatro de trece— y no una fracción.
 */
export function ProgresoView({ viewModel }: { readonly viewModel: ProgresoViewModel }) {
  const badgeCard = {
    courseId: viewModel.courseId,
    title: viewModel.courseId,
    badge: viewModel.badge,
    teachable: true,
    action: { kind: 'empezar' } as const,
    lastSessionId: null,
    updatedAtMs: 0,
  };

  return (
    <main
      className="materias-shell"
      data-testid="progreso"
      data-materia={viewModel.courseId}
      data-autoridad={viewModel.kind}
    >
      <header>
        <h1>{MATERIAS_COPY.progreso.title}</h1>
      </header>

      <MateriaInsignia card={badgeCard} />

      {viewModel.kind === 'sin_autoridad_de_dominio' ? (
        <section className="card" data-testid="sin-autoridad">
          {/* El descargo es obligatorio: un hueco mudo donde otras materias
              tienen dominio se lee como que aquí falló algo. */}
          <p>{viewModel.disclaimer}</p>
        </section>
      ) : (
        <>
          <section className="card" aria-label={MATERIAS_COPY.progreso.countsHeading}>
            <h2>{MATERIAS_COPY.progreso.countsHeading}</h2>
            <dl data-testid="recuentos">
              {KC_PROGRESS_STATES.map((estado) => (
                <div key={estado} data-recuento={estado}>
                  <dt className="card-kicker">{MATERIAS_COPY.progreso.states[estado]}</dt>
                  <dd>{viewModel.counts[estado]}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-label={MATERIAS_COPY.progreso.countsHeading}>
            <ul className="materias-lista" data-testid="kcs">
              {viewModel.kcs.map((kc) => (
                <li key={kc.kcId} className="progreso-kc" data-kc={kc.kcId} data-estado={kc.state}>
                  <span>{kc.kcId}</span>
                  {/* Texto además de posición: UIUX §3 no admite que el estado
                      se comunique sólo por dónde cae la fila. */}
                  <span className="tag">{MATERIAS_COPY.progreso.states[kc.state]}</span>
                  {kc.lastChangedAt !== null && <span>{kc.lastChangedAt}</span>}
                </li>
              ))}
            </ul>
          </section>

          <section className="card" aria-label={MATERIAS_COPY.progreso.retentionHeading}>
            <h2>{MATERIAS_COPY.progreso.retentionHeading}</h2>
            {viewModel.retention.kind === 'no_evaluada' ? (
              <p data-testid="retencion-no-evaluada" data-codigo={viewModel.retention.declaredCode}>
                {MATERIAS_COPY.progreso.retentionNotEvaluated}
              </p>
            ) : (
              <ul data-testid="retencion">
                {viewModel.retention.measurements.map((m) => (
                  <li key={`${m.kcId}-${m.measuredAt}`} data-kc={m.kcId}>
                    {m.kcId} — {m.measuredAt} — {m.correct ? 'correcta' : 'incorrecta'}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <section className="card" aria-label={MATERIAS_COPY.inicio.reviewsHeading}>
        <h2 className="card-kicker">{MATERIAS_COPY.inicio.reviewsHeading}</h2>
        {viewModel.scheduledReviews.length === 0 ? (
          <p data-testid="sin-repasos">{MATERIAS_COPY.inicio.noReviews}</p>
        ) : (
          <ul data-testid="repasos">
            {viewModel.scheduledReviews.map((review) => (
              <li key={`${review.kcId}-${review.scheduledFor}`}>
                {review.kcId} — {review.scheduledFor}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-label={MATERIAS_COPY.detalle.historyHeading}>
        <h2 className="card-kicker">{MATERIAS_COPY.detalle.historyHeading}</h2>
        {viewModel.history.length === 0 ? (
          <p data-testid="sin-historial">{MATERIAS_COPY.detalle.noHistory}</p>
        ) : (
          <ul data-testid="historial">
            {viewModel.history.map((entry) => (
              <li key={entry.sessionId} data-sesion={entry.sessionId}>
                {entry.endedAt} — {entry.summary}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
