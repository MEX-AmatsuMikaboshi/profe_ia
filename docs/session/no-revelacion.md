# No revelación y suite adversarial — T-H7-03 (P-I §9.6, §9.4; P-II §14.4)

Segunda tarea de F8, y como `T-H7-02` **no necesita proveedor**.

## El agujero real que esta tarea cerró

`buildSessionContext` aplicaba el filtro de egreso de P-I §9.4, pero el **detector de canarios era un
parámetro opcional**: si nadie lo pasaba, la comprobación no corría y nada lo decía. «Sin solución en
contexto» quedaba entonces sin comprobar justo donde §9.6 lo exige.

Un filtro que puede faltar en silencio no es un filtro. Ahora `SessionContextInput` lleva
`scorableActivityOpen`, y con una actividad puntuable abierta la ausencia del detector lanza
`MissingEgressFilterError`. Fuera de una actividad puntuable sigue siendo opcional, que es lo que era.

**Y hay una segunda vuelta que importa más que la primera.** Al añadir el campo obligatorio, las
1639 pruebas **siguieron pasando**: los archivos de prueba de este repositorio no se typechequean
(`tsc` incluye sólo `src/**`), así que los llamadores omitían el campo, llegaba `undefined`, y
`undefined` es falsy — la garantía se apagaba sola exactamente como el comentario advertía que no
debía. Se añadió una comprobación **en ejecución**: un `scorableActivityOpen` que no sea booleano
lanza. Entonces sí cayeron 11 pruebas, que era la señal de que el cambio hacía algo.

Deuda conocida confirmada: **un tipo no protege un llamador que nadie compila.**

## La puerta de no revelación

`packages/pedagogy-policy/src/non-revelation.ts`. P-I §9.6 es literal y son cuatro condiciones; hay
una causa de bloqueo por cada una, más una quinta para el comprobante del filtro de egreso.

**La puerta no recalcula nada: se niega a entregar lo que no tiene respaldo.** Las dos condiciones
que parecerían exigir análisis —isomorfismo y «paso decisivo»— **ya están decididas aguas arriba y
con evidencia**: el banco de pistas guarda `facts.containsDecisiveContent` y
`analogousExampleEvidence.nonIsomorphic`, validados en autoría y amarrados a un hash de contenido.

Volver a decidirlos aquí, en vivo y con otra implementación, crearía una segunda autoridad sobre el
mismo hecho — y cuando dos autoridades discrepan gana la que corre más tarde, que es la peor forma de
elegir. Así que el trabajo de la puerta es el contrario: **exigir la evidencia**. Una pista de nivel 4
sin prueba de no isomorfismo no sale, no porque se haya demostrado que es isomorfa, sino porque nadie
demostró que no lo es. En una actividad puntuable la carga de la prueba va de ese lado.

**La cuarta condición está acotada en su letra.** «Sin retroalimentación hasta cerrar el intento
**cuando sea una sonda**»: no se extiende a toda actividad puntuable, porque extenderla sería legislar
de más sobre un texto que distingue los dos casos a propósito. Hay prueba de esa frontera.

**Fuera de una actividad puntuable, §9.6 no gobierna y la puerta no bloquea.** Con control positivo:
sin él, escribir la puerta de más —aplicarla siempre— dejaría el árbol verde diciendo lo que no dice.

## `ci:adversarial:session`

Dos archivos y dos paquetes, como `ci:e2e:dry-session`: el filtro de egreso y el validador de anclaje
en `model-gateway`, la puerta de §9.6 en `pedagogy-policy`. Un archivo único tendría que abrir una
dependencia que la arquitectura no necesita. **27 pruebas.**

De la lista de P-II §14.4 se atacan los de **sesión**: prompt injection del alumno, solicitud directa
de solución, intento de cambiar reglas, extracción de sondas, corpus con instrucciones privilegiadas y
ambigüedad de notación.

**La defensa contra la injection del alumno es estructural, no un filtro:** la whitelist de P-II §8.3
**no tiene ningún campo por el que entre texto libre del alumno**. No hay que filtrar lo que no tiene
por dónde entrar. La suite lo comprueba sobre la lista literal y sobre el contexto construido.

Los demás puntos de §14.4 **no se duplican** y se dice dónde están: caída de proveedor y
retraso/reintento en `degraded`/`transport`, parámetros no soportados en `ci:gateway:fail-closed`,
doble envío y manipulación de tiempo en `ci:e2e:dry-session` —la monotonía de `consumedActivityIds`
de D-35 *es* la defensa del doble envío—, drift en `ci:supply:drift`, tamper del ledger en la suite de
evidencia. Duplicarlos aquí daría sensación de cobertura sin añadir ninguna.

## Lo que este trabajo **no** afirma

- **No detecta paráfrasis.** El banco de pistas ya lo declara —`detectionScope:
  'literal_not_paraphrase'`, `paraphraseAuditRequired: true`— y la puerta hereda ese alcance: exige la
  evidencia, no la mejora. Una pista que reformule la solución con otras palabras y traiga sus
  banderas en falso pasa. Por eso la auditoría de paráfrasis sigue siendo humana y obligatoria.
- **La exención por anclaje de `T-H7-02` confía en el corpus congelado**, y en el fragmento *concreto*
  que el segmento ancla. Queda una prueba que lo deja escrito: un fragmento del mismo bloque que
  nombre una regla prohibida **no** exime a un segmento que no ancló a él.
- **La ambigüedad de notación no la resuelve esta puerta.** `A∧B∧C` lo rechaza el verificador con
  `E-SYN-PRECEDENCE`, que es su trabajo. Hay una prueba que lo deja escrito para que nadie lo espere
  aquí.
- **Ninguna sesión real ha cruzado estos mecanismos**: no hay binding ganador. Lo probado es el
  mecanismo, con dos siembras que comprueban que puede fallar.
