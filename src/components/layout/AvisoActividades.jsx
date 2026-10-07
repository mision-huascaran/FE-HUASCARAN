// D4 — Sin actividades iniciadas la grilla se ve, pero no se edita.
//
// No es una restricción de permisos: es que cada cambio tiene que quedar atado
// a una sesión de actividades para poder auditarlo después. Sin esa sesión no
// habría a qué ligarlo.
import { PlayCircle } from 'lucide-react'

export default function AvisoActividades() {
  return (
    <div
      role="note"
      className="flex items-start gap-2 rounded-xl border border-info-600/20 bg-info-100 px-4 py-3 text-sm text-ink-700"
    >
      <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-info-600" aria-hidden="true" />
      <span>
        Pulse <strong>Iniciar actividades</strong> en la barra superior para registrar. Mientras tanto
        la grilla se muestra en solo lectura.
      </span>
    </div>
  )
}
