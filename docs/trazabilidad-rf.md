# Trazabilidad de requerimientos — Frontend SICEDU

Qué pantalla cubre cada requerimiento. Es la base para documentar las capturas: cada archivo de
página declara en su primera línea los RF/RN/RNF que cubre (`// Cubre: …`), y esta tabla se armó
a partir de esos comentarios.

Para capturar cualquier pantalla basta `npm run dev` con `VITE_USE_MOCK=true`: funciona sin backend
y los datos de prueba son fijos, así que las capturas salen iguales en cada recarga.

## Requerimientos funcionales

| Req. | Qué exige | Dónde se ve |
|---|---|---|
| RF-001 | Inicio de sesión | `/login` |
| RF-002 | Alcance por docente y asignaciones | `/inicio` (Mis asignaciones), `/estudiantes`, `/administracion` → Asignaciones |
| RF-003 | Consulta de otros colegios en solo lectura | `/consulta-colegios`; `/estudiantes` → interruptor *Ver otros colegios* |
| RF-004 | Datos del estudiante | `/inicio`, `/estudiantes`, `/estudiantes/:id` |
| RF-005 | Indicadores consolidados | `/dashboard`, `/panel-ejecutivo` |
| RF-006 | Dashboard en una sola vista con pestañas, filtros e indicadores | `/dashboard`; `/consolidados` |
| RF-007 | Comparación entre colegios | `/dashboard`, `/colegios`, `/colegios/:id` |
| RF-008 | Ranking de aulas *(nice to have)* | `/colegios/:id` → Ranking de aulas |
| RF-009 | Ranking de colegios *(nice to have)* | `/colegios`, `/panel-ejecutivo`, `/reportes` |
| RF-010 | Consolidados por estudiante, grado y colegio | `/consolidados`, `/dashboard`, `/panel-ejecutivo`, `/reportes` |
| RF-011 | Evolución entre evaluaciones diagnósticas | `/registro-vuelo`, `/estudiantes/:id` → gráfico de evolución |
| RF-012 | Reporte semanal | `/reporte-semanal` |
| RF-013 | Observación semanal (500 caracteres) | `/reporte-semanal` |
| RF-014 | Alertas de inconsistencia *(nice to have)* | `/alertas` |
| RF-015 | LSB con título y puntaje; LSL solo cantidad | `/reporte-semanal` → panel de libros |
| RF-016 | Total de libros calculado por el sistema | `/reporte-semanal`, `/estudiantes/:id`, `/consolidados` → Libros |
| RF-017 | Rúbrica semanal con dos dimensiones | `/reporte-semanal?vista=rubrica` |
| RF-018 | Nivel final mensual derivado de las rúbricas | `/nivel-final` |
| RF-019 | Cálculo del nivel sugerido | `/registro-vuelo/nuevo` → panel de resultados; `src/domain/nivelFinal.js` |
| RF-020 | Registro manual de datos de Raz-Kids | `/registro-vuelo`, `/registro-vuelo/nuevo` |
| RF-021 | Nivel Raz-Kids y nivel del docente como campos distintos | `/registro-vuelo`, `/registro-vuelo/nuevo`, `/estudiantes/:id` |
| RF-022 | Resultados calculados de la evaluación | `/registro-vuelo/nuevo` |
| RF-023 | Justificación obligatoria al cambiar la sugerencia | `/registro-vuelo` → Editar; `/nivel-final` → Ajustar |
| RF-024 | Trazabilidad de la decisión | `/registro-vuelo` → icono de reloj (modal de trazabilidad) |
| RF-025 | La rúbrica no se edita desde el sistema | `/administracion` → Catálogos (solo lectura); sin catálogos en `/reporte-semanal` |

## Requerimientos no funcionales

| Req. | Qué exige | Dónde se ve |
|---|---|---|
| RNF-001 | Guardado con 70 % de conexión, 3 reintentos, sin duplicar | `/reporte-semanal` (estado por fila) y `SyncBadge` de la barra superior |
| RNF-002 | De 360 px a 1920 px sin scroll horizontal | Todas las pantallas |
| RNF-003 | Cifrado y Ley N.° 29733 | `/login` (pie), `src/api/client.js`, `nginx.conf` |
| RNF-004 | Bloqueo del 100 % de accesos cruzados | `/403`; prueba `src/auth/__tests__/guardas.test.jsx` (16 rutas × 3 roles) |
| RNF-005 | Nivel final en menos de 3 s | `/registro-vuelo/nuevo`, `/registro-vuelo` → Editar |
| RNF-006 | Registro semanal en la mitad del tiempo | `/reporte-semanal` (grilla, autoguardado, acciones masivas) |

## Pantallas y roles

| Pantalla | Ruta | Profesor | Jefa | Directivos |
|---|---|:-:|:-:|:-:|
| P1 · Login | `/login` | ✓ | ✓ | ✓ |
| P3 · Inicio del docente | `/inicio` | ✓ | | |
| P4/P5 · Reporte semanal y rúbrica | `/reporte-semanal` | ✓ | | |
| P6 · Registro de vuelo | `/registro-vuelo` | ✓ | ✓ | |
| P7 · Nueva evaluación | `/registro-vuelo/nuevo` | ✓ | | |
| P8 · Trazabilidad | modal en `/registro-vuelo` | ✓ | ✓ | |
| P9 · Nivel final mensual | `/nivel-final` | ✓ | ✓ | |
| P10 · Estudiantes | `/estudiantes` | ✓ | ✓ | ✓ |
| P11 · Ficha del estudiante | `/estudiantes/:id` | ✓ | ✓ | ✓ |
| Consulta de colegios | `/consulta-colegios` | ✓ | | |
| P12 · Dashboard | `/dashboard` | | ✓ | |
| P13 · Colegios y ranking | `/colegios`, `/colegios/:id` | | ✓ | ✓ |
| P14 · Consolidados | `/consolidados` | | ✓ | |
| P15 · Alertas | `/alertas` | | ✓ | |
| P16 · Administración | `/administracion` | | ✓ | |
| P17 · Panel ejecutivo | `/panel-ejecutivo` | | | ✓ |
| Reportes | `/reportes` | | | ✓ |
| P18 · Sin permisos | `/403` | ✓ | ✓ | ✓ |

Cualquier combinación sin ✓ termina en `/403` al entrar por URL, no solo oculta el enlace.

## Propuestas pendientes de validar

Estas piezas no estaban definidas en el documento y se construyeron como propuesta (§13):

- **Funcionalidades del rol Directivos.** El diseño las deja "a definir". `/panel-ejecutivo` y
  `/reportes` son una propuesta: solo lectura, indicadores de alto nivel y descargas.
- **Fórmula del nivel final (RN-009).** `src/domain/nivelFinal.js` aplica la regla provisional de
  §P7 y está marcado con `TODO RN-009`.
- **Regla de inconsistencia (RF-014).** Se toma la más literal: el total semanal del mes difiere del
  consolidado mensual.
- **Colegio "con datos al día" (P17).** Se toma un 85 % de registro en la última semana cerrada.
- **Endpoints que §3 no define** y que el frontend propone: ver `src/api/endpoints.js` (marcados
  como `PROPUESTA DEL FRONTEND`).
