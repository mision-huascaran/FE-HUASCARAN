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
import { useEffect } from 'react'
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
import { hayHabilitacionParaIniciar } from '../../auth/habilitaciones'
import { ahora } from '../../lib/relojServidor'
import { finalizarActividad, iniciarActividad } from '../../api/resources/actividades'
import { obtenerInicioDocente } from '../../api/resources/inicio'
import { obtenerNivelesRazkids, obtenerNivelesRubrica } from '../../api/resources/catalogos'
import { obtenerMisHabilitaciones } from '../../api/resources/habilitaciones'
import { mensajeDeError, motivoDe } from '../../api/client'
import { precargarParaOffline, propietarioDe } from '../../lib/precarga'
import useActividadStore from '../../store/actividadStore'
import useSessionStore from '../../store/sessionStore'
import useSyncStore from '../../store/syncStore'
import useConexion from '../../hooks/useConexion'
import { idSesionDe } from '../../auth/jwt'

/**
 * Respaldo del literal de CU010 para cuando el servidor no manda el suyo.
 *
 * Lo normal es usar `motivo_no_puede`, que llega redactado: el motivo depende
 * del calendario de cada colegio y de los permisos vigentes, y eso no se puede
 * deducir aquí.
 */
export const SIN_HABILITACIONES =
  'No puedes iniciar una actividad porque no tienes asignaciones habilitadas ni permisos excepcionales vigentes.'

/**
 * Las pantallas cuyo GET trae el bloque `escritura` del servidor (T6). El
 * servidor lo calcula CON la actividad abierta, así que al abrirla o cerrarla
 * hay que volver a pedirlo: si no, quien inicia la actividad desde la propia
 * pantalla sigue viendo "Inicia una actividad…" y no puede registrar.
 */
const CON_ESCRITURA_DEL_SERVIDOR = [['asistencia', 'clase'], ['lectura', 'tabla'], ['rubricas'], ['registro-vuelo']]

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

  /** `['inicio']` y las pantallas con `escritura`: todas dependen de la actividad. */
  const refrescarTrasActividad = () => {
    Promise.all(
      [['inicio'], ...CON_ESCRITURA_DEL_SERVIDOR].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    ).catch(() => null)
  }
  const iniciarLocal = useActividadStore((s) => s.iniciar)
  const cerrarLocal = useActividadStore((s) => s.cerrar)
  const pendientes = useSyncStore((s) => s.pendientes)

  const itemsPendientes = useSyncStore((s) => s.items)

  /**
   * El paquete de habilitaciones, que es lo que de verdad decide (D56).
   *
   * Trae las asignaciones Y LOS PERMISOS excepcionales. Antes aquí se pedía
   * solo `GET /me/asignaciones`, y por eso un Docente con un permiso vigente y
   * sin asignaciones veía el botón deshabilitado: no podía iniciar la
   * actividad y, sin actividad, no podía usar el permiso para nada.
   */
  const { data: habilitaciones } = useQuery({
    queryKey: ['me', 'habilitaciones'],
    queryFn: obtenerMisHabilitaciones,
    enabled: Boolean(idDocente),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  /**
   * La actividad abierta según el SERVIDOR (`actividad_activa` de
   * `GET /inicio/docente`), que es quien manda. Si este navegador no la
   * conoce —se cerró sesión sin conexión, se cerró el navegador, se entró
   * desde otro equipo—, se adopta para que el Docente pueda finalizarla en vez
   * de chocar con un 409 al intentar iniciar otra.
   */
  const { data: inicio } = useQuery({
    queryKey: ['inicio', 'docente', idDocente],
    queryFn: obtenerInicioDocente,
    enabled: Boolean(idDocente) && enLinea,
  })
  const remota = inicio?.actividad_activa ?? null

  useEffect(() => {
    if (!remota?.id || sesion) return
    // Su cierre ya está en la cola, esperando a enviarse: no está abierta.
    if (itemsPendientes.some((item) => item.clave === `actividad-cierre-${remota.id}`)) return
    useActividadStore.getState().restaurar({ id: remota.id, inicio: remota.inicio, idDocente })
  }, [remota?.id, remota?.inicio, sesion, itemsPendientes, idDocente])

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
      refrescarTrasActividad()
    } catch (error) {
      // Si el servidor la rechaza, no puede quedarse abierta solo aquí: el
      // docente creería que puede registrar y cada guardado daría 409.
      useActividadStore.getState().limpiar()
      const motivo = motivoDe(error)
      if (motivo === 'sin_asignaciones') {
        /**
         * El texto lo manda el SERVIDOR, no se escribe aquí.
         *
         * Desde T4 este caso es 422 y no 409, y el mensaje menciona los
         * permisos excepcionales: "No puedes iniciar una actividad porque no
         * tienes asignaciones habilitadas ni permisos excepcionales
         * vigentes." Repetirlo en el cliente garantizaba que un día dejaran de
         * coincidir. El literal de respaldo es solo para cuando no llega.
         */
        toast.error('No se pudo iniciar', mensajeDeError(error, SIN_HABILITACIONES))
      } else if (motivo === 'actividad_activa_existente') {
        /**
         * El texto del SERVIDOR primero, igual que en `sin_asignaciones`.
         *
         * D58 — El tester leyó aquí un texto nuestro donde esperaba el de
         * CU010. El contrato no publica el literal de este caso, así que lo
         * que corresponde es decir lo que diga el servidor y dejar el nuestro
         * como respaldo, no competir con él.
         */
        toast.error(
          'Ya hay una actividad abierta',
          mensajeDeError(error, 'Finalice la actividad actual antes de iniciar otra.'),
        )
      } else if (motivo === 'actividad_superpuesta') {
        // Puede pasar al sincronizar: el horario choca con otra actividad suya
        // de la misma sesión. No es culpa de lo que acaba de hacer.
        toast.error('El horario se cruza con otra actividad', 'Ya tiene registrada otra actividad en ese mismo tramo.')
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
      asignaciones: () => listarMisAsignaciones(),
      /**
       * D45 — SIN ESTO, LA ACTIVIDAD SE INICIABA A CIEGAS.
       *
       * La habilitación para escribir no depende solo de tener asignaciones:
       * depende del CALENDARIO de cada colegio —en qué periodo está hoy, qué
       * días son lectivos— y de los PERMISOS excepcionales vigentes. Nada de
       * eso estaba en la precarga, así que sin conexión el cliente no podía
       * comprobar nada y dejaba pasar lo que el servidor luego rechazaría.
       *
       * `GET /me/habilitaciones` trae las dos cosas ya resueltas, con el
       * calendario de cada colegio dentro. `src/auth/habilitaciones.js` tiene
       * la lógica pura que las lee sin conexión.
       */
      habilitaciones: () => obtenerMisHabilitaciones(),
    }, { propietario: propietarioDe(useSessionStore.getState().usuario) })
    queryClient.invalidateQueries({ queryKey: ['precarga'] })

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
        // Sin su inicio, el servidor responde 404: la actividad no existiría.
        // Si el inicio se descarta por un error definitivo, este se va con él.
        dependeDe: `actividad-inicio-${cerrada.id}`,
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
      refrescarTrasActividad()
      toast.success('Actividad finalizada')
    } catch (error) {
      toast.error('No se pudo registrar el cierre', mensajeDeError(error))
    }
  }

  /**
   * Por qué no se puede iniciar, según el SERVIDOR (`motivo_no_puede_iniciar`).
   *
   * Lo decide el backend y no el cliente: el calendario operativo (PA1…PA4 y
   * los recesos) vive en su base de datos, así que deducir aquí si estamos
   * "fuera de periodo" sería adivinar. CU010 pide además que el botón se vea
   * DESHABILITADO, nunca oculto, con el motivo al lado.
   *
   * Si el servidor no contesta todavía, se cae al paquete local de
   * habilitaciones, que incluye los permisos excepcionales (D56).
   */
  const puedeEnLocal = hayHabilitacionParaIniciar({ habilitaciones, instante: ahora() })
  /**
   * Mientras no se sabe NADA —ni el servidor ha contestado ni hay paquete
   * local— el botón no se deshabilita. Deshabilitarlo "por si acaso" daría un
   * motivo que nadie ha comprobado; dejándolo activo, como mucho el servidor
   * responde su 422 con el texto bueno.
   */
  const motivo =
    inicio?.motivo_no_puede_iniciar ?? (habilitaciones && !puedeEnLocal ? 'sin_asignaciones' : null)

  return {
    sesion,
    iniciar,
    finalizar,
    motivoNoPuedeIniciar: motivo === 'actividad_activa' ? null : motivo,
    /**
     * El texto ya redactado por el servidor (`motivo_no_puede`, T4).
     *
     * Viene al lado del código porque el mensaje depende de cosas que el
     * cliente no sabe: el calendario de CADA colegio y los permisos vigentes.
     * Si no llega, la pantalla cae a su literal.
     */
    textoNoPuedeIniciar: inicio?.motivo_no_puede ?? null,
    /** Los permisos de corrección vigentes, para el apartado de CU010. */
    permisosVigentes: inicio?.permisos_vigentes ?? [],
    // `actividad_activa` no impide nada: significa que ya hay una abierta, y
    // en ese caso el botón que se muestra es "Finalizar actividad".
    sinAsignaciones: Boolean(motivo) && motivo !== 'actividad_activa',
  }
}
