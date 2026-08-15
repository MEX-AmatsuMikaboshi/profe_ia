# HANDOFF — punto de continuación

**Fecha del checkpoint:** 2026-08-15, segunda sesión del día (F4 al 75 %, F5 cerrada; la anterior
cerró F1–F3)
**Para:** la siguiente sesión que continúe la ejecución de `Plan.md`.

Este archivo es el punto de entrada. Léelo entero antes de tocar nada, y después
[`PLAN_STATUS.md`](PLAN_STATUS.md), que es la fuente de verdad de avance (§12 del plan).

**Lo primero que hay que saber:** ya hay remoto
(<https://github.com/MEX-AmatsuMikaboshi/profe_ia.git>) y **cada tarea terminada se sube**. Cómo y
con qué comprobaciones, en §8.

### Por dónde empezar, en una línea

F0–F3 cerradas salvo `T-H3-05`; **F4 con 9 de 12** (todo lo construible) y **F5 con 8 de 8**. La
siguiente es **F6 · H5** —ingesta, construcción curricular, autoría y freeze—, la fase más grande del
plan con 17 tareas. Antes de arrancarla lee §3, que dice qué de F4/F5 se rompe fácil, y §7, que
enumera lo que **no** está verificado.

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
| **F3 · H3** entorno local | 4 de 5. Falta `T-H3-05` (trazas, esperan operación real en F7/F8) |
| **F4 · H4** pasarela de modelo | **9 de 12.** Todo lo construible está hecho. `T-H4-09/10/11` esperan credenciales de proveedor y autorización de gasto |
| **F5 · H4.5** investigación de fuentes (W0) | **8 de 8.** Falta la corrida W0 real sobre fuentes y la firma del `CORPUS_APPROVER` |
| F6–F16 | No empezadas |

Van **52 de 148 tareas** del plan (contadas sobre `PLAN_STATUS.md`). Detalle tarea por tarea, con
evidencia y fechas:
[`PLAN_STATUS.md`](PLAN_STATUS.md).
Actas de gate: [`../gates/`](../gates/) — `H0.md`, `H1.md`, `H2.md`, `H3.md`, todas **abiertas**.
No hay acta de `H4` ni de `H4.5` todavía: ninguna de las dos fases está en condiciones de firmarse.

---

## 3. Por dónde seguir

### La tarea siguiente: F6 · H5 — ingesta, autoría y freeze (W1–W5)

Es la fase más grande del plan: **17 tareas** (`T-H5-01…17`), `Plan.md` §F6. Consume lo construido en
F5 (corpus autorizado) y en F4 (perfil `AUTORIA` de la pasarela). Cuatro cosas que ya están puestas y
conviene usar en vez de rehacer:

- **El estado W0 ya tiene máquina de transiciones** (`authoring-core/src/w0-state.ts`). `W1_ingesta`
  es su estado terminal bueno: F6 arranca justo ahí.
- **`freezeWinningOrder()`** de `proof-search` falla cerrado esperando a `T-H5-05`, que es donde se
  decide el orden del pipeline de autoría con `BENCH-04`.
- **`complexityIndex()`** falla cerrado esperando a `T-H5-10` (`CAL-09`). H6 no abre sin eso.
- **Los `CAL-*` de F5 se congelan aquí**: `CAL-SOURCE-SCORE`, `CAL-SATURATION` y `CAL-NLI` tienen su
  punto de fallo escrito en `authoring-core` y esperan a H5/H4.5 con corpus real.

Lo que queda abierto y **no** bloquea a F6:

- **`T-H3-05`** (trazas) espera una operación real que trazar, en F7/F8.
- **Los gates H0–H3** esperan firma humana y ejecución verde en Actions, no más código.
- **Infisical** necesita que crees su cuenta administrativa a mano.
- **`T-H4-09/10/11`** esperan credenciales y gasto; ver §3.a.

---

## 3.a Lo cerrado en esta sesión (15-08, segunda)

### F4 · H4 — pasarela de modelo: 9 de 12

Hecho: adaptadores propios, capacidades por binding, validación fail-closed de la salida, contexto de
sesión por whitelist con filtro de egreso, canarios, `pricing-manifest` + `cost-ledger`, control de
gasto, matriz de batch/caching y modo degradado. Cinco checks nuevos en CI, todos en el job `arch`
—que es de los que sí pasan sin el PAT—: `ci:gateway:fail-closed`, `ci:gateway:contracts`,
`ci:canary`, `ci:cost:ledger`.

**Lo que se rompe fácil si no se conoce:**

- **No hay ningún nombre de modelo ni parámetro de muestreo escrito en el código.** El id sale del
  binding; los parámetros los autoriza el binding. Escribir «claude-x» o «temperature: 0» en un
  adaptador anticiparía un ganador que solo `BENCH-01/02` decide.
- **`AuthorizedParameters` es un tipo de marca** que solo produce `authorizeParameters()`. No lo
  sortees con un cast: es lo que impide que un adaptador reciba parámetros sin contrastar.
- **`ModelGateway` no tiene `send()`**, solo `execute()` con esquema obligatorio. Se retiró a
  propósito: un `send()` crudo sería un camino para leer salida del proveedor sin validación local,
  que es el agujero que P-II §8.4 cierra.
- **El orden de clasificación de la salida es el requisito**, no una preferencia: truncamiento,
  rechazo y error de proveedor **antes** que el esquema. Reordenarlo haría que un truncado se
  reportara como `schema_violation` y escondería la causa real.
- **El bloqueo por canario y el de presupuesto no se pueden levantar programáticamente.** No hay
  `unblock`, `reset`, `force` ni `continueAnyway`, y hay pruebas de que no existen. Añadir uno
  convertiría los dos bloqueos en sugerencias.

**Las tres que faltan, y por qué:** `T-H4-09` (refresco documental) es `PENDIENTE` **por diseño** —la
norma pide hacerlo *inmediatamente antes* del benchmark, y adelantarlo produciría evidencia caducada—;
`T-H4-10` y `T-H4-11` están `BLOQUEADA(gasto y credenciales del propietario)`: exigen llamadas reales
facturables y, la segunda, dos proveedores de familias distintas.

### F5 · H4.5 — investigación de fuentes (W0): 8 de 8

Todo en `packages/authoring-core`. Máquina de estados W0, sistema formal objetivo, licencias,
descubrimiento, idoneidad/saturación, manifiesto de selección, autorización externa y trazabilidad
translingüe.

**Lo que se rompe fácil si no se conoce:**

- **La whitelist de la base de datos no impone orden.** `operations.w0_state` tiene un `CHECK` de
  pertenencia que acepta saltar de `solicitud_curso` a `corpus_autorizado`. El orden lo impone
  `assertW0Transition`; si escribes al estado sin pasar por ahí, no hay flujo.
- **La clasificación de licencias no devuelve un booleano por recurso**, sino un veredicto **por uso
  previsto**. El caso Calgary obliga: el mismo material sirve como fuente documental del cálculo y
  está bloqueado como base expresiva. Un sí/no obligaría a elegir una de las dos respuestas ciertas.
- **`LICENSE_UNRESOLVED` no es `excluido`.** No resuelto espera a que alguien resuelva la
  proveniencia; excluido está decidido. Confundirlos borra la diferencia.
- **`assertNoHumanRewrite` es la mitad ejecutable de «sin reescritura pedagógica humana».** Compara
  el manifiesto presentado al aprobador con el que devuelve. Si lo quitas, la regla vuelve a ser una
  declaración de intenciones y el veredicto de autonomía deja de poder medirse.
- **`suitabilityScore()`, `shouldStopDiscovery()` y `nliGate()` fallan cerrado a propósito.** Son los
  tres puntos donde se enchufan los valores congelados de `CAL-SOURCE-SCORE`, `CAL-SATURATION` y
  `CAL-NLI`. No los «arregles» devolviendo un número o un booleano: una parada inventada cierra el
  corpus antes de tiempo o quema presupuesto, y **ninguna de las dos se nota mirando el resultado**.

---

## 3.b De sesiones anteriores

### a) F2 está cerrada; el gate H2 espera firma

Las 16 tareas están hechas y **todo el AC está cubierto localmente**. Mutation testing terminó en
**90.31 % con cero mutantes sin cobertura**; los 112 vivos están clasificados en
[`../quality/mutation-baseline.md`](../quality/mutation-baseline.md). Stryker muta solo `logic-core`,
así que `proof-search` no mueve el baseline.

Dos lecciones de método que ese trabajo dejó, y que conviene leer antes de tocar la mutación:

1. **El reporte imprime el reemplazo, no el nodo mutado.** Dos mutantes distintos de una misma línea
   se ven idénticos. Leerlo mal lleva tanto a dar por cubierto lo que no lo está como a culpar a la
   herramienta de falsos supervivientes. El script debe recortar por `location`.
2. **Una justificación de «rama inalcanzable» hay que intentar alcanzarla antes de escribirla.** La
   del oráculo semántico parecía sólida —toda regla autorizada es sana— y era falsa.

Lo que quedó cerrado el 15-08 y conviene conocer antes de tocarlo:

- **`T-H2-14` índice de complejidad** (`packages/proof-search/src/complexity.ts`). Las medidas de
  P-I §7.6 en dos grupos: `structural` no depende del presupuesto, `searchRelative` sí. Esa
  separación es lo que impide leer «nodos explorados» como total de caminos. **No hay escalar**:
  `complexityIndex()` lanza `CalibrationPendingError` hasta que H5 congele los pesos (`CAL-09` /
  `T-H5-10`), y H6 no abre sin eso. No lo «arregles» devolviendo un número.
- **`T-H2-16` arnés BENCH-04** (`packages/proof-search/src/bench.ts`). Mide en L0 los dos órdenes
  equivalentes y marca cinco clases de hallazgo de seguridad; cualquiera vuelve el informe no
  comparable. `freezeWinningOrder()` falla cerrado: el ganador se decide en F6 (`T-H5-05`).

### b) F3 · H3 — entorno local

Levantado y endurecido. `pnpm run dev:env && pnpm run dev:up && pnpm run dev:seed`; el runbook está
en [`../../infra/runbooks/local.md`](../../infra/runbooks/local.md). `ci:infra:hardening` comprueba
159 propiedades sobre la configuración **resuelta** por Docker e imprime cuatro imposibilidades
técnicas registradas.

Dos cosas quedan abiertas y ninguna es un olvido:

- **`T-H3-05`**: el colector corre y recibe, pero los servicios no emiten spans. No hay operación
  que trazar hasta F7/F8, y un span de «arranqué» para poder decir que hay trazas sería éxito
  simulado.
- **Infisical** necesita que su cuenta administrativa se cree a mano en <http://localhost:8080>.
  Crear cuentas es acción del propietario. Hasta entonces los servicios leen credenciales de `.env`,
  que es el modo de arranque, no el de destino.

### c) F1 · H1 — cerrada

`T-H1-05` quedó hecha el 15-08. Better Auth 1.6.29 autoalojado, con sus seis tablas dentro de
`identity` y prefijo `auth_` (D-14). Dos cosas que conviene saber antes de tocarlo:

- **El correo no autentica solo.** No hay enlace mágico ni código por correo, y hay una prueba que
  falla si alguien los añade. Añadirlos violaría P-I §14.2.
- **`svc_api` no borra cuentas.** Administra credenciales y sesiones; la supresión es de
  `svc_background`, que es quien atiende el derecho (P-I §14.5). Está en la matriz y lo comprueba la
  suite negativa.

Lo que **no** está probado y no se afirma que lo esté: la ceremonia WebAuthn completa y el montaje
de rutas HTTP. Son de F7.

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

Estado en el checkpoint: **todo en verde en local**. **719 pruebas**: 592 unitarias + 127 contra
PostgreSQL 17 real. Empezó la sesión en 505.

`pnpm run ci:logic:mutation` tarda ~9 minutos y se ejecuta aparte. **Ojo:** Stryker muta solo
`logic-core`, así que las 214 pruebas nuevas de esta sesión —que son de `model-gateway`,
`security-policy` y `authoring-core`— **no mueven el baseline de 90.31 %**. No lo leas como que la
cobertura de mutación cayó ni subió: mide otra cosa.

### Estado de CI en `main` al cerrar

Observado, no supuesto (corrida `31883718220` y posteriores):

| Job | Resultado |
|---|---|
| `ci:arch:depcruise` (+ los cuatro checks nuevos de F4) | ✅ |
| `ci:db:testcontainers · ci:db:negative` | ✅ |
| `ci:supply:sbom · ci:supply:drift` | ✅ |
| `ci:logic:mutation` | ✅ |
| `ci:lint · ci:typecheck · ci:unit · ci:build` | ❌ falta `CONTENT_TOKEN` |
| `ci:logic:golden · ci:logic:pbt · ci:logic:no-net` | ❌ falta `CONTENT_TOKEN` |

Los dos rojos fallan en 3–4 s con un mensaje explícito, antes del checkout. **En cuanto exista el
secreto, `gh run rerun <id> --failed` debería ponerlos en verde**, y entonces —y solo entonces— se
puede empezar a marcar `VERIFICADA`.

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
4. **Stryker.** Necesita `plugins: ["@stryker-mutator/vitest-runner"]` declarado (pnpm aísla el
   descubrimiento automático), no acepta `vitest.project`, y usa
   `packages/logic-core/vitest.mutation.config.ts`, que excluye `isolation.test.ts` porque esa
   prueba escanea el código fuente y Stryker lo instrumenta inyectando `process.env`.
   **No edites fuentes con una corrida en marcha**: trabaja sobre una copia y los resultados salen
   falsos. Y al leer el reporte, recorta el nodo mutado por su `location`: el campo de reemplazo no
   distingue dos mutantes distintos de la misma línea.
5. **Bash de Git y `$APPDATA`.** El shim de pnpm resuelve a una ruta inexistente bajo
   `C:\Program Files\Git\...`. Usa PowerShell para todo lo que invoque pnpm.
6. **PostgreSQL reserva el prefijo `pg_`.** Por eso el rol de migraciones es `owner_migrations` y no
   `pg_owner_migrations` como dice el plan (desviación D-6).
7. **Un `.yml` de workflow inválido no degrada un check: los apaga todos.** Pasó el 15-08: el mensaje
   de un `run:` contenía `CONTENT_TOKEN: sin él`, y un `: ` dentro de un escalar YAML plano se parsea
   como mapa anidado. La corrida murió en 0 s **sin ejecutar ningún job**. Valida el workflow con un
   parser antes de subirlo —el paquete `yaml` ya está en el árbol— y usa escalar de bloque (`run: |`)
   para cualquier mensaje con dos puntos.
8. **Bash aquí no entiende los here-strings de PowerShell.** `git commit -m @'…'@` mete un `@` como
   primera línea del mensaje. Para mensajes largos, heredoc (`cat > /tmp/msg <<'EOF'`) y `-F`.

---

## 6. Disciplinas que hay que mantener

No son preferencias de estilo; son lo que hace que este proyecto valga algo.

- **No inventar.** Si falta una decisión y ninguna autoridad la resuelve, va a
  `docs/blocked-by-spec.md` (§0.2.5), no a un valor plausible. El mecanismo `pendingCatalog()` de
  `packages/contracts/src/pending.ts` existe justo para eso: rechaza todo valor en vez de fabricar
  miembros de enum. Hoy no hay ninguno pendiente.
- **Expectativas a priori.** El generador del conjunto dorado declara qué debe pasar **antes** de
  ejecutar y falla si el verificador no cumple. Nunca grabes la salida observada como «esperado»:
  eso convierte el conjunto dorado en un espejo del bug. Ya evitó dos casos mal especificados.
- **Los controles positivos importan.** La suite negativa de privilegios incluye pruebas de que cada
  concesión de la matriz **sí** funciona. Sin ellas, una base rota haría pasar todas las negativas.
- **Nada de degradación silenciosa.** Un fallo no se disfraza de resultado benigno. El CLI falla con
  `NO_IMPLEMENTADO` en vez de simular éxito; `proof-search` lanza `CertificateRejectedError` en vez
  de devolver «no encontré».
- **Desviaciones documentadas.** Cualquier apartamiento del plan va a §«Decisiones de ingeniería» de
  `PLAN_STATUS.md` con su causa. Van **D-1 a D-16**.
- **Una justificación se intenta refutar antes de escribirla.** Vale para los mutantes
  «inalcanzables» y para cualquier «esto no puede pasar»: si no intentaste alcanzarlo, no lo sabes.
- **Un commit, una tarea `T-*`**, con `PLAN_STATUS.md` actualizado en el mismo commit, y **se sube al
  terminarla** (§12 del plan y §8 de este documento).
- **Un control que no puede fallar es peor que no tenerlo.** Dos veces en esta sesión una
  comprobación pasaba por vacío: el check del conjunto dorado tras cerrar D-2, y una prueba que
  comparaba un objeto consigo mismo tras partir un fichero. Antes de dar por bueno un check nuevo,
  **siémbrale un fallo y comprueba que lo detecta**. Es el mismo método que
  `verify-depcruise-catches.mjs` aplica a las reglas de arquitectura.
- **Cuando falte un mapeo que ninguna autoridad da, hazlo dato y falla si no está.** Pasó tres veces
  en F4/F5: el reparto operación↔perfil (D-15), la política de rearme del gate de gasto (D-16) y los
  umbrales de saturación. En los tres, cablear un valor plausible habría movido una frontera real
  —de seguridad, de gasto o de corpus— con una suposición.

---

## 7. Lo que no está verificado y conviene no olvidar

- **Ninguna tarea está `VERIFICADA`.** Todo lo que dice `HECHA` está verificado **localmente** y es
  reproducible, pero §0.4 exige el check en verde en `main`. Ya hay remoto (§8), así que el camino
  está abierto: falta comprobar en Actions que los workflows corrieron y quedaron verdes. No marques
  `VERIFICADA` por el hecho de haber subido el código.
- **El ZIP de mockups no coincide** con el hash de §0.1, aunque el HTML normativo interno sí
  coincide byte a byte. Registrado en `packages/ui-tokens/vendor/PROVENANCE.md`; corresponde al
  aprobador confirmar o corregir la referencia.
- **Los tokens vendorizados cargan Archivo desde Google Fonts** con un `@import`. Incompatible con
  local-first durante una corrida: hay que autoalojar la fuente en la capa de la app antes de que
  `apps/web` los consuma. Anotado en el mismo `PROVENANCE.md`.
- **Calibraciones abiertas por diseño**: `CALC-03` (decisor terminante), `CALC-05` (cota tabla↔SAT),
  `CAL-04` (conjunto dorado), `CAL-07` (isomorfismo), `CAL-08`, `CAL-09` (pesos y comparabilidad del
  índice de complejidad, H5), `CAL-SOURCE-SCORE` y `CAL-SATURATION` (idoneidad y parada de W0,
  H4.5), `CAL-NLI` (fiabilidad del NLI por estrato, H5), y los benchmarks `BENCH-01/02` (F4) y
  `BENCH-04` (orden del pipeline de autoría, F6).
  `docs/params/registry.yaml` está vacío a propósito: se llena cuando un gate real congele un valor.
  **Todas tienen ya su punto de fallo escrito en el código** —`complexityIndex()`,
  `assertComparable()`, `freezeWinningOrder()`, `suitabilityScore()`, `compareSuitability()`,
  `shouldStopDiscovery()`, `nliGate()`, `CanaryRegistry.plan()`—: son el lugar donde se enchufa el
  valor congelado, no bugs que arreglar.
- **F4 no tiene ni una llamada real a un proveedor.** Toda la pasarela está probada con transporte
  inyectado y respuestas construidas a mano. Eso prueba la lógica local, **no** que un proveedor
  responda como el adaptador supone: las formas de respuesta de Anthropic y OpenAI están escritas
  desde su contrato documentado y las verifica `T-H4-09` justo antes del benchmark. Si al hacer la
  primera llamada real aparece un `UnknownProviderContractError`, es el adaptador haciendo su trabajo.
- **`T-H2-05` aparece dos veces en la tabla de F2** de `PLAN_STATUS.md`: una fila para «13 primitivas
  + `DNE`, whitelist cerrada» y otra para `src/rules.ts`. Las dieciséis tareas de F2 están hechas y
  ninguna falta —el trabajo está—, pero **una de las dos filas lleva el id equivocado**. No se
  corrigió porque no consta cuál de los dos ids es el bueno, y elegir uno sería inventar
  trazabilidad. Quien lo sepa, que lo arregle contra `Plan.md` §F2.
- **F5 no ha corrido W0 sobre fuentes reales.** El mecanismo está completo y probado con fixtures;
  `research/` sigue con `selection-manifest.yaml`, `source-scores.yaml`, `conflicts.yaml`,
  `coverage-saturation.yaml` y `license-register.yaml` como placeholders vacíos. Solo
  `whitelist.yaml` está poblado.

---

## 8. Control de versiones — **hay remoto, y se usa**

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
dorado reproducible» llevaba pasando por vacío. Revísalo al añadir cualquier check que cruce esa
frontera.

### Consecuencia para el estado `VERIFICADA`

Hasta ahora ninguna tarea podía pasar de `HECHA` porque §0.4 exige el check **en verde en `main`** y
no había dónde ejecutarlo. Con el remoto ya existe `.github/workflows/ci.yml` en el repositorio.
**Antes de marcar `VERIFICADA` cualquier tarea, mira la pestaña Actions y comprueba que su check
corrió y quedó en verde en `main`.** Que exista el remoto no es lo mismo que el check haya corrido:
sigue siendo verde observado, no verde supuesto.

### El repositorio de contenido

`content/unidad-deduccion-natural/` es un repositorio git independiente con historial propio (§4.3).
Su remoto es <https://github.com/MEX-AmatsuMikaboshi/profe_ia_contenido.git> (privado) y **ya está
formalizado como submódulo** en `.gitmodules`: **D-2 cerrada** el 15-08-2026.

Dos consecuencias prácticas:

- **Al clonar**, usa `git clone --recurse-submodules`; si ya clonaste, `git submodule update --init`.
  Sin el contenido, `ci:unit` y `ci:logic:golden` no pueden correr: leen el cálculo congelado y los
  413 casos del conjunto dorado desde ahí.
- **Al cambiar contenido**, se sube **primero** el repositorio de contenido y **después** el monorepo
  con el gitlink actualizado. Si se hace al revés, el gitlink apunta a un commit que no existe en el
  remoto y el checkout de CI falla con `fatal: reference is not a tree`. Ese orden no es una
  preferencia: es la causa exacta de que el primer push dejara `base` y `logic` en rojo.

Para ver dónde quedó todo: `git log --stat -1` en cada uno.

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
3. **Comprueba que el árbol sigue en pie** con la batería de §4. Debe dar **719 pruebas**. Si da
   menos, algo se perdió; si da más sin que nadie haya trabajado, algo se duplicó.
4. **Arranca F6 · H5** por `T-H5-01`. Lee antes `Plan.md` §F6 entero —son 17 tareas y varias se
   condicionan entre sí— y navega el Maestro solo por lo que cada tarea cite (`^#{1,3} ` con Grep).
5. **Al cerrar cada tarea**, commit propio con su id, `PLAN_STATUS.md` en el mismo commit, batería en
   verde y `git push origin main`. Si tocas `content/`, **primero el submódulo** (§8).

### Preguntas abiertas para el propietario

Ninguna bloquea el trabajo de código, pero las tres llevan tiempo esperando:

1. **`CONTENT_TOKEN`** — bloquea todos los `VERIFICADA`. Instrucciones en §8.
2. **Credenciales de proveedor y autorización de gasto** — bloquean `T-H4-10/11`. El tope declarado
   es ≈MXN 500/mes con bloqueo duro a los 700, y el gate ya está implementado y probado.
3. **Cuenta administrativa de Infisical** — hasta entonces los servicios leen credenciales de `.env`,
   que es el modo de arranque, no el de destino.

Las tres son acciones del propietario por naturaleza, no tareas pendientes de nadie más.
