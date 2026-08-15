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

## Historial

| Fecha | Score total | Matados | Supervivientes | Sin cobertura | Nota |
|---|---|---|---|---|---|
| 2026-08-14 (1ª corrida) | 62.79 % | 833 | 328 | 177 | Baseline inicial, antes de cubrir ramas de reglas y semántica |
| 2026-08-14 (2ª corrida) | 78.22 % | 896 | 186 | 68 | Tras `rules.test.ts` y `semantics.test.ts`. `semantics` 43→97 %, `rules` 53→84 % con **cero** sin cobertura |
| 2026-08-14 (3ª corrida) | **81.99 %** | 935 | 175 | 35 | Tras `structure.test.ts`. `errors` 0→100 %, `fitch` 73→88 % con cero sin cobertura, `verify` 63→70 % |

### Por archivo, 3ª corrida

| Archivo | Score | Vivos | Sin cobertura |
|---|---|---|---|
| `errors.ts` | 100 % | 0 | 0 |
| `semantics.ts` | 97.18 % | 2 | 0 |
| `tokenizer.ts` | 92.31 % | 12 | 0 |
| `fitch.ts` | 87.97 % | 16 | 0 |
| `ast.ts` | 85.32 % | 13 | 3 |
| `rules.ts` | 83.65 % | 51 | 0 |
| `parser.ts` | 72.62 % | 17 | 6 |
| `verify.ts` | 69.90 % | 64 | 26 |

**Siguiente objetivo:** `verify.ts` y `parser.ts`. De sus supervivientes, 34 y 13 respectivamente
son prosa de mensajes (categoría 2); el resto son ramas defensivas cuya alcanzabilidad hay que
decidir caso por caso: donde la rama sea inalcanzable, se elimina el código muerto en vez de
justificarlo.

## Categorías de superviviente

1. **Huecos reales de prueba** — ramas nunca ejercitadas. Se eliminan escribiendo la prueba que
   falta. La primera corrida los concentró en `rules.ts` (orientaciones alternativas de `↔I`, `∨E`,
   `↔E`, `→E`) y en `semantics.ts` (tablas por conectivo y cota de enumeración). Cubiertos por
   `rules.test.ts` y `semantics.test.ts`.
2. **Prosa de mensajes** — mutantes `StringLiteral` sobre el campo `detail` de los errores. Matarlos
   exigiría afirmar el texto exacto de cada mensaje en castellano, lo que congela la redacción sin
   proteger ninguna decisión: el **código** `E-*` es lo que gobierna, y ese sí se afirma en las
   pruebas. Se justifican como equivalentes a efectos de la decisión.
3. **Equivalentes estructurales** — p. ej. mutar el orden de dos comprobaciones que producen el mismo
   código de error. Se documentan caso por caso cuando aparecen.

## Regla de operación

- Un superviviente de la categoría 1 **bloquea** el gate hasta escribir la prueba.
- Un superviviente de las categorías 2 o 3 requiere una línea de justificación aquí.
- El score no se persigue como número: se persigue que ningún mutante que cambie una decisión del
  verificador sobreviva.
