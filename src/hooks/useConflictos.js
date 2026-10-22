// "Cargar versión actual" (P4 §3): lo que se hace con un `modificacion_concurrente`.
//
// Lectura, Rúbrica y Registro de Vuelo tienen control de versión: si otra
// persona guardó antes, el servidor rechaza el ítem y manda el registro
// VIGENTE. No se reintenta (pisaría el cambio ajeno) ni se adopta en silencio
// (el docente no sabría que su valor no se guardó): se le avisa y él decide
// cargar la versión actual. Al hacerlo se DESCARTA la operación rechazada, que
// así deja de contar como error en su actividad y en Seguimiento.
import { useCallback, useState } from 'react'
import { descartarOperacion } from '../api/resources/sincronizacion'

export default function useConflictos() {
  const [conflictos, setConflictos] = useState([])
  const [cargando, setCargando] = useState(null)

  /** `clave` identifica el registro (alumno, alumno-periodo…): uno por clave. */
  const registrar = useCallback(({ clave, nombre, idOperacion, registro, detail, aplicar }) => {
    setConflictos((previos) => [
      ...previos.filter((c) => c.clave !== clave),
      { clave, nombre, idOperacion, registro, detail, aplicar },
    ])
  }, [])

  const cargarVersionActual = useCallback(async (clave) => {
    const conflicto = conflictos.find((c) => c.clave === clave)
    if (!conflicto) return
    setCargando(clave)
    try {
      // Si ya estaba descartada (otra pestaña) o no existe, el registro vigente
      // se carga igual: lo que importa es dejar de mostrar algo que no se guardó.
      await descartarOperacion(conflicto.idOperacion).catch(() => null)
      conflicto.aplicar(conflicto.registro)
      setConflictos((previos) => previos.filter((c) => c.clave !== clave))
    } finally {
      setCargando(null)
    }
  }, [conflictos])

  const limpiar = useCallback(() => setConflictos([]), [])

  return { conflictos, registrar, cargarVersionActual, cargando, limpiar }
}
