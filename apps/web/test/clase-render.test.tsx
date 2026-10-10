import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ClaseView } from '../src/clase/components/ClaseView';
import { FitchEditor, NOTATION_PALETTE } from '../src/clase/components/FitchEditor';
import { CLASE_COPY } from '../src/clase/copy';
import { drySessionDocument, drySessionViewInput } from '../src/clase/dry-session';
import { appendLine, initialHistory } from '../src/clase/fitch-document';
import { reviewFitchDocument } from '../src/clase/local-review';
import type { SubmissionState } from '../src/clase/verdict';
import { buildClaseViewModel, type ClaseViewInput } from '../src/clase/view-model';

/**
 * T-H6-13 — la vista se comprueba renderizándola, no solo por su modelo: entre
 * el modelo y la pantalla cabe justo el error que importa, que es enseñar un
 * control que la norma prohíbe.
 */

const REVIEW = reviewFitchDocument(drySessionDocument());

function render(
  input: ClaseViewInput,
  submission: SubmissionState = { kind: 'inactivo' },
  syntheticPackage = true,
): string {
  return renderToStaticMarkup(
    <ClaseView
      viewModel={buildClaseViewModel(input)}
      localReview={REVIEW}
      submission={submission}
      syntheticPackage={syntheticPackage}
    />,
  );
}

function enMedicion(input: ClaseViewInput): ClaseViewInput {
  return {
    ...input,
    session: {
      ...input.session,
      pedagogicalMode: 'MEASUREMENT_MODE',
      selectedStrategy: null,
      assistanceLevel: 0,
      masteryEligibility: false,
    },
    transcript: input.transcript.filter((entry) => entry.actKind === 'practice_statement'),
  };
}

describe('render de la vista de Clase (T-H6-13)', () => {
  it('muestra actividad, rúbrica y conversación de guion', () => {
    const html = render(drySessionViewInput());
    expect(html).toContain('data-testid="actividad"');
    expect(html).toContain('data-testid="rubrica"');
    expect(html).toContain('Cada línea lleva justificación.');
    expect(html).toContain('data-provenance="scripted"');
  });

  it('declara en pantalla que el paquete es sintético (UIUX §2)', () => {
    expect(render(drySessionViewInput())).toContain('data-testid="paquete-sintetico"');
  });

  it('en LEARNING_MODE no aparece el aviso de sonda y sí el botón de pista', () => {
    const html = render(drySessionViewInput());
    expect(html).not.toContain('data-testid="aviso-sonda"');
    expect(html).toContain('data-testid="pedir-pista"');
  });

  it('en MEASUREMENT_MODE aparecen los cuatro puntos de UI-CORR-02', () => {
    const html = render(enMedicion(drySessionViewInput()));
    expect(html).toContain('data-testid="aviso-sonda"');
    for (const texto of [
      CLASE_COPY.probe.hintsDisabled,
      CLASE_COPY.probe.feedbackSuppressed,
      CLASE_COPY.probe.agentWithoutAuthority,
      CLASE_COPY.probe.futureBanksHidden,
    ]) {
      expect(html).toContain(texto);
    }
  });

  it('en MEASUREMENT_MODE no se pinta ningún botón de pista', () => {
    const html = render(enMedicion(drySessionViewInput()));
    expect(html).not.toContain('data-testid="pedir-pista"');
    expect(html).toContain('data-reason="measurement_mode"');
  });

  it('apelación y retirada están en pantalla, y la apelación dice que no hay rescate en vivo', () => {
    const html = render(drySessionViewInput());
    expect(html).toContain('data-testid="apelacion"');
    expect(html).toContain('data-testid="retirada"');
    expect(html).toContain('revisión humana posterior');
    expect(html).toContain('Nadie va a intervenir en vivo');
  });

  it('el estado de guardado se muestra con texto, no solo con señal', () => {
    for (const [state, texto] of [
      [{ kind: 'guardado' as const, atRevision: 1, at: '2026-01-01T10:00:00.000Z' }, CLASE_COPY.save.saved],
      [{ kind: 'guardando' as const }, CLASE_COPY.save.saving],
      [{ kind: 'cambios_sin_guardar' as const }, CLASE_COPY.save.unsaved],
      [{ kind: 'error' as const, code: 'IO', detail: 'x' }, CLASE_COPY.save.failed],
    ] as const) {
      expect(render({ ...drySessionViewInput(), saveState: state }, { kind: 'inactivo' }, false)).toContain(texto);
    }
  });

  it('la demostración no promete un guardado que no existe', () => {
    const html = render(drySessionViewInput());
    expect(html).toContain('Avance sin guardar');
    expect(html).not.toContain('data-save-state="guardado"');
  });

  it('el descargo de la revisión local se muestra también sin observaciones', () => {
    const html = render(drySessionViewInput());
    expect(html).toContain(CLASE_COPY.localReview.disclaimer);
    expect(html).toContain(CLASE_COPY.localReview.noNotes);
    expect(html).toContain('data-authoritative="false"');
  });

  it('un fallo del canal no se presenta como veredicto', () => {
    const html = render(drySessionViewInput(), {
      kind: 'canal_fallido',
      failure: { code: 'VERIFICADOR_SIN_RESPUESTA', detail: 'sin veredicto' },
    });
    expect(html).toContain('data-testid="veredicto-canal-fallido"');
    expect(html).not.toContain('data-testid="veredicto"');
    expect(html).toContain('Tu respuesta no se evaluó');
  });

  it('distingue derivación válida de meta alcanzada (D-9)', () => {
    const html = render(drySessionViewInput(), {
      kind: 'veredicto',
      verdict: {
        submissionId: 'sub1',
        authoritative: true,
        decidedBy: 'verifier',
        verification: {
          valid: true,
          goalReached: false,
          errors: [],
          semanticCheck: 'passed',
          authorizedCalculusVersion: 'authorized-calculus-v1',
          verifierVersion: '0.1.0',
        },
      },
    });
    expect(html).toContain(CLASE_COPY.verdict.valid);
    expect(html).toContain(CLASE_COPY.verdict.validButGoalNotReached);
  });
});

describe('render del editor Fitch (T-H6-13)', () => {
  const conSubprueba = () => {
    let doc = drySessionDocument();
    doc = appendLine(doc, { formula: 'A', rule: 'AS', depth: 1 });
    doc = appendLine(doc, { formula: 'A', rule: 'R', depth: 1 });
    doc = appendLine(doc, { formula: 'A→A', rule: '→I', depth: 0 });
    return doc;
  };

  it('la paleta ofrece símbolos canónicos y ningún alias de entrada', () => {
    const doc = drySessionDocument();
    const html = renderToStaticMarkup(
      <FitchEditor history={initialHistory(doc)} review={reviewFitchDocument(doc)} cursorLineId={null} />,
    );
    for (const symbol of NOTATION_PALETTE) expect(html).toContain(`data-testid="simbolo-${symbol}"`);
    // `->`, `&`, `~` son alias que el tokenizador acepta pero que la paleta no
    // enseña: la evidencia guarda notación canónica.
    for (const alias of ['-&gt;', '&amp;', '~', '/\\']) {
      expect(html).not.toContain(`data-testid="simbolo-${alias}"`);
    }
  });

  it('resalta subpruebas con sangría y además con texto', () => {
    const doc = conSubprueba();
    const html = renderToStaticMarkup(
      <FitchEditor history={initialHistory(doc)} review={reviewFitchDocument(doc)} cursorLineId={null} />,
    );
    expect(html).toContain('data-opens-subproof="true"');
    expect(html).toContain('data-closes-subproof="true"');
    expect(html).toContain('subprueba nivel 1');
    expect(html).toContain('data-annotation-target="fitch-line:1"');
  });

  it('deshacer y rehacer salen deshabilitados sin historial', () => {
    const doc = drySessionDocument();
    const html = renderToStaticMarkup(
      <FitchEditor history={initialHistory(doc)} review={reviewFitchDocument(doc)} cursorLineId={null} />,
    );
    expect(html).toMatch(/data-testid="deshacer"[^>]*disabled/);
    expect(html).toMatch(/data-testid="rehacer"[^>]*disabled/);
  });

  it('muestra el código de la observación local en la línea que la produjo', () => {
    const doc = appendLine(drySessionDocument(), { formula: 'A∧', rule: 'R', depth: 0 });
    const html = renderToStaticMarkup(
      <FitchEditor history={initialHistory(doc)} review={reviewFitchDocument(doc)} cursorLineId={null} />,
    );
    expect(html).toContain('E-SYN-PARSE');
  });
});
