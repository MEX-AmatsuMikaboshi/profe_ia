# HANDOFF — punto de continuación

**Fecha del checkpoint:** 2026-08-15 (F1, F2 y casi toda F3 cerradas; el anterior es del 14-08)
**Para:** la siguiente sesión que continúe la ejecución de `Plan.md`.

Este archivo es el punto de entrada. Léelo entero antes de tocar nada, y después
[`PLAN_STATUS.md`](PLAN_STATUS.md), que es la fuente de verdad de avance (§12 del plan).

**Lo primero que hay que saber:** ya hay remoto
(<https://github.com/MEX-AmatsuMikaboshi/profe_ia.git>) y **cada tarea terminada se sube**. Cómo y
con qué comprobaciones, en §8.

### Por dónde empezar, en una línea

F0–F2 completas, F3 a falta de `T-H3-05`. **La siguiente tarea del camino crítico es F4 · H4**
(pasarela de modelo y benchmark). Antes de arrancarla, lee §3 —hay tres cosas cerradas esta sesión
que se rompen fácil si no se conocen— y §7, que enumera lo que **no** está verificado.

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
| **F0 · H0** repositorio, contratos, CI | Completa. Gate abierto solo por falta de ejecución en `main` |
| **F1 · H1** BD, roles, evidencia | Completa. El gate solo espera firma y ejecución en `main` |
| **F2 · H2** verificador | 16 de 16 tareas. **Todo el AC cubierto**; el gate solo espera firma y ejecución en `main` |
| **F3 · H3** entorno local | 4 de 5 tareas. Falta `T-H3-05` (trazas, esperan operación real) |
| F4–F16 | No empezadas |

Detalle tarea por tarea, con evidencia y fechas: [`PLAN_STATUS.md`](PLAN_STATUS.md).
Actas de gate: [`../gates/`](../gates/) — `H0.md`, `H1.md`, `H2.md`, todas **abiertas**.

---

## 3. Por dónde seguir

### La tarea siguiente: F4 · H4 — pasarela de modelo y benchmark

Es lo único del camino crítico que queda sin empezar y que no depende de nadie más. `Plan.md` §F4:
`model-gateway` con proveedores, bindings, filtros de egreso y `cost-ledger`, más el arnés
`BENCH-01/02`. Tres cosas que ya están puestas y que conviene aprovechar en vez de rehacer:

- La regla depcruise `i1-session-engine-sin-sdk-de-proveedor` ya prohíbe que nadie salvo
  `model-gateway` importe un SDK de proveedor. Si al implementarla aparece una violación, es la
  regla haciendo su trabajo, no un estorbo.
- El compose ya deja a `authoring-worker` como **único** servicio con salida a Internet. La pasarela
  de sesión no la tiene: eso condiciona dónde puede vivir cada llamada.
- Los contratos de coste (`pricing_manifest`, `cost_event`) ya existen en la base con la regla dura
  de que un cambio de tarifa **crea un manifiesto nuevo, nunca reescribe costos**.

Lo demás que queda abierto, y por qué no bloquea a F4:

- **`T-H3-05`** (trazas) espera a que exista una operación real que trazar, en F7/F8.
- **Los gates H0–H3** esperan firma humana y ejecución en Actions, no más código.
- **Infisical** necesita que crees su cuenta administrativa a mano.

---

Lo cerrado esta sesión, con lo que hay que saber antes de tocarlo:

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
pnpm run db:grants:check && pnpm run ci:db:negative
pnpm run ci:supply:sbom && pnpm run ci:supply:drift
pnpm run ci:infra:hardening
```

El entorno local se comprueba aparte, porque necesita Docker y tarda:

```bash
pnpm run ci:infra:compose-up
```

Estado en el checkpoint: **todo en verde**. 505 pruebas: 378 unitarias + 127 contra PostgreSQL 17
real. (El checkpoint del 14-08 decía «391 unitarias + 103»; 391 era en realidad el total de las dos
suites, no solo las unitarias.)

`pnpm run ci:logic:mutation` tarda ~9 minutos y se ejecuta aparte.

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
6. **Bash de Git y `$APPDATA`.** El shim de pnpm resuelve a una ruta inexistente bajo
   `C:\Program Files\Git\...`. Usa PowerShell para todo lo que invoque pnpm.
5. **PostgreSQL reserva el prefijo `pg_`.** Por eso el rol de migraciones es `owner_migrations` y no
   `pg_owner_migrations` como dice el plan (desviación D-6).

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
  `PLAN_STATUS.md` con su causa. Van D-1 a D-13.
- **Una justificación se intenta refutar antes de escribirla.** Vale para los mutantes
  «inalcanzables» y para cualquier «esto no puede pasar»: si no intentaste alcanzarlo, no lo sabes.
- **Un commit, una tarea `T-*`**, con `PLAN_STATUS.md` actualizado en el mismo commit, y **se sube al
  terminarla** (§12 del plan y §8 de este documento).

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
  índice de complejidad, H5) y el benchmark `BENCH-04` (orden del pipeline de autoría, F6).
  `docs/params/registry.yaml` está vacío a propósito: se llena cuando un gate real congele un valor.
  Las dos últimas ya tienen su punto de fallo cerrado en el código (`complexityIndex()`,
  `assertComparable()`, `freezeWinningOrder()`): son el lugar donde se enchufa el valor congelado.

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
