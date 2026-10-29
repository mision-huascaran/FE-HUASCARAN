// Punto de entrada de la cola offline para los componentes (RNF-001).
// Registra qué recurso atiende cada tipo de envío y expone el estado que pintan
// el SyncBadge y las filas de Asistencia.
import { useEffect } from 'react'
import { encolar, iniciarCola, registrarEnviador, reintentarAhora } from '../lib/colaOffline'
import { cerrarSesionDiferido } from '../api/resources/auth'
import { MOTIVO_REGISTRO, guardarAsistencia } from '../api/resources/asistencia'
import { habilitarRegistroLectura, marcarNoRealizada } from '../api/resources/lectura'
import { textoDeRechazo } from '../api/resources/sincronizacion'
import { finalizarActividad, iniciarActividad } from '../api/resources/actividades'
import useActividadStore from '../store/actividadStore'
import useRechazosStore from '../store/rechazosStore'
import useSyncStore from '../store/syncStore'

export const TIPOS_ENVIO = {
  ACTIVIDAD_INICIO: 'actividad-inicio',
  ACTIVIDAD_CIERRE: 'actividad-cierre',
  /**
   * D44 — El cierre de la SESIÓN, no el de la actividad.
   *
   * Son dos cosas distintas y la diferencia importa: una actividad que el
   * docente ya dio por terminada NO se reescribe, así que mandar el cierre
   * por `/actividades/{id}/finalizar` la dejaba como "Manual por finalización
   * de actividad" y la sesión seguía abierta en el servidor, con su fin y su
   * causa en null. `POST /me/sesiones/{id}/cerrar` cierra las dos, y la
   * actividad como "Forzado por cierre de sesión".
   */
  SESION_CIERRE: 'sesion-cierre',
  ASISTENCIA: 'asistencia',
  /**
   * CU026 — Declarar la lectura "no realizada" y DESHACERLO.
   *
   * Se encolan las dos. El caso de uso tiene su propio flujo "Registro sin
   * conexión a Internet": la declaración se guarda como "Pendiente de
   * sincronización" y la reversión también, "vinculada a la declaración
   * original". Por eso van separadas: la reversión DEPENDE de la declaración,
   * y si aquella se rechaza, esta no se envía.
   */
  LECTURA_NO_REALIZADA: 'lectura-no-realizada',
  LECTURA_HABILITAR: 'lectura-habilitar',
}

/**
 * El segundo argumento es el MÓDULO del contrato, para el aviso de pendientes.
 * Los nombres de aquí son los de la interfaz y los de allí son una lista
 * cerrada —`asistencias`, `lectura`, `rubrica`, `registro_vuelo`, `alumnos`,
 * `actividad`—, así que la traducción se declara donde se sabe a qué endpoint
 * va cada envío: aquí mismo.
 */
// CU022: cada micro-paquete del Auto-save. La clave es LA CLASE y el alumno, la
// misma unicidad que garantiza la base, así que marcar y desmarcar al mismo
// alumno dos veces deja UN solo envío en la cola y no dos contradictorios.
/**
 * La asistencia va por clase, no por fecha suelta: colegio, grado, sección y
 * fecha. `id_operacion` lo pone la cola y viaja DENTRO de cada registro,
 * porque el contrato trata cada fila como una operación independiente.
 */
registrarEnviador(
  TIPOS_ENVIO.ASISTENCIA,
  async ({
    idColegio,
    idGrado,
    idSeccion,
    fecha,
    nombre,
    adicional,
    registros,
    id_operacion: idOperacion,
    idempotency_key: clave,
  }) => {
    const respuesta = await guardarAsistencia({
      idColegio,
      idGrado,
      idSeccion,
      fecha,
      adicional,
      registros: (registros ?? []).map((r) => ({ id_operacion: idOperacion, version: null, ...r })),
    })

    /**
     * UN RECHAZO DENTRO DE UN 200 TAMBIÉN SE ANOTA.
     *
     * El lote responde 200 aunque alguno de sus ítems venga rechazado, así que
     * para la cola el envío fue bien y nadie lo registra. La pantalla de
     * Asistencias sí lo atiende —revierte el control y avisa—, pero solo
     * mientras siga abierta: si el docente recargó la página o cerró el
     * navegador, esa promesa ya no existe y el rechazo **desaparecía en
     * silencio**. Era D69 otra vez, y Asistencias es el único de los cuatro
     * módulos al que le faltaba.
     *
     * Se anota aquí, que es por donde pasa cualquier envío de asistencia, venga de
     * un clic o de la cola al recuperar la señal.
     */
    const rechazos = useRechazosStore.getState()
    const resultados = Array.isArray(respuesta?.resultados) ? respuesta.resultados : []
    /**
     * D91 — EL RESULTADO PROPIO SE BUSCA POR `id_operacion`.
     *
     * Antes la pantalla lo buscaba por `registro.id_alumno`, y un rechazo
     * como `actividad_requerida` o `alumno_fuera_de_la_clase` llega SIN
     * registro: no se encontraba, la fila se quedaba con un valor que el
     * servidor no guardó y no había aviso. El `id_operacion` siempre vuelve.
     */
    const propio = resultados.find((r) => r?.id_operacion === idOperacion) ?? null
    if (propio?.estado === 'rechazada') {
      rechazos.agregar({
        clave,
        modulo: 'asistencias',
        nombre: nombre ?? null,
        idOperacion,
        motivo: propio.motivo ?? null,
        detail: textoDeRechazo(propio, MOTIVO_REGISTRO) ?? 'El servidor rechazó el registro.',
        // Asistencias no tiene control de versión —gana la captura más
        // reciente—, así que no hay "versión actual" que ofrecer: la salida
        // es descartar la operación.
        registro: null,
        // D91 — Lo que el docente escribió no se pierde con el rechazo: queda
        // en la tarjeta para poder copiarlo.
        observacion: registros?.find((r) => r.observacion)?.observacion ?? null,
      })
    } else if (propio?.estado === 'aceptada') {
      // La marca buena sustituye al rechazo anterior del mismo registro.
      rechazos.quitar(clave)
    }

    return { ...respuesta, propio }
  },
  { modulo: 'asistencias' },
)

/**
 * Declarar "no realizada" y deshacerlo (CU026).
 *
 * Las dos cambian el estado de la TABLA entera, así que su clave es la tabla:
 * declarar dos veces no apila dos envíos. `version` viaja con el payload —la
 * que veía el docente— y el servidor la usa para detectar que alguien la
 * cambió entre medias.
 */
registrarEnviador(
  TIPOS_ENVIO.LECTURA_NO_REALIZADA,
  ({ idTabla, version, realizadoEn, idActividad, motivo, id_operacion: idOperacion }) =>
    marcarNoRealizada(idTabla, { idOperacion, version, realizadoEn, idActividad, motivo }),
  { modulo: 'lectura' },
)

registrarEnviador(
  TIPOS_ENVIO.LECTURA_HABILITAR,
  ({ idTabla, version, realizadoEn, idActividad, motivo, id_operacion: idOperacion }) =>
    habilitarRegistroLectura(idTabla, { idOperacion, version, realizadoEn, idActividad, motivo }),
  { modulo: 'lectura' },
)

/**
 * Inicio y cierre de actividad encolados (CU009).
 *
 * Esto funciona gracias a dos cosas que el backend puso a propósito:
 *
 *   · El UUID lo genera el cliente y `POST /actividades` es IDEMPOTENTE: 201 la
 *     primera vez, 200 si ese id ya era suyo. Reintentar no duplica.
 *   · `inicio` y `fin` son opcionales y viajan CON ZONA, así que se manda la
 *     hora REAL en que ocurrió, no la de la sincronización. Es justo lo que
 *     CU008 y CU009 exigen: las dos fechas se registran por separado.
 */
/**
 * `id_sesion` YA SE ENVÍA. El backend lo acepta desde la tanda 7.1.
 *
 * Es el `jti` de la sesión en la que ocurrió la actividad. Se captura al
 * encolar porque después es irrecuperable: si el docente vuelve a entrar, el
 * token ya es otro.
 *
 * Y hace falta justo en el caso para el que existe la cola: el docente abre la
 * actividad sin conexión, su sesión se acaba —cierre o las ocho horas—, vuelve
 * a entrar y recién entonces se sincroniza. Sin `id_sesion`, el servidor la
 * cuelga de la sesión NUEVA y comprueba que el `inicio` sea posterior al de
 * esa sesión; como ocurrió antes, responde 422 `inicio_invalido` y el envío se
 * queda atascado para siempre.
 *
 * Va SOLO aquí. En `/finalizar` no hace falta: el servidor usa la sesión que la
 * actividad ya tiene.
 */
registrarEnviador(
  TIPOS_ENVIO.ACTIVIDAD_INICIO,
  ({ id, inicio, id_sesion: idSesion }) => iniciarActividad({ id, inicio, id_sesion: idSesion }),
  { modulo: 'actividad' },
)
registrarEnviador(
  TIPOS_ENVIO.SESION_CIERRE,
  async ({ id_sesion: idSesion, fin, id_actividad: idActividad }) => {
    const respuesta = await cerrarSesionDiferido(idSesion, { fin })
    // La actividad la cerró el servidor con la sesión: que una respuesta
    // anterior del Inicio no la vuelva a dar por abierta en este navegador.
    if (idActividad) useActividadStore.getState().marcarCerrada(idActividad)
    return respuesta
  },
  { modulo: 'actividad' },
)

registrarEnviador(
  TIPOS_ENVIO.ACTIVIDAD_CIERRE,
  async ({ id, fin }) => {
    const respuesta = await finalizarActividad(id, { fin })
    // Ya cerrada en el servidor: que una respuesta anterior de Inicio no la
    // vuelva a dar por abierta en este navegador.
    useActividadStore.getState().marcarCerrada(id)
    return respuesta
  },
  { modulo: 'actividad' },
)

/** Clave de idempotencia de una fila de captura: `alumno-semana` (RNF-001). */
export const claveDeFila = (tipo, idAlumno, idSemana) => `${tipo}:${idAlumno}-${idSemana}`

/** Clave de una marca de asistencia: alumno, fecha y subprograma (CU022). */
/**
 * La clave de una marca de asistencia: LA CLASE y el alumno.
 *
 * El subprograma NO entra. Un alumno tiene un único registro de asistencia por
 * clase (CU022): estuvo o no estuvo, y eso no depende de qué está leyendo. Si
 * el subprograma formara parte de la clave, cambiar ese filtro generaría un
 * segundo envío para la misma persona y el mismo día, y el servidor acabaría
 * con dos asistencias contradictorias de un alumno que solo estuvo una vez.
 */
export const claveDeMarca = (idAlumno, fecha, idSeccion) =>
  `${TIPOS_ENVIO.ASISTENCIA}:${idAlumno}-${fecha}-${idSeccion}`

export default function useOfflineQueue() {
  const pendientes = useSyncStore((s) => s.pendientes)
  const sincronizando = useSyncStore((s) => s.sincronizando)
  const ultimoError = useSyncStore((s) => s.ultimoError)
  const items = useSyncStore((s) => s.items)

  useEffect(() => {
    iniciarCola()
  }, [])

  return { pendientes, sincronizando, ultimoError, items, encolar, reintentarAhora }
}
