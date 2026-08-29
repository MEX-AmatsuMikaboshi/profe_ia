# La demo del Profesor IA — cómo se levanta y qué enseña

Documento operativo de `T-H7-01`. Lo que hay que teclear, qué se ve, y qué garantía enseña cada
paso. La versión presentable de este mismo guion está publicada como artefacto.

## Levantarla

```bash
pnpm run demo
```

Arranca **tres procesos** —`apps/verifier`, `apps/api` y `apps/web`— sin Docker y sin base de
datos, y escribe la URL. Espera a ver `turn_runtime_ready` con `blocks: 18`: es el corpus real
cargado desde el submódulo.

```
http://localhost:3010/materias/logica/clase
```

**Esto no sustituye a `pnpm run dev:up`**, que levanta el stack real con Postgres, Infisical y el
colector. La diferencia importa y el script la declara: aquí **no se escribe evidencia**, porque no
hay base donde escribirla. Decirlo es preferible a que alguien suponga que la cadena de eventos
quedó registrada.

Sin `MODEL_CREDENTIAL_ANTHROPIC_SESION` en `infra/compose/.env` la api arranca igual y
`/clase/turno` responde **503 diciendo por qué**. El resto de la vista sigue funcionando: un
profesor ausente se ve como ausente, no como un profesor mudo.

## Los cuatro actos

### 1 · Cada afirmación lleva su fuente

> ¿Cómo uso la eliminación de la conjunción?

Salen tres o cuatro segmentos, cada uno con su etiqueta —`anclado al material`— y el **mango** del
fragmento (`F-` + ocho dígitos hex, D-77). El mango es proyección de presentación del `fragmentId`
canónico, que tiene ~107 caracteres; BENCH-01 midió que su longitud era la causa del fallo de
anclas, y el defecto era nuestro.

### 2 · El profesor prefiere callar a inventar

> Explícame la regla de eliminación del condicional.

El bloque abierto es `KC04`, que trae `∧E` y `∧I`. El condicional vive en `KC06`, así que el
profesor **lo declara** en vez de responder de memoria, y el segmento sale como
`acompañamiento, sin anclar`. Es I-7 —«sin ancla no introduce reglas»— visible en pantalla.

El panel remata con **«no puede fundamentar una calificación»** (P-I §8.5): basta un segmento sin
anclar para que la salida entera deje de sostener una nota.

### 3 · El veredicto no lo da el modelo

En el editor Fitch, una derivación mal:

```
1  A∧B    PR
2  A      ∨E 1
```

Vuelve `E-RULE-ARITY` en la línea 2. Lo emitió `apps/verifier`, que corre con `network_mode: none`
y al que se le habla por un spool en disco (I-3, D-12). Función pura: sin red, sin `process.env`,
sin reloj ni azar.

### 4 · Reacciona al error, sin resolverlo

> Me equivoqué. ¿Qué hice mal?

El panel muestra que el profesor **sabe** que el intento falló con `E-RULE-ARITY` en la línea 2, y
responde explicando la regla anclada al material **y pidiendo la línea concreta en vez de resolver
el ejercicio**.

Dos cosas a la vez: el profesor no leyó la derivación por su cuenta —recibió el código que el
verificador emitió— y aun sabiendo cuál es el error, no da la respuesta. Lo segundo no es prudencia
del modelo: es la puerta de P-I §9.6, comprobada **antes** de llamarlo.

## Qué hacer si algo falla en vivo

| Síntoma | Qué es | Qué hacer |
|---|---|---|
| Tarda 5–15 s | Una llamada real a un proveedor | Esperar; el botón dice «Preguntando…». No pulsarlo dos veces |
| `RECHAZADO_POR_ANCLAJE` | El modelo citó un fragmento inexistente y el validador lo tiró | **Decirlo**: es la garantía del acto 2 disparando. Volver a preguntar |
| `TURNO_NO_DISPONIBLE` | Falta la credencial | Hacer el acto 3 y saltar el 4; el verificador no depende del proveedor |
| No responde nada | Uno de los tres procesos cayó | Mirar la consola de `pnpm run demo`: los tres escriben con su prefijo |

**El rechazo de anclaje no se esconde.** Un turno bloqueado y un turno entregado son observables
distintos, y la vista los separa a propósito: `bloqueado` dice «una garantía actuando» y
`canal_fallido` dice «avería». Colapsarlos haría leer una garantía cumplida como un error.

Hay **un reintento** ante rechazo de anclaje, y se cuenta: BENCH-01 midió 84.2 % de anclas
resolubles en `claude-sonnet-5`, así que un fallo aislado es esperable. Si el segundo intento
también falla, el turno se rechaza igual —rebajar el listón convertiría la garantía en una
sugerencia— y `attempts` viaja en la respuesta y en la vista.

## Un turno suelto, sin navegador

```bash
pnpm run demo:turno KC01 "No entiendo que es una deduccion natural"
```

Ejecuta un turno contra el proveedor real e imprime los segmentos con sus anclas. Es el control
positivo de que **un modelo de verdad responde en el formato que el validador acepta** — una
afirmación distinta de «el orquestador encadena bien», que es lo que prueban los tests con puerto
inyectado.

## Lo que la demo NO enseña, y conviene no insinuar

- **No escribe evidencia.** `EVIDENCE_EVENT_INSERT_SQL` sigue sin llamador en ejecución.
- **No elige bloque.** El bloque llega en la petición y la vista lo trae fijo (hueco 4 de W7).
- **El paquete de contenido no está congelado.** W5 no ha corrido, `frozen: false`, y tanto la
  respuesta como la pantalla lo declaran (UIUX §2).
- **No hay sesión persistida ni participante.** Es una vista de desarrollo sobre corpus real.
