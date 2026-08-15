# HANDOFF — punto de continuación

**Fecha del checkpoint:** 2026-08-14
**Para:** la siguiente sesión que continúe la ejecución de `Plan.md`.

Este archivo es el punto de entrada. Léelo entero antes de tocar nada, y después
[`PLAN_STATUS.md`](PLAN_STATUS.md), que es la fuente de verdad de avance (§12 del plan).

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
| **F1 · H1** BD, roles, evidencia | AC del gate cubierto. Falta `T-H1-05` (Better Auth) |
| **F2 · H2** verificador | 14 de 16 tareas. Faltan `T-H2-14` y `T-H2-16` |
| **F3 · H3** entorno local | No empezada. **Desbloqueada**: Docker ya funciona |
| F4–F16 | No empezadas |

Detalle tarea por tarea, con evidencia y fechas: [`PLAN_STATUS.md`](PLAN_STATUS.md).
Actas de gate: [`../gates/`](../gates/) — `H0.md`, `H1.md`, `H2.md`, todas **abiertas**.

---

## 3. Por dónde seguir

Lo que quedó sobre la mesa, en el orden que recomiendo:

### a) Cerrar F2 (camino crítico)

- **`T-H2-14` índice de complejidad estructural.** Norma: Maestro P-I §7.6 (línea ~1154).
  Longitud/garantía, reglas distintas, profundidad/subpruebas, premisas, conectivos,
  descarga/indirecta, coste/nodos sin interpretarlos como total de caminos, distancia estructural.
  **Los pesos NO se inventan aquí**: se fijan y congelan en H5 (`CAL-09`), y H6 no abre sin eso.
  Prerrequisito del gate H5, así que conviene hacerlo pronto.
- **`T-H2-16` arnés BENCH-04.** Compara en L0 `prefiltro semántico → proof search` contra
  alternativas equivalentes. Solo el arnés; la corrida y el congelamiento del orden son de F6.
- **Mutation testing**: 81.99 %. Ver [`../quality/mutation-baseline.md`](../quality/mutation-baseline.md)
  para el desglose y la regla de operación. El trabajo restante está en `verify.ts` y `parser.ts`.

### b) F3 · H3 — entorno local

Docker 29.7.2 con motor Linux ya está operativo. Falta `infra/compose/` con los ocho servicios,
scripts `dev:up`/`dev:seed`/`dev:backup`/`dev:restore`, el hardening de `T-H3-04` (socket de Docker
no montado, egress por función, `solutions-private` solo en procesos autorizados) y OpenTelemetry local.

### c) `T-H1-05` Better Auth

Es lo único que impide firmar el acta H1.

---

## 4. Cómo verificar que todo sigue en pie

```bash
pnpm install
pnpm run ci:lint && pnpm run ci:typecheck && pnpm run ci:unit && pnpm run ci:build
pnpm run ci:arch:depcruise && node scripts/arch/verify-depcruise-catches.mjs
pnpm run ci:logic:golden && pnpm run ci:logic:pbt && pnpm run ci:logic:no-net
pnpm run db:grants:check && pnpm run ci:db:negative
pnpm run ci:supply:sbom && pnpm run ci:supply:drift
```

Estado en el checkpoint: **todo en verde**. 391 pruebas unitarias + 103 contra PostgreSQL 17 real.

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
   **No edites fuentes con una corrida en marcha**: trabaja sobre una copia y los resultados salen falsos.
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
  `PLAN_STATUS.md` con su causa. Van D-1 a D-9.
- **Un PR, una tarea `T-*`**, y `PLAN_STATUS.md` actualizado en el mismo PR (§12).

---

## 7. Lo que no está verificado y conviene no olvidar

- **Ningún check está «en verde en `main`».** No hay remoto git ni ejecución de GitHub Actions, así
  que por §0.4 ninguna tarea puede marcarse `VERIFICADA`. Todo lo que dice `HECHA` está verificado
  localmente y es reproducible.
- **El ZIP de mockups no coincide** con el hash de §0.1, aunque el HTML normativo interno sí
  coincide byte a byte. Registrado en `packages/ui-tokens/vendor/PROVENANCE.md`; corresponde al
  aprobador confirmar o corregir la referencia.
- **Los tokens vendorizados cargan Archivo desde Google Fonts** con un `@import`. Incompatible con
  local-first durante una corrida: hay que autoalojar la fuente en la capa de la app antes de que
  `apps/web` los consuma. Anotado en el mismo `PROVENANCE.md`.
- **Calibraciones abiertas por diseño**: `CALC-03` (decisor terminante), `CALC-05` (cota tabla↔SAT),
  `CAL-04` (conjunto dorado), `CAL-07` (isomorfismo), `CAL-08`, `CAL-09` (complejidad).
  `docs/params/registry.yaml` está vacío a propósito: se llena cuando un gate real congele un valor.

---

## 8. Estado del control de versiones

Dos repositorios git independientes, ambos con su commit de checkpoint y **sin remoto**:

- **Monorepo**: raíz del proyecto.
- **Contenido**: `content/unidad-deduccion-natural/`, historial propio (§4.3 del plan). El monorepo
  lo registra como gitlink; falta formalizarlo con `git submodule add` cuando exista un remoto (D-2).

Para ver dónde quedó todo: `git log --stat -1` en cada uno.
