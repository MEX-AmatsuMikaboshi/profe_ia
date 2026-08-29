# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

El repositorio trabaja en **español**: documentación, comentarios, mensajes de commit y salida al
usuario. Los ids formales (`rule_id`, códigos `E-*`, enums, nombres de check) nunca se traducen.

## 1. Jerarquía de autoridad — léela antes de decidir nada

Este repo no se gobierna por el código, sino por documentos ordenados (`Plan.md` §0.1):

1. `docs_maes/Profesor_IA_Documento_Maestro_Normalizado_v2.12_PostUI_PrePlan.md` (**Maestro**, citado como P-I/P-II/P-III + Apéndices)
2. `docs_maes/Profesor_IA_Especificacion_UI_UX_v0.1_Conformada.md` (**UIUX**)
3. `Plan.md` (raíz, 117 KB — el plan de construcción ejecutable, tareas `T-Hx-nn`)
4. La implementación

**Si el código contradice al plan, el código está mal. Si el plan contradice al Maestro, el plan está
mal** — y se corrige el inferior, no el superior. Ya ocurrió tres veces (ver «Correcciones por
autoridad superior» en `docs/plan/PLAN_STATUS.md`).

El Maestro son 388 KB: no lo leas entero. Navega por secciones (`Grep '^#{1,3} '`) y lee solo lo que
la tarea cita.

### Puntos de entrada obligatorios

| Archivo | Qué es |
|---|---|
| `docs/plan/HANDOFF.md` | Punto de continuación entre sesiones. **Léelo primero.** |
| `docs/plan/PLAN_STATUS.md` | Fuente de verdad de avance, tarea por tarea, con evidencia y las decisiones de ingeniería D-1…D-14 |
| `docs/gates/H*.md` | Actas de gate; un gate sin acta firmada no está cerrado |
| `docs/blocked-by-spec.md` | Decisiones normativas faltantes (hoy vacío, a propósito) |

Estados de tarea: `PENDIENTE → EN_CURSO → HECHA → VERIFICADA`. **`VERIFICADA` exige el check en verde
en `main`**, observado en la pestaña Actions del remoto. Que el código esté subido no basta: si no
has visto el check verde, la tarea es `HECHA`, no `VERIFICADA`.

## 2. Comandos

Ejecuta **todo desde PowerShell**. En el Bash de Git, `$APPDATA` se expande a una ruta Windows dentro
de un contexto POSIX y el shim de pnpm resuelve a `C:\Program Files\Git\...\pnpm.cjs`, que no existe.

```bash
pnpm install
pnpm run ci:lint && pnpm run ci:typecheck && pnpm run ci:unit && pnpm run ci:build
```

Verificación completa de que todo sigue en pie (~1 min sin Docker):

```bash
pnpm run ci:arch:depcruise && node scripts/arch/verify-depcruise-catches.mjs && pnpm run ci:mode-separation && pnpm run ci:e2e:dry-session && pnpm run ci:adversarial:session && pnpm run ci:logic:golden && pnpm run ci:logic:pbt && pnpm run ci:logic:no-net && pnpm run db:grants:check && pnpm run ci:db:negative && pnpm run ci:supply:sbom && pnpm run ci:supply:drift && pnpm run ci:infra:hardening &&
pnpm run ci:content:mangos && pnpm run ci:plan:status
```

| Comando | Qué hace |
|---|---|
| `pnpm run ci:unit` | Vitest, proyecto `unit` (~3 s) |
| `pnpm run ci:db:negative` | Suite negativa de privilegios contra PostgreSQL 17 real vía Testcontainers (~12 s, necesita Docker) |
| `pnpm run ci:arch:depcruise` | Reglas `forbidden` que codifican los invariantes I-1…I-9 |
| `node scripts/arch/verify-depcruise-catches.mjs` | Que esas reglas **detectan** una violación sembrada |
| `node scripts/arch/verify-test-typecheck-catches.mjs` | Que el typecheck de las pruebas **ve** un error sembrado en `test/` (D-62) |
| `pnpm run ci:logic:golden` / `:pbt` / `:no-net` | Conjunto dorado (413 casos) / propiedades fast-check / pureza del verificador |
| `pnpm run ci:logic:mutation` | Stryker sobre `logic-core` (~8–9 min; se corre aparte) |
| `pnpm run ci:mode-separation` / `ci:e2e:dry-session` | El AC del gate H6: separación de modos (12 propiedades) y sesión seca E2E reconstruible desde eventos (33) |
| `pnpm run ci:gateway:fail-closed` | Que la pasarela no envía parámetros no declarados por el binding ni acepta un binding sin snapshot ni huella |
| `pnpm run db:grants:check` | Que la migración de `GRANT` corresponde a la matriz vigente |
| `pnpm run ci:supply:sbom` / `:drift` | SBOM CycloneDX + digest de lockfile / drift y advisories (bloqueante) |
| `pnpm run ci:infra:hardening` | 159 propiedades sobre la config **resuelta** por Docker |
| `pnpm run bench:preparacion <runId> [cands]` | Qué falta para la corrida material de BENCH-01. No gasta nada; sale con 1 si aún no se puede correr (D-72) |
| `pnpm run bench:material <runId> <cands> <reps> <maxTokens> [timeoutMs]` | **La corrida material de BENCH-01. GASTA DINERO de verdad.** Mide los seis gates con `observeGates()` y **no corona**: el paquete sin congelar lo impide (D-74) |
| `node scripts/model/refresh-sources.mjs <urls>` | Huellas reproducibles de las fuentes de un refresco documental. Descarga dos veces y falla si difieren (D-73) |
| `pnpm run ci:adversarial:session` | AC de `T-H7-03`: extracción/injection del alumno (P-II §14.4 de sesión) y la puerta de no revelación de P-I §9.6 |
| `pnpm run ci:infra:compose-up` | Arranque limpio del stack + verificador por spool + prueba de que `core` no sale a Internet |
| `pnpm run ci:infra:otel` | AC de `T-H3-05`: los spans llegan al colector, y la derivación del alumno no |
| `pnpm run dev:docker` | **Arranca Docker Desktop.** A mano no arranca: ver trampa 6. También `dev:docker:clean/stop` |
| `pnpm run dev:env` → `dev:up` → `dev:seed` | Levantar el entorno local (`infra/runbooks/local.md`); además `dev:down/status/logs/backup/restore` |
| `pnpm run logic:golden:generate` | Regenera el conjunto dorado; **el diff debe ser vacío** |
| `pnpm run content:mangos` / `ci:content:mangos` | Tabla de correspondencia mango → `fragmentId` (D-77) / comprueba que sigue correspondiendo al corpus |
| `pnpm run plan:status` / `ci:plan:status` | Coherencia de `PLAN_STATUS.md`: estados declarados, decisiones sin huecos ni duplicados, ninguna cita `D-N` colgada (D-81) |
| `pnpm run contracts:json-schema` | Emite los JSON Schema desde `packages/contracts` |

### Una sola prueba

```bash
pnpm exec vitest run --project unit packages/logic-core/test/rules.test.ts -t "∨E"
```

`vitest.config.ts` define dos proyectos: `unit` (`packages|tools|apps/*/test/**`) y `db`
(`infra/database/test/**`, con timeouts largos y `fileParallelism: false` porque el estado de la base
es compartido). Sin `--project`, corren ambos.

### Antes de tocar migraciones o la matriz de permisos

`infra/database/migrations/20260815120100_grants.sql` es **generado**. La fuente es
`packages/security-policy/src/matrix.ts`. El flujo es: editar la matriz → `pnpm run ci:build` (el
generador lee el paquete compilado) → `pnpm run db:grants` → `pnpm run ci:db:negative`.

## 3. Arquitectura

Monolito modular con procesos aislados. `pnpm workspaces` + Turborepo; 23 workspaces bajo `apps/*`,
`packages/*` y `tools/*`. Las listas de `apps/` y `packages/` son **obligatorias** (P-II §3.1): no se
crean paquetes nuevos. Por eso el CLI vive en `tools/cli` (D-1) y el índice de complejidad en
`proof-search` en vez de en un paquete propio (D-10).

TypeScript 5.9.3 `strict` + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` +
`verbatimModuleSyntax`, ESM `NodeNext`, Node 24. Cada paquete compila con `tsc -p tsconfig.json` a
`dist/`; `turbo` encadena `build`/`typecheck` con `dependsOn: ["^build"]`.

### Los invariantes son ejecutables, no prosa

`.dependency-cruiser.cjs` tiene 10 reglas `forbidden`; **cada una codifica un invariante I-1…I-9 y su
violación es una implementación inválida**, no un aviso de estilo:

- **I-1** — `session-engine`, `pedagogy-policy` y `domain-engine` no pueden importar SDKs de
  proveedor de modelo. Solo `model-gateway` habla con proveedores.
- **I-2** — `model-gateway`, `session-engine`, `apps/api` y `apps/web` no alcanzan
  `solutions-private`. `solutions-private/` nunca se monta en contenedores del agente ni de web.
- **I-3 / T-H2-15** — la ruta de verificación (`logic-core`, `apps/verifier`) no importa ningún
  cliente HTTP ni socket. El verificador corre con `network_mode: none`; su transporte es un spool en
  disco (D-12), y es función pura sin red, sin `process.env`, sin reloj ni azar.
- **I-4** — `authoring-worker`/`authoring-core` no tocan sondas ni `measurement-worker`.
- **T-H2-09** — `isomorphism-canonicalizer` está **prohibido** en la ruta de verificación; por eso es
  un paquete separado de `logic-core`.
- **DEC-VISION-001** — ningún score visual autoriza un veredicto formal.

Si añades un import y `ci:arch:depcruise` falla, el import está mal, no la regla.

### Base de datos

Siete esquemas exactos (`identity`, `pedagogy`, `evidence`, `private_solutions`, `measurement`,
`audit`, `operations`) — **no se crea un octavo**. Por eso las seis tablas de Better Auth viven dentro
de `identity` con prefijo `auth_` (D-14). `evidence` es append-only por triggers que niegan
`UPDATE`/`DELETE`/`TRUNCATE` incluso al propietario, con secuencia monótona y cadena `previous_hash`
verificada en la base; una corrección es un evento nuevo enlazado (I-6). RLS es **segunda** capa, no
la primera. El rol de migraciones es `owner_migrations`, no `pg_owner_migrations`: PostgreSQL reserva
el prefijo `pg_` (D-6).

### Núcleo lógico (`packages/logic-core`)

Verificador determinista de deducción natural proposicional en formato Fitch sobre el cálculo
congelado `authorized-calculus-v1`, transcrito literalmente y hasheado. Sin precedencia entre
conectivos binarios (`A∧B∧C` se rechaza con `E-SYN-PRECEDENCE`); `¬` liga la unidad siguiente (D-8).
Prohibidas conmutativa, asociativa, DNE automática, NNF/CNF/DNF. La lista de códigos `E-*` es
**cerrada**: no inventes uno nuevo. `valid` y `goalReached` están separados a propósito (D-9).

`proof-search` re-verifica obligatoriamente todo certificado con `logic-core`; un certificado
rechazado lanza `CertificateRejectedError` (incidente nivel 3), nunca se disfraza de «no encontré».
`no_proof_exists_in_calculus` **no existe** en la implementación (CALC-03), y agotar el presupuesto no
afirma inexistencia.

## 4. Disciplinas que no se negocian

- **No inventar.** Si falta una decisión y ninguna autoridad la resuelve, va a
  `docs/blocked-by-spec.md` y a `PLAN_STATUS.md` como `BLOCKED_BY_SPEC`, no a un valor plausible.
  `packages/contracts/src/pending.ts` (`pendingCatalog()`) rechaza todo valor en vez de fabricar
  miembros de enum.
- **Los valores `[CALIBRATION]` fallan cerrado.** `complexityIndex()`, `assertComparable()` y
  `freezeWinningOrder()` lanzan porque su parámetro se congela en un gate futuro (CAL-09, BENCH-04).
  **No los «arregles» devolviendo un número**: ese punto de fallo es donde se enchufa el valor
  congelado.
- **Nada de degradación silenciosa.** Un fallo no se disfraza de resultado benigno. El CLI falla con
  `NO_IMPLEMENTADO` (exit 3); `api`/`web` responden `NO_IMPLEMENTADO` a todo lo que no sea `/health`
  hasta que su fase los implemente (D-11). Un worker que dijera «listo» sin pipeline sería éxito
  simulado.
- **Expectativas a priori.** El generador del conjunto dorado declara qué debe pasar **antes** de
  ejecutar. Nunca grabes la salida observada como «esperado»: eso convierte el conjunto dorado en un
  espejo del bug. Ya evitó dos casos mal especificados.
- **Controles positivos.** La suite negativa de privilegios incluye pruebas de que cada concesión de
  la matriz **sí** funciona; sin ellas, una base rota haría pasar todas las negativas por vacío.
- **Una justificación se intenta refutar antes de escribirla.** Vale para los mutantes
  «inalcanzables» y para cualquier «esto no puede pasar». La del oráculo semántico parecía sólida y
  era falsa.
- **Desviaciones documentadas.** Cualquier apartamiento del plan va a «Decisiones de ingeniería» de
  `PLAN_STATUS.md` con su causa (van D-1 a D-14). No tienen autoridad normativa.
- **Un PR, una tarea `T-*`**, título `T-Hx-nn: …`, y `PLAN_STATUS.md` actualizado en el mismo PR.

## 5. Trampas de este entorno

Son reales y cuestan una hora cada una si no se conocen (`docs/env/windows.md`).

1. **PowerShell para pnpm** — ver §2.
2. **PATH de Docker.** Una consola abierta *antes* de instalar Docker conserva el PATH viejo y
   Testcontainers falla con `spawn docker-credential-desktop ENOENT`. Antepón
   `C:\Program Files\Docker\Docker\resources\bin` o abre consola nueva. Los scripts de `scripts/dev/`
   y `scripts/infra/` ya lo hacen solos.
3. **pnpm está en `%APPDATA%\npm`** (instalado con npm; `corepack enable` falla por permisos en
   `C:\Program Files\nodejs`).
4. **`.cmd` desde Node.** `execFile` sin shell sobre `pnpm.cmd`/`npx.cmd` falla con `EINVAL` desde
   Node 20. Resuelto en `scripts/supply/pnpm-exec.mjs` (usa `npm_execpath`) y en
   `scripts/arch/verify-depcruise-catches.mjs` (invoca el `.mjs` con `process.execPath`). Sigue ese
   patrón si escribes un script nuevo que invoque pnpm.
5. **Stryker.** Usa `packages/logic-core/vitest.mutation.config.ts`, necesita `plugins` declarado
   explícitamente y no acepta `vitest.project`. **No edites fuentes con una corrida en marcha**: los
   resultados salen falsos. Al leer el reporte, recorta el nodo mutado por su `location` — el campo de
   reemplazo no distingue dos mutantes distintos de la misma línea, y leerlo mal produce conclusiones
   falsas en ambas direcciones. `.stryker-tmp/` contiene copias completas del repo: **exclúyela de
   toda búsqueda** (glob/grep) o los resultados vendrán multiplicados por seis.
6. **Docker Desktop no arranca dos veces seguidas.** Deja sus sockets AF_UNIX en disco como reparse
   points que Windows después no deja borrar (error 1920), y el `remove` previo al rebind tumba el
   backend. Arráncalo **siempre con `pnpm run dev:docker`**, que limpia
   `%LOCALAPPDATA%\Docker\run` **y** `%LOCALAPPDATA%\docker-secrets-engine` —los dos, limpiar uno
   sólo mueve el fallo al otro— antes de lanzarlo. Desde el icono seguirá fallando (D-31).

## 6. Estado actual (2026-08-26)

F0/H0, F1/H1 y F2/H2 completas. **F3/H3 con sus 5 tareas y el criterio técnico cubierto**: los tres
checks de infraestructura están en CI; el gate espera sólo Infisical y firmas. F5/H4.5 con 8 de 8,
F7/H6 con 14 de 14 y el AC cubierto.

**F6/H5 — el contenido ya está.** W0–W4 corrieron sobre el corpus real. **Banco vigente: 656
candidatos, 656 aceptados, 0 rechazados**, sin huecos de cobertura, con las guardas de clausura de
reglas y control de superficie **enchufadas a `runW3Generation()`** —abortan la corrida, con
controles positivos—. La selección A/B/C y los tres artefactos de W4 se re-corrieron sobre ese banco
(D-69): W4 es censo de 656 en 178 estratos y **no bloquea**. Lo que falta de F6 es humano: la
**lectura humana por muestra del paso 19**, la **Parte A ciega** de otra familia de modelo, y **W5**
(clave Ed25519, auditoría aprobada, firma).

**F4/H4 — BENCH-01 CORRIÓ, y hay ganador provisional (D-74, D-75, D-76).** Los 200 casos materiales
contra `claude-sonnet-5` y `claude-haiku-4-5-20251001`, los seis gates computados, MXN 47.91 de gasto
real. **Ganador provisional: `claude-sonnet-5`** — 4 de 6 gates, no bloqueado, frente a 3 de 6 y
bloqueado del otro. **Ningún candidato aprueba los seis, así que la puerta de H4 NO está cumplida.**
Lo que falla no es la seguridad —cero fugas y recuperación degradada limpia en los tres candidatos y
en los 600 casos— sino la **disciplina de formato**: el gate de anclas (≥95 %) da 84.2 % en
`claude-sonnet-5` y 15.4 % en `claude-haiku-4-5`. Los diagnósticos son distintos y sólo uno es de
capacidad: el primero **no ancla lo que afirma** (29 segmentos factuales con `anchors: []`, con 77 de
80 salidas aceptadas); el segundo **acorta el `fragmentId`** y produce 136 anclas inexistentes.
**El identificador de ~100 caracteres es defecto nuestro**, y acortarlo es la palanca que más rinde.
Informe completo en `docs/model/bench-01.md`. Para **coronar formalmente** siguen faltando la revisión
humana de los 200 casos (D-41), la auditoría en muestra ciega de §6.2, y **W5** —que es lo que
`assertPackageMayCrownWinner()` espera—.

**OpenAI se midió y no corona (D-76).** El propietario autorizó una **medición exploratoria
declarada**: `gpt-5.6-luna` sacó **5 de 6 gates a MXN 1.44**, el mejor de los tres. No puede coronar
porque su identidad no está fijada, y la pinza está **comprobada**: los modelos vigentes de OpenAI no
publican snapshot fechado ni la documentación declara que un id sin fecha lo sea, y los ids que **sí**
están fijados por fecha están **deprecados con apagado el 2026-12-11**. Se comprobó además que la API
**no devuelve un snapshot resuelto** en el campo `model`. `UnpinnedIdentityWaiver` permite medirlo y
**tres puertas independientes** impiden que corone: conjunto `pilot`, refresco `test_fixture`, y una
corrida material que **rechaza toda renuncia**. `T-H4-11`/BENCH-02 sigue bloqueada por esto, no por
credenciales.

**F8/H7 con 2 de 7**: `T-H7-02` (validador de anclaje) y `T-H7-03` (no revelación y suite
adversarial). Las cuatro restantes viven dentro del bucle W7; ya tienen binding ganador con el que
empezar `T-H7-01`. F9–F16 no empezadas.

**1851 pruebas unitarias en verde + 131 contra PostgreSQL 17 real.** Mutation testing sobre
`logic-core` en verde. **Aviso:** los conteos de sesiones anteriores («1890», «1918 unitarias») no son
comparables — parecen haber sumado los proyectos `unit` y `db` bajo la misma etiqueta. Medido el 2026-08-26,
`--project unit` da 1851 y `--project db` da 131.

**✅ CI VIVA desde el 2026-08-29, tras diez sesiones muerta.** Dos causas encadenadas, y conviene
saber las dos porque ninguna era la que este archivo decía.

**1. El presupuesto no estaba en cero: estaba agotado.** Había uno de Actions de **USD 2.00 con USD
2.00 gastados**, al 100 % y con «Stop usage». No faltaba crearlo, faltaba subirlo — ahora USD 5. El
mensaje del check-run dice «payments have failed **or** your spending limit needs to be increased», y
las dos mitades se parecen lo bastante como para adivinar mal once sesiones. **Mirar la pantalla
habría costado dos minutos.** La anotación sigue siendo la primera puerta cuando un check falla sin
salida propia:

```bash
gh api repos/MEX-AmatsuMikaboshi/profe_ia/check-runs/<job_id>/annotations --jq '.[].message'
```

**2. Detrás había un fallo real que la avería tapaba.** Con los jobs arrancando, tres fallaron en
`checkout` con `upload-pack: not our ref`. **No era `CONTENT_TOKEN`**: era el gitlink apuntando a un
commit que **nunca se subió al remoto de contenido** (D-68 y D-69, el banco de 656). Es el fallo que
§8 del handoff advierte —primero el submódulo, después el monorepo—, cometido en la sesión 16 y
oculto trece días. **Lección: una avería que impide correr esconde los fallos que vendrían detrás.**

**El presupuesto es de USD 5 con tope: los pushes se agrupan.** El propietario pidió el 2026-08-29
dejar de subir una vez por tarea y acumular. Los **commits** siguen siendo por tarea, con su id `T-*`
y `PLAN_STATUS.md` en el mismo commit; lo que se agrupa es el `git push`. Es desviación declarada de
§8, no olvido.

**Las anclas se citan por mango corto desde D-77 (2026-08-26).** `F-` más ocho dígitos hexadecimales
derivados por SHA-256 del `fragmentId` canónico: **10 caracteres contra 107.4**. El validador de
anclaje acepta **los dos**, y la tabla se publica en `analysis/reports/fragment-handles.json`
(`pnpm run content:mangos`, comprobada por `pnpm run ci:content:mangos`). El id canónico sigue siendo
el de proveniencia; el mango es proyección de presentación. Esto **no** re-corre BENCH-01: cambia el
prompt, y §8.5 exige recongelar y re-evaluar.

**El estado tarea por tarea, con evidencia, está en `docs/plan/PLAN_STATUS.md`, y por dónde seguir en
`docs/plan/HANDOFF.md`, cabecera «EMPIEZA AQUÍ».** Este apartado se queda rancio entre sesiones; esos
dos no.

**Remoto del monorepo:** <https://github.com/MEX-AmatsuMikaboshi/profe_ia.git> (`origin/main`).
**Al terminar una tarea `T-*`, se sube**: un commit por tarea, con `PLAN_STATUS.md` actualizado en el
mismo commit, la batería de verificación en verde y `git push origin main`. No se acumulan tareas
para subirlas juntas. El detalle está en `docs/plan/HANDOFF.md` §8.

`content/unidad-deduccion-natural/` es un repositorio independiente con historial propio, registrado
como gitlink; falta crear su remoto y formalizarlo con `git submodule add` (D-2).

**Nunca se versiona `.env`.** Antes de cada commit, `git status --short`: si aparece un `.env`, para.
