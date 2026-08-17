# Calendario SCED global — T-H6-07

Implementación de `Plan.md` `T-H6-07`, `DEC-BASELINE-001`, `DEC-PROBE-ROUND-001` y
`DEC-RETENTION-UNIT-001` en `packages/experiment/src/sced-calendar.ts`. El scheduler produce
`ProbeRequest` que consume la autoridad de `measurement-worker`; no selecciona reactivos ni conoce
la semilla privada de selección de ítems.

## Freeze y puntos planificados

La política transcribe como datos estrictos las ventanas A `6–8`, B `9–11`, C `12–14`, separación
mínima `3`, extensión máxima `2`, regla de estabilidad 3/2, ronda global, parcial descriptivo,
retención por conjunto a 7 días y el sobre H5 de 19 rondas válidas con microbatería 3/2.

Una semilla privada y congelada ordena por SHA-256 todos los triples que simultáneamente están dentro
de sus ventanas y respetan separación. Se elige el primero; no se seleccionan tres puntos de manera
independiente y después se “corrigen”. El binding inmutable por corrida liga política, semilla,
versión de oportunidad y triple resultante. Una corrida `material` exige hashes externos de política
y semilla. Los tests usan `purpose=test_fixture`: no afirman semilla, preinscripción ni calendario
materiales.

## `probe_round` global

Cada intento abre exactamente tres solicitudes primarias A/B/C con un mismo `probeRoundId`. El
índice objetivo es `validRoundCount + 1`; si una ronda resulta inválida, el siguiente intento conserva
ese índice. Sólo cuando las tres oportunidades son `valid`, tienen `plannedItems=3` y alcanzan el
mínimo H5 de 2 reactivos puntuados se hace todo lo siguiente:

1. incrementa una vez el contador global;
2. incorpora las tres observaciones a sus series primarias;
3. registra cambios concurrentes de líneas aún no intervenidas;
4. evalúa posibles inicios después de la observación de esa ronda.

Si una oportunidad no alcanza el mínimo, su `scheduleValidity` y la ronda quedan
`schedule_invalid`. Las otras observaciones permanecen dentro del registro de la ronda como datos
descriptivos, pero ninguna alimenta estabilidad, ventanas o serie SCED primaria. No hay imputación ni
devolución de reactivos al banco.

Transferencia de medición, retención, familiarización, diagnóstico y reconfirmación post-dominio se
registran como actividades fuera de ronda. Sus eventos incrementan la revisión del replay, nunca
`validRoundCount`.

## Estabilidad, diferimiento y separación

Al alcanzar el punto planificado, las tres últimas observaciones válidas deben no ser estrictamente
crecientes y las dos últimas no deben ser sucesivamente máximos históricos nuevos. La evaluación
registra ambas condiciones y la separación contra los inicios efectivos ya ocurridos.

Una falla difiere exactamente una ronda válida, sin re-aleatorizar. El límite es
`min(punto_planificado + 2, extremo_de_ventana)`. Si la condición sigue fallando en ese punto, el
estado terminal es `not_started_under_preinscription` con
`preinscription_window_exhausted`; no se desplaza la ventana ni se asigna un inicio favorable post
hoc. La enseñanza comienza después de la ronda que volvió elegible al conjunto, de modo que la
primera observación de intervención llega en la siguiente ronda válida.

## Covariación

Para cada ronda global válida, si un conjunto sigue en baseline mientras otro ya está en
intervención, cualquier cambio respecto de su observación primaria anterior genera un registro con
conjunto no intervenido, conjuntos concurrentes, valores anterior/actual y dirección. Es una señal
descriptiva de covariación/carryover; el scheduler no la convierte en causalidad ni veredicto.

## Retención y blackout pedagógico

`set_mastery_timestamp` sólo se admite después de iniciar la intervención del conjunto. Programa una
retención por ese conjunto siete fechas UTC después, preservando la hora del timestamp (D-23). Antes
del vencimiento la apertura falla; después produce un `retention_probe` con `probeRoundId=null`, que
la política compartida de H6-06 dirige exclusivamente a `retention`. Su resultado, válido, inválido o
faltante, no incrementa rondas.

Desde el dominio del conjunto y hasta registrar el resultado de retención, un evento de instrucción
dirigida a sus KC objetivo falla con `RETENTION_BLACKOUT`. El mecanismo no pretende clasificar
fundamentos compartidos: sólo gobierna enseñanza dirigida al conjunto objetivo.

## Replay y límites

Estado y eventos son estrictos. Al continuar un snapshot se rederivan triple sembrado, intentos,
índices, fases, solicitudes, mínimos, cierre global, series, evaluaciones, inicios, covariación,
retención y lista de eventos; una alteración falla antes de aplicar el siguiente acto. Una prueba de
frontera entrega el `ProbeRequest` resultante al worker H6-06 y comprueba selección/consumo/entrega.

Quedan fuera deliberadamente:

- la máquina exacta de pausa, duda, timeout, fin de sesión, retirada e incidentes (`T-H6-08`);
- el ledger `EvidenceEvent` completo (`T-H6-09`);
- reglas de techo/suelo y exposición externa (`T-H6-11`);
- inventario, semilla, preinscripción, firma y gates materiales, que no pueden fabricarse.
