# Modo guion y modo degradado — T-H6-14

`packages/session-engine/src/script-mode.ts`. Norma: P-I §15.3.

## Por qué son dos modos y no uno

Los dos entregan **sólo contenido congelado** y ninguno llama al proveedor. Se distinguen porque su
causa es distinta y la evidencia no puede confundirlas:

- **`script`** es la sesión seca planificada: no hay generación en vivo **por diseño**.
- **`degraded`** es la caída del modelo a mitad de una sesión que sí iba a usarlo.

Registrar una caída como guion borraría el fallo. Registrar una sesión seca como degradado
inventaría una caída que no ocurrió. Por eso `DegradedEntry` exige `providerFailureRef` y el modo
guion no lo tiene.

## No rellena huecos

`deliver()` busca la clave exacta `kind + kcId + selectorKey`. Si no está, **falla**. Devolver «lo más
parecido» convertiría el modo degradado en una generación silenciosa, que es justo lo que §15.3
prohíbe cuando dice que el sistema «puede continuar únicamente con explicaciones y pistas previamente
congeladas».

`assertNoLiveGeneration()` se llama en el punto donde el bucle en vivo llamaría al proveedor y
**siempre lanza** fuera de `live`. El controlador no expone `generate`, `complete`, `send` ni
`fallbackText`, y hay prueba de que no existen.

## La solución no cabe en el tipo

`ScriptedContent` **no tiene campo** para la solución, igual que `W3ItemRecord`: si no cabe en el
tipo, serializar el catálogo entero no puede sacarla. `assertNoFrozenSolution()` recorre además el
objeto que llega —no la intención— y un catálogo que traiga un campo de solución **se rechaza, no se
limpia**.

## La desviación del bloque, y su asimetría

§15.3: «si el modo degradado altera sustantivamente la condición, el bloque se marca como
desviación». **Qué es «sustantivo» no lo fija ninguna autoridad**, así que se declara con su
justificación en vez de derivarse de un umbral inventado.

Pero la declaración no es libre en las dos direcciones:

| Actos sin cubrir | Declara alteración | Resultado |
|---|---|---|
| ninguno | no | Se admite |
| ninguno | sí | Se admite |
| alguno | sí | Se admite, con los actos registrados |
| alguno | **no** | **Se rechaza** (`SCRIPT_DEVIATION_UNDERSTATED`) |

Si el guion no pudo entregar lo que el bloque pedía, la condición cambió por definición. Aceptar ahí
un «no sustantivo» dejaría la desviación fuera del registro **justo en el caso en que más importa**.
Declarar desviación de más siempre se admite; declararla de menos no.

## Lo que no se afirma

El catálogo de esta suite es `test_fixture`. No hay contenido congelado material: depende del freeze
de F6, que sigue sin corpus. El módulo decide cómo se entrega y qué se rechaza, no qué se enseña.
