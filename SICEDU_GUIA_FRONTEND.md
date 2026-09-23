# SICEDU — Especificación Frontend
## Resumen práctico para desarrollo

> Fuente: **Documento de Análisis y Diseño — SICEDU (Sistema de Centralización de Datos Educativos)**, versión 1.1, septiembre de 2026.
>
> Este archivo resume únicamente lo que impacta directamente al desarrollo frontend: pantallas, navegación, roles, formularios, tablas, validaciones, estados, offline, permisos, dashboards, exportaciones y requisitos de UX/responsividad.

---

## 1. Objetivo del frontend

SICEDU es una plataforma web centralizada para gestionar la información académica del Programa de Educación de Misión Huascarán.

El frontend debe permitir:

- Registrar y consultar información académica.
- Trabajar con grillas de inserción masiva.
- Mostrar dashboards e indicadores según rol.
- Aplicar filtros dependientes de las asignaciones del usuario.
- Mantener trazabilidad visual de cambios.
- Trabajar offline en módulos específicos del Docente.
- Sincronizar cambios pendientes al recuperar conexión.
- Respetar estrictamente los permisos de cada rol.
- Mantener una interfaz responsive en 360, 768, 1280 y 1920 px.

El documento define tres roles principales: **Docente, Supervisor y Directivo**.

---

# 2. Roles y navegación

## 2.1 Docente

### Accesos
- Inicio
- Alumnos
- Rúbrica
- Seguimiento de Lectura
- Registro de Vuelo
- Sesiones

### Puede
- Registrar y editar información de sus estudiantes.
- Trabajar con grillas semanales.
- Registrar asistencia.
- Registrar rúbricas.
- Registrar libros leídos.
- Registrar evaluaciones diagnósticas.
- Consultar historial.
- Crear, editar, activar e inactivar alumnos.
- Trabajar offline en:
  - Rúbrica
  - Seguimiento de Lectura
  - Registro de Vuelo

### No puede
- Acceder a información fuera de sus colegios/grados asignados.
- Modificar la rúbrica oficial.
- Modificar información de otros docentes.
- Eliminar físicamente estudiantes o historial.

---

## 2.2 Supervisor

### Accesos
- Inicio
- Usuarios
- Seguimiento
- Colegios
- Dashboard

### Puede
- Administrar docentes y supervisores.
- Administrar colegios.
- Consultar información consolidada de los nueve colegios.
- Consultar sesiones y auditoría.
- Consultar dashboards.
- Filtrar dashboards por múltiples dimensiones.
- Consultar estudiantes individualmente desde el dashboard.
- Exportar tablas a Excel.
- Exportar gráficas a PNG.

### Importante
Los módulos operativos del Docente (Rúbrica, Seguimiento de Lectura y Registro de Vuelo) no son pantallas de edición para el Supervisor.

---

## 2.3 Directivo

### Accesos
- Inicio
- Usuarios
- Dashboard

### Puede
- Consultar indicadores consolidados.
- Consultar gráficas.
- Consultar rankings.
- Filtrar información autorizada.
- Exportar gráficas a PNG.
- Consultar información agregada.

### Restricciones críticas
- Solo lectura.
- No puede acceder a formularios operativos.
- No puede acceder a auditoría docente.
- No debe visualizar nombres completos de estudiantes.
- Cuando sea necesario identificar un estudiante, se utiliza su identificador interno.

---

# 3. Estructura principal de la aplicación

Se recomienda implementar un layout general:

```text
App
├── Auth
│   ├── Login
│   ├── Recuperar contraseña
│   └── Cambiar contraseña
│
└── Protected Layout
    ├── Sidebar / Navigation
    ├── Header
    ├── Connection / Sync Status
    └── Main Content
        ├── Inicio
        ├── Alumnos
        ├── Rúbrica
        ├── Seguimiento de Lectura
        ├── Registro de Vuelo
        ├── Sesiones
        ├── Usuarios
        ├── Seguimiento
        ├── Colegios
        └── Dashboard
```

El menú debe construirse dinámicamente según el rol.

---

# 4. Autenticación

## Login

Campos:
- Correo institucional
- Contraseña

Comportamiento:
- Validar credenciales.
- Validar que la cuenta esté activa.
- Recibir/gestionar JWT.
- Redirigir al Inicio correspondiente al rol.

Estados que debe manejar el frontend:
- Loading
- Credenciales incorrectas
- Cuenta inactiva
- Error de red
- Sesión expirada

## Recuperación de contraseña

Flujo:

```text
Solicitar recuperación
        ↓
Enviar código al correo institucional
        ↓
Ingresar código
        ↓
Validar código
        ↓
Nueva contraseña
        ↓
Confirmación
```

El código expira después de **15 minutos**.

---

# 5. Sesión

La sesión dura como máximo:

**480 minutos / 8 horas**

Puede terminar por:

1. Usuario presiona "Finalizar sesión".
2. Se cumplen 480 minutos.

El frontend debe manejar:
- Expiración automática.
- Estado de sesión.
- JWT inválido/expirado.
- Cambios offline pendientes.
- Redirección al login cuando corresponda.

Importante: cerrar/expirar la sesión **no debe borrar los cambios pendientes almacenados localmente**.

---

# 6. Inicio / Dashboard inicial

## Docente

Debe mostrar:
- Colegios asignados.
- Grados asignados.
- Estado de registros semanales.
- Estado de evaluaciones diagnósticas.
- Accesos principales.

## Supervisor

Debe mostrar:
- Accesos a indicadores.
- Dashboards.
- Información consolidada.
- Estado de registros.

## Directivo

Debe mostrar:
- Indicadores ejecutivos.
- Dashboards autorizados.

---

# 7. Módulo Alumnos

Acceso: **Docente**

## Listado

Por defecto:
- Mostrar alumnos activos.

Filtros:
- Colegio
- Subprograma
- Ciclo
- Grado
- Estudiante
- Estado

## Acciones

### Crear alumno

Datos principales:
- Nombre completo
- Colegio
- Ciclo
- Grado
- Sección
- Subprograma

El sistema genera un identificador único.

### Editar alumno

- Abrir formulario prellenado.
- Validar campos.
- Guardar cambios.

### Inactivar alumno

Usar baja lógica.

**Nunca eliminar historial académico.**

### Activar alumno

Permitir reactivar un alumno previamente inactivo.

## Ficha del alumno

Debe permitir consultar:
- Información personal.
- Reportes.
- Historial académico.
- Rúbrica.
- Seguimiento de Lectura.
- Registro de Vuelo.
- Auditoría.

---

# 8. Módulo Rúbrica

Acceso: **Docente**

Es uno de los módulos más importantes del frontend.

## Filtros obligatorios y dependientes

Orden:

```text
Colegio
   ↓
Ciclo
   ↓
Grado
   ↓
Semana / fecha
```

Las opciones deben limitarse a las asignaciones del docente.

## Grilla

Una fila por estudiante.

Columnas/campos:

| Campo |
|---|
| Estudiante |
| Asistencia |
| Fluidez Lectora |
| Comprensión Lectora |
| Observaciones / Justificación |

## Comportamiento de asistencia

Si estudiante = **Ausente**:

```text
Fluidez       → disabled
Comprensión   → disabled
```

Visualmente deben aparecer deshabilitados/en gris.

Si vuelve a marcarse como presente:

```text
Fluidez       → enabled
Comprensión   → enabled
```

## Validación de presente

Para cada estudiante presente:

- Debe existir exactamente un criterio de Fluidez.
- Debe existir exactamente un criterio de Comprensión.

No permitir finalizar la evaluación si falta alguno.

## Niveles

Según el contexto pueden aparecer:

- Pre Inicio
- Inicio
- En proceso
- Logrado
- Avanzado

**Pre Inicio** solo corresponde a estudiantes de Alfabetización evaluados en Ciclo III.

## Justificación

Solicitar texto libre cuando:
- Se registra la primera calificación.
- Cambia Fluidez respecto a la sesión anterior.
- Cambia Comprensión respecto a la sesión anterior.

## Semana inexistente

Si no existe grilla:

```text
No existe una grilla registrada para esta semana

[Crear grilla para esta semana]
```

La creación genera las filas correspondientes con campos vacíos.

No copiar automáticamente datos de otras semanas.

## Sesión no realizada

Permitir:

```text
[ ] Sesión no realizada

Motivo:
[Selector de motivos]

Otro motivo:
[Textarea]
```

Si la sesión es "No realizada":
- No registrar asistencia individual.
- No registrar calificaciones individuales.

---

# 9. Módulo Seguimiento de Lectura

Acceso: **Docente**

## Filtros

```text
Colegio
   ↓
Ciclo
   ↓
Grado
   ↓
Semana / fecha
```

## Grilla

Una fila por estudiante.

Campos:

- Libro de Subir de Nivel (LSB)
  - Título
  - Puntaje
- Libros de Sala de Lectura (LSL)
  - Cantidad
- Total de libros
  - Calculado automáticamente
- Observaciones

### Diferencia importante

**LSB**
- Tiene título.
- Tiene puntaje.

**LSL**
- Solo cantidad.
- No tiene título.
- No tiene puntaje.

## Cálculo

El total de libros debe calcularse automáticamente.

El sistema consolida resultados por:
- Estudiante
- Grado
- Colegio
- Mes
- Año

## Sesión no realizada

Mismo comportamiento conceptual que Rúbrica.

No debe registrar lecturas/asistencia individual de una sesión marcada como no realizada.

---

# 10. Módulo Registro de Vuelo

Acceso: **Docente**

Evaluaciones:

- Abril
- Julio
- Octubre
- Diciembre

## Filtros

```text
Colegio
   ↓
Ciclo
   ↓
Grado
   ↓
Año
   ↓
Periodo
```

## Grilla

Datos principales:
- Nivel bruto de Raz-Kids
- Nivel del examen
- Resultado/puntaje
- Resultados de Rúbrica
- Nivel estimado
- Nivel colocado final
- Proyección
- Justificación

Raz-Kids **no se integra directamente**; el docente registra sus resultados manualmente.

---

# 11. Nivel estimado vs nivel colocado

El frontend debe diferenciarlos visualmente.

```text
Nivel bruto Raz-Kids
        ↓
Resultados de Rúbrica
        ↓
Nivel colocado estimado
        ↓
Docente confirma/modifica
        ↓
Nivel colocado final
```

Si el docente modifica el resultado correspondiente, debe mostrar un campo de justificación.

La justificación debe estar relacionada con los resultados de rúbrica.

---

# 12. Proyección de nivel

Debe existir un control diferenciado para indicar una proyección.

Ejemplo:

```text
Nivel vigente: A

Proyección:
[B]

Resultado:
A / B
```

Para la siguiente evaluación se utilizará **A**, es decir, el primer nivel de la notación.

---

# 13. Nivel base

Para abril:

```text
Nivel base = mínimo esperado para el grado
```

Para julio/octubre/diciembre:

```text
Nivel base = nivel colocado del periodo anterior
```

Si el periodo anterior tiene:

```text
A / B
```

el nivel base será:

```text
A
```

---

# 14. Historial académico

El Docente debe poder consultar la evolución de las evaluaciones diagnósticas.

Ejemplo de UI:

```text
Periodo     Nivel colocado
--------------------------------
Abril       B
Julio       C
Octubre     C
Diciembre   D
```

También puede representarse mediante una gráfica de evolución.

---

# 15. Dashboard del Supervisor

Acceso: **Supervisor**

Solo lectura.

Debe incluir:

### KPIs
- Porcentaje de asistencia.
- Promedio de libros leídos.
- Promedios de calificaciones por dimensión.
- Indicadores consolidados.

### Gráficas
- Distribución por nivel de rúbrica.
- Distribución por dimensión.
- Evolución histórica.
- Libros leídos.
- Asistencia.
- Resultados educativos.

## Filtros

El Supervisor puede filtrar por:

- Colegio
- Grado
- Ciclo EBR
- Subprograma
- Estudiante
- Periodo/fechas

Los indicadores y gráficas deben actualizarse según los filtros.

## Filtro individual

El Supervisor puede buscar un estudiante y visualizar una vista individual con:
- Tendencia académica.
- Evolución de rúbrica.
- Libros leídos.

---

# 16. Dashboard del Directivo

Acceso: **Directivo**

Debe ser una interfaz ejecutiva de solo lectura.

Indicadores mencionados:
- Alfabetización lograda.
- Nivel inicial superado.
- Nivel logrado/destacado.
- Nivel sobresaliente.
- Asistencia.
- Libros.
- Promedio anual de libros.
- Alumnos.
- Horas de enseñanza.

## Restricción de privacidad

NO mostrar:
- Nombre completo.
- Apellidos.
- Identificadores directos de menores.

Si se necesita identificar individualmente:

```text
ID interno del estudiante
```

---

# 17. Rankings

Acceso:
- Supervisor
- Directivo

Dentro del Dashboard.

Tipos:

### Ranking de colegios

Comparación entre colegios.

### Ranking de grados

Comparación entre grados de un colegio.

Debe existir selector de subprograma:

```text
[Alfabetización]
[Comprensión Lectora]
```

La interfaz debe ser responsive.

---

# 18. Exportaciones

## PNG

Supervisor y Directivo pueden descargar gráficas/indicadores autorizados.

Requisito:
- Ancho mínimo: **1080 px**
- Permitir:
  - Fondo transparente
  - Fondo blanco/opaco

## Excel

Docente y Supervisor pueden exportar las filas visibles de las tablas autorizadas.

Debe respetar:
- Filtros actuales.
- Permisos del usuario.
- Datos visibles.

---

# 19. Módulo Sesiones

Acceso: **Docente**

Solo lectura.

Mostrar listado:

| Campo |
|---|
| ID de sesión |
| Inicio |
| Fin |
| Estado |
| Resumen de cambios |

Al abrir una sesión:

```text
Registro afectado
Tipo de acción
Fecha/hora
Campo modificado
Valor anterior
Valor nuevo
```

---

# 20. Módulo Seguimiento

Acceso: **Supervisor**

Solo lectura.

Debe permitir consultar:
- Sesión.
- Docente.
- Colegio.
- Grado.
- Sección.
- Fecha.
- Hora inicio.
- Hora fin.
- Estado de sincronización.

Al seleccionar una sesión:
- Mostrar detalle expandible.
- Mostrar cambios.
- Mostrar valor anterior/nuevo.

Para cambios offline sincronizados, mostrar una indicación visual equivalente a:

```text
Sincronizado de forma diferida
```

y diferenciar:
- Hora de captura.
- Hora de recepción en servidor.

---

# 21. Módulo Usuarios

Acceso:
- Supervisor
- Directivo

## Supervisor

Puede:
- Crear Docentes.
- Crear Supervisores.
- Editar.
- Activar.
- Inactivar.

## Directivo

Puede:
- Crear Directivos.
- Activar.
- Inactivar.

Los docentes no tienen acceso a este módulo.

---

# 22. Módulo Colegios

Acceso: **Supervisor**

Funciones:
- Listar colegios.
- Crear.
- Editar.
- Configurar grados/secciones.
- Activar.
- Desactivar.

Desactivar = **baja lógica**.

Nunca eliminar físicamente los datos históricos.

---

# 23. Offline / PWA

Esta es una de las partes más importantes del frontend.

Los módulos que deben funcionar offline son:

```text
Rúbrica
Seguimiento de Lectura
Registro de Vuelo
```

## Condición

El docente debe:
1. Iniciar sesión con internet.
2. Tener sesión válida.
3. Tener previamente cargados los datos necesarios.

La sesión offline tiene una vigencia máxima de 8 horas.

## IndexedDB

Usar **IndexedDB** para:
- Cambios offline.
- Datos pendientes.
- Trazabilidad.
- Cola de sincronización.

Ejemplo conceptual:

```text
IndexedDB
├── pendingChanges
├── sessionData
├── cachedStudents
├── cachedRubrics
├── cachedReadingReports
└── cachedFlightRecords
```

## localStorage

Usarlo para los filtros previamente seleccionados.

Ejemplo:

```text
rubricaFilters
lecturaFilters
vueloFilters
```

Al regresar a cada módulo, restaurar los filtros.

---

# 24. Sincronización

Cuando vuelve internet:

```text
Internet OFF
     ↓
Usuario modifica datos
     ↓
Guardar en IndexedDB
     ↓
Estado: Pendiente de sincronización
     ↓
Internet ON
     ↓
Validar sesión + permisos
     ↓
Enviar cambios
     ↓
Servidor confirma
     ↓
Marcar como sincronizado
```

El documento establece que la sincronización debe iniciar dentro de los **60 segundos** posteriores a disponer de conexión y sesión válida.

Debe evitarse duplicar registros cuando se reintenta una sincronización.

---

# 25. Indicador visual de conexión

El frontend debería comunicar claramente:

```text
● Online
● Offline
● Sincronizando...
● Cambios pendientes
✓ Sincronizado
⚠ Error de sincronización
```

Especialmente importante en los módulos del Docente.

No ocultar al usuario que está trabajando offline.

---

# 26. Reglas de UI/UX críticas

## Filtros dependientes

Nunca mostrar al Docente opciones que no correspondan a sus asignaciones.

Ejemplo:

```text
Colegio seleccionado
      ↓
solo ciclos disponibles
      ↓
solo grados disponibles
      ↓
solo semanas disponibles
```

## Grillas

Deben soportar inserción masiva.

Características recomendadas:
- Sticky header.
- Scroll horizontal controlado.
- Una fila por estudiante.
- Edición rápida.
- Estados visuales claros.
- Validación por fila.
- Indicador de cambios pendientes.

## Formularios

Mostrar claramente:
- Campos obligatorios.
- Errores.
- Campos deshabilitados.
- Confirmaciones.
- Cambios pendientes.
- Estado de guardado.

---

# 27. Estados que el frontend debe contemplar

Cada pantalla debería considerar como mínimo:

```text
loading
success
empty
error
offline
syncing
pending-sync
readonly
unauthorized
session-expired
validation-error
```

Ejemplo:

```text
Loading
   ↓
Datos encontrados → mostrar tabla

Sin datos
   ↓
"No existe una grilla registrada para esta semana"
   ↓
[Crear grilla]
```

---

# 28. Responsividad

El sistema debe adaptarse a:

- **360 px**
- **768 px**
- **1280 px**
- **1920 px**

No debe existir:
- Overflow horizontal innecesario.
- Controles ocultos.
- Operaciones imposibles de completar.

La navegación debe ser responsive.

En desktop:
```text
Sidebar + contenido
```

En móvil:
```text
Header
Menu compacto
Contenido
```

Las grillas de datos probablemente requieren scroll horizontal controlado sin romper el layout.

---

# 29. Identidad visual

El documento exige mantener consistencia con la identidad visual institucional:

- Logotipo oficial.
- Tipografía oficial.
- Colores oficiales de Misión Huascarán.

No inventar una identidad visual diferente para el sistema si no existe una definición adicional.

---

# 30. Seguridad desde frontend

El frontend debe reflejar los permisos, pero **no confiar únicamente en ellos**.

Debe:
- Ocultar módulos no autorizados.
- Proteger rutas.
- Manejar JWT.
- Manejar sesión expirada.
- No mostrar datos que el rol no puede consultar.
- No permitir acciones visualmente disponibles cuando el usuario no tiene permisos.

El backend debe validar JWT, rol y asignaciones en cada solicitud protegida.

---

# 31. Arquitectura frontend sugerida

Una organización práctica:

```text
src/
├── app/
│   ├── router/
│   ├── layouts/
│   └── providers/
│
├── auth/
│   ├── login/
│   ├── recovery/
│   └── session/
│
├── modules/
│   ├── home/
│   ├── students/
│   ├── rubric/
│   ├── reading/
│   ├── flight-record/
│   ├── sessions/
│   ├── users/
│   ├── tracking/
│   ├── schools/
│   └── dashboard/
│
├── components/
│   ├── tables/
│   ├── forms/
│   ├── filters/
│   ├── charts/
│   ├── modals/
│   └── feedback/
│
├── services/
│   ├── api/
│   ├── auth/
│   └── sync/
│
├── storage/
│   ├── indexeddb/
│   └── localstorage/
│
├── hooks/
├── types/
├── utils/
└── styles/
```

Esto es una propuesta de organización para implementación frontend; el documento fuente define las funcionalidades y restricciones, no esta estructura exacta de carpetas.

---

# 32. Prioridad de implementación frontend

## P0 — Fundamental

1. Autenticación.
2. Manejo de roles/permisos.
3. Layout y navegación.
4. Inicio.
5. Alumnos.
6. Rúbrica.
7. Seguimiento de Lectura.
8. Registro de Vuelo.
9. IndexedDB.
10. Sincronización offline/online.
11. Sesión de 8 horas.
12. Responsive.

## P1 — Administración y supervisión

13. Usuarios.
14. Colegios.
15. Sesiones.
16. Seguimiento.
17. Dashboard Supervisor.

## P2 — Ejecutivo y exportación

18. Dashboard Directivo.
19. Rankings.
20. Exportación Excel.
21. Exportación PNG.

---

# 33. Checklist final para el frontend

### Auth
- [ ] Login
- [ ] Recuperar contraseña
- [ ] Cambiar contraseña
- [ ] JWT
- [ ] Expiración 8 h
- [ ] Logout

### Roles
- [ ] Docente
- [ ] Supervisor
- [ ] Directivo
- [ ] Protección de rutas
- [ ] Menú dinámico

### Docente
- [ ] Inicio
- [ ] Alumnos
- [ ] Rúbrica
- [ ] Seguimiento de Lectura
- [ ] Registro de Vuelo
- [ ] Sesiones

### Supervisor
- [ ] Inicio
- [ ] Usuarios
- [ ] Seguimiento
- [ ] Colegios
- [ ] Dashboard

### Directivo
- [ ] Inicio
- [ ] Usuarios
- [ ] Dashboard
- [ ] Vista sin nombres de menores

### Offline
- [ ] IndexedDB
- [ ] Cola de cambios
- [ ] Sincronización
- [ ] Indicador online/offline
- [ ] localStorage de filtros
- [ ] Manejo de conflictos/errores
- [ ] Persistencia después de expiración de sesión

### UI
- [ ] Responsive 360
- [ ] Responsive 768
- [ ] Responsive 1280
- [ ] Responsive 1920
- [ ] Estados loading/empty/error
- [ ] Grillas masivas
- [ ] Formularios
- [ ] Modales de confirmación
- [ ] Validaciones
- [ ] Solo lectura según rol

### Dashboard
- [ ] KPIs
- [ ] Gráficas
- [ ] Filtros
- [ ] Evolución
- [ ] Rankings
- [ ] PNG
- [ ] Excel

---

## 34. Puntos que NO deben implementarse como funcionalidades normales

El documento identifica algunos límites importantes:

- No integración directa con Raz-Kids.
- No autoregistro.
- No eliminación física de estudiantes.
- No eliminación física del historial.
- No modificación de la rúbrica oficial por docentes.
- No acceso del Directivo a formularios operativos.
- No nombres completos de estudiantes para Directivo.
- No sugerencias de cambio de nivel mediante IA en la versión actual: está **fuera de alcance**.

---

## 35. Resumen para pasar a Claude Code

> Construir el frontend de SICEDU como una aplicación web responsive orientada a tres roles: Docente, Supervisor y Directivo. La navegación y las rutas deben depender del rol. El Docente gestiona Alumnos, Rúbrica, Seguimiento de Lectura, Registro de Vuelo y Sesiones; el Supervisor gestiona Usuarios, Seguimiento, Colegios y Dashboard; el Directivo accede a Usuarios y Dashboard ejecutivo.
>
> Los módulos de Rúbrica, Seguimiento de Lectura y Registro de Vuelo del Docente deben funcionar offline durante una sesión previamente autenticada con internet, almacenando cambios pendientes en IndexedDB y filtros en localStorage. Al recuperar conexión, los cambios deben sincronizarse y evitar duplicados.
>
> Las pantallas de registro deben usar grillas editables para inserción masiva, filtros dependientes de las asignaciones del Docente y validaciones dinámicas. Rúbrica debe deshabilitar Fluidez y Comprensión cuando el estudiante está ausente y exigir ambas calificaciones cuando está presente. Registro de Vuelo debe separar nivel bruto Raz-Kids, nivel estimado y nivel colocado final, incluyendo justificación cuando corresponda.
>
> Dashboard Supervisor y Directivo son principalmente de consulta. El Supervisor puede filtrar por colegio, grado, ciclo, subprograma, estudiante y periodo. El Directivo solo debe visualizar información agregada y nunca nombres completos de menores.
>
> Toda la aplicación debe ser responsive para 360/768/1280/1920 px, mantener la identidad visual institucional, manejar estados loading/empty/error/offline/syncing/readonly/unauthorized/session-expired y respetar los permisos tanto en la interfaz como en las rutas.
