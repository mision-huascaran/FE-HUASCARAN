# Contexto del proyecto SICEDU — Backend (sesión del 17 de septiembre, 2026)

## Sobre el proyecto
Backend de SICEDU (Sistema de Centralización de Datos Educativos), para la ONG Misión Huascarán — curso CS3081 Ingeniería de Software (UTEC). Rol: backend developer. Repo: `BCK-SICEDU`, en `Ing Soft/BCK-SICEDU`.

**Stack:** Python + FastAPI + PostgreSQL + SQLModel (ORM) + JWT propio (python-jose + passlib/bcrypt) + Docker Compose (2 contenedores en el servidor del curso) + Alembic (migraciones).

**Estructura de carpetas:** `app/core` (config, security, database), `app/models` (SQLModel, organizados en 5 grupos según `diseno_bd_sicedu.md`), `app/schemas` (DTOs de request/response), `app/routers` (endpoints, un archivo por dominio), `app/services` (lógica de negocio), `app/dependencies.py` (Depends compartidos como `get_db`, `get_current_user`).

**Convenciones de repo del curso:** ramas obligatorias `development → qa → uat → main`; nomenclatura `BCK-{PROYECTO}` (un solo backend, no microservicios); webhook de GitHub hacia Jenkins (`https://jenkins.ingsoftware.lat/github-webhook/`) para CI/CD automático en cada push.

## Lo implementado hasta ahora

**1. Setup inicial:** repo Git, venv, estructura de carpetas, `.gitignore` antes del primer commit.

**2. Config + Database + Modelos Grupo 1 + Alembic:**
- `app/core/config.py` (Pydantic Settings, lee `.env`: `DATABASE_URL`, `JWT_SECRET_KEY`, `JWT_ALGORITHM=HS256`, `ACCESS_TOKEN_EXPIRE_MINUTES=480`).
- `app/core/database.py` (engine SQLModel + `get_db()`).
- `app/models/organizacion.py` — las 12 tablas del Grupo 1 (periodo_academico, periodo_evaluacion, colegio, ciclo_ebr, grado, programa, docente, rol, usuario, alumno, docente_colegio_grado, alumno_programa_historial).
- Alembic configurado (`env.py` lee `DATABASE_URL` desde `config.py`, reconoce los modelos), primera migración generada y aplicada. 13 tablas confirmadas en la BD (12 + `alembic_version`).

**3. Autenticación JWT — HU14 completa:**
- `app/core/security.py` (hash/verify con passlib+bcrypt, crear/decodificar JWT).
- `app/schemas/auth.py` (`LoginRequest`, `TokenResponse`, `UsuarioResponse` sin password_hash).
- `app/services/auth_service.py` (`authenticate_user`, sin excepciones HTTP).
- `app/dependencies.py` (`get_current_user`, 401 si token inválido/expirado/usuario inactivo).
- `app/routers/auth.py` — `POST /login`, `POST /logout`, `GET /me`. Rutas SIN prefijo `/auth` (decisión tomada por consistencia con `stack-tecnologico-sicedu.md`).
- `app/seed_data.py` — usuarios de prueba ficticios (dominio `.test`), idempotente (seguro correr varias veces). Usuarios: `Profesor` (con `id_docente`), `Jefa_Profesores` (sin `id_docente`), y se estaba agregando `Directivos` (mismo patrón que Jefa_Profesores) — confirmar si ese cambio ya se aplicó y se pusheó.
- Los 4 criterios de aceptación verificados en vivo (Swagger + Postman + curl): login válido, login inválido (401), logout, sesión se conserva.
- **Diseño:** JWT stateless, sin invalidación forzada — logout es responsabilidad del frontend (borrar el token guardado). Token dura 8h por decisión de diseño (sin refresh token en el alcance actual).

**4. Dockerfile + docker-compose.yml:**
- `Dockerfile`: `python:3.11-slim`, copia+instala `requirements.txt` antes de copiar el resto (cache de capas), expone 8000, arranca con `uvicorn --host 0.0.0.0`.
- `docker-compose.yml`: **un solo servicio** (`backend`) — NO hay contenedor propio de base de datos en el compose, porque existe un **servidor PostgreSQL compartido externo, gestionado por el curso**, con 3 bases de datos por ambiente (`mision_huascaran_dev/_qa/_uat`), mismo host/usuario/password, Jenkins inyecta las variables según la rama que despliega. El comando del backend corre `alembic upgrade head && uvicorn ...` (fail-fast: si la migración falla, no levanta el servidor).

**5. Infraestructura de repo:** webhook GitHub→Jenkins creado y confirmado (`Last delivery was successful`). Ramas `qa` y `uat` creadas. Rama default cambiada a `main`.

## Errores encontrados y cómo se resolvieron (referencia para el futuro)

1. **`git checkout main` fallaba** — la rama nunca tuvo un commit real (el primer commit se hizo parado en `development`). Fix: `git checkout -b main` para crearla desde el commit existente.

2. **GitHub rechazaba push con contraseña normal** — GitHub ya no acepta password de cuenta para Git por HTTPS. Fix: generar un Personal Access Token (scope `repo`) y usarlo como password.

3. **`ModuleNotFoundError: pydantic_settings`** — `BaseSettings` se movió a paquete separado en Pydantic v2. Fix: `pip install pydantic-settings`.

4. **`requirements.txt` en UTF-16** — causado por `pip freeze > requirements.txt` mal ejecutado en PowerShell. Fix: `pip freeze | Out-File -Encoding utf8 requirements.txt`.

5. **Conflicto de puerto 5432 — el más largo del día.** `UnicodeDecodeError` al generar la migración, que en realidad ocultaba un `FATAL: password authentication failed` de Postgres (mensaje en español mal decodificado por psycopg2 en Windows). Causa real: un `postgres.exe` corriendo como **servicio nativo de Windows** competía por el puerto 5432 con el contenedor Docker — las conexiones llegaban al Postgres equivocado. Fix: recrear el contenedor en el puerto **5433** (`-p 5433:5432`). Diagnóstico clave: `netstat -ano | findstr :5432` + `tasklist /FI "PID eq ..."` para identificar el proceso en conflicto.

6. **`import sqlmodel` faltante en migraciones autogeneradas** — bug conocido SQLModel+Alembic (la plantilla base no incluye ese import, pero autogenerate lo referencia). Fix: agregado a mano en la migración existente + editado `alembic/script.py.mako` para que futuras migraciones lo incluyan automáticamente.

7. **`passlib` + `bcrypt` incompatibles** — `bcrypt>=4.1` eliminó `__about__`, que `passlib` (sin mantenimiento desde 2020) necesita. Fix: fijar `bcrypt==4.0.1` en `requirements.txt` (mantiene el patrón "passlib con bcrypt" del stack decidido, en vez de migrar a bcrypt directo).

8. **`127.0.0.1` vs `host.docker.internal`** — dentro de un contenedor Docker, `127.0.0.1` se refiere al propio contenedor, no a la laptop anfitriona. Regla: `127.0.0.1` cuando el backend corre suelto en `venv`; `host.docker.internal` solo cuando corre empaquetado vía `docker-compose up`. Confundir los dos genera `Connection timed out` — hay que revertir el `.env` al volver de un modo al otro.

## Pendientes explícitos

- Validación de correo (`EmailStr` en vez de `str` plano) — no agregado para no sumar dependencia sin acordarla.
- Corregir la contradicción de prefijo de rutas en `estructura-backend-sicedu.md` (dice ambas cosas: con y sin `/auth`).
- Confirmar con el PM (Franco) el mecanismo exacto de cómo Jenkins va a inyectar `.env.development/.qa/.uat` (Credentials/Environment Variables de Jenkins, aún no verificado).
- Modelos de los Grupos 2 a 5 (catálogo de evaluación, registro semanal, cálculo de nivel/delta, ingesta/consolidado) — no implementados aún.
- Autorización por rol en endpoints futuros (alumnos, reportes) — hasta ahora solo se construyó autenticación (quién eres), no autorización (qué puedes hacer).
- Cada compañero de equipo corre su propia base de datos local aislada — el seed de uno no se refleja automáticamente en la del otro; hay que correr el script después de cada pull si cambia.

## Reglas de trabajo con Claude Code (mantener en toda tarea futura)

- Hacer únicamente lo listado en cada tarea puntual — no adelantar trabajo de tareas futuras.
- Ante cualquier incoherencia, dato faltante o contradicción entre documentos: reportarlo, nunca resolverlo por cuenta propia ni asumir una respuesta.
- Si la incoherencia es crítica (puede llevar a código incorrecto o contradictorio con el resto del proyecto): detenerse ahí mismo, no seguir con el resto de la tarea, explicar el problema antes de continuar.
- No correr comandos que modifiquen la base de datos real (migraciones, seeds) sin mostrar antes el archivo/cambio para revisión.
- Al terminar (o detenerse), dar un resumen de archivos creados/modificados y las decisiones tomadas en puntos no especificados exactamente por el diseño.

---

# Contexto del proyecto SICEDU — Backend (sesión del 22 de septiembre, 2026)

Continuación de la sesión anterior. Repo renombrado/transferido durante esta sesión: el remote pasó de `Parislht/BCK-SICEDU` a `mision-huascaran/BCK-HUASCARAN` (GitHub redirige automáticamente, pero el `origin` local ya se actualizó a la URL nueva).

## 1. Modelo de datos v2 (Instrucción 1)

El Grupo 1 (organización) se actualizó al diseño v2 acordado por el equipo tras 20 correcciones. La migración se **regeneró desde cero (squash)**, no de forma incremental — se borró la migración inicial vieja y se generó una nueva que crea las 12 tablas del Grupo 1 como si fuera la primera vez, sin arrastrar el historial v1.

**Swap de nombres (el cambio más propenso a confusión):**
- `PeriodoAcademico` (antes representaba el **año** escolar) → renombrada a `AnioEscolar`, tabla `año_escolar`, PK `id_anio_escolar`.
- `PeriodoEvaluacion` (antes representaba el **bimestre**) → renombrada a `PeriodoAcademico`, tabla `periodo_academico`, PK `id_periodo_academico`, FK `id_anio_escolar → año_escolar.id_anio_escolar`.
- Es decir, el nombre de tabla `periodo_academico` se reutiliza pero para una entidad distinta (antes año, ahora bimestre) — es intencional, no un error.

**Campos de auditoría** (`creado_por`, `creado_en`, `modificado_por`, `modificado_en` — tipo `date`, igual que el resto del modelo, no `timestamp`) agregados a las tablas no-catálogo. `creado_por`/`creado_en` son `NOT NULL` (FK a `usuario.id_usuario`); `modificado_por`/`modificado_en` son opcionales.

- **Con auditoría:** `año_escolar`, `periodo_academico`, `colegio`, `docente`, `usuario`, `alumno`, `docente_colegio_grado`, `alumno_programa_historial`.
- **Sin auditoría (catálogo puro, excepción acordada por el equipo):** `ciclo_ebr`, `grado`, `programa`, `rol` (Grupo 1) — y, cuando se creen, también las 4 tablas de catálogo del Grupo 2 (`nivel_razkids`, `nivel_rubrica`, `nivel_general`, `nivel_esperado_por_grado`), que todavía no existen en el código.
- `Usuario.creado_por` es una **auto-referencia** (`usuario.id_usuario`); el seed la resuelve insertando el primer usuario con un valor placeholder y corrigiéndolo con un `UPDATE` una vez que se conoce su `id_usuario` real.

**Otros cambios del modelo:**
- `alumno.classroom_razkids` **eliminado**.
- Bug de SQLModel+Alembic: dependencia circular de FKs entre `docente` y `usuario` (`docente.creado_por → usuario`, `usuario.id_docente → docente`) rompía el orden de `CREATE TABLE` autogenerado. Se corrigió a mano sacando esas dos FKs del `create_table` de `docente` y agregándolas después con `create_foreign_key`, una vez que `usuario` ya existe (mismo patrón para el `downgrade`, con los `drop_constraint` correspondientes antes de dropear las tablas).
- Roles renombrados en el catálogo `rol`: `Profesor` → `Docente`, `Jefa_Profesores` → `Supervisor`, `Directivos` → `Directivo`. (Las variables internas del seed como `PROFESOR_CORREO` no se renombraron — quedó fuera de alcance a propósito.)

## 2. Fix de login (Instrucción 2)

**Bug original:** `authenticate_user` (`app/services/auth_service.py`) trataba "el correo no existe" y "la cuenta existe pero está inactiva" como el mismo caso (ambos devolvían `None`), así que `/login` siempre respondía el mismo mensaje genérico — un docente deshabilitado no tenía forma de saber que su cuenta estaba inhabilitada en vez de haber escrito mal la contraseña. Además había dos problemas de seguridad: el orden de checks revisaba `activo` antes que la contraseña (permitía enumerar cuentas deshabilitadas sin conocer la contraseña), y no había verificación de contraseña cuando el usuario no existía (timing leak: se podía inferir qué correos existen midiendo tiempo de respuesta, porque `verify_password`/bcrypt es lento y solo corría si el usuario existía).

**Solución:**
- Orden correcto: **contraseña primero, `activo` después** — "cuenta deshabilitada" solo se revela a quien ya demostró conocer la contraseña correcta.
- `authenticate_user` ahora corre `verify_password` contra un hash dummy (`DUMMY_HASH`) cuando el usuario no existe, para mantener el tiempo de respuesta uniforme.
- Los casos de fallo se comunican con excepciones de dominio, no `None` ni `HTTPException` (el service sigue agnóstico de HTTP): `CredencialesInvalidas` (correo no existe o contraseña incorrecta → **401**, mismo mensaje de siempre) y `CuentaInactiva` (contraseña correcta pero cuenta desactivada → **403** nuevo, mensaje distinto). El router (`app/routers/auth.py`) captura ambas y las mapea a sus códigos HTTP.

**Pendiente:** el test `test_login_de_usuario_inactivo_da_el_mismo_mensaje` en `tests/test_auth.py` afirma el comportamiento viejo (mismo mensaje que credenciales inválidas) y quedó desactualizado a propósito por este fix — pendiente de que **Juan** lo actualice (renombrarlo y ajustar el assert a 403, más un test nuevo que confirme que un usuario inactivo con contraseña incorrecta sigue dando 401 genérico, no 403).

## 3. Endpoints nuevos — referencia de integración para Antonio (Instrucción 4)

Nuevo mecanismo de autorización por rol, reutilizable a futuro: `require_role(*roles_permitidos)` en `app/dependencies.py`. Se usa como cualquier `Depends`; devuelve 403 (`"No tienes permisos para realizar esta acción"`) si el usuario autenticado no tiene uno de los roles pasados. Los 3 `POST` de abajo usan `Depends(require_role("Supervisor"))`; los 3 `GET` solo usan `Depends(get_current_user)` — cualquier usuario autenticado, sin importar el rol, puede leerlos.

### `POST /colegios` — requiere rol Supervisor (403 si no)
Body (`ColegioCreate`):
```json
{ "nombre": "string", "zona": "string | null" }
```
Respuesta (`ColegioResponse`, 200):
```json
{ "id_colegio": 1, "nombre": "string", "zona": "string | null",
  "creado_por": 1, "creado_en": "2026-09-22",
  "modificado_por": null, "modificado_en": null }
```

### `GET /colegios` — cualquier usuario autenticado
Devuelve un array de `ColegioResponse` (todos los colegios).

### `POST /alumnos` — requiere rol Supervisor (403 si no)
Body (`AlumnoCreate`):
```json
{ "nombres": "string", "apellidos": "string",
  "id_colegio": 1, "id_grado": 1, "id_programa_actual": 1,
  "activo": true }
```
(`activo` es opcional, default `true`. No se manda `fecha_registro` — se autocompleta con la fecha del día en el servidor.)

Respuesta (`AlumnoResponse`, 200): igual a lo mandado más `id_alumno`, `fecha_registro`, `creado_por`, `creado_en`, `modificado_por`, `modificado_en`.

**Errores:** si `id_colegio`, `id_grado` o `id_programa_actual` no existen, responde **404** con el detalle de cuál id específico falló, ej. `{"detail": "No existe un grado con id_grado=999"}` — no deja que llegue un error crudo de FK de Postgres.

### `GET /grados` — cualquier usuario autenticado
Array de `GradoResponse`: `{ "id_grado": 1, "nombre": "1.º", "id_ciclo": 1 }`.

### `GET /programas` — cualquier usuario autenticado
Array de `ProgramaResponse`: `{ "id_programa": 1, "nombre": "Alfabetización" }`.

### `POST /profesores` — requiere rol Supervisor (403 si no)
Body (`ProfesorCreate`) — **no lleva contraseña**, la genera el sistema:
```json
{ "nombres": "string", "apellidos": "string", "correo": "string", "activo": true }
```
Respuesta (`ProfesorResponse`, 200):
```json
{ "id_usuario": 1, "id_rol": 1, "correo": "string", "id_docente": 1,
  "nombres": "string", "apellidos": "string", "activo": true,
  "contraseña_temporal": "string | null" }
```

**Comportamiento especial de `contraseña_temporal`:** el sistema genera una contraseña temporal aleatoria y trata de mandarla por correo. Si el correo se envió bien, `contraseña_temporal` viene `null` en la respuesta (la contraseña solo llegó al profesor por mail). Si el envío falló, `contraseña_temporal` viene con el valor real en la respuesta — es el fallback para que el Supervisor se la pueda dar a mano. **Hoy, con las credenciales de Gmail de juguete configuradas (la cuenta real está en período de espera de Google), el envío siempre falla, así que `contraseña_temporal` siempre viene con valor** — Antonio no debería asumir que va a venir `null` hasta que se actualicen las credenciales reales.

**Errores:** **409** si el correo ya está registrado (`{"detail": "El correo ... ya está registrado"}`). **500** en el caso defensivo (no debería pasar en la práctica) de que el rol `Docente` no exista en el catálogo.

No hay endpoints de edición/borrado todavía (solo creación y lectura de catálogos) ni asignación de profesor a colegio/grado (`docente_colegio_grado`) — quedan para instrucciones futuras.

## 4. Catálogos sembrados (`app/seed_data.py`)

- `ciclo_ebr`: `III`, `IV`, `V`.
- `grado` (mapeado a su ciclo según la estructura EBR de primaria en Perú): `1.º`→III, `2.º`→III, `3.º`→IV, `4.º`→IV, `5.º`→V, `6.º`→V.
- `programa`: `Alfabetización`, `Comprensión Lectora`.
- Colegios ficticios (para que las listas no se vean vacías al probar el frontend): `Colegio de Prueba` (zona de Prueba, ya existía) + dos nuevos, `Colegio Yungay` (zona Yungay) y `Colegio Carhuaz` (zona Carhuaz) — las 2 zonas reales documentadas del proyecto.
- El seed sigue siendo idempotente (`if ... is None` antes de insertar) — seguro correr de nuevo tras un `git pull`.
