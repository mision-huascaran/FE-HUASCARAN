import { useEffect, useState } from 'react'

/**
 * Ancho en píxeles del elemento de `ref`, al día con cada cambio de tamaño.
 *
 * Devuelve 0 mientras no se ha medido o si el entorno no sabe medir (jsdom):
 * quien lo use tiene que tratar el 0 como "sin dato", no como "ancho cero".
 * Se redondea para no volver a pintar por fracciones de píxel.
 */
export default function useAnchoDe(ref) {
  const [ancho, setAncho] = useState(0)

  useEffect(() => {
    const nodo = ref.current
    if (!nodo || typeof ResizeObserver === 'undefined') return undefined
    const medir = () => setAncho(Math.round(nodo.getBoundingClientRect().width))
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(nodo)
    return () => observador.disconnect()
  }, [ref])

  return ancho
}
