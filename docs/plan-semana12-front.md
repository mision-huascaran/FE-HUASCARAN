# Plan de implementación del frontend · SICEDU semana 12

> **Qué es esto.** El plan completo de lo que falta construir, lo que cambia y lo que hay que
> corregir en `FE-HUASCARAN`, a partir de cuatro fuentes. Está pensado para ejecutarse por fases,
> commiteando por bloque.
>
> **Punto de partida:** `development` en `cc9bb8f` (local = remoto el 27/10/2026).
>
> **Jerarquía de fuentes, cuando se contradicen:**
>
> 1. **`prompts/Actualización de casos de uso.md`** — la biblia. CU001 a CU035. Manda en el
>    comportamiento, los textos de pantalla y las reglas de negocio.
> 2. **`prompts/cambiosFront_semana12_v1.md`** (Tandas F, G, H) — manda sobre el contrato de la API.
> 3. **`prompts/cambiosFront_semana11_v3.md`** (Tandas 0, A–E) — vigente salvo lo que la semana 12 cambie.
> 4. **`prompts/Defectos SICEDU para corregir (rondas 3 y 4).docx`** — 36 defectos abiertos (D43–D78).
> 5. **`prompts/cambiosFront_semana12_v1.md`, sección "Dashboard (CU033 a CU035)"** — los once
>    endpoints de `/dashboard/*` que el backend publicó en la serie D1–D7, con sus estados y sus
>    errores. Es lo que habilitó la **Fase 8**.
>
> Los documentos `cambiosTest_*` no mandan sobre el código: dicen qué va a probar QA, y por eso se
> usan aquí como **criterio de aceptación** de cada fase.

---

## 0. Verificación previa: ¿están todos los módulos?

Sí. Los 13 módulos de las pestañas del documento del analista están en la biblia, y a cada uno le
corresponden estos CU:

| # | Módulo (pestaña) | CU | Pantalla hoy |
|---|---|---|---|
| 1 | Seguridad | CU001–CU006 | `features/login` |
| 2 | Logout | CU007, CU008 | `auth/AuthProvider.jsx` |
| 3 | Inicio | CU009–CU012 | `features/inicio` |
| 4 | Colegios | CU013, **CU027** | `features/colegios` |
| 5 | Alumnos | CU014, CU015 | `features/alumnos`, `features/estudiantes` |
| 6 | Usuarios | CU016, **CU028** | `features/usuarios` |
| 7 | Sesiones | CU017, CU018, CU019 | `features/sesiones` |
| 8 | Seguimiento | CU020, CU021 | `features/seguimiento` |
| 9 | Asistencias | CU022 | `features/asistencia` |
| 10 | Seguimiento de Lectura | CU023–CU026 | `features/lectura` |
| 11 | Rúbrica | CU029, CU030 | `features/rubrica` |
| 12 | Registro de Vuelo | CU031, CU032 | `features/registroVuelo` |
| 13 | **Dashboard** | CU033, CU034, CU035 | ✅ **construido en la Fase 8** (`59eb6a9`) |

**Un hallazgo que hay que resolver antes de empezar.** El módulo 13 está en la biblia con tres casos
de uso completos (CU033 dashboard del Supervisor, CU034 consolidado de libros leídos, CU035 dashboard
del Directivo), y el analista lo mantiene como pestaña. Pero el commit `3070755` lo **borró del
frontend** —`features/dashboard/`, `api/resources/dashboard.js`, `TablaColegios`, `GraficosDashboard`
y sus pruebas— y el backend no lo publica. El tester también lo anotó (D49, sección Analistas): *"el
Dashboard se retiró… quitar el Dashboard de los casos de uso si ya no existe"*.

Hay tres salidas y **ninguna es decisión del front**:

- **(a)** El Dashboard vuelve → hay que reconstruir tres pantallas desde cero y pedir los endpoints al
  backend, que hoy no existen. Es una fase entera, no un arreglo.
- **(b)** El Dashboard se retira de verdad → el analista quita CU033–CU035 y la pestaña, y QA retira
  CP33/CP34/CP35.
- **(c)** Queda diferido → se documenta como fuera de alcance de la semana 12.

**El plan asumió (b) o (c)** y no lo construyó. **La respuesta fue (a)**, y llegó el 29/10 con los
casos de uso completos y los once endpoints del backend: está en la **Fase 8**. Se deja escrito el
planteamiento porque explica por qué el módulo no estaba y por qué volver no fue un arreglo sino una
fase entera.

---

## 1. Estado actual del frontend (lo que ya está hecho)

Para no replanificar lo que ya existe:

**Ya construido y conectado a la API real** (`VITE_USE_MOCK=false` es el modo por defecto desde el
último pull):

- Seguridad, Logout, Inicio (tres roles), Alumnos, ficha del alumno, Usuarios, Sesiones, Seguimiento.
- Asistencias (CU022) con el contrato de clase = colegio × grado × sección × fecha.
- Seguimiento de Lectura (CU023–CU026) con tabla semanal, clase de referencia y "No realizada".
- Rúbrica mensual (CU029, CU030) con escala por subprograma y criterios del servidor.
- Registro de Vuelo (CU031, CU032) por alumno y PA.
- Calendario académico (CU027) **parcial**: solo consulta, crear y editar el general.
- Cola offline con operaciones (`id_operacion`, `version`, `realizado_en`), aviso de pendientes con
  `id_dispositivo`, descartar y cargar versión actual.

**Lo que NO existe** (y es el grueso de este plan):

- Service Worker / Application Shell.
- Programación de clases y reprogramación (CU013).
- Calendario: fechas particulares, usar calendario general, modales de confirmación, copia offline.
- Permisos: filtro de PA, modal de revocación propio, avisos de CU028.
- Usuarios: varios colegios por Docente.
- Ficha del alumno: pestaña Historial y gráfica de PA1–PA4.
- Caché de consulta offline para Colegios, Usuarios, Alumnos, calendario y permisos.

---

## 2. Decisiones bloqueantes (preguntar antes de la Fase 2)

Estas cuatro no se pueden resolver escribiendo código, y dos de ellas condicionan fases enteras:

1. **Dashboard** — lo de arriba. Condiciona si hay Fase 9.
2. **Menú del Supervisor (D49)** — la biblia y el backend (API.md, Tanda H) coinciden en que el
   Supervisor **consulta** Asistencias, Lectura, Rúbrica y Registro de Vuelo en solo lectura. Hoy
   `src/auth/permisos.js` los tiene con `ocultoEnMenu: true`. El plan los destapa (Fase 1), pero
   conviene que el analista lo confirme por escrito, porque fue una decisión deliberada en su día.
3. **"Revocar" en Permisos** — el tester pregunta si basta dentro de "Ver permiso" o debe estar en la
   columna Acciones. **CU028 es explícito**: la columna Acciones presenta "Ver permiso" **y**, para
   permisos programados o vigentes, la acción "Revocar". El plan implementa lo que dice el CU.
4. **Docente sin asignación (CP-INI-26, CP-PER-03)** — ya está respondido por el backend (Tanda F,
   §F1): CU016 v2 hace obligatoria la asignación, así que el escenario se prepara con un Docente
   asignado a un colegio **en receso** con "Próximo", más un permiso vigente para otro colegio. No
   hay nada que cambiar en el front salvo no bloquear ese caso (ver D56).

---

## 3. Fases

El orden sale de dos criterios: primero lo que **rompe lo que ya funciona** (cambios de contrato),
y después el orden de desbloqueo que pide el tester en "Cómo verificar".

---

### FASE 0 · Contrato de la semana 12 que rompe lo ya construido — ✅ HECHA

> **Commits:** `10c6957` (actividad unificada y tuteo) y `519eea3` (errores por campo y
> textos de éxito). 736 pruebas en verde, lint sin errores, build correcto.
>
> **Dos cosas que resultaron no ser lo que parecían:**
>
> - El prefijo `"campo: mensaje"` **lo ponía el front**, no el backend. Pero quitarlo a secas
>   habría perdido información: `erroresDeCampo()` existía desde hacía tiempo y **no la usaba
>   ningún formulario**. Se conectó al formulario compartido de mantenimiento, que ahora pinta
>   cada mensaje debajo de su control.
> - El texto de "actividad no iniciada" eran **dos**, no uno. CU010 conserva el suyo en el
>   Inicio ("Inicia una actividad de trabajo para habilitar el registro de datos.") y CU014,
>   CU022, CU023, CU025, CU030 y CU032 usan el unificado. Verificado contra la biblia: el
>   primero aparece 1 vez y el segundo 9.

**Por qué va primero:** son cambios de forma en endpoints que las pantallas actuales ya consumen. Si
no se hacen antes, todo lo que se construya encima hereda el error.

#### 0.1 Mensaje único de actividad no iniciada (Tanda A4 + G3)

Hoy el front tiene literales propios en varias pantallas. El backend unificó **siete textos** en uno:

> `Debes iniciar una actividad de trabajo para registrar o modificar información.`

- Quitar los literales propios de `features/asistencia/AsistenciaPage.jsx`,
  `features/lectura/LecturaPage.jsx`, `features/rubrica/RubricaPage.jsx`,
  `features/registroVuelo/RegistroVueloAnualPage.jsx` y `components/layout/AvisoActividades.jsx`.
- **Mostrar el `detail` del backend y el `escritura.motivo` tal como llegan.** El literal propio se
  queda solo como respaldo cuando no hay respuesta del servidor.
- **Ojo:** Alumnos (CU014) **también** cambió a ese mismo texto en la Tanda G (antes era "Debe
  iniciar una actividad para realizar cambios.").
- **No tocar** el de `fuera_de_actividad`: "La operación se realizó fuera de una actividad de trabajo
  del docente." sigue igual.

#### 0.2 Textos en tuteo (Tandas G2 y H2)

El backend pasó a tuteo ocho mensajes que llegan en `detail`, `mensaje` o `errores[].mensaje`. El
front **no debe tener copias** de ninguno: se muestran como llegan.

Y hay **tres textos propios del front** que también pasan a tuteo:

| Dónde | Ahora |
|---|---|
| Login | **"¿Olvidaste tu contraseña?"** (hoy "¿Olvidó su contraseña?") |
| Sin conexión | **"Conéctate a Internet e inténtalo nuevamente."** |
| CU011 y CU012 | **"Inténtalo más tarde."** |

Buscar con `grep -rn "Olvidó\|Intente\|Inténtelo\|Comuníquese\|Use '" src/` y revisar uno a uno.

#### 0.3 No reordenar en el cliente (Tanda H1)

El backend ya entrega **todos** los listados ordenados sin distinguir mayúsculas ni tildes (la Ñ como
N), con desempate por id. Orden esperado: `ALVA`, `álvarez`, `Ávila`, `Ñahui`, `nuñez`, `Pérez`.

- Quitar cualquier `.sort()` o `localeCompare` sobre `items` en las pantallas.
- `src/components/ui/DataTable.jsx`: el orden por columna reordena **solo la página cargada** (40
  filas). En los listados paginados hay que **desactivar `sortable`** o dejar claro en la cabecera
  que ordena solo esa página. Lo primero es más honesto.
- Los `sort` de `src/api/mock/handlers.js` son del simulador y se quedan.

#### 0.4 Cada mensaje junto a su campo, sin prefijo (D62, D74, Tanda F2)

Hoy el front arma `"campo: mensaje"`. El backend nunca manda prefijos: manda
`{detail, motivo, errores: [{campo, mensaje}]}`.

- Un helper único —`erroresDeCampo(error)` ya existe en `src/api/client.js`— y **ninguna pantalla**
  vuelve a concatenar el nombre del campo.
- Cada `errores[].mensaje` se pinta debajo del control cuyo `name` coincide con `errores[].campo`.
- El `detail` se muestra **tal cual**, sin añadirle nada.
- Casos concretos que hoy fallan: `pertenece_desde:`, `aplicar_desde:`, `periodos.2.fecha_fin:`.

#### 0.5 Textos de éxito que pone el front (D62, Tanda F2)

El backend **no** los envía. Los pone la pantalla, con el texto exacto del CU:

- Crear calendario → **"Calendario académico creado correctamente."**
- Editar calendario → **"Calendario académico actualizado correctamente."**
- Revocar permiso → **"Permiso de corrección revocado correctamente."**
- Reprogramar clase → **"Clase reprogramada correctamente."**
- Otorgar permiso → **"Permiso de corrección otorgado correctamente."**

Y **quitar** los inventados: "Calendario creado/actualizado. Las fechas ya rigen…", "Permiso
revocado. El Docente ya no puede…".

> **Commit sugerido:** `fix(contrato): mensajes del backend tal cual, tuteo y orden del servidor`

---

### FASE 1 · Desbloqueantes del tester — ✅ HECHA

> **Commits:** `938c84e` (D76, D49), `09fe2ec` (D59, D68), `09efe45` (D51, D52, D57) y
> `c92c39b` (D48). 736 pruebas en verde.
>
> **Lo que apareció por el camino:**
>
> - **D59 revierte una decisión deliberada del 09/10** que tenía sus propias pruebas ("sin
>   actividad abierta, Editar OFRECE iniciarla en vez de denegar"). Se cambió porque el
>   probador lo marcó después y porque un control habilitado que no puede funcionar miente.
>   **Si el analista prefiere el comportamiento anterior, esto hay que revertirlo.**
> - **D52 necesitó una pantalla nueva** (`ServidorInalcanzable`): sin perfil no se puede
>   decidir qué menú pintar, pero mandar al login le diría al usuario que su sesión terminó,
>   que es falso.
> - **D48 trajo una espera que no tenía sentido:** con `retry: 3` global, un 403 o un 422 se
>   reintentaban tres veces con espera creciente. Ahora los 4xx no se reintentan.

El tester pide este orden expreso: D76 primero, porque hoy **no se puede otorgar ningún permiso**.

#### 1.1 D76 (bloqueante) · Otorgar permiso con zona horaria

- En `features/usuarios/ModalOtorgarPermiso.jsx`, `inicio` y `fin` salen de un
  `<input type="datetime-local">`, que da `"2026-10-27T12:39"` **sin zona**.
- Enviar siempre **con offset**: `new Date(valor).toISOString()`.
- El backend ya no responde 500 (Tanda F1), pero igual hay que mandarla con zona: así no dependemos
  de cómo interprete el servidor una hora sin zona.
- Los 422 de negocio no cambian y van **debajo de su campo**:
  - `campo: "inicio"` → "Selecciona una fecha y hora futura o utiliza la opción 'Desde ahora'."
  - `campo: "fin"` → "El fin de vigencia debe ser posterior al inicio."

#### 1.2 D49 · Menú por rol y etiqueta "Asistencias"

En `src/auth/permisos.js`:

- Quitar `ocultoEnMenu: true` del `[SUPERVISOR]` en `asistencia`, `lectura`, `rubrica` y `vuelo`.
- Cambiar `etiqueta: 'Asistencia'` → **`'Asistencias'`** (el nombre del módulo en los CU y en el menú).
- El Directivo se queda solo con Inicio (API.md, matriz de permisos real).

#### 1.3 D48 · Ninguna pantalla muestra el error genérico

"No se pudo mostrar esta pantalla" es el error boundary. Cada pantalla tiene que leer la respuesta
real y pintar **su** estado vacío o **su** error del CU.

- Revisar Registro de Vuelo y, para la Supervisora, Rúbrica y Seguimiento de Lectura.
- Causa típica: un `.map()` sobre algo que llegó `null`, o un hook de catálogo sin `enabled`.
- Regla: **ningún `.map()` sobre datos del servidor sin `?? []`**, y los estados vacíos con el texto
  de su caso de uso.

#### 1.4 D59 y D68 · Botones deshabilitados con su tooltip

- **D59 (Alumnos):** "Agregar", "Editar" e "Inactivar" se ven habilitados para el Docente sin
  actividad. Deshabilitarlos con el tooltip de CU014 mientras no haya actividad en curso.
- **D68 (Usuarios):** "Inactivar" del **Supervisor original** y de **la propia cuenta** debe estar
  deshabilitado, con un tooltip que explique la protección. El backend ya responde
  `409 auto_desactivacion` → "No puedes desactivar tu propia cuenta."

#### 1.5 D51 · La caché del resumen es por USUARIO, no por rol

`src/features/inicio/useResumenLocal.js` usa `sicedu.resumen.${rol}`. Si se pierde el token sin
cerrar sesión y entra otro usuario del mismo rol, **ve el resumen del anterior**.

- La clave pasa a incluir el `id_usuario`.
- Al iniciar sesión con un usuario distinto del último, **borrar** todas las cachés de
  `localStorage` y las consultas en IndexedDB antes de pintar nada.
- Ya existe `src/lib/datosLocales.js` con la limpieza del logout: reutilizarla en el login.

#### 1.6 D52 y D57 · Un error de red no es un 401

Dos defectos con la misma raíz: la aplicación cierra la sesión cuando no debe.

- **D52:** con el backend caído, Inicio muestra datos sin avisar y al recargar vuelve al login.
  Distinguir **error de red o 5xx** de **401**: ante error, mostrar los datos guardados con su fecha
  y el aviso del CU (`AvisoDatosLocales`), **sin cerrar sesión**.
- **D57:** al recargar con el reloj del equipo adelantado, cierra la sesión. La expiración se calcula
  con `src/lib/relojServidor.js` (el ancla monotónica + `sicedu.reloj.desfase`), **nunca** con
  `Date.now()` a secas, y la sesión **solo** se cierra ante un 401 del servidor.
- En `src/api/client.js`, el interceptor que llama a `expirar()` debe disparar **solo** con
  `status === 401`, nunca con `!error.response`.

> **Commits sugeridos:** uno por punto. D76 va solo y primero.

---

### FASE 2 · Colegios: Programación de clases y Calendario completo — ✅ HECHA

La fase más grande. Cubre D50 y D70–D75, más las tandas A1, A2, C y D0.

#### 2.1 D60 · Listado de colegios (CU013)

En `features/colegios/MantenimientoColegios.jsx`:

- **Columna "Provincia"**, entre Departamento y Distrito. El orden del CU es: Nombre, Nivel
  Educativo, Departamento, **Provincia**, Distrito.
- **Filtros "Departamento" y "Distrito"** (la API ya los acepta), poblados con
  `GET /colegios/ubicaciones`. Ojo con el orden nuevo: `["Áncash", "Lima"]`.
- Los controles de fila, **en este orden de izquierda a derecha**: **"Ver detalle" (ojo)**,
  **"Editar" (lápiz)**, **"Estado" (switch)**. Hoy falta el primero.
- Mantener el filtro de estado y que cualquier cambio de filtro **vuelva a la página 1**.

#### 2.2 D50 · Vista de detalle del colegio y Programación de clases (CU013)

Pantalla nueva: `features/colegios/DetalleColegio.jsx` + `ProgramacionDeClases.jsx`.

- **Vista interna de la SPA**, no una ruta aparte: conserva el sidebar, cabecera con el nombre del
  colegio y el botón **"Volver a Colegios"** que regresa al listado **con sus filtros y su página**.
- Pestaña **"Programación de clases"**.
- **Filtros:** "Año escolar", "Mes", "Grado", "Sección", "Subprograma".
  - Año y mes se inicializan con los actuales; grado y subprograma con **"Todos"**.
  - La sección se autocompleta con **"Única"** cuando es la única; con varias, permite elegir una o
    **"Todas"**.
  - Se restauran desde `localStorage` **por usuario y colegio**.
- **Endpoint:** `GET /colegios/{id}/clases?id_grado=&id_seccion=&desde=&hasta=&id_programa=&page=`
  (el `id_programa` lo añadió la Tanda A2).
- **Tabla de solo lectura**, 40 por página, ordenada por fecha vigente, grado y sección:

  | Columna | Contenido |
  |---|---|
  | Grado | `grado.nombre` |
  | Sección | `seccion.nombre` |
  | **Subprogramas** | `subprogramas[].nombre` **en la misma celda, separados por coma** |
  | Fecha original | `fecha_original`, DD/MM/AAAA |
  | Fecha vigente | `fecha` |
  | Programación | "Habitual" o "Reprogramada" |
  | Acciones | "Reprogramar" o "Ver reprogramación" |

- **Una clase con alumnos de los dos subprogramas aparece UNA sola vez**, también con el filtro en
  "Todos". El filtro no genera filas por subprograma.
- Vacío: **"No hay clases programadas para los filtros seleccionados."**

#### 2.3 D50 · Reprogramar una clase (CU013)

- Botón **"Reprogramar"** solo en las clases habilitadas. Si `tiene_asistencias`, deshabilitado con
  **"Esta clase ya tiene asistencias registradas y no puede reprogramarse."**
- Modal **"Reprogramar clase"**:
  - **Solo lectura:** colegio, año escolar, PA, grado, sección, **subprogramas**, fecha original y
    fecha vigente.
  - Si la clase tiene los dos subprogramas, mostrar ambos y el aviso **"La reprogramación se aplica a
    toda la clase, incluidos los alumnos de ambos subprogramas."**
  - **Obligatorios:** "Nueva fecha" (DatePicker) y "Motivo" (texto multilínea).
  - Debajo: **"Este cambio afecta únicamente a esta clase. El horario habitual del grado se
    mantiene."**
  - Pie: **"Guardar reprogramación"** y **"Cancelar"**. El botón se deshabilita mientras procesa.
- `POST /colegios/{id}/clases/reprogramaciones` con `version` (`null` = "no tenía fila").
- **Éxito:** cerrar, **"Clase reprogramada correctamente."**, refrescar la tabla con la etiqueta
  "Reprogramada". Si la fecha nueva cae en otro mes: **"La clase fue trasladada al [fecha] y puede
  quedar fuera de los filtros actuales."**
- **Errores**, cada uno junto a su campo: `fecha_sin_cambio`, `fecha_en_receso`, `fecha_no_lectiva`,
  `fecha_de_otro_periodo`, `fecha_ocupada`, `validacion` (motivo). Y `409 clase_con_asistencias`,
  `409 modificacion_concurrente` sobre el formulario.
- **"Ver reprogramación"**: modal de solo lectura con el historial
  (`GET /clases/{id}/reprogramaciones`) e incluye **"Modificar reprogramación"**, que reabre el flujo
  sin sobrescribir el historial.
- **No es offline.** Requiere conexión y **no se encola**. Si una solicitud queda sin confirmación,
  **bloquear el reenvío** hasta verificar con el backend.

#### 2.4 D70–D75 · Calendario académico completo (CU027)

`features/colegios/CalendarioAcademico.jsx` hoy tiene **529 líneas** y solo cubre consulta, crear y
editar el general. Falta todo lo demás. Conviene partirlo en varios archivos.

**a) Selector de año y periodo actual (Tanda C1, D70)**

- El filtro de año es un **Year Picker** (solo el año, p. ej. 2027), **no** una lista de años
  escolares. Elegir un año **no crea nada**.
- `GET /calendarios?anio=2027`. Si no existe → **404 `calendario_no_configurado`**, estado vacío con
  **"No hay un calendario académico configurado para este año escolar."** y el botón
  **"Crear calendario"**.
- La respuesta trae el campo nuevo **`anio`** (`"2027"`) además de `id_anio_escolar`.
- **Año por defecto:** el que contiene hoy en un PA o PR (incluido el PR4 que pasa al año siguiente).
- Junto a los filtros, el **periodo actual con sus fechas completas**, usando `periodo_actual`:
  **"Receso posterior al cuarto periodo: 21/12/2026 al 15/02/2027"**. Si es `null`:
  **"Sin periodo aplicable a la fecha actual"**.
- **D70:** marcar la **fila del periodo de hoy** en la tabla de periodos.

**b) Alcance "Por colegio" (D71, D73)**

- Filtro **"Alcance"**: "General" / "Por colegio". Con el segundo aparece el campo obligatorio
  **"Colegio"**.
- **D71:** si **no hay calendario general** y el alcance es "Por colegio", el estado vacío muestra
  **"Primero debes configurar el calendario general para poder definir fechas particulares de este
  colegio."** y el botón **"Ir al calendario general"**, que **cambia el alcance a General
  conservando el año**, sin modal ni navegación.
- Si el colegio usa el general → botón **"Configurar fechas particulares"**.
- **D73:** al entrar en ese modo, **precargar las fechas con las del calendario general** (hoy salen
  vacías) y mostrar el aviso persistente sobre las tablas:
  **"Al guardar, este colegio tendrá un calendario propio para el año escolar seleccionado. Los
  cambios posteriores del calendario general no se aplicarán automáticamente."**
- Si ya tiene particular → **dos botones**: **"Editar calendario"** y **"Usar calendario general"**.

**c) Modales que faltan (D72)**

| Modal | Cuándo | Mensaje y botones |
|---|---|---|
| **"Confirmar actualización del calendario"** | Al guardar la edición del **general** | "Los cambios se aplicarán a todos los colegios que utilizan el calendario general de este año escolar. Los colegios con fechas particulares conservarán su configuración." → **"Confirmar cambios"** / **"Seguir editando"** |
| **"Usar calendario general"** | Al restablecer un colegio | "El colegio [nombre] dejará de utilizar sus fechas particulares para el año escolar [año] y adoptará el calendario general. Los cambios posteriores del calendario general se aplicarán también a este colegio." → **"Confirmar"** / **"Cancelar"**. **"Confirmar" se deshabilita mientras procesa** |
| **"Descartar cambios"** | Al cancelar o salir con cambios | "Tienes cambios sin guardar. Si continúas, se perderán." → **"Descartar cambios"** / **"Seguir editando"** |

El tercero se dispara también con **"Volver a Colegios"** y con cualquier navegación interna.

**d) Conflictos y comunicación (D75)**

- **409 `modificacion_concurrente`**: **bloquear "Guardar"**, mostrar sobre las tablas **"El
  calendario fue modificado por otro Supervisor. Consulta la versión actual antes de volver a
  guardar."** y el botón **"Consultar versión actual"**.
  - Ese botón abre un **modal de solo lectura** con las tablas "Periodos" y "Días no lectivos" del
    servidor, mientras la propuesta sigue detrás. Botones **"Cerrar"** y **"Cargar versión actual"**.
  - "Cerrar" conserva la propuesta y deja "Guardar" bloqueado. "Cargar versión actual" pasa por la
    confirmación de "Descartar cambios".
- **Sin conexión durante la edición:** conservar los valores en memoria, aviso **"Sin conexión. Tus
  cambios aún no se han guardado. Mantén esta vista abierta para conservarlos."** y **"Guardar"
  visible y deshabilitado**.
- **Sin respuesta:** **"No se pudo confirmar el guardado. Se verificará el calendario al recuperar la
  comunicación con el servidor."**, "Guardar" bloqueado, y al reconectar **consultar el calendario**
  para saber si se aplicó.
- **Nunca** encolar cambios del calendario como operación offline, ni guardar el formulario en
  `localStorage`.

**e) Copia en IndexedDB y consulta sin conexión (D70, D61)**

- Tras **cada** respuesta satisfactoria, guardar en IndexedDB la copia del calendario **con su fecha
  y hora de actualización**.
- Sin conexión y **con** copia: tablas en solo lectura + aviso **"Sin conexión. Estás consultando la
  última versión guardada del calendario."** con la fecha de la copia. Los botones de gestión
  **visibles y deshabilitados**, y junto a ellos **"Conéctate a Internet para gestionar el
  calendario."**
- Sin conexión y **sin** copia: **"No hay una copia de este calendario disponible sin conexión."**
  **Nunca** mostrar el calendario de otro colegio o año como sustituto, ni afirmar que no existe.
- Los filtros (año, alcance, colegio) se guardan en `localStorage` y se restauran.

**f) Validaciones nuevas (Tandas A1, C3, D0 y D74)**

- **A1:** un día no lectivo puede estar en un **PA o en un PR** (incluido el PR4 del año siguiente).
  Mensaje nuevo: **"Debe estar comprendido dentro de los periodos (PA o PR) del calendario."**
- **C3:** el año no puede abarcar más de 12 meses. `errores[].campo = "periodos.N.fecha_fin"` del
  PR4: **"El año escolar no puede abarcar más de 12 meses: el receso posterior al cuarto periodo debe
  terminar antes del mismo mes en que empezó el primer periodo."**
- **D0:** el PA1 debe empezar en el año elegido. `campo: "periodos.N.fecha_inicio"`:
  **"El primer periodo debe empezar en el año seleccionado."** Además, **limitar el DatePicker** del
  inicio del PA1 al año elegido.
- **C4:** `409 calendario_incompatible` con `tipo_registro: "lectura"` y `motivo: "fuera_del_anio"`:
  **"La semana tiene una tabla de lectura semanal y quedaría fuera del año escolar."**
- **D74:** cada mensaje **junto a su campo** usando `errores[].campo`, **sin el prefijo técnico**. Si
  "Guardar" se deshabilita por un campo vacío, **señalar el campo**, no callar.

**g) Crear el calendario general (Tanda C2)**

- `POST /calendarios` con el campo **`anio`** (int), no `id_anio_escolar`. Se exige **exactamente
  uno** de los dos.
- Con `anio`, el backend **crea el año escolar en la misma transacción**. Si algo falla, **no queda
  nada creado**.
- En modo creación, el año elegido se muestra **de solo lectura** hasta guardar o cancelar, y **los
  filtros quedan bloqueados**.
- Esto cierra el punto "Años escolares" de la sección Analistas: ya **hay** forma de crear el año
  desde la pantalla.

> **Commits sugeridos:** `feat(colegios): programación de clases y reprogramación (CU013)` y
> `feat(calendario): fechas particulares, modales y consulta sin conexión (CU027)`

---

### FASE 3 · Usuarios y Permisos — ✅ HECHA

#### 3.1 D67 · Un Docente con varios colegios (CU016, Tanda G1)

**Cambio de contrato.** `desde_periodo` **ya no existe**, ni `id_colegio`/`grados` sueltos.

```json
"asignacion": {
  "id_anio_escolar": 2,
  "colegios": [
    {"id_colegio": 1, "grados": [1, 2, 3]},
    {"id_colegio": 4, "grados": [5], "inicio_asignacion": "retroactivo"}
  ]
}
```

**Hay que cambiar `src/api/resources/administracion.js`** (el documento del backend lo nombra):

- `asignacionDe(datos, …)` arma hoy **un solo** colegio en la raíz. Debe armar
  `{id_anio_escolar, colegios: [...]}`, uno por colegio, cada uno con sus grados y su
  `inicio_asignacion`.
- `obtenerUsuario` lee hoy `asignacion.periodos` y aplana un `id_colegio`. Debe recorrer
  `asignacion.colegios[].periodos[]` y devolver la lista de colegios con los grados de cada uno
  (los del periodo con `vigente: true` o, si no hay, los del primero).

**El formulario (modal de Usuarios, rol Docente):**

- "Año escolar" (dropdown), **"Colegios asignados" (selección múltiple)**, y **los grados de cada
  colegio**, uno por colegio, sacados de la ficha de ese colegio.
- **Por cada colegio que hoy esté en un PR**, un bloque con **el nombre del colegio** y el campo
  obligatorio **"Inicio de asignación"** (Retroactivo / Próximo), **independiente en cada bloque**.
  - En qué periodo está cada colegio se lee de **`GET /colegios/estado-calendario`**
    (`estado_calendario.tipo == "PR"`, con su `numero`).
  - **En el PR4** (`es_pr4 == true`), **"Próximo" se muestra deshabilitado** con el texto del CU.
  - Los colegios en un PA o con el año sin empezar **no llevan bloque**.
- `grados`: **nunca `[]` ni `null`**. O se omite, o lleva al menos un grado.
- En la **edición**, `colegios` es la lista **completa** del año: el que se quite se libera.
- **Errores por índice:** `422 inicio_asignacion_requerido` se muestra **en el bloque de su colegio**
  (`errores[0].campo = "asignacion.colegios.{i}.inicio_asignacion"`). Igual con
  `…{i}.id_colegio` (repetido) y `…{i}.grados`.
- `409 grado_asignado`: el `detail` trae colegio, grado, PA y año. **No se guardó nada**, ni la cuenta
  en un alta: hay que decirlo sin ambigüedad.

#### 3.2 D66 · Buscador de Usuarios (Tanda F3)

- El placeholder pasa a **"Buscar por nombre o correo"**.
- `q` ya busca por nombre **o correo** en el backend. **No reordenar en el cliente.**

#### 3.3 D77 · Permisos de corrección (CU028)

En `features/usuarios/PermisosDeCorreccion.jsx`:

- **Filtro "Periodo académico"** (falta hoy). Los cinco filtros del CU son: Año escolar, Colegio,
  **Periodo académico**, Módulo y Estado del permiso.
- **Restaurar los filtros** desde `localStorage`, **por usuario autenticado**.
- El año escolar sale de **`GET /anios-escolares`** y **siempre se envía el `id`**, nunca el año
  mostrado (Tanda C5).
- Si la cuenta del Docente está **inactiva**, "Otorgar permiso" queda **visible y deshabilitado** con
  **"Activa la cuenta del Docente para otorgarle un permiso."**
- Vacío: **"No hay permisos de corrección para los filtros seleccionados."**

**Modal "Otorgar permiso de corrección"** (`ModalOtorgarPermiso.jsx`):

- **El nombre del Docente en la cabecera, como solo lectura** (falta hoy).
- El aviso **"Este permiso permite regularizar información del grupo seleccionado sin modificar sus
  asignaciones históricas."**
- Campos dependientes **deshabilitados** hasta completar los previos; al cambiar año o colegio, se
  limpian las selecciones que dejaron de ser válidas.
- Motivo vacío o solo espacios → **"Ingresa el motivo de la autorización."**
- Rechazos con su texto, cada uno bajo su campo:
  - Periodo aún regularizable → **"Este periodo todavía admite regularización ordinaria y no requiere
    un permiso excepcional."**
  - Superposición → sobre los campos: **"Ya existe un permiso para este mismo alcance con una
    vigencia que coincide total o parcialmente con la propuesta."** + las fechas del existente.
  - Docente inactivado mientras se llenaba → **"La cuenta del Docente está inactiva. No se puede
    otorgar el permiso."**
  - Calendario cambiado → **"El calendario fue actualizado. El periodo seleccionado ya no requiere un
    permiso excepcional."** (y se vacía "Periodo académico").
- Éxito: cerrar + **"Permiso de corrección otorgado correctamente."** Si no coincide con los filtros,
  añadir **"El permiso creado no coincide con los filtros seleccionados."**

**Modal propio "Revocar permiso de corrección"** (hoy la revocación vive dentro de "Ver permiso"):

- Acción **"Revocar"** en la **columna Acciones** de la fila, para permisos "Programado" o "Vigente".
- **Solo lectura:** Docente, año escolar, colegio, grado, PA, módulo y vigencia.
- Aviso: **"La revocación impedirá nuevas operaciones con este permiso desde el momento en que sea
  confirmada por el servidor. Las correcciones realizadas anteriormente conservarán su historial."**
- Campo obligatorio **"Motivo de revocación"**; vacío → **"Ingresa el motivo de la revocación."**
- Botones **"Confirmar revocación"** y **"Cancelar"**. El primero se deshabilita mientras procesa.
- Cambios de condición: **"El permiso ya fue revocado. Se actualizó su información."** y
  **"El permiso ya venció y no requiere revocación."**

#### 3.4 D78 · Cómo se cierran los modales (CU028)

Aplica a **otorgar y revocar**:

- **Pulsar fuera del modal NO lo cierra.**
- El ícono de cierre (X) se comporta **igual que "Cancelar"**.
- Si hay datos modificados, la confirmación va **dentro del mismo modal**, sin superponer otro:
  **"Tienes datos sin guardar. ¿Deseas descartarlos?"** con **"Descartar datos"** y
  **"Continuar completando"**.
- Mientras una solicitud está en proceso, **se deshabilitan los controles de cancelación y cierre**.

> **Nota de implementación:** `components/ui/Modal.jsx` hoy cierra con el clic exterior para todos.
> Hay que añadirle una prop (p. ej. `cierreExterior={false}`) en vez de cambiar el comportamiento
> global, que otros modales sí quieren.

#### 3.5 Sin conexión en Permisos (CU028)

- Al entrar sin conexión: **"Conéctate a Internet para consultar los permisos de corrección."** y
  "Otorgar permiso" deshabilitado. **No** una tabla vacía, que parecería que no tiene permisos.
- Si se cae después de cargar: conservar los resultados + **"Sin conexión. Los permisos mostrados
  podrían haber cambiado."**, y deshabilitar filtros, paginación y acciones.
- Dentro del modal: **"Sin conexión. Los datos ingresados aún no se han guardado."**

> **Commits sugeridos:** `feat(usuarios): varios colegios por Docente (CU016)` y
> `feat(permisos): filtro de periodo, modal de revocación y avisos de CU028`

---

### FASE 4 · Trabajo sin conexión — ✅ HECHA

El tester lo pone en cuarto lugar porque **afecta a casi todos los módulos**.

#### 4.1 D43 · Service Worker y Application Shell

Hoy **no hay ninguno**: recargar sin conexión da `ERR_INTERNET_DISCONNECTED`.

- Instalar **`vite-plugin-pwa`** con Workbox.
- **Precachear** `index.html`, el JS y el CSS del build.
- Responder las **rutas de navegación con `index.html`** sin conexión (`NavigationRoute`).
- **No cachear `/api/`**: los datos los gestionan IndexedDB y la cola, no el Service Worker. Mezclar
  las dos cachés es la forma más rápida de mostrar datos viejos creyendo que son nuevos.
- Estrategia de actualización: que un despliegue nuevo **no** deje al Docente con la versión vieja
  pegada. `registerType: 'prompt'` y un aviso de "hay una versión nueva" es más seguro que
  `autoUpdate` en mitad de una jornada.

#### 4.2 D45 · Qué entra en la precarga

Hoy la precarga de `features/inicio/useActividad.js` **no trae** el calendario de los colegios ni los
permisos vigentes, así que sin conexión se inicia actividad **sin verificar la habilitación**.

Añadir a `precargarParaOffline`:

- Los **periodos y días no lectivos de cada colegio asignado** (`GET /calendarios` por colegio).
- Las **habilitaciones** (`GET /me/habilitaciones`), que ya tiene recurso en
  `api/resources/habilitaciones.js`.

Y usarlos para decidir, **sin conexión**, si "Iniciar actividad" se habilita y qué fechas son
lectivas (`src/auth/habilitaciones.js` ya tiene la lógica pura).

#### 4.3 D61 · Consulta sin conexión en los módulos de administración

Colegios, Usuarios, Alumnos, calendario y permisos hoy se reemplazan por "Requiere conexión" o una
lista vacía, y **un modal abierto se cierra con sus datos dentro**.

- Guardar la **última consulta** de cada uno en IndexedDB (ya existe `src/lib/cacheConsultas.js`).
- Sin conexión: mostrarla **en solo lectura**, con el aviso de **su** caso de uso y los controles
  deshabilitados. Para Colegios, el de CU013: **"Acción no disponible sin conexión. Conéctate a
  internet para gestionar colegios."**
- **Al perder la conexión con un modal abierto: mantenerlo abierto** y deshabilitar **solo** su botón
  de envío. Perder lo que el usuario estaba escribiendo es el peor desenlace posible.

#### 4.4 D69 · Operaciones offline con permiso (parte del front, Tanda F5)

- En **cada operación offline** guardar y enviar:
  - **`realizado_en`**: la hora **real** del docente (con zona, `toISOString()`), **no** la de la
    sincronización. Ya se hace en Asistencias; falta comprobarlo en Lectura, Rúbrica y Vuelo.
  - **`id_permiso`**: el que vino en `escritura.id_permiso`, para mostrarlo y diagnosticar.
- Si el servidor **rechaza** una operación, **dejarla en IndexedDB con estado "Error" y su `detail`**.
  **No borrarla en silencio.** Hoy la cola la descarta y el docente no se entera de que perdió el dato.
- Esto conecta con E3: una operación rechazada **sigue en "Error"** hasta que se corrija (otra
  operación aceptada del mismo registro) o se descarte
  (`POST /sincronizacion/operaciones/{id}/descartar`). **No se reintenta sola.**

#### 4.5 D44 · Cerrar sesión sin conexión (Tanda F6)

Hoy la actividad se sincroniza como **"Manual por finalización de actividad"** y la sesión queda
abierta en el servidor.

- Al cerrar sesión sin conexión, **encolar el cierre de la SESIÓN** y enviarlo al reconectar con
  **`POST /me/sesiones/{id}/cerrar`** y `fin` = la hora real del cierre.
- El backend cierra la actividad en curso como **"Forzado por cierre de sesión"**.
- **NO sincronizar antes esa actividad** con `POST /actividades/{id}/finalizar`: una actividad ya
  finalizada **no se reescribe**, y por eso hoy queda como "Manual".
- En `src/auth/AuthProvider.jsx`, el `encolar` de `TIPOS_ENVIO.ACTIVIDAD_CIERRE` hay que
  **sustituirlo** por el cierre de sesión, no sumarlo.

#### 4.6 E2 · El aviso de pendientes lleva `registro`

`POST /sincronizacion/pendientes` acepta ahora el campo opcional **`registro`** con los datos
naturales del registro que la operación crea o modifica. Con él el backend cuenta **una vez por
registro**; sin él, una vez por operación, y la Salud del Sistema sale mal.

| `modulo` | `registro` |
|---|---|
| `asistencias` | `id_colegio`, `id_grado`, `id_seccion`, `fecha`, `id_alumno` |
| `lectura` (fila) | `id_colegio`, `id_grado`, `id_seccion`, `id_programa`, `id_semana`, `id_alumno` |
| `lectura` (tabla) | lo mismo **sin** `id_alumno` |
| `rubrica` | `id_alumno`, `id_anio_escolar`, `mes` |
| `registro_vuelo` | `id_colegio`, `id_grado`, `id_seccion`, `id_programa`, `id_anio_escolar`, `id_periodo_academico`, `id_alumno` |

- `alumnos` y `actividad` **no admiten** `registro` (422 si se manda).
- **Avisar también las MODIFICACIONES offline** de registros ya guardados, no solo las creaciones:
  ese registro deja de contar como sincronizado hasta que llegue la operación.
- Un campo de más, de menos o de otro tipo → **422 del lote**. El cuerpo se construye campo a campo.

> **Commits sugeridos:** uno por punto. El Service Worker va solo, porque toca el build.

---

### FASE 5 · Alumnos e Inicio — ✅ HECHA

#### 5.1 D64 · Ficha del alumno (CU015)

Hoy la ficha tiene cuatro pestañas: Resumen, Lectura, Rúbrica y Registro de Vuelo. Falta:

- La pestaña **"Historial"** (la API ya lo devuelve).
- El **tooltip** y la **gráfica de PA1 a PA4** del Registro de Vuelo.
  `GET /alumnos/{id}/registro-vuelo` devuelve **siempre los 4 PA**, justamente para la gráfica.
- Los **estados vacíos con los textos de CU015**, no genéricos.

Y los campos que cambiaron de forma:

- `asistencia_porcentaje` → **`asistencia: {porcentaje, asistidas, contabilizadas}`**. Sin clases,
  `porcentaje: null` → **"Sin datos de asistencia"**.
- `libros_leidos_anio` = suma de `total_libros` de sus filas en tablas **realizadas**.
- `GET /alumnos/{id}/rubrica` ya **no** trae `mensuales` (el nivel final mensual no existe).
- `GET /alumnos/{id}/lectura`: forma nueva, sin `observaciones` ni `libros_lsb`.

#### 5.2 D65 · "Pertenece al grupo desde" (CU014)

Al editar un alumno **sin intervalo de pertenencia**, hoy no se pide el campo.

- Si el alumno no tiene pertenencia, mostrar **"Pertenece al grupo desde"** como **obligatorio**, con
  la **fecha de creación propuesta** por defecto, y enviarlo al guardar.

#### 5.3 D63 · Solo colegios activos en el filtro (Tanda F4)

El backend ya no devuelve alumnos de colegios inactivos. El filtro de colegio de Alumnos debe
**ofrecer solo colegios activos**: si ofrece uno inactivo, el resultado es una **lista vacía**, no un
error, y el usuario no entiende por qué.

#### 5.4 D56 · Iniciar actividad con permiso y sin asignaciones

- "Iniciar actividad" se habilita según **`GET /me/habilitaciones`** (asignaciones **y** permisos),
  no solo asignaciones.
- Los filtros de los módulos operativos deben **incluir el aula del permiso** con su aviso
  (`escritura.aviso_permiso`), aunque el Docente no tenga asignación ahí.

#### 5.5 D58 · Textos del Inicio (CU010, CU011)

Dos son errores claros del front y se corrigen sin esperar al analista:

- **"Semana undefined · 22 – 22 oct"** — se lee un campo que ya no existe. `GET /semanas` ahora
  devuelve `numero_semana`, `fecha_inicio` y `fecha_fin`. Y con la Tanda B, la semana se muestra con
  sus **fechas completas**: "29/06/2026 – 03/07/2026".
- **"Colegio Colegio de Prueba"** — se antepone "Colegio" a un nombre que ya lo trae.

Los demás dependen de que el analista confirme el literal exacto de CU010 y CU011:

- "Ya hay una actividad abierta…" en vez del mensaje de CU010.
- Falta **"Tienes N registros offline pendientes de sincronizar."**
- El tooltip del botón deshabilitado no es el de CU010.

#### 5.6 E1 · Salud del Sistema (CU012)

- `salud_sistema` llega como entero 0–100 **o `null`**. Con `null`, **"Sin datos disponibles"** —
  nunca 0 % ni 100 %.
- Lo calcula el backend por **registro** (no por operación). El front **solo lo pinta**: no recalcula
  nada.

> **Commits sugeridos:** `feat(alumnos): historial y gráfica del Registro de Vuelo (CU015)` y
> `fix(inicio): textos de CU010 y CU011`

---

### FASE 6 · Lectura: lo que cambió del contrato (Tandas B y D) — ✅ HECHA

Seguimiento de Lectura ya está construido, pero **la Tanda B le cambió la identidad** y la Tanda D le
añadió un flujo entero.

#### 6.1 B1–B4 · La tabla se identifica por SEMANA, no por mes

- Una semana que cae en dos meses (lunes 29/06 a viernes 03/07) tiene **UNA sola tabla**. `mes` e
  `id_anio_escolar` siguen existiendo, pero **solo la ubican** en los filtros.
- **`GET /semanas`** gana el parámetro opcional **`id_programa`**: conviene enviarlo cuando el filtro
  Subprograma ya está elegido. Y la semana se muestra con **sus fechas completas**.
- **`GET /lectura/tablas`**: si existe la tabla, **se devuelve aunque el `mes` enviado no sea el
  suyo**. La respuesta trae su `mes`: **el front debe ajustar el filtro Mes** al de la tabla.
- **`POST /lectura/tablas`**: la tabla se guarda con el **mes de la clase elegida**. Si ya existe
  (aunque se creara desde el otro mes) → **409 `tabla_existente`** con su `id`: **abrir esa tabla**.
- **`PATCH …/clase-referencia`** ("Cambiar clase"): acepta cualquier clase de la semana **en cualquier
  mes**. Si la clase nueva es de otro mes, la respuesta trae el `mes` nuevo y **el front ajusta el
  filtro**.
  - **No hay endpoint de "clases candidatas".** Para listarlas, usar
    `GET /colegios/{id}/clases?id_grado=&id_seccion=&desde=<lunes>&hasta=<viernes>&id_programa=<sub>`
    (el mismo de la Fase 2).
- **Mensaje cambiado:** `semana_sin_clase` → **"El grupo no tiene clases en la semana seleccionada: no
  hay lectura que registrar."** (ya no dice "y mes").

#### 6.2 B6 · Etiquetas y limpieza de filtros

- Encima de la tabla: **"Clase de esta semana: DD/MM/AAAA"** y el botón **"Cambiar clase"**,
  habilitado **solo** si `escritura.permitida`, la tabla **no tiene datos de lectura**, no hay cambios
  pendientes y **no** está "No realizada".
- Al cambiar un filtro de arriba, **limpiar solo los dependientes que dejan de ser válidos** (la
  Semana solo si ya no aparece en la lista nueva de `/semanas`).

#### 6.3 D1 y D2 · Historial de declaraciones y "Habilitar registro de lectura" (CU026)

**Campo nuevo `declaraciones`** en toda respuesta `TablaLectura` (la más reciente primero):

```json
{"id": 7, "motivo": "Paro de transportistas", "declarada_por": {"id": 3, "nombre": "Rosa Quispe"},
 "fecha_registro": "2026-06-17T14:00:00Z", "vigente": false,
 "motivo_correccion": "Se marcó por error", "revertida_por": {...},
 "fecha_registro_reversion": "..."}
```

- Mostrar el **historial**: la justificación, quién y cuándo; y si fue revertida, el motivo de la
  corrección, quién y cuándo.

**Endpoint nuevo** `POST /lectura/tablas/{id}/habilitar-registro`:

- Botón **"Habilitar registro de lectura"**, visible si `estado === "no_realizada"` y
  `escritura.permitida`.
- **Modal "Habilitar registro de lectura"** con el mensaje:
  **"La lectura dejará de figurar como no realizada. Podrás registrar los datos de los alumnos según
  sus asistencias. La justificación anterior se conservará en el historial."**
  - Campo obligatorio **"Motivo de la corrección"**. Vacío o solo espacios → 422 con
    **"Ingresa el motivo de la corrección."**
  - Botones **"Confirmar"** y **"Cancelar"**. Con texto escrito, "Cancelar" **pide confirmación**.
- **La tabla sigue bloqueada hasta guardar:** los campos no se habilitan hasta el 200 (o, sin
  conexión, hasta encolar la reversión).
- **Éxito:** en línea **"El registro de lectura fue habilitado."**; sin conexión **"El registro de
  lectura fue habilitado en este dispositivo y está pendiente de sincronización."**
- **Conflictos:** `409 declaracion_no_vigente` → **"La lectura ya no figura como no realizada.
  Consulta la versión actual."** y `409 modificacion_concurrente`. En los dos, ofrecer
  **"Consultar versión actual"** y **no reintentar solo**.
- **Cola offline, el orden importa:** **declaración → reversión → lecturas**. Si una se rechaza,
  **no enviar las que dependen de ella** y dejarlas en **"Error"**.

#### 6.4 Tanda 0 · Rúbrica: `evaluacion_en_otro_grupo`

Rechazo por ítem nuevo en `PUT /rubricas`:

> "Este alumno ya tiene una evaluación registrada para este mes. Para corregirla, contacta al Docente
> que la registró o a tu Supervisor."

- Mostrarlo **en la fila del alumno**. **No ofrecer reintento automático.**
- Una evaluación existente **se corrige en su grupo original** aunque el alumno ya no pertenezca a él.

#### 6.5 Tanda A3 · Traslado en el Registro de Vuelo

- `periodos[].entrada` gana **`de_otro_colegio: bool`**.
- Si es `true`, el `texto` es **"Proviene del nivel colocado en el periodo anterior. Registrado antes
  del traslado."** → **destacar "Registrado antes del traslado."**
- **No enlazar** a la decisión de origen: ver la letra no da permiso sobre el otro colegio.

> **Commits sugeridos:** `feat(lectura): tabla por semana y habilitar registro (Tandas B y D)`

---

### FASE 7 · Cierre y verificación — ✅ HECHA

Verificado el 28/10/2026 sobre `development`:

- `npm run lint` → **0 errores** (290 avisos, todos de las reglas que ya
  avisaban antes: `security/detect-object-injection` y `react/prop-types`).
- `npx vitest run` → **92 archivos, 863 pruebas en verde** (1 `todo`), ya con la Fase 8.
- `npm run build` → correcto, con el Service Worker generado (78 entradas
  precacheadas). El aviso de *chunks* de más de 500 kB es anterior al sprint.
- Textos del backend sin duplicar: cada literal de servidor tiene **una sola**
  definición en `src/` (más la del simulador, que es donde debe estar) y
  siempre como respaldo de lo que manda el servidor.

#### Defecto → commit de `development`

Esto es lo que el tester necesita para volver a ejecutar los casos. Están los
**36 defectos** de las rondas 3 y 4, más E1, E2 y el hallazgo posterior. Los
hashes son los de `development` **después** del push del 28/10/2026.

| Defecto | Commit | Qué entró |
|---|---|---|
| D43, D45 | `8c5264a` | Service Worker y precarga de habilitaciones |
| D44, D69, E2 | `45410fb` | Rechazos visibles, aviso por registro, cierre de sesión |
| D46, D47 | — | Ya estaban corregidos antes del sprint; verificados aquí |
| D48 | `c92c39b` | El error genérico se queda para los errores de verdad |
| D49, D76 | `938c84e` | Los cuatro módulos en el menú y la vigencia con zona |
| D50, D60 | `7b6df39` | Programación de clases, reprogramación y detalle del colegio |
| D51, D52, D57 | `09efe45` | Sesión: dos cuentas, servidor caído y expiración |
| D56 | `99f5db8` | Iniciar actividad con permiso; aula del permiso en los filtros |
| D58 | `a9d16cf`, `99f5db8` | "Semana undefined", tooltip de CU010 y actividad abierta |
| D59, D68 | `09fe2ec` | Deshabilitar lo que el servidor va a rechazar |
| D61 | `f1241c6` | Raíces de caché: `calendario`, `colegios` y `clases` |
| D62, D74 | `519eea3` | Cada mensaje bajo su campo y los textos de éxito del CU |
| D63 | `a9d16cf` | Solo colegios activos en el filtro de Alumnos |
| D64 | `a9d16cf`, `33486df` | Gráfica, Historial, cabecera y vacíos de CU015 |
| D65 | `33486df` | "Pertenece al grupo desde" también al editar |
| D67 | `cf09b4d` | Un Docente con varios colegios |
| D70 a D75 | `f1241c6` | Calendario: fechas particulares, confirmaciones, conflictos |
| D77, D78 | `4d99916` | Revocar un permiso y el cierre seguro de los modales |
| E1 | — | Ya cumplía: `salud_sistema` en `null` dice "Sin datos disponibles" |
| D53, D54, D55 | — | **Solo backend** (cálculo del Inicio). El front solo pinta lo que llega: no recalcula nada. Hay que **volver a probarlos** |
| D66 | — | **Solo backend** (orden y búsqueda). El buscador del front ya dice "Buscar" + "Nombre o correo", y el contrato da el literal como **opcional** ("puede decir"), así que no se cambió para no repetir la palabra dos veces en el mismo control |
| Tandas B y D | `5993c5b` | Tabla por semana, "Cambiar clase", habilitar registro |
| **Hallazgo del 28/10** (sin ID) | `076d518` | Asistencias: la marca no se atribuía a su actividad, y su rechazo no dejaba rastro |
| **Hallazgo del 28/10** (sin ID) | `04db3be` | Asistencias: el aviso "No hay una clase programada" se escondía, y faltaba "Registrar clase adicional" (CU022) |
| **Respuesta del backend** | `7ea5261` | Alineación con la Tanda I: S9, S11, S12, S15, S16 y los literales de CU020 |
| **S18 y S19** | `4efb550` | Otorgar varios permisos de una vez, con los colegios y grados del Docente agrupados |
| **Ronda 6** | `409c09b` | D65, D80, D83, D82, D84, D89, D87, D81, D56 y D51 (ver la sección de abajo) |
| **D49 · Dashboard** | `59eb6a9` | CU033, CU034 y CU035 completos, con los once endpoints de `/dashboard/*` (Fase 8) |

#### Encontrado al probar, después de cerrar el plan

No estaba en la lista del tester: lo encontró Antonio probando en
`development` el 28/10. **Toca lo que el tester va a mirar en Sesiones**, así
que conviene re-ejecutar los casos de Asistencias y los de D69.

**El síntoma.** Una actividad con dos asistencias registradas salía en
Sesiones con **0 cambios** y la sincronización en **"Error"**. Rúbrica y
Registro de Vuelo, bien. Eran **dos** fallos del mismo sitio, y Asistencias
era el único de los cuatro módulos con los dos.

**1. El `id_actividad` no viajaba.** El contrato lo da como opcional y dice
que, si falta, vale "la activa". Eso es lo que no se podía dar por bueno: la
operación sale **cuando la cola puede**, que puede ser después de que el
Docente cerrara la actividad o al recuperar la señal horas más tarde.
Entonces no hay ninguna activa, el servidor no tiene a qué atribuir la marca
y la actividad queda sin cambios. Lectura, Rúbrica y Vuelo ya lo mandaban
dentro del registro; Asistencias no, ni en el registro ni en el aviso de
`POST /sincronizacion/pendientes`.

**2. El rechazo desaparecía en silencio, y es D69 otra vez.** El lote
responde **200 aunque un ítem venga rechazado**, así que para la cola el
envío fue bien. La pantalla sí lo atendía —revertía el control y avisaba—,
pero **solo mientras siguiera abierta**: tras recargar la página esa promesa
ya no existe y el rechazo se perdía. D69 se arregló para Lectura, Rúbrica y
Vuelo en `45410fb`; a Asistencias se le había pasado, porque no usa la misma
tubería (`registrosOffline`) que los otros tres.

Ahora se anota en el envío —por donde pasa toda marca, venga de un clic o de
la cola— y la pantalla de Asistencias tiene su **aviso de conflictos**, que
era el único de los cuatro módulos sin él.

> **Para el tester, lo práctico:** el botón **"Descartar"** de ese aviso
> llama a `POST /sincronizacion/operaciones/{id}/descartar`, que según el
> contrato hace que la operación **"deje de contar como error en los estados
> de la actividad y del docente"**. Es la forma de limpiar una actividad que
> quedó en "Error", y desde Asistencias no había manera de llegar a ella.

**Lo que no se pudo verificar desde el código:** *por qué* el servidor
rechazó esas dos marcas concretas. Los dos defectos de arriba explican que la
actividad saliera con 0 cambios y que el rechazo fuera invisible, pero el
motivo del rechazo lo dice el servidor. **Al repetir la prueba, ahora sale en
pantalla**; si fuera `sin_habilitacion`, es otra conversación y habría que
anotarla.

**Y una segunda tanda, el mismo día (`04db3be`).** Al repetir la prueba con el
arreglo puesto, **el motivo del rechazo ya salía en pantalla**:
`sin_clase_programada`, "No hay una clase programada para esta fecha. Para
registrarla, márcala como clase adicional". Eso destapó otras dos cosas:

- **El aviso del servidor se escondía.** El GET ya manda `aviso: "No hay una
  clase programada para esta fecha."`, pero la pantalla lo pintaba dentro de
  un bloque condicionado a que hubiera `etiqueta` —y sin clase la etiqueta
  llega `null`—. **Justo en el caso donde el aviso importa, no se veía**, así
  que se marcaba media tabla y la noticia llegaba por el rechazo.
- **Faltaba la salida que el propio mensaje recomienda.** CU022 la describe:
  *"Antes de habilitar la lista para escritura, presenta el botón **Registrar
  clase adicional**"*. El backend lo soporta (`adicional: true`) y el recurso
  del front ya lo mandaba, pero no había ningún control que lo activara: el
  servidor pedía algo que la interfaz no ofrecía.

Ahora la lista queda **bloqueada** hasta que el Docente lo decide, y la
decisión viaja con la marca: CU022 dice que *"la clase se crea al guardar
satisfactoriamente la primera asistencia, sin generar registros vacíos por
pulsar el botón"*, así que arrepentirse no deja ninguna clase vacía detrás.
No sustituye ninguna validación: sesión, actividad, calendario y
habilitación siguen decidiendo igual.

> **De dónde salen las clases, que es lo que nadie tenía claro.** No se crean
> una a una: el servidor las deriva del **día de clase de cada grado**
> (Colegios → el colegio → Editar → Grados), del **calendario** —la fecha
> tiene que caer en un PA y no ser día no lectivo— y de que **haya alumnos
> con pertenencia en esa fecha**. Si un grado tiene los miércoles y se mira
> un martes, ese día no hay clase, y es correcto. La clase adicional es la
> excepción puntual para ese caso.

**Un cambio de presentación, en el mismo commit:** los avisos de rechazo
pasan a **una tarjeta cada uno**. Con dos o tres dentro de la misma caja se
leían como un solo aviso largo y no se veía a qué alumno pertenecía cada
botón "Descartar". Afecta a los cuatro módulos y al panel de sincronización,
que comparten el mismo componente.

### RONDA 6 del tester (28/10/2026) — 10 corregidos, 2 sin tocar

Joaquín ejecutó 98 casos sobre el frontend **`aad2bda`** y el backend
`30023e2`. De los 37 defectos abiertos cerró 19, dejó 15 parciales y 3
persisten; abrió **10 nuevos** (D80 a D89).

> **Ojo con la versión.** Después de `aad2bda` ya habían entrado `04db3be`,
> `7ea5261` y `4efb550`, así que parte de lo que la ronda reporta ya estaba
> corregido cuando se escribió el informe. Lo que sigue es lo que faltaba de
> verdad.

#### Corregidos en `409c09b`

| Defecto | Qué pasaba | Qué se hizo |
|---|---|---|
| **D65** | El campo "Pertenece al grupo desde" se pedía pero **no viajaba**: el cuerpo del `PATCH` no lo incluía | Se manda, y **no junto a `cambio_grupo_desde`**: son dos fechas para el mismo hecho y el servidor rechaza que viajen las dos (tanda L1) |
| **D80** | Los colegios con todos sus periodos terminados salían como bloques vigentes y se reenviaban; como la lista del `PATCH` es el conjunto **deseado**, el backend reasignaba al Docente en el PA en curso | Llegan con `solo_historial` (tanda L2): se muestran aparte, en solo lectura, y **no se reenvían** |
| **D83** | Grado "3" y Sección "—"; el filtro Sección repetía "Única"; el modal sin año ni PA; el historial no se refrescaba; Cancelar con datos cerraba sin preguntar | Los nombres los cierra el backend (tanda L3) —el front ya los leía—. Lo demás, aquí: año y PA en el modal, secciones por grado, historial refrescado y confirmación al descartar |
| **D82** | Recargar sin conexión mostraba "No se pudo contactar con el servidor" y dejaba al Docente sin nada | El perfil vive en memoria y la recarga lo pierde: ahora se guarda una copia y se usa **solo cuando el servidor no contesta**. Un 401 o un 403 siguen cerrando la sesión |
| **D84** | Cancelar sin haber tocado nada pedía "Descartar cambios" | Se compara contra el borrador con el que se entró. Una confirmación que no protege nada entrena a pulsarla sin leerla |
| **D89** | Si la actividad se cerraba en otra pestaña, la barra seguía ofreciendo "Finalizar actividad" y cada registro se descartaba | Se suelta la actividad local, **con dos guardas**: solo si la respuesta del servidor es posterior a su inicio y solo si el servidor llegó a conocerla |
| **D87** | Rúbrica y Registro de Vuelo servían la copia en memoria aunque hubiera conexión; lo de otro dispositivo no aparecía y editar encima terminaba en conflicto de versión | Las dos vuelven a pedir los datos al entrar (`staleTime: 0`). Son módulos que escriben varias personas sobre los mismos alumnos |
| **D81** | El año del calendario era la lista de los ya creados: para configurar 2027 hacía falta que 2027 existiera, y lo que lo crea es ese formulario | Pasa a ser un **año calendario** y ofrece el siguiente. Al crear se manda `anio` y el backend crea el año escolar en la misma transacción (tanda C2) |
| **D56** | Asistencias no ofrecía el aula del permiso | Sale del paquete offline, que desde la tanda I trae los nombres: también funciona **sin conexión** |
| **D51** | `sicedu.habilitaciones` se quedaba en IndexedDB al cerrar sesión | Se borra con el resto. El siguiente usuario del navegador heredaba con qué escribir sin conexión |

**D89 tuvo trampa, y conviene saberlo.** El primer arreglo borraba la
actividad **recién abierta** cuando la respuesta del Inicio era anterior a
ella. Lo cazó la suite, no una revisión: de ahí las dos guardas.

#### Lo que NO se tocó, y por qué

**D85 (Rúbrica) y D86 (Registro de Vuelo)** no son correcciones: son
**rediseños** contra CU029–CU032 v8. Cambian los filtros, las columnas, el
modo de edición —de autoguardado a "Registrar" + "Guardar"—, el panel de
letras agrupadas y todos los mensajes de CU030 y CU032. Hacerlos a medias
entre otros diez arreglos habría salido peor que no tocarlos. **Necesitan su
propia fase**, y son los dos que bloquean la aprobación de esos módulos.

**D88** es del backend y del analista (regla R1). **D58 / S10** lo cerró el
backend en la tanda L4.

**Parciales que siguen abiertos:** D57 (reloj adelantado), D61 (Colegios y
Usuarios sin conexión, y el modal que pierde lo escrito), D64 (abrir el
módulo al pulsar una fila), D67 (textos de ayuda de CU016), D69 (el rechazo
tiene que sobrevivir a la recarga), D70, D71, D73, D74, D75, D77 y los
textos de D62.

---

#### Qué se subió y qué no

`development` está en **`59eb6a9`** (`cc9bb8f..59eb6a9`, avance directo, sin
`--force`). Son **23 commits**: los 22 del sprint más el del Dashboard, que
añade **28 archivos** (21 nuevos y 7 tocados).

**No se subieron, a propósito:** la carpeta `prompts/` (las fuentes del
analista, del tester y del backend) y los `.md` de `docs/` de este sprint
—este plan y `docs/decisiones-externas-y-pendientes-de-backend.md`—. Se pasan
a mano. En el repositorio, `docs/` sigue teniendo solo `trazabilidad-rf.md`,
que ya estaba.

#### Archivos nuevos del sprint

Quince, sin contar las pruebas. Es el inventario de lo que antes no existía:

| Archivo | Qué es | Fase |
|---|---|---|
| `src/lib/actualizacion.js` | Registro del Service Worker y aviso de versión nueva | 4.1 |
| `src/components/layout/AvisoVersionNueva.jsx` | "Hay una versión nueva": no recarga solo | 4.1 |
| `src/components/layout/ServidorInalcanzable.jsx` | Pantalla de servidor caído con "Reintentar", para no mandar al login | 1.6 |
| `src/api/resources/clases.js` | `GET/POST` de clases y reprogramaciones (CU013) | 2.2, 2.3 |
| `src/features/colegios/DetalleColegio.jsx` | Vista interna del colegio, con "Volver a Colegios" | 2.2 |
| `src/features/colegios/ProgramacionDeClases.jsx` | La tabla de clases del mes | 2.2 |
| `src/features/colegios/ModalReprogramar.jsx` | Reprogramar una clase | 2.3 |
| `src/features/colegios/ModalHistorialReprogramacion.jsx` | "Ver reprogramación" y su historial | 2.3 |
| `src/features/colegios/ModalesDelCalendario.jsx` | Los cuatro modales de CU027 | 2.4c |
| `src/features/usuarios/ColegiosDelDocente.jsx` | Varios colegios por Docente, con su bloque de receso | 3.1 |
| `src/features/usuarios/ModalRevocarPermiso.jsx` | Revocar un permiso, separado de "Ver permiso" | 3.3 |
| `src/features/estudiantes/GraficaDeVuelo.jsx` | La trayectoria de PA1 a PA4 por nivel descriptivo | 5.1 |
| `src/features/lectura/HistorialDeclaraciones.jsx` | Historial de "no realizada", con sus reversiones | 6.3 |
| `src/features/lectura/ModalHabilitarRegistro.jsx` | "Habilitar registro de lectura" | 6.3 |
| `src/features/lectura/ModalCambiarClase.jsx` | Elegir otra clase de referencia de la semana | 6.2 |

Y **doce archivos de prueba nuevos**, uno por bloque de comportamiento:
`permisoConZona`, `servidorCaido`, `sinErrorGenerico`, `cuentasProtegidas`,
`otroUsuario`, `programacionDeClases`, `variosColegios`, `revocarPermiso`,
`iniciarConPermiso`, `filtrosConPermiso`, `etiquetaSemana` y `tablaPorSemana`.
Los archivos de prueba que ya existían también crecieron: la suite pasó de
**736 a 810** pruebas.

#### Lo que apareció al implementar y no estaba en el plan

Ninguno estaba en la lista del tester. Salieron al tocar el código y se
arreglaron en el mismo commit del defecto que los destapó.

**Dos fallos latentes del formulario de mantenimiento** (`33486df`), los dos
en `PopupMantenimiento.jsx`, y los dos invisibles hasta ahora:

- **El id del registro se buscaba por la sección en PLURAL.** La fila del
  alumno trae `id_alumno`, no `id_alumnos`, así que en Alumnos el id salía
  `null`: el popup **nunca pedía el detalle** —y con él `pertenece_desde`— y la
  pestaña de auditoría salía **siempre vacía**, sin dar ninguna señal de que
  faltaba el dato. Ahora se prueba primero el singular (`entidad`).
- **Completar la fila con el detalle BORRABA campos.** Un `undefined` del
  detalle pisaba el valor que sí traía la fila: la sección se perdía y el
  formulario creía que el alumno cambiaba de grupo, con lo que pedía la fecha
  del cambio en **cada** edición aunque no se hubiera tocado nada.
- De paso, la auditoría decía **"modificó el registro"** en vez de la frase de
  CU015 ("editó al alumno"), porque el sujeto se buscaba también por la
  sección en plural.

**Otros cambios que no estaban pedidos pero hacían falta:**

| Qué | Dónde | Por qué |
|---|---|---|
| El `mes` sale de la clave de consulta de la tabla de lectura | `5993c5b` | Ajustar el filtro al mes que responde el servidor disparaba otra petición por los mismos datos y la tabla **parpadeaba**: `data` quedaba en `undefined` y el docente veía desaparecer su trabajo |
| Una sola etiqueta de semana en toda la aplicación | `a9d16cf`, `5993c5b` | Había dos formatos para el mismo dato ("Sem. 23 · 15/06 al 19/06" y "Semana 23 · 15 – 19 jun"), y en una semana partida ninguno decía de qué año eran los días |
| `dayjs(undefined)` es **ahora** y se declara válido | `a9d16cf` | Era la mitad del "Semana undefined · 22 – 22 oct": el número salía `undefined` y el rango se pintaba con el día de hoy en vez de callarse |
| El tooltip se abre también **al toque** | `33486df` | CU015 pide el ícono de información consultable "mediante clic o toque", y en un móvil no hay hover: ese texto no existía para media flota de dispositivos |
| `porDefecto` admite una función del registro | `33486df` | D65 pide proponer la fecha de creación del alumno, que solo se sabe mirando el registro |
| El detalle del simulador usa el MISMO mapeo que su listado | `33486df` | Un detalle con menos campos que la fila es justo lo que destapó el fallo de arriba |
| El botón de actividad **no se deshabilita mientras no se sabe** | `99f5db8` | Deshabilitarlo "por si acaso" enseña un motivo que nadie ha comprobado; dejándolo activo, como mucho el servidor responde su 422 con el texto bueno |

#### Lo que NO se cierra aquí

Está en **`docs/decisiones-externas-y-pendientes-de-backend.md`** (antes
`propuesta-visibilidad-sincronizacion.md`), anexo **S1 a S19**, separado por
responsable:

- **Tres decisiones que tomó el frontend por su cuenta**, cada una con su
  motivo y cómo revertirla: **S2** (Editar sin actividad), **S8** (pertenencia
  de un alumno inactivo) y **S14** (el rechazo de Rúbrica se ve en la fila y en
  el aviso). **S12 se retiró**: estaba mal y CU026 ya la respondía.
- **Cuatro que esperan al analista:** **S2**, **S8**, **S3** (menú del
  Supervisor) y **S4** (el tooltip de "Iniciar actividad" deshabilitado, el
  único literal que sigue sin fijar). **S1** y **S11** ya están resueltos.
- ~~**Once que esperan al backend**~~ — **✅ NINGUNO**. El backend respondió el
  28/10 (`e9de58b`, Tanda I) y están los once resueltos; lo que exigía cambios
  en el front se hizo en `7ea5261`. Eran: **S5**, **S6**, **S7**, **S9**, **S10**,
  **S13**, **S17** (qué calendarios trae `GET /me/habilitaciones`, abierta
  desde la semana 11), **S15** (la forma completa de
  `GET /alumnos/{id}/historial`, que el front ya consume a ciegas), **S16**
  (los permisos de `GET /me/habilitaciones` no traen los NOMBRES del colegio y
  el grado, así que el aula del permiso no se puede ofrecer sin conexión) y
  **S18** y **S19**, que salen de `docs/propuesta-otorgar-permisos.md` —el
  endpoint de lote para otorgar permisos y el `id_periodo_academico` de la
  asignación—, de una propuesta **ya confirmada por el equipo**.

---

### FASE 8 · Dashboard (CU033, CU034 y CU035) — ✅ HECHA

Commit **`59eb6a9`**, del 29/10/2026. Cierra **D49** por el lado del frontend.

**Por qué entra ahora y no antes.** El Dashboard estaba decidido como *no se
implementa* (S1): el tester lo anotó en D49 como "módulo sin caso de uso ni
implementación", y el código del mockup viejo se había borrado en `3070755`.
Lo que cambió son dos cosas a la vez: los casos de uso actualizados traen
**CU033, CU034 y CU035 completos**, y el backend publicó los **once endpoints**
de `/dashboard/*` (serie D1–D7). Sin cualquiera de las dos, esto no se podía
construir sin inventar.

**Las rutas provisionales de Romina ya no existen** y responden 404
(`/dashboard/cumplimiento`, `/niveles`, `/aprendizaje`, `/lectura`), y las del
mockup viejo tampoco: se retiraron de `src/api/endpoints.js` junto con los
handlers del simulador que las resolvían.

#### 8.1 Una ruta, dos pantallas

| Bloque | Supervisor (CU033 y CU034) | Directivo (CU035) |
|---|---|---|
| Resumen anual de Primaria | — | ✅ |
| Distribución por subprograma | ✅ | — (403) |
| Resultados de aprendizaje | ✅ | ✅ |
| Comparación de resultados (con filtro de grados) | ✅ | — (403) |
| Asistencia: resumen y gráfico mensual | ✅ | ✅ |
| Detalle por grado, sección y clase | ✅ | — (403) |
| Evolución anual | ✅ (alumnos) | ✅ (alumnos y libros) |
| Comparación entre colegios | — | ✅ |
| Consolidado de libros leídos (CU034) | ✅ | — (403) |

**EL DIRECTIVO ENTRA AL DASHBOARD, y eso no contradice RN-033 ni RN-034.** Los
cinco endpoints nominales le responden 403 y su pantalla no tiene ningún
listado de alumnos: ve totales y porcentajes. No es una promesa: lo comprueba
`src/features/__tests__/directivoSinNombres.test.jsx`, que recorre **todas** sus
rutas —`/dashboard` incluido, porque esa lista se construye con la matriz de
permisos— y busca en el documento el nombre y el código de **cada** alumno del
simulador.

#### 8.2 La regla que gobierna el módulo: sin información NO es cero

Vive en un solo archivo, `src/features/dashboard/estados.js`, y es lo que los
tres casos de uso repiten en cada flujo alternativo:

> *"El sistema no representa la ausencia de información como 0 alumnos, 0 %,
> 0 libros ni un nivel de desempeño. El valor 0 se muestra únicamente cuando
> existe información suficiente para confirmar esa cantidad."*

No es una preferencia de redacción. Un **0 % de asistencia** dicho de un
colegio que todavía no empezó su periodo es una acusación falsa, y un **0 en
libros** de un mes que aún no ha ocurrido es un incumplimiento inventado. El
backend ya distingue las dos cosas —manda `null`, `sin_informacion`,
`sin_datos`, `futuro`, `no_aplica`— y el front lo traduce **una vez**, para que
ningún bloque lo resuelva a su manera con un `?? 0`.

Lo que se distingue, bloque a bloque:

| Lo que llega | Lo que se ve |
|---|---|
| `null`, `sin_informacion`, `sin_datos` | "Sin información". Nunca 0 |
| Un `0` con estado `completo` | **0**, que es un dato: ausentes, "No realizada", LSL 0 |
| `futuro` | Sin punto y sin valor; la línea del gráfico **no atraviesa** el hueco |
| `en_curso` | "En curso": es un acumulado hasta hoy, no un cierre |
| `parcial` | "Parcial" / acumulado hasta la fecha de consulta |
| `provisional`, `evaluacion_incompleta`, `registro_incompleto`, `incompleto` | El valor con su aviso; la posición es provisional |
| `no_aplica` | "No aplica", sin cero y sin posición |
| `posicion: null` | Sin posición, con el `mensaje` que manda el servidor |

**No se recalcula ni se reordena nada en el cliente.** Los porcentajes llegan
con su decimal y el orden lo decide el servidor con el valor **sin redondear**:
si el front ordenara por el valor visible —dos decimales—, dos grupos
distintos empatarían a ojos de la pantalla y no del servidor.

#### 8.3 "Aplicar" no es un botón de buscar

Es la frontera entre lo que se está eligiendo y lo que se está mirando
(`useFiltrosDashboard.js`). Mientras haya cambios sin aplicar, **cada bloque**
sigue rotulado con el año, el periodo y los colegios de **su** consulta y lleva
el aviso **"Cambios sin aplicar"**. Un dashboard que se recarga a cada clic
enseña resultados intermedios que nadie pidió y, peor, los enseña bajo el
título de la selección nueva.

Lo demás que gobierna los filtros, todo literal de CU033 y CU035:

- **La carga inicial sí es automática**, pero solo "cuando las selecciones
  iniciales están completas y son válidas".
- **Se restaura la selección anterior**; si no hay, la que calcula el servidor
  (`seleccion_inicial`). Si llega `null` —hoy no cae en ningún PA ni PR— los
  filtros se quedan vacíos y se piden: el CU prohíbe elegir "un calendario por
  aproximación".
- **Una selección vacía de colegios no equivale a "Todos"**: deshabilita
  "Aplicar", y el propio control lo explica.
- **"Todos los colegios" no es "marcar los nueve"**: viaja como
  `todos_los_colegios=true`, que significa *el alcance autorizado, el que sea
  hoy*. Si mañana se autoriza uno más, entra sin tocar el filtro.
- **Si el alcance cambia**, los colegios que dejaron de estar autorizados se
  retiran de la selección y se avisa: *"Tu acceso a los colegios ha cambiado.
  Revisa la selección para continuar."* No se consulta en silencio con menos
  colegios de los que la persona cree.
- **Los periodos se nombran "Tercer periodo"**, nunca "PA3". Hay una prueba que
  busca `PA3` en todo el documento y falla si aparece.

#### 8.4 Un bloque que falla no arrastra a los demás

`BloqueDashboard.jsx` es el marco de los nueve, porque los tres CU piden lo
mismo para todos: *"Si el problema afecta únicamente a un bloque, el aviso
aparece dentro de ese bloque. Los demás conservan los resultados cargados
correctamente."*

- El error lleva su literal —*"No se pudo cargar la información. Verifica tu
  conexión e inténtalo nuevamente."*— y su **"Reintentar"**.
- Si había resultados anteriores, **se quedan visibles** marcados como
  **"Información no actualizada"**: no se presentan como resultados de la
  selección nueva, y no se pintan como ceros.
- El `422 calendario_no_configurado` **nombra los colegios** afectados: el CU
  prohíbe excluirlos en silencio o usar el calendario de otro.

#### 8.5 Las tres reglas del contrato que se equivocan solas

Viven en `src/api/resources/dashboard.js` y las tres se castigan con un 422 que
no se ve mirando la pantalla:

1. **El periodo académico es obligatorio en unos bloques y prohibido en otros.**
   Libros y evolución anual son **anuales**: mandarlo es *"Este indicador es
   anual: no elijas un periodo académico."* Por eso cada función declara lo
   suyo y los filtros se recortan en un solo sitio, y no hay que acordarse de
   esto en cada pantalla.
2. **`todos_los_colegios` O la lista, nunca las dos** —y tampoco ninguna—.
3. **La serialización.** Axios manda un array como `id_colegios[]=1`, con
   corchetes, y el backend espera `id_colegios=1&id_colegios=4`. Lo arregla
   `paramsSerializer: { indexes: null }`, y es la clase de detalle que se
   descubre con un 422 incomprensible.

En la comparación entre colegios la regla depende del **indicador**:
`promedio_libros` es anual y los otros tres son del periodo, así que eso vive
en la misma tabla que su etiqueta (`INDICADORES_COMPARACION`) y no en un `if`
de la pantalla.

#### 8.6 "Descargar gráfica" (PNG con fondo blanco)

El flujo alternativo que los tres CU piden para **cada** gráfica cargada
correctamente. Está en `src/lib/descargarGrafica.js`:

- **PNG con fondo blanco**, porque un PNG transparente pegado en un informe de
  fondo oscuro deja los textos invisibles, y lo que se exporta es para pegarlo.
- **La imagen lleva su contexto dentro**: el título, el año escolar, el periodo
  o intervalo, los colegios y las advertencias de información incompleta. Sin
  botones ni menús de la interfaz.
- **Exporta lo aplicado**, no los filtros pendientes: eso se cumple solo,
  porque se serializa el SVG que está en pantalla, y ese se dibuja con los
  filtros de la consulta mostrada.
- Queda **deshabilitada** mientras la gráfica carga, tiene un error, no tiene
  datos o no hay conexión. Si falla la generación, muestra *"No se pudo
  descargar la gráfica. Inténtalo nuevamente."* y se puede reintentar.

**Por qué las gráficas llevan los colores en atributos y no en clases de
Tailwind:** un SVG serializado viaja **sin** la hoja de estilos de la página, y
un `class="fill-ink-500"` se queda sin definición dentro del PNG —el texto sale
negro o invisible—. De ahí `graficas/paleta.js`, que son los mismos tokens de
§4.1 escritos en hexadecimal.

#### 8.7 Lo que se tocó fuera del módulo

- **`src/features/asistencia/useFiltrosAsistencia.js`** ahora acepta
  **colegio, grado y sección** por la URL, no solo `?fecha=`. Lo necesita el
  detalle de asistencia (CU033, paso 8): al pulsar una clase se abre CU022 "en
  modo consulta, con los filtros correspondientes precargados". Con solo la
  fecha, el Supervisor aterrizaba en el día correcto pero **en el aula que miró
  la última vez**, y leía como de esa clase unos datos que eran de otra.
- **`src/auth/permisos.js`** gana la sección `dashboard`, que es la **décima**:
  la matriz del sprint de cierre tenía nueve y es anterior a estos casos de uso.
- **`src/hooks/useCatalogos.js`**: `useGradosReales` y `useProgramasReales`
  aceptan `{ enabled }`, para no pedirle al Directivo dos catálogos de
  administración que le responderían 403.
- **`e2e/f2-control-de-acceso.spec.js`** y
  **`e2e/f5b-cu012-directivo-sin-estudiantes.spec.js`**: el Docente no entra a
  `/dashboard`, y el Directivo no entra a `/dashboard/libros`.

#### 8.8 Qué va a ver el tester en el simulador

El simulador (`src/api/mock/dashboard.js`) **siembra a propósito** los estados
que no se pueden probar con datos bonitos. Si alguno deja de llegar, la
pantalla que lo pinta deja de estar probada aunque todo "funcione":

| Qué | Dónde se ve |
|---|---|
| Un colegio con el periodo sin iniciar (**Yanama**) | No suma y va aparte: *"Todavía no empezaron el periodo seleccionado"*. **No** como 0 alumnos |
| Un colegio sin ningún registro de lectura (**Tinco**) | Sin promedio y **sin posición**, con el aviso de que eso no es lo mismo que tener cero libros |
| Meses futuros | Sin barra, sin punto y sin valor |
| El mes en curso | Rotulado "En curso", con la barra a media tinta |
| Un grupo con evaluaciones pendientes | "Evaluación incompleta" y posición **provisional** |
| Un grupo sin ninguna evaluación completa | Aparte, **sin índice y sin posición** |
| Un grupo donde el subprograma no está configurado | "No aplica", sin cero y sin posición |
| Una clase con asistencias pendientes | "Registro incompleto" |
| Clases programadas sin ningún registro | Tabla aparte: *"No se consideran dictadas ni generan ausencias"* |
| Una lectura declarada "No realizada" | Aporta **0**, y se distingue del hueco |

#### 8.9 Pruebas de la fase

**26 pruebas nuevas**, en tres archivos:

- `estados.test.js` (9) — la regla de "sin información no es cero", los
  formatos y las etiquetas de estado. Es la más barata y la que más sujeta: si
  alguien "simplifica" `estados.js` con un `?? 0`, se ve aquí antes de que el
  Supervisor lea un 0 % que nadie midió.
- `parametros.test.js` (7) — las tres reglas del contrato del 8.5, más los
  colegios del `422 calendario_no_configurado`.
- `dashboard.test.jsx` (10) — la pantalla entera contra el simulador: la carga
  inicial automática, que tocar un filtro **avise** en vez de recargar, el
  detalle de clases con su enlace a CU022, el consolidado de libros con su
  detalle por grado y su desglose por alumno, y que el Directivo **no** vea los
  bloques nominales.

#### 8.10 Lo que NO entra en esta fase

- **No funciona sin conexión**, y es restricción expresa de los tres CU: *"El
  dashboard requiere conexión a Internet. No dispone de un modo de consulta
  offline."* Sin red se muestra la pantalla de "Requiere conexión", y nada de
  esto entra en IndexedDB ni en la cola de escrituras.
- **La forma exacta de cada respuesta está ASUMIDA, no confirmada.** El
  contrato del backend publica los endpoints, los filtros, los estados y los
  errores, pero el JSON campo por campo vive en su `API.md`, que no tenemos en
  este repositorio. El front lee los nombres que el contrato nombra y tolera
  que falte un campo, pero **conviene que el backend confirme la forma** antes
  de probar contra el servidor real: queda anotado como **S23** en
  `docs/decisiones-externas-y-pendientes-de-backend.md`. **Ya resuelto: ver
  8.11.**
- **Las gráficas siguen siendo SVG propio**, no recharts. El stack lo permite,
  pero una dona de dos sectores y tres líneas no justifican un contenedor que
  mide el ancho con un `ResizeObserver`, y el PNG exige los colores en
  atributos de todas formas.

#### 8.11 Alineado con el contrato real del backend (S23) — ✅ HECHO

Commit `fix(dashboard): alinea las respuestas con el contrato del backend (S23)`,
en `development` justo después de `f6fd938`.

La forma asumida en el 8.10 no era la del backend: contra el servidor real casi
todos los bloques habrían salido vacíos o en "Sin información", y las pruebas no
lo veían porque el simulador devolvía las mismas formas supuestas. Se arregló
**sin tocar el backend**, tomando `app/schemas/dashboard.py` como fuente de
verdad:

- **Un adaptador por endpoint** (`adaptarX`, exportado) en
  `src/api/resources/dashboard.js`: recibe la respuesta real y la deja en la
  forma que lee su pantalla. El contrato queda escrito en un solo archivo, un
  `null` sigue siendo `null` y lo que la pantalla no lee también pasa.
- **El simulador devuelve la forma real** y pasa por el mismo adaptador, como
  en producción.
- **Prueba de contrato** (`src/api/resources/__tests__/dashboard.contrato.test.js`,
  27 pruebas): un ejemplo completo de cada modelo por su adaptador, y los
  campos del simulador comparados con los de los modelos.
- **Selección de colegios** en `libros/colegios/{id}` y `libros/desglose` (sin
  ella el backend daba 422) y en `asistencia/clases`, que mandaba el colegio
  como `id_colegios` en vez de `id_colegio`. El desglose usa los filtros de la
  consulta aplicada. 4 pruebas nuevas en `parametros.test.js`.
- Pantallas, solo donde la forma del backend ya era la buena o se perdía
  información: la evolución lee `alumnos_atendidos` y `colegios_atendidos`, el
  detalle de clases lee dos listas (dictadas y sin registro), las columnas de
  la comparación de resultados salen de `escala`, una dimensión sin evaluados
  no pinta la tabla de ceros, y la comparación entre colegios muestra población,
  advertencias y el motivo de cada colegio sin información.

---

## 4. Matriz: defecto → fase

| Defecto | Sev. | Módulo | Fase |
|---|---|---|---|
| D76 | Bloqueante | Permisos | 1.1 |
| D46, D47 | Bloqueante | Asistencias, Rúbrica, Vuelo | **ya corregidos** · verificar en Fase 7 |
| D43 | Mayor | Sin conexión | 4.1 |
| D44 | Mayor | Logout | 4.5 |
| D45 | Mayor | Sin conexión | 4.2 |
| D48 | Mayor | Navegación | 1.3 |
| D49 | Mayor | Navegación, Dashboard | 1.2 (menú) y **8** (las tres pantallas) |
| D50 | Mayor | Colegios | 2.2, 2.3 |
| D51 | Menor | Sesión | 1.5 |
| D52 | Mayor | Inicio | 1.6 |
| D53, D54, D55 | — | Inicio | **backend** · solo verificar |
| D56 | Mayor | Inicio | 5.4 |
| D57 | Mayor | Sesión | 1.6 |
| D58 | — | Inicio | 5.5 (+ analista) |
| D59 | Menor | Alumnos | 1.4 |
| D60 | Menor | Colegios | 2.1 |
| D61 | Mayor | Sin conexión | 4.3 |
| D62 | Menor | Transversal | 0.4, 0.5 |
| D63 | Mayor | Alumnos | **backend** + 5.3 (filtro) |
| D64 | Mayor | Alumnos | 5.1 |
| D65 | Mayor | Alumnos | 5.2 |
| D66 | Menor | Usuarios | **backend** + 3.2 (placeholder) |
| D67 | Mayor | Usuarios | 3.1 |
| D68 | Menor | Usuarios | 1.4 |
| D69 | Mayor | Sincronización | 4.4 |
| D70 | Mayor | Calendario | 2.4a, 2.4e |
| D71 | Mayor | Calendario | 2.4b |
| D72 | Mayor | Calendario | 2.4c |
| D73 | Mayor | Calendario | 2.4b |
| D74 | Menor | Calendario | 0.4, 2.4f |
| D75 | Mayor | Calendario | 2.4d |
| D77 | Mayor | Permisos | 3.3 |
| D78 | Mayor | Permisos | 3.4 |

**Cobertura:** los 36 defectos quedan asignados. Cinco son solo de backend (D53, D54, D55, D63, D66)
y ya están corregidos según la Tanda F: en esos solo hay que **volver a probar** y, donde el front
contribuye, hacer su parte (D63 el filtro, D66 el placeholder).

---

## 5. Criterios de aceptación

Salen de `cambiosTest_semana11_v3.md` y `cambiosTest_semana12_v1.md`, que es lo que QA va a ejecutar.
Un defecto **no se cierra** hasta que su caso pasa en `development`.

| Fase | Casos que deben pasar |
|---|---|
| 0 | Casos sin actividad de los cuatro módulos; textos de login, bloqueo y PIN; orden de CP-ALU, CP-ASI, CP-LEC, CP-RUB, CP-SEG, CP-COL |
| 1 | CP-PER-02/04/07/09 (D76), CP-ROL-01/03/05, CP-INI-04, CP-USR-05, CP26, CP-INI-12/19/22 |
| 2 | CP-COL-01/04/07/08/09, CP-CAL-01 a 08 |
| 3 | CP-USR-01/02/09, CP-PER-01/02/04/05/08 |
| 4 | CP09, CP13, CP14, CP-INI-12/15, CP-USR-10, CP-PER-10, CP-ALU-06/09, CP-USR-06, CP-CAL-07 |
| 5 | CP-ALU-01/08/09/10/11, CP-INI-01/09/11/13/20/26, CP03 |
| 6 | CP-LEC completo, CP-RUB, CP-VUE |

**Versión del backend contra la que probar:** `30023e2` o posterior (cierra la serie F, G, H). La
referencia del contrato es **`BCK-SICEDU/API.md`** de ese commit: 89 endpoints, paginación de 40 en
todos los listados, sin `limit` ni `offset`.

---

## 6. Riesgos y cosas que conviene mirar dos veces

1. **El Service Worker puede dejar a un Docente con la versión vieja pegada** en mitad de una
   jornada. Por eso `registerType: 'prompt'` y no `autoUpdate`. Y nunca cachear `/api/`.
2. **La Fase 2 toca una pantalla de 529 líneas** que ya funciona para el caso general. Partirla antes
   de añadirle fechas particulares, cuatro modales y la copia offline; si no, queda intratable.
3. **El cambio de `asignacion` (3.1) rompe el alta y la edición de usuarios.** Es un cambio de forma,
   no aditivo: un body con la forma vieja responde 422. Conviene hacerlo de una vez, con sus pruebas,
   y no a medias.
4. **`GET /semanas` ya no es un catálogo global.** Quedó anotado en el simulador: **cuatro pantallas
   anteriores** (Nivel final, Consolidados, detalle del alumno y resumen del Inicio) lo llamaban
   **sin filtros** como si lo fuera. Contra el backend real eso responde 422. Dos de ellas ya no
   existen; hay que revisar las otras dos en la Fase 5.
5. **No recalcular en el cliente lo que calcula el servidor**: Salud del Sistema, `resultado_decimas`,
   `total_libros`, `avance_anual`, el estado de las filas y el orden de los listados. Duplicar la
   regla da dos verdades distintas y nadie sabe cuál creer.
6. **Las operaciones rechazadas no se borran.** Es la diferencia entre "el docente ve que su dato no
   subió" y "el dato desapareció sin que nadie se entere".
