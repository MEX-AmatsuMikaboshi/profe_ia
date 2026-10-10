# Parte B — recomendaciones del segundo auditor

## Decisión 1 — declarar la no comparabilidad

Recomiendo **asumirla y declararla**, no estrechar artificialmente las sondas. La diferencia no parece un accidente de asignación que pueda eliminarse conservando el mismo constructo: una parte importante proviene de la estructura necesaria de cada KC. Obligar a que una introducción de bicondicional y una eliminación de conjunción ocupen el mismo rango haría que las sondas dejaran de representar con naturalidad lo que dicen medir.

La consecuencia debe imponerse sobre las inferencias, no esconderse en una nota metodológica: el piloto puede estimar cambios dentro de cada conjunto a través de sus fases, pero no puede interpretar diferencias de nivel o magnitud entre A/B/C como diferencias del efecto de la intervención. Tampoco debe producir un efecto combinado que trate las sondas como intercambiables. CAL-09 aporta comparabilidad estructural, no equivalencia psicométrica.

Redacción sugerida:

> Los conjuntos A, B y C no fueron estructuralmente equivalentes bajo `cal-09-v1`: la diferencia máxima entre sondas primarias de conjuntos distintos fue 71,28, por encima de la banda preinscrita de 12,065296. Esta diferencia refleja en parte la estructura propia de los conceptos evaluados y no se corrigió simplificando artificialmente sus sondas. En consecuencia, los cambios se interpretan dentro de cada conjunto y entre fases del mismo conjunto; no se atribuyen las diferencias de nivel o de magnitud entre A/B/C a la intervención, no se consideran sus puntuaciones directamente intercambiables y no se presenta un efecto agregado que presuponga equivalencia estructural o psicométrica.

## Decisión 2 — aplicar el arreglo antes del freeze

Recomiendo **aplicarlo ahora y re-congelar la calibración con una versión nueva**. El buscador tiene un hueco conocido respecto del cálculo autorizado y ya obligó a rediseñar contenido por una limitación del autor, no por una decisión curricular. Mantenerlo evita el costo inmediato, pero congela ese sesgo dentro del banco y hace mucho más cara su corrección posterior.

Debe conservarse `cal-09-v1` como evidencia histórica append-only y producirse un manifiesto nuevo; no debe sobrescribirse el anterior ni fingirse que ambos índices son directamente comparables. Se acepta a cambio regenerar W3, repetir la selección A/B/C y rehacer W4, además del cambio de bandas, trabajo de búsqueda y `sampleHash`. Como aún no hay datos de participantes ni freeze del paquete, este es el último momento barato para asumir ese costo.

## Decisión 3 — la evidencia no alcanza para congelar

No alcanza. La Parte A registró 15 juicios críticos en 14 de los 36 reactivos: trece sondas contienen como núcleo completo una derivación ya practicada y dos pistas de KC16 dirigen a `¬E` donde corresponde `DNE`. El umbral bloquea con un solo crítico.

Los hallazgos no deben repararse editando únicamente los reactivos observados. Hay que tratar las plantillas de envoltura de las reservas de medición y la generación de pistas para DNE como posibles causas comunes, adjudicar el criterio de contaminación, regenerar las familias afectadas y obtener una muestra nueva con otra semilla. Después se requiere una nueva auditoría independiente y ciega, además de la lectura humana por muestra que el modelo no sustituye.

Esta ejecución tampoco puede usarse por sí sola como evidencia conforme: el HANDOFF reveló el veredicto previo antes de la Parte A, y OpenAI/Codex puede pertenecer a la familia candidata de BENCH-01 a la que el paquete no debía exponer soluciones. Los defectos son evidencia diagnóstica accionable, pero esta entrega no satisface el protocolo de cegamiento ni resuelve el posible conflicto con el candidato.

```json
{
  "decision1": {
    "eleccion": "declarar",
    "motivo": "La dispersión proviene en parte de la estructura necesaria de los KC; estrechar las sondas para forzar la banda distorsionaría el constructo. La interpretación debe limitarse a cambios dentro de cada conjunto y no comparar magnitudes entre A/B/C ni asumir equivalencia psicométrica.",
    "redaccionSugerida": "Los conjuntos A, B y C no fueron estructuralmente equivalentes bajo cal-09-v1: la diferencia máxima entre sondas primarias de conjuntos distintos fue 71,28, por encima de la banda preinscrita de 12,065296. Esta diferencia refleja en parte la estructura propia de los conceptos evaluados y no se corrigió simplificando artificialmente sus sondas. En consecuencia, los cambios se interpretan dentro de cada conjunto y entre fases del mismo conjunto; no se atribuyen las diferencias de nivel o de magnitud entre A/B/C a la intervención, no se consideran sus puntuaciones directamente intercambiables y no se presenta un efecto agregado que presuponga equivalencia estructural o psicométrica."
  },
  "decision2": {
    "eleccion": "aplicar",
    "motivo": "El hueco contradice el repertorio del cálculo autorizado y ya sesgó qué contenido era autorable. Antes del freeze y sin datos de participantes es preferible corregirlo, versionar y re-congelar que perpetuar la limitación dentro del banco.",
    "seAceptaACambio": "Conservar cal-09-v1 como evidencia histórica, crear una calibración versionada nueva y aceptar la pérdida de comparabilidad directa entre escalas, el cambio de bandas y sampleHash, y la obligación de regenerar W3, repetir la selección A/B/C y rehacer W4."
  },
  "decision3": {
    "alcanza": false,
    "motivo": "La Parte A contiene 15 juicios críticos y el gate bloquea con uno; además, esta ejecución no preservó el cegamiento y expuso soluciones a una familia potencialmente candidata de BENCH-01.",
    "condiciones": [
      "Aplicar el arreglo del buscador, versionar y re-congelar CAL-09 antes de regenerar contenido.",
      "Adjudicar el criterio de contaminación y analizar como causa común las plantillas de envoltura de las reservas de medición.",
      "Regenerar por completo las familias afectadas, sin corregir a mano solo los reactivos observados.",
      "Corregir como causa común la generación de pistas para DNE y regenerar sus familias afectadas.",
      "Repetir W3, la selección A/B/C y W4 con muestra y semilla nuevas.",
      "Obtener una Parte A realmente ciega de un auditor de familia distinta que no sea candidato de BENCH-01.",
      "Completar la lectura humana por muestra exigida antes del freeze y recomputar los umbrales."
    ]
  }
}
```
