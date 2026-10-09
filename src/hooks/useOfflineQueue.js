// Punto de entrada de la cola offline para los componentes (RNF-001).
// Registra qué recurso atiende cada tipo de envío y expone el estado que pintan
// el SyncBadge y las filas del reporte semanal.
import { useEffect } from 'react'
import { encolar, iniciarCola, registrarEnviador, reintentarAhora } from '../lib/colaOffline'
import { guardarReporteSemanal } from '../api/resources/semanal'
import { guardarRubricaSemanal } from '../api/resources/rubrica'
import { finalizarActividad, iniciarActividad } from '../api/resources/actividades'
import useSyncStore from '../store/syncStore'

export const TIPOS_ENVIO = {
  REPORTE_SEMANAL: 'reporte-semanal',
  RUBRICA_SEMANAL: 'rubrica-semanal',
  ACTIVIDAD_INICIO: 'actividad-inicio',
  ACTIVIDAD_CIERRE: 'actividad-cierre',
}

registrarEnviador(TIPOS_ENVIO.REPORTE_SEMANAL, guardarReporteSemanal)
registrarEnviador(TIPOS_ENVIO.RUBRICA_SEMANAL, guardarRubricaSemanal)

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
 * `id_sesion` SE GUARDA pero TODAVÍA NO SE ENVÍA.
 *
 * Es el `jti` de la sesión en la que ocurrió la actividad. Se captura al
 * encolar porque después es irrecuperable: si el docente vuelve a entrar, el
 * token ya es otro. El backend aún no acepta el campo —entra con la
 * sincronización offline, que no es de esta entrega—, así que se omite al
 * mandar. Cuando Paris avise, basta con incluirlo en estas dos llamadas: los
 * pendientes que ya estén en IndexedDB lo llevarán consigo.
 */
registrarEnviador(TIPOS_ENVIO.ACTIVIDAD_INICIO, ({ id, inicio }) => iniciarActividad({ id, inicio }))
registrarEnviador(TIPOS_ENVIO.ACTIVIDAD_CIERRE, ({ id, fin }) => finalizarActividad(id, { fin }))

/** Clave de idempotencia de una fila de captura: `alumno-semana` (RNF-001). */
export const claveDeFila = (tipo, idAlumno, idSemana) => `${tipo}:${idAlumno}-${idSemana}`

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
