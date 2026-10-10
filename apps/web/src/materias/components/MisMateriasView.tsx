import { MATERIAS_COPY } from '../copy';
import type { MateriaRow, MisMateriasViewModel } from '../view-model';
import { MateriaAccion, MateriaInsignia } from './MateriaAccion';

/**
 * Mis materias (T-CC-05 ← UIUX §6.2, UI-CORR-01).
 *
 * Los dos carriles van en **secciones separadas**, no en una lista ordenada con
 * la insignia al lado. Una sola lista deja al curso validado arriba por
 * accidente de orden, y un orden insinúa una jerarquía que P-I §3.1.2 prohíbe:
 * la materia propia es «funcionalmente útil, pero metodológicamente no validada»,
 * que no es peor, es otra cosa.
 *
 * Los tres estados de UI-CORR-01 se pintan como **tres campos con su rótulo**.
 * Un indicador único de «estado» es exactamente el defecto que la corrección
 * nombra: un día enseña el resultado de un benchmark técnico y al siguiente
 * parece decir que el curso funciona pedagógicamente.
 */

function Fila({ row }: { readonly row: MateriaRow }) {
  return (
    <li className="card" data-materia={row.courseId} data-track={row.badge.track}>
      <h3 className="course-card-title"><a href={`/materias/${row.courseId}`}>{row.title}</a></h3>
      <MateriaInsignia card={row} />

      <details className="workspace-details"><summary>Estado del curso y evaluación</summary>
      <dl data-testid="estado-ui-corr-01">
        <dt className="card-kicker">{MATERIAS_COPY.misMaterias.statusTechnical}</dt>
        <dd data-estado="tecnico">{row.status.technicalPackage}</dd>

        <dt className="card-kicker">{MATERIAS_COPY.misMaterias.statusAudit}</dt>
        <dd data-estado="auditoria">{row.status.auditBenchmark}</dd>

        <dt className="card-kicker">{MATERIAS_COPY.misMaterias.statusExperimental}</dt>
        {/* `null` mientras H11 no produzca veredictos. Se dice con palabras: un
            guion suelto se lee como «cero» y aquí no hay ningún cero medido. */}
        <dd data-estado="experimental">
          {row.status.experimental ?? MATERIAS_COPY.misMaterias.noExperimental}
        </dd>
      </dl>
      </details>

      <MateriaAccion card={row} />
      <a className="course-card-link" href={`/materias/${row.courseId}`}>Ver temario y detalles →</a>
    </li>
  );
}

export function MisMateriasView({ viewModel }: { readonly viewModel: MisMateriasViewModel }) {
  return (
    <main className="materias-shell" data-testid="mis-materias">
      <header>
        <div><p className="eyebrow">TU BIBLIOTECA</p><h1>{MATERIAS_COPY.misMaterias.title}</h1><p className="page-subtitle">Elige una materia para ver sus temas o entrar a clase.</p></div>
      </header>

      <div className="materias-carriles">
        <section aria-label={MATERIAS_COPY.misMaterias.validadoHeading}>
          <h2>{MATERIAS_COPY.misMaterias.validadoHeading}</h2>
          <ul className="materias-lista" data-testid="carril-validado">
            {viewModel.validado.map((row) => (
              <Fila key={row.courseId} row={row} />
            ))}
          </ul>
        </section>

        <section aria-label={MATERIAS_COPY.misMaterias.personalizadasHeading}>
          <h2>{MATERIAS_COPY.misMaterias.personalizadasHeading}</h2>
          {viewModel.personalizadas.length === 0 ? (
            <p data-testid="sin-materias-propias">{MATERIAS_COPY.misMaterias.empty}</p>
          ) : (
            <ul className="materias-lista" data-testid="carril-personalizado">
              {viewModel.personalizadas.map((row) => (
                <Fila key={row.courseId} row={row} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
