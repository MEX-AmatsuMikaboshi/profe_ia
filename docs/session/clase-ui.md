# Interfaz de Clase — diseño (`T-H6-13`)

*Norma:* P-I §8.9 (pizarrón, editor y capa visual), UIUX §6.5 (Clase), UI-CORR-02
(`MEASUREMENT_MODE`), UI-CORR-04 (apelación y retirada), UIUX §2 (datos ilustrativos), UIUX §3
(dirección visual), T-H7-07 (Clase opera texto+Fitch en F7).

Es la primera tarea real de `apps/web`, que hasta ahora respondía `NO_IMPLEMENTADO` a todo salvo
`/health` (D-11). **Sólo se implementa Clase**; el resto de rutas de `Plan.md` §7 siguen respondiendo
`NO_IMPLEMENTADO`, porque son de F9/F13 y una pantalla vacía con navegación puesta parecería una
vista terminada sin contenido.

## 1. La decisión que gobierna la tarea

P-I §8.9 pide «validación sintáctica local **no autoritativa**; veredicto autoritativo en servidor».
Todo lo demás se acomoda a eso.

Si el editor pudiera afirmar validez habría **dos verificadores con implementaciones distintas**, y
la ruta de verificación dejaría de ser única. Pero si el cliente escribiera su propia gramática, se
separaría del cálculo congelado y el desajuste aparecería como un rechazo del servidor que el alumno
no puede explicarse.

La salida son tres piezas:

| Pieza | Qué hace | Qué **no** hace |
|---|---|---|
| `@profesor-ia/logic-core/syntax` | Subpath que reexporta tokenizador, parser, AST, errores y `analyzeStructure` | No reexporta `verify`, `applyRule`, `entails`, `construction` ni el cálculo |
| `apps/web/src/clase/local-review.ts` | Dice si lo escrito **se puede leer** y describe la estructura | No tiene ningún campo de veredicto: ni `valid`, ni `correct`, ni `ok` |
| `apps/web/src/clase/verdict.ts` | **Pide** el veredicto al servidor | No lo calcula, no lo estima y no lo adelanta |

La frontera no depende de que alguien la recuerde. La regla
`sin-verificador-fuera-del-verificador` de `.dependency-cruiser.cjs` prohíbe a `apps/web` y a
`apps/api` alcanzar el barrel de `logic-core`, y `scripts/arch/verify-depcruise-catches.mjs` siembra
la violación **y** el control positivo: comprueba que la regla detecta el barrel y que deja pasar el
subpath. Sin el segundo, una regla escrita de más dejaría el árbol verde por la razón equivocada.

### Por qué `apps/api` tampoco puede verificar

Sería más corto que `apps/api` llamara a `verify()`. Sería también un segundo verificador **fuera**
del contenedor sin red: el veredicto lo emite `apps/verifier`, que corre con `network_mode: none` y
se habla por un spool en disco (D-12, I-3). `apps/api` deja la derivación en el spool y devuelve lo
que el verificador dijo. De `logic-core` sólo entra el tipo `ProofInput`, por el subpath sin
veredicto.

Del canal se comprueba lo que no debe hacer:

- la escritura al spool es **atómica** (se escribe `.json.parcial` y se renombra); el verificador
  procesa todo `.json` que ve, así que escribir con el nombre final le deja leer un archivo a medio
  escribir y contestar «ilegible» a una derivación que estaba bien;
- agotar el plazo **lanza**: un «no válido» producido por un timeout se registraría como el resultado
  del alumno;
- un veredicto fuera de contrato o ilegible lanza en vez de rellenarse;
- un fallo del canal vuelve `502`, nunca un veredicto;
- el `submissionId` nombra un archivo del spool, así que su forma se restringe en vez de sanear la
  ruta después.

## 2. El editor es estructurado, y eso significa citas por identidad

`FitchDocument` guarda las citas como `lineId`, no como número. Los números 1-based existen sólo al
exportar, que es donde la norma los pide.

Con números guardados, cada inserción, borrado o reordenamiento obligaría a renumerar todas las
citas, y el día que fallara el alumno vería su derivación citando otra línea sin haber tocado esa
cita. Hay prueba de ello: insertar una premisa delante deja la cita apuntando donde debe.

Borrar una línea citada **deja la cita colgando y lo dice**; no se repara sola. Borrar la cita o
moverla a la línea vecina cambiaría la derivación del alumno sin que él lo pidiera, y el cambio
figuraría como suyo. `toProofInput()` devuelve `{ proof, dangling }`: quien exporte con `dangling`
no vacío está enviando una derivación incompleta y tiene que saberlo.

Otros puntos:

- **`EDITOR_MAX_DEPTH = 16` es distinto del `MAX_DEPTH = 64` de `logic-core`**, a propósito. Aquel es
  límite de implementación del verificador; este es de interfaz. Igualarlos haría que un cambio del
  verificador moviera en silencio lo que el alumno puede escribir.
- **El historial es de edición, no de intentos.** Deshacer y rehacer trabajan sobre el documento; los
  intentos enviados son actos con evidencia y viven en la bitácora. Confundirlos permitiría
  «deshacer» un intento ya registrado. La pila tiene tope: un historial ilimitado crece con la sesión.
- **La paleta ofrece símbolos canónicos y ningún alias.** El tokenizador acepta `->`, `&` o `~`, pero
  un botón «->» enseñaría una notación que la evidencia después no muestra.
- **Las subpruebas se marcan con sangría y además con texto** (`subprueba nivel 2`, `data-block-path`).
  UIUX §3 pide texto + señal: la sangría sola no se lee con lector de pantalla ni sobrevive a una
  captura en gris.
- **Cada línea emite `fitch-line:N`** como referencia semántica estable (P-I §8.9.2). El overlay de
  anotaciones llega en F10; si los targets nacieran entonces, el modelo señalaría posiciones y no
  elementos.

## 3. La vista se deriva del estado, y lo prohibido no se puede construir

`buildClaseViewModel()` deriva del `SessionStructuredState` todo lo que la pantalla muestra o
habilita. Una vista que decidiera por su cuenta sería una segunda política pedagógica, con otra
implementación, capaz de discrepar del motor justo en la sesión que después se analiza como
evidencia.

Cinco cosas **lanzan** en vez de degradarse:

| Código | Cuándo | Por qué no se degrada |
|---|---|---|
| `CAPACIDAD_NO_IMPLEMENTADA` | `voiceInput`/`whiteboard`/… en `true` | T-H7-07: F7 es texto+Fitch. Renderizar con la capacidad encendida y sin superficie diría que estuvo activa, y eso contamina la matriz de autonomía. Es donde F10 se enchufa |
| `MODO_MEDICION_INCOHERENTE` | `MEASUREMENT_MODE` con estrategia, ayuda o elegibilidad | El estado contradice al motor; renderizarlo lo daría por bueno |
| `FEEDBACK_EN_MEDICION` | Un acto de feedback en la transcripción durante la sonda | UI-CORR-02. Ocultarlo dejaría el acto registrado como entregado |
| `ENTREGA_GENERADA_EN_VIVO` | Un turno del Profesor IA sin procedencia de guion | F7 es sesión seca; sería contenido de procedencia desconocida en la transcripción que se audita |
| `RUBRICA_AUSENTE` | Actividad puntuable sin rúbrica | El linter del paquete exige `applicable_rubrics`; el panel vacío ocultaría un paquete incompleto |

### UI-CORR-02, punto por punto

`ProbeNotice` tiene exactamente los cuatro campos que la corrección enumera —pistas deshabilitadas,
feedback suprimido, agente sin autoridad sobre selección/tiempo/consumo, bancos futuros ocultos— y
los cuatro se renderizan. No es una lista de sugerencias.

### La consecuencia de pausar se dice

`T-H6-08` congela que la pausa **pre**-ítem no selecciona ni consume, y la **post**-ítem conserva el
consumo y deriva `invalid_participant_pause`. El modelo de vista deriva
`consequence: 'invalida_el_reactivo_de_sonda_en_curso'` cuando el reactivo ya se presentó, y la
pantalla lo dice. Callarlo dejaría al participante perder un reactivo sin haber podido saberlo.

### UI-CORR-04

`AppealControl.liveHumanPedagogicalIntervention` es `false` **en el tipo**, no en una comprobación.
La corrección prohíbe que apelar abra una vía para que un humano decida el avance en vivo, e I-9
prohíbe el endpoint de rescate docente. Si el campo pudiera valer `true`, la prohibición sería una
declaración de intenciones.

### Estado de guardado

Cuatro ramas —`guardado`, `guardando`, `cambios_sin_guardar`, `error`— y **ninguna dice «guardado»
sin estarlo**. Un indicador optimista convierte un fallo de guardado en trabajo perdido que el alumno
creía a salvo. Editar el documento pasa el estado a `cambios_sin_guardar`.

## 4. Sesión seca con paquete sintético

F7 admite «paquete congelado o paquete sintético de desarrollo equivalente», y hace falta: nadie ha
corrido W0 sobre fuentes reales, así que `content/` sigue en placeholders.

`dry-session.ts` monta la sesión con `session-engine` y un `ScriptedCatalog` con
`purpose: 'test_fixture'`. Las marcas de tiempo son fijas —sin reloj ni azar— para que la sesión sea
reproducible acto por acto, que es lo que el AC del gate H6 exige. La vista **declara en pantalla**
que el paquete es sintético (UIUX §2): un dato ilustrativo presentado como real acabaría citado como
evidencia.

## 5. Local-first: la fuente y el CSS vendorizado

Los tokens vendorizados abren con `@import url('https://fonts.googleapis.com/…Archivo…')`. En cuanto
`apps/web` los consumiera, la sesión dejaría de ser local (P-II §0.3).

El archivo vendorizado **no se edita**: está hasheado y su proveniencia lo prohíbe.
`scripts/web/generate-tokens-css.mjs` deriva `apps/web/src/app/tokens.generated.css` retirando el
`@import` remoto, y `pnpm run ci:web:tokens` comprueba que el derivado corresponde al vendorizado
vigente. La fuente Archivo se autoaloja como `@fontsource/archivo`, que entra por el lockfile, el
SBOM y el control de drift; un binario descargado a mano no tendría cómo auditarse.

Dos detalles que costaron una corrección cada uno:

1. **La URL lleva `;` dentro** (`wght@400;600;800`). Una expresión `@import[^;]*;` cortaba la
   sentencia a la mitad y dejaba `600;800&display=swap');` suelto en la hoja —CSS roto que además
   pasaba el control, porque al fragmento superviviente ya no le quedaba ningún `//`—. Se sustituyó
   por un escáner que respeta comillas y paréntesis.
2. **El bucle perdía texto.** Con un solo índice para copiar y buscar, saltarse un `@import` no
   remoto se llevaba por delante todo el CSS anterior. Copiar y buscar son dos posiciones distintas.

La derivación **falla en vez de limpiar** ante cualquier otra referencia remota o ante un `@import`
que nadie haya decidido qué hacer con él: adivinar cómo resolver una referencia que nadie declaró
sería inventar. Los comentarios se despojan antes de comprobar —son inertes— para que la cabecera
pueda citar textualmente lo retirado, que es la evidencia de qué se quitó.

## 6. Lo que esta tarea destapó fuera de sí misma

Tres hallazgos que no se buscaban y que están registrados como D-25, D-26 y en la tabla de
correcciones por autoridad superior de `PLAN_STATUS.md`.

1. **`exclude: '/dist/'` vaciaba reglas de arquitectura.** `exclude` no sólo deja de recorrer un
   módulo: lo borra del grafo, también como destino. Los paquetes del workspace resuelven por
   `exports` a `dist/`, así que toda dependencia **declarada** entre paquetes desaparecía, y con ella
   la regla que la vigilaba. Las reglas `web-sin-*` parecían verdes porque esos paquetes no estaban
   declarados en `apps/web`. Se descubrió al sembrar `apps/web → @profesor-ia/logic-core` con la
   dependencia ya declarada: la violación **no se detectaba**.
2. **El contrato del veredicto no validaba la salida real del verificador.** `VerificationResult` de
   `packages/contracts` tipaba `authorizedCalculusVersion` y `verifierVersion` como `VersionRef`
   —objetos—, y el Maestro los fija como cadena (P-I §1, `DEC-CALCULUS-001`), que es lo que emiten
   `logic-core` y `domain-engine`. Además declaraba `trace`, que nada emite, mientras el verificador
   produce `detail`: Zod lo descartaba en silencio y el alumno se quedaba sin la explicación del
   error. Y le faltaba `goalReached`, sin el cual un cliente sólo ve `valid: true` y lo lee como
   «resolvió el ejercicio» — justo la confusión que D-9 separa. Nada lo detectó porque **nadie había
   parseado nunca la salida del verificador contra el contrato que dice gobernarla**.
3. **La política de licencias no tenía dónde registrar una revisión.** El mensaje decía «requieren
   revisión registrada» y el único camino era ampliar la lista permitida, lo que autorizaría de paso
   cualquier dependencia futura con esa licencia. Ahora hay un registro por paquete y licencia
   exactos, que se imprime en cada corrida y **falla si conserva una excepción que ya no aplica**.

## 7. Lo que esta tarea no hace

- **No monta sesión ni escribe evidencia desde la API.** `apps/api` implementa el canal de veredicto
  y nada más; el bucle de sesión es `T-H7-01` (F8).
- **No hay voz, pizarrón, anotaciones ni captura.** Llegan en F10 (`T-H8-01…06`), y encenderlas hoy
  lanza.
- **No cerraba el gate H6** por sí sola. El AC —`ci:mode-separation` y `ci:e2e:dry-session`— se
  cubrió el 2026-08-18; `dry-session.ts` fue el punto de partida de la suite E2E, que vive en
  `session-engine` y `measurement-worker` (ver [`dry-session.md`](dry-session.md)).
