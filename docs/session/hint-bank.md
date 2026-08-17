# Banco congelado y autoridad de pistas

Implementación de `Plan.md` `T-H6-05`, P-I §8.6 y `DEC-HINT-AUTHORITY-001` en
`packages/domain-engine/src/hint-bank.ts`.

## Política literal

`HintPolicyDefinition` fija como datos JSON estrictos, versionados y hasheables las cinco clases de
ayuda:

1. recordar el objetivo o una definición;
2. señalar la región o regla relevante;
3. indicar el siguiente tipo de operación sin resolverla;
4. mostrar un ejemplo análogo no isomorfo;
5. cerrar el intento sin revelar la respuesta calificada.

La misma política declara que la sesión solo sirve contenido del banco congelado, no busca un nivel
«cercano», no acepta la propuesta del generador como autoridad y deshabilita toda ayuda en
`MEASUREMENT_MODE`. El *fading* continúa bajo la decisión contingente de `pedagogy-policy`; este
controlador recibe únicamente el nivel que esa autoridad autorizó y nunca lo aumenta o sustituye.

## Banco y separación de soluciones

`FrozenHintBank` enlaza versión de banco, paquete de contenido y pipeline de autoría. Cada reactivo
debe tener exactamente una pista por cada uno de los cinco niveles y todas deben pertenecer al
mismo KC. IDs repetidos, niveles faltantes o dos pistas del mismo reactivo+nivel invalidan el banco
completo.

La entrada de cada pista conserva:

- texto y anclajes ya congelados;
- hechos estructurados para recalcular elegibilidad;
- la propuesta generativa, identificada explícitamente como no autoritativa;
- versión y hash de la validación de no revelación, ligados al reactivo, KC, nivel, hechos, texto,
  anclajes y evidencia del ejemplo;
- para nivel 4, evidencia hasheada del canonicalizador de que el ejemplo no es isomorfo.

El runtime no recibe la solución privada. La comprobación literal contra ella ocurre en
`authoring-core`; el banco sólo acepta el contenido exacto que esa comprobación validó y la sesión
lo entrega sin generación, paráfrasis, interpolación ni fallback. Por ello una pista no puede
convertirse silenciosamente en una solución durante la entrega.

El control automático de autoría detecta fuga **literal**, no paráfrasis. Esa limitación queda
codificada en la evidencia como `literal_not_paraphrase` y exige auditoría de paráfrasis en W4; no
se afirma una garantía material antes de esa auditoría.

## Freeze por corrida

`HintRunRegistry` fija por `runId` propósito, política, banco y paquete con sus versiones y hashes.
El registro es restaurable e inmutable: un segundo binding distinto para la misma corrida falla por
deriva. Una corrida material necesita los hashes externos esperados de política y banco; calcularlos
en el mismo proceso no sustituye al manifiesto congelado.

No se creó un banco material. Las pruebas construyen exclusivamente artefactos `test_fixture` y no
afirman corpus, auditoría, firma ni publicación.

## Solicitud y registro por intento

`DeterministicHintController` procesa dos eventos: inicialización y solicitud. Cada solicitud
registra modo, intento, reactivo y nivel autorizado, y termina en uno de cinco resultados cerrados:

- `delivered`;
- `disabled_measurement_mode`;
- `no_assistance_authorized`;
- `level_unavailable`;
- `already_delivered`.

La comprobación de `MEASUREMENT_MODE` ocurre antes de consultar el banco, de modo que la respuesta
no revela siquiera si existe una pista para el reactivo. Nivel 0 tampoco consulta contenido. Para
los demás casos la búsqueda es exacta por reactivo+nivel; no hay selección del nivel anterior o
siguiente. Repetir la misma pista registra la solicitud pero no duplica la entrega, y un intento con
una entrega no puede cambiar después de reactivo.

Por cada intento se deriva desde las entregas el máximo nivel usado y
`masteryDisqualifying`. `masteryDisqualifying()` de `domain-engine` vuelve a calcular el valor:
nivel 1 sólo conserva elegibilidad si es recordatorio puro, mientras niveles 2–5, selección de
regla/paso o contenido decisivo descalifican. Una discrepancia con la propuesta del generador
invalida el banco; nunca se copia la propuesta al estado operativo.

## Replay e integración de sesión

`HintSessionState` conserva binding, solicitudes, entregas y agregados por intento. El replay valida
secuencia, tiempo e IDs. Al continuar desde un snapshot restaurado, el controlador vuelve a derivar
cada resultado contra el banco y compara cada entrega completa; texto, anclajes, nivel, KC o bandera
adulterados fallan aunque el objeto conserve una forma válida. Los esquemas estrictos excluyen
soluciones, BKT y propuestas del modelo.

`updateSessionFromHintState()` proyecta a `SessionStructuredState` únicamente los niveles usados,
el máximo y la bandera recalculada. Verifica corrida, participante y paquete, actualiza
`assistanceByAttempt`, y nunca vuelve verdadera una elegibilidad previa: una ayuda decisiva la deja
en falso. El texto no cruza a la autoridad común de sesión y la solución privada permanece fuera de
ambos motores.
