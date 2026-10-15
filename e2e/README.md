# Pruebas E2E (Playwright)

Recorren SICEDU desplegado en **qa** (backend y base de datos reales) con las cuentas que crea el
seed del backend en cada despliegue (`python -m app.cli sembrar-e2e`). En Jenkins corren en la rama
`qa`, después del deploy.

qa se compila con `VITE_USE_MOCK=true`, `VITE_AUTH_REAL=true` y `VITE_ADMIN_REAL=true`. Solo se prueban
módulos **reales**: login, `/me`, logout, Inicio de los 3 roles, actividades, Colegios, Alumnos,
Usuarios, historial del alumno y Seguimiento. Rúbrica, Seguimiento de Lectura, Registro de Vuelo,
Asistencia, Dashboard y la ficha `/estudiantes/:id` siguen en mock y no se prueban (salvo para
comprobar que el Directivo **no llega** al Dashboard).

| Archivo | Flujo |
|---|---|
| `f1-acceso-por-rol.spec.js` | Cada rol llega a su Inicio; la cuenta inactiva se rechaza |
| `f2-control-de-acceso.spec.js` | Docente y Directivo terminan en /403 en secciones ajenas |
| `f3-jornada-docente.spec.js` | Actividad → alta y baja de un alumno → Sesiones |
| `f3b-cu015-historial-alumno.spec.js` | CU015: el historial muestra la creación (D29, corregido) |
| `f4-gestion-usuarios.spec.js` | La Supervisora crea e inactiva un Docente |
| `f5-indicadores-directivo.spec.js` | 3 tarjetas del Directivo, sin datos de alumnos |
| `f5b-cu012-directivo-sin-estudiantes.spec.js` | CU012/RN-033: el Directivo no llega al Dashboard (corregido) |
| `f6-cierre-sesion-con-actividad.spec.js` | Cerrar sesión fuerza el cierre de la actividad |
| `f7-seguimiento.spec.js` | La Supervisora ve al Docente E2E y la actividad de F3 |

Corren en serie y en ese orden: F5 y F7 usan el alumno y la actividad que F3 deja en
`test-results/e2e-state.json`.

## Variables

| Variable | Qué es |
|---|---|
| `BASE_URL` | `https://qa-huascaran.ingsoftware.lat` |
| `E2E_DOCENTE_USER` / `_PASS` | Docente E2E |
| `E2E_SUPERVISOR_USER` / `_PASS` | Supervisora E2E |
| `E2E_DIRECTIVO_USER` / `_PASS` | Directivo E2E |
| `E2E_INACTIVO_USER` / `_PASS` | Directivo E2E siempre inactivo |

En local van en `.env.e2e` (copiar `.env.e2e.example`; está en `.gitignore`). En Jenkins llegan como
credenciales. **Las contraseñas no pasan por el navegador**: el formulario recibe un marcador y
`e2e/support/sesion.js` reenvía el `POST /api/login` desde Node con la contraseña real, para que no
queden en el trace, el video ni las capturas.

## Correrlas

Sin Node instalado, con la misma imagen que usa Jenkins (desde la raíz del repositorio):

```bash
docker run --rm --ipc=host --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD":/w -w /w mcr.microsoft.com/playwright:v1.63.0-noble \
  sh -c 'npm ci --no-audit --no-fund && npm run test:e2e'
```

Con Node: `npm ci && npm run test:e2e`. Para ver el reporte: `npm run test:e2e:report`.

Cada prueba deja video, trace y capturas en `test-results/`, y el reporte HTML en
`playwright-report/`, pasen o fallen.

## Riesgos conocidos

- **Bloqueo por intentos fallidos (CU002):** 5 fallos de login en 15 minutos bloquean el correo. F1
  corre sin reintentos para no sumar intentos. El seed limpia el bloqueo en cada despliegue de qa;
  entre despliegues, si una cuenta queda bloqueada hay que esperar 15 minutos.
- **No correr la suite en local justo antes de un build de qa:** local y Jenkins usan las mismas
  cuentas de qa. La cuenta inactiva nunca inicia sesión con éxito, así que cada corrida (local o
  de CI) le suma un intento fallido y ningún login correcto le reinicia el contador: al quinto queda
  bloqueada 15 minutos. Si el build de qa llega en ese lapso, el test «Cuenta inactiva» de F1
  recibe 429 y se salta con la anotación `[limpieza]`. Corra en local con margen antes de un build,
  o espere 15 minutos.
- **Días sin periodo académico vigente:** sin periodo el Docente no tiene asignaciones y no puede
  iniciar actividad (CU010). F3 y F6 verifican el mensaje y se saltan con la anotación
  «fuera de periodo académico (CU010)»; F7 y el test de D29 se saltan porque F3 no dejó datos.
- **Datos que quedan en qa:** cada corrida deja un alumno `E2E-<marca>` inactivo y un Docente
  `E2E-<marca>` inactivo (F4 inactiva al empezar los que hayan quedado activos).
- **Correos reales:** F4 crea la cuenta con `soloparaunuso123+e2e.f4.<marca>@gmail.com`, así que el
  backend envía un correo de bienvenida a esa bandeja en cada corrida.
