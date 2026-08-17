# CAL-06 / CAL-NLI — calibración de groundedness

`T-H5-17` implementa el arnés; **no ejecuta ni finge la calibración**. En este
repositorio no existe todavía un corpus W1/W2 material, una muestra dorada AIS,
una adjudicación del `EXPERIMENT_AUDITOR`, un binding NLI evaluado ni criterios
numéricos autorizados. Por eso no hay ningún estrato habilitado como gate.

La implementación está en
`packages/authoring-core/src/groundedness-calibration.ts`. La ruta de sesión
continúa fallando cerrado mediante `nliGate()` cuando no recibe un informe
material con el estrato exacto demostrado.

## Qué debe aportar una corrida real

Antes de observar scores o etiquetas se debe materializar una preinscripción
con:

- versión y SHA-256 de la preinscripción;
- binding exacto del modelo NLI y umbral de decisión;
- codebook AIS versionado;
- inventario de pares `claim↔fragmento`, con textos, IDs, hash del fragmento y
  SHA-256 reproducible del inventario;
- estratos declarados por idioma origen/destino, forma lógica, KC y tipo de
  claim;
- tamaños mínimos por estrato y límites máximos de falso positivo/falso
  negativo.

El arnés no ofrece valores predeterminados para esos criterios. Elegirlos forma
parte de CAL-06/CAL-NLI y debe ocurrir antes de mirar resultados.

Cada caso dorado debe ser un `source_assertion`, citar un fragmento identificado
cuyo texto reproduzca el hash de W1 y llevar un juicio externo con razón AIS,
versión de codebook, rol `EXPERIMENT_AUDITOR` y hash de evidencia. El criterio es
atribuibilidad: el claim debe poder verificarse desde ese fragmento sin
conocimiento externo. `system_inference` no entra al denominador.

## Salida y autoridad

El reporte conserva por estrato `TP`, `FP`, `TN`, `FN`, tasa de FP, tasa de FN,
precisión y recall, siempre como numerador/denominador y tasa. Un estrato sólo
queda `demonstrated` si la evidencia es material y satisface los criterios
preinscritos; muestra insuficiente, ausencia de una clase o exceso de error se
mantienen separados.

El agregado global es descriptivo y lleva literalmente
`authorizesGate: false`. No puede ocultar un estrato débil ni habilitar otro.
Los datos `test_fixture` siempre producen `fixture_only`, incluso con una matriz
perfecta, y `nliGate()` los rechaza.

Cuando exista evidencia material, un gate sólo podrá consultar el mismo binding
y la coincidencia exacta de idioma, forma lógica, KC y `source_assertion`.
Incluso entonces su salida conserva `isVerdict: false` y exige una decisión de
groundedness independiente: el NLI es un filtro estadístico auxiliar, no el
verificador formal ni la autoridad final.

## Estado actual comprobable

Ejecutar el analizador con una muestra vacía lanza `CAL-NLI` y explica que no se
fabrican pares ni juicios. No se añadió ningún artefacto al repositorio de
contenido ni una entrada congelada a `docs/params/registry.yaml`; hacerlo sin la
corrida real convertiría fixtures en evidencia.
