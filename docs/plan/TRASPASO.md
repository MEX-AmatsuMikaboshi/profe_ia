# Traspaso de sesión — 2026-08-29 (F10 en 9 de 14)

Documento corto para retomar en otra conversación. El detalle está en
[`HANDOFF.md`](HANDOFF.md) y [`PLAN_STATUS.md`](PLAN_STATUS.md); esto es lo mínimo para no empezar
de cero.

## Pégale esto al chat nuevo

> Retomo el proyecto Profesor IA en `C:\Users\gabri\Documents\edu_ia\profesor_ia_code`.
> Lee `docs/plan/HANDOFF.md` (cabecera «EMPIEZA AQUÍ») y sigue desde ahí.
> F8 está cerrada y F10 va **9 de 14**: ya está hecho todo lo que no necesita proveedor de voz.
> Hay **tres commits sin subir** (se agrupan por presupuesto de Actions).

## Dónde quedó

| Fase | Estado |
|---|---|
| F8 · Profesor IA de sesión | **cerrada** — 7 de 7 tareas, `ci:e2e:live-session` en verde. Falta el acta firmada `docs/gates/H7.md`, que es del propietario |
| F10 · Multimodal | **9 de 14** — los tres CRITICAL sin proveedor, pizarrón, evidencia, capacidades, línea base de accesibilidad, captura interna y telemetría H8. Lo que falta necesita voz, calibración congelada o corrida humana |
| F9 · Cursos personalizados | no empezada. Es paralela y no condiciona gates, pero **F11 depende de ella** |
| F11 · `LOCAL_SELF_USE` | **no la puede construir nadie más que el propietario** (ver abajo) |

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

## Las tres cosas que hay que entender antes de decidir

### 1. F11 no es código: es que el propietario use el sistema

Sus tres tareas son `T-LSU-01` (corrida funcional del propietario de extremo a extremo), `T-LSU-02`
(su informe de valor con costos reales y autonomía observada) y `T-LSU-03` (su decisión GO/NO-GO del
Bloque B). **No hay forma de programarlas.** Lo que se puede hacer es dejarlas listas, y para eso
hacen falta F9 y F10.

### 2. Las «credenciales de voz», en llano

Hoy el Profesor IA **sólo escribe**. F10 es donde pasa a hablar y a escuchar, y ninguna de las dos
cosas se programa desde cero: se contratan.

- Que **escuche** se llama STT (*speech-to-text*): convierte lo que el alumno dice en texto.
  Candidatos del plan: Deepgram, o el servicio de transcripción de OpenAI.
- Que **hable** se llama TTS (*text-to-speech*): convierte la respuesta escrita en voz.
  Candidatos: ElevenLabs, o el de OpenAI.

Una **credencial** es la llave que esa empresa te da al contratar. Se guarda en
`infra/compose/.env`, igual que la de Anthropic —`MODEL_CREDENTIAL_ANTHROPIC_SESION`— que ya está y
es la que hace que el profesor pueda responder por escrito.

**Si no las hay no se rompe nada**: la clase por escrito sigue funcionando. Sólo se quedan quietas
`T-H8-01` y `T-H8-02` y lo que depende de ellas.

### 3. Dos calibraciones lanzan a propósito

`visionThresholds()` y `maxAnnotationAgeMs()` **fallan cerrado**. No es deuda ni un bug: elegir esos
números decidiría con una suposición cuándo el sistema afirma haber leído bien un manuscrito, que es
donde nacen los errores confiados. Se congelan en `T-H8-11` / BENCH-03. **No los «arregles»
devolviendo un número.**

## Lo siguiente, por orden

1. **La pasada de promoción `HECHA` → `VERIFICADA`.** Lleva tres sesiones pendiente: ~50 tareas cuya
   evidencia hay que comprobar una por una contra las corridas de CI. Promoverlas en bloque sería
   firmar sin mirar.
2. **Decidir lo de las credenciales de voz** (§2 de arriba). Puede salir más barato de lo que
   parecía: la credencial de OpenAI que ya está en `.env` **sí da acceso al catálogo de audio**, y
   varios de esos modelos publican snapshot fechado. Falta comprobar la facturación con una llamada
   real, y que la documentación declare el snapshot (`refresh-sources.mjs`), que es lo que D-76 exige.
3. **Re-correr BENCH-01** con D-77 y D-79 puestos, 3 repeticiones, ~MXN 145. La semilla no cambia.
4. **W5** cuando el propietario rompa su circularidad.

## Dos decisiones de esta sesión que solo tú puedes tomar

1. **Los checks `ci:a11y:baseline` y `ci:a11y:catches` no están en `ci.yml`.** No cuestan dinero de
   proveedor, pero sí minutos de Actions: necesitan `next build` y descargar Chromium en el runner.
   Con el presupuesto en USD 5, enchufarlos por push es gasto que no correspondía decidir sin ti.
2. **El contraste de la paleta.** axe lo marca como *serious* en `.tag`, `.card-kicker` y los
   botones de apelación y retirada. **No se tocó a propósito**: no está entre los once criterios de
   la línea base, y el lenguaje visual está diferido a producto (§10.5).

## Lo que es del propietario y ningún modelo sustituye

- El **acta firmada** del gate H7 (`docs/gates/H7.md`).
- La **decisión sobre credenciales de voz**.
- La revisión humana de los 200 casos de BENCH-01 (D-41).
- La auditoría de calidad pedagógica en muestra ciega (§6.2).
- La lectura humana por muestra del paso 19, sobre el banco de 656.
- La **Parte A ciega** a una familia que no sea candidata de BENCH-01.
- **Romper la circularidad de W5.**
- Las tres tareas de **F11**.

## Un fallo de CI que conviene conocer (D-85)

`visual-interaction` se creó con 43 pruebas y **sin `tsconfig.test.json`**, así que ningún proyecto
de TypeScript las compilaba. El typecheck local pasaba —41 de 41 tareas— no porque estuvieran bien,
sino porque nadie las miraba. Lo cazó `ci:arch:test-typecheck` en CI.

**Regla que deja:** un paquete nuevo con pruebas necesita **tres** cosas, no una:

1. su `tsconfig.test.json`,
2. su script `typecheck` encadenando los dos proyectos,
3. sus dependencias de prueba declaradas en el `package.json`.

El árbol se ve verde sin ninguna de las tres. Y si se toca el lockfile, `ci:supply:drift` exige
regenerar SBOM y digest **en el mismo cambio**.

## Números al cerrar

**2018 pruebas unitarias** más 131 contra PostgreSQL 17 real. Depcruise sobre **551 módulos** sin
violaciones. **Cuidado con el número de partida**: este documento decía 1949 y el árbol en `HEAD`
daba **1951** — se midió con `git stash` en vez de suponerlo, y el delta de +67 cuadra exacto
(26 + 19 + 22). La última corrida de CI observada sigue siendo **`33288171686` sobre `07fa669`**,
los diez jobs en verde; los tres commits de esta sesión **no están subidos todavía**.

Reglas de trabajo que siguen vigentes: los **commits** son por tarea con `PLAN_STATUS.md` en el
mismo commit; los **pushes se agrupan** porque el presupuesto de Actions es de USD 5. Y **nunca se
versiona `.env`**: `git status --short` antes de cada commit.
