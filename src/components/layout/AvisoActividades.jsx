// D4 — Sin actividades iniciadas la grilla se ve, pero no se edita.
//
// No es una restricción de permisos: es que cada cambio tiene que quedar atado
// a una sesión de actividades para poder auditarlo después. Sin esa sesión no
// habría a qué ligarlo.
import { PlayCircle } from 'lucide-react'

/**
 * CU010 lo da PALABRA POR PALABRA, igual que CU022. Antes decía «Pulse
 * "Iniciar actividad" para poder registrar.», que dice lo mismo pero no es lo
 * que el caso de uso exige, y el probador lo compara carácter a carácter.
 */
const SIN_ACTIVIDAD = 'Inicia una actividad de trabajo para habilitar el registro de datos.'

/**
 * @param mensaje texto completo. Por defecto el literal de CU010, que es el que
 *   piden todas las grillas; se puede sustituir si un caso de uso da otro.
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
