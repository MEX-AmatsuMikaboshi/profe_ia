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
| `docs/plan/PLAN_STATUS.md` | Fuente de verdad de avance, tarea por tarea, con evidencia y las decisiones de ingeniería D-1…D-100 |
| `docs/gates/H*.md` | Actas de gate; un gate sin acta firmada no está cerrado |
| `docs/blocked-by-spec.md` | Decisiones normativas faltantes (hoy vacío, a propósito) |

Estados de tarea: `PENDIENTE → EN_CURSO → HECHA → VERIFICADA`. **`VERIFICADA` exige el check en verde
en `main`**, observado en la pestaña Actions del remoto. Que el código esté subido no basta: si no
has visto el check verde, la tarea es `HECHA`, no `VERIFICADA`.

## 2. Comandos

Ejecuta **todo desde PowerShell**. En el Bash de Git, `$APPDATA` se expande a una ruta Windows dentro
de un contexto POSIX y el shim de pnpm resuelve a `C:\Program Files\Git\...\pnpm.cjs`, que no existe.

**El submódulo de contenido es requisito, no accesorio.** `content/unidad-deduccion-natural/` trae el
cálculo congelado, el corpus y los 413 casos del conjunto dorado: sin él, `ci:unit`, `ci:logic:*` y
`ci:content:mangos` no pueden correr. Si el árbol se clonó sin `--recurse-submodules`:

```bash
git submodule update --init --recursive
```

**`&&` no encadena en esta consola.** PowerShell 5.1 —la única instalada; no hay `pwsh` 7— lo
rechaza al parsear: «El token '&&' no es un separador de instrucciones válido en esta versión». Dentro
de `package.json` sí funciona, porque los scripts los corre pnpm en su propio shell; lo que no
funciona es escribirlo tú en la consola. La forma que corre **y falla cerrado** es un bucle:

```bash
pnpm install
foreach ($c in @('ci:lint','ci:typecheck','ci:unit','ci:build')) {
  pnpm run $c; if ($LASTEXITCODE -ne 0) { throw "FALLÓ: $c" }
}
```

Los scripts `ci:*` **no llevan límite de concurrencia**, y en esta máquina eso mata `tsc` y `vitest`
por memoria con un **exit 134** que parece un error de tipos y no lo es. Si pasa, repite con
`pnpm exec turbo run typecheck --concurrency=2` y `pnpm exec vitest run --project unit --maxWorkers=2`
— trampa 8.

Verificación de que todo sigue en pie **sin Docker, sin navegador y sin gastar** (~1 min):

```bash
foreach ($c in @(
  'ci:arch:depcruise', 'ci:plan:status',
  'ci:mode-separation', 'ci:e2e:dry-session', 'ci:e2e:course-creation', 'ci:adversarial:session',
  'ci:logic:golden', 'ci:logic:pbt', 'ci:logic:no-net',
  'ci:gateway:fail-closed', 'ci:gateway:contracts', 'ci:canary', 'ci:cost:ledger',
  'ci:coords:pbt', 'ci:annotations:staleness', 'ci:visual:no-verdict',
  'db:grants:check', 'ci:web:tokens', 'ci:content:mangos',
  'ci:supply:sbom', 'ci:supply:drift', 'ci:infra:hardening'
)) { pnpm run $c; if ($LASTEXITCODE -ne 0) { throw "FALLÓ: $c" } }

foreach ($s in @('verify-depcruise-catches', 'verify-test-typecheck-catches')) {
  node "scripts/arch/$s.mjs"; if ($LASTEXITCODE -ne 0) { throw "FALLÓ: $s" }
}
```

Lo que queda fuera de esa orden pide algo más, y por eso se corre aparte:

| Aparte | Porque necesita |
|---|---|
| `ci:db:negative` (alias `ci:db:testcontainers`) | Docker |
| `ci:infra:compose-up` · `ci:infra:otel` | Docker, y `dev:env` antes |
| `ci:a11y:baseline` · `ci:a11y:catches` | `ci:build` y el Chromium de Playwright |
| `ci:logic:mutation` | ~8–9 min, y la trampa 5 |
| `ci:e2e:live-session` · `demo:turno` · `bench:material` · `bench:exploratorio` | credencial de proveedor: **gastan dinero** |
| `ci:freeze:drift` | el paquete de contenido congelado (W5 aún sin firmar) |

**Cinco de esos checks no los corre nadie salvo tú**: `ci:web:tokens`, `ci:coords:pbt`,
`ci:annotations:staleness`, `ci:visual:no-verdict` y `ci:freeze:drift` **no están en el workflow**.
Existen, pasan, y ningún push los ejercita — así que se pudren en silencio si esta orden no los lleva.

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
| `pnpm run ci:e2e:course-creation` | El AC de F9: crear-materia → clase sobre una materia sin sistema formal, con el aislamiento comprobado **por consulta cruzada** y sus controles positivos (13) |
| `pnpm run ci:gateway:fail-closed` | Que la pasarela no envía parámetros no declarados por el binding ni acepta un binding sin snapshot ni huella |
| `pnpm run ci:gateway:contracts` | Contract tests por adaptador (P-II §8.4): la misma operación conserva sus invariantes aunque cambie el proveedor |
| `pnpm run ci:canary` | Canarios (P-II §11.3): registro, detección por superficie, bloqueo de corrida y encaje con el filtro de egreso |
| `pnpm run ci:cost:ledger` | Un cambio de tarifa crea manifiesto nuevo y el costo histórico **no** se reescribe (P-II §9.5) |
| `pnpm run ci:coords:pbt` / `ci:annotations:staleness` / `ci:visual:no-verdict` | `visual-interaction`: coordenadas por propiedad, caducidad de anotaciones y que ningún score visual emite veredicto (DEC-VISION-001) |
| `pnpm run ci:a11y:baseline` / `ci:a11y:catches` | Línea base WCAG sobre la Clase **en Chromium de verdad** (T-H8-10) / que cada instrumento detecta un defecto sembrado. jsdom aprobaría por vacío: dos criterios son geométricos |
| `pnpm run db:grants:check` | Que la migración de `GRANT` corresponde a la matriz vigente |
| `pnpm run ci:supply:sbom` / `:drift` | SBOM CycloneDX + digest de lockfile / drift y advisories (bloqueante) |
| `pnpm run ci:infra:hardening` | 159 propiedades sobre la config **resuelta** por Docker |
| `pnpm run bench:preparacion <runId> [cands]` | Qué falta para la corrida material de BENCH-01. No gasta nada; sale con 1 si aún no se puede correr (D-72) |
| `pnpm run bench:material <runId> <cands> <reps> <maxTokens> [timeoutMs]` | **La corrida material de BENCH-01. GASTA DINERO de verdad.** Mide los seis gates con `observeGates()` y **no corona**: el paquete sin congelar lo impide (D-74) |
| `pnpm run bench:exploratorio <runId> <maxTokens> [timeoutMs]` | Medición **declarada como exploratoria** sobre los mismos casos. **Gasta.** Es la vía de D-76: mide sin poder coronar |
| `pnpm run bench:puntuar <runId> <material\|exploratorio>` | Recomputa los seis gates desde una corrida ya guardada. **No vuelve a preguntar**, así que no gasta |
| `node scripts/model/refresh-sources.mjs <urls>` | Huellas reproducibles de las fuentes de un refresco documental. Descarga dos veces y falla si difieren (D-73) |
| `pnpm run demo` | Verificador + api + web en local, sin Docker ni base: el bucle W7 visible de punta a punta. **No escribe evidencia** — no hay dónde |
| `pnpm run demo:turno [KC] [pregunta]` | Un turno contra el proveedor real. **Gasta centavos**, y lo avisa antes. Control positivo de que un modelo de verdad responde en el formato que el validador de anclaje acepta |
| `pnpm run ci:e2e:live-session` | AC del gate H7: sesión completa sin rescate docente, perfil C. **Gasta**, y por eso no corre en cada push |
| `pnpm run ci:adversarial:session` | AC de `T-H7-03`: extracción/injection del alumno (P-II §14.4 de sesión) y la puerta de no revelación de P-I §9.6 |
| `pnpm run ci:infra:compose-up` | Arranque limpio del stack + verificador por spool + prueba de que `core` no sale a Internet |
| `pnpm run ci:infra:otel` | AC de `T-H3-05`: los spans llegan al colector, y la derivación del alumno no |
| `pnpm run dev:docker` | **Arranca Docker Desktop.** A mano no arranca: ver trampa 6. También `dev:docker:clean/stop` |
| `pnpm run dev:env` → `dev:up` → `dev:seed` | Levantar el entorno local (`infra/runbooks/local.md`); además `dev:down/status/logs/backup/restore` |
| `pnpm run logic:golden:generate` | Regenera el conjunto dorado; **el diff debe ser vacío** |
| `pnpm run content:mangos` / `ci:content:mangos` | Tabla de correspondencia mango → `fragmentId` (D-77) / comprueba que sigue correspondiendo al corpus |
| `pnpm run web:tokens` / `ci:web:tokens` | Deriva la hoja de tokens de `apps/web` desde el CSS vendorizado, **retirando el `@import` remoto de Google Fonts** (P-II §0.3: nada de red en tiempo de render) |
| `pnpm run ci:freeze:drift` | Que el paquete de contenido corresponde a su `freeze-manifest.json`. Falla cerrado con `FREEZE_DRIFT_BLOQUEADO` |
| `pnpm --filter @profesor-ia/web run dev` | `next dev`. El `build` **no** es `next build`: pasa por `scripts/web/build.mjs` |
| `pnpm run plan:status` / `ci:plan:status` | Coherencia de `PLAN_STATUS.md`: estados declarados, decisiones sin huecos ni duplicados, ninguna cita `D-N` colgada (D-81) |
| `pnpm run contracts:json-schema` | Emite los JSON Schema desde `packages/contracts` |

### Una sola prueba

```bash
pnpm exec vitest run --project unit packages/logic-core/test/rules.test.ts -t "∨E"
```

`vitest.config.ts` define dos proyectos: `unit` (`packages|tools|apps/*/test/**`) y `db`
(`infra/database/test/**`, con timeouts largos y `fileParallelism: false` porque el estado de la base
es compartido). Sin `--project`, corren ambos.

### Archivos generados: no los edites, regenéralos

Cuatro artefactos versionados los escribe un script, y cada uno tiene su guarda `--check`. Editarlos
a mano parece funcionar hasta que el check lo desmiente:

| Archivo | Fuente | Regenerar | Guarda |
|---|---|---|---|
| `infra/database/migrations/20260815120100_grants.sql` | `packages/security-policy/src/matrix.ts` | `db:grants` | `db:grants:check` |
| `apps/web/src/app/tokens.generated.css` | `packages/ui-tokens/vendor/styles.css` | `web:tokens` | `ci:web:tokens` |
| `analysis/reports/fragment-handles.json` | el corpus del submódulo | `content:mangos` | `ci:content:mangos` |
| el conjunto dorado (413 casos) | `scripts/logic/generate-golden.mjs` | `logic:golden:generate` | **el diff debe quedar vacío** |

**La matriz de permisos tiene un paso fácil de olvidar**: el generador lee el paquete **compilado**,
así que el flujo es editar `matrix.ts` → `pnpm run ci:build` → `pnpm run db:grants` →
`pnpm run ci:db:negative`. Sin el `ci:build` de en medio regeneras la matriz vieja.

`packages/ui-tokens/vendor/` tampoco se edita: está hasheado y su `PROVENANCE.md` lo prohíbe
expresamente. Lo que se toca es la derivación.

### Los diez jobs de CI, y qué comando es cada uno

`.github/workflows/ci.yml`. Cuando uno se pone rojo, esta tabla ahorra abrirlo:

| Job | Corre | Necesita el submódulo |
|---|---|---|
| `base` | `ci:lint` · `ci:typecheck` · `ci:unit` · `ci:build` · `ci:a11y:baseline` · `ci:a11y:catches` | sí |
| `h6` | `ci:mode-separation` · `ci:e2e:dry-session` · `ci:e2e:course-creation` | sí |
| `adversarial` | `ci:adversarial:session` | sí |
| `arch` | `ci:arch:depcruise` + sus dos controles positivos · `ci:plan:status` · `ci:gateway:fail-closed` · `ci:gateway:contracts` · `ci:canary` · `ci:cost:ledger` | **no** — por eso viven aquí |
| `logic` | `ci:logic:golden` · `:pbt` · `:no-net` · `ci:content:mangos` · conjunto dorado reproducible | sí |
| `mutation` | `ci:logic:mutation` (sólo en `main`) | sí |
| `supply` | `ci:supply:drift` · `ci:supply:sbom` | no |
| `infra-otel` | `ci:infra:otel` | no |
| `infra` | `ci:infra:hardening` · `ci:infra:compose-up` | sí |
| `db` | `db:grants:check` · `ci:db:negative` | no |

Los jobs marcados con submódulo dependen de `CONTENT_TOKEN` y hacen `checkout` recursivo: **si un
gitlink apunta a un commit que no se subió al remoto de contenido, fallan en `checkout` con
`upload-pack: not our ref`** y el mensaje no menciona el submódulo. Ver §6.

### El pipeline de contenido W0–W5

Trece entradas en `scripts/content/`, todas `node scripts/content/<x>.mjs` sin argumentos, y ninguna
en `package.json` — así que no aparecen en `pnpm run`. Son las que produjeron el banco vigente y el
orden en que corren importa:

```
w0-live-run → w0-apply-decision    │ F5/H4.5 — descubrimiento y decisión del CORPUS_APPROVER
w1-ingest-run                      │ snapshot autorizado, fragmentación; `solutions/` va a solutions-private (I-2/I-4)
w2-extract-run → kc-map-write      │ extracción curricular (Rol A) y mapa de KC
rolb-pedagogy-run                  │ Rol B: objetivos, pedagogía, plantillas de sesión
w2-experimental-sets-run           │ selección A/B/C
bench04-run → w3-generate-run      │ congela el orden de validez, y autoría automática sobre él
w4-preaudit-run → w4-audit-apply   │ muestra de auditoría previa y cómputo del gate
w4-second-auditor-packet           │ paquete para el segundo auditor independiente
```

**W5 no tiene script**: es clave Ed25519, auditoría aprobada y firma humana. `ci:freeze:drift`
comprueba después que el paquete no se movió.

## 3. Arquitectura

Monolito modular con procesos aislados. `pnpm workspaces` + Turborepo; 25 workspaces bajo `apps/*`
(6), `packages/*` (16) y `tools/*` (3). Las listas de `apps/` y `packages/` son **obligatorias**
(P-II §3.1): no se crean paquetes nuevos. Por eso el CLI vive en `tools/cli` (D-1) y el índice de
complejidad en `proof-search` en vez de en un paquete propio (D-10).

TypeScript 5.9.3 `strict` + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` +
`verbatimModuleSyntax`, ESM `NodeNext`, Node 24. Cada paquete compila con `tsc -p tsconfig.json` a
`dist/`; `turbo` encadena `build`/`typecheck` con `dependsOn: ["^build"]`. **`ci:typecheck` son dos
cosas**: `turbo run typecheck` más `tsc -p infra/database/tsconfig.test.json`, que es el único que
mira las pruebas de la base.

ESLint lleva tres reglas que no son de estilo: `consistent-type-imports` y `no-explicit-any` como
**error**, y `no-empty` con `allowEmptyCatch: false` — anotada en el config como I-1, porque ninguna
decisión verificable puede quedar silenciada por un `catch` vacío.

### Los invariantes son ejecutables, no prosa

`.dependency-cruiser.cjs` tiene 13 reglas `forbidden`, todas `severity: 'error'`; **cada una codifica
un invariante I-1…I-9 y su violación es una implementación inválida**, no un aviso de estilo:

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

Si añades un import y `ci:arch:depcruise` falla, el import está mal, no la regla. El fallo te da el
**nombre** de la regla, y los nombres son la vía rápida al invariante: `i1-session-engine-sin-sdk-de-proveedor`,
`i2-gateway-sin-soluciones`, `i3-verifier-sin-red`, `i4-autoria-sin-sondas`,
`verificacion-sin-canonicalizador-de-isomorfismo`, `visual-sin-veredicto-formal`,
`web-sin-claves-ni-gateway`, `web-sin-soluciones`, `sin-verificador-fuera-del-verificador`,
`verificacion-sin-telemetria-de-red`, `pasarela-sin-nucleo-logico`, `no-circular` y
`sin-dependencias-no-resueltas`. Esta última **no es un invariante**: salta cuando falta `dist/`, así
que depcruise exige `ci:build` antes (en CI lo hace el job `arch`; en local pasa desapercibido porque
quedan restos de corridas anteriores).

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
  `NO_IMPLEMENTADO` (exit 3), y lo que una fase todavía no implementa responde `NO_IMPLEMENTADO` en
  vez de fingir (D-11). En `web` eso ya **no** es todo salvo `/health`: Inicio, Mis materias,
  Detalle, Progreso y Clase existen desde `T-CC-05`, y `no-implementado.tsx` quedó como el destino
  de `[...ruta]` — lo no construido, no la regla general. Un worker que dijera «listo» sin pipeline
  sería éxito simulado.
- **Expectativas a priori.** El generador del conjunto dorado declara qué debe pasar **antes** de
  ejecutar. Nunca grabes la salida observada como «esperado»: eso convierte el conjunto dorado en un
  espejo del bug. Ya evitó dos casos mal especificados.
- **Controles positivos.** La suite negativa de privilegios incluye pruebas de que cada concesión de
  la matriz **sí** funciona; sin ellas, una base rota haría pasar todas las negativas por vacío.
- **Una justificación se intenta refutar antes de escribirla.** Vale para los mutantes
  «inalcanzables» y para cualquier «esto no puede pasar». La del oráculo semántico parecía sólida y
  era falsa.
- **Desviaciones documentadas.** Cualquier apartamiento del plan va a «Decisiones de ingeniería» de
  `PLAN_STATUS.md` con su causa (van D-1 a D-100). No tienen autoridad normativa. `ci:plan:status`
  comprueba que la numeración no tiene huecos ni duplicados y que ninguna cita `D-N` queda colgada
  (D-81), así que citar una decisión inexistente rompe el check.
- **Un commit, una tarea `T-*`**, título `T-Hx-nn: …`, y `PLAN_STATUS.md` actualizado en el mismo
  commit. **El `push` sí se agrupa** desde el 2026-08-29, por el presupuesto de Actions: ver §6.

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
7. **PowerShell 5.1 destroza la codificación al reescribir archivos.** `Get-Content -Raw` lee en
   ANSI, no en UTF-8, así que
   `(Get-Content x -Raw) -replace 'a','b' | Set-Content x -Encoding utf8` convierte `∧` en `âˆ§` y
   `ó` en `Ã³` **sin que nada falle**. Aquí muerde siempre: el cálculo, el lexicón de voz y la
   documentación están llenos de conectivos y tildes. Edita con las herramientas de edición, o con
   `python -c` usando `io.open(..., encoding='utf-8')` y `newline` de salto de línea Unix.
   Comprobación: `file archivo` debe decir `UTF-8 text`. **Si pasa durante una siembra de defecto,
   las pruebas fallan por el destrozo y no por el defecto** — y se concluye que el control detecta
   sin haber comprobado nada.
8. **Turbo y vitest agotan la memoria de esta máquina con la concurrencia por omisión.** Son 16 GB
   y con un navegador abierto quedan 2–3 libres; `turbo run typecheck` lanza diez `tsc` y varios
   mueren con **exit 134** y `FATAL ERROR: Zone Allocation failed - process out of memory`. **No es
   un error de tipos** por más que el job se vea rojo: un error de tipos dice `error TS…`. Usa
   `pnpm exec turbo run typecheck --concurrency=2` y
   `pnpm exec vitest run --project unit --maxWorkers=2`; con Docker Desktop levantado, 1. Los
   scripts `ci:*` no lo llevan puesto porque en CI hay memoria de sobra: es una limitación local.
9. **En PowerShell 5.1, `&&` no existe** — y es la única consola de esta máquina (`pwsh` 7 **no está
   instalado**). Choca de frente con la trampa 1: §2 manda usar PowerShell, y ahí cualquier orden
   encadenada con `&&` muere con «El token '&&' no es un separador de instrucciones válido en esta
   versión». Es **error de parseo**, así que no corre ni el primer comando — no es que falle a mitad.
   Dentro de `package.json` sí funciona (`ci:typecheck` encadena dos comandos y va bien): esos los
   ejecuta pnpm en su propio shell, no PowerShell. Usa el bucle `foreach` de §2, que además falla
   cerrado. **`;` a secas no vale**: sigue adelante tras un fallo, y una batería que continúa tras el
   primer rojo es degradación silenciosa con otro nombre.

## 6. Estado y lecciones operativas (2026-08-30)

**El estado tarea por tarea, con evidencia, está en `docs/plan/PLAN_STATUS.md`; por dónde seguir, en
`docs/plan/HANDOFF.md`, cabecera «EMPIEZA AQUÍ».** Este apartado se queda rancio entre sesiones y
esos dos no, así que aquí va sólo el resumen de una línea por fase y, después, lo que **no** está en
ellos.

| Fase | Dónde está | Qué falta, y de quién |
|---|---|---|
| F0/H0 · F1/H1 · F2/H2 | completas | — |
| F3/H3 | 5 de 5, criterio técnico cubierto | Infisical y firmas |
| F4/H4 | BENCH-01 corrió; ganador **provisional** `claude-sonnet-5` | **ningún candidato aprueba los seis gates: la puerta NO está cumplida** |
| F5/H4.5 | 8 de 8 | — |
| F6/H5 | 17 de 17; banco de **656 candidatos** sobre corpus real | humano: lectura por muestra, Parte A ciega, y **W5** |
| F7/H6 | 14 de 14, AC cubierto | acta |
| F8/H7 | 7 de 7, `ci:e2e:live-session` en verde | acta firmada |
| F9 | 5 de 5, AC cubierto | nada construible |
| F10/H8 | 11 de 14; **pizarrón y voz de salida montados** (D-98), a11y 9 de 11 (D-100) | calibración congelada, umbrales de BENCH-03, corrida humana — y las 4 capacidades de abajo |
| F11 | desbloqueada | `T-LSU-01/02/03`: sólo el propietario |
| F12–F16 | no empezadas | — |

Tres cosas de esa tabla no conviene perder, porque explican decisiones que en el código parecen
arbitrarias:

- **Lo que falla en BENCH-01 no es la seguridad, es la disciplina de formato.** Cero fugas y
  recuperación degradada limpia en los tres candidatos y en los 600 casos; el gate de anclas (≥95 %)
  da 84.2 % y 15.4 %. **El identificador de ~100 caracteres es defecto nuestro**, y de ahí sale D-77.
  El informe completo, con los dos diagnósticos separados, está en `docs/model/bench-01.md`.
- **OpenAI se midió y no puede coronar (D-76).** `gpt-5.6-luna` sacó 5 de 6 gates, el mejor de los
  tres, pero su identidad no está fijada y **tres puertas independientes** lo impiden. `T-H4-11` está
  bloqueada por eso, **no por credenciales**.
- **W5 es lo que `assertPackageMayCrownWinner()` espera.** Mientras no exista, coronar es imposible
  por construcción, no por olvido.

### Qué monta la vista de Clase, y qué sigue sin montar

**Un recuento de tareas no dice qué hay en pantalla.** Hasta el 2026-08-30, F10 figuraba como «11 de
14, no queda nada construible» mientras `visual-interaction` y `speech-gateway` no los importaba
**ningún** módulo bajo `apps/`: eran bibliotecas con pruebas y sin consumidor. El recuento contaba
política. Antes de dar por hecho que una capacidad existe, mira quién la importa.

Hoy la Clase monta **texto, editor Fitch, pizarrón y voz de salida** (D-98). La guarda sigue puesta:
`assertCapabilitiesImplemented()` en `apps/web/src/clase/view-model.ts` **lanza**
`CAPACIDAD_NO_IMPLEMENTADA` ante una capacidad encendida sin superficie, y ahora compara contra
`IMPLEMENTED_CAPABILITIES`. `F7_SUPPORTED_CAPABILITIES` se queda como registro de con qué cerró F7:
no se reescribe, o se pierde la progresión.

Las cuatro que siguen apagadas, **cada una por su motivo**, y el mensaje de error los nombra:

| Capacidad | Qué espera |
|---|---|
| `voiceInput` | decidir el canal de STT. El audio del alumno es dato del sujeto (UI-CORR-08) y el canal decide si sale de la máquina: **no es decisión de implementación** |
| `visualBoardInterpretation` · `uiAnnotations` | que **CAL-MULTIMODAL** se congele; `visionThresholds()` y `maxAnnotationAgeMs()` lanzan |
| `internalUiCapture` | elegir rasterizador (`T-H8-06` lo dejó «por verificar») |

**Y el orden importa**: `ci:a11y:baseline` no podía verificar el pizarrón mientras no hubiera
pizarrón, y ese silencio no era un verde. Al montarlo pasó de 4 criterios verificados a 9, y de paso
destapó un falso positivo suyo (D-100).

### La corrida de referencia, y qué cuentan los conteos

`33311824991` sobre `95d1f2b`, **los diez jobs en verde** (2026-08-30), y con ella la pasada de
promoción `HECHA` → `VERIFICADA`: 81 tareas verificadas, 12 fuera con motivo escrito (D-96).
**2223 pruebas unitarias en verde**, depcruise sobre 593 módulos, mutation testing sobre `logic-core`
en verde.

**Aviso sobre los conteos: son de `--project unit`.** Sumar `unit` y `db` bajo la misma etiqueta ya
produjo cifras incomparables en sesiones anteriores. La progresión medida es 1851 (26-08) → 2024
(29-08) → 2089 (voz) → 2160 (política de F9) → 2223 (superficie de F9 y su AC). Las **131 pruebas
contra PostgreSQL 17** no se corrieron en local el 2026-08-30 —Docker Desktop volvió a caer por la
trampa 6 incluso con `dev:docker`—; las corre CI en el job `db`.

### CI: la avería de diez sesiones, y sus dos causas

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

### Cómo se sube

**Remoto del monorepo:** <https://github.com/MEX-AmatsuMikaboshi/profe_ia.git> (`origin/main`). El
detalle está en `docs/plan/HANDOFF.md` §8.

**Un commit por tarea `T-*`**, con su id en el título y `PLAN_STATUS.md` actualizado en el mismo
commit. **El `push`, en cambio, se agrupa**: el presupuesto de Actions es de USD 5 con tope, y el
propietario pidió el 2026-08-29 dejar de subir una vez por tarea. Es desviación declarada de §8, no
olvido — y va en este orden: **primero el submódulo de contenido, después el monorepo**, o los jobs
con `checkout` recursivo fallan como falló la sesión 16.

Dos pushes seguidos **cancelan la corrida del primero** (`concurrency` por `github.ref`, con
`cancel-in-progress`), y una corrida cancelada no promueve nada a `VERIFICADA`. `ci:logic:mutation`
además sólo arranca en `main` o en un PR etiquetado `mutation`, así que en una rama sin esa etiqueta
no lo verás fallar.

**Nunca se versiona `.env`.** Antes de cada commit, `git status --short`: si aparece un `.env`, para.

`content/unidad-deduccion-natural/` es un repositorio independiente con historial propio, registrado
como gitlink; falta crear su remoto y formalizarlo con `git submodule add` (D-2).

### Las anclas se citan por mango corto (D-77, 2026-08-26)

`F-` más ocho dígitos hexadecimales derivados por SHA-256 del `fragmentId` canónico: **10 caracteres
contra 107.4**. El validador de anclaje acepta **los dos**, y la tabla se publica en
`analysis/reports/fragment-handles.json` (`content:mangos`, comprobada por `ci:content:mangos`). El id
canónico sigue siendo el de proveniencia; el mango es proyección de presentación. Esto **no** re-corre
BENCH-01: cambia el prompt, y §8.5 exige recongelar y re-evaluar.
