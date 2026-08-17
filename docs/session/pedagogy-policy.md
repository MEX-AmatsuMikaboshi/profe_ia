# Política pedagógica determinista

Implementación de `Plan.md` `T-H6-02`, P-I §8.3.1–§8.3.4 y P-II §7.2.1.

## Artefacto congelable

`PedagogyPolicyDefinition` es un artefacto JSON estricto. Incluye versión de política y de tabla,
la jerarquía literal de cinco niveles, los cinco patrones base, los controles especiales, el binding
de `CAL-10/CAL-WHEEL` y las reglas de transición. Las condiciones son enums y señales observables;
no son prompts ni predicados JavaScript inyectables.

`compilePedagogyPolicy()` valida el artefacto, exige que las diez estrategias de
`PedagogicalDecision` sean representables, calcula SHA-256 sobre JSON canónico y congela todo el
objeto. `PedagogyPolicyRunRegistry` enlaza `runId → purpose + policyVersion + policyHash` una sola
vez. Repetir el mismo binding es idempotente; cambiarlo es deriva y falla cerrado. Los bindings son
JSON persistible y el registro puede restaurarlos tras reinicio, rechazando duplicados
contradictorios. Para construir un motor material es obligatorio aportar el hash esperado desde el
paquete congelado; el motor no puede autoautorizar el hash que acaba de calcular.

## Jerarquía operativa

El motor evalúa por etapas, no solo ordena un resultado al final:

1. seguridad, integridad, modo y no revelación;
2. prerrequisitos bloqueantes;
3. dominio, recuperación y wheel spinning;
4. estrategia por KC y estado observable;
5. adaptación lingüística/visual, que deliberadamente no tiene reglas autoritativas de cambio de
   ruta.

Por eso una solicitud inválida de retrieval no puede adelantarse a un bloqueo de seguridad, y una
evaluación wheel spinning pendiente no puede adelantarse a un prerrequisito bloqueante. En
`MEASUREMENT_MODE` el resultado es `suppressed`; no se fabrica un `PedagogicalDecision` con una
estrategia para satisfacer el esquema.

## Patrones y controles

La tabla concreta representa los cinco patrones de P-I §8.3.2. Los pasos que no son estrategias
—comprobación, suspender/volver al KC, nueva práctica o sonda del calendario— permanecen como
acciones del motor. `fading` baja `assistanceLevel`; feedback correctivo acompaña a la estrategia y
no inventa un undécimo miembro del enum.

- Fading exige mejora de desempeño. La excepción por tiempo/conteo solo se acepta con referencia
  hasheada, preinscrita y expresamente validada.
- Autoexplicación solo admite los tres disparadores selectivos, queda anclada al KC y es diagnóstica.
- Retrieval/spacing exige autoridad `engine_calendar`, KC ya introducido y reserva de práctica; una
  reserva de medición se rechaza.
- El contexto es estricto y no admite propuestas del modelo ni texto de conversación.
- `masteryEligible` solo puede quedar verdadero cuando la tabla lo permite **y** una autorización
  estructurada con autoridad `domain_engine` lo confirma; elegir una estrategia independiente no
  basta por sí solo.

## CAL-10 / CAL-WHEEL

El repositorio no contiene una calibración material de este umbral. La política material incluida
declara `status=pending`; solicitar detección con ella produce `CALIBRATION_REQUIRED`.

El contrato acepta una calibración externa con versión, hash y umbral. Los valores usados en las
pruebas llevan `status=test_fixture`, solo pueden ligarse a corridas `test_fixture` y su resultado
conserva esa procedencia. Nunca autorizan una corrida material. Antes de activar la señal, el motor
exige que se hayan examinado granularidad de práctica, estrategia, ayuda, error persistente y
prerrequisitos.
