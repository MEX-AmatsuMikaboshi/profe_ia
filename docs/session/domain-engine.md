# Controlador de dominio operativo

Implementación de `Plan.md` `T-H6-03`, P-I §5.3, `DEC-HINT-AUTHORITY-001` y
`DEC-FALSE-MASTERY-SCHEDULE-001`.

## Política y CAL-09

`DomainPolicyDefinition` materializa la regla vigente como datos hasheables: tres correctas
consecutivas elegibles, complejidad no decreciente, transferencia cercana no isomorfa y política de
reconfirmación. Una corrida material necesita el hash esperado del paquete congelado y el registro
`runId→version+hash` es persistible, restaurable e inmutable.

El controlador no recalibra complejidad. Cada intento debe declarar la identidad `cal-09-v1`
congelada en H5 y su `sampleHash`; una prueba compara esa identidad con
`CAL09_FROZEN_MANIFEST`, la fuente autoritativa. `CAL-DOMAIN-POLICY/DUP-02` se ejercita como prueba
seca de la regla actual. No se declara una nueva calibración empírica ni se cierra la sensibilidad
de H10.

## Elegibilidad y dominio

La entrada de intento es estricta. El código deriva `masteryDisqualifying` desde los hechos de cada
pista: nivel 1 solo conserva elegibilidad como recordatorio puro; niveles 2–5, selección de regla o
paso y contenido decisivo descalifican. No hay campo autoritativo para una propuesta del modelo.

- `MEASUREMENT_MODE`, faltantes, invalidados y reservas de medición no cuentan.
- Una transferencia solo cuenta desde `TRANSFER_MASTERY` y con evidencia hasheada del
  canonicalizador contra una lista no vacía de prácticas inmediatas.
- Un intento ineligible no se convierte en fallo conceptual ni rompe la racha de intentos
  elegibles. Una respuesta incorrecta elegible sí la reinicia.
- Una correcta con complejidad menor inicia una nueva racha desde sí misma.
- El acierto con ayuda decisiva queda pendiente; solo una reconfirmación posterior, enlazada y sin
  ayuda decisiva aporta evidencia elegible.

Cuando existen tres correctas elegibles no decrecientes y una transferencia elegible, se crea una
declaración versionada y `post_mastery_reconfirmation_pending`. Si una reconfirmación observada
resulta incorrecta, el dominio operativo pasa a `reconfirmation_failed`; puede reunirse evidencia
nueva y crear otra declaración, preservando el historial completo.

## Reconfirmación post-dominio

Los eventos de oportunidades son parte del replay. La primera oportunidad que sea práctica
independiente disponible en `LEARNING_MODE` y use la reserva `independent_practice` se programa
automáticamente. Mientras siga pendiente o programada, el controlador bloquea:

- consumir una práctica independiente ordinaria;
- reenseñar deliberadamente el KC;
- iniciar la siguiente sesión que vuelva a hacer objetivo ese KC.

El resultado debe coincidir con oportunidad, reactivo y reserva programados. Correcta conserva
dominio; incorrecta registra falso dominio operativo. Retirada, cierre de corrida, incidente o
ausencia válida de reserva producen `missing` y no cambian una declaración válida a falsa.

## Replay e integración

`DeterministicDomainController` valida secuencia, tiempo, IDs, política y CAL-09 y reproduce el
mismo `DomainKcState` desde la historia. BKT y propiedades extra se rechazan. El estado conserva
evaluaciones por intento, racha, transferencias, aciertos asistidos, todas las declaraciones y sus
reconfirmaciones.

`operationalMasteryProjection()` produce la forma de
`SessionStructuredState.operationalMastery[kcId]`; `masteryEligibilityAuthorization()` entrega a
`pedagogy-policy` una autorización con autoridad literal `domain_engine`.
`updateSessionFromDomainState()` integra dominio, elegibilidad por intento, transferencia y el
próximo paso de reconfirmación mediante un evento ordinario de sesión, por lo que el replay común
sigue siendo la fuente de reconstrucción.
