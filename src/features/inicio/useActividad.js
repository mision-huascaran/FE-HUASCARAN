// CU010 — Iniciar y finalizar la actividad de trabajo del Docente.
//
// El inicio y el cierre se encolan como cualquier otro cambio: así el docente
// puede pulsarlos sin red y el servidor los recibe al reconectar. El id lo
// genera el navegador, de modo que no hay que esperar respuesta para empezar.
//
// Al finalizar NO se borra la cola: los cambios pendientes siguen en IndexedDB
// hasta confirmar su persistencia.
import { useQuery } from '@tanstack/react-query'
import { useToast } from '../../components/ui/Toast'
import { encolar, reintentarAhora } from '../../lib/colaOffline'
import {
  listarAlumnosAdmin,
  listarAsignaciones,
  listarColegiosAdmin,
  listarGradosAdmin,
} from '../../api/resources/administracion'
import { obtenerNivelesRazkids, obtenerNivelesRubrica, obtenerSemanas } from '../../api/resources/catalogos'
import { obtenerAsignaciones } from '../../api/resources/docentes'
import { precargarParaOffline } from '../../lib/precarga'
import useActividadStore from '../../store/actividadStore'
import useFiltrosStore from '../../store/filtrosStore'
import useSessionStore from '../../store/sessionStore'
import useSyncStore from '../../store/syncStore'
import useConexion from '../../hooks/useConexion'

export default function useActividad() {
  const toast = useToast()
  const enLinea = useConexion()
  const idDocente = useSessionStore((s) => s.usuario?.id_docente)
  const idPeriodo = useFiltrosStore((s) => s.idPeriodo)
  const sesion = useActividadStore((s) => s.sesion)
  const iniciarSesion = useActividadStore((s) => s.iniciar)
  const cerrarSesion = useActividadStore((s) => s.cerrar)
  const pendientes = useSyncStore((s) => s.pendientes)

  const { data: asignaciones = [] } = useQuery({
    queryKey: ['admin', 'asignaciones'],
    queryFn: listarAsignaciones,
    enabled: Boolean(idDocente),
  })

  const iniciar = async () => {
    const abierta = iniciarSesion({ idDocente })
    encolar({
      clave: `actividad-inicio-${abierta.id}`,
      tipo: 'actividad',
      payload: { ...abierta, accion: 'iniciar' },
      descripcion: 'Inicio de actividad',
    })

    // La actividad arranca ya: la precarga no la bloquea. Si falla, se trabaja
    // en línea y el docente se entera por el aviso, no por una grilla vacía.
    toast.success('Actividad iniciada', 'Ya puede registrar en las grillas del aula.')

    if (!enLinea) {
      toast.info('Sin conexión al iniciar', 'No se pudieron precargar los datos del aula.')
      return
    }

    const { ok } = await precargarParaOffline({
      alumnos: async () => (await listarAlumnosAdmin({ estado: 'activo' })).items,
      colegios: () => listarColegiosAdmin(),
      grados: () => listarGradosAdmin(),
      nivelesRubrica: () => obtenerNivelesRubrica(),
      nivelesRazkids: () => obtenerNivelesRazkids(),
      // Sin estas dos, la grilla se abría sin red con los desplegables de
      // colegio y semana vacíos: es de donde salen sus opciones.
      semanas: () => obtenerSemanas(),
      ...(idDocente && idPeriodo ? { asignaciones: () => obtenerAsignaciones(idDocente, idPeriodo) } : {}),
    })

    if (!ok) {
      toast.info('Precarga incompleta', 'Si se corta la conexión puede que falten datos.')
    }
  }

  const finalizar = () => {
    const cerrada = cerrarSesion()
    if (!cerrada) return
    encolar({
      clave: `actividad-cierre-${cerrada.id}`,
      tipo: 'actividad',
      payload: { ...cerrada, accion: 'cerrar', motivo: 'manual' },
      descripcion: 'Cierre de actividad',
    })

    // Con conexión se intenta vaciar la cola ahora; sin ella, los cambios se
    // quedan guardados y se avisa de que no se ha perdido nada.
    if (enLinea) {
      reintentarAhora()
      toast.success('Actividad finalizada')
    } else {
      toast.info(
        'Actividad finalizada sin conexión',
        pendientes > 0
          ? `Quedan ${pendientes} cambios guardados en este dispositivo. Se enviarán al recuperar la conexión.`
          : 'Se enviará el cierre al recuperar la conexión.',
      )
    }
  }

  return { sesion, iniciar, finalizar, sinAsignaciones: asignaciones.length === 0 }
}
