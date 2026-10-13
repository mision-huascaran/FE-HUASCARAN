// D4 — Sin actividades iniciadas la grilla se ve, pero no se edita.
//
// No es una restricción de permisos: es que cada cambio tiene que quedar atado
// a una sesión de actividades para poder auditarlo después. Sin esa sesión no
// habría a qué ligarlo.
import { PlayCircle } from 'lucide-react'

/**
 * @param destino qué queda en solo lectura mientras no haya actividad. El botón
 *   se llama "Iniciar actividad" (CU010): el aviso decía "Iniciar actividades".
 * @param mensaje texto completo, para los casos de uso que lo dan literal. CU022
 *   fija el suyo palabra por palabra y el probador lo comprueba así.
 */
export default function AvisoActividades({ destino = 'la grilla se muestra', mensaje }) {
  return (
    <div
      role="note"
      className="flex items-start gap-2 rounded-xl border border-info-600/20 bg-info-100 px-4 py-3 text-sm text-ink-700"
    >
      <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-info-600" aria-hidden="true" />
      {mensaje ? (
        <span>{mensaje}</span>
      ) : (
        <span>
          Pulse <strong>Iniciar actividad</strong> en la barra superior para registrar. Mientras tanto
          {` ${destino} en solo lectura.`}
        </span>
      )}
    </div>
  )
}
