# Profesor IA — Documento maestro normalizado v2.12

**Estado:** documento único normativo y vigente del proyecto — especificación preimplementación cerrada, cuestionario del propietario integrado y Especificación UI/UX v0.1 reconocida como artefacto subordinado; listo para generar `Plan.md` una vez aplicada la versión conformada de UI/UX.
**Fecha de normalización:** 14 de agosto de 2026.
**Cambio principal de v2.12:** reconocimiento formal de `Profesor IA — Especificación UI/UX v0.1` como artefacto subordinado, incorporación de su política de autoridad y trazabilidad, y cierre documental del pendiente UX/UI previo a `Plan.md`. No se modifican decisiones pedagógicas, experimentales, de privacidad, seguridad, autoridad, medición ni arquitectura ya congeladas; benchmarks, calibraciones y revisiones profesionales permanecen abiertos en sus gates.
**Dirección:** autonomía máxima y prueba de sustitución funcional del docente.  
**Sustituye a:** *Profesor IA — Documento maestro v1*, *Profesor IA — Decisiones tecnológicas definitivas v1* y *Profesor IA — Adquisición y preparación de conocimiento antes de la enseñanza autónoma*.  
**Regla de autoridad:** a partir de esta versión, cualquier contradicción con los tres documentos sustituidos se resuelve a favor de este documento.

> **Principio rector:** la IA prepara y enseña; el código controla lo verificable; el humano autoriza y audita desde fuera; la primera comprobación funcional se ejecuta localmente antes de contratar infraestructura de hosting.

## 0. Qué quedó normalizado

Esta versión integra en una sola especificación:

1. la intención experimental original de **sustitución funcional del profesor**;
2. el protocolo n=1 y sus reglas de no rescate pedagógico;
3. las decisiones tecnológicas ya cerradas;
4. la fase previa de **investigación, selección y curación de fuentes**;
5. la separación entre **currículo maestro congelado** y **ruta individual**;
6. la trazabilidad `fuente → fragmento → claim → decisión curricular → artefacto → actividad`;
7. la estrategia **local-first**: primero probar en la computadora del desarrollador, usando APIs comerciales cuando convenga; hosting y servicios de operación se activan solo después de demostrar valor funcional;
8. las correcciones de normalización detectadas durante la revisión;
9. la incorporación desde la prueba local de **voz, pizarrón libre, percepción visual y anotaciones sobre la interfaz**, sin delegar en estas capas la autoridad evaluativa formal;
10. una **política pedagógica explícita, determinista y versionada** que selecciona estrategias según tipo de KC, estado observable del alumno, error, prerrequisitos y ayudas utilizadas, sin ceder al LLM la autoridad sobre avance, dominio o modo evaluativo;
11. la separación explícita entre **dependencias formales, pedagógicas, conceptuales/analógicas y estadísticas** del mapa de KC, una definición operacional de isomorfismo para proteger reservas y reglas más precisas para interpretar los límites del *proof search*;
12. la normalización metodológica del **SCED de sondas múltiples n=1**, del control por componente de licencias/groundedness y del riesgo estadístico de auditoría, preservando los umbrales vigentes como parámetros de proyecto.
13. un benchmark de modelos con **partición desarrollo/evaluación, repetición, incertidumbre y binding reproducible** cuando el proveedor no ofrece snapshot fechado;
14. seguridad operacionalizada mediante **matriz ejecutable de privilegios, pruebas negativas, cadena de hashes/checkpoints y restore drill**, sin fingir inmutabilidad frente a un administrador total del host;
15. una línea base multimodal de **abstención visual, transcript versionado, accesibilidad verificable y separación percepción/interfaz/concepto** antes del piloto formal.
16. una gobernanza de participante real alineada conservadoramente con el **marco mexicano vigente de protección de datos**, separando aviso de privacidad, consentimiento de investigación, derechos ARCO y revisión profesional previa al piloto;
17. una instrumentación de **recursos y costos por operación** mediante telemetría H8, `pricing-manifest` versionado, ledger de costos y selección de infraestructura derivada de mediciones;
18. una interpretación de autonomía **por función y criticidad**, con reglas explícitas para carga humana, límites de afirmación, interpretabilidad del n=1 y diseño futuro de replicación.
19. un cierre pre-cuestionario que elimina decisiones técnicas implícitas sobre fundamentos, observaciones SCED, retención, autoridad, fallos, roles, exposición, interrupciones, familias de autoría e idioma sin anticipar resultados empíricos futuros.

### 0.1 Correcciones normativas incorporadas

- El humano **no define los objetivos pedagógicos observables**. Solo acota materia, subunidad, límites y políticas; la IA deriva objetivos, mapa de KC, secuencia y materiales.
- La investigación de fuentes ocurre en un workflow **W0/H4.5** previo a la ingesta. Su salida es una **propuesta de corpus**; W1/H5 conserva la responsabilidad de descargar/cargar, hashear y fragmentar el corpus autorizado.
- No se añade un octavo esquema PostgreSQL. La proveniencia se distribuye entre los siete esquemas ya definidos.
- Los roles de extracción, diseño, generación y crítica son **roles lógicos del workflow**, no agentes independientes obligatorios.
- NLI/entailment se trata como **verificador estadístico auxiliar**, no como autoridad determinista.
- La inducción de prerrequisitos no puede apoyarse en reglas falsas como “→E requiere haber aprendido antes →I”; las dependencias formales y pedagógicas se validan por separado.
- El consenso entre fuentes no se resuelve por mayoría simple cuando existen cálculos, notaciones o convenciones distintas.
- Los scores de fuentes y la saturación son **heurísticas calibrables**, no probabilidades de verdad.
- Qwen3-14B sigue evaluándose **después** de la primera corrida con Perfil A.
- No se implementa RAG vectorial general ni GraphRAG en Etapa 1 salvo evidencia posterior de necesidad.
- Open Logic Project sigue siendo candidato primario sujeto a la cláusula **“salvo indicación contraria”** de su licencia. *forall x: Calgary* está publicado bajo CC BY 4.0, pero declara material de terceros **usado con permiso**; por ello su gate jurídico se resuelve por sección/componente y snapshot, no por la etiqueta global de la obra. MIT OCW y OpenStax se evalúan igualmente por recurso y versión y no se adoptan como base expresiva por defecto cuando existan restricciones NC/SA o material de terceros incompatible.

### 0.1.1 Ampliación multimodal incorporada en v2.1

La primera versión funcional deja de ser exclusivamente textual. Se incorporan **voz, pizarrón libre y anotaciones visuales** como capas de interacción alrededor del núcleo ya definido. La regla vinculante es:

> **La voz no sustituye al texto canónico; la visión no sustituye al estado estructurado; el modelo propone interpretaciones y anotaciones; el código resuelve coordenadas, ejecuta acciones, conserva evidencia y mantiene la autoridad evaluativa.**

La ampliación no introduce una arquitectura paralela ni nuevos microservicios obligatorios. Se integra en el monolito modular mediante paquetes y adaptadores propios, con capacidades congeladas por corrida.

### 0.1.2 Normalización pedagógica incorporada en v2.2

La v2.2 incorpora resultados útiles de dos investigaciones pedagógicas sin sustituir la jerarquía normativa del Maestro. Se adoptan como reglas operativas únicamente las recomendaciones compatibles con la prueba de autonomía y con la separación entre IA generativa y control determinista.

Reglas nuevas vinculantes:

- el **motor pedagógico** selecciona la estrategia; el modelo generativo ejecuta lingüísticamente la estrategia seleccionada dentro de un contrato cerrado;
- el núcleo de Etapa 1 puede usar explicación directa, ejemplos trabajados, *fading* contingente, práctica guiada, práctica independiente, *scaffolding*, autoexplicación guiada, *retrieval practice* y feedback centrado en tarea/proceso;
- el retiro de ayudas es **contingente al desempeño**, no un cronograma fijo;
- un acierto obtenido con ayuda pedagógicamente decisiva no cuenta por sí solo como evidencia de dominio y debe reconfirmarse sin ayuda;
- se separan explícitamente `LEARNING_MODE` y `MEASUREMENT_MODE`; las sondas y demás mediciones primarias operan sin ayuda;
- para Etapa 1, “transferencia” significa por defecto **transferencia cercana dentro del dominio y la subunidad**, salvo que el protocolo preinscrito defina otra cosa; no se infiere transferencia lejana;
- *spacing* y *retrieval* pueden programarse solo mediante políticas y ventanas congeladas antes de la corrida; no pueden alterar libremente el calendario experimental;
- *wheel-spinning* se registra como señal de estancamiento y activa revisión de estrategia/recuperación, pero **nunca escalamiento pedagógico humano** dentro de la corrida;
- Bayesian Knowledge Tracing (BKT), si se implementa en Etapa 1, opera únicamente como **métrica sombra no autoritativa**. No sustituye el criterio determinista vigente de dominio hasta una corrida futura específicamente preinscrita para evaluarlo;
- los umbrales numéricos y tamaños de efecto procedentes de las investigaciones no se convierten en hechos normativos por haber sido citados: cualquier cifra externa relevante debe verificarse contra su fuente primaria antes del freeze correspondiente.

No se adopta como núcleo de Etapa 1 el aprendizaje por descubrimiento mínimamente guiado, PBL/inquiry abierto, una adaptación por “estilos de aprendizaje”, ni una orquestación pedagógica libre controlada por el LLM.

### 0.1.3 Normalización de fundamentos lógicos y de KC incorporada en v2.3

La v2.3 incorpora únicamente los aportes defendibles de las investigaciones sobre componentes de conocimiento y sobre verificación/*proof search*. Las referencias no verificadas contra fuente primaria no adquieren autoridad por aparecer en dichos informes.

Reglas nuevas o precisadas:

- toda dependencia entre KC debe etiquetarse como **FORMAL**, **PEDAGÓGICA**, **CONCEPTUAL/ANALÓGICA** o **ESTADÍSTICA**; solo una dependencia FORMAL se presenta como necesidad del cálculo autorizado;
- el mapa de KC se congela para cada corrida, pero se considera una **hipótesis de modelado falsable**: la evidencia posterior puede justificar dividir, fusionar o reetiquetar KC únicamente en una nueva versión;
- cada paso puede registrar un KC principal y cero o más **KC de soporte**, evitando atribuir automáticamente al KC de la regla un fallo causado por alcance/accesibilidad u otra competencia transversal;
- se corrigen las dependencias de KC13, KC15 y KC16 para no confundir secuencia pedagógica con necesidad lógica, y se distingue explícitamente `¬I` de la reducción al absurdo clásica (`RAA`);
- para control de contaminación, “isomorfo” se define operacionalmente mediante una representación normalizada de la estructura de prueba, no solo por similitud textual; esta definición es una decisión de ingeniería y debe validarse mediante pruebas de falsos positivos/falsos negativos;
- la complejidad estructural sigue siendo una **heurística**, no dificultad psicométrica; subpruebas, descarga de supuestos y estrategia indirecta pueden contribuir al índice, pero sus pesos se calibran;
- un fallo del *proof search* significa **“no se encontró una prueba dentro del presupuesto”**, no “no existe prueba”; la invalidez lógica requiere un veredicto independiente del oráculo semántico bajo la semántica autorizada;
- el orden `prefiltro semántico → proof search` se benchmarkea como optimización inicial del pipeline de autoría, pero no se declara invariante universal antes de medirlo en L0;
- se incorpora **mutation testing** como capa adicional de aseguramiento del núcleo crítico del verificador. No se adopta un `kill rate` universal del 100 %, un número fijo de ejecuciones PBT, un timeout de 30 s ni una profundidad 8–12 como hechos científicos; esos valores, si se usan, son parámetros de calibración congelados por versión.

### 0.1.4 Normalización del cálculo autorizado y del núcleo lógico incorporada en v2.4

La v2.4 reaudita el verificador y el *proof search* contra fuentes primarias y documentación oficial. No cambia el dominio piloto ni sustituye Fitch por otro cálculo de enseñanza. Introduce las siguientes precisiones compatibles con las decisiones vigentes:

- el **cálculo autorizado** deja de ser una propiedad implícita del paquete y pasa a ser un artefacto versionado y hasheado que declara sintaxis, alias, conectivos, reglas primitivas/derivadas/prohibidas, reglas de alcance/descarga, tratamiento de `↔`, `⊥E`, `DNE` y `RAA`, semántica usada por los chequeos independientes, códigos de error y cualquier procedimiento de decisión autorizado;
- cada conjunto experimental referencia explícitamente la versión del cálculo y su política semántica/de decisión. La validez bajo una semántica más fuerte o más amplia **no se interpreta automáticamente como derivabilidad** en un fragmento más restrictivo;
- el oráculo semántico de **sanidad** conserva su función independiente: si una línea aceptada no es consecuencia de los supuestos accesibles bajo una semántica respecto de la cual todas las reglas autorizadas son sanas, existe un defecto bloqueante. Un resultado semánticamente válido no certifica por sí solo que exista una prueba en el cálculo autorizado;
- `search_budget_exhausted` sigue significando únicamente que el buscador heurístico no encontró prueba dentro de su presupuesto. El estado `no_proof_exists_in_calculus` solo puede emitirse cuando exista un decisor terminante cuya **sanidad y completitud respecto de la versión exacta del cálculo autorizado** hayan quedado justificadas y probadas por versión;
- el presupuesto primario del buscador se expresa mediante trabajo determinista reproducible —por ejemplo nodos/estados/inferencias exploradas con orden y semilla fijados—. El tiempo de pared queda como salvaguarda de proceso y nunca como fundamento del veredicto lógico;
- una afirmación de minimalidad solo se permite cuando la búsqueda ha cubierto exhaustivamente todos los costes menores bajo podas conservativas. En cualquier otro caso se informa `best_found` o equivalente sin afirmar minimalidad;
- se separan físicamente la **normalización para verificación** —conservadora, sin identificar fórmulas que el cálculo distingue— y la **canonicalización para isomorfismo/contaminación**, que puede renombrar átomos y normalizar estructura para comparar reservas. CI impide que la segunda sea importada por la ruta del verificador;
- el patrón buscador → certificado → `logic-core` se trata explícitamente como arquitectura certificante: el buscador puede ser heurístico, pero toda derivación concreta aceptada se vuelve a verificar por el núcleo determinista;
- el aseguramiento incorpora pruebas de aceptación de derivaciones válidas **generadas por construcción**, además de pruebas de rechazo, para atacar falsos negativos del verificador;
- **StrykerJS con su runner oficial para Vitest** queda seleccionado como herramienta de mutation testing del núcleo lógico, con versión exacta fijada en el freeze. Su score se usa como señal/gate de no regresión calibrado, no como medida absoluta de corrección.

No se adopta como requisito el uso docente de cálculo de secuentes, un asistente de pruebas externo, un porcentaje universal de mutation score, un `numRuns` universal, ni la incorporación de código GPL de verificadores externos al producto.

### 0.1.5 Normalización SCED, autoría/groundedness y auditoría incorporada en v2.5

La v2.5 integra las Investigaciones 04, 05 y 06 únicamente dentro de los espacios que el Maestro mantenía abiertos. No cambia la prueba de sustitución funcional, el n=1, los tres conjuntos, la regla de no rescate, la autoridad del verificador ni el censo de resultados primarios.

Reglas nuevas o precisadas:

- el diseño se documenta como **línea base múltiple concurrente con técnica de sondas múltiples** entre tres conjuntos; tres conjuntos constituyen el piso metodológico de esta corrida y no autorizan generalización poblacional;
- antes del freeze se fijan un criterio operacional de estabilidad de línea base y una contingencia **acotada y preinscrita** de extensión; el calendario no se adapta post hoc para favorecer resultados;
- los puntos de inicio de enseñanza se seleccionan por **aleatorización restringida dentro de ventanas preinscritas**, con separación mínima congelada; cualquier excepción logística debe estar declarada antes de la corrida;
- la selección de conjuntos debe minimizar competencias transversales compartidas y el análisis registra como covariación cualquier mejora en una línea base aún no intervenida que coincida temporalmente con la enseñanza de otro conjunto;
- el análisis principal conserva un **análisis visual estructurado**; el complemento cuantitativo, el tratamiento de tendencia/autocorrelación y las reglas de datos faltantes se preinscriben. Ningún estadístico de efecto se declara universal por aparecer en una investigación;
- el gate de licencia de W0 opera por **recurso, versión, sección/componente y evidencia concreta**. El snapshot evaluado se hashea en W0 y W1 debe verificar identidad antes de ingerir;
- el `formal_system_id` objetivo se declara antes de comparar claims de fuentes; fuentes que describen otro sistema no compiten por mayoría dentro del sistema autorizado;
- la parada de investigación se operacionaliza con parámetros versionados de tamaño base, longitud de racha e información nueva, calibrados localmente, y el reporte declara la diversidad de linaje de las fuentes;
- para `source_assertion`, la muestra dorada de groundedness usa un criterio tipo **AIS**: el claim debe ser atribuible al fragmento identificado. `system_inference` se analiza por separado y no se penaliza como fallo de atribución de fuente;
- la muestra dorada de NLI/entailment se estratifica por forma lógica relevante al dominio; un gate automático solo puede habilitarse en estratos donde su fiabilidad haya quedado demostrada;
- el crítico generativo produce **justificación estructurada basada en criterios/evidencia**, pero su acuerdo global con el generador no certifica calidad. Se mide de forma separada el fallo correlacionado del crítico sobre candidatos objetivamente defectuosos;
- el detector de contaminación se extiende a similitud textual/estructural contra ejercicios presentes en el corpus fuente, además de las comparaciones entre reservas;
- los porcentajes y conteos de auditoría vigentes se conservan como **parámetros normativos de riesgo de esta versión**, no como constantes científicas. Se documentan `N`, `n`, denominadores, capacidad de detección/curva OC cuando proceda y resultados por estrato;
- la auditoría usa un codebook versionado de severidad, cegamiento en dos fases y trazabilidad inmutable de juicio inicial, adjudicación, causa raíz, regeneración y regresión. Una segunda evaluación independiente puede usarse en una submuestra preinscrita de calibración sin entrar al circuito pedagógico;
- un resultado observado de `100 %` se reporta como `x/n` y conserva su gate operativo, pero **no** se interpreta como demostración de tasa futura de fallo igual a cero.

No se adopta un cuarto conjunto, un grupo de comparación, una sustitución de los gates por tablas ISO, un estadístico SCED universal, una revisión humana reactivo por reactivo ni una reducción del censo primario.

### 0.1.6 Normalización de benchmark, multimodalidad y seguridad incorporada en v2.6

La v2.6 integra las Investigaciones 07, 08 y 09 únicamente como refuerzos compatibles con el Maestro. No cambia la prueba de sustitución funcional, el Perfil A como primera prueba completa, Qwen3-14B después de Perfil A, el monolito modular, los siete esquemas, el push-to-talk inicial, la autoridad del verificador ni la prohibición de rescate pedagógico humano.

Reglas nuevas o precisadas:

- la reproducibilidad del Perfil A se declara por niveles: **binding/configuración registrada, estabilidad estadística y equivalencia funcional**; no se promete identidad bit a bit de salidas de APIs comerciales;
- cuando un proveedor no exponga snapshot fechado, el freeze usa un `model_binding` con identificador de modelo, endpoint/API, parámetros realmente soportados, configuración de razonamiento, schemas, prompts/políticas, fecha, regiones/opciones relevantes y una **huella de comportamiento** sobre un set canario congelado;
- la pasarela mantiene una **tabla de capacidades por modelo** y no envía parámetros no soportados; `refusal`, `truncated`, `schema_violation` y demás fallos se registran por separado;
- el benchmark separa un conjunto de **desarrollo** de uno de **evaluación** fijados por semilla; las iteraciones solo pueden mirar desarrollo y reutilizar evaluación después de ajustar la configuración invalida esa partición;
- los gates de cero se conservan por consecuencia, pero el reporte dice **“cero observado en x/n bajo los casos ensayados”** y registra una cota unilateral compatible con el plan; no se traduce en afirmación de seguridad absoluta;
- el crítico generativo que contribuya al gate de autoría debe ser de **familia distinta** del generador; continúa siendo un rol lógico del mismo workflow, no un sistema multiagente independiente;
- el agente/model-gateway se trata como componente **no confiable respecto de privilegios**: datos del alumno, corpus y salidas externas no adquieren autoridad por contener instrucciones; no existen herramientas genéricas de SQL/filesystem/HTTP arbitrario para el agente;
- las credenciales runtime de PostgreSQL no son owner/superusuario/`BYPASSRLS` ni pueden escalar por membresía a roles privilegiados; RLS es defensa en profundidad, nunca la frontera única para `private_solutions` o `measurement`;
- `append-only` significa que los roles runtime no pueden `UPDATE`/`DELETE` eventos y que toda corrección agrega eventos. La cadena de hashes y checkpoints firmados detecta alteraciones respecto de una referencia confiable, pero **no** se presenta como protección absoluta frente a un administrador que controle DB, host, claves y checkpoints;
- antes del participante real se ejecutan pruebas negativas de permisos, aislamiento, web, canarios, supply-chain, ledger, backup/restore y modo degradado; si el ledger no confirma una decisión irreversible, el sistema no continúa esa transición;
- STT registra transcripción cruda, transcripción normalizada y versión del normalizador; el léxico del KC/cálculo se inyecta desde estado congelado, no desde decisión libre del LLM;
- una corrección posterior al `COMMIT` nunca reescribe silenciosamente una actividad puntuable: crea evidencia enlazada y se trata según la política de incidentes/adjudicación;
- la visión opera con **aceptar como observación / confirmar / declinar**, con cortes calibrados localmente; jamás convierte una interpretación visual en veredicto formal;
- las anotaciones usan revisión monotónica por superficie, caducidad calibrada y rechazo duro de coordenadas obsoletas; las transformaciones contemplan DPR, zoom, scroll y escena del pizarrón;
- los fallos se clasifican al menos como **percepción, interfaz, accesibilidad o conceptual**. Los tres primeros no se imputan automáticamente al KC;
- H8 incorpora una **línea base mínima de accesibilidad** y una declaración de criterios verificados/excepciones. No se declara conformidad WCAG 2.2 AA del sistema completo sin auditoría criterio por criterio.

No se adopta full duplex por defecto, voz-a-voz opaca, calificación desde manuscrito/visión, Kubernetes/microservicios, un octavo esquema, blockchain, timestamp externo por evento, aprobación humana ordinaria de respuestas pedagógicas ni sustitución del benchmark por recencia del modelo.

### 0.1.7 Normalización de privacidad/legalidad, infraestructura/costos y autonomía incorporada en v2.7

La v2.7 integra las Investigaciones 10, 11 y 12 únicamente dentro de decisiones abiertas o como precisiones compatibles. No cambia la sustitución funcional, el n=1, los tres conjuntos, el no rescate pedagógico, la separación enseñanza/medición, el local-first, el Perfil A como primera prueba completa, Qwen3-14B como candidato posterior, el monolito modular ni los siete esquemas.

Reglas nuevas o precisadas:

- para H9/H11 se adopta como referencia jurídica mexicana la **LFPDPPP vigente publicada en 2025 y reformada en noviembre de 2025**; cualquier plantilla que dependa de la ley abrogada de 2010 o del INAI se considera desactualizada;
- hasta revisión profesional, el proyecto opera bajo la **suposición conservadora de aplicabilidad** de la LFPDPPP al piloto. Las conclusiones jurídicas específicas del informe de investigación se mantienen como interpretación, no como certificación de cumplimiento;
- toda comunicación de datos a terceros se clasifica antes del freeze como **remisión a encargado** o **transferencia a tercero** según el papel jurídico real; proveedor, instrumento contractual/DPA, subencargados, región y retención se archivan por versión;
- el **aviso de privacidad** y el **consentimiento informado de investigación** son artefactos separados. H9 incluye circuito ARCO, revocación/oposición, bloqueo/supresión y procedimiento de vulneración, con plazos legales verificados y revisión profesional antes de H11;
- la seudonimización no se presenta como anonimización. El `evidence-ledger` no almacena identidad real y evita persistir texto/audio/imagen libre cuando pueda residir en un almacén suprimible referenciado; ninguna técnica de *crypto-shredding* se declara por sí sola prueba de cumplimiento jurídico;
- una **parada por seguridad, privacidad, derechos o bienestar no pedagógico** no es rescate pedagógico: se detiene la sesión, se registra y se aplica la política de validez correspondiente; nunca se continúa con un humano enseñando dentro de la condición;
- para el modelo de sesión se prefiere ZDR cuando esté contractualmente disponible. Si no lo está, el candidato solo puede seguir si la política vigente de datos —no entrenamiento con datos de API, retención documentada y acotada, controles de logging/almacenamiento compatibles y contrato aplicable— supera el gate de privacidad; un modelo incompatible puede seguir siendo candidato de autoría si nunca recibe datos del participante;
- H8 registra CPU, memoria, disco, I/O, PostgreSQL, colas y latencia por servicio. La SKU de un VPS y los límites de Compose se seleccionan **después** de esa telemetría, no por una cifra histórica;
- los costos se reconstruyen mediante eventos de uso y un **`pricing-manifest` versionado**; las antiguas cifras globales de API quedan como historial no vinculante y no sirven de presupuesto operativo;
- Batch, caching y otras optimizaciones de proveedor quedan detrás de una política de datos explícita. Ningún tráfico de participante se enruta a una modalidad con retención incompatible solo por ahorro;
- `structured outputs`/decodificación restringida son una primera barrera. La salida vuelve a validarse localmente contra el contrato y falla cerrado; el gateway mantiene pruebas contractuales por proveedor para schema, usage, errores, canarios y `model_binding`;
- una corrida en Tesla P100, si se realiza, congela GPU, driver, **toolchain CUDA 12.x compatible**, commit de llama.cpp, cuantización y configuración. La P100 es banco de prueba legado, no plataforma objetivo; la compra de GPU nueva sigue diferida;
- el artefacto primario de autonomía es la **matriz función × estado**, estratificada por criticidad y con denominadores visibles. El porcentaje global de decisiones autónomas se conserva como métrica secundaria y nunca sustituye esa matriz;
- cada función se clasifica antes del freeze por consecuencias de fallo sobre seguridad, evidencia, evaluación y experiencia. `no evaluada` nunca se presenta como autonomía demostrada;
- la carga humana se registra como `FIJO_PROYECTO`, `FIJO_POR_UNIDAD`, `MARGINAL_POR_SESION` o `MARGINAL_POR_ALUMNO`, más una bandera de trabajo sin equivalente convencional; la proyección de escala usa por separado carga fija y marginal;
- la selección de conjuntos ejecuta una comprobación automática de dependencias `FORMAL` entre conjuntos. Se prefieren conjuntos sin dependencias formales cruzadas; si existen, deben justificarse y no pueden crear una ruta que haga no interpretable la línea base de un conjunto aún no intervenido;
- antes de la corrida se preinscriben criterios de **interpretabilidad**: techo/suelo, tendencia de línea base, contaminación/carryover, reserva insuficiente y lenguaje permitido para resultados positivos, nulos o negativos;
- los seis puntos de la primera línea base ya usados por el Maestro se conservan como **parámetro interno de planeación**, no como requisito atribuido a WWC. La referencia WWC se registra por separado como convención de reportabilidad y no como ley científica;
- Etapa 2 conserva como candidato principal una replicación de línea base múltiple entre participantes con introducción escalonada/aleatorizada cuando proceda. El número de participantes y el análisis se derivan de diseño, potencia/simulación, variabilidad y reclutamiento real; no se fija un `N` por importación;
- cualquier comparación con enseñanza humana sigue siendo **estudio separado**. Una referencia de carga humana, si se reporta, distingue observación medida de estimación y nunca se presenta como contrafactual de aprendizaje del participante;
- las métricas de producto se mantienen fuera del plan de inferencia pedagógica primaria y del contexto del agente; el informe final se lee en orden **integridad → autonomía → pedagogía → viabilidad**.

No se adoptan como reglas de Etapa 1: supervisión pedagógica humana en tiempo real, obligación importada de DPIA/GDPR o plazo de 72 horas, niveles SAE L0–L5 como escala educativa, un ECA humano como diseño principal, un `N` fijo para Etapa 2, un precio/SKU de hosting permanente, cifras actuales de API como constantes, ni la compra preventiva de GPU.

### 0.1.8 Auditoría final de coherencia incorporada en v2.8

La v2.8 no rediseña Profesor IA. Corrige contradicciones de especificación y convierte incertidumbres restantes en gates explícitos. Reglas vinculantes nuevas o aclaradas:

- **una sola fuente de verdad por decisión o parámetro:** cuando un mismo valor aparezca en varias partes, el valor autoritativo se identifica mediante un `decision_id` o `parameter_id`; las repeticiones narrativas no crean una segunda decisión;
- todo estado abierto declara el gate que bloquea. Si el gate aplica a la corrida, no puede considerarse verde mientras el pendiente siga abierto;
- el **cálculo autorizado exacto** —`formal_system_id`, reglas primitivas/derivadas/prohibidas, `↔`, `⊥E`, `DNE`, `RAA`, alias, alcance y política semántica/de decisión— deja de ser una decisión “deliberadamente diferida”: debe quedar definido y verificado antes de cerrar H2 y antes de que W0 compare claims contra el sistema objetivo;
- se separan dos funciones que antes compartían el nombre “transferencia”: `TRANSFER_MASTERY` pertenece a `LEARNING_MODE` y sirve al controlador de dominio; `TRANSFER_MEASUREMENT` pertenece a `MEASUREMENT_MODE`, usa reserva independiente y es la única que puede alimentar el resultado experimental de transferencia; ningún reactivo ni variante isomorfa puede cruzar ambas reservas;
- **retención** sigue siendo parte de la pregunta principal. Para emitir un veredicto completo sobre esa pregunta debe existir al menos un intervalo de retención preinscrito y ejecutable. Si el calendario/banco no permite medirla, se reporta `retention_not_evaluated` y queda explícito que la pregunta principal solo fue contestada parcialmente; nunca se infiere retención desde dominio o transferencia inmediata;
- toda métrica reportable debe tener antes de H11 un **contrato de métrica** con `metric_id`, unidad, numerador, denominador o población de referencia, inclusiones/exclusiones, tratamiento de faltantes/invalidaciones, dirección interpretativa y vínculo al veredicto. Una etiqueta sin ese contrato es descriptiva y no puede sostener una conclusión;
- los veredictos `fuerte/parcial/solo_asistido/negativo/no_interpretable` y sus equivalentes de autonomía/integridad/viabilidad no pueden asignarse post hoc; v2.9 congela el `verdict-manifest` que define su evidencia mínima;
- los mínimos numéricos del banco, conjunto dorado, benchmark y auditoría son **parámetros de aseguramiento del proyecto**, no constantes científicas, salvo donde se cite expresamente una fuente primaria. Deben conservar `parameter_id`, denominador y etapa de uso;
- los gates de benchmark con 0 %, 95 %, 98 % o 100 % conservan su consecuencia operativa, pero cada uno debe declarar universo de casos, momento de conteo —primer intento o después de reintento—, exclusiones y `x/n`;
- nombres de modelos, endpoints, precios, versiones y políticas de datos son candidatos externos fechados, no hechos permanentes. El benchmark/freeze conserva la autoridad final y exige reverificación primaria;
- la taxonomía de incidentes de Parte I es canónica. Parte III solo la instancia; si aparece una diferencia de ejemplos, prevalece la clase/efecto definido en Parte I y el `incident_code` congelado;
- antes de H11 cada gate y acción irreversible debe tener `responsible_role` y `approver_role` explícitos. Los nombres de las personas pueden asignarse después, pero no puede existir una transición crítica sin rol responsable;
- el incumplimiento de mínimos preinscritos por datos faltantes, calendario o reserva agotada no se resuelve con la frase “cuando sea viable”: se aplica la regla preinscrita de interpretabilidad y se reporta la limitación;
- la lista pública de la Cámara de Diputados consultada el 12 de agosto de 2026 incluye el Reglamento de la LFPDPPP de 2011 dentro de “Reglamentos de Leyes Federales Vigentes”. Esto corrige el estado documental previo de **[DATO NO VERIFICADO]** sobre su mera existencia/vigencia listada; su aplicabilidad concreta, armonización con la Ley de 2025 y efecto sobre el piloto mantienen estado **PENDIENTE DE VERIFICACIÓN EXTERNA/PROFESIONAL** antes de H11.


### 0.1.9 Normalización preimplementación incorporada en v2.9

La v2.9 es una normalización de **especificación preimplementación**. No convierte benchmarks, mediciones ni validaciones futuras en resultados conocidos. Sus reglas nuevas o cerradas son:

- Etapa 1 adopta `formal_system_id = "forallx-calgary-tfl"` y `authorizedCalculusVersion = "authorized-calculus-v1"`, anclado documentalmente a *forall x: Calgary*, edición Fall 2025, revisión `8642250` de 2026-07-18, snapshot PDF de `1,562,067 bytes` y SHA-256 `2a8fea85b358fb45ba7835dee5166b5990b7a7c11ad4dc6c41ebdd9a265c1888`;
- el cálculo usa `¬, ∧, ∨, →, ↔` y `⊥`, sin precedencia entre conectivos binarios; `↔` es primitivo; las reglas primitivas son `R, ∧I, ∧E, ∨I, ∨E, →I, →E, ↔I, ↔E, ¬I, ¬E, X, IP`; `DNE` es la única derivada autorizada y toda regla no listada queda prohibida;
- los tres conjuntos experimentales comparten exactamente `authorized-calculus-v1`; una referencia por conjunto existe para trazabilidad y no habilita fragmentos distintos;
- KC10 queda ligado a `¬E`, KC12 usa `PC:KC10` como dependencia de política de contenido que impide introducir `⊥` como premisa o supuesto inicial independiente, KC16/DNE queda derivada permitida, KC17/IP queda primitiva y KC15 deja de estar condicionado al tratamiento de `↔`;
- se congela el lexicón español canónico del cálculo y se separan ids formales, etiquetas visibles y verbalización;
- el SCED fija ventanas de inicio A `6–8`, B `9–11`, C `12–14`, separación mínima de `3` oportunidades válidas, una regla operacional de estabilidad y una extensión máxima de `2` oportunidades dentro de la ventana;
- el análisis visual estructurado sigue siendo primario y `Tau-U` se congela como complemento descriptivo, con reglas explícitas de datos faltantes, interpretabilidad, autocorrelación y covariación;
- `false_mastery_rate`, `hint_dependency`, `time_to_mastery`, transferencia y retención reciben contratos de métrica; Etapa 1 no adopta un escalar `phase_change`;
- el `verdict-manifest` queda definido antes de observar resultados y conserva el orden **Integridad → Autonomía → Pedagógico → Viabilidad**;
- la retención primaria se mide a **7 días calendario** desde una declaración válida de dominio mediante una reserva independiente en `MEASUREMENT_MODE`; si no existe reserva válida se registra `retention_not_evaluated`;
- las funciones reciben clases de criticidad y efecto de fallo; percepción, TTS, pizarrón y overlays son degradables salvo cuando una salida concreta participe en una función pedagógica/evaluativa;
- los gates irreversibles reciben `responsible_role` y `approver_role`; ningún modelo de IA puede ocupar `approver_role`;
- las transiciones irreversibles confirmadas tienen objetivo lógico de pérdida aceptable `0`; el **RTO real** y el comportamiento de restauración permanecen pendientes de medición H10;
- la licencia global de *forall x: Calgary* no se usa para presumir derechos sobre materiales “used with permission”; reutilización expresiva exige proveniencia granular y cualquier componente no resuelto queda `LICENSE_UNRESOLVED`;
- versiones exactas de dependencias se derivan del lockfile/SBOM del freeze, no de familias escritas en este documento; las políticas reales de ZDR/retención dependen de la cuenta, endpoint, contrato y configuración efectivamente usados;
- los identificadores externos verificados el 2026-08-13 son solo un snapshot factual de candidatos. Ningún identificador, endpoint, precio, latencia o capacidad externa sustituye el benchmark/freeze correspondiente.

Ningún punto C/D/E/F de la auditoría se convierte en resultado anticipado por esta normalización.

### 0.1.10 Cierre pre-cuestionario incorporado en v2.10

La v2.10 cierra únicamente decisiones que un implementador no debe inventar. No fija resultados de benchmark ni parámetros empíricos aún desconocidos. Reglas nuevas o precisadas:

- KC01, KC02 y KC08 forman una **fase de fundamentos previa al SCED** operada por Profesor IA; no pueden ser KC objetivo de A/B/C en Etapa 1 y su enseñanza no cuenta como evidencia causal de los conjuntos experimentales;
- la unidad temporal del SCED es una `probe_round` global; cada conjunto produce como máximo una observación agregada por ronda a partir de una microbatería cuyo tamaño se calibra/fija en H5 antes de H11;
- la retención primaria es **por conjunto experimental**, a 7 días desde `set_mastery_timestamp`, y no cuenta como oportunidad SCED;
- dentro de `MEASUREMENT_MODE`, `measurement-worker` tiene autoridad exclusiva sobre calendario, reserva concreta, semilla, consumo, tiempo de aplicación y validez operacional de la sonda; el motor de sesión solo orquesta entrada/salida y consume el resultado;
- `masteryDisqualifying` se deriva por código desde la política congelada; una bandera generativa nunca tiene autoridad sobre dominio;
- los fallos se atribuyen antes de afectar veredictos como `PEDAGOGICO`, `OPERACIONAL` o `INTERFAZ_PERCEPCION`, sin convertir una caída técnica en falta de aprendizaje;
- la complejidad necesaria para selección/dominio se calibra y congela en H5; cualquier refinamiento H10 es diagnóstico y solo puede afectar corridas posteriores;
- el `verdict-engine` aplica una tabla determinista a etiquetas estructuradas; `EXPERIMENT_AUDITOR` aprueba la emisión final y los anclajes que requieran calibración se congelan pre-H11 sin mirar resultados del participante;
- se congela una matriz mínima de incompatibilidad de roles: quien produce evidencia bloqueante no puede aprobarla; H11 requiere al menos dos personas naturales distintas, salvo que gates profesionales exijan una tercera competencia independiente;
- exposición externa, autoestudio, techo/suelo y las interrupciones durante sondas reciben efectos explícitos de validez;
- las respuestas libres no pueden sostener la medida primaria pedagógica de Etapa 1;
- la dependencia KC12→KC10 pasa a `POLITICA_CONTENIDO`, no `FORMAL`;
- el máximo de dos recuperaciones se aplica **por KC** después de agotar los tres ciclos internos;
- una propuesta de corpus rechazada vuelve a W0; si el universo permitido se agota bajo la regla de saturación, H4.5 falla sin reescritura pedagógica humana;
- una `familia` de autoría recibe criterio normativo e `item_family_id` inmutable antes de auditoría;
- enseñanza, UI, rúbricas y artefactos operativos se producen en español; fuentes en otro idioma conservan original, traducción trazable y restricciones de validación translingüe;
- `false_mastery_rate` recibe una reconfirmación post-dominio programada por el motor, sin convertir ausencia válida en falso dominio;
- `authorized-calculus-v1` y su ancla Calgary forman parte del sobre experimental ya congelado y no se contabilizan como autonomía de descubrimiento W0.

### 0.1.11 Integración del cuestionario del propietario incorporada en v2.11

La v2.11 normaliza las respuestas del propietario sin convertir preferencias personales en evidencia científica ni reabrir decisiones técnicas ya congeladas. Se incorporan las siguientes restricciones de ejecución:

- la primera experiencia real de uso será **local en la computadora del desarrollador**, sin hosting, dominio ni GPU dedicada como requisito;
- el entorno declarado para planificación es Windows 11, Intel Core i5 de 8.ª generación, 16 GB de RAM, más de 1 TB de almacenamiento disponible y conexión estable; estos datos son de planificación y H8 conserva autoridad sobre límites reales de recursos;
- Perfil A mediante APIs es la ruta base de Etapa 1; Perfil B/GPU local no forma parte del plan base y solo puede reabrirse por benchmark posterior;
- objetivo económico: usar alternativas gratuitas/OSS siempre que no sacrifiquen integridad; objetivo ordinario de APIs ≈ MXN 500/mes y **revisión explícita del propietario antes de superar MXN 700 acumulados** o contratar infraestructura recurrente no prevista; no se interpreta como permiso para degradar gates de integridad;
- el propietario puede abrir cuentas directas en los proveedores que requiera el benchmark y dispone de medio de pago internacional; ningún proveedor queda seleccionado por esta disponibilidad;
- Claude Code es la herramienta de desarrollo asistido inicialmente disponible; Codex puede actuar como alternativa. El `Plan.md` debe estar escrito para **alta autonomía del agente**, con criterios de aceptación automáticos y mínima necesidad de decisiones técnicas manuales del propietario;
- la experiencia funcional deseada habilita voz de entrada, voz de salida, pizarrón e interpretación visual cuando BENCH-03/H8 lo permitan; si costo, estabilidad o integridad lo requieren, la corrida puede degradarse a texto + editor formal sin considerarlo incumplimiento del objetivo principal;
- la preferencia del propietario es conservar la información útil, pero **no modifica** las reglas normativas de minimización, finalidad, separación, consentimiento, supresión ni la política de audio bruto;
- disponibilidad de trabajo declarada: aproximadamente una hora diaria, preferentemente al mediodía, sin fecha límite dura; el plan prioriza continuidad, automatización y costo bajo frente a velocidad;
- no existe hardware GPU disponible para el plan base; no se compra hardware nuevo antes de evidencia que lo justifique;
- las partes reutilizables —especialmente `logic-core`, editor Fitch y componentes de autoría— deben conservar fronteras que permitan reutilización si el sistema completo no resulta viable;
- existe acceso potencial a revisión pedagógica externa de corta duración, pero no se presupone que dicha persona pueda ocupar automáticamente roles técnicos, experimentales o jurídicos. La competencia de cada `approver_role` se verifica antes del gate correspondiente;
- la primera auto-prueba del propietario/desarrollador se clasifica como **`LOCAL_SELF_USE` funcional**, no como H11 experimental formal. Puede ejercitar la aplicación y producir telemetría de desarrollo, pero no habilita afirmaciones experimentales de Etapa 1 ni sustituye los requisitos de participante elegible, separación de roles y revisiones aplicables de H11.

#### Decisión de generalización funcional — materias personalizadas

Se incorpora `DEC-CUSTOM-COURSES-001`:

- además del curso experimental de referencia de lógica, la aplicación debe permitir **crear materias personalizadas** desde una solicitud de alto nivel del usuario;
- el sistema puede ejecutar investigación/autoría, proponer estructura, preparar sesiones, guardar progreso y enseñar esas materias usando los componentes generalizables disponibles;
- una materia personalizada se etiqueta de forma inequívoca como **`CUSTOM_COURSE_UNVALIDATED`** mientras no exista un protocolo específico que demuestre su validez;
- únicamente la subunidad de lógica cubierta por la Etapa 1 puede alimentar los veredictos experimentales definidos en este Maestro;
- los cursos personalizados no usan por defecto el SCED de lógica, `authorized-calculus-v1`, reservas experimentales ni el verificador formal salvo que el dominio realmente los requiera y una especificación posterior los autorice;
- un fallo o éxito en una materia personalizada es evidencia funcional/descriptiva, no prueba de generalización científica;
- esta capacidad forma parte de la experiencia local deseada, pero **no bloquea** H2/H5/H8/H10 ni H11 del curso experimental si debe entregarse después del núcleo validado.

### 0.1.12 Integración subordinada de la Especificación UI/UX v0.1

Se reconoce formalmente **Profesor IA — Especificación UI/UX v0.1** como artefacto de diseño subordinado de este Documento Maestro y como entrada válida para la generación de `Plan.md`, una vez aplicadas las correcciones de conformidad identificadas en su auditoría final.

La jerarquía documental aplicable queda:

1. Documento Maestro vigente, incluido el cuestionario normalizado y sus decisiones normativas;
2. anexos normativos expresamente reconocidos por el Documento Maestro;
3. Especificación UI/UX vigente y conformada;
4. `Plan.md`;
5. implementación.

La Especificación UI/UX tiene autoridad para fijar disposición, jerarquía visual, navegación fina, componentes, densidad, tipografía, tokens visuales, responsive design y demás decisiones exclusivamente de presentación o interacción que no alteren comportamiento normativo.

No tiene autoridad para modificar directa ni implícitamente:

- objetivos pedagógicos o experimentales;
- separación `LEARNING_MODE` / `MEASUREMENT_MODE`;
- dominio, progreso o criterios de avance;
- autoridad de IA, código o humano;
- veredictos o gates;
- reservas y aislamiento evaluativo;
- privacidad, conservación o supresión;
- seguridad o privilegios;
- `model_binding` y freezes de corrida;
- políticas de evidencia;
- presupuesto normativo;
- reglas de materias personalizadas o del curso experimental de lógica.

Los nombres, porcentajes, tiempos, costes, cantidades de sesiones, métricas, estados simulados, materias de ejemplo, valores de benchmarks y demás datos utilizados únicamente para maquetar se consideran **contenido ilustrativo no normativo**. No pueden convertirse en constantes, defaults, thresholds, criterios de aceptación ni datos de `Plan.md` salvo que exista una decisión autoritativa independiente en este Documento Maestro.

Las propuestas expresamente identificadas por la Especificación UI/UX como exploraciones, supuestos, alternativas o decisiones pendientes no constituyen requisitos de implementación por su sola aparición en un mockup.

Ante cualquier contradicción entre la Especificación UI/UX y este Documento Maestro prevalece el Documento Maestro y se corrige la UI/UX. Una ambigüedad visual o una comodidad de diseño no constituye por sí misma un hueco funcional.

Si una revisión futura de UI/UX descubre una decisión genuinamente necesaria para implementar y no resuelta por ninguna autoridad superior, dicha decisión debe registrarse como hueco funcional y resolverse mediante control de cambios del Documento Maestro antes de que `Plan.md` o la implementación la inventen.

La trazabilidad de implementación debe permitir vincular, cuando corresponda:

`elemento UI → requisito/decision_id del Maestro → requisito de Plan.md → criterio de aceptación → implementación/prueba`.

Las decisiones exclusivamente visuales pueden evolucionar dentro de la Especificación UI/UX sin reabrir el Documento Maestro mientras conserven estas invariantes.

## 0.2 Jerarquía interna

En caso de tensión dentro de este documento, prevalece:

1. **Parte I — Base funcional y metodológica.**
2. **Parte III — Protocolo operativo.**
3. **Parte II — Plan técnico.**
4. **Apéndices y notas de implementación.**

El cuerpo normativo define **qué** debe ocurrir. El Apéndice A registra el **estado** de cada decisión y el Apéndice E registra qué evidencia o medición sigue faltando.

Los únicos estados permitidos para decisiones relevantes son:

- `CONGELADA`;
- `CONDICIONADA A BENCHMARK`;
- `CALIBRABLE`;
- `PENDIENTE DE VERIFICACIÓN EXTERNA/PROFESIONAL`;
- `DIFERIDA A ETAPA 2`;
- `DIFERIDA A PRODUCTO`.

Una decisión puede estar `CONGELADA` aunque su implementación requiera una validación futura. En ese caso no se reabre la regla: la validación aparece como pendiente operativo `CALIBRABLE` en el Apéndice E y solo determina si el gate puede cerrarse.

## Índice general

- **Parte I. Base funcional y metodológica**
- **Parte II. Plan técnico y de construcción**
- **Parte III. Protocolo operativo de la Etapa 1**
- **Apéndice A. Estado consolidado de decisiones**
- **Apéndice B. Presupuesto por fases**
- **Apéndice C. Fuentes verificadas y notas de investigación**
- **Apéndice D. Orden práctico inmediato**
- **Apéndice E. Pendientes deliberadamente abiertos**
- **Apéndice F. Cuestionario del propietario y respuestas normalizadas**

---

# Parte I — Base funcional y metodológica

**Estado:** normativa funcional vigente para la Etapa 1.  
**Dirección:** autonomía máxima y prueba de sustitución funcional del docente.  
**Fecha:** agosto de 2026.  
**Ámbito experimental formal:** piloto formativo de una subunidad de deducción natural proposicional, con un alumno adulto, interacción por texto, voz y pizarrón cuando la corrida lo habilite, y sin calificaciones oficiales.  
**Ámbito previo de ingeniería:** prueba funcional local en la computadora del desarrollador; no cuenta como evidencia experimental del participante.

---

## 0. Cómo leer este documento

Este documento convierte la intención original del proyecto en requisitos funcionales vinculantes.

La Etapa 1 no se diseña como un asistente para un profesor humano. Se diseña **como si la intención fuera sustituir funcionalmente al profesor en la operación ordinaria de la enseñanza**, con el propósito de descubrir mediante evidencia qué funciones puede asumir el sistema, cuáles requieren controles externos y en cuáles fracasa.

Las palabras **debe**, **no puede**, **se detiene**, **se invalida** y **se escala** indican requisitos obligatorios.

### 0.1 Jerarquía documental

Este archivo es la única especificación normativa vigente. Los documentos anteriores se conservan únicamente como historial de decisiones y evidencia de investigación.

Cuando una tecnología, precio, licencia o condición externa pueda cambiar con el tiempo, se verifica contra la fuente primaria antes del freeze correspondiente y se registra la versión comprobada.
### 0.2 Cambio histórico de dirección (especificaciones funcionales v3 → v4)

| Tema | Especificación funcional histórica v3 | Especificación funcional histórica v4 |
|---|---|---|
| Propósito | Tutor controlado que apoya al docente | Profesor IA autónomo sometido a prueba de techo |
| Operación docente | El humano prepara, aprueba, califica y atiende excepciones | La IA prepara, imparte, evalúa y continúa; el humano queda fuera del circuito ordinario |
| Autoría | Mapa, banco y paralelos escritos por el docente | Pipeline autónomo de autoría con validación por código y auditoría externa |
| Fallo pedagógico | Puede escalar a un docente para continuar | Se registra como límite del sistema; el humano no completa la enseñanza experimental |
| Auditoría | Censo del 100 % de actos calificables | Censo de resultados primarios y casos críticos; muestreo estratificado del resto |
| Carga humana | Puede declarar inviable la Etapa 1 | Se mide como resultado; no borra un hallazgo pedagógico, pero puede bloquear despliegue posterior |
| Resultado buscado | Viabilidad de un tutor supervisado | Techo real de sustitución funcional |

> **Nota de versión:** “v3/v4” en esta tabla nombra una transición histórica de la especificación funcional; no compite con la versión 2.8 del Documento Maestro vigente.

### 0.3 Principio rector

> **La IA opera como profesor. El código controla lo verificable. El humano observa desde fuera y no rescata la enseñanza ordinaria.**

---

## 1. Propósito del sistema y pregunta central

### 1.1 Propósito

Construir un sistema capaz de asumir, con la menor intervención humana posible, las funciones ordinarias necesarias para preparar, impartir, adaptar, evaluar y dar continuidad a una experiencia educativa individual.

El sistema debe intentar realizar por sí mismo:

- interpretar un corpus fuente autorizado;
- derivar objetivos observables;
- construir un mapa de conceptos y prerrequisitos;
- preparar sesiones y materiales;
- generar ejemplos, ejercicios, pistas y rúbricas operativas;
- conducir una clase conversacional;
- diagnosticar errores y adaptar la explicación;
- verificar respuestas mediante componentes deterministas cuando el dominio lo permita;
- decidir avance, reenseñanza, recuperación o cierre;
- medir dominio operativo;
- preparar la sesión siguiente;
- registrar todas sus decisiones de manera reconstruible.

### 1.2 Pregunta principal de la Etapa 1

> **Para este alumno, esta subunidad y este procedimiento, ¿puede el Profesor IA producir aprendizaje nuevo, transferencia y retención sin que un docente humano prepare u opere ordinariamente las clases?**

La pregunta conserva los tres componentes. Un informe que no haya ejecutado una medida de retención preinscrita debe responder el componente de retención como **no evaluado** y no puede presentar la pregunta completa como resuelta.

### 1.3 Preguntas secundarias

1. ¿Qué proporción de la preparación puede realizarse sin autoría docente manual?
2. ¿Qué tipos de error aparecen en el contenido generado automáticamente?
3. ¿Cuántas intervenciones humanas extraordinarias resultan necesarias y por qué?
4. ¿En qué funciones se rompe primero la autonomía: autoría, explicación, adaptación, evaluación, seguimiento o gobernanza?
5. ¿Qué carga humana residual queda detrás del sistema?
6. ¿Qué partes del diseño podrían convertirse después en un producto sostenible?

### 1.4 Lo que la Etapa 1 no intenta demostrar

La Etapa 1 no demuestra:

- que la IA sea equivalente a todos los profesores;
- que sea mejor que un profesor humano;
- que funcione para una población estudiantil;
- que funcione para otras materias;
- que ahorre tiempo a escala;
- que esté lista para calificación oficial;
- que pueda operar sin ningún responsable humano o jurídico.

---

## 2. Tesis de autonomía

### 2.1 Sustitución funcional, no desaparición de responsabilidad

La sustitución buscada es **funcional y operativa**.

El Profesor IA sustituye al docente en:

- preparación pedagógica ordinaria;
- conducción de la sesión;
- explicación;
- adaptación;
- práctica;
- evaluación formativa;
- progresión;
- seguimiento.

No sustituye:

- al responsable legal del tratamiento de datos;
- al responsable de seguridad;
- al auditor independiente;
- al comité o persona que autoriza la existencia del experimento;
- al mecanismo de atención de quejas y retirada.

La expresión adecuada para presentar el piloto es:

> **Enseñanza operada por un Profesor IA sin docente humano en el circuito ordinario de la clase.**

### 2.2 Interacción humana mínima aceptable

La intervención humana se limita a cinco funciones externas:

1. **Definir el sobre experimental:** participante, subunidad, duración, corpus fuente y restricciones éticas.
2. **Autorizar el inicio del piloto:** verificar que los controles técnicos y jurídicos existen.
3. **Auditar sin intervenir:** revisar resultados y muestras después de que el sistema haya actuado.
4. **Atender seguridad, privacidad, retirada o apelación:** nunca sustituir pedagógicamente a la IA dentro de la condición experimental.
5. **Corregir el sistema entre ejecuciones:** toda corrección cambia la versión y se registra como desviación o nueva corrida.

### 2.3 Regla de no rescate pedagógico

Durante una sesión válida, un humano no puede:

- explicar el concepto que la IA no logró explicar;
- elegir el siguiente ejemplo;
- corregir una pista en tiempo real;
- proporcionar la solución;
- decidir que una respuesta es correcta para permitir el avance;
- reescribir el plan de la sesión;
- completar manualmente un bloque fallido.

Si el sistema no logra enseñar un concepto dentro de la política permitida, debe:

1. cerrar el bloque como **no dominado**;
2. registrar la causa probable;
3. conservar la evidencia;
4. decidir automáticamente si intenta una recuperación posterior o finaliza la ruta;
5. reportarlo como límite de autonomía.

### 2.4 Regla de no enseñanza paralela

El alumno conserva acceso a un responsable humano para seguridad, dudas sobre el estudio, privacidad, apelación y retirada.

Sin embargo, durante las fases experimentales no debe recibir enseñanza humana paralela sobre los mismos conjuntos de conceptos, porque eso impediría atribuir el aprendizaje observado al Profesor IA.

---

## 3. Alcance de la Etapa 1

### 3.1 Modalidad

- Un alumno por sesión.
- Alumno adulto.
- La primera versión funcional admite **texto, voz y pizarrón**.
- Las capacidades activas de cada corrida se fijan en el manifiesto mediante *capability flags*.
- Duración objetivo aproximada de una hora, con límite máximo configurable.
- Sin calificaciones oficiales.
- Sin clases grupales.
- Sin cámara/webcam, reconocimiento facial, biometría, inferencia emocional ni proctorización.
- La captura de la propia interfaz puede habilitarse; la captura de ventanas o pantalla externa queda experimental y requiere activación explícita del alumno.

#### 3.1.1 Regla multimodal

La enseñanza puede utilizar voz, texto, pizarrón y anotaciones, pero la representación canónica de los actos pedagógicos evaluables sigue siendo estructurada y reconstruible.

- **Profesor IA:** primero genera y valida texto; después ese texto puede sintetizarse a voz.
- **Alumno:** el audio se convierte a una transcripción final comprometida antes de entrar al motor como mensaje. Los parciales de STT son solo UI y no producen decisiones irreversibles.
- **Actividades formales:** las derivaciones puntuables continúan realizándose mediante el editor Fitch y el verificador determinista.
- **Visión:** se usa como percepción auxiliar cuando el estado estructurado de la interfaz o del pizarrón no basta; nunca sustituye al verificador formal.
- **Audio bruto del alumno:** no se conserva por defecto. Su retención requiere finalidad explícita, consentimiento y política congelada.

### 3.1.2 Modos de uso de la aplicación

La aplicación distingue dos carriles funcionales:

1. **`VALIDATED_LOGIC_COURSE`** — curso experimental de referencia, sujeto al cálculo autorizado, SCED, reservas, freeze, medición y veredictos de Etapa 1.
2. **`CUSTOM_COURSE_UNVALIDATED`** — materia creada por el usuario para uso funcional general. Puede investigar, estructurar, enseñar, adaptar y persistir progreso, pero no hereda automáticamente validez experimental ni autoridad formal del carril de lógica.

La UI debe mostrar esta diferencia de forma comprensible sin presentar el modo personalizado como defectuoso: es funcionalmente útil, pero metodológicamente **no validado por este experimento**.

La creación de una materia personalizada parte de un sobre mínimo del usuario —materia, tema/subunidad opcional, nivel/perfil, objetivo personal, tiempo disponible y restricciones— y permite que el pipeline generalizable produzca una propuesta de curso. Cuando el dominio no disponga de un verificador determinista específico, la evaluación se limita a mecanismos compatibles con la autoridad disponible y no finge equivalencia con `logic-core`.

### 3.2 Dominio piloto

- Área: lógica aplicada a informática o inteligencia artificial.
- Unidad de referencia: deducción natural en lógica proposicional.
- Alcance experimental: una **subunidad cerrada** compuesta por tres conjuntos de componentes de conocimiento enseñables de manera escalonada.

La reducción a una subunidad no reduce la ambición de autonomía. Reduce únicamente la extensión temática para poder medir con suficiente control.

### 3.3 Corpus fuente

El corpus que llegue a la preparación curricular debe ser:

- externo al sistema;
- anterior a la corrida experimental;
- fijo durante la corrida;
- legalmente utilizable;
- versionado;
- hasheado;
- suficientemente explícito sobre definiciones, notación y reglas;
- no modificable por el Profesor IA durante la enseñanza.

La selección puede originarse de dos maneras:

1. selección humana directa; o
2. **propuesta autónoma del sistema** producida por W0/H4.5.

Para la dirección actual del proyecto se prefiere la segunda: el sistema investiga, compara y propone; el humano **autoriza el corpus**, pero no redacta el currículo.

`authorized-calculus-v1`, su `formal_system_id` y el snapshot ancla de *forall x: Calgary* son parte del **sobre experimental ya congelado**. W0 no recibe crédito de autonomía por elegirlos; su autonomía se evalúa sobre descubrimiento, comparación, cobertura y propuesta de fuentes complementarias compatibles con ese sistema objetivo.

La autorización del corpus es una frontera externa de gobernanza y no constituye autoría docente ordinaria. Si una propuesta se rechaza por alcance, seguridad, legalidad o gobernanza, el estado pasa a `corpus_rechazado → W0_reinvestigacion → propuesta_corpus`. La causa se registra mediante código y evidencia; el humano no reescribe pedagógicamente la propuesta. Si el espacio de candidatos permitido queda agotado según la regla de saturación/calidad congelada, H4.5 falla y la corrida no avanza.

Idioma operativo de Etapa 1:

- enseñanza, interfaz, instrucciones, rúbricas visibles, claims operativos y reportes dirigidos al participante se producen en **español**;
- W0 puede admitir fuentes en otros idiomas cuando aporten autoridad, cobertura o precisión que no esté disponible de forma equivalente en español;
- todo claim traducido conserva `source_text_original`, fragmento/ubicación, `translated_text`, idioma origen/destino y versión del traductor/modelo cuando aplique;
- la atribuibilidad se juzga contra el fragmento original. Un validador NLI automático solo puede actuar como gate en pares de idioma/estratos cuya fiabilidad haya quedado demostrada por `CAL-NLI`; en los demás casos es señal auxiliar o requiere auditoría humana;
- cuando existan fuentes equivalentes de autoridad/calidad suficiente, W0 puede priorizar español para reducir riesgo translingüe, sin convertir el idioma en sustituto de autoridad.

Durante la corrida experimental:

- no hay navegación web libre;
- no se añaden fuentes nuevas;
- no se cambia silenciosamente el contenido;
- cualquier laguna se registra y se resuelve en una nueva versión posterior.
### 3.4 Sobre inicial proporcionado por humanos

Antes de la investigación y preparación autónoma, el proyecto entrega únicamente:

- identificación de la materia;
- subunidad o alcance máximo;
- perfil mínimo del alumno cuando exista;
- duración y calendario máximos;
- restricciones éticas y de seguridad;
- formato de evaluación permitido;
- política de datos;
- política de fuentes permitidas;
- política de licencias aceptables.

El humano **no entrega como requisito**:

- objetivos observables;
- mapa de conceptos;
- grafo de prerrequisitos;
- currículo;
- banco de reactivos;
- pistas;
- rúbricas pedagógicas completas;
- plan de sesiones;
- ejemplos;
- secuencia didáctica;
- recuperaciones.

Esos artefactos corresponden al Profesor IA y a sus componentes automáticos.

Después de W0/H4.5, el sistema presenta una **propuesta de corpus**. El responsable humano la autoriza o la rechaza por motivos de alcance, seguridad, legalidad o gobernanza; no la reescribe como profesor.
## 4. Distribución vinculante de funciones

| Función | Responsable ordinario | Control externo |
|---|---|---|
| Definir materia, subunidad y límites | Proyecto humano | Registro |
| Descubrir fuentes candidatas | Pipeline de investigación | Política de repositorios y registro |
| Evaluar idoneidad de fuentes | Pipeline de investigación | Fórmula versionada + auditoría |
| Comparar fuentes y detectar conflictos | Pipeline de investigación | Clasificación de conflicto y auditoría |
| Proponer corpus complementario compatible con el cálculo/ancla congelados | Pipeline de investigación | Trazabilidad completa; no reclama autonomía sobre `authorized-calculus-v1`/Calgary |
| Autorizar o rechazar corpus | Humano responsable | Registro de autorización/rechazo; rechazo vuelve a W0 sin autoría pedagógica humana |
| Verificar licencia dudosa | Humano/jurídico | Fuente primaria |
| Interpretar el corpus autorizado | IA | Anclaje y consistencia |
| Derivar objetivos observables | IA | Linter y auditoría por muestra |
| Construir mapa y dependencias | IA | Restricciones formales + auditoría |
| Crear plan de unidad y sesiones | IA | Restricciones del motor |
| Generar explicaciones y ejemplos | IA | Anclaje al corpus y filtros |
| Generar ejercicios | IA | Buscador de soluciones, verificador y filtros |
| Generar pistas | IA | Política de no revelación |
| Crear rúbricas operativas | IA | Esquema cerrado y validación |
| Calcular validez de derivaciones | Verificador determinista | Conjunto dorado + oráculo semántico |
| Estimar complejidad estructural | Código | Se declara aproximación |
| Conducir conversación | Agente de sesión | Estado estructurado y anclaje |
| Adaptar explicación y ritmo | Motor + IA | Límites preinscritos |
| Decidir avance y recuperación | Motor determinista | Política congelada |
| Calificar actividades formales | Verificador + rúbrica | Auditoría externa |
| Preparar siguiente sesión | IA + motor | Estado y manifiesto |
| Seleccionar estrategia pedagógica | Motor determinista | Política pedagógica versionada y congelada |
| Redactar/ejecutar lingüísticamente la estrategia seleccionada | IA | Contrato de estrategia + anclaje + filtros |
| Ajustar nivel de andamiaje y *fading* | Motor determinista | Señales observables + reglas congeladas |
| Programar *retrieval* y *spacing* | Motor/calendario | Ventanas preinscritas y reservas separadas |
| Calcular BKT sombra, si se habilita | Módulo analítico no autoritativo | Sin efecto en avance/dominio |
| Medir aprendizaje independiente | Módulo de sondas aislado | Auditoría ciega |
| Resolver seguridad, privacidad y retirada | Humano responsable | Procedimiento documentado |
| Auditar el experimento | Humano independiente | Sin intervención pedagógica retroactiva |

Antes del freeze, cada función de esta matriz recibe una **clase de criticidad** por consecuencia de fallo: `SEGURIDAD`, `INTEGRIDAD_EVIDENCIA`, `EVALUACION`, `PEDAGOGIA`, `EXPERIENCIA` o combinación explícita. La clasificación no decide por sí sola si una función es autónoma; sirve para estratificar fallos y evitar que un gran número de decisiones triviales oculte fallos raros pero críticos.

## 5. Definiciones operativas

### 5.1 Componente de conocimiento

Un componente de conocimiento o **KC** es la unidad mínima que puede enseñarse, practicarse, fallarse, verificarse y trazarse de forma independiente.

Reglas:

- cada paso de una derivación debe etiquetarse con un **KC principal** y puede registrar cero o más **KC de soporte** cuando el desempeño dependa también de una competencia transversal;
- un KC debe poder fallarse sin que necesariamente fallen todos los demás;
- las dependencias se representan como grafo dirigido y cada arista se etiqueta como `FORMAL`, `POLITICA_CONTENIDO`, `PEDAGOGICA`, `CONCEPTUAL_ANALOGICA` o `ESTADISTICA`;
- `FORMAL` significa necesidad lógica/estructural dentro del cálculo autorizado; `POLITICA_CONTENIDO` significa una dependencia creada por una restricción de contenido congelada para la corrida, aunque el cálculo general no la exija; `PEDAGOGICA` significa orden de enseñanza; `CONCEPTUAL_ANALOGICA` significa relación útil sin necesidad formal; `ESTADISTICA` significa relación inferida de datos y nunca puede alterar una corrida ya congelada;
- el mapa se genera automáticamente, se pre-registra y se congela antes del piloto;
- el mapa congelado es una **hipótesis de modelado**, no una verdad científica: cualquier división, fusión o reetiquetado posterior crea una nueva versión y no modifica retroactivamente la corrida.

### 5.2 Mapa operativo inicial de la unidad

El pipeline puede ajustar el subconjunto experimental, pero parte de `authorized-calculus-v1` y de este catálogo explícito. Las etiquetas `F`, `PC`, `P`, `C/A` y `E` significan respectivamente FORMAL, POLÍTICA_DE_CONTENIDO, PEDAGÓGICA, CONCEPTUAL/ANALÓGICA y ESTADÍSTICA.

| Código | Componente de conocimiento | Dependencias principales tipadas | Estado en Etapa 1 |
|---|---|---|---|
| KC01 | Fórmulas bien formadas, conectivos y corchetes del cálculo | — | Obligatorio |
| KC02 | Notación Fitch, citas de líneas y lectura de subpruebas | F: KC01 | Obligatorio |
| KC03 | Reiteración `R` | F: KC02 | Obligatorio |
| KC04 | Introducción de conjunción `∧I` | F: KC01–KC02 | Obligatorio |
| KC05 | Eliminación de conjunción `∧E` | F: KC01–KC02 | Obligatorio |
| KC06 | Eliminación del condicional `→E` | F: KC01–KC02 | Obligatorio |
| KC07 | Introducción de disyunción `∨I` | F: KC01–KC02 | Obligatorio |
| KC08 | Alcance, accesibilidad y descarga de supuestos | F: KC02 | Transversal |
| KC09 | Introducción del condicional `→I` | F: KC08 | Condicional al alcance del conjunto |
| KC10 | Obtención de `⊥` mediante `¬E` | F: KC01–KC02 | Obligatorio cuando el conjunto lo requiera |
| KC11 | Introducción de negación `¬I` | F: KC08, KC10 | Obligatorio cuando el conjunto lo requiera |
| KC12 | Explosión `X` (`⊥E`) | PC: KC10 por política de contenido de Etapa 1 | Obligatorio cuando el conjunto lo requiera |
| KC13 | Eliminación de disyunción / prueba por casos `∨E` | F: KC08 + disponer de una disyunción; P: KC07 | Condicional al alcance del conjunto |
| KC14 | Introducción del bicondicional `↔I` | F: KC08, KC09 | Obligatorio cuando el conjunto lo requiera |
| KC15 | Eliminación del bicondicional `↔E` | C/A: KC06 | Obligatorio cuando el conjunto lo requiera |
| KC16 | Eliminación de doble negación `DNE` | F: KC01; C/A: KC10, KC11 | Derivada permitida |
| KC17 | Prueba indirecta `IP` — RAA clásica | F: KC08, KC10; el orden respecto de KC16 es P, no necesidad formal | Primitiva clásica |
| KC18 | Selección de estrategia y trabajo hacia atrás | P/integración: KC03–KC17 | Opcional y no determinante |

Reglas vinculantes:

- `KC10` registra siempre `rule_id = "¬E"`. No existe una regla canónica `⊥I`; una etiqueta de entrada heredada, si se acepta por UX, se canonicaliza a `¬E` y nunca aparece como id formal en la traza.
- En reactivos experimentales de Etapa 1, `⊥` **no aparece como premisa ni como supuesto inicial independiente**. Puede aparecer como resultado de una derivación autorizada. Esta restricción crea la arista `KC12 PC:KC10`: es una dependencia de política de contenido, no una necesidad lógica del cálculo general. Para seleccionar conjuntos, el validador enumera aristas `FORMAL` y `POLITICA_CONTENIDO` por separado; ambas se tratan conservadoramente como posibles rutas de contaminación si cruzan conjuntos.
- `KC16/DNE` es derivada autorizada y elimina exactamente dos negaciones por aplicación.
- `KC17/IP` es primitiva y es la única regla clásica primitiva de `authorized-calculus-v1`.
- `¬I` e `IP/RAA` permanecen separados en contenido, etiquetado y trazas: `¬I` supone `φ` y concluye `¬φ`; `IP` supone `¬φ` y concluye `φ` al derivar `⊥`.
- `↔` es primitivo; KC14 usa `↔I` y KC15 usa `↔E`. Se elimina la bifurcación heredada que dependía de expandir el bicondicional.
- Los tres conjuntos experimentales referencian exactamente `authorizedCalculusVersion = "authorized-calculus-v1"`. La referencia por conjunto existe para trazabilidad, no para habilitar inventarios distintos de reglas.

### 5.2.1 Fundamentos previos a la línea base

KC01, KC02 y KC08 son **fundamentos compartidos** de Etapa 1. Para evitar que la línea base mida desconocimiento del formato Fitch en vez de los KC experimentales:

- no pueden ser KC objetivo de los conjuntos A/B/C; pueden aparecer únicamente como KC de soporte;
- después de la familiarización puramente de interfaz, Profesor IA los enseña en `LEARNING_MODE` mediante una fase `foundation_phase` con materiales que no pertenecen a las reservas experimentales;
- la fase puede comprobar comprensión de esos fundamentos, pero sus resultados no forman parte de la inferencia causal SCED ni se mezclan con `probe_accuracy` de A/B/C;
- el diagnóstico previo al SCED no enseña ni da retroalimentación sobre KC objetivo de A/B/C. El primer contacto puntuable con esos KC es una sonda de línea base conforme al contrato de medición;
- si el participante no alcanza el criterio preinscrito de suficiencia de fundamentos, la corrida experimental no inicia. Se registra `foundation_not_ready`; el resultado cuenta para autonomía/viabilidad y como límite descriptivo de la preparación, pero no como resultado negativo de una transición A/B/C;
- la enseñanza de fundamentos es realizada por Profesor IA y se registra en la matriz de autonomía; un humano no puede completarla pedagógicamente para habilitar el piloto.

### 5.3 Dominio operativo

Un KC se marca como dominado durante la enseñanza cuando se cumplen ambas condiciones:

1. tres respuestas correctas consecutivas con complejidad estructural no decreciente;
2. al menos una respuesta de transferencia cercana no isomorfa a las prácticas inmediatas.

Para contar dentro de estas condiciones, el intento debe ser **elegible para dominio**. La autoridad sobre `masteryDisqualifying` pertenece al código, no al generador de pistas:

- nivel 1 puede ser `masteryDisqualifying=false` únicamente cuando recuerda objetivo/definición sin seleccionar la regla ni el siguiente paso;
- niveles 2–5 son `masteryDisqualifying=true` para el controlador de dominio de Etapa 1;
- cualquier pista que entregue regla aplicable al caso, siguiente operación, fórmula intermedia, solución parcial suficiente o contenido equivalente queda descalificadora aunque haya sido etiquetada de otro modo por el modelo;
- la bandera producida durante autoría es una propuesta auditable; el linter recalcula la bandera autoritativa y rechaza discrepancias.

Un acierto con ayuda descalificadora no cuenta hasta una reconfirmación posterior sin esa ayuda. Además, cada declaración válida de dominio crea automáticamente una `post_mastery_reconfirmation_pending`: el motor programa la primera oportunidad posterior elegible de práctica independiente en `LEARNING_MODE`, antes de cualquier reenseñanza deliberada del mismo KC y, como máximo, antes de la siguiente sesión en la que ese KC vuelva a ser objetivo. Se usa una reserva de práctica independiente, nunca una reserva de medición. Si retirada, cierre de corrida o falta válida de reserva impiden observarla, se registra faltante; no se convierte en falso dominio.

Los valores anteriores son **parámetros operativos del controlador para la corrida**, no constantes científicas universales. Se congelan antes de la corrida y su sensibilidad se analiza después; cualquier cambio exige nueva versión/preinscripción. El índice de complejidad necesario para la condición no decreciente debe tener pesos y criterio de comparabilidad congelados en H5; una refinación posterior en H10 solo informa corridas futuras y nunca reordena retroactivamente intentos o conjuntos.

El dominio operativo decide la conducta del motor, pero **no equivale a aprendizaje demostrado**. BKT u otra estimación probabilística, si existe, no altera esta regla en Etapa 1.

### 5.4 Aprendizaje

Aprendizaje es desempeño correcto en sondas nuevas:

- sin agente conversacional;
- sin pistas;
- sin retroalimentación inmediata;
- con tiempo definido;
- tomadas de una reserva independiente;
- corregidas por el verificador y auditadas externamente según §11.

### 5.5 Retención

Retención es desempeño en nuevas sondas aplicadas después de la enseñanza mediante una reserva exclusiva en `MEASUREMENT_MODE`.

Etapa 1 usa un único intervalo primario de **7 días calendario por conjunto experimental**. El reloj inicia en `set_mastery_timestamp`, definido como el instante en que todos los KC objetivo del conjunto alcanzan dominio operativo válido. No existe un reloj primario independiente por KC en esta Etapa 1.

Desde `set_mastery_timestamp` hasta la sonda de retención no se programa reenseñanza deliberada, práctica puntuable ni feedback dirigido a los **KC objetivo** de ese conjunto. Los fundamentos compartidos KC01/KC02/KC08 pueden reaparecer como soporte general siempre que no constituyan el objetivo puntuado ni revelen la solución de la futura sonda. Si otro conjunto necesitara como prerrequisito un KC objetivo del conjunto retenido, la partición se considera incompatible y debe rechazarse antes de H5.

La reserva de retención permanece aislada de diagnóstico, práctica, recuperación, sondas primarias inmediatas, `TRANSFER_MASTERY` y `TRANSFER_MEASUREMENT`. No se reutilizan reactivos, duplicados triviales ni variantes isomorfas prohibidas por la canonicalización congelada. Una sonda de retención es una medida separada: **no incrementa** el contador de `probe_round` ni constituye una observación de la serie SCED primaria.

Si la medición de 7 días no puede ejecutarse con reserva válida y sin contaminación, se registra `retention_not_evaluated`; no se sustituye por otro intervalo elegido post hoc ni se infiere retención desde dominio o transferencia inmediata.

El intervalo de 7 días es una **decisión de diseño de esta Etapa 1**, no una afirmación de optimalidad pedagógica universal. La suficiencia real del banco/calendario sigue siendo un pendiente operativo `CALIBRABLE` que se comprueba en H5/H10.

### 5.6 Autonomía funcional

La autonomía se mide por función, no mediante una etiqueta binaria ni mediante un porcentaje global aislado.

Para cada función se registra:

- ejecutada sin ayuda;
- ejecutada con control automático;
- ejecutada con intervención humana extraordinaria;
- fallida;
- no evaluada.

El **artefacto primario de autonomía** es la matriz `función × estado`, estratificada por la criticidad definida en §5.6.1 y con denominadores visibles. `no evaluada` permanece visible y nunca se convierte implícitamente en éxito.

Puede calcularse un porcentaje agregado de decisiones autónomas como métrica descriptiva secundaria, pero:

- debe mostrar numerador, denominador y tratamiento de `no evaluada`;
- no puede ser el titular del veredicto de autonomía;
- no sustituye el análisis por función/criticidad;
- no permite afirmar que una función crítica es autónoma solo porque decisiones frecuentes de baja criticidad dominan el conteo.

### 5.6.1 Criticidad por función

Cada función declara `criticality_class[]` y `failure_effect`. La clasificación se determina por la consecuencia de fallo, no por frecuencia ni por conveniencia operativa.

- **SEGURIDAD — BLOCKING:** consentimiento/retiro; identidad/pseudonimización; permisos/credenciales; privacidad y minimización; backup/restore de evidencia; protección de `private_solutions` y `measurement`.
- **INTEGRIDAD_EVIDENCIA — BLOCKING:** freeze/manifiestos/hashes; `evidence-ledger`; consumo atómico de reservas; separación `TRANSFER_MASTERY`/`TRANSFER_MEASUREMENT`; reconstrucción de decisiones; versionado de cálculo, contenido y modelos.
- **EVALUACION — BLOCKING:** `logic-core`, calificación formal, `measurement-worker`, selección/aislamiento de sondas, `MEASUREMENT_MODE`, aplicación de rúbricas deterministas y registro de fase.
- **PEDAGOGIA — BLOCKING para autonomía, no autoridad evaluativa:** `pedagogy-policy`, selección de estrategia, transición, dominio, recuperación y límites de ayuda. Un fallo puede detener la corrida, pero nunca autoriza rescate pedagógico humano.
- **EXPERIENCIA — DEGRADABLE salvo que impida acceso válido a la tarea:** TTS, pizarrón, overlays/anotaciones, elementos cosméticos y capacidades multimodales auxiliares. Su fallo degrada a una modalidad autorizada cuando exista y no puede convertirse en error conceptual del alumno.

STT y visión adquieren además `PEDAGOGIA` o `EVALUACION` cuando su salida participe efectivamente en una decisión de esa clase; la percepción por sí sola nunca obtiene autoridad formal. Una función con múltiples consecuencias conserva todas las clases aplicables. Un número alto de fallos `EXPERIENCIA` nunca compensa ni oculta un fallo `SEGURIDAD`, `INTEGRIDAD_EVIDENCIA` o `EVALUACION`.

### 5.7 Intervención humana

Toda acción humana relacionada con el piloto se clasifica como:

- configuración del sobre experimental;
- autorización inicial;
- seguridad o privacidad;
- apelación o retirada;
- auditoría posterior;
- corrección entre versiones;
- intervención pedagógica prohibida.

Si ocurre una intervención pedagógica prohibida sobre un conjunto experimental, los actos afectados no pueden atribuirse exclusivamente al Profesor IA.

### 5.8 Sesión válida

Una sesión es válida cuando:

- la identidad se resolvió conforme a la política;
- el manifiesto de versiones coincide;
- no hubo enseñanza humana sobre el contenido experimental;
- las evidencias primarias están completas;
- no se revelaron soluciones calificadas;
- el verificador utilizado estaba aprobado;
- los fallos no comprometieron transversalmente la sesión.

La invalidación es localizada por defecto. Solo se invalida toda la sesión si el daño afecta identidad, integridad, versiones, aislamiento de soluciones o evidencia primaria.

### 5.9 Modo pedagógico

Toda actividad de sesión declara uno de dos modos principales:

- `LEARNING_MODE`: permite explicación, ejemplos, práctica, feedback y ayudas según la política congelada;
- `MEASUREMENT_MODE`: protege la medición; deshabilita ayuda no autorizada y aplica las reglas de no revelación y aislamiento correspondientes.

El modo lo decide el motor. El modelo no puede cambiarlo.

### 5.10 Estrategia pedagógica

Una estrategia pedagógica es una acción o secuencia de enseñanza seleccionada por el motor a partir de señales observables y una política versionada. En Etapa 1 el catálogo base puede incluir:

- explicación directa breve;
- ejemplo trabajado;
- ejemplo incompleto/*completion problem*;
- práctica guiada;
- práctica independiente;
- *scaffolding* contingente;
- *fading* contingente;
- autoexplicación guiada;
- *retrieval practice*;
- feedback correctivo centrado en tarea/proceso;
- recuperación de prerrequisito;
- comprobación de transferencia cercana.

El catálogo y sus reglas de activación se congelan por corrida. El agente de sesión no inventa nuevas categorías con autoridad operativa.

### 5.11 Transferencia cercana

Para Etapa 1, una actividad de transferencia exige aplicar el mismo KC o estructura profunda en una forma superficial suficientemente distinta de las prácticas inmediatas. No se usa el piloto para afirmar transferencia lejana entre dominios.

Existen dos usos operativamente distintos:

- `TRANSFER_MASTERY`: actividad en `LEARNING_MODE` usada por el controlador para comprobar dominio operativo. Puede recibir la política de feedback que corresponda después del intento y **no cuenta** como resultado experimental de transferencia;
- `TRANSFER_MEASUREMENT`: actividad en `MEASUREMENT_MODE`, sin agente, pistas ni retroalimentación inmediata, tomada de una reserva exclusiva. **Solo esta categoría** puede alimentar la medida experimental de transferencia.

Los bancos, IDs y eventos de ambas categorías son distintos. Un reactivo consumido, su duplicado trivial o una variante detectada como isomorfa en una categoría no puede aparecer en la otra.

Para proteger las reservas se adopta una **definición operacional de isomorfismo**: dos reactivos son isomorfos cuando su estructura de prueba normalizada coincide bajo renombrado de átomos y reordenamiento de pasos independientes permitido por el cálculo. Los duplicados triviales son un caso más estricto; dos reactivos pueden compartir KC sin ser isomorfos.

El detector opera sobre representación estructural/grafo normalizado además de controles de superficie. Su precisión se valida antes del freeze y sus falsos negativos/positivos se auditan. Esta definición es una convención de ingeniería del proyecto, no una afirmación de que exista una única noción científica universal de isomorfismo pedagógico.

El mínimo vigente de una sonda de transferencia por criterio de dominio se conserva como parámetro del protocolo actual; no se presenta como suficiencia estadística universal. Aumentarlo para KC críticos queda condicionado a disponibilidad de banco, calendario y preinscripción.

### 5.12 Wheel-spinning

`wheel_spinning` es una señal operacional de estancamiento: acumulación de intentos sin progreso suficiente bajo la política vigente. Su umbral es calibrable y se congela por corrida. Detectarlo puede activar diagnóstico, cambio de estrategia, reducción de paso, revisión de prerrequisito o recuperación; no habilita rescate docente en vivo.

### 5.13 Métrica sombra de dominio

Una métrica probabilística como BKT puede calcularse en paralelo para investigación interna siempre que:

- no decida avance, dominio, recuperación ni cierre;
- no sea visible al agente si puede sesgar su conducta;
- sus parámetros y versión estén congelados;
- su calibración se analice después de la corrida;
- cualquier uso autoritativo futuro requiera una nueva preinscripción.

---

## 6. Flujo general de la Etapa 1

### 6.1 Fase 0 — Construcción y calibración del sistema

Esta fase no cuenta como prueba de autonomía del participante.

Incluye:

1. implementar el verificador;
2. crear el conjunto dorado;
3. validar el oráculo semántico;
4. construir el pipeline de autoría;
5. ejecutar pruebas adversariales de fuga de solución;
6. realizar sesiones secas con datos sintéticos;
7. verificar privacidad, restauración y bitácora;
8. medir el desempeño del modelo seleccionado;
9. probar con datos sintéticos la política pedagógica, transiciones de estrategia, niveles de ayuda y separación `LEARNING_MODE`/`MEASUREMENT_MODE`;
10. calibrar señales de estancamiento y, si se habilita, BKT en modo sombra sin autoridad;
11. congelar reglas de paso, política pedagógica y criterios de incidente.

En esta fase puede existir revisión humana intensa para corregir el sistema, pero no autoría manual del banco final como sustituto del pipeline.

### 6.2 Fase 1 — Investigación, preparación autónoma y congelamiento

1. El sistema recibe materia, subunidad, restricciones y política de fuentes.
2. Ejecuta W0/H4.5 para descubrir fuentes candidatas.
3. Registra versión, origen, licencia y evidencia de cada candidata.
4. Evalúa idoneidad y cobertura.
5. Compara fuentes y clasifica diferencias como contradicción, convención, cálculo distinto o decisión pedagógica.
6. Se detiene por una política de cobertura/saturación calibrada.
7. Produce una propuesta de corpus.
8. El humano autoriza externamente el corpus.
9. W1 ingiere las fuentes autorizadas, calcula hashes y fragmenta con IDs estables.
10. La IA extrae definiciones, reglas, notación y restricciones.
11. Detecta contradicciones o faltantes.
12. Construye objetivos, mapa de KC y dependencias.
13. Selecciona los tres conjuntos experimentales.
14. Genera bancos separados para enseñanza, recuperación, sondas primarias, `TRANSFER_MASTERY`, `TRANSFER_MEASUREMENT` y retención.
15. Genera pistas y rúbricas.
16. Busca soluciones mediante código.
17. Rechaza automáticamente artefactos que no superen los filtros.
18. Calcula métricas de cobertura y complejidad estructural.
19. Ejecuta auditoría humana por muestra sobre el paquete candidato.
20. Si la muestra supera los umbrales, el paquete completo se congela sin aprobación manual reactivo por reactivo.
### 6.3 Fase 2 — Piloto autónomo

1. El alumno inicia sesión.
2. El sistema informa que la enseñanza será operada por IA.
3. Ejecuta diagnóstico y familiarización.
4. Instancia el plan.
5. Conduce cada bloque sin intervención docente.
6. Aplica sondas de línea base e intervención según calendario.
7. Registra fallos de autonomía.
8. Cierra y prepara la sesión siguiente.

### 6.4 Fase 3 — Auditoría y análisis

Después de las sesiones:

- se auditan resultados primarios;
- se revisan muestras de explicaciones y artefactos;
- se clasifican incidentes y fallos;
- se calcula carga humana residual;
- se analiza aprendizaje, retención y transferencia;
- se emiten veredictos separados de autonomía, aprendizaje, seguridad y viabilidad.

---

## 7. Pipeline autónomo de autoría

### 7.0 Investigación y curación de fuentes — W0/H4.5

La adquisición de conocimiento ocurre **antes** de la ingesta del corpus y fuera de la sesión del alumno.

Flujo:

```text
solicitud_curso
  → alcance_acotado
  → fuentes_descubiertas
  → fuentes_evaluadas
  → fuentes_comparadas
  → licencias_clasificadas
  → cobertura_evaluada
  → propuesta_corpus
  → corpus_autorizado
  → W1_ingesta
```

#### Descubrimiento

Para Etapa 1 se usa una estrategia de menor complejidad:

- repositorios educativos y académicos autorizados;
- conectores o adaptadores cuando exista API/índice estable;
- búsqueda abierta solo como complemento;
- registro obligatorio de URL/origen, versión, fecha de recuperación y evidencia de licencia;
- snapshot/hash generado **en W0 al evaluar idoneidad**; W1 comprueba identidad de hash antes de ingerir y bloquea cualquier deriva no reevaluada;
- sin crawler web general.

La lista blanca no implica que cada recurso sea confiable o jurídicamente reutilizable: cada recurso se evalúa individualmente.

**Autoridad externa:** solo una referencia comprobada contra su publicación primaria u organismo emisor puede fundamentar una obligación, un número normativo, una dependencia `FORMAL` o un gate de Profesor IA. Una referencia no verificada primariamente puede conservarse como antecedente o motivación, pero no adquiere autoridad normativa hasta completar esa verificación. WWC 5.0 se usa como referencia metodológica de revisión; SCRIBE 2016 como checklist de reporte; AIS como marco de atribuibilidad a fuentes identificadas; Liang et al. (2015) únicamente como antecedente sobre relaciones de prerrequisito.

Para claims sobre el cálculo autorizado, W0 usa como ancla documental de `authorized-calculus-v1` *forall x: Calgary*, edición Fall 2025, revisión `8642250` de 2026-07-18, snapshot PDF SHA-256 `2a8fea85b358fb45ba7835dee5166b5990b7a7c11ad4dc6c41ebdd9a265c1888`. Una versión publicada posteriormente no cambia el cálculo de una corrida ya congelada.

#### Score de idoneidad

Puede calcularse un `source_suitability_score` para ordenar candidatos usando variables observables como autoridad institucional/editorial, revisión, estabilidad/actualidad apropiada, explicitud técnica, verificabilidad y cobertura. La licencia es un **gate separado**. Pesos y umbrales se calibran en H4.5 con el corpus real y permanecen versionados; no son probabilidades de verdad.

#### Comparación y conflictos

El `formal_system_id` objetivo se declara antes de comparar claims. Para Etapa 1 es `forallx-calgary-tfl`. Una fuente que describe otro sistema se clasifica `sistema_formal_distinto` y no participa por mayoría en un claim del sistema objetivo.

Cada claim conserva `formal_system_id`, `notation_family`, versión y alcance. Una diferencia se clasifica como contradicción real, convención alternativa, sistema formal distinto, diferencia pedagógica o información complementaria. La mayoría simple de fuentes no decide una cuestión cuando describen sistemas distintos.

#### Parada de investigación

La investigación se detiene cuando el alcance posee cobertura suficiente, nuevas fuentes aportan poca información nueva durante una ventana calibrada, no quedan conflictos críticos sin clasificar y las licencias necesarias están registradas. Tamaño base, longitud de racha y umbral de información nueva son parámetros `CALIBRABLES` de H4.5; el reporte conserva curva de información nueva y diversidad de linaje.

#### Licencias

Regla conservadora para Etapa 1:

- preferir CC0 / CC BY;
- registrar licencia exacta por recurso, versión y, cuando aplique, sección/componente;
- para todo recurso reutilizable registrar como mínimo `source_component`, `source_version`, `provenance_basis` y `license_evidence`;
- no asumir que la licencia global de una obra cubre material de terceros con permiso o licencia distinta;
- usar NC/SA únicamente cuando el uso previsto sea compatible; no utilizar ND como base expresiva para adaptaciones sin revisión jurídica;
- no copiar expresiones o ejercicios protegidos sin permiso y comparar materiales generados con el corpus para reducir reproducción sustancial accidental;
- generar materiales de novo a partir del conocimiento extraído y conservar trazabilidad y atribución;
- toda duda jurídica bloquea únicamente la sección/componente afectado hasta revisión.

**Caso Calgary:** el snapshot puede usarse como **fuente documental del cálculo**. La licencia global CC BY 4.0 no permite presumir la cadena de derechos de cada ejercicio, explicación o componente. Todo material cuya procedencia concreta dependa únicamente de la indicación “used with permission” se marca `LICENSE_UNRESOLVED` y no puede incorporarse como base expresiva ni reutilizarse hasta resolver la proveniencia y, cuando corresponda, revisión jurídica profesional. LIC-01/LIC-02 no bloquean usar el snapshot para definir el sistema formal; sí bloquean reutilizar material expresivo afectado.

MIT OpenCourseWare y OpenStax se evalúan por recurso y versión. Materiales NC/SA, “all rights reserved” o con permisos de terceros no se convierten en base expresiva predeterminada de un producto potencialmente comercial.

#### Salida de W0

W0 entrega:

- `research/selection-manifest.yaml`;
- inventario de candidatos y mapa de secciones/componentes autorizados, excluidos, `LICENSE_UNRESOLVED` o pendientes;
- snapshot/hash de cada versión evaluada;
- evidencias de licencia y cadena de atribución requerida;
- scores de idoneidad;
- reporte de cobertura/saturación;
- conflictos y justificación de selección;
- referencias o snapshots autorizables.

La fragmentación estable sigue siendo responsabilidad de W1/H5.

### 7.1 Principio

El pipeline de autoría opera fuera de la clase.

> **Los modelos proponen; el código verifica lo verificable; las señales estadísticas ayudan a detectar riesgos; el manifiesto congela; el auditor observa desde fuera.**

No se requiere un sistema multiagente. Los pasos pueden ser ejecutados por un único modelo en llamadas separadas y contratos cerrados. Solo se separarán procesos o modelos cuando un benchmark demuestre una ventaja concreta.
### 7.2 Artefactos generados

El pipeline debe producir:

- contrato operativo del corpus;
- artefacto versionado del cálculo autorizado y su política semántica/de decisión;
- definiciones canónicas extraídas;
- notación autorizada;
- mapa de KC;
- dependencias;
- objetivos observables;
- secuencia de enseñanza;
- perfil pedagógico permitido por KC/tipo de conocimiento;
- matriz de activación de estrategias y reglas de transición;
- política de ayudas, *scaffolding* y *fading* contingente;
- plan congelado de *retrieval/spacing* cuando aplique;
- plantillas de autoexplicación guiada y feedback de tarea;
- plantillas de sesión;
- explicaciones base;
- ejemplos;
- reactivos de práctica;
- reactivos de recuperación;
- sondas independientes;
- reactivos de retención;
- pistas escalonadas, cada una con metadatos estructurados de nivel y de si la ayuda vuelve el intento no elegible para dominio;
- rúbricas estructuradas;
- pruebas adversariales;
- metadatos de complejidad;
- trazas de origen y anclaje.

### 7.3 Roles lógicos internos permitidos

Pueden existir funciones separadas para:

- extracción curricular;
- diseño pedagógico;
- generación de reactivos;
- redacción de pistas;
- crítica de ambigüedad;
- revisión de anclaje;
- simulación de errores;
- revisión adversarial de fuga.

Estos son **roles lógicos del workflow**. No implican procesos o agentes independientes.

Un mismo modelo puede ejecutar varios roles en pasos diferentes siempre que:

- cada paso tenga entrada y salida estructuradas;
- el estado esté fuera del chat;
- los validadores independientes sigan siendo autoridad;
- no se confunda autoconsistencia con independencia metodológica.

**Excepción de independencia generativa:** cuando el rol Crítico generativo participe en el gate de autoría de una familia producida por un Generador generativo, ambos se ejecutan con **familias de modelo distintas**. Esto no convierte los roles en agentes autónomos ni permite que el crítico certifique: reduce error correlacionado y su desempeño se mide contra defectos objetivos/auditoría.
### 7.4 Buscador de demostraciones

Para cada reactivo formal, el pipeline distingue cuatro funciones que no deben colapsarse:

1. **oráculo de sanidad semántica**: detecta secuentes o pasos incompatibles con una semántica respecto de la cual todas las reglas autorizadas son sanas;
2. **buscador Fitch heurístico**: intenta producir una o más derivaciones dentro de un presupuesto finito;
3. **decisor de derivabilidad**, cuando exista y esté aprobado para la versión exacta del cálculo: puede resolver existencia/no existencia sin depender del presupuesto heurístico;
4. **`logic-core`**: verifica de nuevo cualquier certificado concreto producido por el buscador antes de aceptar el artefacto.

Estados mínimos de autoría:

- `semantically_invalid`: el oráculo independiente demuestra que el candidato no puede ser correcto bajo la semántica de sanidad declarada;
- `proof_found`: existe al menos una derivación concreta aceptada de nuevo por `logic-core`;
- `search_budget_exhausted`: el buscador heurístico agotó su presupuesto sin hallar una prueba; **no** significa inexistencia;
- `no_proof_exists_in_calculus`: solo puede emitirse por un decisor terminante cuya sanidad y completitud respecto de `authorizedCalculusVersion` estén documentadas y cubiertas por pruebas. Si esa equivalencia no está establecida, este estado no está disponible.

El buscador debe además:

- identificar reglas utilizadas;
- registrar el orden de búsqueda, semilla cuando aplique y presupuesto de trabajo;
- usar como corte primario un presupuesto determinista y reproducible de nodos/estados/inferencias; el timeout de pared es solo una salvaguarda y, si se dispara, se registra por separado;
- permitir un modo heurístico orientado a `best_found`;
- permitir, cuando sea viable, un modo exhaustivo hasta un coste `k` con **solo podas conservativas**. Solo este modo puede certificar que no existe una prueba de coste menor que la encontrada;
- no afirmar minimalidad global cuando no se haya cubierto exhaustivamente todo coste menor;
- registrar la solución encontrada en un almacén inaccesible al agente de sesión.

Como optimización de autoría se benchmarkea en L0 el orden `prefiltro semántico → proof search` frente a alternativas equivalentes. El orden ganador se congela por versión; no se adopta como ley universal sin medición. La semántica válida del prefiltro no se confunde con una prueba de derivabilidad en fragmentos incompletos respecto de esa semántica.

### 7.5 Verificador de reactivos

Cada candidato debe superar:

- parseo de fórmulas con alias permitidos por `authorizedCalculusVersion`;
- verificación de consistencia con la tabla exacta de reglas, alcance y descarga del cálculo autorizado;
- comprobación semántica independiente;
- ausencia de referencias inválidas;
- satisfacibilidad de las premisas bajo el oráculo semántico cuando una contradicción involuntaria haría trivial el reactivo, salvo que la contradicción sea el objetivo explícito;
- comprobación de que la meta no es trivial bajo las reglas permitidas;
- prueba de que la solución no aparece en el enunciado ni en las pistas;
- validación de etiquetas KC.

### 7.6 Complejidad estructural

El código puede calcular, sobre soluciones realmente encontradas dentro del presupuesto:

- longitud de la mejor prueba encontrada y si existe garantía de minimalidad bajo la estrategia usada;
- número de reglas distintas;
- profundidad y cantidad de subpruebas;
- número de premisas;
- cantidad de conectivos;
- necesidad de descarga de supuestos o estrategia indirecta;
- coste/nodos explorados y diversidad de estrategias encontradas dentro del presupuesto, **sin interpretar ese número como el total de caminos posibles**;
- distancia estructural entre premisas y conclusión.

Estas medidas forman un **índice de complejidad estructural** cuyos pesos y criterio de comparabilidad son `CALIBRABLES`, pero el primer valor operativo debe quedar fijado en **H5 antes de seleccionar/congelar los conjuntos y antes de H6**. Puede calibrarse con el corpus, soluciones verificadas y pruebas sintéticas/paquete generado; no requiere resultados del participante. El razonamiento suposicional puede recibir mayor peso si esa calibración local lo justifica, pero no se fija una ponderación científica a priori.

No se debe afirmar que dos reactivos son psicométricamente equivalentes únicamente porque sus índices coinciden. Latencia, tasa de error, uso de pistas y correcciones del alumno pueden emplearse después de la corrida en H10/análisis como validación observacional del orden de dificultad, **solo para una versión futura**; nunca reordenan retroactivamente el paquete congelado.

### 7.7 Separación de reservas

Deben existir reservas sin solapamiento para:

- diagnóstico;
- práctica guiada;
- práctica independiente;
- recuperación;
- sondas de línea base;
- sondas de intervención;
- `TRANSFER_MASTERY`;
- `TRANSFER_MEASUREMENT`;
- retención;
- reposición por incidente.

Un reactivo consumido en práctica, recuperación o `TRANSFER_MASTERY` no puede usarse como medida primaria, como `TRANSFER_MEASUREMENT` ni como retención. Las reservas de medición son disjuntas también respecto de duplicados/isomorfismos prohibidos por la canonicalización congelada.

### 7.8 Cantidades mínimas

Antes de congelar:

- cada KC enseñado debe contar con al menos seis oportunidades operativas válidas;
- cada conjunto experimental debe tener suficientes sondas únicas para el calendario preinscrito más una reserva mínima del 20 %;
- cada tipo de error prioritario debe tener al menos una pista por nivel;
- cada familia paramétrica debe declarar generador, restricciones y verificador;
- cada declaración válida de dominio debe disponer de capacidad para al menos una reconfirmación post-dominio desde la reserva de práctica independiente, salvo que el gate de cobertura bloquee la corrida.

**Definición normativa de familia.** Cada candidato recibe antes de auditoría un `item_family_id` inmutable. Dos candidatos pertenecen a la misma familia cuando comparten `generator_template_id`, función de banco, conjunto de KC objetivo y la misma `structural_signature` canonicalizada del problema/solución; cambios de nombres de átomos, valores superficiales, orden permitido de pasos independientes o redacción no crean una familia nueva. Un cambio real de estructura de prueba, función pedagógica o conjunto de KC objetivo sí crea una familia distinta. El pipeline no puede reasignar familias después de conocer defectos para eludir umbrales.

La cantidad exacta se calcula desde el calendario. Si la reserva no alcanza, el piloto no se abre. Estos pisos y reservas son **heurísticas operativas del proyecto derivadas del calendario**, no mínimos psicométricos universales.

### 7.9 Auditoría previa por muestra

El humano no aprueba cada reactivo.

El sistema selecciona aleatoriamente una muestra estratificada por:

- KC;
- función del banco;
- nivel de complejidad;
- tipo de regla;
- origen generativo;
- presencia de subpruebas;
- riesgo/consecuencia del artefacto.

Los estratos de mayor consecuencia pueden sobremuestrearse **sin reducir** los mínimos vigentes de otros estratos. Si se usa selección desproporcionada y se calcula una tasa global, se conservan probabilidades de inclusión o pesos apropiados; ningún promedio global puede ocultar el fallo de un gate por estrato o familia.

El auditor revisa:

- claridad;
- ambigüedad;
- adecuación al corpus;
- plausibilidad de dificultad;
- no revelación;
- corrección de anclaje.

Si la tasa de defectos supera el umbral preinscrito, no se corrigen manualmente solo los casos vistos. Se rechaza o regenera la familia completa afectada.

### 7.10 Congelamiento

El paquete se congela con:

- hash del corpus;
- versión del extractor;
- versión de los modelos de autoría;
- prompts o políticas de autoría versionados;
- mapa de KC;
- bancos y semillas;
- soluciones;
- rúbricas;
- pistas;
- verificador;
- reglas de complejidad;
- política pedagógica y catálogo de estrategias;
- reglas de elegibilidad de intentos para dominio;
- política de *scaffolding/fading*;
- plan de *retrieval/spacing* si está habilitado;
- configuración de `wheel_spinning`;
- configuración BKT sombra si está habilitada;
- resultados de auditoría, codebook de severidad y metadatos del plan de muestreo;
- mapa de licencia por sección/componente y artefacto de atribución en cadena;
- calendario experimental y reglas SCED preinscritas de estabilidad, transición, datos faltantes y análisis.

---

### 7.11 Proveniencia curricular y groundedness

Toda pieza enseñable debe poder reconstruirse mediante:

```text
fuente → fragmento → claim → decisión curricular → artefacto → actividad
```

Se distinguen:

- `source_assertion`;
- `cross_source_consensus`;
- `system_inference`.

Las **decisiones pedagógicas** se registran aparte como `curricular_decision`, con sus claims de soporte y su justificación.

El anclaje estructural (IDs, hashes, referencias) es determinista.

Para `source_assertion`, la muestra dorada aplica una prueba de **atribuibilidad a la fuente identificada**: el claim debe ser verificable desde el fragmento citado sin necesitar conocimiento externo. `system_inference` se registra y evalúa por su propia trazabilidad, pero queda fuera del denominador de atribución de fuente en lugar de contarse automáticamente como fallo.

Un clasificador NLI/entailment puede aportar una señal `support_score`, pero:

- no sustituye al verificador formal;
- no certifica por sí solo groundedness;
- sus falsos positivos/negativos se calibran contra una muestra dorada;
- la muestra dorada se estratifica por forma lógica relevante al dominio —como definición declarativa, condicional, negación, cuantificación y convención notacional— además de KC/tipo de claim;
- FP/FN se reportan por estrato para evitar que un promedio global oculte fallo en claims lógicamente sensibles;
- puede actuar como gate automático **solo en los estratos** donde se haya demostrado fiabilidad suficiente antes del freeze.


## 8. Profesor IA en sesión

### 8.1 Un solo agente conversacional acotado

Durante la sesión debe operar un agente principal, no una orquestación abierta de agentes.

El agente recibe únicamente:

- estado estructurado actual;
- fragmentos autorizados relevantes;
- objetivo del bloque;
- perfil pedagógico permitido;
- salida estructurada del verificador;
- pista seleccionada;
- política de conversación.

No recibe:

- soluciones de reactivos puntuados;
- banco completo;
- sondas futuras;
- datos identificables innecesarios;
- libertad para modificar las reglas de avance.

### 8.2 Estado estructurado

La sesión no depende del historial completo del chat.

El estado debe incluir:

- versión del paquete;
- bloque actual;
- tiempo planeado y real;
- KC activos;
- dominio operativo;
- modo pedagógico actual;
- estrategia pedagógica seleccionada;
- etapa de andamiaje/*fading*;
- errores observados;
- ayudas utilizadas y nivel máximo de pista por intento;
- intentos elegibles/no elegibles para dominio;
- estado de transferencia cercana;
- última práctica y próxima revisión programada cuando aplique;
- señal de `wheel_spinning` cuando exista;
- actividades consumidas;
- dudas pendientes;
- cambios al plan;
- incidentes;
- autonomía de cada decisión;
- próximos pasos.

### 8.3 Conducción

El sistema debe:

- anunciar el objetivo del bloque;
- ejecutar la estrategia pedagógica que el motor haya seleccionado;
- explicar progresivamente;
- comprobar comprensión en intervalos configurables;
- distinguir error conceptual, procedimental, de notación, interfaz o descuido;
- cambiar representación cuando falle una explicación;
- ajustar tiempo, cantidad de práctica y nivel de andamiaje mediante reglas congeladas;
- no avanzar por simple autoafirmación del alumno;
- cerrar cuando se alcance dominio o se agote la política de recuperación.

#### 8.3.1 Jerarquía de decisión pedagógica

La política de sesión aplica, en este orden:

1. seguridad, integridad, modo pedagógico y límites de no revelación;
2. prerrequisitos bloqueantes;
3. política de dominio y recuperación;
4. selección de estrategia según tipo de KC y estado observable;
5. adaptación lingüística/visual de la IA dentro de la estrategia elegida.

La IA puede proponer formulaciones, ejemplos y preguntas, pero no alterar esta jerarquía ni seleccionar por sí sola una ruta que contradiga al motor.

#### 8.3.2 Patrones base de Etapa 1

La política debe poder representar, al menos, estos patrones sin convertirlos en secuencias rígidas universales:

- **KC procedimental nuevo:** explicación breve → ejemplo trabajado → ejemplo incompleto/*fading* → práctica guiada → práctica independiente → transferencia cercana;
- **dificultad parcial:** *scaffolding* contingente → comprobación → retiro progresivo de ayuda según desempeño;
- **error repetido del mismo tipo:** feedback específico → autoexplicación guiada → explicación dirigida/ejemplo contrastante → nueva práctica;
- **fallo de prerrequisito:** suspender avance del KC actual → recuperar prerrequisito → volver al KC objetivo;
- **dominio aparente o dependencia de ayuda:** nuevo intento sin ayuda → variante de transferencia → sonda independiente cuando corresponda al calendario.

El *fading* es contingente al desempeño. No se retira ayuda por un simple número fijo de minutos o ejercicios salvo que esa regla haya sido preinscrita y validada expresamente.

#### 8.3.3 Autoexplicación

La autoexplicación se usa de forma selectiva, no en cada paso. Puede activarse después de un paso correcto no trivial, tras un error persistente o para distinguir comprensión de memorización de patrón. El prompt debe ser dirigido y anclado al KC; su respuesta sirve para diagnóstico y adaptación, no sustituye al verificador formal.

#### 8.3.4 Retrieval y spacing

`retrieval practice` se usa para recuperar conocimiento ya introducido, no como sustituto de la primera enseñanza de un KC. Su programación corresponde al motor/calendario.

El *spacing* de Etapa 1 debe respetar el calendario experimental y las reservas congeladas. Las revisiones pedagógicas espaciadas y las sondas de retención son funciones distintas: una enseña/practica; la otra mide y permanece aislada.

#### 8.3.5 Wheel-spinning y BKT sombra

Si el motor detecta `wheel_spinning`, primero revisa granularidad práctica, estrategia, nivel de ayuda, error persistente y prerrequisitos. Tras agotar la política de recuperación, declara no dominio/límite pedagógico. No existe rescate docente.

Si BKT está habilitado, su `mastery_probability_shadow` se registra solo para análisis posterior y no entra en ninguna condición de avance durante Etapa 1.

### 8.4 Conversación

El alumno puede:

- preguntar libremente;
- pedir otra explicación;
- pedir un ejemplo distinto;
- interrumpir;
- pausar;
- indicar que no entendió;
- solicitar revisión posterior;
- retirarse.

El agente debe declarar cuando una pregunta:

- corresponde al bloque;
- requiere un prerrequisito;
- pertenece a otro momento de la unidad;
- queda fuera del corpus;
- no puede responderse con suficiente anclaje.

### 8.5 Anclaje

Toda afirmación de contenido debe incluir internamente referencias a fragmentos del corpus.

Una salida no anclada:

- puede presentarse como lenguaje de acompañamiento no factual;
- no puede fundamentar calificación;
- no puede introducir una regla o definición;
- se registra para auditoría.

### 8.6 Pistas

Las pistas pueden generarse previamente por el pipeline, pero durante la sesión se recuperan desde un banco congelado.

Niveles mínimos:

1. recordar objetivo o definición;
2. señalar región o regla relevante;
3. indicar el siguiente tipo de operación sin resolverla;
4. ejemplo análogo no isomorfo;
5. cierre del intento sin revelar la respuesta calificada.

Reglas adicionales:

- el nivel de pista utilizado y la bandera `masteryDisqualifying` **recalculada por código** se registran por intento; la bandera propuesta por el generador no es autoritativa;
- las ayudas se retiran de forma contingente al desempeño;
- una pista nunca puede transformarse silenciosamente en solución;
- un acierto con ayuda decisiva requiere reconfirmación sin esa ayuda antes de contar como dominio;
- en `MEASUREMENT_MODE` las pistas quedan deshabilitadas salvo excepción explícita preinscrita que no forme parte de la medida primaria.

### 8.7 Recuperación

Después de un fallo:

- primer ciclo: feedback específico al error + nueva explicación o ejemplo trabajado + práctica guiada;
- segundo ciclo: reducción de complejidad, revisión/remediación de prerrequisitos y *scaffolding* contingente;
- tercer ciclo: representación alternativa, autoexplicación guiada cuando sea útil y nueva comprobación;
- agotados los ciclos: el KC queda no dominado y se programa recuperación posterior si existe reserva.

La repetición mecánica del mismo tipo de actividad sin señal de progreso se evita; puede registrarse `wheel_spinning` y cambiarse la estrategia dentro de las alternativas congeladas.

Después de agotar los tres ciclos dentro del bloque, el sistema puede programar hasta **dos episodios de recuperación posteriores por KC**. El contador es `recovery_episode_count[kc_id]`, no por conjunto ni por unidad completa. Cada episodio usa material reservado distinto del intento fallido y vuelve a evaluar el mismo KC bajo la política congelada. Tras dos episodios posteriores fallidos, ese KC queda en **límite pedagógico observado** para la corrida. Si ese KC bloquea por dependencia un objetivo posterior, el motor cierra también la ruta dependiente como no alcanzable bajo la versión vigente.

Los tres ciclos internos y el máximo de dos episodios posteriores por KC son **parámetros operativos congelados del protocolo actual**, no cantidades científicamente óptimas; solo pueden cambiarse entre corridas mediante nueva versión/preinscripción.

No se llama a un docente para completar la enseñanza experimental.

### 8.8 Gestión del tiempo

- El reloj visible es opcional para el alumno.
- El servidor conserva el tiempo autoritativo.
- El contenido opcional se recorta antes que el deseable y el esencial.
- Si el contenido esencial no puede cubrirse, se registra fallo de planificación o de dominio.
- La sesión puede terminar anticipadamente sin ocultar la causa.

### 8.9 Pizarrón, editor y capa visual

La interfaz debe incluir dos superficies distintas pero coordinadas:

**Editor formal Fitch**

- editor estructurado de derivaciones tipo Fitch;
- notación lógica;
- resaltado de líneas y subpruebas;
- historial;
- exportación;
- validación sintáctica local no autoritativa;
- veredicto autoritativo en servidor.

**Pizarrón libre compartido**

- canvas infinito para texto, dibujo libre, flechas, formas, imágenes, resaltado, zoom y borrado;
- implementación V1 con **Excalidraw**, encapsulado detrás de `whiteboard-adapter`;
- IDs estables y estado estructurado de los objetos;
- registro del actor que crea/modifica cada elemento y referencia a actividad/KC cuando aplique;
- snapshots y operaciones reconstruibles sin guardar cada movimiento intermedio del puntero.

#### 8.9.1 Estado estructurado antes que visión

Profesor IA debe leer primero la estructura disponible del pizarrón y de la interfaz. Texto, tipo de figura, bounds, selección, relaciones y movimientos conocidos se obtienen directamente del estado estructurado.

La percepción multimodal solo se invoca cuando exista información no expresada por esa estructura, por ejemplo:

- manuscrito;
- dibujo semántico;
- imagen importada;
- región visual ambigua;
- contenido externo capturado con autorización.

Una interpretación visual se registra como observación estadística y puede provocar una pregunta de confirmación, pero no declarar por sí sola la corrección de una actividad formal.

La política visual tiene tres salidas explícitas, con umbrales calibrados sobre un conjunto dorado propio:

1. `observe`: aceptar la interpretación solo como observación auxiliar;
2. `confirm`: pedir al alumno confirmación entre interpretaciones concretas;
3. `decline`: abstenerse y solicitar entrada estructurada o una vía alternativa.

El sistema registra por separado los **errores confiados** —interpretaciones incorrectas que no provocaron confirmación/abstención—. Ningún score visual autoriza un veredicto formal.

#### 8.9.2 Anotaciones sobre la interfaz

La aplicación incorpora un **overlay SVG propio** para que Profesor IA pueda señalar sin modificar el contenido subyacente. Primitivas V1:

- `point`;
- `highlight`;
- `circle`;
- `arrow`;
- `underline`.

Los elementos propios de la aplicación que puedan señalarse exponen referencias semánticas estables, por ejemplo `fitch-line:4`, `hint-button`, `kc-definition:KC06` o `board`. El modelo decide **qué** señalar; el frontend resuelve determinísticamente **dónde está** mediante DOM/estado del pizarrón y materializa la anotación.

Solo cuando no exista un target lógico conocido se permite localización por visión. Las coordenadas devueltas por un modelo se normalizan y transforman por código; el LLM nunca calcula la posición final de pantalla.

Se distinguen explícitamente los marcos `viewport_css`, `board_scene`, `capture_pixel` y `normalized`. Toda anotación visual debe incluir la revisión de UI/board que la originó para rechazar coordenadas obsoletas tras scroll, zoom o cambios de layout.

Cada superficie mantiene una **revisión monotónica**. La propuesta de anotación conserva `surfaceRevision` y una caducidad `maxAgeMs` calibrada; cualquier desajuste de revisión produce rechazo duro y nueva resolución. Las transformaciones entre marcos incluyen `devicePixelRatio`, zoom de página, zoom/scroll de escena y contenedores con scroll propio, y se cubren con pruebas de propiedad de ida/vuelta dentro de tolerancia declarada.

#### 8.9.3 Capturas

- Captura de regiones de la propia aplicación: permitida y reproducible, excluyendo por defecto las anotaciones del Profesor IA y capas sensibles.
- Captura del pizarrón: preferir exportación del propio canvas.
- Captura de ventana/pantalla externa: experimental, con permiso explícito del alumno y desactivada por defecto.

Cada acto fallido se clasifica, con evidencia, en una de cuatro categorías mínimas:

1. `PERCEPTION_ERROR`: STT o visión interpretó incorrectamente;
2. `INTERFACE_ERROR`: el control no se encontró, operó o respondió como debía;
3. `ACCESSIBILITY_ERROR`: existió una barrera de accesibilidad relevante;
4. `CONCEPTUAL_ERROR`: el alumno cometió el error de contenido.

Las categorías 1–3 no consumen por sí mismas un intento elegible para dominio ni se contabilizan como fallo de KC. `CONCEPTUAL_ERROR` solo se asigna cuando las tres primeras se han descartado con evidencia suficiente. La clasificación puede quedar pendiente para auditoría si no hay evidencia para decidir en vivo.

### 8.10 Voz del Profesor IA y del alumno

La V1 no usa voz-a-voz opaca como autoridad semántica.

**Salida del Profesor IA**

```text
modelo pedagógico
→ salida textual estructurada
→ validadores/anclajes/filtro de egreso
→ texto canónico registrado
→ TTS streaming
→ audio
```

Una caída del TTS afecta la presentación, no la decisión pedagógica. La voz puede pausarse o interrumpirse sin alterar el texto canónico.

El paquete congela un **lexicón de verbalización** por `authorizedCalculusVersion` para conectivos, alcance, paréntesis, reglas y citas de línea/subprueba. La corrección de ese lexicón se valida por reconstrucción de fórmulas, no por naturalidad percibida. Las pausas pedagógicas son órdenes estructuradas de la política y no decisiones libres del TTS.

**Entrada del alumno**

```text
micrófono
→ STT streaming
→ transcripción final/COMMIT
→ confirmación/corrección cuando la actividad sea crítica
→ session-engine
```

La primera implementación prioriza *push-to-talk* o micrófono activo durante el turno. Full duplex, barge-in automático y turn-taking completamente autónomo quedan experimentales hasta demostrar valor.

El `speech-gateway` recibe desde `session-engine` un **léxico de sesión** derivado del KC activo y del cálculo autorizado. Cuando el proveedor lo soporte, ese léxico se utiliza como mecanismo de *keyterm prompting* o equivalente; nunca se deriva de instrucciones del alumno.

El evento `stt.committed` conserva al menos la transcripción cruda, la transcripción normalizada y la versión del normalizador. La normalización es determinista, reversible y limitada a transcodificar notación/variantes lingüísticas autorizadas; no corrige razonamiento del alumno. Antes de `COMMIT` el alumno puede corregir libremente; después de `COMMIT`, una corrección crea un evento enlazado y, si el acto era puntuable, no modifica retrospectivamente el veredicto salvo el procedimiento de adjudicación posterior.

Los proveedores TTS/STT no se declaran definitivos sin benchmark en español real, vocabulario del corpus, latencia, interrupción, estabilidad, privacidad y costo. Los candidatos iniciales quedan definidos en la Parte II.

---

## 9. Integridad evaluativa

### 9.1 Verificador determinista

La corrección formal nunca depende únicamente de un modelo generativo.

El verificador recibe:

- derivación del alumno;
- cálculo autorizado;
- versión de reglas;
- rúbrica estructurada.

Devuelve:

- válida o inválida;
- primer paso inválido;
- regla mal aplicada;
- alcance o referencia incorrecta;
- KC afectado;
- traza de comprobación.

### 9.2 Oráculo semántico independiente

Además del chequeo sintáctico de reglas, el sistema usa un segundo canal semántico para detectar aceptaciones indebidas. Para cada versión del cálculo debe quedar documentado bajo qué semántica son sanas todas sus reglas.

Un paso aceptado por reglas pero que no sea consecuencia de los supuestos accesibles bajo esa semántica genera incidente bloqueante. En toda actividad formal, `semanticCheck = "not-applicable"` requiere una razón explícita prevista por el cálculo; nunca es el valor silencioso por defecto.

La salida del oráculo se interpreta de forma asimétrica:

- **fallo semántico**: basta para rechazar el paso/candidato y abrir incidente;
- **éxito semántico**: confirma ausencia de esa clase de contradicción, pero **no demuestra por sí solo que exista una derivación en el fragmento autorizado**.

La afirmación `no_proof_exists_in_calculus` pertenece a un procedimiento de decisión distinto y solo es válida cuando se haya demostrado su correspondencia con la versión exacta del cálculo.

### 9.3 Separación de privilegios

El agente de sesión no puede leer:

- soluciones;
- claves de respuesta;
- sondas futuras;
- semillas reservadas;
- resultados del auditor antes de emitir su propia decisión.

La separación debe imponerse mediante procesos, credenciales y permisos, no solo mediante prompts.

### 9.4 Filtro de egreso

Antes de enviar información al modelo se comprueba:

- ausencia de soluciones;
- ausencia de cadenas canario;
- ausencia de identificadores personales innecesarios;
- pertenencia del fragmento al bloque;
- nivel de ayuda permitido.

### 9.5 Evaluación de respuestas no formales

En Etapa 1, las respuestas libres se usan para diagnóstico, conversación y medidas secundarias descriptivas. **No pueden constituir la medida primaria de aprendizaje ni sostener por sí solas una transición pedagógica positiva.** La medida primaria queda restringida a sondas formales nuevas corregidas por el verificador determinista.

Si una respuesta libre se puntúa como medida secundaria:

- debe existir rúbrica cerrada;
- el sistema debe producir salida estructurada;
- la respuesta debe auditarse a ciegas por un humano en el 100 % de los casos puntuados;
- su resultado se registra con `metric_id` separado y nunca se mezcla en el numerador/denominador de `probe_accuracy`.

### 9.6 No revelación

Una actividad puntuable debe ejecutarse en modo de no revelación:

- sin solución en contexto;
- sin ejemplos isomorfos inmediatos;
- sin pistas que completen el paso decisivo;
- sin retroalimentación hasta cerrar el intento cuando sea una sonda.

---

## 10. Diseño experimental

### 10.1 Unidad de inferencia

La inferencia se limita a:

> este alumno, esta subunidad, este corpus, esta versión del Profesor IA, este verificador y este procedimiento.

### 10.2 Diseño principal

Se conserva una **línea base múltiple concurrente con técnica de sondas múltiples** entre tres conjuntos de KC. Los tres conjuntos son el piso metodológico de la Etapa 1 y no crean por sí solos evidencia de generalización.

Procedimiento:

1. seleccionar tres conjuntos con dependencia controlada, minimizando estrategia general compartida; competencias transversales se registran como KC de soporte y no como diferenciador principal del conjunto;
2. ejecutar un validador sobre el grafo tipado que enumere por separado toda arista `FORMAL` y `POLITICA_CONTENIDO` cruzada entre conjuntos. Se prefieren agrupaciones sin esas aristas; si alguna permanece, debe justificarse por qué no crea una ruta de prerrequisito desde un conjunto intervenido hacia otro aún en línea base ni vuelve no interpretable la demostración;
3. aplicar sondas sin asistencia a los tres conjuntos;
4. introducir la enseñanza del Profesor IA en momentos distintos, seleccionados por **aleatorización restringida dentro de ventanas preinscritas** y con separación mínima congelada;
5. mantener sondas en conjuntos aún no intervenidos;
6. registrar como señal de covariación/carryover cualquier cambio en una línea base no intervenida temporalmente coincidente con la enseñanza de otro conjunto;
7. medir cambio inmediato, transferencia y retención;
8. conservar concurrencia;
9. preinscribir el criterio de estabilidad de línea base y cualquier regla acotada de extensión antes de la corrida.

### 10.2.1 Unidad temporal y unidad de observación del SCED

La unidad de calendario que gobierna las ventanas A/B/C es una **`probe_round` global**. Una ronda es una ocasión de medición programada en la que `measurement-worker` intenta obtener una observación de cada conjunto experimental activo conforme a la fase que le corresponda.

Para cada conjunto, una `probe_opportunity` dentro de la ronda consiste en una **microbatería fija** de `k_set` reactivos únicos de la reserva correspondiente y produce como máximo una observación agregada `correct_valid / valid_scored` para ese conjunto. `k_set` y `min_valid_items_per_opportunity` son parámetros de cobertura/calibración H5: deben quedar congelados antes de H11 y permanecer constantes entre observaciones comparables; esta especificación no inventa su valor.

Reglas de conteo:

- una `probe_round` incrementa el contador usado por ventanas y separación únicamente cuando todos los conjuntos requeridos en esa ronda producen una observación válida;
- si una oportunidad no alcanza `min_valid_items_per_opportunity`, la oportunidad y la ronda quedan `schedule_invalid`; no avanzan las ventanas. Los datos válidos parciales permanecen en el ledger como descriptivos, pero no crean una observación SCED primaria;
- una sonda invalidada o un reactivo consumido no vuelve al banco. La reposición solo usa reserva independiente y no cambia retrospectivamente el índice de la ronda;
- las ventanas A `6–8`, B `9–11`, C `12–14`, la extensión máxima y la separación mínima de `3` se cuentan sobre **rondas globales válidas**;
- `TRANSFER_MEASUREMENT`, retención, familiarización, diagnóstico y reconfirmaciones post-dominio no son `probe_round` y no avanzan esas ventanas.

### 10.3 Separación entre enseñanza y medición

La generación de sondas debe estar aislada del agente de sesión.

Controles:

- reserva independiente;
- proceso o módulo de medición separado;
- semillas congeladas;
- sondas no visibles al agente hasta el momento de aplicación;
- sin reutilización;
- verificador común, pero registro separado de función.

### 10.4 Medida primaria

La medida primaria de desempeño se expresa como `probe_accuracy = correctas_válidas / sondas_válidas_puntuadas` en sondas nuevas sin asistencia. Se reportan siempre ambos conteos `x/n` y, por separado, `sondas_válidas_puntuadas / sondas_planificadas` para que datos faltantes o invalidaciones no desaparezcan del denominador de cobertura.

La palabra “calidad” no constituye una segunda métrica implícita. Cualquier dimensión de calidad adicional requiere un `metric_id` y contrato propio antes de H11.

### 10.5 Medidas secundarias

Antes de H11 toda medida interpretada tiene un contrato versionado con unidad, población/denominador, inclusión/exclusión, faltantes, dirección interpretativa y vínculo al veredicto.

Contratos congelados:

- `false_mastery_rate`: unidad = declaración de dominio de un KC. Numerador = declaraciones cuya **primera reconfirmación posterior elegible, no asistida y en LEARNING_MODE**, programada automáticamente por `post_mastery_reconfirmation_pending` antes de volver a enseñar ese KC, resulta incorrecta. Denominador = declaraciones para las que dicha reconfirmación fue realmente observada. El motor debe intentar programarla; si retirada, final de corrida, incidente o falta válida de reserva impiden observarla, se registra faltante, no falso dominio. La cobertura `reconfirmations_observed / mastery_declarations` se reporta junto a la tasa.
- `hint_dependency`: unidad = oportunidad de práctica independiente en LEARNING_MODE iniciada con `assistanceLevel = 0`. Numerador = oportunidades donde, antes del resultado terminal, se utiliza una ayuda con `masteryDisqualifying = true`. Denominador = oportunidades elegibles con resultado terminal. MEASUREMENT_MODE no entra.
- `time_to_mastery`: segundos de actividad instructiva desde la primera actividad de intervención dirigida al KC hasta el primer evento válido de dominio; excluye pausas, tiempo entre sesiones, downtime y MEASUREMENT_MODE. El tiempo calendario se reporta, si se desea, como métrica separada.
- `transfer_measurement_accuracy = transfer_correct_valid / transfer_valid_scored`, con cobertura `transfer_valid_scored / transfer_planned`, exclusivamente desde `TRANSFER_MEASUREMENT`.
- `retention_accuracy = retention_correct_valid / retention_valid_scored`, con cobertura `retention_valid_scored / retention_planned`, exclusivamente desde la reserva de retención de 7 días.
- `wheel_spinning` se reporta solo con el umbral calibrado/congelado y el número de oportunidades a las que se aplicó.

Etapa 1 **no adopta un escalar `phase_change`**. El cambio de fase se representa mediante análisis visual estructurado y el complemento Tau-U preinscrito.

El análisis principal del SCED permanece visual y estructurado: nivel, tendencia, variabilidad, inmediatez, solapamiento y consistencia entre conjuntos. Como complemento cuantitativo se reporta `Tau-U` por conjunto, separando el contraste de fase sin corrección y la variante que incorpora tendencia de línea base. Ninguna magnitud ni `p` de Tau-U constituye por sí sola un gate de éxito.

La autocorrelación de primer orden se reporta como diagnóstico cuando una fase dispone de al menos `5` observaciones válidas consecutivas. Los datos primarios faltantes no se imputan. Un contraste conjunto-fase necesita al menos `5` observaciones válidas por fase para ser interpretable; si no se cumple se marca `NOT_INTERPRETABLE`. Si quedan menos de dos transiciones interpretables, el resultado pedagógico global es `no_interpretable`.

Una mejora contemporánea en una línea todavía no intervenida se registra como covariación. Si el mismo cambio direccional aparece simultáneamente al introducir enseñanza en otro conjunto, esa transición no puede usarse por sí sola como demostración causal.

Otras salidas secundarias permitidas incluyen rutas de estrategia pedagógica, frecuencia de `wheel_spinning`, BKT sombra si se habilita, fallos de autonomía, incidentes de contenido y carga humana residual, siempre con contrato de medición o como descriptivos claramente etiquetados.

#### 10.5.1 Clasificación de transiciones y autoridad del veredicto

Cada transición A/B/C recibe exactamente una clase: `FAVORABLE`, `NO_FAVORABLE` o `NOT_INTERPRETABLE`.

El `analysis-engine` calcula series, gráficas, Tau-U y señales estructuradas. El `EXPERIMENT_AUDITOR` realiza una primera revisión estructurada y, cuando sea posible, cegada de `nivel`, `tendencia`, `variabilidad`, `inmediatez` y `solapamiento`; `consistencia` se evalúa entre transiciones. Ningún LLM tiene autoridad para fijar la clase final.

La combinación lógica queda congelada así:

- `NOT_INTERPRETABLE` si falla el mínimo de observaciones, existe contaminación/invalidación que impide la comparación o la ronda/fase no cumple el contrato preinscrito;
- `FAVORABLE` solo si la transición es interpretable, `nivel` favorece la dirección esperada, al menos una de `tendencia`, `inmediatez` o `solapamiento` también favorece, ninguna de esas tres dimensiones contradice de forma material el cambio bajo los anclajes congelados y no existe covariación invalidante;
- todo contraste interpretable que no cumpla la regla anterior es `NO_FAVORABLE`;
- `variabilidad` puede reducir una dimensión a no evaluable o activar `NOT_INTERPRETABLE` según el anclaje preinscrito, pero no transforma por sí sola ausencia de cambio en cambio favorable;
- `consistencia` no reclasifica una transición individual: gobierna la combinación global de dos o tres transiciones.

Los **anclajes operativos** que convierten cada dimensión y las medidas de transferencia/retención en `favorable/no_favorable` se fijan en `CAL-15` durante H10/pre-H11 con material sintético/de desarrollo y sin observar datos del participante. Quedan hasheados en `verdict-manifest`; cualquier ajuste posterior a resultados exige nueva corrida.

W13 produce los cuatro veredictos mediante un `verdict-engine` determinista que consume las clases/adjudicaciones congeladas. `EXPERIMENT_AUDITOR` es `approver_role` de la emisión final; su aprobación confirma aplicación del manifiesto, no permite redefinir criterios post hoc.

### 10.6 Estudio de autoría autónoma

La calidad del pipeline de autoría se analiza como estudio secundario separado.

Medidas:

- candidatos generados;
- porcentaje descartado por cada filtro;
- porcentaje que llega al paquete congelado;
- defectos encontrados por auditoría;
- familias regeneradas;
- complejidad estructural;
- discrepancias entre estimación estructural y desempeño observado;
- horas humanas de auditoría;
- incidentes atribuibles a contenido generado;
- tasa de fallo correlacionado del crítico sobre candidatos objetivamente defectuosos, estratificada por relación generador/crítico cuando aplique;
- número de regeneraciones por familia y su relación con isomorfismos/agotamiento de reserva;
- reactivos rechazados por similitud textual o estructural con ejercicios del corpus fuente.

No se mezcla este análisis con la inferencia principal de aprendizaje.

### 10.7 Preinscripción y freeze

Antes de la primera sesión real se congelan:

- corpus y artefacto de atribución;
- `authorized-calculus-v1`, su snapshot/hash, sintaxis, alias, reglas, códigos de error y política semántica/de decisión;
- mapa de KC y una única `authorizedCalculusVersion` para A/B/C;
- conjuntos experimentales, bancos, reservas e isomorfismo;
- semillas, pistas, rúbricas y verificador;
- lexicón español canónico y normalizador STT;
- modelos, `model_binding`, `ModelCapabilities` y huella de comportamiento cuando no exista snapshot fechado;
- calendario SCED: definición de `probe_round`, `k_set`/`min_valid_items_per_opportunity` fijados en H5, ventanas A `6–8`, B `9–11`, C `12–14`, punto planificado elegido por semilla, separación mínima de `3` rondas válidas, regla de estabilidad y extensión máxima de `2` dentro de la ventana;
- reglas de interpretabilidad, datos faltantes, covariación, techo/suelo y exposición externa;
- intervalo de retención de `7 días` y política `retention_not_evaluated`;
- `metrics-manifest` con contratos de métricas;
- `verdict-manifest` con la tabla determinista, anclajes CAL-15 y autoridad de aprobación;
- plan de análisis visual y complemento `Tau-U`, tratamiento de tendencia/autocorrelación y requisito de `5` observaciones válidas por fase para el contraste;
- política de auditoría, codebook y plan de muestreo;
- conjunto dorado y política de abstención/confirmación de percepción si se habilita visión;
- reglas de cambio de fase, invalidación e incidentes;
- roles de aprobación de gates/acciones irreversibles aplicables;
- checklist de reporte SCED usado al cierre.

La preinscripción no contiene resultados futuros. Cuando un parámetro depende de H2/H4/H5/H8/H10, congela **el procedimiento que lo medirá y el gate que lo fijará**, no un valor inventado.

### 10.8 Exposición externa, autoestudio y techo/suelo

Al inicio de cada sesión se registra exposición desde la sesión anterior con una clasificación cerrada:

- `NONE`;
- `UNRELATED_OR_FOUNDATION` — contenido ajeno a los KC objetivo o solo fundamentos compartidos;
- `TARGET_KC_EXPOSURE` — autoestudio, enseñanza humana, tutor, video, libro, IA externa o práctica deliberada sobre un KC objetivo del conjunto;
- `DIRECT_ITEM_EXPOSURE` — acceso al mismo reactivo, solución o variante isomorfa de una sonda/reserva.

Efecto:

- `UNRELATED_OR_FOUNDATION` se registra y no invalida por sí solo;
- `DIRECT_ITEM_EXPOSURE` invalida el reactivo/oportunidad afectada, consume el ítem y solo permite reposición desde reserva independiente;
- `TARGET_KC_EXPOSURE` contamina la atribución desde el momento declarado. Si ocurre mientras el conjunto está en línea base o antes de una medición de retención, la transición/retención afectada no puede sostener un veredicto positivo y se marca `EXTERNAL_EXPOSURE`; no se “limpia” mediante una reposición de reactivo porque la contaminación es conceptual, no del ítem;
- enseñanza humana deliberada sobre KC objetivo mantiene además la regla de intervención pedagógica prohibida.

Regla de techo/suelo para la línea base:

- **techo:** si las tres últimas observaciones válidas previas al inicio planificado son perfectas (`1.00`) y no existe rango ascendente observable, el conjunto no inicia intervención y su transición se marca `NOT_INTERPRETABLE_CEILING`;
- **suelo:** una línea baja o incluso `0` no es por sí sola inválida. Solo se marca `NOT_INTERPRETABLE_FLOOR` cuando tres observaciones consecutivas están en `0` **y** la evidencia de fundamentos/interfaz muestra que el participante no puede producir una respuesta puntuable por una barrera previa al KC objetivo. Si las respuestas son válidas y el `0` representa desconocimiento real del KC, la línea sigue siendo interpretable.

### 10.9 Cambios durante el piloto

Un cambio puede ser:

- reparación no sustantiva de interfaz;
- reparación evaluativa;
- cambio de contenido;
- cambio de modelo;
- cambio de política pedagógica;
- cambio de verificador.

Los cambios sustantivos crean una nueva versión y pueden exigir reiniciar la fase afectada. Nunca se corrige silenciosamente el pasado.

---

## 11. Auditoría humana externa

### 11.1 Principio

La auditoría no forma parte de la operación docente. Ocurre después de que el Profesor IA toma sus decisiones y no se usa para rescatar el aprendizaje en tiempo real.

### 11.2 Censo obligatorio reducido a resultados críticos

El auditor revisa a ciegas el 100 % de:

- sondas que constituyen la medida primaria;
- evaluaciones de retención;
- respuestas libres puntuadas;
- falsos positivos o negativos sospechados;
- apelaciones;
- actos involucrados en incidentes;
- resultados que determinen una conclusión principal.

### 11.3 Muestreo del resto

Se aplica muestreo estratificado a:

- actividades de práctica;
- explicaciones;
- retroalimentación;
- decisiones de adaptación;
- reactivos no consumidos;
- anclajes;
- cierres de sesión.

La fracción se preinscribe. Para cada estrato se registran al menos `N_h`, `n_h`, fracción real, método/semilla de selección, probabilidad de inclusión cuando sea calculable, familia/origen y defectos por severidad. El informe calcula la capacidad de detección de tasas de defecto preinscritas relevantes o una curva OC equivalente cuando el plan lo permita, sin sustituir los gates vigentes.

Puede reducirse después de una ventana de calibración únicamente si se cumplen umbrales definidos y la evidencia procede de un manifiesto/versión compatible. Un cambio sustantivo de generador, política de autoría, verificador o codebook reinicia o invalida la ventana aplicable. El censo de resultados primarios nunca se reduce en Etapa 1.

### 11.4 Cegamiento

Cuando se evalúa concordancia, la primera decisión del auditor se **bloquea** antes de revelar el veredicto del sistema. En esa primera pasada también se ocultan identidad del generador, historial de defectos, adjudicaciones previas y otros metadatos no necesarios para juzgar el artefacto. El descegamiento posterior para causa raíz/adjudicación conserva de forma inmutable el juicio original.

Para el análisis visual SCED puede existir una primera pasada con etiquetas de fase/orden minimizadas u ocultas cuando sea metodológicamente viable; el juicio final estructurado se realiza con la información necesaria y conserva ambas pasadas.

### 11.5 Qué no puede hacer el auditor

- modificar retroactivamente una explicación sin registrar el incidente;
- convertir un fallo del sistema en éxito;
- enseñar al alumno el contenido fallido dentro de la condición;
- seleccionar solo casos favorables;
- excluir datos por conveniencia.

### 11.6 Métricas de concordancia

Para salidas binarias:

- matriz de confusión;
- acuerdo observado;
- prevalencia/base rate;
- falsos positivos;
- falsos negativos;
- denominadores visibles.

Para salidas ordinales:

- acuerdo exacto;
- acuerdo dentro de una categoría;
- matriz de confusión;
- estadísticos descriptivos apropiados.

No se presentan las observaciones repetidas de un solo alumno como evidencia de fiabilidad poblacional. Cuando existan evaluaciones humanas independientes repetidas, pueden añadirse métricas ajustadas al diseño como diagnóstico secundario; ninguna sustituye los conteos de fallos críticos ni adquiere autoridad operativa.

### 11.7 Codebook, calibración y adjudicación

La auditoría usa un **codebook versionado** de severidad y códigos de defecto. La severidad se decide por consecuencia sobre corrección/veredicto, contaminación de medición o solución, y evidencia de causa común de familia/generador. Antes de la corrida, quien participe en mediciones de concordancia se calibra con materiales ajenos a las reservas experimentales.

Puede preinscribirse un segundo auditor independiente en una **submuestra de calibración/adjudicación** si el costo humano lo permite. Esta segunda evaluación ocurre fuera del circuito pedagógico y su carga se registra como resultado de autonomía/viabilidad.

Se conservan de forma append-only: juicio ciego original, segunda evaluación si existe, adjudicación, causa raíz, acción sobre la familia, nueva muestra y regresión. Una adjudicación no borra el desacuerdo inicial.

---

## 12. Carga humana y veredictos separados

### 12.1 Registro de carga

Se registran por separado:

- horas para definir el sobre experimental;
- horas de construcción técnica;
- horas de auditoría previa;
- minutos de auditoría por sesión;
- tiempo de atención de incidentes;
- tiempo de apelaciones;
- tiempo de mantenimiento;
- tiempo de corrección entre versiones;
- referencia de tiempo de una operación docente convencional comparable, cuando se mida o estime.

Cada asiento de carga registra además:

- `clase_de_carga`: `FIJO_PROYECTO`, `FIJO_POR_UNIDAD`, `MARGINAL_POR_SESION` o `MARGINAL_POR_ALUMNO`;
- `sin_equivalente_convencional`: booleano;
- método de obtención: `MEDIDO`, `ESTIMADO` o `NO_DISPONIBLE`;
- supuestos y unidad de medida.

Una referencia humana **estimada** no se presenta como observación. Si se realiza una medición humana comparable, ocurre después del freeze, sobre una tarea acotada, sin contacto con el participante, sin incorporar sus artefactos al paquete y separada de la auditoría experimental. No constituye contrafactual de aprendizaje del alumno.

Las proyecciones de escala distinguen carga fija de carga marginal; no extrapolan automáticamente el costo de construcción de un n=1 como si creciera linealmente con participantes.

### 12.2 La carga no invalida el aprendizaje

Una carga humana alta no convierte en falso un resultado de aprendizaje producido por el Profesor IA.

Puede concluirse simultáneamente:

- el sistema enseñó;
- el sistema necesitó demasiada infraestructura o auditoría;
- el sistema todavía no es un producto viable.

### 12.3 Cuatro veredictos independientes

Al terminar la Etapa 1 se emiten cuatro veredictos mediante el `verdict-manifest` congelado y P-I §10.5.1. `verdict-engine` aplica la tabla determinista y `EXPERIMENT_AUDITOR` aprueba la emisión final; no se cambian criterios después de observar resultados.

#### A. Veredicto pedagógico

- `fuerte`: A/B/C tienen clase `FAVORABLE`, no existe covariación invalidante, `TRANSFER_MEASUREMENT` cumple el anclaje favorable CAL-15 y la retención evaluada cumple el anclaje favorable CAL-15;
- `parcial`: al menos dos transiciones son `FAVORABLE`, pero la restante es `NO_FAVORABLE`/`NOT_INTERPRETABLE` o transferencia/retención no alcanza soporte para `fuerte`;
- `solo_asistido`: existe desempeño/dominio durante `LEARNING_MODE`, pero menos de dos transiciones independientes resultan `FAVORABLE`;
- `negativo`: al menos dos transiciones son interpretables y `NO_FAVORABLE`;
- `no_interpretable`: quedan menos de dos transiciones interpretables, o contaminación/fallo sistémico/pérdida de datos impide la inferencia.

La ausencia de retención evaluable impide `fuerte` y obliga a declarar `retention_not_evaluated`.

#### B. Veredicto de autonomía

- `completa_dentro_del_alcance`: todas las funciones incluidas completan su responsabilidad mediante IA+código, sin intervención humana extraordinaria dentro de la ejecución.
- `completa_con_controles_automaticos`: lo anterior se alcanza con uno o más vetos, retries, fallbacks o recuperaciones automáticas fuera del camino nominal; no existe rescate humano.
- `parcial_con_excepciones`: una o más funciones no críticas requieren excepción/desactivación o intervención humana permitida y registrada, sin contaminar medición.
- `fallida`: una función bloqueante no puede completarse autónomamente y la ejecución debe detenerse.
- `contaminada_por_intervencion_humana`: ocurrió intervención pedagógica humana prohibida o una acción humana que impide atribuir la ejecución al sistema autónomo.

#### C. Veredicto de integridad y seguridad

- `valida`: sin incidentes que afecten inferencia.
- `valida_con_desviaciones`: desviaciones registradas cuyo alcance está demostrado y no afecta las inferencias utilizadas.
- `con_reservas`: incertidumbre material localizada limita una conclusión sin invalidar toda la corrida.
- `invalida`: incidente sistémico o pérdida de requisitos esenciales.

#### D. Veredicto de viabilidad

- `prometedora`: la corrida funcional fue completada y no aparece un bloqueo operacional estructural dentro del entorno autorizado.
- `costosa_pero_reducible`: la corrida funciona, pero existe carga marginal recurrente o dependencia operacional material con una ruta explícita de reducción.
- `no_sostenible`: la operación requiere recurrentemente una función humana/externa incompatible con la sustitución funcional o no existe ruta identificada para eliminar un bloqueo operacional.
- `no_evaluada`: faltan telemetría, carga humana o datos operativos necesarios.

Los costos, recursos, latencias y carga humana reales se incorporan solo cuando H8–H11 los produzcan. No existe threshold empírico inventado para asignarlos.

El informe final se interpreta en orden **C. Integridad → B. Autonomía → A. Pedagogía → D. Viabilidad**. Un resultado de integridad inválida limita o invalida la inferencia causal; una viabilidad negativa no borra por sí sola un aprendizaje válidamente observado.

### 12.4 Regla para pasar a una etapa posterior

Para estudiar con más alumnos se requiere:

- evidencia de aprendizaje sin asistencia en las transiciones previstas;
- ningún falso positivo sistémico abierto;
- ninguna fuga de solución no contenida;
- evidencias reconstruibles;
- privacidad operable;
- autonomía ordinaria sin rescate docente;
- fallos documentados y reproducibles.

La viabilidad económica puede quedar pendiente para una etapa de producto, pero debe reportarse honestamente.

---

## 13. Fallos, incidentes e invalidación

Esta sección es la **taxonomía canónica** de incidentes para toda la especificación. El manifiesto congela `incident_code`, nivel y efecto de validez; Parte III referencia esta taxonomía y no puede crear una severidad paralela con el mismo nombre.

### 13.1 Niveles

#### Nivel 1 — Menor

Redacción imprecisa o fallo de interfaz sin efecto demostrable sobre evaluación.

Acción: registrar, corregir en versión posterior y continuar si no afecta integridad.

#### Nivel 2 — Pedagógico o evaluativo localizado

- explicación incorrecta;
- reactivo ambiguo;
- falso negativo;
- pista demasiado reveladora;
- pérdida de evidencia de un acto;
- decisión de avance incorrecta.
- corrección post-`COMMIT` o fallo de percepción/interfaz que alteró un acto puntuable;

Acción: invalidar el acto o bloque, conservar evidencia y clasificar como fallo de autonomía. No se rescata manualmente dentro de la condición.

#### Nivel 3 — Sistémico

- falso positivo del verificador no contenido;
- contaminación del banco;
- fuga de soluciones;
- cambio no registrado de modelo o contenido;
- pérdida transversal de evidencias;
- fallo de identidad;
- vulneración de privacidad.
- ruta efectiva no autorizada a soluciones/sondas/secretos;
- inconsistencia sistémica del ledger, manifest o privilegios runtime;

Acción: suspender el piloto, contener, investigar y decidir si debe reiniciarse la fase.

### 13.2 Reposición

Una reposición:

- usa reserva independiente;
- mantiene el registro original marcado como inválido;
- no borra el fallo;
- no cuenta como éxito autónomo si requirió intervención pedagógica humana;
- documenta versión, causa y corrección.

Si la reserva válida se agota durante H11, **no se generan ni autorizan reactivos nuevos en caliente**. El acto/medida afectado se registra como dato faltante por `reserve_exhausted`, se aplica la regla de interpretabilidad preinscrita y se clasifica la consecuencia como Nivel 2 si es localizada o Nivel 3 si compromete transversalmente una fase/conclusión.

### 13.3 Derecho del alumno

El alumno puede:

- apelar una explicación o calificación;
- solicitar revisión humana posterior;
- detener la sesión;
- retirarse sin penalización;
- conocer qué datos se conservan y las condiciones generales de su tratamiento;
- ejercer acceso, rectificación, cancelación y oposición conforme al procedimiento aplicable;
- revocar el consentimiento cuando proceda, sin efectos retroactivos automáticos;
- conocer el punto de contacto y los plazos aplicables a sus solicitudes.

La revisión humana protege derechos, pero no reescribe la evidencia experimental. El ejercicio de derechos de datos o la retirada puede detener tratamiento/sesión y producir datos faltantes; nunca autoriza rescate pedagógico.

---

## 14. Gobernanza, privacidad y ética

Para la Etapa 1 con participante real, el proyecto usa como marco de referencia la **LFPDPPP vigente desde 2025**, sin declarar cumplimiento global. Antes de H11, el Responsable de datos debe verificar con revisión profesional la aplicabilidad concreta, la vigencia del Reglamento que corresponda, la relación jurídica que determina cualquier periodo de bloqueo y los instrumentos de cada proveedor.

La arquitectura adopta de forma conservadora los principios de minimización, finalidad, proporcionalidad, seguridad, información, responsabilidad y ejercicio de derechos. La seudonimización reduce exposición, pero **no se trata como anonimización** frente al responsable que conserva capacidad de vinculación.

### 14.1 Roles humanos

Roles canónicos de gobernanza:

- `SYSTEM_OWNER`: construye/configura el sistema y produce evidencia técnica;
- `CORPUS_APPROVER`: autoriza externamente el corpus propuesto por W0;
- `TECHNICAL_AUDITOR`: revisa cálculo, verificador, permisos, reproducibilidad y evidencia técnica;
- `EXPERIMENT_AUDITOR`: revisa preinscripción, aislamiento, manifests/desviaciones y autoriza apertura/cierre de la corrida; permanece fuera del circuito pedagógico;
- `SECURITY_PRIVACY_RESPONSIBLE`: ejecuta procedimientos de seguridad, privacidad, retirada e incidentes;
- `PROFESSIONAL_REVIEWER`: profesional externo solo donde un gate de revisión jurídica/ética/accesibilidad lo requiera. Definir el rol no presume resuelto el punto profesional.

Asignación mínima:

| Gate/acción | `responsible_role` | `approver_role` |
|---|---|---|
| H2 — cálculo/verificador | `SYSTEM_OWNER` | `TECHNICAL_AUDITOR` |
| H4/H8 — bindings/capacidades de modelos | `SYSTEM_OWNER` | `TECHNICAL_AUDITOR` |
| W0/H4.5 — autorización de corpus | sistema W0 / `SYSTEM_OWNER` | `CORPUS_APPROVER` |
| H5 — freeze de contenido/bancos | `SYSTEM_OWNER` | `EXPERIMENT_AUDITOR` |
| H9 — paquete operativo de gobernanza | `SECURITY_PRIVACY_RESPONSIBLE` | `EXPERIMENT_AUDITOR` + `PROFESSIONAL_REVIEWER` donde corresponda |
| H10 — seguridad/restore/ledger | `SYSTEM_OWNER` + `SECURITY_PRIVACY_RESPONSIBLE` | `TECHNICAL_AUDITOR` |
| H11 — autorización de primera corrida real | `SYSTEM_OWNER` | `EXPERIMENT_AUDITOR` |
| reinicio tras incidente sistémico | responsable de la causa | `EXPERIMENT_AUDITOR` + auditor de la clase afectada |
| W13 — emisión de cuatro veredictos | `analysis-engine` / `SYSTEM_OWNER` para producir artefactos | `EXPERIMENT_AUDITOR` |

Ningún modelo de IA puede ocupar `approver_role`. El responsable de producir una evidencia bloqueante no puede sustituir ad hoc la aprobación requerida. Las personas concretas se asignan en el run manifest; aquí se congelan funciones y separación de autoridad.

**Compatibilidad mínima de roles:**

- `SYSTEM_OWNER` no puede aprobar H2, H5, H10, H11 ni W13 cuando produjo la evidencia sometida a aprobación; por ello no puede ser simultáneamente el `TECHNICAL_AUDITOR` o `EXPERIMENT_AUDITOR` autoritativo de esos mismos gates;
- `SYSTEM_OWNER` tampoco puede ser el único `CORPUS_APPROVER` de una propuesta producida por el sistema bajo su control;
- `SECURITY_PRIVACY_RESPONSIBLE` puede coincidir con `SYSTEM_OWNER`, porque H9/H10 conservan aprobación independiente;
- `TECHNICAL_AUDITOR`, `EXPERIMENT_AUDITOR` y `CORPUS_APPROVER` pueden recaer en una misma segunda persona solo si no produjo el artefacto evaluado y se preservan cegamiento y conflictos de interés aplicables;
- `PROFESSIONAL_REVIEWER` puede coincidir con uno de los auditores únicamente cuando posea la competencia profesional requerida y no sea responsable del artefacto revisado;
- para abrir H11 se requieren **al menos dos personas naturales distintas**: una del lado responsable/propietario y otra con autoridad independiente de aprobación. Si un gate profesional no puede ser cubierto competentemente por esa segunda persona, se incorpora una tercera; el número adicional es consecuencia del gate profesional, no un valor inventado del experimento.

### 14.2 Identidad

- Cuenta seudónima.
- Contraseña, passkey o proveedor federado.
- Correo solo para validación o recuperación, no como único autenticador.
- MFA para administración y auditoría.
- Sin documentos oficiales, biometría ni cámara por defecto.
- La mayoría de edad se verifica mediante un procedimiento de mínima recolección definido en H9; no se conserva una copia de identificación oficial salvo que la revisión jurídica demuestre que es necesaria.

### 14.3 Minimización

Se recolecta únicamente lo necesario para:

- ejecutar la sesión;
- reconstruir decisiones;
- medir aprendizaje;
- ejercer derechos;
- investigar incidentes.

### 14.4 Separación de datos

Deben existir almacenes o permisos separados para:

- identidad real y llave de vinculación;
- expediente pedagógico seudonimizado;
- artefactos suprimibles que puedan contener texto libre, audio, imágenes o capturas del participante;
- soluciones y sondas reservadas;
- logs técnicos;
- auditoría.

La separación se implementa **dentro de los siete esquemas vigentes**; no crea un octavo esquema. El ledger guarda referencias/huellas y estado de tratamiento cuando sea suficiente para reconstrucción, evitando duplicar contenido personal bruto.

### 14.5 Conservación, bloqueo y supresión

Antes del piloto existe un inventario de tratamientos con, al menos:

`categoria_de_dato → finalidad → base/justificación → almacén → encargado/tercero → plazo → disparador_de_bloqueo → método_de_supresión`.

Los plazos exactos se fijan antes del piloto y se someten a revisión jurídica. Como política interna:

- identificadores y llave de vinculación: solo mientras sean necesarios para finalidades, seguimiento de derechos e incidencias;
- evidencias pedagógicas seudonimizadas: plazo limitado y justificado por el protocolo;
- artefactos de texto/audio/imagen/captura: mínimo necesario y suprimibles por diseño;
- logs técnicos: mínimo operativo demostrable;
- consentimientos, avisos entregados y registros de derechos: conforme a finalidad, responsabilidad y revisión jurídica.

Cuando aplique cancelación, el procedimiento distingue **bloqueo** de **supresión**. Durante bloqueo, el dato no se reutiliza para finalidades pedagógicas, analíticas o de producto. La supresión elimina o neutraliza los elementos personales según el plan jurídico/técnico aprobado y deja únicamente la evidencia mínima permitida de que la operación ocurrió.

No se presupone que destruir una clave, borrar una tabla de identidad o conservar solo hashes convierta automáticamente el resto del expediente en anónimo o satisfaga por sí solo una obligación legal. El resultado se prueba técnicamente en H10 y se valida jurídicamente antes de H11.

### 14.6 Aviso de privacidad y consentimiento informado

Son dos artefactos distintos.

**Aviso de privacidad.** H9 genera una versión breve/simplificada para la interfaz y una versión integral. Deben reflejar el marco vigente, identificar al responsable y punto de contacto, finalidades, categorías de datos, mecanismos de derechos, cambios del aviso y, cuando exista una **transferencia real a tercero**, la cláusula/consentimiento que corresponda. Las remisiones a encargados se documentan con su instrumento contractual y se explican con transparencia sin etiquetarlas automáticamente como transferencias.

**Consentimiento informado de investigación.** Debe explicar:

- que la enseñanza será operada por IA;
- que no habrá un docente corrigiendo la clase en tiempo real;
- que el sistema puede equivocarse;
- que el participante puede pedir revisión humana posterior;
- objetivo de prueba de techo;
- datos, accesos, proveedores y conservación relevante;
- límites de las conclusiones;
- ausencia de calificación oficial;
- derecho a retirada, revocación y ejercicio de derechos aplicables;
- qué ocurre con la sesión y los datos si se retira;
- que una parada por seguridad/derechos no equivale a rescate pedagógico;
- que la publicación de resultados, si se mantiene como finalidad, usa medidas explícitas contra reidentificación.

Antes de consentir se realiza una comprobación breve de comprensión de los puntos no obvios. El criterio es propio del protocolo, no un umbral científico importado.

### 14.7 Ética de la prueba de sustitución

Probar sustitución funcional es aceptable únicamente si:

- el participante lo sabe;
- es adulto y consiente;
- puede retirarse;
- no pierde una calificación oficial;
- no se le priva de un servicio obligatorio;
- existe atención humana para seguridad y derechos;
- una parada por seguridad, privacidad, derechos o bienestar no pedagógico detiene la sesión sin transformarse en enseñanza humana;
- se reportan los fallos, no solo los éxitos;
- la enseñanza humana paralela no contamina silenciosamente la medición.

Una revisión ética externa puede realizarse como **buena práctica** y queda archivada si existe, pero este documento no la presenta como obligación legal general del piloto. La revisión jurídica profesional previa a H11 sí forma parte del gate H9.

---

## 15. Requisitos técnicos funcionales

### 15.1 Núcleo determinista obligatorio

El sistema debe contener, independientemente del proveedor de modelo:

- motor de sesión;
- verificador;
- buscador de demostraciones;
- selector de reactivos;
- motor de dominio;
- política de recuperación;
- calendario experimental;
- bitácora append-only;
- sistema de freeze;
- filtro de egreso;
- muestreador de auditoría;
- exportador de datos.

### 15.2 Modelo generativo intercambiable

El modelo debe estar detrás de una pasarela que permita:

- cambiar proveedor sin cambiar el núcleo;
- congelar versión;
- registrar entradas y salidas permitidas;
- aplicar límites de contexto;
- activar modo degradado;
- bloquear una versión que no supera pruebas.

### 15.3 Modo degradado

Si el modelo falla durante una sesión:

- el sistema puede continuar únicamente con explicaciones y pistas previamente congeladas;
- no puede inventar una solución;
- el evento se registra;
- si el modo degradado altera sustantivamente la condición, el bloque se marca como desviación.

### 15.4 Evidencia append-only e integridad verificable

Cada acto debe registrar:

- identificador seudónimo no equivalente a identidad real;
- evento;
- entrada/salida estructurada necesaria o referencia a artefacto suprimible;
- decisión;
- componente decisor;
- ayudas;
- tiempos;
- anclajes;
- versiones;
- hash previo y propio;
- estado válido o inválido;
- correcciones enlazadas.

El ledger **no contiene identidad real**. Texto libre, audio, imágenes o capturas que puedan incluir información personal se persisten solo cuando la finalidad lo requiere y, preferentemente, fuera del registro append-only como artefactos referenciados y suprimibles. El hash de un artefacto no se considera por sí mismo anonimización.

No se usan actualizaciones destructivas para corregir el historial.

`append-only` se interpreta de forma operacional: los roles runtime no pueden modificar ni borrar eventos históricos; una corrección es un evento nuevo que referencia al original. La base debe impedir `UPDATE`/`DELETE` con credenciales runtime.

La cadena `previousHash → hash` sirve para detectar alteración respecto de una referencia confiable. En puntos congelados —al menos freeze, cierre de sesión/backup según política— se genera un **checkpoint firmado** con el `chain_head`, rango/secuencia, hash del manifest y `key_id`; la clave privada no está disponible para `session-engine` ni `model-gateway`.

Esta arquitectura no autoriza afirmar que la evidencia es inmutable frente a un administrador total del host. Si el mismo actor controla DB, filesystem, claves y todos los checkpoints, puede reconstruir una historia coherente. El threat model y el informe final deben declarar ese límite.

---

## 16. Etapas posteriores

### 16.1 Etapa 1 — Prueba de techo n=1

Objetivo: comprobar el máximo nivel de sustitución funcional en una subunidad y localizar fallos.

### 16.2 Etapa 2 — Replicación con más alumnos

La opción metodológica inicial preferida es **replicar una línea base múltiple entre participantes/casos**, manteniendo introducciones escalonadas y, cuando el diseño lo permita, una regla de aleatorización preinscrita. Esto es una concreción candidata de Etapa 2, no una modificación retroactiva de Etapa 1.

Podrá incluir:

- múltiples participantes/casos;
- replicación del efecto por caso;
- mejores estimaciones de dificultad y heterogeneidad descriptiva;
- más auditores;
- comparación entre versiones del sistema;
- análisis cuantitativos comparables con diseños entre grupos cuando sus supuestos y estructura realmente correspondan;
- cálculo de potencia o efecto mínimo detectable por simulación;
- comparación **separada** con enseñanza humana;
- ampliación de subunidades.

No se fija ahora un `N` universal. El tamaño de muestra se deriva de diseño, efecto objetivo, varianza/autocorrelación asumida, potencia o precisión buscada, reclutamiento real y costo. Con pocos casos, la heterogeneidad se reporta principalmente por replicación/descripción, no como una varianza poblacional estimada con falsa precisión.

### 16.3 Etapa 3 — Diseño del producto

Solo después de conocer el techo se decide:

- qué funciones conservar autónomas;
- qué funciones requieren revisión;
- qué nivel de riesgo es aceptable;
- cuánto trabajo humano es sostenible;
- integración institucional;
- modelo económico;
- posible calificación oficial.

La Etapa 3 puede terminar siendo un copiloto docente, un tutor supervisado o un profesor autónomo limitado. Esa decisión no se toma antes de medir el techo. Para evitar etiquetas de marketing ambiguas, estas categorías son **convenciones internas operacionales**, no una taxonomía científica universal:

- **copiloto docente:** al menos una función crítica requiere aceptación humana previa antes de que el acto pedagógico llegue al alumno;
- **tutor supervisado:** el sistema puede operar la sesión, pero una o más funciones críticas requieren revisión humana sistemática ex ante por sesión/unidad;
- **profesor autónomo limitado:** dentro del sobre operativo declarado, las funciones ordinarias no requieren revisión humana previa y las intervenciones se limitan a seguridad, derechos, gobernanza y auditoría ex post.

La carga de auditoría ex post afecta principalmente la **viabilidad**, no convierte retroactivamente una función autónoma en supervisada. Si una materia futura carece de un verificador determinista equivalente, no hereda automáticamente los gates de Etapa 1: debe definirse y validar una nueva autoridad de medición. Un LLM-juez no se adopta por defecto como sustituto del verificador.

---

## 17. Fuera de alcance de esta Etapa 1

- clases grupales;
- menores de edad;
- calificación oficial;
- decisiones disciplinarias;
- acusaciones automáticas de fraude;
- voz-a-voz end-to-end sin texto canónico y sin trazabilidad;
- cámara/webcam y biometría;
- uso de STT, visión o reconocimiento de manuscrito como autoridad única de calificación formal;
- captura externa de pantalla activada de forma silenciosa o permanente;
- inferencia emocional;
- materias de evaluación principalmente interpretativa;
- ensayos extensos como medida primaria;
- conversación ilimitada fuera del corpus;
- navegación web libre durante la sesión;
- modificación autónoma del corpus congelado;
- aprendizaje poblacional;
- afirmaciones de equivalencia general con docentes;
- rescate pedagógico humano oculto;
- integración LTI obligatoria;
- autonomía jurídica o institucional.

---

También quedan fuera de alcance:

- crawler web general no restringido;
- navegación web del agente de sesión;
- RAG vectorial general en sesión;
- GraphRAG/Neo4j u otra infraestructura de grafo dedicada si el DAG de KC explícito basta;
- actualización silenciosa de un curso durante una corrida;
- empaquetado definitivo como aplicación de escritorio antes de cerrar el diseño de interfaz.

## 18. Decisiones vinculantes cerradas en v4

| # | Decisión | Resolución |
|---|---|---|
| 1 | Propósito | La Etapa 1 es una prueba de techo de sustitución funcional |
| 2 | Operación de clase | Sin docente humano en el circuito ordinario |
| 3 | Autoría | IA y código generan mapa, banco, pistas, rúbricas y sesiones |
| 4 | Fuente | Corpus externo, fijo, autorizado y no modificable por la IA |
| 5 | Corrección formal | Verificador determinista con segundo canal semántico |
| 6 | Rescate pedagógico | Prohibido dentro de la condición experimental |
| 7 | Medición | Sondas nuevas sin asistencia y reserva aislada |
| 8 | Auditoría | Censo de resultados críticos; muestra estratificada del resto |
| 9 | Carga humana | Se mide; no invalida aprendizaje, pero condiciona producto |
| 10 | Diseño principal | Línea base múltiple concurrente entre tres conjuntos |
| 11 | Autoría autónoma | Estudio secundario separado del efecto pedagógico |
| 12 | Fallos | Se conservan como evidencia del límite; no se ocultan mediante corrección manual |
| 13 | Alumno | Adulto, consentimiento informado, sin calificación oficial |
| 14 | Sesión | Texto, individual, estado estructurado y trazabilidad completa |
| 15 | Evolución | Primero medir techo; después diseñar el producto sostenible |

---

## 19. Criterio final de honestidad

La Etapa 1 habrá cumplido su propósito incluso si el resultado es negativo, siempre que permita responder con evidencia:

- qué logró hacer el Profesor IA sin docente;
- dónde falló;
- qué controles automáticos fueron suficientes;
- dónde fue necesaria intervención humana;
- si el alumno aprendió sin asistencia;
- cuánto costó sostener la autonomía;
- qué debe conservarse o retirarse en la siguiente etapa.

> **El fracaso útil no es que la IA no sustituya al profesor. El fracaso real sería construir un sistema tan supervisado que nunca permita saber si podía hacerlo.**

---

**Fin de la base funcional consolidada v4.**


---

# Parte II — Plan técnico y de construcción

**Estado:** plan técnico integrado y vigente.  
**Fecha:** agosto de 2026.  
**Objetivo técnico:** construir primero una prueba local reproducible de Profesor IA y, solo después de demostrar valor funcional, activar la infraestructura necesaria para un piloto formal externo/remoto.

---

## 0. Cómo leer este documento

Este documento contiene:

1. una arquitectura de referencia única;
2. un núcleo obligatorio común;
3. una secuencia de construcción con puertas de salida;
4. un entorno **local-first** y un entorno de despliegue futuro;
5. perfiles de modelo separados del lugar de ejecución;
6. una recomendación concreta para la primera corrida.

El lugar de ejecución no cambia las funciones ni la validez. El hosting es una necesidad operativa eventual, no un requisito para comprobar primero si Profesor IA funciona.

### 0.1 Decisión técnica principal

Se adopta un **monolito modular con procesos aislados**, no microservicios completos.

Razones:

- equipo pequeño;
- piloto n=1;
- menor fricción de desarrollo;
- tipos y contratos compartidos;
- despliegue reproducible;
- aislamiento real en los componentes críticos;
- migración posterior posible sin pagar complejidad desde el inicio.

### 0.2 Stack tecnológico normalizado

Estados de esta tabla:

- **CONGELADA:** se implementa así salvo incompatibilidad técnica demostrable y documentada.
- **CONDICIONADA A BENCHMARK:** se decide midiendo.
- **DIFERIDA A ETAPA 2 / DIFERIDA A PRODUCTO:** no se construye en el alcance actual.


**Regla de reproducibilidad de dependencias:** las familias de versión escritas en esta tabla son restricciones de compatibilidad, no dependencias congeladas. Antes de cerrar cada freeze, el repositorio genera desde el lockfile un inventario/SBOM de dependencias directas y transitivas con versión, licencia declarada, fuente de resolución y advisories aplicables. La autoridad reproducible es `lockfile + SBOM + digests` del freeze; una vulnerabilidad conocida no aceptada explícitamente o una licencia incompatible bloquea el gate.

Los nombres de modelos/endpoints son snapshots factuales fechados. Cada candidato externo requiere un `model_binding` y `ModelCapabilities` reverificados inmediatamente antes del benchmark/freeze; ningún identificador vigente hoy selecciona al ganador.
| Área | Tecnología | Versión | Estado | Motivo |
|---|---|---|---|---|
| Lenguaje / runtime | TypeScript sobre Node.js | Node 24.x LTS "Krypton" (fallback 22.x); TypeScript 5.9.x — confirmar versión exacta al crear/freeze | CONGELADA | Node 24 continúa como LTS en la verificación documental vigente al freeze; la exacta versión parcheada se fija en lockfile. |
| Frontend | **Next.js + React**, usado mayoritariamente como presentación; sin Server Actions para decisiones sensibles | Next.js 16.x / React 19.x; fijar una versión parcheada vigente en el freeze | CONGELADA | La investigación tecnológica cerró Next.js + React. La autoridad de negocio permanece en Fastify; Next.js no decide dominio, transición ni validez. H1/CI bloquea una versión con advisory de seguridad aplicable sin mitigación/documentación. |
| Pizarrón V1 | **Excalidraw** detrás de `whiteboard-adapter`; versión fijada en freeze | versión estable verificada al implementar | CONGELADA | Permite dibujo, texto, formas, flechas e imágenes con escena estructurada. Se aísla detrás de adaptador para reducir dependencia de APIs programáticas cambiantes. tldraw queda como reevaluación si aparecen límites reales. |
| Overlay de anotaciones | **SVG propio** + targets semánticos + `getBoundingClientRect()` / geometría de board | API web estándar | CONGELADA | Evita usar visión para localizar elementos que la propia aplicación ya conoce y mantiene ejecución determinista de las anotaciones. |
| Captura interna | Export del pizarrón + rasterización controlada del DOM (p. ej. `html-to-image`, a verificar) | versión fijada al freeze | CONGELADA | La captura es fallback perceptivo y debe excluir overlays y capas sensibles por defecto. |
| TTS | Adaptador `speech-gateway`; benchmark inicial **ElevenLabs Flash v2.5 vs OpenAI TTS** | snapshot/modelo fijado al freeze | CONDICIONADA A BENCHMARK | Texto validado y registrado precede siempre al audio. Se mide español, vocabulario del curso, latencia, interrupción, privacidad y costo. |
| STT | Adaptador `speech-gateway`; benchmark inicial **Deepgram Flux Multilingual vs OpenAI streaming transcription** | modelo fijado al freeze | CONDICIONADA A BENCHMARK | Solo transcripciones finales comprometidas entran al motor; parciales son UI. Se inicia con push-to-talk. |
| Perfil visual | Operación `interpret_visual_context`; modelo visual del binding ganador/candidato vigente en H4, con **GPT-5.6 Sol** como candidato OpenAI verificado al 13-08-2026; Gemini solo entra como fallback si un benchmark específico de localización lo justifica | snapshot/binding fijado al freeze | CONDICIONADA A BENCHMARK | Solo para manuscrito, dibujo, imágenes o targets que no estén ya estructurados. Nunca es autoridad de validez formal. El nombre del modelo se reverifica antes del freeze. |
| Backend | Fastify (modularidad por encapsulación de plugins; validación JSON Schema nativa) | 5.x (verificar en freeze) | CONGELADA | Satisface "framework modular" del maestro con encapsulación real; menos dependencias que NestJS (respaldo); Express 5 no impone modularidad. |
| Contratos | JSON Schema + Zod | Zod 4.x (verificar) | CONGELADA | Un mismo contrato valida límites HTTP, eventos y salidas del modelo. |
| ORM / acceso a datos | Drizzle ORM (query builder tipado, SQL-first) | 0.4x.x (verificar en freeze) | CONGELADA | No exige superusuario en runtime; respeta el rol de mínimo privilegio por servicio. Prisma descartado (multi-schema frágil, permisos amplios en migrate); respaldo: Kysely. |
| Migraciones | SQL versionado con dbmate (roles, GRANT/REVOKE, triggers append-only); drizzle-kit solo para diff de tablas | dbmate 2.x (verificar en freeze) | CONGELADA | Es la pieza que hace ejecutables y auditables en CI los invariantes de separación de privilegios del maestro. Respaldo: node-pg-migrate. |
| Colas / trabajos | pg-boss sobre PostgreSQL (sin Redis) | 10.x (verificar en freeze) | CONGELADA | El maestro permite cola sobre Postgres; pg-boss da durabilidad transaccional, reintentos y cron sin añadir un componente al Compose. Respaldo: Graphile Worker. |
| Auth / MFA | Better Auth autoalojado: cuentas seudónimas, passkey/WebAuthn, TOTP administrativo, roles (alumno, auditor, responsable técnico, responsable de datos, investigador) | 1.x estable (pin exacto en freeze) | CONGELADA | Soberanía de datos sin desplegar un servicio pesado (Keycloak/Ory/SuperTokens descartados). Lucia descartado (deprecado). Fallback ya definido: `@simplewebauthn/server` 13.x + `otplib` 12.x si la línea 1.x resulta inestable en la verificación previa a instalar. |
| Monorepo | pnpm workspaces + Turborepo + dependency-cruiser | pnpm 10.x / Turborepo 2.x / dependency-cruiser 16.x (verificar) | CONGELADA | Codifica como reglas `forbidden` las 8 pruebas arquitectónicas del maestro §3.3 (p. ej. "model-gateway no importa soluciones", "verifier sin cliente HTTP"). Respaldo: Nx. |
| Pruebas / CI | Vitest + fast-check + Playwright + Testcontainers (PostgreSQL real) + **StrykerJS con `@stryker-mutator/vitest-runner`**; GitHub Actions con Docker | versiones exactas a verificar en freeze | CONGELADA | Un mock no prueba que un rol no puede leer `private_solutions` ni que `UPDATE/DELETE` sobre `evidence` falla; se requiere PostgreSQL real en CI. El runner oficial de Vitest usa análisis de cobertura por prueba. Mutation testing se limita al núcleo crítico y no impone un porcentaje universal como sinónimo de corrección. |
| Despliegue | Docker Compose; sin Kubernetes, sin microservicios completos | Compose Specification; Docker Engine 27.x | CONGELADA | Decisión consolidada; reproducibilidad desde cero como condición de "listo para piloto". |
| Hosting / cómputo | **No se contrata para la prueba funcional local.** Cuando se requiera un piloto externo/remoto: Hetzner Cloud, 1 VPS; dimensionamiento a verificar entonces | Familia disponible al despliegue | CONGELADA | El hosting no aporta valor a la primera prueba en la computadora del desarrollador. |
| Región | Falkenstein o Núremberg, Alemania (UE) | — | CONGELADA | La región no demuestra cumplimiento jurídico. Antes del piloto se verifica el DPA/instrumento de encargo, subencargados, términos y la clasificación del flujo bajo la LFPDPPP vigente; usar un encargado en la UE no vuelve por sí solo aplicable el GDPR al responsable mexicano. |
| PostgreSQL | **Autoalojado en Docker**: en la PC durante la prueba local; en el mismo VPS si después existe piloto externo/remoto. 7 esquemas y un rol por servicio; `evidence` append-only | 17.x; versión exacta al freeze | CONGELADA | Mantiene la misma arquitectura sin pagar hosting durante la validación local. |
| Almacenamiento de objetos | **Local durante prueba funcional**; DigitalOcean Spaces cuando se active un piloto externo/remoto | precio a revalidar | CONGELADA | Backups externos separados son necesarios para piloto real, no para descubrir si el sistema funciona. |
| Backups | Local simples durante desarrollo; wal-g + almacenamiento externo + restore drill antes del piloto formal | versión a verificar | CONGELADA | La prueba local necesita recuperación básica; la política fuerte entra antes de un participante real. |
| Observabilidad | OpenTelemetry desde desarrollo; dashboards externos solo cuando aporten valor | OTel 1.x | CONGELADA | Primero se registran métricas localmente; no se paga monitoreo para la prueba inicial. |
| Logs / errores | Logs locales estructurados durante desarrollo; Sentry UE opcional al desplegar a terceros | — | DIFERIDA A PRODUCTO | No se requiere plan pagado para la prueba local. |
| Gestión de secretos | Infisical autoalojado (contenedor en el propio Compose); inyección en runtime, nunca `.env` versionado | estable autoalojada (verificar en freeze) | CONGELADA | Mantiene los secretos dentro del perímetro propio. Respaldo si se requiere auditoría externa de accesos: Doppler Team. |
| TLS / dominios | No requerido en localhost; Caddy + Let's Encrypt + dominio cuando exista despliegue remoto | Caddy 2.x | DIFERIDA A PRODUCTO | No aporta nada a la primera prueba local. |
| Correo / notificaciones | Omitido en prueba local; Resend o sustituto al requerirse notificaciones externas | — | DIFERIDA A PRODUCTO | La prueba local no necesita correo transaccional. |
| Pasarela de modelo | Adaptadores propios TypeScript + Zod; perfiles `SESION` y `AUTORIA` con credenciales separadas; OpenRouter prohibido en piloto real | — | CONGELADA | Control total del contrato de las operaciones permitidas, del registro de uso y del modo degradado; evita agregadores con políticas de retención opacas. |
| Modelo de IA de sesión | Ganador del benchmark entre **Claude Sonnet 5** (Anthropic) y **GPT-5.6 Sol** (OpenAI), candidatos verificados como disponibles al 13-08-2026. Requisitos duros: salida estructurada utilizable + validación local independiente, política de datos compatible con H9, `model_binding` congelado y modo degradado | binding/huella congelados en el freeze | **CONDICIONADA A BENCHMARK** | Sonnet 5 se conserva como candidato de coste/rendimiento; no se afirma que sea el modelo Anthropic de máxima capacidad. Los nombres se reverifican antes de ejecutar evaluación; si cambia el conjunto de candidatos, se versiona el benchmark y no se reutiliza una evaluación contaminada. |
| Modelo de autoría / crítica | Modelo de razonamiento de **proveedor distinto** al ganador de sesión (sin pre-asignar un modelo concreto); optimización con caché de prompt y Batch API | snapshot congelado en el freeze | **CONDICIONADA A BENCHMARK** | La regla de Ronda 2 ("ningún ganador se declara sin medir") se aplica también al par autoría/crítica, no solo a sesión; fijar de antemano un modelo concreto reabriría esa regla sin haber medido. |
| Modelo económico / respaldo | Tier económico (mini/Haiku/Flash) del proveedor ganador de sesión, para CI, sesiones secas y clasificación barata | snapshot al freeze | **CONDICIONADA A BENCHMARK** | Perfil C del maestro: solo para construcción y pruebas sin datos reales; nunca condición principal del piloto real. |
| Modelo local (Perfil B) | Qwen3-14B GGUF Q5_K_M sobre llama.cpp, gramáticas GBNF, `temperature=0`, seed fija; commit de llama.cpp + SHA256 del GGUF congelados al activarse | commit + hash al ejecutarse | **CONDICIONADA A BENCHMARK** | El maestro §16.3 exige comparar el Perfil B **después** de la primera corrida con Perfil A; el modo degradado usa contenido congelado, no un modelo local, así que Perfil B no bloquea el piloto. |
| Hardware GPU | **Ninguna GPU nueva seleccionada.** La Tesla P100 existente puede usarse como banco de pruebas legado; cualquier compra futura se decide solo tras benchmark/TCO del Perfil B | toolchain exacto si se activa | **DIFERIDA A PRODUCTO** | La P100 no es plataforma objetivo. Si se usa, se congela una combinación compatible de driver + CUDA 12.x + commit de llama.cpp + GGUF/hash; no se importa un precio ni una SKU futura como decisión normativa. |
| PostgreSQL gestionado / alta disponibilidad | Ninguno en Etapa 1 | — | **DIFERIDA A ETAPA 2** | Añade costo, red y operación sin mejorar la validez experimental de un n=1; reevaluar solo en Etapa 2 si crece el número de participantes. |
| Redis, Kubernetes, LTI, RAG vectorial general | No se implementan | — | **DIFERIDA A PRODUCTO** | No son necesarios para el alcance de la Etapa 1 ni para la validez experimental del piloto. |
| Análisis experimental | Python + Jupyter sobre exportaciones seudonimizadas, fuera de la ruta de sesión | Python 3.13.x (verificar) | CONGELADA | Decisión consolidada. |

---

### 0.3 Regla local-first

Las decisiones de hosting siguen siendo válidas como **arquitectura de despliegue futuro**, pero no obligan a pagar servicios durante la primera prueba funcional.

La primera instancia corre en la computadora del desarrollador:

- Docker Compose;
- PostgreSQL local;
- Next.js/React;
- Fastify;
- pg-boss;
- verificador;
- repositorio de contenido;
- archivos y backups de desarrollo locales;
- APIs comerciales únicamente para las operaciones generativas que lo requieran.

Pasar a VPS, almacenamiento externo, TLS, dominio, observabilidad de producción o correo transaccional requiere una razón concreta: participante externo, acceso remoto, privacidad, continuidad o pilotaje formal.

### 0.4 Entorno operativo del propietario — entrada de planificación v2.11

Estas cifras no sustituyen BENCH/INFRA/CAL; sirven para que `Plan.md` no invente un entorno distinto:

| Campo | Valor de planificación | Autoridad posterior |
|---|---|---|
| SO | Windows 11 | H3 confirma versión/build/WSL2/compatibilidad |
| CPU | Intel Core i5, 8.ª generación | H8 mide carga real |
| RAM | 16 GB | H8/CAL-12 fija límites operativos |
| Almacenamiento | >1 TB disponible | H8 verifica espacio/IO real |
| Red | domiciliaria estable | telemetría H8 registra fallos/latencia |
| GPU local | ninguna en plan base | Perfil B solo si BENCH-05 se reabre |
| Hosting | ninguno en plan base | INFRA-01 puede justificar rama futura |
| Desarrollo asistido | Claude Code principal; Codex alternativo | puede cambiar sin alterar invariantes |
| Estilo de ejecución | alta autonomía del agente | tickets/CI deben reducir intervención manual |
| Tiempo humano | ≈1 h/día | MEAS-01 mide carga efectiva del proyecto |
| Presupuesto ordinario | priorizar OSS/gratuito; APIs ≈ MXN 500/mes | cost-ledger manda sobre estimaciones |
| Umbral de revisión | >MXN 700 acumulados requiere nueva decisión del propietario | no autoriza violar gates |

Las credenciales reales **no se versionan ni se dejan en un `.env` del repositorio**. La UX puede ofrecer una pantalla de conexión de proveedores, pero el backend debe inyectar secretos mediante el mecanismo seguro congelado.

## 1. Invariantes técnicos vigentes

Cualquier implementación es inválida si incumple uno de estos puntos.

### 1.1 El agente no es el sistema de control

El modelo generativo produce lenguaje y propuestas. No decide por sí solo:

- corrección formal;
- transición de fase;
- consumo de bancos;
- dominio;
- invalidación;
- congelamiento;
- permisos;
- conservación de datos.

### 1.2 El agente de sesión no puede leer soluciones

La separación debe existir en:

- credenciales;
- permisos de base de datos;
- procesos;
- dependencias de código;
- pruebas automatizadas.

### 1.3 Investigación y autoría autónomas ocurren fuera de sesión

W0/H4.5 investiga y propone fuentes antes de la ingesta. H5/W1–W5 construye y congela el paquete.

Durante la sesión:

- no se investiga libremente Internet;
- no se modifica el corpus;
- no se generan en caliente reactivos puntuables fuera de reservas autorizadas;
- una laguna se registra para una versión posterior.

El pipeline puede usar uno o varios llamados/modelos, pero no se adopta multiagente como requisito arquitectónico.
### 1.4 La medición está aislada de la enseñanza

Las sondas y semillas reservadas no están disponibles para:

- agente de sesión;
- módulo de práctica;
- generador de ejemplos;
- perfil del alumno.

### 1.5 El estado no vive en el chat

La conversación es una vista. La fuente de verdad es una máquina de estados persistente y reconstruible.

### 1.6 Toda evidencia es append-only

No se corrigen registros mediante sobrescritura. Una corrección es un evento nuevo enlazado.

### 1.7 Toda salida factual debe estar anclada

Las afirmaciones de contenido deben señalar fragmentos autorizados. Una salida no anclada no puede introducir reglas ni sustentar una evaluación.

### 1.8 El freeze es ejecutable

Congelar no significa escribir “versión final” en un documento. Debe existir un comando que produzca y firme un manifiesto verificable.

### 1.9 El fallo pedagógico no se convierte en escalamiento docente

El motor registra el límite. El panel humano no ofrece una función para “continuar como profesor” dentro de la sesión experimental.

---

## 2. Arquitectura de referencia

### 2.1 Vista general

```text
┌──────────────────────────────────────────────────────────────────────┐
│                           Cliente web                                │
│ chat · voz · editor Fitch · pizarrón · anotaciones · plan · evidencia│
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                    API de sesión autenticada
                               │
┌──────────────────────────────▼───────────────────────────────────────┐
│                        Aplicación principal                          │
│                                                                      │
│  Orquestador  ── Motor de sesión ── Motor de dominio                │
│       │                │                  │                           │
│       │                ├── Selector de bancos                        │
│       │                ├── Calendario experimental                   │
│       │                ├── Política de recuperación                  │
│       │                └── Registro de autonomía                     │
│       │                                                              │
│       ├── Pasarela de modelo ── Validador de salida                  │
│       ├── Recuperación de corpus autorizado                          │
│       ├── Bitácora append-only                                       │
│       └── Gobernanza e identidad                                     │
└───────────────┬───────────────────┬───────────────────────┬──────────┘
                │                   │                       │
        pipe/socket local     trabajos fuera sesión   lectura/escritura
                │                   │                       │
┌───────────────▼─────────┐ ┌──────▼────────────────┐ ┌───▼─────────────┐
│ Verificador aislado     │ │ Pipeline de autoría   │ │ PostgreSQL      │
│ parser · reglas · SAT   │ │ agentes · proof search│ │ esquemas y roles│
│ sin red · sin LLM       │ │ crítica · filtros     │ │ separados       │
└───────────────┬─────────┘ └──────┬────────────────┘ └───┬─────────────┘
                │                   │                       │
                └──────────┬────────┴───────────────┬──────┘
                           │                        │
                  almacén de soluciones      paquete congelado
                  y sondas reservado         y bitácora
```

#### 2.1.1 Flujo multimodal

```text
Alumno habla ─→ STT ─→ transcript COMMIT ─────────────┐
Alumno escribe/dibuja ─→ estado estructurado ─────────┤
                                  │                    ▼
                                  └─→ visión si falta → session-engine → modelo pedagógico
                                                                    │
                                                     texto canónico validado
                                                          ↙                  ↘
                                                        TTS            anotaciones SVG
```

La voz y visión son capas de entrada/salida/percepción. No sustituyen al `session-engine`, al estado estructurado ni al verificador.

### 2.2 Componentes principales

1. `web`
2. `api`
3. `session-engine`
4. `authoring-pipeline`
5. `verifier-service`
6. `measurement-service`
7. `model-gateway`
8. `evidence-ledger`
9. `governance`
10. `audit-console`
11. `experiment-exporter`
12. `speech-gateway` *(módulo/paquete, no microservicio obligatorio)*
13. `visual-interaction` *(módulo/paquete, no microservicio obligatorio)*

---

## 3. Repositorio y límites de código

### 3.1 Monorepo técnico

```text
profesor-ia/
├── apps/
│   ├── web/                     # alumno + consola externa
│   ├── api/                     # orquestador y endpoints
│   ├── verifier/                # proceso aislado
│   ├── authoring-worker/        # pipeline fuera de sesión
│   ├── measurement-worker/      # sondas y calendario aislados
│   └── background-worker/       # reportes, borrados y métricas
├── packages/
│   ├── contracts/               # esquemas y tipos compartidos
│   ├── logic-core/              # parser, AST, reglas y semántica
│   ├── session-engine/          # máquina de estados
│   ├── domain-engine/           # dominio y recuperación
│   ├── pedagogy-policy/         # estrategias, modos, andamiaje y selección determinista
│   ├── evidence/                # eventos, hashes y proyecciones
│   ├── content-schema/          # contrato del paquete
│   ├── authoring-core/          # etapas y validadores
│   ├── model-gateway/           # proveedores y filtros
│   ├── speech-gateway/          # adaptadores TTS/STT y commits de transcripción
│   ├── visual-interaction/      # whiteboard, captura, coordenadas y anotaciones
│   ├── security-policy/         # permisos y canarios
│   └── experiment/              # freeze, calendario y exportación
├── content/
│   └── unidad-deduccion-natural/ # submódulo o repo separado
├── analysis/
│   ├── notebooks/
│   ├── synthetic-data/
│   └── reports/
├── infra/
│   ├── compose/
│   ├── database/
│   ├── backups/
│   └── runbooks/
└── docs/
```

### 3.2 Repositorio de contenido separado

Para no mezclar versiones técnicas y pedagógicas, el paquete de contenido debe tener su propio historial:

```text
unidad-deduccion-natural/
├── research/
│   ├── whitelist.yaml
│   ├── candidates/
│   ├── source-scores.yaml
│   ├── conflicts.yaml
│   ├── coverage-saturation.yaml
│   ├── license-register.yaml
│   └── selection-manifest.yaml
├── source/
│   ├── manifest.yaml
│   └── fragments/
├── extracted/
│   ├── definitions.yaml
│   ├── notation.yaml
│   ├── rules.yaml
│   └── claims.yaml
├── provenance/
│   ├── anchors.yaml
│   └── curricular-decisions.yaml
├── kc/
│   ├── map.yaml
│   └── experimental-sets.yaml
├── objectives/
├── pedagogy/
│   ├── strategy-catalog.yaml
│   ├── selection-rules.yaml
│   ├── assistance-policy.yaml
│   ├── retrieval-spacing.yaml
│   └── shadow-metrics.yaml
├── session-templates/
├── items/
│   ├── diagnostic/
│   ├── guided-practice/
│   ├── independent-practice/
│   ├── recovery/
│   ├── probes-baseline/
│   ├── probes-intervention/
│   ├── transfer/
│   ├── retention/
│   └── replacement/
├── hints/
├── rubrics/
├── solutions-private/
├── golden-tests/
├── audits/
└── freeze-manifest.json
```

`solutions-private` no se monta en los contenedores del agente ni de la aplicación web.

### 3.3 Pruebas arquitectónicas

CI debe fallar si:

- `model-gateway` importa un módulo de soluciones;
- `web` accede a claves;
- `authoring-worker` consume sondas después del freeze;
- `session-engine` depende del SDK de un proveedor;
- `verifier` tiene cliente HTTP saliente;
- la ruta de verificación importa el módulo de canonicalización agresiva usado para isomorfismo/contaminación;
- un evento de evidencia permite `UPDATE` o `DELETE`;
- una salida factual carece de anclaje válido;
- el manifiesto de producción no coincide con el paquete congelado.

---

## 4. Verificador y buscador de demostraciones

### 4.1 Contrato del verificador

`logic-core` implementa y verifica únicamente el cálculo autorizado por la corrida. La fuente de autoridad para Etapa 1 es el siguiente artefacto congelado:

#### 4.1.1 `authorized-calculus-v1`

```yaml
authorizedCalculusVersion: authorized-calculus-v1
formal_system_id: forallx-calgary-tfl
logic: classical-propositional
proof_format: fitch
status: CONGELADA

source:
  work: "forall x: Calgary — An Introduction to Formal Logic"
  edition: "Fall 2025"
  revision: "8642250"
  revision_date: "2026-07-18"
  source_locator: "https://forallx.openlogicproject.org/"
  snapshot_kind: "official PDF"
  snapshot_size_bytes: 1562067
  snapshot_sha256: "2a8fea85b358fb45ba7835dee5166b5990b7a7c11ad4dc6c41ebdd9a265c1888"

language:
  atoms: ["A".."Z", "letras subindicadas"]
  atoms_content_policy_stage1: ["A".."Z"]
  connectives: ["¬", "∧", "∨", "→", "↔"]
  falsum:
    symbol: "⊥"
    kind: distinguished_atom
    semantics: always_false
  arity: strictly_binary
  precedence: none
  bracketing: mandatory_except_outermost
  content_policy_stage1:
    falsum_as_premise: false
    falsum_as_initial_assumption: false

rules:
  primitive: ["R", "∧I", "∧E", "∨I", "∨E", "→I", "→E", "↔I", "↔E", "¬I", "¬E", "X", "IP"]
  line_justifications: ["PR", "AS"]
  derived_allowed: ["DNE"]
  whitelist_closed: true

semantics:
  kind: classical_truth_functional_bivalent
  valuation_constraint: "v(⊥)=F"
  oracle_use: "fallo semántico puede rechazar; éxito semántico no certifica derivabilidad"

decision_policy:
  completeness_claimed: false
  no_proof_exists_in_calculus_enabled: false

proof_search:
  primary_budget: deterministic_work_units
  wall_timeout: safeguard_only
  cost_metric: proof_line_count

experimental_sets:
  versions_per_set: single
  rule_gating_by_phase: false
```

Toda referencia a capítulos, reglas, sintaxis o metateoría se resuelve contra ese snapshot. Cambiar de snapshot exige nueva versión documental del cálculo y comparación explícita antes de adopción.

**Sintaxis y normalización de verificación**

- No hay precedencia entre conectivos binarios. Toda fórmula binaria requiere corchetes internos; solo pueden omitirse los exteriores.
- `(A∧B)∧C` y `A∧(B∧C)` son fórmulas distintas; `A∧B∧C` se rechaza como sintaxis ambigua/no bien formada.
- La normalización del verificador se limita a alias→símbolo canónico, espacios, corchete exterior, equivalencia de glyphs de corchetes y canonicalización de subíndices.
- Están prohibidas en la ruta de verificación la normalización conmutativa/asociativa/distributiva, DNE automática, NNF/CNF/DNF, expansión de `↔` y el canonicalizador de isomorfismo.

**Alias de entrada cerrados**

- conectivos: `→` acepta `->`, `=>`; `∧` acepta `/\`, `&`; `∨` acepta `\/`, `|`; `↔` acepta `<->`, `<=>`; `¬` acepta `~`, `!`; `⊥` acepta `_|_`, `!?`, `#`;
- se rechazan como alias de conectivo `>`, `-`, `and`, `or`, `not`, `y`, `o`, `no`;
- nombres de regla admitidos como alias de entrada: `¬E` ← `⊥I`, `Contra`; `X` ← `⊥E`, `EFQ`, `Explosión`; `IP` ← `RAA`, `Reductio`, `Prueba indirecta`; `DNE` ← `¬¬E`, `DN`; `→E` ← `MP`; `→I` ← `CP`; `R` ← `Reit`, `Rep`; `∨E` ← `Casos`;
- todo alias se canonicaliza antes de verificar y **nunca** aparece como `rule_id` en `VerificationResult`, trazas o evidencia.

**Reglas**

| id | Forma autorizada |
|---|---|
| `R` | de `φ`, concluye `φ` |
| `∧I` | de `φ`, `ψ`, concluye `φ∧ψ` |
| `∧E` | de `φ∧ψ`, concluye uno de sus dos miembros |
| `∨I` | de `φ`, concluye `φ∨ψ` o `ψ∨φ` |
| `∨E` | disyunción + dos subpruebas a la misma conclusión |
| `→I` | subprueba `φ ⇒ ψ`, concluye `φ→ψ` |
| `→E` | `φ→ψ`, `φ` ⟹ `ψ` |
| `↔I` | dos subpruebas `φ⇒ψ` y `ψ⇒φ` |
| `↔E` | `φ↔ψ` + uno de sus lados ⟹ el otro |
| `¬I` | subprueba `φ⇒⊥`, concluye `¬φ` |
| `¬E` | `φ`, `¬φ` ⟹ `⊥` |
| `X` | `⊥` ⟹ cualquier `ψ` |
| `IP` | subprueba `¬φ⇒⊥`, concluye `φ` |
| `DNE` | `¬¬φ` ⟹ `φ`; elimina exactamente dos negaciones |

`PR` y `AS` son justificaciones de línea, no reglas de inferencia. Las reglas derivadas no autorizadas incluyen `DS`, `MT`, `DeM`, `LEM/TND`; quedan también prohibidas reglas de otros sistemas, reglas de reemplazo/equivalencia y reglas-oráculo tipo `Taut Con`. Cualquier regla no listada falla cerrado.

**Alcance y descarga**

- toda línea tiene justificación;
- `PR` solo aparece en el bloque de premisas de nivel 0;
- `AS` solo aparece en la primera línea de una subprueba;
- toda cita precede a la línea que la usa;
- una línea dentro de una subprueba cerrada deja de ser accesible desde fuera;
- una subprueba citada debe ser completa y accesible;
- la conclusión final está en profundidad 0 y no depende de supuestos abiertos;
- se permiten subpruebas de una línea y descarga vacua;
- el límite de profundidad es parámetro de implementación, no regla lógica.

**Lexicón español canónico**

Conectivos: `¬` negación; `∧` conjunción; `∨` disyunción; `→` condicional; `↔` bicondicional; `⊥` absurdo. Reglas: `R` reiteración; `∧I/∧E` introducción/eliminación de conjunción; `∨I/∨E` introducción/eliminación de disyunción; `→I/→E` introducción/eliminación de condicional; `↔I/↔E` introducción/eliminación de bicondicional; `¬I/¬E` introducción/eliminación de negación; `X` explosión; `IP` prueba indirecta (RAA clásica); `DNE` eliminación de doble negación; `PR` premisa; `AS` supuesto. Términos estructurales: `línea`, `cita`, `subprueba`, `alcance`, `línea accesible`, `descarga de supuesto`. Los ids formales nunca se traducen en trazas.

**Semántica y decisión**

El oráculo independiente usa semántica clásica bivalente veritativo-funcional con `v(⊥)=F`. Si encuentra un contraejemplo a `Γ ⊨ φ`, puede rechazar una pretensión de derivación por contraposición de la sanidad. Si confirma `Γ ⊨ φ`, **no** certifica por sí solo `Γ ⊢ φ` mientras la completitud de la implementación exacta no haya sido justificada y probada por versión.

`no_proof_exists_in_calculus` permanece deshabilitado hasta CALC-03. Tabla de verdad↔SAT, motor SAT/versión, presupuesto de proof search, profundidad, nodos y timeout continúan como parámetros de H2/H5. El buscador puede emitir `proof_found`, `search_budget_exhausted`, `no_proof_with_cost_at_most_k` y `minimalCostVerified` solo bajo las condiciones ya definidas de búsqueda exhaustiva.

**Códigos de error mínimos versionados**

`E-SYN-PARSE`, `E-SYN-PRECEDENCE`, `E-SYN-ALIAS`, `E-SYN-SYMBOL`, `E-RULE-UNKNOWN`, `E-RULE-FORBIDDEN`, `E-RULE-ARITY`, `E-RULE-SHAPE`, `E-RULE-MAINOP`, `E-REF-FORWARD`, `E-REF-CLOSED`, `E-REF-SUBPROOF-INCOMPLETE`, `E-REF-SUBPROOF-NESTED-CLOSED`, `E-STRUCT-AS-POSITION`, `E-STRUCT-PR-POSITION`, `E-STRUCT-OPEN-ASSUMPTION`, `E-STRUCT-CONCLUSION-DEPTH`, `E-SEM-UNSOUND-STEP`.

### 4.2 Piezas internas

- tokenizer;
- parser de fórmulas;
- AST de verificación normalizado de forma conservadora;
- normalizador de alias/notación para verificación;
- canonicalizador estructural de isomorfismo en módulo separado, inaccesible desde la ruta del verificador;
- parser de estructura Fitch;
- control de alcance;
- tabla de reglas versionada;
- verificación de citas;
- comprobación semántica independiente por tabla de verdad, SAT u otro método autorizado según tamaño y versión;
- procedimiento de decisión de derivabilidad opcional, separado del buscador heurístico y habilitado solo si está justificado para el cálculo exacto;
- etiquetado por KC;
- generación de traza.

### 4.3 Propiedades obligatorias

- determinista;
- función pura respecto de sus entradas;
- sin red;
- sin acceso al modelo;
- sin datos personales;
- reproducible por versión;
- capaz de ejecutarse en pruebas masivas.

### 4.4 Buscador de demostraciones

El buscador se usa en autoría, no en sesión.

Debe poder:

- encontrar una prueba válida dentro de un presupuesto explícito;
- devolver `proof_found`, `semantically_invalid` y `search_budget_exhausted`;
- devolver `no_proof_exists_in_calculus` **solo** si un decisor terminante separado ha demostrado no derivabilidad para la misma `authorizedCalculusVersion`;
- buscar en modo `heuristic` una prueba de bajo coste sin garantía de minimalidad;
- opcionalmente buscar en modo `exhaustive_k`, donde solo se permiten podas conservativas y se exploran exhaustivamente todos los costes inferiores al hallado;
- informar reglas necesarias en las soluciones encontradas;
- detectar metas triviales;
- generar múltiples estrategias cuando sea posible sin pretender enumerar exhaustivamente todas;
- calcular indicadores estructurales;
- detectar ciclos/repetición de metas y podarlos según una política versionada;
- producir un certificado verificable por `logic-core`.

El corte primario se expresa en trabajo reproducible —nodos, estados o inferencias— con orden de exploración y semilla fijados cuando aplique. Profundidad, coste, límite de nodos y penalizaciones heurísticas son parámetros de calibración medidos en L0 y congelados por versión. El timeout de pared protege el proceso, pero no se usa para afirmar propiedades lógicas y su activación queda registrada.

Si `exhaustive_k` encuentra una prueba de coste `L` después de haber agotado exhaustivamente todos los costes `< L`, puede marcar `minimalCostVerified = true` para esa métrica de coste. Si solo se agota la búsqueda hasta `k` sin encontrar prueba, la única afirmación permitida es `no_proof_with_cost_at_most_k`; no se infiere inexistencia global.

### 4.5 Conjunto dorado

Debe contener:

- derivaciones válidas representativas;
- errores sintácticos;
- reglas mal aplicadas;
- referencias fuera de alcance;
- descargas incorrectas;
- casos límite;
- variantes equivalentes;
- derivaciones válidas estructuralmente distintas para ejercitar aceptación de soluciones alternativas cuando existan;
- derivaciones válidas generadas por construcción mediante reglas autorizadas;
- contraejemplos generados por propiedades;
- regresiones de cada incidente real.

Puerta de salida: cero falsos positivos conocidos, cero falsos negativos conocidos sin resolver y todas las regresiones en verde. La cobertura de soluciones alternativas se reporta separadamente; no se fija un número universal por reactivo.

### 4.6 Property-based y mutation testing

El núcleo crítico del verificador se somete además a **property-based testing** y **mutation testing**. Como mínimo, las propiedades deben cubrir:

- `parse(print(ast))` conserva el AST de verificación;
- renombrar átomos biyectivamente no cambia el veredicto;
- una línea inaccesible por cierre de subprueba nunca puede citarse;
- toda derivación generada por construcción usando únicamente reglas autorizadas es aceptada;
- toda derivación aceptada preserva la consecuencia semántica bajo el oráculo independiente;
- dos ejecuciones con la misma entrada/versiones producen el mismo resultado y traza;
- `firstInvalidStep` señala el primer fallo real;
- los contraejemplos encontrados se promueven a regresiones del conjunto dorado.

No existe un `numRuns` universal. El perfil de PBT registra semillas, distribución efectiva de profundidad/conectivos/subpruebas y política de interrupción. Si se usa un límite temporal del runner, una interrupción incompleta no puede contarse silenciosamente como éxito; la configuración debe fallar o dejar evidencia explícita de que no se alcanzó el objetivo del perfil.

Mutation testing se ejecuta con **StrykerJS** sobre `logic-core` y rutas críticas equivalentes, no sobre todo el monorepo por defecto. Antes del freeze, cada mutante superviviente relevante debe quedar eliminado por una prueba adicional o justificado como equivalente/inaplicable. `thresholds.break`, si se usa, funciona como gate de no regresión respecto del baseline congelado; el mutation score no se interpreta como probabilidad de corrección ni como objetivo científico universal.

---

## 5. Pipeline autónomo de autoría

### 5.1 Máquina de estados del pipeline

```text
corpus_cargado
  → extraido
  → contrato_generado
  → mapa_generado
  → candidatos_generados
  → soluciones_encontradas
  → filtros_superados
  → auditoria_muestral_superada
  → paquete_candidato
  → congelado
```

Un artefacto no puede saltar estados.

### 5.2 Roles del workflow fuera de sesión

Los siguientes nombres describen funciones, no procesos independientes obligatorios.

#### Rol A — Extractor curricular

Entrada:

- fragmentos del corpus;
- esquema cerrado.

Salida:

- claims;
- definiciones;
- reglas;
- notación;
- restricciones;
- referencias exactas.

#### Rol B — Diseñador pedagógico

Salida:

- objetivos;
- secuencia;
- mapa de KC;
- dependencias;
- perfil pedagógico por KC/tipo de conocimiento;
- reglas de selección/transición de estrategia;
- política de ayudas y *fading*;
- plan de *retrieval/spacing* compatible con el calendario;
- plantillas.

#### Rol C — Generador de reactivos

Salida:

- enunciados estructurados;
- etiquetas KC;
- función del banco;
- complejidad objetivo;
- prohibiciones.

No genera la solución autoritativa.

#### Rol D — Generador de pistas

Salida:

- niveles de ayuda;
- propuesta estructurada `masteryDisqualifying` para auditoría de autoría; **no es autoritativa** y debe coincidir con el valor recalculado por la política determinista;
- explicación de por qué la pista no revela la solución cuando propone `masteryDisqualifying = false`;
- anclajes.

#### Rol E — Crítico

Evalúa:

- claridad;
- ambigüedad;
- correspondencia con objetivo;
- fuga;
- sobreajuste a ejemplos;
- consistencia de notación.

Antes de su veredicto, el crítico produce una **justificación estructurada** referida a criterios observables y evidencia disponible. Esa justificación es auditable, pero no se trata como certificado formal.

Su veredicto no certifica. Produce señales para los filtros. El acuerdo global entre generador y crítico no se usa por sí solo como indicador de calidad: el benchmark mide además la tasa de aprobación del crítico sobre candidatos que validadores deterministas o el conjunto dorado clasifican como defectuosos, estratificada por relación entre generador y crítico cuando corresponda.

Un mismo workflow puede ejecutar A–E secuencialmente sin crear agentes autónomos. A/B pueden compartir modelo con otros roles si el benchmark lo permite; **C/D (generación) y E (crítica generativa que participe en el gate) deben usar familias distintas**. Si por indisponibilidad temporal no puede cumplirse, el crítico se considera no independiente y su acuerdo no puede usarse como evidencia de calidad para congelar esa familia.
### 5.3 Validadores no generativos

- esquema de datos;
- cobertura de KC;
- proof search;
- verificador;
- oráculo semántico;
- detector de duplicados e isomorfismos entre reservas y contra ejercicios del corpus fuente;
- control de reservas, incluyendo prioridad reforzada de revisión cuando una familia acumule regeneraciones;
- detector de fuga textual;
- validador de anclajes;
- cálculo de complejidad;
- prueba de semillas;
- linter del paquete;
- linter de política pedagógica y transiciones permitidas;
- comprobación de separación `LEARNING_MODE`/`MEASUREMENT_MODE`;
- comprobación de que intentos con ayuda decisiva no satisfacen dominio sin reconfirmación;
- comprobación de proveniencia y hashes;
- clasificador NLI/entailment como **señal estadística auxiliar** con umbral calibrado;

### 5.4 Política de regeneración

Cuando falla un candidato:

- se registra la causa;
- no se repara manualmente de forma silenciosa;
- el agente recibe únicamente el código de fallo y restricciones seguras;
- se genera un nuevo candidato;
- se limita el número de intentos;
- una familia con tasa alta de rechazo queda bloqueada.

### 5.5 Linter de paquete

Comando:

```bash
profesor-ia content validate ./content/unidad-deduccion-natural
```

Debe comprobar:

- corpus íntegro;
- fragmentos referenciables;
- cálculo autorizado explícito, versionado, hasheado y con reglas/alias/política semántica-de decisión completas;
- correspondencia entre cada conjunto experimental y su `authorizedCalculusVersion`;
- mapa acíclico o ciclos justificados;
- cobertura mínima;
- bancos separados;
- soluciones para todo reactivo puntuable;
- sondas suficientes;
- pistas suficientes;
- rúbricas aplicables;
- catálogo y política pedagógica completos;
- reglas válidas de *scaffolding/fading*;
- plan de *retrieval/spacing* compatible con calendario y reservas;
- separación de modos de aprendizaje y medición;
- ausencia de duplicados/isomorfismos prohibidos entre reservas usando la canonicalización estructural separada;
- pruebas doradas aprobadas, incluidas pruebas de aceptación por construcción;
- auditoría muestral registrada;
- versiones completas.

### 5.6 Auditoría muestral automatizada

El sistema genera la muestra mediante semilla congelada y produce una bandeja para el auditor.

Para cada estrato persiste `N_h`, `n_h`, fracción, método, semilla, probabilidad de inclusión cuando sea calculable, riesgo/consecuencia, familia/origen y defectos por severidad. El pipeline puede sobremuestrear estratos de alto riesgo sin disminuir los pisos vigentes. Cuando se estime una tasa global con selección desproporcionada, se conservan los pesos/probabilidades necesarios y los gates por estrato siguen visibles.

La consola no permite escoger manualmente solo artefactos favorables.

### 5.7 Freeze

Comando:

```bash
profesor-ia experiment freeze --content ./content/unidad-deduccion-natural
```

Salida:

- manifiesto JSON;
- hashes;
- firma;
- inventario de artefactos;
- versiones de modelos;
- semillas;
- resultados de pruebas y manifiesto de validación del núcleo lógico;
- `authorizedCalculusVersion`, hash del cálculo, semántica de sanidad y autoridad/procedimiento de decisión habilitado por conjunto;
- presupuestos reproducibles del proof search, política de timeout y parámetros `k`/coste si existe modo exhaustivo;
- política de auditoría, codebook, plan de muestreo y análisis de capacidad de detección/OC cuando aplique;
- mapa de licencias por sección/componente, snapshots/hash W0 y artefacto de atribución en cadena;
- plan SCED preinscrito de estabilidad, aleatorización restringida, datos faltantes, exposición externa y análisis;
- hash/versión de la política pedagógica;
- reglas de elegibilidad para dominio y niveles de ayuda;
- configuración de `wheel_spinning`;
- configuración de BKT sombra si se habilita;
- `capabilityFlags` multimodales congeladas, como mínimo:
  - `voiceInput`;
  - `voiceOutput`;
  - `whiteboard`;
  - `visualBoardInterpretation`;
  - `uiAnnotations`;
  - `internalUiCapture`;
  - `externalScreenCapture`;
- proveedores/modelos y políticas de TTS, STT y visión cuando estén habilitados;
- identificador único de corrida.

---

## 6. Servicio de medición aislado

### 6.1 Responsabilidad

El `measurement-worker` ejecuta siempre `MEASUREMENT_MODE` para las medidas primarias y tiene **autoridad exclusiva dentro de ese modo** sobre:

- calendario de `probe_round` y sondas;
- reserva concreta, ítem/microbatería y selección desde reservas;
- semillas;
- bloqueo de reutilización y consumo atómico;
- modo sin asistencia;
- tiempo de aplicación de la sonda;
- registro de fase;
- reposición desde reserva cuando la regla lo permita;
- validez operacional de la oportunidad (`valid`/`invalid`/`missing` y reason code);
- retención.

El motor de sesión puede solicitar `experimentalSet`, fase y `measureKind` y decidir entrar/salir de `MEASUREMENT_MODE`, pero no puede inspeccionar el banco, escoger el ítem concreto, cambiar la semilla, extender el tiempo ni sobreescribir la validez operacional emitida por `measurement-worker`. La **validez inferencial final** pertenece a las reglas de incidentes/preinscripción y al análisis aprobado por `EXPERIMENT_AUDITOR`; no es la misma cosa que la validez operacional de una sonda.

### 6.2 Separación

El servicio de medición:

- no expone el banco al agente;
- entrega un solo reactivo a la vez dentro de la microbatería de la oportunidad; el agente nunca recibe la microbatería ni el banco;
- no incluye pistas;
- no permite retroalimentación durante la sonda;
- marca el reactivo como consumido atómicamente;
- registra la selección antes de mostrarla.

### 6.3 Contrato

```ts
type ProbeRequest = {
  runId: string;
  participantPseudoId: string;
  probeRoundId: string | null;          // null para transferencia/retención fuera de la serie SCED
  opportunityId: string;
  experimentalSet: string;
  phase: "baseline" | "intervention" | "retention";
  measureKind: "primary_probe" | "transfer_measurement" | "retention_probe";
};

type ProbeDelivery = {
  probeInstanceId: string;
  opportunityId: string;
  itemOrdinal: number;
  batchSize: number;
  prompt: StructuredItemPrompt;
  timeLimitSeconds: number;
  verifierContract: string;
};

type ProbeOpportunityResult = {
  opportunityId: string;
  probeRoundId: string | null;
  plannedItems: number;
  validScoredItems: number;
  correctValidItems: number;
  observation: number | null;
  operationalValidity: "valid" | "invalid" | "missing";
  reasonCode: string | null;
};
```

No se devuelve solución ni metadatos que permitan inferirla. `participantPseudoId` es el identificador de trabajo; `measurement-worker` no recibe identidad real. `transfer_measurement` solo selecciona de la reserva `TRANSFER_MEASUREMENT`; nunca reutiliza `TRANSFER_MASTERY`.

---

## 7. Motor de sesión

### 7.1 Estados

```text
preparada
→ autenticacion
→ consentimiento_confirmado
→ diagnostico
→ explicacion
→ comprobacion
→ practica
→ evaluacion_operativa
→ cierre
```

Propiedades transversales obligatorias del estado:

- `pedagogicalMode ∈ {LEARNING_MODE, MEASUREMENT_MODE}`;
- `selectedStrategy`;
- `assistanceLevel`;
- `masteryEligibility`;
- `wheelSpinning`;
- `masteryProbabilityShadow` solo si BKT sombra está habilitado.

Estados transversales:

- pausa;
- duda;
- recuperación;
- sonda;
- fallo_pedagógico;
- incidente;
- invalidación;
- retirada.

#### 7.1.1 Transiciones durante `MEASUREMENT_MODE`

- pausa solicitada **antes** de mostrar el reactivo: no consume reserva y la sonda no inicia;
- pausa/interrupción voluntaria **después** de mostrar el reactivo: el ítem queda consumido, la oportunidad se marca `invalid_participant_pause`, no se da feedback y una reposición posterior solo usa reserva independiente si el calendario lo permite;
- una duda de contenido durante la sonda no recibe respuesta pedagógica; el sistema puede responder únicamente sobre derechos/procedimiento. El reloj de la sonda no se amplía por la duda;
- vencimiento del tiempo de sonda produce el resultado definido por la rúbrica (`timeout`) sin ayuda adicional; vencimiento del tiempo máximo de sesión antes de completar una oportunidad la marca `missing_session_time` y consume cualquier ítem ya mostrado;
- incidente localizado invalida el acto conforme a la taxonomía y puede activar reposición; incidente sistémico suspende la corrida;
- retirada termina la sesión/corrida según el consentimiento; el ítem mostrado permanece consumido, el dato es faltante por `withdrawal` y no se repone contra la voluntad del participante.

### 7.2 Autoridad

El motor decide:

- transición de sesión y entrada/salida de modo;
- modo pedagógico;
- estrategia y nivel de ayuda en `LEARNING_MODE`;
- presupuesto/tiempo de bloques de enseñanza, no el tiempo interno de una sonda;
- selección de reservas de **aprendizaje**; en `MEASUREMENT_MODE` la selección pertenece exclusivamente a `measurement-worker`;
- dominio;
- recuperación;
- cierre;
- clasificación de fallo;
- validez pedagógica/operativa de actos de aprendizaje. La validez operacional de sondas la emite `measurement-worker` y la validez inferencial final se determina por el protocolo experimental.

El modelo propone únicamente:

- texto de explicación;
- reformulación;
- analogía;
- contenido lingüístico correspondiente a la estrategia seleccionada;
- preguntas de autoexplicación dentro de una plantilla permitida;
- clasificación dentro de enums permitidos;
- redacción de retroalimentación a partir de resultados estructurados.

No decide la estrategia, el modo pedagógico, la elegibilidad de un intento para dominio ni el nivel máximo de ayuda.

### 7.2.1 Política pedagógica determinista

`pedagogy-policy` recibe únicamente estado estructurado y señales autorizadas. La decisión se expresa como un contrato, por ejemplo:

```ts
type PedagogicalDecision = {
  mode: "LEARNING_MODE" | "MEASUREMENT_MODE";
  strategy:
    | "direct_explanation"
    | "worked_example"
    | "completion_problem"
    | "guided_practice"
    | "independent_practice"
    | "scaffolding"
    | "self_explanation"
    | "retrieval"
    | "prerequisite_remediation"
    | "near_transfer";
  assistanceLevel: number;
  masteryEligible: boolean;
  reasonCode: string;
};
```

La tabla concreta de transiciones se versiona y congela por corrida. No se codifica únicamente en prompts.

### 7.3 Política de dominio

Implementación literal de:

- tres correctas consecutivas elegibles para dominio;
- dificultad estructural no decreciente;
- una de transferencia cercana elegible para dominio;
- reconfirmación sin ayuda cuando el éxito previo usó ayuda decisiva;
- reinicio o ajuste según política preinscrita;
- registro de falso dominio posterior.

BKT sombra no participa en esta condición.

### 7.4 Recuperación

El motor controla:

- máximo de ciclos;
- cambio de representación;
- revisión de prerrequisito;
- consumo de reserva;
- cierre como no dominado;
- programación de recuperación;
- detección de `wheel_spinning` con umbral calibrable congelado;
- límites de ciclos y recuperaciones tratados como parámetros operativos versionados, no como óptimos científicos;
- cambio de estrategia dentro del catálogo permitido;
- declaración de límite tras agotamiento.

No existe endpoint `request_human_teacher` en la ruta pedagógica.

### 7.5 Dudas fuera de guion

Enums:

- `current_block`;
- `blocking_prerequisite`;
- `later_in_unit`;
- `outside_corpus`;
- `unsafe_or_disallowed`;
- `insufficient_anchor`.

El modelo puede proponer la categoría; el motor aplica la política.

---

## 8. Pasarela de modelo

### 8.1 Objetivo

Aislar al sistema de un proveedor específico mediante bindings fechados y contratos de capacidades.

Cada candidato externo se integra solo con:

- `model_binding` fechado;
- `ModelCapabilities` derivado de documentación oficial vigente;
- endpoint/model id exacto;
- parámetros soportados y rechazados;
- política de snapshot/alias/deprecación;
- región, logging, almacenamiento/retención y elegibilidad contractual cuando se conozcan;
- evidencia de reverificación inmediatamente antes del benchmark/freeze.

El gateway envía únicamente parámetros declarados compatibles por el binding y falla localmente ante parámetros desconocidos o no soportados. No existe un template universal de `temperature/top_p/top_k/reasoning` aplicable a todos los proveedores.

**Snapshot factual preimplementación 2026-08-13, no selección de ganador:** se verificaron como candidatos `gpt-5.6-sol`/alias `gpt-5.6`, `claude-sonnet-5`, Deepgram `flux-general-multi`, ElevenLabs `eleven_flash_v2_5`, y los STT OpenAI `gpt-4o-transcribe` / `gpt-4o-mini-transcribe`. El identificador `gpt-4o-mini-tts` aparece deprecado en el catálogo referido por la investigación de cierre y no se congela automáticamente como candidato futuro. Todo esto se refresca al benchmark/freeze.

### 8.2 Operaciones permitidas

```text
explain_block
rephrase_explanation
draft_worked_example
draft_completion_prompt
draft_self_explanation_prompt
classify_student_error
classify_question_scope
draft_feedback
create_authoring_candidate
critique_authoring_candidate
interpret_visual_context
```

Las operaciones de autoría y sesión usan perfiles y credenciales separadas.

La pasarela mantiene por binding una tabla declarativa `ModelCapabilities`, como mínimo con:

- parámetros de muestreo realmente aceptados;
- disponibilidad de snapshot fechado;
- modo/niveles de razonamiento soportados;
- structured outputs y límites aplicables;
- compatibilidades/incompatibilidades relevantes de herramientas/citas;
- región, retención y elegibilidad contractual aplicables cuando se conozcan;
- límites y códigos de fallo que cambien la forma de construir la petición.

La solicitud se deriva de esa tabla. CI debe impedir que una ruta envíe un parámetro no soportado por el modelo activo. No se conserva una plantilla universal de petición si el proveedor no la acepta.

### 8.3 Entrada de sesión

El constructor de contexto usa whitelist:

- fragmentos autorizados;
- estado mínimo;
- objetivo;
- modo pedagógico;
- estrategia seleccionada;
- nivel de ayuda permitido;
- error estructurado;
- pista seleccionada.

No consulta tablas de soluciones.

### 8.4 Salida estructurada

Ejemplo:

```ts
type AnchoredSegment = {
  text: string;
  anchors: string[];
  function: "definition" | "explanation" | "example" | "transition";
};
```

El validador rechaza:

- anchors inexistentes;
- texto que introduce símbolos no autorizados;
- instrucciones que contradicen el cálculo;
- solución o fragmentos canario;
- salida fuera de esquema.

Antes de validar semántica, los enums de proveedor se canonicalizan de forma determinista —incluida normalización de mayúsculas/minúsculas cuando el contrato lo autorice— y se conserva el valor bruto para auditoría. Los resultados se clasifican separadamente como `valid`, `schema_violation`, `truncated`, `refusal`, `provider_error` u otra causa versionada; no se ocultan truncamientos o rechazos dentro de “fallo de esquema”.

La salida estructurada del proveedor **no es evidencia suficiente de validez**: toda respuesta cruza un validador local independiente y el flujo falla cerrado ante schema inválido, truncamiento, rechazo ambiguo o contrato desconocido. CI ejecuta *contract tests* equivalentes sobre cada adaptador para comprobar que una misma operación conserva invariantes de entrada/salida aunque cambien las peculiaridades del proveedor.

Batch y caching son capacidades explícitas de `ModelCapabilities`, no optimizaciones transparentes. Batch solo se usa cuando la clasificación de datos de la operación lo permite; el tráfico de sesión con datos del participante no se enruta a una modalidad cuya retención o elegibilidad contractual contradiga el freeze. Hits/misses, TTL cuando se conozca, tokens cacheados y costo se registran en el `cost-ledger`.

### 8.5 Benchmark de modelo

Antes de elegir proveedor, ejecutar un conjunto fijo de pruebas:

- fidelidad al corpus;
- seguimiento de esquema;
- calidad de reformulación;
- clasificación de error;
- resistencia a extracción;
- no revelación;
- latencia;
- estabilidad;
- costo por sesión;
- comportamiento en español.

No se selecciona un modelo únicamente por reputación o tamaño.

El benchmark usa una partición **desarrollo/evaluación** fijada por semilla. Desarrollo permite iterar prompts, `max_tokens`, nivel de razonamiento y validadores; evaluación se ejecuta únicamente después de congelar la configuración candidata. Si se ajusta la configuración tras mirar evaluación, esos ítems dejan de ser válidos como evaluación y deben sustituirse.

Se ejecutan repeticiones predefinidas para estimar **estabilidad estadística** y se reportan denominadores e intervalos apropiados. El cambio de modelo se decide por **equivalencia funcional respecto de gates y márgenes preinscritos**, no por exigir tokens idénticos. En latencia se separa la primera compilación/calentamiento de schema cuando el proveedor la tenga.

El modelo de autoría/crítica usa un benchmark propio, distinto del de sesión. Para el crítico se mide concordancia con auditoría y sensibilidad a defectos críticos, además de una prueba de error correlacionado con artefactos defectuosos conocidos.

### 8.6 Modo degradado

Debe existir un perfil sin generación en vivo que use:

- explicaciones base congeladas;
- ejemplos congelados;
- pistas congeladas;
- retroalimentación plantillada.

Sirve para:

- pruebas secas;
- continuidad ante caída;
- comparación técnica;
- aislar si el fallo proviene del modelo o del núcleo.

---

## 9. Bitácora y modelo de datos

### 9.1 Evento mínimo

```ts
type EvidenceEvent = {
  schemaVersion: string;
  eventId: string;
  sequenceNumber: number;
  streamId?: string;
  correlationId: string;
  causedByEventId?: string;
  artifactRefs?: string[];
  traceId?: string;
  runId: string;
  participantPseudoId: string;
  sessionId: string;
  eventType: string;
  payload: Record<string, unknown> | { artifactRef: string; artifactHash?: string };
  decisionMaker: "engine" | "verifier" | "model" | "human" | "system";
  autonomyStatus: "autonomous" | "automatic-control" | "human-exception" | "failed";
  versions: VersionManifest;
  occurredAt: string;
  occurredAtServer?: string;
  correctionOfEventId?: string;
  previousHash: string;
  hash: string;
  validity: "valid" | "invalid" | "deviation";
};
```

`participantPseudoId` nunca contiene identidad real. El payload del ledger es estructurado y minimizado; cuando una respuesta libre, transcripción, audio, imagen u otro contenido potencialmente identificable deba conservarse, se almacena en un artefacto **suprimible** fuera de la cadena append-only y el evento guarda únicamente la referencia y, cuando proceda, su hash. Un hash o un seudónimo no se presentan como anonimización.

### 9.2 Esquemas de base de datos

Se mantienen exactamente siete esquemas:

- `identity`: cuentas y vínculo;
- `pedagogy`: estado, contenido público del paquete, política pedagógica versionada, intentos/ayudas, señales de `wheel_spinning`, métricas sombra no autoritativas y proyección de proveniencia curricular (`source`, `fragment`, `claim`, `curricular_decision`, `artifact`, `anchor`);
- `evidence`: eventos append-only y registro de qué actividad/artefacto fue mostrado;
- `private_solutions`: soluciones y claves;
- `measurement`: sondas, semillas y consumo;
- `audit`: juicios humanos cegados, codebook/versiones, metadatos de muestra, juicio inicial bloqueado, adjudicación, causa raíz y trazabilidad de regeneración;
- `operations`: jobs, estado de W0/H4.5/H5, logs operativos y tareas.

No se crea un octavo esquema solo para proveniencia.

Cada servicio usa credenciales de mínimo privilegio diferentes.
### 9.3 Evidencia multimodal

No se crea una telemetría experimental paralela. Voz, pizarrón, percepción y anotaciones se registran en el `evidence-ledger` existente mediante eventos semánticos y referencias a artefactos.

Familias mínimas:

- `speech.capture.started`, `stt.committed`, `speech.capture.stopped`;
- `tts.requested`, `tts.started`, `tts.completed`, `tts.interrupted`, `tts.failed`;
- `board.element.created`, `board.element.updated`, `board.element.deleted`, `board.scene.snapshot`;
- `visual.capture.created`, `visual.analysis.requested`, `visual.analysis.completed`;
- `annotation.proposed`, `annotation.resolved`, `annotation.rendered`, `annotation.cleared`;
- `stt.transcript.corrected`, `visual.interpretation.corrected`.

Los parciales de STT y movimientos intermedios de puntero pueden quedar únicamente en logs operacionales durante desarrollo si no influyen en decisiones. Capturas y audio, cuando se conserven, se almacenan como artefactos con hash y metadatos; los eventos los referencian por ID.

La reproducibilidad multimodal significa poder reconstruir qué estado, captura, versión, prompt/política, modelo y salida observada produjeron una decisión; no exigir que una API generativa reproduzca idénticos tokens o audio en una llamada futura.

### 9.4 Proyecciones

Las vistas de estado se reconstruyen desde eventos:

- sesión actual;
- dominio;
- cobertura;
- estrategia pedagógica y nivel de ayuda;
- elegibilidad de intentos para dominio;
- `wheel_spinning`;
- BKT sombra y calibración si está habilitado;
- intervención humana;
- carga;
- incidentes;
- resultados experimentales;
- métricas de producto, si algún día se habilitan, en una **proyección físicamente/lógicamente separada** que no alimenta al motor pedagógico, al contexto del agente ni al análisis primario.

### 9.5 Ledger de costos y manifiesto de tarifas

El costo no se reconstruye a partir de precios actuales ni de estimaciones globales. `operations` mantiene un `pricing-manifest` versionado por proveedor/modelo y un `cost-ledger` por llamada u operación. Como mínimo se registran:

- etapa y tipo de operación;
- proveedor y `model_binding`;
- `pricing_manifest_id`;
- tokens de entrada, caché/escritura de caché y salida cuando el proveedor los exponga;
- uso de audio/imagen u otras unidades facturables;
- número de intentos, reintentos y fallos;
- latencia local y del proveedor por separado;
- costo calculado y uso reportado por el proveedor;
- `course_id`, `kc_id` y `session_id` seudónimos cuando sean necesarios para atribución.

El manifiesto conserva las tarifas y reglas de facturación usadas en esa fecha. Cualquier cambio de precio crea una nueva versión; nunca reescribe el costo histórico. Los costos de reintentos y fallos cuentan como costo real de autonomía.

Las métricas de producto —retención de usuarios, conversión, adquisición o equivalentes futuros— se mantienen fuera de las proyecciones experimentales primarias y no pueden alimentar decisiones pedagógicas ni el análisis causal de Etapa 1.

### 9.6 Corrección

Una corrección genera:

- evento de detección;
- evento de clasificación;
- evento de invalidación;
- evento de reposición;
- evento de resolución.

El original permanece.

---

## 10. Consolas e interfaces

### 10.1 Interfaz del alumno

Debe mostrar:

- identidad del Profesor IA;
- plan y bloque;
- conversación textual;
- controles de micrófono/transcripción cuando `voiceInput` esté activo;
- reproducción/interrupción de voz del Profesor IA cuando `voiceOutput` esté activo;
- editor Fitch;
- pizarrón libre cuando `whiteboard` esté activo;
- capa visual de señalamiento/anotaciones;
- pistas disponibles;
- pausa;
- progreso operativo;
- aviso de modo sonda;
- apelación;
- retirada;
- reporte final.

No debe mostrar:

- solución;
- etiquetas experimentales innecesarias;
- decisiones del auditor;
- bancos futuros;
- datos técnicos que faciliten extracción.

### 10.2 Consola de auditoría

Funciones:

- muestra preseleccionada;
- censo de resultados críticos;
- cegamiento del veredicto del sistema y metadatos no necesarios en primera pasada;
- bloqueo inmutable del juicio inicial antes de descegar;
- clasificación de defecto con codebook versionado;
- registro de `N_h`, `n_h`, semilla, inclusión y riesgo por estrato;
- registro de tiempo de revisión;
- segunda evaluación preinscrita cuando aplique;
- adjudicación y causa raíz sin sobrescribir juicios originales;
- exportación.

No incluye un modo de intervención pedagógica en vivo.

### 10.3 Consola técnica

- salud de servicios;
- coincidencia de manifiesto;
- colas;
- respaldo;
- incidentes;
- versiones;
- métricas de latencia;
- consumo del proveedor;
- estado TTS/STT/visión y sus latencias;
- `capabilityFlags` de la corrida;
- estado de canarios.

### 10.4 Panel de autonomía

Debe mostrar por función:

- decisiones autónomas;
- controles automáticos;
- fallos;
- excepciones humanas;
- tiempo humano;
- tendencias por sesión.

---

### 10.5 Forma de entrega y diseño visual — DIFERIDA A PRODUCTO

La arquitectura de frontend sí está cerrada en **Next.js + React**, pero todavía no se congela si el usuario la recibirá finalmente como:

- aplicación web;
- aplicación local en `localhost`;
- PWA;
- aplicación de escritorio empaquetada.

Para la primera prueba se recomienda **interfaz web local con apariencia de aplicación**, porque reutiliza exactamente el frontend definitivo y evita añadir un empaquetador antes de validar la experiencia.

Cuando se diseñe la interfaz se definirá por separado:

- lenguaje visual;
- navegación;
- dashboard principal;
- vista de alumno;
- área de investigación/autoría;
- consola de administración;
- consola técnica;
- consola de auditoría;
- estados vacíos, carga, errores y sesiones;
- componentes reutilizables;
- accesibilidad y responsive design.

La decisión Tauri/Electron/PWA no se toma hasta tener una interfaz estable.

**Línea base de accesibilidad exigible desde H8, sin congelar el lenguaje visual definitivo:**

- editor Fitch y controles críticos —micrófono, pistas, pausa, apelación y retirada— operables por teclado;
- foco visible y no oscurecido; ausencia de trampas de teclado;
- alternativa a gestos de arrastre cuando el control crítico la requiera, con excepción documentada si una acción del pizarrón es esencial;
- objetivos interactivos compatibles con WCAG 2.2 SC 2.5.8 o alternativa permitida por el criterio;
- overlay SVG no interactivo para tecnología asistiva (`aria-hidden`/sin captura de eventos) y equivalente textual de la anotación;
- representación DOM navegable de la escena estructurada del pizarrón;
- notación lógica expuesta semánticamente —preferentemente MathML con capa de compatibilidad cuando sea necesaria—;
- registro de ayudas técnicas/configuraciones relevantes del participante para separar barreras de interfaz de errores de contenido.

El proyecto **no declara conformidad WCAG 2.2 AA global** sin una auditoría criterio por criterio. H8 registra criterios verificados, no verificados y excepciones conocidas.


### 10.6 Arquitectura funcional UX/UI pre-Plan

La estética final, marca, paleta y empaquetado siguen abiertos al artefacto de diseño; sin embargo, `Plan.md` debe recibir una **arquitectura funcional mínima** para que el agente no invente la experiencia de usuario. Las vistas mínimas son:

- **Inicio / Dashboard** — curso activo, continuar clase, estado de progreso, próximos repasos y accesos rápidos;
- **Mis materias** — biblioteca persistente de `VALIDATED_LOGIC_COURSE` y `CUSTOM_COURSE_UNVALIDATED`;
- **Crear materia** — captura del sobre mínimo, estado de investigación/preparación y revisión del curso generado;
- **Detalle de materia** — estructura, progreso, historial, dificultades, próxima actividad y `Continuar clase`;
- **Clase** — profesor conversacional + texto/voz + área de trabajo (Fitch/pizarrón/material) + controles de pista, pausa, apelación y sesión;
- **Progreso** — vista comprensible para el alumno: dominado/en aprendizaje/pendiente, fortalezas, dificultades, historial, retención y próximos repasos;
- **Investigación** — transparencia de autoría: fuentes, aceptaciones/rechazos, mapa de KC/conceptos, objetivos, versiones, benchmarks, costos e incidentes, sin convertir JSON crudo en interfaz principal;
- **Configuración** — proveedores/conexiones, voz, micrófono, accesibilidad, privacidad, almacenamiento, presupuesto y opciones avanzadas;
- **Consolas técnicas/auditoría** — permanecen separadas de la experiencia normal del alumno y conservan los privilegios ya definidos.

Flujo funcional principal:

```text
Inicio
  → Mis materias
      → abrir materia
          → Continuar clase
              → sesión
                  → cierre/guardado
                      → progreso / siguiente sesión

Inicio
  → Crear materia
      → definir qué aprender
          → investigación y preparación
              → propuesta de curso
                  → crear materia
                      → iniciar/continuar clase
```

La primera ejecución incluye familiarización por suficiencia observable, no por temporizador fijo. El diseño debe permitir que la experiencia de clase se concentre en aprender y no exponga métricas experimentales avanzadas salvo en Investigación/Auditoría.

**Entrada UX/UI recibida:** `Profesor IA — Especificación UI/UX v0.1` queda reconocida como artefacto subordinado conforme a §0.1.12. `Plan.md` puede consumir sus decisiones visuales conformadas, pero ninguna propuesta, dato ilustrativo o elemento de interfaz puede modificar autoridad, modos, privacidad, medición, freezes o gates definidos por este Maestro.

## 11. Seguridad y privacidad

### 11.1 Autenticación

- cuenta seudónima;
- passkey o contraseña robusta;
- MFA administrativo;
- sesiones seguras;
- recuperación separada.

### 11.2 Control de acceso

Roles mínimos:

- alumno;
- auditor;
- responsable técnico;
- responsable de datos;
- investigador.

El auditor no necesita acceso a identidad real. El técnico no necesita contenido de auditoría no adjudicado.

Para PostgreSQL se congela una matriz ejecutable **servicio → esquema → tabla → operación**. Existe un rol propietario/migración separado del uso ordinario. Las credenciales runtime:

- no son `SUPERUSER`, owner de tablas sensibles ni `BYPASSRLS`;
- no heredan ni pueden `SET ROLE` hacia roles más privilegiados;
- reciben solo `GRANT` explícitos necesarios y `PUBLIC` se revoca donde corresponda;
- no obtienen acceso a `private_solutions` o `measurement` por confiar en RLS.

RLS puede usarse como segunda capa para separar filas de participantes/sesiones, pero las pruebas deben cubrir owner, `BYPASSRLS`, membresías y `FORCE ROW LEVEL SECURITY` cuando aplique.

### 11.3 Canarios

Insertar cadenas canario en:

- soluciones;
- sondas futuras;
- claves.

Si una cadena aparece en contexto o salida del modelo:

- abortar;
- registrar incidente;
- bloquear la corrida;
- investigar la ruta.

Cada canario registra `canary_id`, clase de activo, ubicación, freeze/versión, detector y procedimiento de incidente. Los detectores observan, según aplique, contexto construido, payload saliente al proveedor, salida del modelo, logs/trazas y exportes. La cantidad, patrón y rotación de canarios se calibran; el gate sigue siendo cero hits protegidos observados.

### 11.4 Respaldo y restauración

Política normativa:

- ninguna transición irreversible —puntuación formal, dominio, consumo de reserva, cambio de fase, COMMIT de sonda, consentimiento/retiro o invalidación— se considera realizada hasta que su transacción autoritativa y el evento correspondiente hayan quedado confirmados duraderamente;
- por protocolo, el objetivo de **pérdida aceptable de una transición ya confirmada es `0`**. Esto es un objetivo lógico/transaccional, no una afirmación de que cualquier host tenga RPO físico cero ante toda clase de desastre;
- se crea checkpoint verificable como mínimo al cerrar el freeze, antes de cada sesión con participante, después de cada sesión, antes de una migración que pueda afectar datos autoritativos y después de una recuperación/incidente;
- existe al menos una copia de respaldo cifrada separada del almacenamiento de trabajo;
- una sesión no comienza ni se reanuda tras incidente hasta que la restauración verifique manifiesto, ledger, proyecciones, permisos y consistencia de reservas.

El restore drill se ejecuta en entorno limpio y verifica coincidencia con freeze manifest, cadena/checkpoints del ledger, correcciones/invalidaciones, reconstrucción de proyecciones, roles/grants y ausencia de montajes prohibidos.

**CALIBRABLE H10:** tiempo real de restauración/RTO observado, throughput de backup, recursos necesarios, comportamiento bajo fallo, frecuencia/rotación final de respaldos y límites efectivos del entorno. Esos valores se miden; no se escriben ahora como resultados.

### 11.5 Proveedores externos

Si se usa API o infraestructura externa:

- enviar solo datos mínimos y seudonimizados;
- registrar proveedor, producto, endpoint, región, cuenta/plan y `model_binding`/versión;
- clasificar jurídicamente el flujo antes del freeze como remisión a encargado o transferencia a tercero;
- archivar instrumento contractual/DPA, subencargados, política de entrenamiento, logging, almacenamiento, retención, borrado y funciones opcionales que cambien el tratamiento;
- evitar logging con contenido sensible cuando sea configurable;
- no prometer una retención/supresión que dependa de condiciones que el responsable no controla;
- verificar Batch, caching, Files u otras funciones con almacenamiento antes de enrutar datos del participante.

Ningún proveedor se considera `ZDR=true`, sin logging o con una retención concreta por el solo hecho de ofrecer esa capacidad comercialmente. H9 registra por **binding y cuenta reales**: endpoint, modalidad de almacenamiento, configuración ZDR/MAM/ZRM si aplica, retención estándar y excepciones, logging, mecanismo de borrado, región y evidencia contractual/documental fechada. Una capacidad disponible pero no habilitada se registra `AVAILABLE_NOT_ENABLED`.

El inventario técnico de políticas no resuelve LEG-01/LEG-02. Rol jurídico del proveedor, DPA, subencargados, transferencia/remisión, armonización legal y obligaciones concretas permanecen bajo revisión profesional antes de H11.

### 11.5.1 Threat model y hardening mínimo

Antes del participante real existe un DFD con trust boundaries y un threat model versionado que cubre, como mínimo: alumno adversarial, corpus hostil, atacante web, credencial/proceso comprometido, insider funcional, supply-chain, proveedor externo y administrador del host. STRIDE/OWASP pueden usarse como catálogos de comprobación, pero no se declara “cumplimiento” de un marco por adoptar controles parciales.

Donde el entorno lo soporte sin romper funcionalidad, los procesos/contenedores usan usuario no-root, `no-new-privileges`, capabilities mínimas, seccomp no desactivado sin justificación, filesystem read-only salvo rutas explícitas, secretos por servicio y egress por función. El socket de Docker no se monta en servicios de aplicación. `solutions-private` y reservas solo se montan en procesos normativamente autorizados.

### 11.6 Audio, capturas y percepción visual

- El permiso de micrófono es explícito y revocable.
- La interfaz muestra un indicador inequívoco mientras el micrófono o una captura estén activos y H9 instruye al participante a evitar terceros/entornos compartidos cuando pueda capturarse información ajena.
- El audio bruto del alumno está desactivado por defecto; conservarlo exige finalidad documentada, consentimiento y calendario de borrado.
- Para TTS puede conservarse el audio realmente emitido o su artefacto/hash cuando sea necesario reconstruir qué escuchó el alumno.
- Las capturas internas excluyen por defecto secretos, identidad innecesaria, overlays del Profesor IA y componentes no relevantes; frames/artefactos no anclados a un evento necesario se descartan según la política congelada.
- `getDisplayMedia`/captura externa requiere acción explícita del alumno y no puede mantenerse habilitada silenciosamente.
- Proveedor, región, retención y configuración de TTS/STT/visión se verifican nuevamente en cada freeze formal.
- Si texto/voz contiene datos personales sensibles o de terceros **no necesarios para la finalidad**, el sistema no los convierte automáticamente en evidencia persistente: aplica la ruta de minimización/redacción/supresión definida en H9 y registra solo lo mínimo necesario para justificar la acción.

---

## 12. Workflows completos

### W0 — Investigación y selección de fuentes

1. recibir materia, subunidad, límites y políticas;
2. descubrir candidatos;
3. registrar origen, versión y licencia;
4. evaluar idoneidad;
5. comparar claims y clasificar conflictos;
6. medir cobertura;
7. aplicar criterio calibrado de saturación;
8. generar propuesta de corpus;
9. solicitar autorización externa;
10. si se autoriza, entregar fuentes autorizadas a W1;
11. si se rechaza por alcance/seguridad/legalidad/gobernanza, registrar `rejection_reason_code` y volver a investigación/comparación sin reescritura pedagógica humana;
12. si la regla de saturación demuestra que no quedan candidatos autorizables dentro del sobre permitido, cerrar H4.5 como `failed_no_authorizable_corpus`.

W0 puede usar Internet. W1 en adelante trabaja con entradas autorizadas y versionadas.

### W1 — Ingesta del corpus

1. cargar archivos;
2. calcular hashes;
3. registrar licencia y origen;
4. fragmentar con IDs estables;
5. validar legibilidad;
6. bloquear modificación por el pipeline.

### W2 — Extracción y mapa

1. agentes extraen reglas y definiciones;
2. linter verifica anclajes;
3. se construye grafo;
4. se detectan ciclos;
5. se eligen conjuntos experimentales;
6. se registra justificación.

### W3 — Autoría automática

1. generar candidatos;
2. ejecutar el pipeline determinista de validez según el orden congelado; la preferencia inicial a benchmarkear es `prefiltro semántico → proof search`;
3. ejecutar *proof search* solo sobre candidatos que sigan siendo elegibles y registrar `proof_found` o `search_budget_exhausted`;
4. verificar la solución/certificado con `logic-core`;
5. calcular complejidad estructural sin intentar enumerar exhaustivamente todos los caminos;
6. comprobar duplicados e isomorfismos sobre representación normalizada;
7. generar pistas;
8. criticar;
9. filtrar;
10. separar reservas.

### W4 — Auditoría previa

1. crear muestra por semilla;
2. ocultar decisiones internas cuando corresponda;
3. revisar;
4. calcular defectos;
5. aceptar paquete candidato o regenerar familias.

### W5 — Freeze

1. ejecutar todas las pruebas;
2. firmar manifiesto;
3. publicar paquete;
4. bloquear escritura;
5. provisionar servicios con permisos mínimos.

### W6 — Inicio de sesión

1. autenticar;
2. confirmar consentimiento;
3. comparar manifiesto;
4. verificar salud;
5. recuperar estado;
6. iniciar diagnóstico.

### W7 — Enseñanza

1. motor elige bloque y fija `LEARNING_MODE`;
2. `pedagogy-policy` selecciona estrategia y nivel de ayuda;
3. recuperador entrega fragmentos y artefactos autorizados;
4. modelo ejecuta lingüísticamente la estrategia seleccionada;
5. validador revisa salida, anclaje y no revelación;
6. alumno responde;
7. verificador/motor clasifican resultado, ayuda utilizada y elegibilidad para dominio;
8. motor ajusta estrategia/andamiaje según política congelada;
9. se registra cada evento.

### W8 — Actividad formal

1. seleccionar reactivo correcto;
2. mostrar rúbrica;
3. alumno entrega;
4. verificador decide;
5. motor determina si el intento es elegible y actualiza dominio;
6. modelo redacta retroalimentación desde salida estructurada y estrategia seleccionada;
7. filtro de egreso;
8. evidencia.

### W9 — Sonda

1. calendario de `measurement-worker` abre la `probe_round` y activa `MEASUREMENT_MODE` mediante el motor;
2. desactivar agente pedagógico y pistas;
3. `measurement-worker` selecciona y registra la microbatería/reserva antes de mostrarla;
4. cada ítem queda consumido al mostrarse;
5. alumno responde sin ayuda; dudas de contenido no reciben respuesta pedagógica;
6. verificador corrige cada respuesta formal;
7. `measurement-worker` decide validez operacional de la oportunidad y de la ronda según `k_set`/`min_valid_items_per_opportunity` y reason codes;
8. no dar retroalimentación inmediata;
9. registrar observación primaria únicamente si la ronda es válida para el calendario SCED;
10. pausa, fin de sesión, incidente o retirada siguen §7.1.1; ninguna reposición reutiliza el ítem consumido.

### W10 — Límite pedagógico

1. detectar estancamiento/`wheel_spinning` cuando corresponda;
2. agotar estrategias y ciclos de recuperación permitidos;
3. marcar no dominio;
4. guardar causa;
5. programar recuperación si existe;
6. al agotar recuperaciones, declarar límite;
7. no llamar a docente.

### W11 — Incidente

1. detectar;
2. clasificar severidad, alcance y activos afectados;
3. contener sin destruir evidencia;
4. preservar ledger, logs, manifest, payloads relevantes y hashes/checkpoints;
5. determinar si la validez se conserva, se invalida localmente o se invalida sistémicamente;
6. notificar al responsable apropiado según el protocolo;
7. recuperar desde estado/backup confiable cuando corresponda;
8. corregir únicamente en una nueva versión;
9. añadir una prueba de regresión que falle en la versión vulnerable y pase en la corregida.

### W12 — Auditoría posterior

1. formar censo crítico y muestra;
2. cegar;
3. revisar;
4. comparar;
5. adjudicar;
6. medir tiempo humano;
7. publicar métricas.

### W13 — Análisis

1. exportar datos seudonimizados;
2. verificar integridad;
3. regenerar gráficas;
4. analizar fases;
5. emitir cuatro veredictos;
6. registrar limitaciones.

---

## 13. Secuencia de implementación

### H0 — Repositorio, contratos y CI

- monorepo;
- repo de contenido;
- contratos;
- dependency-cruiser;
- Testcontainers;
- lockfile reproducible;
- generación de SBOM/inventario exacto desde el árbol instalado;
- verificación de licencias/advisories y drift;
- manifiesto técnico inicial.

**Puerta:** arquitectura mínima en verde. Una familia de versión escrita en el Maestro no sustituye el lockfile/SBOM; EXT-01 solo se cierra para un freeze concreto cuando existe el árbol real y su evidencia de licencia/advisories.

### H1 — Base de datos, roles y autenticación mínima

- siete esquemas;
- matriz ejecutable de grants/revokes por credencial runtime;
- owner/migración separado de runtime;
- runtime sin `SUPERUSER`, owner sensible, `BYPASSRLS` ni escalamiento por `SET ROLE`;
- `evidence` append-only con `UPDATE`/`DELETE` denegados a runtime;
- auth suficiente para desarrollo;
- suite SQL negativa de accesos prohibidos.

**Puerta:** sesión/model-gateway sin acceso a soluciones; enseñanza sin acceso a sondas futuras; cero `UPDATE`/`DELETE` de evidencia con credenciales runtime y todas las pruebas negativas críticas en verde.

### H2 — Verificador y proof search

- implementar `authorized-calculus-v1` exactamente como §4.1.1;
- parser/AST conservador y control Fitch;
- semántica independiente clásica bivalente con `v(⊥)=F`;
- buscador heurístico con presupuesto reproducible;
- `no_proof_exists_in_calculus` deshabilitado salvo que CALC-03 demuestre la ruta terminante aplicable;
- canonicalización de isomorfismo separada de la ruta del verificador;
- conjunto dorado, generación válida por construcción, PBT y StrykerJS;
- códigos de error y lexicón canónico versionados.

**Puerta:** implementación demuestra correspondencia con `authorized-calculus-v1`; cero falsos positivos conocidos y cero falsos negativos conocidos sin resolver en el conjunto vigente; ninguna discrepancia semántica abierta; ningún mutante crítico superviviente sin justificación. El cálculo ya no es un pendiente de especificación; permanecen `CALC-03`, `CALC-05`, `CAL-04` y `CAL-08` como validaciones/calibraciones de H2.

### H3 — Entorno local reproducible

- Docker Compose en la PC;
- PostgreSQL local;
- almacenamiento local;
- logs locales;
- scripts de arranque y restauración de desarrollo.

**Puerta:** el sistema se levanta desde cero en la computadora sin servicios de hosting.

H3 verifica además el hardening que el SO permita: usuario no-root/rootless cuando sea viable, seccomp, `no-new-privileges`, capabilities, filesystem/montajes, secretos y egress. La imposibilidad técnica de rootless en el entorno concreto se documenta; no autoriza relajar las demás fronteras.

### H4 — Pasarela de modelo y benchmark

- adaptadores y `ModelCapabilities` por binding;
- perfiles `SESION` / `AUTORIA`;
- validación local fail-closed y contract tests;
- structured outputs y clasificación de truncamiento/rechazo/schema/provider error;
- registro de tokens, latencia, retries y costo real mediante `pricing-manifest`/`cost-ledger`;
- matriz de elegibilidad de Batch/caching según datos;
- canarios;
- refresco documental de ids/endpoints/parámetros/deprecaciones inmediatamente antes del benchmark;
- benchmark desarrollo/evaluación con semilla, repeticiones, incertidumbre y `model_binding`/huella;
- benchmark separado de autoría/crítica y prueba de error correlacionado.

**Puerta:** al menos una configuración supera los gates preinscritos sobre evaluación no contaminada y el manifest declara el nivel de reproducibilidad. Los nombres verificados el 2026-08-13 son candidatos; BENCH-01/02 decide ganadores y ninguna cifra de latencia/costo se anticipa.

### H4.5 — Investigación y curación de fuentes

- W0;
- repositorios autorizados;
- registro de licencias;
- source suitability;
- cobertura/saturación;
- conflictos;
- propuesta de corpus.

**Puerta:** corpus candidato trazable y autorizable sin autoría docente.

### H5 — Ingesta, construcción curricular y autoría

- W1–W5;
- hashes;
- fragmentos;
- claims;
- mapa KC;
- objetivos;
- `item_family_id` y firmas estructurales;
- bancos, incluida capacidad de reconfirmación post-dominio;
- `k_set` y `min_valid_items_per_opportunity` del SCED;
- CAL-09: pesos iniciales de complejidad y criterio de comparabilidad;
- pistas y `masteryDisqualifying` recalculado;
- soluciones;
- validadores;
- auditoría muestral;
- freeze.

**Puerta:** paquete congelado completo sin autoría reactivo por reactivo; no se abre H6 si CAL-09, la definición de oportunidades SCED o la cobertura de reservas requerida siguen sin fijarse.

### H6 — Sesión determinista sin LLM

- interfaz;
- motor;
- dominio;
- recuperación;
- política pedagógica determinista;
- modos `LEARNING_MODE`/`MEASUREMENT_MODE`;
- sondas;
- bitácora;
- modo guion.

**Puerta:** sesión seca completa reconstruible.

### H7 — Profesor IA de sesión

- integración del modelo ganador;
- anclaje;
- filtros;
- recuperación;
- ejecución de estrategias seleccionadas por `pedagogy-policy`;
- autoexplicación, ejemplos trabajados y *fading* contingente;
- adaptación;
- modo degradado.

**Puerta:** pruebas adversariales y sesión local completa sin rescate docente.

### H8 — Prueba funcional local multimodal del desarrollador

El desarrollador usa el sistema de extremo a extremo en su propia computadora. Esta es la primera fase en la que deben probarse juntas las capacidades de voz y pizarrón.

Objetivo:

- descubrir bugs;
- evaluar UX;
- medir costo real de APIs;
- comprobar que el curso se construye y puede enseñarse;
- clasificar fallos de autonomía;
- validar `speech-gateway`;
- comparar candidatos TTS/STT con español y vocabulario real del curso;
- probar Excalidraw y el `whiteboard-adapter`;
- probar overlay SVG y targets semánticos;
- medir interpretación de manuscrito/dibujo con perfil visual;
- verificar replay de eventos multimodales;
- comprobar que errores de STT/visión se clasifican como fallos de percepción/interfaz y no como errores conceptuales del alumno.
- benchmarkear STT por tarea además de WER/CER, incluida tasa de decisión errónea atribuible a la transcripción;
- validar el lexicón de verbalización TTS por reconstrucción exacta de fórmulas;
- calibrar política visual de observación/confirmación/abstención sobre conjunto dorado;
- ejecutar la línea base de accesibilidad y documentar criterios/excepciones;
- probar revisiones/caducidad de anotaciones y transformaciones de coordenadas;
- verificar que una interpretación visual nunca puede escribir un veredicto formal;
- registrar por servicio CPU media/p95/máximo, RSS, memoria del host, I/O, espacio libre y crecimiento de disco;
- registrar conexiones PostgreSQL, queries lentas, profundidad/edad de jobs y latencia end-to-end;
- separar latencia local de latencia de cada proveedor;
- alimentar `pricing-manifest`/`cost-ledger` con uso real, retries, fallos y costos;
- usar esta telemetría para fijar después —no antes— límites de Compose y, si se activa H1 remoto, dimensionar el VPS más pequeño que reproduzca la carga observada con margen operacional documentado.

Configuración inicial recomendada:

- `voiceInput: true`;
- `voiceOutput: true`;
- `whiteboard: true`;
- `visualBoardInterpretation: true`;
- `uiAnnotations: true`;
- `internalUiCapture: true`;
- `externalScreenCapture: false`.

**Esta prueba no cuenta como evidencia experimental formal**, porque el desarrollador conoce el sistema y puede conocer el contenido.

**Puerta:** decisión explícita de continuar o abandonar/rediseñar; benchmarks multimodales y línea base de accesibilidad aprobados con umbrales preinscritos; cero rutas de visión hacia veredictos formales; y congelamiento de capacidades/proveedores que hayan superado H8.

### H9 — Gobernanza para participante real

Solo si H8 justifica continuar, se completa y congela un paquete de gobernanza que incluye:

- inventario de tratamientos, finalidades, categorías de datos y lugares/proveedores donde circulan;
- aviso de privacidad integral y, cuando convenga, versión simplificada coherente;
- consentimiento informado de investigación como artefacto separado del aviso de privacidad, con comprobación de comprensión;
- mecanismo operativo de acceso, rectificación, cancelación, oposición y revocación, con responsable/contacto y plazos jurídicos verificados;
- plan de conservación, bloqueo y supresión por clase de dato/artefacto;
- clasificación `remisión a encargado` / `transferencia a tercero`, instrumentos contractuales/DPA y subencargados aplicables;
- matriz de políticas de datos por proveedor y función, incluida elegibilidad de ZDR/retención y funciones que introduzcan almacenamiento;
- procedimiento de vulneración de datos y árbol de decisión que distingue parada por seguridad/privacidad/derechos/bienestar de rescate pedagógico;
- identidad y vínculo seudónimo separados, con minimización y sin copias de documentos salvo necesidad demostrada;
- restauración fuerte, RPO/RTO y backup externo cuando el entorno real lo requiera;
- decisión documentada sobre entorno local presencial vs hosting remoto y sizing derivado de H8;
- revisión jurídica profesional del paquete antes de H11; cualquier incertidumbre material queda marcada como pendiente y bloquea el piloto hasta resolverse. La Cámara de Diputados lista actualmente el Reglamento LFPDPPP de 2011 entre reglamentos federales vigentes, pero su aplicación/armonización concreta con la Ley de 2025 se confirma profesionalmente;
- **PENDIENTE DE VERIFICACIÓN EXTERNA/PROFESIONAL:** antes de H11 se determina si la institución, mecanismo de reclutamiento, publicación prevista o cualquier otra condición exige revisión ética/comité. Si es exigible, su aprobación es gate; si no lo es, puede conservarse como salvaguarda voluntaria. Nunca opera pedagógicamente la corrida;
- política de publicación para n=1 con revisión de riesgo de reidentificación; citas/trazas características no se publican en bruto por comodidad;
- si existe compensación, sus condiciones quedan congeladas antes del consentimiento y no dependen del desempeño ni de completar toda la corrida; se revisa su voluntariedad;
- debriefing/cierre informativo al participante cuando termine o se retire, sin convertirlo en intervención dentro de la condición experimental.

**Puerta:** ningún dato personal entra a H11 hasta que el paquete aplicable esté completo, probado y firmado/congelado. Para H9, `responsible_role = SECURITY_PRIVACY_RESPONSIBLE` y `approver_role = EXPERIMENT_AUDITOR`, añadiendo `PROFESSIONAL_REVIEWER` donde LIC-02/LEG-01/LEG-02/ETH-01/ACC-01 lo exijan. Superar H9 no equivale a declarar cumplimiento legal global.

### H10 — Piloto seco formal

- participante simulado;
- calendario comprimido;
- fallos inyectados;
- auditoría completa;
- análisis con datos sintéticos;
- cerrar CAL-15 y producir un `verdict-manifest` ejecutable sin observar datos del participante real;
- comprobar la tabla `FAVORABLE`/`NO_FAVORABLE`/`NOT_INTERPRETABLE` y el flujo de aprobación W13;
- ejercicio de acceso/rectificación/cancelación/oposición y revocación con datos simulados;
- prueba de bloqueo/supresión de artefactos suprimibles sin romper la verificabilidad del ledger;
- caída/retención incompatible de proveedor y confirmación de que el sistema detiene o usa únicamente el fallback congelado;
- restore drill completo con verificación de permisos, manifests, ledger y política de datos.

### H11 — Piloto real

No se añaden funciones nuevas durante la corrida. Corre una versión congelada, incluidos sus *capability flags* multimodales.

**Hosting no es requisito científico por sí mismo.** Si el participante puede usar un entorno local controlado, el piloto puede seguir siendo local. Se contrata infraestructura remota solo si el modo de participación lo requiere.

---
## 14. Estrategia de pruebas

### 14.1 Unitarias

- parser;
- reglas;
- dominio;
- selector;
- calendario;
- hashes;
- permisos;
- filtros.

### 14.2 Propiedades

- una derivación aceptada debe ser semánticamente válida;
- toda derivación válida generada por construcción a partir de reglas autorizadas debe ser aceptada;
- `parse(print(ast))` conserva el AST de verificación;
- renombrar átomos biyectivamente no cambia el veredicto;
- un timeout o agotamiento del *proof search* nunca se registra como prueba de invalidez ni de inexistencia;
- una línea fuera de alcance nunca es accesible;
- un reactivo consumido no reaparece;
- una sonda nunca entra al contexto del agente;
- una corrección no elimina el evento original;
- el dominio no se alcanza sin transferencia;
- una intervención humana queda registrada.
- una transformación de coordenadas ida/vuelta conserva la geometría dentro de tolerancia;
- una anotación con revisión obsoleta nunca se renderiza;
- `visual-interaction` no puede importar/invocar el verificador ni escribir veredictos;
- una corrección post-`COMMIT` conserva el original;
- todo rol runtime carece de operaciones prohibidas declaradas por la matriz de permisos;
- una salida que el proveedor marca como estructurada no cruza el gateway si falla la validación local;
- un cambio de tarifa no reescribe costos históricos: crea un nuevo `pricing_manifest_id`;
- una referencia a artefacto suprimido conserva la cadena del ledger sin conservar el contenido personal.

### 14.3 Integración

- web → API → motor → verificador → evidencia;
- authoring → filtros deterministas/oráculo → proof search → verificador → paquete;
- measurement → sonda → verificador;
- auditoría ciega;
- freeze → despliegue;
- restauración;
- contract tests equivalentes entre adaptadores de proveedor;
- `pricing-manifest` → `cost-ledger` → agregados reconstruibles;
- ejercicio de derechos con datos simulados en H10.

### 14.4 Adversariales

- prompt injection del alumno;
- solicitud directa de solución;
- intento de cambiar reglas;
- extracción de sondas;
- texto malicioso en corpus;
- ambigüedad de notación;
- respuestas casi correctas;
- caída de proveedor;
- retraso y reintento;
- doble envío;
- manipulación de tiempo.
- parámetros no soportados por el modelo activo;
- corpus/entrada con instrucciones privilegiadas;
- XSS/CSRF/SSRF y uploads hostiles según superficie habilitada;
- intento de acceso SQL/FS/HTTP genérico desde el agente;
- tamper/reordenamiento/borrado de copia del ledger;
- caída del ledger antes de transición irreversible;
- drift de lockfile/digest/manifest;
- restore de backup en entorno limpio.

### 14.5 Datos sintéticos

Antes del piloto, el análisis completo debe poder ejecutarse con:

- aprendizaje claro;
- ausencia de efecto;
- efecto retrasado;
- datos faltantes;
- incidentes;
- falsa dominación;
- cambio de versión.

---

## 15. Entornos de ejecución y perfiles de modelo

### 15.1 Entorno L0 — Prueba local

Primera opción obligatoria por costo y fricción.

Corre en la computadora del desarrollador:

- frontend;
- backend;
- PostgreSQL;
- pg-boss;
- verificador;
- repositorio de contenido;
- almacenamiento de desarrollo;
- logs.

Solo salen a Internet las llamadas expresamente autorizadas a:

- APIs de modelos;
- investigación de fuentes durante W0.

No se contratan todavía:

- VPS;
- dominio;
- TLS público;
- DigitalOcean Spaces;
- Sentry Team;
- monitoreo de uptime;
- correo transaccional.

### 15.2 Entorno H1 — Piloto externo/remoto

Se activa solo si:

- H8 demuestra valor;
- existe participante real;
- se necesita acceso remoto o aislamiento operativo.

Proveedor previsto: Hetzner Cloud con Docker Compose y PostgreSQL autoalojado en el mismo host. Backups externos separados antes del piloto.

### 15.3 Perfil A — API comercial de alta capacidad

Perfil recomendado para la primera prueba de techo.

- candidatos iniciales fechados: Claude Sonnet 5 y GPT-5.6 Sol; reverificar disponibilidad, API y política de datos antes de evaluar;
- ganador por benchmark;
- pasarela propia;
- soluciones excluidas;
- snapshot fechado cuando exista; si no existe, `model_binding` y huella de comportamiento congelados;
- límites de gasto;
- modo degradado.

### 15.4 Perfil B — Modelo local

Candidato: Qwen3-14B sobre llama.cpp.

Se evalúa **después de la primera corrida con Perfil A**. No bloquea H8. Si la Tesla P100 se usa como banco de prueba, el manifiesto congela driver, versión compatible de CUDA 12.x, commit de llama.cpp, flags, cuantización, contexto, semilla y SHA256 del GGUF. La P100 se considera plataforma legado de experimentación; una migración a toolchain o GPU distinta constituye una nueva configuración de benchmark y no justifica por sí sola una compra. Cualquier GPU nueva requiere que Perfil B supere primero los gates funcionales pertinentes y un TCO explícito que incluya rendimiento útil, memoria, energía, tiempo de ingeniería/mantenimiento y costo de hardware, no solo tokens/segundo.

### 15.5 Perfil C — Tier económico/gratuito

Permitido para:

- CI;
- clasificación barata;
- pruebas secas;
- desarrollo sin datos reales.

No sustituye al Perfil A en la primera prueba de techo sin superar el benchmark correspondiente.
## 16. Recomendación definitiva y presupuesto por fases

### 16.1 Primera ejecución

La primera ejecución completa será:

> **PC local + Docker Compose + PostgreSQL local + Perfil A por API.**

No se compra hosting para descubrir si Profesor IA funciona.

### 16.2 Gasto local esperado

Con la computadora ya disponible, la prueba local **no exige contratar hosting**. Esto no convierte el costo total de la fase en cero: API, electricidad, almacenamiento incremental y trabajo humano se registran por separado.

No se conserva una cifra global heredada como presupuesto normativo. Cada proveedor/modelo usa un `pricing-manifest` fechado/versionado y cada llamada genera un `cost_event`; el presupuesto se reconstruye por:

- benchmark;
- W0/autoría/verificación;
- sesión;
- STT/TTS/visión;
- auditoría;
- almacenamiento/observabilidad;
- reintentos y fallos.

Antes de cada hito se fija un límite de gasto basado en la telemetría acumulada. No se genera el curso completo ni se ejecuta un benchmark masivo hasta que la etapa anterior funcione. Las tarifas actuales son datos temporales de operación y se revalidan al freeze; **no se incorporan como constantes científicas ni como promesa de costo futuro**.

### 16.3 Cuándo pagar infraestructura

Solo después de H8, y únicamente si se decide:

- usar participante externo;
- permitir acceso remoto;
- conservar evidencia fuera de la PC;
- ejecutar un piloto formal con requisitos de continuidad/privacidad.

En ese momento se revalida el presupuesto de Hetzner, backups, observabilidad, dominio y otros proveedores.

### 16.4 Ruta posterior

Después de la primera corrida completa con Perfil A:

1. comparar los resultados;
2. decidir si procede piloto formal;
3. ejecutar benchmark de Qwen3-14B;
4. migrar parcial o totalmente a Perfil B solo si mantiene calidad suficiente;
5. conservar la pasarela para evitar lock-in.

### 16.5 Qué no construir todavía

- Kubernetes;
- microservicios completos;
- Redis;
- PostgreSQL gestionado/HA;
- GPU nueva;
- LTI;
- voz-a-voz end-to-end sin texto canónico;
- cámara/webcam;
- full duplex/barge-in automático como requisito;
- reconocimiento de manuscrito como autoridad de calificación;
- captura externa de pantalla por defecto;
- RAG vectorial general;
- GraphRAG;
- app móvil;
- panel institucional;
- sistema comercial de pagos;
- empaquetado definitivo de escritorio;
- infraestructura remota antes de H8.
## 17. Riesgos principales y respuesta

| Riesgo | Impacto | Respuesta |
|---|---|---|
| Verificador acepta una prueba inválida | Invalida evaluación | Oráculo semántico, property-based testing y bloqueo |
| Verificador rechaza una derivación correcta | Falso error pedagógico, ayuda o no dominio artificial | Derivaciones válidas por construcción, soluciones alternativas, conjunto dorado y regresiones |
| Validez semántica se confunde con derivabilidad en un fragmento restrictivo | Diagnóstico erróneo del buscador/reactivo | Política semántica por cálculo + decisor exacto solo cuando esté justificado |
| Canonicalización de isomorfismo contamina el AST de verificación | Aceptación de pasos no autorizados | Módulos separados + regla arquitectónica `forbidden` |
| Pipeline genera reactivos ambiguos | Contamina enseñanza/medición | Crítica, muestra, regeneración por familia |
| Sondas parecidas a práctica | Sobreestima aprendizaje | Detector de isomorfismo estructural, reservas aisladas y auditoría de falsos negativos |
| Dependencia KC mal tipada | Sesga secuencia y atribución de errores | Etiquetas formal/pedagógica/conceptual/estadística + versionado |
| Error multi-KC atribuido al KC equivocado | Falso diagnóstico de dominio | KC principal + KC de soporte en traza/evidencia |
| Agotamiento de proof search interpretado como invalidez/inexistencia | Descarta o clasifica mal reactivos | Estados separados + presupuesto reproducible + decisor exacto solo si está autorizado |
| Suite de pruebas no detecta defecto del verificador | Falso positivo sistémico | Property-based + mutation testing + regresiones |
| Modelo revela respuesta | Invalida acto | No acceso, canarios, filtros y pruebas adversariales |
| Agente enseña fuera del corpus | Error factual | Anclaje obligatorio y rechazo |
| Humano rescata el bloque | Pierde atribución | Prohibición funcional y evento de intervención |
| Cambio de modelo | Rompe comparabilidad | Freeze y nueva versión |
| API rechaza parámetros o cambia comportamiento bajo el mismo alias | Corrida no comparable/fallo de producción | Tabla de capacidades + `model_binding` + huella de comportamiento |
| Benchmark sobreajustado por reutilizar evaluación | Selección sesgada | Partición desarrollo/evaluación y reemplazo de evaluación contaminada |
| Dificultad mal estimada | Sesga fases | Índices múltiples, auditoría y limitación explícita |
| Interfaz confunde al alumno | Falso error de contenido | Calibración y categoría de error separada |
| Barrera de accesibilidad se imputa al KC | Falso error conceptual | Línea base H8 + categoría `ACCESSIBILITY_ERROR` + ayudas técnicas registradas |
| Visión interpreta con confianza un manuscrito/target equivocado | Dirección errónea | Abstención/confirmación + estado estructurado primero + prohibición de veredicto visual |
| Carga de auditoría excesiva | Producto inviable | Medir por separado; no ocultar |
| Caída de API o hardware | Sesión desviada | modo degradado y política de validez |
| Pérdida de evidencia | Invalida resultados | append-only, backup y restauración |
| Credencial runtime/permiso excesivo | Fuga o manipulación de reservas/evidencia | Matriz ejecutable, pruebas negativas, no owner/superuser/BYPASSRLS |
| Reescritura histórica por actor privilegiado | Pérdida de confianza en evidencia | hash chain + checkpoint firmado + límite de threat model explícito |
| Supply-chain drift durante corrida | Cambia el sistema congelado | lockfile, instalación reproducible, digests y bloqueo por manifest |
| Corpus contradictorio | Autoría defectuosa | detector y bloqueo antes del freeze |

---

## 18. Entregables de construcción

### Código

- monorepo;
- CI;
- despliegue reproducible;
- pruebas;
- migraciones;
- runbooks.

### Contenido

- corpus versionado;
- paquete generado;
- soluciones aisladas;
- auditoría;
- manifiesto.

### Experimental

- preinscripción;
- calendario;
- plan de análisis;
- datos sintéticos;
- exportadores;
- plantillas de informe.

### Gobernanza

- aviso;
- consentimiento;
- matriz de roles;
- política de conservación;
- procedimiento de incidente probado mediante fallos inyectados;
- procedimiento de retirada;
- registro de proveedores;
- threat model y matriz ejecutable de permisos vigentes.

### Operación

- checklist pre-sesión;
- checklist post-sesión;
- respaldo;
- restore drill completo en entorno limpio con verificación de manifest, ledger, proyecciones y grants;
- suite crítica de pruebas negativas de privilegios en verde;
- restauración;
- monitoreo;
- límites de gasto;
- contacto de emergencia.

---

## 19. Definición de “listo para piloto”

El sistema está listo solo si:

- todos los componentes se despliegan desde cero mediante script;
- el verificador supera el conjunto dorado;
- el pipeline genera el paquete sin autoría manual reactivo por reactivo;
- la auditoría muestral está dentro de umbral;
- no hay ruta del agente a soluciones;
- la política pedagógica está versionada, validada y congelada;
- `LEARNING_MODE` y `MEASUREMENT_MODE` están separados por pruebas automatizadas;
- los intentos con ayuda decisiva no cuentan como dominio sin reconfirmación;
- el modo sonda desactiva toda ayuda;
- el freeze detecta cualquier cambio;
- la bitácora reconstruye sesiones;
- el alumno puede apelar y retirarse;
- el respaldo fue restaurado;
- el análisis corre con datos sintéticos;
- el modelo supera benchmark;
- el benchmark conserva una evaluación no contaminada y un `model_binding` verificable;
- los permisos runtime y pruebas negativas críticas están en verde;
- el evidence-ledger verifica cadena/checkpoint y el restore drill limpio;
- H8 ha separado y calibrado percepción/interfaz/accesibilidad antes de atribuir errores al alumno;
- el piloto seco completo termina sin intervención docente;
- los responsables aceptan los riesgos documentados.

---

## 20. Criterio de éxito técnico

El éxito técnico no significa que el Profesor IA enseñó bien. Significa que el sistema permitió medirlo sin esconder sus fallos.

El plan habrá sido implementado correctamente cuando:

- la IA pueda preparar y operar;
- el código pueda limitar y verificar;
- el humano pueda auditar desde fuera;
- cada intervención quede visible;
- una falla no se transforme silenciosamente en éxito;
- los resultados sean reproducibles por versión.

---

**Fin del plan técnico unificado v2.**


---

# Parte III — Protocolo operativo de la Etapa 1

## 0. Prueba funcional local previa

Antes del protocolo experimental formal existe una corrida de ingeniería en la computadora del desarrollador.

Puede usar:

- datos sintéticos;
- el propio desarrollador como usuario de prueba;
- reinicios;
- inspección técnica;
- correcciones inmediatas entre corridas.

Sus resultados sirven para:

- encontrar fallos;
- medir costos;
- corregir interfaz;
- validar W0–W13;
- decidir si vale la pena financiar la siguiente fase.

**No se interpreta como evidencia causal de aprendizaje ni como piloto experimental válido** cuando el desarrollador actúa como alumno.

El protocolo formal comienza únicamente después de congelar una versión y definir un participante válido.

**Derivado de:** Base funcional consolidada v4 y Plan técnico unificado v2.  
**Estado:** protocolo inicial para preinscripción y ejecución.  
**Fecha:** agosto de 2026.  
**Propósito:** convertir la dirección de autonomía máxima en pasos, umbrales y decisiones observables.

---

## 1. Regla central de ejecución

Durante el piloto real:

- la IA prepara las sesiones;
- la IA conduce la enseñanza;
- el código verifica y controla;
- el humano no opera pedagógicamente;
- toda incapacidad de la IA se registra como resultado;
- la auditoría ocurre después y no convierte fallos en éxitos.

---

## 2. Participante y entorno

### 2.1 Participante

- una persona adulta;
- consentimiento informado;
- sin calificación oficial;
- sin obligación académica de terminar;
- con disponibilidad para seguimientos;
- sin enseñanza humana paralela sobre los KC experimentales.

### 2.2 Sesión de familiarización

Antes de recolectar medidas:

- explicar el estudio;
- practicar autenticación;
- aprender el editor Fitch;
- probar micrófono, transcripción y corrección de transcript si la corrida habilita voz;
- aprender el pizarrón y las anotaciones si están habilitados;
- realizar ejercicios de interfaz no incluidos en los conjuntos experimentales;
- verificar comprensión del sistema de pausa, apelación y retirada.

Los datos de familiarización no se usan para declarar aprendizaje. La familiarización enseña **uso de herramientas**, no KC experimentales ni fundamentos lógicos sustantivos.

Después de superar la familiarización y antes de la primera línea base se ejecuta `foundation_phase` de P-I §5.2.1: Profesor IA enseña KC01/KC02/KC08 con materiales fuera de las reservas A/B/C. El SCED no comienza hasta superar su criterio de suficiencia. Ningún humano puede enseñar esos fundamentos para “preparar” al participante dentro de la condición.

La familiarización no termina solo por duración. Antes del freeze del piloto se preinscribe un **criterio observable de suficiencia** sobre tareas no experimentales. El valor concreto se calibra en H8; como patrón inicial puede requerirse completar tareas consecutivas sin error de interfaz, sin ayuda de uso y sin corrección por fallo del sistema. Si el criterio no se alcanza, se prolonga la familiarización dentro de la contingencia preinscrita; no se enseña contenido experimental para “acelerarla”.

### 2.3 Entorno

- dispositivo y navegador registrados;
- conexión estable o despliegue local;
- lugar razonablemente libre de interrupciones;
- sin material de apoyo durante sondas;
- registro de interrupciones externas.

---

## 3. Preparación del corpus

### 3.1 Entrada mínima

El equipo proporciona:

- corpus fuente;
- identificación de la subunidad;
- calendario máximo;
- perfil mínimo del participante;
- política de datos;
- cálculo lógico permitido.

### 3.2 Validaciones

El corpus se bloquea si:

- contiene reglas contradictorias sin aclaración;
- usa notaciones incompatibles;
- no cubre los KC candidatos;
- no permite anclaje por fragmento;
- su licencia o autorización no está registrada;
- faltan páginas o secciones necesarias.

### 3.3 Fragmentación

Cada fragmento debe tener:

- ID estable;
- fuente;
- ubicación;
- hash;
- tipo;
- conceptos relacionados;
- estado autorizado.

---

## 4. Generación del paquete autónomo

### 4.1 Corrida de autoría

El pipeline se ejecuta con:

- versiones fijadas de modelos;
- temperatura y parámetros registrados;
- semillas cuando el proveedor lo permita;
- límite de reintentos;
- costos y tiempos registrados;
- salida estructurada obligatoria.

### 4.2 Cobertura mínima

Los conteos y fracciones de esta sección son **parámetros operativos de cobertura de esta versión**, no constantes científicas. Se identifican en el registro de parámetros y se congelan; cualquier ajuste previo a H11 requiere nueva versión/preinscripción.

Para cada KC que entre al piloto:

- 6 actividades operativas como piso;
- 3 niveles de pista como mínimo;
- 1 actividad de transferencia;
- reserva de recuperación;
- trazabilidad al corpus.

Para cada conjunto experimental:

- sondas suficientes para el calendario completo;
- reserva adicional mínima del 20 %;
- al menos una forma de transferencia por punto crítico;
- reserva de retención suficiente para el/los intervalos preinscritos; si la corrida no medirá retención, debe declarar `retention_not_evaluated` antes de H11 y no responder afirmativamente el componente de retención de la pregunta principal.

### 4.3 Límites de regeneración

- máximo 5 intentos por candidato individual;
- máximo 3 regeneraciones por familia antes de bloqueo;
- una familia con más de 30 % de rechazo automático se marca inestable;
- una familia inestable no entra al paquete hasta rediseñar su plantilla.

Estos valores son parámetros operativos iniciales de la versión y deben congelarse antes del piloto; no se presentan como constantes universales. El número de regeneraciones por familia alimenta además la prioridad de control de isomorfismo/agotamiento de reservas antes del freeze.

---

## 5. Auditoría previa del paquete

### 5.1 Selección

Muestra estratificada automática:

- 20 % de cada función del banco;
- mínimo 5 artefactos por función cuando existan;
- mínimo 1 artefacto por KC;
- representación de complejidad baja, media y alta;
- representación de reactivos con y sin subpruebas;
- dimensión explícita de riesgo/consecuencia, con sobremuestreo adicional permitido sin reducir los pisos anteriores;
- selección mediante semilla registrada.

Por estrato se registran `N_h`, `n_h`, fracción real, semilla/mecanismo de selección, probabilidad de inclusión cuando sea calculable, familia/origen y defectos por severidad.

### 5.2 Clasificación de defectos

La auditoría aplica un **codebook versionado**. La severidad se fundamenta explícitamente en tres preguntas: si el defecto puede cambiar la respuesta/veredicto; si puede contaminar medición, revelar una solución o enseñar una regla falsa; y si parece local o señal de causa común de familia/generador.

#### Crítico

- solución incorrecta;
- reactivo sin solución válida;
- fuga de solución;
- contradicción con el corpus;
- evaluación que puede aceptar una respuesta inválida;
- sonda reutilizada o contaminada.

#### Mayor

- ambigüedad que cambia la respuesta;
- dificultad claramente fuera del nivel declarado;
- pista que prácticamente resuelve;
- etiqueta KC incorrecta;
- rúbrica no aplicable.

#### Menor

- redacción mejorable sin cambiar la interpretación;
- formato inconsistente;
- anclaje incompleto pero recuperable;
- detalle estilístico.

### 5.3 Umbrales de aceptación

Los porcentajes y conteos siguientes son **parámetros normativos de riesgo de esta versión**, no constantes científicas universales. Antes del freeze se documentan tamaños absolutos, denominadores y capacidad de detección/curva OC equivalente para tasas de defecto preinscritas relevantes; este análisis no reemplaza los gates.

El paquete se bloquea si:

- aparece 1 defecto crítico;
- los defectos mayores superan 5 % de la muestra;
- los defectos menores superan 15 %;
- una familia concentra 2 o más defectos mayores;
- falta cobertura de algún estrato.

Cuando se bloquea, se regenera la familia afectada y se obtiene una muestra nueva. No se corrigen manualmente solo los elementos revisados. Se conservan juicio inicial, causa raíz, acción sobre la familia, muestra de reemplazo y regresión.

---

## 6. Benchmark del modelo de sesión

### 6.1 Conjunto de prueba

Antes del freeze se construye un conjunto de benchmark con las mismas familias mínimas. Los conteos que siguen son **pisos operativos del benchmark de esta versión**, no tamaños muestrales científicamente universales; el tamaño final y las repeticiones permanecen calibrables y se congelan antes de evaluación:

- 50 solicitudes de explicación;
- 30 reformulaciones;
- 30 clasificaciones de error;
- 20 dudas fuera de alcance;
- 30 intentos adversariales de obtener soluciones;
- 20 casos con contexto incompleto;
- 20 casos de caída o salida inválida simulada.

El conjunto se **amplía o particiona** en desarrollo/evaluación mediante semilla registrada. El tamaño final de evaluación y el número de repeticiones se fijan antes de mirar resultados de evaluación. Desarrollo puede reutilizarse para ajuste; evaluación decide el ganador y cualquier exposición que provoque un ajuste posterior contamina esos ítems.

### 6.2 Umbrales iniciales

Estos valores son **gates locales del benchmark** y parámetros de riesgo del proyecto. Se reportan con denominadores (`x/n`) e incertidumbre apropiada; no implican que una tasa futura de fallo sea literalmente cero. Antes de evaluación cada gate congela su unidad de análisis y denominador: solicitud inicial, respuesta después de un reintento, segmento factual, pregunta fuera de corpus o escenario de fallo, según corresponda. `refusal`, `truncated`, `provider_error` y `schema_violation` no se eliminan silenciosamente del denominador. En gates con cero fallos observados se registra además una cota unilateral compatible con el plan —la aproximación `3/n` puede usarse cuando sus supuestos sean razonables— y la conclusión se redacta como “sin fallos observados bajo los casos ensayados”.

- **0 fugas de solución** observadas;
- **0 invenciones de reglas** que lleguen al alumno sin ser bloqueadas;
- al menos **98 % de respuestas estructuralmente utilizables después de un reintento**, reportando por separado `schema_violation`, `truncated`, `refusal` y errores de proveedor;
- al menos **95 % de segmentos factuales con anclas resolubles**, sin confundir esa métrica con atribución correcta; la muestra ciega evalúa atribuibilidad/fidelidad;
- **100 % de preguntas fuera del corpus** declaradas o contenidas bajo los casos ensayados;
- **100 % de recuperación determinista al modo degradado** en pruebas simuladas; cualquier fallo de este mecanismo se trata como bug bloqueante, no como una tasa tolerada.

Se reporta también estabilidad intra-modelo entre repeticiones. La calidad pedagógica se audita en una muestra ciega. Un defecto crítico bloquea el modelo.

### 6.3 Puertas multimodales antes del freeze

Si la corrida habilita voz o visión, H8 produce un conjunto dorado separado y antes del participante se congelan métricas/umbrales locales:

**STT**
- WER/CER como diagnóstico;
- error de términos del léxico lógico;
- latencia y tasa de corrección;
- **tasa de decisiones pedagógicas que cambiarían por error de transcripción**, reproducida offline contra la política determinista, como métrica de aceptación principal.

**TTS**
- reconstrucción exacta de fórmulas desde audio sin ver el texto;
- interrupción y preservación del texto canónico/eventos;
- latencia/costo medidos extremo a extremo;
- degradación a texto sin cambio de decisión cuando el manifest lo permita.

**Visión/anotaciones**
- interpretación correcta y abstención correcta por estrato;
- error confiado reportado siempre;
- replay geométrico y rechazo de coordenadas obsoletas;
- **0 casos arquitectónicamente posibles** en que `visual-interaction` determine/escriba un veredicto formal.

Los umbrales estadísticos se calibran localmente y se congelan; no se importan WER, ExpRate, latencias o scores de benchmarks externos como requisitos del proyecto.

---

## 7. Validación del verificador

### 7.1 Conjunto dorado

Los conteos siguientes son **pisos de aseguramiento del proyecto**, no tamaños científicamente universales. Se registran bajo parámetros versionados y pueden crecer si la cobertura/fallos lo exigen.

Debe incluir como mínimo:

- 100 derivaciones válidas;
- 100 inválidas;
- 50 casos de alcance y subpruebas;
- 50 variantes equivalentes;
- 50 casos límite;
- derivaciones válidas por construcción y variantes de solución estructuralmente distintas;
- pruebas generadas por propiedades.

La cantidad puede crecer. No se reduce para acelerar el piloto.

### 7.2 Puertas

- 0 falsos positivos en el conjunto dorado;
- 0 falsos negativos conocidos sin resolver en el conjunto dorado/generación por construcción;
- 0 discrepancias con el oráculo semántico sin resolver;
- toda discrepancia entre `search_budget_exhausted` y un decisor terminante autorizado queda explicada antes de freeze;
- prueba de que el proceso no tiene red;
- prueba de permisos sobre soluciones.

### 7.3 Pruebas generativas y mutacionales

Antes del freeze:

- las propiedades de alcance, aplicación de reglas, round-trip del parser, determinismo, renombrado, preservación semántica y aceptación de derivaciones válidas por construcción se ejercitan con property-based testing;
- semillas, distribución de casos y cualquier interrupción incompleta quedan registradas;
- las rutas críticas de alcance y reglas se someten a mutation testing con StrykerJS;
- no queda ningún mutante superviviente crítico sin clasificación y justificación;
- profundidad de generadores, cobertura de distribución, número de ejecuciones y presupuesto de mutation testing se registran en el manifiesto de validación y se ajustan por coste/cobertura observados, no por un número universal importado.

---

## 8. Selección de conjuntos experimentales

### 8.1 Requisitos

Cada conjunto debe:

- poder recibir enseñanza en un momento distinto;
- tener sondas independientes;
- no depender completamente de un conjunto aún no enseñado;
- presentar dificultad estructural comparable bajo un criterio preinscrito; **CALIBRABLE en H8/H10:** definir la métrica/banda o, si no puede justificarse una banda, registrar la diferencia y su efecto de interpretabilidad sin usar “razonablemente” como gate subjetivo;
- permitir al menos una medida de transferencia.

### 8.2 Proceso

1. el pipeline propone agrupaciones;
2. un validador comprueba dependencias;
3. se simula el calendario;
4. el auditor revisa únicamente la plausibilidad del agrupamiento;
5. se congela la selección.

El auditor no diseña manualmente la secuencia.

---

## 9. Calendario experimental

### 9.1 Diseño

Línea base múltiple concurrente con **técnica de sondas múltiples** entre tres conjuntos. La inferencia causal queda limitada a este participante/subunidad/versión y los tres conjuntos constituyen el piso de esta corrida, no una base para generalización poblacional.

### 9.2 Mínimos de planeación

Como objetivo metodológico inicial:

- al menos 6 puntos en la línea base inicial del primer conjunto;
- al menos 5 observaciones válidas por fase para cualquier contraste que pretenda ser interpretable; si no se alcanzan, el contraste es `NOT_INTERPRETABLE`;
- 3 transiciones distintas;
- concurrencia entre conjuntos;
- retención preespecificada.

Si por datos faltantes o contingencias reales no se alcanzan mínimos preinscritos, no basta con declarar “con reservas”: se aplican P-I §10.5/§10.5.1 y la regla de incidentes/datos faltantes de este protocolo, asignando el estado que corresponda (`válida con desviaciones`, `con reservas` o `no interpretable`) sin decisión post hoc. Si antes de H11 el calendario diseñado ya no puede sostener los mínimos que el propio protocolo declare obligatorios, el gate no abre hasta re-preinscribir o acotar formalmente la afirmación.

Los **6 puntos de la primera línea base** son un parámetro interno de planeación deliberadamente conservador de Profesor IA. No se atribuyen como exigencia textual del estándar WWC vigente. Cuando se use WWC como referencia de reportabilidad se verifica la edición exacta y se declara por separado si el diseño satisface su estructura de fases/observaciones; el criterio interno más estricto puede mantenerse sin falsear la fuente externa.

### 9.3 Frecuencia, estabilidad e inicio de intervención

La frecuencia de sesiones/sondas se define según fatiga y disponibilidad; no se fija una periodicidad universal. Los **inicios de enseñanza**, en cambio, se expresan en `probe_round` globales válidas según P-I §10.2.1 y quedan congelados así:

- conjunto A: ventana `6–8`;
- conjunto B: ventana `9–11`;
- conjunto C: ventana `12–14`;
- antes de la corrida, una semilla congelada selecciona un punto planificado dentro de cada ventana;
- los inicios efectivos conservan una separación mínima de `3` `probe_round` globales válidas.

Un conjunto es elegible para iniciar enseñanza cuando, además de alcanzar su punto planificado, sus **tres últimas observaciones válidas** de línea base no forman una secuencia estrictamente creciente y las **dos últimas** no constituyen sucesivamente nuevos máximos históricos de esa línea base.

Si la condición no se cumple en el punto planificado, el inicio se difiere una `probe_round` válida por vez, sin re-aleatorizar, con extensión máxima de `2` rondas y sin superar el extremo de la ventana. Si no se satisface dentro de ese límite, el conjunto no inicia intervención bajo esta preinscripción y se aplica la regla de interpretabilidad; la ventana no se mueve post hoc.

Todo cambio de una línea no intervenida coincidente con enseñanza en otro conjunto se registra como covariación/carryover y entra al análisis. Estas cifras son parámetros normativos de esta corrida, no constantes científicas universales.

## 10. Protocolo de sesión

### 10.1 Antes de entrar

Checklist automático:

- manifiesto coincide;
- servicios sanos;
- reloj sincronizado;
- respaldo reciente;
- proveedor disponible;
- cuota o presupuesto suficiente;
- reservas disponibles;
- no hay incidente sistémico abierto.

### 10.2 Inicio

- autenticar;
- mostrar aviso de IA;
- confirmar voluntad de continuar;
- registrar condiciones externas;
- preguntar y registrar exposición externa/autoestudio desde la sesión anterior usando `NONE`, `UNRELATED_OR_FOUNDATION`, `TARGET_KC_EXPOSURE` o `DIRECT_ITEM_EXPOSURE`; aplicar exactamente P-I §10.8 antes de decidir validez/continuidad;
- diagnóstico breve cuando corresponda;
- mostrar plan.

### 10.3 Bloque de enseñanza

1. anunciar objetivo y fijar `LEARNING_MODE`;
2. motor selecciona estrategia y nivel de ayuda desde la política congelada;
3. ejecutar explicación/ejemplo/práctica correspondiente con anclaje mediante texto y, si está habilitado, voz;
4. usar pizarrón/anotaciones cuando aporten claridad;
5. comprobar comprensión por un canal permitido;
6. clasificar por separado error conceptual, de interfaz, STT o percepción;
7. aplicar feedback, autoexplicación, recuperación de prerrequisito o cambio de estrategia cuando la política lo indique;
8. retirar ayuda de manera contingente al desempeño;
9. registrar ayudas, estrategia y artefactos multimodales relevantes;
10. actualizar dominio solo con intentos elegibles.

### 10.4 Actividad puntuable

- modo y elegibilidad definidos por el motor;
- rúbrica visible;
- editor adecuado;
- solución fuera de contexto;
- verificación aislada;
- retroalimentación basada en salida estructurada;
- evidencia append-only con integridad verificable;
- STT/visión no sustituyen al editor/verificador cuando la actividad sea formal.

### 10.5 Sonda

- `MEASUREMENT_MODE` obligatorio;
- autoridad de selección/tiempo/consumo/validez operacional = `measurement-worker`;
- agente pedagógico deshabilitado;
- pistas deshabilitadas;
- sin retroalimentación;
- tiempo fijo por contrato; una pregunta de contenido no extiende el reloj ni recibe respuesta pedagógica;
- banco reservado;
- pausa antes de mostrar ítem no consume; pausa después de mostrarlo invalida la oportunidad afectada y el ítem permanece consumido;
- fin de sesión a mitad de oportunidad = `missing_session_time`; retirada = `withdrawal`; incidente sigue la taxonomía canónica;
- una reposición usa reserva independiente y nunca reactiva el ítem mostrado;
- registro de condiciones;
- auditoría posterior;
- voz, pizarrón y visión se deshabilitan si la sonda requiere un canal estructurado aislado según preinscripción.

### 10.6 Cierre

- resumen del alumno;
- conceptos dominados y pendientes;
- reporte de ayudas;
- tarea solo si está dentro del protocolo;
- preparación automática de siguiente sesión;
- exportación y respaldo.

---

## 11. Política de fallo pedagógico

### 11.1 Criterio

Antes de asignar consecuencia experimental, todo fallo que impida continuar se clasifica por **causa primaria**:

- `PEDAGOGICO`: servicios e interfaz necesarios están operativos y la evidencia es íntegra, pero se agotan tres ciclos, persiste `wheel_spinning`, no se alcanza dominio o no se encuentra una explicación anclada alternativa;
- `OPERACIONAL`: caída de proveedor/infraestructura, timeout sistémico, cuota, servicio no disponible, reserva agotada por cobertura insuficiente u otra imposibilidad técnica/logística;
- `INTERFAZ_PERCEPCION`: editor, accesibilidad, STT, visión o interacción impiden que el alumno produzca/reciba correctamente el acto previsto sin demostrar un fallo conceptual.

`MEASUREMENT_MODE` no depende del modelo generativo: una caída del LLM de enseñanza no invalida por sí misma una sonda si `measurement-worker`, verificador, almacenamiento y canal requerido siguen sanos.

### 11.2 Acción

- `PEDAGOGICO`: cerrar el bloque, registrar KC/causa, no convocar a un docente y programar recuperación automática si existe; después de dos episodios posteriores fallidos **del mismo KC**, declarar límite observado;
- `OPERACIONAL`: aplicar fallback congelado si existe; de lo contrario pausar/suspender según severidad, registrar desviación y no convertir el evento en “no aprendido”;
- `INTERFAZ_PERCEPCION`: degradar a canal autorizado cuando sea posible; si afecta un acto puntuable, invalidarlo/reponerlo según protocolo, sin etiquetarlo como error conceptual.

### 11.3 Efecto experimental

Un fallo `PEDAGOGICO` puede sostener un resultado pedagógico negativo y también afecta autonomía. `OPERACIONAL` afecta autonomía/viabilidad y puede producir datos faltantes o incidente, pero **no** cuenta por sí solo como evidencia de no aprendizaje. `INTERFAZ_PERCEPCION` afecta experiencia/autonomía y, si contaminó una medición, su validez; solo adquiere consecuencia pedagógica cuando exista evidencia independiente de que el problema fue realmente conceptual.

---

## 12. Política de intervención humana

### 12.1 Permitida en vivo

Solo para:

- emergencia;
- privacidad;
- autenticación irrecuperable;
- retirada;
- fallo técnico sistémico;
- riesgo no pedagógico.

### 12.2 Prohibida en vivo

- explicar;
- responder la actividad;
- validar una regla;
- decidir avance;
- seleccionar ejemplo;
- cambiar objetivo;
- dar una pista adicional.

### 12.3 Registro

Toda intervención requiere:

- quién;
- cuándo;
- categoría;
- subcategoría, incluyendo `perception/interface/accessibility` cuando aplique;
- motivo;
- contenido afectado;
- efecto sobre validez.

---

## 13. Auditoría posterior

### 13.1 Censo

Revisar el 100 % de:

- sondas primarias;
- retención;
- respuestas libres puntuadas;
- incidentes;
- apelaciones;
- resultados que sostengan conclusiones.

### 13.2 Muestra

Revisar inicialmente:

- 20 % de actividades de práctica;
- 20 % de explicaciones factuales;
- 20 % de retroalimentaciones;
- 20 % de decisiones de adaptación;
- 100 % de salidas no ancladas o marcadas.

La muestra se estratifica y se genera automáticamente. El reporte conserva `N_h`, `n_h`, fracción real, semilla/método, probabilidad de inclusión cuando sea calculable, riesgo/consecuencia y defectos por severidad. Los resultados de `100 %` se reportan como `x/n`, conservando el gate sin inferir riesgo futuro cero.

### 13.3 Reducción posterior

Dentro de la Etapa 1 no se reduce el censo de resultados primarios.

La muestra de actos internos solo puede bajar después de una ventana predefinida si:

- no hubo defectos críticos;
- defectos mayores ≤2 %;
- concordancia en decisiones binarias ≥95 %;
- no hay patrón concentrado por KC o tipo de salida.

La reducción no puede aplicarse retroactivamente y solo acumula evidencia dentro de un manifiesto/versionado compatible. Un cambio sustantivo en generador, política de autoría, verificador o codebook reinicia la ventana aplicable.

### 13.4 Cegamiento, concordancia y adjudicación

Cuando se mida concordancia, el auditor bloquea su primera decisión antes de ver el veredicto del sistema; también se ocultan en primera pasada metadatos de generador/historial no necesarios. El reporte de acuerdo incluye matriz de confusión, prevalencia, FP, FN y denominadores, además del gate vigente.

El codebook se calibra antes de la corrida con material ajeno a reservas. Puede usarse un segundo auditor independiente en una submuestra preinscrita si la carga humana lo permite. Se conservan append-only los juicios originales, adjudicación, causa raíz, regeneración, nueva muestra y regresión.

### 13.5 Reporte SCED

El análisis primario es visual y estructurado: nivel, tendencia, variabilidad, inmediatez, solapamiento y consistencia entre conjuntos. El complemento cuantitativo congelado es `Tau-U` por conjunto, reportando por separado el contraste de fase sin corrección y la variante que incorpora tendencia de línea base.

La autocorrelación de primer orden se reporta como diagnóstico solo cuando una fase contiene al menos `5` observaciones válidas consecutivas. No produce por sí sola un cambio de veredicto.

Los datos primarios faltantes no se imputan. Se publican `n_planificado`, `n_valido`, causas de pérdida y cobertura. Un contraste conjunto-fase exige `5` observaciones válidas por fase; de otro modo es `NOT_INTERPRETABLE`. Con menos de dos transiciones interpretables, el resultado pedagógico global es `no_interpretable`.

La covariación contemporánea de una línea todavía no intervenida se declara explícitamente. Ningún valor o `p` de Tau-U sustituye el análisis visual ni actúa como cutoff universal. El reporte usa SCRIBE como checklist de reporte, no como criterio automático de éxito.

## 14. Incidentes e invalidación

Las clases y efectos de esta sección son una instancia operativa de la taxonomía canónica de Parte I §13. Toda implementación usa los mismos `incident_code`/niveles; esta parte no define una taxonomía independiente.

### 14.1 Menor

Continúa con registro si no afecta aprendizaje ni evaluación.

### 14.2 Localizado

Invalida acto o bloque. Se repone con reserva si hacerlo no altera el diseño.

### 14.3 Sistémico

Suspende la corrida.

Causas:

- falso positivo del verificador;
- fuga de solución;
- contaminación de sondas;
- cambio no registrado;
- pérdida transversal de datos;
- vulneración de privacidad;
- intervención docente extensa.

### 14.4 Reinicio

Un reinicio requiere:

- causa raíz;
- corrección;
- prueba de regresión;
- nueva versión;
- decisión explícita sobre datos previos.

---

## 15. Métricas

Antes de H11 existe un `metrics-manifest` congelado. Ninguna métrica sin contrato de numerador/denominador o población, unidad, inclusiones, faltantes y regla de interpretación puede sostener un veredicto. El reporte primario de sondas usa `x/n` y cobertura respecto de lo planificado.

### 15.1 Aprendizaje

El `metrics-manifest` congela, como mínimo:

- `probe_accuracy = correctas_válidas / sondas_válidas_puntuadas`, más cobertura `sondas_válidas_puntuadas / sondas_planificadas`;
- `transfer_measurement_accuracy = transfer_correct_valid / transfer_valid_scored`, más cobertura, solo desde `TRANSFER_MEASUREMENT`;
- `retention_accuracy = retention_correct_valid / retention_valid_scored`, más cobertura, solo desde la reserva de retención de 7 días; si no puede ejecutarse: `retention_not_evaluated`;
- `false_mastery_rate` con reconfirmación posterior elegible, no asistida y previa a reenseñanza;
- `hint_dependency` solo sobre práctica independiente iniciada con `assistanceLevel=0`, contando ayudas `masteryDisqualifying=true`;
- `time_to_mastery` en segundos de actividad instructiva, excluyendo pausas, downtime, tiempo entre sesiones y MEASUREMENT_MODE;
- `wheel_spinning` solo con umbral calibrado/congelado;
- BKT únicamente como métrica sombra si está habilitado.

No existe un `phase_change` escalar en Etapa 1. La evidencia de cambio de fase es la combinación preinscrita de análisis visual + Tau-U descrita en §13.5.

### 15.2 Autonomía

La salida primaria es la **matriz función × estado de autonomía × criticidad** con denominadores visibles. Se reportan:

- funciones críticas y no críticas ejercitadas/no ejercitadas;
- estado por función: sin ayuda, con control automático, con intervención humana extraordinaria, fallida o no evaluada;
- fallos y excepciones humanas por función;
- sesiones completadas sin rescate;
- controles automáticos utilizados;
- **porcentaje global de decisiones autónomas solo como estadístico secundario**, nunca como titular ni sustituto de la matriz; incluye definición explícita del denominador y tratamiento de `no evaluada`.

### 15.3 Autoría

- candidatos;
- rechazos;
- regeneraciones;
- defectos;
- cobertura;
- tiempo y costo.

### 15.4 Operación

- latencia;
- caídas;
- reintentos;
- modo degradado;
- reservas agotadas;
- errores de interfaz.

### 15.5 Carga humana

Cada asiento registra categoría, inicio/fin, método de medición y escala:

- auditoría;
- incidentes;
- configuración;
- mantenimiento;
- correcciones;
- gobernanza/privacidad cuando sea atribuible al proyecto;
- `FIJO_PROYECTO`, `FIJO_POR_UNIDAD`, `MARGINAL_POR_SESIÓN` o `MARGINAL_POR_ALUMNO`;
- bandera `sin_equivalente_convencional` para trabajo creado por la automatización.

La comparación con operación docente convencional distingue **tiempo observado** de **estimación**. Si se obtiene una referencia humana, se mide sobre una tarea acotada, después del freeze y fuera del circuito del alumno; sus artefactos no entran al corpus/bancos y no se usa como contrafactual de aprendizaje.

---

## 16. Veredictos finales

Los veredictos se asignan únicamente con el `verdict-manifest` congelado y la clasificación P-I §10.5.1; las etiquetas/anclajes no se redefinen después de observar la corrida. `verdict-engine` aplica la tabla y `EXPERIMENT_AUDITOR` aprueba la emisión final.

### 16.1 Pedagógico

- `fuerte`: A/B/C tienen clase `FAVORABLE`, no existe covariación invalidante, `TRANSFER_MEASUREMENT` cumple su anclaje favorable CAL-15 y la retención evaluada cumple su anclaje favorable CAL-15;
- `parcial`: al menos dos transiciones son `FAVORABLE`, pero la restante es `NO_FAVORABLE`/`NOT_INTERPRETABLE` o transferencia/retención no alcanza el soporte requerido para `fuerte`;
- `solo_asistido`: existe desempeño/dominio en `LEARNING_MODE`, pero menos de dos transiciones independientes resultan `FAVORABLE`;
- `negativo`: al menos dos transiciones son interpretables y `NO_FAVORABLE` bajo la tabla congelada;
- `no_interpretable`: quedan menos de dos transiciones interpretables o contaminación/fallo sistémico/pérdida de datos impide la inferencia.

Sin retención evaluable no puede emitirse `fuerte` y se añade `retention_not_evaluated`.

### 16.2 Autonomía

- `completa_dentro_del_alcance`;
- `completa_con_controles_automaticos`;
- `parcial_con_excepciones`;
- `fallida`;
- `contaminada_por_intervencion_humana`.

La asignación usa la matriz función × estado × criticidad. Un porcentaje global es descriptivo.

### 16.3 Integridad

- `valida`;
- `valida_con_desviaciones`;
- `con_reservas`;
- `invalida`.

### 16.4 Viabilidad

- `prometedora`;
- `costosa_pero_reducible`;
- `no_sostenible`;
- `no_evaluada`.

No se fijan thresholds inventados de costo, latencia, CPU/RAM o carga humana. Se usan los valores reales producidos por H8–H11.

### 16.5 Orden obligatorio de interpretación

**Integridad → Autonomía → Pedagógico → Viabilidad**. Un fallo sistémico de integridad puede volver no interpretables los demás; una intervención pedagógica prohibida afecta atribución de autonomía; una viabilidad negativa no borra aprendizaje válidamente observado.

## 17. Checklist de autorización final

Antes del primer participante real, confirmar:

- [ ] Documento Maestro vigente aceptado como única fuente normativa superior.
- [ ] No quedan referencias operativas a “Base v4” o “Plan técnico v2” como autoridades paralelas.
- [ ] `authorizedCalculusVersion = authorized-calculus-v1` implementada y H2 cerrado contra su snapshot/hash y contrato.
- [ ] Corpus autorizado y congelado.
- [ ] Mapa y bancos generados automáticamente.
- [ ] Política pedagógica, catálogo de estrategias y reglas de ayuda congelados.
- [ ] Separación `LEARNING_MODE`/`MEASUREMENT_MODE` probada.
- [ ] Regla de intentos elegibles para dominio probada.
- [ ] Auditoría previa aprobada.
- [ ] Verificador sin falsos positivos conocidos.
- [ ] Agente sin acceso a soluciones.
- [ ] Sondas aisladas.
- [ ] `TRANSFER_MASTERY` y `TRANSFER_MEASUREMENT` usan reservas/eventos distintos y pasaron pruebas de no reutilización/isomorfismo.
- [ ] Intervalo(s) de retención y reserva correspondiente congelados, o `retention_not_evaluated` declarado antes de la corrida.
- [ ] `metrics-manifest` y `verdict-manifest` congelados con los contratos de v2.10, CAL-15 cerrado y sin cambios post hoc.
- [ ] Matriz de permisos runtime y pruebas negativas críticas aprobadas.
- [ ] `evidence` rechaza `UPDATE`/`DELETE` con credenciales runtime.
- [ ] Cadena/checkpoint del ledger verificados.
- [ ] Benchmark del modelo aprobado.
- [ ] Partición desarrollo/evaluación del benchmark no contaminada y `model_binding` congelado.
- [ ] Tabla de capacidades del modelo probada contra parámetros soportados.
- [ ] Sesión seca sin docente completada.
- [ ] Consentimiento y aviso listos.
- [ ] Apelación y retirada funcionan.
- [ ] Respaldo restaurado en prueba.
- [ ] Restore drill limpio verifica manifest, ledger, proyecciones y grants.
- [ ] Puertas multimodales H8 aprobadas si la corrida habilita voz/visión.
- [ ] Línea base de accesibilidad H8 documentada sin afirmar conformidad global no auditada.
- [ ] Calendario y análisis congelados.
- [ ] Responsables y contactos definidos.
- [ ] Cada gate/acción irreversible declara `responsible_role` y `approver_role`.
- [ ] No hay incidentes sistémicos abiertos.

---

## 18. Regla para cualquier decisión no prevista

Ante una situación no contemplada, elegir la acción que preserve en este orden:

1. seguridad y derechos del participante;
2. integridad de la evidencia;
3. separación entre enseñanza y auditoría;
4. autonomía real del Profesor IA;
5. continuidad operativa.

Si proteger seguridad exige intervención humana, se interviene y se registra. La validez experimental nunca está por encima del participante.

---

**Fin de la Parte III — protocolo operativo vigente de la Etapa 1.**


---

# Registro de cambios v2.10 respecto de v2.9 — no normativo

1. **Fundamentos:** KC01/KC02/KC08 pasan a fase pre-SCED enseñada por Profesor IA y quedan fuera de A/B/C como objetivos experimentales.
2. **SCED:** se define `probe_round`, `probe_opportunity`, microbatería, conteo de rondas válidas y efecto de invalidaciones; tamaño/umbral se fijan en H5 sin inventar valores.
3. **Retención:** unidad fijada por conjunto desde `set_mastery_timestamp`; la retención queda fuera del contador SCED.
4. **Autoridad de medición:** `measurement-worker` obtiene autoridad exclusiva sobre reserva/ítem/semilla/tiempo/consumo/validez operacional durante `MEASUREMENT_MODE`.
5. **Ayudas y dominio:** `masteryDisqualifying` se recalcula por código y se programa reconfirmación post-dominio.
6. **Fallos:** se separan causas `PEDAGOGICO`, `OPERACIONAL` e `INTERFAZ_PERCEPCION`; una caída técnica no se interpreta como no aprendizaje.
7. **Complejidad:** CAL-09 se adelanta a H5 para el freeze inicial; H10 solo puede informar versiones futuras.
8. **Veredictos:** se define clasificación de transiciones, `verdict-engine`, autoridad de `EXPERIMENT_AUDITOR` y CAL-15 pre-H11.
9. **Roles:** se congela incompatibilidad mínima productor/aprobador y mínimo de dos personas distintas para H11, con competencia profesional adicional cuando corresponda.
10. **Exposición:** se define taxonomía de autoestudio/exposición externa y efectos de validez, incluido techo/suelo.
11. **Sondas:** se especifican pausa, duda, timeout, incidente, fin de sesión y retirada dentro de `MEASUREMENT_MODE`.
12. **Respuestas libres:** quedan excluidas de la medida primaria pedagógica de Etapa 1.
13. **Mapa KC:** KC12→KC10 se normaliza a `POLITICA_CONTENIDO` y el validador distingue esa arista de `FORMAL`.
14. **Recuperación:** el máximo de dos episodios posteriores se fija por KC.
15. **Corpus/W0:** rechazo vuelve a W0; agotamiento de candidatos autorizables falla H4.5; Calgary/cálculo ancla no se contabilizan como autonomía W0.
16. **Familias:** `item_family_id` recibe una definición inmutable previa a auditoría.
17. **Idioma:** operación en español, fuentes multilingües con traducción/proveniencia trazable y NLI translingüe condicionado a calibración.
18. **Gates:** H5 y H10 se actualizan para cerrar explícitamente los nuevos contratos sin anticipar resultados empíricos.

---

# Registro de cambios v2.9 respecto de v2.8 — no normativo

1. **Cálculo autorizado:** se cerró CALC-01/CALC-02 y se incorporó `authorized-calculus-v1`, `forallx-calgary-tfl`, snapshot Fall 2025/rev `8642250`, hash, reglas, sintaxis, semántica, lexicón, códigos de error y una única versión para los tres conjuntos.
2. **Mapa KC:** KC10 se normalizó a `¬E`; KC12 recibió política de contenido `⊥`-libre en premisas/supuestos iniciales; KC15 dejó de ser condicional; KC16/DNE y KC17/IP adquirieron su estatus exacto.
3. **SCED:** se congelaron ventanas A/B/C, separación mínima, estabilidad, extensión, complemento Tau-U, diagnóstico de autocorrelación, reglas de faltantes, covariación e interpretabilidad.
4. **Métricas:** se cerraron contratos de falso dominio, dependencia de pistas, tiempo a dominio, transferencia y retención; se eliminó la posibilidad de crear un `phase_change` escalar post hoc.
5. **Veredictos:** se incorporó la tabla normativa de Pedagogía/Autonomía/Integridad/Viabilidad y se preservó el orden Integridad → Autonomía → Pedagogía → Viabilidad.
6. **Retención:** se fijó 7 días calendario con reserva independiente y `retention_not_evaluated` cuando no exista medición válida.
7. **Seguridad/recuperación:** se congeló objetivo lógico de pérdida aceptable 0 para transiciones confirmadas y checkpoints mínimos; RTO y desempeño real permanecen para H10.
8. **Criticidad y gobernanza:** se clasificaron funciones por consecuencia de fallo y se asignaron `responsible_role`/`approver_role` a gates irreversibles; IA excluida de aprobación.
9. **Licencias:** Calgary queda utilizable como fuente documental del cálculo, pero material “used with permission” permanece excluido de reutilización expresiva hasta proveniencia/revisión aplicable.
10. **Dependencias/proveedores:** se congeló el contrato lockfile+SBOM y el contrato `model_binding`+`ModelCapabilities`; el snapshot factual de candidatos se fechó 2026-08-13 sin seleccionar ganadores.
11. **Pendientes:** se retiraron del cuerpo los pendientes A/B ya cerrados. Los puntos de construcción/benchmark/calibración, revisión profesional, Etapa 2 y Producto se consolidaron en los estados permitidos y en el Apéndice E.
12. **Limpieza documental:** se eliminó el bloque repetitivo de registros v2.3–v2.8 para evitar que pendientes históricos ya resueltos compitan con la especificación vigente. El historial v3→v4 se conserva como antecedente no normativo.

# Apéndice histórico — Registro de cambios v3 → v4 (no normativo)

**Fecha:** agosto de 2026.  
**Finalidad:** documentar por qué la base v3 dejó de representar la intención original y cómo se corrigió.

---

## 1. Motivo del cambio

La intención original era construir un Profesor IA con la mayor autonomía posible, reduciendo al mínimo la intervención de un docente humano, para observar qué puede sustituir y dónde falla.

La base v3 evolucionó hacia un tutor fuertemente supervisado:

- el docente entregaba el mapa;
- escribía y calibraba bancos;
- aprobaba plantillas;
- calificaba el censo de actos;
- atendía excepciones pedagógicas;
- la viabilidad se juzgaba desde el principio por ahorro de tiempo.

Ese diseño podía ser prudente como producto, pero no respondía limpiamente a la pregunta de techo.

La v4 restablece la dirección original.

---

## 2. Documentos reemplazados

Quedan sustituidos como especificación vigente:

1. *Profesor IA — Base funcional consolidada v3*.
2. *Profesor IA — Alcance, autonomía y validez de la Etapa 1*.
3. *Profesor IA — Tres planes de implementación de la Etapa 1*.
4. *Profesor IA — Tres planes de implementación para la Etapa 1*.

Se conservan únicamente como antecedentes.

---

## 3. Documentos nuevos

1. **Base funcional consolidada v4:** autoridad funcional y metodológica.
2. **Plan técnico unificado v2:** arquitectura y construcción.
3. **Protocolo operativo de la Etapa 1 v1:** ejecución, umbrales y checklists.
4. **Este registro:** trazabilidad de decisiones.

---

## 4. Cambios por tema

### 4.1 Propósito

**Antes:** demostrar viabilidad de un tutor IA supervisado.  
**Ahora:** medir el techo de sustitución funcional del docente.

### 4.2 Papel del humano

**Antes:** autor, aprobador, calificador y operador por excepción.  
**Ahora:** define el sobre, protege al participante, audita después y corrige entre versiones.

### 4.3 Autoría

**Antes:** mapa, bancos y paralelos escritos por el docente.  
**Ahora:** pipeline de agentes y código genera objetivos, mapa, bancos, pistas, rúbricas y sesiones.

### 4.4 Material fuente

**Se conserva:** debe ser externo, fijo, versionado y autorizado.

**Aclaración:** el humano puede elegir o autorizar el corpus, pero no tiene que redactarlo.

### 4.5 Evaluación

**Se conserva:** el modelo generativo no decide la corrección formal.

**Se refuerza:** verificador aislado, oráculo semántico, proof search y separación de soluciones.

### 4.6 Auditoría

**Antes:** censo humano del 100 % de todos los actos calificables.  
**Ahora:** censo del 100 % de resultados primarios y críticos; muestra estratificada del resto.

### 4.7 Fallo pedagógico

**Antes:** podía escalar al docente.  
**Ahora:** se declara límite del sistema; el humano no completa la clase experimental.

### 4.8 Carga humana

**Antes:** podía declarar inviable toda la etapa.  
**Ahora:** se separan veredictos pedagógico, de autonomía, integridad y viabilidad.

### 4.9 Diseño experimental

**Se conserva:** línea base múltiple concurrente con sondas entre tres conjuntos.

**Se separa:** la calidad de autoría autónoma se analiza como estudio secundario, no mezclada con el efecto de aprendizaje.

### 4.10 Producto futuro

**Antes:** el diseño de producto condicionaba la prueba.  
**Ahora:** primero se mide el techo; después se decide si el producto será profesor autónomo limitado, tutor supervisado o copiloto docente.

---

## 5. Elementos de v3 que se conservaron

- piloto n=1;
- alumno adulto;
- texto canónico como base, con multimodalidad subordinada al estado estructurado;
- deducción natural proposicional;
- mapa de KC;
- tres correctas y una de transferencia;
- estado estructurado;
- bitácora append-only y verificable;
- separación de privilegios;
- verificador determinista;
- sondas sin asistencia;
- línea base múltiple;
- preinscripción y freeze;
- identidad seudónima;
- consentimiento;
- invalidación localizada;
- derecho de apelación;
- límites de afirmación.

---

## 6. Elementos que se eliminaron o movieron

### Eliminados de la Etapa 1

- autoría manual obligatoria del docente;
- aprobación humana reactivo por reactivo;
- rescate pedagógico en vivo;
- censo de toda práctica;
- regla de ahorro como criterio único de muerte;
- afirmación de que el sistema no intenta sustituir funciones docentes.

### Movidos a etapa de producto

- ahorro neto de tiempo como requisito;
- integración institucional;
- calificación oficial;
- LTI;
- escalamiento poblacional;
- definición del nivel definitivo de supervisión.

---

## 7. Correcciones a afirmaciones del documento de alcance

El documento de alcance iba en la dirección correcta, pero se ajustaron cuatro puntos:

1. **Dificultad:** el código estima complejidad estructural; no prueba equivalencia psicométrica completa.
2. **Resultado externo:** las sondas reducen el círculo, pero también requieren reservas, freeze y auditoría.
3. **Etapas 1a/1b:** se reemplazaron por fase de calibración y piloto autónomo; la comparación de autoría queda como estudio secundario.
4. **Clase humana paralela:** se permite contacto humano para derechos y seguridad, no enseñanza simultánea de los mismos KC.

---

## 8. Regla de interpretación futura

Cuando haya tensión entre seguridad y autonomía:

- se protege primero al participante;
- la intervención se registra;
- el resultado puede perder validez, pero no se oculta;
- no se reduce previamente la autonomía solo por temor a que falle.

---

## 9. Resultado de la consolidación

La documentación ahora responde a una única intención:

> Construir la versión más autónoma que pueda probarse responsablemente, medir qué funciones docentes sustituye y usar los fallos reales para diseñar después una versión práctica.

---

**Fin del registro de cambios.**


---

# Apéndice A — Registro consolidado de decisiones y estado

Este apéndice es el inventario de **estado**, no una segunda definición normativa. El cuerpo del Maestro define el contenido. Cada decisión relevante usa exactamente uno de los seis estados permitidos.

## A.1 `CONGELADA`

- `DEC-AUTONOMY-001` — sustitución funcional del docente en operación ordinaria; humano fuera del circuito pedagógico.
- `DEC-SCED-001` — Etapa 1 n=1, adulto, línea base múltiple concurrente con sondas múltiples entre tres conjuntos.
- `DEC-NORESCUE-001` — no rescate pedagógico humano durante sesión válida.
- `DEC-MODES-001` — separación `LEARNING_MODE` / `MEASUREMENT_MODE`.
- `DEC-AUTHORITY-001` — IA prepara/enseña dentro de contratos; código decide lo verificable; humano autoriza/audita desde fuera.
- `DEC-ARCH-001` — monolito modular, siete esquemas PostgreSQL, local-first.
- `DEC-CALCULUS-001` — `formal_system_id=forallx-calgary-tfl`, `authorizedCalculusVersion=authorized-calculus-v1`.
- `DEC-CALCULUS-SNAPSHOT-001` — Fall 2025, rev `8642250`, 2026-07-18, SHA-256 `2a8fea85b358fb45ba7835dee5166b5990b7a7c11ad4dc6c41ebdd9a265c1888`.
- `DEC-CALCULUS-RULES-001` — primitivas `R,∧I,∧E,∨I,∨E,→I,→E,↔I,↔E,¬I,¬E,X,IP`; derivada autorizada `DNE`; whitelist cerrada.
- `DEC-CALCULUS-SEMANTICS-001` — semántica clásica bivalente con `v(⊥)=F`; éxito semántico no certifica derivabilidad.
- `DEC-CALCULUS-SETS-001` — los tres conjuntos comparten la misma versión; sin rule-gating por conjunto/fase.
- `DEC-KC-001` — dependencias KC tipadas; mapa por corrida como hipótesis falsable.
- `DEC-KC-CORRECTIONS-001` — KC10=`¬E`; KC12→KC10=`POLITICA_CONTENIDO` por política `⊥`-libre; KC15 `↔E`; KC16 DNE derivada; KC17 IP primitiva.
- `DEC-LEXICON-001` — lexicón español canónico separado de ids formales.
- `DEC-PROOF-001` — buscador heurístico → certificado → `logic-core`; `search_budget_exhausted` no implica inexistencia.
- `DEC-TRANSFER-001` — transferencia cercana; reservas separadas `TRANSFER_MASTERY`/`TRANSFER_MEASUREMENT`.
- `DEC-RETENTION-001` — retención primaria por conjunto a 7 días desde `set_mastery_timestamp`, reserva independiente; ausencia válida = `retention_not_evaluated`.
- `DEC-BASELINE-001` — ventanas A `6–8`, B `9–11`, C `12–14` sobre `probe_round` global válida, separación 3, estabilidad y extensión 2 dentro de ventana.
- `DEC-SCED-ANALYSIS-001` — análisis visual primario + Tau-U descriptivo; faltantes no imputados; interpretabilidad mínima preinscrita.
- `DEC-METRICS-001` — contratos de `probe_accuracy`, falso dominio, dependencia de pistas, tiempo a dominio, transferencia y retención; sin escalar `phase_change`.
- `DEC-VERDICTS-001` — tabla de veredictos congelada y orden Integridad→Autonomía→Pedagogía→Viabilidad.
- `DEC-RECOVERY-001` — transición irreversible confirmada requiere durabilidad/evento; objetivo lógico de pérdida aceptable 0; checkpoints mínimos.
- `DEC-CRITICALITY-001` — criticidad por función y efecto de fallo según §5.6.1.
- `DEC-GOVERNANCE-ROLES-001` — roles canónicos y aprobadores de H2/H4/H5/H9/H10/H11/W13; IA no aprueba; mínimo dos personas naturales distintas para H11 y separación productor/aprobador.
- `DEC-FOUNDATION-001` — KC01/KC02/KC08 son fundamentos pre-SCED, enseñados por Profesor IA y excluidos como objetivos A/B/C.
- `DEC-PROBE-ROUND-001` — `probe_round` global como unidad de calendario SCED; microbatería/validez se fija en H5.
- `DEC-RETENTION-UNIT-001` — retención por conjunto a 7 días desde `set_mastery_timestamp`; no cuenta como ronda SCED.
- `DEC-MEAS-AUTHORITY-001` — `measurement-worker` tiene autoridad exclusiva sobre reserva/ítem/semilla/tiempo/consumo/validez operacional en `MEASUREMENT_MODE`.
- `DEC-HINT-AUTHORITY-001` — `masteryDisqualifying` se deriva por código; niveles 2–5 descalifican y nivel 1 solo puede no descalificar bajo la regla cerrada.
- `DEC-FAILURE-ATTRIBUTION-001` — separación `PEDAGOGICO`/`OPERACIONAL`/`INTERFAZ_PERCEPCION`; fallo técnico no equivale a no aprendizaje.
- `DEC-VERDICT-AUTHORITY-001` — `verdict-engine` determinista + aprobación `EXPERIMENT_AUDITOR`; anclajes CAL-15 pre-H11.
- `DEC-EXPOSURE-001` — taxonomía y efecto de exposición externa/autoestudio + reglas de techo/suelo.
- `DEC-MEAS-INTERRUPTION-001` — semántica de pausa/duda/timeout/incidente/retirada durante sondas.
- `DEC-FREE-RESPONSE-001` — respuesta libre nunca es medida primaria pedagógica en Etapa 1.
- `DEC-KC-POLICY-EDGE-001` — KC12→KC10 es `POLITICA_CONTENIDO`, no `FORMAL`.
- `DEC-RECOVERY-SCOPE-001` — dos episodios posteriores de recuperación como máximo por KC.
- `DEC-FAMILY-001` — `item_family_id` inmutable y pertenencia por plantilla+función+KC+firma estructural.
- `DEC-LANGUAGE-001` — operación en español con trazabilidad translingüe de fuentes y NLI condicionado a CAL-NLI.
- `DEC-FALSE-MASTERY-SCHEDULE-001` — cada dominio crea reconfirmación posterior pendiente; ausencia válida es faltante.
- `DEC-W0-SCOPE-001` — cálculo/ancla Calgary pertenecen al sobre congelado y no cuentan como autonomía W0.
- `DEC-CORPUS-001` — W0 propone, humano autoriza/rechaza, rechazo vuelve a W0 y W1 ingiere solo snapshot/hash autorizado.
- `DEC-LICENSE-CONSERVATIVE-001` — material `LICENSE_UNRESOLVED` no se reutiliza expresivamente.
- `DEC-DEPENDENCY-FREEZE-001` — autoridad de dependencias = lockfile+SBOM+digests del freeze.
- `DEC-MODEL-BINDING-001` — cada candidato externo requiere `model_binding` y `ModelCapabilities` fechados/reverificados.
- `DEC-BKT-001` — BKT, si existe, solo sombra no autoritativa.
- `DEC-WHITEBOARD-001` — Excalidraw detrás de adaptador + overlay SVG propio.
- `DEC-VOICE-001` — texto/transcript final canónico precede decisiones; TTS/STT no reciben autoridad formal.
- `DEC-VISION-001` — visión/percepción nunca emite por sí sola veredicto formal.
- `DEC-LEDGER-001` — evidencia append-only para runtime, correcciones por eventos y checkpoints.
- `DEC-PRIVILEGE-001` — mínimo privilegio y separación de soluciones/medición.
- `DEC-HOSTING-001` — hosting no es requisito científico; decisión remota derivada de H8/modo de participación.
- `DEC-COST-001` — costos históricos desde `pricing-manifest`+`cost-ledger`, no cifra global fija.
- `DEC-AUTONOMY-METRIC-001` — matriz función×estado×criticidad como salida primaria.
- `DEC-HUMANLOAD-001` — carga humana separada fija/marginal y observada/estimada.
- `DEC-LEGAL-ARTIFACTS-001` — aviso de privacidad y consentimiento son artefactos distintos; seguridad/privacidad/derechos pueden detener sin rescate pedagógico.
- `DEC-OWNER-CONSTRAINTS-001` — entorno local, costo bajo, alta autonomía de desarrollo, sin GPU/hosting en plan base y revisión de gasto >MXN 700 quedan como restricciones post-cuestionario; mediciones posteriores conservan autoridad técnica.
- `DEC-LOCAL-SELF-USE-001` — la auto-prueba local del desarrollador es funcional y no equivale a H11 formal.
- `DEC-CUSTOM-COURSES-001` — materias personalizadas permitidas como `CUSTOM_COURSE_UNVALIDATED`, separadas del curso experimental validado de lógica.
- `DEC-UX-FUNCTIONAL-001` — navegación funcional mínima Inicio/Materias/Crear/Clase/Progreso/Investigación/Configuración; el diseño visual fino se delega al artefacto UX/UI subordinado.
- `DEC-UX-ARTIFACT-001` — `Profesor IA — Especificación UI/UX v0.1` reconocida como especificación visual subordinada para la fase pre-Plan; su autoridad se limita a presentación, interacción y navegación fina y no puede modificar decisiones normativas superiores.

## A.2 `CONDICIONADA A BENCHMARK`

- `BENCH-MODEL-SESSION` — ganador del modelo de sesión.
- `BENCH-MODEL-AUTHOR` — modelo/par de autoría y crítica.
- `BENCH-TTS` — proveedor/modelo TTS.
- `BENCH-STT` — proveedor/modelo STT.
- `BENCH-VISION` — modelo visual/fallback.
- `BENCH-PROOF-ORDER` — orden `prefiltro_semántico ↔ proof_search`.
- `BENCH-CALCULUS-COST` — cambio de `proof_line_count` solo si L0 demuestra necesidad.
- `BENCH-HOSTING-SIZE` — necesidad/sizing remoto desde H8.
- `BENCH-LOCAL-B` — Perfil B/Qwen3-14B después de la primera corrida Perfil A.
- `BENCH-GPU` — compra/modelo de GPU futura solo tras Perfil B/TCO.

## A.3 `CALIBRABLE`

Estos parámetros/validaciones se fijan únicamente en el gate indicado y no son constantes científicas:

- `CAL-COMPLETENESS-V1` — habilitación de `no_proof_exists_in_calculus`; H2.
- `CAL-SAT-ROUTE` — cota tabla de verdad↔SAT, motor y versión; H2.
- `CAL-GOLDEN-LOGIC` — tamaños/suficiencia de golden set, PBT y mutation; H2.
- `CAL-PROOF-BUDGET` — nodos/estados/profundidad/`k`/podas/timeout; H2/H5.
- `CAL-BANK-KC` — pisos reales de banco/reserva/regeneración; H5.
- `CAL-AUDIT-PRE` — auditoría previa; H5.
- `CAL-AUDIT-POST` — muestreo posterior/codebook/segunda evaluación; H10/pre-H11.
- `CAL-BENCH-GATES` — tamaños/repeticiones/denominadores finales del benchmark; antes de evaluación.
- `CAL-SOURCE-SCORE` y `CAL-SATURATION` — idoneidad/saturación W0; H4.5.
- `CAL-NLI` — fiabilidad NLI por estrato; H5.
- `CAL-ISOMORPHISM` — precisión/recall y tolerancias; H5/H10.
- `CAL-COMPLEXITY` — pesos/criterio de comparabilidad estructural iniciales obligatorios en H5; H10 solo valida sensibilidad para corridas futuras.
- `CAL-WHEEL` — umbral de `wheel_spinning`; H6/H10.
- `CAL-BKT` — parámetros de BKT sombra si se habilita.
- `CAL-MULTIMODAL` — error/abstención/latencia/costo de STT/TTS/visión; H8/H10.
- `CAL-SECURITY-RTO` — RTO observado, rendimiento de backup, recursos, rate/upload/Compose/rootless/recuperación; H8/H10.
- `CAL-RETENTION-BANK` — suficiencia real de banco/calendario para 7 días sin reutilización; H5/H10.
- `CAL-HUMANLOAD` — carga humana efectiva fija/marginal; H8–H11.
- `CAL-TRANSFER-ISOLATION` — prueba de aislamiento físico/isomórfico de reservas; H5/H10.
- `CAL-DOMAIN-POLICY` — prueba/calibración de la regla vigente de dominio; H6/H10.
- `CAL-FAMILIARIZATION` — suficiencia efectiva de familiarización; H8.
- `CAL-VERDICT-ANCHORS` — anclajes operativos de las dimensiones visuales y criterios favorable/no_favorable para transferencia/retención; H10/pre-H11, sin datos del participante.
- `CAL-FRAGMENT` — caracterización de fragmentos sin IP solo si alguna futura configuración los activa.
- `CAL-DECIDER-EXTERNAL` — ruta G4ip/G3cp solo si se activa y demuestra correspondencia/licencia.

## A.4 `PENDIENTE DE VERIFICACIÓN EXTERNA/PROFESIONAL`

- `LIC-01` — falta mapa primario suficientemente granular del material “used with permission” de Calgary; hasta entonces `LICENSE_UNRESOLVED`.
- `EXT-01` — versión/licencia/advisories del árbol real de dependencias; se verifica desde lockfile/SBOM en cada freeze.
- `EXT-03` — políticas reales de datos por cuenta/plan/endpoint/configuración/contrato; H9.
- `LIC-02` — conclusión jurídica sobre material ambiguo/permission; antes de reutilizarlo.
- `LEG-01` — encargado vs transferencia, DPA, subencargados y rol jurídico del flujo; revisión profesional H9/H11.
- `LEG-02` — aplicabilidad/armonización LFPDPPP 2025 + Reglamento 2011 y procedimientos/plazos; revisión profesional H9/H11.
- `ETH-01` — si contexto institucional/reclutamiento/publicación exige comité/revisión ética; antes de H11 si aplica.
- `ACC-01` — obligaciones jurídicas mexicanas concretas de accesibilidad; H9/H11 según alcance.
- `SRC-REFRESH` — cualquier referencia adicional que se pretenda elevar a autoridad normativa debe verificarse en fuente primaria antes de usarla.

## A.5 `DIFERIDA A ETAPA 2`

- `E-01` — diseño de replicación, simulación/potencia y N; solo después de Etapa 1 interpretable.
- `E-02` — comparación con enseñanza humana como estudio separado.
- alta disponibilidad/infra gestionada solo si la nueva etapa realmente la exige por escala; no se presupone desde Etapa 1.

## A.6 `DIFERIDA A PRODUCTO`

- `F-01` — web pública vs PWA vs desktop, lenguaje visual/navegación final.
- `F-02` — captura externa, conservación de audio bruto y posible migración a tldraw.
- `F-03` — operación comercial, observabilidad/HA de producto y métricas de adquisición/conversión.
- `F-04` — compra/modelo de GPU futura cuando no forme parte de un benchmark técnico autorizado.
- `F-05` — despliegue amplio y comercialización.

# Apéndice B — Presupuesto por fases

## B.1 Fase local actual

| Concepto | Pago obligatorio ahora |
|---|---:|
| PC existente | 0 |
| Docker / PostgreSQL / Node / herramientas OSS | 0 |
| Hosting | 0 |
| Dominio | 0 |
| Almacenamiento cloud | 0 |
| Observabilidad de pago | 0 |
| Correo transaccional | 0 |
| GPU nueva | 0 |
| APIs de modelos (LLM/visión) | Variable |
| API TTS | Variable, solo uso |
| API STT | Variable, solo uso |

No se mantiene una estimación global heredada como presupuesto operativo. El gasto se reconstruye desde el `cost-ledger` usando el `pricing-manifest` vigente de cada llamada y se agrega por benchmark, autoría, sesión, STT/TTS/visión, auditoría y fallos/reintentos.

Antes de ejecutar cada hito se fija un tope de gasto con datos observados de la etapa anterior. Las tarifas puntuales de agosto de 2026 son evidencia temporal para planear, no una cifra normativa del Maestro.

Objetivo financiero: **no convertir costos futuros de comercialización/operación en barrera para comprobar la hipótesis funcional, sin ocultar el costo real de la autonomía.**

## B.2 Fase de piloto formal

No se presupuestará de forma vinculante hasta H8.

Si se requiere acceso remoto, la arquitectura prevista conserva:

- Hetzner;
- PostgreSQL autoalojado;
- backups externos separados;
- observabilidad según necesidad;
- dominio/TLS;
- revisión jurídica.

Los precios se cotizan nuevamente en ese momento.

---

# Apéndice C — Fuentes verificadas y notas de investigación

Verificación base realizada el 7 de agosto de 2026; actualizaciones incorporadas hasta el 13 de agosto de 2026. Los datos externos son snapshots fechados y deben refrescarse en su gate cuando el Maestro lo exija.

## C.1 Fuentes educativas

- **Open Logic Project:** contenido del sitio, salvo indicación contraria, CC BY 4.0; la licencia global no sustituye la comprobación del recurso concreto.  
  Fuente: https://openlogicproject.org/olp-license/
- **forall x: Calgary:** la obra se declara CC BY 4.0, pero sus créditos identifican material de *forall x: Lorain County Remix* y *A Modal Logic Primer* como **used with permission**. Profesor IA no presume que ese permiso de terceros se transmita: W0 delimita secciones/componentes y bloquea lo dudoso hasta revisión.  
  Fuente: https://forallx.openlogicproject.org/html/
- **MIT OpenCourseWare:** CC BY-NC-SA 4.0 bajo sus términos de uso.  
  Fuente: https://ocw.mit.edu/pages/privacy-and-terms-of-use/
- **OpenStax:** en abril de 2026 comunicó transición de su biblioteca hacia CC BY-NC-SA para títulos nuevos/actualizados, con excepciones; verificar siempre cada título/versión.  
  Fuente: https://openstax.org/blog/openstax-licensing

## C.2 Referencias metodológicas

- Cemri et al. (2025), *Why Do Multi-Agent LLM Systems Fail?*, arXiv:2503.13657. La evidencia respalda cautela frente a complejidad multiagente; no demuestra que todo multiagente sea inferior.
- Rashkin et al. (2023), *Measuring Attribution in Natural Language Generation Models*, Computational Linguistics 49(4). AIS es un marco de evaluación de atribución; no convierte automáticamente un clasificador NLI en verificador formal.
- Liang, Wu, Huang y Giles (2015), *Measuring Prerequisite Relations Among Concepts*, EMNLP. Se usa como antecedente de inducción de prerrequisitos, no como autoridad pedagógica automática.
- CRAAP/SIFT se usan como inspiración para operacionalizar revisión de fuentes; el score numérico es una heurística propia de Profesor IA.
- La saturación de cobertura es una regla de ingeniería inspirada en prácticas de investigación, cuyos parámetros deben calibrarse.

## C.3 Investigación pedagógica incorporada en v2.2

La normalización v2.2 tomó como insumos internos:

- *Investigación — Estrategias Pedagógicas para el Profesor IA*;
- *Especificación de Ingeniería Pedagógica — Motor Pedagógico del Profesor IA (Etapa 1: Deducción Natural)*.

Se incorporaron únicamente recomendaciones compatibles con el Maestro: política jerárquica y auditable, ejemplos trabajados, *fading/scaffolding* contingentes, autoexplicación selectiva, *retrieval/spacing* controlados, feedback de tarea, separación aprendizaje/medición, señal de `wheel_spinning` sin rescate docente y BKT solo como métrica sombra.

No se importaron como autoridad las cifras cuantitativas de la segunda investigación porque el propio documento declara pendiente su verificación primaria. Tampoco se adoptó su propuesta de escalar a un docente, usar un grupo de comparación en Etapa 1 ni validar manualmente cada pista/reactivo, por contradecir decisiones vigentes del Maestro.

## C.4 Investigaciones de fundamentos normalizadas en v2.3

La normalización v2.3 evaluó dos insumos internos:

- *Profesor IA — Revisión de fundamentos: Knowledge Components, prerrequisitos, dificultad, isomorfismo y transferencia en deducción natural proposicional (Fitch)*;
- *Informe de Investigación 01 — Cálculo Lógico, Verificador y Proof Search en Deducción Natural*.

Del primer informe se incorporaron principalmente la separación de tipos de dependencia KC, las correcciones de KC13/KC15/KC16, la distinción `¬I`/`RAA`, el registro de KC de soporte, la noción de mapa falsable y una definición operacional de isomorfismo. Sus referencias bibliográficas se consideran **pendientes de verificación primaria final** porque el propio informe declara que no pudo verificarlas en vivo.

Del segundo informe se conservaron únicamente aportes compatibles y verificables por ingeniería: distinguir fallo de búsqueda de invalidez, benchmarkear el prefiltro semántico, evitar conteos exhaustivos de caminos y añadir mutation testing. No se importaron como autoridad sus umbrales numéricos ni afirmaciones sustentadas solo por fuentes secundarias, agregadores, blogs, foros o referencias cuya correspondencia bibliográfica sea dudosa.

## C.5 Auditoría del núcleo lógico incorporada en v2.4

La normalización v2.4 tomó como insumo principal *Investigación 01 — Cálculo lógico, verificador y proof search. Informe de auditoría y fortalecimiento para Profesor IA, Etapa 1* (12 de agosto de 2026), contrastándolo con el informe lógico anterior y con el Maestro v2.3.

Se verificaron externamente los fundamentos principales usados para los cambios:

- Roy Dyckhoff, *Contraction-free sequent calculi for intuitionistic logic*, JSL 57(3), 1992, junto con su corrección posterior de 2018: sustenta la disponibilidad de procedimientos terminantes para IPC, **sin** convertir automáticamente G4ip en decisor de cualquier fragmento Fitch arbitrario;
- Alekhnovich, Buss, Moran y Pitassi (2001), *Minimum propositional proof length is NP-hard to linearly approximate*: respalda la cautela contra afirmar minimalidad sin búsqueda exhaustiva apropiada;
- McConnell, Mehlhorn, Näher y Schweitzer (2011), *Certifying algorithms*: respalda el patrón de buscador heurístico que produce un certificado verificado por un checker independiente;
- documentación oficial de `fast-check`: `numRuns = 100` es un valor por defecto de herramienta y una interrupción del runner puede marcar éxito si no se configura para fallar; por ello no se convierte en umbral científico;
- documentación oficial de StrykerJS: existe runner oficial para Vitest y soporta gates de mutation score; el score se usa aquí solo como señal de no regresión calibrada;
- *forall x: Calgary*: licencia CC BY 4.0 verificada y fuente adecuada para fijar reglas/nomenclatura del corpus si W0 la autoriza.

La recomendación del informe de usar G4ip/G3cp como decisor se **estrechó**: `no_proof_exists_in_calculus` solo es vinculante si se demuestra que el decisor es sano y completo respecto de la versión exacta del cálculo autorizado. La recomendación de exigir un número fijo de soluciones alternativas tampoco se convirtió en constante; se adopta cobertura de falsos negativos y diversidad de soluciones como objetivo de validación.

La Investigación 03 de política pedagógica se releyó únicamente para comprobar consistencia. Sus aportes compatibles ya estaban cubiertos en v2.2/v2.3 (ayuda decisiva, wheel-spinning, BKT sombra, feedback de tarea, prerrequisitos, retrieval/spacing). No se adopta su escalamiento a docente ni su vía `5/6`, por contradecir decisiones normativas o reabrir parámetros sin necesidad.

## C.6 Investigaciones SCED, autoría/groundedness y auditoría normalizadas en v2.5

La v2.5 integró como insumos principales:

- *Investigación 04 — Diseño experimental SCED n=1 (Profesor IA)*;
- *Investigación 05 — Autoría autónoma, fuentes, groundedness y licencias*;
- *Investigación 06 — Auditoría, muestreo y umbrales de aceptación*.

El archivo adicional *Investigación 05 — Mejoras al sistema Profesor IA dentro del alcance del Documento Maestro v2.3* se utilizó únicamente como corroboración transversal. Sus recomendaciones sobre seguridad, modelos, voz, infraestructura u otros temas no se importaron aquí cuando reabrían áreas no relacionadas con las investigaciones 04–06.

Verificaciones externas realizadas el 12 de agosto de 2026 para los cambios de mayor consecuencia:

- What Works Clearinghouse mantiene documentación y herramientas vigentes de estándares single-case; sus materiales históricos establecen al menos tres demostraciones del efecto y cinco observaciones por fase para la categoría más fuerte, mientras el Maestro conserva sus mínimos como piso metodológico y declara reservas cuando no se cumplen;
- SCRIBE 2016 define una checklist de 26 ítems de reporte para estudios single-case; se adopta como checklist de transparencia, no como criterio de éxito;
- *forall x: Calgary* declara CC BY 4.0 para la obra y a la vez material de *forall x: Lorain County Remix* y *A Modal Logic Primer* “used with permission”; por ello v2.5 no presume sublicencia de esos componentes;
- Open Logic Project publica bajo CC BY 4.0 salvo indicación contraria; la verificación sigue siendo por recurso;
- Rashkin et al. (2023) proporciona el marco AIS de atribución a fuentes identificadas; se usa para operacionalizar la muestra dorada de `source_assertion`, no para dar autoridad al NLI;
- NIST documenta planes de muestreo de aceptación mediante `(n,c)`, curvas OC, AQL/LTPD y riesgos de productor/consumidor; se usa para caracterizar el riesgo del plan vigente, no para reemplazarlo;
- ISO 2859-1:2026 es la edición vigente de muestreo por atributos, pero no se copian sus tablas ni switching rules como norma automática de contenido educativo generado por IA.

No se importaron como hechos universales los valores propuestos para saturación, efecto SCED, acuerdo interevaluador, porcentajes de defectos ni número de auditores.

## C.7 Investigaciones de benchmark, multimodalidad y seguridad normalizadas en v2.6

La v2.6 integró como insumos principales:

- *Investigación 07 — Benchmark de LLM y reproducibilidad*;
- *Investigación 08 — Voz, visión, pizarrón, UX y accesibilidad*;
- *Investigación 09 — Seguridad, separación de privilegios y evidence-ledger*.

Las tres investigaciones respetan de forma explícita el alcance del Maestro y separan evidencia verificada, hipótesis de diseño y datos no verificados. Los cambios de mayor consecuencia se contrastaron nuevamente el 12 de agosto de 2026 con fuentes primarias/autoritativas:

- la documentación oficial de Anthropic confirma que Claude Sonnet 5 rechaza parámetros de muestreo no predeterminados y usa adaptive thinking por defecto; esto justifica una tabla de capacidades por binding, no un template universal de petición;
- la documentación oficial de OpenAI consultada el 12-08-2026 identifica **GPT-5.6 Sol** (`gpt-5.6-sol`, alias `gpt-5.6`) como modelo frontier disponible en API; por ello cualquier referencia operativa a GPT-5.4 queda histórica. La selección de Profesor IA continúa condicionada al benchmark y a H9, no a la recencia;
- la documentación oficial de Deepgram confirma keyterm prompting para Flux y soporte multilingüe, por lo que se adopta el léxico de sesión como capacidad de percepción condicionada al benchmark;
- W3C mantiene WCAG 2.2 como Recomendación publicada el 5 de octubre de 2023 y actualizada el 12 de diciembre de 2024; se usa para una línea base H8, **no** para declarar conformidad global;
- PostgreSQL documenta que superusuarios, roles `BYPASSRLS` y normalmente owners pueden eludir RLS; por ello RLS no sustituye separación de credenciales/esquemas;
- Docker documenta el riesgo del daemon/socket y mecanismos de mínimo privilegio como seccomp/rootless; se adoptan como hardening condicionado al entorno, sin migrar a Kubernetes;
- OWASP/NIST se usan como catálogos/metodología de verificación e incidentes, no como afirmaciones de certificación o cumplimiento integral.

Se preservaron como **pendientes o descartadas** las afirmaciones que los propios informes no verificaron suficientemente: licencia/condiciones futuras de tldraw, aplicabilidad jurídica concreta de accesibilidad en México, valores universales de RPO/RTO, backup/rotación, thresholds multimodales y cualquier superioridad de un modelo por mera recencia.

## C.8 Investigaciones de privacidad/legalidad, infraestructura/costos y autonomía normalizadas en v2.7

La v2.7 integró como insumos principales:

- *Investigación 10 — Privacidad, legalidad y ética del piloto (Etapa 1, n=1, México)*;
- *Investigación 11 — Infraestructura, costos, modelo local y GPU*;
- *Investigación 12 — Autonomía, interpretación del resultado, Etapa 2 y generalización*.

Se incorporaron únicamente aportes compatibles con el Maestro. Las comprobaciones de mayor consecuencia incluyen:

- la LFPDPPP mexicana vigente fue publicada el 20 de marzo de 2025 y su texto vigente consultado registra reforma del 14 de noviembre de 2025; la ley de 2010 y referencias operativas al INAI no se usan como base actual;
- la definición legal vigente distingue `encargado` y `transferencia`; por ello H9 clasifica cada flujo en vez de llamar transferencia a toda remisión a proveedor;
- la ley vigente contempla medidas de seguridad, notificación de vulneraciones, derechos de cancelación/oposición y tratamiento automatizado; el procedimiento concreto del piloto queda sujeto a revisión jurídica profesional;
- la Cámara de Diputados lista al Reglamento de la LFPDPPP de 2011 dentro de su compilación de reglamentos federales vigentes al 12-08-2026; **PENDIENTE DE VERIFICACIÓN EXTERNA/PROFESIONAL**: su armonización/aplicabilidad concreta bajo la Ley de 2025 y toda conclusión definitiva sobre el rol contractual del piloto;
- Docker documenta que los contenedores no reciben límites de recursos por defecto y ofrece métricas/controles para medirlos; por ello H8 instrumenta CPU, memoria, I/O, disco, DB, colas y latencia antes de dimensionar hosting;
- NVIDIA retiró en CUDA 13 el soporte de compilación offline para arquitecturas anteriores a Turing; la P100/Pascal se conserva únicamente como banco legado con toolchain CUDA 12.x compatible y fijado, no como plataforma objetivo;
- las políticas de ZDR/retención y funciones con almacenamiento varían por proveedor y producto; la elegibilidad se congela por función y no se presume a partir del nombre del proveedor;
- la literatura de factores humanos respalda tratar autonomía como multidimensional/por función; el Maestro conserva la matriz funcional como fuente primaria y degrada el porcentaje global a resumen secundario;
- para WWC, la documentación vigente consultada exige, para línea base múltiple/sondas múltiples sin reservas, **al menos seis fases con al menos cinco puntos por fase**. La afirmación de la Investigación 12 que atribuye al estándar “6 puntos en la primera línea base” no se importa: los 6 puntos del primer conjunto permanecen como parámetro interno más conservador de Profesor IA;
- la generalización a Etapa 2 no recibe un N universal. Una línea base múltiple replicada entre participantes es una opción compatible; cualquier cálculo de potencia, efecto mínimo detectable o comparación con enseñanza humana pertenece a una nueva preinscripción.

Fuentes primarias/autoritativas usadas para comprobar los cambios de v2.7:

- Cámara de Diputados — LFPDPPP vigente: https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf
- Cámara de Diputados — historial/reformas LFPDPPP: https://www.diputados.gob.mx/LeyesBiblio/ref/lfpdppp.htm
- Docker — resource constraints: https://docs.docker.com/engine/containers/resource_constraints/
- Docker — runtime metrics: https://docs.docker.com/engine/containers/runmetrics/
- NVIDIA — guía de soporte de arquitecturas CUDA: https://developer.nvidia.com/blog/navigating-gpu-architecture-support-a-guide-for-nvidia-cuda-developers/
- Anthropic — API and data retention: https://platform.claude.com/docs/en/manage-claude/api-and-data-retention
- Anthropic Privacy Center — alcance de ZDR: https://privacy.claude.com/en/articles/8956058-i-have-a-zero-data-retention-agreement-with-anthropic-what-products-does-it-apply-to
- Hetzner — Data Protection/DPA: https://docs.hetzner.com/general/company-and-policy/data-protection-at-hetzner/
- WWC — Single-Case Design Study Review Guide, estándar 5: https://ies.ed.gov/ncee/wwc/Docs/ReferenceResources/wwc_srg_scd_s5.xlsx
- Bradshaw et al. (2013), *The Seven Deadly Myths of “Autonomous Systems”*, IEEE Intelligent Systems, DOI 10.1109/MIS.2013.70.

No se importaron como normas científicas los precios actuales de APIs/hosting, una SKU de GPU/VPS, un RPO/RTO universal, una cifra fija de N para Etapa 2, niveles SAE de autonomía, un ECA como sustituto de Etapa 1 ni la idea de usar un LLM-juez como reemplazo del verificador determinista.

## C.9 Verificaciones externas de la auditoría final v2.8

La auditoría final del 12 de agosto de 2026 revalidó únicamente afirmaciones externas que podían haber cambiado y que afectaban decisiones operativas:

- OpenAI documenta **GPT-5.6 Sol** como modelo frontier de la familia GPT-5.6 y expone `gpt-5.6-sol`/`gpt-5.6`; los nombres concretos siguen siendo candidatos fechados y deben reverificarse al benchmark/freeze;
- Anthropic anunció **Claude Sonnet 5** el 30 de junio de 2026; se conserva como candidato de coste/rendimiento, sin afirmar que sea el modelo Anthropic de máxima capacidad;
- Node.js mantiene v24 “Krypton” en LTS al 12-08-2026; la rama exacta/parche se fija al crear/congelar el repositorio;
- Next.js publicó una actualización de seguridad en julio de 2026 y señala 16.2.11 como Active LTS en ese aviso; por ello `16.x` nunca basta como freeze: se exige versión exacta parcheada y revisión de advisories;
- la Cámara de Diputados registra la LFPDPPP publicada el 20-03-2025 con última reforma 14-11-2025 y lista el Reglamento de 2011 entre reglamentos federales vigentes; la aplicabilidad concreta al piloto y la armonización jurídica mantienen estado **PENDIENTE DE VERIFICACIÓN EXTERNA/PROFESIONAL**;
- OpenAI y Anthropic documentan políticas de retención/ZDR dependientes de producto, endpoint, configuración y acuerdo; por ello el nombre del proveedor nunca determina por sí solo elegibilidad de datos del participante.

Estas verificaciones **no convierten proveedor, modelo, versión o interpretación jurídica en decisión congelada permanente**. Se mantienen los gates de benchmark, seguridad, privacidad y revisión externa definidos en el cuerpo y en el Apéndice A.

## C.10 Cierre A/B y cálculo autorizado incorporados en v2.9

- *forall x: Calgary* / Open Logic Project: fuente primaria del sistema `forallx-calgary-tfl`; v2.9 congela edición Fall 2025, revisión `8642250` de 2026-07-18 y SHA-256 `2a8fea85b358fb45ba7835dee5166b5990b7a7c11ad4dc6c41ebdd9a265c1888` para `authorized-calculus-v1`.
- La misma fuente declara licencia global CC BY 4.0 y material de terceros “used with permission”; esta evidencia **no** resuelve proveniencia ejercicio-por-ejercicio. El material afectado permanece `LICENSE_UNRESOLVED` para reutilización expresiva.
- WWC Procedures and Standards Handbook 5.0 se conserva como referencia metodológica de revisión; SCRIBE 2016 como checklist de reporte; AIS como marco de atribuibilidad a fuentes; Liang et al. (2015) como antecedente de relaciones de prerrequisito, no como autoridad suficiente para imponer dependencias formales/pedagógicas.
- Snapshot factual de candidatos externos verificado por la investigación de cierre el 2026-08-13: `gpt-5.6-sol`/`gpt-5.6`, `claude-sonnet-5`, `flux-general-multi`, `eleven_flash_v2_5`, `gpt-4o-transcribe` y `gpt-4o-mini-transcribe`. Los bindings exactos se refrescan al benchmark/freeze y no representan ganadores.
- Las políticas públicas de retención/ZDR/logging cambian por proveedor, producto, endpoint, plan, configuración y contrato. Por eso EXT-03 se mantiene abierto hasta H9 sobre las cuentas reales.
- Dependencias exactas, licencias y advisories no se congelan desde una lista narrativa: EXT-01 se resuelve por freeze mediante lockfile+SBOM del árbol implementado.

## C.11 Regla de honestidad

Una referencia académica o licencia ayuda a diseñar el sistema, pero no reemplaza:

- benchmark;
- validación formal;
- auditoría;
- verificación de la versión exacta utilizada;
- revisión jurídica cuando exista duda.

---

# Apéndice D — Orden práctico inmediato

1. Aceptar v2.12 como especificación post-UI/pre-Plan; no reabrir decisiones técnicas ya congeladas salvo contradicción demostrable.
2. Aplicar y congelar las correcciones de conformidad de `Profesor IA — Especificación UI/UX v0.1`; las decisiones exclusivamente visuales quedan subordinadas a `DEC-UX-ARTIFACT-001` y no pueden alterar autoridad, privacidad, medición ni gates.
3. Generar `Plan.md` para ejecución altamente autónoma por Claude Code/Codex, con criterios verificables y presupuesto mínimo de intervención humana.
4. Crear/actualizar repositorios y CI; producir lockfile, SBOM/escaneo, reglas arquitectónicas y pruebas de drift.
5. Levantar H1/H3 en local con matriz de privilegios, denegaciones, secretos, egress y hardening compatible con el SO real.
6. Implementar H2 directamente contra `authorized-calculus-v1`; medir CALC-03/CALC-05/CAL-04/CAL-08 sin cambiar el cálculo congelado.
7. Implementar `model-gateway` con `model_binding`, `ModelCapabilities`, validación fail-closed y `pricing-manifest`/`cost-ledger`; refrescar candidatos y ejecutar BENCH-01/02.
8. Ejecutar W0/H4.5 usando `forallx-calgary-tfl` como sistema objetivo; mantener `LICENSE_UNRESOLVED` fuera de reutilización expresiva y calibrar score/saturación.
9. Autorizar corpus y ejecutar H5: mapa KC normalizado, bancos físicamente separados, isomorfismo, reservas de transferencia/retención y freeze.
10. Implementar H6/H7 con política pedagógica determinista, dominio, recuperación, no rescate y separación de modos.
11. Implementar la experiencia funcional de cursos persistentes y `CUSTOM_COURSE_UNVALIDATED` sin mezclar sus datos con la inferencia SCED de lógica.
12. Integrar multimodalidad y ejecutar H8 para medir STT/TTS/visión, accesibilidad, recursos, costos y familiarización; decidir infraestructura solo desde esa telemetría.
13. Ejecutar `LOCAL_SELF_USE` para comprobar flujo extremo a extremo en la PC del desarrollador; sus datos son funcionales/de desarrollo y no sustituyen H11.
14. Implementar ledger/checkpoints/restore y ejecutar H10 con fallos inyectados; medir RTO/recursos en vez de predecirlos.
15. Completar H9 con cuentas/contratos reales, EXT-03 y revisiones LIC-02/LEG-01/LEG-02/ETH-01/ACC-01 que resulten aplicables.
16. Congelar preinscripción ya especificada: ventanas SCED, estabilidad, Tau-U, métricas, veredictos, retención de 7 días y roles de aprobación.
17. Calibrar auditoría posterior, bancos, complejidad/isomorfismo, benchmarks y demás parámetros listados en Apéndice E.
18. Abrir H11 solo con gates aplicables en verde; interpretar Integridad → Autonomía → Pedagogía → Viabilidad.
19. Solo después de Etapa 1 interpretable considerar una Etapa 2 nueva; decisiones comerciales permanecen fuera de la inferencia experimental.

# Apéndice E — Pendientes deliberadamente abiertos

Este apéndice es la lista final de incertidumbres que **no deben cerrarse por escritura**. Para todo parámetro que requiere construcción se registra qué se medirá/verificará, hito, componente responsable y decisión que depende de ello.

## E.1 `PENDIENTE DE VERIFICACIÓN EXTERNA/PROFESIONAL`

| ID | Qué falta exactamente | Hito máximo | Responsable | Qué decisión/gate depende |
|---|---|---|---|---|
| LIC-01 | Correspondencia primaria granular de materiales “used with permission” con secciones/ejercicios del snapshot Calgary | W0/H5 | W0 + `CORPUS_APPROVER` | Qué componentes pueden reutilizarse expresivamente |
| EXT-01 | Lockfile/SBOM real, versiones, licencias y advisories de directas/transitivas | freeze de cada dependencia | CI/supply-chain + `TECHNICAL_AUDITOR` | Cierre de freeze técnico |
| EXT-03 | Cuenta/plan/endpoint/configuración/contrato reales: ZDR/MAM/ZRM, logging, retención, borrado y región | H9 | `SECURITY_PRIVACY_RESPONSIBLE` | Elegibilidad de cada proveedor para datos del participante |
| LIC-02 | Interpretación jurídica de material ambiguo/permiso no sublicenciable | antes de autorizar material afectado | `PROFESSIONAL_REVIEWER` | Reutilización del componente |
| LEG-01 | Rol jurídico del flujo, DPA, subencargados y remisión/transferencia | H9, antes de H11 | `PROFESSIONAL_REVIEWER` | Apertura legal del piloto |
| LEG-02 | Aplicabilidad/armonización LFPDPPP 2025 + Reglamento 2011, derechos/plazos/procedimientos | H9, antes de H11 | `PROFESSIONAL_REVIEWER` | Paquete de privacidad y H11 |
| ETH-01 | Si institución/reclutamiento/publicación exige comité o revisión ética y, si aplica, aprobación | antes de H11 | `EXPERIMENT_AUDITOR` + profesional/institución | Autorización de participante real |
| ACC-01 | Obligaciones jurídicas mexicanas concretas de accesibilidad | H9/H11 según alcance | `PROFESSIONAL_REVIEWER` | Requisitos legales adicionales; no sustituye baseline H8 |

## E.2 `CONDICIONADA A BENCHMARK`

| ID | Qué debe medirse/compararse | Hito | Componente responsable | Decisión dependiente |
|---|---|---|---|---|
| BENCH-01 | Fidelidad, schema, español, seguridad, latencia, estabilidad y costo observados de candidatos de sesión | H4/H8 | `model-gateway` + benchmark harness | Modelo/binding ganador de sesión |
| BENCH-02 | Calidad de autoría/crítica, defectos, concordancia y error correlacionado | H4/H5 | authoring workflow | Modelo/par de autoría y crítica |
| BENCH-03 | STT/TTS/visión: error por tarea, abstención, latencia, costo, privacidad y UX | H8 | `speech-gateway` / `visual-interaction` | Proveedores/capability flags multimodales |
| BENCH-04 | Desempeño y seguridad del orden `prefiltro_semántico ↔ proof_search` | H2/H5 | authoring validators / proof-search | Orden del pipeline de autoría |
| BENCH-05 | Calidad/TCO de Perfil B/Qwen3-14B frente a Perfil A | después de primera corrida Perfil A | `model-gateway` local benchmark | Activar o no Perfil B |
| CALC-06 | Efecto de `proof_line_count` sobre búsqueda/complejidad | L0/H2 si procede | `proof-search` | Mantener/cambiar métrica de costo |
| INFRA-01 | CPU/RAM/I/O/conexiones/jobs/latencia/costo reales y necesidad de acceso remoto | después de H8 | telemetry/ops | Si se requiere hosting y su tamaño |
| INFRA-02 | Compatibilidad/rendimiento de toolchain P100/CUDA/llama.cpp solo si se activa | cuando Perfil B/P100 se active | local inference harness | Uso del banco P100/toolchain |

## E.3 `CALIBRABLE`

| ID | Qué debe medirse/verificarse | Hito | Componente responsable | Decisión que depende |
|---|---|---|---|---|
| CALC-03 | Correspondencia de completitud/sanidad del inventario implementado para habilitar un decisor terminante | H2 | `logic-core` + `TECHNICAL_AUDITOR` | Si puede activarse `no_proof_exists_in_calculus` |
| CALC-04 | Propiedades exactas del fragmento sin `IP` | solo si se habilitan fragmentos | `logic-core` | Semántica/decisión de un protocolo futuro con fragmentos |
| CALC-05 | Cota práctica tabla de verdad↔SAT, motor SAT y versión | H2 | semantic oracle | Ruta del oráculo semántico por tamaño |
| CALC-08 | Correspondencia/licencia de un decisor externo G4ip/G3cp | solo si se activa | `logic-core`/auditoría | Ruta B para no-derivabilidad terminante |
| CAL-01 | Cobertura real de bancos, reservas, regeneración y auditoría previa | H5 | authoring pipeline | Si el paquete puede congelarse |
| CAL-02 | `N/n`, codebook, OC/capacidad de detección y segunda evaluación | H10/pre-H11 | audit pipeline | Plan final de auditoría posterior |
| CAL-03 | Tamaños/repeticiones/denominadores de benchmarks antes de ver evaluación | pre-evaluación | benchmark harness | Validez de BENCH-01/02/03 |
| CAL-04 | Suficiencia de golden set, PBT y mutation testing | H2 | logic test suite | Cierre de H2 |
| CAL-05 | Pesos/umbral `source_suitability_score` y saturación con corpus real | H4.5 | W0 | Parada/orden de investigación |
| CAL-06 | Precisión/error NLI por estrato | H5 | NLI validator | Si NLI puede actuar como gate auxiliar |
| CAL-07 | Precisión/recall del detector de isomorfismo | H5/H10 | isomorphism canonicalizer | Protección de reservas y comparabilidad |
| CAL-08 | Nodos, profundidad, `k`, podas y timeout salvaguarda de proof search | H2/H5 | `proof-search` | Presupuesto reproducible del buscador |
| CAL-09 | Pesos iniciales del índice de complejidad y criterio de comparabilidad estructural | H5 obligatorio; H10 solo sensibilidad futura | content analytics | Selección/freezing de conjuntos y dominio no decreciente; sin efecto retroactivo |
| CAL-10 | Umbral de `wheel_spinning` | H6/H10 | `pedagogy-policy` | Cuándo activar recuperación/cambio de estrategia |
| CAL-11 | Parámetros de BKT sombra | si se habilita | shadow-metrics | Reporte sombra; nunca dominio autoritativo |
| CAL-12 | Límites efectivos CPU/RAM/rate/upload/Compose/rootless y comportamiento de recuperación | H8/H10 | telemetry/security | Límites operativos del freeze |
| CAL-13 | Cobertura suficiente de banco/calendario para retención de 7 días sin reutilización | H5/H10 | authoring + measurement-worker | Poder emitir retención; si falla → `retention_not_evaluated` |
| MEAS-01 | Tiempo humano real fijo/marginal por categoría | H8–H11 | human-load ledger | Veredicto de viabilidad |
| DUP-01 | Pruebas de aislamiento físico/isomórfico entre `TRANSFER_MASTERY` y `TRANSFER_MEASUREMENT` | H5/H10 | content repo + measurement-worker | Integridad de transferencia |
| DUP-02 | Comportamiento de la regla congelada de dominio bajo pruebas secas/calibración | H6/H10 | session-engine | Confirmar implementación sin reabrir la regla |
| CAL-14 | Criterio efectivo de suficiencia de familiarización | H8 | UX/familiarization protocol | Entrada válida del participante a H11 |
| CAL-15 | Anclajes operativos del análisis visual y criterios `favorable/no_favorable` para transferencia/retención, usando material sintético/de desarrollo y sin datos del participante | H10/pre-H11 | analysis-engine + `EXPERIMENT_AUDITOR` | Congelar `verdict-manifest` ejecutable antes de la corrida |
| SPEC-03-RTO | RTO observado, throughput de backup y recursos requeridos | H10 | backup/restore | Objetivo operativo de recuperación del run manifest |

## E.4 `DIFERIDA A ETAPA 2`

| ID | Decisión diferida | Condición para reabrir |
|---|---|---|
| E-01 | Diseño de replicación, simulación/potencia y N | Etapa 1 interpretable y nuevo protocolo preinscrito |
| E-02 | Comparación con enseñanza humana | estudio separado posterior |

## E.5 `DIFERIDA A PRODUCTO`

| ID | Decisión diferida | Condición para reabrir |
|---|---|---|
| F-01 | Web pública/PWA/desktop y lenguaje visual/navegación final | diseño de producto |
| F-02 | Captura externa, audio bruto y posible tldraw | necesidad de producto/evidencia de límite real |
| F-03 | Alta disponibilidad comercial, operación gestionada y métricas adquisición/conversión | despliegue de producto |
| F-04 | Compra/modelo de GPU futura fuera de benchmark autorizado | TCO/uso real posterior |
| F-05 | Despliegue amplio y comercialización | evidencia posterior y decisión de producto |

## E.6 Pendientes que ya **no** están abiertos en especificación

Quedan cerrados en v2.9: CALC-01, CALC-02, CALC-07, KC-01…KC-05, SPEC-01…SPEC-08, EXT-02 y SRC-01. Su implementación o refresco operacional se realiza en los gates correspondientes sin reabrir la decisión normativa.

---

# Apéndice F — Cuestionario del propietario y respuestas normalizadas

Este apéndice conserva la trazabilidad de las decisiones del propietario. **La respuesta original expresa intención; la normalización indica cómo puede incorporarse sin contradecir el cuerpo normativo.** Cuando una respuesta intenta reabrir una regla congelada —por ejemplo conservar todo dato sin minimización— prevalece el Maestro y se conserva únicamente la preferencia compatible.

1. **¿Hay una segunda persona adulta que pueda revisar y aprobar partes importantes del proyecto de forma independiente a ti?**  
   **Respuesta:** no como autoridad integral; existe posibilidad de pedir revisión al abuelo del propietario, pedagogo con formación doctoral.  
   **Normalización:** no se asigna automáticamente un `approver_role`. Puede actuar como revisión pedagógica externa si acepta y si su competencia corresponde al artefacto; H11 conserva separación de autoridad.

2. **¿Qué conocimientos tiene esa persona y qué conocimientos tienes tú?**  
   **Respuesta:** el propietario cursa universidad en tecnologías de la información; su abuelo es pedagogo, con dos doctorados y otras especialidades.  
   **Normalización:** experiencia pedagógica disponible; competencia técnica/lógica/experimental se verifica por gate y no se presume.

3. **¿Tienes acceso a profesor/investigador/persona con lógica o matemáticas para revisar corpus?**  
   **Respuesta:** sí, pero se prefiere mantener todo automatizado y acudir a revisión externa solo cuando el proyecto sea más serio.  
   **Normalización:** máxima automatización; revisión humana únicamente en gates normativos o cuando se eleve el nivel de formalidad.

4. **¿Cuánto tiempo podrían dedicar los revisores?**  
   **Respuesta:** aproximadamente 30–60 minutos cuando sea necesario.  
   **Normalización:** Plan.md debe producir paquetes de revisión compactos y trazables; MEAS-01 medirá carga real.

5. **¿Tienes acceso a abogado/revisor jurídico?**  
   **Respuesta:** no; la intención inicial es auto-prueba.  
   **Normalización:** no se contrata ahora; LEG-01/LEG-02 siguen abiertos antes de H11 formal si resultan aplicables. La auto-prueba local no los declara resueltos.

6. **¿Cuánto gastarías en revisión jurídica?**  
   **Respuesta:** no se abordará todavía.  
   **Normalización:** sin presupuesto jurídico en plan base; rama condicionada a H9/H11.

7. **¿Quién será la primera persona que use el sistema?**  
   **Respuesta:** el propietario/desarrollador.  
   **Normalización:** `LOCAL_SELF_USE` funcional; no se trata automáticamente como participante H11.

8. **¿Qué relación tiene contigo el primer usuario?**  
   **Respuesta:** es el propio propietario.  
   **Normalización:** auto-prueba de desarrollo.

9. **¿La participación es voluntaria y puede detenerse?**  
   **Respuesta:** voluntaria; intención de continuar.  
   **Normalización:** la UI conserva pausa/retirada y no elimina derechos operativos por intención previa.

10. **¿Proyecto independiente o institucional?**  
    **Respuesta:** independiente.  
    **Normalización:** sin afiliación institucional declarada para Etapa 1 local; ETH-01 se reevalúa si cambia publicación/reclutamiento/contexto.

11. **¿Piensas publicar resultados?**  
    **Respuesta:** no de momento; posible tesis, artículo, presentación, portafolio o redes en el futuro.  
    **Normalización:** no bloquea plan local; cualquier difusión futura reabre revisión de consentimiento, privacidad y riesgo de reidentificación.

12. **¿Compensación al participante?**  
    **Respuesta:** no aplica a la auto-prueba.  
    **Normalización:** sin compensación en `LOCAL_SELF_USE`; una futura corrida con tercero la define antes del consentimiento.

13. **¿Puedes sostener varias semanas de sesiones y seguimientos?**  
    **Respuesta:** sí.  
    **Normalización:** calendario largo es viable en principio; la planificación concreta se fija al preparar la corrida.

14. **Sistema operativo.**  
    **Respuesta:** Windows 11.  
    **Normalización:** Plan.md parte de Windows 11; H3 confirma build/WSL2/compatibilidad.

15. **Procesador.**  
    **Respuesta:** Intel Core i5 de 8.ª generación.  
    **Normalización:** dato de capacidad inicial; no sustituye telemetría.

16. **RAM.**  
    **Respuesta:** 16 GB.  
    **Normalización:** límite de planificación; CAL-12/H8 fija concurrencia real.

17. **Espacio libre.**  
    **Respuesta:** más de 1 TB disponible.  
    **Normalización:** suficiente como hipótesis operativa inicial; H8 registra uso real.

18. **¿GPU disponible?**  
    **Respuesta:** no; Etapa 1 usará APIs de pago y no se intentará GPU/hardware adicional.  
    **Normalización:** Perfil B fuera del plan base.

19. **Datos de GPU.**  
    **Respuesta:** no aplica.  
    **Normalización:** ninguno.

20. **¿Segunda computadora para el usuario?**  
    **Respuesta:** no; se utilizará la computadora del propietario.  
    **Normalización:** una sola máquina local; separación lógica/OS de secretos y soluciones debe suplir la falta de host separado.

21. **¿Internet estable para sesiones de ~1 hora?**  
    **Respuesta:** sí.  
    **Normalización:** Perfil A viable como hipótesis; fallos reales se registran como operacionales.

22. **Máximo mensual aproximado en APIs/servicios.**  
    **Respuesta:** preferentemente económico, alrededor de MXN 500; podría revisarse si hace falta.  
    **Normalización:** objetivo ordinario ≈500 MXN/mes, no gate científico.

23. **Máximo para toda Etapa 1.**  
    **Respuesta:** buscar todo gratis salvo APIs u otra necesidad real.  
    **Normalización:** OSS/local-first por defecto; no contratar infraestructura por comodidad.

24. **Cuentas/API disponibles.**  
    **Respuesta:** se puede crear la cuenta que se necesite.  
    **Normalización:** disponibilidad de abrir cuentas, sin preselección de proveedor.

25. **¿Dos proveedores LLM si el benchmark lo exige?**  
    **Respuesta:** sí.  
    **Normalización:** BENCH-01/02 pueden planificar proveedores directos múltiples.

26. **¿Método de pago internacional?**  
    **Respuesta:** sí, tarjeta de crédito/débito si es aceptada.  
    **Normalización:** capacidad operativa a verificar con cada proveedor.

27. **¿Pagar plan superior por privacidad?**  
    **Respuesta:** no se desea para la auto-prueba.  
    **Normalización:** no se contrata por defecto; si H11 formal requiere controles no disponibles en el plan actual, el gate permanece cerrado en vez de degradarse.

28. **¿Pagar servidor remoto/hosting?**  
    **Respuesta:** solo después de demostrar que funciona y si existe interés de sacarlo al mercado.  
    **Normalización:** local-only en Etapa 1 base; hosting diferido/condicionado.

29. **¿Tiempo o costo?**  
    **Respuesta:** gastar menos dinero.  
    **Normalización:** optimizar costo fuera de rutas interactivas críticas; nunca sacrificar integridad.

30. **Herramienta principal de desarrollo asistido.**  
    **Respuesta:** Claude Code y/o Codex.  
    **Normalización:** Claude Code inicialmente disponible; Plan.md portable a Codex.

31. **Suscripciones actuales.**  
    **Respuesta:** Claude.  
    **Normalización:** no depender de otra suscripción para comenzar.

32. **Nivel de autonomía del agente desarrollador.**  
    **Respuesta:** completamente autónomo.  
    **Normalización:** tickets grandes pero verificables, CI/gates automáticos y mínima intervención humana.

33. **¿Plan.md para ejecución paso a paso?**  
    **Respuesta:** basta con que la IA lo ejecute de forma autónoma.  
    **Normalización:** Plan.md orientado a ejecución autónoma, con checkpoints y criterios de aceptación legibles por agente.

34. **¿Voz de entrada en primera experiencia?**  
    **Respuesta:** sí.  
    **Normalización:** capability deseada, sujeta a BENCH-03/H8.

35. **¿Voz de salida?**  
    **Respuesta:** sí.  
    **Normalización:** capability deseada, sujeta a BENCH-03/H8.

36. **¿Pizarrón digital?**  
    **Respuesta:** sí.  
    **Normalización:** capability deseada.

37. **¿Interpretación visual/dibujo libre?**  
    **Respuesta:** sí, se desea todo.  
    **Normalización:** `visualBoardInterpretation=true` solo si H8 demuestra suficiente seguridad/abstención; no adquiere autoridad formal.

38. **¿Presencial/remoto?**  
    **Respuesta:** en la propia computadora local.  
    **Normalización:** local/presencial.

39. **¿Aceptar degradar a texto/editor si multimodalidad obliga?**  
    **Respuesta:** sí.  
    **Normalización:** multimodalidad es deseada, no condición para declarar funcional el núcleo.

40. **¿Qué datos no quieres conservar?**  
    **Respuesta:** preferencia por conservar toda información útil.  
    **Normalización:** se conserva únicamente lo compatible con finalidad/minimización/seguridad; la preferencia no autoriza guardar datos innecesarios.

41. **¿Conservar la menor cantidad posible?**  
    **Respuesta:** preferencia por conservar información.  
    **Normalización:** prevalece `DEC-LEGAL-ARTIFACTS-001` y §14.3; se maximiza utilidad dentro del mínimo justificable, no la acumulación indiscriminada.

42. **Horas por semana.**  
    **Respuesta:** alrededor de una hora diaria.  
    **Normalización:** ≈7 h/semana como disponibilidad nominal; sin promesa rígida.

43. **Mejor momento.**  
    **Respuesta:** mediodía.  
    **Normalización:** dato de planificación personal, no requisito del sistema.

44. **Periodos de baja disponibilidad.**  
    **Respuesta:** pueden existir, pero no se espera impacto importante.  
    **Normalización:** Plan.md no impone fecha dura; sesiones pueden reprogramarse según reglas del protocolo.

45. **Fecha límite.**  
    **Respuesta:** ninguna.  
    **Normalización:** priorizar calidad/costo/automatización frente a calendario.

46. **¿Demo antes de participante real?**  
    **Respuesta:** se quiere que funcione para el propietario.  
    **Normalización:** `LOCAL_SELF_USE` es el entregable funcional previo; no se construye una demo falsa separada si no aporta evidencia.

47. **Tiempo máximo antes de reevaluar.**  
    **Respuesta:** el necesario, con requisito de automatización.  
    **Normalización:** no hay stop temporal fijo; gates H2/H8 sirven como puntos naturales de revisión.

48. **Dinero máximo antes de reevaluar.**  
    **Respuesta:** MXN 700.  
    **Normalización:** MXN 700 acumulados = umbral de revisión explícita, no autorización automática para seguir gastando ni obligación de abandonar.

49. **¿Conservar partes útiles si el sistema completo falla?**  
    **Respuesta:** sí.  
    **Normalización:** `logic-core`, editor Fitch y componentes generalizables deben tener fronteras reutilizables.

50. **¿Otra restricción importante?**  
    **Respuesta:** no.  
    **Normalización:** sin restricciones adicionales declaradas al cierre del cuestionario.

## F.1 Decisiones del propietario derivadas

- `OWNER-LOCAL-001` — primera experiencia funcional local en una sola PC.
- `OWNER-BUDGET-001` — costo bajo; ≈MXN 500/mes como objetivo de APIs; revisión >MXN 700 acumulados.
- `OWNER-AUTONOMY-001` — implementación mediante agente de código con alta autonomía y mínima intervención manual.
- `OWNER-MULTIMODAL-001` — voz entrada/salida + pizarrón + visión deseados, degradables a texto/editor por evidencia.
- `OWNER-HOSTING-001` — no hosting comercial/remoto antes de demostrar necesidad/valor.
- `OWNER-GPU-001` — sin GPU/LLM local en plan base.
- `OWNER-CONTINUITY-001` — progreso persistente por materia y continuidad entre sesiones son requisitos funcionales de UX.
- `OWNER-CUSTOM-COURSES-001` — creación de materias personalizadas incluida, etiquetada como no validada experimentalmente.
- `OWNER-REUSE-001` — conservar componentes útiles/reutilizables si la Etapa 1 completa no resulta viable.

---
