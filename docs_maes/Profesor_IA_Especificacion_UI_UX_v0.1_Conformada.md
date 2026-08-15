# Profesor IA — Especificación UI/UX v0.1 conformada

**Estado:** artefacto de diseño subordinado, válido como entrada de `Plan.md` junto con el Documento Maestro vigente.  
**Fecha de conformación:** 14 de agosto de 2026.  
**Autoridad superior:** `Profesor_IA_Documento_Maestro_Normalizado_v2.12_PostUI_PrePlan.md`.  
**Fuente visual original:** `Mockups de interfaz educativa_v2.1.zip`.  
**SHA-256 del ZIP fuente:** `5b2b33360369cecd4a6862a9a597bf7c5525dd79d4ff750b8dbe1b6d286faae0`.  
**HTML principal del ZIP:** `Profesor IA - UX.dc.html`.  
**SHA-256 del HTML fuente:** `e1e1b730ec8516158e3318367b5d6005246a3865baf444f1cfa73918d46229a0`.

---

## 1. Propósito y autoridad

Este documento formaliza las decisiones de interfaz derivadas de los mockups de Profesor IA sin convertir decisiones visuales en requisitos pedagógicos, experimentales, técnicos o de gobernanza.

Jerarquía aplicable:

1. Documento Maestro vigente;
2. anexos normativos reconocidos por el Maestro;
3. esta Especificación UI/UX;
4. `Plan.md`;
5. implementación.

Ante cualquier contradicción, **prevalece el Documento Maestro y se corrige la UI/UX**.

La UI/UX puede congelar:

- disposición y composición de pantallas;
- jerarquía visual;
- navegación fina;
- componentes;
- densidad;
- tipografía y sistema visual;
- tokens de interfaz;
- patrones de interacción compatibles con el Maestro;
- responsive design;
- estados visuales que representen estados ya autorizados.

La UI/UX no puede decidir ni modificar:

- autoridad de IA, código o humano;
- avance, dominio o evaluación;
- separación `LEARNING_MODE` / `MEASUREMENT_MODE`;
- reservas experimentales;
- veredictos y gates;
- privacidad, conservación o supresión;
- privilegios o acceso a soluciones/sondas;
- `model_binding` de una corrida congelada;
- política de gasto;
- criterios experimentales;
- validez científica de una materia.

---

## 2. Regla de datos ilustrativos

Todos los nombres, materias de ejemplo, porcentajes, tiempos, costes, sesiones, métricas, fechas, benchmarks, estados simulados y cantidades incluidos en los mockups son **datos ilustrativos no normativos**, salvo coincidencia explícita con un valor ya definido por el Documento Maestro.

`Plan.md` no debe importar esos valores como:

- defaults;
- thresholds;
- criterios de aceptación;
- fixtures autoritativos;
- métricas normativas;
- tiempos operativos;
- decisiones de producto.

Los datos reales deben proceder de los contratos, estados, manifests, ledgers, benchmarks o calibraciones autorizados por el Maestro.

---

## 3. Dirección visual congelable

Se conserva como dirección UI/UX de v0.1:

- aplicación web local con apariencia de aplicación de escritorio para la primera experiencia;
- sistema visual sobrio/modernista, de alta legibilidad y baja decoración;
- jerarquía basada en reglas, bloques y etiquetas escritas, evitando depender exclusivamente del color;
- una acción primaria dominante por pantalla cuando exista una acción principal clara;
- densidad graduada: experiencia del alumno más simple; Investigación/Auditoría más densa;
- clase centrada en el material de trabajo, no en un chat como superficie dominante;
- navegación lateral en las vistas ordinarias y desaparición/reducción de esa navegación cuando la clase requiera mayor concentración;
- teclado y texto como rutas equivalentes para acciones críticas cuando las capacidades multimodales no estén disponibles;
- estados comunicados mediante texto + señal visual, no solo color o animación.

La paleta exacta, marca, refinamientos de tipografía y detalles estéticos pueden iterar dentro de esta especificación sin modificar el Maestro.

---

## 4. Arquitectura de información

La arquitectura funcional mínima sigue la definida por el Documento Maestro.

### 4.1 Estudiar

- **Inicio**
- **Mis materias**
- **Detalle de materia / salón**
- **Clase**
- **Progreso**

### 4.2 Preparar

- **Crear materia**
- **Preparación en curso**
- **Curso preparado / revisión de propuesta**

### 4.3 Sistema y transparencia

- **Investigación / Expediente del curso**
- **Configuración**
- **Consola técnica**, cuando el rol lo permita
- **Consola de auditoría**, cuando el rol lo permita

La agrupación visual en bloques como `Estudiar`, `Preparar` y `Sistema` puede usarse como navegación fina. No crea nuevos dominios funcionales ni altera permisos.

---

## 5. Flujos principales

### 5.1 Continuar una materia

```text
Inicio
  → Mis materias
      → abrir materia
          → Continuar clase
              → Clase
                  → cierre/guardado
                      → Progreso / siguiente sesión
```

### 5.2 Crear una materia personalizada

```text
Inicio / Mis materias / Crear materia
  → definir qué aprender
      → investigación y preparación
          → propuesta de curso
              → crear materia
                  → iniciar/continuar clase
```

Una materia personalizada permanece identificada como `CUSTOM_COURSE_UNVALIDATED` mientras no exista una validación específica autorizada por una especificación superior.

---

## 6. Especificación por vista

### 6.1 Inicio

Objetivo: responder de inmediato **dónde se quedó el usuario y qué debe hacer a continuación**.

Debe poder representar:

- materia activa;
- punto de retorno;
- `Continuar clase`;
- progreso operativo autorizado;
- próximos repasos/actividades cuando el motor los haya programado;
- materias en curso y en preparación;
- estado de capacidades o proveedor de forma secundaria;
- coste/consumo real cuando exista en `cost-ledger`.

No debe inferir por sí misma reglas pedagógicas a partir de porcentajes ficticios del mockup.

### 6.2 Mis materias

Debe distinguir estructuralmente:

- `VALIDATED_LOGIC_COURSE`;
- `CUSTOM_COURSE_UNVALIDATED`.

La etiqueta visible no puede afirmar que un curso ya produjo validación experimental si H11 y sus veredictos no lo han demostrado.

Forma recomendada para lógica:

- `CURSO EXPERIMENTAL DE LÓGICA` o etiqueta equivalente comprensible;
- estado técnico del paquete separado del resultado experimental;
- resultado experimental mostrado únicamente cuando exista realmente.

Para materias personalizadas debe mostrarse de forma clara que son funcionales pero **no validadas por el experimento de lógica**.

### 6.3 Crear materia y preparación

Debe capturar el sobre mínimo permitido por el Maestro y puede presentar refinamientos opcionales de UX.

La preparación puede mostrarse como proceso observable mediante:

- estado actual;
- artefactos producidos;
- fuentes/propuesta de corpus cuando corresponda;
- mensajes comprensibles de progreso;
- errores y reintentos autorizados.

Los nombres y el número exacto de etapas del mockup no son normativos.

No se presume que el trabajo continúe en segundo plano después de cerrar la aplicación; ese comportamiento requiere soporte de implementación y debe tratarse como propuesta hasta quedar definido por `Plan.md` dentro de los límites del Maestro.

### 6.4 Detalle de materia

Puede mostrar:

- estructura de unidades/temas;
- progreso;
- historial;
- dificultades registradas;
- próxima actividad;
- estado de preparación;
- `Continuar clase`.

Los indicadores no pueden inventar una medida de retención, dominio o dificultad distinta de las fuentes de verdad del sistema.

### 6.5 Clase

**Dirección de layout:** 7A se adopta como dirección visual principal de v0.1.

Principios:

- material/actividad como superficie protagonista;
- Profesor IA visible como interlocutor, sin convertir toda la pantalla en chat;
- conversación textual reconstruible;
- voz cuando `voiceInput` / `voiceOutput` estén habilitados;
- editor Fitch para actividades formales de lógica;
- pizarrón cuando `whiteboard` esté habilitado;
- anotaciones visuales autorizadas;
- controles de pista en `LEARNING_MODE`;
- pausa;
- apelación;
- retirada;
- estado de guardado;
- información secundaria limitada durante la clase.

Las variantes 7B y 7C quedan documentadas como **propuestas no normativas** y no son requisitos de implementación de v0.1.

### 6.6 Progreso

Puede representar estados comprensibles como:

- dominado;
- en aprendizaje;
- pendiente;
- dificultades;
- historial;
- retención medida cuando exista;
- próximos repasos programados.

No se implementan porcentajes de «retención estimada» ni automatismos derivados de ellos por el solo hecho de aparecer en los mockups.

### 6.7 Investigación / Expediente del curso

Objetivo: ofrecer transparencia autorizada sin convertir JSON crudo en la interfaz principal.

Puede mostrar, según permisos:

- fuentes;
- aceptaciones/rechazos;
- objetivos;
- mapa de KC/conceptos;
- versiones;
- autoría;
- benchmarks reales;
- autonomía real;
- incidentes;
- costes reales;
- proveniencia y trazabilidad.

**Corrección obligatoria:** un interruptor `Detalle técnico` no puede conceder por sí mismo acceso a prompts, respuestas crudas, sondas, soluciones, identidad, evidencias protegidas o información de auditoría. Toda expansión de detalle queda sujeta a RBAC y filtrado por rol.

### 6.8 Configuración

Puede ofrecer controles para:

- conexiones/proveedores;
- voz y micrófono;
- accesibilidad;
- privacidad;
- almacenamiento;
- presupuesto;
- opciones avanzadas.

Debe distinguir **configuración editable de desarrollo/futura** de **configuración congelada de una corrida**.

Durante una corrida formal, la UI no puede sustituir silenciosamente un `model_binding`, cambiar políticas experimentales ni alterar capabilities congeladas.

---

## 7. Correcciones de conformidad obligatorias

Estas correcciones sustituyen cualquier comportamiento incompatible mostrado o insinuado por los mockups originales.

### UI-CORR-01 — Significado de «validado»

No usar benchmarks técnicos como equivalente de validación experimental del aprendizaje.

Separar visualmente:

- estado del paquete técnico;
- estado de auditoría/benchmark;
- estado/resultados experimentales H11, si existen.

### UI-CORR-02 — `MEASUREMENT_MODE`

La vista de Clase debe soportar un estado explícito de medición/sonda.

En ese estado:

- se muestra aviso comprensible de modo sonda;
- pistas quedan deshabilitadas;
- no hay feedback pedagógico durante la sonda;
- el agente pedagógico no adquiere autoridad sobre selección/tiempo/consumo;
- los canales se limitan conforme al manifest/preinscripción;
- no se muestran bancos futuros ni soluciones.

No es un nuevo modo elegido por el diseño: representa un estado ya definido por el Maestro.

### UI-CORR-03 — Corrección de transcripción

- antes de `COMMIT`: edición/corrección libre de la transcripción;
- después de `COMMIT`: la corrección crea un evento enlazado y no sobrescribe silenciosamente el original;
- si el acto era puntuable, se aplica la política de incidente/adjudicación.

La edición en línea puede utilizarse como patrón visual para la fase pre-`COMMIT`.

### UI-CORR-04 — Apelación y retirada

`No estoy de acuerdo` puede registrar apelación y solicitar revisión humana posterior.

No puede crear un flujo donde un humano intervenga pedagógicamente en vivo para decidir avance dentro de la condición experimental.

La experiencia de clase debe incluir acceso inequívoco a **retirada/detener participación** cuando corresponda al contexto H11.

### UI-CORR-05 — Auditoría y privilegios

Investigación/Expediente, Consola técnica y Consola de auditoría pueden compartir lenguaje visual, pero permanecen separadas por autoridad y permisos.

La UI normal del alumno nunca obtiene acceso por un toggle a:

- soluciones;
- sondas futuras;
- semillas reservadas;
- decisiones de auditor aún protegidas por cegamiento;
- identidad innecesaria;
- secretos o credenciales.

### UI-CORR-06 — Freeze de modelo/configuración

Durante una corrida formal:

- `Cambiar de modelo` no es un fallback libre;
- un cambio de `model_binding` requiere el procedimiento/versionado aplicable;
- la UI debe representar configuraciones congeladas como no editables o claramente bloqueadas.

### UI-CORR-07 — Voz continua

La primera implementación prioriza push-to-talk o micrófono activo durante el turno.

`Escucha continua`, full duplex, barge-in automático y turn-taking completamente autónomo permanecen experimentales y no se presentan como capacidad ordinaria disponible por defecto.

### UI-CORR-08 — Audio bruto

`Guardar audio de las sesiones` no es un toggle ordinario de preferencia.

El audio bruto del alumno permanece desactivado por defecto y solo puede conservarse bajo finalidad documentada, consentimiento y política de conservación/borrado autorizados.

### UI-CORR-09 — Evidencia

La evidencia necesaria para integridad experimental no puede convertirse en una preferencia desactivable del alumno.

Las opciones de privacidad deben distinguir datos opcionales de evidencias mínimas requeridas y aplicar el procedimiento de retirada/derechos definido por el Maestro.

### UI-CORR-10 — Exportación

`Exportar todo` debe implementarse como **exportación autorizada para el rol y finalidad**, no como fusión indiscriminada de todos los almacenes.

### UI-CORR-11 — Presupuesto

La UI puede mostrar:

- consumo acumulado;
- proyección/desglose;
- alertas;
- estado del gate.

No puede permitir que una opción de UX como `solo avisar` evite la revisión explícita del propietario exigida por el Maestro al superar el umbral normativo vigente.

### UI-CORR-12 — Fallos operacionales

La UI puede representar caída de API, voz no disponible, ausencia de conexión u otros estados, pero las acciones disponibles deben corresponder al fallback realmente congelado.

Eliminar como acción genérica de una corrida formal cualquier botón que cambie de modelo o política sin pasar por el control correspondiente.

---

## 8. Accesibilidad mínima

La UI debe conservar desde H8, como mínimo:

- controles críticos operables por teclado;
- foco visible y no oculto;
- ausencia de trampas de teclado;
- alternativa a gestos de arrastre cuando aplique;
- objetivos interactivos compatibles con la línea base de accesibilidad del Maestro;
- anotaciones visuales con equivalente textual;
- escena estructurada navegable cuando proceda;
- notación lógica expuesta semánticamente;
- reducción de movimiento respetada;
- estados comunicados por palabra además de color/movimiento.

Esta especificación no declara conformidad WCAG global por sí sola.

---

## 9. Estados de interfaz

La implementación debe diseñar estados coherentes para, al menos:

- carga/preparación;
- curso todavía no preparado;
- guardado;
- retorno después de una pausa temporal;
- error operacional;
- proveedor/API no disponible;
- micrófono no disponible;
- capability multimodal deshabilitada;
- modo degradado autorizado;
- `MEASUREMENT_MODE`;
- apelación registrada;
- retirada;
- configuración congelada;
- presupuesto acercándose o alcanzando un gate;
- permisos insuficientes;
- datos no disponibles/no evaluados.

La gramática recomendada de error es:

1. qué ocurrió;
2. qué se conserva;
3. qué acciones autorizadas existen ahora.

No se inventan fallbacks para llenar la interfaz.

---

## 10. Propuestas no normativas conservadas

Las siguientes ideas pueden conservarse en diseño/prototipo, pero **no son requisitos de v0.1 ni de `Plan.md` por su sola existencia**:

- layouts de clase 7B y 7C como modos conmutables;
- trabajo en segundo plano tras cerrar la aplicación;
- adjuntar programa/apuntes como entrada de creación;
- herramientas específicas futuras para código, texto u otros dominios;
- una política offline concreta más allá de los fallbacks autorizados;
- porcentajes de retención estimada;
- diagnóstico disparado automáticamente por un porcentaje ilustrativo;
- número fijo o nombres fijos de etapas de preparación;
- edición manual del plan generado por el alumno;
- cualquier cifra/umbral procedente exclusivamente del mockup.

---

## 11. Decisiones puramente visuales que pueden congelarse

Pueden tratarse como decisiones UI de v0.1 sin modificar el Maestro:

- layout principal 7A para Clase;
- agrupación visual de navegación;
- una acción primaria dominante;
- densidad graduada por contexto;
- uso de reglas y bloques en lugar de decoración excesiva;
- etiquetas textuales acompañando color/estado;
- presentación de cursos personalizados con etiqueta explícita;
- investigación más tabular/densa que la experiencia de estudio;
- barra de estado secundaria para proveedor/coste cuando exista información real;
- componentes reutilizables para sello de tipo de curso, estado de dominio, turno, etapas, nota de alcance y resumen de sesión, siempre que su contenido provenga de estados autorizados.

---

## 12. Matriz de trazabilidad resumida

| Elemento UI | Clase | Fuente superior / regla | Implementación |
|---|---|---|---|
| Inicio/Materias/Crear/Clase/Progreso/Investigación/Configuración | A | `DEC-UX-FUNCTIONAL-001` | obligatoria |
| Distinción lógica/personalizadas | A | `DEC-CUSTOM-COURSES-001` | obligatoria |
| Texto/voz/Fitch/pizarrón | A | multimodalidad del Maestro | según capability flags |
| Layout 7A | B | decisión visual | congelable |
| 7B/7C | C | exploración | no requisito |
| Datos ficticios | C | política de datos ilustrativos | nunca importar como constantes |
| «Validado» por benchmarks | D | veredictos/gates | corregido por UI-CORR-01 |
| Falta de estado sonda | D | separación enseñanza/medición | corregido por UI-CORR-02 |
| Apelación con decisión humana en vivo | D | no rescate | corregido por UI-CORR-04 |
| Detalle técnico sin RBAC | D | privilegios | corregido por UI-CORR-05 |
| Cambio libre de modelo | D | freeze/model binding | corregido por UI-CORR-06 |
| Escucha continua ordinaria | D | voz V1 | corregido por UI-CORR-07 |
| Audio bruto como toggle | D | privacidad/audio | corregido por UI-CORR-08 |
| Evidencia como preferencia | D | integridad | corregido por UI-CORR-09 |
| Exportar todo sin alcance | D | separación de datos | corregido por UI-CORR-10 |
| Bypass del gate de gasto | D | presupuesto propietario | corregido por UI-CORR-11 |
| Huecos funcionales nuevos | E | — | **ninguno encontrado** |

---

## 13. Requisitos para `Plan.md`

`Plan.md` debe consumir esta especificación con las siguientes reglas:

1. implementar primero los elementos A y las decisiones B congeladas;
2. aplicar todas las `UI-CORR-*` como requisitos de conformidad;
3. no convertir elementos C en alcance obligatorio salvo decisión posterior explícita;
4. no implementar ningún comportamiento D de la versión original del mockup;
5. no importar datos ficticios del HTML;
6. vincular componentes críticos con el `decision_id` o sección normativa correspondiente;
7. incluir criterios de aceptación para `LEARNING_MODE`, `MEASUREMENT_MODE`, privilegios, privacidad, freeze y degradación;
8. mantener los mockups originales como referencia visual, no como autoridad funcional autónoma.

---

## 14. Estado de congelamiento

Después de aplicar las correcciones `UI-CORR-01` a `UI-CORR-12`, esta especificación queda **CONFORMADA PARA PRE-PLAN**.

No se identificaron huecos funcionales de categoría E que requieran reabrir el Documento Maestro.

La cadena documental queda:

```text
Documento Maestro v2.12 PostUI/PrePlan
        ↓
Especificación UI/UX v0.1 conformada
        ↓
Mockups originales v2.1 (referencia visual)
        ↓
Plan.md
        ↓
Implementación
```
