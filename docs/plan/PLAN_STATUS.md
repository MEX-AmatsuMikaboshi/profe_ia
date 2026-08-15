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
| T-H0-05 | REQUIRED | HECHA | `.github/workflows/ci.yml` | 2026-08-14 | Jobs `ci:lint`, `ci:typecheck`, `ci:unit`, `ci:arch:depcruise`, `ci:db:testcontainers`, `ci:build`, `ci:supply:*`. Primera ejecución en Actions el 15-08-2026; descubrió que el job `arch` corría `depcruise` sin build previo y no resolvía `@profesor-ia/*` (en local pasaba por tener `dist/` de corridas anteriores). Corregido con un paso de build. **Segunda ejecución (run 31875819628): `base` y `logic` en rojo**, y los dos hallazgos son consecuencia de haber cerrado D-2. (1) `secrets.GITHUB_TOKEN` solo alcanza a `profe_ia`, así que el clon del submódulo privado falla con `Repository not found` — que es lo que GitHub responde a un privado sin acceso, no a un repo inexistente. Se resuelve con un PAT fine-grained de solo lectura en el secreto `CONTENT_TOKEN`, que `checkout` aplica al repo principal **y** al submódulo (necesita `Contents: Read` en ambos); un paso previo falla con mensaje explícito si el secreto no está, en vez de dejar que `checkout` muera con un error críptico. (2) **El check «conjunto dorado reproducible» pasaba por vacío**: `git diff --exit-code -- content/…/golden-tests` se ejecutaba en el padre, cuyo índice desde D-2 solo guarda un gitlink, de modo que no veía ningún cambio de contenido y devolvía 0 siempre. Ahora corre dentro del submódulo con `add -A` + `diff --cached` (`git diff` a secas tampoco vería un caso **nuevo**). Comprobado con dos siembras —caso modificado y caso nuevo— antes de escribir la corrección: la forma vieja devolvía 0 en ambas, la nueva devuelve 1. |
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
| T-H2-08 | CRITICAL | HECHA | `packages/proof-search/`, `test/search.test.ts` (24 pruebas) | 2026-08-14 | Cuatro funciones separadas (P-I §7.4): prefiltro semántico → buscador → **re-verificación obligatoria por logic-core** → sin decisor terminante. Corte primario en unidades de trabajo deterministas; el timeout de pared solo protege el proceso y se registra aparte. `no_proof_exists_in_calculus` **no existe** en la implementación (CALC-03). `exhaustive_k` solo certifica `minimalCostVerified` tras cubrir todos los costes menores; si no halla, solo afirma `no_proof_with_cost_at_most_k`. Un certificado rechazado por el verificador lanza `CertificateRejectedError` (incidente nivel 3), no se disfraza de «no encontré». |
| T-H2-09 | CRITICAL | HECHA | `packages/isomorphism-canonicalizer/`, `test/canonicalize.test.ts` (16 pruebas) | 2026-08-14 | Firma estructural sobre el grafo de dependencias: invariante al renombrado de átomos, al orden de citas y al reordenamiento de pasos independientes; duplicado trivial como caso más estricto. Los nombres canónicos son átomos válidos del lenguaje, así que la forma canónica se puede volver a parsear. `ci:arch:depcruise` confirma que la ruta de verificación no lo importa (54 módulos, violación sembrada detectada). `[CALIBRATION CAL-07]` precisión/recall sigue abierto para H5/H10. |
| T-H2-14 | REQUIRED | HECHA | `packages/proof-search/src/complexity.ts`, `test/complexity.test.ts` (17 pruebas) | 2026-08-15 | Las medidas literales de P-I §7.6, separadas en dos grupos: `structural` (solo depende del enunciado y de la solución) y `searchRelative` (depende del presupuesto). Esa separación es lo que impide leer «nodos explorados» como total de caminos: dos presupuestos distintos con la misma solución dan `structural` idéntico y `searchRelative` distinto, y hay prueba de ello. Mide **solo soluciones re-verificadas**: un certificado que `logic-core` rechaza lanza `UnverifiedSolutionError`. El escalar no existe todavía — `complexityIndex()` y `assertComparable()` fallan cerrado con `CAL-09` (se congela en H5, `T-H5-10`) en vez de agregar con pesos inventados. Distancia estructural: D-10. |
| T-H2-16 | BENCHMARK BENCH-04 | HECHA | `packages/proof-search/src/bench.ts`, `test/bench.test.ts` (13 pruebas) | 2026-08-15 | Arnés L0 con muestra fija de 7 casos y dos órdenes equivalentes (`prefiltro→búsqueda` de referencia y `búsqueda→prefiltro`), habilitados por el parámetro aditivo `semanticOracle` de `search()` (el orden por omisión no cambia). Mide «desempeño **y seguridad**» (anexo E.2): cinco códigos de hallazgo —certificado no re-verificado, certificado rechazado, desacuerdo con la referencia, minimalidad fuera de `exhaustive_k` y corte de pared usado como afirmación lógica— y **cualquier hallazgo vuelve el informe no comparable**. Cada código tiene su variante sembrada en pruebas, incluida la trampa de P-I §7.4 (tomar la validez semántica por prueba de derivabilidad). El informe no tiene campo «ganador»: `freezeWinningOrder()` falla cerrado hasta F6 (`T-H5-05`). Sin reloj inyectado el informe es determinista. |

## F3 — H3 · Entorno local reproducible

| Tarea | Etiqueta | Estado | Evidencia | Fecha | Notas |
|---|---|---|---|---|---|
| T-H3-01 | REQUIRED | HECHA | `infra/compose/docker-compose.yml`, `Dockerfile`, `apps/*/src/main.ts`; **10 servicios `healthy`** verificados con `ci:infra:compose-up` | 2026-08-15 | Los ocho servicios del plan más `redis` y `otel-collector` (D-13). Imagen única parametrizada por `APP`. Cada app recibe un entrypoint mínimo de salud y logs estructurados (D-11), sin adelantar lógica de fases posteriores. Tres fallos reales encontrados al levantarlo, no al leerlo: `postgres` y `redis` no arrancaban porque sus entrypoints hacen `chown`/`setpriv` como root y `cap_drop: ALL` se lo impide —se resolvió arrancándolos ya como su propio usuario, sin devolver capabilities—, y a Infisical le faltaba su base, que ahora crea el init de PostgreSQL. |
| T-H3-02 | REQUIRED | HECHA | `scripts/dev/compose.mjs`, `scripts/dev/generate-env.mjs`, `scripts/db/apply-migrations.mjs` | 2026-08-15 | `dev:env`/`dev:up`/`dev:seed`/`dev:backup`/`dev:restore` (+ `down`, `status`, `logs`). `dev:seed` ejecutado contra el entorno real: **6 migraciones aplicadas y 7 roles acreditados**. Corre **dentro** de la red interna: la base nunca se publica al host. `dev:env` no sobreescribe un `.env` existente. |
| T-H3-03 | REQUIRED | HECHA | `docs/env/windows.md` | 2026-08-15 | Windows 11 Pro 10.0.26200, Docker 29.7.2 motor Linux, WSL2, Node 24.16.0, PostgreSQL 17.11. Con tiempos base medidos y las cinco trampas del entorno, incluida la nueva: el Bash de Git rompe `$APPDATA` y pnpm no resuelve. |
| T-H3-04 | CRITICAL | HECHA | `scripts/infra/check-compose-hardening.mjs` — **159 comprobaciones en verde** | 2026-08-15 | Lee la configuración **resuelta** por Docker, no el YAML. Socket de Docker sin montar en ningún servicio, `no-new-privileges`, `cap_drop ALL`, raíz de solo lectura, sin root, seccomp activo, puertos solo en `127.0.0.1`. Y las tres fronteras: `verifier` con `network_mode: none` (I-3), `solutions-private` solo en autoría (I-2), sondas solo en medición (I-4). Cuatro imposibilidades técnicas registradas y **impresas en cada corrida**. |
| T-H3-05 | REQUIRED | EN_CURSO | `infra/compose/otel-collector.yaml` | 2026-08-15 | Colector local con OTLP y `filelog` (única vía del verificador, que no tiene red). **Los servicios no emiten spans**: no hay operación que trazar hasta F7/F8, y un span de «arranqué» para poder decir que hay trazas sería éxito simulado. Se cierra con la primera operación real. |

**Gate H3:** `docs/gates/H3.md` — abierto. Falta `T-H3-05`, la inicialización de Infisical (acción del propietario) y la ejecución en `main`.

## Fases siguientes

| Fase | Hito | Estado | Bloqueo actual |
|---|---|---|---|
| F3 | H3 · Entorno local | EN_CURSO | 4 de 5 tareas; `T-H3-05` espera la primera operación instrumentable |
| F2 | H2 · cierre del gate | EN_CURSO | Las 16 tareas están HECHAS; falta la ejecución en `main` |
| F4–F16 | — | PENDIENTE | Ver dependencias en `Plan.md` §9 |

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
- **D-5 — Nombre de `theme.json`.** T-H0-09 lo nombra así; el ZIP trae `_ds_manifest.json` (48 tokens). Se vendoriza con ese contenido bajo el nombre `ds-manifest.json`, con su hash de origen registrado.
