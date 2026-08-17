# HANDOFF — punto de continuación

**Fecha del checkpoint:** 2026-08-16.
**Qué se cerró aquí:** `T-H5-09…17` y `T-H6-01…07` (sesión, dominio, medición y calendario SCED).
**Para:** la siguiente sesión que continúe la ejecución de `Plan.md`.

Este archivo es el punto de entrada. Léelo entero antes de tocar nada, y después
[`PLAN_STATUS.md`](PLAN_STATUS.md), que es la fuente de verdad de avance (§12 del plan).

**Lo primero que hay que saber:** hay remoto
(<https://github.com/MEX-AmatsuMikaboshi/profe_ia.git>) y **cada tarea terminada se sube**. Cómo y
con qué comprobaciones, en §8.

### Por dónde empezar, en una línea

F0–F3 cerradas salvo `T-H3-05`; **F4 con 9 de 12** (todo lo construible), **F5 con 8 de 8**, **F6
con 17 de 17 mecanismos** y **F7 con 7 de 14**. La siguiente es **`T-H6-08`**, interrupciones en
modo de medición.
Antes de arrancarla lee §3 y §7.

**`CONTENT_TOKEN` ya existe** (comprobado el 16-08). CI `31992531164` verificó `T-H6-06` con los
seis jobs verdes, incluida mutación. `T-H6-07` está cerrada en local y necesita su commit y su CI
propios antes de pasar de `HECHA` a `VERIFICADA`.

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
| **F0 · H0** repositorio, contratos, CI | Completa. Gate abierto solo por falta de ejecución verde en `main` |
| **F1 · H1** BD, roles, evidencia | Completa. El gate solo espera firma y ejecución en `main` |
| **F2 · H2** verificador | 16 de 16 tareas. **Todo el AC cubierto**; el gate solo espera firma y ejecución en `main` |
| **F3 · H3** entorno local | 4 de 5. Falta `T-H3-05` (trazas, espera operación real en F7/F8) |
| **F4 · H4** pasarela de modelo | **9 de 12.** Todo lo construible está hecho. `T-H4-09/10/11` esperan credenciales de proveedor y autorización de gasto |
| **F5 · H4.5** investigación de fuentes (W0) | **8 de 8.** Falta la corrida W0 real sobre fuentes y la firma del `CORPUS_APPROVER` |
| **F6 · H5** ingesta, autoría y freeze (W1–W5) | **17 de 17 mecanismos.** Gate abierto: faltan corpus, corrida W1–W5, auditoría, CAL-NLI material, clave y firma reales |
| **F7 · H6** sesión determinista sin LLM | 7 de 14. `T-H6-01…06` VERIFICADAS y `T-H6-07` HECHA; sigue `T-H6-08` |
| F8–F16 | No empezadas |

Van **76 de 148 tareas** del plan (contadas sobre `PLAN_STATUS.md`). Detalle tarea por tarea, con
evidencia y fechas: [`PLAN_STATUS.md`](PLAN_STATUS.md).
Actas de gate: [`../gates/`](../gates/) — `H0.md`, `H1.md`, `H2.md`, `H3.md`, todas **abiertas**.
No hay acta de `H4` ni de `H4.5`: ninguna de las dos fases está en condiciones de firmarse.

### Cuánto falta para poder usarlo

Contando tareas del plan, que es una aproximación —no pesan igual— pero es la única medida que no se
inventa:

| Hito | Qué significa | Avance |
|---|---|---|
| Sesión seca (fin de F7) | Una clase completa con guion fijo, sin IA en vivo | **71 %** |
| Clase real (fin de F8) | Lo mismo, conducido por el modelo ganador | **67 %** |
| `LOCAL_SELF_USE` (F11) | El propietario lo usa de principio a fin, con voz y pizarrón | **51 %** |

**Dos cosas que no se arreglan programando**, y por eso el porcentaje no cuenta toda la verdad:
falta elegir el modelo (`T-H4-10/11` necesita credenciales y autorización de gasto) y falta corpus
real (nadie ha corrido W0 sobre fuentes reales, así que no hay contenido con el que enseñar).

---

## 3. Por dónde seguir

### La tarea siguiente: `T-H6-08` — interrupciones en modo de medición

`T-H6-01…07` ya construyen estado/replay, decisión de estrategia, dominio/reconfirmaciones,
recuperación, pistas congeladas, autoridad aislada de sondas y calendario SCED global. `H6-07`
produce las `ProbeRequest` que `measurement-worker` acepta sin que la sesión elija reactivo,
reserva, tiempo, fase o validez. `CAL-10/CAL-WHEEL` sigue pendiente en material y BKT sigue ausente
por CAL-11.

`T-H6-08` debe implementar en `MEASUREMENT_MODE` las seis semánticas literales de P-II §7.1.1 y
`DEC-MEAS-INTERRUPTION-001`: una pausa pre-ítem no consume; una pausa post-ítem conserva el consumo
y produce `invalid_participant_pause`, sin feedback; una duda de contenido no recibe respuesta
pedagógica ni amplía el reloj; `timeout` se decide por la rúbrica congelada; fin de sesión produce
`missing_session_time`; retirada produce `withdrawal` sin reposición forzada. Todo incidente debe
usar la taxonomía contractual y quedar enlazado al intento/ronda sin cambiar retrospectivamente el
calendario ni la autoridad del worker.

Lo que ya está puesto y conviene usar en vez de rehacer:

- **`W1_ingesta`** es el estado terminal bueno de la máquina W0 (`authoring-core/src/w0-state.ts`), y
  es donde F6 arranca.
- **`fragmentId()`** (`ingestion.ts`) es pública para que W2 recalcule el ancla sin preguntarle a W1.
- **`KC_CATALOG`** (`kc-map.ts`) trae los dieciocho KC con dependencias tipadas y `rule_id` derivados
  del cálculo; **`crossSetEdges()`** ya enumera FORMAL y POLITICA_CONTENIDO por separado, que es lo
  que `T-H5-12` necesita.
- **`STRATEGY_CATALOG` y `toDecisionStrategy()`** (`pedagogy.ts`) fijan el catálogo de doce y fallan
  cerrado en las dos entradas sin miembro de enum.
- **`runW3Generation()`** (`generation.ts`) devuelve `items` y `privateSolutions` **separados**, con
  `structuralSignature` e `itemFamilyId` por reactivo ya calculados. `findDuplicateAmong()` es
  pública y probada con proofs a mano.
- **`reserves.ts`** trae las diez reservas, su directorio, la separación física y la **semántica**:
  `collisionProhibited()` es la regla de qué colisión está prohibida y vive en un solo sitio;
  `MEASUREMENT_RESERVES` se deriva del contrato de sondas; `assertReserveDisjointness()` comprueba el
  paquete entero. La política compartida ya la aplica `T-H6-06`; el calendario sólo solicita la
  combinación conjunto/fase/tipo y nunca elige una reserva alternativa.
- **`SCED_OPPORTUNITY_H5_V1`** (`packages/experiment/src/sced-opportunity.ts`) congela `k_set=3`,
  mínimo válido 2 y el sobre conservador de oportunidades; `measurement-worker` y el calendario
  rechazan un plan primario que discrepe.
- **`FamilyRegistry`** (`family.ts`) fija el `item_family_id` en la primera asignación. **Pásaselo a
  `runW3Generation()` entre corridas**: con uno nuevo por corrida, reasignar familias es gratis y el
  umbral del 30 % de `T-H5-09` se calcula sobre otra cosa. `members()` es lo que `T-H5-09` y
  `T-H5-14` necesitan contar.
- **`coverage.ts`** trae los pisos de P-III §4.2 como **datos con `parameterId`**, la regla del 20 %
  ya implementada y las tres entradas que se exigen declaradas (KC del piloto, puntos críticos, tipos
  de error prioritarios). `requiredProbesForCalendar()` recibe el sobre congelado por T-H5-11 y
  deriva 57 sondas nominales; `probeInventoryGaps()` exige 69 con la reserva adicional.
- **`complexityIndex()`** falla cerrado esperando a `T-H5-10` (`CAL-09`). H6 no abre sin eso, y
  `assertMeasuredMatchesTargetComplexity()` de `generation.ts` es el otro punto donde se enchufa.
- **El orden del pipeline de validez sigue sin congelar** (`BENCH-04`): `resolveValidityVariant()`
  exige el orden como dato con procedencia y `freezeWinningOrder()` sigue fallando cerrado. No lo
  cablees; se congela con una corrida sobre el corpus real, que todavía no existe.
- **Los `CAL-*` de F5 se congelan en esta fase**: `CAL-SOURCE-SCORE`, `CAL-SATURATION` y `CAL-NLI`
  tienen su punto de fallo escrito en `authoring-core` y esperan corpus real.

Lo que queda abierto y **no** bloquea a F6:

- **`T-H3-05`** (trazas) espera una operación real que trazar, en F7/F8.
- **Los gates H0–H3** esperan firma humana y ejecución verde en Actions, no más código.
- **Infisical** necesita que crees su cuenta administrativa a mano.
- **`T-H4-09/10/11`** esperan credenciales y gasto; ver §3.c.

---

## 3.a Lo cerrado el 16-08

### `T-H5-09` — límites de regeneración

`regeneration.ts` aplica 5 intentos por candidato, 3 regeneraciones por familia y el umbral
estricto de >30 % como datos con `parameterId`. El denominador sale de `FamilyRegistry.members()` y
un miembro rechazado cuenta una vez aunque se reprocese. La tercera regeneración autorizada se puede
evaluar; se bloquea pedir la cuarta. El informe al agente solo expone los códigos cerrados de W3 y
restricciones de un catálogo cerrado; las causas detalladas quedan en el registro de auditoría. Un
rechazo sin certificado no recibe una familia inventada. Son 13 pruebas nuevas, 1001 totales.

### `T-H5-10` — `CAL-09`

`cal-09-v1` quedó congelado con 13 soluciones sintéticas verificadas, sin datos de participante.
Los pesos se derivan por concordancia ordinal y la prueba de drift reproduce manifiesto, ids y hash.
El índice queda acotado 0…100; baja/media/alta usan puntos medios entre medianas y la comparabilidad
estructural máxima es `12.065296`, declarada expresamente como no psicométrica. W3 ya mide y rechaza
la discrepancia contra el objetivo de Rol C. Son 10 pruebas nuevas, 1011 totales.

### `T-H5-11` — oportunidad SCED y cobertura

`sced-opportunity-h5-v1` fija `k_set=3` y mínimo válido `2` con un procedimiento de ingeniería
reproducible: menor microbatería que conserva mayoría y tolera un ítem inválido, sin datos de
participante ni pretensión psicométrica. El peor inicio permitido de C (14) más cinco observaciones
posteriores produce 19 rondas válidas concurrentes: 57 sondas únicas nominales por conjunto y 69
con la reserva mínima del 20 %. La cobertura rechaza conjuntos ausentes, planes incoherentes, IDs
repetidos e inventario insuficiente. Son 9 pruebas nuevas, 1020 totales.

### `T-H5-12` — selección A/B/C

`experimental-selection.ts` implementa propuesta, validación, ranking, revisión y freeze. Separa
F/PC, bloquea dependencia completa hacia un conjunto posterior, registra carryover, compara todos
los pares con CAL-09, verifica 69 sondas independientes y una transferencia por set, y evita usar
KC de soporte como diferenciadores. El auditor solo revisa plausibilidad de la propuesta ganadora.
El mecanismo está completo, pero `experimental-sets.yaml` permanece placeholder: congelar una
selección sin corpus, perfiles ni bancos reales fabricaría evidencia. Son 8 pruebas nuevas, 1028
totales.

### `T-H5-13` — linter integral

`content validate` dejó de ser stub y ejecuta 20 controles cerrados: los 19 de P-II §5.5 y el
recálculo de `masteryDisqualifying`. El informe agrega todos los fallos y falla por vacío. La función
pura de autoridad se adelantó desde T-H6-03: nivel 1 solo conserva elegibilidad como recordatorio
no decisivo; niveles 2–5 descalifican. El paquete real no tiene `lint-input.json`, así que el comando
sale con código 2 en lugar de aprobar placeholders. Son 7 pruebas nuevas, 1035 totales.

### `T-H5-14` — auditoría previa

`cal-audit-pre-v1` selecciona por hash+semilla, cubre cada estrato observado, aplica 20 %/mínimo 5
por función y uno por KC, e incluye todo alto riesgo sin desplazar pisos. El codebook y los cinco
gates son ejecutables; se conserva `x/n` y todo seleccionado exige juicio explícito. Un bloqueo solo
se remedia regenerando la familia completa, con causa raíz, semilla nueva y regresión. La corrida
real espera al paquete real. Son 11 pruebas nuevas, 1046 totales.

### `T-H5-15` — freeze firmado, publicación y drift

`experiment freeze` dejó de ser stub y el contrato `FreezeManifest` pasó del esqueleto v0 a una v1
material: inventario no vacío, 18 secciones exactas, linter íntegro, siete capacidades exactas y
firma Ed25519. El comando exige los grupos materiales de §4.3 —un README no cubre un banco—,
versiona y hashea cada sección, enlaza cálculo/auditoría/SCED/capacidades y no acepta placeholders,
symlinks, hardlinks, una clave ausente o un freeze previo. La publicación usa temporal exclusivo,
`fsync`, rename, segundo inventario y modos `0400/0444/0555`; `ci:freeze:drift` informa bytes
cambiados, añadidos y retirados. La documentación operativa está en `docs/content/freeze.md`.

No se congeló el paquete real: siguen ausentes corpus, W3, auditoría, clave y aprobación. El check
sobre el placeholder v0 falla cerrado y eso es evidencia correcta, no un rojo que deba silenciarse.
Las firmas de la suite son claves efímeras de fixture. Son 14 pruebas nuevas respecto del checkpoint
anterior y 1060 totales: 933 unitarias + 127 contra PostgreSQL real.

### `T-H5-16` — BKT sombra opcional, congelado OFF

No se inventaron parámetros CAL-11. `bkt-shadow-disabled-h5-v1` fija BKT en `enabled=false`, sin
parámetros, visible solo para análisis y sin efecto sobre avance, dominio, recuperación o cierre.
El validador de freeze acepta únicamente ese literal; intentar habilitarlo con cifras ad hoc falla
con `CAL-11`. La barrera SQL ya implementada sigue siendo parte de la evidencia: `svc_session`
puede escribir `shadow_metric`, pero la suite PostgreSQL demuestra que no puede leerlo y por tanto
no puede devolverlo al agente o a la política. Son 4 pruebas nuevas, 1064 totales.

### `T-H5-17` — arnés AIS y CAL-06/CAL-NLI

El arnés exige preinscripción, binding, codebook, estratos idioma×forma lógica×KC×tipo, criterios
aportados externamente, inventario hasheado y juicios AIS trazables. No trae umbrales por defecto.
Verifica que el fragmento reproduzca el hash W1 y que el inventario material coincida con su hash;
una muestra vacía falla `CAL-NLI`. Reporta TP/FP/TN/FN, tasas FP/FN, precisión y recall por estrato,
con numeradores y denominadores; el agregado lleva `authorizesGate=false`. Un `test_fixture` jamás
demuestra fiabilidad. `nliGate` requiere evidencia material del binding y estrato exactos y aun así
no se convierte en veredicto final. No se creó muestra, informe ni gate real. Son 12 pruebas nuevas,
1076 totales. Procedimiento: `docs/content/groundedness-calibration.md`.

### `T-H6-01` — estado estructurado y replay

`session-state-v1` implementa la secuencia primaria literal, los ocho transversales y todos los
campos de P-I §8.2. Cada decisión agrega automáticamente decisor/autonomía; `model` no puede ser
autoridad. Los eventos enlazan hash anterior/resultante sobre JSON canónico y el replay rechaza
huecos, orden, tiempo, IDs o hashes adulterados. PostgreSQL persiste el JSON completo+hash y compara
sus escalares; una instalación con filas históricas incompletas exige replay material en vez de un
backfill inventado. BKT queda ausente en código y BD. Son 16 pruebas unitarias y 3 PostgreSQL nuevas:
1095 totales. Diseño: `docs/session/state-machine.md`.

### `T-H6-02` — política pedagógica determinista

`pedagogy-policy` dejó de ser esqueleto. La tabla es JSON estricto con versión, hash canónico,
jerarquía, patrones, controles y binding de calibración. El registro de corrida fija
`runId→purpose+version+hash` sin reasignación. La evaluación por etapas impide que retrieval/fading
se adelanten a seguridad o prerrequisitos; `MEASUREMENT_MODE` suprime la decisión. Las diez
estrategias siguen siendo las del contrato: fading reduce ayuda y feedback es un adjunto. Retrieval
solo acepta motor/calendario y reserva de práctica; autoexplicación solo acepta tres disparadores.
Una estrategia independiente no vuelve elegible el intento por sí sola: exige confirmación
estructurada de `domain_engine`. Los bindings se restauran desde JSON y conservan la prohibición de
reasignación tras reinicio. La política material incluida conserva `CAL-10/CAL-WHEEL=pending`; los
valores de las pruebas son `test_fixture` y no autorizan corrida material. Son 29 pruebas nuevas:
1124 totales. Diseño:
`docs/session/pedagogy-policy.md`.

### `T-H6-03` — dominio operativo y reconfirmación

`domain-engine` aplica la regla literal versionada y congelada por corrida: tres correctas
elegibles consecutivas con complejidad CAL-09 no decreciente y al menos una transferencia cercana
elegible. La identidad CAL-09 se compara contra el manifiesto congelado de H5; no se recalibra ni
reordena. La autoridad de ayuda se deriva por código: el nivel 1 solo conserva elegibilidad como
recordatorio puro, mientras niveles 2–5, selección de regla/paso y contenido decisivo siempre
descalifican. El modelo y BKT no tienen entrada autoritativa.

Los aciertos con ayuda decisiva requieren reconfirmación enlazada. Cada declaración crea un
`post_mastery_reconfirmation_pending`; la primera oportunidad disponible de práctica independiente
en `LEARNING_MODE` se programa, y hasta resolverla quedan bloqueadas la práctica ordinaria que la
saltaría, la reenseñanza deliberada y la siguiente sesión que vuelva a hacer objetivo al KC. Una
incorrecta observada registra `reconfirmation_failed`; retirada, cierre, incidente o ausencia
válida son `missing`, no falso dominio. Replay conserva todas las declaraciones, evaluaciones e
historias terminales y se proyecta al estado reconstruible de sesión.

Son 27 pruebas de dominio y una integración de sesión nuevas: **1152 totales** (1022 unitarias +
130 PostgreSQL). `CAL-DOMAIN-POLICY/DUP-02` solo validan en seco la regla vigente; no se simuló
calibración ni se cerró H10. Diseño: `docs/session/domain-engine.md`.

### `T-H6-04` — recuperación y límite pedagógico

`domain-engine` materializa los tres ciclos exactos de P-I §8.7 y congela política, grafo e
identidad del inventario por corrida. Solo un fallo `PEDAGOGICAL` en `LEARNING_MODE` inicia: el
feedback debe coincidir con el error observado; complejidad realmente baja; los KC revisados son
prerrequisitos del grafo; scaffolding es contingente; la representación cambia y la
autoexplicación queda selectiva. Material fallido o consumido no reaparece. Progreso vuelve a la
evaluación de dominio sin declarar dominio desde una sola actividad; operación, interfaz,
incidente, retirada o falta de reserva no se convierten en fallo conceptual.

Los episodios posteriores exigen `recovery_reserve_registry`, inventario congelado, reserva
`recovery`, mismo KC y material distinto. Programar no cuenta; iniciar sí. El contador y los fallos
son por KC: dos episodios consumidos alcanzan el tope, pero solo dos fallidos declaran límite. En
ese caso se cierran transitivamente las rutas FORMAL, POLITICA_CONTENIDO y PEDAGOGICA; C/A y
ESTADISTICA no bloquean. Estado, contadores y caminos se derivan de historia y replay. Sesión
proyecta estrategia, andamiaje, plan y próximo paso, con el transversal `recuperacion` como evento
separado. No hay salida de rescate docente.

Son 25 pruebas de recuperación y una integración de sesión nuevas: **1178 totales** (1048
unitarias + 130 PostgreSQL). Los inventarios y grafos de prueba son `test_fixture`; no se fabricó
inventario/corpus/firma/gate material. Diseño: `docs/session/recovery.md`.

### `T-H6-05` — banco y autoridad de pistas

`domain-engine` fija una política hasheada con los cinco niveles literales y un banco congelado por
corrida. Cada reactivo debe traer exactamente un registro por nivel y un solo KC. Reactivo, KC,
nivel, hechos, texto, anclajes, pipeline, paquete y evidencias quedan ligados: el nivel 4 exige la constancia no isomorfa del
canonicalizador, y la validación de no revelación cubre el contenido exacto que se entrega. El
runtime no carga soluciones ni transforma texto. La detección automática de autoría se declara
literal, no de paráfrasis; W4 sigue siendo necesaria y no se simuló.

La autoridad decide por item+nivel exactos, sin fallback. `MEASUREMENT_MODE` y nivel 0 se resuelven
antes de consultar si existe el item. Repetir una pista no duplica la entrega y un intento no puede
cambiar de reactivo. Nivel máximo y `masteryDisqualifying` se derivan de las entregas mediante
`domain-engine`: nivel 1 sólo conserva elegibilidad como recordatorio puro; niveles 2–5 y contenido
decisivo descalifican. La propuesta del generador debe coincidir para pasar el linter, pero nunca se
copia como autoridad.

El binding persistible fija política+banco+paquete y material exige hashes externos. Replay valida
historia y, al continuar desde un snapshot, vuelve a contrastar cada entrega completa contra el
banco. `session-engine` proyecta sólo niveles/máximo/bandera con identidad coincidente, nunca texto
ni solución. Son 23 pruebas de pistas y una integración de sesión nuevas: **1202 totales** (1072
unitarias + 130 PostgreSQL). Sólo se usaron bancos `test_fixture`; no se fabricó banco, corpus,
auditoría, firma ni gate material. Diseño: `docs/session/hint-bank.md`.

### `T-H6-06` — autoridad aislada de medición

Los contratos `Probe*` quedaron estrictos y comparten con autoría un único catálogo de reservas,
mapeo solicitud→reserva y exclusiones por consumo. La sesión sólo puede pedir conjunto, fase y tipo;
entrar fuerza `MEASUREMENT_MODE`, ayuda cero y no elegibilidad, y salir consume el resultado del
worker sin poder reclasificar validez.

`measurement-worker` liga por corrida política, inventario y semilla versionados/hasheados. Material
exige hashes externos; los fixtures no los suplantan. El plan primario debe coincidir con el freeze
H5 de 3 ítems/mínimo 2. La selección SHA-256 usa semilla privada, entrega un solo prompt por vez y
registra selección+consumo antes de devolverlo. No expone banco, semilla, familia, firma estructural,
solución, pista ni feedback. Tiempo/verificador salen del inventario y la validez se deriva de una
política de reason codes; reserva agotada queda faltante salvo mínimo ya alcanzado.

Replay/restauración rederivan plan, ranking, prompt, ordinal, consumo y resultado. La persistencia
usa un CTE compare-and-set y una prueba PostgreSQL con dos conexiones concurrentes demuestra un solo
ganador y un solo consumo. Son 25 pruebas del worker, cuatro ampliaciones de contratos, dos de
sesión y una PostgreSQL: **1234 totales** (1103 unitarias + 131 PostgreSQL). No se creó calendario,
inventario, semilla, preinscripción, firma ni gate material. Diseño:
`docs/session/measurement-authority.md`. El calendario se cerró en `T-H6-07`; las interrupciones
siguen en `T-H6-08`.

### `T-H6-07` — calendario SCED global

`packages/experiment` contiene una política y una semilla estrictas, versionadas, hasheadas y
ligadas inmutablemente por corrida. El modo material exige los hashes externos del freeze; ningún
estado ni artefacto público expone la semilla. El triple planificado se deriva por SHA-256 solo de
combinaciones que ya cumplen ventanas A 6–8, B 9–11, C 12–14 y separación mínima 3.

Cada `probe_round` abre exactamente tres `ProbeRequest`, una por conjunto. Solo las tres
observaciones válidas y compatibles con el 3/2 de H5 avanzan una vez el contador y alimentan las
series; parciales y oportunidades bajo mínimo quedan descriptivas y `schedule_invalid`. La
estabilidad, el diferimiento máximo de dos rondas válidas, el límite de ventana, la separación
efectiva y el cierre en 19 rondas se rederivan en replay. Las actividades no-ronda nunca avanzan y
la covariación se registra sin reinterpretarla.

El dominio por conjunto agenda retención exactamente siete días después, con reserva exclusiva y
sin `probe_round`; hasta resolverla, la reenseñanza dirigida del conjunto queda bloqueada. Son 25
pruebas del calendario y una integración pública calendario→worker: **1260 totales** (1129
unitarias + 131 PostgreSQL). Una mutación sembrada de `every` a `some` fue detectada por la prueba
de ronda inválida. Los fixtures no afirman inventario, semilla, binding, preinscripción, firma ni
gate materiales. Diseño: `docs/session/sced-calendar.md`.

---

## 3.b Lo cerrado en la sesión del 15-08, cuarta

Cuatro tareas —`T-H5-05` a `T-H5-08`—, seis módulos nuevos en `packages/authoring-core`
(`generation.ts`, `hints.ts`, `critique.ts`, `reserves.ts`, `family.ts`, `coverage.ts`) y **151
pruebas nuevas** (837 → 988).

### `T-H5-05` — W3, autoría automática

Los diez pasos de §12 «W3». Tres decisiones lo gobiernan, y las tres son sobre lo que el pipeline
**no** puede hacer:

1. **Rol C no entrega la solución, y no hay campo donde ponerla.** El tipo lo impide en compilación
   y `assertNoAuthoritativeSolution()` lo impide cuando el objeto llega como JSON del modelo.
   Aceptarla convertiría el texto de un modelo en el patrón contra el que se califica al alumno.
2. **El orden del pipeline de validez no se cablea.** Entra como dato con procedencia —arnés,
   corrida, versión del paquete— o no se ejecuta; con solo un informe del arnés se cae por
   `freezeWinningOrder()`, que **se ejercita en vez de esquivarse**. Un orden congelado sobre la
   muestra L0 se rechaza. Y W3 **ejecuta la variante misma de `BENCH04_VARIANTS`**: si lo que corre
   en autoría no es lo que se midió, la medición no dice nada de esta corrida.
3. **La solución no cabe en el registro público del reactivo.** `W3ItemRecord` **no tiene campo**
   para el certificado; van en `privateSolutions`, aparte. Es la separación física del paso 10
   llevada al tipo: serializar el registro entero hacia `items/` no puede sacarla.

Lo demás, en orden: los cuatro estados de autoría de §7.4 distinguidos y `no_proof_exists_in_calculus`
ausente (CALC-03); re-verificación del certificado **otra vez** aquí, en función aparte para poder
probarla con un certificado inválido sin abrirle al pipeline un `verify` inyectable; los filtros de
§7.5 con la meta trivial comprobada **antes** de buscar —`A∧B ⊢ A∧B` vuelve con `proof_found`—;
complejidad medida y **no comparada** con la objetivo, que exige `CAL-09`; duplicado trivial e
isomorfismo reportados por separado porque piden arreglos distintos; Rol D con la propuesta de
`masteryDisqualifying` guardada **como propuesta**; y Rol E cuyo veredicto **no mueve la aceptación
en ninguna dirección**.

### `T-H5-06` — reservas sin solapamiento

Toda la tarea la decide **una palabra de P-I §7.7**: «isomorfismos **prohibidos**», no
«isomorfismos».

- **Dentro de una misma reserva la colisión no está prohibida: es la familia.** §7.8 define familia
  como los candidatos que comparten plantilla, función de banco, KC objetivo y **la misma
  `structural_signature`**, y dice que renombrar átomos o reordenar pasos independientes **no crean
  una familia nueva**. Los miembros de una familia son isomorfos entre sí por definición.
- **Entre dos reservas de enseñanza tampoco**: practicar guiado y después independiente sobre la
  misma estructura es scaffolding y fading.
- **En cuanto una de las dos es de medición, sí.** §5.11 lo dice de las dos categorías de
  transferencia con todas sus letras.

Eso **corrigió un defecto de `T-H5-05`** que entró en el mismo commit: su paso 6 rechazaba todo
isomorfo sin mirar la reserva, lo que dejaba toda familia paramétrica en un solo miembro y volvía
inalcanzables los pisos de §7.8 y de P-III §4.2. No se veía con las pruebas en verde porque ninguna
comprobaba que dos gemelos de la misma reserva sobrevivieran.

Las reservas de medición se **derivan** del contrato de P-II §6.3 (`MeasureKind` × `ScedPhase`), y
las combinaciones que ninguna autoridad describe lanzan. El control de superficie de §5.11 es el que
**no necesita umbral** —igualdad de la redacción normalizada—; cualquier medida de parecido sí, y por
eso `surfaceSimilarity()` falla cerrado. **`DUP-01`**: `isolated` vale `null` —no `true`— cuando
alguno de los dos bancos de transferencia está vacío, y afirmar que el aislamiento está *demostrado*
falla cerrado con `CAL-07`: «no detecté» no es «no hay».

### `T-H5-07` — `item_family_id`

Derivado de los cuatro componentes, no asignado por contador (como el `fragment_id`, D-17). Así, «un
cambio real de estructura, función o KC **sí** crea familia distinta» es aritmética y no una regla
que alguien recuerde; y la redacción no puede moverla porque **no es uno de los cuatro componentes**.

Lo que la derivación sola **no** impide es la elusión real: `generator_template_id` es cadena libre,
así que reetiquetar la plantilla de un candidato defectuoso lo sacaría de la familia que va camino de
quedar bloqueada por `T-H5-09`. Eso lo cierra `FamilyRegistry`: la primera asignación fija, sin
`remove`/`clear`/`reassign`.

### `T-H5-08` — cobertura mínima

La frontera de la tarea es **qué cifra la norma y qué deriva del calendario**. Lo cifrado se
comprueba (6 actividades por KC, 3 niveles de pista, 1 transferencia, recuperación, trazabilidad, y
la reserva del 20 %). En ese checkpoint lo derivado del calendario todavía fallaba cerrado con
`CAL-01`; T-H5-11 ya lo cerró mediante el sobre congelado y mantiene el bloqueo si el banco no llega.

Los pisos van como **datos con `parameterId`**, no como números sueltos dentro de un `if`, porque
§4.2 exige identificarlos en el registro de parámetros y congelarlos. Tres entradas se exigen
declaradas —KC del piloto, puntos críticos y tipos de error prioritarios— porque sin ellas los pisos
que dependen de ellas pasarían por vacío. Y en retención hay dos salidas y ninguna más: medir con
reserva válida, o declarar `retention_not_evaluated` **con motivo**; decir que se medirá con la
reserva vacía **lanza en vez de degradarse solo al código**.

### Las cuatro cosas que las pruebas en verde no enseñaban

En `T-H5-05` se sembraron **36 mutaciones y las 36 quedaron detectadas a la primera**. Y aun así,
releyendo el módulo ya escrito aparecieron cuatro huecos que ninguna prueba señalaba:

1. **Una guarda exportada que el pipeline no llamaba.** `assertNoAuthoritativeSolution()` estaba
   escrita, probada y sin usar: un candidato con solución habría atravesado W3 entero.
2. **Ids repetidos.** Dos candidatos con el mismo id habrían guardado dos certificados bajo la misma
   clave en `solutions-private`.
3. **Huérfanos descartados en silencio.** Unas pistas o una crítica que apuntan a un candidato que no
   está en el lote se ignoraban; el paso 8 constaría como hecho sobre un reactivo que nadie criticó.
4. **Un estado inventado**, y es el peor: un candidato caído por sintaxis se registraba con
   `authoringState: search_budget_exhausted`, afirmando del buscador un gasto de presupuesto sobre
   algo que nunca vio —y el pipeline lo habría «arreglado» subiendo el presupuesto—. Ahora el estado
   de autoría **falta** cuando la búsqueda no corrió.

**Ninguno de los cuatro se veía con las pruebas en verde, ni con las 36 mutaciones detectadas.** La
siembra prueba que los controles que hay funcionan; no dice nada de los que faltan.

En total esta sesión sembró **103 mutaciones** (36 + 20 + 17 + 30) y **una sobrevivió**: la que
comprueba que el contrato de bancos de transferencia no se ha separado del catálogo de reservas. Solo
salta si los dos divergen, y hoy no divergen —guarda que no se puede disparar desde fuera—. Se hizo
inyectable con valores por omisión, como `findCycles(edges)`, y entonces se pudo probar.

Y el patrón se repitió en las cuatro tareas: **cada una dejó huecos que solo aparecieron releyendo el
módulo con todo en verde**. En `T-H5-06`, que W3 mataba las familias. En `T-H5-07`, que un defecto
del candidato se convertía en fallo del pipeline. En `T-H5-08`, dos: la transferencia de medición
cubriendo un piso que dejaba el dominio inalcanzable, y la capacidad de reconfirmación contada en
total en vez de por KC. **Ninguno lo señaló una prueba ni una mutación.**

### Y un defecto real de `proof-search` que W3 destapó

`linearize()` emitía todas las premisas y, si la meta ya estaba entre ellas **sin ser la última**, no
añadía línea: la derivación terminaba en otra fórmula, `verify` devolvía `goalReached: false` **sin
ningún código de error** y la re-verificación obligatoria escalaba a **incidente de nivel 3** una meta
que solo era trivial (`A, ¬A ⊢ A`). Corregido reiterando la conclusión en el ámbito principal, que es
la convención Fitch que el código ya aplicaba dentro de una subprueba, con prueba de regresión. El
`TrivialGoal` del contrato (P-II §4.4) estaba **declarado y sin usar**, y el hueco no se veía porque
todos los casos de prueba previos tenían la meta como **única** premisa.

---

## 3.c Lo cerrado en la sesión anterior (15-08, tercera)

Cuatro tareas, todas en `packages/authoring-core`, **118 pruebas nuevas** (719 → 837). Cada una con
su commit, su batería en verde y subida a `main` al terminarla.

### `T-H5-01` — W1, ingesta (`ingestion.ts`)

Los seis pasos de §12 «W1», las seis validaciones de bloqueo de P-III §3.2 y los siete campos de
fragmento de §3.3.

- **El orden de comprobación es el requisito**, igual que en la clasificación de salida de la
  pasarela: identidad → legibilidad → contenido. Si la deriva se mirara después, el informe diría
  «KC sin cobertura» de un documento que ni siquiera es el que W0 evaluó. Hay prueba con deriva **y**
  falta de cobertura a la vez de que gana `CorpusDriftError`.
- **Una deriva de hash no se resuelve actualizando el snapshot.** Actualizarlo borraría el hecho de
  que la fuente cambió después de evaluarse; la salida es reevaluar en W0.
- **La identidad tiene dos mitades**: los bytes y la etiqueta de versión. La segunda viaja dentro del
  `fragment_id`, así que aceptar los mismos bytes bajo otra versión haría que las anclas citaran una
  versión que nadie evaluó.
- **W1 no vuelve a clasificar licencias.** Los veredictos por uso entran como dato de W0 y **un uso
  no declarado no está permitido**. Es lo que hace que el caso Calgary sobreviva a la ingesta: el
  material entra como fuente documental y sus fragmentos **no** son base expresiva.
- **`kcsWithoutExpressiveBase` no bloquea, y es a propósito**: ninguna autoridad dice que deba. Pero
  sin ese dato, W3 descubriría en plena autoría que no puede construir reactivos para un KC y el
  hueco parecería un fallo del generador.
- **Los IDs de fragmento se derivan, no se numeran** (D-17). Un ID que solo W1 supiera construir no
  sería un ancla.
- **La legibilidad no tiene umbrales.** Vacío, U+FFFD y controles C0: hechos del decodificador. Una
  fracción mínima de caracteres legibles sería un parámetro que ninguna autoridad fija.
- **Tres entradas se exigen declaradas** (D-18): KC candidatos, secciones necesarias y familia de
  notación autorizada. Con lista vacía, sus tres validaciones pasarían **por vacío**.

### `T-H5-02` — W2, extracción curricular (`extraction.ts`)

- **El tipo de claim se comprueba, no se declara.** `cross_source_consensus` exige **dos componentes
  distintos** —dos fragmentos de la misma obra son una sola fuente, y un conteo de anclas lo daría
  por bueno— y `system_inference` **no puede citar fuentes**. Esa segunda regla importa más de lo que
  parece: §7.11 saca `system_inference` del denominador de atribución, así que una etiqueta falsa
  movería la métrica de groundedness sin que nadie tocara la métrica.
- **Las tres formas de no anclar se distinguen** porque exigen arreglos distintos: fragmento
  inexistente (cita inventada), hash que no cuadra (ancla envejecida) y fragmento sin permiso
  documental de W0 (atribuir a material no citable fabricaría la cadena).
- **Las decisiones pedagógicas van aparte y no son claims** (§7.11 literal), con soporte y
  justificación obligatorios. Mezcladas, una decisión nuestra se leería como algo que la fuente
  afirma.
- **W2 no juzga la verdad de nada**: anclaje, tipo e identidad. Que el claim se siga del fragmento lo
  mide `T-H5-17`, y el NLI nunca es autoridad.

### `T-H5-03` — mapa de KC (`kc-map.ts`)

- **Los `rule_id` se derivan de `logic-core`**, no se copian. Copiados, mapa y cálculo podrían
  separarse sin que nada lo notara, y el desajuste aparecería en la primera corrección.
- **`KC12 PC:KC10` es la única arista de política de contenido** del catálogo. Tratarla como formal
  afirmaría una necesidad del cálculo que el Maestro niega por escrito.
- **`KC17` no tiene arista a `KC16`**: el orden entre ambas es pedagógico, no necesidad formal.
- **Las aristas cruzadas se enumeran por tipo, nunca sumadas.** Un total diría cuántas rutas de
  contaminación hay pero no cuál se puede quitar cambiando una política, que es lo que decide la
  selección de conjuntos.
- **Justificar un ciclo no silencia los demás.** Una arista puede cerrar más de uno, y bastaría
  justificar el más inocente.

### `T-H5-04` — política pedagógica (`pedagogy.ts`)

- **El catálogo de estrategias es de doce y el enum de decisión de diez, y la asimetría es del
  Maestro.** P-I §5.10 enumera doce acciones; P-II §7.2.1 da —con las palabras «por ejemplo»— un
  contrato con diez. **No se arregla inventando dos miembros de enum**: cada entrada sin miembro
  declara por dónde se expresa, y `toDecisionStrategy()` falla cerrado al pedírselo. `fading` se
  expresa bajando `assistanceLevel` —el *fading* es literalmente retirar ayuda— y `feedback` acompaña
  a la decisión en vez de competir con ella. Devolver «la más parecida» haría que la traza registrara
  que se dio ayuda justo en el paso en que se estaba retirando.
- **Ninguna regla de activación puede dispararse en `MEASUREMENT_MODE`.** §8.3.1 pone el modo por
  encima de la selección de estrategia; una regla que se activara midiendo se vería como una ayuda
  oportuna justo donde la medición deja de valer.
- **Los pasos de patrón que no son estrategias se registran como acción del motor.** Inventarle una
  estrategia a «volver al KC objetivo» afirmaría una decisión pedagógica donde solo hay una
  transición.
- **`fading` por reloj exige la evidencia de preinscripción que la norma exige**; sin ella mediría
  cuánto aguanta el alumno sin ayuda, no cuánto aprendió.
- **La revisión espaciada no consume reserva de medición**: gastarla consumiría el material con el
  que después se mide la retención.

### Lo que aquella sesión dejó como método

Se sembraron **43 mutaciones** en los cuatro módulos y todas acaban detectadas, pero **tres no lo
estaban al primer intento** y las tres enseñaron algo distinto:

1. **Un control que pasa por vacío.** El filtro de permiso documental de la cobertura de KC nunca se
   ejercitaba, porque todos los fixtures tenían ese permiso. Se añadió el caso que sí lo ejercita.
2. **Una prueba que pasa por el motivo equivocado.** La de «estrategia fuera del catálogo» usaba una
   matriz de una sola regla, así que fallaba por patrones no representables y no por el catálogo, que
   es lo que decía comprobar. Ahora usa la matriz completa y afirma el mensaje.
3. **Una guarda que no se puede disparar desde fuera.** Estaba atada a una constante interna. Se hizo
   inyectable —como ya lo eran `findCycles(edges)` y `assertAcyclicOrJustified`— y entonces se pudo
   probar.

**Ninguna de las tres se veía con las pruebas en verde.** Y una cuarta cosa apareció sin siembra,
releyendo `ingestion.ts` ya escrito: la etiqueta de versión no se comprobaba contra la que W0 evaluó.

---

## 3.c De sesiones anteriores

### F4 · H4 — pasarela de modelo: 9 de 12

Hecho: adaptadores propios, capacidades por binding, validación fail-closed de la salida, contexto de
sesión por whitelist con filtro de egreso, canarios, `pricing-manifest` + `cost-ledger`, control de
gasto, matriz de batch/caching y modo degradado. Cuatro checks nuevos en CI, todos en el job `arch`
—que es de los que sí pasan sin el PAT—: `ci:gateway:fail-closed`, `ci:gateway:contracts`,
`ci:canary`, `ci:cost:ledger`.

- **No hay ningún nombre de modelo ni parámetro de muestreo escrito en el código.** El id sale del
  binding; los parámetros los autoriza el binding. Escribir «claude-x» o «temperature: 0» en un
  adaptador anticiparía un ganador que solo `BENCH-01/02` decide.
- **`AuthorizedParameters` es un tipo de marca** que solo produce `authorizeParameters()`. No lo
  sortees con un cast: es lo que impide que un adaptador reciba parámetros sin contrastar.
- **`ModelGateway` no tiene `send()`**, solo `execute()` con esquema obligatorio. Se retiró a
  propósito: un `send()` crudo sería un camino para leer salida del proveedor sin validación local,
  que es el agujero que P-II §8.4 cierra.
- **El orden de clasificación de la salida es el requisito**: truncamiento, rechazo y error de
  proveedor **antes** que el esquema. Reordenarlo haría que un truncado se reportara como
  `schema_violation` y escondería la causa real.
- **El bloqueo por canario y el de presupuesto no se pueden levantar programáticamente.** No hay
  `unblock`, `reset`, `force` ni `continueAnyway`, y hay pruebas de que no existen.

**Las tres que faltan, y por qué:** `T-H4-09` (refresco documental) es `PENDIENTE` **por diseño** —la
norma pide hacerlo *inmediatamente antes* del benchmark, y adelantarlo produciría evidencia
caducada—; `T-H4-10` y `T-H4-11` están `BLOQUEADA(gasto y credenciales del propietario)`: exigen
llamadas reales facturables y, la segunda, dos proveedores de familias distintas.

### F5 · H4.5 — investigación de fuentes (W0): 8 de 8

Máquina de estados W0, sistema formal objetivo, licencias, descubrimiento, idoneidad/saturación,
manifiesto de selección, autorización externa y trazabilidad translingüe.

- **La whitelist de la base de datos no impone orden.** `operations.w0_state` tiene un `CHECK` de
  pertenencia que acepta saltar de `solicitud_curso` a `corpus_autorizado`. El orden lo impone
  `assertW0Transition`; si escribes al estado sin pasar por ahí, no hay flujo.
- **La clasificación de licencias no devuelve un booleano por recurso**, sino un veredicto **por uso
  previsto**. El caso Calgary obliga: el mismo material sirve como fuente documental del cálculo y
  está bloqueado como base expresiva.
- **`LICENSE_UNRESOLVED` no es `excluido`.** No resuelto espera a que alguien resuelva la
  proveniencia; excluido está decidido.
- **`assertNoHumanRewrite` es la mitad ejecutable de «sin reescritura pedagógica humana».** Si lo
  quitas, la regla vuelve a ser una declaración de intenciones y el veredicto de autonomía deja de
  poder medirse.
- **`suitabilityScore()`, `shouldStopDiscovery()` y `nliGate()` fallan cerrado a propósito.** Una
  parada inventada cierra el corpus antes de tiempo o quema presupuesto, y **ninguna de las dos se
  nota mirando el resultado**.

### F2 · H2 — cerrada; el gate espera firma

Las 16 tareas están hechas y **todo el AC está cubierto localmente**. Mutation testing terminó en
**90.31 % con cero mutantes sin cobertura**; los 112 vivos están clasificados en
[`../quality/mutation-baseline.md`](../quality/mutation-baseline.md).

Dos lecciones de método de ese trabajo:

1. **El reporte imprime el reemplazo, no el nodo mutado.** Dos mutantes distintos de una misma línea
   se ven idénticos. El script debe recortar por `location`.
2. **Una justificación de «rama inalcanzable» hay que intentar alcanzarla antes de escribirla.** La
   del oráculo semántico parecía sólida —toda regla autorizada es sana— y era falsa.

Y dos piezas que conviene conocer antes de tocarlas:

- **`T-H2-14` índice de complejidad** (`proof-search/src/complexity.ts`). Las medidas de P-I §7.6 en
  dos grupos: `structural` no depende del presupuesto, `searchRelative` sí. Esa separación es lo que
  impide leer «nodos explorados» como total de caminos. **No hay escalar**: `complexityIndex()` lanza
  `CalibrationPendingError` hasta que H5 congele los pesos.
- **`T-H2-16` arnés BENCH-04** (`proof-search/src/bench.ts`). Mide en L0 los dos órdenes equivalentes
  y marca cinco clases de hallazgo de seguridad; cualquiera vuelve el informe no comparable.

### F3 · H3 — entorno local

Levantado y endurecido. `pnpm run dev:env && pnpm run dev:up && pnpm run dev:seed`; el runbook está
en [`../../infra/runbooks/local.md`](../../infra/runbooks/local.md). `ci:infra:hardening` comprueba
159 propiedades sobre la configuración **resuelta** por Docker e imprime cuatro imposibilidades
técnicas registradas.

- **`T-H3-05`**: el colector corre y recibe, pero los servicios no emiten spans. No hay operación que
  trazar hasta F7/F8, y un span de «arranqué» para poder decir que hay trazas sería éxito simulado.
- **Infisical** necesita que su cuenta administrativa se cree a mano en <http://localhost:8080>.
  Hasta entonces los servicios leen credenciales de `.env`, que es el modo de arranque, no el de
  destino.

### F1 · H1 — cerrada

Better Auth 1.6.29 autoalojado, con sus seis tablas dentro de `identity` y prefijo `auth_` (D-14).

- **El correo no autentica solo.** No hay enlace mágico ni código por correo, y hay una prueba que
  falla si alguien los añade. Añadirlos violaría P-I §14.2.
- **`svc_api` no borra cuentas.** La supresión es de `svc_background`, que es quien atiende el
  derecho (P-I §14.5).

Lo que **no** está probado y no se afirma que lo esté: la ceremonia WebAuthn completa y el montaje de
rutas HTTP. Son de F7.

---

## 4. Cómo verificar que todo sigue en pie

```bash
pnpm install
pnpm run ci:lint && pnpm run ci:typecheck && pnpm run ci:unit && pnpm run ci:build
pnpm run ci:arch:depcruise && node scripts/arch/verify-depcruise-catches.mjs
pnpm run ci:logic:golden && pnpm run ci:logic:pbt && pnpm run ci:logic:no-net
pnpm run ci:gateway:fail-closed && pnpm run ci:gateway:contracts
pnpm run ci:canary && pnpm run ci:cost:ledger
pnpm run db:grants:check && pnpm run ci:db:negative
pnpm run ci:supply:sbom && pnpm run ci:supply:drift
pnpm run ci:infra:hardening
```

El entorno local se comprueba aparte, porque necesita Docker y tarda:

```bash
pnpm run ci:infra:compose-up
```

Estado en el checkpoint: **toda la batería de código está verde en local** para T-H6-07: lint, 35
typechecks, **1260 pruebas** (1129 unitarias + 131 contra PostgreSQL 17 real), 23 builds,
arquitectura y mutaciones sembradas, lógica, gateway, grants, SBOM, suministro y 159 controles de
hardening. El checkpoint anterior tenía 1234 pruebas. `ci:infra:compose-up` compiló los 23 paquetes
dentro de la imagen, pero Docker Desktop falló al desempaquetar la capa común con `overlayfs:
input/output error` y después dejó de responder; es un fallo local del motor, no una aspa de código,
y no se borró caché ni almacenamiento del usuario para ocultarlo. La corrida de CI sigue siendo la
verificación autoritativa de la tarea.

`pnpm run ci:logic:mutation` tarda ~9 minutos y se ejecuta aparte. **Ojo:** Stryker muta solo
`logic-core`, así que las 26 pruebas nuevas o ampliadas de `domain-engine`/`session-engine` **no
mueven el baseline de 90.31 %**. No lo leas como que la cobertura de mutación cayó ni subió: mide
otra cosa.

### Estado de CI en `main` al cerrar

Observado, no supuesto para `T-H6-06` (corrida `31992531164`):

| Job | Resultado |
|---|---|
| `ci:arch:depcruise` (+ los cuatro checks de F4) | ✅ |
| `ci:db:testcontainers · ci:db:negative` | ✅ |
| `ci:supply:sbom · ci:supply:drift` | ✅ |
| `ci:logic:mutation` | ✅ |
| `ci:lint · ci:typecheck · ci:unit · ci:build` | ✅ |
| `ci:logic:golden · ci:logic:pbt · ci:logic:no-net` | ✅ |

`T-H6-07` debe obtener su propia corrida verde después del push. Se comprueba job por
job con:

```bash
gh api repos/MEX-AmatsuMikaboshi/profe_ia/actions/runs/<id>/jobs --jq '.jobs[] | select(.conclusion=="failure") | .name, (.steps[] | select(.conclusion=="failure") | .name)'
```

Merece la pena mirar **qué paso** falló y no solo que el job está rojo: una dependencia, una prueba
o un control de suministro producen la misma aspa en la pestaña Actions. Una tarea se mueve de
`HECHA` a `VERIFICADA` solo después de observar su corrida completa en verde.

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
4. **Stryker.** Necesita `plugins: ["@stryker-mutator/vitest-runner"]` declarado, no acepta
   `vitest.project`, y usa `packages/logic-core/vitest.mutation.config.ts`. **No edites fuentes con
   una corrida en marcha.** Y al leer el reporte, recorta el nodo mutado por su `location`.
5. **Bash de Git y `$APPDATA`.** El shim de pnpm resuelve a una ruta inexistente bajo
   `C:\Program Files\Git\...`. Usa PowerShell para todo lo que invoque pnpm.
6. **PostgreSQL reserva el prefijo `pg_`.** Por eso el rol de migraciones es `owner_migrations` y no
   `pg_owner_migrations` como dice el plan (desviación D-6).
7. **Un `.yml` de workflow inválido no degrada un check: los apaga todos.** Un `: ` dentro de un
   escalar YAML plano se parsea como mapa anidado y la corrida muere en 0 s **sin ejecutar ningún
   job**. Valida el workflow con un parser antes de subirlo —el paquete `yaml` ya está en el árbol— y
   usa escalar de bloque (`run: |`) para cualquier mensaje con dos puntos.
8. **Bash aquí no entiende los here-strings de PowerShell.** `git commit -m @'…'@` mete un `@` como
   primera línea del mensaje. Para mensajes largos, heredoc (`cat > /tmp/msg <<'EOF'`) y `-F`.
9. **Cuidado al escribir caracteres de control en un fuente.** Al crear `ingestion.ts` una clase de
   regex quedó con controles C0 literales en vez de escapes, ilegible y candidata a
   `no-control-regex`. Se resolvió comprobando por punto de código en un bucle, que además se lee.

---

## 6. Disciplinas que hay que mantener

No son preferencias de estilo; son lo que hace que este proyecto valga algo.

- **No inventar.** Si falta una decisión y ninguna autoridad la resuelve, va a
  `docs/blocked-by-spec.md` (§0.2.5), no a un valor plausible. El mecanismo `pendingCatalog()` de
  `packages/contracts/src/pending.ts` existe justo para eso. Hoy no hay ninguno pendiente.
- **Expectativas a priori.** El generador del conjunto dorado declara qué debe pasar **antes** de
  ejecutar. Nunca grabes la salida observada como «esperado»: eso convierte el conjunto dorado en un
  espejo del bug.
- **Los controles positivos importan.** La suite negativa de privilegios incluye pruebas de que cada
  concesión de la matriz **sí** funciona. Sin ellas, una base rota haría pasar todas las negativas.
- **Nada de degradación silenciosa.** Un fallo no se disfraza de resultado benigno. El CLI falla con
  `NO_IMPLEMENTADO` en vez de simular éxito; `proof-search` lanza `CertificateRejectedError` en vez
  de devolver «no encontré».
- **Desviaciones documentadas.** Cualquier apartamiento del plan va a §«Decisiones de ingeniería» de
  `PLAN_STATUS.md` con su causa. Van **D-1 a D-23**.
- **Una siembra en verde no dice nada de los controles que faltan.** En `T-H5-05` se sembraron 36
  mutaciones y las 36 quedaron detectadas a la primera; y aun así, releyendo el módulo aparecieron
  cuatro huecos, entre ellos **una guarda exportada y probada que el pipeline nunca llamaba** y un
  **estado inventado** para un candidato que el buscador nunca vio. La siembra mide los controles que
  hay; releer el módulo es lo que encuentra los que no están.
- **Una justificación se intenta refutar antes de escribirla.** Vale para los mutantes
  «inalcanzables» y para cualquier «esto no puede pasar»: si no intentaste alcanzarlo, no lo sabes.
- **Un commit, una tarea `T-*`**, con `PLAN_STATUS.md` actualizado en el mismo commit, y **se sube al
  terminarla** (§12 del plan y §8 de este documento).
- **Siémbrale un fallo a todo check nuevo antes de darlo por bueno.** Es el mismo método que
  `verify-depcruise-catches.mjs` aplica a las reglas de arquitectura, y en esta sesión pagó tres
  veces. Con las pruebas en verde no se distingue un control que funciona de uno que **pasa por
  vacío**, de uno que **pasa por el motivo equivocado** ni de una **guarda que no se puede disparar
  desde fuera**. Para lo tercero: si una comprobación está atada a una constante interna, hazla
  inyectable con la constante por omisión —como `findCycles(edges)`—, y entonces se puede probar.
- **Releer el módulo ya escrito encuentra lo que las pruebas no.** El hueco de la etiqueta de versión
  en W1 apareció así, con todo en verde: ningún fixture la remarcaba, así que no había nada que
  fallara.
- **Cuando falte un mapeo que ninguna autoridad da, hazlo dato y falla si no está.** Pasó en F4/F5
  con el reparto operación↔perfil (D-15), la política de rearme del gate de gasto (D-16) y los
  umbrales de saturación; y en F6 con las tres declaraciones que W1 exige (D-18). Cablear un valor
  plausible habría movido una frontera real con una suposición.
- **Lo que la norma enuncia como condición no se convierte en arista, ni en estrategia, ni en enum.**
  «Disponer de una disyunción» quedó como condición del KC13 y «volver al KC objetivo» como acción
  del motor. Forzarles una estructura afirmaría una dependencia o una decisión que nadie declaró.

---

## 7. Lo que no está verificado y conviene no olvidar

- **Ninguna tarea está `VERIFICADA`.** Todo lo que dice `HECHA` está verificado **localmente** y es
  reproducible, pero §0.4 exige el check en verde en `main`. No marques `VERIFICADA` por el hecho de
  haber subido el código.
- **F6 ha construido mecanismos, no contenido.** Las ocho tareas cerradas producen validadores y
  catálogos —`T-H5-05` incluida: W3 es el pipeline, no una corrida—, pero **todos los artefactos de
  `content/` siguen siendo placeholders de ~140 bytes**:
  `source/manifest.yaml`, `source/fragments/`, `extracted/*.yaml`, `kc/map.yaml`,
  `experimental-sets.yaml` y los cinco de `pedagogy/`. Solo `kc/authorized-calculus-v1.yaml` tiene
  contenido real. No es un olvido: casi todos dependen de una corrida W0 sobre fuentes reales que no
  existe, y poblarlos a mano sería fabricar corpus. **La excepción es `kc/map.yaml`**, que sí se
  podría serializar ya desde `KC_CATALOG` porque es literal del Maestro y no depende del corpus; si
  se hace, va con su propia tarea y recordando que `content/` se sube **primero** (§8).
- **F5 no ha corrido W0 sobre fuentes reales.** `research/` sigue con `selection-manifest.yaml`,
  `source-scores.yaml`, `conflicts.yaml`, `coverage-saturation.yaml` y `license-register.yaml` como
  placeholders. Solo `whitelist.yaml` está poblado.
- **F4 no tiene ni una llamada real a un proveedor.** Toda la pasarela está probada con transporte
  inyectado. Eso prueba la lógica local, **no** que un proveedor responda como el adaptador supone.
  Si al hacer la primera llamada real aparece un `UnknownProviderContractError`, es el adaptador
  haciendo su trabajo.
- **El ZIP de mockups no coincide** con el hash de §0.1, aunque el HTML normativo interno sí coincide
  byte a byte. Registrado en `packages/ui-tokens/vendor/PROVENANCE.md`.
- **Los tokens vendorizados cargan Archivo desde Google Fonts** con un `@import`. Incompatible con
  local-first durante una corrida: hay que autoalojar la fuente antes de que `apps/web` los consuma.
- **Calibraciones abiertas por diseño**: `CALC-03`, `CALC-05`, `CAL-04`, `CAL-07`, `CAL-08`,
  `CAL-SOURCE-SCORE` y `CAL-SATURATION` (H4.5), `CAL-NLI` (H5), y los benchmarks `BENCH-01/02`
  (F4) y `BENCH-04` (orden del pipeline, F6). `CAL-09` y `CAL-SCED-OPPORTUNITY` ya están congeladas
  en `docs/params/registry.yaml`. Las abiertas tienen su punto de fallo escrito en el código.
- **`T-H2-05` aparece dos veces en la tabla de F2** de `PLAN_STATUS.md`. Las dieciséis tareas están
  hechas —el trabajo está—, pero **una de las dos filas lleva el id equivocado**. No se corrigió
  porque no consta cuál de los dos es el bueno, y elegir uno sería inventar trazabilidad.

---

## 8. Control de versiones — hay remoto, y se usa

Remoto del monorepo: <https://github.com/MEX-AmatsuMikaboshi/profe_ia.git> (`origin/main`).

### Regla de trabajo: cada tarea terminada se sube

**Al cerrar una tarea `T-*`, se sube al remoto.** No al final de la sesión ni «cuando haya varias»:
al terminar cada una. Un commit por tarea, con `PLAN_STATUS.md` actualizado en el mismo commit
(§12 del plan).

```bash
git add -A
git commit -m "T-Hx-nn: <qué quedó cerrado>"
git push origin main
```

Antes de subir, las tres comprobaciones que importan:

1. **La batería de §4 en verde.** No se sube una tarea con un check rojo.
2. **Ningún secreto.** `infra/compose/.env` está en `.gitignore` y ahí se queda. Compruébalo con
   `git status --short` antes del commit: si aparece un `.env`, para y arréglalo.
3. **El mensaje dice qué tarea cierra**, con su id `T-*`. El historial es parte de la evidencia.

### CI y el secreto `CONTENT_TOKEN`

Desde que D-2 se cerró, `content/` es un submódulo que vive en **otro** repositorio privado, y
`secrets.GITHUB_TOKEN` solo alcanza a `profe_ia`: el clon falla con `Repository not found`, que es lo
que GitHub responde a un privado sin acceso, no a un repo inexistente. Los jobs `base` y `logic` lo
necesitan; `arch`, `db`, `supply` y `mutation` no.

Se resolvió el 16-08 con un PAT fine-grained de solo lectura guardado como secreto `CONTENT_TOKEN`:

- Resource owner `MEX-AmatsuMikaboshi`, **ambos** repositorios (`profe_ia` y `profe_ia_contenido`),
  permiso `Contents: Read`. Los dos, porque `checkout` usa el mismo token para el repo principal y
  para el submódulo.
- Se guarda con `gh secret set CONTENT_TOKEN --repo MEX-AmatsuMikaboshi/profe_ia`, que lo pide por
  stdin y no lo deja en el historial.

Es acción del propietario, como la cuenta administrativa de Infisical. Un paso previo de cada job
falla con mensaje explícito si el secreto no está, en vez de dejar morir a `checkout`.

**Regla general que dejó este episodio:** todo check que inspeccione **contenido** de `content/` debe
ejecutarse dentro del submódulo. Desde el padre solo se ve el gitlink, y por eso el check «conjunto
dorado reproducible» llevaba pasando por vacío.

### El repositorio de contenido

`content/unidad-deduccion-natural/` es un repositorio git independiente con historial propio (§4.3).
Su remoto es <https://github.com/MEX-AmatsuMikaboshi/profe_ia_contenido.git> (privado) y **ya está
formalizado como submódulo** en `.gitmodules`: **D-2 cerrada** el 15-08-2026.

- **Al clonar**, usa `git clone --recurse-submodules`; si ya clonaste, `git submodule update --init`.
  Sin el contenido, `ci:unit` y `ci:logic:golden` no pueden correr: leen el cálculo congelado y los
  413 casos del conjunto dorado desde ahí.
- **Al cambiar contenido**, se sube **primero** el repositorio de contenido y **después** el monorepo
  con el gitlink actualizado. Al revés, el gitlink apunta a un commit que no existe en el remoto y el
  checkout de CI falla con `fatal: reference is not a tree`. Ese orden no es una preferencia: es la
  causa exacta de que el primer push dejara `base` y `logic` en rojo.

---

## 9. Primeros pasos de la próxima sesión

En este orden.

1. **Lee este archivo entero y después `PLAN_STATUS.md`.** No empieces por el código.
2. **Observa la corrida de CI posterior al último push:**

   ```bash
   gh secret list --repo MEX-AmatsuMikaboshi/profe_ia
   ```

   `CONTENT_TOKEN` ya está configurado. Si los seis jobs quedan en verde, ese es el momento de mover
   tareas de `HECHA` a `VERIFICADA` en `PLAN_STATUS.md`, una por una y solo las que su check cubra.
3. **Comprueba que el árbol sigue en pie** con la batería de §4. Debe dar **1260 pruebas**. Si da
   menos, algo se perdió; si da más sin que nadie haya trabajado, algo se duplicó.
4. **Sigue F7 · H6 por `T-H6-08`.** Lee antes `Plan.md` §F7 entero —son 14 tareas y varias se
   condicionan entre sí— y navega el Maestro solo por lo que cada tarea cite (`^#{1,3} ` con Grep).
   Empieza por §3, que enumera las tres cosas que conviene tener claras antes de tocar esa tarea.
5. **Al cerrar cada tarea**, commit propio con su id, `PLAN_STATUS.md` en el mismo commit, batería en
   verde y `git push origin main`. Si tocas `content/`, **primero el submódulo** (§8).

### Preguntas abiertas para el propietario

Ninguna bloquea el trabajo de código, pero las tres llevan tiempo esperando:

1. **Credenciales de proveedor y autorización de gasto** — bloquean `T-H4-10/11`, y con ellas la
   elección del modelo de la que depende F8. El tope declarado es ≈MXN 500/mes con bloqueo duro a los
   700, y el gate ya está implementado y probado.
2. **Cuenta administrativa de Infisical** — hasta entonces los servicios leen credenciales de `.env`,
   que es el modo de arranque, no el de destino.

Las dos son acciones del propietario por naturaleza, no tareas pendientes de nadie más.
