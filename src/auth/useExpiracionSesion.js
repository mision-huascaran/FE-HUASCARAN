// CU007 — Finalización automática al cumplirse las 8 horas de vigencia.
//
// Hasta ahora la caducidad solo se notaba al recargar o al recibir un 401. Eso
// deja al docente escribiendo en una grilla que ya no puede guardar: el trabajo
// no se pierde —queda en la cola—, pero se entera tarde y mal.
//
// Aquí se programa un temporizador para el momento exacto del vencimiento, que
// sale del `exp` del propio token. No es un control de seguridad: quien decide
// es el servidor en cada petición. Es para avisar a tiempo.
import { useEffect } from 'react'
import { caducaEn } from './jwt'
import { ahora, hayContinuidad } from '../lib/relojServidor'

export default function useExpiracionSesion({ token, onExpirar }) {
  useEffect(() => {
    if (!token) return undefined

    const vence = caducaEn(token)
    if (!vence) return undefined

    /**
     * LA HORA ES LA DEL SERVIDOR, NO LA DEL EQUIPO (D57).
     *
     * Con `Date.now()` a secas, un reloj adelantado hacía que `faltan` saliera
     * negativo y la sesión se cerrara nada más recargar: el docente entraba,
     * la aplicación lo echaba al login y no había forma de saber por qué.
     * `ahora()` va anclado a la cabecera `Date` del servidor y avanza con un
     * contador monotónico, así que cambiar el reloj a mano no lo mueve —que
     * es justo lo que CU007 exige—.
     */
    const faltan = vence.getTime() - ahora().getTime()

    /**
     * Vencido al montar, pero solo se cierra si la hora es FIABLE.
     *
     * Sin referencia del servidor —primer arranque sin conexión, o
     * `localStorage` bloqueado— `ahora()` se apoya en el reloj del equipo, y
     * cerrar por eso sería volver al defecto por otra puerta. Se deja decidir
     * al servidor: su 401 llega en la primera petición y ahí sí se cierra.
     */
    if (faltan <= 0) {
      if (hayContinuidad()) onExpirar()
      return undefined
    }

    /**
     * `setTimeout` no admite retardos mayores que un entero de 32 bits: con más
     * de ~24,8 días se desborda y dispara de inmediato. Con 8 horas no pasa,
     * pero se acota por si algún día cambia la vigencia.
     */
    const retardo = Math.min(faltan, 2 ** 31 - 1)
    const temporizador = setTimeout(onExpirar, retardo)
    return () => clearTimeout(temporizador)
  }, [token, onExpirar])
}
