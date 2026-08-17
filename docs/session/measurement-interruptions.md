# Interrupciones durante medición — T-H6-08

Implementación de `Plan.md` `T-H6-08`, P-II §7.1.1 y `DEC-MEAS-INTERRUPTION-001` en
`apps/measurement-worker/src/authority.ts`, con contrato público en
`packages/contracts/src/probe-interruption.ts` y proyección reconstruible en `session-engine`.

## Autoridad y estado

La política `measurement-authority-policy-v2` congela las ocho semánticas de interrupción, la
política de reason codes y una taxonomía explícita `incidentCode + level + validityEffect`. Una
corrida material sigue exigiendo el hash externo de esa política; los códigos usados en pruebas son
`test_fixture` y no afirman una taxonomía, manifiesto ni gate material.

El snapshot `measurement-state-v2` añade `runDisposition`, pausa activa y efectos de control. Cada
efecto conserva corrida, seudónimo, oportunidad, ítem si fue mostrado, tiempo, razón, cierre,
disposición de reposición y tres negativos literales: no hubo feedback inmediato, respuesta
pedagógica ni extensión del reloj. El ítem se consume al entregarse; por eso una interrupción
posterior declara `itemConsumedByEffect=false` pero conserva el consumo previo.

El evento ordinario `measurement.item.outcome_observed` sólo admite una puntuación. No acepta un
`reasonCode` suministrado por la sesión: los códigos de control se derivan exclusivamente de estos
eventos tipados.

## Transiciones

- `measurement.pause.requested` deriva la etapa desde el estado. Sin ítem pendiente crea
  `pre_item_pause`, no selecciona ni consume. Con ítem mostrado crea `post_item_pause`, conserva el
  consumo, registra `invalid_participant_pause`, no da feedback y sólo permite una reposición
  independiente si el calendario la autoriza. Ninguna entrega ocurre hasta una
  `measurement.pause.resumed` enlazada a la pausa activa.
- `measurement.content_question.recorded` sólo admite `none` o `rights_or_procedure`. El deadline
  antes y después es el mismo y el contrato excluye cualquier respuesta pedagógica.
- `measurement.probe.timeout` se acepta únicamente al alcanzar el deadline derivado de
  `selectedAt + timeLimitSeconds`; registra el contrato de rúbrica congelado y `timeout` sin ayuda.
- `measurement.session_time.expired` exige un `sessionDeadlineAt` explícito y vencido. Cierra la
  oportunidad como `missing_session_time`, incluso si existen parciales o se había alcanzado el
  mínimo; no selecciona un ítem nuevo y conserva cualquiera ya mostrado.
- `measurement.withdrawal.recorded` exige referencia a la decisión de consentimiento, cierra como
  `withdrawal`, deja la corrida retirada y fija reposición `prohibited`.
- `measurement.incident.recorded` usa el contrato canónico `Incident`. Código, nivel, acción y
  efecto de validez deben coincidir con la taxonomía congelada: nivel 1 registra y continúa; nivel 2
  invalida sólo el acto enlazado y deja la reposición al calendario con reserva independiente;
  nivel 3 cierra la oportunidad, suspende la corrida y fuerza `incident` aunque existan parciales.

Una oportunidad con un solo acto inválido todavía puede producir observación si los otros dos
actos alcanzan el mínimo 2/3 de H5. Fin de sesión, retirada e incidente sistémico son cierres
forzados y no se reinterpretan como observación válida por haber acumulado el mínimo antes.

## Sesión y replay

`projectMeasurementControlEffect()` acepta sólo el efecto público derivado por el worker, comprueba
corrida/seudónimo y exige `MEASUREMENT_MODE`. Proyecta `pausa`, `duda`, `invalidacion`, `incidente`
o `retirada`, conserva dudas e incidentes estructurados y crea un cambio de plan enlazado al
`effectId`. No recibe banco, solución, semilla, tiempo alternativo ni autoridad para responder la
duda. El evento de sesión lleva hashes previo/resultante y se reproduce por el replay común.

La restauración del worker vuelve a derivar disposición, pausa activa, orden y tiempo de efectos,
deadline, rúbrica, outcome no válido, enlaces de incidente, taxonomía y cierres forzados. Estado sin efecto, efecto sin outcome,
reloj extendido, disposición adulterada o actos posteriores a retirada/suspensión fallan cerrados.

## Límites

- `sessionDeadlineAt` procede de la autoridad de tiempo máximo de sesión; el worker lo verifica y
  registra, pero no inventa ese presupuesto. El tiempo interno de cada sonda sí sale de su
  inventario congelado.
- La decisión de ejecutar una reposición corresponde al calendario y al inventario futuro; este
  módulo sólo fija `calendar_independent_only` o `prohibited` y nunca reutiliza el ítem consumido.
- La taxonomía material, el run manifest y la bitácora `EvidenceEvent` completa se congelan/cablean
  en tareas posteriores. Aquí no se crean incidentes reales ni se afirma aprobación humana.
