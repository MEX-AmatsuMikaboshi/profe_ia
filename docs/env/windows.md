# Entorno del propietario — Windows 11 (T-H3-03)

**Verificado:** 2026-08-15. *Norma:* P-II §0.4 — estos son **datos de planificación**;
los límites reales de carga los mide H8, no este documento.

## Lo verificado

| Requisito | Declarado en el plan | Instalado | Estado |
|---|---|---|---|
| Sistema | Windows 11 | Windows 11 Pro 10.0.26200 | ✅ |
| Node | 24.x LTS (`.nvmrc`) | v24.16.0 | ✅ |
| pnpm | 10.x | 10.34.5 | ✅ con desviación (ver abajo) |
| Docker Engine | familia 27.x | 29.7.2, motor Linux, overlayfs | ✅ con desviación D-7 |
| WSL2 | requerido | versión predeterminada 2, distribución `docker-desktop` | ✅ |
| PostgreSQL | 17 | 17.11 (imagen `postgres:17-alpine`) | ✅ |
| git | — | 2.55.0, sin remoto configurado | ✅ |
| Python | 3.13.x | 3.12 | ⚠️ solo relevante en F16 |

## Rendimiento base observado

Medido en esta máquina, para dimensionar la espera de quien trabaje aquí. No son
umbrales ni compromisos.

| Operación | Tiempo |
|---|---|
| `ci:unit` (357 pruebas, proyecto `unit`) | ~3 s |
| `ci:db:negative` (103 pruebas, PostgreSQL real en Testcontainers) | ~12,5 s |
| `ci:logic:mutation` (1 166 mutantes, concurrencia 4) | ~7,5 min |
| `ci:arch:depcruise` (58 módulos) | ~2 s |

## Las cinco trampas de esta máquina

Son reales y cuestan una hora cada una si no se conocen.

1. **`PATH` de Docker.** Una consola abierta **antes** de instalar Docker conserva el `PATH` viejo
   y Testcontainers falla con `spawn docker-credential-desktop ENOENT`. Abre una consola nueva o
   antepón `C:\Program Files\Docker\Docker\resources\bin`. Los scripts de `scripts/dev/` y
   `scripts/infra/` ya lo hacen solos.
2. **pnpm fuera de corepack.** `corepack enable` falla por permisos en `C:\Program Files\nodejs`,
   así que pnpm está instalado con npm en `%APPDATA%\npm`. Si no se encuentra, antepón
   `$env:APPDATA\npm` al `PATH`.
3. **`.cmd` desde Node.** Lanzar `pnpm.cmd`/`npx.cmd` con `execFile` sin shell falla con `EINVAL`
   desde Node 20. Ya resuelto en `scripts/supply/pnpm-exec.mjs` (usa `npm_execpath`) y en
   `scripts/arch/verify-depcruise-catches.mjs` (invoca el entrypoint `.mjs` con `process.execPath`).
4. **Bash de Git y `$APPDATA`.** En el Bash que viene con Git, `$APPDATA` se expande a una ruta
   Windows dentro de un contexto POSIX y el shim de pnpm resuelve a
   `C:\Program Files\Git\Users\...\pnpm.cjs`, que no existe. **Usa PowerShell para pnpm.**
5. **Stryker.** Necesita `plugins: ["@stryker-mutator/vitest-runner"]` declarado (pnpm aísla el
   descubrimiento automático) y no acepta `vitest.project`. Ver además la nota de paralelismo en
   `docs/quality/mutation-baseline.md`: con archivos de prueba en paralelo, la cobertura `perTest`
   se atribuye mal y aparecen **falsos supervivientes**.

## Docker Desktop: cómo está configurado

- Motor Linux sobre WSL2 (no contenedores Windows). El compose de `infra/compose/` asume Linux:
  `read_only`, `cap_drop`, `tmpfs` y `no-new-privileges` no tienen equivalente en contenedores
  Windows.
- Los volúmenes son volúmenes de Docker, no montajes del sistema de archivos de Windows, salvo el
  repositorio de contenido y `infra/backups`, que sí son bind mounts. El rendimiento de E/S entre
  Windows y WSL2 es la razón: la base de datos nunca vive en un bind mount.
- El socket de Docker **no se monta en ningún contenedor**. Lo comprueba `ci:infra:hardening`.

## Desviaciones registradas

- **D-7** — Docker Engine 29.7.2 frente a la familia 27.x declarada en el plan. No afecta a la
  autoridad reproducible (`lockfile` + SBOM + digests); los digests de imagen se fijan en el freeze.
- **pnpm por npm** en vez de corepack, por la restricción de permisos descrita arriba.
- **Python 3.12** frente a 3.13.x. Solo entra en juego en F16 (análisis); no bloquea nada hasta ahí.
