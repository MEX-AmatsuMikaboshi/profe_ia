# database/

Migraciones SQL versionadas (Plan.md T-H1-01/02/03) y suite negativa de privilegios (T-H1-04).

## Migraciones

Formato **dbmate** (`-- migrate:up` / `-- migrate:down`), aplicadas en orden lexicográfico:

| Archivo | Contenido |
|---|---|
| `20260814100000_schemas.sql` | Los 7 esquemas exactos; `PUBLIC` revocado |
| `20260814100100_roles.sql` | Rol de migraciones + 7 roles de servicio (`NOINHERIT`, sin `SUPERUSER`/`BYPASSRLS`) |
| `20260814100200_tables.sql` | Tablas iniciales por esquema |
| `20260814100300_evidence_append_only.sql` | Triggers append-only + cadena `previous_hash` y secuencia monótona |
| `20260814100400_grants.sql` | **Generado** desde la matriz de permisos — no editar a mano |
| `20260814100500_rls.sql` | RLS como segunda capa con `FORCE ROW LEVEL SECURITY` |

La migración de `GRANT` se regenera con:

```bash
pnpm run db:grants
```

y CI comprueba que corresponde a la matriz vigente con `pnpm run db:grants:check`. La fuente de
verdad es `packages/security-policy/src/matrix.ts`.

## Suite negativa

```bash
pnpm run ci:db:negative
```

Levanta PostgreSQL 17 real con Testcontainers y comprueba que **todo lo no concedido está
denegado**, más controles positivos que impiden que la suite pase por vacío. Un mock no prueba
permisos (Plan.md §10).

En Windows, si la consola se abrió antes de instalar Docker, antepón
`C:\Program Files\Docker\Docker\resources\bin` al `PATH` o abre una consola nueva.

## Contraseñas

Nunca se versionan. Las migraciones crean los roles sin contraseña; el entorno las inyecta
(Infisical) y el arnés de pruebas fija una de usar y tirar.
