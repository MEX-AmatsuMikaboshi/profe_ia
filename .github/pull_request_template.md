<!-- Plan.md §12: el título del PR debe empezar por el id de tarea: `T-Hx-nn: …` -->

## Tarea

- **Id de tarea (`T-*` obligatorio):** T-
- **Etiqueta:** `[CRITICAL] | [REQUIRED] | [BENCHMARK] | [CALIBRATION] | [PROFESSIONAL_GATE] | [OPTIONAL]`
- **Norma citada (`decision_id` o sección del Maestro/UIUX):**

## Qué cambia

<!-- Descripción breve. Si el cambio toca contenido, va al repositorio de contenido con su propio historial. -->

## Verificación

- [ ] Checks CI en verde (lista los relevantes: `ci:…`)
- [ ] `docs/plan/PLAN_STATUS.md` actualizado **en este mismo PR**
- [ ] Si cambian dependencias: SBOM + digest regenerados (`ci:supply:sbom`)
- [ ] Si el cambio fija un parámetro `[CALIBRATION]`: registrado en `docs/params/registry.yaml`

## Declaraciones obligatorias

- [ ] No reabre ninguna decisión `CONGELADA` del Apéndice A (§0.2.1)
- [ ] No introduce valores inventados para decisiones `CONDICIONADA A BENCHMARK` / `CALIBRABLE` (§0.2.2)
- [ ] No importa datos ilustrativos de los mockups como defaults, thresholds o fixtures (§0.2.3)
- [ ] Si apareció una decisión faltante: registrada como `BLOCKED_BY_SPEC` en `docs/blocked-by-spec.md` (§0.2.5)

> Un PR no puede marcar una tarea como `VERIFICADA` si sus checks no están en verde (§12).
