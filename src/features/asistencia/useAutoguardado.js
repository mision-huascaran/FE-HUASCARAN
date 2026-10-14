// Auto-save de la asistencia (CU022, Arquitectura de Guardado Automático).
//
// No hay botón de guardar. Cada clic en el Segmented Control pinta la fila al
// instante y manda un micro-paquete por su cuenta. Lo delicado no es enviarlo,
// es QUÉ PASA CUANDO FALLA: el caso de uso pide revertir el control a su estado
// inmediatamente anterior y avisar, con dos mensajes distintos según el fallo
// sea local o del servidor.
//
// De ahí que se guarde `previo` antes de tocar nada: sin él, "deshacer" sería
// adivinar, y al tercer clic seguido ya no habría a qué volver.
//
// La cola offline hace el resto del trabajo sucio. Su clave es alumno-fecha-
// programa, así que un alumno nunca tiene dos envíos contradictorios esperando:
// el último sustituye al anterior. Es también lo que hace que una ráfaga de
// clics sobre el mismo alumno cuente como UN cambio en la métrica de
// productividad (CU021), tal como exige CU022.
import { useCallback, useMemo, useState } from 'react'
import { useToast } from '../../components/ui/Toast'
import { encolar } from '../../lib/colaOffline'
import { motivoDe } from '../../api/client'
import { TIPOS_ENVIO, claveDeMarca } from '../../hooks/useOfflineQueue'

// Literales de CU022. Se escriben tal cual porque el caso de uso los da como
// "el mensaje exacto" y el probador los comprueba palabra por palabra.
export const ERROR_LOCAL = 'Error al guardar la asistencia localmente. Inténtelo nuevamente.'
export const ERROR_SERVIDOR =
  'El servidor rechazó el registro de asistencia. Verifique su conexión o contacte al Supervisor.'

/** Sin marcar: ni presente ni ausente. Es un estado, no un valor que falta. */
const sinMarcar = (valor) => valor !== true && valor !== false

/**
 * @param alumnos lista que llega del servidor, ya con sus marcas guardadas.
 * @param activo  false para el Supervisor: CU022 le desactiva el Auto-save por
 *   completo, ni PostgreSQL ni IndexedDB.
 */
export default function useAutoguardado({ alumnos = [], fecha, idPrograma, activo }) {
  const toast = useToast()

  // Lo que este navegador ha cambiado por encima de lo que vino del servidor,
  // atado a SU clase: cambiar de fecha o de subprograma no puede arrastrar las
  // marcas de la anterior, porque los ids de alumno se repiten entre clases.
  const clase = `${fecha}|${idPrograma}`
  const [cambios, setCambios] = useState({ clase, locales: {} })
  // Memorizado porque `presenteDe` lo lleva como dependencia: un objeto nuevo
  // en cada render volvería a crear la función y, con ella, todo lo que
  // depende de ella.
  const locales = useMemo(() => (cambios.clase === clase ? cambios.locales : {}), [cambios, clase])

  const presenteDe = useCallback(
    (alumno) => (alumno.id_alumno in locales ? locales[alumno.id_alumno] : alumno.presente),
    [locales],
  )

  const escribir = useCallback(
    (idAlumno, valor) =>
      setCambios((previos) => ({
        clase,
        locales: { ...(previos.clase === clase ? previos.locales : {}), [idAlumno]: valor },
      })),
    [clase],
  )

  /** Marca a un alumno y manda su micro-paquete. Revierte si no se puede. */
  const marcar = useCallback(
    async (alumno, valor) => {
      if (!activo) return null

      const previo = presenteDe(alumno)
      if (previo === valor) return null
      escribir(alumno.id_alumno, valor)

      try {
        await encolar({
          clave: claveDeMarca(alumno.id_alumno, fecha, idPrograma),
          tipo: TIPOS_ENVIO.ASISTENCIA,
          payload: { id_alumno: alumno.id_alumno, fecha, id_programa: Number(idPrograma), presente: valor },
          descripcion: `Asistencia de ${alumno.nombres} ${alumno.apellidos}`,
          // Sin botón de guardar, un apunte local que no queda escrito es un
          // dato perdido en silencio.
          exigePersistencia: true,
        })
        return null
      } catch (error) {
        // La cola solo rechaza cuando el envío no va a llegar nunca: se
        // agotaron los reintentos, el error no admite reintento, o no se pudo
        // ni apuntar en IndexedDB.
        escribir(alumno.id_alumno, previo)
        const local = motivoDe(error) === 'persistencia_local'
        toast.error('No se registró la asistencia', local ? ERROR_LOCAL : ERROR_SERVIDOR)
        return error
      }
    },
    [activo, presenteDe, escribir, fecha, idPrograma, toast],
  )

  /**
   * "Marcar todos como presentes" (paso 8).
   *
   * Solo toca a los que están SIN MARCAR. El caso de uso lo subraya: lo que el
   * docente ya decidió a mano no se sobrescribe, ni siquiera para ponerlo en
   * presente.
   */
  const marcarTodosPresentes = useCallback(() => {
    const pendientes = alumnos.filter((a) => sinMarcar(presenteDe(a)))
    pendientes.forEach((a) => marcar(a, true))
    return pendientes.length
  }, [alumnos, presenteDe, marcar])

  return {
    presenteDe,
    marcar,
    marcarTodosPresentes,
    sinMarcar: alumnos.filter((a) => sinMarcar(presenteDe(a))).length,
  }
}
