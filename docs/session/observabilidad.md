# Observabilidad local — T-H3-05 (EN CURSO, rama `t-h3-05-observabilidad`)

**Estado: incompleta y bloqueada por un advisory.** Lo que hay funciona y está comprobado hasta donde
llega; lo que falta está enumerado abajo. **No está en `main` a propósito**: `ci:supply:drift` está en
rojo y ese gate es bloqueante.

## Qué pide la tarea

`Plan.md` T-H3-05: «OpenTelemetry local (traces/métricas a colector local) **desde el arranque**».
Norma: Maestro §2476 —«OpenTelemetry desde desarrollo», CONGELADA, registro **local**, sin monitoreo
de pago—.

Estaba abierta desde F3 esperando «la primera operación instrumentable». La hay desde F7: el canal de
veredicto de Clase, que cruza `apps/api` y `apps/verifier`. Un span de «arranqué» habría cerrado la
tarea en su día y habría sido éxito simulado.

## El bloqueo

`pnpm audit` reporta **dos advisories aplicables** sobre la línea 1.x del SDK que se fijó:

| Severidad | Paquete | Vulnerable | Parcheado |
|---|---|---|---|
| high | `@opentelemetry/propagator-jaeger` (vía `sdk-trace-node`) | `<2.9.0` | `>=2.9.0` |
| moderate | `@opentelemetry/core` (vía `exporter-metrics-otlp-http`) | `<2.8.0` | `>=2.8.0` |

Los dos se arreglan **subiendo a la línea 2.x**, que cambia la superficie: `Resource` deja de ser una
clase y se construye con `resourceFromAttributes()`, y los exportadores cambian de rango. Es un cambio
acotado —vive entero en `tools/observability/src/index.ts`— pero es un cambio.

**No se registró una excepción para seguir adelante.** Habría sido el atajo, y es exactamente lo que
D-28 existe para que no se haga por inercia: hay parche disponible aguas arriba, así que la mitigación
es actualizar, no documentar por qué se convive con ello.

## Lo que ya está hecho y no hay que rehacer

### `tools/observability` (D-36)

`packages/` es una lista obligatoria (P-II §3.1) y no contempla observabilidad, así que el arranque
compartido va a `tools/`, con el mismo criterio de D-1 (CLI) y D-32 (harness de benchmark).

**No podía ir en `contracts`**, que era el otro sitio compartido: de `contracts` depende `logic-core`,
así que un exportador OTLP —un cliente HTTP— habría llegado solo a la ruta de verificación y roto I-3.

Superficie: `startTelemetry()`, `withSpan()`, `setOperationalAttributes()`, `currentTraceId()`,
`assertOperationalAttributes()`.

Tres decisiones que van dentro y conviene no deshacer:

1. **El endpoint es obligatorio y su ausencia lanza.** «Desde el arranque» significa que un servicio
   que levanta sin saber a dónde exportar está mal configurado. Distinto es que el colector no
   conteste **en marcha**: eso se registra y no tumba el servicio, porque una clase no se cae porque
   falle su telemetría.
2. **Métricas desde el arranque, trazas cuando hay operación.** Es la lectura honesta de «desde el
   arranque»: el proceso emite su latido —dato real— y ningún span inventado.
3. **La traza no es una segunda bitácora** (P-II §9.3). `assertOperationalAttributes()` **rechaza** el
   atributo que parezca contenido: por nombre —una lista de formas: enunciado, derivación, respuesta,
   transcripción, seudónimo…— y por longitud (`MAX_ATTRIBUTE_TEXT_LENGTH = 200`). Sin el tope,
   bastaría llamar `detalle` a un atributo para colar la derivación entera. `participantPseudoId`
   entra en la lista prohibida **aunque sea seudónimo**: «un hash o un seudónimo no se presentan como
   anonimización» (P-II §9.1).

El enlace con la evidencia es `traceId`, campo que `EvidenceEvent` ya reserva (P-II §9.1). La traza
referencia la bitácora; no la duplica.

### `apps/api`

`main.ts` arranca la telemetría, envuelve el canal de veredicto en el span `clase.verificacion` y
vacía el lote al apagarse. La línea de log lleva `traceId` cuando lo hay.

`clase-verdict-route.ts` mide **los dos tramos por separado** —`spool_submit` y `spool_await`— porque
fallan por motivos distintos: uno es disco local y el otro es el verificador aislado. Con un solo
span, «tardó 9 s» no distingue un disco lento de un verificador atascado, que es justo lo que uno
necesita saber.

El `tracer` es opcional en `VerdictRouteDeps`: la ruta se prueba sin levantar telemetría y hace
exactamente lo mismo sin ella. **La telemetría observa, no decide.**

Se retiró `requestVerdict()` de `verdict-spool.ts`: la ruta ahora llama a `submitToSpool()` y
`awaitVerdict()` por separado para poder medirlos, y nada más lo usaba.

### `apps/verifier`

Ahora escribe su línea JSON **también al archivo** que el receptor `filelog` del colector lee.

Esto cierra una brecha entre lo declarado y lo cableado: `otel-collector.yaml` decía que `filelog` era
«la única vía por la que el verificador puede aportar telemetría», y el verificador **escribía sólo a
stdout y ni siquiera montaba el volumen**. El comentario describía una intención, no un cableado.

Sigue **sin red y sin SDK**, por I-3. La correlación con la traza de `apps/api` es por **nombre de
archivo del spool**, que las dos partes registran. Meter el `traceId` dentro del `.json` de la
derivación era el camino cómodo y está descartado: ese archivo es la entrada de `verify()`, que es
función pura de su argumento, y añadirle un campo de telemetría le cambiaría la entrada al
verificador.

### Frontera ejecutable

Regla nueva de dependency-cruiser **`verificacion-sin-telemetria-de-red`**: la ruta de verificación
(`logic-core`, `apps/verifier`) no puede importar `@profesor-ia/observability`.

Con **dos violaciones sembradas** que la regla detecta y **un control positivo** que comprueba que
`apps/api` sí puede importarla. Sin ese control, escribir la regla de más —prohibirla en `apps/*`
entero— dejaría el árbol verde diciendo lo que no dice.

### `infra/compose`

`OTEL_EXPORTER_OTLP_ENDPOINT` en los cinco servicios con red. **Trampa que costó entender:** el ancla
`x-node-service` ya lo definía, pero un servicio que declara su propio bloque `environment:` **lo
reemplaza entero** —la fusión de YAML es superficial—, así que hay que repetirlo servicio a servicio.
Por eso `api` ya lo repetía y los demás no lo tenían.

El `verifier` monta el volumen `logs` y define `LOG_FILE`, y **deliberadamente no** define endpoint
OTLP. Un volumen no es una interfaz de red.

`ci:infra:hardening` sigue en **159 en verde** con estos cambios.

## Lo que falta

1. **Subir OTel a la línea 2.x** y volver a poner `ci:supply:drift` en verde. Es lo primero: hasta
   eso, esta rama no entra en `main`.
2. **`ci:infra:otel`** — el check con stack real, que es la prueba que el propietario eligió y **la
   única que afirma que las trazas llegan**. Diseño previsto: levantar el stack, `POST` de una
   derivación a `/clase/verificacion`, y comprobar sobre `docker compose logs otel-collector` que
   (a) llegaron los tres spans con sus atributos, (b) llegó la línea del verificador por `filelog` con
   el mismo nombre de archivo, (c) llegaron métricas, y (d) —el control que más importa— que **la
   derivación del alumno no aparece en ninguna parte de la salida del colector**.
3. **Decidir la verbosidad del exportador `debug`.** Hoy es `normal`, que no imprime atributos, así
   que (a) y (d) no se pueden comprobar sobre esa salida. `detailed` sí, a cambio de volcar cada
   registro. Local-first y sin costo, pero es una decisión, no un detalle.
4. **Instrumentar `apps/web` y los tres workers** más allá del arranque del SDK: hoy emitirían
   métricas y ningún span, porque todavía no tienen operación propia que trazar. Es correcto hoy y
   deja de serlo en F8.
5. **Acta `docs/gates/H3.md`**: retirar la excepción nº 3 —«las trazas no están instrumentadas»—
   cuando lo anterior esté.

## Lo que este trabajo **no** afirma

- **Nadie ha visto un span llegar al colector.** El código exporta, el compose lo cablea y las
  fronteras están comprobadas, pero sin el punto 2 eso es una afirmación sin evidencia. Es exactamente
  la distinción que mantuvo esta tarea abierta desde F3, así que no se cierra ahora por analogía.
- Las 131 pruebas contra PostgreSQL **no se corrieron** en este cierre: Docker estaba apagado. El
  error es `Could not find a working container runtime strategy`, o sea del entorno y no del código,
  pero tampoco es un verde.
