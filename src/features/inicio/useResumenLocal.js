// Copia del último resumen del Módulo de Inicio en localStorage (CU011, CU012).
//
// Con conexión se guarda una copia del resumen recién obtenido; sin conexión se
// muestra esa copia, marcada como potencialmente desactualizada. localStorage se
// usa SOLO para esto —resúmenes de consulta y preferencias—, nunca para
// registros de negocio: esos viven en IndexedDB hasta sincronizarse.
import { useEffect, useState } from 'react'
import useSessionStore from '../../store/sessionStore'

/**
 * La copia se guarda POR CUENTA, no por rol (D51).
 *
 * Con `sicedu.resumen.supervisor` a secas, dos Supervisores distintos
 * compartían la misma entrada: si el token del primero se perdía sin pasar por
 * "Cerrar sesión", el segundo abría el Inicio y veía los indicadores del
 * anterior sin ninguna señal de que no eran suyos.
 *
 * Es la segunda mitad del defecto. La primera —vaciar lo que dejó el usuario
 * anterior al entrar otro— está en `limpiarSiEsOtroUsuario`; esta evita además
 * que se mezclen mientras los dos existan.
 */
const clave = (rol, idUsuario) => `sicedu.resumen.${rol}.${idUsuario ?? 'anonimo'}`

function leer(rol, idUsuario) {
  try {
    const crudo = localStorage.getItem(clave(rol, idUsuario))
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
 * @param falloServidor hay conexión pero el servidor no contestó (D52): CU011
 *   y CU012 piden lo mismo que sin conexión, la copia marcada como
 *   potencialmente desactualizada.
 */
export default function useResumenLocal(rol, datos, enLinea, { falloServidor = false } = {}) {
  const idUsuario = useSessionStore((s) => s.usuario?.id_usuario)
  const [guardado, setGuardado] = useState(() => leer(rol, idUsuario))

  // Al cambiar de cuenta se relee: lo del usuario anterior no se muestra ni
  // un instante mientras llega la respuesta del servidor.
  useEffect(() => setGuardado(leer(rol, idUsuario)), [rol, idUsuario])

  useEffect(() => {
    if (!datos) return
    try {
      localStorage.setItem(clave(rol, idUsuario), JSON.stringify({ datos, fecha: new Date().toISOString() }))
    } catch {
      // Almacenamiento bloqueado: se sigue mostrando lo del servidor.
    }
    setGuardado({ datos, fecha: new Date().toISOString() })
  }, [rol, idUsuario, datos])

  if (datos && enLinea) return { resumen: datos, desactualizado: false, fecha: null }

  return {
    resumen: guardado?.datos ?? null,
    desactualizado: Boolean(guardado) && (!enLinea || falloServidor),
    fecha: guardado?.fecha ?? null,
  }
}
