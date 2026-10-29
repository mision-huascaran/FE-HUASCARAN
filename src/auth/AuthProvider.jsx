import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { cerrarSesionEnServidor, iniciarSesion, obtenerPerfil } from '../api/resources/auth'
import { encolar, limpiarSiTodoSincronizado } from '../lib/colaOffline'
import {
  guardarPerfilLocal,
  limpiarDatosLocalesDeSesion,
  limpiarSiEsOtroUsuario,
  perfilLocalDe,
} from '../lib/datosLocales'
import { ahora } from '../lib/relojServidor'
import { TIPOS_ENVIO } from '../hooks/useOfflineQueue'
import useActividadStore from '../store/actividadStore'
import useSessionStore from '../store/sessionStore'
import { idSesionDe, tokenCaducado } from './jwt'
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
  const servidorInalcanzable = useSessionStore((s) => s.servidorInalcanzable)
  const setServidorInalcanzable = useSessionStore((s) => s.setServidorInalcanzable)
  const limpiarSesion = useSessionStore((s) => s.cerrarSesion)
  // El motivo del cierre vive en el store: lo escribe el interceptor de axios
  // al recibir un 401 `sesion_expirada`, que ocurre fuera de React.
  const motivoCierre = useSessionStore((s) => s.motivoCierre)
  const limpiarMotivoCierre = useSessionStore((s) => s.limpiarMotivoCierre)

  // Evita pedir /me dos veces con el StrictMode de desarrollo.
  const perfilPedidoPara = useRef(null)
  // Por qué se cerró la sesión, para poder explicarlo en el login.

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
    // Mientras la marca de servidor caído siga puesta no se reintenta solo:
    // reintentar en bucle contra un servidor que no contesta no arregla nada
    // y llena la consola. Lo desbloquea el botón "Reintentar".
    if (usuario || servidorInalcanzable || perfilPedidoPara.current === token) return

    perfilPedidoPara.current = token
    setCargando(true)
    obtenerPerfil()
      .then((perfil) => {
        setUsuario(perfil)
        // D82 — Una copia, para poder recargar sin conexión.
        guardarPerfilLocal(perfil)
        setCargando(false)
      })
      .catch((error) => {
        /**
         * UN SERVIDOR CAÍDO NO ES UNA SESIÓN TERMINADA (D52).
         *
         * Antes cualquier fallo de `/me` borraba la sesión, así que con el
         * backend caído recargar echaba al usuario al login y le hacía creer
         * que su sesión había expirado. Son dos cosas distintas y se tratan
         * distinto:
         *
         *   · 401 o 403 → el token no sirve. Se cierra, que es lo correcto.
         *   · sin respuesta o 5xx → el servidor no contesta. El token sigue
         *     siendo válido: se conserva y la pantalla lo dice.
         */
        const estado = error?.response?.status
        if (estado === 401 || estado === 403) {
          limpiarSesion()
          return
        }

        /**
         * D82 — SIN SEÑAL SE SIGUE TRABAJANDO CON LA COPIA.
         *
         * El perfil vive en memoria y la recarga lo pierde. Pedirlo otra vez
         * sin red falla, y la aplicación se quedaba en "No se pudo contactar
         * con el servidor": el Docente que recargaba en el aula perdía el
         * acceso a todo, incluida la cola de pendientes que ya tenía guardada.
         *
         * Con la copia se entra igual. No se usa para un 401 ni un 403 —eso
         * ya se resolvió arriba—, solo cuando el servidor no contesta, que es
         * cuando el token sigue siendo bueno.
         */
        const guardado = perfilLocalDe(null)
        if (guardado) {
          setUsuario(guardado)
          setCargando(false)
          return
        }
        /**
         * Se suelta la marca de "ya pedí el perfil para este token" para que
         * el reintento pueda volver a pedirlo. Sin esto, el botón
         * "Reintentar" bajaba la bandera y el efecto se encontraba con que
         * ese token ya se había pedido, así que no hacía nada.
         */
        perfilPedidoPara.current = null
        setServidorInalcanzable(true)
      })
  }, [token, usuario, servidorInalcanzable, setUsuario, setCargando, limpiarSesion, setServidorInalcanzable])

  const entrar = useCallback(
    async ({ correo, password }) => {
      const { access_token: accessToken } = await iniciarSesion({ correo, password })
      // Antes de `setToken`: si no, el efecto de arriba ve un token sin perfil
      // y pide un segundo /me que puede llegar tarde y pisar al usuario.
      perfilPedidoPara.current = accessToken
      setToken(accessToken)
      const perfil = await obtenerPerfil()
      /**
       * D51 — Si entra OTRA cuenta, lo guardado no es suyo.
       *
       * El cierre de sesión ya limpia, pero solo cuando se pulsa "Cerrar
       * sesión". Si la pestaña se cierra, el token caduca o alguien lo borra,
       * esa limpieza nunca corre y la siguiente persona ve el resumen, los
       * filtros y las consultas de la anterior como si fueran suyos.
       *
       * Va ANTES de `setUsuario`: la pantalla no debe llegar a pintar nada con
       * datos ajenos, ni siquiera un instante.
       */
      await limpiarSiEsOtroUsuario(perfil?.id_usuario)
      setUsuario(perfil)
      setCargando(false)
      return perfil
    },
    [setToken, setUsuario, setCargando],
  )

  /**
   * Entrar con un token ya emitido, sin pasar por `/login`.
   *
   * Lo usa el primer ingreso (CU001): `POST /password/primer-ingreso` responde
   * exactamente lo mismo que `/login`, token incluido, así que el usuario entra
   * directamente en vez de volver al formulario a reescribir una contraseña que
   * acaba de establecer.
   */
  const entrarConToken = useCallback(
    async (accessToken) => {
      perfilPedidoPara.current = accessToken
      setToken(accessToken)
      const perfil = await obtenerPerfil()
      await limpiarSiEsOtroUsuario(perfil?.id_usuario)
      setUsuario(perfil)
      setCargando(false)
      return perfil
    },
    [setToken, setUsuario, setCargando],
  )

  const salir = useCallback(async (motivo = null) => {
    /**
     * CU008 — La actividad en curso la cierra el SERVIDOR.
     *
     * `POST /logout` cierra de verdad la sesión y, si había una actividad
     * abierta, la finaliza como "Forzado por cierre de sesión" (o "Automático
     * por expiración" cuando vencen las 8 horas).
     *
     * Pero SIN CONEXIÓN el `/logout` no llega y en el servidor no se cierra
     * nada: la actividad quedaba abierta para siempre y la siguiente sesión no
     * podía iniciar otra (409). Por eso, si el servidor no respondió, el cierre
     * se deja en la cola de IndexedDB con la hora REAL en que el docente salió,
     * y se envía tras el siguiente inicio de sesión (nunca antes: sin sesión
     * válida no hay con qué enviarlo).
     */
    const abierta = useActividadStore.getState().cerrar()
    const idSesion = idSesionDe(useSessionStore.getState().token)

    const { sinRespuesta } = await cerrarSesionEnServidor()

    if (sinRespuesta && motivo !== 'expiracion' && idSesion) {
      /**
       * D44 — SE ENCOLA EL CIERRE DE LA SESIÓN, NO EL DE LA ACTIVIDAD.
       *
       * Antes se mandaba `POST /actividades/{id}/finalizar`, y una actividad
       * que el docente ya dio por terminada NO se reescribe: quedaba como
       * "Manual por finalización de actividad" y la sesión seguía abierta en
       * el servidor, con su fin y su causa en null.
       *
       * `POST /me/sesiones/{id}/cerrar` cierra las dos, y la actividad como
       * "Forzado por cierre de sesión", que es lo que de verdad pasó. Va con
       * la hora REAL en que el docente salió, no la de la sincronización: lo
       * que se registra es cuándo ocurrió.
       */
      encolar({
        clave: `sesion-cierre-${idSesion}`,
        tipo: TIPOS_ENVIO.SESION_CIERRE,
        payload: { id_sesion: idSesion, fin: abierta?.fin ?? ahora().toISOString(), id_actividad: abierta?.id ?? null },
        descripcion: 'Cierre de sesión sin conexión',
        // Si la actividad se inició sin conexión y todavía no subió, primero
        // tiene que existir en el servidor: cerrarla antes daría un 404.
        ...(abierta ? { dependeDe: `actividad-inicio-${abierta.id}` } : {}),
      }).catch(() => {
        // El resultado se ve en el panel de sincronización, no aquí.
      })
    }

    /**
     * IndexedDB guarda datos de menores y hay que borrarlo al salir, pero
     * CU007 prohíbe que el cierre elimine cambios sin enviar. La COLA se
     * limpia solo si está vacía; la PRECARGA y los filtros/resúmenes de
     * localStorage se borran siempre: son copias, no trabajo pendiente, y si
     * se quedan los ve la siguiente persona que use el navegador (RN-007).
     */
    await limpiarSiTodoSincronizado()
    await limpiarDatosLocalesDeSesion()

    limpiarSesion(motivo)
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
    salir('expiracion')
  }, [salir])

  useExpiracionSesion({ token, onExpirar: expirar })

  const valor = useMemo(
    () => ({
      token,
      usuario,
      cargando,
      autenticado: Boolean(token && usuario),
      entrar,
      entrarConToken,
      salir,
      motivoCierre,
      limpiarMotivoCierre,
    }),
    [token, usuario, cargando, entrar, entrarConToken, salir, motivoCierre, limpiarMotivoCierre],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export default AuthProvider
