# audits/ — auditoría previa por muestra (W4)

Registro de `N_h`, `n_h`, fracción, semilla, probabilidad de inclusión y defectos por severidad (T-H5-14).

## Segundo auditor — intento con OpenAI/Codex (2026-08-22)

- `w4-second-auditor-part-a-openai-codex-gpt-5.json`: juicio original de Parte A, conservado sin
  editar.
- `w4-second-auditor-part-b-openai-codex-gpt-5.md`: recomendaciones de Parte B y bloque JSON final.

Estos dos archivos son **evidencia diagnóstica, no cierre del gate**. El auditor leyó primero el
`HANDOFF`, que ya revelaba el veredicto previo y la familia generadora, por lo que no se preservó el
cegamiento de §13.4. Además, OpenAI/Codex puede pertenecer a la familia candidata de BENCH-01 a la
que no debía exponerse el paquete con soluciones. No se aplicaron los juicios a
`w4-audit-report.yaml`; hace falta adjudicación y una nueva Parte A realmente ciega con un auditor
no candidato.
