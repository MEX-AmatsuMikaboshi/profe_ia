/**
 * Textos de las cuatro vistas de materia (T-CC-05).
 *
 * Mismo criterio que `clase/copy.ts`: viven en un solo archivo y cada uno cita
 * el punto de norma que lo exige. Aquí pesa además `P-I §3.1.2` —«sin presentar
 * el modo personalizado como defectuoso»—, así que hay prueba de que ninguno de
 * estos textos afirma validación ni degrada.
 */

export const MATERIAS_COPY = {
  /** §6.1: Inicio responde «dónde se quedó el usuario y qué debe hacer». */
  inicio: {
    title: 'Inicio',
    activeHeading: 'Donde te quedaste',
    /** `resumePoint !== null`: hay un punto real de retorno. */
    continueAction: 'Continuar clase',
    /** `resumePoint === null`: nunca se abrió. Decir «continuar» sería mentir. */
    startAction: 'Empezar la primera clase',
    noActive: 'Todavía no has abierto ninguna materia.',
    enCursoHeading: 'Materias en curso',
    enPreparacionHeading: 'Materias en preparación',
    reviewsHeading: 'Próximos repasos',
    /**
     * §6.1 los pide «cuando el motor los haya programado». Vacío significa que
     * no programó ninguno, no que no haya nada que repasar.
     */
    noReviews: 'El motor no ha programado ningún repaso todavía.',
    costHeading: 'Consumo registrado',
    /**
     * §6.1: coste «cuando exista en `cost-ledger`». Un 0,00 con el ledger vacío
     * afirmaría que no se ha gastado nada, que no es lo mismo que no saberlo.
     */
    noCost: 'No hay consumo registrado en el ledger todavía.',
    capabilitiesHeading: 'Capacidades y proveedor',
  },

  /** §6.2: distinguir estructuralmente los dos carriles. */
  misMaterias: {
    title: 'Mis materias',
    validadoHeading: 'Curso del experimento',
    personalizadasHeading: 'Tus materias',
    empty: 'Aún no has creado ninguna materia propia.',
    /** UI-CORR-01: los tres estados van separados, y se nombran. */
    statusTechnical: 'Paquete técnico',
    statusAudit: 'Auditoría y benchmarks',
    statusExperimental: 'Resultado experimental',
    /**
     * El hueco experimental es `null` mientras H11 no produzca veredictos.
     * Se dice con estas palabras porque un guion suelto se lee como «cero».
     */
    noExperimental: 'Todavía no hay resultado experimental: H11 no ha concluido.',
  },

  /** §6.4: estructura, progreso, historial, próxima actividad, preparación. */
  detalle: {
    outlineHeading: 'Unidades y temas',
    historyHeading: 'Historial de sesiones',
    noHistory: 'Todavía no hay sesiones registradas en esta materia.',
    preparationHeading: 'Preparación en curso',
    /**
     * Prosa para los artefactos de `PREPARATION_ARTIFACTS`.
     *
     * El identificador crudo —`sources_found`— es vocabulario interno, y ya
     * mordió una vez en el descargo de Progreso. Un artefacto es justo lo que el
     * usuario mira para saber si el proceso sigue vivo (`T-CC-02`): enseñárselo
     * en jerga le pide que confíe en algo que no puede leer.
     */
    artifacts: {
      sources_found: 'Fuentes encontradas',
      course_proposal: 'Propuesta de curso',
    },
    retryAction: 'Reintentar',
    /**
     * `no_sources_found` no es reintentable (T-CC-02): repetir la búsqueda con
     * el mismo sobre daría el mismo vacío. Se explica en vez de esconder el
     * botón sin más, que se leería como que el sistema se rindió.
     */
    notRetryable: 'Reintentar con lo mismo daría el mismo resultado. Añade o cambia lo que pediste.',
  },

  /** §6.6: estados comprensibles, sin porcentajes de retención estimada. */
  progreso: {
    title: 'Progreso',
    /**
     * Los cuatro rótulos. Los tres primeros traducen uno a uno los miembros de
     * `masteryStatus`; `pendiente` es **no tener estado**.
     */
    states: {
      dominado: 'Dominado',
      en_aprendizaje: 'En aprendizaje',
      /**
       * No se funde con «en aprendizaje»: el dominio llegó a declararse y falló
       * al reconfirmarse, y esconderlo le quita al alumno la única señal de que
       * conviene volver sobre algo que ya daba por sabido.
       */
      reconfirmacion_fallida: 'Reconfirmación fallida',
      pendiente: 'Sin empezar',
    },
    countsHeading: 'Estado por unidad de conocimiento',
    retentionHeading: 'Retención',
    /**
     * §6.6: «retención medida cuando exista». `retention_not_evaluated` es una
     * declaración preinscrita, no un hueco: se dice tal cual.
     */
    retentionNotEvaluated: 'La retención no se evaluó en esta corrida.',
    /**
     * P-I §3.1.2 y T-CC-04: sin autoridad de evaluación no hay declaración de
     * dominio.
     *
     * **Sin nuestra jerga.** La primera redacción decía «no tiene verificador
     * determinista». Lo destapó la prueba de términos —«verificad» está en la
     * lista que afirma validación— y al mirarlo el problema era mayor que el
     * disparo: es vocabulario interno en la pantalla del alumno, y enunciado
     * como carencia. Dice lo mismo diciendo primero qué sí hay.
     */
    noAuthority:
      'Aquí verás lo que has trabajado y cuándo. El estado por unidad es propio del curso de ' +
      'lógica, donde cada paso se contrasta con un cálculo formal; en esta materia no existe ese ' +
      'contraste, así que nadie declara unidades dominadas.',
  },
} as const;

/**
 * El descargo de la rama sin autoridad, en un solo sitio.
 *
 * Se exporta aparte porque el modelo de vista lo recibe como dato: la capa que
 * decide **qué** se puede afirmar no debería además redactar la frase, y tenerlo
 * aquí es lo que permite que la prueba de términos lo alcance.
 */
export function progresoDisclaimer(): string {
  return MATERIAS_COPY.progreso.noAuthority;
}
