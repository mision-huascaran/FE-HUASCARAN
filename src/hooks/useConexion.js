// ¿Hay conexión ahora mismo?
//
// `navigator.onLine` solo sabe si hay interfaz de red levantada, no si el
// servidor responde; para lo que necesita la interfaz —avisar al docente y
// bloquear las secciones que exigen conexión— es suficiente y es instantáneo.
//
// LOS EVENTOS SE PUEDEN PERDER. `online` y `offline` avisan del cambio, pero si
// la pestaña estaba en segundo plano o congelada, el equipo se suspendió, o la
// página se restauró desde la caché del navegador, el aviso no llega y la
// pantalla se quedaba "sin conexión" para siempre: el login seguía diciendo
// que no había internet y no dejaba pulsar "Ingresar". Por eso además se
// vuelve a leer `navigator.onLine` al recuperar el foco o la pestaña y, mientras
// se está sin conexión, cada pocos segundos.
import { useEffect, useState } from 'react'

const leer = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)

/** Cada cuánto se vuelve a mirar mientras se está sin conexión. */
export const REVISAR_SIN_CONEXION_MS = 3000

export default function useConexion() {
  const [enLinea, setEnLinea] = useState(leer)

  useEffect(() => {
    const subir = () => setEnLinea(true)
    const bajar = () => setEnLinea(false)
    const releer = () => setEnLinea(leer())
    window.addEventListener('online', subir)
    window.addEventListener('offline', bajar)
    window.addEventListener('focus', releer)
    window.addEventListener('pageshow', releer)
    document.addEventListener('visibilitychange', releer)
    return () => {
      window.removeEventListener('online', subir)
      window.removeEventListener('offline', bajar)
      window.removeEventListener('focus', releer)
      window.removeEventListener('pageshow', releer)
      document.removeEventListener('visibilitychange', releer)
    }
  }, [])

  // Solo mientras se está sin conexión: con red no hay nada que vigilar.
  useEffect(() => {
    if (enLinea) return undefined
    const intervalo = setInterval(() => setEnLinea(leer()), REVISAR_SIN_CONEXION_MS)
    return () => clearInterval(intervalo)
  }, [enLinea])

  return enLinea
}
