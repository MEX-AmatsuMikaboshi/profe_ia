#!/bin/sh
# Base separada para Infisical dentro de la misma instancia (Plan.md T-H3-01).
#
# El gestor de secretos no comparte base con el sistema: sus tablas no tienen
# nada que ver con los siete esquemas de P-II §9.2, y mezclarlas obligaría a
# concederle privilegios dentro de la base del proyecto.
#
# Los scripts de `/docker-entrypoint-initdb.d` corren **una sola vez**, cuando el
# volumen de datos está vacío.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  SELECT 'CREATE DATABASE ${INFISICAL_DB}'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${INFISICAL_DB}')\gexec
EOSQL

echo "base ${INFISICAL_DB} lista"
