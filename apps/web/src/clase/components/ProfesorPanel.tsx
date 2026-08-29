'use client';

import { useState } from 'react';

import { standingLabel, type TurnPort, type TurnState } from '../turn';

/**
 * Panel del Profesor IA (T-H7-01 ← UIUX §3).
 *
 * UIUX §3 pide que el Profesor IA sea «un interlocutor visible sin volver la
 * pantalla un chat». Por eso esto es un panel acotado —una pregunta, una
 * respuesta— y no un hilo que crezca hasta comerse el material.
 *
 * **Cada segmento muestra su situación y sus anclas.** Un alumno tiene que
 * poder distinguir lo que el profesor sostiene sobre el material del curso de
 * lo que dice de acompañamiento, y ésa es exactamente la distinción que P-I
 * §8.5 fija. Pintarlas iguales borraría en pantalla la garantía que el
 * validador de anclaje produce.
 */

export interface ProfesorPanelProps {
  readonly port: TurnPort;
  readonly blockId: string;
  /** El error clasificado del último veredicto, si lo hubo (paso 7 → 2 de W7). */
  readonly structuredError: { readonly code: string; readonly stepNumber: number | null } | null;
}

export function ProfesorPanel({ port, blockId, structuredError }: ProfesorPanelProps) {
  const [pregunta, setPregunta] = useState('');
  const [state, setState] = useState<TurnState>({ kind: 'inactivo' });

  const preguntar = async (): Promise<void> => {
    const goal = pregunta.trim();
    if (goal === '') return;
    setState({ kind: 'preguntando', goal });
    setState(await port.requestTurn({ blockId, goal, structuredError }));
  };

  return (
    // El título no repite «Profesor IA»: así se llama ya la transcripción de
    // arriba (`CLASE_COPY.transcript.title`), y dos secciones con el mismo
    // encabezado dejan al lector sin saber cuál es cuál — y a un lector de
    // pantalla anunciando dos regiones idénticas.
    <section className="card" data-testid="profesor" aria-label="Pregunta al Profesor IA">
      <p className="card-kicker">Profesor IA</p>
      <h2 className="card-title">Pregúntale sobre este bloque</h2>

      {structuredError === null ? null : (
        <p data-testid="profesor-contexto-error">
          El profesor sabe que tu último intento falló con{' '}
          <code>{structuredError.code}</code>
          {structuredError.stepNumber === null
            ? ''
            : ` en la línea ${String(structuredError.stepNumber)}`}
          .
        </p>
      )}

      <label className="field" htmlFor="profesor-pregunta">
        ¿Qué quieres preguntarle?
      </label>
      <textarea
        className="input"
        id="profesor-pregunta"
        data-testid="profesor-pregunta"
        value={pregunta}
        rows={3}
        onChange={(e) => setPregunta(e.target.value)}
      />
      <button
        className="btn btn-primary"
        type="button"
        data-testid="profesor-preguntar"
        disabled={state.kind === 'preguntando' || pregunta.trim() === ''}
        onClick={() => void preguntar()}
      >
        {state.kind === 'preguntando' ? 'Preguntando…' : 'Preguntar al profesor'}
      </button>

      <TurnBody state={state} />
    </section>
  );
}

function TurnBody({ state }: { readonly state: TurnState }) {
  switch (state.kind) {
    case 'inactivo':
      return null;

    case 'preguntando':
      return <p data-testid="profesor-esperando">Consultando el material autorizado…</p>;

    case 'bloqueado':
      // El sistema funcionando, no una avería. Se dice con esas palabras.
      return (
        <div data-testid="profesor-bloqueado" data-code={state.failure.code}>
          <p>El turno no se entregó, y eso es una garantía actuando:</p>
          <p>
            <strong>{state.failure.code}</strong>
          </p>
          <p>{state.failure.detail}</p>
        </div>
      );

    case 'canal_fallido':
      return (
        <div data-testid="profesor-canal-fallido" data-code={state.failure.code}>
          <p>No se pudo hablar con el profesor. Esto es una avería del canal, no una respuesta.</p>
          <p>
            <strong>{state.failure.code}</strong> {state.failure.detail}
          </p>
        </div>
      );

    case 'turno':
      return (
        <div data-testid="profesor-turno">
          <ol data-testid="profesor-segmentos">
            {state.turn.segments.map((segmento, i) => (
              <li
                // El índice es el identificador real del segmento: el orden es
                // lo que el validador devolvió y no hay otro id estable.
                key={`${String(i)}-${segmento.standing}`}
                data-standing={segmento.standing}
              >
                <p>{segmento.text}</p>
                <p data-testid="segmento-situacion">
                  <span
                    className={
                      segmento.standing === 'anchored' ? 'tag tag-accent' : 'tag tag-outline'
                    }
                  >
                    {standingLabel(segmento.standing)}
                  </span>
                  {segmento.anchors.length === 0
                    ? null
                    : segmento.anchors.map((a) => (
                        <span className="tag tag-neutral" key={a}>
                          {a}
                        </span>
                      ))}
                </p>
              </li>
            ))}
          </ol>

          {/* P-I §8.5. Se dice siempre, no sólo cuando es falso: un aviso que
              aparece a veces se lee como excepción, y esto es una propiedad. */}
          <p className="text-muted" data-testid="profesor-fundamenta" data-value={String(state.turn.canGroundEvaluation)}>
            {state.turn.canGroundEvaluation
              ? 'Toda la respuesta está anclada, así que puede fundamentar una calificación.'
              : 'Parte de la respuesta no está anclada, así que no puede fundamentar una calificación.'}
          </p>

          <p className="text-muted" data-testid="profesor-regla">
            Regla de política aplicada: <code>{state.turn.policyRuleId}</code>
          </p>

          {/* UIUX §2: los datos de desarrollo se declaran en pantalla. */}
          {state.turn.packagePurpose === 'test_fixture' ? (
            <p className="text-muted" data-testid="profesor-paquete-dev">
              Paquete de desarrollo, no congelado: W5 no ha corrido. No es evidencia experimental.
            </p>
          ) : null}
        </div>
      );
  }
}
