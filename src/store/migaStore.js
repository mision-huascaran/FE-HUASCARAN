// La última miga de pan de una vista que no tiene ruta propia (auditoría de
// UX #737, U29).
//
// El detalle de un colegio, su calendario académico y el detalle de un Docente
// se abren SIN cambiar de URL, y las migas —que salen de la URL— decían solo
// "Colegios" o "Usuarios"; la ficha del alumno, "Detalle". La vista dice aquí
// cómo se llama mientras está montada, y las migas lo añaden al final.
import { useEffect } from 'react'
import { create } from 'zustand'

const useMigaStore = create(() => ({ extra: null }))

/** Registra `texto` como última miga mientras el componente esté montado. */
export function useMigaExtra(texto) {
  useEffect(() => {
    if (!texto) return undefined
    useMigaStore.setState({ extra: texto })
    return () => {
      if (useMigaStore.getState().extra === texto) useMigaStore.setState({ extra: null })
    }
  }, [texto])
}

export default useMigaStore
