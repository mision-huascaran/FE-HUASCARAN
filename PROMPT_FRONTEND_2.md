# PROMPT FRONTEND 2 — SICEDU

## Objetivo

Actúa como desarrollador frontend principal del proyecto SICEDU en React + Tailwind para la ONG Misión Huascarán. Tu trabajo es continuar y corregir la implementación actual usando como fuente de verdad los documentos entregados:

- `APIS_BACKEND.md`
- `ReporteCambios-Backend.md`
- `SICEDU_GUIA_FRONTEND.md`
- `PROMPT_FRONTEND_SICEDU.md`
- el proyecto actual en `src/`

No trabajes con suposiciones. Usa estas fuentes para verificar cada decisión de UI, flujo, permisos y contratos de API.

---

## Regla base

Haz solo lo necesario para cumplir la tarea solicitada, sin adelantar trabajo futuro. Si hay inconsistencia entre documentos, no la resuelvas por cuenta propia: reporta el conflicto y deja el cambio en un punto seguro con comentario `TODO` si es necesario.

---

## Cambios requeridos

### Fase 1 — Roles, nombres y navegación

- Cambiar el nombre del rol de "Jefa del Programa de Educación" a "Supervisor".
- Cambiar el nombre del rol de "Profesor" a "Docente".
- Ajustar todas las labels, textos, navegación y guardas para reflejar estos nombres.
- Mantener la lógica de permisos por rol compatible con el backend, especialmente:
  - Docente
  - Supervisor
  - Directivo
- La navegación debe seguir el rol y las rutas definidas por el sistema de roles.

### Fase 2 — Autenticación y registro

- Mantener el login con validación real de credenciales y errores claros.
- Implementar una pantalla de registro pública (`/registro`) compatible con el flujo de la aplicación.
- En la pantalla de registro, validar:
  - nombre y apellido
  - correo institucional válido
  - contraseña segura
  - rol seleccionado
  - datos obligatorios según el tipo de cuenta
- La pantalla debe respetar la identidad visual del sistema y el estilo de la app.

### Fase 3 — Manejo de sesión y protección de rutas

- Mantener la sesión activa con JWT o con la estrategia actual del proyecto.
- Validar sesión caduca/inválida.
- Redirigir a login cuando no haya sesión.
- Mantener guardas por rol para evitar acceso cruzado.
- Implementar flujo para cuenta inactiva si aplica.

### Fase 4 — Administración y gestión del supervisor

- Dentro del rol Supervisor, permitir crear:
  - colegios
  - alumnos
  - docentes/profesores
- Al crear un alumno, deben vincularse con un colegio y, si aplica, con el programa y grado correspondientes.
- El Supervisor debe poder crear más supervisores y más directivos desde la interfaz.
- Debe existir la posibilidad de editar y eliminar cuentas, en forma consistente con la UX del sistema.
- La creación debe concordar con lo que acepta el backend y con la lógica ya definida en `APIS_BACKEND.md`.

### Fase 5 — UX final, off-line y documento de entrega

- Mantener consistencia con el diseño de la aplicación actual y con `SICEDU_GUIA_FRONTEND.md`.
- Respetar colores, tipografía, sidebar, cards, filtros y tablas del prototipo.
- Revisar las pantallas relevantes para corregir incidencias de pruebas y alinear a Figma.
- Incluir un README final con dos soluciones para uso sin internet en colegios rurales:
  - PWA instalable con caché y sincronización
  - app de escritorio local con almacenamiento local y sincronización posterior
- Agregar la nota del atajo rápido para un alumno en la tabla: botón para abrir modal con reporte semanal y registro de vuelo de un solo alumno, con guardar.

---

## Requisitos de diseño

- Mantener la paleta y sistema visual ya establecido en la app.
- No inventar un estilo nuevo ni romper la identidad visual del proyecto.
- Usar el mismo lenguaje visual del prototipo: cards blancas, bordes suaves, sidebar azul marino, fondo gris claro, botones primarios y chips de estado.
- Las pantallas deben ser responsivas y seguir los requisitos de 360, 768, 1280 y 1920 px.

---

## Requisitos de backend y API

- Usa solo las APIs habilitadas del backend y no inventes endpoints que no existan.
- Si el backend aún no expone una funcionalidad, deja la interfaz preparada con `TODO` y una gestión local de UX, o usa mock mientras la API real esté pendiente.
- Para autenticación y sesión: prioriza los endpoints reales documentados en `APIS_BACKEND.md`.

---

## Criterio de aceptación

La entrega se considera exitosa si:

1. Los nombres de roles aparecen como Docente, Supervisor y Directivo en toda la UI.
2. El login y la navegación respetan el rol.
3. La pantalla de registro funciona de forma navegable y validada.
4. La administración del supervisor permite crear/editar/eliminar usuarios y entidades clave.
5. El sistema mantiene la continuidad visual y de comportamiento con el estilo actual.
6. El proyecto queda documentado con la estrategia offline y el enfoque final del frontend.

---

## Instrucción final para la ejecución

Lee todo este prompt y ejecuta los cambios en fases. No avances a la siguiente fase hasta que la anterior esté consistente. Si necesitas una decisión no documentada, deja la implementación con `TODO` y explica el motivo antes de continuar.
