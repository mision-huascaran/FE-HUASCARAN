// CU003 — Sincronización silenciosa al entrar al Módulo de Inicio.
//
// CU003 pide dos cosas que antes no se hacían: que los catálogos autorizados se
// bajen a IndexedDB al INICIAR SESIÓN (no solo al pulsar "Iniciar actividad", que
// además es exclusivo del Docente), y que se refresquen cada vez que el usuario
// entra a Inicio habiendo conexión.
//
// Es silenciosa a propósito: ni toast, ni spinner, ni bloqueo. Si falla, la
// sesión sigue siendo válida y se conserva la última copia buena — CU003 dice
// que un fallo de preparación offline no invalida nada.
import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  listarAlumnosAdmin,
  listarAsignaciones,
  listarColegiosAdmin,
  listarGradosAdmin,
} from '../../api/resources/administracion'
import { obtenerNivelesRazkids, obtenerNivelesRubrica, obtenerSemanas } from '../../api/resources/catalogos'
import { precargarParaOffline } from '../../lib/precarga'
import useConexion from '../../hooks/useConexion'
import useSessionStore from '../../store/sessionStore'
import { ROLES } from '../../auth/roles'

/**
 * Qué se baja según el rol. CU003 lo acota: "la información necesaria y
 * autorizada para las funcionalidades offline correspondientes al rol".
 *
 * El Directivo no trabaja sin conexión —su Inicio son tres tarjetas que ya se
 * guardan aparte en localStorage (CU012)—, así que no se le baja nada: serían
 * datos de menores en un dispositivo que no los necesita.
 */
function fuentesDe(idRol) {
  const catalogos = {
    colegios: async () => (await listarColegiosAdmin()).items,
    grados: () => listarGradosAdmin(),
    semanas: () => obtenerSemanas(),
  }

  if (idRol === ROLES.DOCENTE) {
    return {
      ...catalogos,
      alumnos: async () => (await listarAlumnosAdmin({ estado: 'activo' })).items,
      asignaciones: () => listarAsignaciones(),
      nivelesRubrica: () => obtenerNivelesRubrica(),
      nivelesRazkids: () => obtenerNivelesRazkids(),
    }
  }

  if (idRol === ROLES.SUPERVISOR) {
    return {
      ...catalogos,
      alumnos: async () => (await listarAlumnosAdmin({ estado: 'activo' })).items,
    }
  }

  return null
}

export default function useSincronizacionLocal() {
  const enLinea = useConexion()
  const idRol = Number(useSessionStore((s) => s.usuario?.id_rol))
  const token = useSessionStore((s) => s.token)
  const queryClient = useQueryClient()

  // Una sincronización por visita, no una por render. Sin esto, cualquier
  // re-render de Inicio dispararía otra tanda de peticiones.
  const enCurso = useRef(false)

  useEffect(() => {
    const fuentes = fuentesDe(idRol)
    if (!enLinea || !token || !fuentes || enCurso.current) return

    enCurso.current = true
    precargarParaOffline(fuentes)
      .then(() => queryClient.invalidateQueries({ queryKey: ['precarga'] }))
      .catch(() => {
        // Silencioso por diseño: CU003 dice que un fallo aquí no afecta a la sesión.
      })
      .finally(() => {
        enCurso.current = false
      })
  }, [enLinea, idRol, token, queryClient])
}
