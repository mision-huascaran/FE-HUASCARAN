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

export default function useExpiracionSesion({ token, onExpirar }) {
  useEffect(() => {
    if (!token) return undefined

    const vence = caducaEn(token)
    if (!vence) return undefined

    const faltan = vence.getTime() - Date.now()

    // Ya vencido al montar: se cierra en el acto, sin esperar al temporizador.
    if (faltan <= 0) {
      onExpirar()
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
