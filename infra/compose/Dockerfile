# syntax=docker/dockerfile:1
#
# Imagen única para los seis servicios de aplicación (Plan.md T-H3-01).
# Un solo Dockerfile con `APP` como argumento: seis copias casi idénticas se
# desincronizan, y la frontera entre servicios la fija el compose (red, montajes,
# secretos), no el sistema de archivos de la imagen.
#
# El digest exacto de la base se fija en el freeze (D-7); aquí se fija la etiqueta.

ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS build
WORKDIR /repo

# pnpm por npm: `corepack enable` no está garantizado en toda base (misma razón
# que en el entorno del propietario, PLAN_STATUS «Entorno de ejecución»).
ARG PNPM_VERSION=10.34.5
RUN npm install --global --no-fund --no-audit pnpm@${PNPM_VERSION}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
COPY tools ./tools
# `scripts/` e `infra/database/` viajan porque el servicio `migrator` aplica las
# migraciones desde dentro de la red interna, no desde el host.
#
# Se copia `infra/database`, **no `infra/` entero**: el compose y sus archivos
# viven en `infra/compose/`, y copiarlos invalidaría la caché de esta capa —y
# con ella la instalación de dependencias— cada vez que se toca un healthcheck.
COPY scripts ./scripts
COPY infra/database ./infra/database

# `--frozen-lockfile`: si el lockfile no corresponde, la build falla en vez de
# resolver versiones nuevas en silencio (DEC-DEPENDENCY-FREEZE-001).
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm run build

FROM ${NODE_IMAGE} AS runtime
ARG APP
ENV NODE_ENV=production
ENV APP_NAME=${APP}
WORKDIR /repo

COPY --from=build --chown=node:node /repo /repo

# Los puntos de montaje se crean **en la imagen** y con dueño `node`: Docker
# inicializa un volumen nombrado vacío copiando permisos del directorio de la
# imagen, y si no existe lo crea `root:root`. Sin esto, un proceso sin
# privilegios no podría escribir en sus propios volúmenes.
RUN mkdir -p /var/log/profesor-ia /spool /artifacts \
  && chown -R node:node /var/log/profesor-ia /spool /artifacts

# Usuario sin privilegios (T-H3-04). `node` ya existe en la imagen base.
USER node

# Forma shell: hace falta expandir `APP_NAME`.
CMD node apps/${APP_NAME}/dist/main.js
