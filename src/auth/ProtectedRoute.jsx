import { Navigate, Outlet, useLocation } from 'react-router-dom'
import useSessionStore from '../store/sessionStore'
import PantallaCargando from '../components/layout/PantallaCargando'
import ServidorInalcanzable from '../components/layout/ServidorInalcanzable'

/**
 * Primera guarda: sin token no se entra (RNF-004).
 * Guarda la ruta pedida para volver a ella después del login.
 */
export default function ProtectedRoute() {
  const token = useSessionStore((s) => s.token)
  const usuario = useSessionStore((s) => s.usuario)
  const cargando = useSessionStore((s) => s.cargando)
  const servidorInalcanzable = useSessionStore((s) => s.servidorInalcanzable)
  const setServidorInalcanzable = useSessionStore((s) => s.setServidorInalcanzable)
  const location = useLocation()

  if (cargando) return <PantallaCargando />

  /**
   * D52 — Con el servidor caído hay token pero no perfil, y sin perfil no se
   * puede decidir qué menú ni qué módulos pintar.
   *
   * Lo que NO se hace es mandar al login: eso le diría al usuario que su
   * sesión terminó, que es falso y le haría volver a escribir sus
   * credenciales contra un servidor que no responde.
   */
  if (token && !usuario && servidorInalcanzable) {
    // Al reintentar se baja la bandera: el efecto de `AuthProvider` ve nuevo
    // token sin perfil y vuelve a pedir `/me`.
    return <ServidorInalcanzable onReintentar={() => setServidorInalcanzable(false)} />
  }

  if (!token || !usuario) {
    return <Navigate to="/login" replace state={{ desde: location.pathname + location.search }} />
  }
  return <Outlet />
}
