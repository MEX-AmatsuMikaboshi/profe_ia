# Reorganización del frontend — 16 de septiembre de 2026

El propietario prioriza el diseño de toda la aplicación y deja para después la
integración funcional descrita en `AUDITORIA_PROFESORIA.md`. Conservar los colores
y mejorar organización, lectura y orientación es la instrucción vigente.

## Primera propuesta implementada

- Navegación compartida en Inicio, Mis materias, Resumen y Progreso. En Clase se
  reduce a una salida explícita hacia la materia; en móvil pasa a navegación superior.
- Inicio con una sola acción destacada para continuar, biblioteca y agenda. Consumo
  y capacidades quedan disponibles en un desplegable.
- Materias con acceso al temario; estados técnicos y experimentales separados dentro
  de un desplegable. Se conservan los descargos de ambos tipos de curso.
- Resumen con acceso a Clase y Progreso antes del temario; progreso en recuentos,
  sin porcentajes nuevos ni inferencias de dominio.
- Clase con actividad y derivación primero, profesor lateral, pizarrón desplegable y
  conversación consultable. Pausa, apelación y retirada conservan su presencia.
- Avisos de demostración más breves. La demostración ya no muestra «Guardado».
- Paleta y fuente Archivo conservadas. Texto oscuro de 19px/800 sobre el botón
  rojo, con estados hover/active revisados; los tokens generados y de origen no se editan.
- Pantalla de sección no disponible con explicación comprensible y enlaces de regreso.

## Verificación y límites

172 pruebas del frontend aprobadas (14 archivos). Typecheck, lint y build de producción
comprobados localmente. Inspección de Inicio, Materias, Resumen, Progreso y Clase en
navegador; revisión a 390 px de ancho, sin desbordamiento horizontal en las vistas
de materias, y apertura del pizarrón.

La línea base de accesibilidad de Clase pasa 9 criterios y deja 2 sin verificar
(anotaciones aún no renderizadas y evaluación humana con ayudas técnicas). Ahora
comprueba paneles cerrados y abiertos; su informe registra ambos estados.
Los siete defectos sembrados de control se detectan. Se adaptó la siembra de tamaño:
el nuevo espacio de 8px entre símbolos cumple la excepción de espaciado de axe, por
lo que el defecto exige retirar tanto el tamaño mínimo como la separación.

No constituye conformidad WCAG global ni una verificación en CI remoto. Sigue el
hallazgo previo de axe `button-name` en `.main-menu-trigger` de Excalidraw, presente
también en el informe anterior. El build mantiene advertencias previas de imports
Node en la instrumentación de Edge; no impiden compilar.

La vista previa sólo levanta el frontend. No se han conectado persistencia, controles
pedagógicos, edición Fitch ni proveedores. Los cinco archivos modificados al retomar
el proyecto se conservaron; la reorganización amplía los cambios de ClaseView.

## Continuación

Revisar esta propuesta visual con el propietario antes de tratarla como diseño final.
Después retomar editor utilizable, servicio de sesión persistente y avance real,
según la auditoría. La cabecera histórica de HANDOFF que afirma que no queda interfaz
por construir no describe estas limitaciones del producto.
