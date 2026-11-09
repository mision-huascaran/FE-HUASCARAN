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

## Pertenencia en la fecha, no `activo`

**El Dashboard cuenta a quien pertenecía al grupo en la fecha que toca a cada consulta.** No por el
estado actual del alumno.

El bug original era que ninguna lectura de alumnos miraba la baja, así que los dados de baja
inflaban el denominador de todos los porcentajes. **El primer arreglo filtró por `activo`, y estaba
mal**: eso saca al alumno también de los periodos **anteriores** a su baja, y CU014 dice lo
contrario — la baja no borra lo histórico. El backend lo confirmó: al dar de baja se cierra la
pertenencia desde esa fecha, y cada indicador cuenta con la fecha que le corresponde.

| Indicador | Con qué fecha cuenta |
|---|---|
| `distribucion-subprograma`, `resultados-aprendizaje` | La pertenencia en el **corte del PA**: `min(fin del PA, hoy)` |
| `asistencia` | La **lista histórica de cada clase**: quienes pertenecían en su fecha |
| `libros` (anual) | Los alumnos de las filas de las tablas; sin tabla, la pertenencia en la fecha de su clase |

En la práctica: en el periodo en curso un alumno dado de baja ya no cuenta, pero **en un PA anterior
a su baja sí**, con sus asistencias, lecturas y evaluaciones de entonces.

Se aplica en la **fuente** (`src/api/mock/dashboard.js`): `perteneceEn(alumno, fecha)` y
`fechaDeCorte(periodo)`, que usan todos los cálculos. No se filtra en cada gráfica a propósito:
hacerlo en el componente deja expuesto al siguiente bloque que alguien escriba, y para entonces el
dato equivocado ya habría viajado por los totales y el `contexto`.

Lo comprueba `__tests__/pertenenciaEnLaFecha.test.js`, **contra el padrón y no contra números
escritos a mano**, incluida la parte que el arreglo anterior rompía: que un PA ya terminado cuente
más alumnos que el PA en curso.

> El simulador no tenía fechas de baja —solo un `activo` booleano—, así que se añadió `baja_desde`
> a `db.ALUMNOS`, repartida a lo largo del año para que haya casos a los dos lados de cualquier
> corte. Contra la API real esto no hace falta: el servidor ya resuelve la pertenencia él mismo y
> **no hay que mandarle ningún filtro**.

---

## En el teléfono

El Dashboard se mira en móvil, no se explora: la pantalla tiene que caber, no
desplazarse de lado.

| Qué | En teléfono | Desde `sm` (640 px) |
|---|---|---|
| Las cuatro tarjetas | Una por fila | Dos columnas a partir de `xl` |
| Las gráficas | Entran enteras, con las **letras al doble** | Ancho de 680 px y su `min-w` de siempre |
| El enlace al módulo | Ancho completo, 44 px de alto | Botón discreto junto al título |
| Los filtros | Uno por línea | Comparten fila |

**Por qué las letras al doble.** El SVG tiene ancho fijo y `viewBox`, así que en una pantalla de
360 px se reduce a la mitad… y sus textos con él: un `fontSize="10"` acaba leyéndose a 5 px. Antes
eso se resolvía dejándole su ancho y deslizando la gráfica en horizontal, lo que con cuatro tarjetas
son cuatro desplazamientos laterales. Ahora el texto se dibuja al doble para que, tras la reducción,
se lea al tamaño de siempre.

El tamaño va en el **atributo** `fontSize` y no en una clase de CSS a propósito: la descarga a PNG
serializa el SVG suelto, sin hoja de estilos, y lo que esté en clases se perdería.

El modo lo decide `Grafica` con `useMediaQuery`, no cada tarjeta: así ninguna se olvida. Lo sujeta
`__tests__/dashboardMovil.test.jsx`, que simula `matchMedia` porque jsdom siempre responde que no
coincide y, sin eso, la versión móvil no se probaría nunca.

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
| `pertenenciaEnLaFecha.test.js` | Que las cifras cuenten la pertenencia al grupo en la fecha, y que una baja no borre los periodos anteriores |
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
