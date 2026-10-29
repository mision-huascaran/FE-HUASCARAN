// D4 — Sin actividades iniciadas la grilla se ve, pero no se edita.
//
// No es una restricción de permisos: es que cada cambio tiene que quedar atado
// a una sesión de actividades para poder auditarlo después. Sin esa sesión no
// habría a qué ligarlo.
import { PlayCircle } from 'lucide-react'
import { SIN_ACTIVIDAD } from '../../api/resources/sincronizacion'

/**
 * @param mensaje texto completo. Por defecto, el mismo que responde el
 *   servidor al rechazar una escritura sin actividad: así el docente lee lo
 *   mismo antes de intentarlo y después de que se lo rechacen.
 *
 *   Lo habitual es pasarle el `detail` o el `escritura.motivo` que llega; el
 *   valor por defecto es solo para cuando la pantalla sabe por sí misma que no
 *   hay actividad y todavía no ha preguntado al servidor.
 */
export default function AvisoActividades({ mensaje = SIN_ACTIVIDAD }) {
  return (
    <div
      role="note"
      className="flex items-start gap-2 rounded-xl border border-info-600/20 bg-info-100 px-4 py-3 text-sm text-ink-700"
    >
      <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-info-600" aria-hidden="true" />
      <span>{mensaje}</span>
    </div>
  )
}
