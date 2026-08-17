# Recuperación determinista y límite pedagógico

Implementación de `Plan.md` `T-H6-04`, P-I §8.7 y
`DEC-RECOVERY-SCOPE-001` en `packages/domain-engine/src/recovery.ts`.

## Política congelada

`RecoveryPolicyDefinition` convierte la política vigente en datos JSON estrictos, versionados,
hasheados y congelados por corrida. Los parámetros son operativos del protocolo actual, no óptimos
científicos:

1. feedback específico + explicación nueva o ejemplo trabajado + práctica guiada;
2. reducción real de complejidad + revisión/remediación de un prerrequisito declarado +
   *scaffolding* contingente;
3. representación realmente alternativa + autoexplicación selectiva + nueva comprobación.

Una corrida material exige por configuración externa los hashes esperados de política y grafo. El
binding persistible fija además versión y hash del inventario de recuperación. Restaurar el
registro no permite reasignar ninguno de esos valores.

El grafo de dependencias es entrada congelada y acíclica para sus aristas bloqueantes.
`blocksRoute` no es una opinión del llamador: se deriva y valida desde el tipo de arista. `FORMAL`,
`POLITICA_CONTENIDO` y `PEDAGOGICA` bloquean; `CONCEPTUAL_ANALOGICA` y `ESTADISTICA` no. Esta última
nunca puede alterar una corrida ya congelada.

## Ejecución dentro del bloque

Solo un fallo clasificado `PEDAGOGICAL` en `LEARNING_MODE` puede iniciar el programa. El primer
ciclo debe responder al mismo código de error que lo activó. El segundo solo acepta KC que sean
prerrequisitos declarados del objetivo. Cada ciclo registra un hash de su evidencia y material
consumido; orden, reducción de complejidad, contingencia, alternativa de representación y
selectividad de autoexplicación se validan estructuralmente.

El material fallido y todo material ya consumido quedan fuera de los pasos posteriores. Así se
evita repetir mecánicamente la misma actividad y se conserva la propiedad de consumo único. Si un
ciclo observa progreso, el controlador vuelve a la evaluación autoritativa de dominio: no declara
dominio a partir de una sola actividad de recuperación.

Agotar los tres ciclos deja el KC no dominado y solicita al registro de reservas la siguiente
oportunidad posterior. Ausencia de reserva, incidente, retirada, fin de sesión o problema de
interfaz/operación quedan como falta o cierre sin reserva; nunca se convierten en fallo conceptual.

## Episodios posteriores y límite

Una oportunidad posterior solo es válida si:

- proviene de `recovery_reserve_registry` con el inventario congelado;
- usa `LEARNING_MODE` y la reserva `recovery`;
- pertenece al mismo KC;
- utiliza actividad y reactivo distintos del intento fallido y de todo material consumido.

Programar no incrementa `recoveryEpisodeCount`; mostrar/iniciar el episodio sí. El contador vive en
cada KC y nunca supera dos. Se conserva por separado `failedRecoveryEpisodeCount`: dos episodios
consumidos alcanzan el tope, pero solo dos episodios fallidos del mismo KC producen
`pedagogical_limit_observed`.

Al observar el límite, el controlador recorre transitivamente el grafo congelado y cierra cada ruta
dependiente bloqueante como no alcanzable bajo esa versión. Guarda causa, camino, versión y hash
del grafo. Las relaciones conceptuales/analógicas o estadísticas no se cierran.

No existe una salida pedagógica hacia rescate docente. Los únicos resultados son continuar el
ciclo, inspeccionar/consumir reserva, volver a evaluación de dominio, registrar falta/no reserva,
alcanzar el tope o declarar límite y cerrar rutas.

## Replay e integración de sesión

`DeterministicRecoveryController` valida secuencia, tiempo, IDs, binding, inventario, contadores,
material, programas, episodios y cierres derivados. `RecoveryRunState` conserva la historia por KC
y reproduce exactamente el estado desde eventos; propiedades de modelo o BKT se rechazan.

`recoveryKcProjection()` entrega estado, ciclo, contadores y próxima acción.
`updateSessionFromRecoveryState()` proyecta esa autoridad a estrategia, asistencia, andamiaje,
dominio negativo cuando corresponde, rutas activas, cambios al plan y próximos pasos del estado de
sesión. La entrada/salida del transversal `recuperacion` permanece como evento separado de
`session-engine`, de modo que cada acto conserva su propio decisor, autonomía y replay.

Las pruebas usan políticas, grafos e inventarios marcados `test_fixture`. No se materializó corpus,
inventario real, calibración, firma ni acta de gate.
