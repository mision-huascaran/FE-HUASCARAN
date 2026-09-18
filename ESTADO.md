# Estado del frontend SICEDU

> Última actualización: 17/09/2026. Documento de avance del equipo: qué está
> construido, qué falta y qué decisiones quedan abiertas. El plan completo está
> en `PROMPT_FRONTEND_SICEDU.md`; aquí solo se registra dónde quedó el trabajo.

## Resumen

| Fase | Alcance | Estado |
|---|---|---|
| **Fase 1** | Proyecto Vite, tokens de Tailwind, fuentes, assets, componentes `ui/`, catálogo visual `/_ui` | **Terminada** |
| **Fase 2** | Login (P1), `AuthProvider`, guardas de ruta, `/403` (P18), shell por rol (P2), modo mock | **Terminada** |
| **Fase 3** | Inicio del docente (P3), reporte semanal (P4), rúbrica semanal (P5), cola offline y `SyncBadge` | **Terminada, sin revisión visual** |
| **Fase 4** | Registro de vuelo: histórico (P6), formulario de 3 pasos (P7), trazabilidad (P8), `domain/nivelFinal.js` | **Terminada, sin revisión visual** |
| **Fase 5** | Estudiantes (P10), ficha (P11), nivel final mensual (P9) | **Terminada, sin revisión visual** |
| **Fase 6** | Dashboard (P12), colegios y ranking (P13), consolidados (P14), alertas (P15), consulta de colegios (RF-003) | **Terminada, sin revisión visual** |
| **Fase 7** | Administración (P16), panel ejecutivo (P17), reportes, exportaciones, `STACK_FRONTEND.md`, `README.md`, `docs/trazabilidad-rf.md`, `Dockerfile`, `nginx.conf` | **Terminada; imagen Docker sin construir** |

Verificación a la fecha: `npm run lint` sin hallazgos, `npm run test` con **172 pruebas en verde**
y `npm run build` correcto.

## Estado real del backend (APIS_BACKEND.md)

Verificado contra el servidor en ejecución con `npm run verificar:backend`:

| Endpoint | Estado |
|---|---|
| `GET /` | **Implementado** — `{ status: "ok" }` |
| `POST /login` | **Implementado** — `{ correo, password }` → `{ access_token, token_type }` |
| `GET /me` | **Implementado** — requiere `Authorization: Bearer`; devuelve `nombres` y `apellidos` por separado |
| `POST /logout` | **Implementado** — simbólico: el JWT no se revoca en el servidor |
| Todo el negocio (`/colegios`, `/alumnos`, `/evaluacion-diagnostica`…) | 404 — las tablas existen, ningún endpoint las expone |

### Cómo está configurado el frontend

La **autenticación va contra la API real** y el **negocio sigue en el mock**. Lo controlan dos
variables de `.env`:

```
VITE_USE_MOCK=true    # alumnos, evaluaciones y consolidados salen del mock
VITE_AUTH_REAL=true   # la sesión, el token y el perfil salen del backend
```

Cuando el backend publique el negocio, basta `VITE_USE_MOCK=false` y `VITE_AUTH_REAL` sobra.

### Conexión: proxy de desarrollo

`VITE_API_BASE_URL=/api` y el proxy de `vite.config.js` reenvía a `VITE_API_PROXY_TARGET`.
El navegador habla siempre con su propio origen, así que **no hay petición de origen cruzado**.

El backend ya tiene CORS configurado (`CORS_ORIGINS`, con `localhost:5173` y `127.0.0.1:5173`),
pero el proxy se mantiene como opción por defecto por dos razones: funciona igual se entre por
`localhost` o por `127.0.0.1` —que para el navegador son orígenes distintos— y es el mismo modelo
del despliegue de §11, donde la API vive bajo el mismo dominio con el prefijo `/api`. Para llamar
al backend directamente basta cambiar `VITE_API_BASE_URL` a la URL absoluta; está documentado en
`.env.example`.

### Sesión y token

El JWT dura **8 horas**, así que una sesión caduca con el docente dentro. `src/auth/jwt.js` lee
`exp` del token: al recargar no se restaura un token vencido y no se lanza una petición condenada
al 401. Es para la interfaz, no para la seguridad — el payload va en base64 y quien decide es el
backend en cada petición.

`id_docente` llega en `null` para las cuentas no docentes (`Jefa_Profesores`, `Directivos`). Todas
las consultas que dependen de él están condicionadas, y el script de verificación comprueba ambos
casos.

### Errores de FastAPI

`detail` llega de dos formas y `mensajeDeError()` (`src/api/client.js`) las distingue: **array** de
errores de validación en los `422`, **string** en los `401` y demás `HTTPException`. Sin eso, un
`422` habría roto React con *"Objects are not valid as a React child"*.

## Qué se puede mostrar hoy

```bash
npm install
npm run dev          # http://localhost:5173
```

Con `VITE_USE_MOCK=true` (el valor por defecto de `.env.example`) la aplicación funciona
**sin backend levantado**.

### 1. Inicio de sesión por tipo de cuenta (P1 · RF-001)

Los tres roles del catálogo `rol` entran con contraseña `sicedu123`, y cada uno aterriza
donde le corresponde:

| Correo | Rol | Aterriza en |
|---|---|---|
| `rcardenas@sicedu.test` | Profesor (1) | `/inicio` — panel del docente, ya construido |
| `jefatura@sicedu.test` | Jefa_Profesores (2) | `/dashboard` |
| `direccion@sicedu.test` | Directivos (3) | `/panel-ejecutivo` |

Esas son las cuentas del mock (`VITE_AUTH_REAL=false`). Con la autenticación real se entra con
los usuarios sembrados en el backend (`profesor.prueba@sicedu.test`, `jefa.prueba@sicedu.test` y
`directivo.prueba@sicedu.test`). En desarrollo, la pantalla de login lista las
cuentas del modo activo con un botón "Usar"; en producción ese bloque no existe.

Lo que ya cumple el login: validación con zod, error único *"Correo o contraseña incorrectos"*
ante un 401 (nunca dice cuál de los dos campos falló), token en memoria con respaldo en
`sessionStorage` y nunca en `localStorage` (RNF-003), y mención a la Ley N.° 29733.

### 2. Guardas de rol (RNF-004)

Las 16 rutas de §5 existen con su guarda definitiva. Un rol que escribe a mano una URL ajena
termina en `/403`, no solo deja de ver el enlace en el menú. Hay un test que recorre las
16 rutas con los tres roles (48 combinaciones).

### 3. Panel del docente (P3 · `/inicio`)

Saludo con periodo vigente, los cuatro indicadores, el aviso de corte diagnóstico abierto
(RN-010), la tarjeta "Mis asignaciones" —dos colegios con sus seis grados, con avance semanal y
acceso directo a la grilla ya filtrada— y los tres accesos rápidos.

### 4. Captura semanal (P4 y P5 · `/reporte-semanal`)

Dos pestañas sobre la misma grilla de alumnos: **Reporte semanal** (asistencia, libros LSB con
título/aciertos/total en campos separados, sala de lectura, total calculado y observación de 500
caracteres) y **Rúbrica** (Fluidez y Comprensión, con las opciones traídas del catálogo según el
programa del alumno y el descriptor del ciclo en un tooltip).

Incluye lo que exige RNF-006: autoguardado por fila a los 800 ms, navegación con Enter entre
celdas, "marcar toda la asistencia" y "copiar la semana anterior".

### 5. Cola de envíos offline (RNF-001)

`src/lib/colaOffline.js` guarda cada fila pendiente en IndexedDB con su `idempotency_key`
(`alumno-semana`), reintenta hasta tres veces con esperas de 1 s, 4 s y 9 s, y no duplica: dos
ediciones de la misma fila reemplazan el pendiente en lugar de encolar otro, y un reintento que
llega después de que el servidor ya aceptó se resuelve como el mismo registro. El `SyncBadge` de
la barra superior muestra el estado y abre el panel con "Reintentar ahora".

### 6. Registro de vuelo (P6, P7, P8 · `/registro-vuelo`)

Histórico con una fila por alumno y los cuatro cortes del año en columnas, más *Últimos 3*,
tendencia, sugerencia del sistema y estado. El lápiz abre el panel de edición y el reloj, el modal
de trazabilidad: sugerencia del sistema frente a decisión del docente, la justificación de cada
uno y la línea de tiempo de los tres hitos.

El formulario de alta (`/registro-vuelo/nuevo`) es el `Stepper` de tres pasos con el panel de
resultados a la derecha, que recalcula en el cliente al cambiar cualquier insumo (RNF-005).

**`src/domain/nivelFinal.js` es la única fuente del cálculo** (RN-009). Implementa la regla
provisional de §P7 y está marcado con `TODO RN-009: fórmula pendiente de validación con Patricia`.
Ningún componente replica esa lógica.

### 7. Estudiantes y nivel final (P9, P10, P11)

Listado con el interruptor *"Ver otros colegios (solo lectura)"* que activa RF-003, ficha del
estudiante con la evolución entre los cuatro cortes y la rúbrica del mes en `recharts`, y el
consolidado mensual con su panel de ajuste justificado.

### 8. Consolidación (P12 a P15 y consulta de colegios)

- **Dashboard** (`/dashboard`): una sola vista con pestañas por colegio, siete filtros que viajan
  en la URL, cuatro indicadores y seis gráficos, cada uno con su explicación y descarga PNG/CSV.
- **Colegios** (`/colegios`, `/colegios/:id`): podio y ranking, dispersión logro-cobertura, tabla
  comparativa y, en el detalle, evolución frente al promedio, ranking de aulas y grados.
- **Consolidados** (`/consolidados`): niveles por periodo y libros por mes, con nota de snapshot o
  cálculo en vivo y exportación a Excel y CSV.
- **Alertas** (`/alertas`): diferencias entre el reporte semanal y el consolidado mensual, con
  "Marcar como revisada".
- **Consulta de colegios** (`/consulta-colegios`): el profesor ve cualquier colegio en solo lectura
  (RF-003). Quedó pendiente de la Fase 5 y se cerró aquí.

### 9. Cierre (P16, P17, reportes y entregables)

- **Administración** (`/administracion`): docentes, asignaciones con alta y baja (solo en periodos
  programados, colegio completo: RN-003), periodos y catálogos en solo lectura (RF-025).
- **Panel ejecutivo** (`/panel-ejecutivo`) y **reportes** (`/reportes`) para Directivos, sin un solo
  formulario de captura.
- **Exportar ficha** (P11) a PDF por el diálogo de impresión.
- `STACK_FRONTEND.md`, `README.md`, `docs/trazabilidad-rf.md`, `Dockerfile`, `nginx.conf` y
  `.dockerignore`.

## Pendiente

- **Revisión visual en 360 px, 768 px y 1440 px.** El código respeta RNF-002 (tablas con su
  propio `overflow-x-auto`, filtros que colapsan en Drawer), pero nadie lo ha visto en pantalla
  todavía. Es el único punto de la §12 que queda sin verificar, y abarca todas las pantallas.
- **Construir y probar la imagen Docker.** El `Dockerfile` y la plantilla de Nginx están escritos,
  pero Docker Desktop no estaba encendido: la imagen nunca se construyó. Comprobar con
  `docker build -t fe-huascaran .` y `docker run -p 8080:80 -e API_UPSTREAM=http://host.docker.internal:8000 fe-huascaran`.
- **Endpoints de negocio del backend.** Todo el negocio sigue en el mock; ver
  `npm run verificar:backend`.
- **Tests de la cola offline.** Están cubiertos el cálculo de totales, los handlers del mock y
  las guardas; falta un test que simule el fallo de red y verifique los tres reintentos.

## Decisiones tomadas que conviene revisar

- **Endpoints propuestos por el frontend.** `GET /docentes/{id}/asignaciones` y
  `GET /docentes/{id}/resumen` no están en §3: los necesita el panel del docente y hay que
  contrastarlos con el equipo de backend.
- **Libros dentro de la fila.** El contrato declara `POST /reporte-semanal/{id}/libros` y
  `DELETE /reporte-semanal/libros/{id}`, pero la pantalla guarda la fila completa con sus libros
  dentro: es lo que permite reintentar un envío sin quedar a medio guardar. Las rutas siguen
  declaradas en `endpoints.js` por si el backend exige lo contrario.
- **"Ajustes por revisar"** (indicador de P3) se cuenta como las evaluaciones del periodo vigente
  cuya sugerencia el docente aún no confirma. El documento nombra el indicador pero no lo define.

## Decisiones de la Fase 4 y 5 que conviene revisar

- **Rúbrica semanal del mes en barras agrupadas, no apiladas.** El prompt pide apiladas para ese
  gráfico de P11. Se usaron agrupadas a propósito: los niveles de rúbrica son una escala ordinal,
  no cantidades, y apilar "Fluidez: Proceso" sobre "Comprensión: Logrado" da una altura total sin
  significado que además sugiere una suma de ambas dimensiones, justo lo que RN-008 prohíbe.
  Queda anotado en el propio componente.
- **Sugerencia y tendencia se calculan en el cliente.** El backend devuelve los datos crudos y la
  interfaz aplica `domain/nivelFinal.js` y la comparación por `orden`. Es lo que permite cumplir
  RNF-005 sin ida y vuelta al servidor, pero implica que el backend debe aplicar exactamente la
  misma regla al guardar. Hay que acordarlo con el equipo de backend.
- **Idempotencia de la evaluación por `alumno-periodo`.** El histórico y el formulario de alta
  reenvían la misma clave; el servidor debe tratar dos envíos iguales como un solo registro.
- **`recharts` se carga de forma diferida.** Son 384 kB que solo descargan las pantallas con
  gráficos: con la disponibilidad de conexión del 70 % de RN-017, no tenía sentido que el docente
  que solo captura el reporte semanal los pagara.

## Calidad del código

- **`npm run lint` no revisaba los componentes.** ESLint 8 solo lee `.js` salvo que se le indiquen
  otras extensiones, así que el script revisaba 58 archivos y dejaba fuera los 98 `.jsx`. Ahora es
  `eslint . --ext .js,.jsx,.mjs` y revisa todo el proyecto, sin hallazgos. Los reportes anteriores de
  "lint limpio" solo valían para los `.js`.
- **Ningún componente pasa de 200 líneas** (§8). Se dividieron los ocho que lo superaban: el
  formulario de evaluación en sus tres pasos, las columnas de las tablas en módulos propios, las
  tablas de la ficha, la paginación de `DataTable` y el catálogo `/_ui`.

## Decisiones de las Fases 6 y 7 que conviene revisar

- **La paleta de niveles no es accesible para daltónicos.** Los tokens `lvl` que §4.1 impone no pasan
  la validación de color: Inicio y Proceso tienen ΔE 3.2 en deuteranopía (el mínimo es 8) y 13.3 con
  visión normal (el mínimo es 15), y van contiguos en cada barra apilada. Como son obligatorios no se
  cambiaron: se añadió codificación secundaria (porcentaje escrito en cada segmento, separación de
  2 px, leyenda, tooltip y CSV). Conviene revisarlo con quien define la identidad visual.
- **"Baja" en la dona de variación.** P12 nombra cuatro categorías (se mantiene, sube 1, 2, 3 o más).
  Se añadió *Baja*: hay estudiantes que bajan y sin esa categoría la dona escondería datos.
- **Un endpoint para todo el dashboard** (`/dashboard/resumen`, propuesta). RF-006 pide siete bloques
  con los mismos filtros; con la conexión de RN-017, una petición es mejor que siete.
- **Excel en formato XML 2003.** Sin librerías nuevas no hay `.xlsx`; Excel abre el `.xls` con un
  aviso de formato que basta aceptar.
- **Umbrales provisionales:** colegio "con datos al día" al 85 % de registro en la última semana
  cerrada; alerta de inconsistencia cuando el total semanal difiere del consolidado.
- **Asignaciones solo en periodos programados.** Es la lectura de RN-003 ("la rotación ocurre solo al
  cierre de un periodo"). No se impide que dos docentes compartan colegio: no está definido.

## Lo que sigue sin definir (§13, no inventar)

- La fórmula del nivel final / delta (RN-009). Implementada la regla provisional en
  `src/domain/nivelFinal.js`, marcada con `TODO` y pendiente de cerrar con el cliente.
- Los cortes de la brecha de RN-013 (1 y 3 niveles) que reparten Proceso / Logrado / Destacado
  son provisionales, igual que la tabla `nivel_esperado_por_grado`.
- El nivel esperado por grado y los descriptores oficiales de la rúbrica: los valores del mock
  son provisionales y están marcados con `TODO` en `src/api/mock/db.js`.
- Si el nivel general necesita un equivalente a "Pre Inicio".
- Recuperación de contraseña: el backend todavía no expone el endpoint.

## Nota sobre el repositorio

El repositorio es `mision-huascaran/FE-HUASCARAN` y ya tiene las cuatro ramas del curso. Se trabaja
en `development` (rama por defecto) y todo sube por Pull Request: `development → qa → uat → main`.
Pendiente: proteger `main` en GitHub y confirmar con el equipo el nombre del repositorio (el curso
pide el prefijo `FRT-`).
