/**
 * Textos de la vista de Clase (T-H6-13).
 *
 * Viven en un solo archivo y **cada uno cita el punto de norma que lo exige**.
 * No es orden: un texto de interfaz que dice de más —o de menos— sobre lo que el
 * sistema hace es una afirmación al participante, y en una corrida con sujeto
 * humano eso forma parte de la evidencia. Un auditor tiene que poder ir de la
 * pantalla a la línea del Maestro sin leer componentes.
 */

export const CLASE_COPY = {
  /** UI-CORR-02: «se muestra aviso comprensible de modo sonda». */
  probe: {
    title: 'Estás en una sonda de medición',
    /** UI-CORR-02: «pistas quedan deshabilitadas». */
    hintsDisabled: 'Las pistas están deshabilitadas mientras dure la sonda.',
    /** UI-CORR-02: «no hay feedback pedagógico durante la sonda». */
    feedbackSuppressed: 'No vas a recibir explicaciones ni correcciones durante la sonda.',
    /**
     * UI-CORR-02: «el agente pedagógico no adquiere autoridad sobre
     * selección/tiempo/consumo».
     */
    agentWithoutAuthority:
      'El Profesor IA no elige el reactivo, no controla el tiempo y no decide si cuenta: eso lo ' +
      'lleva el componente de medición.',
    /** UI-CORR-02: «no se muestran bancos futuros ni soluciones». */
    futureBanksHidden: 'No se muestran reactivos siguientes ni soluciones.',
  },

  /**
   * Consecuencia literal de la política congelada de medición (T-H6-08): la
   * pausa pre-ítem no consume; la post-ítem conserva el consumo y deriva
   * `invalid_participant_pause`. Se dice porque callarlo dejaría al participante
   * perder un reactivo sin haber podido saberlo.
   */
  pause: {
    action: 'Pausar',
    resumed: 'Sesión en pausa',
    consequenceNone: 'Puedes retomar donde lo dejaste.',
    consequenceInvalidatesProbe:
      'Ya viste el reactivo: si pausas ahora, esta respuesta quedará registrada como no válida y ' +
      'no se repone.',
  },

  /** UI-CORR-04: apelación registra revisión humana **posterior**, nunca en vivo. */
  appeal: {
    action: 'No estoy de acuerdo',
    effect:
      'Queda registrada tu apelación para revisión humana posterior. Nadie va a intervenir en ' +
      'vivo para decidir si avanzas.',
  },

  /** UI-CORR-04: acceso inequívoco a detener la participación. */
  withdrawal: {
    action: 'Detener mi participación',
    effect: 'Detiene tu participación. Puedes hacerlo en cualquier momento.',
  },

  /**
   * P-I §8.9: la validación del editor es local y **no autoritativa**. El texto
   * tiene que decirlo, o «sin observaciones» se lee como «está bien».
   */
  localReview: {
    title: 'Revisión local',
    disclaimer:
      'Esta revisión sólo comprueba que lo escrito se pueda leer y que la estructura sea ' +
      'coherente. No dice si tu derivación es correcta: eso lo decide el verificador al enviar.',
    noNotes: 'Sin observaciones de lectura. Todavía no se ha verificado nada.',
  },

  verdict: {
    submit: 'Enviar al verificador',
    pending: 'Enviando al verificador…',
    /** El fallo del canal no es un veredicto (D-12, I-3). */
    channelFailed:
      'No se pudo obtener el veredicto del verificador. Tu respuesta no se evaluó; vuelve a ' +
      'enviarla.',
    valid: 'El verificador aceptó la derivación.',
    invalid: 'El verificador rechazó la derivación.',
    /** D-9: válida y no resuelve el reactivo son cosas distintas. */
    validButGoalNotReached:
      'La derivación es válida, pero su última línea no es la meta pedida.',
  },

  /** Estado de guardado; ninguna rama puede decir «guardado» sin estarlo. */
  save: {
    saved: 'Guardado',
    saving: 'Guardando…',
    unsaved: 'Cambios sin guardar',
    failed: 'No se pudo guardar',
  },

  hints: {
    action: 'Pedir pista',
    unavailableMeasurement: 'No disponible durante la sonda.',
    unavailableNoBank: 'Este reactivo no tiene banco de pistas.',
    unavailableExhausted: 'Ya usaste todos los niveles de pista de este reactivo.',
    unavailableNoActivity: 'No hay actividad abierta.',
    unavailablePaused: 'La sesión está en pausa.',
  },

  rubric: { title: 'Rúbrica' },
  editor: { title: 'Derivación', export: 'Exportar', undo: 'Deshacer', redo: 'Rehacer' },
  transcript: { title: 'Profesor IA' },

  /** UIUX §6.5: «pizarrón cuando `whiteboard` esté habilitado». */
  board: {
    title: 'Pizarrón',
    loading: 'Cargando el pizarrón…',
    /**
     * P-I §8.9 y DEC-VISION-001: el pizarrón es superficie de trabajo, no de
     * dictamen. Decirlo evita que el alumno lea un trazo aprobado como una
     * derivación aceptada.
     */
    notice:
      'Lo que dibujes aquí acompaña tu trabajo: no lo califica el verificador. El veredicto sale ' +
      'de la derivación que envíes.',
    /** El trazo que el contrato no sabe registrar se dice; no se traga. */
    unsupported:
      'Esa herramienta no se está registrando como parte de tu trabajo, así que no quedará en la ' +
      'evidencia de la sesión:',
    /**
     * WCAG 1.1.1 y §10.5: el lienzo es un `<canvas>` y no tiene contenido que un
     * lector de pantalla pueda recorrer. Esta lista es su equivalente, y se
     * puede escribir porque `BoardScene` ya guarda qué hay y de quién.
     */
    /**
     * WCAG 2.5.7: alternativa sin arrastre. El trazo a mano alzada queda fuera
     * porque ahí el arrastre **es** esencial y el criterio lo exceptúa; colocar
     * una forma o un texto no lo es, y por eso tiene botón.
     */
    noDragHelp:
      'Puedes colocar elementos sin arrastrar: se añaden en el centro de lo que estás viendo y ' +
      'luego los mueves si quieres.',
    insert: {
      rectangle: 'Añadir un rectángulo',
      ellipse: 'Añadir una elipse',
      arrow: 'Añadir una flecha',
      text: 'Añadir el texto',
      textLabel: '¿Qué texto quieres añadir?',
    },
    sceneLabel: 'Lo que hay en el pizarrón',
    sceneEmpty: 'El pizarrón está vacío.',
    actorStudent: 'ti',
    actorProfessor: 'el Profesor IA',
    /** Los nombres de `BOARD_ELEMENT_KINDS`, en la lengua del alumno. */
    kinds: {
      text: 'Un texto',
      freedraw: 'Un trazo a mano alzada',
      arrow: 'Una flecha',
      shape: 'Una forma',
      image: 'Una imagen',
    },
  },

  /** UIUX §6.5: «voz cuando `voiceInput` / `voiceOutput` estén habilitados». */
  voice: {
    title: 'Voz del Profesor IA',
    speak: 'Escuchar la explicación',
    stop: 'Detener',
    /** P-I §8.10: la voz va al final; lo retenido por el filtro no suena. */
    notice: 'Se lee en voz alta la misma explicación que ves escrita.',
    unavailable: 'Este navegador no ofrece síntesis de voz. La explicación sigue disponible por escrito.',
    /**
     * `degradeToText()`: una caída del TTS es presentación, no decisión. El
     * texto sale íntegro, y se dice que no cambió nada.
     */
    degraded:
      'No se pudo reproducir el audio. La explicación es la misma y no ha cambiado: la tienes ' +
      'completa por escrito.',
    /** Un turno íntegramente retenido no produce locución, y se distingue. */
    nothingToSay: 'No hay nada que reproducir de este turno.',
  },
} as const;
