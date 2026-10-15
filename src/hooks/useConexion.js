// ¿Hay conexión ahora mismo?
//
// `navigator.onLine` solo sabe si hay interfaz de red levantada, no si el
// servidor responde; para lo que necesita la interfaz —avisar al docente y
// bloquear las secciones que exigen conexión— es suficiente y es instantáneo.
import { useEffect, useState } from 'react'

const leer = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)

export default function useConexion() {
  const [enLinea, setEnLinea] = useState(leer)

  useEffect(() => {
    const subir = () => setEnLinea(true)
    const bajar = () => setEnLinea(false)
    window.addEventListener('online', subir)
    window.addEventListener('offline', bajar)
    return () => {
      window.removeEventListener('online', subir)
      window.removeEventListener('offline', bajar)
    }
  }, [])

  return enLinea
}
