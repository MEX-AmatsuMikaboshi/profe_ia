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
pnpm run ci:arch:depcruise && node scripts/arch/verify-depcruise-catches.mjs && pnpm run ci:mode-separation && pnpm run ci:e2e:dry-session && pnpm run ci:adversarial:session && pnpm run ci:logic:golden && pnpm run ci:logic:pbt && pnpm run ci:logic:no-net && pnpm run db:grants:check && pnpm run ci:db:negative && pnpm run ci:supply:sbom && pnpm run ci:supply:drift && pnpm run ci:infra:hardening
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
| `node scripts/model/refresh-sources.mjs <urls>` | Huellas reproducibles de las fuentes de un refresco documental. Descarga dos veces y falla si difieren (D-73) |
| `pnpm run ci:adversarial:session` | AC de `T-H7-03`: extracción/injection del alumno (P-II §14.4 de sesión) y la puerta de no revelación de P-I §9.6 |
| `pnpm run ci:infra:compose-up` | Arranque limpio del stack + verificador por spool + prueba de que `core` no sale a Internet |
| `pnpm run ci:infra:otel` | AC de `T-H3-05`: los spans llegan al colector, y la derivación del alumno no |
| `pnpm run dev:docker` | **Arranca Docker Desktop.** A mano no arranca: ver trampa 6. También `dev:docker:clean/stop` |
| `pnpm run dev:env` → `dev:up` → `dev:seed` | Levantar el entorno local (`infra/runbooks/local.md`); además `dev:down/status/logs/backup/restore` |
| `pnpm run logic:golden:generate` | Regenera el conjunto dorado; **el diff debe ser vacío** |
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

## 6. Estado actual (2026-08-23)

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

**F4/H4 — BENCH-01 ya puede medir los seis gates (D-70, D-71).** Era el bloqueo declarado en §3.5 del
handoff: dos de los seis gates de P-III §6.2 no se podían computar. Ya se computan.
`tools/bench/src/corpus.ts` carga el paquete real —18 fragmentos con texto, los 18 KC con
fragmentos, 493 activos congelados— y la salida material pasó a `AnchoredSegment`, que es el contrato
que la sesión usará. **Medir no es coronar**: `observeGates()` computa sin dictamen y
`scoreCandidate()` exige `frozen: true`, que hoy es `false` porque W5 no ha corrido. **`pnpm run bench:preparacion <runId> [candidatos]`
dice qué falta sin gastar nada** (D-72), y con `claude-sonnet-5` hoy dice **`SE PUEDE CORRER`**: el
refresco documental se rehízo el 2026-08-23 (D-73) y las cuatro comprobaciones bloqueantes pasan.
**Ya no hay bloqueo de código para correr BENCH-01.** Lo que falta para **coronar** es la revisión
humana de los 200 casos y W5.

**F8/H7 con 2 de 7**: `T-H7-02` (validador de anclaje) y `T-H7-03` (no revelación y suite
adversarial). Las cuatro restantes viven dentro del bucle W7 y exigen el ganador de BENCH-01.
F9–F16 no empezadas.

**1890 pruebas unitarias en verde + 131 contra PostgreSQL 17 real.** Mutation testing sobre
`logic-core` en verde.

**⚠ CI está caída y es de la cuenta, no del código.** Van siete corridas seguidas con la firma de
D-58: los diez jobs a cero pasos en dos segundos. Comprobado que Actions está `enabled` con
`allowed_actions: all` y que el repositorio no está `archived` ni `disabled`. Queda la facturación
—repositorio privado en cuenta de usuario, así que consume cuota de minutos— y eso necesita al
propietario. **Mientras siga así, nada nuevo pasa de `HECHA` a `VERIFICADA`.**

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
