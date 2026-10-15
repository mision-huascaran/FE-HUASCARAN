# SICEDU: guía del backend para el frontend

**Para:** Antonio (frontend)
**De:** Paris (backend)
**Estado:** backend en `development`, commit `1c81d85` (Tandas 1 a 7, CU001 a CU021). 8 de octubre de 2026.

Esta guía reúne todo lo que el frontend necesita considerar. Reemplaza a la versión anterior y a las respuestas sueltas por WhatsApp. **Los esquemas exactos de cada request y response están en Swagger (`/docs`)**; aquí se explican las reglas, los flujos, los códigos de error y lo que cambió. Si algo de aquí no coincide con `/docs`, avísame: manda `/docs`.

## Índice

1. [Reglas generales](#1-reglas-generales)
2. [Roles y navegación](#2-roles-y-navegación)
3. [Login, sesión y logout (CU001 a CU003, CU007, CU008)](#3-login-sesión-y-logout)
4. [Recuperación y cambio de contraseña (CU004 a CU006)](#4-recuperación-y-cambio-de-contraseña)
5. [Inicio por rol y actividades (CU009 a CU012)](#5-inicio-por-rol-y-actividades)
6. [Colegios y catálogos (CU013)](#6-colegios-y-catálogos)
7. [Alumnos y detalle del alumno (CU014, CU015)](#7-alumnos-y-detalle-del-alumno)
8. [Usuarios (CU016)](#8-usuarios)
9. [Sesiones del Docente (CU017 a CU019)](#9-sesiones-del-docente)
10. [Seguimiento del Supervisor (CU020, CU021)](#10-seguimiento-del-supervisor)
11. [Consideraciones offline (PWA)](#11-consideraciones-offline-pwa)
12. [Lo que todavía no existe](#12-lo-que-todavía-no-existe)
13. [Respuesta a tu `APIS_BACKEND.md`](#13-respuesta-a-tu-apis_backendmd)
14. [Cambios de contrato recientes (resumen)](#14-cambios-de-contrato-recientes-resumen)
15. [Entorno y datos de prueba](#15-entorno-y-datos-de-prueba)

---

## 1. Reglas generales

### 1.1 Autenticación

- Todas las rutas, salvo login y recuperación de contraseña, piden `Authorization: Bearer <token>`.
- El backend **valida el rol y el alcance en cada petición**. Ocultar opciones en la interfaz es solo UX (CU001); no reemplaza nada.

### 1.2 Fechas y horas

| Tipo | Formato | Cómo usarlo |
|---|---|---|
| **Instante** (cuándo pasó algo) | ISO 8601 en UTC con `Z`, ej. `"2026-10-08T19:10:00Z"` | Mostrar **siempre en hora de Lima** (America/Lima). |
| **Día de calendario** | `"AAAA-MM-DD"` | Es un día de Lima. Mostrar tal cual, sin convertir zona. |
| Instantes que **envías** tú | ISO 8601 **con zona** (`Z` o `-05:00`) | Sin zona → 422. Se aceptan hasta 2 minutos de adelanto del reloj del dispositivo. |

Los filtros `desde` / `hasta` de los listados son días de Lima, inclusivos.

### 1.3 Formato de errores

**Error de negocio:**
```json
{"detail": "Mensaje para mostrar", "motivo": "codigo_estable"}
```
Usa `motivo` para decidir qué hacer y `detail` para mostrar. No compares `detail`: el texto puede ajustarse.

**Error de validación (422):**
```json
{"detail": "…", "motivo": "validacion", "errores": [ … por campo … ]}
```
Sirve para marcar en rojo cada campo del formulario.

**401 (sin sesión válida):**

| `motivo` | Cuándo | Qué hacer |
|---|---|---|
| `sesion_invalida` | sin token, token mal formado, sesión cerrada o invalidada | limpiar el estado local y llevar al login |
| `sesion_expirada` | pasaron las 8 horas | lo mismo, mostrando que la sesión terminó por alcanzar su tiempo máximo de vigencia (CU007) |

**403 por rol:**
```json
{"detail": "No tienes permisos para realizar esta acción", "motivo": "sin_permiso"}
```

**Otros códigos que verás:** 404 con `motivo` (recurso inexistente o fuera de tu alcance), 409 con `motivo` (conflicto de negocio) y 429 (demasiados intentos de login).

### 1.4 Paginación

- Todos los listados paginan de **10 en 10** con el parámetro `page` y responden con el esquema `Paginado` (ver `/docs`).
- Al cambiar un filtro, vuelve a la página 1 (CU013, CU014).

### 1.5 Estados y valores fijos

- Los estados nuevos usan códigos `snake_case` (`en_curso`, `finalizada`, `sincronizada`, `al_dia`…). **Las etiquetas visibles las pones tú.**
- **Excepción temporal:** `tipo_cierre` de las actividades todavía viaja como texto completo ("Manual por finalización de actividad"…). **Pasará a códigos** (`manual`, `forzado_cierre_sesion`, `expiracion_sesion`) en una próxima entrega. Centraliza esa traducción en un solo lugar de tu código para que el cambio sea de una línea.
- Si un indicador viene en `null`, muestra **"Sin datos disponibles"**, nunca `0` ni un valor inventado (CU012).

---

## 2. Roles y navegación

| Sección (sidebar) | Docente | Supervisor | Directivo |
|---|---|---|---|
| Inicio | ✅ CU010 | ✅ CU011 | ✅ CU012 |
| Colegios | ❌ (oculto) | ✅ CU013 | ❌ |
| Alumnos | ✅ su alcance | ✅ global | ❌ (403) |
| Usuarios | ❌ | ✅ CU016 | ❌ |
| Sesiones | ✅ CU017 a CU019 | ❌ | ❌ |
| Seguimiento | ❌ | ✅ CU020, CU021 | ❌ |
| Cerrar sesión | ✅ | ✅ | ✅ |

- **Alcance del Docente:** sus asignaciones vigentes (colegio + grado del periodo actual) en colegios **activos**. Para filtros y precarga, el Docente puede **leer** los colegios de su alcance aunque no vea la sección Colegios.
- **Directivo:** solo su Inicio. No ve datos personales de alumnos.
- Las asignaciones del usuario actual salen **del token**: `GET /me` y, para el Docente, `GET /me/asignaciones`. No uses endpoints por id de docente para esto.

---

## 3. Login, sesión y logout

### 3.1 Login (CU001, CU002, CU003)

- `POST /login` con correo y contraseña. El correo se normaliza a minúsculas en el servidor.
- **Mensajes exactos (los manda el backend en `detail`):**

| Caso | Código | Mensaje |
|---|---|---|
| Credenciales incorrectas (también para correos no registrados) | 401 | "Correo o contraseña incorrectos." |
| Cuenta desactivada con credenciales correctas | 401/403 (ver `/docs`) | "Su cuenta se encuentra desactivada. Comuníquese con el Supervisor para solicitar su habilitación." |
| Bloqueo por 5 fallos seguidos (15 minutos, por correo) | **429** | "Demasiados intentos fallidos. Por seguridad, intente nuevamente en 15 minutos." |

- Un intento sobre una cuenta desactivada **cuenta como fallo**. El bloqueo aplica igual a correos que no existen, para no revelar cuentas. Un login exitoso reinicia el contador.
- **Sin conexión:** no intentes el login. Deshabilita "Ingresar" y "¿Olvidó su contraseña?" (en gris) y muestra "No se pudo establecer conexión con el servidor. Para iniciar sesión es necesario disponer de conexión a Internet." **Nunca** valides credenciales con datos locales ni guardes contraseñas.

### 3.2 La sesión

- El JWT trae `sub` (usuario), `jti` (id de la sesión en el servidor), `iat` y `exp`.
- **Dura 8 horas desde el login y no se renueva**: ni navegando, ni recargando, ni iniciando actividades, ni recuperando conexión (CU003, CU007).
- Usa `exp` para la hora "La sesión finaliza a las HH:MM" (CU010) y para cerrar la sesión en el cliente al llegar esa hora, aunque estés sin conexión. El servidor también la cierra: después de `exp` cualquier petición da 401 `sesion_expirada`.
- **Sin cronómetro regresivo** (CU010): muestra horas fijas.

### 3.3 Logout (CU007, CU008)

- `POST /logout` **cierra de verdad la sesión en el servidor**: el token deja de servir de inmediato.
- Si el Docente tenía una actividad en curso, el backend la cierra sola como "Forzado por cierre de sesión". No necesitas llamar antes a `/finalizar`.
- Al cerrar sesión (manual o por expiración):
  - Limpia el estado de autenticación y los filtros de LocalStorage (CU014 exige destruir esa caché).
  - **No borres registros pendientes de sincronizar** en IndexedDB (CU007, CU008), cuando exista el modo offline.
- **Expiración (cierre automático):** la actividad activa se cierra como "Automático por expiración de sesión", con fin igual a la hora de expiración.
- **Otras invalidaciones:** al restablecer la contraseña o al desactivar la cuenta, todas las sesiones del usuario quedan invalidadas. Esa persona recibe 401 `sesion_invalida` en su siguiente petición.

---

## 4. Recuperación y cambio de contraseña

### 4.1 Política de contraseña (CU006)

- Mínimo **8 caracteres**, con al menos **una mayúscula, una minúscula, un número y un carácter especial**.
- Distinta de la inmediatamente anterior.
- El backend responde 422 indicando **qué requisitos no se cumplen**. Valídalo también en el formulario para dar feedback inmediato, pero el backend manda.

### 4.2 Recuperación con PIN (CU004 a CU006), sin sesión

1. **Pedir el PIN:** `POST /password/recuperar` con el correo.
   - Responde **siempre igual**: "Si el correo está registrado y activo, recibirá un PIN." Da lo mismo si el correo existe, si la cuenta está desactivada o si se superó el límite. No muestres otra cosa.
   - Límite: 5 solicitudes por hora por correo, aplicado en silencio.
2. **El PIN:** 6 dígitos numéricos, vale 15 minutos, admite 5 intentos. Pedir uno nuevo invalida el anterior.
3. **Verificar y restablecer:** `POST /password/restablecer` con correo, PIN, contraseña nueva y confirmación (nombres exactos de los campos en `/docs`; algunos llevan ñ, como `contraseña_nueva`). Errores con `motivo`:

| `motivo` | Mensaje (CU006) | Qué hacer |
|---|---|---|
| `incorrecto` | "El código ingresado es incorrecto. Inténtelo nuevamente." | dejar reintentar |
| `expirado` | "El código ha expirado. Solicite un nuevo PIN." | volver a pedir PIN |
| `intentos_agotados` | "Se alcanzó el número máximo de intentos permitidos. Solicite un nuevo PIN para continuar." | volver a pedir PIN |
| `password_igual` | "La nueva contraseña debe ser diferente de la contraseña anterior." | pedir otra contraseña |
| `validacion` (422) | requisitos incumplidos, o "Las contraseñas no coinciden." | marcar los campos |

4. **Al terminar**, todas las sesiones del usuario quedan invalidadas. Lleva al login.

- **Sin conexión:** "No es posible recuperar o cambiar la contraseña sin conexión a Internet. Conéctese a Internet e inténtelo nuevamente." (CU004).

### 4.3 Cambio de contraseña con sesión iniciada

`/me/password/codigo`, `/me/password/verificar-codigo` y `/me/password` **se mantienen** (no están en los CU, pero el equipo de análisis pidió conservarlos). Aplican la misma política y los mismos `motivo`.

### 4.4 Recovery Keys (solo Supervisor original)

- Existe un endpoint público para recuperar la cuenta del Supervisor original con una de sus 10 llaves de un solo uso (ruta y cuerpo en `/docs`).
- Tarda unos **7 segundos por intento**, a propósito (tiempo uniforme por seguridad). Muestra un indicador de carga.
- **Falta decidir si esta pantalla va en la app.** Si la haces, que sea un enlace discreto en la pantalla de recuperación.

---

## 5. Inicio por rol y actividades

### 5.1 Actividad de trabajo del Docente (CU009, CU010)

La **actividad** no es la sesión:
- Una sesión puede tener varias actividades seguidas, pero **solo una activa a la vez**.
- Ninguna actividad pasa de la expiración de la sesión.
- Las escrituras del Docente (por ahora, Alumnos) **exigen una actividad activa**: sin ella reciben 409 `actividad_requerida`.

**`POST /actividades`** con `{"id_actividad": "<UUID generado por ti>", "inicio"?: "<instante con zona>"}`
- Genera el UUID en el cliente, para poder reintentar sin duplicar.
- **201** si la crea; **200** si ese UUID ya era tuyo (mismo cuerpo de respuesta).
- `inicio` es opcional; si lo mandas, va con zona.

| Error | `motivo` | Mensaje / significado |
|---|---|---|
| 409 | `actividad_activa_existente` | hay que finalizar la actividad actual antes de iniciar otra |
| 409 | `sin_asignaciones` | "No puede iniciar una actividad porque no tiene asignaciones activas." |
| 409 | `actividad_id_en_uso` | ese UUID es de otro docente; genera otro |
| 422 | `inicio_invalido` | la hora debe estar entre el inicio de la sesión y ahora |
| 422 | `validacion` | id que no es UUID, o `inicio` sin zona |
| 403 | `sin_permiso` | Supervisor o Directivo |

**`POST /actividades/{id}/finalizar`** con cuerpo opcional `{"fin"?: "<instante con zona>"}`
- Sin `fin`, usa la hora actual. Responde 200 con `tipo_cierre` "Manual por finalización de actividad".
- Repetirlo da 200 sin cambios.
- **No cierra la sesión**: después se puede iniciar otra actividad.

| Error | `motivo` | Significado |
|---|---|---|
| 422 | `fin_invalido` | antes del inicio, en el futuro o después de la expiración de la sesión |
| 404 | `actividad_no_encontrada` | ajena o inexistente |

**Estado de la actividad en las respuestas:** `"en_curso"` o `"finalizada"`. **Cambió en la Tanda 7**: antes era `"Activa"` / `"Finalizada"`.

`sesion_expira` siempre es la expiración de la sesión del token.

**UI (CU010):**
- Botón "Iniciar actividad" o "Finalizar actividad" en la esquina superior derecha del Inicio.
- Sin asignaciones, "Iniciar actividad" se muestra **deshabilitado, no oculto**, con el mensaje de `sin_asignaciones`.
- Con actividad en curso: "Actividad iniciada a las HH:MM. La sesión finaliza a las HH:MM."

### 5.2 Inicio del Docente: `GET /inicio/docente`

- **`actividad_activa`:** `{id, inicio}` o `null`.
- **`puede_iniciar_actividad`:** booleano. Úsalo para habilitar el botón.
- **`sesion_expira`:** siempre presente.
- **`asignaciones`:** por colegio, con sus `grados`. Cada grado trae `cantidad_alumnos`, `ciclos` y `subprogramas`.
- **`totales`:** `{ciclos, subprogramas, cantidad_alumnos}` para las tarjetas de CU010.
- **Sin periodo vigente** (vacaciones): `asignaciones` vacío y `puede_iniciar_actividad` en false, aunque `actividad_activa` siga mostrando una actividad abierta (para que pueda finalizarla).
- `GET /me/asignaciones` devuelve las mismas asignaciones con el mismo detalle.
- **Resúmenes de acción** ("Has evaluado X de Y", "Tienes N registros offline pendientes", completados por módulo): **todavía no existen** (ver §12). No los muestres o déjalos como placeholder.

### 5.3 Inicio del Supervisor: `GET /inicio/supervisor` (CU011)

- **Contadores:** colegios, docentes activos y docentes con actividad en curso.
- **`pendientes` e `incompletos`:** hoy vienen `null`, porque dependen de las grillas. Muestra "Sin datos disponibles".
- **`alertas`:** lista con `tipo` y `mensaje` ya redactado.
  - Hoy solo existe `tipo: "docente_inactivo"`, por ejemplo "Atención: El docente Carlos lleva 4 días hábiles sin iniciar actividad."
  - Más adelante llegará otro `tipo` (colegio sin registros). **Muestra cualquier `tipo` usando su `mensaje`**, sin asumir que solo existe uno.
  - Destácalas en rojo **con texto o ícono** además del color (CU011).
  - Sin alertas: "No existen alertas de inactividad pendientes de atención."
- **Regla de la alerta del docente:** 4 días hábiles o más sin iniciar actividad.
  - Se cuenta desde el día siguiente a su último inicio en el periodo, o desde que se le asignó el colegio, o desde el inicio del periodo (lo más reciente), hasta ayer.
  - Los días hábiles son de lunes a viernes, dentro de un bimestre y sin feriados.
  - Un docente recién asignado o rotado no aparece de inmediato.

### 5.4 Inicio del Directivo: `GET /inicio/directivo` (CU012)

Solo tres tarjetas:
- **Beneficiarios Activos:** alumnos activos.
- **Colegios Operando:** colegios activos con al menos una asignación vigente en el periodo actual.
- **`salud_sistema`:** hoy siempre `null` → "Sin datos disponibles". No inventes un porcentaje.

Sin gráficos ni desgloses. Sin nombres de alumnos.

### 5.5 Offline en los Inicios

CU011 y CU012 piden guardar en LocalStorage **el último resumen** (sin credenciales ni datos sensibles) y mostrarlo sin conexión **marcado como potencialmente desactualizado**.

---

## 6. Colegios y catálogos

### 6.1 Colegios (CU013), solo Supervisor para gestionar

- **Listado:** activos por defecto; filtros `departamento`, `distrito` y estado (`activo`); paginación de 10.
- **`GET /colegios/ubicaciones`:** valores existentes para llenar los desplegables de filtro.
- **Campos:**
  - `nombre`, `departamento` y `distrito`: obligatorios al crear (422 si faltan).
  - `provincia`: antes `zona`.
  - `nivel_educativo` (por defecto "Primaria") y `seccion` (por defecto "Única"): editables.
  - Grados y subprogramas ofrecidos: multi-select.
- **Nombre único** ignorando mayúsculas, espacios y tildes: "Shilla" y "SHILLA " chocan (409).
- **Activar / inactivar:** es un borrado lógico y no toca alumnos ni registros. Un colegio inactivo deja de contar como operando y sale del alcance de sus docentes. Pide confirmación con un modal antes de cambiar el estado.
- **PATCH con `null` en un campo obligatorio:** 422 (antes daba 500).
- **Docente:** puede leer los colegios de su alcance (para filtros y precarga).

### 6.2 Catálogos

Están disponibles los grados, programas (subprogramas), ciclos, roles, periodos y años, entre otros (8 catálogos; lista exacta en `/docs`). Pide cada uno una sola vez al iniciar sesión y guárdalo en IndexedDB para la precarga offline (CU003).

---

## 7. Alumnos y detalle del alumno

### 7.1 Gestión (CU014)

**Permisos:**
- **Supervisor:** crea y edita en cualquier colegio (ingesta inicial y rotaciones).
- **Docente:** solo en su alcance, y **con actividad activa** para escribir (409 `actividad_requerida`). Para leer no necesita actividad.
- **Directivo:** 403.

**Validaciones:**
- El colegio debe ofrecer el grado y el subprograma.
- **1.º grado solo admite Alfabetización** (422).
- La sección es la del colegio: muéstrala como solo lectura.
- El **ciclo lo calcula el backend**: Alfabetización → III; Comprensión Lectora → según el grado (2.º III, 3.º y 4.º IV, 5.º y 6.º V). No lo envíes.

**Listado:** activos por defecto; filtros colegio, subprograma, ciclo, grado y estado; paginación de 10.

**Activar / inactivar:**
- Es un borrado lógico, con modal de confirmación.
- El alumno inactivo desaparecerá de las grillas cuando existan.

**Cambio de subprograma:** queda registrado por periodo en el historial del alumno.

### 7.2 Vista de detalle (CU015), un endpoint por pestaña

| Endpoint | Pestaña / contenido |
|---|---|
| `GET /alumnos/{id}` | Cabecera: nombre y etiquetas (colegio, subprograma, ciclo, grado, estado). El avatar con iniciales lo generas tú. |
| `GET /alumnos/{id}/resumen` | Tarjetas: **nivel actual** (hoy `null` → "Sin datos disponibles"), **libros leídos** del año (LSL + LSB) y **% de asistencia**. |
| `GET /alumnos/{id}/registro-vuelo` | Datos para la gráfica y la mini-grilla (abril, julio, octubre, diciembre). |
| `GET /alumnos/{id}/rubrica` | Registros recientes. |
| `GET /alumnos/{id}/lectura` | Registros semanales recientes. |
| `GET /alumnos/{id}/historial` | Eventos del año escolar, a partir de la auditoría. **Exige conexión** (CU015): sin conexión, muestra el Empty State del CU. |

- Las pestañas de Vuelo, Rúbrica y Lectura saldrán vacías mientras no existan las grillas (§12). Muestra un estado vacío amable.
- El **historial** agrupa las filas por evento: varias filas con la misma fecha y autor son una sola edición, con el detalle de los campos cambiados. Ejemplo: "Rosa Camones editó la información del alumno el 07/10/2026 a las 09:05".

---

## 8. Usuarios

### 8.1 Gestión (CU016), solo Supervisor para los 3 roles

- **Creación:** un solo `POST /usuarios` con `id_rol`. **`/profesores` ya no existe.**
- **Docente:** agrega **año escolar, colegio y grados**. El backend crea el usuario, el docente y las asignaciones en una sola transacción.
  - Por ahora, **un solo colegio** por docente, que atiende **todos los grados que ese colegio ofrece**. Puedes preseleccionarlos.
  - Las asignaciones se crean desde el periodo vigente (o desde el primero si el año aún no empezó). Los periodos pasados nunca se tocan.
  - **Renovar** = editar el año escolar. **Rotar** = editar el colegio, indicando desde qué periodo aplica.
  - Un aula (colegio + grado + periodo) solo puede tener un docente (409 si ya está ocupada).
- **DNI:** obligatorio, 8 dígitos, único (409 si se repite). **Correo:** único (409).
- **Credenciales:**
  - El backend genera una contraseña temporal que cumple la política y la envía por correo.
  - Si el correo falla, la respuesta trae `correo_enviado: false` y la `contraseña_temporal` para mostrarla una sola vez.
- **Listado:**
  - Ordenado por rol (Docentes, Supervisores, Directivos) y luego alfabético.
  - Columnas: nombre, DNI, correo, rol, colegios asignados.
  - **`colegios_asignados`** es una **lista**: nombres de colegios para docentes y `["Global"]` para Supervisor y Directivo.
  - Filtros: rol, estado (`activo`) y nombre (`q`). Paginación de 10.
- **`es_supervisor_original`** viene en el listado. Para esa cuenta: deshabilita el switch de estado y el cambio de rol; correo, nombres y DNI sí se editan.
- **Restricciones:**
  - Nadie puede desactivarse ni cambiar su propio rol (409). Deshabilita esos controles en la fila del usuario actual.
  - **Desactivar** cierra las sesiones de esa persona y, si es docente, **libera sus aulas** desde el periodo vigente.
  - **Reactivar no restaura las asignaciones**: después hay que asignarle colegio de nuevo. Conviene avisarlo en el modal de confirmación.
- Todas las escrituras quedan en la auditoría.

---

## 9. Sesiones del Docente (CU017 a CU019)

En la interfaz se llama "Sesiones", pero en la API son **actividades**. El "ID de sesión" de los CU es el `id` de la actividad.

### 9.1 Listado: `GET /actividades` (solo Docente, solo las suyas)

**Query (todos opcionales; omitir = "Todos"):**

| Parámetro | Valores |
|---|---|
| `desde`, `hasta` | `AAAA-MM-DD`, días de Lima, inclusivos, sobre el inicio |
| `estado` | `en_curso` \| `finalizada` |
| `sincronizacion` | `sincronizada` \| `pendiente` \| `error` |
| `tipo_cierre` | uno de los 3 textos (pasará a códigos, ver §1.5) |
| `page` | número de página |

- Rango invertido → 422 `rango_fechas_invalido` ("El rango de fechas no es válido…").
- "Limpiar filtros" = llamar sin parámetros.
- Los filtros se guardan en LocalStorage (CU018); los resultados no.

**Cada fila (`ActividadResumen`):**

```json
{"id", "id_docente", "fecha", "inicio", "fin", "duracion_segundos", "estado", "tipo_cierre",
 "sincronizacion", "cambios", "productividad": [{"modulo", "cantidad"}], "productividad_texto"}
```

- En curso: `fin` y `tipo_cierre` vienen `null` (muestra "No aplica"), y la duración es la transcurrida hasta la consulta.
- **Estado de la sesión y estado de sincronización son independientes** (CU017): muéstralos en columnas separadas.
- `cambios` = registros distintos afectados (crear un alumno con 6 campos cuenta 1).
- Sin sesiones: página vacía. Muestra que no existen sesiones para consultar.

### 9.2 Detalle: `GET /actividades/{id}` (solo Docente, solo las suyas)

```json
{"id", "fecha", "inicio", "fin", "duracion_segundos", "estado", "tipo_cierre", "sincronizacion",
 "sincronizado_en", "registros_pendientes", "cambios",
 "cambios_por_modulo": [{"modulo", "total", "creados", "editados", "activados", "inactivados"}],
 "asignaciones": [{"colegio": {"id", "nombre"}, "grado": {"id", "nombre"}, "ciclo", "seccion"}]}
```

- `sincronizado_en` es la "fecha y hora de la última sincronización".
- `registros_pendientes` hoy es 0.
- Ajena o inexistente: 404 `actividad_no_encontrada`, "El detalle solicitado no se encuentra disponible." Supervisor: 403.
- **Consulta solo en línea** (CU017 a CU019): sin conexión, muestra el Empty State del CU y no uses datos locales.

### 9.3 Valores de `modulo`

`rubrica`, `seguimiento_lectura`, `registro_vuelo`, `alumnos`, `asistencia`, `otros`.

Los CU solo nombran Rúbrica, Lectura y Vuelo. Alumnos se agregó porque el Docente también edita alumnos durante la actividad; se está validando con análisis. Hoy solo verás `alumnos`.

---

## 10. Seguimiento del Supervisor (CU020, CU021)

### 10.1 Tabla general: `GET /seguimiento/docentes`

**Query:**

| Parámetro | Valores |
|---|---|
| `id_colegio` | colegio de sus asignaciones vigentes |
| `desde`, `hasta` | sobre la última conexión; quien nunca se conectó queda fuera si envías el rango |
| `sincronizacion` | `al_dia` \| `pendiente` |
| `activo` | por defecto `true`; `false` para ver docentes desactivados |
| `page` | número de página |

**Cada fila:**

```json
{"id_docente", "nombres", "apellidos", "activo", "colegios": [{"id", "nombre"}],
 "ultima_conexion": "… | null", "sincronizacion", "registros_pendientes"}
```

- Orden: primero los `pendiente` y luego alfabético (hoy todos salen `al_dia`).
- `ultima_conexion` es el último login (`null` = nunca entró).
- `colegios` llega como lista; únelos con comas en la tabla.

### 10.2 Detalle del docente (CU021)

- **Cabecera:** `GET /seguimiento/docentes/{id_docente}`, con la misma forma que una fila. Inexistente: 404 `docente_no_encontrado`.
- **Historial:** `GET /seguimiento/docentes/{id_docente}/actividades`, el mismo `Paginado` de `ActividadResumen` y los mismos filtros que §9.1. Columnas: fecha, inicio, fin, tipo de cierre y productividad (`productividad_texto`, por ejemplo "15 Rúbricas, 2 Registros de Vuelo", o "Sin registros").
- **Atajos:** un botón por cada `productividad[].modulo`, que lleva al módulo con los filtros `id_docente` + `fecha` (o `id`) de la fila, en **solo lectura**. Los módulos destino (grillas) todavía no existen (§12). Puedes dejar los botones preparados o deshabilitados.
- Todo el Seguimiento es **solo en línea y de solo lectura** (CU020, CU021): no se guarda en IndexedDB y sin conexión se muestra el Empty State del CU.

---

## 11. Consideraciones offline (PWA)

Resumen de lo que los CU piden al frontend:

- **Login, recuperación de contraseña, Sesiones, Seguimiento e Historial del alumno** son **solo en línea**.
- **Colegios, Alumnos y Usuarios sin conexión:** tabla en solo lectura desde IndexedDB. Botones "Agregar", lápiz y switch **deshabilitados (gris) con tooltip**: "Acción no disponible sin conexión. Conéctate a internet para gestionar {colegios | estudiantes | usuarios}."
- **Inicios:** último resumen desde LocalStorage, marcado como desactualizado (§5.5).
- **IndexedDB:** solo los datos autorizados para el rol, nunca contraseñas ni tokens de recuperación. Precarga en segundo plano tras el login y al entrar al Inicio con conexión (CU003). Un fallo de precarga no invalida la sesión.
- **LocalStorage:** solo filtros, preferencias y el último resumen del Inicio. Se limpia al cerrar sesión, salvo lo que esté pendiente de sincronizar.
- **Service Worker:** el Application Shell permite abrir la app sin conexión solo si ya se cargó antes con conexión.
- **Captura offline** de Rúbrica, Lectura y Vuelo, con su sincronización: todavía no existe en el backend (§12).

---

## 12. Lo que todavía no existe

| Pendiente | Efecto en el front hoy |
|---|---|
| Grillas de Asistencia, Rúbrica, Seguimiento de Lectura y Registro de Vuelo (sus CU no son de esta entrega) | Sin pantallas de captura. Las pestañas del detalle del alumno salen vacías. Los atajos de CU021 no tienen destino. |
| Sincronización offline (envío en lote, pendientes reportados, estados `pendiente` / `error`) | `sincronizacion` siempre `sincronizada` / `al_dia`; `registros_pendientes` siempre 0 |
| Salud del Sistema (CU012) | `salud_sistema: null` |
| Registros pendientes e incompletos, y alerta de colegio sin registros (CU011) | `null` y sin ese `tipo` de alerta |
| Resúmenes de acción del Inicio Docente (CU010) | no vienen en la respuesta |
| Nivel actual del alumno (depende de la fórmula RN-009) | `null` |
| Códigos para `tipo_cierre` | todavía texto completo (§1.5) |

---

## 13. Respuesta a tu `APIS_BACKEND.md`

**Ya implementado, como lo pediste o con ajustes:**
- Permisos de alumnos y usuarios.
- Docente con asignaciones en una sola llamada (`POST /usuarios`).
- Filtro `activo`.
- Actividades con UUID idempotente.
- Inicio por rol.
- Política de contraseña de CU006, PIN de 6 dígitos, límite de 5 por hora, 429, campo `motivo`, sesiones invalidadas con la tabla `sesion` (no con `token_version`) y `es_supervisor_original`.
- Asignaciones del usuario actual desde el token.

**Con ajustes respecto a lo que pediste:**
- **Tipos de cierre:** son **3** (los de CU009), no 2.
- **Rutas:** `/actividades` en lugar de `/sesiones`, para no confundir con la sesión autenticada.
- **Umbral de alertas:** fijo en el servidor (CU011 lo exige), no configurable.
- **Auditoría:** solo el historial del alumno, que es lo que piden los CU.

**No se hará, porque contradice los CU o lo decidido con análisis:**
- **Secciones como entidad:** la sección es un atributo del colegio (`colegio.seccion`, por defecto "Única") y el alumno la hereda. Nunca se elige.
- **`codigo` modular y `ubicacion` del colegio:** no están en CU013. La ubicación es departamento, provincia y distrito.
- **`id_ciclo_evaluado` en el alumno:** el ciclo del alumno se calcula. El ciclo evaluado pertenece a cada evaluación de Registro de Vuelo.
- **Asistencia por fecha:** se decidió **asistencia semanal** (las clases de Raz-Kids son una vez por semana).
- Todo lo que venía del `.docx` de sprint de Franco (matriz de permisos, expediente, restablecimiento por la Supervisora, `debe_cambiar_contrasena`) quedó descartado.

---

## 14. Cambios de contrato recientes (resumen)

Si ya tenías algo integrado, revisa esto:

1. **`zona` → `provincia`** en colegios. `departamento` y `distrito` son obligatorios al crear.
2. **`creado_en` y `modificado_en` son instantes UTC** (`…Z`). Los registros antiguos salen a las `T05:00:00Z` (medianoche de Lima).
3. **`/profesores` eliminado:** todo va por `/usuarios`.
4. **Política de contraseña nueva** (carácter especial obligatorio). Errores con `motivo`.
5. **PIN numérico de 6 dígitos y 15 minutos.**
6. **Login:** mensajes nuevos, 429 por bloqueo y logout real.
7. **El Directivo ya no ve alumnos** (403).
8. **`colegios_asignados` es una lista** (`["Global"]` para no docentes).
9. **422 con un formato único** (`motivo: "validacion"` + `errores`).
10. **403 con `motivo: "sin_permiso"`**; el `detail` no cambió.
11. **Estado de actividad: `en_curso` / `finalizada`** (antes `Activa` / `Finalizada`), también en `POST /actividades` y `/finalizar`.
12. **`/me/asignaciones` e `/inicio/docente`** traen el detalle por grado y `totales`.
13. **Alertas:** un docente recién asignado o rotado no alerta de inmediato.

---

## 15. Entorno y datos de prueba

- **Despliegue:** el deploy de `development` en Jenkins falla porque el servidor del curso no acepta conexiones a su base de datos (no es un error de código; ya se reportó). Mientras tanto, prueba con el backend en local: `python run.py`, API en `http://127.0.0.1:8000` y Swagger en `/docs`.
- **Cuentas del seed (solo local y pruebas):**

| Rol | Correo | Contraseña |
|---|---|---|
| Supervisor (no original) | `jefa.prueba@sicedu.test` | `JefaTest123` |
| Docente | `profesor.prueba@sicedu.test` | `ProfesorTest123` |
| Directivo | `directivo.prueba@sicedu.test` | `DirectivoTest123` |

Estas contraseñas no cumplen la política nueva: sirven para entrar, pero para cambiarlas hay que usar una que sí la cumpla.

- **Calendario de 2026:** es ficticio hasta tener el oficial.
  - Periodo 3: del 10/08 al 16/10.
  - Periodo 4: del 19/10 al 18/12.
  - Vacaciones de medio año sin semanas.
  - El 08/10 es feriado, así que los conteos de días hábiles de esta semana son un día menores.
- **Colegios iniciales:** los 9 reales, con distrito "Por definir" y cuatro con provincia "Por definir" hasta recibir los datos de la ONG.
