// Punto de entrada de la cola offline para los componentes (RNF-001).
// Registra qué recurso atiende cada tipo de envío y expone el estado que pintan
// el SyncBadge y las filas del reporte semanal.
import { useEffect } from 'react'
import { encolar, iniciarCola, registrarEnviador, reintentarAhora } from '../lib/colaOffline'
import { guardarReporteSemanal } from '../api/resources/semanal'
import { guardarRubricaSemanal } from '../api/resources/rubrica'
import { finalizarActividad, iniciarActividad } from '../api/resources/actividades'
import useActividadStore from '../store/actividadStore'
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
 * token ya es otro.
 *
 * CÓMO ACTIVARLO cuando el backend lo soporte (contrato acordado con Paris):
 *
 *   · Va SOLO en `POST /actividades`. En `/finalizar` no hace falta: el
 *     servidor usa la sesión que ya tiene la actividad.
 *   · Con un `id_sesion` de otra sesión, `inicio` pasa a ser OBLIGATORIO.
 *     Ya se manda siempre, así que no hay nada que cambiar ahí.
 *
 * Es decir, una sola línea:
 *   ACTIVIDAD_INICIO, ({ id, inicio, id_sesion }) => iniciarActividad({ id, inicio, id_sesion })
 *
 * Ojo: el campo se ignora en silencio si el backend aún no lo acepta —lo
 * comprobamos—, así que activarlo antes de tiempo no daría ningún error y
 * parecería funcionar sin hacerlo.
 */
registrarEnviador(TIPOS_ENVIO.ACTIVIDAD_INICIO, ({ id, inicio }) => iniciarActividad({ id, inicio }))
registrarEnviador(TIPOS_ENVIO.ACTIVIDAD_CIERRE, async ({ id, fin }) => {
  const respuesta = await finalizarActividad(id, { fin })
  // Ya cerrada en el servidor: que una respuesta anterior de Inicio no la
  // vuelva a dar por abierta en este navegador.
  useActividadStore.getState().marcarCerrada(id)
  return respuesta
})

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
