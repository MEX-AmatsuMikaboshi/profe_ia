# profesor-ia

Monorepo de **Profesor IA · Etapa 1**. La autoridad de este repositorio es `Plan.md`, subordinado
al Documento Maestro y a la Especificación UI/UX conformada (jerarquía `Plan.md` §0.1).

> Ante cualquier contradicción prevalece la fuente de mayor autoridad y se corrige la inferior.
> Si el código contradice al plan, el código está mal.

## Estado

**F0 / H0 en curso.** Avance detallado y bloqueos: [`docs/plan/PLAN_STATUS.md`](docs/plan/PLAN_STATUS.md).

## Requisitos

- Node **24.x LTS** (`.nvmrc`)
- pnpm **10.x**
- Docker Engine 27.x + Compose — necesario desde F1/H1 (BD real con Testcontainers) y F3/H3

## Puesta en marcha

```bash
pnpm install
pnpm run ci:typecheck && pnpm run ci:unit && pnpm run ci:arch:depcruise
```

## Checks (Plan.md §10)

| Comando | Qué comprueba |
|---|---|
| `pnpm run ci:lint` | Estilo y reglas de tipo |
| `pnpm run ci:typecheck` | TS 5.9 `strict` en todos los workspaces |
| `pnpm run ci:unit` | Pruebas unitarias (Vitest) |
| `pnpm run ci:build` | Compilación de todos los paquetes |
| `pnpm run ci:arch:depcruise` | Reglas `forbidden` que codifican los invariantes I-1…I-9 |
| `node scripts/arch/verify-depcruise-catches.mjs` | Que esas reglas **detectan** una violación sembrada |
| `pnpm run ci:supply:sbom` | SBOM CycloneDX + digest de lockfile + política de licencias |
| `pnpm run ci:supply:drift` | Drift de dependencias y advisories (bloqueante) |
| `pnpm run ci:logic:golden` | Conjunto dorado del núcleo lógico (413 casos) |
| `pnpm run ci:logic:pbt` | Propiedades con fast-check (semillas registradas) |
| `pnpm run ci:logic:no-net` | El verificador es función pura y sin red |
| `pnpm run ci:logic:mutation` | Mutation testing (lento; ver `docs/quality/mutation-baseline.md`) |
| `pnpm run ci:db:negative` | Suite negativa de privilegios contra PostgreSQL 17 real |
| `pnpm run db:grants:check` | La migración de `GRANT` corresponde a la matriz vigente |

## Estructura

- `apps/` — web, api, verifier, authoring-worker, measurement-worker, background-worker (§4.2)
- `packages/` — contratos y motores; `logic-core` y `isomorphism-canonicalizer` **separados** por regla arquitectónica
- `tools/cli` — CLI `profesor-ia` (§«Decisiones de ingeniería» D-1 en `PLAN_STATUS.md`)
- `content/unidad-deduccion-natural/` — repositorio de contenido, historial propio (§4.3)
- `infra/`, `analysis/`, `docs/`

## Fronteras que no se negocian

- El modelo **no** decide corrección formal, avance, modos, consumo de bancos ni permisos (I-1).
- El agente de sesión **no** puede leer soluciones ni sondas (I-2, I-4); `solutions-private/` nunca
  se monta en contenedores del agente o de web.
- La evidencia es **append-only**: una corrección es un evento nuevo enlazado (I-6).
- Toda salida factual va anclada a fragmentos autorizados (I-7).
- Nunca se versiona `.env`: los secretos se inyectan en runtime (Infisical).
