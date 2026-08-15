# Runbook — entorno local L0

*Norma:* Maestro P-I §15.1 (entorno L0), P-II §11.5.1 (endurecimiento). Tareas `T-H3-01`…`T-H3-05`.

Todo corre en la PC del propietario. No se contrata VPS, dominio, TLS público, almacenamiento
remoto ni monitoreo: eso es el entorno H1, y solo se activa si H8 demuestra valor.

## Levantarlo

```bash
pnpm run dev:env
```

Genera `infra/compose/.env` con secretos aleatorios. **No se versiona** y no se sobreescribe: si ya
existe, el script se niega, porque perder la contraseña de una base con datos dentro es un incidente.

```bash
pnpm run dev:up
```

Construye las imágenes y espera a que todos los servicios estén `healthy`. La primera vez tarda:
instala el árbol de dependencias dentro de la imagen con `--frozen-lockfile`.

```bash
pnpm run dev:seed
```

Aplica las migraciones y fija la credencial de cada rol de servicio. Corre **dentro** de la red
`core`, que no publica puertos ni tiene salida: la base nunca se expone al host.

Otros: `dev:status`, `dev:logs`, `dev:down`, `dev:backup`, `dev:restore`.

## Paso manual que no automatizo

**Infisical necesita que crees su cuenta administrativa la primera vez**, en
<http://localhost:8080>. No lo hago yo: crear cuentas es una acción que corresponde al propietario.
Hasta que exista esa cuenta, los servicios leen sus credenciales de `.env`, que es el modo de
arranque, no el modo de destino (`T-H3-04` pide secretos por servicio vía Infisical).

## Comprobarlo

```bash
pnpm run ci:infra:hardening
```

Lee la configuración **resuelta** por Docker —no el YAML fuente— y comprueba 159 propiedades: socket
de Docker sin montar, `no-new-privileges`, `cap_drop ALL`, raíz de solo lectura, sin root, seccomp
activo, puertos solo en `127.0.0.1`, reservas montadas solo donde corresponde y `core` sin salida.

```bash
pnpm run ci:infra:compose-up
```

Arranque limpio y tres comprobaciones que no se ven leyendo el YAML: que todo llega a `healthy`, que
**el verificador aislado verifica de verdad** (entra una derivación por el spool y sale el veredicto)
y que un servicio de `core` no puede salir a Internet. Con `--clean` destruye los volúmenes antes de
arrancar; sin la bandera respeta los datos locales.

## Las fronteras y por qué están donde están

| Frontera | Cómo se hace cumplir |
|---|---|
| El verificador no tiene red (I-3) | `network_mode: none`. No es «una red interna»: es ninguna. Su transporte es un spool en disco (D-12) |
| Solo autoría toca `solutions-private` (I-2) | Es el único servicio que monta el repositorio de contenido |
| Solo medición toca las reservas de sondas (I-4) | Monta `probes-baseline` y `probes-intervention`, de solo lectura, y nadie más las monta |
| Solo autoría sale a Internet | Única conectada a la red `egress` (APIs de modelo y fuentes W0) |
| El socket de Docker no se monta | En ningún servicio. Montarlo concede root en el host y anula todo lo demás |
| Sin privilegios nuevos, sin capabilities, raíz de solo lectura | En todos, incluidos los de un solo uso |

## Imposibilidades técnicas registradas

`T-H3-04` las permite documentadas. `ci:infra:hardening` las **imprime en cada corrida** para que no
desaparezcan en silencio.

1. **`web`, `api` e `infisical` alcanzan Internet.** Docker no publica puertos desde una red
   `internal`, así que un servicio con puerto publicado necesita una red con salida. El resto
   (base de datos, workers, colector, verificador) sí vive en `core`, que es interna.
   *Mitigación aplicada:* los puertos se publican solo en `127.0.0.1`, nunca en `0.0.0.0`.
2. **`otel-collector` no declara healthcheck.** Su imagen es distroless: no trae shell ni cliente
   HTTP con el que sondear el endpoint de salud. Se observa por sus propios logs.
3. **Trazas todavía no instrumentadas.** El colector recibe OTLP y logs, pero los servicios no
   emiten spans: no hay operación que trazar hasta F7/F8. Emitir un span de «arranqué» para poder
   decir que hay trazas sería éxito simulado. `T-H3-05` queda EN_CURSO por esto, no por olvido.

## Restauración

`dev:restore` usa `pg_restore --clean --if-exists` sobre el volcado de `infra/backups/`. Es
**restauración básica de desarrollo** (`T-H3-02`), no el simulacro de recuperación con objetivo de
punto y tiempo que exige `T-H10-02`: ese se prueba en F10 y tiene su propia acta.
