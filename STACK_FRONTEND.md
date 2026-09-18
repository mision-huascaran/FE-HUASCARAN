# Stack tecnológico — Frontend SICEDU

Proyecto SICEDU (Sistema de Centralización de Datos Educativos) · Misión Huascarán ·
CS3081 Ingeniería de Software.

Este documento registra el stack del frontend tal como quedó implementado, la justificación de
cada elección, cómo se consume la API de FastAPI y cómo se cumple cada requerimiento no
funcional. Complementa el documento de stack del backend (Python, FastAPI, PostgreSQL, SQLModel,
JWT y Docker) y asume sus decisiones como dadas.

---

## 1. Resumen y versiones instaladas

| Componente | Tecnología | Versión instalada |
|---|---|---|
| Librería de interfaz | React | 18.3.1 |
| Lenguaje | JavaScript (ES2022) con JSX | — |
| Construcción | Vite | 5.4.21 |
| Estilos | Tailwind CSS | 3.4.19 |
| Enrutamiento | React Router | 6.30.6 |
| Datos del servidor | TanStack Query | 5.103.1 |
| Cliente HTTP | Axios | 1.20.0 |
| Formularios | React Hook Form + Zod + @hookform/resolvers | 7.88.0 · 3.25.76 · 3.10.0 |
| Gráficos | Recharts | 2.15.4 |
| Iconos | lucide-react | 0.454.0 |
| Estado de interfaz | Zustand | 4.5.7 |
| Persistencia local | idb-keyval (IndexedDB) | 6.3.0 |
| Fechas | Day.js (locale `es`) | 1.11.23 |
| Pruebas | Vitest + React Testing Library + jsdom | 2.1.9 · 16.3.3 · 25.0.1 |
| Calidad | ESLint (+ react, react-hooks) | 8.57.1 |
| Despliegue | Docker de dos etapas: Node 20 + Nginx 1.27 | — |

Entorno de desarrollo verificado: Node 20.20.0 y npm 10.8.2.

**Dependencias fuera de la lista del prompt:** ninguna en tiempo de ejecución. Se añadió
`@testing-library/user-event` (solo pruebas) para simular la interacción del usuario, y los
complementos de ESLint para `npm run lint`. Las exportaciones a CSV, Excel, PNG y PDF se
resolvieron **sin librerías** (ver §6).

---

## 2. Justificación de cada elección

**React 18 con JavaScript.** El único desarrollador frontend del equipo ya conoce React, y en un
cronograma de 16 semanas la curva de aprendizaje decide la viabilidad. La interfaz repite muchos
elementos con variantes controladas (tarjetas de indicador, distintivos de nivel, tablas de
captura, paneles laterales): el modelo de componentes permite escribir cada uno una sola vez.
TypeScript se descartó deliberadamente y queda como deuda técnica consciente; la forma de los
datos se contrasta contra el Swagger que FastAPI genera solo.

**Vite 5.** Recarga casi instantánea en desarrollo sin importar el tamaño del proyecto, y un
`npm run build` que produce archivos estáticos, justo el modelo de despliegue de §7. Create React
App está sin mantenimiento; Next.js se descartó porque su valor (renderizado en servidor, rutas de
API) no aplica: el backend ya existe en FastAPI y el sistema es de acceso autenticado.

**Tailwind CSS 3.** Satisface RNF-002 con prefijos de punto de quiebre escritos junto al estilo.
Los colores, la tipografía y la escala se declaran una vez como tokens en `tailwind.config.js`
(`navy`, `brand`, `ink`, `surface`, `line`, `lvl`…): un color fuera de esos tokens es un error de
implementación. Se descartaron Material UI y Ant Design por su lenguaje visual propio y su peso,
relevante con la conexión del 70 % de RN-017.

**TanStack Query + Axios.** Casi todo lo que muestra SICEDU es del servidor; TanStack Query lo trata
como caché de un origen remoto con estados de carga, error y revalidación declarativos, y aporta la
política de reintentos de RNF-001 (1 s, 4 s, 9 s). Axios concentra en una sola instancia el token
Bearer, el cierre de sesión ante un `401` y la normalización de errores.

**Recharts.** Está hecho con componentes de React, así que los gráficos del dashboard reaccionan a
los mismos filtros que el resto de la interfaz. Su contenedor responsive cumple RNF-002. D3 se
descartó por su manipulación imperativa del DOM. Recharts es la dependencia más pesada y **se carga
de forma diferida**: el docente que solo captura el reporte semanal no la descarga.

**Zustand.** El estado que no viene del servidor es poco pero transversal: sesión y rol, periodo
vigente, filtros del dashboard y estado de la cola offline. Zustand lo resuelve sin la
infraestructura de Redux. Se descartó React Context para los filtros porque cada cambio
re-renderizaría todo el subárbol suscrito, y en el dashboard hay siete bloques leyéndolos.

**idb-keyval.** La cola de envíos pendientes debe sobrevivir a un cierre del navegador en pleno
corte de conexión; IndexedDB lo permite y `localStorage` no es adecuado (síncrono y, por RNF-003,
vetado para el token).

---

## 3. Cómo se consume la API de FastAPI

```
src/api/
├─ client.js        instancia de axios, interceptores y el conmutador mock / API real
├─ endpoints.js     TODAS las rutas del backend en un solo lugar, con su estado
├─ mock/            datos ficticios con la misma forma que la API
│  ├─ db.js           generador determinista (semilla fija)
│  ├─ consolidados.js agregados de dashboard, rankings y consolidados
│  └─ handlers.js     resuelve cada endpoint con un retardo de 300 ms
└─ resources/       un archivo por dominio; la interfaz solo habla con estos
```

Cada función de `resources/` pasa por `resolver({ mock, real })`, que decide el origen según las
variables de entorno. **Ninguna pantalla sabe de dónde vienen los datos**: cuando el backend
publique un endpoint, se cambia la variable y no se toca la interfaz.

### Estado del backend (verificado)

`npm run verificar:backend` consulta la API real y reporta qué existe:

| Endpoint | Estado |
|---|---|
| `GET /`, `POST /login`, `GET /me`, `POST /logout` | Implementados. JWT Bearer de 8 horas. |
| Endpoints de negocio | No existen todavía; las tablas sí, pero nada las expone. |

Por eso hoy la **autenticación va contra la API real y el negocio contra el mock**:

| Variable | Valor hoy | Efecto |
|---|---|---|
| `VITE_USE_MOCK` | `true` | Alumnos, evaluaciones y consolidados salen del mock |
| `VITE_AUTH_REAL` | `true` | Login, perfil y cierre de sesión salen del backend |
| `VITE_API_BASE_URL` | `/api` | La API se alcanza por el mismo origen |

Cuando el backend publique el negocio basta `VITE_USE_MOCK=false`.

### Detalles del contrato que la interfaz ya contempla

- `GET /me` devuelve `nombres` y `apellidos` por separado: se unen una sola vez en
  `normalizarPerfil()`.
- `id_docente` es `null` en las cuentas no docentes: toda consulta que depende de él está
  condicionada.
- `detail` es un **string** en los `401` y un **array** en los `422`: `mensajeDeError()` distingue
  ambos casos en un único punto. Pintar el array directamente rompería React.
- El JWT dura 8 horas: `src/auth/jwt.js` lee `exp` para no restaurar un token vencido. Es para la
  interfaz, no para la seguridad; quien decide es el backend.
- Endpoints que §3 no define y el frontend propone (detalle de colegio, resumen del dashboard,
  administración, alertas revisadas): marcados como `PROPUESTA DEL FRONTEND` en `endpoints.js`.

### El proxy de desarrollo

En desarrollo, `vite.config.js` reenvía `/api/*` al backend (`VITE_API_PROXY_TARGET`, por defecto
`http://127.0.0.1:8000`). El navegador nunca hace una petición de origen cruzado, así que funciona
igual se entre por `localhost:5173` o por `127.0.0.1:5173`, que para el navegador son orígenes
distintos. Es el mismo modelo de producción. El backend tiene además CORS configurado por
`CORS_ORIGINS`, por si se quiere llamar directamente (`.env.example` explica cómo).

---

## 4. Modo mock

Con `VITE_USE_MOCK=true` y `VITE_AUTH_REAL=false` la aplicación entera funciona **sin backend**,
incluido el inicio de sesión. El mock:

- genera 9 colegios, 413 alumnos, 3 docentes, 4 evaluaciones diagnósticas por alumno, las semanas
  lectivas del año, rúbricas semanales y niveles finales mensuales;
- usa una **semilla fija**: tablas y gráficos son idénticos en cada recarga, para que las capturas
  del equipo coincidan;
- tiene **solo datos ficticios** (RN-019, Ley N.° 29733);
- replica las reglas del servidor que la interfaz debe respetar (una rúbrica con una sola
  dimensión devuelve `422`, un ajuste sin justificación también), para que los errores se prueben
  antes de tener backend.

Usuarios del mock (contraseña `sicedu123`): `rcardenas@sicedu.test` (Profesor),
`jefatura@sicedu.test` (Jefa) y `direccion@sicedu.test` (Directivos). Con `VITE_AUTH_REAL=true`,
en cambio, se entra con los usuarios sembrados en el backend. En desarrollo la pantalla de login
lista las cuentas que corresponden a cada modo.

---

## 5. Cumplimiento de los requerimientos no funcionales

| ID | Requisito | Implementación |
|---|---|---|
| **RNF-001** | Guardado con 70 % de disponibilidad, hasta 3 reintentos sin duplicar | Cola en IndexedDB (`src/lib/colaOffline.js`) para la captura semanal, con `idempotency_key` `alumno-semana`; esperas de 1, 4 y 9 s; `SyncBadge` permanente con reintento manual; la interfaz nunca se bloquea esperando la red. Las evaluaciones diagnósticas envían la cabecera `Idempotency-Key` `alumno-periodo` y se reintentan con la misma política de TanStack Query, pero **no** pasan por la cola offline. |
| **RNF-002** | 360 px a 1920 px sin scroll horizontal | Tailwind con enfoque móvil primero; las tablas se desplazan dentro de su tarjeta; los filtros colapsan en un panel lateral bajo `lg`; la barra lateral pasa a ser un menú desplegable. |
| **RNF-003** | Cifrado en tránsito y en reposo, Ley N.° 29733 | Token en memoria y `sessionStorage`, nunca en `localStorage`; ningún dato de alumno en la URL ni en la consola (`no-console` en ESLint); `Cache-Control: no-store` en la API; cabeceras de seguridad en Nginx; aviso si en producción la API no es `https`. |
| **RNF-004** | Bloqueo del 100 % de los accesos cruzados | `ProtectedRoute` + `RoleRoute` en cada ruta, redirección a `/403`; el menú sale de una sola constante (`NAV_BY_ROLE`); una prueba recorre las 16 rutas con los 3 roles. |
| **RNF-005** | Nivel final en menos de 3 s | El cálculo vive solo en `src/domain/nivelFinal.js`, corre en el cliente, es síncrono y se memoriza con `useMemo`: la sugerencia se pinta sin esperar al servidor. |
| **RNF-006** | Registro semanal de 2 h a 1 h | Grilla con todos los alumnos precargados, autoguardado por fila a los 800 ms, navegación con Enter, "marcar toda la asistencia" y "copiar la semana anterior". |

### Accesibilidad de los gráficos

Las combinaciones de colores de las series se validaron para daltonismo (ΔE en OKLab) y los
resultados están documentados en `src/components/charts/tema.js`. **Observación abierta:** la
paleta de niveles `lvl` que fija el prompt no pasa esa validación (Inicio y Proceso: ΔE 3.2 en
deuteranopía). Como es obligatoria, todo gráfico que la usa lleva codificación secundaria:
porcentaje escrito en el segmento, separación de 2 px, leyenda, tooltip y descarga CSV como vista de
tabla. Conviene revisarla con quien define la identidad visual.

---

## 6. Exportaciones sin dependencias

| Formato | Cómo |
|---|---|
| CSV | UTF-8 con BOM, para que Excel en español respete las tildes. |
| Excel | *Hoja de cálculo XML 2003* (SpreadsheetML): texto plano que Excel abre con columnas numéricas reales. Al abrir el `.xls` Excel avisa que el formato no coincide con la extensión; basta aceptar. Un `.xlsx` real exigiría una librería de compresión. |
| PNG | Se rasteriza el SVG que dibuja Recharts al doble de resolución. |
| PDF | Diálogo de impresión del navegador ("Guardar como PDF") con una hoja de estilos que oculta la navegación. |

---

## 7. Despliegue

El servidor y el dominio **los provee el curso**. El frontend se construye con `npm run build` y se
publica el contenido de `dist/` como sitio estático, detrás del mismo dominio que el backend, con la
API bajo `/api`.

El `Dockerfile` de la raíz es de dos etapas:

1. **build** — `node:20-alpine` instala dependencias con `npm ci` y ejecuta `npm run build`. Las
   variables `VITE_*` entran como `ARG` porque Vite las incrusta en el JavaScript: cambiarlas exige
   reconstruir.
2. **runtime** — `nginx:1.27-alpine` sirve `dist/`. La imagen final no lleva Node ni
   `node_modules`.

`nginx.conf` es una plantilla: al arrancar el contenedor, `${API_UPSTREAM}` se sustituye por el
destino del backend (por defecto `http://backend:8000`, el servicio de la red de Docker). Redirige
cualquier ruta desconocida a `index.html` (necesario para React Router), comprime con gzip, guarda
un año los archivos con huella de contenido, nunca guarda `index.html`, añade cabeceras de
seguridad y expone `/salud` para la comprobación de vida.

```bash
docker build -t fe-huascaran .
docker run -d -p 80:80 -e API_UPSTREAM=http://backend:8000 fe-huascaran
```

El `.env` local no entra en la imagen (`.dockerignore`).

### Repositorio y ramas

La convención de nombres del curso es `FRT-{NOMBRE-PROYECTO}`. El repositorio vive hoy en
`mision-huascaran/FE-HUASCARAN` (prefijo `FE-`): **pendiente de confirmar con el equipo** si se
renombra. El flujo de ramas `development → qa → uat → main` ya está creado:

| Rama | Uso |
|---|---|
| `development` | Desarrollo diario (rama por defecto) |
| `qa` | Validación técnica con los testers |
| `uat` | Presentaciones semanales, con autorización del Project Manager |
| `main` | Protegida, sin escritura directa: solo recibe Pull Requests |

El pipeline de Jenkins del curso presupone el `Dockerfile` en la raíz del repositorio.

---

## 8. Instalación

```bash
npm install
cp .env.example .env
npm run dev              # http://localhost:5173
```

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con el proxy a la API |
| `npm run build` | Construcción de producción en `dist/` |
| `npm run preview` | Sirve `dist/` para revisarlo |
| `npm run test` | Pruebas con Vitest |
| `npm run lint` | ESLint |
| `npm run verificar:backend` | Compara el contrato con la API en ejecución |

Variables de entorno (`.env.example` las explica una por una):

| Variable | Por defecto | Para qué |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | Dirección de la API. En producción debe ser `https` o relativa. |
| `VITE_API_PROXY_TARGET` | `http://127.0.0.1:8000` | Destino del proxy de desarrollo |
| `VITE_USE_MOCK` | `true` | Negocio desde el mock |
| `VITE_AUTH_REAL` | `true` | Sesión contra la API real con el negocio en mock |
