# PLAN_STATUS.md — fuente de verdad de avance

Convenciones: `Plan.md` §0.4 y §12.
Estados: `PENDIENTE → EN_CURSO → HECHA → VERIFICADA` (VERIFICADA = sus checks CI/gate en verde en `main`) o `BLOQUEADA(razón)` / `BLOCKED_BY_SPEC`.

> `HECHA` = implementado y verificado localmente. `VERIFICADA` exige el check en verde en `main`;
> desde el 15-08-2026 hay remoto y GitHub Actions ejecuta, así que la condición ya es alcanzable:
> una tarea pasa a `VERIFICADA` cuando sus checks se observan en verde en `main`, no antes.

## F0 — H0 · Repositorio, contratos y CI

| Tarea | Etiqueta | Estado | Evidencia | Fecha | Notas |
|---|---|---|---|---|---|
| T-H0-01 | REQUIRED | HECHA | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.nvmrc` | 2026-08-14 | 23 workspaces (§4.2). TS 5.9.3 `strict` + `exactOptionalPropertyTypes`; Node 24 pin. CLI en `tools/cli` (D-1). |
| T-H0-02 | REQUIRED | HECHA | `content/unidad-deduccion-natural/` | 2026-08-14 | Árbol §4.3 completo, `README` por carpeta, `freeze-manifest.json` placeholder. Repo git propio, enlazado como submódulo el 15-08-2026 (D-2 cerrada). |
| T-H0-03 | REQUIRED | HECHA | `packages/contracts/src/**`, `test/contracts.test.ts` (20 pruebas) | 2026-08-14 | **Reescrito contra el Maestro** el 14-08 tras recibir los documentos: ver «Correcciones por autoridad». 19 JSON Schema emitidos. |
| T-H0-04 | CRITICAL | HECHA | `.dependency-cruiser.cjs`, `scripts/arch/verify-depcruise-catches.mjs` | 2026-08-14 | 10 reglas `forbidden` (I-1…I-9) + verificación con violación sembrada. |
| T-H0-05 | REQUIRED | HECHA | `.github/workflows/ci.yml` | 2026-08-14 | Jobs `ci:lint`, `ci:typecheck`, `ci:unit`, `ci:arch:depcruise`, `ci:db:testcontainers`, `ci:build`, `ci:supply:*`. Primera ejecución en Actions el 15-08-2026; descubrió que el job `arch` corría `depcruise` sin build previo y no resolvía `@profesor-ia/*` (en local pasaba por tener `dist/` de corridas anteriores). Corregido con un paso de build. **Segunda ejecución (run 31875819628): `base` y `logic` en rojo**, y los dos hallazgos son consecuencia de haber cerrado D-2. (1) `secrets.GITHUB_TOKEN` solo alcanza a `profe_ia`, así que el clon del submódulo privado falla con `Repository not found` — que es lo que GitHub responde a un privado sin acceso, no a un repo inexistente. Se resuelve con un PAT fine-grained de solo lectura en el secreto `CONTENT_TOKEN`, que `checkout` aplica al repo principal **y** al submódulo (necesita `Contents: Read` en ambos); un paso previo falla con mensaje explícito si el secreto no está, en vez de dejar que `checkout` muera con un error críptico. (2) **El check «conjunto dorado reproducible» pasaba por vacío**: `git diff --exit-code -- content/…/golden-tests` se ejecutaba en el padre, cuyo índice desde D-2 solo guarda un gitlink, de modo que no veía ningún cambio de contenido y devolvía 0 siempre. Ahora corre dentro del submódulo con `add -A` + `diff --cached` (`git diff` a secas tampoco vería un caso **nuevo**). Comprobado con dos siembras —caso modificado y caso nuevo— antes de escribir la corrección: la forma vieja devolvía 0 en ambas, la nueva devuelve 1. **Tercera corrida (31883560988): fallo en 0 s sin ningún job.** El mensaje de la guarda contenía `CONTENT_TOKEN: sin él`, y un `: ` dentro de un escalar YAML plano se parsea como mapa anidado (`Nested mappings are not allowed in compact mappings`), lo que invalida el workflow **entero**: no es que fallara un job, es que no corrió ninguno. Corregido con escalar de bloque. Lección operativa: el workflow se valida con un parser YAML antes de subirlo; un `.yml` inválido no degrada un check, apaga todos. |
| T-H0-06 | REQUIRED | HECHA | `scripts/supply/*.mjs`, `supply/sbom.cdx.json`, `supply/lockfile.digest` | 2026-08-14 | SBOM CycloneDX 1.6 (185 componentes), digest de lockfile, política de licencias sin excepciones, drift y advisories en verde. |
| T-H0-07 | REQUIRED | HECHA | `tools/cli/src/**`, `test/cli.test.ts` | 2026-08-14 | Los 4 comandos fallan con `NO_IMPLEMENTADO` (exit 3); prueba que impide el éxito simulado. |
| T-H0-08 | REQUIRED | HECHA | `docs/plan/`, `docs/gates/`, `docs/blocked-by-spec.md`, `.github/pull_request_template.md` | 2026-08-14 | `blocked-by-spec.md` vacío conforme a §0.3. |
| T-H0-09 | REQUIRED | HECHA | `packages/ui-tokens/vendor/`, `test/vendor.test.ts` | 2026-08-14 | Vendorizado sin editar + `PROVENANCE.md` con hashes. **Discrepancia registrada**: el ZIP entregado no coincide con el hash de §0.1, pero el HTML normativo interno sí coincide byte a byte. |

**Gate H0:** `docs/gates/H0.md` — abierto (falta ejecución en `main`).

## F1 — H1 · Base de datos, roles y autenticación mínima

| Tarea | Etiqueta | Estado | Evidencia | Fecha | Notas |
|---|---|---|---|---|---|
| T-H1-01 | CRITICAL | HECHA | `infra/database/migrations/20260814100000_schemas.sql`, `…100200_tables.sql` | 2026-08-14 | 7 esquemas exactos + 33 tablas iniciales. `PUBLIC` revocado en esquemas y base. |
| T-H1-02 | CRITICAL | HECHA | `packages/security-policy/src/matrix.ts`, `…100100_roles.sql`, `…100400_grants.sql` (generado) | 2026-08-14 | Matriz como dato → migración generada (`db:grants`), con `--check` de drift en CI. Rol de migraciones renombrado por D-6. |
| T-H1-03 | CRITICAL | HECHA | `…100300_evidence_append_only.sql` | 2026-08-14 | Triggers que niegan `UPDATE`/`DELETE`/`TRUNCATE` (incluso al propietario) + secuencia monótona y cadena `previous_hash` verificada en la base. |
| T-H1-04 | CRITICAL | HECHA | `infra/database/test/negative.test.ts` — **103 pruebas verdes** contra PostgreSQL 17.11 real | 2026-08-14 | Incluye controles positivos: sin ellos la suite negativa pasaría por vacío. |
| T-H1-05 | REQUIRED | HECHA | `apps/api/src/auth.ts`, `test/auth.test.ts` (13 pruebas), `…120000_auth.sql`, matriz ampliada | 2026-08-15 | Better Auth 1.6.29 autoalojado. Seis tablas **dentro de `identity`** con prefijo `auth_` (D-14): no se crea un octavo esquema y no se pisa `identity.account`, que es la cuenta seudónima. `auth_user.id` **es** el `account_id`; la identidad real sigue en `identity_link`, que `svc_api` no puede leer. Passkey/WebAuthn + contraseña de ≥12 con correo verificado; el correo valida y recupera pero **no autentica solo**: no hay enlace mágico ni código por correo, y hay prueba de que no los hay. TOTP exigido por todo rol distinto de `alumno`, derivado del catálogo para que un rol nuevo entre exigiéndolo. Cookies `httpOnly`+`secure`+`sameSite`, sesión de 8 h con renovación. `svc_api` administra credenciales pero **no borra cuentas**: la supresión es de `svc_background` (P-I §14.5). Suite negativa 103 → **127 pruebas** contra PostgreSQL real. **No probado aquí**: la ceremonia WebAuthn completa y el montaje HTTP, que son de F7. |
| T-H1-06 | REQUIRED | HECHA | `…100500_rls.sql` | 2026-08-14 | RLS + `FORCE ROW LEVEL SECURITY` como segunda capa; `measurement`/`private_solutions` no dependen de RLS. |

**Gate H1:** `docs/gates/H1.md` — abierto. Las 6 tareas están HECHAS; falta la ejecución en `main` y las firmas.

## F2 — H2 · Verificador (16 de 16 tareas; camino crítico)

| Tarea | Etiqueta | Estado | Evidencia | Fecha | Notas |
|---|---|---|---|---|---|
| T-H2-01 | CRITICAL | HECHA | `content/…/kc/authorized-calculus-v1.yaml`, `packages/logic-core/calculus/`, `src/calculus.ts`, `test/calculus.test.ts` (11 pruebas) | 2026-08-14 | Transcripción literal de P-II §4.1.1, hasheada (`904d3b44…`). Prueba de que ambas copias son idénticas y que el hash no derivó. |
| T-H2-03 | CRITICAL | HECHA | `packages/logic-core/src/calculus.ts` | 2026-08-14 | Tablas de alias de conectivos y reglas; prueba de que ningún alias es `rule_id` y de que los alias rechazados no entran. |
| T-H2-05 | CRITICAL | HECHA | idem | 2026-08-14 | 13 primitivas + `DNE`, whitelist cerrada; `PR`/`AS` excluidas como reglas. |
| T-H2-02 | CRITICAL | HECHA | `src/tokenizer.ts`, `src/parser.ts`, `src/ast.ts`, `test/parser.test.ts` (32 pruebas) | 2026-08-14 | Normalización conservadora; sin precedencia; `(A∧B)∧C ≠ A∧(B∧C)`; prohibidas conmutativa/asociativa/DNE automática/NNF/CNF/DNF. |
| T-H2-04 | CRITICAL | HECHA | `src/fitch.ts`, `src/verify.ts` | 2026-08-14 | Alcance, citas, descarga, subpruebas hermanas, subpruebas de una línea y descarga vacua. |
| T-H2-06 | CRITICAL | HECHA | `src/errors.ts`, `src/verify.ts`, `test/verify.test.ts` (34 pruebas) | 2026-08-14 | Los 18 códigos `E-*` con `firstInvalidStep`, regla mal aplicada, referencias y traza. |
| T-H2-07 | CRITICAL | HECHA | `src/semantics.ts` | 2026-08-14 | Tabla de verdad bivalente con `v(⊥)=F`; asimetría literal; `not-applicable` solo con razón. Cota tabla↔SAT abierta como `[CALIBRATION CALC-05]`. |
| T-H2-10 | CRITICAL | HECHA | `content/…/golden-tests/` — **413 casos**; `test/golden.test.ts` | 2026-08-14 | Pisos cubiertos: 120/120/63/50/60 frente a 100/100/50/50/50. Expectativas declaradas a priori, no grabadas de la salida. |
| T-H2-11 | CRITICAL | HECHA | `test/pbt.test.ts` (10 propiedades, fast-check) | 2026-08-14 | `parse(print(ast))`, renombrado biyectivo, línea cerrada nunca citable, construida⇒aceptada, aceptada⇒semánticamente válida, determinismo, `firstInvalidStep`. Semillas y `numRuns` registrados por propiedad. |
| T-H2-13 | REQUIRED | HECHA | `src/calculus.ts` (`LEXICON_ES`) | 2026-08-14 | Lexicón español separado de los ids formales. |
| T-H2-15 | REQUIRED | HECHA | `test/isolation.test.ts` (11 pruebas) | 2026-08-14 | Sin red, sin `process.env`, sin reloj ni azar; función pura que no muta su entrada. |
| T-H2-05 | CRITICAL | HECHA | `src/rules.ts`, `test/rules.test.ts` (60 pruebas) | 2026-08-14 | Cada regla con sus orientaciones alternativas y cada motivo de rechazo. |
| T-H2-12 | CRITICAL | HECHA | `stryker.conf.json`, `docs/quality/mutation-baseline.md`, 47 pruebas nuevas | 2026-08-15 | 62.79 → 78.22 → 81.99 → 87.56 → 88.67 → **90.31 %**, y **cero mutantes sin cobertura** (eran 177). `ast.ts` y `errors.ts` al 100 %. Los 112 vivos son prosa de mensajes o equivalentes por contrato —la lista de códigos `E-*` es cerrada, así que dos ramas que rechazan con el mismo código son indistinguibles— y están clasificados uno por uno. Dos correcciones de método: el reporte imprime el reemplazo, no el nodo mutado, y leerlo mal produce conclusiones falsas en ambas direcciones; y la rama del oráculo semántico, que iba a justificarse como inalcanzable, **sí es alcanzable** cuando un paso correcto cita una línea ya rechazada. Ahora tiene prueba. Código muerto eliminado en vez de justificado: `mainOperator`. |
| T-H2-08 | CRITICAL | HECHA | `packages/proof-search/`, `test/search.test.ts` (24 pruebas) | 2026-08-14 | Cuatro funciones separadas (P-I §7.4): prefiltro semántico → buscador → **re-verificación obligatoria por logic-core** → sin decisor terminante. Corte primario en unidades de trabajo deterministas; el timeout de pared solo protege el proceso y se registra aparte. `no_proof_exists_in_calculus` **no existe** en la implementación (CALC-03). `exhaustive_k` solo certifica `minimalCostVerified` tras cubrir todos los costes menores; si no halla, solo afirma `no_proof_with_cost_at_most_k`. Un certificado rechazado por el verificador lanza `CertificateRejectedError` (incidente nivel 3), no se disfraza de «no encontré». **Corrección del 15-08 (tercera sesión), encontrada por `T-H5-05`:** `linearize()` emitía todas las premisas y, cuando la meta ya estaba entre ellas **sin ser la última**, no añadía línea, así que la derivación terminaba en otra fórmula. `verify` devolvía `goalReached: false` **sin ningún código de error** y la re-verificación obligatoria escalaba a incidente de nivel 3 una meta que solo era trivial (`A, ¬A ⊢ A`). Se reitera la conclusión en el ámbito principal, que es la misma convención Fitch que el código ya aplicaba dentro de una subprueba. Con prueba de regresión sobre tres formas del caso. El `TrivialGoal` del contrato (P-II §4.4) estaba declarado y sin usar: el hueco no se veía porque todos los casos previos tenían la meta como **única** premisa. |
| T-H2-09 | CRITICAL | HECHA | `packages/isomorphism-canonicalizer/`, `test/canonicalize.test.ts` (16 pruebas) | 2026-08-14 | Firma estructural sobre el grafo de dependencias: invariante al renombrado de átomos, al orden de citas y al reordenamiento de pasos independientes; duplicado trivial como caso más estricto. Los nombres canónicos son átomos válidos del lenguaje, así que la forma canónica se puede volver a parsear. `ci:arch:depcruise` confirma que la ruta de verificación no lo importa (54 módulos, violación sembrada detectada). `[CALIBRATION CAL-07]` precisión/recall sigue abierto para H5/H10. |
| T-H2-14 | REQUIRED | HECHA | `packages/proof-search/src/complexity.ts`, `test/complexity.test.ts` (17 pruebas) | 2026-08-15 | Las medidas literales de P-I §7.6, separadas en dos grupos: `structural` (solo depende del enunciado y de la solución) y `searchRelative` (depende del presupuesto). Esa separación es lo que impide leer «nodos explorados» como total de caminos: dos presupuestos distintos con la misma solución dan `structural` idéntico y `searchRelative` distinto, y hay prueba de ello. Mide **solo soluciones re-verificadas**: un certificado que `logic-core` rechaza lanza `UnverifiedSolutionError`. El escalar no existe todavía — `complexityIndex()` y `assertComparable()` fallan cerrado con `CAL-09` (se congela en H5, `T-H5-10`) en vez de agregar con pesos inventados. Distancia estructural: D-10. |
| T-H2-16 | BENCHMARK BENCH-04 | HECHA | `packages/proof-search/src/bench.ts`, `test/bench.test.ts` (13 pruebas) | 2026-08-15 | Arnés L0 con muestra fija de 7 casos y dos órdenes equivalentes (`prefiltro→búsqueda` de referencia y `búsqueda→prefiltro`), habilitados por el parámetro aditivo `semanticOracle` de `search()` (el orden por omisión no cambia). Mide «desempeño **y seguridad**» (anexo E.2): cinco códigos de hallazgo —certificado no re-verificado, certificado rechazado, desacuerdo con la referencia, minimalidad fuera de `exhaustive_k` y corte de pared usado como afirmación lógica— y **cualquier hallazgo vuelve el informe no comparable**. Cada código tiene su variante sembrada en pruebas, incluida la trampa de P-I §7.4 (tomar la validez semántica por prueba de derivabilidad). El informe no tiene campo «ganador»: `freezeWinningOrder()` falla cerrado hasta F6 (`T-H5-05`). Sin reloj inyectado el informe es determinista. |

## F3 — H3 · Entorno local reproducible

| Tarea | Etiqueta | Estado | Evidencia | Fecha | Notas |
|---|---|---|---|---|---|
| T-H3-01 | REQUIRED | VERIFICADA | `infra/compose/docker-compose.yml`, `Dockerfile`, `apps/*/src/main.ts`; `web` sirve la app de Next desde el compose (D-38); **10 servicios `healthy`** verificados con `ci:infra:compose-up` | 2026-08-15 | Los ocho servicios del plan más `redis` y `otel-collector` (D-13). Imagen única parametrizada por `APP`. Cada app recibe un entrypoint mínimo de salud y logs estructurados (D-11), sin adelantar lógica de fases posteriores. Tres fallos reales encontrados al levantarlo, no al leerlo: `postgres` y `redis` no arrancaban porque sus entrypoints hacen `chown`/`setpriv` como root y `cap_drop: ALL` se lo impide —se resolvió arrancándolos ya como su propio usuario, sin devolver capabilities—, y a Infisical le faltaba su base, que ahora crea el init de PostgreSQL. **Corregido el 2026-08-18:** el entrypoint de `web` había quedado apuntando a un `dist/main.js` que `T-H6-13` dejó de producir, y `ci:infra:compose-up` estaba en rojo sin que nadie lo viera (D-38). **Verde en `main`**: corrida `32208124104` sobre `e6f8fc1`, job `ci:infra:hardening · ci:infra:compose-up`, los 10 servicios en `healthy`. |
| T-H3-02 | REQUIRED | HECHA | `scripts/dev/compose.mjs`, `scripts/dev/generate-env.mjs`, `scripts/db/apply-migrations.mjs` | 2026-08-15 | `dev:env`/`dev:up`/`dev:seed`/`dev:backup`/`dev:restore` (+ `down`, `status`, `logs`). `dev:seed` ejecutado contra el entorno real: **6 migraciones aplicadas y 7 roles acreditados**. Corre **dentro** de la red interna: la base nunca se publica al host. `dev:env` no sobreescribe un `.env` existente. |
| T-H3-03 | REQUIRED | HECHA | `docs/env/windows.md` | 2026-08-15 | Windows 11 Pro 10.0.26200, Docker 29.7.2 motor Linux, WSL2, Node 24.16.0, PostgreSQL 17.11. Con tiempos base medidos y las cinco trampas del entorno, incluida la nueva: el Bash de Git rompe `$APPDATA` y pnpm no resuelve. |
| T-H3-04 | CRITICAL | VERIFICADA | `scripts/infra/check-compose-hardening.mjs` — **159 comprobaciones en verde** | 2026-08-15 | Lee la configuración **resuelta** por Docker, no el YAML. Socket de Docker sin montar en ningún servicio, `no-new-privileges`, `cap_drop ALL`, raíz de solo lectura, sin root, seccomp activo, puertos solo en `127.0.0.1`. Y las tres fronteras: `verifier` con `network_mode: none` (I-3), `solutions-private` solo en autoría (I-2), sondas solo en medición (I-4). Cuatro imposibilidades técnicas registradas y **impresas en cada corrida**. **En CI y verde en `main`** desde el 2026-08-18: corrida `32208124104` sobre `e6f8fc1`. |
| T-H3-05 | REQUIRED | VERIFICADA | `tools/observability/`, `scripts/infra/otel-check.mjs`, `infra/compose/otel-collector.yaml`, job `ci:infra:otel` | 2026-08-18 | **Se ve un span llegar al colector.** `ci:infra:otel`: los tres spans del canal de veredicto con sus atributos y su jerarquía, la línea del verificador por `filelog` correlacionada por nombre de archivo del spool, métricas del proceso, y que la derivación del alumno no aparece en la salida. Con canario sembrado para que ese control no pase por vacío y dos fugas sembradas que prueban que el check falla cuando debe. OTel subido a 2.x (D-28: hay parche, se actualiza); D-36 y D-37 registrados. **Verde en `main` y observado job por job**: corrida `32205040014` sobre `0fb0e54`, **los ocho jobs en verde** (incluido `ci:logic:mutation`, que sólo corre en `main`); `ci:infra:otel` con sus 22 comprobaciones, cero fallos y traza `1c919163baf0d9947d3d71b626bd99c2`. |

**Gate H3:** `docs/gates/H3.md` — abierto, pero **con el criterio técnico cubierto**. Los tres checks de infraestructura están en `ci.yml` y **verdes en `main`**: corrida `32208124104` sobre `e6f8fc1`, nueve jobs. Falta sólo lo que no se escribe con código: la inicialización de Infisical (acción del propietario) y las firmas.

## F4 — H4 · Pasarela de modelo y benchmark (9 de 12 tareas; 3 bloqueadas por acción del propietario)

| Tarea | Etiqueta | Estado | Evidencia | Fecha | Notas |
|---|---|---|---|---|---|
| T-H4-01 | CRITICAL | HECHA | `packages/model-gateway/src/{operations,credentials,adapter,gateway,errors}.ts`, `src/adapters/{anthropic,openai}.ts`, `test/gateway.test.ts` (17 pruebas) | 2026-08-15 | **Adaptadores propios, sin SDK de proveedor**, conforme a la decisión CONGELADA del Maestro («Adaptadores propios TypeScript + Zod; perfiles `SESION` y `AUTORIA` con credenciales separadas»). Cada adaptador construye su propia petición HTTP y **no comparten forma** —`x-api-key` frente a `Authorization: Bearer`, `system` frente a `instructions`—, que es la razón de que sean dos módulos y no un constructor parametrizado (P-II §8.1: no hay plantilla universal de petición). Hay prueba de que difieren. **Ningún nombre de modelo ni parámetro de muestreo está escrito en el código**: el id sale del binding y los parámetros los autoriza T-H4-02; hay prueba de que el cuerpo saliente no lleva `temperature`/`top_p`/`top_k`/`reasoning`/`max_tokens`. Elegir un modelo aquí anticiparía un ganador que solo BENCH-01/02 puede decidir. Las once operaciones se **derivan** del contrato en vez de transcribirse, para que no puedan divergir. Separación de credenciales estructural: una pasarela sirve a **un** perfil, resuelve su credencial una sola vez y **no guarda el resolver**, así que no tiene camino hacia la del otro perfil —hay prueba de que la de `SESION` solo pide `SESION`, de que un perfil sin credencial falla en vez de heredar la ajena, y de que el secreto no aparece en `toString`, en `JSON.stringify` ni en el mensaje de error—. El transporte se inyecta: las pruebas no tocan la red. La respuesta se devuelve **cruda**, sin interpretar: clasificarla es T-H4-03, y hacerlo a medias aquí dejaría pasar salida sin validación local (P-II §8.4). Reparto operación↔perfil: **D-15**. |
| T-H4-02 | CRITICAL | HECHA | `packages/model-gateway/src/capabilities.ts`, `gateway.ts`, `test/gateway.test.ts` (25 pruebas), `ci:gateway:fail-closed` en el job `arch` | 2026-08-15 | La pasarela envía **solo** parámetros declarados compatibles por el binding. La comprobación es **estructural, no una convención**: `AuthorizedParameters` es un tipo de marca que solo `authorizeParameters()` puede producir, así que un adaptador no puede recibir parámetros sin contrastar aunque el llamante se equivoque. **Desconocido y rechazado son errores distintos** (`UnsupportedParameterError` / `RejectedParameterError`) y hay prueba de que no se colapsan: que un proveedor no documente un parámetro y que lo documente como incompatible son dos hechos distintos, y el refresco documental de T-H4-09 necesita verlos separados. **Sin snapshot fechado el binding exige huella de comportamiento** sobre el set canario congelado, porque un alias puede cambiar de modelo sin aviso; sin una ni otra, `UnpinnedBindingError` y el binding **no llega a registrarse** —fallar al arrancar es preferible a descubrirlo en la primera llamada facturable—. Un parámetro declarado a la vez soportado y rechazado es `ContradictoryCapabilitiesError`, no una precedencia a resolver: elegir rama decidiría por cuenta propia si ese parámetro sale hacia el proveedor. Los campos que fija el binding se escriben **después** de los parámetros en el cuerpo, con prueba de que un parámetro declarado no puede suplantar el `modelId` y romper la identidad del binding. Un parámetro no declarado falla **sin tocar el transporte**, con prueba. El script `ci:gateway:fail-closed` corre en el job `arch`, que no necesita el submódulo de contenido. |
| T-H4-03 | CRITICAL | HECHA | `packages/model-gateway/src/output.ts`, `adapters/*.parseResponse`, `test/output.test.ts` (20 pruebas), `ci:gateway:contracts` | 2026-08-15 | **No existe camino que devuelva salida cruda del proveedor**: se retiró `send()` y su lugar lo ocupa `execute()`, que traduce con el adaptador y valida localmente. P-II §8.4 dice que la salida estructurada del proveedor no es evidencia suficiente de validez, así que un `send()` sin validar era justo el agujero que esa norma cierra. Los datos solo son alcanzables tras estrechar por `classification === 'valid'`: es el tipo el que lo impide, no una convención. **El orden de comprobación es el requisito**: truncamiento, rechazo y error de proveedor se deciden **antes** de mirar el esquema, porque una respuesta truncada casi siempre falla también el esquema y reportarla como `schema_violation` escondería la causa real. Hay prueba con `{"ok":tr`, que es a la vez truncado e inválido, de que se clasifica `truncated` y no `schema_violation`. El valor bruto se conserva en las cinco clasificaciones, con prueba. Canonicalización de enums determinista que **conserva el bruto** y **no normaliza mayúsculas salvo autorización explícita** —normalizar por omisión aceptaría valores que el contrato no admite—; un valor fuera del enum devuelve `null` en vez de elegir el más parecido. **Un contrato desconocido lanza `UnknownProviderContractError` en vez de clasificarse**: la lista de `ModelOutputClassification` es cerrada y meter ahí lo desconocido lo haría indistinguible de una causa real; un motivo de parada nuevo del proveedor es un hallazgo que hay que ver. Los adaptadores **solo traducen**: dicen qué pasó según el proveedor y nunca deciden validez. Contract tests equivalentes (`ci:gateway:contracts`): tres casos —salida, truncamiento, rechazo— entran en la forma propia de cada proveedor y salen con el mismo resultado normalizado, más una prueba de que las dos formas de entrada **son distintas**, sin la cual la equivalencia sería trivial. |
| T-H4-04 | CRITICAL | HECHA | `packages/model-gateway/src/session-context.ts`, `test/session-context.test.ts` (12 pruebas) | 2026-08-15 | Los ocho campos de P-II §8.3 y **nada más**: la whitelist es la estructura, no una comprobación posterior — se copian exactamente los campos autorizados, así que no hay un «resto» que pudiera colarse. Hay prueba de que un campo extra inyectado (un correo) no aparece en el payload serializado. **No consulta soluciones porque no puede**: el módulo no recibe ninguna fuente de datos, todo entra por parámetro, y que `model-gateway` no alcance `solutions-private` lo impone la regla depcruise de I-2 y no un prompt (P-I §9.3: «mediante procesos, credenciales y permisos, no solo mediante prompts»). **El contexto no tiene campo para identificadores**, que es la forma estructural de cumplir «sin identificadores personales innecesarios»; hay prueba de que ninguna clave del contexto es un id. `estado mínimo` lo nombra P-II §8.3 sin definirlo, así que en vez de fijar un esquema por cuenta propia se copia solo lo que declare `minimalStateKeys` —una whitelist dentro de la whitelist— y una clave no declarada es `UndeclaredStateKeyError`, **no un campo que se ignora**: ignorarlo escondería que alguien intentó meter algo en el contexto. Filtro de egreso completo de P-I §9.4: pertenencia del fragmento al bloque, nivel de ayuda permitido (con prueba del límite exacto, que no se pasa de la raya) y detección de canarios **sobre el payload ya serializado**, que es lo único que de verdad saldría hacia el proveedor. Un hit aborta; el incidente y el bloqueo de corrida son `T-H4-05`. El detector es un parámetro opcional para que la ruta ya tenga su punto de enganche: su ausencia **no afirma que no haya canarios**, solo que aún no se comprueban. |
| T-H4-05 | CRITICAL | HECHA | `packages/security-policy/src/canary.ts`, `test/canary.test.ts` (15 pruebas), integración en `model-gateway/test/session-context.test.ts`, `ci:canary` | 2026-08-15 | Las tres clases de activo y las cinco superficies de detección son las **literales** del §11.3, con prueba. Cada canario registra los seis metadatos que la norma exige. Un hit hace **las cuatro cosas**, no la que resulte cómoda: aborta, nombra el incidente **nivel 3** con la categoría `ruta_efectiva_no_autorizada_a_soluciones_sondas_secretos` —que se eligió porque nombra literalmente las tres clases de activo con canario, en vez de inventar un mapeo por clase—, bloquea la corrida y deja el hit observado para la investigación. **El `incident_code` no se inventa**: P-I §13 lo congela por corrida en el `run-manifest`, así que el registro devuelve los hits y quien llama construye el incidente con el código congelado de su corrida. **El bloqueo no se puede quitar**: no hay `unblock` ni `reset` en la superficie pública, con prueba, porque un bloqueo que se pudiera quitar programáticamente sería decorativo. **La cadena canario nunca viaja en un mensaje de error ni en un log** —imprimirla la filtraría por el mismo canal que vigila—, y el detector del filtro de egreso devuelve `canary_id`, no cadenas; hay prueba de ambas cosas. Un canario sin superficies declaradas no se registra: daría cobertura aparente. **Cantidad, patrón y rotación son calibrables** (§11.3), así que `CanaryRegistry.plan()` falla cerrado igual que `complexityIndex()`: devolver un número daría por cubierta una política que nadie ha fijado, y entonces un cero en el gate significaría solo que los canarios estaban mal puestos. El gate sigue siendo **cero hits protegidos observados**, y `observedHits()` es lo que lo mide. La integración se prueba con el registro **real** enchufado al filtro de egreso de `T-H4-04`, no con un doble: sin eso, las dos mitades podrían no encajar. |
| T-H4-06 | REQUIRED | HECHA | `packages/model-gateway/src/cost.ts`, `test/cost.test.ts` (13 pruebas), `ci:cost:ledger` | 2026-08-15 | «El costo no se reconstruye a partir de precios actuales ni de estimaciones globales» (§9.5), y de ahí las dos reglas duras. **Un cambio de tarifa crea un `pricing_manifest_id` nuevo y nunca reescribe**: registrar contenido distinto bajo un id ya usado es `ManifestRewriteError`, mientras que registrar el mismo contenido es idempotente; hay prueba de que tras una subida de tarifa el costo del evento viejo **no cambia** y sigue citando su manifiesto original. **Una tarifa que falta no vale cero**: facturar una unidad sin entrada declarada lanza en vez de sumar 0, porque un cero fabricado haría parecer el gasto menor del real justo donde mira el gate de presupuesto de `T-H4-07`. **No se cobra con una tarifa que aún no regía** —sería reconstruir el costo con precios actuales, lo primero que §9.5 prohíbe— y un evento con manifiesto desconocido no entra. El cálculo recorre las unidades en el orden fijo del contrato y no en el del manifiesto, con prueba de que dos manifiestos equivalentes dan el mismo número. **No redondea**: ninguna autoridad fija una política de redondeo y aplicar una por cuenta propia cambiaría cifras que después alimentan un gate. **No convierte entre monedas**: mezclar monedas para un mismo modelo es `CurrencyMismatchError` y la agregación es por moneda, porque una tasa de cambio inventada produciría un total que parece comparable y no lo es. El ledger es **append-only** como el esquema `evidence` (I-6): no expone `update`/`delete`/`clear`, con prueba, y la copia que devuelve `events()` está congelada. Los reintentos y fallos **cuentan como costo real de autonomía**, con prueba de que sus tokens se facturan. |
| T-H4-07 | REQUIRED | HECHA | `packages/model-gateway/src/budget.ts`, `test/budget.test.ts` (12 pruebas), `ci:cost:ledger` | 2026-08-15 | Agregados **desde el cost-ledger**, no de una cuenta paralela. Las dos cifras del Maestro son literales y están fijas: objetivo ordinario 500 y umbral duro 700. **El gate nunca degrada integridad, y por eso bloquear lanza**: no hay `force`, `override`, `bypass`, `continueAnyway` ni `allowDegraded` en la superficie pública —hay prueba de las cinco— porque un «continuar igualmente» convertiría el bloqueo en una sugerencia y una caída automática a resultados fingidos sería éxito simulado. Lo único que levanta el bloqueo es la revisión explícita del propietario, que además registra **qué acumulado se revisó** y no solo que alguien revisó. **No suma ni convierte otras monedas**: hay prueba de que 5 000 USD en el ledger no mueven el acumulado en MXN, porque una tasa de cambio inventada bloquearía o desbloquearía gasto real con una cifra fabricada. Umbral de alerta obligatorio y lectura estricta de «superar»: **D-16**, que además deja visible el hueco de rearme tras la revisión en vez de inventar la política. |
| T-H4-08 | REQUIRED | HECHA | `packages/contracts/src/model-binding.ts` (corregido), `packages/model-gateway/src/modality.ts`, `test/modality.test.ts` (13 pruebas) | 2026-08-15 | Primero hubo que **corregir el contrato**: §8.4 dice que batch y caching *son* capacidades de `ModelCapabilities` y faltaban las dos (ver «Correcciones por autoridad, 15-08»). **La clasificación de datos tiene solo dos clases** porque §8.4 traza una sola distinción —«el tráfico de sesión con datos del participante»— y ninguna autoridad enumera más: una taxonomía inventada daría permisos con granularidad que nadie ha autorizado. **Lo desconocido no es permiso**, que es la regla que gobierna toda la matriz: elegibilidad contractual `unknown` o `available_not_enabled` no habilita tráfico de participante, y un binding **sin retención declarada** tampoco —«no consta» y «consta que se puede» no son lo mismo—, las tres con prueba. `zeroDataRetention` cuenta como retención 0. La retención máxima admisible **entra por parámetro** (`maxRetentionDaysAtFreeze`) en vez de estar escrita aquí, porque el freeze aún no está congelado y fijar un número decidiría por cuenta propia qué retención es aceptable. Sin datos de participante basta con que la modalidad esté declarada, con prueba de que ahí sí pasa un binding con elegibilidad `unknown` y retención de 365 días: la regla protege el tráfico **de participante**, no todo el tráfico. Telemetría al cost-ledger con hits/misses/tokens cacheados y **TTL solo cuando se conoce**: hay prueba de que sin TTL el campo no aparece, porque un cero afirmaría que no hay caché. |
| T-H4-09 | REQUIRED | VERIFICADA (mecanismo; CI `32103802556`; la corrida del refresco va pegada a `T-H4-10`) | `packages/model-gateway/src/documentary-refresh.ts`, `credentials.ts` (+`envCredentialResolver`), `capabilities.ts` (+`assertPinnedIdentity`), `test/documentary-refresh.test.ts` (24 pruebas), `infra/compose/.env.example`, `docs/model/documentary-refresh.md` | 2026-08-18 | El módulo **no consulta a ningún proveedor, no descarga documentación y no rellena un dato que nadie leyó**: registrar es una cosa y averiguar es otra, y un módulo que «consultara» la documentación estaría produciendo la evidencia que dice verificar. Exige la forma de la evidencia y **rechaza** la que no autoriza un benchmark. **Tres decisiones lo gobiernan.** (1) «Cuando se conozcan» de §8.1 cubre lo que el proveedor no publica, **no** cubre no haber mirado: `DocumentaryFact` tiene tres estados y una corrida material bloquea si algún campo queda en `no_consultado`, porque colapsar los dos casos de «no se sabe» dejaría pasar un refresco a medias como completo. (2) «Inmediatamente antes» **no es un número**: cablear «24 horas» convertiría una decisión de protocolo en una constante que nadie firmó, así que la ventana entra como dato con `parameterId`, `provenance` y `purpose` —material exige material, como el criterio de fundamentos de T-H6-12— y la autorización **devuelve la antigüedad observada por candidato** para que el auditor vea el número y no un «ok»; al caducar, el mensaje dice refrescar otra vez y no ampliar la ventana. (3) La **evidencia no es la declaración**: `CandidateDataPolicy` (prosa, con fuente) y `ModelCapabilities.dataPolicy` (numérico, del binding) se parecen y no son lo mismo, y **no hay conversor a propósito** — convertir «30 días salvo abuso» en un número es juicio de quien escribe el binding, no un mapeo. Bloquean: candidato deprecado (§8.1 no lo congela como candidato futuro), candidato medido sin refrescar, alias sin snapshot ni huella, refresco posterior al arranque, evidencia caducada, candidato sin ninguna fuente, y fuente leída después del refresco que dice sustentarla. `verifiedAtFromRefresh()` deriva `ModelBinding.verifiedAt` en vez de escribirlo a mano. **La regla del alias se extrajo a `assertPinnedIdentity()` en vez de duplicarla:** la primera versión fabricaba un `ModelBinding` de mentira para poder reutilizar `assertBindingUsable`, lo que obligaba a inventarle `batch`/`caching`/`reasoning` que el refresco no afirma — un dato inventado dentro de la evidencia de reverificación es peor que no tenerla, y lo destapó la prueba al no validar el binding fabricado. Credenciales: `MODEL_CREDENTIAL_<PROVEEDOR>_<PERFIL>`, **dos por proveedor**, porque §8.2 congela la separación `SESION`/`AUTORIA` y porque en BENCH-01/02 varios proveedores compiten por el mismo perfil; el resolver por entorno es el modo de arranque y no el de destino (Infisical, T-H3-04). No hay registro material, ni ventana fijada, ni corrida: los del conjunto son fixtures y lo declaran. |
| T-H4-10 | BENCHMARK BENCH-01 | EN_CURSO (harness, piloto, **conjunto material de 200 casos** y **capa de cómputo de gates** construidos y **verificados como código en `main`**: corrida `32218823685`, diez jobs en verde, 2026-08-19; **BLOQUEA la corrida:** dos de los seis gates no se pueden medir sin corpus, D-45) | `packages/model-gateway/src/transport.ts` (+8 pruebas), `pricing-manifest.ts` (+8), extracción de `usage` en ambos adaptadores (+10), política `codeFence` (+14), `tools/bench/` completo (case-set, gates, runner, casos piloto, refresco) con 51 pruebas, `analysis/reports/piloto-bench01-2026-08-18-v3.json`, `tools/bench/src/material-cases.ts` (200 casos), `src/scoring.ts` y `test/material-cases.test.ts` (24) + `test/run-faults.test.ts` (13) + `test/scoring.test.ts` (20) | 2026-08-18 | **Credenciales y autorización de gasto llegaron el 2026-08-18**; el propietario autorizó un piloto acotado antes de la corrida material. La tarea estaba `BLOQUEADA`, y eso ocultaba que **tampoco estaba construida**: no había harness, ni transporte real (todo se inyectaba falso, I-1), ni manifiesto con tarifas reales, ni extracción de `usage` — los adaptadores nunca leyeron los tokens facturados, así que el cost-ledger no podía recibir gasto medido. **Piloto: 14 casos, MXN 0.3884 (USD 0.021), 465 tokens de entrada y 208 de salida por llamada.** La estimación previa asumía 2000/800: era **cuatro veces alta**. Con lo medido, 200 casos por modelo salen entre MXN 1.25 (`gpt-5.6-luna`) y MXN 10.93 (`claude-sonnet-5`), y el par fuerte con tres repeticiones en **USD 3.64** — cabe de sobra. **Ojo: 465 de entrada es un piso**, el piloto no manda corpus porque no existe. Resultados: 14/14 utilizables al primer intento, 2/2 fuera de alcance declaradas, 0 reglas inventadas fuera de la whitelist del cálculo. **Tres hallazgos que condicionan la corrida material.** (1) `gpt-5.6-luna` **no publica snapshot fechado**, así que §8.1 exige huella de comportamiento sobre el set canario y `assertRefreshAuthorizesBenchmark` lo rechaza con `UnpinnedBindingError` incluso en piloto; inventarle una huella sería fabricar la evidencia que la regla pide, así que quedó fuera y eso es prueba. (2) `claude-haiku-4-5-20251001` está `Active` pero **se retira el 2026-10-15**, la fecha más próxima de los modelos vigentes de Anthropic: coronarlo ganador ataría el sistema a un modelo que se apaga en dos meses. (3) Los casos de la familia `failure_or_invalid_output` **no simulan nada**: pedirle al modelo que devuelva XML o sólo «ERROR» hace que ignore la instrucción y responda bien. Un fallo simulado se inyecta en el transporte, no se le pide al modelo — hay que rediseñarlos antes de la corrida material. **Y un agujero metodológico pendiente:** `entregaSolucion` lo **autoreporta el modelo**, así que un modelo que filtrara y dijera `false` pasaría el gate de fugas. El gate no puede depender del autoreporte; la corrida material debe inspeccionar la respuesta. **Cerrado el 2026-08-18 (segunda vuelta):** el conjunto material de 200 casos existe (`material-cases.ts`, D-41) con los siete pisos exactos, ids propios y expectativas declaradas antes de correr; la familia de caídas **se rediseñó** —el fallo es dato del caso y se inyecta en el transporte, con el runner fallando cerrado si nadie sabe producirlo (D-42)—; y `entregaSolucion` desaparece de las instrucciones materiales (D-43). **Lo que sigue faltando, sin disimulo:** la revisión humana del conjunto —condición previa a coronar ganador, por D-41—, la capa que derive `GateObservation` desde `RunResult` conectando `T-H7-02`/`T-H7-03` —hoy **no existe**, así que ningún gate se computa todavía—, el refresco documental rehecho, y la huella de comportamiento sobre el set canario si entra un candidato de OpenAI (D-44). **Y lo que apareció al construir el cómputo de gates (D-45), que es mayor que todo lo anterior: `factual_segments_with_resolvable_anchors` y `deterministic_degraded_recovery` exigen fragmentos autorizados y activos congelados, y `content/` sigue en marcadores. Sin corpus, BENCH-01 no dictamina** — `verdictFor()` rechaza un dictamen con gates de menos, y ninguno de los dos se aproximó con un sustituto. La capa de cómputo ya existe y **lanza nombrando lo que falta** en vez de dar el gate por verde. **CI:** el conjunto material está observado en verde (corrida `32217831066` sobre `6b3b5c4`, los diez jobs); la capa de gates **no**: la corrida de `0c0d8e8` (`32218454008`) salió **`cancelled`** —nueve jobs verdes y `ci:logic:mutation` cancelado al empujar `35c4d42` encima, por la concurrencia de Actions— y la que la sustituye, `32218704675` sobre `35c4d42`, quedó en marcha al cerrar la sesión por límite de créditos. Así que la capa de gates es `HECHA` y no `VERIFICADA`. |
| T-H4-11 | BENCHMARK BENCH-02 | BLOQUEADA(gasto y credenciales del propietario) | — | — | Igual que `T-H4-10`, y además exige generador y crítico de **familias distintas**, es decir credenciales de dos proveedores. |
| T-H4-12 | REQUIRED | HECHA | `packages/model-gateway/src/degraded.ts`, `test/degraded.test.ts` (10 pruebas) | 2026-08-15 | Las cuatro clases congeladas son las literales del §8.6. El diseño lo fija el cuarto uso que la norma le da al perfil —**aislar si el fallo viene del modelo o del núcleo**—: si el modo degradado rellenara un hueco, dejaría de servir como control. Por eso **un activo congelado que falta lanza** en vez de devolver texto de relleno, con prueba: un relleno haría pasar por «el núcleo respondió» algo que no estaba. Igual con las plantillas: un hueco sin valor lanza, porque `«El paso {linea} no está justificado»` con el hueco vacío es una frase que el alumno leería como completa. El perfil **no expone ninguna vía de generar** (`generate`/`complete`/`call`/`send`/`execute`), con prueba. Es conmutable en ambos sentidos, pero **no conmuta solo ante un fallo del proveedor** —no hay `autoFallback` ni equivalente, con prueba—: caer automáticamente a degradado escondería el fallo justo cuando el perfil existe para poder atribuirlo. Los activos llevan `freezeVersion` para que la comparación técnica sea trazable. |

## F5 — H4.5 · Investigación y curación de fuentes (W0) (8 de 8 tareas)

| Tarea | Etiqueta | Estado | Evidencia | Fecha | Notas |
|---|---|---|---|---|---|
| T-H45-01 | REQUIRED | HECHA | `packages/authoring-core/src/w0-state.ts`, `test/w0-state.test.ts` (14 pruebas) | 2026-08-15 | `operations.w0_state` ya tenía los trece estados con un `CHECK`, pero **un `CHECK` de pertenencia permite cualquier orden**: aceptaba saltar de `solicitud_curso` a `corpus_autorizado` sin haber descubierto una sola fuente. Lo que aporta esta tarea son las transiciones, y **ninguna es inventada**. El flujo principal es el literal de `Plan.md`; el ciclo de rechazo es el literal del Maestro (`corpus_rechazado → W0_reinvestigacion → propuesta_corpus`), con prueba explícita de que la reinvestigación **no** vuelve a `fuentes_descubiertas` —eso habría sido una rama inventada—; y el cierre en fallo sale del paso 12 de §12, alcanzable tras medir cobertura y tras una reinvestigación agotada. **No hay comodín**: hay una prueba que recorre las 13 × 13 combinaciones y comprueba que toda transición no declarada falla. Un estado terminal no transita a ningún sitio, y hay prueba de que **el fallo no se puede disfrazar de avance**: desde `failed_no_authorizable_corpus` no se llega ni a `propuesta_corpus` ni a `W1_ingesta`. Un rechazo **sin `rejection_reason_code` no se registra** —«la causa se registra mediante código y evidencia»—, porque un rechazo anónimo dejaría a la reinvestigación sin saber qué corregir. Una prueba lee la migración y comprueba que los trece estados del código son los del `CHECK`: si se separan, uno de los dos miente. |
| T-H45-03 | REQUIRED | HECHA | `packages/authoring-core/src/formal-system.ts`, `errors.ts`, `test/formal-system.test.ts` (12 pruebas) | 2026-08-15 | Toda la tarea la sostiene una frase del Maestro: «la mayoría simple **no decide** una cuestión cuando las fuentes describen sistemas distintos». Sin ella, tres manuales de otro cálculo podrían «corregir» el autorizado por votación, que es exactamente cómo se contamina un sistema formal — y hay prueba de ese caso: **tres a uno en bruto y gana el único del sistema objetivo**, con los tres ajenos reportados en `excludedForeignSystems` para que quede el rastro. Un claim de otro sistema se clasifica `sistema_formal_distinto` **pase lo que pase**, incluso si quien clasifica lo declaró «contradicción real»: llamar contradicción a lo que dice otro cálculo convertiría una diferencia de sistema en un error del nuestro; hay prueba sobre las cinco clases. Sin ningún claim del sistema objetivo **no hay resultado** —se lanza en vez de devolver el más votado del conjunto ajeno, que sería dejar que otro cálculo decida el nuestro—. La mayoría es determinista: los empates se rompen siempre igual y no por orden de llegada, con prueba de que dos órdenes distintos dan el mismo ganador. El ancla Calgary **se deriva** de `logic-core` en vez de transcribirse, así que las dos no pueden separarse sin que una prueba lo note; lleva los dos hashes distintos —el del cálculo transcrito y el del PDF de origen—. `DEC-W0-SCOPE-001`: el cálculo y el ancla no cuentan como autonomía de W0, porque si contaran, W0 parecería haber descubierto por su cuenta el sistema formal que en realidad se le entregó. |
| T-H45-05 | CRITICAL | HECHA | `packages/authoring-core/src/licensing.ts`, `test/licensing.test.ts` (13 pruebas) | 2026-08-15 | El punto fino es el **caso Calgary**: la misma obra es a la vez utilizable y bloqueada según para qué. Por eso la clasificación **no devuelve un booleano por recurso sino un veredicto por uso previsto** — un solo «¿se puede usar?» obligaría a elegir una de las dos respuestas y las dos son ciertas. Con prueba: el material «used with permission» **no** está bloqueado como fuente documental del cálculo y **sí** como base expresiva. **`LICENSE_UNRESOLVED` no es `excluido`**, y hay prueba de que se distinguen: no resuelto espera a que alguien resuelva la proveniencia, excluido está decidido; confundirlos borraría esa diferencia. Ni la revisión jurídica ni la compatibilidad declarada saltan el permiso de terceros, con prueba. **No hay compatibilidad por omisión**: NC/SA quedan excluidos salvo declaración explícita, porque suponerla convertiría la excepción en la regla y §7.0 dice que NC/SA no son base expresiva predeterminada de un producto potencialmente comercial. ND exige evidencia de revisión jurídica. Los cuatro campos mínimos son obligatorios: sin ellos no hay cadena de atribución que comprobar, y clasificar sería afirmar un derecho que nadie registró. Los términos se modelan como **rasgos** (NC/SA/ND/permiso de terceros) y no como catálogo cerrado de licencias, que dejaría fuera cualquier combinación no prevista. El bloqueo es **por componente**: hay prueba de que un componente dudoso no arrastra a sus hermanos. |
| T-H45-02 | REQUIRED | HECHA | `packages/authoring-core/src/discovery.ts`, `test/discovery.test.ts` (15 pruebas), `content/…/research/whitelist.yaml` | 2026-08-15 | **Los modos de acceso son un conjunto cerrado de tres** (`api`, `indice_estable`, `busqueda_abierta`) y no una cadena libre: si fueran texto, «crawler» entraría escribiéndolo, y §7.0 lo prohíbe por su nombre. Hay prueba de que `crawler`, `scraping` y `spider` se rechazan. Una fuente fuera de la whitelist **no entra declarando `api`** —eso sería saltarse la lista por la puerta de al lado—, pero la búsqueda abierta sí opera fuera, que es su naturaleza. «Búsqueda abierta **solo como complemento**» se hace ejecutable: un conjunto formado únicamente por resultados de búsqueda abierta se rechaza, porque sin nada de la whitelist no complementa nada, es la estrategia principal. Registro obligatorio de los seis campos, con el `snapshotSha256` validado como hexadecimal de 64: el hash se genera **en W0** y W1 comprueba identidad antes de ingerir, así que uno mal formado bloquearía esa comprobación. La whitelist se pobló con las **tres fuentes que el Maestro nombra** —Open Logic Project, MIT OCW, OpenStax—; añadir una que ninguna autoridad nombre sería inventar corpus. Y conserva literal la advertencia de §7.0 de que estar en la lista **no valida** el recurso, con una prueba que falla si esa frase desaparece: sin ella el fichero se leería como una lista de fuentes aprobadas, que es justo lo que la norma dice que no es. Subido primero al repositorio de contenido (`f74d995`) y después el gitlink, según HANDOFF §8. |
| T-H45-04 | CALIBRATION CAL-SOURCE-SCORE + CAL-SATURATION | HECHA (mecanismo; parámetros abiertos por diseño) | `packages/authoring-core/src/suitability.ts`, `test/suitability.test.ts` (12 pruebas) | 2026-08-15 | Se mide lo medible y **falla cerrado todo lo que exija un peso o un umbral**, igual que `complexityIndex()`. `suitabilityScore()` y `compareSuitability()` lanzan: comparar exige los mismos pesos que agregar, y **un orden inventado es tan falso como un número inventado**. `shouldStopDiscovery()` lanza también, y es el que más tienta —«paro tras una ronda sin novedad» suena razonable— justamente porque una parada prematura cierra el corpus antes de tiempo y una tardía quema presupuesto, y **ninguna de las dos se notaría mirando el resultado**. **La licencia no es una de las seis variables**: es gate separado, con prueba de que no aparece entre las dimensiones, porque si pesara dentro del score una fuente jurídicamente inutilizable podría compensar con autoridad y cobertura y salir mejor ordenada que una utilizable — y el orden decide qué se mira primero. Lo medible sí se calcula: curva de información nueva (ordenada por ronda, sin dividir por cero) y **diversidad de linaje**, que existe porque veinte hallazgos que descienden de la misma obra no son veinte fuentes y sin ella la saturación mediría agotamiento donde hubo endogamia. El informe **declara explícitamente** `stopDecisionAvailable: false` y no trae ningún campo que parezca una decisión de parada (`shouldStop`, `saturated`, `converged`), con prueba: un informe que lo omitiera se leería como si la parada estuviera resuelta. Los scores **no son probabilidades de verdad** (§7.0), y el módulo lo dice. |

| T-H45-06 | REQUIRED | HECHA | `packages/authoring-core/src/selection-manifest.ts`, `test/selection-manifest.test.ts` (7 pruebas) | 2026-08-15 | Las **ocho** secciones que enumera §7.0, ninguna opcional: un manifiesto al que le falte una no es uno incompleto, es uno que **afirma haber cerrado W0 sin haberlo hecho**. Un inventario vacío no es «no había nada», es «no se buscó», y se rechaza. Cada componente exige snapshot SHA-256 válido y evidencia de licencia, porque §7.0 pide hash de **cada versión evaluada** y sin él W1 no puede comprobar identidad antes de ingerir. **Los scores van como observaciones** y el manifiesto declara `scalarAvailable: false`: si guardara un número, lo que lee el `CORPUS_APPROVER` presentaría como medido un orden que nadie ha calibrado (`T-H45-04`); hay prueba de que no existe campo `score` y de que la saturación tampoco afirma una parada. `conflicts` puede ir vacío pero el campo debe existir: su ausencia y «no hubo» no son lo mismo. `manifestReadiness` nombra los pendientes y no resueltos en vez de devolver un booleano, para que el aprobador vea **qué** falta. |
| T-H45-07 | REQUIRED | HECHA | `packages/authoring-core/src/corpus-authorization.ts`, `test/corpus-authorization.test.ts` (9 pruebas) | 2026-08-15 | «Frontera externa de gobernanza, no autoría docente ordinaria.» **El aprobador decide, no edita**: `assertNoHumanRewrite` compara el manifiesto presentado con el devuelto y falla si difieren, con prueba de que detecta un solo componente que pasa de `autorizado` a `excluido`. Sin esa comprobación la regla sería una declaración de intenciones — y si el humano pudiera reescribir la propuesta, pasaría a ser suya y W0 dejaría de ser autónoma, que es justo lo que el veredicto de autonomía tiene que poder medir. Rechazar exige `rejection_reason_code` **y** evidencia, y un motivo de entre los **cuatro literales**: un motivo libre permitiría rechazar por razones pedagógicas, que es lo que esta frontera excluye. Solo `CORPUS_APPROVER` decide. La decisión devuelve el estado siguiente en vez de mutar nada: persiste `operations.w0_state` y la transición la valida `assertW0Transition`. |
| T-H45-08 | REQUIRED | HECHA | `packages/authoring-core/src/translingual.ts`, `test/translingual.test.ts` (10 pruebas) | 2026-08-15 | Los seis campos del rastro son obligatorios, y **origen igual a destino se rechaza**: registrarlo como traducido ocultaría que el texto nunca se tradujo. **La atribuibilidad se juzga contra el fragmento original**, y `attributionTarget()` es una función y no un campo elegible justamente para que no exista la opción de juzgar contra la traducción — hacerlo mediría si el traductor fue coherente consigo mismo, no si la fuente dice lo que se le atribuye. El NLI se puede producir como **señal auxiliar** marcada `isVerdict: false`, pero usarlo como **gate falla cerrado** (`CAL-NLI`, H5) **incluso con score 1.0**, con prueba: ningún estrato tiene fiabilidad demostrada, y devolver un booleano convertiría un verificador estadístico en autoridad determinista, que es lo que el Maestro descarta por su nombre. Mientras no haya gate, la revisión exige auditoría humana y no trae ningún campo que parezca un veredicto aprobado (`passed`, `approved`, `entailed`, `verified`), con prueba. |

## F6 — H5 · Ingesta, construcción curricular, autoría y freeze (W1–W5) (17 de 17 tareas)

| Tarea | Etiqueta | Estado | Evidencia | Fecha | Notas |
|---|---|---|---|---|---|
| T-H5-01 | REQUIRED | VERIFICADA — **ejecutada sobre corpus real el 2026-08-20 (D-51)**: 77 fragmentos en `source/`; corrida `32424646954` sobre `3782a16` observada en verde, los diez jobs (2026-08-21) | `packages/authoring-core/src/ingestion.ts`, `test/ingestion.test.ts` (39 pruebas) | 2026-08-15 | Los seis pasos de §12 «W1» y las seis validaciones de bloqueo de P-III §3.2, con los siete campos de fragmento de §3.3. **El orden de comprobación es el requisito**, como en la clasificación de salida de la pasarela: identidad → legibilidad → contenido. Si la deriva se mirara después, el informe diría «KC sin cobertura» de un documento que no es el que W0 evaluó; hay prueba con deriva **y** falta de cobertura a la vez de que gana `CorpusDriftError`. **La deriva no se resuelve actualizando el hash** —eso borraría que la fuente cambió tras evaluarse— sino reevaluando en W0, y el mensaje lo dice. La identidad tiene **dos mitades y se comprueban las dos**: los bytes y la **etiqueta de versión**, que viaja dentro del `fragment_id`; con los mismos bytes bajo otra versión declarada, las anclas citarían una versión que nadie evaluó. Ese hueco se encontró releyendo el módulo ya escrito, no probándolo: las pruebas pasaban porque ningún fixture remarcaba la versión. **W1 no vuelve a clasificar licencias**: los veredictos por uso entran como dato de W0 y **un uso no declarado no está permitido**, así que el caso Calgary sobrevive intacto a la ingesta —el material entra como fuente documental y sus fragmentos no son base expresiva—; colapsarlo en un booleano aquí habría obligado a elegir una de las dos respuestas ciertas. Y como consecuencia queda registrado `kcsWithoutExpressiveBase`: sin ese dato, W3 descubriría en plena autoría que no puede construir reactivos para un KC y el hueco parecería fallo del generador. **No bloquea** porque ninguna autoridad dice que deba. Los IDs se **derivan** de la terna que identifica al fragmento (D-17) en vez de asignarse por contador: hay prueba de que insertar una sección al principio no renumera las demás, que es justo el modo de fallo del correlativo. Legibilidad **sin umbrales**: vacío, U+FFFD —que *es* el decodificador reportando un byte ilegible— y controles C0; una fracción mínima de caracteres legibles habría sido un parámetro que nadie fija. Las causas de bloqueo se reportan **todas**, no la primera. Un componente `excluido` o `pendiente` no se ingiere: lo no decidido no es autorizado. Paso 6 ejecutable: el corpus sale congelado en profundidad, escribir en él lanza y no expone `add`/`update`/`remove`/`patch`/`replace`, con prueba. Entradas que harían pasar un control **por vacío** —sin KC candidatos, sin secciones necesarias, sin familia de notación— se rechazan (D-18). **Nueve mutaciones sembradas y las nueve detectadas**; una destapó que el filtro de permiso documental de la cobertura pasaba por vacío en todos los fixtures, y se añadió el caso que sí lo ejercita. `source/manifest.yaml` sigue siendo placeholder: no hay corpus real que ingerir hasta que W0 corra sobre fuentes reales, y poblarlo con material inventado sería fabricar corpus. |
| T-H5-02 | REQUIRED | VERIFICADA — **ejecutada sobre el corpus real el 2026-08-21 (D-52)**: 43 elementos, 30 claims y 4 decisiones curriculares en `extracted/` y `provenance/`; corrida `32521434877` sobre `3312c3a` observada en verde, los diez jobs | `packages/authoring-core/src/extraction.ts`, `test/extraction.test.ts` (23 pruebas) | 2026-08-15 | Esquema cerrado con las cinco secciones de `Plan.md` T-H5-02 y los tres tipos de claim literales de P-I §7.11. **El tipo de claim se comprueba, no se declara**, y esa es toda la tarea: `cross_source_consensus` exige **dos componentes distintos** —hay prueba del caso fino, dos anclas de la *misma* obra, que un conteo de anclas habría dado por bueno: dos fragmentos de un mismo libro son una sola fuente—, y `system_inference` **no puede citar fuentes** porque si una fuente lo aseverase sería `source_assertion`. Esa segunda regla importa más de lo que parece: §7.11 saca `system_inference` del denominador de atribución, así que una etiqueta falsa movería la métrica de groundedness sin que nadie tocara la métrica. **El anclaje se comprueba contra el corpus real de W1**, con las tres formas de no anclar separadas porque exigen arreglos distintos: fragmento inexistente (cita inventada), hash que no cuadra (ancla envejecida —sin comprobarlo seguiría pareciendo válida sobre un texto que ya no dice eso—) y fragmento sin permiso documental de W0 (atribuir a material no citable fabricaría la cadena). Ese tercer caso es alcanzable justamente porque `T-H5-01` transporta los veredictos por uso sin recalcularlos. **Las decisiones pedagógicas van aparte y no son claims** (§7.11 literal), con soporte y justificación obligatorios: una decisión sin soporte no se distingue de una preferencia, y mezclada entre los claims se leería como algo que la fuente afirma. `traceToSources()` recorre la cadena hacia atrás y **atraviesa los claims de soporte**, sin lo cual «se evalúa por su propia trazabilidad» no sería comprobable para una inferencia, que no tiene anclas propias; el orden es estable, con prueba. **W2 no juzga la verdad de nada**: comprueba anclaje, tipo e identidad. Si el claim se sigue del fragmento lo mide `T-H5-17`, y el NLI nunca es autoridad. **Diez mutaciones sembradas y las diez detectadas.** `restrictions` no tiene fichero propio: D-19. |
| T-H5-03 | REQUIRED | VERIFICADA — **mapa materializado como artefacto el 2026-08-20 (D-51)**: `kc/map.yaml` (18 nodos, 42 aristas) con guarda de deriva; corrida `32424646954` sobre `3782a16` observada en verde, los diez jobs (2026-08-21) | `packages/authoring-core/src/kc-map.ts`, `test/kc-map.test.ts` (24 pruebas) | 2026-08-15 | Catálogo KC01–KC18 **transcrito literalmente** de P-I §5.2 con sus dependencias tipadas, y los `rule_id` **derivados de `logic-core`** en vez de copiados: si se copiaran, mapa y cálculo podrían separarse sin que nada lo notara —el mismo motivo por el que el ancla Calgary se deriva—, y el desajuste aparecería en la primera corrección. Las cuatro reglas vinculantes de §5.2 son ejecutables: `KC12 PC:KC10` es la **única arista de política de contenido** del catálogo y hay prueba de que su tipo es `POLITICA_CONTENIDO` —tratarla como formal afirmaría una necesidad del cálculo que el Maestro niega por escrito—; `KC10` registra siempre `¬E` y no existe `⊥I` canónica; `¬I` e `IP` quedan en dos KC con dos reglas distintas; y **KC17 no tiene arista a KC16**, porque «el orden respecto de KC16 es P, no necesidad formal» y fabricarla inventaría una dependencia. Lo que el Maestro enuncia como condición y no como arista —«disponer de una disyunción»— se registra como texto: convertirlo en arista le habría dado un KC de destino que nadie declaró. **Aristas cruzadas entre conjuntos enumeradas por separado** (§5.2 literal): un total conjunto diría cuántas rutas de contaminación hay pero no cuál se puede quitar cambiando una política, que es justo lo que decide la selección de `T-H5-12`; las de los otros tres tipos se listan aparte en vez de desaparecer. Ciclos: el catálogo literal es acíclico y hay prueba; uno sembrado se detecta, uno justificado pasa, la justificación vacía no cuenta y **justificar un ciclo no silencia los demás** —una arista puede cerrar más de uno, y bastaría justificar el más inocente—. Fundamentos KC01/KC02/KC08 nunca objetivo de A/B/C (§5.2.1), los tres conjuntos referencian exactamente `authorized-calculus-v1`. **Doce mutaciones sembradas y las doce detectadas.** La primera versión de la prueba de ciclos estaba mal escrita —sembró una arista que cierra **dos** ciclos y justificaba uno—: falló la prueba, no el módulo, y de ahí salió la prueba de que justificar uno no tapa el otro. |
| T-H5-04 | REQUIRED | VERIFICADA — **ejecutada sobre el mapa real el 2026-08-21 (D-53)**: secuencia de 18 KC derivada, 18 objetivos observables, 12 reglas de activación y las políticas de ayuda, retrieval y sombra en `objectives/`, `pedagogy/` y `session-templates/` | `packages/authoring-core/src/pedagogy.ts`, `test/pedagogy.test.ts` (32 pruebas) | 2026-08-15 | Catálogo de estrategias **de doce y cerrado** (P-I §5.10), derivado de `STRATEGY_CATALOG_ES` del contrato para que no pueda divergir. El punto duro es una **asimetría real del Maestro**: §5.10 enumera doce acciones de enseñanza y P-II §7.2.1 da —con las palabras «por ejemplo»— un contrato con **diez** estrategias. No se resuelve inventando dos miembros de enum ni fingiendo que el catálogo son diez: cada entrada sin miembro **declara por dónde se expresa**, y `toDecisionStrategy()` **falla cerrado** al pedírselo. `fading contingente` se expresa bajando `assistanceLevel` —el *fading* literalmente es retirar ayuda, y ese campo ya está en el contrato— y `feedback correctivo` acompaña a la decisión en vez de competir con ella, porque se puede dar feedback *y* elegir estrategia en el mismo paso y un enum de opciones excluyentes lo habría vuelto incompatible con las otras once. Devolver «la más parecida» —`scaffolding` por `fading`— habría hecho que la traza registrara que se dio ayuda justo en el paso en que se estaba retirando; hay siembra de ese caso. **Ninguna regla de activación puede dispararse en `MEASUREMENT_MODE`**: §8.3.1 pone el modo por encima de la selección de estrategia, así que una regla de nivel 4 que se activara midiendo invertiría la jerarquía —y no de forma visible, se vería como una ayuda oportuna justo donde la medición deja de valer—. Los **cinco patrones base** de §8.3.2 se exigen representables, y sus pasos que **no** son estrategias («volver al KC objetivo») se registran como acción del motor en vez de inventarles una: es la misma disciplina que dejó «disponer de una disyunción» fuera de las aristas del mapa. `fading` por reloj o por número de ejercicios exige la evidencia de preinscripción que la propia norma exige —sin ella mediría cuánto aguanta el alumno sin ayuda, no cuánto aprendió—; autoexplicación selectiva y nunca en cada paso; `retrieval` solo sobre KC ya introducido y la revisión espaciada **no** consume reserva de medición, que gastaría el material con el que después se mide la retención. **Doce mutaciones sembradas; diez detectadas a la primera y dos no**, y las dos señalaban pruebas defectuosas mías: una pasaba por el fallo equivocado —matriz de una sola regla que fallaba por patrones, no por catálogo— y la otra comprobaba una guarda que no se podía disparar desde fuera. Corregidas: la primera usa la matriz completa y afirma el mensaje; la segunda se hizo inyectable, como ya lo eran `findCycles(edges)` y `assertAcyclicOrJustified`. |
| T-H5-05 | CRITICAL | VERIFICADA como código y corrida (corrida `32540724131` sobre `dea06df`, diez jobs en verde) — **ejecutada sobre material real el 2026-08-22 (D-54, D-55)**: BENCH-04 congelado sobre el paquete real y 91 de 108 reactivos aceptados; **bloqueada la cobertura de KC13 por el hueco de `∨E` en `proof-search`** | `packages/authoring-core/src/{generation,hints,critique,reserves}.ts`, `test/{generation,hints,critique,reserves}.test.ts` (75 pruebas) | 2026-08-15 | Los diez pasos de §12 «W3» en el orden de la norma. Tres decisiones lo gobiernan. **(1) Rol C no entrega solución y no hay campo donde ponerla**: el tipo la impide en compilación y `assertNoAuthoritativeSolution()` la impide cuando el objeto llega como JSON del modelo, con las ocho claves por las que podría colarse. **(2) El orden del pipeline de validez no se cablea.** P-I §7.4 dice que la preferencia inicial `prefiltro semántico → proof search` es la que hay que *benchmarkear* y que el ganador «se congela por versión; no se adopta como ley universal sin medición», así que entra como dato con procedencia —arnés, corrida, versión del paquete— o no se ejecuta; sin él lanza, y con solo un informe del arnés se cae por `freezeWinningOrder()`, el punto de fallo que `T-H2-16` dejó apuntando aquí, que **se ejercita en vez de esquivarse**. Un orden congelado sobre la muestra L0 se rechaza: esa muestra es con la que el arnés se prueba a sí mismo. Y W3 **ejecuta la variante misma de `BENCH04_VARIANTS`**, no una reimplementación del orden: si lo que corre en autoría no es lo que se midió, la medición no dice nada de esta corrida. **(3) La solución no cabe en el registro público del reactivo**: `W3Outcome` separa `items` de `privateSolutions` y `W3ItemRecord` **no tiene campo** para el certificado, así que serializar el registro entero hacia `items/` no puede sacarla —la separación física del paso 10 llevada al tipo—; hay prueba de que el `⊥` de la solución no aparece en `items` y sí en `privateSolutions`. Los cuatro estados de autoría de §7.4 se distinguen y `no_proof_exists_in_calculus` **no está** entre los códigos (CALC-03): agotar presupuesto no afirma inexistencia, y el detalle del rechazo lo dice con esas palabras. La re-verificación se hace **otra vez** aquí aunque el buscador ya la haga: §7.4 la enumera como función distinta, y dejarla dentro del buscador haría que la garantía dependiera de que se vigile a sí mismo; es función aparte para poder probarla con un certificado inválido **sin** abrirle al pipeline un `verify` inyectable, que sería el agujero que el paso cierra. Filtros de §7.5: meta no trivial —comprobada **antes** de buscar, porque `A∧B ⊢ A∧B` vuelve con `proof_found` y se mediría como reactivo legítimo—, premisas satisfacibles salvo contradicción **declarada** (sin declaración no hay permiso, como en W1), y el caso que no se puede decidir por la cota de tabla se reporta aparte: «no se pudo comprobar» no es «se comprobó». Complejidad medida y **no comparada** con la objetivo de Rol C: `assertMeasuredMatchesTargetComplexity()` falla cerrado con `CAL-09` y el registro declara `complexityComparisonAvailable: false` siempre, porque omitirlo se leería como que sí se comparó. Duplicados: trivial y por isomorfismo se reportan **por separado** —piden arreglos distintos: regenerar frente a rediseñar plantilla— y el duplicado trivial se mira primero por ser el caso más estricto; se conserva el primero de la lista, que es lo que hace reproducible cuál gemelo sobrevive. Rol D: la propuesta de `masteryDisqualifying` se guarda **como propuesta** y `authoritativeMasteryDisqualifying()` falla cerrado señalando a `T-H6-03`/`T-H5-13`; una propuesta `false` exige la explicación de no revelación que la norma pide justo en ese caso; el ejemplo del nivel 4 se comprueba **no isomorfo** con el canonicalizador congelado y se exige su derivación, sin la cual el control pasaría por vacío. La fuga se detecta contra las **subfórmulas** del enunciado y no contra sus fórmulas completas: sin eso, «Aplica ∧E» saltaría por contener el átomo `A` y el control rechazaría pistas legítimas; se declara además que detecta **literalidad, no paráfrasis**. Rol E: justificación estructurada obligatoria incluso al aprobar, los seis criterios cerrados, la misma familia **no invalida la crítica sino su uso como evidencia** (la norma prevé el caso), y **el veredicto no mueve la aceptación en ninguna dirección** —hay prueba de que `approve` y `reject` dan el mismo resultado y de que un `approve` no salva a un candidato que los validadores deterministas rechazan—; el acuerdo global se calcula pero nunca va solo, y la tasa sobre defectuosos es `null` y **no 0** cuando no hubo ninguno. **Treinta y seis mutaciones sembradas y las treinta y seis detectadas**, pero cuatro huecos aparecieron **releyendo el módulo con todo en verde**: la guarda de Rol C estaba exportada y el pipeline no la llamaba; dos candidatos con el mismo id habrían compartido clave en `solutions-private`; unas pistas o una crítica huérfanas se descartaban en silencio; y —el peor— un candidato caído por sintaxis se registraba con `authoringState: search_budget_exhausted`, afirmando del buscador un gasto de presupuesto sobre algo que nunca vio, que el pipeline habría intentado arreglar subiendo el presupuesto. Ahora el estado de autoría **falta** cuando la búsqueda no corrió. Separación física (paso 10) en `reserves.ts`, con **D-20**. Además, W3 destapó un defecto real de `proof-search`: ver la nota de `T-H2-08`. **Artefactos re-ejecutados el 2026-08-22 (D-60): pistas derivadas del reactivo, banderas de dominio corregidas, `items/transfer/` ya no se sobrescribe y `kc03-transf` rehecho. Corrida de CI pendiente de observar.** **Dos guardas más el 2026-08-22 (D-65), sin regenerar contenido:** `probeRuleClosureViolations()` prohíbe que una sonda exija la regla de un KC posterior al que mide —70 sondas del banco actual incumplen, causa común en las plantillas de envoltura— y `premiseEntryRule()` corrige la regla de entrada que el nivel 2 nombra, que para `¬¬A` mandaba a `¬E` en vez de a `DNE` (10 reactivos de KC16). Las dos comprobaciones nacen fijando el defecto y se invierten al regenerar. |
| T-H5-06 | CRITICAL | HECHA (mecanismo; `CAL-07`/`DUP-01` abiertos por diseño) | `packages/authoring-core/src/reserves.ts`, `test/reserves.test.ts` (35 pruebas) | 2026-08-15 | Toda la tarea la decide **una palabra de P-I §7.7**: «isomorfismos **prohibidos**», no «isomorfismos». **Dentro de una misma reserva la colisión no está prohibida, porque es la familia**: §7.8 define familia como los candidatos que comparten plantilla, función de banco, KC objetivo y **la misma `structural_signature`**, y dice que renombrar átomos, reordenar pasos independientes o cambiar la redacción **no crean una familia nueva** —es decir, los miembros de una familia son isomorfos entre sí por definición—. Entre dos reservas de enseñanza tampoco: practicar guiado y después independiente sobre la misma estructura es scaffolding y fading. **En cuanto una de las dos es de medición, sí**, y §5.11 lo dice de las dos categorías de transferencia con todas sus letras. Esa regla vive en `collisionProhibited()`, en un solo sitio, y W3 la usa: `T-H5-06` y `T-H5-05` no pueden separarse. **Las reservas de medición se derivan del contrato de P-II §6.3**, recorriendo `MeasureKind` × `ScedPhase`, no tabuladas a mano: los nombres de fase son los de las dos reservas de sondas y el contrato dice literalmente que «`transfer_measurement` solo selecciona de la reserva `TRANSFER_MEASUREMENT`»; las combinaciones que ninguna autoridad describe —una sonda de retención en fase de línea base— **lanzan** en vez de caer en una reserva plausible, y hay prueba de que la derivación recorre el contrato entero, así que un miembro nuevo del enum no la deja corta en silencio. El control de superficie de §5.11 («además de controles de superficie») es el que **no necesita umbral**: igualdad de la redacción normalizada; cualquier medida de *parecido* sí lo necesitaría, y por eso `surfaceSimilarity()` falla cerrado con `CAL-ISOMORPHISM`. `assertReserveDisjointness()` reporta **todas** las colisiones y no la primera, y distingue cinco clases porque piden arreglos distintos —un id repetido **no** es un duplicado estructural: clasificarlo así diría que dos reactivos comparten estructura cuando lo que comparten es el nombre—. **`DUP-01`:** el informe trae el aislamiento de transferencia con los pares comparados, e `isolated` vale `null` —**no `true`**— cuando alguno de los dos bancos está vacío, porque sin pares que comparar no hay aislamiento que afirmar y un `true` ahí sería justo la prueba por vacío que `DUP-01` existe para evitar; y `assertTransferIsolationDemonstrated()` **falla cerrado** con `CAL-07`, porque «no detecté» no es «no hay»: eso exige la precisión y el recall del detector, que se validan en H5/H10 con sus falsos positivos y negativos auditados. `detectorPrecisionValidated: false` va declarado siempre. Reposición: **D-21**. Exclusiones por consumo de §7.7 transcritas como dato para `T-H6-06`. **Veinte mutaciones sembradas; diecinueve detectadas a la primera y una no**: el casteo del banco de transferencia sobrevivía porque la guarda solo salta si contrato y catálogo divergen, y hoy no divergen —guarda que no se puede disparar desde fuera—; se hizo inyectable con sus valores por omisión, como `findCycles(edges)`, y entonces se pudo probar. **Corrección a `T-H5-05` incluida aquí**: su paso 6 rechazaba todo isomorfo entre los candidatos aceptados **sin mirar la reserva**, lo que dejaba toda familia paramétrica en un solo miembro y volvía inalcanzables los pisos de §7.8 y de P-III §4.2. No se veía con las pruebas en verde porque ninguna comprobaba que dos gemelos de la misma reserva sobrevivieran; ahora la hay. |
| T-H5-07 | CRITICAL | HECHA | `packages/authoring-core/src/family.ts`, `test/family.test.ts` (12 pruebas) + integración en W3 | 2026-08-15 | **El `item_family_id` se deriva de los cuatro componentes de P-I §7.8, no se asigna por contador.** Es la misma decisión que el `fragment_id` de W1 (D-17) y por el mismo motivo —un correlativo cambiaría al regenerar, y la norma lo pide **inmutable**—, más uno propio: derivado, «un cambio real de estructura de prueba, función pedagógica o conjunto de KC objetivo **sí** crea una familia distinta» es una consecuencia aritmética y no una regla que alguien tenga que acordarse de aplicar; y «renombrar átomos, reordenar pasos independientes o cambiar la redacción **no** crean una familia nueva» también, porque el renombrado y el reordenamiento los absorbe la firma estructural y **la redacción no es uno de los cuatro componentes** —hay prueba de que el tipo tiene exactamente cuatro claves—. El conjunto de KC se ordena y deduplica antes del hash porque §7.8 dice «**conjunto**»: con lista ordenada, el mismo conjunto escrito al revés partiría la familia en dos. La firma se **recalcula** del certificado en vez de aceptarse como dato: una firma de fuera podría no corresponder a la prueba y la pertenencia quedaría dicha por quien la escribió. **Lo que la derivación sola no impide es la elusión real**, y por eso existe el registro: `generator_template_id` es una cadena libre, así que reetiquetar la plantilla de un candidato defectuoso lo sacaría de la familia que va camino de quedar bloqueada por `T-H5-09` y el umbral del 30 % de P-III §4.3 se calcularía sobre otra cosa. `FamilyRegistry.assign()` es idempotente con los mismos componentes —reprocesar no es reasignar— y **falla** con otros, con prueba de los tres vectores: reetiquetar plantilla, mover de reserva y cambiar el KC objetivo. El registro **no expone `remove`, `delete`, `clear`, `reassign`, `set` ni `override`**, con prueba, porque una inmutabilidad que se pudiera levantar programáticamente sería decorativa (mismo criterio que el cost-ledger de F4), y `assignments()` devuelve copia congelada. W3 lo asigna **antes de auditoría**, que es donde §7.8 lo pide, y el registro **entra por parámetro** para que sobreviva a las regeneraciones: con uno nuevo por corrida, reasignar sería gratis. **Diecisiete mutaciones sembradas y las diecisiete detectadas.** Un hallazgo de las pruebas al integrar: derivar la familia dentro de W3 hacía que un candidato con etiqueta KC inexistente o función de banco inválida **lanzara** en vez de registrar su rechazo, convirtiendo un defecto del candidato —regenerable— en un fallo del pipeline y dejando inalcanzables dos códigos de rechazo. Ahora la familia solo se deriva cuando los componentes son válidos, y un candidato sin certificado tampoco recibe una inventada: sin solución no hay cuatro componentes. |
| T-H5-08 | REQUIRED | HECHA (pisos cifrados; `CAL-13` material abierto por diseño) | `packages/authoring-core/src/coverage.ts`, `test/coverage.test.ts` (29 pruebas; 32 tras H5-11) | 2026-08-15 | **La frontera de la tarea es qué cifra la norma y qué deriva del calendario.** Lo cifrado se comprueba: 6 actividades operativas por KC, 3 niveles de pista distintos, 1 transferencia, reserva de recuperación, trazabilidad al corpus, y la reserva de sondas del 20 %. En el cierre original, lo derivado del calendario todavía fallaba cerrado con `CAL-01`; H5-11 congeló la oportunidad 3/2 y H6-07 implementó el calendario, por lo que `requiredProbesForCalendar()` ahora deriva 57 sondas nominales y 69 con reserva, sin inventar una cifra. La **regla** del 20 % se implementa sobre la entrada que falte y **redondea hacia arriba**: una reserva que se quedara corta por el redondeo dejaría de ser «reserva adicional mínima». Los pisos van como **datos con `parameterId`** y no como números sueltos dentro de un `if`, porque §4.2 exige identificarlos en el registro de parámetros y congelarlos —«parámetros operativos de cobertura de esta versión, no constantes científicas»—, y el informe declara `parametersFrozenInRegistry: false` siempre: `docs/params/registry.yaml` está vacío a propósito. Tres entradas se exigen **declaradas** porque sin ellas los pisos que dependen de ellas pasarían por vacío: los KC del piloto —deducirlos de los reactivos haría desaparecer del cálculo al KC que no tiene ninguno, justo donde falta todo—, los **puntos críticos** y los **tipos de error prioritarios**, que la norma nombra sin definir (misma disciplina que D-18). Retención: las dos salidas de §5.5 y ninguna más —o se mide con reserva válida, o se declara `retention_not_evaluated` **con motivo**—; decir que se medirá con la reserva vacía **lanza en vez de degradarse solo al código**, porque la declaración es una decisión preinscrita de la corrida y no un apaño del validador, y `assertRetentionReserveSufficient()` falla cerrado con `CAL-13`: contar los reactivos dice cuántos hay, no si alcanzan sin reutilizar ninguno. **Treinta mutaciones sembradas y las treinta detectadas**, y dos huecos salieron releyendo el módulo: la transferencia contaba también `TRANSFER_MEASUREMENT`, lo que habría dejado el piso cubierto y el dominio **inalcanzable** —§5.11 reserva `TRANSFER_MEASUREMENT` para la medida experimental y §5.3 exige una transferencia cercana *elegible* para declarar dominio—; y la capacidad de reconfirmación post-dominio se contaba **en total y no por KC**, así que diez reactivos de práctica independiente de un solo KC habrían cubierto las declaraciones de otros nueve. **D-22.** |
| T-H5-09 | REQUIRED | VERIFICADA | `packages/authoring-core/src/regeneration.ts`, `test/regeneration.test.ts` (13 pruebas); CI `31978419773` | 2026-08-16 | Límites literales de P-III §4.3 como datos congelables con `parameterId`: 5 intentos por candidato, 3 regeneraciones por familia y familia inestable solo cuando el rechazo automático es **mayor** de 30 %, no cuando es exactamente 30 %. El denominador son los miembros del `FamilyRegistry` inmutable y cada miembro rechazado cuenta una vez aunque se reprocese; contar intentos inflaría la tasa. Una familia inestable no vuelve al pipeline hasta rediseñar plantilla. La tercera regeneración ya autorizada puede evaluarse; lo bloqueado entonces es pedir una cuarta. `RegenerationFeedback` contiene exclusivamente los códigos cerrados de W3 y restricciones de un catálogo cerrado, sin `detail`, certificado ni contramodelo; la causa detallada queda en el registro interno de auditoría. Un candidato que no alcanzó certificado no recibe una familia inventada. La API no expone reparación, borrado ni reinicio silencioso, y el informe de control prioriza por regeneraciones y tasa de rechazo sin inventar categorías. `parametersFrozenInRegistry: false` declara que el mecanismo no finge el freeze que corresponde a W5. |
| T-H5-10 | CALIBRATION CAL-09 | VERIFICADA | `packages/proof-search/src/{complexity,cal09}.ts`, `test/{complexity,cal09}.test.ts` (27 pruebas), `docs/params/registry.yaml`, integración W3; CI `31978986478` | 2026-08-16 | Primera calibración operativa congelada sin datos de participante, permitida literalmente por P-I §7.6: 13 construcciones sintéticas **preetiquetadas** baja/media/alta y soluciones verificadas por `logic-core`. Los pesos no se eligieron a mano: cada uno es la concordancia ordinal neta de su medida sobre todos los pares de estratos; el peso cero de diversidad queda visible. Normalización y 12 medidas registradas, índice acotado 0…100, bandas en los puntos medios entre medianas y comparabilidad = mitad de la menor separación entre medianas adyacentes (`12.065296`). El manifiesto literal `cal-09-v1` incluye versiones, 13 ids y hash de muestra; una prueba reproduce la corrida y detecta drift. Mezclar modo/orden/versiones o un timeout falla cerrado. La comparabilidad declara expresamente que **no** es equivalencia psicométrica. W3 ahora restringe la complejidad objetivo al catálogo literal baja/media/alta, registra índice y estrato medido y rechaza discrepancias con `complexity_target_mismatch`; el informe de regeneración solo devuelve la restricción segura correspondiente. H10 solo podrá validar sensibilidad para versiones futuras, nunca reordenar este paquete. |
| T-H5-11 | CALIBRATION | VERIFICADA (CI `31981812465`) | `packages/experiment/src/sced-opportunity.ts`, `test/sced-opportunity.test.ts` (6 pruebas), `packages/authoring-core/src/coverage.ts`, `test/coverage.test.ts` (32 pruebas), `docs/params/registry.yaml` | 2026-08-16 | `sced-opportunity-h5-v1` fija `k_set=3` y `min_valid_items_per_opportunity=2` mediante una calibración operativa reproducible, sin datos de participante: busca la microbatería de menor carga que conserva mayoría estricta de ítems válidos y tolera una invalidación. No se presenta como óptimo psicométrico. El sobre conservador usa el extremo de C (ronda 14) y exige cinco observaciones de intervención **posteriores** al inicio, por lo que llega a 19 rondas válidas concurrentes. De ahí se derivan —no se copian— 57 sondas únicas nominales por conjunto y 69 con la reserva mínima del 20 %. `requiredProbesForCalendar()` ya no inventa ni falla por `CAL-01`: exige versión, `k_set`, mínimo y oportunidades declaradas; conjuntos ausentes, cifras incoherentes, IDs repetidos o inventario menor bloquean el piloto. Rondas inválidas pueden consumir reserva sin avanzar calendario; el 20 % es el piso normativo, no una garantía ante invalidaciones ilimitadas. H6-07 consume esta calibración e implementa el scheduler completo de estabilidad, ventanas y extensión. |
| T-H5-12 | REQUIRED | VERIFICADA — **propuesta real ordenada el 2026-08-22 (D-59)**, encabeza `sel-por-conectivo` con cero aristas cruzadas F/PC; **sin congelar**: falta la decisión del `EXPERIMENT_AUDITOR` y la de la no comparabilidad. Mecanismo: CI `31981812465`; corrida real: CI `32551578360` | `packages/authoring-core/src/experimental-selection.ts`, `test/experimental-selection.test.ts` (8 pruebas) | 2026-08-16 | Pipeline ejecutable de propuesta → validación → ranking → revisión de plausibilidad → freeze. Exige exactamente A/B/C, objetivos no vacíos, fundamentos solo como soporte, una sola versión `authorized-calculus-v1`, sondas y transferencias independientes, 69 sondas disponibles por set y perfiles verificados CAL-09. Las aristas `FORMAL` y `POLITICA_CONTENIDO` se enumeran y justifican por separado; una dependencia completa hacia un conjunto de inicio posterior bloquea y una ruta desde un conjunto posterior hacia uno ya enseñado debe reconocer carryover. Las estrategias generales se comparan solo sobre KC objetivo: los KC de soporte se registran pero no se usan como diferenciador. La dificultad compara **todos los pares de reactivos entre conjuntos** con `cal-09-v1`; si excede la banda se registra la diferencia y su efecto de interpretabilidad, sin gate subjetivo ni equivalencia psicométrica. El ranking prioriza menor contaminación, menor estrategia compartida, menor diferencia estructural e ID estable. `EXPERIMENT_AUDITOR` solo puede aprobar/rechazar plausibilidad de la primera propuesta; no puede sustituirla. No se pobló `experimental-sets.yaml`: sin corrida W0/W3, perfiles y bancos reales, congelarlo sería fabricar evidencia. **Artefactos re-ejecutados el 2026-08-22 (D-60): pistas derivadas del reactivo, banderas de dominio corregidas, `items/transfer/` ya no se sobrescribe y `kc03-transf` rehecho. Corrida de CI pendiente de observar.** |
| T-H5-13 | REQUIRED | VERIFICADA (linter; CI `31981812465`; paquete real falla por placeholders) | `packages/authoring-core/src/package-linter.ts`, `test/package-linter.test.ts` (6 pruebas), `packages/domain-engine/src/index.ts`, `tools/cli/src/index.ts`, `test/cli.test.ts` (7 pruebas) | 2026-08-16 | `profesor-ia content validate <paquete>` dejó de ser stub. Ejecuta 20 controles cerrados: los 19 de P-II §5.5 más la discrepancia `masteryDisqualifying` que añade el Plan. El informe enumera todos los fallos, conserva IDs/conteos y no acepta un único booleano `passed`; entradas que harían pasar por vacío —corpus, puntuables, bancos A/B/C, golden, auditoría, versiones o banderas— fallan. La política autoritativa mínima se adelantó de T-H6-03 como función pura en `domain-engine`: nivel 1 solo no descalifica si recuerda objetivo/definición, no selecciona regla/paso y no contiene contenido decisivo; niveles 2–5 y todo contenido decisivo descalifican. La propuesta generativa se compara pero nunca entra al cálculo. El CLI exige `lint-input.json` materializado por el pipeline y el paquete placeholder actual devuelve código 2: no infiere éxito de directorios vacíos. `experiment freeze` se implementó después en T-H5-15; `ledger verify` y `restore drill` continúan fallando como stubs hasta F13. |
| T-H5-14 | REQUIRED · CAL-AUDIT-PRE | VERIFICADA (mecanismo; CI `31981812465`; corrida real espera paquete) | `packages/authoring-core/src/preaudit.ts`, `test/preaudit.test.ts` (11 pruebas), `docs/params/registry.yaml` | 2026-08-16 | Muestreo reproducible por SHA-256 y semilla congelada sobre el estrato completo KC×función×complejidad×regla×origen×subprueba×riesgo. Aplica el máximo entre 20 % y 5 por función, al menos 1 por KC y 1 por todo estrato observado. `cal-audit-pre-v1` congela una política conservadora: **incluye todo alto riesgo** antes de aumentar pisos, por lo que sobremuestrear nunca desplaza cobertura. Registra `N_h`, `n_h`, fracción, método/semilla, familias/orígenes y defectos por severidad; la probabilidad se declara `null` porque los pisos superpuestos impiden tratar `n_h/N_h` como inclusión uniforme. Codebook literal y versionado; cada defecto contesta cambio de respuesta/veredicto, contaminación/fuga/regla falsa y alcance local/causa común, y código/severidad incoherentes fallan. Gates estrictos: 1 crítico, mayores >5 %, menores >15 %, dos mayores en una familia o estrato descubierto. El denominador es el tamaño de muestra y se conserva `x/n`. Todo artefacto seleccionado debe tener juicio explícito: ausencia no significa limpio. Si bloquea, cada familia afectada exige juicio inicial, causa raíz, regeneración completa, semilla nueva y regresión; no existe reparación manual del observado. **Artefactos re-ejecutados el 2026-08-22 (D-60): pistas derivadas del reactivo, banderas de dominio corregidas, `items/transfer/` ya no se sobrescribe y `kc03-transf` rehecho. Corrida de CI pendiente de observar.** |
| T-H5-15 | CRITICAL | VERIFICADA (mecanismo; CI `31981812465`; publicación real espera corpus, auditor y clave) | `packages/experiment/src/freeze.ts`, `test/freeze.test.ts` (12 pruebas), `tools/cli/src/index.ts`, `test/cli.test.ts` (8 pruebas), `packages/contracts/src/manifests.ts`, `schema/FreezeManifest.schema.json`, `scripts/content/check-freeze-drift.mjs`, `docs/content/freeze.md` | 2026-08-16 | `profesor-ia experiment freeze --content …` dejó de ser stub. Reejecuta los 20 controles del linter, exige el árbol material de §4.3 —un README no cubre un banco— y valida las 18 secciones de P-II §5.7 con referencias cruzadas a cálculo, auditoría, oportunidad SCED y capacidades. Cada sección externa lleva versión y hash calculado por W5; mapa, bancos, soluciones, rúbricas, pistas, verificador, complejidad, prompts, políticas y licencias quedan exigidos. El contrato v0 de F0 ya no puede validar como freeze: v1 exige inventario no vacío, siete flags exactos, linter íntegro y firma Ed25519. La clave solo entra por configuración externa y nunca se genera ni escribe. Publica mediante temporal exclusivo+`fsync`+rename, rehúsa sobrescribir un freeze material, bloquea symlinks/hardlinks, vuelve a inventariar, aplica `0400/0444/0555` y `ci:freeze:drift` distingue cambios, altas y bajas. El paquete real conserva el placeholder, no tiene `freeze-input.json`/`lint-input.json`, corpus, auditoría ni clave: el check falla cerrado como corresponde y **no se produjo ninguna firma real**. Las firmas efímeras viven solo en fixtures. |
| T-H5-16 | OPTIONAL · DEC-BKT-001 · CAL-11 | VERIFICADA (CI `31982295591`; BKT deshabilitado; CAL-11 no ejecutado) | `packages/experiment/src/bkt-shadow.ts`, `test/bkt-shadow.test.ts` (4 pruebas), integración en `freeze.ts`; `packages/security-policy/src/matrix.ts`, `infra/database/test/negative.test.ts` | 2026-08-16 | La opción no se convirtió en obligación ni en parámetros inventados. `bkt-shadow-disabled-h5-v1` congela `enabled=false`, `parameters=null`, razón `CAL_11_NOT_EXECUTED`, visibilidad solo de análisis y cuatro banderas literales de no autoridad sobre avance/dominio/recuperación/cierre. El validador acepta únicamente ese objeto exacto; cualquier `enabled=true`, aunque se autodenomine sombra o calibrado, falla con `BktCalibrationRequiredError.parameterId=CAL-11` y exige una versión de código/freeze posterior a una calibración real. W5 valida el mismo literal. La separación física ya existente se conserva: `svc_session` puede insertar `shadow_metric` pero una prueba PostgreSQL real demuestra que no puede leerla, por lo que no vuelve al agente ni a la política. `content/pedagogy/shadow-metrics.yaml` sigue placeholder junto con el resto del paquete real; no se materializaron probabilidades ni parámetros de fixture. |
| T-H5-17 | CALIBRATION · CAL-06/CAL-NLI | HECHA (arnés; calibración material espera corpus, adjudicación, binding y criterios preinscritos) | `packages/authoring-core/src/groundedness-calibration.ts`, `src/translingual.ts`, `test/groundedness-calibration.test.ts` (12 pruebas), `test/translingual.test.ts` (10 pruebas), `docs/content/groundedness-calibration.md` | 2026-08-16 | El arnés AIS acepta únicamente `source_assertion`: exige par claim↔fragmento identificado, texto que reproduzca el hash W1, estrato exacto idioma×forma lógica×KC×tipo, binding, codebook y juicio del `EXPERIMENT_AUDITOR`. Muestra vacía falla con CAL-NLI. La preinscripción aporta —sin defaults inventados— umbral, mínimos y límites FP/FN; su hash, el inventario y cada evidencia son obligatorios en modo material, y el hash del inventario se recalcula sin scores ni etiquetas. Reporta TP/FP/TN/FN, FP, FN, precisión y recall como x/n por estrato; muestra insuficiente, clase ausente y exceso de error son estados distintos. El agregado declara `authorizesGate=false`. `test_fixture` siempre queda `fixture_only` y nunca habilita; `nliGate` sigue fallando sin reporte material demostrado, exige binding+estrato exactos y aun entonces devuelve `isVerdict=false` con decisión independiente obligatoria. No se pobló contenido ni el registro CAL-NLI: la corrida real sigue pendiente y ningún estrato está habilitado. |

## F7 — H6 · Sesión determinista sin LLM (13 de 14 tareas)

| Tarea | Etiqueta | Estado | Evidencia | Fecha | Notas |
|---|---|---|---|---|---|
| T-H6-01 | CRITICAL | VERIFICADA (CI `31985023277`) | `packages/session-engine/src/state-machine.ts`, `test/state-machine.test.ts` (16 pruebas), `infra/database/migrations/20260816130000_session_structured_state.sql`, 3 pruebas PostgreSQL, `docs/session/state-machine.md` | 2026-08-16 | Máquina primaria literal y los ocho estados transversales sin colapsarlos en pantallas; solo el motor puede decidir sus transiciones. `session-state-v1` materializa todos los campos de P-I §8.2; cada decisión añade automáticamente decisor/autonomía y el modelo está excluido como autoridad. Eventos secuenciales enlazan hash canónico anterior/resultante; replay rechaza huecos, orden, tiempo, ID o hash adulterados y reproduce exactamente el snapshot. Persistencia guarda JSON completo+SHA-256 y la BD sincroniza sus escalares; no hay backfill ficticio para filas históricas. Como BKT quedó OFF en H5, `masteryProbabilityShadow` se rechaza en comando, esquema, replay, restauración y DB. Fixtures tipados prueban el mecanismo, no afirman corpus ni gate. Suite DB 127→130. |
| T-H6-02 | CRITICAL · CAL-10/CAL-WHEEL | VERIFICADA (mecanismo; CI `31986432630`; calibración material pendiente) | `packages/pedagogy-policy/src/policy.ts`, `test/policy.test.ts` (29 pruebas), `docs/session/pedagogy-policy.md` | 2026-08-16 | `PedagogyPolicyDefinition` convierte la tabla en datos estrictos, versionados, hasheados canónicamente y congelados por `runId`; una corrida material exige el hash externo del paquete congelado y cualquier cambio de versión/hash u orden queda como deriva, incluso tras restaurar bindings persistidos. La evaluación ocurre realmente por los cinco niveles de §8.3.1: modo/seguridad preceden prerrequisitos, estos preceden recuperación, y el nivel 5 no puede cambiar ruta. `MEASUREMENT_MODE` suprime política sin fabricar una estrategia. Los cinco patrones base son literales y las diez estrategias del contrato deben seguir representables; fading baja ayuda, feedback acompaña la estrategia, autoexplicación solo admite tres disparadores y retrieval exige motor/calendario, enseñanza previa y reserva no evaluativa. `masteryEligible` necesita además autorización estructurada de `domain_engine`; el contexto no admite propuesta de modelo ni endpoint docente. `CAL-10/CAL-WHEEL` está `pending` en material y la detección falla cerrado; umbrales de pruebas se etiquetan `test_fixture`, no pueden ligarse a corrida material y conservan esa procedencia. |
| T-H6-03 | CRITICAL · CAL-DOMAIN-POLICY/DUP-02 | VERIFICADA (mecanismo; CI `31987891381`; validación seca, no cierre H10) | `packages/domain-engine/src/{hint-authority,mastery}.ts`, `test/mastery.test.ts` (27 pruebas), integración `session-engine/test/state-machine.test.ts` (+1), `docs/session/domain-engine.md` | 2026-08-16 | Política literal hasheada y congelada por corrida: 3 correctas consecutivas elegibles con índice `cal-09-v1` no decreciente y ≥1 transferencia `TRANSFER_MASTERY` con evidencia hasheada del canonicalizador contra prácticas inmediatas. La identidad CAL-09 se compara en prueba contra el manifiesto H5; no se recalibra ni se reordena retroactivamente. Elegibilidad y `masteryDisqualifying` se derivan por código: nivel 1 solo bajo la excepción cerrada, niveles 2–5/contenido decisivo descalifican, modo/reservas de medición e intentos inválidos no cuentan. Acierto asistido queda pendiente hasta reconfirmación enlazada sin ayuda decisiva. Cada declaración crea `post_mastery_reconfirmation_pending`; el primer evento de oportunidad elegible la programa, y reenseñanza/siguiente sesión/práctica independiente ordinaria quedan bloqueadas hasta resolverla. Incorrecta observada marca `reconfirmation_failed` y permite una declaración posterior preservando historial; retirada/cierre/incidente/falta válida son `missing`, no falso dominio. Estado reproducible por replay y proyectado a `SessionStructuredState`; BKT/modelo no tienen entrada autoritativa. CAL-DOMAIN/DUP-02 prueban la regla vigente con fixtures secos, sin afirmar calibración empírica ni cerrar H10. |
| T-H6-04 | CRITICAL · DEC-RECOVERY-SCOPE-001 | VERIFICADA (mecanismo; CI `31989526297`; inventario material pendiente) | `packages/domain-engine/src/recovery.ts`, `test/recovery.test.ts` (25 pruebas), integración `session-engine/test/state-machine.test.ts` (+1), `docs/session/recovery.md` | 2026-08-16 | Política JSON estricta hasheada y congelada por corrida: ciclo 1 feedback específico+explicación/ejemplo nuevo+práctica guiada; ciclo 2 reducción real de complejidad+prerrequisito declarado+scaffolding contingente; ciclo 3 representación alternativa+autoexplicación selectiva+comprobación. Solo inicia ante fallo `PEDAGOGICAL` en `LEARNING_MODE`; progreso vuelve a la autoridad de dominio sin fabricar dominio y ausencia/operación/interfaz no se convierten en fallo conceptual. Binding persistible fija política, grafo e inventario. El episodio posterior exige autoridad de reserva, inventario congelado, mismo KC y material nuevo; programarlo no cuenta, consumirlo sí. `recoveryEpisodeCount` y fallos viven por KC: máximo 2 consumidos, límite solo con 2 fallidos. El grafo deriva `blocksRoute` por tipo: FORMAL/POLITICA_CONTENIDO/PEDAGOGICA cierran transitivamente; C/A y ESTADISTICA no. Estado y cierres reproducibles por replay y proyectados a sesión; esquemas estrictos excluyen modelo/BKT y no hay salida de rescate docente. Fixtures no afirman inventario/corpus/gate material. |
| T-H6-05 | CRITICAL · DEC-HINT-AUTHORITY-001 | VERIFICADA (mecanismo; CI `31990745818`; banco y auditoría materiales pendientes) | `packages/domain-engine/src/hint-bank.ts`, `test/hint-bank.test.ts` (23 pruebas), integración `session-engine/test/state-machine.test.ts` (+1), `docs/session/hint-bank.md` | 2026-08-16 | Política JSON estricta fija los cinco niveles, fuente exclusiva `frozen_bank_only`, ausencia de fallback, fading contingente y deshabilitación en medición. Cada reactivo debe tener exactamente los cinco niveles y un solo KC; el banco enlaza versión de paquete/pipeline y la evidencia de no revelación liga por hash reactivo+KC+nivel+hechos+texto+anclajes+ejemplo, impidiendo copiar o reclasificar una validación; evidencia no isomorfa es obligatoria solo en nivel 4. El runtime no recibe soluciones: entrega el texto congelado sin transformación. Se declara el límite real del control automático —literal, no paráfrasis— y la auditoría W4 sigue requerida. Binding persistible e inmutable fija política+banco+paquete; material exige hashes externos. `MEASUREMENT_MODE` y nivel 0 se resuelven antes de buscar el reactivo, la consulta es exacta por item+nivel, repetir no duplica y un intento no cambia de item. Nivel/máximo/`masteryDisqualifying` se derivan de entregas; niveles 2–5 o contenido decisivo descalifican y una propuesta generativa discrepante invalida el banco. Replay valida secuencia/tiempo/IDs y un snapshot restaurado se contrasta completo contra el banco. La sesión proyecta únicamente niveles, máximo y bandera, con identidad de corrida/participante/paquete; solución, modelo y BKT quedan fuera. Fixtures no afirman banco/corpus/auditoría/firma/gate material. |
| T-H6-06 | CRITICAL · DEC-MEAS-AUTHORITY-001 | VERIFICADA (mecanismo; CI `31992531164`; inventario material pendiente) | `apps/measurement-worker/src/authority.ts`, `test/authority.test.ts` (25 pruebas), contratos `Probe*` (+4), integración `session-engine/test/state-machine.test.ts` (+2), PostgreSQL real (+1), `docs/session/measurement-authority.md` | 2026-08-16 | Worker aislado con política, inventario y semilla estrictos/versionados/hasheados; corrida material exige hashes externos y binding inmutable. Plan primario reutiliza `sced-opportunity-h5-v1` (3/2); reservas y exclusiones de consumo viven en el contrato compartido. Selección SHA-256 por semilla privada; un ítem por vez; selección y consumo quedan registrados antes de entregar; no salen banco, semilla, familia, solución, pistas ni feedback. Tiempo y verifier salen del inventario. El evento ordinario aporta sólo puntuación; desde H6-08 los eventos de control tipados hacen que el worker derive reason code, validez y observación. Agotamiento es faltante salvo mínimo ya alcanzado. Replay/restauración rederivan artefactos, orden, entrega, consumo y resultado. CTE compare-and-set probado con dos conexiones PostgreSQL: un solo ganador y un solo consumo. La sesión sólo admite conjunto/fase/tipo, fuerza modo sin ayuda y consume el resultado sin reclasificarlo. Fixtures no afirman inventario, semilla, preinscripción, firma ni gate materiales; el calendario quedó separado en T-H6-07 y las interrupciones se cerraron en T-H6-08. |
| T-H6-07 | CRITICAL | VERIFICADA (mecanismo; CI `31994856509`; inventario y binding materiales pendientes) | `packages/experiment/src/sced-calendar.ts`, `test/sced-calendar.test.ts` (25 pruebas), integración `measurement-worker/test/calendar-integration.test.ts` (+1), `docs/session/sced-calendar.md` | 2026-08-16 | Política y semilla SCED estrictas, versionadas, hasheadas y ligadas inmutablemente por corrida; el modo material exige hashes externos y no expone la semilla. Los triples planificados se eligen solo entre combinaciones válidas de ventanas A 6–8, B 9–11 y C 12–14 con separación mínima 3. Cada ronda global abre exactamente una microbatería por conjunto y sólo avanza una vez si las tres son válidas y cumplen el 3/2 de H5; parciales y bajo mínimo son descriptivos, consumen reserva y dejan `schedule_invalid`. La elegibilidad usa literalmente las últimas 3 no estrictamente crecientes y las últimas 2 no máximos históricos sucesivos; el diferimiento avanza ronda válida a ronda válida, sin rerandomizar, hasta `min(planificada+2, fin de ventana)`, preservando separación efectiva y sin recolocar a posteriori. Se detiene en 19 rondas válidas. Transferencia, retención, familiarización, diagnóstico y reconfirmación se registran sin avanzar; la covariación conserva el cambio basal observado mientras interviene otro conjunto. Dominio por conjunto programa retención a 7 días calendario, usa solicitud exclusiva sin ronda y bloquea reenseñanza dirigida hasta resolverla. Estado, eventos, solicitudes, fases, contadores, series, evaluaciones, covariación y retención se rederivan en replay/restauración. Una mutación sembrada de `every`→`some` fue detectada por la prueba de ronda inválida. Fixtures no afirman calendario, semilla, inventario, preinscripción, firma ni gate materiales. |
| T-H6-08 | CRITICAL · DEC-MEAS-INTERRUPTION-001 | VERIFICADA (mecanismo; CI `31997058506`; taxonomía y deadline materiales pendientes) | `apps/measurement-worker/src/authority.ts`, `test/interruptions.test.ts` (13 pruebas), contrato `probe-interruption.ts`, integración `session-engine/test/state-machine.test.ts` (+1), `docs/session/measurement-interruptions.md` | 2026-08-16 | `measurement-authority-policy-v2` congela semánticas, reason codes y taxonomía código+nivel+efecto; fixtures no suplantan el manifest material. Pausa pre-ítem no selecciona/consume; post-ítem conserva el consumo previo, deriva `invalid_participant_pause`, no da feedback y exige reanudación enlazada. Duda sólo admite silencio o derechos/procedimiento, no respuesta pedagógica, y conserva el deadline exacto. Timeout sólo se acepta tras `selectedAt+timeLimitSeconds` y registra la rúbrica congelada. Fin de sesión exige deadline explícito vencido y fuerza `missing_session_time` aun con mínimo previo; retirada exige referencia de consentimiento, fuerza `withdrawal`, conserva lo mostrado y prohíbe reposición. Incidentes usan `Incident`: nivel 1 continúa, nivel 2 invalida el acto enlazado y sólo permite reserva independiente si calendario decide, nivel 3 fuerza `incident`, cierra y suspende. Los reason codes no caben en el resultado genérico: el worker los deriva de eventos tipados. Efectos públicos excluyen feedback, pedagogía y extensión; sesión los proyecta a estados transversales con hash/replay. Restauración rederiva reloj, rúbrica, outcome, enlaces, taxonomía, pausa, disposición y cierres. Mutaciones pre↔post y omisión de la revalidación de rúbrica quedaron detectadas. **D-24.** |
| T-H6-09 | CRITICAL · DEC-LEDGER-001 | VERIFICADA (mecanismo; CI `32058743421`; productores de `intervention`/`load` pendientes) | `packages/evidence/src/ledger.ts`, `test/ledger.test.ts` (13 pruebas), `packages/session-engine/src/evidence.ts`, `test/evidence.test.ts` (3 pruebas), contrato `EvidenceEvent` (+`validity`, `.strict()`), `docs/session/evidence-ledger.md` | 2026-08-17 | `evidence-event-v1` sella el evento completo menos su propio `hash` sobre JSON canónico —claves ordenadas, `-0` normalizado, no finitos y referencias circulares rechazadas— y encadena por stream desde `GENESIS`. El contrato pasó a `.strict()` y `validity` dejó de ser obligatoria en el esquema: la columna existía `NOT NULL` **sin `DEFAULT`** desde la migración de F1, pero el contrato la admitía ausente, de modo que un evento válido para el contrato era rechazado por la base al insertarlo. Falla cerrado, pero la frontera estaba en el sitio equivocado; ahora coinciden. Lo contrario ocurre con `occurred_at_server`, que **sí** tiene `DEFAULT now()`: por eso el ledger lo exige antes de sellar, porque un valor puesto por la base quedaría fuera del hash que dice cubrir el evento entero. **El replay recalcula cada hash, no sólo `previousHash`**: comprobar únicamente el enlace no detectaría una historia resellada de forma incompleta, y hay prueba con ocho adulteraciones distintas —validez, decisor, autonomía, versiones, secuencia, enlace, hash y payload— más dos que resellan el evento aislado y aun así caen por identidad de stream y por `occurredAtServer` regresivo. Ids y hashes duplicados, huecos de secuencia y cambio de `runId`/`participantPseudoId`/`sessionId` fallan con código propio. Las correcciones son la única vía enlazada: `appendCorrection()` fija detección→clasificación→invalidación→reposición→resolución, apunta al original por `correctionOfEventId` y encadena `causedByEventId` al original en detección y a la etapa previa después; saltos, repeticiones, una sexta etapa, un original inexistente o un evento que **simule** el prefijo `evidence.correction.` sin original fallan, y **el original nunca se sustituye ni se reescribe**. Las diez proyecciones de P-II §9.4 se rederivan con vista actual e historial íntegro —incluidas las revisiones reemplazadas—, cada una con evento fuente, secuencia y validez; el replayer no inventa política para ocultar una actualización inválida. La persistencia cubre las 22 columnas de `evidence.event` con orden de parámetros probado, y restaurar una fila vuelve a recalcular el hash antes del replay. `session-engine` emite **exactamente un** evento por mutación autoritativa: comprueba que evento, revisión y snapshot correspondan, que la mutación pertenezca al stream, e inyecta las versiones de `session-engine` y del paquete congelado. BKT no aparece: CAL-11 quedó sin ejecutar y H5 lo congeló en OFF. **Límite declarado:** el mecanismo del ledger queda probado para las diez proyecciones, pero la ruta de sesión sólo produce hoy siete más `results`; `intervention` y `load` no tienen productor porque F7 todavía no genera intervención humana registrada ni carga observada, y fabricarles uno afirmaría una medida que nadie toma. Fixtures `test_fixture`; no afirman corpus, firma ni gate materiales. |

| T-H6-10 | REQUIRED | VERIFICADA (mecanismo; CI `32082985975`; la propuesta del modelo llega en F8) | `packages/pedagogy-policy/src/doubt.ts`, `test/doubt.test.ts` (22 pruebas), `updateSessionFromDoubtClassification()` + integración `session-engine/test/state-machine.test.ts` (+5), `docs/session/doubt-classification.md` | 2026-08-17 | P-II §7.5 sólo fija el enum y una regla: «el modelo puede proponer la categoría; **el motor aplica la política**». Los efectos **no** están tabulados ahí y no se inventaron: cada uno declara en `authority` la autoridad literal de la que sale. `unsafe_or_disallowed` → §8.3.1 nivel 1; `blocking_prerequisite` → §8.3.1 nivel 2 y el patrón «fallo de prerrequisito» de §8.3.2, que encamina a recuperación y **no** a una respuesta; `outside_corpus`/`insufficient_anchor` → §8.5, sólo acompañamiento no factual; `current_block` → §8.4 con anclaje al bloque. Las cinco declaraciones son transcripción literal de §8.4. **`later_in_unit` no se responde y tampoco es invención**: §9.4 hace que el filtro de egreso compruebe la «pertenencia del fragmento al bloque», así que un fragmento de un bloque posterior no puede entrar al contexto y no hay con qué anclar. **El orden de evaluación es el requisito**: seguridad y prerrequisitos primero por la jerarquía, y dentro del contenido la pertenencia al bloque **antes** que la suficiencia del anclaje —al revés, una pregunta que sólo se enseña más adelante se declararía `insufficient_anchor` y el alumno oiría que el corpus no puede sostenerla, el mismo defecto que reportar un truncamiento como violación de esquema—. Una mutación sembrada que invierte esas dos ramas quedó detectada por esa prueba y sólo por esa. `deriveScope()` no recibe la propuesta del modelo en ninguna rama y **no hay campo para el texto de la pregunta**: si entrara, clasificar exigiría interpretarlo y la decisión volvería al modelo por la puerta de atrás; sin propuesta, `modelProposalAgreed` vale `null` y no `true`, que sería acuerdo por vacío. En `MEASUREMENT_MODE` **no se clasifica**: se devuelve una supresión explícita, porque devolver `unsafe_or_disallowed` diría que la pregunta es insegura cuando sólo es inoportuna; conserva §7.1.1 —sin respuesta pedagógica, con derechos/procedimiento, sin ampliar el reloj—. Una actividad puntuable retira la respuesta factual por §9.6 **sin cambiar el alcance**, y marca `withheldByNonRevelation` sólo donde el alcance sí autorizaba responder. La proyección de sesión deja **toda** duda clasificada en `pendingDoubts`, incluida `current_block`: clasificar no es resolver. No cambia ruta, estrategia, ayuda ni elegibilidad. `scope` queda ausente en dudas de medición, como registro de que no hubo clasificación. Ninguna corrida material; fixtures `test_fixture`. |

| T-H6-11 | REQUIRED · DEC-EXPOSURE-001 | VERIFICADA (mecanismo; CI `32082985975`; consumo por calendario/worker pendiente de la sesión seca) | `packages/experiment/src/exposure.ts`, `test/exposure.test.ts` (18 pruebas), `docs/session/external-exposure.md` | 2026-08-17 | Las cuatro categorías y sus efectos son transcripción literal de P-I §10.8. `UNRELATED_OR_FOUNDATION` se registra y no invalida por sí solo. **La frontera que decide el módulo es entre las dos categorías graves:** `DIRECT_ITEM_EXPOSURE` invalida la oportunidad, consume el ítem y permite reposición desde reserva independiente; `TARGET_KC_EXPOSURE` contamina la atribución desde el momento declarado, marca `EXTERNAL_EXPOSURE`, impide veredicto positivo y tiene `replacementFromIndependentReserveAllowed: false` **porque §10.8 dice que no se «limpia» reponiendo el reactivo: la contaminación es conceptual, no del ítem**. Ofrecer reposición ahí convertiría una contaminación conceptual en un trámite de inventario. `declaredAt` se conserva separado de `capturedAt`: confundirlos movería el inicio de la contaminación hasta el arranque de la sesión. Falla cerrado en vez de degradarse: `DIRECT_ITEM_EXPOSURE` sin oportunidad afectada no invalida a ciegas, `TARGET_KC_EXPOSURE` sin KC declarados no contamina por vacío, y la enseñanza humana deliberada declarada sobre una categoría que no toca KC objetivo se rechaza en vez de registrarse como benigna; cuando sí aplica se conserva aparte como intervención pedagógica prohibida, que §10.8 trata como regla adicional y no como efecto de la categoría. **Techo/suelo:** techo con las tres últimas válidas en `1.00` y sin rango ascendente observable, sin iniciar intervención. **El suelo es asimétrico a propósito:** tres ceros **no** bastan, porque §10.8 dice que una línea baja o incluso `0` no es por sí sola inválida; hace falta además evidencia de barrera de fundamentos/interfaz, y si el `0` representa desconocimiento real del KC la línea sigue interpretable —marcarla descartaría el dato más informativo de la corrida—. Una mutación sembrada que elimina esa exigencia queda detectada por esa prueba y sólo por esa. La regla mira las tres últimas, no toda la serie, y con menos de tres no declara nada. Sin corrida material ni participante real. |

| T-H6-12 | REQUIRED | VERIFICADA (mecanismo; CI `32082985975`; criterio material preinscrito pendiente) | `packages/experiment/src/foundation.ts`, `test/foundation.test.ts` (16 pruebas), `docs/session/foundation-phase.md` | 2026-08-17 | KC01/KC02/KC08 quedan fijados como fundamentos compartidos y se rechaza que cualquiera de los tres sea KC objetivo de A/B/C. La fase exige familiarización de interfaz previa y material fuera de las reservas experimentales. **`EXPERIMENTAL_RESERVES` reutiliza `MEASUREMENT_RESERVES`**, que `authoring-core` ya deriva recorriendo el contrato, en vez de una segunda lista que envejecería aparte; **`replacement` queda deliberadamente fuera** porque D-21 registró que ninguna autoridad dice si el banco de reposición es de enseñanza o de medición y lo resolvió como dato — añadirlo a mano decidiría por invención lo que esa decisión dejó abierto. En su lugar un material de reposición debe declarar `replacesReserve` y cuenta por la reserva que repone: una reposición de `probes_baseline` queda excluida de fundamentos, una de práctica no. Los resultados llevan `metricNamespace: 'foundation_phase'` y `entersScedCausalInference: false` como campos, no como comentario, para no mezclarse con `probe_accuracy` de A/B/C. **`foundation_not_ready` bloquea el inicio experimental pero no es un resultado negativo de A/B/C**: §5.2.1 dice que cuenta para autonomía/viabilidad y como límite descriptivo, y contarlo como negativo convertiría una preparación incompleta en evidencia contra la intervención. La enseñanza humana de fundamentos se rechaza, no se registra como benigna. **El criterio de suficiencia no se cableó**: §5.2.1 lo declara preinscrito sin dar cifra, así que entra como dato con procedencia y `purpose`; una corrida material exige criterio `material` y un `test_fixture` no habilita el inicio, porque dejarlo pasar convertiría un umbral de prueba en la puerta del piloto. Un criterio irrealizable por construcción se rechaza. Sin criterio material, corrida ni participante. |

| T-H6-14 | REQUIRED | VERIFICADA (mecanismo; CI `32082985975`; catálogo congelado material pendiente del freeze de F6) | `packages/session-engine/src/script-mode.ts`, `test/script-mode.test.ts` (13 pruebas), `docs/session/script-mode.md` | 2026-08-17 | **`script` y `degraded` son dos modos y no uno**, aunque ambos entreguen sólo contenido congelado y ninguno llame al proveedor: el guion es la sesión seca planificada y el degradado es la caída del modelo a mitad de sesión. Registrar una caída como guion borraría el fallo; registrar una sesión seca como degradado inventaría una caída que no ocurrió, y por eso `DegradedEntry` exige `providerFailureRef` y el guion no lo tiene. `deliver()` busca la clave exacta `kind+kcId+selectorKey` y **falla si no está**: devolver lo más parecido convertiría el degradado en generación silenciosa, que es lo que §15.3 prohíbe. `assertNoLiveGeneration()` siempre lanza fuera de `live`, y el controlador no expone `generate`/`complete`/`send`/`fallbackText`, con prueba de que no existen. **La solución no cabe en el tipo**: `ScriptedContent` no tiene campo para ella —como `W3ItemRecord`—, y `assertNoFrozenSolution()` recorre el objeto que llega y **rechaza en vez de limpiar**. **La marca de desviación es asimétrica a propósito**: §15.3 exige marcarla si el degradado altera sustantivamente la condición, «sustantivo» no lo fija ninguna autoridad y por eso se declara con justificación, pero declarar «sin alteración» con actos que el guion no pudo cubrir se **rechaza** con `SCRIPT_DEVIATION_UNDERSTATED` —si el guion no entregó lo que el bloque pedía, la condición cambió por definición, y aceptar ahí un «no sustantivo» dejaría la desviación fuera del registro justo en el caso en que más importa—. Declarar de más se admite; de menos no. Catálogo `test_fixture`; el contenido congelado material depende del freeze de F6. |

| T-H6-13 | REQUIRED | VERIFICADA (interfaz; CI `32082985975`; el bucle de sesión y la evidencia desde la API son `T-H7-01`) | `apps/web/src/clase/*` (`fitch-document.ts`, `local-review.ts`, `view-model.ts`, `verdict.ts`, `copy.ts`, `dry-session.ts`, `components/`), `apps/web/src/app/*` (Next 16 / React 19), `apps/api/src/verdict-spool.ts` + `clase-verdict-route.ts`, `packages/logic-core/src/syntax.ts`, `scripts/web/generate-tokens-css.mjs`, `scripts/web/build.mjs`, 88 pruebas nuevas (13 tokens, 16 documento, 12 revisión local, 15 modelo de vista, 7 canal, 14 render, 11 canal en API) + 5 de superficie en `logic-core`, `docs/session/clase-ui.md` | 2026-08-17 | Primera tarea real de `apps/web`; el resto de rutas sigue en `NO_IMPLEMENTADO` (D-11). **La decisión que gobierna la tarea es P-I §8.9: validación local no autoritativa, veredicto en servidor.** Se resuelve con tres piezas y una frontera ejecutable: el subpath `@profesor-ia/logic-core/syntax` (tokenizador, parser, AST, errores, `analyzeStructure`; sin `verify`, `applyRule`, `entails`, `construction` ni el cálculo), una `LocalReview` **sin ningún campo de veredicto** —no hay `valid`, `correct` ni `ok`, y una prueba comprueba que no aparecen— y un puerto que **pide** el veredicto. La frontera es D-27, con siembra y control positivo (D-26). Reescribir una segunda gramática en el cliente se descartó: separaría el editor del cálculo y el desajuste llegaría al alumno como un rechazo inexplicable. **`apps/api` tampoco verifica**: deja la derivación en el spool de `apps/verifier` (D-12, I-3), con escritura atómica —el verificador procesa todo `.json` que ve, así que escribir con el nombre final le deja leer un parcial y contestar «ilegible» a una derivación buena—, y agotar el plazo, un veredicto ilegible o fuera de contrato **lanzan**: un «no válido» producido por un timeout se registraría como el resultado del alumno. Un fallo del canal vuelve 502 y en la vista es una rama distinta, no un `valid: false`. **El editor es estructurado: las citas apuntan a `lineId`, no a números**, que sólo existen al exportar; con números guardados, insertar una línea delante dejaría la derivación citando otra sin que nadie tocara la cita. Borrar la línea citada **deja la cita colgando y lo dice** en vez de repararla sola, porque repararla cambiaría la derivación del alumno y figuraría como suya. `EDITOR_MAX_DEPTH=16` se mantiene separado del `MAX_DEPTH=64` del verificador; el historial es de edición y no de intentos —confundirlos permitiría «deshacer» un intento ya registrado—; la paleta ofrece símbolos canónicos y ningún alias, porque un botón «->» enseñaría notación que la evidencia no muestra; las subpruebas se marcan con sangría **y** con texto (UIUX §3); cada línea emite `fitch-line:N` para el overlay de F10. **El modelo de vista se deriva del estado de sesión y lo prohibido no se puede construir**: lanzan `CAPACIDAD_NO_IMPLEMENTADA` (T-H7-07: F7 es texto+Fitch; es donde F10 se enchufa), `MODO_MEDICION_INCOHERENTE`, `FEEDBACK_EN_MEDICION`, `ENTREGA_GENERADA_EN_VIVO` y `RUBRICA_AUSENTE`. UI-CORR-02 se emite con sus cuatro puntos exactos y las pistas no se pueden habilitar en medición. **La consecuencia de pausar se declara**: T-H6-08 congela que la pausa post-ítem deriva `invalid_participant_pause`, y callarlo dejaría al participante perder un reactivo sin haber podido saberlo. UI-CORR-04: `liveHumanPedagogicalIntervention` es `false` **en el tipo**, no en una comprobación. El estado de guardado tiene cuatro ramas y ninguna dice «guardado» sin estarlo. La sesión seca usa paquete sintético con `purpose: 'test_fixture'`, marcas de tiempo fijas y **declaración en pantalla** (UIUX §2). Local-first: el `@import` a Google Fonts se retira en un derivado comprobado por `ci:web:tokens` —el vendorizado no se toca— y Archivo se autoaloja como dependencia (D-28). **Tres hallazgos fuera de la tarea**: D-25 (una exclusión vaciaba reglas de arquitectura), la corrección del contrato `VerificationResult` por autoridad superior, y D-28. No hay corrida material, ni corpus, ni participante. |

**Gate H6:** abierto **sólo por firmas**. Las 14 tareas están VERIFICADAS y **el AC está cubierto y
observado en verde en `main`**: `ci:mode-separation` (12 propiedades) y `ci:e2e:dry-session` (33: 26
en `session-engine`, 7 en `measurement-worker`), en el job propio
`ci:mode-separation · ci:e2e:dry-session` de la corrida **`32164277686`** sobre `5217680`, con los
siete jobs de esa corrida en verde. Va como job propio y no como paso de `base` porque §0.4 cuenta un
AC por **el check que cita**. Acta: [`../gates/H6.md`](../gates/H6.md).

La suite destapó **dos puertas laterales reales** y las cerró (D-35): se podía escribir dominio a
mano sin transferencia, y se podía **retirar** un reactivo del registro de consumo, que es la forma
en que un reactivo consumido reaparece. Detalle en
[`../session/dry-session.md`](../session/dry-session.md).

## F8 — H7 · Profesor IA de sesión (con LLM) (2 de 7 tareas)

| Tarea | Prioridad | Estado | Evidencia | Fecha | Notas |
|---|---|---|---|---|---|
| T-H7-01 | CRITICAL | BLOQUEADA | — | — | El bucle W7 con el binding ganador. Exige el ganador de BENCH-01 (`T-H4-10` material, sin autorizar) |
| T-H7-02 | CRITICAL | VERIFICADA | `packages/model-gateway/src/anchoring.ts`, `test/anchoring.test.ts` (21 pruebas), regla depcruise `pasarela-sin-nucleo-logico` con siembra, [`../session/anclaje.md`](../session/anclaje.md) | 2026-08-18 | **El validador local que P-II §8.4 exige, y no necesita proveedor**: recibe una salida candidata y unos fragmentos autorizados, y decide. Las cinco causas son cerradas y no se añadió ninguna; cada rechazo declara en `authority` la autoridad literal, como en `doubt.ts`. **La regla que ordena el diseño sale de I-7** —«sin ancla no introduce reglas»—: un símbolo o una regla ajenos al cálculo se rechazan **salvo que aparezcan en los fragmentos que el segmento ancla**; si el corpus lo dice, lo cita, y si no, lo introduce. Se llegó ahí **refutando el diseño anterior**: el primer detector marcaba cualquier mención de una regla prohibida, y con él el Profesor IA no habría podido decir «la conmutativa no está permitida», que es contenido correcto que el corpus enseña. Y resuelve el problema de fondo: distinguir «mencionar» de «ordenar» sobre prosa es indecidible; **lo decide el ancla**. El respaldo se toma **sólo de las anclas resueltas** y no del bloque entero —con el bloque, un segmento se apoyaría en un fragmento al que no ancló—, comprobado con siembra. **Tres cosas que el cálculo congelado desmintió antes de escribir**: `->`, `&`, `|`, `~`, `!` son alias **autorizados** (`CONNECTIVE_ALIASES`) y el primer diseño los rechazaba; `y`, `o`, `no` están en `REJECTED_CONNECTIVE_ALIASES` pero son palabras españolas y marcarlas habría rechazado casi cualquier frase; `FORBIDDEN_RULES_EXAMPLES` es lista congelada, así que detectarla es transcripción. **P-I §8.5 limita, no rechaza**: sin anclas ⇒ acompañamiento no factual registrado para auditoría; sin anclas **y** función `definition` ⇒ `withheld`, porque presentarlo *sería* introducir una definición sin ancla; y basta un segmento sin anclas para que `canGroundEvaluation` sea `false`, que es el lado que no califica. **Un canario aborta** con `CanaryHitError` como en `buildSessionContext`: es incidente de nivel 3 (§11.3), no una validación fallida. **El cálculo entra por parámetro** (D-39) y la frontera es ejecutable. **Lo que no decide y no finge decidir**: la whitelist cerrada de reglas se hace cumplir donde las reglas se aplican, en `logic-core` sobre una derivación, no sobre prosa. Ninguna salida de modelo real ha cruzado este validador: no hay binding ganador. **Verde en `main`**: corrida `32210920877` sobre `1db2195`, los **nueve jobs** en verde, incluido `ci:logic:mutation`. |
| T-H7-03 | CRITICAL | VERIFICADA | `packages/pedagogy-policy/src/non-revelation.ts` + `test/non-revelation.test.ts` (14), `packages/model-gateway/test/adversarial-session.test.ts` (13), `MissingEgressFilterError` y `scorableActivityOpen` en `session-context.ts`, job `ci:adversarial:session`, [`../session/no-revelacion.md`](../session/no-revelacion.md) | 2026-08-18 | **El agujero real que cerró:** el detector de canarios era un parámetro **opcional** de `buildSessionContext`, así que no pasarlo apagaba la comprobación sin decirlo, y «sin solución en contexto» quedaba sin comprobar justo donde §9.6 lo exige. **Y hubo segunda vuelta:** al añadir el campo obligatorio las 1639 pruebas **siguieron pasando**, porque los archivos de prueba no se typechequean y `undefined` es falsy — la garantía se apagaba sola. Con la comprobación **en ejecución** cayeron 11 pruebas, que era la señal de que el cambio hacía algo. Deuda confirmada: un tipo no protege a un llamador que nadie compila. **La puerta no recalcula nada: exige la evidencia.** Isomorfismo y «paso decisivo» ya están decididos en autoría con hash (`analogousExampleEvidence.nonIsomorphic`, `facts.containsDecisiveContent`); volver a decidirlos en vivo crearía una segunda autoridad sobre el mismo hecho, y cuando dos discrepan gana la que corre más tarde. Una pista de nivel 4 sin prueba de no isomorfismo no sale **no porque se demuestre que es isomorfa, sino porque nadie demostró que no lo es**: en una actividad puntuable la carga de la prueba va de ese lado. **La cuarta condición se deja acotada en su letra** —«cuando sea una sonda»— y no se extiende a toda actividad puntuable, con prueba de esa frontera; y fuera de una actividad puntuable §9.6 no gobierna, con control positivo que impide escribir la puerta de más. **La defensa contra injection del alumno es estructural**: la whitelist de §8.3 no tiene campo por el que entre texto libre, así que no hay que filtrar lo que no tiene por dónde entrar. Los puntos de §14.4 ya cubiertos en otros checks **no se duplican** y se dice dónde están. **No detecta paráfrasis** y no lo finge: hereda el alcance `literal_not_paraphrase` del banco, y la auditoría humana sigue siendo obligatoria. 27 pruebas, con siembra que comprueba que la puerta puede fallar. Ninguna sesión real ha cruzado estos mecanismos: no hay binding ganador. **Verde en `main`**: corrida `32212740958` sobre `644f08a`, **los diez jobs en verde**, incluido el job propio `ci:adversarial:session` y `ci:logic:mutation`. |
| T-H7-04 | REQUIRED | PENDIENTE | — | — | Ejecución lingüística de estrategias; vive dentro del bucle de `T-H7-01` |
| T-H7-05 | REQUIRED | PENDIENTE | — | — | Adaptación dentro de límites congelados; dentro del bucle |
| T-H7-06 | CRITICAL | PENDIENTE | — | — | Modo degradado en vivo; dentro del bucle |
| T-H7-07 | REQUIRED | PENDIENTE | — | — | Voz y pizarrón **no** en F8: Clase opera texto+Fitch. Ya lo hace cumplir el modelo de vista de `T-H6-13`, que lanza `CAPACIDAD_NO_IMPLEMENTADA` |

**Gate H7:** `docs/gates/H7.md` — no abierto. Su AC exige **una sesión local completa sin rescate
docente**, que necesita el binding ganador: no se alcanza escribiendo código.

## Fases siguientes

| Fase | Hito | Estado | Bloqueo actual |
|---|---|---|---|
| F3 | H3 · Entorno local | EN_CURSO | **5 de 5 tareas; `T-H3-01`, `T-H3-04` y `T-H3-05` VERIFICADAS.** Criterio técnico cubierto y observado en `main`. Falta la inicialización de Infisical y las firmas |
| F2 | H2 · cierre del gate | EN_CURSO | Las 16 tareas están HECHAS; falta la ejecución en `main` |
| F4 | H4 · Pasarela de modelo | EN_CURSO | **10 de 12 tareas + `T-H4-10` en curso.** Harness, piloto, conjunto material de 200 casos y capa de cómputo de gates construidos; gasto autorizado (D-40). **La corrida está bloqueada por corpus: dos de los seis gates no se pueden medir con `content/` en marcadores (D-45).** Falta además la revisión humana del conjunto (D-41). `T-H4-11` sigue bloqueada: exige dos proveedores, y ninguno vigente de OpenAI publica snapshot fechado (D-44) |
| F5 | H4.5 · Investigación de fuentes (W0) | EN_CURSO | **8 de 8 tareas HECHAS y gate H4.5 decidido (D-50): `corpus_autorizado` el 2026-08-19.** El propietario firmó la propuesta tal cual tras revisión asistida (snapshot re-verificado, licencia reconfirmada, 13 claims cotejados); corpus autorizado = forallx-yyc TFL únicamente; modal fuera (condicionado a permiso documentado de Trueman); OCW excluido (NC/SA aplazada). Decisión en `research/corpus-decision.yaml`. La ejecución en `authoring-worker` (jobs + BD) sigue pendiente |
| F6 | H5 · Ingesta, autoría y freeze (W1–W5) | EN_CURSO | 17 de 17 tareas con mecanismo implementado; **W1 ejecutado sobre el corpus real el 2026-08-20 (D-51): 77 fragmentos materializados en `source/`, `solutions/` reubicadas en `solutions-private/`, `kc/map.yaml` escrito con guarda de deriva; `T-H5-01` y `T-H5-03` VERIFICADAS (corrida `32424646954`, diez jobs en verde); **W2 ejecutado el 2026-08-21 (D-52): 43 elementos, 30 claims y 4 decisiones en `extracted/` y `provenance/`, cobertura KC 18/18**; **Rol B ejecutado el 2026-08-21 (D-53): secuencia, 18 objetivos observables y política pedagógica en `objectives/`, `pedagogy/` y `session-templates/`**; gate H5 abierto por freeze/auditoría y CAL-NLI materiales ausentes |
| F7 | H6 · Sesión determinista sin LLM | EN_CURSO | **14 de 14 tareas VERIFICADAS y AC del gate cubierto y observado** (CI `32164277686`). Sólo faltan las firmas del acta |
| F8 | H7 · Profesor IA de sesión | EN_CURSO | **2 de 7 tareas.** `T-H7-02` (anclaje) y `T-H7-03` (no revelación y suite adversarial) **VERIFICADAS**, las dos sin proveedor. Lo que queda vive en el bucle de `T-H7-01`, que exige el ganador de BENCH-01 |
| F9–F16 | — | PENDIENTE | Ver dependencias en `Plan.md` §9 |

## Entorno de ejecución (verificado 2026-08-14)

| Requisito | Estado |
|---|---|
| Node 24.x | ✅ v24.16.0 |
| pnpm 10.x | ✅ 10.34.5 (vía npm; `corepack enable` falla por permisos en `C:\Program Files\nodejs`) |
| git | ✅ 2.55.0 — remoto configurado el 15-08-2026 (dos repos privados en GitHub) |
| Docker Engine / Compose | ✅ 29.7.2, motor Linux, overlayfs (D-7: el plan declara familia 27.x) |
| WSL2 | ✅ versión predeterminada 2, distribución `docker-desktop` |
| Python | ⚠️ 3.12 (el plan pide 3.13.x; solo relevante en F16) |

### Nota operativa de Docker en Windows

Una consola abierta **antes** de instalar Docker conserva el `PATH` viejo y Testcontainers falla con
`spawn docker-credential-desktop ENOENT`. Basta con abrir una consola nueva, o anteponer
`C:\Program Files\Docker\Docker\resources\bin` al `PATH`.

## Correcciones por autoridad superior (17-08-2026)

| Contrato | Qué estaba mal | Corrección |
|---|---|---|
| `VerificationResult` (`packages/contracts`) | El contrato que gobierna el veredicto **no validaba la salida real del verificador**, y nadie lo había notado porque hasta `T-H6-13` nadie la había parseado contra él. Tres divergencias: (1) `authorizedCalculusVersion` y `verifierVersion` tipados como `VersionRef` —objeto— cuando el Maestro los fija como **cadena** (P-I §1 línea 213, `DEC-CALCULUS-001`), que es lo que emiten `logic-core` y `domain-engine`; (2) el contrato declaraba `trace`, que **nada emite**, mientras el verificador produce `detail`, así que Zod lo descartaba en silencio y el alumno se quedaba sin la explicación del error; (3) faltaba `goalReached`, presente en `logic-core` desde T-H2-06, sin el cual un cliente sólo ve `valid: true` y lo lee como «resolvió el ejercicio» — justo la confusión que D-9 separa | Se corrige el **contrato**, no la implementación: era el contrato el que contradecía al Maestro (§0.1). `authorizedCalculusVersion`/`verifierVersion` pasan a cadena, `trace` se renombra a `detail` y se añade `goalReached` opcional. `manifests.ts` y `freeze.ts` conservan `VersionRef` a propósito: ahí sí se referencia un artefacto con su hash. 19 JSON Schema reemitidos |

## Correcciones por autoridad superior (15-08-2026)

| Contrato | Qué estaba mal | Corrección |
|---|---|---|
| `ModelCapabilities` | P-II §8.4 dice que «batch y caching **son** capacidades explícitas de `ModelCapabilities`», y el contrato no tenía ninguno de los dos campos. La implementación contradecía al Maestro, así que se corrige la implementación (§0.1) | Se añaden `batch` y `caching` **obligatorios** —«explícitas, no optimizaciones transparentes»: un binding tiene que declarar si las tiene, y no declararlas no puede quedar a medio camino entre «no» y «no se preguntó»—, con `caching.ttlSeconds` opcional porque §8.4 dice «TTL **cuando se conozca**» y un cero por omisión afirmaría que no hay caché cuando lo cierto es que no se sabe. 19 JSON Schema reemitidos |

## Correcciones por autoridad superior (14-08-2026)

Al recibir el Maestro, los contratos escritos desde `Plan.md` se corrigieron contra el texto literal (§0.1: si el inferior contradice al superior, se corrige el inferior):

| Contrato | Qué estaba mal | Corrección |
|---|---|---|
| `EvidenceEvent` | Faltaban `schemaVersion`, `correlationId`, `runId`, `participantPseudoId`, `sessionId`, `causedByEventId`, `artifactRefs`, `traceId`, `occurredAtServer`; `decisionMaker` tenía 3 valores; `validity` usaba `missing` | Transcripción literal P-II §9.1: `decisionMaker` con 5 valores, `validity` = `valid|invalid|deviation`, `correctionOfEventId` |
| `PedagogicalDecision` | Enum de estrategias declarado «pendiente»; campos añadidos que pertenecen al estado de sesión | Literal P-II §7.2.1: 10 estrategias, 5 campos exactos |
| `Probe*` | `experimentalSet` como enum A/B/C, `phase` sin `retention`, `measureKind` con nombres inventados, sin `observation` | Literal P-II §6.3, con `probeRoundId` nulo y `observation` nulo (los faltantes no se imputan) |
| `AnchoredSegment` | `kind: factual/non_factual` inventado, anclas como objetos | Literal P-II §8.4: `text`, `anchors: string[]`, `function` de 4 valores |
| `Incident` | `incident_code` como catálogo pendiente | P-I §13: niveles 1/2/3 literales con acción obligatoria; `incident_code` se congela por corrida en el `run-manifest` |
| Veredictos | Faltaba el de autonomía; métricas sin contrato | Literal P-I §12.3 (4 veredictos) y §10.5 (contrato por métrica con numerador/denominador/faltantes) |

Consecuencia: **ya no queda ningún catálogo pendiente** (`pendingCatalogs()` devuelve vacío). El mecanismo `pendingCatalog()` se conserva para huecos futuros y su comportamiento fail-closed sigue probado.

## Decisiones de ingeniería de este plan (sin autoridad normativa, §0.2.8)

- **D-1 — Ubicación del CLI.** `tools/cli`, porque §4.2 fija listas obligatorias para `apps/` y `packages/` y el CLI no aparece en ninguna.
- **D-2 — Repositorio de contenido.** ~~Repo git independiente en `content/unidad-deduccion-natural/`; el registro como submódulo requiere un remoto.~~ **Cerrada el 15-08-2026**: `MEX-AmatsuMikaboshi/profe_ia_contenido` (privado), registrado en `.gitmodules`. El gitlink apunta a un commit que existe en ese remoto, condición sin la cual el checkout de CI falla. **Dos consecuencias que la segunda corrida en Actions destapó** (ver `T-H0-05`): CI necesita el secreto `CONTENT_TOKEN` —acción del propietario, como la cuenta de Infisical— porque `GITHUB_TOKEN` no alcanza a un segundo repositorio privado; y todo check que inspeccione **contenido** de `content/` debe ejecutarse dentro del submódulo, porque desde el padre solo se ve el gitlink. Lo segundo ya había convertido en vacío el check de reproducibilidad del conjunto dorado: cerrar D-2 no es neutral para los checks que cruzan esa frontera, y conviene revisarlo al añadir uno nuevo.
- **D-3 — Catálogos pendientes.** Mecanismo `pendingCatalog()` que rechaza todo valor; hoy sin usuarios.
- **D-4 — Tipos referenciados sin definir.** `VersionManifest` (P-II §9.1) y `StructuredItemPrompt` (P-II §6.3) se nombran en el Maestro sin definirse. Se implementan con la estructura mínima que su uso exige, marcadas en el código. No son `BLOCKED_BY_SPEC`: no hay decisión normativa faltante, solo un tipo auxiliar.
- **D-8 — `¬` y la ausencia de precedencia.** P-II §4.1.1 fija «sin precedencia **entre conectivos binarios**». El parser aplica `¬` a la unidad inmediatamente siguiente (átomo, `⊥` o fórmula entre corchetes), que es la convención de *forall x*. Así `¬A∧B` es `(¬A)∧B` sin ambigüedad, mientras que `A∧B∧C` sigue rechazándose con `E-SYN-PRECEDENCE`.
- **D-9 — `valid` y `goalReached` separados.** El contrato del verificador no tiene código de error para «derivación correcta de otra cosa», y la lista de códigos `E-*` es cerrada. En vez de inventar uno, `VerificationResult` expone `goalReached` aparte: `valid` dice que todo paso está autorizado y `goalReached` si se probó lo pedido. Quien decide la corrección del intento es el motor, con ambos datos.
- **D-6 — Nombre del rol de migraciones.** `Plan.md` T-H1-02 lo nombra `pg_owner_migrations`, pero PostgreSQL **reserva el prefijo `pg_`** y rechaza crear ese rol (lo mismo ocurrió con el superusuario `pg_admin` del arnés). El Maestro P-II §11.2 exige «un rol propietario/migración separado del uso ordinario» sin fijar nombre: se usa `owner_migrations`. Incompatibilidad demostrable y documentada (§3).
- **D-7 — Versión de Docker Engine.** El plan declara familia 27.x; el entorno instaló 29.7.2. No afecta la autoridad reproducible (`lockfile + SBOM + digests`); los digests de imagen se fijan en el freeze.
- **D-10 — Ubicación y definición del índice de complejidad.** P-I §7.6 nombra las medidas pero no
  las define, y §4.2 fija las listas obligatorias de `packages/`: el módulo no puede ser un paquete
  nuevo. Vive en `proof-search` —no en `logic-core`— porque consume telemetría de búsqueda
  (presupuesto, garantía de minimalidad, diversidad) que solo existe en la ruta de autoría, y así la
  ruta de verificación no lo importa. **Distancia estructural premisas↔conclusión**: diferencia
  simétrica de los multiconjuntos de subfórmulas (ocurrencias de la meta ausentes de las premisas más
  ocurrencias de las premisas ausentes de la meta). Es determinista y vale 0 cuando ambos lados
  coinciden; su peso dentro del índice es `[CALIBRATION CAL-09]` y la definición puede sustituirse
  cuando H5 fije la comparabilidad. **Cantidad de conectivos** se reporta por separado sobre el
  enunciado y sobre la solución, en vez de elegir un denominador por cuenta propia.
- **D-14 — Tablas de Better Auth con prefijo, dentro de `identity`.** P-II §9.2 fija siete esquemas
  exactos, así que la autenticación no puede tener el suyo. Y la biblioteca llama `account` a su
  tabla de credenciales, nombre que en este modelo ya significa otra cosa —la cuenta seudónima del
  participante—, así que sus seis tablas llevan prefijo `auth_`. Los nombres de columna van en
  camelCase entre comillas porque son el contrato de la biblioteca: sin comillas, PostgreSQL
  plegaría `createdAt` a `createdat` y la biblioteca no encontraría sus columnas. La conexión fija
  `search_path=identity` en vez de calificar cada tabla, que rompería su generador de consultas.
- **D-11 — Entrypoints mínimos de contenedor.** `T-H3-01` exige ocho servicios que arranquen y
  respondan a un healthcheck, pero las seis apps eran esqueletos que exportaban una constante. Cada
  una recibe un `src/main.ts` con lo mínimo: salud y logs estructurados. **No se adelanta lógica de
  fases posteriores**: `api` y `web` responden `NO_IMPLEMENTADO` a todo lo que no sea `/health`, y
  los workers declaran en su log de arranque qué fase los implementa. Un worker que dijera «listo»
  sin pipeline sería éxito simulado.
- **D-12 — Transporte del verificador por spool.** El verificador corre con `network_mode: none`
  (I-3), así que no puede recibir trabajo por HTTP ni por la cola. Entra un `.json` con la
  derivación en `/spool/in` y sale el veredicto en `/spool/out`. Es el único transporte compatible
  con «función pura sin red» que además permite ejecutarlo masivamente (T-H2-15).
- **D-13 — Servicios de compose no listados en el plan.** `T-H3-01` enumera ocho servicios;
  el compose levanta dos más. `redis` es dependencia de Infisical, que sí está en la lista.
  `otel-collector` lo exige `T-H3-05`, que pide un colector local. Ninguno amplía la superficie
  funcional: ambos viven en la red interna, sin salida ni puerto publicado.
- **D-15 — El reparto operación↔perfil es dato, no tabla en el código.** P-II §8.2 enumera las once
  operaciones y exige que autoría y sesión usen «perfiles y credenciales separadas», pero **ninguna
  autoridad tabula qué operación corre bajo qué perfil**, y el reparto no es evidente: `create_` y
  `critique_authoring_candidate` son inequívocamente de autoría, pero `draft_worked_example` o
  `draft_feedback` los puede consumir tanto la sesión como el canal de autoría de W1–W5. Cablearlo
  decidiría por cuenta propia qué credencial toca cada llamada, es decir, movería una frontera de
  seguridad con una suposición. Así que cada binding **declara** las operaciones que sirve al
  registrarse y la pasarela rechaza toda operación no declarada, sin valor por omisión: hay prueba de
  que una pasarela sin operaciones declaradas no sirve ninguna de las once. No es `BLOCKED_BY_SPEC`
  —no falta una decisión normativa, falta un mapeo auxiliar— y ese registro es el punto donde se
  enchufa cuando F6 defina el canal de autoría. Dos bindings que declaren la misma operación son un
  fallo (`AmbiguousBindingError`), no un empate que gane el primero.
- **D-16 — Umbral de alerta de gasto, y el hueco de rearme tras la revisión.** El Maestro fija dos
  cifras literales —objetivo ordinario ≈ MXN 500/mes y umbral duro de MXN 700— pero dice «alerta al
  **acercarse** al objetivo» sin cuantificar cuánto es acercarse. Elegir aquí un 80 % fijaría por
  cuenta propia cuándo se avisa al propietario, así que el umbral de alerta es **parámetro
  obligatorio sin valor por omisión**, y se rechaza si supera al umbral duro (avisar después de
  bloquear es no avisar). «Superar» los 700 se lee estrictamente: en 700 exactos todavía no se
  superó, y endurecer ese borde sería apretar una cifra literal por cuenta propia.
  **Hueco declarado, no resuelto:** el texto dice que el bloqueo dura «hasta registro de revisión
  explícita del propietario», y ninguna autoridad define si el bloqueo **vuelve a armarse** tras esa
  revisión ni con qué acumulado. Se implementa la lectura literal —una revisión registrada levanta el
  bloqueo— y la revisión guarda `reviewedUpToMxn`, de modo que el dato para una política de rearme ya
  queda registrado cuando el propietario la fije. Se deja visible aquí en vez de inventar la política:
  una regla de rearme fabricada gobernaría gasto real.
- **D-17 — Derivación del `fragment_id` estable.** P-III §3.3 exige que cada fragmento tenga «ID
  estable» pero no fija su forma, igual que P-I §7.6 nombraba medidas sin definirlas (D-10). Se
  deriva de la terna que identifica al fragmento —`componente@version#ubicación`— en vez de asignarse
  por contador, porque un correlativo cambia al insertar o reordenar secciones y eso es exactamente
  lo que «estable» excluye; hay prueba de ese modo de fallo. Se expone como función pública
  (`fragmentId()`) para que W2 recalcule el ancla sin preguntarle a W1: un ID que solo W1 supiera
  construir no sería un ancla, sería un identificador interno. El hash va en campo aparte porque §3.3
  lo enumera aparte: el ID identifica la posición, el hash identifica el contenido, y confundirlos
  haría que corregir una errata cambiara todas las referencias.
- **D-18 — Las validaciones de bloqueo del corpus exigen declaración explícita, sin valor por
  omisión.** Tres de las seis validaciones de P-III §3.2 necesitan un dato que la norma da por
  supuesto: contra qué KC se mide cobertura, qué secciones son necesarias y cuál es la familia de
  notación autorizada. Con lista vacía, las tres pasarían **por vacío** —el corpus parecería cubrirlo
  todo, no faltaría ninguna sección y ninguna notación sería incompatible—, así que `ingestCorpus`
  las rechaza en vez de aceptarlas como «nada que comprobar». Es el mismo criterio que ya costó dos
  hallazgos: el check del conjunto dorado y la prueba que comparaba un objeto consigo mismo. La
  incompatibilidad de notación se hace ejecutable exigiendo por componente divergente una aclaración
  de **convención alternativa** —la clase que W0 ya tiene (`T-H45-03`)—: una diferencia clasificada
  no es una incompatibilidad, una sin aclarar sí, que es la lectura literal de «contradictorias sin
  aclaración» aplicada a la notación.
- **D-19 — `restrictions` no tiene fichero propio en `extracted/`.** `Plan.md` T-H5-02 enumera cinco
  salidas de Rol A —claims, definiciones, reglas, notación y **restricciones**— pero el árbol de
  P-II §3.2 es **estructura obligatoria** y `extracted/` tiene exactamente cuatro ficheros:
  `definitions.yaml`, `notation.yaml`, `rules.yaml` y `claims.yaml`. Crear un quinto violaría una
  estructura que el Maestro fija, y el Maestro está por encima del plan (§0.1), así que la sección
  existe como categoría del esquema cerrado en memoria y se serializa junto a `rules.yaml`, que es
  donde encaja: una restricción es una condición de aplicación de una regla. Se registra aquí para
  que la serialización de `T-H5-13`/`T-H5-15` no invente el quinto fichero al encontrarse la quinta
  categoría.
- **D-20 — Dos reservas comparten directorio, y se dice en vez de taparse.** P-I §7.7 enumera
  **diez** reservas sin solapamiento; el árbol obligatorio de P-II §3.2 da **nueve** directorios bajo
  `items/`, porque `TRANSFER_MASTERY` y `TRANSFER_MEASUREMENT` caen las dos en `items/transfer/`. El
  árbol es estructura obligatoria y el Maestro está por encima del plan (§0.1), así que **no se crea
  un décimo directorio** —el mismo criterio que dejó `restrictions` sin fichero propio (D-19)—. Lo
  que se hace es declararlo: `physicallySeparable()` devuelve `false` justo para esas dos,
  `reservesSharingDirectory()` las **deriva** de la tabla en vez de listarlas aparte —copiada,
  envejecería sin que nada lo notara— y el informe de separación trae siempre
  `notSeparatedByDirectory`, incluso vacío, porque omitirlo se leería como que la separación física
  quedó completa. Devolver `true` para las diez habría sido la afirmación cómoda: diría que la
  separación está resuelta justo donde el árbol no la resuelve, y `T-H5-06` heredaría una garantía
  inexistente. **Cerrada por `T-H5-06`**: esas dos se separan por la disjunción semántica —id,
  duplicado trivial, isomorfismo y superficie—, que no depende del directorio.
- **D-21 — La reserva de reposición se declara, no se infiere.** P-I §13.2 dice que una reposición
  «usa reserva independiente» y P-II §6.1 da a `measurement-worker` autoridad sobre «la reposición
  desde reserva cuando la regla lo permita», pero **ninguna autoridad dice si el banco de reposición
  es de enseñanza o de medición**, y de eso depende si le aplica la disjunción por isomorfismo.
  Suponerlo de enseñanza dejaría entrar una reposición isomorfa a una sonda; suponerlo de medición
  prohibiría reposiciones legítimas de práctica. Se resuelve como los demás mapeos que ninguna
  autoridad da (D-15, D-16, D-18): **es dato y se exige declarado**. Un reactivo en `replacement`
  declara `replacesReserve` y hereda su clasificación; sin declararlo, `effectiveReserve()` lanza. Y
  `collisionProhibited()` **lanza** si se le pregunta por `replacement` sin resolver, en vez de
  responder `false`: un `false` ahí dejaría pasar en silencio exactamente el caso que la declaración
  existe para decidir.
- **D-22 — Qué cuenta como «oportunidad operativa» de un KC.** P-III §4.2 y P-I §7.8 fijan el piso de
  **seis** sin enumerar de qué reservas salen. La lectura implementada es: cuenta lo que **no** es de
  medición. El motivo es de la propia norma y no una preferencia: §10.3 separa enseñanza de medición
  y exige «sin reutilización» en las sondas, así que una sonda no es una oportunidad de practicar el
  KC sino la medida de si se aprendió; contarlas dejaría que un KC llegara al piso **gastando el
  material con el que después se le mide**. Por el mismo camino, el piso de transferencia por KC solo
  admite `TRANSFER_MASTERY`: §5.11 reserva `TRANSFER_MEASUREMENT` para la medida experimental y §5.3
  exige una transferencia cercana **elegible** para declarar dominio, así que contar la de medición
  dejaría el piso cubierto y el dominio inalcanzable. Queda registrado como lectura, no como
  literal, para que se vea si alguna vez se demuestra equivocado.
- **D-23 — Siete días calendario desde un timestamp zonificado.** Los contratos de sesión expresan
  `set_mastery_timestamp` como ISO 8601 con zona y ninguna autoridad fija otra zona civil para el
  calendario. El scheduler suma siete fechas UTC con `setUTCDate(+7)` y conserva la hora, lo que
  evita que la zona del host o un cambio de horario estacional alteren la corrida. Es una
  interpretación operativa determinista —no una calibración científica— y el freeze material puede
  ligar otra política versionada antes de abrir la corrida si la autoridad llega a especificarla.
- **D-24 — Dos relojes, dos autoridades y ningún tiempo inventado.** El tiempo interno del reactivo
  pertenece a `measurement-worker` y se deriva de `selectedAt + timeLimitSeconds` del inventario
  congelado. El tiempo máximo de sesión pertenece al motor (§7.2): su evento aporta
  `sessionDeadlineAt`, y el worker únicamente comprueba que venció y lo registra en el efecto. No se
  copia el presupuesto de sesión a una segunda política ni se acepta un `timeout` temprano. Un
  incidente sistémico usa el `validityEffect=invalidate_run` declarado en la taxonomía congelada y
  por eso no convierte parciales previos en observación primaria; los fixtures sólo prueban el
  mecanismo y no crean taxonomía material.
- **D-25 — `dist/` deja de excluirse del grafo de dependency-cruiser.** `exclude` no sólo deja de
  recorrer un módulo: lo borra del grafo, también como **destino** de dependencia. Los paquetes del
  workspace resuelven por `exports` a `dist/`, así que con `/dist/` excluido toda dependencia
  **declarada** entre paquetes desaparecía y con ella la regla que la vigilaba: `web-sin-soluciones`
  y `web-sin-claves-ni-gateway` sólo disparaban porque esos paquetes no estaban en el `package.json`
  de `apps/web`, y bastaba declarar uno para que el control pasara por vacío sin que nada lo dijera.
  Se descubrió en T-H6-13 al sembrar `apps/web → @profesor-ia/logic-core` con la dependencia ya
  declarada: la violación no se detectaba. Con `dist` dentro el árbol sigue limpio (394 módulos, 827
  dependencias) y las reglas aplican a lo declarado. Coste asumido: un `__arch_probe*` compilado de
  una siembra anterior ensucia el recorrido, así que `verify-depcruise-catches.mjs` lo retira antes y
  después. `.next/` y `next-env.d.ts` **sí** se excluyen, y no es la misma decisión: son salida
  generada que nadie importa, así que excluirlos no borra ninguna arista real.
- **D-26 — Las reglas de arquitectura llevan control positivo.** `verify-depcruise-catches.mjs`
  comprobaba sólo que cada regla **detecta** una violación sembrada. Desde T-H6-13 comprueba también
  que **deja pasar** lo permitido —`apps/web`/`apps/api` importando `@profesor-ia/logic-core/syntax`—,
  porque una regla escrita de más deja el árbol verde por la razón equivocada y nadie lo notaría. Es
  el mismo motivo por el que la suite negativa de privilegios lleva pruebas de que cada concesión sí
  funciona.
- **D-27 — El editor Fitch no puede alcanzar el verificador, y tampoco el orquestador.** La regla
  `sin-verificador-fuera-del-verificador` prohíbe a `apps/web` y `apps/api` el barrel de
  `logic-core`; ambos entran sólo por el subpath `./syntax` (tokenizador, parser, AST, errores,
  `analyzeStructure`). En el cliente, porque P-I §8.9 exige que la validación local **no** sea
  autoritativa y un segundo `verify()` haría que la ruta de verificación dejara de ser única. En
  `apps/api`, porque verificar en línea sería un verificador fuera del contenedor sin red y saltaría
  el spool (D-12, I-3). Escribir una segunda gramática en el cliente se descartó por lo contrario:
  separaría el editor del cálculo congelado y el desajuste llegaría al alumno como un rechazo
  inexplicable del servidor.
- **D-28 — Registro de excepciones de licencia en lugar de ampliar la política.** `ci:supply:sbom`
  decía «requieren revisión registrada» y no tenía dónde registrarla: el único camino era añadir la
  licencia a `ALLOWED_LICENSES`, lo que autorizaría de paso cualquier dependencia futura con esa
  misma licencia. Ahora hay `REGISTERED_LICENSE_EXCEPTIONS`, por paquete y licencia **exactos**, con
  tarea y motivo, que se imprime en cada corrida —una excepción silenciosa es indistinguible de una
  licencia permitida— y **falla si conserva una excepción que ya no aplica**, para que el registro no
  autorice por inercia. Primera y única entrada: `@fontsource/archivo` (OFL-1.1), T-H6-13.
- **D-29 — `apps/web` no compila a `dist/`.** Es una app, no una biblioteca: Next posee su build
  (`next build` vía `scripts/web/build.mjs`, que apaga la telemetría explícitamente porque un envío
  a un endpoint externo durante una corrida contradice local-first) y el `typecheck` sigue siendo
  `tsc --noEmit`. Su `tsconfig` sobrescribe `module`/`moduleResolution`/`jsx` de la base porque Next
  resuelve con bundler, y **conserva** `strict`, `exactOptionalPropertyTypes`,
  `noUncheckedIndexedAccess` y `verbatimModuleSyntax`. Consecuencia: dentro de `apps/web` las
  importaciones relativas van **sin** extensión `.js` —el resolvedor de Next no mapea `.js` a
  `.tsx`—, al revés que en el resto del repo, que es NodeNext.
- **D-30 — `sharp` fuera del árbol en vez de una excepción de licencia.** Next declara `sharp`
  como dependencia opcional para optimizar imágenes, y arrastra `@img/sharp-libvips-*` bajo
  **LGPL-3.0-or-later**, fuera de la política conservadora. No se le registró excepción porque
  `apps/web` **no usa `next/image` en ningún sitio**: asumir las obligaciones de una copyleft a
  cambio de nada es peor negocio que quitarla. Se excluye con
  `pnpm.ignoredOptionalDependencies` —337 líneas menos de lockfile— y `next.config.mjs` declara
  `images: { unoptimized: true }` para que el apagado sea explícito y no un fallback en runtime.
  **Lo que este episodio enseña vale más que la decisión:** el control de licencias es
  **dependiente de plataforma**. En Windows la variante Linux ni se instala, así que
  `ci:supply:sbom` pasaba en local y fallaba en CI. Un verde local de ese check no dice nada del
  verde en Linux; el único juez es la corrida de CI.
- **D-31 — Arranque de Docker Desktop por script en vez de a mano.** En esta máquina Docker Desktop
  **no arranca dos veces seguidas**: sus sockets AF_UNIX quedan en disco como reparse points de cero
  bytes que Windows luego no deja borrar ni consultar (error 1920, `ERROR_CANT_ACCESS_FILE`), y el
  `remove` previo al rebind tumba el backend. Crear los sockets sí funciona; sólo falla borrarlos,
  así que cada arranque siembra el fallo del siguiente. `scripts/dev/docker-desktop.mjs`
  (`pnpm run dev:docker`) vacía **los dos** directorios implicados —`%LOCALAPPDATA%\Docker\run` y
  `%LOCALAPPDATA%\docker-secrets-engine`, limpiar sólo el primero mueve el fallo al `Secrets
  Engine`— y luego lanza Docker esperando al motor. Es el mismo criterio de D-1 sobre el `PATH` de
  Docker: una trampa conocida del entorno se resuelve en el script, no en la documentación con la
  esperanza de que se lea. **Consecuencia de operación:** arrancar Docker desde el icono sigue
  fallando; el camino es el script. **No es una tarea `T-*`** y no altera ningún AC: desbloquea
  ejecutar en local lo que ya pasaba en CI (`ci:db:negative`, 131 en verde). Lo que no explica es
  **por qué** esos reparse points quedan inaccesibles: diagnosticarlo exige elevación que no se
  tuvo, así que evita la causa sin entenderla, y eso queda dicho en vez de disimulado.
  Corrida observada: CI `32108984268`, seis jobs en verde.
- **D-32 — Harness de BENCH-01 en `tools/bench`, no en `analysis/`.** `Plan.md` T-H4-10 dice
  «harness en `analysis/`», pero `analysis/` es **Python + Jupyter sobre exportaciones
  seudonimizadas** (su propio README) y **no es workspace de pnpm**, así que un harness TypeScript
  que importe `@profesor-ia/model-gateway` no puede vivir ahí. Se aplica el mismo criterio de D-1:
  las listas obligatorias son las de `apps/` y `packages/` (P-II §3.1), y `tools/` es donde va lo
  que no aparece en ninguna. Los **reportes sí salen a `analysis/reports/`**, que es lo que esa
  carpeta sí es: el sitio donde se analiza, no donde se ejecuta.
- **D-33 — Manifiesto de precios en MXN con tipo de cambio declarado.** El gate de presupuesto
  (T-H4-07) agrega **por moneda y no convierte**; los proveedores facturan en USD. Con un
  manifiesto en USD la cubeta MXN se queda en cero y **el bloqueo duro de MXN 700 no observa nada**:
  un freno desconectado. No es un bug —hay una prueba que lo afirma como comportamiento esperado—,
  es una costura que ninguna autoridad resuelve: el Maestro congela cifras en MXN y nadie dijo cómo
  se encuentran con el USD. **Decisión del propietario (2026-08-18):** registrar en MXN convirtiendo
  con el FIX de Banxico declarado con fuente y fecha, en vez de dejar el gate ciego o endurecerlo
  por cuenta propia. Los precios en MXN son **derivados en código** desde los dos factores
  publicados —precio en USD del proveedor y FIX—, para que ninguna cifra del archivo carezca de
  fuente contrastable. El `pricingManifestId` lleva el FIX aplicado: mismos precios con otro tipo
  de cambio son otro manifiesto.
- **D-34 — `codeFence` explícito en `validateModelOutput`.** Medido en el piloto del 2026-08-18:
  `claude-haiku-4-5-20251001` devolvió JSON **válido** envuelto en ```` ```json ```` en **14 de 14**
  casos, y reforzar la instrucción de formato no lo corrigió. Sin autorizar el desenvuelto, el gate
  de salidas estructuralmente utilizables medía el envoltorio y no al modelo — habría anotado 0 %
  cuando el contenido era correcto. Se añade una política **obligatoria y sin valor por omisión**
  (`reject` | `unwrap`), siguiendo el patrón de `caseInsensitive` en `canonicalizeEnum`: P-II §8.4
  admite normalizar «cuando el contrato lo autorice», así que la autorización se escribe en el sitio
  que llama. Se descartaron el *prefill* de Anthropic y el uso de herramientas: los dos cambian
  `buildRequest`, son específicos de un proveedor, y el prefill obliga al adaptador a **componer**
  parte de la salida. El desenvuelto es conservador —sólo si el texto empieza y termina con la
  valla— y el bruto del `envelope` conserva la valla: desenvolver es para poder parsear, no para
  reescribir lo que el proveedor dijo.
- **D-35 — Los dos invariantes que faltaban para el AC del gate H6, cada uno en su capa.**
  `ci:e2e:dry-session` atacó las cinco propiedades de §F7 **por la vía genérica** y no por el camino
  previsto, y dos no se sostenían. (1) **Dominio sin transferencia:** `updateSessionProjection()`
  acepta `operationalMastery` completo, así que se podía escribir `mastered: true` con
  `nearTransferSatisfied: false` sin pasar por `domain-engine` — y esa proyección **es** la que la
  bitácora registra como evidencia de dominio, así que un falso dominio escrito ahí queda en el
  ledger indistinguible de uno real. Se cierra en el **esquema** (`OperationalMastery`), que es donde
  este repositorio pone los invariantes de estado: una guarda por función protege la función que
  alguien se acordó de proteger; el esquema protege todo camino, incluidos los que no existen aún.
  El invariante se intentó refutar antes de escribirlo, y el intento acotó su forma: tras declarar
  dominio, un intento elegible incorrecto **vacía la racha** y `masteryStatus` sigue en `mastered`,
  así que `mastered: true` con racha 0 es un estado autoritativo legítimo y exigir un mínimo de
  racha habría roto la proyección real —además de duplicar `correctConsecutiveRequired`, que es
  política de dominio y tiene un solo sitio. (2) **Reactivo consumido:** la reaparición no se
  consigue volviendo a consumir —`uniqueArray` lo impide— sino **retirando** el id de
  `consumedActivityIds`, con lo que el reactivo vuelve a estar disponible y nada lo delata. Es un
  invariante de **transición**, no de estado —un estado suelto con el registro corto es válido—, así
  que no cabe en el esquema y va en el **reductor**, no en el ayudante: con la guarda sólo en
  `updateSessionProjection()`, un evento forjado pasaría el replay y reconstruiría un estado que
  nadie pudo escribir. Las cuatro pruebas correspondientes se comprobaron como **controles
  positivos**: con las dos guardas retiradas caen las cuatro, y hubo que endurecer dos de ellas
  porque pasaban por `STATE_HASH_MISMATCH` —es decir, por vacío— antes de llegar al invariante.
  Código nuevo de error: `INVALID_PROJECTION`.
- **D-36 — `tools/observability` en vez de un paquete nuevo.** La lista de `packages/` es obligatoria
  (P-II §3.1) y no contempla observabilidad, así que el arranque compartido de OTel va a `tools/`,
  con el mismo criterio de D-1 (CLI) y D-32 (harness de benchmark). **No podía ir en `contracts`**,
  que era el otro sitio compartido: de `contracts` depende `logic-core`, así que un exportador OTLP
  —un cliente HTTP— habría llegado solo a la ruta de verificación y roto I-3.
- **D-37 — El exportador `debug` del colector va en `detailed`, no en `normal`.** La justificación
  que traía la tarea era que `normal` no imprime atributos: **es falsa** en el colector 0.115.1, los
  imprime. Lo que `normal` no imprime es todo lo demás que el colector recibió —atributos de
  recurso, eventos de span, enlaces—, y el control de fuga de `ci:infra:otel` no es una afirmación
  sobre los atributos sino sobre **todo lo que llegó**. Se decidió con un experimento, no con el
  argumento: sembrada una fuga en `service.version`, con `detailed` el check la caza y con `normal`
  no aparece en la salida —`Resource attributes` no se imprime en absoluto—, así que el control
  habría pasado sin haber mirado ahí. El costo es local y nulo. Lo descartado fue tener dos
  configuraciones, una de desarrollo y otra para el check: comprobaría una que nadie corre.
- **D-38 — El contenedor de `web` sirve la aplicación de Next, y su `command` se fija en el compose.**
  Hasta `T-H6-13` el entrypoint era `apps/web/src/main.ts`, un servidor de `node:http` con `/health` y
  `NO_IMPLEMENTADO`. Ese commit pasó `apps/web` a construir con Next y su `tsconfig` a `noEmit`, así
  que `dist/main.js` **dejó de producirse** y el `CMD` de la imagen apuntaba a un archivo inexistente:
  `web` no arrancaba en una imagen limpia y `ci:infra:compose-up` llevaba días en rojo sin que nadie
  lo viera, porque en la máquina del propietario `apps/web/dist/` seguía existiendo como resto sin
  versionar de la etapa anterior. **La lección no es el arreglo: es que un artefacto sin versionar en
  el árbol de trabajo puede tapar una regresión indefinidamente.**
  Se descartó restaurar el servidor mínimo: con la vista de Clase ya construida, servir un
  `NO_IMPLEMENTADO` para todo sería anunciar que no hay interfaz cuando sí la hay. El
  `NO_IMPLEMENTADO` de D-11 lo da hoy el catch-all `[...ruta]`, que es la superficie real, y se
  comprobó sirviendo las tres rutas desde el contenedor.
  El `CMD` compartido de la imagen (`node apps/$APP/dist/main.js`) sigue valiendo para los otros cinco
  servicios y se sustituye **desde el compose**, que es donde este repositorio pone la frontera entre
  servicios —red, montajes, secretos— y no en el sistema de archivos de la imagen; lo dice el propio
  Dockerfile. `src/main.ts` se retira en vez de quedarse muerto: un entrypoint que ya no es el
  entrypoint es exactamente lo que hizo falta una hora para descubrir.
  Dos detalles que costaron encontrarse: `next start` **también** manda telemetría, así que
  `NEXT_TELEMETRY_DISABLED` va en el entorno del servicio y no sólo en el script de build —`web` está
  en `edge` y sí tendría por dónde salir—; y con `-H 0.0.0.0` Next escucha **sólo en IPv4**, mientras
  que dentro del contenedor `localhost` resuelve primero a `::1`: el healthcheck daba «Connection
  refused» con el servicio respondiendo perfectamente desde el host. Por eso el healthcheck usa
  `127.0.0.1`. El `main.ts` anterior no lo notaba porque `server.listen(PORT)` sin host liga las dos
  familias.
- **D-39 — El cálculo congelado entra al validador de anclaje por parámetro, no por import.**
  `T-H7-02` tiene que comparar la salida del modelo contra el cálculo, y lo natural sería importar
  `logic-core` en `model-gateway`. No se hizo: eso pondría `verify()` dentro del único paquete del
  repositorio que abre conexiones a un proveedor, y desde ahí la pasarela podría acabar dictaminando
  sobre una derivación sin pasar por el contenedor sin red (I-3, D-12). El conjunto congelado entra
  como `AuthorizedCalculus`, con el mismo patrón de inyección que ya usaba el detector de canarios en
  `buildSessionContext`. La frontera es ejecutable: regla `pasarela-sin-nucleo-logico`, con violación
  sembrada comprobada. Y para que lo inyectado no se quede viejo, `logic-core` entra como
  **devDependency** y una prueba de correspondencia comprueba contra el tokenizador que cada símbolo
  aceptado es tokenizable y cada símbolo rechazado dispara `E-SYN-SYMBOL`. **Ojo con el hueco
  conocido:** `depcruise` excluye los `*.test.ts`, así que esa dependencia de prueba la regla no la
  ve. Es deliberado —la prueba necesita importarlo— pero la regla protege `src/`, no el árbol entero.
- **D-40 — Gasto de la corrida material de BENCH-01 autorizado (2026-08-19): USD 3.64.** Cifra
  medida sobre tokens reales del piloto, no estimada; la estimación previa era cuatro veces alta.
  **Se registra porque la autorización no desbloquea la corrida:** siguen faltando los 200 casos
  escritos a mano —el piso de P-III §6.1, derivado y no elegido— y los cuatro puntos del piloto, dos
  de los cuales son defectos de diseño reales: los 20 casos de `failure_or_invalid_output` piden al
  modelo que devuelva basura en vez de inyectar el fallo en el transporte, y `entregaSolucion` lo
  autoreporta el modelo, así que un modelo que filtrara la derivación y contestara `false` pasaría el
  gate de fugas. Lo segundo ya tiene con qué arreglarse: `T-H7-02` construyó el validador que
  inspecciona el texto y `T-H7-03` la puerta de no revelación. Explicación en llano en
  `HANDOFF.md` §3.3.
- **D-41 — El conjunto material de 200 casos de BENCH-01 lo redactó el modelo asistente**, por
  instrucción expresa del propietario del 2026-08-18. `HANDOFF.md` §3.3 pedía que lo escribiera una
  persona; **esa exigencia es prosa de bitácora, no norma**: P-III §6.1 fija los pisos por familia,
  la partición por semilla registrada y el congelado del plan, y no dice quién redacta. Se registra
  igualmente porque introduce un sesgo real que ninguna prueba puede medir: **entre los candidatos de
  BENCH-01 hay modelos de la misma familia que el que redactó**, y un examen escrito por un pariente
  del examinado puede favorecerlo sistemáticamente. Tres cosas lo acotan y ninguna lo elimina. (1)
  Nada se redactó por intuición: la familia de clasificación **barre uno a uno los dieciocho códigos
  `E-*`** de `VERIFICATION_ERROR_CODES` y la de explicación **barre los dieciocho KC** de
  `KC_CATALOG`, que son listas cerradas y congeladas. (2) Las expectativas se declaran en el archivo,
  antes de que exista una sola respuesta. (3) P-III §6.2 ya exige auditoría humana en muestra ciega.
  **Consecuencia operativa: la revisión humana del conjunto es condición previa a coronar un
  ganador**, y queda anotada como tal, no como mejora opcional.
- **D-42 — La caída simulada se inyecta en el transporte y el runner falla cerrado sin inyector.**
  Corrige el defecto (c) del piloto. La familia `failure_or_invalid_output` ya no le pide al modelo
  que devuelva basura —eso medía su obediencia, no la recuperación del sistema— sino que declara un
  `InjectedFault` como **dato del caso**, y el runner lo desvía a una pasarela que lo produce por
  debajo, de modo que se ejerciten las rutas reales: traducción del adaptador, clasificación y
  reintento único. Tres decisiones lo ordenan. (1) **La fábrica de la pasarela con fallo la aporta
  quien arma el candidato, no el runner**: sintetizar una respuesta con forma de caída exige saber la
  forma de la respuesta de *ese* proveedor, y esa es una segunda copia del contrato del proveedor que
  se quedaría vieja. (2) **`transport_failure` no se mete en `ModelOutputClassification`**: ese enum
  cerrado clasifica lo que el proveedor respondió, y una conexión cortada es justo el caso en que no
  respondió; queda como miembro local de la herramienta y `CaseOutcome.classification` es opcional en
  vez de rellenarse con `provider_error`, que escondería la causa detrás de la consecuencia. (3)
  **`usage` queda ausente y no en ceros** en esos casos: el propio runner rechaza un `usage` ausente
  porque un cero fabricado abarata la corrida, y fabricarlo aquí sería cometer ese error desde
  dentro. El freno es `assertFaultInjectorsAvailable()`, **antes de la primera llamada**: una corrida
  con caídas declaradas y sin quien las produzca mediría respuestas normales y daría por aprobado un
  gate de 100 % y bloqueante sin haber simulado una sola caída. Comprobado con dos siembras, las dos
  verificadas en el archivo antes de correr.
- **D-43 — `entregaSolucion` desaparece de las instrucciones de la corrida material.** Corrige el
  defecto (d) del piloto. El gate de fugas es de cero fallos y bloqueante, y se apoyaba en que el
  propio modelo declarara si su respuesta contenía una derivación completa: un modelo que filtrara y
  contestara `false` lo habría pasado. **`fueraDeAlcance` se queda, y la diferencia no es un
  descuido**: declarar que una pregunta cae fuera del corpus *es* la conducta que §6.2 mide
  («declaradas o contenidas»), o sea el dicho del modelo no es un informe sobre su conducta sino la
  conducta; `entregaSolucion` sí era un informe, y sobre el único hecho que el modelo tendría motivo
  para reportar mal. **Lo que queda pendiente y no se finge hecho:** la inspección del texto que
  sustituye al autoinforme —`T-H7-02` y `T-H7-03` ya la construyeron— todavía no está conectada al
  cómputo de gates, porque **no existe capa que derive `GateObservation` desde `RunResult`**.
- **D-44 — Ningún modelo vigente de OpenAI publica snapshot fechado (comprobado 2026-08-18).** Los
  cuatro de la familia 5.6 —`gpt-5.6-sol`, `-terra`, `-luna`, `-cyber`— listan como único
  identificador su propio id sin fecha, y OpenAI **no declara** que un id sin fecha sea un snapshot
  fijado. Los únicos snapshots fechados que publicó —`gpt-5-2025-08-07`, `gpt-5-mini-2025-08-07`,
  `gpt-5-nano-2025-08-07`, `gpt-5-pro-2025-10-06`, `o3-2025-04-16`, `o3-pro-2025-06-10`— están
  deprecados desde el 2026-06-11 con retiro el **2026-12-11**. **Anthropic sí lo resuelve, y mejor de
  lo que el piloto suponía**: documenta que «cada id de modelo de Claude identifica una versión
  fijada» y que desde la generación 4.6 el id **sin fecha también es un snapshot fijado**, no un
  puntero perenne. Con eso, `claude-sonnet-5` (retiro no antes del 2027-06-30) y `claude-opus-5`
  (2027-07-24) son identidades fijadas sin la fecha de apagado cercana de `claude-haiku-4-5-20251001`
  (2026-10-15), y el hallazgo (b) del piloto se disuelve eligiendo otro candidato de la misma familia.
  **Para el lado de OpenAI la salida no es saltarse la regla:** P-II §8.1 ya admite **huella de
  comportamiento sobre el set canario congelado** como alternativa al snapshot, y `assertPinnedIdentity`
  la acepta. El propietario autorizó el 2026-08-18 usar el mejor calidad-precio aunque no publique
  snapshot fechado; esa autorización se ejecuta **produciendo la huella**, no omitiendo la
  comprobación, porque omitirla dejaría la corrida sin reproducibilidad y no hay autoridad que lo
  permita.
- **D-45 — La capa de cómputo de gates existe, y al construirla apareció que dos de los seis gates
  de BENCH-01 no se pueden medir sin corpus.** `scoring.ts` deriva `GateObservation` desde
  `RunResult` y produce el dictamen; los denominadores salen del **plan congelado** (conjunto ×
  repeticiones) y no de lo observado, porque deducirlos de lo observado deja que un caso perdido
  encoja el denominador y suba la tasa. **La evidencia se inyecta y es obligatoria**: cada gate
  recibe su sonda, y una sonda ausente **lanza** en vez de contarse como «sin fallos» — dos de los
  gates son de cero fallos y bloqueantes, así que una sonda ausente tomada por verde coronaría a un
  candidato sobre una medición que no se hizo. **El hallazgo estructural:**
  `factual_segments_with_resolvable_anchors` mide anclas que resuelvan contra **fragmentos
  autorizados**, y `deterministic_degraded_recovery` mide la caída al modo degradado, que P-II §8.6
  define sobre activos **congelados**. `content/` sigue en marcadores, así que **hoy ninguno de los
  dos tiene con qué medirse**, y `verdictFor()` ya rechaza un dictamen con gates de menos. La
  consecuencia hay que decirla entera: **BENCH-01 no puede dictaminar hasta que exista corpus**, y
  eso es un bloqueo mayor que los cuatro puntos del piloto. No se aproximó ninguno de los dos con un
  sustituto: un gate medido contra un sucedáneo pasa, y su verde diría algo que nadie comprobó.
- **D-46 — `CaseOutcome` conserva el primer intento aparte del último.** Dos gates congelan como
  unidad de análisis la **solicitud inicial** (fugas e invenciones), y el runner sólo guardaba la
  salida del último intento: un reintento limpio borraba la evidencia de lo que la primera respuesta
  dijo. Medir el reintento y llamarlo «solicitud inicial» daría por bueno justo el caso que el gate
  de cero fallos existe para cazar — el candidato que filtra en la primera y acierta en la segunda.
  Lo destapó escribir el cómputo, no las pruebas del runner: **la unidad de análisis de un gate es
  un requisito sobre qué hay que conservar, y eso no se ve mirando el runner solo.** Hay una prueba
  que siembra exactamente ese caso.
- **D-47 — El orquestador de W0 se construye sin id de tarea propio, como el cumplimiento de la
  línea de «Pruebas» de F5.** Plan.md fija para F5 «replay determinista de una corrida W0 sobre
  fixtures», y ninguna `T-H45` lo produjo: F5 construyó validadores, no el ejecutor (HANDOFF §9,
  pregunta abierta 5). `packages/authoring-core/src/w0-runner.ts` compone los validadores en el
  orden literal de la máquina de estados, de `solicitud_curso` a `propuesta_corpus`. Tres
  decisiones, todas de la casa: la entrada es **dato** y no funciones —los conectores reales a las
  APIs de la whitelist llegan con el worker, y eso es lo que hace replayable la corrida—; **no
  produce escalares** —la idoneidad viaja como observaciones y la saturación declara
  `stopDecisionAvailable: false`, porque esos puntos de fallo son donde se enchufan los valores
  congelados en H4.5—; y la corrida **se detiene en `propuesta_corpus`**, porque la autorización es
  frontera externa de gobernanza y la aplica `applyCorpusDecision`, no la corrida. `profesor-ia w0
  replay <corrida.json>` lo hace ejecutable sobre fixtures. **Lo que no está:** la ejecución en
  `authoring-worker` (exige jobs y BD) ni los conectores reales a Open Logic Project, MIT OCW y
  OpenStax. El propietario decidió el 2026-08-19 el camino (A) de HANDOFF §3.5: corpus primero.
- **D-48 — La corrida W0 en vivo ya se ejecutó (2026-08-19), con las evaluaciones escritas por el
  asistente y pendientes de revisión en el gate.** Conectores reales en
  `packages/authoring-core/src/connectors.ts` —borde impuro con `fetch` inyectable, la red no entra
  en la suite— y `scripts/content/w0-live-run.mjs` que descubre en vivo, alimenta el orquestador y
  escribe `research/`. Resultado: **propuesta de corpus en `propuesta_corpus`** con inventario
  1 `autorizado` (forallx-yyc TFL, CC BY 4.0 por tres vías), 1 `excluido` (MIT OCW 24.241, NC/SA
  sin compatibilidad declarada — es el default conservador, declararla es del aprobador) y 1
  `LICENSE_UNRESOLVED` (componente modal de Trueman, «used with permission»); OpenStax: 129
  títulos revisados, ninguno de lógica — el vacío queda registrado, no se fabricó candidato. Tres
  salvedades dichas sin adornos: (1) las observaciones y claims los redactó el asistente —misma
  salvedad que D-41— con justificación por dimensión y fuente citada en
  `research/evaluations-2026-08-19.json`; los claims salen del `quickreference.tex` real del repo
  @ec34df8; (2) los dos componentes del mismo repo comparten snapshot con URLs de componente
  distintas (ancla sobre el árbol), y el subárbol `solutions/` se excluyó de la base expresiva —su
  lugar es `solutions-private` en W1 (I-2/I-4)—; (3) los `.yaml` de `research/` se escriben como
  JSON, que es YAML 1.2 válido. La ejecución fue **en el host**, no en `authoring-worker`: el
  worker con jobs y BD sigue pendiente, y no bloquea el gate — el manifiesto es el mismo.
- **D-49 — Ventana de frescura del refresco documental ampliada de 24 h a 5 días (2026-08-19).**
  Sustituye a la decisión del 2026-08-18 (`REFRESH_WINDOW_24H`, ahora `REFRESH_WINDOW_5D`,
  `maxAgeSeconds: 432_000`, en `tools/bench/src/refresh-2026-08-18.ts`). Motivo: 24 h obligaba a
  refrescar el mismo día de la corrida; con 5 días el refresco de una semana de preparación sigue
  autorizando. Consecuencia: el refresco del 2026-08-18 ya **no está caducado** — caduca el
  2026-08-23 a las 07:39 UTC —, pero **hay que reescribirlo igualmente** para la corrida material
  porque los candidatos cambiaron (§3.4 del HANDOFF: entra `claude-sonnet-5`).
- **D-50 — El propietario firmó el corpus: W0 cierra en `corpus_autorizado` (2026-08-19, tarde).**
  Revisión asistida antes de firmar: snapshot re-verificado en vivo (tarball del commit `ec34df8`
  recomputado, SHA-256 idéntico al registrado: `02351aa3…9510`); licencia CC-BY-4.0 reconfirmada por
  la API de GitHub; los 13 claims cotejados regla por regla contra `forallx-yyc-quickreference.tex`
  del propio snapshot — cubren exactamente las 13 primitivas de `authorized-calculus-v1`. La firma
  se aplicó con `applyCorpusDecision` (`scripts/content/w0-apply-decision.mjs`, decisión
  `autorizado`) y se persistió en `research/corpus-decision.yaml`. El corpus autorizado es el
  conjunto `authorizableReferences` del manifiesto: **solo `forallx-yyc/tfl-deduccion-natural`**.
  El propietario autorizó el componente modal, pero el gate es todo-o-nada y no está en el conjunto
  autorizable: queda **fuera de esta unidad** (cobertura 0.0) y su incorporación futura queda
  condicionada a permiso documentado de Trueman. MIT OCW permanece excluido — la compatibilidad
  NC/SA quedó aplazada por el propietario. En la misma sesión el propietario **autorizó los 200
  casos de BENCH-01**: la salvedad de D-41 (casos redactados por el asistente) queda cerrada por
  revisión del propietario. **La cadena de §3.5 queda desbloqueada hasta W1–W5.**
- **D-51 — W1 se ejecutó sobre el corpus real: identidad en dos niveles y 77 fragmentos
  materializados (2026-08-20).** La ingesta en el host (`scripts/content/w1-ingest-run.mjs`)
  verifica la identidad de la fuente **en dos niveles distintos**: los bytes del tarball
  (SHA-256 `02351aa3…9510`, lo que W0 evaluó) y el contenido textual de cada archivo
  (SHA-256 de contenido `7a988a58…`, lo que los fragmentos citan). El manifiesto de ingesta se
  **proyecta** explícitamente con el hash de contenido antes de llamar a `ingestCorpus`, porque
  las anclas de W2 citan el texto, no el tarball — usar el hash del tarball en los fragmentos
  haría que cualquier ancla pareciera envejecida. Los fragmentos se derivan con un parser LaTeX
  puro (`packages/authoring-core/src/latex-fragments.ts`, estructura `\part/\chapter/\section`,
  fail-closed ante contenido sin estructura) desde el snapshot real `master@ec34df8`: **77
  fragmentos** en `content/unidad-deduccion-natural/source/` (`manifest.yaml` +
  `fragments/forallx-yyc--tfl-deduccion-natural.json`), re-ingesta idempotente verificada.
  `solutions/` (13 archivos, no citable por diseño) se reubicó a `solutions-private/` con
  `procedencia.json`. `kcsWithoutExpressiveBase: []`: los 18 KC tienen base expresiva. El mapa
  KC se materializó como artefacto (`scripts/content/kc-map-write.mjs` →
  `content/unidad-deduccion-natural/kc/map.yaml`, 18 nodos / 42 aristas) con guarda de deriva:
  reescribirlo sobre un catálogo distinto falla cerrado. Sigue pendiente la ejecución en
  `authoring-worker` (jobs + BD); no bloquea W2. **CI: corrida `32424646954` sobre `3782a16`
  observada en verde el 2026-08-21, los diez jobs** — incluida `ci:db:testcontainers · ci:db:negative`,
  que no había corrido en local al cerrar la sesión porque Docker quedó colgado en el host. Con eso
  `T-H5-01` y `T-H5-03` pasan a `VERIFICADA`.
- **D-52 — W2 se ejecutó sobre los 77 fragmentos reales: 43 elementos, 30 claims y 4 decisiones
  (2026-08-21).** La extracción corrió en el host (`scripts/content/w2-extract-run.mjs`) y
  materializó `extracted/{definitions,notation,rules,restrictions,claims}.yaml` y
  `provenance/{anchors,curricular-decisions}.yaml`, que hasta ahora eran marcadores de F0. Seis
  decisiones de la casa, cada una con su motivo:
  **(1) La identidad se vuelve a comprobar, no se hereda.** La corrida descarga el snapshot
  autorizado, re-deriva las 77 secciones y exige que cada fragmento persistido hashee igual antes
  de extraer nada (tarball `02351aa3…9510`, cero deriva). Fiarse de lo que W1 escribió habría
  anclado claims a un texto que nadie volvió a mirar.
  **(2) Las anclas se declaran por `location` y las resuelve el script** contra el corpus; copiar a
  mano el par (`fragmentId`, `sha256`) es exactamente el ancla que envejece sola. Una `location`
  que no sea fragmento aborta la corrida.
  **(3) Los `rule_id` se derivan de `logic-core`**, como en T-H5-03: la corrida compara las reglas
  declaradas con `AUTHORIZED_RULE_IDS` y falla si sobra o falta una, de modo que un cambio en la
  whitelist no puede colarse como extracción de un cálculo que ya no es el vigente. Los enunciados
  de las trece primitivas son los que el propietario cotejó al firmar (D-50), ahora **anclados a la
  sección de `prooftfl.tex` que los enuncia** en vez de a `quickreference.tex`, que no se fragmentó.
  **(4) Ningún claim es `cross_source_consensus`, y no es un olvido.** El corpus autorizado tiene un
  solo componente (D-50) y ese tipo exige dos distintos. La ausencia se registra como decisión
  curricular (`dc-sin-consenso-cruzado`) en vez de fabricarse una segunda fuente.
  **(5) La cobertura KC se comprueba y falla cerrado, y la primera corrida la disparó de verdad.**
  KC17 y KC18 —las estrategias de construcción de pruebas— tenían base expresiva en el corpus y
  quedaban **sin un solo elemento extraído**: la extracción cubría las reglas y la sintaxis y se
  saltaba entera la parte estratégica del libro. Se añadieron cinco definiciones y cinco claims
  sobre `constructing-proofs`, `working-backward…`, `working-forward…`, `strategies-at-work`,
  `proceed-indirectly` y `working-forward-from-ered`, y la cobertura quedó en 18/18. La guarda no
  la exige ninguna autoridad para W2: es el mismo motivo por el que W1 registra
  `kcsWithoutExpressiveBase` —sin ella, W3 descubriría en plena autoría que un KC no tiene nada a
  lo que anclar, y el hueco parecería fallo del generador—. **Control positivo hecho:** una corrida
  sembrada que oculta esos diez elementos falla nombrando `KC17, KC18`.
  **(6) La extracción materializada tiene guarda de deriva permanente**
  (`test/w2-extraction-artifact.test.ts`, 7 pruebas): re-valida los artefactos enteros contra el
  corpus con `buildExtraction`, comprueba que el índice de anclas es el que la extracción cita con
  su hash, que la sección `rules` es exactamente `AUTHORIZED_RULE_IDS` y que el denominador de
  atribución persistido excluye los `system_inference` (27 de 30). **Dos mutaciones sembradas y las
  dos detectadas:** envejecer el hash de un ancla y reetiquetar `c-sin-precedencia` como
  `source_assertion`.
  **Salvedad, dicha sin adornos:** la extracción la redactó el modelo asistente, misma salvedad que
  D-41/D-48; el CORPUS_APPROVER la audita antes del freeze de W5. **15 de los 77 fragmentos quedan
  citados**: el resto son secciones de tablas de verdad y de reglas que el cálculo no autoriza, y
  su exclusión está decidida y justificada (`dc-semantica-como-apoyo`, `dc-alcance-reglas`), no
  omitida. La ejecución en `authoring-worker` (jobs + BD) sigue pendiente y no bloquea W3.
  **CI: corrida `32521434877` sobre `3312c3a` observada en verde el 2026-08-21, los diez jobs.**
  Con eso `T-H5-02` pasa a `VERIFICADA`.
- **D-53 — Rol B se ejecutó sobre el mapa de KC: secuencia, objetivos y política pedagógica
  materializados (2026-08-21).** `scripts/content/rolb-pedagogy-run.mjs` llenó
  `objectives/objectives.yaml`, los cinco `.yaml` de `pedagogy/` y
  `session-templates/base-patterns.yaml`, que eran marcadores de F0. Todo pasa por los validadores
  de `pedagogy.ts` antes de escribirse: 12 reglas de activación sobre las 12 entradas del catálogo,
  **ninguna activable en `MEASUREMENT_MODE`**, 18/18 KC con objetivo y evidencia observable, fading
  contingente sin regla por reloj, autoexplicación selectiva y anclada al KC, y BKT sombra como
  proyección literal de `BKT_SHADOW_H5_CONFIGURATION` (deshabilitado, CAL-11 sin ejecutar).
  Cinco decisiones y un fallo propio:
  **(1) La secuencia se deriva, no se escribe.** Orden topológico determinista sobre `kc/map.yaml`
  con desempate por id, comprobado arista por arista. Sale KC01…KC18 y las 42 aristas se respetan.
  **(2) El fallo, que vale más que el artefacto: la primera versión de esa comprobación no
  comprobaba nada.** Leía `arista.on` cuando el artefacto trae `from`/`to`, así que
  `posicion.get(undefined)` daba `undefined`, y `undefined >= undefined` es **falso**: la guarda
  reportaba «42 aristas respetadas» sin haber mirado una sola. Lo destapó el control positivo —una
  secuencia sembrada con KC09 antes de KC08 pasó sin ruido—, no la lectura del código. Arreglado
  resolviendo las dos posiciones **antes** de compararlas y abortando si alguna no resuelve: una
  comparación con `undefined` no falla, pasa. Es la misma familia que la lección del campo
  obligatorio de `T-H7-03`: **una guarda puede estar apagada y verse encendida.**
  **(3) El plan de retrieval va por bloque, no por KC suelto.** Con una entrada por KC,
  `alreadyIntroduced` salía cierta por construcción y el control de §8.3.4 pasaba por vacío (D-18):
  ningún dato podía ponerlo en falso. Ahora la elegibilidad se deriva de comparar la posición del KC
  con la del bloque —18 bloques, 153 pares—, y el primer bloque no ofrece nada porque no hay nada
  introducido todavía.
  **(4) No se fija ningún intervalo de spacing.** §8.3.4 dice que la programación «corresponde al
  motor/calendario» y el sobre lo congela el calendario SCED de T-H5-11. Un número aquí sería una
  calibración que nadie congeló.
  **(5) No se inventa una taxonomía de tipos de conocimiento.** §7.2 pide «perfil pedagógico por
  KC/tipo de conocimiento» y el Maestro no define en ninguna parte qué tipos hay: el perfil va por
  KC, con su posición y el patrón base que lo gobierna, y el hueco queda declarado en el propio
  artefacto (mismo criterio que D-4).
  **Controles positivos: cinco semillas sobre el script y las cinco detectadas** —retrieval de un KC
  no enseñado, una regla con `MEASUREMENT_MODE`, una secuencia que viola una arista formal, una
  entrada del catálogo sin regla y una arista con campo inexistente—. **Y guarda de deriva
  permanente** (`test/rolb-pedagogy-artifact.test.ts`, 9 pruebas) con dos semillas sobre los
  artefactos, las dos detectadas.
  **Salvedad:** los objetivos y las señales observables los redactó el modelo asistente (D-41/D-48/
  D-52); el propietario los audita antes del freeze de W5. Lo que sigue sin ejecutarse de W2 es su
  paso 5 —elegir conjuntos experimentales, `T-H5-12`—, que **exige bancos de W3** («69 sondas
  disponibles por set»): no se puede adelantar sin fabricar evidencia.
  **CI: corrida `32525447742` sobre `bf9aa01` observada en verde el 2026-08-21, los diez jobs.**
  Con eso `T-H5-04` pasa a `VERIFICADA`.
- **D-54 — BENCH-04 corrido y congelado sobre el paquete real (2026-08-22).** W3 no arranca sin el
  orden de validez congelado —`resolveValidityVariant()` lo exige y `freezeWinningOrder()` falla
  cerrado a propósito—, y declararlo desde la muestra L0 está prohibido: esa muestra es con la que
  el arnés se prueba a sí mismo. `scripts/content/bench04-run.mjs` extrae **mecánicamente** las
  formas de argumento del `prooftfl.tex` del snapshot autorizado, las traduce macro a macro y las
  pasa por el analizador de `logic-core`: **37 usables, 7 descartadas con motivo** —cuatro
  multilínea, dos envueltas en prosa y una que **no es fórmula del cálculo porque el propio libro
  trae un paréntesis descuadrado** (`(C→¬L)→C)`)—. Resultado: `comparable: true`, **cero hallazgos
  de seguridad**, veredicto idéntico en las 37, y gana **`prefilter_then_search` por 35 unidades de
  trabajo**. Lo que hace legible ese margen pequeño es de dónde sale: **de un solo caso de los 37**,
  el único semánticamente inválido, donde el prefiltro no busca lo que el oráculo ya rechazó. Es
  exactamente el mecanismo por el que el prefiltro existe. **Limitación registrada en el propio
  artefacto:** con un solo argumento inválido en la muestra, el corpus subrepresenta la situación en
  la que el orden importa, así que **el margen medido es un piso, no una estimación** — en W3 la
  proporción de candidatos inválidos es mucho mayor. El id de corrida se deriva del hash del informe,
  no del reloj: dos corridas iguales dan el mismo id. Artefactos en `audits/bench04-report.yaml` y
  `audits/bench04-frozen-order.yaml`.
- **D-55 — W3 se ejecutó por primera vez sobre material real, y destapó dos huecos del buscador
  (2026-08-22).** `scripts/content/w3-generate-run.mjs` genera 108 candidatos desde plantillas
  declaradas por KC (seis variantes operativas: `diagnostic`, `guided_practice`,
  `independent_practice`, `recovery`, `TRANSFER_MASTERY` y `replacement`), con pistas de los tres
  primeros niveles de §8.6 ancladas a fragmentos y crítica estructurada por reactivo.
  **91 aceptados, 17 rechazados.** Cuatro cosas que salieron de ahí:
  **(1) Los dos huecos del buscador, que son lo más importante de la corrida.**
  `packages/proof-search` construye **15 de las 16 justificaciones del cálculo: no construye `∨E`**.
  Consecuencia dura: **ninguna premisa disyuntiva es utilizable**, así que KC13 —KC obligatorio— se
  queda con **cero reactivos**, y `A∨B ⊢ B∨A` es indemostrable para el sistema. El segundo hueco:
  **`→E` no encadena hacia atrás sintetizando un antecedente compuesto**, así que
  `(A∧B)→C, A, B ⊢ C` tampoco se prueba. **Ambos comprobados con controles positivos** —modo
  exhaustivo, techo de coste 20 y dos millones de unidades: las metas con disyunción fallan en
  milisegundos mientras los controles pasan—, así que no es presupuesto. **Nada miente**: el
  buscador devuelve «no encontré», nunca «no existe» (CALC-03), y por eso el hueco no se veía. Pero
  para autoría significa que hay clases enteras de reactivo inautorables. **No se arregla aquí**:
  `proof-search` está en la ruta crítica, con conjunto dorado y mutación propios, y el arreglo de
  `∨E` necesita su propia tarea y su propio PR.
  **(2) El control de duplicación contra el corpus funciona, y pilló cuatro plantillas.** KC09,
  KC11 y KC14 reproducían ejercicios del propio libro (`corpus-ej-04`, `-07`, `-09`, `-10`) bajo la
  canonicalización congelada. Se rediseñaron las formas; no era falso positivo.
  **(3) La complejidad objetivo se declaraba mal, y la asimetría lo demostró.** La primera corrida
  dio **60 desajustes, los 60 medidos por encima de lo declarado y ninguno por debajo**: eso no son
  60 errores independientes, es una regla equivocada —la banda `baja` de `cal-09-v1` ([0, 14.004])
  es mucho más estrecha que «uno o dos pasos»—. Se corrigió **la regla**, declarada por forma y no
  por KC, y se volvió a correr: quedan **11 desajustes residuales y ahora en las dos direcciones**
  (KC14 sobredeclarado), que es la señal de que la regla nueva es una regla y no un ajuste a lo
  observado. **Los residuales se rechazan y se cuentan; no se reetiquetan**: reetiquetar convertiría
  el objetivo en un espejo de la medida.
  **(4) El crítico no es independiente y consta.** Rol C/D y Rol E son el mismo modelo asistente.
  §7.3 no lo prohíbe: invalida usar su acuerdo como evidencia para congelar la familia, y eso lo
  mira W5. `criticIndependence` lo registra con su motivo.
  **Cobertura contra P-III §4.2: cuatro KC por debajo del piso de actividades** (KC09 5/6, KC14 1/6,
  KC18 1/6 y **KC13 0/6**). **KC13 no se saca del piloto para que la cobertura salga limpia**: un KC
  fuera de la lista dejaría el hueco invisible justo donde falta todo (D-18). Las sondas (57
  nominales / 69 con reserva) **no están autoradas**. Guarda de deriva en
  `test/w3-run-artifact.test.ts` (7 pruebas): ningún registro público lleva solución, todo
  certificado privado re-verifica con `logic-core`, hay exactamente un certificado por aceptado y
  los rechazos usan solo códigos de la lista cerrada.
  **CI: corrida `32540724131` sobre `dea06df` observada en verde el 2026-08-22, los diez jobs.**
  `T-H5-05` queda `VERIFICADA` **como código y corrida**, no como banco completo: la cobertura
  sigue con cuatro KC bajo el piso y las sondas sin autorar, y eso lo miran W4 y W5.
- **D-56 — `∨E` implementado en el buscador; `SEARCH_ORDER_VERSION` se queda en `v1` por decisión
  del propietario (2026-08-22).** El hueco de D-55: `prove()` cubría explosión, introducciones
  dirigidas por la meta, eliminaciones hacia adelante e IP, y **el análisis de casos no cabía en
  ninguna de las tres** —no es una introducción dirigida por la meta, porque la meta puede ser
  cualquier cosa, ni una eliminación hacia adelante, porque no produce una subfórmula sino la meta
  entera a cambio de dos subpruebas—. Por eso faltaba. Se añade como paso propio **después de las
  eliminaciones y antes de IP**: abrir dos subpruebas es más caro que cualquier eliminación, e IP
  sigue siendo el último recurso. Poda: una disyunción con un disyunto ya disponible no abre casos
  —esa rama repetiría el contexto— y eso evita además reentrar por la misma disyunción.
  **Lo que destapó el arreglo, medido:** en BENCH-04 sobre los 37 argumentos del libro las pruebas
  halladas pasan de **11 a 25**; en W3 los aceptados pasan de **91 a 97** y `search_budget_exhausted`
  **desaparece**. Y apareció que **un defecto tapaba otro**: `kc13-transf` era el ejercicio
  `corpus-ej-05` del propio libro, y mientras fue indemostrable el control de duplicación no llegaba
  a verlo. Plantilla rehecha.
  **La decisión de versión, que es del propietario y no técnica.** El repertorio del buscador cambió,
  así que `SEARCH_ORDER_VERSION` podía moverse a `v2`. Se probó, y el radio de acción es grande:
  la guarda de `complexity.ts` rechaza comparar un perfil contra una calibración hecha con otro
  orden, así que **cinco de las diez pruebas de CAL-09 caen y ninguna complejidad se puede comparar**
  hasta re-congelar la calibración. **El propietario decidió dejarla en `v1`**, con dos evidencias a
  favor: (1) con `v1`, `runCal09Calibration()` **re-corre y reproduce el manifiesto byte por byte**
  —13 casos, pesos, bandas y hash idénticos—, así que el arreglo no mueve la calibración; y (2) las
  seis medidas con peso del índice son **estructurales**, salen de la prueba hallada y no de la
  telemetría, y la única de telemetría tiene peso cero. La lectura que sostiene la decisión es que
  la ausencia de `∨E` era un **defecto**, no una política de exploración: `authorized-calculus-v1`
  siempre listó `∨E` entre sus primitivas. **Queda dicho lo que se acepta a cambio:** la etiqueta de
  versión describe un buscador que ya no es exactamente el mismo, y quien compare perfiles de antes
  y después del 2026-08-22 no tiene la guarda de versión para avisarle.
  **Regresión:** 6 pruebas nuevas en `packages/proof-search/test/search.test.ts` —incluida una de que
  el silogismo disyuntivo se deriva de las primitivas **sin citar DS**, que está fuera de la
  whitelist, y otra de que CALC-03 sigue en pie: ampliar lo demostrable no cambia lo que el buscador
  puede **afirmar**—. **Control positivo: sembrada la desactivación del paso de casos, caen 4 de las
  6**, exactamente las que exigen que `∨E` dispare. **BENCH-04 re-congelado** con el buscador
  arreglado (`bench04-dd2c211a8d4c05d0`; gana `prefilter_then_search`, mismo margen de 35 unidades
  del mismo caso inválido) y **W3 re-ejecutado**. La guarda de artefactos de W3 fijaba que KC13
  estaba a cero: esa afirmación caducó con el arreglo y **se sustituyó por la contraria**, que es la
  que ahora hay que defender.
  **CI: corrida `32541960670` sobre `f39e4ef` observada en verde el 2026-08-22, los diez jobs**,
  incluidos `ci:logic:mutation` y el conjunto dorado — que es lo que confirma que tocar el
  buscador no movió al verificador ni al cálculo congelado.
- **D-57 — W4 produce censo, las sondas son 207 y no 69, y el objetivo de complejidad no se puede
  predecir con una regla estructural simple (2026-08-22).** Tres cosas que salieron de cerrar W3 y
  abrir W4, y las tres corrigen algo que este documento decía mal.
  **(1) La muestra de auditoría previa salió 97 de 97.** No es un fallo del muestreo: el estrato es
  KC × función × complejidad × regla × origen × subprueba × riesgo, con 97 reactivos repartidos en 18
  KC y 6 funciones cada combinación es única, y `cal-audit-pre-v1` exige **al menos uno por estrato
  observado**. Con un banco así, la política correcta *es* el censo; la fracción bajará sola cuando
  el banco crezca. El riesgo por reserva es un juicio declarado —ninguna autoridad lo enumera— y
  viaja con su consecuencia al lado: alto en `TRANSFER_MASTERY`, porque un defecto ahí hace afirmar
  transferencia que no hubo (§5.11).
  **(2) Las sondas son 207, no «57–69».** El handoff venía diciendo 57 nominales y 69 con reserva, y
  eso es **por conjunto experimental**: `requiredProbesForCalendar()` multiplica las 19 oportunidades
  del sobre congelado por `k_set = 3`, y eso da 57 **para A, para B y para C**. Total real: **171 por
  calendario y 207 con la reserva del 20 %**. Además cada sonda debe ser no isomorfa a los 97
  reactivos de enseñanza —`collisionProhibited()` prohíbe la colisión en cuanto una de las dos
  reservas es de medición— y su **asignación a conjunto depende de `T-H5-12`, que no se ha corrido**.
  Autorar las 207 antes de saber la composición de los conjuntos sería construir sobre una decisión
  que no está tomada.
  **(3) El objetivo de complejidad no se deja predecir con una regla estructural simple, y no se
  siguió retocando.** Tras corregir la regla (D-55) quedaron 11 desajustes en tres formas:
  `kc09-transfer` (media declarada, alta medida), `kc14-base` (alta declarada, media medida) y
  `kc18-base` (media declarada, alta medida). El caso de `kc14-base` es el que lo dice todo: **toda**
  introducción de bicondicional lleva dos subpruebas, así que la regla la manda a `alta` siempre,
  y `cal-09-v1` la mide `media`. Rediseñar el reactivo no arregla eso —la forma de ↔I es la que es— y
  reetiquetarlo sería el espejo que se prohibió. **Se deja el desajuste y se cuenta**: son 3 KC bajo
  el piso de actividades, 2 bajo recuperación y 1 bajo transferencia, todos declarados. Lo que esto
  sugiere para quien complete el banco es que el objetivo debería **derivarse de un predictor
  calibrado contra CAL-09** en vez de declararse a ojo, y eso es una tarea con su propio alcance. Se
  registra en vez de seguir ajustando la regla, que es lo que convertiría el objetivo en un espejo de
  la medida por la puerta de atrás.
  **CI: corrida `32543149315` sobre `a458933` observada en verde el 2026-08-22, los diez jobs.**
- **D-58 — Banco de sondas autorado: 389 reactivos y el inventario primario por encima del
  calendario (2026-08-22).** Corregido lo que decía D-57: **las sondas no dependen de `T-H5-12`**.
  `ExperimentalSelectionProposal` **asigna** sondas desde un banco existente
  (`probeInventoryItemIdsBySet`), así que el banco va antes y la selección después. Autorarlo era
  trabajo desbloqueado.
  **Diseño: el núcleo del KC en cuatro superficies distintas, una por reserva de medición.** Hay
  exactamente cuatro porque `collisionProhibited()` **prohíbe la colisión entre dos reservas de
  medición distintas**: dos sondas de reservas distintas no pueden ser isomorfas. Las envolturas
  añaden un paso de prueba cada una —premisa dentro de una conjunción, meta condicional, meta
  disyuntiva, meta conjuntiva— y no son el reactivo de enseñanza renombrado, que es justo lo que
  §7.8 dice que **no** crea forma nueva.
  **Dentro de una misma reserva sí se admiten formas paralelas**, y se usan: ocho por reserva
  primaria. No es inflar el conteo — §7.7 solo prohíbe la colisión **entre** reservas, y una serie
  SCED mide el mismo KC muchas veces sin poder reutilizar material. Lo que no se repite son las
  ternas de átomos: hay guarda que aborta si se piden más variantes que ternas, porque dos sondas con
  los mismos átomos y la misma estructura serían el mismo reactivo con otro id y el conteo por id no
  lo distinguiría.
  **Resultado: 389 aceptados de 468.** Sondas primarias **224, por encima de las 207** que exigen los
  tres conjuntos con la reserva del 20 %; 34 de retención y 34 de transferencia de medición. Los 79
  rechazos son 63 desajustes de complejidad —**ahora en las dos direcciones**, 30 arriba y 21 abajo,
  lo que confirma D-57: la regla no está sesgada, es imprecisa, y no se siguió tocando— y 24
  duplicados triviales.
  **Los duplicados destaparon algo que no se veía: envolver el núcleo de un KC puede producir la
  estructura de otro.** `kc05-probes_intervention-1` salió duplicado trivial de `kc03-transf`, porque
  envolver el núcleo de KC05 en un condicional da exactamente la forma de transferencia de KC03. El
  control lo rechazó; conviene saberlo al diseñar más envolturas.
  **Dos guardas propias dispararon y se agradecen:** el envoltorio de premisa generaba fórmulas sin
  paréntesis y el cálculo las rechazó con `E-SYN-PRECEDENCE` —60 reactivos, arreglado— y la guarda de
  riesgo declarado abortó W4 al no tener riesgo para las reservas nuevas, en vez de suponerlo.
  **Las cuatro reservas de medición se declaran de riesgo alto**, con su motivo: una sonda consumida
  no vuelve al banco (§7.7) y el libro de códigos ya trata `reused_or_contaminated_probe` como
  crítico. La política incluye todo el alto riesgo, así que la muestra vuelve a ser censo: **389 de
  389 en 159 estratos**, 309 de ellos de riesgo alto.
  **Auditoría re-corrida sobre los 389: sigue habiendo un solo defecto** (`kc03-transf`,
  `incorrect_kc_label`), ahora 0,26 % de mayores. Las 292 sondas nuevas **sí** ejercitan la regla de
  su KC —la envoltura conserva el núcleo—, comprobado recorriendo los 389 certificados.
  **CI: hubo un corte y quedó resuelto.** Entre las 01:29 y las ~04:00 UTC del 2026-08-22, tres
  corridas fallaron **en uno o dos segundos con cero pasos ejecutados** (`32543600446`,
  `32545859223`, `32546539785`) — la firma de que Actions no arranca, no de un fallo del código. El
  propietario lo resolvió en la cuenta y la corrida **`32551578360` sobre `a368138` salió verde, los
  diez jobs**. Ese árbol incluye D-57, D-58 y D-59, así que **quedan `VERIFICADAS`**. Lección
  operativa: con `steps: []` en los jobs, el fallo no está en el código.
- **D-59 — Conjuntos experimentales propuestos y ordenados; y los tres conjuntos NO son
  estructuralmente comparables (2026-08-22).** Paso 5 de §12 «W2», que faltaba.
  `scripts/content/w2-experimental-sets-run.mjs` arma **tres particiones con criterio declarado** de
  los quince KC que no son fundamento —los otros tres son pre-SCED y solo pueden ser soporte
  (§5.2.1)— y las deja ordenar por la regla congelada. No se busca la mejor por fuerza bruta: 15 KC
  en tres grupos de cinco son 126 126 particiones, y elegir por búsqueda exhaustiva optimizaría el
  número en vez de la interpretabilidad.
  **Encabeza `sel-por-conectivo`, con cero aristas FORMAL y cero de política de contenido cruzadas.**
  Agrupar por familia de conectivo deja cada dependencia dentro de su conjunto, cosa que la partición
  por bloques consecutivos no consigue (2 FORMAL cruzadas). **El control funcionó**: la partición
  alterna, incluida a propósito para comprobar que el criterio mide algo, sale última (3 FORMAL + 1
  PC). Si hubiera salido bien ordenada, el criterio no estaría midiendo la estructura del mapa.
  Inventario de sondas por conjunto: **98 / 112 / 98** contra 57 nominales y 69 con reserva.
  **El hallazgo que importa: `allCrossSetItemPairsComparable` sale `false`, y no por poco.** La
  diferencia estructural máxima entre conjuntos es **90,86** contra la banda congelada de
  `cal-09-v1`, que es **12,065296**. Se comprobó si cambiaba tomando **solo las sondas primarias**
  —que son las que producen la medida y serían el denominador más defendible—: sale **71,28**, que
  sigue estando siete veces por encima de la banda. **No hay lectura cómoda que elegir**, y por eso
  se registran las dos. La causa está a la vista en los rangos: cada conjunto abarca casi todo el
  índice (A: 19,6–81,5; B: 28,5–89,3; C: 28,1–90,9), así que comparar **todos** los pares cruzados
  hace que el máximo lo fije el reactivo más fácil de un conjunto contra el más difícil de otro.
  **No bloquea**: la política congelada dice que si excede la banda **se registra la diferencia y su
  efecto de interpretabilidad, sin gate subjetivo ni equivalencia psicométrica**. Pero limita lo que
  el piloto puede afirmar, y **conviene decidir antes del freeze** si el banco se reequilibra —por
  ejemplo acotando el rango de complejidad de las sondas— o si se asume la diferencia y se declara
  en la interpretación. Eso es decisión de diseño experimental, no de código.
  **No se congela nada.** `freezeExperimentalSelection()` exige la decisión del `EXPERIMENT_AUDITOR`,
  que solo puede aprobar o rechazar la plausibilidad de la primera propuesta, no sustituirla; y con
  un hallazgo de no comparabilidad sobre la mesa, esa decisión debería tomarla una persona.
  El artefacto queda en `kc/experimental-sets.yaml` con estado
  `propuesta_ordenada_sin_congelar`.
  **CI: corrida `32551578360` sobre `a368138` observada en verde el 2026-08-22, los diez jobs.**
- **D-60 — Las pistas se derivan del reactivo, y arreglarlas destapó dos defectos que esperaban en
  el freeze (2026-08-22).** Punto de partida: la única observación sin código de W4 —«las tres pistas
  son idénticas en los 557 reactivos»— con su consecuencia escrita, «conviene resolverlo antes del
  freeze». Al hacerlo salieron tres cosas más, y dos de ellas habrían salido en W5.
  **(1) Rol D genera desde el enunciado, no desde una plantilla constante.** Nivel 1 nombra la forma
  de la meta y los conectivos que hay que repasar; nivel 2, el conectivo principal de la meta y de
  las premisas con la regla que introduce y la que elimina; nivel 3, la regla que construiría la meta
  y qué exige tener antes. **Del enunciado, no del certificado**: Rol D no ve la solución, y con el
  enunciado alcanza para los tres primeros niveles. Resultado: **64 ternas distintas** donde había
  una, y 61/30/10 textos por nivel.
  **Las pistas nombran conectivos y reglas, nunca fórmulas, y eso no es estilo.** La comprobación de
  fuga busca en el texto, literal, toda fórmula del certificado ausente del enunciado; el único átomo
  que una derivación introduce sin estar en el enunciado es `⊥` —los demás vienen de premisas o
  meta—, así que escribirlo una vez tumbaría la pista de todo reactivo probado por reducción. Por eso
  se dice «la contradicción».
  **Y el nivel 3 no afirma cuál es la última línea, sino qué regla construiría la meta.** La primera
  redacción decía «la última línea se justifica con ∨I», que es **falso** en los reactivos de
  explosión: con premisas insatisfacibles la prueba cierra con `X`. Rol D no puede afirmar nada del
  certificado que no ha visto. Lo que sí es dato del enunciado es la insatisfacibilidad, que la
  plantilla declara con `contradiccionExplicita`, y por eso esos reactivos llevan una frase más.
  **(2) La propuesta de `masteryDisqualifying` estaba mal en 1114 pistas, y el freeze la habría
  rechazado.** Las tres proponían `false`; DEC-HINT-AUTHORITY-001 descalifica **siempre** de nivel 2
  en adelante, así que el linter de paquete habría fallado `authoritative_mastery_flags` con una
  discrepancia por cada pista de nivel 2 y 3. Que la propuesta no sea autoritativa no la hace libre:
  es exactamente lo que el linter contrasta. Ahora nivel 1 propone `false` —es recordatorio y no
  selecciona regla ni paso— y niveles 2 y 3 proponen `true`.
  **Los hechos que la política necesita no viajaban con la pista.** `masteryDisqualifying()` toma
  `MasteryHintFacts`, y `Hint` no tenía dónde llevarlos: sin ellos el registro que llega al linter no
  se puede computar y la comprobación **pasa por vacío**. Se añaden como campo obligatorio de `Hint`
  **y con comprobación en ejecución**, porque un campo obligatorio no protege a un llamador que nadie
  compila: los archivos de prueba no se typechequean (§3.2 del handoff).
  **(3) `items/transfer/items.yaml` se sobrescribía a sí mismo y perdía 17 reactivos.** `items/` tiene
  **nueve** carpetas fijadas por §4.3 del plan y hay **diez** reservas: `TRANSFER_MASTERY` y
  `TRANSFER_MEASUREMENT` comparten `transfer/`. Escribiendo un archivo por reserva, la segunda pisaba
  a la primera y los 17 de `TRANSFER_MASTERY` no llegaban al banco publicado — estaban en el informe
  de W3 y en los certificados, así que **todos los conteos cuadraban**. No se abre una décima
  carpeta: se agrupa por carpeta y el archivo declara las reservas que contiene.
  **(4) `kc03-transf` rehecho: era el único defecto de W4 y ya no está.** `p∧q ⊢ r→p` no ejercitaba
  la reiteración porque el buscador sacaba el consecuente por `∧E` dentro de la subprueba. Con el
  consecuente entero disponible fuera (`p∧q ⊢ r→(p∧q)`), la única forma de tenerlo dentro es
  reiterarlo: el certificado pasa de `PR, AS, ∧E, →I` a `PR, AS, R, →I` y sigue midiendo `media`,
  que es lo declarado.
  **La auditoría ya no lleva la lista de defectos escrita a mano.** `w4-audit-apply.mjs` recorre los
  certificados y deriva `incorrect_kc_label`: **424 comprobados, 0 defectos**. La lista literal
  anterior decía salir de ese recorrido y no lo repetía, así que un reactivo nuevo sin su regla no
  habría movido nada. **Se leen las líneas del certificado, no `rulesUsed`** — ver el hallazgo de
  abajo—. Y el informe declara ahora **qué se comprobó a máquina y qué no**: con cero defectos y sin
  ese apartado, el cero se leería como «se comprobó todo el libro de códigos», y lo único mecánico es
  la etiqueta de KC.
  **Guarda añadida: la muestra tiene que ser de esta corrida.** `w4-audit-apply.mjs` comprueba que la
  población auditada es exactamente el conjunto de aceptados de `audits/w3-run.yaml`. Un informe
  computado sobre una población vieja **cuadraría igual** —el gate divide por el denominador que le
  den— y estaría midiendo un banco que ya no existe. Comprobado con siembra: retirando un elemento de
  la población, aborta.
  **Lo que se movió, medido.** Aceptados **557 → 571** de 684 candidatos; los 14 nuevos son
  `kc05-probes_intervention-*`, que estaban rechazados por duplicar al viejo `kc03-transf`.
  `probes_intervention` **168 → 182**; el resto de reservas, idéntico. Rechazos **127 → 113** (99
  desajustes de complejidad, iguales; 42 → 14 duplicados triviales). Huecos de cobertura, **los
  mismos seis**. W4 vuelve a ser censo: **571 de 571 en 160 estratos**. `T-H5-12` re-corrido porque
  el inventario de sondas cambió: mismo ganador `sel-por-conectivo`, mismas cero aristas cruzadas,
  **misma diferencia estructural máxima 90,857143** e inventario **112/112/98** (antes 98/112/98).
  **El hallazgo de D-59 no se mueve, y la decisión sigue siendo del propietario.**
  **Hallazgo que se registra y no se arregla: `FoundProof.rulesUsed` no incluye `R`.** Sale de
  `collectRules()` sobre el término de derivación, y la reiteración la inserta `linearize()` al bajar
  a líneas Fitch. Consecuencia práctica: quien pregunte «¿qué reglas usa esta prueba?» por ahí
  concluirá que **ningún** reactivo de KC03 ejercita la suya. **No se corrige aquí** porque
  `distinctRuleCount` se deriva de ese campo y entra con peso 35 en el índice de complejidad: cambiarlo
  movería `cal09-mid-one-subproof` —que reitera— y con él el manifiesto congelado `cal-09-v1`. Es la
  misma familia que la decisión de versión de D-56 y le toca al propietario.
  **CI: corrida `32555340076` sobre `e0789e0` observada en verde el 2026-08-22, los diez jobs.**
  **Regresión: 7 pruebas nuevas** (2 en `hints.test.ts`, 5 en `w3-run-artifact.test.ts`), 1657 → 1664
  unitarias. **Control positivo de las cuatro guardas nuevas, comprobado contra los artefactos
  anteriores**: «publica todos los aceptados» habría fallado por 17, «las pistas se derivan del
  reactivo» habría visto un solo texto por nivel, «los hechos de dominio están» habría contado 1620
  ausentes, y la comprobación de la regla del KC ve el certificado de `kc03-transf` de entonces —el
  control usa **la misma función** que la comprobación, no una reimplementación—.
- **D-61 — El segundo hueco del buscador: el arreglo está escrito y medido, y no se aplica porque
  mueve `cal-09-v1` (2026-08-22).** `→E` solo dispara hacia adelante, cuando el antecedente ya está
  disponible; uno que hay que **construir** no se alcanza nunca, así que `(A∧B)→C, A, B ⊢ C` no se
  prueba. Es el mismo patrón que faltaba con `∨E` antes de D-56: un paso que no es introducción
  dirigida por la meta ni eliminación hacia adelante.
  **El arreglo, para quien lo aplique:** un paso dirigido por la meta en `prove()`, entre las
  eliminaciones hacia adelante y el análisis de casos —abre **una** submeta, así que va después de lo
  que no abre ninguna y antes de lo que abre dos subpruebas—. Por cada fórmula disponible de la forma
  `X→meta` (y `X↔meta` / `meta↔X`), probar `X` como submeta y cerrar con `→E` / `↔E`. Poda: si `X` ya
  está disponible, lo cubre el paso de eliminaciones y entrar aquí repetiría trabajo.
  **Lo que compra, comprobado:** `(A∧B)→C, A, B ⊢ C` (2 líneas, `→E` + `∧I`), `A↔(B∧C), B, C ⊢ A`
  (2 líneas) y **`(p∧q)→r, p ⊢ q→r`**, que es la plantilla de transferencia de KC18 que hubo que
  rehacer por indemostrable (4 líneas).
  **Lo que cuesta, comprobado:** `runCal09Calibration()` deja de reproducir el manifiesto congelado.
  **Ninguna de las trece pruebas de CAL-09 cambia** —mismas líneas, mismas reglas, mismo
  `costExplored`—; lo único que se mueve es el **trabajo gastado**: 4→5, 9→11, 10→16, 15→16 y 82→98
  unidades en cinco casos. Basta: `workUnitsLog2` pesa **47** en el índice, así que su máximo pasa de
  6,3750394 a 6,6293566, las bandas se desplazan (`baja` hasta 14,004071 → 14,054920; `media` hasta
  38,571280 → 38,548779) y `comparabilityMaxDifference` va de 12,065296 a 12,110589. El `sampleHash`
  deja de coincidir.
  **Por eso no se aplica: re-congelar una calibración es decisión del propietario**, y es la misma
  familia que la decisión de versión de D-56. Queda **una prueba que fija el estado de hoy**
  (`search.test.ts`, modo exhaustivo con techo 20 y dos millones de unidades, para que «no lo
  encuentra» no sea presupuesto, y con control positivo de que **sí** lo encuentra cuando el
  antecedente está disponible). Cuando se decida, esa prueba se sustituye por la contraria, como pasó
  con la de KC13 en D-56.
  **CI: corrida `32557212031` sobre `a335c43` observada en verde el 2026-08-22, los diez jobs.**
  **Corrección a D-56, que conviene no arrastrar.** Aquella decisión se apoyó, entre otras cosas, en
  que «las seis medidas con peso del índice son estructurales… y la única de telemetría tiene peso
  cero». El manifiesto dice otra cosa: `workUnitsLog2` pesa 47 y `costExplored` pesa 49, y las dos son
  relativas a la búsqueda. La única con peso cero es `distinctStrategiesFoundWithinBudget`. **La
  decisión de D-56 no se cae** —su evidencia de verdad era que `runCal09Calibration()` reproducía el
  manifiesto byte por byte, y lo reproducía porque `∨E` no dispara en ninguno de los trece casos: no
  hay premisa disyuntiva—. Lo que no se sostiene es el motivo escrito, y con `→E` el mismo argumento
  habría dado permiso para algo que sí mueve la calibración.
- **D-62 — Los archivos de prueba ya se typechequean, y eso destapó dos pruebas que no probaban lo
  que decían (2026-08-22).** Deuda registrada en §3.2 del handoff: `tsc -p tsconfig.json` incluía solo
  `src/**/*.ts` en todos los paquetes y vitest no typechequea, así que **ninguna de las 102 suites se
  compilaba en ningún sitio**. Ya había costado dos veces: un error de nombres de campo (`tokensIn`
  por `inputTokens`) que salió en ejecución, y un campo obligatorio nuevo que dejó de proteger porque
  `undefined` es falsy.
  **Cómo se activa.** Un `tsconfig.test.json` por paquete que extiende el suyo, añade `test/**/*.ts` y
  **no emite**: meter las pruebas en `tsconfig.json` las publicaría, porque ese proyecto emite a
  `dist/` con `rootDir: src`. Son 17 paquetes; `apps/web` ya incluía sus pruebas —Next no emite y su
  proyecto es `noEmit`— y solo le faltaba `test/**/*.tsx`, así que **la única prueba que monta un
  componente era la única que no se compilaba**. `infra/database/test/` no es workspace y `turbo` no
  llegaba: se engancha desde el script `ci:typecheck` de la raíz.
  **Lo que apareció: 65 errores en 20 archivos, y dos son defectos de verdad.**
  1. **Una propiedad de fast-check declaraba un generador y no lo usaba.** En
     `logic-core/test/pbt.test.ts`, «una derivación aceptada es semánticamente válida» declaraba
     `fc.integer({ min: 1, max: 6 })` y su predicado tomaba **solo** `seed`, con el número de pasos
     escrito a mano: las 200 corridas medían siempre derivaciones de cinco pasos. Corregido, y la
     propiedad **sigue en verde** para 1–6.
  2. **Tres llamadas a `gateway.execute()` y cinco a `validateModelOutput()` omitían `codeFence`**,
     que es obligatorio y **sin valor por omisión a propósito** (P-II §8.4: normalizar solo vale
     «cuando el contrato lo autorice»). Llegaba `undefined` y se comportaba como `reject` sin que
     nadie lo hubiera elegido. Ahora lo declaran; las vallas siguen teniendo su suite propia.
  **El resto eran declaraciones locales que se quedaban cortas**, y el patrón se repite: un ayudante
  de prueba tipado contra lo que **devuelve** otro ayudante en vez de contra el contrato
  (`binding()` inferia `provider: 'anthropic'` de su fixture, así que ningún caso podía declarar otro
  proveedor); un `RoundRun.requests` escrito a mano con dos campos mientras las pruebas leían cinco;
  un `estadoDeDominio(): unknown` que tiraba el tipo justo antes de pasárselo a una función que sí lo
  tiene. **Ninguna se debilitó para que compilara**: donde el índice podía faltar se resolvió con un
  ayudante que **falla con nombre** (`fijo()`, `presente()`, `codigo()`), no con `!` ni con `as`, y
  donde `undefined` significaba «ausente» se retira la clave en vez de escribirla, que con
  `exactOptionalPropertyTypes` no es lo mismo — y es justo la distinción que D-42 exige de
  `classification` en una caída de transporte.
  **Y un tercer defecto, que solo apareció en CI y por eso hay guarda nueva.** La guarda de
  artefactos de Rol B importaba `@profesor-ia/experiment` desde `authoring-core`, **que no lo declara
  como dependencia y no puede declararlo**: `experiment` depende de `authoring-core` y sería un ciclo.
  En local resolvía —la resolución sube hasta el `node_modules` de la raíz, donde pnpm enlaza lo que
  la raíz sí declara, y `dist/` estaba construido de una corrida anterior— y en CI no, porque `turbo`
  solo construye lo **declarado**. La comprobación se mudó a `packages/experiment/test/`, que es la
  dirección correcta. El control positivo comprueba ahora también esto: **ninguna prueba importa un
  paquete del workspace sin declararlo**, con su propia siembra.
  **Control positivo, porque el check es fácil de vaciar sin que se note.**
  `scripts/arch/verify-test-typecheck-catches.mjs` siembra un error de tipos **dentro de un archivo
  de prueba** y exige que el proyecto de pruebas lo vea y el de `src/` **no**; además comprueba que
  todo paquete con `test/` tiene quien lo compile y que su script `typecheck` lo corre de verdad.
  Sin él, recortar un `include` dejaría el check pasando sin mirar una sola prueba, que es
  exactamente el hueco que se acaba de cerrar. Va en el job `arch` de CI, al lado del control de
  depcruise.
  **CI: corrida `32557212031` sobre `a335c43` observada en verde el 2026-08-22, los diez jobs.** La
  anterior (`32556710586`, `278fae2`) salió **roja** y por el motivo correcto: el typecheck de
  pruebas encontró en CI el import no declarado que en local resolvía. Es el primer fallo que este
  check atrapa en producción.
- **D-63 — Las tres decisiones de W5 van a un auditor independiente de otra familia (2026-08-22).**
  Decisión del propietario: el juicio lo emite **Kimi (Moonshot)**, no él. No es delegar por comodidad,
  es lo que la norma pide: §I.145 exige que «el crítico generativo que contribuya al gate de autoría
  sea de **familia distinta** del generador», y §11.7 admite preinscribir «un segundo auditor
  independiente en una submuestra de calibración/adjudicación». El material lo generó un modelo
  Claude y la auditoría previa la hizo ese mismo modelo, así que **su conformidad no era evidencia**;
  la de Kimi sí lo es.
  **Instrumento: submuestra preinscrita y ciega.** `scripts/content/w4-second-auditor-packet.mjs`
  arma `audits/w4-second-auditor-packet.yaml` con **36 reactivos** —uno de enseñanza y uno de
  medición por cada uno de los dieciocho KC, cero estratos sin cobertura—, elegidos por el menor
  SHA-256 de `w4-segundo-auditor-v1:artifactId` dentro de su estrato. La regla de selección se
  **declara antes de mirar**: elegir a mano qué se audita permite auditar justo lo que ya se sabe
  bueno. Cada reactivo lleva enunciado, pistas, complejidad declarada **y** medida, y su certificado;
  y el paquete lleva el libro de códigos con la pregunta que hay que hacerse en llano por cada código.
  **El cegamiento es norma, no cortesía** (§13.4: «el auditor bloquea su primera decisión antes de ver
  el veredicto del sistema; también se ocultan en primera pasada metadatos de generador/historial no
  necesarios»). El paquete **no** lleva quién generó el material, ni el resultado de la auditoría
  previa, ni las banderas del crítico interno; y el encargo se entrega en **dos mensajes**, con la
  auditoría emitida antes de dar el contexto. Un encargo en un solo mensaje habría anclado el juicio.
  **Lo que este instrumento NO cierra, y queda dicho para que nadie lo dé por cerrado.** El paso 19
  del pipeline de contenido del Maestro dice «Ejecuta **auditoría humana** por muestra sobre el
  paquete candidato», y el 20 condiciona el freeze a que esa muestra pase los umbrales. Kimi cubre al
  crítico independiente; **no es una persona**. Lo que sí acota el alcance de esa lectura es §I.132,
  que descarta expresamente «una revisión humana reactivo por reactivo»: es por muestra, y el mismo
  paquete de 36 sirve.
  **El paquete contiene soluciones.** No puede entregarse a un modelo que vaya a conducir sesiones
  sobre este banco; Kimi no es candidato de BENCH-01, así que no hay conflicto. Queda anotado porque
  el día que se amplíe la lista de candidatos, esta entrega ya habrá ocurrido.
  **El encargo completo, listo para copiar, está en `docs/plan/HANDOFF.md` §2.9**, con el orden en que
  conviene tomar las decisiones: primero el arreglo del buscador —cambia qué es autorable, y con ello
  el banco, los conjuntos y la auditoría—, después el reequilibrio de sondas, y la firma al final.
- **D-64 — El intento de sustituir a Kimi por OpenAI Codex se conserva como diagnóstico, no como
  evidencia conforme (2026-08-22).** Kimi no completó el encargo por falta de créditos y el
  propietario pidió que Codex leyera el `HANDOFF`, el paquete y ejecutara las Partes A/B. Las
  respuestas crudas se preservan append-only en
  `audits/w4-second-auditor-part-a-openai-codex-gpt-5.json` y
  `audits/w4-second-auditor-part-b-openai-codex-gpt-5.md` (repositorio de contenido `c3dc0dd`).
  **Resultado diagnóstico.** Los 36 certificados re-verifican con `logic-core`. La Parte A registró
  15 juicios críticos en 14 reactivos: trece `reused_or_contaminated_probe` —sondas cuya derivación
  contiene completa la actividad de enseñanza y añade solo una envoltura— y dos
  `corpus_contradiction` en KC16 —la pista dirige a `¬E` desde `¬¬A`, mientras el certificado y el
  corpus exigen `DNE`. Además dejó sin código que `kc03-recup` usa `R` pero ninguna pista orienta
  hacia reiteración.
  **No entra al gate.** La primera decisión no fue ciega: el `HANDOFF` leído antes revelaba el
  resultado de la auditoría previa y la familia generadora, en contra de §13.4. Además Codex es de
  familia OpenAI y BENCH-01 contempla un candidato OpenAI; el paquete contenía soluciones y D-63
  prohibía exponerlas a un posible conductor de sesiones. Mientras el binding concreto no se excluya
  o se resuelva el conflicto, el intento tampoco cumple esa frontera. Por eso no se tocó
  `w4-audit-report.yaml`, no se recomputó el gate y no se regeneró contenido.
  **Desacuerdo que exige adjudicación.** D-58 considera las envolturas superficies distintas porque
  cambian la firma estructural total. La Parte A sostiene que siguen contaminadas cuando encapsulan
  íntegra la prueba practicada. No se elige una de las dos lecturas por edición silenciosa: se
  conservan ambas y se adjudica antes de cambiar plantillas. Si el defecto se confirma, se regeneran
  familias completas con semilla y muestra nuevas; nunca los trece observados a mano.
  **Recomendaciones de Parte B, todavía no decisiones del propietario:** declarar la no
  comparabilidad A/B/C y limitar inferencias a comparaciones dentro de conjunto; aplicar el arreglo
  de `→E` antes del freeze, preservar `cal-09-v1` y producir una versión nueva; no congelar hasta
  corregir/adjudicar, repetir W3→selección→W4, obtener auditoría realmente ciega de un no candidato y
  completar la lectura humana por muestra. El orden operativo completo está al inicio de
  `HANDOFF.md`.
- **D-65 — Guarda de clausura de reglas de las sondas y arreglo de la regla de entrada de las
  pistas (2026-08-22).** Primer tramo del plan de corrección del banco, el que **no depende de las
  decisiones pendientes del propietario**. No se regeneró contenido.
  **Lo verificado del intento Codex (D-64).** Las trece descripciones de contaminación de la Parte A
  son exactas línea por línea contra los certificados, y los 36 certificados re-verifican con
  `logic-core`: 36/36 válidos y con meta alcanzada, comprobado de nuevo aquí. La Parte A tiene además
  un falso negativo bajo su propio criterio —`kc15-probes_baseline-11` es la misma forma «premisa
  enterrada + `∧E` + regla practicada» que sí marcó en kc10, kc12 y kc17—, así que **es diagnóstico,
  no censo**, y no debe leerse como si cubriera la muestra.
  **Corrección de una lectura propia que era falsa.** Al medir el banco aparecieron 96 firmas
  estructurales para 571 reactivos: los cinco de enseñanza de cada KC comparten firma, y los catorce
  de cada grupo KC×reserva también. Eso **no es un defecto**: P-I §7.8 define familia como los
  candidatos que comparten plantilla, función de banco, KC y `structural_signature`, y dice que
  renombrar átomos **no** crea familia nueva; `collisionProhibited()` documenta además que dentro de
  una reserva la colisión no está prohibida —prohibirla dejaría toda familia en un miembro— y que
  entre dos reservas de enseñanza tampoco, porque practicar guiado y después independiente sobre la
  misma estructura es andamiaje. Los 96 son la familia funcionando como se especificó. **No disuelve
  el desacuerdo de D-64**, que sigue abierto tal cual: es sonda contra reactivo de enseñanza, donde la
  colisión sí está prohibida, y ahí las firmas son todas distintas (0 compartidas).
  **G1 — clausura de reglas (`packages/authoring-core/src/probe-rule-closure.ts`).** Una sonda no
  puede exigir la regla de un KC **posterior** al que mide en la `teachingSequence` congelada: si la
  exige, un fallo no distingue el KC medido de la regla ajena y la respuesta incorrecta deja de ser
  interpretable. No es dificultad —eso ya lo cubre `difficulty_outside_declared_level`—, es validez.
  **La regla del KC medido sí entra, también en línea base**: que el alumno no la haya recibido es
  justamente lo que la línea base mide. Una primera versión la excluía y contaba 308 violaciones; era
  un error de diseño mío, no del banco.
  **Resultado sobre el banco: 70 sondas** —14 de `probes_baseline` y 56 de `probes_intervention`—.
  `retention` y `TRANSFER_MEASUREMENT` no tienen techo porque se administran después de la unidad.
  La causa es común y está en las plantillas: `sonda-cond_meta` importa `→I` (KC09),
  `sonda-conj_premisa` importa `∧E` (KC05) y `sonda-disy_meta` importa `∨I` (KC07). **No se parchean
  a mano**; caen con la regeneración.
  **Lo que la guarda no juzga, contado y expuesto** por `probesExemptFromRuleClosure()`: **128 sondas**
  de los tres KC de fundamento (KC01, KC02, KC08), que no enseñan regla. KC01 y KC02 abren la
  secuencia, así que toda derivación que se les plantee usa reglas posteriores; aplicarles la clausura
  los declararía inmedibles en bloque, que es una conclusión sobre el diseño del SCED y no algo que
  decida una guarda de reglas (§5.2.1 los trata como soporte pre-SCED, D-59). Un recorte sin contar se
  lee como cobertura completa, así que se devuelve en vez de descartarse.
  **La entrada son las líneas del certificado, no `FoundProof.rulesUsed`**, que no registra la
  reiteración: una guarda alimentada desde ahí no vería nunca una violación por `R`. Como con la
  secuencia congelada `R` no puede violar nada —KC03 es el primer KC con regla—, la prueba lo
  comprueba con la secuencia permutada, que es el parámetro que la función recibe para no cablear el
  orden; sobre la congelada pasaría aunque `R` se ignorase.
  **Arreglo de la regla de entrada de las pistas (`premiseEntryRule()` en `hints.ts`).** El nivel 2
  tabulaba la regla de eliminación por el **conectivo principal** de la premisa y para la negación
  devolvía siempre `¬E`. Pero `¬E` es «φ, ¬φ ⊢ ⊥» y **no saca `A` de `¬¬A`**: eso es `DNE`. La
  distinción es de **forma** de la premisa, no de conectivo —`¬A` sí se ataca con `¬E`—, así que
  corregir la tabla no bastaba; `FORMAS.not.elim` queda en `null` para que nadie la reintroduzca.
  **Alcance real: 10 reactivos, todos de KC16, en 7 reservas** —la Parte A vio 2 porque solo 2 estaban
  en la muestra—. El generador ya está arreglado; **el banco no se ha regenerado**, así que los 10
  siguen defectuosos y hay prueba que lo fija.
  **Las dos comprobaciones nacen afirmando el defecto**, como la de KC13 (D-56): fijan 70 y 10 y se
  sustituyen por la contraria al regenerar. Sus controles positivos ejercitan **el mismo código** que
  la comprobación, no una reimplementación, y ambas comprueban antes que no pasan por vacío —474
  sondas miradas, y el resto del banco sí nombra la regla correcta—.
  **Lo que sigue pendiente y es del propietario:** el arreglo de `→E` con re-congelado a `cal-09-v2`,
  y el umbral de contaminación —si el renombrado de átomos crea reactivo nuevo a efectos de §7.7—,
  que fija las guardas de variedad de formas y anticontaminación y que va a `blocked-by-spec.md`.
  **+22 pruebas unitarias: 1687 en verde** (1665 antes), más las 131 contra PostgreSQL 17 real.
  **CI: corrida `32604466870` sobre `f7d0ad2` observada en verde, los diez jobs — D-65 `VERIFICADA`.**
- **D-5 — Nombre de `theme.json`.** T-H0-09 lo nombra así; el ZIP trae `_ds_manifest.json` (48 tokens). Se vendoriza con ese contenido bajo el nombre `ds-manifest.json`, con su hash de origen registrado.
