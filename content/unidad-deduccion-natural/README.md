# unidad-deduccion-natural

Contenido del curso experimental `VALIDATED_LOGIC_COURSE` (Plan.md §4.3).
Desde el 2026-10-10 se versiona directamente en el repositorio público `profe_ia`, por
instrucción del propietario, incluidas las soluciones y las reservas de evaluación.
El historial anterior se conserva en `MEX-AmatsuMikaboshi/profe_ia_contenido`.

## Fronteras duras

- `solutions-private/` **nunca** se monta en contenedores del agente ni de web (I-2).
- `items/probes-*` son reservas de medición: invisibles para agente, práctica, ejemplos y perfil (I-4).
- Tras el freeze (W5) el paquete queda bloqueado a escritura y el drift es detectable (`ci:freeze:drift`).

## Estado

El árbol incluye corpus, cálculo autorizado, bancos de ítems, políticas pedagógicas y auditorías.
La integración conserva los archivos del commit de contenido
`7460f74ba79abb5ad480ee088b5299fc5199c205`, salvo esta documentación.
`freeze-manifest.json` sigue en estado `PLACEHOLDER`; esta publicación no declara un freeze.
