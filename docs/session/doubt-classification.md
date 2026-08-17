# Clasificación de dudas — T-H6-10

`packages/pedagogy-policy/src/doubt.ts` y la proyección
`updateSessionFromDoubtClassification()` de `session-engine`.

## De dónde sale cada cosa

La regla que gobierna la tarea son seis palabras de P-II §7.5: **«El modelo puede proponer la
categoría; el motor aplica la política.»** El enum de seis miembros también es literal de esa
sección.

Los efectos **no** están tabulados en §7.5. No se inventaron: se derivan de autoridades literales
que ya estaban escritas, y cada efecto declara de cuál sale en su campo `authority`.

| Alcance | Efecto | Autoridad literal |
|---|---|---|
| `unsafe_or_disallowed` | Ni contenido factual ni acompañamiento | P-I §8.3.1 nivel 1; §9.6 |
| `blocking_prerequisite` | Encamina a recuperación de prerrequisito, no a una respuesta | P-I §8.3.1 nivel 2; §8.3.2 «fallo de prerrequisito» |
| `outside_corpus` | Sólo acompañamiento no factual | P-I §8.5 |
| `later_in_unit` | Sólo acompañamiento; queda diferida | P-I §9.4; §8.2 |
| `insufficient_anchor` | Sólo acompañamiento; queda diferida | P-I §8.5 |
| `current_block` | Respuesta factual anclada al bloque | P-I §8.4, §8.5, §9.4 |

Las cinco declaraciones de `DOUBT_DECLARATIONS` son **transcripción literal de P-I §8.4**: «El
agente debe declarar cuando una pregunta: corresponde al bloque; requiere un prerrequisito;
pertenece a otro momento de la unidad; queda fuera del corpus; no puede responderse con suficiente
anclaje.» El sexto miembro del enum, `unsafe_or_disallowed`, no aparece en esa lista porque su
efecto lo fija el nivel 1 de la jerarquía.

**`later_in_unit` no se responde**, y eso tampoco es una invención: P-I §9.4 hace que el filtro de
egreso compruebe la **«pertenencia del fragmento al bloque»** antes de enviar nada al modelo. Un
fragmento de un bloque posterior no puede entrar al contexto, así que no hay con qué anclar una
respuesta factual.

## El orden de evaluación es el requisito

```text
unsafe_or_disallowed → blocking_prerequisite → outside_corpus
                     → later_in_unit → insufficient_anchor → current_block
```

Los dos primeros salen de la jerarquía de P-I §8.3.1, que pone seguridad y prerrequisitos por
encima de todo lo demás.

El tramo que importa es **`later_in_unit` antes que `insufficient_anchor`**. Si el anclaje se
mirara primero, una pregunta que sólo pertenece a un bloque posterior se declararía
`insufficient_anchor`, y el alumno oiría que el corpus no puede sostener la respuesta cuando lo
cierto es que se enseña más adelante. Es el mismo defecto que reportar un truncamiento como
violación de esquema. Hay prueba dedicada, y una mutación sembrada que invierte las dos ramas queda
detectada por esa prueba y sólo por esa.

## La propuesta del modelo no entra en la derivación

`deriveScope()` no recibe la propuesta en ninguna rama: se deriva de hechos que el motor ya posee
—cribado de seguridad, prerrequisitos abiertos del grafo, fragmentos resueltos, pertenencia al
bloque, suficiencia del anclaje—. La propuesta se registra aparte y se marca acuerdo o desacuerdo.

**No hay campo para el texto de la pregunta.** Si el texto entrara, clasificar exigiría
interpretarlo y la decisión volvería al modelo por la puerta de atrás.

Sin propuesta, `modelProposalAgreed` vale `null`, **no `true`**: un `true` ahí sería acuerdo por
vacío, el mismo defecto que `DUP-01` evita en el aislamiento de transferencia.

## Modo de medición

En `MEASUREMENT_MODE` **no se clasifica**. `classifyDoubt()` devuelve una supresión explícita, no un
alcance. Devolver `unsafe_or_disallowed` habría sido más cómodo y diría algo falso: la pregunta no
es insegura ni está prohibida, simplemente no es el momento de responderla. La supresión conserva lo
literal de P-I §7.1.1, ya implementado en T-H6-08: sin respuesta pedagógica, con información de
derechos y procedimiento disponible, y **sin ampliar el reloj**.

## No revelación

Una actividad puntuable abierta retira la respuesta factual que `current_block` autorizaría (§9.6)
**sin cambiar el alcance declarado**, y lo marca en `withheldByNonRevelation`. La traza distingue
así «no correspondía responder» de «correspondía, y la no revelación lo impidió». Cuando el alcance
ya no autorizaba responder, la bandera queda en `false` en vez de atribuirle a la no revelación un
efecto que no tuvo.

## Clasificar no es resolver

`updateSessionFromDoubtClassification()` deja **toda** duda clasificada en `pendingDoubts`, incluida
una `current_block`: clasificar no la responde, y la resolución es un acto posterior.
`deferredToLaterOpportunity` dice si la duda podrá atenderse en este bloque, que es otra cosa;
filtrar por él dejaría fuera del estado dudas realmente abiertas.

La proyección **no cambia ruta, estrategia, ayuda ni elegibilidad**. La jerarquía de §8.3.1 es del
motor pedagógico: un `blocking_prerequisite` lo encamina esa política, no esta proyección. El modo
de la clasificación debe coincidir con el de la sesión, y una duda ya registrada no se registra dos
veces.

## Lo que no se afirma

`scope` queda **ausente** en las dudas levantadas en `MEASUREMENT_MODE`, porque ahí no hubo
clasificación. No es un hueco que rellenar más adelante con el valor plausible: es el registro de
que no se clasificó.
