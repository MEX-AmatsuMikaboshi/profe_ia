# Validador de anclaje — T-H7-02 (I-7, P-II §8.4, P-I §8.5)

Primera tarea de F8. Construye el mecanismo que P-II §8.4 exige: el validador local que cruza toda
salida del modelo antes de que llegue al alumno.

**No necesita proveedor.** Es lo que hace que esta tarea se pueda hacer hoy: el validador recibe una
salida candidata y unos fragmentos autorizados, y decide. Que la salida venga de un modelo o de una
prueba es indiferente — y esa indiferencia es justamente lo que se quiere, porque un validador que
dependiera del proveedor no sería independiente de él.

## La regla que ordena todo lo demás

I-7: «sin ancla no introduce reglas». De ahí sale el criterio con el que el validador decide **sin
interpretar prosa**:

> Un símbolo o un identificador de regla ajenos al cálculo se rechazan **salvo que aparezcan en
> alguno de los fragmentos a los que el segmento ancla**. Si el corpus lo dice, el modelo lo está
> **citando**; si el corpus no lo dice, lo está **introduciendo**.

Esto se descubrió intentando refutar el diseño anterior. El primer detector marcaba cualquier mención
de una regla prohibida, y con él **el Profesor IA no habría podido decir «la conmutativa no está
permitida en este cálculo»** — que es contenido correcto, necesario y que el corpus enseña. Un
validador que amordaza la enseñanza correcta no protege nada: lo desactivan.

Y resuelve el problema de fondo: distinguir «mencionar» de «ordenar» sobre texto libre es lo que
ningún validador local puede decidir. **La distingue el ancla**, que sí es decidible.

El respaldo se toma **sólo de las anclas que resolvieron**, no del bloque entero. Con el bloque
entero, un segmento se apoyaría en un fragmento al que no ancló, que es exactamente lo que I-7
impide. Hay siembra que lo comprueba: cambiarlo a «todo el bloque» pone dos pruebas en rojo.

## Tres cosas que el cálculo congelado desmintió

Salieron de leer `packages/logic-core/src/calculus.ts` antes de escribir, no después:

1. **`->`, `&`, `|`, `~`, `!` son alias autorizados** (`CONNECTIVE_ALIASES`): el cálculo los
   canonicaliza **antes** de verificar. El primer diseño los rechazaba como notación ajena. Habría
   sido un falso positivo en la ruta más común.
2. **`y`, `o`, `no` están en `REJECTED_CONNECTIVE_ALIASES`** — pero son palabras españolas
   corrientes. Están rechazadas *como alias de conectivo dentro de una fórmula*, no como prosa.
   Marcarlas habría rechazado casi cualquier frase.
3. **`FORBIDDEN_NORMALIZATIONS` y `FORBIDDEN_RULES_EXAMPLES` son listas congeladas**, así que un
   detector sobre ellas es transcripción y no invención.

## Cómo se detecta cada causa

Las cinco causas de P-II §8.4 son **cerradas** y no se añade ninguna. Cada rechazo declara en
`authority` la autoridad literal de la que sale, como en `doubt.ts`.

| Causa | Cómo se decide |
|---|---|
| `fuera_de_esquema` | `AnchoredOutput.safeParse`. Va primero y **corta**: validar semántica sobre una forma desconocida es adivinar |
| `anchor_inexistente` | El anchor no resuelve a un fragmento **del bloque**. Un fragmento de otro bloque no ancla aquí, por lo mismo que el filtro de egreso no lo deja entrar (P-I §9.4) |
| `simbolo_no_autorizado` | Caracteres en los rangos Unicode de notación lógica/matemática que no están en el cálculo ni en sus alias, y que no aparecen en el respaldo anclado |
| `instruccion_contradice_calculo` | Identificador de regla prohibida citado como palabra suelta y ausente del respaldo anclado |
| `solucion_o_canario` | Detector de canarios sobre la salida serializada (`salida_del_modelo` es una superficie que §11.3 ya declaraba) |

**Se recogen todas las causas, no la primera.** Devolver una sola hace creer que arreglarla basta.

**Un canario aborta con `CanaryHitError`**, igual que en `buildSessionContext`, en vez de devolverse
como veredicto. Un canario en la salida significa que una solución llegó hasta aquí: es un incidente
de nivel 3 (P-II §11.3), no una validación fallida, y degradarlo a causa de rechazo lo haría
indistinguible de un `anchor` mal escrito.

## Salida no anclada: P-I §8.5 **limita**, no rechaza

«No anclada» no está entre las cinco causas de rechazo, y no es un descuido: §8.5 dice que una salida
no anclada *puede presentarse como lenguaje de acompañamiento no factual*. Así que:

- sin anclas → `non_factual_accompaniment`, registrado para auditoría (§8.5, cuarto punto);
- sin anclas **y con función `definition`** → `withheld`. Es el único caso que no se puede presentar
  de ninguna forma: presentarlo **sería** introducir una definición sin ancla, que §8.5 prohíbe con
  todas sus letras;
- basta **un** segmento sin anclas para que `canGroundEvaluation` sea `false`. La alternativa
  —decidir por segmento cuál sostuvo la calificación— exigiría saber qué leyó el alumno. Ante la
  duda, falla hacia el lado que no califica.

## Por qué el cálculo entra por parámetro

`model-gateway` no depende de `logic-core` y **no debe**: importarlo acercaría `verify()` al único
paquete que abre conexiones a proveedores, y la pasarela podría acabar dictaminando sobre una
derivación sin pasar por el contenedor aislado (I-3, D-12).

El conjunto congelado entra por `AuthorizedCalculus`, igual que el detector de canarios entra por
parámetro en `buildSessionContext`. La frontera es ejecutable: regla depcruise
**`pasarela-sin-nucleo-logico`**, con su violación sembrada comprobada.

`logic-core` entra **sólo como `devDependency`**, para la prueba de correspondencia: que todo símbolo
canónico y todo alias declarados son tokenizables por el cálculo, que todo símbolo que el validador
rechaza lo rechaza también el tokenizador con `E-SYN-SYMBOL`, y que ninguna regla prohibida declarada
está en la whitelist. Sin esa prueba, `canonicalSymbols` se quedaría vieja y el validador empezaría a
rechazar notación legítima sin que nada se enterara.

**Ojo:** `depcruise` excluye los `*.test.ts`, así que esa dependencia de prueba no la ve la regla. Es
deliberado, pero conviene saberlo: la regla protege `src/`, no el árbol entero.

## Lo que este validador **no** decide, y no finge decidir

La whitelist de reglas del cálculo es cerrada —«cualquier regla no listada falla cerrado»—, pero eso
se hace cumplir donde las reglas se **aplican**: en `logic-core`, sobre una derivación. Aquí se
detecta la lista ilustrativa de reglas prohibidas que el cálculo congela, exenta por anclaje.
Afirmar que este validador reconoce cualquier regla inventada en lenguaje natural sería éxito
simulado.

## Lo que queda de F8

- `T-H7-01` — el bucle W7 con el binding ganador. **Bloqueada**: exige el ganador de BENCH-01.
- `T-H7-03` — no revelación en actividad puntuable y suite adversarial (`ci:adversarial:session`).
  Se puede construir sin proveedor; es lo siguiente.
- `T-H7-04`…`T-H7-06` — ejecución lingüística, adaptación y modo degradado en vivo, todas dentro del
  bucle de `T-H7-01`.

Nadie ha ejecutado este validador contra una salida de modelo real: no hay binding ganador. Lo que
está probado es el mecanismo, con 21 pruebas y dos siembras que comprueban que puede fallar.
