// D4 — Sin actividades iniciadas la grilla se ve, pero no se edita.
//
// No es una restricción de permisos: es que cada cambio tiene que quedar atado
// a una sesión de actividades para poder auditarlo después. Sin esa sesión no
// habría a qué ligarlo.
//
// EL AVISO NO LLEVA BOTÓN, y conviene decir por qué porque ya cambió una vez.
// U24 (auditoría de UX #737) se lo puso, con el argumento de que el de
// "Iniciar actividad" había que buscarlo en la esquina superior derecha. Pero
// ese botón NO se esconde: `BarraActividades` lo mantiene siempre visible en
// la barra superior, así que quedaban dos botones idénticos a dos dedos de
// distancia, y el de abajo empujaba el texto del aviso. Un control repetido no
// es más fácil de encontrar: es más difícil de entender, porque invita a
// preguntarse en qué se diferencian.
import { Info, PlayCircle } from 'lucide-react'
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
  // El ícono de "play" solo donde hay algo que iniciar; los demás motivos
  // llevan el de información, que no promete una acción (U24).
  const Icono = mensaje === SIN_ACTIVIDAD ? PlayCircle : Info

  return (
    <div
      role="note"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-info-600/20 bg-info-100 px-4 py-3 text-sm text-ink-700"
    >
      <span className="flex min-w-0 flex-1 items-start gap-2">
        <Icono className="mt-0.5 h-4 w-4 shrink-0 text-info-600" aria-hidden="true" />
        <span>{mensaje}</span>
      </span>
    </div>
  )
}
