# Guía de los tres módulos del aula · Seguimiento de Lectura, Rúbrica y Registro de Vuelo

> **Para quién.** Para alguien que entra por primera vez a SICEDU y tiene que
> usar o probar estos tres módulos sin saber todavía qué significa una "J", ni
> cada cuánto se registra cada cosa, ni por qué a veces los campos salen
> bloqueados.
>
> **Qué NO es.** No es el detalle técnico ni el estado de los defectos: eso está
> en `docs/plan-semana12-front.md`. Aquí solo está **qué hacer, cuándo y por
> qué**.
>
> **Actualizado:** 03/11/2026. Todo lo que dice ya está en `development`.

---

## 1. En una frase cada uno

| Módulo | Qué registra | Cada cuánto | Quién escribe |
|---|---|---|---|
| **Asistencias** | Quién vino a **cada clase** | Una vez por clase | Docente |
| **Seguimiento de Lectura** | Cuántos libros leyó cada alumno **esa semana** | Una vez por **semana** | Docente |
| **Rúbrica** | Cómo lee cada alumno, en **dos dimensiones** | Una vez por **mes** | Docente |
| **Registro de Vuelo** | **La decisión**: en qué nivel queda el alumno | Una vez por **periodo académico** (4 al año) | Docente |

El **Supervisor** entra a los cuatro, pero **solo mira**. No tiene botón de
guardar en ninguno, y el servidor le responde 403 si lo intentara. Tampoco
necesita iniciar una actividad de trabajo: eso es solo para quien escribe.

**La cadena, de lo más frecuente a lo más definitivo:**

```
cada clase        cada semana              cada mes            cada periodo (PA)
Asistencias  →  Seguimiento de Lectura  →  Rúbrica  →  Registro de Vuelo
(¿vino?)        (¿cuántos libros leyó?)    (¿cómo lee?)   (¿en qué nivel queda?)
```

**El menú va en ese mismo orden**, y por eso Seguimiento de Lectura aparece
antes que Rúbrica: de lo que se hace más veces a lo que se hace menos.

Cada eslabón **necesita el anterior**. Es la causa de casi todos los "no me
deja": no es que esté roto, es que falta el paso de antes.

---

## 2. Las letras: aa, A, B… hasta Z

Son la **escala de nivel lector** del programa (la escala Raz-Kids). Son
**27 niveles en orden**:

```
aa  A  B  C  D  E  F  G  H  I  J  K  L  M  N  Ñ…  →  …  Z
└─ el más bajo                                        el más alto ─┘
```

- **`aa` es el primero**, no "la A minúscula". Va antes que la A.
- **Se comparan por su posición, nunca como texto.** En el alfabeto de una
  computadora `"Z"` va antes que `"aa"`, así que ordenar las letras como
  palabras pondría al alumno más avanzado abajo. Por eso el sistema las compara
  por su número de orden, y por eso nunca verás las letras ordenadas "raro".
- **Z1 y Z2 ya no existen.** Eran dos niveles por encima de la Z que el
  programa dejó de usar.

### Por qué una "J" no significa lo mismo en 3.º que en 5.º

Porque lo que importa no es la letra, sino **si esa letra es la que toca para
su grado**. Una "J" en 3.º puede ser un buen nivel, y la misma "J" en 5.º puede
estar por debajo de lo esperado.

Para eso existe el **Nivel del programa**, que es la traducción de la letra a
una de estas cuatro palabras, **según el grado del alumno**:

| Nivel del programa | Qué quiere decir |
|---|---|
| **Inicio** | Por debajo de lo esperado para su grado |
| **En proceso** | Acercándose |
| **Logrado** | En el nivel esperado |
| **Avanzado** | Por encima |

**Esa traducción la hace el servidor, no la pantalla.** El front nunca convierte
una letra en un nivel por su cuenta: la matriz de letra × grado vive en el
servidor, y si la pantalla tuviera su propia copia acabarían diciendo cosas
distintas. Cuando veas "Nivel del programa" en una columna, es un valor
calculado, no algo que alguien escribió.

### Y los números 0, 1, 2, 3, 4 de la Rúbrica

**No son las letras ni son notas.** Son los niveles de desempeño de la Rúbrica:

| Código | Nivel | Dónde aparece |
|---|---|---|
| **0** | Pre-inicio | **Solo** en Fluidez Lectora de Alfabetización |
| **1** | Inicio | En todas |
| **2** | En proceso | En todas |
| **3** | Logrado | En todas |
| **4** | Avanzado | En todas |

En la tabla ves el número; si tocas el valor, se abre el **descriptor
pedagógico**: la frase que explica qué tiene que hacer un alumno para estar en
ese nivel. Esos textos vienen del servidor —no están escritos en el código— y
dependen del **subprograma** y del **ciclo EBR** del grupo. El botón **"Ver
criterios de evaluación"**, junto al encabezado de cada dimensión, abre la
lista completa.

---

## 3. Lo primero de todo: la actividad de trabajo

**Si eres Docente, no puedes escribir en ningún módulo sin una actividad de
trabajo abierta.** Es el botón **"Iniciar actividad"** de la barra de arriba.

Sirve para dejar rastro: todo lo que registres queda atribuido a esa jornada de
trabajo, y es lo que después se ve en **Sesiones**. Si intentas guardar sin
ella, el servidor responde:

> *"Debes iniciar una actividad de trabajo para registrar o modificar
> información."*

Al terminar, **"Finalizar actividad"**. Si cierras sesión con una actividad
abierta, el sistema la cierra por ti y lo deja anotado como tal.

El **Supervisor no necesita nada de esto**: solo consulta.

---

## 4. Seguimiento de Lectura (semanal)

### Qué es una "tabla de lectura"

**Una tabla = un grupo + un subprograma + una semana.** No es una fila por
alumno suelta: es la hoja de esa semana para ese salón.

Y cada tabla está **atada a una clase concreta**, la **clase de referencia**:
el día de esa semana en que se tomó la lectura. Es lo que hace que los libros
se cuenten en el mes correcto aunque los registres tarde.

**Si el grupo tiene alumnos de los dos subprogramas**, hay **dos tablas** de esa
misma clase: una de Alfabetización y otra de Comprensión Lectora. Lo que
escribas en una no toca a la otra.

### El orden que hay que seguir

1. **Primero registra la asistencia de esa clase**, en Asistencias.
2. Después entra a Seguimiento de Lectura y elige Colegio, Grado, Sección,
   Subprograma, Mes y **Semana**.
3. Si la semana todavía no tiene tabla, pulsa **"Crear la tabla de esta
   semana"**.
4. Registra los libros de cada alumno y pulsa **"Guardar reporte semanal"**.

**Por qué la asistencia va primero:** la columna *Asistencia* de la tabla manda
sobre el resto de la fila.

| Asistencia del alumno | Qué pasa en su fila |
|---|---|
| **Presente** o **Tardanza** | Puedes registrar sus libros |
| **Ausente** | La fila se oscurece y los campos se bloquean (pero sí puedes dejarle una observación) |
| **Sin registrar** | Dice **"Pendiente de asistencia"** y bloquea los campos. **No cuenta como ausente** |

Si ves "Pendiente de asistencia", la ayuda te lo dice: *"Registra la asistencia
de esta clase en Asistencias para habilitar el registro de lectura."*

### Las columnas de libros

- **LSN (Libro para Subir de Nivel)** — el libro con el que el alumno intenta
  subir. Son **tres datos que van juntos**: **título**, **nota** y **puntaje
  máximo** (5 o 10). Se escribe como `nota / máximo`.
- **LSL (Libros de Selección Libre)** — cuántos libros leyó por gusto. Un
  número.
- **Total de libros leídos** — lo calcula el sistema:

  ```
  Total = LSN contabilizado + LSL
  ```

  **El LSN cuenta como 1 libro, no como su nota.** Si tiene título, nota y
  máximo, suma **1**; si los tres están vacíos, suma **0**. Ni la nota ni el
  máximo se suman al total.

  *Ejemplo:* un LSN con título y puntaje **0/5**, más **3 LSL** → **4 libros
  leídos**. Sí: un 0 de nota sigue siendo un libro leído.

> **Los tres datos del LSN se envían juntos, cuando están completos.** Antes
> cada campo se guardaba al salir del control y el servidor rechazaba un título
> suelto, así que se borraba lo escrito y era imposible registrar un libro.
> Mientras falte uno de los tres, la fila se queda con lo escrito y marcada como
> **incompleta**, sin enviarse. Si vacías los tres, se borra el LSN.

### El estado de cada fila

- **Pendiente** — falta registrar.
- **Completada** — ya tiene lo que necesita.
- **No aplica** — el alumno no tenía que registrar esa semana.

Y aparte, la columna de **Sincronización**: si guardaste sin conexión, dirá
*Pendiente* hasta que el envío llegue al servidor.

### "Esta semana no se hizo la lectura"

Existe para eso: **"Marcar como no realizada"**, con su motivo. Deja constancia
de que la semana no se trabajó, y **esa declaración aporta 0 libros** mientras
siga vigente — que no es lo mismo que una semana en blanco, donde nadie sabe si
se hizo o no.

Se puede revertir con **"Habilitar registro de lectura"**, y la reversión queda
en el historial junto a la declaración original. Las dos cosas **funcionan sin
conexión**.

### Cambiar la clase de referencia

Si la tabla quedó atada al día equivocado, **"Cambiar clase"** ofrece las otras
clases de esa misma semana.

> También ofrece las **clases adicionales** que tengan asistencias. Antes decía
> "No hay otra clase esta semana" aunque la hubiera.

---

## 5. Rúbrica (mensual)

**Una evaluación por alumno y por mes**, con **dos dimensiones**:

- **Fluidez Lectora** — cómo lee (y es la única que admite el **0 = Pre-inicio**,
  y solo en Alfabetización).
- **Comprensión Lectora** — cuánto entiende de lo que lee.

### Cómo se registra

1. Elige Colegio, Subprograma, Grado, Sección, Año escolar y **Mes**.
2. Pulsa **"Registrar evaluaciones"** (solo el Docente lo ve).
3. Pon el nivel de cada dimensión y guarda.

El **estado** de cada alumno sale solo de ahí:

| Estado | Qué significa |
|---|---|
| **Pendiente** | No tiene ninguna de las dos |
| **Incompleta** | Tiene una sola |
| **Completada** | Tiene las dos |

Y esto importa más de lo que parece: **una rúbrica incompleta no sirve para el
Registro de Vuelo**. La sugerencia del PA se calcula con la **última rúbrica
completa** del periodo; si solo pusiste Fluidez, para el motor es como si no
existiera.

### Si "Registrar evaluaciones" sale deshabilitado

El motivo se muestra **escrito al lado del botón**, no hay que adivinarlo. Las
causas posibles son siempre estas: faltan filtros, no hay alumnos que evaluar,
no tienes una actividad de trabajo abierta, o no tienes habilitación de
escritura para ese grupo y ese mes.

### A qué periodo pertenece un mes

Un mes pertenece al **periodo académico con más días lectivos** en ese mes. Por
eso **octubre pertenece al PA3** aunque el PA4 empiece dentro de octubre.

> **Decisión provisional del backend (DP-1):** octubre sigue asociado al PA3,
> **pero lo puede evaluar cualquier Docente con habilitación en cualquiera de
> los periodos con días lectivos en ese mes** (PA3 **o** PA4). Antes, un Docente
> asignado solo al PA4 no podía evaluar octubre y esa rúbrica no aparecía como
> vencida en ningún sitio: se quedaba sin nadie. Está **pendiente de que la
> valide el analista**.

---

## 6. Registro de Vuelo (una decisión por periodo)

Es **el momento en que se decide** en qué nivel queda el alumno. **Cuatro veces
al año**, una por PA. La pantalla muestra los cuatro periodos a la vez, de ahí
que no tenga filtro de mes.

### Las seis columnas de cada periodo

| Columna | Qué es | ¿Lo escribes tú? |
|---|---|---|
| **Nivel de entrada** | De dónde parte el alumno en ese periodo | **No**, es calculado |
| **Sugerencia** | Lo que el motor propone: bajar, mantener o subir | **No**, es calculado |
| **Nivel colocado** | **La decisión**: la letra que eliges | **Sí** |
| **Nivel del programa** | La letra traducida a Inicio / En proceso / Logrado / Avanzado | **No**, es calculado |
| **Proyección** | Una meta opcional para el alumno | Sí, opcional |
| **Observación** | Por qué decidiste eso | Sí, opcional |

**De dónde sale el Nivel de entrada:**

- En el **PA1**, es el **nivel inicial que corresponde a su grado**. No es una
  decisión que alguien registró.
- En el **PA2, PA3 y PA4**, es el **Nivel colocado del periodo anterior** del
  mismo alumno y año — **incluso si se registró en otro colegio**, y entonces lo
  dice: *"Registrado antes del traslado."*
- Si el periodo anterior no tiene decisión confirmada, dice **"Pendiente del
  periodo anterior"**. No inventa una letra provisional.

**De dónde sale la Sugerencia:** de la **última rúbrica mensual completa** de
ese periodo. El botón **"Ver rúbrica"** te enseña de qué mes salió y con qué
valoraciones. Si no hay ninguna rúbrica completa en el PA, dice **"Pendiente de
evaluar"**.

### Cómo se registra

1. **"Registrar niveles"** habilita la edición de los periodos que te
   correspondan.
2. Al tocar **Nivel colocado** se abre un panel con las letras de **aa a Z**,
   agrupadas por Inicio / En proceso / Logrado / Avanzado **según el grado**.
   Así ves de un vistazo qué significa cada letra para ese alumno.
3. Eliges la letra. **Puedes elegir cualquiera, aunque no sea la que sugiere el
   motor** — la sugerencia es una orientación, no una obligación, y seguir otra
   no te obliga a cambiar la rúbrica.
4. **"Guardar decisiones"**.

Dos cosas que conviene saber:

- **Elegir la misma letra que el nivel de entrada SÍ es una decisión.** "Se
  queda donde está" es una decisión explícita, y hay que registrarla.
- **Una proyección o una observación por sí solas no completan el registro.**
  Si no elegiste Nivel colocado, ese periodo sigue **"Sin registrar"**.

---

## 7. Qué ve el Supervisor

Lo mismo, **sin poder escribir**:

- Entra a los cuatro módulos **desde el menú** y ve **todos los colegios** del
  programa.
- **No le aparecen** los botones de registrar o guardar, ni necesita actividad
  de trabajo.
- Los descriptores, los criterios y los historiales sí los puede consultar.
- Tiene además dos pantallas propias: **Seguimiento** (cómo va cada Docente con
  su sincronización) y el **Dashboard** (los indicadores consolidados).

Si el Supervisor necesita que un Docente corrija algo de un periodo que ya
cerró, no lo hace él: **le otorga un permiso excepcional de corrección** desde
Usuarios, para un módulo, un grado y un plazo concretos.

---

## 8. Sin conexión

Los **tres módulos del aula funcionan sin internet**. Está pensado para eso: se
registra en el aula y se envía cuando hay señal.

- Lo que guardas queda en el dispositivo marcado como **"Pendiente de
  sincronización"**, y se envía solo al recuperar la conexión.
- El indicador de la barra de arriba te dice cuántos envíos quedan.
- **Cerrar sesión no borra lo pendiente.** Si te vas con cambios sin enviar, el
  sistema te avisa antes.

> Si la **sesión expira** con cosas pendientes, la cola **se conserva** y se
> envía cuando el mismo Docente vuelve a entrar. Antes se vaciaba, y el trabajo
> se perdía después de haber avisado de que no se perdería.

**Lo que NO funciona sin conexión**, porque decide permisos o altas y un dato
viejo aquí hace daño: Usuarios, Colegios, Sesiones y el Dashboard.

> Si no hay conexión **y** el dispositivo todavía no descargó tus
> habilitaciones, Asistencias **bloquea el registro** en vez de dejarte escribir
> algo que el servidor va a rechazar después.

---

## 9. "No me deja": la tabla de causas

| Lo que ves | Qué pasa | Qué hacer |
|---|---|---|
| *"Debes iniciar una actividad de trabajo…"* | No abriste la jornada | **Iniciar actividad**, arriba |
| *"Pendiente de asistencia"* en una fila de Lectura | Esa clase no tiene asistencia registrada | Regístrala en **Asistencias** |
| La fila de Lectura está oscurecida | El alumno fue **Ausente** | Correcto: solo puedes dejar observación |
| *"Esta semana aún no tiene tabla de lectura"* | Normal: todavía no se creó | **Crear la tabla de esta semana** |
| *"La clase de referencia todavía no se ha realizado"* | La clase de esa semana aún no llegó | Espera al día de la clase, o elige una semana anterior |
| *"Sin clases esta semana"* | Esa semana no tiene clase programada para el grupo | Revisa el calendario del colegio o la programación de clases |
| *"No hay estudiantes que pertenecieran a este grupo en la fecha de la clase seleccionada."* | Hay clase, pero el grupo no tenía alumnos ese día | Revisa la pertenencia de los alumnos en **Alumnos** |
| *"No es posible adelantar registros…"* | Elegiste una semana futura | Elige la semana actual o una anterior |
| "Registrar evaluaciones" deshabilitado | Falta un filtro, la actividad o la habilitación | El motivo está **escrito al lado del botón** |
| *"Pendiente del periodo anterior"* en Registro de Vuelo | El PA anterior no tiene decisión confirmada | Registra primero ese periodo |
| *"Pendiente de evaluar"* en la Sugerencia | No hay ninguna **rúbrica completa** en ese PA | Completa **las dos** dimensiones de algún mes del periodo |

---

## 10. En el teléfono

Los tres módulos funcionan igual en el teléfono; lo que cambia es por dónde se
navega:

- **Las secciones están abajo**, en una barra de iconos: Inicio, Alumnos,
  Asistencia, Lectura y **Más**. Están abajo a propósito, porque es donde llega
  el pulgar cuando sostienes el teléfono con una mano.
- **"Más"** abre la lista completa —Rúbrica, Registro de Vuelo, Sesiones— y
  también el cambio de contraseña y la salida.
- **Las tablas y las gráficas se deslizan de lado.** No se encogen: si se
  encogieran, los nombres y los valores dejarían de leerse.
- **Los filtros se pliegan** detrás de un botón "Filtros" para no ocupar media
  pantalla.

Para abrirlo en el teléfono, usa la dirección de red que imprime el servidor de
desarrollo (`http://192.168.x.x:5173/`), con el teléfono en la misma wifi.

---

## 11. El resumen en seis líneas

1. **Abre la actividad** antes de escribir nada.
2. **Asistencia primero**, siempre: sin ella la lectura de esa clase se queda
   bloqueada.
3. **Cada semana**, la tabla de lectura: LSN (título + nota + máximo, los tres
   juntos) y LSL. El LSN vale **1 libro**, no su nota.
4. **Cada mes**, la rúbrica: **las dos dimensiones**, o no cuenta para nada.
5. **Cada periodo**, la decisión en Registro de Vuelo: elige la letra, aunque
   sea la misma de antes.
6. **Las letras van de `aa` a `Z`** y lo que dicen depende del grado: para saber
   si es buena o mala, mira el **Nivel del programa**.
