// Filtros de una pantalla, conservados en localStorage (CU014, CU018).
//
// localStorage guarda SOLO filtros y preferencias, nunca registros. Todo lo que
// se escribe aquí cuelga de `sicedu.filtros.` para que el cierre de sesión lo
// borre de una vez (`lib/datosLocales.js`): los filtros de una persona no deben
// aparecerle a la siguiente que use el mismo navegador.
import { useCallback, useState } from 'react'

export const PREFIJO_FILTROS = 'sicedu.filtros.'

function leer(clave) {
  try {
    const crudo = localStorage.getItem(PREFIJO_FILTROS + clave)
    return crudo ? JSON.parse(crudo) : null
  } catch {
    return null
  }
}

function guardar(clave, filtros) {
  try {
    localStorage.setItem(PREFIJO_FILTROS + clave, JSON.stringify(filtros))
  } catch {
    // Almacenamiento bloqueado: se sigue con los filtros en memoria.
  }
}

/**
 * Como `useState`, pero el valor sobrevive a la navegación y a la recarga.
 * Se fusiona con `iniciales` para que un valor guardado por una versión
 * anterior no deje campos en `undefined`.
 */
export default function useFiltrosGuardados(clave, iniciales) {
  const [filtros, setFiltrosEnMemoria] = useState(() => ({ ...iniciales, ...leer(clave) }))

  const setFiltros = useCallback(
    (cambio) =>
      setFiltrosEnMemoria((previos) => {
        const siguientes = typeof cambio === 'function' ? cambio(previos) : cambio
        guardar(clave, siguientes)
        return siguientes
      }),
    [clave],
  )

  return [filtros, setFiltros]
}
