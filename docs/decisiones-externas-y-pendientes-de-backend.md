# Decisiones externas y pendientes de backend · frontend SICEDU

**Para:** **analistas** (lo que necesita decisión de caso de uso) y **backend**
(lo que falta publicar o corregir del lado del servidor).
**Actualizado:** 29/10/2026, con la respuesta del backend (Paris, tandas I,
L y **M**), las dos partes de la **ronda 6** del tester y el **Dashboard**
(CU033 a CU035), que ya está implementado.

> ## Del backend no queda nada
>
> Los **once** pedidos originales de "Lo que falta del BACKEND" están
> resueltos: seis ya existían con otro nombre de campo, y el resto llegó con
> las **tandas I y L** (nombres en las habilitaciones, lote de permisos,
> `pertenece_desde` en el `PATCH`, `solo_historial`, nombres en la
> programación de clases). Cada uno lleva debajo la respuesta, y lo que
> exigía cambios en el front ya está hecho.
>
> **S23 también está resuelto**, y sin tocar el backend: el front se alineó
> con el contrato real (`app/schemas/dashboard.py`). Cada endpoint de
> `/dashboard/*` tiene su adaptador en `src/api/resources/dashboard.js`, el
> simulador devuelve la forma real y una prueba de contrato lo vigila.
>
> **La Tanda M del backend** (`34c6191`) resolvió D100 y D101 y aplicó dos
> **decisiones provisionales** para no esperar al analista antes de la
> exposición: **DP-1** (S20, D88) y **DP-2** (S21). El front ya trabaja contra
> ellas.
>
> **Lo que queda abierto del ANALISTA**: siete puntos. Los cinco del sprint,
> **S22** y **validar DP-1 y DP-2** después de la exposición. Además, la
> **siguiente fase del front** espera a la v8 de los CU: D85, D86, D102, D106
> y D107 (rediseño de Rúbrica, Registro de Vuelo, Seguimiento de Lectura,
> Sesiones y Seguimiento).
>
> **Dos decisiones cambiaron de sentido**: **S12** estaba mal y el CU ya la
> respondía (retirada, y corregida en el código), y **S1** —"el Dashboard no
> se implementa"— **dejó de valer**: los CU llegaron completos y el backend
> publicó sus endpoints, así que está construido.

> **Qué es esto.** Todo lo que el frontend **no puede resolver escribiendo
> código**: las decisiones que hubo que tomar por cuenta propia para no
> quedarse parado —cada una con su motivo, para que se pueda revertir si la
> decisión de verdad es otra— y lo que hace falta del backend.
>
> El plan de implementación y el estado de cada defecto están en
> `docs/plan-semana12-front.md`. Aquí no hay tareas de frontend pendientes:
> hay preguntas.

## Índice

| Sección | De qué va | Responsable |
|---|---|---|
| [1. El trabajo offline que nadie ve](#1-el-trabajo-offline-que-nadie-ve) | Un docente que nunca se conectó sale "Al día" en verde (A1–A5, B1–B3, F1–F3) | Analista y backend |
| [2. Pantallas del mockup antiguo](#anexo-pantallas-del-mockup-antiguo--%E2%9C%85-resuelto) | ✅ Resuelto: las nueve rutas sin caso de uso ya no existen | — |
| [3. Sprint de la semana 12](#anexo-el-sprint-de-la-semana-12-s1-a-s23) | S1 a S23: lo que se decidió sobre la marcha, lo que falta del servidor y lo que abrieron la ronda 6 y el Dashboard | Analista y backend |

**Lo que queda.** Los siete son de Carlos (analista): los cinco primeros
venían del sprint y los dos siguientes los abrió la **ronda 6** del tester.
Del backend no queda nada (S23 se resolvió en el front y la Tanda M cerró
D100 y D101):

1. **CU028** — si el modal de permisos pide varios grados y módulos a la vez,
   hay que cambiar sus dropdowns de "selección única". El endpoint de lote ya
   existe; la pantalla espera a esto.
2. **CU014 (S2)** — si "Editar" sin actividad va habilitado y avisa, o
   deshabilitado.
3. **CU014 (S8)** — ratificar que a un alumno inactivo no se le pide
   "Pertenece al grupo desde".
4. **CU010 (S4)** — el texto del tooltip de "Iniciar actividad" deshabilitado.
   Es el único de los tres que seguía sin literal.
5. **CU022 (S3)** — dejar por escrito el acceso del Supervisor en solo lectura.
6. **Validar DP-1 y DP-2** (S20 y S21) — decisiones provisionales del
   backend en la Tanda M, aplicadas para la exposición.
7. **S22** — qué pasa con un alumno que cambia de grupo a mitad de mes.

**S1 (Dashboard) — ✅ RESUELTO: ya está implementado.** CU033, CU034 y
CU035 llegaron completos en los casos de uso actualizados y el backend publicó
los once endpoints de `/dashboard/*` (serie D1–D7). Está en `development`, en
el commit `59eb6a9`, y la Fase 8 de `docs/plan-semana12-front.md` cuenta qué
hace cada bloque.

---

## 1. El trabajo offline que nadie ve

**Estado:** propuesta, sin implementar. Nada de esto está en los casos de uso todavía.
**Origen:** revisión del Módulo de Seguimiento, 21/10/2026.

---

## El problema en una captura

Así se ve hoy una fila del Seguimiento del Supervisor:

| Docente | Colegios asignados | Última conexión | Sincronización | Pendientes |
| :---- | :---- | :---- | :---- | :---- |
| ANTONIO TEST | — | **Nunca** | **Al día** 🟢 | 0 |

Un docente que **no se ha conectado nunca** aparece en verde y con la etiqueta
"Al día". Es lo contrario de la verdad, y es la celda que más se mira de toda la
pantalla.

No es un error de nadie: es una consecuencia del contrato. `sincronizacion` solo
admite dos valores, `al_dia` y `pendiente`, así que todo el que no tenga
pendientes **reportados al servidor** cae en "al día" por descarte. Nunca
haberse conectado y estar efectivamente al día se pintan igual.

## Por qué importa

El propio CU012 nombra el agujero, aunque no saca la conclusión:

> *"Los registros que permanezcan exclusivamente en IndexedDB de un dispositivo
> sin conexión y que todavía no hayan sido reportados al servidor **no podrán
> formar parte del cálculo** de Salud del Sistema."*

Es decir: **el peor caso es el invisible**. Un docente que trabajó una semana en
Yungay sin señal tiene todo en su tablet, el servidor no sabe que existe ese
trabajo, y el Supervisor lo ve en verde. Si esa tablet se pierde, se formatea o
simplemente nunca vuelve a conectarse, el trabajo se pierde y nadie llegó a
saber que estaba en riesgo.

El mismo sesgo afecta a la tarjeta **Salud del sistema**: su fórmula mide el
estado de sincronización *conocido por el servidor*, no el real. Un 98 % no
significa que el 98 % del trabajo esté a salvo.

## Lo que ya está cubierto, y no hay que rehacer

El **Docente** sí se entera de lo suyo, y funciona sin conexión porque se lee de
IndexedDB, no del servidor:

- El Resumen de Acción de su Inicio: *"Tienes N registros offline pendientes de
  sincronizar."* (CU010, lista cerrada de indicadores).
- El indicador de la barra superior y su panel con el detalle de cada envío.

Lo que falta no es avisarle a él. Es que **eso llegue al Supervisor**, y hoy no
puede: mientras no haya conexión, el servidor no tiene cómo enterarse.

---

# Preguntas, por responsable

## Prioridad alta — ANALISTA

Estas cambian lo que significa un dato en pantalla, así que necesitan decisión
de caso de uso antes de tocar nada.

**A1. ¿"Al día" debe seguir significando "nada pendiente que el servidor
conozca", o debe pasar a significar "sin trabajo en riesgo"?**
Son cosas distintas y hoy se pintan iguales. De esta respuesta salen todas las
demás.

**A2. ¿Hace falta un tercer estado de sincronización para "no se sabe"?**
Propuesta: `sin_reportar`, en ámbar, para quien nunca se conectó. El texto
honesto sería *"Sin datos de sincronización"*. Si se aprueba, CU020 tendría que
enumerarlo junto a los otros dos.

**A3. "Sincronización Olvidada" no cubre a quien nunca entró.**
CU011 la dispara cuando hay *registros vencidos* **y** más de 3 días desde el
último inicio de sesión. Un docente que nunca se conectó no tiene registros
vencidos, así que **no genera alerta**. ¿Debería existir una alerta propia para
"cuenta creada y nunca usada", o se relaja la condición de la actual?

**A4. ¿Cuántos días sin conectarse convierten a un docente en un riesgo?**
Hoy la tabla pinta "Nunca" y "hace 5 minutos" con el mismo peso visual. Si hay
un umbral, se puede señalar en la fila. CU011 ya usa 3 días para una alerta y 4
días hábiles para otra: ¿sirve alguno de esos, o este caso pide el suyo?

**A5. ¿La tarjeta Salud del sistema debe decir qué mide?**
Hoy su texto de apoyo es *"Sincronización global"*. Sería más fiel
*"Sincronización conocida por el servidor"*, que es literalmente lo que calcula
la fórmula de CU012. Es solo redacción, pero evita que alguien lea un 98 % como
una garantía.

## Prioridad alta — BACKEND

**B1. ¿`sincronizacion` puede admitir un tercer valor?**
Hoy el contrato lo declara como enum cerrado y obligatorio:

```
DocenteSeguimiento.sincronizacion : "al_dia" | "pendiente"   (required)
```

Si A2 se aprueba, hay que añadir `sin_reportar`. **Si no se añade, el frontend
puede deducirlo** de `ultima_conexion === null`, que ya llega y es nullable. Eso
no requiere backend, pero deja la regla viviendo en el cliente, que es peor
sitio para ella.

**B2. ¿Existe una fecha de creación de la cuenta?**
Para distinguir "cuenta nueva de ayer, todavía no ha entrado" de "cuenta de hace
dos meses que nunca se usó". Sin ese dato las dos se ven igual, y solo la
segunda es un problema.

**B3. ¿Se puede reportar la existencia de pendientes antes que su contenido?**
Es la idea que ya insinúa CU012 al hablar de *"registros pendientes reportados
al servidor"*: el dispositivo manda la metadata o el identificador en cuanto
tiene un hueco de red, aunque el contenido completo tarde en persistir. Si el
Service Worker pudiera hacer ese aviso ligero, el Supervisor vería el riesgo sin
esperar a la sincronización completa. **Esta es la que de verdad cierra el
agujero**; las demás solo evitan que se lea de más en un verde.

## Prioridad media — FRONTEND

Se pueden hacer sin esperar a nadie, en cuanto el analista responda A1.

**F1. Derivar "sin reportar" de `ultima_conexion`.**
No necesita backend. Queda pendiente de B1 si se prefiere que el estado lo mande
el servidor.

**F2. Explicar el verde al pasar el cursor.**
*"Sin pendientes reportados al servidor hasta su última conexión, el DD/MM a las
HH:MM."* Una línea, y quita el malentendido sin cambiar ningún dato.

**F3. Ajustar el texto de apoyo de Salud del sistema** (depende de A5).

---

---

# Anexo: pantallas del mockup antiguo — ✅ RESUELTO

Anotado el 21/10/2026 y **cerrado desde entonces**. Se deja el registro porque
explica por qué se retiraron y porque el motivo sigue valiendo.

Había nueve rutas con código que **no aparecían en ningún caso de uso**:
`/ranking`, `/nivel-final`, `/consolidados`, `/alertas`, `/administracion`,
`/panel-ejecutivo`, `/reportes`, `/consulta-colegios` y `/dashboard`.
**Ya no existen**: ni las rutas, ni las pantallas, ni los recursos que las
alimentaban con datos inventados. Con ellas se fue también `filtrosStore` y su
`idPeriodo`, el periodo global que CU027 dejó sin sentido.

**Por qué importaba**, del contrato de la semana 11 (§8.5):

> *"conviene retirar o reemplazar por 'Pantalla pendiente' las rutas del mockup
> viejo que siguen accesibles por URL (`/ranking`, `/nivel-final`,
> `/consolidados`, `/alertas`, `/administracion`, `/panel-ejecutivo`,
> `/reportes`): **eso fue lo que vio la asesora**."*

Alguien de fuera del equipo entró por URL a pantallas con datos inventados y
las tomó por producto. Esa puerta está cerrada.

**Lo único que queda abierto de aquí es el Dashboard**, y está en **S1**: el
código se borró, pero CU033, CU034 y CU035 siguen completos en la biblia.

---
# Anexo: el sprint de la semana 12 (S1 a S23)

Anotado el 28/10/2026, mientras se implementaba `docs/plan-semana12-front.md`.
Cada punto es algo que **no se resuelve escribiendo código**.

## Decisiones que tomó el FRONTEND por su cuenta

Se tomaron para no dejar el sprint parado, **no porque sean la respuesta**.
Cada una dice su motivo y qué habría que hacer si la decisión de verdad es la
contraria. Son las cuatro que conviene ratificar o revertir.

**S2. ¿"Editar" sin actividad debe ofrecer iniciarla o salir deshabilitado?**
El 09/10 se decidió lo primero y se escribieron pruebas para ello. El 24/10 el
tester lo marcó como D59 y pidió lo segundo. Se implementó **lo que pide el
tester** —un control habilitado que no puede funcionar miente—, pero es un
cambio de criterio, no un arreglo: si el analista prefiere el anterior, se
revierte. Afecta a Alumnos (CP-INI-04).

**S8. "Pertenece al grupo desde" de un alumno INACTIVO (D65, CU014).**
El defecto pide ese campo cuando el alumno no tiene intervalo de pertenencia.
Para un alumno **activo** sin pertenencia está claro: son los cargados antes de
que el backend modelara el historial, y sin esa fecha el alumno se cae de las
tablas históricas. Pero un alumno **inactivo** tampoco tiene pertenencia *por
definición* —`pertenece_desde` llega `null` a propósito, porque no tiene grupo
en curso— y volver a un grupo es justo lo que hace **"Activar"** con su fecha
efectiva. Pedirlo en los dos sitios daría dos fechas para un mismo hecho, así
que el front **no lo pregunta** al editar un inactivo. Si el analista quiere lo
contrario, hay que decir qué manda cuando las dos fechas no coinciden.

**S12. Declarar y revertir "no realizada" — ❌ RETIRADA el 28/10/2026.**
Se decidió que exigían conexión, por prudencia: las dos cambian el estado de la
tabla entera. **La decisión estaba mal**, y lo señaló el backend: CU026 tiene su
propio flujo *"Registro sin conexión a Internet"*, donde la declaración se
guarda como "Pendiente de sincronización" y la reversión va *"vinculada a la
declaración original"*. El caso de uso ya respondía la pregunta que se dio por
abierta.

**Ya está implementado**: las dos se encolan, la reversión depende de la
declaración y, si el servidor rechaza aquella, esta se descarta con ella. No
hay nada que decidir aquí.
**S14. El rechazo de Rúbrica se ve DOS veces, a propósito.**
La tanda 0 pide mostrar `evaluacion_en_otro_grupo` **en la fila del alumno**,
y en una tabla de cuarenta filas un aviso arriba obliga a buscar de quién
hablaba. El aviso general se queda porque es el que lleva la acción de
descartar y el que aparece cuando el rechazo llega con la pantalla cerrada. Si
el analista prefiere una sola, la acción tiene que bajar a la fila.

---

## Lo que necesita decisión del ANALISTA

**S1. El Dashboard — ✅ IMPLEMENTADO el 29/10/2026 (antes: "no se implementa").**
Era la decisión contraria, y conviene que se vea el cambio en vez de borrarlo:
el 28/10 Carlos confirmó que CU033 a CU035 eran "un bosquejo sin orden de
implementarse", y además el backend no publicaba sus endpoints. **Las dos
razones dejaron de valer el mismo día**: los casos de uso actualizados traen
los tres CU completos —con sus flujos alternativos y sus literales— y el
backend publicó los **once endpoints** de `/dashboard/*` (serie D1–D7), con su
matriz de roles.

Está construido: una ruta `/dashboard` con dos pantallas —CU033 para el
Supervisor, CU035 para el Directivo— y `/dashboard/libros` para CU034, que es
solo del Supervisor porque llega hasta el alumno. **Cierra D49 por el lado del
frontend.** El detalle está en la **Fase 8** de `docs/plan-semana12-front.md`.

**S23**, la forma de las respuestas, ya está resuelto (ver abajo).

<details><summary>El planteamiento original</summary>

CU033, CU034 y CU035 están completos en `Actualización de casos de uso.md` y el
documento tiene su pestaña "Módulo de Dashboard". Pero el commit `3070755` lo
borró del frontend —`features/dashboard/`, su recurso, los gráficos y la tabla
de colegios— y el backend no publica sus endpoints. El tester lo anotó en D49.
**Son tres pantallas desde cero si vuelve.**

</details>

**S3. El menú del Supervisor.**
Se destaparon Asistencias, Lectura, Rúbrica y Registro de Vuelo (D49), porque
la matriz del backend y los CU actualizados coinciden en que los consulta en
solo lectura. Pero estaban ocultos **a propósito**, leyendo CU022 como que su
acceso era "derivado desde el CU021". Conviene que quede por escrito.

**S4. Textos del Inicio (D58) — queda UNO.**
Dos eran errores del front y están corregidos. De los otros tres, el backend
localizó dos en la biblia: *"Tienes N registros offline pendientes de
sincronizar."* está literal en CU010 y el de la actividad abierta en CU009 (ver
S11). **Solo falta el tooltip del botón "Iniciar actividad" deshabilitado**:
CU010 pide que se muestre deshabilitado y no oculto, pero no da texto.

**S11. El literal de "ya hay una actividad abierta" — ✅ RESUELTO**
**Respuesta del backend (28/10/2026):** está en CU009, "Intento de iniciar una
segunda actividad simultánea": **"Debes finalizar la actividad actual antes de
iniciar una nueva."** Es el mismo `detail` que manda con
`actividad_activa_existente`. Ya fijado en el front.

<details><summary>El planteamiento original</summary>

El contrato publica el motivo (`actividad_activa_existente`) pero no su texto.
El front usa el `detail` del servidor cuando llega y, si no, su propio
respaldo.

</details>

**S20 (D88) — ✅ DECISIÓN PROVISIONAL DP-1 (backend, Tanda M, `34c6191`).**
R1 no cambia: octubre sigue asociado al PA3. Pero lo puede evaluar cualquier
Docente con habilitación en cualquiera de los PA con días lectivos en el mes
(PA3 o PA4), y octubre figura vencido el 01/11. El front lo refleja también
sin conexión: con red obedece `escritura.permitida` de `GET /rubricas`, y sin
red usa el bloque `escritura` de la copia guardada, que ya viene calculado con
DP-1 (el cliente no recalcula el PA del mes; el servidor revalida al
sincronizar). **Pendiente de validar con el analista después de la
exposición.**

*Planteamiento original:* lo abrió la ronda 6 y es **del analista y del
backend**, no del front. Por la
regla R1 —el mes pertenece al PA con más días lectivos— octubre cae en el
**PA3**. Consecuencia: un Docente con asignación solo en el PA4 **no puede**
evaluar la rúbrica de octubre sin un permiso excepcional, y esas rúbricas
**nunca figuran como vencidas**, así que tampoco aparecen en el resumen que
debería reclamarlas. El front solo pinta lo que llega: no hay nada que
arreglar aquí hasta que la regla se decida.

**S21 — ✅ DECISIÓN PROVISIONAL DP-2 (backend, Tanda M, `34c6191`).**
Durante el receso, los vencidos e incompletos del Inicio se calculan sobre el
PA que se regulariza; ya no caen a 0 el 19/12. Incumplimiento de Sede no
cambia. Misma forma de respuesta: el front no cambia. **Pendiente de validar
con el analista.**

*Planteamiento original:* los vencidos desaparecen al empezar el PR.
De la ronda 6 (CP-INI-29): al pasar del 18/12 al 19/12, los vencidos de
Asistencias, Lectura y Rúbrica del PA4 pasan de **60, 70 y 68 a 0**. Es
coherente con que el PA terminó, pero el receso es justo cuando se
regulariza: si lo pendiente deja de verse, nadie sabe qué regularizar.
**¿Deben seguir visibles durante el PR?** Es una decisión de CU011, no del
front.

**S22 — sin cambio.** Se mantiene el comportamiento actual hasta que decida
el analista.

*Planteamiento:* un alumno que cambia de grupo a mitad de mes.
También de la ronda 6: un alumno evaluado en un grupo **no aparece en el
grupo nuevo** dentro del mismo mes, así que el aviso que CU030 prevé para
ese caso solo se puede ver por la API, nunca en pantalla. Hay que decidir si
el alumno debe salir en el grupo nuevo (y con qué evaluación) o si el aviso
sobra.

**D100 y D101 — ✅ resueltos en el backend (Tanda M, `34c6191`):** las
clases adicionales cuentan en el % de asistencia del alumno (misma forma, el
front no cambia), y Lectura responde `422 sin_alumnos` con el mensaje de
CU024 cuando la semana tiene clase pero el grupo no tenía alumnos en esa
fecha. El front decide por `motivo` y muestra el `detail` como estado del
bloque, sin "Crear tabla" (`5ab840c`).

## Lo que falta del BACKEND

**S5. `GET /calendarios` necesita devolver `periodo_actual`. — ✅ RESUELTO**
**Respuesta del backend (28/10/2026):** Ya llega `periodo_actual` en `GET /calendarios`. El front ya lo pinta.
CU027 pide mostrar junto a los filtros el periodo de hoy con sus fechas
completas. El front ya lo pinta leyendo `calendario.periodo_actual`
(`tipo`, `numero`, `fecha_inicio`, `fecha_fin`), y la tanda C lo nombra, pero
**hay que confirmar que la respuesta real lo trae**. Si no, el front tendría que
deducirlo de las ocho filas, que es peor sitio para esa regla: la decide el
calendario del colegio y la hora oficial del Perú, no el reloj del navegador.

**S6. ¿`POST /colegios/{id}/clases/reprogramaciones` devuelve el `id_clase`? — ✅ RESUELTO**
**Respuesta del backend (28/10/2026):** El `POST` de reprogramación responde **201 con un `ClaseItem`** y crea la fila si no existía.
"Ver reprogramación" consulta `GET /clases/{id}/reprogramaciones`, así que la
tabla necesita el identificador de la clase para poder abrir su historial. Hoy
el front lo toma de `items[].id_clase`, que llega `null` mientras la clase no
tiene fila. Para una clase **habitual sin asistencias que se reprograma**, hace
falta que la respuesta del POST traiga el `id_clase` creado.

**S7. "Clases candidatas" para "Cambiar clase" (CU024). — ✅ RESUELTO**
**Respuesta del backend (28/10/2026):** Sin cambios: `GET /colegios/{id}/clases` admite al Docente, y su alcance **incluye las aulas de sus permisos vigentes**.
La tanda B dice expresamente que **no se creó** ese endpoint y que el front use
`GET /colegios/{id}/clases` con el rango de la semana. Queda anotado porque es
una llamada de Colegios usada desde Lectura: si algún día se restringe por rol,
el Docente dejaría de poder cambiar la clase de referencia.

**S9. ¿Cómo se llama la fecha de creación del alumno? — ✅ RESUELTO**
**Respuesta del backend (28/10/2026):** Se llama **`fecha_registro`**. Ya corregido en el front.
D65 pide proponer "la fecha de creación" y el contrato publicado de
`GET /alumnos/{id}` no trae ningún campo con ella. El front acepta `creado_en`,
`fecha_creacion` y `creado`, y si no llega ninguno deja el campo vacío para que
lo elija la persona —proponer hoy inventaría un historial que no ocurrió—.
**Hace falta que el backend publique ese campo** y diga su nombre.

**S10. "Colegio Colegio de Prueba" en la alerta de CU011 es del BACKEND.**
La alerta llega ya redactada (`{tipo, mensaje, critica}`) y el front la pinta
tal cual, como pide CU011. El texto del servidor antepone "Colegio " al nombre
("Incumplimiento de Sede - Colegio Shilla: …"), y con un colegio que se llama
"Colegio de Prueba" sale el nombre repetido. **No se arregla en el front**:
recortar un prefijo aquí convertiría "Colegio Andino" en "Andino" el día que
exista un colegio con ese nombre de verdad.

**S13. No hay endpoint de "clases candidatas" para "Cambiar clase". — ✅ RESUELTO**
**Respuesta del backend (28/10/2026):** Mismo que S7: no se va a restringir.
Ya anotado en S7 y ahora en uso: el modal pide
`GET /colegios/{id}/clases?desde=<lunes>&hasta=<viernes>`, que es una llamada
de **Colegios** hecha desde Lectura. Si algún día se restringe por rol, el
Docente dejará de poder cambiar la clase de referencia.

**S15. La forma completa de `GET /alumnos/{id}/historial` no está publicada. — ✅ RESUELTO**
**Respuesta del backend (28/10/2026):** Publicada, con una corrección importante: **`accion` es un CÓDIGO** (`crear`/`editar`/`activar`/`inactivar`), no una frase. Ya traducido en el front.
La pestaña **Historial** de la ficha del alumno (CU015, D64) ya está hecha y
pinta el formato que pide el caso de uso —"[Nombre] (Rol) editó al alumno el
DD/MM/AAAA a las HH:MM" y una línea por campo, "Grado: 1.º → 2.º"—. Pero el
contrato solo documenta el **añadido** de la semana 11 (que los eventos de
crear, editar el grupo, activar e inactivar traen además
`{"campo": "Fecha efectiva", "anterior": null, "nuevo": "21/10/2026"}`), no la
forma base. El front asume un paginado de 40 con
`{fecha, usuario, rol, accion, cambios: [{campo, anterior, nuevo}]}` y que
**`accion` llega ya redactada** ("creó", "editó", "inactivó"): no se traduce en
el cliente, para no inventar un vocabulario paralelo al del servidor.
**Hace falta confirmar esos cuatro campos y los valores de `accion`.**

**S16. Los permisos de `GET /me/habilitaciones` no traen NOMBRES. — ✅ RESUELTO**
**Respuesta del backend (28/10/2026):** Hecho en la **Tanda I**: los permisos traen `colegio` y `grado` con nombre. Ya consumido.
Es lo que impide resolver D56 del todo sin conexión. El aula de un permiso
vigente ya se puede elegir en los filtros de los módulos operativos, pero el
nombre del colegio y del grado se leen de `permisos_vigentes` de
`GET /inicio/docente`, que **exige conexión**. El paquete offline
(`GET /me/habilitaciones`) trae los permisos solo con `id_colegio` e
`id_grado`, así que sin red el desplegable no tendría cómo escribir el nombre
del colegio del permiso. **Si `permisos[]` llevara `colegio: {id, nombre}` y
`grado: {id, nombre}`**, el filtro funcionaría igual sin conexión, que es
justo cuando el Docente de Yungay lo necesita.

**S17. ¿Qué calendarios trae `GET /me/habilitaciones`? — ✅ RESUELTO**
**Respuesta del backend (28/10/2026):** Cubre los dos casos: trae el calendario de cada colegio con habilitación utilizable ahora o más adelante, permisos incluidos.
Viene del plan de la semana 11 y **sigue sin respuesta**. El contrato dice
`calendarios: [{id_colegio, …}]` sin precisar el criterio: ¿son los de TODOS
los colegios del Docente, o solo los de su asignación vigente?

No es teórico. Sin conexión, el periodo de una fecha se deduce del calendario
de **ese** colegio; si falta, la respuesta es `sin_calendario` y **no se puede
escribir**. Hacen falta dos casos que la asignación vigente no cubre:

- Regularizar el **PA anterior durante un receso**, cuando la asignación
  vigente es de otro colegio.
- Escribir en el aula de un **permiso excepcional** (CU028), que por
  definición es un colegio donde el Docente **no** tiene asignación.

El segundo caso es el mismo agujero que **S16** por otro lado: sin el
calendario de ese colegio, el permiso no sirve sin conexión aunque el aula sí
aparezca en el filtro. Lo que el front necesita es que el paquete traiga el
calendario de **todo colegio al que el Docente pueda escribir**, por
asignación o por permiso.

**S18. ¿Un endpoint de LOTE para otorgar permisos? (CU028) — ✅ RESUELTO**
**Respuesta del backend (28/10/2026):** Hecho en la **Tanda I**: `POST /usuarios/{id}/permisos/lote`, todo o nada. Pendiente de que el analista actualice CU028 antes de usarlo.
Sale de `docs/propuesta-otorgar-permisos.md`, **confirmada por el equipo el
28/10/2026**. Otorgar tres permisos al mismo Docente obliga hoy a abrir el
modal tres veces. Se quiere pedirlos juntos —varios grados × varios
módulos— **creando un permiso por combinación**, que es lo que CU028 exige
("cada permiso autoriza un solo módulo").

El front puede mandar N peticiones a `POST /usuarios/{id}/permisos` sin que
el backend toque nada, pero entonces aparece el caso feo: **tres salen y la
cuarta choca** con un permiso que se superpone. El Supervisor queda con un
estado a medias que no pidió, y un permiso **no se borra, se revoca**.

**Lo que se pide:** `POST /usuarios/{id}/permisos/lote`, **todo o nada**.
Cuerpo: el alcance común (`id_anio_escolar`, `id_colegio`,
`id_periodo_academico`, `desde_ahora`/`inicio`, `fin`, `motivo`) más
`combinaciones: [{id_grado, modulo}, …]`. Respuesta: los permisos creados,
o un 409/422 **sin crear ninguno**, diciendo qué combinación falló y por
qué. Si no se hace, decidlo y el front manda N peticiones asumiendo el
resultado parcial.

**S19. ¿`asignacion.colegios[].periodos[]` trae el `id_periodo_academico`? — ✅ RESUELTO**
**Respuesta del backend (28/10/2026):** Ya viene, con el nombre **`id_periodo`** (no `id_periodo_academico`).
De la misma propuesta. El modal va a marcar en el desplegable **cuáles son
los colegios y grados del Docente**, sin ocultar los demás —CU028 prohíbe
filtrarlos, porque el Supervisor puede autorizarlo para sustituir a otro—.

El matiz: "asignado" no es una sola cosa. Un Docente puede estar asignado
**hoy** y no haberlo estado **en el PA que se va a corregir**, que es el que
importa. Con el `id_periodo_academico` en cada periodo de la asignación, el
front puede decir *"asignado en PA3"*; sin él solo puede decir *"asignado
actualmente"*, que es verdad pero no es lo que se pregunta.

**S23. La forma de las respuestas de `/dashboard/*`. — ✅ RESUELTO**
**Resuelto en el front (29/10/2026):** el front se alineó con el contrato real
del backend: adaptadores en `dashboard.js`, mocks con la forma real y prueba de
contrato. El backend no cambió.

- La fuente de verdad es `BCK-SICEDU/app/schemas/dashboard.py`. Casi todos los
  bloques leían nombres que el backend no manda (`cantidad` por `alumnos`,
  `programas[].dimensiones[]` por `subprogramas[].distribuciones[]`, `grupos`
  por `ranking`, `colegios` por `por_colegio`, `items` por `grupos` o
  `registros`, `id_colegio` por `id`...), y las pruebas no lo veían porque el
  simulador devolvía las mismas formas supuestas.
- Cada función de `src/api/resources/dashboard.js` pasa la respuesta por un
  `adaptarX` exportado, que la deja en la forma que lee su pantalla sin
  convertir `null` en 0 y sin perder lo que la pantalla no lee (`contexto`,
  `mensaje`, `fuente`...). En evolución anual, `anios[].colegios` es una lista
  y el número es `colegios_atendidos`: el adaptador no deja ningún `colegios`
  que se pueda leer como número.
- `src/api/mock/dashboard.js` devuelve la forma exacta de los modelos, y pasa
  por el mismo adaptador. `src/api/resources/__tests__/dashboard.contrato.test.js`
  prueba cada adaptador con un ejemplo completo del schema y compara los
  campos del simulador con los de los modelos.
- De paso, tres llamadas que daban 422: `libros/colegios/{id}` y
  `libros/desglose` no mandaban la selección de colegios, y
  `asistencia/clases` mandaba el colegio como `id_colegios` en vez de
  `id_colegio` junto a la selección.

<details><summary>El planteamiento original</summary>

Lo abrió el Dashboard, el 29/10/2026, y era **del backend**.

El contrato que tenemos (`cambiosFront_semana12_v1.md`, sección "Dashboard")
publica lo importante para construir: qué endpoint alimenta cada bloque, qué
filtros admite cada uno —y cuáles son un 422—, los estados que la pantalla
tiene que distinguir (`sin_informacion`, `futuro`, `en_curso`, `parcial`,
`provisional`, `no_aplica`, `posicion: null`) y los errores con su `motivo`.
Con eso se pudo escribir todo. Lo que **no** trae es el JSON campo por campo:
eso vive en `BCK-SICEDU/API.md`, que no está en este repositorio.

Así que el front está escrito contra los nombres que el contrato **sí** nombra,
y tolerando que falte un campo —un `null` se pinta como "Sin información", que
es justo lo que piden los CU—. Pero hay sitios donde se asumió una
**estructura**, y ahí un nombre distinto significa una tabla vacía:

| Bloque | Lo que el front espera |
|---|---|
| `/dashboard/filtros` | `colegios[]`, `anios[]` con sus `periodos[]`, y `seleccion_inicial` (o `null`) |
| distribución | `total`, `subprogramas[]` con `cantidad` y `porcentaje`, `fechas_corte[]`, `colegios_sin_informacion[]` |
| resultados | `programas[]` → `dimensiones[]` (global, fluidez, comprensión) con `a_evaluar`, `evaluados`, `pendientes` y `niveles[]` |
| comparación de resultados | `grupos[]` con `indice` y `posicion`, más `sin_evaluaciones[]` y `no_aplica[]` **aparte** |
| asistencia | `resumen`, `mensual[]` y `colegios[]`, con `clases_dictadas`, `clases_registro_incompleto` y `clases_sin_registro` |
| detalle de clases | `items[]` con `fecha`, `grado`, `seccion`, `alumnos`, `sin_marcar` y el estado `sin_registro` |
| libros | `resumen`, `meses[]` con **su `anio`**, `colegios[]` con sus `meses[]`, y `sin_informacion[]` aparte |
| detalle de un colegio | `grados[]` con `alumnos[]`, y cada alumno con sus `meses[]` |
| desglose | `items[]` con `id_lectura_semanal`, `clase`, `libros_subir_nivel`, `libros_seleccion_libre` y `no_realizada` |
| evolución anual | `anios[]` con `alumnos`, `colegios`, `libros` y `parcial` |
| comparación entre colegios | `colegios[]` con `valor` y `posicion`, `sin_informacion[]` y el `mensaje` ya redactado |

**Lo que se pide:** que el backend confirme o corrija esos nombres —o pase la
sección de `API.md` del Dashboard— antes de probar contra el servidor real. Si
alguno cambia, el ajuste es de una línea por campo y vive en
`src/api/resources/dashboard.js`, que es el único archivo que toca la respuesta
cruda.

**Dos cosas que el contrato ya resolvió y conviene no volver a preguntar:** el
resumen anual de CU035 **no tiene endpoint propio** (es el año seleccionado de
`/dashboard/evolucion-anual` más el `resumen` de `/dashboard/libros`), y el
`promedio_libros` de la comparación entre colegios es **anual**: mandarle un
periodo académico es un 422.

</details>

## Fuera de alcance

- **Modo offline de Supervisor y Directivo.** Se comentó quitarlo por no usarse
  en la práctica, pero CU011 y CU012 lo desarrollan con flujo alternativo
  propio, Service Worker, copia en `localStorage` y literales por rol. Está
  construido, funciona y no estorba: se queda.
- **El aviso de pendientes del Docente.** Ya existe y cumple CU010.

## Versión para la ronda 7

- **Frontend:** `development` en el commit final de la ronda 6, segunda parte
  (ver la tabla "Ronda 6 (segunda parte)" de `docs/plan-semana12-front.md`).
- **Backend:** `development` en `34c6191` ("Tanda M: decisiones provisionales
  documentadas, API.md y Sonar") o posterior.
