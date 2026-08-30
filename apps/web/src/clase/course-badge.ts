import type { CourseType } from '@profesor-ia/contracts';

/**
 * Etiquetado de carril y separación de estados
 * (T-CC-05 ← UIUX §6.2, UI-CORR-01, P-I §3.1.2).
 *
 * ## Las dos maneras de mentir con una etiqueta, y son opuestas
 *
 * La primera es la obvia: que una materia personalizada parezca validada. UIUX
 * §6.2 la nombra —«la etiqueta visible no puede afirmar que un curso ya produjo
 * validación experimental si H11 y sus veredictos no lo han demostrado»—, y
 * ocurriría sola en cuanto alguien reutilizara para el carril funcional el
 * mismo distintivo verde del curso de lógica.
 *
 * La segunda es la que se olvida: que una materia personalizada parezca
 * **rota**. P-I §3.1.2 pide mostrar la diferencia «sin presentar el modo
 * personalizado como defectuoso: es funcionalmente útil, pero metodológicamente
 * no validado por este experimento». Un icono de aviso amarillo junto a cada
 * materia del usuario dice, sin escribirlo, que el sistema desconfía de lo que
 * el propio usuario pidió aprender.
 *
 * Por eso {@link CourseBadge} no tiene tono de severidad. Tiene `track`, que
 * dice **a qué carril pertenece**, y la UI le da forma sin ordenarlos.
 *
 * ## UI-CORR-01: tres estados, tres huecos
 *
 * «No usar benchmarks técnicos como equivalente de validación experimental del
 * aprendizaje.» El defecto concreto es un solo indicador de «estado» que un día
 * enseña el resultado de BENCH-01 y al siguiente parece decir que el curso
 * funciona pedagógicamente. {@link CourseStatusPanel} los separa en tres campos
 * distintos, y el experimental **es `null` mientras no existan veredictos de
 * H11** — que hoy es siempre.
 */

export interface CourseBadge {
  /** Texto visible. Nombra el carril, no su calidad. */
  readonly label: string;
  readonly track: CourseType;
  /** Frase que la vista muestra al lado o en el tooltip. Obligatoria. */
  readonly explanation: string;
}

const INSIGNIAS: Readonly<Record<CourseType, CourseBadge>> = Object.freeze({
  VALIDATED_LOGIC_COURSE: {
    label: 'Curso experimental de lógica',
    track: 'VALIDATED_LOGIC_COURSE',
    // Nombra qué es, no que haya salido bien: el resultado experimental es otro
    // hueco, y hoy no existe.
    explanation:
      'Es la materia del experimento: sigue el cálculo autorizado y su corpus congelado.',
  },
  CUSTOM_COURSE_UNVALIDATED: {
    label: 'Materia propia',
    track: 'CUSTOM_COURSE_UNVALIDATED',
    explanation:
      'Funciona igual para estudiar, pero no está validada por el experimento de lógica: ' +
      'lo que pase aquí no cuenta como resultado experimental.',
  },
});

/** La insignia de un carril. Total: los dos tienen una. */
export function courseBadge(courseType: CourseType): CourseBadge {
  return INSIGNIAS[courseType];
}

/**
 * Palabras que la etiqueta de una materia propia no puede llevar.
 *
 * No es una lista de estilo: son los términos que afirmarían validación
 * experimental. Se comprueba en prueba, porque el día que alguien reescriba el
 * copy «para que suene mejor» es cuando entra «verificado».
 */
export const TERMINOS_QUE_AFIRMAN_VALIDACION = [
  'validad',
  'verificad',
  'certificad',
  'comprobad',
  'demostrad',
] as const;

/** Palabras que la harían parecer defectuosa. La otra mitad del error. */
export const TERMINOS_QUE_DEGRADAN = [
  'defectuos',
  'incompleto',
  'no fiable',
  'limitado',
  'experimental sin',
] as const;

/**
 * Los tres estados de UI-CORR-01, separados.
 *
 * `experimental` es `null` mientras H11 no haya producido veredictos. No es
 * opcional sino explícitamente nulo, porque ausente diría «no se consultó» y
 * esto dice «no lo hay»: la diferencia importa cuando alguien mire la pantalla
 * buscando si el experimento ya concluyó.
 */
export interface CourseStatusPanel {
  /** Estado del paquete técnico: construido, congelado, con qué versión. */
  readonly technicalPackage: string;
  /** Auditoría y benchmarks. **No** es validación del aprendizaje. */
  readonly auditBenchmark: string;
  /** Resultados experimentales H11. `null` mientras no existan. */
  readonly experimental: string | null;
}

export class CourseLabelError extends Error {
  readonly code: 'RESULTADO_EXPERIMENTAL_SIN_VEREDICTOS';

  constructor(detail: string) {
    super(detail);
    this.name = 'CourseLabelError';
    this.code = 'RESULTADO_EXPERIMENTAL_SIN_VEREDICTOS';
  }
}

/**
 * Arma el panel. **Lanza** si se intenta mostrar resultado experimental sin
 * veredictos de H11.
 *
 * El punto de fallo está aquí y no en la revisión de copy porque el error no se
 * comete escribiendo: se comete el día que alguien enchufa el resultado de un
 * benchmark técnico a este hueco porque es el único que había.
 */
export function courseStatusPanel(input: {
  readonly technicalPackage: string;
  readonly auditBenchmark: string;
  readonly experimental?: string;
  readonly h11VerdictsExist: boolean;
}): CourseStatusPanel {
  if (input.experimental !== undefined && !input.h11VerdictsExist) {
    throw new CourseLabelError(
      'No se puede mostrar resultado experimental sin veredictos de H11 (UIUX §6.2, UI-CORR-01). ' +
        'Un benchmark técnico enchufado a este hueco se leería como validación del aprendizaje, ' +
        'que es exactamente lo que UI-CORR-01 separa.',
    );
  }
  return {
    technicalPackage: input.technicalPackage,
    auditBenchmark: input.auditBenchmark,
    experimental: input.h11VerdictsExist ? (input.experimental ?? null) : null,
  };
}
