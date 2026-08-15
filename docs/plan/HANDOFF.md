# HANDOFF — punto de continuación

**Fecha del checkpoint:** 2026-08-15, tercera sesión del día.
**Qué se cerró aquí:** `T-H5-01…04`, es decir el arranque de F6 · H5.
**Para:** la siguiente sesión que continúe la ejecución de `Plan.md`.

Este archivo es el punto de entrada. Léelo entero antes de tocar nada, y después
[`PLAN_STATUS.md`](PLAN_STATUS.md), que es la fuente de verdad de avance (§12 del plan).

**Lo primero que hay que saber:** hay remoto
(<https://github.com/MEX-AmatsuMikaboshi/profe_ia.git>) y **cada tarea terminada se sube**. Cómo y
con qué comprobaciones, en §8.

### Por dónde empezar, en una línea

F0–F3 cerradas salvo `T-H3-05`; **F4 con 9 de 12** (todo lo construible), **F5 con 8 de 8** y **F6
con 4 de 17**: `T-H5-01` (W1 ingesta), `T-H5-02` (W2 extracción), `T-H5-03` (mapa de KC) y `T-H5-04`
(política pedagógica). La siguiente es **`T-H5-05`**, la más grande de la fase. Antes de arrancarla
lee §3, que dice qué se rompe fácil, y §7, que enumera lo que **no** está verificado.

**Hay una acción tuya pendiente que bloquea todos los `VERIFICADA`:** el secreto `CONTENT_TOKEN`
(§8). Sin él, dos de los seis jobs de CI siguen en rojo y ninguna tarea puede pasar de `HECHA`.

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
| **F3 · H3** entorno local | 4 de 5. Falta `T-H3-05` (trazas, espera operación real en F7/F8) |
| **F4 · H4** pasarela de modelo | **9 de 12.** Todo lo construible está hecho. `T-H4-09/10/11` esperan credenciales de proveedor y autorización de gasto |
| **F5 · H4.5** investigación de fuentes (W0) | **8 de 8.** Falta la corrida W0 real sobre fuentes y la firma del `CORPUS_APPROVER` |
| **F6 · H5** ingesta, autoría y freeze (W1–W5) | **4 de 17.** `T-H5-01…04` cerradas; sigue `T-H5-05` |
| F7–F16 | No empezadas |

Van **56 de 148 tareas** del plan (contadas sobre `PLAN_STATUS.md`). Detalle tarea por tarea, con
evidencia y fechas: [`PLAN_STATUS.md`](PLAN_STATUS.md).
Actas de gate: [`../gates/`](../gates/) — `H0.md`, `H1.md`, `H2.md`, `H3.md`, todas **abiertas**.
No hay acta de `H4` ni de `H4.5`: ninguna de las dos fases está en condiciones de firmarse.

### Cuánto falta para poder usarlo

Contando tareas del plan, que es una aproximación —no pesan igual— pero es la única medida que no se
inventa:

| Hito | Qué significa | Avance |
|---|---|---|
| Sesión seca (fin de F7) | Una clase completa con guion fijo, sin IA en vivo | **64 %** |
| Clase real (fin de F8) | Lo mismo, conducido por el modelo ganador | **60 %** |
| `LOCAL_SELF_USE` (F11) | El propietario lo usa de principio a fin, con voz y pizarrón | **48 %** |

**Dos cosas que no se arreglan programando**, y por eso el porcentaje no cuenta toda la verdad:
falta elegir el modelo (`T-H4-10/11` necesita credenciales y autorización de gasto) y falta corpus
real (nadie ha corrido W0 sobre fuentes reales, así que no hay contenido con el que enseñar).

---

## 3. Por dónde seguir

### La tarea siguiente: `T-H5-05` — W3 generación (CRITICAL, camino crítico)

F6 es la fase más grande del plan: **17 tareas** (`T-H5-01…17`), `Plan.md` §F6. Las cuatro primeras
están cerradas (§3.a), así que sigue `T-H5-05`, que encadena: Rol C sin solución autoritativa →
validez determinista **en el orden congelado tras `BENCH-04`** → soluciones y certificados
re-verificados por `logic-core` hacia `solutions-private/` → complejidad → duplicados e isomorfismos
→ pistas (Rol D) → crítica (Rol E, familia distinta) → filtros → separación física de reservas.

**Ojo con el orden**: `freezeWinningOrder()` de `proof-search` falla cerrado precisamente aquí. La
preferencia inicial a *benchmarkear* es `prefiltro semántico → proof search`, pero el ganador lo
decide `BENCH-04` y **no se puede cablear**.

Lo que ya está puesto y conviene usar en vez de rehacer:

- **`W1_ingesta`** es el estado terminal bueno de la máquina W0 (`authoring-core/src/w0-state.ts`), y
  es donde F6 arranca.
- **`fragmentId()`** (`ingestion.ts`) es pública para que W2 recalcule el ancla sin preguntarle a W1.
- **`KC_CATALOG`** (`kc-map.ts`) trae los dieciocho KC con dependencias tipadas y `rule_id` derivados
  del cálculo; **`crossSetEdges()`** ya enumera FORMAL y POLITICA_CONTENIDO por separado, que es lo
  que `T-H5-12` necesita.
- **`STRATEGY_CATALOG` y `toDecisionStrategy()`** (`pedagogy.ts`) fijan el catálogo de doce y fallan
  cerrado en las dos entradas sin miembro de enum. Las pistas de Rol D se apoyan en esa política.
- **`complexityIndex()`** falla cerrado esperando a `T-H5-10` (`CAL-09`). H6 no abre sin eso.
- **Los `CAL-*` de F5 se congelan en esta fase**: `CAL-SOURCE-SCORE`, `CAL-SATURATION` y `CAL-NLI`
  tienen su punto de fallo escrito en `authoring-core` y esperan corpus real.

Lo que queda abierto y **no** bloquea a F6:

- **`T-H3-05`** (trazas) espera una operación real que trazar, en F7/F8.
- **Los gates H0–H3** esperan firma humana y ejecución verde en Actions, no más código.
- **Infisical** necesita que crees su cuenta administrativa a mano.
- **`T-H4-09/10/11`** esperan credenciales y gasto; ver §3.b.

---

## 3.a Lo cerrado en esta sesión (15-08, tercera)

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

### Lo que esta sesión dejó como método

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

## 3.b De sesiones anteriores

### F4 · H4 — pasarela de modelo: 9 de 12

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
pnpm run db:grants:check && pnpm run ci:db:negative
pnpm run ci:supply:sbom && pnpm run ci:supply:drift
pnpm run ci:infra:hardening
```

El entorno local se comprueba aparte, porque necesita Docker y tarda:

```bash
pnpm run ci:infra:compose-up
```

Estado en el checkpoint: **todo en verde en local**. **837 pruebas**: 710 unitarias + 127 contra
PostgreSQL 17 real. Empezó esta sesión en 719.

`pnpm run ci:logic:mutation` tarda ~9 minutos y se ejecuta aparte. **Ojo:** Stryker muta solo
`logic-core`, así que las 118 pruebas nuevas de esta sesión —todas de `authoring-core`— **no mueven
el baseline de 90.31 %**. No lo leas como que la cobertura de mutación cayó ni subió: mide otra cosa.

### Estado de CI en `main` al cerrar

Observado, no supuesto (corrida `31907080653` y las posteriores de esta sesión):

| Job | Resultado |
|---|---|
| `ci:arch:depcruise` (+ los cuatro checks de F4) | ✅ |
| `ci:db:testcontainers · ci:db:negative` | ✅ |
| `ci:supply:sbom · ci:supply:drift` | ✅ |
| `ci:logic:mutation` | ✅ |
| `ci:lint · ci:typecheck · ci:unit · ci:build` | ❌ falta `CONTENT_TOKEN` |
| `ci:logic:golden · ci:logic:pbt · ci:logic:no-net` | ❌ falta `CONTENT_TOKEN` |

Los dos rojos fallan en el paso `CONTENT_TOKEN presente`, antes del checkout. Se comprueba job por
job con:

```bash
gh api repos/MEX-AmatsuMikaboshi/profe_ia/actions/runs/<id>/jobs --jq '.jobs[] | select(.conclusion=="failure") | .name, (.steps[] | select(.conclusion=="failure") | .name)'
```

Merece la pena mirar **qué paso** falló y no solo que el job está rojo: es lo que distingue «falta el
secreto» de «se rompió el código», y las dos cosas pintan el mismo aspa en la pestaña Actions.
**En cuanto exista el secreto, `gh run rerun <id> --failed` debería ponerlos en verde**, y entonces
—y solo entonces— se puede empezar a marcar `VERIFICADA`.

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
9. **Cuidado al escribir caracteres de control en un fuente.** Al crear `ingestion.ts` una clase de
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
  `PLAN_STATUS.md` con su causa. Van **D-1 a D-19**.
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

- **Ninguna tarea está `VERIFICADA`.** Todo lo que dice `HECHA` está verificado **localmente** y es
  reproducible, pero §0.4 exige el check en verde en `main`. No marques `VERIFICADA` por el hecho de
  haber subido el código.
- **F6 ha construido mecanismos, no contenido.** Las cuatro tareas cerradas producen validadores y
  catálogos, pero **todos los artefactos de `content/` siguen siendo placeholders de ~140 bytes**:
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
  `CAL-09` (pesos del índice de complejidad, H5), `CAL-SOURCE-SCORE` y `CAL-SATURATION` (H4.5),
  `CAL-NLI` (H5), y los benchmarks `BENCH-01/02` (F4) y `BENCH-04` (orden del pipeline, F6).
  `docs/params/registry.yaml` está vacío a propósito. **Todas tienen ya su punto de fallo escrito en
  el código**: son el lugar donde se enchufa el valor congelado, no bugs que arreglar.
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

### CI necesita el secreto `CONTENT_TOKEN` (acción del propietario)

Desde que D-2 se cerró, `content/` es un submódulo que vive en **otro** repositorio privado, y
`secrets.GITHUB_TOKEN` solo alcanza a `profe_ia`: el clon falla con `Repository not found`, que es lo
que GitHub responde a un privado sin acceso, no a un repo inexistente. Los jobs `base` y `logic` lo
necesitan; `arch`, `db`, `supply` y `mutation` no.

Se resuelve con un PAT fine-grained de solo lectura guardado como secreto `CONTENT_TOKEN`:

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
2. **Mira si ya existe el secreto `CONTENT_TOKEN`:**

   ```bash
   gh secret list --repo MEX-AmatsuMikaboshi/profe_ia
   ```

   Si está, relanza la última corrida fallida y **observa** el resultado; si los seis jobs quedan en
   verde, ese es el momento de empezar a mover tareas de `HECHA` a `VERIFICADA` en `PLAN_STATUS.md`,
   una por una y solo las que su check cubra. Si no está, no lo crees tú: es acción del propietario
   (§8), y seguir trabajando no depende de ello.
3. **Comprueba que el árbol sigue en pie** con la batería de §4. Debe dar **837 pruebas**. Si da
   menos, algo se perdió; si da más sin que nadie haya trabajado, algo se duplicó.
4. **Sigue F6 · H5 por `T-H5-05`.** Lee antes `Plan.md` §F6 entero —son 17 tareas y varias se
   condicionan entre sí— y navega el Maestro solo por lo que cada tarea cite (`^#{1,3} ` con Grep).
   Es la tarea más grande de la fase: conviene partirla y **no** cablear el orden del pipeline, que
   lo decide `BENCH-04`.
5. **Al cerrar cada tarea**, commit propio con su id, `PLAN_STATUS.md` en el mismo commit, batería en
   verde y `git push origin main`. Si tocas `content/`, **primero el submódulo** (§8).

### Preguntas abiertas para el propietario

Ninguna bloquea el trabajo de código, pero las tres llevan tiempo esperando:

1. **`CONTENT_TOKEN`** — bloquea todos los `VERIFICADA`. Instrucciones en §8.
2. **Credenciales de proveedor y autorización de gasto** — bloquean `T-H4-10/11`, y con ellas la
   elección del modelo de la que depende F8. El tope declarado es ≈MXN 500/mes con bloqueo duro a los
   700, y el gate ya está implementado y probado.
3. **Cuenta administrativa de Infisical** — hasta entonces los servicios leen credenciales de `.env`,
   que es el modo de arranque, no el de destino.

Las tres son acciones del propietario por naturaleza, no tareas pendientes de nadie más.
