// CU018 — Filtros del Módulo de Sesiones.
//
// Dos reglas del caso de uso que no son obvias:
//
//   · Los filtros se conservan entre visitas (localStorage), pero los
//     RESULTADOS no: la consulta es siempre en línea contra PostgreSQL.
//   · Un rango invertido no se envía. El backend respondería 422
//     `rango_fechas_invalido`, pero gastar una petición para que te diga lo que
//     ya se sabe es peor experiencia que avisar al momento.
import { useCallback, useMemo, useState } from 'react'

const CLAVE = 'sicedu.filtros.sesiones'

export const VACIOS = { desde: '', hasta: '', estado: '', sincronizacion: '', tipo_cierre: '' }

function leer() {
  try {
    const crudo = localStorage.getItem(CLAVE)
    return crudo ? JSON.parse(crudo) : null
  } catch {
    return null
  }
}

function guardar(filtros) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(filtros))
  } catch {
    // Almacenamiento bloqueado: se sigue con los filtros en memoria.
  }
}

export default function useFiltrosSesiones() {
  // Se fusiona con la forma por defecto: un localStorage escrito por una
  // versión anterior dejaría campos en `undefined` y los selects pasarían a
  // ser no controlados.
  const [filtros, setFiltros] = useState(() => ({ ...VACIOS, ...leer() }))

  const cambiar = useCallback((campo, valor) => {
    setFiltros((previos) => {
      const siguiente = { ...previos, [campo]: valor }
      guardar(siguiente)
      return siguiente
    })
  }, [])

  const limpiar = useCallback(() => {
    setFiltros(VACIOS)
    try {
      localStorage.removeItem(CLAVE)
    } catch {
      // nada que limpiar
    }
  }, [])

  /** La fecha inicial no puede ser posterior a la final. */
  const rangoInvalido = useMemo(
    () => Boolean(filtros.desde && filtros.hasta && filtros.desde > filtros.hasta),
    [filtros.desde, filtros.hasta],
  )

  return { filtros, cambiar, limpiar, rangoInvalido }
}
