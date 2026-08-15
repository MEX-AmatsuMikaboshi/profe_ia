# Plan.md — Profesor IA · Etapa 1

**Tipo:** plan de construcción ejecutable para implementación con alta autonomía (Claude Code / Codex).
**Fecha:** 14 de agosto de 2026.
**Nivel de autoridad:** 4 de 5 (ver §0.1). Este plan **no crea decisiones normativas nuevas**; transforma una especificación cerrada en tareas, pruebas, criterios de aceptación y gates.

---

## 0. Autoridad, fuentes y reglas de uso

### 0.1 Jerarquía documental vinculante

1. `Profesor_IA_Documento_Maestro_Normalizado_v2.12_PostUI_PrePlan.md` (**Maestro**; en adelante P-I, P-II, P-III y Apéndices A–F).
2. Anexos normativos expresamente reconocidos por el Maestro.
3. `Profesor_IA_Especificacion_UI_UX_v0.1_Conformada.md` (**UIUX**; subordinada, `DEC-UX-ARTIFACT-001`).
4. **Este `Plan.md`.**
5. Implementación.

Fuente visual de referencia (no autoridad funcional): `Mockups de interfaz educativa_v2.1.zip`
— SHA-256 ZIP `5b2b33360369cecd4a6862a9a597bf7c5525dd79d4ff750b8dbe1b6d286faae0`
— SHA-256 `Profesor IA - UX.dc.html` `e1e1b730ec8516158e3318367b5d6005246a3865baf444f1cfa73918d46229a0`
(ambos verificados contra los declarados por UIUX).

Ante cualquier contradicción prevalece la fuente de mayor autoridad y se corrige la inferior. Si este plan contradice al Maestro o a la UIUX conformada, el plan está mal y se corrige el plan.

### 0.2 Reglas de interpretación para el agente implementador

1. **No rediseñar Profesor IA.** No reabrir decisiones `CONGELADA` del Apéndice A. No proponer arquitecturas, modelos, esquemas ni políticas alternativas a las autorizadas.
2. **Benchmarks, calibraciones y mediciones futuras no son resultados conocidos.** Toda decisión `CONDICIONADA A BENCHMARK` o `CALIBRABLE` se implementa como *procedimiento + gate*, nunca como valor inventado. Los nombres de modelos/endpoints citados son **candidatos fechados (2026-08-13)** que se reverifican antes de benchmark/freeze (`DEC-MODEL-BINDING-001`).
3. **Datos ilustrativos de los mockups = no normativos** (UIUX §2). Nombres, materias de ejemplo, porcentajes, tiempos, costes, sesiones, métricas y estados simulados del HTML **no** se importan como defaults, thresholds, fixtures autoritativos ni criterios de aceptación.
4. **Cifras normativas solo del Maestro.** Todo umbral numérico de este plan proviene textualmente del Maestro y conserva su naturaleza declarada: *parámetro de aseguramiento/riesgo del proyecto*, no constante científica.
5. **Decisión faltante ⇒ no inventar.** Si durante la implementación aparece una decisión genuinamente necesaria no resuelta por ninguna autoridad superior, se registra:
   `BLOCKED_BY_SPEC — [decisión exacta faltante]`
   en `PLAN_STATUS.md` y en `docs/blocked-by-spec.md`, se continúa con el resto del plan y la decisión se resuelve por control de cambios del Maestro (Maestro §0.1.12), nunca por invención local.
6. **Palabras obligatorias.** «debe», «no puede», «se detiene», «se invalida», «falla cerrado» indican requisitos duros.
7. **Idioma.** Enseñanza, UI, rúbricas visibles, mensajes y artefactos operativos dirigidos al usuario: **español** (`DEC-LANGUAGE-001`). Los ids formales (`rule_id`, códigos de error, enums) nunca se traducen en trazas.
8. **Trazabilidad.** Cada tarea cita su norma (`decision_id` o sección del Maestro/UIUX). Este plan **no crea `decision_id` normativos nuevos**; los identificadores `T-*`, `CI-*`, `AC-*`, `PLAN-*` son identificadores de plan/ingeniería sin autoridad normativa.

### 0.3 Registro BLOCKED_BY_SPEC (estado inicial)

**Ninguno.** La auditoría de conformidad UIUX declaró «huecos funcionales nuevos: ninguno encontrado» (UIUX §12, clase E) y el Apéndice E del Maestro contiene únicamente pendientes con procedimiento y gate definidos (no bloquean la escritura de este plan). El archivo `docs/blocked-by-spec.md` se crea vacío en F0 y solo se llena conforme a §0.2.5.

**Única decisión delegada explícitamente a `Plan.md`** (UIUX §6.3, «trabajo en segundo plano tras cerrar la aplicación»): se resuelve aquí como decisión de plan `PLAN-UX-001` (no normativa): los trabajos de preparación/autoría (W0–W5, jobs `pg-boss`) **continúan mientras el stack Docker Compose local esté en ejecución, aunque la pestaña/navegador se cierre**; no se promete ejecución con la computadora apagada ni proceso residente fuera de Compose. La UI comunica exactamente eso. Compatible con local-first (P-II §0.3) y con la regla de propuestas no normativas (UIUX §10).

### 0.4 Convenciones del plan

- **Fases:** `F0…F16`, mapeadas a los hitos H0–H11 del Maestro (P-II §13) más `LOCAL_SELF_USE`, freeze final y análisis W12/W13.
- **Tareas:** `T-<hito>-<nn>` (p. ej. `T-H2-04`). Cada tarea: etiqueta, descripción, norma, prueba/verificación, artefacto.
- **Etiquetas:** `[CRITICAL]` (invariante cuya violación invalida el sistema/corrida), `[REQUIRED]` (necesaria para el gate de su fase), `[BENCHMARK]` (decide midiendo; BENCH-*), `[CALIBRATION]` (parámetro CAL-*/CALC-* fijado en su gate), `[PROFESSIONAL_GATE]` (requiere verificación externa/profesional; A.4), `[OPTIONAL]`, `[STAGE_2]`, `[PRODUCT]`.
- **Estados de tarea:** `PENDIENTE → EN_CURSO → HECHA → VERIFICADA` (VERIFICADA = sus checks CI/gate en verde) o `BLOQUEADA(razón)` / `BLOCKED_BY_SPEC`.
- **CI checks:** nombres `ci:<área>:<check>`; un criterio de aceptación que cite un check se considera cumplido solo con ese check en verde en `main`.

### 0.5 Qué NO hace este plan

No reabre: propósito, n=1, tres conjuntos, no rescate pedagógico, separación `LEARNING_MODE`/`MEASUREMENT_MODE`, autoridad IA/código/humano, `authorized-calculus-v1`, monolito modular, siete esquemas, local-first, veredictos, privacidad/minimización, ni ninguna decisión A.1. No anticipa resultados de BENCH-01…05, CAL-*, LIC/LEG/ETH/ACC ni H8–H11.

---

## 1. Resumen ejecutivo

**Qué se construye.** Un sistema local-first que permite a un «Profesor IA» preparar e impartir de forma autónoma una subunidad de deducción natural proposicional (formato Fitch, cálculo congelado `authorized-calculus-v1` anclado a *forall x: Calgary*), con: pipeline autónomo de investigación y autoría (W0–W5), verificador lógico determinista aislado, motor de sesión y política pedagógica deterministas, medición experimental aislada (SCED n=1, línea base múltiple con sondas múltiples entre tres conjuntos), evidencia append-only con integridad verificable, multimodalidad (texto, voz push-to-talk, pizarrón Excalidraw, anotaciones SVG, percepción visual auxiliar) y una experiencia funcional de cursos persistentes que incluye materias personalizadas `CUSTOM_COURSE_UNVALIDATED`.

**Cómo se decide.** La IA propone lenguaje y artefactos dentro de contratos cerrados; el **código** decide todo lo verificable (corrección formal, dominio, avance, modos, consumo de reservas, validez operacional, freeze, permisos); el **humano** autoriza y audita desde fuera, sin rescate pedagógico (P-I §2, `DEC-AUTHORITY-001`, `DEC-NORESCUE-001`).

**Orden de construcción.** H0 repos/CI → H1 BD/roles/auth → H2 verificador+proof search (camino crítico) ∥ H3 entorno local → H4 pasarela+benchmarks de modelo → H4.5 investigación de fuentes → H5 autoría+freeze de contenido → H6 sesión determinista sin LLM → H7 Profesor IA de sesión → cursos persistentes/personalizados → H8 prueba local multimodal+telemetría → `LOCAL_SELF_USE` y decisión GO/NO-GO → (solo si continúa) H9 gobernanza ∥ H10 piloto seco/restore/CAL-15 → freeze de preinscripción → H11 piloto real → W12/W13 auditoría, análisis y cuatro veredictos en orden **Integridad → Autonomía → Pedagogía → Viabilidad**.

**Entorno y restricciones del propietario.** Una sola PC (Windows 11, i5 8.ª gen, 16 GB RAM, >1 TB, sin GPU), Docker Compose, PostgreSQL 17 local, Perfil A por APIs comerciales; objetivo ≈ MXN 500/mes en APIs y **revisión explícita del propietario antes de superar MXN 700 acumulados** (gate de gasto, nunca permiso para degradar integridad); ~1 h/día de disponibilidad; sin fecha límite dura; máxima autonomía del agente implementador con criterios de aceptación automáticos (`DEC-OWNER-CONSTRAINTS-001`, `OWNER-*`).

**Entregable funcional del Bloque A:** el propietario usa el sistema completo en su PC (`LOCAL_SELF_USE`, funcional, no experimental). **Entregable del Bloque B:** piloto experimental formal H11 con participante elegible y cuatro veredictos.

---

## 2. Alcance

### 2.1 Dentro del alcance (Etapa 1)

- Curso experimental de referencia `VALIDATED_LOGIC_COURSE`: subunidad de deducción natural proposicional, tres conjuntos experimentales A/B/C sobre `authorized-calculus-v1`.
- Carril funcional `CUSTOM_COURSE_UNVALIDATED` (`DEC-CUSTOM-COURSES-001`): creación de materias personalizadas desde un sobre mínimo, con investigación/autoría generalizable, progreso persistente y etiquetado inequívoco de «no validado experimentalmente». No usa por defecto SCED, reservas experimentales ni el verificador formal salvo que el dominio lo requiera; **no bloquea** H2/H5/H8/H10/H11.
- Multimodalidad V1: texto canónico + TTS; STT push-to-talk con transcript `COMMIT`; pizarrón Excalidraw tras `whiteboard-adapter`; overlay SVG propio con targets semánticos; percepción visual auxiliar `observe/confirm/decline`; captura interna. Capacidades por corrida vía `capabilityFlags`.
- Un alumno adulto por sesión; sin calificación oficial; español.

### 2.2 Fuera del alcance (no construir; ver §14)

Clases grupales, menores, calificación oficial, cámara/biometría/inferencia emocional, proctorización, voz-a-voz opaca, full duplex/barge-in por defecto, manuscrito/visión como autoridad de calificación, captura externa silenciosa, LTI, RAG vectorial general/GraphRAG, crawler general, navegación web del agente de sesión, Kubernetes/microservicios/Redis, PostgreSQL gestionado/HA, GPU nueva, app móvil, panel institucional, pagos, empaquetado desktop definitivo, infraestructura remota antes de H8 (P-I §17; P-II §16.5).

---

## 3. Stack tecnológico autorizado

Estados: `CONGELADA` (se implementa así salvo incompatibilidad demostrable y documentada), `CONDICIONADA A BENCHMARK`, `DIFERIDA A ETAPA 2 / PRODUCTO`. Regla de reproducibilidad: las familias de versión son restricciones de compatibilidad; **la autoridad reproducible es `lockfile + SBOM + digests` de cada freeze** (`DEC-DEPENDENCY-FREEZE-001`, EXT-01). Cualquier versión con advisory de seguridad aplicable sin mitigación documentada bloquea su gate.

| Área | Tecnología autorizada | Familia de versión (verificar en freeze) | Estado |
|---|---|---|---|
| Lenguaje/runtime | TypeScript sobre Node.js | Node 24.x LTS (fallback 22.x); TS 5.9.x | CONGELADA |
| Frontend | Next.js + React, mayoritariamente presentación; **sin Server Actions para decisiones sensibles** | Next.js 16.x / React 19.x | CONGELADA |
| Backend | Fastify (plugins encapsulados, validación JSON Schema nativa) | 5.x | CONGELADA |
| Contratos | JSON Schema + Zod (un mismo contrato para HTTP, eventos y salidas de modelo) | Zod 4.x | CONGELADA |
| ORM/datos | Drizzle ORM (SQL-first, sin superusuario en runtime); respaldo Kysely | 0.4x.x | CONGELADA |
| Migraciones | SQL versionado con dbmate (roles, GRANT/REVOKE, triggers append-only); drizzle-kit solo diff de tablas; respaldo node-pg-migrate | dbmate 2.x | CONGELADA |
| Colas/jobs | pg-boss sobre PostgreSQL (sin Redis); respaldo Graphile Worker | 10.x | CONGELADA |
| Auth/MFA | Better Auth autoalojado: cuentas seudónimas, passkey/WebAuthn, TOTP administrativo, roles (alumno, auditor, responsable técnico, responsable de datos, investigador). Fallback definido: `@simplewebauthn/server` 13.x + `otplib` 12.x | 1.x | CONGELADA |
| Monorepo | pnpm workspaces + Turborepo + dependency-cruiser (reglas `forbidden` = pruebas arquitectónicas P-II §3.3); respaldo Nx | pnpm 10.x / Turbo 2.x / depcruise 16.x | CONGELADA |
| Pruebas/CI | Vitest + fast-check + Playwright + Testcontainers (PostgreSQL real) + StrykerJS `@stryker-mutator/vitest-runner`; GitHub Actions con Docker | exactas al freeze | CONGELADA |
| Despliegue | Docker Compose; sin Kubernetes ni microservicios | Docker Engine 27.x | CONGELADA |
| PostgreSQL | Autoalojado en Docker; 7 esquemas; un rol por servicio; `evidence` append-only | 17.x | CONGELADA |
| Pizarrón V1 | Excalidraw detrás de `whiteboard-adapter`; tldraw solo reevaluación futura | estable al freeze | CONGELADA |
| Overlay anotaciones | SVG propio + targets semánticos + `getBoundingClientRect()`/geometría de board | API web estándar | CONGELADA |
| Captura interna | Export del pizarrón + rasterización controlada del DOM (p. ej. `html-to-image`, a verificar) | al freeze | CONGELADA |
| Pasarela de modelo | Adaptadores propios TS+Zod; perfiles `SESION`/`AUTORIA` con credenciales separadas; **OpenRouter prohibido en piloto real** | — | CONGELADA |
| Modelo de sesión | Ganador de BENCH-01 entre candidatos fechados 2026-08-13: **Claude Sonnet 5** y **GPT-5.6 Sol**; requisitos duros: structured output + validación local, política de datos compatible H9, `model_binding` congelado, modo degradado | binding/huella al freeze | CONDICIONADA A BENCHMARK |
| Modelo autoría/crítica | Modelo de razonamiento de **proveedor distinto** al ganador de sesión; caché de prompt y Batch API bajo política de datos | snapshot al freeze | CONDICIONADA A BENCHMARK |
| Modelo económico | Tier mini/Haiku/Flash del proveedor ganador; solo CI, sesiones secas, clasificación barata, sin datos reales (Perfil C) | snapshot al freeze | CONDICIONADA A BENCHMARK |
| TTS | `speech-gateway`; benchmark inicial ElevenLabs Flash v2.5 vs OpenAI TTS | al freeze | CONDICIONADA A BENCHMARK |
| STT | `speech-gateway`; benchmark inicial Deepgram Flux Multilingual vs OpenAI streaming transcription; push-to-talk | al freeze | CONDICIONADA A BENCHMARK |
| Perfil visual | Operación `interpret_visual_context`; candidato OpenAI GPT-5.6 Sol (verificado 13-08-2026); Gemini solo fallback si benchmark de localización lo justifica | binding al freeze | CONDICIONADA A BENCHMARK |
| Modelo local (Perfil B) | Qwen3-14B GGUF Q5_K_M sobre llama.cpp, GBNF, `temperature=0`, seed fija; **después** de la primera corrida Perfil A | commit+hash al ejecutarse | CONDICIONADA A BENCHMARK |
| Secretos | Infisical autoalojado en Compose; inyección en runtime; **nunca `.env` versionado**; respaldo Doppler Team | estable al freeze | CONGELADA |
| Observabilidad | OpenTelemetry local desde desarrollo; dashboards externos solo con valor demostrado | OTel 1.x | CONGELADA |
| Backups | Locales simples en desarrollo; wal-g + almacenamiento externo + restore drill antes de piloto formal | al freeze | CONGELADA |
| Análisis experimental | Python + Jupyter sobre exportaciones seudonimizadas, fuera de la ruta de sesión | Python 3.13.x | CONGELADA |
| Hosting/almacenamiento remoto | Ninguno para prueba local. Futuro piloto remoto: Hetzner (Falkenstein/Núremberg) + DigitalOcean Spaces; sizing desde telemetría H8 (INFRA-01) | al activarse | CONGELADA (activación condicionada) |
| Logs/errores externos (Sentry), TLS/dominio (Caddy), correo (Resend) | — | — | DIFERIDA A PRODUCTO |
| GPU nueva / PostgreSQL gestionado-HA / Redis / K8s / LTI / RAG vectorial | — | — | DIFERIDA A PRODUCTO / ETAPA 2 |

---

## 4. Arquitectura

### 4.1 Vista general (P-II §2)

Monolito modular con procesos aislados (`DEC-ARCH-001`): cliente web (chat, voz, editor Fitch, pizarrón, anotaciones, plan, evidencia) → API de sesión autenticada → aplicación principal (orquestador, motor de sesión, motor de dominio, selector de bancos, calendario experimental, política de recuperación, registro de autonomía, pasarela de modelo + validador de salida, recuperación de corpus autorizado, bitácora append-only, gobernanza/identidad) → procesos aislados: **verificador** (sin red, sin LLM), **pipeline de autoría** (fuera de sesión), **measurement-worker** (aislado), y PostgreSQL con esquemas/roles separados. Almacén de soluciones y sondas **reservado e inaccesible** para el agente/web. Flujo multimodal: STT→transcript `COMMIT` y estado estructurado alimentan al `session-engine`; visión solo si falta estructura; el texto canónico validado precede a TTS y anotaciones SVG.

### 4.2 Monorepo `profesor-ia/` (P-II §3.1 — estructura obligatoria)

```text
profesor-ia/
├── apps/
│   ├── web/                     # alumno + consolas externas (Next.js)
│   ├── api/                     # orquestador y endpoints (Fastify)
│   ├── verifier/                # proceso aislado (logic-core runtime)
│   ├── authoring-worker/        # pipeline W0–W5 fuera de sesión
│   ├── measurement-worker/      # sondas y calendario aislados
│   └── background-worker/       # reportes, borrados y métricas
├── packages/
│   ├── contracts/               # JSON Schema + Zod compartidos
│   ├── logic-core/              # parser, AST, reglas, semántica, Fitch
│   ├── session-engine/          # máquina de estados de sesión
│   ├── domain-engine/           # dominio y recuperación
│   ├── pedagogy-policy/         # estrategias, modos, andamiaje, selección determinista
│   ├── evidence/                # eventos, hashes, checkpoints, proyecciones
│   ├── content-schema/          # contrato del paquete de contenido
│   ├── authoring-core/          # etapas y validadores del pipeline
│   ├── model-gateway/           # proveedores, bindings, filtros, cost-ledger
│   ├── speech-gateway/          # adaptadores TTS/STT y commits de transcripción
│   ├── visual-interaction/      # whiteboard-adapter, captura, coordenadas, anotaciones
│   ├── security-policy/         # matriz de permisos y canarios
│   └── experiment/              # freeze, calendario SCED, exportación, verdict-engine
├── content/
│   └── unidad-deduccion-natural/   # submódulo/repositorio separado (§4.3)
├── analysis/
│   ├── notebooks/  ├── synthetic-data/  └── reports/
├── infra/
│   ├── compose/  ├── database/  ├── backups/  └── runbooks/
└── docs/
    ├── gates/                   # actas de cierre H0…H11
    ├── blocked-by-spec.md
    └── plan/                    # PLAN_STATUS.md y trazabilidad
```

Módulos adicionales dentro de `logic-core` o paquete hermano: `proof-search/` (buscador) y `isomorphism-canonicalizer/` (**paquete separado**, prohibido en la ruta de verificación).

### 4.3 Repositorio de contenido `unidad-deduccion-natural/` (P-II §3.2 — estructura obligatoria)

```text
research/   (whitelist.yaml, candidates/, source-scores.yaml, conflicts.yaml,
             coverage-saturation.yaml, license-register.yaml, selection-manifest.yaml)
source/     (manifest.yaml, fragments/)
extracted/  (definitions.yaml, notation.yaml, rules.yaml, claims.yaml)
provenance/ (anchors.yaml, curricular-decisions.yaml)
kc/         (map.yaml, experimental-sets.yaml)
objectives/
pedagogy/   (strategy-catalog.yaml, selection-rules.yaml, assistance-policy.yaml,
             retrieval-spacing.yaml, shadow-metrics.yaml)
session-templates/
items/      (diagnostic/, guided-practice/, independent-practice/, recovery/,
             probes-baseline/, probes-intervention/, transfer/, retention/, replacement/)
hints/      rubrics/
solutions-private/      # NUNCA montado en contenedores del agente ni de web
golden-tests/  audits/  freeze-manifest.json
```

### 4.4 Base de datos: 7 esquemas y privilegios (P-II §9.2, §11.2; `DEC-PRIVILEGE-001`)

Esquemas exactos (no se crea un octavo): `identity`, `pedagogy` (incluye proyección de proveniencia `source/fragment/claim/curricular_decision/artifact/anchor`), `evidence` (append-only), `private_solutions`, `measurement`, `audit`, `operations` (incluye `pricing-manifest`, `cost-ledger`, jobs, estado W0/H4.5/H5).

Reglas duras: rol owner/migración separado del runtime; credenciales runtime sin `SUPERUSER`/owner sensible/`BYPASSRLS`, sin `SET ROLE` escalable, `PUBLIC` revocado donde corresponda; matriz ejecutable `servicio → esquema → tabla → operación`; `evidence` deniega `UPDATE`/`DELETE` a runtime; RLS solo como segunda capa. Separación de datos personales dentro de los 7 esquemas: identidad real + llave de vinculación aparte del expediente seudonimizado; artefactos suprimibles (texto libre/audio/imagen/captura) fuera de la cadena append-only, referenciados por ID/hash (P-I §14.4; P-II §9.1).

### 4.5 Invariantes técnicos (P-II §1 — cualquier implementación que los viole es inválida)

- **I-1** El agente no es el sistema de control: el modelo no decide corrección formal, transición, consumo de bancos, dominio, invalidación, freeze, permisos ni conservación.
- **I-2** El agente de sesión no puede leer soluciones (credenciales, permisos BD, procesos, dependencias de código y pruebas lo imponen).
- **I-3** Investigación/autoría ocurren fuera de sesión; en sesión no hay Internet libre, ni modificación de corpus, ni generación en caliente de reactivos puntuables.
- **I-4** La medición está aislada de la enseñanza (sondas/semillas invisibles para agente, práctica, ejemplos y perfil).
- **I-5** El estado no vive en el chat: máquina de estados persistente y reconstruible.
- **I-6** Toda evidencia es append-only; una corrección es un evento nuevo enlazado.
- **I-7** Toda salida factual está anclada a fragmentos autorizados; sin ancla no introduce reglas ni sustenta evaluación.
- **I-8** El freeze es ejecutable: comando que produce y firma un manifiesto verificable.
- **I-9** El fallo pedagógico no se convierte en escalamiento docente; no existe función «continuar como profesor».

Verificación permanente: reglas `forbidden` de dependency-cruiser + suite SQL negativa + pruebas de propiedad (ver §10, `CI-ARCH`, `CI-DB-NEG`).

---

## 5. Separación de autoridad IA / código / humano

### 5.1 Quién decide qué (P-I §4, P-II §7.2; `DEC-AUTHORITY-001`)

**El código (deterministas) decide:** validez de derivaciones (`logic-core` + oráculo semántico), modo pedagógico, selección de estrategia y nivel de ayuda (`pedagogy-policy`), dominio y elegibilidad de intentos (`domain-engine`; `masteryDisqualifying` recalculado por código, `DEC-HINT-AUTHORITY-001`), recuperación y límites, calendario/selección/consumo/validez operacional de sondas (`measurement-worker`, autoridad exclusiva en `MEASUREMENT_MODE`, `DEC-MEAS-AUTHORITY-001`), freeze, permisos, canarios, costos, veredictos (`verdict-engine` con tabla congelada).

**La IA (generativa) propone:** texto de explicación, reformulación, analogía, contenido lingüístico de la estrategia seleccionada, preguntas de autoexplicación en plantilla, clasificaciones dentro de enums permitidos, redacción de feedback desde resultados estructurados, candidatos de autoría y crítica, interpretaciones visuales `observe/confirm/decline`. Nunca cambia modo, estrategia, elegibilidad, nivel máximo de ayuda ni jerarquía de decisión (P-I §8.3.1).

**El humano (externo):** define el sobre experimental, autoriza corpus (`CORPUS_APPROVER`), autoriza inicio (gates), audita después sin intervenir, atiende seguridad/privacidad/retirada/apelación, corrige solo entre versiones. Prohibido en vivo: explicar, resolver, validar reglas, decidir avance, elegir ejemplos, dar pistas (P-III §12.2; `DEC-NORESCUE-001`).

### 5.2 Roles humanos y aprobadores de gates (P-I §14.1; `DEC-GOVERNANCE-ROLES-001`)

Roles canónicos: `SYSTEM_OWNER`, `CORPUS_APPROVER`, `TECHNICAL_AUDITOR`, `EXPERIMENT_AUDITOR`, `SECURITY_PRIVACY_RESPONSIBLE`, `PROFESSIONAL_REVIEWER`. Ningún modelo de IA puede ser `approver_role`. Quien produce evidencia bloqueante no la aprueba. H11 exige **al menos dos personas naturales distintas**.

| Gate/acción | responsible_role | approver_role |
|---|---|---|
| H2 cálculo/verificador | SYSTEM_OWNER | TECHNICAL_AUDITOR |
| H4/H8 bindings/capacidades | SYSTEM_OWNER | TECHNICAL_AUDITOR |
| W0/H4.5 autorización de corpus | sistema W0 / SYSTEM_OWNER | CORPUS_APPROVER |
| H5 freeze de contenido | SYSTEM_OWNER | EXPERIMENT_AUDITOR |
| H9 paquete de gobernanza | SECURITY_PRIVACY_RESPONSIBLE | EXPERIMENT_AUDITOR (+ PROFESSIONAL_REVIEWER donde aplique) |
| H10 seguridad/restore/ledger | SYSTEM_OWNER + SECURITY_PRIVACY_RESPONSIBLE | TECHNICAL_AUDITOR |
| H11 apertura de corrida real | SYSTEM_OWNER | EXPERIMENT_AUDITOR |
| Reinicio tras incidente sistémico | responsable de la causa | EXPERIMENT_AUDITOR + auditor de la clase |
| W13 emisión de veredictos | analysis-engine / SYSTEM_OWNER | EXPERIMENT_AUDITOR |

Las personas concretas se asignan en el `run-manifest`; el plan solo implementa la separación y el registro. Durante el Bloque A (auto-prueba funcional) el propietario puede ejecutar y auto-revisar; los gates que exigen aprobador independiente quedan `BLOQUEADA(aprobador pendiente)` hasta asignar la segunda persona para el Bloque B.

---

## 6. Workflows W0–W13 (mapa operativo → componente responsable)

| WF | Contenido esencial | Componente | Fase |
|---|---|---|---|
| W0 | Investigación y selección de fuentes: descubrir, registrar origen/versión/licencia, evaluar idoneidad, comparar claims (`formal_system_id` declarado), saturación calibrada, propuesta de corpus, autorización externa; rechazo→W0; agotamiento→`failed_no_authorizable_corpus` | authoring-worker (research) | F5 |
| W1 | Ingesta: hashes (verifica identidad con snapshot W0), licencia/origen, fragmentación con IDs estables, bloqueo de modificación | authoring-worker | F6 |
| W2 | Extracción y mapa: claims/definiciones/reglas/notación anclados; grafo KC tipado; ciclos; selección de conjuntos con validador de aristas | authoring-worker | F6 |
| W3 | Autoría automática: candidatos → pipeline determinista (orden a benchmarkear `prefiltro semántico → proof search`, BENCH-04) → certificado re-verificado por logic-core → complejidad → isomorfismo/duplicados → pistas → crítica (familia distinta) → filtros → reservas | authoring-worker | F6 |
| W4 | Auditoría previa por muestra (semilla, estratos, codebook) | audit + consola | F6 |
| W5 | Freeze: pruebas, manifiesto firmado, publicación, bloqueo de escritura, provisión con permisos mínimos | experiment | F6 |
| W6 | Inicio de sesión: auth, consentimiento, comparación de manifiesto, salud, estado, diagnóstico | api + session-engine | F7 |
| W7 | Enseñanza: motor fija LEARNING_MODE → pedagogy-policy selecciona → fragmentos autorizados → modelo ejecuta lingüísticamente → validador/anclaje/no-revelación → verificador clasifica → ajuste por política → evidencia | session-engine + gateway | F8 |
| W8 | Actividad formal: reactivo correcto, rúbrica visible, verificador decide, elegibilidad, feedback estructurado, filtro de egreso, evidencia | session-engine + verifier | F7–F8 |
| W9 | Sonda: measurement-worker abre probe_round, MEASUREMENT_MODE, agente/pistas deshabilitados, microbatería consumida atómicamente, sin feedback, validez operacional por reason codes | measurement-worker | F7 |
| W10 | Límite pedagógico: wheel_spinning, agotar ciclos, no dominio, recuperación, límite; no docente | session/domain-engine | F7–F8 |
| W11 | Incidente: detectar, clasificar (taxonomía canónica P-I §13), contener, preservar, validez, notificar, recuperar, corregir en nueva versión, regresión | evidence + ops | transversal |
| W12 | Auditoría posterior: censo+muestra, cegamiento, comparación, adjudicación, tiempo humano | audit-console | F16 |
| W13 | Análisis: exportar seudonimizado, integridad, gráficas, fases, cuatro veredictos, limitaciones | analysis + verdict-engine | F16 |

---

## 7. Frontend y UI/UX

### 7.1 Autoridad y fuente visual

La UIUX conformada gobierna presentación, interacción y navegación fina; **no puede** modificar autoridad, modos, dominio, reservas, veredictos, privacidad, privilegios, `model_binding`, gasto ni validez científica (UIUX §1). Los mockups son referencia visual; sus datos son ilustrativos (UIUX §2).

**Sistema visual de referencia v0.1:** dirección «sobrio/modernista» congelable (UIUX §3) materializada por el design system del ZIP (`ds/styles.css`, tokens `--color-*`, `--font-*` Archivo, `--space-*`, `--radius-*`=0, reglas de 2 px, acento único, `:focus-visible` accesible, iconos Lucide). Tarea F0: vendorizar `ds/styles.css` + `theme.json` como paquete `packages/ui-tokens` versionado. La paleta/marca puede iterar dentro de la UIUX sin tocar el Maestro; ninguna clase del DS altera comportamiento.

### 7.2 Arquitectura de información y rutas (`DEC-UX-FUNCTIONAL-001`; UIUX §4)

Agrupación de navegación (visual, no de permisos): **Estudiar** (Inicio, Mis materias, Detalle de materia/salón, Clase, Progreso) · **Preparar** (Crear materia, Preparación en curso, Curso preparado/revisión de propuesta) · **Sistema** (Investigación/Expediente del curso, Configuración, Consola técnica*, Consola de auditoría*) — *solo con rol autorizado.

Rutas propuestas (`apps/web`): `/` Inicio · `/materias` · `/materias/[id]` detalle/salón · `/materias/[id]/clase` · `/materias/[id]/progreso` · `/crear` · `/crear/[jobId]` preparación · `/investigacion/[courseId]` · `/configuracion` · `/consola/tecnica` · `/consola/auditoria`. Navegación lateral en vistas ordinarias; se reduce/oculta en Clase (UIUX §3).

### 7.3 Vistas (requisitos funcionales A; UIUX §6 + Maestro P-II §10)

- **Inicio:** materia activa, punto de retorno, `Continuar clase`, progreso operativo autorizado, próximos repasos si el motor los programó, materias en curso/preparación, estado de capacidades/proveedor secundario, coste real solo desde `cost-ledger`. Nunca infiere reglas desde porcentajes ficticios.
- **Mis materias:** distinción estructural `VALIDATED_LOGIC_COURSE` vs `CUSTOM_COURSE_UNVALIDATED`; etiqueta del curso de lógica separa estado técnico del paquete, estado de auditoría/benchmark y resultado experimental (solo si existe) — UI-CORR-01.
- **Crear materia / Preparación:** captura del sobre mínimo (materia, tema/subunidad opcional, nivel/perfil, objetivo personal, tiempo disponible, restricciones — P-I §3.1.2); proceso observable (estado, artefactos, fuentes/propuesta, mensajes comprensibles, errores/reintentos autorizados); nombres/número de etapas del mockup no normativos; comportamiento en segundo plano según `PLAN-UX-001`.
- **Detalle de materia (salón):** estructura, progreso, historial, dificultades, próxima actividad, estado de preparación, `Continuar clase`. Indicadores solo desde fuentes de verdad.
- **Clase (layout 7A congelado):** material/actividad protagonista; Profesor IA visible sin chat dominante; conversación textual reconstruible; voz según flags; editor Fitch; pizarrón según flag; anotaciones autorizadas; pistas solo en `LEARNING_MODE`; pausa; apelación; retirada; estado de guardado; información secundaria limitada. Variantes 7B/7C: no requisito (clase C).
- **Progreso:** dominado / en aprendizaje / pendiente, dificultades, historial, retención **medida** cuando exista, próximos repasos. Sin «retención estimada» ni automatismos de mockup.
- **Investigación/Expediente:** fuentes, aceptaciones/rechazos, objetivos, mapa KC, versiones, autoría, benchmarks reales, autonomía real, incidentes, costes reales, proveniencia; más denso/tabular que Estudiar; `Detalle técnico` sujeto a RBAC (UI-CORR-05); sin JSON crudo como interfaz principal.
- **Configuración:** conexiones/proveedores, voz/micrófono, accesibilidad, privacidad, almacenamiento, presupuesto, avanzadas; distingue configuración editable de desarrollo vs **congelada de corrida** (UI-CORR-06); pantalla de conexión de proveedores sin exponer secretos (backend inyecta vía Infisical).
- **Consolas técnica y de auditoría:** contenidos P-II §10.2–10.4 (salud, manifiesto, colas, respaldo, incidentes, versiones, latencias, consumo, TTS/STT/visión, capabilityFlags, canarios; bandeja de auditoría con cegamiento, juicio bloqueado, codebook, N_h/n_h/semilla, tiempos, adjudicación, exportación; panel de autonomía función×estado). Sin modo de intervención pedagógica en vivo.

### 7.4 Correcciones de conformidad UI-CORR-01…12 (requisitos verificables)

| ID | Requisito operativo | Verificación |
|---|---|---|
| UI-CORR-01 | «Validado» nunca equivale a benchmark técnico; tres estados visuales separados (paquete / auditoría-benchmark / experimental H11) | test UI + revisión de copys `ci:web:copy-lint` |
| UI-CORR-02 | Estado explícito de sonda: aviso comprensible, pistas deshabilitadas, sin feedback, agente sin autoridad de selección/tiempo/consumo, canales limitados por manifest, sin bancos/soluciones | Playwright `ci:e2e:measurement-mode` |
| UI-CORR-03 | Transcripción: edición libre pre-`COMMIT`; post-`COMMIT` corrección = evento enlazado, sin sobrescritura; acto puntuable → política de incidente/adjudicación | test evidencia + e2e voz |
| UI-CORR-04 | `No estoy de acuerdo` registra apelación/revisión posterior; ningún flujo de decisión humana en vivo; acceso inequívoco a retirada en contexto H11 | e2e apelación/retirada |
| UI-CORR-05 | Consolas separadas por autoridad; ningún toggle da acceso a soluciones/sondas/semillas/juicios cegados/identidad/secretos | pruebas RBAC negativas |
| UI-CORR-06 | En corrida formal: sin cambio libre de modelo; `model_binding` solo por procedimiento versionado; configuraciones congeladas visiblemente bloqueadas | e2e + prueba API 403 |
| UI-CORR-07 | Voz V1 = push-to-talk/micrófono por turno; escucha continua/full-duplex/barge-in etiquetados experimentales y apagados por defecto | revisión flags + e2e |
| UI-CORR-08 | Audio bruto del alumno OFF por defecto; no es preferencia ordinaria; activación exige finalidad+consentimiento+política de borrado (H9) | prueba de configuración + política |
| UI-CORR-09 | Evidencia mínima requerida no es desactivable; privacidad distingue opcional vs evidencia mínima; retirada sigue el procedimiento del Maestro | pruebas de settings |
| UI-CORR-10 | Exportación = autorizada por rol y finalidad, nunca fusión de almacenes | prueba de exportador |
| UI-CORR-11 | Presupuesto: consumo real, proyección, alertas y **gate**; ninguna opción evita la revisión explícita del propietario al superar el umbral vigente (MXN 700 acumulados) | prueba de gate de gasto |
| UI-CORR-12 | Estados de fallo muestran solo acciones del fallback realmente congelado; sin botón genérico de cambio de modelo/política en corrida formal | e2e fallos simulados |

### 7.5 Estados de interfaz obligatorios (UIUX §9)

Carga/preparación · curso no preparado · guardado · retorno tras pausa · error operacional · proveedor/API no disponible · micrófono no disponible · capability deshabilitada · modo degradado autorizado · `MEASUREMENT_MODE` · apelación registrada · retirada · configuración congelada · presupuesto cerca/en gate · permisos insuficientes · datos no disponibles/no evaluados. Gramática de error: 1) qué ocurrió, 2) qué se conserva, 3) qué acciones autorizadas existen. No se inventan fallbacks.

### 7.6 Accesibilidad baseline (Maestro P-II §10.5; UIUX §8) — exigible desde H8

Controles críticos (Fitch, micrófono, pistas, pausa, apelación, retirada) operables por teclado; foco visible, sin trampas; alternativa a arrastre en controles críticos (excepción documentada si esencial en pizarrón); targets compatibles con WCAG 2.2 SC 2.5.8; anotaciones con equivalente textual; escena del pizarrón navegable en DOM; notación lógica semántica (preferentemente MathML con capa de compatibilidad); `prefers-reduced-motion` respetado; estados con palabra además de color; registro de ayudas técnicas del participante. **No se declara conformidad WCAG 2.2 AA global**; H8 registra criterios verificados/no verificados/excepciones.

### 7.7 Componentes reutilizables (UIUX §11)

`CourseTypeBadge` (sello de tipo de curso), `MasteryState`, `TurnIndicator`, `PrepStages`, `ScopeNote`, `SessionSummary`, `StatusBar` proveedor/coste (solo datos reales), tablas densas de Investigación — siempre alimentados por estados autorizados.


---

## 8. Fases de implementación

Estructura por fase: **Objetivo · Dependencias · Tareas · Pruebas y controles · Criterio de aceptación (AC) · Entregables · Gate de cierre**. Bloque A = F0–F11 (núcleo funcional local + auto-prueba). Bloque B = F12–F16 (piloto formal). Los AC citan checks CI (§10) y umbrales del Maestro.

---

### F0 — H0 · Repositorio, contratos y CI

**Objetivo:** monorepo, repo de contenido, contratos compartidos y CI con reglas arquitectónicas ejecutables.
**Dependencias:** ninguna.

**Tareas**
- `T-H0-01 [REQUIRED]` Inicializar monorepo §4.2 (pnpm workspaces + Turborepo, TS 5.9 `strict`, Node 24 LTS pin en `.nvmrc`/engines). *Norma:* stack §3.
- `T-H0-02 [REQUIRED]` Crear repositorio/submódulo de contenido con el árbol §4.3 (carpetas vacías + `README` por carpeta + `freeze-manifest.json` placeholder). *Norma:* P-II §3.2.
- `T-H0-03 [REQUIRED]` `packages/contracts`: JSON Schema + Zod para, como mínimo: `EvidenceEvent` (P-II §9.1 literal), `PedagogicalDecision` (P-II §7.2.1), `ProbeRequest/ProbeDelivery/ProbeOpportunityResult` (P-II §6.3), `AnchoredSegment` (P-II §8.4), `VerificationResult` + códigos `E-*` (P-II §4.1.1), `ModelBinding`/`ModelCapabilities`, `pricing-manifest`/`cost_event`, `capabilityFlags` (7 flags P-II §5.7), `incident` (taxonomía P-I §13), `run-manifest`, `metrics-manifest`, `verdict-manifest` (esqueletos). *Norma:* `DEC-*` citadas.
- `T-H0-04 [CRITICAL]` dependency-cruiser con reglas `forbidden` que codifican P-II §3.3: model-gateway sin módulos de soluciones; web sin claves; authoring-worker sin sondas post-freeze; session-engine sin SDK de proveedor; verifier sin cliente HTTP; ruta de verificación sin canonicalizador de isomorfismo; visual-interaction sin verificador. *Norma:* I-1…I-9.
- `T-H0-05 [REQUIRED]` CI GitHub Actions con Docker: `ci:lint`, `ci:typecheck`, `ci:unit`, `ci:arch:depcruise`, `ci:db:testcontainers` (PostgreSQL real), `ci:build`.
- `T-H0-06 [REQUIRED]` Lockfile reproducible + SBOM (CycloneDX desde el árbol instalado) + verificación de licencias/advisories + prueba de drift (`ci:supply:sbom`, `ci:supply:drift`). *Norma:* `DEC-DEPENDENCY-FREEZE-001`, EXT-01.
- `T-H0-07 [REQUIRED]` CLI `profesor-ia` (esqueleto): `content validate`, `experiment freeze`, `ledger verify`, `restore drill` (stubs que fallan explícitamente hasta implementarse).
- `T-H0-08 [REQUIRED]` Andamiaje de seguimiento: `docs/plan/PLAN_STATUS.md`, `docs/gates/`, `docs/blocked-by-spec.md` (vacío), plantilla de PR con `T-*` obligatorio (§12).
- `T-H0-09 [REQUIRED]` `packages/ui-tokens`: vendorizar `ds/styles.css` + `theme.json` del ZIP de mockups como sistema visual de referencia v0.1 (§7.1). *Norma:* UIUX §3/§11.

**Pruebas:** todos los checks anteriores en un pipeline verde sobre un commit vacío funcional.
**AC:** `ci:*` de F0 en verde; depcruise falla ante una importación prohibida sembrada de prueba y pasa al retirarla.
**Entregables:** dos repos inicializados, contratos v0, CI, SBOM, CLI stub, tokens UI.
**Gate H0:** arquitectura mínima en verde. EXT-01 queda abierto por freeze (se cierra por freeze concreto con árbol real). *Acta:* `docs/gates/H0.md`.

---

### F1 — H1 · Base de datos, roles y autenticación mínima

**Objetivo:** 7 esquemas, matriz ejecutable de privilegios, evidencia append-only a nivel BD y auth de desarrollo.
**Dependencias:** F0.

**Tareas**
- `T-H1-01 [CRITICAL]` Migraciones dbmate: crear los 7 esquemas exactos (§4.4) y tablas iniciales mínimas por esquema (identity, pedagogy con proyección de proveniencia, evidence, private_solutions, measurement, audit, operations con pricing/cost/jobs). *Norma:* P-II §9.2.
- `T-H1-02 [CRITICAL]` Roles: `pg_owner_migrations` separado; un rol runtime por servicio (`svc_api`, `svc_session`, `svc_verifier`, `svc_authoring`, `svc_measurement`, `svc_background`, `svc_audit`); `REVOKE ALL ... FROM PUBLIC`; GRANT explícitos según matriz `servicio→esquema→tabla→operación` mantenida como dato en `packages/security-policy` y aplicada por migración generada. *Norma:* P-II §11.2; `DEC-PRIVILEGE-001`.
- `T-H1-03 [CRITICAL]` `evidence` append-only: triggers/reglas que deniegan `UPDATE`/`DELETE` a todo rol runtime; solo `INSERT`; `sequenceNumber` monótono por stream; columnas `previousHash/hash`. *Norma:* P-I §15.4; `DEC-LEDGER-001`.
- `T-H1-04 [CRITICAL]` Suite SQL negativa (`ci:db:negative`): por cada rol runtime, intentos prohibidos (leer `private_solutions`/`measurement` desde sesión/gateway; `UPDATE/DELETE` en evidence; `SET ROLE` escalado; acceso cruzado entre esquemas) deben fallar; se prueba también owner/`BYPASSRLS`/membresías cuando se use RLS. *Norma:* P-II §11.2, §14.4.
- `T-H1-05 [REQUIRED]` Better Auth autoalojado: cuentas seudónimas, passkey/WebAuthn + contraseña robusta, TOTP para roles administrativos, sesiones seguras, recuperación separada; roles de aplicación (alumno, auditor, responsable técnico, responsable de datos, investigador). *Norma:* P-I §14.2; P-II §11.1.
- `T-H1-06 [REQUIRED]` RLS como segunda capa donde aplique (filas por participante/sesión), con `FORCE ROW LEVEL SECURITY` probado; nunca frontera única de `private_solutions`/`measurement`.

**Pruebas:** `ci:db:negative` completo; Testcontainers con migraciones desde cero; prueba de que el runtime no es owner/superuser/BYPASSRLS.
**AC (gate H1 literal):** sesión/model-gateway sin acceso a soluciones; enseñanza sin acceso a sondas futuras; **cero** `UPDATE`/`DELETE` de evidencia con credenciales runtime; todas las pruebas negativas críticas en verde.
**Entregables:** migraciones SQL versionadas, matriz de permisos como código, suite negativa, auth mínima.
**Gate H1:** acta `docs/gates/H1.md`.

---

### F2 — H2 · Verificador y buscador de demostraciones  ⟨camino crítico⟩

**Objetivo:** `logic-core` implementa exactamente `authorized-calculus-v1`; buscador certificante; aseguramiento por golden set, PBT y mutation testing.
**Dependencias:** F0 (contratos); paralelizable con F3.

**Tareas**
- `T-H2-01 [CRITICAL]` Artefacto `authorized-calculus-v1` versionado y hasheado en `content/…/kc` + `packages/logic-core/calculus/`, transcrito **literalmente** de P-II §4.1.1: `formal_system_id=forallx-calgary-tfl`; snapshot Calgary Fall 2025 rev `8642250` (2026-07-18, PDF 1 562 067 bytes, SHA-256 `2a8fea85b358fb45ba7835dee5166b5990b7a7c11ad4dc6c41ebdd9a265c1888`); conectivos `¬ ∧ ∨ → ↔`, `⊥` átomo distinguido `v(⊥)=F`; binarios estrictos, **sin precedencia**, corchetes obligatorios salvo exteriores; política Etapa 1: `⊥` prohibido como premisa/supuesto inicial; primitivas `R,∧I,∧E,∨I,∨E,→I,→E,↔I,↔E,¬I,¬E,X,IP`; justificaciones `PR,AS`; derivada autorizada única `DNE` (elimina exactamente dos negaciones); whitelist cerrada. *Norma:* `DEC-CALCULUS-001/-SNAPSHOT-001/-RULES-001/-SEMANTICS-001/-SETS-001`.
- `T-H2-02 [CRITICAL]` Tokenizer + parser + AST de verificación con normalización **conservadora**: alias→canónico, espacios, corchete exterior, glyphs de corchetes, subíndices. Prohibidas en la ruta de verificación: conmutativa/asociativa/distributiva, DNE automática, NNF/CNF/DNF, expansión de `↔`, canonicalizador de isomorfismo.
- `T-H2-03 [CRITICAL]` Alias de entrada cerrados (tabla literal P-II §4.1.1): conectivos (`->`,`=>`→`→`; `/\`,`&`→`∧`; `\/`,`|`→`∨`; `<->`,`<=>`→`↔`; `~`,`!`→`¬`; `_|_`,`!?`,`#`→`⊥`); rechazados `>`,`-`,`and`,`or`,`not`,`y`,`o`,`no`; reglas (`⊥I`,`Contra`→`¬E`; `⊥E`,`EFQ`,`Explosión`→`X`; `RAA`,`Reductio`,`Prueba indirecta`→`IP`; `¬¬E`,`DN`→`DNE`; `MP`→`→E`; `CP`→`→I`; `Reit`,`Rep`→`R`; `Casos`→`∨E`). El alias **nunca** aparece como `rule_id` en trazas.
- `T-H2-04 [CRITICAL]` Parser de estructura Fitch + control de alcance/citas/descarga (reglas literales: `PR` solo nivel 0; `AS` solo primera línea de subprueba; citas hacia atrás; líneas de subpruebas cerradas inaccesibles; subprueba citada completa y accesible; conclusión final en profundidad 0 sin supuestos abiertos; subpruebas de una línea y descarga vacua permitidas; profundidad = parámetro de implementación).
- `T-H2-05 [CRITICAL]` Tabla de reglas versionada con las 14 formas autorizadas (P-II §4.1.1) y rechazo cerrado de todo lo demás (`DS`,`MT`,`DeM`,`LEM/TND`, reglas de reemplazo, `Taut Con`, etc.).
- `T-H2-06 [CRITICAL]` Códigos de error versionados exactos: `E-SYN-PARSE, E-SYN-PRECEDENCE, E-SYN-ALIAS, E-SYN-SYMBOL, E-RULE-UNKNOWN, E-RULE-FORBIDDEN, E-RULE-ARITY, E-RULE-SHAPE, E-RULE-MAINOP, E-REF-FORWARD, E-REF-CLOSED, E-REF-SUBPROOF-INCOMPLETE, E-REF-SUBPROOF-NESTED-CLOSED, E-STRUCT-AS-POSITION, E-STRUCT-PR-POSITION, E-STRUCT-OPEN-ASSUMPTION, E-STRUCT-CONCLUSION-DEPTH, E-SEM-UNSOUND-STEP` + `VerificationResult` con `firstInvalidStep`, regla mal aplicada, alcance/referencia, KC afectado, traza.
- `T-H2-07 [CRITICAL]` Oráculo semántico independiente: tabla de verdad clásica bivalente `v(⊥)=F`; asimetría literal (fallo semántico rechaza y abre incidente; éxito no certifica derivabilidad); `semanticCheck="not-applicable"` solo con razón prevista. `[CALIBRATION CALC-05/CAL-SAT-ROUTE]` cota tabla↔SAT y motor/versión SAT si se necesita.
- `T-H2-08 [CRITICAL]` `proof-search` (paquete de autoría, no de sesión): presupuesto primario determinista (nodos/estados/inferencias, orden y semilla fijados), timeout de pared solo salvaguarda registrada; estados `proof_found | semantically_invalid | search_budget_exhausted | no_proof_with_cost_at_most_k`; `no_proof_exists_in_calculus` **deshabilitado** (`decision_policy.no_proof_exists_in_calculus_enabled=false`) hasta `[CALIBRATION CALC-03]`; modo `heuristic` (`best_found`) y modo opcional `exhaustive_k` con solo podas conservativas y `minimalCostVerified` únicamente tras cubrir exhaustivamente costes < L; detección de metas triviales, ciclos/poda versionada, múltiples estrategias sin pretender enumeración total; **todo certificado se re-verifica con `logic-core`** antes de aceptar. *Norma:* `DEC-PROOF-001`; P-I §7.4; P-II §4.4. `[CALIBRATION CAL-PROOF-BUDGET/CAL-08]` parámetros congelados en H2/H5.
- `T-H2-09 [CRITICAL]` `isomorphism-canonicalizer` en paquete separado (renombrado de átomos + normalización estructural + `structural_signature`); regla depcruise impide su importación desde la ruta del verificador. `[CALIBRATION CAL-07/CAL-ISOMORPHISM]` precisión/recall en H5/H10.
- `T-H2-10 [CRITICAL]` Conjunto dorado en `content/…/golden-tests/` con pisos del Maestro (P-III §7.1): ≥100 derivaciones válidas, ≥100 inválidas, ≥50 alcance/subpruebas, ≥50 variantes equivalentes, ≥50 casos límite; + derivaciones válidas **generadas por construcción** con reglas autorizadas; + variantes de solución estructuralmente distintas; + regresiones de cada incidente. `[CALIBRATION CAL-04/CAL-GOLDEN-LOGIC]`.
- `T-H2-11 [CRITICAL]` PBT con fast-check (propiedades literales P-II §4.6/§14.2): `parse(print(ast))` conserva AST; renombrado biyectivo no cambia veredicto; línea cerrada nunca citable; construida-por-reglas ⇒ aceptada; aceptada ⇒ semánticamente válida; determinismo entrada/versiones; `firstInvalidStep` correcto; contraejemplos promovidos a golden. Perfil PBT registra semillas/distribución/política de interrupción; una interrupción incompleta no cuenta como éxito silencioso. Sin `numRuns` universal.
- `T-H2-12 [CRITICAL]` Mutation testing StrykerJS (runner Vitest) sobre `logic-core` y rutas críticas; antes del gate, todo mutante superviviente relevante eliminado por prueba o justificado equivalente/inaplicable; `thresholds.break` solo como no-regresión del baseline congelado.
- `T-H2-13 [REQUIRED]` Lexicón español canónico (P-II §4.1.1) versionado, separado de ids formales. *Norma:* `DEC-LEXICON-001`.
- `T-H2-14 [REQUIRED]` Cálculo de complejidad estructural sobre soluciones encontradas (longitud/garantía, reglas distintas, profundidad/subpruebas, premisas, conectivos, descarga/indirecta, coste/nodos sin interpretarlos como total de caminos, distancia estructural). Pesos y comparabilidad quedan `[CALIBRATION CAL-09]` para H5.
- `T-H2-15 [REQUIRED]` Propiedades de aislamiento del proceso `apps/verifier`: sin red (prueba de que no hay cliente HTTP ni sockets salientes), función pura, sin datos personales, reproducible, ejecutable masivamente.
- `T-H2-16 [BENCHMARK BENCH-04]` Arnés para comparar en L0 `prefiltro semántico → proof search` vs alternativas equivalentes (se ejecuta/congela en F6).

**Pruebas:** `ci:logic:golden`, `ci:logic:pbt`, `ci:logic:mutation`, `ci:logic:no-net`, `ci:arch:depcruise` (regla isomorfismo).
**AC (gate H2 literal):** implementación demuestra correspondencia con `authorized-calculus-v1`; **0 falsos positivos conocidos y 0 falsos negativos conocidos sin resolver** en el conjunto vigente; **0 discrepancias semánticas abiertas**; discrepancias `search_budget_exhausted` vs decisor explicadas; **ningún mutante crítico superviviente sin justificación**; proceso sin red y permisos sobre soluciones probados. Permanecen abiertos como validaciones: `CALC-03`, `CALC-05`, `CAL-04`, `CAL-08`.
**Entregables:** `logic-core`, `proof-search`, canonicalizador separado, golden set, manifiesto de validación del núcleo lógico.
**Gate H2:** `responsible=SYSTEM_OWNER`, `approver=TECHNICAL_AUDITOR`. Acta `docs/gates/H2.md`.

---

### F3 — H3 · Entorno local reproducible  ⟨paralelo a F2⟩

**Objetivo:** todo el sistema se levanta desde cero en la PC (Windows 11) sin hosting.
**Dependencias:** F0, F1.

**Tareas**
- `T-H3-01 [REQUIRED]` `infra/compose`: servicios `web`, `api`, `verifier`, `authoring-worker`, `measurement-worker`, `background-worker`, `postgres:17`, `infisical`; volúmenes locales; almacenamiento de artefactos local; logs estructurados locales.
- `T-H3-02 [REQUIRED]` Scripts `dev:up` desde cero, `dev:seed`, `dev:backup`, `dev:restore` (restauración básica de desarrollo).
- `T-H3-03 [REQUIRED]` Verificación del entorno del propietario: Windows 11 + Docker Desktop/WSL2 (build, compatibilidad, rendimiento base); documentar en `docs/env/windows.md`. *Norma:* P-II §0.4 (datos de planificación; H8 mide límites reales).
- `T-H3-04 [CRITICAL]` Hardening que el SO permita: usuario no root/rootless cuando sea viable, `no-new-privileges`, capabilities mínimas, seccomp no desactivado sin justificación, FS read-only salvo rutas explícitas, secretos por servicio vía Infisical, egress por función, **socket de Docker no montado** en servicios de aplicación, `solutions-private`/reservas solo montadas en procesos autorizados. Imposibilidades técnicas documentadas sin relajar las demás fronteras. *Norma:* P-II §11.5.1; H3.
- `T-H3-05 [REQUIRED]` OpenTelemetry local (traces/métricas a colector local) desde el arranque.

**Pruebas:** `ci:infra:compose-up` (arranque limpio + healthchecks), prueba de montajes prohibidos, prueba de egress (verifier sin salida).
**AC (gate H3 literal):** el sistema se levanta desde cero en la computadora sin servicios de hosting; hardening verificado o excepción documentada.
**Entregables:** compose, scripts, runbook `infra/runbooks/local.md`.
**Gate H3:** acta `docs/gates/H3.md`.

---

### F4 — H4 · Pasarela de modelo y benchmark

**Objetivo:** gateway con bindings/capacidades, validación fail-closed, costos reales y benchmarks de sesión y autoría.
**Dependencias:** F0–F3 (parcialmente paralelizable con F2: adaptadores sí; benchmark de sesión usa material de logic-core).

**Tareas**
- `T-H4-01 [CRITICAL]` `model-gateway`: adaptadores propios (candidatos Anthropic/OpenAI), operaciones **exactas** permitidas: `explain_block, rephrase_explanation, draft_worked_example, draft_completion_prompt, draft_self_explanation_prompt, classify_student_error, classify_question_scope, draft_feedback, create_authoring_candidate, critique_authoring_candidate, interpret_visual_context`. Perfiles `SESION`/`AUTORIA` con credenciales separadas. *Norma:* P-II §8.2.
- `T-H4-02 [CRITICAL]` `ModelBinding` + `ModelCapabilities` por candidato (endpoint/id exacto, parámetros soportados/rechazados, snapshot/alias/deprecación, structured outputs y límites, región/logging/retención/elegibilidad contractual conocida, reasoning, límites y códigos de fallo); el gateway **solo** envía parámetros declarados compatibles y falla localmente ante desconocidos; sin plantilla universal de petición. Huella de comportamiento sobre set canario congelado cuando no exista snapshot fechado. *Norma:* `DEC-MODEL-BINDING-001`; P-II §8.1–8.2.
- `T-H4-03 [CRITICAL]` Validación local fail-closed de toda salida: canonicalización determinista de enums (conservando valor bruto), clasificación separada `valid | schema_violation | truncated | refusal | provider_error`; nada estructurado del proveedor cruza sin validación local. Contract tests equivalentes por adaptador (`ci:gateway:contracts`). *Norma:* P-II §8.4.
- `T-H4-04 [CRITICAL]` Constructor de contexto de sesión por whitelist (fragmentos autorizados, estado mínimo, objetivo, modo, estrategia, nivel de ayuda, error estructurado, pista seleccionada); **sin** consultas a soluciones. Filtro de egreso (P-I §9.4): sin soluciones, sin canarios, sin identificadores innecesarios, fragmento del bloque, nivel de ayuda permitido.
- `T-H4-05 [CRITICAL]` Canarios (`security-policy`): cadenas en soluciones/sondas/claves con `canary_id`, clase, ubicación, versión, detector en contexto construido, payload saliente, salida, logs y exportes; hit ⇒ abortar + incidente + bloqueo de corrida. Cantidad/patrón/rotación calibrables; gate = **0 hits protegidos observados**. *Norma:* P-II §11.3.
- `T-H4-06 [REQUIRED]` `pricing-manifest` versionado + `cost-ledger` por llamada (etapa, operación, proveedor/binding, manifest id, tokens in/out/caché, unidades audio/imagen, intentos/reintentos/fallos, latencia local vs proveedor, costo calculado y reportado, ids seudónimos). Cambio de tarifa ⇒ nuevo `pricing_manifest_id`, nunca reescritura. *Norma:* `DEC-COST-001`; P-II §9.5.
- `T-H4-07 [REQUIRED]` Control de gasto (`OWNER-BUDGET-001`, UI-CORR-11): agregados desde cost-ledger; alerta al acercarse al objetivo ordinario (≈MXN 500/mes); **bloqueo de nuevas operaciones facturables al superar MXN 700 acumulados hasta registro de revisión explícita del propietario** (evento en ledger); el gate nunca degrada integridad.
- `T-H4-08 [REQUIRED]` Batch/caching como capacidades explícitas con matriz de elegibilidad por clasificación de datos; tráfico de participante jamás a modalidades con retención incompatible; hits/misses/TTL/costo al cost-ledger.
- `T-H4-09 [REQUIRED]` Refresco documental de candidatos (ids/endpoints/parámetros/deprecaciones/políticas de datos) **inmediatamente antes** del benchmark; registrar evidencia fechada.
- `T-H4-10 [BENCHMARK BENCH-01][CALIBRATION CAL-03/CAL-BENCH-GATES]` Benchmark de **sesión** (harness en `analysis/` + gateway): partición desarrollo/evaluación por semilla; pisos de familias (P-III §6.1): 50 explicaciones, 30 reformulaciones, 30 clasificaciones de error, 20 dudas fuera de alcance, 30 adversariales de extracción, 20 contexto incompleto, 20 caída/salida inválida; tamaño final y repeticiones congelados antes de mirar evaluación; evaluación contaminada se reemplaza. Gates (P-III §6.2, con `x/n`, cota unilateral en ceros, denominadores congelados): **0 fugas de solución; 0 invenciones de reglas no bloqueadas; ≥98 % respuestas estructuralmente utilizables tras 1 reintento (reportando schema/truncated/refusal/provider por separado); ≥95 % segmentos factuales con anclas resolubles; 100 % preguntas fuera de corpus declaradas/contenidas; 100 % recuperación determinista a modo degradado** (fallo aquí = bug bloqueante). Estabilidad intra-modelo entre repeticiones; muestra ciega de calidad pedagógica; defecto crítico bloquea el modelo.
- `T-H4-11 [BENCHMARK BENCH-02]` Benchmark separado de **autoría/crítica**: generador y crítico de **familias distintas**; concordancia con auditoría, sensibilidad a defectos críticos y **tasa de fallo correlacionado** sobre candidatos objetivamente defectuosos, estratificada por relación generador/crítico.
- `T-H4-12 [REQUIRED]` Modo degradado del gateway: perfil sin generación en vivo (explicaciones/ejemplos/pistas congeladas + feedback plantillado) conmutable y probado. *Norma:* P-II §8.6.

**Pruebas:** `ci:gateway:contracts`, `ci:gateway:fail-closed`, `ci:canary`, `ci:cost:ledger`, corrida de benchmark reproducible por semilla.
**AC (gate H4 literal):** al menos una configuración supera los gates preinscritos sobre evaluación **no contaminada**; manifest declara nivel de reproducibilidad (binding/estadística/funcional); ganadores solo por BENCH-01/02; ninguna cifra de latencia/costo anticipada.
**Entregables:** gateway + bindings, harness de benchmark, informes con denominadores, `model_binding` candidato-ganador, cost-ledger operativo.
**Gate H4:** `approver=TECHNICAL_AUDITOR`. Acta `docs/gates/H4.md`.

---

### F5 — H4.5 · Investigación y curación de fuentes (W0)

**Objetivo:** corpus candidato trazable y autorizable sin autoría docente.
**Dependencias:** F4 (perfil AUTORIA del gateway); F2 no bloqueante para descubrimiento.

**Tareas**
- `T-H45-01 [REQUIRED]` Estado W0 en `operations` con flujo literal: `solicitud_curso → alcance_acotado → fuentes_descubiertas → fuentes_evaluadas → fuentes_comparadas → licencias_clasificadas → cobertura_evaluada → propuesta_corpus → corpus_autorizado → W1_ingesta`; ramas `corpus_rechazado → W0_reinvestigacion` y `failed_no_authorizable_corpus`. *Norma:* P-I §7.0; `DEC-CORPUS-001`.
- `T-H45-02 [REQUIRED]` Descubrimiento de menor complejidad: `research/whitelist.yaml` de repositorios educativos/académicos autorizados; conectores/adaptadores con API/índice estable; búsqueda abierta solo complemento; **sin crawler general**; registro obligatorio URL/origen, versión, fecha, evidencia de licencia; snapshot/hash generado **en W0** (W1 verificará identidad).
- `T-H45-03 [REQUIRED]` `formal_system_id` objetivo declarado antes de comparar (`forallx-calgary-tfl`); ancla documental Calgary con el SHA del cálculo; fuentes de otro sistema = `sistema_formal_distinto`, sin voto por mayoría; clasificación de diferencias: contradicción real / convención alternativa / sistema distinto / diferencia pedagógica / complementaria. `authorized-calculus-v1` y el ancla **no cuentan como autonomía W0** (`DEC-W0-SCOPE-001`).
- `T-H45-04 [CALIBRATION CAL-05/CAL-SOURCE-SCORE + CAL-SATURATION]` `source_suitability_score` (autoridad, revisión, estabilidad, explicitud, verificabilidad, cobertura; licencia como gate separado) y regla de parada (tamaño base, racha, información nueva) con parámetros versionados calibrados con el corpus real; reporte con curva de información nueva y diversidad de linaje.
- `T-H45-05 [CRITICAL]` Licencias conservadoras (P-I §7.0): preferir CC0/CC BY; registro por recurso/versión/sección-componente (`source_component`, `source_version`, `provenance_basis`, `license_evidence`); NC/SA solo compatibles; ND sin base expresiva; comparación anti-reproducción sustancial; **caso Calgary:** material «used with permission» ⇒ `LICENSE_UNRESOLVED`, utilizable como fuente documental del cálculo pero **no** como base expresiva hasta LIC-01/LIC-02. *Norma:* `DEC-LICENSE-CONSERVATIVE-001`; `[PROFESSIONAL_GATE LIC-01/LIC-02]` (bloquean solo el componente afectado).
- `T-H45-06 [REQUIRED]` Salida W0 completa: `selection-manifest.yaml`, inventario autorizados/excluidos/`LICENSE_UNRESOLVED`/pendientes, snapshots/hashes, evidencias de licencia y cadena de atribución, scores, cobertura/saturación, conflictos y justificación.
- `T-H45-07 [REQUIRED]` Autorización externa: consola/CLI para que `CORPUS_APPROVER` autorice o rechace por alcance/seguridad/legalidad/gobernanza con `rejection_reason_code`; sin reescritura pedagógica humana.
- `T-H45-08 [REQUIRED]` Trazabilidad translingüe si entran fuentes no españolas: `source_text_original` + `translated_text` + idiomas + versión de traductor; NLI como gate solo por estrato demostrado (`CAL-NLI`). *Norma:* `DEC-LANGUAGE-001`.

**Pruebas:** replay determinista de una corrida W0 sobre fixtures; validación de manifests contra `content-schema`; prueba de bloqueo por licencia.
**AC (gate H4.5 literal):** corpus candidato **trazable y autorizable sin autoría docente**; todo recurso con licencia/evidencia registrada o marcado `LICENSE_UNRESOLVED`; parada por saturación calibrada documentada.
**Entregables:** `research/*` completo + propuesta de corpus + registro de autorización.
**Gate H4.5:** `approver=CORPUS_APPROVER`. Acta `docs/gates/H4.5.md`.

---

### F6 — H5 · Ingesta, construcción curricular, autoría y freeze de contenido (W1–W5)

**Objetivo:** paquete de contenido completo, validado, auditado por muestra y congelado sin autoría reactivo-por-reactivo.
**Dependencias:** F2, F4, F5.

**Tareas**
- `T-H5-01 [REQUIRED]` W1: carga, hashes (identidad con snapshot W0, bloqueo ante deriva), licencia/origen, fragmentación con IDs estables (`source/manifest.yaml`, `fragments/`), validación de legibilidad, bloqueo de modificación. Validaciones de bloqueo del corpus (P-III §3.2): contradicciones sin aclaración, notaciones incompatibles, KC sin cobertura, sin anclaje por fragmento, licencia no registrada, secciones faltantes.
- `T-H5-02 [REQUIRED]` W2 extracción (Rol A) con esquema cerrado: claims/definiciones/reglas/notación/restricciones + referencias exactas; tipos de claim `source_assertion | cross_source_consensus | system_inference`; `curricular_decision` aparte con soporte y justificación; anclaje estructural determinista. *Norma:* P-I §7.11.
- `T-H5-03 [REQUIRED]` Mapa de KC (Rol B): partir del catálogo P-I §5.2 (KC01–KC18 con dependencias tipadas literales, incl. `KC12 PC:KC10`, KC10 `rule_id="¬E"`, KC16 DNE derivada, KC17 IP primitiva, `¬I`≠`IP` separados); grafo `map.yaml` acíclico o ciclos justificados; validador que **enumera por separado aristas FORMAL y POLITICA_CONTENIDO cruzadas entre conjuntos**; fundamentos KC01/KC02/KC08 marcados pre-SCED (`DEC-FOUNDATION-001`), nunca objetivo A/B/C.
- `T-H5-04 [REQUIRED]` Objetivos observables, secuencia, perfil pedagógico por KC, matriz de activación de estrategias, política de ayudas/*fading* contingente, plan retrieval/spacing compatible con calendario, plantillas de sesión y de autoexplicación/feedback (Rol B) — todo en `pedagogy/` versionado. Catálogo exacto de estrategias P-I §5.10 (12) sin categorías nuevas con autoridad.
- `T-H5-05 [CRITICAL]` W3 generación (Rol C sin solución autoritativa) → validez determinista en el orden congelado tras `[BENCHMARK BENCH-04]` (preferencia inicial `prefiltro semántico → proof search`) → soluciones/certificados re-verificados por logic-core hacia `solutions-private/` → complejidad → duplicados/isomorfismos (canonicalizador + similitud contra ejercicios del corpus fuente) → pistas (Rol D, con propuesta `masteryDisqualifying` **no autoritativa** y explicación de no-revelación cuando proponga `false`) → crítica (Rol E, familia distinta, justificación estructurada; su acuerdo no certifica) → filtros → separación física de reservas.
- `T-H5-06 [CRITICAL]` Reservas sin solapamiento (P-I §7.7): diagnóstico, práctica guiada, práctica independiente, recuperación, sondas de línea base, sondas de intervención, `TRANSFER_MASTERY`, `TRANSFER_MEASUREMENT`, retención, reposición; disjuntas también por isomorfismo bajo la canonicalización congelada. `[CALIBRATION DUP-01/CAL-TRANSFER-ISOLATION]`.
- `T-H5-07 [CRITICAL]` `item_family_id` inmutable (`DEC-FAMILY-001`): pertenencia por `generator_template_id` + función de banco + KC objetivo + `structural_signature`; prohibida la reasignación tras conocer defectos.
- `T-H5-08 [REQUIRED]` Cobertura mínima (parámetros del proyecto, P-III §4.2): por KC ≥6 actividades operativas, ≥3 niveles de pista, ≥1 transferencia, reserva de recuperación, trazabilidad; por conjunto: sondas para el calendario completo + **reserva ≥20 %**, ≥1 transferencia por punto crítico, reserva de retención para 7 días (si no ⇒ declarar `retention_not_evaluated` antes de H11); capacidad de reconfirmación post-dominio por declaración de dominio. `[CALIBRATION CAL-01/CAL-BANK-KC, CAL-13/CAL-RETENTION-BANK]`.
- `T-H5-09 [REQUIRED]` Límites de regeneración (P-III §4.3): ≤5 intentos por candidato, ≤3 regeneraciones por familia antes de bloqueo, >30 % de rechazo automático ⇒ familia inestable fuera del paquete hasta rediseñar plantilla; el conteo alimenta prioridad de control de isomorfismo/agotamiento. Política de regeneración: causa registrada, sin reparación manual silenciosa, solo código de fallo + restricciones seguras al agente.
- `T-H5-10 [CALIBRATION CAL-09]` Fijar y congelar **en H5** pesos iniciales del índice de complejidad y criterio de comparabilidad (con corpus/soluciones/sintéticos; sin datos de participante). Obligatorio antes de seleccionar conjuntos y antes de H6.
- `T-H5-11 [CALIBRATION]` Fijar `k_set` y `min_valid_items_per_opportunity` de la microbatería SCED (`DEC-PROBE-ROUND-001`) y verificar cobertura del calendario.
- `T-H5-12 [REQUIRED]` Selección de conjuntos A/B/C (P-III §8): pipeline propone; validador comprueba dependencias (preferir sin aristas F/PC cruzadas; justificar las restantes sin romper interpretabilidad ni la regla de retención P-I §5.5); simulación del calendario; auditor solo revisa plausibilidad; dificultad comparable bajo criterio preinscrito (`[CALIBRATION]` banda o registro de diferencia, sin gates subjetivos); congelar selección. Los tres conjuntos referencian **la misma** `authorizedCalculusVersion`.
- `T-H5-13 [REQUIRED]` Linter de paquete `profesor-ia content validate ./content/unidad-deduccion-natural` con la lista completa P-II §5.5 (corpus íntegro, fragmentos referenciables, cálculo explícito/hasheado, correspondencia conjunto↔cálculo, mapa acíclico, cobertura, bancos separados, soluciones para todo puntuable, sondas/pistas/rúbricas suficientes, política pedagógica completa, scaffolding/fading válidos, retrieval/spacing compatible, separación de modos, sin duplicados/isomorfismos prohibidos, golden aprobado, auditoría registrada, versiones completas). Recalcula `masteryDisqualifying` autoritativo y **rechaza discrepancias** con la propuesta generativa.
- `T-H5-14 [REQUIRED]` W4 auditoría previa por muestra: selección por semilla, estratos KC×función×complejidad×tipo de regla×origen×subpruebas×riesgo; pisos 20 % por función, ≥5 por función cuando existan, ≥1 por KC; sobremuestreo de alto riesgo sin reducir pisos; registro `N_h, n_h`, fracción, semilla, probabilidad de inclusión, defectos por severidad; codebook versionado (crítico/mayor/menor con definiciones P-III §5.2). **Bloqueo del paquete si:** 1 defecto crítico, mayores >5 %, menores >15 %, una familia con ≥2 mayores, o estrato sin cobertura ⇒ regenerar familia completa + muestra nueva (sin corrección manual de solo lo visto). `[CALIBRATION CAL-AUDIT-PRE]`.
- `T-H5-15 [CRITICAL]` W5 freeze: `profesor-ia experiment freeze --content …` produce manifiesto JSON firmado con la lista completa P-II §5.7 (hashes, versiones de modelos/prompts, mapa, bancos, semillas, soluciones, rúbricas, pistas, verificador, complejidad, política pedagógica, elegibilidad, scaffolding/fading, retrieval/spacing, wheel_spinning, BKT si aplica, auditoría+codebook+muestreo, licencias por sección + atribución en cadena, plan SCED preinscrito, `capabilityFlags`, proveedores multimodales si habilitados, run id); publica paquete, bloquea escritura, provisiona permisos mínimos; **drift detectable** (`ci:freeze:drift`).
- `T-H5-16 [OPTIONAL]` BKT sombra: si se habilita, parámetros congelados, invisible al agente si sesga, sin autoridad (`DEC-BKT-001`, `CAL-11`).
- `T-H5-17 [CALIBRATION CAL-06/CAL-NLI]` Muestra dorada de groundedness tipo AIS estratificada por forma lógica; FP/FN por estrato; NLI como gate solo en estratos demostrados.

**Pruebas:** linter completo; pruebas de aislamiento de reservas (físico + isomórfico); pruebas de no-fuga (solución ausente de enunciado/pistas); replay determinista del pipeline por semillas; `ci:freeze:drift`.
**AC (gate H5 literal):** paquete congelado completo **sin autoría reactivo-por-reactivo**; H6 no abre si `CAL-09`, la definición de oportunidades SCED (`k_set`/mínimos) o la cobertura de reservas requerida siguen sin fijarse; auditoría dentro de umbral.
**Entregables:** repo de contenido poblado, paquete candidato, informe de auditoría previa, `freeze-manifest.json` firmado.
**Gate H5:** `approver=EXPERIMENT_AUDITOR`. Acta `docs/gates/H5.md`.

---

### F7 — H6 · Sesión determinista sin LLM

**Objetivo:** sesión seca completa y reconstruible con motor, dominio, medición y bitácora, en «modo guion» (sin generación en vivo).
**Dependencias:** F1, F2, F6 (paquete congelado o paquete sintético de desarrollo equivalente).

**Tareas**
- `T-H6-01 [CRITICAL]` `session-engine`: estados literales `preparada → autenticacion → consentimiento_confirmado → diagnostico → explicacion → comprobacion → practica → evaluacion_operativa → cierre` + transversales (pausa, duda, recuperación, sonda, fallo_pedagógico, incidente, invalidación, retirada); propiedades obligatorias del estado (`pedagogicalMode`, `selectedStrategy`, `assistanceLevel`, `masteryEligibility`, `wheelSpinning`, `masteryProbabilityShadow` si BKT). Estado estructurado completo P-I §8.2 persistido y reconstruible desde eventos (I-5). *Norma:* P-II §7.1.
- `T-H6-02 [CRITICAL]` `pedagogy-policy` determinista: contrato `PedagogicalDecision` literal (P-II §7.2.1) con las 10 estrategias del enum; tabla de transiciones **versionada y congelada por corrida** (datos, no prompts); jerarquía de decisión P-I §8.3.1; patrones base P-I §8.3.2 representables; *fading* contingente al desempeño; autoexplicación selectiva; retrieval/spacing solo por motor/calendario. `[CALIBRATION CAL-10/CAL-WHEEL]` umbral `wheel_spinning`.
- `T-H6-03 [CRITICAL]` `domain-engine` (`CAL-DOMAIN-POLICY/DUP-02` validan sin reabrir): dominio = 3 correctas consecutivas elegibles con complejidad no decreciente (índice CAL-09) + ≥1 transferencia cercana elegible; `masteryDisqualifying` **derivado por código** (nivel 1 no descalifica solo si recuerda objetivo/definición; niveles 2–5 descalifican; contenido decisivo descalifica aunque el generador diga otra cosa); acierto con ayuda decisiva exige reconfirmación; cada dominio crea `post_mastery_reconfirmation_pending` programada (primera oportunidad elegible en LEARNING_MODE, antes de reenseñar, con reserva de práctica independiente; ausencia válida = faltante, no falso dominio). *Norma:* P-I §5.3; `DEC-HINT-AUTHORITY-001`, `DEC-FALSE-MASTERY-SCHEDULE-001`.
- `T-H6-04 [CRITICAL]` Recuperación (P-I §8.7): ciclo 1 feedback+reexplicación/ejemplo+práctica guiada; ciclo 2 reducción de complejidad+prerrequisitos+scaffolding; ciclo 3 representación alternativa+autoexplicación+comprobación; agotados ⇒ KC no dominado + recuperación posterior si hay reserva; **máximo 2 episodios posteriores por KC** (`recovery_episode_count[kc_id]`); tras 2 fallidos ⇒ límite pedagógico observado y cierre de rutas dependientes. Sin endpoint `request_human_teacher` (I-9). *Norma:* `DEC-RECOVERY-SCOPE-001`.
- `T-H6-05 [CRITICAL]` Pistas: banco congelado, 5 niveles (P-I §8.6), registro de nivel + bandera recalculada por intento; nunca pista→solución silenciosa; en `MEASUREMENT_MODE` deshabilitadas.
- `T-H6-06 [CRITICAL]` `measurement-worker` aislado con contratos `Probe*` literales; autoridad exclusiva sobre calendario/reserva/ítem/semilla/consumo atómico/tiempo/fase/validez operacional (`valid|invalid|missing` + reason code); entrega **un ítem a la vez** de la microbatería; sin pistas ni feedback; el motor solo solicita `experimentalSet/phase/measureKind` y entra/sale de modo. *Norma:* `DEC-MEAS-AUTHORITY-001`; P-II §6.
- `T-H6-07 [CRITICAL]` Calendario SCED (`packages/experiment`): `probe_round` global; ventanas A `6–8`, B `9–11`, C `12–14` sobre rondas válidas; punto planificado por **semilla congelada**; separación mínima `3`; regla de elegibilidad de inicio (3 últimas obs. no estrictamente crecientes y 2 últimas no máximos históricos sucesivos); diferimiento ronda a ronda, extensión máx. `2` sin exceder ventana; ronda válida solo si todos los conjuntos requeridos producen observación válida; oportunidad bajo `min_valid_items` ⇒ `schedule_invalid`; transferencias/retención/familiarización/diagnóstico/reconfirmaciones **no** avanzan ventanas; retención por conjunto a 7 días desde `set_mastery_timestamp` con reserva exclusiva (sin reenseñanza dirigida en el intervalo); covariación registrada. *Norma:* `DEC-BASELINE-001`, `DEC-PROBE-ROUND-001`, `DEC-RETENTION-UNIT-001`, P-I §5.5/§10.2.1; P-III §9.3.
- `T-H6-08 [CRITICAL]` Interrupciones en `MEASUREMENT_MODE` (P-II §7.1.1, `DEC-MEAS-INTERRUPTION-001`): pausa pre-ítem no consume; pausa post-ítem ⇒ consumido + `invalid_participant_pause` sin feedback; duda de contenido sin respuesta pedagógica ni extensión de reloj; `timeout` por rúbrica; fin de sesión ⇒ `missing_session_time`; retirada ⇒ `withdrawal` sin reposición forzada; incidentes por taxonomía.
- `T-H6-09 [CRITICAL]` Bitácora: emisión de `EvidenceEvent` para cada acto con `previousHash/hash`, `decisionMaker`, `autonomyStatus`, `versions`, `validity`; correcciones = eventos enlazados (detección→clasificación→invalidación→reposición→resolución, P-II §9.6); proyecciones reconstruibles (sesión, dominio, cobertura, estrategia, elegibilidad, wheel_spinning, intervención, carga, incidentes, resultados) (P-II §9.4).
- `T-H6-10 [REQUIRED]` Clasificación de dudas (enums `current_block | blocking_prerequisite | later_in_unit | outside_corpus | unsafe_or_disallowed | insufficient_anchor`); el modelo propone (en F8), el motor aplica.
- `T-H6-11 [REQUIRED]` Exposición externa al inicio de sesión (`DEC-EXPOSURE-001`): captura `NONE | UNRELATED_OR_FOUNDATION | TARGET_KC_EXPOSURE | DIRECT_ITEM_EXPOSURE` con efectos literales P-I §10.8 (incl. techo/suelo `NOT_INTERPRETABLE_CEILING/FLOOR`).
- `T-H6-12 [REQUIRED]` `foundation_phase` (KC01/KC02/KC08) pre-SCED con materiales fuera de reservas A/B/C; criterio de suficiencia preinscrito; `foundation_not_ready` bloquea inicio experimental sin enseñanza humana. *Norma:* P-I §5.2.1.
- `T-H6-13 [REQUIRED]` Interfaz mínima de Clase para operar la sesión seca: chat textual de guion, **editor Fitch estructurado** (notación, resaltado de líneas/subpruebas, historial, exportación, validación sintáctica local **no autoritativa**, veredicto en servidor), rúbrica visible, pistas, pausa, aviso de sonda (UI-CORR-02), apelación/retirada, estado de guardado. *Norma:* P-I §8.9; UIUX §6.5.
- `T-H6-14 [REQUIRED]` Modo guion/degradado de sesión completo (contenido congelado, feedback plantillado) para sesiones secas y fallback.

**Pruebas:** sesión seca E2E con datos sintéticos (`ci:e2e:dry-session`) reconstruible desde eventos; propiedades: reactivo consumido no reaparece; sonda nunca en contexto del agente; dominio no se alcanza sin transferencia; corrección no elimina original; intervención humana registrada; separación de modos (`ci:mode-separation`).
**AC (gate H6 literal):** **sesión seca completa reconstruible** (estado final = replay de eventos); pruebas de modos y de autoridad de `measurement-worker` en verde.
**Entregables:** motores + measurement-worker + calendario + UI mínima de clase + suite de sesión seca.
**Gate H6:** acta `docs/gates/H6.md`.

---

### F8 — H7 · Profesor IA de sesión (con LLM)

**Objetivo:** sesión local completa conducida por el modelo ganador, con anclaje, filtros, estrategias y modo degradado, sin rescate docente.
**Dependencias:** F4 (ganador BENCH-01), F6, F7.

**Tareas**
- `T-H7-01 [CRITICAL]` Integración del binding ganador vía gateway en el bucle W7 literal (motor→política→fragmentos→modelo→validador→alumno→verificador→ajuste→evidencia).
- `T-H7-02 [CRITICAL]` Anclaje obligatorio (I-7): `AnchoredSegment` con anchors resolubles a fragmentos del bloque; salida no anclada = acompañamiento no factual, sin reglas/definiciones nuevas ni sustento de evaluación; registrada para auditoría. Validador rechaza: anchors inexistentes, símbolos no autorizados, instrucciones contra el cálculo, solución/canario, fuera de esquema.
- `T-H7-03 [CRITICAL]` No revelación en actividad puntuable (P-I §9.6) + filtro de egreso activo en cada llamada; pruebas adversariales de extracción/injection del alumno (`ci:adversarial:session`, lista P-II §14.4 aplicable a sesión).
- `T-H7-04 [REQUIRED]` Ejecución lingüística de estrategias seleccionadas: explicación, reformulación, ejemplo trabajado, completion, práctica, autoexplicación (plantillas), feedback desde salida estructurada del verificador; clasificación de dudas y de errores del alumno dentro de enums.
- `T-H7-05 [REQUIRED]` Adaptación dentro de límites: cambio de representación al fallar explicación, ajuste de tiempo/práctica/andamiaje **solo** por reglas congeladas; sin avance por autoafirmación.
- `T-H7-06 [CRITICAL]` Modo degradado en vivo: caída de proveedor ⇒ continuar solo con contenido congelado, evento registrado, desviación si altera la condición; **100 % de recuperación determinista** en simulaciones (gate BENCH ya probado en F4, ahora en el bucle real).
- `T-H7-07 [REQUIRED]` Voz/pizarrón **aún no** (llegan en F10); Clase opera texto+Fitch.

**Pruebas:** `ci:e2e:live-session` (sesión completa local con presupuesto mínimo de tokens, perfil C para CI), `ci:adversarial:session`, canarios en contexto/salida.
**AC (gate H7 literal):** pruebas adversariales en verde y **sesión local completa sin rescate docente** (ninguna ruta de intervención pedagógica disponible/usada).
**Entregables:** Profesor IA de sesión operativo texto+Fitch.
**Gate H7:** acta `docs/gates/H7.md`.

---

### F9 — Cursos persistentes y materias personalizadas (`CUSTOM_COURSE_UNVALIDATED`)

**Objetivo:** experiencia funcional multi-materia con progreso persistente y carril personalizado etiquetado; **no bloquea gates experimentales** (`DEC-CUSTOM-COURSES-001`; Apéndice D paso 11).
**Dependencias:** F5–F8 (reutiliza pipeline generalizable y motores). Paralelizable con F10 en lo no compartido.

**Tareas**
- `T-CC-01 [REQUIRED]` Modelo de datos de cursos: `course_id`, tipo (`VALIDATED_LOGIC_COURSE | CUSTOM_COURSE_UNVALIDATED`), estado de preparación, progreso persistente, continuidad entre sesiones (`OWNER-CONTINUITY-001`).
- `T-CC-02 [REQUIRED]` Flujo Crear materia: sobre mínimo (materia, tema/subunidad opcional, nivel/perfil, objetivo personal, tiempo disponible, restricciones) → W0 generalizado → propuesta de curso → crear materia → iniciar/continuar clase (UIUX §5.2). Preparación observable (estado, artefactos, mensajes, errores/reintentos); comportamiento de fondo según `PLAN-UX-001`.
- `T-CC-03 [CRITICAL]` Aislamiento experimental: los datos/eventos de cursos personalizados **no** entran a reservas, `probe_round`, métricas primarias ni análisis SCED de lógica; proyecciones separadas.
- `T-CC-04 [CRITICAL]` Autoridad de evaluación por dominio: cuando no exista verificador determinista específico, la evaluación se limita a mecanismos compatibles con la autoridad disponible y **no finge equivalencia con `logic-core`**; sin LLM-juez como sustituto por defecto (P-I §3.1.2, §16.3).
- `T-CC-05 [REQUIRED]` UI: etiquetado inequívoco «funcional, no validado por este experimento» (`CourseTypeBadge`), UI-CORR-01 aplicada; vistas Inicio/Mis materias/Detalle/Progreso completas para ambos carriles.

**Pruebas:** e2e crear-materia→propuesta→clase; prueba de aislamiento de datos (consultas cruzadas fallan); revisión de copys.
**AC:** materia personalizada creada, enseñada y persistida de extremo a extremo; cero mezclas con datos SCED (prueba automática); etiquetas correctas.
**Entregables:** carril personalizado funcional.
**Gate:** revisión funcional del propietario; no condiciona H8–H11.

---

### F10 — H8 · Prueba funcional local multimodal + telemetría  ⟨primera integración voz+pizarrón⟩

**Objetivo:** integrar y medir voz, pizarrón, anotaciones y percepción; línea base de accesibilidad; telemetría de recursos y costos reales; puertas multimodales.
**Dependencias:** F7/F8; adaptadores pueden desarrollarse en paralelo desde F4.

**Tareas**
- `T-H8-01 [REQUIRED]` `speech-gateway` STT: push-to-talk; parciales solo UI; transcripción final `COMMIT` con cruda+normalizada+versión del normalizador (determinista, reversible, solo notación/variantes autorizadas; no corrige razonamiento); corrección libre pre-`COMMIT`, post-`COMMIT` = evento enlazado (UI-CORR-03); léxico de sesión desde estado congelado (keyterm prompting cuando el proveedor lo soporte; nunca desde instrucciones del alumno). Candidatos: Deepgram Flux Multilingual vs OpenAI streaming (reverificar). *Norma:* P-I §8.10; `DEC-VOICE-001`.
- `T-H8-02 [REQUIRED]` `speech-gateway` TTS: pipeline texto canónico validado→TTS streaming; pausa/interrupción sin alterar texto; caída de TTS = presentación, no decisión; **lexicón de verbalización** por `authorizedCalculusVersion` validado por reconstrucción exacta de fórmulas; pausas pedagógicas como órdenes estructuradas. Candidatos: ElevenLabs Flash v2.5 vs OpenAI TTS.
- `T-H8-03 [REQUIRED]` `whiteboard-adapter` sobre Excalidraw (`DEC-WHITEBOARD-001`): canvas con texto/dibujo/flechas/formas/imágenes/zoom/borrado; IDs estables, estado estructurado, actor por elemento, referencia a actividad/KC, snapshots/operaciones reconstruibles sin trazar el puntero; eventos `board.element.*`, `board.scene.snapshot`.
- `T-H8-04 [CRITICAL]` Estado estructurado antes que visión (P-I §8.9.1): lectura de estructura primero; percepción solo para manuscrito/dibujo semántico/imagen importada/región ambigua/captura autorizada; política visual `observe | confirm | decline` con umbrales calibrados sobre conjunto dorado propio; registro de **errores confiados**; ningún score visual autoriza veredicto formal (`DEC-VISION-001`). `[BENCHMARK BENCH-03][CALIBRATION CAL-MULTIMODAL]`.
- `T-H8-05 [CRITICAL]` Overlay SVG de anotaciones (P-I §8.9.2): primitivas `point, highlight, circle, arrow, underline`; targets semánticos estables (`fitch-line:4`, `hint-button`, `kc-definition:KC06`, `board`); el modelo decide **qué**, el frontend resuelve **dónde** (DOM/estado); visión solo sin target lógico; marcos `viewport_css | board_scene | capture_pixel | normalized`; revisión monotónica por superficie + `surfaceRevision` + `maxAgeMs` calibrada ⇒ rechazo duro de coordenadas obsoletas; transformaciones con DPR/zoom/scroll cubiertas por PBT ida/vuelta dentro de tolerancia; equivalente textual accesible por anotación.
- `T-H8-06 [REQUIRED]` Captura interna (`html-to-image` a verificar): regiones propias, excluyendo por defecto overlays del Profesor IA y capas sensibles; export del pizarrón preferido; `externalScreenCapture` experimental, OFF, acción explícita (P-II §11.6); artefactos con hash referenciados por eventos `visual.*`.
- `T-H8-07 [CRITICAL]` Clasificación de fallos con evidencia: `PERCEPTION_ERROR | INTERFACE_ERROR | ACCESSIBILITY_ERROR | CONCEPTUAL_ERROR`; 1–3 no consumen intento elegible ni cuentan como fallo de KC; `CONCEPTUAL_ERROR` solo descartadas las otras; pendiente-para-auditoría permitido. *Norma:* `DEC-FAILURE-ATTRIBUTION-001`; P-I §8.9.3.
- `T-H8-08 [REQUIRED]` Evidencia multimodal en el ledger existente (familias literales P-II §9.3: `speech.*`, `tts.*`, `board.*`, `visual.*`, `annotation.*`, correcciones); replay multimodal (estado+captura+versión+prompt+modelo+salida reconstruibles).
- `T-H8-09 [REQUIRED]` Telemetría H8 (P-II §13-H8): CPU media/p95/máx, RSS, memoria host, I/O, disco y crecimiento, conexiones PG, queries lentas, profundidad/edad de colas, latencia E2E, latencia local vs proveedor separadas; alimentar `pricing-manifest`/`cost-ledger` con uso real, reintentos, fallos; límites de Compose y sizing de VPS **después** de esta telemetría (`INFRA-01`, `CAL-12`).
- `T-H8-10 [REQUIRED]` Línea base de accesibilidad (§7.6) ejecutada y documentada: criterios verificados/no verificados/excepciones; registro de ayudas técnicas del participante. Sin declaración WCAG AA global. `ci:a11y:baseline` (axe/Playwright sobre vistas críticas + pruebas de teclado).
- `T-H8-11 [CALIBRATION CAL-14/CAL-FAMILIARIZATION]` Criterio observable de suficiencia de familiarización (tareas de interfaz no experimentales consecutivas sin error de interfaz/ayuda/corrección, patrón inicial P-III §2.2) calibrado y preinscrito.
- `T-H8-12 [BENCHMARK BENCH-03]` Puertas multimodales (P-III §6.3): **STT** WER/CER diagnóstico, error de términos del léxico, latencia, tasa de corrección y —métrica de aceptación principal— tasa de decisiones pedagógicas que cambiarían por error de transcripción (replay offline contra la política determinista); **TTS** reconstrucción exacta de fórmulas desde audio, interrupción con preservación de texto/eventos, latencia/costo E2E, degradación a texto sin cambio de decisión; **Visión/anotaciones** interpretación y abstención correctas por estrato, error confiado siempre reportado, replay geométrico, rechazo de obsoletas y **0 rutas arquitectónicamente posibles** de `visual-interaction` hacia veredicto formal (prueba de propiedad + depcruise). Umbrales locales calibrados y congelados; sin importar WER/latencias externas como requisitos.
- `T-H8-13 [REQUIRED]` `capabilityFlags` de la corrida H8 (config inicial recomendada, P-II §13-H8): `voiceInput=true, voiceOutput=true, whiteboard=true, visualBoardInterpretation=true, uiAnnotations=true, internalUiCapture=true, externalScreenCapture=false`.
- `T-H8-14 [REQUIRED]` Corrida funcional E2E del desarrollador con curso de lógica + curso personalizado, clasificando fallos de autonomía; bugs y UX al backlog.

**Pruebas:** `ci:coords:pbt` (ida/vuelta), `ci:annotations:staleness`, `ci:visual:no-verdict`, `ci:a11y:baseline`, replays STT offline, suite BENCH-03.
**AC (gate H8 literal):** decisión explícita **continuar / abandonar / rediseñar**; benchmarks multimodales y línea base de accesibilidad aprobados con umbrales preinscritos; **cero rutas de visión a veredictos formales**; capacidades/proveedores que superaron H8 congelados; telemetría y costos reales registrados.
**Entregables:** multimodalidad integrada, informes BENCH-03, informe de accesibilidad, informe de telemetría/costos, decisión H8.
**Gate H8:** `approver=TECHNICAL_AUDITOR` (bindings/capacidades). Acta `docs/gates/H8.md`.

---

### F11 — `LOCAL_SELF_USE` + decisión GO/NO-GO del Bloque B

**Objetivo:** el propietario usa el sistema completo como primera experiencia real; se decide financiar/continuar el piloto formal.
**Dependencias:** F9, F10.

**Tareas**
- `T-LSU-01 [REQUIRED]` Corrida funcional del propietario extremo a extremo (curso de lógica + al menos una materia personalizada), datos marcados **funcionales/desarrollo**; produce telemetría y costos, **no** evidencia experimental (`DEC-LOCAL-SELF-USE-001`; P-III §0).
- `T-LSU-02 [REQUIRED]` Informe de valor: fallos, costos por sesión reales, UX, autonomía observada (matriz función×estado descriptiva), decisión documentada continuar/abandonar/rediseñar.
- `T-LSU-03 [REQUIRED]` Backlog de correcciones no sustantivas antes del Bloque B (cambios sustantivos ⇒ nueva versión).

**AC:** corrida completa sin intervención pedagógica; informe emitido; decisión registrada por el propietario.
**Entregables:** informe `docs/gates/LOCAL_SELF_USE.md`.
**Gate:** GO ⇒ abre F12/F13; NO-GO ⇒ preservar componentes reutilizables (`OWNER-REUSE-001`: `logic-core`, editor Fitch, autoría generalizable con fronteras limpias) y cerrar ordenadamente.

---

### F12 — H9 · Gobernanza para participante real  ⟨Bloque B; paralelizable con F13⟩

**Objetivo:** paquete de gobernanza completo, probado y congelado antes de cualquier dato personal de tercero.
**Dependencias:** F11 GO. *Norma:* P-II §13-H9; P-I §14.

**Tareas**
- `T-H9-01 [REQUIRED]` Inventario de tratamientos: `categoria_de_dato → finalidad → base → almacén → encargado/tercero → plazo → disparador_de_bloqueo → método_de_supresión`.
- `T-H9-02 [REQUIRED]` Aviso de privacidad integral + versión simplificada coherente (marco LFPDPPP vigente 2025; responsable, contacto, finalidades, categorías, derechos, cambios, cláusula de transferencia cuando exista tercero real).
- `T-H9-03 [REQUIRED]` Consentimiento informado de investigación **separado** con los 12 contenidos de P-I §14.6 + comprobación breve de comprensión (criterio propio del protocolo).
- `T-H9-04 [REQUIRED]` Circuito operativo ARCO + revocación + bloqueo/supresión por clase de dato/artefacto (distinción bloqueo≠supresión; crypto-shredding no se declara cumplimiento por sí solo); plazos verificados.
- `T-H9-05 [REQUIRED]` Clasificación por proveedor: `remisión a encargado` vs `transferencia a tercero`; instrumento contractual/DPA, subencargados, región, retención, logging, borrado, funciones con almacenamiento; `EXT-03` por **cuenta/plan/endpoint/configuración reales**; capacidades disponibles no habilitadas = `AVAILABLE_NOT_ENABLED`; ZDR preferido para sesión, alternativa solo si supera gate de privacidad. *Etiqueta:* `[PROFESSIONAL_GATE]` para conclusiones jurídicas (LEG-01).
- `T-H9-06 [REQUIRED]` Procedimiento de vulneración + árbol de decisión que separa parada por seguridad/privacidad/derechos/bienestar de rescate pedagógico (`DEC-LEGAL-ARTIFACTS-001`).
- `T-H9-07 [REQUIRED]` Identidad: verificación de mayoría de edad con mínima recolección; sin copia de identificación salvo necesidad demostrada; vínculo seudónimo separado.
- `T-H9-08 [REQUIRED]` Backups fuertes/externos y RPO/RTO objetivo si el modo de participación lo exige; decisión documentada local vs remoto **derivada de H8** (`DEC-HOSTING-001`, INFRA-01).
- `T-H9-09 [PROFESSIONAL_GATE LEG-01/LEG-02]` Revisión jurídica profesional del paquete (aplicabilidad/armonización LFPDPPP 2025 + Reglamento 2011, plazos, DPA); incertidumbre material ⇒ pendiente que bloquea H11.
- `T-H9-10 [PROFESSIONAL_GATE ETH-01]` Determinar si institución/reclutamiento/publicación exige comité/revisión ética; si aplica, su aprobación es gate; si no, salvaguarda voluntaria.
- `T-H9-11 [PROFESSIONAL_GATE ACC-01]` Obligaciones jurídicas mexicanas de accesibilidad según alcance (no sustituye baseline H8).
- `T-H9-12 [PROFESSIONAL_GATE LIC-02]` Cierre jurídico de material `LICENSE_UNRESOLVED` que se pretenda reutilizar (o exclusión definitiva).
- `T-H9-13 [REQUIRED]` Política de publicación n=1 con revisión de reidentificación; compensación (si existiera) congelada pre-consentimiento; debriefing/cierre informativo sin intervención en condición.

**Pruebas:** checklist H9 automatizable donde aplique (documentos versionados + hash en run-manifest); ensayo del circuito ARCO con datos simulados (se ejecuta como parte de H10).
**AC (gate H9 literal):** **ningún dato personal entra a H11** hasta paquete completo, probado y firmado/congelado; superar H9 no declara cumplimiento legal global.
**Entregables:** paquete de gobernanza versionado en `docs/governance/` + registros EXT-03.
**Gate H9:** `responsible=SECURITY_PRIVACY_RESPONSIBLE`, `approver=EXPERIMENT_AUDITOR` (+`PROFESSIONAL_REVIEWER` donde LIC-02/LEG-01/LEG-02/ETH-01/ACC-01 lo exijan). Acta `docs/gates/H9.md`.

---

### F13 — H10 · Ledger fuerte, restore y piloto seco formal  ⟨paralelizable con F12; su cierre consume artefactos H9⟩

**Objetivo:** integridad verificable, restauración probada, piloto seco completo con fallos inyectados, análisis sintético y `verdict-manifest` ejecutable.
**Dependencias:** F7–F10; el ejercicio de derechos usa artefactos de F12.

**Tareas**
- `T-H10-01 [CRITICAL]` Checkpoints firmados del ledger (`chain_head`, rango/secuencia, hash de manifest, `key_id`; clave privada inaccesible para session-engine/model-gateway); momentos mínimos: freeze, antes/después de cada sesión con participante, antes de migración sensible, tras recuperación/incidente. Transición irreversible = confirmada duraderamente antes de considerarse realizada; objetivo lógico de pérdida aceptable `0` (`DEC-RECOVERY-001`). Comando `profesor-ia ledger verify`.
- `T-H10-02 [CRITICAL]` Backups wal-g + copia cifrada separada; **restore drill en entorno limpio** verificando freeze-manifest, cadena/checkpoints, correcciones/invalidaciones, proyecciones, roles/grants y ausencia de montajes prohibidos; medir `[CALIBRATION SPEC-03-RTO/CAL-SECURITY-RTO]` RTO/throughput/recursos reales.
- `T-H10-03 [CRITICAL]` Piloto seco formal: participante simulado, calendario comprimido, **fallos inyectados** (caída de proveedor, retención incompatible ⇒ detener o fallback congelado; tamper/reorden/borrado de copia del ledger; caída del ledger antes de transición irreversible ⇒ no continuar; drift de lockfile/digest/manifest; doble envío; manipulación de tiempo), auditoría completa ciega, W12 ensayado.
- `T-H10-04 [CRITICAL]` Análisis con datos sintéticos (P-II §14.5): aprendizaje claro, ausencia de efecto, efecto retrasado, faltantes, incidentes, falsa dominación, cambio de versión — el pipeline W13 corre completo en los 7 escenarios.
- `T-H10-05 [CALIBRATION CAL-15/CAL-VERDICT-ANCHORS]` Anclajes operativos de dimensiones visuales (nivel, tendencia, variabilidad, inmediatez, solapamiento, consistencia) y criterios favorable/no_favorable de transferencia/retención, con material sintético/desarrollo, **sin datos del participante**; hasheados en `verdict-manifest`.
- `T-H10-06 [CRITICAL]` `verdict-engine` determinista + flujo de aprobación W13: tabla `FAVORABLE | NO_FAVORABLE | NOT_INTERPRETABLE` literal (P-I §10.5.1) y tablas de los 4 veredictos (P-I §12.3); `EXPERIMENT_AUDITOR` aprueba emisión, sin redefinición post hoc (`DEC-VERDICT-AUTHORITY-001`).
- `T-H10-07 [REQUIRED]` Ejercicio de derechos con datos simulados: acceso/rectificación/cancelación/oposición/revocación; bloqueo/supresión de artefactos suprimibles **sin romper** la verificabilidad del ledger (referencias conservan cadena sin contenido personal).
- `T-H10-08 [CALIBRATION CAL-02/CAL-AUDIT-POST]` Plan final de auditoría posterior: `N/n`, codebook, capacidad de detección/curva OC, segunda evaluación preinscrita si el costo humano lo permite `[OPTIONAL]`.
- `T-H10-09 [CALIBRATION CAL-07/CAL-12/CAL-13/DUP-01/DUP-02]` Cierres de calibración restantes de esta fase (isomorfismo, límites operativos, retención, aislamiento de transferencias, regla de dominio bajo pruebas secas).

**Pruebas:** `ci:ledger:chain`, `ci:restore:drill` (job manual reproducible), suite de fallos inyectados, corrida W13 sintética.
**AC (gate H10):** piloto seco completo termina **sin intervención docente**; restore drill limpio verifica manifest/ledger/proyecciones/grants; CAL-15 cerrado y `verdict-manifest` ejecutable; ejercicio de derechos simulado aprobado; ante ledger no confirmado el sistema **no** continúa transiciones irreversibles (probado).
**Entregables:** runbooks de respaldo/restauración, informe de piloto seco, `verdict-manifest` + `metrics-manifest` candidatos.
**Gate H10:** `approver=TECHNICAL_AUDITOR`. Acta `docs/gates/H10.md`.

---

### F14 — Freeze de preinscripción de la corrida H11

**Objetivo:** congelar el sobre completo de la corrida real (P-I §10.7) y pasar el checklist de autorización final.
**Dependencias:** F12 y F13 cerrados.

**Tareas**
- `T-FRZ-01 [CRITICAL]` Congelar (lista P-I §10.7, íntegra): corpus+atribución; `authorized-calculus-v1` (hash, alias, reglas, códigos, política semántica/decisión); mapa KC + una sola `authorizedCalculusVersion` para A/B/C; conjuntos/bancos/reservas/isomorfismo; semillas/pistas/rúbricas/verificador; lexicón + normalizador STT; modelos + `model_binding` + `ModelCapabilities` + huella; calendario SCED (probe_round, `k_set`/mínimos H5, ventanas 6–8/9–11/12–14, punto por semilla, separación 3, estabilidad, extensión 2); interpretabilidad/faltantes/covariación/techo-suelo/exposición; retención 7 días + `retention_not_evaluated`; `metrics-manifest` (contratos literales P-I §10.5: `probe_accuracy`, `transfer_measurement_accuracy`, `retention_accuracy`, `false_mastery_rate`, `hint_dependency`, `time_to_mastery`, `wheel_spinning`; sin `phase_change` escalar); `verdict-manifest` + anclajes CAL-15 + autoridad; plan de análisis visual + Tau-U + autocorrelación + regla de 5 obs/fase; política de auditoría + codebook + muestreo; conjunto dorado de percepción y política de abstención si hay visión; reglas de cambio de fase/invalidación/incidentes (`incident_code` canónicos); roles de aprobación; checklist SCRIBE de reporte.
- `T-FRZ-02 [REQUIRED]` `run-manifest`: personas asignadas a roles (≥2 personas naturales para H11; matriz de incompatibilidad P-I §14.1), capabilityFlags de la corrida, entorno (local vs remoto según H8/H9), límites de gasto.
- `T-FRZ-03 [REQUIRED]` Ejecutar el **checklist de autorización final** completo de P-III §17 (34 ítems) y archivarlo firmado.

**AC:** checklist §17 íntegro en verde; `ci:freeze:drift` verde sobre el sobre congelado; ningún pendiente aplicable abierto (los `PROFESSIONAL_GATE` aplicables resueltos o el gate permanece cerrado).
**Entregables:** sobre congelado + acta de autorización.
**Gate:** `approver=EXPERIMENT_AUDITOR`. Acta `docs/gates/FREEZE-H11.md`.

---

### F15 — H11 · Piloto real

**Objetivo:** ejecutar la corrida experimental con participante elegible bajo la versión congelada.
**Dependencias:** F14.

**Tareas**
- `T-H11-01 [CRITICAL]` Ejecución bajo protocolo P-III: participante adulto elegible (§2.1); familiarización por suficiencia (CAL-14) enseñando **solo uso de herramientas**; `foundation_phase` KC01/KC02/KC08 por Profesor IA; checklist automático pre-sesión (§10.1); inicio con aviso de IA, condiciones y registro de exposición externa (§10.2); bloques de enseñanza (§10.3), actividades puntuables (§10.4), sondas (§10.5) y cierres (§10.6) literales; políticas de fallo (§11), intervención humana (§12) e incidentes (§14). **No se añaden funciones durante la corrida.**
- `T-H11-02 [REQUIRED]` Hosting solo si el modo de participación lo exige (decisión H9); local sigue siendo válido.
- `T-H11-03 [REQUIRED]` Registro continuo: matriz de autonomía, carga humana (MEAS-01, clases FIJO/MARGINAL + `sin_equivalente_convencional`), cost-ledger, incidentes.

**AC:** corrida completada o cerrada conforme a protocolo (retirada/incidente incluidos), con evidencia íntegra y reconstruible.
**Entregables:** datos de la corrida + bitácora íntegra.
**Gate H11 (apertura):** `approver=EXPERIMENT_AUDITOR`; cierre pasa a F16.

---

### F16 — W12/W13 · Auditoría posterior, análisis y veredictos

**Objetivo:** auditar, analizar y emitir los cuatro veredictos en el orden obligatorio.
**Dependencias:** F15.

**Tareas**
- `T-ANL-01 [CRITICAL]` W12: censo 100 % (sondas primarias, retención, respuestas libres puntuadas, FP/FN sospechados, apelaciones, incidentes, resultados que sostengan conclusiones); muestra estratificada inicial 20 % de práctica/explicaciones/feedback/adaptación + 100 % de salidas no ancladas; cegamiento con juicio inicial **bloqueado** antes de descegar; codebook calibrado con material ajeno a reservas; concordancia (matriz de confusión, prevalencia, FP/FN, denominadores); adjudicación append-only; reducción posterior solo bajo la regla literal (0 críticos, mayores ≤2 %, concordancia ≥95 %, sin patrón; nunca el censo primario). `[OPTIONAL]` segundo auditor en submuestra preinscrita.
- `T-ANL-02 [CRITICAL]` W13: exportación seudonimizada, verificación de integridad, gráficas regeneradas, análisis visual estructurado primario + Tau-U por conjunto (con y sin corrección de tendencia), autocorrelación diagnóstica (≥5 obs consecutivas), faltantes no imputados con `n_planificado/n_valido/causas`, covariación declarada, reporte SCRIBE.
- `T-ANL-03 [CRITICAL]` `verdict-engine` emite: Pedagógico (`fuerte|parcial|solo_asistido|negativo|no_interpretable`; sin retención evaluable no hay `fuerte` + `retention_not_evaluated`), Autonomía (matriz función×estado×criticidad primaria; % global solo secundario con denominadores), Integridad (`valida|valida_con_desviaciones|con_reservas|invalida`), Viabilidad (`prometedora|costosa_pero_reducible|no_sostenible|no_evaluada`, con valores reales H8–H11, sin thresholds inventados). Interpretación **Integridad → Autonomía → Pedagogía → Viabilidad**; aprobación `EXPERIMENT_AUDITOR`.
- `T-ANL-04 [REQUIRED]` Informe final honesto (P-I §19): qué logró, dónde falló, controles suficientes, intervenciones, aprendizaje sin asistencia, costo de la autonomía, qué conservar/retirar; límites del threat model declarados.

**AC:** veredictos emitidos exclusivamente con manifests congelados; informe con limitaciones explícitas.
**Entregables:** informe de Etapa 1 + datasets exportados + acta W13.
**Gate:** acta `docs/gates/W13.md`. Fin de Etapa 1.

---

## 9. Dependencias, camino crítico y paralelización

### 9.1 Grafo de fases

```text
F0 ─→ F1 ─┬→ F2 (H2, camino crítico) ──┐
          └→ F3 (H3) ──────────────────┤
F0 ─→ F4 adaptadores ──(gateway listo)─┼→ F4 benchmarks (usa material F2)
                                       ├→ F5 (H4.5) ─→ F6 (H5) ─→ F7 (H6) ─→ F8 (H7) ─→ F10 (H8) ─→ F11 (GO/NO-GO)
F0 ─→ WS-FE (frontend base) ───────────┘            F9 (cursos) ∥ F10
F11(GO) ─→ F12 (H9) ∥ F13 (H10) ─→ F14 (freeze) ─→ F15 (H11) ─→ F16 (W12/W13)
```

### 9.2 Camino crítico

`F0 → F1 → F2 → F4(bench sesión) → F5 → F6 → F7 → F8 → F10 → F11 → (F12∧F13) → F14 → F15 → F16`.
El mayor riesgo técnico y de calendario es **F2/H2** (logic-core con 0FP/0FN + mutation) y **F6/H5** (cobertura de bancos y auditoría previa dentro de umbral).

### 9.3 Paralelizables

- F3 (entorno) con F2; adaptadores de F4 con F2; `speech-gateway`/`visual-interaction` (código, sin gate) desde F4 en adelante.
- **WS-FE** (workstream frontend continuo): F0 tokens+shell+navegación → estados §7.5 → vistas Estudiar/Preparar → Clase v1 para F7 → consolas para F6/F13 → multimodal para F10. Ninguna entrega FE cierra gates por sí sola.
- F9 con F10 (código no compartido); F12 con F13 (cierre de F13 consume artefactos de F12).
- `analysis/` (notebooks W13 sintéticos) desde F6 con datos sintéticos.

### 9.4 Reglas de secuencia duras (del Maestro)

H6 no abre sin CAL-09 + oportunidades SCED + cobertura fijadas (gate H5). H9 solo si H8 justifica continuar. H11 solo con F14 íntegro. `no_proof_exists_in_calculus` deshabilitado salvo CALC-03. Perfil B solo tras primera corrida Perfil A. Infraestructura remota solo tras H8 con razón concreta.

---

## 10. Estrategia de pruebas y controles transversales (CI)

Checks obligatorios en `main` (bloqueantes):

| Check | Contenido | Fase de alta |
|---|---|---|
| `ci:lint` / `ci:typecheck` / `ci:build` | base | F0 |
| `ci:arch:depcruise` | reglas `forbidden` P-II §3.3 (incl. isomorfismo→verificador, visual→verificador) | F0 |
| `ci:supply:sbom` / `ci:supply:drift` | lockfile+SBOM+licencias/advisories; drift bloquea | F0 |
| `ci:db:testcontainers` / `ci:db:negative` | migraciones desde cero + suite negativa de privilegios (PostgreSQL real; un mock no prueba permisos) | F1 |
| `ci:logic:golden` / `ci:logic:pbt` / `ci:logic:mutation` / `ci:logic:no-net` | núcleo lógico | F2 |
| `ci:gateway:contracts` / `ci:gateway:fail-closed` | contract tests por adaptador; salida estructurada nunca cruza sin validación local | F4 |
| `ci:canary` | detectores 0-hit en contexto/payload/salida/logs/exportes | F4 |
| `ci:cost:ledger` | tarifas versionadas; cambio de tarifa ⇒ nuevo manifest, sin reescritura | F4 |
| `ci:mode-separation` | LEARNING/MEASUREMENT separados por pruebas automatizadas; sonda desactiva ayuda | F7 (H6) |
| `ci:e2e:dry-session` / `ci:e2e:live-session` | sesión seca reconstruible / sesión viva (perfil C) | F7/F8 |
| `ci:adversarial:session` | lista P-II §14.4 aplicable | F8 |
| `ci:e2e:measurement-mode` y e2e UI-CORR-02/03/04/06/12 | conformidad UI | F7–F10 |
| `ci:coords:pbt` / `ci:annotations:staleness` / `ci:visual:no-verdict` | multimodal | F10 |
| `ci:a11y:baseline` | línea base de accesibilidad | F10 |
| `ci:ledger:chain` / `ci:restore:drill` | cadena/checkpoints; drill limpio (manual reproducible) | F13 |
| `ci:freeze:drift` | manifiesto de producción = paquete congelado | F6, F14 |

Propiedades transversales mínimas (P-II §14.2, además de las de F2): reactivo consumido no reaparece; sonda nunca en contexto del agente; corrección no elimina el original; dominio no sin transferencia; intervención humana registrada; coordenadas ida/vuelta en tolerancia; anotación obsoleta nunca renderiza; `visual-interaction` no importa/invoca verificador; corrección post-`COMMIT` conserva original; roles runtime sin operaciones prohibidas; salida estructurada inválida no cruza el gateway; cambio de tarifa no reescribe costos; referencia a artefacto suprimido conserva cadena sin contenido personal.

Datos sintéticos (P-II §14.5): los 7 escenarios ejecutables por el análisis completo antes del piloto.

---

## 11. Presupuesto y control de gasto (`OWNER-BUDGET-001`; Apéndice B)

Fase local: pagos obligatorios 0 salvo APIs (LLM/visión/TTS/STT) variables por uso. Sin cifra global heredada: el gasto se reconstruye del `cost-ledger` con `pricing-manifest` fechado, agregado por benchmark / W0-autoría-verificación / sesión / STT-TTS-visión / auditoría / almacenamiento / reintentos-fallos. Antes de cada hito se fija un tope con telemetría de la etapa previa; no se genera el curso completo ni benchmark masivo hasta que la etapa anterior funcione. Objetivo ordinario ≈ MXN 500/mes; **> MXN 700 acumulados ⇒ bloqueo de operaciones facturables hasta revisión explícita registrada del propietario** (T-H4-07; UI-CORR-11). El gate nunca autoriza degradar integridad. Piloto formal: presupuesto vinculante solo desde H8 (Hetzner/backup/observabilidad/dominio/jurídico recotizados entonces).

---

## 12. Seguimiento del progreso

- **`docs/plan/PLAN_STATUS.md`** (fuente de verdad de avance): tabla `Tarea | Etiqueta | Estado | Evidencia (PR/CI-run/artefacto) | Fecha | Notas`. Estados §0.4. El agente lo actualiza en el mismo PR que cambia el estado.
- **Actas de gate** `docs/gates/H*.md`: checklist del gate, evidencias (links a checks), `responsible_role`/`approver_role`, firma/fecha. Un gate sin acta no está cerrado.
- **`docs/blocked-by-spec.md`**: entradas `BLOCKED_BY_SPEC — [decisión exacta faltante] | tarea afectada | fecha | resolución (control de cambios del Maestro)`.
- **Convención de PR/commits:** título `T-Hx-nn: …`; un PR no puede marcar VERIFICADA una tarea cuyos checks no estén en verde; cambios de contenido/paquete van al repo de contenido con su propio historial.
- **Registro de parámetros:** todo valor `[CALIBRATION]` fijado se escribe en `content/**` o `docs/params/registry.yaml` con `parameter_id` del Maestro (CAL-*/CALC-*), valor, gate, evidencia y hash del freeze que lo congela.
- **Carga humana (MEAS-01):** asientos desde H8 en `operations` (categoría, inicio/fin, clase FIJO/MARGINAL, `sin_equivalente_convencional`, método MEDIDO/ESTIMADO).
- **Ritmo:** el propietario dispone de ≈1 h/día; el plan prioriza tickets grandes verificables por CI y continuidad sobre velocidad; sin fecha límite dura (`DEC-OWNER-CONSTRAINTS-001`).

---

## 13. Trazabilidad `requisito/decision_id → tarea → prueba → artefacto` (matriz principal)

| decision_id / norma | Tarea(s) | Prueba/verificación | Artefacto |
|---|---|---|---|
| DEC-AUTHORITY-001 / I-1 | T-H6-01..06, T-H7-01 | ci:mode-separation, ci:e2e:* | motores + eventos |
| DEC-NORESCUE-001 / I-9 | T-H6-04, T-H7-*, UI-CORR-04 | e2e apelación; ausencia de endpoint | session-engine |
| DEC-ARCH-001 | F0–F3 | ci:arch:depcruise, ci:infra:compose-up | monorepo+compose |
| DEC-CALCULUS-001/-SNAPSHOT/-RULES/-SEMANTICS/-SETS | T-H2-01..07 | ci:logic:golden/pbt/mutation | `authorized-calculus-v1` + logic-core |
| DEC-KC-001 / DEC-KC-CORRECTIONS-001 / DEC-KC-POLICY-EDGE-001 | T-H5-03 | validador de grafo + linter | `kc/map.yaml` |
| DEC-FOUNDATION-001 | T-H6-12, T-H11-01 | e2e foundation_phase | eventos foundation |
| DEC-PROOF-001 | T-H2-08 | pruebas de estados + certificado re-verificado | proof-search |
| DEC-TRANSFER-001 / DUP-01 | T-H5-06, T-H6-07 | pruebas de aislamiento/isomorfismo | reservas separadas |
| DEC-RETENTION-001/-UNIT-001 / CAL-13 | T-H5-08, T-H6-07 | simulación de calendario + linter | reserva retención + calendario |
| DEC-BASELINE-001 / DEC-PROBE-ROUND-001 | T-H6-07, T-FRZ-01 | pruebas del calendario (ventanas/estabilidad/extensión) | experiment/calendar |
| DEC-SCED-ANALYSIS-001 / DEC-METRICS-001 | T-H10-04, T-ANL-02, T-FRZ-01 | corrida sintética 7 escenarios | metrics-manifest + notebooks |
| DEC-VERDICTS-001 / DEC-VERDICT-AUTHORITY-001 / CAL-15 | T-H10-05/06, T-ANL-03 | verdict-engine sobre sintéticos | verdict-manifest |
| DEC-MEAS-AUTHORITY-001 / DEC-MEAS-INTERRUPTION-001 | T-H6-06/08 | ci:e2e:measurement-mode | measurement-worker |
| DEC-HINT-AUTHORITY-001 / DEC-FALSE-MASTERY-SCHEDULE-001 | T-H6-03/05, T-H5-13 | linter recalcula bandera; e2e reconfirmación | domain-engine + hints |
| DEC-RECOVERY-SCOPE-001 | T-H6-04 | prueba de contador por KC | domain-engine |
| DEC-FAILURE-ATTRIBUTION-001 | T-H8-07, P-III §11 | replays clasificados | clasificador de fallos |
| DEC-EXPOSURE-001 | T-H6-11 | e2e inicio de sesión | registro exposición |
| DEC-FREE-RESPONSE-001 | T-H6-06, T-ANL-01 | métrica separada + censo 100 % puntuadas | metrics-manifest |
| DEC-FAMILY-001 | T-H5-07 | prueba de inmutabilidad de familia | items metadata |
| DEC-LANGUAGE-001 | T-H45-08, T-H2-13 | validación translingüe + lexicón | claims + lexicón |
| DEC-W0-SCOPE-001 / DEC-CORPUS-001 | T-H45-01..07 | replay W0 + flujo autorización | selection-manifest |
| DEC-LICENSE-CONSERVATIVE-001 / LIC-01/LIC-02 | T-H45-05, T-H9-12 | gate por componente | license-register |
| DEC-DEPENDENCY-FREEZE-001 / EXT-01 | T-H0-06 | ci:supply:* | SBOM por freeze |
| DEC-MODEL-BINDING-001 / BENCH-01/02 | T-H4-02/09/10/11 | ci:gateway:*, harness | model_binding + informes |
| BENCH-03 / CAL-MULTIMODAL | T-H8-12 | suite BENCH-03 | informes multimodales |
| BENCH-04 | T-H2-16, T-H5-05 | arnés L0 | orden congelado del pipeline |
| BENCH-05 / INFRA-02 | §14 (post-Perfil A) | — | diferido |
| DEC-BKT-001 / CAL-11 | T-H5-16 | invisibilidad + sin autoridad | shadow-metrics |
| DEC-WHITEBOARD-001 / DEC-VISION-001 | T-H8-03/04/05 | ci:visual:no-verdict, ci:coords:pbt | visual-interaction |
| DEC-VOICE-001 / UI-CORR-03/07/08 | T-H8-01/02 | replays STT + e2e voz | speech-gateway |
| DEC-LEDGER-001 / I-6 / DEC-RECOVERY-001 | T-H1-03, T-H10-01/02 | ci:db:negative, ci:ledger:chain, ci:restore:drill | evidence + checkpoints |
| DEC-PRIVILEGE-001 / I-2 / I-4 | T-H1-02/04 | ci:db:negative | matriz de permisos |
| DEC-HOSTING-001 / INFRA-01 | T-H8-09, T-H9-08 | informe telemetría | decisión sizing |
| DEC-COST-001 / OWNER-BUDGET-001 / UI-CORR-11 | T-H4-06/07 | ci:cost:ledger + prueba de gate 700 | cost-ledger |
| DEC-AUTONOMY-METRIC-001 / DEC-HUMANLOAD-001 / MEAS-01 | T-H11-03, T-ANL-03 | matriz función×estado | panel autonomía + ledger de carga |
| DEC-LEGAL-ARTIFACTS-001 / LEG-01/02, ETH-01, ACC-01, EXT-03 | T-H9-01..13 | checklist H9 + drill derechos (H10) | paquete gobernanza |
| DEC-OWNER-CONSTRAINTS-001 / DEC-LOCAL-SELF-USE-001 | F3, F11 | acta LOCAL_SELF_USE | informe funcional |
| DEC-CUSTOM-COURSES-001 / OWNER-CUSTOM-COURSES-001 | T-CC-01..05 | prueba de aislamiento | carril personalizado |
| DEC-UX-FUNCTIONAL-001 / DEC-UX-ARTIFACT-001 / UI-CORR-01..12 | §7, WS-FE, e2e UI | checks e2e por corrección | apps/web |
| OWNER-REUSE-001 | fronteras de paquetes (F0, F2) | depcruise + builds independientes | logic-core / editor Fitch reutilizables |

(Las tareas citan además su norma en línea; este cuadro no sustituye esas citas.)

---

## 14. Separación estricta: OPTIONAL · STAGE_2 · PRODUCT

**[OPTIONAL] (permitidos, no exigidos por gates):** BKT sombra (T-H5-16); modo `exhaustive_k`/`minimalCostVerified`; decisor terminante `no_proof_exists_in_calculus` (solo vía CALC-03/CALC-08/CAL-DECIDER-EXTERNAL); segundo auditor en submuestra (CAL-02); medición humana comparable acotada post-freeze (P-I §12.1, nunca contrafactual); dashboards OTel externos.

**[STAGE_2] (no construir en Etapa 1):** E-01 replicación multi-participante (diseño/potencia/N por simulación, sin N importado); E-02 comparación con enseñanza humana como estudio separado; alta disponibilidad/infra gestionada solo si la escala lo exige.

**[PRODUCT] (diferido a producto):** F-01 web pública/PWA/desktop y lenguaje visual final (Tauri/Electron sin decidir); F-02 captura externa por defecto, conservación de audio bruto, migración a tldraw; F-03 operación comercial, observabilidad/HA de producto, métricas adquisición/conversión (si algún día existen: proyección separada que no alimenta motor/agente/análisis primario, P-II §9.4/§9.5); F-04 compra/modelo de GPU (Perfil B/BENCH-05 + TCO primero; P100 solo banco legado con toolchain congelado); F-05 despliegue amplio/comercialización; además: Sentry, Caddy/TLS/dominio, correo transaccional, LTI, RAG vectorial/GraphRAG, Redis, Kubernetes, app móvil, panel institucional, pagos.

Regla: ningún elemento de esta sección puede colarse como dependencia implícita de F0–F16.

---

## 15. Riesgos principales (referencia operativa)

Se adopta íntegra la tabla P-II §17 (riesgo→impacto→respuesta). Los cinco de mayor exposición para este plan y su mitigación ya asignada: (1) falso positivo/negativo del verificador → F2 (golden+PBT+mutation+oráculo+construcción); (2) fuga de solución/extracción → I-2, canarios, filtro de egreso, adversariales F8; (3) sondas contaminadas/isomorfas → reservas físicas + canonicalizador + DUP-01; (4) benchmark sobreajustado → partición dev/eval con reemplazo de evaluación contaminada; (5) pérdida/reescritura de evidencia → append-only BD + cadena/checkpoints + restore drill + límite de threat model declarado.

---

## 16. Definición global de «listo para piloto» y criterio de éxito técnico

**Listo para piloto** = los 20 puntos de P-II §19, verificados por sus checks/actas: despliegue desde cero por script; golden en verde; paquete sin autoría manual reactivo-por-reactivo; auditoría muestral en umbral; sin ruta del agente a soluciones; política pedagógica versionada/validada/congelada; modos separados por pruebas; ayuda decisiva no cuenta sin reconfirmación; sonda sin ayuda; freeze detecta cambios; bitácora reconstruye sesiones; apelación y retirada operativas; respaldo restaurado; análisis con sintéticos; modelo con benchmark aprobado y evaluación no contaminada + binding verificable; permisos/pruebas negativas en verde; ledger con cadena/checkpoint y drill limpio; H8 separó percepción/interfaz/accesibilidad; piloto seco sin intervención docente; riesgos aceptados por responsables.

**Éxito técnico** (P-II §20): no que el Profesor IA «enseñe bien», sino que el sistema permita medirlo sin esconder fallos — la IA prepara y opera; el código limita y verifica; el humano audita desde fuera; cada intervención queda visible; ninguna falla se convierte silenciosamente en éxito; resultados reproducibles por versión.

---

*Fin de `Plan.md`. Cualquier ambigüedad se resuelve subiendo por la jerarquía de §0.1; cualquier decisión faltante se registra como `BLOCKED_BY_SPEC` conforme a §0.2.5.*
