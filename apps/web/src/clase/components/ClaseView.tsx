import type { ReactNode } from 'react';

import { CLASE_COPY } from '../copy';
import type { LocalReview } from '../local-review';
import { hasLocalNotes } from '../local-review';
import type { SubmissionState } from '../verdict';
import type { ClaseViewModel, HintControl, SaveState } from '../view-model';

/**
 * Vista de Clase (T-H6-13 ← UIUX §6.5, dirección 7A).
 *
 * Componente **puro**: recibe el modelo de vista ya derivado y no decide nada.
 * El editor entra como `children` para que esta capa siga siendo renderizable
 * sin DOM y comprobable en pruebas.
 *
 * UIUX §3: el material es la superficie protagonista, el Profesor IA es un
 * interlocutor visible sin volver la pantalla un chat, la navegación lateral
 * desaparece, y los estados se comunican con **texto + señal**, nunca solo con
 * color.
 */

export interface ClaseViewProps {
  readonly viewModel: ClaseViewModel;
  readonly localReview: LocalReview;
  readonly submission: SubmissionState;
  /** El editor Fitch, que es interactivo y por eso vive en el cliente. */
  readonly children?: ReactNode;
  /** Datos sintéticos de desarrollo (UIUX §2): se declara en pantalla. */
  readonly syntheticPackage: boolean;
}

function SaveIndicator({ state }: { readonly state: SaveState }) {
  // Ninguna rama dice «guardado» sin estarlo: un indicador optimista convierte
  // un fallo de guardado en trabajo perdido que el alumno creía a salvo.
  switch (state.kind) {
    case 'guardado':
      return <span data-save-state="guardado">✓ {CLASE_COPY.save.saved}</span>;
    case 'guardando':
      return <span data-save-state="guardando">… {CLASE_COPY.save.saving}</span>;
    case 'cambios_sin_guardar':
      return <span data-save-state="cambios_sin_guardar">• {CLASE_COPY.save.unsaved}</span>;
    case 'error':
      return (
        <span data-save-state="error">
          ✕ {CLASE_COPY.save.failed} ({state.code})
        </span>
      );
  }
}

function ProbeNotice() {
  // UI-CORR-02: los cuatro puntos son obligatorios, no una selección.
  return (
    <section data-testid="aviso-sonda" aria-label={CLASE_COPY.probe.title}>
      <h2>{CLASE_COPY.probe.title}</h2>
      <ul>
        <li>{CLASE_COPY.probe.hintsDisabled}</li>
        <li>{CLASE_COPY.probe.feedbackSuppressed}</li>
        <li>{CLASE_COPY.probe.agentWithoutAuthority}</li>
        <li>{CLASE_COPY.probe.futureBanksHidden}</li>
      </ul>
    </section>
  );
}

function hintUnavailableText(hints: Extract<HintControl, { available: false }>): string {
  switch (hints.reason) {
    case 'measurement_mode':
      return CLASE_COPY.hints.unavailableMeasurement;
    case 'sin_banco':
      return CLASE_COPY.hints.unavailableNoBank;
    case 'banco_agotado':
      return CLASE_COPY.hints.unavailableExhausted;
    case 'sin_actividad':
      return CLASE_COPY.hints.unavailableNoActivity;
    case 'sesion_pausada':
      return CLASE_COPY.hints.unavailablePaused;
  }
}

function HintControls({ hints }: { readonly hints: HintControl }) {
  if (!hints.available) {
    return (
      <p data-testid="pistas-no-disponibles" data-reason={hints.reason}>
        {hintUnavailableText(hints)}
      </p>
    );
  }
  return (
    <button type="button" data-testid="pedir-pista" data-next-level={hints.nextLevel}>
      {CLASE_COPY.hints.action} ({hints.nextLevel}/{hints.maximumLevel})
    </button>
  );
}

function LocalReviewPanel({ review }: { readonly review: LocalReview }) {
  const notes = [...review.syntax, ...review.structure, ...review.references];
  return (
    <section data-testid="revision-local" data-authoritative={String(review.authoritative)}>
      <h2>{CLASE_COPY.localReview.title}</h2>
      {/* El descargo va siempre, también sin observaciones: es justo el caso en
          el que «no hay nada» se leería como «está bien». */}
      <p data-testid="revision-local-descargo">{CLASE_COPY.localReview.disclaimer}</p>
      {hasLocalNotes(review) ? (
        <ul>
          {notes.map((note, index) => (
            <li key={`${note.code}-${note.line ?? 'doc'}-${index}`} data-code={note.code}>
              {note.line === null ? '' : `Línea ${note.line}: `}
              {note.detail}
            </li>
          ))}
        </ul>
      ) : (
        <p>{CLASE_COPY.localReview.noNotes}</p>
      )}
    </section>
  );
}

function VerdictPanel({ submission }: { readonly submission: SubmissionState }) {
  switch (submission.kind) {
    case 'inactivo':
      return null;
    case 'enviando':
      return <p data-testid="veredicto-pendiente">{CLASE_COPY.verdict.pending}</p>;
    case 'canal_fallido':
      return (
        // No es un veredicto y no se presenta como tal.
        <p data-testid="veredicto-canal-fallido" data-code={submission.failure.code}>
          {CLASE_COPY.verdict.channelFailed}
        </p>
      );
    case 'veredicto': {
      const { verification } = submission.verdict;
      const goalMissed = verification.valid && verification.goalReached === false;
      return (
        <section data-testid="veredicto" data-valid={String(verification.valid)}>
          <p>{verification.valid ? CLASE_COPY.verdict.valid : CLASE_COPY.verdict.invalid}</p>
          {/* D-9: válida y «resuelve el reactivo» son cosas distintas. */}
          {goalMissed ? <p>{CLASE_COPY.verdict.validButGoalNotReached}</p> : null}
          <ul>
            {verification.errors.map((error, index) => (
              <li key={`${error.code}-${index}`} data-code={error.code}>
                {error.line === undefined ? '' : `Línea ${error.line}: `}
                {error.detail ?? error.code}
              </li>
            ))}
          </ul>
        </section>
      );
    }
  }
}

export function ClaseView({
  viewModel,
  localReview,
  submission,
  children,
  syntheticPackage,
}: ClaseViewProps) {
  return (
    <main data-testid="clase" data-mode={viewModel.pedagogicalMode}>
      {/* UIUX §2: los datos ilustrativos se declaran; no se dejan pasar por reales. */}
      {syntheticPackage ? (
        <p data-testid="paquete-sintetico">
          Sesión seca con paquete sintético de desarrollo. No es evidencia experimental.
        </p>
      ) : null}

      <header>
        <span data-testid="estado-primario">{viewModel.primaryState}</span>
        <SaveIndicator state={viewModel.saveState} />
      </header>

      {viewModel.probeNotice === null ? null : <ProbeNotice />}

      {viewModel.activity === null ? (
        <p data-testid="sin-actividad">No hay actividad abierta.</p>
      ) : (
        <section data-testid="actividad" aria-label="Actividad">
          <p>{viewModel.activity.statement}</p>
        </section>
      )}

      {viewModel.rubric === null ? null : (
        <section data-testid="rubrica" aria-label={CLASE_COPY.rubric.title}>
          <h2>{CLASE_COPY.rubric.title}</h2>
          <ul>
            {viewModel.rubric.criteria.map((criterion) => (
              <li key={criterion.criterionId}>{criterion.text}</li>
            ))}
          </ul>
        </section>
      )}

      {/* El Profesor IA es interlocutor visible, no la superficie dominante. */}
      <section data-testid="conversacion" aria-label={CLASE_COPY.transcript.title}>
        <h2>{CLASE_COPY.transcript.title}</h2>
        <ol>
          {viewModel.transcript.map((entry) => (
            <li
              key={entry.entryId}
              data-speaker={entry.speaker}
              data-provenance={entry.provenance.kind}
            >
              {entry.text}
            </li>
          ))}
        </ol>
      </section>

      {viewModel.fitchEditorVisible ? children : null}

      <LocalReviewPanel review={localReview} />
      <VerdictPanel submission={submission} />

      <section aria-label="Controles de sesión">
        <HintControls hints={viewModel.hints} />

        <button type="button" data-testid="pausa" disabled={!viewModel.pause.available}>
          {viewModel.pause.paused ? CLASE_COPY.pause.resumed : CLASE_COPY.pause.action}
        </button>
        <p data-testid="pausa-consecuencia" data-consequence={viewModel.pause.consequence}>
          {viewModel.pause.consequence === 'invalida_el_reactivo_de_sonda_en_curso'
            ? CLASE_COPY.pause.consequenceInvalidatesProbe
            : CLASE_COPY.pause.consequenceNone}
        </p>

        {/* UI-CORR-04: apelación y retirada, con acceso inequívoco. */}
        <button type="button" data-testid="apelacion">
          {CLASE_COPY.appeal.action}
        </button>
        <p data-testid="apelacion-efecto">{CLASE_COPY.appeal.effect}</p>

        <button type="button" data-testid="retirada">
          {CLASE_COPY.withdrawal.action}
        </button>
        <p data-testid="retirada-efecto">{CLASE_COPY.withdrawal.effect}</p>
      </section>
    </main>
  );
}
