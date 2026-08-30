import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  TERMINOS_QUE_AFIRMAN_VALIDACION,
  TERMINOS_QUE_DEGRADAN,
} from '../src/clase/course-badge';
import { DatosIlustrativos } from '../src/materias/components/DatosIlustrativos';
import { DetalleView } from '../src/materias/components/DetalleView';
import { InicioView } from '../src/materias/components/InicioView';
import { MisMateriasView } from '../src/materias/components/MisMateriasView';
import { ProgresoView } from '../src/materias/components/ProgresoView';
import { MATERIAS_COPY } from '../src/materias/copy';
import { detalleDemo, inicioDemo, misMateriasDemo, progresoDemo } from '../src/materias/demo-data';

/**
 * T-CC-05 — las cuatro vistas se comprueban renderizándolas.
 *
 * Entre el modelo y la pantalla cabe justo el error que importa: que un valor
 * ausente se pinte como un cero, o que la materia propia salga con cara de rota.
 * Ninguna de las dos cosas la ve una prueba del modelo.
 */

const INICIO = renderToStaticMarkup(<InicioView viewModel={inicioDemo()} />);
const MIS_MATERIAS = renderToStaticMarkup(<MisMateriasView viewModel={misMateriasDemo()} />);
const DETALLE_LOGICA = renderToStaticMarkup(<DetalleView viewModel={detalleDemo('logica')} />);
const DETALLE_PROPIA = renderToStaticMarkup(
  <DetalleView viewModel={detalleDemo('revolucion-mexicana')} />,
);
const PROGRESO_LOGICA = renderToStaticMarkup(<ProgresoView viewModel={progresoDemo('logica')} />);
const PROGRESO_PROPIA = renderToStaticMarkup(
  <ProgresoView viewModel={progresoDemo('revolucion-mexicana')} />,
);
const TODAS = [INICIO, MIS_MATERIAS, DETALLE_LOGICA, DETALLE_PROPIA, PROGRESO_LOGICA, PROGRESO_PROPIA];

describe('Inicio (UIUX §6.1)', () => {
  it('lleva a la clase por el punto de retorno cuando lo hay', () => {
    expect(INICIO).toContain('data-action="continuar"');
    expect(INICIO).toContain('data-resume-point="kc-13/actividad-2"');
    expect(INICIO).toContain('href="/materias/logica/clase"');
  });

  it('dice que no hay repasos ni consumo, en vez de enseñar listas vacías o ceros', () => {
    expect(INICIO).toContain(MATERIAS_COPY.inicio.noReviews);
    expect(INICIO).toContain(MATERIAS_COPY.inicio.noCost);
    // La comprobación que importa: en ninguna parte aparece una cifra de gasto.
    expect(INICIO).not.toMatch(/0[.,]00/);
  });

  it('la materia en preparación no ofrece clase', () => {
    expect(INICIO).toContain('data-action="ver-preparacion"');
    expect(INICIO).not.toContain('href="/materias/revolucion-mexicana/clase"');
  });
});

describe('Mis materias (UIUX §6.2, UI-CORR-01)', () => {
  it('los dos carriles se pintan en secciones distintas', () => {
    expect(MIS_MATERIAS).toContain('data-testid="carril-validado"');
    expect(MIS_MATERIAS).toContain('data-testid="carril-personalizado"');
  });

  it('los tres estados de UI-CORR-01 son tres campos, no un indicador', () => {
    expect(MIS_MATERIAS).toContain('data-estado="tecnico"');
    expect(MIS_MATERIAS).toContain('data-estado="auditoria"');
    expect(MIS_MATERIAS).toContain('data-estado="experimental"');
  });

  it('el hueco experimental dice por qué está vacío y no enseña un guion', () => {
    expect(MIS_MATERIAS).toContain(MATERIAS_COPY.misMaterias.noExperimental);
  });
});

describe('Progreso (UIUX §6.6, T-CC-04)', () => {
  it('el curso con verificador enseña recuentos, no porcentajes', () => {
    expect(PROGRESO_LOGICA).toContain('data-autoridad="con_autoridad_de_dominio"');
    expect(PROGRESO_LOGICA).toContain('data-recuento="dominado"');
    // Ni un solo porcentaje en toda la pantalla.
    expect(PROGRESO_LOGICA).not.toContain('%');
  });

  it('la reconfirmación fallida se ve, con su rótulo propio', () => {
    expect(PROGRESO_LOGICA).toContain('data-estado="reconfirmacion_fallida"');
    expect(PROGRESO_LOGICA).toContain(MATERIAS_COPY.progreso.states.reconfirmacion_fallida);
  });

  it('la materia propia no enseña recuentos de dominio, y dice por qué', () => {
    expect(PROGRESO_PROPIA).toContain('data-autoridad="sin_autoridad_de_dominio"');
    expect(PROGRESO_PROPIA).not.toContain('data-recuento=');
    expect(PROGRESO_PROPIA).not.toContain('data-testid="kcs"');
    expect(PROGRESO_PROPIA).toContain(MATERIAS_COPY.progreso.noAuthority);
  });

  it('la retención se declara no evaluada con su código', () => {
    expect(PROGRESO_LOGICA).toContain('data-codigo="retention_not_evaluated"');
    expect(PROGRESO_LOGICA).toContain(MATERIAS_COPY.progreso.retentionNotEvaluated);
  });
});

describe('Detalle (UIUX §6.4)', () => {
  it('la materia en preparación enseña estado, artefactos y la promesa de fondo', () => {
    expect(DETALLE_PROPIA).toContain('data-testid="preparacion"');
    expect(DETALLE_PROPIA).toContain('data-artefacto="sources_found"');
    expect(DETALLE_PROPIA).toContain('data-testid="promesa-de-fondo"');
  });

  it('la promesa de fondo es la modesta de PLAN-UX-001', () => {
    expect(DETALLE_PROPIA).toContain('mientras el entorno local esté encendido');
    expect(DETALLE_PROPIA).not.toContain('en la nube');
  });

  it('el curso creado no arrastra la pantalla de preparación', () => {
    expect(DETALLE_LOGICA).not.toContain('data-testid="preparacion"');
  });
});

describe('lo que ninguna de las cuatro puede decir', () => {
  /**
   * Las dos mitades de `T-CC-05`, comprobadas sobre el HTML y no sobre el
   * modelo: una materia propia no puede parecer validada **ni parecer rota**.
   */
  it('ninguna pantalla afirma validación experimental de la materia propia', () => {
    // Mismo criterio que `course-badge.test.ts`: el término **negado** es lo
    // contrario de afirmarlo, y la frase que la norma exige —«no está validada
    // por el experimento de lógica»— lo contiene por fuerza. Prohibirlo a secas
    // haría fallar la prueba justo cuando el texto dice lo correcto.
    for (const html of [DETALLE_PROPIA, PROGRESO_PROPIA]) {
      const texto = html.toLowerCase();
      for (const termino of TERMINOS_QUE_AFIRMAN_VALIDACION) {
        const afirma = texto.includes(termino) && !texto.includes(`no está ${termino}`);
        expect(afirma, `«${termino}» afirmando validación en una materia propia`).toBe(false);
      }
    }
  });

  it('ninguna pantalla degrada la materia propia', () => {
    const propias = [MIS_MATERIAS, DETALLE_PROPIA, PROGRESO_PROPIA];
    for (const html of propias) {
      for (const termino of TERMINOS_QUE_DEGRADAN) {
        expect(html.toLowerCase()).not.toContain(termino);
      }
    }
  });

  it('el estado se comunica con texto, no sólo con posición o color', () => {
    // UIUX §3. Cada fila de KC lleva su rótulo escrito al lado del identificador.
    for (const estado of ['dominado', 'en_aprendizaje', 'pendiente'] as const) {
      expect(PROGRESO_LOGICA).toContain(MATERIAS_COPY.progreso.states[estado]);
    }
  });

  it('ningún control lleva `.btn` a secas: sin variante no se ve como control', () => {
    // El sistema vendorizado da a `.btn` fondo y borde transparentes; la
    // apariencia la pone la variante. «Continuar clase» salió como texto en
    // negrita en la primera versión —clicable, del tamaño correcto y sin
    // parecer un control—, y UIUX §3 pide una acción primaria **dominante**.
    // No lo ve ninguna prueba sin navegador ni `ci:a11y:baseline`, que audita
    // sólo Clase; se vio abriendo la demo. Esto es lo que impide que vuelva.
    for (const html of TODAS) {
      expect(html, 'hay un class="btn" sin variante').not.toMatch(/class="btn"/);
    }
    // Y con su control positivo: si nada llevara `.btn`, lo de arriba pasaría
    // por vacío.
    expect(INICIO).toContain('class="btn btn-primary"');
  });

  it('cada vista tiene un solo h1 y todas sus secciones etiquetadas', () => {
    for (const html of TODAS) {
      expect(html.match(/<h1/g) ?? []).toHaveLength(1);
      const secciones = html.match(/<section/g) ?? [];
      const etiquetadas = html.match(/<section[^>]*aria-label=/g) ?? [];
      const conTestid = html.match(/<section[^>]*data-testid=/g) ?? [];
      expect(etiquetadas.length + conTestid.length).toBeGreaterThanOrEqual(secciones.length);
    }
  });
});

describe('datos ilustrativos (UIUX §2)', () => {
  it('la declaración existe y dice que nada de esto es una medida', () => {
    const html = renderToStaticMarkup(<DatosIlustrativos />);
    expect(html).toContain('data-testid="datos-ilustrativos"');
    expect(html).toContain('Nada de esto es una medida');
  });
});
