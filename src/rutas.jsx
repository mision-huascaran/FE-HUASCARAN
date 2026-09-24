import { Navigate, Route, Routes, matchPath } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import PantallaPendiente from './components/layout/PantallaPendiente'
import ProtectedRoute from './auth/ProtectedRoute'
import RoleRoute from './auth/RoleRoute'
import ForbiddenPage from './features/errores/ForbiddenPage'
import InicioPage from './features/inicio/InicioPage'
import AdministracionPage from './features/administracion/AdministracionPage'
import AlertasPage from './features/alertas/AlertasPage'
import ColegioDetallePage from './features/colegios/ColegioDetallePage'
import ColegiosPage from './features/colegios/ColegiosPage'
import ConsolidadosPage from './features/consolidados/ConsolidadosPage'
import ConsultaColegiosPage from './features/consultaColegios/ConsultaColegiosPage'
import DashboardPage from './features/dashboard/DashboardPage'
import AlumnosPage from './features/alumnos/AlumnosPage'
import EstudiantesPage from './features/estudiantes/EstudiantesPage'
import FichaEstudiantePage from './features/estudiantes/FichaEstudiantePage'
import LoginPage from './features/login/LoginPage'
import NivelFinalPage from './features/nivelFinal/NivelFinalPage'
import PanelEjecutivoPage from './features/panelEjecutivo/PanelEjecutivoPage'
import ReportesPage from './features/reportes/ReportesPage'
import NuevaEvaluacionPage from './features/registroVuelo/NuevaEvaluacionPage'
import RegistroVueloPage from './features/registroVuelo/RegistroVueloPage'
import ReporteSemanalPage from './features/reporteSemanal/ReporteSemanalPage'
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
  { path: '/inicio', allow: [PROFESOR], titulo: 'Inicio del docente', elemento: <InicioPage /> },
  { path: '/reporte-semanal', allow: [PROFESOR], titulo: 'Reporte semanal y rúbrica', elemento: <ReporteSemanalPage /> },
  { path: '/registro-vuelo', allow: [PROFESOR, JEFA], titulo: 'Registro de vuelo — histórico', elemento: <RegistroVueloPage /> },
  { path: '/registro-vuelo/nuevo', allow: [PROFESOR], titulo: 'Registrar evaluación diagnóstica', elemento: <NuevaEvaluacionPage /> },
  // Módulo Alumnos (CU008): gestiona el Docente, el Supervisor solo consulta.
  { path: '/alumnos', allow: [PROFESOR, JEFA], titulo: 'Alumnos', elemento: <AlumnosPage /> },
  { path: '/estudiantes', allow: [PROFESOR, JEFA, DIRECTIVOS], titulo: 'Estudiantes', elemento: <EstudiantesPage /> },
  { path: '/estudiantes/:id', allow: [PROFESOR, JEFA, DIRECTIVOS], titulo: 'Ficha del estudiante', elemento: <FichaEstudiantePage /> },
  { path: '/nivel-final', allow: [PROFESOR, JEFA], titulo: 'Nivel final mensual', elemento: <NivelFinalPage /> },
  { path: '/consulta-colegios', allow: [PROFESOR], titulo: 'Consulta de otros colegios', elemento: <ConsultaColegiosPage /> },
  { path: '/dashboard', allow: [JEFA], titulo: 'Dashboard consolidado', elemento: <DashboardPage /> },
  { path: '/colegios', allow: [JEFA, DIRECTIVOS], titulo: 'Colegios y ranking', elemento: <ColegiosPage /> },
  { path: '/colegios/:id', allow: [JEFA, DIRECTIVOS], titulo: 'Detalle del colegio', elemento: <ColegioDetallePage /> },
  { path: '/consolidados', allow: [JEFA], titulo: 'Consolidados', elemento: <ConsolidadosPage /> },
  { path: '/alertas', allow: [JEFA], titulo: 'Alertas de inconsistencias', elemento: <AlertasPage /> },
  { path: '/administracion', allow: [JEFA, DIRECTIVOS], titulo: 'Administración', elemento: <AdministracionPage /> },
  { path: '/panel-ejecutivo', allow: [DIRECTIVOS], titulo: 'Panel ejecutivo', elemento: <PanelEjecutivoPage /> },
  { path: '/reportes', allow: [DIRECTIVOS], titulo: 'Reportes y descargas', elemento: <ReportesPage /> },
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
