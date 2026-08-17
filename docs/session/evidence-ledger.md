# Bitácora de evidencia reconstruible — T-H6-09

## Alcance y autoridad

Este módulo implementa P-I §15.4 y P-II §9.1/§9.4/§9.6 sobre la tabla
`evidence.event` creada en H1. No crea una segunda bitácora. La unidad de escritura es el
`EvidenceEvent` literal y cada stream queda ligado a un solo `runId`, `participantPseudoId` y
`sessionId`.

Antes de esta tarea el contrato TypeScript/JSON omitía `validity`, aunque el Maestro y PostgreSQL
sí la exigían. Se corrigió el contrato: ahora `validity = valid | invalid | deviation` es obligatorio
y el objeto es estricto. Esta corrección no cambia la taxonomía operacional de sondas
`valid | invalid | missing`; son conceptos distintos.

## Sellado y replay

`EvidenceLedger.append()` recibe el acto estructurado y los metadatos de autoridad; el ledger
asigna `sequenceNumber`, toma la cabeza previa y calcula:

```text
hash = SHA-256(canonical-json(EvidenceEvent sin el campo hash))
```

El JSON canónico ordena claves, normaliza `-0` a `0` y rechaza números no finitos, valores no JSON,
objetos con prototipo especial y referencias circulares. El hash cubre, entre otros,
`previousHash`, payload, decisor, autonomía, versiones, ambos tiempos y validez. El primer evento
usa `previousHash = GENESIS`.

El runtime exige `streamId` y `occurredAtServer` **antes** de sellar, aunque P-II §9.1 los hace
opcionales. La tabla ya exige ambos; permitir que PostgreSQL inventara después el tiempo de servidor
dejaría una columna material fuera del hash. `occurredAtServer` no puede retroceder dentro del
stream. `occurredAt` conserva el tiempo declarado del acto y puede representar una observación
recibida con retraso.

`replayEvidenceEvents()` vuelve a validar:

- el contrato estricto y la versión del sobre;
- identidad única del stream;
- secuencia sin huecos y `previousHash` exacto;
- SHA-256 recalculado de cada evento;
- IDs y hashes no duplicados;
- tiempo de servidor monótono;
- sobre de payload y actualizaciones de proyección;
- orden y enlaces de toda corrección.

`EvidenceLedger.restore()` solo acepta esa reconstrucción verificada. No hay métodos de actualización,
borrado, truncado o reemplazo; los eventos y las vistas devueltas quedan congelados en profundidad.

## Payload y proyecciones

El payload usa un único sobre:

```ts
{
  act: Record<string, JsonValue>;
  projectionUpdates: Array<{
    projection: ProjectionType;
    projectionId: string;
    value: Record<string, JsonValue>;
  }>;
  correctionStage?: CorrectionStage;
}
```

Cada acto conserva entrada/salida estructurada minimizada o una referencia al artefacto suprimible.
Texto libre, audio, imágenes o capturas potencialmente identificables no deben copiarse al ledger.
`participantPseudoId` es un seudónimo, no anonimización.

El replay produce la vista actual y el historial completo para las diez proyecciones de H6-09:

1. `session`;
2. `domain`;
3. `coverage`;
4. `strategy`;
5. `eligibility`;
6. `wheel_spinning`;
7. `intervention`;
8. `load`;
9. `incidents`;
10. `results`.

El último evento para `projection + projectionId` forma la vista actual, pero todas las revisiones
permanecen en `projectionHistory` con evento fuente, secuencia y validez. BKT no aparece porque
CAL-11 quedó sin ejecutar y H5 lo congeló en OFF. Una futura proyección de métricas de producto debe
seguir físicamente o lógicamente separada y no se añadirá a estas vistas primarias.

La validez se conserva en cada revisión; el replayer no inventa una política para ocultar una
actualización inválida. Una invalidación material debe emitir su evento de corrección y la
actualización explícita que corresponda.

## Correcciones

`appendCorrection()` es la única vía de corrección. Traduce los cinco nombres normativos a IDs de
evento estables:

```text
detection → classification → invalidation → replacement → resolution
```

Las cinco etapas apuntan al original mediante `correctionOfEventId`. `causedByEventId` apunta al
original en detección y a la etapa anterior después. Saltos, repeticiones, una sexta etapa, un
original inexistente o un evento que simule el prefijo de corrección fallan. Una secuencia parcial
es válida mientras una corrección está en curso; el original y todas las etapas ya emitidas
permanecen.

## Persistencia e integración de sesión

`EVIDENCE_EVENT_INSERT_SQL`, `evidenceEventInsertParameters()` y los mapeos de fila cubren las 22
columnas de `evidence.event`, incluida `validity`. Restaurar una fila recalcula su hash; restaurar el
stream completo vuelve a comprobar también la cadena. El trigger PostgreSQL conserva la defensa
append-only y resuelve la concurrencia entre escritores con la restricción stream+secuencia.

`appendSessionMutationEvidence()` valida que evento, revisión, snapshot y hash de estado coincidan,
copia el decisor/autonomía de la autoridad de sesión y proyecta sesión, dominio, cobertura,
estrategia, elegibilidad, `wheel_spinning` e incidentes. La variante
`appendSessionMeasurementExitEvidence()` conserva además el `ProbeOpportunityResult` exacto en
`results`; no recalcula ni reclasifica su validez operacional. La integración rechaza una sesión,
corrida o seudónimo distintos del binding del ledger.

H6-14 usará este adaptador como ruta de escritura del orquestador de sesión seca. Las funciones
puras del motor siguen sin efectos de I/O para conservar replay y pruebas deterministas.

## Límites deliberados

- Esta tarea no genera checkpoints ni firmas. El checkpoint firmado corresponde a T-H10-01 y la
  clave privada no debe estar disponible para `session-engine`.
- Una cadena detecta alteración respecto de una cabeza o checkpoint confiable; no prueba
  inmutabilidad frente a un administrador que controle base, host, claves y referencias.
- No se produjeron corpus, eventos de participante, benchmarks, calibraciones, credenciales ni
  firmas. Las pruebas usan exclusivamente `test_fixture`.
- El ledger no intenta detectar identidad personal dentro de texto arbitrario. El límite correcto
  es no incorporar ese texto y usar artefactos suprimibles referenciados.

## Verificación

La suite dirigida cubre contrato, hash canónico, alteraciones de todos los campos críticos,
restauración, persistencia, las diez proyecciones, superficie append-only, integración de sesión y
las cinco etapas de corrección. Una mutación sembrada que excluyó `validity` del hash hizo fallar la
prueba de alteración y se restauró antes de la batería final.
