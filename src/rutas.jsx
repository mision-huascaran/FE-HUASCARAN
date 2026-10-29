import { Navigate, Route, Routes, matchPath } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import PantallaPendiente from './components/layout/PantallaPendiente'
import ProtectedRoute from './auth/ProtectedRoute'
import RoleRoute from './auth/RoleRoute'
import ForbiddenPage from './features/errores/ForbiddenPage'
import InicioPage from './features/inicio/InicioPage'
import DashboardPage from './features/dashboard/DashboardPage'
import LibrosPage from './features/dashboard/LibrosPage'
import MantenimientoColegios from './features/colegios/MantenimientoColegios'
import AlumnosPage from './features/alumnos/AlumnosPage'
import MantenimientoUsuarios from './features/usuarios/MantenimientoUsuarios'
import SesionesPage from './features/sesiones/SesionesPage'
import SeguimientoPage from './features/seguimiento/SeguimientoPage'
import AsistenciaPage from './features/asistencia/AsistenciaPage'
import FichaEstudiantePage from './features/estudiantes/FichaEstudiantePage'
import LoginPage from './features/login/LoginPage'
import RegistroVueloAnualPage from './features/registroVuelo/RegistroVueloAnualPage'
import LecturaPage from './features/lectura/LecturaPage'
import RubricaPage from './features/rubrica/RubricaPage'
import UiKitPage from './features/uiKit/UiKitPage'
import useSessionStore from './store/sessionStore'
import { ROLES, rutaInicioDe } from './auth/roles'

const { PROFESOR, JEFA, DIRECTIVOS } = ROLES

/**
 * Mapa de rutas protegidas (§5), en una sola tabla.
 *
 * `allow` es la lista de `id_rol` que pueden entrar: cualquier otro rol que
 * escriba la URL a mano termina en /403 (RNF-004). Las pantallas que todavía no
 * toca construir muestran `PantallaPendiente`, pero su guarda ya es la
 * definitiva y está cubierta por los tests.
 */
export const RUTAS_PROTEGIDAS = [
  // ── Las 9 secciones de la matriz de permisos del sprint de cierre ──────────
  { path: '/inicio', allow: [PROFESOR, JEFA, DIRECTIVOS], titulo: 'Inicio', elemento: <InicioPage /> },
  /**
   * CU033 y CU035 — Dashboard del Supervisor y del Directivo.
   *
   * Es la décima sección: la matriz del sprint de cierre tenía nueve y es
   * anterior a estos casos de uso (ver el bloque `dashboard` de
   * `auth/permisos.js`). Una ruta, dos pantallas distintas por rol.
   *
   * CU034 cuelga de ella y es SOLO del Supervisor: trae nombres de alumnos, y
   * sus endpoints le responden 403 al Directivo.
   */
  { path: '/dashboard', allow: [JEFA, DIRECTIVOS], titulo: 'Dashboard', elemento: <DashboardPage /> },
  { path: '/dashboard/libros', allow: [JEFA], titulo: 'Consolidado de libros leídos', elemento: <LibrosPage /> },
  { path: '/alumnos', allow: [PROFESOR, JEFA], titulo: 'Alumnos', elemento: <AlumnosPage /> },
  { path: '/usuarios', allow: [JEFA], titulo: 'Usuarios', elemento: <MantenimientoUsuarios /> },
  { path: '/colegios', allow: [JEFA], titulo: 'Colegios', elemento: <MantenimientoColegios /> },
  // Rúbrica y Seguimiento de Lectura son DOS secciones con permisos propios: el
  // Docente edita y el Supervisor solo mira (D3). Antes compartían pantalla.
  { path: '/asistencia', allow: [PROFESOR, JEFA], titulo: 'Asistencia', elemento: <AsistenciaPage /> },
  // La rúbrica SEMANAL ya no existe: desde la tanda 8 es una evaluación por
  // alumno y MES, con su propia pantalla. No quedó nada de la grilla que
  // compartía con Seguimiento de Lectura.
  { path: '/rubrica', allow: [PROFESOR, JEFA], titulo: 'Rúbrica', elemento: <RubricaPage /> },
  // La pantalla de Lectura ya no comparte grilla con Rúbrica: desde la tanda 7
  // su unidad es la TABLA SEMANAL, con su clase de referencia y su versión, y
  // no una fila por alumno. Rúbrica sigue en la pantalla compartida hasta que
  // se rehaga como evaluación MENSUAL (tanda 8).
  { path: '/seguimiento-lectura', allow: [PROFESOR, JEFA], titulo: 'Seguimiento de Lectura', elemento: <LecturaPage /> },
  // El ASISTENTE DESAPARECE (tanda 9). Ya no se aplica una prueba ni se
  // cuentan aciertos sobre un total: hay una decisión por alumno y periodo, y
  // la sugerencia la calcula el servidor sobre la rúbrica mensual. La ruta
  // `/registro-vuelo/nuevo` se queda redirigiendo, porque el panel del docente
  // y los atajos todavía la enlazan.
  { path: '/registro-vuelo', allow: [PROFESOR, JEFA], titulo: 'Registro de Vuelo', elemento: <RegistroVueloAnualPage /> },
  { path: '/registro-vuelo/nuevo', allow: [PROFESOR], titulo: 'Registro de Vuelo', elemento: <Navigate to="/registro-vuelo" replace /> },
  // CU017 a CU019: solo el Docente, y solo sus propias sesiones.
  { path: '/sesiones', allow: [PROFESOR], titulo: 'Sesiones', elemento: <SesionesPage /> },
  // CU020 y CU021: lo que el Supervisor usa en su lugar.
  { path: '/seguimiento', allow: [JEFA], titulo: 'Seguimiento', elemento: <SeguimientoPage /> },

  // ── Fuera de la matriz: siguen accesibles por URL, pero no van en el menú ──
  { path: '/estudiantes', allow: [PROFESOR, JEFA], titulo: 'Alumnos', elemento: <Navigate to="/alumnos" replace /> },
  { path: '/estudiantes/:id', allow: [PROFESOR, JEFA], titulo: 'Ficha del estudiante', elemento: <FichaEstudiantePage /> },
  { path: '/reporte-semanal', allow: [PROFESOR], titulo: 'Seguimiento de Lectura', elemento: <Navigate to="/seguimiento-lectura" replace /> },
]

const enDesarrollo = import.meta.env.DEV

/**
 * ¿Ese rol puede entrar a esa ruta?
 *
 * Se usa al volver del login: tras cerrar sesión, `ProtectedRoute` guarda la
 * ruta en la que estaba el usuario anterior. Si la siguiente persona entra con
 * otro rol y se la devuelve a ciegas, `RoleRoute` la manda a /403 aunque sus
 * credenciales sean correctas: se veía un "No tiene permisos" al iniciar sesión.
 */
export function rolPuedeEntrar(ruta, idRol) {
  if (!ruta || idRol == null) return false
  const limpia = String(ruta).split('?')[0]
  return RUTAS_PROTEGIDAS.some((r) => matchPath({ path: r.path, end: true }, limpia) && r.allow.includes(idRol))
}

/** Destino tras iniciar sesión: la ruta pedida si el rol la admite, o su inicio. */
export function destinoTrasLogin(desde, idRol) {
  return rolPuedeEntrar(desde, idRol) ? desde : rutaInicioDe(idRol)
}

/** Una URL desconocida lleva al inicio del rol; sin sesión, al login. */
function Redireccion() {
  const usuario = useSessionStore((s) => s.usuario)
  return <Navigate to={usuario ? rutaInicioDe(usuario.id_rol) : '/login'} replace />
}

export default function RutasApp() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/403" element={<ForbiddenPage />} />
      {/* Catálogo visual del sistema de diseño. Solo en desarrollo (§11, Fase 1). */}
      {enDesarrollo && <Route path="/_ui" element={<UiKitPage />} />}

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          {RUTAS_PROTEGIDAS.map(({ path, allow, titulo, fase, elemento }) => (
            <Route key={path} element={<RoleRoute allow={allow} />}>
              <Route path={path} element={elemento ?? <PantallaPendiente titulo={titulo} fase={fase} />} />
            </Route>
          ))}
        </Route>
      </Route>

      <Route path="*" element={<Redireccion />} />
    </Routes>
  )
}
