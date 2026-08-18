# Sesión seca E2E — `ci:e2e:dry-session`

Mitad del AC del gate H6 (`Plan.md` §F7). La otra mitad es `ci:mode-separation`.
Acta: [`../gates/H6.md`](../gates/H6.md).

```bash
pnpm run ci:e2e:dry-session
```

Dos archivos, 33 propiedades:

| Archivo | Qué cubre |
|---|---|
| `packages/session-engine/test/dry-session-e2e.test.ts` | La sesión completa, el replay, la bitácora y cuatro de las cinco propiedades (26) |
| `apps/measurement-worker/test/dry-session-consumption.test.ts` | La mitad de «reactivo consumido no reaparece» que vive en la autoridad de medición (7) |

## Por qué son dos archivos

El motor de sesión **no importa** al worker de medición y el worker **no importa** al motor: eso *es*
la autoridad aislada de `DEC-MEAS-AUTHORITY-001`. Un archivo único que importara los dos tendría que
declarar una dependencia que la arquitectura niega —y `depcruise` excluye los `*.test.ts`, así que
nadie lo habría detenido: la regla no habría fallado, simplemente no habría mirado—.

Las dos únicas puertas entre ellos son contratos: `MeasurementSessionIntent` de ida
(conjunto/fase/tipo) y `ProbeOpportunityResult` de vuelta (conteos). Que ninguna lleve el reactivo se
comprueba en las dos orillas por separado, no en una suite que los junte.

## La sesión seca

`preparada → autenticacion → consentimiento_confirmado → diagnostico → explicacion → comprobacion →
practica → evaluacion_operativa → cierre`, sin saltos: la máquina avanza exactamente una posición por
transición (P-II §7.1).

Por el camino: apertura de bloque y arranque del reloj, cuatro turnos del Profesor IA desde el
catálogo congelado, práctica guiada con ayuda de nivel 1 registrada, dos reactivos consumidos, la
proyección autoritativa de `domain-engine`, una sonda completa (transversal `sonda` + entrada/salida
de `MEASUREMENT_MODE`), una intervención humana y el cierre del reloj.

**Nada de esto consulta el reloj, el azar ni la red.** Los tiempos son constantes derivadas del
número de acto y el paquete es sintético (`purpose: 'test_fixture'`), que es lo que §F7 admite
mientras no exista corpus. El diseño es el mismo de
[`apps/web/src/clase/dry-session.ts`](../../apps/web/src/clase/dry-session.ts) y por la misma razón.

**La política de dominio es la real** (`DOMAIN_POLICY_V1`, `purpose: 'material'`). Lo sintético de una
sesión seca es el paquete de contenido, no la regla de dominio: es literal de P-I §5.3 y no depende
del corpus. Probar la propiedad contra una política de juguete no diría nada de la que va a correr.

## Las cinco propiedades, atacadas por la vía genérica

El criterio es el de `mode-separation`: atacar la propiedad por **la puerta que cualquiera podría
empujar**, no por el camino que uno espera que se use. Una propiedad comprobada sólo sobre el camino
previsto no dice nada de los otros.

### Sesión reconstruible desde eventos

`replaySessionStateEvents(eventos)` es deep-equal al snapshot final, con su hash de proyección. Y el
replay **rechaza** que le falte un evento, que dos vengan cambiados de orden o que uno venga dos
veces: reconstruir no es «aplicar lo que llegue».

### Reactivo consumido no reaparece

Dos mitades, porque son dos mecanismos distintos.

En el worker, un **barrido exhaustivo hasta agotar la reserva**: seis reactivos, tres oportunidades
de tres. No basta comprobar que dos entregas seguidas difieren; la reaparición interesante es la de
la tercera oportunidad, cuando ya no queda inventario y reutilizar sería el atajo cómodo. Al agotarse
la autoridad cierra con `reserve_exhausted` y validez `missing`, que es decir que no hay observación
en vez de fabricar una. Se comprueba también la exclusión por consumo previo **con su control
positivo**: `guided_practice` bloquea la reserva de sondas y excluye; `diagnostic` no bloquea y no
excluye. Sin ese segundo caso, una implementación que excluyera *todo* consumo previo pasaría por
exceso y `consumptionBlocksMeasurement()` dejaría de decir nada.

En el motor, la monotonía del registro: `consumedActivityIds` sólo crece. Ver «puerta lateral 2».

### Sonda nunca en contexto del agente

No se busca una cadena conocida —eso comprueba el reactivo que uno pensó, no los demás—. Se fija que
el **conjunto entregable es exactamente el catálogo** y que el catálogo **no puede expresar** una
sonda: `ScriptedActKind` no tiene esa clase, un catálogo que la traiga se rechaza en el constructor,
y una clave ausente falla en vez de rellenarse con lo más parecido. Con eso, cualquiera que sea el
reactivo de sonda, no cabe.

Del lado de la frontera: los dos contratos son `.strict()` y no tienen campo donde poner el ítem, así
que el intento de colarlo se rechaza en el borde. Del lado del productor, el
`ProbeOpportunityResult` que cruza no contiene ni el id ni el enunciado de nada entregado; el
enunciado sólo existe en la `ProbeDelivery`, que no cruza.

### Dominio no se alcanza sin transferencia

Dos ramas idénticas salvo en el tercer acto elegible —transferencia cercana no isomorfa en una,
práctica en la otra—, para que la racha llegue a tres en las dos y la única diferencia sea la
transferencia. Sin ella: `not_mastered` y `nearTransfer.status: 'pending'`. Con ella: dominio,
transferencia satisfecha y `post_mastery_reconfirmation_pending` abierta. Ver «puerta lateral 1».

### Una corrección no elimina el original

Cadena de cinco etapas (`detection → classification → invalidation → replacement → resolution`), cada
una apuntando a la anterior y la primera al original. El original conserva su hash; el historial de
proyecciones conserva el valor sustituido; saltarse una etapa o corregir un acto inexistente se
rechaza; y **borrar el original rompe la cadena** en vez de pasar desapercibido.

### Intervención humana registrada

El acto humano queda en `decisionAutonomy` con `decisionMaker: 'human'` y
`autonomyStatus: 'human-exception'`, sobrevive al replay y llega al ledger con esa atribución. El
resto de la sesión sigue siendo del motor: una intervención no tiñe la sesión entera. Y en el otro
sentido: `model` no puede figurar como autor de una decisión autoritativa (I-1), ni una transición
primaria puede atribuirse a una persona.

## Las dos puertas laterales que la suite destapó (D-35)

Dos de las cinco propiedades **no se sostenían**. Cada arreglo va en la capa que le corresponde, y la
diferencia entre las dos capas no es cosmética.

### 1. Dominio escrito a mano — al esquema

`updateSessionProjection()` acepta `operationalMastery` completo, así que se podía escribir
`mastered: true` con `nearTransferSatisfied: false` sin pasar por `domain-engine`. No es inocuo: esa
proyección **es** la que `session-engine/src/evidence.ts` registra en la proyección `domain` del
ledger, así que un falso dominio escrito ahí queda como evidencia indistinguible de uno real.

Se cierra con un `superRefine` en `OperationalMastery`, que es donde este repositorio pone los
invariantes de estado. La consecuencia importa: al vivir en el esquema, el estado con falso dominio
**no tiene hash válido**, porque no es un estado. Ningún evento puede declararlo como resultado, ni
escrito ni forjado, y no hace falta ninguna guarda en el replay.

**El invariante se intentó refutar antes de escribirlo, y el intento acotó su forma.** La versión
ambiciosa —exigir además una racha mínima— habría roto la proyección real: tras declarar dominio, un
intento elegible incorrecto vacía `eligibleCorrectStreak` y `masteryStatus` sigue en `mastered`
(`domain-engine/src/mastery.ts`), así que `mastered: true` con racha 0 es un estado autoritativo
legítimo. Y habría duplicado `correctConsecutiveRequired`, que es política de dominio y tiene un solo
sitio. El invariante habla de la transferencia y sólo de la transferencia.

### 2. Retirar un reactivo del registro — al reductor

La reaparición no se consigue volviendo a consumir: `uniqueArray` rechaza el duplicado. Se consigue
**retirando** el id de `consumedActivityIds`, con lo que el reactivo vuelve a estar disponible y nada
lo delata.

Es un invariante de **transición**, no de estado: un estado suelto con el registro corto es
perfectamente válido, así que el esquema no puede expresarlo. Va en `reduceDecisionEvent()` y **no**
en `updateSessionProjection()`, para que lo aplique también `applySessionStateEvent()`: con la guarda
sólo en el ayudante, un evento forjado pasaría el replay y reconstruiría un estado que nadie pudo
escribir. Código de error: `INVALID_PROJECTION`.

## Los controles positivos de los arreglos

Las cuatro pruebas de las dos puertas se validaron retirando las dos guardas: caen las cuatro y sólo
las cuatro. **Dos hubo que endurecerlas.** Los eventos forjados llevaban el `resultingStateHash`
heredado del evento del que se copiaban, así que el replay los rechazaba por `STATE_HASH_MISMATCH`
antes de llegar al invariante: pasaban con la guarda y sin ella, o sea **por vacío**. La versión que
quedó calcula el hash del estado resultante y comprueba antes que ese estado es válido para el
esquema, de modo que el evento sea intachable en todo salvo en la propiedad que se mide.

## Lo que la suite no afirma

- **No hay corpus, ni modelo, ni participante.** El catálogo, el inventario de sondas y la semilla son
  fixtures y lo declaran en `purpose`. De F8 en adelante el paquete sintético ya no vale.
- **No cubre interrupciones de sonda**: son de `T-H6-08` y tienen su propia suite
  (`apps/measurement-worker/test/interruptions.test.ts`).
- **No cubre la vista**: la interfaz de Clase se comprueba renderizándola en `apps/web/test/`
  (`T-H6-13`).
- **Sólo `consumedActivityIds` es monótono.** Otras colecciones del estado (`incidents`,
  `planChanges`) se pueden reescribir por proyección. Ninguna propiedad del AC lo prohíbe y no se
  añade una regla que ninguna autoridad pide; queda anotado como deuda en
  [`../plan/HANDOFF.md`](../plan/HANDOFF.md) §3.2.
