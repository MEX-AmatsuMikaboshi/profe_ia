# golden-tests/ — conjunto dorado del núcleo lógico

Pisos del Maestro (P-III §7.1), verificados por `ci:logic:golden`:

| Archivo | Piso | Casos | Contenido |
|---|---|---|---|
| `valid.json` | ≥100 | 120 | Derivaciones válidas **generadas por construcción** con reglas autorizadas |
| `invalid.json` | ≥100 | 120 | Derivaciones inválidas por mutación tipada, con el código `E-*` esperado |
| `scope.json` | ≥50 | 63 | Alcance, citas, subpruebas y descarga |
| `variants.json` | ≥50 | 50 | Variantes estructuralmente distintas de la misma conclusión |
| `edge-cases.json` | ≥50 | 60 | Casos límite del cálculo y de la política de Etapa 1 |

## Cómo se generan

```bash
pnpm run ci:build
pnpm run logic:golden:generate
```

Determinista por semilla (`seedBase: 20260814`): regenerar no produce ningún diff. CI lo comprueba;
un diff significa que cambió el generador o el cálculo, y entonces cambia la versión del cálculo.

## La expectativa no se graba de la salida

El generador declara la expectativa **a priori** —por construcción, o por el tipo de mutación
aplicada— y **falla** si el verificador no la cumple. Nunca escribe como «esperado» lo que el
verificador devolvió: eso convertiría el conjunto dorado en un espejo del bug.

Esta disciplina ya evitó dos casos mal especificados durante la primera generación: una mutación
que producía `E-SYN-PRECEDENCE` en vez del `E-SYN-PARSE` declarado, y otra cuyo defecto real era
de accesibilidad de citas, no de aridad.

## Qué falta para el gate H2

- Regresión por cada incidente que aparezca (se añade al detectarse; hoy no hay ninguno).
- `[CALIBRATION CAL-04 / CAL-GOLDEN-LOGIC]`: tamaño y estratificación finales del conjunto.
