// Montaje compartido de pantallas con todos los proveedores de la aplicación.
//
// Casi cada prueba de pantalla repetía el mismo árbol QueryClient → Toast →
// Router → Auth. Se centraliza aquí para no duplicarlo (SonarQube lo cuenta) y
// para que las pruebas hablen de comportamiento, no de cableado.
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../App'
import { ToastProvider } from '../components/ui'
import AuthProvider from '../auth/AuthProvider'
import RutasApp from '../rutas'
import useSessionStore from '../store/sessionStore'
import { tokenMockDe, usuarioDe } from './fabricas'

/** Cliente de consultas sin reintentos: un fallo se ve al instante. */
export function clienteDePrueba() {
  const cliente = crearQueryClient()
  cliente.setDefaultOptions({ queries: { retry: false, staleTime: 0 }, mutations: { retry: 0 } })
  return cliente
}

/** Deja la sesión como si el login ya hubiera ocurrido, o sin sesión con `null`. */
export function iniciarSesionComo(idRol, extra = {}) {
  if (idRol == null) {
    useSessionStore.setState({ token: null, usuario: null, cargando: false, motivoCierre: null })
    return null
  }
  const usuario = usuarioDe(idRol, extra)
  useSessionStore.setState({ token: tokenMockDe(idRol), usuario, cargando: false, motivoCierre: null })
  return usuario
}

/** Muestra la ruta actual para poder comprobar redirecciones. */
export function RutaActual() {
  const { pathname } = useLocation()
  return <span aria-label="ruta actual">{pathname}</span>
}

/**
 * Monta `ui` con los proveedores. Sin `ui` monta la aplicación entera
 * (`RutasApp`) en `ruta`, que es como se prueban las guardas.
 */
export function renderConProveedores(ui, { ruta = '/', rol, cliente = clienteDePrueba() } = {}) {
  if (rol !== undefined) iniciarSesionComo(rol)
  const contenido = ui ?? <RutasApp />
  const resultado = render(
    <QueryClientProvider client={cliente}>
      <ToastProvider>
        <MemoryRouter initialEntries={[ruta]}>
          <AuthProvider>
            {contenido}
            <Routes>
              <Route path="*" element={<RutaActual />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
  return { ...resultado, cliente }
}
