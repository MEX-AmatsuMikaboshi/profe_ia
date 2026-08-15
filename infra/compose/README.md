# compose/

Entorno local L0 (`T-H3-01`, `T-H3-04`, `T-H3-05`). El procedimiento completo está en
[`../runbooks/local.md`](../runbooks/local.md); aquí solo el mapa de archivos.

| Archivo | Qué es |
|---|---|
| `docker-compose.yml` | Los ocho servicios del plan más `redis` (dependencia de Infisical, D-13) y `otel-collector` (exigido por `T-H3-05`), más tres de un solo uso bajo el perfil `tools` |
| `Dockerfile` | Imagen única para los seis servicios de aplicación, parametrizada por `APP`. Seis Dockerfiles casi idénticos se desincronizan |
| `otel-collector.yaml` | Colector local: OTLP para los servicios con red, `filelog` para el verificador, que no la tiene |
| `.env.example` | Qué variables hacen falta. Los valores los genera `pnpm run dev:env`; `.env` no se versiona |

## Lo que este directorio hace cumplir

El compose no es configuración de conveniencia: es donde varios invariantes de §4.5 se vuelven
ejecutables. `pnpm run ci:infra:hardening` los comprueba sobre la configuración **resuelta** por
Docker, no sobre este YAML.

- `verifier` con `network_mode: none` (I-3) y spool en disco como transporte (D-12).
- `solutions-private` solo en `authoring-worker` (I-2); reservas de sondas solo en
  `measurement-worker` y de solo lectura (I-4).
- Socket de Docker sin montar en ningún servicio.
- Todos: `no-new-privileges`, `cap_drop: ALL`, raíz de solo lectura, usuario no root, seccomp activo.
- Puertos publicados solo en `127.0.0.1`.

Las imposibilidades técnicas (los servicios con puerto publicado alcanzan Internet; el colector no
declara healthcheck) están registradas en el runbook y el verificador las imprime en cada corrida.
