// Punto de entrada de la cola offline para los componentes (RNF-001).
// Registra qué recurso atiende cada tipo de envío y expone el estado que pintan
// el SyncBadge y las filas del reporte semanal.
import { useEffect } from 'react'
import { encolar, iniciarCola, registrarEnviador, reintentarAhora } from '../lib/colaOffline'
import { guardarReporteSemanal } from '../api/resources/semanal'
import { guardarRubricaSemanal } from '../api/resources/rubrica'
import { guardarAsistencia } from '../api/resources/asistencia'
import { finalizarActividad, iniciarActividad } from '../api/resources/actividades'
import useActividadStore from '../store/actividadStore'
import useSyncStore from '../store/syncStore'

export const TIPOS_ENVIO = {
  REPORTE_SEMANAL: 'reporte-semanal',
  RUBRICA_SEMANAL: 'rubrica-semanal',
  ACTIVIDAD_INICIO: 'actividad-inicio',
  ACTIVIDAD_CIERRE: 'actividad-cierre',
  ASISTENCIA: 'asistencia',
}

registrarEnviador(TIPOS_ENVIO.REPORTE_SEMANAL, guardarReporteSemanal)
registrarEnviador(TIPOS_ENVIO.RUBRICA_SEMANAL, guardarRubricaSemanal)
// CU022: cada micro-paquete del Auto-save. La clave es alumno-fecha-programa,
// la misma unicidad que garantiza la base, así que marcar y desmarcar al mismo
// alumno dos veces deja UN solo envío en la cola y no dos contradictorios.
registrarEnviador(TIPOS_ENVIO.ASISTENCIA, ({ fecha, registros, fechaRegistro }) =>
  guardarAsistencia({ fecha, registros, fechaRegistro }),
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
registrarEnviador(TIPOS_ENVIO.ACTIVIDAD_INICIO, ({ id, inicio, id_sesion: idSesion }) =>
  iniciarActividad({ id, inicio, id_sesion: idSesion }),
)
registrarEnviador(TIPOS_ENVIO.ACTIVIDAD_CIERRE, async ({ id, fin }) => {
  const respuesta = await finalizarActividad(id, { fin })
  // Ya cerrada en el servidor: que una respuesta anterior de Inicio no la
  // vuelva a dar por abierta en este navegador.
  useActividadStore.getState().marcarCerrada(id)
  return respuesta
})

/** Clave de idempotencia de una fila de captura: `alumno-semana` (RNF-001). */
export const claveDeFila = (tipo, idAlumno, idSemana) => `${tipo}:${idAlumno}-${idSemana}`

/** Clave de una marca de asistencia: alumno, fecha y subprograma (CU022). */
export const claveDeMarca = (idAlumno, fecha, idPrograma) =>
  `${TIPOS_ENVIO.ASISTENCIA}:${idAlumno}-${fecha}-${idPrograma}`

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
