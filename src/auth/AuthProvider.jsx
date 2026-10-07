import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { cerrarSesionEnServidor, iniciarSesion, obtenerPerfil } from '../api/resources/auth'
import { encolar, limpiarSiTodoSincronizado } from '../lib/colaOffline'
import useActividadStore from '../store/actividadStore'
import useSessionStore from '../store/sessionStore'
import { tokenCaducado } from './jwt'
import useExpiracionSesion from './useExpiracionSesion'

/**
 * Sesión de la aplicación: token, perfil y las dos acciones que los cambian.
 *
 * RNF-003: el token se guarda en memoria con respaldo en `sessionStorage`
 * (nunca `localStorage`); el perfil solo vive en memoria.
 */
const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const token = useSessionStore((s) => s.token)
  const usuario = useSessionStore((s) => s.usuario)
  const cargando = useSessionStore((s) => s.cargando)
  const setToken = useSessionStore((s) => s.setToken)
  const setUsuario = useSessionStore((s) => s.setUsuario)
  const setCargando = useSessionStore((s) => s.setCargando)
  const limpiarSesion = useSessionStore((s) => s.cerrarSesion)

  // Evita pedir /me dos veces con el StrictMode de desarrollo.
  const perfilPedidoPara = useRef(null)
  // Por qué se cerró la sesión, para poder explicarlo en el login.
  const [motivoCierre, setMotivoCierre] = useState(null)

  // Al recargar la página el token sobrevive en sessionStorage pero el perfil
  // no: se vuelve a pedir a /me antes de dejar entrar a ninguna ruta.
  useEffect(() => {
    if (!token) {
      perfilPedidoPara.current = null
      setCargando(false)
      return
    }
    // El token vive 8 horas y la sesión puede caducar con el docente dentro:
    // se corta aquí en vez de disparar una petición condenada al 401.
    if (tokenCaducado(token)) {
      limpiarSesion()
      return
    }
    if (usuario || perfilPedidoPara.current === token) return

    perfilPedidoPara.current = token
    setCargando(true)
    obtenerPerfil()
      .then((perfil) => {
        setUsuario(perfil)
        setCargando(false)
      })
      .catch(() => {
        // Token vencido o inválido: se vuelve a empezar.
        limpiarSesion()
      })
  }, [token, usuario, setUsuario, setCargando, limpiarSesion])

  const entrar = useCallback(
    async ({ correo, password }) => {
      const { access_token: accessToken } = await iniciarSesion({ correo, password })
      setToken(accessToken)
      const perfil = await obtenerPerfil()
      perfilPedidoPara.current = accessToken
      setUsuario(perfil)
      setCargando(false)
      return perfil
    },
    [setToken, setUsuario, setCargando],
  )

  const salir = useCallback(async () => {
    /**
     * CU010 — Logout con actividad activa.
     *
     * No se cierra la sesión de golpe: primero se procesa la actividad de
     * trabajo con las mismas reglas que "Finalizar actividad", para que quede
     * registrada y no se pierda nada de lo que el docente hizo en el aula.
     */
    const actividad = useActividadStore.getState().cerrar()
    if (actividad) {
      encolar({
        clave: `actividad-cierre-${actividad.id}`,
        tipo: 'actividad',
        payload: { ...actividad, accion: 'cerrar', motivo: 'logout' },
        descripcion: 'Cierre de actividad al salir',
      })
    }

    await cerrarSesionEnServidor()

    /**
     * IndexedDB guarda datos de menores y hay que borrarlo al salir, pero
     * CU007 prohíbe que el cierre elimine cambios sin enviar. Se limpia solo
     * si la cola está vacía; si no, se conserva para el próximo inicio.
     */
    await limpiarSiTodoSincronizado()

    limpiarSesion()
    perfilPedidoPara.current = null
    /**
     * Se vacía la caché de consultas para que ningún dato de alumnos quede
     * accesible tras cerrar sesión (RNF-003). La COLA de IndexedDB no se toca:
     * el cierre de sesión nunca debe borrar cambios pendientes (CU007), que
     * se enviarán tras el siguiente inicio de sesión.
     */
    queryClient.clear()
  }, [limpiarSesion, queryClient])

  /**
   * CU007 — Finalización automática a las 8 horas.
   *
   * Se cierra igual que a mano, procesando antes la actividad. El aviso importa:
   * sin él, el docente ve la pantalla de login sin saber por qué, y piensa que
   * perdió el trabajo del día.
   */
  const expirar = useCallback(() => {
    salir()
    setMotivoCierre('expiracion')
  }, [salir])

  useExpiracionSesion({ token, onExpirar: expirar })

  const valor = useMemo(
    () => ({
      token,
      usuario,
      cargando,
      autenticado: Boolean(token && usuario),
      entrar,
      salir,
      motivoCierre,
      limpiarMotivoCierre: () => setMotivoCierre(null),
    }),
    [token, usuario, cargando, entrar, salir, motivoCierre],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export default AuthProvider
