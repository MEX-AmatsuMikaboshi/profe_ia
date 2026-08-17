# Freeze de contenido W5

`profesor-ia experiment freeze --content <directorio>` es el único camino de publicación de un
paquete H5. El comando falla cerrado: no crea claves, no firma placeholders y no interpreta un
árbol vacío como contenido válido.

## Entradas

El directorio debe contener los artefactos materiales de `Plan.md` §4.3, además de:

- `lint-input.json`: hechos producidos por el pipeline para los 20 controles de
  `content validate`; el freeze vuelve a ejecutar el linter.
- `freeze-input.json`: `manifestVersion: "1"`, `runId`, fecha ISO-8601,
  `authorizedCalculusVersion` con id/versión/hash, los siete `capabilityFlags` y las catorce
  secciones externas de `FREEZE_MANIFEST_REQUIRED_SECTIONS`.

Cada sección externa tiene `{ "version": "…", "content": … }`. W5 calcula su hash; un hash
declarado por el productor no sustituye esa comprobación. Además se exigen referencias concretas
para modelos y prompts, semillas, resultados, mapa/bancos/soluciones/rúbricas/pistas/verificador/
complejidad, cálculo, presupuestos de búsqueda, auditoría aprobada, licencias y snapshot W0, plan
SCED, políticas pedagógicas y de elegibilidad, wheel-spinning, BKT y proveedores multimodales.
Un `README.md` no satisface un banco material.

La clave y su identificador entran fuera del paquete:

```text
PROFESOR_IA_FREEZE_PRIVATE_KEY_PEM=<clave privada Ed25519 configurada>
PROFESOR_IA_FREEZE_KEY_ID=<id de la clave autorizada>
```

La clave privada nunca se escribe en el manifiesto ni en el paquete. Su ausencia, una clave que no
sea Ed25519 o un paquete ya congelado bloquean la operación.

## Publicación y verificación

El comando enumera los artefactos, calcula hashes agregados e individuales, firma el JSON canónico,
escribe un temporal exclusivo, sincroniza y renombra a `freeze-manifest.json`. Después recalcula el
inventario, aplica `0400` a `solutions-private/`, `0444` a los demás archivos y `0555` a los
directorios en el runtime POSIX de publicación. En Windows `chmod` solo ofrece la protección de
solo lectura; la separación de servicios y soluciones se provisiona en el runtime Linux y no se
declara una ACL Windows equivalente.

`pnpm ci:freeze:drift -- --content <directorio>` valida el contrato material y vuelve a calcular
cada hash. Cambiar, añadir o retirar un byte hace fallar el check. Mientras el repositorio de
contenido conserve el manifiesto placeholder de F0, el fallo de este comando es el resultado
correcto: H5 sigue abierto.

Las claves efímeras de las pruebas son fixtures locales; no son una firma de corpus, un gate humano
ni una credencial de operación.
