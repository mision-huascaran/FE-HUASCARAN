# Dashboard (Supervisor y Directivo)

Pantalla de consulta, **solo lectura y solo en línea**. No requiere actividad de trabajo y no
modifica ningún registro.

Responde a una pregunta: **¿qué módulo necesita que entre?** Y la respuesta se pulsa.

---

## Cómo está armado

**Cuatro tarjetas, una por módulo**, en el orden en que se trabaja:

| Tarjeta | Cifra | Gráfica | Endpoint |
|---|---|---|---|
| **Asistencias** | % de asistencia | Línea por mes | `GET /dashboard/asistencia` |
| **Seguimiento de Lectura** | Libros leídos | Barras por mes | `GET /dashboard/libros` |
| **Rúbrica** | % evaluado | Barras por dimensión | `GET /dashboard/resultados-aprendizaje` |
| **Registro de Vuelo** | % con nivel colocado | Barras por nivel | `GET /dashboard/resultados-aprendizaje` |

Cada tarjeta tiene **cuatro cosas y nada más**: el título del módulo, una cifra grande, una gráfica
y el enlace *"Ver en \<módulo\>"*. Lo que antes era un párrafo de fórmula vive en el `title` de la
cifra: quien la busca la tiene, quien solo quiere el número no la lee.

### Los archivos

```
DashboardPage.jsx       la pantalla: filtros + las cuatro tarjetas
TarjetaModulo.jsx       el molde: título, cifra, gráfica, enlace y excluidos
TarjetaAsistencia.jsx   ┐
TarjetaLectura.jsx      │ una por módulo; cada una con su consulta
TarjetaRubrica.jsx      │
TarjetaVuelo.jsx        ┘
enlacesDeModulo.js      a dónde lleva cada tarjeta y con qué filtros
resultadosPorModulo.js  reparte `resultados-aprendizaje` entre Rúbrica y Vuelo
BloqueDashboard.jsx     marco común: carga, error, vacío, desactualizado
FiltrosDashboard.jsx    año, periodo y colegios (una sola fila)
SelectorColegios.jsx    el desplegable de colegios
useFiltrosDashboard.js  estado de los filtros y qué está aplicado
estados.js              literales y formato (porcentajes, "Sin información")
graficas/               las gráficas en SVG y su descarga a PNG
LibrosPage.jsx          consolidado de libros por meses (CU034) y sus detalles
```

---

## Reglas que conviene no romper

**El título y la ruta salen de `MATRIZ`** (la matriz de permisos), no de constantes de aquí. Así la
tarjeta se llama igual que la entrada del menú que la persona acaba de pulsar, y un cambio de nombre
o de ruta se hace en un solo sitio.

**El enlace lo decide `puedeEntrar`, no un `if` por rol.** Los cuatro módulos son
`[DIRECTIVO]: null` en la matriz, así que sus tarjetas informan pero no ofrecen entrar: mandarlo a
una ruta que su propia guarda le va a negar sería ofrecerle una puerta tapiada.

**El colegio viaja en la URL solo si es UNO.** Con "Todos los colegios" o con varios elegidos,
cualquier colegio que pusiéramos en el enlace sería uno que la persona no eligió; en ese caso el
módulo abre con lo último que esa persona consultó, que es su comportamiento normal (D105).

**El enlace va en la cabecera de la tarjeta**, fuera del área que depende de la consulta. Si los
datos fallan o están cargando, entrar al módulo sigue siendo lo más útil que se puede hacer desde
aquí; dentro del cuerpo quedaría escondido tras el botón de "Reintentar".

**El reparto de `resultados-aprendizaje` se hace por `resultado`, no por `fuente`.** El endpoint
devuelve `global` (Registro de Vuelo), `fluidez` y `comprension` (Rúbrica). `resultado` es parte del
contrato y tiene literales fijos; `fuente` lo manda el simulador y puede no venir del servidor real.
Un `resultado` nuevo **no se reparte solo** a ninguna tarjeta: queda fuera hasta que se decida de
quién es.

**No se recalculan porcentajes ni órdenes.** Los calcula el servidor sobre el conjunto. Y el
porcentaje de un conjunto **no** es el promedio de los porcentajes de sus partes: cuando aquí hay
que agregar (`completitud` en `resultadosPorModulo.js`) se suman recuentos y se divide una sola vez
al final.

**Un hueco no es un cero.** `null`, `sin_informacion` o `sin_datos` se pintan "Sin información",
nunca 0 %. Un mes `futuro` no dibuja barra ni punto. Y un colegio cuyo periodo no empezó se nombra
aparte ("Sin información y fuera del total: …"), porque callarlo lo convertiría en un colegio con
cero alumnos.

**Un bloque roto no se lleva a los otros tres.** De eso se encarga `BloqueDashboard`, que pone por
tarjeta la carga, el error con "Reintentar", el 422 `calendario_no_configurado` con los colegios sin
calendario, "Información no actualizada" cuando lo que se ve es anterior al error, y "Cambios sin
aplicar" cuando el borrador de filtros no es el de la consulta mostrada.

---

## Solo alumnos activos

**El Dashboard cuenta solo alumnos activos.** Antes no: cada lectura de `db.ALUMNOS` en el simulador
filtraba por colegio —y a veces por grado o subprograma— pero **nunca por `activo`**, así que los
alumnos dados de baja entraban en los totales y en el denominador de todos los porcentajes.

Se corrige en la **fuente**: una constante `ALUMNOS_ACTIVOS` en `src/api/mock/dashboard.js` que usan
los ocho sitios que leen alumnos. No se filtra en cada gráfica a propósito: hacerlo en el componente
deja expuesto al siguiente bloque que alguien escriba, y para entonces el dato equivocado ya habría
viajado por los totales y el `contexto`.

Un alumno inactivo deja de existir para el dashboard entero: no suma, no aparece en ningún listado y
tampoco se puede abrir su desglose.

Lo comprueba `__tests__/soloAlumnosActivos.test.js`, **contra el padrón y no contra un número
escrito a mano**: el simulador genera los inactivos con su propia semilla, así que una cifra fija se
rompería al cambiarla y no diría nada.

> ⚠️ **Pendiente de confirmar con el backend.** La corrección de arriba es del **simulador**. El
> front no manda ningún parámetro de "solo activos" a `/dashboard/*` porque no existe en el
> contrato, y el contrato tampoco dice qué hace el servidor con los alumnos dados de baja: detalla
> todos los demás estados (`sin_informacion`, `futuro`, `en_curso`, `no_aplica`,
> `periodo_no_iniciado`…) pero este no. Lo más cercano es `fechas_corte`, que fija la fecha en la
> que se mira la **pertenencia al grupo**, que no es lo mismo que la baja.
>
> **Qué preguntar:** ¿`total_a_evaluar` (resultados-aprendizaje) y `alumnos_incluidos` (libros)
> excluyen a los alumnos dados de baja, o solo aplican la pertenencia de `fechas_corte`? Si los
> incluyen, el bug sigue vivo contra la API real y hay que corregirlo allí, no aquí.

---

## El Directivo no tiene Inicio

Su única pantalla es el Dashboard. Su Inicio (CU012) eran tres indicadores institucionales que el
Dashboard ya da, y con filtros de año, periodo y colegios que el Inicio no tenía; mantener los dos
obligaba a sostener el mismo número en dos pantallas y a explicar por qué no siempre coincidían.

| Dónde | Qué quedó |
|---|---|
| `auth/permisos.js` | `MATRIZ.inicio` → `[DIRECTIVO]: null` |
| `auth/roles.js` | Su ruta de aterrizaje es `/dashboard` |
| `rutas.jsx` | `/inicio` ya no lo admite: entrar por URL lo manda a `/403` |
| `features/inicio/` | Se borró `InicioDirectivo.jsx` |

Al Docente y al Supervisor no les cambia nada: su Inicio no es un resumen, es su puesto de trabajo
(actividad, asignaciones, alertas).

---

## Qué se quitó al rearmarlo

Los nueve bloques por indicador —`BloqueDistribucion`, `BloqueResultados`, `BloqueComparacion`,
`BloqueComparacionColegios`, `BloqueAsistencia`, `BloqueEvolucion`, `ResumenAnual` y
`DetalleClases`—, cada uno con su párrafo de fórmula, hasta ocho tarjetas de cifras y su tabla
completa. Se podía leer entero y seguir sin saber qué hacer con lo leído: ningún bloque llevaba al
módulo donde se corrige lo que mostraba.

El detalle nominal por clase ya no se duplica dentro del dashboard: se llega al módulo de
Asistencias, que es donde se actúa. El consolidado de libros (CU034) **se queda** y cuelga de la
tarjeta de Lectura como "Consolidado por meses".

**Siguen en el código a propósito** las funciones de recurso de los endpoints que ya no pinta nadie
(`obtenerDistribucionSubprograma`, `obtenerComparacionResultados`, `obtenerComparacionColegios`,
`obtenerEvolucionAnual`, `obtenerClasesDeAsistencia`): son enlaces finos a endpoints vivos del
backend y los cubren las pruebas de contrato (`parametros.test.js`, `rutasReales.test.js`).
Borrarlos sería perder esa comprobación sin ganar nada.

---

## Pruebas

| Archivo | Qué sujeta |
|---|---|
| `dashboard.test.jsx` | De punta a punta: las cuatro tarjetas de cada rol, que cada una lleve a su módulo, que tocar un filtro avise en vez de recargar, y el consolidado de libros |
| `soloAlumnosActivos.test.js` | Que las cifras se calculen solo sobre alumnos activos |
| `resultadosPorModulo.test.js` | El reparto entre Rúbrica y Vuelo, y que no se promedien porcentajes |
| `selectorColegios.test.jsx` | El desplegable de colegios |
| `estados.test.js` / `parametros.test.js` | Literales, formato y los parámetros que viajan a cada endpoint |
| `auditoriaUx.test.jsx` | Lo que queda de la auditoría de UX #737 |

```bash
npx vitest run src/features/dashboard
```

---

## Lo que no se ha verificado

El rediseño está cubierto por pruebas (títulos, enlaces, cifras y estados), pero **no se ha visto en
un navegador**: en el equipo donde se hizo, la herramienta de automatización de Chrome no alcanza el
servidor de desarrollo (carga páginas públicas, pero no `localhost:5173` ni la IP de red). El
aspecto visual de las cuatro tarjetas —espaciados, cómo caen en dos columnas, la gráfica en móvil—
conviene mirarlo a ojo con `npm run dev` antes de darlo por bueno.
