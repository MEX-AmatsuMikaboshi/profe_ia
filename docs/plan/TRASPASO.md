# Traspaso de sesión — 2026-08-30 (F9 completa; ya no queda superficie que construir)

Documento corto para retomar en otra conversación. El detalle está en
[`HANDOFF.md`](HANDOFF.md) y [`PLAN_STATUS.md`](PLAN_STATUS.md); esto es lo mínimo para no empezar
de cero.

## Pégale esto al chat nuevo

> Retomo el proyecto Profesor IA en `C:\Users\gabri\Documents\edu_ia\profesor_ia_code`.
> Lee `docs/plan/HANDOFF.md` (cabecera «EMPIEZA AQUÍ») y sigue desde ahí.
> **F9 está completa y F10 va 11 de 14**: no queda nada construible en ninguna de las dos.
> Hay **quince commits subidos el 2026-08-30**: lo primero es **mirar Actions** y comprobar la
> corrida job por job, porque hasta que no haya verde en `main` ninguna tarea puede pasar a
> `VERIFICADA`. Después, la pasada de promoción `HECHA` → `VERIFICADA` (~55 tareas, una por una).

## Lo que cambió en esta sesión

**F9 pasa de tener política a estar entera.** Las tres cosas que le faltaban están hechas:

| | Qué era | Qué quedó |
|---|---|---|
| `T-CC-02` | el enganche del W0 generalizado | `runGeneralizedW0()`: otro recorrido con otra salida, no el experimental con la guarda aflojada (D-93) |
| `T-CC-05` | las cuatro vistas | Inicio, Mis materias, Detalle y Progreso, para los dos carriles, sin calcular ninguno de los tres números que podrían inventar (D-94) |
| AC de F9 | el e2e crear-materia → clase | `ci:e2e:course-creation`, con la prueba de aislamiento **por consulta cruzada** (D-95) |

## Dónde quedó

| Fase | Estado |
|---|---|
| F8 · Profesor IA de sesión | **cerrada** — 7 de 7, `ci:e2e:live-session` en verde. Falta el acta firmada `docs/gates/H7.md`, que es tuya |
| F9 · Cursos personalizados | **completa**: 5 de 5 tareas y el AC cubierto. Sólo falta la corrida verde en `main` para promover |
| F10 · Multimodal | **11 de 14 — no queda nada construible.** Calibración congelada (`T-H8-11`), BENCH-03 (`T-H8-12`) y tu corrida funcional (`T-H8-14`) |
| F11 · `LOCAL_SELF_USE` | **ya no está bloqueada por nada nuestro.** Sus tres tareas son tu corrida, tu informe y tu decisión GO/NO-GO |

## Lo que funciona hoy, y cómo verlo

```bash
pnpm run demo
```

Abre `http://localhost:3010`. Desde esta sesión, Inicio ya no dice `NO_IMPLEMENTADO`: se ve la
materia activa con su punto de retorno, la materia propia en preparación, «Mis materias» con los dos
carriles separados, el detalle y el progreso. Todo declarado en pantalla como **datos de
demostración**, porque `apps/api` aún no sirve cursos. La clase sigue en
`/materias/logica/clase`, y su recorrido está en [`../session/demo.md`](../session/demo.md).

```bash
pnpm run ci:e2e:course-creation
```

El criterio de aceptación de F9. No gasta nada.

## Las tres cosas que esta sesión decidió, y por qué

1. **El W0 generalizado es otro recorrido, no `runW0()` con la guarda aflojada.** Aflojarla habría
   producido, para «Revolución mexicana», un `SelectionManifest` idéntico al del curso experimental,
   y desde ahí nada en el tipo distingue el corpus que W1 puede ingerir del que no. La etapa que
   falta —la mayoría contra `authorized-calculus-v1`— no está omitida: **no existe** para una
   materia sin sistema formal, así que no hay campo donde declararlo.
2. **Las vistas no calculan ninguno de los tres números que podrían inventar.** Progreso son
   recuentos, no porcentajes; la retención se declara `retention_not_evaluated`; el consumo ausente
   se dice con palabras y no como `0,00` —un cero con el ledger vacío afirma que no se ha gastado
   nada, que no es lo mismo que no saberlo—. Y **Progreso tiene dos formas**: la materia propia no
   tiene campos de dominio, porque «0 dominados de 0» sería una afirmación que nadie midió.
3. **El aislamiento se comprueba por consulta cruzada.** Registro a registro ya lo prueba
   `course-isolation.test.ts`. Lo que se ataca aquí es que **la consulta** devuelva de más, que es
   el fallo silencioso: el análisis corre igual y produce números con la misma cara que los buenos.

## Lo siguiente, por orden

1. **Mirar Actions y hacer la pasada de promoción `HECHA` → `VERIFICADA`.** Lleva cinco sesiones
   pendiente: ~55 tareas cuya evidencia hay que comprobar una por una contra las corridas de CI.
   Promoverlas en bloque sería firmar sin mirar. **Es lo más importante que queda que no dependa de
   ti.**
2. **Re-correr BENCH-01** con D-77 y D-79 puestos, 3 repeticiones, ~MXN 145. La semilla no cambia.
3. **W5** cuando rompas su circularidad.
4. Y con F9 y F10 donde están, **F11 ya se puede empezar** — es tuya.

## Lo que es tuyo y ningún modelo sustituye

- El **acta firmada** del gate H7 (`docs/gates/H7.md`).
- La revisión humana de los 200 casos de BENCH-01 (D-41).
- La auditoría de calidad pedagógica en muestra ciega (§6.2).
- La lectura humana por muestra del paso 19, sobre el banco de 656.
- La **Parte A ciega** a una familia que no sea candidata de BENCH-01.
- **Romper la circularidad de W5.**
- Las tres tareas de **F11**: `T-LSU-01` (tu corrida de extremo a extremo con el curso de lógica
  **y al menos una materia propia**), `T-LSU-02` (tu informe de valor con costos reales) y
  `T-LSU-03` (tu decisión GO/NO-GO del Bloque B).

## Lo que esta sesión NO cerró, y conviene no dar por hecho

- **La suite contra PostgreSQL no se pudo correr en local.** Docker Desktop volvió a caer por la
  trampa 6 (`Docker Desktop is unable to start` tras el crash del secrets-engine), incluso con
  `pnpm run dev:docker`, que es el mitigador. Las 131 pruebas las corre CI en el job `db`; **no
  están verificadas localmente en esta sesión.**
- **`ci:a11y:baseline` sigue auditando sólo la vista de Clase.** Las cuatro vistas nuevas heredan la
  regla de tamaño de objetivo por hoja de estilo, que es menos de lo que una corrida de axe
  demostraría. Ensanchar ese informe es trabajo de `T-H8-10`, no de F9.
- **Las vistas se alimentan de un paquete sintético**, declarado en pantalla (UIUX §2). No hay
  `apps/api` sirviendo cursos.
- **F9 sigue `EN_CURSO`** aunque esté completa: sin corrida verde observada en `main` no hay
  `VERIFICADA`.

## Si vienes a seguir trabajando: cómo se trabaja aquí

Cuatro cosas que este repositorio da por sabidas y cuestan una sesión si no se saben.

1. **Sembrar antes de creer.** Cuando un control sale verde a la primera, no está comprobado: hay
   que romper lo que vigila y ver que **falla, y sólo por eso**. En esta sesión se hizo cinco veces
   y siempre dijo algo: una de ellas demostró que el e2e recorre la cadena de verdad (rompe 7 de 13
   pruebas, exactamente las que la atraviesan).
2. **Una prueba puede estar mal en la dirección contraria.** La de términos prohibía «validad»
   también **negado**, y «no está validada por el experimento de lógica» es justo la frase que la
   norma exige. Corregida — y de paso destapó jerga interna en la pantalla del alumno.
3. **PowerShell 5.1 destroza la codificación al reescribir un archivo** (trampa nº 8 de
   `docs/env/windows.md`). Comprobación: `file archivo` debe decir `UTF-8 text`.
4. **Turbo y vitest agotan la memoria de esta máquina** (trampa nº 9, nueva). `exit 134` con
   `Zone Allocation failed` es memoria, no un error de tipos: `--concurrency=2` y `--maxWorkers=2`.

Y la de siempre: **si se toca el lockfile hay que regenerar SBOM y digest en el mismo cambio** — pasó
otra vez aquí, al añadir `domain-engine` a `apps/web`.

## Números al cerrar

**2223 pruebas unitarias** (2160 → 2174 con el W0 generalizado → 2210 con las vistas → 2223 con el
e2e). Depcruise sobre **593 módulos** sin violaciones, con sus controles positivos. Lint, typecheck
41/41, build 25/25, axe sin violaciones, SBOM y drift regenerados, y `plan:status` (D-1…D-95) en
verde. **131 pruebas contra PostgreSQL 17 no se corrieron** (ver arriba).

**Los números se miden, no se suponen**: los 2223 salen de `--project unit`, y sumarlos con los de
`db` bajo la misma etiqueta ya produjo cifras incomparables en sesiones anteriores.

Reglas de trabajo que siguen vigentes: los **commits** son por tarea con `PLAN_STATUS.md` en el
mismo commit; los **pushes se agrupan** —el propietario fijó el corte en **quince commits**— porque
el presupuesto de Actions es de USD 5. Y **nunca se versiona `.env`**: `git status --short` antes de
cada commit.
