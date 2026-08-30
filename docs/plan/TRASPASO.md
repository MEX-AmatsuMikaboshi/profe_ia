# Traspaso de sesión — 2026-08-30 (F10 en 11 de 14, F9 con su política puesta)

Documento corto para retomar en otra conversación. El detalle está en
[`HANDOFF.md`](HANDOFF.md) y [`PLAN_STATUS.md`](PLAN_STATUS.md); esto es lo mínimo para no empezar
de cero.

## Pégale esto al chat nuevo

> Retomo el proyecto Profesor IA en `C:\Users\gabri\Documents\edu_ia\profesor_ia_code`.
> Lee `docs/plan/HANDOFF.md` (cabecera «EMPIEZA AQUÍ») y sigue desde ahí.
> **Ya no queda nada construible en F10**, y F9 tiene su política puesta.
> Hay **nueve commits sin subir** (se agrupan por presupuesto de Actions).

## Lo que cambió en esta sesión

**Se acabó lo que se podía construir sin ti.** Las dos cosas que faltaban y no dependían de nadie
están hechas:

| | Qué era | Qué quedó |
|---|---|---|
| `T-H8-01/02` | la voz: que el Profesor IA hable y escuche | STT, TTS y el lexicón de verbalización, con reconstrucción exacta de fórmulas comprobada por propiedad (D-91) |
| `T-CC-01…05` | el carril de materias propias, del que **F11 depende** | modelo de cursos, aislamiento experimental, autoridad de evaluación por dominio, flujo observable y etiquetado (D-92) |

## Dónde quedó

| Fase | Estado |
|---|---|
| F8 · Profesor IA de sesión | **cerrada** — 7 de 7, `ci:e2e:live-session` en verde. Falta el acta firmada `docs/gates/H7.md`, que es tuya |
| F10 · Multimodal | **11 de 14 — no queda nada construible.** Las tres que faltan son calibración congelada (`T-H8-11`), BENCH-03 (`T-H8-12`) y tu corrida funcional (`T-H8-14`) |
| F9 · Cursos personalizados | **política completa, superficie no.** Faltan las cuatro vistas, el enganche del W0 generalizado y el e2e crear-materia→clase |
| F11 · `LOCAL_SELF_USE` | **no la puede construir nadie más que tú.** Sus tres tareas son tu corrida, tu informe y tu decisión GO/NO-GO |

## Lo que funciona hoy, y cómo verlo

```bash
pnpm run demo
```

Abre `http://localhost:3010/materias/logica/clase`. Levanta verificador + api + web sin Docker. El
recorrido de la demo, con qué preguntar y qué contestar a cada objeción, está en
[`../session/demo.md`](../session/demo.md).

```bash
pnpm run ci:e2e:live-session
```

El criterio de aceptación del gate H7. **Gasta céntimos** contra el proveedor real.

## Los tres puntos que antes había «que entender antes de decidir»: cerrados

Los tres estaban abiertos como decisiones. Ya no lo están, y lo que queda de cada uno es o trabajo
tuyo o una nota de mantenimiento.

1. **La voz — cerrado.** No había que contratar nada (D-89: la llave de OpenAI que ya está en `.env`
   sirve para TTS y STT, comprobado de ida y vuelta) **y ya está construido** (D-91). Lo que sigue
   sin estar medido es la **calidad** con un micrófono real en una habitación con ruido: eso es
   BENCH-03, y no se puede hacer sin umbrales congelados. Que funcione y que entienda bien a un
   alumno son dos afirmaciones distintas, y sólo la primera está demostrada.
2. **F11 no es código — cerrado como decisión, abierto como trabajo tuyo.** No hay nada que
   programar ahí, y ya no hace falta seguir discutiéndolo: lo que hacía falta era dejarla
   arrancable, y F9 y F10 son lo que faltaba para eso.
3. **Las dos calibraciones que lanzan — cerrado como regla permanente.** `visionThresholds()` y
   `maxAnnotationAgeMs()` fallan cerrado **a propósito** y se congelan en `T-H8-11`/BENCH-03. No es
   un pendiente que revisar cada sesión: es cómo tiene que quedarse hasta que exista el número. **No
   los «arregles» devolviendo un valor.**

## Lo siguiente, por orden

1. **La pasada de promoción `HECHA` → `VERIFICADA`.** Lleva cuatro sesiones pendiente: ~50 tareas
   cuya evidencia hay que comprobar una por una contra las corridas de CI. Promoverlas en bloque
   sería firmar sin mirar. **Es lo más importante que queda que no dependa de ti.**
2. **La superficie de F9**: las cuatro vistas de UIUX §6, el enganche del W0 generalizado y el e2e
   crear-materia → clase con prueba de aislamiento por consulta cruzada. Es lo que separa a F9 de
   estar cerrada, y lo que hace cómoda tu corrida de F11.
3. **Re-correr BENCH-01** con D-77 y D-79 puestos, 3 repeticiones, ~MXN 145. La semilla no cambia.
4. **W5** cuando rompas su circularidad.

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

## Dos fallos de CI que conviene conocer

**D-85 — un paquete nuevo con pruebas necesita tres cosas, no una.** `visual-interaction` se creó con
43 pruebas y sin `tsconfig.test.json`, así que ningún proyecto de TypeScript las compilaba. El
typecheck local pasaba no porque estuvieran bien, sino porque nadie las miraba. Hacen falta:

1. su `tsconfig.test.json`,
2. su script `typecheck` encadenando los dos proyectos,
3. sus dependencias de prueba declaradas en el `package.json`.

El árbol se ve verde sin ninguna de las tres. Y si se toca el lockfile, `ci:supply:drift` exige
regenerar SBOM y digest **en el mismo cambio** — pasó otra vez en `T-H8-01/02`, y el check lo cazó.

**La misma lección, otra vez, en el propio comprobador del plan.** `check-status.mjs` sólo reconocía
ids `T-Hx-nn`, así que las filas de F9 (`T-CC-nn`) y las de F11 (`T-LSU-nn`) **no se validaban**: un
estado mal escrito ahí habría pasado inadvertido. Corregido en esta sesión — de 91 tareas vigiladas
a 96. **Que un control exista no es lo mismo que vigile lo que crees.**

## Números al cerrar

**2160 pruebas unitarias** (2024 → 2089 con la voz → 2160 con F9) más 131 contra PostgreSQL 17 real.
Depcruise sobre **576 módulos** sin violaciones, con sus controles positivos. Lint, typecheck 41/41,
build 25/25 y `plan:status` (D-1…D-92) en verde.

**Los números se miden, no se suponen**: el traspaso anterior decía «tres commits sin subir» en la
cabecera y «seis» en el cierre, y el árbol daba siete. Hoy son **nueve**, contados con
`git rev-list --count origin/main..HEAD`. La última corrida de CI observada sigue siendo
**`33288171686` sobre `07fa669`** — es decir, **nada de lo de las dos últimas sesiones se ha visto
en verde en `main` todavía**, y por eso ninguna de esas tareas puede pasar a `VERIFICADA`.

Reglas de trabajo que siguen vigentes: los **commits** son por tarea con `PLAN_STATUS.md` en el
mismo commit; los **pushes se agrupan** porque el presupuesto de Actions es de USD 5. Y **nunca se
versiona `.env`**: `git status --short` antes de cada commit.
