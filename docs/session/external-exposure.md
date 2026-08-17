# Exposición externa, autoestudio y techo/suelo — T-H6-11

`packages/experiment/src/exposure.ts`. Norma: P-I §10.8 y `DEC-EXPOSURE-001`.

## Qué se captura

Al inicio de cada sesión se registra la exposición **desde la sesión anterior**, con la
clasificación cerrada de cuatro miembros del contrato. `declaredAt` es el momento declarado desde el
que corre la contaminación, no el momento en que se captura: son distintos y confundirlos movería el
inicio de la contaminación hasta el arranque de la sesión.

## Los efectos son literales

| Categoría | Efecto (§10.8 literal) |
|---|---|
| `NONE` | Sin efecto |
| `UNRELATED_OR_FOUNDATION` | «se registra y no invalida por sí solo» |
| `TARGET_KC_EXPOSURE` | Contamina la atribución desde el momento declarado; la transición/retención afectada no puede sostener un veredicto positivo y se marca `EXTERNAL_EXPOSURE` |
| `DIRECT_ITEM_EXPOSURE` | Invalida el reactivo/oportunidad afectada, consume el ítem y sólo permite reposición desde reserva independiente |

**La diferencia entre las dos últimas es la que decide el módulo.** `TARGET_KC_EXPOSURE` tiene
`replacementFromIndependentReserveAllowed: false`, y no por descuido: §10.8 dice que **no se
«limpia» mediante una reposición de reactivo porque la contaminación es conceptual, no del ítem**.
Ofrecer ahí una reposición sugeriría que reponer el reactivo arregla algo y convertiría una
contaminación conceptual en un trámite de inventario.

Simétricamente, `DIRECT_ITEM_EXPOSURE` no marca `EXTERNAL_EXPOSURE` ni bloquea el veredicto: lo que
está comprometido es el ítem, y para eso existe la reserva independiente.

## Lo que falla en vez de degradarse

- `DIRECT_ITEM_EXPOSURE` **sin oportunidad afectada** falla. Invalidar «lo que corresponda» sin saber
  qué es sería invalidar a ciegas.
- `TARGET_KC_EXPOSURE` **sin KC declarados** falla. Contaminar un conjunto vacío de KC pasaría el
  control por vacío y dejaría la marca sin alcance.
- Enseñanza humana deliberada declarada sobre una categoría que no toca KC objetivo falla: describiría
  una intervención pedagógica prohibida sobre nada.

La enseñanza humana deliberada se conserva en
`prohibitedPedagogicalInterventionObserved`, separada del efecto de exposición, porque §10.8 la trata
como una regla adicional que se mantiene («mantiene además la regla de intervención pedagógica
prohibida»), no como un efecto más de la categoría.

## Techo y suelo

```text
techo: tres últimas observaciones válidas = 1.00  Y  sin rango ascendente observable
suelo: tres consecutivas = 0  Y  evidencia de barrera de fundamentos/interfaz
```

El techo impide que el conjunto inicie intervención y marca `NOT_INTERPRETABLE_CEILING`.

**El suelo es el control que importa, y es asimétrico a propósito.** Tres ceros **no** bastan:
§10.8 dice que «una línea baja o incluso `0` no es por sí sola inválida», y que sólo se marca
`NOT_INTERPRETABLE_FLOOR` cuando además la evidencia muestra que el participante **no puede**
producir una respuesta puntuable por una barrera previa al KC objetivo. Si las respuestas son
válidas y el `0` representa desconocimiento real del KC, **la línea sigue siendo interpretable** —y
es justo el hallazgo que el diseño busca—. Marcarla no interpretable descartaría el dato más
informativo de la corrida.

Una mutación sembrada que elimina la exigencia de evidencia queda detectada por la prueba de «tres
ceros sin evidencia de barrera siguen siendo interpretables», y sólo por esa.

Con menos de tres observaciones válidas no se declara ni techo ni suelo, y la regla mira **las tres
últimas**, no toda la serie.

## Lo que no se afirma

No se conectó todavía con el calendario SCED ni con `measurement-worker`: este módulo decide el
efecto, y quién lo consume se cablea en la sesión seca. No hay corrida material ni participante real;
los fixtures son de prueba.
