# Observabilidad local — T-H3-05 (EN CURSO, rama `t-h3-05-observabilidad`)

**Estado (2026-08-18, cuarta sesión): desbloqueada y con el check en verde.** El advisory se resolvió
subiendo a OTel 2.x y **`ci:infra:otel` existe y pasa**: por primera vez se ha visto un span llegar al
colector. Lo que falta para cerrar la tarea está enumerado abajo, y ya no incluye ningún bloqueo
externo.

## Qué pide la tarea

`Plan.md` T-H3-05: «OpenTelemetry local (traces/métricas a colector local) **desde el arranque**».
Norma: Maestro §2476 —«OpenTelemetry desde desarrollo», CONGELADA, registro **local**, sin monitoreo
de pago—.

Estaba abierta desde F3 esperando «la primera operación instrumentable». La hay desde F7: el canal de
veredicto de Clase, que cruza `apps/api` y `apps/verifier`. Un span de «arranqué» habría cerrado la
tarea en su día y habría sido éxito simulado.

## El bloqueo, resuelto

`pnpm audit` reportaba dos advisories aplicables sobre la línea 1.x del SDK:

| Severidad | Paquete | Vulnerable | Parcheado |
|---|---|---|---|
| high | `@opentelemetry/propagator-jaeger` (vía `sdk-trace-node`) | `<2.9.0` | `>=2.9.0` |
| moderate | `@opentelemetry/core` (vía `exporter-metrics-otlp-http`) | `<2.8.0` | `>=2.8.0` |

**Los dos tienen parche aguas arriba, así que por D-28 la mitigación es actualizar, no registrar una
excepción.** Se subió a la línea 2.x (`sdk-trace-node`, `sdk-metrics`, `resources` en 2.10.0;
exportadores en 0.221.0). El único cambio de superficie fue el previsto: `Resource` deja de ser clase
y se construye con `resourceFromAttributes()`. Vive entero en `tools/observability/src/index.ts`.

`ci:supply:drift`: «sin advisories moderate+ aplicables». SBOM regenerado.

## `ci:infra:otel` — el check con stack real

`scripts/infra/otel-check.mjs`. Levanta el canal de veredicto, hace un `POST` real a
`/clase/verificacion` y **lee la salida del colector**, analizándola por estructura y no por
subcadena suelta. 22 comprobaciones, ~11 s tras el arranque.

Afirma cuatro cosas: (a) llegaron los **tres spans** del canal, con sus atributos, del mismo
`traceId`, con los dos tramos colgando del padre y atribuidos a `api`; (b) llegó la línea del
verificador por `filelog`, con **el mismo nombre de archivo del spool** que llevan los spans —el único
puente posible, porque el verificador no tiene red—; (c) llegaron métricas; y (d) **la derivación del
alumno no aparece en ninguna parte de la salida**.

Además: el verificador **no** aparece como recurso OTLP. Si apareciera, alguien le habría abierto una
salida de red y roto I-3 sin que ninguna regla estática lo viera.

### Por qué (d) no es verde por vacío

Cada corrida siembra un **canario**: el `submissionId` lleva una cadena única que viaja por el
**mismo camino** que recorrería una fuga —atributo de span → OTLP → colector → salida—. La misma
búsqueda que debe *no* encontrar la derivación tiene que encontrarlo a él; si no lo encuentra, la
corrida falla antes de opinar sobre la fuga.

Y se comprobó que el check **puede fallar**, sembrando dos fugas reales y observando que las caza:

1. **En un atributo de span** (`spool.first_line` con la fórmula de la primera línea). Tres
   comprobaciones en rojo.
2. **En un atributo de recurso** (`service.version` con un conectivo). Una comprobación en rojo.

### La decisión de verbosidad (D-37), con el experimento que la sostiene

La justificación que traía esta tarea era que `normal` no imprime atributos. **Es falsa**: en el
colector 0.115.1 los imprime, en una línea por span. Se comprobó en las dos verbosidades antes de
escribir nada.

Lo que `normal` **no** imprime es todo lo demás que el colector recibió: atributos de recurso,
eventos de span y enlaces. Y (d) no es una afirmación sobre los atributos, es una afirmación sobre
**todo lo que llegó**. La siembra nº 2 lo demuestra de forma directa: la misma fuga en
`service.version`, con el mismo `POST`,

- con `verbosity: detailed` → aparece en la salida y el check falla;
- con `verbosity: normal` → **no aparece**, y `Resource attributes` no se imprime en absoluto.

Con `normal`, (d) habría pasado sin haber mirado ahí. El costo de `detailed` es local y nulo.

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

1. ~~Subir OTel a la línea 2.x~~ — hecho.
2. ~~`ci:infra:otel`~~ — hecho, en verde, con siembras que prueban que puede fallar.
3. ~~Decidir la verbosidad~~ — `detailed`, D-37, con el experimento arriba.
4. **Instrumentar `apps/web` y los tres workers** más allá del arranque del SDK: hoy emitirían
   métricas y ningún span, porque todavía no tienen operación propia que trazar. Es correcto hoy y
   deja de serlo en F8.
5. **Acta `docs/gates/H3.md`**: retirar la excepción nº 3 —«las trazas no están instrumentadas»—.
6. **`ci.yml`**: `ci:infra:otel` necesita Docker y todavía no está cableado en el flujo de CI.

## Lo que este trabajo **no** afirma

- ~~Nadie ha visto un span llegar al colector.~~ **Ya se ha visto**, y con evidencia reproducible:
  `ci:infra:otel` en verde, traza `f0508d2ab69bf0637f0686733618adff` en la corrida local del
  2026-08-18. Era la distinción que mantuvo esta tarea abierta desde F3.
- **Nadie ha corrido `ci:infra:otel` en CI.** El check existe y pasa **en local**; el flujo de CI no
  lo invoca todavía. Hasta que una corrida observada lo enseñe en verde, esta tarea es `HECHA`, no
  `VERIFICADA`.
- **Sólo está instrumentado el canal de veredicto.** Web y los tres workers arrancan el SDK y emiten
  métricas; ningún span, porque no tienen operación propia.
- Las 131 pruebas contra PostgreSQL **no se corrieron** en este cierre: Docker estaba apagado. El
  error es `Could not find a working container runtime strategy`, o sea del entorno y no del código,
  pero tampoco es un verde.
