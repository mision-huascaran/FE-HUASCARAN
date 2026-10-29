// D92 — Lo pendiente no se pierde si la sesión expira sin conexión (CU007, CU008).
//
// CP-ASI-06 y CP-LEC-07: el Docente registra sin señal, su sesión vence
// mientras tanto y, al volver la conexión, el primer envío recibe 401. Antes la
// cola lo trataba como un rechazo más y lo sacaba: el login prometía que se
// sincronizaría "al volver a entrar" y nunca llegaba al servidor.
import { beforeEach, describe, expect, it } from 'vitest'
import { _reiniciarCola, encolar, iniciarCola, registrarEnviador } from '../colaOffline'
import useSessionStore from '../../store/sessionStore'
import useSyncStore from '../../store/syncStore'
import useRechazosStore from '../../store/rechazosStore'

/** Un JWT de mentira de la cuenta indicada (la firma no se valida). */
function tokenDe(idUsuario, sesion = 'a') {
  const base64url = (obj) =>
    Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const exp = Math.floor(Date.now() / 1000) + 8 * 3600
  return `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ id_usuario: idUsuario, jti: sesion, exp })}.firma`
}

const TIPO = 'asistencia-prueba'

const marca = (clave) => ({
  clave,
  tipo: TIPO,
  payload: { id_alumno: 1, estado: 'presente' },
  descripcion: 'Asistencia de Ana Torres',
})

const esperar = (ms = 20) => new Promise((listo) => setTimeout(listo, ms))

const enLinea = (valor) => Object.defineProperty(window.navigator, 'onLine', { value: valor, configurable: true })

beforeEach(async () => {
  _reiniciarCola()
  useRechazosStore.getState().limpiar()
  enLinea(true)
  useSessionStore.setState({ token: tokenDe(7) })
  await iniciarCola()
})

describe('Cola offline con la sesión expirada (D92)', () => {
  it('un 401 no saca la operación: se envía tras la siguiente autenticación del mismo Docente', async () => {
    const enviados = []
    let sesionViva = false
    registrarEnviador(TIPO, async (payload) => {
      if (!sesionViva) {
        // Lo que hace el interceptor de axios: cierra la sesión y rechaza.
        useSessionStore.setState({ token: null })
        throw { response: { status: 401, data: { motivo: 'sesion_expirada' } } }
      }
      enviados.push(payload)
      return { ok: true }
    })

    // Se marca sin conexión: queda en la cola.
    enLinea(false)
    const resultado = encolar(marca('asistencia:1-2026-10-28-4'))
    await esperar()

    // Vuelve la señal con la sesión ya vencida en el servidor.
    enLinea(true)
    window.dispatchEvent(new Event('online'))
    await esperar()

    expect(enviados).toHaveLength(0)
    expect(useSyncStore.getState().pendientes).toBe(1)
    // No es un rechazo: no debe aparecer como "Error".
    expect(useRechazosStore.getState().rechazos).toHaveLength(0)

    // El mismo Docente vuelve a entrar.
    sesionViva = true
    useSessionStore.setState({ token: tokenDe(7, 'b') })

    await expect(resultado).resolves.toEqual({ ok: true })
    expect(enviados).toHaveLength(1)
    expect(useSyncStore.getState().pendientes).toBe(0)
  })

  it('si entra otra cuenta, lo pendiente del Docente anterior no se envía con su sesión ni se borra', async () => {
    const enviados = []
    registrarEnviador(TIPO, async (payload) => {
      enviados.push({ ...payload, usuario: useSessionStore.getState().token })
      return { ok: true }
    })

    enLinea(false)
    const resultado = encolar(marca('asistencia:2-2026-10-28-4'))
    await esperar()

    // Se cierra la sesión del Docente 7 y entra la cuenta 9.
    useSessionStore.setState({ token: null })
    enLinea(true)
    useSessionStore.setState({ token: tokenDe(9) })
    await esperar()

    expect(enviados).toHaveLength(0)
    // Lo de otra cuenta no figura en el panel de quien entró.
    expect(useSyncStore.getState().pendientes).toBe(0)

    // Vuelve el Docente 7: ahora sí.
    useSessionStore.setState({ token: tokenDe(7, 'c') })
    await expect(resultado).resolves.toEqual({ ok: true })
    expect(enviados).toHaveLength(1)
    expect(enviados[0].usuario).toBe(tokenDe(7, 'c'))
  })
})
