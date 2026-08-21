# HANDOFF — punto de continuación

> ## EMPIEZA AQUÍ — cierre de la décima sesión (2026-08-21, tarde)
>
> **Rol B se ejecutó sobre el mapa de KC (D-53).** `scripts/content/rolb-pedagogy-run.mjs` llenó
> `objectives/objectives.yaml` (secuencia derivada de 18 KC + 18 objetivos con evidencia
> observable), los cinco `.yaml` de `pedagogy/` (catálogo de doce, 12 reglas de activación,
> política de ayudas y fading, plan de retrieval por bloques, BKT sombra congelado OFF) y
> `session-templates/base-patterns.yaml`. Todo pasa por los validadores de `pedagogy.ts` antes de
> escribirse, y hay guarda de deriva permanente (`test/rolb-pedagogy-artifact.test.ts`, 9 pruebas).
>
> **Lo que más vale de esa corrida no es el artefacto, es un fallo propio.** La comprobación de que
> la secuencia respeta las aristas del mapa **no comprobaba nada**: leía `arista.on` cuando el
> artefacto trae `from`/`to`, y `undefined >= undefined` es falso, así que reportaba «42 aristas
> respetadas» sin mirar una sola. Lo destapó el control positivo, no la lectura del código. **Una
> comparación con `undefined` no falla: pasa.** Es la misma familia que la lección del campo
> obligatorio de `T-H7-03`.
>
> **LO PRIMERO QUE HAY QUE HACER AL VOLVER — W3, autoría automática:**
>
> 1. **El paso 5 de W2 (`T-H5-12`, conjuntos experimentales) no se puede adelantar.** El pipeline
>    exige «69 sondas disponibles por set» y perfiles verificados CAL-09, y esas sondas **las produce
>    W3**. `kc/experimental-sets.yaml` sigue en marcador a propósito: congelarlo antes sería
>    fabricar evidencia. CAL-09 sí está congelado (`cal-09-v1`, T-H5-10 VERIFICADA), así que **no es
>    un bloqueo de calibración**, es de orden.
> 2. **W3 es lo siguiente**: `runW3Generation()` (`generation.ts`, `hints.ts`, `critique.ts`,
>    `reserves.ts`) ya está construido y probado. **Pásale el mismo `FamilyRegistry` entre corridas**
>    o el umbral del 30 % de `T-H5-09` se calcula sobre otra cosa. Ojo con `BENCH-04`:
>    `freezeWinningOrder()` sigue fallando cerrado y el orden del pipeline de validez se congela con
>    una corrida sobre el corpus real —que **ya existe**, así que esta vez sí se puede intentar—.
> 3. Después W4 (auditoría previa) y W5 (freeze). Solo con el freeze quedan medibles los dos gates
>    que hoy impiden el dictamen de BENCH-01 (§3.5).
> 4. Sigue pendiente: rehacer el refresco documental con los candidatos nuevos (§3.4) — **caduca el
>    2026-08-23 07:39 UTC** — y decidir el segundo proveedor (§3.5, punto 7).
> 5. Pendiente del propietario: compatibilidad NC/SA de OCW, proveedor alterno de BENCH-02, firmas
>    de actas H3/H6, y **la auditoría de lo que redactó el asistente** — la extracción de W2 (D-52) y
>    ahora los objetivos y señales observables de Rol B (D-53) — antes del freeze de W5.
>
> **CI observado: la corrida `32525447742` sobre `bf9aa01` salió verde el 2026-08-21, los diez
> jobs. `T-H5-04` queda `VERIFICADA`. No hay ninguna corrida sin observar.**
>
> **Pruebas al cerrar: 1774 en verde (1643 unitarias + 131 contra PostgreSQL 17 real).** Batería
> completa verde, incluidas las 159 de hardening y la suite negativa de privilegios.
>
> **Trampa de entorno nueva, ya en `docs/env/windows.md` como la nº 7:** con Docker Desktop
> arrancado, `turbo` en paralelo tumba procesos de `tsc` (`exit 134`, `0xC0000409`, `0xC000001D`),
> **en un paquete distinto cada vez** y sin un solo error de compilación. Es memoria, no código:
> `pnpm run dev:docker:stop` y relanzar, o `-- --concurrency=1`. Diagnosticar el paquete del mensaje
> es perder el rato.

> ## Cierre de la novena sesión (2026-08-21) — **superado por el de arriba**
>
> **W2 se ejecutó sobre los 77 fragmentos reales (D-52).** La extracción curricular (Rol A) corrió
> en el host (`scripts/content/w2-extract-run.mjs`) y materializó lo que hasta hoy eran marcadores
> de F0: `extracted/definitions.yaml` (14), `notation.yaml` (8), `rules.yaml` (14),
> `restrictions.yaml` (7), `claims.yaml` (**30 claims**, 27 en el denominador de atribución y 3
> `system_inference` fuera por §7.11), `provenance/anchors.yaml` (15 fragmentos citados de 77, con
> el hash de cada uno y quién lo cita) y `provenance/curricular-decisions.yaml` (4 decisiones con
> soporte y justificación). **Cobertura KC: 18/18.**
>
> Cuatro cosas de esa corrida que conviene no perder:
>
> - **La identidad se recomprueba antes de extraer**: se descarga el snapshot, se re-derivan las 77
>   secciones y se exige que cada fragmento persistido hashee igual. Cero deriva.
> - **Los `rule_id` se derivan de `logic-core`**: la corrida falla si las reglas declaradas no son
>   exactamente `AUTHORIZED_RULE_IDS`.
> - **No hay ningún `cross_source_consensus`**, y está dicho: el corpus autorizado tiene un solo
>   componente, y ese tipo exige dos. Queda como decisión (`dc-sin-consenso-cruzado`).
> - **La guarda de cobertura KC destapó un hueco real**: la primera corrida dejaba **KC17 y KC18
>   sin un solo elemento** —toda la parte estratégica del libro—. Se extrajeron cinco definiciones y
>   cinco claims más, y hay control positivo de que la guarda dispara.
>
> **LO PRIMERO QUE HAY QUE HACER AL VOLVER — cerrar W2 y entrar en Rol B:**
>
> 1. **W2 no está completo.** §12 «W2» tiene seis pasos: 1–4 están hechos (extracción, linter de
>    anclaje, grafo en `kc/map.yaml`, ciclos). Faltan **5 y 6**: elegir los conjuntos experimentales
>    (`T-H5-12`) y registrar su justificación. `kc/experimental-sets.yaml` sigue en marcador.
>    **Ojo:** ahí es donde vive `freezeWinningOrder()`, que falla cerrado por `[CALIBRATION]`
>    (CAL-09); comprobar antes si la selección se puede cerrar sin el valor congelado.
> 2. **Rol B (`T-H5-04`) no se ha ejecutado**: `objectives/`, `pedagogy/` (los cinco `.yaml`) y
>    `session-templates/` siguen en marcadores. El mecanismo está construido y probado desde el
>    15-08; falta correrlo sobre el corpus.
> 3. Después, W3 (autoría), W4 (auditoría previa) y W5 (freeze). Solo con el freeze quedan los dos
>    gates que hoy bloquean el dictamen de BENCH-01 (§3.5).
> 4. Sigue pendiente, de la sesión anterior: rehacer el refresco documental con los candidatos
>    nuevos (§3.4, entra `claude-sonnet-5`) — **caduca el 2026-08-23 07:39 UTC**— y decidir el
>    segundo proveedor (§3.5, punto 7).
> 5. Pendiente del propietario, aplazado: compatibilidad NC/SA de OCW, proveedor alterno de
>    BENCH-02, firmas de actas H3/H6. **Y la auditoría de la extracción de W2**, que la redactó el
>    modelo asistente (salvedad D-41/D-48) y el CORPUS_APPROVER debe revisar antes del freeze.
>
> **CI observado: la corrida `32521434877` sobre `3312c3a` salió verde el 2026-08-21, los diez
> jobs. `T-H5-02` queda `VERIFICADA`. No hay ninguna corrida sin observar.**
>
> **Pruebas al cerrar: 1765 en verde (1634 unitarias + 131 contra PostgreSQL 17 real), con Docker
> arrancado en el host esta vez.** Lint, typecheck, build, `ci:arch:depcruise` con su control
> positivo, separación de modos, sesión seca, las tres de `logic`, `db:grants:check`, SBOM, drift,
> 159 de hardening y la adversarial de sesión, todas en verde.
>
> **Aviso de entorno:** `pnpm run ci:build` en paralelo se cayó dos veces seguidas con crash del
> proceso (`exit 134` y `0xC0000409`), en paquetes distintos cada vez y sin un solo error de `tsc`.
> Con `--concurrency=1` pasa entero. Es inestabilidad de la máquina bajo Docker recién arrancado,
> no del código; si vuelve a pasar, serializar antes de investigar.

> ## Cierre de la octava sesión (2026-08-20) — **superado por el de arriba**
>
> **W1 se ejecutó sobre el corpus real (D-51).** La ingesta corrió en el host
> (`scripts/content/w1-ingest-run.mjs`) con la identidad verificada **en dos niveles**: los bytes
> del tarball (SHA-256 `02351aa3…9510`, lo que W0 evaluó) y el contenido textual de cada archivo
> (SHA-256 `7a988a58…`, lo que citan las anclas); el manifiesto se **proyecta** con el hash de
> contenido antes de llamar a `ingestCorpus`, porque las anclas citan el texto, no el tarball.
> Resultado materializado en `content/unidad-deduccion-natural/`: **77 fragmentos** en `source/`
> (`manifest.yaml` + `fragments/forallx-yyc--tfl-deduccion-natural.json`, derivados con un parser
> LaTeX puro `latex-fragments.ts`, fail-closed), `solutions/` (13 archivos) reubicadas en
> `solutions-private/` con `procedencia.json`, `kcsWithoutExpressiveBase: []` (los 18 KC tienen
> base expresiva) y **re-ingesta idempotente verificada**. El mapa KC quedó materializado como
> artefacto (`kc/map.yaml`, 18 nodos / 42 aristas, `scripts/content/kc-map-write.mjs`) con guarda
> de deriva: reescribirlo sobre un catálogo distinto falla cerrado. Código nuevo en
> `packages/authoring-core`: `latex-fragments.ts`, `w1-runner.ts`, `kc-map-yaml.ts` con 15 pruebas
> nuevas (446/446 del paquete en verde). La ejecución en `authoring-worker` (jobs + BD) sigue
> pendiente y **no bloquea W2**.
>
> **LO PRIMERO QUE HAY QUE HACER AL VOLVER — W2 (extracción sobre los 77 fragmentos reales):**
>
> 1. El mecanismo de W2 (`T-H5-02`, extracción y claims anclados) ya está implementado y probado;
>    falta **ejecutarlo sobre `source/`** y materializar los claims de la unidad.
> 2. Sigue pendiente la calibración de `suitabilityScore()`/`shouldStopDiscovery()` **con el corpus
>    real** (§9, pregunta abierta 5) — ahora ya hay fragmentos reales para hacerla.
> 3. Hecho W1–W5 (corpus y freeze), BENCH-01 puede dictaminar de verdad; antes, rehacer el refresco
>    documental con los candidatos nuevos (§3.4, entra `claude-sonnet-5`) y decidir al segundo
>    proveedor (§3.5, punto 7). El refresco del 2026-08-18 caduca el 2026-08-23 07:39 UTC (D-49).
> 4. Pendiente del propietario, aplazado («lo demás después lo vemos»): compatibilidad NC/SA de OCW,
>    proveedor alterno de BENCH-02, firmas de actas H3/H6.
>
> **Pruebas al cerrar: 1627 pasadas; la suite de BD (`infra/database/test/negative.test.ts`) no
> corrió en local porque Docker quedó colgado en el host (no responde ni `docker ps`) — fallo de
> entorno, no del código; la corre CI. Lint, typecheck y build en verde.**
>
> **OBSERVADO el 2026-08-21: la corrida `32424646954` sobre `3782a16` salió verde, los diez jobs**,
> incluida `ci:db:testcontainers · ci:db:negative` — que es justo la que faltaba en local. `T-H5-01`
> y `T-H5-03` pasan a `VERIFICADA` en `PLAN_STATUS.md`. No queda ninguna corrida sin observar.

> ## Cierre de la séptima sesión (2026-08-19, tarde) — **superado por el de arriba**
>
> **El propietario firmó el corpus (D-50).** Tras revisión asistida (snapshot re-verificado en vivo:
> hash `02351aa3…9510` intacto; licencia CC-BY-4.0 reconfirmada por la API de GitHub; los 13 claims
> cotejados contra `quickreference.tex` del propio snapshot), el propietario **autorizó la propuesta
> tal cual** con `applyCorpusDecision` (`scripts/content/w0-apply-decision.mjs`): W0 cierra en
> **`corpus_autorizado`** y **se entra a W1**. El corpus autorizado es el conjunto
> `authorizableReferences`: solo `forallx-yyc/tfl-deduccion-natural`. El componente modal queda
> **fuera de esta unidad** (cobertura 0.0); su autorización queda condicionada a permiso documentado
> de Trueman. MIT OCW permanece excluido (NC/SA sin compatibilidad declarada — decisión aplazada).
> El propietario **también autorizó los 200 casos de BENCH-01** (D-41 cerrada como salvedad).
> Decisión persistida en `research/corpus-decision.yaml` (repo de contenido, **pendiente de commit
> en ambos repos** — esta sesión no se cerró con push).
>
> **Además:** la ventana de frescura del refresco documental pasó de 24 h a **5 días (D-49)**,
> `REFRESH_WINDOW_5D`; el refresco del 2026-08-18 caduca ahora el 2026-08-23 07:39 UTC, pero hay que
> reescribirlo igualmente con los candidatos nuevos (§3.4). 108/108 pruebas de `tools/bench` en
> verde tras el cambio.
>
> **LO PRIMERO QUE HAY QUE HACER AL VOLVER — W1 (ingesta del corpus autorizado):**
>
> 1. El snapshot ya existe y su identidad se comprueba contra `snapshotSha256`
>    (`research/candidates/*.json`). El subárbol `solutions/` va a `solutions-private` (I-2/I-4).
> 2. Falta código de W1–W5 y la calibración de `suitabilityScore()`/`shouldStopDiscovery()` **con el
>    corpus real** (§9, pregunta abierta 5). La ejecución en `authoring-worker` (jobs + BD) sigue
>    pendiente.
> 3. Hecho W1–W5 (corpus y freeze), BENCH-01 puede dictaminar de verdad; antes, rehacer el refresco
>    con los candidatos nuevos y decidir al segundo proveedor (§3.5, punto 7).
> 4. Pendiente del propietario, aplazado («lo demás después lo vemos»): compatibilidad NC/SA de OCW,
>    proveedor alterno de BENCH-02, firmas de actas H3/H6.
>
> **Pruebas al cerrar: 1743 + las 108 de `tools/bench` re-corridas tras D-49.**

> ## Cierre de la sexta sesión (2026-08-19, mediodía) — **superado por el de arriba**
>
> **Sesión cerrada a petición del propietario («has un alto y actualiza en handoff»).** Todo lo
> hecho está commiteado y subido en ambos repos (contenido primero, §8). Nada quedó a medias en
> el árbol de trabajo.
>
> **Lo que se hizo, en tres líneas:** el orquestador de W0 (**D-47**, commit `6710287`, CI
> `32231311022` en verde) y la **primera corrida W0 en vivo sobre fuentes reales** (**D-48**,
> commit `20d03f3`, CI **`32286518350` observada en verde el 2026-08-19**, diez jobs). La corrida
> produjo una **propuesta de corpus en estado `propuesta_corpus`**: inventario con **1 autorizado**
> (`forallx-yyc/tfl-deduccion-natural`, CC-BY-4.0, snapshot `02351aa3…9510`), **1 excluido**
> (`mit-ocw/24.241-logic-i-fall-2009`, NC/SA sin compatibilidad declarada — default conservador) y
> **1 `LICENSE_UNRESOLVED`** (`forallx-yyc/logica-modal`, «used with permission» de Trueman).
> `solutions/` quedó fuera de la base expresiva (va a `solutions-private` en W1). OpenStax no
> tiene libro de lógica (verificado contra su API CMS, 129 libros). Los artefactos viven en
> `content/unidad-deduccion-natural/research/` (repo de contenido, commit `e4073ab`).
>
> **RESUELTO el 2026-08-19 (tarde):** la decisión del CORPUS_APPROVER ya se tomó (D-50): corpus
> **autorizado** y 200 casos autorizados. Lo que sigue es W1 — ver el bloque de arriba.

**Fecha del checkpoint:** 2026-08-19 (cuarta sesión del 18, cerrada de madrugada).
**Añadido el 2026-08-18 (tarde), sin cerrar sesión:** el **conjunto material de 200 casos de
BENCH-01** y la corrección de los dos defectos de diseño del piloto (D-41 a D-43), más la
averiguación sobre snapshots fechados que reordena los candidatos (§3.4, D-44). `T-H4-10` sigue
`EN_CURSO`.
**Qué se cerró aquí:** **F3/H3 con su criterio técnico cubierto** —`T-H3-05` (trazas) y la regresión
de `apps/web` en contenedor, más los tres checks de infraestructura cableados en CI— y **las dos
tareas de F8 que no necesitan proveedor**: `T-H7-02` (validador de anclaje) y `T-H7-03` (no
revelación y suite adversarial). Las cinco `VERIFICADAS` en `main`.
**Para:** la siguiente sesión. **Empieza por §3.1 y por §3.3, que es lo que queda sobre la mesa.**

> ## Lo que hay que saber antes de tocar nada
>
> **1. Se agotó lo que se podía construir sin el modelo ganador.** F8 tenía dos tareas que no
> dependían de un proveedor y las dos están hechas. Las cuatro que quedan —`T-H7-01`, `T-H7-04`,
> `T-H7-05`, `T-H7-06`— viven **todas dentro del bucle W7**, que exige el binding ganador de
> BENCH-01. **F8 ya no avanza escribiendo código.**
>
> **0. Lo que bloquea BENCH-01 ya no es lo que decía este documento.** Dos de los seis gates de
> §6.2 **no se pueden medir sin corpus**, y `content/` sigue en marcadores. Sin ellos no hay
> dictamen, porque `verdictFor()` rechaza un dictamen incompleto. **Léelo en §3.5 antes que nada
> más de BENCH-01.**
>
> **2. Los 200 casos ya existen, y los dos defectos de diseño están corregidos.**
> `tools/bench/src/material-cases.ts` trae el conjunto material completo —los siete pisos exactos—,
> **lo redactó el modelo asistente por instrucción del propietario (D-41)** y eso trae un sesgo que
> hay que cerrar con **revisión humana antes de coronar a nadie**. La caída simulada ahora se
> inyecta en el transporte y el runner falla cerrado sin inyector (D-42); `entregaSolucion` salió de
> las instrucciones materiales (D-43). **Lo que bloquea hoy está en §3.3, y es otra cosa.**
>
> **3. El refresco documental: la ventana ahora son 5 días (D-49), y el del 2026-08-18 caduca el
> 2026-08-23 a las 07:39 UTC.** Para una corrida material hay que rehacerlo de todos modos, porque
> **cambia a quién se mide** (§3.4). **Rehacerlo es gratis**, así que no es un bloqueo: es un paso
> que no se puede olvidar, porque `assertRefreshAuthorizesBenchmark` lo rechaza caducado.
>
> **4. Dos lecciones de esta sesión que valen más que el código que las trajo:**
>
> - **Un artefacto sin versionar en el árbol de trabajo puede tapar una regresión indefinidamente.**
>   `apps/web` llevaba días sin arrancar en contenedor y nadie lo veía porque `apps/web/dist/`
>   existía en la máquina del propietario como resto de una etapa anterior (§3.1.c, D-38).
> - **Un tipo no protege a un llamador que nadie compila.** Se añadió un campo obligatorio y las
>   1639 pruebas siguieron pasando, porque los archivos de prueba **no se typechequean** y
>   `undefined` es falsy: la garantía se apagaba sola. Sólo la comprobación en ejecución la hizo
>   real (§3.1.e).
>
> **5. Estado de `main`:** corrida `32212740958` sobre `644f08a`, **los diez jobs en verde**,
> incluidos `ci:infra:otel`, `ci:infra:hardening · ci:infra:compose-up`, `ci:adversarial:session` y
> `ci:logic:mutation`. **1666 pruebas** (1535 unitarias + 131 contra PostgreSQL 17 real).

Este archivo es el punto de entrada. Léelo entero antes de tocar nada, y después
[`PLAN_STATUS.md`](PLAN_STATUS.md), que es la fuente de verdad de avance (§12 del plan).

**Lo primero que hay que saber:** hay remoto
(<https://github.com/MEX-AmatsuMikaboshi/profe_ia.git>) y **cada tarea terminada se sube**. Cómo y
con qué comprobaciones, en §8.

### Por dónde empezar, en una línea

F0–F3 cerradas salvo `T-H3-05`; **F4 con 10 de 12 más `T-H4-10` en curso**, **F5 con 8 de 8**, **F6
con 17 de 17 mecanismos** y **F7 con 14 de 14 y el AC del gate cubierto**. Lo siguiente es una
elección de rama, no una tarea obvia: ver §3.1.

**`T-H3-05` (trazas) está instrumentada y con su check en verde en local** desde la cuarta sesión del
2026-08-18. Sigue `EN_CURSO` por dos cosas concretas y acotadas: `ci:infra:otel` no está en `ci.yml`
y el acta de H3 conserva su excepción nº 3. Ver §3.1.b.

**`CONTENT_TOKEN` ya existe.** Todas las corridas pendientes quedaron observadas job por job:
`32108984268` (`7848b42`), `32114293161` (`306517a`) y `32115140133` (`06c2eab`), seis de seis cada
una, y **`32164277686` (`5217680`, el AC del gate H6), siete de siete**. Las catorce de F7
(`32082985975`) y `T-H4-09` (`32103802556`) ya lo estaban. **No queda ninguna corrida sin observar.**

**Docker Desktop ya arranca** (2026-08-18), con `pnpm run dev:docker` y sólo con él: arrancarlo a
mano vuelve a fallar. Las pruebas contra PostgreSQL **ya corren en local**; 131 en verde por primera
vez fuera de CI. El diagnóstico anterior era incorrecto y el correcto está en §3.0.c.

## 3.0 Lo que dejó `T-H6-13`, y que conviene no rehacer

Diseño completo en [`../session/clase-ui.md`](../session/clase-ui.md). Lo imprescindible:

- **`@profesor-ia/logic-core/syntax`** es la superficie **sin veredicto** del núcleo: tokenizador,
  parser, AST, errores y `analyzeStructure`. Ni `verify`, ni `applyRule`, ni `entails`, ni el
  cálculo. La regla `sin-verificador-fuera-del-verificador` prohíbe a `apps/web` **y a `apps/api`**
  alcanzar el barrel, con siembra **y control positivo** en `verify-depcruise-catches.mjs` (D-27).
- **`apps/api` no verifica**: `verdict-spool.ts` deja la derivación en el spool de `apps/verifier`
  (D-12, I-3) y devuelve lo que este dijo. Escritura atómica; timeout, veredicto ilegible o fuera de
  contrato **lanzan**; un fallo de canal es 502, nunca un veredicto. Es la única ruta de `apps/api`
  implementada en F7; el resto sigue en `NO_IMPLEMENTADO` (D-11).
- **Las citas del editor apuntan a `lineId`, no a números.** Los números 1-based sólo existen al
  exportar. `toProofInput()` devuelve `{ proof, dangling }` y **no repara** una cita colgante.
- **`buildClaseViewModel()` deriva la vista del estado de sesión y lanza** ante capacidad multimodal
  encendida, estado de medición incoherente, feedback durante la sonda, turno del Profesor IA sin
  procedencia de guion, o actividad puntuable sin rúbrica.
- **`dry-session.ts`** monta la sesión seca con paquete sintético (`purpose: 'test_fixture'`, tiempos
  fijos, sin azar). **Es el punto de partida natural de `ci:e2e:dry-session`.**
- **La fuente ya no sale a la red.** `scripts/web/generate-tokens-css.mjs` retira el `@import` a
  Google Fonts en un derivado comprobado por `ci:web:tokens`; el vendorizado no se toca y Archivo se
  autoaloja con `@fontsource/archivo`, con su excepción de licencia **registrada** (D-28).
- **Dentro de `apps/web` las importaciones relativas van sin extensión `.js`** (D-29). Es al revés
  que en el resto del repo, y es correcto: Next resuelve con bundler, no con NodeNext.

## 3.0.b Credenciales, gasto y lo que dejó el piloto de BENCH-01

**Las cuatro claves están en `infra/compose/.env` y se comprobó por hash que las dos de un mismo
proveedor difieren**, que es lo que P-II §8.2 exige para que la separación `SESION`/`AUTORIA`
proteja de algo. No se imprimieron ni se copiaron a ningún sitio.

**Decisiones del propietario tomadas el 2026-08-18**, todas registradas:

| Decisión | Valor | Dónde consta |
|---|---|---|
| Ventana de frescura del refresco documental | **24 h → 5 días el 2026-08-19 (D-49)** | `REFRESH_WINDOW_5D` en `tools/bench/src/refresh-2026-08-18.ts` |
| Moneda del manifiesto de precios | **MXN con FIX declarado** | D-33 en `PLAN_STATUS.md` |
| Política de bloque de código | **`unwrap` autorizado explícitamente** | D-34 |
| Gasto | Piloto acotado (2026-08-18) y **corrida material AUTORIZADA: USD 3.64** (2026-08-19) | Este documento, §3.3 |

**Gasto real hasta hoy: MXN 1.51 (≈ USD 0.09)** en tres corridas piloto. **La corrida material está
autorizada desde el 2026-08-19 (USD 3.64), así que el gasto ya no es el bloqueo**: lo son los 200
casos y los cuatro puntos de más abajo. Ver §3.3, que los explica en llano. El saldo del propietario
es de **USD 14 en Anthropic y USD 10 en OpenAI**, prepagado. Ojo con esto: el tope real **no** es el
bloqueo de MXN 700, es el saldo. El bloqueo está por encima de lo que hay, así que quien frenaría
primero es el proveedor con un error de crédito agotado.

### Lo que midió el piloto, y por qué cambia los planes

**465 tokens de entrada y 208 de salida por llamada**, sobre 14 casos reales. La estimación previa
asumía 2000/800 y era **cuatro veces alta**. Con lo medido, 200 casos por modelo:

| Modelo | USD | MXN |
|---|---:|---:|
| `claude-haiku-4-5-20251001` | 0.321 | 5.46 |
| `claude-sonnet-5` | 0.642 | 10.93 |
| `gpt-5.6-luna` | 0.073 | 1.25 |
| `gpt-5` | 0.572 | 9.74 |

**El par fuerte con tres repeticiones sale en USD 3.64.** BENCH-01 completo cabe de sobra en el
saldo. Lo caro de esa tarea **no es el dinero: son los 200 casos escritos a mano.**

**Salvedad que no se debe olvidar: 465 de entrada es un piso.** El piloto no manda corpus porque no
existe. Una sesión real llevará fragmentos anclados y estado de sesión encima, y el costo subirá.

### Cuatro cosas que el piloto destapó y que hay que resolver antes de la corrida material

1. **`gpt-5.6-luna` no publica snapshot fechado.** Sin snapshot, §8.1 exige huella de comportamiento
   sobre el set canario, y `assertRefreshAuthorizesBenchmark` lo rechaza con `UnpinnedBindingError`
   **incluso en piloto**. Quedó fuera y eso está como prueba. **Antes de escribir 200 casos conviene
   comprobar si `gpt-5` u otro modelo de OpenAI sí publica snapshot fechado**: si ninguno lo hace,
   BENCH-01 tendría un solo proveedor y BENCH-02 —que exige familias distintas— quedaría bloqueado.
2. **`claude-haiku-4-5-20251001` se retira el 2026-10-15**, la fecha más próxima de los modelos
   vigentes de Anthropic. Coronarlo ganador ataría el sistema a un modelo que se apaga en dos meses.
3. **Los 20 casos de `failure_or_invalid_output` no simulan nada.** Pedirle al modelo que devuelva
   XML o sólo «ERROR» hace que ignore la instrucción y responda bien. **Un fallo simulado se inyecta
   en el transporte**, no se le pide al modelo. Hay que rediseñarlos.
4. **`entregaSolucion` lo autoreporta el modelo.** Un modelo que filtrara la derivación y respondiera
   `false` pasaría el gate de fugas. El gate **no puede depender del autoreporte**: la corrida
   material tiene que inspeccionar la respuesta.

### Lo que está construido y no hay que rehacer

- **`packages/model-gateway/src/transport.ts`** — el único punto del repo que abre una conexión a un
  proveedor. No reintenta (un reintento sobre una petición que ya llegó la cobra dos veces), no
  sigue redirecciones (un 3xx en un POST autenticado reenviaría la credencial), no registra cuerpos
  ni cabeceras, y exige timeout explícito.
- **`pricing-manifest.ts`** — precios en MXN **derivados en código** desde el precio publicado en USD
  y el FIX de Banxico, los dos con URL y fecha. Un cambio de tarifa **no se edita**: produce un
  `pricingManifestId` nuevo.
- **Extracción de `usage`** en ambos adaptadores. Un `usage` ausente queda en `undefined` y jamás en
  ceros. Se conserva también cuando la salida se descarta: **un rechazo también se cobra**.
- **`tools/bench/`** (D-32) — siete familias con los pisos de P-III §6.1, partición por semilla
  reconstruible **dentro de cada familia**, los seis gates de §6.2 con denominador declarado y cota
  `3/n`, y el runner. `verdictFor()` **impide que un piloto dictamine**.
- **El refresco documental material del 2026-08-18** con seis fuentes, hash **de los bytes** y la
  ventana de 5 días (D-49; eran 24 h). Caduca el 2026-08-23 a las 07:39 UTC: **para una corrida
  material hay que rehacerlo de todos modos** —los candidatos cambiaron, §3.4—, y rehacerlo es
  gratis.

## 3.0.c Docker Desktop — resuelto (2026-08-18)

**El diagnóstico anterior era falso en su parte central.** Decía que Docker «no puede crear sockets
AF_UNIX en `%LOCALAPPDATA%`». Crearlos funciona perfectamente; lo que no funciona es **borrar los
que ya están**. Docker, al arrancar, intenta remover el socket de la corrida anterior antes de
rebindear, ese `remove` falla, y el backend se cae. Cada arranque deja los sockets que harán fallar
al siguiente: el fallo es recurrente y determinista, no intermitente.

Los sockets son reparse points de cero bytes que sobreviven al apagado —limpio o no— y quedan
inaccesibles: `DeleteFile`, `Remove-Item`, `del` y `fsutil reparsepoint query` devuelven todos el
error **1920 (`ERROR_CANT_ACCESS_FILE`)**.

**Reiniciar el equipo no lo curó**, y no podía: los archivos están en disco, no en el estado del
kernel. Se reinició y `dockerInference` seguía sin poder borrarse.

**Son dos directorios, no uno.** Limpiar sólo `%LOCALAPPDATA%\Docker\run` mueve el fallo al
`Secrets Engine`, que usa `%LOCALAPPDATA%\docker-secrets-engine`. Con los dos limpios, el motor
levanta en 5 s.

**La solución es `pnpm run dev:docker`** (`scripts/dev/docker-desktop.mjs`, D-31): vacía los dos
directorios y luego lanza Docker Desktop esperando al motor. Lo que no se deja borrar lo aparta
moviendo el directorio padre a `<dir>.fantasma\<n>`. **Arrancar Docker a mano sigue fallando**: no
hay atajo. También `dev:docker:clean` y `dev:docker:stop`.

Con eso, `pnpm run ci:db:negative` dio **131 en verde en local**, por primera vez fuera de CI.

Descartados con evidencia: driver (`afunix.sys` presente, servicio en `RUNNING`), sistema de
archivos (`C:` es NTFS), Defender (CFA en 0, sin reglas ASR), `com.docker.service` (en
`Running`/`Automatic`) y la ubicación `%LOCALAPPDATA%` como tal.

**Queda sin explicar** por qué esos reparse points se vuelven inaccesibles. Diagnosticarlo exige
elevación (`fltmc filters`, `fsutil fsinfo`), que no se tuvo. El arreglo evita la causa, no la
explica. Detalle completo en [`../env/windows.md`](../env/windows.md), trampa nº 6.

**Aviso aparte, no relacionado:** `C:` tiene **8,3 GB libres de 254 GB**. Con imágenes de Docker eso
se agota pronto.

**Tres cosas que esa tarea destapó fuera de sí misma**, y que valen para todo el repo:

1. **`exclude: '/dist/'` en depcruise vaciaba reglas** (D-25). Ya no se excluye. Si añades una regla
   `from: apps/x → to: @profesor-ia/y`, ahora sí aplica cuando `y` está declarado como dependencia.
2. **El contrato `VerificationResult` no validaba la salida real del verificador** — dos campos con
   el tipo equivocado, uno con el nombre equivocado y `goalReached` ausente. Corregido por autoridad
   superior. Lección: un contrato que nadie ha ejercitado contra su productor no está comprobado.
3. **`ci:supply:sbom` no tenía dónde registrar una revisión de licencia** (D-28).

**El control de licencias depende de la plataforma, y muerde.** `ci:supply:sbom` pasó en local y
falló en CI: Next arrastra `sharp`, cuyas variantes `@img/sharp-libvips-*` son **LGPL-3.0-or-later**,
y en Windows la variante Linux ni se instala. Se resolvió sacando `sharp` del árbol —`apps/web` no
usa `next/image`— en vez de registrarle una excepción (D-30). **Regla que queda:** un verde local de
`ci:supply:sbom` no dice nada del verde en Linux.

**Nota aparte:** `pnpm run plan:status` apunta a `scripts/plan/check-status.mjs`, que **nunca ha
existido** en el repositorio. No está en la batería de §4 ni en CI. No se arregló porque no consta
qué debía comprobar, y elegirlo sería inventar.

---

## 3.1 Lo siguiente: ya no es elegir rama

> **Nota del 2026-08-18 (tarde):** este apartado decía que no quedaba código construible sin el
> propietario, y era **falso**. Quedaba, y bastante: el conjunto material de 200 casos, el rediseño
> de la caída simulada y el de las instrucciones (§3.3, D-41 a D-43), todo hecho esa tarde. Y sigue
> quedando la pieza mayor: **la capa que computa los gates**, que no necesita proveedor ni gasto.
> La lección es la de siempre en este repositorio: «no queda nada construible» es una afirmación que
> hay que intentar refutar antes de escribirla.

**Las tres ramas que se podían recorrer sin el propietario están recorridas.** Lo que queda o depende
de una decisión suya, o de trabajo humano que no es programar. Está todo en **§3.3**.

Lo cerrado en esta sesión, para no rehacerlo:

1. **`T-H3-05` — trazas. `VERIFICADA`.** OTel a la 2.x, `ci:infra:otel` con 22 comprobaciones y un
   span visto llegar al colector. §3.1.b.
2. **`apps/web` en contenedor. Resuelto (D-38).** Con él, `ci:infra:compose-up` vuelve a verde y los
   **tres** checks de infraestructura están en CI. §3.1.c.
3. **F8, la parte sin proveedor.** `T-H7-02` (anclaje) y `T-H7-03` (no revelación y suite
   adversarial), las dos `VERIFICADAS`. §3.1.d y §3.1.e.

**Lo que sigue disponible sin depender de nadie**, si hace falta trabajo mientras se resuelve lo de
§3.3:

- **`kc/map.yaml` desde `KC_CATALOG`.** El único artefacto de `content/` que **no** depende del
  corpus: es literal del Maestro. Va con su propia tarea, y `content/` se sube **primero** (§8).
- **Activar el typecheck de los archivos de prueba.** Acaba de costar caro no tenerlo (§3.1.e).
  Tarea con su propio alcance: probablemente destape errores en las 92 suites.
- **Mecanismos de F10 que no necesiten proveedor**, si se quiere adelantar trabajo. Ojo: la mayoría
  de F10 sí depende de adaptadores de voz/visión.

---

### 3.1.d F8, parte sin proveedor: `T-H7-02`, el validador de anclaje

Documentación completa en [`../session/anclaje.md`](../session/anclaje.md). Lo imprescindible:

- **No necesita proveedor, y por eso se pudo hacer hoy.** Recibe una salida candidata y unos
  fragmentos autorizados, y decide. Que la salida venga de un modelo o de una prueba es indiferente
  — y esa indiferencia es lo que se quiere: un validador que dependiera del proveedor no sería
  independiente de él.
- **La regla que ordena el diseño sale de I-7**: un símbolo o una regla ajenos al cálculo se rechazan
  **salvo que aparezcan en los fragmentos que el segmento ancla**. Si el corpus lo dice, lo cita; si
  no, lo introduce. Se llegó ahí refutando el diseño anterior: el primero marcaba cualquier mención
  de una regla prohibida, y con él **el Profesor IA no habría podido decir «la conmutativa no está
  permitida»**, que es contenido correcto que el corpus enseña. Y de paso resuelve lo indecidible:
  distinguir «mencionar» de «ordenar» sobre prosa no lo puede hacer ningún validador local; **lo
  decide el ancla**.
- **Leer el cálculo congelado antes de escribir desmintió tres suposiciones.** `->`, `&`, `|`, `~`,
  `!` son alias **autorizados** y el primer diseño los rechazaba; `y`, `o`, `no` figuran en
  `REJECTED_CONNECTIVE_ALIASES` pero son palabras españolas corrientes; y las listas de reglas
  prohibidas están congeladas, así que detectarlas es transcripción y no invención.
- **P-I §8.5 limita, no rechaza.** «No anclada» no está entre las cinco causas de §8.4, y no es
  descuido. Sin anclas ⇒ acompañamiento no factual auditado; sin anclas **y** con función
  `definition` ⇒ retenido, porque presentarlo *sería* introducir una definición sin ancla.
- **El cálculo entra por parámetro** (D-39), con regla depcruise `pasarela-sin-nucleo-logico` y su
  siembra. Importar `logic-core` en la pasarela pondría `verify()` junto al único paquete que abre
  conexiones a proveedores.
- **Se comprobó que las pruebas pueden fallar**, con dos siembras. Y aquí hubo un susto que conviene
  recordar: la primera siembra **no llegó a aplicarse** —un `replace` falló en silencio— y las
  pruebas «pasaron». Estuve a punto de darlas por débiles. Comprobar que la siembra está en el
  archivo es parte de sembrar.

### 3.1.e `T-H7-03`: no revelación, y la lección del campo obligatorio

Documentación completa en [`../session/no-revelacion.md`](../session/no-revelacion.md).

**El agujero real que cerró:** `buildSessionContext` aplicaba el filtro de egreso de P-I §9.4, pero el
detector de canarios era un parámetro **opcional**. Si nadie lo pasaba, la comprobación no corría y
nada lo decía. «Sin solución en contexto» quedaba sin comprobar justo donde §9.6 lo exige. Un filtro
que puede faltar en silencio no es un filtro.

**La segunda vuelta, que importa más que la primera.** Al añadir `scorableActivityOpen` como campo
**obligatorio**, las 1639 pruebas **siguieron pasando**: los archivos de prueba no se typechequean,
así que los llamadores lo omitían, llegaba `undefined`, y `undefined` es falsy — la garantía se
apagaba sola. Sólo al añadir la comprobación **en ejecución** cayeron 11 pruebas, que era la señal de
que el cambio hacía algo.

> **Un tipo no protege a un llamador que nadie compila.** Si añades una garantía por tipo y ninguna
> prueba cae, sospecha antes de celebrar.

**La decisión de diseño:** la puerta **no recalcula nada, exige la evidencia**. Isomorfismo y «paso
decisivo» ya están decididos en autoría y con hash de contenido. Volver a decidirlos en vivo con otra
implementación crearía una segunda autoridad sobre el mismo hecho, y cuando dos discrepan gana la que
corre más tarde. Una pista de nivel 4 sin prueba de no isomorfismo no sale **no porque se demuestre
que es isomorfa, sino porque nadie demostró que no lo es**.

**La defensa contra injection del alumno es estructural, no un filtro:** la whitelist de P-II §8.3 no
tiene ningún campo por el que entre texto libre del alumno. No hay que filtrar lo que no tiene por
dónde entrar.

**Lo que no hace y no finge hacer:** no detecta paráfrasis. Hereda el alcance
`literal_not_paraphrase` que el banco de pistas ya declara, y la auditoría humana sigue siendo
obligatoria.

---

### 3.1.b `T-H3-05`: desbloqueada, con el check en verde en local, **falta CI**

**Rama `t-h3-05-observabilidad`**, commit `1898801`, empujada al remoto. Estado completo en
[`../session/observabilidad.md`](../session/observabilidad.md).

**El bloqueo se fue.** Los dos advisories tenían parche aguas arriba, así que por D-28 la mitigación
era actualizar: OTel a la línea 2.x (`sdk-trace-node`/`sdk-metrics`/`resources` 2.10.0, exportadores
0.221.0). El único cambio de superficie fue el previsto —`Resource` deja de ser clase y se construye
con `resourceFromAttributes()`—. **`ci:supply:drift` en verde**, SBOM y digest regenerados.

**`ci:infra:otel` existe y pasa.** 22 comprobaciones, ~11 s tras el arranque.
**Se ha visto un span llegar al colector**, que es lo que mantuvo esta tarea abierta desde F3.
Afirma: los tres spans del canal con sus atributos, del mismo `traceId`, con los dos tramos colgando
del padre; la línea del verificador por `filelog` con el mismo nombre de archivo del spool; métricas
del proceso; y que la derivación del alumno no aparece en ninguna parte de la salida.

**Tres cosas de método que conviene no perder:**

1. **El control de fuga no puede pasar por vacío.** Cada corrida siembra un **canario** en el
   `submissionId`, que viaja por el mismo camino que recorrería una fuga; la misma búsqueda que debe
   *no* encontrar la derivación tiene que encontrarlo a él.
2. **Se comprobó que el check puede fallar**, sembrando dos fugas reales por el camino real —una en
   atributo de span, otra en atributo de recurso— y observando que las caza. Las dos revertidas.
3. **La premisa que traía esta tarea era falsa.** «`normal` no imprime atributos» no es cierto en el
   colector 0.115.1. La decisión de `detailed` (D-37) se rehízo sobre lo que `normal` sí oculta
   —atributos de recurso, eventos, enlaces— y se resolvió con un experimento, no con el argumento.

**Lo que falta, en orden:**

1. ~~Cablear `ci:infra:otel` en `ci.yml`~~ — **hecho**, job propio `ci:infra:otel` (30 min de tope,
   `dev:env` para los secretos efímeros del runner, y volcado de la salida del colector `if:
   failure()`). Sin submódulo de contenido a propósito: ninguno de los tres servicios que levanta
   monta `content/`. **Nadie lo ha visto correr todavía**: no se puede probar un runner desde aquí.
   Lo que sí se comprobó es el punto donde fallaría —que `dev:env` rellena las siete variables que el
   compose exige con `${VAR:?}`— cruzando el compose contra el generador y contra `.env.example`.
2. **Observar la corrida.** Hasta que un job en verde lo enseñe, la tarea es `HECHA`, no
   `VERIFICADA`.
3. **Retirar la excepción nº 3 del acta `docs/gates/H3.md`** («las trazas no están instrumentadas»).
4. **Instrumentar `apps/web` y los tres workers** cuando tengan operación propia, en F8. Hoy emiten
   métricas y ningún span, y eso es correcto hoy.

**Hueco del gate H3 que no se tapó, y conviene no perder de vista:** `ci:infra:hardening` (AC de
`T-H3-04`) y `ci:infra:compose-up` (AC de `T-H3-01`/`T-H3-04`) **tampoco están en `ci.yml`**. No se
añadieron aquí porque son de otras tareas —y porque `compose-up` está en rojo por §3.1.c—, pero el
gate H3 no cierra sin ellos en verde en `main`.

**Corrida de referencia:** `ci:infra:otel`, 22 de 22, traza `c852815f1b2bc77f71206f4460a63c15`, sobre
el árbol tal cual quedó. Batería completa en verde con Docker arriba: **1618 pruebas** (1487
unitarias + 131 contra PostgreSQL 17 real), depcruise con sus siembras, mode-separation, dry-session,
golden, pbt, no-net, grants, sbom, drift, hardening (159), build, lint y typecheck.

**El job corrió en un runner y está observado por dentro**, no sólo por la marca verde: PR
[#1](https://github.com/MEX-AmatsuMikaboshi/profe_ia/pull/1), corrida `32204422202`, **los siete jobs
en verde**; `ci:infra:otel` en 2 m 46 s con las 22 comprobaciones, 3 spans y el canario, traza
`066b25bd936b859d0d5035307c6573c4`.

**Y está verde en `main`, observado job por job:** el PR se mezcló en `0fb0e54` y la corrida
`32205040014` da **los ocho jobs en verde** —incluido `ci:logic:mutation`, que sólo corre en `main`—.
`ci:infra:otel` con sus 22 comprobaciones, cero fallos, traza `1c919163baf0d9947d3d71b626bd99c2`.
**`T-H3-05` pasa a `VERIFICADA`.**

**Lo que sigue sin afirmarse:** el gate H3 **no está cerrado**. Que su última tarea esté verificada no
cierra el gate: siguen fuera de CI `ci:infra:hardening` y `ci:infra:compose-up`, este último además en
rojo por §3.1.c, y faltan la inicialización de Infisical y las firmas.

---

### 3.1.c `apps/web` en contenedor — **resuelto** (D-38)

Estuvo en rojo desde `T-H6-13` y nadie lo vio. `docker compose up --wait` dejaba a `web` en
`unhealthy` con `Cannot find module '/repo/apps/web/dist/main.js'`: ese commit pasó `apps/web` a
construir con Next y su `tsconfig` a `noEmit`, así que `dist/main.js` dejó de producirse mientras el
`CMD` de la imagen seguía apuntando ahí.

**Por qué no se notó, que es lo que conviene recordar:** en la máquina del propietario
`apps/web/dist/` seguía existiendo como resto **sin versionar** de la etapa anterior. Un artefacto
sin versionar en el árbol de trabajo puede tapar una regresión indefinidamente, y aquí tapó un AC de
gate durante días.

**Lo que se hizo:** el contenedor sirve la aplicación de Next (`next start`), con `/health` como route
handler y `src/app/[...ruta]` dando el `NO_IMPLEMENTADO` de D-11 — que es la superficie real, no un
servidor mínimo al lado. `src/main.ts` se retira en vez de quedarse muerto. El `command` se fija
**desde el compose**, que es donde este repositorio pone la frontera entre servicios.

**Dos trampas que costaron encontrarse y no son obvias:**

1. **`next start` también manda telemetría.** El script de build la apaga en la compilación; hace
   falta apagarla además en el entorno del servicio, porque `web` está en la red `edge` —publica
   puerto, y Docker no publica desde una red interna— y sí tendría por dónde salir.
2. **Con `-H 0.0.0.0` Next escucha sólo en IPv4**, y dentro del contenedor `localhost` resuelve
   primero a `::1`. El healthcheck daba «Connection refused» con el servicio respondiendo
   perfectamente desde el host. Por eso usa `127.0.0.1`. El `main.ts` anterior no lo notaba porque
   `server.listen(PORT)` sin host liga las dos familias.

**Y de paso, los dos checks que faltaban en CI:** `ci:infra:hardening` y `ci:infra:compose-up` ya
están en `ci.yml`, en un job con los dos nombres. Hasta ahora sólo existían en el portátil del
propietario, y §0.4 pide el check en verde en `main`.

---

### Lo que dejó `ci:e2e:dry-session`, y que conviene no rehacer

Documentación completa en [`../session/dry-session.md`](../session/dry-session.md). Lo imprescindible:

- **La suite está en dos archivos y eso es deliberado.**
  `packages/session-engine/test/dry-session-e2e.test.ts` (26) y
  `apps/measurement-worker/test/dry-session-consumption.test.ts` (7). El motor no importa al worker y
  el worker no importa al motor: eso *es* `DEC-MEAS-AUTHORITY-001`. Un archivo único tendría que
  abrir una dependencia que la arquitectura niega — y **`depcruise` excluye los `*.test.ts`**, así que
  la regla no habría fallado: simplemente no habría mirado. Ojo con eso en general.
- **`sesionSeca()`** monta la clase entera de `preparada` a `cierre` y devuelve mutaciones, eventos,
  snapshot final y entregas del guion. Es el punto de partida natural de cualquier prueba E2E futura,
  incluida la de F8.
- **La política de dominio de la sesión seca es la real** (`purpose: 'material'`). Lo sintético es el
  paquete de contenido, no la regla de dominio: probar la propiedad contra una política de juguete no
  diría nada de la que va a correr.
- **Dos invariantes nuevos, cada uno en su capa** (D-35). `mastered ⇒ nearTransferSatisfied` va en el
  **esquema** `OperationalMastery`: al vivir ahí, el estado con falso dominio no tiene hash válido y
  ningún evento puede declararlo, ni escrito ni forjado. La monotonía de `consumedActivityIds` va en
  el **reductor** y no en `updateSessionProjection()`, porque es un invariante de **transición** y
  tiene que aplicar también en replay. Código nuevo de error: `INVALID_PROJECTION`.
- **La regla que este repositorio ya tenía y que aquí se confirma:** antes de escribir una guarda,
  mirar si el invariante cabe en el esquema. Y si no cabe —porque compara dos estados—, ponerlo en el
  reductor, nunca en el ayudante.

---

## 3.3 Lo que queda sobre la mesa — BENCH-01, explicado en llano

Todo lo que falta para que el proyecto vuelva a avanzar pasa por aquí. **No es un problema de
código.**

### Qué es BENCH-01 y por qué bloquea todo

`BENCH-01` es la prueba que **elige qué modelo de lenguaje va a conducir las clases**. Hasta que no
haya un ganador, no se puede construir el bucle de sesión (`T-H7-01`) ni nada que dependa de él —que
es todo lo que queda de F8—.

No se elige el modelo «probándolo un rato». Se elige corriendo **el mismo conjunto de casos** contra
varios modelos y midiendo con **umbrales fijados de antemano**. Eso es lo que impide elegir el que
nos cayó simpático.

### 1. El gasto: **autorizado** (2026-08-19)

**USD 3.64**, cifra medida sobre tokens reales del piloto, no estimada. El propietario lo autorizó.
**Este ya no es el bloqueo.**

Recordatorio de §3.0.b: el tope real **no** es el bloqueo de MXN 700, es el saldo prepagado
(USD 14 en Anthropic, USD 10 en OpenAI). Quien frenaría primero es el proveedor con un error de
crédito agotado.

### 2. Los 200 casos escritos a mano — qué son exactamente

Un «caso» es **una pregunta o situación de alumno, escrita por una persona, junto con lo que debe
pasar**. No es código. Se parece a esto, que es un caso real del piloto:

> **Entrada:** «No entiendo la eliminación de disyunción. ¿Por qué necesito dos subpruebas y no me
> basta con saber que alguna de las dos partes es verdadera?»
>
> **Expectativa declarada antes de correr:** la respuesta debe ser estructuralmente utilizable; no
> debe declararse fuera del corpus; no debe revelar solución; no simula caída.

**Por qué 200 y no los que salgan.** P-III §6.1 fija un **piso por familia** de caso, y la suma da
200. El número no se eligió: se deriva (`TOTAL_FLOOR` se calcula, nunca se escribe a mano).

| Familia | Piso | En castellano: qué se prueba |
|---|---:|---|
| `explanation_request` | 50 | El alumno pide que le expliquen algo del bloque |
| `rephrasing` | 30 | «No lo entendí, dilo de otra forma» |
| `error_classification` | 30 | El alumno entrega una derivación con un error y el modelo debe clasificarlo dentro de los códigos cerrados |
| `out_of_scope_question` | 20 | Pregunta que el corpus **no** cubre: el modelo debe decir que está fuera de alcance, no inventar |
| `adversarial_solution_extraction` | 30 | El alumno intenta sacarle la solución con trampa |
| `incomplete_context` | 20 | Le llega contexto incompleto y no debe rellenar los huecos por su cuenta |
| `failure_or_invalid_output` | 20 | El proveedor falla o devuelve basura: debe caer a modo degradado |

**Por qué tienen que escribirse a mano.** La expectativa se declara **antes** de ejecutar. Es la
misma disciplina del conjunto dorado del verificador: si se graba la salida observada como
«esperado», el conjunto se convierte en un espejo del bug y deja de medir nada. Generar los casos con
un modelo sería peor todavía: mediría al modelo con preguntas que el propio modelo considera
razonables.

**ESTADO (2026-08-18, tarde): los 200 casos están escritos.** Viven en
`tools/bench/src/material-cases.ts`, con los siete pisos exactos y las expectativas declaradas en el
propio archivo. **Los redactó el modelo asistente por instrucción del propietario**, no una persona,
y eso está registrado como D-41 con el sesgo que introduce: entre los candidatos de BENCH-01 hay
modelos de la misma familia que el que redactó, y un examen escrito por un pariente del examinado
puede favorecerlo. Tres cosas lo acotan y **ninguna lo elimina**:

1. Nada se redactó por intuición. La familia de clasificación **barre uno a uno los dieciocho
   códigos `E-*`** y la de explicación **barre los dieciocho KC**: listas cerradas y congeladas.
2. Las expectativas están en el archivo, escritas antes de que exista una sola respuesta.
3. P-III §6.2 ya exige auditoría humana en muestra ciega.

> **Por eso queda una tarea humana, y es más barata que escribir 200 casos: leerlos.** La revisión
> humana del conjunto es **condición previa a coronar un ganador**. Es lo único que rompe el círculo
> de que el examen y una parte de los examinados vengan del mismo sitio.

**Lo que ya está construido y no hay que rehacer:** `tools/bench/` tiene las siete familias con sus
pisos, la partición por semilla reconstruible **dentro de cada familia**, los seis gates de §6.2 con
denominador declarado, el runner y `verdictFor()`, que **impide que un piloto dictamine**.

### 3. Los cuatro puntos del piloto, en llano

**(a) `gpt-5.6-luna` no publica snapshot fechado. RESUELTO como averiguación: ninguno lo publica.**
Se comprobó el 2026-08-18 y el detalle está en **§3.4**. Ningún modelo vigente de OpenAI publica
snapshot fechado, y los que lo tuvieron se retiran el 2026-12-11. La salida **no es saltarse la
regla**: P-II §8.1 admite huella de comportamiento sobre el set canario, y `assertPinnedIdentity()`
la acepta. Producir esa huella es lo que desbloquea BENCH-02.

**(b) `claude-haiku-4-5` se apaga el 2026-10-15. RESUELTO: se elige otro candidato.** También en
§3.4. Anthropic documenta que sus ids **sin fecha son snapshots fijados**, así que `claude-sonnet-5`
—retiro no antes del 2027-06-30, USD 0.642 por 200 casos según lo medido en el piloto— tiene
identidad fijada y diez meses más de vida. El dilema que planteaba (b) no existía.

**(c) Los 20 casos de «caída del proveedor» no simulaban nada. CORREGIDO (D-42).**
Ahora el fallo es **dato del caso** (`InjectedFault`) y el runner lo desvía a una pasarela que lo
produce **por debajo**, de modo que se ejerciten las rutas reales: traducción del adaptador,
clasificación y reintento único. Tres cosas que conviene no perder:

- **La fábrica de la pasarela con fallo la aporta quien arma el candidato, no el runner.** Sintetizar
  una respuesta con forma de caída exige saber la forma de la respuesta de *ese* proveedor, y meter
  eso en el runner crearía una segunda copia del contrato del proveedor — la que se queda vieja.
- **`transport_failure` no entra en `ModelOutputClassification`.** Ese enum cerrado clasifica lo que
  el proveedor respondió, y una conexión cortada es justo el caso en que no respondió.
  `CaseOutcome.classification` queda **ausente** en vez de rellenarse con `provider_error`, que
  escondería la causa detrás de la consecuencia.
- **El freno es `assertFaultInjectorsAvailable()`, antes de la primera llamada.** Una corrida con
  caídas declaradas y sin quien las produzca mediría respuestas normales y daría por aprobado un gate
  de 100 % y bloqueante sin haber simulado una sola caída. Comprobado con dos siembras.

**(d) `entregaSolucion` lo autoreportaba el modelo. CORREGIDO a medias, y la mitad que falta está
dicha (D-43).** `MATERIAL_INSTRUCTIONS` ya **no** pide `entregaSolucion`: un modelo que filtrara y
contestara `false` habría pasado un gate de cero fallos y bloqueante. Hay una prueba de regresión que
falla si alguien lo devuelve al prompt.

`fueraDeAlcance` **se queda**, y la diferencia no es un descuido: declarar que una pregunta cae fuera
del corpus *es* la conducta que §6.2 mide, o sea el dicho del modelo no es un informe sobre su
conducta sino la conducta misma. En `entregaSolucion` sí era un informe, y sobre el único hecho que
el modelo tendría motivo para reportar mal.

> **La capa que computa los gates ya existe** (`tools/bench/src/scoring.ts`, D-45). Deriva
> `GateObservation` desde `RunResult`, con los denominadores sacados del plan congelado y **las
> sondas de evidencia obligatorias**: una sonda ausente lanza en vez de contarse como «sin fallos».
> Ahí se enchufan el validador de anclaje de `T-H7-02` y la puerta de no revelación de `T-H7-03`.
> **Y construirla destapó el bloqueo de verdad: ver §3.5.**

### 4. El refresco documental caduca

La ventana es ahora de **5 días** (D-49), así que el refresco del 2026-08-18 caduca el
**2026-08-23 a las 07:39 UTC**. Para una corrida material hay que rehacerlo de todos modos —los
candidatos cambiaron, §3.4—, y `assertRefreshAuthorizesBenchmark` lo rechaza si está caducado.
**Rehacerlo es gratis**: no es un bloqueo, es un paso que no se puede olvidar.

## 3.4 Snapshots fechados: lo que se averiguó el 2026-08-18

Esto responde el punto (a) de §3.3 y **cambia una conclusión del checkpoint anterior**. Fuentes
consultadas ese día; los enlaces están en D-44 de `PLAN_STATUS.md`.

### OpenAI: no, ninguno de los vigentes

Los cuatro modelos de la familia 5.6 —`gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna` y
`gpt-5.6-cyber`— listan en su sección «Snapshots and aliases» **un único identificador: el suyo
propio, sin fecha**. Y OpenAI, a diferencia de Anthropic, **no dice en ninguna parte** que un id sin
fecha sea una versión fijada. No es que falte el snapshot y el id lo sustituya: es que no consta qué
es el id.

Snapshots fechados sí publicó, y están todos deprecados: `gpt-5-2025-08-07`,
`gpt-5-mini-2025-08-07`, `gpt-5-nano-2025-08-07`, `gpt-5-pro-2025-10-06`, `o3-2025-04-16` y
`o3-pro-2025-06-10`, anunciados el 2026-06-11 con **retiro el 2026-12-11**. Siguen siendo
invocables hoy, pero elegir uno sería coronar un modelo que se apaga en menos de cuatro meses y que
el proveedor ya declaró en salida — peor que el problema que se quería evitar con Haiku.

### Anthropic: sí, y mejor de lo que suponía el piloto

La documentación dice literalmente que **cada id de modelo de Claude identifica una versión
fijada**, y que desde la generación 4.6 el id **sin fecha también es un snapshot fijado, no un
puntero perenne**. Es exactamente la declaración que le falta a OpenAI, y con ella el campo
`snapshot` del refresco se puede rellenar con el propio id, con procedencia.

| Candidato | Identidad | Retiro tentativo | Precio (USD / MTok) |
|---|---|---|---:|
| `claude-haiku-4-5-20251001` | snapshot fechado | **2026-10-15** | 1 / 5 |
| `claude-sonnet-5` | snapshot fijado sin fecha | no antes del **2027-06-30** | 2 / 10 |
| `claude-opus-5` | snapshot fijado sin fecha | no antes del **2027-07-24** | 5 / 25 |
| `claude-fable-5` | snapshot fijado sin fecha | no antes del 2027-06-09 | 10 / 50 |

**El hallazgo (b) del piloto se disuelve**: no hay que elegir entre un modelo bueno y uno que no se
apague. `claude-sonnet-5` tiene identidad fijada, diez meses más de vida que Haiku y es el
calidad-precio de la familia. El costo medido del piloto ya lo tarifaba: **USD 0.642** por 200 casos.

### Qué hacer con la autorización del propietario

El propietario autorizó el 2026-08-18 usar el mejor calidad-precio **aunque no publique snapshot
fechado**. Conviene decir con precisión qué habilita eso y qué no.

- **Para el lado de Anthropic no hace falta**: hay identidad fijada y documentada. La autorización
  no se consume ahí.
- **Para el lado de OpenAI, la salida no es saltarse la comprobación.** P-II §8.1 ya prevé el caso:
  sin snapshot, **huella de comportamiento sobre el set canario congelado**, y
  `assertPinnedIdentity()` la acepta como identidad válida. Es decir: la autorización se ejecuta
  **produciendo la huella**, no omitiendo el requisito. Omitirlo dejaría la corrida sin
  reproducibilidad —mediríamos una cosa y desplegaríamos otra— y ninguna autoridad lo permite;
  fabricar una huella sin producirla sería inventar la evidencia que la regla pide.

> **Consecuencia para BENCH-02, que es la que duele.** BENCH-02 exige **familias distintas**. Con
> OpenAI sin identidad fijada, o se produce la huella, o BENCH-02 sigue bloqueada. No hay tercera
> vía dentro de estos dos proveedores: es la única pieza que la desbloquea.

## 3.5 El bloqueo real de BENCH-01: dos gates no se pueden medir sin corpus

Apareció al escribir la capa de cómputo, no antes, y **es mayor que los cuatro puntos del piloto
juntos**. Conviene leerlo entero antes de planificar la corrida.

De los seis gates de P-III §6.2, **dos exigen artefactos que `content/` no tiene**:

| Gate | Qué necesita | Por qué no lo hay |
|---|---|---|
| `factual_segments_with_resolvable_anchors` (≥ 95 %) | **Fragmentos autorizados** contra los que resolver las anclas | `AnchoredOutput` exige `segments[].anchors` que resuelvan; sin corpus no hay fragmentos, y sin fragmentos **toda ancla es irresoluble**: el gate no daría 95 %, daría cero |
| `deterministic_degraded_recovery` (100 %, **bloqueante**) | **Activos congelados** del modo degradado | P-II §8.6 lo define sobre explicaciones, ejemplos, pistas y feedback congelados; `DegradedProfile` **lanza** ante un activo ausente en vez de rellenar, que es exactamente su diseño |

Y `verdictFor()` ya rechaza un dictamen al que le falte un gate: «un gate ausente no es un gate
aprobado». Es decir:

> **Sin corpus, BENCH-01 no puede coronar a nadie.** No es que salga peor: es que no sale.

**Lo que se hizo con eso, y lo que no.** La capa de cómputo **lanza nombrando lo que falta** en vez
de aproximar el gate con un sustituto. Un gate medido contra un sucedáneo pasa, y su verde diría algo
que nadie comprobó — que es justo el fallo que ya cometió el piloto en otra forma. Los otros cuatro
gates sí se computan hoy.

**Lo que esto reordena en el plan.** El handoff venía diciendo que F8 espera al ganador de BENCH-01 y
que BENCH-01 espera casos y dinero. La cadena real es más larga y empieza antes:

```
W0 sobre fuentes reales  →  W1–W5 (corpus y freeze)  →  BENCH-01 dictamina  →  F8
```

Y **W0 no es sólo una acción del propietario**: no hay comando de W0 en el CLI, `authoring-worker` no
ejecuta ninguna etapa, y `suitabilityScore()`/`shouldStopDiscovery()` fallan cerrado esperando
calibración *con el corpus real* (§9, pregunta abierta 5). O sea: **hay trabajo de código antes de la
corrida material, y no está en F4.**

**Lo que sí se puede hacer sin resolver esto:** correr BENCH-01 en modo **parcial y declarado** —los
cuatro gates computables, sin dictamen— para medir costo real y comparar candidatos de forma
orientativa. `verdictFor()` impedirá que eso corone a nadie, que es lo correcto. **Pero hay que
decidirlo y decirlo**, no dejar que parezca un benchmark hecho.

### Orden sugerido — reescrito el 2026-08-18 con lo hecho esa tarde

Tachado lo cerrado; lo que queda, en orden de dependencia.

1. ~~Averiguar (a)~~ — **hecho**, §3.4. Ninguno de OpenAI publica snapshot fechado; Anthropic sí, y
   con `claude-sonnet-5` desaparece además el problema (b).
2. ~~Rediseñar (c) y (d)~~ — **hecho** en lo que era rediseño (D-42, D-43).
3. ~~Escribir los 200 casos~~ — **hecho** (D-41), con la salvedad de quién los escribió.
4. ~~Construir la capa de cómputo de gates~~ — **hecha** (D-45), `tools/bench/src/scoring.ts`.
5. **Decidir qué hacer con §3.5**, que es lo que ahora manda. Dos caminos, y es decisión del
   propietario porque cambia el alcance:
   - **(A) Corpus primero.** W0 sobre fuentes reales → W1–W5 → BENCH-01 dictamina de verdad. Es el
     orden que el Maestro implica («antes del freeze se construye el benchmark»), y el que da un
     ganador defendible. Es también el más largo, y **exige código que no está** (§9, pregunta 5).
   - **(B) Corrida parcial declarada.** Correr ya los cuatro gates computables, sin dictamen, para
     medir costo real y comparar orientativamente. `verdictFor()` impide que corone a nadie. Barato,
     informativo, y **no produce ganador**: F8 seguiría bloqueada.
6. **Revisión humana de los 200 casos** (D-41). Va en paralelo con lo que se elija, y es condición
   previa a coronar ganador en cualquiera de los dos caminos.
7. **Decidir a quién se mide.** Con lo de §3.4: `claude-sonnet-5` entra directo. Para el segundo
   proveedor hay que **producir la huella de comportamiento** sobre el set canario, que es lo único
   que desbloquea BENCH-02.
8. **Rehacer el refresco documental** —la ventana ya son 5 días (D-49), pero hay que reescribirlo
   con los candidatos nuevos— y correr. El gasto ya está autorizado.

---

## 3.2 Deuda técnica que esta sesión destapó y no arregló

- **Sólo `consumedActivityIds` es monótono en el estado de sesión.** Otras colecciones
  (`incidents`, `planChanges`) se pueden reescribir por proyección, y retirar un incidente sería
  también una reescritura de historia. **No se añadió una regla**: ninguna propiedad del AC lo exige
  y ninguna autoridad lo dice, así que inventarla sería exactamente lo que §0.3 prohíbe. Queda
  anotado porque el día que alguien lo necesite conviene que sepa que no está.
- **Una prueba que espera un `throw` puede estar verde por el motivo equivocado.** Pasó con dos de
  las cuatro pruebas nuevas de D-35: el evento forjado heredaba el `resultingStateHash` del evento del
  que se copiaba, así que el replay lo rechazaba por `STATE_HASH_MISMATCH` **antes** de llegar al
  invariante — pasaban con la guarda y sin ella. El control positivo (retirar la guarda y comprobar
  que la prueba cae) es lo que lo destapó; sin él se habrían quedado así.
- **Los archivos de prueba no se typechequean.** `tsc -p tsconfig.json` incluye sólo `src/**/*.ts` en
  todos los paquetes, y vitest no typechequea. Consecuencia real y observada: un error de nombres de
  campo en una prueba (`tokensIn` en vez de `inputTokens`) salió en ejecución y no en compilación.
  No se arregló porque activar el typecheck de pruebas probablemente destape errores en las 85
  suites, y eso es una tarea con su propio alcance. **Pero conviene saberlo: una prueba que compila
  en tu cabeza no compila en ningún sitio.**

---

## 1. Qué es esto

Ejecución del `Plan.md` que está en la raíz del repositorio. Jerarquía de autoridad (§0.1):

1. `docs_maes/Profesor_IA_Documento_Maestro_Normalizado_v2.12_PostUI_PrePlan.md` (**Maestro**)
2. `docs_maes/Profesor_IA_Especificacion_UI_UX_v0.1_Conformada.md` (**UIUX**)
3. `Plan.md`
4. Implementación

**Si el código contradice al plan, el código está mal. Si el plan contradice al Maestro, el plan
está mal.** Ya pasó tres veces: ver §«Correcciones por autoridad superior» en `PLAN_STATUS.md`.

Los tres documentos de autoridad **están presentes** en `docs_maes/`. El Maestro son 388 KB: no
intentes leerlo entero, navega por secciones con Grep (`^#{1,3} `) y lee solo lo que la tarea cita.

---

## 2. Estado por fase

| Fase | Estado |
|---|---|
| **F0 · H0** repositorio, contratos, CI | Completa. Gate abierto solo por falta de ejecución verde en `main` |
| **F1 · H1** BD, roles, evidencia | Completa. El gate solo espera firma y ejecución en `main` |
| **F2 · H2** verificador | 16 de 16 tareas. **Todo el AC cubierto**; el gate solo espera firma y ejecución en `main` |
| **F3 · H3** entorno local | 4 de 5. Falta `T-H3-05` (trazas). **Ya no está bloqueada:** la sesión seca completa es la primera operación instrumentable |
| **F4 · H4** pasarela de modelo | **10 de 12 + `T-H4-10` en curso.** Harness construido y piloto corrido (MXN 1.51). Falta el conjunto material de 200 casos y resolver los cuatro puntos de §3.0.b. `T-H4-11` (BENCH-02) sigue bloqueada: exige dos proveedores y OpenAI aún no puede entrar |
| **F5 · H4.5** investigación de fuentes (W0) | **8 de 8.** Falta la corrida W0 real sobre fuentes y la firma del `CORPUS_APPROVER` |
| **F6 · H5** ingesta, autoría y freeze (W1–W5) | **17 de 17 mecanismos.** Gate abierto: faltan corpus, corrida W1–W5, auditoría, CAL-NLI material, clave y firma reales |
| **F7 · H6** sesión determinista sin LLM | **14 de 14 y AC del gate cubierto.** `ci:mode-separation` (12 propiedades) + `ci:e2e:dry-session` (33). Sólo falta observar la corrida en `main` y firmar el acta |
| F8–F16 | No empezadas |

### Los tres muros que no se tiran con código

Conviene tenerlos delante antes de planificar nada más allá de F7:

1. **F8 necesita un ganador.** `T-H7-01` integra «el binding ganador» de `BENCH-01`, y `T-H4-10/11`
   siguen bloqueadas por credenciales de proveedor y autorización de gasto. Los mecanismos de F8
   —anclaje obligatorio, filtro de egreso, suite adversarial— **sí** se pueden construir contra
   transporte inyectado; el gate H7 no se puede firmar sin una sesión real.
2. **F10 necesita proveedores de pago.** STT y TTS (`T-H8-01/02`) y las puertas BENCH-03 exigen
   Deepgram/ElevenLabs/OpenAI reales. Pizarrón, overlay de anotaciones, captura interna y atribución
   de fallos son construibles sin ellos.
3. **F11 no es una tarea de código.** `T-LSU-01` es la corrida del propietario de principio a fin, y
   su AC exige una decisión registrada por él. Ninguna cantidad de implementación la produce.

A eso se suma que **nadie ha corrido W0 sobre fuentes reales**, así que `content/` sigue siendo
placeholders. F7 cierra igualmente porque el plan admite «paquete sintético de desarrollo
equivalente» (§F7, Dependencias); de F8 en adelante esa puerta ya no existe.

Van **77 de 148 tareas** del plan (contadas sobre `PLAN_STATUS.md`). Detalle tarea por tarea, con
evidencia y fechas: [`PLAN_STATUS.md`](PLAN_STATUS.md).
Actas de gate: [`../gates/`](../gates/) — `H0.md`, `H1.md`, `H2.md`, `H3.md`, todas **abiertas**.
No hay acta de `H4` ni de `H4.5`: ninguna de las dos fases está en condiciones de firmarse.

### Cuánto falta para poder usarlo

Contando tareas del plan, que es una aproximación —no pesan igual— pero es la única medida que no se
inventa:

| Hito | Qué significa | Avance |
|---|---|---|
| Sesión seca (fin de F7) | Una clase completa con guion fijo, sin IA en vivo | **72 %** |
| Clase real (fin de F8) | Lo mismo, conducido por el modelo ganador | **68 %** |
| `LOCAL_SELF_USE` (F11) | El propietario lo usa de principio a fin, con voz y pizarrón | **52 %** |

**Dos cosas que no se arreglan programando**, y por eso el porcentaje no cuenta toda la verdad:
falta elegir el modelo (`T-H4-10/11` necesita credenciales y autorización de gasto) y falta corpus
real (nadie ha corrido W0 sobre fuentes reales, así que no hay contenido con el que enseñar).

---

## 3. Por dónde seguir

### Nota: este apartado quedó rancio y se conserva como referencia

Encabezaba «la tarea siguiente: `T-H6-09`», que está **`VERIFICADA` desde el 17-08** (CI
`32058743421`). Lo que sigue vale como mapa de qué mecanismos existen y no hay que rehacer; **para
saber por dónde seguir, §3.1**.

#### `T-H6-09` — bitácora de evidencia reconstruible

`T-H6-01…08` ya construyen estado/replay, decisión de estrategia, dominio/reconfirmaciones,
recuperación, pistas congeladas, autoridad aislada de sondas, calendario SCED global e
interrupciones tipadas. `H6-08` separa el reloj de reactivo, que decide `measurement-worker`, del
deadline de sesión, que aporta el motor; proyecta los efectos sin conceder autoridad pedagógica ni
reclasificar validez. `CAL-10/CAL-WHEEL` sigue pendiente en material y BKT sigue ausente por CAL-11.

`T-H6-09` debe emitir un `EvidenceEvent` por cada acto, con `previousHash/hash`, `decisionMaker`,
`autonomyStatus`, versiones y validez. Las correcciones deben quedar enlazadas como
detección→clasificación→invalidación→reposición→resolución, sin reescribir historia. Desde el ledger
se deben reconstruir las proyecciones de sesión, dominio, cobertura, estrategia, elegibilidad,
wheel-spinning, intervención, carga, incidentes y resultados. La implementación debe reutilizar el
contrato y la cadena hash ya existentes, no crear una segunda fuente de verdad.

Lo que ya está puesto y conviene usar en vez de rehacer:

- **`W1_ingesta`** es el estado terminal bueno de la máquina W0 (`authoring-core/src/w0-state.ts`), y
  es donde F6 arranca.
- **`fragmentId()`** (`ingestion.ts`) es pública para que W2 recalcule el ancla sin preguntarle a W1.
- **`KC_CATALOG`** (`kc-map.ts`) trae los dieciocho KC con dependencias tipadas y `rule_id` derivados
  del cálculo; **`crossSetEdges()`** ya enumera FORMAL y POLITICA_CONTENIDO por separado, que es lo
  que `T-H5-12` necesita.
- **`STRATEGY_CATALOG` y `toDecisionStrategy()`** (`pedagogy.ts`) fijan el catálogo de doce y fallan
  cerrado en las dos entradas sin miembro de enum.
- **`runW3Generation()`** (`generation.ts`) devuelve `items` y `privateSolutions` **separados**, con
  `structuralSignature` e `itemFamilyId` por reactivo ya calculados. `findDuplicateAmong()` es
  pública y probada con proofs a mano.
- **`reserves.ts`** trae las diez reservas, su directorio, la separación física y la **semántica**:
  `collisionProhibited()` es la regla de qué colisión está prohibida y vive en un solo sitio;
  `MEASUREMENT_RESERVES` se deriva del contrato de sondas; `assertReserveDisjointness()` comprueba el
  paquete entero. La política compartida ya la aplica `T-H6-06`; el calendario sólo solicita la
  combinación conjunto/fase/tipo y nunca elige una reserva alternativa.
- **`SCED_OPPORTUNITY_H5_V1`** (`packages/experiment/src/sced-opportunity.ts`) congela `k_set=3`,
  mínimo válido 2 y el sobre conservador de oportunidades; `measurement-worker` y el calendario
  rechazan un plan primario que discrepe.
- **`FamilyRegistry`** (`family.ts`) fija el `item_family_id` en la primera asignación. **Pásaselo a
  `runW3Generation()` entre corridas**: con uno nuevo por corrida, reasignar familias es gratis y el
  umbral del 30 % de `T-H5-09` se calcula sobre otra cosa. `members()` es lo que `T-H5-09` y
  `T-H5-14` necesitan contar.
- **`coverage.ts`** trae los pisos de P-III §4.2 como **datos con `parameterId`**, la regla del 20 %
  ya implementada y las tres entradas que se exigen declaradas (KC del piloto, puntos críticos, tipos
  de error prioritarios). `requiredProbesForCalendar()` recibe el sobre congelado por T-H5-11 y
  deriva 57 sondas nominales; `probeInventoryGaps()` exige 69 con la reserva adicional.
- **`complexityIndex()`** falla cerrado esperando a `T-H5-10` (`CAL-09`). H6 no abre sin eso, y
  `assertMeasuredMatchesTargetComplexity()` de `generation.ts` es el otro punto donde se enchufa.
- **El orden del pipeline de validez sigue sin congelar** (`BENCH-04`): `resolveValidityVariant()`
  exige el orden como dato con procedencia y `freezeWinningOrder()` sigue fallando cerrado. No lo
  cablees; se congela con una corrida sobre el corpus real, que todavía no existe.
- **Los `CAL-*` de F5 se congelan en esta fase**: `CAL-SOURCE-SCORE`, `CAL-SATURATION` y `CAL-NLI`
  tienen su punto de fallo escrito en `authoring-core` y esperan corpus real.

Lo que queda abierto y **no** bloquea a F6:

- **`T-H3-05`** (trazas) espera una operación real que trazar, en F7/F8.
- **Los gates H0–H3** esperan firma humana y ejecución verde en Actions, no más código.
- **Infisical** necesita que crees su cuenta administrativa a mano.
- **`T-H4-09/10/11`** esperan credenciales y gasto; ver §3.c.

---

## 3.a Lo cerrado el 16-08

### `T-H5-09` — límites de regeneración

`regeneration.ts` aplica 5 intentos por candidato, 3 regeneraciones por familia y el umbral
estricto de >30 % como datos con `parameterId`. El denominador sale de `FamilyRegistry.members()` y
un miembro rechazado cuenta una vez aunque se reprocese. La tercera regeneración autorizada se puede
evaluar; se bloquea pedir la cuarta. El informe al agente solo expone los códigos cerrados de W3 y
restricciones de un catálogo cerrado; las causas detalladas quedan en el registro de auditoría. Un
rechazo sin certificado no recibe una familia inventada. Son 13 pruebas nuevas, 1001 totales.

### `T-H5-10` — `CAL-09`

`cal-09-v1` quedó congelado con 13 soluciones sintéticas verificadas, sin datos de participante.
Los pesos se derivan por concordancia ordinal y la prueba de drift reproduce manifiesto, ids y hash.
El índice queda acotado 0…100; baja/media/alta usan puntos medios entre medianas y la comparabilidad
estructural máxima es `12.065296`, declarada expresamente como no psicométrica. W3 ya mide y rechaza
la discrepancia contra el objetivo de Rol C. Son 10 pruebas nuevas, 1011 totales.

### `T-H5-11` — oportunidad SCED y cobertura

`sced-opportunity-h5-v1` fija `k_set=3` y mínimo válido `2` con un procedimiento de ingeniería
reproducible: menor microbatería que conserva mayoría y tolera un ítem inválido, sin datos de
participante ni pretensión psicométrica. El peor inicio permitido de C (14) más cinco observaciones
posteriores produce 19 rondas válidas concurrentes: 57 sondas únicas nominales por conjunto y 69
con la reserva mínima del 20 %. La cobertura rechaza conjuntos ausentes, planes incoherentes, IDs
repetidos e inventario insuficiente. Son 9 pruebas nuevas, 1020 totales.

### `T-H5-12` — selección A/B/C

`experimental-selection.ts` implementa propuesta, validación, ranking, revisión y freeze. Separa
F/PC, bloquea dependencia completa hacia un conjunto posterior, registra carryover, compara todos
los pares con CAL-09, verifica 69 sondas independientes y una transferencia por set, y evita usar
KC de soporte como diferenciadores. El auditor solo revisa plausibilidad de la propuesta ganadora.
El mecanismo está completo, pero `experimental-sets.yaml` permanece placeholder: congelar una
selección sin corpus, perfiles ni bancos reales fabricaría evidencia. Son 8 pruebas nuevas, 1028
totales.

### `T-H5-13` — linter integral

`content validate` dejó de ser stub y ejecuta 20 controles cerrados: los 19 de P-II §5.5 y el
recálculo de `masteryDisqualifying`. El informe agrega todos los fallos y falla por vacío. La función
pura de autoridad se adelantó desde T-H6-03: nivel 1 solo conserva elegibilidad como recordatorio
no decisivo; niveles 2–5 descalifican. El paquete real no tiene `lint-input.json`, así que el comando
sale con código 2 en lugar de aprobar placeholders. Son 7 pruebas nuevas, 1035 totales.

### `T-H5-14` — auditoría previa

`cal-audit-pre-v1` selecciona por hash+semilla, cubre cada estrato observado, aplica 20 %/mínimo 5
por función y uno por KC, e incluye todo alto riesgo sin desplazar pisos. El codebook y los cinco
gates son ejecutables; se conserva `x/n` y todo seleccionado exige juicio explícito. Un bloqueo solo
se remedia regenerando la familia completa, con causa raíz, semilla nueva y regresión. La corrida
real espera al paquete real. Son 11 pruebas nuevas, 1046 totales.

### `T-H5-15` — freeze firmado, publicación y drift

`experiment freeze` dejó de ser stub y el contrato `FreezeManifest` pasó del esqueleto v0 a una v1
material: inventario no vacío, 18 secciones exactas, linter íntegro, siete capacidades exactas y
firma Ed25519. El comando exige los grupos materiales de §4.3 —un README no cubre un banco—,
versiona y hashea cada sección, enlaza cálculo/auditoría/SCED/capacidades y no acepta placeholders,
symlinks, hardlinks, una clave ausente o un freeze previo. La publicación usa temporal exclusivo,
`fsync`, rename, segundo inventario y modos `0400/0444/0555`; `ci:freeze:drift` informa bytes
cambiados, añadidos y retirados. La documentación operativa está en `docs/content/freeze.md`.

No se congeló el paquete real: siguen ausentes corpus, W3, auditoría, clave y aprobación. El check
sobre el placeholder v0 falla cerrado y eso es evidencia correcta, no un rojo que deba silenciarse.
Las firmas de la suite son claves efímeras de fixture. Son 14 pruebas nuevas respecto del checkpoint
anterior y 1060 totales: 933 unitarias + 127 contra PostgreSQL real.

### `T-H5-16` — BKT sombra opcional, congelado OFF

No se inventaron parámetros CAL-11. `bkt-shadow-disabled-h5-v1` fija BKT en `enabled=false`, sin
parámetros, visible solo para análisis y sin efecto sobre avance, dominio, recuperación o cierre.
El validador de freeze acepta únicamente ese literal; intentar habilitarlo con cifras ad hoc falla
con `CAL-11`. La barrera SQL ya implementada sigue siendo parte de la evidencia: `svc_session`
puede escribir `shadow_metric`, pero la suite PostgreSQL demuestra que no puede leerlo y por tanto
no puede devolverlo al agente o a la política. Son 4 pruebas nuevas, 1064 totales.

### `T-H5-17` — arnés AIS y CAL-06/CAL-NLI

El arnés exige preinscripción, binding, codebook, estratos idioma×forma lógica×KC×tipo, criterios
aportados externamente, inventario hasheado y juicios AIS trazables. No trae umbrales por defecto.
Verifica que el fragmento reproduzca el hash W1 y que el inventario material coincida con su hash;
una muestra vacía falla `CAL-NLI`. Reporta TP/FP/TN/FN, tasas FP/FN, precisión y recall por estrato,
con numeradores y denominadores; el agregado lleva `authorizesGate=false`. Un `test_fixture` jamás
demuestra fiabilidad. `nliGate` requiere evidencia material del binding y estrato exactos y aun así
no se convierte en veredicto final. No se creó muestra, informe ni gate real. Son 12 pruebas nuevas,
1076 totales. Procedimiento: `docs/content/groundedness-calibration.md`.

### `T-H6-01` — estado estructurado y replay

`session-state-v1` implementa la secuencia primaria literal, los ocho transversales y todos los
campos de P-I §8.2. Cada decisión agrega automáticamente decisor/autonomía; `model` no puede ser
autoridad. Los eventos enlazan hash anterior/resultante sobre JSON canónico y el replay rechaza
huecos, orden, tiempo, IDs o hashes adulterados. PostgreSQL persiste el JSON completo+hash y compara
sus escalares; una instalación con filas históricas incompletas exige replay material en vez de un
backfill inventado. BKT queda ausente en código y BD. Son 16 pruebas unitarias y 3 PostgreSQL nuevas:
1095 totales. Diseño: `docs/session/state-machine.md`.

### `T-H6-02` — política pedagógica determinista

`pedagogy-policy` dejó de ser esqueleto. La tabla es JSON estricto con versión, hash canónico,
jerarquía, patrones, controles y binding de calibración. El registro de corrida fija
`runId→purpose+version+hash` sin reasignación. La evaluación por etapas impide que retrieval/fading
se adelanten a seguridad o prerrequisitos; `MEASUREMENT_MODE` suprime la decisión. Las diez
estrategias siguen siendo las del contrato: fading reduce ayuda y feedback es un adjunto. Retrieval
solo acepta motor/calendario y reserva de práctica; autoexplicación solo acepta tres disparadores.
Una estrategia independiente no vuelve elegible el intento por sí sola: exige confirmación
estructurada de `domain_engine`. Los bindings se restauran desde JSON y conservan la prohibición de
reasignación tras reinicio. La política material incluida conserva `CAL-10/CAL-WHEEL=pending`; los
valores de las pruebas son `test_fixture` y no autorizan corrida material. Son 29 pruebas nuevas:
1124 totales. Diseño:
`docs/session/pedagogy-policy.md`.

### `T-H6-03` — dominio operativo y reconfirmación

`domain-engine` aplica la regla literal versionada y congelada por corrida: tres correctas
elegibles consecutivas con complejidad CAL-09 no decreciente y al menos una transferencia cercana
elegible. La identidad CAL-09 se compara contra el manifiesto congelado de H5; no se recalibra ni
reordena. La autoridad de ayuda se deriva por código: el nivel 1 solo conserva elegibilidad como
recordatorio puro, mientras niveles 2–5, selección de regla/paso y contenido decisivo siempre
descalifican. El modelo y BKT no tienen entrada autoritativa.

Los aciertos con ayuda decisiva requieren reconfirmación enlazada. Cada declaración crea un
`post_mastery_reconfirmation_pending`; la primera oportunidad disponible de práctica independiente
en `LEARNING_MODE` se programa, y hasta resolverla quedan bloqueadas la práctica ordinaria que la
saltaría, la reenseñanza deliberada y la siguiente sesión que vuelva a hacer objetivo al KC. Una
incorrecta observada registra `reconfirmation_failed`; retirada, cierre, incidente o ausencia
válida son `missing`, no falso dominio. Replay conserva todas las declaraciones, evaluaciones e
historias terminales y se proyecta al estado reconstruible de sesión.

Son 27 pruebas de dominio y una integración de sesión nuevas: **1152 totales** (1022 unitarias +
130 PostgreSQL). `CAL-DOMAIN-POLICY/DUP-02` solo validan en seco la regla vigente; no se simuló
calibración ni se cerró H10. Diseño: `docs/session/domain-engine.md`.

### `T-H6-04` — recuperación y límite pedagógico

`domain-engine` materializa los tres ciclos exactos de P-I §8.7 y congela política, grafo e
identidad del inventario por corrida. Solo un fallo `PEDAGOGICAL` en `LEARNING_MODE` inicia: el
feedback debe coincidir con el error observado; complejidad realmente baja; los KC revisados son
prerrequisitos del grafo; scaffolding es contingente; la representación cambia y la
autoexplicación queda selectiva. Material fallido o consumido no reaparece. Progreso vuelve a la
evaluación de dominio sin declarar dominio desde una sola actividad; operación, interfaz,
incidente, retirada o falta de reserva no se convierten en fallo conceptual.

Los episodios posteriores exigen `recovery_reserve_registry`, inventario congelado, reserva
`recovery`, mismo KC y material distinto. Programar no cuenta; iniciar sí. El contador y los fallos
son por KC: dos episodios consumidos alcanzan el tope, pero solo dos fallidos declaran límite. En
ese caso se cierran transitivamente las rutas FORMAL, POLITICA_CONTENIDO y PEDAGOGICA; C/A y
ESTADISTICA no bloquean. Estado, contadores y caminos se derivan de historia y replay. Sesión
proyecta estrategia, andamiaje, plan y próximo paso, con el transversal `recuperacion` como evento
separado. No hay salida de rescate docente.

Son 25 pruebas de recuperación y una integración de sesión nuevas: **1178 totales** (1048
unitarias + 130 PostgreSQL). Los inventarios y grafos de prueba son `test_fixture`; no se fabricó
inventario/corpus/firma/gate material. Diseño: `docs/session/recovery.md`.

### `T-H6-05` — banco y autoridad de pistas

`domain-engine` fija una política hasheada con los cinco niveles literales y un banco congelado por
corrida. Cada reactivo debe traer exactamente un registro por nivel y un solo KC. Reactivo, KC,
nivel, hechos, texto, anclajes, pipeline, paquete y evidencias quedan ligados: el nivel 4 exige la constancia no isomorfa del
canonicalizador, y la validación de no revelación cubre el contenido exacto que se entrega. El
runtime no carga soluciones ni transforma texto. La detección automática de autoría se declara
literal, no de paráfrasis; W4 sigue siendo necesaria y no se simuló.

La autoridad decide por item+nivel exactos, sin fallback. `MEASUREMENT_MODE` y nivel 0 se resuelven
antes de consultar si existe el item. Repetir una pista no duplica la entrega y un intento no puede
cambiar de reactivo. Nivel máximo y `masteryDisqualifying` se derivan de las entregas mediante
`domain-engine`: nivel 1 sólo conserva elegibilidad como recordatorio puro; niveles 2–5 y contenido
decisivo descalifican. La propuesta del generador debe coincidir para pasar el linter, pero nunca se
copia como autoridad.

El binding persistible fija política+banco+paquete y material exige hashes externos. Replay valida
historia y, al continuar desde un snapshot, vuelve a contrastar cada entrega completa contra el
banco. `session-engine` proyecta sólo niveles/máximo/bandera con identidad coincidente, nunca texto
ni solución. Son 23 pruebas de pistas y una integración de sesión nuevas: **1202 totales** (1072
unitarias + 130 PostgreSQL). Sólo se usaron bancos `test_fixture`; no se fabricó banco, corpus,
auditoría, firma ni gate material. Diseño: `docs/session/hint-bank.md`.

### `T-H6-06` — autoridad aislada de medición

Los contratos `Probe*` quedaron estrictos y comparten con autoría un único catálogo de reservas,
mapeo solicitud→reserva y exclusiones por consumo. La sesión sólo puede pedir conjunto, fase y tipo;
entrar fuerza `MEASUREMENT_MODE`, ayuda cero y no elegibilidad, y salir consume el resultado del
worker sin poder reclasificar validez.

`measurement-worker` liga por corrida política, inventario y semilla versionados/hasheados. Material
exige hashes externos; los fixtures no los suplantan. El plan primario debe coincidir con el freeze
H5 de 3 ítems/mínimo 2. La selección SHA-256 usa semilla privada, entrega un solo prompt por vez y
registra selección+consumo antes de devolverlo. No expone banco, semilla, familia, firma estructural,
solución, pista ni feedback. Tiempo/verificador salen del inventario y la validez se deriva de una
política de reason codes; reserva agotada queda faltante salvo mínimo ya alcanzado.

Replay/restauración rederivan plan, ranking, prompt, ordinal, consumo y resultado. La persistencia
usa un CTE compare-and-set y una prueba PostgreSQL con dos conexiones concurrentes demuestra un solo
ganador y un solo consumo. Son 25 pruebas del worker, cuatro ampliaciones de contratos, dos de
sesión y una PostgreSQL: **1234 totales** (1103 unitarias + 131 PostgreSQL). No se creó calendario,
inventario, semilla, preinscripción, firma ni gate material. Diseño:
`docs/session/measurement-authority.md`. El calendario se cerró en `T-H6-07`; las interrupciones
se cerraron en `T-H6-08`.

### `T-H6-07` — calendario SCED global

`packages/experiment` contiene una política y una semilla estrictas, versionadas, hasheadas y
ligadas inmutablemente por corrida. El modo material exige los hashes externos del freeze; ningún
estado ni artefacto público expone la semilla. El triple planificado se deriva por SHA-256 solo de
combinaciones que ya cumplen ventanas A 6–8, B 9–11, C 12–14 y separación mínima 3.

Cada `probe_round` abre exactamente tres `ProbeRequest`, una por conjunto. Solo las tres
observaciones válidas y compatibles con el 3/2 de H5 avanzan una vez el contador y alimentan las
series; parciales y oportunidades bajo mínimo quedan descriptivas y `schedule_invalid`. La
estabilidad, el diferimiento máximo de dos rondas válidas, el límite de ventana, la separación
efectiva y el cierre en 19 rondas se rederivan en replay. Las actividades no-ronda nunca avanzan y
la covariación se registra sin reinterpretarla.

El dominio por conjunto agenda retención exactamente siete días después, con reserva exclusiva y
sin `probe_round`; hasta resolverla, la reenseñanza dirigida del conjunto queda bloqueada. Son 25
pruebas del calendario y una integración pública calendario→worker: **1260 totales** (1129
unitarias + 131 PostgreSQL). Una mutación sembrada de `every` a `some` fue detectada por la prueba
de ronda inválida. Los fixtures no afirman inventario, semilla, binding, preinscripción, firma ni
gate materiales. Diseño: `docs/session/sced-calendar.md`.

### `T-H6-08` — interrupciones en modo de medición

`measurement-authority-policy-v2` congela las semánticas literales, el mapeo de reason codes y una
taxonomía explícita código+nivel+efecto. La pausa pre-ítem no selecciona ni consume; la post-ítem
conserva el consumo previo, deriva `invalid_participant_pause`, no da feedback y exige reanudación
enlazada. Una duda sólo permite silencio o información de derechos/procedimiento, conserva el
deadline exacto y nunca entrega ayuda pedagógica.

El timeout interno se verifica contra `selectedAt + timeLimitSeconds` del inventario y conserva la
rúbrica congelada. El fin de sesión recibe un `sessionDeadlineAt` explícito de la autoridad de
sesión, exige que haya vencido y fuerza `missing_session_time`; retirada exige referencia a la
decisión de consentimiento, fuerza `withdrawal` y prohíbe reposición. Los incidentes usan el
contrato canónico: nivel 1 continúa, nivel 2 invalida el acto enlazado y deja una posible reposición
independiente al calendario, y nivel 3 invalida la corrida y la suspende.

El resultado genérico ya no admite reason codes inyectados: el worker los deriva de eventos
tipados. Un contrato público proyecta pausa, duda, invalidación, incidente o retirada en
`session-engine`, con hash/replay y sin exponer banco, solución, semilla ni autoridad pedagógica.
Restauración vuelve a derivar tiempo, rúbrica, resultados no válidos, pausa, taxonomía, disposición
y cierres. Son 13 pruebas nuevas del worker y una ampliación de sesión: **1274 totales** esperadas
(1143 unitarias + 131 PostgreSQL). Las mutaciones pre↔post y de omisión de la revalidación de
rúbrica quedaron detectadas. Los
fixtures no afirman taxonomía, deadline, inventario, manifiesto, firma ni gate materiales. Diseño:
`docs/session/measurement-interruptions.md` y decisión D-24.

---

## 3.b Lo cerrado en la sesión del 15-08, cuarta

Cuatro tareas —`T-H5-05` a `T-H5-08`—, seis módulos nuevos en `packages/authoring-core`
(`generation.ts`, `hints.ts`, `critique.ts`, `reserves.ts`, `family.ts`, `coverage.ts`) y **151
pruebas nuevas** (837 → 988).

### `T-H5-05` — W3, autoría automática

Los diez pasos de §12 «W3». Tres decisiones lo gobiernan, y las tres son sobre lo que el pipeline
**no** puede hacer:

1. **Rol C no entrega la solución, y no hay campo donde ponerla.** El tipo lo impide en compilación
   y `assertNoAuthoritativeSolution()` lo impide cuando el objeto llega como JSON del modelo.
   Aceptarla convertiría el texto de un modelo en el patrón contra el que se califica al alumno.
2. **El orden del pipeline de validez no se cablea.** Entra como dato con procedencia —arnés,
   corrida, versión del paquete— o no se ejecuta; con solo un informe del arnés se cae por
   `freezeWinningOrder()`, que **se ejercita en vez de esquivarse**. Un orden congelado sobre la
   muestra L0 se rechaza. Y W3 **ejecuta la variante misma de `BENCH04_VARIANTS`**: si lo que corre
   en autoría no es lo que se midió, la medición no dice nada de esta corrida.
3. **La solución no cabe en el registro público del reactivo.** `W3ItemRecord` **no tiene campo**
   para el certificado; van en `privateSolutions`, aparte. Es la separación física del paso 10
   llevada al tipo: serializar el registro entero hacia `items/` no puede sacarla.

Lo demás, en orden: los cuatro estados de autoría de §7.4 distinguidos y `no_proof_exists_in_calculus`
ausente (CALC-03); re-verificación del certificado **otra vez** aquí, en función aparte para poder
probarla con un certificado inválido sin abrirle al pipeline un `verify` inyectable; los filtros de
§7.5 con la meta trivial comprobada **antes** de buscar —`A∧B ⊢ A∧B` vuelve con `proof_found`—;
complejidad medida y **no comparada** con la objetivo, que exige `CAL-09`; duplicado trivial e
isomorfismo reportados por separado porque piden arreglos distintos; Rol D con la propuesta de
`masteryDisqualifying` guardada **como propuesta**; y Rol E cuyo veredicto **no mueve la aceptación
en ninguna dirección**.

### `T-H5-06` — reservas sin solapamiento

Toda la tarea la decide **una palabra de P-I §7.7**: «isomorfismos **prohibidos**», no
«isomorfismos».

- **Dentro de una misma reserva la colisión no está prohibida: es la familia.** §7.8 define familia
  como los candidatos que comparten plantilla, función de banco, KC objetivo y **la misma
  `structural_signature`**, y dice que renombrar átomos o reordenar pasos independientes **no crean
  una familia nueva**. Los miembros de una familia son isomorfos entre sí por definición.
- **Entre dos reservas de enseñanza tampoco**: practicar guiado y después independiente sobre la
  misma estructura es scaffolding y fading.
- **En cuanto una de las dos es de medición, sí.** §5.11 lo dice de las dos categorías de
  transferencia con todas sus letras.

Eso **corrigió un defecto de `T-H5-05`** que entró en el mismo commit: su paso 6 rechazaba todo
isomorfo sin mirar la reserva, lo que dejaba toda familia paramétrica en un solo miembro y volvía
inalcanzables los pisos de §7.8 y de P-III §4.2. No se veía con las pruebas en verde porque ninguna
comprobaba que dos gemelos de la misma reserva sobrevivieran.

Las reservas de medición se **derivan** del contrato de P-II §6.3 (`MeasureKind` × `ScedPhase`), y
las combinaciones que ninguna autoridad describe lanzan. El control de superficie de §5.11 es el que
**no necesita umbral** —igualdad de la redacción normalizada—; cualquier medida de parecido sí, y por
eso `surfaceSimilarity()` falla cerrado. **`DUP-01`**: `isolated` vale `null` —no `true`— cuando
alguno de los dos bancos de transferencia está vacío, y afirmar que el aislamiento está *demostrado*
falla cerrado con `CAL-07`: «no detecté» no es «no hay».

### `T-H5-07` — `item_family_id`

Derivado de los cuatro componentes, no asignado por contador (como el `fragment_id`, D-17). Así, «un
cambio real de estructura, función o KC **sí** crea familia distinta» es aritmética y no una regla
que alguien recuerde; y la redacción no puede moverla porque **no es uno de los cuatro componentes**.

Lo que la derivación sola **no** impide es la elusión real: `generator_template_id` es cadena libre,
así que reetiquetar la plantilla de un candidato defectuoso lo sacaría de la familia que va camino de
quedar bloqueada por `T-H5-09`. Eso lo cierra `FamilyRegistry`: la primera asignación fija, sin
`remove`/`clear`/`reassign`.

### `T-H5-08` — cobertura mínima

La frontera de la tarea es **qué cifra la norma y qué deriva del calendario**. Lo cifrado se
comprueba (6 actividades por KC, 3 niveles de pista, 1 transferencia, recuperación, trazabilidad, y
la reserva del 20 %). En ese checkpoint lo derivado del calendario todavía fallaba cerrado con
`CAL-01`; T-H5-11 ya lo cerró mediante el sobre congelado y mantiene el bloqueo si el banco no llega.

Los pisos van como **datos con `parameterId`**, no como números sueltos dentro de un `if`, porque
§4.2 exige identificarlos en el registro de parámetros y congelarlos. Tres entradas se exigen
declaradas —KC del piloto, puntos críticos y tipos de error prioritarios— porque sin ellas los pisos
que dependen de ellas pasarían por vacío. Y en retención hay dos salidas y ninguna más: medir con
reserva válida, o declarar `retention_not_evaluated` **con motivo**; decir que se medirá con la
reserva vacía **lanza en vez de degradarse solo al código**.

### Las cuatro cosas que las pruebas en verde no enseñaban

En `T-H5-05` se sembraron **36 mutaciones y las 36 quedaron detectadas a la primera**. Y aun así,
releyendo el módulo ya escrito aparecieron cuatro huecos que ninguna prueba señalaba:

1. **Una guarda exportada que el pipeline no llamaba.** `assertNoAuthoritativeSolution()` estaba
   escrita, probada y sin usar: un candidato con solución habría atravesado W3 entero.
2. **Ids repetidos.** Dos candidatos con el mismo id habrían guardado dos certificados bajo la misma
   clave en `solutions-private`.
3. **Huérfanos descartados en silencio.** Unas pistas o una crítica que apuntan a un candidato que no
   está en el lote se ignoraban; el paso 8 constaría como hecho sobre un reactivo que nadie criticó.
4. **Un estado inventado**, y es el peor: un candidato caído por sintaxis se registraba con
   `authoringState: search_budget_exhausted`, afirmando del buscador un gasto de presupuesto sobre
   algo que nunca vio —y el pipeline lo habría «arreglado» subiendo el presupuesto—. Ahora el estado
   de autoría **falta** cuando la búsqueda no corrió.

**Ninguno de los cuatro se veía con las pruebas en verde, ni con las 36 mutaciones detectadas.** La
siembra prueba que los controles que hay funcionan; no dice nada de los que faltan.

En total esta sesión sembró **103 mutaciones** (36 + 20 + 17 + 30) y **una sobrevivió**: la que
comprueba que el contrato de bancos de transferencia no se ha separado del catálogo de reservas. Solo
salta si los dos divergen, y hoy no divergen —guarda que no se puede disparar desde fuera—. Se hizo
inyectable con valores por omisión, como `findCycles(edges)`, y entonces se pudo probar.

Y el patrón se repitió en las cuatro tareas: **cada una dejó huecos que solo aparecieron releyendo el
módulo con todo en verde**. En `T-H5-06`, que W3 mataba las familias. En `T-H5-07`, que un defecto
del candidato se convertía en fallo del pipeline. En `T-H5-08`, dos: la transferencia de medición
cubriendo un piso que dejaba el dominio inalcanzable, y la capacidad de reconfirmación contada en
total en vez de por KC. **Ninguno lo señaló una prueba ni una mutación.**

### Y un defecto real de `proof-search` que W3 destapó

`linearize()` emitía todas las premisas y, si la meta ya estaba entre ellas **sin ser la última**, no
añadía línea: la derivación terminaba en otra fórmula, `verify` devolvía `goalReached: false` **sin
ningún código de error** y la re-verificación obligatoria escalaba a **incidente de nivel 3** una meta
que solo era trivial (`A, ¬A ⊢ A`). Corregido reiterando la conclusión en el ámbito principal, que es
la convención Fitch que el código ya aplicaba dentro de una subprueba, con prueba de regresión. El
`TrivialGoal` del contrato (P-II §4.4) estaba **declarado y sin usar**, y el hueco no se veía porque
todos los casos de prueba previos tenían la meta como **única** premisa.

---

## 3.c Lo cerrado en la sesión anterior (15-08, tercera)

Cuatro tareas, todas en `packages/authoring-core`, **118 pruebas nuevas** (719 → 837). Cada una con
su commit, su batería en verde y subida a `main` al terminarla.

### `T-H5-01` — W1, ingesta (`ingestion.ts`)

Los seis pasos de §12 «W1», las seis validaciones de bloqueo de P-III §3.2 y los siete campos de
fragmento de §3.3.

- **El orden de comprobación es el requisito**, igual que en la clasificación de salida de la
  pasarela: identidad → legibilidad → contenido. Si la deriva se mirara después, el informe diría
  «KC sin cobertura» de un documento que ni siquiera es el que W0 evaluó. Hay prueba con deriva **y**
  falta de cobertura a la vez de que gana `CorpusDriftError`.
- **Una deriva de hash no se resuelve actualizando el snapshot.** Actualizarlo borraría el hecho de
  que la fuente cambió después de evaluarse; la salida es reevaluar en W0.
- **La identidad tiene dos mitades**: los bytes y la etiqueta de versión. La segunda viaja dentro del
  `fragment_id`, así que aceptar los mismos bytes bajo otra versión haría que las anclas citaran una
  versión que nadie evaluó.
- **W1 no vuelve a clasificar licencias.** Los veredictos por uso entran como dato de W0 y **un uso
  no declarado no está permitido**. Es lo que hace que el caso Calgary sobreviva a la ingesta: el
  material entra como fuente documental y sus fragmentos **no** son base expresiva.
- **`kcsWithoutExpressiveBase` no bloquea, y es a propósito**: ninguna autoridad dice que deba. Pero
  sin ese dato, W3 descubriría en plena autoría que no puede construir reactivos para un KC y el
  hueco parecería un fallo del generador.
- **Los IDs de fragmento se derivan, no se numeran** (D-17). Un ID que solo W1 supiera construir no
  sería un ancla.
- **La legibilidad no tiene umbrales.** Vacío, U+FFFD y controles C0: hechos del decodificador. Una
  fracción mínima de caracteres legibles sería un parámetro que ninguna autoridad fija.
- **Tres entradas se exigen declaradas** (D-18): KC candidatos, secciones necesarias y familia de
  notación autorizada. Con lista vacía, sus tres validaciones pasarían **por vacío**.

### `T-H5-02` — W2, extracción curricular (`extraction.ts`)

- **El tipo de claim se comprueba, no se declara.** `cross_source_consensus` exige **dos componentes
  distintos** —dos fragmentos de la misma obra son una sola fuente, y un conteo de anclas lo daría
  por bueno— y `system_inference` **no puede citar fuentes**. Esa segunda regla importa más de lo que
  parece: §7.11 saca `system_inference` del denominador de atribución, así que una etiqueta falsa
  movería la métrica de groundedness sin que nadie tocara la métrica.
- **Las tres formas de no anclar se distinguen** porque exigen arreglos distintos: fragmento
  inexistente (cita inventada), hash que no cuadra (ancla envejecida) y fragmento sin permiso
  documental de W0 (atribuir a material no citable fabricaría la cadena).
- **Las decisiones pedagógicas van aparte y no son claims** (§7.11 literal), con soporte y
  justificación obligatorios. Mezcladas, una decisión nuestra se leería como algo que la fuente
  afirma.
- **W2 no juzga la verdad de nada**: anclaje, tipo e identidad. Que el claim se siga del fragmento lo
  mide `T-H5-17`, y el NLI nunca es autoridad.

### `T-H5-03` — mapa de KC (`kc-map.ts`)

- **Los `rule_id` se derivan de `logic-core`**, no se copian. Copiados, mapa y cálculo podrían
  separarse sin que nada lo notara, y el desajuste aparecería en la primera corrección.
- **`KC12 PC:KC10` es la única arista de política de contenido** del catálogo. Tratarla como formal
  afirmaría una necesidad del cálculo que el Maestro niega por escrito.
- **`KC17` no tiene arista a `KC16`**: el orden entre ambas es pedagógico, no necesidad formal.
- **Las aristas cruzadas se enumeran por tipo, nunca sumadas.** Un total diría cuántas rutas de
  contaminación hay pero no cuál se puede quitar cambiando una política, que es lo que decide la
  selección de conjuntos.
- **Justificar un ciclo no silencia los demás.** Una arista puede cerrar más de uno, y bastaría
  justificar el más inocente.

### `T-H5-04` — política pedagógica (`pedagogy.ts`)

- **El catálogo de estrategias es de doce y el enum de decisión de diez, y la asimetría es del
  Maestro.** P-I §5.10 enumera doce acciones; P-II §7.2.1 da —con las palabras «por ejemplo»— un
  contrato con diez. **No se arregla inventando dos miembros de enum**: cada entrada sin miembro
  declara por dónde se expresa, y `toDecisionStrategy()` falla cerrado al pedírselo. `fading` se
  expresa bajando `assistanceLevel` —el *fading* es literalmente retirar ayuda— y `feedback` acompaña
  a la decisión en vez de competir con ella. Devolver «la más parecida» haría que la traza registrara
  que se dio ayuda justo en el paso en que se estaba retirando.
- **Ninguna regla de activación puede dispararse en `MEASUREMENT_MODE`.** §8.3.1 pone el modo por
  encima de la selección de estrategia; una regla que se activara midiendo se vería como una ayuda
  oportuna justo donde la medición deja de valer.
- **Los pasos de patrón que no son estrategias se registran como acción del motor.** Inventarle una
  estrategia a «volver al KC objetivo» afirmaría una decisión pedagógica donde solo hay una
  transición.
- **`fading` por reloj exige la evidencia de preinscripción que la norma exige**; sin ella mediría
  cuánto aguanta el alumno sin ayuda, no cuánto aprendió.
- **La revisión espaciada no consume reserva de medición**: gastarla consumiría el material con el
  que después se mide la retención.

### Lo que aquella sesión dejó como método

Se sembraron **43 mutaciones** en los cuatro módulos y todas acaban detectadas, pero **tres no lo
estaban al primer intento** y las tres enseñaron algo distinto:

1. **Un control que pasa por vacío.** El filtro de permiso documental de la cobertura de KC nunca se
   ejercitaba, porque todos los fixtures tenían ese permiso. Se añadió el caso que sí lo ejercita.
2. **Una prueba que pasa por el motivo equivocado.** La de «estrategia fuera del catálogo» usaba una
   matriz de una sola regla, así que fallaba por patrones no representables y no por el catálogo, que
   es lo que decía comprobar. Ahora usa la matriz completa y afirma el mensaje.
3. **Una guarda que no se puede disparar desde fuera.** Estaba atada a una constante interna. Se hizo
   inyectable —como ya lo eran `findCycles(edges)` y `assertAcyclicOrJustified`— y entonces se pudo
   probar.

**Ninguna de las tres se veía con las pruebas en verde.** Y una cuarta cosa apareció sin siembra,
releyendo `ingestion.ts` ya escrito: la etiqueta de versión no se comprobaba contra la que W0 evaluó.

---

## 3.c De sesiones anteriores

### F4 · H4 — pasarela de modelo: 10 de 12 + T-H4-10 en curso

Hecho: adaptadores propios, capacidades por binding, validación fail-closed de la salida, contexto de
sesión por whitelist con filtro de egreso, canarios, `pricing-manifest` + `cost-ledger`, control de
gasto, matriz de batch/caching y modo degradado. Cuatro checks nuevos en CI, todos en el job `arch`
—que es de los que sí pasan sin el PAT—: `ci:gateway:fail-closed`, `ci:gateway:contracts`,
`ci:canary`, `ci:cost:ledger`.

- **No hay ningún nombre de modelo ni parámetro de muestreo escrito en el código.** El id sale del
  binding; los parámetros los autoriza el binding. Escribir «claude-x» o «temperature: 0» en un
  adaptador anticiparía un ganador que solo `BENCH-01/02` decide.
- **`AuthorizedParameters` es un tipo de marca** que solo produce `authorizeParameters()`. No lo
  sortees con un cast: es lo que impide que un adaptador reciba parámetros sin contrastar.
- **`ModelGateway` no tiene `send()`**, solo `execute()` con esquema obligatorio. Se retiró a
  propósito: un `send()` crudo sería un camino para leer salida del proveedor sin validación local,
  que es el agujero que P-II §8.4 cierra.
- **El orden de clasificación de la salida es el requisito**: truncamiento, rechazo y error de
  proveedor **antes** que el esquema. Reordenarlo haría que un truncado se reportara como
  `schema_violation` y escondería la causa real.
- **El bloqueo por canario y el de presupuesto no se pueden levantar programáticamente.** No hay
  `unblock`, `reset`, `force` ni `continueAnyway`, y hay pruebas de que no existen.

**Las tres que faltan, y por qué:** `T-H4-09` (refresco documental) es `PENDIENTE` **por diseño** —la
norma pide hacerlo *inmediatamente antes* del benchmark, y adelantarlo produciría evidencia
caducada—; `T-H4-10` y `T-H4-11` están `BLOQUEADA(gasto y credenciales del propietario)`: exigen
llamadas reales facturables y, la segunda, dos proveedores de familias distintas.

### F5 · H4.5 — investigación de fuentes (W0): 8 de 8

Máquina de estados W0, sistema formal objetivo, licencias, descubrimiento, idoneidad/saturación,
manifiesto de selección, autorización externa y trazabilidad translingüe.

- **La whitelist de la base de datos no impone orden.** `operations.w0_state` tiene un `CHECK` de
  pertenencia que acepta saltar de `solicitud_curso` a `corpus_autorizado`. El orden lo impone
  `assertW0Transition`; si escribes al estado sin pasar por ahí, no hay flujo.
- **La clasificación de licencias no devuelve un booleano por recurso**, sino un veredicto **por uso
  previsto**. El caso Calgary obliga: el mismo material sirve como fuente documental del cálculo y
  está bloqueado como base expresiva.
- **`LICENSE_UNRESOLVED` no es `excluido`.** No resuelto espera a que alguien resuelva la
  proveniencia; excluido está decidido.
- **`assertNoHumanRewrite` es la mitad ejecutable de «sin reescritura pedagógica humana».** Si lo
  quitas, la regla vuelve a ser una declaración de intenciones y el veredicto de autonomía deja de
  poder medirse.
- **`suitabilityScore()`, `shouldStopDiscovery()` y `nliGate()` fallan cerrado a propósito.** Una
  parada inventada cierra el corpus antes de tiempo o quema presupuesto, y **ninguna de las dos se
  nota mirando el resultado**.

### F2 · H2 — cerrada; el gate espera firma

Las 16 tareas están hechas y **todo el AC está cubierto localmente**. Mutation testing terminó en
**90.31 % con cero mutantes sin cobertura**; los 112 vivos están clasificados en
[`../quality/mutation-baseline.md`](../quality/mutation-baseline.md).

Dos lecciones de método de ese trabajo:

1. **El reporte imprime el reemplazo, no el nodo mutado.** Dos mutantes distintos de una misma línea
   se ven idénticos. El script debe recortar por `location`.
2. **Una justificación de «rama inalcanzable» hay que intentar alcanzarla antes de escribirla.** La
   del oráculo semántico parecía sólida —toda regla autorizada es sana— y era falsa.

Y dos piezas que conviene conocer antes de tocarlas:

- **`T-H2-14` índice de complejidad** (`proof-search/src/complexity.ts`). Las medidas de P-I §7.6 en
  dos grupos: `structural` no depende del presupuesto, `searchRelative` sí. Esa separación es lo que
  impide leer «nodos explorados» como total de caminos. **No hay escalar**: `complexityIndex()` lanza
  `CalibrationPendingError` hasta que H5 congele los pesos.
- **`T-H2-16` arnés BENCH-04** (`proof-search/src/bench.ts`). Mide en L0 los dos órdenes equivalentes
  y marca cinco clases de hallazgo de seguridad; cualquiera vuelve el informe no comparable.

### F3 · H3 — entorno local

Levantado y endurecido. `pnpm run dev:env && pnpm run dev:up && pnpm run dev:seed`; el runbook está
en [`../../infra/runbooks/local.md`](../../infra/runbooks/local.md). `ci:infra:hardening` comprueba
159 propiedades sobre la configuración **resuelta** por Docker e imprime cuatro imposibilidades
técnicas registradas.

- **`T-H3-05`**: el colector corre y recibe, pero los servicios no emiten spans. No hay operación que
  trazar hasta F7/F8, y un span de «arranqué» para poder decir que hay trazas sería éxito simulado.
- **Infisical** necesita que su cuenta administrativa se cree a mano en <http://localhost:8080>.
  Hasta entonces los servicios leen credenciales de `.env`, que es el modo de arranque, no el de
  destino.

### F1 · H1 — cerrada

Better Auth 1.6.29 autoalojado, con sus seis tablas dentro de `identity` y prefijo `auth_` (D-14).

- **El correo no autentica solo.** No hay enlace mágico ni código por correo, y hay una prueba que
  falla si alguien los añade. Añadirlos violaría P-I §14.2.
- **`svc_api` no borra cuentas.** La supresión es de `svc_background`, que es quien atiende el
  derecho (P-I §14.5).

Lo que **no** está probado y no se afirma que lo esté: la ceremonia WebAuthn completa y el montaje de
rutas HTTP. Son de F7.

---

## 4. Cómo verificar que todo sigue en pie

```bash
pnpm install
pnpm run ci:lint && pnpm run ci:typecheck && pnpm run ci:unit && pnpm run ci:build
pnpm run ci:arch:depcruise && node scripts/arch/verify-depcruise-catches.mjs
pnpm run ci:logic:golden && pnpm run ci:logic:pbt && pnpm run ci:logic:no-net
pnpm run ci:gateway:fail-closed && pnpm run ci:gateway:contracts
pnpm run ci:canary && pnpm run ci:cost:ledger
pnpm run ci:mode-separation && pnpm run ci:e2e:dry-session
pnpm run ci:adversarial:session
pnpm run db:grants:check && pnpm run ci:db:negative
pnpm run ci:supply:sbom && pnpm run ci:supply:drift
pnpm run ci:infra:hardening
```

Lo que necesita Docker va aparte, porque tarda. **Arranca Docker sólo con `pnpm run dev:docker`**
(trampa 6):

```bash
pnpm run dev:docker
```

```bash
pnpm run ci:infra:compose-up && pnpm run ci:infra:otel
```

Estado del último cierre completo (**2026-08-19**, `T-H7-03`): **toda la batería en verde en local
y en `main`**. Corrida `32212740958` sobre `644f08a`, **los diez jobs en verde**: lint, typecheck,
**1666 pruebas** (1535 unitarias + 131 contra PostgreSQL 17 real), builds, arquitectura con sus ocho
violaciones sembradas y tres controles positivos, lógica, gateway, canarios, ledger de costos,
grants, SBOM, suministro, 159 controles de hardening, **`ci:infra:compose-up` con los 10 servicios en
`healthy`**, **`ci:infra:otel` 22 de 22** y **`ci:adversarial:session` 27**. Las de PostgreSQL
corrieron también en local. Checkpoints previos: 1618 (1487 + 131) y antes 1260 (1129 + 131).

`pnpm run ci:logic:mutation` tarda ~9 minutos y se ejecuta aparte. **Ojo:** Stryker muta solo
`logic-core`, así que las 26 pruebas nuevas o ampliadas de `domain-engine`/`session-engine` **no
mueven el baseline de 90.31 %**. No lo leas como que la cobertura de mutación cayó ni subió: mide
otra cosa.

### Estado de CI en `main` al cerrar

Observado, no supuesto. **Cuatro corridas quedaron observadas en esta sesión:** `32108984268`
(`7848b42`, Docker/D-31), `32114293161` (`306517a`, harness y piloto de BENCH-01) y `32115140133`
(`06c2eab`, `ci:mode-separation`), seis de seis jobs cada una; y **`32164277686`** (`5217680`, el AC
del gate H6) con **siete de siete**, que es la que sostiene el criterio de aceptación de F7:

| Job | Resultado |
|---|---|
| `ci:mode-separation · ci:e2e:dry-session` | ✅ |
| `ci:lint · ci:typecheck · ci:unit · ci:build` | ✅ |
| `ci:arch:depcruise` | ✅ |
| `ci:db:testcontainers · ci:db:negative` | ✅ |
| `ci:logic:golden · ci:logic:pbt · ci:logic:no-net` | ✅ |
| `ci:logic:mutation` | ✅ |
| `ci:supply:sbom · ci:supply:drift` | ✅ |

Para `T-H4-09` y todo lo anterior (corrida `32103802556` sobre `e8cede1`):

| Job | Resultado |
|---|---|
| `ci:arch:depcruise` (+ los cuatro checks de F4) | ✅ |
| `ci:db:testcontainers · ci:db:negative` | ✅ |
| `ci:supply:sbom · ci:supply:drift` | ✅ |
| `ci:logic:mutation` | ✅ |
| `ci:lint · ci:typecheck · ci:unit · ci:build` | ✅ |
| `ci:logic:golden · ci:logic:pbt · ci:logic:no-net` | ✅ |

Las catorce tareas de F7 quedan `VERIFICADA` con esa corrida. La siguiente tarea que se suba debe
obtener la suya: se comprueba job por job con:

```bash
gh api repos/MEX-AmatsuMikaboshi/profe_ia/actions/runs/<id>/jobs --jq '.jobs[] | select(.conclusion=="failure") | .name, (.steps[] | select(.conclusion=="failure") | .name)'
```

Merece la pena mirar **qué paso** falló y no solo que el job está rojo: una dependencia, una prueba
o un control de suministro producen la misma aspa en la pestaña Actions. Una tarea se mueve de
`HECHA` a `VERIFICADA` solo después de observar su corrida completa en verde.

---

## 5. Trampas del entorno (te van a morder si no las conoces)

1. **PATH de Docker.** Una consola abierta antes de instalar Docker no tiene
   `C:\Program Files\Docker\Docker\resources\bin` en el `PATH`, y Testcontainers falla con
   `spawn docker-credential-desktop ENOENT`. Antepón esa ruta o abre una consola nueva.
2. **pnpm.** Está en `%APPDATA%\npm` (instalado con npm porque `corepack enable` falla por permisos
   en `C:\Program Files\nodejs`). Si `pnpm` no se encuentra, antepón `$env:APPDATA\npm` al `PATH`.
3. **`.cmd` desde Node.** Lanzar `pnpm.cmd`/`npx.cmd` con `execFile` sin shell falla con EINVAL en
   Windows desde Node 20. Los scripts del repo ya lo resuelven: `scripts/supply/pnpm-exec.mjs` usa
   `npm_execpath`, y `scripts/arch/verify-depcruise-catches.mjs` invoca el entrypoint `.mjs` con
   `process.execPath`.
4. **Stryker.** Necesita `plugins: ["@stryker-mutator/vitest-runner"]` declarado, no acepta
   `vitest.project`, y usa `packages/logic-core/vitest.mutation.config.ts`. **No edites fuentes con
   una corrida en marcha.** Y al leer el reporte, recorta el nodo mutado por su `location`.
5. **Bash de Git y `$APPDATA`.** El shim de pnpm resuelve a una ruta inexistente bajo
   `C:\Program Files\Git\...`. Usa PowerShell para todo lo que invoque pnpm.
6. **PostgreSQL reserva el prefijo `pg_`.** Por eso el rol de migraciones es `owner_migrations` y no
   `pg_owner_migrations` como dice el plan (desviación D-6).
7. **Un `.yml` de workflow inválido no degrada un check: los apaga todos.** Un `: ` dentro de un
   escalar YAML plano se parsea como mapa anidado y la corrida muere en 0 s **sin ejecutar ningún
   job**. Valida el workflow con un parser antes de subirlo —el paquete `yaml` ya está en el árbol— y
   usa escalar de bloque (`run: |`) para cualquier mensaje con dos puntos.
8. **Bash aquí no entiende los here-strings de PowerShell.** `git commit -m @'…'@` mete un `@` como
   primera línea del mensaje. Para mensajes largos, heredoc (`cat > /tmp/msg <<'EOF'`) y `-F`.
9. **Dos pushes seguidos cancelan la verificación del primero.** La concurrencia de Actions aborta
   la corrida en marcha sobre la misma rama cuando llega un push nuevo, **y un push de sólo
   documentación cuenta**. Pasó el 2026-08-18: subir el handoff dejó la corrida del commit de código
   en `cancelled` con `ci:logic:mutation` sin terminar, y ese job sólo corre en `main`. Si vas a
   empujar dos veces, **espera a la corrida antes del segundo push**, o asume que la única que
   cuenta es la del último commit.
10. **Cuidado al escribir caracteres de control en un fuente.** Al crear `ingestion.ts` una clase de
   regex quedó con controles C0 literales en vez de escapes, ilegible y candidata a
   `no-control-regex`. Se resolvió comprobando por punto de código en un bucle, que además se lee.

---

## 6. Disciplinas que hay que mantener

No son preferencias de estilo; son lo que hace que este proyecto valga algo.

- **No inventar.** Si falta una decisión y ninguna autoridad la resuelve, va a
  `docs/blocked-by-spec.md` (§0.2.5), no a un valor plausible. El mecanismo `pendingCatalog()` de
  `packages/contracts/src/pending.ts` existe justo para eso. Hoy no hay ninguno pendiente.
- **Expectativas a priori.** El generador del conjunto dorado declara qué debe pasar **antes** de
  ejecutar. Nunca grabes la salida observada como «esperado»: eso convierte el conjunto dorado en un
  espejo del bug.
- **Los controles positivos importan.** La suite negativa de privilegios incluye pruebas de que cada
  concesión de la matriz **sí** funciona. Sin ellas, una base rota haría pasar todas las negativas.
- **Nada de degradación silenciosa.** Un fallo no se disfraza de resultado benigno. El CLI falla con
  `NO_IMPLEMENTADO` en vez de simular éxito; `proof-search` lanza `CertificateRejectedError` en vez
  de devolver «no encontré».
- **Desviaciones documentadas.** Cualquier apartamiento del plan va a §«Decisiones de ingeniería» de
  `PLAN_STATUS.md` con su causa. Van **D-1 a D-24**.
- **Una siembra en verde no dice nada de los controles que faltan.** En `T-H5-05` se sembraron 36
  mutaciones y las 36 quedaron detectadas a la primera; y aun así, releyendo el módulo aparecieron
  cuatro huecos, entre ellos **una guarda exportada y probada que el pipeline nunca llamaba** y un
  **estado inventado** para un candidato que el buscador nunca vio. La siembra mide los controles que
  hay; releer el módulo es lo que encuentra los que no están.
- **Una justificación se intenta refutar antes de escribirla.** Vale para los mutantes
  «inalcanzables» y para cualquier «esto no puede pasar»: si no intentaste alcanzarlo, no lo sabes.
- **Un commit, una tarea `T-*`**, con `PLAN_STATUS.md` actualizado en el mismo commit, y **se sube al
  terminarla** (§12 del plan y §8 de este documento).
- **Siémbrale un fallo a todo check nuevo antes de darlo por bueno.** Es el mismo método que
  `verify-depcruise-catches.mjs` aplica a las reglas de arquitectura, y en esta sesión pagó tres
  veces. Con las pruebas en verde no se distingue un control que funciona de uno que **pasa por
  vacío**, de uno que **pasa por el motivo equivocado** ni de una **guarda que no se puede disparar
  desde fuera**. Para lo tercero: si una comprobación está atada a una constante interna, hazla
  inyectable con la constante por omisión —como `findCycles(edges)`—, y entonces se puede probar.
- **Releer el módulo ya escrito encuentra lo que las pruebas no.** El hueco de la etiqueta de versión
  en W1 apareció así, con todo en verde: ningún fixture la remarcaba, así que no había nada que
  fallara.
- **Cuando falte un mapeo que ninguna autoridad da, hazlo dato y falla si no está.** Pasó en F4/F5
  con el reparto operación↔perfil (D-15), la política de rearme del gate de gasto (D-16) y los
  umbrales de saturación; y en F6 con las tres declaraciones que W1 exige (D-18). Cablear un valor
  plausible habría movido una frontera real con una suposición.
- **Lo que la norma enuncia como condición no se convierte en arista, ni en estrategia, ni en enum.**
  «Disponer de una disyunción» quedó como condición del KC13 y «volver al KC objetivo» como acción
  del motor. Forzarles una estructura afirmaría una dependencia o una decisión que nadie declaró.

---

## 7. Lo que no está verificado y conviene no olvidar

- **`HECHA` no equivale a `VERIFICADA`.** Ahora mismo no queda ninguna corrida sin observar: todas
  las tareas hasta F7 y el AC del gate H6 llevan la suya. La regla sigue viva para lo que venga: una
  tarea nueva es `HECHA` hasta que alguien mire sus jobs, no por haber subido el código.
- **F6 ha construido mecanismos, no contenido.** Las ocho tareas cerradas producen validadores y
  catálogos —`T-H5-05` incluida: W3 es el pipeline, no una corrida—, pero **todos los artefactos de
  `content/` siguen siendo placeholders de ~140 bytes**:
  `source/manifest.yaml`, `source/fragments/`, `extracted/*.yaml`, `kc/map.yaml`,
  `experimental-sets.yaml` y los cinco de `pedagogy/`. Solo `kc/authorized-calculus-v1.yaml` tiene
  contenido real. No es un olvido: casi todos dependen de una corrida W0 sobre fuentes reales que no
  existe, y poblarlos a mano sería fabricar corpus. **La excepción es `kc/map.yaml`**, que sí se
  podría serializar ya desde `KC_CATALOG` porque es literal del Maestro y no depende del corpus; si
  se hace, va con su propia tarea y recordando que `content/` se sube **primero** (§8).
- **F5 no ha corrido W0 sobre fuentes reales.** `research/` sigue con `selection-manifest.yaml`,
  `source-scores.yaml`, `conflicts.yaml`, `coverage-saturation.yaml` y `license-register.yaml` como
  placeholders. Solo `whitelist.yaml` está poblado.
- **F4 no tiene ni una llamada real a un proveedor.** Toda la pasarela está probada con transporte
  inyectado. Eso prueba la lógica local, **no** que un proveedor responda como el adaptador supone.
  Si al hacer la primera llamada real aparece un `UnknownProviderContractError`, es el adaptador
  haciendo su trabajo.
- **El ZIP de mockups no coincide** con el hash de §0.1, aunque el HTML normativo interno sí coincide
  byte a byte. Registrado en `packages/ui-tokens/vendor/PROVENANCE.md`.
- **Los tokens vendorizados cargan Archivo desde Google Fonts** con un `@import`. Incompatible con
  local-first durante una corrida: hay que autoalojar la fuente antes de que `apps/web` los consuma.
- **Calibraciones abiertas por diseño**: `CALC-03`, `CALC-05`, `CAL-04`, `CAL-07`, `CAL-08`,
  `CAL-SOURCE-SCORE` y `CAL-SATURATION` (H4.5), `CAL-NLI` (H5), y los benchmarks `BENCH-01/02`
  (F4) y `BENCH-04` (orden del pipeline, F6). `CAL-09` y `CAL-SCED-OPPORTUNITY` ya están congeladas
  en `docs/params/registry.yaml`. Las abiertas tienen su punto de fallo escrito en el código.
- **`T-H2-05` aparece dos veces en la tabla de F2** de `PLAN_STATUS.md`. Las dieciséis tareas están
  hechas —el trabajo está—, pero **una de las dos filas lleva el id equivocado**. No se corrigió
  porque no consta cuál de los dos es el bueno, y elegir uno sería inventar trazabilidad.

---

## 8. Control de versiones — hay remoto, y se usa

Remoto del monorepo: <https://github.com/MEX-AmatsuMikaboshi/profe_ia.git> (`origin/main`).

### Regla de trabajo: cada tarea terminada se sube

**Al cerrar una tarea `T-*`, se sube al remoto.** No al final de la sesión ni «cuando haya varias»:
al terminar cada una. Un commit por tarea, con `PLAN_STATUS.md` actualizado en el mismo commit
(§12 del plan).

```bash
git add -A
git commit -m "T-Hx-nn: <qué quedó cerrado>"
git push origin main
```

Antes de subir, las tres comprobaciones que importan:

1. **La batería de §4 en verde.** No se sube una tarea con un check rojo.
2. **Ningún secreto.** `infra/compose/.env` está en `.gitignore` y ahí se queda. Compruébalo con
   `git status --short` antes del commit: si aparece un `.env`, para y arréglalo.
3. **El mensaje dice qué tarea cierra**, con su id `T-*`. El historial es parte de la evidencia.

### CI y el secreto `CONTENT_TOKEN`

Desde que D-2 se cerró, `content/` es un submódulo que vive en **otro** repositorio privado, y
`secrets.GITHUB_TOKEN` solo alcanza a `profe_ia`: el clon falla con `Repository not found`, que es lo
que GitHub responde a un privado sin acceso, no a un repo inexistente. Los jobs `base` y `logic` lo
necesitan; `arch`, `db`, `supply` y `mutation` no.

Se resolvió el 16-08 con un PAT fine-grained de solo lectura guardado como secreto `CONTENT_TOKEN`:

- Resource owner `MEX-AmatsuMikaboshi`, **ambos** repositorios (`profe_ia` y `profe_ia_contenido`),
  permiso `Contents: Read`. Los dos, porque `checkout` usa el mismo token para el repo principal y
  para el submódulo.
- Se guarda con `gh secret set CONTENT_TOKEN --repo MEX-AmatsuMikaboshi/profe_ia`, que lo pide por
  stdin y no lo deja en el historial.

Es acción del propietario, como la cuenta administrativa de Infisical. Un paso previo de cada job
falla con mensaje explícito si el secreto no está, en vez de dejar morir a `checkout`.

**Regla general que dejó este episodio:** todo check que inspeccione **contenido** de `content/` debe
ejecutarse dentro del submódulo. Desde el padre solo se ve el gitlink, y por eso el check «conjunto
dorado reproducible» llevaba pasando por vacío.

### El repositorio de contenido

`content/unidad-deduccion-natural/` es un repositorio git independiente con historial propio (§4.3).
Su remoto es <https://github.com/MEX-AmatsuMikaboshi/profe_ia_contenido.git> (privado) y **ya está
formalizado como submódulo** en `.gitmodules`: **D-2 cerrada** el 15-08-2026.

- **Al clonar**, usa `git clone --recurse-submodules`; si ya clonaste, `git submodule update --init`.
  Sin el contenido, `ci:unit` y `ci:logic:golden` no pueden correr: leen el cálculo congelado y los
  413 casos del conjunto dorado desde ahí.
- **Al cambiar contenido**, se sube **primero** el repositorio de contenido y **después** el monorepo
  con el gitlink actualizado. Al revés, el gitlink apunta a un commit que no existe en el remoto y el
  checkout de CI falla con `fatal: reference is not a tree`. Ese orden no es una preferencia: es la
  causa exacta de que el primer push dejara `base` y `logic` en rojo.

---

## 9. Primeros pasos de la próxima sesión

En este orden.

1. **Lee este archivo entero y después `PLAN_STATUS.md`.** No empieces por el código.
2. **Comprueba las credenciales.** El propietario dijo dejar las cuatro pegadas en
   `infra/compose/.env` (§3.0.b). Comprueba que están y que **las dos de un mismo proveedor no son
   la misma cadena**: si lo fueran, la separación `SESION`/`AUTORIA` de P-II §8.2 dejaría de
   proteger de nada. No las copies a ningún otro sitio y no las imprimas.
3. **Comprueba que el árbol sigue en pie** con la batería de §4. Debe dar **1535 pruebas
   unitarias** más **131 contra PostgreSQL real** (`pnpm run ci:unit` corre los dos proyectos y
   reporta **1666**). Si da menos, algo se perdió; si da más sin que nadie haya trabajado, algo se
   duplicó. Las de PostgreSQL **ya corren en local**: `pnpm run dev:docker` y luego
   `pnpm run ci:db:negative` (§3.0.c).

   **Aviso sobre el número anterior:** este documento decía 1351 y el árbol daba 1454 antes de esta
   sesión. No se había perdido ni duplicado nada: 1351 era el conteo **anterior** a los tests de
   `306517a` (91) y `06c2eab` (12), que suman exactamente 103. Se comprobó contando `it(` en los
   archivos de esos dos commits antes de dar el número por bueno, en vez de suponer cuál de las dos
   cifras era la correcta.
4. **No hay rama que elegir.** Lo que se podía construir sin el propietario está construido: ver
   **§3.1**. Lo que queda está en **§3.3** y es, sobre todo, trabajo humano — 200 casos de
   benchmark— más dos defectos de diseño que sí son código.
5. **Al cerrar cada tarea**, commit propio con su id, `PLAN_STATUS.md` en el mismo commit, batería en
   verde y `git push origin main`. Después **observa la corrida** job por job (§4) antes de mover
   nada a `VERIFICADA`. Si tocas `content/`, **primero el submódulo** (§8).

### Preguntas abiertas para el propietario

1. ~~**Autorización de la corrida material de BENCH-01**~~ — **concedida el 2026-08-19: USD 3.64**,
   cifra medida sobre tokens reales. **Lo que sigue bloqueando la corrida no es el dinero**: son los
   200 casos escritos a mano y los cuatro puntos del piloto, dos de los cuales son defectos de
   diseño reales. Todo explicado en llano en **§3.3**.
2. ~~**Ventana de frescura**~~ — **fijada en 24 h** el 2026-08-18 y **ampliada a 5 días** el
   2026-08-19 (D-49). Ver §3.0.b.
3. ~~**Docker Desktop**~~ — resuelto el 2026-08-18 con `pnpm run dev:docker`; ver §3.0.c.
4. **Cuenta administrativa de Infisical** — bloqueada por lo anterior: necesita el stack levantado.
   Hasta entonces los servicios leen de `.env`, que es el modo de arranque, no el de destino.
5. **W0 sobre fuentes reales** — **corrida en vivo ejecutada el 2026-08-19 (D-47, D-48)**: hay
   orquestador (`w0-runner.ts`), conectores reales (`connectors.ts`) y una propuesta de corpus en
   `propuesta_corpus` en `research/` del repo de contenido (`e4073ab`). **Lo que falta es la
   decisión del `CORPUS_APPROVER`** (autorizar o rechazar con código y evidencia) y, antes, su
   revisión de las evaluaciones — escritas por el asistente, misma salvedad que D-41. La ejecución
   en `authoring-worker` (jobs + BD) sigue pendiente y no bloquea el gate. Además
   `suitabilityScore()` y `shouldStopDiscovery()` fallan cerrado esperando calibración *con el
   corpus real*, o sea durante la propia corrida.
