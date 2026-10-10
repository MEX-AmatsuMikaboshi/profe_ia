# AUDITORÍA DE PROFESORÍA

**Fecha:** 2026-09-02 · **Commit auditado:** `8d21aff` (+ 5 archivos modificados sin confirmar)
**Alcance:** auditoría de sólo lectura. **No se modificó ningún archivo de producción.**
**Método:** lectura documental (Maestro, UIUX, `Plan.md`, `PLAN_STATUS.md`), inspección de código,
ejecución real de la aplicación con navegador, y 12 auditorías paralelas con verificación adversarial
de cada hallazgo crítico.

**Cómo leer este informe.** Cada afirmación lleva evidencia reproducible: `ruta:línea`, salida de
comando, o comportamiento observado en el navegador. Lo que no pude demostrar va marcado
**HIPÓTESIS**. Cuando una fuente del propio proyecto resultó desactualizada, lo digo y doy el dato
correcto.

---

## A. Resumen ejecutivo

**Profesoría no está lejos del producto esperado por falta de construcción. Está lejos por falta de
conexión.**

Ésa es la conclusión central, y cambia por completo qué hay que hacer. El proyecto tiene 25 espacios
de trabajo, ~30 000 líneas de TypeScript en `packages/`, 2 253 pruebas unitarias en verde, doce
comprobaciones de CI que pasan, y componentes de calidad genuinamente alta: un verificador de
deducción natural que funciona y es riguroso, una máquina de estados de sesión reconstruible por
eventos, una política pedagógica determinista de 22 reglas, un banco de 656 reactivos con pistas
justificadas, una pasarela de modelo con anclaje y filtro de egreso que **funciona contra el
proveedor real**.

Y la pantalla del alumno no usa casi nada de eso.

La vista de Clase se alimenta de `apps/web/src/clase/dry-session.ts`, un archivo de 182 líneas que
fabrica una sesión de mentira con **una** actividad escrita a mano y dos turnos de un catálogo
sintético de dos entradas. Se carga con `useMemo(() => drySessionViewInput(), [])`
([ClaseSession.tsx:52](apps/web/src/clase/components/ClaseSession.tsx#L52)): **el arreglo de
dependencias vacío significa que el estado de la sesión no puede cambiar nunca durante la vida de la
página.**

Las tres consecuencias que producen la sensación de «web estática»:

1. **La clase ya ocurrió antes de pintarse.** `drySessionSnapshot()` recorre los seis estados
   pedagógicos —`autenticacion` → … → `practica`— en un bucle `for` al importar el módulo. Cuando el
   alumno ve la pantalla, la sesión ya está en `practica` y ahí se queda. El único llamador no-test
   de `transitionPrimarySessionState` en todo el repositorio es ese archivo.
2. **Nada progresa.** Verificado con clics reales en el navegador: los controles «Pedir pista»,
   «Pausar», «No estoy de acuerdo» y «Detener mi participación» **no tienen manejador de eventos**.
   Cero peticiones de red, cero cambios en el DOM. Y acertar la derivación no avanza nada: el
   veredicto se pinta y ahí termina.
3. **El alumno no puede hacer la actividad central del curso.** El editor Fitch es de **sólo
   lectura**: sus líneas son `<span>` con MathML y no hay un solo campo de entrada, ni control para
   añadir línea, elegir regla o citar. El único gesto de edición disponible —la paleta de símbolos—
   **corrompe la premisa dada**: pulsar `∧` convirtió `A∧B` en `A∧B∧` y disparó `E-SYN-PRECEDENCE`.

Lo notable es que **cuando algo está conectado, funciona bien**. Comprobado en vivo:

- El verificador resolvió correctamente los tres casos que le mandé en 0,4–1 s, distinguiendo válida
  de meta alcanzada (`valid: true, goalReached: false`), con `E-RULE-SHAPE` y un mensaje útil.
- El Profesor IA respondió en 3,5 s con dos segmentos **anclados al material real** del corpus, con
  su mango `F-5ca02f0b`, regla de política aplicada y `canGroundEvaluation: true`.
- La voz de salida **suena de verdad**: tres locuciones en `es-MX` vía `speechSynthesis`.

Así que el diagnóstico no es «hay que rehacer Profesoría». Es que **entre el motor y la pantalla
falta una capa de conducción de sesión que nadie ha escrito todavía**, y en su lugar hay un fixture
de desarrollo que la sustituye desde F7. Esa capa —un servicio de sesión que conduzca la máquina de
estados, elija reactivos del banco, sirva pistas y persista— es la pieza que convierte todas las
demás en un producto.

### Los cinco números que resumen el estado

| | |
|---|---|
| Vistas exigidas por `Plan.md` §7.3 / implementadas | **9 / 5** |
| Componentes reutilizables exigidos por §7.7 / existentes | **7 / 1** |
| Estados de interfaz obligatorios (UIUX §9) con representación | **≈4 / 16** |
| Reglas de la política pedagógica alcanzables en ejecución | **1 / 22** |
| Filas de evidencia escritas por la aplicación en funcionamiento | **0** |

### La lectura honesta del avance declarado

`PLAN_STATUS.md` declara 109 tareas `VERIFICADA` y ninguna fase entre F2 y F10 cerrada —todas
`EN_CURSO`, a la espera de actas de gate. Ese recuento es fiel al criterio del proyecto y no lo
discuto. Pero **cuenta mecanismo construido, no experiencia entregada**, y el propio equipo ya se
tropezó con esa distinción: el `HANDOFF.md` cuenta que F10 figuraba como «11 de 14, no queda nada
construible» mientras `visual-interaction` y `speech-gateway` no los importaba ninguna app. Esta
auditoría encuentra el mismo patrón un nivel más arriba, y de forma más extendida.

**Esta auditoría es, en la práctica, el entregable `T-LSU-02`** —el «informe de valor» de la fase F11
(`LOCAL_SELF_USE`)— que `Plan.md` sitúa exactamente aquí: el propietario usa el sistema completo por
primera vez y documenta fallos, UX y autonomía observada. Que la experiencia decepcione en este punto
no es una sorpresa del plan: es el momento que el plan reservó para descubrirlo. `T-LSU-03` es
literalmente «backlog de correcciones no sustantivas antes del Bloque B».

---

## B. Arquitectura actual

### Forma general

Monolito modular con procesos aislados. `pnpm workspaces` + Turborepo, 25 espacios de trabajo,
TypeScript 5.9.3 `strict` con `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` y
`verbatimModuleSyntax`, ESM `NodeNext`, Node 24.

```
apps/          api · web · verifier · authoring-worker · background-worker · measurement-worker
packages/      16 paquetes (logic-core, session-engine, pedagogy-policy, model-gateway,
               speech-gateway, visual-interaction, contracts, domain-engine, content-schema,
               authoring-core, evidence, experiment, security-policy, proof-search,
               ui-tokens, isomorphism-canonicalizer)
tools/         cli · bench · observability
content/       submódulo unidad-deduccion-natural (corpus, 656 reactivos, KC01–KC18)
```

### Peso real de cada paquete, y quién lo consume

Barrido sistemático de importaciones desde `apps/`:

| Paquete | LOC | Importado por |
|---|---:|---|
| `authoring-core` | 10 040 | ninguna app — sí `tools/cli` y `scripts/content/*` |
| `domain-engine` | 4 630 | `web` |
| `model-gateway` | 3 317 | `api` |
| `experiment` | 3 272 | `measurement-worker` |
| `session-engine` | 3 077 | `api`, `web` |
| `proof-search` | 2 119 | ninguna app — sí `authoring-core` |
| `pedagogy-policy` | 1 921 | `api` |
| `visual-interaction` | 1 868 | `web` |
| `logic-core` | 1 851 | `api`, `verifier`, `web` |
| `contracts` | 1 704 | `api`, `measurement-worker`, `web` |
| `speech-gateway` | 1 172 | `web` |
| `evidence` | 946 | **ninguna app, y ningún llamador de escritura** |
| `security-policy` | 550 | `api` |
| `content-schema` | 473 | `api` |
| `isomorphism-canonicalizer` | 164 | ninguna app (prohibido en la ruta de verificación, por diseño) |
| `ui-tokens` | 52 | vía CSS generado |

Ningún paquete está muerto: todos tienen consumidor legítimo en algún sitio. Pero la columna importa
para leer el resto del informe: **`evidence` es el único cuya razón de ser —escribir la bitácora— no
se ejerce nunca**.

### El frontend, en cifras

`apps/web/src` son **5 193 líneas** en 43 archivos. Seis rutas:

```
/                              Inicio
/materias                      Mis materias
/materias/[materiaId]          Detalle de materia
/materias/[materiaId]/progreso Progreso
/materias/[materiaId]/clase    Clase
/health                        salud
/[...ruta]                     → NO_IMPLEMENTADO
```

`layout.tsx` es, literalmente, `<html lang="es"><body>{children}</body></html>` más importaciones de
CSS. **No hay cabecera compartida, ni navegación, ni ningún elemento persistente entre vistas.** No
existe `loading.tsx`, `error.tsx` ni `not-found.tsx` en ninguna ruta.

### El backend, en cifras

`apps/api` expone **tres rutas** y nada más; el resto responde `501 NO_IMPLEMENTADO`:

| Método | Ruta | Qué hace | Estado observado |
|---|---|---|---|
| GET | `/health` | salud del servicio | ✅ 200 |
| POST | `/clase/verificacion` | derivación → spool → verificador aislado → veredicto | ✅ 200 en 0,4–1 s |
| POST | `/clase/turno` | bucle W7 completo contra el proveedor | ✅ 200 en 3,5 s |

Los otros cuatro procesos de `apps/` (`authoring-worker`, `background-worker`, `measurement-worker`,
y el propio `verifier` más allá del spool) son entrypoints de contenedor sin pipeline conectado al
producto.

`apps/web` alcanza `apps/api` por un `rewrite` de Next declarado en
[next.config.mjs](apps/web/next.config.mjs) (`/clase/:path*` → `API_ORIGIN`), resuelto **en el
servidor de Next**, de modo que el cliente nunca conoce la pasarela. Comprobado funcionando desde el
navegador.

### Los invariantes son ejecutables, y se respetan

`.dependency-cruiser.cjs` codifica 13 reglas `forbidden` que son los invariantes I-1…I-9. Las corrí:
`ci:arch:depcruise` pasa sobre 593 módulos, y sus dos controles positivos comprueban que las reglas
**detectan** una violación sembrada. Esto es infraestructura de calidad real, y condiciona cualquier
propuesta: el verificador no puede tener red (I-3), la web no puede alcanzar `solutions-private`
(I-2), sólo `model-gateway` habla con proveedores (I-1).

### El diagnóstico arquitectónico en una frase

La arquitectura está bien cortada por dominios y mal cortada por **ciclo de vida**: existe todo lo
necesario para decidir qué enseñar y para verificar lo que el alumno responde, y no existe el
componente que **lleva una sesión de principio a fin**. Ese hueco lo tapa hoy un fixture del cliente.

---

## C. Flujo actual del usuario

Recorrido real con la aplicación en marcha (`pnpm run demo`, web en `:3010`, api en `:3011`).

### C.1 Abrir Profesoría

Se abre en `/`. Lo primero que ocupa la pantalla es una franja gris: *«Datos de demostración. Las
materias, el avance y las fechas de esta pantalla vienen de un paquete sintético de desarrollo…»*.
Después: **Inicio** → «Donde te quedaste» → *Deducción natural proposicional* con un botón rojo
**Continuar clase**; debajo «Materias en curso» repite la misma materia con el mismo botón; y
«Materias en preparación» muestra *Revolución mexicana* con un botón deshabilitado.

**No hay identificación de usuario.** No hay login, ni perfil, ni concepto de «yo». `apps/api/src/auth.ts`
implementa Better Auth completo —passkey, TOTP, cookies seguras, política de contraseña— y **no lo
importa nadie**: `main.ts` no lo monta y ninguna ruta lo sirve.

### C.2 Seleccionar materia

`/materias` separa «Curso del experimento» de «Tus materias» y, por cada una, declara tres estados
distintos (paquete técnico / auditoría y benchmarks / resultado experimental). Esta pantalla está
**bien hecha**: cumple UI-CORR-01 al pie de la letra y se niega a mezclar «validado» con «benchmark
técnico».

### C.3 Iniciar clase

Aquí ocurre el primer problema estructural: **no hay inicio de clase**. «Continuar clase» es un
`<a href>` a `/materias/logica/clase`. Se navega a una URL y aparece la clase, ya en curso, con la
sesión en estado `practica`. No hay preparación, ni saludo, ni transición, ni cambio de modo. Es
navegación web, exactamente la sensación que se quiere evitar.

Además, **la ruta ignora su propio parámetro**: `/materias/loquesea/clase` renderiza la misma sesión
seca de lógica, incluida la materia en preparación que la pantalla anterior declara no disponible.

### C.4 Estar en clase

La pantalla presenta, de arriba abajo y compitiendo entre sí:

1. el aviso de sesión seca, otra vez;
2. la palabra **`practica`** en crudo, arriba a la izquierda: el identificador interno del enum;
3. el enunciado de la actividad;
4. el **Pizarrón** (Excalidraw completo, con sus ~17 herramientas y su propia pareja
   deshacer/rehacer, junto a la del editor Fitch);
5. la **Derivación** (editor Fitch de sólo lectura);
6. «Enviar al verificador»;
7. la **Revisión local**;
8. en la columna lateral: **Rúbrica**, **Profesor IA** (la transcripción) y **Pregúntale sobre este
   bloque** (un `<textarea>` con su botón);
9. abajo: los cuatro controles de sesión.

**No hay `<h1>`, ni `<nav>`, ni un solo enlace: no existe forma de volver.** La única salida es el
botón «atrás» del navegador.

### C.5 Interactuar con Profesoría

El profesor **no toma la iniciativa nunca**. La conducción está invertida: el alumno debe redactar en
texto libre qué quiere preguntar, en un campo titulado «¿Qué quieres preguntarle?». Cuando lo hace,
el sistema responde bien —lo comprobé— pero es el alumno quien dirige la clase, no Profesoría.

El panel no tiene memoria: `TurnState` es un estado único que se reemplaza, así que cada pregunta
borra la anterior.

### C.6 Micrófono y voz

**No hay micrófono.** Ningún control, en ninguna pantalla. `voiceInput` está en `false` y encenderlo
lanza `CAPACIDAD_NO_IMPLEMENTADA`.

**La voz de salida existe y suena**, pero sólo aparece *dentro* de la respuesta a una pregunta
manual, como un botón «Escuchar la explicación» que hay que pulsar. La lección propiamente dicha —los
dos turnos de la transcripción— **no se puede escuchar**. Profesoría nunca habla por iniciativa
propia.

### C.7 Hacer la actividad

Aquí el flujo se rompe del todo. El enunciado pide «Deriva A a partir de la premisa A∧B» y **no hay
forma de escribir la derivación**. El editor muestra la premisa y ofrece ocho botones de símbolo que
concatenan al final de la última línea. No hay «añadir línea», ni selector de regla, ni citas, ni
subpruebas.

Se puede enviar al verificador —eso funciona— pero sólo se puede enviar la premisa sola, que produce
el veredicto correcto y honesto: *«La derivación es válida, pero su última línea no es la meta
pedida.»*

### C.8 Pausa, reanudación y fin

Ninguna de las tres existe. Los cuatro controles son inertes. Y **no hay fin de clase**: la sesión
empieza al navegar y termina al cerrar la pestaña. No hay cierre, ni resumen, ni retorno a Progreso.

### C.9 Cerrar y volver a abrir

Se pierde todo. Comprobado en el navegador: `localStorage`, `sessionStorage` y `document.cookie`
están **vacíos**, y la única base IndexedDB es la de depuración de Next. No hay base de datos en la
demo, y `EVIDENCE_EVENT_INSERT_SQL` **no tiene ningún llamador** en el repositorio.

El «punto de retorno» del Inicio (`data-resume-point="kc-13/actividad-2"`) es una constante escrita a
mano en `demo-data.ts`. No apunta a nada.

### El flujo, en un diagrama

```
Inicio ──► Mis materias ──► Detalle ──► [Continuar clase] ──► Clase ──► ∅
  │                                                             │
  └── Progreso (datos sintéticos)                                └── sin salida, sin cierre,
                                                                     sin guardado, sin retorno
```

`Plan.md` §5.1 exige: `Clase → cierre/guardado → Progreso / siguiente sesión`. Los tres últimos
tramos no existen.

---

## D. Flujo objetivo recomendado

Antes del diseño, una comprobación que cambia el encuadre: **fui a buscar a la especificación UI/UX
si el «modo clase» que quieres ya estaba pedido.** No lo está. UIUX §6.5 describe la Clase como un
*layout* —«material protagonista, Profesor IA visible sin volver la pantalla un chat»— y §5.1 da la
secuencia de pantallas. No hay máquina de estados de aplicación, ni turn-taking, ni presencia.

Eso significa que **lo que pides no es una corrección de una desviación: es una decisión de producto
nueva**, compatible con la especificación pero no derivable de ella. Merece registrarse como tal, y
la UIUX es congelable pero no está congelada (§14), así que hay vía legítima para ampliarla.

### La experiencia objetivo, contada desde el alumno

> Abro Profesoría. Sé quién soy y veo una sola cosa: **la clase de hoy** —qué vamos a ver, cuánto
> dura, y dónde lo dejé—. Pulso empezar.
>
> **La pantalla cambia.** La navegación desaparece. Profesoría me saluda **en voz alta** y me dice qué
> vamos a hacer hoy y por qué, y mientras habla veo escrito lo que dice, con las marcas de qué se
> apoya en el material del curso.
>
> Cuando termina de hablar, **sé que me toca**: el indicador cambia y el micrófono se abre para mi
> turno. Le contesto hablando. Veo que me está escuchando, después que está pensando, después que va
> a responder. Si prefiero escribir, escribo.
>
> **La actividad aparece cuando toca**, no antes: Profesoría explica, me pone un ejercicio y entonces
> —y sólo entonces— se abre el editor. Escribo mi derivación. Si me atasco, se lo digo con mis
> palabras y me da una pista, del nivel que corresponda; sabe cuántas llevo. Cuando envío, el
> verificador decide, y Profesoría **reacciona al error concreto** que el verificador clasificó.
>
> Si necesito parar, se lo digo: «Profesoría, pausa un momento». Lo entiende, me dice qué se guarda y
> qué se pierde, y se calla. Cuando vuelvo, retoma donde estábamos. (Y si el micrófono falla, hay un
> control discreto siempre visible para pausar y para salir.)
>
> Al final **Profesoría cierra la clase**: me resume qué trabajamos, qué quedó dominado, qué conviene
> repasar y cuándo es la siguiente. Vuelvo al entorno general y mi progreso está ahí, actualizado.

### Las dos capas de estado

Ésta es la decisión estructural más importante, y la razón de la sección I.2:

```
┌─ CAPA PEDAGÓGICA (autoritativa, servidor, va al ledger) ─────────────┐
│  preparada → autenticacion → consentimiento_confirmado →              │
│  diagnostico → explicacion → comprobacion → practica →                │
│  evaluacion_operativa → cierre                                        │
│  transversales: pausa · duda · recuperacion · sonda ·                 │
│                 fallo_pedagogico · incidente · invalidacion · retirada│
│  ▸ YA EXISTE en packages/session-engine. No se toca.                  │
└───────────────────────────────────────────────────────────────────────┘
                            │ se deriva ↓ (nunca al revés)
┌─ CAPA DE PRESENTACIÓN (cliente, efímera, NO va al ledger) ───────────┐
│  ocioso → preparando_clase → profesor_hablando ⇄ esperando_alumno ⇄   │
│  procesando_respuesta → mostrando_actividad → pausado →               │
│  reanudando → cerrando → terminada        (+ error/recuperación)      │
│  ▸ HAY QUE CONSTRUIRLA. Es la que produce la sensación de clase.      │
└───────────────────────────────────────────────────────────────────────┘
```

**Por qué dos y no una.** Cada transición pedagógica emite un evento que se lee después como evidencia
experimental. «El profesor está hablando» dura dos segundos y no es un hecho pedagógico: meterlo en
el ledger contaminaría la evidencia con ruido de interfaz y rompería la reconstrucción por replay.
Además, la capa pedagógica es lineal e irreversible por diseño; la de presentación necesita ir y
volver entre hablar y escuchar muchas veces dentro del mismo estado pedagógico.

Es el patrón que el proyecto ya aplica en `view-model.ts`, extendido en el tiempo.


---

## E. Auditoría funcional — inventario con estado

Estados: **✅ funciona** · **⚠️ defectuosa** · **◐ parcial** · **UI‑sin‑backend** · **backend‑sin‑UI**
· **✗ especificada y no implementada** · **➕ no especificada pero necesaria**

### E.1 Entrada y navegación

| Función | Estado | Evidencia |
|---|---|---|
| Abrir la aplicación (`/`) | ✅ | HTTP 200; `InicioView.tsx` |
| Identificación de usuario / login | **backend‑sin‑UI** | `apps/api/src/auth.ts` implementa Better Auth con passkey + TOTP; **no lo importa nadie**, `main.ts` no lo monta |
| Listado de materias | ✅ | `/materias`, `MisMateriasView.tsx` |
| Detalle de materia | ✅ | `DetalleView.tsx` |
| Progreso | ◐ | `ProgresoView.tsx` funciona pero se alimenta de `demo-data.ts` |
| Navegación persistente / volver | **✗** | `layout.tsx` es `<body>{children}</body>`; 0 `<nav>`, 0 enlaces en Clase |
| Crear materia propia | **backend‑sin‑UI** | `runGeneralizedW0()` VERIFICADO y con AC en verde; **cero superficie**, cero punto de entrada |
| Vista Investigación / Expediente | **✗** | exigida por `Plan.md` §7.3 |
| Vista Configuración | **✗** | exigida por §7.3; es donde vivirían voz y micrófono |
| Consolas técnica y de auditoría | **✗** | exigidas por §7.3 |
| Ruta inexistente | ⚠️ | devuelve **HTTP 200** con «NO_IMPLEMENTADO» y un texto interno obsoleto («En F7 sólo existe la vista de Clase») |

### E.2 La clase

| Función | Estado | Evidencia |
|---|---|---|
| Iniciar clase | **✗** | es un `<a href>`; no hay preparación ni transición de estado |
| Transición a «modo clase» | **✗** | no existe el concepto |
| Saludo / iniciativa del profesor | **✗** | el profesor sólo responde a preguntas escritas |
| Presentar contenido | ◐ | 2 turnos de un catálogo sintético de 2 entradas (`dry-session.ts`) |
| Transcripción de la conversación | ◐ | `<ol>` estático; sin voz, sin autoría, sin marcas de tiempo visibles |
| Preguntar al profesor | ✅ | verificado en vivo: 3,5 s, 3 segmentos anclados, `F-5ca02f0b` |
| Respuesta anclada + situación por segmento | ✅ | `anchored` / `non_factual_accompaniment` / `withheld` con etiqueta visible |
| Degradación sin proveedor | ✅ | `main.ts` responde 503 con causa; la vista lo declara |
| Reformulación tras fallo (T-H7-05) | **backend‑sin‑UI** | `previousTurn` es literalmente `null` en la ruta: nunca se ejecuta |
| Editor Fitch — leer | ✅ | MathML semántico, atributos de anotación estables |
| Editor Fitch — **escribir** | **⚠️ P0** | **sólo lectura**: 0 `input`, 0 `contenteditable`, sin añadir línea/regla/citas |
| Paleta de notación | ⚠️ | concatena al final de la última línea; **corrompió la premisa**: `A∧B` → `A∧B∧` |
| Deshacer / rehacer | ✅ | `fitch-document.ts`, 16 pruebas |
| Exportar | ◐ | `onExport` opcional; sin descarga observable |
| Revisión local no autoritativa | ✅ | con descargo permanente, incluso sin observaciones |
| Enviar al verificador | ✅ | verificado con clic real: veredicto correcto |
| Veredicto | ✅ | distingue `valid` de `goalReached` (D-9) |
| **Avanzar al acertar** | **✗** | `goalReached` sólo se usa para un texto y un atributo de traza |
| Pizarrón | ◐ | monta y produce `BoardOperation`; las operaciones se acumulan en un `ref` y **no se emiten** |
| Voz de salida | ◐ | suena (`speechSynthesis`, es-MX) pero sólo colgada de un turno ad-hoc |
| Voz de entrada / micrófono | **✗** | ningún control; `voiceInput: false` |
| Pistas | **backend‑sin‑UI + UI‑sin‑backend** | botón sin `onClick`; sin endpoint; 656×3 pistas cargadas en la api sin vía de entrega |
| Pausa | **UI‑sin‑backend** | botón inerte; verificado: 0 red, DOM idéntico |
| Reanudar | **✗** | no existe control |
| Apelación | **UI‑sin‑backend** | botón inerte — y es un **derecho declarado en pantalla** (UI-CORR-04) |
| Retirada | **UI‑sin‑backend** | botón inerte — mismo problema |
| Estado de guardado | ⚠️ | dice «✓ Guardado» sin que exista nada que guarde |
| Fin de clase / cierre | **✗** | no existe |
| Resumen post-clase | **✗** | `SessionSummary` está en §7.7 y no existe |
| Modo medición / sonda | **backend‑sin‑UI** | modelado y probado (12 propiedades); inalcanzable en ejecución |

### E.3 Persistencia y evidencia

| Función | Estado | Evidencia |
|---|---|---|
| Guardar progreso | **✗** | 0 escrituras; `localStorage`/`sessionStorage`/cookies vacíos |
| Reanudar sesión | **✗** | `data-resume-point="kc-13/actividad-2"` es una constante de `demo-data.ts` |
| Bitácora de evidencia | **backend‑sin‑UI** | ledger append-only con cadena de hashes, triggers, RLS y matriz de GRANT, probado contra PostgreSQL 17 real — y `EVIDENCE_EVENT_INSERT_SQL` **sin un solo llamador** |
| Telemetría OTel | ✅ | spans reales; la derivación del alumno se queda fuera por diseño (P-II §9.3) |

### E.4 Lo que existe en el backend y no tiene puerta de entrada

Ésta es la lista más valiosa del informe, porque es **trabajo ya hecho y desaprovechado**:

1. **Autenticación completa** (`auth.ts`, 13 pruebas verdes) — sin montar.
2. **Máquina de estados de sesión** (9 primarios + 8 transversales, replay total) — sin conductor.
3. **Motor de dominio / maestría** (`domain-engine`, 4 630 LOC) — hoy es **imposible que un KC pase a
   dominado**.
4. **Motor de pistas de niveles con autoridad de descalificación** — sin endpoint.
5. **Banco de 656 reactivos con enunciado y pistas** — cargado en `apps/api` y sin selector.
6. **Política pedagógica de 22 reglas** — sólo 1 alcanzable.
7. **Clasificación de dudas** (`classifyDoubt`) — sin llamador.
8. **Motor de recuperación** — sin llamador; `recuperacion` nunca se alcanza.
9. **Ledger de evidencia** — sin escritor.
10. **STT completo** (`stt.ts`, 432 líneas, 26 exports) — **cero consumidores**.
11. **Creación de materias propias** — sin superficie.
12. **Modo medición** — inalcanzable.

---

## F. Auditoría de voz — diagnóstico del pipeline

Esta sección es enteramente de comprobación propia: instrumenté `speechSynthesis` en el navegador y
rastreé cada símbolo exportado hasta sus consumidores.

### F.1 La cadena, eslabón por eslabón

| Eslabón | Estado | Evidencia |
|---|---|---|
| Micrófono / permisos | **AUSENTE** | `getUserMedia` no aparece en ningún archivo fuente del repositorio |
| Captura de audio | **AUSENTE** | ni `MediaRecorder` ni `AudioContext` en código fuente |
| Detección de voz (VAD) | **AUSENTE** | — |
| **STT** | **BIBLIOTECA SIN CONSUMIDOR** | `packages/speech-gateway/src/stt.ts`: 432 líneas, 26 exports, **0 usos fuera del paquete** |
| Procesamiento / modelo | ✅ | `/clase/turno`, verificado en vivo |
| Generación de respuesta | ✅ | 3 segmentos anclados |
| **TTS** | ◐ **FUNCIONA, PARCIALMENTE** | `window.speechSynthesis` + `SpeechSynthesisUtterance` en `VozProfesor.tsx:55,99` |
| Reproducción | ✅ | verificado: 3 locuciones `lang: es-MX`, `speaking: true`, 5 voces disponibles |
| Interrupción | ◐ | `interruptPlayback` conectado al botón «Detener»; `pausePlayback`/`resumePlayback` **sin consumidor** |
| Turn-taking | **AUSENTE** | no hay concepto de turno conversacional en la UI |

### F.2 El hallazgo más importante de la voz: el lexicón no se usa nunca

`packages/speech-gateway/src/lexicon.ts` son 380 líneas que traducen notación a habla —`∧` → «y»,
`↔` → «si y sólo si», `P` → «letra P»— con una propiedad demostrada por pruebas:
`deverbalizeFormulaText(verbalizeFormulaText(f)) === f`. Es la pieza que `T-H8-02` y P-I §8.10 exigen,
y el `HANDOFF.md` la describe como la decisión que ordena el paquete de voz.

**No se ejecuta jamás en la aplicación.** La cadena exacta:

1. `tts.ts:178` — `verbalizeSegment()` aplica el lexicón sólo a `kind: 'formula'`, `'rule'` y
   `'reference'`. Para `'prose'` devuelve el texto **intacto**.
2. `apps/web/src/clase/speech.ts` — `scriptFromTurn()` convierte **todos** los segmentos del turno a
   `{ kind: 'prose', text }`.
3. Resultado: `verbalizeFormulaText` no tiene ni un consumidor fuera de su paquete. Su única mención
   en `apps/` es dentro de un comentario.

**Consecuencia audible, capturada en vivo.** Lo que se entregó al sintetizador:

> «Para obtener A a partir de A∧B usas la regla ∧E (eliminación de la conjunción).»

El TTS recibe los caracteres Unicode `∧` y `∧E` en crudo. Un sintetizador `es-MX` no los pronuncia
como conectivos: los omite o los lee mal. Debería haber dicho «A y B» y «eliminación de la
conjunción», que es exactamente para lo que existe el lexicón.

**El código lo documenta con honestidad**: el comentario de cabecera de `speech.ts` explica que la
estructura se perdió al aplanar la salida del modelo en el contrato del turno, y que reconstruirla
con expresiones regulares sería adivinar. Esa decisión es **correcta**. Lo que falta es el campo en
el contrato: `TurnSegment` es texto plano con su `standing`, y debería conservar la segmentación
tipada que el modelo ya produce.

### F.2.b Siete roturas más de cableado en la mitad que sí funciona

Todas verificadas sobre el código y, cuando dice «en vivo», sobre la aplicación corriendo:

1. **Ningún evento de voz llega jamás al ledger.** `interruptPlayback()` devuelve un
   `InterruptionEvent` completo, y el único llamador **lo tira por desestructuración**:
   `const { playback } = interruptPlayback(actual, -1)` (`VozProfesor.tsx:127`). Los tipos
   `tts.utterance.start` y `tts.utterance.end` no los construye nadie.
2. **La interrupción miente sobre hasta dónde se habló.** Se pasa `-1` fijo, que el propio módulo
   documenta como «todavía ninguno», aunque el alumno haya escuchado dos de tres segmentos. La
   propiedad estrella del módulo —«una interrupción devuelve hasta dónde se dijo»— se pierde en el
   único sitio donde importaría.
3. **La voz no está gobernada por su bandera de capacidad.** `ProfesorPanel.tsx:131` monta
   `<VozProfesor>` sin consultar `capabilities.voiceOutput`. El pizarrón sí lo hace
   (`whiteboardVisible` se deriva en el modelo de vista); la voz no tiene equivalente. Es una
   asimetría con UIUX §6.5, que pide las dos igual.
4. **Las pausas pedagógicas se descartan.** P-I §8.10 las define como «órdenes estructuradas de la
   política y no decisiones libres del TTS», y `tts.ts` las modela con `ms` y `orderedBy`. El
   adaptador del navegador filtra todo segmento con texto vacío (`VozProfesor.tsx:89`), que es
   exactamente lo que es una pausa. Nunca se convierten en silencio.
5. **No se elige voz ni se espera a `voiceschanged`.** Sólo se fija `lang='es-MX'`; `utterance.voice`
   nunca se asigna. Observado en vivo: en el primer clic había **0 voces cargadas** y la aplicación
   entró igualmente en estado «hablando».
6. **Nada garantiza que la síntesis sea local.** El comentario de diseño afirma que el sintetizador
   «no manda el audio a nadie», y en esta máquina es cierto (las 5 voces son `localService: true`).
   Pero el código **no lee `localService` en ningún sitio**: con una voz remota, el texto del
   profesor viajaría al proveedor de voz. Choca con el «nada de red en tiempo de render» de
   P-II §0.3. *Prioridad P3, pero de una sola línea de arreglo.*
7. **Cero cobertura de prueba del único código que toca audio.** Las tres pruebas de `VozProfesor`
   usan `renderToStaticMarkup` con `synthesis={null}`: comprueban que el botón aparece, no que suene.
   Ninguna prueba invoca `hablar()`, `detener()`, `onerror` ni `onend`.

### F.2.c Una contradicción con la autoridad superior, demostrada ejecutándola

`packages/contracts/src/evidence-event.ts:66-88` transcribe **literal** la lista de familias de
evento multimodal de P-II §9.3 (`speech.capture.started`, `stt.committed`, `tts.requested`, …). **No
la importa nadie.** El catálogo que de verdad guarda la puerta es otro, declarado en
`packages/evidence/src/multimodal.ts:28`, y **es incompatible**. Comprobado ejecutando el paquete
compilado:

```
LANZA stt.committed          -> FAMILIA_DESCONOCIDA
LANZA speech.capture.started -> TIPO_DESCONOCIDO
LANZA tts.requested          -> TIPO_DESCONOCIDO
LANZA tts.failed             -> TIPO_DESCONOCIDO
LANZA tts.interrupted        -> TIPO_DESCONOCIDO
```

Es decir: **el validador de evidencia rechaza los nombres de evento que el Maestro manda usar.** Por
la jerarquía de autoridad del propio proyecto (`Plan.md` §0.1), aquí el código es el que está mal.
Hoy no tiene consecuencia visible porque ningún evento de voz se emite; el día que se emitan, o bien
fallarán, o bien entrarán al ledger con nombres que la norma no reconoce. *Prioridad:* **P1**.
*Complejidad:* **S** — es reconciliar dos listas, y hay que hacerlo **antes** de emitir el primer
evento de voz, no después.

Relacionado: `session-engine` **no entrega el léxico de sesión** que la norma le exige entregar al
`speech-gateway`. `buildSessionLexicon()` existe, con su lista cerrada de procedencias que deja fuera
al alumno —buen diseño anti-inyección— y no tiene productor: un grep de `tts|stt|voice|voz|speech|
audio` sobre `packages/session-engine/src` no devuelve **ninguna** coincidencia.

### F.3 El resto del diagnóstico

- **Dónde se iniciaría el micrófono:** en ningún sitio. No hay superficie, y `Configuración` —la
  vista que `Plan.md` §7.3 designa para «voz/micrófono»— no existe.
- **Cómo sabe el alumno que escucha / procesa / va a responder:** no lo sabe. El único indicador es
  el texto «Preguntando…» del botón. `TurnIndicator`, exigido por §7.7, no existe.
- **Sin micrófono / fallo de STT:** no aplica, no hay captura. UIUX §9 exige el estado «micrófono no
  disponible»; no está.
- **Fallo de TTS:** aquí sí hay diseño y es bueno: `degradeToText()` conserva el guion y marca
  `decisionChanged: false` — una caída de audio es presentación, no decisión.
- **Conversación continua / push-to-talk:** ninguna. `stt.ts` define
  `CAPTURE_MODES = ['push_to_talk', 'open_mic_turn']`, que es **literalmente** lo que UI-CORR-07 pide
  para la primera implementación. Está escrito y probado; no está conectado.
- **No existe adaptador de proveedor.** `speech-gateway` son tres archivos de política pura
  (`lexicon`, `stt`, `tts`) y **ningún adaptador**, pese a que el árbol del Maestro lo describe como
  «adaptadores TTS/STT y commits de transcripción». El sintetizador del navegador entró por la puerta
  de atrás: sin binding, sin snapshot, sin huella y **fuera del ledger de costos** — al contrario que
  toda llamada a modelo, que pasa por `model-gateway` con sus tres cosas.
- **La máquina de reproducción no se conduce entera:** de sus seis estados sólo se alcanzan tres.
  `pausePlayback`, `resumePlayback` y `completePlayback` no tienen llamador de producción, así que
  una locución que termina bien **nunca transita a `completed`**.
- **La voz queda fuera de la línea base de accesibilidad.** `scripts/a11y/baseline.mjs` enumera siete
  superficies y ninguna es la voz; el botón `voz-hablar` es además inalcanzable para su recorrido de
  foco, porque sólo aparece tras una respuesta real del proveedor. Y el informe declara `CRIT-TECLADO`
  **verificado** nombrando entre sus controles un micrófono que no existe.

### F.4 Sobre el bloqueo declarado de `voiceInput`

El proyecto justifica `voiceInput: false` con «falta decidir por dónde va el STT… el canal decide si
sale de la máquina; no es una decisión de implementación». La preocupación es legítima: UI-CORR-08
trata el audio bruto del alumno como dato del sujeto.

Pero conviene precisar el tamaño real del bloqueo:

- `Plan.md` `T-H8-01` **ya nombra los candidatos**: «Deepgram Flux Multilingual vs OpenAI streaming
  (reverificar)».
- UI-CORR-08 **ya resuelve** la parte normativa: el audio bruto va apagado por omisión y sólo se
  conserva bajo finalidad, consentimiento y política de borrado.
- La captura, la normalización, el `COMMIT` y la corrección enlazada **ya están construidos**.

Lo que falta es elegir proveedor y verificarlo, más registrar la decisión. **Y no está en
`docs/blocked-by-spec.md`**, que sigue vacío — de modo que un bloqueo real no aparece en el registro
que el proyecto creó justo para eso.

---

## G. Auditoría pedagógica — la materia de Lógica

### G.1 Lo que hay, con números

| Artefacto | Cantidad | Juicio |
|---|---|---|
| KC del grafo | **18** (KC01–KC18), tipados, con dependencias `FORMAL` / `POLITICA_CONTENIDO` y 3 fundacionales | sólido |
| Reactivos | **656**, todos aceptados, con certificado re-verificado por `logic-core` | sólido |
| Pistas | 656 × **3 niveles** = 1 968, con justificación de no revelación y anclas al texto fuente | ver G.3 |
| Objetivos | 18 observables (`objectives/objectives.yaml`) | correcto |
| Corpus fuente | forallx-yyc TFL, 77 fragmentos, licencia verificada | correcto |
| Contenido extraído | claims, definiciones, notación, reglas, restricciones (904 líneas) | correcto |
| **Rúbricas** | **0** — `rubrics/` contiene sólo un README de 3 líneas | **hueco** |
| **Ejemplos resueltos** | **0** | **hueco** |
| Plantillas de sesión | 1 archivo, 114 líneas | mínimo |

**El contenido es real y de buena calidad**, y conviene decirlo con claridad porque contradice la
impresión que da la pantalla. Un reactivo típico trae enunciado formal (`premises`, `goal`), enunciado
en español natural («Deriva D∧(E∧F) a partir de (D∧E)∧F usando solo las reglas del cálculo
autorizado»), perfil de complejidad estructural de 12 medidas, índice calibrado con `cal-09-v1`,
firma estructural y banderas de riesgo del crítico.

### G.2 Y casi nada llega a la pantalla

Lo único del banco real que ve el alumno hoy es **el turno del profesor**, que sí recupera fragmentos
autorizados del corpus. Todo lo demás de la Clase sale de `dry-session.ts`:

| Lo que ve el alumno | De dónde sale |
|---|---|
| La actividad «Deriva A a partir de A∧B» | constante `DRY_SESSION_ACTIVITY` escrita a mano |
| La rúbrica de 3 criterios | escrita a mano en el mismo archivo |
| Los 2 turnos de la lección | catálogo sintético `dry-session-dev-v1`, 2 entradas |
| «Pedir pista (1/5)» | `hintMaximumLevel: 5` escrito a mano |

Ese último detalle merece atención: **la UI promete 5 niveles de pista y el banco tiene exactamente
3.** Verificado sobre los 656 reactivos: la distribución de nivel máximo es `{3: 656}`. Si el botón
llegara a funcionar tal cual, pediría un nivel que no existe.

### G.3 Problemas del contenido en sí

Separando —como pide el encargo— contenido, presentación, interacción y motor:

**(a) Problemas del CONTENIDO:**

1. **Cero rúbricas** para 656 reactivos. `assertRubricPresent()` exige rúbrica para toda actividad
   puntuable, así que hoy el sistema sólo funciona porque el fixture trae una inventada.
2. **Cero ejemplos resueltos**, y el ejemplo resuelto es el paso 2 del patrón de enseñanza
   (`pattern.new_procedural.worked` existe en la política y no tiene contenido que servir).
3. **La escalera de pistas tiene 3 de 5 niveles**, y faltan justo los dos que más enseñan: el 4
   (ejemplo isomorfo) y el 5.
4. **Las pistas se derivan de la forma del enunciado, no del KC**, de modo que un reactivo puede
   recorrer sus tres niveles sin nombrar nunca la regla que practica.
5. **Un solo formato de tarea** para los 656 reactivos: «Deriva X a partir de Y». No hay preguntas de
   comprensión, identificación de errores, ni completar-la-derivación.
6. **Cero retroalimentación por tipo de error**: `logic-core` clasifica con ~18 códigos `E-*` y no
   existe contenido de remediación asociado a ninguno.
7. **`freeze-manifest.json` sigue siendo el marcador vacío de F0**: ningún activo está congelado, y
   `ci:freeze:drift` falla cerrado contra él (correctamente).
8. El **segundo auditor** dejó juicios críticos sin adjudicar en una parte de la muestra.

**(b) Problemas de PRESENTACIÓN:** el material no aparece como clase. La explicación es un `<li>` en
una lista lateral; la rúbrica, una caja permanente; no hay progresión visible ni sensación de
avanzar por un temario.

**(c) Problemas de INTERACCIÓN:** el alumno no puede escribir la derivación (§C.7), no puede pedir
pista, y no hay forma de responder salvo escribir una pregunta en texto libre.

**(d) Problemas del MOTOR PEDAGÓGICO:** son los más graves, y van en la sección I.

### G.4 ¿Existe una experiencia educativa coherente?

Sobre el papel, sí: hay grafo de prerequisitos, objetivos observables, secuencia de fading
(explicar → resuelto → completar → guiado → independiente → transferencia), reservas separadas para
diagnóstico, práctica, recuperación, retención y transferencia, y política de dominio con
reconfirmación.

En ejecución, no. Un alumno que abra Profesoría hoy encuentra **un ejercicio, siempre el mismo, sin
posibilidad de resolverlo**, y un profesor que sólo habla si se le pregunta.

---

## H. Auditoría UX/UI — por qué se siente como una web

### H.1 La respuesta corta

Se siente como una web porque **lo es**: la Clase es una página que se renderiza una vez, con
información estática, botones que no responden y sin ningún eje temporal. No hay nada que transcurra.
Una clase es una experiencia con duración; esto es un documento con controles decorativos.

### H.2 Los doce elementos concretos que producen esa sensación

Cada uno verificado:

1. **No hay transición al iniciar clase.** «Continuar clase» es un `<a href>`. Se navega, no se
   entra. No hay preparación, ni cambio de contexto, ni señal de que algo ha empezado.
2. **La clase ya ocurrió.** Los seis estados pedagógicos se recorren en un bucle antes del primer
   pintado. El alumno llega tarde a su propia clase.
3. **El estado se muestra como identificador crudo:** la palabra `practica`, en minúscula y sin
   tilde, arriba a la izquierda. Es el valor del enum. Y los ocho estados transversales no se
   muestran en absoluto.
4. **Cinco controles inertes.** Verificado con clics reales: «Pedir pista», «Pausar», «No estoy de
   acuerdo», «Detener mi participación» — ningún manejador, ninguna petición, ningún cambio de DOM.
   Un botón que no hace nada enseña al usuario a no confiar en los botones.
5. **Jerarquía invertida.** El único botón primario de la Clase es «Preguntar al profesor», y arranca
   **deshabilitado**. La acción central —enviar la derivación— es secundaria. Y «Pausar» usa `.btn` a
   secas, sin variante: es el mismo defecto que D-97 corrigió en Inicio y que no llegó a la Clase.
6. **Cero estados de carga, error o vacío.** No existe `loading.tsx`, `error.tsx` ni `not-found.tsx`
   en ninguna ruta. Si algo falla, el usuario ve la pantalla de error de Next.
7. **Cero navegación.** `layout.tsx` es `<body>{children}</body>`. La Clase no tiene `<h1>`, ni
   `<nav>`, ni un solo enlace: no hay forma de salir salvo el botón «atrás».
8. **El profesor no tiene presencia.** Es una sección titulada «Pregúntale sobre este bloque» con un
   `<textarea>`. No tiene nombre propio, ni estado, ni avatar, ni indicador de turno, ni iniciativa.
   La transcripción de la lección está en otra caja distinta, así que el profesor aparece **partido
   en dos** paneles que no se saben el uno del otro.
9. **Todo compite a la vez.** Ocho secciones simultáneas en pantalla, ninguna de ellas condicionada
   al momento de la clase. La rúbrica se ve mientras el profesor explica; el pizarrón vacío ocupa
   media pantalla desde el primer segundo.
10. **Excalidraw entero, empotrado.** ~17 herramientas ajenas a la tarea (imagen, borrador,
    biblioteca, bloqueo de lienzo) y una **segunda** pareja deshacer/rehacer que compite con la del
    editor Fitch. En móvil, el lienzo vacío empuja el editor y el profesor fuera de la primera
    pantalla por completo.
11. **El aviso de datos sintéticos encabeza todas las pantallas**, por delante del contenido. Es
    normativamente obligatorio (UIUX §2) y está bien que exista; el problema es la jerarquía: lo
    primero que se lee en Profesoría es una advertencia sobre Profesoría.
12. **Una ruta inexistente devuelve HTTP 200** y un mensaje interno para desarrolladores.

### H.3 Contradicciones observables

- **Inicio declara capacidades falsas.** `demo-data.ts:114` dice «Sesión seca con paquete sintético:
  sin voz, sin pizarrón y sin modelo en vivo». La Clase monta pizarrón, reproduce voz y llama al
  modelo en vivo. La primera pantalla del producto describe mal el producto.
- **«✓ Guardado»** se muestra permanentemente sin que exista nada que guarde.
- **«Pedir pista (1/5)»** promete cinco niveles sobre un banco que tiene tres.
- **La Clase ignora el `materiaId`**: cualquier identificador, incluso inventado, sirve la misma
  sesión de lógica — incluida la materia que la pantalla anterior declara «en preparación».

### H.3.b Un patrón transversal: la documentación del código se quedó atrás

Lo encontré cinco veces, y en dos de ellas el texto obsoleto **se le muestra al usuario**. Merece
nombre propio porque es barato de arreglar y caro de ignorar: en un proyecto cuya disciplina central
es no afirmar de más, la prosa desactualizada afirma de más.

| Dónde | Qué dice | Por qué ya no es cierto |
|---|---|---|
| `app/materias/[materiaId]/clase/page.tsx` | «Es la única vista implementada de `apps/web` en F7» y «no hay modelo en vivo» | hay 5 vistas, y el modelo en vivo funciona |
| `app/no-implementado.tsx` → **en pantalla** | «En F7 sólo existe la vista de Clase; las demás vistas llegan en su fase» | ídem, y lo lee el alumno |
| `materias/demo-data.ts` → **en pantalla** | «sin voz, sin pizarrón y sin modelo en vivo» | la Clase monta los tres |
| `app/a11y-contrast.css` | «Hoy no se renderiza ninguno [`.btn-primary`] en la vista de Clase» | `ProfesorPanel.tsx:72` renderiza uno |
| `CLAUDE.md` | «`complexityIndex()` … lanza porque su parámetro se congela en un gate futuro» | CAL-09 está congelada (`T-H5-10` VERIFICADA) |

*Prioridad:* **P2**. *Complejidad:* **S**. *Riesgo:* ninguno.

### H.4 Accesibilidad

Lo bueno es real: notación en **MathML** semántico, `aria-label` en las regiones, estados comunicados
con palabra además de color, alternativa sin arrastre en el pizarrón, y una línea base con **Chromium
de verdad** en vez de jsdom —decisión correcta y bien argumentada, porque dos criterios son
geométricos y jsdom aprobaría por vacío.

Tres límites que conviene registrar:

1. **`ci:a11y:baseline` audita una sola ruta** (`/materias/logica/clase`) de las seis que existen.
   Inicio, Mis materias, Detalle y Progreso no las visita nadie.
2. **El botón primario no cumple AA.** Calculé el contraste: blanco sobre `--color-accent` (`#ec3013`)
   da **4,20:1**, y AA exige 4,5:1 para texto normal. El propio `a11y-contrast.css` lo documenta. En
   la Clase el único primario está deshabilitado —y axe omite los deshabilitados—, así que la línea
   base pasa; pero «Continuar clase» es primario y **siempre habilitado** en tres vistas que ningún
   check visita.
3. **El check verifica geometría, no función.** Comprueba que «Pausar», «Apelación» y «Retirada» son
   accesibles por teclado y bastante grandes. Los tres están muertos. Un control inerte es
   trivialmente accesible: ésta es una prueba que pasa por vacío, en el sentido exacto que el propio
   proyecto se preocupa de evitar en otras partes.

### H.5 Lo que la UX hace bien, y no hay que tocar

- **La honestidad epistémica es excelente y es el rasgo distintivo del producto.** «Todavía no hay
  resultado experimental», «La retención no se evaluó en esta corrida», «El motor no ha programado
  ningún repaso todavía», el descargo permanente de la revisión local, la distinción entre garantía
  actuando y avería del canal. Casi ningún producto educativo hace esto.
- **La separación de los tres estados de curso** (UI-CORR-01) está bien ejecutada.
- **Progreso no inventa porcentajes.** Cuatro recuentos por estado autoritativo en vez de una barra
  de avance ficticia, y `reconfirmation_failed` no se funde con «en aprendizaje».
- **Los textos están escritos con cuidado** y citan su norma en el código.

---

## I. Auditoría técnica

### I.1 La máquina de estados: existe, es buena, no la conduce nadie

`packages/session-engine/src/state-machine.ts` (~1 550 líneas) implementa una máquina seria: 9
estados primarios y 8 transversales, transiciones validadas —una transición que declare mal su origen
se rechaza—, reconstrucción por replay total que no tolera huecos ni reordenamientos, y proyección a
`SessionStructuredState`.

**Su único llamador no-test en todo el repositorio es `apps/web/src/clase/dry-session.ts`**, que la
usa una vez al importar el módulo para fabricar un snapshot congelado. Verificado:

```
$ grep -rln "transitionPrimarySessionState" apps packages tools | grep -v test | grep -v dist
apps/web/src/clase/dry-session.ts
packages/session-engine/src/state-machine.ts
```

### I.2 Sobre la máquina de estados que propones

Comparé tus doce estados con los diecisiete que ya existen. **La mayoría ya están cubiertos, y los
que faltan son de otra naturaleza.** Ésta es la correspondencia:

| Tu estado | ¿Existe? | Dónde |
|---|---|---|
| `IDLE` | ≈ | `preparada` |
| `PREPARANDO_CLASE` | ≈ | `autenticacion` + `consentimiento_confirmado` + `diagnostico` |
| `CLASE_ACTIVA` | ✅ | `explicacion` / `comprobacion` / `practica` / `evaluacion_operativa` |
| `MOSTRANDO_ACTIVIDAD` | ✅ | `practica` |
| `PAUSA` | ✅ | transversal `pausa` |
| `REANUDANDO` | ◐ | salida de `pausa`, sin estado propio |
| `FINALIZANDO` / `CLASE_TERMINADA` | ✅ | `cierre` |
| `ERROR/RECUPERACIÓN` | ✅ | transversales `recuperacion`, `fallo_pedagogico`, `incidente` |
| **`PROFESOR_HABLANDO`** | ❌ | **no existe** |
| **`ESPERANDO_ALUMNO`** | ❌ | **no existe** |
| **`PROCESANDO_RESPUESTA`** | ❌ | **no existe** |

La conclusión importante: **los tres que faltan no son estados pedagógicos, son estados de
interacción**, y meterlos en la máquina existente sería un error. La máquina de `session-engine` es
autoritativa y auditada: cada transición emite un evento que va a la bitácora y que después se lee
como evidencia experimental. «El profesor está hablando» no es un hecho pedagógico que deba entrar en
el ledger; es un estado de presentación que vive milisegundos.

**Recomendación: dos capas.** Una máquina de presentación en el cliente
(`ocioso → preparando → profesor_hablando → esperando_alumno → procesando → mostrando_actividad →
cerrando`) que se **deriva** del estado pedagógico y del canal de voz, y no al revés. La pedagógica
sigue siendo la única con autoridad. Es el mismo patrón que el proyecto ya usa en
`clase/view-model.ts`, donde la vista no decide nada y todo se deriva del estado de sesión.

Una limitación real que conviene conocer antes de diseñar: **la secuencia primaria es estrictamente
lineal e irreversible** (`preparada` → … → `cierre`, sólo al siguiente). Una clase que enseñe dos
bloques —explicar KC04, practicar, explicar KC05, practicar— **no cabe** en la máquina actual. O se
modela un bloque por sesión, o la máquina necesita un ciclo declarado. Es una decisión de diseño
pendiente, no un defecto.

### I.3 El bucle W7: bien construido, alimentado con constantes

`runTeachingTurn` implementa los pasos 1–6 y 9 con rigor: la puerta de no revelación se comprueba
**antes** de llamar al proveedor (P-I §9.6, porque después la solución ya viajó) y el validador de
anclaje **después** (P-II §8.4, porque antes la salida no existe). Ese orden está fijado por código y
por pruebas. Funciona: lo verifiqué contra el proveedor real.

El problema está en la entrada. El contexto de decisión pedagógica que `apps/api` construye por
petición es **fijo**: sin historial del alumno, sin estado de KC, sin intentos previos
(`previousTurn` es literalmente `null`). El efecto es que **la política de 22 reglas colapsa siempre
en la misma**: todas mis llamadas devolvieron `pattern.new_procedural.explain`. Diez estrategias de
enseñanza implementadas y una sola alcanzable.

Los huecos que el propio código declara: la **elección de bloque** y la derivación
`objectiveId → goal` (el «hueco 4 de W7»), y el **paso 9** (evidencia), que hoy emite a un
`TurnAuditTrail` en memoria y a un span, no al ledger.

### I.4 Persistencia: construida entera, nunca usada

`infra/database/` define los 7 esquemas, con `evidence` append-only por triggers que niegan
`UPDATE`/`DELETE`/`TRUNCATE` incluso al propietario, secuencia monótona, cadena `previous_hash`
verificada en la base, RLS como segunda capa y matriz de `GRANT` generada desde
`security-policy/src/matrix.ts` con guarda de deriva. Hay 131 pruebas contra PostgreSQL 17 real vía
Testcontainers, con controles positivos de que cada concesión **sí** funciona.

Todo eso está bien hecho. Y `EVIDENCE_EVENT_INSERT_SQL` **no tiene un solo llamador**. La aplicación
en marcha no escribe ni una fila.

En el cliente, lo mismo: `localStorage`, `sessionStorage` y las cookies están vacíos. Recargar la
página pierde el documento, el historial de deshacer y la conversación.

### I.5 Frontend

**Lo que está bien construido y hay que apoyarse en ello:**

- **`view-model.ts` es un acierto de diseño.** La vista no decide nada: todo se deriva del estado de
  sesión, y construir un modelo incoherente **lanza** en vez de degradarse
  (`MODO_MEDICION_INCOHERENTE`, `FEEDBACK_EN_MEDICION`, `RUBRICA_AUSENTE`,
  `ENTREGA_GENERADA_EN_VIVO`). Es exactamente la capa donde enchufar la sesión real.
- **`ClaseView` es un componente puro** que recibe el modelo ya derivado y acepta editor, pizarrón y
  profesor como nodos. Se puede renderizar sin DOM y probar sin navegador.
- **Los puertos** (`createHttpTurnPort`, `createHttpVerdictPort`) inyectan `fetch`, así que la lógica
  de canal se prueba sin red.
- **`assertCapabilitiesImplemented()`** impide encender una capacidad sin superficie que la atienda.
  Es la guarda que evitó que F10 mintiera sobre sí misma.

**Deuda real:**

- `ClaseSession` mezcla estado de documento, cursor, guardado, envío y acumulación de trazos.
- `boardOps` se acumula en un `ref` y **no se emite nunca**: los emisores de `T-H8-08` esperan el
  canal de evidencia.
- No hay estado global ni contexto: nada sobrevive a cambiar de ruta.
- La comunicación es `fetch` POST de una sola respuesta. **No hay streaming, ni SSE, ni WebSocket** —
  lo cual importa para la experiencia objetivo: una clase conversacional con voz necesita que el
  profesor empiece a hablar antes de terminar de pensar.

### I.6 Calidad de ingeniería: el activo más subestimado

Corrí las doce comprobaciones que CLAUDE.md dice que nadie ejercita, más la suite completa. Todo en
verde:

```
2 253 pruebas unitarias (142 archivos)   ci:arch:depcruise (593 módulos)
ci:web:tokens · ci:coords:pbt · ci:annotations:staleness · ci:visual:no-verdict
ci:plan:status · ci:content:mangos · ci:gateway:fail-closed (52)
ci:mode-separation (12) · ci:e2e:dry-session (33) · ci:e2e:course-creation (13)
ci:adversarial:session (27)
```

Esto no es decorativo: significa que **refactorizar es seguro**, y es la razón por la que este
informe no recomienda reescribir nada.

### I.7 Una corrección a la documentación del proyecto

`CLAUDE.md` afirma que `complexityIndex()` y `assertComparable()` «lanzan porque su parámetro se
congela en un gate futuro (CAL-09)». Eso ya no es exacto: **`T-H5-10` está VERIFICADA y el manifiesto
`cal-09-v1` existe y está congelado** (`docs/params/registry.yaml`). `complexityIndex()` lanza sólo
cuando se le llama **sin** manifiesto; con el congelado calcula, y de hecho los 656 reactivos llevan
su `complexityIndex` computado. Lo que sigue bloqueado es BENCH-04, no CAL-09.

---

## J. `Plan.md` frente a la implementación — matriz de trazabilidad

### J.1 La matriz

| # | Requisito | Fuente | Esperado | Encontrado | Estado | Desviación | Impacto |
|---|---|---|---|---|---|---|---|
| 1 | Flujo `Clase → cierre/guardado → Progreso / siguiente sesión` | UIUX §5.1 | ciclo cerrado | la clase no termina | **✗** | los 3 últimos tramos no existen | **alto** — no hay bucle de aprendizaje |
| 2 | Vistas de la arquitectura de información | Plan §7.3 | 9 vistas | 5 | **◐** | faltan Crear materia, Investigación, Configuración, Consolas | alto |
| 3 | «Crear materia» como flujo principal | UIUX §5.2 | superficie completa | backend VERIFICADO, cero UI | **backend‑sin‑UI** | F9 entregó política, no pantalla | alto |
| 4 | Controles de Clase: pista, pausa, apelación, retirada | UIUX §6.5 | operativos | 4 botones inertes | **UI‑sin‑backend** | renderizados sin manejador | **crítico** — apelación y retirada son derechos |
| 5 | Editor Fitch para actividades formales | UIUX §6.5 | edición de derivaciones | sólo lectura | **⚠️** | nunca se construyó la entrada | **crítico** |
| 6 | Voz según `capabilityFlags` | UIUX §6.5 | entrada y salida | salida parcial, entrada nula | **◐** | `voiceInput` apagado | alto |
| 7 | Voz V1 = push-to-talk / micrófono por turno | UI-CORR-07 | primera implementación | `CAPTURE_MODES` escrito, sin consumidor | **backend‑sin‑UI** | biblioteca sin conectar | alto |
| 8 | Lexicón de verbalización validado por reconstrucción exacta | `T-H8-02`, P-I §8.10 | aplicado al TTS | nunca se invoca | **⚠️** | el contrato del turno aplana a prosa | medio-alto |
| 9 | 16 estados de interfaz obligatorios | UIUX §9, Plan §7.5 | los 16 | ≈4 | **◐** | sin carga, error, micrófono, retorno tras pausa | alto |
| 10 | Componentes reutilizables | UIUX §11, Plan §7.7 | 7 | 1 (`MasteryState`, y es un tipo de dominio) | **✗** | faltan `TurnIndicator` y `SessionSummary`, justo los de la experiencia que falta | alto |
| 11 | Pistas sólo en `LEARNING_MODE` | UIUX §6.5 | motor conectado | banco de 3 niveles cargado, sin endpoint | **backend‑sin‑UI** | falta la entrega | alto |
| 12 | `MEASUREMENT_MODE` con estado explícito | UI-CORR-02 | verificable por `ci:e2e:measurement-mode` | modelado y **el check no existe** | **◐** | la verificación exigida no se escribió | medio |
| 13 | Copys verificados por `ci:web:copy-lint` | UI-CORR-01 | check en CI | **no existe en `package.json`** | **✗** | verificación exigida ausente | medio |
| 14 | Bitácora append-only como evidencia | P-II §9.1, I-6 | escritura en sesión | 0 llamadores | **backend‑sin‑UI** | paso 9 de W7 abierto | **crítico** para el experimento |
| 15 | Autenticación seudónima con passkey/MFA | `T-H1-05`, P-I §14.2 | montada | implementada, sin montar | **backend‑sin‑UI** | ninguna ruta la sirve | alto |
| 16 | Selección de actividad según estado del alumno | P-I §8.3 | selector | **no existe** | **✗** | nunca se construyó | **crítico** |
| 17 | Declaración de dominio de KC | `T-H6-03` | alcanzable | motor completo, sin llamador | **backend‑sin‑UI** | imposible dominar un KC | **crítico** |
| 18 | Rúbricas para reactivos puntuables | linter del paquete | 656 | **0** | **✗** | `rubrics/` sólo tiene README | alto |
| 19 | Ejemplos resueltos | patrón de enseñanza | por KC | **0** | **✗** | el paso 2 del patrón no tiene contenido | alto |
| 20 | Pistas escalonadas | banco | 5 niveles | **3** | **◐** | la UI promete 5 | medio |
| 21 | Línea base de accesibilidad sobre vistas críticas | `T-H8-10`, Plan §7.6 | vistas críticas | 1 ruta de 6 | **◐** | cobertura parcial declarada | medio |
| 22 | Actas de gate firmadas | Plan §8 | H0…H8 | existen H0, H1, H2, H3, H6 | **◐** | faltan H4, H4.5, H5, H7, H8 | medio |
| 23 | Registro `BLOCKED_BY_SPEC` | Plan §0.3 | decisiones normativas faltantes | **vacío**, con `voiceInput` bloqueado por una | **⚠️** | el bloqueo no está registrado donde debe | medio |
| 24 | Invariantes I-1…I-9 ejecutables | Plan §4.5 | 13 reglas en verde | 13 en verde, con controles positivos | **✅** | ninguna | — |
| 25 | Verificador determinista sin red | I-3, `T-H2-15` | puro, aislado | funciona, 0,4–1 s | **✅** | ninguna | — |
| 26 | Bucle W7 con anclaje y no revelación | `T-H7-01` | orden de puertas fijado | correcto y verificado en vivo | **✅** | ninguna | — |
| 27 | Separación de modos | `T-H6-02` | 12 propiedades | 12 en verde | **✅** | ninguna | — |
| 28 | Aislamiento entre materias | `T-CC-03` | por consulta cruzada | 13 pruebas en verde | **✅** | ninguna | — |

### J.2 ¿De dónde viene el problema?

Descompuesto por causa, que es lo que preguntas:

**(a) Requisitos que nunca se implementaron — la causa mayoritaria.** Filas 1, 2, 9, 10, 13, 16, 18,
19. No son bugs: son partes del plan que no se ejecutaron. `Plan.md` §7.3, §7.5 y §7.7 describen la
aplicación que quieres, con bastante precisión, y **están sin construir**.

**(b) Decisiones de implementación que se quedaron a medio camino — la causa más cara.** Filas 3, 4,
7, 11, 14, 15, 17. El patrón se repite con una regularidad llamativa: *el motor se construye, se
prueba a fondo, se declara VERIFICADO, y no se conecta*. Ocurrió con la máquina de estados, la
autenticación, el ledger, el motor de dominio, el de pistas, el STT y la creación de materias. La
causa raíz —y esto es **HIPÓTESIS**, aunque bien apoyada— es que el plan está organizado **por
capacidad y por gate**, no por recorrido de usuario: cada tarea `T-*` entrega un mecanismo con su
prueba, y ninguna tarea tiene como criterio de aceptación «el alumno puede hacer X de principio a
fin». La única que lo tiene es `T-H8-14`, que es corrida humana y no se ha ejecutado.

**(c) Simplificaciones declaradas que envejecieron.** `dry-session.ts` es legítima para F7 —el plan
admite «paquete congelado o paquete sintético de desarrollo equivalente»—. El problema es que F7
terminó hace tres fases y el fixture **sigue siendo la única fuente de la Clase**. La simplificación
temporal se volvió permanente sin que nadie la marcara como deuda.

**(d) Bugs propiamente dichos.** Pocos, y menores en comparación: la ruta que ignora el `materiaId`,
la paleta que corrompe la premisa, el contraste del primario, el aviso de capacidades falso, el 200
en rutas inexistentes.

**(e) Problemas del propio `Plan.md`.** Dos, ambos leves. El primero: §7.4 exige dos checks
(`ci:e2e:measurement-mode`, `ci:web:copy-lint`) que nunca se crearon, y ningún control detecta que
falten. El segundo: el plan no tiene ninguna tarea cuyo entregable sea «la sesión se conduce de
principio a fin»; ese trabajo cae entre F7 (sesión seca), F8 (turno con LLM) y F10 (multimodal), y
por eso no lo hizo ninguna.

**(f) El contenido.** Real y sustancial, pero con tres huecos que importan (rúbricas, ejemplos
resueltos, niveles 4-5 de pista) y sin congelar (W5).

### J.3 Lo que falta no siempre es un defecto

Conviene separarlo con claridad, porque cambia las prioridades:

- **F11 (`LOCAL_SELF_USE`) no se ha ejecutado**, y es la fase donde el propietario usa el sistema
  entero y emite el informe de valor. Esta auditoría ocupa su lugar.
- **F12–F16 no se han empezado** y contienen gobernanza para participante real, ledger fuerte y
  piloto. No aportan la experiencia que echas en falta.
- Los bloqueos por **calibración congelada** (`CAL-MULTIMODAL` para interpretación del pizarrón y
  anotaciones, BENCH-03 para umbrales multimodales, W5 para congelar el paquete) son **decisiones del
  propietario**, no trabajo de ingeniería, y ninguno de ellos bloquea lo que este informe propone.

---

## K. Problemas priorizados

### P0 — impiden usar Profesoría

**P0-1 · El editor Fitch es de sólo lectura: el alumno no puede hacer la actividad central.**
*Evidencia:* `FitchEditor.tsx`; DOM sin `input` ni `contenteditable`; pulsar `∧` transformó `A∧B` en
`A∧B∧`. *Causa:* la edición nunca se construyó; `fitch-document.ts` tiene `appendLine`/`updateLine`
sin superficie que las invoque. *Impacto:* el curso de lógica no se puede cursar.
*Solución:* campos por línea (fórmula, regla, citas), añadir/eliminar línea, abrir/cerrar subprueba,
y que la paleta inserte en el cursor y no al final. *Complejidad:* **L**. *Dependencias:* ninguna —
el modelo de documento y la revisión local ya existen. *Riesgo:* bajo; 16 pruebas cubren el modelo.

**P0-2 · Nada conduce la sesión: la máquina de estados no tiene conductor.**
*Evidencia:* único llamador no-test de `transitionPrimarySessionState` es `dry-session.ts`;
`useMemo(…,[])`. *Impacto:* la clase no empieza, no avanza, no termina. Es la causa raíz de la
sensación de web estática. *Solución:* un servicio de sesión en `apps/api` que posea la máquina y la
exponga; la vista deja de fabricar su estado y lo recibe. *Complejidad:* **XL**. *Dependencias:* base
de datos para persistir. *Riesgo:* medio-alto — toca la frontera que I-1…I-9 protegen; el modelo de
vista y sus guardas deben quedar intactos.

**P0-3 · Cinco controles de la Clase son inertes, y dos de ellos son derechos.**
*Evidencia:* clics reales, 0 peticiones, DOM idéntico; `ClaseView.tsx` sin `onClick`.
*Impacto:* funcional y **normativo**: UI-CORR-04 exige que apelación y retirada tengan acceso
inequívoco, y hoy son decorativos. *Solución:* endpoints + manejadores. *Complejidad:* **M**
(apelación y retirada, **S** si sólo registran evento). *Riesgo:* bajo.

**P0-4 · No existe selector de actividad: nada elige qué hacer a continuación.**
*Evidencia:* `candidateId`/`itemFamilyId`/`Reserve` no aparecen en session-engine, pedagogy-policy,
api ni web. *Impacto:* 656 reactivos inalcanzables; una sola actividad escrita a mano.
*Solución:* selector que combine estado de KC, reserva y complejidad `cal-09-v1` (ya congelada).
*Complejidad:* **L**. *Riesgo:* medio — es decisión pedagógica y debe quedar en `pedagogy-policy`,
nunca en la UI.

**P0-5 · La política pedagógica sólo puede disparar 1 de sus 22 reglas.**
*Evidencia:* contexto de decisión construido con constantes por petición; `previousTurn: null`; todas
mis llamadas devolvieron `pattern.new_procedural.explain`. *Impacto:* no hay adaptación; el motor
pedagógico completo es inerte. *Solución:* alimentar el contexto desde el estado real de sesión.
*Complejidad:* **M** una vez exista P0-2. *Dependencias:* P0-2.

**P0-6 · Cero persistencia: cerrar la pestaña borra todo.**
*Evidencia:* almacenamiento del navegador vacío; `EVIDENCE_EVENT_INSERT_SQL` sin llamador.
*Impacto:* no hay progreso, ni continuidad, ni evidencia — y sin evidencia el experimento no puede
existir. *Solución:* montar la base en el arranque local y escribir el ledger desde el paso 9 de W7.
*Complejidad:* **L**. *Riesgo:* medio — la cadena de hashes debe quedar íntegra desde el primer
evento.

### P1 — función central incompleta o experiencia gravemente deficiente

| | Problema | Evidencia | Solución | Cx |
|---|---|---|---|---|
| P1-1 | No hay inicio ni fin de clase | `<a href>`; no existe `cierre` alcanzable | modo clase con preparación y cierre + resumen | L |
| P1-2 | El profesor no toma la iniciativa; el alumno redacta el objetivo | `ProfesorPanel.tsx` | el turno lo pide el motor, no el alumno | M |
| P1-3 | Voz de salida sólo colgada de un turno ad-hoc | `VozProfesor` dentro de `TurnBody` | voz al nivel de la sesión, con `TurnIndicator` | M |
| P1-4 | El lexicón de verbalización nunca se aplica | `speech.ts` aplana a `prose` | conservar segmentación tipada en `TurnSegment` | M |
| P1-5 | Sin micrófono, con STT construido | `stt.ts` sin consumidor | push-to-talk (UI-CORR-07) | L |
| P1-6 | Sin estados de carga, error ni vacío | 0 `loading.tsx`/`error.tsx` | los 16 de UIUX §9 | M |
| P1-7 | Sin navegación ni salida de la Clase | `layout.tsx` desnudo | cabecera persistente + salida explícita | S |
| P1-8 | La Clase ignora el `materiaId` | `/materias/loquesea/clase` funciona | resolver materia y fallar si no existe | S |
| P1-9 | Dominio de KC inalcanzable | `domain-engine` sin llamador | conectar tras el veredicto | M |
| P1-10 | Pistas sin vía de entrega | sin endpoint | endpoint + manejador | M |
| P1-11 | Sin `TurnIndicator` ni `SessionSummary` | §7.7 | construirlos | M |
| P1-12 | Jerarquía invertida; primario deshabilitado | `ProfesorPanel.tsx:72` | «Enviar» primario | S |
| P1-13 | Contraste AA del primario: 4,20:1 | cálculo propio | decisión de color de marca | S |
| P1-14 | Progreso con datos escritos a mano | `demo-data.ts` | leer `domain-engine` | M |
| P1-15 | Autenticación sin montar | `auth.ts` sin importadores | montarla | M |
| P1-16 | **Dos catálogos de evento multimodal incompatibles**; el literal del Maestro está muerto y el validador rechaza sus nombres | ejecutado: `stt.committed` → `FAMILIA_DESCONOCIDA` | reconciliar **antes** de emitir el primer evento de voz | S |
| P1-17 | La voz no consulta `capabilities.voiceOutput` | `ProfesorPanel.tsx:131` sin guarda | derivar `voiceOutputVisible` como el pizarrón | S |
| P1-18 | La interrupción de voz registra siempre `-1` («no se dijo nada») y su evento se descarta | `VozProfesor.tsx:127` | pasar el índice real y emitir el evento | S |

### P2 — degradación importante

Ruta inexistente con HTTP 200 y texto interno · aviso de capacidades falso en Inicio · estado
primario como enum crudo · «✓ Guardado» sin guardado · «1/5» pistas sobre un banco de 3 ·
`ci:a11y:baseline` sobre 1 ruta de 6 · Excalidraw completo con doble deshacer/rehacer · pizarrón que
domina el móvil · panel del profesor sin memoria · `MEASUREMENT_MODE` inalcanzable · reformulación
`T-H7-05` que nunca ocurre · `classifyDoubt` sin llamador · faltan `ci:e2e:measurement-mode` y
`ci:web:copy-lint` · faltan actas H4, H4.5, H5, H7, H8 · `voiceInput` bloqueado sin registrar en
`blocked-by-spec.md`.

### P3 — refinamiento y deuda

Aviso sintético repetido por delante del contenido · `session-templates` duplica `selection-rules` ·
`targetComplexity` sin información independiente respecto de `measuredComplexityTier` ·
`ClaseSession` acumula responsabilidades · nota de CAL-09 desactualizada en `CLAUDE.md` · BKT
congelado en OFF (correcto, sólo registrar).

---

## L. Funciones que faltan, con justificación

1. **Servicio de sesión** que posea la máquina de estados y la conduzca. *Sin esto nada más importa:
   es la pieza que convierte doce motores en un producto.*
2. **Modo clase** como estado de aplicación, con entrada y salida explícitas. *Es literalmente lo que
   pides: que la aplicación cambie de estado al empezar.*
3. **Editor Fitch editable.** *Sin él el curso no se puede cursar.*
4. **Selector de actividad.** *Los 656 reactivos son inalcanzables sin él.*
5. **Entrega de pistas.** *Contenido y motor existen; falta el tubo.*
6. **Cierre de clase y resumen** (`SessionSummary`). *Cierra el bucle de UIUX §5.1.*
7. **Persistencia de sesión y progreso**, con escritura al ledger. *Sin ella no hay continuidad ni
   evidencia.*
8. **Captura de voz push-to-talk.** *Especificada en UI-CORR-07 y construida a medias.*
9. **Indicador de turno conversacional** (`TurnIndicator`). *Es lo que comunica que el profesor
   escucha, piensa o habla: la presencia que hoy falta.*
10. **Clasificador de intención hablada**, para «Profesoría, pausa un momento». *No existe nada
    parecido en el repositorio.*
11. **Iniciativa del profesor**: que el turno lo pida el motor y no el alumno.
12. **Streaming de la respuesta** (SSE). *Con 3,5 s de latencia, sin streaming la conversación no
    fluye.*
13. **Superficie de creación de materia.** *Backend verificado, cero UI.*
14. **Vistas Configuración e Investigación.** *Configuración es donde viven voz y micrófono.*
15. **Cabecera persistente y navegación.**
16. **Los 16 estados de interfaz** de UIUX §9.
17. **Rúbricas y ejemplos resueltos** en el contenido.
18. **Retroalimentación por código `E-*`.** *18 códigos clasificados y ningún contenido de
    remediación: el verificador ya sabe qué falló y nadie lo aprovecha para enseñar.*

---

## M. Qué conservar

**Nada de lo que sigue debe reescribirse.** Es la mayor parte del valor del proyecto.

### MANTENER sin tocar

- **`logic-core` y el verificador.** Determinista, sin red, sin reloj, sin azar; 413 casos dorados,
  pruebas de propiedad y mutación en verde. Verificado funcionando. Es la joya del sistema.
- **Los invariantes ejecutables** (`.dependency-cruiser.cjs`, 13 reglas + controles positivos).
- **La máquina de estados de sesión.** Es buena; sólo le falta conductor.
- **La política pedagógica determinista** (22 reglas, secuencia de fading completa).
- **`model-gateway`**: anclaje, filtro de egreso, canarios, coste, degradación. Verificado en vivo.
- **El banco de 656 reactivos** con sus certificados y su calibración `cal-09-v1`.
- **El ledger de evidencia** y la matriz de privilegios, con sus 131 pruebas contra PostgreSQL real.
- **La honestidad epistémica de los textos.** Es el rasgo diferencial del producto.
- **`view-model.ts` y sus guardas que lanzan.**
- **La disciplina de pruebas.** 2 253 en verde es lo que hace seguro todo lo que este informe propone.

### MEJORAR

Editor Fitch (hacerlo editable) · panel del profesor (iniciativa, memoria, presencia) · voz (subirla
al nivel de sesión y aplicar el lexicón) · Progreso (leer del motor) · jerarquía visual y contraste ·
pizarrón (reducir a las herramientas de la tarea) · `ci:a11y:baseline` (ampliar rutas).

### REFACTORIZAR

`ClaseSession` (separar responsabilidades) · `TurnSegment` (conservar la segmentación tipada) ·
`dry-session.ts` (**degradar a fixture de pruebas**, no fuente de la vista) · contexto de decisión
pedagógica (alimentarlo del estado real).

### REEMPLAZAR

Sólo una cosa: **`dry-session.ts` como fuente de la Clase**, sustituida por la sesión real. El
archivo se conserva para pruebas.

### ELIMINAR

Nada. No encontré código muerto que merezca borrarse. Las herramientas de Excalidraw ajenas a la
tarea se ocultan, no se eliminan.

### AGREGAR

Lo de la sección L.

---

## N. Profesoría 2.0 — propuesta conceptual (sin implementar)

### N.1 Los cinco cambios conceptuales

**1. La sesión deja de vivir en el navegador.**
Hoy la sesión es un fixture del cliente. En 2.0 vive en `apps/api`, que posee la máquina de estados,
la persiste y la expone. La vista deja de **fabricar** su estado y pasa a **recibirlo**. Este cambio
solo elimina la causa raíz de P0-2, P0-5 y P0-6.

**2. Profesoría conduce; el alumno responde.**
Hoy el alumno redacta el objetivo del turno. En 2.0 el motor decide el siguiente acto pedagógico
—usando las 22 reglas que ya existen—, el modelo lo ejecuta lingüísticamente, y el alumno responde.
El campo de texto libre no desaparece: pasa de ser el único motor de la clase a ser una de las formas
de intervenir.

**3. El material aparece por acto, no por panel.**
Hoy ocho secciones compiten desde el primer segundo. En 2.0 la superficie se deriva del acto en
curso: explicando → texto y voz; practicando → editor; dibujando → pizarrón; cerrando → resumen. Lo
que no toca, no está. `ClaseView` ya recibe editor, pizarrón y profesor como nodos: la costura existe.

**4. La voz es el canal por omisión, no un botón.**
Hoy hay que pulsar «Escuchar la explicación». En 2.0 Profesoría habla al entregar cada acto —con el
lexicón aplicado— y abre el micrófono cuando le toca al alumno. Con `TurnIndicator` visible en todo
momento, y degradación a texto que **no cambia la decisión**, que es lo que `degradeToText()` ya
garantiza.

**5. La clase termina.**
Con cierre, resumen (`SessionSummary`), progreso actualizado desde el motor de dominio y retorno al
entorno general.

### N.2 La pausa por intención hablada

Es una de tus peticiones explícitas y merece diseño propio, porque tiene una trampa.

**Lo que hace falta:** un clasificador de intención sobre la transcripción del alumno, con un juego
**cerrado** de intenciones de control (`pausar`, `reanudar`, `repetir`, `pedir_pista`,
`terminar`) más `ninguna`. Hoy no existe nada parecido en el repositorio.

**La trampa, y es seria.** Ese clasificador se sitúa justo donde el proyecto es más estricto: la
entrada del alumno alimenta decisiones pedagógicas, y `T-H8-12` fija como **métrica de aceptación
principal** la «tasa de decisiones pedagógicas que cambiarían por error de transcripción». Un
clasificador que confunda «no puedo con esta pausa» con «pausa» invalidaría un reactivo de sonda —y
en `MEASUREMENT_MODE` la pausa post-ítem **deriva `invalid_participant_pause`**, que es consecuencia
registrada, no un gesto inocuo.

**Cómo resolverlo sin romper nada:**

- La intención hablada **propone**; nunca ejecuta directamente una acción con consecuencia
  registrada. Profesoría confirma en voz: «¿Paramos aquí? Si paramos ahora, este reactivo se
  invalida.»
- El clasificador es **determinista y auditado** —no una llamada libre al modelo—, con su propio
  conjunto dorado, igual que el lexicón de voz tiene el suyo.
- En `MEASUREMENT_MODE`, control por intención hablada **apagado**: ahí manda el control explícito.

**El mecanismo discreto de emergencia se conserva siempre**, y no como concesión sino como requisito:
Plan §7.6 exige que pausa, apelación y retirada sean operables por teclado. Una barra fina y
permanente con pausa, ayuda y salida cubre el fallo de micrófono, la accesibilidad y la recuperación.

### N.3 Qué del código actual se reutiliza

Sin reescribir nada:

| Pieza de 2.0 | Se apoya en |
|---|---|
| Servicio de sesión | `session-engine/state-machine.ts` **entera** |
| Decisión del siguiente acto | `pedagogy-policy` (22 reglas) + `session-engine/strategies.ts` |
| Ejecución lingüística | `model-gateway` + `runTeachingTurn` **tal cual** |
| Veredicto | `apps/verifier` + spool **tal cual** |
| Dominio y maestría | `domain-engine` **tal cual** |
| Selección de reactivo | banco de 656 + `complexityIndex` con `cal-09-v1` |
| Pistas | pistas del banco + `hint-authority` |
| Voz de salida | `speech-gateway/tts.ts` + `lexicon.ts` (aplicando el lexicón) |
| Voz de entrada | `speech-gateway/stt.ts` **ya construido**, + adaptador de proveedor |
| Persistencia | `evidence` + migraciones + matriz de GRANT |
| Vista | `ClaseView` (puro) + `view-model.ts` (derivación + guardas) |
| Pizarrón | `visual-interaction` + `Pizarron.tsx` |

**Lo único genuinamente nuevo** es la capa de presentación, el selector de reactivo, el clasificador
de intención, la superficie de edición Fitch y los endpoints que faltan. Todo lo demás ya está.

---

## O. Roadmap recomendado

Ordenado por dependencias. **Nada de esto depende de las calibraciones congeladas ni de W5**, lo cual
es deliberado: esos bloqueos son del propietario y el producto no puede esperarlos.

### Hito 0 — Cirugía menor de credibilidad · **S** · sin dependencias

Los defectos baratos que hoy hacen que la aplicación parezca rota: resolver el `materiaId` de la
ruta, corregir el aviso de capacidades del Inicio, quitar «✓ Guardado» mientras no haya guardado,
cambiar el enum crudo `practica` por lenguaje humano, devolver 404 en rutas inexistentes, añadir
cabecera con salida, y hacer primario el botón de enviar. *Desbloquea:* nada, pero cambia la
percepción de inmediato y no arriesga nada.

### Hito 1 — El alumno puede resolver un ejercicio · **L** · sin dependencias

Editor Fitch editable (P0-1). *Desbloquea:* que el curso de lógica sea cursable por primera vez. Es
el único hito que, por sí solo, convierte la demo en algo usable. **Ponlo primero.**

### Hito 2 — Servicio de sesión · **XL** · depende de base de datos local

Mover la sesión al servidor: `POST /sesion` para abrirla, `GET /sesion/:id` para leerla, transiciones
conducidas por el motor, persistencia y escritura al ledger desde el paso 9 de W7 (P0-2, P0-6).
*Desbloquea:* absolutamente todo lo demás. *Invariantes:* el verificador sigue sin red; el estado
sigue siendo append-only; la vista sigue sin decidir.

### Hito 3 — La clase avanza · **L** · depende de H2

Selector de actividad sobre el banco de 656 (P0-4), contexto de decisión real para que las 22 reglas
sean alcanzables (P0-5), entrega de pistas, conexión del motor de dominio para que un KC pueda
declararse dominado, y avance al acertar. *Desbloquea:* la adaptación pedagógica, que hoy no existe.

### Hito 4 — Modo clase · **L** · depende de H2

La capa de presentación: entrada y salida explícitas, material por acto, cierre con `SessionSummary`,
`TurnIndicator`, los 16 estados de UIUX §9, y los cuatro controles vivos (P0-3). *Desbloquea:* la
sensación de estar en una clase.

### Hito 5 — Voz de verdad · **L** · depende de H4

Aplicar el lexicón (conservando la segmentación tipada en `TurnSegment`), voz al nivel de sesión con
iniciativa del profesor, streaming SSE para que hable antes de terminar de pensar, y push-to-talk con
el `stt.ts` existente más el adaptador de proveedor. *Requiere primero:* elegir proveedor de STT y
**registrar la decisión en `docs/blocked-by-spec.md`**.

### Hito 6 — Conversación · **M** · depende de H5

Clasificador de intención determinista con conjunto dorado, pausa hablada con confirmación, y
apagado en `MEASUREMENT_MODE`.

### Hito 7 — Contenido · **M** · en paralelo desde el principio

Rúbricas para los reactivos puntuables, ejemplos resueltos por KC, niveles 4–5 de pista, y
retroalimentación asociada a los códigos `E-*`. *No depende de nada de lo anterior* y puede avanzar
en paralelo; conviene empezarlo ya porque es trabajo de autoría, no de código.

### Hito 8 — Cerrar el perímetro · **M**

Montar la autenticación, superficie de creación de materia, vistas de Configuración e Investigación,
y ampliar `ci:a11y:baseline` a todas las rutas.

---

## P. Riesgos

### Técnicos

- **El Hito 2 toca la frontera que los invariantes protegen.** Mover la sesión al servidor implica
  que `apps/api` posea la máquina de estados. `.dependency-cruiser.cjs` debe seguir en verde: la
  pasarela no puede alcanzar el núcleo lógico, el verificador no puede ganar red, la web no puede ver
  soluciones. *Mitigación:* correr `ci:arch:depcruise` **y sus dos controles positivos** en cada paso.
- **La cadena de hashes del ledger no admite un arranque a medias.** Escribir eventos desde el paso 9
  con la cadena incompleta deja una bitácora que parece íntegra y no lo es. *Mitigación:* activar la
  escritura de golpe, con el verificador de cadena en la base ya en marcha.
- **Latencia.** 3,5 s por turno del modelo más 0,4–1 s por veredicto. Sin streaming, una conversación
  hablada se sentirá lenta pase lo que pase. *Mitigación:* SSE en el Hito 5, y voz que empiece a
  reproducir el primer segmento mientras llegan los siguientes.
- **La secuencia primaria es irreversible.** Si una clase debe cubrir varios KC, hay que decidir si
  es una sesión por bloque o si la máquina admite ciclo. Decidirlo **antes** del Hito 2.
- **Memoria de la máquina de desarrollo.** 16 GB; `turbo` y `vitest` con la concurrencia por omisión
  mueren con exit 134. Usar `--concurrency=2` y `--maxWorkers=2`.

### De regresión — lo más delicado

Cuatro garantías normativas están en juego si se toca la sesión, y cada una tiene hoy una prueba que
la sostiene:

| Garantía | Qué la protege hoy | Qué la rompería |
|---|---|---|
| **No revelación** (P-I §9.6) | `ci:adversarial:session`, 27 pruebas | servir pistas sin pasar por `hint-authority`, o meter la solución en contexto |
| **Anclaje** (P-I §8.5) | validador de anclaje, `ci:gateway:contracts` | generar turnos sin validar la salida |
| **Append-only** (I-6) | triggers en la base, 131 pruebas | cualquier `UPDATE` sobre `evidence` |
| **Separación de modos** | `ci:mode-separation`, 12 propiedades | dar feedback pedagógico en `MEASUREMENT_MODE` |

Además: **el fixture `dry-session.ts` sostiene `ci:e2e:dry-session` (33 pruebas)**. Al sustituirlo
como fuente de la vista hay que conservarlo como fixture de pruebas, o esas 33 caen — y con ellas el
AC del gate H6, que ya está cubierto.

Y una advertencia de método que el propio proyecto documenta: **las pruebas de la vista comprueban
presencia, no conducción**, y por eso los cuatro controles muertos pasan verdes. Al conectarlos, las
pruebas nuevas deben asertar **efecto**, no existencia.

### De UX

- **Sobrecorregir hacia el chat.** UIUX §3 pide explícitamente «interlocutor visible sin volver la
  pantalla un chat». La tentación de convertir Profesoría en un ChatGPT con temario existe y la
  especificación la prohíbe.
- **Que el modo clase se vuelva una cárcel.** Si la navegación desaparece, la salida debe ser
  evidente. Y apelación y retirada son **derechos**: no pueden esconderse detrás de la inmersión.
- **La honestidad epistémica es frágil.** Los avisos de datos sintéticos molestan, y la tentación de
  quitarlos es real. Hay que reubicarlos, no suprimirlos: son requisito normativo (UIUX §2).

### Pedagógicos

- **Adaptación con contenido incompleto.** Encender las 22 reglas con 0 rúbricas, 0 ejemplos
  resueltos y 3 de 5 niveles de pista hará que el motor pida contenido que no existe. Por eso el
  Hito 7 va en paralelo y no al final.
- **La pausa hablada puede invalidar reactivos** (ver N.2).
- **Un dominio declarado en falso queda en el ledger** indistinguible de uno real. El esquema ya lo
  impide (`mastered` exige `nearTransferSatisfied`); no relajar esa validación por conveniencia.

### De producto

El riesgo mayor no es técnico: es **volver a construir mecanismo sin recorrido**. El patrón que esta
auditoría encuentra doce veces —motor construido, probado, verificado, y sin conectar— se repetirá si
los hitos se miden por «paquete listo» en vez de por «el alumno puede hacer X de principio a fin».
*Mitigación:* que cada hito tenga como criterio de aceptación un recorrido de usuario observable, con
una prueba que lo ejercite en un navegador de verdad.

---

## Q. Pruebas necesarias antes de considerar Profesoría funcional

### Q.1 Lo que hay hoy

2 253 pruebas unitarias en 142 archivos, todas en verde, más doce comprobaciones de CI. La calidad es
alta: propiedades con `fast-check`, mutación sobre `logic-core`, controles positivos que comprueban
que los controles detectan, 131 pruebas contra PostgreSQL 17 real, y expectativas *a priori* en el
conjunto dorado.

**Pero conviene ser preciso con la nomenclatura**, porque hoy induce a error:

- Lo que el proyecto llama `ci:e2e:dry-session` y `ci:e2e:course-creation` son **pruebas de
  integración en proceso** con vitest. No abren navegador, no hacen HTTP, no levantan procesos.
- La **única** prueba que abre un navegador real es `ci:a11y:baseline`, que visita **una** ruta y
  ejecuta axe más comprobaciones geométricas y de teclado. **No es una prueba funcional.**
- `ci:e2e:live-session` sí ejerce el sistema contra el proveedor real, pero por API, no por interfaz.

**Conclusión: hoy no existe ni una sola prueba que recorra la aplicación como lo hace un usuario.**
Ése es exactamente el hueco por el que se coló todo lo que documenta este informe: cuatro botones
muertos y un editor que no edita conviven con 2 253 pruebas verdes sin contradicción, porque ninguna
prueba pulsa nada.

### Q.2 Pruebas que faltan, por flujo

**E2E de navegador (Playwright) — el hueco principal, prioridad máxima:**

1. Abrir la aplicación y llegar a la clase desde Inicio.
2. **Iniciar clase** y comprobar la transición de estado de aplicación.
3. **Escribir una derivación completa** —añadir línea, elegir regla, citar— y enviarla.
4. Recibir veredicto correcto, y **que la clase avance** al acertar.
5. **Pedir pista** y comprobar que llega, con el nivel correcto y sin revelar el paso decisivo.
6. **Pausar y reanudar**, comprobando que el estado transversal `pausa` se activa y se levanta.
7. **Apelar y retirarse**, comprobando que cada uno registra su evento.
8. **Terminar la clase** y ver el resumen.
9. **Recargar en mitad de la clase** y recuperar el estado.
10. Navegación completa y salida de la Clase.

**Voz:**

11. TTS: que suena, que aplica el lexicón, y que `A∧B` se pronuncia «A y B» y no como símbolos.
12. Fallo de TTS: degradación a texto **sin cambio de decisión**.
13. Micrófono ausente o denegado: estado de interfaz correcto (UIUX §9).
14. Fallo de STT: no se pierde el turno.
15. Turn-taking: el indicador refleja escuchar / procesar / hablar.
16. Intención hablada: conjunto dorado del clasificador, con casos adversariales («no puedo con esta
    pausa» **no** es pausar).

**Persistencia e integridad:**

17. Que una sesión real escribe la cadena de eventos, y que el replay la reconstruye exacta.
18. Que la cadena `previous_hash` queda íntegra desde el primer evento.
19. Que cerrar y reabrir recupera el punto exacto.
20. Que el progreso mostrado procede de `domain-engine` y no de datos escritos a mano.

**Integración frontend/backend:**

21. Contrato de cada endpoint nuevo, con sus códigos de error.
22. Que la api caída se presenta como **avería del canal** y no como respuesta del profesor (la
    distinción ya existe en `turn.ts`; falta ejercitarla de punta a punta).

**Las que el propio plan exige y no existen:**

23. `ci:e2e:measurement-mode` — UI-CORR-02.
24. `ci:web:copy-lint` — UI-CORR-01.

**Ampliaciones de lo que ya hay:**

25. `ci:a11y:baseline` sobre las seis rutas, no una.
26. Contraste verificado también en controles **habilitados** de todas las vistas.
27. Pruebas de vista que asertan **efecto** y no presencia — la lección de los cuatro botones muertos.

### Q.3 El criterio de «funcional»

Propongo uno operativo, en la línea de lo que `T-H8-14` y `T-LSU-01` piden:

> **Un alumno abre Profesoría, hace una clase completa de principio a fin hablando y escribiendo,
> resuelve al menos un ejercicio con ayuda de al menos una pista, pausa y reanuda por voz, termina la
> clase, ve su resumen, cierra la aplicación, vuelve al día siguiente y encuentra su progreso.**
>
> Y existe una prueba automatizada que recorre eso en un navegador de verdad.

Hoy fallan los nueve tramos de esa frase salvo «resuelve» —y ése falla también, porque no se puede
escribir la derivación.


---

## Apéndice — Método, cobertura y límites de esta auditoría

### Cómo se hizo

1. **Lectura documental** por secciones: `Plan.md` (§0, §4.5, §7, §8 F7–F16), la especificación UI/UX
   completa (538 líneas), las secciones del Maestro que aquéllas citan, `PLAN_STATUS.md` (2 582
   líneas), `HANDOFF.md` y `docs/gates/`.
2. **Ejecución real**: `pnpm run demo` (verificador + api + web), recorrido de las seis rutas con
   navegador, clics reales sobre los controles, instrumentación de `speechSynthesis`, e inspección de
   red, consola y almacenamiento del navegador.
3. **Pruebas ejecutadas**: la suite unitaria completa (2 253 en 142 archivos) y doce comprobaciones
   de CI —incluidas las cinco que `CLAUDE.md` señala como no ejercitadas por ningún push—. **Todo en
   verde.**
4. **Rastreo sistemático de consumidores**: para cada paquete y para cada símbolo exportado de los
   módulos sospechosos, búsqueda de importadores reales bajo `apps/`, distinguiendo pruebas de
   ejecución.
5. **Fan-out paralelo** de auditores especializados por dimensión, con verificación adversarial.

### Coste incurrido

Dos llamadas reales al proveedor (`/clase/turno`), de unos centavos, necesarias para comprobar que el
Profesor IA responde de verdad y que la voz sintetiza su respuesta. No se ejecutó `bench:material`,
`bench:exploratorio` ni `ci:e2e:live-session`.

### Qué NO se hizo

- **No se modificó ningún archivo de producción.** El único archivo nuevo es este informe. Los cinco
  archivos que `git status` muestra modificados ya lo estaban al empezar la sesión, y su diff es
  idéntico.
- No se ejecutó nada que requiriera Docker (`ci:db:negative`, `ci:infra:compose-up`, `ci:infra:otel`),
  ni `ci:logic:mutation` (~9 min), ni `ci:a11y:baseline` (requiere `ci:build` + Chromium).
- No se leyó el Maestro entero (388 KB): sólo las secciones citadas por las tareas auditadas.

### Cobertura del fan-out paralelo, con honestidad

De las doce dimensiones planificadas, **seis se completaron** (intención original, ciclo de vida y
máquina de estados, UX/UI, motor pedagógico, contenido pedagógico y cadena de voz); las seis
restantes —arquitectura de backend, arquitectura de frontend, persistencia, inventario funcional,
pruebas y trazabilidad del plan— **se interrumpieron por límite de uso de la sesión**, dos veces.

Esas seis áreas están cubiertas en este informe **por investigación propia directa**, no por
inferencia: los inventarios de endpoints, de paquetes y de consumidores, las mediciones de latencia,
las pruebas de persistencia en el navegador, la lectura de la matriz de trazabilidad contra
`Plan.md` §7.3/§7.5/§7.7 y la ejecución de la batería de checks son todos de primera mano. Aun así,
conviene saber que **no recibieron el mismo escrutinio adversarial** que las seis completadas, y que
un segundo pase sobre ellas probablemente añadiría hallazgos.

### Verificación cruzada, y correcciones aplicadas

Los hallazgos de los auditores no se aceptaron por plausibles. Tres se corrigieron al comprobarlos:

| Afirmación recibida | Qué encontré al verificarla |
|---|---|
| «El botón primario da 3,76:1 de contraste» | **4,20:1**, calculado sobre `#ec3013`; coincide con lo que el propio `a11y-contrast.css` documenta |
| «CAL-09 sigue bloqueada y `complexityIndex()` lanza» | CAL-09 **está congelada** (`T-H5-10` VERIFICADA, manifiesto `cal-09-v1`); lanza sólo si se la llama sin manifiesto. La nota de `CLAUDE.md` es la desactualizada |
| «`hints/` está vacío ⇒ no hay pistas» | El directorio sí está vacío, **pero las 1 968 pistas viven dentro del banco de reactivos**. Estuve a punto de repetir el error y lo comprobé: por eso después verifiqué las rúbricas del mismo modo — y ésas sí faltan de verdad (0 claves `rubric` en los 656 reactivos) |
