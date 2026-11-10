# Decisiones externas y pendientes de backend · frontend SICEDU

**Para:** **analistas** (lo que necesita decisión de caso de uso) y **backend**
(lo que falta publicar o corregir del lado del servidor).
**Actualizado:** 05/11/2026, con la **ronda 7** del tester (Tanda F1 del
front, al final) y las **tandas O y P** del backend (`b769e05` y `8bc66d7`).
Antes: 29/10/2026, con las tandas I, L y **M**, las dos partes de la
**ronda 6** y el **Dashboard** (CU033 a CU035).

> ## Del backend no queda nada bloqueante
>
> Lo único que sigue pedido es una mejora sin defecto detrás: que
> `totales.ciclos` de `GET /inicio/docente` venga completo (**S29**; el front
> ya une los dos orígenes). D110 (compartido) y D116 de la ronda 7 los cerró
> la **Tanda P** del backend junto con la Tanda F1 del front.
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
| [3. Sprint de la semana 12](#anexo-el-sprint-de-la-semana-12-s1-a-s26) | S1 a S26: lo que se decidió sobre la marcha, lo que falta del servidor y lo que abrieron la ronda 6 y el Dashboard | Analista y backend |

**Lo que queda.** Los siete son de Carlos (analista): los cinco primeros
venían del sprint y los dos siguientes los abrió la **ronda 6** del tester.
Del backend no queda nada bloqueante (S23 se resolvió en el front, la
Tanda M cerró D100 y D101, y solo sigue pedida la mejora de S29):

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
el commit del **front** `59eb6a9`, y la Fase 8 de `docs/plan-semana12-front.md` cuenta qué
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
# Anexo: el sprint de la semana 12 (S1 a S26)

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

**S24. Los nombres del Seguimiento: ¿qué campos manda `GET /seguimiento/docentes`?**
Lo abrió el 03/11/2026 un hallazgo de Antonio: la tabla del Supervisor salía
con **tres filas sin nombre y sin colegios**, solo con el botón "Ver detalle".

En el simulador era un descuido nuestro y ya está corregido (partía un campo
`nombre` que no existe). **Contra el servidor real no se ha podido comprobar**,
porque hace falta el backend levantado con docentes de prueba.

El front ahora acepta las tres formas antes de rendirse —`nombres` +
`apellidos`, `nombre_completo` o `nombre`— y, si no llega ninguna, escribe "Sin
nombre registrado" en vez de dejar la celda vacía. Así una respuesta con otro
nombre de campo se nota, pero no deja la pantalla muda.

**Lo que se pide:** confirmar qué trae cada fila de `GET /seguimiento/docentes`
—en concreto el nombre y `colegios[]`— para quitar el respaldo y quedarnos con
el campo bueno. Si la tabla sigue saliendo sin nombres contra el servidor real,
es esto y no el front.

**S25. El 404 de `GET /lectura/tablas` tiene que traer `clase_referencia_sugerida`.**
De la misma tanda de hallazgos, y es lo que permite que la pantalla **se
adelante al error**.

CU024 exige que la clase de referencia sea lectiva y **no futura**. Cuando el
Docente entra a una semana en curso cuya clase es, por ejemplo, el viernes,
pulsar "Crear la tabla" el jueves termina en "La clase de referencia todavía no
se ha realizado": el botón prometía algo imposible. Ahora el front compara la
fecha **con el reloj del servidor** y lo dice antes de pulsar.

Eso solo funciona si el 404 `tabla_no_existe` sigue trayendo
`clase_referencia_sugerida: {id_clase, fecha, tipo, reprogramada}`. Si algún día
deja de venir, el front vuelve a no saber la fecha y el aviso desaparece —no
rompe nada, pero se pierde—. **Queda anotado como algo que no se puede quitar
del contrato sin avisar.**

**S26. ¿Qué periodos devuelve `GET /permisos/opciones`?**
El desplegable "Periodo académico" de "Otorgar permiso" solo ofrecía PA1 y PA2.
En el simulador era un corte fijo (`numero < 3`) y ya está corregido por fecha.

**La regla que aplica el front es la que dice el propio modal**: aparecen los
periodos cuyo **plazo ordinario ya terminó**, porque los que siguen en curso
admiten regularización por la vía normal y no necesitan permiso. Hoy, 3 de
noviembre, eso son PA1, PA2 y **PA3** —cerrado el 31 de octubre—.

**Lo que se pide:** confirmar que el servidor aplica esa misma regla. Si contra
el backend real el PA3 sigue sin aparecer, el Supervisor no puede otorgar un
permiso para regularizarlo y CU028 se queda sin su caso principal; y entonces el
arreglo es del servidor, no de la pantalla.

## Verificación del 04/11/2026 contra el servidor real

El entorno de Antonio ya tenía `VITE_ADMIN_REAL=true`, así que Seguimiento,
Otorgar Permiso, Registro de Vuelo y Seguimiento de Lectura llevan un día
probándose contra el **servidor real**, no el simulador. Eso resuelve tres de
las dudas de arriba y abre dos más.

**S24 — resuelto.** `GET /seguimiento/docentes` ya manda `nombres` y
`apellidos`: la tabla del Supervisor sale con los cinco docentes con su
nombre y colegio, sin ninguna fila en blanco.

**S26 — resuelto, con un matiz.** El desplegable de "Otorgar permiso" ya
ofrece PA1, PA2 y PA3. **No ofrece PA4, y eso es correcto, no un defecto**:
PA4 corre del 09/11 al 30/11 — todavía no empieza —, así que no tiene plazo
ordinario vencido y no necesita un permiso excepcional. Si un Supervisor
pregunta por qué no está, esta es la razón.

**S25 — resuelto en la práctica.** Antonio reprogramó una clase de
referencia futura a una fecha pasada y Seguimiento de Lectura lo aceptó: el
404 `tabla_no_existe` sigue trayendo `clase_referencia_sugerida`.

**S27 (nuevo). Registro de Vuelo: "Sugerencia" vacía y el aviso
`alumno_fuera_del_grupo`, los dos son del servidor, no del front.**
Dos cosas que parecían raras mirando la pantalla, y las dos son el contrato
funcionando como se diseñó:

- **"Pendiente de evaluar" en Sugerencia** sale cuando el alumno todavía no
  tiene una rúbrica mensual completa en ese PA de la que sacar una
  sugerencia — lo dice el propio contrato: *"Sin rúbrica completa o sin
  entrada no hay sugerencia. Inventar una sería dar por buena una decisión
  que no se tomó."* En un PA4 recién empezado (19/10), es lo esperable.
- **"Cueva KEKE · PA1: El estudiante no pertenecía a este grupo en el
  periodo seleccionado"** es el aviso `alumno_fuera_del_grupo` del
  contrato, tal cual — el front no inventa el texto, lo copia de
  `MOTIVO_VUELO`. Si Cueva KEKE sí perteneció a ese grupo en PA1, es un dato
  de matrícula a corregir en el servidor, no una pantalla que corregir aquí.

**Lo que se pide:** si alguno de los dos avisos no debería salir, revisar en
el servidor los datos de matrícula o de rúbrica del alumno en cuestión. Los
dos mensajes son literales del contrato, así que no es un error de
interpretación del front.

> **RESUELTO por la Tanda N del backend** (`cambiosFront_semana13_v1.md`).
> No era ni un dato mal cargado ni una pantalla rota: faltaba el campo para
> saberlo **antes** de pulsar. `GET /registro-vuelo` ahora manda
> `items[].periodos[].pertenece`, y la pantalla lo respeta — ver abajo.

**S27b. Lo que hace ahora la pantalla con `pertenece` (Tanda N).**
La fila de un alumno que no estaba en el grupo ese PA va **deshabilitada**:
nivel colocado, proyección y observación en solo lectura, y el `aviso` del
servidor pintado tal como llega.

Tres decisiones que conviene dejar escritas, porque son las que se romperían
sin querer:

- **Se decide por el campo `pertenece`, nunca comparando el texto del aviso.**
  Un mensaje se reescribe cualquier día; quien compare textos se entera
  cuando el Docente ya perdió el trabajo. Hay una prueba que fija justo el
  caso raro: el PA sin fechas en el calendario del colegio llega con
  `pertenece: false` y `aviso: null`, y la celda **igual** se bloquea.
- **Se suma a `escritura`, no la sustituye.** `periodos[].escritura` decide
  si el PA se puede escribir para todo el grupo; `pertenece` decide si esta
  fila entra en ese PA. Tienen que valer las dos.
- **El aviso no se arma en el front.** El servidor manda uno solo, ya
  elegido, y si hay dos motivos a la vez —entrada cambiada y no
  pertenencia— decide él cuál pesa. La pantalla pinta el que llegue.

`incompleto` no hacía falta tocarlo: el front **nunca** lo usaba para contar
nada, así que el punto 3 de la tanda ya se cumplía por omisión.

**Lo que esto arregla en Seguimiento:** el Docente deja de generar rechazos
`alumno_fuera_del_grupo` desde la pantalla, que es lo que lo dejaba en
"Error" en CU020 sin haber hecho nada mal. Los rechazos **ya existentes**
siguen contando hasta que los descarte: no se borran solos. Es decir, S28
deja de alimentarse, pero no se limpia solo.

**S28 (nuevo). Seguimiento del Supervisor: la columna "Sincronización" en
Error para tres docentes — es dato real, no un bug de pantalla.**
Antonio lo reportó como posible defecto del front. **No lo es**: `error` es
uno de los cuatro estados reales que manda `GET /seguimiento/docentes`
(junto con `al_dia`, `pendiente`, `sin_informacion`), y su significado en el
contrato es *"Un envío fue rechazado y necesita revisión"* — el mismo texto
que ya aparece al pasar el cursor sobre la etiqueta.

Los tres docentes en Error ("Antonio TEST 5", "Docente de Prueba" y "Paris
Herrera") son cuentas de prueba. Entrando al detalle de Antonio TEST 5 se ve
exactamente eso: algunas de sus sesiones en **Sesiones** están en rojo con
"Error" y otras en verde con "Sincronizada" — la tabla de Seguimiento
resume bien lo que ya se ve ahí abajo.

**Lo que se pide:** si esas tres cuentas no deberían tener envíos
rechazados, revisar en el servidor qué operación concreta rechazó cada una.
No es algo que el front deba "corregir" sin ocultar un aviso real — hacerlo
escondería sincronizaciones rotas de verdad.

**S29 (nuevo, y este sí era del front — D108). Inicio del Docente: faltaba
un ciclo en "Mis asignaciones".**
Antonio encontró un Docente con alumnos de 1.º, 4.º y 5.° grado, y la
tarjeta decía **"Ciclos: III, V"** — sin el IV del 4.º grado, que sí tenía
un alumno (Advíncula KEKE) en la tabla de Alumnos, dos pantallas más abajo.

La causa estaba en el front, no en el servidor: `GET /inicio/docente` manda
`totales.ciclos` como un resumen ya armado, y por separado cada grado de
`asignaciones` trae también su propio `ciclos`. El código prefería
`totales.ciclos` con `??`, así que si ese resumen llegaba **presente pero
incompleto** —el caso de hoy—, tapaba el ciclo que sí estaba bien en el
grado de 4.º en vez de completarse con él. **Ya corregido:** ahora se unen
los dos orígenes en vez de elegir uno, con su prueba de regresión.

**Lo que se pide:** de todos modos conviene que `totales.ciclos` en
`GET /inicio/docente` incluya siempre los ciclos de los seis grados
asignados — el front ya no se cae si falta alguno, pero un resumen
incompleto en el propio endpoint sigue siendo un dato a revisar.

**S30 (nuevo). El año escolar "vigente" tiene que cubrir el receso posterior
al PA4, aunque se pase al siguiente año de calendario.**
Sale de la actualización de los CU del 04/11. CU027 dice que, al entrar al
calendario sin una selección anterior, se propone **el año escolar cuyo
calendario contiene hoy dentro de un PA o un PR**, y pone el ejemplo
incómodo a propósito: *"si en enero de 2027 continúa el receso posterior a
PA4 de 2026, selecciona 2026"*.

El front ya no calcula eso —no tiene los calendarios de todos los años a
mano—: **se fía de la marca `vigente` de `GET /anios-escolares`**, y si
ninguno la trae deja el filtro sin selección, como pide el CU.

Hoy el servidor la calcula como `fecha_inicio <= hoy <= fecha_fin` del propio
año escolar (`app/routers/catalogos.py`). Eso da el resultado correcto
**siempre que la `fecha_fin` del año escolar llegue hasta el final de su PR4**
y no se corte el 31 de diciembre. Si se cortara, en enero ningún año saldría
vigente y el Supervisor encontraría el filtro vacío en vez de "2026".

> **CONFIRMADO por el backend el 04/11.** `fecha_fin` del año escolar es el
> fin del PR4 del calendario general y **se recalcula cada vez que se edita**,
> así que en enero, durante el PR4, 2026 sigue vigente.
>
> El propio backend avisó de dos casos en que NO habrá ningún año vigente, y
> los dos están cubiertos: en **vacaciones** —entre el fin del PR4 y el PA1
> siguiente— y cuando un colegio tiene un calendario particular cuyo PR4
> termina **después** del general. En ambos el filtro se queda sin selección
> y la pantalla pide elegir, en vez de proponer un año por aproximación.

**S31 (nuevo). Decisiones de pantalla tomadas por el front el 04/11, para
que el analista las recoja en los CU.**
Antonio pidió cerrar los huecos restantes con criterio propio aunque no
estuvieran escritos, y documentarlos aquí para incorporarlos después. Son
estos, y ninguno cambia una regla: solo texto y una columna.

**a) "estudiante" ya no se usa en pantalla.** El documento actualizado no
dice "estudiante" **ni una sola vez** —443 veces "alumno"—, pero el código
aún lo decía en tres sitios visibles. Ahora dicen "alumno": la tarjeta del
Inicio del Docente (**"Mis alumnos"**), el aviso sin conexión de
mantenimiento (**"…para gestionar alumnos."**) y el título de la ficha
(**"Ficha del alumno"**). La RUTA sigue siendo `/estudiantes/:id`: cambiarla
rompería los enlaces ya guardados y no la ve nadie.

**b) Las columnas de la bitácora, con el nombre que les da el CU.** En
Sesiones (CU017) y en el detalle del Supervisor (CU021):

| Antes | Ahora | Por qué |
|---|---|---|
| Inicio / Fin | **Hora de inicio** / **Hora de finalización** | Desde U15 esas celdas traen SOLO la hora; "Inicio" a secas se leía como una fecha |
| Cambios | **Cantidad de cambios** | Es el nombre del CU |
| Estado | **Estado de la actividad** | Está al lado de la columna de sincronización: dos "Estado" seguidos no se distinguen |
| Sincronización | **Estado de sincronización** | Lo mismo, por el otro lado |

**Una desviación deliberada:** el CU llama a la última columna "Tipo de
cierre de la actividad" y se queda en **"Tipo de cierre"**. En una tabla de
actividades, "de la actividad" no añade significado y sí anchura, y esa
columna ya es la más ancha —sus valores son del tipo "Manual por
finalización de actividad"—. Si el analista prefiere el nombre largo, se
cambia en una línea.

**c) Falta(ba) una columna en CU021: "Estado de la actividad".** El detalle
del Supervisor no la tenía. Importa para quien audita: que una jornada siga
**En curso** cambia lo que está viendo, porque lo que falte todavía puede
aparecer, y un "Sin registros" no significa lo mismo en una jornada abierta
que en una cerrada.

**d) El texto del adelanto de semana, tuteado.** El simulador respondía
*"…Seleccione la semana actual o una anterior."* Es un mensaje **del
servidor**, y la Tanda O lo cambia a "Selecciona": el simulador se adelanta
para que las dos fuentes digan lo mismo. **Nada que hacer en el backend**,
ya está en su lista.

> **Confirmado por la Tanda O (`b769e05`).** El "adelanto" ya es la regla
> definitiva, no una anticipación. De paso se sincronizaron contra el mismo
> texto del backend los cinco mensajes "estudiante" → "alumno" que faltaban
> fuera de este (sin alumnos en Lectura; alumno fuera de la tabla, dos veces,
> en Lectura; fuera del grupo, en Rúbrica y en Registro de Vuelo), tanto en
> el simulador como en los textos de respaldo (`MOTIVO_*`) de cada recurso.

**e) De dónde viene la Entrada de Registro de Vuelo, sin cursor (CU031).**
El texto vivía solo en un `title` de hover: en un teléfono no existe y con
teclado tampoco. Ahora va en un botón con el tooltip de la casa, que abre
con cursor, foco y toque. Cuando no hay nivel, el motivo ya se lee a secas
en la celda y no se añade el botón.

**f) El rol que deja de permitir la consulta (CU033, CU034, CU035).** Las
pantallas del Dashboard y del consolidado retiran lo que muestran y dicen
*"Tu rol actual no permite consultar este dashboard."* / *"…este
consolidado."* **Importante para el analista:** por la ruta no se llega a
ese mensaje —la guarda manda a `/403`, que ya explica el motivo con el
nombre del rol y ofrece volver—. Lo añadido es la red de seguridad para el
caso que describen los CU: perder el rol con la pantalla ya abierta. Si se
quiere que ese mensaje sustituya a `/403`, es un cambio en la guarda del
enrutador y afecta a toda la aplicación: queda fuera de esto.

**g) El aviso de actividad ya no repite el botón.** U24 le había puesto uno
propio porque el de "Iniciar actividad" había que buscarlo arriba a la
derecha. Pero ese botón **no se esconde nunca** —`BarraActividades` lo deja
fijo en la barra superior—, así que quedaban dos botones idénticos a dos
dedos de distancia y el de abajo empujaba el texto del aviso. Un control
repetido no es más fácil de encontrar: invita a preguntarse en qué se
diferencian. **Esto revierte U24 de la auditoría de UX #737**, y conviene que
lo sepa quien la escribió.

**h) El "Tipo de cierre" se lee en una palabra.** La columna mostraba
"Manual por finalización de actividad" en tres líneas y en casi todas las
filas: una columna donde todo se lee igual deja de ayudar a encontrar la fila
distinta, que es a lo que se viene en una bitácora. Ahora muestra **Manual**,
**Forzado** o **Automático** —lo que de verdad las separa es quién cerró la
actividad: el docente, la salida o el reloj— y el motivo completo sigue a un
toque en el tooltip y entero en "Ver detalle". Vale para CU017 y CU021, con
el mismo componente, y entiende tanto los códigos futuros como el texto
completo que manda hoy el servidor.

**i) Sesiones ya no tiene columna "Estado de la actividad".** La decidió
Antonio y los analistas la recogen en el CU. El motivo: **la hora de
finalización ya lo dice**. Una fila con hora está terminada y una sin ella
sigue abierta, así que el badge solo confirmaba el dato de la celda de al
lado y gastaba el ancho que necesitaban las demás columnas.

Lo que sí cambia es la celda vacía: antes un guion, que se lee como "falta
el dato", y ahora **"En curso"**, que es lo que de verdad pasa. El guion se
queda solo en "Tipo de cierre", donde sí corresponde: una actividad abierta
no se ha cerrado de ninguna manera.

Dos cosas que NO se tocaron: el filtro "Estado" de la barra superior
—filtrar por algo no obliga a darle una columna— y el estado completo en
"Ver detalle".

**Y se aplicó también a CU021**, el detalle del Supervisor, aunque Antonio
habló solo de Sesiones: ahí la columna la había añadido yo el 04/11 y tiene
exactamente la misma redundancia. Dejarla habría hecho que las dos tablas de
la misma información se leyeran distinto. Si el analista prefiere
conservarla en CU021, se repone en una línea.

**Lo que se comprobó y NO se tocó, a propósito:** "autorización" y
"habilitación" no son sinónimos en el CU —una es de consulta y otra de
escritura— y el literal *"No tienes autorización vigente para registrar o
modificar este periodo."* está en el documento tal cual. El código ya lo
decía bien.

**S32 (nuevo). "Descargar gráfica" no funcionaba — era un `blob:` donde la
CSP solo permite `data:`.**
Antonio lo reportó en Asistencia y en el consolidado de libros (CU033,
CU034). El código cargaba la imagen rasterizada con
`URL.createObjectURL(new Blob(...))`, una URL `blob:`. La cabecera de
seguridad del servidor (RNF-003, `deploy/cabeceras-seguridad.conf`) declara
`img-src 'self' data:` **a propósito para esto** —el propio comentario del
archivo decía *"para exportar un gráfico a PNG... rasteriza el SVG desde una
URL data:"*—, y `blob:` es otro esquema que esa cabecera no autoriza. En
local, sin la cabecera, funcionaba; en cualquier sitio que la sirva —qa,
producción— el navegador bloqueaba la carga en silencio y el botón "no
hacía nada".

Corregido: ahora carga desde una URL `data:` (`encodeURIComponent` del SVG
serializado), como decía el comentario que ya existía. Sin cambios en el
backend ni en la cabecera — el valor de `img-src` ya estaba bien, era el
código quien no lo usaba. Esta función no tenía ninguna prueba; se le
añadieron 8, incluida una que fija específicamente que la imagen se cargue
por `data:` y nunca por `blob:`, para que esto no se repita.

De paso, el mes del borde del gráfico de líneas ("Diciembre") se recortaba
por un margen derecho insuficiente para su etiqueta — corregido con una
prueba de geometría.

Y los cuatro rediseños de espacio en blanco que pidió Antonio (la barra de
filtros del Dashboard y del consolidado de libros, la dona con su tabla en
"Distribución de alumnos", y el formulario de "Comparación de resultados"):
en los tres, la causa de fondo era la misma — un panel de casillas o chips
de alto variable compartiendo fila con controles de alto fijo, con
`items-start` y, en un caso, un botón en `size="sm"` que no coincidía con
la altura de los `Select` (`h-10`). Se separaron en dos filas donde hacía
falta, en vez de forzar la alineación con CSS.

**S33 (nuevo). Tanda O del backend (`b769e05`): implementado.**

- **Productividad y textos (puntos 1 y 2 de la Tanda O):** nada que cambiar
  en el front — "en Asistencias" ya se pintaba tal cual, y "estudiante" →
  "alumno" / "Seleccione" → "Selecciona" ya estaban aplicados en S31.
- **`GET /dashboard/libros/incompletos` (punto 3), implementado entero.**
  Antes "Información incompleta" era una palabra sin salida: decía que algo
  faltaba, no QUÉ ni DÓNDE. Ahora se abre desde dos sitios: el aviso del
  resumen (sin acotar) y cada celda "—" de un mes sin información, que lleva
  acotado a ese colegio/alumno y ese mes exactos. Vista nueva
  `DetalleLibrosIncompletos.jsx`, con las dos columnas que distinguen los
  motivos —`sin_tabla` y `filas_pendientes`, nunca confundidos por texto,
  solo por el campo— y un enlace a Seguimiento de Lectura cuando hay tabla
  que abrir.

  **El simulador es una SIMPLIFICACIÓN, documentada en su propio código**: no
  tiene una tabla semanal real por alumno, solo un total mensual, así que
  sintetiza como mucho una semana representativa por colegio, grado y mes
  incompleto (el primer lunes de ese mes), no una por cada semana real que
  falte. Sirve para ejercitar la pantalla correctamente; el conteo exacto de
  semanas no se puede comparar contra el backend real.

  **Encontrado al escribir la prueba, no es un defecto:** el badge del
  resumen (`acciones` de `BloqueLibros`) casi nunca se activa con "Todos los
  colegios" contra el simulador, porque su modelo agrega por colegio+mes, no
  por alumno: un colegio con alumnos a medias sigue sumando un total no nulo
  al agregado, así que el agregado rara vez sale "incompleto" aunque celdas
  sueltas sí lo estén. La prueba de la pantalla entra por una celda de
  alumno, que sí es determinista. El código del badge es correcto y se
  activará igual contra el servidor real.

**S34 (nuevo). "Colegios" pasa de panel siempre abierto a desplegable.**
Lo pidió Antonio, viendo que la barra de filtros del Dashboard seguía
dejando espacio en blanco. La causa de fondo: `SelectorColegios` era un
panel —casilla "Todos", buscador y lista— **siempre visible**, con una
altura que no tenía nada que ver con los 40 px de un `Select` cerrado.
Junto a "Año escolar" y "Periodo académico" eso partía la fila en dos y
dejaba el hueco del alto del panel debajo de los dos primeros.

Ahora es un desplegable: cerrado mide lo mismo que los demás controles
—"Todos los colegios" o "N de M"—, y los tres filtros más "Aplicar" caben
en una sola fila. Al pulsarlo abre el mismo contenido de siempre en un
panel flotante que no empuja nada alrededor. Cierra con **Escape** y con un
**clic fuera**, como cualquier desplegable del sistema (se reutiliza
`useOnEscape`, el mismo hook de `Modal`). Vale para las tres pantallas que
lo comparten: CU033, CU034 (incluida la herencia de filtros entre las dos)
y CU035.

Con esto, `FiltrosDashboard` vuelve a ser una fila sola en vez de dos: el
cambio del 04/11 que separaba "Colegios" a su propia fila (S31) queda
superado por este, que ataca la causa en vez de acomodar el síntoma.

**S35 (nuevo). Ronda 7 — D92, D82 y D61, del reporte del tester con
frontend `53e8588`.**

El tester avisó que D92 (Crítico), D82, D61, D75 y D52 seguían ocurriendo
pese a estar marcados como corregidos en commits anteriores. Investigados
en orden de prioridad:

- **D92 (Crítico) — Corregido de verdad, con una parte que faltaba.** La
  mitad "la cola sobrevive al cierre de sesión" ya estaba bien (verificado
  leyendo `colaOffline.js` y `AuthProvider.jsx`: por ownership de usuario,
  no por texto). La mitad que SÍ fallaba: una asistencia marcada sin
  conexión —todavía solo en la cola, sin confirmar por el servidor— no
  habilitaba la fila de Lectura, porque `useTablaLectura` solo miraba
  `fila.asistencia` del servidor. Se agregó `pendientesDeTipo` a
  `colaOffline.js` y un cruce por `claveDeMarca` en `useTablaLectura.js`
  que completa la fila con la marca pendiente y la etiqueta "(pendiente)"
  en `FilaLectura.jsx`. Con prueba nueva en `cu023Lectura.test.jsx`.
- **D82 — No es un defecto actual; el reporte está desactualizado.**
  Confirmado por ascendencia de git: el commit `e4c29d6` (D115, que mueve
  la copia del perfil de `localStorage` a IndexedDB) es posterior al
  frontend que probó el tester (`53e8588`) y ya está en `development`. Los
  8 casos de `perfilSinConexion.test.jsx` pasan contra el código actual.
  No se tocó nada.
- **D61 — Corregido: Colegios no tenía la copia local que Alumnos ya
  tenía.** Alumnos cae a `precarga.alumnos` sin conexión (`D8`); Colegios
  no tenía ese camino y, al reabrir sin red (sin nada en memoria de
  TanStack Query), se quedaba en "Sin registros" aunque el Supervisor
  tuviera los colegios precargados. Se agregó `filtrarColegios` en
  `api/resources/administracion.js` y el mismo patrón de `MantenimientoAlumnos`
  en `MantenimientoColegios.jsx`.

  **Hallazgo aparte, más de fondo:** el patrón `queryKey` con `enLinea` de
  por medio (el que ya usaba Alumnos) tiene un defecto propio con el
  `networkMode` por defecto de TanStack Query ('online'). Al perder la
  conexión de verdad —evento `offline` del navegador, no solo la
  propiedad— la consulta NUEVA que ese cambio de clave dispara queda EN
  PAUSA por la librería, sin llegar a llamar a `queryFn`: la pantalla se
  queda cargando hasta reconectar, porque el "sin conexión" ya lo decide
  `enLinea` a mano y no hace falta que TanStack Query lo decida también.
  Se corrigió con `networkMode: 'always'` en las dos pantallas (Colegios y
  Alumnos). Sin esto, el "Ver detalle" → Programación de clases también se
  habría visto afectado si el Supervisor abría un colegio nunca visto
  antes mientras ya estaba sin conexión.

- **D75 — Corregido: faltaba la mitad de "sin conexión durante la
  edición" de CU027.** Lo de 502/503/504 ("sin respuesta") ya estaba
  (`0c58e3f`); lo que nunca se escribió es la otra mitad del mismo punto
  2.4d del plan: perder la conexión A MITAD de editar (no al entrar, eso
  ya bloqueaba "Editar calendario") no tocaba "Guardar" para nada —
  `completo` nunca miraba `enLinea`— y el aviso que se mostraba era el de
  "estás consultando", que no es lo mismo que "lo que escribiste no se ha
  guardado todavía". En `CalendarioAcademico.jsx`: `completo` ahora exige
  también `enLinea`; el aviso offline distingue edición ("Sin conexión.
  Tus cambios aún no se han guardado. Mantén esta vista abierta para
  conservarlos.") de consulta, y el de consulta dice desde cuándo es la
  copia con `consulta.dataUpdatedAt` (lo trae gratis TanStack Query, y
  sobrevive a un reinicio porque `cacheConsultas.js` restaura también la
  fecha original, no la de la rehidratación). Con dos pruebas nuevas en
  `calendarioAcademicoPantalla.test.jsx`.

- **D52 — Corregido: el Docente nunca tuvo la mitad de CU011/CU012 que
  Supervisor y Directivo ya tenían.** El commit que marcaba D52 como
  corregido (`09efe45`) construyó `useResumenLocal` y `AvisoDatosLocales`,
  pero `rol` solo admitía `'supervisor'` y `'directivo'`; `useResumenDocente`
  es un `useQuery` sin ninguna rama de copia local ni de `enLinea`, e
  `InicioDocente.jsx` no importaba ninguno de los dos. Con el backend caído
  (o sin conexión), las tarjetas mostraban lo último que hubiera en memoria
  SIN aviso, o desaparecían sin decir por qué. Se agregó el literal
  `docente` a `AvisoDatosLocales.jsx` (pendiente que el analista confirme el
  texto exacto de CU010), se le pasó `enLinea` a `useResumenDocente` para
  que no intente la red sin ella, y se conectó `useResumenLocal('docente',
  ...)` en `InicioDocente.jsx`, igual que ya hacían Supervisor y Directivo.
  Con dos pruebas nuevas en `inicioDocente.test.jsx`.

  La otra mitad del reporte del tester ("al recargar vuelve al login") es
  el mismo mecanismo que D82: con un 401/403 sí cierra, pero sin respuesta
  del servidor el token se conserva y se usa la copia del perfil — ya
  verificado ahí, no hacía falta nada aparte para el Docente.

Las cinco defectos del reporte del tester (D92, D82, D61, D75, D52) quedan
revisados: D92, D61, D75 y D52 tenían algo real por corregir y D82 estaba al
día en `development`, solo desactualizado en el reporte.

**S36 (nuevo). El Dashboard se rearma por MÓDULO, y el Directivo pierde su
Inicio.**

Lo pidió Antonio: el Dashboard era difícil de entender y no llevaba a ninguna
parte. Tenía nueve bloques organizados por indicador —"Distribución por
subprograma", "Comparación de resultados", "Evolución anual"—, cada uno con su
párrafo de fórmula, hasta ocho tarjetas de cifras y su tabla completa. Se podía
leer entero y seguir sin saber qué hacer: ningún bloque llevaba al módulo donde
se corrige lo que mostraba.

**Ahora son cuatro tarjetas, una por módulo** (Asistencias, Seguimiento de
Lectura, Rúbrica, Registro de Vuelo), cada una con: el título del módulo tal
como aparece en el menú, UNA cifra, UNA gráfica y UN enlace al módulo con los
filtros puestos. Lo que antes era párrafo vive en el `title` de la cifra.

Decisiones que conviene no deshacer sin leer esto:

- **El título y la ruta salen de `MATRIZ` (la matriz de permisos), no de
  constantes del dashboard.** Así la tarjeta se llama igual que la entrada del
  menú que el usuario acaba de pulsar, y un cambio de nombre o de ruta se hace
  en un sitio. Lo hace `enlacesDeModulo.js`.
- **El enlace lo decide `puedeEntrar`, no un `if` por rol.** Los cuatro módulos
  son `[DIRECTIVO]: null`, así que sus tarjetas informan pero no ofrecen
  entrar: mandarlo a una ruta que su propia guarda le va a negar sería
  ofrecerle una puerta tapiada. El Supervisor sí entra, y el colegio viaja en
  la URL **solo si es uno**: con "Todos" o con varios, cualquier colegio que
  pusiéramos sería uno que la persona no eligió.
- **El enlace va en la CABECERA de la tarjeta**, fuera del área que depende de
  la consulta. Si los datos fallan o están cargando, entrar al módulo sigue
  siendo lo más útil que se puede hacer; dentro del cuerpo quedaba escondido
  tras el "Reintentar".
- **El reparto de `resultados-aprendizaje` se hace por `resultado`, no por
  `fuente`.** El endpoint devuelve `global` (Registro de Vuelo), `fluidez` y
  `comprension` (Rúbrica). `resultado` es parte del contrato y tiene literales
  fijos; `fuente` lo manda el simulador y puede no venir del servidor real. Un
  `resultado` nuevo no se reparte solo a ninguna tarjeta.
- **`BloqueDashboard` se queda.** Resuelve por bloque la carga, el error con
  "Reintentar", el 422 `calendario_no_configurado`, "Información no
  actualizada" y "Cambios sin aplicar", y que un bloque roto no se lleve a los
  otros tres. Reescribirlo no habría mejorado nada.
- **Los colegios excluidos siguen nombrándose** ("Sin información y fuera del
  total: … Todavía no empezaron el periodo seleccionado"). Al pasar a cuatro
  tarjetas se perdió por el camino y la prueba lo cazó: un colegio cuyo periodo
  no empezó no suma, pero callarlo lo convertiría en un colegio con 0 alumnos.

**Se borraron** `BloqueDistribucion`, `BloqueResultados`, `BloqueComparacion`,
`BloqueComparacionColegios`, `BloqueAsistencia`, `BloqueEvolucion`,
`ResumenAnual` y `DetalleClases`. Lo que daban esos dos últimos —el detalle
nominal por clase— ya no se duplica dentro del dashboard: se llega al módulo de
Asistencias, que es donde se actúa. El consolidado de libros (CU034) **se
queda** y cuelga de la tarjeta de Lectura como "Consolidado por meses".

**Quedan en el código, a propósito:** las funciones de recurso de los endpoints
que ya no pinta nadie (`obtenerDistribucionSubprograma`,
`obtenerComparacionResultados`, `obtenerComparacionColegios`,
`obtenerEvolucionAnual`, `obtenerClasesDeAsistencia`, `obtenerInicioDirectivo`).
Son enlaces finos a endpoints vivos del backend y los cubren las pruebas de
contrato (`parametros.test.js`, `rutasReales.test.js`); borrarlos sería perder
esa comprobación sin ganar nada.

**Bug corregido: las gráficas contaban alumnos dados de baja.** Ninguna lectura
de `db.ALUMNOS` en el simulador miraba la baja, así que los dados de baja
inflaban el denominador de todos los porcentajes.

**El primer arreglo filtró por `activo`, y estaba mal.** Lo cazó el backend al
responder la consulta: filtrar por `activo` saca al alumno también de los
periodos **anteriores** a su baja, y CU014 dice lo contrario — la baja no borra
sus asistencias, lecturas ni evaluaciones de cuando sí estuvo en el grupo.

**Respuesta del backend (resuelto, no hay nada que pedirle):** el servidor no
cuenta por estado actual sino por **pertenencia en la fecha**. Al dar de baja se
cierra la pertenencia desde esa fecha (`pertenencia.cerrar`). Y cada indicador
usa la suya:

| Campo | Con qué fecha cuenta |
|---|---|
| `total_a_evaluar` (resultados-aprendizaje) y `alumnos`/`total` (distribución) | Pertenencia en el corte: `min(fin del PA, hoy)` (`corte._pertenencias_al_corte`) |
| Denominador de `/dashboard/asistencia` | La lista histórica de cada clase (`clase_alumno`) |
| `alumnos_incluidos` (libros) | Las filas de cada tabla; sin tabla, la pertenencia en la fecha de su clase (`_alumnos_sin_tabla`) |

**No hace falta mandar ningún filtro al servidor.** Lo que había que corregir
era el simulador, y se corrigió: se añadió `baja_desde` a `db.ALUMNOS` (no tenía
fechas, solo un `activo` booleano) y los cálculos pasaron a usar
`perteneceEn(alumno, fecha)` con `fechaDeCorte(periodo)`.
`pertenenciaEnLaFecha.test.js` comprueba las dos mitades: que un dado de baja no
cuente en el periodo en curso, y que **sí** cuente en un PA anterior a su baja.

> El backend lo deja escrito en `API.md` y en su `docs/decisiones-dashboard.md`.
> Aviso suyo para Carlos: CU033, CU035 y CU012 siguen describiendo el Dashboard
> anterior y el Inicio del Directivo, y hay que actualizarlos a lo acordado.

**El Directivo ya no tiene Inicio.** Su Inicio (CU012) eran tres indicadores
institucionales que el Dashboard ya da, y con filtros de año, periodo y
colegios que el Inicio no tenía; mantener los dos obligaba a sostener el mismo
número en dos pantallas y a explicar por qué no siempre coincidían. La sección
pasa a `[DIRECTIVO]: null` en la matriz, su ruta de aterrizaje es `/dashboard`,
la guarda de `/inicio` ya no le deja entrar a mano y se borró
`InicioDirectivo.jsx`. Al Docente y al Supervisor no les cambia nada: su Inicio
no es un resumen, es su puesto de trabajo.

Con él se fueron tres pruebas (`inicioHallazgos.test.jsx`: D01, D52 y el
redondeo de Salud del Sistema). Ninguna de las dos reglas que sujetaban queda
sin cubrir: la copia local marcada como desactualizada la siguen probando el
Inicio del Docente y el del Supervisor, que usan el mismo `useResumenLocal`, y
"Sin datos disponibles" ante un `null` es de `StatCard`.

## Fuera de alcance

- **Modo offline de Supervisor y Directivo.** Se comentó quitarlo por no usarse
  en la práctica, pero CU011 y CU012 lo desarrollan con flujo alternativo
  propio, Service Worker, copia en `localStorage` y literales por rol. Está
  construido, funciona y no estorba: se queda.
- **El aviso de pendientes del Docente.** Ya existe y cumple CU010.

## Lo que depende del BACKEND (actualizado 04/11/2026)

Tres cosas que Antonio encontró el 03/11 usando la aplicación, y dos más el
04/11. Las primeras tres (S24, S25, S26) **ya se confirmaron contra el
servidor real** — ver "Verificación del 04/11/2026" arriba — y no requieren
ningún cambio más. Las dos nuevas (S27, S28) no son defectos del front: son
avisos y estados que el servidor manda tal cual, y que conviene revisar del
lado de los datos si no se esperaban:

| Qué se ve | Dónde mirar | Estado |
|---|---|---|
| Seguimiento del Supervisor con filas sin nombre de docente | **S24** | ✅ Resuelto, confirmado contra el servidor real |
| "Otorgar permiso" sin el PA3 en el desplegable | **S26** | ✅ Resuelto; el PA4 no aparece **a propósito** (todavía no empieza) |
| Lectura deja pulsar "Crear la tabla" sobre una clase que aún no se ha dictado | **S25** | ✅ Resuelto, confirmado reprogramando una clase |
| Registro de Vuelo: "Pendiente de evaluar" y el aviso `alumno_fuera_del_grupo` | **S27 / S27b** | ✅ Resuelto por la Tanda N: la pantalla respeta `pertenece` y la celda se bloquea antes de pulsar |
| Seguimiento del Supervisor: tres docentes con Sincronización en Error | **S28** | ℹ️ Es dato real del servidor; revisar qué envío rechazó cada cuenta |
| Inicio del Docente: faltaba un Ciclo en "Mis asignaciones" (D108) | **S29** | ✅ Resuelto en el front; pedir que `totales.ciclos` también venga completo |
| Calendario: qué año se propone en enero, con el PR4 en curso | **S30** | ✅ Confirmado por el backend; el front ya cubre el caso de ningún año vigente |
| Textos de pantalla y columnas decididos por el front el 04/11 | **S31** | 📝 Hechos; el analista los recoge en los CU |

## Versión para la ronda 7

- **Frontend:** `development` en `579934e` ("barra inferior de secciones y
  ajuste de las pantallas al teléfono") o posterior. Incluye la ronda 6
  completa, los hallazgos del 03/11 y la versión móvil (Fases 9 y 9b de
  `docs/plan-semana12-front.md`).
- **Backend:** `development` en `b769e05` (Tanda O) o posterior. Ahora
  `qa` = `8bc66d7` (Tanda P: D69, D116 y la regla de 12 meses también en el
  calendario particular).

## Ronda 7 · Tanda F1 (Paris)

Defectos de la ronda 7 de QA corregidos en el front (un commit por defecto,
sobre `5f7e98d`; el detalle técnico está en la sección 7 de
`docs/plan-semana12-front.md`):

- **D109** (`b6f92f5`): cada cuenta entra a su Inicio; solo la misma cuenta
  cuya sesión se cortó vuelve a su pantalla.
- **D115** (`e4c29d6`): el perfil para recargar sin conexión sale de
  `localStorage` y pasa a IndexedDB, atado a su `id_usuario`.
- **D95** (`f43e3e5`): Asistencias bloquea sin conexión si el paquete de
  habilitaciones no está en IndexedDB.
- **D110** (`135b166`, compartido con el backend): el detalle del colegio se
  vuelve a pedir al abrir la pantalla y trae las secciones nuevas. Que
  "Única" siga junto a "A" y "B" lo decide el **analista**; el front no la
  esconde.
- **D116** (`6a8f09c`): el error de más de 12 meses se ve junto al fin del
  PR4, y el front lo detecta antes de enviar con el texto del backend.
- **D117** (`e72cb48`): el aviso de registros afectados no pasa a otro
  colegio.
- **D114** (`2eca40e`): una sola fuente para la actividad en curso; Rúbrica
  reconoce la actividad iniciada sin conexión.

**Para decidir (no cambiado en esta tanda):**

- Lectura, Rúbrica y Registro de Vuelo tienen el mismo hueco que D95: sin
  conexión deciden con el `escritura` de su consulta en caché y no comprueban
  el paquete de habilitaciones.
- `sicedu.rechazos` (D69) guarda en `localStorage` nombres de alumnos
  ("Asistencia de …") y observaciones. Con la Ley N.º 29733 conviene moverlo
  a IndexedDB como el perfil.
- **Backend (sugerencia):** el bloque `escritura` solo trae el porqué como
  texto. Un código (por ejemplo `sin_actividad`) dejaría al front distinguir
  "falta la actividad" de "falta la habilitación" sin leer textos (D114).

## Ronda de QA del 09/11/2026 (16 bugs reportados por Antonio)

De los 16, 14 se corrigieron en el front (commits de esta tanda) y uno ya no
aplicaba (el Dashboard viejo que los mostraba se reemplazó por completo en la
tanda anterior). Queda uno **que no es del front**:

- **Calendario académico — PA4 y PR4 editados a la vez (CU027).** Con un PA4
  hasta el 15/11 y un PR4 desde el 16/11, cambiar en el MISMO guardado el fin
  de PA4 a 14/11 y el inicio de PR4 a 15/11 lo rechaza: el servidor sigue
  comparando contra las fechas VIEJAS de uno de los dos periodos. El front ya
  manda los ocho periodos juntos en un solo `PUT /calendarios/{id}`
  (`periodosParaGuardar` en `CalendarioAcademico.jsx`), no uno por uno, así
  que no hay nada que batchear mejor desde aquí: la validación del backend
  necesita comparar el periodo `i` contra el `i±1` del mismo envío, no contra
  lo que hay hoy en la base, para aceptar un cambio donde dos fechas vecinas
  se mueven una hacia la otra en la misma operación.

- **Seguimiento — el calendario del filtro de fecha no se investigó a fondo.**
  Se buscó `disabled`, `readOnly`, `pointer-events` y recortes por overflow en
  `SeguimientoPage.jsx` y no hay ninguno: el campo no tiene nada en el código
  que le impida abrir el selector nativo del navegador. No se pudo reproducir
  en vivo (el entorno de desarrollo de este equipo no tiene el backend real
  levantado, y `VITE_AUTH_REAL`/`VITE_ADMIN_REAL` exigen uno para entrar).
  Queda pendiente de ver en un navegador real antes de tocar algo a ciegas.

## Tanda Q2 · Importar nómina de alumnos desde Excel (semana 14, CU014)

Commit del backend `b08d548`. Contrato en `cambiosFront_semana14_v1.md` y
`cambiosTest_semana14_v1.md` (carpeta de reportes, no en este repo).
Implementado **solo esto** de la actualización de CU014: no se tocó el resto
de la tanda Q1 (alumno con pertenencia pendiente, DNI, filtro "Pertenencia")
porque no se pidió.

- `src/api/resources/administracion.js`: `vistaPreviaImportacion`,
  `confirmarImportacion` y `consultarImportacion`. El archivo viaja como
  cuerpo crudo (`Content-Type` del propio `File`, no JSON ni
  `multipart/form-data`), tal como lo probó el backend.
- `src/features/alumnos/ImportarNominaModal.jsx`: el modal de dos pasos
  (elegir archivo → vista previa → confirmar), con los tres casos de error
  que cambian el paso (`importacion_desactualizada`, `importacion_existente`,
  sin respuesta del servidor) y la reconciliación al recuperar la conexión
  (`GET /alumnos/importaciones/{id}`).
- Botón "Importar nómina" en `MantenimientoAlumnos.jsx`, junto a "Agregar",
  solo para el Supervisor (`accionesExtra` de `Mantenimiento`).
- `nginx.conf`: `client_max_body_size 6m;` en `location /api/` — el límite
  por defecto (1 MB) rechazaba con 413 cualquier nómina de más de 1 MB antes
  de que llegara al backend. Lo señalaba el propio reporte del backend.

**Tanda Q1, implementada después** (ver la sección siguiente): el hueco de
arriba —completar la pertenencia de un alumno importado desde "Editar
alumno"— ya no existe.

## Tanda Q1 · Alumno con pertenencia pendiente y DNI (semana 14, CU014)

Commit del backend `eeb56af`. Contrato en `cambiosFront_semana14_v1.md` y
`cambiosTest_semana14_v1.md`. Pedida después de la Q2, para cerrar el hueco
que esa tanda dejaba: un alumno importado ya se puede completar desde
"Editar alumno".

- **`src/components/mantenimiento/PopupMantenimiento.jsx`**: `requerido`
  ahora puede ser función de `(valores, contexto)`, resuelta en
  `visiblesEn` igual que `opciones`, `min`, `max` y `ayuda`. Antes solo
  aceptaba `true`/`false` fijos; una función ahí se habría tomado siempre
  por obligatoria (`campo.requerido && vacio` — una función nunca es
  falsa), sin mirar lo que de verdad devuelve.
- **`src/features/alumnos/MantenimientoAlumnos.jsx`**:
  - Campo `dni` (opcional, 8 dígitos exactos cuando se informa).
  - `id_grado`, `id_programa` e `id_seccion` dejan de ser obligatorios a
    secas al editar un pendiente: lo son otra vez en cuanto se informa el
    subprograma o la sección (`grupoDebeCompletarse`), momento en que el
    grupo tiene que quedar completo o ninguno (CU014: "Completa el grado,
    el subprograma y la sección, o deja vacíos el subprograma y la
    sección."). El grado puede venir prellenado de la nómina sin disparar
    esto — la señal es el subprograma o la sección, no el grado.
  - "Pertenece al grupo desde" (el mismo campo de D65/tanda L1, que ya
    distinguía este caso) ahora solo es obligatorio cuando el grupo ya
    quedó completo (`grupoCompleto`), y su fecha propuesta cae a `hoy()`
    cuando no hay `fecha_registro` que proponer, tal como pide el CU.
  - Columna "DNI" (con "—" sin dato) e insignia "Pertenencia pendiente"
    junto al nombre; filtro "Pertenencia" (Definida/Pendiente).
  - Activar/inactivar a un pendiente ya no pide "Aplicar cambio desde": el
    cuerpo va vacío (`{}`), que sigue siendo obligatorio pero sin fecha —
    un pendiente no tiene grupo en curso del que entrar o salir en una
    fecha. El modal lo decide en `Mantenimiento.jsx`, leyendo
    `fila.pertenencia_pendiente` de la fila misma.
- **`src/api/resources/administracion.js`**:
  - `GET /alumnos` acepta `pertenencia=definida|pendiente`
    (`listarAlumnosAdmin`, y su equivalente local en `filtrarAlumnos` para
    el simulador y la copia offline).
  - `normalizarAlumno` deja `pertenencia_pendiente` como booleano explícito.
  - `cuerpoDeAlumno` (el `PATCH`) manda `dni: null` para QUITARLO cuando el
    campo queda vacío — a diferencia del resto de campos, que simplemente
    se omiten si están vacíos, aquí vacío es una instrucción ("bórralo"),
    no "no toques esto".
  - `conDniLegible` reescribe un 409 `dni_duplicado` con la forma de un
    422 por campo (`errores: [{campo: 'dni', ...}]`): el backend no lo
    manda así —es un 409, no una validación—, y sin esto el formulario lo
    mostraba como el toast genérico "No se pudo guardar" en vez de marcar
    el campo.
  - `cambiarEstadoAlumno` acepta `pendiente: true` para mandar el cuerpo
    vacío en vez de `{aplicar_desde}`.
- No se tocó la tabla de alumnos CU015 (ficha / detail view): la etiqueta
  "Pertenencia pendiente" de sus tags no se agregó ahí, solo en la tabla de
  CU014. Si hace falta, es el mismo patrón.

