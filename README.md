# SICEDU — Frontend

Interfaz web de **SICEDU** (Sistema de Centralización de Datos Educativos) para el programa de
lectoescritura de Misión Huascarán. Reemplaza las planillas de Excel con las que nueve colegios de
primaria (413 estudiantes) registran el avance lector: reporte semanal, rúbrica de Fluidez y
Comprensión, las cuatro evaluaciones diagnósticas del año con sus datos de Raz-Kids, el nivel final
con su justificación, y los consolidados para la Jefatura y los Directivos.

Proyecto del curso CS3081 Ingeniería de Software. Consume la API REST en FastAPI del repositorio
del backend.

## Levantarlo

Requiere Node 20.

```bash
npm install
cp .env.example .env
npm run dev
```

Abre http://localhost:5173.

Por defecto el inicio de sesión va contra el backend (`VITE_AUTH_REAL=true`), así que debe estar
levantado en `http://127.0.0.1:8000`. Para trabajar **sin backend**, pon `VITE_AUTH_REAL=false` en
`.env`: todo sale del modo mock, con datos ficticios.

| Modo | Cuentas | Contraseña |
|---|---|---|
| Backend real | `profesor.prueba@sicedu.test` · `jefa.prueba@sicedu.test` · `directivo.prueba@sicedu.test` | `ProfesorTest123` · `JefaTest123` · `DirectivoTest123` |
| Mock | `rcardenas@sicedu.test` (Profesor) · `jefatura@sicedu.test` (Jefa) · `direccion@sicedu.test` (Directivos) | `sicedu123` |

En desarrollo, la pantalla de inicio de sesión lista las cuentas del modo activo con un botón *Usar*.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo, con proxy de `/api` al backend |
| `npm run build` | Construcción de producción en `dist/` |
| `npm run preview` | Sirve `dist/` localmente |
| `npm run test` | Pruebas (Vitest), siempre contra el mock |
| `npm run lint` | ESLint |
| `npm run verificar:backend` | Consulta la API real y reporta qué endpoints existen |

## Roles

| Rol | Entra a | Puede |
|---|---|---|
| Profesor | `/inicio` | Capturar el reporte semanal, la rúbrica y las evaluaciones de sus colegios; consultar los demás en solo lectura |
| Jefa_Profesores | `/dashboard` | Ver los nueve colegios, consolidados, alertas y administración |
| Directivos | `/panel-ejecutivo` | Solo lectura: indicadores, colegios, estudiantes y descargas |

Un rol que entra por URL a una pantalla ajena termina en `/403`.

## Estructura

```
src/
├─ api/          cliente HTTP, endpoints, mock y un recurso por dominio
├─ auth/         sesión, guardas de ruta, roles y lectura del JWT
├─ components/
│  ├─ ui/        componentes base del sistema de diseño
│  ├─ layout/    shell, barra lateral, barra superior
│  └─ charts/    gráficos (recharts, carga diferida) y su tema
├─ domain/       reglas de negocio puras: nivel final, niveles, totales
├─ features/     una carpeta por pantalla
├─ hooks/        catálogos, cola offline, utilidades
├─ lib/          formato, exportaciones, cola offline
├─ store/        zustand: sesión, filtros, sincronización
└─ styles/
```

`src/domain/nivelFinal.js` es la **única** fuente del cálculo del nivel final (RN-009); ninguna
pantalla replica esa lógica.

## Despliegue

```bash
docker build -t fe-huascaran .
docker run -d -p 80:80 -e API_UPSTREAM=http://backend:8000 fe-huascaran
```

Contenedor de dos etapas (Node construye, Nginx sirve). Detalles en
[STACK_FRONTEND.md](STACK_FRONTEND.md#7-despliegue).

## Ramas

`development` (trabajo diario) → `qa` (testers) → `uat` (presentaciones, con autorización del PM) →
`main` (protegida). Todo cambio sube por Pull Request.

## Documentación

- [EjecutarFront_Y_Comandos.md](EjecutarFront_Y_Comandos.md) — cómo ejecutarlo y cómo usar Git en el proyecto
- [STACK_FRONTEND.md](STACK_FRONTEND.md) — stack, justificación, API, RNF y despliegue
- [docs/trazabilidad-rf.md](docs/trazabilidad-rf.md) — qué pantalla cubre cada requerimiento
- [ESTADO.md](ESTADO.md) — avance y decisiones abiertas
- [APIS_BACKEND.md](APIS_BACKEND.md) — contrato del backend
- [PROMPT_FRONTEND_SICEDU.md](PROMPT_FRONTEND_SICEDU.md) — especificación original
