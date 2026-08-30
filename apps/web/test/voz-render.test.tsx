import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ClaseView } from '../src/clase/components/ClaseView';
import { VozProfesor } from '../src/clase/components/VozProfesor';
import { CLASE_COPY } from '../src/clase/copy';
import { drySessionDocument, drySessionViewInput } from '../src/clase/dry-session';
import { reviewFitchDocument } from '../src/clase/local-review';
import type { ProfessorTurn, TurnSegment } from '../src/clase/turn';
import { buildClaseViewModel, type ClaseViewInput } from '../src/clase/view-model';

/**
 * T-H8-02 y T-H8-03 en pantalla.
 *
 * El modelo ya está probado aparte (`speech.test.ts`, `board-scene.test.ts`).
 * Aquí se comprueba lo que entre el modelo y la pantalla se puede perder: que la
 * superficie **aparece** cuando la capacidad está encendida y **no aparece**
 * cuando no lo está. Un flag en `true` con la superficie sin pintar es
 * exactamente lo que `assertCapabilitiesImplemented` existe para impedir, y esta
 * prueba es su mitad visual.
 */

const REVIEW = reviewFitchDocument(drySessionDocument());

function turno(segments: readonly TurnSegment[]): ProfessorTurn {
  return {
    outcome: 'entregado',
    stoppedAt: 'fin',
    segments,
    canGroundEvaluation: true,
    attempts: 1,
    policyRuleId: 'PP-01',
    packagePurpose: 'test_fixture',
  };
}

const ANCLADO: TurnSegment = {
  text: 'De una conjunción puedes concluir cualquiera de sus miembros.',
  standing: 'anchored',
  anchors: ['F-1a2b3c4d'],
};

function renderClase(input: ClaseViewInput, board = <p data-testid="pizarron" />): string {
  return renderToStaticMarkup(
    <ClaseView
      viewModel={buildClaseViewModel(input)}
      localReview={REVIEW}
      submission={{ kind: 'inactivo' }}
      syntheticPackage
      board={board}
    />,
  );
}

describe('T-H8-03 — el pizarrón aparece con su capacidad, y sólo con ella', () => {
  it('con `whiteboard` encendido y actividad, se monta', () => {
    const html = renderClase(drySessionViewInput());
    expect(html).toContain('data-testid="pizarron"');
  });

  it('con `whiteboard` apagado NO se monta, aunque le pasen el nodo', () => {
    // La vista no pinta lo que le den: pinta lo que el modelo autoriza. Si
    // bastara con pasar el nodo, apagar la capacidad dejaría el pizarrón puesto.
    const input = drySessionViewInput();
    const html = renderClase({
      ...input,
      capabilities: { ...input.capabilities, whiteboard: false },
    });
    expect(html).not.toContain('data-testid="pizarron"');
  });

  it('sin actividad NO se monta: no habría referencia que darle al trazo', () => {
    // `BoardElement` exige `activityId` y `kcId`. Un pizarrón sin actividad
    // produciría elementos que no se relacionan con nada de la sesión.
    const input = drySessionViewInput();
    const html = renderClase({ ...input, activity: null });
    expect(html).not.toContain('data-testid="pizarron"');
  });

  it('el material va antes que el acompañamiento en el orden de lectura', () => {
    // UIUX §3: el material es la superficie protagonista. En una pantalla
    // estrecha las columnas se apilan y el orden del DOM **es** el de lectura,
    // así que la rúbrica y el interlocutor no pueden quedar por delante.
    const html = renderClase(drySessionViewInput());
    expect(html.indexOf('data-testid="actividad"')).toBeLessThan(
      html.indexOf('data-testid="rubrica"'),
    );
    expect(html.indexOf('data-testid="actividad"')).toBeLessThan(
      html.indexOf('data-testid="conversacion"'),
    );
  });
});

describe('T-H8-02 — la voz en pantalla', () => {
  it('ofrece el control de escucha con su aviso', () => {
    const html = renderToStaticMarkup(<VozProfesor turn={turno([ANCLADO])} synthesis={null} />);
    expect(html).toContain('data-testid="voz-profesor"');
    expect(html).toContain(CLASE_COPY.voice.speak);
    expect(html).toContain(CLASE_COPY.voice.notice);
  });

  it('el aviso dice que se lee lo mismo que está escrito, no algo aparte', () => {
    // Si la voz pareciera un canal con contenido propio, el alumno podría creer
    // que escuchando obtiene algo que leyendo no.
    expect(CLASE_COPY.voice.notice).toContain('la misma explicación');
  });

  it('el texto de degradación dice que la explicación NO cambió', () => {
    // `degradeToText()` devuelve `decisionChanged: false`, y la pantalla tiene
    // que decirlo con palabras: el alumno debe poder distinguir «el profesor se
    // calló» de «el profesor cambió de idea».
    expect(CLASE_COPY.voice.degraded).toContain('no ha cambiado');
  });
});
