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
import { ahora, hayContinuidad } from '../../lib/relojServidor'
import { finalizarActividad, iniciarActividad } from '../../api/resources/actividades'
import { obtenerInicioDocente } from '../../api/resources/inicio'
import { obtenerNivelesRazkids, obtenerNivelesRubrica } from '../../api/resources/catalogos'
import { obtenerMisHabilitaciones } from '../../api/resources/habilitaciones'
import { mensajeDeError, motivoDe } from '../../api/client'
import { precargarParaOffline, propietarioDe } from '../../lib/precarga'
import useActividadStore, { useActividadEnCurso } from '../../store/actividadStore'
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

/** Literal de CU009 ("Inicio de actividad sin conexión a Internet"), CP-INI-28. */
export const SIN_HABILITACION_VERIFICABLE_AL_INICIAR =
  'No se puede verificar tu habilitación sin conexión. Conéctate a Internet para actualizar tus asignaciones, permisos y referencia temporal.'

/**
 * Las pantallas cuyo GET trae el bloque `escritura` del servidor (T6). El
 * servidor lo calcula CON la actividad abierta, así que al abrirla o cerrarla
 * hay que volver a pedirlo: si no, quien inicia la actividad desde la propia
 * pantalla sigue viendo "Inicia una actividad…" y no puede registrar.
 */
const CON_ESCRITURA_DEL_SERVIDOR = [['asistencia', 'clase'], ['lectura', 'tabla'], ['rubricas'], ['registro-vuelo']]

/** D62 — "Queda 1 cambio guardado", no "Quedan 1 cambios guardados". */
const cambiosGuardados = (n) => (n === 1 ? 'Queda 1 cambio guardado' : `Quedan ${n} cambios guardados`)

/**
 * El `POST /actividades` que todavía no responde (D011 del reporte de UX).
 *
 * La actividad se abre en el navegador ANTES de llamar al servidor, así que el
 * botón pasa a "Finalizar" al instante. Si el Docente lo pulsaba en ese
 * intervalo, el cierre llegaba primero (404, "la actividad no existe"), luego
 * llegaba el inicio y la actividad quedaba ABIERTA en el servidor aunque él la
 * hubiera finalizado. Finalizar espera a este inicio; es de módulo, y no del
 * hook, porque `iniciar` también se llama desde los mantenimientos.
 */
let inicioEnVuelo = null

/** D009: los avisos de iniciar y finalizar se reemplazan entre sí, no se apilan. */
const AVISO_ACTIVIDAD = { clave: 'actividad' }

export default function useActividad() {
  const toast = useToast()
  const enLinea = useConexion()
  const queryClient = useQueryClient()
  const idDocente = useSessionStore((s) => s.usuario?.id_docente)
  // El `jti` del token viaja con cada pendiente: identifica la sesión EN LA
  // QUE ocurrió la actividad. Sin él, un envío que se sincroniza tras un nuevo
  // login quedaría colgado de la sesión equivocada.
  const idSesion = useSessionStore((s) => idSesionDe(s.token))
  // D114 — La misma fuente que leen los módulos.
  const { sesion, conocidaPorServidor } = useActividadEnCurso()

  /** `['inicio']` y las pantallas con `escritura`: todas dependen de la actividad. */
  const refrescarTrasActividad = () => {
    Promise.all(
      [['inicio'], ...CON_ESCRITURA_DEL_SERVIDOR].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    ).catch(() => null)
  }
  /**
   * D114 — Cuando el inicio encolado sin conexión llega al servidor, lo que
   * los módulos tenían de él se calculó sin esta actividad: se vuelve a pedir.
   */
  useEffect(() => {
    if (conocidaPorServidor) refrescarTrasActividad()
    // Solo al pasar a conocida: `refrescarTrasActividad` cambia en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conocidaPorServidor, sesion?.id])

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
  const { data: inicio, dataUpdatedAt: inicioRespondidoEn } = useQuery({
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

  /**
   * Y AL REVÉS: el servidor dice que NO hay actividad y aquí creíamos que sí (D89).
   *
   * Pasa al finalizarla desde otra pestaña o desde otro equipo. La barra seguía
   * ofreciendo "Finalizar actividad" —incluso tras recargar— y cada registro se
   * descartaba con "La operación se realizó fuera de una actividad de trabajo
   * del docente", que es el servidor diciendo exactamente esto.
   *
   * Solo se suelta si el servidor PUDO saberlo: con conexión, con su respuesta
   * en la mano y si el inicio de esta actividad no sigue esperando en la cola.
   * Una actividad iniciada sin señal todavía no existe para él, y soltarla
   * borraría algo que sí está abierto.
   */
  useEffect(() => {
    if (!enLinea || !inicio || remota || !sesion) return
    // Su inicio sigue esperando en la cola: el servidor todavía no sabe que
    // existe, así que su silencio no significa que esté cerrada.
    if (itemsPendientes.some((item) => item.clave === `actividad-inicio-${sesion.id}`)) return
    /**
     * Y LA RESPUESTA TIENE QUE SER POSTERIOR AL INICIO.
     *
     * Si no, se soltaba la actividad recién abierta: al iniciarla, la respuesta
     * que hay en memoria es de hace un momento y todavía dice que no hay
     * ninguna. Comparando contra `dataUpdatedAt` solo cuenta lo que el
     * servidor respondió DESPUÉS de que esta actividad existiera.
     */
    const abiertaEn = Date.parse(sesion.inicio)
    if (!Number.isNaN(abiertaEn) && inicioRespondidoEn <= abiertaEn) return
    // Y solo una que el servidor LLEGÓ A CONOCER: si nunca supo de ella, su
    // silencio no dice nada.
    if (!sesion.delServidor) return
    useActividadStore.getState().limpiar()
  }, [enLinea, inicio, inicioRespondidoEn, remota, sesion, itemsPendientes])

  const iniciar = async () => {
    /**
     * CU009 y CU010 — SIN CONEXIÓN Y SIN REFERENCIA TEMPORAL, NO SE INICIA.
     *
     * Tras recargar o reabrir el navegador sin red se pierde la continuidad de
     * la hora del servidor (`hayContinuidad()`): no se puede saber si la
     * asignación o el permiso siguen vigentes ni qué hora real llevaría el
     * inicio. CU009 pide exigir conexión antes de iniciar, con su literal, y
     * sin tocar los pendientes. Antes se iniciaba igual (CP-INI-28, ronda 9).
     */
    if (!enLinea && !hayContinuidad()) {
      toast.error('No se pudo iniciar', SIN_HABILITACION_VERIFICABLE_AL_INICIAR, AVISO_ACTIVIDAD)
      return
    }

    // El id y la hora real se fijan AQUÍ, antes de cualquier llamada: son los
    // que se enviarán, hoy o cuando vuelva la red.
    const abierta = iniciarLocal({ idDocente })

    /**
     * El inicio va a la cola con su id y su hora real, y la actividad queda
     * abierta: se puede registrar ya. `antesQueSuActividad` lo pone delante de
     * lo que ya se haya registrado en ella, para que el servidor la conozca
     * antes de recibir sus cambios.
     */
    const encolarInicio = () => {
      encolar({
        clave: `actividad-inicio-${abierta.id}`,
        tipo: TIPOS_ENVIO.ACTIVIDAD_INICIO,
        payload: { id: abierta.id, inicio: abierta.inicio, id_sesion: idSesion },
        descripcion: 'Inicio de actividad',
        antesQueSuActividad: abierta.id,
      }).catch(() => {
        // El resultado se ve en el panel de sincronización, no aquí: la cola
        // deja anotado el rechazo (D69) o el envío pendiente de reintentar.
      })
      toast.success(
        'Actividad iniciada sin conexión',
        'Ya puedes registrar. El inicio se enviará con su hora real al recuperar la conexión.',
        AVISO_ACTIVIDAD,
      )
    }

    if (!enLinea) {
      encolarInicio()
      return
    }

    const peticion = iniciarActividad({ id: abierta.id })
    inicioEnVuelo = peticion
    useActividadStore.setState({ confirmandoInicio: true })
    try {
      const creada = await peticion
      // El servidor manda la expiración de la SESIÓN, que es el límite real de
      // la actividad: una actividad no tiene 8 horas propias (CU009).
      // `delServidor`: a partir de aquí, que deje de nombrarla significa que
      // se cerró en otro sitio (D89).
      useActividadStore.setState({ sesion: { ...abierta, ...creada, delServidor: true } })
      refrescarTrasActividad()
    } catch (error) {
      /**
       * SIN RESPUESTA: SE CAYÓ LA RED, NO LA RECHAZÓ EL SERVIDOR.
       *
       * Iniciar justo cuando se va el internet: el POST sale, no vuelve nada,
       * y la actividad se cerraba aquí. Pero mientras esperaba ya se podía
       * registrar, y esos cambios quedaban en la cola con una actividad que
       * el servidor nunca conoció: al reconectar se descartaban por "fuera de
       * una actividad". Se sigue como un inicio sin conexión. Si el POST sí
       * había llegado, reenviarlo con el mismo id no duplica nada (200).
       */
      if (!error?.response) {
        encolarInicio()
        return
      }
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
        toast.error('No se pudo iniciar', mensajeDeError(error, SIN_HABILITACIONES), AVISO_ACTIVIDAD)
      } else if (motivo === 'actividad_activa_existente') {
        /**
         * El texto del SERVIDOR primero, igual que en `sin_asignaciones`.
         *
         * D58 — El tester leyó aquí un texto nuestro donde esperaba el del CU.
         * El respaldo es ahora el literal de CU009 ("Intento de iniciar una
         * segunda actividad simultánea"), que es el mismo `detail` que manda el
         * backend con `actividad_activa_existente`: coincidan o no, dicen lo
         * mismo.
         */
        toast.error(
          'Ya hay una actividad abierta',
          mensajeDeError(error, 'Debes finalizar la actividad actual antes de iniciar una nueva.'),
          AVISO_ACTIVIDAD,
        )
      } else if (motivo === 'actividad_superpuesta') {
        // Puede pasar al sincronizar: el horario choca con otra actividad suya
        // de la misma sesión. No es culpa de lo que acaba de hacer.
        toast.error(
          'El horario se cruza con otra actividad',
          'Ya tiene registrada otra actividad en ese mismo tramo.',
          AVISO_ACTIVIDAD,
        )
      } else {
        toast.error('No se pudo iniciar la actividad', mensajeDeError(error), AVISO_ACTIVIDAD)
      }
      return
    } finally {
      if (inicioEnVuelo === peticion) inicioEnVuelo = null
      useActividadStore.setState({ confirmandoInicio: false })
    }

    toast.success('Actividad iniciada', 'Ya puedes registrar.', AVISO_ACTIVIDAD)

    // La precarga no bloquea: si falla, se trabaja en línea y el docente se
    // entera por el aviso, no por una grilla vacía.
    const { ok } = await precargarParaOffline({
      // CU014: "Todos" sin conexión tiene que dar lo mismo que con ella,
      // así que se bajan también los inactivos (y los pendientes de pertenencia).
      alumnos: async () => (await listarAlumnosAdmin({ estado: 'todos' })).items,
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
    void queryClient.invalidateQueries({ queryKey: ['precarga'] })

    if (!ok) toast.info('Precarga incompleta', 'Si se corta la conexión puede que falten datos.')
  }

  const finalizar = async () => {
    // D011: primero que el servidor conozca el inicio. Si lo rechazó, la
    // actividad ya se limpió y `cerrarLocal` no encuentra nada que cerrar.
    if (inicioEnVuelo) await inicioEnVuelo.catch(() => null)
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
      }).catch(() => {
        // Igual que el inicio: el resultado se ve en el panel de sincronización.
      })
      toast.info(
        'Actividad finalizada sin conexión',
        pendientes > 0
          ? `${cambiosGuardados(pendientes)} en este dispositivo. Se enviarán al recuperar la conexión.`
          : 'Se registrará el cierre al recuperar la conexión.',
        AVISO_ACTIVIDAD,
      )
      return
    }

    try {
      await finalizarActividad(cerrada.id)
      // La cola maneja sus errores y los muestra en el SyncBadge: el catch
      // solo cierra la promesa, igual que en `iniciarCola`.
      reintentarAhora().catch(() => null)
      refrescarTrasActividad()
      toast.success('Actividad finalizada', undefined, AVISO_ACTIVIDAD)
    } catch (error) {
      toast.error('No se pudo registrar el cierre', mensajeDeError(error), AVISO_ACTIVIDAD)
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
