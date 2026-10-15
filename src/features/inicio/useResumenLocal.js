// Copia del último resumen del Módulo de Inicio en localStorage (CU011, CU012).
//
// Con conexión se guarda una copia del resumen recién obtenido; sin conexión se
// muestra esa copia, marcada como potencialmente desactualizada. localStorage se
// usa SOLO para esto —resúmenes de consulta y preferencias—, nunca para
// registros de negocio: esos viven en IndexedDB hasta sincronizarse.
import { useEffect, useState } from 'react'

const clave = (rol) => `sicedu.resumen.${rol}`

function leer(rol) {
  try {
    const crudo = localStorage.getItem(clave(rol))
    return crudo ? JSON.parse(crudo) : null
  } catch {
    return null
  }
}

/**
 * Devuelve el resumen a pintar y si procede de la copia local.
 *
 * @param rol      'supervisor' | 'directivo'
 * @param datos    lo que devolvió el servidor, o undefined si aún no llegó
 * @param enLinea  si hay conexión ahora mismo
 */
export default function useResumenLocal(rol, datos, enLinea) {
  const [guardado, setGuardado] = useState(() => leer(rol))

  useEffect(() => {
    if (!datos) return
    try {
      localStorage.setItem(clave(rol), JSON.stringify({ datos, fecha: new Date().toISOString() }))
    } catch {
      // Almacenamiento bloqueado: se sigue mostrando lo del servidor.
    }
    setGuardado({ datos, fecha: new Date().toISOString() })
  }, [rol, datos])

  if (datos && enLinea) return { resumen: datos, desactualizado: false, fecha: null }

  return {
    resumen: guardado?.datos ?? null,
    desactualizado: Boolean(guardado) && !enLinea,
    fecha: guardado?.fecha ?? null,
  }
}
