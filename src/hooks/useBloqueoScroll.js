import { useEffect } from 'react'

/** Una barra de scroll de verdad mide entre 1 y ~20 px; jsdom da 0 de ancho. */
const ANCHO_MAXIMO_BARRA = 40

/**
 * Bloquea el scroll de la página mientras `activo` (modales y paneles).
 *
 * D012 del reporte de UX: al abrir un modal se quitaba la barra de scroll y,
 * con las barras clásicas de Windows (unos 15 px), toda la tabla de atrás se
 * corría a la derecha y volvía al cerrar. Se compensa con un relleno del mismo
 * ancho solo mientras dura el bloqueo, en vez de reservar el hueco siempre.
 */
export default function useBloqueoScroll(activo) {
  useEffect(() => {
    if (!activo) return undefined
    const { body, documentElement } = document
    const ancho = window.innerWidth - documentElement.clientWidth
    const previo = { overflow: body.style.overflow, paddingRight: body.style.paddingRight }
    body.style.overflow = 'hidden'
    if (documentElement.clientWidth > 0 && ancho > 0 && ancho <= ANCHO_MAXIMO_BARRA) {
      body.style.paddingRight = `${ancho}px`
    }
    return () => {
      body.style.overflow = previo.overflow
      body.style.paddingRight = previo.paddingRight
    }
  }, [activo])
}
