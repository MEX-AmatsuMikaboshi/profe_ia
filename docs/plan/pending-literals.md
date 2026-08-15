# Catálogos literales — estado

**Ningún catálogo queda pendiente.** El 14-08-2026 se recibió el Documento Maestro y todos los
catálogos que antes fallaban cerrado se transcribieron literalmente.

## Transcritos desde el Maestro (14-08-2026)

| Catálogo | Fuente | Dónde vive |
|---|---|---|
| Estrategias pedagógicas (10) | P-II §7.2.1 (enum) + P-I §5.10 (catálogo base) | `contracts/src/pedagogical-decision.ts` |
| `EvidenceEvent` completo | P-II §9.1 | `contracts/src/evidence-event.ts` |
| Tipos de evento multimodal (21) | P-II §9.3 | idem |
| `decisionMaker` (5) · `autonomyStatus` (4) | P-II §9.1 | `contracts/src/primitives.ts` |
| Matriz de autonomía (5 estados) y criticidad por función (5 clases) | P-I §5.6 / §5.6.1 | idem |
| Clasificación de intervención humana (7) | P-I §5.7 | idem |
| Contratos `Probe*` | P-II §6.3 | `contracts/src/probe.ts` |
| `AnchoredSegment` y causas de rechazo | P-II §8.4 | `contracts/src/anchored-segment.ts` |
| Operaciones del gateway (11) y `ModelCapabilities` | P-II §8.2 | `contracts/src/model-binding.ts` |
| Niveles y categorías de incidente | P-I §13.1 / §13.2 | `contracts/src/incident.ts` |
| Métricas con contrato (7) y ausencia de `phase_change` | P-I §10.4 / §10.5 | `contracts/src/manifests.ts` |
| Clases de transición y los 4 veredictos | P-I §10.5.1 / §12.3 | idem |
| Secciones obligatorias del freeze | P-II §5.7 | idem |
| `authorized-calculus-v1` íntegro | P-II §4.1.1 | `content/…/kc/authorized-calculus-v1.yaml` + `logic-core` |

## Referenciados sin definición literal

`VersionManifest` (P-II §9.1) y `StructuredItemPrompt` (P-II §6.3) se nombran en contratos del
Maestro pero no se definen. Se implementan con la estructura mínima que su uso exige y quedan
marcados en el código (decisión D-4). No son `BLOCKED_BY_SPEC`: no falta una decisión normativa,
falta un tipo auxiliar.

## El mecanismo se conserva

`pendingCatalog()` sigue en `packages/contracts/src/pending.ts` y su comportamiento fail-closed
sigue probado. Es la herramienta prevista para el próximo hueco: cuando el Maestro no resuelva
un catálogo necesario, se declara así en vez de inventar miembros, y la entrada correspondiente
se abre en `docs/blocked-by-spec.md` si además falta la decisión.
