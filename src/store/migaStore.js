// La última miga de pan de una vista que no tiene ruta propia (auditoría de
// UX #737, U29).
//
// El detalle de un colegio, su calendario académico y el detalle de un Docente
// se abren SIN cambiar de URL, y las migas —que salen de la URL— decían solo
// "Colegios" o "Usuarios"; la ficha del alumno, "Detalle". La vista dice aquí
// cómo se llama mientras está montada, y las migas lo añaden al final.
//
// `volver` — BUG del reporte de QA del 09/11/2026: la miga de en medio (p.
// ej. "Colegios", entre "Inicio" y "Colegio de Prueba") apuntaba con un
// `<Link>` a la URL ACTUAL, porque esta vista nunca cambió de ruta. Un enlace
// a la página en la que ya se está no navega a ningún lado: el clic no hacía
// nada y parecía que la miga estuviera rota. La vista registra aquí el mismo
// `onVolver` que ya usa su botón "Volver", y la miga lo llama en vez de
// depender de una navegación que no iba a ocurrir.
import { useEffect } from 'react'
import { create } from 'zustand'

const useMigaStore = create(() => ({ extra: null, volver: null }))

/** Registra `texto` como última miga, y `volver` para la miga de en medio. */
export function useMigaExtra(texto, volver = null) {
  useEffect(() => {
    if (!texto) return undefined
    useMigaStore.setState({ extra: texto, volver })
    return () => {
      if (useMigaStore.getState().extra === texto) useMigaStore.setState({ extra: null, volver: null })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto])

  // `volver` puede ser una función nueva en cada render (un arrow inline en
  // quien llama): se mantiene al día sin rearmar el efecto de arriba, que es
  // el que decide CUÁNDO la miga existe.
  useEffect(() => {
    if (useMigaStore.getState().extra === texto) useMigaStore.setState({ volver })
  }, [texto, volver])
}

export default useMigaStore
