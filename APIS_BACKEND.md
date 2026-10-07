# SICEDU API — Referencia para el frontend

**Rama:** `development` · **Base URL (desarrollo):** `http://127.0.0.1:8000`
**Formato:** JSON · **Autenticación:** JWT Bearer

Esta referencia refleja el estado real del backend actual: autenticación, recuperación
de contraseña, autorización por rol, gestión de cuentas y endpoints de creación,
consulta y edición de colegios, alumnos, profesores y catálogos.

Todos los endpoints documentados están verificados contra el servidor en ejecución.

---

## Índice

- [Flujo de autenticación](#flujo-de-autenticación)
- [Roles](#roles)
- [Endpoints principales](#endpoints-principales)
- [Cambio de contraseña](#cambio-de-contraseña)
- [Recuperar contraseña sin sesión](#recuperar-contraseña-sin-sesión)
- [Cuentas de Supervisor y Directivo](#cuentas-de-supervisor-y-directivo)
- [Errores](#errores)
- [CORS](#cors)
- [Usuarios de prueba](#usuarios-de-prueba)
- [Levantar el backend](#levantar-el-backend)

---

## Flujo de autenticación

1. El usuario envía correo y contraseña a `POST /login`.
2. La API devuelve un `access_token` JWT con vigencia de `480` minutos (8 horas).
3. El frontend guarda el token y lo manda en cada petición protegida como:
   `Authorization: Bearer <access_token>`.
4. `GET /me` devuelve la información del usuario autenticado.
5. `POST /logout` es de cierre local: el backend no invalida el JWT; el frontend debe borrar el token del almacenamiento.

---

## Roles

| `id_rol` | Nombre       |
| -------- | ------------ |
| `1`      | `Docente`    |
| `2`      | `Supervisor`  |
| `3`      | `Directivo`  |

El backend ya implementa validación por rol con `require_role(...)` en `app/dependencies.py`.

**Requieren `Supervisor`:**

- `POST /colegios`, `PATCH /colegios/{id_colegio}`
- `POST /alumnos`, `PATCH /alumnos/{id_alumno}`
- `POST /profesores`, `GET /profesores`, `PATCH /profesores/{id_usuario}`
- `PATCH /profesores/{id_usuario}/activar` y `/desactivar`
- `POST /usuarios`, `GET /usuarios`
- `PATCH /usuarios/{id_usuario}/activar` y `/desactivar`

**Cualquier usuario autenticado:**

- `GET /me`, `GET /colegios`, `GET /alumnos`, `GET /grados`, `GET /programas`
- `POST /me/password/codigo`, `POST /me/password/verificar-codigo`, `POST /me/password`

**Sin autenticación (públicos):**

- `POST /login`, `POST /logout`, `GET /`
- `POST /password/recuperar`, `POST /password/restablecer`

---

## Endpoints principales

### `GET /`

Comprobación de salud del backend.

**Respuesta `200`:**

```json
{ "status": "ok" }
```

---

### `POST /login`

Autentica al usuario y devuelve un token.

**Body (`application/json`):**

```json
{
  "correo": "profesor.prueba@sicedu.test",
  "password": "ProfesorTest123"
}
```

**Respuesta `200`:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Errores:**

- `401` si el correo no existe o la contraseña es incorrecta.
- `403` si la contraseña es correcta pero la cuenta está desactivada.
- `422` si el body no es válido.

---

### `GET /me`

Devuelve el usuario autenticado.

**Headers:**

```http
Authorization: Bearer <access_token>
```

**Respuesta `200`:**

```json
{
  "id_usuario": 1,
  "id_rol": 2,
  "correo": "jefa.prueba@sicedu.test",
  "id_docente": null,
  "nombres": "Jefa",
  "apellidos": "de Prueba",
  "activo": true
}
```

---

### `POST /logout`

Cierre de sesión local. El backend responde con éxito pero no revoca el token real.

**Respuesta `200`:**

```json
{ "detail": "Sesión cerrada correctamente" }
```

---

### `POST /colegios` — requiere `Supervisor`

**Body:**

```json
{
  "nombre": "Colegio Yungay",
  "zona": "Yungay"
}
```

**Respuesta `200`:**

```json
{
  "id_colegio": 3,
  "nombre": "Colegio Yungay",
  "zona": "Yungay",
  "creado_por": 1,
  "creado_en": "2026-09-22",
  "modificado_por": null,
  "modificado_en": null
}
```

**Errores:**

- `403` si el usuario autenticado no tiene rol `Supervisor`

---

### `GET /colegios` — cualquier usuario autenticado

Devuelve un array con todos los colegios.

**Respuesta `200`:**

```json
[
  {
    "id_colegio": 1,
    "nombre": "Colegio de Prueba",
    "zona": "Zona de Prueba",
    "creado_por": 1,
    "creado_en": "2026-09-22",
    "modificado_por": null,
    "modificado_en": null
  }
]
```

---

### `POST /alumnos` — requiere `Supervisor`

**Body:**

```json
{
  "nombres": "Ana",
  "apellidos": "Pérez",
  "id_colegio": 1,
  "id_grado": 1,
  "id_programa_actual": 1,
  "activo": true
}
```

**Respuesta `200`:**

```json
{
  "id_alumno": 1,
  "nombres": "Ana",
  "apellidos": "Pérez",
  "id_colegio": 1,
  "id_grado": 1,
  "id_programa_actual": 1,
  "fecha_registro": "2026-09-22",
  "activo": true,
  "creado_por": 1,
  "creado_en": "2026-09-22",
  "modificado_por": null,
  "modificado_en": null
}
```

**Errores:**

- `404` si `id_colegio`, `id_grado` o `id_programa_actual` no existe.
- Ejemplo: `{"detail": "No existe un grado con id_grado=999"}`

---

### `GET /alumnos` — cualquier usuario autenticado

Lista alumnos con filtros y paginación. Son cientos de registros, así que la
respuesta **siempre viene paginada**: por defecto 50 por página.

**Parámetros (todos opcionales, combinables entre sí):**

| Parámetro  | Tipo      | Descripción                                        |
| ---------- | --------- | -------------------------------------------------- |
| `colegio`  | `number`  | Filtra por `id_colegio`.                           |
| `grado`    | `number`  | Filtra por `id_grado`.                             |
| `programa` | `number`  | Filtra por `id_programa_actual`.                   |
| `q`        | `string`  | Busca en nombres y apellidos.                      |
| `activo`   | `boolean` | Filtra por estado.                                 |
| `limit`    | `number`  | Por página. Por defecto `50`, máximo `500`.        |
| `offset`   | `number`  | Registros a saltar. Por defecto `0`.               |

Ejemplo: `GET /alumnos?colegio=2&grado=1&q=perez&limit=20&offset=0`

**Respuesta `200`:**

```json
{
  "total": 413,
  "limit": 50,
  "offset": 0,
  "items": [
    {
      "id_alumno": 1,
      "nombres": "Juan Carlos",
      "apellidos": "Pérez Quispe",
      "id_colegio": 2,
      "id_grado": 1,
      "id_programa_actual": 1,
      "fecha_registro": "2026-09-24",
      "activo": true,
      "creado_por": 1,
      "creado_en": "2026-09-24",
      "modificado_por": null,
      "modificado_en": null
    }
  ]
}
```

`total` es el total que cumple el filtro, no el de la página: sirve para calcular
cuántas páginas hay (`Math.ceil(total / limit)`). Los resultados vienen ordenados
por apellidos y luego nombres.

> **Sobre `q`:** ignora mayúsculas y tildes, y busca cada palabra por separado en
> cualquier orden. `perez` encuentra a "Pérez", y `juan perez` encuentra a
> "Juan Carlos Pérez Quispe" aunque el "Carlos" quede en medio. Puedes enviar
> directamente lo que el usuario escriba en el buscador, sin normalizarlo.

---

### `PATCH /alumnos/{id_alumno}` — requiere `Supervisor`

Corrige los datos de un alumno. **Actualización parcial:** solo los campos que envíes
se modifican; los que omitas quedan intactos.

**Body** (todos los campos son opcionales):

```json
{
  "nombres": "Juan Carlos",
  "apellidos": "Pérez Quispe",
  "id_colegio": 2,
  "id_grado": 3,
  "id_programa_actual": 1,
  "activo": true
}
```

**Respuesta `200`:** el alumno completo, ya actualizado, con `modificado_por` y
`modificado_en` puestos al usuario y fecha de la edición.

**Errores:**

- `404` si el alumno no existe: `{"detail": "No existe un alumno con id_alumno=99"}`
- `404` si algún `id_colegio`, `id_grado` o `id_programa_actual` nuevo no existe.

---

### `PATCH /colegios/{id_colegio}` — requiere `Supervisor`

Corrige un colegio. Parcial, igual que el de alumnos.

**Body** (campos opcionales): `{ "nombre": "Colegio Carhuaz", "zona": "Carhuaz" }`

**Respuesta `200`:** el colegio completo actualizado.
**Error `404`:** `{"detail": "No existe un colegio con id_colegio=999"}`

---

### `PATCH /profesores/{id_usuario}` — requiere `Supervisor`

Corrige los datos de un profesor. Parcial.

**Body** (campos opcionales): `{ "nombres": "Ana", "apellidos": "Torres", "correo": "ana@sicedu.test" }`

**Respuesta `200`:** el profesor actualizado, con el mismo formato que `POST /profesores`
(`contraseña_temporal` llega en `null`, porque aquí no se genera ninguna).

**Errores:**

- `404` si no existe, o si ese `id_usuario` no es un profesor.
- `409` si el correo nuevo ya lo usa otra cuenta.

> Los nombres del profesor viven en dos tablas (`usuario` y `docente`). Este endpoint
> escribe en ambas, así que no hace falta que el frontend haga nada especial para
> mantenerlas sincronizadas.

---

### `GET /grados` — cualquier usuario autenticado

Devuelve el catálogo de grados.

**Respuesta `200`:**

```json
[
  { "id_grado": 1, "nombre": "1.º", "id_ciclo": 1 },
  { "id_grado": 2, "nombre": "2.º", "id_ciclo": 1 }
]
```

---

### `GET /programas` — cualquier usuario autenticado

Devuelve el catálogo de programas.

**Respuesta `200`:**

```json
[
  { "id_programa": 1, "nombre": "Alfabetización" },
  { "id_programa": 2, "nombre": "Comprensión Lectora" }
]
```

---

### `POST /profesores` — requiere `Supervisor`

**Body:**

```json
{
  "nombres": "Luis",
  "apellidos": "Ramos",
  "correo": "luis.ramos@sicedu.test",
  "activo": true
}
```

**Respuesta `200`:**

```json
{
  "id_usuario": 4,
  "id_rol": 1,
  "correo": "luis.ramos@sicedu.test",
  "id_docente": 2,
  "nombres": "Luis",
  "apellidos": "Ramos",
  "activo": true,
  "contraseña_temporal": "A1b2C3d4E5"
}
```

**Comportamiento especial de `contraseña_temporal`:**

- Si el correo de bienvenida se envía bien, la respuesta devuelve `null`.
- Si el envío falla, el valor real vuelve en la respuesta para que el Supervisor lo entregue manualmente.
- Actualmente, con las credenciales de Gmail de juguete, el envío falla con frecuencia; por eso es normal ver la contraseña temporal en la respuesta.

**Errores:**

- `409` si el correo ya existe.
- `500` si no existe el rol `Docente` en el catálogo.

---

### `GET /profesores` — requiere `Supervisor`

Devuelve un array con todos los profesores, activos e inactivos por igual.

**Respuesta `200`:**

```json
[
  {
    "id_usuario": 4,
    "id_docente": 2,
    "correo": "luis.ramos@sicedu.test",
    "nombres": "Luis",
    "apellidos": "Ramos",
    "activo": true
  }
]
```

Este schema (`ProfesorListItem`) es más chico que la respuesta de `POST /profesores` — no trae `id_rol` ni `contraseña_temporal`, solo lo necesario para armar una tabla/listado.

---

### `PATCH /profesores/{id_usuario}/desactivar` — requiere `Supervisor`

Sin body — el `id_usuario` va en la URL. Es borrado lógico: desactiva tanto la fila de `usuario` como la de `docente` juntas, no elimina ningún registro.

**Respuesta `200`:**

```json
{
  "id_usuario": 4,
  "id_rol": 1,
  "correo": "luis.ramos@sicedu.test",
  "id_docente": 2,
  "nombres": "Luis",
  "apellidos": "Ramos",
  "activo": false,
  "contraseña_temporal": null
}
```

`contraseña_temporal` siempre viene `null` en este endpoint — no aplica a esta operación.

**Errores:**

- `404` si el `id_usuario` no existe o no corresponde a un profesor (por ejemplo, si es el id de un Supervisor/Directivo): `{"detail": "No existe un profesor con id_usuario={id}"}`

---

### `PATCH /profesores/{id_usuario}/activar` — requiere `Supervisor`

Sin body — el `id_usuario` va en la URL. Operación inversa a `desactivar`: reactiva tanto `usuario` como `docente`, y el login vuelve a funcionar normalmente.

**Respuesta `200`:** misma forma que `desactivar`, con `"activo": true`.

**Errores:**

- `404` — mismo caso que `desactivar`.

---

## Cambio de contraseña

El cambio de contraseña requiere verificar un código de 6 caracteres enviado al correo del usuario — reemplaza el chequeo de "contraseña actual". El flujo son 3 llamadas:

1. `POST /me/password/codigo` — genera el código y lo envía por correo.
2. `POST /me/password/verificar-codigo` — opcional, solo para UX. Permite mostrarle al usuario feedback inmediato ("código correcto"/"código incorrecto") antes de avanzar a la pantalla de nueva contraseña. No consume el código ni tiene ningún efecto en el backend.
3. `POST /me/password` — el que realmente cambia la contraseña. Debe recibir el código de nuevo, el mismo que el usuario ingresó en el paso 2 — el backend nunca asume que el paso 2 se llamó antes, vuelve a validar el código de forma independiente. El frontend tiene que guardar el código que el usuario tipeó (en el estado de la pantalla 1) y reenviarlo en el request final del paso 3, no solo en el paso 2.

### `POST /me/password/codigo` — cualquier usuario autenticado

Sin body.

**Respuesta `200`:**

```json
{ "detail": "Código enviado a tu correo" }
```

**Errores:**

- `503` si el envío de correo falla: `{"detail": "No pudimos enviar el código, intenta de nuevo"}`

---

### `POST /me/password/verificar-codigo` — cualquier usuario autenticado

**Body:**

```json
{ "codigo": "AB12CD" }
```

**Respuesta `200`:**

```json
{ "detail": "Código correcto" }
```

**Errores:**

- `400`: `{"detail": "Código incorrecto o expirado"}`

---

### `POST /me/password` — cualquier usuario autenticado

**Body:**

```json
{
  "codigo": "AB12CD",
  "contraseña_nueva": "nuevacontrasena123",
  "confirmar_contraseña_nueva": "nuevacontrasena123"
}
```

**Respuesta `200`:**

```json
{ "detail": "Contraseña actualizada correctamente" }
```

**Errores:**

- `400` — código incorrecto o expirado, mismo mensaje que `POST /me/password/verificar-codigo`.
- `400` — `{"detail": "La contraseña nueva no puede ser igual a la actual"}`
- `422` — si `contraseña_nueva` y `confirmar_contraseña_nueva` no coinciden, o si la contraseña no cumple el formato (mínimo 8 caracteres, solo letras y números — sin símbolos, sin espacios).

El código expira 10 minutos después de generado, y se consume (no reutilizable) apenas se usa con éxito para cambiar la contraseña.

---

## Recuperar contraseña sin sesión

El flujo de "olvidé mi contraseña", desde la pantalla de login. **Ninguno de los dos
endpoints requiere token** — es la diferencia con los de [Cambio de contraseña](#cambio-de-contraseña),
que son para un usuario que ya entró y exigen `Authorization`.

### `POST /password/recuperar` — público

Envía un código de 6 caracteres al correo indicado. El código vale **10 minutos**.

**Body:**

```json
{ "correo": "profesor.prueba@sicedu.test" }
```

**Respuesta `200` — siempre, exista el correo o no:**

```json
{ "detail": "Si el correo está registrado, enviamos un código de verificación" }
```

> Responde `200` incluso con correos inexistentes o cuentas desactivadas, a propósito.
> Si devolviera `404` para los desconocidos, cualquiera podría ir probando direcciones
> para averiguar quién tiene cuenta en el sistema. Para el frontend esto significa que
> **no puedes saber si el correo existe**: muestra siempre la pantalla de "revisa tu
> correo" y deja que el usuario vuelva si no le llega nada.

### `POST /password/restablecer` — público

Cambia la contraseña usando el código recibido.

**Body:**

```json
{
  "correo": "profesor.prueba@sicedu.test",
  "codigo": "D6S3QC",
  "contraseña_nueva": "NuevaClave123",
  "confirmar_contraseña_nueva": "NuevaClave123"
}
```

**Reglas de la contraseña** (las valida el backend, conviene repetirlas en el formulario):

- Mínimo 8 caracteres.
- Solo letras y números, sin espacios ni símbolos.
- No puede ser igual a la actual.
- `contraseña_nueva` y `confirmar_contraseña_nueva` deben coincidir.

**Respuesta `200`:**

```json
{ "detail": "Contraseña actualizada correctamente" }
```

**Errores:**

| Código | Cuándo                                                        | `detail`                                          |
| ------ | ------------------------------------------------------------- | -------------------------------------------------- |
| `400`  | Código incorrecto, expirado, ya usado, o correo inexistente   | `"Código incorrecto o expirado"`                  |
| `400`  | La contraseña nueva es igual a la actual                       | `"La contraseña nueva no puede ser igual a la actual"` |
| `422`  | No coinciden, muy corta, o con símbolos                        | array de validación                               |

> El código es de **un solo uso**: al restablecer se borra, y reutilizarlo devuelve
> `400`. Si el usuario se equivoca al escribir la contraseña nueva y el formulario la
> rechaza, el código sigue vivo (no se consumió); pero si la petición llegó a
> completarse, hay que pedir uno nuevo con `/password/recuperar`.

---

## Cuentas de Supervisor y Directivo

Alta, baja y listado de cuentas administrativas. **Todos requieren rol `Supervisor`.**

Para crear profesores sigue usándose [`POST /profesores`](#post-profesores--requiere-supervisor),
que además crea la ficha de docente asociada.

### `POST /usuarios` — requiere `Supervisor`

Crea una cuenta de `Supervisor` o `Directivo`.

**Body:**

```json
{
  "nombres": "Ana",
  "apellidos": "Torres",
  "correo": "ana.torres@sicedu.test",
  "id_rol": 2,
  "activo": true
}
```

**Respuesta `201`:**

```json
{
  "id_usuario": 4,
  "id_rol": 2,
  "correo": "ana.torres@sicedu.test",
  "id_docente": null,
  "nombres": "Ana",
  "apellidos": "Torres",
  "activo": true,
  "contraseña_temporal": null,
  "correo_enviado": true
}
```

| Campo                 | Tipo             | Descripción                                                      |
| --------------------- | ---------------- | ---------------------------------------------------------------- |
| `correo_enviado`      | `boolean`        | Si el correo con la credencial salió bien.                       |
| `contraseña_temporal` | `string \| null` | **Solo llega si `correo_enviado` es `false`.** Si el correo salió, viene `null`. |

> Mira `correo_enviado` antes de decidir qué mostrar: si es `true`, di solo "le
> enviamos sus credenciales por correo". Si es `false`, muestra la contraseña temporal
> en pantalla — es la única copia que existe — y advierte de que se anote.

**Errores:**

| Código | Cuándo                                             |
| ------ | --------------------------------------------------- |
| `400`  | `id_rol` es el de `Docente` (usa `POST /profesores`) |
| `404`  | El `id_rol` no existe                               |
| `409`  | El correo ya está registrado                        |
| `403`  | Quien llama no es `Supervisor`                      |

### `GET /usuarios` — requiere `Supervisor`

Lista todas las cuentas, con el nombre del rol ya resuelto.

**Parámetro opcional:** `?rol=Supervisor` filtra por nombre de rol exacto
(`Docente`, `Supervisor` o `Directivo`).

**Respuesta `200`:**

```json
[
  {
    "id_usuario": 1,
    "id_rol": 2,
    "rol": "Supervisor",
    "correo": "jefa.prueba@sicedu.test",
    "id_docente": null,
    "nombres": "Jefa",
    "apellidos": "de Prueba",
    "activo": true
  }
]
```

Incluye el campo `rol` con el nombre, así no hace falta cruzar `id_rol` contra otra tabla.

### `PATCH /usuarios/{id_usuario}/desactivar` — requiere `Supervisor`

### `PATCH /usuarios/{id_usuario}/activar` — requiere `Supervisor`

Cambian el estado de cualquier cuenta. Si es la de un profesor, la ficha de docente
queda con el mismo estado automáticamente.

**Respuesta `200`:** la cuenta con su `activo` ya actualizado.

**Errores:**

| Código | Cuándo                                             | `detail`                                                         |
| ------ | --------------------------------------------------- | ----------------------------------------------------------------- |
| `404`  | No existe ese usuario                               | `"No existe un usuario con id_usuario=99"`                        |
| `409`  | Es la última cuenta activa de `Supervisor` o `Directivo` | `"No puedes desactivar la última cuenta activa de Supervisor..."` |
| `409`  | Es tu propia cuenta                                 | `"No puedes desactivar tu propia cuenta. Pídeselo a otro Supervisor."` |

> Las dos reglas de `409` **las aplica el servidor**, no el navegador: aunque el
> frontend no oculte el botón, la petición se rechaza. Muestra el `detail` tal cual,
> que ya viene redactado para el usuario final.
>
> La regla de la cuenta propia existe porque `GET /me` y todas las rutas protegidas
> rechazan a los usuarios inactivos: desactivarse a uno mismo cerraría la sesión en la
> siguiente petición, sin forma de revertirlo desde la propia aplicación.

---

## Errores

### `401 Unauthorized`

El backend devuelve un `detail` tipo string.

```json
{ "detail": "Credenciales inválidas o sesión expirada" }
```

Situaciones:

- token faltante
- token inválido
- token expirado
- usuario deshabilitado

### `403 Forbidden`

Se usa para autorización por rol.

```json
{ "detail": "No tienes permisos para realizar esta acción" }
```

### `404 Not Found`

Usado cuando un FK no existe.

```json
{ "detail": "No existe un grado con id_grado=999" }
```

### `422 Unprocessable Entity`

Se usa cuando falta un campo o el payload no es válido.

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "password"],
      "msg": "Field required",
      "input": { "correo": "x@y.z" }
    }
  ]
}
```

---

## CORS

La API acepta peticiones desde navegadores en varios orígenes locales por defecto.

**Configuración por defecto:**

```env
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000
```

Esto permite que un frontend en Vite o React pueda consumir la API sin proxy.

---

## Usuarios de prueba

Los usuarios se crean con `python -m app.seed_data`.

| Rol        | Correo                         | Contraseña        |
| ---------- | ------------------------------ | ----------------- |
| `Docente`  | `profesor.prueba@sicedu.test`  | `ProfesorTest123` |
| `Supervisor` | `jefa.prueba@sicedu.test`     | `JefaTest123`     |
| `Directivo` | `directivo.prueba@sicedu.test` | `DirectivoTest123` |

El usuario de rol `Docente` tiene `id_docente` asociado. Los de `Supervisor` y `Directivo` no lo tienen.

---

## Pendiente

Lo que aún no está implementado en el backend:

- **El núcleo académico:** reporte semanal, rúbrica semanal, evaluaciones diagnósticas
  y nivel final mensual. Son los Grupos 2 a 5 del modelo de datos y todavía no existen
  ni las tablas. Es lo que hoy resuelve el simulador del frontend.
- Refresh token / renovación de sesión
- Borrado de registros (hoy alumnos y profesores se desactivan, no se eliminan)
- Control de permisos más granular por módulo
- Paginación en `GET /colegios` y `GET /profesores` (hoy devuelven la lista completa;
  con los volúmenes actuales no es problema, pero `GET /alumnos` ya la necesita)

### Un aviso sobre el envío de correos

`POST /profesores` y `POST /usuarios` devuelven la contraseña temporal en la respuesta
**cuando el correo no se pudo enviar** (`correo_enviado: false`). Está pensado como
salida de emergencia, pero hoy el envío falla casi siempre porque `GMAIL_SMTP_USER` y
`GMAIL_SMTP_APP_PASSWORD` no están configurados, así que en la práctica la credencial
acaba pasando por pantalla en casi todas las altas.

Conviene configurar esas dos variables en el `.env` del servidor. Mientras tanto, el
frontend debe seguir manejando el caso `correo_enviado: false`, porque será el habitual.

---

## Levantar el backend

Desde la raíz del proyecto, usa este comando:

```bash
python run.py
```

El script hace lo siguiente:

1. Verifica que Docker Desktop esté corriendo.
2. Crea o levanta el contenedor PostgreSQL `sicedu-db` en el puerto `5433`.
3. Crea el entorno virtual `venv` e instala dependencias si hace falta.
4. Genera `.env` si no existe.
5. Ejecuta `alembic upgrade head`.
6. Carga el seed con `python -m app.seed_data`.
7. Arranca `uvicorn` con recarga automática.

Opciones:

```bash
python run.py --puerto 8001
python run.py --sin-seed
```

El API queda en `http://127.0.0.1:8000` y el Swagger en `http://127.0.0.1:8000/docs`.

La configuración mínima del `.env` debe incluir:

```env
DATABASE_URL=postgresql+psycopg2://admin:postgres123@localhost:5433/sicedu
JWT_SECRET_KEY=dev-secret-key-cambiar-en-produccion
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000
```

---

# Lo que el frontend necesita del backend — sprint de cierre (06/10/2026)

> Escrito por el frontend a partir de *SICEDU — Sprint de cierre: Seguridad,
> Offline y Mantenimientos*. Las pantallas de abajo **ya están construidas** y
> hoy se alimentan del simulador; en cuanto exista cada endpoint se conectan
> cambiando una línea en `src/api/resources/`.
>
> Orden de prioridad: 1 y 2 desbloquean los mantenimientos; 3 y 4, el offline.

## 1. Secciones (bloqueante)

El concepto de **sección** no existe en el modelo y la matriz lo usa en todas
partes: un Docente tiene *una o varias secciones por colegio*, y un Alumno
pertenece a *exactamente un colegio y una sección*.

- `GET /colegios/{id_colegio}/secciones` → `[{ id_seccion, id_colegio, id_grado, nombre }]`
- `POST` y `PATCH` de secciones, para el mantenimiento de Colegios.
- `id_seccion` en **`POST /alumnos`**, en **`PATCH /alumnos/{id}`** y en la
  respuesta de `GET /alumnos`.
- `GET /alumnos?seccion=` como filtro.

Sin esto, el alta de alumno no puede cumplir "un colegio y una sección".

## 2. Baja lógica de colegios y campos nuevos

D5 retira "Eliminar" de todas las secciones: solo inactivar y activar.

- Columna **`activo`** en `colegio`, y `PATCH /colegios/{id}` aceptándola.
  Inactivar un colegio **no** debe tocar sus alumnos ni sus registros.
- Campos **`codigo`** (código modular) y **`ubicacion`** en `colegio`.
- Filtro **`?activo=`** en `GET /colegios`, `GET /usuarios` y `GET /profesores`.
  Todas las grillas abren en Estado = Activo, y hoy ese filtro se hace en el
  navegador sobre la lista completa.

## 3. Sesiones de actividades (D4)

Son **distintas** de la sesión de autenticación. El docente las abre con un
botón, y son las que habilitan la edición de las grillas del aula. El id es un
**UUID generado en el navegador**, para poder iniciarlas sin red.

- `POST /sesiones` → acepta el `uuid` del cliente, `id_docente`, `inicio`.
- `PATCH /sesiones/{uuid}/cerrar` → `fin`.
- `GET /sesiones` → las propias del Docente; todas para el Supervisor, con
  `?docente=` para filtrar.
- `GET /sesiones/{uuid}` → el detalle con sus cambios.

Debe ser **idempotente por uuid**: al reconectar, el navegador reenvía el mismo
inicio y no puede duplicarse.

## 4. Auditoría por campo (D7)

La pestaña Auditoría de la plantilla de mantenimiento ya está hecha y espera:

- `GET /auditoria?entidad=alumno|usuario|colegio&id={id}` →
  `[{ id_cambio, fecha_cliente, fecha_servidor, usuario, campo, valor_anterior, valor_nuevo, sesion_actividad_id }]`

Las dos fechas importan: un cambio capturado sin conexión se marca en pantalla
como *"Sincronizado de forma diferida"* comparándolas.

## 5. Sincronización en lote (T13)

- `POST /sincronizar` → recibe el lote de eventos de la cola:
  `{ uuid, sesion_actividad_id, entidad, registro_id, campo, valor_anterior, valor_nuevo, fecha_cliente, version_base }`
- **Idempotente por `uuid`** (ignora los ya procesados) y revalida rol y
  asignación **por evento**.
- Si `version_base` no coincide y otro cambio tocó el mismo campo, devolver el
  registro como **"Con observaciones"**; si fueron campos distintos, aplicar ambos.
- Campo **`version`** en las tablas que se editan, para poder detectarlo.

## 6. Permisos que cambian respecto a lo acordado antes

| Endpoint | Antes | Ahora (matriz del sprint) |
| --- | --- | --- |
| `POST /alumnos`, `PATCH /alumnos/{id}` | solo Docente | **Docente y Supervisor** (D1) |
| `GET /usuarios`, `POST /usuarios` | Supervisor y Directivo | **solo Supervisor** (D2) |
| `POST /usuarios` con `id_rol=3` | 403 al Supervisor | **permitido**: el Supervisor crea todos los roles (D2) |
| `PATCH /usuarios/{id}/activar` y `/desactivar` | Supervisor y Directivo | **solo Supervisor** |

El Directivo queda **sin acceso a Usuarios**: solo Inicio y Dashboard.

## 7. Docente con varias asignaciones

`POST /profesores` y `PATCH /profesores/{id}` deben aceptar **varios colegios y
varias secciones por colegio** en la misma llamada — hoy la asignación se crea
aparte, una por una, y el popup de Usuarios las envía juntas.

## 8. Lo que ya está pedido y sigue pendiente

- El núcleo académico (`/rubrica-semanal`, `/reporte-semanal`,
  `/evaluacion-diagnostica`, `/nivel-final-mensual`): sin él, las tres grillas
  del aula siguen con datos simulados y la demo offline no toca datos reales.
- `GET /periodos-academicos`: el selector de periodo de las asignaciones solo
  puede ofrecer los que ya aparecen en alguna asignación existente.

---

## 9. Añadido tras *Actualización de casos de uso* (07/10/2026)

### 9.1 Asistencia por fecha (CU de Asistencia, T30)

Sección **nueva** del Docente, distinta del Seguimiento de Lectura: la grilla es
**por fecha**, no por semana.

- `GET /asistencia?colegio=&grado=&seccion=&fecha=` → la grilla, o `404`/`null`
  si no existe todavía para esa fecha.
- `POST /asistencia/grilla` → `{ id_colegio, id_grado, id_seccion, fecha }`
  crea la grilla con **una fila vacía por alumno**. No debe copiar datos de
  otra fecha.
- `PUT /asistencia/{id_grilla}` → guardado masivo de las filas
  `{ id_alumno, presente, observacion }`.

La Rúbrica debe poder **leer de aquí** si el alumno estuvo ausente, para
deshabilitar Fluidez y Comprensión (T32).

### 9.2 Resumen del Módulo de Inicio (CU010, CU011, CU012)

Una llamada por rol, no cuatro sueltas: con la conectividad de RN-017 cada
petición extra cuenta.

- `GET /inicio/docente` → colegios, grados, ciclos, subprograma, número de
  alumnos asignados y el avance para los Resúmenes de Acción
  (*"Has evaluado a 15 de 30 alumnos"*).
- `GET /inicio/supervisor` → colegios registrados, docentes activos, docentes
  **con actividad en curso**, registros pendientes o incompletos y las
  **Alertas de Inactividad** ya redactadas.
- `GET /inicio/directivo` → `{ beneficiarios_activos, colegios_operando, salud_sistema }`.

> **Sobre `salud_sistema`:** debe salir de datos reales de sincronización. Si no
> se puede calcular, devolver `null` — el caso de uso **prohíbe** mostrar un
> porcentaje estimado, así que la interfaz pinta "No disponible" en ese caso.

> **Sobre las alertas:** los umbrales (4 días sin actividad, una semana sin
> registros) deben ser **configurables en el servidor**, no codificados en la
> interfaz. Envíen el texto ya redactado.

### 9.3 Actividad de trabajo del Docente (CU009, CU010)

Ya pedido en el punto 3, con dos precisiones que añaden estos casos de uso:

- El cierre debe guardar el **tipo**: `manual` o `automatico_por_expiracion`.
- La **duración** se calcula de inicio a fin y queda en el histórico que
  consulta el Supervisor en Seguimiento.

### 9.4 Detalle de una sesión (CU025, T20)

- `GET /sesiones/{uuid}` → los registros afectados con `entidad`, `registro_id`,
  `campo`, `valor_anterior`, `valor_nuevo`, `fecha_cliente` y `fecha_servidor`.
- `GET /sesiones?docente=&colegio=&fecha=` → los tres filtros que pide T20 para
  el Supervisor.

### 9.5 Permisos de la sección nueva

`Asistencia` sigue la misma regla que Rúbrica: el **Docente** escribe sobre sus
secciones asignadas y el **Supervisor** solo lee, sobre todos los docentes.

---

## 10. Añadido al cerrar T32, T20 y T19 (07/10/2026)

### 10.1 Grillas semanales: existencia y creación (T32)

Una grilla **no existe hasta que alguien la crea**. El sistema no debe
generarla sola ni copiar la de la semana anterior: copiar daría por evaluado a
un alumno que nadie miró.

- `GET /grillas?tipo=rubrica|lectura&semana=&colegio=&grado=&seccion=` →
  `{ existe: true|false }`.
- `POST /grillas` → `{ tipo, id_semana, id_colegio, id_grado, id_seccion }`
  crea la grilla con **una fila vacía por alumno**.

### 10.2 Ausentes para la Rúbrica (T32)

- `GET /asistencia/ausentes?colegio=&grado=&semana=` → `[id_alumno]`.

La Rúbrica deshabilita Fluidez y Comprensión de quien conste ausente, para que
la falta se marque **una sola vez**, en Asistencia. Si no hay grilla de
asistencia para esa semana, devolver lista vacía: *nadie consta ausente* no es
lo mismo que *todos asistieron*.

### 10.3 Filtros de Sesiones (T20)

`GET /sesiones` debe aceptar `?docente=`, `?colegio=` y `?fecha=` combinables.

El **detalle** (`GET /sesiones/{uuid}`) necesita, por cada cambio: `entidad`
legible (p. ej. *"Rúbrica — Pérez Quispe, Ana"*), `campo`, `valor_anterior`,
`valor_nuevo`, `fecha_cliente` y `fecha_servidor`. Las dos fechas son las que
permiten marcar *"Sincronizado de forma diferida"*.

### 10.4 Secciones y ciclo en los mantenimientos (T17)

Ya pedido en el punto 1, con dos precisiones:

- **`id_ciclo_evaluado` en el alumno**, separado de `id_grado`: un alumno de
  6.º puede evaluarse con la rúbrica del ciclo III (RN-004).
- **`POST`/`PATCH /profesores` con varias secciones por colegio**, no solo
  varios colegios. El popup de Usuarios ya las envía juntas.
- **`secciones` en el colegio** como lista de `{ id_grado, nombre }`, no como
  texto libre: hoy es lo único que impide asignar un alumno a su sección.

### 10.5 Lo que el frontend ya resuelve solo

No hace falta endpoint para esto, queda anotado para que no se duplique:

- La **precarga** al iniciar actividad guarda alumnos, colegios, grados,
  catálogos, **semanas y las asignaciones del docente** en IndexedDB, con las
  llamadas que ya existen.
- La **limpieza de IndexedDB** al cerrar sesión se hace **solo si la cola está
  vacía**: CU007 prohíbe borrar cambios sin enviar, y el PDF pide limpiar por
  tratarse de datos de menores. Las dos reglas conviven así.
- La **expiración a las 8 horas** se programa en el cliente leyendo el `exp` del
  JWT. Es solo para avisar a tiempo: quien decide sigue siendo el servidor.

---

## 11. Añadido al cerrar el trabajo sin conexión (07/10/2026)

Nada de este punto es **bloqueante**: el frontend ya funciona con los endpoints
actuales. Se anota lo que haría falta para que el trabajo sin conexión aguante
bien en zonas con mala cobertura, que es donde se va a usar.

### 11.1 Permisos de lectura para la precarga (importante)

Al pulsar *Iniciar actividad*, el **Docente** llama por su cuenta a:

- `GET /docentes/{id}/asignaciones?periodo=`
- `GET /semanas`
- `GET /colegios`, `GET /grados`, `GET /niveles-rubrica`, `GET /niveles-razkids`
- `GET /alumnos?estado=activo`

Si alguno de estos está restringido a `Supervisor`, la precarga se queda
incompleta y el docente se queda sin datos justo cuando pierde la conexión. El
fallo es **silencioso para el backend**: el frontend no rompe, solo avisa de
*"Precarga incompleta"*. Conviene confirmar que el rol `Docente` puede leer los
seis, acotado a lo suyo.

### 11.2 Una sola petición de precarga (deseable)

- `GET /precarga?periodo=` → `{ alumnos, colegios, grados, semanas,
  asignaciones, niveles_rubrica, niveles_razkids }`

Hoy son **siete peticiones en paralelo** sobre la conexión del colegio. Si tres
responden y cuatro fallan, el docente arranca con una precarga a medias sin
saber qué le falta. Una sola respuesta lo vuelve atómico: o está todo o no está.

Mientras no exista, el frontend seguirá con las siete y avisando cuando alguna
falle.

### 11.3 Lo que el frontend ya resuelve solo (no hacer nada)

- Si una pantalla se abre **sin red**, sus filtros se rellenan desde lo
  precargado en IndexedDB en vez de quedarse vacíos.
- El **Supervisor no precarga** nada: no abre actividades. Si se decide que
  también debe trabajar sin conexión, habría que hablarlo antes, porque implica
  bajarse los datos de **todos** los docentes a un dispositivo.

---

## 12. Actualización de casos de uso (07/10/2026) — CU001 a CU006

Los casos de uso actualizados **contradicen el contrato vigente** en dos puntos.
No es una mejora opcional: con el backend actual, el flujo de recuperación
queda roto a mitad de camino. El frontend ya implementa lo que dicen los CU.

### 12.1 ⚠️ BLOQUEANTE — La política de contraseña es incompatible

| | Contrato actual (§ *Recuperar contraseña*) | CU006 |
| --- | --- | --- |
| Longitud | mínimo 8 | mínimo 8 |
| Símbolos | **prohibidos** | **obligatorio al menos uno** |
| Mayúscula / minúscula / número | no se exigen | se exigen las tres |

Las dos reglas no pueden cumplirse a la vez: **toda contraseña válida según
CU006 es rechazada hoy con `422`**, porque lleva un símbolo. El formulario ya
exige los cinco requisitos de CU006, así que hasta que el backend cambie, nadie
podrá completar un restablecimiento.

Lo que debe aceptar `POST /password/restablecer` y `POST /me/password`:

- mínimo 8 caracteres;
- al menos una mayúscula, una minúscula, un número y **un carácter especial**;
- distinta de la contraseña inmediatamente anterior.

### 12.2 El código pasa a ser un PIN de 6 dígitos

CU005 lo redefine. Lo actual son 6 caracteres alfanuméricos con 10 minutos de
vigencia; lo que hace falta:

- **6 dígitos numéricos** (0–9), no alfanumérico.
- Vigencia de **15 minutos**, no 10.
- Máximo **5 intentos fallidos** de validación; al quinto, el PIN se invalida.
- Máximo **5 solicitudes por hora** y por correo ingresado, aplicando el límite
  igual a correos registrados, no registrados y cuentas desactivadas.
- **Un único PIN vigente por cuenta**: generar uno nuevo invalida el anterior.
- Un PIN usado, expirado, reemplazado o agotado no se reutiliza.

### 12.3 `motivo` en los errores del PIN

CU006 exige tres mensajes distintos, y hoy los tres llegan como un único `400`
con `"Código incorrecto o expirado"`, así que el frontend no puede saber cuál
mostrar. Basta con añadir un campo al cuerpo del error:

```json
{ "detail": "...", "motivo": "incorrecto" }
```

| `motivo` | Mensaje que mostrará el frontend |
| --- | --- |
| `incorrecto` | El código ingresado es incorrecto. Inténtelo nuevamente. |
| `expirado` | El código ha expirado. Solicite un nuevo PIN. |
| `intentos_agotados` | Se alcanzó el número máximo de intentos permitidos. Solicite un nuevo PIN para continuar. |
| `password_igual` | La nueva contraseña debe ser diferente de la contraseña anterior. |

Mientras no llegue `motivo`, se muestra el texto del servidor tal cual: es
preferible a adivinar cuál de los tres fue.

### 12.4 `429` al quinto intento de login fallido

CU002 fija el bloqueo temporal, que hoy no existe:

- **5 intentos consecutivos fallidos** sobre el mismo correo ingresado →
  bloqueo de **15 minutos** para ese correo.
- Se aplica igual exista la cuenta o no, y esté activa o desactivada: si el
  bloqueo se comportara distinto, serviría para averiguar qué correos existen.
- Un intento sobre una **cuenta desactivada cuenta como fallido**.
- El bloqueo **no cambia** el estado activo/inactivo de ninguna cuenta.
- Una autenticación satisfactoria reinicia el contador.

El frontend ya distingue `429` y muestra el texto de CU002. Si el backend
responde `401` también durante el bloqueo, el usuario leerá "Correo o contraseña
incorrectos" y seguirá intentando sin entender por qué nunca entra.

### 12.5 Textos que el backend ya no decide

Estos mensajes los fija el caso de uso y el frontend los escribe por su cuenta,
ignorando el `detail` del servidor. Se anota para que nadie intente "arreglar"
el texto desde el backend:

- `401` → `Correo o contraseña incorrectos.`
- `403` (cuenta desactivada) → `Su cuenta se encuentra desactivada. Comuníquese con el Supervisor para solicitar su habilitación.`
- `429` → `Demasiados intentos fallidos. Por seguridad, intente nuevamente en 15 minutos.`
- Tras pedir PIN, siempre → `Si el correo está registrado y activo, recibirá un PIN.`

### 12.6 Invalidar las sesiones al restablecer

CU006: un restablecimiento satisfactorio debe invalidar **todas las sesiones y
tokens vigentes** del usuario. Hoy el backend no revoca JWT (lo dice la sección
de `logout`), así que un token emitido con la contraseña anterior sigue siendo
válido hasta que expire. Con la contraseña ya cambiada, eso es justo lo que
CU006 prohíbe. Hace falta una lista de revocación o un `token_version` por
usuario que invalide lo emitido antes del cambio.

### 12.7 Cuenta de Supervisor original

CU001 y CU016 la describen y el backend tendrá que marcarla:

- No puede eliminarse ni desactivarse **por nadie**, ni editarse su rol.
- Necesita exponerse como un campo (p. ej. `es_supervisor_original: true`) en
  `GET /usuarios`, para que la interfaz bloquee el interruptor y el lápiz en vez
  de dejar intentarlo y fallar con un error.
- Recuperación por **Recovery Keys** de un solo uso, entregadas en un `.txt`, sin
  depender del correo. Es un flujo que el frontend todavía **no** implementa: si
  se quiere en la aplicación, hace falta decidir su pantalla.

### 12.8 CU003 — Qué llama el frontend al entrar a Inicio

Ya implementado en el cliente, se anota para que el backend conozca la carga.
Cada vez que un usuario entra al Módulo de Inicio **con conexión**, se lanza una
sincronización silenciosa en segundo plano, acotada por rol:

| Rol | Qué baja a IndexedDB |
| --- | --- |
| Docente | alumnos activos, asignaciones, colegios, grados, semanas, niveles |
| Supervisor | alumnos activos, colegios, grados, semanas |
| Directivo | **nada** — no trabaja sin conexión (CU012) |

Son peticiones `GET` normales y no bloquean la pantalla. Si alguna falla, se
conserva la última copia buena y no se avisa al usuario. Si esto resultara
costoso en el servidor, el endpoint único del punto 11.2 lo resolvería de golpe.

