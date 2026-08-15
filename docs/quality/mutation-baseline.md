# Baseline de mutation testing — `logic-core`

`ci:logic:mutation` (Plan.md T-H2-12 [CRITICAL] ← P-II §4.6).

> Antes del gate H2, **todo mutante superviviente relevante** debe eliminarse por prueba o
> justificarse como equivalente/inaplicable. `thresholds.break` es no-regresión del baseline
> congelado, no una meta arbitraria.

## Alcance

Se mutan las rutas críticas de verificación: `ast`, `errors`, `fitch`, `parser`, `rules`,
`semantics`, `tokenizer`, `verify`.

Exclusiones **con justificación**, declaradas en `stryker.conf.json`:

| Excluido | Por qué |
|---|---|
| `index.ts` | Solo reexporta. Un mutante no puede cambiar comportamiento. |
| `calculus.ts` | Datos literales del artefacto congelado. Su integridad la protege el hash del YAML (`calculus.test.ts`), no una prueba de comportamiento: mutar una constante y no detectarlo significaría que el hash no se comprueba, cosa que sí se prueba aparte. |
| `construction.ts` | Genera derivaciones candidatas; no participa en ningún veredicto. Un mutante que cambie *qué* derivación válida se construye es equivalente frente a la propiedad que la gobierna («toda derivación construida con reglas autorizadas es aceptada»), que seguiría pasando por diseño. |

## Cómo se lee el reporte (o cómo no leerlo)

Un mismo renglón del fuente produce **varios mutantes distintos**, y el reporte imprime el texto de
reemplazo, no el nodo mutado. En `parser.ts:61`, `if (!close || close.kind !== 'rparen')` genera dos
mutantes que se imprimen igual, `→ false`:

- uno sustituye **la condición entera** — muere con la prueba de corchetes desbalanceados;
- otro sustituye **solo `close.kind !== 'rparen'`** — sobrevive, porque en los casos alcanzables
  `close` o es `undefined` (y `!close` ya decide) o es un `)` de verdad.

Leerlos como el mismo mutante lleva a conclusiones falsas en las dos direcciones: a dar por cubierto
lo que no lo está, y a culpar a la herramienta de un falso superviviente que no lo era. El script de
análisis debe recortar el nodo por su `location`, no imprimir el reemplazo.

## Historial

| Fecha | Score total | Matados | Supervivientes | Sin cobertura | Nota |
|---|---|---|---|---|---|
| 2026-08-14 (1ª corrida) | 62.79 % | 833 | 328 | 177 | Baseline inicial, antes de cubrir ramas de reglas y semántica |
| 2026-08-14 (2ª corrida) | 78.22 % | 896 | 186 | 68 | Tras `rules.test.ts` y `semantics.test.ts`. `semantics` 43→97 %, `rules` 53→84 % con **cero** sin cobertura |
| 2026-08-14 (3ª corrida) | 81.99 % | 935 | 175 | 35 | Tras `structure.test.ts`. `errors` 0→100 %, `fitch` 73→88 % con cero sin cobertura, `verify` 63→70 % |
| 2026-08-15 (4ª corrida) | 87.56 % | 1001 | 134 | 11 | Tras el lote de citas, `printProof`, `ast.test.ts` y orientaciones parciales de reglas |
| 2026-08-15 (5ª corrida) | 88.67 % | 1004 | 120 | 11 | Tras simplificar `mainOperator` (código muerto) y las orientaciones de `↔I`/`→E`/`↔E` |
| 2026-08-15 (6ª corrida) | **90.31 %** | 1024 | 112 | **0** | Tras cubrir el oráculo semántico como segunda capa y la cota `CALC-05` |

### Por archivo, 6ª corrida

| Archivo | Score | Vivos | Sin cobertura |
|---|---|---|---|
| `ast.ts` | **100 %** | 0 | 0 |
| `errors.ts` | **100 %** | 0 | 0 |
| `semantics.ts` | 97.18 % | 2 | 0 |
| `tokenizer.ts` | 93.59 % | 10 | 0 |
| `rules.ts` | 89.42 % | 33 | 0 |
| `verify.ts` | 88.96 % | 33 | 0 |
| `fitch.ts` | 87.97 % | 16 | 0 |
| `parser.ts` | 78.57 % | 18 | 0 |

**Ningún mutante queda sin cobertura** (eran 177 en la primera corrida). Los 112 vivos son prosa de
mensajes y equivalentes por contrato, clasificados abajo.

## Categorías de superviviente

1. **Huecos reales de prueba** — ramas nunca ejercitadas o decisiones que ninguna aserción
   distingue. Se eliminan escribiendo la prueba que falta.
2. **Prosa de mensajes** — mutantes `StringLiteral` sobre el campo `detail` de los errores. Matarlos
   exigiría afirmar el texto exacto de cada mensaje en castellano, lo que congela la redacción sin
   proteger ninguna decisión: el **código** `E-*` es lo que gobierna, y ese sí se afirma.
3. **Equivalentes estructurales** — el mutante cambia el camino pero no lo observable.

### La forma dominante de la categoría 3 en este núcleo

La lista de códigos `E-*` es **cerrada**, y el contrato del verificador expone el código, no el
mensaje. Eso hace que muchos mutantes sean equivalentes *por contrato*: cambian qué rama rechaza,
pero ambas rechazan con el mismo código. Ejemplos verificados a mano:

- `tokenizer.ts:108` — sin la comprobación de fórmula vacía, la lista de tokens queda vacía y el
  parser lanza `E-SYN-PARSE` («fórmula incompleta») en vez de `E-SYN-PARSE` («fórmula vacía»).
- `parser.ts:66/68/108` — quitar el `case 'rparen'` o el `default` desvía el rechazo a otra rama que
  también lanza `E-SYN-PARSE`.
- `semantics.ts:69` — invertir `(mask & (1 << i)) !== 0` enumera el **mismo conjunto** de
  valuaciones en otro orden: la biyección no cambia si existe contramodelo.
- `semantics.ts:66` — `mask <= total` añade una fila que repite la valuación todo-falso.
- `verify.ts:62` — quitar `.trim()` del `rule_id` es invisible porque `canonicalRuleId` vuelve a
  recortar. Dos recortes seguidos: el segundo hace equivalente al primero.

No se «arreglan» inventando un código nuevo para distinguirlos: la whitelist de códigos es
normativa (P-II §4.6) y ampliarla para subir un porcentaje sería mover la norma para complacer a la
herramienta.

### Código muerto eliminado en vez de justificado

`ast.ts:37` — `mainOperator` era
`f.kind === 'atom' ? 'atom' : f.kind === 'falsum' ? 'falsum' : f.kind`, que devuelve exactamente
`f.kind` en los tres casos. Cuatro mutantes imposibles de matar porque las ramas no se distinguen
entre sí. Se sustituyó por `f.kind`. La regla es esa: donde la rama sea inalcanzable **o
indistinguible**, se borra el código; solo se justifica lo que tiene razón de existir.

### Lo que parecía inalcanzable y no lo era

El oráculo semántico paso a paso (`verify.ts:129-143`) figuraba como «rama defensiva inalcanzable»:
si toda regla autorizada es sana, un paso bien aplicado no puede tener contramodelo. El argumento es
falso, y encontrarlo cambió una justificación por una prueba.

Cuando una línea queda **rechazada** y otra posterior la cita, la regla posterior puede aplicarse de
forma impecable sobre una premisa que el cálculo nunca autorizó:

```
1. A            PR
2. B            ∧E 1     ← rechazada: A no es una conjunción
3. B∧B          ∧I 2,2   ← ∧I impecable… sobre una línea que no debió existir
```

`B∧B` no se sigue de `A`, y el oráculo lo dice. Ahí es donde la segunda capa gana su sitio: no
protege contra reglas mal implementadas —para eso está el conjunto dorado— sino contra la
**propagación** de un paso ya rechazado. Está cubierto por `verify.test.ts`.

## Regla de operación

- Un superviviente de la categoría 1 **bloquea** el gate hasta escribir la prueba.
- Un superviviente de las categorías 2 o 3 requiere una línea de justificación aquí, y la
  justificación tiene que ser **comprobable**: si dice «inalcanzable», hay que intentar alcanzarlo
  antes de escribirla.
- El score no se persigue como número: se persigue que ningún mutante que cambie una decisión del
  verificador sobreviva.
