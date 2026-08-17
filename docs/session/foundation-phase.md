# `foundation_phase` — T-H6-12

`packages/experiment/src/foundation.ts`. Norma: P-I §5.2.1.

## Para qué existe

KC01, KC02 y KC08 son **fundamentos compartidos**. Sin esta fase, la línea base mediría
desconocimiento del formato Fitch en vez de los KC experimentales, y las tres transiciones A/B/C
medirían otra cosa que la que dicen medir.

## Lo literal

- Los tres fundamentos **no pueden ser KC objetivo** de A/B/C; sólo KC de soporte.
- La fase va **después de la familiarización puramente de interfaz** y se enseña en `LEARNING_MODE`
  con materiales **fuera de las reservas experimentales**.
- Sus resultados **no entran en la inferencia causal SCED** ni se mezclan con `probe_accuracy` de
  A/B/C. Por eso el informe lleva `metricNamespace: 'foundation_phase'` y
  `entersScedCausalInference: false` como campos, no como comentario.
- Sin el criterio de suficiencia, la corrida experimental **no inicia**: se registra
  `foundation_not_ready`.
- La enseñanza la realiza Profesor IA. **Un humano no puede completarla** para habilitar el piloto.

## `foundation_not_ready` no es un resultado negativo

§5.2.1 lo dice con todas sus letras: cuenta para autonomía/viabilidad y como límite descriptivo de
la preparación, **pero no como resultado negativo de una transición A/B/C**. Contarlo así
convertiría una preparación incompleta en evidencia contra la intervención, que es una conclusión
distinta y falsa. Van como dos campos separados: `countsForAutonomyAndViability` y
`countsAsNegativeAbcTransition`.

## El criterio de suficiencia no se cablea

§5.2.1 dice «criterio **preinscrito** de suficiencia» y no da la cifra. No se inventó: entra como
dato con procedencia —cuándo y bajo qué referencia se preinscribió— y con `purpose`. Una corrida
material exige un criterio `material`; un `test_fixture` prueba el mecanismo y **no** habilita el
inicio experimental, porque dejarlo pasar convertiría un umbral de prueba en la puerta del piloto.

Un criterio que exija más aciertos de los que permite intentar se rechaza: sería irrealizable por
construcción y declararía `foundation_not_ready` siempre.

## Las reservas experimentales se derivan, y `replacement` no está

`EXPERIMENTAL_RESERVES` es `MEASUREMENT_RESERVES`, que `authoring-core` ya deriva recorriendo el
contrato. No se escribió una segunda lista, que envejecería aparte.

**`replacement` está deliberadamente fuera.** D-21 registró que ninguna autoridad dice si el banco de
reposición es de enseñanza o de medición, y lo resolvió como dato. Añadirlo aquí a mano decidiría
por invención lo que esa decisión dejó expresamente abierto. En su lugar, un material de reposición
**debe declarar a qué reserva repone**, y cuenta por esa: una reposición de `probes_baseline` queda
excluida de fundamentos, y una de práctica no.

## Lo que no se afirma

No hay criterio material preinscrito, ni corrida, ni participante. El módulo decide con qué datos se
evalúa la suficiencia; quién los aporta llega con la sesión seca y con el paquete congelado.
