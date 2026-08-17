# Autoridad aislada de medición — T-H6-06

Implementación de `Plan.md` `T-H6-06`, P-II §6 y `DEC-MEAS-AUTHORITY-001` en
`apps/measurement-worker/src/authority.ts`. Este artefacto cierra el núcleo autoritativo de una
oportunidad; el calendario SCED que decide cuándo abrirla pertenece a `T-H6-07` y las transiciones
de interrupción pertenecen a `T-H6-08`.

## Frontera de autoridad

`session-engine` sólo admite un `MeasurementSessionIntent` estricto con
`experimentalSet`, `phase` y `measureKind`. Al entrar, fuerza `MEASUREMENT_MODE`, borra estrategia,
pone ayuda en cero y deshabilita elegibilidad de dominio. No admite ronda, oportunidad, reactivo,
semilla, tiempo ni validez. Al salir consume un `ProbeOpportunityResult` ya derivado por el worker;
no lo reclasifica.

Dentro del worker, `ProbeRequest`, `ProbeDelivery` y `ProbeOpportunityResult` conservan las formas
literales de P-II §6.3. Ronda e identificadores de oportunidad son estado interno del
worker/calendario, no campos que el motor de sesión pueda elegir. `participantPseudoId` es la única
identidad recibida.

## Artefactos congelados y reservas

Política, inventario y semilla son JSON estrictos, versionados y hasheados canónicamente. El binding
por `runId` es inmutable y se puede restaurar; una corrida `material` exige los tres hashes
externos. Los fixtures tienen `purpose=test_fixture` y no afirman inventario, semilla, corpus,
preinscripción, firma ni gate material.

La política primaria reutiliza exactamente `sced-opportunity-h5-v1`: `k_set=3` y
`min_valid_items_per_opportunity=2`. Los tamaños de transferencia y retención son entradas del
inventario congelado; aquí no se inventa un valor material. El mapeo compartido es único:

- `primary_probe + baseline` → `probes_baseline`;
- `primary_probe + intervention` → `probes_intervention`;
- `transfer_measurement` → `TRANSFER_MEASUREMENT`;
- `retention_probe + retention` → `retention`.

Una combinación sin autoridad falla cerrada. El snapshot inicial incorpora consumos previos de
almacenamiento y aplica las exclusiones compartidas de P-I §7.7; esa información no cabe en
`ProbeRequest` y el mismo reactivo no puede reaparecer después de consumirse.

## Selección, entrega y resultado

La selección ordena candidatos con SHA-256 sobre semilla privada, corrida, seudónimo, oportunidad e
ítem. El estado registra selección y consumo en la misma transición antes de devolver exactamente
un `StructuredItemPrompt`. Mientras exista un ítem pendiente no se entrega otro. La salida no
contiene banco, familia, firma estructural, semilla, solución, pistas ni feedback; el resultado de
ítem tampoco devuelve corrección inmediata.

Tiempo y contrato del verificador salen del inventario congelado. El evento observado sólo aporta
una puntuación o un `reasonCode` preinscrito; el worker deriva `valid|invalid|missing` desde su
política. Una oportunidad válida calcula exactamente `correctValidItems / validScoredItems`; una
oportunidad por debajo del mínimo no se imputa. `reserve_exhausted` es `missing`, salvo que ya se
haya alcanzado el mínimo válido.

El replay exige secuencia, tiempo monótono, IDs únicos y artefactos ligados. Al continuar desde un
snapshot vuelve a derivar plan, orden sembrado, prompt, ordinal, consumo y resultado para rechazar
estado adulterado.

## Atomicidad comprobada

`ATOMIC_PROBE_CONSUMPTION_SQL` usa una sola sentencia CTE: un `UPDATE ... consumed=false`
compare-and-set reclama el reactivo y el `INSERT` de `probe_consumption` sólo ocurre si el reclamo
ganó. La suite de PostgreSQL abre dos conexiones `svc_measurement` concurrentes contra el mismo
reactivo: exactamente una obtiene fila y existe un solo consumo. La transición en memoria también
registra selección y consumo antes de exponer la entrega.

## Límites deliberados de esta tarea

- No hay inventario, semilla ni política material creados; eso requeriría contenido y freeze reales.
- El scheduler de rondas, ventanas, estabilidad, extensión, retención y covariación es T-H6-07.
- Pausa, duda, timeout, fin de sesión, retirada e incidentes se convertirán en eventos exactos en
  T-H6-08. Los reason codes usados aquí prueban la autoridad de clasificación, no esa máquina de
  interrupciones ni una calibración material de timeout.
- `main.ts` sólo declara el núcleo listo; transporte y calendario permanecen explícitamente sin
  cablear, por lo que no se simula una operación real ni se cierra T-H3-05.
