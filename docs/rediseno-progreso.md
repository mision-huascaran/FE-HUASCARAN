# Rediseño visual SICEDU — progreso

Trabajo nocturno autónomo. Si la sesión se corta, retomar desde **Próximo paso**.
Documentos: `prompt_disenio.md`, `indicaciones_definitivas.md`, `anexo_rediseno_nocturno_v2.md`.

## Estado

- Rama `development`, partiendo de `a055531` (fast-forward desde `4b59dca`, árbol limpio). Commits locales, sin push.
- **Próximo paso:** fase 6, bugs FE-01, FE-03, FE-06, FE-11 y FE-14.

## Línea base antes de tocar nada

- `npm test`: 127 archivos, 1115 pasan, 1 todo.
- `npm run lint`: **1 error previo**, `src/features/dashboard/__tests__/dashboard.test.jsx:42` (`no-control-regex`), y 312 avisos. Es de un test ajeno al rediseño: no se toca. Criterio aplicado: ningún error nuevo.

## Decisiones

| # | Decisión | Motivo |
|---|---|---|
| D1 | El paisaje va detrás del contenido de **toda** la página de Inicio, con el libro flotante a la derecha del encabezado. No hay banner. | Instrucción directa del encargo nocturno; prevalece sobre "solo en el banner" de las indicaciones y del anexo §B. Los demás módulos llevan fondo azul grisáceo liso. |
| D2 | Alfa del libro verificado en Python **sin Pillow** (decodificador PNG con biblioteca estándar). | Pillow no está en ningún intérprete de la máquina y el anexo pide herramientas ya presentes. No se instaló nada. |
| D3 | Imágenes optimizadas con el `canvas` del Chromium que ya instaló Playwright. | Ni Pillow, ni ffmpeg en PATH, ni ImageMagick. Sin dependencias nuevas. |
| D4 | Recursos con nombre real: `_recursos/huascaran.jpeg` (el original es `.jpeg`). | Conservar la extensión real. |
| D5 | Temas por variables CSS detrás de los mismos nombres de Tailwind (`ink-*`, `surface-*`…), más `darkMode: 'class'`. | Las pantallas heredan los dos temas sin clases `dark:` por todo el código. |
| D6 | Tokens `*-solid` para fondos con texto blanco; `*-600`/`*-700` quedan para texto y bordes. | En oscuro un mismo color no puede servir para ambos y cumplir AA. |
| D7 | Inter como única familia; se dejan de importar los CSS de Poppins. La dependencia sigue en `package.json`. | Anexo A.1 y "no cambiar dependencias sin necesidad". |
| D8 | En el teléfono el botón de tema va en "Más"; solo si el rol no tiene "Más" aparece en la cabecera. | No quitarle sitio a las migas y que ningún rol se quede sin el botón. |

## Recursos

| Original | Resultado | Peso |
|---|---|---|
| `huascaran.jpeg` (1600×600, generada con IA) | `public/images/backgrounds/huascaran-alpine.webp` | 81 KB |
| ídem, 900 px | `public/images/backgrounds/huascaran-alpine-movil.webp` | 27 KB |
| `libro.png` (1536×1024, RGBA; 61,2 % de píxeles con alfa 0, esquinas en 0, cuerpo en 252–253, generado con IA) | `public/images/illustrations/open-book.webp` (recortado a su contorno, 520×206, con transparencia) | 22 KB |

## Auditoría (fase 1)

- **Stack:** React 18 + Vite 5 + Tailwind 3, Lucide, Recharts, PWA (`vite-plugin-pwa`). CSP `script-src 'self'; style-src 'self'; img-src 'self' data:` en `deploy/cabeceras-seguridad.conf`.
- **Layout único:** `components/layout/AppShell.jsx` con `Sidebar` (fija desde `lg`, cajón bajo `lg`), `Topbar` y `BarraInferior` (bajo `lg`). Móvil y escritorio son el mismo árbol; no hay rutas móviles aparte.
- **Roles:** Docente (1) y Supervisor (2) aterrizan en `/inicio`; Directivo (3) en `/dashboard`.
- **Componentes base:** `components/ui/*` (Button, Card, Badge, Input, Select, Field, Textarea, DataTable, Modal, Drawer, Toast, StatCard, Tabs, SyncBadge…) y `components/mantenimiento/*` para los CRUD.
- **Colores fijos fuera de los tokens:** `domain/niveles.js`, `features/dashboard/graficas/paleta.js`, `lib/descargarGrafica.js` (exportación a PNG), `lib/tablaAlumnos.js`, `BarraInferior`.
- **Tests sensibles a clases:** `ui.test.jsx`, `controlSegmentado.test.jsx`, `dashboardMovil.test.jsx`, `seguimiento.test.jsx`.

## Fases

### Fase 1 — Auditoría, tokens y tema (cerrada)

- Archivos: `tailwind.config.js`, `src/styles/tokens.css` (nuevo), `src/styles/index.css`, `public/tema-inicial.js` (nuevo), `index.html`, `src/hooks/useTema.js` (nuevo), `src/components/ui/BotonTema.jsx` (nuevo), `Topbar`, `Sidebar`, `BarraInferior`, `navegacion.js`, `vite.config.js` (`webp`, `png` al precache), `src/main.jsx`, `.gitignore`.
- Contraste de los tokens medido con script: sin fallos AA en claro ni oscuro.
- Tests: 1115 pasan. Lint: solo el error previo. Build correcto, 71 entradas en el precache.
- Capturas: `_capturas/fase1/` (Inicio y login, 390 y 1366, claro y oscuro). Sin desborde horizontal.
- `npm run dev` se levanta con `Ing Soft/.claude/launch.json` (fuera del repo), que exige la herramienta de vista previa.

### Fase 2 — Componentes compartidos (cerrada)

- Rediseñados: `AppShell` (panel y paisaje solo en `/inicio`), `Sidebar` flotante y cajón móvil, `Topbar` de cristal, `BarraInferior` (mismas ranuras y mismo "Más"), `Breadcrumbs`, `Button` (nueva variante `warning`), `Card` (icono opcional), `StatCard` (icono a la izquierda y `tono`), `IconoTinte` (nuevo), `Field`, `Input`, `Select`, `Textarea`, `FilterBar`, `Paginacion`, `Modal`, `Drawer`, `Toast` (ya no tapa la barra inferior), `Tooltip`, `SyncBadge`, `Skeleton`, `EmptyState`, `DataTable`.
- `DataTable` en móvil: cada fila es una tarjeta por CSS (`data-etiqueta`), con los mismos datos, acciones y orden. Las tablas con `stickyFirstColumn` siguen con desplazamiento interno.
- `StatCard` conserva `rounded-xl shadow-card` y `> div > div > p + p`, de los que depende `e2e/support/tarjetas.js`.
- Decisión D9: controles de 44 px en teléfono y de 40 px desde `sm`; texto de 16 px en los campos móviles para evitar el zoom de iOS.
- Limitación conocida: `display:block` en la tabla móvil hace que los lectores de pantalla pierdan la semántica de tabla en esa vista. No se añadieron `role` explícitos porque el proyecto los viene retirando por Sonar.
- Tests: 1115 pasan. Lint: solo el error previo. Capturas en `_capturas/fase2/`.

### Fase 3 — Inicio del Supervisor y del Docente (cerrada)

- Archivos: `InicioSupervisor`, `InicioDocente`, `AccesosRapidos`, `ResumenesAccion`, `LibroInicio` (nuevo), `StatCard`, velos del paisaje en `tokens.css`.
- Iconos por categoría: Colegios azul, Docentes violeta, Actividad verde, Vencidos naranja, Incompletos ámbar, Alumnos celeste, Lectura violeta, Rúbrica índigo, Vuelo azul.
- En móvil, 2 columnas de indicadores y orden: indicadores, alertas, desglose, accesos. El libro baja a 44 px de alto.
- FE-13: permisos de corrección plegables, cerrados si hay más de 4, con los mismos datos.
- El Directivo sigue sin Inicio ni libro.
- Tests: 1115 pasan. Lint: solo el error previo. Capturas en `_capturas/fase3/`, sin desborde a 390 y 1366.

### Fase 4 — Módulos (cerrada)

- Con los tokens y los componentes de la fase 2, Alumnos, Usuarios, Colegios, Seguimiento, Sesiones, ficha del alumno y login ya heredan el sistema; revisados en 390 y 1366.
- Ajustes propios: `Card` (acciones en fila propia en móvil, FE-07), `BloqueDashboard` y `TarjetaModulo` (icono y color por módulo), `GraficaBarras` (etiquetas a un decimal y meses abreviados en móvil; el dato completo sigue en `aria-label`), `ListaAsistencia` y `FilaAsistencia` (columnas ajustadas a 390), botones de observación de 40 px en móvil, indicadores con *container query*.
- Decisión D10: las gráficas conservan colores fijos en sus atributos porque la exportación a PNG viaja sin hoja de estilos.
- Sin desborde horizontal a 360, 390 y 1366. Tests: 1115 pasan. Lint: solo el error previo.

### Fase 5 — Modo oscuro completo (cerrada)

- Claro y oscuro salen de `tokens.css`; las pantallas no llevan clases `dark:` salvo los campos de formulario.
- Gráficas: `index.css` recolorea sus atributos solo en pantalla. `descargarGrafica` clona y serializa el SVG sin hoja de estilos, así que el PNG exportado sigue saliendo con la paleta clara sobre blanco.
- Selector de tema: claro, oscuro y sistema, en `sicedu.tema`. Sin destello al cargar (`public/tema-inicial.js`).
- Capturas en `_capturas/fase5/`. Sin desborde a 390 y 1366.
