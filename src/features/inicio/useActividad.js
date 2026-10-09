// CU009 y CU010 — Iniciar y finalizar la actividad de trabajo del Docente.
//
// CAMBIÓ CON EL BACKEND NUEVO. Antes el inicio y el cierre se encolaban como
// cualquier otro cambio y se resolvían solo en el cliente. Ahora existen
// `POST /actividades` y `POST /actividades/{id}/finalizar` de verdad:
//
//   · El UUID lo sigue generando el navegador, pero ahora sirve para algo
//     concreto: el endpoint es idempotente (201 la primera vez, 200 si ese id
//     ya era suyo), así que un reintento tras un corte no duplica la actividad.
//   · SE PUEDE INICIAR SIN CONEXIÓN, como pide CU009 ("si existe conexión, el
//     sistema registra el inicio en PostgreSQL" — si no, se registra local y se
//     envía después). Encolarlo funciona porque `inicio` y `fin` son opcionales
//     y viajan CON ZONA: se manda la hora REAL en que ocurrió, no la de la
//     sincronización, que es lo que CU008 exige registrar por separado.
//   · El cierre por "Cerrar sesión" o por expiración lo hace el SERVIDOR, no
//     este hook: `POST /logout` finaliza sola la actividad abierta.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components/ui/Toast'
import { encolar, reintentarAhora } from '../../lib/colaOffline'
import { TIPOS_ENVIO } from '../../hooks/useOfflineQueue'
import {
  listarAlumnosAdmin,
  listarColegiosAdmin,
  listarGradosAdmin,
  listarMisAsignaciones,
} from '../../api/resources/administracion'
import { finalizarActividad, iniciarActividad } from '../../api/resources/actividades'
import { obtenerNivelesRazkids, obtenerNivelesRubrica, obtenerSemanas } from '../../api/resources/catalogos'
import { mensajeDeError, motivoDe } from '../../api/client'
import { precargarParaOffline } from '../../lib/precarga'
import useActividadStore from '../../store/actividadStore'
import useSessionStore from '../../store/sessionStore'
import useSyncStore from '../../store/syncStore'
import useConexion from '../../hooks/useConexion'
import { idSesionDe } from '../../auth/jwt'

export default function useActividad() {
  const toast = useToast()
  const enLinea = useConexion()
  const queryClient = useQueryClient()
  const idDocente = useSessionStore((s) => s.usuario?.id_docente)
  // El `jti` del token viaja con cada pendiente: identifica la sesión EN LA
  // QUE ocurrió la actividad. Sin él, un envío que se sincroniza tras un nuevo
  // login quedaría colgado de la sesión equivocada.
  const idSesion = useSessionStore((s) => idSesionDe(s.token))
  const sesion = useActividadStore((s) => s.sesion)
  const iniciarLocal = useActividadStore((s) => s.iniciar)
  const cerrarLocal = useActividadStore((s) => s.cerrar)
  const pendientes = useSyncStore((s) => s.pendientes)

  // `GET /me/asignaciones`: las del token, nunca por id de docente.
  const { data: asignaciones = [] } = useQuery({
    queryKey: ['me', 'asignaciones'],
    queryFn: listarMisAsignaciones,
    enabled: Boolean(idDocente),
  })

  const iniciar = async () => {
    // El id y la hora real se fijan AQUÍ, antes de cualquier llamada: son los
    // que se enviarán, hoy o cuando vuelva la red.
    const abierta = iniciarLocal({ idDocente })

    if (!enLinea) {
      encolar({
        clave: `actividad-inicio-${abierta.id}`,
        tipo: TIPOS_ENVIO.ACTIVIDAD_INICIO,
        payload: { id: abierta.id, inicio: abierta.inicio, id_sesion: idSesion },
        descripcion: 'Inicio de actividad',
      })
      toast.success(
        'Actividad iniciada sin conexión',
        'Ya puede registrar. El inicio se enviará con su hora real al recuperar la conexión.',
      )
      return
    }

    try {
      const creada = await iniciarActividad({ id: abierta.id })
      // El servidor manda la expiración de la SESIÓN, que es el límite real de
      // la actividad: una actividad no tiene 8 horas propias (CU009).
      useActividadStore.setState({ sesion: { ...abierta, ...creada } })
      queryClient.invalidateQueries({ queryKey: ['inicio'] })
    } catch (error) {
      // Si el servidor la rechaza, no puede quedarse abierta solo aquí: el
      // docente creería que puede registrar y cada guardado daría 409.
      useActividadStore.getState().limpiar()
      const motivo = motivoDe(error)
      if (motivo === 'sin_asignaciones') {
        toast.error('No se pudo iniciar', 'No puede iniciar una actividad porque no tiene asignaciones activas.')
      } else if (motivo === 'actividad_activa_existente') {
        toast.error('Ya hay una actividad abierta', 'Finalice la actividad actual antes de iniciar otra.')
      } else {
        toast.error('No se pudo iniciar la actividad', mensajeDeError(error))
      }
      return
    }

    toast.success('Actividad iniciada', 'Ya puede registrar en las grillas del aula.')

    // La precarga no bloquea: si falla, se trabaja en línea y el docente se
    // entera por el aviso, no por una grilla vacía.
    const { ok } = await precargarParaOffline({
      alumnos: async () => (await listarAlumnosAdmin({ estado: 'activo' })).items,
      colegios: async () => (await listarColegiosAdmin()).items,
      grados: () => listarGradosAdmin(),
      nivelesRubrica: () => obtenerNivelesRubrica(),
      nivelesRazkids: () => obtenerNivelesRazkids(),
      semanas: () => obtenerSemanas(),
      asignaciones: () => listarMisAsignaciones(),
    })

    if (!ok) toast.info('Precarga incompleta', 'Si se corta la conexión puede que falten datos.')
  }

  const finalizar = async () => {
    const cerrada = cerrarLocal()
    if (!cerrada) return

    if (!enLinea) {
      // El cierre se encola con su hora REAL. CU008 es explícito: lo que se
      // registra después en el servidor es cuándo ocurrió, no cuándo se envió.
      encolar({
        clave: `actividad-cierre-${cerrada.id}`,
        tipo: TIPOS_ENVIO.ACTIVIDAD_CIERRE,
        payload: { id: cerrada.id, fin: cerrada.fin, id_sesion: idSesion },
        descripcion: 'Cierre de actividad',
      })
      toast.info(
        'Actividad finalizada sin conexión',
        pendientes > 0
          ? `Quedan ${pendientes} cambios guardados en este dispositivo. Se enviarán al recuperar la conexión.`
          : 'Se registrará el cierre al recuperar la conexión.',
      )
      return
    }

    try {
      await finalizarActividad(cerrada.id)
      reintentarAhora()
      queryClient.invalidateQueries({ queryKey: ['inicio'] })
      toast.success('Actividad finalizada')
    } catch (error) {
      toast.error('No se pudo registrar el cierre', mensajeDeError(error))
    }
  }

  return { sesion, iniciar, finalizar, sinAsignaciones: asignaciones.length === 0 }
}
