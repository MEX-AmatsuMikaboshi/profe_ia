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
| git | — | 2.55.0, remoto configurado el 15-08-2026 | ✅ |
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

## Las siete trampas de esta máquina

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
6. **Sockets AF_UNIX fantasma: Docker Desktop no arranca dos veces seguidas.** Ver abajo.
7. **`turbo` en paralelo tumba procesos de `tsc` (2026-08-21; corregido el 2026-08-22).**
   Se anotó como «con Docker Desktop arrancado» y **no es condición necesaria**: volvió a pasar con
   Docker parado, en `ci:typecheck` y en `ci:build`, y la segunda corrida del mismo comando pasó
   entera. Es presión de memoria de la máquina, no Docker.
   `ci:build` y `ci:typecheck` fallan con `exit 134` (SIGABRT), `0xC0000409` o `0xC000001D`, en
   **un paquete distinto cada vez** y sin un solo error de compilación: el mismo paquete
   typechequea limpio si se lanza suelto. No es el código, es memoria. Salidas, por orden de
   coste: **relanzar el mismo comando** —a veces pasa a la segunda—, `--concurrency=1`, y si
   Docker está arriba y no hace falta, `pnpm run dev:docker:stop`. Diagnosticar el paquete que
   aparece en el mensaje es perder el rato: no es siempre el mismo.
   **Ojo con `--`**: desde que `ci:typecheck` encadena un segundo comando (`&& tsc -p
   infra/database/tsconfig.test.json`, D-62), `pnpm run ci:typecheck -- --concurrency=1` le pasa la
   bandera **al `tsc` final** y falla con `TS5023`. Para serializar, `pnpm exec turbo run typecheck
   --concurrency=1`.

## Trampa nº 6 — sockets AF_UNIX fantasma (2026-08-18)

**Síntoma.** Docker Desktop muestra «An unexpected error occurred» y el backend deja en
`%LOCALAPPDATA%\Docker\log\host\com.docker.backend.exe.log`:

```
backend crashed … starting services: initializing Inference manager:
listening on unix://C:/Users/…/Docker/run/dockerInference:
remove C:/Users/…/Docker/run/dockerInference:
The file cannot be accessed by the system.
```

**Causa real.** Docker Desktop crea sus sockets AF_UNIX como reparse points de cero bytes. En esta
máquina esos archivos **sobreviven al apagado, limpio o no**, y una vez huérfanos Windows no los
deja ni borrar ni consultar: `DeleteFile`, `Remove-Item`, `del` y `fsutil reparsepoint query`
devuelven todos el error **1920 (`ERROR_CANT_ACCESS_FILE`)**. Al arrancar, Docker intenta *remover*
el socket anterior antes de rebindear, ese `remove` falla y el backend se cae.

**Crear los sockets sí funciona.** Lo único roto es borrar los que ya están. Por eso el fallo es
**recurrente y determinista**: cada arranque deja los sockets que harán fallar al siguiente.

**Son dos directorios, no uno.** Limpiar sólo `%LOCALAPPDATA%\Docker\run` mueve el fallo al
`Secrets Engine`, que usa `%LOCALAPPDATA%\docker-secrets-engine`. Con los dos limpios el motor
levanta en 5 s.

**Qué se descartó, con evidencia:**

- No es `%LOCALAPPDATA%` como ubicación: el fallo es por archivo huérfano, no por carpeta.
- No es estado del kernel: **reiniciar el equipo no lo cura**, porque los archivos están en disco.
  Se reinició el 2026-08-18 y el socket seguía sin poder borrarse.
- No es el driver: `afunix.sys` 10.0.26100.8972 está presente y el servicio `afunix` en `RUNNING`.
- No es el sistema de archivos: `C:` es NTFS.
- No es Defender: `EnableControlledFolderAccess = 0` y sin reglas ASR.
- No es `com.docker.service`: está en `Running`/`Automatic`.

**Solución.** `pnpm run dev:docker` — `scripts/dev/docker-desktop.mjs`. Vacía los dos directorios
antes de lanzar Docker Desktop y espera al motor. Lo que no se deja borrar lo aparta moviendo el
directorio padre a `<dir>.fantasma\<n>`: mover el padre sí está permitido aunque su contenido sea
inaccesible. Si el fallo apareciera en un tercer directorio, lo limpia, reintenta y **dice la ruta**
para añadirla a `DIRECTORIOS_SOCKET`.

`dev:docker:clean` limpia sin arrancar y `dev:docker:stop` apaga. Arrancar Docker Desktop **a mano**
(icono o menú de inicio) vuelve a fallar: no hay atajo, hay que pasar por el script.

**Lo que queda sucio.** Los directorios `*.fantasma\<n>` y los `*.roto*` de sesiones anteriores
contienen archivos de 0 bytes que nadie puede borrar. Son inertes. El script reintenta purgarlos en
cada arranque por si alguna vez se dejan.

**Sin resolver:** por qué esos reparse points quedan inaccesibles. Diagnosticarlo más a fondo exige
elevación (`fltmc filters`, `fsutil fsinfo`), que no se tuvo. El arreglo evita la causa, no la
explica.

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
