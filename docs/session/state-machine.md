# Estado estructurado y replay de sesión

Implementación de `Plan.md` `T-H6-01`, P-I §8.2 y P-II §7.1.

## Autoridad y secuencia

`@profesor-ia/session-engine` conserva dos dimensiones distintas:

- `primaryState` solo avanza una posición en la secuencia literal, desde `preparada` hasta `cierre`;
- `transverseStates` contiene, sin ocultar el estado principal, cualquiera de los ocho estados
  transversales literales.

Una mutación autoritativa no puede declarar `decisionMaker=model`. Cada transición, cambio
transversal o actualización de proyección agrega automáticamente su registro a
`decisionAutonomy`; el llamador no puede reemplazar esa lista mediante un patch.

## Proyección completa

`SessionStructuredState` incluye explícitamente los campos de P-I §8.2: versión del paquete, bloque,
tiempo planeado/real, KC, dominio operativo, modo, estrategia, ayuda, andamiaje/fading, errores,
pistas por intento, elegibilidad, transferencia, práctica/revisión, wheel spinning, actividades,
dudas, cambios de plan, incidentes, autonomía y próximos pasos.

La proyección v1 no admite `masteryProbabilityShadow`. `T-H5-16` congeló BKT como deshabilitado
porque CAL-11 no se ha ejecutado; el esquema, los comandos de actualización, la restauración y la
base rechazan esa propiedad.

## Replay e integridad

El evento inicial construye todos los campos desde datos mínimos tipados. Cada evento posterior
incluye:

- número de secuencia;
- hash SHA-256 de la proyección anterior;
- hash SHA-256 de la proyección resultante;
- momento, decisor y estado de autonomía;
- cambio estructurado y código de razón.

El hash se calcula sobre JSON canónico. `replaySessionStateEvents()` rechaza historia vacía,
inicialización fuera de posición, huecos, reordenamiento, tiempos regresivos, IDs repetidos y hashes
alterados. El snapshot directo y el replay deben ser idénticos, incluido su hash.

## Persistencia

La migración `20260816130000_session_structured_state.sql` añade a
`pedagogy.session_state` el JSON completo y su hash. Sus restricciones sincronizan la proyección con
las columnas escalares utilizadas por RLS y consultas operativas. No existe un default ni un
backfill: si hay filas históricas sin eventos materiales, la migración falla y exige reconstruirlas
desde su historia real.

`toSessionStatePersistenceRow()` crea la fila y `restoreSessionStateSnapshot()` vuelve a validar
esquema, hash, identificadores, estado, modo, estrategia, ayuda y fecha antes de devolver un
snapshot.
