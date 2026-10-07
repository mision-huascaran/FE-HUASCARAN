// Lee lo que dejó la precarga de T19 para pintar las pantallas sin conexión.
//
// Hasta ahora "Iniciar actividad" bajaba los datos del aula a IndexedDB y NADIE
// los volvía a leer: el docente abría Rúbrica sin red y el desplegable de
// colegios salía vacío, aunque sus colegios estuvieran descargados.
//
// Va por TanStack Query para que la lectura de IndexedDB se haga una sola vez y
// la compartan todas las pantallas.
import { useQuery } from '@tanstack/react-query'
import { leerPrecarga } from '../lib/precarga'

export default function usePrecarga() {
  const { data } = useQuery({
    queryKey: ['precarga'],
    queryFn: leerPrecarga,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  return data?.datos ?? null
}
